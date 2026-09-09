'use client'

// Guru landing view (Task 10-a) — role-specific "Ringkasan" for GURU.
// Reuses existing GET APIs: /api/classes, /api/sessions?active=1, /api/hafalan, /api/students.
// Ownership filtering is client-side: classes by teacherId, then sessions/students by classId
// and hafalan by studentId of those students.
// Task 15-a: "Catat Setoran Cepat" Sheet dari kartu Progres Target — POST /api/hafalan
// tanpa berpindah halaman (kontrak respons targetJustReached dari Task 14-a).

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  BookMarked,
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Copy,
  Crosshair,
  GraduationCap,
  Inbox,
  Loader2,
  PencilLine,
  QrCode,
  RefreshCw,
  Target,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { AuthUser, ClassRoom, Hafalan, SessionItem, Student } from '@/lib/types'
import { apiGet, apiSend, formatShortDate } from '@/lib/api-client'
import { JUZ30_SURAHS, targetProgress, type TargetProgress } from '@/lib/hafalan-utils'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WeeklySchedule } from './weekly-schedule'

export type GuruOverviewSection = 'attendance' | 'hafalan' | 'classes'

interface GuruData {
  classes: ClassRoom[]
  sessions: SessionItem[]
  hafalans: Hafalan[]
  students: Student[]
}

const HAFALAN_TYPE: Record<Hafalan['type'], { label: string; badge: string }> = {
  TAHFIDZ: { label: 'Tahfidz', badge: 'border-emerald-200 bg-emerald-100 text-emerald-800' },
  TAHSHIN: { label: 'Tahsin', badge: 'border-teal-200 bg-teal-100 text-teal-800' },
  MURAJAAH: { label: 'Murajaah', badge: 'border-amber-200 bg-amber-100 text-amber-800' },
}

function gradeBadgeClass(grade: number): string {
  if (grade >= 85) return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  if (grade >= 70) return 'border-amber-200 bg-amber-100 text-amber-800'
  return 'border-red-200 bg-red-100 text-red-700'
}

// Inisial nama untuk avatar (maks 2 huruf) — pola avatar inisial portal lain.
function initialsOf(name: string): string {
  const parts = name.split(' ').filter(Boolean).slice(0, 2)
  return parts.map((w) => w[0]?.toUpperCase() ?? '').join('') || '?'
}

