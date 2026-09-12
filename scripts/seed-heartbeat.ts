// Buat tabel AgentHeartbeat (Task 61) di db lokal — idempoten, sama dgn bootstrap.ts
import { Database } from 'bun:sqlite'
const db = new Database('/home/z/my-project/db/custom.db')
db.run(`CREATE TABLE IF NOT EXISTS "AgentHeartbeat" ("id" TEXT NOT NULL PRIMARY KEY,
  "agentKey" TEXT NOT NULL, "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
db.run(`CREATE UNIQUE INDEX IF NOT EXISTS "AgentHeartbeat_agentKey_key" ON "AgentHeartbeat"("agentKey")`)
console.log('AgentHeartbeat siap:', JSON.stringify(db.prepare('SELECT * FROM AgentHeartbeat').all()))
