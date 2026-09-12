'use client'

// Gelombang 4.5 — item #10 matriks riset: kartu "Insight Hari Ini" (ADMIN).
// Lintas-domain: presensi + hafalan + keuangan + PPDB → poin prioritas siap
// tindak-lanjut. Data dari /api/insights/today (deterministik, tanpa AI).
// Gagal fetch → kartu hilang senyap (overview tetap berfungsi penuh).
import { useEffect, useState } from 'react'
import { CalendarCheck, BookMarked, Wallet, ClipboardList, Sparkles, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface InsightsToday {
  dateLabel: string
  presensi: {
    total: number
    hadir: number
    alpa: number
    izin: number
    sakit: number
    persenHadir: number
  } | null
  hafalan: { setoran: number; rataNilai: number | null } | null
  keuangan?: { tagihanPending: number }
  ppdb?: { menunggu: number }
}

interface Insight {
  icon: LucideIcon
  tone: 'emerald' | 'amber' | 'red' | 'stone'
  text: string
}

const TONE_CLASS: Record<Insight['tone'], string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber: 'bg-amber-50 text-amber-800 border-amber-200/70',
  red: 'bg-red-50 text-red-700 border-red-200/70',
  stone: 'bg-stone-50 text-stone-600 border-stone-200',
}

function buildInsights(d: InsightsToday): Insight[] {
  const out: Insight[] = []
  const p = d.presensi
  if (p && p.total > 0) {
    if (p.alpa > 0) {
      out.push({
        icon: CalendarCheck,
        tone: 'red',
        text: `${p.alpa} catatan ALPA hari ini — layak ditindak dengan wali.`,
      })
    }
    out.push({
      icon: CalendarCheck,
      tone: p.persenHadir >= 85 ? 'emerald' : 'amber',
      text: `Kehadiran hari ini ${p.persenHadir}% (${p.hadir}/${p.total} catatan, ${p.izin + p.sakit} izin/sakit).`,
    })
  } else {
    out.push({ icon: CalendarCheck, tone: 'stone', text: 'Belum ada sesi presensi tercatat hari ini.' })
  }
  if (d.hafalan && d.hafalan.setoran > 0) {
    out.push({
      icon: BookMarked,
      tone: 'emerald',
      text: `${d.hafalan.setoran} setoran hafalan${d.hafalan.rataNilai !== null ? ` · rata-rata nilai ${d.hafalan.rataNilai}` : ''}.`,
    })
  } else if (d.hafalan) {
    out.push({ icon: BookMarked, tone: 'stone', text: 'Belum ada setoran hafalan hari ini.' })
  }
  if (d.keuangan && d.keuangan.tagihanPending > 0) {
    out.push({
      icon: Wallet,
      tone: 'amber',
      text: `${d.keuangan.tagihanPending} tagihan menunggu pembayaran — pantau di Keuangan.`,
    })
  }
  if (d.ppdb && d.ppdb.menunggu > 0) {
    out.push({
      icon: ClipboardList,
      tone: 'amber',
      text: `${d.ppdb.menunggu} pendaftar PPDB menunggu verifikasi.`,
    })
  }
  return out
}

export function InsightToday() {
  const [data, setData] = useState<InsightsToday | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/insights/today')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: InsightsToday) => {
        if (alive) setData(j)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [])

  if (failed) return null
  const insights = data ? buildInsights(data) : null

  return (
    <Card className="glass shadow-tier rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-emerald-700" /> Insight Hari Ini
        </CardTitle>
        <CardDescription>
          {data ? `Ringkasan prioritas ${data.dateLabel} (WIB)` : 'Menyiapkan ringkasan…'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!insights && (
          <div className="space-y-2">
            <Skeleton className="h-10 rounded-xl bg-stone-200/60" />
            <Skeleton className="h-10 rounded-xl bg-stone-200/60" />
          </div>
        )}
        {insights && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {insights.map((it, i) => (
              <li
                key={i}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm leading-snug ${TONE_CLASS[it.tone]}`}
              >
                <it.icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="font-medium">{it.text}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
