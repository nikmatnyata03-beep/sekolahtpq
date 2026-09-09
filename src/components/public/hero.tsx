'use client'

// Hero — full-width emerald gradient with Islamic geometric pattern,
// Bismillah, headline, CTA buttons and live stat chips from /api/stats.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, GraduationCap, LogIn, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet } from '@/lib/api-client'
import type { DashboardStats } from '@/lib/types'
import { HijriDate } from './hijri-date'

/** 8-point star / diamond lattice — subtle Islamic geometric decoration. */
export function StarLattice({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width="56" height="56" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1.1">
            <rect x="16" y="16" width="24" height="24" />
            <path d="M28 12 L44 28 L28 44 L12 28 Z" />
            <circle cx="28" cy="28" r="1.5" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/** Angka statistik menghitung naik dari 0 (ease-out ~1.2s), berakhir tepat pada nilai. */
function useCountUp(target: number, duration = 1200): number {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!Number.isFinite(target) || target < 0) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setDisplay(progress < 1 ? Math.round(target * eased) : target)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return display
}

function CountUpValue({ value }: { value: number }) {
  const display = useCountUp(value)
  return <span className="block text-lg font-bold tabular-nums">{display}</span>
}

export function Hero({
  onOpenLogin,
  onNavigate,
}: {
  onOpenLogin: () => void
  onNavigate: (id: string) => void
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiGet<DashboardStats>('/api/stats')
      .then((data) => {
        if (!cancelled) setStats(data)
      })
      .catch(() => {
        // Statistik tidak kritis — tampilkan placeholder
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const chips = [
    { icon: Users, value: stats?.students ?? null, label: 'Santri Aktif' },
    { icon: GraduationCap, value: stats?.teachers ?? null, label: 'Ustadz & Ustadzah' },
    { icon: BookOpen, value: stats?.classes ?? null, label: 'Kelas Tersedia' },
  ]

  return (
    <section
      id="beranda"
      className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-emerald-700 text-white"
    >
      <StarLattice id="dj-hero-star" className="absolute inset-0 h-full w-full text-white opacity-[0.06]" />
      {/* soft glow accents */}
      <div className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 size-80 rounded-full bg-emerald-400/10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center md:py-24"
      >
        <p className="font-serif text-xl leading-relaxed text-amber-300 md:text-2xl" dir="rtl" lang="ar">
          بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
        </p>

        <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-300">
          Taman Pendidikan Al-Qur&apos;an
        </span>

        <HijriDate variant="dark" className="mt-4" />

        <h1 className="mt-4 text-4xl font-extrabold tracking-tight drop-shadow-sm sm:text-5xl md:text-6xl">
          TPQ Darul Jinan
        </h1>

        <p className="mt-5 max-w-2xl text-base leading-relaxed text-emerald-50/90 md:text-lg">
          Mendidik generasi Qur&apos;ani yang hafal, paham, dan berakhlak mulia — membimbing anak
          menumbuhkan cinta pada Al-Qur&apos;an sejak usia dini dengan bimbingan ustadz dan ustadzah
          tersertifikasi.
        </p>

        <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          <Button
            size="lg"
            className="w-full bg-amber-500 font-semibold text-emerald-950 shadow-lg shadow-amber-900/30 hover:bg-amber-400 sm:w-auto"
            onClick={() => onNavigate('ppdb')}
          >
            Daftar Santri Baru
            <ArrowRight className="size-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:w-auto"
            onClick={onOpenLogin}
          >
            <LogIn className="size-4" />
            Portal Wali
          </Button>
        </div>

        {/* Stat chips */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3" data-testid="hero-stats">
          {chips.map((chip) => (
            <div
              key={chip.label}
              className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 backdrop-blur-sm"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
                <chip.icon className="size-4.5" />
              </span>
              <span className="text-left leading-tight">
                {loading ? (
                  <Skeleton className="mb-1 h-5 w-10 bg-white/20" />
                ) : chip.value == null ? (
                  <span className="block text-lg font-bold">—</span>
                ) : (
                  <CountUpValue value={chip.value} />
                )}
                <span className="block text-[11px] font-medium text-emerald-100/80">{chip.label}</span>
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* gold accent bottom edge */}
      <div className="relative h-1.5 w-full bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
    </section>
  )
}
