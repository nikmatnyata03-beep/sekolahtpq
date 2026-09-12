#!/usr/bin/env bash
# KEEPER 2 — Patroli keamanan situs produksi otomatis (tiap 10 menit).
# Cek: homepage hidup (200), WAF memblokir UA sqlmap (403), WAF blokir /.env (403).
# Hasil ditulis ke security-patrol.log — dibaca agen saat bangun; anomali = alarm.
cd "$(dirname "$0")/.."
BASE="https://tpq.darussolah.workers.dev"
LOG=security-patrol.log
while true; do
  TS=$(date '+%Y-%m-%d %H:%M:%S')
  HOME_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 15 "$BASE/")
  WAF_UA=$(curl -s -o /dev/null -w "%{http_code}" -m 15 -A "sqlmap/1.8" "$BASE/")
  WAF_ENV=$(curl -s -o /dev/null -w "%{http_code}" -m 15 "$BASE/.env")
  echo "[$TS] home=$HOME_CODE waf_ua=$WAF_UA waf_env=$WAF_ENV" >> "$LOG"
  sleep 600
done
