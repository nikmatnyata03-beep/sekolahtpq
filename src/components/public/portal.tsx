'use client'

// Public portal composition — header, sections, footer.
// Consumed by the root SPA view switcher: <PublicPortal onOpenLogin={...} />

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { LogIn, Menu, MoonStar, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePortalSettings } from '@/hooks/use-portal-settings'
import { DEFAULT_SECTION_ORDER } from '@/lib/portal-settings'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { ThemeToggle } from '@/components/theme-toggle'
import { Hero } from './hero'
import { AnnouncementsTicker } from './announcements-ticker'
import { AboutSection } from './about-section'
import { CurriculumSection } from './curriculum-section'
import { TeachersSection } from './teachers-section'
import { MaterialsSection } from './materials-section'
import { NewsSection } from './news-section'
import { AnnouncementsSection } from './announcements-section'
import { GallerySection } from './gallery-section'
import { TestimonialsSection } from './testimonials-section'
import { FaqSection } from './faq-section'
import { PpdbSection } from './ppdb-section'
import { CheckinSection } from './checkin-section'
import { Footer } from './footer'
import { ScrollTopFab } from './motion-primitives'
import { WhatsAppFab } from './whatsapp-fab'

const NAV_ITEMS = [
  { id: 'tentang', label: 'Tentang' },
  { id: 'kurikulum', label: 'Kurikulum' },
  { id: 'guru', label: 'Guru' },
  { id: 'materi', label: 'Materi' },
  { id: 'berita', label: 'Berita' },
  { id: 'pengumuman', label: 'Pengumuman' },
  { id: 'galeri', label: 'Galeri' },
  { id: 'ppdb', label: 'PPDB' },
]

