// Ringkasan AI Laporan Bulanan — narasi otomatis atas data operasional bulan
// terpilih (Workers AI). Melengkapi PDF: angka tetap dari /api/reports/monthly,
// AI menambahkan interpretasi singkat untuk kepala lembaga.
//
//   POST /api/reports/ai-summary  { month: 'YYYY-MM' }
//   Akses: ADMIN & DEVELOPER. Rate limit 6 ringkasan / 10 menit / user.

import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { runAi, aiErrorMessage } from '@/lib/ai'
import { rupiah } from '@/lib/api'
import { ensureAttendanceSchema } from '@/lib/attendance-schema'

export const dynamic = 'force-dynamic'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export async function POST(req: NextRequest) {
  await ensureAttendanceSchema()
  const g = await guard(req, ['ADMIN', 'DEVELOPER'])
  if ('res' in g) return g.res

  if (!rateLimit(`report-ai:${g.session.id}`, 6, 600_000)) {
    return bad('Terlalu banyak permintaan ringkasan. Coba lagi dalam 10 menit.', 429)
  }

  const body = (await req.json().catch(() => null)) as { month?: string } | null
  const month = String(body?.month || '')
  if (!MONTH_RE.test(month)) return bad('Format bulan harus YYYY-MM')

  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 1))

  // ===== Agregasi ringkas (beberapa query, hitung di JS — data sebulan kecil) =====
  const [payments, students, registrations, attendance, hafalans, notifCount] = await Promise.all([
    db.payment.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { amount: true, status: true, method: true },
    }),
    db.student.count({ where: { createdAt: { gte: start, lt: end } } }),
    db.registration.groupBy({ by: ['status'], _count: { _all: true }, where: { createdAt: { gte: start, lt: end } } }),
    db.attendance.findMany({
      where: { session: { date: { gte: start, lt: end } } },
      select: { status: true },
    }),
    db.hafalan.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { grade: true, type: true },
    }),
    db.notification.count({ where: { createdAt: { gte: start, lt: end } } }),
  ])

  const paid = payments.filter((p) => p.status === 'SUCCESS')
  const pending = payments.filter((p) => p.status === 'PENDING').length
  const failed = payments.filter((p) => p.status === 'FAILED').length
  const totalPaid = paid.reduce((s, p) => s + p.amount, 0)
  const byMethod: Record<string, number> = {}
  for (const p of paid) {
    const key = p.method || 'LAINNYA'
    byMethod[key] = (byMethod[key] || 0) + 1
  }
  const attCount: Record<string, number> = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPA: 0 }
  for (const a of attendance) {
    if (a.status in attCount) attCount[a.status]++
  }
  const attTotal = attendance.length
  const hafAvg = hafalans.length
    ? Math.round(hafalans.reduce((s, h) => s + (h.grade || 0), 0) / hafalans.length)
    : 0
  const hafTypes: Record<string, number> = {}
  for (const h of hafalans) hafTypes[h.type] = (hafTypes[h.type] || 0) + 1

  const digest = {
    periode: month,
    keuangan: {
      invoiceTerbit: payments.length,
      lunas: paid.length,
      menunggu: pending,
      gagal: failed,
      totalMasuk: rupiah(totalPaid),
      metode: byMethod,
    },
    santri: { baruBulanIni: students },
    ppdb: registrations.map((r) => ({ status: r.status, jumlah: r._count._all })),
    presensi: { totalCatatan: attTotal, ...attCount, persenHadir: attTotal ? Math.round((attCount.HADIR / attTotal) * 100) : 0 },
    hafalan: { jumlahSetoran: hafalans.length, rataNilai: hafAvg, perJenis: hafTypes },
    notifikasiWhatsapp: notifCount,
  }

  const SYSTEM = `Anda analis operasional lembaga pendidikan Islam. Ringkas data JSON laporan bulanan TPQ menjadi narasi Bahasa Indonesia untuk kepala lembaga:
- Paragraf 1: gambaran umum (keuangan & pendaftaran).
- Paragraf 2: presensi & capaian hafalan.
- Paragraf 3: satu saran konkret langkah perbaikan bulan depan.
Aturan: hanya gunakan angka dari data; jangan mengarang; maksimal 150 kata; tanpa markdown table; boleh pakai 1-2 poin penting.`

  try {
    const summary = await runAi(SYSTEM, JSON.stringify(digest), 900)
    return ok({ month, digest, summary })
  } catch (e) {
    console.error('[report ai-summary]', e)
    return bad(aiErrorMessage(e), 502)
  }
}
