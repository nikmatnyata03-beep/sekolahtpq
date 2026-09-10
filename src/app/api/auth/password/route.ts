import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'

/**
 * PUT /api/auth/password
 * Body: { userId, currentPassword, newPassword }
 * - 400 when payload incomplete / newPassword < 6 chars
 * - 404 when user not found
 * - 401 when currentPassword does not match (demo auth stores plaintext)
 * - 200 { success: true } after update
 */
export async function PUT(req: NextRequest) {
  try {
    const { userId, currentPassword, newPassword } = await req.json()
    if (!userId || !currentPassword || !newPassword) return bad('Data tidak lengkap')
    if (String(newPassword).length < 6) return bad('Password baru minimal 6 karakter')
    const user = await db.user.findUnique({ where: { id: String(userId) } })
    if (!user) return bad('Pengguna tidak ditemukan', 404)
    if (user.password !== currentPassword) return bad('Password saat ini salah', 401)
    await db.user.update({ where: { id: user.id }, data: { password: String(newPassword) } })
    return ok({ success: true })
  } catch {
    return bad('Gagal mengubah password')
  }
}
