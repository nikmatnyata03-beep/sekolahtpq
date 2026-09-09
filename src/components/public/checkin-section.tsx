'use client'

// Simulasi QR-Absensi — santri/wali memilih nama santri dan memasukkan kode
// sesi (sama dengan isi QR pada aplikasi mobile) → POST /api/attendance/checkin.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  RefreshCw,
  ScanLine,
  Users,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiSend, formatShortDate } from '@/lib/api-client'
import type { SessionItem, Student } from '@/lib/types'

type CheckinResult = { success?: boolean; already?: boolean; message?: string }

export function CheckinSection() {
  const { toast } = useToast()
  const [students, setStudents] = useState<Student[]>([])
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [studentId, setStudentId] = useState<string>('')
  const [code, setCode] = useState<string>('')
  const [checking, setChecking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [studentData, sessionData] = await Promise.all([
        apiGet<Student[]>('/api/students'),
        apiGet<SessionItem[]>('/api/sessions?active=1'),
      ])
      setStudents(Array.isArray(studentData) ? studentData : [])
      setSessions(Array.isArray(sessionData) ? sessionData : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data absensi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Kelompokkan santri berdasarkan kelas untuk Select bergrup
  const grouped = useMemo(() => {
    const map = new Map<string, Student[]>()
    for (const student of students) {
      const key = student?.class?.name ?? 'Tanpa Kelas'
      const list = map.get(key) ?? []
      list.push(student)
      map.set(key, list)
    }
    return Array.from(map.entries())
  }, [students])

  const activeStudent = students.find((s) => s.id === studentId)

  const handleCheckin = async () => {
    if (!studentId) {
      toast({
        title: 'Santri Belum Dipilih',
        description: 'Silakan pilih nama santri terlebih dahulu.',
        variant: 'destructive',
      })
      return
    }
    if (!code.trim()) {
      toast({
        title: 'Kode Kosong',
        description: 'Masukkan kode kehadiran yang tampil pada sesi kelas.',
        variant: 'destructive',
      })
      return
    }
    setChecking(true)
    try {
      const result = await apiSend<CheckinResult>('/api/attendance/checkin', 'POST', {
        code: code.trim().toUpperCase(),
        studentId,
      })
      if (result?.already) {
        toast({
          title: 'Sudah Terabsen',
          description: result.message ?? 'Santri ini sudah tercatat pada sesi ini.',
        })
      } else {
        toast({
          title: 'Check-in Berhasil',
          description: result?.message ?? 'Kehadiran santri tercatat HADIR.',
        })
      }
      setCode('')
      // Refresh daftar sesi agar jumlah hadir terbarui
      try {
        const sessionData = await apiGet<SessionItem[]>('/api/sessions?active=1')
        setSessions(Array.isArray(sessionData) ? sessionData : [])
      } catch {
        // refresh gagal — biarkan data lama
      }
    } catch (err) {
      toast({
        title: 'Check-in Gagal',
        description: err instanceof Error ? err.message : 'Kode tidak valid atau santri tidak terdaftar di sesi ini.',
        variant: 'destructive',
      })
    } finally {
      setChecking(false)
    }
  }

  return (
    <section id="checkin" className="scroll-mt-20 bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        {/* Heading */}
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="mb-3 inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-amber-700">
            Absensi Digital
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-stone-800">Cek-in Absensi Santri</h2>
          <p className="mt-3 text-muted-foreground">
            Rekam kehadiran santri dengan kode sesi — otomatis tercatat dan wali santri menerima
            notifikasi WhatsApp.
          </p>
        </div>

        {/* Info box QR */}
        <Alert className="mx-auto mb-8 max-w-3xl rounded-2xl border-emerald-200 bg-emerald-50/70 text-emerald-900">
          <Info className="size-4 text-emerald-700" />
          <AlertTitle className="text-emerald-900">Simulasi Absensi QR</AlertTitle>
          <AlertDescription className="text-emerald-800/80">
            Pada aplikasi mobile, santri memindai QR Code yang ditayangkan ustadz/ustadzah di kelas.
            Di portal web ini, kode yang sama cukup diketik manual pada kolom &quot;kode kehadiran&quot;.
          </AlertDescription>
        </Alert>

        {/* Error */}
        {error && (
          <div className="mx-auto mb-8 flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertCircle className="size-6 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
            <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100" onClick={() => void load()}>
              <RefreshCw className="size-4" />
              Coba Lagi
            </Button>
          </div>
        )}

        {loading && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        )}

        {!loading && !error && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* ===== Form check-in ===== */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
              <h3 className="flex items-center gap-2 text-lg font-bold text-stone-800">
                <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <ScanLine className="size-4.5" />
                </span>
                Form Check-in
              </h3>

              {students.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-8 text-center">
                  <Users className="mx-auto size-10 text-stone-300" />
                  <p className="mt-3 text-sm text-stone-500">
                    Belum ada data santri. Hubungi administrasi TPQ untuk pendaftaran.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="checkin-student">Pilih Santri</Label>
                    <Select value={studentId} onValueChange={setStudentId}>
                      <SelectTrigger id="checkin-student" className="w-full" aria-label="Pilih santri">
                        <SelectValue placeholder="— Pilih nama santri —" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {grouped.map(([className, list]) => (
                          <SelectGroup key={className}>
                            <SelectLabel className="text-xs font-bold text-emerald-700">
                              Kelas {className}
                            </SelectLabel>
                            {list.map((student) => (
                              <SelectItem key={student.id} value={student.id}>
                                {student.fullName} · {student.nis}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                    {activeStudent?.class && (
                      <p className="text-xs text-stone-500">
                        Kelas <span className="font-semibold text-emerald-700">{activeStudent.class.name}</span>
                        {activeStudent.class.schedule ? ` • ${activeStudent.class.schedule}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="checkin-code">Kode Kehadiran</Label>
                    <Input
                      id="checkin-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          void handleCheckin()
                        }
                      }}
                      placeholder="cth. DJ-IQRA1-A1B2"
                      className="font-mono tracking-widest uppercase"
                      aria-label="Kode kehadiran sesi"
                    />
                    <p className="text-xs text-stone-400">
                      Kode tampil pada kartu sesi aktif di samping / QR kelas.
                    </p>
                  </div>

                  <Button
                    type="button"
                    size="lg"
                    className="w-full bg-emerald-700 font-semibold shadow-md hover:bg-emerald-800"
                    disabled={checking}
                    onClick={() => void handleCheckin()}
                  >
                    {checking ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Memproses…
                      </>
                    ) : (
                      <>
                        <ScanLine className="size-4" />
                        Check-in Sekarang
                      </>
                    )}
                  </Button>

                  <p className="text-center text-xs text-stone-400">
                    Wali santri akan menerima notifikasi WhatsApp setelah check-in berhasil.
                  </p>
                </div>
              )}
            </div>

            {/* ===== Sesi aktif ===== */}
            <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-6 shadow-sm md:p-8">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-lg font-bold text-stone-800">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Clock className="size-4.5" />
                  </span>
                  Sesi Aktif Hari Ini
                </h3>
                <Button size="sm" variant="ghost" className="text-emerald-700 hover:bg-emerald-50" onClick={() => void load()}>
                  <RefreshCw className="size-4" />
                  Muat Ulang
                </Button>
              </div>

              {sessions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
                  <Clock className="mx-auto size-10 text-stone-300" />
                  <p className="mt-3 text-sm text-stone-500">
                    Belum ada sesi kelas yang dibuka. Kode check-in akan muncul di sini saat ustadz
                    memulai sesi.
                  </p>
                </div>
              ) : (
                <div className="max-h-96 space-y-3 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-200 [&::-webkit-scrollbar-track]:bg-transparent">
                  {sessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setCode(session.code)}
                      className="flex w-full flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-stone-800">{session.className}</span>
                        <Badge className="border-transparent bg-emerald-700 font-mono text-[11px] tracking-widest text-white">
                          {session.code}
                        </Badge>
                      </div>
                      {session.topic && (
                        <p className="text-sm text-stone-600">
                          <span className="font-medium text-emerald-800">Materi: </span>
                          {session.topic}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3 text-amber-500" />
                          {formatShortDate(session.date)}
                        </span>
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="size-3" />
                          {session.hadir}/{session.total} hadir
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                          Sesi Terbuka
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <p className="mt-4 text-xs leading-relaxed text-stone-400">
                Tips: klik kartu sesi untuk mengisi kode otomatis, lalu pilih nama santri dan tekan
                &quot;Check-in Sekarang&quot;.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
