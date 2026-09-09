'use client'

import { useMemo } from 'react'
import { Check, Inbox } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { Hafalan } from '@/lib/types'

// ==== Juz 30 coverage map — Al-Fatihah + 37 surah pendek Juz 30 ====
// Juz 30 = surah 78 (An-Naba) hingga 114 (An-Nas), total 37 surah.
// Names use Indonesian transliteration; matching normalizes away
// apostrophes/hyphens so "An-Naba'" and "An-Naba" both resolve.

const JUZ30_SURAHS: ReadonlyArray<{ no: number; name: string }> = [
  { no: 1, name: 'Al-Fatihah' },
  { no: 78, name: 'An-Naba' },
  { no: 79, name: 'An-Naziat' },
  { no: 80, name: 'Abasa' },
  { no: 81, name: 'At-Takwir' },
  { no: 82, name: 'Al-Infitar' },
  { no: 83, name: 'Al-Mutaffifin' },
  { no: 84, name: 'Al-Insyiqaq' },
  { no: 85, name: 'Al-Buruj' },
  { no: 86, name: 'At-Tariq' },
  { no: 87, name: "Al-A'la" },
  { no: 88, name: 'Al-Ghasyiyah' },
  { no: 89, name: 'Al-Fajr' },
  { no: 90, name: 'Al-Balad' },
  { no: 91, name: 'Asy-Syams' },
  { no: 92, name: 'Al-Lail' },
  { no: 93, name: 'Ad-Duha' },
  { no: 94, name: 'Al-Insyirah' },
  { no: 95, name: 'At-Tin' },
  { no: 96, name: "Al-'Alaq" },
  { no: 97, name: 'Al-Qadr' },
  { no: 98, name: 'Al-Bayyinah' },
  { no: 99, name: 'Az-Zalzalah' },
  { no: 100, name: "Al-'Adiyat" },
  { no: 101, name: "Al-Qari'ah" },
  { no: 102, name: 'At-Takatsur' },
  { no: 103, name: "Al-'Asr" },
  { no: 104, name: 'Al-Humazah' },
  { no: 105, name: 'Al-Fil' },
  { no: 106, name: 'Quraisy' },
  { no: 107, name: "Al-Ma'un" },
  { no: 108, name: 'Al-Kautsar' },
  { no: 109, name: 'Al-Kafirun' },
  { no: 110, name: 'An-Nasr' },
  { no: 111, name: 'Al-Masad' },
  { no: 112, name: 'Al-Ikhlas' },
  { no: 113, name: 'Al-Falaq' },
  { no: 114, name: 'An-Nas' },
]

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const JUZ30_NORM: ReadonlyMap<string, { no: number; name: string }> = new Map(
  JUZ30_SURAHS.map((s) => [norm(s.name), s]),
)

const KKM = 70

type GradedHafalan = Hafalan & { grade: number }
type TrendPoint = { date: string; nilai: number; surah: string }

export function HafalanProgress({ hafalans }: { hafalans: Hafalan[] }) {
  // setoran count per matched Juz-30 surah (any record type counts as tercapai)
  const setoranCount = useMemo(() => {
    const count = new Map<string, number>()
    for (const h of hafalans) {
      const key = norm(h.surahName)
      if (JUZ30_NORM.has(key)) count.set(key, (count.get(key) ?? 0) + 1)
    }
    return count
  }, [hafalans])

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

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* a. Juz 30 coverage map */}
      <Card className="rounded-2xl border-stone-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Peta Hafalan Juz 30</CardTitle>
          <CardDescription>Cakupan setoran surat pendek, Al-Fatihah hingga An-Nas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
                return (
                  <span
                    key={s.no}
                    title={done ? `QS ${s.name} — sudah disetorkan ${count}x` : `QS ${s.name} — belum disetorkan`}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors ${
                      done
                        ? count > 1
                          ? 'border border-emerald-400 bg-emerald-100 text-emerald-900'
                          : 'bg-emerald-600 text-white'
                        : 'border border-stone-200 bg-stone-50 text-stone-400'
                    }`}
                  >
                    <span className={done ? 'opacity-70' : 'opacity-60'}>{s.no}</span>
                    {s.name}
                    {done && count > 1 && (
                      <span className="rounded-full bg-emerald-700/15 px-1 font-semibold">×{count}</span>
                    )}
                    {done && count === 1 && <Check className="size-3" strokeWidth={3} />}
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
                aria-label={`Grafik garis tren ${trend.length} nilai hafalan dari waktu ke waktu; garis putus-putus amber menandai batas minimal nilai ${KKM}.`}
                className="h-56 w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
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
                    <Line
                      type="monotone"
                      dataKey="nilai"
                      stroke="#047857"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: '#047857' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
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
