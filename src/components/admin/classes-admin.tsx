'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  RefreshCw,
  AlertCircle,
  Inbox,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Clock,
  MapPin,
  Users,
  UserCheck,
  Eye,
  QrCode,
  Target,
} from 'lucide-react'
import type { AttendanceRecord, ClassRoom, Hafalan, SessionItem, Student, Teacher } from '@/lib/types'
import { apiGet, apiSend, formatShortDate } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { statusBadgeClass } from './overview'

const LEVELS = [
  { value: 'IQRA', label: 'Iqra' },
  { value: 'TAHFIDZ', label: 'Tahfidz' },
  { value: 'AL_QURAN', label: 'Al-Quran' },
]

function levelBadgeClass(level: string): string {
  if (level === 'IQRA') return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  if (level === 'TAHFIDZ') return 'border-violet-200 bg-violet-100 text-violet-800'
  if (level === 'AL_QURAN') return 'border-teal-200 bg-teal-100 text-teal-800'
  return 'border-stone-200 bg-stone-100 text-stone-600'
}

function levelLabel(level: string): string {
  return LEVELS.find((l) => l.value === level)?.label ?? level.replace('_', ' ')
}

// Inisial avatar — salinan initials() di student-detail-drawer (tidak diekspor di sana).
function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

interface ClassFormState {
  name: string
  level: string
  schedule: string
  room: string
  teacherId: string
}

const EMPTY_FORM: ClassFormState = { name: '', level: 'IQRA', schedule: '', room: '', teacherId: 'none' }

