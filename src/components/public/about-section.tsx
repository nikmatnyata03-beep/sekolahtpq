'use client'

// Tentang Kami — konten CMS (badge, heading, tagline, visi, misi, foto) dari
// /api/settings via usePortalSettings; sejarah, struktur organisasi, dan
// keunggulan tetap statis. Animasi reveal 3D + ornamen Islami dari ./ornaments.

import {
  BookOpen,
  Building2,
  GraduationCap,
  Heart,
  HeartHandshake,
  MonitorSmartphone,
  Quote,
  Target,
  Users,
} from 'lucide-react'
import { usePortalSettings } from '@/hooks/use-portal-settings'
import { KhatamStar, OrnamentDivider, ParallaxY, ScrollReveal, StarLattice } from './ornaments'

const SEJARAH = [
  {
    year: '2005',
    title: 'Berdirinya TPQ Darul Jinan',
    text: 'Berawal dari sebuah halaqah kecil di Musholla Al-Ikhlas, Cibubur, dengan 23 santri dan 2 ustadzah yang mengajarkan Iqra secara gratis.',
  },
  {
    year: '2010',
    title: 'Terdaftar Resmi di Kemenag',
    text: 'TPQ Darul Jinan resmi terdaftar pada Kementerian Agama RI dan mulai mengadaptasi kurikulum standar TPQ Kemenag.',
  },
  {
    year: '2016',
    title: 'Pembukaan Kelas Tahfidz',
    text: "Dibukanya program kelas Tahfidz Al-Qur'an juz 30 dan pembangunan ruang utama sebagai pusat kegiatan santri.",
  },
  {
    year: '2021',
    title: 'Guru Tersertifikasi BMTQ',
    text: 'Seluruh pengajar menyelesaikan sertifikasi kompetensi guru TPQ dan penguji hafalan melalui BMTQ PNF Jakarta Timur.',
  },
  {
    year: '2025',
    title: 'Peluncuran SIMADJI',
    text: 'Transformasi digital: PPDB online, absensi QR, portal wali santri, dan laporan hafalan real-time dalam satu sistem terpadu.',
  },
]

const STRUKTUR = [
  {
    role: 'Kepala TPQ',
    name: 'H. Ahmad Fauzi, S.Pd.I',
    detail: 'Penanggung jawab lembaga & kurikulum',
  },
  {
    role: 'Koordinator Guru',
    name: 'Ustadzah Fatimah Az-Zahra, S.Pd.I',
    detail: 'Pembinaan metode & kualitas pengajaran',
  },
  {
    role: 'Ustadz / Ustadzah',
    name: 'Tim Pengajar Tersertifikasi',
    detail: "Pendamping kelas & sesi belajar Al-Qur'an",
  },
  {
    role: 'Santri',
    name: "Para Pencinta Al-Qur'an",
    detail: 'Pusat dari seluruh khidmat kami',
  },
]

const KEUNGGULAN = [
  {
    icon: GraduationCap,
    title: 'Guru Tersertifikasi',
    text: 'Ustadz & ustadzah lulusan pesantren dan perguruan tinggi Islam dengan sertifikat kompetensi Kemenag RI.',
  },
  {
    icon: BookOpen,
    title: 'Kurikulum Kemenag',
    text: 'Materi Tajwid, Tahfidz, Ibadah, dan Akhlak mengacu pada standar kurikulum TPQ Kementerian Agama.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Portal Wali Digital',
    text: 'Wali santri memantau kehadiran, capaian hafalan, dan tagihan secara real-time melalui SIMADJI.',
  },
  {
    icon: HeartHandshake,
    title: 'Pembinaan Akhlak',
    text: 'Pembiasaan adab keseharian, doa harian, dan keteladanan akhlak Rasulullah dalam setiap kegiatan.',
  },
]

