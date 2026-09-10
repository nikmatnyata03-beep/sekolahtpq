// Cron Harian SIMADJI — dipanggil oleh scheduled handler Worker (07:00 WIB).
//
//   GET|POST /api/cron/daily   header: x-cron-secret: <CRON_SECRET>
//
// Tugas:
//   1. Auto-tutup sesi absensi aktif yang tanggalnya sudah lewat (jaring
//      pengaman bila guru lupa menutup sesi).
//   2. Pengingat tagihan ke wali via log WhatsApp:
//        - PENDING berumur >= 3 hari  → "masih menunggu pembayaran"
//        - FAILED  berumur >= 1 hari  → "silakan coba bayar kembali"
//      Dedupe: 1 pengingat per invoice per 3 hari (anti spam).
//
// Aman CPU 10ms tier gratis: query terbatas + cap 50 pengingat per eksekusi.

import { NextRequest } from 'next/server'
import { db, ok, bad, sendWhatsApp, rupiah } from '@/lib/api'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

const DAY_MS = 86_400_000

function resolveExpectedSecret(): string | undefined {
  try {
    const { env } = getCloudflareContext()
    const fromEnv = (env as { CRON_SECRET?: string } | undefined)?.CRON_SECRET
    if (fromEnv) return fromEnv
  } catch {
    // next dev biasa (di luar workerd) — lanjut ke process.env
  }
  return process.env.CRON_SECRET || undefined
}

async function handle(req: NextRequest) {
  const expected = resolveExpectedSecret()
  const provided = req.headers.get('x-cron-secret')
  if (!expected || !provided || provided !== expected) {
    return bad('Tidak diizinkan', 401)
  }

  const startedAt = Date.now()
  const now = new Date()
  const startOfTodayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

  // ===== 1. Auto-tutup sesi absensi stale =====
  const closed = await db.session.updateMany({
    where: { isActive: true, date: { lt: startOfTodayUtc } },
    data: { isActive: false },
  })

  // ===== 2. Pengingat tagihan =====
  const pendingBefore = new Date(Date.now() - 3 * DAY_MS)
  const failedBefore = new Date(Date.now() - 1 * DAY_MS)
  const dedupeSince = new Date(Date.now() - 3 * DAY_MS)

  const payments = await db.payment.findMany({
    where: {
      OR: [
        { status: 'PENDING', createdAt: { lte: pendingBefore } },
        { status: 'FAILED', createdAt: { lte: failedBefore } },
      ],
    },
    include: { student: { include: { parent: true } } },
    orderBy: { createdAt: 'asc' },
    take: 80,
  })

  let remindersSent = 0
  let skipped = 0
  const MAX_REMINDERS = 50

  for (const p of payments) {
    if (remindersSent >= MAX_REMINDERS) {
      skipped++
      continue
    }
    const parent = p.student?.parent
    if (!parent?.phone) {
      skipped++
      continue
    }
    // Dedupe: invoice yang sama sudah diingatkan dalam 3 hari terakhir?
    const existing = await db.notification.findFirst({
      where: {
        userId: parent.id,
        message: { contains: p.invoiceNo },
        createdAt: { gte: dedupeSince },
      },
      select: { id: true },
    })
    if (existing) {
      skipped++
      continue
    }
    const statusLine =
      p.status === 'FAILED'
        ? 'pembayaran sebelumnya *GAGAL* — silakan coba bayar kembali'
        : 'masih *menunggu pembayaran*'
    await sendWhatsApp({
      phone: parent.phone,
      userId: parent.id,
      message:
        `*Pengingat Tagihan*\n\n` +
        `Assalamu'alaikum Bapak/Ibu ${parent.name},\n\n` +
        `Tagihan *${p.title}* untuk santri *${p.student.fullName}* (${p.invoiceNo}) ${statusLine}.\n` +
        `Jumlah: *${rupiah(p.amount)}*\n\n` +
        `Silakan buka Portal Wali pada aplikasi SIMADJI untuk melakukan pembayaran.\n` +
        `Jazakumullahu khairan.\n\n— TPQ Darul Jinan`,
    })
    remindersSent++
  }

  return ok({
    ok: true,
    job: 'daily',
    closedSessions: closed.count,
    reminderCandidates: payments.length,
    remindersSent,
    skipped,
    durationMs: Date.now() - startedAt,
  })
}

export async function GET(req: NextRequest) {
  return handle(req)
}

export async function POST(req: NextRequest) {
  return handle(req)
}
