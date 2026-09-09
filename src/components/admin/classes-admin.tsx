'use client'

import { useCallback, useEffect, useState } from 'react'
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
} from 'lucide-react'
import type { ClassRoom, Teacher } from '@/lib/types'
import { apiGet, apiSend } from '@/lib/api-client'
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

interface ClassFormState {
  name: string
  level: string
  schedule: string
  room: string
  teacherId: string
}

const EMPTY_FORM: ClassFormState = { name: '', level: 'IQRA', schedule: '', room: '', teacherId: 'none' }

export function ClassesAdmin() {
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
          <Button onClick={openCreate} className="bg-emerald-700 hover:bg-emerald-800">
            <Plus className="size-4" /> Tambah Kelas
          </Button>
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
    </div>
  )
}
