# Panduan Server WhatsApp WAHA di Ubuntu (Self-Hosted)

> Tujuan: mengubah PC/laptop Ubuntu di sekolah menjadi **server WhatsApp gateway**
> untuk aplikasi sekolahtpq — **gratis, tanpa watermark/footer iklan, tanpa batas kuota**.
> Estimasi pemasangan: 30–45 menit. Dilakukan **sekali**, setelah itu berjalan otomatis.

---

## Yang Dibutuhkan

| Kebutuhan | Keterangan |
| --- | --- |
| PC/laptop Ubuntu | Minimal RAM 2 GB, disarankan laptop tua / mini PC (hemat listrik 10–25 W) |
| Koneksi internet | Kabel LAN lebih stabil daripada WiFi |
| Listrik 24 jam | Set BIOS: *Restore on AC Power Loss → Power On* agar nyala sendiri saat listrik kembali |
| Nomor WhatsApp khusus sekolah | Jangan pakai nomor pribadi (risiko banned walau kecil) |

> 💡 **Catatan listrik:** PC desktop besar ±50–150 W (±Rp 80–150 ribu/bulan).
> Laptop tua / mini PC hanya ±10–25 W (±Rp 15–30 ribu/bulan). Lebih hemat pakai laptop.

---

## Langkah 1 — Agar Ubuntu Tidak Pernah Tidur

Jalankan di terminal (Ctrl+Alt+T):

```bash
# Matikan mode hemat daya / suspend otomatis
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

# Cek: harus terlihat "masked"
systemctl status sleep.target
```

Set juga **Settings → Power → Screen Blank → Never** (opsional, hanya agar layar tidak mati; layar mati tidak masalah, yang penting sistem tidak suspend).

## Langkah 2 — Pasang Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Log out lalu log in lagi agar grup docker aktif, lalu cek:
docker --version
```

## Langkah 3 — Jalankan WAHA (Server WhatsApp)

Pilih **API key sendiri** (ganti `GANTI_KUNCI_RAHASIA` dengan kata sandi bebas):

```bash
docker run -d --name waha \
  --restart always \
  -p 3000:3000 \
  -e WHATSAPP_API_KEY=GANTI_KUNCI_RAHASIA \
  -e WHATSAPP_HOOK_EVENTS=message \
  -v waha-sessions:/app/.sessions \
  devlikeapro/waha:latest
```

- `--restart always` → WAHA hidup sendiri setiap server dinyalakan ulang.
- `-v waha-sessions:/app/.sessions` → sesi WhatsApp **tersimpan permanen**, tidak perlu scan QR ulang setiap reboot.
- Cek berjalan: buka browser di server → `http://localhost:3000` (dashboard WAHA).

## Langkah 4 — Scan QR WhatsApp Sekolah

1. Buka `http://localhost:3000` di browser server.
2. Menu **Sessions** → sesi `default` → klik **START**.
3. Muncul QR → buka WhatsApp di HP nomor sekolah → **Perangkat Tertaut → Tautkan Perangkat** → scan.
4. Status sesi berubah menjadi **WORKING**. Selesai — sesi ini bertahan walau server di-restart.

## Langkah 5 — Buka Akses dari Internet (Tunnel)

Server WAHA hanya bisa diakses dari jaringan lokal. Agar aplikasi sekolahtpq (di Cloudflare)
bisa mengirim pesan lewatnya, pilih **satu** opsi:

### Opsi A — Cloudflare Tunnel (disarankan, gratis, URL tetap) — butuh domain di Cloudflare

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /tmp/cloudflared && sudo install /tmp/cloudflared /usr/local/bin/cloudflared

cloudflared tunnel login                     # buka URL, pilih domain sekolah
cloudflared tunnel create wa-sekolah
cloudflared tunnel route dns wa-sekolah wa.sekolahsekolahanda.com
cloudflared tunnel run --url http://localhost:3000 wa-sekolah
```

Pasang sebagai service agar auto-start:

```bash
sudo cloudflared service install
```

### Opsi B — ngrok Free Static Domain (tanpa domain sendiri)

1. Daftar gratis di `ngrok.com` → ambil **1 static domain gratis** (mis. `wa-sekolah.ngrok-free.app`).
2. Jalankan:

```bash
curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok-v3-stable-linux-amd64.tgz | sudo tar xz -C /usr/local/bin
ngrok config add-authtoken TOKEN_DARI_DASHBOARD_NGROK
ngrok http --url=wa-sekolah.ngrok-free.app 3000
```

3. Agar auto-start, buat systemd service sederhana (opsional, minta bantuan admin TI).

> ⚠️ **Keamanan:** selalu set `WHATSAPP_API_KEY` (Langkah 3). Tanpa itu, siapa pun yang
> tahu URL tunnel bisa memakai WhatsApp sekolah untuk mengirim pesan.

## Langkah 6 — Hubungkan ke Aplikasi sekolahtpq

Login sebagai **ADMIN** di aplikasi → menu **WhatsApp** (log pesan) → kartu **Gateway WhatsApp**:

1. Pilih tab **WAHA Self-Hosted**.
2. **URL server**: isi URL dari Langkah 5 (mis. `https://wa.sekolahanda.com` atau `https://wa-sekolah.ngrok-free.app`).
3. **API key WAHA**: isi kunci yang sama dengan `WHATSAPP_API_KEY` di Langkah 3 (kolom kosong jika tidak dipakai).
4. **Nama sesi**: biarkan `default` (kecuali Anda mengganti nama sesi di WAHA).
5. Klik **Simpan & Aktifkan** → lalu **Tes Koneksi**. Muncul `✓ Terhubung … WORKING` = sukses.
6. Uji kirim pesan nyata lewat tombol **Kirim Pesan Manual** ke nomor HP Anda sendiri.

Selesai! Semua notifikasi otomatis (absensi, tagihan/pembayaran, PPDB, hafalan, pengumuman)
kini dikirim **tanpa watermark** lewat server sekolah.

---

## Perawatan Sehari-hari

| Masalah | Solusi |
| --- | --- |
| Pesan gagal terkirim (FAILED di log aplikasi) | Cek server: internet nyala? `docker ps` — WAHA jalan? |
| Sesi WhatsApp terputus | Buka `http://localhost:3000` → sesi → STOP lalu START → scan QR ulang |
| Server mati karena listrik | Setelah listrik kembali, server & WAHA & tunnel menyala otomatis (jika Langkah 1 + BIOS + `--restart always` dipasang) |
| Ganti kunci API | Edit container: `docker rm -f waha` lalu ulangi Langkah 3 dengan kunci baru, update juga di aplikasi |

Perintah berguna:

```bash
docker ps                 # lihat WAHA hidup/tidak
docker logs waha --tail 50  # lihat log WAHA
docker restart waha       # restart WAHA
```

## Risiko yang Perlu Diketahui

- WAHA memakai protokol WhatsApp Web (bukan API resmi Meta) — peluang nomor diblokir **kecil**
  untuk volume notifikasi TPQ, tetapi bukan nol. Gunakan nomor khusus, hindari broadcast massal.
- Internet sekolah harus menyala 24 jam. Saat internet/server padam, notif tertunda dan
  tercatat **FAILED** di log aplikasi — admin dapat mengirim ulang manual dari log.
