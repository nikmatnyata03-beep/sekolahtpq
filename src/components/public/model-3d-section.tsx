'use client'

// Studio Model 3D — section portal publik untuk menjelajahi model 3D.
//   • Bawaan: masjid mini prosedural (tanpa aset unduhan).
//   • Pemilik/pengunjung bisa memuat model sendiri: drag & drop file .glb,
//     pilih file, atau tempel URL .glb — semuanya diproses di sisi klien
//     (blob URL), tanpa mengunggah apa pun ke server.
//   • Kontrol: auto-putar, reset kamera, kembali ke masjid bawaan.
//   • Canvas dimount lazy (IntersectionObserver) + frameloop berhenti saat
//     section di luar layar (hemat baterai), three.js di luar chunk awal.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import dynamic from 'next/dynamic'
import { Link2, RotateCcw, Undo2, Upload, View, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ScrollReveal } from './ornaments'
import type { ModelStats } from './model-3d-stage'

const Model3dStage = dynamic(() => import('./model-3d-stage'), {
  ssr: false,
  loading: () => (
    <div
      className="absolute inset-0 animate-pulse bg-emerald-950/60"
      aria-hidden="true"
    />
  ),
})

const MAX_FILE_BYTES = 30 * 1024 * 1024 // 30 MB

type LoadedModel = {
  url: string
  name: string
  size: number | null
  isBlob: boolean
}

