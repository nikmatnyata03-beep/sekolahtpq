import { NextRequest, NextResponse } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { mergePortalSettings, SETTING_KEYS, type SettingKey } from '@/lib/portal-settings'
import { discardDraft, loadDraftBundle, loadRawSettings, saveDraft } from '@/lib/portal-store'
import { guard } from '@/lib/session'
// Konten CMS selalu fresco — jangan pernah di-cache oleh route handler.
export const dynamic = 'force-dynamic'

/**
 * GET /api/settings
 *  - tanpa parameter (PUBLIK): konten landing page live ter-merge di atas default.
 *  - ?draft=1 (ADMIN & DEVELOPER): bundle editor
 *    { draft, published, versions, publishedAt }.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    if (url.searchParams.get('draft') === '1') {
      const g = await guard(req, ['ADMIN', 'DEVELOPER'])
      if ('res' in g) return g.res
      const bundle = await loadDraftBundle()
      return NextResponse.json(bundle, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const merged = mergePortalSettings(await loadRawSettings())
    return NextResponse.json(merged, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch {
    return bad('Gagal memuat pengaturan', 500)
  }
}

/**
 * PUT /api/settings — ADMIN & DEVELOPER.
 * Dua mode (Task 62):
 *  - body.draft === true → simpan SELURUH body sebagai DRAF (kunci
 *    'landingDraft'); konten live portal publik tidak tersentuh.
 *  - tanpa flag draf → perilaku lama: simpan bagian tertentu langsung ke
 *    konten live (kompatibel pemanggil lama).
 */
export async function PUT(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'DEVELOPER'])
    if ('res' in g) return g.res
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') return bad('Payload tidak valid')

    // ===== Mode draf (Task 62) =====
    if (body.draft === true) {
      const merged = mergePortalSettings(body)
      const saved = await saveDraft(merged)
      return ok(saved)
    }

    // ===== Mode live (kompatibilitas perilaku lama) =====
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

/**
 * DELETE /api/settings?draft=1 — ADMIN & DEVELOPER: buang draf sehingga
 * editor kembali menampilkan konten live sebagai basis edit.
 */
export async function DELETE(req: NextRequest) {
  try {
    const g = await guard(req, ['ADMIN', 'DEVELOPER'])
    if ('res' in g) return g.res
    const url = new URL(req.url)
    if (url.searchParams.get('draft') === '1') {
      await discardDraft()
      return ok({ discarded: true })
    }
    return bad('Mode penghapusan tidak dikenal')
  } catch {
    return bad('Gagal membuang draf', 500)
  }
}
