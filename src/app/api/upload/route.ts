import { NextRequest } from 'next/server'
import { ok, bad } from '@/lib/api'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

const MAX_BYTES = 5 * 1024 * 1024

/**
 * POST /api/upload — unggah gambar (foto guru, hero, tentang, logo).
 * Body JSON: { dataUrl: 'data:image/png;base64,...' }
 * → { url: '/uploads/<nama>.<ext>' } — disimpan di public/uploads.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { dataUrl?: unknown } | null
    const dataUrl = typeof body?.dataUrl === 'string' ? body.dataUrl : ''

    const match = /^data:(image\/(?:png|jpeg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$/.exec(
      dataUrl,
    )
    if (!match) return bad('Format harus data URL gambar (PNG/JPG/WEBP/GIF/SVG)')

    const buffer = Buffer.from(match[2], 'base64')
    if (buffer.length === 0) return bad('Berkas kosong')
    if (buffer.length > MAX_BYTES) return bad('Ukuran gambar maksimal 5 MB')

    const dir = path.join(process.cwd(), 'public', 'uploads')
    await mkdir(dir, { recursive: true })

    const name = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${MIME_EXT[match[1]]}`
    await writeFile(path.join(dir, name), buffer)

    return ok({ url: `/uploads/${name}` })
  } catch {
    return bad('Gagal mengunggah gambar')
  }
}
