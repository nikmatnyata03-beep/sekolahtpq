-- Migrasi Task 33: Absensi GPS anti-fakeGPS + bukti foto izin/sakit.
-- Catatan: ALTER TABLE tidak idempoten; di produksi skema diterapkan otomatis
-- via runtime bootstrap (src/lib/attendance-schema.ts) yang menelan error
-- "duplicate column" sehingga aman dijalankan berulang pada setiap isolate.

-- Session: titik GPS anchor tempat QR dibuat (check-in ≤ 20 m dari titik ini)
ALTER TABLE "Session" ADD COLUMN "lat" REAL;
ALTER TABLE "Session" ADD COLUMN "lng" REAL;
ALTER TABLE "Session" ADD COLUMN "locAccuracy" REAL;
ALTER TABLE "Session" ADD COLUMN "locAt" DATETIME;

-- Attendance: GPS check-in + hasil heuristik anti-fakeGPS
ALTER TABLE "Attendance" ADD COLUMN "method" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "lat" REAL;
ALTER TABLE "Attendance" ADD COLUMN "lng" REAL;
ALTER TABLE "Attendance" ADD COLUMN "accuracy" REAL;
ALTER TABLE "Attendance" ADD COLUMN "gpsAt" DATETIME;
ALTER TABLE "Attendance" ADD COLUMN "distanceM" REAL;
ALTER TABLE "Attendance" ADD COLUMN "gpsFlags" TEXT;

-- Attendance: bukti foto surat izin/sakit + GPS kamera ustadz
ALTER TABLE "Attendance" ADD COLUMN "proofUrl" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "proofLat" REAL;
ALTER TABLE "Attendance" ADD COLUMN "proofLng" REAL;
ALTER TABLE "Attendance" ADD COLUMN "proofAccuracy" REAL;
ALTER TABLE "Attendance" ADD COLUMN "proofAt" DATETIME;
ALTER TABLE "Attendance" ADD COLUMN "proofGpsFlags" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "recordedBy" TEXT;

CREATE INDEX IF NOT EXISTS "Attendance_sessionId_method_idx" ON "Attendance"("sessionId", "method");
