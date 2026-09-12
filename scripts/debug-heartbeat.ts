// Debug sementara Task 61 — uji SQL heartbeat langsung ke SQLite lokal.
// HAPUS setelah QA selesai. Jangan commit hasil berisi data.
import { Database } from 'bun:sqlite'

const path = '/home/z/my-project/db/custom.db'
console.log('db path:', path)

const db = new Database(path)

// 1. Pastikan tabel ada
db.exec(`CREATE TABLE IF NOT EXISTS "AgentHeartbeat" ("id" TEXT NOT NULL PRIMARY KEY,
  "agentKey" TEXT NOT NULL, "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "AgentHeartbeat_agentKey_key" ON "AgentHeartbeat"("agentKey")`)

// 2. Uji upsert dengan parameter (pola sama dengan touchHeartbeat)
try {
  db.run(
    `INSERT INTO "AgentHeartbeat" ("id", "agentKey", "lastSeenAt")
     VALUES (lower(hex(randomblob(16))), ?, CURRENT_TIMESTAMP)
     ON CONFLICT("agentKey") DO UPDATE SET "lastSeenAt" = CURRENT_TIMESTAMP
     WHERE "AgentHeartbeat"."lastSeenAt" < datetime('now', ?)`,
    ['head-office', '-15 seconds'],
  )
  console.log('upsert OK')
} catch (e) {
  console.log('upsert GAGAL:', (e as Error).message)
}

// 3. Uji datetime('now', ?) sebagai ekspresi tunggal
try {
  const r = db.query(`SELECT datetime('now', ?) AS t`).get('-15 seconds') as { t: string }
  console.log("datetime('now', ?) =", r.t)
} catch (e) {
  console.log('datetime param GAGAL:', (e as Error).message)
}

// 4. Isi tabel
const rows = db.query(`SELECT * FROM "AgentHeartbeat"`).all()
console.log('rows:', JSON.stringify(rows))
db.close()
