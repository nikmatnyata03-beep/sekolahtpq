'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  MessageCircle,
  RefreshCw,
  AlertCircle,
  Inbox,
  Search,
  SearchX,
  Send,
  ShieldAlert,
  Loader2,
  Info,
  CheckCheck,
  Download,
  RotateCcw,
  X,
} from 'lucide-react'
import type { AppUser, AuthUser, NotificationLog } from '@/lib/types'
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
import { csvDate, csvFileStamp, downloadCsv } from './overview'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function statusBadgeClass(status: string): string {
  if (status === 'SENT') return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  if (status === 'FAILED') return 'border-red-200 bg-red-100 text-red-700'
  if (status === 'PENDING') return 'border-amber-200 bg-amber-100 text-amber-800'
  return 'border-stone-200 bg-stone-100 text-stone-600'
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} hari lalu`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Chip filter status (bahasa visual selaras Tabs filter registrations-admin + badge Pengingat). */
const STATUS_CHIPS: { value: string; label: string; badge: string }[] = [
  { value: 'SEMUA', label: 'Semua', badge: 'bg-stone-100 text-stone-500' },
  { value: 'SENT', label: 'SENT', badge: 'bg-emerald-100 text-emerald-700' },
  { value: 'PENDING', label: 'PENDING', badge: 'bg-amber-100 text-amber-800' },
  { value: 'FAILED', label: 'FAILED', badge: 'bg-red-100 text-red-700' },
]

/** Render pesan gaya WhatsApp: *teks* menjadi tebal. */
function WhatsAppMessage({ message }: { message: string }) {
  const parts = useMemo(() => message.split(/\*([^*]+)\*/g), [message])
  return (
    <p className="whitespace-pre-line text-sm leading-relaxed text-stone-700">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-stone-900">{part}</strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </p>
  )
}

export function WhatsAppLog({ user }: { user?: AuthUser }) {
  const { toast } = useToast()
  const [messages, setMessages] = useState<NotificationLog[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('SEMUA')
  const [sendOpen, setSendOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')

  const isAdmin = user?.role === 'ADMIN'

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setMessages(await apiGet<NotificationLog[]>('/api/notifications'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat log WhatsApp')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      void load()
      // Nama penerima (untuk pencarian, tampilan kartu, dan kolom CSV) — gagal senyap agar log tetap tampil.
      apiGet<AppUser[]>('/api/users').then(setUsers).catch(() => setUsers([]))
    } else setLoading(false)
  }, [isAdmin, load])

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users])

  const counts = useMemo(() => {
    const c: Record<string, number> = { SEMUA: messages.length, SENT: 0, PENDING: 0, FAILED: 0 }
    for (const m of messages) if (m.status in c) c[m.status] += 1
    return c
  }, [messages])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return messages.filter((m) => {
      if (statusFilter !== 'SEMUA' && m.status !== statusFilter) return false
      if (!q) return true
      const recipient = (m.userId ? (usersById.get(m.userId) ?? '') : '').toLowerCase()
      return recipient.includes(q) || m.phone.toLowerCase().includes(q) || m.message.toLowerCase().includes(q)
    })
  }, [messages, search, statusFilter, usersById])

  const hasFilter = search.trim() !== '' || statusFilter !== 'SEMUA'

  function resetFilters() {
    setSearch('')
    setStatusFilter('SEMUA')
  }

  if (!isAdmin) {
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <ShieldAlert className="size-4" />
        <AlertTitle>Akses ditolak</AlertTitle>
        <AlertDescription>Bagian ini hanya dapat diakses oleh admin.</AlertDescription>
      </Alert>
    )
  }

  async function sendManual() {
    if (!phone.trim() || !message.trim()) {
      toast({ title: 'Data belum lengkap', description: 'Nomor tujuan dan isi pesan wajib diisi.' })
      return
    }
    setIsPending(true)
    try {
      await apiSend('/api/notifications', 'POST', { phone: phone.trim(), message: message.trim() })
      toast({ title: 'Pesan terkirim (simulasi)', description: `Pesan ke ${phone.trim()} tercatat pada log notifikasi.` })
      setSendOpen(false)
      setPhone('')
      setMessage('')
      await load()
    } catch (e) {
      toast({ title: 'Gagal mengirim pesan', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const filename = `log-whatsapp-${csvFileStamp()}.csv`
      const rows: string[][] = [
        ['Tanggal', 'Penerima', 'No. HP', 'Pesan', 'Status'],
        ...filtered.map((m) => [
          csvDate(m.createdAt),
          m.userId ? (usersById.get(m.userId) ?? '') : '',
          m.phone,
          m.message,
          m.status,
        ]),
      ]
      await new Promise((r) => setTimeout(r, 200))
      downloadCsv(filename, rows)
      toast({ title: 'Ekspor CSV berhasil', description: `${filtered.length} data pesan tersimpan di ${filename}.` })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Alert className="rounded-2xl border-teal-200 bg-teal-50/70 text-teal-900 [&>svg]:text-teal-600">
        <Info className="size-4" />
        <AlertTitle>Simulasi WhatsApp Business API</AlertTitle>
        <AlertDescription className="text-teal-800/90">
          Semua notifikasi (absensi, tagihan, hafalan, pengumuman) dicatat di sini sebagai simulasi pengiriman
          melalui WhatsApp Business Provider. Pada produksi, log ini digantikan kiriman nyata dari BSP.
        </AlertDescription>
      </Alert>

      {/* Toolbar: pencarian + filter status */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:min-w-52 sm:flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari penerima, pesan, atau nomor…"
            aria-label="Cari pesan"
            className="h-11 rounded-xl border-stone-200 bg-white pl-9 pr-11"
          />
          {search !== '' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearch('')}
              aria-label="Hapus pencarian"
              className="absolute right-0.5 top-1/2 size-11 -translate-y-1/2 rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter status pesan">
          {STATUS_CHIPS.map((chip) => {
            const active = statusFilter === chip.value
            return (
              <button
                key={chip.value}
                type="button"
                onClick={() => setStatusFilter(chip.value)}
                aria-pressed={active}
                className={
                  'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-all outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 ' +
                  (active
                    ? 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800'
                    : 'border-stone-200 bg-white text-stone-600 hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-700')
                }
              >
                {chip.label}
                <span
                  className={
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ' +
                    (active ? 'bg-white/20 text-white' : chip.badge)
                  }
                >
                  {counts[chip.value] ?? 0}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Info hasil filter + aksi */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-stone-500">
          Menampilkan {filtered.length} dari {messages.length} pesan
        </p>
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="text-stone-500 hover:text-emerald-700">
            <RotateCcw className="size-3.5" /> Bersihkan filter
          </Button>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void exportCsv()}
            disabled={loading || exporting || filtered.length === 0}
          >
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Ekspor CSV
          </Button>
          <Button onClick={() => setSendOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
            <Send className="size-4" /> Kirim Pesan Manual
          </Button>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} aria-label="Muat ulang">
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="size-4" />
          <AlertTitle>Gagal memuat log</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => void load()}>
                <RefreshCw className="size-4" /> Coba Lagi
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : messages.length === 0 ? (
        <Card className="rounded-2xl border-stone-200 shadow-sm">
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <Inbox className="size-9 text-stone-300" />
            <p className="font-medium text-stone-600">Belum ada pesan</p>
            <p className="text-sm text-stone-400">Notifikasi otomatis atau pesan manual akan muncul di sini.</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50/50 shadow-sm">
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <SearchX className="size-9 text-stone-300" />
            <p className="font-medium text-stone-600">Tidak ada pesan yang cocok dengan filter.</p>
            <p className="text-sm text-stone-400">Coba ubah kata kunci pencarian atau pilih status lain.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="mt-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <RotateCcw className="size-4" /> Bersihkan Filter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
          {filtered.map((m) => (
            <Card key={m.id} className="rounded-2xl border-stone-200 shadow-sm">
              <CardContent className="p-4">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <MessageCircle className="size-3.5" />
                    </div>
                    <span className="font-mono text-sm font-medium text-stone-800">{m.phone}</span>
                    {m.userId && usersById.has(m.userId) && (
                      <span className="text-xs text-stone-500">· {usersById.get(m.userId)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusBadgeClass(m.status)}>
                      {m.status === 'SENT' && <CheckCheck className="size-3" />}
                      {m.status}
                    </Badge>
                    <span className="text-xs text-stone-400">{timeAgo(m.createdAt)}</span>
                  </div>
                </div>
                <div className="rounded-xl bg-stone-50 p-3">
                  <WhatsAppMessage message={m.message} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Kirim Manual */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="size-4 text-emerald-700" /> Kirim Pesan Manual
            </DialogTitle>
            <DialogDescription>
              Kirim pesan WhatsApp simulasi. Gunakan *tanda bintang* untuk teks tebal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="w-phone">Nomor Tujuan *</Label>
              <Input id="w-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="628xxxxxxxxxx" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="w-message">Isi Pesan *</Label>
              <Textarea id="w-message" rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Contoh: *Pengingat* — Kegiatan khataman hari Sabtu pukul 08.00." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={() => void sendManual()} disabled={isPending} className="bg-emerald-700 hover:bg-emerald-800">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Kirim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
