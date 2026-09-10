import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'

function parseJsonField(v: unknown, fallback = '[]') {
  if (typeof v === 'string') return v
  return JSON.stringify(v ?? [])
}

export async function GET() {
  const teachers = await db.teacher.findMany({
    include: { classes: { select: { id: true, name: true } }, _count: { select: { materials: true, posts: true } } },
    orderBy: { joinDate: 'asc' },
  })
  return ok(teachers)
}

export async function POST(req: NextRequest) {
  try {
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
    // optionally create login account
    if (b.email && b.password) {
      const exists = await db.user.findUnique({ where: { email: String(b.email).toLowerCase() } })
      if (!exists) {
        await db.user.create({
          data: { email: String(b.email).toLowerCase(), name: b.fullName, phone: b.phone || null, password: b.password, role: 'GURU', teacherId: teacher.id },
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
    return ok(teacher)
  } catch {
    return bad('Gagal memperbarui guru')
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return bad('ID wajib')
  const usedByClass = await db.class.count({ where: { teacherId: id } })
  if (usedByClass > 0) return bad('Guru masih menjadi pengampu kelas. Pindahkan kelas terlebih dahulu.')
  await db.teacher.delete({ where: { id } })
  return ok({ success: true })
}
