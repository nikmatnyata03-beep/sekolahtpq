'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarCheck,
  ClipboardList,
  Download,
  Inbox,
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
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Progress } from '@/components/ui/progress'
import { statusBadgeClass, downloadCsv } from './overview'

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

// ==== Rekap Absensi Bulanan (Task 16-b) ====
// GET /api/attendance?classId= → AttendanceRecord[] (session dilepas API, take 200 —
// bucketing bulan memakai prefix createdAt "YYYY-MM", kompromi yang sama dengan student-detail-drawer.tsx).
const STATUS_COUNT_KEY: Record<AttStatus, 'hadir' | 'izin' | 'sakit' | 'alpa'> = {
  HADIR: 'hadir',
  IZIN: 'izin',
  SAKIT: 'sakit',
  ALPA: 'alpa',
}

// Titik warna chip — konsisten dengan STATUS_DOTS di overview.tsx.
const RECAP_CHIPS: { status: AttStatus; label: string; dot: string }[] = [
  { status: 'HADIR', label: 'Hadir', dot: 'bg-emerald-500' },
  { status: 'IZIN', label: 'Izin', dot: 'bg-amber-500' },
  { status: 'SAKIT', label: 'Sakit', dot: 'bg-orange-500' },
  { status: 'ALPA', label: 'Alpa', dot: 'bg-red-500' },
]

// Ambang sama dengan grade-badge: >=85 emerald, >=70 amber, selainnya merah.
function recapPctBadgeClass(pct: number): string {
  if (pct >= 85) return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  if (pct >= 70) return 'border-amber-200 bg-amber-100 text-amber-800'
  return 'border-red-200 bg-red-100 text-red-700'
}

// "83,3" — desimal koma id-ID, dibulatkan 1 tempat desimal (dipakai tabel & kolom CSV).
function formatPct(pct: number): string {
  return pct.toLocaleString('id-ID', { maximumFractionDigits: 1 })
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('')
}

interface RecapRow {
  student: Student
  hadir: number
  izin: number
  sakit: number
  alpa: number
  pct: number
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

  // Rekap absensi bulanan
  const [recapClassId, setRecapClassId] = useState('none')
  const [recapMonth, setRecapMonth] = useState('none')
  const [recapData, setRecapData] = useState<{ records: AttendanceRecord[]; roster: Student[] } | null>(null)
  const [recapLoading, setRecapLoading] = useState(false)
  const [recapError, setRecapError] = useState<string | null>(null)
  const [recapRetry, setRecapRetry] = useState(0)

  const activeSessions = sessions.filter((s) => s.isActive)
  const selectedSession = sessions.find((s) => s.id === sessionId) ?? null

