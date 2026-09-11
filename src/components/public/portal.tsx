'use client'

// Public portal composition — header, sections, footer.
// Consumed by the root SPA view switcher: <PublicPortal onOpenLogin={...} />

import { useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { LogIn, Menu, MoonStar, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePortalSettings } from '@/hooks/use-portal-settings'
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
import { HijriDate } from './hijri-date'

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
  const { settings } = usePortalSettings()
  const logoUrl = settings.hero.logoUrl

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

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-40 border-b border-emerald-100 bg-white/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <button type="button" onClick={goHome} className="flex items-center gap-2.5 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
            {logoUrl ? (
              // Logo lembaga dari CMS — teks merek di sebelahnya sudah deskriptif
              <img src={logoUrl} alt="" className="size-10 shrink-0 rounded-xl object-cover ring-1 ring-emerald-200" />
            ) : (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-900 text-white shadow-md shadow-emerald-900/20">
                <MoonStar className="size-5" />
              </span>
            )}
            <span className="leading-tight">
              <span className="block text-sm font-extrabold tracking-tight text-emerald-900">SIMADJI</span>
              <span className="block text-[11px] font-medium text-stone-500">TPQ Darul Jinan</span>
            </span>
          </button>

          {/* Tanggal Hijriah — hanya di layar lebar agar header tetap lega */}
          <div className="hidden xl:block">
            <HijriDate variant="light" />
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Navigasi utama">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="rounded-md px-3 py-2 text-sm font-medium text-stone-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
              >
                {item.label}
              </button>
            ))}
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
            <Button size="sm" className="bg-emerald-700 shadow-sm hover:bg-emerald-800" onClick={onOpenLogin}>
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
                    <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-900 text-white">
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
                <Button className="justify-start bg-emerald-700 hover:bg-emerald-800" onClick={onOpenLogin}>
                  <LogIn className="size-4" />
                  Masuk Portal
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>

        {/* Garis progres scroll — tipis di tepi bawah header (dekoratif) */}
        <motion.span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-gradient-to-r from-emerald-600 via-amber-400 to-emerald-600"
          style={{ scaleX: progressX }}
        />
      </header>

      {/* ============ SECTIONS ============ */}
      <main>
        <Hero onOpenLogin={onOpenLogin} onNavigate={scrollToSection} />
        <AnnouncementsTicker />
        <AboutSection />
        <CurriculumSection />
        <TeachersSection />
        <MaterialsSection />
        <NewsSection />
        <AnnouncementsSection />
        <GallerySection />
        <TestimonialsSection />
        <FaqSection />
        <PpdbSection />
        <CheckinSection />
      </main>

      <Footer onNavigate={scrollToSection} />
    </div>
  )
}
