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

export interface PortalSettings {
  hero: HeroSettings
  about: AboutSettings
  contact: ContactSettings
  faqs: FaqItem[]
  testimonials: TestimonialItem[]
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
}

export const SETTING_KEYS = ['hero', 'about', 'contact', 'faqs', 'testimonials'] as const
export type SettingKey = (typeof SETTING_KEYS)[number]

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v : fallback
}

function optStr(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function strArray(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback
  const out = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  return out.length > 0 ? out : fallback
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
        .map((x): FaqItem | null => {
          const o = (x ?? {}) as Record<string, unknown>
          const q = typeof o.question === 'string' ? o.question.trim() : ''
          const a = typeof o.answer === 'string' ? o.answer.trim() : ''
          return q && a ? { question: q, answer: a } : null
        })
        .filter((x): x is FaqItem => x !== null)
    : d.faqs

  const testimonials: TestimonialItem[] = Array.isArray(r.testimonials)
    ? (r.testimonials as unknown[])
        .map((x): TestimonialItem | null => {
          const o = (x ?? {}) as Record<string, unknown>
          const quote = typeof o.quote === 'string' ? o.quote.trim() : ''
          const name = typeof o.name === 'string' ? o.name.trim() : ''
          const role = typeof o.role === 'string' ? o.role.trim() : ''
          return quote && name ? { quote, name, role } : null
        })
        .filter((x): x is TestimonialItem => x !== null)
    : d.testimonials

  return {
    hero: {
      bismillah: str(heroRaw.bismillah, d.hero.bismillah),
      badge: str(heroRaw.badge, d.hero.badge),
      title: str(heroRaw.title, d.hero.title),
      tagline: str(heroRaw.tagline, d.hero.tagline),
      showStats: typeof heroRaw.showStats === 'boolean' ? heroRaw.showStats : d.hero.showStats,
      logoUrl: optStr(heroRaw.logoUrl),
      backgroundUrl: str(heroRaw.backgroundUrl, d.hero.backgroundUrl),
    },
    about: {
      badge: str(aboutRaw.badge, d.about.badge),
      heading: str(aboutRaw.heading, d.about.heading),
      tagline: str(aboutRaw.tagline, d.about.tagline),
      vision: str(aboutRaw.vision, d.about.vision),
      missions: strArray(aboutRaw.missions, d.about.missions),
      imageUrl: str(aboutRaw.imageUrl, d.about.imageUrl),
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
  }
}
