import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard, getSession } from '@/lib/session'
import { broadcastPresence } from '@/lib/presence-broadcast'
import { ensureAttendanceSchema } from '@/lib/attendance-schema'
import { parseGps, validateGpsQuality, roundCoord, MAX_SESSION_ACCURACY_M } from '@/lib/geo'

export async function GET(req: NextRequest) {
  await ensureAttendanceSchema()
  // Daftar sesi dipakai halaman cek-in publik -> tetap terbuka, NAMAI kode
  // kerahasiaan QR: admin/guru melihat semua; WALI hanya kode sesi kelas
  // tempat anaknya terdaftar (dipakai check-in anak di portal wali);
  // publik anonim tidak menerima kode sama sekali (jalurnya via QR/roster).
  const session = await getSession(req)
  const staff = session?.role === 'ADMIN' || session?.role === 'GURU'
  let parentClassIds: string[] = []
  if (session?.role === 'ORANG_TUA') {
    const kids = await db.student.findMany({
      where: { parentId: session.id },
      select: { classId: true },
    })
    parentClassIds = [...new Set(kids.map((k) => k.classId))]
  }
  const active = req.nextUrl.searchParams.get('active')
  const classId = req.nextUrl.searchParams.get('classId')
  // Temuan pentest F-10: anonim tidak boleh melihat riwayat 50 sesi (pola
  // operasional sekolah). Publik hanya menerima sesi AKTIF, tanpa jumlah hadir.
  const anon = !session
  const sessions = await db.session.findMany({
    where: {
      ...((anon || active === '1') && { isActive: true }),
      ...(classId && { classId }),
    },
    include: {
      class: { select: { id: true, name: true, level: true } },
      ...(anon ? {} : { attendances: { select: { status: true, studentId: true } } }),
    },
    orderBy: { date: 'desc' },
    take: anon ? 20 : 50,
  })
  return ok(
    sessions.map((s) => ({
      id: s.id,
      classId: s.classId,
      className: s.class.name,
      classLevel: s.class.level,
      date: s.date,
      topic: s.topic,
      code: (staff || (session?.role === 'ORANG_TUA' && parentClassIds.includes(s.classId))) ? s.code : undefined,
      // Titik GPS absen — hanya staff (wali/publik tak perlu & jangan bocor)
      ...(staff && {
        lat: s.lat,
        lng: s.lng,
        locAccuracy: s.locAccuracy,
        locAt: s.locAt,
      }),
      isActive: s.isActive,
      ...(anon
        ? {}
        : {
            total: s.attendances.length,
            hadir: s.attendances.filter((a) => a.status === 'HADIR').length,
          }),
    }))
  )
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'GURU'])
    if ('res' in g) return g.res
    await ensureAttendanceSchema()
    const b = await req.json()
    if (!b.classId) return bad('Kelas wajib dipilih')
    // Titik anchor WAJIB — dua cara (Task 35):
    //  1. gps        — GPS perangkat ustadz saat QR dibuat (accuracy + freshness divalidasi)
    //  2. mapAnchor  — titik dipilih di peta / koordinat tempelan (exact, tanpa ±akurasi)
    // Check-in santri selalu dihitung SERVER ≤ 20 m dari titik ini (anti absen palsu).
    const gps = parseGps(b.mapAnchor) ?? parseGps(b.gps)
    if (!gps) return bad('Titik lokasi wajib. Pilih titik di peta, tempel koordinat, atau izinkan GPS perangkat.')
    const gpsErr = validateGpsQuality(gps, { maxAccuracy: MAX_SESSION_ACCURACY_M, requireFresh: true })
    if (gpsErr) return bad(gpsErr)
    // Temuan pentest F-05: batas panjang topik
    if (typeof b.topic === 'string' && b.topic.length > 500) return bad('Topik maksimal 500 karakter')
    const cls = await db.class.findUnique({ where: { id: b.classId } })
    if (!cls) return bad('Kelas tidak ditemukan')
    if (g.session.role === 'GURU' && cls.teacherId !== g.session.teacherId) {
      return bad('Anda bukan pengampu kelas ini', 403)
    }
    // close previous active sessions of this class
    await db.session.updateMany({ where: { classId: b.classId, isActive: true }, data: { isActive: false } })
    const code = `DJ-${cls.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const session = await db.session.create({
      data: {
        classId: b.classId,
        topic: b.topic || null,
        date: b.date ? new Date(b.date) : new Date(),
        code,
        isActive: true,
        lat: roundCoord(gps.lat),
        lng: roundCoord(gps.lng),
        locAccuracy: gps.accuracy ?? null,
        locAt: new Date(),
      },
    })
    broadcastPresence({
      id: crypto.randomUUID(),
      type: 'session_open',
      sessionId: session.id,
      sessionCode: code,
      className: cls.name,
      actor: g.session.name,
      at: new Date().toISOString(),
    })
    return ok(session)
  } catch {
    return bad('Gagal membuat sesi')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'GURU'])
    if ('res' in g) return g.res
    await ensureAttendanceSchema()
    const b = await req.json()
    if (!b.id) return bad('ID wajib')
    const existing = await db.session.findUnique({ where: { id: b.id }, include: { class: true } })
    if (!existing) return bad('Sesi tidak ditemukan', 404)
    if (g.session.role === 'GURU' && existing.class.teacherId !== g.session.teacherId) {
      return bad('Anda bukan pengampu kelas sesi ini', 403)
    }
    // Aksi "lokasi": perbarui titik GPS anchor (ustadz pindah ruangan / sesi lama
    // belum punya titik). Check-in santri selanjutnya dihitung dari titik baru.
    if (b.action === 'lokasi') {
      // Titik baru bisa dari GPS perangkat (gps) atau peta (mapAnchor) — lihat POST.
      const gps = parseGps(b.mapAnchor) ?? parseGps(b.gps)
      if (!gps) return bad('Titik lokasi wajib. Pilih titik di peta, tempel koordinat, atau izinkan GPS perangkat.')
      const gpsErr = validateGpsQuality(gps, { maxAccuracy: MAX_SESSION_ACCURACY_M, requireFresh: true })
      if (gpsErr) return bad(gpsErr)
      const session = await db.session.update({
        where: { id: b.id },
        data: {
          lat: roundCoord(gps.lat),
          lng: roundCoord(gps.lng),
          locAccuracy: gps.accuracy ?? null,
          locAt: new Date(),
        },
      })
      return ok(session)
    }
    const session = await db.session.update({ where: { id: b.id }, data: { isActive: !!b.isActive } })
    broadcastPresence({
      id: crypto.randomUUID(),
      type: b.isActive ? 'session_open' : 'session_close',
      sessionId: existing.id,
      sessionCode: existing.code,
      className: existing.class.name,
      actor: g.session.name,
      at: new Date().toISOString(),
    })
    return ok(session)
  } catch {
    return bad('Gagal memperbarui sesi')
  }
}
