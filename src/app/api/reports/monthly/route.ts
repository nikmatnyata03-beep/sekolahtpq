import type { NextRequest } from 'next/server'
import { db, ok } from '@/lib/api'
import { guard } from '@/lib/session'
import { ensureAttendanceSchema } from '@/lib/attendance-schema'

/**
 * GET /api/reports/monthly?month=YYYY-MM
 *
 * Agregat data operasional TPQ untuk satu bulan (laporan bulanan PDF).
 * Guard: ADMIN saja.
 *
 * Semua perhitungan dilakukan di server agar PDF client-side tinggal
 * merender data yang sudah final (konsisten antara preview UI dan PDF).
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1)) // tanggal 1 bulan berikutnya
  return { start, end }
}

function sum<T>(rows: T[], pick: (row: T) => number): number {
  return rows.reduce((s, r) => s + pick(r), 0)
}

export async function GET(req: NextRequest) {
  await ensureAttendanceSchema()
  const g = await guard(req, ['ADMIN'])
  if ('res' in g) return g.res

  const monthParam = req.nextUrl.searchParams.get('month') ?? ''
  const month = MONTH_RE.test(monthParam)
    ? monthParam
    : new Date().toISOString().slice(0, 7)
  const { start, end } = monthRange(month)

  // ---------- Santri ----------
  const [studentsActive, studentsByStatusRaw, studentsNewRows] = await Promise.all([
    db.student.count({ where: { status: 'AKTIF' } }),
    db.student.findMany({ select: { status: true } }),
    db.student.findMany({
      where: { createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: 'asc' },
      include: { class: { select: { name: true } } },
    }),
  ])
  const studentsByStatus: Record<string, number> = {}
  for (const s of studentsByStatusRaw) studentsByStatus[s.status] = (studentsByStatus[s.status] ?? 0) + 1

  // ---------- Guru & kelas ----------
  const [teachersActive, classesActive] = await Promise.all([
    db.teacher.count({ where: { isActive: true } }),
    db.class.count({ where: { isActive: true } }),
  ])

  // ---------- Pendaftaran PPDB ----------
  const regRows = await db.registration.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: 'asc' },
  })
  const regByStatus: Record<string, number> = {}
  for (const r of regRows) regByStatus[r.status] = (regByStatus[r.status] ?? 0) + 1

  // ---------- Keuangan ----------
  const paymentsCreated = await db.payment.findMany({
    where: { createdAt: { gte: start, lt: end } },
    include: { student: { select: { fullName: true } } },
  })
  const paidRows = paymentsCreated.filter((p) => p.status === 'SUCCESS')
  const pendingRows = paymentsCreated.filter((p) => p.status === 'PENDING')
  const failedRows = paymentsCreated.filter((p) => p.status === 'FAILED')
  const byMethod: Record<string, { count: number; amount: number }> = {}
  for (const p of paidRows) {
    const key = p.method ?? 'LAINNYA'
    if (!byMethod[key]) byMethod[key] = { count: 0, amount: 0 }
    byMethod[key].count += 1
    byMethod[key].amount += p.amount
  }

  // ---------- Presensi (via sesi kelas) ----------
  const sessions = await db.session.findMany({
    where: { date: { gte: start, lt: end } },
    include: {
      class: { select: { name: true } },
      attendances: { select: { status: true } },
    },
    orderBy: { date: 'asc' },
  })
  const attBreakdown: Record<string, number> = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPA: 0 }
  const attByClass: Record<string, { name: string; sessions: number; HADIR: number; total: number }> = {}
  for (const s of sessions) {
    if (!attByClass[s.classId]) {
      attByClass[s.classId] = { name: s.class.name, sessions: 0, HADIR: 0, total: 0 }
    }
    attByClass[s.classId].sessions += 1
    for (const a of s.attendances) {
      attBreakdown[a.status] = (attBreakdown[a.status] ?? 0) + 1
      attByClass[s.classId].total += 1
      if (a.status === 'HADIR') attByClass[s.classId].HADIR += 1
    }
  }
  const attTotal = Object.values(attBreakdown).reduce((a, b) => a + b, 0)

  // ---------- Hafalan ----------
  const hafalanRows = await db.hafalan.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: 'desc' },
    include: { student: { select: { fullName: true } } },
  })
  const hafalanByType: Record<string, number> = {}
  for (const h of hafalanRows) hafalanByType[h.type] = (hafalanByType[h.type] ?? 0) + 1
  const graded = hafalanRows.filter((h) => typeof h.grade === 'number')
  const hafalanAvgGrade = graded.length ? Math.round(sum(graded, (h) => h.grade ?? 0) / graded.length) : null

  // ---------- Notifikasi WhatsApp ----------
  const notifCount = await db.notification.count({ where: { createdAt: { gte: start, lt: end } } })

  return ok({
    month,
    generatedAt: new Date().toISOString(),
    snapshot: { studentsActive, teachersActive, classesActive },
    students: {
      newCount: studentsNewRows.length,
      byStatus: studentsByStatus,
      list: studentsNewRows.map((s) => ({
        nis: s.nis,
        fullName: s.fullName,
        gender: s.gender,
        className: s.class?.name ?? '—',
        status: s.status,
        createdAt: s.createdAt,
      })),
    },
    registrations: {
      total: regRows.length,
      byStatus: regByStatus,
      list: regRows.slice(0, 20).map((r) => ({
        regNumber: r.regNumber,
        childName: r.childName,
        parentName: r.parentName,
        status: r.status,
        createdAt: r.createdAt,
      })),
    },
    payments: {
      billedTotal: sum(paymentsCreated, (p) => p.amount),
      billedCount: paymentsCreated.length,
      paidTotal: sum(paidRows, (p) => p.amount),
      paidCount: paidRows.length,
      pendingCount: pendingRows.length,
      pendingTotal: sum(pendingRows, (p) => p.amount),
      failedCount: failedRows.length,
      byMethod,
      list: paidRows
        .sort((a, b) => (b.paidAt?.getTime() ?? 0) - (a.paidAt?.getTime() ?? 0))
        .slice(0, 20)
        .map((p) => ({
          invoiceNo: p.invoiceNo,
          title: p.title,
          studentName: p.student.fullName,
          method: p.method ?? '—',
          amount: p.amount,
          paidAt: p.paidAt,
        })),
    },
    attendance: {
      sessionCount: sessions.length,
      breakdown: attBreakdown,
      total: attTotal,
      rate: attTotal ? Math.round((attBreakdown.HADIR / attTotal) * 100) : 0,
      byClass: Object.values(attByClass).sort((a, b) => a.name.localeCompare(b.name)),
    },
    hafalan: {
      count: hafalanRows.length,
      avgGrade: hafalanAvgGrade,
      byType: hafalanByType,
      list: hafalanRows.slice(0, 15).map((h) => ({
        studentName: h.student.fullName,
        surahName: h.surahName,
        ayatRange: h.ayatRange,
        type: h.type,
        grade: h.grade,
        createdAt: h.createdAt,
      })),
    },
    notifications: { sentCount: notifCount },
  })
}
