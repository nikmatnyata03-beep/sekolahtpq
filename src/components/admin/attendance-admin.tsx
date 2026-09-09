'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CalendarCheck,
  RefreshCw,
  AlertCircle,
  QrCode,
  Copy,
  Power,
  Save,
  Loader2,
  History,
} from 'lucide-react'
import type { AttendanceRecord, ClassRoom, SessionItem, Student } from '@/lib/types'
import { apiGet, apiSend, formatShortDate } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QRCodeSVG } from 'qrcode.react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { statusBadgeClass } from './overview'

type AttStatus = 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA'

const STATUSES: { value: AttStatus; label: string; on: string; off: string }[] = [
  { value: 'HADIR', label: 'Hadir', on: 'bg-emerald-700 text-white border-emerald-700', off: 'border-stone-200 bg-white text-stone-600 hover:border-emerald-300' },
  { value: 'IZIN', label: 'Izin', on: 'bg-amber-500 text-white border-amber-500', off: 'border-stone-200 bg-white text-stone-600 hover:border-amber-300' },
  { value: 'SAKIT', label: 'Sakit', on: 'bg-orange-500 text-white border-orange-500', off: 'border-stone-200 bg-white text-stone-600 hover:border-orange-300' },
  { value: 'ALPA', label: 'Alpa', on: 'bg-red-600 text-white border-red-600', off: 'border-stone-200 bg-white text-stone-600 hover:border-red-300' },
]

