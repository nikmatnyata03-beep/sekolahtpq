'use client'

// ============================================================
// MapPicker (Task 35) — pilih titik lokasi absensi di peta.
// ============================================================
// OpenStreetMap + Leaflet (tanpa API key, lazy-load saat dipasang).
// Dipakai ustadz/admin utk menetapkan titik anchor sesi absensi:
//  - klik/tap peta → pin pindah ke titik itu
//  - lingkaran hijau 20 m = zona sah check-in santri
//  - tombol "GPS saya" → pin di posisi perangkat
//  - tempel koordinat/URL Google Maps ke kolom koordinat (mis.
//    "-6.200000, 106.800000" atau "https://maps.google.com/@-6.2,106.8")

import { useCallback, useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import type { Map as LeafletMap, Marker, Circle } from 'leaflet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, LocateFixed, MapPin } from 'lucide-react'
import { getGpsFix, GpsUnavailableError } from '@/lib/gps-client'

export interface MapPoint {
  lat: number
  lng: number
}

const DEFAULT_CENTER: [number, number] = [-6.2, 106.8]

const PIN_SVG = `<svg width="30" height="40" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C5.373 0 0 5.373 0 12c0 8.8 12 20 12 20s12-11.2 12-20C24 5.373 18.627 0 12 0z" fill="#047857" stroke="#ffffff" stroke-width="1.5"/><circle cx="12" cy="12" r="5" fill="#ffffff"/></svg>`

function validPoint(lat: number, lng: number): MapPoint | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  if (lat === 0 && lng === 0) return null
  return { lat, lng }
}

/**
 * Parse teks koordinat bebas: "lat, lng" (titik desimal), atau URL Google
 * Maps (@lat,lng / q=lat,lng / !3dlat!4dlng). Return null bila tak dikenal.
 */
export function parseCoordText(text: string): MapPoint | null {
  const t = text.trim()
  if (!t) return null
  const patterns = [
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // https://maps.google.com/@-6.2,106.8
    /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // ?q=-6.2,106.8
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // place URL: !3d-6.2!4d106.8
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (m) {
      const p = validPoint(Number(m[1]), Number(m[2]))
      if (p) return p
    }
  }
  const parts = t.split(/[\s,;]+/).filter(Boolean)
  if (parts.length >= 2) {
    const p = validPoint(Number(parts[0]), Number(parts[1]))
    if (p) return p
  }
  return null
}

/** "-6,200000, 106,800000" — gaya id-ID, konsisten dgn format lain di aplikasi. */
export function formatMapPoint(p: MapPoint): string {
  const f = (n: number) => n.toFixed(6).replace('.', ',')
  return `${f(p.lat)}, ${f(p.lng)}`
}

