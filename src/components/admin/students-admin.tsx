'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Users,
  RefreshCw,
  AlertCircle,
  Inbox,
  Search,
  Plus,
  Pencil,
  MoreHorizontal,
  Trash2,
  Loader2,
  BookMarked,
  Wallet,
  CalendarCheck,
  Download,
} from 'lucide-react'
import type { AppUser, ClassRoom, Student } from '@/lib/types'
import { apiGet, apiSend } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { statusBadgeClass, csvDate, csvFileStamp, downloadCsv } from './overview'

interface StudentFormState {
  fullName: string
  gender: string
  birthDate: string
  address: string
  classId: string
  parentId: string
}

const EMPTY_FORM: StudentFormState = {
  fullName: '',
  gender: 'L',
  birthDate: '',
  address: '',
  classId: 'none',
  parentId: 'none',
}

function studentStatusBadge(status: string): string {
  if (status === 'AKTIF') return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  if (status === 'LULUS') return 'border-violet-200 bg-violet-100 text-violet-800'
  return 'border-stone-200 bg-stone-100 text-stone-600'
}

export function StudentsAdmin() {
  const { toast } = useToast()
  const [students, setStudents] = useState<Student[]>([])
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [parents, setParents] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [exporting, setExporting] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState<StudentFormState>(EMPTY_FORM)
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, c, u] = await Promise.all([
        apiGet<Student[]>('/api/students'),
        apiGet<ClassRoom[]>('/api/classes'),
        apiGet<AppUser[]>('/api/users'),
      ])
      setStudents(s)
      setClasses(c)
      setParents(u.filter((x) => x.role === 'ORANG_TUA'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data santri')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return students.filter((s) => {
      const matchQ = !q || s.fullName.toLowerCase().includes(q) || s.nis.toLowerCase().includes(q)
      const matchC = classFilter === 'all' || s.classId === classFilter
      return matchQ && matchC
    })
  }, [students, search, classFilter])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  function openEdit(s: Student) {
    setEditing(s)
    setForm({
      fullName: s.fullName,
      gender: s.gender,
      birthDate: s.birthDate ? s.birthDate.slice(0, 10) : '',
      address: s.address,
      classId: s.classId ?? 'none',
      parentId: s.parentId ?? 'none',
    })
    setFormOpen(true)
  }

  async function submitForm() {
    if (!form.fullName.trim()) {
      toast({ title: 'Nama wajib diisi', description: 'Nama lengkap santri tidak boleh kosong.' })
      return
    }
    setIsPending(true)
    const payload = {
      fullName: form.fullName.trim(),
      gender: form.gender,
      birthDate: form.birthDate || undefined,
      address: form.address.trim() || undefined,
      classId: form.classId === 'none' ? null : form.classId,
      parentId: form.parentId === 'none' ? null : form.parentId,
    }
    try {
      if (editing) {
        await apiSend('/api/students', 'PUT', { id: editing.id, ...payload })
        toast({ title: 'Data santri diperbarui', description: `Perubahan pada ${form.fullName} telah disimpan.` })
      } else {
        await apiSend('/api/students', 'POST', payload)
        toast({ title: 'Santri ditambahkan', description: `${form.fullName} berhasil didaftarkan (NIS dibuat otomatis bila kosong).` })
      }
      setFormOpen(false)
      await load()
    } catch (e) {
      toast({ title: editing ? 'Gagal memperbarui' : 'Gagal menambahkan', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  async function toggleStatus(s: Student, status: string) {
    if (s.status === status) return
    setBusyId(s.id)
    try {
      await apiSend('/api/students', 'PUT', { id: s.id, status })
      toast({ title: 'Status diperbarui', description: `${s.fullName} kini berstatus ${status}.` })
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
      await apiSend(`/api/students?id=${deleteTarget.id}`, 'DELETE')
      toast({ title: 'Santri dihapus', description: `Data ${deleteTarget.fullName} telah dihapus.` })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast({ title: 'Gagal menghapus', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const filename = `santri-darul-jinan-${csvFileStamp()}.csv`
      const rows: string[][] = [
        ['NIS', 'Nama Lengkap', 'Jenis Kelamin', 'Tanggal Lahir', 'Kelas', 'Wali', 'No HP Wali', 'Status', 'Alamat'],
        ...filtered.map((s) => [
          s.nis,
          s.fullName,
          s.gender === 'P' ? 'Perempuan' : 'Laki-laki',
          csvDate(s.birthDate),
          s.class?.name ?? '',
          s.parent?.name ?? '',
          s.parent?.phone ?? '',
          s.status,
          s.address,
        ]),
      ]
      await new Promise((r) => setTimeout(r, 200))
      downloadCsv(filename, rows)
      toast({ title: 'Ekspor CSV berhasil', description: `${filtered.length} data santri tersimpan di ${filename}.` })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau NIS santri…"
            className="rounded-xl border-stone-200 bg-white pl-9"
          />
        </div>
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-44 rounded-xl border-stone-200 bg-white">
            <SelectValue placeholder="Semua kelas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kelas</SelectItem>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={openCreate} className="bg-emerald-700 hover:bg-emerald-800">
          <Plus className="size-4" /> Tambah Santri
        </Button>
        <Button
          variant="outline"
          onClick={() => void exportCsv()}
          disabled={loading || exporting || filtered.length === 0}
        >
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Ekspor CSV
        </Button>
        <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Muat ulang">
          <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : error ? (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="size-4" />
          <AlertTitle>Gagal memuat data santri</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => void load()}>
                <RefreshCw className="size-4" /> Coba Lagi
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-stone-200 shadow-sm">
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <Inbox className="size-9 text-stone-300" />
            <p className="font-medium text-stone-600">{students.length === 0 ? 'Belum ada santri' : 'Tidak ada santri yang cocok'}</p>
            <p className="text-sm text-stone-400">Ubah filter pencarian atau tambahkan santri baru.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-stone-200 py-0 shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60 hover:bg-stone-50/60">
                  <TableHead>NIS</TableHead>
                  <TableHead>Nama Santri</TableHead>
                  <TableHead>Kelas</TableHead>
                  <TableHead>Wali</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aktivitas</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs font-medium text-stone-600">{s.nis}</TableCell>
                    <TableCell>
                      <p className="font-medium text-stone-800">
                        {s.fullName} <span className="ml-0.5 text-xs text-stone-400">{s.gender === 'P' ? '♀' : '♂'}</span>
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-stone-600">{s.class?.name ?? '—'}</TableCell>
                    <TableCell>
                      <p className="text-sm text-stone-700">{s.parent?.name ?? '—'}</p>
                      <p className="text-xs text-stone-500">{s.parent?.phone ?? ''}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={studentStatusBadge(s.status)}>{s.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800">
                          <BookMarked className="size-2.5" /> {s._count?.hafalans ?? 0} hafalan
                        </Badge>
                        <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-[10px] text-amber-800">
                          <Wallet className="size-2.5" /> {s._count?.payments ?? 0} tagihan
                        </Badge>
                        <Badge variant="outline" className="gap-1 border-stone-200 bg-stone-50 text-[10px] text-stone-600">
                          <CalendarCheck className="size-2.5" /> {s._count?.attendances ?? 0} absen
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" disabled={busyId === s.id} aria-label="Aksi">
                            {busyId === s.id ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => openEdit(s)}>
                            <Pencil className="size-4 text-emerald-700" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel>Ubah Status</DropdownMenuLabel>
                          {['AKTIF', 'NONAKTIF', 'LULUS'].map((st) => (
                            <DropdownMenuItem
                              key={st}
                              disabled={s.status === st}
                              onClick={() => void toggleStatus(s, st)}
                            >
                              <span
                                className={`size-2 rounded-full ${
                                  st === 'AKTIF' ? 'bg-emerald-500' : st === 'LULUS' ? 'bg-violet-500' : 'bg-stone-400'
                                }`}
                              />
                              {st === 'AKTIF' ? 'Aktif' : st === 'NONAKTIF' ? 'Nonaktif' : 'Lulus'}
                              {s.status === st && <span className="ml-auto text-[10px] text-stone-400">saat ini</span>}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(s)}>
                            <Trash2 className="size-4" /> Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Dialog Tambah/Edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Data Santri' : 'Tambah Santri Baru'}</DialogTitle>
            <DialogDescription>
              {editing ? `Perbarui data ${editing.fullName}.` : 'Isi data santri baru. NIS dibuat otomatis bila dikosongkan.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="stu-name">Nama Lengkap *</Label>
              <Input
                id="stu-name"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="Contoh: Ahmad Fauzan"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="grid gap-1.5">
                <Label htmlFor="stu-birth">Tanggal Lahir</Label>
                <Input
                  id="stu-birth"
                  type="date"
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Kelas</Label>
                <Select value={form.classId} onValueChange={(v) => setForm({ ...form, classId: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa kelas</SelectItem>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Wali / Orang Tua</Label>
                <Select value={form.parentId} onValueChange={(v) => setForm({ ...form, parentId: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Pilih wali" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Belum ada wali</SelectItem>
                    {parents.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="stu-address">Alamat</Label>
              <Textarea
                id="stu-address"
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Alamat tempat tinggal santri"
              />
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
            <AlertDialogTitle>Hapus data santri?</AlertDialogTitle>
            <AlertDialogDescription>
              Data {deleteTarget?.fullName} (NIS {deleteTarget?.nis}) akan dihapus permanen beserta relasinya.
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
