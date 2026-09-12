// /api/kantor/chat — antrian pesan Head Office (Task 57, arsitektur baru).
//
// Task 52: akses ADMIN & DEVELOPER. Task 55: balasan GLM sinkron.
// Task 57: chat kini ASINKRON & tersimpan di D1 —
// Task 58: akses diperluas ke GURU — chat muncul sebagai bubble di dashboard
// (guru/admin/developer) selain panel Head Office di /kantor.
//   POST  → pesan user disimpan berstatus 'pending' (TANPA memanggil AI).
//           Balasan disusun agen AI di sandbox (cron 5 menit) lewat
//           /api/kantor/chat/agent — protokol: docs/KANTOR-CHAT-AGENT.md.
//   GET   → sesi terakhir milik user (+ ?sessionId= utk sesi tertentu) dan
//           seluruh pesannya; klien mem-polling endpoint ini saat ada pending.
//
// Privasi: satu sesi = satu user. Sesi/pesan user lain tidak bisa diakses.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { guard } from '@/lib/session'
import { db } from '@/lib/db'
import { ensureKantorSchema } from '@/lib/kantor/bootstrap'

const chatSchema = z.object({
  message: z.string().trim().min(1, 'Pesan kosong').max(1000, 'Pesan maksimal 1000 karakter'),
  sessionId: z.string().trim().min(1).max(64).optional(),
})

/** Sesi terakhir milik user (atau null bila belum pernah chat). */
async function latestSession(userId: string) {
  return db.kantorChatSession.findFirst({
    where: { userId },
    orderBy: { lastActiveAt: 'desc' },
  })
}

// ---- Rate limit per user (window geser in-memory): 10 pesan/menit ----
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 10
const hits = new Map<string, number[]>()

function rateLimited(key: string): boolean {
  const now = Date.now()
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  if (arr.length >= MAX_PER_WINDOW) {
    hits.set(key, arr)
    return true
  }
  arr.push(now)
  hits.set(key, arr)
  if (hits.size > 500) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k)
  }
  return false
}

export async function POST(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'DEVELOPER', 'GURU'])
  if ('res' in g) return g.res
  const session = g.session

  try {
    await ensureKantorSchema()

    if (rateLimited(`${session.id}:${req.headers.get('cf-connecting-ip') ?? 'lokal'}`)) {
      return NextResponse.json({ error: 'Terlalu sering — semenit lagi ya.' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const parsed = chatSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
        { status: 400 },
      )
    }
    const { message, sessionId } = parsed.data

    // Resolusi sesi: pakai sessionId milik sendiri, atau buat sesi baru.
    let kantorSession = null as Awaited<ReturnType<typeof latestSession>> | null
    if (sessionId) {
      kantorSession = await db.kantorChatSession.findUnique({ where: { id: sessionId } })
      // 404 (bukan 403) agar keberadaan sesi orang lain tidak terbocor.
      if (!kantorSession || kantorSession.userId !== session.id) {
        return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
      }
    }
    if (!kantorSession) {
      // Snapshot identitas user (email dari tabel User) — sesi per user terpisah.
      const u = await db.user.findUnique({ where: { id: session.id }, select: { email: true } })
      kantorSession = await db.kantorChatSession.create({
        data: {
          userId: session.id,
          userRole: session.role,
          userName: session.name,
          userEmail: u?.email ?? 'tanpa-email',
        },
      })
    }

    const msg = await db.kantorChatMessage.create({
      data: {
        sessionId: kantorSession.id,
        role: 'user',
        content: message,
        status: 'pending',
      },
    })
    await db.kantorChatSession.update({
      where: { id: kantorSession.id },
      data: { lastActiveAt: new Date(), userRole: session.role, userName: session.name },
    })

    return NextResponse.json({
      sessionId: kantorSession.id,
      messageId: msg.id,
      pending: true,
      waitHint: 'Sedang di proses sistem, silahkan tunggu…',
    })
  } catch (e) {
    console.error('[kantor/chat POST]', e)
    return NextResponse.json({ error: 'Gagal menyimpan pesan' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'DEVELOPER', 'GURU'])
  if ('res' in g) return g.res
  const session = g.session

  try {
    await ensureKantorSchema()

    const url = new URL(req.url)
    const wanted = url.searchParams.get('sessionId')

    let kantorSession = null as Awaited<ReturnType<typeof latestSession>> | null
    if (wanted) {
      kantorSession = await db.kantorChatSession.findUnique({ where: { id: wanted } })
      if (!kantorSession || kantorSession.userId !== session.id) {
        return NextResponse.json({ error: 'Sesi tidak ditemukan' }, { status: 404 })
      }
    } else {
      kantorSession = await latestSession(session.id)
    }

    if (!kantorSession) {
      return NextResponse.json({ session: null, messages: [] })
    }

    const messages = await db.kantorChatMessage.findMany({
      where: { sessionId: kantorSession.id },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: { id: true, role: true, content: true, status: true, createdAt: true },
    })

    return NextResponse.json({
      session: { id: kantorSession.id, createdAt: kantorSession.createdAt, lastActiveAt: kantorSession.lastActiveAt },
      messages,
    })
  } catch (e) {
    console.error('[kantor/chat GET]', e)
    return NextResponse.json({ error: 'Gagal memuat obrolan' }, { status: 500 })
  }
}
