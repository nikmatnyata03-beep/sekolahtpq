// Bootstrap skema like artikel (Task 66) — pola kantor/bootstrap.ts.
//
// Deploy GitHub → Cloudflare hanya men-deploy KODE; perubahan skema D1 tidak
// ikut. Tabel PostLike dibuat idempoten (CREATE TABLE IF NOT EXISTS) pada
// request pertama yang menyentuh API like/artikel. Promise di-cache per
// proses, dan bila gagal promise di-reset agar request berikutnya mencoba
// lagi (garansi konvergensi tanpa migrasi manual).
import { db } from '@/lib/db'

const g = globalThis as { __simadjiPostLikeSchemaReady?: Promise<void> }

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "PostLike" ("id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL, "visitorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId")
    REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "PostLike_postId_visitorId_key" ON "PostLike"("postId", "visitorId")`,
  `CREATE INDEX IF NOT EXISTS "PostLike_postId_idx" ON "PostLike"("postId")`,
  // Task 67 — komentar artikel (publik tulis, admin hapus)
  `CREATE TABLE IF NOT EXISTS "PostComment" ("id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL, "visitorId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Pengunjung', "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId")
    REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE INDEX IF NOT EXISTS "PostComment_postId_createdAt_idx" ON "PostComment"("postId", "createdAt")`,
]

async function run(): Promise<void> {
  for (const sql of STATEMENTS) {
    await db.$executeRawUnsafe(sql)
  }
}

/** Idempoten: aman dipanggil di setiap request; gagal → dicoba ulang nanti. */
export function ensurePostLikeSchema(): Promise<void> {
  if (!g.__simadjiPostLikeSchemaReady) {
    g.__simadjiPostLikeSchemaReady = run().catch((e) => {
      // reset agar request berikutnya mencoba membuat tabel lagi
      g.__simadjiPostLikeSchemaReady = undefined
      throw e
    })
  }
  return g.__simadjiPostLikeSchemaReady
}
