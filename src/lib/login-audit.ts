// Audit login persisten di D1 — pelajaran Pentest 2026-09-12 (Temuan P-01).
//
// Rate limiter memori (rate-limit.ts) hidup per-isolate Cloudflare Workers:
// setiap isolate punya bucket sendiri, sehingga brute force terdistribusi
// (rotasi koneksi/proxy) dapat menghindarinya. Lapisan ini menyimpan SEMUA
// percobaan login (sukses & gagal) ke D1 sehingga penguncian berlaku GLOBAL
// untuk semua isolate.
//
// Pola bootstrap idempoten (CREATE TABLE IF NOT EXISTS) — sama dengan
// kantor/bootstrap.ts & attendance-schema.ts, karena deploy GitHub hanya
// men-deploy kode, bukan migrasi skema D1.

import { db } from '@/lib/db'

const g = globalThis as { __simadjiLoginAuditReady?: Promise<void> }

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "LoginAudit" ("id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL, "ip" TEXT NOT NULL, "ok" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "LoginAudit_email_createdAt_idx" ON "LoginAudit"("email", "createdAt")`,
]

async function bootstrap(): Promise<void> {
  for (const stmt of STATEMENTS) {
    await db.$executeRawUnsafe(stmt)
  }
}

/** Idempoten — dipanggil di awal setiap request login. */
export function ensureLoginAuditSchema(): Promise<void> {
  g.__simadjiLoginAuditReady ??= bootstrap()
  return g.__simadjiLoginAuditReady
}

/** Catat satu percobaan login (ok = berhasil). Gagal mencatat TIDAK boleh membuat login gagal. */
export async function recordLoginAttempt(email: string, ip: string, ok: boolean): Promise<void> {
  try {
    await ensureLoginAuditSchema()
    const id = `la_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    await db.$executeRawUnsafe(
      `INSERT INTO "LoginAudit" ("id", "email", "ip", "ok") VALUES (?, ?, ?, ?)`,
      id,
      email.slice(0, 160),
      ip.slice(0, 64),
      ok ? 1 : 0,
    )
  } catch (e) {
    console.error('[login-audit] gagal mencatat percobaan login', e)
  }
}

/**
 * true = email terkunci karena terlalu banyak gagal (global lintas isolate).
 * Default: 10 kegagalan dalam 15 menit → kunci 15 menit (cukup menghentikan
 * dictionary attack, tidak mengganggu pengguna asli yang salah ketik).
 */
export async function isLoginLocked(
  email: string,
  maxFail = 10,
  windowMin = 15,
): Promise<boolean> {
  try {
    await ensureLoginAuditSchema()
    const rows = await db.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*) as n FROM "LoginAudit"
       WHERE "email" = ? AND "ok" = 0
         AND "createdAt" > datetime('now', ?)`,
      email.slice(0, 160),
      `-${windowMin} minutes`,
    )
    return Number(rows?.[0]?.n ?? 0) >= maxFail
  } catch (e) {
    console.error('[login-audit] gagal membaca lockout', e)
    return false // fail-open: jangan kunci semua orang karena error audit
  }
}

/** Housekeeping: buang baris >60 hari (dipanggil dari cron harian). */
export async function pruneLoginAudit(): Promise<number> {
  try {
    await ensureLoginAuditSchema()
    return await db.$executeRawUnsafe(
      `DELETE FROM "LoginAudit" WHERE "createdAt" < datetime('now', '-60 days')`,
    )
  } catch {
    return 0
  }
}
