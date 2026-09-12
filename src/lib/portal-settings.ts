// Kontrak konten Landing Page (CMS publik) — sumber tunggal tipe + default.
// Dipakai oleh: /api/settings (GET/PUT), usePortalSettings, editor admin,
// dan seluruh section publik (hero/about/footer/faq/testimoni).

export interface HeroSettings {
  bismillah: string
  badge: string
  title: string
  tagline: string
  showStats: boolean
  /** '' → fallback logo MoonStar bawaan */
  logoUrl: string
  /** '' → fallback gradien emerald + pola geometris bawaan */
  backgroundUrl: string
}

export interface AboutSettings {
  badge: string
  heading: string
  tagline: string
  vision: string
  missions: string[]
  /** '' → tanpa foto, layout tetap rapi */
  imageUrl: string
}

export interface ContactSettings {
  address: string
  phone: string
  /** format 62xxxxxxxxxx (tanpa +) untuk link wa.me */
  whatsapp: string
  email: string
  hoursNote: string
}

export interface FaqItem {
  question: string
  answer: string
}

export interface TestimonialItem {
  quote: string
  name: string
  role: string
}

export interface GalleryItem {
  /** '' → item dilewati saat merge */
  imageUrl: string
  caption: string
}

export interface PortalSettings {
  hero: HeroSettings
  about: AboutSettings
  contact: ContactSettings
  faqs: FaqItem[]
  testimonials: TestimonialItem[]
  gallery: GalleryItem[]
  /** Urutan render section utama portal publik (Task 59-b — layout editor). */
  sectionOrder: string[]
  /** Warna merek portal (Task 62 — template tema) dalam hex #rrggbb. */
  theme: ThemeSettings
}

/** Tema warna portal publik — diaplikasikan via CSS variables (--brand/--brand-accent). */
export interface ThemeSettings {
  /** Warna utama (tombol, aksen merek, gradien hero). */
  primary: string
  /** Warna sekunder/aksen (garis progres, highlight). */
  accent: string
}

/** Preset tema siap pakai — sekali klik mengganti pasangan warna. */
export const THEME_PRESETS: { id: string; name: string; primary: string; accent: string }[] = [
  { id: 'zamrud', name: 'Zamrud (Bawaan)', primary: '#047857', accent: '#d97706' },
  { id: 'fajar', name: 'Teal Fajar', primary: '#0f766e', accent: '#f59e0b' },
  { id: 'senja', name: 'Amber Senja', primary: '#b45309', accent: '#065f46' },
  { id: 'marun', name: 'Marun Klasik', primary: '#9f1239', accent: '#ca8a04' },
  { id: 'hutan', name: 'Hijau Hutan', primary: '#166534', accent: '#65a30d' },
  { id: 'tinta', name: 'Tinta Terung', primary: '#6d28d9', accent: '#f59e0b' },
]

/**
 * Kunci section utama landing page beserta urutan bawaannya.
 * Anchor id tiap section (beranda/tentang/kurikulum/…) tetap ditangani
 * komponennya masing-masing — urutan ini HANYA mengatur urutan render.
 */
export const DEFAULT_SECTION_ORDER = [
  'hero',
  'ticker',
  'tentang',
  'kurikulum',
  'guru',
  'materi',
  'berita',
  'pengumuman',
  'galeri',
  'testimoni',
  'faq',
  'ppdb',
  'checkin',
] as const

/** Label ramah (Indonesia) untuk tiap section — dipakai editor urutan layout. */
export const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero (Pembuka)',
  ticker: 'Ticker Pengumuman',
  tentang: 'Tentang',
  kurikulum: 'Kurikulum',
  guru: 'Guru & Ustadz',
  materi: 'Materi',
  berita: 'Berita',
  pengumuman: 'Pengumuman',
  galeri: 'Galeri',
  testimoni: 'Testimoni',
  faq: 'FAQ',
  ppdb: 'PPDB',
  checkin: 'Cek-in Absensi',
}

