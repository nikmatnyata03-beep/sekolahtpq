#!/usr/bin/env bash
# AI Fix Bridge — alat ambil antrean perbaikan untuk sesi agen AI (Z.ai Code).
#
# Pemakaian:
#   bash scripts/agent-queue.sh list                    → tampilkan item WAITING_AI/IN_PROGRESS (produksi)
#   bash scripts/agent-queue.sh claim <id> [agent]      → klaim item (status IN_PROGRESS)
#   bash scripts/agent-queue.sh resolve <id> "<catatan>" [commitHash]
#   bash scripts/agent-queue.sh reject <id> "<alasan>"
#   bash scripts/agent-queue.sh report "<tipe>" "<endpoint>" "<pesan>" ["detail"]
#       tipe: RUNTIME_JS | RUNTIME_PROMISE | RUNTIME_FETCH | RUNTIME_HTTP5XX
#   LOCAL=1 bash scripts/agent-queue.sh list            → target localhost:3000
#
# Kredensial dibaca dari .agent-credentials.local (gitignored, chmod 600):
#   email=agent@daruljinan.sch.id
#   password=xxxxxxxxxxxxxxxxxxxxxx
# Keluar code 0; antrean kosong dicetak sebagai {"empty": true}.

set -uo pipefail

BASE="${LOCAL:+http://localhost:3000}"
BASE="${BASE:-https://tpq.darussolah.workers.dev}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

CMD="${1:-list}"

CRED_FILE="$(dirname "$0")/../.agent-credentials.local"

load_creds() {
  if [ ! -f "$CRED_FILE" ]; then
    echo "{\"empty\": true, \"note\": \"kredensial agen tidak ditemukan (.agent-credentials.local) — minta ADMIN membuat akun agen via menu Pengguna\"}"
    return 1
  fi
  AGENT_EMAIL=$(grep -E '^email=' "$CRED_FILE" | head -1 | cut -d= -f2-)
  AGENT_PASS=$(grep -E '^password=' "$CRED_FILE" | head -1 | cut -d= -f2-)
  if [ -z "$AGENT_EMAIL" ] || [ -z "$AGENT_PASS" ]; then
    echo "{\"empty\": true, \"note\": \"format .agent-credentials.local tidak valid\"}"
    return 1
  fi
}

login() {
  load_creds || return 1
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -c "$JAR" -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"email": sys.argv[1], "password": sys.argv[2]}))' "$AGENT_EMAIL" "$AGENT_PASS")")
  if [ "$code" != "200" ]; then
    echo "{\"empty\": true, \"note\": \"login agen gagal HTTP $code — akun $AGENT_EMAIL belum ada/salah password di $BASE\"}" >&1
    return 1
  fi
}

api_post() {
  login || return 1
  curl -s -b "$JAR" -X POST "$BASE/api/dev/agent-queue" \
    -H 'Content-Type: application/json' -d "$1"
}

case "$CMD" in
  list)
    login || exit 0
    OUT=$(curl -s -b "$JAR" "$BASE/api/dev/agent-queue")
    if [ -z "$OUT" ]; then
      echo '{"empty": true, "error": "respons kosong"}'
      exit 0
    fi
    # ringkas: bila tidak ada item aktif, tandai kosong
    echo "$OUT" | python3 -c '
import json,sys
try:
    d = json.load(sys.stdin)
except Exception:
    print(json.dumps({"error": "respons bukan JSON"})); sys.exit(0)
items = d.get("items", [])
if not items:
    print(json.dumps({"empty": True, "counts": d.get("counts", {}), "recentFixed": [
        {"message": r.get("message"), "commitHash": r.get("commitHash"), "fixedAt": r.get("fixedAt")}
        for r in d.get("recentFixed", [])]}, ensure_ascii=False))
else:
    print(json.dumps(d, ensure_ascii=False))
'
    ;;
  claim)
    ID="${2:?id wajib}"; AGENT="${3:-zai-code-agent}"
    api_post "{\"action\":\"claim\",\"id\":\"$ID\",\"agent\":\"$AGENT\"}"
    ;;
  resolve)
    ID="${2:?id wajib}"; NOTES="${3:?catatan wajib}"; COMMIT="${4:-}"
    python3 - "$ID" "$NOTES" "$COMMIT" <<'PYEOF' > /tmp/aq-payload.json
import json, sys
print(json.dumps({"action": "resolve", "id": sys.argv[1], "notes": sys.argv[2], "commitHash": sys.argv[3] or None}, ensure_ascii=False))
PYEOF
    api_post "$(cat /tmp/aq-payload.json)"
    rm -f /tmp/aq-payload.json
    ;;
  reject)
    ID="${2:?id wajib}"; REASON="${3:?alasan wajib}"
    python3 - "$ID" "$REASON" <<'PYEOF' > /tmp/aq-payload.json
import json, sys
print(json.dumps({"action": "reject", "id": sys.argv[1], "reason": sys.argv[2]}, ensure_ascii=False))
PYEOF
    api_post "$(cat /tmp/aq-payload.json)"
    rm -f /tmp/aq-payload.json
    ;;
  report)
    TYPE="${2:?tipe wajib}"; EP="${3:-}"; MSG="${4:?pesan wajib}"; DETAIL="${5:-}"
    login || exit 0
    python3 - "$TYPE" "$EP" "$MSG" "$DETAIL" <<'PYEOF' > /tmp/aq-err.json
import json, sys
print(json.dumps({"type": sys.argv[1], "endpoint": sys.argv[2] or None, "message": sys.argv[3], "detail": sys.argv[4] or None}, ensure_ascii=False))
PYEOF
    curl -s -X POST "$BASE/api/dev/errors" -H 'Content-Type: application/json' -d "$(cat /tmp/aq-err.json)"
    rm -f /tmp/aq-err.json
    ;;
  *)
    echo "Perintah tidak dikenal: $CMD (list|claim|resolve|reject|report)" >&2
    exit 1
    ;;
esac
