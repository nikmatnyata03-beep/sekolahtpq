'use client'

// Toolkit animasi portal publik (ANIM-UPGRADE-01).
// Satu sumber komponen motion berbasis framer-motion: heading section
// berkoreografi, reveal arah, stagger group, kartu tilt 3D, ornamen
// mengambang, counter in-view, indikator scroll, dan tombol kembali
// ke atas dengan cincin progres. Semua menghormati prefers-reduced-motion.

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* SectionHeading — badge pop + judul per-kata + tagline + garis aksen */
/* ------------------------------------------------------------------ */

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const

export function SectionHeading({
  badge,
  title,
  tagline,
  tone = 'emerald',
  badgeClassName,
  children,
  className,
}: {
  badge?: string
  title: string
  tagline?: ReactNode
  tone?: 'emerald' | 'amber'
  badgeClassName?: string
  /** Konten tambahan di bawah tagline (mis. tombol aksi). */
  children?: ReactNode
  className?: string
}) {
  const reduced = useReducedMotion()
  const words = title.split(' ')

  if (reduced) {
    // Versi statis untuk pengguna yang memilih mengurangi gerakan
    return (
      <div className={cn('mx-auto max-w-2xl text-center', className)}>
        {badge && (
          <span
            className={cn(
              'mb-3 inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest',
              tone === 'amber'
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : 'border-emerald-100 bg-emerald-50 text-emerald-700',
              badgeClassName,
            )}
          >
            {badge}
          </span>
        )}
        <h2 className="text-3xl font-bold tracking-tight text-stone-800">{title}</h2>
        {tagline && <p className="mt-3 text-muted-foreground">{tagline}</p>}
        {children}
      </div>
    )
  }

  return (
    <div className={cn('mx-auto max-w-2xl text-center', className)}>
      {badge && (
        <motion.span
          initial={{ opacity: 0, scale: 0.7, y: 8 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
          className={cn(
            'mb-3 inline-block rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest',
            tone === 'amber'
              ? 'border-amber-200 bg-amber-50 text-amber-700'
              : 'border-emerald-100 bg-emerald-50 text-emerald-700',
            badgeClassName,
          )}
        >
          {badge}
        </motion.span>
      )}

      <motion.h2
        className="text-3xl font-bold tracking-tight text-stone-800"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        aria-label={title}
      >
        <span className="sr-only">{title}</span>
        <span aria-hidden="true" className="inline-flex flex-wrap items-baseline justify-center gap-x-[0.3em]">
          {words.map((word, i) => (
            <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-1 align-bottom">
              <motion.span
                className="inline-block"
                variants={{
                  hidden: { opacity: 0, y: '110%', rotate: 4 },
                  show: {
                    opacity: 1,
                    y: '0%',
                    rotate: 0,
                    transition: { duration: 0.55, delay: 0.06 * i, ease: EASE_OUT_EXPO },
                  },
                }}
              >
                {word}
              </motion.span>
            </span>
          ))}
        </span>
        {/* Garis aksen yang "menggambar" dirinya saat judul masuk */}
        <motion.span
          aria-hidden="true"
          className="mx-auto mt-3 block h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-emerald-500"
          variants={{
            hidden: { scaleX: 0, opacity: 0 },
            show: {
              scaleX: 1,
              opacity: 1,
              transition: { duration: 0.7, delay: 0.08 * words.length, ease: EASE_OUT_EXPO },
            },
          }}
        />
      </motion.h2>

      {tagline && (
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
          className="mt-3 text-muted-foreground"
        >
          {tagline}
        </motion.p>
      )}
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Reveal — masuk viewport dari arah pilihan (up/left/right/zoom/flip) */
/* ------------------------------------------------------------------ */

const REVEAL_OFFSETS = {
  up: { y: 40, x: 0, scale: 1, rotateX: 0 },
  down: { y: -40, x: 0, scale: 1, rotateX: 0 },
  left: { y: 0, x: -44, scale: 1, rotateX: 0 },
  right: { y: 0, x: 44, scale: 1, rotateX: 0 },
  zoom: { y: 12, x: 0, scale: 0.9, rotateX: 0 },
  flip: { y: 24, x: 0, scale: 0.97, rotateX: 10 },
} as const

export function Reveal({
  children,
  className,
  direction = 'up',
  delay = 0,
  duration = 0.6,
  once = true,
  style,
}: {
  children: ReactNode
  className?: string
  direction?: keyof typeof REVEAL_OFFSETS
  delay?: number
  duration?: number
  once?: boolean
  style?: CSSProperties
}) {
  const reduced = useReducedMotion()
  const off = REVEAL_OFFSETS[direction]

  if (reduced) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      className={cn('[will-change:transform]', className)}
      style={{ transformPerspective: direction === 'flip' ? 1200 : undefined, ...style }}
      initial={{ opacity: 0, ...off }}
      whileInView={{ opacity: 1, y: 0, x: 0, scale: 1, rotateX: 0 }}
      viewport={{ once, margin: '-60px' }}
      transition={{ duration, delay, ease: EASE_OUT_EXPO }}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* StaggerGroup / StaggerItem — kartu masuk bergelombang saat in-view  */
/* ------------------------------------------------------------------ */

export function StaggerGroup({
  children,
  className,
  step = 0.08,
  delayChildren = 0.05,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  step?: number
  delayChildren?: number
  as?: 'div' | 'ul'
}) {
  const reduced = useReducedMotion()
  const Comp = as === 'ul' ? motion.ul : motion.div

  if (reduced) {
    return as === 'ul' ? (
      <ul className={className}>{children}</ul>
    ) : (
      <div className={className}>{children}</div>
    )
  }

  return (
    <Comp
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-50px' }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: step, delayChildren } },
      }}
    >
      {children}
    </Comp>
  )
}

export function StaggerItem({
  children,
  className,
  y = 28,
}: {
  children: ReactNode
  className?: string
  y?: number
}) {
  const reduced = useReducedMotion()

  if (reduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={cn('[will-change:transform]', className)}
      variants={{
        hidden: { opacity: 0, y, scale: 0.97 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: 0.55, ease: EASE_OUT_EXPO },
        },
      }}
    >
      {children}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* TiltCard — kartu miring 3D mengikuti pointer + kilau cahaya         */
/* ------------------------------------------------------------------ */

export function TiltCard({
  children,
  className,
  maxTilt = 7,
  glare = true,
}: {
  children: ReactNode
  className?: string
  maxTilt?: number
  glare?: boolean
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const px = useMotionValue(0.5)
  const py = useMotionValue(0.5)

  const spring = { stiffness: 260, damping: 22, mass: 0.6 }
  const rotateX = useSpring(useTransform(py, [0, 1], [maxTilt, -maxTilt]), spring)
  const rotateY = useSpring(useTransform(px, [0, 1], [-maxTilt, maxTilt]), spring)
  const glareBg = useTransform(
    [px, py],
    ([x, y]: number[]) =>
      `radial-gradient(320px circle at ${20 + x * 60}% ${20 + y * 60}%, rgba(251,191,36,0.16), transparent 65%)`,
  )

  if (reduced) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      className={cn('relative [transform-style:preserve-3d] [will-change:transform]', className)}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={(e) => {
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return
        px.set((e.clientX - rect.left) / rect.width)
        py.set((e.clientY - rect.top) / rect.height)
      }}
      onPointerLeave={() => {
        px.set(0.5)
        py.set(0.5)
      }}
    >
      {children}
      {glare && (
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: glareBg }}
        />
      )}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/* FloatingOrbs — blob gradien ambient yang mengambang pelan (loop)    */
/* ------------------------------------------------------------------ */

export function FloatingOrbs({ className }: { className?: string }) {
  const reduced = useReducedMotion()
  if (reduced) return null

  const orbs = [
    { cls: '-left-16 top-8 size-72 bg-amber-400/15', dur: 9, drift: 26 },
    { cls: 'right-[8%] top-1/4 size-56 bg-emerald-400/15', dur: 11, drift: -32 },
    { cls: 'left-[30%] bottom-6 size-80 bg-amber-300/10', dur: 13, drift: 40 },
    { cls: '-right-10 bottom-10 size-64 bg-teal-300/10', dur: 10, drift: -24 },
  ]

  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {orbs.map((o, i) => (
        <motion.div
          key={i}
          className={cn('absolute rounded-full blur-3xl', o.cls)}
          animate={{ y: [0, o.drift, 0], x: [0, o.drift * 0.4, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: o.dur, repeat: Infinity, ease: 'easeInOut', delay: i * 1.2 }}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* InViewCountUp — angka menghitung naik saat elemen masuk viewport    */
/* ------------------------------------------------------------------ */

export function InViewCountUp({
  value,
  duration = 1.3,
  className,
}: {
  value: number
  duration?: number
  className?: string
}) {
  const reduced = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInViewport(ref)
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView || !Number.isFinite(value) || value < 0) return
    if (reduced) {
      // requestAnimationFrame: hindari setState sinkron dalam effect (React 19 lint)
      const raf0 = requestAnimationFrame(() => setDisplay(value))
      return () => cancelAnimationFrame(raf0)
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / (duration * 1000), 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(p < 1 ? Math.round(value * eased) : value)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, duration, reduced])

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {display}
    </span>
  )
}

/** Hook kecil: apakah elemen sedang dalam viewport (sekali masuk). */
function useInViewport(ref: React.RefObject<Element | null>): boolean {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      // requestAnimationFrame: hindari setState sinkron dalam effect (React 19 lint)
      const raf0 = requestAnimationFrame(() => setInView(true))
      return () => cancelAnimationFrame(raf0)
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '-40px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return inView
}

/* ------------------------------------------------------------------ */
/* ScrollCue — indikator "gulir ke bawah" dengan animasi memantul       */
/* ------------------------------------------------------------------ */

export function ScrollCue({ label = 'Gulir ke bawah', onClick }: { label?: string; onClick?: () => void }) {
  const reduced = useReducedMotion()
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group absolute inset-x-0 bottom-4 z-10 mx-auto hidden w-max flex-col items-center gap-1 text-white/70 transition-colors hover:text-amber-300 sm:flex"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.25em]">{label}</span>
      <motion.span
        animate={reduced ? undefined : { y: [0, 7, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        className="flex size-8 items-center justify-center rounded-full border border-white/30 bg-white/5 backdrop-blur-sm"
      >
        <svg viewBox="0 0 16 16" className="size-3.5 fill-current" aria-hidden="true">
          <path d="M8 12.2 2.4 6.6l1.2-1.2L8 9.8l4.4-4.4 1.2 1.2L8 12.2z" />
        </svg>
      </motion.span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* ScrollTopButton — muncul setelah scroll, cincin progres scroll      */
/* ------------------------------------------------------------------ */

export function ScrollTopButton() {
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll()
  const visible = useTransform(scrollYProgress, [0.08, 0.14], [0, 1])
  const scale = useTransform(visible, [0, 1], [0.6, 1])
  const pointerEvents = useTransform(visible, [0, 0.5, 1], ['none', 'auto', 'auto'])
  const pathLength = useSpring(scrollYProgress, { stiffness: 120, damping: 24 })

  return (
    <motion.button
      type="button"
      aria-label="Kembali ke atas"
      onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}
      style={{ opacity: visible, scale, pointerEvents }}
      className="fixed bottom-5 right-5 z-40 flex size-11 items-center justify-center rounded-full border border-emerald-200 bg-white/95 shadow-lg shadow-emerald-900/10 backdrop-blur transition-colors hover:bg-emerald-50"
    >
      <svg viewBox="0 0 44 44" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-100" />
        <motion.circle
          cx="22"
          cy="22"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={1}
          style={{ pathLength }}
          className="text-emerald-600"
        />
      </svg>
      <ArrowUp className="size-4.5 text-emerald-800" aria-hidden="true" />
    </motion.button>
  )
}
