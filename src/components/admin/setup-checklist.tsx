'use client'

// Gelombang 10 (#13 matriks riset) — onboarding checklist berjenjang (ADMIN):
// "Profil lembaga → Ustadz → Kelas → Santri → Setoran hafalan" tampil di Ringkasan
// sampai semua langkah selesai (best practice SaaS 2025 — riset Bab 6.4 item #13).
// Data murni turunan /api/stats + /api/settings (TANPA endpoint baru); kartu
// menghilang sendiri saat 100% agar dashboard lembaga yang sudah matang tetap bersih.
// Hanya dirender untuk role ADMIN (langkah persiapan = kewenangan lembaga).

import { useEffect, useState } from 'react'
import { ArrowRight, CheckCircle2, Circle, ClipboardList } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { apiGet } from '@/lib/api-client'
import type { DashboardStats } from '@/lib/types'

/** Bentuk minimal settings untuk menilai kelengkapan profil lembaga. */
interface PortalSettingsShape {
  hero?: { title?: string; tagline?: string; logoUrl?: string }
}

type SetupTarget = 'landing' | 'teachers' | 'classes' | 'students' | 'hafalan'

interface SetupStep {
  key: string
  label: string
  hint: string
  done: boolean
  /** Resolusi null = settings belum termuat (item dikeluarkan dari hitungan agar tak flicker). */
  target: SetupTarget
}

export function SetupChecklist({
  stats,
  onNavigate,
}: {
  stats: DashboardStats
  onNavigate?: (key: SetupTarget) => void
}) {
  // null = settings sedang dimuat / gagal; false setelah gagal fetch (item tetap dinilai belum).
  const [profileDone, setProfileDone] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<PortalSettingsShape>('/api/settings')
      .then((s) => {
        if (!cancelled) setProfileDone(Boolean(s?.hero?.logoUrl))
      })
      .catch(() => {
        if (!cancelled) setProfileDone(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const steps: SetupStep[] = [
    {
      key: 'profile',
      label: 'Lengkapi profil lembaga',
      hint: 'Unggah logo agar tampil di portal publik',
      done: profileDone === true,
      target: 'landing',
    },
    {
      key: 'teachers',
      label: 'Tambah ustadz & ustadzah',
      hint: 'Minimal satu pengajar terdaftar',
      done: stats.teachers > 0,
      target: 'teachers',
    },
    {
      key: 'classes',
      label: 'Buat kelas',
      hint: 'Atur jadwal & pengampu kelas',
      done: stats.classes > 0,
      target: 'classes',
    },
    {
      key: 'students',
      label: 'Daftarkan santri',
      hint: 'Santri aktif terhubung ke kelas',
      done: stats.students > 0,
      target: 'students',
    },
    {
      key: 'hafalan',
      label: 'Catat setoran hafalan pertama',
      hint: 'Progres tahfizh santri mulai terlacak',
      done: stats.hafalanCount > 0,
      target: 'hafalan',
    },
  ]

  // Selama profil belum terkonfirmasi (null), item itu dikeluarkan dari pembilang & penyebut.
  const resolved = profileDone === null ? steps.filter((s) => s.key !== 'profile') : steps
  const doneCount = resolved.filter((s) => s.done).length
  const total = resolved.length
  const pct = total === 0 ? 100 : Math.round((doneCount / total) * 100)
  const allDone = doneCount === total

  // Lembaga yang sudah matang tidak perlu kartu ini lagi.
  if (allDone) return null

  return (
    <Card className="glow-soft rounded-2xl border-emerald-200/70 bg-gradient-to-br from-emerald-50/80 via-white to-white shadow-tier">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"
            aria-hidden="true"
          >
            <ClipboardList className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">Langkah Persiapan</CardTitle>
            <CardDescription>
              Selesaikan {total - doneCount} langkah lagi ({doneCount}/{total}) agar TPQ siap dipakai penuh.
            </CardDescription>
          </div>
          <span
            className="hidden shrink-0 text-2xl font-bold tabular-nums text-emerald-700 sm:block"
            aria-hidden="true"
          >
            {pct}%
          </span>
        </div>
        <Progress
          value={pct}
          aria-label={`Progres persiapan lembaga ${pct}%`}
          className="mt-3 h-2 bg-emerald-100 [&>div]:bg-emerald-600"
        />
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {steps.map((step, i) => {
            // Item yang belum selesai jadi tombol navigasi; yang selesai tampil statis.
            const clickable = !step.done && Boolean(onNavigate)
            return (
              <li key={step.key}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onNavigate?.(step.target)}
                  aria-label={
                    step.done
                      ? `${step.label} — selesai`
                      : `${step.label} — belum selesai${clickable ? ', buka menu terkait' : ''}`
                  }
                  className={
                    'group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ' +
                    (clickable
                      ? 'cursor-pointer hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600'
                      : 'cursor-default')
                  }
                >
                  {step.done ? (
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Circle className="size-5 shrink-0 text-stone-300 transition-colors group-hover:text-emerald-600" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 leading-tight">
                    <span
                      className={
                        'block truncate text-sm ' + (step.done ? 'font-medium text-stone-400 line-through' : 'font-semibold text-stone-800')
                      }
                    >
                      {i + 1}. {step.label}
                    </span>
                    <span className="block truncate text-[11px] text-stone-500">{step.hint}</span>
                  </span>
                  {clickable && (
                    <ArrowRight
                      className="size-4 shrink-0 text-emerald-600 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
