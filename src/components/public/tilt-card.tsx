'use client'

// TiltCard — kartu interaktif 3D (perspektif CSS via framer-motion):
// mengikuti arah pointer dengan rotateX/rotateY berpegas + kilau (glare)
// radial yang bergerak. Otomatis menonaktifkan diri pada perangkat sentuh
// dan pengguna prefers-reduced-motion (render kartu biasa, nol transform).

import { useRef, type ReactNode } from 'react'
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from 'framer-motion'
import { cn } from '@/lib/utils'

export function TiltCard({
  children,
  className,
  max = 9,
  lift = 4,
}: {
  children: ReactNode
  className?: string
  /** derajat kemiringan maksimum */
  max?: number
  /** angkat kartu saat hover (px); 0 = tanpa angkat */
  lift?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const enabledRef = useRef(false)

  const rawRX = useMotionValue(0)
  const rawRY = useMotionValue(0)
  const rx = useSpring(rawRX, { stiffness: 200, damping: 20, mass: 0.4 })
  const ry = useSpring(rawRY, { stiffness: 200, damping: 20, mass: 0.4 })
  const rawGlare = useMotionValue(0)
  const glareOpacity = useSpring(rawGlare, { stiffness: 180, damping: 24 })
  const glareX = useSpring(useMotionValue(50), { stiffness: 200, damping: 22 })
  const glareY = useSpring(useMotionValue(50), { stiffness: 200, damping: 22 })
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.30), rgba(255,255,255,0.08) 42%, transparent 65%)`

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabledRef.current) return
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    rawRY.set((nx - 0.5) * 2 * max)
    rawRX.set(-(ny - 0.5) * 2 * max)
    glareX.set(nx * 100)
    glareY.set(ny * 100)
  }

  const onLeave = () => {
    enabledRef.current = false
    rawRX.set(0)
    rawRY.set(0)
    rawGlare.set(0)
  }

  // Aktif hanya pointer halus (mouse) & hormati prefers-reduced-motion.
  const onEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    enabledRef.current =
      e.pointerType === 'mouse' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (enabledRef.current) rawGlare.set(1)
  }

  return (
    <motion.div
      ref={ref}
      onPointerEnter={onEnter}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ transformPerspective: 900, rotateX: rx, rotateY: ry }}
      whileHover={lift ? { y: -lift } : undefined}
      className={cn('relative [will-change:transform]', className)}
    >
      {children}
      {/* lapisan kilau mengikuti kursor */}
      <motion.span
        aria-hidden="true"
        style={{ background: glare, opacity: glareOpacity }}
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
      />
    </motion.div>
  )
}
