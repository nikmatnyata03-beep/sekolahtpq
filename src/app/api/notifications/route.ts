import { NextRequest } from 'next/server'
import { db, ok, bad, sendWhatsApp } from '@/lib/api'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  const notifications = await db.notification.findMany({
    where: userId ? { userId } : {},
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  return ok(notifications)
}

export async function POST(req: NextRequest) {
  try {
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
