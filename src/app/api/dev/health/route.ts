// Dev Console — monitor kesehatan sistem.
// GET /api/dev/health → jalankan pemeriksaan menyeluruh: database + seluruh
// endpoint API (validitas JSON termasuk!) → simpan riwayat + buat DevIssue.
// Inilah detektor "web gagal load json pada panel admin".
// Akses: DEVELOPER saja.

import { NextRequest } from 'next/server'
import { db, ok } from '@/lib/api'
import { guard } from '@/lib/session'
import { ensureDevSchema } from '@/lib/pentest/bootstrap'

interface EndpointResult {
  path: string
  status: number
  latencyMs: number
  healthy: boolean
  kind: 'JSON' | 'HTML'
  detail: string
}

const JSON_ENDPOINTS = ['/api/stats', '/api/settings', '/api/announcements', '/api/posts', '/api/teachers', '/api/classes', '/api/curriculum', '/api/notifications']
const HTML_ENDPOINTS = ['/']

export async function GET(req: NextRequest) {
  const g = await guard(req, ['DEVELOPER'])
  if ('res' in g) return g.res
  await ensureDevSchema()

  const origin = new URL(req.url).origin
  const results: EndpointResult[] = []

  // 1. Database
  let dbHealthy = true
  let dbDetail = 'ok'
  let dbLatency = 0
  const dbStart = Date.now()
  try {
    const [users, students] = await Promise.all([db.user.count(), db.student.count()])
    dbLatency = Date.now() - dbStart
    dbDetail = `${users} pengguna, ${students} santri`
  } catch (e) {
    dbHealthy = false
    dbLatency = Date.now() - dbStart
    dbDetail = e instanceof Error ? e.message.slice(0, 300) : 'database error'
    await raiseIssue('DB_ERROR', null, 'Database tidak dapat diakses', dbDetail)
  }

  // 2. Endpoint checks (paralel, timeout 10s)
  const targets = [
    ...JSON_ENDPOINTS.map((p) => ({ path: p, kind: 'JSON' as const })),
    ...HTML_ENDPOINTS.map((p) => ({ path: p, kind: 'HTML' as const })),
  ]
  await Promise.all(
    targets.map(async ({ path, kind }) => {
      const started = Date.now()
      let status = 0
      let full = ''
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 10_000)
        const res = await fetch(origin + path, { signal: ctrl.signal, headers: { 'User-Agent': 'SIMADJI-DevConsole/1.0' } })
        clearTimeout(timer)
        status = res.status
        full = await res.text()
      } catch (e) {
        full = e instanceof Error ? e.message : 'fetch gagal'
      }
      const body = full.slice(0, 2000)
      const latencyMs = Date.now() - started

      let healthy = (status >= 200 && status < 400) || status === 401 || status === 403 // 401/403 = endpoint terlindungi sesi (normal)
      let detail = `HTTP ${status}`
      if (status === 401 || status === 403) {
        detail = `HTTP ${status} · terlindungi sesi (normal)`
      } else if (healthy && kind === 'JSON') {
        try {
          JSON.parse(full) // parse body PENUH — bukan versi terpotong
          detail = `HTTP ${status} · JSON valid`
        } catch {
          healthy = false
          detail = `HTTP ${status} tetapi respons BUKAN JSON valid — panel admin akan gagal memuat. Awal: ${body.slice(0, 120).replace(/\s+/g, ' ')}`
        }
      } else if (!healthy) {
        detail = `HTTP ${status} · ${body.slice(0, 120).replace(/\s+/g, ' ')}`
      }

      results.push({ path, status, latencyMs, healthy, kind, detail })
      await db.healthCheck.create({
        data: { endpoint: path, healthy, status, latencyMs, detail: detail.slice(0, 500) },
      })

      if (!healthy) {
        await raiseIssue(
          kind === 'JSON' ? 'JSON_PARSE' : 'ENDPOINT_FAIL',
          path,
          `Endpoint ${path} tidak sehat (${detail.slice(0, 80)})`,
          detail,
        )
      } else {
        // endpoint pulih → tutup issue terbuka untuk endpoint ini
        const open = await db.devIssue.findFirst({ where: { endpoint: path, status: { in: ['OPEN', 'DIAGNOSING'] } } })
        if (open) {
          await db.devIssue.update({
            where: { id: open.id },
            data: { status: 'FIXED', fixedAt: new Date(), aiFix: (open.aiFix ?? '') + '\n[Auto] Endpoint pulih saat pemeriksaan ' + new Date().toISOString() },
          })
        }
      }
    }),
  )

  // 3. Rapikan riwayat: simpan maksimal 300 baris terbaru
  try {
    const total = await db.healthCheck.count()
    if (total > 300) {
      const olds = await db.healthCheck.findMany({ orderBy: { checkedAt: 'asc' }, take: total - 300, select: { id: true } })
      await db.healthCheck.deleteMany({ where: { id: { in: olds.map((x) => x.id) } } })
    }
  } catch {
    /* housekeeping gagal tidak fatal */
  }

  results.sort((a, b) => a.path.localeCompare(b.path))
  const healthyCount = results.filter((r) => r.healthy).length
  return ok({
    db: { healthy: dbHealthy, latencyMs: dbLatency, detail: dbDetail },
    endpoints: results,
    summary: {
      total: results.length,
      healthy: healthyCount,
      unhealthy: results.length - healthyCount,
      checkedAt: new Date().toISOString(),
      origin,
    },
  })
}

/** Buat DevIssue bila belum ada issue OPEN untuk endpoint/type yang sama (dedupe). */
async function raiseIssue(type: string, endpoint: string | null, message: string, detail: string) {
  try {
    const existing = await db.devIssue.findFirst({
      where: { type, endpoint, status: { in: ['OPEN', 'DIAGNOSING'] } },
    })
    if (existing) {
      await db.devIssue.update({
        where: { id: existing.id },
        data: { detail: detail.slice(0, 2000), message },
      })
      return
    }
    await db.devIssue.create({
      data: { type, endpoint, message, detail: detail.slice(0, 2000) },
    })
  } catch (e) {
    console.error('[dev/health] raiseIssue gagal', e)
  }
}
