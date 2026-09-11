# Protokol KANTOR CHAT AGENT (Task 57)

Agen AI sandbox (Z.ai Code) adalah "otak" di balik chat Head Office pada
halaman `/kantor`. Pesan pengguna **tidak** dijawab langsung oleh server —
pesannya masuk antrian di D1, lalu agen menjawabnya saat cron poller 5 menit
berjalan (Job 377378).

## Alur data

```
User (ADMIN/DEVELOPER) → POST /api/kantor/chat  → D1: KantorChatMessage (pending)
UI tampil: "Sedang di proses sistem, silahkan tunggu…"
Cron 5 mnt (sandbox) → scripts/kantor-chat-agent.sh pending → baca + klaim + jawab
                     → POST reply → D1: bubble assistant + status answered
UI polling GET /api/kantor/chat (tiap 5 dtk saat ada pending) → jawaban tampil
```

## Perintah (jalankan dari /home/z/my-project)

```bash
bash scripts/kantor-chat-agent.sh pending                # daftar antrian
bash scripts/kantor-chat-agent.sh claim <messageId>      # WAJIB sebelum menjawab
bash scripts/kantor-chat-agent.sh reply <messageId> "jawaban"
bash scripts/kantor-chat-agent.sh error <messageId> "alasan tidak bisa dijawab"
```

- `pending` mengembalikan JSON: `{ pending: [ { id, sessionId, content, createdAt,
  user: {name,email,role}, history: [...] } ] }` — terlama dulu, maks 10.
- `claim` atomik: hanya satu sesi cron yang bisa mengklaim (yang kalah dapat 409).
  Klaim basi >10 menit otomatis bisa diklaim ulang.
- Uji lokal: `KANTOR_CHAT_BASE=http://localhost:3000 bash scripts/kantor-chat-agent.sh ...`

## Prosedur tiap giliran cron (poller Job 377378)

1. Jalankan `bash scripts/ai-task.sh list` (protokol AI-TASK tetap prioritas).
2. Jalankan `bash scripts/kantor-chat-agent.sh pending`.
3. Untuk **maksimal 5 pesan** per giliran:
   a. `claim <id>` → bila 409, lewati (agen lain mengurus).
   b. Susun jawaban sesuai aturan di bawah → `reply <id> "..."`.
   c. Bila tidak bisa dijawab → `error <id> "<alasan singkat>"`.
4. Laporan akhir sebutkan: jumlah chat diproses (atau "antrian chat kosong").

## Aturan menjawab

- Bahasa Indonesia, ramah-profesional, maksimal ±150 kata per jawaban.
- Jawaban dikirim via `reply` — murni teks (tanpa markdown tabel rumit; newline OK).

### Sesuai role pengirim (`user.role`)

- **DEVELOPER** — kebebasan luas untuk pengembangan web: arsitektur, fitur,
  bug, prioritas, status proyek. Bila diminta perubahan kode:
  - Perubahan kecil/jelas → jawab rencananya, lalu (di giliran cron yang sama
    atau berikutnya) kerjakan mengikuti protokol normal (implementasi → QA →
    lint → commit → push). Catat di worklog dengan Task ID tersendiri.
  - Perubahan besar/ambigu → jelaskan + sarankan membuat GitHub issue
    berlabel `ai-task` agar terdokumentasi rapi.
- **ADMIN** — informasional: cara pakai fitur SIMADJI, status umum, informasi
  TPQ. TIDAK mengubah kode. Pertanyaan data operasional santri/keuangan →
  arahkan ke dashboard SIMADJI (agen tidak menampilkan data sensitif via chat).

### Larangan mutlak (berlaku semua role)

- Jangan pernah menampilkan kredensial, token, secret, isi `.env`,
  `.github-token.local`, atau struktur data sensitif via chat.
- Jangan mengekseskan data pengguna lain (NIS santri, keuangan, dsb).
- Jangan menjalankan perintah destruktif atas nama chat (drop db, force push,
  ubah Caddyfile/wrangler) — tolak dengan sopan via `error` atau `reply`.
- Satu pesan = satu `reply`/`error`. Jangan spam `reply` ganda untuk pesan sama.

## Privasi & retensi

- Sesi chat terpisah per user; API menolak akses sesi milik user lain (404).
- Riwayat chat dipakai agen hanya sebagai konteks menjawab sesi tersebut.
- Cron harian (`/api/cron/daily`) menghapus sesi berumur >30 hari.
