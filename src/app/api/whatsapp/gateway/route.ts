import { NextRequest } from 'next/server'
import { bad, getWaGateway, ok, saveWaGateway, type WaProvider } from '@/lib/api'
import { guard } from '@/lib/session'
// Konfigurasi gateway selalu fresco — jangan di-cache.
export const dynamic = 'force-dynamic'

/** Mask token/api key agar tidak tampil penuh di klien (4 awal + 4 akhir). */
function maskToken(token: string): string {
  if (!token) return ''
  if (token.length <= 8) return '••••••••'
  return `${token.slice(0, 4)}••••••••${token.slice(-4)}`
}

/**
 * GET /api/whatsapp/gateway — ADMIN & DEVELOPER.
 * Status gateway: provider aktif + token/api key ter-mask (nilai penuh tidak
 * pernah dikirim ke klien demi keamanan). baseUrl WAHA bukan rahasia → ditampilkan.
 */
export async function GET(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'DEVELOPER'])
  if ('res' in g) return g.res
  const cfg = await getWaGateway()
  return ok({
    provider: cfg.provider,
    tokenMasked: maskToken(cfg.token),
    configured: Boolean(cfg.token) || cfg.provider === 'CUSTOM',
    baseUrl: cfg.provider === 'CUSTOM' ? cfg.baseUrl : '',
    session: cfg.provider === 'CUSTOM' ? cfg.session : '',
  })
}

/**
 * PUT /api/whatsapp/gateway — ADMIN & DEVELOPER.
 * Body: { provider: 'OFF'|'FONNTE'|'CUSTOM', token?, baseUrl?, session? }.
 * FONNTE → token wajib; CUSTOM → baseUrl wajib (server WAHA), token = API key
 * WAHA (boleh kosong jika server tidak pakai X-Api-Key).
 */
export async function PUT(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'DEVELOPER'])
  if ('res' in g) return g.res
  try {
    const b = (await req.json().catch(() => null)) as
      | { provider?: string; token?: string; baseUrl?: string; session?: string }
      | null
    const provider = b?.provider
    if (provider !== 'OFF' && provider !== 'FONNTE' && provider !== 'CUSTOM') {
      return bad('Provider harus OFF, FONNTE, atau CUSTOM')
    }
    if (typeof b?.token === 'string' && b.token.trim() && b.token.trim().length < 4) {
      return bad(provider === 'CUSTOM' ? 'API key WAHA terlalu pendek' : 'Token Fonnte tidak valid (terlalu pendek)')
    }
    if (provider === 'FONNTE' && !(b?.token?.trim() ?? '') && !(await getWaGateway()).token) {
      return bad('Token Fonnte wajib diisi')
    }
    await saveWaGateway({
      provider: provider as WaProvider,
      token: b?.token,
      baseUrl: b?.baseUrl,
      session: b?.session,
    })
    const cfg = await getWaGateway()
    return ok({
      provider: cfg.provider,
      tokenMasked: maskToken(cfg.token),
      configured: Boolean(cfg.token) || cfg.provider === 'CUSTOM',
      baseUrl: cfg.provider === 'CUSTOM' ? cfg.baseUrl : '',
      session: cfg.provider === 'CUSTOM' ? cfg.session : '',
    })
  } catch (e) {
    return bad(e instanceof Error ? e.message : 'Gagal menyimpan konfigurasi gateway')
  }
}
