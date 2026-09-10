import { NextRequest, NextResponse } from 'next/server'
import { db, bad } from '@/lib/api'
import { verifyPassword } from '@/lib/password'
import { createSessionToken, sessionCookieHeader, isSecureRequest, type SessionUser } from '@/lib/session'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { verifyTurnstileToken } from '@/lib/turnstile-server'

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
    if (!(await verifyTurnstileToken(body.turnstileToken, ip))) return bad('Verifikasi keamanan gagal. Silakan coba lagi.', 403)
    const user = await db.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      include: { teacherProfile: { select: { id: true, fullName: true } } },
    })
    const valid = user ? await verifyPassword(String(password), user.password) : false
    if (!user || !valid) return bad('Email atau password salah', 401)

    // Sesi httpOnly â sumber kebenaran otorisasi di sisi server.
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
