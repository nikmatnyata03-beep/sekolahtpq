// POST /api/kantor/chat — obrolan live dengan Head Office AI (Gemini 3.6 Flash).
// Task 52: akses penuh hanya ADMIN & DEVELOPER (guru = mode lihat saja di /kantor).
// Task 53: model diganti gemini-3.6-flash (dapat dioverride via env GEMINI_MODEL).
// Key dari env GEMINI_API_KEY (set di .env lokal / secret Cloudflare produksi).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { guard } from '@/lib/session'

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

const SYSTEM_INSTRUCTION = `Kamu adalah "Head Office", agen AI kepala di web 3D "Kantor AI Agent" milik SIMADJI (sistem manajemen TPQ Darul Jinan).
Model yang kamu jalankan: Gemini 3.6 Flash. Kamu memimpin 6 divisi agen (semua bertenaga GLM 5.3 Flash): General Purpose, Explore, Plan, Frontend, Fullstack, dan PPT.
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

interface GeminiPart {
  text?: string
}
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>
  error?: { message?: string; status?: string }
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

    // Task 53: model dapat dioverride tanpa deploy ulang kode (env GEMINI_MODEL)
    const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash'

    const contents = [
      ...(history ?? []).map((h) => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ]

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 700 },
        }),
        signal: AbortSignal.timeout(30_000),
      },
    )

    const data = (await upstream.json().catch(() => null)) as GeminiResponse | null

    if (!upstream.ok || !data) {
      const msg = data?.error?.message ?? `HTTP ${upstream.status}`
      console.error(`[kantor/chat] upstream error (model=${MODEL}):`, msg)
      // Kasus spesifik: kredit prepayment Gemini habis (key valid, akun tanpa saldo)
      if (/prepayment|billing|credits?/i.test(msg)) {
        return NextResponse.json(
          { error: 'Kredit Gemini API habis — isi ulang di https://ai.studio/projects (Billing), lalu coba lagi.' },
          { status: 402 },
        )
      }
      // Geo-block: egress server berada di wilayah yang tidak didukung Google
      // (mis. sandbox uji lokal keluar via Hong Kong). Produksi (Cloudflare) aman.
      if (/location is not supported/i.test(msg)) {
        return NextResponse.json(
          { error: 'Lokasi server ini tidak didukung Google Gemini (geo-block). Jalankan dari produksi (Cloudflare).' },
          { status: 502 },
        )
      }
      // Dari egress ter-geo-block, key VALID pun bisa ditolak sbg kredensial tidak dikenal.
      if (/UNAUTHENTICATED|invalid authentication credentials/i.test(msg)) {
        return NextResponse.json(
          { error: 'Gemini menolak kredensial (kemungkinan geo-block server uji atau API key salah). Cek key/project di https://aistudio.google.com/apikey.' },
          { status: 502 },
        )
      }
      const status = upstream.status === 429 ? 429 : 502
      return NextResponse.json(
        {
          error:
            status === 429
              ? 'Gemini sedang sibuk (limit) — coba beberapa detik lagi.'
              : `Gemini gagal merespons (${msg.slice(0, 140)})`,
        },
        { status },
      )
    }

    const reply = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim()

    if (!reply) {
      return NextResponse.json({ error: 'Gemini tidak memberi jawaban — coba ulangi.' }, { status: 502 })
    }

    return NextResponse.json({ reply })
  } catch (e) {
    console.error('[kantor/chat]', e)
    return NextResponse.json({ error: 'Gagal menghubungi Head Office' }, { status: 500 })
  }
}
