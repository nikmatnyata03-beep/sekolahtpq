'use client'
// Panel obrolan Head Office — Task 52/53/54/55/56.
// Task 55: mesin chat = GLM internal SIMADJI (/api/kantor/chat → src/lib/ai.ts),
// Gemini dipensiunkan. Task 56: mode Agent (Antigravity) DIHAPUS — panel kini
// chat saja; endpoint /api/kantor/agent sudah dihapus bersama tab-nya.
// Hanya dirender untuk ADMIN & DEVELOPER (akses penuh). Saat balasan tiba,
// agen HEAD di scene 3D di-trigger bicara (bubble) via agent-registry.
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getAgent } from './agent-registry'
import { Bot, Loader2, Send, Trash2, X } from 'lucide-react'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  /** bubble merah utk kegagalan request — tampil permanen (toast gampang terlewat) */
  error?: boolean
}

export function HeadChat({ userName, onClose }: { userName: string; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      content: `Selamat datang, ${userName}. Saya Head Office (GLM) — siap membantu. Ada yang bisa saya bantu?`,
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  // Task 54i: kirim tahan banting — timeout klien, error PERMANEN di bubble chat
  // (toast 4 detik gampang terlewat → dulu terkesan "tombol mati"), teks user
  // dikembalikan bila gagal, dan respons non-JSON (halaman error worker) tetap terbaca.
  const send = async (e?: { preventDefault: () => void }) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    const history = messages.slice(-12).filter((m, i) => !(i === 0 && m.role === 'assistant'))
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setSending(true)
    getAgent('HEAD')?.talk(2.5, 'Memproses…')
    try {
      const res = await fetch('/api/kantor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
        signal: AbortSignal.timeout(40_000),
      })
      const raw = await res.text()
      let body: { reply?: string; error?: string } | null = null
      try {
        body = JSON.parse(raw) as { reply?: string; error?: string }
      } catch {
        body = null
      }
      if (!res.ok || !body?.reply) {
        const serverMsg = body?.error ?? (raw.trim() ? raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) : 'Server tidak merespons')
        const pesan = `⚠️ Gagal (${res.status || 'jaringan'}): ${serverMsg}`
        setMessages((prev) => [...prev, { role: 'assistant', content: pesan, error: true }])
        setInput((cur) => cur || text) // teks user tidak hilang — tinggal kirim ulang
        toast.error(serverMsg.slice(0, 120))
        return
      }
      const reply = body.reply
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      // Head bicara di scene: bubble memuat potongan awal balasan
      const ringkas = reply.replace(/\s+/g, ' ').slice(0, 90)
      getAgent('HEAD')?.talk(5, ringkas + (reply.length > 90 ? '…' : ''))
    } catch (err) {
      const timeout = err instanceof DOMException && err.name === 'TimeoutError'
      const pesan = timeout
        ? '⚠️ Head Office tidak menjawab dalam 40 detik — coba kirim ulang.'
        : '⚠️ Jaringan bermasalah — periksa koneksi lalu kirim ulang.'
      setMessages((prev) => [...prev, { role: 'assistant', content: pesan, error: true }])
      setInput((cur) => cur || text)
      toast.error(timeout ? 'Waktu tunggu habis' : 'Jaringan bermasalah')
    } finally {
      setSending(false)
    }
  }

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
          <p className="text-[10px] font-medium text-emerald-600">GLM · online</p>
        </div>
        {messages.length > 1 && (
          <button
            onClick={() => setMessages((p) => p.slice(0, 1))}
            aria-label="Bersihkan obrolan"
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button onClick={onClose} aria-label="Tutup obrolan" className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Pesan */}
      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto bg-white px-3 py-3" data-testid="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
        ))}
        {sending && (
          <div className="flex justify-start" data-testid="chat-typing">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-stone-200 bg-stone-50 px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-400" />
              <span className="text-[11px] text-stone-400">Head Office mengetik…</span>
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
