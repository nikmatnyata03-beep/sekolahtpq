'use client'
// Panel obrolan Head Office + mode Agent Antigravity — Task 52/53/54.
// Mode "Chat": Q&A cepat via Gemini 3.6 Flash (/api/kantor/chat).
// Mode "Agent": tugas agentic via Antigravity agent — sandbox remote Google,
// bisa eksekusi kode & jelajah web, hasil 1–5 menit (/api/kantor/agent).
// Hanya dirender untuk ADMIN & DEVELOPER (akses penuh). Saat balasan tiba,
// agen HEAD di scene 3D di-trigger bicara (bubble) via agent-registry.
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { getAgent } from './agent-registry'
import { Bot, Loader2, Send, Sparkles, Trash2, X } from 'lucide-react'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

type Mode = 'chat' | 'agent'

export function HeadChat({ userName, onClose }: { userName: string; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      content: `Selamat datang, ${userName}. Saya Head Office (Gemini 3.6 Flash) — siap membantu. Ada yang bisa saya bantu?`,
    },
  ])
  const [mode, setMode] = useState<Mode>('chat')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  const switchMode = (next: Mode) => {
    if (sending || next === mode) return
    setMode(next)
    if (next === 'agent') {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Mode Agent (Antigravity) aktif. Beri tugas mandiri — mis. "cari 3 ide kegiatan TPQ dari web" atau "buat draft jadwal latihan". Agent bisa eksekusi kode & jelajah web; hasil butuh 1–5 menit.',
        },
      ])
    }
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setSending(true)
    getAgent('HEAD')?.talk(2.5, mode === 'agent' ? 'Menugaskan agent…' : 'Memproses…')
    try {
      const isAgent = mode === 'agent'
      const res = await fetch(isAgent ? '/api/kantor/agent' : '/api/kantor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: isAgent ? JSON.stringify({ tugas: text }) : JSON.stringify({ message: text, history: messages.slice(-12).filter((m, i) => !(i === 0 && m.role === 'assistant')) }),
      })
      const body = (await res.json()) as { reply?: string; error?: string }
      if (!res.ok || !body.reply) {
        toast.error(body.error ?? 'Tidak ada respons dari server')
        return
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: body.reply as string }])
      // Head bicara di scene: bubble memuat potongan awal balasan
      const ringkas = body.reply.replace(/\s+/g, ' ').slice(0, 90)
      getAgent('HEAD')?.talk(5, ringkas + (body.reply.length > 90 ? '…' : ''))
    } catch {
      toast.error('Jaringan bermasalah — coba lagi.')
    } finally {
      setSending(false)
    }
  }

  const isAgent = mode === 'agent'

  return (
    <div
      className="absolute end-2 bottom-2 z-30 flex max-h-[75vh] w-[calc(100vw-1rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl sm:end-4 sm:bottom-4"
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
          <p className={`text-[10px] font-medium ${isAgent ? 'text-amber-600' : 'text-emerald-600'}`}>
            {isAgent ? 'Antigravity Agent · sandbox remote' : 'Gemini 3.6 Flash · online'}
          </p>
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

      {/* Toggle mode: Chat vs Agent */}
      <div className="flex gap-1 border-b border-stone-100 bg-stone-50/60 p-1.5" role="tablist" aria-label="Mode percakapan" data-testid="chat-mode-toggle">
        <button
          role="tab"
          aria-selected={!isAgent}
          onClick={() => switchMode('chat')}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
            !isAgent ? 'bg-emerald-700 text-white shadow-sm' : 'text-stone-500 hover:bg-stone-100'
          }`}
          data-testid="mode-chat"
        >
          Chat
        </button>
        <button
          role="tab"
          aria-selected={isAgent}
          onClick={() => switchMode('agent')}
          className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
            isAgent ? 'bg-amber-600 text-white shadow-sm' : 'text-stone-500 hover:bg-stone-100'
          }`}
          data-testid="mode-agent"
        >
          <Sparkles className="h-3 w-3" />
          Agent
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
                  : isAgent && i === messages.length - 1 && m.role === 'assistant'
                    ? 'rounded-bl-sm border border-amber-200 bg-amber-50 text-amber-900'
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
              <span className="text-[11px] text-stone-400">
                {isAgent ? 'Antigravity bekerja… (1–5 menit)' : 'Head Office mengetik…'}
              </span>
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
              void send(e)
            }
          }}
          rows={1}
          maxLength={isAgent ? 800 : 1000}
          placeholder={isAgent ? 'Beri tugas ke agent… (mis. riset web)' : 'Tulis pesan ke Head Office…'}
          aria-label={isAgent ? 'Tugas untuk agent Antigravity' : 'Pesan untuk Head Office'}
          className="max-h-24 min-h-[38px] flex-1 resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs text-stone-800 outline-none placeholder:text-stone-400 focus:border-emerald-500"
          data-testid="chat-input"
        />
        <Button
          type="submit"
          size="icon"
          disabled={sending || !input.trim()}
          className={`h-[38px] w-[38px] shrink-0 rounded-xl text-white ${isAgent ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-700 hover:bg-emerald-800'}`}
          aria-label={isAgent ? 'Kirim tugas' : 'Kirim pesan'}
          data-testid="chat-send"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  )
}
