// Penyimpanan gambar bersama (Task 33 — diekstrak dari /api/upload agar
// bukti foto izin/sakit bisa disimpan lewat jalur yang sama):
// - Cloudflare Workers: R2 binding UPLOADS → disajikan via /api/files/<nama>
// - Development lokal : public/uploads → disajikan via /uploads/<nama>
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { getCloudflareContext } from '@opennextjs/cloudflare'

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  // SVG SENGAJA DITOLAK (temuan pentest F-07): SVG dapat membawa <script>
  // (stored-XSS). Semua kebutuhan aplikasi adalah foto/kanvas raster.
}

const MAX_BYTES = 5 * 1024 * 1024

type R2Bucket = {
  put: (key: string, value: ArrayBuffer, opts?: Record<string, unknown>) => Promise<unknown>
}

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
 * Simpan data URL gambar (image/png|jpeg|webp|gif|svg+xml base64).
 * Return { url, bytes } atau { error } bila format/ukuran tidak sah.
 */
export async function saveImageFromDataUrl(
  dataUrl: string,
  namePrefix: string,
): Promise<{ url?: string; bytes?: number; error?: string }> {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/.exec(
    dataUrl,
  )
  if (!match) return { error: 'Format harus data URL gambar (PNG/JPG/WEBP/GIF)' }
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.length === 0) return { error: 'Berkas kosong' }
  if (buffer.length > MAX_BYTES) return { error: 'Ukuran gambar maksimal 5 MB' }

  const name = `${namePrefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.${MIME_EXT[match[1]]}`
  const r2 = getR2()
  if (r2) {
    await r2.put(`uploads/${name}`, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
    return { url: `/api/files/${name}`, bytes: buffer.length }
  }
  const dir = path.join(process.cwd(), 'public', 'uploads')
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, name), buffer)
  return { url: `/uploads/${name}`, bytes: buffer.length }
}
