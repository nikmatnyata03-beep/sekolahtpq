'use client'

import { useState, type FormEvent } from 'react'
import {
  KeyRound,
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  ShieldCheck,
  Info,
  Loader2,
  Fingerprint,
  type LucideIcon,
} from 'lucide-react'
import type { AuthUser } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

// ==== Role helpers (same classes as admin/dashboard.tsx roleBadgeClass) ====

function roleBadgeClass(role: string): string {
  if (role === 'ADMIN') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (role === 'GURU') return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-stone-100 text-stone-700 border-stone-200'
}

function roleLabel(role: string): string {
  if (role === 'ADMIN') return 'Admin'
  if (role === 'GURU') return 'Guru'
  return 'Wali Santri'
}

function roleDescription(role: string): string {
  if (role === 'ADMIN') return 'Akses penuh: pengguna, santri, keuangan, konten, dan log WhatsApp.'
  if (role === 'GURU') return 'Mengampu kelas, mencatat absensi & hafalan, serta mengunggah materi.'
  return 'Memantau kehadiran, hafalan, tagihan, dan pengumuman putra/putri Anda.'
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

const DEMO_ACCOUNTS: { role: AuthUser['role']; email: string; password: string }[] = [
  { role: 'ADMIN', email: 'admin@daruljinan.sch.id', password: 'admin123' },
  { role: 'GURU', email: 'ustadzah.fatimah@daruljinan.sch.id', password: 'guru123' },
  { role: 'ORANG_TUA', email: 'budi.santoso@gmail.com', password: 'ortu123' },
]

// ==== Password input with show/hide toggle (44px touch target) ====

function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  helper,
  autoComplete,
  show,
  onToggle,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  helper?: string
  autoComplete: string
  show: boolean
  onToggle: () => void
  disabled: boolean
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          className="h-11 rounded-xl pr-11"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-0 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-xl text-stone-400 transition-colors hover:bg-stone-100/70 hover:text-stone-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
          aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
          aria-pressed={show}
          disabled={disabled}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-red-600">
          {error}
        </p>
      ) : helper ? (
        <p id={`${id}-helper`} className="text-xs text-stone-400">
          {helper}
        </p>
      ) : null}
    </div>
  )
}

// ==== Read-only definition row ====

function ProfileRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <dt className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-stone-500">
        <Icon className="size-3.5 text-stone-400" aria-hidden />
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm font-medium text-stone-800">{children}</dd>
    </div>
  )
}

