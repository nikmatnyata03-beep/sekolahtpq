// Site key Turnstile (klien). Produksi memakai key asli lewat fallback.
// Sandbox lokal memakai "test site key" resmi Cloudflare (selalu lolos,
// domain-agnostic) via .env.local karena key asli tidak mengizinkan localhost
// (error Turnstile 110200).
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAEvDOPM3iTwudAmn'
