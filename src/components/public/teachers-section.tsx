'use client'

// Biodata Guru — kartu pengajar dengan avatar foto (fallback inisial), lama
// mengajar, dan dialog biodata profesional (gaya Kemenag) dari /api/teachers.

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  Award,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  Eye,
  GraduationCap,
  Quote,
  RefreshCw,
  School,
  ScrollText,
  Sparkles,
  User,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { SpotlightCard } from '@/components/velora/spotlight-card'
import { AmbientOrbs, SectionHeading, StaggerGroup, StaggerItem } from './motion-primitives'
import { apiGet, formatShortDate } from '@/lib/api-client'
import type { Teacher } from '@/lib/types'
import { cn } from '@/lib/utils'

/** Parse JSON string array dengan aman — fallback [] agar tidak crash. */
function safeParseArray(value: string | null | undefined): unknown[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function describeEdu(item: unknown): string {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>
    const main = [o.level, o.major].filter((v) => typeof v === 'string' && v.trim()).join(' — ')
    const inst = typeof o.institution === 'string' ? o.institution : ''
    const year = typeof o.year === 'string' || typeof o.year === 'number' ? String(o.year) : ''
    const parts = [main, inst].filter(Boolean)
    let text = parts.join(' • ')
    if (year) text += ` (${year})`
    return text || '-'
  }
  return '-'
}

function describeCert(item: unknown): string {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object') {
    const o = item as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name : ''
    const issuer = typeof o.issuer === 'string' ? o.issuer : ''
    const year = typeof o.year === 'string' || typeof o.year === 'number' ? String(o.year) : ''
    let text = [name, issuer].filter(Boolean).join(' — ')
    if (year) text += ` (${year})`
    return text || '-'
  }
  return '-'
}

function initials(fullName: string): string {
  const words = (fullName || '').replace(/,.*$/, '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
}

function teachingYears(joinDate: string): number | null {
  const ts = new Date(joinDate).getTime()
  if (Number.isNaN(ts)) return null
  const years = Math.floor((Date.now() - ts) / (365.25 * 24 * 3600 * 1000))
  return years >= 0 ? years : 0
}

function yearsLabel(joinDate: string): string {
  const years = teachingYears(joinDate)
  if (years === null) return '—'
  if (years === 0) return '< 1 th mengajar'
  return `${years} th mengajar`
}

const AVATAR_COLORS: Record<string, string> = {
  L: 'bg-teal-100 text-teal-800 ring-teal-200',
  P: 'bg-amber-100 text-amber-800 ring-amber-200',
}

/**
 * Avatar guru: menampilkan foto (photoUrl) bila tersedia, dengan fallback
 * anggun ke avatar inisial berwarna gender bila foto kosong/gagal dimuat.
 * Instansi di-key oleh id+photoUrl di pemanggil — ganti/hapus foto dari admin
 * me-remount komponen sehingga status gagal muat ter-reset dengan sendirinya.
 */
function TeacherAvatar({
  teacher,
  className,
  ringClass,
}: {
  teacher: Teacher
  className?: string
  ringClass?: string
}) {
  const [broken, setBroken] = useState(false)

  const fallbackColorCls = AVATAR_COLORS[teacher.gender] ?? 'bg-stone-100 text-stone-700 ring-stone-200'

  if (!teacher.photoUrl || broken) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full text-xl font-bold ring-4',
          fallbackColorCls,
          className,
          ringClass,
        )}
      >
        {initials(teacher.fullName)}
      </span>
    )
  }

  return (
    <span className={cn('relative inline-block shrink-0', className)}>
      {/* Aksen artistik: ring amber halus bergeser di belakang foto */}
      <span
        aria-hidden="true"
        className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-full ring-2 ring-amber-400/60"
      />
      <span
        className={cn(
          'relative flex size-full items-center justify-center overflow-hidden rounded-full ring-4 ring-emerald-200',
          ringClass,
        )}
      >
        <img
          key={`${teacher.id}-${teacher.photoUrl}`}
          src={teacher.photoUrl}
          alt={`Foto ${teacher.fullName}`}
          // Perf: foto guru di bawah lipatan — lazy + decode async memangkas
          // bobot awal halaman (foto lama 2.6MB pernah membebani load awal).
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      </span>
    </span>
  )
}

function BiodataSection({ icon: Icon, title, children }: { icon: typeof User; title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-800">
        <Icon className="size-4 text-emerald-600" />
        {title}
      </h4>
      {children}
    </div>
  )
}

