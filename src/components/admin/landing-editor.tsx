'use client'

// Editor Landing Page (CMS portal publik) — mengedit seluruh konten halaman depan:
// Hero, Tentang, Galeri, Kontak, FAQ, dan Testimoni via GET/PUT /api/settings.
// Task 59-b: panel "Urutan Layout" — drag & drop native HTML5 + tombol panah
// untuk menyusun urutan section portal publik (ADMIN & DEVELOPER).

import { useEffect, useState, type DragEvent } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GripVertical,
  Images,
  LayoutDashboard,
  ListOrdered,
  Loader2,
  MessageSquareQuote,
  MoonStar,
  Newspaper,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react'
import type {
  AboutSettings,
  ContactSettings,
  FaqItem,
  GalleryItem,
  HeroSettings,
  PortalSettings,
  TestimonialItem,
} from '@/lib/portal-settings'
import { DEFAULT_PORTAL_SETTINGS, DEFAULT_SECTION_ORDER, SECTION_LABELS } from '@/lib/portal-settings'
import { apiGet, apiSend } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImageUpload } from './image-upload'

/** Salinan default per bagian (deep copy agar aman dimutasi bebas). */
const SECTION_DEFAULTS = {
  hero: { ...DEFAULT_PORTAL_SETTINGS.hero },
  about: { ...DEFAULT_PORTAL_SETTINGS.about, missions: [...DEFAULT_PORTAL_SETTINGS.about.missions] },
  contact: { ...DEFAULT_PORTAL_SETTINGS.contact },
  faqs: DEFAULT_PORTAL_SETTINGS.faqs.map((f) => ({ ...f })),
  testimonials: DEFAULT_PORTAL_SETTINGS.testimonials.map((t) => ({ ...t })),
  gallery: DEFAULT_PORTAL_SETTINGS.gallery.map((g) => ({ ...g })),
} as const

type SectionKey = keyof typeof SECTION_DEFAULTS

/** Tukar posisi item dalam array (untuk tombol naik/turun). */
function moveItem<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const j = index + dir
  if (j < 0 || j >= arr.length) return arr
  const next = [...arr]
  const tmp = next[index]
  next[index] = next[j]
  next[j] = tmp
  return next
}

/** Tombol kecil "Kembalikan Default" per tab + catatan halus. */
function ResetSectionButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-700"
      onClick={onClick}
    >
      <RotateCcw className="size-3.5" />
      Kembalikan Default
    </Button>
  )
}

function ResetWarning() {
  return <p className="text-[11px] text-amber-600">Pengembalian default hanya mengubah formulir — tekan Simpan Perubahan untuk menerapkannya ke portal.</p>
}

/**
 * Task 59-b — Panel "Urutan Layout": daftar section dgn drag & drop native HTML5
 * (tanpa dependensi baru) + tombol panah naik/turun yang tetap bekerja di layar
 * sentuh. Perubahan hanya lokal — diterapkan lewat tombol Simpan Perubahan.
 */
