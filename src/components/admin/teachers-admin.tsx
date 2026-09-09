'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  GraduationCap,
  RefreshCw,
  AlertCircle,
  Inbox,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Phone,
  BookOpen,
  MapPin,
  Quote,
  X,
} from 'lucide-react'
import type { Teacher } from '@/lib/types'
import { apiGet, apiSend, formatDate } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface EduRow {
  level: string
  institution: string
  year: string
}

interface TeacherFormState {
  fullName: string
  gender: string
  birthPlace: string
  birthDate: string
  address: string
  phone: string
  expertise: string
  philosophy: string
  bio: string
  formalEducation: EduRow[]
  nonFormalEducation: EduRow[]
  certifications: EduRow[]
  email: string
  password: string
}

const EMPTY_EDU: EduRow[] = [{ level: '', institution: '', year: '' }]

const EMPTY_FORM: TeacherFormState = {
  fullName: '',
  gender: 'L',
  birthPlace: '',
  birthDate: '',
  address: '',
  phone: '',
  expertise: '',
  philosophy: '',
  bio: '',
  formalEducation: EMPTY_EDU,
  nonFormalEducation: EMPTY_EDU,
  certifications: EMPTY_EDU,
  email: '',
  password: '',
}

function parseEdu(json: string | null | undefined): EduRow[] {
  try {
    const parsed: unknown = JSON.parse(json || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map((row) => {
      const r = (row ?? {}) as Record<string, unknown>
      return { level: String(r.level ?? ''), institution: String(r.institution ?? ''), year: String(r.year ?? '') }
    })
  } catch {
    return []
  }
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function EduListEditor({
  title,
  hint,
  rows,
  onChange,
}: {
  title: string
  hint: string
  rows: EduRow[]
  onChange: (rows: EduRow[]) => void
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-3">
      <div className="mb-2">
        <p className="text-sm font-semibold text-stone-700">{title}</p>
        <p className="text-xs text-stone-500">{hint}</p>
      </div>
      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={row.level}
              onChange={(e) => onChange(rows.map((r, i) => (i === idx ? { ...r, level: e.target.value } : r)))}
              placeholder="Jenjang (mis. S1)"
              className="h-9 flex-1 rounded-lg bg-white"
            />
            <Input
              value={row.institution}
              onChange={(e) => onChange(rows.map((r, i) => (i === idx ? { ...r, institution: e.target.value } : r)))}
              placeholder="Institusi"
              className="h-9 flex-[1.6] rounded-lg bg-white"
            />
            <Input
              value={row.year}
              onChange={(e) => onChange(rows.map((r, i) => (i === idx ? { ...r, year: e.target.value } : r)))}
              placeholder="Tahun"
              className="h-9 w-20 rounded-lg bg-white"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-stone-400 hover:text-red-600"
              onClick={() => onChange(rows.length === 1 ? EMPTY_EDU : rows.filter((_, i) => i !== idx))}
              aria-label="Hapus baris"
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
        onClick={() => onChange([...rows, { level: '', institution: '', year: '' }])}
      >
        <Plus className="size-3.5" /> Tambah Baris
      </Button>
    </div>
  )
}

export function TeachersAdmin() {
  const { toast } = useToast()
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Teacher | null>(null)
  const [form, setForm] = useState<TeacherFormState>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setTeachers(await apiGet<Teacher[]>('/api/teachers'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data guru')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(t: Teacher) {
    setEditing(t)
    setForm({
      fullName: t.fullName,
      gender: t.gender,
      birthPlace: t.birthPlace,
      birthDate: t.birthDate ? t.birthDate.slice(0, 10) : '',
      address: t.address,
      phone: t.phone ?? '',
      expertise: t.expertise,
      philosophy: t.philosophy ?? '',
      bio: t.bio,
      formalEducation: parseEdu(t.formalEducation).length ? parseEdu(t.formalEducation) : EMPTY_EDU,
      nonFormalEducation: parseEdu(t.nonFormalEducation).length ? parseEdu(t.nonFormalEducation) : EMPTY_EDU,
      certifications: parseEdu(t.certifications).length ? parseEdu(t.certifications) : EMPTY_EDU,
      email: '',
      password: '',
    })
    setFormOpen(true)
  }

  async function submitForm() {
    if (!form.fullName.trim()) {
      toast({ title: 'Nama wajib diisi', description: 'Nama lengkap guru tidak boleh kosong.' })
      return
    }
    setIsPending(true)
    const cleanRows = (rows: EduRow[]) => rows.filter((r) => r.level.trim() || r.institution.trim())
    const payload: Record<string, unknown> = {
      fullName: form.fullName.trim(),
      gender: form.gender,
      birthPlace: form.birthPlace.trim() || undefined,
      birthDate: form.birthDate || undefined,
      address: form.address.trim() || undefined,
      phone: form.phone.trim() || null,
      expertise: form.expertise.trim() || undefined,
      philosophy: form.philosophy.trim() || null,
      bio: form.bio.trim() || undefined,
      formalEducation: JSON.stringify(cleanRows(form.formalEducation)),
      nonFormalEducation: JSON.stringify(cleanRows(form.nonFormalEducation)),
      certifications: JSON.stringify(cleanRows(form.certifications)),
    }
    try {
      if (editing) {
        await apiSend('/api/teachers', 'PUT', { id: editing.id, ...payload })
        toast({ title: 'Data guru diperbarui', description: `Biodata ${form.fullName} telah disimpan.` })
      } else {
        if (form.email.trim() && form.password.trim()) {
          payload.email = form.email.trim()
          payload.password = form.password
        }
        await apiSend('/api/teachers', 'POST', payload)
        toast({ title: 'Guru ditambahkan', description: `${form.fullName} berhasil ditambahkan${form.email.trim() ? ' beserta akun loginnya' : ''}.` })
      }
      setFormOpen(false)
      await load()
    } catch (e) {
      toast({ title: editing ? 'Gagal memperbarui' : 'Gagal menambahkan', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  async function toggleActive(t: Teacher, isActive: boolean) {
    setBusyId(t.id)
    try {
      await apiSend('/api/teachers', 'PUT', { id: t.id, isActive })
      toast({ title: isActive ? 'Guru diaktifkan' : 'Guru dinonaktifkan', description: `${t.fullName} ${isActive ? 'kini aktif mengajar.' : 'dinonaktifkan sementara.'}` })
      await load()
    } catch (e) {
      toast({ title: 'Gagal mengubah status', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setBusyId(null)
    }
  }

  async function submitDelete() {
    if (!deleteTarget) return
    setIsPending(true)
    try {
      await apiSend(`/api/teachers?id=${deleteTarget.id}`, 'DELETE')
      toast({ title: 'Guru dihapus', description: `Data ${deleteTarget.fullName} telah dihapus.` })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast({ title: 'Gagal menghapus guru', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
      setDeleteTarget(null)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-500">
          {teachers.length} guru terdaftar · nonaktifkan lewat saklar keaktifan
        </p>
        <div className="flex items-center gap-2">
          <Button onClick={openCreate} className="bg-emerald-700 hover:bg-emerald-800">
            <Plus className="size-4" /> Tambah Guru
          </Button>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Muat ulang">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="size-4" />
          <AlertTitle>Gagal memuat data guru</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => void load()}>
                <RefreshCw className="size-4" /> Coba Lagi
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : teachers.length === 0 ? (
        <Card className="rounded-2xl border-stone-200 shadow-sm">
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <Inbox className="size-9 text-stone-300" />
            <p className="font-medium text-stone-600">Belum ada data guru</p>
            <p className="text-sm text-stone-400">Tambahkan ustadz/ustadzah pengampu TPQ.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teachers.map((t) => (
            <Card key={t.id} className={cn('rounded-2xl border-stone-200 shadow-sm', !t.isActive && 'opacity-70')}>
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-800">
                    {initials(t.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-stone-900">{t.fullName}</p>
                    <p className="text-xs text-stone-500">{t.gender === 'P' ? 'Ustadzah' : 'Ustadz'} · Bergabung {formatDate(t.joinDate)}</p>
                  </div>
                  <Switch
                    checked={t.isActive}
                    disabled={busyId === t.id}
                    onCheckedChange={(v) => void toggleActive(t, v)}
                    aria-label="Keaktifan guru"
                  />
                </div>

                <Badge variant="outline" className="w-fit border-amber-200 bg-amber-50 text-[11px] text-amber-800">
                  {t.expertise || 'Umum'}
                </Badge>

                <div className="space-y-1.5 text-xs text-stone-600">
                  <p className="flex items-center gap-1.5">
                    <Phone className="size-3.5 shrink-0 text-emerald-700" />
                    {t.phone || '—'}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0 text-emerald-700" />
                    <span className="truncate">{t.address || '—'}</span>
                  </p>
                  <p className="flex items-start gap-1.5">
                    <BookOpen className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />
                    <span className="min-w-0 flex-1">
                      {t.classes && t.classes.length > 0 ? (
                        <span className="flex flex-wrap gap-1">
                          {t.classes.map((c) => (
                            <Badge key={c.id} variant="outline" className="border-stone-200 text-[10px] font-normal">
                              {c.name}
                            </Badge>
                          ))}
                        </span>
                      ) : (
                        'Belum mengampu kelas'
                      )}
                    </span>
                  </p>
                  {t.philosophy && (
                    <p className="flex items-start gap-1.5 italic text-stone-500">
                      <Quote className="mt-0.5 size-3.5 shrink-0" />
                      <span className="line-clamp-2">{t.philosophy}</span>
                    </p>
                  )}
                </div>

                <Separator className="mt-auto" />
                <div className="flex items-center justify-between">
                  <Badge variant={t.isActive ? 'default' : 'secondary'} className={t.isActive ? 'border-emerald-200 bg-emerald-100 text-emerald-800' : ''}>
                    {t.isActive ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => openEdit(t)}>
                      <Pencil className="size-3.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => setDeleteTarget(t)}
                      aria-label="Hapus guru"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Tambah/Edit Guru */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Biodata Guru' : 'Tambah Guru Baru'}</DialogTitle>
            <DialogDescription>
              {editing ? `Perbarui biodata profesional ${editing.fullName}.` : 'Lengkapi biodata ustadz/ustadzah bergaya Kemenag.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="t-name">Nama Lengkap *</Label>
                <Input id="t-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Contoh: Ustadzah Fatimah Az-Zahra" />
              </div>
              <div className="grid gap-1.5">
                <Label>Jenis Kelamin</Label>
                <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">Laki-laki</SelectItem>
                    <SelectItem value="P">Perempuan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="t-birthplace">Tempat Lahir</Label>
                <Input id="t-birthplace" value={form.birthPlace} onChange={(e) => setForm({ ...form, birthPlace: e.target.value })} placeholder="Kota kelahiran" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="t-birthdate">Tanggal Lahir</Label>
                <Input id="t-birthdate" type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="t-phone">No. WhatsApp</Label>
                <Input id="t-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08xxxxxxxxxx" />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="t-address">Alamat</Label>
              <Textarea id="t-address" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Alamat tempat tinggal" />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="t-expertise">Bidang Keahlian</Label>
              <Input id="t-expertise" value={form.expertise} onChange={(e) => setForm({ ...form, expertise: e.target.value })} placeholder="Contoh: Tahfidz & Tajwid" />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="t-philosophy">Filosofi Mengajar</Label>
              <Textarea id="t-philosophy" rows={2} value={form.philosophy} onChange={(e) => setForm({ ...form, philosophy: e.target.value })} placeholder="Prinsip atau motivasi dalam mendidik santri" />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="t-bio">Biografi Singkat</Label>
              <Textarea id="t-bio" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Riwayat singkat pengajaran dan pengalaman" />
            </div>

            <EduListEditor title="Pendidikan Formal" hint="Riwayat pendidikan formal (SD/S1/S2 dst.)" rows={form.formalEducation} onChange={(rows) => setForm({ ...form, formalEducation: rows })} />
            <EduListEditor title="Pendidikan Non-Formal" hint="Pelatihan, pesantren kilat, majelis taklim dst." rows={form.nonFormalEducation} onChange={(rows) => setForm({ ...form, nonFormalEducation: rows })} />
            <EduListEditor title="Sertifikasi" hint="Sertifikat keahlian atau pengajaran" rows={form.certifications} onChange={(rows) => setForm({ ...form, certifications: rows })} />

            {!editing && (
              <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-3">
                <p className="mb-2 text-sm font-semibold text-emerald-800">Akun Login (opsional)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="t-email">Email</Label>
                    <Input id="t-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@daruljinan.sch.id" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="t-password">Kata Sandi</Label>
                    <Input id="t-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 6 karakter" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={() => void submitForm()} disabled={isPending} className="bg-emerald-700 hover:bg-emerald-800">
              {isPending && <Loader2 className="size-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog Hapus */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data guru?</AlertDialogTitle>
            <AlertDialogDescription>
              Data {deleteTarget?.fullName} akan dihapus permanen. Jika guru masih mengampu kelas, penghapusan akan ditolak sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void submitDelete() }}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isPending}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />} Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