export function TeachersSection() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Teacher | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<Teacher[]>('/api/teachers')
      setTeachers(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data guru')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <section id="guru" className="relative scroll-mt-20 overflow-hidden bg-white py-16">
      {/* MAGIC-01 — bola cahaya melayang tone amber (selingan dgn section zamrud lain) */}
      <AmbientOrbs tone="amber" />
      <div className="relative mx-auto max-w-6xl px-4">
        {/* Heading — kaskade Velora-style */}
        <SectionHeading
          badge="Biodata Guru"
          title="Ustadz & Ustadzah Kami"
          subtitle={
            <>
              Pengajar bersanad dan tersertifikasi yang berpengalaman membimbing santri dengan penuh
              kelembutan.
            </>
          }
        />

        {/* Error */}
        {error && (
          <div className="mx-auto mb-8 flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertCircle className="size-6 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
            <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100" onClick={() => void load()}>
              <RefreshCw className="size-4" />
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-60 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && teachers.length === 0 && (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
            <Users className="mx-auto size-10 text-stone-300" />
            <p className="mt-3 text-sm text-stone-500">Belum ada data guru yang dipublikasikan.</p>
          </div>
        )}

        {/* Grid guru */}
        {!loading && !error && teachers.length > 0 && (
          <StaggerGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {teachers.map((teacher) => (
              // Velora SpotlightCard — kilau radial mengikuti kursor (warna --brand)
              <StaggerItem key={teacher.id}>
                <SpotlightCard
                  className="transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg"
                >
                  <div className="flex flex-col items-center p-6 text-center">
                    <TeacherAvatar key={`${teacher.id}-${teacher.photoUrl}`} teacher={teacher} className="size-16" />
                    <h3 className="mt-3 text-sm font-bold leading-snug text-stone-800">{teacher.fullName}</h3>
                    <p className="mt-1 text-xs text-emerald-700">{teacher.expertise}</p>
                    <Badge variant="outline" className="mt-3 border-amber-200 bg-amber-50 text-amber-700">
                      <Award className="size-3" />
                      {yearsLabel(teacher.joinDate)}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      onClick={() => setSelected(teacher)}
                    >
                      <Eye className="size-4" />
                      Lihat Profil
                    </Button>
                  </div>
                </SpotlightCard>
              </StaggerItem>
            ))}
          </StaggerGroup>
        )}
      </div>

      {/* Dialog biodata profesional */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-200">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:text-left">
                  <TeacherAvatar key={`${selected.id}-${selected.photoUrl}`} teacher={selected} className="size-16" />
                  <div className="text-center sm:text-left">
                    <DialogTitle className="text-xl leading-snug text-emerald-950">
                      {selected.gender === 'P' ? 'Ustadzah' : 'Ustadz'} {selected.fullName}
                    </DialogTitle>
                    <DialogDescription className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 sm:justify-start">
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="size-3.5 text-emerald-600" />
                        {selected.expertise}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5 text-amber-600" />
                        Bergabung {formatShortDate(selected.joinDate)}
                      </span>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5">
                {/* Pendidikan formal */}
                <BiodataSection icon={GraduationCap} title="Riwayat Pendidikan Formal">
                  {safeParseArray(selected.formalEducation).length > 0 ? (
                    <ul className="space-y-1.5">
                      {safeParseArray(selected.formalEducation).map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                          <span className="mt-1.5 size-1.5 shrink-0 rotate-45 bg-emerald-500" aria-hidden="true" />
                          {describeEdu(item)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm italic text-stone-400">Tidak ada data pendidikan formal.</p>
                  )}
                </BiodataSection>

                {/* Pendidikan non-formal */}
                <BiodataSection icon={ScrollText} title="Pendidikan Non-Formal">
                  {safeParseArray(selected.nonFormalEducation).length > 0 ? (
                    <ul className="space-y-1.5">
                      {safeParseArray(selected.nonFormalEducation).map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                          <span className="mt-1.5 size-1.5 shrink-0 rotate-45 bg-amber-500" aria-hidden="true" />
                          {describeEdu(item)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm italic text-stone-400">Tidak ada data pendidikan non-formal.</p>
                  )}
                </BiodataSection>

                {/* Sertifikasi */}
                <BiodataSection icon={BadgeCheck} title="Sertifikasi">
                  {safeParseArray(selected.certifications).length > 0 ? (
                    <ul className="space-y-1.5">
                      {safeParseArray(selected.certifications).map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                          <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                          {describeCert(item)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm italic text-stone-400">Belum ada sertifikasi tercatat.</p>
                  )}
                </BiodataSection>

                {/* Keahlian */}
                <BiodataSection icon={Sparkles} title="Keahlian">
                  <p className="text-sm leading-relaxed text-stone-600">{selected.expertise || '-'}</p>
                </BiodataSection>

                {/* Filosofi mengajar */}
                {selected.philosophy && (
                  <BiodataSection icon={Quote} title="Filosofi Mengajar">
                    <blockquote className="rounded-r-xl border-l-4 border-amber-400 bg-amber-50/70 py-3 pl-4 pr-3 text-sm italic leading-relaxed text-stone-700">
                      &ldquo;{selected.philosophy}&rdquo;
                    </blockquote>
                  </BiodataSection>
                )}

                {/* Bio */}
                <BiodataSection icon={User} title="Biografi Singkat">
                  <p className="text-sm leading-relaxed text-stone-600">{selected.bio || '-'}</p>
                </BiodataSection>

                {/* Kelas yang diampu */}
                <BiodataSection icon={School} title="Kelas yang Diampu">
                  {selected.classes && selected.classes.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selected.classes.map((cls) => (
                        <Badge key={cls.id} variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                          <BookOpen className="size-3" />
                          {cls.name}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm italic text-stone-400">Belum mengampu kelas tetap.</p>
                  )}
                </BiodataSection>
              </div>

              <Separator className="bg-stone-100" />
              <p className="text-center text-xs text-stone-400">
                Data biodata diverifikasi oleh administrasi TPQ Darul Jinan.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
