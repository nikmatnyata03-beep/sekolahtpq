'use client'

/**
 * QR absensi berotasi (Task 41) — komponen UI untuk layar STAFF.
 *
 * - Kode QR berganti otomatis tiap 60 detik (sufiks HMAC per jendela waktu);
 *   foto/screenshot QR lama kehilangan nilai dalam ±90 detik.
 * - Kode segar DIMINTA DARI SERVER (endpoint staff-guarded
 *   /api/sessions/rot?code=...) — secret HMAC tidak pernah menyentuh klien.
 * - Ring countdown + label memandu ustadz bahwa QR selalu segar.
 * - Render awal memakai kode statis (aman SSR/hydration), lalu tertukar ke
 *   kode berotasi begitu fetch pertama sukses; tiap pergantian di-fade halus.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ShieldCheck } from 'lucide-react'
import { checkinUrl } from './overview'
import { apiGet } from '@/lib/api-client'
import { cn } from '@/lib/utils'

interface RotPayload {
  rotCode: string
  windowEndsAt: number
  windowSec: number
}

export function RotatingQr({
  code,
  size,
  compact = false,
  className,
}: {
  /** Kode sesi statis di database, mis. DJ-IQRA1-6R0G */
  code: string
  /** Ukuran QR dalam px */
  size: number
  /** Mode ringkas untuk thumbnail (tanpa label panjang) */
  compact?: boolean
  className?: string
}) {
  const [rotCode, setRotCode] = useState<string>(code) // statis dulu → aman hydration
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const endsAtRef = useRef<number>(0)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const data = await apiGet<RotPayload>(`/api/sessions/rot?code=${encodeURIComponent(code)}`)
      if (!mountedRef.current) return
      endsAtRef.current = data.windowEndsAt
      setRotCode(data.rotCode)
      setSecondsLeft(Math.max(0, Math.round((data.windowEndsAt - Date.now()) / 1000)))
    } catch {
      // gagal fetch: pertahankan kode terakhir (server masih menerima 1 jendela sebelumnya)
    }
  }, [code])

  useEffect(() => {
    mountedRef.current = true
    // Fetch awal lewat microtask agar tidak setState langsung di body effect
    const initial = setTimeout(() => void refresh(), 0)
    // Polling tiap 15 dtk + hitung mundur lokal tiap detik (toleran clock skew:
    // server menerima jendela berjalan + 1 sebelumnya).
    const poll = setInterval(() => void refresh(), 15_000)
    const tick = setInterval(() => {
      if (!endsAtRef.current) return
      const left = Math.max(0, Math.round((endsAtRef.current - Date.now()) / 1000))
      setSecondsLeft(left)
    }, 1000)
    return () => {
      mountedRef.current = false
      clearTimeout(initial)
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [refresh])

  const total = 60
  const progress = secondsLeft == null ? 1 : secondsLeft / total
  const urgent = secondsLeft != null && secondsLeft <= 10
  const R = 10
  const CIRC = 2 * Math.PI * R
  const ringPx = Math.max(26, Math.round(size * 0.17))

  return (
    <div className={cn('relative inline-flex flex-col items-center', className)}>
      <div className="relative inline-flex">
        <div className="rounded-2xl border border-stone-100 bg-white shadow-sm" style={{ padding: Math.max(4, Math.round(size * 0.04)) }}>
          <QRCodeSVG
            key={rotCode} /* remount tiap pergantian kode → animasi fade-in diputar ulang */
            value={checkinUrl(rotCode)}
            size={size}
            className="animate-in fade-in duration-500"
          />
        </div>
        {/* Ring countdown */}
        <div
          className={cn(
            'absolute -right-1.5 -top-1.5 rounded-full bg-white shadow ring-1',
            urgent ? 'ring-amber-300' : 'ring-emerald-200',
          )}
          style={{ width: ringPx, height: ringPx }}
          role="timer"
          aria-label={secondsLeft != null ? `Kode QR berganti dalam ${secondsLeft} detik` : 'Kode QR berotasi'}
        >
          <svg viewBox="0 0 24 24" className="size-full -rotate-90">
            <circle cx="12" cy="12" r={R} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-stone-100" />
            <circle
              cx="12"
              cy="12"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
              className={cn('transition-[stroke-dashoffset] duration-1000 ease-linear', urgent ? 'text-amber-500' : 'text-emerald-600')}
            />
          </svg>
          {secondsLeft != null && size >= 150 && (
            <span className={cn('absolute inset-0 flex items-center justify-center text-[9px] font-bold', urgent ? 'text-amber-600' : 'text-emerald-700')}>
              {secondsLeft}
            </span>
          )}
        </div>
      </div>
      {!compact && (
        <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-stone-500" aria-live="polite">
          <ShieldCheck className="size-3 text-emerald-600" aria-hidden="true" />
          QR berganti otomatis tiap menit — foto lama tidak berlaku
        </p>
      )}
    </div>
  )
}
