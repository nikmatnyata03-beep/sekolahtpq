'use client'

/**
 * Panel Presensi Live — dasbor real-time kehadiran santri.
 * Tenaga di balik layar: Cloudflare Durable Objects (PresenceHub) + WebSocket
 * hibernation; lokal/dev otomatis jatuh ke mode polling REST.
 * Akses: ADMIN, GURU.
 */

import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  QrCode,
  Users,
  CalendarCheck,
  Radio,
  RadioTower,
  RefreshCw,
  UserCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { usePresenceFeed, type PresenceEvent } from '@/hooks/use-presence'
import { wibTime } from '@/lib/wib'

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function statusBadgeClass(status?: string): string {
  if (status === 'HADIR') return 'bg-emerald-100 text-emerald-800 border-emerald-200'
  if (status === 'IZIN' || status === 'SAKIT') return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-stone-100 text-stone-700 border-stone-200'
}

function avatarClass(status?: string): string {
  if (status === 'HADIR') return 'bg-emerald-100 text-emerald-700'
  if (status === 'IZIN' || status === 'SAKIT') return 'bg-amber-100 text-amber-700'
  return 'bg-stone-200 text-stone-600'
}

function ModeBadge({ mode }: { mode: 'connecting' | 'live' | 'polling' }) {
  if (mode === 'live') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        LIVE — Real-time
      </span>
    )
  }
  if (mode === 'polling') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
        <RefreshCw className="h-3 w-3" />
        Mode Polling — 10 dtk
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-600">
      <RefreshCw className="h-3 w-3 animate-spin" />
      Menyambungkan…
    </span>
  )
}

function EventRow({ event, isNew }: { event: PresenceEvent; isNew: boolean }) {
  const time = wibTime(new Date(event.at))

  if (event.type === 'session_open' || event.type === 'session_close') {
    const isOpen = event.type === 'session_open'
    return (
      <div className={`flex items-start gap-3 rounded-lg border p-3 ${isOpen ? 'border-amber-200 bg-amber-50/60' : 'border-stone-200 bg-stone-50'}`}>
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isOpen ? 'bg-amber-100 text-amber-700' : 'bg-stone-200 text-stone-600'}`}>
          <QrCode className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-stone-800">
            {isOpen ? 'Sesi QR dibuka' : 'Sesi QR ditutup'} — kelas {event.className}
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            Kode <span className="font-mono">{event.sessionCode}</span>
            {event.actor ? ` oleh ${event.actor}` : ''} • {time} WIB
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-start gap-3 rounded-lg border border-emerald-100 bg-white p-3 transition-colors ${isNew ? 'hover:bg-emerald-50/40' : ''}`}>
      <Avatar className="h-9 w-9">
        <AvatarFallback className={avatarClass(event.status)}>{initials(event.studentName ?? '?')}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-stone-800">{event.studentName}</p>
          <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(event.status)}`}>
            {event.status ?? 'HADIR'}
          </Badge>
          {isNew && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              baru
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-stone-500">
          Kelas {event.className} • {time} WIB •{' '}
          <span className="font-mono text-[10px] text-stone-400">{event.sessionCode}</span>
        </p>
      </div>
      <UserCheck className={`mt-1 h-4 w-4 shrink-0 ${event.status === 'HADIR' ? 'text-emerald-500' : 'text-stone-300'}`} />
    </div>
  )
}

export function PresenceLivePanel() {
  const { events, snapshot, mode } = usePresenceFeed()
  const stats = snapshot?.stats
  const activeSessions = snapshot?.activeSessions ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-stone-800">
            <RadioTower className="h-5 w-5 text-emerald-600" />
            Presensi Live
          </h2>
          <p className="mt-0.5 text-sm text-stone-500">
            Kehadiran santri masuk seketika ke dasbor semua pengajar — tanpa refresh.
          </p>
        </div>
        <ModeBadge mode={mode} />
      </div>

      {/* Statistik */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Hadir Hari Ini', value: stats?.hadir, icon: UserCheck, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
          { label: 'Sesi Aktif', value: stats?.sesiAktif, icon: QrCode, cls: 'bg-amber-50 text-amber-700 border-amber-100' },
          { label: 'Total Tercatat', value: stats?.tercatat, icon: CalendarCheck, cls: 'bg-stone-50 text-stone-700 border-stone-200' },
          { label: 'Santri Aktif', value: stats?.santriAktif, icon: Users, cls: 'bg-stone-50 text-stone-700 border-stone-200' },
        ].map((s) => (
          <Card key={s.label} className={`border ${s.cls}`}>
            <CardContent className="flex items-center gap-3 p-4">
              <s.icon className="h-5 w-5 shrink-0" />
              <div className="min-w-0">
                {s.value === undefined ? (
                  <Skeleton className="h-6 w-8" />
                ) : (
                  <p className="text-2xl font-bold leading-none">{s.value}</p>
                )}
                <p className="mt-1 truncate text-xs font-medium opacity-80">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sesi aktif */}
      {activeSessions.length > 0 && (
        <Card className="border-amber-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <QrCode className="h-4 w-4 text-amber-600" />
              Sesi Absensi Aktif
            </CardTitle>
            <CardDescription>Kelas yang sedang membuka check-in QR</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {activeSessions.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800"
              >
                {s.className}
                <span className="font-semibold text-emerald-700">{s.hadir} hadir</span>
                {s.topic ? <span className="hidden text-amber-600 sm:inline">• {s.topic}</span> : null}
              </span>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Feed real-time */}
      <Card className="border-emerald-100">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4 text-emerald-600" />
            Kehadiran Real-time
          </CardTitle>
          <CardDescription>
            {mode === 'live'
              ? 'Terhubung langsung ke server — setiap check-in tampil seketika.'
              : 'Data diperbarui otomatis setiap beberapa detik (fallback).'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-stone-200 bg-stone-50 py-10 text-center">
              <Radio className="h-8 w-8 text-stone-300" />
              <p className="text-sm font-medium text-stone-500">Belum ada kehadiran hari ini</p>
              <p className="max-w-xs text-xs text-stone-400">
                Buka sesi QR di menu Absensi, lalu kehadiran santri akan mengalir masuk ke sini.
              </p>
            </div>
          ) : (
            <ul className="max-h-96 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
              <AnimatePresence initial={false}>
                {events.map((e, i) => (
                  <motion.li
                    key={e.id}
                    layout
                    initial={{ opacity: 0, y: -12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="list-none"
                  >
                    <EventRow event={e} isNew={i === 0} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-stone-400">
        Panel ini memakai Cloudflare <strong>Durable Objects + WebSocket hibernation</strong> (tier gratis).
        Bila koneksi real-time tidak tersedia, data otomatis diperbarui lewat polling aman setiap 10 detik.
      </p>
    </div>
  )
}
