# 🕌 SIMADJI — Sistem Manajemen TPQ Darul Jinan

**Si**stem **Ma**najemen **D**igital **JI**nan — platform manajemen internal dan portal publik untuk **TPQ (Taman Pendidikan Al-Qur'an) Darul Jinan**, dibangun dengan Next.js 16, TypeScript, dan Prisma.

![Landing Page SIMADJI](public/images/hero-mosque.jpg)

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?logo=sqlite&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-Runtime-FBF0DF?logo=bun&logoColor=black)

</div>

---

## ✨ Tentang Project

SIMADJI membantu pengelolaan TPQ Darul Jinan secara terpadu dalam **satu aplikasi**:

- 🌐 **Portal Publik** — landing page artistik bernuansa islami (arsitektur masjid, ornamen geometris, animasi scroll 3D) yang seluruh kontennya dapat diedit langsung dari dashboard admin (*CMS built-in*).
- 🏫 **Dashboard Admin & Ustadz/Ustadzah** — kelola santri, guru, kelas, absensi, hafalan, pembayaran, materi, hingga pendaftaran santri baru.
- 👨‍👩‍👧 **Akses Orang Tua** — pantau perkembangan hafalan dan kehadiran putra/putrinya.

## 🗂️ Fitur Utama

### Portal Publik
| Fitur | Keterangan |
|---|---|
| Hero interaktif | Bismillah, badge, tagline, statistik & latar masjid — semua dapat diedit |
| Profil lembaga | Visi, misi, dan foto kegiatan dengan animasi scroll-reveal 3D |
| Biodata guru | Foto, nama, jabatan, dan riwayat — foto dapat diunggah dari admin |
| FAQ & testimoni | Daftar dinamis (tambah/hapus/urutkan) dari panel admin |
| Pendaftaran online | Formulir PPDB santri baru tersimpan langsung ke database |
| Kontak | Alamat, telepon, WhatsApp & jam mengajar — dapat diperbarui tanpa deploy ulang |

