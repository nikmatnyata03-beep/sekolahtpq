// ==== Shared hafalan helpers (Task 13-a) ====
// Diekstrak dari src/components/parent/hafalan-chart.tsx (round 10/12) agar
// modul guru/admin (hafalan-admin, guru-overview) memakai logika target yang
// PERSIS sama dengan strip target di Portal Wali. Semua helper murni —
// tanpa React, tanpa fetch, aman untuk render/hydration.

// ==== Juz 30 coverage map — Al-Fatihah + 37 surah pendek Juz 30 ====
// Juz 30 = surah 78 (An-Naba) hingga 114 (An-Nas), total 37 surah.
// Names use Indonesian transliteration; matching normalizes away
// apostrophes/hyphens so "An-Naba'" and "An-Naba" both resolve.
export const JUZ30_SURAHS: ReadonlyArray<{ no: number; name: string }> = [
  { no: 1, name: 'Al-Fatihah' },
  { no: 78, name: 'An-Naba' },
  { no: 79, name: 'An-Naziat' },
  { no: 80, name: 'Abasa' },
  { no: 81, name: 'At-Takwir' },
  { no: 82, name: 'Al-Infitar' },
  { no: 83, name: 'Al-Mutaffifin' },
  { no: 84, name: 'Al-Insyiqaq' },
  { no: 85, name: 'Al-Buruj' },
  { no: 86, name: 'At-Tariq' },
  { no: 87, name: "Al-A'la" },
  { no: 88, name: 'Al-Ghasyiyah' },
  { no: 89, name: 'Al-Fajr' },
  { no: 90, name: 'Al-Balad' },
  { no: 91, name: 'Asy-Syams' },
  { no: 92, name: 'Al-Lail' },
  { no: 93, name: 'Ad-Duha' },
  { no: 94, name: 'Al-Insyirah' },
  { no: 95, name: 'At-Tin' },
  { no: 96, name: "Al-'Alaq" },
  { no: 97, name: 'Al-Qadr' },
  { no: 98, name: 'Al-Bayyinah' },
  { no: 99, name: 'Az-Zalzalah' },
  { no: 100, name: "Al-'Adiyat" },
  { no: 101, name: "Al-Qari'ah" },
  { no: 102, name: 'At-Takatsur' },
  { no: 103, name: "Al-'Asr" },
  { no: 104, name: 'Al-Humazah' },
  { no: 105, name: 'Al-Fil' },
  { no: 106, name: 'Quraisy' },
  { no: 107, name: "Al-Ma'un" },
  { no: 108, name: 'Al-Kautsar' },
  { no: 109, name: 'Al-Kafirun' },
  { no: 110, name: 'An-Nasr' },
  { no: 111, name: 'Al-Masad' },
  { no: 112, name: 'Al-Ikhlas' },
  { no: 113, name: 'Al-Falaq' },
  { no: 114, name: 'An-Nas' },
]

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

// Varian ejaan surah yang dipakai modul lain (datalist hafalan / Select target)
// namun dinormalisasi berbeda dari nama kanonik JUZ30_SURAHS di atas.
export const NORM_ALIASES: ReadonlyMap<string, string> = new Map([
  ['alkausar', 'alkautsar'], // "Al-Kausar" (pilihan target) -> Al-Kautsar
  ['allahab', 'almasad'], // "Al-Lahab" -> Al-Masad
  ['aththariq', 'attariq'], // "Ath-Thariq" (datalist) -> At-Tariq
])

export const resolveNorm = (s: string) => {
  const key = norm(s)
  return NORM_ALIASES.get(key) ?? key
}

export const JUZ30_NORM: ReadonlyMap<string, { no: number; name: string }> = new Map(
  JUZ30_SURAHS.map((s) => [norm(s.name), s]),
)

export interface TargetProgress {
  /** Target valid di dalam peta Juz 30 (selalu true pada hasil non-null). */
  valid: boolean
  /** Posisi 1-based surah target dalam urutan peta Juz 30. */
  position: number
  /** Jumlah surah berbeda (posisi ≤ target) yang sudah disetorkan minimal 1x. */
  reached: number
  /** round(reached / position * 100). */
  percent: number
  /** Surah target itu sendiri sudah pernah disetorkan. */
  targetReached: boolean
  /** Nama kanonik target sesuai peta Juz 30. */
  targetName: string
}

/**
 * Progres setoran santri menuju target hafalan Juz 30.
 * - null bila target kosong ATAU tidak ada dalam peta Juz 30 (strip sengaja disembunyikan).
 * - Semua surah (tipe setoran apa pun) dihitung via resolveNorm, identik dengan
 *   logika HafalanProgress di hafalan-chart.tsx.
 */
export function targetProgress(
  hafalans: { surahName: string }[],
  target: string | null | undefined,
): TargetProgress | null {
  if (!target || !target.trim()) return null
  const idx = JUZ30_SURAHS.findIndex((s) => norm(s.name) === resolveNorm(target))
  if (idx === -1) return null // target di luar Juz 30

  const setoranNorms = new Set(hafalans.map((h) => resolveNorm(h.surahName)))
  const position = idx + 1
  const targetEntry = JUZ30_SURAHS[idx]
  const reached = JUZ30_SURAHS.slice(0, position).filter((s) => setoranNorms.has(norm(s.name))).length

  return {
    valid: true,
    position,
    reached,
    percent: Math.round((reached / position) * 100),
    targetReached: setoranNorms.has(norm(targetEntry.name)),
    targetName: targetEntry.name,
  }
}
