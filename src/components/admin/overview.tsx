'use client'

import { useCallback, useEffect, useState } from 'react'
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
  type LucideIcon,
} from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { QRCodeSVG } from 'qrcode.react'
import type { DashboardStats } from '@/lib/types'
import { apiGet, formatRupiah, formatShortDate } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { ReactNode } from 'react'

export function statusBadgeClass(status: string | null | undefined): string {
  switch (status) {
    case 'HADIR':
    case 'SUCCESS':
    case 'DITERIMA':
      return 'border-emerald-200 bg-emerald-100 text-emerald-800'
    case 'IZIN':
    case 'PENDING':
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
    <Card className="rounded-2xl border-stone-200 shadow-sm">
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl', iconClass)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-stone-500">{label}</p>
          <p className="truncate text-xl font-bold text-stone-900">{value}</p>
          <p className="mt-0.5 text-[11px] text-stone-400">{hint}</p>
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

export function OverviewSection() {
  const { toast } = useToast()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setStats(await apiGet<DashboardStats>('/api/stats'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat statistik')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function copyCode(code: string) {
    void navigator.clipboard
      ?.writeText(code)
      .then(() => toast({ title: 'Kode disalin', description: `Kode sesi ${code} siap dibagikan.` }))
      .catch(() => toast({ title: 'Gagal menyalin', description: 'Salin kode secara manual.' }))
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <Skeleton className="h-72 rounded-2xl" />
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                <div key={s.key} className="rounded-xl border border-stone-100 bg-stone-50 p-3 text-center">
                  <span className={cn('mx-auto mb-1.5 block size-2.5 rounded-full', s.dot)} />
                  <p className="text-lg font-bold text-stone-900">{stats.attendanceToday[s.key]}</p>
                  <p className="text-[11px] text-stone-500">{s.label}</p>
                </div>
              ))}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="font-medium text-stone-600">Tingkat Kehadiran</span>
                <span className="font-bold text-emerald-700">{stats.attendanceRate}%</span>
              </div>
              <Progress value={stats.attendanceRate} className="h-2.5" />
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
                  <div key={s.id} className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-3">
                    <div className="rounded-lg bg-white p-1.5 shadow-sm">
                      <QRCodeSVG value={s.code} size={64} />
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
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
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
