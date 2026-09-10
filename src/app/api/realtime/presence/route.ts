import { NextRequest } from 'next/server'
import { db, ok } from '@/lib/api'
import { guard } from '@/lib/session'
import { wibDayStart } from '@/lib/wib'
import type { PresenceEvent } from '@/durable/presence-hub'
import { ensureAttendanceSchema } from '@/lib/attendance-schema'

/**
 * Snapshot presensi hari ini (WIB) — sumber data mode POLLING ketika
 * WebSocket ke Durable Object tidak tersedia (mis. dev lokal), plus
 * statistik agregat yang juga dikonsumsi panel saat mode LIVE.
 * Guard: ADMIN, GURU, DEVELOPER.
 */
export async function GET(req: NextRequest) {
  await ensureAttendanceSchema()
  const g = await guard(req, ['ADMIN', 'GURU', 'DEVELOPER'])
  if ('res' in g) return g.res

  const start = wibDayStart()
  const [attendances, activeSessions, santriAktif] = await Promise.all([
    db.attendance.findMany({
      where: { createdAt: { gte: start } },
      include: {
        student: { select: { fullName: true } },
        session: { select: { id: true, code: true, class: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    }),
    db.session.findMany({
      where: { isActive: true },
      include: {
        class: { select: { name: true, level: true } },
        attendances: { select: { status: true } },
      },
      orderBy: { date: 'desc' },
      take: 20,
    }),
    db.student.count({ where: { status: 'AKTIF' } }),
  ])

  const events: PresenceEvent[] = attendances.map((a) => ({
    id: a.id,
    type: 'checkin',
    sessionId: a.session.id,
    sessionCode: a.session.code,
    className: a.session.class.name,
    studentId: a.studentId,
    studentName: a.student.fullName,
    status: a.status,
    at: a.createdAt.toISOString(),
  }))

  return ok({
    events,
    activeSessions: activeSessions.map((s) => ({
      id: s.id,
      className: s.class.name,
      level: s.class.level,
      topic: s.topic,
      total: s.attendances.length,
      hadir: s.attendances.filter((x) => x.status === 'HADIR').length,
    })),
    stats: {
      hadir: attendances.filter((a) => a.status === 'HADIR').length,
      tercatat: attendances.length,
      santriAktif,
      sesiAktif: activeSessions.length,
    },
    serverTime: new Date().toISOString(),
  })
}
