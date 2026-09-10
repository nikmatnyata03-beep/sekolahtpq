// Lapisan AI bersama SIMADJI — dual-runtime:
//
// 1. PRODUKSI (Cloudflare Workers): binding Workers AI "AI" (wrangler.jsonc,
//    tier gratis ±10rb neuron/hari) dengan model Llama 3.3 70B Instruct.
// 2. LOKAL (bun run dev): binding AI tidak ada → fallback ke z-ai-web-dev-sdk
//    (backend-only, import lazy) sehingga fitur AI tetap bisa diuji di sandbox.
//
// Semua pemanggil harus siap menerima error (route mengubahnya jadi 502 dengan
// pesan ramah — pola sama seperti src/lib/pentest/analyze.ts).

import { getCloudflareContext } from '@opennextjs/cloudflare'

export const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

interface WorkersAiLike {
  run(model: string, input: unknown): Promise<unknown>
}

function extractResponse(res: unknown): string {
  if (res && typeof res === 'object' && 'response' in res) {
    const r = (res as { response?: unknown }).response
    if (typeof r === 'string') return r.trim()
  }
  return ''
}

async function workersAiChat(system: string, user: string, maxTokens: number): Promise<string | null> {
  try {
    const { env } = getCloudflareContext()
    const ai = (env as { AI?: WorkersAiLike } | undefined)?.AI
    if (!ai || typeof ai.run !== 'function') return null
    const res = await ai.run(AI_MODEL, {
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.4,
    })
    const text = extractResponse(res)
    return text || null
  } catch (e) {
    console.error('[ai] Workers AI gagal, mencoba fallback SDK:', e instanceof Error ? e.message : e)
    return null
  }
}

async function sdkChat(system: string, user: string): Promise<string> {
  const { default: ZAI } = await import('z-ai-web-dev-sdk')
  const zai = await ZAI.create()
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'assistant', content: system },
      { role: 'user', content: user },
    ],
    thinking: { type: 'disabled' },
  })
  const text = completion.choices[0]?.message?.content?.trim()
  if (!text) throw new Error('Respons AI kosong')
  return text
}

/** Jalankan chat AI: Workers AI dulu, fallback z-ai-web-dev-sdk (lokal). */
export async function runAi(system: string, user: string, maxTokens = 1500): Promise<string> {
  const viaWorkers = await workersAiChat(system, user, maxTokens)
  if (viaWorkers) return viaWorkers
  return sdkChat(system, user)
}

export function aiErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return 'Layanan AI sedang tidak tersedia. Silakan coba lagi sebentar. (' + msg.slice(0, 140) + ')'
}

/** Ekstrak array/objek JSON dari jawaban AI yang kadang dibungkus ```json fence. */
export function extractJsonBlock(raw: string): string | null {
  const cleaned = raw.replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '').trim()
  for (const [open, close] of [
    ['[', ']'],
    ['{', '}'],
  ] as const) {
    const start = cleaned.indexOf(open)
    const end = cleaned.lastIndexOf(close)
    if (start !== -1 && end > start) return cleaned.slice(start, end + 1)
  }
  return null
}