export function AboutSection() {
  const { settings } = usePortalSettings()

  return (
    <section id="tentang" className="scroll-mt-20 bg-white py-16">
      <div className="mx-auto max-w-6xl px-4">
        {/* Heading */}
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="mb-3 inline-block rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-emerald-700">
            {settings.about.badge}
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-stone-800">{settings.about.heading}</h2>
          <p className="mt-3 text-muted-foreground">{settings.about.tagline}</p>
        </ScrollReveal>

        <OrnamentDivider className="my-12" />

        {/* Foto featured — bingkai artistik + aksen bintang khatam + parallax halus.
            imageUrl '' (dihapus admin) → foto disembunyikan, layout tetap rapi. */}
        {settings.about.imageUrl && (
          <ParallaxY from={-16} to={16} className="relative mb-12">
            <ScrollReveal rotate={4} y={30}>
              <figure className="relative mx-auto max-w-4xl">
                {/* <img> pola sengaja dipakai (bukan next/image) agar URL gambar dari
                    admin (eksternal) tidak butuh konfigurasi domain next/image */}
                <img
                  src={settings.about.imageUrl}
                  alt="Suasana TPQ Darul Jinan"
                  loading="lazy"
                  className="aspect-[16/7] w-full rounded-3xl border-2 border-amber-400/60 object-cover shadow-xl"
                />
                <KhatamStar className="absolute -right-3 -top-3 size-11 rotate-12 text-amber-500 drop-shadow-md" />
              </figure>
            </ScrollReveal>
          </ParallaxY>
        )}

        {/* Visi & Misi */}
        <div className="grid gap-6 md:grid-cols-2">
          <ScrollReveal className="h-full">
            <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 p-6 text-white shadow-md md:p-8">
              <StarLattice id="dj-visi-star" className="absolute inset-0 h-full w-full text-white opacity-[0.07]" />
              <div className="relative">
                <span className="flex size-11 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300">
                  <Quote className="size-5" />
                </span>
                <h3 className="mt-4 text-sm font-bold uppercase tracking-widest text-amber-300">Visi Kami</h3>
                <p className="mt-3 text-lg font-medium leading-relaxed text-emerald-50">
                  &ldquo;{settings.about.vision}&rdquo;
                </p>
                <p className="mt-4 font-serif text-lg text-amber-200/80" dir="rtl" lang="ar">
                  خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ
                </p>
                <p className="mt-1 text-xs text-emerald-200/70">
                  &ldquo;Sebaik-baik kalian adalah yang belajar Al-Qur&apos;an dan mengajarkannya.&rdquo; (HR. Bukhari)
                </p>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal className="h-full" delay={0.1}>
            <div className="h-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
              <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Target className="size-5" />
              </span>
              <h3 className="mt-4 text-sm font-bold uppercase tracking-widest text-emerald-800">Misi Kami</h3>
              <ol className="mt-4 space-y-3">
                {settings.about.missions.map((misi, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-stone-600">{misi}</span>
                  </li>
                ))}
              </ol>
            </div>
          </ScrollReveal>
        </div>

        <OrnamentDivider className="mt-16" />

        {/* Sejarah singkat — timeline */}
        <div className="mt-10">
          <ScrollReveal className="mb-8 text-center">
            <h3 className="text-2xl font-bold text-stone-800">Sejarah Singkat</h3>
            <p className="mt-2 text-sm text-muted-foreground">Perjalanan dua puluh tahun khidmat mengajar Al-Qur&apos;an.</p>
          </ScrollReveal>
          <div className="relative mx-auto max-w-3xl">
            <div className="absolute bottom-3 left-[19px] top-3 w-0.5 bg-gradient-to-b from-emerald-200 via-emerald-100 to-amber-200" aria-hidden="true" />
            <div className="space-y-6">
              {SEJARAH.map((item, i) => (
                <ScrollReveal key={item.year} delay={i * 0.06}>
                  <div className="relative flex gap-5">
                    <span className="relative z-10 mt-1 flex size-10 shrink-0 items-center justify-center rounded-full border-4 border-white bg-emerald-700 shadow-md" aria-hidden="true">
                      <span className="block size-2 rotate-45 bg-amber-400" />
                    </span>
                    <div className="flex-1 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-serif text-xs font-bold text-amber-800">
                          {item.year}
                        </span>
                        <h4 className="font-semibold text-emerald-900">{item.title}</h4>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{item.text}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>

        <OrnamentDivider className="mt-16" />

        {/* Struktur organisasi */}
        <div className="mt-10">
          <ScrollReveal className="mb-8 text-center">
            <h3 className="text-2xl font-bold text-stone-800">Struktur Organisasi</h3>
            <p className="mt-2 text-sm text-muted-foreground">Alur pembinaan dari kepala lembaga hingga santri.</p>
          </ScrollReveal>
          <ScrollReveal delay={0.08}>
            <div className="mx-auto flex max-w-md flex-col items-center">
              {STRUKTUR.map((level, i) => (
                <div key={level.role} className="flex w-full flex-col items-center">
                  {i > 0 && (
                    <div className="flex h-8 w-px items-center" aria-hidden="true">
                      <span className="h-full w-0.5 bg-gradient-to-b from-emerald-300 to-emerald-200" />
                    </div>
                  )}
                  <div className={`w-full rounded-2xl border p-5 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                    i === 0
                      ? 'border-emerald-200 bg-gradient-to-b from-emerald-800 to-emerald-900 text-white'
                      : i === STRUKTUR.length - 1
                        ? 'border-amber-200 bg-amber-50/70'
                        : 'border-stone-200 bg-white'
                  }`}>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                      i === 0
                        ? 'bg-amber-400/20 text-amber-300'
                        : i === STRUKTUR.length - 1
                          ? 'bg-amber-500/15 text-amber-800'
                          : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {i === 0 && <Building2 className="size-3" />}
                      {i === 1 && <Users className="size-3" />}
                      {i === 2 && <BookOpen className="size-3" />}
                      {i === 3 && <Heart className="size-3" />}
                      {level.role}
                    </span>
                    <p className={`mt-2 font-semibold ${i === 0 ? 'text-white' : 'text-stone-800'}`}>{level.name}</p>
                    <p className={`mt-0.5 text-xs ${i === 0 ? 'text-emerald-100/80' : 'text-stone-500'}`}>{level.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>

        <OrnamentDivider className="mt-16" />

        {/* Keunggulan */}
        <div className="mt-10">
          <ScrollReveal className="mb-8 text-center">
            <h3 className="text-2xl font-bold text-stone-800">Mengapa Darul Jinan?</h3>
            <p className="mt-2 text-sm text-muted-foreground">Empat alasan wali santri mempercayakan pendidikan Al-Qur&apos;an anaknya kepada kami.</p>
          </ScrollReveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {KEUNGGULAN.map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 0.06} className="h-full">
                <div className="group h-full rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition-colors group-hover:bg-emerald-700 group-hover:text-white">
                    <item.icon className="size-6" />
                  </span>
                  <h4 className="mt-4 font-semibold text-stone-800">{item.title}</h4>
                  <p className="mt-2 text-sm leading-relaxed text-stone-500">{item.text}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