export function SettingsSection({ user }: { user: AuthUser }) {
  const { toast } = useToast()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({})
  const [saving, setSaving] = useState(false)

  function clearFieldError(field: 'current' | 'next' | 'confirm') {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  function validate(): boolean {
    const nextErrors: { current?: string; next?: string; confirm?: string } = {}
    if (!current) nextErrors.current = 'Password saat ini wajib diisi.'
    if (!next) nextErrors.next = 'Password baru wajib diisi.'
    else if (next.length < 6) nextErrors.next = 'Password baru minimal 6 karakter.'
    if (!confirm) nextErrors.confirm = 'Konfirmasi password wajib diisi.'
    else if (confirm !== next) nextErrors.confirm = 'Konfirmasi password tidak cocok.'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, currentPassword: current, newPassword: next }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        const message = data.error || 'Gagal mengubah password.'
        if (res.status === 401) setErrors({ current: message })
        toast({ title: 'Gagal mengubah password', description: message, variant: 'destructive' })
        return
      }
      toast({ title: 'Password berhasil diubah', description: 'Gunakan password baru pada login berikutnya.' })
      setCurrent('')
      setNext('')
      setConfirm('')
      setShowCurrent(false)
      setShowNext(false)
      setShowConfirm(false)
      setErrors({})
    } catch {
      toast({
        title: 'Gagal mengubah password',
        description: 'Terjadi kesalahan jaringan. Silakan coba lagi.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {/* Left column: profile + demo accounts */}
      <div className="space-y-4">
        {/* a. Profil Akun */}
        <Card className="rounded-2xl border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback className="bg-emerald-700 text-sm font-semibold text-white">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <span className="truncate">{user.name}</span>
                  <Badge className={roleBadgeClass(user.role)}>{roleLabel(user.role)}</Badge>
                </CardTitle>
                <CardDescription className="mt-0.5">{roleDescription(user.role)}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-stone-100 rounded-xl border border-stone-100 bg-stone-50/60">
              <ProfileRow icon={Mail} label="Email">
                <span className="block truncate">{user.email}</span>
              </ProfileRow>
              <ProfileRow icon={User} label="Nama Lengkap">
                <span className="block truncate">{user.name}</span>
              </ProfileRow>
              <ProfileRow icon={Phone} label="No. HP">
                <span className="block truncate">{user.phone || '—'}</span>
              </ProfileRow>
              <ProfileRow icon={ShieldCheck} label="Peran">
                <Badge className={roleBadgeClass(user.role)}>{roleLabel(user.role)}</Badge>
              </ProfileRow>
              <ProfileRow icon={Fingerprint} label="ID Pengguna">
                <span className="block truncate font-mono text-xs text-stone-600" title={user.id}>
                  {user.id}
                </span>
              </ProfileRow>
            </dl>
          </CardContent>
        </Card>

        {/* c. Akun Demo */}
        <Card className="rounded-2xl border-stone-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-emerald-700" /> Akun Demo
            </CardTitle>
            <CardDescription>Kredensial bawaan yang tersedia pada sistem demo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <div
                key={acc.email}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-100 bg-stone-50/60 px-3.5 py-2.5 sm:flex-nowrap"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Badge className={roleBadgeClass(acc.role)}>{roleLabel(acc.role)}</Badge>
                  <span className="truncate font-mono text-xs text-stone-600">{acc.email}</span>
                </div>
                <code className="shrink-0 rounded-md border border-stone-200 bg-white px-2 py-1 font-mono text-xs text-stone-700">
                  {acc.password}
                </code>
              </div>
            ))}
            <p className="flex items-start gap-1.5 pt-1 text-xs text-stone-500">
              <Info className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden />
              Gunakan akun ini untuk mencoba berbagai peran.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Right column: b. Ubah Password */}
      <Card className="rounded-2xl border-stone-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4 text-emerald-700" /> Ubah Password
          </CardTitle>
          <CardDescription>Perbarui kata sandi akun Anda secara mandiri</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <PasswordField
              id="pw-current"
              label="Password Saat Ini"
              value={current}
              onChange={(v) => {
                setCurrent(v)
                clearFieldError('current')
              }}
              error={errors.current}
              autoComplete="current-password"
              show={showCurrent}
              onToggle={() => setShowCurrent((v) => !v)}
              disabled={saving}
            />
            <PasswordField
              id="pw-new"
              label="Password Baru"
              value={next}
              onChange={(v) => {
                setNext(v)
                clearFieldError('next')
              }}
              error={errors.next}
              helper="Minimal 6 karakter"
              autoComplete="new-password"
              show={showNext}
              onToggle={() => setShowNext((v) => !v)}
              disabled={saving}
            />
            <PasswordField
              id="pw-confirm"
              label="Konfirmasi Password Baru"
              value={confirm}
              onChange={(v) => {
                setConfirm(v)
                clearFieldError('confirm')
              }}
              error={errors.confirm}
              autoComplete="new-password"
              show={showConfirm}
              onToggle={() => setShowConfirm((v) => !v)}
              disabled={saving}
            />
            <Button
              type="submit"
              disabled={saving}
              className="h-11 w-full rounded-xl bg-emerald-700 text-white shadow-sm transition-colors hover:bg-emerald-800 sm:w-auto"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <KeyRound className="size-4" /> Simpan Password Baru
                </>
              )}
            </Button>
          </form>

          <Alert className="mt-4 rounded-xl border-emerald-200 bg-emerald-50 text-emerald-800">
            <ShieldCheck className="size-4" />
            <AlertTitle>Keamanan</AlertTitle>
            <AlertDescription className="text-emerald-700/90">
              Password disimpan sebagai hash bcrypt — tidak ada yang bisa membacanya, termasuk administrator.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* aria-live region for accessibility of form errors (visually hidden) */}
      <div aria-live="polite" className={cn('sr-only')}>
        {errors.current || errors.next || errors.confirm
          ? 'Formulir password mengandung kesalahan. Periksa kembali isian Anda.'
          : ''}
      </div>
    </div>
  )
}
