#!/usr/bin/env bash
# =====================================================================
# AGENT PING KILAT — denyut heartbeat D1 dalam <2 detik.
#
# Insiden 2026-09-12 16:11: bangun cron terpakai pekerjaan lain →
# `kantor-chat-agent.sh pending` tidak jalan → heartbeat D1 basi →
# chat Head Office tampil OFFLINE. Pelajarannya: PING HARUS JADI
# AKSI PERTAMA di setiap bangun cron, sebelum apapun (list task,
# ringkasan, kerja berat). Script ini GET /api/kantor/chat/agent
# yang sah → server otomatis mencatat denyut (touchHeartbeat).
#
# Pemakaian:   bash scripts/agent-ping.sh
# Exit code:   0 = denyut tercatat, selain itu gagal (jangan blokir
#              pekerjaan lain — cukup catat di stderr).
# Kunci: .env AGENT_API_KEY (tidak pernah dicetak).
# =====================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${KANTOR_CHAT_BASE:-https://tpq.darussolah.workers.dev}"

KEY=$(grep -E '^AGENT_API_KEY=' "$ROOT/.env" | tail -1 | cut -d= -f2- | tr -d '"'"'"'')
if [[ -z "$KEY" ]]; then
  echo "agent-ping: AGENT_API_KEY tidak ditemukan di $ROOT/.env" >&2
  exit 1
fi

http=$(curl -sS -o /dev/null -w '%{http_code}' \
  -H "x-agent-key: $KEY" \
  --max-time 10 \
  "$BASE/api/kantor/chat/agent?limit=1") || http="ERR"

if [[ "$http" == "200" ]]; then
  echo "agent-ping: denyut tercatat ($http)"
  exit 0
fi
echo "agent-ping: GAGAL (http=$http) — chat mungkin tampil timeout" >&2
exit 1