interface RecordState {
  status: AttStatus
  note: string
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function AttendanceAdmin() {
  const { toast } = useToast()
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [log, setLog] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Buka sesi
  const [classId, setClassId] = useState('none')
  const [topic, setTopic] = useState('')
  const [date, setDate] = useState(todayISO())
  const [isOpening, setIsOpening] = useState(false)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [createdSession, setCreatedSession] = useState<SessionItem | null>(null)

  // Catat kehadiran
  const [sessionId, setSessionId] = useState('none')
  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<Record<string, RecordState>>({})
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const activeSessions = sessions.filter((s) => s.isActive)
  const selectedSession = sessions.find((s) => s.id === sessionId) ?? null

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [c, s, l] = await Promise.all([
        apiGet<ClassRoom[]>('/api/classes'),
        apiGet<SessionItem[]>('/api/sessions'),
        apiGet<AttendanceRecord[]>('/api/attendance'),
      ])
      setClasses(c)
      setSessions(s)
      setLog(l)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data absensi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Muat santri + absensi existing saat sesi dipilih
  useEffect(() => {
    if (sessionId === 'none' || !selectedSession) {
      setStudents([])
      setRecords({})
      return
    }
    let cancelled = false
    const session = selectedSession
    async function loadRoster() {
      setLoadingRoster(true)
      try {
        const [roster, existing] = await Promise.all([
          apiGet<Student[]>(`/api/students?classId=${session.classId}`),
          apiGet<AttendanceRecord[]>(`/api/attendance?sessionId=${session.id}`),
        ])
        if (cancelled) return
        setStudents(roster)
        const map: Record<string, RecordState> = {}
        for (const s of roster) {
          const found = existing.find((a) => a.studentId === s.id)
          map[s.id] = { status: (found?.status as AttStatus) ?? 'HADIR', note: found?.note ?? '' }
        }
        setRecords(map)
      } catch {
        if (!cancelled) {
          setStudents([])
          setRecords({})
        }
      } finally {
        if (!cancelled) setLoadingRoster(false)
      }
    }
    void loadRoster()
    return () => {
      cancelled = true
    }
  }, [sessionId, selectedSession])

  function copyCode(code: string) {
    void navigator.clipboard
      ?.writeText(code)
      .then(() => toast({ title: 'Kode disalin', description: `Kode sesi ${code} siap dibagikan.` }))
      .catch(() => toast({ title: 'Gagal menyalin', description: 'Salin kode secara manual.' }))
  }

  async function openSession() {
    if (classId === 'none') {
      toast({ title: 'Pilih kelas', description: 'Tentukan kelas yang akan dibuka sesinya.' })
      return
    }
    setIsOpening(true)
    try {
      await apiSend('/api/sessions', 'POST', {
        classId,
        topic: topic.trim() || undefined,
        date: date || undefined,
      })
      const refreshed = await apiGet<SessionItem[]>('/api/sessions')
      setSessions(refreshed)
      const created = refreshed.find((s) => s.isActive && s.classId === classId) ?? null
      setCreatedSession(created)
      if (created) setSessionId(created.id)
      toast({ title: 'Sesi dibuka', description: 'Kode QR kehadiran berhasil dibuat. Bagikan ke santri untuk check-in.' })
    } catch (e) {
      toast({ title: 'Gagal membuka sesi', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsOpening(false)
    }
  }

  async function closeSession(s: SessionItem) {
    setClosingId(s.id)
    try {
      await apiSend('/api/sessions', 'PUT', { id: s.id, isActive: false })
      const refreshed = await apiGet<SessionItem[]>('/api/sessions')
      setSessions(refreshed)
      setCreatedSession((prev) => (prev?.id === s.id ? null : prev))
      toast({ title: 'Sesi ditutup', description: `Sesi kelas ${s.className} telah ditutup.` })
    } catch (e) {
      toast({ title: 'Gagal menutup sesi', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setClosingId(null)
    }
  }

  function setRecord(studentId: string, patch: Partial<RecordState>) {
    setRecords((prev) => {
      const base: RecordState = prev[studentId] ?? { status: 'HADIR', note: '' }
      return { ...prev, [studentId]: { ...base, ...patch } }
    })
  }

  async function saveAttendance() {
    if (sessionId === 'none' || !selectedSession) return
    if (students.length === 0) {
      toast({ title: 'Tidak ada santri', description: 'Kelas ini belum memiliki santri terdaftar.' })
      return
    }
    setIsSaving(true)
    try {
      await apiSend('/api/attendance', 'POST', {
        sessionId,
        records: students.map((s) => ({
          studentId: s.id,
          status: records[s.id]?.status ?? 'HADIR',
          note: records[s.id]?.note?.trim() || undefined,
        })),
      })
      toast({
        title: 'Absensi tersimpan',
        description: `Kehadiran ${students.length} santri dicatat. Notifikasi WhatsApp terkirim ke wali.`,
      })
      const [freshSessions, freshLog] = await Promise.all([
        apiGet<SessionItem[]>('/api/sessions'),
        apiGet<AttendanceRecord[]>('/api/attendance'),
      ])
      setSessions(freshSessions)
      setLog(freshLog)
    } catch (e) {
      toast({ title: 'Gagal menyimpan absensi', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsSaving(false)
    }
  }

  const sessionOptions = sessions.slice(0, 30)

  return (
    <div className="space-y-5">
      {error && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="size-4" />
          <AlertTitle>Gagal memuat data absensi</AlertTitle>
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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Panel kiri: Buka sesi */}
        <div className="space-y-4">
          <Card className="rounded-2xl border-stone-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <QrCode className="size-4 text-emerald-700" /> Buka Sesi Kelas
              </CardTitle>
              <CardDescription>Buat sesi kehadiran, sistem akan menutup sesi aktif kelas yang sama.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-1.5">
                <Label>Kelas</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="att-topic">Topik / Materi</Label>
                  <Input id="att-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Contoh: Tajwid Nun Mati" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="att-date">Tanggal</Label>
                  <Input id="att-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              <Button onClick={() => void openSession()} disabled={isOpening} className="w-full bg-emerald-700 hover:bg-emerald-800">
                {isOpening ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />} Buka Sesi &amp; Buat QR
              </Button>

              {createdSession && (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="rounded-xl bg-white p-2 shadow-sm">
                    <QRCodeSVG value={createdSession.code} size={128} />
                  </div>
                  <p className="font-mono text-2xl font-bold tracking-[0.3em] text-emerald-800">{createdSession.code}</p>
                  <p className="text-xs text-stone-500">
                    Sesi {createdSession.className} · {formatShortDate(createdSession.date)} — scan atau ketik kode untuk check-in
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => copyCode(createdSession.code)}>
                      <Copy className="size-3.5" /> Salin Kode
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => void closeSession(createdSession)}
                      disabled={closingId === createdSession.id}
                    >
                      {closingId === createdSession.id ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
                      Tutup Sesi
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-stone-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Sesi Aktif ({activeSessions.length})</CardTitle>
              <CardDescription>Sesi yang masih menerima check-in</CardDescription>
            </CardHeader>
            <CardContent>
              {activeSessions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-stone-200 py-6 text-center text-sm text-stone-500">
                  Tidak ada sesi aktif saat ini.
                </p>
              ) : (
                <ul className="max-h-64 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
                  {activeSessions.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-stone-800">{s.className}</p>
                          <Badge className="border-emerald-200 bg-emerald-100 text-[10px] text-emerald-800">AKTIF</Badge>
                        </div>
                        <p className="truncate text-xs text-stone-500">{s.topic || 'Tanpa topik'} · {formatShortDate(s.date)}</p>
                        <p className="mt-0.5 font-mono text-xs font-bold tracking-widest text-emerald-800">{s.code}</p>
                      </div>
                      <span className="shrink-0 text-xs text-stone-500">{s.hadir}/{s.total} hadir</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => void closeSession(s)}
                        disabled={closingId === s.id}
                      >
                        {closingId === s.id ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
                        Tutup
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Panel kanan: Catat kehadiran */}
        <Card className="rounded-2xl border-stone-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="size-4 text-emerald-700" /> Catat Kehadiran
            </CardTitle>
            <CardDescription>Pilih sesi lalu tandai status tiap santri.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Sesi</Label>
              <Select value={sessionId} onValueChange={setSessionId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Pilih sesi" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Pilih sesi —</SelectItem>
                  {sessionOptions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.className} · {formatShortDate(s.date)} {s.isActive ? '· AKTIF' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {sessionId === 'none' ? (
              <p className="rounded-xl border border-dashed border-stone-200 py-10 text-center text-sm text-stone-500">
                Pilih sesi untuk memuat daftar santri.
              </p>
            ) : loadingRoster ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-xl" />
                ))}
              </div>
            ) : students.length === 0 ? (
              <p className="rounded-xl border border-dashed border-stone-200 py-10 text-center text-sm text-stone-500">
                Kelas ini belum memiliki santri terdaftar.
              </p>
            ) : (
              <>
                <div className="max-h-96 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300">
                  {students.map((s) => {
                    const rec = records[s.id] ?? { status: 'HADIR' as AttStatus, note: '' }
                    return (
                      <div key={s.id} className="rounded-xl border border-stone-100 bg-stone-50/50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-stone-800">
                            {s.fullName} <span className="ml-1 font-mono text-[10px] text-stone-400">{s.nis}</span>
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {STATUSES.map((st) => (
                              <button
                                key={st.value}
                                type="button"
                                onClick={() => setRecord(s.id, { status: st.value })}
                                className={cn(
                                  'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                                  rec.status === st.value ? st.on : st.off
                                )}
                              >
                                {st.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        {(rec.status === 'IZIN' || rec.status === 'SAKIT') && (
                          <Input
                            value={rec.note}
                            onChange={(e) => setRecord(s.id, { note: e.target.value })}
                            placeholder={rec.status === 'IZIN' ? 'Keterangan izin (opsional)' : 'Keterangan sakit (opsional)'}
                            className="mt-2 h-8 rounded-lg bg-white text-xs"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
                <Button onClick={() => void saveAttendance()} disabled={isSaving} className="w-full bg-emerald-700 hover:bg-emerald-800">
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Simpan Absensi
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Log kehadiran terbaru */}
      <Card className="rounded-2xl border-stone-200 py-0 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <div className="flex items-center gap-2">
            <History className="size-4 text-emerald-700" />
            <h3 className="font-semibold text-stone-900">Riwayat Kehadiran Terbaru</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} /> Muat Ulang
          </Button>
        </div>
        {loading ? (
          <div className="p-4"><Skeleton className="h-48 rounded-xl" /></div>
        ) : log.length === 0 ? (
          <p className="px-4 pb-6 pt-2 text-center text-sm text-stone-500">Belum ada catatan kehadiran.</p>
        ) : (
          <div className="p-4 pt-2">
            <div className="overflow-x-auto">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="bg-stone-50/60 hover:bg-stone-50/60">
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Kelas</TableHead>
                    <TableHead>Santri</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {log.slice(0, 20).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm text-stone-600">{formatShortDate(r.createdAt)}</TableCell>
                      <TableCell className="text-sm text-stone-600">{r.className ?? '—'}</TableCell>
                      <TableCell className="text-sm font-medium text-stone-800">{r.student.fullName}</TableCell>
                      <TableCell><Badge className={statusBadgeClass(r.status)}>{r.status}</Badge></TableCell>
                      <TableCell className="max-w-52 truncate text-xs text-stone-500">{r.note ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
