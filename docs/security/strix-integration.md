# Integrasi Metodologi Strix

SIMADJI memakai adaptasi runtime TypeScript dari metodologi Strix pada
`src/lib/pentest/`. Adaptasi ini menjalankan probe secara aman di Cloudflare
Workers dan tidak mengirim source code atau secret ke Strix Cloud.

## Sumber

- Snapshot Strix: `95e085eb6ce29c72ff84313b012cd2c9e9c1cfe5`
- Lisensi snapshot: Apache-2.0
- Skill lengkap: `penetration-testing-with-strix`, `web-app-penetration-testing`,
  `api-security-testing`, `owasp-top-10-testing`, dan skill pendukung lain.

## Pemetaan Modul

| Modul SIMADJI | Skill Strix | Fokus |
| --- | --- | --- |
| `recon` | `web-app-penetration-testing` | Endpoint publik dan permukaan akses |
| `auth` | `api-security-testing` | Guard, cookie palsu, dan enumerasi |
| `sqli` | `api-security-testing` | Injection pada query dan login |
| `xss` | `web-app-penetration-testing` | Refleksi payload script |
| `idor` | `api-security-testing` | Akses lintas wali/santri |
| `headers` | `owasp-top-10-testing` | Misconfiguration dan hardening browser |
| `info_disclosure` | `find-security-vulnerabilities-in-code` | Secret dan field sensitif |
| `mass_assignment` | `api-security-testing` | Object-property authorization |
| `input_validation` | `owasp-top-10-testing` | Exceptional conditions dan input ekstrem |
| `rate_limit` | `api-security-testing` | Resource abuse dan brute force |
| `weak_password` | `web-app-penetration-testing` | Default credential detection |

## Aturan Operasional

1. Temuan harus memiliki evidence atau PoC yang dapat diverifikasi.
2. Temuan `INFO` tidak dipresentasikan sebagai kerentanan.
3. Uji IDOR dan kredensial hanya berjalan jika secret `PENTEST_*` disediakan
   melalui environment runtime; tidak ada password di source code.
4. Modul mass assignment membersihkan data uji yang berhasil dibuat.
5. Perbaikan harus menyasar akar masalah dan diuji ulang dengan PoC yang sama.
6. Coverage yang tidak dapat diuji harus disebutkan secara eksplisit di laporan.

## Batas Integrasi

Panel AI Pentest memakai implementasi internal yang kompatibel dengan prinsip
Strix. Binary OSS Strix dan Strix Cloud belum dijadikan dependency deployment.
Jika dibutuhkan scan white-box/live yang lebih dalam, jalankan Strix di luar
Worker pada checkout bersih, dengan target yang dimiliki atau diizinkan, lalu
masukkan hasil terverifikasi ke alur remediasi.
