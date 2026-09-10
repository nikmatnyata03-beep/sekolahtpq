'use client'

// Announcements ticker — infinite marquee of /api/announcements.
// PENTING items are highlighted in amber. Click an item to read the full content.

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Megaphone } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { apiGet, formatShortDate } from '@/lib/api-client'
import type { Announcement } from '@/lib/types'

export function AnnouncementsTicker() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Announcement | null>(null)

  useEffect(() => {
    let cancelled = false
    apiGet<Announcement[]>('/api/announcements')
      .then((data) => {
        if (!cancelled) setAnnouncements(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        // Ticker bersifat pelengkap — biarkan kosong saat gagal
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Jangan render apapun saat data belum siap / tidak ada pengumuman
  if (loading) {
    return (
      <div className="border-b border-amber-200/70 bg-amber-50/60">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="hidden h-4 w-1/4 sm:block" />
        </div>
      </div>
    )
  }

  if (!loading && announcements.length === 0) {
    return null
  }

  const importantCount = announcements.filter((a) => a.priority === 'PENTING').length

  return (
    <>
      <div className="relative border-b border-amber-200/70 bg-amber-50/70" aria-label="Pengumuman berjalan">
        <div className="mx-auto flex max-w-6xl items-center px-4">
          <div className="z-10 flex shrink-0 items-center gap-2 bg-amber-50/70 py-2.5 pr-3">
            <span className="flex size-7 items-center justify-center rounded-full bg-emerald-700 text-white shadow-sm">
              <Megaphone className="size-3.5" />
            </span>
            <span className="hidden text-xs font-bold uppercase tracking-wider text-emerald-900 md:block">
              Pengumuman
            </span>
            {importantCount > 0 && (
              <Badge className="border-transparent bg-amber-500 text-[10px] text-white">
                {importantCount} Penting
              </Badge>
            )}
          </div>

          <div className="min-w-0 flex-1 overflow-hidden" style={{ maskImage: 'linear-gradient(to right, transparent, black 4%, black 96%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 4%, black 96%, transparent)' }}>
            <motion.div
              className="flex w-max items-center py-2.5"
              animate={{ x: ['0%', '-50%'] }}
              transition={{ duration: Math.max(20, announcements.length * 8), ease: 'linear', repeat: Infinity }}
            >
              {[0, 1].map((copy) => (
                <div key={copy} className="flex items-center" aria-hidden={copy === 1}>
                  {announcements.map((item) => {
                    const isImportant = item.priority === 'PENTING'
                    return (
                      <button
                        key={`${copy}-${item.id}`}
                        type="button"
                        onClick={() => setSelected(item)}
                        className="group flex items-center gap-2 whitespace-nowrap px-4 text-sm outline-none"
                      >
                        {isImportant ? (
                          <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
                        ) : (
                          <Megaphone className="size-3.5 shrink-0 text-emerald-600" />
                        )}
                        <span
                          className={
                            isImportant
                              ? 'font-semibold text-amber-800 group-hover:underline group-hover:underline-offset-4'
                              : 'text-stone-600 group-hover:text-emerald-800 group-hover:underline group-hover:underline-offset-4'
                          }
                        >
                          {item.title}
                        </span>
                        <span className="ml-3 size-1.5 rotate-45 bg-emerald-400/70" aria-hidden="true" />
                      </button>
                    )
                  })}
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Detail pengumuman */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {selected.priority === 'PENTING' ? (
                    <Badge className="border-transparent bg-amber-500 text-white">
                      <AlertTriangle className="size-3" />
                      Penting
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                      <Megaphone className="size-3" />
                      Normal
                    </Badge>
                  )}
                  <span className="text-xs text-stone-500">{formatShortDate(selected.createdAt)}</span>
                </div>
                <DialogTitle className="text-left text-xl leading-snug text-emerald-950">{selected.title}</DialogTitle>
                <DialogDescription className="text-left">Pengumuman resmi dari TPQ Darul Jinan.</DialogDescription>
              </DialogHeader>
              <div className="max-h-72 overflow-y-auto rounded-xl bg-stone-50 p-4 text-sm leading-relaxed text-stone-700 whitespace-pre-line [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-200">
                {selected.content}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
