/**
 * POST /api/payments/batch — Admin mass-invoice generator ("Tagihan Massal").
 *
 * Contract:
 *   Request  : { classId: string, title: string, amount: number, month?: string }
 *              - classId : id kelas target (wajib)
 *              - title   : keterangan tagihan, e.g. "Iuran SPP Januari 2025" (wajib)
 *              - amount  : nominal tagihan, bilangan bulat > 0 (wajib)
 *              - month   : opsional, informasional (bulan tagihan sudah tercakup di title)
 *   Response : 200 { created: number, skipped: number, invoices: Payment[] }
 *              - created : jumlah invoice yang terbit
 *              - skipped : jumlah santri AKTIF yang dilewati (sudah punya tagihan
 *                          PENDING/SUCCESS dengan keterangan sama, case-insensitive)
 *              - invoices: invoice baru (include santri: id, fullName, nis, parent)
 *   Errors   : 400 'Kelas, keterangan, dan nominal wajib'
 *              400 'Nominal harus angka positif'
 *              404 'Kelas tidak ditemukan'
 *              400 'Tidak ada santri AKTIF di kelas ini'
 *              400 'Gagal membuat tagihan massal' (catch-all)
 *   Side-effect: WhatsApp "Tagihan baru" ke wali untuk SETIAP invoice yang terbit
 *              (gaya sama dengan POST /api/payments).
 *   Invoice numbering: `INV-2025-${1000 + currentCount + i + 1}` — dibuat sekuensial
 *              di dalam loop dari db.payment.count() awal (aman dari duplikat nomor).
 */
import { NextRequest } from 'next/server'
import { db, ok, bad, sendWhatsApp } from '@/lib/api'
import { guard } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.classId || !b.title || !b.amount) return bad('Kelas, keterangan, dan nominal wajib')
    const amount = Number(b.amount)
    if (!Number.isInteger(amount) || amount <= 0) return bad('Nominal harus angka positif')
    const title = String(b.title).trim()

    const cls = await db.class.findUnique({ where: { id: b.classId } })
    if (!cls) return bad('Kelas tidak ditemukan', 404)

    const activeStudents = await db.student.findMany({
      where: { classId: b.classId, status: 'AKTIF' },
      include: { parent: true },
      orderBy: { fullName: 'asc' },
    })
    if (activeStudents.length === 0) return bad('Tidak ada santri AKTIF di kelas ini')

    // Duplicate guard: skip santri yang sudah punya tagihan PENDING/SUCCESS
    // dengan keterangan yang sama (case-insensitive, di-trim).
    const existing = await db.payment.findMany({
      where: {
        studentId: { in: activeStudents.map((s) => s.id) },
        status: { in: ['PENDING', 'SUCCESS'] },
      },
      select: { studentId: true, title: true },
    })
    const key = (studentId: string, t: string) => `${studentId}::${t.trim().toLowerCase()}`
    const dupKeys = new Set(existing.map((p) => key(p.studentId, p.title)))
    const targets = activeStudents.filter((s) => !dupKeys.has(key(s.id, title)))
    const skipped = activeStudents.length - targets.length

    const currentCount = await db.payment.count()
    const created: Awaited<ReturnType<typeof db.payment.create>>[] = []
    let i = 0
    for (const student of targets) {
      i += 1
      const invoiceNo = `INV-2025-${1000 + currentCount + i}`
      const payment = await db.payment.create({
        data: { invoiceNo, studentId: student.id, title, amount },
        include: {
          student: {
            select: { id: true, fullName: true, nis: true, parent: { select: { id: true, name: true, phone: true } } },
          },
        },
      })
      created.push(payment)
      if (payment.student.parent) {
        await sendWhatsApp({
          phone: payment.student.parent.phone,
          userId: payment.student.parent.id,
          message: `Tagihan baru: *${title}* sebesar Rp ${new Intl.NumberFormat('id-ID').format(amount)} untuk ${payment.student.fullName}. No: ${payment.invoiceNo}. Bayar via Portal Wali. — TPQ Darul Jinan`,
        })
      }
    }

    return ok({ created: created.length, skipped, invoices: created })
  } catch {
    return bad('Gagal membuat tagihan massal')
  }
}
