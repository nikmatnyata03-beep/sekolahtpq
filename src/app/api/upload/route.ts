import { NextRequest } from 'next/server'
import { ok, bad } from '@/lib/api'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { guard } from '@/lib/session'

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

const MAX_BYTES = 5 * 1024 * 1024

type R2Bucket = {
  put: (key: string, value: ArrayBuffer, opts?: Record<string, unknown>) => Promise<unknown>
}

/**
 * Ambil binding R2 "UPLOADS" saat berjalan di Cloudflare Workers.
 * Mengembalikan null saat `next dev` biasa (di luar workerd).
 */
function getR2(): R2Bucket | null {
  try {
    const { env } = getCloudflareContext()
    const bucket = (env as Record<string, unknown> | undefined)?.UPLOADS
    return bucket ? (bucket as R2Bucket) : null
  } catch {
    return null
  }
}

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

    const match = /^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/.exec(
      dataUrl,
    )
    if (!match) return bad('Format harus data URL gambar (PNG/JPG/WEBP/GIF/SVG)')

    const buffer = Buffer.from(match[2], 'base64')
    if (buffer.length === 0) return bad('Berkas kosong')
    if (buffer.length > MAX_BYTES) return bad('Ukuran gambar maksimal 5 MB')

    const name = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${MIME_EXT[match[1]]}`
    const r2 = getR2()

    if (r2) {
      await r2.put(`uploads/${name}`, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
      return ok({ url: `/api/files/${name}` })
    }

    const dir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, name), buffer)

    return ok({ url: `/uploads/${name}` })
  } catch {
    return bad('Gagal mengunggah gambar')
  }
}
