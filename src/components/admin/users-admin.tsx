'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  UserCog,
  RefreshCw,
  AlertCircle,
  Inbox,
  Search,
  Plus,
  MoreHorizontal,
  Trash2,
  Loader2,
  KeyRound,
  ShieldAlert,
} from 'lucide-react'
import type { AppUser, AuthUser, ClassRoom, Role, Teacher } from '@/lib/types'
import { apiGet, apiSend, formatShortDate } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { ClassAssignmentEditor, levelLabel } from '@/components/admin/class-assignment-editor'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

function roleBadgeClass(role: string): string {
  if (role === 'ADMIN') return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  if (role === 'GURU') return 'border-amber-200 bg-amber-100 text-amber-800'
  if (role === 'DEVELOPER') return 'border-purple-200 bg-purple-100 text-purple-800'
  return 'border-stone-200 bg-stone-100 text-stone-600'
}

// Task 46: warna badge kelas konsisten dengan weekly-schedule (IQRA emerald · TAHFIDZ amber · lainnya teal)
function classBadgeClass(level: string): string {
  if (level === 'IQRA') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (level === 'TAHFIDZ') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-teal-200 bg-teal-50 text-teal-700'
}

function roleLabel(role: string): string {
  if (role === 'ADMIN') return 'Admin'
  if (role === 'GURU') return 'Guru'
  if (role === 'DEVELOPER') return 'Developer'
  return 'Wali Santri'
}

interface UserFormState {
  name: string
  email: string
  phone: string
  password: string
  role: string
  teacherId: string
  classIds: string[] // Task 40: penugasan kelas+jenjang langsung dari form akun
}

const EMPTY_FORM: UserFormState = { name: '', email: '', phone: '', password: '', role: 'ORANG_TUA', teacherId: 'none', classIds: [] }

