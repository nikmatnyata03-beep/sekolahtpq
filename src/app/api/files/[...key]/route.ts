import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { readFile } from 'fs/promises'
import path from 'path'

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

type R2ObjectBody = {
  arrayBuffer: () => Promise<ArrayBuffer>
}

type R2Bucket = {
  get: (key: string) => Promise<R2ObjectBody | null>
}

/**
 * GET /api/files/<nama> — sajikan gambar yang tersimpan di R2 (produksi).
 * Di `next dev` (tanpa workerd), fallback membaca public/uploads dari disk
 * sehingga URL dari editor admin tetap berfungsi di kedua mode.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params
  const name = (key ?? []).join('/')

  // hanya nama berkas sederhana, tanpa path traversal
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes('..')) {
    return NextResponse.json({ error: 'Nama berkas tidak valid' }, { status: 400 })
  }

  const ext = (name.split('.').pop() ?? '').toLowerCase()
  const contentType = MIME[ext] ?? 'application/octet-stream'

  try {
    const { env } = getCloudflareContext()
    const bucket = (env as Record<string, unknown> | undefined)?.UPLOADS as R2Bucket | undefined
    if (bucket) {
      const obj = await bucket.get(`uploads/${name}`)
      if (!obj) return NextResponse.json({ error: 'Berkas tidak ditemukan' }, { status: 404 })
      const buf = await obj.arrayBuffer()
      return new NextResponse(buf, {
        headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
      })
    }
  } catch {
    // bukan di workerd -> fallback lokal di bawah
  }

  try {
    const file = await readFile(path.join(process.cwd(), 'public', 'uploads', name))
    return new NextResponse(new Uint8Array(file), {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'Berkas tidak ditemukan' }, { status: 404 })
  }
}
