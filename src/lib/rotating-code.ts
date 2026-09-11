/**
 * Kode QR absensi berotasi (Task 41) — anti absen palsu via screenshot/foto QR lama.
 *
 * Masalah: kode sesi statis (mis. DJ-IQRA1-6R0G) tetap sah selama sesi aktif.
 * Foto QR yang disebar (WA/screenshot) tetap bisa dipakai jauh di kemudian
 * waktu oleh orang lain yang berada ≤20 m dari titik absen (proxy check-in).
 *
 * Solusi: QR kini memuat `KODE.STATIS.HRF5` — sufiks 5 huruf yang dihitung
 * HMAC dari kode statis + jendela waktu 60 detik. QR di layar ustadz otomatis
 * berganti tiap menit; foto lama kehilangan nilai dalam ≤ 90 detik.
 *
 * - Stateless (tanpa tulis DB per rotasi) — cocok untuk Cloudflare Workers.
 * - Verifikasi menerima jendela saat ini + 1 sebelumnya (toleransi jeda scan).
 * - Kode statis polos TETAP diterima (kompatibilitas: link lama, entry manual,
 *   QR di overview belum berganti) — lapisan GPS ≤20 m tetap penentu utama.
 */

export const ROT_WINDOW_SEC = 60
export const ROT_SUFFIX_LEN = 5

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) throw new Error('SESSION_SECRET wajib dikonfigurasi dan minimal 32 karakter')
  return s
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567' // RFC4648 tanpa 0/1 — aman dibaca keras

function windowIndexAt(timeMs: number): number {
  return Math.floor(timeMs / (ROT_WINDOW_SEC * 1000))
}

/** Sufiks berotasi untuk satu jendela waktu (uppercase, tanpa pemisah). */
async function suffixFor(staticCode: string, winIdx: number): Promise<string> {
  const key = new TextEncoder().encode(secret())
  const msg = new TextEncoder().encode(`${staticCode.toUpperCase()}#${winIdx}`)
  const cryptoObj = globalThis.crypto
  const keyObj = await cryptoObj.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await cryptoObj.subtle.sign('HMAC', keyObj, msg))
  let out = ''
  for (let i = 0; i < ROT_SUFFIX_LEN; i++) out += B32[sig[i] % 32]
  return out
}

/** Kode lengkap yang ditayangkan di QR: `STATIS.SUFIX`. */
export async function rotatingCodeFor(staticCode: string, timeMs: number = Date.now()): Promise<string> {
  const suffix = await suffixFor(staticCode, windowIndexAt(timeMs))
  return `${staticCode.toUpperCase()}.${suffix}`
}

export interface ParsedAttendanceCode {
  /** Kode sesi statis di database (tanpa sufiks). */
  staticCode: string
  /** Sufiks berotasi — null bila input polos (kompatibilitas). */
  rot: string | null
}

/**
 * Pecah input pengguna/QR menjadi bagian statis + sufiks berotasi.
 * Kode statis tidak pernah mengandung titik, sehingga pemisahan aman.
 */
export function parseAttendanceCode(raw: string): ParsedAttendanceCode {
  const input = raw.trim().toUpperCase()
  const dot = input.indexOf('.')
  if (dot <= 0 || dot === input.length - 1) return { staticCode: input, rot: null }
  return { staticCode: input.slice(0, dot), rot: input.slice(dot + 1) }
}

/**
 * Verifikasi sufiks berotasi. Menerima jendela saat ini dan 1 sebelumnya
 * (jeda scan/jaringan). Balikan null = sah; string = pesan penolakan.
 */
export async function verifyRotatingSuffix(rot: string, staticCode: string, timeMs: number = Date.now()): Promise<string | null> {
  if (!/^[A-Z2-7]{5}$/.test(rot)) return 'Format kode QR tidak dikenali. Pindai QR terbaru di layar ustadz.'
  const nowWin = windowIndexAt(timeMs)
  for (const win of [nowWin, nowWin - 1]) {
    const expect = await suffixFor(staticCode, win)
    if (expect === rot) return null
  }
  return 'Kode QR sudah kedaluwarsa (berganti tiap menit). Pindai ulang QR terbaru di layar ustadz.'
}