/* --- preferensi reduce-motion (pola aman-hidrasi useSyncExternalStore) --- */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const subscribeReducedMotion = (onChange: () => void) => {
  const mq = window.matchMedia(REDUCED_MOTION_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
const getReducedMotion = () => window.matchMedia(REDUCED_MOTION_QUERY).matches
const getServerReducedMotion = () => false

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function Model3dSection() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  const [active, setActive] = useState(false) // canvas pernah terlihat → mount
  const [inView, setInView] = useState(false) // sedang terlihat → frameloop hidup
  const [dragging, setDragging] = useState(false)
  const [model, setModel] = useState<LoadedModel | null>(null)
  const [stats, setStats] = useState<ModelStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [autoRotateOn, setAutoRotateOn] = useState(true)
  const [resetKey, setResetKey] = useState(0)
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotion,
    getServerReducedMotion,
  )

  /* Mount gate + frameloop gate via satu IntersectionObserver. */
  useEffect(() => {
    const el = sectionRef.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      // Fallback lingkungan tanpa IntersectionObserver — aktifkan asinkron
      // agar tidak memicu render berantai sinkron dalam effect.
      const raf = requestAnimationFrame(() => {
        setActive(true)
        setInView(true)
      })
      return () => cancelAnimationFrame(raf)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting)
        setInView(visible)
        if (visible) setActive(true)
      },
      { rootMargin: '250px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  /* Bersihkan blob URL saat section unmount. */
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [])

  const handleStats = useCallback((next: ModelStats | null) => setStats(next), [])

  const handleError = useCallback((message: string) => {
    setError(message)
    setModel(null)
    setStats(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const acceptFile = useCallback((file: File) => {
    const name = file.name.trim()
    const lower = name.toLowerCase()
    if (!lower.endsWith('.glb') && !lower.endsWith('.gltf')) {
      setError('Format tidak didukung. Gunakan file glTF binary (.glb) — satu file utuh, paling andal.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Ukuran file melebihi 30 MB. Gunakan model yang lebih ringan agar tetap mulus di ponsel.')
      return
    }
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    const url = URL.createObjectURL(file)
    blobUrlRef.current = url
    setError(null)
    setStats(null)
    setModel({ url, name, size: file.size, isBlob: true })
    setResetKey((k) => k + 1)
  }, [])

  const loadUrl = useCallback(() => {
    const url = urlInput.trim()
    if (!url) return
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setError(null)
    setStats(null)
    setModel({ url, name: url.split('/').pop()?.split('?')[0] || 'model-remote.glb', size: null, isBlob: false })
    setResetKey((k) => k + 1)
  }, [urlInput])

  const backToDefault = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    setError(null)
    setStats(null)
    setModel(null)
    setResetKey((k) => k + 1)
  }, [])

  /* Handler drag & drop pada kotak panggung. */
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }, [])
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
  }, [])
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) acceptFile(file)
    },
    [acceptFile],
  )

  const effectiveAutoRotate = autoRotateOn && !reducedMotion
  const triangles = stats?.triangles.toLocaleString('id-ID') ?? '—'

  return (
    <section
      id="model3d"
      ref={sectionRef}
      className="scroll-mt-20 bg-gradient-to-b from-stone-50 to-emerald-50/60 py-16"
    >
      <div className="mx-auto max-w-6xl px-4">
        {/* Heading */}
        <ScrollReveal className="mx-auto mb-12 max-w-2xl text-center">
          <span className="mb-3 inline-block rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700">
            Studio 3D
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-stone-800">
            Jelajahi dalam 3D
          </h2>
          <p className="mt-3 text-muted-foreground">
            Putar, perbesar, dan telusuri model tiga dimensi langsung dari peramban.
            Punya file model .glb? Seret ke panggung — semuanya diproses di perangkat Anda,
            tanpa diunggah ke server.
          </p>
        </ScrollReveal>

        <ScrollReveal>
          <div className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-lg shadow-emerald-900/5">
            {/* ===== Panggung (area drag & drop + canvas) ===== */}
            <div
              className="relative h-[380px] border-b border-emerald-100 sm:h-[460px] lg:h-[540px]"
              style={{
                background:
                  'radial-gradient(120% 90% at 50% 0%, #0b4a37 0%, #052e21 55%, #03201a 100%)',
              }}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              role="region"
              aria-label="Panggung model 3D — seret untuk memutar model"
            >
              {active && (
                <div className="absolute inset-0">
                  <Model3dStage
                    modelUrl={model?.url ?? null}
                    autoRotate={effectiveAutoRotate}
                    frameloop={inView ? 'always' : 'never'}
                    onStats={handleStats}
                    onError={handleError}
                    resetKey={resetKey}
                  />
                </div>
              )}

              {/* Overlay drag & drop */}
              {dragging && (
                <div className="pointer-events-none absolute inset-3 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-300/80 bg-amber-950/50 backdrop-blur-sm">
                  <Upload className="size-8 text-amber-300" aria-hidden="true" />
                  <p className="text-sm font-semibold text-amber-100">
                    Lepaskan file .glb untuk memuat model
                  </p>
                </div>
              )}

              {/* Chip status kiri-atas */}
              <div className="pointer-events-none absolute left-3 top-3 z-10">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1 text-[11px] font-medium text-amber-100 backdrop-blur-sm">
                  <View className="size-3.5" aria-hidden="true" />
                  {model ? 'Model Anda' : 'Masjid bawaan'}
                </span>
              </div>

              {/* Petunjuk interaksi kanan-bawah */}
              <p className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-full bg-black/35 px-3 py-1 text-[11px] text-emerald-50/90 backdrop-blur-sm">
                Seret = putar · Scroll/cubit = zoom
              </p>
            </div>

            {/* ===== Kontrol ===== */}
            <div className="flex flex-col gap-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    clearError()
                    fileInputRef.current?.click()
                  }}
                  className="gap-1.5"
                  style={{ backgroundColor: 'var(--brand)' }}
                >
                  <Upload className="size-4" aria-hidden="true" />
                  Pilih file .glb
                </Button>

                <div className="flex min-w-[240px] flex-1 items-center gap-2">
                  <div className="relative flex-1">
                    <Link2
                      className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-stone-400"
                      aria-hidden="true"
                    />
                    <Input
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') loadUrl()
                      }}
                      onFocus={clearError}
                      placeholder="…atau tempel URL model .glb"
                      className="h-9 pl-8 text-sm"
                      aria-label="URL model .glb"
                      inputMode="url"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    onClick={loadUrl}
                    disabled={!urlInput.trim()}
                  >
                    Muat
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    id="model3d-rotate"
                    checked={autoRotateOn}
                    onCheckedChange={setAutoRotateOn}
                    aria-label="Putar otomatis"
                  />
                  <Label htmlFor="model3d-rotate" className="text-sm text-stone-600">
                    Putar otomatis
                  </Label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {model && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                      onClick={backToDefault}
                    >
                      <Undo2 className="size-4" aria-hidden="true" />
                      Masjid bawaan
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                    onClick={() => setResetKey((k) => k + 1)}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Reset kamera
                  </Button>
                </div>
              </div>

              {/* Info model / pesan error */}
              {error ? (
                <div
                  role="alert"
                  className="flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                >
                  <span>{error}</span>
                  <button
                    type="button"
                    onClick={clearError}
                    aria-label="Tutup pesan galat"
                    className="mt-0.5 shrink-0 rounded p-0.5 text-red-600 transition-colors hover:bg-red-100 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-stone-500">
                  <span className="max-w-[240px] truncate font-medium text-stone-700">
                    {model ? model.name : 'Masjid mini — showcase prosedural bawaan'}
                  </span>
                  <span>Ukuran: {model ? formatBytes(model.size) : '—'}</span>
                  <span>Segitiga: {triangles}</span>
                  <span>Mesh: {stats?.meshes ?? '—'}</span>
                </div>
              )}
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* Input file tersembunyi */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) acceptFile(file)
          e.target.value = '' // izinkan memilih file yang sama dua kali
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </section>
  )
}
