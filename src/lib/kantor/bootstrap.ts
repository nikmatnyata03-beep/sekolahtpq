// Bootstrap skema Kantor AI Agent saat runtime (pola attendance-schema).
//
// Deploy GitHub → Cloudflare hanya men-deploy KODE; perubahan skema D1 tidak
// ikut. Tabel Asset & Feedback dibuat idempoten (CREATE TABLE IF NOT EXISTS)
// pada request pertama yang menyentuh API kantor, lalu seed manifest divisi
// jika masih kosong.
import { db } from '@/lib/db'
import { KANTOR_CHARACTERS } from '@/lib/kantor/data'

const g = globalThis as { __simadjiKantorSchemaReady?: Promise<void> }

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "Asset" ("id" TEXT NOT NULL PRIMARY KEY, "kind" TEXT NOT NULL,
    "assetKey" TEXT NOT NULL, "name" TEXT NOT NULL, "division" TEXT, "colorHex" TEXT,
    "accentHex" TEXT, "modelUrl" TEXT, "animations" TEXT, "role" TEXT, "tasks" TEXT,
    "badge" TEXT, "status" TEXT NOT NULL DEFAULT 'AKTIF', "tasksDone" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Asset_assetKey_key" ON "Asset"("assetKey")`,
  `CREATE TABLE IF NOT EXISTS "Feedback" ("id" TEXT NOT NULL PRIMARY KEY, "divisionId" TEXT NOT NULL,
    "name" TEXT, "message" TEXT NOT NULL, "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "Feedback_divisionId_createdAt_idx" ON "Feedback"("divisionId", "createdAt")`,
]

/** Jalankan sekali per isolate — aman dipanggil di setiap handler API kantor. */
export function ensureKantorSchema(): Promise<void> {
  if (!g.__simadjiKantorSchemaReady) {
    g.__simadjiKantorSchemaReady = (async () => {
      for (const sql of STATEMENTS) {
        try {
          await db.$executeRawUnsafe(sql.replace(/\s+/g, ' '))
        } catch (e) {
          const msg = (e as Error).message ?? ''
          if (!/already exists|duplicate/i.test(msg)) {
            console.error('[kantor-schema] gagal:', msg.slice(0, 200))
          }
        }
      }
      await seedAssets()
    })()
  }
  return g.__simadjiKantorSchemaReady
}

/** Seed manifest divisi dari KANTOR_CHARACTERS (idempoten per assetKey). */
async function seedAssets(): Promise<void> {
  try {
    const existing = await db.asset.findMany({ select: { assetKey: true } })
    const have = new Set(existing.map((a) => a.assetKey))
    const missing = KANTOR_CHARACTERS.filter((c) => !have.has(c.assetKey))
    for (const c of missing) {
      await db.asset.create({
        data: {
          kind: 'CHARACTER',
          assetKey: c.assetKey,
          name: c.name,
          division: c.division,
          colorHex: c.colorHex,
          accentHex: c.accentHex,
          modelUrl: null,
          animations: JSON.stringify(['idle', 'walk', 'talk']),
          role: c.role,
          tasks: JSON.stringify(c.tasks),
          badge: c.badge,
          status: 'AKTIF',
          tasksDone: c.tasksDone,
          version: 1,
        },
      })
    }
    if (missing.length > 0) console.log(`[kantor-schema] seed ${missing.length} aset divisi.`)

    // Task 53: segarkan badge bila label model berubah (mis. Gemini 2.5 → 3.6).
    // Idempoten — hanya menulis baris yang beda.
    for (const c of KANTOR_CHARACTERS) {
      try {
        const row = await db.asset.findFirst({ where: { assetKey: c.assetKey }, select: { id: true, badge: true } })
        if (row && row.badge !== c.badge) {
          await db.asset.update({ where: { id: row.id }, data: { badge: c.badge, version: { increment: 1 } } })
          console.log(`[kantor-schema] badge ${c.assetKey}: ${row.badge} → ${c.badge}`)
        }
      } catch (e) {
        console.error('[kantor-schema] refresh badge gagal:', (e as Error).message?.slice(0, 120))
      }
    }
  } catch (e) {
    console.error('[kantor-schema] seed gagal:', (e as Error).message?.slice(0, 200))
  }
}
