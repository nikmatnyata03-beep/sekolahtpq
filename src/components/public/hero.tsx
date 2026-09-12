'use client'

// Hero — komposisi artistik arsitektur Islam untuk sambutan portal publik:
// latar ilustrasi masjid (dapat diganti dari CMS) dengan parallax dua lapis
// (latar bergerak lebih lambat daripada konten = rasa kedalaman 3D), pola
// geometris, siluet masjid, koreografi masuk berjenjang, serta efek
// slide-scroll 3D (fade + scale konten terikat scroll).
// Konten (bismillah, badge, judul, tagline, logo, latar, statistik) dibaca
// dari /api/settings via usePortalSettings — aman hidrasi (paint awal = default).

import { useEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, BookOpen, GraduationCap, LogIn, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet } from '@/lib/api-client'
import type { DashboardStats } from '@/lib/types'
import { usePortalSettings } from '@/hooks/use-portal-settings'
import { MosqueSilhouette, ParallaxY, StarLattice } from './ornaments'
import { HijriDate } from './hijri-date'

// Re-export: about-section & footer masih mengimpor StarLattice dari './hero'.
export { StarLattice } from './ornaments'

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
  return <span className="block text-xl font-bold tabular-nums">{display}</span>
}

/** Koreografi masuk berjenjang — fade + naik dengan delay konsisten. */
const riseIn = (delay: number) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: 'easeOut' as const },
})

