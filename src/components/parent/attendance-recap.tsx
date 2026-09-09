'use client'

import { useMemo, type JSX } from 'react'
import { CalendarRange } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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

        <p className="text-[11px] text-stone-400">Persentase = hadir ÷ total pertemuan tercatat bulan tersebut.</p>
      </CardContent>
    </Card>
  )
}
