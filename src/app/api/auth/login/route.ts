import { NextRequest, NextResponse } from 'next/server'
import { db, bad } from '@/lib/api'
import { verifyPassword } from '@/lib/password'
import { createSessionToken, sessionCookieHeader, isSecureRequest, type SessionUser } from '@/lib/session'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile-server'
import { recordLoginAttempt, isLoginLocked } from '@/lib/login-audit'

/** Bandingkan string constant-time (anti timing attack) untuk kunci layanan. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown; turnstileToken?: unknown } | null
    if (!body) return bad('Permintaan tidak valid', 400)

    // Dua bucket mencegah password spraying dengan mengganti-ganti email.
    const ip = clientIp(req)
    const emailKey = `login:email:${String(body.email || '').toLowerCase().slice(0, 120)}|${ip}`
    if (!rateLimit(emailKey, 8, 10 * 60 * 1000) || !rateLimit(`login:ip:${ip}`, 30, 10 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Terlalu banyak percobaan login. Coba lagi dalam 10 menit.' },
        { status: 429, headers: { 'Retry-After': '600' } },
      )
    }

    const { email, password } = body
    if (!email || !password) return bad('Email dan password wajib diisi')

    // Pelajaran Pentest 2026-09-12 (P-01): rate limit memori hanya per-isolate.
    // Lapisan kedua GLOBAL di D1: kunci email setelah 10 kegagalan / 15 menit
    // (tercatat lintas isolate, tahan rotasi koneksi attacker).
    const emailNorm = String(email).toLowerCase().trim()
    if (await isLoginLocked(emailNorm)) {
      return NextResponse.json(
        { error: 'Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.' },
        { status: 429, headers: { 'Retry-After': '900' } },
      )
    }

    // Turnstile wajib untuk login manusia. Pengecualian NARROW: agen layanan
    // (AI Fix Bridge, non-browser) membawa kunci layanan — tanpa itu bot
    // tetap terblokir. Kunci HANYA melewati cek bot, email+password tetap wajib.
    const agentKey = req.headers.get('x-agent-key') ?? undefined
    const expectedAgentKey = process.env.AGENT_API_KEY
    const isServiceAgent =
      typeof expectedAgentKey === 'string' &&
      expectedAgentKey.length >= 32 &&
      typeof agentKey === 'string' &&
      safeEqual(agentKey, expectedAgentKey)
    if (!isServiceAgent && !(await verifyTurnstileToken(body.turnstileToken, ip))) {
      return bad('Verifikasi keamanan gagal. Silakan coba lagi.', 403)
    }
    const user = await db.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      include: { teacherProfile: { select: { id: true, fullName: true } } },
    })
    const valid = user ? await verifyPassword(String(password), user.password) : false
    // Audit GLOBAL (sukses & gagal) — bahan analisis Serangan + basis lockout.
    await recordLoginAttempt(emailNorm, ip, Boolean(user && valid))
    if (!user || !valid) return bad('Email atau password salah', 401)

    // Sesi httpOnly — sumber kebenaran otorisasi di sisi server.
    const sessionUser: SessionUser = {
      id: user.id,
      role: user.role as SessionUser['role'],
      name: user.name,
      teacherId: user.teacherId ?? null,
    }
    const token = await createSessionToken(sessionUser)
    const res = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          teacherId: user.teacherId ?? null,
        },
      },
      { status: 200 },
    )
    res.headers.set('Set-Cookie', sessionCookieHeader(token, isSecureRequest(req)))
    return res
  } catch {
    return bad('Permintaan tidak valid', 400)
  }
}
