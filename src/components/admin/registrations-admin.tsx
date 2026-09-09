'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ClipboardList,
  RefreshCw,
  AlertCircle,
  Inbox,
  MoreHorizontal,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Trash2,
  FileText,
  Loader2,
} from 'lucide-react'
import type { ClassRoom, Registration } from '@/lib/types'
import { apiGet, apiSend, formatShortDate } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { statusBadgeClass } from './overview'

function safeParseArray(json: string | null | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(json || '[]')
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

const FILTERS = [
  { value: 'SEMUA', label: 'Semua' },
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'VERIFIKASI', label: 'Terverifikasi' },
  { value: 'DITERIMA', label: 'Diterima' },
  { value: 'DITOLAK', label: 'Ditolak' },
]

export function RegistrationsAdmin() {
  const { toast } = useToast()
  const [items, setItems] = useState<Registration[]>([])
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('SEMUA')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [acceptTarget, setAcceptTarget] = useState<Registration | null>(null)
  const [acceptClassId, setAcceptClassId] = useState('none')
  const [rejectTarget, setRejectTarget] = useState<Registration | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Registration | null>(null)
  const [isPending, setIsPending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [regs, kelas] = await Promise.all([
        apiGet<Registration[]>('/api/registrations'),
        apiGet<ClassRoom[]>('/api/classes'),
      ])
      setItems(regs)
      setClasses(kelas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat pendaftaran')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function mutate(id: string, fn: () => Promise<unknown>, successTitle: string, successDesc: string) {
    setBusyId(id)
    try {
      await fn()
      toast({ title: successTitle, description: successDesc })
      await load()
    } catch (e) {
      toast({ title: 'Gagal', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setBusyId(null)
    }
  }

  async function submitAccept() {
    if (!acceptTarget) return
    setIsPending(true)
    try {
      await apiSend('/api/registrations', 'PUT', {
        id: acceptTarget.id,
        status: 'DITERIMA',
        classId: acceptClassId === 'none' ? undefined : acceptClassId,
      })
      toast({
        title: 'Pendaftaran diterima',
        description: `${acceptTarget.childName} resmi diterima. Data santri dan akun wali otomatis dibuat, notifikasi WhatsApp terkirim.`,
      })
      setAcceptTarget(null)
      setAcceptClassId('none')
      await load()
    } catch (e) {
      toast({ title: 'Gagal menerima pendaftaran', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  async function submitReject() {
    if (!rejectTarget) return
    setIsPending(true)
    try {
      await apiSend('/api/registrations', 'PUT', {
        id: rejectTarget.id,
        status: 'DITOLAK',
        reviewNote: reviewNote.trim() || undefined,
      })
      toast({ title: 'Pendaftaran ditolak', description: 'Notifikasi WhatsApp terkirim ke wali calon santri.' })
      setRejectTarget(null)
      setReviewNote('')
      await load()
    } catch (e) {
      toast({ title: 'Gagal menolak pendaftaran', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  async function submitDelete() {
    if (!deleteTarget) return
    setIsPending(true)
    try {
      await apiSend(`/api/registrations?id=${deleteTarget.id}`, 'DELETE')
      toast({ title: 'Pendaftaran dihapus', description: `Data ${deleteTarget.regNumber} telah dihapus.` })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast({ title: 'Gagal menghapus', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  const filtered = filter === 'SEMUA' ? items : items.filter((r) => r.status === filter)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList className="flex-wrap">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
                <span className="ml-1.5 text-[10px] text-stone-400">
                  {f.value === 'SEMUA' ? items.length : items.filter((r) => r.status === f.value).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} /> Muat Ulang
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-72 rounded-2xl" />
      ) : error ? (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="size-4" />
          <AlertTitle>Gagal memuat pendaftaran</AlertTitle>
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
            <p className="font-medium text-stone-600">Belum ada pendaftaran</p>
            <p className="text-sm text-stone-400">Pendaftaran PPDB dari portal publik akan muncul di sini.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-stone-200 py-0 shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60 hover:bg-stone-50/60">
                  <TableHead>No. Pendaftaran</TableHead>
                  <TableHead>Calon Santri</TableHead>
                  <TableHead>Tgl Lahir</TableHead>
                  <TableHead>Wali &amp; Kontak</TableHead>
                  <TableHead>Dokumen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-medium text-stone-600">{r.regNumber}</TableCell>
                    <TableCell>
                      <p className="font-medium text-stone-800">{r.childName}</p>
                      <p className="text-xs text-stone-500">{r.gender === 'P' ? 'Perempuan' : 'Laki-laki'}</p>
                    </TableCell>
                    <TableCell className="text-sm text-stone-600">{formatShortDate(r.birthDate)}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-stone-700">{r.parentName}</p>
                      <p className="text-xs text-stone-500">{r.phone}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-44 flex-wrap gap-1">
                        {safeParseArray(r.documents).length === 0 ? (
                          <span className="text-xs text-stone-400">—</span>
                        ) : (
                          safeParseArray(r.documents).map((doc, i) => (
                            <Badge key={i} variant="outline" className="max-w-44 gap-1 border-stone-200 text-[10px] font-normal">
                              <FileText className="size-2.5 shrink-0 text-emerald-700" />
                              <span className="truncate">{doc}</span>
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadgeClass(r.status)}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" disabled={busyId === r.id} aria-label="Aksi">
                            {busyId === r.id ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Aksi Verifikasi</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {r.status === 'PENDING' && (
                            <DropdownMenuItem
                              onClick={() =>
                                void mutate(
                                  r.id,
                                  () => apiSend('/api/registrations', 'PUT', { id: r.id, status: 'VERIFIKASI' }),
                                  'Dokumen diverifikasi',
                                  `Pendaftaran ${r.regNumber} telah diverifikasi.`
                                )
                              }
                            >
                              <ShieldCheck className="size-4 text-teal-600" /> Verifikasi
                            </DropdownMenuItem>
                          )}
                          {r.status !== 'DITERIMA' && (
                            <DropdownMenuItem onClick={() => { setAcceptTarget(r); setAcceptClassId('none') }}>
                              <CheckCircle2 className="size-4 text-emerald-600" /> Terima
                            </DropdownMenuItem>
                          )}
                          {r.status !== 'DITOLAK' && (
                            <DropdownMenuItem onClick={() => { setRejectTarget(r); setReviewNote('') }}>
                              <XCircle className="size-4 text-red-600" /> Tolak
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(r)}>
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

      {/* Dialog Terima */}
      <Dialog open={!!acceptTarget} onOpenChange={(open) => !open && setAcceptTarget(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Terima Pendaftaran</DialogTitle>
            <DialogDescription>
              Terima <span className="font-semibold text-stone-800">{acceptTarget?.childName}</span> sebagai santri baru.
              Sistem akan otomatis membuat data santri beserta akun wali (email &amp; kata sandi awal dikirim via WhatsApp).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Tempatkan di kelas (opsional)</Label>
            <Select value={acceptClassId} onValueChange={setAcceptClassId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih kelas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Belum ditempatkan</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.level.replace('_', ' ')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptTarget(null)} disabled={isPending}>Batal</Button>
            <Button onClick={() => void submitAccept()} disabled={isPending} className="bg-emerald-700 hover:bg-emerald-800">
              {isPending && <Loader2 className="size-4 animate-spin" />} Terima Santri
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Tolak */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak Pendaftaran</DialogTitle>
            <DialogDescription>
              Berikan alasan penolakan untuk {rejectTarget?.childName}. Pesan ini diteruskan ke wali via WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="review-note">Catatan review</Label>
            <Textarea
              id="review-note"
              rows={3}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Contoh: Dokumen akta kelahiran belum lengkap, silakan daftar ulang."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={isPending}>Batal</Button>
            <Button variant="destructive" onClick={() => void submitReject()} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />} Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog Hapus */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pendaftaran ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Data pendaftaran {deleteTarget?.regNumber} atas nama {deleteTarget?.childName} akan dihapus permanen.
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
