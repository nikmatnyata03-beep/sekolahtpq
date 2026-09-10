/* Idempotent hafalan seed — only inserts demo setoran records for santri
   that currently have NO hafalan records (e.g. Budi Santoso's children),
   so the parent-portal rapor / Juz-30 map demo is non-empty.
   Safe to run repeatedly. Does NOT touch any other data. */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// Juz-30 surah names matching the parent-portal coverage map normalizer
// (normalized: lowercase, non-alphanumeric stripped).
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000)

interface SeedRow {
  surahName: string
  ayatRange: string
  type: 'TAHFIDZ' | 'TAHSHIN' | 'MURAJAAH'
  grade: number | null
  teacherNote: string | null
  daysAgo: number
}

const SEEDS: Record<string, SeedRow[]> = {
  // Muhammad Rizky Ramadhan — Iqra 1 (short surah memorization milestones)
  'DJ-2024-001': [
    { surahName: 'Al-Fatihah', ayatRange: '1-7', type: 'TAHFIDZ', grade: 88, teacherNote: 'Bacaan lancar, makhraj huruf baik. Pertahankan.', daysAgo: 28 },
    { surahName: 'An-Nas', ayatRange: '1-6', type: 'TAHFIDZ', grade: 82, teacherNote: 'Sudah hafal, perlu penguatan pada lafaz Al-waswas.', daysAgo: 21 },
    { surahName: 'Al-Falaq', ayatRange: '1-5', type: 'TAHFIDZ', grade: 79, teacherNote: 'Cukup baik, latihan mandiri di rumah ya.', daysAgo: 14 },
    { surahName: 'Al-Ikhlas', ayatRange: '1-4', type: 'TAHFIDZ', grade: 90, teacherNote: 'MasyaAllah, sangat lancar dan percaya diri.', daysAgo: 7 },
    { surahName: 'Al-Fatihah', ayatRange: '1-7', type: 'MURAJAAH', grade: 92, teacherNote: 'Murajaah sempurna.', daysAgo: 3 },
  ],
  // Alika Syakira — Al-Qur'an A (Juz 30 progression)
  'DJ-2023-021': [
    { surahName: "An-Naba'", ayatRange: '1-20', type: 'TAHFIDZ', grade: 85, teacherNote: 'Hafalan kuat, tajwiedz perlu diperhalus di ayat 15-16.', daysAgo: 35 },
    { surahName: "An-Nazi'at", ayatRange: '1-26', type: 'TAHFIDZ', grade: 81, teacherNote: 'Baik, perlu murajaah rutin agar tidak lupa.', daysAgo: 28 },
    { surahName: 'Abasa', ayatRange: '1-16', type: 'TAHFIDZ', grade: 77, teacherNote: 'Cukup, masih sering tertukar di awal ayat.', daysAgo: 21 },
    { surahName: 'At-Takwir', ayatRange: '1-14', type: 'TAHFIDZ', grade: 89, teacherNote: 'Lancar, tartil dan hening. MasyaAllah.', daysAgo: 10 },
    { surahName: 'Al-Ikhlas', ayatRange: '1-4', type: 'MURAJAAH', grade: 94, teacherNote: 'Murajaah sempurna, siap setor ke ustadzah kepala.', daysAgo: 5 },
    { surahName: 'At-Takwir', ayatRange: '1-14', type: 'TAHSHIN', grade: 86, teacherNote: 'Perbaikan tajwid sudah bagus.', daysAgo: 2 },
  ],
}

async function main() {
  console.log('Seeding demo hafalan (idempotent)...')
  let inserted = 0
  for (const [nis, rows] of Object.entries(SEEDS)) {
    const student = await db.student.findUnique({ where: { nis }, select: { id: true, fullName: true } })
    if (!student) {
      console.warn(`  skip ${nis}: santri tidak ditemukan`)
      continue
    }
    const existing = await db.hafalan.count({ where: { studentId: student.id } })
    if (existing > 0) {
      console.log(`  skip ${student.fullName}: sudah punya ${existing} catatan hafalan`)
      continue
    }
    for (const r of rows) {
      await db.hafalan.create({
        data: {
          studentId: student.id,
          surahName: r.surahName,
          ayatRange: r.ayatRange,
          type: r.type,
          grade: r.grade,
          teacherNote: r.teacherNote,
          createdAt: daysAgo(r.daysAgo),
        },
      })
      inserted++
    }
    console.log(`  + ${student.fullName}: ${rows.length} setoran`)
  }
  console.log(`Done — ${inserted} hafalan records inserted.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
