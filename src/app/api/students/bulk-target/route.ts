import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'

/**
 * ==== API CONTRACT — /api/students/bulk-target (Task 17-a) ====
 * POST {classId, hafalanTarget}  (hafalanTarget: string | null)
 *   → Sets hafalanTarget for ALL students in the class with status 'AKTIF'
 *     (updateMany — santri NONAKTIF/LULUS are never touched).
 *   → Validation: classId required + must exist; hafalanTarget must be null
 *     OR a non-empty string ≤ 60 chars (trimmed). Failures → { error } Indonesian.
 *   → { success: true, count: <rows updated>, hafalanTarget }
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'GURU'])
    if ('res' in g) return g.res
    const b = await req.json()
    const classId = typeof b.classId === 'string' ? b.classId.trim() : ''
    if (!classId) return bad('Kelas wajib dipilih')

    const cls = await db.class.findUnique({ where: { id: classId }, select: { id: true } })
    if (!cls) return bad('Kelas tidak ditemukan', 404)

    let hafalanTarget: string | null = null
    if (b.hafalanTarget !== null && b.hafalanTarget !== undefined) {
      if (typeof b.hafalanTarget !== 'string') return bad('Target hafalan tidak valid')
      hafalanTarget = b.hafalanTarget.trim()
      if (!hafalanTarget) return bad('Target hafalan tidak boleh kosong')
      if (hafalanTarget.length > 60) return bad('Target hafalan maksimal 60 karakter')
    }

    const result = await db.student.updateMany({
      where: { classId, status: 'AKTIF' },
      data: { hafalanTarget },
    })
    return ok({ success: true, count: result.count, hafalanTarget })
  } catch (e) {
    console.error(e)
    return bad('Gagal menerapkan target kelas')
  }
}
