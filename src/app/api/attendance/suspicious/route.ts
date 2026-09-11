import { NextRequest } from 'next/server'
import { db, ok } from '@/lib/api'
import { guard } from '@/lib/session'

/**
 * Task 44 — Panel "Absen Mencurigakan" (lintas-sesi).
 *
 * Mengagregasi catatan HADIR 30 hari terakhir yang menyandang sinyal
 * kecurigaan dari heuristik anti-kecurangan yang sudah ada:
 *  1. PERANGKAT_GANDA  — dupDevice menunggu verifikasi ustadz (Task 42)
 *  2. KOORDINAT_IDENTIK — dupCount ≥ 1 (koordinat persis sama dgn perangkat
 *     LAIN; ambang blokir ≥ 2 perangkat, jadi 1 lolos & perlu dilihat)
 *  3. AKURASI_RENDAH    — akurasi GPS > 30 m (di bawah blokir 50 m)
 *  4. PERANGKAT_BANYAK  — deviceHash sama dipakai ≥ 3 santri berbeda
 *     dalam 30 hari lintas sesi (pola proxy; 1 wali 2 anak = normal = 2)
 *
 * ADMIN melihat seluruh lembaga; GURU hanya kelas amanahnya (server-side).
 * Aksi verifikasi memakai endpoint /api/attendance/[id]/review yang sudah ada.
 */

const DAYS = 30
const MAX_TAKE = 1200

type Finding = { type: string; label: string; detail: string; severity: 'action' | 'warning' | 'info' }

export async function GET(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'GURU'])
  if ('res' in g) return g.res
  const isGuru = g.session.role === 'GURU'

  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000)
  const rows = await db.attendance.findMany({
    where: { status: 'HADIR', createdAt: { gte: since } },
    include: {
      student: { select: { id: true, fullName: true, nis: true } },
      session: {
        select: {
          id: true,
          code: true,
          date: true,
          topic: true,
          class: { select: { id: true, name: true, teacherId: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_TAKE,
  })

  // Guru hanya melihat kelas amanahnya — difilter di server.
  const visible = isGuru ? rows.filter((r) => r.session.class.teacherId === g.session.teacherId) : rows

  // ==== Agregasi lintas-sesi: pemakaian deviceHash oleh banyak santri ====
  const deviceStudents = new Map<string, Set<string>>()
  for (const r of visible) {
    if (!r.deviceHash) continue
    const set = deviceStudents.get(r.deviceHash) ?? new Set<string>()
    set.add(r.studentId)
    deviceStudents.set(r.deviceHash, set)
  }
  const multiStudentDevices = new Map<string, number>()
  for (const [hash, set] of deviceStudents) {
    if (set.size >= 3) multiStudentDevices.set(hash, set.size)
  }

  const findings: Array<{
    id: string
    studentId: string
    studentName: string
    nis: string
    className: string
    sessionCode: string
    sessionTopic: string | null
    sessionDate: string
    distanceM: number | null
    accuracy: number | null
    dupDeviceOf: string | null
    findings: Finding[]
  }> = []

  for (const r of visible) {
    let flags: Record<string, unknown> = {}
    try {
      flags = r.gpsFlags ? (JSON.parse(r.gpsFlags) as Record<string, unknown>) : {}
    } catch {
      flags = {}
    }
    const f: Finding[] = []

    if (flags.dupDevice === true && flags.dupDeviceReviewed !== true) {
      f.push({
        type: 'PERANGKAT_GANDA',
        label: 'Perangkat ganda',
        detail: `Perangkat sama dengan ${String(flags.dupDeviceOf ?? 'santri lain')} — menunggu verifikasi`,
        severity: 'action',
      })
    }
    const dupCount = typeof flags.dupCount === 'number' ? flags.dupCount : 0
    if (dupCount >= 1) {
      f.push({
        type: 'KOORDINAT_IDENTIK',
        label: 'Koordinat identik',
        detail: `Koordinat persis sama dengan check-in perangkat lain (${dupCount}×)`,
        severity: 'warning',
      })
    }
    const acc = typeof flags.accuracy === 'number' ? flags.accuracy : (r.accuracy ?? null)
    if (acc !== null && acc > 30) {
      f.push({
        type: 'AKURASI_RENDAH',
        label: 'Akurasi rendah',
        detail: `Akurasi GPS ±${Math.round(acc)} m (>30 m)`,
        severity: 'info',
      })
    }
    const devCount = r.deviceHash ? multiStudentDevices.get(r.deviceHash) : undefined
    if (devCount) {
      f.push({
        type: 'PERANGKAT_BANYAK',
        label: 'Perangkat dipakai bersama',
        detail: `Perangkat sama dipakai ${devCount} santri berbeda dalam ${DAYS} hari`,
        severity: 'info',
      })
    }

    if (f.length === 0) continue
    findings.push({
      id: r.id,
      studentId: r.studentId,
      studentName: r.student.fullName,
      nis: r.student.nis,
      className: r.session.class.name,
      sessionCode: r.session.code,
      sessionTopic: r.session.topic,
      sessionDate: r.session.date.toISOString(),
      distanceM: r.distanceM,
      accuracy: acc,
      dupDeviceOf: flags.dupDeviceOf ? String(flags.dupDeviceOf) : null,
      findings: f,
    })
  }

  // Urutan: perlu tindakan dulu, lalu terbaru (query sudah createdAt desc).
  findings.sort((a, b) => {
    const aAct = a.findings.some((x) => x.severity === 'action') ? 0 : 1
    const bAct = b.findings.some((x) => x.severity === 'action') ? 0 : 1
    return aAct - bAct
  })

  const summary = {
    total: findings.length,
    pendingReview: findings.filter((x) => x.findings.some((f) => f.type === 'PERANGKAT_GANDA')).length,
    dupCoords: findings.filter((x) => x.findings.some((f) => f.type === 'KOORDINAT_IDENTIK')).length,
    lowAccuracy: findings.filter((x) => x.findings.some((f) => f.type === 'AKURASI_RENDAH')).length,
    sharedDevices: findings.filter((x) => x.findings.some((f) => f.type === 'PERANGKAT_BANYAK')).length,
    scanned: visible.length,
    days: DAYS,
  }

  return ok({ summary, findings: findings.slice(0, 200) })
}