export const DEFAULT_PORTAL_SETTINGS: PortalSettings = {
  hero: {
    bismillah: 'بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ',
    badge: "Taman Pendidikan Al-Qur'an",
    title: 'TPQ Darul Jinan',
    tagline:
      "Mendidik generasi Qur'ani yang hafal, paham, dan berakhlak mulia — membimbing anak menumbuhkan cinta pada Al-Qur'an sejak usia dini dengan bimbingan ustadz dan ustadzah tersertifikasi.",
    showStats: true,
    /** '' → fallback gradien emerald + pola geometris bawaan */
    logoUrl: '',
    /** Default: ilustrasi masjid zamrud-emas buatan; dapat diganti admin. */
    backgroundUrl: '/images/hero-mosque.jpg',
  },
  about: {
    badge: 'Tentang Kami',
    heading: "Membina Generasi Qur'ani yang Berakhlak Mulia",
    tagline:
      "TPQ Darul Jinan adalah lembaga pendidikan Al-Qur'an untuk anak dan remaja di Cibubur, Jakarta Timur — berkhidmat menanamkan cinta Al-Qur'an sejak dini.",
    vision:
      'Menjadi TPQ yang unggul dalam melahirkan generasi penghafal dan pencinta Al-Qur\'an yang berakhlak mulia, beradab, dan bermanfaat bagi umat.',
    missions: [
      "Menyelenggarakan pembelajaran Al-Qur'an yang aktif, menyenangkan, dan menyenangkan hati anak.",
      "Membina santri agar mampu membaca Al-Qur'an dengan tajwid yang benar dan lancar.",
      "Menumbuhkan hafalan juz 'amma dan surat-surat pilihan sebagai bekal ibadah harian.",
      'Menanamkan akhlak mulai dari adab kepada orang tua, guru, dan teman sebaya.',
      'Membangun kemitraan erat antara TPQ dan wali santri melalui komunikasi yang transparan.',
    ],
    imageUrl: '/images/tpq-learning.jpg',
  },
  contact: {
    address: 'Jl. Merpati Raya No. 25, Cibubur, Jakarta Timur',
    phone: '0812-3456-7890',
    whatsapp: '6281234567890',
    email: 'info@daruljinan.sch.id',
    hoursNote: 'Senin – Sabtu 15.00 – 18.00 WIB · Ahad libur',
  },
  faqs: [
    {
      q: 'Berapa iuran (SPP) per bulan, dan apakah ada uang pangkal?',
      a: "Iuran bulanan (SPP) Rp 75.000 – Rp 100.000 tergantung program yang diikuti (Iqra, Al-Qur'an, atau Tahfidz). Tidak ada uang pangkal — pendaftaran PPDB gratis; santri hanya menyiapkan seragam serta kitab/Al-Qur'an masing-masing.",
    },
    {
      q: 'Kapan jadwal belajar TPQ?',
      a: 'Kegiatan belajar berlangsung Senin sampai Sabtu pukul 15.00 – 18.00 WIB sesuai jadwal kelas masing-masing (Ahad libur). Rincian jadwal per kelas dapat dilihat pada bagian Kurikulum di halaman ini.',
    },
    {
      q: 'Usia berapa anak bisa mendaftar?',
      a: 'Pendaftaran dibuka untuk anak usia 4 – 15 tahun. Anak usia 4 – 6 tahun akan ditempatkan pada kelas Iqra pemula dengan metode bermain sambil belajar agar tetap nyaman.',
    },
    {
      q: 'Program apa saja yang tersedia?',
      a: "Tersedia tiga program utama: Iqra (tahap awal membaca), Al-Qur'an (tahsin/perbaikan bacaan), dan Tahfidz (hafalan Al-Qur'an dengan target juz). Penempatan program mengikuti hasil tes penempatan saat verifikasi.",
    },
    {
      q: 'Bagaimana cara mendaftar?',
      a: 'Isi formulir PPDB online pada bagian PPDB di halaman ini, lalu catat nomor registrasi yang muncul. Selanjutnya bawa dokumen (akta kelahiran, kartu keluarga, dan pas foto) saat verifikasi di sekretariat TPQ.',
    },
    {
      q: 'Bagaimana cara membayar tagihan/SPP?',
      a: 'Pembayaran dilakukan melalui Portal Wali: pilih tagihan lalu bayar via QRIS, GoPay, atau Virtual Account. Setelah transaksi berhasil, konfirmasi pembayaran dikirim otomatis melalui WhatsApp.',
    },
    {
      q: 'Apakah orang tua mendapat laporan perkembangan anak?',
      a: 'Ya. Melalui Portal Wali, orang tua dapat memantau kehadiran (absensi), progres hafalan beserta nilai dan catatan ustadz/ustadzah, serta tagihan bulanan. Rapor perkembangan juga dibagikan setiap akhir semester.',
    },
  ].map((f) => ({ question: f.q, answer: f.a })),
  gallery: [
    { imageUrl: '/images/gallery-halaqah.jpg', caption: 'Halaqah baca Al-Qur\u2019an setiap sore' },
    { imageUrl: '/images/gallery-khataman.jpg', caption: 'Khataman & wisata hafalan santri' },
    { imageUrl: '/images/gallery-shalat.jpg', caption: 'Latihan shalat berjamaah' },
    { imageUrl: '/images/gallery-outdoor.jpg', caption: 'Edukasi luar kelas — jelajah alam' },
  ],
  testimonials: [
    {
      quote:
        'Anak saya jadi mandiri mengaji setelah ikut program Tahfidz. Ustadzahnya sabar banget menghadapi anak yang mudah bosan, sekarang hafalannya sudah lebih dari tiga juz. Alhamdulillah.',
      name: 'Bpk. Hendra Gunawan',
      role: 'Wali santri — Program Tahfidz',
    },
    {
      quote:
        'Awalnya anak saya sering enggan ke TPQ, sekarang justru dia yang mengingatkan jadwal ngaji. Metode Iqra di sini menyenangkan, anak-anak betah dan semangat.',
      name: 'Ibu Ratna Sari',
      role: 'Wali santri — Kelas Iqra 3',
    },
    {
      quote:
        'Laporan perkembangan di Portal Wali sangat membantu. Kehadiran, hafalan, sampai tagihan bulanan bisa saya pantau dari HP, dan komunikasi dengan ustadz lewat WhatsApp selalu cepat dibalas.',
      name: 'Bpk. Ahmad Fauzi',
      role: "Wali santri — Kelas Al-Qur'an B",
    },
    {
      quote:
        'Fasilitas nyaman dan pengajarnya komunikatif. Anak saya bukan cuma lancar membaca Al-Qur\u2019an, akhlaknya juga makin sopan dan terbiasa shalat berjamaah di rumah.',
      name: 'Ibu Dewi Lestari',
      role: 'Wali santri — Kelas Tahsin',
    },
  ],
  sectionOrder: [...DEFAULT_SECTION_ORDER],
  theme: { primary: '#047857', accent: '#d97706' },
}

