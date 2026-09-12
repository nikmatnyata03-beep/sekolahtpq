# Protokol AI-TASK — Perintah Tugas ke Agen Z.ai Code via GitHub Issues

*(Task 50 — Jalur A: GitHub Issues sebagai "kotak perintah")*

---

## 1. Konsep

Agen Z.ai Code berjalan di sandbox dan **tidak bisa dipanggil masuk** (tidak ada
webhook). Satu-satunya pemicu otomatis adalah **cron poller** (tiap 20 menit)
yang mengecek issue berlabel `ai-task` di repo ini:

```
Kamu (web/HP/Gemini) ──buat issue──▶ GitHub Issues [label: ai-task]
                                              │
Cron poller sandbox (tiap 20 mnt) ────poll────┘
   ├─ klaim (komen + label in-progress)
   ├─ kerjakan di sandbox (kode → QA browser → lint → commit → push)
   ├─ push GitHub ─▶ Cloudflare Workers Builds ─▶ auto-deploy produksi
   └─ komen hasil + hash commit ─▶ tutup issue (atau label need-info)
```

**SLA**: tugas dikerjakan maksimal ±20 menit setelah diterbitkan (interval
poller). **Satu issue per siklus** — tugas diproses berurutan satu per satu.

## 2. Cara memberi tugas

1. Buat issue baru di repo ini → beri label **`ai-task`** (wajib — tanpa label
   ini tidak akan diambil).
2. Isi body mengikuti format di bawah. Tulis dalam Bahasa Indonesia/Inggris,
   instruksi harus **mandiri** (agen cron tidak tahu konteks percakapan manapun).

### Format issue

```markdown
## Tugas
<deskripsi lengkap apa yang harus dikerjakan — satu fokus saja>

## Kriteria Selesai
- <hal yang bisa diverifikasi agen, mis. "panel X tampil di tab Absensi">
- <mis. "API /api/xyz mengembalikan 200 dengan data baru">

## Batasan (opsional)
- <mis. "jangan ubah API existing", "gunakan komponen shadcn/ui">
```

### Contoh yang BAGUS
> ## Tugas
> Tambahkan kolom "Hafalan Terakhir" di tabel Santri pada dashboard admin,
> menampilkan surah terakhir dari data Hafalan tiap santri.
> ## Kriteria Selesai
> - Kolom tampil di tab Santri, urut abjad surah
> - Santri tanpa hafalan menampilkan "—"

### Contoh yang BURUK (akan di-reject)
- "perbaiki yang bug itu" (tanpa konteks — agen tak tahu bug mana)
- "rombak tampilan biar keren" (tanpa kriteria terukur)
- dua tugas sekaligus dalam satu issue

## 3. Siklus hidup label

| Label | Arti | Dipasang oleh |
|---|---|---|
| `ai-task` | Antrean — menunggu poller | Kamu |
| `in-progress` | Sedang dikerjakan agen | Agen (claim) |
| `need-info` | Instruksi ambigu/berbahaya — perbaiki lalu hapus label ini | Agen (reject) |
| *(tertutup)* | Selesai — hasil + hash commit di komen | Agen (done) |

## 4. Batasan keamanan MUTLAK (dijalankan agen, tidak bisa dilanggar)

Agen **menolak** (reject) dan tidak akan pernah:
- Menghapus/drop database, tabel, atau data produksi secara massal
- Menyentuh, menampilkan, atau merotasi `.github-token.local` / secret manapun
- `git push --force`, mengubah riwayat git, atau mengubah konfigurasi deploy
  (Caddyfile, wrangler, Workers Builds)
- Menjalankan perintah destruktif di sandbox (`rm -rf /`, dll.)
- Membuka akses publik pada endpoint sensitif / melemahkan auth
- Mengerjakan tugas di luar repo ini atau mengubah kode proyek lain

Tugas di luar kemampuan (mis. butuh kredensial eksternal) → `need-info`.

## 5. Integrasi Gemini 2.5 Flash (opsional — penerjemah perintah)

Gemini dapat dipakai sebagai "otak depan": kamu bicara natural → Gemini
merapikan sesuai format §2 → Gemini membuat issue via API:

