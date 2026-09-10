/**
 * Ekspor seluruh data dari db/custom.db (SQLite lokal) menjadi file SQL
 * yang siap diimpor ke Cloudflare D1.
 *
 * Pemakaian:  bun scripts/d1-export.ts   →  prisma/d1/data.sql
 */
import { Database } from 'bun:sqlite'
import { writeFileSync } from 'fs'

const DB_PATH = new URL('../db/custom.db', import.meta.url).pathname
const OUT_PATH = new URL('../prisma/d1/data.sql', import.meta.url).pathname

const sqlite = new Database(DB_PATH, { readonly: true })

// Urutan TOPOLOGIS — import D1 remote mengeksekusi statement satu-per-satu
// (PRAGMA defer_foreign_keys tidak berlaku lintas statement), jadi tabel
// yang direferensikan FK HARUS di-insert lebih dulu.
const tables = [
  'Teacher',      // tanpa FK
  'Class',        // -> Teacher
  'User',         // -> Teacher
  'Student',      // -> User, Class
  'Registration', // tanpa FK
  'Session',      // -> Class
  'Attendance',   // -> Session, Student
  'Hafalan',      // -> Student
  'Material',     // -> Teacher, Class
  'Payment',      // -> Student
  'Post',         // -> Teacher
  'Announcement', // tanpa FK
  'Curriculum',   // -> Class
  'SiteSetting',  // tanpa FK
  'Notification', // -> User
]

function quote(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (value instanceof Uint8Array) {
    return `X'${Buffer.from(value).toString('hex')}'`
  }
  const str = String(value)
  return `'${str.replace(/'/g, "''")}'`
}

const lines: string[] = [
  '-- Data ekspor SIMADJI (dari SQLite lokal) untuk Cloudflare D1',
  `-- Dibuat: ${new Date().toISOString()}`,
  '-- Impor: bunx wrangler d1 execute tpqdarussolah --remote --file=prisma/d1/data.sql',
  '',
  '-- Tunda cek foreign key sampai akhir transaksi (urutan tabel bebas)',
  'PRAGMA defer_foreign_keys = true;',
  '',
]

let totalRows = 0
for (const table of tables) {
  let rows: Record<string, unknown>[]
  try {
    rows = sqlite.query(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[]
  } catch {
    lines.push(`-- (tabel ${table} dilewati: tidak ada)`)
    continue
  }
  if (rows.length === 0) continue

  const cols = Object.keys(rows[0])
  const colList = cols.map((c) => `"${c}"`).join(', ')

  lines.push(`-- ${table} (${rows.length} baris)`)
  for (const row of rows) {
    const values = cols.map((c) => quote(row[c])).join(', ')
    lines.push(
      `INSERT INTO "${table}" (${colList}) VALUES (${values}) ON CONFLICT DO NOTHING;`,
    )
    totalRows++
  }
  lines.push('')
}

writeFileSync(OUT_PATH, lines.join('\n'))
console.log(`✔ ${totalRows} baris dari ${tables.length} tabel → ${OUT_PATH}`)
