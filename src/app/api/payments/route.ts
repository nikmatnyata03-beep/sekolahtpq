import { NextRequest } from 'next/server'
import { db, ok, bad, sendWhatsApp } from '@/lib/api'
import { guard } from '@/lib/session'

export async function GET(req: NextRequest) {
  const g = await guard(req)
  if ('res' in g) return g.res
  const studentId = req.nextUrl.searchParams.get('studentId')
  const status = req.nextUrl.searchParams.get('status')
  const payments = await db.payment.findMany({
    where: {
      ...(studentId && { studentId }),
      ...(status && { status }),
    },
    include: { student: { select: { id: true, fullName: true, nis: true, parent: { select: { id: true, name: true, phone: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
  return ok(payments)
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.studentId || !b.title || !b.amount) return bad('Santri, keterangan, dan nominal wajib')
    const count = await db.payment.count()
    const payment = await db.payment.create({
      data: {
        invoiceNo: `INV-2025-${1000 + count + 1}`,
        studentId: b.studentId,
        title: b.title,
        amount: Number(b.amount),
      },
      include: { student: { include: { parent: true } } },
    })
    if (payment.student.parent) {
      await sendWhatsApp({
        phone: payment.student.parent.phone,
        userId: payment.student.parent.id,
        message: `Tagihan baru: *${b.title}* sebesar Rp ${new Intl.NumberFormat('id-ID').format(Number(b.amount))} untuk ${payment.student.fullName}. No: ${payment.invoiceNo}. Bayar via Portal Wali. — TPQ Darul Jinan`,
      })
    }
    return ok(payment)
  } catch {
    return bad('Gagal membuat tagihan')
  }
}

// Simulated payment webhook (Midtrans-style): parent pays -> status updated -> WA confirmation
export async function PUT(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.id) return bad('ID wajib')
    const payment = await db.payment.findUnique({ where: { id: b.id }, include: { student: { include: { parent: true } } } })
    if (!payment) return bad('Tagihan tidak ditemukan', 404)

    const status = b.status || 'SUCCESS'
    const method = b.method || 'QRIS'
    const updated = await db.payment.update({
      where: { id: b.id },
      data: { status, method, paidAt: status === 'SUCCESS' ? new Date() : null },
    })

    if (payment.student.parent && status === 'SUCCESS') {
      await sendWhatsApp({
        phone: payment.student.parent.phone,
        userId: payment.student.parent.id,
        message: `Pembayaran BERHASIL: *${payment.title}* Rp ${new Intl.NumberFormat('id-ID').format(payment.amount)} via ${method}. No: ${payment.invoiceNo}. Jazakumullahu khairan. — TPQ Darul Jinan`,
      })
    } else if (payment.student.parent && status === 'FAILED') {
      await sendWhatsApp({
        phone: payment.student.parent.phone,
        userId: payment.student.parent.id,
        message: `Pembayaran *${payment.title}* (${payment.invoiceNo}) GAGAL via ${method}. Silakan coba lagi di Portal Wali. — TPQ Darul Jinan`,
      })
    }
    return ok(updated)
  } catch {
    return bad('Gagal memproses pembayaran')
  }
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, ['ADMIN'])
  if ('res' in g) return g.res
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return bad('ID wajib')
  await db.payment.delete({ where: { id } })
  return ok({ success: true })
}
