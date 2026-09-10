import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'

export async function GET() {
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true, teacherId: true },
    orderBy: { createdAt: 'desc' },
  })
  return ok(users)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.name || !body.email || !body.password || !body.role) return bad('Data tidak lengkap')
    const exists = await db.user.findUnique({ where: { email: String(body.email).toLowerCase() } })
    if (exists) return bad('Email sudah terdaftar')
    const user = await db.user.create({
      data: {
        name: body.name,
        email: String(body.email).toLowerCase(),
        phone: body.phone || null,
        password: body.password,
        role: body.role,
      },
      select: { id: true, email: true, name: true, phone: true, role: true },
    })
    return ok(user)
  } catch {
    return bad('Gagal membuat pengguna')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body.id) return bad('ID wajib')
    const data: Record<string, string> = {}
    if (body.name) data.name = body.name
    if (body.phone !== undefined) data.phone = body.phone
    if (body.role) data.role = body.role
    if (body.password) data.password = body.password
    const user = await db.user.update({ where: { id: body.id }, data, select: { id: true, email: true, name: true, phone: true, role: true } })
    return ok(user)
  } catch {
    return bad('Gagal memperbarui pengguna')
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return bad('ID wajib')
  const adminCount = await db.user.count({ where: { role: 'ADMIN' } })
  const target = await db.user.findUnique({ where: { id } })
  if (target?.role === 'ADMIN' && adminCount <= 1) return bad('Minimal harus ada satu admin')
  await db.user.delete({ where: { id } })
  return ok({ success: true })
}
