'use client'

// Hook bersama untuk membaca konten landing page (CMS) dari /api/settings.
// Selama memuat / gagal, mengembalikan DEFAULT_PORTAL_SETTINGS agar
// section publik tidak pernah kosong.

import { useCallback, useEffect, useState } from 'react'
import { apiGet } from '@/lib/api-client'
import { DEFAULT_PORTAL_SETTINGS, type PortalSettings } from '@/lib/portal-settings'

export function usePortalSettings() {
  const [settings, setSettings] = useState<PortalSettings>(DEFAULT_PORTAL_SETTINGS)
  const [ready, setReady] = useState(false)

  const load = useCallback(async () => {
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

  return { settings, ready, reload: load }
}
