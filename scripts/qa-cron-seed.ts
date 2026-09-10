// QA sementara: sisipkan data uji cron (sesi stale + tagihan lama) di DB lokal.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const yesterday = new Date(Date.now() - 86_400_000)
const fourDaysAgo = new Date(Date.now() - 4 * 86_400_000)

const cls = (await db.class.findFirst()) ?? (await db.class.create({ data: { name: 'QA Kelas Cron', level: 'TAHFIDZ', schedule: 'Senin', room: 'R1' } }))
const parent = await db.user.findFirst({ where: { email: 'budi.santoso@gmail.com' } })
if (!parent) throw new Error('akun wali demo tidak ada')
const student =
  (await db.student.findFirst({ where: { parentId: parent.id } })) ??
  (await db.student.create({
    data: { nis: 'QA-CRON-1', fullName: 'QA Anak Cron', gender: 'L', birthDate: new Date(2016, 0, 1), address: 'Jl. QA', parentId: parent.id, classId: cls.id },
  }))

const sess = await db.session.create({
  data: { classId: cls.id, date: yesterday, topic: 'QA Sesi Stale', code: 'QA' + Date.now().toString(36).toUpperCase(), isActive: true },
})

const pay = await db.payment.create({
  data: { invoiceNo: 'QA-CRON-' + Date.now(), studentId: student.id, title: 'QA Iuran Uji Cron', amount: 25000, status: 'PENDING', createdAt: fourDaysAgo },
})

console.log(JSON.stringify({ sessionId: sess.id, paymentId: pay.id, parent: parent.name, phone: parent.phone }))
await db.$disconnect()
