'use client'

// Hijri date chip — menghitung tanggal Hijriah hari ini tanpa dependensi
// tambahan memakai Intl (kalender islamic-umalqura). Render diam-diam jadi
// null bila runtime tidak mendukung kalender tersebut.

import { useState } from 'react'
import { MoonStar } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Resolusi tanggal Hijriah, contoh: "14 Rabiulawal 1448 H". */
function resolveHijriDate(): string | null {
  try {
    const text = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date())
    const trimmed = text.trim()
    // Sebagian runtime menyertakan era "H", sebagian tidak — normalisasi.
    return /\bH$/i.test(trimmed) ? trimmed : `${trimmed} H`
  } catch {
    return null
  }
}

export function HijriDate({
  className,
  variant = 'light',
}: {
  className?: string
  variant?: 'dark' | 'light'
}) {
  // Dihitung sekali per mount; suppressHydrationWarning untuk mismatch
  // kecil ICU antara server dan browser (lintas tengah malam / versi ICU).
  const [today] = useState(resolveHijriDate)

  if (!today) return null

  return (
    <span
      suppressHydrationWarning
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium shadow-sm backdrop-blur-sm',
        variant === 'dark'
          ? 'border-white/20 bg-white/10 text-amber-200'
          : 'border-emerald-200 bg-white text-emerald-800',
        className,
      )}
    >
      <MoonStar className="size-4 shrink-0" aria-hidden="true" />
      <span suppressHydrationWarning>{today}</span>
    </span>
  )
}
