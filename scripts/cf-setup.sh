#!/usr/bin/env bash
# Setup resource Cloudflare untuk SIMADJI (sekali saja).
# Prasyarat: sudah login via `bunx wrangler login` (atau set CLOUDFLARE_API_TOKEN).
#
# Yang dilakukan:
#   1. Buat database D1 "tpqdarussolah" (jika belum ada) -> tulis database_id ke wrangler.jsonc
#   2. Buat bucket R2 "tpqdarussolah-uploads" (jika belum ada)
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Cek autentikasi wrangler..."
bunx wrangler whoami || { echo "❌ Belum login. Jalankan: bunx wrangler login"; exit 1; }

echo "==> Buat database D1 (tpqdarussolah)..."
OUT=$(bunx wrangler d1 create tpqdarussolah 2>&1 || true)
if echo "$OUT" | grep -q "database_id"; then
  ID=$(echo "$OUT" | grep -oP 'database_id\s*=\s*"\K[^"]+' | head -1)
  echo "   database_id: $ID"
  # tulis id ke wrangler.jsonc
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s/GANTI-DENGAN-ID-DARI-wrangler-d1-create/$ID/" wrangler.jsonc
  else
    sed -i "s/GANTI-DENGAN-ID-DARI-wrangler-d1-create/$ID/" wrangler.jsonc
  fi
  echo "   ✔ wrangler.jsonc diperbarui"
else
  echo "   (kemungkinan sudah ada) -> $OUT" | head -5
fi

echo "==> Buat bucket R2 (tpqdarussolah-uploads)..."
bunx wrangler r2 bucket create tpqdarussolah-uploads 2>&1 | head -3 || true

echo ""
echo "✅ Setup selesai. Lanjut ke panduan DEPLOY-CLOUDFLARE.md (langkah 4)."
