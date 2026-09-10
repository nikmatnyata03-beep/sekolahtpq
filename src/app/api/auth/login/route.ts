import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) return bad('Email dan password wajib diisi')
    const user = await db.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      include: { teacherProfile: { select: { id: true, fullName: true } } },
    })
    if (!user || user.password !== password) return bad('Email atau password salah', 401)
    return ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        teacherId: user.teacherId ?? null,
      },
    })
  } catch {
    return bad('Permintaan tidak valid', 400)
  }
}
