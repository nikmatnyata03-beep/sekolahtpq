import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { hashPassword } from '@/lib/password'
import { getSession, guard } from '@/lib/session'

function parseJsonField(v: unknown, fallback = '[]') {
  if (typeof v === 'string') return v
  return JSON.stringify(v ?? [])
}

/**
 * Sinkronisasi penugasan kelas seorang guru (Task 36).
 * - Kelas yang sebelumnya diampu guru ini tapi tidak ada di classIds → teacherId null.
 * - Kelas di classIds → teacherId = guru ini (menimpa pengampu lama secara eksplisit).
 * ID yang tidak dikenal diabaikan agar payload bocor tidak merusak data.
 */
async function syncTeacherClasses(teacherId: string, classIds: unknown) {
  if (!Array.isArray(classIds)) return
  const wanted = [...new Set(classIds.filter((v): v is string => typeof v === 'string' && v.trim() !== ''))]
  const valid = wanted.length
    ? await db.class.findMany({ where: { id: { in: wanted } }, select: { id: true } })
    : []
  const validIds = new Set(valid.map((c) => c.id))
  const current = await db.class.findMany({ where: { teacherId }, select: { id: true } })
  const toRemove = current.filter((c) => !validIds.has(c.id)).map((c) => c.id)
  await db.$transaction([
    ...(toRemove.length ? [db.class.updateMany({ where: { id: { in: toRemove } }, data: { teacherId: null } })] : []),
    ...(validIds.size ? [db.class.updateMany({ where: { id: { in: [...validIds] } }, data: { teacherId } })] : []),
  ])
}

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  const canViewPrivateData = session?.role === 'ADMIN' || session?.role === 'DEVELOPER'
  const teachers = canViewPrivateData
    ? await db.teacher.findMany({
        // sertakan akun login terlink (Task 36) agar UI Penugasan tahu guru mana yang sudah punya akun
        include: {
          classes: { select: { id: true, name: true } },
          _count: { select: { materials: true, posts: true } },
          user: { select: { id: true, email: true } },
        },
        orderBy: { joinDate: 'asc' },
      })
    : await db.teacher.findMany({
        where: { isActive: true },
        select: {
          id: true,
          fullName: true,
          gender: true,
          photoUrl: true,
          formalEducation: true,
          nonFormalEducation: true,
          certifications: true,
          expertise: true,
          philosophy: true,
          bio: true,
          joinDate: true,
          classes: { select: { id: true, name: true } },
        },
        orderBy: { joinDate: 'asc' },
      })
  return ok(teachers)
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.fullName || !b.birthDate || !b.gender) return bad('Data tidak lengkap')
    const teacher = await db.teacher.create({
      data: {
        fullName: b.fullName,
        gender: b.gender,
        birthPlace: b.birthPlace || '-',
        birthDate: new Date(b.birthDate),
        address: b.address || '-',
        phone: b.phone || null,
        photoUrl: b.photoUrl || null,
        formalEducation: parseJsonField(b.formalEducation),
        nonFormalEducation: parseJsonField(b.nonFormalEducation),
        certifications: parseJsonField(b.certifications),
        expertise: b.expertise || '-',
        philosophy: b.philosophy || null,
        bio: b.bio || '-',
        joinDate: b.joinDate ? new Date(b.joinDate) : new Date(),
      },
    })
    // Task 36: penugasan kelas saat pembuatan — classIds: string[]
    await syncTeacherClasses(teacher.id, b.classIds)
    // optionally create login account
    if (b.email && b.password) {
      const exists = await db.user.findUnique({ where: { email: String(b.email).toLowerCase() } })
      if (!exists) {
        await db.user.create({
          data: { email: String(b.email).toLowerCase(), name: b.fullName, phone: b.phone || null, password: hashPassword(String(b.password)), role: 'GURU', teacherId: teacher.id },
        })
      }
    }
    return ok(teacher)
  } catch {
    return bad('Gagal menambahkan guru')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.id) return bad('ID wajib')
    const teacher = await db.teacher.update({
      where: { id: b.id },
      data: {
        ...(b.fullName && { fullName: b.fullName }),
        ...(b.gender && { gender: b.gender }),
        ...(b.birthPlace && { birthPlace: b.birthPlace }),
        ...(b.birthDate && { birthDate: new Date(b.birthDate) }),
        ...(b.address && { address: b.address }),
        ...(b.phone !== undefined && { phone: b.phone }),
        ...(b.photoUrl !== undefined && { photoUrl: b.photoUrl || null }),
        ...(b.formalEducation !== undefined && { formalEducation: parseJsonField(b.formalEducation) }),
        ...(b.nonFormalEducation !== undefined && { nonFormalEducation: parseJsonField(b.nonFormalEducation) }),
        ...(b.certifications !== undefined && { certifications: parseJsonField(b.certifications) }),
        ...(b.expertise && { expertise: b.expertise }),
        ...(b.philosophy !== undefined && { philosophy: b.philosophy }),
        ...(b.bio && { bio: b.bio }),
        ...(b.isActive !== undefined && { isActive: b.isActive }),
      },
    })
    // Task 36: sinkronisasi kelas yang diampu saat edit
    await syncTeacherClasses(teacher.id, b.classIds)
    return ok(teacher)
  } catch {
    return bad('Gagal memperbarui guru')
  }
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, ['ADMIN'])
  if ('res' in g) return g.res
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return bad('ID wajib')
  const usedByClass = await db.class.count({ where: { teacherId: id } })
  if (usedByClass > 0) return bad('Guru masih menjadi pengampu kelas. Pindahkan kelas terlebih dahulu.')
  await db.teacher.delete({ where: { id } })
  return ok({ success: true })
}
