'use client'
// Panel obrolan Head Office — Task 52/55/56/57.
// Task 57 — ARSITEKTUR ASINKRON: pesan tersimpan di D1 (per-sesi, terpisah
// antar pengguna). Setelah dikirim, tampil placeholder "Sedang di proses
// sistem, silahkan tunggu…" — balasan disusun agen AI (cron 5 menit) dan
// diambil klien lewat polling GET /api/kantor/chat saat ada pesan pending.
// Sesi tersimpan server-side → obrolan utuh walau panel ditutup/direfresh.
//
// Task 59 — MODE EKSEKUSI LANGSUNG: pesan assistant berstatus 'progress'
// tampil sebagai baris timeline gaya terminal (langkah kerja agen live);
// polling berjalan terus selama panel terpasang agar progres real-time.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getAgent } from './agent-registry'
import { Bot, Loader2, MessageSquarePlus, Send, Terminal, X } from 'lucide-react'

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  status?: string // user: pending|processing|answered|error; assistant: done|progress
  error?: boolean // bubble merah (gagal kirim / jawaban gagal dari agen)
  progress?: boolean // baris timeline langkah kerja agen (Task 59)
}

const WAIT_TEXT = 'Sedang di proses sistem, silahkan tunggu…'

export function HeadChat({ userName, onClose }: { userName: string; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [loaded, setLoaded] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const refreshBusy = useRef(false)
  const seenAssistant = useRef<Set<string>>(new Set())

  const welcome: ChatMsg[] = useMemo(
    () =>
      sessionId
        ? []
        : [
            {
              id: 'welcome',
              role: 'assistant',
              content: `Selamat datang, ${userName}. Saya Head Office — agen AI SIMADJI.\nPesan Anda masuk antrian sistem (diproses ±5 menit). Ada yang bisa dibantu?`,
            },
          ],
    [sessionId, userName],
  )

  // Jumlah pesan user yang masih menunggu jawaban agen.
  const pendingCount = useMemo(
    () =>
      messages.filter(
        (m) => m.role === 'user' && (m.status === 'pending' || m.status === 'processing'),
      ).length,
    [messages],
  )

  /** Ambil obrolan dari server (sumber kebenaran) — dipakai load & polling. */
  const refresh = useCallback(
    async (sid?: string | null) => {
      if (refreshBusy.current) return
      refreshBusy.current = true
      try {
        const target = sid ?? sessionId
        const qs = target ? `?sessionId=${encodeURIComponent(target)}` : ''
        const res = await fetch(`/api/kantor/chat${qs}`, {
          signal: AbortSignal.timeout(15_000),
        })
        if (!res.ok) return
        const body = (await res.json()) as {
          session?: { id: string } | null
          messages?: { id: string; role: string; content: string; status: string }[]
        }
        if (!body.session) {
          if (!target) {
            setSessionId(null)
            setMessages([])
          }
          return
        }
        const list: ChatMsg[] = (body.messages ?? []).map((m) => ({
          id: m.id,
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
          status: m.status,
          error: m.role === 'assistant' && m.status !== 'progress' && m.content.startsWith('⚠️'),
          progress: m.role === 'assistant' && m.status === 'progress',
        }))
        setSessionId(body.session.id)
        setMessages(list)
        // Trigger agen HEAD bicara di scene 3D untuk balasan baru.
        for (const m of list) {
          if (m.role === 'assistant' && !seenAssistant.current.has(m.id) && !m.error) {
            seenAssistant.current.add(m.id)
            const ringkas = m.content.replace(/\s+/g, ' ').slice(0, 90)
            getAgent('HEAD')?.talk(5, ringkas + (m.content.length > 90 ? '…' : ''))
          }
          if (m.role === 'assistant') seenAssistant.current.add(m.id)
        }
      } catch {
        // polling sunyi — kegagalan jaringan tidak mengganggu tampilan
      } finally {
        refreshBusy.current = false
      }
    },
    [sessionId],
  )

  // Muat sesi terakhir milik user saat panel dibuka.
  useEffect(() => {
    void refresh(null).finally(() => setLoaded(true))
  }, [])

  // Polling tiap 5 detik selama panel terpasang — progres live tanpa jeda (Task 59).
  useEffect(() => {
    if (!sessionId) return
    const t = setInterval(() => void refresh(), 5_000)
    return () => clearInterval(t)
  }, [sessionId, refresh])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, pendingCount])

  const send = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    getAgent('HEAD')?.talk(2.5, 'Meneruskan ke antrian sistem…')
    try {
      const res = await fetch('/api/kantor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: sessionId ?? undefined }),
        signal: AbortSignal.timeout(20_000),
      })
      const raw = await res.text()
      let body: { sessionId?: string; error?: string } | null = null
      try {
        body = JSON.parse(raw) as { sessionId?: string; error?: string }
      } catch {
        body = null
      }
      if (!res.ok || !body?.sessionId) {
        const serverMsg =
          body?.error ??
          (raw.trim()
            ? raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
            : 'Server tidak merespons')
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: 'assistant', content: `⚠️ Gagal (${res.status || 'jaringan'}): ${serverMsg}`, error: true },
        ])
        setInput((cur) => cur || text) // teks user tidak hilang — tinggal kirim ulang
        toast.error(serverMsg.slice(0, 120))
        return
      }
      setSessionId(body.sessionId)
      await refresh(body.sessionId) // sinkron dari server — user bubble + status pending
    } catch (err) {
      const timeout = err instanceof DOMException && err.name === 'TimeoutError'
      const pesan = timeout
        ? '⚠️ Server tidak merespons — coba kirim ulang.'
        : '⚠️ Jaringan bermasalah — periksa koneksi lalu kirim ulang.'
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: pesan, error: true }])
      setInput((cur) => cur || text)
      toast.error(timeout ? 'Waktu tunggu habis' : 'Jaringan bermasalah')
    } finally {
      setSending(false)
    }
  }

  /** Sesi baru: kosongkan tampilan — pesan berikutnya memulai sesi terpisah.
   *  Riwayat sesi lama tetap tersimpan aman di server (privasi per pengguna). */
  const newSession = () => {
    if (sending) return
    setSessionId(null)
    setMessages([])
    seenAssistant.current = new Set()
    setInput('')
  }

  const view: ChatMsg[] = [...welcome, ...messages]
  // Bubble "menunggu" hilang begitu baris progres pertama muncul setelahnya.
  const showWaiting =
    !sending &&
    view.some(
      (m, i) =>
        m.role === 'user' &&
        (m.status === 'pending' || m.status === 'processing') &&
        !view.slice(i + 1).some((p) => p.role === 'assistant' && p.progress),
    )

  return (
    <div
      className="absolute end-2 bottom-2 z-30 flex max-h-[75vh] w-[calc(100vw-1rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl sm:end-4 sm:bottom-4"
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      data-testid="head-chat"
      role="dialog"
      aria-label="Obrolan Head Office"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-stone-100 bg-stone-50/80 px-3 py-2.5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-white">
          <Bot className="h-5 w-5" />
          <span className="absolute -end-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-stone-900">Head Office</p>
          <p className="text-[10px] font-medium text-emerald-600">AI Agent · antrian ±5 mnt</p>
        </div>
        <button
          onClick={newSession}
          aria-label="Mulai sesi baru"
          title="Sesi baru"
          className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </button>
        <button onClick={onClose} aria-label="Tutup obrolan" className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Pesan */}
      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-white px-3 py-3" data-testid="chat-messages">
        {loaded ? (
          view.map((m) =>
            m.progress ? (
              // Baris timeline langkah kerja agen (Task 59) — gaya terminal.
              <div key={m.id} className="flex justify-start" data-testid="chat-progress">
                <div className="flex max-w-[90%] items-start gap-1.5 rounded-lg border border-stone-100 bg-stone-50/70 px-2.5 py-1.5">
                  <Terminal className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
                  <span className="break-words font-mono text-[10.5px] leading-relaxed text-stone-600">
                    {m.content}
                  </span>
                </div>
              </div>
            ) : (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'rounded-br-sm bg-emerald-700 text-white'
                      : m.error
                        ? 'rounded-bl-sm border border-red-200 bg-red-50 text-red-800'
                        : 'rounded-bl-sm border border-stone-200 bg-stone-50 text-stone-800'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ),
          )
        ) : (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-stone-300" aria-label="Memuat obrolan" />
          </div>
        )}
        {showWaiting && (
          <div className="flex justify-start" data-testid="chat-waiting">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-amber-200 bg-amber-50 px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
              <span className="text-[11px] font-medium text-amber-700">{WAIT_TEXT}</span>
            </div>
          </div>
        )}
        {sending && (
          <div className="flex justify-start" data-testid="chat-typing">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-stone-200 bg-stone-50 px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
              <span className="text-[11px] text-stone-400">Meneruskan ke sistem…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={send} className="flex items-end gap-2 border-t border-stone-100 bg-stone-50/80 p-2.5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
          rows={1}
          maxLength={1000}
          placeholder="Tulis pesan ke Head Office…"
          aria-label="Pesan untuk Head Office"
          className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 outline-none placeholder:text-stone-400 focus:border-emerald-500"
          data-testid="chat-input"
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !input.trim()}
          className="h-[38px] w-[38px] shrink-0 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800"
          aria-label="Kirim pesan"
          data-testid="chat-send"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}
