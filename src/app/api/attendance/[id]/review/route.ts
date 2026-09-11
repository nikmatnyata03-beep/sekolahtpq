import { NextRequest } from 'next/server'
import { db, ok, bad, sendWhatsApp } from '@/lib/api'
import { guard } from '@/lib/session'

/**
 * Task 42 — verifikasi absen "perangkat ganda" oleh ustadz/admin.
 *
 * Latar: wali bisa saja sah memakai 1 HP utk 2 anak. Check-in perangkat sama
 * dalam satu sesi dicatat dengan flag dupDevice (menunggu verifikasi).
 * Guru pengampu kelas (atau admin) memutuskan:
 *  - approve → tandai sah (flag reviewed, jejak reviewer)
 *  - revoke  → batalkan kehadiran: status ALPA + WA info ke wali
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard(req, ['ADMIN', 'GURU'])
  if ('res' in g) return g.res

  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { action?: string; note?: string }
  const action = (body.action ?? '').toLowerCase()
  if (action !== 'approve' && action !== 'revoke') {
    return bad('Aksi tidak dikenal. Gunakan approve atau revoke.')
  }

  const record = await db.attendance.findUnique({
    where: { id },
    include: {
      student: { include: { parent: true } },
      session: { include: { class: true } },
    },
  })
  if (!record) return bad('Catatan absensi tidak ditemukan', 404)
  if (g.session.role === 'GURU' && record.session.class.teacherId !== g.session.teacherId) {
    return bad('Anda bukan pengampu kelas sesi ini', 403)
  }

  // Parse flag lama — record tanpa flag (check-in lama) tak sah utk direview.
  let flags: Record<string, unknown> = {}
  try {
    flags = record.gpsFlags ? (JSON.parse(record.gpsFlags) as Record<string, unknown>) : {}
  } catch {
    flags = {}
  }

  if (action === 'approve') {
    flags.dupDeviceReviewed = true
    flags.reviewAction = 'approve'
    flags.reviewedBy = g.session.name
    flags.reviewedAt = new Date().toISOString()
    const updated = await db.attendance.update({
      where: { id },
      data: { gpsFlags: JSON.stringify(flags) },
    })
    return ok({ success: true, attendance: updated, message: `Absen ${record.student.fullName} ditandai SAH.` })
  }

  // ==== revoke: batalkan kehadiran ====
  if (record.status !== 'HADIR') {
    return bad('Hanya absen HADIR yang dapat dibatalkan.')
  }
  flags.dupDeviceReviewed = true
  flags.reviewAction = 'revoke'
  flags.reviewedBy = g.session.name
  flags.reviewedAt = new Date().toISOString()
  const note = [
    typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : null,
    `Dibatalkan ${g.session.name} (perangkat ganda)`,
  ]
    .filter(Boolean)
    .join(' — ')
  const updated = await db.attendance.update({
    where: { id },
    data: {
      status: 'ALPA',
      method: 'ALPA_MANUAL',
      note,
      gpsFlags: JSON.stringify(flags),
      recordedBy: g.session.name,
    },
  })
  if (record.student.parent) {
    await sendWhatsApp({
      phone: record.student.parent.phone,
      userId: record.student.parent.id,
      message: `Assalamu'alaikum Bpk/Ibu ${record.student.parent.name}, check-in *${record.student.fullName}* pada kelas ${record.session.class.name} DIBATALKAN oleh ustadz (${g.session.name}) karena terdeteksi perangkat yang sama dengan check-in lain. Silakan hubungi ustadz utk konfirmasi kehadiran. — TPQ Darul Jinan`,
    })
  }
  return ok({ success: true, attendance: updated, message: `Absen ${record.student.fullName} dibatalkan (ALPA).` })
}
