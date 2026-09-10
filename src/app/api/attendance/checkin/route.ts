import { NextRequest } from 'next/server'
import { db, ok, bad, sendWhatsApp } from '@/lib/api'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { broadcastPresence } from '@/lib/presence-broadcast'
import { ensureAttendanceSchema } from '@/lib/attendance-schema'
import {
  parseGps,
  validateGpsQuality,
  evaluateCheckinGps,
  roundCoord,
  MAX_CHECKIN_ACCURACY_M,
} from '@/lib/geo'

/**
 * Check-in QR kehadiran (Task 30/32) + VALIDASI GPS ANTI-FAKEGPS (Task 33):
 * - HADIR hanya sah bila perangkat berada ≤ 20 m dari titik GPS tempat
 *   ustadz membuka sesi/QR (anchor disimpan saat POST /api/sessions).
 * - Heuristik anti-fakeGPS server-side: freshness posisi ≤ 3 menit,
 *   akurasi ≤ 100 m, sanity koordinat, deteksi koordinat identik berulang.
 * - Jarak dihitung SERVER (haversine) — tidak bisa dibohongi klien.
 * PUBLIK by design (kode sesi = kunci), dengan rate limit anti-spam.
 */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`checkin:${clientIp(req)}`, 20, 60 * 1000)) {
      return bad('Terlalu banyak percobaan. Tunggu sebentar.', 429)
    }
    await ensureAttendanceSchema()
    const { code, studentId, gps: rawGps } = await req.json()
    if (!code || !studentId) return bad('Kode kehadiran dan santri wajib dipilih')

    const session = await db.session.findUnique({ where: { code: String(code).trim().toUpperCase() }, include: { class: true } })
    if (!session) return bad('Kode kehadiran tidak ditemukan', 404)
    if (!session.isActive) return bad('Sesi sudah ditutup', 400)

    // ==== GPS wajib + kualitas sinyal ====
    const gps = parseGps(rawGps)
    if (!gps) {
      return bad('Lokasi GPS wajib untuk check-in. Izinkan akses lokasi pada browser, tunggu posisi terkunci, lalu coba lagi.')
    }
    const qualityErr = validateGpsQuality(gps, { maxAccuracy: MAX_CHECKIN_ACCURACY_M, requireFresh: true })
    if (qualityErr) return bad(qualityErr)

    // ==== Sesi wajib punya titik anchor ====
    if (session.lat === null || session.lng === null) {
      return bad(
        'Sesi ini belum memiliki titik lokasi GPS. Minta ustadz menekan "Perbarui Titik GPS" pada QR kelas, lalu check-in lagi.',
        409,
      )
    }

    // ==== Jarak ≤ 20 m dari titik absen (server-side) ====
    const evalResult = evaluateCheckinGps(gps, { lat: session.lat, lng: session.lng })
    if (!evalResult.ok) return bad(evalResult.reason ?? 'Jarak dari titik absen terlalu jauh.')

    const student = await db.student.findUnique({ where: { id: studentId }, include: { parent: true, class: true } })
    if (!student) return bad('Santri tidak ditemukan', 404)
    if (student.classId !== session.classId) {
      return bad(`Santri tidak terdaftar di kelas ${session.class.name}`, 400)
    }

    const existing = await db.attendance.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
    })
    if (existing) return ok({ already: true, message: `${student.fullName} sudah tercatat ${existing.status} pada sesi ini.` })

    // ==== Anti-fakeGPS: deteksi koordinat identik berulang ====
    // GPS asli selalu "goyah" — koordinat persis sama (≈1 cm) untuk ≥3 santri
    // berbeda pada satu sesi hampir pasti hasil mock/tools.
    const rLat = roundCoord(gps.lat)
    const rLng = roundCoord(gps.lng)
    const dupCount = await db.attendance.count({
      where: { sessionId: session.id, lat: rLat, lng: rLng },
    })
    const flags = { ...evalResult.flags, dupCount, dup: dupCount >= 2 }
    if (dupCount >= 2) {
      return bad(
        'Pola lokasi mencurigakan terdeteksi (koordinat identik dengan check-in lain). Gunakan GPS asli perangkat Anda sendiri.',
        409,
      )
    }

    await db.attendance.create({
      data: {
        sessionId: session.id,
        studentId,
        status: 'HADIR',
        method: 'QR_GPS',
        lat: rLat,
        lng: rLng,
        accuracy: gps.accuracy ?? null,
        gpsAt: gps.posTs ? new Date(gps.posTs) : new Date(),
        distanceM: evalResult.distanceM,
        gpsFlags: JSON.stringify(flags),
      },
    })
    broadcastPresence({
      id: crypto.randomUUID(),
      type: 'checkin',
      sessionId: session.id,
      sessionCode: session.code,
      className: session.class.name,
      studentId,
      studentName: student.fullName,
      status: 'HADIR',
      at: new Date().toISOString(),
    })
    if (student.parent) {
      await sendWhatsApp({
        phone: student.parent.phone,
        userId: student.parent.id,
        message: `Assalamu'alaikum Bpk/Ibu ${student.parent.name}, *${student.fullName}* baru saja check-in (QR+GPS) HADIR di kelas ${session.class.name} pukul ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} (±${Math.round(evalResult.distanceM)} m dari titik absen). — TPQ Darul Jinan`,
      })
    }
    return ok({
      success: true,
      distanceM: evalResult.distanceM,
      message: `Alhamdulillah, ${student.fullName} tercatat HADIR (±${Math.round(evalResult.distanceM)} m dari titik absen)!`,
    })
  } catch {
    return bad('Gagal check-in')
  }
}
