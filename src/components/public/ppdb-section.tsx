'use client'

// PPDB Online — formulir pendaftaran santri baru (POST /api/registrations)
// + cek status pendaftaran via GET /api/registrations/check
//   (butuh nomor pendaftaran + 5 digit terakhir no. HP — anti-enumeration).

import { useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileCheck2,
  FileSearch,
  Loader2,
  MessageCircle,
  Phone,
  Quote,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiSend, formatShortDate } from '@/lib/api-client'
import type { Registration } from '@/lib/types'

const DOC_OPTIONS = ['KTP Orang Tua', 'Kartu Keluarga', 'Akta Kelahiran']

const STATUS_STYLES: Record<Registration['status'], { badge: string; icon: typeof CheckCircle2 }> = {
  PENDING: { badge: 'border-amber-200 bg-amber-50 text-amber-800', icon: CalendarCheck },
  VERIFIKASI: { badge: 'border-teal-200 bg-teal-50 text-teal-800', icon: FileCheck2 },
  DITERIMA: { badge: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: BadgeCheck },
  DITOLAK: { badge: 'border-red-200 bg-red-50 text-red-800', icon: XCircle },
}

const STATUS_LABELS: Record<Registration['status'], string> = {
  PENDING: 'Menunggu Verifikasi',
  VERIFIKASI: 'Sedang Diverifikasi',
  DITERIMA: 'Diterima',
  DITOLAK: 'Ditolak',
}

const NEXT_STEPS = [
  'Konfirmasi pendaftaran dikirim otomatis melalui WhatsApp ke nomor orang tua.',
  'Simpan nomor pendaftaran untuk memantau status melalui panel "Cek Status".',
  'Bawa dokumen asli saat sesi verifikasi di sekretariat TPQ Darul Jinan.',
  'Hasil seleksi diumumkan melalui WhatsApp — santri diterima langsung mendapat NIS & akun wali.',
]

type FormState = {
  childName: string
  gender: 'L' | 'P'
  birthDate: string
  parentName: string
  phone: string
  email: string
  address: string
  note: string
}

type FieldError = Partial<Record<'childName' | 'birthDate' | 'parentName' | 'phone' | 'email' | 'address', string>>

// Respons aman dari GET /api/registrations/check (tanpa data sensitif)
type CheckResult = {
  regNumber: string
  childName: string
  parentName: string
  status: string
  reviewNote: string | null
  createdAt: string
  updatedAt: string
}

const CHECK_STEPS = ['Diajukan', 'Verifikasi', 'Keputusan'] as const

const EMPTY_FORM: FormState = {
  childName: '',
  gender: 'L',
  birthDate: '',
  parentName: '',
  phone: '',
  email: '',
  address: '',
  note: '',
}

function validate(form: FormState): FieldError {
  const errors: FieldError = {}
  if (!form.childName.trim()) errors.childName = 'Nama lengkap anak wajib diisi.'
  else if (form.childName.trim().length < 3) errors.childName = 'Nama minimal 3 karakter.'
  if (!form.birthDate) errors.birthDate = 'Tanggal lahir wajib diisi.'
  if (!form.parentName.trim()) errors.parentName = 'Nama orang tua/wali wajib diisi.'
  if (!form.phone.trim()) errors.phone = 'Nomor WhatsApp wajib diisi.'
  else if (!/^[0-9+\-\s]{9,16}$/.test(form.phone.trim())) errors.phone = 'Nomor WhatsApp tidak valid (9–16 digit).'
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Format email tidak valid.'
  if (!form.address.trim()) errors.address = 'Alamat domisili wajib diisi.'
  return errors
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="flex items-center gap-1 text-xs text-red-600" role="alert">
      <AlertCircle className="size-3 shrink-0" />
      {message}
    </p>
  )
}

