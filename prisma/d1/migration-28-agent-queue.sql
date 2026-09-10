-- Migrasi Task 28: AI Fix Bridge — kolom antrean perbaikan agen AI.
-- Catatan: ALTER TABLE tidak idempoten; di produksi skema diterapkan otomatis
-- via runtime bootstrap (src/lib/pentest/bootstrap.ts) yang menelan error
-- "duplicate column" sehingga aman dijalankan berulang pada setiap isolate.

-- DevIssue: kolom antrean AI
ALTER TABLE "DevIssue" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'HEALTH';
ALTER TABLE "DevIssue" ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "DevIssue" ADD COLUMN "claimedAt" DATETIME;
ALTER TABLE "DevIssue" ADD COLUMN "claimedBy" TEXT;
ALTER TABLE "DevIssue" ADD COLUMN "commitHash" TEXT;

-- PentestFinding: tautan ke DevIssue antrean AI (jika temuan dikirim ke agen)
ALTER TABLE "PentestFinding" ADD COLUMN "linkedIssueId" TEXT;

CREATE INDEX IF NOT EXISTS "DevIssue_status_idx" ON "DevIssue"("status");
