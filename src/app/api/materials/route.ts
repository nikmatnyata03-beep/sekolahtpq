import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'

export async function GET(req: NextRequest) {
  const classId = req.nextUrl.searchParams.get('classId')
  const materials = await db.material.findMany({
    where: classId ? { classId } : {},
    include: {
      teacher: { select: { id: true, fullName: true } },
      class: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return ok(materials)
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'GURU'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.title || !b.url || !b.teacherId) return bad('Judul, tautan file, dan guru pengunggah wajib')
    const material = await db.material.create({
      data: {
        title: b.title,
        type: b.type || 'PDF',
        url: b.url,
        description: b.description || null,
        category: b.category || 'TAJWID',
        classId: b.classId || null,
        teacherId: b.teacherId,
      },
    })
    return ok(material)
  } catch {
    return bad('Gagal mengunggah materi')
  }
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'GURU'])
  if ('res' in g) return g.res
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return bad('ID wajib')
  await db.material.delete({ where: { id } })
  return ok({ success: true })
}