function LayoutOrderPanel({
  order,
  onReorder,
  onMove,
  onReset,
}: {
  order: string[]
  onReorder: (from: number, to: number) => void
  onMove: (index: number, dir: -1 | 1) => void
  onReset: () => void
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  function handleDragOver(e: DragEvent<HTMLLIElement>, index: number) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    if (overIndex !== index) setOverIndex(index)
  }
  function handleDrop(e: DragEvent<HTMLLIElement>, index: number) {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== index) onReorder(dragIndex, index)
    setDragIndex(null)
    setOverIndex(null)
  }
  function handleDragEnd() {
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <ListOrdered className="size-4" />
          </span>
          Urutan Layout
        </CardTitle>
        <CardDescription>
          Susun urutan bagian pada portal publik — tarik gagang ⠿ ke posisi baru, atau pakai tombol panah. Terapkan dengan Simpan Perubahan.
        </CardDescription>
        <CardAction>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-700"
            onClick={onReset}
          >
            <RotateCcw className="size-3.5" />
            Kembalikan urutan bawaan
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {order.map((key, i) => {
            const label = SECTION_LABELS[key] ?? key
            const isDragging = dragIndex === i
            const isOver = overIndex === i && dragIndex !== null && dragIndex !== i
            return (
              <li
                key={key}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                aria-label={`Bagian urutan ${i + 1}: ${label}`}
                className={[
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                  isDragging
                    ? 'border-emerald-300 bg-emerald-50/80 opacity-60'
                    : isOver
                      ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-400'
                      : 'border-stone-200 bg-stone-50/60 hover:bg-stone-50',
                ].join(' ')}
              >
                <span aria-hidden="true" className="cursor-grab touch-none text-stone-400 active:cursor-grabbing">
                  <GripVertical className="size-4" />
                </span>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-white text-[11px] font-bold text-emerald-800 ring-1 ring-stone-200">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-stone-700">{label}</span>
                <span className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 bg-white"
                    aria-label={`Naikkan ${label}`}
                    disabled={i === 0}
                    onClick={() => onMove(i, -1)}
                  >
                    <ChevronUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-8 bg-white"
                    aria-label={`Turunkan ${label}`}
                    disabled={i === order.length - 1}
                    onClick={() => onMove(i, 1)}
                  >
                    <ChevronDown className="size-4" />
                  </Button>
                </span>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-[11px] text-stone-400">
          Anchor menu (Tentang, Kurikulum, …) tetap berfungsi — hanya urutan tampil yang berubah. Footer selalu di bagian paling akhir.
        </p>
      </CardContent>
    </Card>
  )
}

export function LandingEditor() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<PortalSettings | null>(null)
  const [lastSaved, setLastSaved] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadRetry, setLoadRetry] = useState(0)
  // Teks mentah misi (satu misi per baris) — dikonversi ke string[] saat disimpan.
  const [missionsText, setMissionsText] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiGet<PortalSettings>('/api/settings')
      .then((data) => {
        if (cancelled) return
        setSettings(data)
        setLastSaved(JSON.stringify(data))
        setMissionsText(data.about.missions.join('\n'))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Gagal memuat data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadRetry])

  const dirty = settings !== null && JSON.stringify(settings) !== lastSaved

  function patchHero(patch: Partial<HeroSettings>) {
    setSettings((s) => (s ? { ...s, hero: { ...s.hero, ...patch } } : s))
  }
  function patchAbout(patch: Partial<AboutSettings>) {
    setSettings((s) => (s ? { ...s, about: { ...s.about, ...patch } } : s))
  }
  function patchContact(patch: Partial<ContactSettings>) {
    setSettings((s) => (s ? { ...s, contact: { ...s.contact, ...patch } } : s))
  }
  /** Ubah teks misi — simpan versi mentah untuk textarea, versi bersih untuk state/dirty-flag. */
  function handleMissionsChange(raw: string) {
    setMissionsText(raw)
    patchAbout({ missions: raw.split('\n').map((m) => m.trim()).filter(Boolean) })
  }
  function updateFaq(index: number, patch: Partial<FaqItem>) {
    setSettings((s) => (s ? { ...s, faqs: s.faqs.map((f, i) => (i === index ? { ...f, ...patch } : f)) } : s))
  }
  function updateTestimonial(index: number, patch: Partial<TestimonialItem>) {
    setSettings((s) => (s ? { ...s, testimonials: s.testimonials.map((t, i) => (i === index ? { ...t, ...patch } : t)) } : s))
  }
  function updateGallery(index: number, patch: Partial<GalleryItem>) {
    setSettings((s) => (s ? { ...s, gallery: s.gallery.map((g, i) => (i === index ? { ...g, ...patch } : g)) } : s))
  }

  function resetSection(key: SectionKey) {
    const def = SECTION_DEFAULTS[key]
    setSettings((s) => (s ? { ...s, [key]: def } : s))
    if (key === 'about') setMissionsText(SECTION_DEFAULTS.about.missions.join('\n'))
  }

  /** Task 59-b: pindahkan section urutan `from` ke posisi `to` (hasil drop). */
  function reorderSections(from: number, to: number) {
    setSettings((s) => {
      if (!s) return s
      const next = [...s.sectionOrder]
      if (from < 0 || from >= next.length || to < 0 || to >= next.length) return s
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return { ...s, sectionOrder: next }
    })
  }

  async function handleSave() {
    if (!settings || saving) return
    setSaving(true)
    try {
      const payload = {
        hero: settings.hero,
        about: { ...settings.about, missions: settings.about.missions.map((m) => m.trim()).filter(Boolean) },
        contact: settings.contact,
        faqs: settings.faqs.map((f) => ({ question: f.question.trim(), answer: f.answer.trim() })),
        testimonials: settings.testimonials.map((t) => ({ quote: t.quote.trim(), name: t.name.trim(), role: t.role.trim() })),
        gallery: settings.gallery.map((g) => ({ imageUrl: g.imageUrl.trim(), caption: g.caption.trim() })),
        sectionOrder: settings.sectionOrder,
      }
      const saved = await apiSend<PortalSettings>('/api/settings', 'PUT', payload)
      setSettings(saved)
      setLastSaved(JSON.stringify(saved))
      setMissionsText(saved.about.missions.join('\n'))
      toast({ title: 'Perubahan landing page tersimpan', description: 'Seluruh konten baru kini tampil pada portal publik.' })
    } catch (e) {
      toast({
        title: 'Gagal menyimpan perubahan',
        description: e instanceof Error ? e.message : 'Terjadi kesalahan',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Card>
          <CardContent className="space-y-4">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-80" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-32 rounded-xl" />
              <Skeleton className="h-9 w-44 rounded-xl" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-5">
            <Skeleton className="h-5 w-40" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !settings) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Gagal memuat pengaturan landing page</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-3">
            <span>{error ?? 'Terjadi kesalahan'}</span>
            <Button variant="outline" size="sm" onClick={() => setLoadRetry((r) => r + 1)}>
              <RefreshCw className="size-4" />
              Coba Lagi
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* Header editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <LayoutDashboard className="size-4" />
            </span>
            Editor Landing Page
          </CardTitle>
          <CardDescription>Semua perubahan langsung tampil pada portal publik.</CardDescription>
          <CardAction className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-emerald-700">
              <a href="/" target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Lihat Portal
              </a>
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={!dirty || saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Simpan Perubahan
              {dirty && !saving && <span aria-hidden="true" className="size-1.5 rounded-full bg-amber-400" />}
            </Button>
          </CardAction>
        </CardHeader>
      </Card>

      {/* ============ URUTAN LAYOUT (Task 59-b) ============ */}
      <LayoutOrderPanel
        order={settings.sectionOrder}
        onReorder={reorderSections}
        onMove={(i, dir) => setSettings((s) => (s ? { ...s, sectionOrder: moveItem(s.sectionOrder, i, dir) } : s))}
        onReset={() => setSettings((s) => (s ? { ...s, sectionOrder: [...DEFAULT_SECTION_ORDER] } : s))}
      />

      <Tabs defaultValue="hero" className="gap-4">
        <TabsList className="h-auto min-h-9 flex-wrap justify-start">
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="tentang">Tentang</TabsTrigger>
          <TabsTrigger value="galeri">Galeri</TabsTrigger>
          <TabsTrigger value="kontak">Kontak</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="testimoni">Testimoni</TabsTrigger>
        </TabsList>

        {/* ============ HERO ============ */}
        <TabsContent value="hero">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MoonStar className="size-4 text-emerald-700" />
                Bagian Hero
              </CardTitle>
              <CardDescription>Tampilan pembuka portal: sapaan Arab, judul utama, dan gambar latar.</CardDescription>
              <CardAction>
                <ResetSectionButton onClick={() => resetSection('hero')} />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="hero-bismillah">Bismillah</Label>
                <Input id="hero-bismillah" dir="rtl" value={settings.hero.bismillah} onChange={(e) => patchHero({ bismillah: e.target.value })} />
                <p className="text-xs text-stone-400">Teks Arab pembuka di bagian paling atas portal.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hero-badge">Badge</Label>
                <Input id="hero-badge" value={settings.hero.badge} onChange={(e) => patchHero({ badge: e.target.value })} placeholder="Contoh: Taman Pendidikan Al-Qur'an" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hero-title">Judul Utama</Label>
                <Input id="hero-title" value={settings.hero.title} onChange={(e) => patchHero({ title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hero-tagline">Tagline</Label>
                <Textarea id="hero-tagline" rows={3} value={settings.hero.tagline} onChange={(e) => patchHero({ tagline: e.target.value })} />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/60 p-4">
                <Switch id="hero-show-stats" checked={settings.hero.showStats} onCheckedChange={(v) => patchHero({ showStats: v })} />
                <Label htmlFor="hero-show-stats" className="cursor-pointer font-normal">Tampilkan kartu statistik</Label>
              </div>
              <Separator />
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <ImageUpload url={settings.hero.logoUrl} onChange={(url) => patchHero({ logoUrl: url })} label="Logo/Emblem" aspect="square" />
                  <p className="text-xs text-stone-400">Kosongkan untuk memakai ikon bulan bawaan.</p>
                </div>
                <div className="space-y-2">
                  <ImageUpload url={settings.hero.backgroundUrl} onChange={(url) => patchHero({ backgroundUrl: url })} label="Gambar Latar Hero" aspect="video" />
                  <p className="text-xs text-stone-400">Kosongkan untuk memakai ilustrasi masjid bawaan.</p>
                </div>
              </div>
              <ResetWarning />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TENTANG ============ */}
        <TabsContent value="tentang">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="size-4 text-emerald-700" />
                Bagian Tentang Kami
              </CardTitle>
              <CardDescription>Narasi lembaga: visi, misi, dan foto kegiatan santri.</CardDescription>
              <CardAction>
                <ResetSectionButton onClick={() => resetSection('about')} />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="about-badge">Badge</Label>
                <Input id="about-badge" value={settings.about.badge} onChange={(e) => patchAbout({ badge: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="about-heading">Judul Bagian</Label>
                <Input id="about-heading" value={settings.about.heading} onChange={(e) => patchAbout({ heading: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="about-tagline">Tagline</Label>
                <Textarea id="about-tagline" rows={3} value={settings.about.tagline} onChange={(e) => patchAbout({ tagline: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="about-vision">Visi</Label>
                <Textarea id="about-vision" rows={3} value={settings.about.vision} onChange={(e) => patchAbout({ vision: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="about-missions">Misi</Label>
                <Textarea
                  id="about-missions"
                  rows={6}
                  value={missionsText}
                  onChange={(e) => handleMissionsChange(e.target.value)}
                  placeholder={'Satu misi per baris\nContoh: Membina santri membaca Al-Qur\'an dengan tajwid yang benar'}
                />
                <p className="text-xs text-stone-400">Satu misi per baris — setiap baris menjadi satu butir misi di portal.</p>
              </div>
              <div className="space-y-2">
                <ImageUpload url={settings.about.imageUrl} onChange={(url) => patchAbout({ imageUrl: url })} label="Foto Kegiatan" aspect="video" />
                <p className="text-xs text-stone-400">Kosongkan untuk memakai ilustrasi serambi bawaan.</p>
              </div>
              <ResetWarning />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ GALERI ============ */}
        <TabsContent value="galeri">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Images className="size-4 text-emerald-700" />
                Galeri Kegiatan
              </CardTitle>
              <CardDescription>Foto momen kegiatan santri — tampil sebagai galeri di portal publik.</CardDescription>
              <CardAction>
                <ResetSectionButton onClick={() => resetSection('gallery')} />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.gallery.length === 0 && (
                <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-center text-sm text-stone-400">
                  Belum ada foto. Tambahkan foto kegiatan pertama Anda.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                {settings.gallery.map((g, i) => (
                  <div key={i} className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">Foto {i + 1}</Badge>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8"
                          aria-label={`Naikkan foto ${i + 1}`}
                          disabled={i === 0}
                          onClick={() => setSettings((s) => (s ? { ...s, gallery: moveItem(s.gallery, i, -1) } : s))}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8"
                          aria-label={`Turunkan foto ${i + 1}`}
                          disabled={i === settings.gallery.length - 1}
                          onClick={() => setSettings((s) => (s ? { ...s, gallery: moveItem(s.gallery, i, 1) } : s))}
                        >
                          <ChevronDown className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          aria-label={`Hapus foto ${i + 1}`}
                          onClick={() => setSettings((s) => (s ? { ...s, gallery: s.gallery.filter((_, idx) => idx !== i) } : s))}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    <ImageUpload url={g.imageUrl} onChange={(url) => updateGallery(i, { imageUrl: url })} label="Berkas Foto" aspect="video" />
                    <div className="space-y-2">
                      <Label htmlFor={`gallery-caption-${i}`}>Keterangan Foto</Label>
                      <Input
                        id={`gallery-caption-${i}`}
                        value={g.caption}
                        onChange={(e) => updateGallery(i, { caption: e.target.value })}
                        placeholder="Contoh: Halaqah sore di serambi masjid"
                        maxLength={200}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                  disabled={settings.gallery.length >= 24}
                  onClick={() => setSettings((s) => (s ? { ...s, gallery: [...s.gallery, { imageUrl: '', caption: '' }] } : s))}
                >
                  <Plus className="size-4" />
                  Tambah Foto
                </Button>
                <p className="text-xs text-stone-400">
                  {settings.gallery.length}/24 foto · foto tanpa berkas gambar otomatis disembunyikan dari portal.
                </p>
              </div>
              <ResetWarning />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ KONTAK ============ */}
        <TabsContent value="kontak">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="size-4 text-emerald-700" />
                Bagian Kontak
              </CardTitle>
              <CardDescription>Alamat, kanal komunikasi, dan jam operasional TPQ.</CardDescription>
              <CardAction>
                <ResetSectionButton onClick={() => resetSection('contact')} />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="contact-address">Alamat</Label>
                <Textarea id="contact-address" rows={2} value={settings.contact.address} onChange={(e) => patchContact({ address: e.target.value })} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-phone">Telepon</Label>
                  <Input id="contact-phone" value={settings.contact.phone} onChange={(e) => patchContact({ phone: e.target.value })} placeholder="0812-3456-7890" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-whatsapp">WhatsApp</Label>
                  <Input id="contact-whatsapp" value={settings.contact.whatsapp} onChange={(e) => patchContact({ whatsapp: e.target.value })} placeholder="6281234567890" />
                  <p className="text-xs text-stone-400">Format 62xxx tanpa +, dipakai link wa.me.</p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email</Label>
                  <Input id="contact-email" type="email" value={settings.contact.email} onChange={(e) => patchContact({ email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-hours">Catatan Jam Operasional</Label>
                  <Input id="contact-hours" value={settings.contact.hoursNote} onChange={(e) => patchContact({ hoursNote: e.target.value })} placeholder="Senin – Sabtu 15.00 – 18.00 WIB" />
                </div>
              </div>
              <ResetWarning />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ FAQ ============ */}
        <TabsContent value="faq">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="size-4 text-emerald-700" />
                Tanya Jawab (FAQ)
              </CardTitle>
              <CardDescription>Pertanyaan yang sering diajukan calon wali santri.</CardDescription>
              <CardAction>
                <ResetSectionButton onClick={() => resetSection('faqs')} />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.faqs.length === 0 && (
                <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-center text-sm text-stone-400">
                  Belum ada FAQ. Tambahkan pertanyaan pertama Anda.
                </p>
              )}
              {settings.faqs.map((faq, i) => (
                <div key={i} className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">FAQ {i + 1}</Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label={`Naikkan FAQ ${i + 1}`}
                        disabled={i === 0}
                        onClick={() => setSettings((s) => (s ? { ...s, faqs: moveItem(s.faqs, i, -1) } : s))}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label={`Turunkan FAQ ${i + 1}`}
                        disabled={i === settings.faqs.length - 1}
                        onClick={() => setSettings((s) => (s ? { ...s, faqs: moveItem(s.faqs, i, 1) } : s))}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Hapus FAQ ${i + 1}`}
                        onClick={() => setSettings((s) => (s ? { ...s, faqs: s.faqs.filter((_, idx) => idx !== i) } : s))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`faq-question-${i}`}>Pertanyaan</Label>
                    <Input
                      id={`faq-question-${i}`}
                      value={faq.question}
                      onChange={(e) => updateFaq(i, { question: e.target.value })}
                      placeholder="Contoh: Berapa iuran bulanan (SPP)?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`faq-answer-${i}`}>Jawaban</Label>
                    <Textarea
                      id={`faq-answer-${i}`}
                      rows={2}
                      value={faq.answer}
                      onChange={(e) => updateFaq(i, { answer: e.target.value })}
                    />
                  </div>
                </div>
              ))}
              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                  onClick={() => setSettings((s) => (s ? { ...s, faqs: [...s.faqs, { question: '', answer: '' }] } : s))}
                >
                  <Plus className="size-4" />
                  Tambah FAQ
                </Button>
                <p className="text-xs text-stone-400">Kosongkan pertanyaan dan jawaban semua FAQ untuk menyembunyikan bagian ini dari portal.</p>
              </div>
              <ResetWarning />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ TESTIMONI ============ */}
        <TabsContent value="testimoni">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareQuote className="size-4 text-emerald-700" />
                Testimoni Wali Santri
              </CardTitle>
              <CardDescription>Kutipan pengalaman orang tua — menambah kepercayaan calon pendaftar.</CardDescription>
              <CardAction>
                <ResetSectionButton onClick={() => resetSection('testimonials')} />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.testimonials.length === 0 && (
                <p className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4 text-center text-sm text-stone-400">
                  Belum ada testimoni. Tambahkan kutipan pertama Anda.
                </p>
              )}
              {settings.testimonials.map((t, i) => (
                <div key={i} className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">Testimoni {i + 1}</Badge>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label={`Naikkan testimoni ${i + 1}`}
                        disabled={i === 0}
                        onClick={() => setSettings((s) => (s ? { ...s, testimonials: moveItem(s.testimonials, i, -1) } : s))}
                      >
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label={`Turunkan testimoni ${i + 1}`}
                        disabled={i === settings.testimonials.length - 1}
                        onClick={() => setSettings((s) => (s ? { ...s, testimonials: moveItem(s.testimonials, i, 1) } : s))}
                      >
                        <ChevronDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        aria-label={`Hapus testimoni ${i + 1}`}
                        onClick={() => setSettings((s) => (s ? { ...s, testimonials: s.testimonials.filter((_, idx) => idx !== i) } : s))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`testimonial-quote-${i}`}>Kutipan</Label>
                    <Textarea
                      id={`testimonial-quote-${i}`}
                      rows={2}
                      value={t.quote}
                      onChange={(e) => updateTestimonial(i, { quote: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`testimonial-name-${i}`}>Nama</Label>
                      <Input
                        id={`testimonial-name-${i}`}
                        value={t.name}
                        onChange={(e) => updateTestimonial(i, { name: e.target.value })}
                        placeholder="Contoh: Bpk. Hendra Gunawan"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`testimonial-role-${i}`}>Peran</Label>
                      <Input
                        id={`testimonial-role-${i}`}
                        value={t.role}
                        onChange={(e) => updateTestimonial(i, { role: e.target.value })}
                        placeholder="Contoh: Wali santri — Program Tahfidz"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                onClick={() => setSettings((s) => (s ? { ...s, testimonials: [...s.testimonials, { quote: '', name: '', role: '' }] } : s))}
              >
                <Plus className="size-4" />
                Tambah Testimoni
              </Button>
              <ResetWarning />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
