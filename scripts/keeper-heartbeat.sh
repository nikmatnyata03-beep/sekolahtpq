#!/usr/bin/env bash
# KEEPER 1 — Jaga denyut agen Head Office tetap hangat.
# Chat Head Office menampilkan status OFFLINE bila AgentHeartbeat basi.
# Loop ini mem-poll endpoint agen produksi tiap 90 detik — setiap GET sah
# otomatis menyentuh heartbeat (throttle tulis D1 15 detik di endpoint).
# Hasil: bubble chat TIDAK PERNAH menampilkan notice "mencoba pulih",
# pesan developer/wali selalu masuk antrian dan dijawab agen saat bangun.
cd "$(dirname "$0")/.."
LOG=/tmp/keeper-heartbeat-last.json
while true; do
  bash scripts/kantor-chat-agent.sh pending > "$LOG" 2>&1
  sleep 90
done
