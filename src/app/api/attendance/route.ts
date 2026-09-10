import { NextRequest } from 'next/server'
import { db, ok, bad, sendWhatsApp } from '@/lib/api'
import { guard } from '@/lib/session'
import { ensureAttendanceSchema } from '@/lib/attendance-schema'
import { saveImageFromDataUrl } from '@/lib/storage'
import {
  parseGps,
  validateGpsQuality,
  roundCoord,
  MAX_CHECKIN_ACCURACY_M,
} from '@/lib/geo'

export async function GET(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'GURU', 'ORANG_TUA'])
  if ('res' in g) return g.res
  await ensureAttendanceSchema()
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  const classId = req.nextUrl.searchParams.get('classId')
  const studentId = req.nextUrl.searchParams.get('studentId')
  const studentFilter = g.session.role === 'ORANG_TUA'
    ? { parentId: g.session.id, ...(classId && { classId }) }
    : g.session.role === 'GURU'
      ? { class: { teacherId: g.session.teacherId ?? '__no_teacher__' }, ...(classId && { classId }) }
      : classId
        ? { classId }
        : undefined
  const records = await db.attendance.findMany({
    where: {
      ...(sessionId && { sessionId }),
      ...(studentId && { studentId }),
      ...(studentFilter && { student: studentFilter }),
    },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      session: { select: { id: true, date: true, topic: true, class: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return ok(
    records.map((r) => ({
      ...r,
      className: r.session.class.name,
      session: undefined,
      // Bukti GPS hanya untuk staff (audit); wali cukup lihat metode + bukti foto.
      ...(['ADMIN', 'GURU'].includes(g.session.role)
        ? {}
        : { lat: undefined, lng: undefined, accuracy: undefined, gpsFlags: undefined, proofLat: undefined, proofLng: undefined, proofAccuracy: undefined, proofGpsFlags: undefined }),
    })),
  )
}

interface BulkRecord {
  studentId?: string
  status?: string
  note?: string
  proof?: {
    dataUrl?: string
    lat?: number
    lng?: number
    accuracy?: number
    posTs?: number
  }
}

// Bulk record izin/sakit/alpa (Task 33 — HADIR MANUAL DIHAPUS):
// - HADIR: hanya sah via check-in QR + GPS ≤ 20 m (API /api/attendance/checkin).
// - IZIN/SAKIT: WAJIB foto surat (bukti) + GPS kamera; foto disimpan R2,
//   timestamp & GPS dicap permanen pada gambar oleh kamera di sisi klien.
// - ALPA: boleh manual (bukan klaim kehadiran — justru catatan pelanggaran).
export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'GURU'])
    if ('res' in g) return g.res
    await ensureAttendanceSchema()
    const { sessionId, records } = (await req.json()) as { sessionId?: string; records?: BulkRecord[] }
    if (!sessionId || !Array.isArray(records)) return bad('Data absensi tidak valid')
    // Temuan pentest F-04: batasi jumlah santri per permintaan (anti-DoS CPU Workers)
    if (records.length > 100) return bad('Maksimal 100 santri per permintaan. Pecah pengisian menjadi beberapa batch.')
    const session = await db.session.findUnique({ where: { id: sessionId }, include: { class: true } })
    if (!session) return bad('Sesi tidak ditemukan')
    if (g.session.role === 'GURU' && session.class.teacherId !== g.session.teacherId) {
      return bad('Anda bukan pengampu kelas sesi ini', 403)
    }

    // Temuan pentest F-03: santri yang dicatat WAJIB tergolong kelas sesi —
    // mencegah guru menimpa status / memicu WA untuk santri kelas lain.
    const classStudents = await db.student.findMany({
      where: { classId: session.classId },
      select: { id: true },
    })
    const classStudentIds = new Set(classStudents.map((s) => s.id))

    for (const r of records) {
      if (!r.studentId) continue
      if (!classStudentIds.has(r.studentId)) {
        return bad(`Santri tidak tergolong kelas ${session.class.name}. Periksa kembali pilihan santri.`, 400)
      }
      const status = (r.status || '').toUpperCase()

      if (status === 'HADIR') {
        return bad(
          'Hadir tidak boleh dicatat manual. Kehadiran hanya sah melalui check-in QR + GPS oleh santri/wali (maks 20 m dari titik absen).',
        )
      }
      if (status !== 'IZIN' && status !== 'SAKIT' && status !== 'ALPA') {
        return bad(`Status "${r.status}" tidak dikenal. Gunakan IZIN, SAKIT, atau ALPA.`)
      }

      let proofData: {
        proofUrl: string
        proofLat: number | null
        proofLng: number | null
        proofAccuracy: number | null
        proofAt: Date
        proofGpsFlags: string
      } | null = null

      // ==== Lindungi catatan HADIR hasil check-in QR (GPS-validated) ====
      // Kehadiran terverifikasi GPS tidak boleh ditimpa IZIN/SAKIT/ALPA manual.
      const existing = await db.attendance.findUnique({
        where: { sessionId_studentId: { sessionId, studentId: r.studentId } },
      })
      if (existing?.status === 'HADIR') {
        return bad(
          `Santri ini sudah tercatat HADIR via check-in QR+GPS dan tidak dapat diubah menjadi ${status}.`,
        )
      }

      if (status === 'IZIN' || status === 'SAKIT') {
        // ==== Bukti foto surat WAJIB + GPS anti-fakeGPS ====
        const proof = r.proof
        const dataUrl = typeof proof?.dataUrl === 'string' ? proof.dataUrl : ''
        if (!dataUrl) {
          return bad(`${status === 'IZIN' ? 'Izin' : 'Sakit'} wajib menyertakan FOTO surat bukti. Potret suratnya lewat kamera.`)
        }
        const gps = parseGps(proof)
        if (!gps) {
          return bad('GPS kamera wajib untuk foto bukti. Izinkan akses lokasi lalu potret ulang suratnya.')
        }
        // Temuan pentest F-02: waktu posisi wajib — tanpa posTs, heuristik
        // freshness (≤3 menit) bisa dilewati dengan koordinat beku hasil replay.
        if (!gps.posTs) {
          return bad('Data waktu posisi tidak lengkap. Potret ulang surat lewat kamera aplikasi.')
        }
        const gpsErr = validateGpsQuality(gps, { maxAccuracy: MAX_CHECKIN_ACCURACY_M, requireFresh: true })
        if (gpsErr) return bad(`Foto bukti ditolak: ${gpsErr}`)

        const saved = await saveImageFromDataUrl(dataUrl, `bukti-${status.toLowerCase()}`)
        if (saved.error || !saved.url) return bad(`Gagal menyimpan foto bukti: ${saved.error ?? 'tidak diketahui'}`)

        proofData = {
          proofUrl: saved.url,
          proofLat: roundCoord(gps.lat),
          proofLng: roundCoord(gps.lng),
          proofAccuracy: gps.accuracy ?? null,
          proofAt: gps.posTs ? new Date(gps.posTs) : new Date(),
          proofGpsFlags: JSON.stringify({
            accuracy: gps.accuracy ?? null,
            posTs: gps.posTs ?? null,
            check: 'gps-kamera-bukti',
          }),
        }
      }

      await db.attendance.upsert({
        where: { sessionId_studentId: { sessionId, studentId: r.studentId } },
        update: {
          status,
          note: typeof r.note === 'string' ? r.note.slice(0, 500) : null,
          method: status === 'ALPA' ? 'ALPA_MANUAL' : `${status}_FOTO`,
          recordedBy: g.session.name,
          ...(proofData ?? { proofUrl: null, proofLat: null, proofLng: null, proofAccuracy: null, proofAt: null, proofGpsFlags: null }),
        },
        create: {
          sessionId,
          studentId: r.studentId,
          status,
          note: typeof r.note === 'string' ? r.note.slice(0, 500) : null,
          method: status === 'ALPA' ? 'ALPA_MANUAL' : `${status}_FOTO`,
          recordedBy: g.session.name,
          ...proofData,
        },
      })

      // WhatsApp notification to parent (per blueprint: hadir/ketidakhadiran)
      const student = await db.student.findUnique({ where: { id: r.studentId }, include: { parent: true } })
      if (student?.parent) {
        const label = { IZIN: 'IZIN (foto surat tercatat)', SAKIT: 'SAKIT (foto surat tercatat)', ALPA: 'TIDAK HADIR (ALPA)' }[status] || status
        await sendWhatsApp({
          phone: student.parent.phone,
          userId: student.parent.id,
          message: `Assalamu'alaikum Bpk/Ibu ${student.parent.name}, putra/i Anda *${student.fullName}* tercatat *${label}* pada kelas ${session.class.name} (${session.date.toLocaleDateString('id-ID')}). Mohon konfirmasi. — TPQ Darul Jinan`,
        })
      }
    }
    const attendances = await db.attendance.findMany({ where: { sessionId } })
    return ok({ success: true, count: attendances.length })
  } catch {
    return bad('Gagal menyimpan absensi')
  }
}
