'use client'

// Komponen unggah gambar reusable untuk admin — foto guru, hero, tentang, logo.
// Membaca file → data URL → POST /api/upload → mengembalikan URL publik.

import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiSend } from '@/lib/api-client'
import { cn } from '@/lib/utils'

export function ImageUpload({
  url,
  onChange,
  label,
  aspect = 'square',
  className,
  disabled,
}: {
  url: string
  onChange: (url: string) => void
  label?: string
  aspect?: 'square' | 'video'
  className?: string
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setError(null)
    if (!file.type.startsWith('image/')) {
      setError('Berkas harus berupa gambar')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ukuran gambar maksimal 5 MB')
      return
    }
    setBusy(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Gagal membaca berkas'))
        reader.readAsDataURL(file)
      })
      const res = await apiSend<{ url: string }>('/api/upload', 'POST', { dataUrl })
      onChange(res.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengunggah gambar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {label && <p className="text-sm font-medium text-stone-700">{label}</p>}
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border-2 border-dashed border-stone-300 bg-stone-50',
          aspect === 'square' ? 'aspect-square max-w-40' : 'aspect-video',
        )}
      >
        {url ? (
          <img src={url} alt={label ?? 'Pratinjau gambar'} className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1.5 text-stone-400">
            <ImagePlus className="size-6" />
            <span className="text-xs">Belum ada gambar</span>
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="size-5 animate-spin text-emerald-700" aria-label="Mengunggah" />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleFile(f)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
          disabled={busy || disabled}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="size-4" />
          {url ? 'Ganti Gambar' : 'Pilih Gambar'}
        </Button>
        {url && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={busy || disabled}
            onClick={() => onChange('')}
          >
            <Trash2 className="size-4" />
            Hapus
          </Button>
        )}
        <span className="text-xs text-stone-400">PNG/JPG/WEBP/GIF/SVG · maks 5 MB</span>
      </div>
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
