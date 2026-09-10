/**
 * Generator PDF sisi-klien untuk Portal Wali (SIMADJI).
 *
 * Menggantikan pendekatan window.print() yang hasilnya sering terpotong
 * (dialog position:fixed dicetak hanya 1 halaman di sebagian browser).
 * PDF dibuat utuh via jsPDF → file asli multi-halaman, tidak mungkin kepotong.
 *
 * - buildRaporSantriPdf: rapor perkembangan santri (identitas, kehadiran,
 *   hafalan, keuangan).
 * - buildStrukPdf: bukti pembayaran satu halaman.
 *
 * jsPDF diimpor dinamis agar tidak membebani bundle utama.
 */

interface RaporHafalan {
  surahName: string
  ayatRange: string
  type: string
  grade: number | null
  teacherNote: string | null
  createdAt: string
}

interface RaporPayment {
  invoiceNo: string
  title: string
  amount: number
  status: string
  method: string | null
  paidAt: string | null
  createdAt: string
}

export interface RaporPdfChild {
  fullName: string
  nis: string
  className: string
  classSchedule: string
  teacherName: string
  hafalanTarget?: string | null
  attendanceSummary: { hadir: number; izin: number; sakit: number; alpa: number; total: number }
  hafalans: RaporHafalan[]
  payments: RaporPayment[]
}

// ---- palet merek (konsisten dengan Laporan Bulanan admin) ----

type RGB = [number, number, number]
const EMERALD: RGB = [4, 120, 87]
const EMERALD_DARK: RGB = [6, 78, 59]
const AMBER: RGB = [217, 119, 6]
const INK: RGB = [41, 37, 36]
const GRAY: RGB = [120, 113, 108]
const LINE: RGB = [231, 229, 228]
const SOFT: RGB = [240, 253, 244]
const STRIPE: RGB = [250, 250, 249]

// ---- helper format ----

function rupiah(n: number): string {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
}

function fmtDate(iso: string | Date | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

function fmtTimestampWib(d: Date): string {
  const tgl = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(d)
  const jam = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(d)
  return `${tgl}, ${jam} WIB`
}

function hafalanTypeLabel(t: string): string {
  if (t === 'TAHFIDZ') return 'Setoran Baru'
  if (t === 'MURAJAAH') return 'Murojaah'
  if (t === 'TAHSHIN') return 'Tahsin'
  return t
}

function paymentStatusLabel(s: string): string {
  if (s === 'SUCCESS') return 'Lunas'
  if (s === 'PENDING') return 'Menunggu'
  if (s === 'FAILED') return 'Gagal'
  return s
}

function methodLabel(m: string | null): string {
  if (!m) return 'QRIS'
  if (m === 'VA_BCA') return 'VA BCA'
  return m
}

// ---- shared drawing helpers ----

type JsPdfDoc = import('jspdf').jsPDF

function lastY(doc: JsPdfDoc): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
}

function drawHeader(doc: JsPdfDoc, title: string, subtitleRight: string, metaRight: string): void {
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(...EMERALD)
  doc.rect(0, 0, W, 84, 'F')
  doc.setFillColor(...AMBER)
  doc.rect(0, 84, W, 5, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(title, 40, 38)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.text("TPQ Darul Jinan — Taman Pendidikan Al-Qur'an", 40, 57)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(subtitleRight, W - 40, 38, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(metaRight, W - 40, 57, { align: 'right' })
}

function drawFooter(doc: JsPdfDoc, note: string): void {
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.6)
    doc.line(40, H - 42, W - 40, H - 42)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...GRAY)
    doc.text('SIMADJI · TPQ Darul Jinan', 40, H - 28)
    doc.text(note, W / 2, H - 28, { align: 'center' })
    doc.text(`Halaman ${i} dari ${pages}`, W - 40, H - 28, { align: 'right' })
  }
}

function sectionTitle(doc: JsPdfDoc, label: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...INK)
  doc.text(label, 40, y)
  const tw = doc.getTextWidth(label)
  doc.setFillColor(...AMBER)
  doc.rect(40, y + 5, Math.max(tw, 90), 2.2, 'F')
  return y + 26
}

