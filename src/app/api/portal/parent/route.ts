import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'

/** Aggregated data for the parent (wali santri) portal */
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return bad('userId wajib')

  const parent = await db.user.findUnique({ where: { id: userId } })
  if (!parent) return bad('Wali santri tidak ditemukan', 404)

  const students = await db.student.findMany({
    where: { parentId: userId },
    include: {
      class: { select: { id: true, name: true, level: true, schedule: true, teacher: { select: { fullName: true } } } },
      attendances: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { session: { select: { date: true, topic: true, class: { select: { name: true } } } } },
      },
      hafalans: { orderBy: { createdAt: 'desc' }, take: 30 },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  })

  const notifications = await db.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 30 })
  const announcements = await db.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 10 })

  return ok({
    parent: { id: parent.id, name: parent.name, email: parent.email, phone: parent.phone },
    students: students.map((s) => ({
      id: s.id,
      nis: s.nis,
      fullName: s.fullName,
      gender: s.gender,
      className: s.class?.name || 'Belum ada kelas',
      classSchedule: s.class?.schedule || '-',
      teacherName: s.class?.teacher?.fullName || '-',
      attendanceSummary: {
        hadir: s.attendances.filter((a) => a.status === 'HADIR').length,
        izin: s.attendances.filter((a) => a.status === 'IZIN').length,
        sakit: s.attendances.filter((a) => a.status === 'SAKIT').length,
        alpa: s.attendances.filter((a) => a.status === 'ALPA').length,
        total: s.attendances.length,
      },
      attendances: s.attendances.map((a) => ({
        id: a.id,
        status: a.status,
        date: a.session.date,
        topic: a.session.topic,
        className: a.session.class.name,
      })),
      hafalans: s.hafalans,
      payments: s.payments,
      billing: {
        outstanding: s.payments.filter((p) => p.status === 'PENDING').reduce((sum, p) => sum + p.amount, 0),
        pendingCount: s.payments.filter((p) => p.status === 'PENDING').length,
      },
    })),
    notifications,
    announcements,
  })
}
