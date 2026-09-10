import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'

export async function PUT(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return bad('ID pengguna wajib')
    await db.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } })
    return ok({ success: true })
  } catch {
    return bad('Gagal menandai notifikasi')
  }
}
