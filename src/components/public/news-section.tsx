'use client'

// Berita & Kegiatan — artikel publik dari /api/posts?published=1.
// Tab kategori, kartu unggulan besar, grid artikel, dan dialog baca artikel.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  ChevronRight,
  ImageOff,
  Newspaper,
  RefreshCw,
  User,
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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiGet, formatDate } from '@/lib/api-client'
import type { Post } from '@/lib/types'

const CATEGORY_BADGE: Record<string, string> = {
  BERITA: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  KEGIATAN: 'border-amber-200 bg-amber-50 text-amber-800',
  ARTIKEL: 'border-teal-200 bg-teal-50 text-teal-800',
}

function excerpt(content: string | null | undefined, max = 150): string {
  if (!content) return ''
  const plain = content.replace(/\s+/g, ' ').trim()
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain
}

function categoryBadge(category: string | undefined): string {
  return CATEGORY_BADGE[category ?? ''] ?? 'border-stone-200 bg-stone-50 text-stone-600'
}

/** Cover image dengan fallback gradien — <img> pola sesuai kontrak (tanpa next/image). */
function CoverImage({
  src,
  alt,
  className,
}: {
  src: string | null | undefined
  alt: string
  className?: string
}) {
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-800 to-emerald-950 ${className ?? ''}`}>
      {src ? (
        // <img> pola sengaja dipakai (bukan next/image) agar cover eksternal tidak butuh konfigurasi domain
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 hover:scale-105"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-emerald-200/50" aria-hidden="true">
          <span className="font-serif text-xl">اَلْعِلْمُ نُوْرٌ</span>
          <span className="text-[10px] uppercase tracking-widest">TPQ Darul Jinan</span>
        </div>
      )}
    </div>
  )
}

export function NewsSection() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<string>('SEMUA')
  const [selected, setSelected] = useState<Post | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<Post[]>('/api/posts?published=1')
      setPosts(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat berita')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    return tab === 'SEMUA' ? posts : posts.filter((p) => p.category === tab)
  }, [posts, tab])

  const featured = filtered[0]
  const rest = filtered.slice(1)

  return (
    <section id="berita" className="scroll-mt-20 bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        {/* Heading */}
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="mb-3 inline-block rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700">
            Berita &amp; Kegiatan
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-stone-800">Kabar Darul Jinan</h2>
          <p className="mt-3 text-muted-foreground">
            Ikuti kabar terbaru, kegiatan santri, dan artikel seputar pendidikan Al-Qur&apos;an.
          </p>
          {/* Task 63 — blog terpisah: tautan ke halaman blog penuh */}
          <Button asChild size="sm" variant="outline" className="mt-4 border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
            <a href="/?page=blog">
              <BookOpen className="size-4" />
              Buka Blog Lengkap
            </a>
          </Button>
        </div>

        {/* Tabs kategori */}
        <div className="mb-8 flex justify-center">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto flex-wrap justify-center border border-stone-200 bg-stone-100/80">
              {['SEMUA', 'BERITA', 'KEGIATAN', 'ARTIKEL'].map((cat) => (
                <TabsTrigger key={cat} value={cat} className="px-4 py-1.5 text-xs sm:text-sm">
                  {cat === 'SEMUA' ? 'Semua' : cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-auto mb-8 flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertCircle className="size-6 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
            <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100" onClick={() => void load()}>
              <RefreshCw className="size-4" />
              Coba Lagi
            </Button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-6">
            <Skeleton className="h-72 rounded-2xl" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
            <Newspaper className="mx-auto size-10 text-stone-300" />
            <p className="mt-3 text-sm text-stone-500">
              {posts.length === 0
                ? 'Belum ada berita yang dipublikasikan. Nantikan kabar menarik dari kami.'
                : 'Belum ada artikel pada kategori ini.'}
            </p>
          </div>
        )}

        {/* Konten berita */}
        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-8">
            {/* Kartu unggulan */}
            {featured && (
              <article
                role="button"
                tabIndex={0}
                onClick={() => setSelected(featured)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelected(featured)
                  }
                }}
                className="grid cursor-pointer overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-emerald-600 md:grid-cols-2"
              >
                <CoverImage
                  src={featured.coverImage}
                  alt={featured.title}
                  className="h-56 md:h-full md:min-h-[20rem]"
                />
                <div className="flex flex-col justify-center gap-3 p-6 md:p-10">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={categoryBadge(featured.category)}>
                      {featured.category}
                    </Badge>
                    <Badge className="border-transparent bg-amber-500 text-white">Unggulan</Badge>
                  </div>
                  <h3 className="text-2xl font-bold leading-snug text-stone-800 md:text-3xl">{featured.title}</h3>
                  <p className="line-clamp-3 text-sm leading-relaxed text-stone-500">{excerpt(featured.content, 180)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
                    <span className="inline-flex items-center gap-1">
                      <User className="size-3.5 text-emerald-600" />
                      {featured.author?.fullName ?? 'Admin TPQ'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5 text-amber-600" />
                      {formatDate(featured.createdAt)}
                    </span>
                  </div>
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                    Baca Selengkapnya
                    <ChevronRight className="size-4" />
                  </span>
                </div>
              </article>
            )}

            {/* Grid artikel lainnya */}
            {rest.length > 0 && (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((post) => (
                  <article
                    key={post.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(post)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelected(post)
                      }
                    }}
                    className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <CoverImage src={post.coverImage} alt={post.title} className="h-44" />
                    <div className="flex flex-1 flex-col gap-2 p-5">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline" className={categoryBadge(post.category)}>
                          {post.category}
                        </Badge>
                        <span className="text-[11px] text-stone-400">{formatDate(post.createdAt)}</span>
                      </div>
                      <h3 className="line-clamp-2 font-semibold leading-snug text-stone-800 transition-colors group-hover:text-emerald-800">
                        {post.title}
                      </h3>
                      <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-stone-500">{excerpt(post.content)}</p>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        Baca Artikel
                        <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog baca artikel */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto p-0 sm:max-w-2xl [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-200">
          {selected && (
            <>
              <CoverImage src={selected.coverImage} alt={selected.title} className="h-56 w-full rounded-t-lg sm:h-64" />
              <div className="p-6">
                <DialogHeader className="text-left">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={categoryBadge(selected.category)}>
                      {selected.category}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                      <CalendarDays className="size-3.5 text-amber-600" />
                      {formatDate(selected.createdAt)}
                    </span>
                  </div>
                  <DialogTitle className="text-2xl leading-snug text-stone-800">{selected.title}</DialogTitle>
                  <DialogDescription className="flex items-center gap-1.5">
                    <User className="size-3.5 text-emerald-600" />
                    {selected.author?.fullName ?? 'Admin TPQ Darul Jinan'}
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <div className="space-y-4">
                  {(selected.content ?? '')
                    .split('\n\n')
                    .filter((p) => p.trim())
                    .map((paragraph, i) => (
                      <p key={i} className="text-sm leading-relaxed text-stone-700">
                        {paragraph.trim()}
                      </p>
                    ))}
                  {!selected.content && (
                    <p className="flex items-center gap-2 text-sm italic text-stone-400">
                      <ImageOff className="size-4" />
                      Konten artikel belum tersedia.
                    </p>
                  )}
                </div>
                <p className="mt-6 text-center font-serif text-emerald-800" dir="rtl" lang="ar">
                  وَقُل رَّبِّ زِدْنِي عِلْمًا
                </p>
                {/* Task 63 — buka artikel ini di halaman blog penuh */}
                <div className="mt-4 text-center">
                  <a
                    href={`/?page=blog&slug=${encodeURIComponent(selected.slug)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    <BookOpen className="size-3.5" />
                    Buka di Blog — halaman penuh
                  </a>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
