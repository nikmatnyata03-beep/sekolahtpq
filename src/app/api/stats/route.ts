import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/api'
import { guard } from '@/lib/session'
import { ensureAttendanceSchema } from '@/lib/attendance-schema'

export async function GET(req: NextRequest) {
  await ensureAttendanceSchema()
  const g = await guard(req, ['ADMIN'])
  if ('res' in g) return g.res
  const [students, teachers, classes, registrationsPending, payments, todayAttendances, activeSessions, hafalan, materials] =
    await Promise.all([
      db.student.count({ where: { status: 'AKTIF' } }),
      db.teacher.count({ where: { isActive: true } }),
      db.class.count({ where: { isActive: true } }),
      db.registration.count({ where: { status: 'PENDING' } }),
      db.payment.findMany(),
      db.attendance.findMany({
        where: { session: { date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } },
        include: { student: { select: { classId: true } } },
      }),
      db.session.findMany({ where: { isActive: true }, include: { class: { select: { name: true } } } }),
      db.hafalan.count(),
      db.material.count(),
    ])

  const paid = payments.filter((p) => p.status === 'SUCCESS')
  const pending = payments.filter((p) => p.status === 'PENDING')
  const revenue = paid.reduce((s, p) => s + p.amount, 0)
  const outstanding = pending.reduce((s, p) => s + p.amount, 0)

  // attendance today breakdown
  const attendanceToday = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPA: 0 }
  const attendanceByClassMap: Record<string, { name: string; HADIR: number; TOTAL: number }> = {}
  for (const a of todayAttendances) {
    attendanceToday[a.status as keyof typeof attendanceToday] = (attendanceToday[a.status as keyof typeof attendanceToday] || 0) + 1
  }

  // weekly attendance trend (last 7 days sessions)
  const sessions = await db.session.findMany({
    orderBy: { date: 'desc' },
    take: 14,
    include: { attendances: { select: { status: true } }, class: { select: { name: true } } },
  })
  const trendMap: Record<string, { date: string; hadir: number; total: number }> = {}
  for (const s of [...sessions].reverse()) {
    const key = s.date.toISOString().slice(0, 10)
    if (!trendMap[key]) trendMap[key] = { date: key, hadir: 0, total: 0 }
    trendMap[key].total += s.attendances.length
    trendMap[key].hadir += s.attendances.filter((a) => a.status === 'HADIR').length
  }

  const recentRegistrations = await db.registration.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })
  const recentNotifications = await db.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 6 })
  const recentPayments = await db.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { student: { select: { fullName: true } } } })
  const recentHafalan = await db.hafalan.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { student: { select: { fullName: true } } },
  })

  const totalToday = todayAttendances.length
  return NextResponse.json({
    students,
    teachers,
    classes,
    registrationsPending,
    hafalanCount: hafalan,
    materialCount: materials,
    revenue,
    outstanding,
    pendingCount: pending.length,
    successCount: paid.length,
    attendanceToday,
    attendanceRate: totalToday ? Math.round(((attendanceToday.HADIR || 0) / totalToday) * 100) : 0,
    activeSessions: activeSessions.map((s) => ({ id: s.id, code: s.code, className: s.class.name, topic: s.topic, date: s.date })),
    attendanceTrend: Object.values(trendMap).map((t) => ({ ...t, rate: t.total ? Math.round((t.hadir / t.total) * 100) : 0 })),
    recentRegistrations,
    recentNotifications,
    recentPayments: recentPayments.map((p) => ({ ...p, studentName: p.student.fullName })),
    recentHafalan: recentHafalan.map((h) => ({ ...h, studentName: h.student.fullName })),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
