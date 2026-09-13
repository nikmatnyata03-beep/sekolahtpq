import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export function ok(data: unknown) {
  return NextResponse.json(data)
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

// ===================== WHATSAPP GATEWAY =====================
// Konfigurasi gateway disimpan di SiteSetting key 'whatsappGateway' (JSON).
// Provider OFF    → perilaku lama (simulasi: pesan hanya dicatat di log).
// Provider FONNTE → pesan dikirim nyata via https://api.fonnte.com/send.
// Provider CUSTOM → WAHA self-hosted (open source, tanpa watermark) di
//                   server sekolah (PC/laptop Ubuntu). API: POST {baseUrl}/api/sendText.

export type WaProvider = 'OFF' | 'FONNTE' | 'CUSTOM'

export interface WaGatewayConfig {
  provider: WaProvider
  token: string
  /** Hanya untuk CUSTOM (WAHA): base URL publik server, mis. https://wa.sekolah.or.id */
  baseUrl: string
  /** Hanya untuk CUSTOM (WAHA): nama sesi WAHA, default 'default'. */
  session: string
}

const WA_GATEWAY_KEY = 'whatsappGateway'

/** Baca konfigurasi gateway dari DB — aman dipanggil dari route manapun. */
export async function getWaGateway(): Promise<WaGatewayConfig> {
  const off: WaGatewayConfig = { provider: 'OFF', token: '', baseUrl: '', session: '' }
  try {
    const row = await db.siteSetting.findUnique({ where: { key: WA_GATEWAY_KEY } })
    if (!row) return off
    const parsed = JSON.parse(row.value) as Partial<WaGatewayConfig>
    if (parsed.provider === 'FONNTE' && typeof parsed.token === 'string' && parsed.token.trim()) {
      return { ...off, provider: 'FONNTE', token: parsed.token.trim() }
    }
    if (parsed.provider === 'CUSTOM' && typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim()) {
      return {
        ...off,
        provider: 'CUSTOM',
        token: typeof parsed.token === 'string' ? parsed.token.trim() : '',
        baseUrl: parsed.baseUrl.trim().replace(/\/+$/, ''),
        session: typeof parsed.session === 'string' && parsed.session.trim() ? parsed.session.trim() : 'default',
      }
    }
    return off
  } catch {
    return off
  }
}

/**
 * Simpan konfigurasi gateway. token undefined → pertahankan token lama.
 * CUSTOM: baseUrl wajib (http/https); session kosong → 'default'.
 */
export async function saveWaGateway(cfg: {
  provider: WaProvider
  token?: string
  baseUrl?: string
  session?: string
}) {
  const current = await getWaGateway()
  const token = cfg.token !== undefined ? cfg.token.trim() : current.token
  if (cfg.provider === 'FONNTE' && !token) throw new Error('Token Fonnte wajib diisi')
  let baseUrl = ''
  let session = ''
  if (cfg.provider === 'CUSTOM') {
    baseUrl = (cfg.baseUrl !== undefined ? cfg.baseUrl : current.baseUrl).trim().replace(/\/+$/, '')
    session = (cfg.session !== undefined ? cfg.session.trim() : current.session || 'default') || 'default'
    if (!/^https?:\/\/.+/i.test(baseUrl)) throw new Error('URL server WAHA wajib diisi (mulai http:// atau https://)')
  }
  const value = JSON.stringify({ provider: cfg.provider, token, baseUrl, session })
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
 * Panggil API WAHA (self-hosted). chatId: nomor → '62xxx@c.us', grup '@g.us' → apa adanya.
 * WAHA (core, gratis & open source): POST {baseUrl}/api/sendText, header X-Api-Key opsional.
 */
async function wahaRequest(
  cfg: { baseUrl: string; token: string; session: string },
  chatId: string,
  text: string,
): Promise<{ ok: boolean; reason?: string; data?: unknown }> {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/sendText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.token ? { 'X-Api-Key': cfg.token } : {}),
      },
      body: JSON.stringify({ session: cfg.session || 'default', chatId, text }),
      signal: AbortSignal.timeout(15_000),
    })
    const json = (await res.json().catch(() => null)) as { id?: string; error?: string; message?: string } | null
    if (res.ok && (res.status === 200 || res.status === 201)) return { ok: true, data: json }
    const reason = json?.error ?? json?.message ?? `HTTP ${res.status}`
    // Pesan 404 khas WAHA saat sesi belum di-scan.
    if (res.status === 404) return { ok: false, reason: 'Sesi WAHA tidak ditemukan — buka dashboard WAHA lalu scan QR dulu.' }
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'API key WAHA salah/berbeda — periksa X-Api-Key.' }
    return { ok: false, reason }
  } catch (e) {
    return {
      ok: false,
      reason: `Gagal menghubungi server WAHA${e instanceof Error ? ` (${e.message})` : ''} — pastikan server, Docker, dan tunnel menyala.`,
    }
  }
}

/**
 * Kirim notifikasi WhatsApp.
 * - Gateway FONNTE/CUSTOM aktif → kirim nyata; status log mengikuti hasil pengiriman.
 * - Gateway OFF → simulasi (log saja, status SENT) — perilaku lama.
 * Pesan selalu tercatat pada Notification (log WhatsApp admin).
 */
export async function sendWhatsApp(opts: { phone?: string | null; message: string; userId?: string | null }) {
  const raw = opts.phone?.trim()
  if (!raw) return
  const phone = normalizeWaPhone(raw) ?? raw
  const gateway = await getWaGateway()

  let status = 'SENT'
  let channel = 'WHATSAPP_SIM'
  if (gateway.provider === 'FONNTE') {
    const res = await fonnteRequest('send', gateway.token, { target: phone, message: opts.message })
    status = res.ok ? 'SENT' : 'FAILED'
    channel = 'WHATSAPP'
    if (!res.ok) console.error(`[WA] Fonnte gagal ke ${phone}: ${res.reason}`)
  } else if (gateway.provider === 'CUSTOM') {
    const chatId = phone.includes('@g.us') ? phone : `${phone}@c.us`
    const res = await wahaRequest(gateway, chatId, opts.message)
    status = res.ok ? 'SENT' : 'FAILED'
    channel = 'WHATSAPP'
    if (!res.ok) console.error(`[WA] WAHA gagal ke ${phone}: ${res.reason}`)
  }

  try {
    await db.notification.create({
      data: {
        phone,
        message: opts.message,
        userId: opts.userId ?? undefined,
        channel,
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
