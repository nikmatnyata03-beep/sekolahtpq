'use client'

// Dev Console — pusat kendali developer: monitor kesehatan sistem,
// issue otomatis + diagnosa AI + auto-fix, dan obrolan dengan AI Developer
// (terhubung ke konteks sistem live & repositori GitHub).
// Hanya untuk peran DEVELOPER.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  TerminalSquare,
  RefreshCw,
  Loader2,
  HeartPulse,
  GitBranch,
  Bot,
  Send,
  Wrench,
  Stethoscope,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle2,
  Cloud,
  Github,
  ShieldCheck,
} from 'lucide-react'
import type { AuthUser } from '@/lib/types'
import { apiGet, apiSend } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// ===================== Tipe =====================

interface EndpointResult {
  path: string
  status: number
  latencyMs: number
  healthy: boolean
  kind: 'JSON' | 'HTML'
  detail: string
}

interface HealthData {
  db: { healthy: boolean; latencyMs: number; detail: string }
  endpoints: EndpointResult[]
  summary: { total: number; healthy: number; unhealthy: number; checkedAt: string; origin: string }
}

interface IssueRecord {
  id: string
  type: string
  endpoint: string | null
  message: string
  detail: string | null
  status: string
  aiDiagnosis: string | null
  aiFix: string | null
  fixedAt: string | null
  createdAt: string
}

interface ChatMessage {
  id: string
  role: string
  content: string
  createdAt: string
}

const ISSUE_TYPE_LABEL: Record<string, string> = {
  ENDPOINT_FAIL: 'Endpoint Gagal',
  JSON_PARSE: 'JSON Rusak',
  DB_ERROR: 'Database',
  PENTEST_CRITICAL: 'Pentest Kritis',
}

const ISSUE_STATUS_STYLES: Record<string, string> = {
  OPEN: 'border-rose-200 bg-rose-50 text-rose-700',
  DIAGNOSING: 'border-amber-200 bg-amber-50 text-amber-700',
  FIXED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  IGNORED: 'border-stone-200 bg-stone-50 text-stone-500',
}

const ISSUE_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Terbuka',
  DIAGNOSING: 'Diagnosa',
  FIXED: 'Selesai',
  IGNORED: 'Diabaikan',
}

const QUICK_PROMPTS = [
  'Bagaimana kesehatan sistem saat ini?',
  'Apa yang harus diperbaiki paling dulu?',
  'Jelaskan hasil pentest terakhir',
  'Kenapa JSON bisa gagal dimuat di panel admin?',
]