export function PpdbSection() {
  const { toast } = useToast()

  // ==== Formulir pendaftaran ====
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [documents, setDocuments] = useState<string[]>([])
  const [errors, setErrors] = useState<FieldError>({})
  const [submitting, setSubmitting] = useState(false)
  const [successReg, setSuccessReg] = useState<Registration | null>(null)

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key as keyof FieldError]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }))
    }
  }

  const toggleDocument = (doc: string, checked: boolean) => {
    setDocuments((prev) => (checked ? [...prev, doc] : prev.filter((d) => d !== doc)))
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const validation = validate(form)
    if (Object.keys(validation).length > 0) {
      setErrors(validation)
      toast({
        title: 'Formulir Belum Lengkap',
        description: 'Mohon periksa kembali isian yang ditandai merah.',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const reg = await apiSend<Registration>('/api/registrations', 'POST', {
        childName: form.childName.trim(),
        gender: form.gender,
        birthDate: form.birthDate,
        parentName: form.parentName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        address: form.address.trim(),
        documents,
        note: form.note.trim() || null,
      })
      setSuccessReg(reg)
      setForm(EMPTY_FORM)
      setDocuments([])
      setErrors({})
      toast({
        title: 'Pendaftaran Berhasil',
        description: `Nomor pendaftaran ${reg?.regNumber ?? 'telah dibuat'}. Cek WhatsApp Anda.`,
      })
    } catch (err) {
      toast({
        title: 'Pendaftaran Gagal',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan, silakan coba lagi.',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const copyRegNumber = async () => {
    if (!successReg?.regNumber) return
    try {
      await navigator.clipboard.writeText(successReg.regNumber)
      toast({ title: 'Tersalin', description: 'Nomor pendaftaran disalin ke papan klip.' })
    } catch {
      toast({ title: 'Gagal menyalin', description: 'Silakan salin nomor secara manual.' })
    }
  }

  // ==== Cek status (GET /api/registrations/check — butuh nomor pendaftaran + no. HP) ====
  const [checkOpen, setCheckOpen] = useState(false)
  const [checkNumber, setCheckNumber] = useState('')
  const [checkPhone, setCheckPhone] = useState('')
  const [checkLoading, setCheckLoading] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)

  const handleCheckStatus = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!checkNumber.trim() || !checkPhone.trim()) {
      setCheckResult(null)
      setCheckError('Nomor pendaftaran dan nomor HP wajib diisi.')
      return
    }
    setCheckLoading(true)
    setCheckError(null)
    try {
      const params = new URLSearchParams({ regNumber: checkNumber.trim(), phone: checkPhone.trim() })
      const data = await apiGet<CheckResult>(`/api/registrations/check?${params.toString()}`)
      setCheckResult(data)
    } catch (err) {
      setCheckResult(null)
      setCheckError(err instanceof Error ? err.message : 'Terjadi kesalahan, silakan coba lagi.')
    } finally {
      setCheckLoading(false)
    }
  }

  const resetCheck = () => {
    setCheckNumber('')
    setCheckPhone('')
    setCheckResult(null)
    setCheckError(null)
  }

  const resultMeta = checkResult
    ? STATUS_STYLES[checkResult.status as Registration['status']] ?? STATUS_STYLES.PENDING
    : null
  // Timeline mini hanya untuk PENDING (0) / VERIFIKASI (1); DITERIMA & DITOLAK di luar timeline
  const checkStepIndex = checkResult ? (checkResult.status === 'PENDING' ? 0 : checkResult.status === 'VERIFIKASI' ? 1 : -1) : -1

  return (
    <section id="ppdb" className="scroll-mt-20 bg-stone-50 py-16">
      <div className="mx-auto max-w-6xl px-4">
        {/* Heading + affordance cek status */}
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <span className="mb-3 inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-700">
            PPDB Online
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-stone-800">Pendaftaran Santri Baru</h2>
          <p className="mt-3 text-muted-foreground">
            Tahun Ajaran 2025/2026 telah dibuka. Isi formulir daring berikut — tanpa perlu datang
            langsung, konfirmasi dikirim lewat WhatsApp.
          </p>
          <div className="mt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCheckOpen((v) => !v)}
              aria-expanded={checkOpen}
              aria-controls="ppdb-status-check"
              className="min-h-11 gap-2 rounded-full border-emerald-300 bg-white px-5 text-sm font-semibold text-emerald-700 shadow-xs transition-colors hover:bg-emerald-50 hover:text-emerald-800"
            >
              <FileSearch className="size-4" />
              Sudah mendaftar? Cek Status
            </Button>
          </div>
        </div>

        {/* ================= PANEL CEK STATUS (collapsible) ================= */}
        {checkOpen && (
          <div
            id="ppdb-status-check"
            className="mx-auto mb-12 max-w-3xl rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm md:p-8"
          >
            <h3 className="flex items-center gap-2 text-base font-bold text-stone-800">
              <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <FileSearch className="size-4.5" />
              </span>
              Cek Status Pendaftaran
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              Lacak proses pendaftaran tanpa perlu masuk akun. Status diperbarui oleh sekretariat
              setiap tahap seleksi.
            </p>

            <form onSubmit={handleCheckStatus} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ppdb-check-number">Nomor Pendaftaran</Label>
                <Input
                  id="ppdb-check-number"
                  placeholder="PPDB-2025-0001"
                  autoComplete="off"
                  className="font-mono uppercase"
                  value={checkNumber}
                  onChange={(e) => {
                    setCheckNumber(e.target.value)
                    if (checkError) setCheckError(null)
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ppdb-check-phone">No. HP</Label>
                <Input
                  id="ppdb-check-phone"
                  type="tel"
                  inputMode="tel"
                  maxLength={20}
                  autoComplete="off"
                  placeholder="5 digit terakhir nomor HP"
                  value={checkPhone}
                  onChange={(e) => {
                    setCheckPhone(e.target.value)
                    if (checkError) setCheckError(null)
                  }}
                />
              </div>
              <Button
                type="submit"
                disabled={checkLoading}
                className="min-h-11 bg-emerald-700 font-semibold shadow-md hover:bg-emerald-800 sm:col-span-2"
              >
                {checkLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Memeriksa Status…
                  </>
                ) : (
                  <>
                    <Search className="size-4" />
                    Periksa Status
                  </>
                )}
              </Button>
            </form>

            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-stone-500">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
              Masukkan nomor pendaftaran dan 5 digit terakhir nomor HP yang digunakan saat mendaftar.
            </p>

            {/* Hasil pemeriksaan — diumumkan ke pembaca layar */}
            <div aria-live="polite">
              {checkError && (
                <p
                  role="alert"
                  className="mt-4 flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {checkError}
                </p>
              )}

              {checkResult && resultMeta && (
                <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-stone-500">Calon Santri</p>
                      <p className="text-sm font-bold text-stone-800">An. {checkResult.childName}</p>
                      <p className="mt-0.5 text-xs text-stone-500">Wali: {checkResult.parentName}</p>
                    </div>
                    <Badge variant="outline" className={resultMeta.badge}>
                      <resultMeta.icon className="size-3" />
                      {STATUS_LABELS[checkResult.status as Registration['status']] ?? checkResult.status}
                    </Badge>
                  </div>

                  <Separator className="my-3 bg-emerald-100" />

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Nomor</p>
                      <p className="font-mono text-sm font-bold text-emerald-900">{checkResult.regNumber}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Diajukan</p>
                      <p className="text-xs font-medium text-stone-600">{formatShortDate(checkResult.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Diperbarui</p>
                      <p className="text-xs font-medium text-stone-600">{formatShortDate(checkResult.updatedAt)}</p>
                    </div>
                  </div>

                  {/* Catatan pengurus (ditolak = merah menonjol, lainnya kutipan amber) */}
                  {checkResult.status === 'DITOLAK' && checkResult.reviewNote && (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5">
                      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-700">
                        <ShieldAlert className="size-3.5 shrink-0" />
                        Pendaftaran Belum Dapat Kami Terima
                      </p>
                      <blockquote className="mt-1.5 flex items-start gap-1.5 text-sm italic leading-relaxed text-red-800">
                        <Quote className="mt-0.5 size-3.5 shrink-0" />
                        “{checkResult.reviewNote}”
                      </blockquote>
                    </div>
                  )}
                  {checkResult.status !== 'DITOLAK' && checkResult.reviewNote && (
                    <figure className="mt-4 rounded-lg border-l-4 border-amber-400 bg-amber-50 p-3">
                      <figcaption className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
                        <Quote className="size-3" />
                        Catatan Pengurus
                      </figcaption>
                      <blockquote className="mt-1 text-xs italic leading-relaxed text-amber-900">
                        “{checkResult.reviewNote}”
                      </blockquote>
                    </figure>
                  )}

                  {/* Diterima — ajakan langkah berikutnya */}
                  {checkResult.status === 'DITERIMA' && (
                    <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-emerald-100/80 p-2.5 text-xs font-medium leading-relaxed text-emerald-800">
                      <MessageCircle className="mt-0.5 size-3.5 shrink-0" />
                      Alhamdulillah! Silakan menunggu informasi kelas dan akun Portal Wali via WhatsApp.
                    </p>
                  )}

                  {/* Menunggu / diverifikasi — timeline 3 tahap */}
                  {checkStepIndex >= 0 && (
                    <ol className="mt-4 flex items-center" aria-label="Tahapan pendaftaran">
                      {CHECK_STEPS.map((label, i) => {
                        const done = i < checkStepIndex
                        const current = i === checkStepIndex
                        return (
                          <li key={label} className="flex flex-1 items-center last:flex-none">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`flex size-4 items-center justify-center rounded-full ${
                                  done
                                    ? 'bg-emerald-600 text-white'
                                    : current
                                      ? 'bg-emerald-600 ring-4 ring-emerald-200/70'
                                      : 'border-2 border-stone-300 bg-white'
                                }`}
                              >
                                {done && <Check className="size-2.5" strokeWidth={3.5} />}
                              </span>
                              <span
                                className={`text-[10px] font-medium ${
                                  done || current ? 'text-emerald-800' : 'text-stone-400'
                                }`}
                              >
                                {label}
                              </span>
                            </div>
                            {i < CHECK_STEPS.length - 1 && (
                              <span
                                aria-hidden="true"
                                className={`mx-1 -mt-2 h-0.5 flex-1 ${i < checkStepIndex ? 'bg-emerald-500' : 'bg-stone-200'}`}
                              />
                            )}
                          </li>
                        )
                      })}
                    </ol>
                  )}

                  <div className="mt-4 flex justify-end border-t border-emerald-100 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetCheck}
                      className="h-11 gap-1.5 border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                    >
                      <RotateCcw className="size-3.5" />
                      Periksa Lagi
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-5">
          {/* ================= FORMULIR ================= */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm md:p-8 lg:col-span-3"
          >
            <h3 className="flex items-center gap-2 text-lg font-bold text-stone-800">
              <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <ClipboardList className="size-4.5" />
              </span>
              Formulir Pendaftaran
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              Kolom bertanda <span className="text-red-600">*</span> wajib diisi.
            </p>

            <Separator className="my-6" />

            {/* Data anak */}
            <h4 className="mb-4 text-xs font-bold uppercase tracking-widest text-emerald-800">Data Calon Santri</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ppdb-childName">
                  Nama Lengkap Anak <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="ppdb-childName"
                  placeholder="cth. Muhammad Alfatih"
                  value={form.childName}
                  onChange={(e) => setField('childName', e.target.value)}
                  aria-invalid={!!errors.childName}
                />
                <ErrorText message={errors.childName} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ppdb-gender">Jenis Kelamin</Label>
                <Select value={form.gender} onValueChange={(v) => setField('gender', v === 'P' ? 'P' : 'L')}>
                  <SelectTrigger id="ppdb-gender" className="w-full">
                    <SelectValue placeholder="Pilih jenis kelamin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ppdb-birthDate">
                  Tanggal Lahir <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="ppdb-birthDate"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.birthDate}
                  onChange={(e) => setField('birthDate', e.target.value)}
                  aria-invalid={!!errors.birthDate}
                />
                <ErrorText message={errors.birthDate} />
              </div>
            </div>

            {/* Data orang tua */}
            <h4 className="mb-4 mt-8 text-xs font-bold uppercase tracking-widest text-emerald-800">Data Orang Tua / Wali</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ppdb-parentName">
                  Nama Orang Tua / Wali <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="ppdb-parentName"
                  placeholder="cth. Budi Santoso"
                  value={form.parentName}
                  onChange={(e) => setField('parentName', e.target.value)}
                  aria-invalid={!!errors.parentName}
                />
                <ErrorText message={errors.parentName} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ppdb-phone">
                  Nomor WhatsApp <span className="text-red-600">*</span>
                </Label>
                <Input
                  id="ppdb-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="cth. 0812-3456-7890"
                  value={form.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  aria-invalid={!!errors.phone}
                />
                <ErrorText message={errors.phone} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ppdb-email">
                  Email <span className="text-stone-400">(opsional)</span>
                </Label>
                <Input
                  id="ppdb-email"
                  type="email"
                  placeholder="cth. ortu@email.com"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  aria-invalid={!!errors.email}
                />
                <ErrorText message={errors.email} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="ppdb-address">
                  Alamat Domisili <span className="text-red-600">*</span>
                </Label>
                <Textarea
                  id="ppdb-address"
                  rows={2}
                  placeholder="cth. Jl. Merpati Raya No. 25, Cibubur, Jakarta Timur"
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  aria-invalid={!!errors.address}
                />
                <ErrorText message={errors.address} />
              </div>
            </div>

            {/* Dokumen */}
            <h4 className="mb-3 mt-8 text-xs font-bold uppercase tracking-widest text-emerald-800">
              Kelengkapan Dokumen
            </h4>
            <div className="grid gap-2 rounded-2xl border border-stone-200 bg-stone-50/60 p-4 sm:grid-cols-3">
              {DOC_OPTIONS.map((doc) => (
                <label
                  key={doc}
                  className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-transparent bg-white p-3 text-sm shadow-xs transition-colors hover:border-emerald-200"
                >
                  <Checkbox
                    checked={documents.includes(doc)}
                    onCheckedChange={(checked) => toggleDocument(doc, checked === true)}
                    aria-label={`Saya memiliki ${doc}`}
                  />
                  <span className="text-stone-700">{doc}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-stone-400">
              Centang dokumen yang sudah tersedia. Dokumen asli dibawa saat verifikasi di sekretariat.
            </p>

            {/* Catatan */}
            <div className="mt-6 space-y-1.5">
              <Label htmlFor="ppdb-note">
                Catatan Tambahan <span className="text-stone-400">(opsional)</span>
              </Label>
              <Textarea
                id="ppdb-note"
                rows={2}
                placeholder="cth. Anak sudah bisa Iqra jilid 2, mohon ditempatkan di kelas Iqra 3."
                value={form.note}
                onChange={(e) => setField('note', e.target.value)}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="mt-6 w-full bg-emerald-700 font-semibold shadow-md hover:bg-emerald-800"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Mengirim Pendaftaran…
                </>
              ) : (
                <>
                  Kirim Pendaftaran
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          {/* ================= KOLOM KANAN ================= */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            {/* Cek status kini berupa panel collapsible di bawah judul seksi (aman via /api/registrations/check) */}

            {/* Bantuan */}
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-base font-bold text-stone-800">
                <span className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <MessageCircle className="size-4.5" />
                </span>
                Butuh Bantuan?
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-stone-600">
                Sekretariat PPDB siap membantu proses pendaftaran Anda pada jam operasional
                (Senin–Sabtu, 15.00–18.00 WIB).
              </p>
              <a
                href="tel:081234567890"
                className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <Phone className="size-4 text-emerald-600" />
                0812-3456-7890 (Sekretariat)
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ================= DIALOG SUKSES ================= */}
      <Dialog open={!!successReg} onOpenChange={(open) => !open && setSuccessReg(null)}>
        <DialogContent className="sm:max-w-md">
          {successReg && (
            <>
              <DialogHeader className="items-center text-center">
                <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="size-7" />
                </span>
                <DialogTitle className="mt-2 text-xl text-emerald-950">Alhamdulillah, Pendaftaran Terkirim!</DialogTitle>
                <DialogDescription className="text-center">
                  Data calon santri atas nama <strong>{successReg.childName}</strong> telah kami terima.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/70 p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Nomor Pendaftaran</p>
                <p className="mt-1 font-mono text-2xl font-extrabold tracking-wider text-emerald-900 md:text-3xl">
                  {successReg.regNumber}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-3 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                  onClick={() => void copyRegNumber()}
                >
                  <Copy className="size-3.5" />
                  Salin Nomor
                </Button>
              </div>

              <ol className="space-y-2.5">
                {NEXT_STEPS.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-stone-600">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>

              <p className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                <MessageCircle className="size-4 shrink-0" />
                Konfirmasi WhatsApp telah dikirim ke {successReg.phone}.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
