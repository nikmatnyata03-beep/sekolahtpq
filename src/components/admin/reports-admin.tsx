'use client'

/**
 * Laporan Bulanan — admin menghasilkan laporan operasional TPQ per bulan
 * dalam bentuk PDF (client-side jsPDF, nol beban CPU Workers).
 *
 * Fitur: pilih bulan → preview ringkasan → Baca PDF (iframe) / Unduh PDF.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Calendar,
  Users,
  UserPlus,
  GraduationCap,
  ClipboardList,
  Wallet,
  CheckCircle2,
  BookMarked,
  Eye,
  Download,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Inbox,
  Loader2,
  FileText,
  Percent,
  BellRing,
  type LucideIcon,
} from 'lucide-react'
import { apiGet, formatRupiah, formatShortDate } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ============================================================
// Tipe data (mencerminkan respons /api/reports/monthly)
// ============================================================

interface ReportStudentRow {
  nis: string
  fullName: string
  gender: string
  className: string
  status: string
  createdAt: string
}
interface ReportRegRow {
  regNumber: string
  childName: string
  parentName: string
  status: string
  createdAt: string
}
interface ReportPaymentRow {
  invoiceNo: string
  title: string
  studentName: string
  method: string
  amount: number
  paidAt: string | null
}
interface ReportHafalanRow {
  studentName: string
  surahName: string
  ayatRange: string
  type: string
  grade: number | null
  createdAt: string
}

interface MonthlyReport {
  month: string
  generatedAt: string
  snapshot: { studentsActive: number; teachersActive: number; classesActive: number }
  students: {
    newCount: number
    byStatus: Record<string, number>
    list: ReportStudentRow[]
  }
  registrations: { total: number; byStatus: Record<string, number>; list: ReportRegRow[] }
  payments: {
    billedTotal: number
    billedCount: number
    paidTotal: number
    paidCount: number
    pendingCount: number
    pendingTotal: number
    failedCount: number
    byMethod: Record<string, { count: number; amount: number }>
    list: ReportPaymentRow[]
  }
  attendance: {
    sessionCount: number
    breakdown: Record<string, number>
    total: number
    rate: number
    byClass: Array<{ name: string; sessions: number; HADIR: number; total: number }>
  }
  hafalan: {
    count: number
    avgGrade: number | null
    byType: Record<string, number>
    list: ReportHafalanRow[]
  }
  notifications: { sentCount: number }
}

// ============================================================
// Helper format (id-ID)
// ============================================================

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function previousMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return `${BULAN[(m || 1) - 1]} ${y}`
}

function dateId(iso: string | null, withTime = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const tgl = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
  if (!withTime) return tgl
  const jam = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(d)
  return `${tgl}, ${jam} WIB`
}

function genderLabel(g: string): string {
  return g === 'L' ? 'Laki-laki' : g === 'P' ? 'Perempuan' : g
}

function hafalanTypeLabel(t: string): string {
  if (t === 'TAHFIDZ') return 'Setoran Baru'
  if (t === 'MURAJAAH') return 'Murojaah'
  if (t === 'TAHSHIN') return 'Tahsin'
  return t
}

function regStatusBadge(s: string) {
  if (s === 'DITERIMA') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (s === 'PENDING') return 'bg-amber-100 text-amber-800 border-amber-200'
  if (s === 'DITOLAK') return 'bg-red-100 text-red-700 border-red-200'
  return 'bg-stone-100 text-stone-700 border-stone-200'
}

function regStatusLabel(s: string): string {
  if (s === 'PENDING') return 'Menunggu'
  if (s === 'VERIFIKASI') return 'Verifikasi'
  if (s === 'DITERIMA') return 'Diterima'
  if (s === 'DITOLAK') return 'Ditolak'
  return s
}

// ============================================================
// Generator PDF (jsPDF + autoTable, dynamic import)
// ============================================================

const EMERALD: [number, number, number] = [4, 120, 87]
const EMERALD_DARK: [number, number, number] = [6, 78, 59]
const AMBER: [number, number, number] = [217, 119, 6]
const INK: [number, number, number] = [41, 37, 36]
const GRAY: [number, number, number] = [120, 113, 108]
const LINE: [number, number, number] = [231, 229, 228]
const SOFT: [number, number, number] = [240, 253, 244]
const STRIPE: [number, number, number] = [250, 250, 249]

async function buildMonthlyPdf(report: MonthlyReport, creatorName: string): Promise<Blob> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const autoTable = autoTableMod.default

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 40 // margin kiri/kanan
  const periode = monthLabel(report.month)
  const daysInMonth = new Date(
    Number(report.month.slice(0, 4)),
    Number(report.month.slice(5, 7)),
    0,
  ).getDate()

  // ---------- Header band (halaman 1) ----------
  doc.setFillColor(...EMERALD)
  doc.rect(0, 0, W, 92, 'F')
  doc.setFillColor(...AMBER)
  doc.rect(0, 92, W, 5, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(19)
  doc.text('LAPORAN BULANAN', M, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.text("TPQ Darul Jinan — Taman Pendidikan Al-Qur'an", M, 60)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(periode, W - M, 40, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Periode: 1 s.d. ${daysInMonth} ${monthLabel(report.month)}`, W - M, 58, { align: 'right' })
  doc.text(`Dibuat: ${dateId(report.generatedAt, true)}`, W - M, 74, { align: 'right' })

  let y = 122
  const cursor = (): number => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  const sectionTitle = (label: string, desc?: string) => {
    doc.setFillColor(...EMERALD_DARK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11.5)
    doc.setTextColor(...INK)
    doc.text(label, M, y)
    const tw = doc.getTextWidth(label)
    doc.setFillColor(...AMBER)
    doc.rect(M, y + 5, Math.max(tw, 90), 2.2, 'F')
    if (desc) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      doc.setTextColor(...GRAY)
      doc.text(desc, M, y + 17)
      y += 30
    } else {
      y += 26
    }
  }

  const kvTable = (rows: Array<[string, string]>) => {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5, lineColor: LINE, lineWidth: 0.5, textColor: INK },
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: SOFT, cellWidth: 250 },
        1: { halign: 'right' },
      },
      body: rows.map(([k, v]) => [k, v]),
    })
    y = cursor() + 22
  }

  const detailTable = (
    head: string[],
    body: Array<Array<string | number | { content: string; colSpan: number; styles?: Record<string, unknown> }>>,
    colWidths?: Record<number, number>,
  ) => {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: 44 },
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 4.5, lineColor: LINE, lineWidth: 0.4, textColor: INK },
      headStyles: { fillColor: EMERALD, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: STRIPE },
      columnStyles: colWidths ?? {},
      head: [head],
      body: body.length
        ? body
        : [
            [
              {
                content: 'Tidak ada data pada bulan ini',
                colSpan: head.length,
                styles: { halign: 'center', fontStyle: 'italic', textColor: GRAY },
              },
            ],
          ],
    })
    y = cursor() + 24
  }

  // ---------- A. Ringkasan Utama ----------
  sectionTitle('A. Ringkasan Utama', 'Gabungan seluruh indikator operasional pada periode laporan')
  kvTable([
    ['Santri aktif (saat laporan dibuat)', `${report.snapshot.studentsActive} santri`],
    ['Santri baru masuk bulan ini', `${report.students.newCount} santri`],
    ['Ustadz/ustadzah aktif', `${report.snapshot.teachersActive} guru`],
    ['Kelas aktif', `${report.snapshot.classesActive} kelas`],
    ['Pendaftar PPDB bulan ini', `${report.registrations.total} pendaftar`],
    ['Pemasukan diterima', formatRupiah(report.payments.paidTotal)],
    ['Transaksi lunas', `${report.payments.paidCount} transaksi`],
    ['Tingkat kehadiran', report.attendance.total ? `${report.attendance.rate}% dari ${report.attendance.total} catatan` : 'Belum ada presensi'],
    ['Setoran hafalan', `${report.hafalan.count} setoran${report.hafalan.avgGrade !== null ? ` · rata-rata nilai ${report.hafalan.avgGrade}` : ''}`],
    ['Notifikasi WhatsApp terkirim', `${report.notifications.sentCount} pesan`],
  ])

  // ---------- B. Keuangan ----------
  sectionTitle('B. Keuangan', 'Tagihan dibuat dan pembayaran diterima pada periode ini')
  kvTable([
    ['Total tagihan dibuat', `${formatRupiah(report.payments.billedTotal)} (${report.payments.billedCount} tagihan)`],
    ['Pemasukan diterima (lunas)', `${formatRupiah(report.payments.paidTotal)} (${report.payments.paidCount} transaksi)`],
    ['Tunggakan (tagihan belum lunas)', `${formatRupiah(report.payments.pendingTotal)} (${report.payments.pendingCount} tagihan)`],
    ['Pembayaran gagal', `${report.payments.failedCount} transaksi`],
    ...Object.entries(report.payments.byMethod).map(
      ([met, v]) => [`Metode ${met}`, `${formatRupiah(v.amount)} (${v.count}x)`] as [string, string],
    ),
  ])

  // ---------- C. Presensi ----------
  sectionTitle('C. Presensi', 'Rekap kehadiran dari sesi belajar ber-QR pada periode ini')
  kvTable([
    ['Jumlah sesi belajar', `${report.attendance.sessionCount} sesi`],
    ['Total catatan kehadiran', `${report.attendance.total} catatan`],
    ['Hadir', `${report.attendance.breakdown.HADIR ?? 0} santri`],
    ['Izin', `${report.attendance.breakdown.IZIN ?? 0} santri`],
    ['Sakit', `${report.attendance.breakdown.SAKIT ?? 0} santri`],
    ['Alpa (tanpa keterangan)', `${report.attendance.breakdown.ALPA ?? 0} santri`],
    ['Tingkat kehadiran', report.attendance.total ? `${report.attendance.rate}%` : '—'],
  ])

  // ---------- D. Hafalan ----------
  sectionTitle('D. Hafalan', 'Setoran dan capaian hafalan santri pada periode ini')
  kvTable([
    ['Total setoran', `${report.hafalan.count} setoran`],
    ['Setoran baru (tahfidz)', `${report.hafalan.byType.TAHFIDZ ?? 0} setoran`],
    ['Murojaah (pengulangan)', `${report.hafalan.byType.MURAJAAH ?? 0} setoran`],
    ['Tahsin (perbaikan bacaan)', `${report.hafalan.byType.TAHSHIN ?? 0} setoran`],
    ['Rata-rata nilai', report.hafalan.avgGrade !== null ? `${report.hafalan.avgGrade} / 100` : '—'],
  ])

  // ---------- E. Santri baru ----------
  doc.addPage()
  y = 56
  sectionTitle('E. Daftar Santri Baru', 'Santri yang terdaftar pada periode laporan')
  detailTable(
    ['No', 'NIS', 'Nama Santri', 'JK', 'Kelas', 'Tgl Masuk'],
    report.students.list.map((s, i) => [
      i + 1,
      s.nis,
      s.fullName,
      s.gender === 'L' ? 'L' : 'P',
      s.className,
      dateId(s.createdAt),
    ]),
    { 0: { cellWidth: 28, halign: 'center' }, 3: { cellWidth: 30, halign: 'center' } },
  )

  // ---------- F. Pendaftaran PPDB ----------
  sectionTitle('F. Pendaftaran PPDB', 'Pendaftar baru dan hasil verifikasi pada periode ini')
  detailTable(
    ['No', 'No. Registrasi', 'Nama Anak', 'Nama Wali', 'Status', 'Tgl Daftar'],
    report.registrations.list.map((r, i) => [
      i + 1,
      r.regNumber,
      r.childName,
      r.parentName,
      regStatusLabel(r.status),
      dateId(r.createdAt),
    ]),
    { 0: { cellWidth: 28, halign: 'center' } },
  )

  // ---------- G. Pembayaran lunas ----------
  sectionTitle('G. Rincian Pembayaran Lunas', 'Transaksi keuangan yang diterima pada periode ini')
  detailTable(
    ['No', 'Invoice', 'Keterangan', 'Santri', 'Metode', 'Jumlah', 'Tgl Bayar'],
    report.payments.list.map((p, i) => [
      i + 1,
      p.invoiceNo,
      p.title,
      p.studentName,
      p.method,
      formatRupiah(p.amount),
      dateId(p.paidAt),
    ]),
    {
      0: { cellWidth: 28, halign: 'center' },
      5: { halign: 'right' },
      6: { cellWidth: 62 },
    },
  )

  // ---------- H. Setoran hafalan ----------
  sectionTitle('H. Setoran Hafalan Terakhir', '15 setoran terakhir beserta penilaian ustadz')
  detailTable(
    ['No', 'Santri', 'Surah', 'Ayat', 'Jenis', 'Nilai', 'Tanggal'],
    report.hafalan.list.map((h, i) => [
      i + 1,
      h.studentName,
      h.surahName,
      h.ayatRange,
      hafalanTypeLabel(h.type),
      h.grade !== null ? `${h.grade}` : '—',
      dateId(h.createdAt),
    ]),
    { 0: { cellWidth: 28, halign: 'center' }, 5: { halign: 'center' } },
  )

  // ---------- Penutup ----------
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text(
    'Dokumen ini dihasilkan otomatis oleh SIMADJI — Sistem Informasi Manajemen TPQ Darul Jinan. ' +
      'Angka merupakan kondisi data pada saat laporan dibuat.',
    M,
    Math.min(y + 10, H - 60),
    { maxWidth: W - M * 2 },
  )

  // ---------- Footer semua halaman ----------
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.6)
    doc.line(M, H - 42, W - M, H - 42)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('SIMADJI · TPQ Darul Jinan', M, H - 28)
    doc.text(`Dicetak oleh ${creatorName}`, W / 2, H - 28, { align: 'center' })
    doc.text(`Halaman ${i} dari ${pages}`, W - M, H - 28, { align: 'right' })
  }

  return doc.output('blob')
}

// ============================================================
// Komponen utama
// ============================================================

function StatCard({ icon: Icon, label, value, sub, tone = 'emerald' }: {
  icon: LucideIcon
  label: string
  value: string
  sub?: string
  tone?: 'emerald' | 'amber' | 'stone'
}) {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-100 text-amber-800'
      : tone === 'stone'
        ? 'bg-stone-100 text-stone-700'
        : 'bg-emerald-100 text-emerald-800'
  return (
    <Card className="border-stone-200 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${toneClass}`}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-stone-500">{label}</p>
          <p className="truncate text-lg font-bold text-stone-900">{value}</p>
          {sub ? <p className="truncate text-[11px] text-stone-500">{sub}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}

export function ReportsAdmin({ user }: { user: { name: string; role: string } }) {
  const { toast } = useToast()
  const [month, setMonth] = useState(currentMonth)
  const [data, setData] = useState<MonthlyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [pdfOpen, setPdfOpen] = useState(false)
  const pdfBlobRef = useRef<Blob | null>(null)
  const pdfMonthRef = useRef<string | null>(null)

  const load = useCallback(
    async (m: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiGet<MonthlyReport>(`/api/reports/monthly?month=${encodeURIComponent(m)}`)
        setData(res)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Gagal memuat laporan')
        setData(null)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    load(month)
  }, [load, month])

  // Lepas blob URL saat bulan berganti
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    }
  }, [pdfUrl])

  const hasAnyData = useMemo(() => {
    if (!data) return false
    return (
      data.students.newCount > 0 ||
      data.registrations.total > 0 ||
      data.payments.billedCount > 0 ||
      data.attendance.total > 0 ||
      data.hafalan.count > 0
    )
  }, [data])

  async function ensurePdfBlob(): Promise<Blob | null> {
    if (!data) return null
    if (pdfMonthRef.current === month && pdfBlobRef.current) return pdfBlobRef.current
    const blob = await buildMonthlyPdf(data, user.name)
    pdfBlobRef.current = blob
    pdfMonthRef.current = month
    return blob
  }

  async function handleViewPdf() {
    setGenerating(true)
    try {
      const blob = await ensurePdfBlob()
      if (!blob) return
      if (pdfUrl) URL.revokeObjectURL(pdfUrl)
      setPdfUrl(URL.createObjectURL(blob))
      setPdfOpen(true)
    } catch (e) {
      console.error(e)
      toast({ title: 'Gagal membuat PDF', description: 'Terjadi kesalahan saat menyusun dokumen.', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownloadPdf() {
    setGenerating(true)
    try {
      const blob = await ensurePdfBlob()
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Laporan-Bulanan-TPQ-Darul-Jinan-${month}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast({ title: 'PDF berhasil diunduh', description: `Laporan ${monthLabel(month)} tersimpan di perangkat Anda.` })
    } catch (e) {
      console.error(e)
      toast({ title: 'Gagal membuat PDF', description: 'Terjadi kesalahan saat menyusun dokumen.', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* ===== Toolbar ===== */}
      <Card className="border-stone-200 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <label htmlFor="bulan-laporan" className="text-xs font-semibold text-stone-600">
                Periode Laporan
              </label>
              <Input
                id="bulan-laporan"
                type="month"
                value={month}
                onChange={(e) => {
                  pdfMonthRef.current = null
                  pdfBlobRef.current = null
                  setMonth(e.target.value || currentMonth())
                }}
                max={currentMonth()}
                className="w-full sm:w-52"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setMonth(currentMonth())} className="border-emerald-200 text-emerald-800 hover:bg-emerald-50">
                <Calendar className="size-3.5" /> Bulan Ini
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMonth(previousMonth())} className="border-emerald-200 text-emerald-800 hover:bg-emerald-50">
                <Calendar className="size-3.5" /> Bulan Lalu
              </Button>
              <Button variant="outline" size="icon" aria-label="Muat ulang" onClick={() => load(month)} disabled={loading}>
                <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-t border-stone-100 pt-4 sm:flex-row">
            <Button
              onClick={handleViewPdf}
              disabled={loading || generating || !data}
              className="flex-1 bg-emerald-700 text-white hover:bg-emerald-800"
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
              Baca PDF
            </Button>
            <Button
              onClick={handleDownloadPdf}
              disabled={loading || generating || !data}
              variant="outline"
              className="flex-1 border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
            >
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Unduh PDF
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-stone-500">
            Laporan berisi ringkasan santri, PPDB, keuangan, presensi, dan hafalan bulan{' '}
            <span className="font-semibold text-stone-700">{monthLabel(month)}</span>. PDF dibuat langsung di
            perangkat Anda — bisa dibaca di layar maupun diunduh untuk diarsip/dicetak.
          </p>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive" className="border-red-200">
          <AlertCircle className="size-4" />
          <AlertTitle>Gagal memuat laporan</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* ===== Kartu ringkasan ===== */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard icon={Users} label="Santri Aktif" value={`${data.snapshot.studentsActive}`} sub={`${data.students.newCount} baru bulan ini`} />
            <StatCard icon={GraduationCap} label="Guru Aktif" value={`${data.snapshot.teachersActive}`} sub={`${data.snapshot.classesActive} kelas aktif`} tone="stone" />
            <StatCard icon={ClipboardList} label="Pendaftar PPDB" value={`${data.registrations.total}`} sub={monthLabel(month)} tone="amber" />
            <StatCard icon={Wallet} label="Pemasukan" value={formatRupiah(data.payments.paidTotal)} sub={`${data.payments.paidCount} transaksi lunas`} />
            <StatCard icon={Percent} label="Kehadiran" value={data.attendance.total ? `${data.attendance.rate}%` : '—'} sub={`${data.attendance.sessionCount} sesi belajar`} tone="stone" />
            <StatCard icon={BookMarked} label="Setoran Hafalan" value={`${data.hafalan.count}`} sub={data.hafalan.avgGrade !== null ? `Rata-rata nilai ${data.hafalan.avgGrade}` : 'Belum ada penilaian'} />
            <StatCard icon={CheckCircle2} label="Tunggakan" value={formatRupiah(data.payments.pendingTotal)} sub={`${data.payments.pendingCount} tagihan belum lunas`} tone="amber" />
            <StatCard icon={BellRing} label="Notifikasi WA" value={`${data.notifications.sentCount}`} sub="Pesan terkirim bulan ini" tone="stone" />
          </div>

          {!hasAnyData ? (
            <Alert className="border-amber-200 bg-amber-50">
              <Inbox className="size-4 text-amber-700" />
              <AlertTitle className="text-amber-900">Belum ada aktivitas pada {monthLabel(month)}</AlertTitle>
              <AlertDescription className="text-amber-800">
                Laporan tetap bisa dibuat — isi PDF akan menampilkan kondisi lembaga saat ini tanpa data transaksi bulan tersebut.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* ===== Preview detail ===== */}
          <Tabs defaultValue="keuangan" className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-stone-100 p-1 sm:grid-cols-4">
              <TabsTrigger value="keuangan" className="data-[state=active]:bg-white">Keuangan</TabsTrigger>
              <TabsTrigger value="santri" className="data-[state=active]:bg-white">Santri &amp; PPDB</TabsTrigger>
              <TabsTrigger value="presensi" className="data-[state=active]:bg-white">Presensi</TabsTrigger>
              <TabsTrigger value="hafalan" className="data-[state=active]:bg-white">Hafalan</TabsTrigger>
            </TabsList>

            {/* --- Keuangan --- */}
            <TabsContent value="keuangan" className="mt-3">
              <Card className="border-stone-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="max-h-96 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-emerald-50 [&_tr]:border-b">
                        <TableRow className="hover:bg-emerald-50">
                          <TableHead className="text-emerald-900">Invoice</TableHead>
                          <TableHead className="text-emerald-900">Keterangan</TableHead>
                          <TableHead className="text-emerald-900">Santri</TableHead>
                          <TableHead className="text-emerald-900">Metode</TableHead>
                          <TableHead className="text-right text-emerald-900">Jumlah</TableHead>
                          <TableHead className="text-emerald-900">Tgl</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.payments.list.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="py-10 text-center text-sm text-stone-500">
                              Tidak ada pembayaran lunas pada {monthLabel(month)}
                            </TableCell>
                          </TableRow>
                        ) : (
                          data.payments.list.map((p) => (
                            <TableRow key={p.invoiceNo}>
                              <TableCell className="font-mono text-xs">{p.invoiceNo}</TableCell>
                              <TableCell className="max-w-[180px] truncate">{p.title}</TableCell>
                              <TableCell className="max-w-[140px] truncate">{p.studentName}</TableCell>
                              <TableCell><Badge variant="outline" className="border-stone-200 text-stone-600">{p.method}</Badge></TableCell>
                              <TableCell className="text-right font-semibold text-emerald-800">{formatRupiah(p.amount)}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-stone-500">{dateId(p.paidAt)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- Santri & PPDB --- */}
            <TabsContent value="santri" className="mt-3 space-y-3">
              <Card className="border-stone-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="border-b bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900">
                    Santri Baru ({data.students.newCount})
                  </div>
                  <div className="max-h-64 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>NIS</TableHead>
                          <TableHead>Nama</TableHead>
                          <TableHead>Kelas</TableHead>
                          <TableHead>Tgl Masuk</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.students.list.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="py-8 text-center text-sm text-stone-500">Tidak ada santri baru bulan ini</TableCell>
                          </TableRow>
                        ) : (
                          data.students.list.map((s) => (
                            <TableRow key={s.nis}>
                              <TableCell className="font-mono text-xs">{s.nis}</TableCell>
                              <TableCell>
                                <span className="font-medium">{s.fullName}</span>
                                <span className="ml-2 text-xs text-stone-500">{genderLabel(s.gender)}</span>
                              </TableCell>
                              <TableCell>{s.className}</TableCell>
                              <TableCell className="text-xs text-stone-500">{dateId(s.createdAt)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-stone-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="border-b bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-900">
                    Pendaftar PPDB ({data.registrations.total})
                  </div>
                  <div className="max-h-64 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No. Registrasi</TableHead>
                          <TableHead>Nama Anak</TableHead>
                          <TableHead>Wali</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.registrations.list.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="py-8 text-center text-sm text-stone-500">Tidak ada pendaftaran bulan ini</TableCell>
                          </TableRow>
                        ) : (
                          data.registrations.list.map((r) => (
                            <TableRow key={r.regNumber}>
                              <TableCell className="font-mono text-xs">{r.regNumber}</TableCell>
                              <TableCell className="font-medium">{r.childName}</TableCell>
                              <TableCell>{r.parentName}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={regStatusBadge(r.status)}>{regStatusLabel(r.status)}</Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- Presensi --- */}
            <TabsContent value="presensi" className="mt-3">
              <Card className="border-stone-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="border-b bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900">
                    Presensi per Kelas — {data.attendance.sessionCount} sesi · {data.attendance.total} catatan
                  </div>
                  <div className="max-h-96 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kelas</TableHead>
                          <TableHead>Sesi</TableHead>
                          <TableHead>Hadir</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead className="text-right">Kehadiran</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.attendance.byClass.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-8 text-center text-sm text-stone-500">Belum ada sesi presensi bulan ini</TableCell>
                          </TableRow>
                        ) : (
                          data.attendance.byClass.map((c) => (
                            <TableRow key={c.name}>
                              <TableCell className="font-medium">{c.name}</TableCell>
                              <TableCell>{c.sessions}</TableCell>
                              <TableCell className="text-emerald-700">{c.HADIR}</TableCell>
                              <TableCell>{c.total}</TableCell>
                              <TableCell className="text-right">
                                <Badge className={c.total && c.HADIR / c.total >= 0.8 ? 'bg-emerald-700 text-white' : 'bg-amber-500 text-white'}>
                                  {c.total ? Math.round((c.HADIR / c.total) * 100) : 0}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* --- Hafalan --- */}
            <TabsContent value="hafalan" className="mt-3">
              <Card className="border-stone-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="border-b bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-900">
                    Setoran Hafalan ({data.hafalan.count})
                    {data.hafalan.avgGrade !== null ? ` · rata-rata nilai ${data.hafalan.avgGrade}/100` : ''}
                  </div>
                  <div className="max-h-96 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Santri</TableHead>
                          <TableHead>Surah</TableHead>
                          <TableHead>Jenis</TableHead>
                          <TableHead className="text-center">Nilai</TableHead>
                          <TableHead>Tanggal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.hafalan.list.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-8 text-center text-sm text-stone-500">Belum ada setoran hafalan bulan ini</TableCell>
                          </TableRow>
                        ) : (
                          data.hafalan.list.map((h, i) => (
                            <TableRow key={`${h.studentName}-${h.surahName}-${i}`}>
                              <TableCell className="font-medium">{h.studentName}</TableCell>
                              <TableCell>
                                {h.surahName} <span className="text-xs text-stone-500">{h.ayatRange}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="border-emerald-200 text-emerald-800">{hafalanTypeLabel(h.type)}</Badge>
                              </TableCell>
                              <TableCell className="text-center font-semibold">
                                {h.grade !== null ? (
                                  <span className={h.grade >= 80 ? 'text-emerald-700' : h.grade >= 60 ? 'text-amber-700' : 'text-red-600'}>{h.grade}</span>
                                ) : (
                                  <span className="text-stone-400">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-stone-500">{dateId(h.createdAt)}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      {/* ===== Dialog Baca PDF ===== */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="flex h-[90dvh] max-w-4xl flex-col gap-0 p-0 sm:h-[85dvh]">
          <DialogHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-emerald-700" />
                Laporan Bulanan — {monthLabel(month)}
              </DialogTitle>
              <DialogDescription className="sr-only">Pratinjau dokumen PDF laporan bulanan</DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => pdfUrl && window.open(pdfUrl, '_blank')} className="hidden sm:inline-flex">
                <ExternalLink className="size-3.5" /> Tab Baru
              </Button>
              <Button size="sm" onClick={handleDownloadPdf} className="bg-emerald-700 text-white hover:bg-emerald-800">
                <Download className="size-3.5" /> Unduh
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 bg-stone-100 p-2">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                title={`Laporan bulanan ${monthLabel(month)}`}
                className="h-full w-full rounded-lg border border-stone-200 bg-white"
              />
            ) : null}
          </div>
          <p className="border-t px-4 py-2 text-center text-[11px] text-stone-500 sm:hidden">
            PDF tidak tampil di sebagian ponsel? Gunakan tombol Unduh.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  )
}
