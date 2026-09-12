'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  BadgeCheck,
  BookOpenCheck,
  CalendarDays,
  Camera,
  CameraOff,
  CheckCircle2,
  CircleCheck,
  ClipboardCheck,
  Clock,
  FileText,
  Inbox,
  Landmark,
  Loader2,
  MapPin,
  Printer,
  Download,
  QrCode,
  ReceiptText,
  RefreshCw,
  ScanLine,
  Smartphone,
  User,
  Wallet,
  X,
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
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { useGpsFix } from '@/hooks/use-gps-fix'
import { useQrScanner } from '@/hooks/use-qr-scanner'
import { apiSend, formatRupiah, formatShortDate } from '@/lib/api-client'
import { type GpsFix } from '@/lib/gps-client'
import { buildRaporSantriPdf, buildStrukPdf, downloadBlob } from '@/lib/rapor-pdf'
import type { Hafalan, Payment, ParentPortalData, SessionItem } from '@/lib/types'
import { HafalanProgress } from './hafalan-chart'
import { AttendanceRecap } from './attendance-recap'

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
  MENUNGGU_KONFIRMASI: 'border-transparent bg-teal-100 text-teal-800',
  SUCCESS: 'border-transparent bg-emerald-100 text-emerald-800',
  FAILED: 'border-transparent bg-red-100 text-red-700',
}

