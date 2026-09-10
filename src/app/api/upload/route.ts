import { NextRequest } from 'next/server'
import { ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'
import { saveImageFromDataUrl } from '@/lib/storage'

/**
 * POST /api/upload — unggah gambar (foto guru, hero, tentang, logo).
 * Body JSON: { dataUrl: 'data:image/png;base64,...' }
 *
 * - Cloudflare Workers: disimpan ke R2 -> { url: '/api/files/<nama>' }
 * - Development lokal : disimpan ke public/uploads -> { url: '/uploads/<nama>' }
 */
export async function POST(req: NextRequest) {
  try {
    // Upload hanya untuk admin/guru (mencegah R2 dipakai hosting file orang lain).
    const g = await guard(req, ['ADMIN', 'GURU'])
    if ('res' in g) return g.res
    const body = (await req.json().catch(() => null)) as { dataUrl?: unknown } | null
    const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : ''
    if (!dataUrl) return bad('dataUrl wajib diisi')

    const res = await saveImageFromDataUrl(dataUrl, 'img')
    if (res.error || !res.url) return bad(res.error ?? 'Gagal mengunggah gambar')
    return ok({ url: res.url })
  } catch {
    return bad('Gagal mengunggah gambar')
  }
}
