'use client'

// Hook pemindai QR kamera bersama (Task 34) — dipakai CheckinSection publik
// DAN portal wali. html5-qrcode dimuat lazy saat tombol pindai ditekan
// (hemat bundle), kamera belakang, berhenti otomatis saat kode terbaca
// atau komponen dibongkar.

import { useCallback, useEffect, useRef, useState } from 'react'

/** Ambil kode sesi dari hasil scan — QR berisi URL (?absen=KODE) maupun kode polos. */
export function extractCode(decoded: string): string {
  try {
    const url = new URL(decoded)
    const absen = url.searchParams.get('absen')
    if (absen) return absen.toUpperCase()
  } catch {
    // bukan URL — perlakukan sebagai kode polos
  }
  return decoded.trim().toUpperCase()
}

interface ScannerHandle {
  stop: () => Promise<void>
  clear: () => Promise<void>
}

/**
 * Hook pemindai QR. `divId` harus UNIK per pemakaian dan elemen
 * `<div id={divId} />` WAJIB dirender saat `scanning === true`.
 */
export function useQrScanner(divId: string, onDecoded: (code: string) => void) {
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<ScannerHandle | null>(null)
  const onDecodedRef = useRef(onDecoded)

  useEffect(() => {
    onDecodedRef.current = onDecoded
  }, [onDecoded])

  const stop = useCallback(async () => {
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
  // (pindah tab anak di portal wali → kamera ikut mati).
  useEffect(() => {
    return () => {
      void stop()
    }
  }, [stop])

  const start = useCallback(async () => {
    setError(null)
    setScanning(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode(divId, { verbose: false })
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' }, // kamera belakang
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText: string) => {
          const found = extractCode(decodedText)
          void stop()
          onDecodedRef.current(found)
        },
        () => {
          // frame tanpa QR — abaikan diam-diam
        },
      )
    } catch (err) {
      scannerRef.current = null
      setScanning(false)
      setError(
        err instanceof Error && /permission|denied|notallowed/i.test(err.message)
          ? 'Izin kamera ditolak. Aktifkan izin kamera di browser, atau ketik kode manual.'
          : 'Kamera tidak dapat dibuka di perangkat ini. Silakan ketik kode manual.',
      )
    }
  }, [divId, stop])

  return { scanning, error, start, stop }
}
