/**
 * Inti sesi tanpa dependensi Next.js — dapat dipakai dari modul mana pun,
 * termasuk Durable Object (`cloudflare:workers`) yang tidak boleh menarik
 * `next/server` ke dalam bundelnya.
 *
 * Token: payload base64url + tanda-tangan HMAC-SHA256 (Web Crypto — kompatibel
 * Node, Bun, dan Cloudflare Workers). Stateless.
 */

export const SESSION_COOKIE = 'simadji_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 hari

export type SessionRole = 'ADMIN' | 'GURU' | 'ORANG_TUA' | 'DEVELOPER'

export type SessionUser = {
  id: string
  role: SessionRole
  name: string
  teacherId?: string | null
}

type SessionPayload = SessionUser & { exp: number }

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

async function hmacKey(secret: string, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usages)
}

/** Buat token sesi bertanda-tangan untuk user (kadaluarsa 7 hari). */
export async function createSessionTokenWithSecret(user: SessionUser, secret: string): Promise<string> {
  const payload: SessionPayload = {
    id: user.id,
    role: user.role,
    name: user.name,
    teacherId: user.teacherId ?? null,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  }
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), encoder.encode(body))
  return `${body}.${toBase64Url(new Uint8Array(sig))}`
}

/** Verifikasi token dengan secret eksplisit — null jika tidak valid/kadaluarsa/palsu. */
export async function verifySessionTokenWithSecret(
  token: string | undefined | null,
  secret: string,
): Promise<SessionUser | null> {
  if (!token || !secret || secret.length < 32) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)

  let expected: Uint8Array
  try {
    expected = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret, ['sign']), encoder.encode(body)))
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
    if (!payload?.id || !payload?.role || !['ADMIN', 'GURU', 'ORANG_TUA', 'DEVELOPER'].includes(payload.role) || typeof payload.exp !== 'number') return null
    if (payload.exp * 1000 < Date.now()) return null
    return { id: payload.id, role: payload.role, name: payload.name, teacherId: payload.teacherId ?? null }
  } catch {
    return null
  }
}

/** Baca nilai satu cookie dari header Cookie mentah (tanpa next/server). */
export function readRawCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim()
  }
  return undefined
}
