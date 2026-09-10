'use client'

// Weekly teaching timetable for the GURU landing view (Task 11-b).
// Parses free-form class.schedule strings ("Senin, Rabu — 15.30-17.00",
// "Senin-Kamis — 16.00-18.00", "Senin, Rabu, Jumat — 15.30-17.30") into a
// Senin–Sabtu day grid (Ahad column appears only when a class uses it).
// Pure rendering from the already-loaded classes array — no fetches, no
// backend changes. Unrecognized schedule strings surface in a fallback list
// so data is never silently dropped.

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, MapPin } from 'lucide-react'
import type { ClassRoom } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// ==== Schedule parser ====

/** Canonical day index: 0=Senin … 5=Sabtu, 6=Ahad/Minggu. */
type DayKey = 0 | 1 | 2 | 3 | 4 | 5 | 6

const DAY_LABELS: Record<DayKey, string> = {
  0: 'Senin',
  1: 'Selasa',
  2: 'Rabu',
  3: 'Kamis',
  4: 'Jumat',
  5: 'Sabtu',
  6: 'Ahad',
}

// Common Indonesian day-name variants/typos → canonical DayKey.
// Normalization strips apostrophes (jum'at → jumat) and non-letters first.
const DAY_ALIASES: Record<string, DayKey> = {
  senin: 0,
  senen: 0,
  selasa: 1,
  slasa: 1,
  rabu: 2,
  rebo: 2,
  kamis: 3,
  kemis: 3,
  jumat: 4,
  jumad: 4,
  jumuat: 4,
  sabtu: 5,
  sabt: 5,
  ahad: 6,
  minggu: 6,
}

