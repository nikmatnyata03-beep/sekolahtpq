import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'

/** Return the current user from the signed server-side session cookie. */
export async function GET(req: NextRequest) {
  const g = await guard(req)
  if ('res' in g) return g.res
  const user = await db.user.findUnique({
    where: { id: g.session.id },
    select: { id: true, email: true, name: true, phone: true, role: true, teacherId: true },
  })
  if (!user) return bad('Pengguna tidak ditemukan', 401)
  return ok(user)
}
