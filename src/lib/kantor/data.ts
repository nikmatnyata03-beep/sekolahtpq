// =====================================================================
// KANTOR AI AGENT — sumber data tunggal (seed DB + manifest API + scene 3D).
// (Fitur web 3D terisolasi /kantor — tidak menyentuh data operasional TPQ.)
// =====================================================================

export type KantorDivision =
  | 'GENERAL_PURPOSE'
  | 'EXPLORE'
  | 'PLAN'
  | 'FRONTEND'
  | 'FULLSTACK'
  | 'PPT'
  | 'HEAD'

export interface KantorCharacter {
  assetKey: string
  name: string
  division: KantorDivision
  colorHex: string // warna vest karakter
  accentHex: string // warna aksen sekunder (badge, glow)
  badge: string // label model AI
  role: string // deskripsi peran (panel divisi)
  tasks: string[] // tugas aktif (mock realistis)
  tasksDone: number
  desk: [number, number] // posisi meja (x, z)
  home: [number, number] // posisi berdiri agent (x, z)
  facing: number // rotasi Y (radian) saat idle di home
}

/** Lantai 14 × 10 m. Head di podium belakang tengah; 2 baris × 3 meja. */
export const KANTOR_CHARACTERS: KantorCharacter[] = [
  {
    assetKey: 'agent-head-office',
    name: 'Head Office',
    division: 'HEAD',
    colorHex: '#eab308',
    accentHex: '#fef3c7',
    badge: 'GLM (Z.ai)',
    role: 'Pemimpin kantor. Menerima laporan tiap divisi, menyusun prioritas, dan menjaga keseimbangan beban kerja seluruh agen.',
    tasks: ['Mereview laporan divisi', 'Menyusun prioritas pekanan', 'Rapat koordinasi harian'],
    tasksDone: 512,
    desk: [0, -3.4],
    home: [0, -2.55],
    facing: 0,
  },
  {
    assetKey: 'agent-general-purpose',
    name: 'Agen General',
    division: 'GENERAL_PURPOSE',
    colorHex: '#10b981',
    accentHex: '#d1fae5',
    badge: 'GLM 5.3 Flash',
    role: 'Jack of all trades: riset penunjang, penulisan konten, dan tugas lintas divisi yang tidak punya pemilik jelas.',
    tasks: ['Riset materi pelajaran baru', 'Draf pengumuman TPQ', 'Rapikan data seed QA'],
    tasksDone: 184,
    desk: [-4.6, 2.0],
    home: [-4.6, 1.0],
    facing: 0,
  },
  {
    assetKey: 'agent-explore',
    name: 'Agen Explore',
    division: 'EXPLORE',
    colorHex: '#14b8a6',
    accentHex: '#ccfbf1',
    badge: 'GLM 5.3 Flash',
    role: 'Penjelajah codebase & informasi: memetakan file, mencari referensi, dan menjawab "di mana letak X?" dengan cepat.',
    tasks: ['Peta struktur folder absensi', 'Cari referensi pola badge', 'Inventarisasi endpoint publik'],
    tasksDone: 231,
    desk: [-4.6, -0.6],
    home: [-4.6, -1.6],
    facing: 0,
  },
  {
    assetKey: 'agent-plan',
    name: 'Agen Plan',
    division: 'PLAN',
    colorHex: '#a855f7',
    accentHex: '#f3e8ff',
    badge: 'GLM 5.3 Flash',
    role: 'Arsitek: memecah kebutuhan jadi rencana implementasi bertahap, menimbang trade-off, dan menandai risiko lebih dulu.',
    tasks: ['Rencana dark mode token-based', 'Audit skema index absensi', 'Skema API feedback 3D'],
    tasksDone: 167,
    desk: [0, -0.6],
    home: [0, -1.6],
    facing: 0,
  },
  {
    assetKey: 'agent-frontend-styling-expert',
    name: 'Agen Frontend',
    division: 'FRONTEND',
    colorHex: '#ec4899',
    accentHex: '#fce7f3',
    badge: 'GLM 5.3 Flash',
    role: 'Penjaga rasa visual: styling, animasi halus, responsivitas, dan detail micro-interaction sampai pixelnya.',
    tasks: ['Polish kartu KPI dashboard', 'Animasi sheet mobile', 'Konsistensi radius & spacing'],
    tasksDone: 209,
    desk: [0, 2.0],
    home: [0, 1.0],
    facing: 0,
  },
  {
    assetKey: 'agent-full-stack-developer',
    name: 'Agen Fullstack',
    division: 'FULLSTACK',
    colorHex: '#f97316',
    accentHex: '#ffedd5',
    badge: 'GLM 5.3 Flash',
    role: 'Pekerja end-to-end: API + DB + UI dalam satu modul utuh, lengkap dengan QA dan commit yang rapi.',
    tasks: ['Modul kritik-saran /kantor', 'Endpoint review absensi', 'Panel Absen Mencurigakan'],
    tasksDone: 276,
    desk: [4.6, -0.6],
    home: [4.6, -1.6],
    facing: 0,
  },
  {
    assetKey: 'agent-ppt-expert',
    name: 'Agen Presentasi',
    division: 'PPT',
    colorHex: '#f59e0b',
    accentHex: '#fef3c7',
    badge: 'GLM 5.3 Flash',
    role: 'Perancang slide: menyusun narasi, hierarki visual, dan deck HTML yang siap dipresentasikan.',
    tasks: ['Deck laporan bulanan TPQ', 'Slide profil lembaga', 'Template deck kantor agent'],
    tasksDone: 98,
    desk: [4.6, 2.0],
    home: [4.6, 1.0],
    facing: 0,
  },
]

/** Titik pertemuan di depan podium head. */
export const MEET_POINT: [number, number] = [0, -1.4]

/** Contoh dialog saat dua agen bertemu (MEET). */
export const MEET_DIALOGS: string[] = [
  'Progress aman, lanjut besok.',
  'Butuh review sebentar, yuk.',
  'Data API sudah sinkron semua.',
  'Ide bagus — aku catat dulu.',
  'Estimasinya masih on-track.',
  'Hati-hati di edge case itu.',
  'Sudah kukesampingkan dulu.',
  'Besok kita lanjutkan bersama.',
]

/** Dialog saat agen membawa laporan feedback ke head. */
export const FEEDBACK_DIALOG = 'Menyampaikan masukan wali ke Head Office…'

export const DIVISION_LABELS: Record<KantorDivision, string> = {
  HEAD: 'Head Office',
  GENERAL_PURPOSE: 'General Purpose',
  EXPLORE: 'Explore',
  PLAN: 'Plan',
  FRONTEND: 'Frontend Styling',
  FULLSTACK: 'Fullstack Developer',
  PPT: 'PPT Expert',
}