function normalizeDayName(raw: string): string {
  // lowercase, drop apostrophes/quotes (incl. U+2019), keep a-z only
  return raw
    .toLowerCase()
    .replace(/['\u2019`]/g, '')
    .replace(/[^a-z]/g, '')
}

// "15.30-17.00" / "15:30–17:00" — dots or colons, any dash variant.
const TIME_RANGE_RE = /(\d{1,2})\s*[.:]\s*(\d{2})\s*[-–—]\s*(\d{1,2})\s*[.:]\s*(\d{2})/

export interface ParsedSchedule {
  days: DayKey[]
  /** "15.30" */
  start: string
  /** "17.00" */
  end: string
}

/**
 * Robust parser for class schedule strings. Days may be comma-separated,
 * hyphen-ranged ("Senin-Kamis" expands inclusive, wraps across the week),
 * and written with common variants (Jum'at, Ahad, Minggu). The time range is
 * located first (it is the only "HH.MM-HH.MM" pattern) so em-dash/en-dash/
 * hyphen separators between days and time all work. Returns null when the
 * string is not recognized so callers can surface it in a fallback list.
 */
export function parseWeeklySchedule(raw: string | null | undefined): ParsedSchedule | null {
  if (!raw) return null
  const text = raw.replace(/[\u2013\u2014\u2212]/g, '-')
  const timeMatch = text.match(TIME_RANGE_RE)
  if (!timeMatch || timeMatch.index === undefined) return null

  const start = `${timeMatch[1].padStart(2, '0')}.${timeMatch[2]}`
  const end = `${timeMatch[3].padStart(2, '0')}.${timeMatch[4]}`
  // Day part = everything before the time range; drop the " — " separator
  // residue (trailing dash runs) so "Senin-Kamis - " → "Senin-Kamis".
  const dayPart = text
    .slice(0, timeMatch.index)
    .replace(/^[\s-]+/, '')
    .replace(/[\s-]+$/, '')

  const seen = new Set<DayKey>()
  const days: DayKey[] = []
  const push = (key: DayKey) => {
    if (!seen.has(key)) {
      seen.add(key)
      days.push(key)
    }
  }

  for (const token of dayPart.split(/[,;]+/)) {
    const trimmed = token.trim()
    if (!trimmed) continue
    // Range form "Senin-Kamis" → expand inclusive (wraps via % 7).
    const rangeMatch = trimmed.match(/^([a-z\u2019' ]+?)\s*-\s*([a-z\u2019' ]+?)$/i)
    if (rangeMatch) {
      const from = DAY_ALIASES[normalizeDayName(rangeMatch[1])]
      const to = DAY_ALIASES[normalizeDayName(rangeMatch[2])]
      if (from === undefined || to === undefined) return null
      let cursor = from
      for (let i = 0; i < 7; i++) {
        push(cursor as DayKey)
        if (cursor === to) break
        cursor = ((cursor + 1) % 7) as DayKey
      }
    } else {
      const key = DAY_ALIASES[normalizeDayName(trimmed)]
      if (key === undefined) return null
      push(key)
    }
  }

  if (days.length === 0) return null
  return { days, start, end }
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split('.')
  return Number(h) * 60 + Number(m)
}

// ==== Level styling (IQRA emerald · TAHFIDZ amber · AL_QURAN teal) ====

const LEVEL_STYLES: Record<string, { border: string; dot: string; label: string }> = {
  IQRA: { border: 'border-l-emerald-600', dot: 'bg-emerald-600', label: 'Iqra' },
  TAHFIDZ: { border: 'border-l-amber-500', dot: 'bg-amber-500', label: 'Tahfidz' },
  AL_QURAN: { border: 'border-l-teal-600', dot: 'bg-teal-600', label: "Al-Qur'an" },
}

function levelStyle(level: string) {
  return LEVEL_STYLES[level] ?? { border: 'border-l-stone-400', dot: 'bg-stone-400', label: level }
}

interface ScheduleChip {
  classId: string
  day: DayKey
  name: string
  level: string
  room: string | null
  start: string
  end: string
}

interface UnparsedEntry {
  id: string
  name: string
  schedule: string
}

const WEEK_ORDER: DayKey[] = [0, 1, 2, 3, 4, 5, 6]

export function WeeklySchedule({ classes }: { classes: ClassRoom[] }) {
  // Today highlight is effect-gated: SSR/first paint renders every column
  // neutral, then the client marks today (no hydration mismatch).
  const [todayKey, setTodayKey] = useState<DayKey | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      // JS getDay(): 0=Minggu … 6=Sabtu → our 0=Senin … 6=Ahad.
      setTodayKey(((new Date().getDay() + 6) % 7) as DayKey)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  const { chips, unparsed } = useMemo(() => {
    const chips: ScheduleChip[] = []
    const unparsed: UnparsedEntry[] = []
    for (const c of classes) {
      const result = parseWeeklySchedule(c.schedule)
      if (!result) {
        unparsed.push({ id: c.id, name: c.name, schedule: c.schedule })
        continue
      }
      for (const day of result.days) {
        chips.push({
          classId: c.id,
          day,
          name: c.name,
          level: c.level,
          room: c.room,
          start: result.start,
          end: result.end,
        })
      }
    }
    return { chips, unparsed }
  }, [classes])

  // Ahad column only when a class actually uses it.
  const usedDays = useMemo(() => {
    const base = WEEK_ORDER.slice(0, 6)
    if (chips.some((chip) => chip.day === 6)) base.push(6)
    return base
  }, [chips])

  const byDay = useMemo(() => {
    const map = new Map<DayKey, ScheduleChip[]>()
    for (const chip of chips) {
      const list = map.get(chip.day) ?? []
      list.push(chip)
      map.set(chip.day, list)
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start) || a.name.localeCompare(b.name),
      )
    }
    return map
  }, [chips])

  // Legend shows only levels actually present, in canonical order.
  const legendLevels = useMemo(() => {
    const present: string[] = []
    for (const chip of chips) {
      if (!present.includes(chip.level)) present.push(chip.level)
    }
    const canonical = ['IQRA', 'TAHFIDZ', 'AL_QURAN']
    return [...present].sort((a, b) => {
      const ia = canonical.indexOf(a)
      const ib = canonical.indexOf(b)
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    })
  }, [chips])

  if (!classes || classes.length === 0) return null

  return (
    <Card className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2.5 text-base">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"
            aria-hidden="true"
          >
            <CalendarDays className="size-5" />
          </span>
          Jadwal Mengajar Mingguan
        </CardTitle>
        <CardDescription>Keterampilan jadwal kelas yang Anda ampu</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className={cn(
            'grid grid-cols-2 gap-3 sm:grid-cols-3',
            usedDays.length === 7 ? 'lg:grid-cols-7' : 'lg:grid-cols-6',
          )}
          role="list"
          aria-label="Jadwal mengajar per hari dalam seminggu"
        >
          {usedDays.map((day) => {
            const dayChips = byDay.get(day) ?? []
            const isToday = todayKey === day
            return (
              <div
                key={day}
                role="listitem"
                aria-label={`${DAY_LABELS[day]} — ${dayChips.length} kelas`}
                className={cn(
                  'rounded-xl p-2 transition-colors',
                  isToday && 'bg-emerald-50/60 ring-1 ring-emerald-200',
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-stone-700">
                      {DAY_LABELS[day]}
                    </p>
                    <div className="mt-1 h-0.5 w-7 rounded-full bg-emerald-500" aria-hidden="true" />
                  </div>
                  {isToday && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                      Hari ini
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  {dayChips.length === 0 ? (
                    <div
                      className="flex h-16 items-center justify-center rounded-xl border border-dashed border-stone-200 text-base text-stone-300"
                      aria-hidden="true"
                    >
                      —
                    </div>
                  ) : (
                    dayChips.map((chip) => (
                      <div
                        key={`${chip.classId}-${chip.day}`}
                        title={`${chip.name} · ${chip.start}-${chip.end}${chip.room ? ` · ${chip.room}` : ''}`}
                        className={cn(
                          'rounded-xl border border-stone-200 border-l-4 bg-stone-50 p-2.5 transition-colors hover:bg-emerald-50',
                          levelStyle(chip.level).border,
                        )}
                      >
                        <p className="truncate text-xs font-semibold text-stone-800">{chip.name}</p>
                        <p className="mt-0.5 font-mono text-[11px] tabular-nums text-stone-500">
                          {chip.start}-{chip.end}
                        </p>
                        {chip.room && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-stone-500">
                            <MapPin className="size-3 shrink-0 text-stone-400" aria-hidden="true" />
                            <span className="truncate">{chip.room}</span>
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {unparsed.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Format jadwal tidak dikenali
            </p>
            <ul className="mt-1.5 space-y-1">
              {unparsed.map((entry) => (
                <li key={entry.id} className="text-[11px] text-amber-700">
                  <span className="font-medium">{entry.name}</span>
                  <span className="font-mono"> · {entry.schedule || '(jadwal kosong)'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {legendLevels.map((level) => (
              <span
                key={level}
                className="flex items-center gap-1.5 text-[11px] text-stone-500"
              >
                <span className={cn('size-2 rounded-full', levelStyle(level).dot)} aria-hidden="true" />
                {levelStyle(level).label}
              </span>
            ))}
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
            {chips.length} sesi/minggu
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
