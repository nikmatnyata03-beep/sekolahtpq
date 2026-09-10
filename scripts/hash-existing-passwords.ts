/**
 * Migrasi satu-arah: hash semua password User.
 *
 * Pemakaian:
 *   bun scripts/hash-existing-passwords.ts                  # hash plaintext saja (idempotent)
 *   bun scripts/hash-existing-passwords.ts --force          # rehash SEMUA (termasuk bcrypt lama)
 *   BCRYPT_ROUNDS=5 bun scripts/hash-existing-passwords.ts  # cost khusus (default 10)
 *
 * Idempotent kecuali --force.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/

const force = process.argv.includes('--force')
const envRounds = Number(process.env.BCRYPT_ROUNDS)
const ROUNDS = Number.isFinite(envRounds) && envRounds >= 4 && envRounds <= 15 ? envRounds : 10

async function main() {
  console.log(`Mode: ${force ? 'FORCE (rehash semua)' : 'idempotent (plaintext saja)'} | cost=${ROUNDS}`)
  const users = await db.user.findMany({ select: { id: true, email: true, password: true } })
  let migrated = 0
  for (const u of users) {
    if (!force && BCRYPT_RE.test(u.password)) continue
    const hash = await bcrypt.hash(u.password, ROUNDS)
    await db.user.update({ where: { id: u.id }, data: { password: hash } })
    migrated++
    console.log(`  ✓ ${u.email} → bcrypt cost ${ROUNDS}`)
  }
  console.log(`Selesai: ${migrated} dari ${users.length} password di-hash bcrypt.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
