'use client'
// Kantor AI Agent — app shell: fetch manifest /api/assets, header kontrol,
// panel divisi + form kritik/saran, loading bar, fallback 2D. (Task 51)
// Task 52 — kontrol akses: access='full' (ADMIN/DEVELOPER) dapat kritik-saran
// + Chat Head Office (GLM internal live, Task 55); access='view' (GURU) hanya melihat.
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { toast, Toaster } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { dispatchFeedbackAnimation } from './agent-registry'
import { HeadChat } from './head-chat'
import { useKantorStore, type ManifestCharacter } from './kantor-store'
import { DIVISION_LABELS, KANTOR_CHARACTERS, type KantorDivision } from '@/lib/kantor/data'
import { Bot, Eye, Home, Loader2, MapPin, Orbit, Presentation, Sparkles } from 'lucide-react'

const KantorScene = dynamic(() => import('./kantor-scene').then((m) => m.KantorScene), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-stone-100"><Loader2 className="h-8 w-8 animate-spin text-emerald-700" /></div>,
})

const OVERVIEW = { key: 'overview', pos: [0, 8.2, 10.4] as [number, number, number], look: [0, 0.8, 0] as [number, number, number] }
const PODIUM = { key: 'podium', pos: [0, 2.5, 1.4] as [number, number, number], look: [0, 1.15, -3.55] as [number, number, number] }

export function KantorApp({ access = 'full', userName }: { access?: 'full' | 'view'; userName?: string }) {
  const { manifest, loading, loadError, selected, quality, autoRotate, setManifest, setLoading, setLoadError, select, setQuality, setPreset, setAutoRotate, webglOk, setWebglOk, bumpFeedback } = useKantorStore()
  const { progress, active } = useProgress()
  const [chatOpen, setChatOpen] = useState(false)
  const canInteract = access === 'full'

  useEffect(() => {
    try {
      const c = document.createElement('canvas')
      const ok = !!(c.getContext('webgl2') || c.getContext('webgl'))
      setWebglOk(ok)
    } catch {
      setWebglOk(false)
    }
  }, [setWebglOk])

  const loadManifest = useCallback(() => {
    setLoading(true)
    fetch('/api/assets')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ characters: ManifestCharacter[] }>
      })
      .then((d) => setManifest(d.characters))
      .catch((e: Error) => setLoadError(e.message))
  }, [setLoading, setManifest, setLoadError])

  useEffect(loadManifest, [loadManifest])

  const sel = useMemo(() => manifest.find((c) => c.division === selected) ?? null, [manifest, selected])

  const deskPreset = useMemo(() => {
    if (!selected) return null
    const c = KANTOR_CHARACTERS.find((x) => x.division === selected)
    if (!c) return null
    return { key: `desk-${selected}`, pos: [c.desk[0] * 0.55, 3.1, c.desk[1] + 4.1] as [number, number, number], look: [c.desk[0], 0.9, c.desk[1]] as [number, number, number] }
  }, [selected])

  const totalFeedback = manifest.reduce((a, c) => a + c.feedbackCount, 0)

  return (
    <div className="flex min-h-screen flex-col bg-stone-100">
      <Toaster position="top-center" richColors toastOptions={{ className: 'toast-spring' }} />

      {/* Header */}
      <header className="glass sticky top-0 z-30 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-700 text-white shadow"><Sparkles className="h-5 w-5" /></div>
            <div>
              <h1 className="text-base font-bold leading-tight text-stone-900" data-testid="judul-kantor">Kantor AI Agent</h1>
              <p className="text-[11px] leading-tight text-stone-500">Head: AI Agent (antrian ±5 mnt) · Divisi: GLM 5.3 Flash</p>
            </div>
          </div>

          <div className="ms-auto flex flex-wrap items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setPreset(OVERVIEW)} data-testid="preset-overview">
              <MapPin className="h-3.5 w-3.5" /> Overview
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setPreset(PODIUM)} data-testid="preset-podium">
              <Presentation className="h-3.5 w-3.5" /> Podium
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" disabled={!deskPreset} onClick={() => deskPreset && setPreset(deskPreset)} data-testid="preset-meja">
              <Orbit className="h-3.5 w-3.5" /> Meja terpilih
            </Button>
            <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2 py-1">
              <span className="text-[11px] font-medium text-stone-600">Putar otomatis</span>
              <Switch checked={autoRotate} onCheckedChange={setAutoRotate} aria-label="Putar otomatis kamera" />
            </div>
            {canInteract && (
              <Button
                variant="outline"
                size="sm"
                className={`h-8 gap-1.5 text-xs ${chatOpen ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : ''}`}
                onClick={() => setChatOpen((v) => !v)}
                aria-expanded={chatOpen}
                data-testid="tombol-chat-head"
              >
                <Bot className="h-3.5 w-3.5" /> Chat Head Office
              </Button>
            )}
            <div className="flex overflow-hidden rounded-lg border border-stone-200" role="group" aria-label="Kualitas grafik">
              {(['LOW', 'HIGH'] as const).map((q) => (
                <button
                  key={q}
                  onClick={() => setQuality(q)}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${quality === q ? 'bg-emerald-700 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'}`}
                  data-testid={`quality-${q.toLowerCase()}`}
                >
                  {q === 'LOW' ? 'Rendah' : 'Tinggi'}
                </button>
              ))}
            </div>
            <Link href="/" className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
              <Home className="h-3.5 w-3.5" /> Portal TPQ
            </Link>
          </div>
        </div>
        <span id="kantor-fps" className="absolute end-2 bottom-0.5 hidden text-[10px] text-stone-400 sm:inline" />
      </header>

      {/* Banner mode lihat saja (GURU) */}
      {!canInteract && (
        <div className="z-20 flex items-center justify-center gap-1.5 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[11px] font-medium text-amber-800" data-testid="banner-lihat-saja">
          <Eye className="h-3.5 w-3.5" />
          Mode lihat saja — kritik, saran & chat Head Office khusus Admin/Developer.
        </div>
      )}

      {/* Scene / fallback */}
      <main className="relative min-h-[520px] flex-1">
        {!webglOk ? (
          <Fallback2D manifest={manifest} onPick={(d) => select(d)} />
        ) : (
          <>
            <div className="absolute inset-0">
              <KantorScene />
            </div>
            {(loading || active) && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-stone-100/90 backdrop-blur-sm" data-testid="loading-overlay">
                <div className="h-2 w-56 overflow-hidden rounded-full bg-stone-200">
                  <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.max(progress, loading ? 15 : 0)}%` }} />
                </div>
                <p className="text-xs font-medium text-stone-500">Menyiapkan kantor… {Math.round(Math.max(progress, loading ? 15 : 0))}%</p>
              </div>
            )}
            {loadError && (
              <div className="absolute inset-x-0 top-4 z-20 mx-auto w-fit rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 shadow" data-testid="load-error">
                Gagal memuat manifest: {loadError} <button className="ms-2 font-semibold underline" onClick={loadManifest}>Coba lagi</button>
              </div>
            )}
          </>
        )}

        {/* Panel divisi / head */}
        {sel && (
          <DivisionPanel
            key={sel.division}
            data={sel}
            canInteract={canInteract}
            defaultName={userName}
            onClose={() => select(null)}
            onSubmitted={() => bumpFeedback(sel.division)}
          />
        )}

        {/* Chat Head Office (ADMIN/DEVELOPER) */}
        {canInteract && chatOpen && <HeadChat userName={userName ?? 'Pengguna'} onClose={() => setChatOpen(false)} />}
      </main>

      {/* Footer sticky */}
      <footer className="mt-auto border-t border-stone-200 bg-white/80 py-2.5 text-center text-[11px] text-stone-500">
        Kantor AI Agent · demo web 3D interaktif · kritik & saran tersimpan di server · preset kamera: Overview / Podium / Meja
      </footer>
    </div>
  )
}

