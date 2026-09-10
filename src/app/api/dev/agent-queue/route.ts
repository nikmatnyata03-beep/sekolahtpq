// AI FIX BRIDGE — antrean perbaikan oleh agen AI eksternal (Z.ai Code).
//
// Inilah jawaban atas "bagaimana temuan di halaman dev langsung trigger AI":
//   1. Temuan pentest / issue kesehatan berstatus WAITING_AI; laporan runtime
//      anonim harus ditinjau dan dienqueue secara eksplisit oleh developer.
//   2. Agen AI (cron 5 menit) login sebagai DEVELOPER → GET antrean ini.
//   3. claim → perbaiki kode di sandbox → push GitHub (auto-deploy Cloudflare).
//   4. resolve dengan catatan perbaikan + hash commit → halaman dev menampilkan
//      "Diperbaiki oleh AI" lengkap dengan commit-nya.
//
// GET  → item antrean (WAITING_AI + IN_PROGRESS) + ringkasan + 10 resolusi terakhir
// POST → { action: 'enqueue' | 'claim' | 'resolve' | 'reject', ... }
//   enqueue { findingId? } atau { type, message, endpoint?, detail?, severity?, source? }
//   claim   { id, agent? }              → IN_PROGRESS + claimedAt/claimedBy
//   resolve { id, notes, commitHash? }  → FIXED (temuan pentest terkait ikut FIXED)
//   reject  { id, reason }              → kembali OPEN + alasan di aiDiagnosis
// Akses: DEVELOPER & ADMIN.

import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'
import { ensureDevSchema } from '@/lib/pentest/bootstrap'

const ACTIVE_STATUSES = ['OPEN', 'WAITING_AI', 'IN_PROGRESS', 'DIAGNOSING']
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']

function clip(v: unknown, n: number): string | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined
  return v.trim().slice(0, n)
}

export async function GET(req: NextRequest) {
  const g = await guard(req, ['DEVELOPER', 'ADMIN'])
  if ('res' in g) return g.res
  await ensureDevSchema()
  try {
    const [items, recentFixed, waiting, inProgress] = await Promise.all([
      db.devIssue.findMany({
        where: { status: { in: ['WAITING_AI', 'IN_PROGRESS'] } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.devIssue.findMany({
        where: { status: 'FIXED', claimedBy: { not: null } },
        orderBy: { fixedAt: 'desc' },
        take: 10,
      }),
      db.devIssue.count({ where: { status: 'WAITING_AI' } }),
      db.devIssue.count({ where: { status: 'IN_PROGRESS' } }),
    ])
    // urutkan berdasar keparahan lalu waktu
    const rank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 }
    items.sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9) || +new Date(b.createdAt) - +new Date(a.createdAt))
    return ok({ items, recentFixed, counts: { waiting, inProgress } })
  } catch (e) {
    console.error('[dev/agent-queue GET]', e)
    return bad('Gagal memuat antrean AI', 500)
  }
}

