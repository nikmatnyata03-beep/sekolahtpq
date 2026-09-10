// Dev Console — diagnosa issue oleh AI (LLM).
// POST /api/dev/diagnose { issueId }
// → kumpulkan ulang bukti terbaru (probe endpoint), kirim ke LLM,
//   simpan diagnosa + langkah perbaikan.
// Akses: DEVELOPER saja. Rate limit 10 diagnosa / 10 menit.

import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'
import { ensureDevSchema } from '@/lib/pentest/bootstrap'
import { hasInternalHandler, internalFetch } from '@/lib/pentest/dispatch'
import { rateLimit } from '@/lib/rate-limit'
import { diagnoseIssueWithAi, aiErrorMessage } from '@/lib/pentest/analyze'

export async function POST(req: NextRequest) {
  const g = await guard(req, ['DEVELOPER'])
  if ('res' in g) return g.res
  await ensureDevSchema()

  if (!rateLimit(`dev-diagnose:${g.session.id}`, 10, 600_000)) {
    return bad('Terlalu banyak permintaan diagnosa. Coba lagi dalam beberapa menit.', 429)
  }

  const b = (await req.json().catch(() => ({}))) as { issueId?: string }
  if (!b.issueId) return bad('issueId wajib diisi')

  const issue = await db.devIssue.findUnique({ where: { id: b.issueId } })
  if (!issue) return bad('Issue tidak ditemukan', 404)

  // Kumpulkan bukti terbaru: probe ulang endpoint saat ini (dispatch internal)
  let freshEvidence = ''
  if (issue.endpoint) {
    try {
      let status = 0
      let body = ''
      if (hasInternalHandler('GET', issue.endpoint)) {
        const cv = req.cookies.get('simadji_session')?.value
        const r = await internalFetch('GET', issue.endpoint, { cookie: cv ? `simadji_session=${cv}` : undefined })
        status = r.status
        body = r.text.slice(0, 1200)
      } else {
        const origin = new URL(req.url).origin
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 10_000)
        const res = await fetch(origin + issue.endpoint, { signal: ctrl.signal })
        clearTimeout(timer)
        status = res.status
        body = (await res.text()).slice(0, 1200)
      }
      freshEvidence = `Probe ulang ${issue.endpoint} (saat diagnosa): HTTP ${status}\nAwal respons: ${body.replace(/\s+/g, ' ').slice(0, 600)}`
    } catch (e) {
      freshEvidence = `Probe ulang ${issue.endpoint} gagal: ${e instanceof Error ? e.message : 'err'}`
    }
  }

  // Bukti tambahan: riwayat health check endpoint ini
  const history = issue.endpoint
    ? await db.healthCheck.findMany({
        where: { endpoint: issue.endpoint },
        orderBy: { checkedAt: 'desc' },
        take: 5,
        select: { healthy: true, status: true, latencyMs: true, detail: true, checkedAt: true },
      })
    : []

  try {
    const result = await diagnoseIssueWithAi({
      type: issue.type,
      endpoint: issue.endpoint,
      message: issue.message,
      detail: [issue.detail, freshEvidence, history.length ? 'Riwayat: ' + JSON.stringify(history) : ''].filter(Boolean).join('\n\n'),
    })
    const updated = await db.devIssue.update({
      where: { id: issue.id },
      data: {
        status: issue.status === 'OPEN' ? 'DIAGNOSING' : issue.status,
        aiDiagnosis: result.text,
      },
    })
    return ok({ issue: updated, diagnosis: result.text, canAutoFix: result.canAutoFix })
  } catch (e) {
    console.error('[dev/diagnose]', e)
    return bad(aiErrorMessage(e), 502)
  }
}
