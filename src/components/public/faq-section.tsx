'use client'

// FAQ portal publik — konten CMS dari /api/settings via usePortalSettings
// (admin dapat menyunting daftar pertanyaan). Accordion shadcn/ui dengan
// reveal 3D stagger, kolom intro sticky, dan kartu kontak sekretariat.

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { CircleHelp, MessageCircle, Phone } from 'lucide-react'
import { usePortalSettings } from '@/hooks/use-portal-settings'
import { ScrollReveal } from './ornaments'
import { SectionHeading } from './motion-primitives'

export function FaqSection() {
  const { settings } = usePortalSettings()

  return (
    <section id="faq" className="scroll-mt-20 bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Kolom intro — sticky di desktop */}
          <div className="lg:col-span-2">
            <div className="lg:sticky lg:top-24">
              <SectionHeading
                align="left"
                badge="FAQ"
                title="Pertanyaan yang Sering Diajukan"
                subtitle={
                  <>
                    Ringkasan jawaban seputar pendaftaran, biaya, jadwal belajar, dan layanan Portal
                    Wali. Klik pertanyaan untuk melihat jawabannya.
                  </>
                }
              />
              <ScrollReveal>

                {/* Kartu kontak */}
                <div className="relative mt-6 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 p-6 text-white shadow-md">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-amber-300">
                    Masih ada pertanyaan?
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-emerald-50/90">
                    Sekretariat siap membantu Senin – Sabtu, pukul 08.00 – 17.00 WIB.
                  </p>
                  <div className="mt-4 flex flex-col gap-2.5 sm:flex-row lg:flex-col xl:flex-row">
                    <a
                      href="tel:081234567890"
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                    >
                      <Phone className="size-4" aria-hidden="true" />
                      0812-3456-7890
                    </a>
                    <a
                      href="https://wa.me/6281234567890"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm transition-colors hover:bg-amber-400"
                    >
                      <MessageCircle className="size-4" aria-hidden="true" />
                      Chat WhatsApp
                    </a>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </div>

          {/* Kolom accordion */}
          <div className="lg:col-span-3">
            {settings.faqs.length === 0 ? (
              /* Edge case: admin menghapus semua FAQ → kartu kosong yang ramah */
              <ScrollReveal>
                <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/60 px-6 py-10 text-center">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <CircleHelp className="size-6" aria-hidden="true" />
                  </span>
                  <p className="mt-4 font-semibold text-stone-700">Belum ada pertanyaan yang dipublikasikan.</p>
                  <p className="mt-1 text-sm text-stone-500">
                    Daftar FAQ dikelola oleh admin melalui menu Pengaturan — silakan periksa kembali
                    nanti, atau hubungi sekretariat kami.
                  </p>
                </div>
              </ScrollReveal>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {settings.faqs.map((item, i) => (
                  <ScrollReveal
                    key={`faq-${i}`}
                    delay={Math.min(i * 0.05, 0.4)}
                    className="mb-3 last:mb-0"
                  >
                    <AccordionItem
                      value={`faq-${i}`}
                      className="rounded-xl border border-stone-200 bg-white px-5 shadow-sm"
                    >
                      <AccordionTrigger className="gap-3 py-4 text-left text-sm font-semibold text-stone-800 hover:no-underline sm:text-base">
                        <span className="flex items-start gap-3">
                          <CircleHelp className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                          {item.question}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="pl-7 text-sm leading-relaxed text-stone-600">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  </ScrollReveal>
                ))}
              </Accordion>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