export function ClassesAdmin({ canManage = true }: { canManage?: boolean }) {
  // Temuan pentest BUG-3: tombol Tambah/Edit/Hapus kelas berbahaya utk GURU —
  // server menolak (403) tapi UI menampilkannya. GURU = mode lihat-saja.
  const { toast } = useToast()
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ClassRoom | null>(null)
  const [form, setForm] = useState<ClassFormState>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<ClassRoom | null>(null)
  const [detailClassId, setDetailClassId] = useState<string | null>(null)

  // Kelas pada Sheet "Detail Kelas" dicari ulang dari array classes — bila reload menghapus
  // kelas tersebut, detailKlass menjadi null dan sheet tertutup secara alami.
  const detailKlass = classes.find((c) => c.id === detailClassId) ?? null

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, t] = await Promise.all([apiGet<ClassRoom[]>('/api/classes'), apiGet<Teacher[]>('/api/teachers')])
      setClasses(c)
      setTeachers(t.filter((x) => x.isActive))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data kelas')
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

  function openEdit(c: ClassRoom) {
    setEditing(c)
    setForm({
      name: c.name,
      level: c.level,
      schedule: c.schedule,
      room: c.room ?? '',
      teacherId: c.teacherId ?? 'none',
    })
    setFormOpen(true)
  }

  async function submitForm() {
    if (!form.name.trim()) {
      toast({ title: 'Nama kelas wajib diisi', description: 'Beri nama kelas, misalnya "Kelas Iqra 1A".' })
      return
    }
    setIsPending(true)
    const payload = {
      name: form.name.trim(),
      level: form.level,
      schedule: form.schedule.trim() || undefined,
      room: form.room.trim() || null,
      teacherId: form.teacherId === 'none' ? null : form.teacherId,
    }
    try {
      if (editing) {
        await apiSend('/api/classes', 'PUT', { id: editing.id, ...payload })
        toast({ title: 'Kelas diperbarui', description: `Perubahan pada kelas ${form.name} telah disimpan.` })
      } else {
        await apiSend('/api/classes', 'POST', payload)
        toast({ title: 'Kelas dibuat', description: `Kelas ${form.name} berhasil ditambahkan.` })
      }
      setFormOpen(false)
      await load()
    } catch (e) {
      toast({ title: editing ? 'Gagal memperbarui kelas' : 'Gagal membuat kelas', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  async function submitDelete() {
    if (!deleteTarget) return
    setIsPending(true)
    try {
      await apiSend(`/api/classes?id=${deleteTarget.id}`, 'DELETE')
      toast({ title: 'Kelas dihapus', description: `Kelas ${deleteTarget.name} telah dihapus.` })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast({ title: 'Gagal menghapus kelas', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
      setDeleteTarget(null)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-500">{classes.length} kelas berjalan</p>
        <div className="flex items-center gap-2">
          {canManage && (
            <Button onClick={openCreate} className="bg-emerald-700 hover:bg-emerald-800">
              <Plus className="size-4" /> Tambah Kelas
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Muat ulang">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="size-4" />
          <AlertTitle>Gagal memuat data kelas</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => void load()}>
                <RefreshCw className="size-4" /> Coba Lagi
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : classes.length === 0 ? (
        <Card className="rounded-2xl border-stone-200 shadow-sm">
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <Inbox className="size-9 text-stone-300" />
            <p className="font-medium text-stone-600">Belum ada kelas</p>
            <p className="text-sm text-stone-400">Buat kelas pertama untuk mulai mengelompokkan santri.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.id} className="rounded-2xl border-stone-200 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <BookOpen className="size-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-stone-900">{c.name}</p>
                      <Badge className={`mt-0.5 ${levelBadgeClass(c.level)}`}>{levelLabel(c.level)}</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-stone-600">
                  <p className="flex items-center gap-1.5">
                    <Clock className="size-3.5 shrink-0 text-emerald-700" />
                    {c.schedule || 'Jadwal belum diatur'}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0 text-emerald-700" />
                    {c.room || 'Tanpa ruang'}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <UserCheck className="size-3.5 shrink-0 text-emerald-700" />
                    {c.teacher ? c.teacher.fullName : 'Belum ada pengajar'}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Users className="size-3.5 shrink-0 text-emerald-700" />
                    {c.studentCount ?? 0} santri
                  </p>
                </div>

                <div className="mt-auto flex justify-end gap-1 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-stone-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50"
                    onClick={() => setDetailClassId(c.id)}
                    aria-label={`Detail kelas ${c.name}`}
                  >
                    <Eye className="size-3.5" /> Detail
                  </Button>
                  {canManage && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8 border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => setDeleteTarget(c)}
                        aria-label="Hapus kelas"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Tambah/Edit Kelas */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Kelas' : 'Tambah Kelas'}</DialogTitle>
            <DialogDescription>
              Atur nama, jenjang, jadwal, ruangan, dan pengajar kelas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="c-name">Nama Kelas *</Label>
              <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Kelas Tahfidz 2B" />
            </div>
            <div className="grid gap-1.5">
              <Label>Jenjang</Label>
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="c-schedule">Jadwal</Label>
                <Input id="c-schedule" value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} placeholder="Senin & Rabu, 15.30" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="c-room">Ruangan</Label>
                <Input id="c-room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} placeholder="Aula Masjid" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Pengajar</Label>
              <Select value={form.teacherId} onValueChange={(v) => setForm({ ...form, teacherId: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Pilih guru" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Belum ditentukan</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <AlertDialogTitle>Hapus kelas ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Kelas {deleteTarget?.name} akan dihapus permanen. Kelas yang masih berisi santri mungkin tidak dapat dihapus.
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

      {/* Sheet Detail Kelas (Task 17-b): roster + statistik + sesi terbaru per kelas */}
      <ClassDetailSheet
        klass={detailKlass}
        open={!!detailKlass}
        onOpenChange={(o) => {
          if (!o) setDetailClassId(null)
        }}
      />
    </div>
  )
}

// ==== Sheet Detail Kelas (Task 17-b) ====
// Satu Promise.all (students + attendance per classId, sessions + hafalan global) saat sheet
// terbuka; statistik dihitung klien via useMemo atas data hasil fetch — jendela 30 hari
// memakai new Date() di dalam useMemo, sehingga render awal tetap bebas dari ketidakmurnian hidrasi.

const DETAIL_SCROLLBAR_CLASS =
  '[scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300'

type ClassDetailData = {
  students: Student[]
  attendance: AttendanceRecord[]
  sessions: SessionItem[]
  hafalans: Hafalan[]
}

function ClassDetailSheet({
  klass,
  open,
  onOpenChange,
}: {
  klass: ClassRoom | null
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [data, setData] = useState<ClassDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const classId = klass?.id ?? null

  useEffect(() => {
    if (!open || !classId) return
    let cancelled = false
    async function loadDetail() {
      setLoading(true)
      setError(null)
      setData(null)
      try {
        const [students, attendance, sessions, hafalans] = await Promise.all([
          apiGet<Student[]>(`/api/students?classId=${classId}`),
          apiGet<AttendanceRecord[]>(`/api/attendance?classId=${classId}`),
          apiGet<SessionItem[]>('/api/sessions'),
          apiGet<Hafalan[]>('/api/hafalan'),
        ])
        if (cancelled) return
        setData({ students, attendance, sessions, hafalans })
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Gagal memuat detail kelas')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadDetail()
    return () => {
      cancelled = true
    }
  }, [open, classId, reloadKey])

  // Turunan data — murni dari hasil fetch; filter kelas + agregat statistik di sini.
  const derived = useMemo(() => {
    if (!data || !classId) return null
    const rosterIds = new Set(data.students.map((s) => s.id))
    const aktifCount = data.students.filter((s) => s.status === 'AKTIF').length
    // Jendela 30 hari dihitung di dalam useMemo atas data hasil fetch (aman untuk hidrasi).
    const now = new Date()
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const recent = data.attendance.filter((a) => new Date(a.createdAt) >= cutoff)
    const hadirRecent = recent.filter((a) => a.status === 'HADIR').length
    const attendanceRate = recent.length > 0 ? Math.round((hadirRecent / recent.length) * 100) : null
    const setoranCount = data.hafalans.filter((h) => rosterIds.has(h.studentId)).length
    const recentSessions = data.sessions
      .filter((s) => s.classId === classId)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5)
    const hadirBySession = new Map<string, number>()
    for (const a of data.attendance) {
      if (a.status === 'HADIR') hadirBySession.set(a.sessionId, (hadirBySession.get(a.sessionId) ?? 0) + 1)
    }
    return { aktifCount, attendanceRate, setoranCount, recentSessions, hadirBySession }
  }, [data, classId])

  const roster = data?.students ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-stone-100 bg-stone-50/60 p-4 text-left">
          <div className="flex items-start gap-3 pr-6">
            <div
              aria-hidden="true"
              className={`grid size-9 shrink-0 place-items-center rounded-xl ${levelBadgeClass(klass?.level ?? '')}`}
            >
              <BookOpen className="size-4" />
            </div>
            <div className="min-w-0">
              <SheetTitle className="truncate text-base leading-snug text-stone-800">
                {klass?.name ?? 'Kelas'}
              </SheetTitle>
              <SheetDescription className="sr-only">
                Detail kelas: daftar santri, statistik kehadiran, setoran hafalan, dan sesi terbaru.
              </SheetDescription>
              <p className="mt-1 truncate text-xs text-stone-500">
                {klass?.schedule || 'Jadwal belum diatur'} · {klass?.room || 'Tanpa ruang'}
              </p>
              <p className="mt-0.5 truncate text-xs text-stone-500">
                {klass?.teacher ? klass.teacher.fullName : 'Belum ada pengajar'}
              </p>
              <Badge variant="outline" className={`mt-1.5 text-[10px] ${levelBadgeClass(klass?.level ?? '')}`}>
                {klass ? levelLabel(klass.level) : '—'}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <div className={`min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 ${DETAIL_SCROLLBAR_CLASS}`}>
          {loading && !data ? (
            <div className="space-y-2" aria-hidden="true">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          ) : error && !data ? (
            <Alert variant="destructive" className="rounded-xl">
              <AlertCircle className="size-4" />
              <AlertTitle className="text-sm">Gagal memuat detail kelas</AlertTitle>
              <AlertDescription className="text-xs">
                {error}
                <div className="mt-2">
                  <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
                    <RefreshCw className="size-4" /> Coba Lagi
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : derived ? (
            <>
              {/* Strip statistik ringkas */}
              <div aria-live="polite" className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-stone-100 bg-stone-50/60 px-3 py-2">
                  <p className="text-[11px] text-stone-500">Santri AKTIF</p>
                  <p className="text-sm font-semibold text-stone-800">{derived.aktifCount}</p>
                </div>
                <div className="rounded-xl border border-stone-100 bg-stone-50/60 px-3 py-2">
                  <p className="text-[11px] text-stone-500">Kehadiran 30 Hari</p>
                  <p className="text-sm font-semibold text-stone-800">
                    {derived.attendanceRate === null ? '—' : `${derived.attendanceRate}%`}
                  </p>
                </div>
                <div className="rounded-xl border border-stone-100 bg-stone-50/60 px-3 py-2">
                  <p className="text-[11px] text-stone-500">Setoran Hafalan</p>
                  <p className="text-sm font-semibold text-stone-800">{derived.setoranCount}</p>
                </div>
              </div>

              {/* Roster santri */}
              <section className="space-y-2">
                <p className="text-xs font-medium text-stone-500">Santri ({roster.length})</p>
                {roster.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-200 py-8 text-center">
                    <Users className="size-8 text-stone-300" />
                    <p className="text-sm text-stone-500">Belum ada santri di kelas ini</p>
                  </div>
                ) : (
                  <ul
                    role="list"
                    className={`max-h-72 divide-y divide-stone-100 overflow-y-auto pr-1 ${DETAIL_SCROLLBAR_CLASS}`}
                  >
                    {roster.map((s) => (
                      <li key={s.id} role="listitem" className="flex items-center gap-2.5 py-2.5">
                        <div
                          aria-hidden="true"
                          className={`grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${
                            s.status === 'AKTIF' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'
                          }`}
                        >
                          {initials(s.fullName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-stone-800">{s.fullName}</p>
                          <p className="font-mono text-[11px] text-stone-400">{s.nis}</p>
                        </div>
                        {s.hafalanTarget && (
                          <span
                            className="flex max-w-[120px] shrink-0 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800"
                            title={`Target hafalan: ${s.hafalanTarget}`}
                          >
                            <Target className="size-3 shrink-0" />
                            <span className="truncate">{s.hafalanTarget}</span>
                          </span>
                        )}
                        <Badge variant="outline" className={`shrink-0 text-[10px] ${statusBadgeClass(s.status)}`}>
                          {s.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Sesi terbaru */}
              <section className="space-y-2">
                <p className="text-xs font-medium text-stone-500">Sesi Terbaru</p>
                {derived.recentSessions.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-200 py-8 text-center">
                    <QrCode className="size-8 text-stone-300" />
                    <p className="text-sm text-stone-500">Belum ada sesi</p>
                  </div>
                ) : (
                  <ul role="list" className="divide-y divide-stone-100">
                    {derived.recentSessions.map((s) => (
                      <li key={s.id} role="listitem" className="flex items-center gap-2.5 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-stone-800" title={s.topic ?? undefined}>
                            {s.topic || 'Tanpa topik'}
                          </p>
                          <p className="text-[11px] text-stone-400">{formatShortDate(s.date)}</p>
                        </div>
                        {s.isActive && (
                          <Badge
                            variant="outline"
                            className="shrink-0 text-[10px] border-emerald-200 bg-emerald-100 text-emerald-800"
                          >
                            AKTIF
                          </Badge>
                        )}
                        <span
                          className="shrink-0 rounded-md border border-stone-200 bg-stone-50 px-1.5 py-0.5 font-mono text-[10px] text-stone-600"
                          title={`${derived.hadirBySession.get(s.id) ?? 0} hadir dari ${roster.length} santri`}
                        >
                          {derived.hadirBySession.get(s.id) ?? 0}/{roster.length}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}
