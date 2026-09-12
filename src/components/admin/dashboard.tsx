'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Toaster } from 'sonner'
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  Radio,
  BookMarked,
  FolderOpen,
  Wallet,
  Newspaper,
  Palette,
  FileBarChart,
  UserCog,
  MessageCircle,
  Settings,
  LogOut,
  Menu,
  Home,
  ShieldCheck,
  TerminalSquare,
  Sparkles,
  Search,
  type LucideIcon,
} from 'lucide-react'
import type { AuthUser } from '@/lib/types'
import { cn } from '@/lib/utils'
import { withViewTransition } from '@/lib/view-transition'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ThemeToggle } from '@/components/theme-toggle'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { OverviewSection } from './overview'
import { CommandPalette } from './command-palette'
import { GuruOverview, type GuruOverviewSection } from './guru-overview'
import { SettingsSection } from './settings-section'
import { RegistrationsAdmin } from './registrations-admin'
import { StudentsAdmin } from './students-admin'
import { TeachersAdmin } from './teachers-admin'
import { ClassesAdmin } from './classes-admin'
import { AttendanceAdmin } from './attendance-admin'
import { PresenceLivePanel } from './presence-live'
import { HafalanAdmin } from './hafalan-admin'
import { MaterialsAdmin } from './materials-admin'
import { PaymentsAdmin } from './payments-admin'
import { ReportsAdmin } from './reports-admin'
import { ContentAdmin } from './content-admin'
import { LandingEditor } from './landing-editor'
import { UsersAdmin } from './users-admin'
import { WhatsAppLog } from './whatsapp-log'
import { PentestAdmin } from './pentest-admin'
import { DevConsole } from './dev-console'
import { AiAssistant } from './ai-assistant'
import { ChatBubble } from './chat-bubble'

type SectionKey =
  | 'ringkasan'
  | 'registrations'
  | 'students'
  | 'teachers'
  | 'classes'
  | 'attendance'
  | 'presensi-live'
  | 'hafalan'
  | 'materials'
  | 'ai'
  | 'payments'
  | 'laporan'
  | 'content'
  | 'landing'
  | 'users'
  | 'whatsapp'
  | 'pentest'
  | 'devconsole'
  | 'pengaturan'

interface SectionDef {
  key: SectionKey
  label: string
  description: string
  icon: LucideIcon
  adminOnly?: boolean
  developerOnly?: boolean
}

const SECTIONS: SectionDef[] = [
  { key: 'ringkasan', label: 'Ringkasan', description: 'Ikhtisar statistik lembaga hari ini', icon: LayoutDashboard },
  { key: 'registrations', label: 'Pendaftaran PPDB', description: 'Verifikasi dan kelola pendaftaran santri baru', icon: ClipboardList, adminOnly: true },
  { key: 'students', label: 'Santri', description: 'Data induk santri dan wali', icon: Users, adminOnly: true },
  { key: 'teachers', label: 'Guru', description: 'Biodata dan keaktifan ustadz/ustadzah', icon: GraduationCap, adminOnly: true },
  { key: 'classes', label: 'Kelas', description: 'Kelola kelas, jadwal, dan pengajar', icon: BookOpen },
  { key: 'attendance', label: 'Absensi', description: 'Buka sesi QR, catat kehadiran santri', icon: CalendarCheck },
  { key: 'presensi-live', label: 'Presensi Live', description: 'Panel real-time kehadiran santri (Durable Objects)', icon: Radio },
  { key: 'hafalan', label: 'Hafalan', description: 'Catat setoran dan capaian hafalan', icon: BookMarked },
  { key: 'materials', label: 'Materi', description: 'Unggah dan bagikan materi pembelajaran', icon: FolderOpen },
  { key: 'ai', label: 'Asisten AI', description: 'Generator kuis hafalan, ide materi, dan rencana belajar', icon: Sparkles },
  { key: 'payments', label: 'Keuangan', description: 'Tagihan, pembayaran, dan tunggakan', icon: Wallet, adminOnly: true },
  { key: 'laporan', label: 'Laporan', description: 'Laporan bulanan PDF: baca dan unduh arsip resmi', icon: FileBarChart, adminOnly: true },
  { key: 'content', label: 'Konten', description: 'Berita, artikel, dan pengumuman', icon: Newspaper, adminOnly: true },
  { key: 'landing', label: 'Landing Page', description: 'Kelola konten dan urutan layout halaman depan portal publik', icon: Palette, adminOnly: true },
  { key: 'users', label: 'Pengguna', description: 'Akun admin, guru, dan wali santri', icon: UserCog, adminOnly: true },
  { key: 'whatsapp', label: 'Log WhatsApp', description: 'Riwayat notifikasi terkirim ke wali', icon: MessageCircle, adminOnly: true },
  { key: 'pentest', label: 'AI Pentest', description: 'Pemindai keamanan AI — audit otomatis seluruh endpoint', icon: ShieldCheck, adminOnly: true },
  { key: 'devconsole', label: 'Dev Console', description: 'Monitor kesehatan sistem, diagnosa AI, dan auto-fix', icon: TerminalSquare, developerOnly: true },
  { key: 'pengaturan', label: 'Pengaturan', description: 'Profil akun dan keamanan', icon: Settings },
]