  // Opsi 6 bulan terakhir — dihitung SEKALI per mount (tidak dibaca ulang wall-clock saat render hasil).
  const monthOptions = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      return {
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
      }
    })
  }, [])

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

  // Muat rekap (satu effect, Promise.all) saat kelas + bulan lengkap dipilih
  useEffect(() => {
    if (recapClassId === 'none' || recapMonth === 'none') {
      setRecapData(null)
      setRecapError(null)
      return
    }
    let cancelled = false
    async function loadRecap() {
      setRecapLoading(true)
      setRecapError(null)
      try {
        const [records, roster] = await Promise.all([
          apiGet<AttendanceRecord[]>(`/api/attendance?classId=${recapClassId}`),
          apiGet<Student[]>(`/api/students?classId=${recapClassId}`),
        ])
        if (cancelled) return
        setRecapData({ records, roster })
      } catch (e) {
        if (cancelled) return
        setRecapData(null)
        setRecapError(e instanceof Error ? e.message : 'Gagal memuat rekap absensi')
      } finally {
        if (!cancelled) setRecapLoading(false)
      }
    }
    void loadRecap()
    return () => {
      cancelled = true
    }
  }, [recapClassId, recapMonth, recapRetry])

  // Agregasi klien: filter catatan bulan terpilih (prefix createdAt YYYY-MM),
  // hitung per status per santri; total pertemuan = jumlah sessionId unik bulan itu.
  const recap = useMemo(() => {
    if (!recapData) return null
    const monthRecords = recapData.records.filter((r) => r.createdAt.slice(0, 7) === recapMonth)
    const perStudent: Record<string, { hadir: number; izin: number; sakit: number; alpa: number }> = {}
    const sessionIds = new Set<string>()
    const totals: Record<AttStatus, number> = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPA: 0 }
    for (const r of monthRecords) {
      totals[r.status] += 1
      sessionIds.add(r.sessionId)
      const agg = perStudent[r.studentId] ?? { hadir: 0, izin: 0, sakit: 0, alpa: 0 }
      agg[STATUS_COUNT_KEY[r.status]] += 1
      perStudent[r.studentId] = agg
    }
    const pertemuan = sessionIds.size
    const rows: RecapRow[] = [...recapData.roster]
      .sort(
        (a, b) =>
          (a.status === 'AKTIF' ? 0 : 1) - (b.status === 'AKTIF' ? 0 : 1) ||
          a.fullName.localeCompare(b.fullName)
      )
      .map((student) => {
        const c = perStudent[student.id] ?? { hadir: 0, izin: 0, sakit: 0, alpa: 0 }
        return { student, ...c, pct: pertemuan > 0 ? Math.round((c.hadir / pertemuan) * 1000) / 10 : 0 }
      })
    return {
      totals,
      pertemuan,
      rows,
      rate: monthRecords.length > 0 ? Math.round((totals.HADIR / monthRecords.length) * 1000) / 10 : 0,
    }
  }, [recapData, recapMonth])

  function exportRecapCsv() {
    if (!recap || recap.pertemuan === 0 || recap.rows.length === 0) return
    const kelas = classes.find((c) => c.id === recapClassId)
    const slug =
      (kelas?.name ?? 'kelas')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'kelas'
    const filename = `rekap-absensi-${slug}-${recapMonth}.csv`
    const rows: string[][] = [
      ['NIS', 'Nama', 'Kelas', 'Hadir', 'Izin', 'Sakit', 'Alpa', 'Total Pertemuan', 'Persentase Hadir (%)'],
      ...recap.rows.map((r) => [
        r.student.nis,
        r.student.fullName,
        kelas?.name ?? r.student.class?.name ?? '',
        String(r.hadir),
        String(r.izin),
        String(r.sakit),
        String(r.alpa),
        String(recap.pertemuan),
        formatPct(r.pct),
      ]),
    ]
    // downloadCsv menerapkan csvCell ke SETIAP sel (idiom hafalan-admin: ';', BOM, escape kutip ganda).
    downloadCsv(filename, rows)
    toast({
      title: 'Ekspor CSV berhasil',
      description: `Rekap ${recap.rows.length} santri tersimpan di ${filename}.`,
    })
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

      {/* Rekap absensi bulanan */}
      <Card className="rounded-2xl border-stone-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <BarChart3 className="size-5" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">Rekap Absensi Bulanan</CardTitle>
              <CardDescription>Ringkasan per santri dari catatan kehadiran kelas</CardDescription>
            </div>
          </div>
          <CardAction>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={exportRecapCsv}
              disabled={!recap || recap.pertemuan === 0 || recap.rows.length === 0}
              aria-label="Unduh rekap CSV"
            >
              <Download className="size-4" /> Unduh CSV
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={recapClassId} onValueChange={setRecapClassId}>
              <SelectTrigger aria-label="Kelas rekap absensi" className="min-h-11 w-full sm:w-60">
                <SelectValue placeholder="Pilih kelas" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={recapMonth} onValueChange={setRecapMonth}>
              <SelectTrigger aria-label="Bulan rekap absensi" className="min-h-11 w-full sm:w-60">
                <SelectValue placeholder="Pilih bulan" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {recapClassId === 'none' || recapMonth === 'none' ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-200 py-10 text-center">
              <ClipboardList className="size-8 text-stone-300" />
              <p className="text-sm text-stone-500">Pilih kelas dan bulan untuk melihat rekap</p>
            </div>
          ) : recapError ? (
            <Alert variant="destructive" className="rounded-2xl">
              <AlertCircle className="size-4" />
              <AlertTitle>Gagal memuat rekap absensi</AlertTitle>
              <AlertDescription>
                {recapError}
                <div className="mt-3">
                  <Button size="sm" variant="outline" onClick={() => setRecapRetry((t) => t + 1)}>
                    <RefreshCw className="size-4" /> Coba Lagi
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : recapLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : !recap || recap.pertemuan === 0 || recap.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-200 py-10 text-center">
              <Inbox className="size-8 text-stone-300" />
              <p className="text-sm text-stone-500">Belum ada catatan kehadiran pada bulan ini</p>
            </div>
          ) : (
            <>
              {/* Ringkasan bulan */}
              <div aria-live="polite" className="flex flex-wrap gap-2">
                {RECAP_CHIPS.map((chip) => (
                  <div key={chip.status} className="flex items-center gap-2.5 rounded-xl border border-stone-100 bg-stone-50/60 px-3 py-2">
                    <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', chip.dot)} />
                    <div>
                      <p className="text-lg font-bold leading-none text-stone-900">{recap.totals[chip.status]}</p>
                      <p className="mt-0.5 text-xs text-stone-500">{chip.label}</p>
                    </div>
                  </div>
                ))}
                <div className="min-w-44 flex-1 rounded-xl border border-stone-100 bg-stone-50/60 px-3 py-2 sm:min-w-56">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-stone-500">Tingkat Kehadiran</p>
                    <p className="text-lg font-bold leading-none text-stone-900">{formatPct(recap.rate)}%</p>
                  </div>
                  <Progress
                    value={recap.rate}
                    aria-label="Tingkat kehadiran bulan ini"
                    className="mt-2 h-2 bg-stone-200 [&>div]:bg-emerald-600"
                  />
                </div>
              </div>

              {/* Tabel per santri — kontainer tabel (data-slot) menjadi area scroll agar thead sticky bekerja */}
              <div className="[&_[data-slot=table-container]]:max-h-80 [&_[data-slot=table-container]]:overflow-y-auto [&_[data-slot=table-container]]:pr-1 [&_[data-slot=table-container]]:[scrollbar-width:thin] [&_[data-slot=table-container]::-webkit-scrollbar]:w-1.5 [&_[data-slot=table-container]::-webkit-scrollbar-thumb]:rounded-full [&_[data-slot=table-container]::-webkit-scrollbar-thumb]:bg-stone-300">
                <Table className="min-w-[640px]">
                  <TableHeader className="sticky top-0 z-10 bg-white">
                    <TableRow className="bg-white hover:bg-white">
                      <TableHead className="sticky top-0 z-10 bg-white">Santri</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-white text-center">Hadir</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-white text-center">Izin</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-white text-center">Sakit</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-white text-center">Alpa</TableHead>
                      <TableHead className="sticky top-0 z-10 bg-white text-right">% Hadir</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recap.rows.map((row) => (
                      <TableRow key={row.student.id} className="hover:bg-stone-50/60">
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <span
                              aria-hidden="true"
                              className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800"
                            >
                              {initials(row.student.fullName)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-stone-800">{row.student.fullName}</p>
                              <p className="font-mono text-[10px] text-stone-400">{row.student.nis}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm font-semibold text-stone-700">{row.hadir}</TableCell>
                        <TableCell className="text-center text-sm text-stone-600">{row.izin}</TableCell>
                        <TableCell className="text-center text-sm text-stone-600">{row.sakit}</TableCell>
                        <TableCell className="text-center text-sm text-stone-600">{row.alpa}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={recapPctBadgeClass(row.pct)}>{formatPct(row.pct)}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
