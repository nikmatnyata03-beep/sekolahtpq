import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { getSession, guard } from '@/lib/session'

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
}

export async function GET(req: NextRequest) {
  const session = await getSession(req)
  const published = req.nextUrl.searchParams.get('published')
  const where = session?.role === 'ADMIN' || session?.role === 'DEVELOPER'
    ? published === '1' ? { published: true } : {}
    : session?.role === 'GURU'
      ? published === '1'
        ? { published: true }
        : { OR: [{ published: true }, { authorId: session.teacherId ?? '__no_teacher__' }] }
      : { published: true }
  const posts = await db.post.findMany({
    where,
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
    if (g.session.role === 'GURU' && !g.session.teacherId) return bad('Akun guru belum terhubung ke profil guru', 403)
    // Temuan pentest F-06: publikasi artikel = wewenang admin. Guru mengirim
    // draf; admin yang menerbitkan.
    if (g.session.role === 'GURU' && b.published) {
      return bad('Publikasi artikel memerlukan persetujuan admin. Artikel akan tersimpan sebagai draf.', 403)
    }
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
        authorId: g.session.role === 'GURU' ? g.session.teacherId : b.authorId || null,
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
    const existing = await db.post.findUnique({ where: { id: String(b.id) }, select: { authorId: true } })
    if (!existing) return bad('Artikel tidak ditemukan', 404)
    if (g.session.role === 'GURU' && existing.authorId !== g.session.teacherId) return bad('Anda bukan penulis artikel ini', 403)
    // Temuan pentest F-06: guru tidak dapat menerbitkan/menarik publikasi sendiri
    // (field published diabaikan utk guru — hanya admin yang bisa mengubahnya)
    const post = await db.post.update({
      where: { id: b.id },
      data: {
        ...(b.title && { title: b.title }),
        ...(b.content && { content: b.content }),
        ...(b.category && { category: b.category }),
        ...(b.coverImage !== undefined && { coverImage: b.coverImage }),
        ...(b.published !== undefined && g.session.role !== 'GURU' && { published: b.published }),
        ...(g.session.role === 'ADMIN' && b.authorId !== undefined && { authorId: b.authorId || null }),
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
  const existing = await db.post.findUnique({ where: { id }, select: { authorId: true } })
  if (!existing) return bad('Artikel tidak ditemukan', 404)
  if (g.session.role === 'GURU' && existing.authorId !== g.session.teacherId) return bad('Anda bukan penulis artikel ini', 403)
  await db.post.delete({ where: { id } })
  return ok({ success: true })
}
