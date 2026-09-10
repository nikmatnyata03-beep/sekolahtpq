'use client'

// AnchorMapDialog (Task 35) — dialog pilih titik anchor absensi di peta.
// Dipakai attendance-admin: saat membuka sesi (ganti GPS perangkat) dan
// saat "Perbarui Titik" pada dialog QR sesi aktif/legacy.
// Konten dialog diremont tiap dibuka (pola Radix) sehingga pilihan selalu
// mulai dari `initial` — tanpa setState di effect body.

import { useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatMapPoint, MapPicker, type MapPoint } from './map-picker'

export function AnchorMapDialog({
  open,
  onOpenChange,
  initial,
  title = 'Pilih Titik Absen di Peta',
  description = 'Tandai lokasi kelas pada peta — check-in santri divalidasi ≤ 20 m dari titik ini.',
  confirmLabel = 'Gunakan Titik Ini',
  busy = false,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Titik awal (mis. anchor sesi yang sudah ada). */
  initial?: MapPoint | null
  title?: string
  description?: string
  confirmLabel?: string
  busy?: boolean
  onConfirm: (p: MapPoint) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        {open && (
          <AnchorMapInner
            initial={initial ?? null}
            title={title}
            description={description}
            confirmLabel={confirmLabel}
            busy={busy}
            onConfirm={onConfirm}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Terpasang ulang tiap dialog dibuka — state point mulai dari initial. */
function AnchorMapInner({
  initial,
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
}: {
  initial: MapPoint | null
  title: string
  description: string
  confirmLabel: string
  busy: boolean
  onConfirm: (p: MapPoint) => void
  onCancel: () => void
}) {
  const [point, setPoint] = useState<MapPoint | null>(initial)

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-base">
          <MapPin className="size-4 text-emerald-700" /> {title}
        </DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <MapPicker value={point} onChange={setPoint} />
      {point && (
        <p className="text-xs font-medium text-emerald-700">
          Titik terpilih: <span className="font-mono">{formatMapPoint(point)}</span>
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Batal
        </Button>
        <Button
          className="bg-emerald-700 hover:bg-emerald-800"
          disabled={!point || busy}
          onClick={() => point && onConfirm(point)}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  )
}
