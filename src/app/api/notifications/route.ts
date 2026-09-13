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

/**
 * POST /api/notifications — kirim pesan manual (ADMIN).
 * Nomor dinormalisasi ke 62xxx lalu dikirim via gateway:
 * FONNTE aktif → kirim nyata; OFF → simulasi (log saja).
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.phone || !b.message) return bad('Nomor tujuan dan pesan wajib')
    await sendWhatsApp({
      phone: String(b.phone),
      message: String(b.message),
      userId: b.userId || undefined,
    })
    return ok({ sent: true })
  } catch {
    return bad('Gagal mengirim notifikasi')
  }
}
