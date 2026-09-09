'use client'

// Materi Ajar — katalog materi publik dari /api/materials dengan pencarian teks,
// filter kategori (chips), kelas (select), dan pengurutan. Setiap kartu punya tautan unduh.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  BookOpen,
  Download,
  FileText,
  FolderOpen,
  Music,
  Presentation,
  RefreshCw,
  Search,
  SearchX,
  User,
  Video,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiGet } from '@/lib/api-client'
import type { ClassRoom, Material } from '@/lib/types'

const CATEGORIES = ['TAJWID', 'HAFALAN', 'IBADAH', 'AKHLAK'] as const

const CATEGORY_STYLES: Record<string, string> = {
  TAJWID: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  HAFALAN: 'border-amber-200 bg-amber-50 text-amber-800',
  IBADAH: 'border-teal-200 bg-teal-50 text-teal-800',
  AKHLAK: 'border-rose-200 bg-rose-50 text-rose-800',
}

const TYPE_META: Record<string, { icon: typeof FileText; box: string; label: string }> = {
  PDF: { icon: FileText, box: 'bg-red-50 text-red-600', label: 'Dokumen PDF' },
  SLIDE: { icon: Presentation, box: 'bg-amber-50 text-amber-600', label: 'Presentasi' },
  VIDEO: { icon: Video, box: 'bg-teal-50 text-teal-600', label: 'Video' },
  AUDIO: { icon: Music, box: 'bg-emerald-50 text-emerald-600', label: 'Audio' },
}