export const SETTING_KEYS = ['hero', 'about', 'contact', 'faqs', 'testimonials', 'gallery'] as const
export type SettingKey = (typeof SETTING_KEYS)[number]

// ===== Batas keamanan (defense in depth) — cegah payload raksasa & injeksi URL =====
const LIMITS = {
  text: 400,
  textarea: 2000,
  url: 500,
  caption: 200,
  missions: 20,
  missionItem: 300,
  faqs: 30,
  faqQuestion: 300,
  faqAnswer: 1500,
  testimonials: 20,
  quote: 600,
  gallery: 24,
} as const

/**
 * Validasi URL gambar dari CMS: hanya path relatif sama-origin (mulai '/') atau
 * https:// absolut. Memblokir javascript:, data:, vbscript:, //cdn dsb. —
 * mencegah injeksi URL berbahaya pada <img src> / <a href> di portal publik.
 */
function safeImageUrl(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback
  const url = v.trim().slice(0, LIMITS.url)
  if (!url) return fallback
  if (url.startsWith('/') && !url.startsWith('//')) return url
  try {
    const u = new URL(url)
    if (u.protocol === 'https:' && !!u.hostname) return url
  } catch {
    /* bukan URL absolut valid */
  }
  return fallback
}

/** Seperti safeImageUrl tapi mengizinkan string kosong (opsional). */
function optSafeImageUrl(v: unknown): string {
  if (typeof v !== 'string') return ''
  const url = v.trim().slice(0, LIMITS.url)
  if (!url) return ''
  if (url.startsWith('/') && !url.startsWith('//')) return url
  try {
    const u = new URL(url)
    if (u.protocol === 'https:' && !!u.hostname) return url
  } catch {
    /* bukan URL absolut valid */
  }
  return ''
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.slice(0, LIMITS.textarea).trim() : fallback
}

function strArray(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback
  const out = (v as unknown[])
    .slice(0, LIMITS.missions)
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim().slice(0, LIMITS.missionItem))
  return out.length > 0 ? out : fallback
}

/**
 * Sanitasi urutan section (Task 59-b): validasi string, dedupe, buang kunci
 * tak dikenal, lalu APPEND kunci yang hilang sesuai urutan default —
 * data lama tanpa sectionOrder otomatis mendapat urutan default penuh.
 */
function sanitizeSectionOrder(v: unknown): string[] {
  const known = new Set<string>(DEFAULT_SECTION_ORDER)
  const seen = new Set<string>()
  const out: string[] = []
  if (Array.isArray(v)) {
    for (const item of v) {
      if (typeof item !== 'string') continue
      const key = item.trim()
      if (!key || !known.has(key) || seen.has(key)) continue
      seen.add(key)
      out.push(key)
    }
  }
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!seen.has(key)) out.push(key)
  }
  return out
}

