import { NextRequest } from 'next/server'
import { bad, getWaGateway, ok, saveWaGateway, type WaProvider } from '@/lib/api'
import { guard } from '@/lib/session'
// Konfigurasi gateway selalu fresco — jangan di-cache.
export const dynamic = 'force-dynamic'

/** Mask token agar tidak tampil penuh di klien (4 awal + 4 akhir). */
function maskToken(token: string): string {
  if (!token) return ''
  if (token.length <= 8) return '••••••••'
  return `${token.slice(0, 4)}••••••••${token.slice(-4)}`
}

/**
 * GET /api/whatsapp/gateway — ADMIN & DEVELOPER.
 * Status gateway: provider aktif + token ter-mask (token penuh tidak pernah
 * dikirim ke klien demi keamanan).
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'DEVELOPER'])
  if ('res' in g) return g.res
  const cfg = await getWaGateway()
  return ok({
    provider: cfg.provider,
    tokenMasked: maskToken(cfg.token),
    configured: Boolean(cfg.token),
  })
}

/**
 * PUT /api/whatsapp/gateway — ADMIN & DEVELOPER.
 * Body: { provider: 'OFF' | 'FONNTE', token?: string }.
 * token kosong '' → hapus token; undefined → pertahankan token lama.
 */
export async function PUT(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'DEVELOPER'])
  if ('res' in g) return g.res
  try {
    const b = (await req.json().catch(() => null)) as { provider?: string; token?: string } | null
    const provider = b?.provider
    if (provider !== 'OFF' && provider !== 'FONNTE') return bad('Provider harus OFF atau FONNTE')
    if (typeof b?.token === 'string' && b.token.trim() && b.token.trim().length < 8) {
      return bad('Token Fonnte tidak valid (terlalu pendek)')
    }
    await saveWaGateway({ provider: provider as WaProvider, token: b?.token })
    const cfg = await getWaGateway()
    return ok({
      provider: cfg.provider,
      tokenMasked: maskToken(cfg.token),
      configured: Boolean(cfg.token),
    })
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Gagal menyimpan konfigurasi gateway')
  }
}
