import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'
import { rotatingCodeFor, ROT_WINDOW_SEC } from '@/lib/rotating-code'

/**
 * Task 41 — cetak kode QR berotasi untuk satu sesi aktif.
 * Hanya STAFF (ADMIN/GURU pemilik kelas) yang bisa meminta: kalau publik bisa
 * mencetak sufiks segar untuk kode statis mana pun, rotasi kehilangan gunanya.
 * Kode berlaku 1 jendela 60 dtk (server menerima jendela saat ini + 1 sebelumnya).
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'GURU'])
  if ('res' in g) return g.res
  const code = (req.nextUrl.searchParams.get('code') ?? '').trim().toUpperCase()
  if (!code) return bad('Kode sesi wajib diisi')

  const session = await db.session.findUnique({ where: { code }, include: { class: { select: { teacherId: true } } } })
  if (!session) return bad('Sesi tidak ditemukan', 404)
  if (g.session.role === 'GURU' && session.class.teacherId !== g.session.teacherId) {
    return bad('Anda bukan pengampu kelas ini', 403)
  }

  const now = Date.now()
  const rotCode = await rotatingCodeFor(session.code, now)
  const windowEndsAt = (Math.floor(now / (ROT_WINDOW_SEC * 1000)) + 1) * ROT_WINDOW_SEC * 1000
  return ok({ rotCode, windowEndsAt, windowSec: ROT_WINDOW_SEC })
}