// Relative time in Indonesian — same helper pattern as whatsapp-log.tsx / parent-portal.tsx.
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} hari lalu`
  return formatShortDate(iso)
}

// Thin scrollbar utility — same treatment as overview.tsx scroll areas.
const SCROLL_AREA =
  'pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-stone-300'

// Mobile-polished KPI card — adapted from overview.tsx (tight padding/icon/value on <sm).
function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  iconClass,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint: string
  iconClass: string
}) {
  return (
    <Card className="rounded-2xl border-stone-200 shadow-sm">
      <CardContent className="flex items-start gap-2.5 p-3 sm:gap-3 sm:p-4">
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10', iconClass)}>
          <Icon className="size-4 sm:size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-stone-500">{label}</p>
          <p className="truncate text-lg font-bold text-stone-900 sm:text-xl">{value}</p>
          <p className="mt-0.5 hidden text-[11px] text-stone-400 sm:block">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function GreetingHero({ user, onNavigate }: { user: AuthUser; onNavigate?: (section: GuruOverviewSection) => void }) {
  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-900 p-5 text-white shadow-sm sm:p-6">
      <BookOpen className="pointer-events-none absolute -bottom-6 -right-4 size-32 text-white/5" aria-hidden="true" />
      <div className="relative">
        <p suppressHydrationWarning className="text-xs text-emerald-100/80 sm:text-sm">
          {todayLabel}
        </p>
        <h2 className="mt-1.5 text-lg font-bold sm:text-2xl">Assalamu&rsquo;alaikum, {user.name}</h2>
        <p className="mt-1 max-w-xl text-sm text-emerald-100/90">
          Semoga barokah hari ini dalam mendidik generasi Qur&rsquo;ani.
        </p>
        {onNavigate && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              className="h-11 bg-amber-400 text-emerald-950 hover:bg-amber-300"
              onClick={() => onNavigate('attendance')}
            >
              <CalendarCheck className="size-4" /> Buka Absensi
            </Button>
            <Button
              variant="outline"
              className="h-11 border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              onClick={() => onNavigate('hafalan')}
            >
              <BookMarked className="size-4" /> Catat Hafalan
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ==== Quick Setoran (Task 15-a) — sheet catat setoran dari kartu Progres Target ====

// Respons POST /api/hafalan (kontrak Task 14-a): baris baru + status perayaan target.
type QuickHafalanResponse = Hafalan & { targetJustReached?: boolean; targetName?: string | null }

const QUICK_TYPES: ReadonlyArray<{ value: Hafalan['type']; label: string }> = [
  { value: 'TAHFIDZ', label: 'Tahfidz' },
  { value: 'TAHSHIN', label: 'Tahsin' },
  { value: 'MURAJAAH', label: 'Murajaah' },
]

// Sheet "Catat Setoran Cepat": header santri (avatar inisial, kelas, chip target amber
// dengan reached/position) + formulir ringkas. Pola Sheet mengikuti
// student-detail-drawer.tsx (side kanan, sm:max-w-md, header stone-50/60).
function QuickSetoranSheet({ student, tp, open, onOpenChange, onSaved }: {
  student: Student | null
  tp: TargetProgress | null
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [surahName, setSurahName] = useState('')
  const [ayatRange, setAyatRange] = useState('')
  const [type, setType] = useState<Hafalan['type']>('TAHFIDZ')
  const [grade, setGrade] = useState('')
  const [teacherNote, setTeacherNote] = useState('')
  const [surahTouched, setSurahTouched] = useState(false)
  const [ayatTouched, setAyatTouched] = useState(false)
  const [pending, setPending] = useState(false)

  // Formulir bersih setiap kali sheet dibuka untuk seorang santri (pola reset
  // per-open ala student-detail-drawer; state tetap tampil selama animasi tutup).
  useEffect(() => {
    if (!open || !student) return
    setSurahName('')
    setAyatRange('')
    setType('TAHFIDZ')
    setGrade('')
    setTeacherNote('')
    setSurahTouched(false)
    setAyatTouched(false)
    setPending(false)
  }, [open, student?.id])

  const surah = surahName.trim()
  const ayat = ayatRange.trim()
  const canSubmit = surah !== '' && ayat !== '' && !pending

  async function submit() {
    if (!student || !canSubmit) return
    const rawGrade = Number(grade)
    setPending(true)
    try {
      const created = await apiSend<QuickHafalanResponse>('/api/hafalan', 'POST', {
        studentId: student.id,
        surahName: surah,
        ayatRange: ayat,
        type,
        grade:
          grade.trim() === '' || !Number.isFinite(rawGrade)
            ? undefined
            : Math.min(100, Math.max(0, Math.round(rawGrade))),
        teacherNote: teacherNote.trim() || undefined,
      })
      if (created.targetJustReached && created.targetName) {
        // Setoran ini MENYEMPURNAKAN target santri untuk pertama kali (kontrak Task 14-a).
        toast({
          title: '🎉 Target tercapai!',
          description: `MasyaAllah! ${student.fullName} menyempurnakan target ${created.targetName}.`,
        })
      } else {
        toast({
          title: 'Setoran tercatat',
          description: `${student.fullName} — QS ${surah} ${ayat}.`,
        })
      }
      onOpenChange(false)
      onSaved()
    } catch (e) {
      // Gagal: sheet tetap terbuka agar isian tidak hilang.
      toast({ title: 'Gagal', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-stone-100 bg-stone-50/60 p-4 text-left">
          <SheetTitle className="text-base text-stone-800">Catat Setoran Cepat</SheetTitle>
          <SheetDescription className="sr-only">
            Formulir pencatatan setoran hafalan tanpa keluar dari ringkasan guru.
          </SheetDescription>
          {student && (
            <div className="mt-1 flex items-start gap-3 pr-6">
              <div
                aria-hidden="true"
                className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-700 text-sm font-semibold text-white"
              >
                {initialsOf(student.fullName)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-800">{student.fullName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800"
                  >
                    {student.class?.name ?? 'Tanpa kelas'}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="gap-1 border-amber-200 bg-amber-100 text-[10px] text-amber-800"
                  >
                    <Target className="size-2.5" aria-hidden="true" />
                    Target:{' '}
                    {tp ? `${tp.targetName} · ${tp.reached}/${tp.position}` : (student.hafalanTarget ?? '—')}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </SheetHeader>

        <form
          onSubmit={(e) => { e.preventDefault(); void submit() }}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="quick-surah">Nama Surah *</Label>
            <Input
              id="quick-surah"
              list="quick-surah-list"
              value={surahName}
              onChange={(e) => { setSurahName(e.target.value); setSurahTouched(true) }}
              placeholder="Ketik atau pilih surah…"
              autoComplete="off"
              className="min-h-11"
            />
            <datalist id="quick-surah-list">
              {JUZ30_SURAHS.map((s) => (
                <option key={s.no} value={s.name} />
              ))}
            </datalist>
            <div aria-live="polite">
              {surahTouched && surah === '' && (
                <p className="text-xs font-medium text-amber-700">Nama surah wajib diisi.</p>
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="quick-ayat">Rentang Ayat *</Label>
            <Input
              id="quick-ayat"
              value={ayatRange}
              onChange={(e) => { setAyatRange(e.target.value); setAyatTouched(true) }}
              placeholder="1-7"
              className="min-h-11"
            />
            <div aria-live="polite">
              {ayatTouched && ayat === '' && (
                <p className="text-xs font-medium text-amber-700">Rentang ayat wajib diisi.</p>
              )}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="quick-type">Jenis Setoran</Label>
            <Select value={type} onValueChange={(v) => setType(v as Hafalan['type'])}>
              <SelectTrigger id="quick-type" className="w-full min-h-11">
                <SelectValue placeholder="Pilih jenis" />
              </SelectTrigger>
              <SelectContent>
                {QUICK_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="quick-grade">Nilai (opsional)</Label>
            <Input
              id="quick-grade"
              type="number"
              min={0}
              max={100}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="85"
              className="min-h-11"
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="quick-note">Catatan ustadz (opsional)</Label>
            <Textarea
              id="quick-note"
              rows={2}
              value={teacherNote}
              onChange={(e) => setTeacherNote(e.target.value)}
              placeholder="Masukan tajwid, kelancaran, dsb."
            />
          </div>

          <Button
            type="submit"
            disabled={!canSubmit}
            className="mt-1 min-h-11 w-full bg-emerald-700 text-white hover:bg-emerald-800"
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <BookMarked className="size-4" />} Simpan
            Setoran
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export function GuruOverview({ user, onNavigate }: {
  user: AuthUser
  onNavigate?: (section: GuruOverviewSection) => void
}) {
  const { toast } = useToast()
  const mountedRef = useRef(true)
  const [data, setData] = useState<GuruData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Quick Setoran (Task 15-a): id santri yang sheet-nya terbuka (null = tertutup).
  const [quickStudentId, setQuickStudentId] = useState<string | null>(null)

  // quiet=true (Task 15-a): segarkan data TANPA skeleton/error penuh — dipakai
  // setelah simpan setoran cepat agar bar kartu Progres Target langsung update.
  const load = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoading(true)
      setError(null)
    }
    try {
      const [classes, sessions, hafalans, students] = await Promise.all([
        apiGet<ClassRoom[]>('/api/classes'),
        apiGet<SessionItem[]>('/api/sessions?active=1'),
        apiGet<Hafalan[]>('/api/hafalan'),
        apiGet<Student[]>('/api/students'),
      ])
      if (!mountedRef.current) return
      setData({ classes, sessions, hafalans, students })
    } catch (e) {
      if (!mountedRef.current) return
      if (quiet) return // refresh senyap: biarkan data lama tampil tanpa Alert penuh
      setError(e instanceof Error ? e.message : 'Gagal memuat data ringkasan')
    } finally {
      if (mountedRef.current && !quiet) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    void load()
    return () => {
      mountedRef.current = false
    }
  }, [load])

  function copyCode(code: string) {
    void navigator.clipboard
      ?.writeText(code)
      .then(() => toast({ title: 'Kode disalin', description: `Kode sesi ${code} siap dibagikan.` }))
      .catch(() => toast({ title: 'Gagal menyalin', description: 'Salin kode secara manual.' }))
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="rounded-2xl">
        <AlertCircle className="size-4" />
        <AlertTitle>Gagal memuat data ringkasan</AlertTitle>
        <AlertDescription>
          {error}
          <div className="mt-3">
            <Button variant="outline" className="h-11" onClick={() => void load()}>
              <RefreshCw className="size-4" /> Coba Lagi
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  if (!data) return null

  // ==== Client-side ownership filtering ====
  const ownClasses = data.classes.filter((c) => c.teacherId && c.teacherId === user.teacherId)
  const ownClassIds = new Set(ownClasses.map((c) => c.id))
  const ownSessions = data.sessions.filter((s) => ownClassIds.has(s.classId))
  const ownStudents = data.students.filter((st) => st.classId && ownClassIds.has(st.classId))
  const ownStudentCount = ownStudents.filter((st) => st.status === 'AKTIF').length
  const ownStudentIds = new Set(ownStudents.map((st) => st.id))
  const ownHafalan = data.hafalans.filter((h) => ownStudentIds.has(h.studentId))
  const hafalanCapped = data.hafalans.length >= 100
  const recentHafalan = ownHafalan.slice(0, 8)

  // ==== Progres target santri (Task 13-a) — murni dari state yang sudah dimuat ====
  const hafalanByStudent = new Map<string, Hafalan[]>()
  for (const h of ownHafalan) {
    const list = hafalanByStudent.get(h.studentId)
    if (list) list.push(h)
    else hafalanByStudent.set(h.studentId, [h])
  }
  // Satu baris per santri kelas sendiri yang PUNYA target valid di peta Juz 30.
  const targetRows = ownStudents
    .flatMap((st) => {
      const tp = targetProgress(hafalanByStudent.get(st.id) ?? [], st.hafalanTarget)
      return tp ? [{ st, tp }] : []
    })
    .sort(
      (a, b) =>
        Number(b.tp.targetReached) - Number(a.tp.targetReached) || b.tp.percent - a.tp.percent,
    )

  // Quick Setoran (Task 15-a): santri + progres sheet diturunkan dari data TERKINI
  // (bukan snapshot), sehingga otomatis segar setiap kali load() menyegarkan state.
  const quickStudent = quickStudentId
    ? (data.students.find((s) => s.id === quickStudentId) ?? null)
    : null
  const quickTp = quickStudent
    ? targetProgress(hafalanByStudent.get(quickStudent.id) ?? [], quickStudent.hafalanTarget)
    : null

  // Belum ada penugasan kelas → hero saja + kartu sapaan kosong.
  if (!user.teacherId || ownClasses.length === 0) {
    return (
      <div className="space-y-5">
        <GreetingHero user={user} />
        <Card className="rounded-2xl border-stone-200 shadow-sm">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <GraduationCap className="size-7" />
            </div>
            <p className="text-base font-semibold text-stone-800">
              Anda belum ditugaskan sebagai pengajar kelas
            </p>
            <p className="max-w-md text-sm text-stone-500">
              Hubungi admin untuk penugasan mengajar. Data ringkasan akan tampil setelah kelas ditugaskan.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <GreetingHero user={user} onNavigate={onNavigate} />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard
          icon={BookOpen}
          label="Kelas Saya"
          value={String(ownClasses.length)}
          hint="Kelas yang Anda ampu"
          iconClass="bg-emerald-100 text-emerald-700"
        />
        <KpiCard
          icon={Users}
          label="Santri Saya"
          value={String(ownStudentCount)}
          hint="Santri AKTIF di kelas Anda"
          iconClass="bg-amber-100 text-amber-700"
        />
        <KpiCard
          icon={QrCode}
          label="Sesi Aktif"
          value={String(ownSessions.length)}
          hint="Check-in sedang berlangsung"
          iconClass="bg-teal-100 text-teal-700"
        />
        <KpiCard
          icon={BookMarked}
          label="Setoran Hafalan"
          value={String(ownHafalan.length)}
          hint={hafalanCapped ? 'Dari 100 terakhir' : 'Tercatat di kelas Anda'}
          iconClass="bg-stone-100 text-stone-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sesi aktif kelas saya */}
        <Card className="rounded-2xl border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="size-4 text-emerald-700" /> Sesi Aktif Kelas Saya
            </CardTitle>
            <CardDescription>Kode &amp; QR check-in kelas yang Anda ampu</CardDescription>
          </CardHeader>
          <CardContent>
            {ownSessions.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-stone-200 py-8 text-center">
                <QrCode className="size-7 text-stone-300" />
                <p className="text-sm text-stone-500">Belum ada sesi aktif untuk kelas Anda</p>
                {onNavigate && (
                  <Button
                    className="mt-2 h-11 bg-emerald-700 text-white hover:bg-emerald-800"
                    onClick={() => onNavigate('attendance')}
                  >
                    <CalendarCheck className="size-4" /> Buat Sesi
                  </Button>
                )}
              </div>
            ) : (
              <div className={cn('max-h-72 space-y-3 overflow-y-auto', SCROLL_AREA)}>
                {ownSessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/60 p-3"
                  >
                    <div className="rounded-lg bg-white p-1.5 shadow-sm">
                      <QRCodeSVG value={s.code} size={56} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-stone-800">{s.className}</p>
                        <Badge className="border-emerald-200 bg-emerald-100 text-[10px] text-emerald-800">
                          AKTIF
                        </Badge>
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-800"
                        >
                          <Users className="size-3 text-emerald-600" /> {s.hadir}/{s.total} hadir
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-stone-500">{s.topic || 'Tanpa topik'}</p>
                      <div className="mt-1 flex items-baseline gap-2">
                        <p className="font-mono text-lg font-bold tracking-[0.25em] text-emerald-800">{s.code}</p>
                        <p className="shrink-0 text-[11px] text-stone-400">{formatShortDate(s.date)}</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-11 shrink-0"
                      onClick={() => copyCode(s.code)}
                      aria-label={`Salin kode sesi ${s.className}`}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Setoran hafalan terbaru */}
        <Card className="rounded-2xl border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <BookMarked className="size-4 text-emerald-700" /> Setoran Hafalan Terbaru
            </CardTitle>
            <CardDescription>Setoran terbaru santri kelas Anda</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentHafalan.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-stone-200 py-8 text-center">
                <Inbox className="size-7 text-stone-300" />
                <p className="text-sm text-stone-500">Belum ada setoran hafalan tercatat</p>
              </div>
            ) : (
              <ul className={cn('max-h-80 divide-y divide-stone-100 overflow-y-auto', SCROLL_AREA)}>
                {recentHafalan.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-stone-800">
                        {h.student?.fullName || 'Santri'}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-xs text-stone-500">
                          {h.surahName} {h.ayatRange}
                        </p>
                        <Badge className={cn('text-[10px]', HAFALAN_TYPE[h.type].badge)}>
                          {HAFALAN_TYPE[h.type].label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-stone-400">{timeAgo(h.createdAt)}</p>
                    </div>
                    <div className="shrink-0">
                      {h.grade === null ? (
                        <span className="text-xs text-stone-400" aria-label="Belum dinilai">
                          —
                        </span>
                      ) : (
                        <Badge className={gradeBadgeClass(h.grade)}>{h.grade}</Badge>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {onNavigate && (
              <Button
                variant="outline"
                className="h-11 w-full border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900"
                onClick={() => onNavigate('hafalan')}
              >
                Lihat Semua / Catat Baru
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Jadwal mengajar mingguan — visual timetable from class schedules (Task 11-b) */}
      <WeeklySchedule classes={ownClasses} />

      {/* Progres Target Santri — nudge card (Task 13-a). Data memakai students+hafalans yang sudah dimuat. */}
      <Card className="rounded-2xl border-stone-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700"
              aria-hidden="true"
            >
              <Crosshair className="size-5" />
            </span>
            Progres Target Santri
          </CardTitle>
          <CardDescription>Ketekunan setoran dibanding target hafalan tiap santri.</CardDescription>
        </CardHeader>
        <CardContent>
          {targetRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 px-4 py-6 text-center">
              <p className="text-sm text-stone-500">
                Belum ada santri dengan target hafalan. Atur melalui menu Santri.
              </p>
            </div>
          ) : (
            <ul
              role="list"
              aria-label="Progres target hafalan santri"
              className={cn(
                'space-y-2.5',
                targetRows.length > 4 && 'max-h-64 overflow-y-auto',
                SCROLL_AREA,
              )}
            >
              {targetRows.map(({ st, tp }) => (
                <li
                  key={st.id}
                  role="listitem"
                  title={`${st.fullName} — target ${tp.targetName}, ${tp.reached}/${tp.position} surah`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-stone-100 bg-stone-50/60 p-3"
                >
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800"
                    aria-hidden="true"
                  >
                    {initialsOf(st.fullName)}
                  </span>
                  <div className="min-w-0 basis-36 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-800">{st.fullName}</p>
                    <p className="truncate text-xs text-stone-500">
                      {st.class?.name ?? 'Tanpa kelas'} · Target: {tp.targetName}
                    </p>
                  </div>
                  <div
                    role="progressbar"
                    aria-valuenow={tp.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Progres menuju target ${tp.targetName}: ${tp.percent}%`}
                    className="h-1.5 min-w-24 basis-28 flex-1 self-center rounded-full bg-stone-100"
                  >
                    <div
                      className="h-full rounded-full bg-amber-500 transition-[width]"
                      style={{ width: `${tp.percent}%` }}
                    />
                  </div>
                  <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-stone-600">
                    {tp.reached}/{tp.position}
                  </span>
                  {tp.targetReached || tp.percent >= 100 ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      <CheckCircle2 className="size-3" strokeWidth={2.5} aria-hidden="true" />
                      {tp.targetReached ? 'Target tercapai' : 'Tercapai'}
                    </span>
                  ) : tp.percent >= 60 ? (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      Mendekati
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                      Progres {tp.percent}%
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0 text-stone-400 hover:bg-emerald-100 hover:text-emerald-700"
                    onClick={() => setQuickStudentId(st.id)}
                    aria-label={`Catat setoran ${st.fullName}`}
                  >
                    <PencilLine className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Quick Setoran (Task 15-a) — dibuka dari tombol pensil per baris target di atas;
          onSaved memanggil load(true) (quiet) agar progres bar nudge card langsung segar. */}
      <QuickSetoranSheet
        student={quickStudent}
        tp={quickTp}
        open={quickStudentId !== null}
        onOpenChange={(o) => { if (!o) setQuickStudentId(null) }}
        onSaved={() => void load(true)}
      />
    </div>
  )
}
