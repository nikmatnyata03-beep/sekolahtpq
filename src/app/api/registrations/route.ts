import { NextRequest } from 'next/server'
import { db, ok, bad, sendWhatsApp } from '@/lib/api'

export async function GET() {
  const regs = await db.registration.findMany({ orderBy: { createdAt: 'desc' } })
  return ok(regs)
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.childName || !b.parentName || !b.phone || !b.birthDate) {
      return bad('Nama anak, nama orang tua, nomor HP, dan tanggal lahir wajib diisi')
    }
    const count = await db.registration.count()
    const reg = await db.registration.create({
      data: {
        regNumber: `PPDB-2025-${String(count + 1).padStart(4, '0')}`,
        childName: b.childName,
        gender: b.gender || 'L',
        birthDate: new Date(b.birthDate),
        parentName: b.parentName,
        phone: b.phone,
        email: b.email || null,
        address: b.address || '-',
        documents: JSON.stringify(b.documents || []),
        note: b.note || null,
      },
    })
    await sendWhatsApp({
      phone: b.phone,
      message: `Assalamu'alaikum Bpk/Ibu ${b.parentName}, pendaftaran *${b.childName}* berhasil. Nomor pendaftaran: *${reg.regNumber}*. Status: MENUNGGU VERIFIKASI. Kami akan menghubungi Anda. — TPQ Darul Jinan`,
    })
    return ok(reg)
  } catch {
    return bad('Gagal mengirim pendaftaran')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const b = await req.json()
    if (!b.id || !b.status) return bad('ID dan status wajib')
    const reg = await db.registration.update({
      where: { id: b.id },
      data: { status: b.status, ...(b.reviewNote !== undefined && { reviewNote: b.reviewNote }) },
    })

    // Accepting a registration auto-creates the santri + parent account (per blueprint PPDB flow)
    if (b.status === 'DITERIMA') {
      const existingStudent = await db.student.findFirst({ where: { fullName: reg.childName } })
      if (!existingStudent) {
        const count = await db.student.count()
        const nis = `DJ-2025-${String(count + 1).padStart(3, '0')}`
        const emailGuess = reg.email || `${reg.phone}@wali.daruljinan.id`
        let parent = await db.user.findUnique({ where: { email: emailGuess.toLowerCase() } })
        if (!parent) {
          parent = await db.user.create({
            data: { email: emailGuess.toLowerCase(), name: reg.parentName, phone: reg.phone, password: 'ortu123', role: 'ORANG_TUA' },
          })
        }
        const student = await db.student.create({
          data: {
            nis, fullName: reg.childName, gender: reg.gender, birthDate: reg.birthDate,
            address: reg.address, parentId: parent.id, classId: b.classId || null,
          },
        })
        await sendWhatsApp({
          phone: reg.phone,
          userId: parent.id,
          message: `Selamat! Pendaftaran *${reg.childName}* DITERIMA. NIS: *${nis}*. Akun Portal Wali: ${parent.email} / ortu123. — TPQ Darul Jinan`,
        })
        // credentials = akun wali yang dibuat/dipakai (parent bisa sudah ada sebelumnya); UI menampilkan panel salin
        return ok({ registration: reg, student, credentials: { nis, email: parent.email, tempPassword: 'ortu123' } })
      }
    }

    const messages: Record<string, string> = {
      VERIFIKASI: `Dokumen pendaftaran *${reg.childName}* telah diverifikasi. Menunggu keputusan penerimaan. — TPQ Darul Jinan`,
      DITERIMA: `Selamat! Pendaftaran *${reg.childName}* DITERIMA. — TPQ Darul Jinan`,
      DITOLAK: `Mohon maaf, pendaftaran *${reg.childName}* belum dapat kami terima. ${reg.reviewNote || ''} — TPQ Darul Jinan`,
    }
    if (messages[b.status]) {
      await sendWhatsApp({ phone: reg.phone, message: messages[b.status] })
    }
    // credentials: null → tidak ada akun baru dibuat (santri dengan nama serupa sudah ada, atau status bukan DITERIMA)
    return ok({ registration: reg, credentials: null })
  } catch {
    return bad('Gagal memperbarui pendaftaran')
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return bad('ID wajib')
  await db.registration.delete({ where: { id } })
  return ok({ success: true })
}