export function PublicPortal({ onOpenLogin }: { onOpenLogin: () => void }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { settings, previewing } = usePortalSettings()
  const logoUrl = settings.hero.logoUrl

  // MAGIC-01 — scroll-spy: section yang sedang terlihat menandai nav aktif.
  // IntersectionObserver dengan pita tengah viewport (rootMargin negatif) agar
  // hanya satu section yang "menang" pada satu waktu.
  const [activeSection, setActiveSection] = useState<string | null>(null)
  useEffect(() => {
    const ids = NAV_ITEMS.map((item) => item.id)
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        }
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }
    // Di paling atas (hero terlihat) tidak ada nav yang aktif — bersihkan pill.
    const onScroll = () => {
      if (window.scrollY < 200) setActiveSection(null)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Task 62 — tema CMS: warna merek dipasang sebagai CSS variables di akar
  // portal sehingga seluruh section turunan bisa memakai var(--brand).
  const brandVars = {
    '--brand': settings.theme.primary,
    '--brand-accent': settings.theme.accent,
  } as CSSProperties

  // Progres scroll halaman — menggerakkan garis gradien tipis di tepi bawah header.
  const { scrollYProgress } = useScroll()
  const progressX = useTransform(scrollYProgress, [0, 1], [0, 1])

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMobileOpen(false)
  }

  const goHome = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setMobileOpen(false)
  }

  // Task 59-b: urutan section utama mengikuti CMS (settings.sectionOrder);
  // fallback ke urutan bawaan bila kosong/tidak valid.
  const sectionOrder =
    Array.isArray(settings.sectionOrder) && settings.sectionOrder.length > 0
      ? settings.sectionOrder
      : DEFAULT_SECTION_ORDER

  // Peta kunci section → elemen (anchor id tetap ditangani tiap komponen).
  const sectionMap: Record<string, ReactNode> = {
    hero: <Hero onOpenLogin={onOpenLogin} onNavigate={scrollToSection} />,
    ticker: <AnnouncementsTicker />,
    tentang: <AboutSection />,
    kurikulum: <CurriculumSection />,
    guru: <TeachersSection />,
    materi: <MaterialsSection />,
    berita: <NewsSection />,
    pengumuman: <AnnouncementsSection />,
    galeri: <GallerySection />,
    testimoni: <TestimonialsSection />,
    faq: <FaqSection />,
    ppdb: <PpdbSection />,
    checkin: <CheckinSection />,
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800" style={brandVars}>
      {/* Task 62 — banner pratinjau draf (hanya saat ?preview=1 + login admin) */}
      {previewing && (
        <div className="sticky top-0 z-50 border-b border-amber-300 bg-amber-400 px-4 py-2 text-center text-xs font-semibold text-amber-950">
          MODE PRATINJAU — ini tampilan DRAF yang belum dipublikasikan. Kembali ke editor lalu tekan “Publish ke Portal” untuk menerapkan.
        </div>
      )}

      {/* ============ HEADER ============ */}
      <header className="glass sticky top-0 z-40 shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <button type="button" onClick={goHome} className="flex items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            {logoUrl ? (
              // Logo lembaga dari CMS — teks merek di sebelahnya sudah deskriptif
              <img src={logoUrl} alt="" className="size-10 shrink-0 rounded-xl object-cover ring-1 ring-emerald-200" />
            ) : (
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md"
                style={{ backgroundImage: 'linear-gradient(to bottom right, color-mix(in srgb, var(--brand) 70%, black), var(--brand))' }}
              >
                <MoonStar className="size-5" />
              </span>
            )}
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tracking-tight text-emerald-900">SIMADJI</span>
              <span className="block text-[11px] font-medium text-stone-500">TPQ Darul Jinan</span>
            </span>
          </button>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Navigasi utama">
            {NAV_ITEMS.map((item) => {
              const active = activeSection === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  aria-current={active ? 'true' : undefined}
                  className={cnNavButton(active)}
                >
                  {/* MAGIC-01 — pill aktif: satu elemen shared layoutId yang berpindah
                      antar tombol dengan spring (indikator menggelinding, bukan muncul-hilang) */}
                  {active && (
                    <motion.span
                      layoutId="nav-active-pill"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                      className="absolute inset-0 rounded-md bg-emerald-100/80 dark:bg-[oklch(0.32_0.04_165)]"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 md:flex">
            {/* Task 48: pengalih tema */}
            <ThemeToggle />
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/60 bg-amber-50/50 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
              onClick={() => scrollToSection('checkin')}
            >
              <ScanLine className="size-4" />
              Cek-in Absensi
            </Button>
            <Button
              size="sm"
              className="shadow-sm hover:opacity-90"
              style={{ backgroundColor: 'var(--brand)' }}
              onClick={onOpenLogin}
            >
              <LogIn className="size-4" />
              Masuk
            </Button>
          </div>

          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Buka menu navigasi">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 border-emerald-100 p-0">
              <SheetHeader className="border-b border-emerald-100 bg-emerald-50/60 p-4">
                <SheetTitle className="flex items-center gap-2 text-emerald-900">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="size-8 rounded-lg object-cover ring-1 ring-emerald-200" />
                  ) : (
                    <span
                      className="flex size-8 items-center justify-center rounded-lg text-white"
                      style={{ backgroundImage: 'linear-gradient(to bottom right, color-mix(in srgb, var(--brand) 70%, black), var(--brand))' }}
                    >
                      <MoonStar className="size-4" />
                    </span>
                  )}
                  SIMADJI — TPQ Darul Jinan
                </SheetTitle>
                <SheetDescription>Portal informasi & layanan TPQ</SheetDescription>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4" aria-label="Navigasi seluler">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-stone-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    {item.label}
                  </button>
                ))}
                <Separator className="my-2" />
                {/* Task 48: pengalih tema (mobile) */}
                <div className="py-1">
                  <ThemeToggle />
                </div>
                <Button
                  variant="outline"
                  className="justify-start border-amber-500/60 text-amber-800 hover:bg-amber-50"
                  onClick={() => scrollToSection('checkin')}
                >
                  <ScanLine className="size-4" />
                  Cek-in Absensi
                </Button>
                <Button
                  className="justify-start hover:opacity-90"
                  style={{ backgroundColor: 'var(--brand)' }}
                  onClick={onOpenLogin}
                >
                  <LogIn className="size-4" />
                  Masuk Portal
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        {/* Garis progres scroll — tipis di tepi bawah header (warna mengikuti tema CMS) */}
        <motion.span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gradient-to-r from-[var(--brand)] via-[var(--brand-accent)] to-[var(--brand)]"
          style={{ scaleX: progressX }}
        />
      </header>

      {/* ============ SECTIONS (urutan mengikuti CMS — Task 59-b) ============ */}
      <main>
        {sectionOrder.map((key) => (
          <Fragment key={key}>{sectionMap[key]}</Fragment>
        ))}
      </main>

      <Footer onNavigate={scrollToSection} />

      {/* FAB WhatsApp — chat langsung ke sekretariat (wa.me, CMS contact) */}
      <WhatsAppFab />

      {/* MAGIC-01 — FAB kembali ke atas dgn cincin progres scroll */}
      <ScrollTopFab />
    </div>
  )
}

/** Kelas tombol nav — dasar underline menyapu + variasi warna saat aktif. */
function cnNavButton(active: boolean): string {
  return [
    'nav-underline relative rounded-md px-3 py-2 text-sm font-medium transition-colors',
    active
      ? 'font-semibold text-emerald-800'
      : 'text-stone-600 hover:bg-emerald-50 hover:text-emerald-800',
  ].join(' ')
}
