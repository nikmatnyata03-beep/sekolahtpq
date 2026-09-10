import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

export async function GET(req: NextRequest) {
  const published = req.nextUrl.searchParams.get('published')
  const posts = await db.post.findMany({
    where: published === '1' ? { published: true } : {},
    include: { author: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return ok(posts)
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'GURU'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.title || !b.content) return bad('Judul dan konten wajib diisi')
    const baseSlug = slugify(b.title)
    const slugCount = await db.post.count({ where: { slug: { startsWith: baseSlug } } })
    const post = await db.post.create({
      data: {
        title: b.title,
        slug: slugCount > 0 ? `${baseSlug}-${slugCount + 1}` : baseSlug,
        content: b.content,
        category: b.category || 'BERITA',
        coverImage: b.coverImage || null,
        published: !!b.published,
        authorId: b.authorId || null,
      },
      include: { author: { select: { id: true, fullName: true } } },
    })
    return ok(post)
  } catch {
    return bad('Gagal membuat artikel')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'GURU'])
    if ('res' in g) return g.res
    const b = await req.json()
    if (!b.id) return bad('ID wajib')
    const post = await db.post.update({
      where: { id: b.id },
      data: {
        ...(b.title && { title: b.title }),
        ...(b.content && { content: b.content }),
        ...(b.category && { category: b.category }),
        ...(b.coverImage !== undefined && { coverImage: b.coverImage }),
        ...(b.published !== undefined && { published: b.published }),
        ...(b.authorId !== undefined && { authorId: b.authorId || null }),
      },
      include: { author: { select: { id: true, fullName: true } } },
    })
    return ok(post)
  } catch {
    return bad('Gagal memperbarui artikel')
  }
}

export async function DELETE(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'GURU'])
  if ('res' in g) return g.res
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return bad('ID wajib')
  await db.post.delete({ where: { id } })
  return ok({ success: true })
}
