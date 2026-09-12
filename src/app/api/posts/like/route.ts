import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db, ok, bad } from '@/lib/api'
import { ensurePostLikeSchema } from '@/lib/blog/bootstrap'
import { rateLimit, clientIp } from '@/lib/rate-limit'
// Like artikel publik — gaya feed sosial media (Task 66).
// Tanpa login: pengunjung diidentifikasi visitorId (UUID acak di localStorage
// klien). Satu pasangan (postId, visitorId) = satu like (toggle).
export const dynamic = 'force-dynamic'

const likeSchema = z.object({
  postId: z.string().trim().min(1).max(64),
  visitorId: z.string().trim().min(8).max(64),
})

export async function POST(req: NextRequest) {
  try {
    await ensurePostLikeSchema()
    const body = await req.json().catch(() => null)
    const parsed = likeSchema.safeParse(body)
    if (!parsed.success) {
      return bad('Data tidak valid')
    }
    const { postId, visitorId } = parsed.data

    // Hardening patrol 2026-09-12: like tanpa limit sebelumnya → rentan flood
    // (rotasi visitorId menggelembungkan jumlah like & menghantam DB).
    // 20 toggle / menit / IP — cukup longgar untuk manusia, mematikan bot.
    if (!rateLimit(`like:${clientIp(req)}`, 20, 60_000)) {
      return bad('Terlalu banyak permintaan. Coba lagi sebentar lagi', 429)
    }

    const post = await db.post.findUnique({ where: { id: postId }, select: { id: true, published: true } })
    if (!post || !post.published) return bad('Artikel tidak ditemukan', 404)

    const existing = await db.postLike.findUnique({
      where: { postId_visitorId: { postId, visitorId } },
    })

    if (existing) {
      await db.postLike.delete({ where: { id: existing.id } })
    } else {
      try {
        await db.postLike.create({ data: { postId, visitorId } })
      } catch {
        // balapan dua toggle paralel → like sudah ada; anggap sukses like
      }
    }

    const count = await db.postLike.count({ where: { postId } })
    return ok({ liked: !existing, count })
  } catch (e) {
    console.error('[posts/like]', e)
    return bad('Gagal memproses like', 500)
  }
}
