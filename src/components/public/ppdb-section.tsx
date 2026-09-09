'use client'

// PPDB Online — formulir pendaftaran santri baru (POST /api/registrations)
// + widget cek status pendaftaran berdasarkan nomor registrasi.

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
  Loader2,
  MessageCircle,
  Phone,
  SearchCheck,
  ShieldAlert,
  UserRound,
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

  // ==== Cek status ====
  const [searchNumber, setSearchNumber] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [found, setFound] = useState<Registration | null>(null)

  const handleCheckStatus = async () => {
    const q = searchNumber.trim()
    if (!q) {
      toast({
        title: 'Nomor Kosong',
        description: 'Masukkan nomor pendaftaran terlebih dahulu, contoh: PPDB-2025-0001.',
        variant: 'destructive',
      })
      return
    }
    setSearching(true)
    try {
      const regs = await apiGet<Registration[]>('/api/registrations')
      const match = (Array.isArray(regs) ? regs : []).find(
        (r) => r?.regNumber?.toLowerCase() === q.toLowerCase(),
      )
      setFound(match ?? null)
      setSearched(true)
      if (!match) {
        toast({
          title: 'Tidak Ditemukan',
          description: `Nomor "${q}" tidak terdaftar. Periksa kembali penulisannya.`,
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Gagal Mengecek Status',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan, silakan coba lagi.',
        variant: 'destructive',
      })
    } finally {
      setSearching(false)
    }
  }

  const statusMeta = found ? STATUS_STYLES[found.status] ?? STATUS_STYLES.PENDING : null
  const stepIndex = found ? (found.status === 'PENDING' ? 0 : found.status === 'VERIFIKASI' ? 1 : 2) : -1

  return (
    <section id="ppdb" className="scroll-mt-20 bg-stone-50 py-16">
      <div className="mx-auto max-w-6xl px-4">
        {/* Heading */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="mb-3 inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-700">
            PPDB Online
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-stone-800">Pendaftaran Santri Baru</h2>
          <p className="mt-3 text-muted-foreground">
            Tahun Ajaran 2025/2026 telah dibuka. Isi formulir daring berikut — tanpa perlu datang
            langsung, konfirmasi dikirim lewat WhatsApp.
          </p>
        </div>

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
            {/* Cek status pendaftaran */}
            <div className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-base font-bold text-stone-800">
                <span className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <SearchCheck className="size-4.5" />
                </span>
                Cek Status Pendaftaran
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-stone-500">
                Masukkan nomor pendaftaran yang Anda terima setelah mengirim formulir.
              </p>
              <div className="mt-4 flex gap-2">
                <Input
                  value={searchNumber}
                  onChange={(e) => setSearchNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleCheckStatus()
                    }
                  }}
                  placeholder="PPDB-2025-0001"
                  className="font-mono uppercase"
                  aria-label="Nomor pendaftaran"
                />
                <Button
                  type="button"
                  className="shrink-0 bg-emerald-700 hover:bg-emerald-800"
                  disabled={searching}
                  onClick={() => void handleCheckStatus()}
                >
                  {searching ? <Loader2 className="size-4 animate-spin" /> : 'Cek'}
                </Button>
              </div>

              {searched && found && statusMeta && (
                <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-stone-500">Nomor</p>
                      <p className="font-mono text-sm font-bold text-emerald-900">{found.regNumber}</p>
                    </div>
                    <Badge variant="outline" className={statusMeta.badge}>
                      <statusMeta.icon className="size-3" />
                      {STATUS_LABELS[found.status] ?? found.status}
                    </Badge>
                  </div>
                  <Separator className="my-3 bg-emerald-100" />
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-stone-700">
                    <UserRound className="size-3.5 text-emerald-700" />
                    {found.childName}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    Mendaftar pada {formatShortDate(found.createdAt)} • Wali: {found.parentName}
                  </p>

                  {/* Timeline status */}
                  <div className="mt-4 flex items-center">
                    {['Formulir', 'Verifikasi', 'Keputusan'].map((label, i) => {
                      const done = i < stepIndex
                      const active = i === stepIndex
                      const rejected = found.status === 'DITOLAK' && i === 2
                      return (
                        <div key={label} className="flex flex-1 items-center last:flex-none">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={`flex size-7 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                                rejected
                                  ? 'border-red-500 bg-red-500 text-white'
                                  : done || active
                                    ? 'border-emerald-600 bg-emerald-600 text-white'
                                    : 'border-stone-200 bg-white text-stone-400'
                              }`}
                            >
                              {rejected ? <XCircle className="size-3.5" /> : done || active ? <Check className="size-3.5" /> : i + 1}
                            </span>
                            <span className={`text-[10px] font-medium ${done || active || rejected ? 'text-emerald-800' : 'text-stone-400'}`}>
                              {label}
                            </span>
                          </div>
                          {i < 2 && (
                            <span className={`mx-1 -mt-4 h-0.5 flex-1 ${i < stepIndex ? 'bg-emerald-500' : 'bg-stone-200'}`} aria-hidden="true" />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {found.status === 'DITOLAK' && found.reviewNote && (
                    <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                      <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
                      {found.reviewNote}
                    </p>
                  )}
                  {found.status === 'PENDING' && (
                    <p className="mt-3 text-xs italic text-stone-500">
                      Pendaftaran Anda masuk antrean verifikasi administrasi. Tim kami menghubungi
                      maksimal 2×24 jam kerja.
                    </p>
                  )}
                </div>
              )}

              {searched && !found && (
                <div className="mt-5 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 text-center text-sm text-stone-500">
                  Nomor pendaftaran tidak ditemukan. Pastikan penulisan sesuai pesan WhatsApp
                  konfirmasi (cth. <span className="font-mono">PPDB-2025-0001</span>).
                </div>
              )}
            </div>

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