// ============================================================
// Rapor Santri (Portal Wali)
// ============================================================

export async function buildRaporSantriPdf(child: RaporPdfChild): Promise<Blob> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = autoTableMod.default

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const now = new Date()
  const tahun = now.getFullYear()
  const s = child.attendanceSummary
  const rate = s.total > 0 ? Math.round((s.hadir / s.total) * 100) : 0
  const grades = child.hafalans.map((h) => h.grade).filter((g): g is number => typeof g === 'number')
  const avgGrade = grades.length ? Math.round(grades.reduce((a, b) => a + b, 0) / grades.length) : null
  const paid = child.payments.filter((p) => p.status === 'SUCCESS')
  const pending = child.payments.filter((p) => p.status === 'PENDING')
  const totalPaid = paid.reduce((a, p) => a + p.amount, 0)
  const totalPending = pending.reduce((a, p) => a + p.amount, 0)

  drawHeader(doc, 'RAPOR SANTRI', `Rapor ${tahun}`, `Dicetak: ${fmtTimestampWib(now)}`)

  let y = 114

  // ---- A. Identitas ----
  y = sectionTitle(doc, 'A. Identitas Santri', y)
  autoTable(doc, {
    startY: y,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5, lineColor: LINE, lineWidth: 0.5, textColor: INK },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: SOFT, cellWidth: 165 },
      1: { cellWidth: 190 },
    },
    body: [
      ['Nama Lengkap', child.fullName],
      ['NIS', child.nis],
      ['Kelas', child.className],
      ['Program & Jadwal', child.classSchedule || '—'],
      ['Ustadz/Ustadzah Pengampu', child.teacherName || '—'],
      ['Target Hafalan', child.hafalanTarget || '—'],
    ],
  })
  y = lastY(doc) + 22

  // ---- B. Kehadiran ----
  y = sectionTitle(doc, 'B. Ringkasan Kehadiran', y)
  autoTable(doc, {
    startY: y,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5, lineColor: LINE, lineWidth: 0.5, textColor: INK },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: SOFT, cellWidth: 165 },
    },
    body: [
      ['Hadir', `${s.hadir} pertemuan`],
      ['Izin', `${s.izin} pertemuan`],
      ['Sakit', `${s.sakit} pertemuan`],
      ['Alpa (tanpa keterangan)', `${s.alpa} pertemuan`],
      ['Total pertemuan tercatat', `${s.total} pertemuan`],
      ['Tingkat kehadiran', s.total > 0 ? `${rate}%` : 'Belum ada data'],
    ],
  })
  y = lastY(doc) + 22

  // ---- C. Progres Hafalan ----
  y = sectionTitle(doc, 'C. Progres Hafalan', y)
  autoTable(doc, {
    startY: y,
    margin: { left: 40, right: 40, top: 44 },
    theme: 'striped',
    styles: { fontSize: 8.5, cellPadding: 4.5, lineColor: LINE, lineWidth: 0.4, textColor: INK },
    headStyles: { fillColor: EMERALD, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: STRIPE },
    columnStyles: {
      2: { cellWidth: 78 },
      3: { halign: 'center', cellWidth: 42 },
      4: { cellWidth: 150, textColor: GRAY, fontSize: 8 },
    },
    head: [['Surah', 'Ayat', 'Jenis', 'Nilai', 'Catatan Ustadz']],
    body:
      child.hafalans.length > 0
        ? child.hafalans.map((h) => [
            `QS ${h.surahName}`,
            h.ayatRange,
            hafalanTypeLabel(h.type),
            h.grade !== null ? String(h.grade) : '—',
            h.teacherNote || '—',
          ])
        : [
            [
              {
                content: 'Belum ada setoran hafalan tercatat',
                colSpan: 5,
                styles: { halign: 'center', fontStyle: 'italic', textColor: GRAY },
              },
            ],
          ],
    foot: child.hafalans.length
      ? [[
          { content: `Rata-rata Nilai: ${avgGrade ?? '—'}`, colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: SOFT, textColor: EMERALD_DARK } },
          { content: avgGrade !== null ? String(avgGrade) : '—', styles: { halign: 'center', fontStyle: 'bold', fillColor: SOFT, textColor: EMERALD_DARK } },
          { content: '', styles: { fillColor: SOFT } },
        ]]
      : undefined,
  })
  y = lastY(doc) + 22

  // ---- D. Keuangan ----
  y = sectionTitle(doc, 'D. Keuangan', y)
  autoTable(doc, {
    startY: y,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 5, lineColor: LINE, lineWidth: 0.5, textColor: INK },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: SOFT, cellWidth: 165 } },
    body: [
      ['Total dibayar', `${rupiah(totalPaid)} (${paid.length} tagihan lunas)`],
      ['Tunggakan', `${rupiah(totalPending)} (${pending.length} tagihan menunggu)`],
    ],
  })
  y = lastY(doc) + 22

  if (child.payments.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 40, right: 40, top: 44 },
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 4.5, lineColor: LINE, lineWidth: 0.4, textColor: INK },
      headStyles: { fillColor: EMERALD, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: STRIPE },
      columnStyles: {
        4: { halign: 'right' },
        5: { cellWidth: 64 },
      },
      head: [['Invoice', 'Keterangan', 'Metode', 'Status', 'Jumlah', 'Tanggal']],
      body: child.payments.slice(0, 30).map((p) => [
        p.invoiceNo,
        p.title,
        methodLabel(p.method),
        paymentStatusLabel(p.status),
        rupiah(p.amount),
        fmtDate(p.paidAt ?? p.createdAt),
      ]),
    })
    y = lastY(doc) + 20
  }

  // ---- Penutup ----
  const H = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text(
    `Laporan ini dihasilkan otomatis oleh SIMADJI — Sistem Informasi Manajemen TPQ Darul Jinan pada ${fmtDate(now)} ` +
      'dan merupakan dokumentasi resmi perkembangan santri. Pertanyaan & konfirmasi: WhatsApp Sekretariat 0812-3456-7890 (wa.me/6281234567890).',
    40,
    Math.min(y + 10, H - 60),
    { maxWidth: doc.internal.pageSize.getWidth() - 80 },
  )

  drawFooter(doc, `Rapor ${child.fullName} · ${tahun}`)
  return doc.output('blob')
}

