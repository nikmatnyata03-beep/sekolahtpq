import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'

export async function GET(req: NextRequest) {
  // Data santri = data pribadi. Admin melihat semua, guru hanya kelasnya,
  // dan wali hanya anaknya sendiri (perbaikan IDOR — CWE-863).
  const g = await guard(req)
  if ('res' in g) return g.res
  const parentId = req.nextUrl.searchParams.get('parentId')
  const classId = req.nextUrl.searchParams.get('classId')
  const scope = g.session.role === 'ORANG_TUA'
    ? { parentId: g.session.id }
    : g.session.role === 'GURU'
      ? { class: { teacherId: g.session.teacherId ?? '__no_teacher__' } }
      : { ...(parentId && { parentId }), ...(classId && { classId }) }
  const students = await db.student.findMany({
    where: { ...scope, ...(g.session.role === 'ORANG_TUA' ? {} : g.session.role === 'GURU' && classId ? { classId } : {}) },
    include: {
      parent: { select: { id: true, name: true, phone: true, email: true } },
      class: { select: { id: true, name: true, level: true, schedule: true } },
      _count: { select: { hafalans: true, payments: true, attendances: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return ok(students)
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'GURU'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.fullName || !b.gender || !b.birthDate) return bad('Data tidak lengkap')
    let nis = b.nis
    if (!nis) {
      const year = new Date().getFullYear()
      const count = await db.student.count()
      nis = `DJ-${year}-${String(count + 1).padStart(3, '0')}`
    }
    const student = await db.student.create({
      data: {
        nis,
        fullName: b.fullName,
        gender: b.gender,
        birthDate: new Date(b.birthDate),
        address: b.address || '-',
        classId: b.classId || null,
        parentId: b.parentId || null,
        hafalanTarget: b.hafalanTarget || null,
      },
      include: { class: { select: { name: true } }, parent: { select: { name: true, phone: true } } },
    })
    return ok(student)
  } catch (e) {
    console.error(e)
    return bad('Gagal menambahkan santri (NIS mungkin sudah dipakai)')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'GURU'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.id) return bad('ID wajib')
    const student = await db.student.update({
      where: { id: b.id },
      data: {
        ...(b.fullName && { fullName: b.fullName }),
        ...(b.gender && { gender: b.gender }),
        ...(b.birthDate && { birthDate: new Date(b.birthDate) }),
        ...(b.address !== undefined && { address: b.address }),
        ...(b.status && { status: b.status }),
        ...(b.classId !== undefined && { classId: b.classId || null }),
        ...(b.parentId !== undefined && { parentId: b.parentId || null }),
        ...(b.hafalanTarget !== undefined && { hafalanTarget: b.hafalanTarget || null }),
      },
      include: { class: { select: { name: true } }, parent: { select: { name: true, phone: true } } },
    })
    return ok(student)
  } catch {
    return bad('Gagal memperbarui santri')
  }
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, ['ADMIN'])
  if ('res' in g) return g.res
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return bad('ID wajib')
  await db.student.delete({ where: { id } })
  return ok({ success: true })
}
