// Satpakai: set/refresh akun agen AI Fix Bridge di DB LOKAL (SQLite dev.db).
//   bun scripts/set-local-agent.ts
// Password dibaca dari .agent-credentials.local (sama dengan yang dipakai
// agent-queue.sh). Akun role DEVELOPER agar bisa mengakses antrean perbaikan.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/password'

const credPath = resolve(__dirname, '../.agent-credentials.local')
const raw = readFileSync(credPath, 'utf8')
const email = raw.match(/^email=(.+)$/m)?.[1]?.trim()
const password = raw.match(/^password=(.+)$/m)?.[1]?.trim()
if (!email || !password) throw new Error('.agent-credentials.local tidak valid')

const db = new PrismaClient()
const data = {
  email,
  name: 'Agen AI SIMADJI',
  phone: '081300000099',
  password: hashPassword(password),
  role: 'DEVELOPER' as const,
}
const user = await db.user.upsert({
  where: { email },
  update: { password: data.password, role: 'DEVELOPER' },
  create: data,
  select: { id: true, email: true, role: true },
})
console.log('OK akun agen lokal:', user)
await db.$disconnect()
