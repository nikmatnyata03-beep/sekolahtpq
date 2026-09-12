'use client'

import { useMemo, type JSX } from 'react'
import { CalendarRange } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatShortDate } from '@/lib/api-client'

// ==== contract ====

export type AttendanceStatus = 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA'

export interface AttendancePoint {
  id: string
  status: AttendanceStatus
  /** ISO date string, e.g. "2026-09-10" or "2026-09-10T00:00:00.000Z". */
  date: string
  topic: string | null
  className: string
}

export interface MonthAgg {
  /** Month key "YYYY-MM". */
  key: string
  /** Indonesian short label, e.g. "Sep 2026". */
  label: string
  hadir: number
  izin: number
  sakit: number
  alpa: number
  /** Pertemuan tercatat in the month. */
  total: number
  /** Math.round(hadir / total * 100), 0 when total is 0. */
  rate: number
}

// ==== status visuals — hues mirror child-panel.tsx (ATTENDANCE_CHIP / RAPOR_ATT_DOT) ====

const BAR_SEGMENT: Record<AttendanceStatus, string> = {
  HADIR: 'bg-emerald-500',
  IZIN: 'bg-amber-500',
  SAKIT: 'bg-orange-500',
  ALPA: 'bg-red-500',
}

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  HADIR: 'Hadir',
  IZIN: 'Izin',
  SAKIT: 'Sakit',
  ALPA: 'Alpa',
}

const STATUS_COUNT_KEY: Record<AttendanceStatus, 'hadir' | 'izin' | 'sakit' | 'alpa'> = {
  HADIR: 'hadir',
  IZIN: 'izin',
  SAKIT: 'sakit',
  ALPA: 'alpa',
}

const STATUS_ORDER: readonly AttendanceStatus[] = ['HADIR', 'IZIN', 'SAKIT', 'ALPA']

const MAX_MONTHS = 6

