import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { verifyPassword, hashPassword } from '@/lib/password'
import { guard } from '@/lib/session'

/**
 * PUT /api/auth/password
 * Body: { userId, currentPassword, newPassword }
 * - 400 when payload incomplete / newPassword < 6 chars
 * - 404 when user not found
 * - 401 when currentPassword does not match
 * - 200 { success: true } after update
 */
export async function PUT(req: NextRequest) {
  try {
    // Wajib sesi: user hanya boleh ubah password miliknya sendiri (ADMIN boleh untuk siapa pun).
    const g = await guard(req)
    if ('res' in g) return g.res
    const { userId, currentPassword, newPassword } = await req.json()
    if (!userId || !currentPassword || !newPassword) return bad('Data tidak lengkap')
    if (String(newPassword).length < 6) return bad('Password baru minimal 6 karakter')
    if (g.session.id !== String(userId) && g.session.role !== 'ADMIN') {
      return bad('Anda hanya boleh mengubah password akun sendiri', 403)
    }
    const user = await db.user.findUnique({ where: { id: String(userId) } })
    if (!user) return bad('Pengguna tidak ditemukan', 404)
    const valid = await verifyPassword(String(currentPassword), user.password)
    if (!valid) return bad('Password saat ini salah', 401)
    await db.user.update({ where: { id: user.id }, data: { password: hashPassword(String(newPassword)) } })
    return ok({ success: true })
  } catch {
    return bad('Gagal mengubah password')
  }
}
