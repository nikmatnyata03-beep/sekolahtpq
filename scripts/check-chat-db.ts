// Pemeriksa cepat tabel KantorChat di db lokal (bun run scripts/check-chat-db.ts)
import { Database } from 'bun:sqlite'
const db = new Database('/home/z/my-project/db/custom.db')
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table'")
  .all()
  .map((r: any) => r.name)
  .filter((n: string) => n.includes('Kantor'))
console.log('tables:', tables.join(', ') || 'NONE')
if (tables.includes('KantorChatSession')) {
  const s = db
    .prepare('SELECT id,userName,userRole,createdAt FROM KantorChatSession ORDER BY createdAt DESC LIMIT 5')
    .all()
  console.log('sessions:', JSON.stringify(s, null, 1))
  const m = db
    .prepare('SELECT sessionId,role,status,substr(content,1,100) AS c,createdAt FROM KantorChatMessage ORDER BY createdAt DESC LIMIT 10')
    .all()
  console.log('messages:', JSON.stringify(m, null, 1))
}
