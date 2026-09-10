import type { NextRequest } from 'next/server'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionTokenWithSecret,
  verifySessionTokenWithSecret,
  type SessionRole,
  type SessionUser,
} from './session-core'

/**
 * Sesi login berbasis cookie httpOnly bertanda-tangan HMAC-SHA256.
 * Logika inti pindah ke session-core.ts (tanpa next/server) agar juga bisa
 * dipakai dari Durable Object (panel presensi live). Berkas ini adalah
 * lapisan kompatibilitas untuk route Next.js.
 *
 * Variabel lingkungan:
 * - SESSION_SECRET (wajib; wrangler secret). Tidak ada fallback agar token
 *   tidak dapat dipalsukan ketika konfigurasi deployment keliru.
 */

export { SESSION_COOKIE, SESSION_MAX_AGE }
export type { SessionUser, SessionRole }

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET wajib dikonfigurasi dan minimal 32 karakter')
  }
  return secret
}

/** Buat token sesi bertanda-tangan untuk user (kadaluarsa 7 hari). */
export async function createSessionToken(user: SessionUser): Promise<string> {
  return createSessionTokenWithSecret(user, getSecret())
}

/** Verifikasi token — null jika tidak valid/kadaluarsa/tanda-tangan palsu. */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  try {
    return await verifySessionTokenWithSecret(token, getSecret())
  } catch {
    return null
  }
}

/** Baca sesi dari cookie request. */
export async function getSession(req: NextRequest): Promise<SessionUser | null> {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value)
}

/**
 * Guard route: kembalikan sesi jika lolos, atau `Response` 401/403 siap-kirim.
 * Pemakaian: `const g = await guard(req, ['ADMIN']); if ('res' in g) return g.res;` → g.session aman.
 */
export async function guard(
  req: NextRequest,
  roles?: Array<SessionUser['role']>,
): Promise<{ session: SessionUser } | { res: Response }> {
  const session = await getSession(req)
  if (!session) {
    return {
      res: new Response(JSON.stringify({ error: 'Harus login untuk aksi ini' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    }
  }
  if (roles && roles.length > 0 && !roles.includes(session.role)) {
    return {
      res: new Response(JSON.stringify({ error: 'Peran Anda tidak diizinkan untuk aksi ini' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    }
  }
  return { session }
}

/** Bangun header Set-Cookie untuk login (httpOnly, SameSite=Lax, Secure bila https). */
export function sessionCookieHeader(token: string, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

/** Header Set-Cookie untuk logout (hapus cookie). */
export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

/** Deteksi https dari request (mendukung proxy/gateway). */
export function isSecureRequest(req: NextRequest): boolean {
  const proto = req.headers.get('x-forwarded-proto')
  if (proto) return proto.split(',')[0].trim() === 'https'
  return req.nextUrl.protocol === 'https:'
}
