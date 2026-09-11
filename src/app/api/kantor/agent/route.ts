// POST /api/kantor/agent — tugas agentic via "Antigravity agent" (managed agent Gemini API).
// Task 54: antarmuka ke Interactions API Google (GA sejak Juni 2026) — endpoint sama
// dengan chat (generativelanguage.googleapis.com) & key yang sama (GEMINI_API_KEY).
// Agent berjalan di sandbox Linux remote milik Google: bisa eksekusi kode, kelola file,
// dan menjelajah web. Satu tugas bisa butuh 1–5 menit (tool-use loop).
// ID agent dapat dioverride via env ANTIGRAVITY_AGENT_ID (default preview resmi).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { guard } from '@/lib/session'

const agentSchema = z.object({
  tugas: z.string().trim().min(1, 'Tugas kosong').max(800, 'Tugas maksimal 800 karakter'),
})

const TASK_PREFIX = `Kamu adalah agen Antigravity yang melayani web SIMADJI (sistem manajemen TPQ Darul Jinan, Yogyakarta).
Kerjakan tugas berikut secara mandiri di sandbox-mu (boleh cari web / eksekusi kode bila perlu), lalu laporkan hasil akhirnya RINGKAS dan JELAS dalam bahasa Indonesia.

TUGAS: `

// ---- Rate limit per user+IP: 4 tugas / 5 menit (panggilan agent mahal & lambat) ----
const WINDOW_MS = 5 * 60_000
const MAX_PER_WINDOW = 4
const hits = new Map<string, number[]>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (arr.length >= MAX_PER_WINDOW) {
    hits.set(key, arr)
    return true
  }
  arr.push(now)
  hits.set(key, arr)
  if (hits.size > 500) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k)
  }
  return false
}

// Respons REST = resource "Interaction" berisi langkah-langkah (reasoning, tool call,
// code execution, model_output). output_text adalah kenyamanan SDK — parse defensif:
// utamakan field output_text bila ada, lalu kumpulkan teks dari step model_output.
interface InteractionStep {
  type?: string
  step_type?: string
  text?: string
  content?: unknown
  parts?: Array<{ text?: string }>
}
interface InteractionResponse {
  id?: string
  output_text?: string
  steps?: InteractionStep[]
  error?: { message?: string; status?: string }
}

function collectTexts(node: unknown, out: string[]): void {
  if (!node) return
  if (typeof node === 'string') {
    out.push(node)
    return
  }
  if (Array.isArray(node)) {
    for (const n of node) collectTexts(n, out)
    return
  }
  const o = node as Record<string, unknown>
  if (typeof o['text'] === 'string') out.push(o['text'] as string)
  if (o['content'] !== undefined) collectTexts(o['content'], out)
  if (o['parts'] !== undefined) collectTexts(o['parts'], out)
}

function extractReply(data: InteractionResponse): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }
  const texts: string[] = []
  for (const step of data.steps ?? []) {
    const t = `${step.type ?? ''} ${step.step_type ?? ''}`
    if (/model_output|final/i.test(t)) collectTexts(step, texts)
  }
  // fallback terakhir: teks dari step apa pun (agar tidak kosong)
  if (!texts.length) for (const step of data.steps ?? []) collectTexts(step, texts)
  return texts.join('\n').trim()
}

export async function POST(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'DEVELOPER'])
  if ('res' in g) return g.res
  const session = g.session

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Kunci Gemini belum dikonfigurasi di server (GEMINI_API_KEY).' },
        { status: 503 },
      )
    }

    if (rateLimited(`${session.id}:${req.headers.get('cf-connecting-ip') ?? 'lokal'}`)) {
      return NextResponse.json(
        { error: 'Batas tugas agent tercapai (4 per 5 menit) — coba lagi nanti.' },
        { status: 429 },
      )
    }

    const body = await req.json().catch(() => null)
    const parsed = agentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
        { status: 400 },
      )
    }

    // ID agent preview resmi (dok Google, Sep 2026); override via env bila berganti.
    const AGENT_ID = process.env.ANTIGRAVITY_AGENT_ID ?? 'antigravity-preview-05-2026'

    const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        agent: AGENT_ID,
        input: [{ type: 'text', text: TASK_PREFIX + parsed.data.tugas }],
        environment: 'remote',
      }),
      // Agent menjalankan loop tool-use (bisa menit-menit); batasi 280 dtk.
      signal: AbortSignal.timeout(280_000),
    })

    const data = (await upstream.json().catch(() => null)) as InteractionResponse | null

    if (!upstream.ok || !data) {
      const msg = data?.error?.message ?? `HTTP ${upstream.status}`
      console.error(`[kantor/agent] upstream error (agent=${AGENT_ID}):`, msg)
      if (/prepayment|billing|credits?/i.test(msg)) {
        return NextResponse.json(
          { error: 'Kredit Gemini API habis — isi ulang di https://ai.studio/projects (Billing), lalu coba lagi.' },
          { status: 402 },
        )
      }
      const status = upstream.status === 429 ? 429 : 502
      return NextResponse.json(
        {
          error:
            status === 429
              ? 'Agent sedang sibuk (limit) — coba beberapa detik lagi.'
              : `Antigravity gagal merespons (${msg.slice(0, 140)})`,
        },
        { status },
      )
    }

    const reply = extractReply(data)
    if (!reply) {
      return NextResponse.json(
        { error: 'Agent selesai tanpa laporan teks — coba ulangi tugas.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ reply, interactionId: data.id ?? null })
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      return NextResponse.json(
        { error: 'Tugas agent melebihi 280 detik — coba tugas yang lebih kecil.' },
        { status: 504 },
      )
    }
    console.error('[kantor/agent]', e)
    return NextResponse.json({ error: 'Gagal menghubungi agent Antigravity' }, { status: 500 })
  }
}
