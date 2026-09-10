// Entry Worker KUSTOM — SIMADJI di Cloudflare Workers.
//
// OpenNext menghasilkan .open-next/worker.js (handler Next.js). Entry ini
// membungkusnya agar Worker juga punya handler `scheduled` (Cron Triggers):
//
//   - fetch     → diteruskan utuh ke handler OpenNext (perilaku sama dgn sebelumnya)
//   - scheduled → dipanggil Cloudflare sesuai triggers.crons di wrangler.jsonc
//                 (harian 00:00 UTC = 07:00 WIB) dan memicu /api/cron/daily
//                 SECARA IN-PROCESS (bukan self-fetch — Workers memblokir
//                 fetch ke hostname sendiri dengan error 1042).
//
// Catatan CPU: logika cron sengaja dibuat ringan (2–3 query D1 + batch insert)
// agar aman di batas CPU tier gratis.

import worker from '../.open-next/worker.js'

interface MinimalCtx {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException?(): void
}

interface MinimalEnv {
  CRON_SECRET?: string
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
    return worker.fetch(request, env, ctx)
  },

  async scheduled(_controller: { cron: string; scheduledTime: number }, env: MinimalEnv, ctx: MinimalCtx) {
    ctx.waitUntil(runDailyCron(env, ctx))
  },
}

export default simadjiWorker
