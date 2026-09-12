'use client'

// Berita & Kegiatan — artikel publik dari /api/posts?published=1.
// Tab kategori, kartu unggulan besar, grid artikel, dan dialog baca artikel.

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Heart,
  ImageOff,
  MessageCircle,
  Newspaper,
  RefreshCw,
  Send,
  Trash2,
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

/**
 * Task 66 — identitas pengunjung anonim untuk like (UUID di localStorage).
 * Tanpa login: satu perangkat = satu suara like per artikel.
 */
function getVisitorId(): string {
  if (typeof window === 'undefined') return ''
  let id = window.localStorage.getItem('dj_visitor_id')
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    window.localStorage.setItem('dj_visitor_id', id)
  }
  return id
}

/** Task 67 — bentuk komentar artikel ala sosial media. */
interface PostComment {
  id: string
  name: string
  content: string
  createdAt: string
}

/** Label waktu relatif gaya sosial media (Indonesia). */
function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return 'baru saja'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} menit lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam lalu`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} hari lalu`
  return formatDate(iso)
}

/**
 * Tombol like ala sosial media — hati terisi bila sudah disukai perangkat
 * ini. Klik TIDAK membuka dialog artikel (stopPropagation).
 */
function LikeButton({
  post,
  onToggled,
  size = 'sm',
}: {
  post: Post
  onToggled: (updated: Post) => void
  size?: 'sm' | 'md'
}) {
  const [busy, setBusy] = useState(false)
  async function toggle(e: React.MouseEvent | React.KeyboardEvent) {
    e.stopPropagation()
    if (busy) return
    setBusy(true)
    const visitorId = getVisitorId()
    // optimis: perbarui UI seketika, korreksi bila server menolak
    onToggled({ ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) })
    try {
      const res = await fetch('/api/posts/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, visitorId }),
      })
      if (res.ok) {
        const data = (await res.json()) as { liked: boolean; count: number }
        onToggled({ ...post, liked: data.liked, likes: data.count })
      }
    } catch {
      // jaringan gagal — biarkan nilai optimis (non-kritis)
    } finally {
      setBusy(false)
    }
  }
  return (
    <button
      type="button"
      role="button"
      aria-pressed={post.liked}
      aria-label={post.liked ? `Batalkan suka, ${post.likes} suka` : `Sukai artikel, ${post.likes} suka`}
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 rounded-full border transition-colors ${
        post.liked
          ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
          : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50 hover:text-stone-700'
      } ${size === 'md' ? 'px-4 py-2 text-sm' : 'px-2.5 py-1 text-xs'}`}
    >
      <Heart
        className={`${size === 'md' ? 'size-4' : 'size-3.5'} transition-transform ${post.liked ? 'fill-rose-500 text-rose-500 scale-110' : ''}`}
      />
      <span className="font-semibold tabular-nums">{post.likes}</span>
    </button>
  )
}

/**
 * Task 67 — kolom komentar ala sosial media di dialog baca artikel.
 * Publik: siapa pun bisa membaca & menulis (nama opsional, anti-spam 30 dtk).
 * ADMIN (cookie sesi domain sama): tombol hapus per komentar.
 */
function CommentsSection({ postId, isAdmin }: { postId: string; isAdmin: boolean }) {
  const [comments, setComments] = useState<PostComment[] | null>(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiGet<PostComment[]>(
        `/api/posts/comments?postId=${encodeURIComponent(postId)}`,
      )
      setComments(Array.isArray(data) ? data : [])
    } catch {
      setComments([])
    }
  }, [postId])

  useEffect(() => {
    setComments(null)
    setNotice(null)
    void load()
  }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = content.trim()
    if (!text || sending) return
    setSending(true)
    setNotice(null)
    try {
      const res = await fetch('/api/posts/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          visitorId: getVisitorId(),
          name: name.trim() || undefined,
          content: text,
        }),
      })
      const data = (await res.json().catch(() => null)) as
        | (PostComment & { error?: string })
        | { error?: string }
        | null
      if (!res.ok) {
        setNotice(data?.error ?? 'Gagal mengirim komentar, coba lagi.')
      } else if (data && 'id' in data) {
        setContent('')
        setComments((cs) => [...(cs ?? []), data as PostComment])
      }
    } catch {
      setNotice('Jaringan bermasalah — periksa koneksi dan coba lagi.')
    } finally {
      setSending(false)
    }
  }

  async function remove(id: string) {
    if (deletingId) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/posts/comments?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.ok) setComments((cs) => (cs ?? []).filter((c) => c.id !== id))
    } catch {
      // jaringan gagal — biarkan daftar tetap tampil
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
      <div className="mb-3 flex items-center gap-2">
        <MessageCircle className="size-4 text-emerald-700" />
        <h4 className="text-sm font-bold text-stone-800">
          Komentar
          {comments ? <span className="ml-1 font-normal text-stone-400">({comments.length})</span> : null}
        </h4>
      </div>

      {/* Form tulis komentar */}
      <form onSubmit={submit} className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="Nama (opsional)"
            aria-label="Nama untuk komentar"
            className="w-full rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 sm:w-44"
          />
          <div className="flex flex-1 gap-2">
            <input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={500}
              placeholder="Tulis komentar…"
              aria-label="Isi komentar"
              className="w-full flex-1 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!content.trim() || sending}
              aria-label="Kirim komentar"
              className="shrink-0 rounded-full bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-40"
            >
              {sending ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
        {notice && <p className="text-xs text-rose-600">{notice}</p>}
      </form>

      {/* Daftar komentar — tinggi maksimum + scroll halus */}
      <div className="mt-4 max-h-96 space-y-3 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-200">
        {comments === null && (
          <div className="space-y-2">
            <Skeleton className="h-12 rounded-xl bg-stone-200/60" />
            <Skeleton className="h-12 rounded-xl bg-stone-200/60" />
          </div>
        )}
        {comments !== null && comments.length === 0 && (
          <p className="py-2 text-center text-xs text-stone-400">
            Belum ada komentar. Jadilah yang pertama mengirim ucapan!
          </p>
        )}
        {comments?.map((c) => (
          <div
            key={c.id}
            className="flex items-start gap-2.5 rounded-xl border border-stone-100 bg-white p-3"
          >
            <div
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800"
              aria-hidden="true"
            >
              {c.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-semibold text-stone-700">{c.name}</span>
                <span className="shrink-0 text-[10px] text-stone-400">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-600">
                {c.content}
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => void remove(c.id)}
                disabled={deletingId === c.id}
                aria-label={`Hapus komentar dari ${c.name}`}
                className="shrink-0 rounded-full p-1.5 text-stone-300 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
              >
                {deletingId === c.id ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
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
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:group-hover:scale-100"
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
  const [isAdmin, setIsAdmin] = useState(false)

  // Task 67 — deteksi ADMIN (cookie sesi domain sama) untuk tombol hapus komentar.
  useEffect(() => {
    apiGet<{ role?: string }>('/api/auth/me')
      .then((u) => setIsAdmin(u?.role === 'ADMIN'))
      .catch(() => setIsAdmin(false))
  }, [])

  /** Task 66 — perbarui satu post di state (hasil toggle like). */
  function patchPost(updated: Post) {
    setPosts((ps) => ps.map((p) => (p.id === updated.id ? updated : p)))
    setSelected((s) => (s && s.id === updated.id ? updated : s))
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<Post[]>(`/api/posts?published=1&visitorId=${encodeURIComponent(getVisitorId())}`)
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
                className="group grid cursor-pointer overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-emerald-600 md:grid-cols-2"
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
                  {/* Task 66 — like ala sosial media */}
                  <div className="mt-1 flex items-center gap-2">
                    <LikeButton post={featured} onToggled={patchPost} size="md" />
                  </div>
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
                      {/* Task 66 — like ala sosial media */}
                      <span className="mt-1">
                        <LikeButton post={post} onToggled={patchPost} />
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
                {/* Task 66 — like di dialog baca artikel */}
                {selected && (
                  <div className="mt-4 flex justify-center">
                    <LikeButton post={selected} onToggled={patchPost} size="md" />
                  </div>
                )}
                {/* Task 67 — komentar ala sosial media */}
                {selected && <CommentsSection postId={selected.id} isAdmin={isAdmin} />}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