// ============================================================
// Struk Pembayaran (Portal Wali)
// ============================================================

export async function buildStrukPdf(opts: {
  invoiceNo: string
  title: string
  amount: number
  studentName: string
  studentNis: string
  method: string | null
  paidAt: Date
}): Promise<Blob> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const autoTable = autoTableMod.default

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  drawHeader(doc, 'STRUK PEMBAYARAN', 'LUNAS', `Dicetak: ${fmtTimestampWib(new Date())}`)

  const W = doc.internal.pageSize.getWidth()
  let y = 116

  autoTable(doc, {
    startY: y,
    margin: { left: 40, right: 40 },
    theme: 'grid',
    styles: { fontSize: 9.5, cellPadding: 6, lineColor: LINE, lineWidth: 0.5, textColor: INK },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: SOFT, cellWidth: 150 } },
    body: [
      ['No. Invoice', opts.invoiceNo],
      ['Santri', `${opts.studentName} (NIS ${opts.studentNis})`],
      ['Keterangan', opts.title],
      ['Metode', methodLabel(opts.method)],
      ['Tanggal Bayar', fmtTimestampWib(opts.paidAt)],
    ],
  })
  y = lastY(doc) + 18

  // Total menonjol
  doc.setFillColor(...SOFT)
  doc.roundedRect(40, y, W - 80, 52, 8, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...GRAY)
  doc.text('TOTAL BAYAR', 56, y + 21)
  doc.setFontSize(18)
  doc.setTextColor(...EMERALD_DARK)
  doc.text(rupiah(opts.amount), W - 56, y + 33, { align: 'right' })
  y += 74

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(
    'Terima kasih — jazakumullahu khairan. Bukti pembayaran resmi TPQ Darul Jinan; simpan dokumen ini sebagai arsip pembayaran.',
    40,
    y,
    { maxWidth: W - 80 },
  )

  drawFooter(doc, `Struk ${opts.invoiceNo}`)
  return doc.output('blob')
}

// ============================================================
// Unduh helper
// ============================================================

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
