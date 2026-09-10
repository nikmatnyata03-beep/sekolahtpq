// AI FIX BRIDGE — pelapor error runtime dari browser pengguna.
//
// Saat panel admin gagal memuat JSON, error JS tak tertangani, atau endpoint
// balas 5xx — api-client.ts otomatis POST ke sini (tanpa klik apa pun) dan
// issue masuk daftar review developer (status OPEN), bukan antrean auto-fix.
//
// PUBLIK TAPI TERLINDUNGI: rate-limit ketat per IP (8/menit), payload
// disanitasi & dipotong, dedupe anti-spam (issue serupa aktif di-update,
// bukan diduplikasi). Selalu balas 200 agar tidak memicu loop pelaporan.
//
// POST { type: 'RUNTIME_JS'|'RUNTIME_PROMISE'|'RUNTIME_FETCH'|'RUNTIME_HTTP5XX',
//        message, endpoint?, detail?, page? }

import { NextRequest } from 'next/server'
import { db, ok } from '@/lib/api'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { ensureDevSchema } from '@/lib/pentest/bootstrap'

const TYPES: Record<string, { severity: string; label: string }> = {
  RUNTIME_JS: { severity: 'HIGH', label: 'Error JavaScript' },
  RUNTIME_PROMISE: { severity: 'MEDIUM', label: 'Promise Rejection' },
  RUNTIME_FETCH: { severity: 'HIGH', label: 'Respons Bukan JSON' },
  RUNTIME_HTTP5XX: { severity: 'HIGH', label: 'Server Error 5xx' },
}

const ACTIVE_STATUSES = ['OPEN', 'WAITING_AI', 'IN_PROGRESS', 'DIAGNOSING']

function clip(v: unknown, n: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.trim()
  return t ? t.slice(0, n) : undefined
}

export async function POST(req: NextRequest) {
  // anti-loop & anti-abuse: batas ketat per IP
  if (!rateLimit(`dev-errors:${clientIp(req)}`, 8, 60_000)) {
    return ok({ queued: false, throttled: true })
  }
  try {
    await ensureDevSchema()
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const type = TYPES[String(body.type)] ? String(body.type) : 'RUNTIME_JS'
    const message = clip(body.message, 300)
    if (!message) return ok({ queued: false })

    const endpoint = clip(body.endpoint, 200) ?? null
    const page = clip(body.page, 200)
    const detailRaw = clip(body.detail, 1200)
    const detail = [detailRaw, page ? `Halaman: ${page}` : null, `Waktu: ${new Date().toISOString()}`]
      .filter(Boolean)
      .join('\n')
      .slice(0, 1800)

    // dedupe: issue serupa yang masih aktif di-update (bukan diduplikasi)
    const existing = await db.devIssue.findFirst({
      where: { type, endpoint, status: { in: ACTIVE_STATUSES } },
      orderBy: { createdAt: 'desc' },
    })
    if (existing) {
      await db.devIssue.update({
        where: { id: existing.id },
        data: { detail: detail || existing.detail, message },
      })
      return ok({ queued: true, deduped: true })
    }

    await db.devIssue.create({
      data: {
        type,
        endpoint,
        message: `${TYPES[type].label}: ${message}`,
        detail: detail || null,
        status: 'OPEN',
        source: 'RUNTIME',
        severity: TYPES[type].severity,
      },
    })
    return ok({ queued: true })
  } catch (e) {
    // jangan pernah melempar error — pelapor tidak boleh ikut rusak
    console.error('[dev/errors]', e instanceof Error ? e.message.slice(0, 150) : e)
    return ok({ queued: false })
  }
}
