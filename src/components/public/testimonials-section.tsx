'use client'

// Testimoni wali santri — konten statis (tanpa fetch) berupa pengalaman
// orang tua dengan program TPQ Darul Jinan.

import { Quote, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

type Testimonial = {
  quote: string
  name: string
  role: string
  initials: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      'Anak saya jadi mandiri mengaji setelah ikut program Tahfidz. Ustadzahnya sabar banget menghadapi anak yang mudah bosan, sekarang hafalannya sudah lebih dari tiga juz. Alhamdulillah.',
    name: 'Bpk. Hendra Gunawan',
    role: 'Wali santri — Program Tahfidz',
    initials: 'HG',
  },
  {
    quote:
      'Awalnya anak saya sering enggan ke TPQ, sekarang justru dia yang mengingatkan jadwal ngaji. Metode Iqra di sini menyenangkan, anak-anak betah dan semangat.',
    name: 'Ibu Ratna Sari',
    role: 'Wali santri — Kelas Iqra 3',
    initials: 'RS',
  },
  {
    quote:
      'Laporan perkembangan di Portal Wali sangat membantu. Kehadiran, hafalan, sampai tagihan bulanan bisa saya pantau dari HP, dan komunikasi dengan ustadz lewat WhatsApp selalu cepat dibalas.',
    name: 'Bpk. Ahmad Fauzi',
    role: "Wali santri — Kelas Al-Qur'an B",
    initials: 'AF',
  },
  {
    quote:
      'Fasilitas nyaman dan pengajarnya komunikatif. Anak saya bukan cuma lancar membaca Al-Qur\u2019an, akhlaknya juga makin sopan dan terbiasa shalat berjamaah di rumah.',
    name: 'Ibu Dewi Lestari',
    role: 'Wali santri — Kelas Tahsin',
    initials: 'DL',
  },
]

export function TestimonialsSection() {
  return (
    <section id="testimoni" className="scroll-mt-20 bg-stone-50 py-16">
      <div className="mx-auto max-w-6xl px-4">
        {/* Heading */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="mb-3 inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-700">
            Testimoni
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-stone-800">Kata Wali Santri</h2>
          <p className="mt-3 text-muted-foreground">
            Kepercayaan orang tua adalah amanah — inilah pengalaman wali santri yang mempercayakan
            pendidikan Al-Qur&apos;an anaknya kepada TPQ Darul Jinan.
          </p>
        </div>

        {/* Kartu testimoni */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {TESTIMONIALS.map((t, i) => (
            <figure
              key={t.name}
              className={cn(
                'relative flex flex-col rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-all duration-300',
                // rotasi halus bergantian + angkat saat hover
                i % 2 === 0 ? 'md:-rotate-1' : 'md:rotate-1',
                'hover:-translate-y-1 hover:rotate-0 hover:shadow-lg',
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
                    i % 2 === 0 ? 'bg-emerald-700 text-white' : 'bg-amber-500 text-emerald-950',
                  )}
                  aria-hidden="true"
                >
                  {t.initials}
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-semibold text-stone-800">{t.name}</span>
                  <span className="mt-0.5 block text-xs text-stone-500">{t.role}</span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
