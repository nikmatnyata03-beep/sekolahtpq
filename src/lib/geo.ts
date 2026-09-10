// ============================================================
// Geolokasi & heuristik anti-fakeGPS (Task 33)
// ============================================================
// Kebijakan absensi QR TPQ Darul Jinan:
//  - HADIR hanya sah via check-in QR dengan GPS perangkat santri/wali,
//    maksimal 20 meter dari titik GPS tempat ustadz membuat QR (anchor sesi).
//  - IZIN/SAKIT wajib foto surat (bukti) dengan timestamp + GPS yang
//    dicap (watermark) pada foto oleh kamera, plus metadata di database.
//  - ALPA boleh dicatat manual ustadz (bukan klaim kehadiran).
//
// Browser tidak menyediakan flag "lokasi mock" (berbeda dgn Android
// MOCK_LOCATION), sehingga anti-fakeGPS di web berbasis HEURISTIK
// server-side yang sulit dipalsukan sekaligus:
//   1. Freshness  — timestamp posisi ≤ 3 menit (posisi cache/statis ditolak)
//   2. Presisi    — accuracy ≤ ambang (GPS indoors/spoof sering akurasi buruk)
//   3. Sanity     — koordinat valid, bukan nol/pola bulat mencurigakan
//   4. Duplikasi  — koordinat identik (6 desimal ≈ 11 cm) berulang ≥ 3x pada
//                   satu sesi hampir mustahil dgn GPS asli (tiap bacaan goyah)
//   5. Jarak      — haversine ≤ 20 m dari anchor sesi (dihitung SERVER,
//                   bukan klien, sehingga tidak bisa dibohongi)
// Semua metrik disimpan (lat/lng/accuracy/gpsAt/distanceM/gpsFlags) untuk audit.

export const MAX_CHECKIN_DISTANCE_M = 20
export const MAX_CHECKIN_ACCURACY_M = 100
export const MAX_SESSION_ACCURACY_M = 150
export const MAX_POS_AGE_MS = 3 * 60 * 1000

export interface GpsInput {
  lat: number
  lng: number
  accuracy?: number | null
  posTs?: number | string | null // epoch millis / ISO — waktu posisi diambil klien
}

/** Jarak great-circle dua titik (meter) — formula haversine, radius bumi 6371 km. */
export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Normalisasi + sanity dasar koordinat dari body request. null = tidak valid. */
export function parseGps(raw: unknown): GpsInput | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>
  const lat = typeof b.lat === 'number' ? b.lat : Number(b.lat)
  const lng = typeof b.lng === 'number' ? b.lng : Number(b.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  // Nol persis di tengah lautan + pola bulat kasar = klasik mock/devtools
  if (lat === 0 && lng === 0) return null
  const accuracy = typeof b.accuracy === 'number' ? b.accuracy : Number(b.accuracy) || null
  const posTs =
    typeof b.posTs === 'number'
      ? b.posTs
      : typeof b.posTs === 'string' && b.posTs
        ? Number(b.posTs) || Date.parse(b.posTs) || null
        : null
  return { lat, lng, accuracy, posTs }
}

/**
 * Validasi kualitas sinyal GPS (berlaku untuk check-in santri maupun
 * titik anchor ustadz & foto bukti). Return pesan error Indonesia atau null.
 */
export function validateGpsQuality(
  g: GpsInput,
  opts: { maxAccuracy: number; requireFresh?: boolean },
): string | null {
  if (Math.abs(g.lat) < 0.0005 && Math.abs(g.lng) < 0.0005) {
    return 'Koordinat GPS tidak valid (0,0). Nyalakan layanan lokasi lalu coba lagi.'
  }
  if (g.accuracy !== null && g.accuracy !== undefined) {
    if (!Number.isFinite(g.accuracy) || g.accuracy < 0) {
      return 'Data akurasi GPS tidak valid. Coba ambil lokasi lagi.'
    }
    if (g.accuracy > opts.maxAccuracy) {
      return `Sinyal GPS kurang presisi (±${Math.round(g.accuracy)} m, maks ±${opts.maxAccuracy} m). Mendekatlah ke area terbuka/jendela lalu coba lagi.`
    }
  }
  if (opts.requireFresh && g.posTs) {
    const ts = typeof g.posTs === 'number' ? g.posTs : Date.parse(String(g.posTs))
    if (Number.isFinite(ts)) {
      const age = Math.abs(Date.now() - ts)
      if (age > MAX_POS_AGE_MS) {
        return 'Posisi GPS sudah kedaluwarsa (lebih dari 3 menit). Ambil lokasi ulang lalu coba lagi.'
      }
    }
  }
  return null
}

/** Koordinat dibulatkan 6 desimal (~11 cm) — kunci deteksi duplikasi. */
function key6(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`
}

export { key6 as coordKey }

/**
 * Hitung hasil validasi check-in terhadap anchor sesi.
 * Return flags (JSON-able) — `ok` false disertai `reason` utk pesan user.
 */
export function evaluateCheckinGps(
  g: GpsInput,
  anchor: { lat: number; lng: number },
): { ok: boolean; distanceM: number; reason?: string; flags: Record<string, unknown> } {
  const distanceM = Math.round(haversineM(g.lat, g.lng, anchor.lat, anchor.lng) * 10) / 10
  const flags: Record<string, unknown> = {
    distanceM,
    accuracy: g.accuracy ?? null,
    posTs: typeof g.posTs === 'number' ? g.posTs : g.posTs ? String(g.posTs) : null,
    within: distanceM <= MAX_CHECKIN_DISTANCE_M,
  }
  if (distanceM > MAX_CHECKIN_DISTANCE_M) {
    return {
      ok: false,
      distanceM,
      reason: `Anda berada ±${Math.round(distanceM)} m dari titik absen (maksimal ${MAX_CHECKIN_DISTANCE_M} m). Dekati kelas/ustadz Anda, lalu check-in lagi.`,
      flags,
    }
  }
  return { ok: true, distanceM, flags }
}

/** Presisi koordinat utk disimpan (7 desimal ≈ 1 cm). */
export function roundCoord(n: number): number {
  return Math.round(n * 10_000_000) / 10_000_000
}
