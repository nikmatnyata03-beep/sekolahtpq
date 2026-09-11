'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  Wallet,
  AlertTriangle,
  CalendarCheck,
  QrCode,
  Copy,
  RefreshCw,
  AlertCircle,
  Inbox,
  BookMarked,
  MessageCircle,
  ReceiptText,
  FileSignature,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DashboardStats, Registration } from '@/lib/types'
import { apiGet, formatRupiah, formatShortDate } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { RotatingQr } from './rotating-qr'
import type { ReactNode } from 'react'

/**
 * QR memuat URL portal dgn kode terisi otomatis (?absen=KODE#checkin) — santri
 * memindai QR dgn kamera ponsel → halaman check-in terbuka, kode terisi, tinggal
 * pilih nama. Dipakai overview, guru-overview, dan attendance-admin.
 */
export function checkinUrl(code: string): string {
  if (typeof window === 'undefined') return code
  return `${window.location.origin}/?absen=${encodeURIComponent(code)}#checkin`
}

export function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'HADIR':
    case 'SUCCESS':
    case 'DITERIMA':
      return 'border-emerald-200 bg-emerald-100 text-emerald-800'
    case 'IZIN':
    case 'PENDING':
    case 'MENUNGGU_KONFIRMASI':
      return 'border-amber-200 bg-amber-100 text-amber-800'
    case 'SAKIT':
      return 'border-orange-200 bg-orange-100 text-orange-800'
    case 'ALPA':
    case 'FAILED':
    case 'DITOLAK':
      return 'border-red-200 bg-red-100 text-red-700'
    case 'VERIFIKASI':
      return 'border-teal-200 bg-teal-100 text-teal-800'
    default:
      return 'border-stone-200 bg-stone-100 text-stone-700'
  }
}

// ==== Shared CSV helpers (client-side export for Students/Payments admin) ====
// `;` separator (Excel id-ID friendly), quotes escaped by doubling, BOM prepended.
export function csvCell(value: string | number | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value)
  return /[";\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw
}

export function csvDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

