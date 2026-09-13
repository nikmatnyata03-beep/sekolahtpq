import { NextRequest } from 'next/server'
import { db, getWaGateway, ok } from '@/lib/api'
import { guard } from '@/lib/session'
export const dynamic = 'force-dynamic'

/**
 * POST /api/whatsapp/device — ADMIN & DEVELOPER.
 * Tes koneksi gateway aktif:
 * - FONNTE: POST https://api.fonnte.com/device (header Authorization token).
 *   Respons sukses FLAT: { status:true, device:'62812…', device_status:'connect', name, package, quota }.
 * - CUSTOM (WAHA self-hosted): GET {baseUrl}/api/sessions (header X-Api-Key bila diisi)
 *   → ringkas status tiap sesi (WORKING / SCAN_QR_CODE / FAILED).
 * Hasil tes juga tercatat pada log notifikasi admin.
 *
 * CATATAN: folder ini tadinya bernama `test/` — aturan `.gitignore` "test"
 * membuat file itu diam-diam tak ter-commit (404 di produksi, bug WA-01).
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'DEVELOPER'])
  if ('res' in g) return g.res
  const cfg = await getWaGateway()

  if (cfg.provider === 'FONNTE') {
    if (!cfg.token) {
      return ok({ ok: false, reason: 'Gateway Fonnte belum diaktifkan — isi token lalu simpan.' })
    }
    return testFonnte(cfg.token)
  }
  if (cfg.provider === 'CUSTOM') {
    if (!cfg.baseUrl) {
      return ok({ ok: false, reason: 'Gateway WAHA belum diaktifkan — isi URL server lalu simpan.' })
    }
    return testWaha(cfg)
  }
  return ok({ ok: false, reason: 'Gateway masih OFF — pilih Fonnte atau WAHA lalu simpan.' })
}

async function testFonnte(token: string) {
  try {
    const res = await fetch('https://api.fonnte.com/device', {
      method: 'POST',
      headers: { Authorization: token },
      signal: AbortSignal.timeout(12_000),
    })
    const json = (await res.json().catch(() => null)) as
      | {
          status?: boolean
          reason?: string
          device?: string
          device_status?: string
          name?: string
          package?: string
          quota?: number
        }
      | null

    if (res.ok && json?.status === true) {
      const device = json.device ?? ''
      // Simpan jejak tes di log agar admin bisa melihat riwayat koneksi.
      await db.notification
        .create({
          data: {
            phone: device || '—',
            message: `Tes koneksi Fonnte berhasil${device ? ` — perangkat ${device}` : ''}.`,
            channel: 'WHATSAPP',
            status: 'SENT',
          },
        })
        .catch(() => null)
      return ok({
        ok: true,
        device,
        deviceStatus: json.device_status ?? '',
        name: json.name ?? '',
        quota: json.quota ?? null,
      })
    }
    return ok({
      ok: false,
      reason: json?.reason ?? `Fonnte merespons HTTP ${res.status} — periksa kembali token.`,
    })
  } catch (e) {
    return ok({
      ok: false,
      reason: e instanceof Error ? e.message : 'Gagal menghubungi api.fonnte.com',
    })
  }
}

interface WahaSession {
  name?: string
  status?: string
}

async function testWaha(cfg: { baseUrl: string; token: string; session: string }) {
  try {
    const res = await fetch(`${cfg.baseUrl}/api/sessions`, {
      method: 'GET',
      headers: cfg.token ? { 'X-Api-Key': cfg.token } : {},
      signal: AbortSignal.timeout(12_000),
    })
    if (res.status === 401 || res.status === 403) {
      return ok({ ok: false, reason: 'API key WAHA salah/berbeda — periksa kolom API key.' })
    }
    if (!res.ok) {
      return ok({ ok: false, reason: `Server WAHA merespons HTTP ${res.status} — periksa URL server.` })
    }
    const json = (await res.json().catch(() => null)) as WahaSession[] | null
    if (!Array.isArray(json)) {
      return ok({ ok: false, reason: 'Respons server bukan API WAHA yang diharapkan — periksa URL.' })
    }
    const working = json.find((s) => s.status === 'WORKING')
    const target = json.find((s) => s.name === cfg.session) ?? working
    // Simpan jejak tes di log agar admin bisa melihat riwayat koneksi.
    await db.notification
      .create({
        data: {
          phone: '—',
          message: `Tes koneksi WAHA berhasil — server ${cfg.baseUrl}, sesi ${target?.name ?? cfg.session} (${target?.status ?? 'kosong'}).`,
          channel: 'WHATSAPP',
          status: 'SENT',
        },
      })
      .catch(() => null)
    return ok({
      ok: true,
      device: cfg.baseUrl.replace(/^https?:\/\//, ''),
      deviceStatus: target?.status ?? 'TIDAK_ADA_SESI',
      name: target?.name ?? cfg.session,
      quota: null,
    })
  } catch (e) {
    return ok({
      ok: false,
      reason: `Gagal menghubungi server WAHA${e instanceof Error ? ` (${e.message})` : ''} — pastikan server, Docker, dan tunnel menyala.`,
    })
  }
}