const GURU_ALLOWED: SectionKey[] = ['ringkasan', 'classes', 'attendance', 'presensi-live', 'hafalan', 'materials', 'ai', 'pengaturan']
// Task 59-b: DEVELOPER ikut mengelola Landing Page (editor konten + urutan layout).
const DEVELOPER_ALLOWED: SectionKey[] = ['landing', 'pentest', 'devconsole', 'pengaturan']

// Gelombang 13 (#17): navigasi adaptif per peran — GURU mendapat urutan prioritas mengajar
// (alat harian: absensi, presensi live, hafalan naik ke atas), ADMIN mempertahankan
// urutan manajemen master. Semua anggota GURU_ALLOWED wajib ada di GURU_PRIORITY.
const GURU_PRIORITY: SectionKey[] = ['ringkasan', 'attendance', 'presensi-live', 'hafalan', 'classes', 'materials', 'ai', 'pengaturan']

// Gelombang 13 (#17): memori section terakhir per peran — tiap peran dilanjutkan
// dari tempat terakhirnya sendiri (localStorage; try/catch untuk mode privat).
function sectionMemoryKey(role: string): string {
  return `simadji:last-section:${role}`
}

// Gelombang 13 (#17): salam mengikuti jam lokal perangkat (04-10 pagi, 11-14 siang,
// 15-17 sore, sisanya malam).
function greetingForHour(hour: number): string {
  if (hour >= 4 && hour < 11) return 'Selamat pagi'
  if (hour >= 11 && hour < 15) return 'Selamat siang'
  if (hour >= 15 && hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

// Gelombang 13 (#17): sumber salam/tanggal murni klien via useSyncExternalStore —
// snapshot server berupa string kosong sehingga SSR & hydrate identik, tanpa
// setState di dalam effect (aturan react-hooks/set-state-in-effect).
const emptySubscribe = () => () => {}
function getGreetingSnapshot(): string {
  return greetingForHour(new Date().getHours())
}
function getDateSnapshot(): string {
  return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
}
function getEmptySnapshot(): string {
  return ''
}

function roleBadgeClass(role: string): string {
  if (role === 'ADMIN') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (role === 'GURU') return 'bg-amber-100 text-amber-800 border-amber-200'
  if (role === 'DEVELOPER') return 'bg-purple-100 text-purple-800 border-purple-200'
  return 'bg-stone-100 text-stone-700 border-stone-200'
}

function roleLabel(role: string): string {
  if (role === 'ADMIN') return 'Admin'
  if (role === 'GURU') return 'Guru'
  if (role === 'DEVELOPER') return 'Developer'
  return 'Wali Santri'
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function AdminDashboard({ user, onLogout, onOpenPublic }: { user: AuthUser; onLogout: () => void; onOpenPublic?: () => void }) {
  const isAdmin = user.role === 'ADMIN'
  const isDeveloper = user.role === 'DEVELOPER'
  const firstName = user.name.split(' ').filter(Boolean)[0] ?? roleLabel(user.role)
  const visible = SECTIONS.filter((s) => {
    if (isAdmin) return !s.developerOnly
    if (isDeveloper) return DEVELOPER_ALLOWED.includes(s.key)
    return GURU_ALLOWED.includes(s.key)
  })
  if (user.role === 'GURU') {
    visible.sort((a, b) => GURU_PRIORITY.indexOf(a.key) - GURU_PRIORITY.indexOf(b.key))
  }
  // Gelombang 13 (#17): pemulihan section terakhir per peran; gagal baca = fallback default
  const [active, setActive] = useState<SectionKey>(() => {
    if (isDeveloper) return 'pentest'
    if (typeof window === 'undefined') return 'ringkasan'
    try {
      const saved = window.localStorage.getItem(sectionMemoryKey(user.role)) as SectionKey | null
      if (saved && visible.some((s) => s.key === saved)) return saved
    } catch {
      /* mode privat / storage tidak tersedia — pakai default */
    }
    return 'ringkasan'
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  // Gelombang 13 (#17): salam + tanggal hanya terisi di klien (lihat emptySubscribe di atas)
  const greeting = useSyncExternalStore(emptySubscribe, getGreetingSnapshot, getEmptySnapshot)
  const dateLine = useSyncExternalStore(emptySubscribe, getDateSnapshot, getEmptySnapshot)

  // Gelombang 4.5 — ⌘K / Ctrl+K membuka command palette (navigasi + cari santri)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const current: SectionDef = visible.find((s) => s.key === active) ?? visible[0]

  // Gelombang 13 (#17): simpan section terakhir per peran setiap kali berpindah
  useEffect(() => {
    try {
      window.localStorage.setItem(sectionMemoryKey(user.role), active)
    } catch {
      /* persistensi bersifat kenyamanan — kegagalan diabaikan */
    }
  }, [active, user.role])
  // Role-aware header copy: guru Ringkasan is a personal teaching digest, not the institution overview
  const headerDef: SectionDef =
    active === 'ringkasan' && user.role === 'GURU'
      ? { ...current, description: 'Ikhtisar kelas dan aktivitas mengajar Anda' }
      : current

  function renderSection() {
    switch (active) {
      case 'ringkasan':
        return user.role === 'GURU' ? (
          <GuruOverview
            user={user}
            onNavigate={(section: GuruOverviewSection) => withViewTransition(() => setActive(section))}
          />
        ) : (
          <OverviewSection
            showSetup={isAdmin}
            onNavigate={(k) => withViewTransition(() => setActive(k as SectionKey))}
          />
        )
      case 'registrations':
        return <RegistrationsAdmin />
      case 'students':
        return <StudentsAdmin />
      case 'teachers':
        return <TeachersAdmin />
      case 'classes':
        return <ClassesAdmin canManage={isAdmin} />
      case 'attendance':
        return <AttendanceAdmin user={user} />
      case 'presensi-live':
        return <PresenceLivePanel />
      case 'hafalan':
        return <HafalanAdmin />
      case 'materials':
        return <MaterialsAdmin user={user} />
      case 'ai':
        return <AiAssistant />
      case 'payments':
        return <PaymentsAdmin />
      case 'laporan':
        return <ReportsAdmin user={user} />
      case 'content':
        return <ContentAdmin />
      case 'landing':
        return <LandingEditor />
      case 'users':
        return <UsersAdmin user={user} />
      case 'whatsapp':
        return <WhatsAppLog user={user} />
      case 'pentest':
        return <PentestAdmin user={user} />
      case 'devconsole':
        return <DevConsole user={user} />
      case 'pengaturan':
        return <SettingsSection user={user} />
      default:
        return null
    }
  }

  const navList = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-1 px-3">
      {visible.map((section) => {
        const Icon = section.icon
        const isActive = section.key === active
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => {
              // Gelombang 7 (#9): perpindahan section via View Transitions (fallback hard cut);
              // klik section yang sama tidak dipicu ulang agar tidak snapshot sia-sia
              if (section.key === active) {
                onNavigate?.()
                return
              }
              withViewTransition(() => setActive(section.key))
              onNavigate?.()
            }}
            className={cn(
              'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 active:scale-[0.98]',
              isActive
                ? 'bg-emerald-700 text-white shadow-sm glow-soft'
                : 'text-stone-600 hover:bg-emerald-50 hover:text-emerald-800'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className={cn('size-4 shrink-0 transition-transform duration-150 group-active:scale-90', isActive ? 'text-white' : 'text-emerald-700')} />
            <span className="truncate">{section.label}</span>
          </button>
        )
      })}
    </nav>
  )

  const brand = (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-sm">
        <BookOpen className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold tracking-wide text-stone-900">SIMADJI</p>
        <p className="truncate text-xs text-stone-500">TPQ Darul Jinan · {roleLabel(user.role)}</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-stone-50">
      {/* Sonner toast — chat-bubble (AI assistant) memanggil toast.error dari sonner;
          tanpa mount ini feedback error tertelan diam (bug ditemukan Gelombang 4) */}
      <Toaster position="bottom-right" toastOptions={{ className: 'toast-spring' }} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        sections={visible}
        onNavigate={(k) => withViewTransition(() => setActive(k as SectionKey))}
        canSearchStudents={isAdmin || user.role === 'GURU'}
        studentTargetKey={isAdmin ? 'students' : 'hafalan'}
      />
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-stone-200 bg-white md:flex">
        {brand}
        <Separator />
        <div className="flex-1 overflow-y-auto py-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
          {navList()}
        </div>
        <Separator />
        <div className="px-5 py-3 text-[11px] leading-relaxed text-stone-400">
          SIMADJI v1.0 — Sistem Informasi Manajemen TPQ Darul Jinan
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="glass sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 px-4 shadow-sm md:px-6">
          {/* Hamburger mobile */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label="Buka menu">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b p-0">
                <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
                {brand}
              </SheetHeader>
              <div className="overflow-y-auto py-3">{navList(() => setMobileOpen(false))}</div>
              <Separator />
              <div className="px-3 pb-5 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false)
                    onOpenPublic?.()
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-stone-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                >
                  <Home className="size-4 shrink-0 text-emerald-700" />
                  <span className="truncate">Portal Publik</span>
                </button>
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            {active === 'ringkasan' && greeting ? (
              <>
                <h1 className="truncate text-base font-bold text-stone-900 md:text-lg">
                  {greeting}, {firstName}
                </h1>
                <p className="hidden truncate text-xs text-stone-500 sm:block">
                  {headerDef.description}
                  {dateLine ? ` · ${dateLine}` : ''}
                </p>
              </>
            ) : (
              <>
                <h1 className="truncate text-base font-bold text-stone-900 md:text-lg">{headerDef.label}</h1>
                <p className="hidden truncate text-xs text-stone-500 sm:block">{headerDef.description}</p>
              </>
            )}
          </div>

          {/* Gelombang 4.5 — pembuka command palette (⌘K) */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Buka palette perintah (Ctrl+K)"
            className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white/60 px-2.5 py-1.5 text-xs font-medium text-stone-500 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
          >
            <Search className="size-3.5" />
            <kbd className="hidden font-sans text-[10px] font-semibold text-stone-400 md:inline">⌘K</kbd>
          </button>

          {/* Task 48: pengalih tema Terang/Gelap/Sistem */}
          <ThemeToggle />

          <button
            type="button"
            onClick={() => onOpenPublic?.()}
            className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-emerald-700 sm:flex"
          >
            <Home className="size-3.5" />
            Portal Publik
          </button>

          <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white py-1 pl-1 pr-2.5 shadow-sm">
            <Avatar className="size-7">
              <AvatarFallback className="bg-emerald-700 text-[11px] font-semibold text-white">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="hidden min-w-0 flex-col leading-tight sm:flex">
              <span className="max-w-[140px] truncate text-xs font-semibold text-stone-800">{user.name}</span>
              <Badge className={cn('mt-0.5 h-4 px-1.5 text-[10px]', roleBadgeClass(user.role))}>
                {roleLabel(user.role)}
              </Badge>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Keluar</span>
          </Button>
        </header>

        {/* Content — keyed fade/slide transition keeps every tab switch smooth */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
          <div key={active} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {renderSection()}
          </div>
        </main>
      </div>

      {/* Task 58: bubble chat AI (Head Office) — tersedia untuk guru/admin/developer */}
      <ChatBubble userName={user.name} />
    </div>
  )
}
