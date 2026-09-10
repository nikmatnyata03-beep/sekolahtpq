// Dev Console — daftar issue & aksi perbaikan.
// GET  /api/dev/issues → 50 issue terakhir + ringkasan
// POST /api/dev/issues → { action: 'autofix' | 'ignore', id }
//   autofix: perbaikan data runtime (mis. SiteSetting JSON rusak) + verifikasi
//   ulang endpoint; issue butuh perubahan kode diberi instruksi jelas.
// Akses: DEVELOPER saja.

import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'
import { ensureDevSchema } from '@/lib/pentest/bootstrap'

export async function GET(req: NextRequest) {
  const g = await guard(req, ['DEVELOPER'])
  if ('res' in g) return g.res
  await ensureDevSchema()
  const [issues, open, diagnosing, fixed] = await Promise.all([
    db.devIssue.findMany({ orderBy: { createdAt: 'desc' }, take: 50 }),
    db.devIssue.count({ where: { status: 'OPEN' } }),
    db.devIssue.count({ where: { status: 'DIAGNOSING' } }),
    db.devIssue.count({ where: { status: 'FIXED' } }),
  ])
  return ok({ issues, counts: { open, diagnosing, fixed } })
}

async function verifyEndpointNow(origin: string, path: string, kind: 'JSON' | 'HTML'): Promise<{ healthy: boolean; detail: string }> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 10_000)
    const res = await fetch(origin + path, { signal: ctrl.signal })
    clearTimeout(timer)
    const full = await res.text()
    const body = full.slice(0, 2000)
    if (res.status === 401 || res.status === 403) {
      return { healthy: true, detail: `HTTP ${res.status} · terlindungi sesi (normal)` }
    }
    if (res.status >= 200 && res.status < 400) {
      if (kind === 'HTML') return { healthy: true, detail: `HTTP ${res.status}` }
      try {
        JSON.parse(full) // parse body penuh
        return { healthy: true, detail: `HTTP ${res.status} · JSON valid` }
      } catch {
        return { healthy: false, detail: `HTTP ${res.status} · respons bukan JSON: ${body.slice(0, 100)}` }
      }
    }
    return { healthy: false, detail: `HTTP ${res.status} · ${body.slice(0, 100)}` }
  } catch (e) {
    return { healthy: false, detail: e instanceof Error ? e.message : 'fetch gagal' }
  }
}

export async function POST(req: NextRequest) {
  try {
    const g = await guard(req, ['DEVELOPER'])
    if ('res' in g) return g.res
    const b = (await req.json().catch(() => ({}))) as { action?: string; id?: string }
    if (!b.action || !b.id) return bad('action dan id wajib diisi')

    const issue = await db.devIssue.findUnique({ where: { id: b.id } })
    if (!issue) return bad('Issue tidak ditemukan', 404)

    if (b.action === 'ignore') {
      const updated = await db.devIssue.update({ where: { id: issue.id }, data: { status: 'IGNORED' } })
      return ok({ issue: updated, result: 'Issue diabaikan.' })
    }

    if (b.action !== 'autofix') return bad('Aksi tidak dikenal')

    const origin = new URL(req.url).origin
    const fixLog: string[] = []

    // ===== AUTO-FIX #1: SiteSetting JSON rusak → hapus baris rusak (default merge kembali) =====
    if (issue.endpoint === '/api/settings' || issue.type === 'JSON_PARSE') {
      try {
        const rows = await db.siteSetting.findMany()
        let repaired = 0
        for (const row of rows) {
          try {
            JSON.parse(row.value)
          } catch {
            await db.siteSetting.delete({ where: { key: row.key } })
            repaired++
            fixLog.push(`Baris SiteSetting "${row.key}" rusak → dihapus; nilai default akan di-merge otomatis`)
          }
        }
        if (repaired > 0) {
          fixLog.push(`Total ${repaired} baris SiteSetting diperbaiki`)
        }
      } catch (e) {
        fixLog.push(`Pembersihan SiteSetting gagal: ${e instanceof Error ? e.message : 'err'}`)
      }
    }

    // ===== AUTO-FIX #2: pengumuman kosong → buat pengumuman sambutan default =====
    try {
      const annCount = await db.announcement.count()
      if (annCount === 0) {
        await db.announcement.create({
          data: {
            title: 'Ahlan wa Sahlan',
            content: 'Sistem SIMADJI TPQ Darul Jinan aktif kembali. Pendaftaran PPDB dibuka setiap hari kerja.',
            priority: 'NORMAL',
          },
        })
        fixLog.push('Tabel pengumuman kosong → dibuat pengumuman sambutan default')
      }
    } catch {
      /* non-fatal */
    }

    // ===== Verifikasi ulang endpoint =====
    let verify = { healthy: false, detail: 'tidak diverifikasi' }
    if (issue.endpoint) {
      const kind = issue.endpoint.endsWith('.json') || issue.endpoint.startsWith('/api/') ? 'JSON' : 'HTML'
      verify = await verifyEndpointNow(origin, issue.endpoint, kind)
      fixLog.push(`Verifikasi ulang ${issue.endpoint}: ${verify.detail}`)
    }

    const dbHealthy = await (async () => {
      try {
        await db.user.count()
        return true
      } catch {
        return false
      }
    })()

    const stillBroken = issue.endpoint ? !verify.healthy : !dbHealthy

    const updated = await db.devIssue.update({
      where: { id: issue.id },
      data: {
        status: stillBroken ? (issue.status === 'DIAGNOSING' ? 'DIAGNOSING' : 'OPEN') : 'FIXED',
        fixedAt: stillBroken ? null : new Date(),
        aiFix: [
          ...(issue.aiFix ? [issue.aiFix] : []),
          `[AUTO-FIX ${new Date().toISOString()}]`,
          ...fixLog,
          stillBroken
            ? 'Masih bermasalah setelah auto-fix data → kemungkinan besar butuh perbaikan KODE (commit GitHub oleh agen developer).'
            : 'Sehat kembali.',
        ].join('\n'),
      },
    })

    return ok({
      issue: updated,
      result: stillBroken
        ? 'Auto-fix data dijalankan tetapi endpoint masih bermasalah — kemungkinan butuh perbaikan kode oleh agen (GitHub auto-deploy).'
        : `Berhasil: ${fixLog.length} aksi perbaikan dijalankan dan verifikasi ulang sehat.`,
      fixLog,
    })
  } catch (e) {
    console.error('[dev/issues]', e)
    return bad('Gagal memproses aksi issue', 500)
  }
}
