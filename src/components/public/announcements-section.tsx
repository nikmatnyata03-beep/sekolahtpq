'use client'

// Pengumuman publik — daftar pengumuman resmi dari /api/announcements.
// 3 terbaru sebagai kartu unggulan, sisanya sebagai daftar "Riwayat" ringkas.

import { useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  History,
  Megaphone,
  MessageCircle,
  RefreshCw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet, formatDate, formatShortDate } from '@/lib/api-client'
import { SectionHeading, StaggerGroup, StaggerItem } from './motion-primitives'
import type { Announcement } from '@/lib/types'

/** Badge prioritas — PENTING amber solid, NORMAL emerald outline. */
function PriorityBadge({ priority }: { priority: Announcement['priority'] }) {
  if (priority === 'PENTING') {
    return (
      <Badge className="border-transparent bg-amber-500 text-white">
        <AlertTriangle className="size-3" />
        Penting
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
      <BadgeCheck className="size-3" />
      Normal
    </Badge>
  )
}

export function AnnouncementsSection() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Announcement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<Announcement[]>('/api/announcements')
      setAnnouncements(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat pengumuman')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const featured = announcements.slice(0, 3)
  const rest = announcements.slice(3)

  return (
    <section id="pengumuman" aria-labelledby="pengumuman-heading" className="relative scroll-mt-20 overflow-hidden bg-stone-50 py-16">
      <div className="relative mx-auto max-w-6xl px-4">
        {/* Heading — kaskade dgn badge jumlah (ReactNode title) */}
        <SectionHeading
          badge="Pengumuman Resmi"
          tone="amber"
          id="pengumuman-heading"
          title={
            <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
              Pengumuman Terbaru
              {!loading && !error && announcements.length > 0 && (
                <Badge className="border-transparent bg-emerald-700 px-2.5 text-xs text-white">
                  <Megaphone className="size-3" />
                  {announcements.length} Pengumuman
                </Badge>
              )}
            </span>
          }
          subtitle={
            <>
              Pemberitahuan resmi dari TPQ Darul Jinan seputar jadwal kegiatan, libur, dan informasi
              penting lainnya untuk wali santri.
            </>
          }
        />

        {/* Error */}
        {error && !loading && (
          <div className="mx-auto mb-8 flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertCircle className="size-6 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => void load()}
            >
              <RefreshCw className="size-4" />
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3 md:gap-6">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        )}

        {/* Empty */}
        {!loading && !error && announcements.length === 0 && (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
            <Megaphone className="mx-auto size-10 text-stone-300" />
            <p className="mt-3 text-sm text-stone-500">Belum ada pengumuman.</p>
          </div>
        )}

        {/* Konten pengumuman */}
        {!loading && !error && announcements.length > 0 && (
          <div className="space-y-8">
            {/* 3 pengumuman terbaru — kartu unggulan */}
            <StaggerGroup className="grid gap-4 md:grid-cols-3 md:gap-6">
              {featured.map((item) => {
                const isImportant = item.priority === 'PENTING'
                return (
                  <StaggerItem key={item.id}>
                    <article
                      role="button"
                      tabIndex={0}
                      aria-label={`Baca pengumuman: ${item.title}`}
                      onClick={() => setSelected(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelected(item)
                        }
                      }}
                      className={
                        'group flex h-full cursor-pointer flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-emerald-600' +
                        (isImportant ? ' border-l-4 border-l-amber-400' : '')
                      }
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <PriorityBadge priority={item.priority} />
                        <span className="inline-flex items-center gap-1 text-[11px] text-stone-400">
                          <CalendarDays className="size-3.5 text-amber-600" aria-hidden="true" />
                          {formatShortDate(item.createdAt)}
                        </span>
                      </div>
                      <h3 className="mt-3 line-clamp-2 font-semibold leading-snug text-stone-800 transition-colors group-hover:text-emerald-800">
                        {item.title}
                      </h3>
                      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-stone-500">
                        {item.content.replace(/\s+/g, ' ').trim()}
                      </p>
                      <span className="mt-4 inline-flex items-center justify-end gap-1 border-t border-stone-100 pt-3 text-xs font-semibold text-emerald-700">
                        Baca selengkapnya
                        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </span>
                    </article>
                  </StaggerItem>
                )
              })}
            </StaggerGroup>

            {/* Riwayat pengumuman */}
            {rest.length > 0 && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-500">
                  <History className="size-3.5 text-emerald-600" aria-hidden="true" />
                  Riwayat Pengumuman
                </h3>
                <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                  <ul className="max-h-80 divide-y divide-stone-100 overflow-y-auto [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-200">
                    {rest.map((item) => {
                      const isImportant = item.priority === 'PENTING'
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => setSelected(item)}
                            aria-label={`Baca pengumuman: ${item.title}`}
                            className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors hover:bg-emerald-50/60 focus-visible:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                          >
                            {isImportant ? (
                              <AlertTriangle className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
                            ) : (
                              <BadgeCheck className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                            )}
                            <span
                              className={
                                'min-w-0 flex-1 truncate text-sm' +
                                (isImportant ? ' font-semibold text-amber-800' : ' text-stone-700')
                              }
                            >
                              {item.title}
                            </span>
                            <span className="hidden shrink-0 text-xs text-stone-400 sm:inline">
                              {formatShortDate(item.createdAt)}
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-stone-400" aria-hidden="true" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog detail pengumuman */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[88vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
          {selected && (
            <>
              <div className="p-6 pb-4">
                <DialogHeader className="text-left">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={selected.priority} />
                    <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                      <CalendarDays className="size-3.5 text-amber-600" aria-hidden="true" />
                      {formatDate(selected.createdAt)}
                    </span>
                  </div>
                  <DialogTitle className="text-left text-xl leading-snug text-emerald-950">
                    {selected.title}
                  </DialogTitle>
                  <DialogDescription className="text-left">
                    Pengumuman resmi dari TPQ Darul Jinan.
                  </DialogDescription>
                </DialogHeader>
              </div>
              <div className="max-h-[60vh] overflow-y-auto px-6 pb-6 text-sm leading-relaxed whitespace-pre-line text-stone-700 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-200">
                {selected.content}
              </div>
              <div className="border-t border-stone-100 bg-emerald-50/60 px-6 py-3">
                <p className="flex items-center justify-center gap-1.5 text-center text-xs font-medium text-emerald-800">
                  <MessageCircle className="size-3.5" aria-hidden="true" />
                  Dibagikan melalui Portal SIMADJI — TPQ Darul Jinan
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
