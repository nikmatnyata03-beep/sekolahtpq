#!/usr/bin/env bash
# Sync repo ke GitHub setelah deploy Cloudflare.
# Usage: bash scripts/push-github.sh "pesan opsional"
#
# Token dibaca dari file lokal `.github-token.local` (TIDAK di-track git).
# Jika file tidak ada / token invalid → script gagal dengan pesan jelas:
# minta user membuat fine-grained PAT baru (Contents: Read and write).

set -euo pipefail
cd "$(dirname "$0")/.."

TOKEN_FILE=".github-token.local"
REMOTE_URL="https://github.com/nikmatnyata03-beep/sekolahtpq.git"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "❌ File $TOKEN_FILE tidak ditemukan."
  echo "   Buat fine-grained PAT di GitHub (Settings → Developer settings →"
  echo "   Fine-grained tokens, repo sekolahtpq, permission Contents: Read and write),"
  echo "   lalu simpan:  echo 'github_pat_xxx' > $TOKEN_FILE && chmod 600 $TOKEN_FILE"
  exit 1
fi

TOKEN="$(tr -d '[:space:]' < "$TOKEN_FILE")"
if [ -z "$TOKEN" ]; then
  echo "❌ $TOKEN_FILE kosong. Isi dengan PAT GitHub."
  exit 1
fi

# Ada perubahan yang belum dicommit? Commit otomatis dengan pesan default.
if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  MSG="${1:-chore: sync perubahan terbaru (follow-up deploy Cloudflare)}"
  git add -A
  git commit -m "$MSG"
fi

echo "→ Push ke GitHub ($REMOTE_URL)..."
if git -c credential.helper="!f() { echo username=x-access-token; echo password=$TOKEN; }; f" \
      push origin HEAD:main 2>&1; then
  echo "✅ GitHub sinkron: $(git rev-parse --short HEAD)"
else
  echo "❌ Push gagal. Kemungkinan: (1) token expired/dihapus → minta PAT baru ke user;"
  echo "   (2) remote punya commit lain → jalankan: git pull --rebase origin main lalu ulangi."
  exit 1
fi
