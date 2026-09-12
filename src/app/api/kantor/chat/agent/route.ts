// /api/kantor/chat/agent — jembatan agen AI sandbox ↔ antrian chat D1 (Task 57).
//
// Task 59 — MODE EKSEKUSI LANGSUNG: permintaan/perintah pengembangan yang masuk
// lewat chat D1 dikerjakan langsung oleh agen (tanpa menunggu GitHub issue),
// dengan tiap langkah di-broadcast via aksi 'progress' agar terlihat live di
// bubble chat user. Autentikasi: header `x-agent-key` == AGENT_API_KEY
// (constant-time compare, pola sama dengan AI Fix Bridge di /api/auth/login).
// TIDAK untuk browser user.
//
//   GET  ?limit=10            → pesan 'pending' ( + 'processing' basi >10 mnt )
//                               terlama dulu, lengkap konteks user + riwayat sesi.
//   POST { messageId, action:'claim' } → klaim atomik pending→processing
//                               (aman dari balapan antar sesi cron paralel).
//   POST { messageId, reply }  → simpan jawaban + tandai 'answered'.
//   POST { messageId, error }  → tandai 'error' + bubble penjelasan ke user.
//   POST { messageId, progress } → Task 59: baris timeline langkah kerja live
//                               (assistant status 'progress') — tampil real-time
//                               di bubble chat via polling; boleh dikirim
//                               berulang saat tugas dieksekusi bertahap.
//
// Task 61 — HEARTBEAT: setiap panggilan sah agen (GET/POST) mencatat denyut
//           terakhir di tabel AgentHeartbeat. /api/kantor/chat memakainya
//           membedakan agen AKTIF (live-watch, tanpa auto-reply AI) vs
//           TIMEOUT (notice "mencoba pulih").
//
// Protokol pemakaian oleh agen: docs/KANTOR-CHAT-AGENT.md
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { db } from '@/lib/db'
import { ensureKantorSchema } from '@/lib/kantor/bootstrap'

