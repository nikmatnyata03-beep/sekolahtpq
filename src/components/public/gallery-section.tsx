'use client'

// Galeri Kegiatan portal publik — foto kegiatan dari CMS /api/settings
// (admin mengelola via Editor Landing Page → tab Galeri).
// Grid responsif + lightbox ringan (navigasi panah, tombol Escape, kunci scroll).

import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, ChevronLeft, ChevronRight, Images, X } from 'lucide-react'
import { usePortalSettings } from '@/hooks/use-portal-settings'
import { cn } from '@/lib/utils'
import { ScrollReveal } from './ornaments'
import { TiltCard } from './tilt-card'

export function GallerySection() {
  const { settings } = usePortalSettings()
  const items = settings.gallery
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const close = useCallback(() => setOpenIndex(null), [])
  const step = useCallback(
    (dir: -1 | 1) => {
      setOpenIndex((cur) => (cur === null ? cur : (cur + dir + items.length) % items.length))
    },
    [items.length],
  )

  // Kontrol keyboard + kunci scroll saat lightbox terbuka.
  useEffect(() => {
    if (openIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowLeft') step(-1)
      if (e.key === 'ArrowRight') step(1)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [openIndex, close, step])

  return (
    <section id="galeri" className="scroll-mt-20 bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        {/* Heading */}
        <ScrollReveal className="mx-auto mb-12 max-w-2xl text-center">
          <span className="mb-3 inline-block rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700">
            Galeri
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-stone-800">Galeri Kegiatan</h2>
          <p className="mt-3 text-muted-foreground">
            Sekilas suasana belajar dan bermain di TPQ Darul Jinan — halaqah Al-Qur&apos;an, latihan
            shalat berjamaah, hingga kegiatan luar kelas yang penuh kegembiraan.
          </p>
        </ScrollReveal>

        {items.length === 0 ? (
          /* Edge case: admin menghapus semua foto → kartu kosong yang ramah */
          <ScrollReveal>
            <div className="mx-auto max-w-md rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-10 text-center shadow-sm">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Camera className="size-6" aria-hidden="true" />
              </span>
              <p className="mt-4 font-semibold text-stone-700">Belum ada foto kegiatan.</p>
              <p className="mt-1 text-sm text-stone-500">
                Galeri dikelola admin melalui Editor Landing Page — silakan periksa kembali nanti.
              </p>
            </div>
          </ScrollReveal>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {items.map((g, i) => (
              <ScrollReveal key={`${g.imageUrl}-${i}`} delay={i * 0.06} y={40} className="h-full">
                {/* Tilt 3D: kartu miring mengikuti kursor + kilau (mouse saja) */}
                <TiltCard className="h-full rounded-2xl" max={8} lift={5}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(i)}
                  aria-label={`Perbesar foto: ${g.caption || `Kegiatan ${i + 1}`}`}
                  className={cn(
                    'group relative block w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 shadow-sm outline-none',
                    'transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-900/10',
                    'focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2',
                  )}
                >
                  <span className="block aspect-[4/3] w-full overflow-hidden">
                    <img
                      src={g.imageUrl}
                      alt={g.caption || `Foto kegiatan TPQ ${i + 1}`}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </span>
                  {/* Overlay keterangan */}
                  <span className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-emerald-950/80 via-emerald-950/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                    {g.caption && (
                      <span className="line-clamp-2 px-3 pb-3 text-left text-xs font-medium leading-snug text-white sm:text-sm">
                        {g.caption}
                      </span>
                    )}
                  </span>
                  {i === 0 && items.length > 1 && (
                    <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 shadow-sm">
                      <Images className="size-3" aria-hidden="true" />
                      {items.length} foto
                    </span>
                  )}
                </button>
                </TiltCard>
              </ScrollReveal>
            ))}
          </div>
        )}
      </div>

      {/* ============ LIGHTBOX ============ */}
      <AnimatePresence>
        {openIndex !== null && items[openIndex] && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Foto kegiatan: ${items[openIndex].caption || openIndex + 1}`}
            className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/90 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            {/* Tombol tutup */}
            <button
              type="button"
              onClick={close}
              aria-label="Tutup galeri"
              className="absolute right-4 top-4 z-10 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <X className="size-5" />
            </button>

            {/* Panah navigasi */}
            {items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    step(-1)
                  }}
                  aria-label="Foto sebelumnya"
                  className="absolute left-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-amber-300 sm:left-6"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    step(1)
                  }}
                  aria-label="Foto berikutnya"
                  className="absolute right-3 top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-amber-300 sm:right-6"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}

            <motion.figure
              key={openIndex}
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="max-h-full w-full max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={items[openIndex].imageUrl}
                alt={items[openIndex].caption || `Foto kegiatan TPQ ${openIndex + 1}`}
                className="max-h-[78vh] w-full rounded-2xl object-contain shadow-2xl"
              />
              <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-2 px-1">
                <span className="text-sm text-white/90">
                  {items[openIndex].caption || `Foto kegiatan ${openIndex + 1}`}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  {openIndex + 1} / {items.length}
                </span>
              </figcaption>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
