// Lapisan penyimpanan Draf / Publish / Versi Landing Page (Task 62).
//
// Sengaja memakai tabel SiteSetting yang SUDAH ADA (kunci 'landingDraft',
// 'landingVersions', 'landingPublishedAt') sehingga berjalan di Prisma/SQLite
// sandbox maupun D1 produksi TANPA migrasi skema. Konten live portal publik
// tetap dibaca dari kunci per-section (hero/about/…) — tidak ada perubahan
// perilaku untuk pengunjung sampai tombol Publish ditekan.

import { db } from '@/lib/db'
import { mergePortalSettings, type PortalSettings } from '@/lib/portal-settings'

const DRAFT_KEY = 'landingDraft'
const VERSIONS_KEY = 'landingVersions'
const PUBLISHED_AT_KEY = 'landingPublishedAt'

export const MAX_VERSIONS = 8

export interface LandingVersion {
  /** ISO timestamp saat snapshot dipublikasikan. */
  at: string
  settings: PortalSettings
}

async function readKeyObject(key: string): Promise<Record<string, unknown> | null> {
  const row = await db.siteSetting.findUnique({ where: { key } })
  if (!row) return null
  try {
    const parsed = JSON.parse(row.value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** Muat draf ter-merge di atas default (published bila draf belum pernah disimpan). */
export async function loadDraft(): Promise<PortalSettings> {
  const raw = await readKeyObject(DRAFT_KEY)
  return mergePortalSettings(raw)
}

/** Muat riwayat versi publish (terbaru di depan, maksimal MAX_VERSIONS). */
export async function loadVersions(): Promise<LandingVersion[]> {
  const row = await db.siteSetting.findUnique({ where: { key: VERSIONS_KEY } })
  if (!row) return []
  try {
    const parsed = JSON.parse(row.value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (v): v is LandingVersion =>
          !!v &&
          typeof v === 'object' &&
          typeof (v as LandingVersion).at === 'string' &&
          !!(v as LandingVersion).settings &&
          typeof (v as LandingVersion).settings === 'object',
      )
      .slice(0, MAX_VERSIONS)
  } catch {
    return []
  }
}

/** Baca seluruh baris SiteSetting jadi objek mentah (nilai rusak dilewati). */
export async function loadRawSettings(): Promise<Record<string, unknown>> {
  const rows = await db.siteSetting.findMany()
  const raw: Record<string, unknown> = {}
  for (const row of rows) {
    try {
      raw[row.key] = JSON.parse(row.value)
    } catch {
      // lewati nilai rusak — fallback default
    }
  }
  return raw
}

/** Cap waktu publish terakhir (ISO) atau null bila belum pernah publish. */
export async function loadPublishedAt(): Promise<string | null> {
  const row = await db.siteSetting.findUnique({ where: { key: PUBLISHED_AT_KEY } })
  return row && row.value ? row.value : null
}

/**
 * Muat bundle editor: draf (fallback = konten live bila draf belum/bukan lagi
 * ada), konten live, riwayat versi, dan cap waktu publish.
 */
export async function loadDraftBundle(): Promise<{
  draft: PortalSettings
  published: PortalSettings
  versions: LandingVersion[]
  publishedAt: string | null
}> {
  const [rawDraft, versions, publishedAt] = await Promise.all([
    readKeyObject(DRAFT_KEY),
    loadVersions(),
    loadPublishedAt(),
  ])
  const published = mergePortalSettings(await loadRawSettings())
  const draft = rawDraft ? mergePortalSettings(rawDraft) : published
  return { draft, published, versions, publishedAt }
}

/** Simpan draf penuh (sudah ter-merge). Konten live tidak tersentuh. */
export async function saveDraft(merged: PortalSettings): Promise<PortalSettings> {
  const value = JSON.stringify(merged)
  await db.siteSetting.upsert({
    where: { key: DRAFT_KEY },
    create: { key: DRAFT_KEY, value },
    update: { value },
  })
  return merged
}

/** Buang draf — editor kembali menampilkan konten live sebagai basis edit. */
export async function discardDraft(): Promise<void> {
  await db.siteSetting.deleteMany({ where: { key: DRAFT_KEY } })
}

/**
 * Publikasikan draf: tulis semua section ke kunci konten live, simpan
 * snapshot ke riwayat versi (terbaru di depan, batas MAX_VERSIONS), lalu
 * catat cap waktu publish. Mengembalikan konten yang terbit.
 */
export async function publishDraft(): Promise<PortalSettings | null> {
  const raw = await readKeyObject(DRAFT_KEY)
  if (!raw) return null
  const merged = mergePortalSettings(raw)

  const entries: [string, unknown][] = [
    ['hero', merged.hero],
    ['about', merged.about],
    ['contact', merged.contact],
    ['faqs', merged.faqs],
    ['testimonials', merged.testimonials],
    ['gallery', merged.gallery],
    ['sectionOrder', merged.sectionOrder],
    ['theme', merged.theme],
  ]
  for (const [key, val] of entries) {
    const value = JSON.stringify(val)
    await db.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
  }

  const versions = await loadVersions()
  versions.unshift({ at: new Date().toISOString(), settings: merged })
  const versionsValue = JSON.stringify(versions.slice(0, MAX_VERSIONS))
  await db.siteSetting.upsert({
    where: { key: VERSIONS_KEY },
    create: { key: VERSIONS_KEY, value: versionsValue },
    update: { value: versionsValue },
  })

  const at = new Date().toISOString()
  await db.siteSetting.upsert({
    where: { key: PUBLISHED_AT_KEY },
    create: { key: PUBLISHED_AT_KEY, value: at },
    update: { value: at },
  })

  return merged
}
