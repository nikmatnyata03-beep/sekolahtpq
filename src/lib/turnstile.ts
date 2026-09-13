// Site key Turnstile (klien). Produksi memakai key asli lewat fallback.
// Sandbox lokal memakai "test site key" resmi Cloudflare (selalu lolos,
// domain-agnostic) — key asli tidak mengizinkan localhost (error 110200),
// sehingga tanpa ini widget gagal render dan form PPDB tidak pernah bisa
// dikirim di lingkungan pengembangan (QA lokal macam total).
const PROD_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAEvDOPM3iTwudAmn'
const TEST_SITE_KEY = '1x00000000000000000000AA' // Cloudflare resmi: always-passes

export const TURNSTILE_SITE_KEY =
  process.env.NODE_ENV !== 'production' &&
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? TEST_SITE_KEY
    : PROD_SITE_KEY
