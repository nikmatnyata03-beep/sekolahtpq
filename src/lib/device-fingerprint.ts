// Fingerprint ringan perangkat untuk check-in absensi (Task 42).
//
// TUJUAN: mendeteksi 1 perangkat dipakai check-in banyak santri pada sesi yang
// sama (proxy absen / pinjaman HP). BUKAN pengaman absolut — sinyal klien bisa
// diutak-atik — tapi berlapis dengan GPS ≤20 m, rotasi QR, dan heuristik
// koordinat identik, cukup efektif untuk kasus nyata di TPQ.
//
// PRIVASI: sinyal yang dipakai NON-PII dan kasar (dimensi layar, bahasa,
// timezone, jumlah core/RAM, titik sentuh, DPR) — bukan identifier unik
// permanen seperti IDFV/AAID/GAID. Hash dihitung SERVER (SHA-256 dengan UA
// header) sehingga payload mentah tak pernah tersimpan.
//
// Sinyal kosong/tak didukung browser dinormalisasi ke "u" (unknown) agar hash
// tetap stabil antar check-in dari perangkat yang sama.

export interface DeviceSignal {
  /** `${screen.width}x${screen.height}x${screen.colorDepth}` */
  screen?: string
  /** IANA timezone, mis. "Asia/Jakarta" */
  tz?: string
  /** navigator.language, mis. "id-ID" */
  lang?: string
  /** navigator.languages.length (jumlah bahasa) */
  langs?: string
  /** navigator.hardwareConcurrency */
  cores?: string
  /** navigator.deviceMemory (Chrome) — GB */
  mem?: string
  /** navigator.maxTouchPoints */
  touch?: string
  /** window.devicePixelRatio */
  dpr?: string
}

function str(v: unknown): string {
  return v === undefined || v === null || v === '' ? 'u' : String(v)
}

/** Kumpulkan sinyal perangkat dari browser (aman dipanggil di SSR — semua "u"). */
export function collectDeviceSignal(): DeviceSignal {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return {}
  const nav = navigator as Navigator & { deviceMemory?: number }
  return {
    screen:
      typeof screen !== 'undefined' && screen.width
        ? `${screen.width}x${screen.height}x${str(screen.colorDepth)}`
        : undefined,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    lang: nav.language,
    langs: nav.languages ? String(nav.languages.length) : undefined,
    cores: nav.hardwareConcurrency ? String(nav.hardwareConcurrency) : undefined,
    mem: nav.deviceMemory ? String(nav.deviceMemory) : undefined,
    touch: nav.maxTouchPoints ? String(nav.maxTouchPoints) : undefined,
    dpr: window.devicePixelRatio ? String(window.devicePixelRatio) : undefined,
  }
}
