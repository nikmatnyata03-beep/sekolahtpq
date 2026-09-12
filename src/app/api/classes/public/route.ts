import { db, ok } from '@/lib/api'

/**
 * GET /api/classes/public — daftar kelas untuk portal publik (anonim).
 *
 * Menggantikan pemanggilan /api/classes di section publik (Kurikulum, Materi)
 * yang sejak pentest F-09 terkunci autentikasi — akibatnya pengunjung anonim
 * melihat "Harus login untuk aksi ini" di dua section tersebut.
 *
 * Hanya kolom aman untuk publik: id, nama, jadwal, ruang.
 * TIDAK menyertakan nama pengampu maupun data/jumlah santri (semangat F-09).
 */
export async function GET() {
  const classes = await db.class.findMany({
    select: { id: true, name: true, schedule: true, room: true },
    orderBy: { name: 'asc' },
  })
  return ok(classes)
}
