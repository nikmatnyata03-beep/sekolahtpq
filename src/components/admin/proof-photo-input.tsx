'use client'

// Input FOTO BUKTI surat izin/sakit (Task 33) — dipakai attendance-admin
// dan QuickAbsenSheet (guru-overview). Wajib: potret via kamera perangkat,
// GPS diambil fresh saat memilih foto, lalu TIMESTAMP (WIB) + koordinat
// dicap permanen pada gambar (watermark) sebelum dikirim ke server.

import { useRef, useState } from 'react'
import { Camera, Loader2, MapPin, RefreshCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { captureWithStamp, dataUrlBytes, getGpsFix, GpsUnavailableError } from '@/lib/gps-client'

export interface ProofPhoto {
  dataUrl: string
  lat: number
  lng: number
  accuracy: number | null
  posTs: number
}

const MAX_PROOF_BYTES = 4 * 1024 * 1024 // batas server 5 MB — sisakan headroom

export function ProofPhotoInput({ studentName, kind, value, onChange, disabled }: {
  studentName: string
  kind: 'IZIN' | 'SAKIT'
  value: ProofPhoto | null
  onChange: (v: ProofPhoto | null) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      // GPS DIAMBIL SAAT INI (fresh) — bukan cache lama; freshness dicek ulang server.
      const fix = await getGpsFix()
      const stamped = await captureWithStamp(file, {
        label: `SURAT ${kind} — ${studentName}`,
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy,
        at: new Date(fix.posTs),
      })
      if (dataUrlBytes(stamped) > MAX_PROOF_BYTES) {
        throw new Error('Ukuran foto terlalu besar. Ambil ulang foto dengan pencahayaan lebih sederhana.')
      }
      onChange({ dataUrl: stamped, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, posTs: fix.posTs })
    } catch (e) {
      onChange(null)
      setError(
        e instanceof GpsUnavailableError
          ? `Foto bukti butuh GPS: ${e.message}`
          : e instanceof Error
            ? e.message
            : 'Gagal memproses foto. Coba lagi.',
      )
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = '' // izinkan pilih file sama lagi
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label={`Foto surat ${kind.toLowerCase()} ${studentName}`}
        disabled={disabled || busy}
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="space-y-2">
          <img
            src={value.dataUrl}
            alt={`Bukti surat ${kind.toLowerCase()} ${studentName} — sudah dicap timestamp & GPS`}
            className="max-h-44 w-full rounded-lg border border-amber-200 bg-white object-contain"
          />
          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-emerald-800">
            <MapPin className="mt-0.5 size-3 shrink-0" />
            Tercap: GPS ±{value.accuracy != null ? Math.round(value.accuracy) : '?'} m · waktu &amp; koordinat permanen pada foto.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-amber-300 text-amber-800 hover:bg-amber-100"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCcw className="size-3.5" /> Potret Ulang
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 text-stone-500 hover:bg-stone-100"
              disabled={disabled || busy}
              onClick={() => onChange(null)}
            >
              Hapus
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            type="button"
            size="sm"
            className="h-9 w-full bg-amber-500 font-semibold text-white hover:bg-amber-600"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            {busy ? 'Mengunci GPS & mencap foto…' : `Foto Surat ${kind === 'IZIN' ? 'Izin' : 'Sakit'} (wajib)`}
          </Button>
          <p className="text-[11px] leading-snug text-amber-800/90">
            Timestamp &amp; GPS otomatis tercap pada foto — tanpa foto surat, {kind.toLowerCase()} tidak dapat disimpan.
          </p>
        </div>
      )}
      {error && <p className="mt-1.5 text-[11px] font-medium text-red-600">{error}</p>}
    </div>
  )
}