export function UsersAdmin({ user }: { user?: AuthUser }) {
  const { toast } = useToast()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM)
  // Task 36: daftar profil guru (utk penautan akun GURU → profil guru)
  const [teachers, setTeachers] = useState<Teacher[]>([])
  // Task 40: daftar kelas (utk pilihan Kelas yang Diampu saat role=Guru)
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)

  const isAdmin = user?.role === 'ADMIN'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setUsers(await apiGet<AppUser[]>('/api/users'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat pengguna')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) void load()
    else setLoading(false)
  }, [isAdmin, load])

  // Task 36+40: muat profil guru & daftar kelas saat dialog tambah dibuka
  useEffect(() => {
    if (!createOpen) return
    void apiGet<Teacher[]>('/api/teachers')
      .then(setTeachers)
      .catch(() => setTeachers([]))
    void apiGet<ClassRoom[]>('/api/classes')
      .then(setClasses)
      .catch(() => setClasses([]))
  }, [createOpen])

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase()
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  if (!isAdmin) {
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <ShieldAlert className="size-4" />
        <AlertTitle>Akses ditolak</AlertTitle>
        <AlertDescription>Bagian ini hanya dapat diakses oleh admin.</AlertDescription>
      </Alert>
    )
  }

  async function changeRole(u: AppUser, role: Role) {
    if (u.role === role) return
    setBusyId(u.id)
    try {
      await apiSend('/api/users', 'PUT', { id: u.id, role })
      toast({ title: 'Peran diperbarui', description: `${u.name} kini berperan sebagai ${roleLabel(role)}.` })
      await load()
    } catch (e) {
      toast({ title: 'Gagal mengubah peran', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setBusyId(null)
    }
  }

  async function submitReset() {
    if (!resetTarget) return
    if (newPassword.trim().length < 6) {
      toast({ title: 'Kata sandi terlalu pendek', description: 'Gunakan minimal 6 karakter.' })
      return
    }
    setIsPending(true)
    try {
      await apiSend('/api/users', 'PUT', { id: resetTarget.id, password: newPassword })
      toast({ title: 'Kata sandi direset', description: `Kata sandi baru untuk ${resetTarget.name} telah disimpan.` })
      setResetTarget(null)
      setNewPassword('')
    } catch (e) {
      toast({ title: 'Gagal reset kata sandi', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  async function submitCreate() {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast({ title: 'Data belum lengkap', description: 'Nama, email, dan kata sandi wajib diisi.' })
      return
    }
    setIsPending(true)
    try {
      await apiSend('/api/users', 'POST', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        password: form.password,
        role: form.role,
        ...(form.role === 'GURU' && {
          teacherId: form.teacherId === 'none' ? null : form.teacherId,
          classIds: form.classIds, // Task 40: langsung dari form akun
        }),
      })
      toast({
        title: 'Pengguna ditambahkan',
        description:
          form.role === 'GURU'
            ? `${form.name} dapat login${form.classIds.length ? ` dan mengampu ${form.classIds.length} kelas` : ''}. Kelas bisa diubah kapan saja lewat menu Guru.`
            : `${form.name} dapat login dengan akun barunya.`,
      })
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      await load()
    } catch (e) {
      toast({ title: 'Gagal menambahkan pengguna', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  async function submitDelete() {
    if (!deleteTarget) return
    setIsPending(true)
    try {
      await apiSend(`/api/users?id=${deleteTarget.id}`, 'DELETE')
      toast({ title: 'Pengguna dihapus', description: `Akun ${deleteTarget.name} telah dihapus.` })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      // Misal: menolak menghapus admin terakhir
      toast({ title: 'Tidak dapat menghapus', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
      setDeleteTarget(null)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau email…"
            className="rounded-xl border-stone-200 bg-white pl-9"
          />
        </div>
        <Button onClick={() => setCreateOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
          <Plus className="size-4" /> Tambah Pengguna
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
          <AlertTitle>Gagal memuat pengguna</AlertTitle>
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
            <p className="font-medium text-stone-600">{users.length === 0 ? 'Belum ada pengguna' : 'Tidak ada yang cocok'}</p>
            <p className="text-sm text-stone-400">Ubah kata kunci pencarian atau tambahkan pengguna baru.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-stone-200 py-0 shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60 hover:bg-stone-50/60">
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead>Peran</TableHead>
                  <TableHead>Kelas Diampu</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <p className="font-medium text-stone-800">
                        {u.name}
                        {u.id === user?.id && <span className="ml-1.5 text-[10px] font-normal text-emerald-700">(Anda)</span>}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-stone-600">{u.email}</TableCell>
                    <TableCell className="text-sm text-stone-600">{u.phone ?? '—'}</TableCell>
                    <TableCell><Badge className={roleBadgeClass(u.role)}>{roleLabel(u.role)}</Badge></TableCell>
                    {/* Task 46: badge kelas yang diampu guru — admin melihat penugasan tanpa membuka menu lain */}
                    <TableCell data-testid="kelas-diampu">
                      {u.role === 'GURU' ? (
                        u.teacherProfile?.classes?.length ? (
                          <div className="flex max-w-56 flex-wrap gap-1">
                            {u.teacherProfile.classes.map((c) => (
                              <Badge
                                key={c.id}
                                variant="outline"
                                title={`Jenjang ${levelLabel(c.level)}`}
                                className={cn('text-[11px] font-medium', classBadgeClass(c.level))}
                              >
                                {c.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400">Belum ada kelas</span>
                        )
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-stone-600">{u.createdAt ? formatShortDate(u.createdAt) : '—'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" disabled={busyId === u.id} aria-label="Aksi">
                            {busyId === u.id ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Ubah Peran</DropdownMenuLabel>
                          {(['ADMIN', 'GURU', 'ORANG_TUA', 'DEVELOPER'] as Role[]).map((r) => (
                            <DropdownMenuItem key={r} disabled={u.role === r} onClick={() => void changeRole(u, r)}>
                              <span className={`size-2 rounded-full ${r === 'ADMIN' ? 'bg-emerald-500' : r === 'GURU' ? 'bg-amber-500' : r === 'DEVELOPER' ? 'bg-purple-500' : 'bg-stone-400'}`} />
                              {roleLabel(r)}
                              {u.role === r && <span className="ml-auto text-[10px] text-stone-400">saat ini</span>}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setResetTarget(u); setNewPassword('') }}>
                            <KeyRound className="size-4 text-emerald-700" /> Reset Kata Sandi
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(u)}>
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

      {/* Dialog Tambah Pengguna */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="size-4 text-emerald-700" /> Tambah Pengguna
            </DialogTitle>
            <DialogDescription>Buat akun admin, guru, atau wali santri baru.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="u-name">Nama *</Label>
              <Input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama lengkap" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="u-email">Email *</Label>
              <Input id="u-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@email.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="u-phone">No. WhatsApp</Label>
                <Input id="u-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08xxxxxxxxxx" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="u-password">Kata Sandi *</Label>
                <Input id="u-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min. 6 karakter" />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Peran</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v, teacherId: 'none', classIds: [] })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="GURU">Guru</SelectItem>
                  <SelectItem value="ORANG_TUA">Wali Santri</SelectItem>
                  <SelectItem value="DEVELOPER">Developer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Task 36: akun guru wajib terhubung profil guru agar bisa ditugaskan kelas */}
            {/* Task 40: pilihan Kelas yang Diampu langsung di form — admin tidak perlu buka menu lain */}
            {form.role === 'GURU' && (
              <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="u-teacher">Profil Guru</Label>
                  <Select
                    value={form.teacherId}
                    onValueChange={(v) => {
                      // Prefill kelas yang sudah diampu profil terpilih agar admin tinggal menyesuaikan
                      const t = teachers.find((x) => x.id === v)
                      const prefill = t?.classes?.map((c) => c.id) ?? []
                      setForm((f) => ({ ...f, teacherId: v, classIds: v === 'none' ? [] : prefill }))
                    }}
                  >
                    <SelectTrigger id="u-teacher" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Buat profil baru otomatis</SelectItem>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id} disabled={!!t.user}>
                          {t.fullName}
                          {t.user ? ' — sudah punya akun' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <ClassAssignmentEditor
                  classes={classes}
                  selected={form.classIds}
                  onChange={(ids) => setForm((f) => ({ ...f, classIds: ids }))}
                />
                <p className="text-xs text-amber-800">
                  Kelas &amp; jenjang yang dicentang langsung aktif saat akun dibuat — guru bisa langsung membuka sesi absensi.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={() => void submitCreate()} disabled={isPending} className="bg-emerald-700 hover:bg-emerald-800">
              {isPending && <Loader2 className="size-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Reset Kata Sandi */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="rounded-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-emerald-700" /> Reset Kata Sandi
            </DialogTitle>
            <DialogDescription>
              Atur kata sandi baru untuk <span className="font-semibold text-stone-800">{resetTarget?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="new-pass">Kata Sandi Baru *</Label>
            <Input id="new-pass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 karakter" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={isPending}>Batal</Button>
            <Button onClick={() => void submitReset()} disabled={isPending} className="bg-emerald-700 hover:bg-emerald-800">
              {isPending && <Loader2 className="size-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog Hapus */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengguna ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun {deleteTarget?.name} ({deleteTarget?.email}) akan dihapus permanen. Sistem menolak menghapus admin terakhir.
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
