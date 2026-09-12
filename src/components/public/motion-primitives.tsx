'use client'

// Primitif animasi portal publik (Gelombang MAGIC-01).
// Satu sumber koreografi agar seluruh section terasa dirancang bersama:
//  - SectionHeading : badge pop → judul kaskade per kata → garis emas menyapu → subjudul
//  - StaggerGroup/Item : kartu masuk beruntun (cascade) saat masuk viewport
//  - ScrollTopFab : tombol kembali ke atas dengan cincin progres scroll
//  - AmbientOrbs : bola cahaya melayang (dekorasi latar section)
// Semua menghormati prefers-reduced-motion (framer-motion useReducedMotion +
// media query CSS) dan viewport { once: true } agar tidak mengganggu saat scroll balik.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
  type Variants,
} from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const

/* ============================================================
   SectionHeading — judul section dengan koreografi kaskade kata
   ============================================================ */

const badgeVariant: Variants = {
  hidden: { opacity: 0, scale: 0.7, y: 8 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 320, damping: 22 },
  },
}

const wordVariant: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(5px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: EASE_OUT_EXPO },
  },
}

const fadeUpVariant: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT_EXPO } },
}

const headingContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
}

/** Tone badge → kelas warna (konsisten dengan palet lembaga). */
const TONES = {
  emerald: 'border-emerald-100 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  teal: 'border-teal-200 bg-teal-50 text-teal-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
} as const

export function SectionHeading({
  badge,
  title,
  subtitle,
  tone = 'emerald',
  className,
  id,
  align = 'center',
}: {
  badge: string
  title: ReactNode
  subtitle?: ReactNode
  tone?: keyof typeof TONES
  className?: string
  id?: string
  align?: 'center' | 'left'
}) {
  const reduced = useReducedMotion()
  const wrapAlign =
    align === 'left' ? cn('mb-10 max-w-2xl text-left', className) : cn('mx-auto mb-12 max-w-2xl text-center', className)
  const underlinePos = align === 'left' ? 'left-0 -translate-x-0' : 'left-1/2 -translate-x-1/2'

  // Judul string → dipecah per kata utk kaskade; ReactNode → dirender apa adanya.
  const words = typeof title === 'string' ? title.split(' ') : null

  if (reduced) {
    // Reduce-motion: tanpa koreografi — tampilan akhir langsung (tetap informatif).
    return (
      <div className={wrapAlign}>
        <span
          className={cn(
            'mb-3 block w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest',
            align === 'center' && 'mx-auto',
            TONES[tone],
          )}
        >
          {badge}
        </span>
        <h2 id={id} className="text-3xl font-bold tracking-tight text-stone-800">
          {title}
        </h2>
        {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
      </div>
    )
  }

  return (
    <motion.div
      data-slot="section-heading"
      variants={headingContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      className={wrapAlign}
    >
      <motion.span
        variants={badgeVariant}
        className={cn(
          'mb-3 block w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest',
          align === 'center' && 'mx-auto',
          TONES[tone],
        )}
      >
        {badge}
      </motion.span>

      <div className="relative inline-block">
        <h2 id={id} className="text-3xl font-bold tracking-tight text-stone-800">
          {words ? (
            words.map((word, i) => (
              <motion.span
                key={`${word}-${i}`}
                variants={wordVariant}
                className="inline-block will-change-transform"
              >
                {word}
                {i < words.length - 1 ? ' ' : ''}
              </motion.span>
            ))
          ) : (
            <motion.span variants={wordVariant} className="inline-block">
              {title}
            </motion.span>
          )}
        </h2>
        {/* Garis emas menyapu di bawah judul — "signature" Velora-nya portal */}
        <motion.span
          aria-hidden="true"
          className={cn(
            'absolute -bottom-1.5 h-1 w-16 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent sm:w-24',
            underlinePos,
          )}
          initial={{ scaleX: 0, opacity: 0 }}
          whileInView={{ scaleX: 1, opacity: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.7, delay: 0.35, ease: EASE_OUT_EXPO }}
        />
      </div>

      {subtitle && (
        <motion.p variants={fadeUpVariant} className="mt-3 text-muted-foreground">
          {subtitle}
        </motion.p>
      )}
    </motion.div>
  )
}

/* ============================================================
   StaggerGroup / StaggerItem — cascade kartu saat masuk viewport
   ============================================================ */

const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 34, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: EASE_OUT_EXPO },
  },
}

export function StaggerGroup({
  children,
  className,
  style,
  amount = 0.15,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
  amount?: number
}) {
  const reduced = useReducedMotion()
  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }
  return (
    <motion.div
      data-slot="stagger-group"
      className={cn('[will-change:transform]', className)}
      style={style}
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const reduced = useReducedMotion()
  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }
  return (
    <motion.div
      data-slot="stagger-item"
      className={cn('[will-change:transform]', className)}
      style={style}
      variants={staggerItem}
    >
      {children}
    </motion.div>
  )
}

/* ============================================================
   ScrollTopFab — kembali ke atas + cincin progres scroll
   ============================================================ */

export function ScrollTopFab() {
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(false)

  const { scrollYProgress } = useScroll()
  // Spring agar cincin terasa "mengalir", bukan loncat.
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 })

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 640)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const R = 20
  const C = 2 * Math.PI * R
  // Hook di body komponen — bukan di JSX kondisional (aturan hooks).
  const dashOffset = useTransform(progress, [0, 1], [C, 0])

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          data-slot="scroll-top-fab"
          aria-label="Kembali ke atas halaman"
          onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}
          initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.5, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.5, y: 18 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          whileHover={reduced ? undefined : { scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          className="fixed bottom-5 right-5 z-40 flex size-12 items-center justify-center rounded-full border border-emerald-200/70 bg-white/90 text-emerald-800 shadow-lg shadow-emerald-900/10 backdrop-blur transition-colors hover:bg-emerald-700 hover:text-white md:bottom-7 md:right-7"
        >
          {/* Cincin progres scroll — SVG di atas tombol */}
          <svg viewBox="0 0 48 48" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
            <circle cx="24" cy="24" r={R} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
            <motion.circle
              cx="24"
              cy="24"
              r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              style={{ strokeDashoffset: dashOffset as MotionValue<number> }}
            />
          </svg>
          <ArrowUp className="relative size-5" aria-hidden="true" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}

/* ============================================================
   AmbientOrbs — bola cahaya melayang (dekorasi latar section)
   ============================================================ */

export function AmbientOrbs({
  className,
  tone = 'emerald',
}: {
  className?: string
  tone?: 'emerald' | 'amber'
}) {
  const colors =
    tone === 'amber'
      ? ['bg-amber-400/10', 'bg-amber-300/[0.07]', 'bg-amber-400/[0.08]']
      : ['bg-emerald-400/10', 'bg-amber-400/[0.07]', 'bg-emerald-300/[0.08]']
  const positions = [
    'left-[4%] top-8 size-40',
    'right-[6%] top-24 size-56',
    'left-[38%] bottom-6 size-32',
  ]
  const delays = ['0s', '-6s', '-12s']
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {positions.map((pos, i) => (
        <span
          key={i}
          className={cn('absolute rounded-full blur-3xl float-slow', colors[i], pos)}
          style={{ animationDelay: delays[i] }}
        />
      ))}
    </div>
  )
}
