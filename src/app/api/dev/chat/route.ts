// Dev Console — asisten AI developer (obrolan dua arah dengan konteks sistem live).
// GET  /api/dev/chat → 60 pesan terakhir
// POST /api/dev/chat { message } → balasan AI (disimpan ke DevChat)
// Akses: DEVELOPER saja. Rate limit 20 pesan / 10 menit.

import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'
import { ensureDevSchema } from '@/lib/pentest/bootstrap'
import { rateLimit } from '@/lib/rate-limit'
import { devChatReply, aiErrorMessage } from '@/lib/pentest/analyze'

export async function GET(req: NextRequest) {
  const g = await guard(req, ['DEVELOPER'])
  if ('res' in g) return g.res
  await ensureDevSchema()
  const messages = await db.devChat.findMany({ orderBy: { createdAt: 'desc' }, take: 60 })
  return ok({ messages: messages.reverse() })
}

export async function POST(req: NextRequest) {
  const g = await guard(req, ['DEVELOPER'])
  if ('res' in g) return g.res

  if (!rateLimit(`dev-chat:${g.session.id}`, 20, 600_000)) {
    return bad('Terlalu banyak pesan. Tunggu sebentar lalu coba lagi.', 429)
  }

  const b = (await req.json().catch(() => ({}))) as { message?: string }
  const message = b.message?.trim()
  if (!message) return bad('Pesan tidak boleh kosong')
  if (message.length > 2000) return bad('Pesan maksimal 2000 karakter')

  // ===== Bangun konteks sistem live =====
  const lines: string[] = []
  try {
    const [users, students, teachers, openIssues, diagnosing] = await Promise.all([
      db.user.count().catch(() => -1),
      db.student.count().catch(() => -1),
      db.teacher.count().catch(() => -1),
      db.devIssue.count({ where: { status: 'OPEN' } }).catch(() => -1),
      db.devIssue.count({ where: { status: 'DIAGNOSING' } }).catch(() => -1),
    ])
    lines.push(`Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`)
    lines.push(`Database: ${users} pengguna, ${students} santri, ${teachers} guru (DB OK)`)
    lines.push(`Issue terbuka: ${openIssues}, sedang diagnosa: ${diagnosing}`)
    const latestIssues = await db.devIssue.findMany({
      where: { status: { in: ['OPEN', 'DIAGNOSING'] } },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: { type: true, endpoint: true, message: true, status: true },
    })
    if (latestIssues.length > 0) {
      lines.push('Issue terbaru: ' + latestIssues.map((x) => `[${x.type} ${x.endpoint ?? ''}: ${x.message.slice(0, 60)}]`).join(' '))
    }
    const lastScan = await db.pentestScan.findFirst({ orderBy: { startedAt: 'desc' } })
    if (lastScan) {
      lines.push(
        `Pentest terakhir: ${lastScan.startedAt.toISOString().slice(0, 16)} status=${lastScan.status} skor=${lastScan.score ?? '-'} CRIT=${lastScan.criticalCount} HIGH=${lastScan.highCount} MED=${lastScan.mediumCount} LOW=${lastScan.lowCount} INFO=${lastScan.infoCount}`,
      )
      if (lastScan.aiSummary) lines.push(`Ringkasan AI pentest: ${lastScan.aiSummary.slice(0, 300)}`)
    } else {
      lines.push('Belum pernah ada pemindaian pentest.')
    }
    const checks = await db.healthCheck.findMany({ orderBy: { checkedAt: 'desc' }, take: 12 })
    if (checks.length > 0) {
      const byEndpoint = new Map<string, { healthy: boolean; latencyMs: number | null }>()
      for (const c of checks) if (!byEndpoint.has(c.endpoint)) byEndpoint.set(c.endpoint, { healthy: c.healthy, latencyMs: c.latencyMs })
      lines.push(
        'Kesehatan endpoint terakhir: ' +
          [...byEndpoint.entries()].map(([p, v]) => `${p}=${v.healthy ? 'OK' : 'GAGAL'}${v.latencyMs ? `(${v.latencyMs}ms)` : ''}`).join(', '),
      )
    } else {
      lines.push('Belum ada riwayat pemeriksaan kesehatan endpoint.')
    }
  } catch {
    lines.push('Konteks live gagal diambil (database bermasalah?)')
  }

  // Riwayat obrolan
  const prev = await db.devChat.findMany({ orderBy: { createdAt: 'desc' }, take: 10 })
  const history = prev.reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  try {
    const reply = await devChatReply(message, history, lines.join('\n'))
    await db.devChat.create({ data: { role: 'user', content: message } })
    const saved = await db.devChat.create({ data: { role: 'assistant', content: reply } })
    // housekeeping: simpan maksimal 300 pesan
    const total = await db.devChat.count()
    if (total > 300) {
      const olds = await db.devChat.findMany({ orderBy: { createdAt: 'asc' }, take: total - 300, select: { id: true } })
      await db.devChat.deleteMany({ where: { id: { in: olds.map((x) => x.id) } } })
    }
    return ok({ message: saved })
  } catch (e) {
    console.error('[dev/chat]', e)
    return bad(aiErrorMessage(e), 502)
  }
}
