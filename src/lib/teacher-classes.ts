import { db } from '@/lib/db'

/**
 * Sinkronisasi penugasan kelas seorang guru (Task 36, dipindah ke lib di Task 40).
 * Dipakai bersama oleh /api/teachers dan /api/users.
 * - Kelas yang sebelumnya diampu guru ini tapi tidak ada di classIds → teacherId null.
 * - Kelas di classIds → teacherId = guru ini (menimpa pengampu lama secara eksplisit).
 * - ID yang tidak dikenal diabaikan agar payload bocor tidak merusak data.
 */
export async function syncTeacherClasses(teacherId: string, classIds: unknown) {
  if (!Array.isArray(classIds)) return
  const wanted = [...new Set(classIds.filter((v): v is string => typeof v === 'string' && v.trim() !== ''))]
  const valid = wanted.length
    ? await db.class.findMany({ where: { id: { in: wanted } }, select: { id: true } })
    : []
  const validIds = new Set(valid.map((c) => c.id))
  const current = await db.class.findMany({ where: { teacherId }, select: { id: true } })
  const toRemove = current.filter((c) => !validIds.has(c.id)).map((c) => c.id)
  await db.$transaction([
    ...(toRemove.length ? [db.class.updateMany({ where: { id: { in: toRemove } }, data: { teacherId: null } })] : []),
    ...(validIds.size ? [db.class.updateMany({ where: { id: { in: [...validIds] } }, data: { teacherId } })] : []),
  ])
}
