import { NextRequest, NextResponse } from 'next/server'
import { ok, bad } from '@/lib/api'
import { publishDraft } from '@/lib/portal-store'
import { guard } from '@/lib/session'
// Publish harus selalu membaca draf terbaru — tanpa cache.
export const dynamic = 'force-dynamic'

/**
 * POST /api/settings/publish — ADMIN & DEVELOPER (Task 62):
 * publikasikan draf landing page → tulis konten live, simpan snapshot ke
 * riwayat versi (maks 8), catat cap waktu publish.
 */
export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'DEVELOPER'])
    if ('res' in g) return g.res
    const published = await publishDraft()
    if (!published) return bad('Belum ada draf untuk dipublikasikan', 400)
    return ok({ published })
  } catch {
    return bad('Gagal mempublikasikan draf', 500)
  }
}