export async function POST(req: NextRequest) {
  const g = await guard(req, ['DEVELOPER', 'ADMIN'])
  if ('res' in g) return g.res
  await ensureDevSchema()
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = String(body.action ?? '')

    // ============ ENQUEUE: kirim temuan/issue ke antrean AI ============
    if (action === 'enqueue') {
      const findingId = typeof body.findingId === 'string' ? body.findingId : undefined
      if (findingId) {
        const finding = await db.pentestFinding.findUnique({ where: { id: findingId } })
        if (!finding) return bad('Temuan tidak ditemukan', 404)
        if (finding.linkedIssueId) {
          const linked = await db.devIssue.findUnique({ where: { id: finding.linkedIssueId } })
          if (linked && ACTIVE_STATUSES.includes(linked.status)) {
            return ok({ issue: linked, alreadyQueued: true, result: 'Temuan ini sudah ada di antrean AI.' })
          }
        }
        const detail = JSON.stringify({
          findingId: finding.id,
          module: finding.module,
          severity: finding.severity,
          confidence: finding.confidence,
          cwe: finding.cwe,
          description: finding.description,
          evidence: finding.evidence,
          poc: finding.poc,
          remediation: finding.remediation,
        }).slice(0, 1900)
        const issue = await db.devIssue.create({
          data: {
            type: finding.severity === 'CRITICAL' ? 'PENTEST_CRITICAL' : 'PENTEST_HIGH',
            endpoint: clip(finding.target, 200) ?? '/',
            message: `[PENTEST] ${clip(finding.title, 200) ?? finding.title}`.slice(0, 300),
            detail,
            status: 'WAITING_AI',
            source: 'PENTEST',
            severity: finding.severity,
          },
        })
        await db.pentestFinding.update({ where: { id: finding.id }, data: { status: 'WAITING_AI', linkedIssueId: issue.id } })
        return ok({ issue, result: 'Temuan dikirim ke AI Developer — akan diambil agen perbaikan otomatis (≤ 5 menit).' })
      }

      // enqueue manual / runtime
      const message = clip(body.message, 300)
      if (!message) return bad('message wajib diisi')
      const endpoint = clip(body.endpoint, 200) ?? null
      const severity = SEVERITIES.includes(String(body.severity)) ? String(body.severity) : 'MEDIUM'
      const source = ['RUNTIME', 'MANUAL', 'HEALTH', 'PENTEST'].includes(String(body.source)) ? String(body.source) : 'MANUAL'
      const type = clip(body.type, 40) ?? 'MANUAL'
      const dup = await db.devIssue.findFirst({
        where: { type, endpoint, message, status: { in: ACTIVE_STATUSES } },
      })
      if (dup) return ok({ issue: dup, alreadyQueued: true, result: 'Issue serupa sudah ada di antrean.' })
      const issue = await db.devIssue.create({
        data: {
          type,
          endpoint,
          message,
          detail: clip(body.detail, 1900) ?? null,
          status: 'WAITING_AI',
          source,
          severity,
        },
      })
      return ok({ issue, result: 'Masuk antrean AI Developer — agen perbaikan akan mengambilnya otomatis (≤ 5 menit).' })
    }

    // ============ CLAIM: agen AI mengambil item ============
    if (action === 'claim') {
      const id = String(body.id ?? '')
      const agent = clip(body.agent, 100) ?? 'zai-code-agent'
      const issue = await db.devIssue.findUnique({ where: { id } })
      if (!issue) return bad('Item antrean tidak ditemukan', 404)
      if (!['WAITING_AI', 'OPEN'].includes(issue.status)) return bad(`Item tidak bisa diambil (status ${issue.status})`)
      const updated = await db.devIssue.update({
        where: { id },
        data: { status: 'IN_PROGRESS', claimedAt: new Date(), claimedBy: agent },
      })
      return ok({ issue: updated, result: 'Item diklaim oleh agen AI.' })
    }

    // ============ RESOLVE: agen AI menyelesaikan perbaikan ============
    if (action === 'resolve') {
      const id = String(body.id ?? '')
      const notes = clip(body.notes, 1900) ?? 'Diperbaiki oleh agen AI.'
      const commitHash = clip(body.commitHash, 40) ?? null
      const issue = await db.devIssue.findUnique({ where: { id } })
      if (!issue) return bad('Item antrean tidak ditemukan', 404)
      const updated = await db.devIssue.update({
        where: { id },
        data: {
          status: 'FIXED',
          fixedAt: new Date(),
          commitHash,
          claimedBy: issue.claimedBy ?? 'zai-code-agent',
          claimedAt: issue.claimedAt ?? new Date(),
          aiFix: [issue.aiFix, `[AI-FIX ${new Date().toISOString()}]`, notes, commitHash ? `Commit: ${commitHash} (auto-deploy Cloudflare)` : null]
            .filter(Boolean)
            .join('\n'),
        },
      })
      // temuan pentest terkait ikut ditandai FIXED
      let findingFixed = false
      try {
        const parsed = JSON.parse(issue.detail ?? '{}') as { findingId?: string }
        if (parsed.findingId) {
          await db.pentestFinding.updateMany({ where: { id: parsed.findingId }, data: { status: 'FIXED' } })
          findingFixed = true
        }
      } catch {
        /* detail bukan JSON — bukan temuan pentest */
      }
      return ok({ issue: updated, findingFixed, result: 'Perbaikan dicatat — halaman dev akan menampilkan status Diperbaiki.' })
    }

    // ============ REJECT: agen AI tidak bisa memperbaiki otomatis ============
    if (action === 'reject') {
      const id = String(body.id ?? '')
      const reason = clip(body.reason, 900) ?? 'Tidak dapat diperbaiki otomatis — butuh keputusan pengguna.'
      const issue = await db.devIssue.findUnique({ where: { id } })
      if (!issue) return bad('Item antrean tidak ditemukan', 404)
      const updated = await db.devIssue.update({
        where: { id },
        data: {
          status: 'OPEN',
          aiDiagnosis: [issue.aiDiagnosis, `[AGENT ${new Date().toISOString()}] ${reason}`].filter(Boolean).join('\n'),
        },
      })
      // temuan pentest terkait kembali ACKNOWLEDGED (menunggu keputusan user)
      try {
        const parsed = JSON.parse(issue.detail ?? '{}') as { findingId?: string }
        if (parsed.findingId) {
          await db.pentestFinding.updateMany({ where: { id: parsed.findingId }, data: { status: 'ACKNOWLEDGED' } })
        }
      } catch {
        /* bukan temuan pentest */
      }
      return ok({ issue: updated, result: 'Agen tidak memproses otomatis — alasan dicatat pada diagnosa.' })
    }

    return bad('Aksi tidak dikenal')
  } catch (e) {
    console.error('[dev/agent-queue POST]', e)
    return bad('Gagal memproses aksi antrean', 500)
  }
}
