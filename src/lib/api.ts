import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export function ok(data: unknown) {
  return NextResponse.json(data)
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

// ===================== WHATSAPP GATEWAY (Fonnte) =====================
// Konfigurasi gateway disimpan di SiteSetting key 'whatsappGateway' (JSON).
// Provider OFF → perilaku lama (simulasi: pesan hanya dicatat di log).
// Provider FONNTE → pesan dikirim nyata via https://api.fonnte.com/send.

export type WaProvider = 'OFF' | 'FONNTE'

export interface WaGatewayConfig {
  provider: WaProvider
  token: string
}

const WA_GATEWAY_KEY = 'whatsappGateway'

/** Baca konfigurasi gateway dari DB — aman dipanggil dari route manapun. */
export async function getWaGateway(): Promise<WaGatewayConfig> {
  try {
    const row = await db.siteSetting.findUnique({ where: { key: WA_GATEWAY_KEY } })
    if (!row) return { provider: 'OFF', token: '' }
    const parsed = JSON.parse(row.value) as Partial<WaGatewayConfig>
    if (parsed.provider === 'FONNTE' && typeof parsed.token === 'string' && parsed.token.trim()) {
      return { provider: 'FONNTE', token: parsed.token.trim() }
    }
    return { provider: 'OFF', token: '' }
  } catch {
    return { provider: 'OFF', token: '' }
  }
}

/** Simpan konfigurasi gateway. token undefined → pertahankan token lama. */
export async function saveWaGateway(cfg: { provider: WaProvider; token?: string }) {
  const current = await getWaGateway()
  const token = cfg.token !== undefined ? cfg.token.trim() : current.token
  if (cfg.provider === 'FONNTE' && !token) throw new Error('Token Fonnte wajib diisi')
  const value = JSON.stringify({ provider: cfg.provider, token })
  await db.siteSetting.upsert({
    where: { key: WA_GATEWAY_KEY },
    create: { key: WA_GATEWAY_KEY, value },
    update: { value },
  })
}

/**
 * Normalisasi nomor Indonesia ke format internasional 62xxxxxxxxxx.
 * '0881-6917-774' → '628816917774'; '+62 812 …' → '62812…'; grup Fonnte
 * ('xxxx-xxxx@g.us') diteruskan apa adanya.
 */
export function normalizeWaPhone(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.includes('@g.us')) return trimmed
  let digits = trimmed.replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('0')) digits = '62' + digits.slice(1)
  else if (digits.startsWith('8')) digits = '62' + digits
  return digits.length >= 9 && digits.length <= 15 ? digits : null
}

/** Panggil API Fonnte. Respon gagal → { ok:false, reason }. */
async function fonnteRequest(
  path: 'send' | 'device',
  token: string,
  body?: { target: string; message: string },
): Promise<{ ok: boolean; reason?: string; data?: unknown }> {
  try {
    const res = await fetch(`https://api.fonnte.com/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(12_000),
    })
    const json = (await res.json().catch(() => null)) as
      | { status?: boolean; reason?: string; data?: unknown }
      | null
    if (res.ok && json?.status === true) return { ok: true, data: json.data }
    return { ok: false, reason: json?.reason ?? `HTTP ${res.status}` }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'Gagal menghubungi Fonnte' }
  }
}

/**
 * Kirim notifikasi WhatsApp.
 * - Gateway FONNTE aktif → kirim nyata; status log mengikuti hasil pengiriman.
 * - Gateway OFF → simulasi (log saja, status SENT) — perilaku lama.
 * Pesan selalu tercatat pada Notification (log WhatsApp admin).
 */
export async function sendWhatsApp(opts: { phone?: string | null; message: string; userId?: string | null }) {
  const raw = opts.phone?.trim()
  if (!raw) return
  const phone = normalizeWaPhone(raw) ?? raw
  const gateway = await getWaGateway()

  let status = 'SENT'
  if (gateway.provider === 'FONNTE') {
    const res = await fonnteRequest('send', gateway.token, { target: phone, message: opts.message })
    status = res.ok ? 'SENT' : 'FAILED'
    if (!res.ok) console.error(`[WA] Fonnte gagal ke ${phone}: ${res.reason}`)
  }

  try {
    await db.notification.create({
      data: {
        phone,
        message: opts.message,
        userId: opts.userId ?? undefined,
        channel: gateway.provider === 'FONNTE' ? 'WHATSAPP' : 'WHATSAPP_SIM',
        status,
      },
    })
    console.log(`[WHATSAPP:${gateway.provider}] ${status} -> ${phone}: ${opts.message.slice(0, 80)}...`)
  } catch (e) {
    console.error('sendWhatsApp failed', e)
  }
}

export function rupiah(n: number) {
  return 'Rp ' + new Intl.NumberFormat('id-ID').format(n)
}

export { db }
