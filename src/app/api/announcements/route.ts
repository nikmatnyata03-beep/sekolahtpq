import { NextRequest } from 'next/server'
import { db, ok, bad, sendWhatsApp } from '@/lib/api'

export async function GET() {
  const announcements = await db.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
  return ok(announcements)
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.title || !b.content) return bad('Judul dan isi pengumuman wajib')
    const announcement = await db.announcement.create({
      data: { title: b.title, content: b.content, priority: b.priority || 'NORMAL' },
    })
    // Broadcast WhatsApp to all parents for PENTING announcements (per blueprint push notification)
    if (b.priority === 'PENTING' && b.broadcast) {
      const parents = await db.user.findMany({ where: { role: 'ORANG_TUA', phone: { not: null } } })
      for (const p of parents) {
        await sendWhatsApp({ phone: p.phone, userId: p.id, message: `*${b.title}*\n${b.content}\n— TPQ Darul Jinan` })
      }
    }
    return ok(announcement)
  } catch {
    return bad('Gagal membuat pengumuman')
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return bad('ID wajib')
  await db.announcement.delete({ where: { id } })
  return ok({ success: true })
}
