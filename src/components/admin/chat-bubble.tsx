'use client'
// Bubble chat AI di dashboard SIMADJI — Task 58.
// Tombol melayang (FAB) kanan-bawah untuk GURU, ADMIN, dan DEVELOPER;
// panel obrolan bisa dibuka/tutup. Backend memakai antrian asinkron D1 yang
// sama dengan Head Office (Task 57): POST /api/kantor/chat menyimpan pesan
// 'pending' → tampil "Sedang di proses sistem, silahkan tunggu…" → agen AI
// menjawab via cron 5 menit → klien polling GET saat ada pending.
//
// Ekstra dibanding panel /kantor:
//  - badge jumlah pending + titik "belum dibaca" di FAB (terlihat saat tertutup)
//  - polling tetap berjalan saat panel tertutup agar badge akurat
//  - tanpa ketergantungan scene 3D (agent-registry) milik halaman kantor
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Bot, Loader2, MessageSquarePlus, MessagesSquare, Send, X } from 'lucide-react'

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
  status?: string // user: pending|processing|answered|error
  error?: boolean // bubble merah (gagal kirim / jawaban gagal dari agen)
}

const WAIT_TEXT = 'Sedang di proses sistem, silahkan tunggu…'

export function ChatBubble({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [loaded, setLoaded] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [unread, setUnread] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const refreshBusy = useRef(false)
  const seenAssistant = useRef<Set<string>>(new Set())
  const opened = useRef(false)

  const welcome: ChatMsg[] = useMemo(
    () =>
      sessionId
        ? []
        : [
            {
              id: 'welcome',
              role: 'assistant',
              content: `Selamat datang, ${userName}. Saya Asisten AI SIMADJI (Head Office).\nPesan Anda masuk antrian sistem (diproses ±5 menit). Ada yang bisa dibantu?`,
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
          error: m.role === 'assistant' && m.content.startsWith('⚠️'),
        }))
        setSessionId(body.session.id)
        setMessages(list)
        // Badge "belum dibaca": balasan baru yang belum terlihat saat panel tertutup.
        if (!opened.current) {
          const fresh = list.filter(
            (m) => m.role === 'assistant' && !m.error && !seenAssistant.current.has(m.id),
          ).length
          if (fresh > 0) setUnread((u) => u + fresh)
        }
        for (const m of list) seenAssistant.current.add(m.id)
      } catch {
        // polling sunyi — kegagalan jaringan tidak mengganggu tampilan
      } finally {
        refreshBusy.current = false
      }
    },
    [sessionId],
  )

  // Muat sesi terakhir milik user sekali saat komponen terpasang.
  useEffect(() => {
    void refresh(null).finally(() => setLoaded(true))
  }, [])

  // Polling tiap 5 detik HANYA saat ada pesan pending — panel terbuka atau tertutup.
  useEffect(() => {
    if (!sessionId || pendingCount === 0) return
    const t = setInterval(() => void refresh(), 5_000)
    return () => clearInterval(t)
  }, [sessionId, pendingCount, refresh])

  // Buka panel → reset badge, muat ulang dari server, fokus ke input.
  const openPanel = () => {
    setOpen(true)
    opened.current = true
    setUnread(0)
    void refresh()
  }

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending, pendingCount, open])

  const send = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
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
  const showWaiting = pendingCount > 0 && !sending
  const fabBadge = pendingCount + unread

  return (
    <>
      {/* Panel obrolan */}
      {open && (
        <div
          className="fixed bottom-20 end-4 z-50 flex h-[min(560px,calc(100dvh-6.5rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          data-testid="dashboard-chat"
          role="dialog"
          aria-label="Obrolan Asisten AI"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-stone-100 bg-stone-50/80 px-3 py-2.5">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
              <Bot className="h-5 w-5" />
              <span className="absolute -end-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-stone-900">Asisten AI</p>
              <p className="text-[10px] font-medium text-emerald-600">Head Office · antrian ±5 mnt</p>
            </div>
            <button
              onClick={newSession}
              aria-label="Mulai sesi baru"
              title="Sesi baru"
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setOpen(false)
                opened.current = false
              }}
              aria-label="Tutup obrolan"
              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Pesan */}
          <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-white px-3 py-3" data-testid="chat-messages">
            {loaded ? (
              view.map((m) => (
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
              ))
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
              placeholder="Tulis pesan untuk Asisten AI…"
              aria-label="Pesan untuk Asisten AI"
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
      )}

      {/* FAB — tombol melayang pembuka bubble */}
      <button
        type="button"
        onClick={open ? () => {
          setOpen(false)
          opened.current = false
        } : openPanel}
        aria-label={open ? 'Tutup obrolan' : 'Buka obrolan Asisten AI'}
        aria-expanded={open}
        className="fixed bottom-4 end-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-xl transition-all duration-150 hover:scale-105 hover:bg-emerald-800 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        data-testid="chat-fab"
      >
        {open ? <X className="h-6 w-6" /> : <MessagesSquare className="h-6 w-6" />}
        {!open && fabBadge > 0 && (
          <span
            className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-amber-500 px-1 text-[10px] font-bold text-white"
            data-testid="chat-fab-badge"
            aria-label={`${fabBadge} pesan menunggu`}
          >
            {fabBadge > 9 ? '9+' : fabBadge}
          </span>
        )}
        {!open && pendingCount > 0 && (
          <span className="absolute -bottom-0.5 -start-0.5 flex h-3.5 w-3.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-500" />
          </span>
        )}
      </button>
    </>
  )
}
