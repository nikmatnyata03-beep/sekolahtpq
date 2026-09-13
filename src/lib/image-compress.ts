// Kompresi gambar sisi-klien sebelum unggah (QA LOOP-03, 2026-09-13).
//
// Temuan produksi: foto guru 1200x1600 PNG tersimpan apa adanya = 2,6 MB
// per berkas (`/api/files/...`), dibaca ulang pengunjung baru meski cache
// immutable. Rasterisasi ulang via canvas memangkasnya ~10x tanpa
// perbedaan visual pada ukuran tampil.
//
// Aturan:
//  - GIF/SVG: dilewati (animasi & vektor jangan dirasterisasi).
//  - < 80 KB: dilewati (sudah ringan, re-encode cuma buang waktu & mutu).
//  - Sisi terpanjang diskalakan maks. 1600 px; keluaran WebP kualitas 0.82
//    (alpha PNG tetap terjaga; browser lama tanpa WebP otomatis jatuh ke PNG).

const MAX_DIM = 1600
const QUALITY = 0.82
const SKIP_BELOW_BYTES = 80 * 1024

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Gagal membaca berkas'))
    reader.readAsDataURL(file)
  })
}

/** Kompres gambar menjadi data URL WebP (atau PNG bila WebP tak didukung). */
export async function compressImageToDataUrl(file: File): Promise<string> {
  const passthrough =
    file.type === 'image/gif' || file.type === 'image/svg+xml' || file.size < SKIP_BELOW_BYTES
  if (passthrough) return readAsDataUrl(file)

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    // Dekode gagal (format aneh) — kirim apa adanya, server akan memvalidasi.
    return readAsDataUrl(file)
  }

  try {
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return readAsDataUrl(file)
    ctx.drawImage(bitmap, 0, 0, w, h)
    return canvas.toDataURL('image/webp', QUALITY)
  } catch {
    return readAsDataUrl(file)
  } finally {
    bitmap.close()
  }
}
