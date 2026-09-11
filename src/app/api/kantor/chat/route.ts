// POST /api/kantor/chat — obrolan live dengan Head Office AI.
// Task 52: akses penuh hanya ADMIN & DEVELOPER (guru = mode lihat saja di /kantor).
// Task 53: gemini-3.6-flash via REST (geo-block & key AQ. kerap gagal).
// Task 55: Gemini DIPENSIKAN — Head Office kini memakai lapisan AI internal
// SIMADJI (src/lib/ai.ts): Workers AI (produksi, model Llama 3.3 70B) dengan
// fallback z-ai-web-dev-sdk/GLM (lokal). Tanpa API key eksternal, tanpa geo-block.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { guard } from '@/lib/session'
import { runAiMessages, aiErrorMessage, type AiTurn } from '@/lib/ai'

const chatSchema = z.object({
  message: z.string().trim().min(1, 'Pesan kosong').max(1000, 'Pesan maksimal 1000 karakter'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .max(12, 'Riwayat terlalu panjang')
    .optional(),
})

const SYSTEM_INSTRUCTION = `Kamu adalah "Head Office", agen AI kepala di web 3D "Kantor AI Agent" milik SIMADJI (sistem manajemen TPQ Darul Jinan, Yogyakarta).
Mesin yang kamu jalankan: GLM internal SIMADJI (lapisan AI src/lib/ai.ts). Kamu memimpin 6 divisi agen: General Purpose, Explore, Plan, Frontend, Fullstack, dan PPT.
Gaya bicara: profesional, hangat, ringkas — seperti kepala kantor yang efisien. Jawab MAKSIMAL ~120 kata dalam bahasa Indonesia.
Kamu boleh membantu hal seputar kantor, tugas divisi, serta pertanyaan umum singkat. Jangan mengarang data santri/keuangan nyata — data operasional TPQ bukan wewenangmu di sini; arahkan ke dashboard SIMADJI.`

// ---- Rate limit per user (window geser in-memory): 10 pesan/menit ----
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 10
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

export async function POST(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'DEVELOPER'])
  if ('res' in g) return g.res
  const session = g.session

  try {
    if (rateLimited(`${session.id}:${req.headers.get('cf-connecting-ip') ?? 'lokal'}`)) {
      return NextResponse.json({ error: 'Terlalu sering — semenit lagi ya.' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const parsed = chatSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
        { status: 400 },
      )
    }
    const { message, history } = parsed.data

    // Susun giliran multi-turn: riwayat (maks 12) + pesan baru
    const turns: AiTurn[] = [
      ...(history ?? []).map((h) => ({ role: h.role, content: h.content }) as AiTurn),
      { role: 'user', content: message },
    ]

    const reply = await runAiMessages(SYSTEM_INSTRUCTION, turns, 700)
    return NextResponse.json({ reply })
  } catch (e) {
    console.error('[kantor/chat]', e)
    return NextResponse.json({ error: aiErrorMessage(e) }, { status: 502 })
  }
}
