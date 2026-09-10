'use client'

// Hook GPS absensi bersama (Task 34) — dipakai CheckinSection publik DAN
// portal wali. Mengambil posisi otomatis saat komponen terpasang (memicu
// dialog izin lokasi browser), menampilkan 3 status (locating/ok/error),
// dan menyediakan ensureFresh() untuk submit agar posisi tidak basi
// (server menolak posisi lebih tua dari 3 menit — anti-fakeGPS Task 33).

import { useCallback, useEffect, useRef, useState } from 'react'
import { getGpsFix, GpsUnavailableError, type GpsFix } from '@/lib/gps-client'

export type GpsState = 'locating' | 'ok' | 'error'

export function useGpsFix(options?: { auto?: boolean }) {
  const auto = options?.auto ?? true
  const [gps, setGps] = useState<GpsFix | null>(null)
  const [state, setState] = useState<GpsState>('locating')
  const [error, setError] = useState<string | null>(null)
  const gpsRef = useRef<GpsFix | null>(null)

  const acquire = useCallback(async (): Promise<GpsFix> => {
    gpsRef.current = null
    setGps(null)
    setState('locating')
    setError(null)
    try {
      const fix = await getGpsFix()
      gpsRef.current = fix
      setGps(fix)
      setState('ok')
      return fix
    } catch (e) {
      gpsRef.current = null
      setGps(null)
      setState('error')
      const msg = e instanceof GpsUnavailableError ? e.message : 'Lokasi gagal diambil. Coba lagi.'
      setError(msg)
      throw e
    }
  }, [])

  /**
   * Pastikan ada fix segar saat submit — pakai yang sudah ada bila masih
   * baru (< maxAgeMs), kalau tidak ambil ulang. Throw GpsUnavailableError
   * bila gagal (state komponen ikut berubah jadi 'error').
   */
  const ensureFresh = useCallback(
    async (maxAgeMs = 120_000): Promise<GpsFix> => {
      const cur = gpsRef.current
      if (cur && Date.now() - cur.posTs <= maxAgeMs) return cur
      return await acquire()
    },
    [acquire],
  )

  // Ambil otomatis saat terpasang / saat kartu menjadi aktif (portal wali
  // dengan beberapa anak). State awal sudah 'locating' — pembaruan state
  // hanya terjadi SETELAH fix didapat (asinkron, tanpa cascading render).
  // Kegagalan dibiarkan — state berubah 'error' dgn pesan siap-tampil.
  useEffect(() => {
    if (!auto) return
    let alive = true
    getGpsFix()
      .then((fix) => {
        if (!alive) return
        gpsRef.current = fix
        setGps(fix)
        setState('ok')
      })
      .catch((e: unknown) => {
        if (!alive) return
        gpsRef.current = null
        setGps(null)
        setState('error')
        setError(e instanceof GpsUnavailableError ? e.message : 'Lokasi gagal diambil. Coba lagi.')
      })
    return () => {
      alive = false
    }
  }, [auto])

  return { gps, state, error, acquire, ensureFresh }
}
