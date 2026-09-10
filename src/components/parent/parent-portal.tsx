'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  BellDot,
  CheckCheck,
  Inbox,
  Home,
  Landmark,
  LogOut,
  Megaphone,
  MessageSquare,
  MoonStar,
  RefreshCw,
  Smartphone,
  Sparkles,
  User,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { apiGet, apiSend, formatDate, formatShortDate } from '@/lib/api-client'
import type { AuthUser, NotificationLog, ParentPortalData, SessionItem } from '@/lib/types'
import { ChildPanel } from '@/components/parent/child-panel'

/** Renders *bold* WhatsApp-style segments as <strong>. */
function renderBoldMessage(message: string) {
  return message.split('*').map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-stone-900">
        {part}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  )
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} hari lalu`
  return formatShortDate(iso)
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/** localStorage key for client-side announcement read-state (no backend involvement). */
const READ_ANNOUNCEMENTS_KEY = 'simadji.readAnnouncements'
/** Max stored ids — when exceeded, the oldest entries are dropped. */
const READ_ANNOUNCEMENTS_CAP = 100

/** Reads + parses the stored read-id list. Corrupt/unavailable storage → treated as empty.
 *  Hydration rule: never call during render — only after mount (timer/effect) or in event handlers. */
function readStoredReadAnnouncements(): string[] {
  try {
    const raw = window.localStorage.getItem(READ_ANNOUNCEMENTS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    // corrupted value or storage unavailable → treat as empty
  }
  return []
}

/** Merges ids into storage (dedup, newest last, capped at 100 — oldest dropped). Best-effort. */
function persistReadAnnouncements(ids: string[]): void {
  if (ids.length === 0) return
  try {
    const merged = new Set([...readStoredReadAnnouncements(), ...ids])
    window.localStorage.setItem(READ_ANNOUNCEMENTS_KEY, JSON.stringify([...merged].slice(-READ_ANNOUNCEMENTS_CAP)))
  } catch {
    // storage full/unavailable → keep in-memory read-state only
  }
}

function PortalSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-10 w-72 rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-52 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
      </div>
    </div>
  )
}

export function ParentPortal({ user, onLogout, onOpenPublic }: { user: AuthUser; onLogout: () => void; onOpenPublic?: () => void }) {
  const { toast } = useToast()
  const [data, setData] = useState<ParentPortalData | null>(null)
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [markingRead, setMarkingRead] = useState(false)
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>([])

  const load = useCallback(
    async (initial = false) => {
      if (initial) setLoading(true)
      setError(null)
      try {
        const d = await apiGet<ParentPortalData>('/api/portal/parent')
        setData(d)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat data portal.')
      } finally {
        if (initial) setLoading(false)
      }
    },
    [user.id],
  )

  useEffect(() => {
    void load(true)
    // Active check-in codes for the QR hint chips (non-blocking; harmless if it fails)
    apiGet<SessionItem[]>('/api/sessions?active=1')
      .then((s) => setSessions(Array.isArray(s) ? s : []))
      .catch(() => setSessions([]))
  }, [load])

  // Announcement read-state: SSR + first client render stay identical (empty list), the stored
  // ids hydrate after mount via a deferred timer (same pattern as page.tsx session restore —
  // avoids the react-hooks/set-state-in-effect lint error for synchronous setState in effects).
  useEffect(() => {
    const timer = setTimeout(() => setReadAnnouncementIds(readStoredReadAnnouncements()), 10)
    return () => clearTimeout(timer)
  }, [])

  const unreadCount = data?.notifications.filter((n) => !n.readAt).length ?? 0

  const markAllRead = useCallback(async () => {
    setMarkingRead(true)
    try {
      await apiSend('/api/notifications/read', 'PUT', { userId: user.id })
      await load()
      toast({ title: 'Notifikasi diperbarui', description: 'Semua pesan ditandai sudah dibaca.' })
    } catch (err) {
      toast({
        title: 'Gagal menandai notifikasi',
        description: err instanceof Error ? err.message : 'Silakan coba lagi.',
        variant: 'destructive',
      })
    } finally {
      setMarkingRead(false)
    }
  }, [user.id, load, toast])

  const parentName = data?.parent.name || user.name
  const importantAnnouncements = (data?.announcements ?? []).slice(0, 2)
  const newAnnouncementCount = importantAnnouncements.filter((a) => !readAnnouncementIds.includes(a.id)).length

  // Marks one shown announcement as read (badge disappears immediately; storage best-effort).
  const markAnnouncementRead = (id: string) => {
    persistReadAnnouncements([id])
    setReadAnnouncementIds((prev) => (prev.includes(id) ? prev : [...prev, id].slice(-READ_ANNOUNCEMENTS_CAP)))
  }

  // Marks every currently shown hero announcement as read.
  const markAllAnnouncementsRead = () => {
    persistReadAnnouncements(importantAnnouncements.map((a) => a.id))
    setReadAnnouncementIds((prev) => [...new Set([...prev, ...importantAnnouncements.map((a) => a.id)])].slice(-READ_ANNOUNCEMENTS_CAP))
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* ==== Sticky header ==== */}
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white shadow-sm">
              <Landmark className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight text-stone-900">SIMADJI</p>
              <p className="truncate text-[11px] leading-tight text-stone-500">Portal Wali Santri · TPQ Darul Jinan</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onOpenPublic && (
              <Button
                variant="ghost"
                size="sm"
                className="hidden gap-1.5 text-xs text-stone-500 hover:text-emerald-700 sm:flex"
                onClick={onOpenPublic}
              >
                <Home className="size-3.5" /> Portal Publik
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-stone-500 hover:text-emerald-700"
              title="Muat ulang data"
              onClick={() => void load()}
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            {/* Notification bell */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-stone-500 hover:text-emerald-700" title="Notifikasi">
                  <Bell className="size-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-4 text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0">
                <DropdownMenuLabel className="flex items-center justify-between border-b px-3 py-2.5">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="size-4 text-emerald-700" /> Notifikasi
                  </span>
                  {unreadCount > 0 && (
                    <Badge className="bg-amber-500 text-white">{unreadCount} baru</Badge>
                  )}
                </DropdownMenuLabel>
                <div className="max-h-72 overflow-y-auto p-1.5">
                  {(data?.notifications ?? []).slice(0, 10).length === 0 ? (
                    <p className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-stone-400">
                      <Inbox className="size-4" /> Belum ada notifikasi.
                    </p>
                  ) : (
                    (data?.notifications ?? []).slice(0, 10).map((n) => (
                      <div key={n.id} className="flex gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-stone-50">
                        <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.readAt ? 'bg-stone-200' : 'bg-amber-500'}`} />
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-xs leading-relaxed text-stone-700">{n.message}</p>
                          <p className="mt-0.5 text-[10px] text-stone-400">{timeAgo(n.createdAt)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <DropdownMenuSeparator className="my-0" />
                <DropdownMenuItem
                  disabled={unreadCount === 0 || markingRead}
                  onSelect={(e) => {
                    e.preventDefault()
                    void markAllRead()
                  }}
                  className="justify-center gap-2 py-2.5 text-emerald-700 data-[disabled]:opacity-50"
                >
                  {markingRead ? <RefreshCw className="size-4 animate-spin" /> : <CheckCheck className="size-4" />}
                  Tandai semua dibaca
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="ml-1 hidden items-center gap-2 border-l border-stone-200 pl-2.5 sm:flex">
              <Avatar className="size-8">
                <AvatarFallback className="bg-emerald-100 text-xs font-bold text-emerald-800">
                  {initialsOf(user.name) || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="max-w-36">
                <p className="truncate text-sm font-medium leading-tight text-stone-800">{user.name}</p>
                <p className="text-[11px] leading-tight text-stone-500">Wali Santri</p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="text-stone-500 hover:bg-red-50 hover:text-red-600"
              title="Keluar"
              onClick={onLogout}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6">
        {/* ==== Greeting hero + announcements ==== */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-600 p-6 text-white shadow-sm sm:p-7">
          <MoonStar className="pointer-events-none absolute -bottom-8 -right-4 size-40 text-white/10" aria-hidden />
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-100">
            Portal Wali Santri · {formatDate(new Date())}
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">Assalamu&apos;alaikum, {parentName}</h1>
          <p className="mt-1 max-w-xl text-sm text-emerald-50/90">
            Pantau kehadiran, progres hafalan, tagihan, dan pengumuman santri Anda — semuanya dalam satu tempat.
          </p>

          {importantAnnouncements.length > 0 && (
            <div className="mt-5 space-y-2">
              {newAnnouncementCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-300">
                    <BellDot className="size-3" aria-hidden />
                    {newAnnouncementCount} pengumuman baru
                  </p>
                  <button
                    type="button"
                    onClick={markAllAnnouncementsRead}
                    className="rounded px-1 py-1 text-[11px] font-medium text-white/90 underline-offset-2 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                  >
                    Tandai semua dibaca
                  </button>
                </div>
              )}
              {importantAnnouncements.map((a) => {
                const important = a.priority === 'PENTING'
                const isNew = !readAnnouncementIds.includes(a.id)
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => markAnnouncementRead(a.id)}
                    aria-label={isNew ? `${a.title} (pengumuman baru, klik untuk menandai sudah dibaca)` : a.title}
                    className={
                      'flex w-full cursor-pointer gap-2.5 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ' +
                      (important
                        ? 'border-amber-300 bg-amber-50 text-stone-800 shadow-sm hover:border-amber-400 hover:bg-amber-100/80'
                        : 'border-white/20 bg-white/10 text-white backdrop-blur hover:bg-white/15')
                    }
                  >
                    <Megaphone className={`mt-0.5 size-4 shrink-0 ${important ? 'text-amber-600' : 'text-white/80'}`} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                        {a.title}
                        {important && <Badge className="bg-amber-500 text-white">PENTING</Badge>}
                        {isNew && (
                          <span
                            className={
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ' +
                              (important ? 'bg-emerald-600 text-white' : 'bg-amber-400 text-amber-950')
                            }
                          >
                            <Sparkles className="size-3" aria-hidden />
                            Baru
                          </span>
                        )}
                      </p>
                      <p className={`mt-0.5 line-clamp-2 text-xs ${important ? 'text-stone-600' : 'text-emerald-50/85'}`}>
                        {a.content}
                      </p>
                      <p className={`mt-1 text-[10px] ${important ? 'text-stone-400' : 'text-emerald-100/70'}`}>
                        {formatShortDate(a.createdAt)}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* ==== Body ==== */}
        {error ? (
          <div className="mt-6">
            <Alert variant="destructive" className="rounded-2xl">
              <AlertTriangle />
              <AlertTitle>Gagal memuat data portal</AlertTitle>
              <AlertDescription>
                {error}
                <Button variant="outline" size="sm" className="mt-1" onClick={() => void load(true)}>
                  <RefreshCw className="size-4" /> Coba Lagi
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : loading || !data ? (
          <div className="mt-6">
            <PortalSkeleton />
          </div>
        ) : data.students.length === 0 ? (
          <Card className="mt-6 rounded-2xl border-dashed">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="grid size-14 place-items-center rounded-full bg-stone-100">
                <User className="size-7 text-stone-400" />
              </span>
              <div>
                <p className="font-semibold text-stone-800">Belum ada santri terdaftar pada akun ini</p>
                <p className="mt-1 text-sm text-stone-500">
                  Data santri akan muncul setelah pendaftaran (PPDB) disetujui dan santri ditautkan ke akun wali Anda.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6">
            <div className="overflow-x-auto pb-1">
              <Tabs defaultValue={data.students[0]?.id}>
                <TabsList className="h-auto w-fit bg-white p-1 shadow-sm ring-1 ring-stone-200">
                  {data.students.map((s) => (
                    <TabsTrigger
                      key={s.id}
                      value={s.id}
                      className="gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm data-[state=active]:bg-emerald-700 data-[state=active]:text-white"
                    >
                      <User className="size-3.5" />
                      {s.fullName.split(' ')[0]}
                      {s.billing.pendingCount > 0 && <span className="size-2 rounded-full bg-amber-500" title="Ada tagihan pending" />}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {data.students.map((s) => (
                  <TabsContent key={s.id} value={s.id} className="mt-4 focus-visible:outline-none">
                    <ChildPanel child={s} activeSessions={sessions} onRefresh={() => void load()} />
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </div>
        )}

        {/* ==== WhatsApp notification inbox ==== */}
        {data && (
          <Card className="mt-8 rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
                  <MessageSquare className="size-4" />
                </span>
                Kotak Notifikasi WhatsApp
              </CardTitle>
              <CardDescription>Riwayat pesan yang dikirim sistem ke nomor terdaftar Anda.</CardDescription>
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={unreadCount === 0 || markingRead}
                  onClick={() => void markAllRead()}
                  className="rounded-lg border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  {markingRead ? <RefreshCw className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
                  Tandai semua dibaca
                  {unreadCount > 0 && (
                    <Badge className="ml-1 bg-amber-500 text-white">{unreadCount}</Badge>
                  )}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {data.notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl bg-stone-50 py-10 text-center">
                  <Inbox className="size-7 text-stone-300" />
                  <p className="text-sm text-stone-500">Belum ada pesan WhatsApp.</p>
                </div>
              ) : (
                <div className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
                  {data.notifications.map((n: NotificationLog) => (
                    <div
                      key={n.id}
                      className={
                        'flex gap-3 rounded-xl border p-3.5 transition-colors ' +
                        (n.readAt ? 'border-stone-100 bg-white hover:border-stone-200' : 'border-amber-200 bg-amber-50/60 hover:border-amber-300')
                      }
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                        <Smartphone className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-mono text-xs text-stone-500">
                          {n.phone || '—'}
                          {!n.readAt && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-800">
                              <span className="size-1.5 rounded-full bg-amber-500" /> Baru
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-stone-700">{renderBoldMessage(n.message)}</p>
                        <p className="mt-1.5 text-[11px] text-stone-400">{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
