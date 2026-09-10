'use client'

// Drawer detail per-santri (Task 13-c): dibuka dari menu "Aksi" tabel Santri.
// Tiga tab data — Hafalan, Absensi, Tagihan — diambil via ?studentId= saat sheet terbuka.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  BookMarked,
  Cake,
  CalendarDays,
  Inbox,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Target,
  User,
  Wallet,
} from 'lucide-react'
import type { Hafalan, Payment, Student } from '@/lib/types'
import { apiGet, formatRupiah, formatShortDate } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { statusBadgeClass } from './overview'

// ==== Bentuk respons API (diverifikasi via curl, lihat worklog) ====
// GET /api/hafalan?studentId=   -> Hafalan & { student: { ..., className } }
// GET /api/attendance?studentId=-> { id, sessionId, studentId, status, note, createdAt, student, className }
//                                 (tanpa date/topic — session dilepas API; tanggal memakai createdAt)
// GET /api/payments?studentId=  -> Payment & { student: { ..., parent } }
type AttendanceRow = {
  id: string
  status: string
  note: string | null
  createdAt: string
  className: string
}

type TabKey = 'hafalan' | 'absensi' | 'tagihan'
const TAB_KEYS: TabKey[] = ['hafalan', 'absensi', 'tagihan']

// ==== Pemetaan warna (konsisten dengan section lain) ====

// Status santri — salinan studentStatusBadge() di students-admin (tidak diekspor di sana).
function studentStatusBadge(status: string): string {
  if (status === 'AKTIF') return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  if (status === 'LULUS') return 'border-violet-200 bg-violet-100 text-violet-800'
  return 'border-stone-200 bg-stone-100 text-stone-600'
}

// Jenis setoran — sama persis dengan typeBadgeClass() hafalan-admin.
const TYPE_BADGE_CLASS: Record<string, string> = {
  TAHFIDZ: 'border-emerald-200 bg-emerald-100 text-emerald-800',
  TAHSHIN: 'border-amber-200 bg-amber-100 text-amber-800',
  MURAJAAH: 'border-teal-200 bg-teal-100 text-teal-800',
}
const TYPE_LABEL: Record<string, string> = {
  TAHFIDZ: 'Tahfidz',
  TAHSHIN: 'Tahshin',
  MURAJAAH: 'Murajaah',
}

