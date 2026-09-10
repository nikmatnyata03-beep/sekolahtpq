import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'

export async function GET(req: NextRequest) {
  // Temuan pentest F-09: daftar kelas (dgn nama pengampu & jumlah santri)
  // tidak lagi terbuka untuk anonim — hanya pengguna terautentikasi.
  const g = await guard(req)
  if ('res' in g) return g.res
  const classes = await db.class.findMany({
    include: {
      teacher: { select: { id: true, fullName: true } },
      students: { select: { id: true } },
      _count: { select: { sessions: true, materials: true, curricula: true } },
    },
    orderBy: { name: 'asc' },
  })
  return ok(classes.map((c) => ({ ...c, studentCount: c.students.length, students: undefined })))
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.name || !b.level || !b.schedule) return bad('Nama, jenjang, dan jadwal wajib diisi')
    const cls = await db.class.create({
      data: { name: b.name, level: b.level, schedule: b.schedule, room: b.room || null, teacherId: b.teacherId || null },
    })
    return ok(cls)
  } catch {
    return bad('Gagal membuat kelas')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.id) return bad('ID wajib')
    const cls = await db.class.update({
      where: { id: b.id },
      data: {
        ...(b.name && { name: b.name }),
        ...(b.level && { level: b.level }),
        ...(b.schedule && { schedule: b.schedule }),
        ...(b.room !== undefined && { room: b.room }),
        ...(b.teacherId !== undefined && { teacherId: b.teacherId || null }),
        ...(b.isActive !== undefined && { isActive: b.isActive }),
      },
    })
    return ok(cls)
  } catch {
    return bad('Gagal memperbarui kelas')
  }
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, ['ADMIN'])
  if ('res' in g) return g.res
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return bad('ID wajib')
  const studentCount = await db.student.count({ where: { classId: id } })
  if (studentCount > 0) return bad('Kelas masih memiliki santri. Pindahkan santri terlebih dahulu.')
  await db.class.delete({ where: { id } })
  return ok({ success: true })
}
