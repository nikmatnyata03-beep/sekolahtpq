import { db, ok } from '@/lib/api'

export async function GET() {
  const curricula = await db.curriculum.findMany({
    include: { class: { select: { id: true, name: true } } },
    orderBy: { order: 'asc' },
  })
  return ok(curricula)
}
