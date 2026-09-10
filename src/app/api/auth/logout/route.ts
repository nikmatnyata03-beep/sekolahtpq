import { NextResponse } from 'next/server'
import { clearSessionCookieHeader } from '@/lib/session'

/** POST /api/auth/logout — hapus cookie sesi (publik: idempotent). */
export async function POST() {
  const res = NextResponse.json({ success: true }, { status: 200 })
  res.headers.set('Set-Cookie', clearSessionCookieHeader())
  return res
}
