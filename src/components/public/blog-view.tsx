'use client'

// Blog TPQ Darul Jinan — halaman blog TERPISAH untuk Berita, Kegiatan, dan
// Artikel (Task 63). Dirender sebagai view SPA penuh oleh root / (tanpa route
// Next.js baru — aturan sandbox), tetapi deep-linkable & shareable lewat
// query param: /?page=blog (daftar) dan /?page=blog&slug=… (detail artikel).
// Back/forward browser didukung via pushState + popstate.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  ImageOff,
  Link2,
  MoonStar,
  Newspaper,
  Search,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { apiGet, formatDate } from '@/lib/api-client'
import type { Post } from '@/lib/types'
import { DEFAULT_PORTAL_SETTINGS } from '@/lib/portal-settings'

const CATEGORY_BADGE: Record<string, string> = {
  BERITA: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  KEGIATAN: 'border-amber-200 bg-amber-50 text-amber-800',
  ARTIKEL: 'border-teal-200 bg-teal-50 text-teal-800',
}

const CATEGORIES = ['SEMUA', 'BERITA', 'KEGIATAN', 'ARTIKEL'] as const

function excerpt(content: string | null | undefined, max = 160): string {
  if (!content) return ''
  const plain = content.replace(/\s+/g, ' ').trim()
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}…` : plain
}

function categoryBadge(category: string | undefined): string {
  return CATEGORY_BADGE[category ?? ''] ?? 'border-stone-200 bg-stone-50 text-stone-600'
}

/** Warna merek dari CMS — blog ikut tema portal (fallback zamrud bawaan). */
function useBrand() {
  const [brand, setBrand] = useState(DEFAULT_PORTAL_SETTINGS.theme)
  useEffect(() => {
    apiGet<{ theme?: { primary?: string; accent?: string } }>('/api/settings')
      .then((s) => {
        if (s?.theme?.primary) {
          setBrand({ primary: s.theme.primary, accent: s.theme.accent ?? DEFAULT_PORTAL_SETTINGS.theme.accent })
        }
      })
      .catch(() => {})
  }, [])
  return brand
}

/** Sampul artikel dengan fallback gradien — <img> pola sesuai kontrak. */
function CoverImage({
  src,
  alt,
  className,
  brand,
}: {
  src: string | null | undefined
  alt: string
  className?: string
  brand: { primary: string; accent: string }
}) {
  return (
    <div
      className={`relative overflow-hidden ${className ?? ''}`}
      style={{ backgroundImage: `linear-gradient(135deg, ${brand.primary}, color-mix(in srgb, ${brand.primary} 60%, black))` }}
    >
      {src ? (
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
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-white/40" aria-hidden="true">
          <span className="font-serif text-xl">اَلْعِلْمُ نُوْرٌ</span>
          <span className="text-[10px] uppercase tracking-widest">TPQ Darul Jinan</span>
        </div>
      )}
    </div>
  )
}

export function BlogView() {
  const brand = useBrand()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('SEMUA')
  const [query, setQuery] = useState('')
  const [slug, setSlug] = useState<string | null>(() => {
    // Deep-link awal: /?page=blog&slug=… dibaca saat render pertama (aman —
    // BlogView hanya dirender setelah hydration gate di page.tsx).
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    return params.get('page') === 'blog' ? params.get('slug') : null
  })
  const [copied, setCopied] = useState(false)

  /** Sinkronkan detail/daftar saat tombol back/forward browser (popstate). */
  useEffect(() => {
    function onPopState() {
      const params = new URLSearchParams(window.location.search)
      if (params.get('page') === 'blog') setSlug(params.get('slug'))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    let cancelled = false
    apiGet<Post[]>('/api/posts?published=1')
      .then((data) => {
        if (!cancelled) setPosts(Array.isArray(data) ? data : [])
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Gagal memuat artikel')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** Navigasi detail/daftar — pushState agar tombol back browser bekerja. */
  function openArticle(targetSlug: string) {
    const url = `/?page=blog&slug=${encodeURIComponent(targetSlug)}`
    window.history.pushState({ slug: targetSlug }, '', url)
    setSlug(targetSlug)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function openList() {
    window.history.pushState({ slug: null }, '', '/?page=blog')
    setSlug(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return posts
      .filter((p) => (category === 'SEMUA' ? true : p.category === category))
      .filter((p) =>
        !q
          ? true
          : p.title.toLowerCase().includes(q) || (p.content ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [posts, category, query])

  const selected = useMemo(
    () => (slug ? posts.find((p) => p.slug === slug) ?? null : null),
    [slug, posts],
  )

  const related = useMemo(() => {
    if (!selected) return []
    return posts
      .filter((p) => p.id !== selected.id && p.category === selected.category)
      .slice(0, 3)
  }, [posts, selected])

  const featured = useMemo(() => (category === 'SEMUA' && !query.trim() ? filtered[0] : null), [filtered, category, query])
  const rest = useMemo(() => (featured ? filtered.slice(1) : filtered), [filtered, featured])

  async function shareArticle() {
    if (!selected) return
    const url = `${window.location.origin}/?page=blog&slug=${encodeURIComponent(selected.slug)}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard ditolak — biarkan tombol kembali normal
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-stone-50 text-stone-800" style={{ '--brand': brand.primary, '--brand-accent': brand.accent } as React.CSSProperties}>
      {/* ===== Header blog ===== */}
      <header className="sticky top-0 z-40 border-b bg-white/90 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/75" style={{ borderColor: `color-mix(in srgb, ${brand.primary} 18%, white)` }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900" onClick={() => (slug ? openList() : (window.location.href = '/'))}>
            <ArrowLeft className="size-4" />
            {slug ? 'Semua Artikel' : 'Beranda'}
          </Button>
          <span className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg text-white shadow-sm" style={{ backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${brand.primary} 70%, black), ${brand.primary})` }}>
              <BookOpen className="size-4" />
            </span>
            <span className="text-sm font-extrabold tracking-tight" style={{ color: brand.primary }}>
              Blog TPQ Darul Jinan
            </span>
          </span>
          <Button variant="outline" size="sm" className="border-stone-200 text-stone-600 hover:bg-stone-50" onClick={() => (window.location.href = '/')}>
            <MoonStar className="size-4" />
            Portal
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-10 w-full max-w-md rounded-xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-72 rounded-2xl" />
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
            {error} — coba muat ulang halaman.
          </div>
        ) : selected ? (
          /* ============ DETAIL ARTIKEL ============ */
          <article className="mx-auto max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <Badge variant="outline" className={categoryBadge(selected.category)}>
                {selected.category}
              </Badge>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {formatDate(selected.createdAt)}
              </span>
              {selected.author?.fullName && (
                <span className="inline-flex items-center gap-1">
                  <User className="size-3.5" />
                  {selected.author.fullName}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-stone-900 sm:text-3xl">
              {selected.title}
            </h1>
            <CoverImage src={selected.coverImage} alt={selected.title} brand={brand} className="mt-5 h-52 w-full rounded-2xl shadow-sm sm:h-72" />
            <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-stone-700">
              {(selected.content ?? '').split(/\n{1,}/).filter(Boolean).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-stone-200 pt-5">
              <Button variant="outline" size="sm" className="border-stone-200 text-stone-600 hover:bg-stone-50" onClick={() => void shareArticle()}>
                {copied ? <Check className="size-4 text-emerald-600" /> : <Link2 className="size-4" />}
                {copied ? 'Tautan tersalin' : 'Bagikan artikel'}
              </Button>
              <Button variant="outline" size="sm" className="border-stone-200 text-stone-600 hover:bg-stone-50" onClick={openList}>
                <ArrowLeft className="size-4" />
                Kembali ke daftar
              </Button>
            </div>

            {related.length > 0 && (
              <section className="mt-10" aria-label="Artikel terkait">
                <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-stone-400">Artikel terkait</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {related.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openArticle(p.slug)}
                      className="group overflow-hidden rounded-xl border border-stone-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md"
                    >
                      <CoverImage src={p.coverImage} alt={p.title} brand={brand} className="h-28 w-full" />
                      <span className="block p-3">
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest" style={{ color: brand.primary }}>
                          {p.category}
                        </span>
                        <span className="line-clamp-2 block text-sm font-semibold text-stone-800 group-hover:underline">{p.title}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </article>
        ) : (
          /* ============ DAFTAR ARTIKEL ============ */
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
                  <Newspaper className="size-6" style={{ color: brand.primary }} />
                  Berita & Artikel
                </h1>
                <p className="mt-1 text-sm text-stone-500">
                  {posts.length} artikel terbit — kabar kegiatan, tulisan ustadz, dan informasi TPQ.
                </p>
              </div>
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari artikel…"
                  className="pl-9"
                  aria-label="Cari artikel"
                />
              </div>
            </div>

            <Tabs value={category} onValueChange={setCategory} className="mt-5">
              <TabsList className="h-auto min-h-9 flex-wrap justify-start">
                {CATEGORIES.map((c) => (
                  <TabsTrigger key={c} value={c}>
                    {c === 'SEMUA' ? 'Semua' : c.charAt(0) + c.slice(1).toLowerCase()}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {filtered.length === 0 ? (
              <p className="mt-10 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center text-sm text-stone-400">
                Tidak ada artikel yang cocok dengan pencarian.
              </p>
            ) : (
              <>
                {featured && (
                  <button
                    type="button"
                    onClick={() => openArticle(featured.slug)}
                    className="group mt-6 grid w-full overflow-hidden rounded-2xl border border-stone-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md sm:grid-cols-2"
                  >
                    <CoverImage src={featured.coverImage} alt={featured.title} brand={brand} className="h-52 w-full sm:h-full" />
                    <span className="flex flex-col justify-center gap-3 p-6">
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className={categoryBadge(featured.category)}>
                          {featured.category}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-stone-400">
                          <CalendarDays className="size-3.5" />
                          {formatDate(featured.createdAt)}
                        </span>
                      </span>
                      <span className="text-lg font-extrabold leading-snug text-stone-900 group-hover:underline sm:text-xl">
                        {featured.title}
                      </span>
                      <span className="line-clamp-3 text-sm leading-relaxed text-stone-500">{excerpt(featured.content)}</span>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: brand.primary }}>
                        Baca selengkapnya
                        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </span>
                  </button>
                )}

                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openArticle(p.slug)}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md"
                    >
                      <CoverImage src={p.coverImage} alt={p.title} brand={brand} className="h-40 w-full" />
                      <span className="flex flex-1 flex-col gap-2 p-4">
                        <span className="flex items-center gap-2">
                          <Badge variant="outline" className={categoryBadge(p.category)}>
                            {p.category}
                          </Badge>
                          <span className="inline-flex items-center gap-1 text-[11px] text-stone-400">
                            <CalendarDays className="size-3" />
                            {formatDate(p.createdAt)}
                          </span>
                        </span>
                        <span className="line-clamp-2 text-sm font-bold leading-snug text-stone-800 group-hover:underline">{p.title}</span>
                        <span className="line-clamp-3 text-xs leading-relaxed text-stone-500">{excerpt(p.content, 120)}</span>
                        {p.author?.fullName && (
                          <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[11px] text-stone-400">
                            <User className="size-3" />
                            {p.author.fullName}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </main>

      <footer className="border-t border-stone-200 bg-white py-4">
        <p className="mx-auto max-w-5xl px-4 text-center text-[11px] text-stone-400">
          © 2025 TPQ Darul Jinan · Blog — dikelola melalui SIMADJI
        </p>
      </footer>
    </div>
  )
}
