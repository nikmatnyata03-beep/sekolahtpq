import type { NextRequest } from 'next/server'

/**
 * Sesi login berbasis cookie httpOnly bertanda-tangan HMAC-SHA256.
 *
 * - Web Crypto (crypto.subtle) → kompatibel Node, Bun, DAN Cloudflare Workers.
 * - Payload: { sub, role, name, teacherId, exp } — base64url + signature.
 * - Tidak ada state server → aman untuk runtime serverless/stateless.
 *
 * Variabel lingkungan:
 * - SESSION_SECRET (wajib di produksi; wrangler secret). Nilai fallback khusus
 *   development agar lokal tetap jalan — JANGAN dipakai produksi.
 */

export const SESSION_COOKIE = 'simadji_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 hari

export type SessionUser = {
  id: string
  role: 'ADMIN' | 'GURU' | 'ORANG_TUA' | 'DEVELOPER'
  name: string
  teacherId?: string | null
}

type SessionPayload = SessionUser & { exp: number }

const DEV_FALLBACK_SECRET = 'simadji-dev-secret-jangan-dipakai-produksi'

function getSecret(): string {
  try {
    const s = process.env.SESSION_SECRET
    if (s && s.length >= 16) return s
  } catch {
    /* proses tanpa env — pakai fallback */
  }
  return DEV_FALLBACK_SECRET
}

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacKey(usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(getSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, usages)
}

/** Buat token sesi bertanda-tangan untuk user (kadaluarsa 7 hari). */
export async function createSessionToken(user: SessionUser): Promise<string> {
  const payload: SessionPayload = {
    id: user.id,
    role: user.role,
    name: user.name,
    teacherId: user.teacherId ?? null,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  }
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(['sign']), encoder.encode(body))
  return `${body}.${toBase64Url(new Uint8Array(sig))}`
}

/** Verifikasi token — null jika tidak valid/kadaluarsa/tanda-tangan palsu. */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  let expected: Uint8Array
  try {
    expected = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(['sign']), encoder.encode(body)))
  } catch {
    return null
  }
  const given = (() => {
    try {
      return fromBase64Url(sig)
    } catch {
      return null
    }
  })()
  if (!given || given.length !== expected.length) return null
  // perbandingan constant-time
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ given[i]
  if (diff !== 0) return null

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload
    if (!payload?.id || !payload?.role || typeof payload.exp !== 'number') return null
    if (payload.exp * 1000 < Date.now()) return null
    return { id: payload.id, role: payload.role, name: payload.name, teacherId: payload.teacherId ?? null }
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
