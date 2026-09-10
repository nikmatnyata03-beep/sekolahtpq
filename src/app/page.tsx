'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { PublicPortal } from '@/components/public/portal'
import { AdminDashboard } from '@/components/admin/dashboard'
import { ParentPortal } from '@/components/parent/parent-portal'
import { LoginDialog } from '@/components/auth/login-dialog'
import type { AuthUser } from '@/lib/types'
import { apiGet, installRuntimeErrorHook } from '@/lib/api-client'

export default function Home() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Restore session after mount (deferred callback keeps hydration consistent)
  useEffect(() => {
    // AI Fix Bridge: pasang pelapor error runtime global (JS error, promise
    // rejection) — error otomatis masuk antrean agen AI via /api/dev/errors.
    installRuntimeErrorHook()
    const timer = setTimeout(() => {
      void apiGet<AuthUser>('/api/auth/me')
        .then(setUser)
        .catch(() => setUser(null))
        .finally(() => setHydrated(true))
    }, 10)
    return () => clearTimeout(timer)
  }, [])

  const handleLoginSuccess = useCallback((u: AuthUser) => {
    setUser(u)
    setLoginOpen(false)
  }, [])

  const handleLogout = useCallback(() => {
    setUser(null)
    // Hapus cookie sesi di server (fire-and-forget — UI sudah keluar).
    void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  }, [])

  const openPublic = useCallback(() => setUser(null), [])

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-emerald-50/50">
        <div className="flex flex-col items-center gap-3 text-emerald-800">
          <Loader2 className="size-7 animate-spin" />
          <p className="text-sm font-medium">Memuat SIMADJI…</p>
        </div>
      </div>
    )
  }

  if (user) {
    if (user.role === 'ORANG_TUA') {
      return (
        <div className="flex min-h-screen flex-col">
          <ParentPortal user={user} onLogout={handleLogout} onOpenPublic={openPublic} />
          <footer className="mt-auto border-t border-stone-200 bg-white py-3">
            <p className="mx-auto max-w-6xl px-4 text-center text-[11px] text-stone-400">
              © 2025 SIMADJI · TPQ Darul Jinan — Portal Wali Santri
            </p>
          </footer>
        </div>
      )
    }
    // ADMIN & GURU → operations dashboard (full-height app shell, no document footer)
    return <AdminDashboard user={user} onLogout={handleLogout} onOpenPublic={openPublic} />
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <PublicPortal onOpenLogin={() => setLoginOpen(true)} />
      </main>
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} onSuccess={handleLoginSuccess} />
    </div>
  )
}
