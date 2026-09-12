// KEEPER SERVICE — penjaga uptime SIMADJI (mini-service port 3040).
//
// Dua loop tanpa henti selama sandbox hidup:
//   1. HEARTBEAT (tiap 90 detik): GET /api/kantor/chat/agent produksi dengan
//      x-agent-key → menyentuh AgentHeartbeat D1 → status chat Head Office
//      TIDAK PERNAH tampil OFFLINE, pesan developer selalu masuk antrian.
//   2. SECURITY PATROL (tiap 10 menit): probe homepage + jalur WAF,
//      tulis hasil ke security-patrol.log (dibaca agen saat bangun).
//
// Endpoint lokal:
//   GET /health  → status kedua loop + denyut terakhir (untuk QA cepat)

import { readFileSync, appendFileSync } from "node:fs";

const PORT = 3040;
const ROOT = "/home/z/my-project";
const BASE = "https://tpq.darussolah.workers.dev";

// Kredensial dari .env proyek (tidak pernah dicetak).
function readAgentKey(): string {
  try {
    const env = readFileSync(`${ROOT}/.env`, "utf8");
    const line = env.split("\n").find((l) => l.startsWith("AGENT_API_KEY="));
    return (line?.split("=").slice(1).join("=") ?? "").replace(/^["']|["']$/g, "");
  } catch {
    return "";
  }
}
const AGENT_KEY = readAgentKey();

let lastHeartbeat = { at: "-", ok: false, pending: 0 };
let lastPatrol = { at: "-", home: 0, wafUa: 0, wafEnv: 0 };

async function touchHeartbeat(): Promise<void> {
  const at = new Date().toISOString();
  try {
    const res = await fetch(`${BASE}/api/kantor/chat/agent?limit=5`, {
      headers: { "x-agent-key": AGENT_KEY },
      signal: AbortSignal.timeout(15_000),
    });
    let pending = 0;
    if (res.ok) {
      const data = (await res.json()) as { pending?: unknown[] };
      pending = data.pending?.length ?? 0;
    }
    lastHeartbeat = { at, ok: res.ok, pending };
  } catch {
    lastHeartbeat = { at, ok: false, pending: 0 };
  }
}

async function runPatrol(): Promise<void> {
  const at = new Date().toISOString().replace("T", " ").slice(0, 19);
  const code = async (path: string, ua?: string) => {
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: ua ? { "user-agent": ua } : {},
        signal: AbortSignal.timeout(15_000),
        redirect: "manual",
      });
      return res.status;
    } catch {
      return 0;
    }
  };
  const home = await code("/");
  const wafUa = await code("/", "sqlmap/1.8");
  const wafEnv = await code("/.env");
  lastPatrol = { at, home, wafUa, wafEnv };
  try {
    appendFileSync(
      `${ROOT}/security-patrol.log`,
      `[${at}] home=${home} waf_ua=${wafUa} waf_env=${wafEnv}\n`,
    );
  } catch {
    // log lokal gagal — jangan matikan loop
  }
  // Anomali dicetak agar muncul di log dev service:
  if (home !== 200 || wafUa !== 403 || wafEnv !== 403) {
    console.error(`[PATROL-ANOMALI] home=${home} waf_ua=${wafUa} waf_env=${wafEnv}`);
  }
}

// Loop 1: heartbeat 90 detik
setInterval(() => void touchHeartbeat(), 90_000);
// Loop 2: patroli 10 menit
setInterval(() => void runPatrol(), 600_000);

// Jalankan sekali saat start agar denyut & log pertama tidak menunggu.
void touchHeartbeat();
void runPatrol();

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return Response.json({
        service: "keeper-simadji",
        ok: lastHeartbeat.ok && lastPatrol.home === 200,
        lastHeartbeat,
        lastPatrol,
      });
    }
    return new Response("SIMADJI keeper service", { status: 200 });
  },
});

console.log(`[keeper-simadji] aktif di port ${server.port} — heartbeat 90s, patroli 10m`);
