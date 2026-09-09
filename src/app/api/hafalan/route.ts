import { NextRequest } from 'next/server'
import { db, ok, bad, sendWhatsApp } from '@/lib/api'

export async function GET(req: NextRequest) {
  const studentId = req.nextUrl.searchParams.get('studentId')
  const hafalans = await db.hafalan.findMany({
    where: studentId ? { studentId } : {},
    include: { student: { select: { id: true, fullName: true, nis: true, class: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return ok(hafalans.map((h) => ({ ...h, student: { ...h.student, className: h.student.class?.name || '-' } })))
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.studentId || !b.surahName || !b.ayatRange) return bad('Santri, surah, dan rentang ayat wajib diisi')
    const hafalan = await db.hafalan.create({
      data: {
        studentId: b.studentId,
        surahName: b.surahName,
        ayatRange: b.ayatRange,
        type: b.type || 'TAHFIDZ',
        grade: b.grade ? Number(b.grade) : null,
        teacherNote: b.teacherNote || null,
      },
      include: { student: { include: { parent: true } } },
    })
    // Notify parent about setoran result (per blueprint: parental involvement)
    if (hafalan.student.parent) {
      await sendWhatsApp({
        phone: hafalan.student.parent.phone,
        userId: hafalan.student.parent.id,
        message: `Alhamdulillah, *${hafalan.student.fullName}* menyelesaikan setoran ${b.type === 'MURAJAAH' ? 'murajaah' : 'hafalan'} *QS ${b.surahName} ${b.ayatRange}*${b.grade ? ` dengan nilai ${b.grade}` : ''}. ${b.teacherNote || ''} — TPQ Darul Jinan`,
      })
    }
    return ok(hafalan)
  } catch {
    return bad('Gagal mencatat hafalan')
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return bad('ID wajib')
  await db.hafalan.delete({ where: { id } })
  return ok({ success: true })
}
