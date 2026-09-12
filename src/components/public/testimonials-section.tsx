'use client'

// Testimoni wali santri — konten CMS dari /api/settings via usePortalSettings
// (admin dapat menyunting daftar testimoni). Inisial avatar dihitung dari nama.
// Velora Marquee (velora.colorlib.com, MIT): kartu mengalir dua baris berlawanan
// arah, berhenti saat kursor di atasnya; reduce-motion menghormati prefers-reduced.

import { Quote, Star } from 'lucide-react'
import { usePortalSettings } from '@/hooks/use-portal-settings'
import { cn } from '@/lib/utils'
import { Marquee } from '@/components/velora/marquee'
import { ScrollReveal } from './ornaments'

/** Inisial nama: huruf pertama dari dua kata pertama (mis. "Ibu Ratna Sari" → "IR"). */
function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

type Testimonial = { name: string; role: string; quote: string }

/** Kartu testimoni — lebar tetap agar pas di aliran marquee. */
function TestimonialCard({ t, variant }: { t: Testimonial; variant: 0 | 1 }) {
  return (
    <figure
      className={cn(
        'relative flex w-[300px] shrink-0 flex-col rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-all duration-300 sm:w-[340px]',
        // rotasi halus bergantian + luruh saat hover
        variant === 0 ? 'md:-rotate-1' : 'md:rotate-1',
        'hover:rotate-0 hover:shadow-lg',
      )}
    >
      <Quote
        className="pointer-events-none absolute right-4 top-4 size-8 text-emerald-50"
        aria-hidden="true"
      />

      <div className="flex gap-0.5" role="img" aria-label="Penilaian 5 dari 5 bintang">
        {Array.from({ length: 5 }).map((_, s) => (
          <Star key={s} className="size-4 fill-amber-400 text-amber-400" aria-hidden="true" />
        ))}
      </div>

      <blockquote className="mt-4 flex-1 font-serif text-sm italic leading-relaxed text-stone-600">
        &ldquo;{t.quote}&rdquo;
      </blockquote>

      <figcaption className="mt-5 flex items-center gap-3 border-t border-stone-100 pt-4">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm',
            variant === 0 ? 'bg-emerald-700 text-white' : 'bg-amber-500 text-emerald-950',
          )}
          aria-hidden="true"
        >
          {initialsOf(t.name)}
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-stone-800">{t.name}</span>
          <span className="mt-0.5 block text-xs text-stone-500">{t.role}</span>
        </span>
      </figcaption>
    </figure>
  )
}

export function TestimonialsSection() {
  const { settings } = usePortalSettings()
  const items: Testimonial[] = settings.testimonials

  return (
    <section id="testimoni" className="scroll-mt-20 bg-stone-50 py-16">
      <div className="mx-auto max-w-6xl px-4">
        {/* Heading */}
        <ScrollReveal className="mx-auto mb-12 max-w-2xl text-center">
          <span className="mb-3 inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-700">
            Testimoni
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-stone-800">Kata Wali Santri</h2>
          <p className="mt-3 text-muted-foreground">
            Kepercayaan orang tua adalah amanah — inilah pengalaman wali santri yang mempercayakan
            pendidikan Al-Qur&apos;an anaknya kepada TPQ Darul Jinan.
          </p>
        </ScrollReveal>

        {items.length === 0 ? (
          /* Edge case: admin menghapus semua testimoni → kartu kosong yang ramah */
          <ScrollReveal>
            <div className="mx-auto max-w-md rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-10 text-center shadow-sm">
              <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <Quote className="size-6" aria-hidden="true" />
              </span>
              <p className="mt-4 font-semibold text-stone-700">Belum ada testimoni yang dipublikasikan.</p>
              <p className="mt-1 text-sm text-stone-500">
                Daftar testimoni dikelola oleh admin melalui menu Pengaturan — silakan periksa kembali nanti.
              </p>
            </div>
          </ScrollReveal>
        ) : (
          /* Aliran marquee Velora — baris kedua muncul hanya jika konten cukup */
          <div className="space-y-5">
            <Marquee pauseOnHover repeat={2} className="[--duration:65s]">
              {items.map((t, i) => (
                <TestimonialCard key={`${t.name}-${i}`} t={t} variant={i % 2 === 0 ? 0 : 1} />
              ))}
            </Marquee>
            {items.length >= 4 && (
              <Marquee pauseOnHover reverse repeat={2} className="[--duration:80s]">
                {[...items].reverse().map((t, i) => (
                  <TestimonialCard key={`rev-${t.name}-${i}`} t={t} variant={i % 2 === 0 ? 1 : 0} />
                ))}
              </Marquee>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