// Colored dots used by the printable report's attendance summary.
const RAPOR_ATT_DOT: Record<'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA', string> = {
  HADIR: 'bg-emerald-500',
  IZIN: 'bg-amber-500',
  SAKIT: 'bg-orange-500',
  ALPA: 'bg-red-500',
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

/** Text-only grade coloring used inside the printable report table. */
function gradeTextClass(grade: number | null): string {
  if (grade === null) return 'text-stone-400'
  if (grade >= 85) return 'text-emerald-700'
  if (grade >= 70) return 'text-amber-600'
  return 'text-red-600'
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
  studentNis,
  onDismiss,
  onPaid,
}: {
  payment: Payment | null
  studentName: string
  studentNis: string
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
    // "Webhook" gateway: server memaksa status MENUNGGU_KONFIRMASI utk wali —
    // tagihan lunas hanya setelah dikonfirmasi admin/bendahara.
    timerRef.current = setTimeout(() => {
      apiSend('/api/payments', 'PUT', { id: payment.id, method })
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
                <span className="grid size-14 place-items-center rounded-full bg-teal-100">
                  <CheckCircle2 className="size-8 text-teal-600" />
                </span>
                <div>
                  <p className="text-lg font-bold text-stone-800">Bukti Pembayaran Terkirim!</p>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {formatRupiah(payment.amount)} · {methodLabel} · {payment.invoiceNo}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <Loader2 className="size-4 shrink-0 animate-none" />
                  Menunggu konfirmasi bendahara/pengurus. Struk tersedia setelah tagihan dikonfirmasi.
                </div>
                <Button
                  onClick={onDismiss}
                  className="mt-1 min-h-11 w-full rounded-xl bg-emerald-700 text-white hover:bg-emerald-800"
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

// ==== printable payment receipt (Struk Pembayaran) ====

/** "9 September 2026 · 14.30 WIB" — module-level formatter; a captured date is passed in, never Date.now() during render. */
function formatPaidTimestamp(date: Date): string {
  return `${date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })} · ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`
}

/**
 * Scoped print rules, mounted only while the Struk dialog is open — mirrors
 * RAPOR_PRINT_CSS mechanics exactly with its own anchor id.
 */
const STRUK_PRINT_CSS = `
@media print {
  body > *:not(:has(#struk-pembayaran-print)) { display: none !important; }
  html, body { overflow: visible !important; height: auto !important; }
  body * { visibility: hidden !important; }
  #struk-pembayaran-print, #struk-pembayaran-print * { visibility: visible !important; }
  [data-slot='dialog-overlay'],
  [data-slot='dialog-close'],
  .no-print { display: none !important; }
  [data-slot='dialog-content'] {
    position: static !important;
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    max-height: none !important;
    overflow: visible !important;
    transform: none !important;
    animation: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    padding: 0 !important;
    background: #ffffff !important;
  }
  #struk-pembayaran-print { border-radius: 0 !important; box-shadow: none !important; }
  #struk-pembayaran-print, #struk-pembayaran-print * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`

function ReceiptContent({
  payment,
  studentName,
  studentNis,
}: {
  payment: Payment
  studentName: string
  studentNis: string
}) {
  // paidAt can be stale-null right after the simulated payment (the dialog's
  // payment copy predates the server write) → capture "now" ONCE per mount via
  // the lazy initializer; never construct a Date inline in the render body.
  const [paidDate] = useState(() => (payment.paidAt ? new Date(payment.paidAt) : new Date()))
  const paidLabel = formatPaidTimestamp(paidDate)
  // Seed SUCCESS rows may carry method: null → fall back to 'QRIS' (the
  // portal's primary channel); raw method strings outside PAY_METHODS pass through.
  const methodLabel = PAY_METHODS.find((m) => m.value === payment.method)?.label ?? (payment.method || 'QRIS')

  const rows: { label: string; value: ReactNode }[] = [
    { label: 'No. Invoice', value: <span className="font-mono">{payment.invoiceNo}</span> },
    {
      label: 'Santri',
      value: (
        <span>
          {studentName}
          <span className="ml-1.5 font-mono text-[11px] font-normal text-stone-500">NIS {studentNis}</span>
        </span>
      ),
    },
    { label: 'Keterangan', value: payment.title },
    { label: 'Metode', value: methodLabel },
    { label: 'Tanggal Bayar', value: paidLabel },
  ]

  return (
    <div id="struk-pembayaran-print" className="rounded-2xl border border-stone-200 bg-white p-5">
      {/* Letterhead */}
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
          <Landmark className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-stone-800">TPQ Darul Jinan</p>
          <p className="text-[11px] leading-tight text-stone-500">Sistem Informasi Manajemen — Struk Pembayaran</p>
        </div>
      </div>

      <div className="my-4 border-t border-dashed border-stone-200" />

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500">Struk Pembayaran</p>
        <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">LUNAS</Badge>
      </div>

      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-xs text-stone-500">{row.label}</span>
            <span className="text-right text-sm font-semibold text-stone-800">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Prominent total */}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-dashed border-stone-200 pt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Total Bayar</p>
        <p className="text-lg font-bold text-emerald-700">{formatRupiah(payment.amount)}</p>
      </div>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-stone-400">
        Terima kasih — jazakumullahu khairan. Bukti pembayaran simulasi (demo).
      </p>
    </div>
  )
}

function ReceiptDialog({
  payment,
  studentName,
  studentNis,
  open,
  onOpenChange,
}: {
  payment: Payment | null
  studentName: string
  studentNis: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const [pdfBusy, setPdfBusy] = useState(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <style dangerouslySetInnerHTML={{ __html: STRUK_PRINT_CSS }} />

        <DialogHeader className="no-print">
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="size-5 text-emerald-700" />
            Struk Pembayaran
          </DialogTitle>
          <DialogDescription>Bukti pembayaran (demo) — siap dicetak atau disimpan sebagai PDF.</DialogDescription>
        </DialogHeader>

        {payment && (
          <>
            <ReceiptContent key={payment.id} payment={payment} studentName={studentName} studentNis={studentNis} />

            <div className="no-print grid grid-cols-3 gap-2">
              <Button
                onClick={async () => {
                  if (!payment) return
                  setPdfBusy(true)
                  try {
                    const blob = await buildStrukPdf({
                      invoiceNo: payment.invoiceNo,
                      title: payment.title,
                      amount: payment.amount,
                      studentName,
                      studentNis,
                      method: payment.method,
                      paidAt: payment.paidAt ? new Date(payment.paidAt) : new Date(),
                    })
                    downloadBlob(blob, `Struk-${payment.invoiceNo}.pdf`)
                    toast({ title: 'PDF berhasil diunduh', description: `Struk ${payment.invoiceNo} tersimpan di perangkat Anda.` })
                  } catch (e) {
                    console.error(e)
                    toast({ title: 'Gagal membuat PDF', description: 'Terjadi kesalahan saat menyusun struk.', variant: 'destructive' })
                  } finally {
                    setPdfBusy(false)
                  }
                }}
                disabled={pdfBusy || !payment}
                className="min-h-11 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800"
              >
                {pdfBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Unduh PDF
              </Button>
              <Button variant="outline" onClick={() => window.print()} className="min-h-11 rounded-xl">
                <Printer className="size-4" />
                Cetak
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="min-h-11 rounded-xl"
              >
                Tutup
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ==== printable student report (Rapor Santri) ====

/**
 * Scoped print rules, mounted only while the Rapor dialog is open.
 * Strategy: every direct child of <body> that does not contain the report is
 * removed from layout (no blank trailing pages), the Radix scroll-lock inline
 * styles are neutralized so long reports paginate, and the dialog chrome is
 * hidden while the report subtree stays visible.
 */
const RAPOR_PRINT_CSS = `
@media print {
  body > *:not(:has(#rapor-santri-print)) { display: none !important; }
  html, body { overflow: visible !important; height: auto !important; }
  body * { visibility: hidden !important; }
  #rapor-santri-print, #rapor-santri-print * { visibility: visible !important; }
  [data-slot='dialog-overlay'],
  [data-slot='dialog-close'],
  .no-print { display: none !important; }
  [data-slot='dialog-content'] {
    position: static !important;
    display: block !important;
    width: 100% !important;
    max-width: none !important;
    max-height: none !important;
    overflow: visible !important;
    transform: none !important;
    animation: none !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    padding: 0 !important;
    background: #ffffff !important;
  }
  #rapor-santri-print { border-radius: 0 !important; box-shadow: none !important; }
  #rapor-santri-print, #rapor-santri-print * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
`

function RaporSectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-800">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700">
        <Icon className="size-3.5" />
      </span>
      {children}
    </p>
  )
}

function RaporDialog({
  child,
  open,
  onOpenChange,
}: {
  child: ParentStudent
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const [pdfBusy, setPdfBusy] = useState(false)
  const summary = child.attendanceSummary
  const rate = attendanceRate(child)
  const avgGrade = averageHafalanGrade(child.hafalans)
  const printDate = formatShortDate(new Date())
  const reportYear = new Date().getFullYear()

  const paidList = child.payments.filter((p) => p.status === 'SUCCESS')
  const pendingList = child.payments.filter((p) => p.status === 'PENDING')
  const totalPaid = paidList.reduce((acc, p) => acc + p.amount, 0)
  const totalPending = pendingList.reduce((acc, p) => acc + p.amount, 0)

  const identityRows: [string, string][] = [
    ['Nama Lengkap', child.fullName],
    ['NIS', child.nis],
    ['Kelas', child.className],
    ['Program & Jadwal', child.classSchedule || '—'],
    ['Ustadz/Ustadzah Pengampu', child.teacherName || '—'],
    ['Tanggal Cetak', printDate],
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
        <style dangerouslySetInnerHTML={{ __html: RAPOR_PRINT_CSS }} />

        <DialogHeader className="no-print">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5 text-emerald-700" />
            Rapor Santri
          </DialogTitle>
          <DialogDescription>
            Laporan resmi perkembangan {child.fullName} — siap dicetak atau disimpan sebagai PDF.
          </DialogDescription>
        </DialogHeader>

        <div id="rapor-santri-print" className="rounded-2xl border-2 border-emerald-700/70 bg-white p-5 sm:p-7">
          {/* Report letterhead */}
          <div className="flex flex-wrap items-center gap-4 border-b-2 border-emerald-700 pb-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-700 text-white">
              <Landmark className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold tracking-[0.1em] text-emerald-800 sm:text-xl sm:tracking-[0.18em]">TPQ DARUL JINAN</p>
              <p className="mt-0.5 text-xs text-stone-500 sm:text-sm">Laporan Perkembangan Santri — SIMADJI</p>
            </div>
            <span className="shrink-0 rounded-lg bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Rapor {reportYear}
            </span>
          </div>

          {/* Identity */}
          <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
            {identityRows.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{label}</p>
                <p className="break-words text-sm font-semibold text-stone-800">{value}</p>
              </div>
            ))}
          </div>

          {/* Attendance summary */}
          <div className="mt-6 space-y-3">
            <RaporSectionTitle icon={ClipboardCheck}>Ringkasan Kehadiran</RaporSectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(['HADIR', 'IZIN', 'SAKIT', 'ALPA'] as const).map((st) => (
                <div key={st} className="rounded-xl border border-stone-200 bg-white p-3 text-center">
                  <p className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-500">
                    <span className={`size-2 rounded-full ${RAPOR_ATT_DOT[st]}`} />
                    {st}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-stone-800">{summary[ATT_COUNT_KEY[st]]}</p>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Tingkat Kehadiran</p>
                  <p className="mt-0.5 text-xs text-stone-500">
                    {summary.total > 0
                      ? `dari ${summary.total} pertemuan tercatat`
                      : 'Belum ada pertemuan tercatat.'}
                  </p>
                </div>
                <p className="text-4xl font-extrabold leading-none text-emerald-700">
                  {summary.total > 0 ? `${rate}%` : '–'}
                </p>
              </div>
              {summary.total > 0 && (
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-emerald-600" style={{ width: `${rate}%` }} />
                </div>
              )}
            </div>
          </div>

          {/* Hafalan progress */}
          <div className="mt-6 space-y-3">
            <RaporSectionTitle icon={BookOpenCheck}>Progres Hafalan</RaporSectionTitle>
            {child.hafalans.length === 0 ? (
              <p className="rounded-xl bg-stone-50 p-4 text-sm italic text-stone-500">
                Belum ada setoran tercatat. Progres hafalan akan muncul setelah santri menyetorkan hafalan kepada
                ustadz/ustadzah pengampu.
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-stone-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-50 hover:bg-stone-50">
                      <TableHead>Surah</TableHead>
                      <TableHead>Ayat</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead className="text-center">Nilai</TableHead>
                      <TableHead>Catatan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {child.hafalans.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium text-stone-800">QS {h.surahName}</TableCell>
                        <TableCell className="text-stone-600">{h.ayatRange}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${HAFALAN_BADGE[h.type] ?? ''}`}>{h.type}</Badge>
                        </TableCell>
                        <TableCell className={`text-center font-bold ${gradeTextClass(h.grade)}`}>
                          {h.grade ?? '–'}
                        </TableCell>
                        <TableCell className="whitespace-normal text-xs text-stone-500">
                          {h.teacherNote || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-emerald-50/70 hover:bg-emerald-50/70">
                      <TableCell colSpan={3} className="font-semibold text-emerald-800">
                        Rata-rata Nilai
                      </TableCell>
                      <TableCell className={`text-center font-bold ${gradeTextClass(avgGrade)}`}>
                        {avgGrade ?? '–'}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </div>

          {/* Finance */}
          <div className="mt-6 space-y-3">
            <RaporSectionTitle icon={Wallet}>Keuangan</RaporSectionTitle>
            {child.payments.length === 0 ? (
              <p className="rounded-xl bg-stone-50 p-4 text-sm italic text-stone-500">
                Belum ada tagihan tercatat untuk santri ini.
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                    <CircleCheck className="size-3.5" />
                    Total Dibayar
                  </p>
                  <p className="mt-1 text-2xl font-bold text-emerald-700">{formatRupiah(totalPaid)}</p>
                  <p className="text-xs text-stone-500">{paidList.length} tagihan berhasil dibayar</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                    <Clock className="size-3.5" />
                    Tunggakan
                  </p>
                  <p className="mt-1 text-2xl font-bold text-amber-700">{formatRupiah(totalPending)}</p>
                  <p className="text-xs text-stone-500">{pendingList.length} tagihan menunggu pembayaran</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="mt-6 border-t border-dashed border-stone-300 pt-4">
            <p className="text-xs italic leading-relaxed text-stone-500">
              Laporan ini dihasilkan otomatis oleh SIMADJI — Sistem Informasi Manajemen TPQ Darul Jinan pada {printDate}{' '}
              dan merupakan dokumentasi resmi perkembangan santri.
            </p>
            <p className="mt-1 text-xs italic text-stone-500">
              Pertanyaan &amp; konfirmasi: WhatsApp Sekretariat 0812-3456-7890 (wa.me/6281234567890).
            </p>
          </div>
        </div>

        <div className="no-print flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Tutup
          </Button>
          <Button variant="outline" onClick={() => window.print()} className="rounded-xl">
            <Printer className="size-4" />
            Cetak
          </Button>
          <Button
            onClick={async () => {
              setPdfBusy(true)
              try {
                const blob = await buildRaporSantriPdf(child)
                downloadBlob(blob, `Rapor-${child.fullName}-TPQ-Darul-Jinan-${reportYear}.pdf`)
                toast({ title: 'PDF berhasil diunduh', description: `Rapor ${child.fullName} tersimpan utuh di perangkat Anda.` })
              } catch (e) {
                console.error(e)
                toast({ title: 'Gagal membuat PDF', description: 'Terjadi kesalahan saat menyusun rapor.', variant: 'destructive' })
              } finally {
                setPdfBusy(false)
              }
            }}
            disabled={pdfBusy}
            className="rounded-xl bg-emerald-700 text-white hover:bg-emerald-800"
          >
            {pdfBusy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Unduh PDF
          </Button>
        </div>
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

  // ==== GPS wajib (Task 33/34) — hook bersama; izin lokasi diminta otomatis saat kartu tampil ====
  const { gps, state: gpsState, error: gpsError, acquire: acquireGps, ensureFresh } = useGpsFix()

  // ==== Pemindai QR kamera — hook bersama dgn halaman publik (id unik per anak) ====
  const SCANNER_DIV = `wali-checkin-qr-${child.id}`
  const handleDecoded = useCallback(
    (found: string) => {
      setCode(found)
      toast({ title: 'QR Terbaca', description: `Kode ${found} terisi otomatis. Tekan Check-in.` })
    },
    [toast],
  )
  const { scanning, error: scanError, start: startScan, stop: stopScan } = useQrScanner(SCANNER_DIV, handleDecoded)

  // Portal data has no classId, so match the child's class by class name.
  const classSessions = activeSessions.filter((s) => s.className === child.className)

  async function submit() {
    const trimmed = code.trim()
    if (!trimmed) {
      toast({ title: 'Kode kosong', description: 'Masukkan atau pindai kode kehadiran terlebih dahulu.', variant: 'destructive' })
      return
    }
    setChecking(true)
    try {
      // GPS segar saat submit — server menolak posisi basi (> 3 menit).
      let fix: GpsFix
      try {
        fix = await ensureFresh()
      } catch {
        toast({
          title: 'GPS belum siap',
          description:
            'Check-in wajib GPS untuk mencegah absen palsu (maks. 20 m dari titik kelas). Izinkan akses lokasi, lalu tekan Coba Lagi.',
          variant: 'destructive',
        })
        return
      }
      const res = await apiSend<{ success?: boolean; already?: boolean; message?: string }>(
        '/api/attendance/checkin',
        'POST',
        {
          code: trimmed,
          studentId: child.id,
          gps: { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, posTs: fix.posTs },
        },
      )
      if (res?.already) {
        toast({ title: 'Sudah terabsen', description: res.message ?? `${child.fullName} sudah tercatat pada sesi ini.` })
      } else {
        toast({ title: 'Check-in tercatat', description: res.message ?? `${child.fullName} tercatat hadir.` })
      }
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
          Pindai QR kelas dengan kamera atau masukkan kode dari ustadz/ustadzah — kehadiran {child.fullName}{' '}
          tervalidasi GPS (maks. 20 m dari titik kelas).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !checking) void submit()
            }}
            placeholder="Contoh: DJ-IA01-XXXX"
            className="h-10 flex-1 rounded-xl font-mono uppercase tracking-wider"
            disabled={checking}
            aria-label="Kode kehadiran sesi"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => (scanning ? void stopScan() : void startScan())}
              disabled={checking}
              className="h-10 shrink-0 rounded-xl border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              aria-label={scanning ? 'Tutup kamera' : 'Pindai QR dengan kamera'}
            >
              {scanning ? <CameraOff className="size-4" /> : <Camera className="size-4" />}
              {scanning ? 'Tutup' : 'Pindai QR'}
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={checking}
              className="h-10 flex-1 rounded-xl bg-emerald-700 px-5 text-white hover:bg-emerald-800 sm:flex-none"
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
        </div>

        {/* ==== Kamera pemindai QR ==== */}
        {scanning && (
          <div className="overflow-hidden rounded-2xl border-2 border-emerald-300 bg-stone-900 shadow-inner">
            <div className="flex items-center justify-between border-b border-stone-700 bg-stone-800 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                Kamera aktif — arahkan ke QR kelas
              </span>
              <button
                type="button"
                className="rounded-md p-1 text-stone-300 transition-colors hover:bg-stone-700 hover:text-white"
                onClick={() => void stopScan()}
                aria-label="Tutup kamera"
              >
                <X className="size-4" />
              </button>
            </div>
            <div id={SCANNER_DIV} className="mx-auto max-w-xs" aria-label="Bidang pemindai QR" />
          </div>
        )}
        {scanError && !scanning && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
            {scanError}
          </div>
        )}

        {/* ==== Status GPS (wajib — validasi 20 m) ==== */}
        {gpsState === 'locating' && (
          <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
            <Loader2 className="size-4 animate-spin text-emerald-600" />
            Mengunci posisi GPS… (diperlukan untuk validasi absen maks. 20 m)
          </div>
        )}
        {gpsState === 'ok' && gps && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <span className="inline-flex items-center gap-2">
              <MapPin className="size-3.5 text-emerald-600" />
              GPS siap{gps.accuracy != null ? ` (±${Math.round(gps.accuracy)} m)` : ''} — validasi 20 m aktif
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-100"
              onClick={() => void acquireGps()}
              aria-label="Perbarui posisi GPS"
            >
              <RefreshCw className="size-3" /> Segarkan
            </Button>
          </div>
        )}
        {gpsState === 'error' && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
              <span>{gpsError}</span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 h-8 border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => void acquireGps()}
            >
              <RefreshCw className="size-3.5" /> Coba Lagi
            </Button>
          </div>
        )}

        <div className="rounded-xl bg-stone-50 p-3">
          {classSessions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-stone-500">Kode sesi aktif kelas {child.className}:</span>
              {classSessions.map((s) =>
                s.code ? (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCode(s.code!)}
                    className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-mono text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                    title={s.topic ? `Topik: ${s.topic}` : 'Sesi aktif'}
                  >
                    {s.code}
                  </button>
                ) : (
                  <span
                    key={s.id}
                    className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs text-stone-400"
                    title="Minta kode lewat QR yang ditayangkan ustadz/ustadzah"
                  >
                    Kode via QR ustadz
                  </span>
                ),
              )}
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
  const [receiptTarget, setReceiptTarget] = useState<Payment | null>(null)
  const [raporOpen, setRaporOpen] = useState(false)
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
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-800 text-sm font-bold text-white shadow-sm ring-2 ring-emerald-100">
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
          <CardAction className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRaporOpen(true)}
              className="h-8 rounded-lg border-emerald-300 px-3 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <FileText className="size-4" />
              Rapor Santri
            </Button>
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

      {/* b2. Monthly attendance recap (renders nothing when there is no data) */}
      <AttendanceRecap attendances={child.attendances} />

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

      {/* c2. Hafalan analytics (juz-30 map + grade trend) — only with data */}
      {child.hafalans.length > 0 && (
        <div className="lg:col-span-2">
          <HafalanProgress hafalans={child.hafalans} target={child.hafalanTarget} />
        </div>
      )}

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
                        {p.status === 'SUCCESS' && (
                          <span className="flex items-center justify-end gap-1.5">
                            <CheckCircle2 className="size-4 text-emerald-600" />
                            {/* Re-print entry point — seed SUCCESS rows may carry method: null; the receipt falls back to 'QRIS'. */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setReceiptTarget(p)}
                              aria-label={`Struk ${p.invoiceNo}`}
                              title={`Cetak struk ${p.invoiceNo}`}
                              className="size-9 rounded-lg text-stone-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                            >
                              <Printer className="size-4" />
                            </Button>
                          </span>
                        )}
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
        studentNis={child.nis}
        onDismiss={() => setPayTarget(null)}
        onPaid={onRefresh}
      />

      {/* Re-printable struk from the riwayat pembayaran table. */}
      <ReceiptDialog
        payment={receiptTarget}
        studentName={child.fullName}
        studentNis={child.nis}
        open={!!receiptTarget}
        onOpenChange={(open) => {
          if (!open) setReceiptTarget(null)
        }}
      />

      <RaporDialog child={child} open={raporOpen} onOpenChange={setRaporOpen} />
    </div>
  )
}