function rateChipClass(rate: number): string {
  if (rate >= 85) return 'bg-emerald-100 text-emerald-800'
  if (rate >= 70) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

// ==== monthly aggregation ====

const MONTH_KEY_RE = /^(\d{4})-(\d{2})/

/** Deterministic "YYYY-MM" key — prefers the date-string prefix (timezone-safe), falls back to Date parse. */
function monthKeyOf(date: string): string | null {
  const m = MONTH_KEY_RE.exec(date)
  if (m) return `${m[1]}-${m[2]}`
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function dateFromKey(key: string): Date {
  const [y, m] = key.split('-').map(Number)
  // Day 12 avoids month-name drift across timezones/DST.
  return new Date(y, m - 1, 1, 12)
}

function monthLabel(key: string): string {
  return dateFromKey(key).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
}

function monthLabelLong(key: string): string {
  return dateFromKey(key).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

/** Deterministic day-of-month ("05") — prefers the ISO date-string prefix, falls back to Date parse. */
function dayNumberOf(date: string): string {
  if (MONTH_KEY_RE.test(date)) return date.slice(8, 10)
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '·'
  return String(d.getDate()).padStart(2, '0')
}

/**
 * Attendance points grouped per month ("YYYY-MM"), newest month first, sessions
 * ascending within a month (older left → newer right) — mirroring the admin heat-grid.
 */
interface HeatMonth {
  key: string
  label: string
  points: AttendancePoint[]
}

function groupHeatMonths(attendances: AttendancePoint[]): HeatMonth[] {
  const sorted = [...attendances].sort((a, b) => a.date.localeCompare(b.date))
  const byMonth = new Map<string, AttendancePoint[]>()
  for (const a of sorted) {
    const key = monthKeyOf(a.date)
    if (!key) continue
    const arr = byMonth.get(key)
    if (arr) arr.push(a)
    else byMonth.set(key, [a])
  }
  return [...byMonth.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, MAX_MONTHS)
    .map(([key, points]) => ({ key, label: monthLabel(key), points }))
}

/**
 * Group attendance records per month ("YYYY-MM"), newest first.
 * Returns at most the 6 most recent months that have data.
 */
export function aggregateMonthly(attendances: AttendancePoint[]): MonthAgg[] {
  const buckets = new Map<string, MonthAgg>()
  for (const a of attendances) {
    const key = monthKeyOf(a.date)
    if (!key) continue
    let agg = buckets.get(key)
    if (!agg) {
      agg = { key, label: monthLabel(key), hadir: 0, izin: 0, sakit: 0, alpa: 0, total: 0, rate: 0 }
      buckets.set(key, agg)
    }
    agg.total += 1
    if (a.status === 'HADIR') agg.hadir += 1
    else if (a.status === 'IZIN') agg.izin += 1
    else if (a.status === 'SAKIT') agg.sakit += 1
    else if (a.status === 'ALPA') agg.alpa += 1
  }
  const months = [...buckets.values()]
  for (const m of months) m.rate = m.total > 0 ? Math.round((m.hadir / m.total) * 100) : 0
  months.sort((a, b) => b.key.localeCompare(a.key))
  return months.slice(0, MAX_MONTHS)
}

// ==== component ====

export function AttendanceRecap({ attendances }: { attendances: AttendancePoint[] }): JSX.Element | null {
  const months = useMemo(() => aggregateMonthly(attendances), [attendances])
  const heatMonths = useMemo(() => groupHeatMonths(attendances), [attendances])
  // When the santri attends more than one class, tooltip must disambiguate which class the session belonged to.
  const multiClass = useMemo(() => new Set(attendances.map((a) => a.className)).size > 1, [attendances])
  if (attendances.length === 0 || months.length === 0) return null

  // Legend shows only statuses actually present in the (visible) data.
  const presentStatuses = STATUS_ORDER.filter((st) => months.some((m) => m[STATUS_COUNT_KEY[st]] > 0))

  return (
    <Card className="rounded-2xl border-stone-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 text-base">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"
            aria-hidden="true"
          >
            <CalendarRange className="size-5" />
          </span>
          Rekap Kehadiran Bulanan
        </CardTitle>
        <CardDescription>Ringkasan per bulan dari 30 pertemuan terakhir.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          {months.map((m) => {
            const longLabel = monthLabelLong(m.key)
            const barTitle = STATUS_ORDER.map((st) => `${st} ${m[STATUS_COUNT_KEY[st]]}`).join(' · ')
            const rowTitle = `${longLabel} — ${m.total} pertemuan tercatat · ${m.rate}% kehadiran`
            const ariaLabel = `${longLabel}: ${m.hadir} hadir, ${m.izin} izin, ${m.sakit} sakit, ${m.alpa} alpa — ${m.rate}% kehadiran`
            return (
              <div
                key={m.key}
                className="flex items-center gap-3 rounded-lg px-1.5 py-2 transition-colors hover:bg-stone-50"
                title={rowTitle}
              >
                <span className="w-20 shrink-0 text-xs font-semibold text-stone-700">{m.label}</span>
                <div
                  className="flex h-3.5 flex-1 overflow-hidden rounded-full bg-stone-100"
                  role="img"
                  aria-label={ariaLabel}
                  title={barTitle}
                >
                  {STATUS_ORDER.map((st) => {
                    const count = m[STATUS_COUNT_KEY[st]]
                    if (count === 0) return null
                    return (
                      <span
                        key={st}
                        className={`min-w-[2px] ${BAR_SEGMENT[st]}`}
                        style={{ flexGrow: count, flexBasis: 0 }}
                      />
                    )
                  })}
                </div>
                <div className="flex w-16 shrink-0 flex-col items-end gap-0.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${rateChipClass(m.rate)}`}
                  >
                    {m.rate}%
                  </span>
                  <span className="text-[11px] text-stone-500">
                    {m.hadir}/{m.total}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {presentStatuses.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1">
            {presentStatuses.map((st) => (
              <span key={st} className="inline-flex items-center gap-1.5 text-[11px] text-stone-500">
                <span className={`size-2 rounded-full ${BAR_SEGMENT[st]}`} aria-hidden="true" />
                {STATUS_LABEL[st]}
              </span>
            ))}
          </div>
        )}

        {/* Gelombang 6 (#12 portal wali): peta kehadiran per pertemuan ala contribution graph —
            pola hadir/alpa sepanjang bulan langsung terlihat tanpa membaca angka.
            Warna sel memakai BAR_SEGMENT yang sama dengan bar bulanan di atas (konsisten). */}
        {heatMonths.length > 0 && (
          <div className="rounded-xl border border-stone-100 bg-stone-50/60 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Peta Kehadiran</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {presentStatuses.map((st) => (
                  <span key={st} className="flex items-center gap-1 text-[10px] text-stone-500">
                    <span aria-hidden="true" className={`size-2 rounded-[3px] ${BAR_SEGMENT[st]}`} /> {STATUS_LABEL[st]}
                  </span>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
              <div className="min-w-max space-y-2.5">
                {heatMonths.map((month) => (
                  <div key={month.key}>
                    {/* Baris angka tanggal (per bulan, karena tanggal tiap bulan berbeda) */}
                    <div className="flex items-end gap-1">
                      <span className="sticky left-0 z-10 w-20 shrink-0 bg-stone-50 pr-2 text-[11px] font-semibold text-stone-700">
                        {month.label}
                      </span>
                      {month.points.map((a) => (
                        <span
                          key={`d-${a.id}`}
                          className="w-5 shrink-0 text-center font-mono text-[9px] leading-none text-stone-400 tabular-nums"
                        >
                          {dayNumberOf(a.date)}
                        </span>
                      ))}
                    </div>
                    {/* Baris sel status */}
                    <div className="mt-1 flex items-center gap-1">
                      <span className="sticky left-0 z-10 w-20 shrink-0 bg-stone-50 pr-2" aria-hidden="true" />
                      {month.points.map((a) => {
                        const tip =
                          `${formatShortDate(a.date)} — ${STATUS_LABEL[a.status]}` +
                          (a.topic ? ` · ${a.topic}` : '') +
                          (multiClass ? ` · ${a.className}` : '')
                        return (
                          <span
                            key={a.id}
                            role="img"
                            title={tip}
                            aria-label={tip}
                            className={`size-5 shrink-0 rounded-[4px] transition-transform duration-150 hover:scale-110 ${BAR_SEGMENT[a.status]}`}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-2 text-[10px] text-stone-400">
              Angka di atas sel = tanggal pertemuan. Arahkan kursor untuk melihat status &amp; materi hari itu.
            </p>
          </div>
        )}

        <p className="text-[11px] text-stone-400">Persentase = hadir ÷ total pertemuan tercatat bulan tersebut.</p>
      </CardContent>
    </Card>
  )
}
