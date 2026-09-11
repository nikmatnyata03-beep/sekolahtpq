// POST /api/feedback — kritik & saran dari web 3D Kantor AI Agent (Task 51).
// Validasi zod + rate-limit per-IP (maks 5/menit, window geser in-memory).
// GET (admin) — ringkasan untuk panel Head Office: jumlah per divisi + 10 terbaru.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { ensureKantorSchema } from '@/lib/kantor/bootstrap'
import { guard } from '@/lib/session'

const DIVISIONS = ['GENERAL_PURPOSE', 'EXPLORE', 'PLAN', 'FRONTEND', 'FULLSTACK', 'PPT', 'HEAD'] as const

const feedbackSchema = z.object({
  divisionId: z.enum(DIVISIONS),
  name: z.string().trim().max(60).optional().nullable(),
  message: z.string().trim().min(5, 'Minimal 5 karakter').max(500, 'Maksimal 500 karakter'),
})

// ---- Rate limit sederhana (window geser in-memory per isolate) ----
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (arr.length >= MAX_PER_WINDOW) {
    hits.set(ip, arr)
    return true
  }
  arr.push(now)
  hits.set(ip, arr)
  // bersihkan IP lama agar map tidak membengkak
  if (hits.size > 500) {
    for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k)
  }
  return false
}

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'lokal'
  )
}

export async function POST(req: NextRequest) {
  try {
    await ensureKantorSchema()
    const ip = clientIp(req)
    if (rateLimited(ip)) {
      return NextResponse.json({ error: 'Terlalu sering — coba lagi semenit lagi.' }, { status: 429 })
    }
    const body = await req.json().catch(() => null)
    const parsed = feedbackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Data tidak valid' },
        { status: 400 },
      )
    }
    const { divisionId, name, message } = parsed.data
    const saved = await db.feedback.create({
      data: { divisionId, name: name || null, message, ip },
    })
    return NextResponse.json(
      { ok: true, id: saved.id, result: 'Terima kasih! Masukanmu sudah diterima kantor.' },
      { status: 201 },
    )
  } catch (e) {
    console.error('[kantor/feedback POST]', e)
    return NextResponse.json({ error: 'Gagal menyimpan masukan' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const g = await guard(req, ['ADMIN'])
  if ('res' in g) return g.res
  try {
    await ensureKantorSchema()
    const [grouped, latest] = await Promise.all([
      db.feedback.groupBy({ by: ['divisionId'], _count: { _all: true } }),
      db.feedback.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    ])
    const counts: Record<string, number> = {}
    for (const row of grouped) counts[row.divisionId] = row._count._all
    return NextResponse.json({ counts, total: Object.values(counts).reduce((a, b) => a + b, 0), latest })
  } catch (e) {
    console.error('[kantor/feedback GET]', e)
    return NextResponse.json({ error: 'Gagal memuat masukan' }, { status: 500 })
  }
}
