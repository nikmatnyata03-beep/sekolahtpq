# 📡 BLUEPRINT: BALASAN CHAT REAL-TIME (Task 60 — siap eksekusi)

> Status: **MENUNGGU SINKRONISASI REPO** (insiden ENV-0912: sandbox stale era
> Task 43 + `.github-token.local` hilang). JANGAN implementasi sebelum
> `git pull --rebase origin main` sukses — basis lokal tidak punya fitur chat
> Task 57/59; mendorong dari basis lama = menghapus antrian chat & layout editor.

## Konsep: 2 Lapis

```
┌─────────────────────────────────────────────────────────────┐
│ LAPIS 1 — REAL-TIME SEJATI (di dalam app, Cloudflare edge)  │
│ POST /api/kantor/chat → AI auto-responder instan (runAi)    │
│ • Pertanyaan umum  → jawaban ≤3 detik, 24/7, tanpa sandbox  │
│ • Permintaan tugas → ack instan + status tetap 'pending'    │
└──────────────────────────┬──────────────────────────────────┘
                           │ (hanya tugas pengembangan)
┌──────────────────────────▼──────────────────────────────────┐
│ LAPIS 2 — AGEN SANDBOX (poller 5 menit, status quo)         │
│ klaim → progress live → implementasi → reply laporan        │
└─────────────────────────────────────────────────────────────┘
```

Kenapa bukan "sandbox jalan terus"? Agen sandbox hanya tereksekusi saat
dipicu (cron/pesan) — tidak ada proses yang menetap. Real-time sejati harus
hidup di dalam Worker produksi yang memang always-on. Chat bubble UI sudah
polling 4–5 detik → balasan instan terasa langsung muncul.

## Implementasi (di `src/app/api/kantor/chat/route.ts` produksi, versi remote)

Sisipkan SETELAH user message dibuat, SEBELUM return:

```ts
// ===== Task 60: AI auto-responder real-time =====
const TASK_RE =
  /(buat(kan)?|tambah(kan)?|perbaiki|ganti(han)?|hapus|edit|ubah|unggah|upload|integrasi|fitur|bug|error|layout|lapor(an)?|minta)/i
const isDevTask = TASK_RE.test(content)

if (isDevTask) {
  // Ack instan; pesan tetap 'pending' → diambil agen sandbox (Lapis 2).
  await db.kantorChatMessage.create({
    data: {
      sessionId: session.id,
      role: 'assistant',
      content:
        '🤖 Permintaan diterima & diteruskan ke agen pengembang. Balasan lengkap menyusul (umumnya ≤ 5 menit) — progres dikerjakan live di chat ini.',
      status: 'progress',
    },
  })
} else {
  try {
    const persona = `Kamu asisten SIMADJI (TPQ Darul Jinan). Pengirim: ${session.userName} (role ${session.userRole}).
Aturan: Bahasa Indonesia ramah, maks ±150 kata, JANGAN menampilkan data sensitif santri/keuangan milik orang lain, JANGAN berjanji perubahan kode (untuk itu arahkan menunggu agen pengembang).
Konteks sistem: dashboard santri/kelas/absensi/hafalan/keuangan/materi/PPDB/landing editor; santri berriwayat tidak bisa dihapus (ubah status NONAKTIF/LULUS); PPDB cek status via /cek-pendaftaran dengan nomor registrasi + 5 digit HP.`
    const ai = await runAi(persona, content, 600)
    if (ai && !aiErrorMessageSafe(ai)) {
      await db.kantorChatMessage.create({
        data: { sessionId: session.id, role: 'assistant', content: ai.trim(), status: 'answered' },
      })
    }
    // gagal → tanpa assistant message → pesan tetap 'pending' → Lapis 2
  } catch {
    /* fallback Lapis 2 */
  }
}
```

Catatan teknis:
- `runAi` sudah dual-mode (Workers AI binding produksi / z-ai SDK lokal).
- Guard: rate limit AI per sesi (`rateLimit('autoreply:'+session.id, 10, 10*60_000)`) agar tidak boros kuota AI.
- `aiErrorMessageSafe` = cek string error dari `src/lib/ai.ts` (jangan tampilkan error mentah ke user).
- Tidak ada perubahan skema DB, tidak ada perubahan kontrak API agent → aman terhadap poller.
- Race dengan poller: hanya pesan 'pending' diambil agen; balasan Lapis 1 bertanda 'answered' → tidak akan dobel.

## QA Plan (setelah apply)
1. Lokal: chat pertanyaan umum → balasan AI ≤5 dtk (status answered).
2. Chat "buatkan fitur X" → ack progress instan + tetap pending → simulate claim agent OK.
3. Matikan AI (mock error) → pesan tetap pending → poller path tetap jalan.
4. `bun run lint` → push → verifikasi produksi: kirim 2 chat uji dari akun QA.

## Estimasi setelah repo sinkron: ±20 menit (kode + QA + push).
