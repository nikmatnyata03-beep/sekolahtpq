// Klien GPS absensi (Task 33) — hanya dipakai komponen 'use client'.
//
// 1. getGpsFix(): ambil posisi GPS presisi tinggi dgn pesan error Indonesia.
// 2. captureWithStamp(): potret bukti izin/sakit → kanvas → TIMESTAMP (WIB) +
//    koordinat GPS dicap PERMANEN pada gambar (watermark kamera), sehingga
//    foto surat tidak bisa dipisah dari waktu & tempat pemotretan.
//
// Catatan anti-fakeGPS: web tidak punya flag "mock location", jadi validasi
// kuat dilakukan SERVER (lihat src/lib/geo.ts) — klien hanya wajib kirim
// posisi fresh + akurasi; heuristik server yang memutuskan.

export interface GpsFix {
  lat: number
  lng: number
  accuracy: number | null
  posTs: number // epoch millis saat posisi diambil
}

export class GpsUnavailableError extends Error {
  code: 'denied' | 'unavailable' | 'timeout' | 'insecure' | 'unknown'
  constructor(code: GpsUnavailableError['code'], message: string) {
    super(message)
    this.code = code
  }
}

/**
 * Ambil satu pembacaan GPS presisi tinggi.
 * throw GpsUnavailableError dgn pesan siap-tampil ke pengguna.
 */
export function getGpsFix(opts?: { timeoutMs?: number }): Promise<GpsFix> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      reject(new GpsUnavailableError('unavailable', 'Perangkat ini tidak mendukung GPS/geolokasi.'))
      return
    }
    if (!window.isSecureContext) {
      reject(new GpsUnavailableError('insecure', 'GPS hanya aktif pada koneksi aman (HTTPS).'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
          posTs: pos.timestamp || Date.now(),
        })
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new GpsUnavailableError('denied', 'Izin lokasi ditolak. Aktifkan izin lokasi untuk situs ini di pengaturan browser, lalu coba lagi.'))
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          reject(new GpsUnavailableError('unavailable', 'Lokasi tidak dapat dideteksi. Pastikan layanan lokasi aktif, atau dekatkan diri ke area terbuka.'))
        } else {
          reject(new GpsUnavailableError('timeout', 'GPS lambat terkunci. Coba lagi di area terbuka.'))
        }
      },
      { enableHighAccuracy: true, timeout: opts?.timeoutMs ?? 15_000, maximumAge: 0 },
    )
  })
}

/** "-6.123456, 106.654321" — 6 desimal, koma desimal id-ID. */
export function formatCoords(lat: number, lng: number): string {
  const f = (n: number) => n.toFixed(6).replace('.', ',')
  return `${f(lat)}, ${f(lng)}`
}

/** "17/02/2026 15.47.33 WIB" — zona Asia/Jakarta agar konsisten dgn pesan WA. */
export function formatStampTime(d: Date): string {
  const t = d.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  return `${t} WIB`
}

export interface StampOptions {
  /** Baris pertama cap, mis. "SURAT IZIN — Ahmad Fathan Habibi" */
  label: string
  lat: number
  lng: number
  accuracy: number | null
  /** Waktu cap (default: sekarang) */
  at?: Date
}

/**
 * Muat berkas foto → gambar ke kanvas (maks lebar 1280 px) → cap teks
 * timestamp WIB + koordinat GPS + label pada pita gelap di bawah foto.
 * Return data URL JPEG (q≈0,75) — siap dikirim sebagai bukti.
 */
export async function captureWithStamp(file: File, opts: StampOptions): Promise<string> {
  const bitmap = await loadOrientedBitmap(file)
  const maxW = 1280
  const scale = Math.min(1, maxW / bitmap.width)
  const w = Math.round(bitmap.width * scale)
  const h = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Kanvas tidak didukung browser ini')
  ctx.drawImage(bitmap, 0, 0, w, h)
  if (typeof bitmap.close === 'function') bitmap.close()

  // ==== Pita cap ====
  const at = opts.at ?? new Date()
  const lines = [
    opts.label.slice(0, 60),
    formatStampTime(at),
    `GPS: ${formatCoords(opts.lat, opts.lng)}${opts.accuracy != null ? ` (±${Math.round(opts.accuracy)} m)` : ''}`,
  ]
  const fontSize = Math.max(12, Math.round(w * 0.026))
  const lineH = Math.round(fontSize * 1.45)
  const pad = Math.round(fontSize * 0.8)
  const barH = pad * 2 + lineH * lines.length

  const grad = ctx.createLinearGradient(0, h - barH - fontSize, 0, h)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.35, 'rgba(0,0,0,0.72)')
  grad.addColorStop(1, 'rgba(0,0,0,0.85)')
  ctx.fillStyle = grad
  ctx.fillRect(0, h - barH - fontSize, w, barH + fontSize)

  ctx.textBaseline = 'top'
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`
  ctx.fillText(lines[0], pad, h - barH + pad * 0.2)
  ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fillText(lines[1], pad, h - barH + pad * 0.2 + lineH)
  ctx.fillText(lines[2], pad, h - barH + pad * 0.2 + lineH * 2)

  // Watermark kecil di pojok kanan atas (branding + anti-rekayasa)
  ctx.font = `bold ${Math.max(11, Math.round(w * 0.022))}px system-ui, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.textAlign = 'right'
  ctx.shadowColor = 'rgba(0,0,0,0.8)'
  ctx.shadowBlur = 6
  ctx.fillText('SIMADJI • TPQ Darul Jinan', w - pad, pad)
  ctx.shadowBlur = 0
  ctx.textAlign = 'left'

  return canvas.toDataURL('image/jpeg', 0.75)
}

async function loadOrientedBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // imageOrientation:'from-image' hormati EXIF (foto HP sering rotasi)
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // fallback browser lama
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('Foto tidak dapat dibaca'))
        img.src = url
      })
      return img
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }
  }
}

/** Ukuran data URL (byte) — utk validasi sisi klien sebelum POST. */
export function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',')
  return i >= 0 ? Math.floor(((dataUrl.length - i - 1) * 3) / 4) : 0
}
