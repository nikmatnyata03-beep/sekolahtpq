import { db } from '@/lib/api'

/** Public landing-page counters only; never expose dashboard data here. */
export async function GET() {
  const [students, teachers, classes] = await Promise.all([
    db.student.count({ where: { status: 'AKTIF' } }),
    db.teacher.count({ where: { isActive: true } }),
    db.class.count({ where: { isActive: true } }),
  ])
  return Response.json({ students, teachers, classes }, { headers: { 'Cache-Control': 'public, max-age=300' } })
}
