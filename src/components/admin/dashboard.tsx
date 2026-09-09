'use client'

import { useState } from 'react'
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  GraduationCap,
  BookOpen,
  CalendarCheck,
  BookMarked,
  FolderOpen,
  Wallet,
  Newspaper,
  UserCog,
  MessageCircle,
  Settings,
  LogOut,
  Menu,
  Home,
  type LucideIcon,
} from 'lucide-react'
import type { AuthUser } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { OverviewSection } from './overview'
import { GuruOverview, type GuruOverviewSection } from './guru-overview'
import { SettingsSection } from './settings-section'
import { RegistrationsAdmin } from './registrations-admin'
import { StudentsAdmin } from './students-admin'
import { TeachersAdmin } from './teachers-admin'
import { ClassesAdmin } from './classes-admin'
import { AttendanceAdmin } from './attendance-admin'
import { HafalanAdmin } from './hafalan-admin'
import { MaterialsAdmin } from './materials-admin'
import { PaymentsAdmin } from './payments-admin'
import { ContentAdmin } from './content-admin'
import { UsersAdmin } from './users-admin'
import { WhatsAppLog } from './whatsapp-log'

type SectionKey =
  | 'ringkasan'
  | 'registrations'
  | 'students'
  | 'teachers'
  | 'classes'
  | 'attendance'
  | 'hafalan'
  | 'materials'
  | 'payments'
  | 'content'
  | 'users'
  | 'whatsapp'
  | 'pengaturan'

interface SectionDef {
  key: SectionKey
  label: string
  description: string
  icon: LucideIcon
  adminOnly?: boolean
}

const SECTIONS: SectionDef[] = [
  { key: 'ringkasan', label: 'Ringkasan', description: 'Ikhtisar statistik lembaga hari ini', icon: LayoutDashboard },
  { key: 'registrations', label: 'Pendaftaran PPDB', description: 'Verifikasi dan kelola pendaftaran santri baru', icon: ClipboardList, adminOnly: true },
  { key: 'students', label: 'Santri', description: 'Data induk santri dan wali', icon: Users, adminOnly: true },
  { key: 'teachers', label: 'Guru', description: 'Biodata dan keaktifan ustadz/ustadzah', icon: GraduationCap, adminOnly: true },
  { key: 'classes', label: 'Kelas', description: 'Kelola kelas, jadwal, dan pengajar', icon: BookOpen },
  { key: 'attendance', label: 'Absensi', description: 'Buka sesi QR, catat kehadiran santri', icon: CalendarCheck },
  { key: 'hafalan', label: 'Hafalan', description: 'Catat setoran dan capaian hafalan', icon: BookMarked },
  { key: 'materials', label: 'Materi', description: 'Unggah dan bagikan materi pembelajaran', icon: FolderOpen },
  { key: 'payments', label: 'Keuangan', description: 'Tagihan, pembayaran, dan tunggakan', icon: Wallet, adminOnly: true },
  { key: 'content', label: 'Konten', description: 'Berita, artikel, dan pengumuman', icon: Newspaper, adminOnly: true },
  { key: 'users', label: 'Pengguna', description: 'Akun admin, guru, dan wali santri', icon: UserCog, adminOnly: true },
  { key: 'whatsapp', label: 'Log WhatsApp', description: 'Riwayat notifikasi terkirim ke wali', icon: MessageCircle, adminOnly: true },
  { key: 'pengaturan', label: 'Pengaturan', description: 'Profil akun dan keamanan', icon: Settings },
]

const GURU_ALLOWED: SectionKey[] = ['ringkasan', 'classes', 'attendance', 'hafalan', 'materials', 'pengaturan']

function roleBadgeClass(role: string): string {
  if (role === 'ADMIN') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (role === 'GURU') return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-stone-100 text-stone-700 border-stone-200'
}

function roleLabel(role: string): string {
  if (role === 'ADMIN') return 'Admin'
  if (role === 'GURU') return 'Guru'
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
  const visible = SECTIONS.filter((s) => (isAdmin ? true : GURU_ALLOWED.includes(s.key)))
  const [active, setActive] = useState<SectionKey>('ringkasan')
  const [mobileOpen, setMobileOpen] = useState(false)

  const current: SectionDef = visible.find((s) => s.key === active) ?? visible[0]
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
            onNavigate={(section: GuruOverviewSection) => setActive(section)}
          />
        ) : (
          <OverviewSection />
        )
      case 'registrations':
        return <RegistrationsAdmin />
      case 'students':
        return <StudentsAdmin />
      case 'teachers':
        return <TeachersAdmin />
      case 'classes':
        return <ClassesAdmin />
      case 'attendance':
        return <AttendanceAdmin />
      case 'hafalan':
        return <HafalanAdmin />
      case 'materials':
        return <MaterialsAdmin user={user} />
      case 'payments':
        return <PaymentsAdmin />
      case 'content':
        return <ContentAdmin />
      case 'users':
        return <UsersAdmin user={user} />
      case 'whatsapp':
        return <WhatsAppLog user={user} />
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
              setActive(section.key)
              onNavigate?.()
            }}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
              isActive
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-stone-600 hover:bg-emerald-50 hover:text-emerald-800'
            )}
          >
            <Icon className={cn('size-4 shrink-0', isActive ? 'text-white' : 'text-emerald-700')} />
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
        <p className="truncate text-xs text-stone-500">TPQ Darul Jinan · Admin</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-dvh overflow-hidden bg-stone-50">
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
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-stone-200 bg-white/90 px-4 backdrop-blur md:px-6">
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
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold text-stone-900 md:text-lg">{headerDef.label}</h1>
            <p className="hidden truncate text-xs text-stone-500 sm:block">{headerDef.description}</p>
          </div>

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

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
          {renderSection()}
        </main>
      </div>
    </div>
  )
}
