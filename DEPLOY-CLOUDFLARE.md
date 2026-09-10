# 🚀 Panduan Deploy SIMADJI ke Cloudflare Workers

SIMADJI sudah diubah agar **sepenuhnya berjalan di Cloudflare**:

| Komponen | Lokal (dev) | Cloudflare (produksi) |
|---|---|---|
| Aplikasi | `bun run dev` (port 3000) | **Cloudflare Workers** (OpenNext) |
| Database | SQLite `db/custom.db` | **Cloudflare D1** (SQLite serverless) |
| Upload foto | `public/uploads/` (disk) | **Cloudflare R2** (object storage) |

Tidak ada perubahan kode antara mode lokal dan produksi — `src/lib/db.ts`
dan `/api/upload` mendeteksi runtime secara otomatis.

---

## Langkah 0 — Prasyarat

- Akun Cloudflare gratis ([dash.cloudflare.com](https://dash.cloudflare.com))
- Node.js/Bun di komputer Anda
- Repo ini sudah ter-install (`bun install`)

## Langkah 1 — Login ke Cloudflare

```bash
bunx wrangler login
```

Browser akan terbuka; klik **Allow**.
(Alternatif: set `CLOUDFLARE_API_TOKEN` di environment.)

## Langkah 2 — Buat resource (D1 + R2)

```bash
bun run cf:setup
```

Script ini akan:
1. Membuat database D1 `simadji-db` dan **menuliskan `database_id`-nya
   otomatis ke `wrangler.jsonc`**
2. Membuat bucket R2 `simadji-uploads`

## Langkah 3 — Isi database D1 (skema + seluruh data asli)

```bash
# skema tabel (15 tabel)
bun run cf:schema

# seluruh data dari db/custom.db lokal: akun, santri, guru, kelas,
# absensi, hafalan, pembayaran, pengaturan CMS, dst.
bun run cf:data
```

> Perintah ini mengirim data via API Cloudflare (butuh internet, ±1-2 menit).
> Jika data lokal berubah nanti: `bun run cf:export` → `bun run cf:data` lagi.

## Langkah 4 — Deploy aplikasi

```bash
bun run cf:deploy
```

Output di akhir menampilkan URL live, misal:
`https://simadji.<subdomain-anda>.workers.dev`

Selesai! 🎉 SIMADJI (portal + dashboard + CMS) kini berjalan di edge
Cloudflare dengan database D1 dan storage R2.

---

## Langkah 5 (opsional, disarankan) — Domain kustom

Di dashboard Cloudflare: **Workers & Pages → simadji → Settings →
Domains & Routes → Add → Custom Domain** (misal `simadji.namaanda.or.id`).
DNS otomatis dikonfigurasi jika domainnya ada di akun Cloudflare yang sama.

## Langkah 6 (opsional) — Upload foto guru yang sudah ada

Foto demo guru dikirim sebagai berkas statis (`/uploads/guru-f1.jpg` dst.)
sehingga **langsung tampil tanpa langkah tambahan**. Foto yang diunggah
**setelah** deploy akan tersimpan di R2 otomatis.

---

## 🧪 Menguji di lokal sebelum deploy (opsional)

```bash
bun run cf:build                          # build aplikasi untuk Workers
bunx wrangler d1 execute simadji-db --local --file=prisma/d1/schema.sql
bunx wrangler d1 execute simadji-db --local --file=prisma/d1/data.sql
bun run cf:dev                            # jalankan worker di localhost:8787
```

Mode ini mensimulasikan workerd + D1 + R2 lokal — cocok untuk smoke test
tanpa menyetuh resource produksi.

## 🔄 Cara update setelah deploy

Setiap kali ada perubahan kode:

```bash
bun run cf:deploy
```

Selesai — tidak ada langkah DB lagi (skema hanya berubah jika Anda edit
`prisma/schema.prisma`; saat itu jalankan ulang `bun run cf:schema` dengan
file SQL yang baru).

---

## 🏗️ Arsitektur (untuk referensi teknis)

```
Browser ──> Cloudflare Workers (OpenNext: Next.js 16 App Router)
                │
                ├── D1 binding "DB"      -> prisma/d1/schema.sql + data.sql
                │     src/lib/db.ts: getCloudflareContext().env.DB
                │     -> PrismaClient({ adapter: new PrismaD1(db) })
                │
                ├── R2 binding "UPLOADS" -> foto upload (POST /api/upload)
                │     disajikan via GET /api/files/<nama>
                │
                └── Static Assets        -> public/* (foto bawaan, ilustrasi)
```

Catatan penting:
- `src/lib/db.ts` memakai **lazy singleton (Proxy)**: binding Cloudflare hanya
  bisa dibaca di dalam scope request, jadi klien dibuat saat query pertama.
- Schema Prisma sengaja **tanpa `output`** — generated client di-patch oleh
  OpenNext agar engine-nya berjalan di workerd.
- `next.config.ts` memakai `serverExternalPackages: ["@prisma/client",
  ".prisma/client"]` — wajib, jangan dihapus.

## ❓ Masalah umum

| Gejala | Solusi |
|---|---|
| `wrangler login` tidak membuka browser | Jalankan `bunx wrangler login --browser=false` lalu buka URL yang muncul |
| `database_id: GANTI-DENGAN-...` di wrangler.jsonc | Jalankan ulang `bun run cf:setup` |
| Error FOREIGN KEY saat `cf:data` | Pastikan `prisma/d1/data.sql` diawali `PRAGMA defer_foreign_keys = true;` (sudah dibuat otomatis oleh `cf:export`) |
| Foto admin hilang setelah deploy | Foto demo ada di `public/uploads/*` (ikut deploy). Foto baru otomatis ke R2 |
| Deploy kena kuota gratis | Workers gratis: 100k req/hari — untuk TPQ sangat cukup; D1 gratis 5GB |