export function csvFileStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map(csvCell).join(';')).join('\r\n')
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Mobile-polished KPI card: tighter padding/icon/value on <sm, muted hint hidden on
// very small screens to avoid tall cards with dead space. Desktop (sm+) unchanged.
function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  iconClass,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  iconClass: string
}) {
  return (
    <Card className="rounded-2xl border-stone-200 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md">
      <CardContent className="flex items-start gap-2.5 p-3 sm:gap-3 sm:p-4">
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10', iconClass)}>
          <Icon className="size-4 sm:size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-stone-500">{label}</p>
          <p className="break-words text-base font-bold text-stone-900 tabular-nums sm:text-xl">{value}</p>
          <p className="mt-0.5 hidden text-[11px] text-stone-400 sm:block">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

const STATUS_DOTS: { key: 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA'; label: string; dot: string }[] = [
  { key: 'HADIR', label: 'Hadir', dot: 'bg-emerald-500' },
  { key: 'IZIN', label: 'Izin', dot: 'bg-amber-500' },
  { key: 'SAKIT', label: 'Sakit', dot: 'bg-orange-500' },
  { key: 'ALPA', label: 'Alpa', dot: 'bg-red-500' },
]

// ==== PPDB — Pendaftar 6 Minggu (stacked weekly bars, hue-matched to statusBadgeClass) ====
const PPDB_SERIES: { key: 'PENDING' | 'VERIFIKASI' | 'DITERIMA' | 'DITOLAK'; label: string; color: string; dot: string }[] = [
  { key: 'PENDING', label: 'Menunggu', color: '#d97706', dot: 'bg-amber-500' },
  { key: 'VERIFIKASI', label: 'Verifikasi', color: '#0d9488', dot: 'bg-teal-500' },
  { key: 'DITERIMA', label: 'Diterima', color: '#059669', dot: 'bg-emerald-500' },
  { key: 'DITOLAK', label: 'Ditolak', color: '#dc2626', dot: 'bg-red-500' },
]

interface WeekBucket {
  start: Date
  label: string
  tooltip: string
  PENDING: number
  VERIFIKASI: number
  DITERIMA: number
  DITOLAK: number
  total: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function dayKey(d: Date): number {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}

// Senin-start week start (local midnight): shift back (Mon=0..Sun=6) days.
function mondayOf(d: Date): Date {
  const back = (d.getDay() + 6) % 7
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - back)
}

// 6 ISO-week buckets (Senin-start), oldest -> newest, anchored at the Monday of the
// latest registration week. Pure function of fetched data — no Date.now / wall-clock
// reads in render paths, so hydration is safe.
function buildWeekBuckets(regs: Registration[]): WeekBucket[] {
  const parsed = regs
    .map((r) => ({ status: r.status, date: new Date(r.createdAt) }))
    .filter((x) => !Number.isNaN(x.date.getTime()))
  if (parsed.length === 0) return []
  const latest = parsed.reduce((a, b) => (b.date.getTime() > a.date.getTime() ? b : a)).date
  const anchor = mondayOf(latest)
  const buckets: WeekBucket[] = []
  for (let i = 5; i >= 0; i--) {
    const start = new Date(anchor)
    start.setDate(start.getDate() - 7 * i)
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    buckets.push({
      start,
      label: `${pad2(start.getDate())}/${pad2(start.getMonth() + 1)}`,
      tooltip: `Minggu ke-${6 - i} · ${pad2(start.getDate())}/${pad2(start.getMonth() + 1)}–${pad2(end.getDate())}/${pad2(end.getMonth() + 1)}`,
      PENDING: 0,
      VERIFIKASI: 0,
      DITERIMA: 0,
      DITOLAK: 0,
      total: 0,
    })
  }
  const byKey = new Map(buckets.map((b, idx) => [dayKey(b.start), idx] as const))
  for (const { status, date } of parsed) {
    const idx = byKey.get(dayKey(mondayOf(date)))
    if (idx === undefined) continue // registrasi lebih tua dari jendela 6 minggu
    const b = buckets[idx]
    b.total += 1
    if (status === 'PENDING' || status === 'VERIFIKASI' || status === 'DITERIMA' || status === 'DITOLAK') {
      b[status] += 1
    }
  }
  return buckets
}

export function OverviewSection() {
  const { toast } = useToast()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [regs, setRegs] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statsData, regsData] = await Promise.all([
        apiGet<DashboardStats>('/api/stats'),
        apiGet<Registration[]>('/api/registrations'),
      ])
      setStats(statsData)
      setRegs(Array.isArray(regsData) ? regsData : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat statistik')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // PPDB mingguan — murni turunan dari data hasil fetch (hydration-safe).
  const weekBuckets = useMemo(() => buildWeekBuckets(regs), [regs])
  const weekTotal = weekBuckets.reduce((a, b) => a + b.total, 0)
  const weekPending = weekBuckets.reduce((a, b) => a + b.PENDING, 0)
  const weekVerified = weekBuckets.reduce((a, b) => a + b.VERIFIKASI, 0)
  const weekAccepted = weekBuckets.reduce((a, b) => a + b.DITERIMA, 0)
  const weekRejected = weekBuckets.reduce((a, b) => a + b.DITOLAK, 0)
  const latestWeek = weekBuckets[weekBuckets.length - 1]
  const prevWeek = weekBuckets[weekBuckets.length - 2]
  const weekRising = !!latestWeek && !!prevWeek && latestWeek.total > 0 && latestWeek.total >= prevWeek.total
  const ppdbAriaLabel =
    weekBuckets.length === 0
      ? 'Belum ada pendaftar dalam 6 minggu terakhir'
      : `Grafik batang pendaftar PPDB per minggu. Total ${weekTotal} pendaftar dalam 6 minggu terakhir: ${weekPending} menunggu, ${weekVerified} verifikasi, ${weekAccepted} diterima, ${weekRejected} ditolak.`

  function copyCode(code: string) {
    void navigator.clipboard
      ?.writeText(code)
      .then(() => toast({ title: 'Kode disalin', description: `Kode sesi ${code} siap dibagikan.` }))
      .catch(() => toast({ title: 'Gagal menyalin', description: 'Salin kode secara manual.' }))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <AlertCircle className="size-4" />
        <AlertTitle>Gagal memuat statistik</AlertTitle>
        <AlertDescription>
          {error}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => void load()}>
              <RefreshCw className="size-4" /> Coba Lagi
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        <KpiCard icon={Users} label="Santri Aktif" value={String(stats.students)} hint="Total santri terdaftar" iconClass="bg-emerald-100 text-emerald-700" />
        <KpiCard icon={GraduationCap} label="Guru" value={String(stats.teachers)} hint="Ustadz/ustadzah aktif" iconClass="bg-amber-100 text-amber-700" />
        <KpiCard icon={BookOpen} label="Kelas" value={String(stats.classes)} hint="Kelas yang berjalan" iconClass="bg-teal-100 text-teal-700" />
        <KpiCard icon={ClipboardList} label="Pendaftar Menunggu" value={String(stats.registrationsPending)} hint="PPDB perlu diverifikasi" iconClass={stats.registrationsPending > 0 ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'} />
        <KpiCard icon={Wallet} label="Pemasukan" value={formatRupiah(stats.revenue)} hint={`${stats.successCount} tagihan lunas`} iconClass="bg-emerald-100 text-emerald-700" />
        <KpiCard icon={AlertTriangle} label="Tunggakan" value={formatRupiah(stats.outstanding)} hint={`${stats.pendingCount} tagihan tertunda`} iconClass="bg-red-100 text-red-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Kehadiran hari ini */}
        <Card className="rounded-2xl border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="size-4 text-emerald-700" /> Kehadiran Hari Ini
            </CardTitle>
            <CardDescription>Rekap status kehadiran seluruh sesi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STATUS_DOTS.map((s) => (
                <div key={s.key} className="rounded-xl border border-stone-100 bg-stone-50 p-3 text-center transition-colors duration-150 hover:border-stone-200 hover:bg-stone-100/70">
                  <span className={cn('mx-auto mb-1.5 block size-2.5 rounded-full', s.dot)} />
                  <p className="text-lg font-bold text-stone-900 tabular-nums">{stats.attendanceToday[s.key]}</p>
                  <p className="text-[11px] text-stone-500">{s.label}</p>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-stone-600">Tingkat Kehadiran</span>
                <span className="font-bold text-emerald-700">{stats.attendanceRate}%</span>
              </div>
              <Progress value={stats.attendanceRate} className="h-2.5 bg-emerald-100 [&>div]:bg-emerald-600" aria-label={`Tingkat kehadiran ${stats.attendanceRate}%`} />
            </div>
          </CardContent>
        </Card>

        {/* Sesi aktif */}
        <Card className="rounded-2xl border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="size-4 text-emerald-700" /> Sesi Aktif
            </CardTitle>
            <CardDescription>Scan QR untuk check-in kehadiran</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.activeSessions.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-stone-200 py-8 text-center">
                <QrCode className="size-7 text-stone-300" />
                <p className="text-sm text-stone-500">Belum ada sesi kelas yang aktif</p>
              </div>
            ) : (
              <div className="max-h-60 space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
                {stats.activeSessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-3 transition-colors duration-150 hover:border-emerald-100 hover:bg-emerald-50/50">
                    <div className="rounded-lg bg-white p-1.5 shadow-sm">
                      <RotatingQr code={s.code} size={64} compact />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-stone-800">{s.className}</p>
                        <Badge className="border-emerald-200 bg-emerald-100 text-[10px] text-emerald-800">AKTIF</Badge>
                      </div>
                      <p className="truncate text-xs text-stone-500">{s.topic || 'Tanpa topik'}</p>
                      <p className="mt-1 font-mono text-lg font-bold tracking-[0.25em] text-emerald-800">{s.code}</p>
                      <p className="text-[11px] text-stone-400">{formatShortDate(s.date)}</p>
                    </div>
                    <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={() => copyCode(s.code)} aria-label="Salin kode">
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tren kehadiran */}
      <Card className="rounded-2xl border-stone-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Tren Kehadiran 7 Hari Terakhir</CardTitle>
          <CardDescription>Persentase kehadiran santri per hari</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.attendanceTrend.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-10 text-center">
              <CalendarCheck className="size-7 text-stone-300" />
              <p className="text-sm text-stone-500">Belum ada data kehadiran</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.attendanceTrend} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v: string) => formatShortDate(v)}
                    tick={{ fontSize: 11, fill: '#78716c' }}
                    stroke="#d6d3d1"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 11, fill: '#78716c' }}
                    stroke="#d6d3d1"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value) => [`${String(value)}%`, 'Kehadiran']}
                    labelFormatter={(label) => formatShortDate(String(label))}
                    contentStyle={{ borderRadius: 12, borderColor: '#e7e5e4', fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#047857"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#047857' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tren PPDB 6 minggu */}
      <Card className="rounded-2xl border-stone-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <ClipboardList className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">PPDB — Pendaftar 6 Minggu</CardTitle>
              <CardDescription>Tren pendaftaran santri baru per minggu.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {weekBuckets.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-stone-200 py-8 text-center">
              <ClipboardList className="size-7 text-stone-300" />
              <p className="text-sm text-stone-500">Belum ada pendaftar dalam 6 minggu terakhir.</p>
            </div>
          ) : (
            <>
              <div className="h-40 w-full sm:h-48" role="img" aria-label={ppdbAriaLabel}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekBuckets} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
                    <XAxis
                      dataKey="label"
                      interval={0}
                      tick={{ fontSize: 11, fill: '#78716c' }}
                      stroke="#d6d3d1"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#78716c' }}
                      stroke="#d6d3d1"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(120, 113, 108, 0.08)' }}
                      formatter={(value, name) => [
                        String(value),
                        PPDB_SERIES.find((s) => s.key === name)?.label ?? String(name),
                      ]}
                      labelFormatter={(_, payload) => {
                        const bucket = payload?.[0]?.payload as WeekBucket | undefined
                        return bucket?.tooltip ?? ''
                      }}
                      contentStyle={{ borderRadius: 12, borderColor: '#e7e5e4', fontSize: 12 }}
                    />
                    {PPDB_SERIES.map((s) => (
                      <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} maxBarSize={36} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {PPDB_SERIES.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-stone-500">
                    <span className={cn('size-2.5 rounded-full', s.dot)} />
                    {s.label}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                  <span>
                    Total: <span className="font-bold text-stone-900">{weekTotal}</span> pendaftar
                  </span>
                  <span aria-hidden="true" className="text-stone-300">
                    ·
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-500" /> Menunggu: {weekPending}
                  </span>
                  <span aria-hidden="true" className="text-stone-300">
                    ·
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500" /> Diterima: {weekAccepted}
                  </span>
                </p>
                {weekRising ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <TrendingUp className="size-3.5" /> Momentum naik ({latestWeek?.total} minggu terakhir)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">
                    <TrendingDown className="size-3.5" /> Menurun ({latestWeek?.total} minggu terakhir)
                  </span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RecentList
          title="Pendaftaran Terbaru"
          description="PPDB masuk terakhir"
          icon={FileSignature}
          emptyText="Belum ada pendaftaran"
          items={stats.recentRegistrations.slice(0, 5).map((r) => ({
            id: r.id,
            title: r.childName,
            subtitle: `${r.regNumber} · Wali: ${r.parentName}`,
            right: <Badge className={statusBadgeClass(r.status)}>{r.status}</Badge>,
          }))}
        />
        <RecentList
          title="Pembayaran Terbaru"
          description="Tagihan dan transaksi terakhir"
          icon={ReceiptText}
          emptyText="Belum ada pembayaran"
          items={stats.recentPayments.slice(0, 5).map((p) => ({
            id: p.id,
            title: p.studentName || p.student?.fullName || 'Santri',
            subtitle: `${p.title} · ${formatRupiah(p.amount)}`,
            right: <Badge className={statusBadgeClass(p.status)}>{p.status}</Badge>,
          }))}
        />
        <RecentList
          title="Hafalan Terbaru"
          description="Setoran hafalan terakhir"
          icon={BookMarked}
          emptyText="Belum ada setoran hafalan"
          items={stats.recentHafalan.slice(0, 5).map((h) => ({
            id: h.id,
            title: h.studentName || h.student?.fullName || 'Santri',
            subtitle: `${h.surahName} ${h.ayatRange} · ${h.type}`,
            right:
              h.grade === null ? (
                <span className="text-xs text-stone-400">—</span>
              ) : (
                <Badge
                  className={
                    h.grade >= 85
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                      : h.grade >= 70
                        ? 'border-amber-200 bg-amber-100 text-amber-800'
                        : 'border-red-200 bg-red-100 text-red-700'
                  }
                >
                  {h.grade}
                </Badge>
              ),
          }))}
        />
        <RecentList
          title="Notifikasi WhatsApp Terbaru"
          description="Pesan terkirim ke wali santri"
          icon={MessageCircle}
          emptyText="Belum ada notifikasi terkirim"
          items={stats.recentNotifications.slice(0, 5).map((n) => ({
            id: n.id,
            title: n.phone,
            subtitle: n.message.length > 70 ? `${n.message.slice(0, 70)}…` : n.message,
            right: <Badge className={statusBadgeClass(n.status)}>{n.status}</Badge>,
          }))}
        />
      </div>
    </div>
  )
}

function RecentList({
  title,
  description,
  icon: Icon,
  emptyText,
  items,
}: {
  title: string
  description: string
  icon: LucideIcon
  emptyText: string
  items: { id: string; title: string; subtitle: string; right: ReactNode }[]
}) {
  return (
    <Card className="rounded-2xl border-stone-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-emerald-700" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-stone-200 py-8 text-center">
            <Inbox className="size-7 text-stone-300" />
            <p className="text-sm text-stone-500">{emptyText}</p>
          </div>
        ) : (
          <ul className="max-h-64 divide-y divide-stone-100 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
            {items.map((item) => (
              <li key={item.id} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-stone-50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-stone-800">{item.title}</p>
                  <p className="truncate text-xs text-stone-500">{item.subtitle}</p>
                </div>
                <div className="shrink-0">{item.right}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
