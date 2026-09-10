/**
 * Helper zona waktu WIB (UTC+7) — dipakai bersama oleh kode Next.js DAN
 * Durable Object (presensi live), sehingga "hari ini" konsisten di semua runtime.
 */

/** Kunci tanggal WIB untuk sebuah instant, mis. "2025-06-15". */
export function wibDateKey(d: Date = new Date()): string {
  return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
}

/** Awal hari WIB (instant) untuk kueri "sejak tengah malam WIB". */
export function wibDayStart(d: Date = new Date()): Date {
  return new Date(`${wibDateKey(d)}T00:00:00+07:00`)
}

/** Jam:menit:detik WIB — untuk tampilan feed real-time. */
export function wibTime(d: Date = new Date()): string {
  return new Date(d.getTime() + 7 * 3600 * 1000).toISOString().slice(11, 19)
}