export function MapPicker({
  value,
  onChange,
  heightClass = 'h-64',
}: {
  /** Titik terpilih saat ini (dikendalikan parent — boleh null). */
  value: MapPoint | null
  onChange: (p: MapPoint) => void
  heightClass?: string
}) {
  const divRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const circleRef = useRef<Circle | null>(null)
  const LRef = useRef<typeof import('leaflet') | null>(null)
  const onChangeRef = useRef(onChange)
  const [ready, setReady] = useState(false)
  const [manual, setManual] = useState(value ? formatMapPoint(value) : '')
  const [locating, setLocating] = useState(false)
  const [manualErr, setManualErr] = useState<string | null>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Set / pindahkan pin + lingkaran 20 m, lalu laporkan ke parent.
  const applyPoint = useCallback((p: MapPoint, fly = false) => {
    const L = LRef.current
    const map = mapRef.current
    if (!L || !map) return
    if (!markerRef.current) {
      const icon = L.divIcon({ html: PIN_SVG, className: 'simadji-map-pin', iconSize: [30, 40], iconAnchor: [15, 38] })
      markerRef.current = L.marker([p.lat, p.lng], { icon, keyboard: false }).addTo(map)
    } else {
      markerRef.current.setLatLng([p.lat, p.lng])
    }
    if (!circleRef.current) {
      circleRef.current = L.circle([p.lat, p.lng], {
        radius: 20,
        color: '#047857',
        weight: 2,
        fillColor: '#10b981',
        fillOpacity: 0.12,
      }).addTo(map)
    } else {
      circleRef.current.setLatLng([p.lat, p.lng])
    }
    if (fly) map.flyTo([p.lat, p.lng], 18, { duration: 0.8 })
    setManual(formatMapPoint(p))
    setManualErr(null)
    onChangeRef.current(p)
  }, [])

  // Inisialisasi peta sekali (leaflet hanya di klien — import dinamis).
  useEffect(() => {
    let cancelled = false
    let map: LeafletMap | null = null
    void (async () => {
      const L = await import('leaflet')
      if (cancelled || !divRef.current) return
      LRef.current = L
      map = L.map(divRef.current, {
        center: value ? [value.lat, value.lng] : DEFAULT_CENTER,
        zoom: value ? 18 : 11,
        scrollWheelZoom: true,
      })
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map)
      map.on('click', (e) => {
        applyPoint({ lat: e.latlng.lat, lng: e.latlng.lng })
      })
      mapRef.current = map
      setReady(true)
      if (value) applyPoint(value)
    })()
    return () => {
      cancelled = true
      mapRef.current = null
      markerRef.current = null
      circleRef.current = null
      map?.remove()
    }
    // value hanya dibaca saat inisialisasi — perubahan berikutnya lewat applyPoint.
  }, [applyPoint])

  function useMyGps() {
    setLocating(true)
    getGpsFix()
      .then((fix) => {
        applyPoint({ lat: fix.lat, lng: fix.lng }, true)
      })
      .catch((e: unknown) => {
        setManualErr(
          e instanceof GpsUnavailableError
            ? e.message
            : 'Lokasi GPS gagal diambil. Gunakan peta atau tempel koordinat.',
        )
      })
      .finally(() => setLocating(false))
  }

  function applyManual() {
    const p = parseCoordText(manual)
    if (!p) {
      setManualErr('Koordinat tidak dikenal. Contoh: -6.200000, 106.800000 atau tempel URL Google Maps.')
      return
    }
    applyPoint(p, true)
  }

  return (
    <div className="space-y-2">
      <div className={`relative overflow-hidden rounded-xl border border-stone-300 bg-stone-100 ${heightClass}`}>
        <div ref={divRef} className="size-full" aria-label="Peta pilih titik absen" />
        {!ready && (
          <div className="absolute inset-0 grid place-items-center bg-stone-100 text-xs text-stone-500">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-emerald-600" /> Memuat peta…
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              applyManual()
            }
          }}
          placeholder="-6.200000, 106.800000 / URL Google Maps"
          className="h-9 min-w-0 flex-1 rounded-lg font-mono text-xs"
          aria-label="Koordinat titik absen"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 flex-1 rounded-lg border-emerald-200 text-xs text-emerald-700 hover:bg-emerald-50 sm:flex-none"
            onClick={useMyGps}
            disabled={locating}
          >
            {locating ? <Loader2 className="size-3.5 animate-spin" /> : <LocateFixed className="size-3.5" />}
            GPS saya
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 flex-1 rounded-lg border-emerald-200 text-xs text-emerald-700 hover:bg-emerald-50 sm:flex-none"
            onClick={applyManual}
          >
            <MapPin className="size-3.5" /> Pakai Koordinat
          </Button>
        </div>
      </div>
      {manualErr && <p className="text-xs text-red-600">{manualErr}</p>}
      {ready && !value && (
        <p className="text-xs text-stone-500">
          Klik/tap peta untuk menandai titik kelas, tekan &quot;GPS saya&quot;, atau tempel koordinat dari
          Google Maps. Lingkaran hijau = batas 20 m check-in santri.
        </p>
      )}
    </div>
  )
}
