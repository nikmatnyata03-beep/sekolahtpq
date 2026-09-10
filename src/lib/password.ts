import bcrypt from 'bcryptjs'

/**
 * Utilitas password (bcrypt).
 *
 * - bcryptjs = implementasi pure-JS → kompatibel Cloudflare Workers (tanpa
 *   native binary) maupun Node/Bun lokal.
 * - verifyPassword() memiliki fallback: data lama yang masih plaintext
 *   (mis. hasil seed versi awal / ekspor D1 lama) tetap bisa login, lalu
 *   akan ter-rehash otomatis saat user mengganti password.
 */

// Lazy: di Workers process.env baru terisi setelah handler init, jadi rounds
// HARUS dibaca saat dipakai (bukan saat module load).
function rounds(): number {
  return resolveRounds()
}

/**
 * Bcrypt rounds dari environment.
 * - Produksi (Workers Free): vars BCRYPT_ROUNDS=5 di wrangler.jsonc —
 *   batas CPU 10ms/request membuat cost 10+ mustahil dijalankan.
 * - Lokal: tidak diset -> default 10.
 */
function resolveRounds(): number {
  let raw: string | undefined
  try {
    raw = process.env?.BCRYPT_ROUNDS
  } catch {
    raw = undefined
  }
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n >= 4 && n <= 15 ? n : 10
}

/** Cek apakah string berformat bcrypt hash ($2a$/$2b$/$2y$ + 53 karakter). */
export function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value)
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(String(plain), rounds())
}

export async function hashPasswordAsync(plain: string): Promise<string> {
  return bcrypt.hash(String(plain), rounds())
}

/**
 * Verifikasi password input terhadap nilai tersimpan.
 * Mendukung hash bcrypt maupun plaintext legacy (kompatibilitas migrasi).
 */
export async function verifyPassword(input: string, stored: string): Promise<boolean> {
  const plain = String(input)
  const saved = String(stored ?? '')
  if (isBcryptHash(saved)) {
    try {
      return await bcrypt.compare(plain, saved)
    } catch {
      return false
    }
  }
  // Legacy plaintext — gunakan perbandingan konstan-zeit sederhana.
  if (plain.length !== saved.length) return false
  let diff = 0
  for (let i = 0; i < plain.length; i++) diff |= plain.charCodeAt(i) ^ saved.charCodeAt(i)
  return diff === 0
}
