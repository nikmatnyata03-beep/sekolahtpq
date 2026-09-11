'use client'

/**
 * Task 44 — Panel "Absen Mencurigakan" (lintas-sesi).
 *
 * Ringkasan temuan anti-kecurangan dari GET /api/attendance/suspicious:
 * perangkat ganda menunggu verifikasi (aksi: pakai /api/attendance/[id]/review),
 * koordinat identik lintas perangkat, akurasi GPS rendah, dan satu perangkat
 * dipakai banyak santri. Guru hanya melihat kelas amanahnya (server-side).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ShieldAlert,
  ChevronDown,
  Smartphone,
  MapPin,
  Gauge,
  Users,
  RefreshCw,
  Inbox,
  BadgeCheck,
  CalendarDays,
} from 'lucide-react'
import { apiGet, apiSendFull, formatShortDate } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'

type Finding = { type: string; label: string; detail: string; severity: 'action' | 'warning' | 'info' }

type SuspiciousRow = {
  id: string
  studentName: string
  nis: string
  className: string
  sessionCode: string
  sessionTopic: string | null
  sessionDate: string
  distanceM: number | null
  accuracy: number | null
  dupDeviceOf: string | null
  findings: Finding[]
}

type SuspiciousResponse = {
  summary: {
    total: number
    pendingReview: number
    dupCoords: number
    lowAccuracy: number
    sharedDevices: number
    scanned: number
    days: number
  }
  findings: SuspiciousRow[]
}

const SEVERITY_BADGE: Record<Finding['severity'], string> = {
  action: 'border-amber-300 bg-amber-100 text-amber-900',
  warning: 'border-orange-200 bg-orange-100 text-orange-800',
  info: 'border-stone-200 bg-stone-100 text-stone-600',
}

const FINDING_ICON: Record<string, typeof Smartphone> = {
  PERANGKAT_GANDA: Smartphone,
  KOORDINAT_IDENTIK: MapPin,
  AKURASI_RENDAH: Gauge,
  PERANGKAT_BANYAK: Users,
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function SuspiciousPanel({ onReviewed }: { onReviewed?: () => void }) {
  const { toast } = useToast()
  const [data, setData] = useState<SuspiciousResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const firstLoad = useRef(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiGet<SuspiciousResponse>('/api/attendance/suspicious')
      setData(res)
      // Auto-buka hanya saat temuan "perlu tindakan" ada di pemuatan pertama.
      if (firstLoad.current) {
        setOpen(res.summary.pendingReview > 0)
        firstLoad.current = false
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat panel absen mencurigakan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // setTimeout(0): pola proyek agar aman dari react-hooks/set-state-in-effect.
    const t = setTimeout(() => void load(), 0)
    return () => clearTimeout(t)
  }, [load])

  async function review(id: string, action: 'approve' | 'revoke', studentName: string) {
    setBusyId(id)
    try {
      const res = await apiSendFull<{ success?: boolean; message?: string }>(
        `/api/attendance/${id}/review`,
        'POST',
        { action },
      )
      if (res.status >= 400) throw new Error(res.data?.error || 'Aksi gagal')
      toast({
        title: action === 'approve' ? 'Absen ditandai sah' : 'Absen dibatalkan',
        description:
          action === 'approve'
            ? `Check-in ${studentName} diverifikasi oleh Anda.`
            : `Kehadiran ${studentName} dibatalkan (ALPA) & wali dinotifikasi.`,
      })
      await load()
      onReviewed?.()
    } catch (e) {
      toast({
        title: 'Gagal memproses verifikasi',
        description: e instanceof Error ? e.message : 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const summary = data?.summary
  const chips = summary
    ? [
        { key: 'pending', label: 'Perlu verifikasi', value: summary.pendingReview, cls: 'bg-amber-100 text-amber-900 border-amber-300' },
        { key: 'dup', label: 'Koordinat identik', value: summary.dupCoords, cls: 'bg-orange-100 text-orange-800 border-orange-200' },
        { key: 'acc', label: 'Akurasi rendah', value: summary.lowAccuracy, cls: 'bg-stone-100 text-stone-600 border-stone-200' },
        { key: 'share', label: 'Perangkat bersama', value: summary.sharedDevices, cls: 'bg-teal-100 text-teal-800 border-teal-200' },
      ]
    : []

  return (
    <Card className="rounded-2xl border-stone-200 shadow-sm" data-testid="panel-suspicious">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <ShieldAlert className="size-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">Absen Mencurigakan</CardTitle>
              <CardDescription>
                {summary
                  ? `${summary.scanned} check-in dipindai · ${summary.days} hari terakhir`
                  : 'Memindai temuan anti-kecurangan…'}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" className="size-8" onClick={() => void load()} aria-label="Muat ulang temuan">
              <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? 'Ciutkan panel' : 'Buka panel'}
            >
              <ChevronDown className={cn('size-4 transition-transform duration-200', !open && '-rotate-90')} />
            </Button>
          </div>
        </div>
        {/* Chip ringkasan */}
        {!loading && !error && summary && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {chips.map((c) => (
              <span
                key={c.key}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
                  c.cls,
                )}
                data-testid={`chip-${c.key}`}
              >
                {c.label}: <span className="font-bold tabular-nums">{c.value}</span>
              </span>
            ))}
          </div>
        )}
      </CardHeader>

      {open && (
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-red-200 bg-red-50/50 p-4">
              <p className="text-sm text-red-800">{error}</p>
              <Button size="sm" variant="outline" onClick={() => void load()}>
                <RefreshCw className="size-4" /> Coba Lagi
              </Button>
            </div>
          ) : !data || data.findings.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-stone-200 py-8 text-center">
              <Inbox className="size-7 text-stone-300" />
              <p className="text-sm text-stone-500">Tidak ada temuan — semua absen tampak wajar</p>
            </div>
          ) : (
            <ul
              className="max-h-96 space-y-2 divide-y divide-stone-100 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300"
              aria-label="Daftar absen mencurigakan"
            >
              {data.findings.map((row) => {
                const pending = row.findings.some((f) => f.type === 'PERANGKAT_GANDA')
                return (
                  <li
                    key={row.id}
                    className={cn(
                      '-mx-1 flex flex-col gap-2 rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-stone-50 sm:flex-row sm:items-center sm:gap-3',
                      pending && 'border-l-4 border-l-amber-400 bg-amber-50/50',
                    )}
                    data-testid="row-suspicious"
                  >
                    <Avatar className="size-8 shrink-0">
                      <AvatarFallback
                        className={cn(
                          'text-[11px] font-semibold',
                          pending ? 'bg-amber-200 text-amber-900' : 'bg-stone-200 text-stone-600',
                        )}
                      >
                        {initials(row.studentName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-stone-800">{row.studentName}</p>
                        <span className="font-mono text-[10px] text-stone-400">{row.nis}</span>
                      </div>
                      <p className="truncate text-xs text-stone-500">
                        {row.className} · {row.sessionTopic || 'Tanpa topik'} ·{' '}
                        <span className="inline-flex items-center gap-0.5">
                          <CalendarDays className="size-3" /> {formatShortDate(row.sessionDate)}
                        </span>
                        {row.distanceM !== null && <span> · ±{Math.round(row.distanceM)} m dari titik absen</span>}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {row.findings.map((f) => {
                          const Icon = FINDING_ICON[f.type] ?? ShieldAlert
                          return (
                            <Badge
                              key={f.type}
                              variant="outline"
                              className={cn('gap-1 px-1.5 py-0 text-[10px]', SEVERITY_BADGE[f.severity])}
                              title={f.detail}
                            >
                              <Icon className="size-3" />
                              {f.label}
                            </Badge>
                          )
                        })}
                        {pending && (
                          <span className="text-[10px] text-amber-700">menunggu keputusan Anda</span>
                        )}
                      </div>
                    </div>

                    {pending && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          size="sm"
                          className="h-8 bg-emerald-700 text-white hover:bg-emerald-800"
                          disabled={busyId === row.id}
                          onClick={() => void review(row.id, 'approve', row.studentName)}
                          data-testid="btn-approve-suspicious"
                        >
                          <BadgeCheck className="size-3.5" /> Tandai Sah
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={busyId === row.id}
                          onClick={() => void review(row.id, 'revoke', row.studentName)}
                          data-testid="btn-revoke-suspicious"
                        >
                          Batalkan Absen
                        </Button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  )
}
