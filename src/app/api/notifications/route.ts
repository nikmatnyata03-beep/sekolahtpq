import { NextRequest } from 'next/server'
import { db, ok, bad, sendWhatsApp } from '@/lib/api'
import { guard } from '@/lib/session'

export async function GET(req: NextRequest) {
  const g = await guard(req)
  if ('res' in g) return g.res
  const requestedUserId = req.nextUrl.searchParams.get('userId')
  const userId = g.session.role === 'ADMIN' ? requestedUserId : g.session.id
  const notifications = await db.notification.findMany({
    where: userId ? { userId } : {},
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return ok(notifications)
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.phone || !b.message) return bad('Nomor tujuan dan pesan wajib')
    const notification = await db.notification.create({
      data: { phone: b.phone, message: b.message, userId: b.userId || undefined },
    })
    return ok(notification)
  } catch {
    return bad('Gagal mengirim notifikasi')
  }
}
