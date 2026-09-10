import { NextRequest, NextResponse } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { verifyPassword } from '@/lib/password'
import { createSessionToken, sessionCookieHeader, isSecureRequest, type SessionUser } from '@/lib/session'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null
    if (!body) return bad('Permintaan tidak valid', 400)

    // Rate limit: maks 8 percobaan / 10 menit per email+IP (percepat brute force = gagal).
    const ip = clientIp(req)
    const key = `login:${String(body.email || '').toLowerCase().slice(0, 120)}|${ip}`
    if (!rateLimit(key, 8, 10 * 60 * 1000)) {
      return bad('Terlalu banyak percobaan login. Coba lagi dalam 10 menit.', 429)
    }

    const { email, password } = body
    if (!email || !password) return bad('Email dan password wajib diisi')
    const user = await db.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      include: { teacherProfile: { select: { id: true, fullName: true } } },
    })
    const valid = user ? await verifyPassword(String(password), user.password) : false
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
