import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { getCloudflareContext } from '@opennextjs/cloudflare'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Dual-runtime database client:
 *
 * 1. Cloudflare Workers (produksi) -> PrismaClient + adapter PrismaD1 (binding "DB")
 *    — client yang di-generate dari prisma-client-js dipatch otomatis oleh
 *      OpenNext agar berjalan di workerd (lihat next.config.ts).
 * 2. Development lokal (bun run dev) -> PrismaClient + SQLite file (db/custom.db).
 *
 * CATATAN PENTING:
 * - Binding Cloudflare hanya bisa dibaca DI DALAM scope request (async local
 *   storage). Karena itu klien dibuat "lazy" — saat query pertama — lalu
 *   di-cache sebagai singleton.
 *
 * Tidak ada perubahan kode pada route/API: cukup `import { db } from '@/lib/db'`.
 */
function resolveClient(): PrismaClient {
  if (globalForPrisma.prisma) return globalForPrisma.prisma

  // --- 1. Cloudflare Workers / wrangler dev: gunakan D1 binding ---
  try {
    const { env } = getCloudflareContext()
    const d1 = (env as Record<string, unknown> | undefined)?.DB
    if (d1) {
      const client = new PrismaClient({ adapter: new PrismaD1(d1 as never) })
      globalForPrisma.prisma = client
      return client
    }
  } catch {
    // getCloudflareContext melempar error saat `next dev` biasa (di luar workerd).
    // Lewati -> jalankan mode lokal di bawah.
  }

  // --- 2. Development lokal: SQLite file (DATABASE_URL dari .env) ---
  const local = new PrismaClient({ log: ['query'] })
  globalForPrisma.prisma = local
  return local
}

/**
 * Proxy "lazy": properti apa pun yang diakses pada `db` akan memicu
 * resolveClient() terlebih dahulu (pasti terjadi di dalam request handler).
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = resolveClient() as unknown as Record<string | symbol, unknown>
    const value = Reflect.get(client as object, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
