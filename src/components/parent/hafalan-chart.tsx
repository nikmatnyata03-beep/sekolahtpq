'use client'

import { useMemo } from 'react'
import { Check, CheckCircle2, Inbox, Target } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { Hafalan } from '@/lib/types'
// Juz-30 map + normalizer dipindah ke lib bersama (Task 13-a) supaya modul
// guru/admin menghitung target dengan logika yang sama persis.
import { JUZ30_NORM, JUZ30_SURAHS, norm, resolveNorm } from '@/lib/hafalan-utils'

const KKM = 70

type GradedHafalan = Hafalan & { grade: number }
type TrendPoint = { date: string; nilai: number; surah: string }
type TargetInfo = { surah: { no: number; name: string }; position: number }

export function HafalanProgress({ hafalans, target }: { hafalans: Hafalan[]; target?: string | null }) {
  // setoran count per matched Juz-30 surah (any record type counts as tercapai)
  const setoranCount = useMemo(() => {
    const count = new Map<string, number>()
    for (const h of hafalans) {
      const key = resolveNorm(h.surahName)
      if (JUZ30_NORM.has(key)) count.set(key, (count.get(key) ?? 0) + 1)
    }
    return count
  }, [hafalans])

  // target hafalan (opsional): posisi surah target dalam urutan peta Juz 30
  const targetInfo = useMemo<TargetInfo | null>(() => {
    if (!target || !target.trim()) return null
    const idx = JUZ30_SURAHS.findIndex((s) => norm(s.name) === resolveNorm(target))
    if (idx === -1) return null // target di luar Juz 30 — strip sengaja disembunyikan
    return { surah: JUZ30_SURAHS[idx], position: idx + 1 }
  }, [target])

  // surah sebelum/sama dengan target yang sudah disetorkan
  const targetReached = useMemo(
    () =>
      targetInfo
        ? JUZ30_SURAHS.slice(0, targetInfo.position).filter((s) => (setoranCount.get(norm(s.name)) ?? 0) > 0).length
        : 0,
    [targetInfo, setoranCount],
  )
  const targetPercent = targetInfo ? Math.round((targetReached / targetInfo.position) * 100) : 0
  const targetDone = targetInfo ? (setoranCount.get(norm(targetInfo.surah.name)) ?? 0) > 0 : false

  const tercapai = JUZ30_SURAHS.filter((s) => (setoranCount.get(norm(s.name)) ?? 0) > 0).length
  const percent = Math.round((tercapai / JUZ30_SURAHS.length) * 100)

  // grades over time (oldest -> newest)
  const graded = useMemo(
    () => hafalans.filter((h): h is GradedHafalan => h.grade !== null).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [hafalans],
  )

  const trend = useMemo<TrendPoint[]>(
    () =>
      graded.map((h) => {
        const d = new Date(h.createdAt)
        return {
          date: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
          nilai: h.grade,
          surah: h.surahName,
        }
      }),
    [graded],
  )

  const avg = graded.length > 0 ? Math.round(graded.reduce((sum, h) => sum + h.grade, 0) / graded.length) : null
  const avgClass =
    avg === null
      ? ''
      : avg >= 85
        ? 'bg-emerald-100 text-emerald-800'
        : avg >= KKM
          ? 'bg-amber-100 text-amber-800'
          : 'bg-red-100 text-red-700'

  // Gelombang 11 (#14): titik terakhir grafik "menyala" — halo berlapis di sekeliling dot
  // (pola riset: glow pada titik terakhir = fokus mata ke capaian terbaru).
  const renderDot = (props: { cx?: number; cy?: number; index?: number }) => {
    const { cx, cy, index = 0 } = props
    if (cx == null || cy == null) return <g />
    if (index !== trend.length - 1) return <circle cx={cx} cy={cy} r={3} fill="#047857" />
    return (
      <g>
        <circle cx={cx} cy={cy} r={9} fill="#047857" opacity={0.16} />
        <circle cx={cx} cy={cy} r={5.5} fill="#047857" opacity={0.32} />
        <circle cx={cx} cy={cy} r={3.5} fill="#047857" stroke="#ffffff" strokeWidth={1.5} />
      </g>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* a. Juz 30 coverage map */}
      <Card className="rounded-2xl border-stone-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Peta Hafalan Juz 30</CardTitle>
          <CardDescription>Cakupan setoran surat pendek, Al-Fatihah hingga An-Nas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* strip target hafalan (hanya bila ustadz menetapkan target Juz 30) */}
          {targetInfo && (
            <div
              role="status"
              aria-label={`Target hafalan ${targetInfo.surah.name}: ${targetReached} dari ${targetInfo.position} surah tercapai (${targetPercent}%).`}
              className="rounded-xl border border-amber-200 bg-amber-50 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <Target className="size-4" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold text-amber-900">Target: {targetInfo.surah.name}</p>
                  {targetDone && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      <CheckCircle2 className="size-3" strokeWidth={2.5} aria-hidden="true" /> Tercapai
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold tabular-nums text-amber-800">
                  {targetReached}/{targetInfo.position} surah
                </span>
              </div>
              <Progress
                value={targetPercent}
                aria-label={`Progres menuju target ${targetInfo.surah.name}: ${targetPercent}%`}
                className="mt-2 h-1.5 bg-amber-200 [&>div]:bg-amber-500"
              />
              <p className="mt-1.5 text-[11px] font-medium text-amber-700">
                {targetPercent}% progres menuju target
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <p className="font-medium text-stone-700">
                <span className="font-bold text-emerald-700">{tercapai}</span> dari {JUZ30_SURAHS.length} surah tercapai
              </p>
              <span className="text-xs font-semibold text-stone-500">{percent}%</span>
            </div>
            <Progress
              value={percent}
              aria-label={`Cakupan hafalan Juz 30: ${percent}%`}
              className="h-2 bg-stone-200 [&>div]:bg-emerald-600"
            />
          </div>

          <div
            role="img"
            aria-label={`Peta hafalan Juz 30: ${tercapai} dari ${JUZ30_SURAHS.length} surah sudah tercapai.`}
            className="max-h-56 overflow-y-auto pr-1 [scrollbar-width:thin]"
          >
            <div className="flex flex-wrap gap-1.5">
              {JUZ30_SURAHS.map((s) => {
                const count = setoranCount.get(norm(s.name)) ?? 0
                const done = count > 0
                const isTarget = targetInfo?.surah.no === s.no
                return (
                  <span
                    key={s.no}
                    title={
                      (done ? `QS ${s.name} — sudah disetorkan ${count}x` : `QS ${s.name} — belum disetorkan`) +
                      (isTarget ? ' · TARGET hafalan' : '')
                    }
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${
                      done
                        ? count > 1
                          ? 'border border-emerald-400 bg-emerald-100 text-emerald-900'
                          : 'bg-emerald-600 text-white'
                        : 'border border-stone-200 bg-stone-50 text-stone-400'
                    } ${isTarget ? 'ring-2 ring-amber-400' : ''}`}
                  >
                    <span className={done ? 'opacity-70' : 'opacity-60'}>{s.no}</span>
                    {s.name}
                    {done && count > 1 && (
                      <span className="rounded-full bg-emerald-700/15 px-1 font-semibold">×{count}</span>
                    )}
                    {done && count === 1 && <Check className="size-3" strokeWidth={3} />}
                    {isTarget && <Target className="size-3 text-amber-500" aria-hidden="true" />}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-stone-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-600" /> Sudah tercapai
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full border border-stone-300 bg-stone-100" /> Belum
            </span>
            {targetInfo && (
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full ring-2 ring-amber-400" /> Target hafalan
              </span>
            )}
            <span className="text-stone-400">Peta mengikuti cakupan Juz 30 (hafalan surat pendek).</span>
          </div>
        </CardContent>
      </Card>

      {/* b. Grade trend line chart */}
      <Card className="rounded-2xl border-stone-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Tren Nilai Hafalan</CardTitle>
          <CardDescription>Perkembangan nilai setoran dari waktu ke waktu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {avg !== null && (
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${avgClass}`}>
              Rata-rata: {avg}
            </span>
          )}

          {trend.length < 2 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-stone-50 py-8 text-center">
              <Inbox className="size-6 text-stone-300" />
              <p className="text-sm text-stone-500">Belum cukup data nilai untuk menampilkan tren.</p>
              <p className="text-xs text-stone-400">
                Saat ini {graded.length} setoran bernilai tercatat — tren muncul setelah minimal 2 setoran dinilai.
              </p>
            </div>
          ) : (
            <>
              <div
                role="img"
                aria-label={`Grafik area tren ${trend.length} nilai hafalan dari waktu ke waktu; area bergradasi zamrud, titik terakhir menyala menandai capaian terbaru, garis putus-putus amber menandai batas minimal nilai ${KKM}.`}
                className="h-56 w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  {/* Gelombang 11 (#14): grafik hafalan bercahaya — area bergradasi
                      zamrud→transparan di bawah garis, titik terakhir ber-halo. */}
                  <AreaChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                    <defs>
                      <linearGradient id="hafalanAreaGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#047857" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="#047857" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#78716c' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tick={{ fontSize: 11, fill: '#78716c' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [`${value}`, 'Nilai']}
                      labelFormatter={(_, payload) => {
                        const surah = (payload?.[0]?.payload as TrendPoint | undefined)?.surah
                        return surah ? `QS ${surah}` : ''
                      }}
                      contentStyle={{ borderRadius: 12, borderColor: '#e7e5e4', fontSize: 12 }}
                    />
                    <ReferenceLine y={KKM} stroke="#d97706" strokeDasharray="4 4" />
                    <Area
                      type="monotone"
                      dataKey="nilai"
                      stroke="#047857"
                      strokeWidth={2.5}
                      fill="url(#hafalanAreaGlow)"
                      dot={renderDot}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="flex items-center gap-2 text-[11px] text-stone-500">
                <span aria-hidden="true" className="inline-block w-6 border-t-2 border-dashed border-amber-600" />
                Garis putus-putus kuning = batas minimal nilai (KKM {KKM}).
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
