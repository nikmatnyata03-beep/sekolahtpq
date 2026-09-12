#!/usr/bin/env bash
# =====================================================================
# KANTOR CHAT AGENT BRIDGE (Task 57) — agen sandbox ↔ antrian chat D1.
#
# Chat Head Office /kantor kini asinkron: pesan user tersimpan di D1
# (status 'pending'); agen AI di sandbox mengambil & menjawab lewat
# endpoint /api/kantor/chat/agent (dilindungi header x-agent-key).
# Protokol lengkap: docs/KANTOR-CHAT-AGENT.md
#
# Pemakaian:
#   bash scripts/kantor-chat-agent.sh pending              # antrian menunggu jawaban
#   bash scripts/kantor-chat-agent.sh claim <messageId>    # klaim atomik
#   bash scripts/kantor-chat-agent.sh progress <messageId> "langkah kerja"  # Task 59: baris live
#   bash scripts/kantor-chat-agent.sh reply <messageId> "teks jawaban"
#   bash scripts/kantor-chat-agent.sh error <messageId> "alasan gagal"
#
# Kunci dibaca dari .env (AGENT_API_KEY — JANGAN pernah dicetak/commit).
# Base URL default produksi; override: KANTOR_CHAT_BASE=http://localhost:3000
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${KANTOR_CHAT_BASE:-https://tpq.darussolah.workers.dev}"

KEY=$(grep -E '^AGENT_API_KEY=' "$ROOT/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'"'')
if [[ -z "$KEY" ]]; then
  echo "ERROR: AGENT_API_KEY tidak ditemukan di $ROOT/.env" >&2
  exit 1
fi

AUTH=(-H "x-agent-key: $KEY" -H "Content-Type: application/json")

cmd="${1:-pending}"; shift || true
case "$cmd" in
  pending)
    curl -sS "${AUTH[@]}" "$BASE/api/kantor/chat/agent?limit=10"
    ;;
  claim)
    [[ $# -ge 1 ]] || { echo "Pemakaian: $0 claim <messageId>" >&2; exit 1; }
    jq -n --arg id "$1" '{messageId:$id, action:"claim"}' |
      curl -sS -X POST "${AUTH[@]}" -d @- "$BASE/api/kantor/chat/agent"
    ;;
  progress)
    [[ $# -ge 2 ]] || { echo "Pemakaian: $0 progress <messageId> \"langkah kerja\"" >&2; exit 1; }
    ID="$1"; shift
    jq -n --arg id "$ID" --arg p "$*" '{messageId:$id, progress:$p}' |
      curl -sS -X POST "${AUTH[@]}" -d @- "$BASE/api/kantor/chat/agent"
    ;;
  reply)
    [[ $# -ge 2 ]] || { echo "Pemakaian: $0 reply <messageId> \"teks\"" >&2; exit 1; }
    ID="$1"; shift
    jq -n --arg id "$ID" --arg r "$*" '{messageId:$id, reply:$r}' |
      curl -sS -X POST "${AUTH[@]}" -d @- "$BASE/api/kantor/chat/agent"
    ;;
  error)
    [[ $# -ge 2 ]] || { echo "Pemakaian: $0 error <messageId> \"alasan\"" >&2; exit 1; }
    ID="$1"; shift
    jq -n --arg id "$ID" --arg e "$*" '{messageId:$id, error:$e}' |
      curl -sS -X POST "${AUTH[@]}" -d @- "$BASE/api/kantor/chat/agent"
    ;;
  *)
    echo "Pemakaian: bash scripts/kantor-chat-agent.sh <pending|claim|progress|reply|error> ..." >&2
    exit 1
    ;;
esac
