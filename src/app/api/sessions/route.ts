import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard, getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  // Daftar sesi dipakai halaman cek-in publik -> tetap terbuka, NAMAI kode
  // kerahasiaan QR hanya dikirim ke admin/guru (publik tak boleh lihat kode).
  const session = await getSession(req)
  const staff = session?.role === 'ADMIN' || session?.role === 'GURU'
  const active = req.nextUrl.searchParams.get('active')
  const classId = req.nextUrl.searchParams.get('classId')
  const sessions = await db.session.findMany({
    where: {
      ...(active === '1' && { isActive: true }),
      ...(classId && { classId }),
    },
    include: {
      class: { select: { id: true, name: true, level: true } },
      attendances: { select: { status: true, studentId: true } },
    },
    orderBy: { date: 'desc' },
    take: 50,
  })
  return ok(
    sessions.map((s) => ({
      id: s.id,
      classId: s.classId,
      className: s.class.name,
      classLevel: s.class.level,
      date: s.date,
      topic: s.topic,
      code: staff ? s.code : undefined,
      isActive: s.isActive,
      total: s.attendances.length,
      hadir: s.attendances.filter((a) => a.status === 'HADIR').length,
    }))
  )
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'GURU'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.classId) return bad('Kelas wajib dipilih')
    const cls = await db.class.findUnique({ where: { id: b.classId } })
    if (!cls) return bad('Kelas tidak ditemukan')
    if (g.session.role === 'GURU' && cls.teacherId !== g.session.teacherId) {
      return bad('Anda bukan pengampu kelas ini', 403)
    }
    // close previous active sessions of this class
    await db.session.updateMany({ where: { classId: b.classId, isActive: true }, data: { isActive: false } })
    const code = `DJ-${cls.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const session = await db.session.create({
      data: {
        classId: b.classId,
        topic: b.topic || null,
        date: b.date ? new Date(b.date) : new Date(),
        code,
        isActive: true,
      },
    })
    return ok(session)
  } catch {
    return bad('Gagal membuat sesi')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'GURU'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.id) return bad('ID wajib')
    const existing = await db.session.findUnique({ where: { id: b.id }, include: { class: true } })
    if (!existing) return bad('Sesi tidak ditemukan', 404)
    if (g.session.role === 'GURU' && existing.class.teacherId !== g.session.teacherId) {
      return bad('Anda bukan pengampu kelas sesi ini', 403)
    }
    const session = await db.session.update({ where: { id: b.id }, data: { isActive: !!b.isActive } })
    return ok(session)
  } catch {
    return bad('Gagal memperbarui sesi')
  }
}
