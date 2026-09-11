#!/usr/bin/env bash
# =====================================================================
# AI-TASK BRIDGE (Jalur A) — GitHub Issues sebagai "kotak perintah"
# untuk agen Z.ai Code di sandbox. (Task 50)
#
# Alur: user/Gemini buat issue berlabel `ai-task` → cron poller di sandbox
# menjalankan script ini → agen klaim, kerjakan, push, lalu laporkan hasil
# via komen + tutup issue. Protokol lengkap: docs/AI-TASK-PROTOCOL.md
#
# Pemakaian:
#   bash scripts/ai-task.sh list              # daftar tugas terbuka
#   bash scripts/ai-task.sh show <N>          # baca isi issue N
#   bash scripts/ai-task.sh claim <N>         # komen "dikerjakan" + label
#   bash scripts/ai-task.sh done <N> "pesan"  # komen hasil + tutup
#   bash scripts/ai-task.sh reject <N> "alasan" # tolak/butuh info (tetap buka)
#   bash scripts/ai-task.sh setup-labels      # buat label b bila belum ada
#
# Token dibaca dari .github-token.local (gitignored — JANGAN pernah di-commit).
# =====================================================================
set -euo pipefail

REPO="nikmatnyata03-beep/sekolahtpq"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN_FILE="$ROOT/.github-token.local"

if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "ERROR: $TOKEN_FILE tidak ditemukan" >&2
  exit 1
fi
TOKEN=$(tr -d '[:space:]' < "$TOKEN_FILE")
API="https://api.github.com/repos/$REPO"
H=(-H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28")

json_escape() { jq -Rn --arg s "$1" '$s'; }

gh() { local method="$1" url="$2" data="${3:-}"; if [[ -n "$data" ]]; then curl -sS -X "$method" "${H[@]}" "$url" -d "$data"; else curl -sS -X "$method" "${H[@]}" "$url"; fi; }

cmd="${1:-list}"; shift || true
case "$cmd" in

  list)
    issues=$(gh GET "$API/issues?labels=ai-task&state=open&per_page=20&sort=created&direction=asc" |
      jq -r 'if type=="array" then (if length==0 then "" else .[] | "#\(.number) | \(.title) | label: \([.labels[].name] | join(","))" end) else "ERROR: \(tostring)" end') || issues=""
    # Task 57-c — jembatan antrian chat Head Office (/kantor) ke poller ini.
    # Baris "#CHAT-..." BUKAN GitHub issue: proses sesuai docs/KANTOR-CHAT-AGENT.md
    # (scripts/kantor-chat-agent.sh claim → reply/error). Saat QA lokal, arahkan
    # dengan env KANTOR_CHAT_BASE=http://localhost:3000.
    chats=$(bash "$ROOT/scripts/kantor-chat-agent.sh" pending 2>/dev/null |
      jq -r '.pending // [] | .[] | "#CHAT-\(.id) | [KANTOR-CHAT] \(.user.role // "?") \(.user.name // "?") | \((.content // "") | gsub("\\s+";" ") | .[0:80])"' 2>/dev/null) || chats=""
    if [[ -z "$issues" && -z "$chats" ]]; then
      echo "(kosong — tidak ada tugas ai-task terbuka)"
    else
      [[ -n "$issues" ]] && printf '%s\n' "$issues"
      [[ -n "$chats" ]] && printf '%s\n' "$chats"
    fi
    ;;

  show)
    gh GET "$API/issues/$1" |
      jq -r 'if .number then "=== ISSUE #\(.number): \(.title) ===\nLABEL: \([.labels[].name]|join(","))\nOLEH: \(.user.login)\n\n\(.body // "(body kosong)")" else "ERROR: \(tostring)" end'
    ;;

  claim)
    N="$1"; MSG="${2:-🔧 **Z.ai Code** mengklaim tugas ini — sedang dikerjakan di sandbox.}"
    gh POST "$API/issues/$N/comments" "$(jq -n --arg body "$MSG" '{body:$body}')" >/dev/null
    gh POST "$API/issues/$N/labels" '{"labels":["in-progress"]}' >/dev/null
    echo "Issue #$N diklaim (label in-progress + komen terpasang)."
    ;;

  done)
    N="$1"; MSG="$2"; COMMIT="${3:-}"
    FULL="✅ **Selesai oleh Z.ai Code** — $(date -u '+%Y-%m-%d %H:%M UTC')

$MSG"
    [[ -n "$COMMIT" ]] && FULL="$FULL
Commit: \`$COMMIT\` (push GitHub → auto-deploy Cloudflare ±5–25 mnt)."
    gh POST "$API/issues/$N/comments" "$(jq -n --arg body "$FULL" '{body:$body}')" >/dev/null
    gh DELETE "$API/issues/$N/labels/in-progress" >/dev/null || true
    gh PATCH "$API/issues/$N" '{"state":"closed"}' >/dev/null
    echo "Issue #$N selesai & ditutup."
    ;;

  reject)
    N="$1"; REASON="$2"
    FULL="⚠️ **Tidak diproses otomatis oleh Z.ai Code** — $(date -u '+%Y-%m-%d %H:%M UTC')

Alasan: $REASON

Perbaiki/Perjelas instruksi lalu hapus label \`need-info\` — agen akan mengambilnya lagi pada polling berikutnya."
    gh POST "$API/issues/$N/comments" "$(jq -n --arg body "$FULL" '{body:$body}')" >/dev/null
    gh DELETE "$API/issues/$N/labels/in-progress" >/dev/null || true
    gh POST "$API/issues/$N/labels" '{"labels":["need-info"]}' >/dev/null
    echo "Issue #$N ditolak (label need-info, issue tetap buka)."
    ;;

  setup-labels)
    declare -A L=(
      ["ai-task"]="#0e8a16|Tugas untuk agen Z.ai Code — dieksekusi otomatis via poller"
      ["in-progress"]="#f9d0c4|Sedang dikerjakan agen"
      ["need-info"]="#d876e3|Instruksi kurang jelas — perbaiki lalu hapus label ini"
    )
    for name in "${!L[@]}"; do
      IFS='|' read -r color desc <<< "${L[$name]}"
      RES=$(gh POST "$API/labels" "$(jq -n --arg n "$name" --arg c "${color#\#}" --arg d "$desc" '{name:$n,color:$c,description:$d}')" 2>&1 || true)
      if echo "$RES" | jq -e '.name' >/dev/null 2>&1; then echo "Label '$name' dibuat."
      elif echo "$RES" | grep -q "already_exists"; then echo "Label '$name' sudah ada."
      else echo "Label '$name': $RES"; fi
    done
    ;;

  *)
    echo "Pemakaian: bash scripts/ai-task.sh <list|show|claim|done|reject|setup-labels>" >&2
    exit 1
    ;;
esac
