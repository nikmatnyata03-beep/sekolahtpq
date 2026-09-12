import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, ok, bad } from '@/lib/api'
import { getSession, guard } from '@/lib/session'
import { ensurePostLikeSchema } from '@/lib/blog/bootstrap'
// Komentar artikel ala sosial media (Task 67).
//   GET  ?postId=…              → daftar komentar (publik, terlama dulu)
//   POST { postId, visitorId, name?, content } → tulis komentar (publik)
//   DELETE ?id=…                → hapus (ADMIN saja)
export const dynamic = 'force-dynamic'

// Anti-spam ringan: maks 1 komentar / 30 detik per visitorId per proses.
const lastCommentAt = new Map<string, number>()
const COMMENT_COOLDOWN_MS = 30_000

const createSchema = z.object({
  postId: z.string().trim().min(1).max(64),
  visitorId: z.string().trim().min(8).max(64),
  name: z.string().trim().max(60).optional(),
  content: z.string().trim().min(1).max(500),
})

export async function GET(req: NextRequest) {
  try {
    await ensurePostLikeSchema()
    const postId = req.nextUrl.searchParams.get('postId')?.slice(0, 64)
    if (!postId) return bad('postId wajib')
    const comments = await db.postComment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })
    return NextResponse.json(comments, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[posts/comments GET]', e)
    return bad('Gagal memuat komentar', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensurePostLikeSchema()
    const body = await req.json().catch(() => null)
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return bad('Data komentar tidak valid')
    const { postId, visitorId, name, content } = parsed.data

    const post = await db.post.findUnique({ where: { id: postId }, select: { id: true, published: true } })
    if (!post || !post.published) return bad('Artikel tidak ditemukan', 404)

    const now = Date.now()
    const last = lastCommentAt.get(visitorId) ?? 0
    if (now - last < COMMENT_COOLDOWN_MS) {
      return bad('Mohon beri jeda sejenak sebelum berkomentar lagi', 429)
    }
    lastCommentAt.set(visitorId, now)

    const safeName = (name && name.length > 0 ? name : 'Pengunjung').slice(0, 60)
    const created = await db.postComment.create({
      data: { postId, visitorId, name: safeName, content },
    })
    return ok(created)
  } catch (e) {
    console.error('[posts/comments POST]', e)
    return bad('Gagal menyimpan komentar', 500)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await ensurePostLikeSchema()
    const g = await guard(req, ['ADMIN'])
    if ('res' in g) return g.res
    const id = req.nextUrl.searchParams.get('id')?.slice(0, 64)
    if (!id) return bad('id wajib')
    await db.postComment.delete({ where: { id } })
    return ok({ deleted: true })
  } catch {
    return bad('Gagal menghapus komentar', 500)
  }
}
