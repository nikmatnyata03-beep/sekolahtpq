// Cek tabel & isi AgentHeartbeat di db lokal
import { Database } from 'bun:sqlite'
const db = new Database('/home/z/my-project/db/custom.db')
const t = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='AgentHeartbeat'").all()
console.log('table exists:', t.length > 0)
if (t.length > 0) {
  console.log('rows:', JSON.stringify(db.prepare('SELECT * FROM AgentHeartbeat').all(), null, 1))
  console.log('now:', new Date().toISOString())
}
