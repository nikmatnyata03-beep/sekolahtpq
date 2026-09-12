'use client'

// Kurikulum — materi kurikulum TPQ (dikelompokkan per mata pelajaran dengan
// warna badge berbeda) + jadwal kelas dari /api/curriculum dan /api/classes.

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  Clock,
  Heart,
  MapPin,
  Moon,
  RefreshCw,
  ScrollText,
  Star,
  Target,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet } from '@/lib/api-client'
import type { ClassRoom, CurriculumItem } from '@/lib/types'
import { AmbientOrbs, SectionHeading, StaggerGroup, StaggerItem } from './motion-primitives'
import { TiltCard } from './tilt-card'

const SUBJECT_STYLES: Record<string, { badge: string; chip: string; icon: typeof BookOpen }> = {
  TAJWID: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    chip: 'bg-emerald-50 text-emerald-700',
    icon: ScrollText,
  },
  HAFALAN: {
    badge: 'border-amber-200 bg-amber-50 text-amber-800',
    chip: 'bg-amber-50 text-amber-700',
    icon: Star,
  },
  IBADAH: {
    badge: 'border-teal-200 bg-teal-50 text-teal-800',
    chip: 'bg-teal-50 text-teal-700',
    icon: Moon,
  },
  AKHLAK: {
    badge: 'border-rose-200 bg-rose-50 text-rose-800',
    chip: 'bg-rose-50 text-rose-700',
    icon: Heart,
  },
}

const FALLBACK_STYLE = {
  badge: 'border-stone-200 bg-stone-100 text-stone-700',
  chip: 'bg-stone-100 text-stone-600',
  icon: BookOpen,
}

const LEVEL_LABELS: Record<string, string> = {
  IQRA: 'Jilid Iqra',
  TAHFIDZ: 'Tahfidz Al-Qur\u2019an',
  AL_QURAN: 'Al-Qur\u2019an',
}

function subjectStyle(subject: string) {
  return SUBJECT_STYLES[subject?.toUpperCase()] ?? FALLBACK_STYLE
}

function levelLabel(level: string) {
  return LEVEL_LABELS[level] ?? level
}

export function CurriculumSection() {
  const [curricula, setCurricula] = useState<CurriculumItem[]>([])
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [curriculaData, classesData] = await Promise.all([
        apiGet<CurriculumItem[]>('/api/curriculum'),
        apiGet<ClassRoom[]>('/api/classes'),
      ])
      setCurricula(Array.isArray(curriculaData) ? curriculaData : [])
      setClasses(Array.isArray(classesData) ? classesData : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat kurikulum')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Kelompokkan per mata pelajaran (pertahankan urutan `order`)
  const subjects: string[] = []
  for (const item of curricula) {
    const s = (item.subject ?? '').toUpperCase()
    if (s && !subjects.includes(s)) subjects.push(s)
  }

  return (
    <section id="kurikulum" className="relative scroll-mt-20 overflow-hidden bg-stone-50 py-16">
      {/* MAGIC-01 — bola cahaya melayang (dekorasi latar) */}
      <AmbientOrbs />
      <div className="relative mx-auto max-w-6xl px-4">
        {/* Heading — kaskade badge → judul → garis emas → subjudul */}
        <SectionHeading
          badge="Kurikulum"
          title="Kurikulum Pembelajaran"
          subtitle={
            <>
              Materi pelajaran TPQ Darul Jinan mengacu pada kurikulum standar Kemenag RI — dibimbing
              bertahap dari Iqra hingga hafalan Al-Qur&apos;an.
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
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Daftar kurikulum */}
        {!loading && !error && curricula.length === 0 && (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <BookOpen className="mx-auto size-10 text-stone-300" />
            <p className="mt-3 text-sm text-stone-500">Belum ada data kurikulum yang dipublikasikan.</p>
          </div>
        )}

        {!loading && !error && curricula.length > 0 && (
          <div className="max-h-[36rem] space-y-8 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-200 [&::-webkit-scrollbar-track]:bg-transparent">
            {subjects.map((subject) => {
              const style = subjectStyle(subject)
              const items = curricula.filter((c) => (c.subject ?? '').toUpperCase() === subject)
              return (
                <div key={subject}>
                  <div className="mb-4 flex items-center gap-2">
                    <span className={`flex size-8 items-center justify-center rounded-lg ${style.chip}`}>
                      <style.icon className="size-4" />
                    </span>
                    <h3 className="text-lg font-bold text-stone-800">
                      {subject.charAt(0) + subject.slice(1).toLowerCase()}
                    </h3>
                    <Badge variant="outline" className={style.badge}>
                      {items.length} materi
                    </Badge>
                  </div>
                  <StaggerGroup className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                      <StaggerItem key={item.id}>
                        <TiltCard className="rounded-2xl" max={7} lift={4}>
                          <div
                            className="flex h-full flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                          >
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={style.badge}>
                                {item.subject}
                              </Badge>
                              <Badge variant="outline" className="border-stone-200 bg-stone-50 text-stone-600">
                                {levelLabel(item.level)}
                              </Badge>
                            </div>
                            <p className="flex-1 text-sm leading-relaxed text-stone-600">{item.description}</p>
                            <div className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed ${style.chip}`}>
                              <Target className="mt-0.5 size-3.5 shrink-0" />
                              <span>
                                <span className="font-semibold">Capaian: </span>
                                {item.target}
                              </span>
                            </div>
                          </div>
                        </TiltCard>
                      </StaggerItem>
                    ))}
                  </StaggerGroup>
                </div>
              )
            })}
          </div>
        )}

        {/* Jadwal kelas */}
        {!loading && !error && classes.length > 0 && (
          <div className="mt-12">
            <h3 className="mb-4 text-center text-lg font-bold text-stone-800">Jadwal Kelas Belajar</h3>
            <StaggerGroup className="flex flex-wrap items-stretch justify-center gap-3" amount={0.1}>
              {classes.map((cls) => (
                <StaggerItem key={cls.id}>
                  <div
                    className="flex h-full flex-col gap-1 rounded-2xl border border-emerald-100 bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
                  >
                    <span className="flex items-center gap-2 text-sm font-bold text-emerald-900">
                      <BookOpen className="size-3.5 text-emerald-600" />
                      {cls.name}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-stone-500">
                      <Clock className="size-3 shrink-0 text-amber-500" />
                      {cls.schedule || 'Jadwal menyusul'}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-stone-500">
                      <MapPin className="size-3 shrink-0 text-rose-400" />
                      {cls.room || 'Ruang fleksibel'}
                      {typeof cls.studentCount === 'number' && (
                        <span className="ml-1 text-emerald-700">• {cls.studentCount} santri</span>
                      )}
                    </span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        )}
      </div>
    </section>
  )
}
