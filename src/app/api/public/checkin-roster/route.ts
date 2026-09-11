import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { ensureAttendanceSchema } from '@/lib/attendance-schema'
import { parseAttendanceCode, verifyRotatingSuffix } from '@/lib/rotating-code'

/**
 * Daftar santri untuk check-in PUBLIK — kuncinya KODE SESI.
 *
 * Setelah hardening IDOR, /api/students wajib login sehingga alur check-in
 * anonim (santri/wali memindai QR) mati. Endpoint ini mengembalikan daftar
 * HANYA jika pemohon memegang kode sesi yang valid & aktif — kode itulah
 * rahasia bersama kelas. Data yang bocor pun minimum: nama + NIS santri kelas
 * tersebut saja (bukan seluruh sekolah). Pencocokan santri↔kelas tetap
 * divalidasi ulang di /api/attendance/checkin (defense in depth).
 */
export async function GET(req: NextRequest) {
  await ensureAttendanceSchema()
  if (!rateLimit(`roster:${clientIp(req)}`, 20, 60 * 1000)) {
    return bad('Terlalu banyak percobaan. Tunggu sebentar.', 429)
  }
  const codeRaw = (req.nextUrl.searchParams.get('code') ?? '').trim().toUpperCase()
  if (!codeRaw) return bad('Kode kehadiran wajib diisi')
  // Task 41: dukung QR berotasi (STATIS.SUFIX) — sufiks wajib masih segar.
  // Kode statis polos tetap diterima (kompatibilitas link/entry manual).
  const { staticCode, rot } = parseAttendanceCode(codeRaw)
  if (rot) {
    const rotErr = await verifyRotatingSuffix(rot, staticCode)
    if (rotErr) return bad(rotErr)
  }

  const session = await db.session.findUnique({
    where: { code: staticCode },
    include: { class: { select: { name: true, level: true } } },
  })
  if (!session) return bad('Kode kehadiran tidak ditemukan', 404)
  if (!session.isActive) return bad('Sesi sudah ditutup', 400)

  const students = await db.student.findMany({
    where: { classId: session.classId },
    select: { id: true, fullName: true, nis: true },
    orderBy: { fullName: 'asc' },
  })
  return ok({
    session: {
      id: session.id,
      className: session.class.name,
      classLevel: session.class.level,
      topic: session.topic,
      date: session.date,
    },
    students,
  })
}
