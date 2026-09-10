import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { hashPassword } from '@/lib/password'
import { guard } from '@/lib/session'

// Seluruh manajemen pengguna = ADMIN saja (data email/HP sensitif).

// Whitelist peran (temuan pentest: role string arbitrer membuat akun rusak)
const VALID_ROLES = ['ADMIN', 'GURU', 'ORANG_TUA', 'DEVELOPER']

/**
 * Task 36 — pastikan akun GURU selalu punya profil Teacher terlink.
 * Tanpa ini, `session.teacherId` null → guru ditolak 403 di semua aksi kelas
 * ("Anda bukan pengampu kelas ini") dan tidak bisa ditugaskan ke mana pun.
 * - body.teacherId diisi → link ke profil guru yang ada (wajib belum terlink akun lain)
 * - kosong → auto-create profil guru minimal dari nama akun
 */
async function ensureTeacherProfile(userId: string, userName: string, teacherId: unknown, phone: unknown) {
  if (teacherId && typeof teacherId === 'string') {
    const existing = await db.teacher.findUnique({ where: { id: teacherId } })
    if (!existing) throw new Error('Profil guru tidak ditemukan')
    const linked = await db.user.findUnique({ where: { teacherId }, select: { id: true } })
    if (linked && linked.id !== userId) throw new Error('Profil guru sudah terlink dengan akun lain')
    await db.user.update({ where: { id: userId }, data: { teacherId } })
    return
  }
  const teacher = await db.teacher.create({
    data: {
      fullName: userName,
      gender: 'L',
      birthPlace: '-',
      birthDate: new Date(),
      address: '-',
      phone: typeof phone === 'string' && phone ? phone : null,
      expertise: '-',
      bio: '-',
      joinDate: new Date(),
    },
  })
  await db.user.update({ where: { id: userId }, data: { teacherId: teacher.id } })
}

export async function GET(req: NextRequest) {
  const g = await guard(req, ['ADMIN'])
  if ('res' in g) return g.res
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, phone: true, role: true, createdAt: true, teacherId: true },
    orderBy: { createdAt: 'desc' },
  })
  return ok(users)
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN'])
    if ('res' in g) return g.res
    const body = await req.json()
    if (!body.name || !body.email || !body.password || !body.role) return bad('Data tidak lengkap')
    if (!VALID_ROLES.includes(String(body.role))) return bad('Peran tidak dikenal')
    if (String(body.password).length < 6) return bad('Password minimal 6 karakter')
    const exists = await db.user.findUnique({ where: { email: String(body.email).toLowerCase() } })
    if (exists) return bad('Email sudah terdaftar')
    const user = await db.user.create({
      data: {
        name: body.name,
        email: String(body.email).toLowerCase(),
        phone: body.phone || null,
        password: hashPassword(String(body.password)),
        role: body.role,
      },
      select: { id: true, email: true, name: true, phone: true, role: true },
    })
    // Task 36: akun GURU wajib punya profil guru agar bisa ditugaskan kelas
    if (body.role === 'GURU') {
      try {
        await ensureTeacherProfile(user.id, body.name, body.teacherId, body.phone)
      } catch (e) {
        // rollback akun agar admin tidak perlu membersihkan manual
        await db.user.delete({ where: { id: user.id } })
        return bad(e instanceof Error ? e.message : 'Gagal menautkan profil guru')
      }
    }
    return ok(user)
  } catch {
    return bad('Gagal membuat pengguna')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN'])
    if ('res' in g) return g.res
    const body = await req.json()
    if (!body.id) return bad('ID wajib')
    const data: Record<string, string> = {}
    if (body.name) data.name = body.name
    if (body.phone !== undefined) data.phone = body.phone
    if (body.role) {
      if (!VALID_ROLES.includes(String(body.role))) return bad('Peran tidak dikenal')
      data.role = body.role
    }
    if (body.password) {
      if (String(body.password).length < 6) return bad('Password minimal 6 karakter')
      data.password = hashPassword(String(body.password))
    }
    const user = await db.user.update({ where: { id: body.id }, data, select: { id: true, email: true, name: true, phone: true, role: true, teacherId: true } })
    // Task 36: bila akun dinaikkan menjadi GURU tanpa profil guru → buatkan otomatis
    if (user.role === 'GURU' && !user.teacherId) {
      try {
        await ensureTeacherProfile(user.id, user.name, body.teacherId, user.phone)
      } catch (e) {
        return bad(e instanceof Error ? e.message : 'Gagal menautkan profil guru')
      }
    }
    return ok(user)
  } catch {
    return bad('Gagal memperbarui pengguna')
  }
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, ['ADMIN'])
  if ('res' in g) return g.res
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return bad('ID wajib')
  const adminCount = await db.user.count({ where: { role: 'ADMIN' } })
  const target = await db.user.findUnique({ where: { id } })
  if (target?.role === 'ADMIN' && adminCount <= 1) return bad('Minimal harus ada satu admin')
  await db.user.delete({ where: { id } })
  return ok({ success: true })
}