/** Bandingkan string constant-time (anti timing attack). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function resolveExpectedAgentKey(): string | undefined {
  try {
    const { env } = getCloudflareContext()
    const fromBinding = (env as { AGENT_API_KEY?: string } | undefined)?.AGENT_API_KEY
    if (fromBinding) return fromBinding
  } catch {
    // next dev biasa (di luar workerd) — lanjut ke process.env
  }
  return process.env.AGENT_API_KEY || undefined
}

function unauthorized() {
  return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 401 })
}

function authorized(req: NextRequest): boolean {
  const expected = resolveExpectedAgentKey()
  const provided = req.headers.get('x-agent-key') ?? ''
  return (
    typeof expected === 'string' &&
    expected.length >= 32 &&
    provided.length >= 32 &&
    safeEqual(provided, expected)
  )
}

const STALE_MS = 10 * 60_000 // klaim basi >10 menit dianggap hangus → boleh diambil lagi

// ---- Task 61: heartbeat agen (denyut ke D1) ----
// Tulis hanya bila denyut terakhir >15 detik — mode live-watch mem-polling
// tiap ±5 detik, hemat kuota tulis D1. Kegagalan tidak fatal (chat tetap jalan,
// hanya dianggap agen offline → notice "mencoba pulih" yang muncul).
const HEARTBEAT_AGENT = 'head-office'
const HEARTBEAT_THROTTLE_SEC = 15

async function touchHeartbeat(): Promise<void> {
  try {
    await db.$executeRawUnsafe(
      `INSERT INTO "AgentHeartbeat" ("id", "agentKey", "lastSeenAt")
       VALUES (lower(hex(randomblob(16))), ?, CURRENT_TIMESTAMP)
       ON CONFLICT("agentKey") DO UPDATE SET "lastSeenAt" = CURRENT_TIMESTAMP
       WHERE "AgentHeartbeat"."lastSeenAt" < datetime('now', ?)`,
      HEARTBEAT_AGENT,
      `-${HEARTBEAT_THROTTLE_SEC} seconds`,
    )
  } catch (e) {
    console.error('[agent-heartbeat]', e instanceof Error ? e.message : e)
  }
}

const postSchema = z.object({
  messageId: z.string().trim().min(1).max(64),
  action: z.enum(['claim']).optional(),
  reply: z.string().trim().min(1).max(4000).optional(),
  error: z.string().trim().min(1).max(600).optional(),
  progress: z.string().trim().min(1).max(600).optional(), // Task 59: langkah kerja live
})

// ============================== GET — ambil antrian ==============================
export async function GET(req: NextRequest) {
  if (!authorized(req)) return unauthorized()
  try {
    await ensureKantorSchema()

    await touchHeartbeat() // Task 61: denyut agen — dipolling = masih hidup

    const url = new URL(req.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? '10') || 10, 1), 20)
    const staleBefore = new Date(Date.now() - STALE_MS)

    const pending = await db.kantorChatMessage.findMany({
      where: {
        role: 'user',
        OR: [{ status: 'pending' }, { status: 'processing', claimedAt: { lt: staleBefore } }],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
    if (pending.length === 0) return NextResponse.json({ pending: [] })

    // Konteks per sesi: identitas user + ≤10 pesan terakhir sebagai riwayat.
    const sessionIds = [...new Set(pending.map((m) => m.sessionId))]
    const sessions = await db.kantorChatSession.findMany({
      where: { id: { in: sessionIds } },
    })
    const sessionMap = new Map(sessions.map((s) => [s.id, s]))

    const historyMap = new Map<string, { role: string; content: string; createdAt: Date }[]>()
    for (const sid of sessionIds) {
      const hist = await db.kantorChatMessage.findMany({
        where: { sessionId: sid },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { role: true, content: true, createdAt: true },
      })
      historyMap.set(sid, hist.reverse())
    }

    return NextResponse.json({
      pending: pending.map((m) => {
        const s = sessionMap.get(m.sessionId)
        return {
          id: m.id,
          sessionId: m.sessionId,
          content: m.content,
          status: m.status,
          claimedAt: m.claimedAt,
          createdAt: m.createdAt,
          user: s ? { name: s.userName, email: s.userEmail, role: s.userRole } : null,
          history: (historyMap.get(m.sessionId) ?? []).map((h) => ({ role: h.role, content: h.content })),
        }
      }),
    })
  } catch (e) {
    console.error('[kantor/chat/agent GET]', e)
    return NextResponse.json({ error: 'Gagal memuat antrian' }, { status: 500 })
  }
}

// ============================== POST — klaim / jawab / gagalkan ==============================
export async function POST(req: NextRequest) {
  if (!authorized(req)) return unauthorized()
  try {
    await ensureKantorSchema()

    const body = await req.json().catch(() => null)
    const parsed = postSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
        { status: 400 },
      )
    }
    const { messageId, action, reply, error, progress } = parsed.data
    await touchHeartbeat() // Task 61: aksi agen (claim/progress/reply/error) = tetap hidup

    // ---- CLAIM: atomik, hanya sukses bila masih 'pending' ATAU 'processing'
    // basi (>10 menit — pemegang klaim lama kemungkinan besar sudah mati).
    // Dahulu klaim hanya menerima 'pending' → pesan milik isolat cron yang
    // mati terjebak 'processing' selamanya (bug antrean macet).
    if (action === 'claim') {
      const staleBefore = new Date(Date.now() - STALE_MS)
      const r = await db.kantorChatMessage.updateMany({
        where: {
          id: messageId,
          role: 'user',
          OR: [{ status: 'pending' }, { status: 'processing', claimedAt: { lt: staleBefore } }],
        },
        data: { status: 'processing', claimedAt: new Date() },
      })
      if (r.count !== 1) {
        return NextResponse.json({ error: 'Sudah diklaim/diproses agen lain', claimed: false }, { status: 409 })
      }
      return NextResponse.json({ claimed: true })
    }

    const msg = await db.kantorChatMessage.findUnique({ where: { id: messageId } })
    if (!msg || msg.role !== 'user') {
      return NextResponse.json({ error: 'Pesan tidak ditemukan' }, { status: 404 })
    }

    // ---- PROGRESS (Task 59): baris timeline langkah kerja live ----
    // Boleh berulang selama tugas berjalan ('processing') maupun lanjutan tugas
    // yang sudah berakhir ('answered') — eksekusi multi-giliran cron.
    if (progress) {
      if (msg.status !== 'processing' && msg.status !== 'answered') {
        return NextResponse.json(
          { error: 'Klaim pesan dulu sebelum kirim progress', claimed: false },
          { status: 409 },
        )
      }
      const row = await db.kantorChatMessage.create({
        data: { sessionId: msg.sessionId, role: 'assistant', content: progress, status: 'progress' },
      })
      await db.kantorChatSession.update({
        where: { id: msg.sessionId },
        data: { lastActiveAt: new Date() },
      })
      return NextResponse.json({ ok: true, progressId: row.id })
    }

    // ---- REPLY: jawaban agen → bubble assistant + status answered ----
    // Task 59: pesan 'answered' boleh menerima reply lanjutan (laporan akhir
    // tugas multi-tahap) — bubble tambahan, status tetap 'answered'.
    if (reply) {
      if (msg.status !== 'processing' && msg.status !== 'answered') {
        return NextResponse.json({ error: 'Pesan belum diklaim / status tidak valid' }, { status: 409 })
      }
      const [assistantMsg] = await db.$transaction([
        db.kantorChatMessage.create({
          data: { sessionId: msg.sessionId, role: 'assistant', content: reply, status: 'done' },
        }),
        db.kantorChatMessage.update({
          where: { id: msg.id },
          data: { status: 'answered', answeredAt: new Date() },
        }),
        db.kantorChatSession.update({
          where: { id: msg.sessionId },
          data: { lastActiveAt: new Date() },
        }),
      ])
      return NextResponse.json({ ok: true, replyId: assistantMsg.id })
    }

    // ---- ERROR: agen tidak bisa menjawab → bubble penjelasan ----
    if (msg.status === 'answered') {
      return NextResponse.json({ error: 'Pesan sudah dijawab' }, { status: 409 })
    }
    if (error) {
      await db.$transaction([
        db.kantorChatMessage.create({
          data: {
            sessionId: msg.sessionId,
            role: 'assistant',
            content: `⚠️ ${error}`,
            status: 'done',
          },
        }),
        db.kantorChatMessage.update({
          where: { id: msg.id },
          data: { status: 'error', answeredAt: new Date() },
        }),
      ])
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Isi reply atau error' }, { status: 400 })
  } catch (e) {
    console.error('[kantor/chat/agent POST]', e)
    return NextResponse.json({ error: 'Gagal memproses' }, { status: 500 })
  }
}
