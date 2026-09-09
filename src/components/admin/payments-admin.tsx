'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Wallet,
  RefreshCw,
  AlertCircle,
  Inbox,
  Search,
  Plus,
  MoreHorizontal,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import type { Payment, Student } from '@/lib/types'
import { apiGet, apiSend, formatRupiah, formatShortDate } from '@/lib/api-client'
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
import { statusBadgeClass } from './overview'

function methodChip(method: string | null): string {
  if (method === 'MANUAL') return 'border-stone-200 bg-stone-100 text-stone-600'
  if (method) return 'border-teal-200 bg-teal-100 text-teal-800'
  return 'border-stone-200 bg-stone-50 text-stone-400'
}

export function PaymentsAdmin() {
  const { toast } = useToast()
  const [payments, setPayments] = useState<Payment[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [newStudentId, setNewStudentId] = useState('none')
  const [newTitle, setNewTitle] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [p, s] = await Promise.all([
        apiGet<Payment[]>('/api/payments'),
        apiGet<Student[]>('/api/students'),
      ])
      setPayments(p)
      setStudents(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data keuangan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(() => {
    let revenue = 0
    let outstanding = 0
    let pendingCount = 0
    for (const p of payments) {
      if (p.status === 'SUCCESS') revenue += p.amount
      if (p.status === 'PENDING') {
        outstanding += p.amount
        pendingCount += 1
      }
    }
    return { revenue, outstanding, pendingCount }
  }, [payments])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return payments.filter((p) => {
      const name = p.studentName || p.student?.fullName || ''
      const matchQ = !q || name.toLowerCase().includes(q) || p.invoiceNo.toLowerCase().includes(q)
      const matchS = statusFilter === 'all' || p.status === statusFilter
      return matchQ && matchS
    })
  }, [payments, search, statusFilter])

  async function createInvoice() {
    if (newStudentId === 'none') {
      toast({ title: 'Pilih santri', description: 'Tagihan harus terkait dengan satu santri.' })
      return
    }
    const amount = Number(newAmount)
    if (!newTitle.trim() || !Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Data belum lengkap', description: 'Isi judul tagihan dan nominal (angka > 0).' })
      return
    }
    setIsPending(true)
    try {
      await apiSend('/api/payments', 'POST', {
        studentId: newStudentId,
        title: newTitle.trim(),
        amount,
      })
      toast({
        title: 'Tagihan dibuat',
        description: 'Invoice terbit dan notifikasi WhatsApp terkirim ke wali santri.',
      })
      setCreateOpen(false)
      setNewStudentId('none')
      setNewTitle('')
      setNewAmount('')
      await load()
    } catch (e) {
      toast({ title: 'Gagal membuat tagihan', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  async function markStatus(p: Payment, status: 'SUCCESS' | 'FAILED') {
    setBusyId(p.id)
    try {
      if (status === 'SUCCESS') {
        await apiSend('/api/payments', 'PUT', { id: p.id, status: 'SUCCESS', method: 'MANUAL' })
        toast({ title: 'Pembayaran berhasil', description: `Invoice ${p.invoiceNo} ditandai lunas (verifikasi manual).` })
      } else {
        await apiSend('/api/payments', 'PUT', { id: p.id, status: 'FAILED' })
        toast({ title: 'Pembayaran gagal', description: `Invoice ${p.invoiceNo} ditandai gagal.` })
      }
      await load()
    } catch (e) {
      toast({ title: 'Gagal memperbarui status', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setBusyId(null)
    }
  }

  async function submitDelete() {
    if (!deleteTarget) return
    setIsPending(true)
    try {
      await apiSend(`/api/payments?id=${deleteTarget.id}`, 'DELETE')
      toast({ title: 'Tagihan dihapus', description: `Invoice ${deleteTarget.invoiceNo} telah dihapus.` })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast({ title: 'Gagal menghapus tagihan', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
      setDeleteTarget(null)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Ringkasan */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="rounded-2xl border-stone-200 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-stone-500">Total Pemasukan</p>
              <p className="text-xl font-bold text-stone-900">{formatRupiah(summary.revenue)}</p>
              <p className="text-[11px] text-stone-400">Akumulasi tagihan berstatus SUCCESS</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-stone-200 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <TrendingDown className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-stone-500">Tunggakan</p>
              <p className="text-xl font-bold text-stone-900">{formatRupiah(summary.outstanding)}</p>
              <p className="text-[11px] text-stone-400">{summary.pendingCount} tagihan masih PENDING</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama santri atau no. invoice…"
            className="rounded-xl border-stone-200 bg-white pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 rounded-xl border-stone-200 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="PENDING">PENDING</SelectItem>
            <SelectItem value="SUCCESS">SUCCESS</SelectItem>
            <SelectItem value="FAILED">FAILED</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setCreateOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
          <Plus className="size-4" /> Buat Tagihan
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
          <AlertTitle>Gagal memuat data keuangan</AlertTitle>
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
            <p className="font-medium text-stone-600">{payments.length === 0 ? 'Belum ada tagihan' : 'Tidak ada tagihan yang cocok'}</p>
            <p className="text-sm text-stone-400">Buat tagihan iuran untuk santri melalui tombol Buat Tagihan.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border-stone-200 py-0 shadow-sm">
          <div className="overflow-x-auto">
            <Table className="min-w-[880px]">
              <TableHeader>
                <TableRow className="bg-stone-50/60 hover:bg-stone-50/60">
                  <TableHead>Invoice</TableHead>
                  <TableHead>Santri</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Nominal</TableHead>
                  <TableHead>Metode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tgl Bayar</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs font-medium text-stone-600">{p.invoiceNo}</TableCell>
                    <TableCell className="text-sm font-medium text-stone-800">
                      {p.studentName || p.student?.fullName || '—'}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-sm text-stone-600">{p.title}</TableCell>
                    <TableCell className="text-sm font-semibold text-stone-800">{formatRupiah(p.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={methodChip(p.method)}>{p.method ?? '—'}</Badge>
                    </TableCell>
                    <TableCell><Badge className={statusBadgeClass(p.status)}>{p.status}</Badge></TableCell>
                    <TableCell className="text-sm text-stone-600">{p.paidAt ? formatShortDate(p.paidAt) : '—'}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" disabled={busyId === p.id} aria-label="Aksi">
                            {busyId === p.id ? <Loader2 className="size-4 animate-spin" /> : <MoreHorizontal className="size-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {p.status !== 'SUCCESS' && (
                            <DropdownMenuItem onClick={() => void markStatus(p, 'SUCCESS')}>
                              <CheckCircle2 className="size-4 text-emerald-600" /> Tandai Berhasil
                            </DropdownMenuItem>
                          )}
                          {p.status !== 'FAILED' && (
                            <DropdownMenuItem onClick={() => void markStatus(p, 'FAILED')}>
                              <XCircle className="size-4 text-red-600" /> Tandai Gagal
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(p)}>
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

      {/* Dialog Buat Tagihan */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="size-4 text-emerald-700" /> Buat Tagihan
            </DialogTitle>
            <DialogDescription>
              Invoice terbit langsung dan notifikasi WhatsApp dikirim ke wali santri.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Santri *</Label>
              <Select value={newStudentId} onValueChange={setNewStudentId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Pilih santri" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Pilih santri —</SelectItem>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.fullName}{s.class ? ` · ${s.class.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pay-title">Keterangan Tagihan *</Label>
              <Input
                id="pay-title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Iuran SPP Bulan Ini"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pay-amount">Nominal (Rp) *</Label>
              <Input
                id="pay-amount"
                type="number"
                min={0}
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
                placeholder="50000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={() => void createInvoice()} disabled={isPending} className="bg-emerald-700 hover:bg-emerald-800">
              {isPending && <Loader2 className="size-4 animate-spin" />} Terbitkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog Hapus */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus tagihan ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Invoice {deleteTarget?.invoiceNo} ({deleteTarget ? formatRupiah(deleteTarget.amount) : ''}) akan dihapus permanen.
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
