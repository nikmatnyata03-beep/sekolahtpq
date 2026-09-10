'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  FolderOpen,
  RefreshCw,
  AlertCircle,
  Inbox,
  Upload,
  Trash2,
  Loader2,
  ExternalLink,
  FileText,
  Presentation,
  Video,
  AudioLines,
  type LucideIcon,
} from 'lucide-react'
import type { AuthUser, ClassRoom, Material, Teacher } from '@/lib/types'
import { apiGet, apiSend, formatShortDate } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

const MATERIAL_TYPES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'PDF', label: 'PDF', icon: FileText },
  { value: 'SLIDE', label: 'Slide', icon: Presentation },
  { value: 'VIDEO', label: 'Video', icon: Video },
  { value: 'AUDIO', label: 'Audio', icon: AudioLines },
]

const CATEGORIES = ['TAJWID', 'HAFALAN', 'IBADAH', 'AKHLAK']

function typeIcon(type: string): LucideIcon {
  return MATERIAL_TYPES.find((t) => t.value === type)?.icon ?? FileText
}

function categoryBadgeClass(category: string): string {
  switch (category) {
    case 'TAJWID': return 'border-emerald-200 bg-emerald-100 text-emerald-800'
    case 'HAFALAN': return 'border-violet-200 bg-violet-100 text-violet-800'
    case 'IBADAH': return 'border-amber-200 bg-amber-100 text-amber-800'
    case 'AKHLAK': return 'border-teal-200 bg-teal-100 text-teal-800'
    default: return 'border-stone-200 bg-stone-100 text-stone-600'
  }
}

export function MaterialsAdmin({ user }: { user?: AuthUser }) {
  const { toast } = useToast()
  const [materials, setMaterials] = useState<Material[]>([])
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null)

  const [title, setTitle] = useState('')
  const [type, setType] = useState('PDF')
  const [url, setUrl] = useState('')
  const [category, setCategory] = useState('TAJWID')
  const [classId, setClassId] = useState('none')
  const [teacherId, setTeacherId] = useState('none')
  const [description, setDescription] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [m, c, t] = await Promise.all([
        apiGet<Material[]>('/api/materials'),
        apiGet<ClassRoom[]>('/api/classes'),
        apiGet<Teacher[]>('/api/teachers'),
      ])
      setMaterials(m)
      setClasses(c)
      setTeachers(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat materi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Pre-pilih guru untuk akun GURU yang login
  useEffect(() => {
    if (user?.role === 'GURU' && user.teacherId) setTeacherId(user.teacherId)
  }, [user])

  async function submit() {
    if (!title.trim()) {
      toast({ title: 'Judul wajib diisi', description: 'Beri judul materi yang jelas.' })
      return
    }
    if (!url.trim()) {
      toast({ title: 'Tautan wajib diisi', description: 'Masukkan URL tempat file materi disimpan.' })
      return
    }
    if (teacherId === 'none') {
      toast({ title: 'Pilih guru pengampu', description: 'Materi harus terkait dengan guru pengunggah.' })
      return
    }
    setIsPending(true)
    try {
      await apiSend('/api/materials', 'POST', {
        title: title.trim(),
        type,
        url: url.trim(),
        category,
        classId: classId === 'none' ? null : classId,
        teacherId,
        description: description.trim() || undefined,
      })
      toast({ title: 'Materi diunggah', description: `Materi "${title}" kini tersedia untuk santri.` })
      setTitle('')
      setUrl('')
      setDescription('')
      await load()
    } catch (e) {
      toast({ title: 'Gagal mengunggah materi', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  async function submitDelete() {
    if (!deleteTarget) return
    setIsPending(true)
    try {
      await apiSend(`/api/materials?id=${deleteTarget.id}`, 'DELETE')
      toast({ title: 'Materi dihapus', description: `Materi "${deleteTarget.title}" telah dihapus.` })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast({ title: 'Gagal menghapus materi', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
      setDeleteTarget(null)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="size-4" />
          <AlertTitle>Gagal memuat materi</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => void load()}>
                <RefreshCw className="size-4" /> Coba Lagi
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Form unggah */}
        <Card className="rounded-2xl border-stone-200 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="size-4 text-emerald-700" /> Unggah Materi
            </CardTitle>
            <CardDescription>Bagikan bahan ajar lewat tautan file (URL).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="m-title">Judul Materi *</Label>
              <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Ratusan Hukum Nun Mati" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Jenis File</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MATERIAL_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Kategori</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="m-url">Tautan file (URL) *</Label>
              <Input id="m-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="grid gap-1.5">
              <Label>Kelas Tujuan (opsional)</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Semua kelas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Semua kelas</SelectItem>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Guru Pengampu *</Label>
              <Select
                value={teacherId}
                onValueChange={setTeacherId}
                disabled={user?.role === 'GURU' && !!user.teacherId}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Pilih guru" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Pilih guru —</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="m-desc">Deskripsi</Label>
              <Textarea id="m-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ringkasan isi materi" />
            </div>
            <Button onClick={() => void submit()} disabled={isPending} className="w-full bg-emerald-700 hover:bg-emerald-800">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Unggah
            </Button>
          </CardContent>
        </Card>

        {/* Daftar materi */}
        <Card className="rounded-2xl border-stone-200 py-0 shadow-sm lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
            <div className="flex items-center gap-2">
              <FolderOpen className="size-4 text-emerald-700" />
              <h3 className="font-semibold text-stone-900">Perpustakaan Materi</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} /> Muat Ulang
            </Button>
          </div>
          {loading ? (
            <div className="p-4"><Skeleton className="h-72 rounded-xl" /></div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <Inbox className="size-9 text-stone-300" />
              <p className="font-medium text-stone-600">Belum ada materi</p>
              <p className="text-sm text-stone-400">Unggah materi pertama melalui formulir di samping.</p>
            </div>
          ) : (
            <div className="p-4 pt-2">
              <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow className="bg-stone-50/60 hover:bg-stone-50/60">
                      <TableHead>Materi</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Guru</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((m) => {
                      const Icon = typeIcon(m.type)
                      return (
                        <TableRow key={m.id}>
                          <TableCell>
                            <div className="flex items-center gap-2.5">
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                                <Icon className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="max-w-56 truncate font-medium text-stone-800">{m.title}</p>
                                <p className="max-w-56 truncate text-xs text-stone-400">{m.url}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><Badge className={categoryBadgeClass(m.category)}>{m.category}</Badge></TableCell>
                          <TableCell className="text-sm text-stone-600">{m.class?.name ?? 'Semua'}</TableCell>
                          <TableCell className="text-sm text-stone-600">{m.teacher?.fullName ?? '—'}</TableCell>
                          <TableCell className="text-sm text-stone-600">{formatShortDate(m.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <a
                                href={m.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex size-8 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                                aria-label="Buka tautan materi"
                              >
                                <ExternalLink className="size-4" />
                              </a>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-stone-400 hover:text-red-600"
                                onClick={() => setDeleteTarget(m)}
                                aria-label="Hapus materi"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* AlertDialog Hapus */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus materi ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Materi &quot;{deleteTarget?.title}&quot; akan dihapus permanen dari perpustakaan.
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
