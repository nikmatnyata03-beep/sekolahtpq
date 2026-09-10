// Entry Worker KUSTOM — SIMADJI di Cloudflare Workers.
//
// OpenNext menghasilkan .open-next/worker.js (handler Next.js). Entry ini
// membungkusnya dengan tiga kemampuan tambahan:
//
//   - fetch     → diteruskan ke handler OpenNext (perilaku sama dgn sebelumnya),
//                 KECUALI request upgrade WebSocket /api/realtime/presence yang
//                 diteruskan langsung ke Durable Object PRESENCE_HUB
//                 (Next.js/OpenNext tidak mendukung WebSocket upgrade).
//   - scheduled → dipanggil Cloudflare sesuai triggers.crons di wrangler.jsonc
//                 (harian 00:00 UTC = 07:00 WIB) dan memicu /api/cron/daily
//                 SECARA IN-PROCESS (bukan self-fetch — Workers memblokir
//                 fetch ke hostname sendiri dengan error 1042).
//   - export PresenceHub → kelas Durable Object wajib diekspor dari entry utama.
//
// Catatan CPU: logika cron sengaja dibuat ringan (2–3 query D1 + batch insert)
// agar aman di batas CPU tier gratis.

import worker from '../.open-next/worker.js'
import { PresenceHub } from './durable/presence-hub'

export { PresenceHub }

interface MinimalCtx {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException?(): void
}

interface NamespaceLike {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> }
}

interface MinimalEnv {
  CRON_SECRET?: string
  PRESENCE_HUB?: NamespaceLike
  [key: string]: unknown
}

async function runDailyCron(env: MinimalEnv, ctx: MinimalCtx): Promise<void> {
  const secret = env.CRON_SECRET
  if (!secret) {
    console.error('[cron] CRON_SECRET tidak tersedia di env — lewati eksekusi')
    return
  }
  const req = new Request('https://internal.local/api/cron/daily', {
    method: 'GET',
    headers: { 'x-cron-secret': secret },
  })
  try {
    const res = await worker.fetch(req, env, ctx)
    const body = await res.text()
    console.log(`[cron] daily -> HTTP ${res.status}: ${body.slice(0, 400)}`)
  } catch (e) {
    console.error('[cron] daily gagal:', e)
  }
}

const simadjiWorker = {
  async fetch(request: Request, env: MinimalEnv, ctx: MinimalCtx): Promise<Response> {
    // Panel Presensi Live: upgrade WebSocket → langsung ke Durable Object.
    const upgrade = (request.headers.get('upgrade') ?? '').toLowerCase()
    if (upgrade === 'websocket' && env.PRESENCE_HUB) {
      const url = new URL(request.url)
      if (url.pathname === '/api/realtime/presence') {
        try {
          const stub = env.PRESENCE_HUB.get(env.PRESENCE_HUB.idFromName('global'))
          return await stub.fetch(request)
        } catch (e) {
          console.error('[presence] upgrade gagal:', e)
          return new Response('WebSocket tidak tersedia', { status: 502 })
        }
      }
    }
    return worker.fetch(request, env, ctx)
  },

  async scheduled(_controller: { cron: string; scheduledTime: number }, env: MinimalEnv, ctx: MinimalCtx) {
    ctx.waitUntil(runDailyCron(env, ctx))
  },
}

export default simadjiWorker