/**
 * Sanitasi warna hex (#rgb / #rrggbb) — terima bentuk ringkas, kembalikan
 * bentuk normal #rrggbb. Selain itu pakai fallback. Cegah injeksi nilai CSS.
 */
function sanitizeHex(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback
  const s = v.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]
  return fallback
}

/** Deep-merge payload (parsial, bentuk bebas) di atas default — aman untuk data lama/rusak. */
export function mergePortalSettings(raw: unknown): PortalSettings {
  const r = (raw ?? {}) as Record<string, unknown>
  const d = DEFAULT_PORTAL_SETTINGS

  const heroRaw = (r.hero ?? {}) as Record<string, unknown>
  const aboutRaw = (r.about ?? {}) as Record<string, unknown>
  const contactRaw = (r.contact ?? {}) as Record<string, unknown>

  const faqs: FaqItem[] = Array.isArray(r.faqs)
    ? (r.faqs as unknown[])
        .slice(0, LIMITS.faqs)
        .map((x): FaqItem | null => {
          const o = (x ?? {}) as Record<string, unknown>
          const q = typeof o.question === 'string' ? o.question.trim().slice(0, LIMITS.faqQuestion) : ''
          const a = typeof o.answer === 'string' ? o.answer.trim().slice(0, LIMITS.faqAnswer) : ''
          return q && a ? { question: q, answer: a } : null
        })
        .filter((x): x is FaqItem => x !== null)
    : d.faqs

  const testimonials: TestimonialItem[] = Array.isArray(r.testimonials)
    ? (r.testimonials as unknown[])
        .slice(0, LIMITS.testimonials)
        .map((x): TestimonialItem | null => {
          const o = (x ?? {}) as Record<string, unknown>
          const quote = typeof o.quote === 'string' ? o.quote.trim().slice(0, LIMITS.quote) : ''
          const name = typeof o.name === 'string' ? o.name.trim().slice(0, LIMITS.text) : ''
          const role = typeof o.role === 'string' ? o.role.trim().slice(0, LIMITS.text) : ''
          return quote && name ? { quote, name, role } : null
        })
        .filter((x): x is TestimonialItem => x !== null)
    : d.testimonials

  const gallery: GalleryItem[] = Array.isArray(r.gallery)
    ? (r.gallery as unknown[])
        .slice(0, LIMITS.gallery)
        .map((x): GalleryItem | null => {
          const o = (x ?? {}) as Record<string, unknown>
          const imageUrl = optSafeImageUrl(o.imageUrl)
          const caption = typeof o.caption === 'string' ? o.caption.trim().slice(0, LIMITS.caption) : ''
          return imageUrl ? { imageUrl, caption } : null
        })
        .filter((x): x is GalleryItem => x !== null)
    : d.gallery

  return {
    hero: {
      bismillah: str(heroRaw.bismillah, d.hero.bismillah),
      badge: str(heroRaw.badge, d.hero.badge),
      title: str(heroRaw.title, d.hero.title),
      tagline: str(heroRaw.tagline, d.hero.tagline),
      showStats: typeof heroRaw.showStats === 'boolean' ? heroRaw.showStats : d.hero.showStats,
      logoUrl: optSafeImageUrl(heroRaw.logoUrl),
      backgroundUrl: safeImageUrl(heroRaw.backgroundUrl, d.hero.backgroundUrl),
    },
    about: {
      badge: str(aboutRaw.badge, d.about.badge),
      heading: str(aboutRaw.heading, d.about.heading),
      tagline: str(aboutRaw.tagline, d.about.tagline),
      vision: str(aboutRaw.vision, d.about.vision),
      missions: strArray(aboutRaw.missions, d.about.missions),
      imageUrl: safeImageUrl(aboutRaw.imageUrl, d.about.imageUrl),
    },
    contact: {
      address: str(contactRaw.address, d.contact.address),
      phone: str(contactRaw.phone, d.contact.phone),
      whatsapp: str(contactRaw.whatsapp, d.contact.whatsapp),
      email: str(contactRaw.email, d.contact.email),
      hoursNote: str(contactRaw.hoursNote, d.contact.hoursNote),
    },
    faqs,
    testimonials,
    gallery,
    sectionOrder: sanitizeSectionOrder(r.sectionOrder),
    theme: sanitizeTheme(r.theme),
  }
}

/** Gabungkan tema — data lama tanpa theme otomatis pakai warna bawaan. */
function sanitizeTheme(v: unknown): ThemeSettings {
  const d = DEFAULT_PORTAL_SETTINGS.theme
  const o = (v ?? {}) as Record<string, unknown>
  return {
    primary: sanitizeHex(o.primary, d.primary),
    accent: sanitizeHex(o.accent, d.accent),
  }
}
