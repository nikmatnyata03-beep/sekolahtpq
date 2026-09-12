'use client'

// Gelombang 4.5 — Command Palette ⌘K (item #7 matriks riset UIUX-RESEARCH-01).
// Navigasi cepat antar-section admin + pencarian santri instan (item #7).
//
// Desain:
//  - Data santri diambil SEKALI saat palette pertama dibuka (skala TPQ kecil),
//    lalu cmdk yang memfilter client-side — tanpa perubahan API, tanpa risiko.
//  - Akses data tetap role-scoped oleh /api/students (ADMIN semua, GURU kelasnya)
//    — palette tidak menambah permukaan data baru (CWE-863 tetap terjaga).
//  - Pilih santri → loncat ke section terkait per peran (admin: Santri, guru: Hafalan).
//  - Buka: tombol kaca pembesar di top bar / ⌘K (macOS) / Ctrl+K (Windows-Linux).
import { useEffect, useMemo, useState } from 'react'
import { Search, GraduationCap, Users, BookMarked, type LucideIcon } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import type { Student } from '@/lib/types'

interface PaletteSection {
  key: string
  label: string
  description: string
  icon: LucideIcon
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sections: PaletteSection[]
  onNavigate: (key: string) => void
  canSearchStudents: boolean
  /** Section tujuan saat santri dipilih (admin → 'students', guru → 'hafalan') */
  studentTargetKey: string
}

export function CommandPalette({
  open,
  onOpenChange,
  sections,
  onNavigate,
  canSearchStudents,
  studentTargetKey,
}: CommandPaletteProps) {
  const [students, setStudents] = useState<Student[] | null>(null)
  const [studentsError, setStudentsError] = useState(false)

  // Ambil data santri sekali per sesi palette (lazy, saat pertama dibuka).
  useEffect(() => {
    if (!open || !canSearchStudents || students || studentsError) return
    let alive = true
    fetch('/api/students')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { data?: Student[] }) => {
        if (alive) setStudents(Array.isArray(d.data) ? d.data : [])
      })
      .catch(() => {
        if (alive) setStudentsError(true)
      })
    return () => {
      alive = false
    }
  }, [open, canSearchStudents, students, studentsError])

  // cmdk memakai prop `value` untuk fuzzy match — gabungkan nama+NIS+kelas.
  const studentItems = useMemo(
    () =>
      (students ?? []).slice(0, 300).map((s) => ({
        student: s,
        value: `${s.fullName} ${s.nis} ${s.class?.name ?? ''}`.trim(),
      })),
    [students],
  )

  const navigate = (key: string) => {
    onOpenChange(false)
    onNavigate(key)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      className="md:max-w-xl"
      aria-label="Palette perintah admin"
    >
      <CommandInput placeholder="Ketik perintah atau nama santri…" />
      <CommandList className="max-h-[min(60vh,420px)]">
        <CommandEmpty>Tidak ditemukan — coba kata kunci lain.</CommandEmpty>

        {canSearchStudents && (
          <>
            <CommandGroup heading="Santri">
              {!students && !studentsError && (
                <div className="px-3 py-4 text-sm text-stone-400">Memuat data santri…</div>
              )}
              {studentsError && (
                <div className="px-3 py-4 text-sm text-stone-400">
                  Gagal memuat santri — coba tutup dan buka lagi.
                </div>
              )}
              {students && studentItems.length === 0 && (
                <div className="px-3 py-4 text-sm text-stone-400">Belum ada data santri.</div>
              )}
              {studentItems.map(({ student: s, value }) => (
                <CommandItem
                  key={s.id}
                  value={value}
                  onSelect={() => navigate(studentTargetKey)}
                  className="gap-2"
                >
                  {studentTargetKey === 'hafalan' ? (
                    <BookMarked className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <Users className="size-4 shrink-0 text-emerald-600" />
                  )}
                  <span className="truncate font-medium">{s.fullName}</span>
                  <span className="ml-auto shrink-0 text-xs text-stone-400 tabular-nums">
                    {s.nis}
                    {s.class?.name ? ` · ${s.class.name}` : ''}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navigasi">
          {sections.map((s) => (
            <CommandItem
              key={s.key}
              value={`${s.label} ${s.description}`}
              onSelect={() => navigate(s.key)}
              className="gap-2"
            >
              <s.icon className="size-4 shrink-0 text-emerald-600" aria-hidden />
              <span className="font-medium">{s.label}</span>
              <span className="ml-auto hidden truncate pl-4 text-xs text-stone-400 sm:block">
                {s.description}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Info">
          <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-400">
            <GraduationCap className="size-3.5 shrink-0" />
            SIMADJI — tekan Esc untuk menutup
          </div>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}

/** Ikon pembuka yang konsisten (top bar + mobile). */
export function PaletteTriggerIcon() {
  return <Search className="size-4" />
}
