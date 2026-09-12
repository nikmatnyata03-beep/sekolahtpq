'use client'

// Hook bersama untuk membaca konten landing page (CMS) dari /api/settings.
// Selama memuat / gagal, mengembalikan DEFAULT_PORTAL_SETTINGS agar
// section publik tidak pernah kosong.
//
// Task 62 — Pratinjau Draf: bila URL memuat ?preview=1, hook mencoba memuat
// bundle draf (khusus ADMIN/DEVELOPER yang sedang login); bila ditolak/gagal,
// diam-diam jatuh ke konten live. `previewing` dipakai portal untuk menampilkan
// banner pratinjau dan editor untuk membuka tautan pratinjau.

import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '@/lib/api-client'
import { DEFAULT_PORTAL_SETTINGS, type PortalSettings } from '@/lib/portal-settings'

interface DraftBundle {
  draft: PortalSettings
  published: PortalSettings
  versions: { at: string; settings: PortalSettings }[]
  publishedAt: string | null
}

export function usePortalSettings() {
  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_PORTAL_SETTINGS)
  const [ready, setReady] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const load = useCallback(async () => {
    const wantsPreview =
      typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === '1'
    if (wantsPreview) {
      try {
        const bundle = await apiGet<DraftBundle>('/api/settings?draft=1')
        if (bundle && typeof bundle === 'object' && bundle.draft) {
          setSettings(bundle.draft)
          setPreviewing(true)
          setReady(true)
          return
        }
      } catch {
        // bukan admin / draf gagal → jatuh ke konten live
      }
    }
    setPreviewing(false)
    try {
      const data = await apiGet<PortalSettings>('/api/settings')
      if (data && typeof data === 'object') setSettings(data)
    } catch {
      // non-kritis — biarkan default
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { settings, ready, previewing, reload: load }
}
