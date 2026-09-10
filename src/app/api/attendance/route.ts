import { NextRequest } from 'next/server'
import { db, ok, bad, sendWhatsApp } from '@/lib/api'
import { guard } from '@/lib/session'

export async function GET(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'GURU', 'ORANG_TUA'])
  if ('res' in g) return g.res
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  const classId = req.nextUrl.searchParams.get('classId')
  const studentId = req.nextUrl.searchParams.get('studentId')
  const records = await db.attendance.findMany({
    where: {
      ...(sessionId && { sessionId }),
      ...(studentId && { studentId }),
      ...(classId && { student: { classId } }),
    },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      session: { select: { id: true, date: true, topic: true, class: { select: { name: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return ok(records.map((r) => ({ ...r, className: r.session.class.name, session: undefined })))
}

// Bulk mark attendance for a session (teacher/admin)
export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'GURU'])
    if ('res' in g) return g.res
    const { sessionId, records } = await req.json()
    if (!sessionId || !Array.isArray(records)) return bad('Data absensi tidak valid')
    const session = await db.session.findUnique({ where: { id: sessionId }, include: { class: true } })
    if (!session) return bad('Sesi tidak ditemukan')

    for (const r of records) {
      if (!r.studentId) continue
      await db.attendance.upsert({
        where: { sessionId_studentId: { sessionId, studentId: r.studentId } },
        update: { status: r.status || 'HADIR', note: r.note || null },
        create: { sessionId, studentId: r.studentId, status: r.status || 'HADIR', note: r.note || null },
      })
      // WhatsApp notification to parent (per blueprint: hadir/ketidakhadiran)
      const student = await db.student.findUnique({ where: { id: r.studentId }, include: { parent: true } })
      if (student?.parent && r.status !== 'HADIR') {
        const label = { IZIN: 'IZIN', SAKIT: 'SAKIT', ALPA: 'TIDAK HADIR (ALPA)' }[r.status] || r.status
        await sendWhatsApp({
          phone: student.parent.phone,
          userId: student.parent.id,
          message: `Assalamu'alaikum Bpk/Ibu ${student.parent.name}, putra/i Anda *${student.fullName}* tercatat *${label}* pada kelas ${session.class.name} (${session.date.toLocaleDateString('id-ID')}). Mohon konfirmasi. — TPQ Darul Jinan`,
        })
      } else if (student?.parent && r.status === 'HADIR') {
        await sendWhatsApp({
          phone: student.parent.phone,
          userId: student.parent.id,
          message: `Assalamu'alaikum Bpk/Ibu ${student.parent.name}, putra/i Anda *${student.fullName}* HADIR di kelas ${session.class.name} hari ini. — TPQ Darul Jinan`,
        })
      }
    }
    const attendances = await db.attendance.findMany({ where: { sessionId } })
    return ok({ success: true, count: attendances.length })
  } catch {
    return bad('Gagal menyimpan absensi')
  }
}