export function MaterialsSection() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [classes, setClasses] = useState<ClassRoom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('SEMUA')
  const [classId, setClassId] = useState<string>('SEMUA')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<string>('TERBARU')
  const searchRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [materialData, classData] = await Promise.all([
        apiGet<Material[]>('/api/materials'),
        apiGet<ClassRoom[]>('/api/classes'),
      ])
      setMaterials(Array.isArray(materialData) ? materialData : [])
      setClasses(Array.isArray(classData) ? classData : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat materi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Pencarian teks + filter kategori/kelas + pengurutan — fungsi murni dari state
  // dan data hasil fetch (tanpa Date.now/wall-clock) sehingga aman terhadap hydration.
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('id-ID')
    const list = materials.filter((m) => {
      const matchCategory = category === 'SEMUA' || (m.category ?? '').toUpperCase() === category
      const matchClass = classId === 'SEMUA' || m.classId === classId || (!m.classId && classId === 'UMUM')
      if (!matchCategory || !matchClass) return false
      if (q === '') return true
      const haystack = `${m.title} ${m.description ?? ''} ${m.category ?? ''}`.toLocaleLowerCase('id-ID')
      return haystack.includes(q)
    })
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'TERLAMA':
          return a.createdAt.localeCompare(b.createdAt)
        case 'JUDUL_ASC':
          return a.title.localeCompare(b.title, 'id')
        case 'JUDUL_DESC':
          return b.title.localeCompare(a.title, 'id')
        default: // TERBARU (default)
          return b.createdAt.localeCompare(a.createdAt)
      }
    })
  }, [materials, category, classId, query, sort])

  const searchActive = query.trim() !== ''

  const clearSearch = () => {
    setQuery('')
    searchRef.current?.focus()
  }

  // Reset pencarian + semua filter ke nilai awal, lalu kembalikan fokus ke input pencarian.
  const resetFilters = () => {
    setQuery('')
    setCategory('SEMUA')
    setClassId('SEMUA')
    searchRef.current?.focus()
  }

  return (
    <section id="materi" className="scroll-mt-20 bg-stone-50 py-16">
      <div className="mx-auto max-w-6xl px-4">
        {/* Heading */}
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="mb-3 inline-block rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700">
            Materi Ajar
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-stone-800">Perpustakaan Materi Belajar</h2>
          <p className="mt-3 text-muted-foreground">
            Unduh modul, tayangan, video, dan audio pembelajaran Al-Qur&apos;an untuk menemani belajar
            santri di rumah.
          </p>
        </div>

        {/* Filter: kategori (chips) + pencarian + urutan + kelas */}
        <div className="mb-6 flex flex-col items-center gap-3 lg:flex-row lg:flex-wrap lg:justify-between">
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Filter kategori materi">
            {(['SEMUA', ...CATEGORIES] as const).map((cat) => {
              const active = category === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-all ${
                    active
                      ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                      : 'border-stone-200 bg-white text-stone-600 hover:border-emerald-300 hover:text-emerald-700'
                  }`}
                >
                  {cat === 'SEMUA' ? 'Semua' : cat}
                </button>
              )
            })}
          </div>
          <div className="flex w-full flex-wrap items-center justify-center gap-2 lg:w-auto lg:justify-end">
            <div className="relative w-full sm:w-[240px]">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400"
                aria-hidden="true"
              />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari materi…"
                aria-label="Cari materi"
                className="min-h-11 rounded-xl border-stone-200 bg-white pl-9 pr-10"
              />
              {query !== '' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={clearSearch}
                  aria-label="Bersihkan pencarian"
                  className="absolute right-0.5 top-1/2 size-8 -translate-y-1/2 rounded-full text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger
                className="w-[170px] min-h-11 rounded-xl border-stone-200 bg-white"
                aria-label="Urutkan materi"
              >
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TERBARU">Terbaru</SelectItem>
                <SelectItem value="TERLAMA">Terlama</SelectItem>
                <SelectItem value="JUDUL_ASC">Judul A-Z</SelectItem>
                <SelectItem value="JUDUL_DESC">Judul Z-A</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-stone-500">Kelas:</span>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger
                  className="w-[190px] min-h-11 rounded-xl border-stone-200 bg-white"
                  aria-label="Filter kelas materi"
                >
                  <SelectValue placeholder="Semua Kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SEMUA">Semua Kelas</SelectItem>
                  <SelectItem value="UMUM">Umum / Semua Kelas</SelectItem>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Jumlah hasil (aria-live: diumumkan pembaca layar saat berubah) */}
        {!loading && !error && (
          <p className="mb-6 text-right text-xs text-stone-500" aria-live="polite">
            {filtered.length === 1 ? '1 materi ditemukan' : `${filtered.length} materi ditemukan`}
          </p>
        )}

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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-56 rounded-2xl" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-stone-300 bg-white p-10 text-center">
            {materials.length === 0 ? (
              <FolderOpen className="mx-auto size-10 text-stone-300" />
            ) : (
              <SearchX className="mx-auto size-10 text-stone-300" />
            )}
            <p className="mt-3 text-sm text-stone-500">
              {materials.length === 0
                ? 'Belum ada materi yang diunggah. Nantikan materi belajar dari ustadz dan ustadzah kami.'
                : searchActive
                  ? `Tidak ada materi yang cocok dengan pencarian "${query}"`
                  : 'Tidak ada materi yang cocok dengan filter ini. Coba ubah kategori atau kelas.'}
            </p>
            {materials.length > 0 && searchActive && (
              <Button
                type="button"
                variant="outline"
                onClick={resetFilters}
                className="mt-4 min-h-11 border-stone-300 bg-white text-stone-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50/60 hover:text-emerald-700"
              >
                Hapus pencarian
              </Button>
            )}
          </div>
        )}

        {/* Grid materi */}
        {!loading && !error && filtered.length > 0 && (
          <div className="max-h-[38rem] overflow-y-auto pb-2 pr-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-emerald-200 [&::-webkit-scrollbar-track]:bg-transparent">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((m) => {
                const meta = TYPE_META[m.type] ?? TYPE_META.PDF
                const TypeIcon = meta.icon
                return (
                  <div
                    key={m.id}
                    className="flex flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <span className={`flex size-11 items-center justify-center rounded-xl ${meta.box}`} aria-hidden="true">
                        <TypeIcon className="size-5" />
                      </span>
                      <Badge variant="outline" className={CATEGORY_STYLES[(m.category ?? '').toUpperCase()] ?? 'border-stone-200 bg-stone-50 text-stone-600'}>
                        {m.category}
                      </Badge>
                    </div>
                    <h3 className="font-semibold leading-snug text-stone-800">{m.title}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-500">
                      <User className="size-3 shrink-0 text-emerald-600" />
                      {m.teacher?.fullName ?? 'Tim Pengajar'}
                      {m.class?.name && (
                        <span className="ml-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                          {m.class.name}
                        </span>
                      )}
                    </p>
                    <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-stone-500">
                      {m.description || 'Belum ada deskripsi untuk materi ini.'}
                    </p>
                    <p className="mt-2 text-[11px] uppercase tracking-wide text-stone-400">{meta.label}</p>
                    <Button
                      asChild
                      size="sm"
                      className="mt-3 w-full bg-emerald-700 hover:bg-emerald-800"
                    >
                      <a href={m.url} target="_blank" rel="noopener noreferrer">
                        <Download className="size-4" />
                        Unduh Materi
                      </a>
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Info kecil */}
        {!loading && !error && materials.length > 0 && (
          <p className="mt-6 text-center text-xs text-stone-400">
            <BookOpen className="mr-1 inline size-3.5 -translate-y-px" />
            Menampilkan {filtered.length} dari {materials.length} materi terpublikasi.
          </p>
        )}
      </div>
    </section>
  )
}
