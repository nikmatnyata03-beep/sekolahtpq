'use client'

// Ornamen & animasi arsitektur Islam untuk portal publik.
// Satu sumber komponen dekoratif: pola geometris, bintang khatam, lengkung
// mihrab, siluet masjid, reveal 3D saat scroll, dan parallax.

import { useRef, type ReactNode } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'

/** Kisi bintang 8 titik / wajik — dekorasi geometris Islami yang halus. */
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

/** Bintang khatam 8 titik (dua persegi berputar 45°) — SVG mandiri. */
export function KhatamStar({ className }: { className?: string }) {
  return (
    <svg viewBox="-12 -12 24 24" className={className} aria-hidden="true" focusable="false">
      <g fill="currentColor">
        <rect x="-8.5" y="-8.5" width="17" height="17" rx="1.6" />
        <rect x="-8.5" y="-8.5" width="17" height="17" rx="1.6" transform="rotate(45)" />
      </g>
      <circle r="2.6" fill="currentColor" className="opacity-40 mix-blend-multiply" />
    </svg>
  )
}

/** Pembatas ornamen: garis — bintang khatam — garis. */
export function OrnamentDivider({
  className,
  tone = 'emerald',
}: {
  className?: string
  tone?: 'emerald' | 'amber' | 'light'
}) {
  const line =
    tone === 'amber'
      ? 'from-transparent via-amber-400/70 to-transparent'
      : tone === 'light'
        ? 'from-transparent via-white/50 to-transparent'
        : 'from-transparent via-emerald-600/50 to-transparent'
  const star =
    tone === 'amber' ? 'text-amber-500' : tone === 'light' ? 'text-amber-300' : 'text-emerald-700'
  return (
    <motion.div
      className={cn('flex items-center justify-center gap-3', className)}
      aria-hidden="true"
      initial={{ opacity: 0, scaleX: 0.6 }}
      whileInView={{ opacity: 1, scaleX: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <span className={cn('h-px w-16 rounded-full bg-gradient-to-r sm:w-24', line)} />
      <KhatamStar className={cn('size-5 shrink-0 sm:size-6', star)} />
      <span className={cn('h-px w-16 rounded-full bg-gradient-to-r sm:w-24', line)} />
    </motion.div>
  )
}

/** Reveal 3D saat elemen masuk viewport — rotateX + y + scale (efek slide 3D). */
export function ScrollReveal({
  children,
  className,
  delay = 0,
  y = 44,
  rotate = 7,
  once = true,
}: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  rotate?: number
  once?: boolean
}) {
  return (
    <motion.div
      className={cn('[will-change:transform]', className)}
      style={{ transformPerspective: 1200 }}
      initial={{ opacity: 0, y, rotateX: rotate, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
      viewport={{ once, margin: '-70px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

/** Layer parallax vertikal mengikuti scroll (dari -from px ke +to px). */
export function ParallaxY({
  children,
  className,
  from = -36,
  to = 36,
}: {
  children: ReactNode
  className?: string
  from?: number
  to?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [from, to])
  return (
    <motion.div ref={ref} style={{ y }} className={cn('[will-change:transform]', className)}>
      {children}
    </motion.div>
  )
}

/** Siluet arsitektur masjid: kubah bawang, menara, puncak bintang — satu warna currentColor. */
export function MosqueSilhouette({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 200"
      preserveAspectRatio="xMidYMax meet"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <g fill="currentColor">
        {/* dasar bangunan */}
        <rect x="0" y="168" width="1200" height="32" />

        {/* menara kiri */}
        <g>
          <rect x="132" y="52" width="26" height="118" rx="3" />
          <rect x="124" y="96" width="42" height="8" rx="3" />
          <path d="M145 52 L132 24 L158 24 Z" />
          <rect x="141" y="10" width="8" height="8" transform="rotate(45 145 14)" />
        </g>

        {/* menara kanan */}
        <g>
          <rect x="1042" y="52" width="26" height="118" rx="3" />
          <rect x="1034" y="96" width="42" height="8" rx="3" />
          <path d="M1055 52 L1042 24 L1068 24 Z" />
          <rect x="1051" y="10" width="8" height="8" transform="rotate(45 1055 14)" />
        </g>

        {/* kubah kecil kiri */}
        <g>
          <path d="M262 168 Q262 96 322 96 Q382 96 382 168 Z" />
          <rect x="318" y="70" width="8" height="26" rx="3" />
          <rect x="317.5" y="60" width="9" height="9" transform="rotate(45 322 64.5)" />
        </g>

        {/* kubah kecil kanan */}
        <g>
          <path d="M818 168 Q818 96 878 96 Q938 96 938 168 Z" />
          <rect x="874" y="70" width="8" height="26" rx="3" />
          <rect x="873.5" y="60" width="9" height="9" transform="rotate(45 878 64.5)" />
        </g>

        {/* kubah utama (onion) + puncak */}
        <g>
          <path d="M470 168 Q470 78 600 46 Q730 78 730 168 Z" />
          <rect x="595" y="14" width="10" height="34" rx="4" />
          <rect x="592" y="2" width="16" height="16" transform="rotate(45 600 10)" />
        </g>

        {/* sayap bangunan */}
        <rect x="330" y="150" width="270" height="20" rx="4" />
        <rect x="600" y="150" width="270" height="20" rx="4" />
      </g>
    </svg>
  )
}

/** Kartu lengkung mihrab — bingkai ganda emas + garis dalam, sudut atas melengkung penuh. */
export function ArchFrame({
  children,
  className,
  innerClassName,
}: {
  children: ReactNode
  className?: string
  innerClassName?: string
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-b-3xl rounded-t-[9rem] border-2 border-amber-400/60 bg-white shadow-xl shadow-emerald-950/10',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-x-3 top-2.5 bottom-2.5 rounded-b-2xl rounded-t-[8.2rem] border border-emerald-900/10',
          innerClassName,
        )}
        aria-hidden="true"
      />
      <div className="relative">{children}</div>
    </div>
  )
}

/** Baris jendela arch kecil dekoratif (ukiran dinding masjid). */
export function ArchWindowsRow({ className, count = 5 }: { className?: string; count?: number }) {
  return (
    <div className={cn('flex items-end justify-center gap-2.5', className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="block w-2.5 rounded-t-full border border-current opacity-30"
          style={{ height: `${14 + (i % 2) * 8}px` }}
        />
      ))}
    </div>
  )
}
