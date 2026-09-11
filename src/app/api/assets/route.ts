// GET /api/assets — manifest Kantor AI Agent (Task 51).
// Sumber data = tabel Asset (di-seed dari src/lib/kantor/data.ts oleh
// ensureKantorSchema). Scene 3D & panel membaca endpoint ini — komponen
// TIDAK mem-hardcode daftar aset. Termasuk jumlah feedback per divisi.
// Task 52: Kantor AI hanya untuk ADMIN & DEVELOPER (akses penuh) dan GURU
// (lihat saja) — tamu/orang tua mendapat 401.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ensureKantorSchema } from '@/lib/kantor/bootstrap'
import { guard } from '@/lib/session'

export async function GET(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'DEVELOPER', 'GURU'])
    if ('res' in g) return g.res
    await ensureKantorSchema()
    const [assets, grouped, latest] = await Promise.all([
      db.asset.findMany({ where: { kind: 'CHARACTER' }, orderBy: { assetKey: 'asc' } }),
      db.feedback.groupBy({ by: ['divisionId'], _count: { _all: true } }),
      db.asset.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ])

    const feedbackCounts: Record<string, number> = {}
    for (const g of grouped) feedbackCounts[g.divisionId] = g._count._all

    const characters = assets.map((a) => ({
      id: a.id,
      assetKey: a.assetKey,
      name: a.name,
      division: a.division,
      colorHex: a.colorHex,
      accentHex: a.accentHex,
      modelUrl: a.modelUrl, // null = procedural (dibangun dari primitif 3D)
      animations: safeArray(a.animations),
      role: a.role,
      tasks: safeArray(a.tasks),
      badge: a.badge,
      status: a.status,
      tasksDone: a.tasksDone,
      feedbackCount: feedbackCounts[a.division ?? ''] ?? 0,
    }))

    return NextResponse.json(
      {
        version: latest?.createdAt?.toISOString() ?? new Date().toISOString(),
        characters,
        office: { kind: 'PROCEDURAL', modelUrl: null },
        feedbackCounts,
      },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    )
  } catch (e) {
    console.error('[kantor/assets GET]', e)
    return NextResponse.json({ error: 'Gagal memuat manifest kantor' }, { status: 500 })
  }
}

function safeArray(json: string | null): string[] {
  try {
    const v = json ? (JSON.parse(json) as unknown) : []
    return Array.isArray(v) ? (v as string[]) : []
  } catch {
    return []
  }
}
