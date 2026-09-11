// Bootstrap skema kolom GPS absensi (Task 33) saat runtime.
//
// LATAR (pola yang sama dengan src/lib/pentest/bootstrap.ts): deploy GitHub →
// Cloudflare Workers Builds hanya men-deploy KODE; perubahan skema D1 tidak
// ikut. Agar fitur langsung hidup di produksi setelah push, kolom ditambahkan
// idempoten (ALTER ... ADD COLUMN) pada request pertama yang menyentuh API
// absensi — error "duplicate column" ditelan try/catch.
//
import { db } from '@/lib/api'

const g = globalThis as { __simadjiAttendanceSchemaReady?: Promise<void> }

const STATEMENTS: string[] = [
  // Session: titik GPS anchor tempat QR dibuat
  `ALTER TABLE "Session" ADD COLUMN "lat" REAL`,
  `ALTER TABLE "Session" ADD COLUMN "lng" REAL`,
  `ALTER TABLE "Session" ADD COLUMN "locAccuracy" REAL`,
  `ALTER TABLE "Session" ADD COLUMN "locAt" DATETIME`,
  // Attendance: GPS check-in + heuristik anti-fakeGPS
  `ALTER TABLE "Attendance" ADD COLUMN "method" TEXT`,
  `ALTER TABLE "Attendance" ADD COLUMN "lat" REAL`,
  `ALTER TABLE "Attendance" ADD COLUMN "lng" REAL`,
  `ALTER TABLE "Attendance" ADD COLUMN "accuracy" REAL`,
  `ALTER TABLE "Attendance" ADD COLUMN "gpsAt" DATETIME`,
  `ALTER TABLE "Attendance" ADD COLUMN "distanceM" REAL`,
  `ALTER TABLE "Attendance" ADD COLUMN "gpsFlags" TEXT`,
  // Attendance: bukti foto surat izin/sakit + GPS kamera ustadz
  `ALTER TABLE "Attendance" ADD COLUMN "proofUrl" TEXT`,
  `ALTER TABLE "Attendance" ADD COLUMN "proofLat" REAL`,
  `ALTER TABLE "Attendance" ADD COLUMN "proofLng" REAL`,
  `ALTER TABLE "Attendance" ADD COLUMN "proofAccuracy" REAL`,
  `ALTER TABLE "Attendance" ADD COLUMN "proofAt" DATETIME`,
  `ALTER TABLE "Attendance" ADD COLUMN "proofGpsFlags" TEXT`,
  `ALTER TABLE "Attendance" ADD COLUMN "recordedBy" TEXT`,
  // Task 42: fingerprint ringan perangkat check-in (anti 1 HP banyak santri)
  `ALTER TABLE "Attendance" ADD COLUMN "deviceHash" TEXT`,
  `CREATE INDEX IF NOT EXISTS "Attendance_sessionId_method_idx" ON "Attendance"("sessionId", "method")`,
]

/** Jalankan sekali per isolate — aman dipanggil di setiap handler API absensi. */
export function ensureAttendanceSchema(): Promise<void> {
  if (!g.__simadjiAttendanceSchemaReady) {
    g.__simadjiAttendanceSchemaReady = (async () => {
      for (const sql of STATEMENTS) {
        try {
          await db.$executeRawUnsafe(sql)
        } catch (e) {
          // "duplicate column" = skema sudah ada — abaikan. Lainnya cukup log
          // agar request tidak pernah crash karena bootstrap.
          const msg = (e as Error).message ?? ''
          if (!/duplicate column|already exists/i.test(msg)) {
            console.error('[attendance-schema] gagal:', msg.slice(0, 200))
          }
        }
      }
    })()
  }
  return g.__simadjiAttendanceSchemaReady
}
