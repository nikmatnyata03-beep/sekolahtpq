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
# Login otomatis sebagai akun developer demo (dev@daruljinan.sch.id).
# Keluar code 0; antrean kosong dicetak sebagai {"empty": true}.

set -uo pipefail

BASE="${LOCAL:+http://localhost:3000}"
BASE="${BASE:-https://tpq.darussolah.workers.dev}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

CMD="${1:-list}"

login() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -c "$JAR" -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"dev@daruljinan.sch.id","password":"dev123"}')
  if [ "$code" != "200" ]; then
    echo "{\"error\": \"login gagal HTTP $code\"}" >&2
    exit 1
  fi
}

api_post() {
  login
  curl -s -b "$JAR" -X POST "$BASE/api/dev/agent-queue" \
    -H 'Content-Type: application/json' -d "$1"
}

case "$CMD" in
  list)
    login
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
    login
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
