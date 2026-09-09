'use client'

import { useEffect, useRef, useState } from 'react'
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  CircleCheck,
  Clock,
  Inbox,
  Landmark,
  Loader2,
  QrCode,
  ReceiptText,
  ScanLine,
  Smartphone,
  User,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { apiSend, formatRupiah, formatShortDate } from '@/lib/api-client'
import type { Hafalan, Payment, ParentPortalData, SessionItem } from '@/lib/types'

export type ParentStudent = ParentPortalData['students'][number]

// ==== shared visual maps ====

const ATTENDANCE_CHIP: Record<string, string> = {
  HADIR: 'bg-emerald-100 text-emerald-800',
  IZIN: 'bg-amber-100 text-amber-800',
  SAKIT: 'bg-orange-100 text-orange-800',
  ALPA: 'bg-red-100 text-red-700',
}

const ATTENDANCE_BADGE: Record<string, string> = {
  HADIR: 'border-transparent bg-emerald-100 text-emerald-800',
  IZIN: 'border-transparent bg-amber-100 text-amber-800',
  SAKIT: 'border-transparent bg-orange-100 text-orange-800',
  ALPA: 'border-transparent bg-red-100 text-red-700',
}

const HAFALAN_BADGE: Record<Hafalan['type'], string> = {
  TAHFIDZ: 'border-transparent bg-emerald-100 text-emerald-800',
  TAHSHIN: 'border-transparent bg-teal-100 text-teal-800',
  MURAJAAH: 'border-transparent bg-amber-100 text-amber-800',
}

const PAYMENT_BADGE: Record<Payment['status'], string> = {
  PENDING: 'border-transparent bg-amber-100 text-amber-800',
  SUCCESS: 'border-transparent bg-emerald-100 text-emerald-800',
  FAILED: 'border-transparent bg-red-100 text-red-700',
}

const ATT_COUNT_KEY: Record<'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA', 'hadir' | 'izin' | 'sakit' | 'alpa'> = {
  HADIR: 'hadir',
  IZIN: 'izin',
  SAKIT: 'sakit',
  ALPA: 'alpa',
}

function gradeCircleClass(grade: number | null): string {
  if (grade === null) return 'bg-stone-300 text-stone-600'
  if (grade >= 85) return 'bg-emerald-600 text-white'
  if (grade >= 70) return 'bg-amber-500 text-white'
  return 'bg-red-500 text-white'
}

function attendanceRate(child: ParentStudent): number {
  const { hadir, total } = child.attendanceSummary
  return total > 0 ? Math.round((hadir / total) * 100) : 0
}

function averageHafalanGrade(hafalans: Hafalan[]): number | null {
  const grades = hafalans.map((h) => h.grade).filter((g): g is number => typeof g === 'number')
  if (grades.length === 0) return null
  return Math.round(grades.reduce((a, b) => a + b, 0) / grades.length)
}

// ==== payment gateway simulation ====

type PayMethod = 'QRIS' | 'GOPAY' | 'VA_BCA'
type PayStep = 'form' | 'processing' | 'success'

const PAY_METHODS: { value: PayMethod; label: string; desc: string; icon: LucideIcon }[] = [
  { value: 'QRIS', label: 'QRIS', desc: 'Scan QR via e-wallet / m-banking', icon: QrCode },
  { value: 'GOPAY', label: 'GoPay', desc: 'Bayar menggunakan saldo GoPay', icon: Smartphone },
  { value: 'VA_BCA', label: 'Virtual Account BCA', desc: 'Transfer ke nomor VA BCA', icon: Landmark },
]