export function Hero({
  onOpenLogin,
  onNavigate,
}: {
  onOpenLogin: () => void
  onNavigate: (id: string) => void
}) {
  const { settings } = usePortalSettings()
  const hero = settings.hero
  const brand = settings.theme?.primary ?? '#047857'

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiGet<Pick<DashboardStats, 'students' | 'teachers' | 'classes'>>('/api/public/stats')
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

  // Slide-scroll 3D: saat hero bergulir keluar, konten memudar + mengecil.
  const sectionRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const contentOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0.4])
  const contentScale = useTransform(scrollYProgress, [0, 1], [1, 0.96])

  // Gelombang 14 (#16 slice): kedalaman interaktif — posisi kursor dinormalisasi ke
  // --tilt-x/--tilt-y (rentang -1..1) pada section; CSS memetakannya ke pergeseran
  // per lapisan (lihat .hero-tilt-* di globals.css). rAF-throttle agar hemat; hanya
  // pointer halus (mouse) dan dihormati prefers-reduced-motion — sentuh = statis.
  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!finePointer.matches || reducedMotion.matches) return
    let raf = 0
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--tilt-x', nx.toFixed(3))
        el.style.setProperty('--tilt-y', ny.toFixed(3))
      })
    }
    const onLeave = () => {
      cancelAnimationFrame(raf)
      el.style.setProperty('--tilt-x', '0')
      el.style.setProperty('--tilt-y', '0')
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
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
      ref={sectionRef}
      className="relative overflow-hidden text-white"
      style={{
        // Task 62 — gradien hero mengikuti warna merek CMS (var --brand dipasang
        // di akar portal; fallback emerald bila tema belum tersedia).
        backgroundImage: `linear-gradient(to bottom right, color-mix(in srgb, ${brand} 85%, black), color-mix(in srgb, ${brand} 92%, black) 45%, ${brand})`,
      }}
    >
      {/* ===== Layer 0 — latar ilustrasi masjid (CMS) + overlay kontras, parallax kedalaman ===== */}
      <div aria-hidden="true" className="absolute inset-0">
        {hero.backgroundUrl && (
          <ParallaxY from={-20} to={20} className="absolute inset-x-0 -bottom-16 -top-16">
            {/* <img> sengaja dipakai (bukan next/image) agar latar CMS bebas konfigurasi domain */}
            <img
              src={hero.backgroundUrl}
              alt=""
              draggable={false}
              className="h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                // Overlay kontras: gelap kiri-atas → brand kanan-bawah agar foto CMS tetap terbaca.
                backgroundImage: `linear-gradient(to bottom right, rgba(0, 0, 0, 0.72), color-mix(in srgb, ${brand} 78%, black))`,
              }}
            />
          </ParallaxY>
        )}
      </div>

      {/* ===== Layer 1 — pola geometris, cahaya lembut, siluet masjid =====
           Gelombang 9 (#15): ornamen scroll-driven (CSS animation-timeline, nol JS) —
           lapisan jauh/dekat tenggelam dengan kecepatan beda = kedalaman parallax murni CSS. */}
      <StarLattice
        id="dj-hero-star"
        className="hero-lattice hero-tilt-far absolute inset-0 h-full w-full text-white opacity-[0.07]"
      />
      <div
        className="hero-tilt-mid pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-amber-400/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="hero-tilt-mid pointer-events-none absolute -right-24 bottom-0 size-80 rounded-full bg-emerald-400/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="hero-tilt-far pointer-events-none absolute right-[14%] top-1/3 size-64 rounded-full bg-amber-300/[0.06] blur-3xl"
        aria-hidden="true"
      />
      {/* Siluet skyline ganda: lapis putih samar di belakang (jauh) + zamrud gelap di depan.
          Gelombang 14: masing-masing dibungkus lapisan tilt pointer (kedalaman interaktif) —
          pembungkus transform, anak tetap scroll-driven (keduanya komposisi elemen beda). */}
      <div className="hero-tilt-far pointer-events-none absolute inset-0" aria-hidden="true">
        <MosqueSilhouette
          className="hero-sink-far pointer-events-none absolute -bottom-2 left-1/2 w-[140%] max-w-none -translate-x-1/2 text-white/[0.05]"
          aria-hidden="true"
        />
      </div>
      <div className="hero-tilt-near pointer-events-none absolute inset-0" aria-hidden="true">
        <MosqueSilhouette
          className="hero-sink-near pointer-events-none absolute inset-x-0 bottom-0 h-auto w-full"
          style={{ color: `color-mix(in srgb, ${brand} 55%, black)` }}
          aria-hidden="true"
        />
      </div>

      {/* ===== Layer konten — slide-scroll 3D (fade + scale) + parallax lambat ===== */}
      <motion.div
        style={{ opacity: contentOpacity, scale: contentScale }}
        className="relative z-10 [will-change:transform]"
      >
        <ParallaxY from={-8} to={24} className="relative">
          <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center md:py-24">
            {/* Emblem lembaga dari CMS (hanya bila logoUrl diisi) */}
            {hero.logoUrl && (
              <motion.img
                {...riseIn(0)}
                src={hero.logoUrl}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="mb-5 size-14 rounded-2xl object-cover shadow-lg shadow-emerald-950/50 ring-2 ring-amber-400/80 md:size-16"
              />
            )}

            <motion.p
              {...riseIn(0.05)}
              dir="rtl"
              lang="ar"
              className="font-serif text-xl leading-relaxed text-amber-300 drop-shadow-[0_0_14px_rgba(251,191,36,0.35)] md:text-2xl"
            >
              {hero.bismillah}
            </motion.p>

            <motion.span
              {...riseIn(0.15)}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-amber-300"
            >
              {hero.badge}
            </motion.span>

            <motion.div {...riseIn(0.2)}>
              <HijriDate variant="dark" className="mt-4" />
            </motion.div>

            {/* Gelombang 9 (#15): tipografi display — ukuran clamp besar, leading rapat,
                gradasi putih→emas di teks (karakter "signature" portal publik) */}
            <motion.h1
              initial={{ opacity: 0, y: 30, rotateX: 12 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
              style={{ transformPerspective: 900 }}
              className="mt-4 bg-gradient-to-b from-white via-white to-amber-100/95 bg-clip-text text-[clamp(2.25rem,7vw,4.5rem)] font-extrabold leading-[1.06] tracking-tight text-transparent drop-shadow-sm"
            >
              {hero.title}
            </motion.h1>

            <motion.p
              {...riseIn(0.35)}
              className="mt-5 max-w-2xl text-base leading-relaxed text-emerald-50/90 md:text-lg"
            >
              {hero.tagline}
            </motion.p>

            <motion.div
              {...riseIn(0.45)}
              className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row"
            >
              <Button
                size="lg"
                className="min-h-11 w-full font-semibold text-white shadow-lg hover:opacity-90 sm:w-auto"
                style={{ backgroundColor: 'var(--brand-accent)', boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent) 40%, transparent)' }}
                onClick={() => onNavigate('ppdb')}
              >
                Daftar Santri Baru
                <ArrowRight className="size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-h-11 w-full border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:w-auto"
                onClick={onOpenLogin}
              >
                <LogIn className="size-4" />
                Portal Wali
              </Button>
            </motion.div>

            {/* Stat chips — sembunyikan seluruh blok bila dimatikan dari CMS */}
            {hero.showStats && (
              <motion.div
                {...riseIn(0.5)}
                className="mt-12 flex flex-wrap items-center justify-center gap-3"
                data-testid="hero-stats"
              >
                {chips.map((chip) => (
                  <div
                    key={chip.label}
                    className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-2.5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300/40 hover:bg-white/15"
                  >
                    <span className="flex size-9 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
                      <chip.icon className="size-4.5" />
                    </span>
                    <span className="text-left leading-tight">
                      {loading ? (
                        <Skeleton className="mb-1 h-5 w-10 bg-white/20" />
                      ) : chip.value == null ? (
                        <span className="block text-xl font-bold">—</span>
                      ) : (
                        <CountUpValue value={chip.value} />
                      )}
                      <span className="block text-[11px] font-medium text-emerald-100/80">
                        {chip.label}
                      </span>
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </ParallaxY>
      </motion.div>

      {/* gold accent bottom edge */}
      <div className="relative z-10 h-1.5 w-full bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
    </section>
  )
}
