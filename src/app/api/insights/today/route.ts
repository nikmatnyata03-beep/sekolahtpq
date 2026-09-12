// Gelombang 4.5 — item #10 matriks riset UIUX-RESEARCH-01: INSIGHT HARI INI.
//
// GET /api/insights/today → ringkasan operasional HARI INI (WIB) untuk kartu
// "Insight Hari Ini" di dashboard. Deterministik & instan — TANPA panggilan AI
// (nol kuota, nol latensi). AI narrative opsional menyusul sebagai lapis atas.
//
// Akses & scope (pola sama dengan /api/students — CWE-863 tetap terjaga):
//   ADMIN  → seluruh lembaga
//   GURU   → hanya kelas yang diampu (teacherId dari sesi)
import { NextRequest } from 'next/server'
import { db, ok } from '@/lib/api'
import { guard } from '@/lib/session'

export const dynamic = 'force-dynamic'

/** Rentang "hari ini" menurut kalender WIB (Asia/Jakarta, UTC+7). */
function jakartaDayRange(): { start: Date; end: Date; dateLabel: string } {
  const now = new Date(Date.now() + 7 * 3600 * 1000)
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const d = now.getUTCDate()
  const startUtc = Date.UTC(y, m, d) - 7 * 3600 * 1000
  const start = new Date(startUtc)
  const end = new Date(startUtc + 24 * 3600 * 1000)
  const bulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]
  return { start, end, dateLabel: `${d} ${bulan[m]} ${y}` }
}

export async function GET(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'GURU'])
  if ('res' in g) return g.res
  const { start, end, dateLabel } = jakartaDayRange()
  const isGuru = g.session.role === 'GURU'

  // Scope: guru melihat kelasnya saja lewat relasi Session→Class→teacherId.
  const attScope = {
    session: {
      date: { gte: start, lt: end },
      ...(isGuru ? { class: { teacherId: g.session.teacherId ?? '__no_teacher__' } } : {}),
    },
  }
  const hafalanScope = {
    createdAt: { gte: start, lt: end },
    ...(isGuru ? { student: { class: { teacherId: g.session.teacherId ?? '__no_teacher__' } } } : {}),
  }

  try {
    const [attendance, hafalanCount, paymentPending, ppdbPending] = await Promise.all([
      // Presensi hari ini: status + jumlah santri unik yang tercatat
      db.attendance.findMany({
        where: attScope,
        select: { status: true, studentId: true },
      }),
      db.hafalan.count({ where: hafalanScope }),
      // Keuangan & PPDB hanya relevan untuk ADMIN
      isGuru
        ? Promise.resolve(0)
        : db.payment.count({ where: { status: 'PENDING' } }),
      isGuru
        ? Promise.resolve(0)
        : db.registration.count({ where: { status: 'PENDING' } }),
    ])

    const attCount: Record<string, number> = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPA: 0 }
    const recordedStudents = new Set<string>()
    for (const a of attendance) {
      if (a.status in attCount) attCount[a.status]++
      recordedStudents.add(a.studentId)
    }
    const attTotal = attendance.length
    const persenHadir = attTotal ? Math.round((attCount.HADIR / attTotal) * 100) : 0

    // Hafalan: rata-rata nilai setoran hari ini
    const hafalans = isGuru
      ? []
      : await db.hafalan.findMany({
          where: hafalanScope,
          select: { grade: true },
        })
    const hafAvg = hafalans.length
      ? Math.round(hafalans.reduce((s, h) => s + (h.grade || 0), 0) / hafalans.length)
      : null

    return ok({
      dateLabel,
      role: g.session.role,
      presensi: {
        total: attTotal,
        santriTercatat: recordedStudents.size,
        hadir: attCount.HADIR,
        izin: attCount.IZIN,
        sakit: attCount.SAKIT,
        alpa: attCount.ALPA,
        persenHadir,
      },
      hafalan: { setoran: hafalanCount, rataNilai: hafAvg },
      ...(isGuru ? {} : { keuangan: { tagihanPending: paymentPending }, ppdb: { menunggu: ppdbPending } }),
    })
  } catch (e) {
    console.error('[insights/today]', e)
    return ok({ dateLabel, role: g.session.role, presensi: null, hafalan: null })
  }
}