```bash
curl -X POST \
  -H "Authorization: Bearer <GITHUB_TOKEN_KAMU>" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/nikmatnyata03-beep/sekolahtpq/issues \
  -d '{"title":"<judul>","body":"## Tugas\n...\n## Kriteria Selesai\n...","labels":["ai-task"]}'
```

> Token untuk Gemini harus milikmu sendiri (PAT dengan akses issues) dan
> disimpan aman (Worker secret / Apps Script property) — **jangan** pernah di
> hardcode di frontend.

## 6. Perintah cepat (di sandbox)

```bash
bash scripts/ai-task.sh list                # antrean
bash scripts/ai-task.sh show 12             # baca issue #12
bash scripts/ai-task.sh claim 12            # klaim
bash scripts/ai-task.sh done 12 "hasil..."  # lapor + tutup
bash scripts/ai-task.sh reject 12 "alasan"  # butuh info
bash scripts/ai-task.sh setup-labels        # siapkan label sekali di awal
```

## 7. Baris `#CHAT-…` — kanal perintah langsung dari D1 (Task 59)

Sejak Task 57, chat Head Office di `/kantor` + bubble chat dashboard bersifat
asinkron: pesan pengguna tersimpan di D1 dan dijawab agen saat poller berjalan.
`ai-task.sh list` menampilkan antrian tersebut sebagai baris:

```
#CHAT-<messageId> | [KANTOR-CHAT] <ROLE> <nama> | <cuplikan isi pesan>
```

**Task 59 — MODE EKSEKUSI LANGSUNG**: antrian chat D1 kini adalah kanal perintah
utama. Permintaan/perintah pengembangan dari ADMIN/DEVELOPER **langsung
dikerjakan** — tidak perlu menunggu GitHub issue berlabel `ai-task`. GitHub
issue tetap diproses lebih dulu bila ada (murah dicek), tetapi chat D1 tidak
pernah "dilempar balik" ke issue hanya agar tuntas.

Aturan pemrosesan (jangan tertukar dengan issue GitHub):

1. `#CHAT-...` **BUKAN** GitHub issue — JANGAN pakai `show/claim/done/reject`
   `ai-task.sh` untuk itu (semuanya akan error).
2. Bila ada issue GitHub terbuka → kerjakan issue itu dulu seperti biasa;
   chat menyusul di giliran yang sama bila ringan, atau giliran berikutnya.
3. Proses chat maksimal **5 pesan** per giliran; tugas EKSEKUSI (perubahan
   kode) **satu saja** per giliran sesuai **docs/KANTOR-CHAT-AGENT.md**:
   ```bash
   bash scripts/kantor-chat-agent.sh pending            # sudah tampil di list
   bash scripts/kantor-chat-agent.sh claim <messageId>  # wajib sebelum bekerja (409 = diambil agen lain)
   bash scripts/kantor-chat-agent.sh progress <messageId> "langkah kerja"   # WAJIB tiap tahap — live di bubble
   bash scripts/kantor-chat-agent.sh reply <messageId> "jawaban / laporan akhir"
   bash scripts/kantor-chat-agent.sh error <messageId> "alasan tak bisa dijawab"
   ```
4. **Mode eksekusi (ADMIN/DEVELOPER)** — alur wajib:
   `claim` → `progress` di SETIAP tahap (analisis, implementasi, QA, lint,
   commit, push/deploy — contoh: `"→ lint: 0 error"`, `"→ commit a1b2c3d"`) →
   `reply` laporan akhir. Tugas multi-giliran: tulis progres di worklog.md,
   lanjutkan giliran berikutnya, `progress`/`reply` boleh dikirim ulang ke
   pesan yang sudah `answered` (aksi progress/reply mendukungnya).
   **Subagent** yang dipakai untuk mengerjakan tugas WAJIB diinstruksikan
   menjalankan `scripts/kantor-chat-agent.sh progress <messageId> "..."` pada
   tiap milestone agar sinkron tampil di bubble chat.
5. **Mode informasional (GURU, dan ADMIN yang bertanya)** — jawab langsung
   `reply` tanpa kode/data sensitif; pertanyaan operasional diarahkan ke
   dashboard. Larangan kebocoran kredensial/data sensitif tetap mutlak.
6. Laporan akhir giliran sebut jumlah chat diproses, mis. "chat: 2 dijawab".
