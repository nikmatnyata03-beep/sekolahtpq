'use client'

// Footer portal publik — transisi arsitektur masjid dari latar halaman ke
// footer gelap (skyline di horizon), informasi lembaga, tautan cepat,
// jam operasional, dan kutipan Arab.
// Data kontak dibaca dari CMS /api/settings via usePortalSettings —
// aman hidrasi (paint awal memakai default).

import { Clock, Mail, MapPin, MessageCircle, MoonStar, Phone } from 'lucide-react'
import { usePortalSettings } from '@/hooks/use-portal-settings'
import { MosqueSilhouette, OrnamentDivider, StarLattice } from './ornaments'

const QUICK_LINKS = [
  { id: 'tentang', label: 'Tentang Kami' },
  { id: 'kurikulum', label: 'Kurikulum' },
  { id: 'guru', label: 'Biodata Guru' },
  { id: 'materi', label: 'Materi Ajar' },
  { id: 'berita', label: 'Berita & Kegiatan' },
  { id: 'blog', label: 'Blog', href: '/?page=blog' },
  { id: 'testimoni', label: 'Testimoni' },
  { id: 'faq', label: 'FAQ' },
  { id: 'ppdb', label: 'PPDB Online' },
  { id: 'checkin', label: 'Cek-in Absensi' },
]

export function Footer({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { settings } = usePortalSettings()
  const contact = settings.contact
  const phoneHref = `tel:${contact.phone.replace(/\s+/g, '')}`
  const waHref = `https://wa.me/${contact.whatsapp}`

  return (
    <footer className="relative">
      {/* Transisi arsitektur — siluet masjid "terbit" dari latar halaman
          menuju footer gelap, seperti skyline masjid di horizon. */}
      <div aria-hidden="true" className="bg-stone-50 text-emerald-900">
        <MosqueSilhouette className="block h-auto max-h-64 w-full" />
      </div>

      <div className="relative overflow-hidden bg-emerald-950 text-emerald-100">
        <StarLattice
          id="dj-footer-star"
          className="absolute inset-0 h-full w-full text-emerald-100 opacity-[0.04]"
        />

        <div className="relative mx-auto max-w-6xl px-4 py-14">
          <div className="grid gap-10 md:grid-cols-3">
            {/* Brand & kontak (kontak dari CMS) */}
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
                  <MoonStar className="size-5" />
                </span>
                <div className="leading-tight">
                  <p className="text-sm font-extrabold text-white">SIMADJI — TPQ Darul Jinan</p>
                  <p className="text-[11px] text-emerald-200/70">Sistem Informasi Manajemen TPQ</p>
                </div>
              </div>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-emerald-100/70">
                Lembaga pendidikan Al-Qur&apos;an untuk anak dan remaja — membina generasi Qur&apos;ani
                yang berakhlak mulia sejak tahun 2005.
              </p>
              <ul className="mt-5 space-y-2.5 text-sm text-emerald-100/80">
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  {contact.address}
                </li>
                <li className="flex items-center gap-2.5">
                  <Phone className="size-4 shrink-0 text-amber-400" />
                  <a href={phoneHref} className="transition-colors hover:text-amber-300">
                    {contact.phone}
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <MessageCircle className="size-4 shrink-0 text-amber-400" />
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-amber-300"
                  >
                    WhatsApp Sekretariat
                  </a>
                </li>
                <li className="flex items-center gap-2.5">
                  <Mail className="size-4 shrink-0 text-amber-400" />
                  <a
                    href={`mailto:${contact.email}`}
                    className="transition-colors hover:text-amber-300"
                  >
                    {contact.email}
                  </a>
                </li>
              </ul>
            </div>

            {/* Tautan cepat */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-amber-300">
                Tautan Cepat
              </h3>
              <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 md:grid-cols-1">
                {QUICK_LINKS.map((link) => (
                  <li key={link.id}>
                    {link.href ? (
                      <a
                        href={link.href}
                        className="group flex min-h-11 items-center gap-1.5 text-sm text-emerald-100/80 transition-colors hover:text-amber-300"
                      >
                        <span
                          className="size-1.5 rotate-45 bg-emerald-500/70 transition-colors group-hover:bg-amber-400"
                          aria-hidden="true"
                        />
                        {link.label}
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onNavigate?.(link.id)}
                        className="group flex min-h-11 items-center gap-1.5 text-sm text-emerald-100/80 transition-colors hover:text-amber-300"
                      >
                        <span
                          className="size-1.5 rotate-45 bg-emerald-500/70 transition-colors group-hover:bg-amber-400"
                          aria-hidden="true"
                        />
                        {link.label}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Jam operasional (dari CMS) */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-amber-300">
                Jam Operasional
              </h3>
              <div className="mt-4 rounded-2xl border border-emerald-800/80 bg-emerald-900/40 p-5">
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-5 shrink-0 text-amber-400" />
                  <div className="space-y-1.5 text-sm">
                    <p className="font-semibold leading-relaxed text-white">{contact.hoursNote}</p>
                    <p className="pt-1 text-xs leading-relaxed text-emerald-200/60">
                      Sesi belajar mengikuti jadwal kelas masing-masing — lihat rincian pada bagian
                      Kurikulum.
                    </p>
                  </div>
                </div>
              </div>
              <OrnamentDivider tone="light" className="mt-7" />
              <p
                className="mt-4 text-center font-serif text-lg leading-relaxed text-amber-200/70"
                dir="rtl"
                lang="ar"
              >
                رَبِّ زِدْنِي عِلْمًا وَارْزُقْنِي فَهْمًا
              </p>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="relative border-t border-emerald-800/60">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-emerald-200/60 sm:flex-row">
            <p>© 2025 TPQ Darul Jinan • SIMADJI</p>
            <p className="font-serif text-emerald-200/50" dir="rtl" lang="ar">
              بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
