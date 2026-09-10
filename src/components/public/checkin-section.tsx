'use client'

// Absensi QR dua arah + VALIDASI GPS (Task 33) — santri/wali memindai QR kelas
// (atau mengetik kode) → daftar santri kelas dimuat via /api/public/checkin-roster
// (kunci = kode sesi) → pilih nama → POST /api/attendance/checkin dgn GPS.
// HADIR hanya sah bila perangkat ≤ 20 m dari titik QR ustadz (server-side).

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  ScanLine,
  Users,
  X,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiSend, formatShortDate } from '@/lib/api-client'
import { getGpsFix, GpsUnavailableError, type GpsFix } from '@/lib/gps-client'
import type { SessionItem } from '@/lib/types'

type CheckinResult = { success?: boolean; already?: boolean; message?: string }
type RosterStudent = { id: string; fullName: string; nis: string }
type RosterPayload = {
  session: { id: string; className: string; classLevel?: string; topic?: string | null; date?: string }
  students: RosterStudent[]
}

/** Ambil kode sesi dari hasil scan — QR berisi URL (?absen=KODE) maupun kode polos. */
function extractCode(decoded: string): string {
  try {
    const url = new URL(decoded)
    const absen = url.searchParams.get('absen')
    if (absen) return absen.toUpperCase()
  } catch {
    // bukan URL — perlakukan sebagai kode polos
  }
  return decoded.trim().toUpperCase()
}

