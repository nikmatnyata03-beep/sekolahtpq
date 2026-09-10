'use client'

import { useEffect, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  Eye,
  EyeOff,
  Landmark,
  Loader2,
  LogIn,
  Mail,
  MoonStar,
  X,
} from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { apiSend } from '@/lib/api-client'
import type { AuthUser } from '@/lib/types'
import { TurnstileWidget } from '@/components/security/turnstile-widget'

export function LoginDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: (user: AuthUser) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileReset, setTurnstileReset] = useState(0)

  useEffect(() => {
    if (open) {
      setError(null)
      setTurnstileToken('')
      setTurnstileReset((value) => value + 1)
    }
  }, [open])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Email dan password wajib diisi.')
      return
    }
    if (!turnstileToken) {
      setError('Silakan selesaikan verifikasi keamanan terlebih dahulu.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await apiSend<{ user: AuthUser }>('/api/auth/login', 'POST', {
        email: email.trim(),
        password,
        turnstileToken,
      })
      setPassword('')
      onSuccess(res.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk. Silakan coba lagi.')
      setTurnstileReset((value) => value + 1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-md">
        {/* Brand header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-emerald-600 p-6 pb-7 text-white">
          <MoonStar className="absolute -right-3 -top-3 size-24 text-white/10" aria-hidden />
          <div className="relative flex items-start gap-3">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Landmark className="size-6" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold tracking-tight text-white">Masuk Portal SIMADJI</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-emerald-100">
                TPQ Darul Jinan · Sistem Informasi Manajemen
              </DialogDescription>
            </div>
            <DialogClose className="absolute -right-1 -top-1 rounded-full p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/40">
              <X className="size-4" />
              <span className="sr-only">Tutup dialog</span>
            </DialogClose>
          </div>
        </div>

        {/* Form body */}
        <div className="space-y-4 p-6">
          {error && (
            <Alert variant="destructive" className="rounded-xl">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" />
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@contoh.com"
                  className="h-10 rounded-xl pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Masukkan password"
                  className="h-10 rounded-xl pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} />

            <Button
              type="submit"
              disabled={loading}
              className="h-10 w-full rounded-xl bg-emerald-700 text-white shadow-sm transition-colors hover:bg-emerald-800"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Memproses...
                </>
              ) : (
                <>
                  <LogIn className="size-4" /> Masuk
                </>
              )}
            </Button>
          </form>

        </div>
      </DialogContent>
    </Dialog>
  )
}