function PaymentDialog({
  payment,
  studentName,
  onDismiss,
  onPaid,
}: {
  payment: Payment | null
  studentName: string
  onDismiss: () => void
  onPaid: () => void
}) {
  const [method, setMethod] = useState<PayMethod | null>(null)
  const [step, setStep] = useState<PayStep>('form')
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function pay() {
    if (!payment || !method) return
    setError(null)
    setStep('processing')
    if (timerRef.current) clearTimeout(timerRef.current)
    // Simulated gateway round-trip (~1.8s) before the "webhook" hits the API
    timerRef.current = setTimeout(() => {
      apiSend('/api/payments', 'PUT', { id: payment.id, status: 'SUCCESS', method })
        .then(() => {
          setStep('success')
          onPaid()
        })
        .catch((err: unknown) => {
          setStep('form')
          setError(err instanceof Error ? err.message : 'Pembayaran gagal. Silakan coba lagi.')
        })
    }, 1800)
  }

  function handleClose(open: boolean) {
    if (!open && step !== 'processing') onDismiss()
  }

  const methodLabel = PAY_METHODS.find((m) => m.value === method)?.label ?? method

  return (
    <Dialog open={!!payment} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Simulasi Pembayaran</DialogTitle>
          <DialogDescription>Gateway pembayaran demo — bukan transaksi sungguhan.</DialogDescription>
        </DialogHeader>

        {payment && (
          <>
            {/* Invoice summary */}
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-stone-500">{payment.invoiceNo}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-stone-800">{payment.title}</p>
                  <p className="text-xs text-stone-500">Untuk: {studentName}</p>
                </div>
                <p className="shrink-0 text-lg font-bold text-emerald-700">{formatRupiah(payment.amount)}</p>
              </div>
            </div>

            {step === 'form' && (
              <div className="space-y-4">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
                )}
                <div className="space-y-1.5">
                  <Label>Pilih metode pembayaran</Label>
                  <RadioGroup
                    value={method ?? ''}
                    onValueChange={(v) => setMethod(v as PayMethod)}
                    className="gap-2"
                  >
                    {PAY_METHODS.map((m) => (
                      <label
                        key={m.value}
                        htmlFor={`pay-${m.value}`}
                        className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 bg-white p-3 transition-colors hover:border-emerald-300 [&:has([data-state=checked])]:border-emerald-600 [&:has([data-state=checked])]:bg-emerald-50"
                      >
                        <RadioGroupItem id={`pay-${m.value}`} value={m.value} />
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                          <m.icon className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-stone-800">{m.label}</span>
                          <span className="block truncate text-xs text-stone-500">{m.desc}</span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
                <Button
                  onClick={pay}
                  disabled={!method}
                  className="h-10 w-full rounded-xl bg-emerald-700 text-white hover:bg-emerald-800"
                >
                  Bayar Sekarang
                </Button>
                <p className="text-center text-[11px] text-stone-400">
                  Simulasi pembayaran — tidak ada dana sungguhan yang dipotong.
                </p>
              </div>
            )}

            {step === 'processing' && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Loader2 className="size-10 animate-spin text-emerald-700" />
                <div>
                  <p className="font-semibold text-stone-800">Menghubungi gateway pembayaran...</p>
                  <p className="mt-1 text-sm text-stone-500">
                    Memproses {formatRupiah(payment.amount)} via {methodLabel}. Mohon jangan tutup dialog ini.
                  </p>
                </div>
                <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-stone-200">
                  <div className="h-full w-1/2 animate-pulse rounded-full bg-amber-500" />
                </div>
              </div>
            )}

            {step === 'success' && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <span className="grid size-14 place-items-center rounded-full bg-emerald-100">
                  <CircleCheck className="size-8 text-emerald-600" />
                </span>
                <div>
                  <p className="text-lg font-bold text-stone-800">Pembayaran Berhasil!</p>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {formatRupiah(payment.amount)} · {methodLabel} · {payment.invoiceNo}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <CheckCircle2 className="size-4 shrink-0" />
                  WhatsApp konfirmasi terkirim ke wali.
                </div>
                <Button
                  onClick={onDismiss}
                  className="mt-1 h-9 w-full rounded-xl bg-emerald-700 text-white hover:bg-emerald-800"
                >
                  Selesai
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ==== QR check-in mini card ====

function QrCheckinCard({
  child,
  activeSessions,
  onRefresh,
}: {
  child: ParentStudent
  activeSessions: SessionItem[]
  onRefresh: () => void
}) {
  const { toast } = useToast()
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)

  // Portal data has no classId, so match the child's class by class name.
  const classSessions = activeSessions.filter((s) => s.className === child.className)

  async function submit() {
    const trimmed = code.trim()
    if (!trimmed) {
      toast({ title: 'Kode kosong', description: 'Masukkan kode kehadiran terlebih dahulu.', variant: 'destructive' })
      return
    }
    setChecking(true)
    try {
      const res = await apiSend<{ success?: boolean; already?: boolean; message?: string }>(
        '/api/attendance/checkin',
        'POST',
        { code: trimmed, studentId: child.id },
      )
      toast({ title: 'Check-in tercatat', description: res.message ?? `${child.fullName} tercatat hadir.` })
      setCode('')
      onRefresh()
    } catch (err) {
      toast({
        title: 'Check-in gagal',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan saat check-in.',
        variant: 'destructive',
      })
    } finally {
      setChecking(false)
    }
  }

  return (
    <Card className="rounded-2xl border-emerald-200/70 lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
            <ScanLine className="size-4" />
          </span>
          Check-in QR Kehadiran
        </CardTitle>
        <CardDescription>
          Masukkan kode kehadiran dari ustadz/ustadzah untuk mencatat kehadiran {child.fullName} secara mandiri.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !checking) void submit()
            }}
            placeholder="Contoh: DJ-IA01-XXXX"
            className="h-10 flex-1 rounded-xl font-mono uppercase tracking-wider"
            disabled={checking}
          />
          <Button
            onClick={() => void submit()}
            disabled={checking}
            className="h-10 rounded-xl bg-emerald-700 px-5 text-white hover:bg-emerald-800"
          >
            {checking ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Memproses...
              </>
            ) : (
              'Check-in'
            )}
          </Button>
        </div>
        <div className="rounded-xl bg-stone-50 p-3">
          {classSessions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-stone-500">Kode sesi aktif kelas {child.className}:</span>
              {classSessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCode(s.code)}
                  className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-mono text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                  title={s.topic ? `Topik: ${s.topic}` : 'Sesi aktif'}
                >
                  {s.code}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-500">
              Tidak ada sesi aktif untuk kelas {child.className} saat ini. Kode muncul di sini saat ustadz/ustadzah
              membuka sesi absensi.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ==== main child panel ====

export function ChildPanel({
  child,
  activeSessions,
  onRefresh,
}: {
  child: ParentStudent
  activeSessions: SessionItem[]
  onRefresh: () => void
}) {
  const [payTarget, setPayTarget] = useState<Payment | null>(null)
  const summary = child.attendanceSummary
  const rate = attendanceRate(child)
  const avgGrade = averageHafalanGrade(child.hafalans)
  const initials = child.fullName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* a. Child summary */}
      <Card className="rounded-2xl lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
              {initials || '?'}
            </span>
            <span className="min-w-0">
              <span className="block truncate">{child.fullName}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="font-mono text-[10px]">
                  NIS {child.nis}
                </Badge>
                <Badge className="border-transparent bg-emerald-700 text-white">{child.className}</Badge>
                <span className="text-xs font-normal text-stone-500">
                  {child.gender === 'P' ? 'Santriwati' : 'Santri'}
                </span>
              </span>
            </span>
          </CardTitle>
          <CardAction>
            <Badge className={summary.total > 0 ? 'bg-amber-500 text-white' : 'bg-stone-200 text-stone-600'}>
              Kehadiran {rate}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2.5 text-sm">
            <p className="flex items-start gap-2 text-stone-600">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-emerald-700" />
              <span>
                <span className="block font-medium text-stone-800">Jadwal</span>
                {child.classSchedule}
              </span>
            </p>
            <p className="flex items-start gap-2 text-stone-600">
              <User className="mt-0.5 size-4 shrink-0 text-emerald-700" />
              <span>
                <span className="block font-medium text-stone-800">Ustadz/Ustadzah</span>
                {child.teacherName}
              </span>
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Statistik Kehadiran</p>
            <div className="flex flex-wrap gap-2">
              {(['HADIR', 'IZIN', 'SAKIT', 'ALPA'] as const).map((st) => (
                <span
                  key={st}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${ATTENDANCE_CHIP[st]}`}
                >
                  {st.charAt(0) + st.slice(1).toLowerCase()}
                  <span className="font-bold">{summary[ATT_COUNT_KEY[st]]}</span>
                </span>
              ))}
            </div>
            <div>
              <Progress value={rate} className="h-2 bg-stone-200 [&>div]:bg-emerald-600" />
              <p className="mt-1.5 text-xs text-stone-500">
                Tingkat kehadiran <span className="font-semibold text-emerald-700">{rate}%</span> dari {summary.total}{' '}
                pertemuan tercatat.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* b. Attendance history */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Riwayat Kehadiran</CardTitle>
          <CardDescription>30 pertemuan terakhir.</CardDescription>
        </CardHeader>
        <CardContent>
          {child.attendances.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-stone-50 py-8 text-center">
              <Inbox className="size-6 text-stone-300" />
              <p className="text-sm text-stone-500">Belum ada riwayat kehadiran.</p>
            </div>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {child.attendances.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-white p-2.5 transition-colors hover:border-emerald-200"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-800">{formatShortDate(a.date)}</p>
                    <p className="truncate text-xs text-stone-500">{a.topic || 'Tanpa topik'}</p>
                  </div>
                  <Badge className={ATTENDANCE_BADGE[a.status] ?? ''}>{a.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* c. Hafalan progress */}
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Progres Hafalan</CardTitle>
          <CardDescription className="flex items-center gap-2">
            Rata-rata nilai:
            <span
              className={`inline-grid size-6 place-items-center rounded-full text-[11px] font-bold ${
                avgGrade === null ? 'bg-stone-200 text-stone-500' : gradeCircleClass(avgGrade)
              }`}
            >
              {avgGrade ?? '–'}
            </span>
            <span className="text-stone-400">· {child.hafalans.length} catatan</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {child.hafalans.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-stone-50 py-8 text-center">
              <Inbox className="size-6 text-stone-300" />
              <p className="text-sm text-stone-500">Belum ada catatan hafalan.</p>
            </div>
          ) : (
            <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
              {child.hafalans.map((h) => (
                <div key={h.id} className="flex gap-3 rounded-xl border border-stone-100 bg-white p-3">
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold ${gradeCircleClass(h.grade)}`}
                    title={h.grade === null ? 'Belum dinilai' : `Nilai ${h.grade}`}
                  >
                    {h.grade ?? '–'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-stone-800">
                        QS {h.surahName} <span className="font-normal text-stone-500">{h.ayatRange}</span>
                      </p>
                      <Badge className={`text-[10px] ${HAFALAN_BADGE[h.type] ?? ''}`}>{h.type}</Badge>
                    </div>
                    {h.teacherNote && <p className="mt-1 text-xs italic text-stone-500">“{h.teacherNote}”</p>}
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-stone-400">
                      <Clock className="size-3" /> {formatShortDate(h.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* d. Tagihan & pembayaran */}
      <Card className="rounded-2xl lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Tagihan &amp; Pembayaran</CardTitle>
          <CardDescription>Riwayat tagihan SPP, infaq, dan pembayaran lainnya.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {child.billing.pendingCount > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
              <div className="flex items-center gap-2.5">
                <ReceiptText className="size-5 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-stone-800">Tunggakan aktif</p>
                  <p className="text-xs text-stone-500">
                    {child.billing.pendingCount} tagihan menunggu pembayaran.
                  </p>
                </div>
              </div>
              <p className="text-lg font-bold text-amber-700">{formatRupiah(child.billing.outstanding)}</p>
            </div>
          ) : (
            child.payments.length > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                <BadgeCheck className="size-4 shrink-0" />
                Tidak ada tunggakan — jazakumullahu khairan atas kewajiban yang telah ditunaikan.
              </div>
            )
          )}

          {child.payments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl bg-stone-50 py-8 text-center">
              <BadgeCheck className="size-6 text-emerald-300" />
              <p className="text-sm text-stone-500">Alhamdulillah, belum ada tagihan untuk santri ini.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-stone-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-50 hover:bg-stone-50">
                    <TableHead className="pl-3">No. Invoice</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tgl Bayar</TableHead>
                    <TableHead className="pr-3 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {child.payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-3 font-mono text-xs text-stone-500">{p.invoiceNo}</TableCell>
                      <TableCell className="max-w-44 truncate font-medium text-stone-800">{p.title}</TableCell>
                      <TableCell className="text-right font-semibold">{formatRupiah(p.amount)}</TableCell>
                      <TableCell>
                        <Badge className={PAYMENT_BADGE[p.status] ?? ''}>{p.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-stone-500">
                        {p.paidAt ? formatShortDate(p.paidAt) : '—'}
                      </TableCell>
                      <TableCell className="pr-3 text-right">
                        {p.status === 'PENDING' && (
                          <Button
                            size="sm"
                            onClick={() => setPayTarget(p)}
                            className="h-8 rounded-lg bg-emerald-700 px-3 text-white hover:bg-emerald-800"
                          >
                            Bayar
                          </Button>
                        )}
                        {p.status === 'FAILED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPayTarget(p)}
                            className="h-8 rounded-lg border-red-200 px-3 text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            Coba Bayar Lagi
                          </Button>
                        )}
                        {p.status === 'SUCCESS' && <CheckCircle2 className="ml-auto size-4 text-emerald-600" />}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* e. QR check-in */}
      <QrCheckinCard child={child} activeSessions={activeSessions} onRefresh={onRefresh} />

      <PaymentDialog
        key={payTarget?.id ?? 'none'}
        payment={payTarget}
        studentName={child.fullName}
        onDismiss={() => setPayTarget(null)}
        onPaid={onRefresh}
      />
    </div>
  )
}
