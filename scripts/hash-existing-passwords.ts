/**
 * Migrasi satu-arah: hash semua password User yang masih plaintext.
 *
 * Jalankan sekali setelah upgrade ke bcrypt:
 *   bun scripts/hash-existing-passwords.ts
 *
 * Idempotent — password yang sudah berformat bcrypt ($2a/$2b/$2y) dilewati.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()
const BCRYPT_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/

async function main() {
  const users = await db.user.findMany({ select: { id: true, email: true, password: true } })
  let migrated = 0
  for (const u of users) {
    if (BCRYPT_RE.test(u.password)) continue
    const hash = await bcrypt.hash(u.password, 10)
    await db.user.update({ where: { id: u.id }, data: { password: hash } })
    migrated++
    console.log(`  ✓ ${u.email} → bcrypt`)
  }
  console.log(`Selesai: ${migrated} dari ${users.length} password di-hash bcrypt.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