// Lingkaran nilai — ambang sama dengan portal wali (child-panel): >=85 emerald, >=70 amber, selainnya merah.
function gradeCircleClass(grade: number | null): string {
  if (grade === null) return 'bg-stone-300 text-stone-600'
  if (grade >= 85) return 'bg-emerald-600 text-white'
  if (grade >= 70) return 'bg-amber-500 text-white'
  return 'bg-red-500 text-white'
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

function genderLabel(gender: string): string {
  return gender === 'P' ? 'Perempuan' : 'Laki-laki'
}

const SCROLLBAR_CLASS =
  '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-200'

export function StudentDetailDrawer({
  student,
  open,
  onOpenChange,
}: {
  student: Student | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [tab, setTab] = useState<TabKey>('hafalan')
  const [hafalans, setHafalans] = useState<Hafalan[] | null>(null)
  const [attendances, setAttendances] = useState<AttendanceRow[] | null>(null)
  const [payments, setPayments] = useState<Payment[] | null>(null)
  const [loading, setLoading] = useState<Record<TabKey, boolean>>({
    hafalan: false,
    absensi: false,
    tagihan: false,
  })
  const [errors, setErrors] = useState<Partial<Record<TabKey, string>>>({})
  // Guard pembatalan: permintaan lama (per tab) tidak boleh menimpa state permintaan baru.
  const genRef = useRef<Record<TabKey, number>>({ hafalan: 0, absensi: 0, tagihan: 0 })

  const fetchTab = useCallback(async (key: TabKey, studentId: string) => {
    const gen = ++genRef.current[key]
    setLoading((s) => ({ ...s, [key]: true }))
    setErrors((e) => ({ ...e, [key]: undefined }))
    const url =
      key === 'hafalan'
        ? `/api/hafalan?studentId=${studentId}`
        : key === 'absensi'
          ? `/api/attendance?studentId=${studentId}`
          : `/api/payments?studentId=${studentId}`
    try {
      const data = await apiGet<Hafalan[] | AttendanceRow[] | Payment[]>(url)
      if (genRef.current[key] !== gen) return // kedaluwarsa — sudah digantikan permintaan lain
      if (key === 'hafalan') setHafalans(data as Hafalan[])
      else if (key === 'absensi') setAttendances(data as AttendanceRow[])
      else setPayments(data as Payment[])
      setLoading((s) => ({ ...s, [key]: false }))
    } catch (err) {
      if (genRef.current[key] !== gen) return
      setErrors((e) => ({ ...e, [key]: err instanceof Error ? err.message : 'Gagal memuat data' }))
      setLoading((s) => ({ ...s, [key]: false }))
    }
  }, [])

  // Hanya mengambil data saat sheet terbuka & ada santri; state di-reset tiap buka/ganti santri.
  const studentId = student?.id ?? null
  useEffect(() => {
    if (!open || !studentId) return
    setTab('hafalan')
    setHafalans(null)
    setAttendances(null)
    setPayments(null)
    setErrors({})
    TAB_KEYS.forEach((k) => {
      genRef.current[k] += 1 // batalkan permintaan in-flight dari santri/sebelumnya
    })
    setLoading({ hafalan: false, absensi: false, tagihan: false })
    TAB_KEYS.forEach((k) => void fetchTab(k, studentId))
  }, [open, studentId, fetchTab])

  const retry = (key: TabKey) => {
    if (!studentId) return
    void fetchTab(key, studentId)
  }

  // ==== Ringkasan per tab ====
  const hafalanSummary = (() => {
    if (!hafalans || hafalans.length === 0) return null
    const graded = hafalans.map((h) => h.grade).filter((g): g is number => typeof g === 'number')
    const avg = graded.length > 0 ? Math.round(graded.reduce((a, b) => a + b, 0) / graded.length) : null
    return { count: hafalans.length, avg }
  })()

  const attendanceSummary = (() => {
    if (!attendances || attendances.length === 0) return null
    const c = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPA: 0 }
    for (const a of attendances) {
      if (a.status === 'HADIR' || a.status === 'IZIN' || a.status === 'SAKIT' || a.status === 'ALPA') c[a.status] += 1
    }
    const rate = attendances.length > 0 ? Math.round((c.HADIR / attendances.length) * 100) : 0
    return { ...c, total: attendances.length, rate }
  })()

  const paymentSummary = (() => {
    if (!payments || payments.length === 0) return null
    const paid = payments.filter((p) => p.status === 'SUCCESS').reduce((s, p) => s + p.amount, 0)
    const outstanding = payments.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0)
    return { paid, outstanding }
  })()

  function renderError(key: TabKey) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertCircle className="size-4" />
        <AlertTitle className="text-sm">Gagal memuat data</AlertTitle>
        <AlertDescription className="text-xs">
          {errors[key] ?? 'Terjadi kesalahan.'}
          <div className="mt-2">
            <Button size="sm" variant="outline" className="h-11" onClick={() => retry(key)}>
              <RefreshCw className="size-4" /> Coba Lagi
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  function renderSkeleton() {
    return (
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    )
  }

  function renderEmpty(message: string) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <Inbox className="size-8 text-stone-300" />
        <p className="text-sm text-stone-500">{message}</p>
      </div>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-stone-100 bg-stone-50/60 p-4 text-left">
          <div className="flex items-start gap-3 pr-6">
            <div
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-700 text-sm font-semibold text-white"
            >
              {student ? initials(student.fullName) : '—'}
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate text-base leading-snug text-stone-800">
                {student?.fullName ?? 'Santri'}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Detail lengkap santri: identitas, riwayat hafalan, absensi, dan tagihan.
              </SheetDescription>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                {student && (
                  <>
                    <Badge variant="outline" className="font-mono text-[10px] border-stone-200 bg-stone-100 text-stone-600">
                      {student.nis}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-emerald-200 bg-emerald-50 text-emerald-800">
                      {student.class?.name ?? 'Tanpa kelas'}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${studentStatusBadge(student.status)}`}>
                      {student.status}
                    </Badge>
                    {student.hafalanTarget && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px] border-amber-200 bg-amber-100 text-amber-800"
                      >
                        <Target className="size-2.5" /> Target: {student.hafalanTarget}
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Identitas */}
          <dl className="mt-3 divide-y divide-stone-100 rounded-xl border border-stone-100 bg-white px-3">
            <div className="flex items-start gap-3 py-2">
              <User className="mt-0.5 size-4 shrink-0 text-stone-400" />
              <div className="min-w-0">
                <dt className="text-[11px] text-stone-400">Jenis Kelamin</dt>
                <dd className="text-sm text-stone-700">{student ? genderLabel(student.gender) : '—'}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2">
              <Cake className="mt-0.5 size-4 shrink-0 text-stone-400" />
              <div className="min-w-0">
                <dt className="text-[11px] text-stone-400">Tanggal Lahir</dt>
                <dd className="text-sm text-stone-700">
                  {student?.birthDate ? formatShortDate(student.birthDate) : '—'}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-stone-400" />
              <div className="min-w-0">
                <dt className="text-[11px] text-stone-400">Alamat</dt>
                <dd className="text-sm text-stone-700">{student?.address ? student.address : '—'}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3 py-2">
              <Phone className="mt-0.5 size-4 shrink-0 text-stone-400" />
              <div className="min-w-0">
                <dt className="text-[11px] text-stone-400">Wali / Orang Tua</dt>
                <dd className="text-sm text-stone-700">
                  {student?.parent?.name ?? '—'}
                  {student?.parent?.phone ? (
                    <span className="block text-xs text-stone-500">{student.parent.phone}</span>
                  ) : null}
                </dd>
              </div>
            </div>
          </dl>

          {/* Catatan gaya WhatsApp (demo — bukan tautan) */}
          {student?.parent?.phone && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl rounded-bl-sm border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <p className="text-xs leading-relaxed text-emerald-900">
                Rapor berkala &amp; info kehadiran <span className="font-medium">{student.fullName}</span> dikirim via
                WhatsApp ke <span className="font-mono">{student.parent.phone}</span>.
              </p>
            </div>
          )}
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-stone-100 px-4 py-3">
            <TabsList className="grid w-full grid-cols-3 rounded-xl bg-stone-100">
              <TabsTrigger value="hafalan" className="h-11 rounded-lg text-xs">
                <BookMarked className="size-3.5" /> Hafalan
              </TabsTrigger>
              <TabsTrigger value="absensi" className="h-11 rounded-lg text-xs">
                <CalendarDays className="size-3.5" /> Absensi
              </TabsTrigger>
              <TabsTrigger value="tagihan" className="h-11 rounded-lg text-xs">
                <Wallet className="size-3.5" /> Tagihan
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ==== Tab Hafalan ==== */}
          <TabsContent
            value="hafalan"
            className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 ${SCROLLBAR_CLASS}`}
          >
            {loading.hafalan && !hafalans ? (
              renderSkeleton()
            ) : errors.hafalan && !hafalans ? (
              renderError('hafalan')
            ) : !hafalans || hafalans.length === 0 ? (
              renderEmpty('Belum ada setoran hafalan.')
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-stone-500">
                  {hafalanSummary?.count} setoran
                  {hafalanSummary?.avg !== null && hafalanSummary?.avg !== undefined
                    ? ` · rata-rata ${hafalanSummary.avg}`
                    : ''}
                </p>
                <ul role="list" className="space-y-2">
                  {hafalans.map((h) => (
                    <li
                      key={h.id}
                      role="listitem"
                      className="rounded-xl border border-stone-100 p-3 transition-colors hover:bg-stone-50"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${gradeCircleClass(h.grade)}`}
                          title={h.grade === null ? 'Belum dinilai' : `Nilai ${h.grade}`}
                        >
                          {h.grade ?? '—'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="text-sm font-medium text-stone-800">QS {h.surahName}</p>
                            <span className="text-xs text-stone-500">ayat {h.ayatRange}</span>
                            <Badge
                              variant="outline"
                              className={`ml-auto text-[10px] ${TYPE_BADGE_CLASS[h.type] ?? 'border-stone-200 bg-stone-100 text-stone-600'}`}
                            >
                              {TYPE_LABEL[h.type] ?? h.type}
                            </Badge>
                          </div>
                          {h.teacherNote && (
                            <p className="mt-1 truncate text-xs italic text-stone-500" title={h.teacherNote}>
                              {h.teacherNote}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-stone-400">{formatShortDate(h.createdAt)}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          {/* ==== Tab Absensi ==== */}
          <TabsContent
            value="absensi"
            className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 ${SCROLLBAR_CLASS}`}
          >
            {loading.absensi && !attendances ? (
              renderSkeleton()
            ) : errors.absensi && !attendances ? (
              renderError('absensi')
            ) : !attendances || attendances.length === 0 ? (
              renderEmpty('Belum ada data absensi.')
            ) : (
              <div className="space-y-3">
                {attendanceSummary && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="gap-1 text-[10px] border-emerald-200 bg-emerald-50 text-emerald-800">
                      <span className="size-1.5 rounded-full bg-emerald-500" /> H {attendanceSummary.HADIR}
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-[10px] border-amber-200 bg-amber-50 text-amber-800">
                      <span className="size-1.5 rounded-full bg-amber-500" /> I {attendanceSummary.IZIN}
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-[10px] border-orange-200 bg-orange-50 text-orange-800">
                      <span className="size-1.5 rounded-full bg-orange-500" /> S {attendanceSummary.SAKIT}
                    </Badge>
                    <Badge variant="outline" className="gap-1 text-[10px] border-red-200 bg-red-50 text-red-700">
                      <span className="size-1.5 rounded-full bg-red-500" /> A {attendanceSummary.ALPA}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`ml-auto text-[10px] ${
                        attendanceSummary.rate >= 85
                          ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                          : attendanceSummary.rate >= 70
                            ? 'border-amber-200 bg-amber-100 text-amber-800'
                            : 'border-red-200 bg-red-100 text-red-700'
                      }`}
                    >
                      {attendanceSummary.rate}% kehadiran
                    </Badge>
                  </div>
                )}
                <ul role="list" className="space-y-2">
                  {attendances.map((a) => (
                    <li
                      key={a.id}
                      role="listitem"
                      className="flex items-start justify-between gap-3 rounded-xl border border-stone-100 p-3 transition-colors hover:bg-stone-50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-700">{formatShortDate(a.createdAt)}</p>
                        <p className="text-xs text-stone-400">{a.className || '—'}</p>
                        {a.note && (
                          <p className="mt-1 truncate text-xs italic text-stone-500" title={a.note}>
                            {a.note}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${statusBadgeClass(a.status)}`}>
                        {a.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          {/* ==== Tab Tagihan ==== */}
          <TabsContent
            value="tagihan"
            className={`min-h-0 flex-1 overflow-y-auto px-4 py-4 ${SCROLLBAR_CLASS}`}
          >
            {loading.tagihan && !payments ? (
              renderSkeleton()
            ) : errors.tagihan && !payments ? (
              renderError('tagihan')
            ) : !payments || payments.length === 0 ? (
              renderEmpty('Belum ada tagihan.')
            ) : (
              <div className="space-y-3">
                {paymentSummary && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                      <p className="text-[11px] text-emerald-700">Total dibayar</p>
                      <p className="text-sm font-semibold text-emerald-800">{formatRupiah(paymentSummary.paid)}</p>
                    </div>
                    <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
                      <p className="text-[11px] text-amber-700">Tunggakan</p>
                      <p className="text-sm font-semibold text-amber-800">{formatRupiah(paymentSummary.outstanding)}</p>
                    </div>
                  </div>
                )}
                <ul role="list" className="space-y-2">
                  {payments.map((p) => (
                    <li
                      key={p.id}
                      role="listitem"
                      className="rounded-xl border border-stone-100 p-3 transition-colors hover:bg-stone-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-xs text-stone-500">{p.invoiceNo}</p>
                        <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(p.status)}`}>
                          {p.status}
                        </Badge>
                      </div>
                      <div className="mt-1 flex items-baseline justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-medium text-stone-800" title={p.title}>
                          {p.title}
                        </p>
                        <p className="shrink-0 text-sm font-semibold text-stone-800">{formatRupiah(p.amount)}</p>
                      </div>
                      <p className="mt-1 text-[11px] text-stone-400">
                        {p.paidAt ? `Dibayar ${formatShortDate(p.paidAt)}` : `Dibuat ${formatShortDate(p.createdAt)}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