/* ---------------- Panel divisi + form kritik/saran ---------------- */

function DivisionPanel({ data, canInteract, defaultName, onClose, onSubmitted }: { data: ManifestCharacter; canInteract: boolean; defaultName?: string; onClose: () => void; onSubmitted: () => void }) {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const isHead = data.division === 'HEAD'
  const color = data.colorHex ?? '#10b981'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    setSending(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ divisionId: data.division, name: name.trim() || undefined, message: message.trim() }),
      })
      const body = (await res.json()) as { result?: string; error?: string }
      if (!res.ok) {
        toast.error(body.error ?? 'Gagal mengirim masukan')
        return
      }
      toast.success(body.result ?? 'Terima kasih!')
      onSubmitted()
      dispatchFeedbackAnimation(data.division)
      setMessage('')
    } catch {
      toast.error('Jaringan bermasalah — coba lagi.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 max-h-[68vh] overflow-y-auto rounded-t-2xl border border-stone-200 bg-white/97 p-4 shadow-2xl backdrop-blur sm:inset-x-auto sm:end-4 sm:top-20 sm:bottom-auto sm:max-h-[80vh] sm:w-[380px] sm:rounded-2xl" data-testid={`panel-${data.division}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white shadow" style={{ background: color }}>
            {data.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-900">{data.name}</h2>
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold" style={{ borderColor: color, color }}>
              {data.badge}
            </Badge>
          </div>
        </div>
        <button onClick={onClose} aria-label="Tutup panel" className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700">✕</button>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-stone-600">{data.role}</p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-stone-50 p-2"><p className="text-sm font-bold text-stone-900">{data.tasksDone}</p><p className="text-[10px] text-stone-500">tugas selesai</p></div>
        <div className="rounded-lg bg-stone-50 p-2"><p className="text-sm font-bold text-emerald-700">{data.tasks.length}</p><p className="text-[10px] text-stone-500">tugas aktif</p></div>
        <div className="rounded-lg bg-stone-50 p-2"><p className="text-sm font-bold" style={{ color }}>{data.feedbackCount}</p><p className="text-[10px] text-stone-500">masukan wali</p></div>
      </div>

      {isHead && <HeadSummary />}

      <div className="mt-3">
        <p className="mb-1 text-[11px] font-semibold text-stone-500">Sedang dikerjakan</p>
        <ul className="space-y-1">
          {data.tasks.map((t) => (
            <li key={t} className="flex items-start gap-1.5 text-xs text-stone-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} /> {t}
            </li>
          ))}
        </ul>
      </div>

      {canInteract ? (
        <form onSubmit={submit} className="mt-4 space-y-2.5 rounded-xl border border-stone-200 bg-stone-50/60 p-3" data-testid={`form-${data.division}`}>
          <p className="text-[11px] font-bold text-stone-700">Kirim kritik & saran untuk divisi ini</p>
          <div>
            <Label htmlFor={`nama-${data.division}`} className="text-[11px] text-stone-500">Nama (kosongkan = nama akunmu)</Label>
            <Input id={`nama-${data.division}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={defaultName ?? 'Nama'} className="h-8 bg-white text-xs" />
          </div>
          <div>
            <Label htmlFor={`pesan-${data.division}`} className="text-[11px] text-stone-500">Pesan (5–500 karakter)</Label>
            <Textarea id={`pesan-${data.division}`} required minLength={5} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Saran untuk divisi ini…" className="min-h-[64px] resize-none bg-white text-xs" data-testid={`pesan-${data.division}`} />
            <p className="mt-0.5 text-end text-[10px] text-stone-400">{message.length}/500</p>
          </div>
          <Button type="submit" disabled={sending || message.trim().length < 5} className="h-9 w-full gap-2 bg-emerald-700 text-xs text-white hover:bg-emerald-800" data-testid={`kirim-${data.division}`}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {sending ? 'Mengirim…' : 'Kirim masukan'}
          </Button>
          <p className="text-center text-[10px] text-stone-400">Masukan memicu agen melapor ke Head Office</p>
        </form>
      ) : (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3" data-testid="panel-lihat-saja">
          <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
          <p className="text-[11px] leading-relaxed text-amber-800">
            Mode lihat saja — kritik &amp; saran hanya bisa dikirim oleh Admin/Developer.
          </p>
        </div>
      )}
    </div>
  )
}

function HeadSummary() {
  const manifest = useKantorStore((s) => s.manifest)
  const total = manifest.reduce((a, c) => a + c.feedbackCount, 0)
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3" data-testid="head-summary">
      <p className="text-[11px] font-bold text-amber-800">Ringkasan masukan seluruh divisi · total {total}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {manifest.map((c) => (
          <Badge key={c.division} variant="outline" className="gap-1 text-[10px]" style={{ borderColor: c.colorHex ?? undefined, color: c.colorHex ?? undefined }}>
            {DIVISION_LABELS[c.division as KantorDivision] ?? c.division}: {c.feedbackCount}
          </Badge>
        ))}
      </div>
    </div>
  )
}

/* ---------------- Fallback 2D (WebGL tak tersedia) ---------------- */

function Fallback2D({ manifest, onPick }: { manifest: ManifestCharacter[]; onPick: (d: string) => void }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10" data-testid="fallback-2d">
      <h2 className="text-lg font-bold text-stone-900">Kantor AI Agent — mode kartu</h2>
      <p className="mt-1 text-sm text-stone-500">Perangkat ini tidak mendukung WebGL, jadi kantor 3D ditampilkan sebagai kartu divisi.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {manifest.map((c) => (
          <button key={c.assetKey} onClick={() => onPick(c.division)} className="rounded-2xl border border-stone-200 bg-white p-4 text-start shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: c.colorHex ?? '#10b981' }}>{c.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <p className="text-sm font-bold text-stone-900">{c.name}</p>
                <p className="text-[10px] font-semibold" style={{ color: c.colorHex ?? undefined }}>{c.badge}</p>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 text-xs text-stone-600">{c.role}</p>
            <p className="mt-2 text-[10px] text-stone-400">{c.tasksDone} tugas selesai · {c.feedbackCount} masukan</p>
          </button>
        ))}
      </div>
    </div>
  )
}