### Dashboard Internal
| Modul | Keterangan |
|---|---|
| 📊 Ringkasan | Statistik santri, kehadiran & pembayaran dalam satu layar |
| 👦 Santri | Data lengkap, penempatan kelas, wali & kontak orang tua |
| 🧑‍🏫 Guru | Biodata ustadz/ustadzah lengkap dengan foto profil |
| 🏛️ Kelas & Sesi | Jadwal, tingkat (Iqra/Juz Amma/Al-Qur'an), sesi mengajar |
| ✅ Absensi | Presensi per sesi — hadir, izin, sakit, alpa |
| 📖 Hafalan | Catatan setoran surah, capaian juz, dan mutaba'ah |
| 💰 Pembayaran | SPP & tagihan dengan riwayat per santri |
| 📚 Materi & Kurikulum | Silabus dan bahan ajar per tingkatan |
| 📝 Konten | Artikel/berita & pengumuman untuk portal |
| 📥 Pendaftaran | Verifikasi calon santri dari formulir online |
| 👤 Pengguna | Manajemen akun (ADMIN / GURU / ORANG_TUA) |
| 🎨 Landing Page | Editor CMS: hero, tentang, kontak, FAQ, testimoni + unggah gambar |

## 🛠️ Teknologi

| Lapisan | Teknologi |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) + TypeScript 5 |
| UI | Tailwind CSS 4, shadcn/ui (New York), Lucide Icons, Framer Motion |
| Database | SQLite melalui [Prisma ORM](https://prisma.io) |
| State | Zustand (client), fetch + hooks (server) |
| Runtime | [Bun](https://bun.sh) |
| Tema | Light/Dark mode via next-themes, palet hijau emerald + emas amber |

## 🚀 Memulai

### Prasyarat
- [Bun](https://bun.sh) ≥ 1.1 (atau Node.js ≥ 20 + npm/pnpm)
- Git

### Instalasi

```bash
# 1. Clone repository
git clone https://github.com/USERNAME/simadji.git
cd simadji

# 2. Install dependensi
bun install

# 3. Siapkan environment
echo 'DATABASE_URL=file:../db/custom.db' > .env

# 4. Buat schema database
bun run db:push

# 5. Siapkan password seed melalui environment (jangan commit nilainya)
export SEED_ADMIN_PASSWORD='password-kuat-minimal-12-karakter'
export SEED_DEVELOPER_PASSWORD='password-kuat-minimal-12-karakter'
export SEED_TEACHER_PASSWORD='password-kuat-minimal-12-karakter'
export SEED_PARENT_PASSWORD='password-kuat-minimal-12-karakter'

# 6. Isi data awal (santri, kelas, dan akun)
bun prisma/seed.ts
bun prisma/seed-hafalan.ts

# 7. Jalankan development server
bun run dev
```

Buka `http://localhost:3000` — portal publik; dashboard admin di `/admin`.

Password akun seed sengaja tidak disimpan di repository. Gunakan nilai environment
yang berbeda untuk setiap lingkungan dan rotasi sebelum deployment produksi.

## 📜 Skrip Tersedia

| Perintah | Fungsi |
|---|---|
| `bun run dev` | Development server (port 3000) |
| `bun run build` | Build produksi (standalone output) |
| `bun run start` | Jalankan hasil build produksi |
| `bun run lint` | ESLint |
| `bun run db:push` | Sinkronisasi schema Prisma ke database |
| `bun run db:generate` | Generate Prisma Client |
| `bun run db:migrate` | Migrasi development |
| `bun run cf:setup` | Buat D1 + R2 di Cloudflare (tulis database_id otomatis) |
| `bun run cf:build` | Build aplikasi untuk Cloudflare Workers (OpenNext) |
| `bun run cf:deploy` | Deploy ke Cloudflare Workers |
| `bun run cf:schema` / `cf:data` | Isi skema + data ke database D1 |
| `bun run cf:export` | Ekspor data SQLite lokal → SQL untuk D1 |
| `bun run cf:dev` | Simulasi Workers + D1 + R2 di lokal (port 8787) |

## ☁️ Deploy ke Cloudflare Workers

SIMADJI mendukung deploy **full-stack di Cloudflare**: aplikasi di Workers,
database di **D1**, upload foto di **R2** — tanpa mengubah kode.

```bash
bunx wrangler login   # sekali saja
bun run cf:setup      # buat D1 + R2
bun run cf:schema && bun run cf:data   # isi skema + seluruh data
bun run cf:deploy     # 🚀 live di *.workers.dev
```

Panduan lengkap + arsitektur + troubleshooting: **[DEPLOY-CLOUDFLARE.md](DEPLOY-CLOUDFLARE.md)**

## 🏗️ Struktur Project

```
├── prisma/
│   ├── schema.prisma        # 15 model: User, Student, Class, Attendance, Hafalan, ...
│   ├── seed.ts              # Data awal (akun, kelas, santri, guru)
│   └── seed-hafalan.ts      # Data awal surah & capaian hafalan
├── src/
│   ├── app/
│   │   ├── page.tsx         # Portal publik (landing page)
│   │   └── api/             # 19 REST endpoints (students, attendance, hafalan, ...)
│   ├── components/
│   │   ├── admin/           # Dashboard & modul internal
│   │   ├── public/          # Section landing page + ornamen islami
│   │   └── ui/              # shadcn/ui
│   ├── hooks/               # use-portal-settings, dsb.
│   └── lib/                 # db client, helper API, portal settings
├── public/
│   ├── images/              # Aset ilustrasi bawaan
│   └── uploads/             # Unggahan runtime (di-gitignore)
└── db/                      # SQLite (di-gitignore)
```

## 🔐 Catatan Keamanan

Pemetaan metodologi Strix untuk AI Pentest dan batas coverage tersedia di
**[docs/security/strix-integration.md](docs/security/strix-integration.md)**.

File berikut sengaja **tidak** ikut ke repository (lihat `.gitignore`):

- `db/custom.db` — database berisi data pribadi santri & hash akun
- `.env` — konfigurasi environment
- `public/uploads/` — foto yang diunggah pengguna

Saat berpindah server, salin ketiganya secara manual untuk memindahkan data.

## 📄 Lisensi

Hak cipta © TPQ Darul Jinan. Proyek internal — penggunaan & modifikasi untuk kebutuhan lembaga.

---

<div align="center">

**بَارَكَ اللهُ فِيْكُمْ** — Barakallahu fikum 🌙

</div>
