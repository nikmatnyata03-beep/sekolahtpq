import { NextRequest } from 'next/server'
import { db, getWaGateway, ok } from '@/lib/api'
import { guard } from '@/lib/session'
export const dynamic = 'force-dynamic'

/**
 * POST /api/whatsapp/device — ADMIN & DEVELOPER.
 * Tes koneksi ke Fonnte: POST https://api.fonnte.com/device dengan header
 * Authorization token. Respons sukses berbentuk FLAT:
 * { status:true, device:'62812…', device_status:'connect', name, package, quota }.
 * Hasil tes juga tercatat pada log notifikasi admin.
 *
 * CATATAN: folder ini tadinya bernama `test/` — aturan `.gitignore` "test"
 * membuat file itu diam-diam tak ter-commit (404 di produksi, bug WA-01).
 */
export async function POST(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'DEVELOPER'])
  if ('res' in g) return g.res
  const cfg = await getWaGateway()
  if (cfg.provider !== 'FONNTE' || !cfg.token) {
    return ok({ ok: false, reason: 'Gateway Fonnte belum diaktifkan — isi token lalu simpan.' })
  }

  try {
    const res = await fetch('https://api.fonnte.com/device', {
      method: 'POST',
      headers: { Authorization: cfg.token },
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
