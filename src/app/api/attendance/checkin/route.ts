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
import { parseAttendanceCode, verifyRotatingSuffix } from '@/lib/rotating-code'
import type { DeviceSignal } from '@/lib/device-fingerprint'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Task 42 — hash perangkat: SHA-256(UA header + sinyal ringan klien).
 * 16 byte pertama (128-bit) cukup utk membedakan ponsel di satu TPQ.
 * Hash dihitung SERVER agar payload mentah tak tersimpan & tak bisa dihindari
 * dengan memilih tidak mengirim sinyal (sinyal kosong → komponen "u" tetap stabil).
 */
async function computeDeviceHash(ua: string | null, sig: DeviceSignal | undefined): Promise<string | null> {
  if (!ua && (!sig || Object.keys(sig).length === 0)) return null
  const parts = [
    ua ?? 'u',
    sig?.screen ?? 'u',
    sig?.tz ?? 'u',
    sig?.lang ?? 'u',
    sig?.langs ?? 'u',
    sig?.cores ?? 'u',
    sig?.mem ?? 'u',
    sig?.touch ?? 'u',
    sig?.dpr ?? 'u',
  ]
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts.join('\n')))
  return Array.from(new Uint8Array(buf))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

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
    const { code, studentId, gps: rawGps, device, confirmSharedDevice } = (await req.json()) as {
      code?: string
      studentId?: string
      gps?: unknown
      device?: DeviceSignal
      confirmSharedDevice?: boolean
    }
    if (!code || !studentId) return bad('Kode kehadiran dan santri wajib dipilih')

    // Task 41: QR berotasi — input bisa `STATIS.SUFIX`. Sufiks wajib masih
    // segar (jendela 60 dtk + toleransi 1 jendela); statis polos tetap sah.
    const parsedCode = parseAttendanceCode(String(code))
    if (parsedCode.rot) {
      const rotErr = await verifyRotatingSuffix(parsedCode.rot, parsedCode.staticCode)
      if (rotErr) return bad(rotErr)
    }

    const session = await db.session.findUnique({ where: { code: parsedCode.staticCode }, include: { class: true } })
    if (!session) return bad('Kode kehadiran tidak ditemukan', 404)
    if (!session.isActive) return bad('Sesi sudah ditutup', 400)

    // ==== GPS wajib + kualitas sinyal ====
    const gps = parseGps(rawGps)
    if (!gps) {
      return bad('Lokasi GPS wajib untuk check-in. Izinkan akses lokasi pada browser, tunggu posisi terkunci, lalu coba lagi.')
    }
    // Temuan pentest F-02: waktu posisi wajib — tanpa posTs, heuristik
    // freshness (≤3 menit) bisa dilewati klien dgn koordinat beku hasil replay.
    if (!gps.posTs) {
      return bad('Data waktu posisi tidak lengkap. Ambil lokasi ulang lalu coba lagi.')
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

    // ==== Anti-fakeGPS: deteksi koordinat identik berulang (Task 33, disempurnakan Task 42) ====
    // GPS asli selalu "goyah" — koordinat persis sama (≈1 cm) untuk beberapa
    // santri berbeda pada satu sesi hampir pasti hasil mock/tools.
    // PENYEMPURNAAN Task 42: duplikat koordinat dihitung hanya lintas-PERANGKAT
    // (deviceHash berbeda/kosong). Koordinat identik dari perangkat YANG SAMA
    // = 1 HP utk beberapa anak (kasus sah di TPQ) → ditangani jalur
    // DUP_DEVICE + verifikasi ustadz, bukan penolakan keras.
    const rLat = roundCoord(gps.lat)
    const rLng = roundCoord(gps.lng)
    const hash = await computeDeviceHash(req.headers.get('user-agent'), device)
    const sameCoordRows = await db.attendance.findMany({
      where: { sessionId: session.id, lat: rLat, lng: rLng, status: 'HADIR' },
      select: { studentId: true, deviceHash: true },
    })
    // Hitung PERANGKAT unik yang berbeda dari perangkat pengirim (record lama
    // tanpa hash dihitung sebagai satu "perangkat tak dikenal"). Dua record
    // dari 1 HP (wali 2 anak) tetap dihitung SATU perangkat.
    const dupCount = new Set(
      sameCoordRows
        .filter((r) => r.deviceHash !== hash)
        .map((r) => r.deviceHash ?? '__no_device__'),
    ).size

    // ==== Task 42: deteksi PERANGKAT GANDA dalam sesi yang sama ====
    const deviceDup = await db.attendance.findFirst({
      where: {
        sessionId: session.id,
        status: 'HADIR',
        deviceHash: hash,
        NOT: { studentId },
      },
      include: { student: { select: { fullName: true } } },
    })
    if (deviceDup) {
      if (!confirmSharedDevice) {
        // Konfirmasi eksplisit ke wali: 1 HP bisa saja dipakai utk 2 anak —
        // tapi harus disadari & diverifikasi ustadz, bukan diam-diam lolos.
        return NextResponse.json(
          {
            error:
              'Perangkat yang sama baru saja dipakai check-in oleh santri lain di sesi ini.',
            code: 'DUP_DEVICE',
            otherName: deviceDup.student.fullName,
          },
          { status: 409 },
        )
      }
    }

    const flags: Record<string, unknown> = {
      ...evalResult.flags,
      dupCount,
      dup: dupCount >= 2,
    }
    if (deviceDup && confirmSharedDevice) {
      flags.dupDevice = true
      flags.dupDeviceOf = deviceDup.student.fullName
      flags.dupDeviceReviewed = false
    }
    if (dupCount >= 2) {
      return bad(
        'Pola lokasi mencurigakan terdeteksi (koordinat identik dengan check-in perangkat lain). Gunakan GPS asli perangkat Anda sendiri.',
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
        deviceHash: hash,
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
    const sharedDevice = Boolean(deviceDup && confirmSharedDevice)
    if (student.parent) {
      await sendWhatsApp({
        phone: student.parent.phone,
        userId: student.parent.id,
        message: sharedDevice
          ? `Assalamu'alaikum Bpk/Ibu ${student.parent.name}, *${student.fullName}* tercatat HADIR di kelas ${session.class.name} pukul ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} — PERANGKAT BERSAMA (1 HP utk beberapa santri). Menunggu verifikasi ustadz pengampu. — TPQ Darul Jinan`
          : `Assalamu'alaikum Bpk/Ibu ${student.parent.name}, *${student.fullName}* baru saja check-in (QR+GPS) HADIR di kelas ${session.class.name} pukul ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} (±${Math.round(evalResult.distanceM)} m dari titik absen). — TPQ Darul Jinan`,
      })
    }
    return ok({
      success: true,
      sharedDevice,
      distanceM: evalResult.distanceM,
      message: sharedDevice
        ? `Alhamdulillah, ${student.fullName} tercatat HADIR (perangkat bersama). Menunggu verifikasi ustadz pengampu.`
        : `Alhamdulillah, ${student.fullName} tercatat HADIR (±${Math.round(evalResult.distanceM)} m dari titik absen)!`,
    })
  } catch (e) {
    console.error('[checkin] gagal:', e instanceof Error ? `${e.message}\n${e.stack}` : e)
    return bad('Gagal check-in')
  }
}