export function DevConsole({ user }: { user: AuthUser }) {
  const { toast } = useToast()
  const [health, setHealth] = useState<HealthData | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [issues, setIssues] = useState<IssueRecord[]>([])
  const [issueCounts, setIssueCounts] = useState({ open: 0, diagnosing: 0, fixed: 0 })
  const [expanded, setExpanded] = useState<string | null>(null)
  const [busyIssue, setBusyIssue] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // chat
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const loadIssues = useCallback(async () => {
    try {
      const data = await apiGet<{ issues: IssueRecord[]; counts: { open: number; diagnosing: number; fixed: number } }>('/api/dev/issues')
      setIssues(data.issues)
      setIssueCounts(data.counts)
    } catch {
      /* diamkan */
    }
  }, [])

  const loadChat = useCallback(async () => {
    try {
      const data = await apiGet<{ messages: ChatMessage[] }>('/api/dev/chat')
      setMessages(data.messages)
    } catch {
      /* diamkan */
    }
  }, [])

  useEffect(() => {
    void loadIssues()
    void loadChat()
  }, [loadIssues, loadChat])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight })
  }, [messages, chatSending])

  async function runHealth() {
    if (healthLoading) return
    setHealthLoading(true)
    try {
      const data = await apiGet<HealthData>('/api/dev/health')
      setHealth(data)
      await loadIssues()
      toast({
        title: data.summary.unhealthy === 0 ? 'Semua sistem sehat ✓' : `${data.summary.unhealthy} endpoint bermasalah`,
        description: `Database ${data.db.healthy ? 'OK' : 'GAGAL'} · ${data.summary.healthy}/${data.summary.total} endpoint sehat`,
        variant: data.summary.unhealthy === 0 ? 'default' : 'destructive',
      })
    } catch (e) {
      toast({ title: 'Pemeriksaan gagal', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setHealthLoading(false)
    }
  }

  async function issueAction(id: string, action: 'diagnose' | 'autofix' | 'ignore') {
    if (busyIssue) return
    setBusyIssue(id)
    try {
      if (action === 'diagnose') {
        const res = await apiSend<{ diagnosis: string }>('/api/dev/diagnose', 'POST', { issueId: id })
        toast({ title: 'Diagnosa AI selesai', description: res.diagnosis.split('\n')[0].slice(0, 90) + '…' })
      } else if (action === 'autofix') {
        const res = await apiSend<{ result: string }>('/api/dev/issues', 'POST', { action: 'autofix', id })
        toast({ title: 'Auto-fix selesai', description: res.result.slice(0, 120) })
      } else {
        await apiSend('/api/dev/issues', 'POST', { action: 'ignore', id })
        toast({ title: 'Issue diabaikan' })
      }
      await loadIssues()
    } catch (e) {
      toast({ title: 'Aksi gagal', description: e instanceof Error ? e.message : '', variant: 'destructive' })
    } finally {
      setBusyIssue(null)
    }
  }

  async function sendChat(text?: string) {
    const message = (text ?? chatInput).trim()
    if (!message || chatSending) return
    setChatInput('')
    setChatSending(true)
    const optimistic: ChatMessage = { id: `tmp-${Date.now()}`, role: 'user', content: message, createdAt: new Date().toISOString() }
    setMessages((prev) => [...prev, optimistic])
    try {
      const res = await apiSend<{ message: ChatMessage }>('/api/dev/chat', 'POST', { message })
      setMessages((prev) => [...prev.filter((m) => m.id !== optimistic.id), optimistic, res.message])
    } catch (e) {
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: `⚠ ${e instanceof Error ? e.message : 'Gagal menghubungi AI.'}`, createdAt: new Date().toISOString() }])
    } finally {
      setChatSending(false)
    }
  }

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* clipboard ditolak */
    }
  }

  return (
    <div className="grid gap-6">
      {/* ====== Header koneksi ====== */}
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <TerminalSquare className="size-5 text-emerald-700" />
            Dev Console — Kendali Developer
            <Badge variant="outline" className="border-purple-200 bg-purple-50 text-[10px] text-purple-700">
              {user.name}
            </Badge>
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5">
              <Github className="size-3.5 text-stone-600" /> Repo: nikmatnyata03-beep/sekolahtpq
            </span>
            <span className="flex items-center gap-1.5">
              <Cloud className="size-3.5 text-stone-600" /> Worker: tpq · auto-deploy aktif
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-600" /> Perbaikan kode diterapkan agen otomatis via GitHub
            </span>
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ====== Kolom kiri: kesehatan + issue ====== */}
        <div className="grid content-start gap-6 lg:col-span-3">
          {/* Kesehatan */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <HeartPulse className="size-5 text-rose-500" />
                Kesehatan Sistem
                {health && (
                  <Badge
                    className={cn(
                      'ml-auto border text-[10px]',
                      health.summary.unhealthy === 0 ? 'border-emerald-200 bg-emerald-100 text-emerald-800' : 'border-rose-200 bg-rose-100 text-rose-700',
                    )}
                  >
                    {health.summary.healthy}/{health.summary.total} endpoint sehat
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Memeriksa database dan seluruh endpoint — termasuk validitas JSON (deteksi dini &quot;panel gagal memuat data&quot;).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={() => void runHealth()} disabled={healthLoading} className="gap-2 bg-emerald-700 hover:bg-emerald-800">
                  {healthLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  {healthLoading ? 'Memeriksa…' : 'Pemeriksaan Sistem'}
                </Button>
                {health && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                    <span className="flex items-center gap-1.5">
                      <span className={cn('size-2 rounded-full', health.db.healthy ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse')} />
                      Database {health.db.healthy ? 'OK' : 'GAGAL'} · {health.db.latencyMs}ms · {health.db.detail}
                    </span>
                  </div>
                )}
              </div>

              {health && (
                <div className="grid gap-1.5">
                  {health.endpoints.map((ep) => (
                    <div key={ep.path} className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 rounded-lg border border-stone-100 bg-stone-50/60 px-3 py-2">
                      <span className={cn('size-2 shrink-0 rounded-full', ep.healthy ? 'bg-emerald-500' : 'bg-rose-500')} />
                      <span className="font-mono text-xs break-all text-stone-700">{ep.path}</span>
                      <span className="ml-auto flex items-center gap-2 whitespace-nowrap text-[11px] text-stone-400">
                        {ep.latencyMs}ms
                        <Badge variant="outline" className="text-[9px]">{ep.kind}</Badge>
                      </span>
                      {!ep.healthy && <p className="w-full text-[11px] break-words text-rose-600">{ep.detail}</p>}
                    </div>
                  ))}
                  <p className="mt-1 text-[11px] text-stone-400">Pemeriksaan terakhir: {new Date(health.summary.checkedAt).toLocaleTimeString('id-ID')} WIB</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Issues */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <Stethoscope className="size-5 text-amber-600" />
                Issue Sistem
                <span className="ml-auto flex flex-wrap gap-1.5">
                  <Badge className="border-rose-200 bg-rose-50 text-[10px] text-rose-700">{issueCounts.open} terbuka</Badge>
                  <Badge className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">{issueCounts.diagnosing} diagnosa</Badge>
                  <Badge className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700">{issueCounts.fixed} selesai</Badge>
                </span>
              </CardTitle>
              <CardDescription>Terisi otomatis dari pemeriksaan sistem. Gunakan Diagnosa AI lalu Auto-Fix.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2.5">
              {issues.length === 0 && <p className="py-6 text-center text-sm text-stone-400">Belum ada issue — jalankan Pemeriksaan Sistem.</p>}
              {issues.map((iss) => {
                const isOpen = expanded === iss.id
                return (
                  <div key={iss.id} className={cn('rounded-xl border', isOpen ? 'border-emerald-300 bg-emerald-50/40' : 'border-stone-200 bg-white')}>
                    <button type="button" onClick={() => setExpanded(isOpen ? null : iss.id)} className="flex w-full items-start gap-2.5 p-3.5 text-left" aria-expanded={isOpen}>
                      <Badge variant="outline" className="mt-0.5 shrink-0 border-stone-300 text-[10px] text-stone-600">
                        {ISSUE_TYPE_LABEL[iss.type] ?? iss.type}
                      </Badge>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium break-words text-stone-800">{iss.message}</span>
                        <span className="mt-0.5 block font-mono text-[11px] break-all text-stone-500">
                          {iss.endpoint ?? '—'} · {new Date(iss.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </span>
                      <Badge className={cn('shrink-0 border text-[10px]', ISSUE_STATUS_STYLES[iss.status])}>{ISSUE_STATUS_LABEL[iss.status] ?? iss.status}</Badge>
                      {isOpen ? <ChevronUp className="mt-1 size-4 shrink-0 text-stone-400" /> : <ChevronDown className="mt-1 size-4 shrink-0 text-stone-400" />}
                    </button>
                    {isOpen && (
                      <div className="grid gap-3 border-t border-emerald-100 px-3.5 pb-4 pt-3">
                        {iss.detail && (
                          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                            <p className="mb-1 text-[11px] font-semibold text-stone-500">Detail teknis</p>
                            <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-xs break-all text-stone-700">{iss.detail}</pre>
                          </div>
                        )}
                        {iss.aiDiagnosis && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-amber-800">
                              <Bot className="size-3" /> Diagnosa AI
                            </p>
                            <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs break-words text-stone-700">{iss.aiDiagnosis}</pre>
                          </div>
                        )}
                        {iss.aiFix && (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
                                <Wrench className="size-3" /> Perbaikan
                              </p>
                              <button type="button" onClick={() => void copyText(iss.id, iss.aiFix ?? '')} className="flex items-center gap-1 text-[11px] text-emerald-700 hover:underline">
                                <Copy className="size-3" /> {copied === iss.id ? 'Tersalin!' : 'Salin'}
                              </button>
                            </div>
                            <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs break-words text-emerald-900">{iss.aiFix}</pre>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" className="h-8 gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-50" disabled={!!busyIssue} onClick={() => void issueAction(iss.id, 'diagnose')}>
                            {busyIssue === iss.id ? <Loader2 className="size-3.5 animate-spin" /> : <Stethoscope className="size-3.5" />} Diagnosa AI
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50" disabled={!!busyIssue} onClick={() => void issueAction(iss.id, 'autofix')}>
                            <Wrench className="size-3.5" /> Auto-Fix
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-stone-400" disabled={!!busyIssue} onClick={() => void issueAction(iss.id, 'ignore')}>
                            <EyeOff className="size-3.5" /> Abaikan
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        {/* ====== Kolom kanan: obrolan AI developer ====== */}
        <div className="lg:col-span-2">
          <Card className="lg:sticky lg:top-6 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="size-5 text-emerald-700" />
                AI Developer
                <span className="ml-auto flex items-center gap-1 text-[10px] font-normal text-stone-400">
                  <GitBranch className="size-3" /> terhubung GitHub + Cloudflare
                </span>
              </CardTitle>
              <CardDescription>Asisten yang memahami kondisi live sistem ini — tanya apa saja tentang web Anda.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div ref={chatRef} className="flex max-h-[420px] min-h-56 flex-col gap-2.5 overflow-y-auto rounded-xl border border-stone-100 bg-stone-50/50 p-3">
                {messages.length === 0 && !chatSending && (
                  <div className="m-auto max-w-64 text-center">
                    <Bot className="mx-auto mb-2 size-8 text-stone-300" />
                    <p className="text-xs leading-relaxed text-stone-400">
                      Halo! Saya AI Developer SIMADJI. Saya bisa membaca kondisi sistem live, menjelaskan hasil pentest, dan menyiapkan perbaikan.
                    </p>
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap',
                        m.role === 'user' ? 'rounded-br-md bg-emerald-700 text-white' : 'rounded-bl-md border border-stone-200 bg-white text-stone-700',
                      )}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {chatSending && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-400">
                      <Loader2 className="size-3.5 animate-spin" /> AI sedang berpikir…
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void sendChat(q)}
                    disabled={chatSending}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-800 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>

              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void sendChat()
                }}
              >
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Tulis pertanyaan developer…"
                  maxLength={2000}
                  className="min-w-0 flex-1"
                />
                <Button type="submit" size="icon" disabled={chatSending || !chatInput.trim()} className="size-10 shrink-0 bg-emerald-700 hover:bg-emerald-800" aria-label="Kirim">
                  {chatSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </form>
              <p className="flex items-center gap-1.5 text-[11px] text-stone-400">
                <CheckCircle2 className="size-3 text-emerald-500" /> Perbaikan kode aktual dieksekusi agen otomatis melalui commit GitHub → auto-deploy Cloudflare.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