export function CheckinSection() {
  const { toast } = useToast()
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [studentId, setStudentId] = useState<string>('')
  const [code, setCode] = useState<string>('')
  const [checking, setChecking] = useState(false)

  // ==== GPS wajib (Task 33) — diambil otomatis saat halaman dibuka ====
  const [gps, setGps] = useState<GpsFix | null>(null)
  const [gpsState, setGpsState] = useState<'locating' | 'ok' | 'error'>('locating')
  const [gpsError, setGpsError] = useState<string | null>(null)
  const acquireGps = useCallback(async () => {
    setGpsState('locating')
    setGpsError(null)
    try {
      const fix = await getGpsFix()
      setGps(fix)
      setGpsState('ok')
    } catch (e) {
      setGps(null)
      setGpsState('error')
      setGpsError(e instanceof GpsUnavailableError ? e.message : 'Lokasi gagal diambil. Coba lagi.')
    }
  }, [])
  useEffect(() => {
    void acquireGps()
  }, [acquireGps])

  // Daftar santri kelas (dari kode sesi) — bukan seluruh sekolah.
  const [roster, setRoster] = useState<RosterPayload | null>(null)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterError, setRosterError] = useState<string | null>(null)

  // ==== Pemindai QR kamera (html5-qrcode, lazy-load saat tombol ditekan) ====
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => Promise<void> } | null>(null)
  const SCANNER_DIV = 'checkin-qr-reader'

  // Prefill kode dari URL (?absen=KODE#checkin) — hasil scan kamera ponsel
  useEffect(() => {
    const absen = new URLSearchParams(window.location.search).get('absen')
    if (absen) {
      setCode(absen.toUpperCase())
      document.getElementById('checkin')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const stopScan = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (scanner) {
      try {
        await scanner.stop()
        await scanner.clear()
      } catch {
        // kamera sudah berhenti sendiri — abaikan
      }
    }
    setScanning(false)
  }, [])

  // Berhenti + lepaskan kamera saat komponen dibongkar
  useEffect(() => {
    return () => {
      void stopScan()
    }
  }, [stopScan])

  const startScan = async () => {
    setScanError(null)
    setScanning(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode(SCANNER_DIV, { verbose: false })
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' }, // kamera belakang
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText: string) => {
          const found = extractCode(decodedText)
          void stopScan()
          setCode(found)
          toast({
            title: 'QR Terbaca',
            description: `Kode ${found} terisi otomatis. Sekarang pilih nama santri.`,
          })
        },
        () => {
          // frame tanpa QR — abaikan diam-diam
        },
      )
    } catch (err) {
      scannerRef.current = null
      setScanning(false)
      const msg =
        err instanceof Error && /permission|denied|notallowed/i.test(err.message)
          ? 'Izin kamera ditolak. Aktifkan izin kamera di browser, atau ketik kode manual.'
          : 'Kamera tidak dapat dibuka di perangkat ini. Silakan ketik kode manual.'
      setScanError(msg)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Daftar sesi aktif publik (tanpa kode — kode hanya lewat QR ustadz).
      const sessionData = await apiGet<SessionItem[]>('/api/sessions?active=1')
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

  // ==== Muat daftar santri kelas otomatis saat kode berubah (debounce 450ms) ====
  useEffect(() => {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 4) {
      setRoster(null)
      setRosterError(null)
      setRosterLoading(false)
      return
    }
    setRosterLoading(true)
    setRosterError(null)
    const timer = setTimeout(async () => {
      try {
        const data = await apiGet<RosterPayload>(`/api/public/checkin-roster?code=${encodeURIComponent(trimmed)}`)
        setRoster(data)
        setStudentId('') // reset pilihan — kelas bisa berbeda
      } catch (err) {
        setRoster(null)
        setRosterError(err instanceof Error ? err.message : 'Kode tidak valid')
      } finally {
        setRosterLoading(false)
      }
    }, 450)
    return () => clearTimeout(timer)
  }, [code])

  // (Dropdown santri kini berasal dari roster per kode sesi — lihat effect di atas.)

  const handleCheckin = async () => {
    if (!gps) {
      toast({
        title: 'GPS Belum Siap',
        description: 'Check-in wajib GPS untuk mencegah absen palsu. Tunggu lokasi terkunci atau tekan Coba Lagi.',
        variant: 'destructive',
      })
      return
    }
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
        gps: { lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy, posTs: gps.posTs },
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
      setStudentId('')
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
          <AlertTitle className="text-emerald-900">Absensi QR + Validasi GPS</AlertTitle>
          <AlertDescription className="text-emerald-800/80">
            Ustadz menayangkan QR sesi — santri memindainya dengan kamera ponsel dan halaman ini
            terbuka dengan kode terisi otomatis. Kehadiran hanya sah bila perangkat berada
            <span className="font-semibold"> maksimal 20 meter dari titik kelas</span> (anti absen palsu).
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

              {/* Form selalu tampil — daftar santri muncul otomatis setelah kode valid */}
              <div className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="checkin-code">Kode Kehadiran</Label>
                  <div className="flex gap-2">
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
                    <Button
                      type="button"
                      variant={scanning ? 'destructive' : 'outline'}
                      className="shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      onClick={() => (scanning ? void stopScan() : void startScan())}
                      aria-label={scanning ? 'Tutup kamera' : 'Pindai QR dengan kamera'}
                    >
                      {scanning ? <CameraOff className="size-4" /> : <Camera className="size-4" />}
                      <span className="hidden sm:inline">{scanning ? 'Tutup' : 'Pindai QR'}</span>
                    </Button>
                  </div>
                  <p className="text-xs text-stone-400">
                    Klik &quot;Pindai QR&quot; untuk membaca QR dari ustadz lewat kamera, atau ketik
                    kodenya manual — daftar santri kelas muncul otomatis.
                  </p>
                </div>

                  {/* ==== Kamera pemindai QR ==== */}
                  {scanning && (
                    <div className="overflow-hidden rounded-2xl border-2 border-emerald-300 bg-stone-900 shadow-inner">
                      <div className="flex items-center justify-between border-b border-stone-700 bg-stone-800 px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                          <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
                          Kamera aktif — arahkan ke QR kelas
                        </span>
                        <button
                          type="button"
                          className="rounded-md p-1 text-stone-300 transition-colors hover:bg-stone-700 hover:text-white"
                          onClick={() => void stopScan()}
                          aria-label="Tutup kamera"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                      <div id={SCANNER_DIV} className="mx-auto max-w-xs" aria-label="Bidang pemindai QR" />
                    </div>
                  )}
                  {scanError && !scanning && (
                    <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                      {scanError}
                    </div>
                  )}

                  {/* ==== Status GPS (wajib utk check-in) ==== */}
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <MapPin className="size-3.5 text-emerald-600" /> Lokasi GPS (wajib — validasi 20 m)
                    </Label>
                    {gpsState === 'locating' && (
                      <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
                        <Loader2 className="size-4 animate-spin text-emerald-600" />
                        Mengunci posisi GPS…
                      </div>
                    )}
                    {gpsState === 'ok' && gps && (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                        <span className="inline-flex items-center gap-2">
                          <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
                          GPS siap{gps.accuracy != null ? ` (±${Math.round(gps.accuracy)} m)` : ''}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-100"
                          onClick={() => void acquireGps()}
                          aria-label="Perbarui posisi GPS"
                        >
                          <RefreshCw className="size-3" /> Segarkan
                        </Button>
                      </div>
                    )}
                    {gpsState === 'error' && (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
                          <span>{gpsError}</span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-2 h-8 border-red-300 text-red-700 hover:bg-red-100"
                          onClick={() => void acquireGps()}
                        >
                          <RefreshCw className="size-3.5" /> Coba Lagi
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* ==== Daftar santri kelas (muncul otomatis dari kode sesi) ==== */}
                  <div className="space-y-1.5">
                    <Label htmlFor="checkin-student">Pilih Santri</Label>
                    {rosterLoading && (
                      <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-500">
                        <Loader2 className="size-4 animate-spin text-emerald-600" />
                        Mencari kelas dari kode {code}…
                      </div>
                    )}
                    {!rosterLoading && rosterError && (
                      <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                        <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
                        {rosterError}
                      </div>
                    )}
                    {!rosterLoading && !rosterError && roster && roster.students.length === 0 && (
                      <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-center text-xs text-stone-500">
                        Belum ada santri terdaftar di kelas {roster.session.className}.
                      </div>
                    )}
                    {!rosterLoading && !rosterError && roster && roster.students.length > 0 && (
                      <>
                        <Select value={studentId} onValueChange={setStudentId}>
                          <SelectTrigger id="checkin-student" className="w-full" aria-label="Pilih santri">
                            <SelectValue placeholder="— Pilih nama santri —" />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {roster.students.map((student) => (
                              <SelectItem key={student.id} value={student.id}>
                                {student.fullName} · {student.nis}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-stone-500">
                          Kelas <span className="font-semibold text-emerald-700">{roster.session.className}</span>
                          {roster.session.topic ? ` • ${roster.session.topic}` : ''}
                          {' '}
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            <span className="size-1 animate-pulse rounded-full bg-emerald-500" />
                            {roster.students.length} santri
                          </span>
                        </p>
                      </>
                    )}
                    {!rosterLoading && !rosterError && !roster && (
                      <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-center text-xs text-stone-500">
                        <Users className="mx-auto mb-1.5 size-5 text-stone-300" />
                        Masukkan atau pindai kode kehadiran — daftar santri kelas akan muncul di sini.
                      </div>
                    )}
                  </div>

                  <Button
                    type="button"
                    size="lg"
                    className="w-full bg-emerald-700 font-semibold shadow-md hover:bg-emerald-800"
                    disabled={checking || !studentId || gpsState !== 'ok'}
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
                      onClick={() => session.code && setCode(session.code)}
                      className="flex w-full flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md disabled:cursor-default disabled:hover:translate-y-0"
                      disabled={!session.code}
                      title={session.code ? 'Klik untuk mengisi kode' : 'Kode hanya lewat QR dari ustadz'}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-stone-800">{session.className}</span>
                        {session.code ? (
                          <Badge className="border-transparent bg-emerald-700 font-mono text-[11px] tracking-widest text-white">
                            {session.code}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-stone-200 bg-stone-100 text-[10px] font-medium text-stone-400">
                            Kode via QR ustadz
                          </Badge>
                        )}
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
