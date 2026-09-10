import { NextRequest } from 'next/server'
import { db, ok, bad, sendWhatsApp } from '@/lib/api'

/**
 * Simulated QR check-in (per blueprint SantriQ-style flow):
 * student (or parent on behalf) enters the session check-in code -> presence recorded -> parent notified.
 */
export async function POST(req: NextRequest) {
  try {
    const { code, studentId } = await req.json()
    if (!code || !studentId) return bad('Kode kehadiran dan santri wajib dipilih')

    const session = await db.session.findUnique({ where: { code: String(code).trim().toUpperCase() }, include: { class: true } })
    if (!session) return bad('Kode kehadiran tidak ditemukan', 404)
    if (!session.isActive) return bad('Sesi sudah ditutup', 400)

    const student = await db.student.findUnique({ where: { id: studentId }, include: { parent: true, class: true } })
    if (!student) return bad('Santri tidak ditemukan', 404)
    if (student.classId !== session.classId) {
      return bad(`Santri tidak terdaftar di kelas ${session.class.name}`, 400)
    }

    const existing = await db.attendance.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId } },
    })
    if (existing) return ok({ already: true, message: `${student.fullName} sudah tercatat ${existing.status} pada sesi ini.` })

    await db.attendance.create({ data: { sessionId: session.id, studentId, status: 'HADIR' } })
    if (student.parent) {
      await sendWhatsApp({
        phone: student.parent.phone,
        userId: student.parent.id,
        message: `Assalamu'alaikum Bpk/Ibu ${student.parent.name}, *${student.fullName}* baru saja check-in (QR) HADIR di kelas ${session.class.name} pukul ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}. — TPQ Darul Jinan`,
      })
    }
    return ok({ success: true, message: `Alhamdulillah, ${student.fullName} tercatat HADIR!` })
  } catch {
    return bad('Gagal check-in')
  }
}
