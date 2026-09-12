import { NextRequest, NextResponse } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { mergePortalSettings, SETTING_KEYS, type SettingKey } from '@/lib/portal-settings'
import { guard } from '@/lib/session'
// Konten CMS selalu fresco — jangan pernah di-cache oleh route handler.
export const dynamic = 'force-dynamic'

/** GET /api/settings — publik: konten landing page ter-merge di atas default. */
export async function GET() {
  try {
    const rows = await db.siteSetting.findMany()
    const raw: Record<string, unknown> = {}
    for (const row of rows) {
      try {
        raw[row.key] = JSON.parse(row.value)
      } catch {
        // lewati nilai rusak — fallback default
      }
    }
    return NextResponse.json(mergePortalSettings(raw), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return bad('Gagal memuat pengaturan', 500)
  }
}

/**
 * PUT /api/settings — ADMIN & DEVELOPER (Task 59-b): simpan bagian tertentu
 * { hero?, about?, contact?, faqs?, testimonials?, gallery?, sectionOrder? }.
 * sectionOrder (urutan layout) disimpan sebagai baris SiteSetting tersendiri
 * (key 'sectionOrder', value = array JSON) mengikuti pola per-key file ini.
 */
export async function PUT(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'DEVELOPER'])
    if ('res' in g) return g.res
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') return bad('Payload tidak valid')

    const hasOrder = body.sectionOrder !== undefined
    const provided = SETTING_KEYS.filter((k) => body[k] !== undefined)
    if (provided.length === 0 && !hasOrder) return bad('Tidak ada bagian yang diubah')

    const merged = mergePortalSettings(body)

    for (const key of provided as SettingKey[]) {
      const value = JSON.stringify(merged[key])
      await db.siteSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      })
    }

    // Task 59-b: urutan layout landing page (array kunci section ter-sanitasi).
    if (hasOrder) {
      const value = JSON.stringify(merged.sectionOrder)
      await db.siteSetting.upsert({
        where: { key: 'sectionOrder' },
        create: { key: 'sectionOrder', value },
        update: { value },
      })
    }

    return ok(merged)
  } catch {
    return bad('Gagal menyimpan pengaturan')
  }
}
