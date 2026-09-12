import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { hashPassword } from '@/lib/password'
import { rateLimit, clientIp } from '@/lib/rate-limit'

/**
 * Pemulihan akun oleh AGEN LAYANAN (AI Fix Bridge) — jalur kepercayaan yang
 * SAMA dengan login agen di /api/auth/login (header `x-agent-key`).
 *
 * Latar: tidak ada alur reset password mandiri (butuh sesi aktif), owner
 * terkunci di luar akunnya, dan akses D1 langsung tidak selalu tersedia.
 * Endpoint ini memungkinkan agen memulihkan/membuat akun ADMIN atas mandat
 * eksplisit owner. Jalur PUBLIK tidak berubah — anti-enumerasi publik utuh.
 *
 * POST /api/auth/agent-recovery
 * Headers: x-agent-key: <AGENT_API_KEY>
 * Body: { action: 'reset' | 'create', email, password, name?, role? }
 *  - reset  : user HARUS sudah ada → password diganti
 *  - create : user TIDAK boleh ada → akun baru (role: ADMIN | GURU)
 * 404 saat user tidak ditemukan (reset) / sudah ada (create) — jawaban eksplisit
 * ini memang diinginkan untuk jalur layanan terautentikasi.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Bandingkan string constant-time (anti timing attack) untuk kunci layanan. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function isServiceAgent(req: NextRequest): boolean {
  const agentKey = req.headers.get('x-agent-key') ?? undefined
  const expected = process.env.AGENT_API_KEY
  return (
    typeof expected === 'string' &&
    expected.length >= 32 &&
    typeof agentKey === 'string' &&
    safeEqual(agentKey, expected)
  )
}

export async function POST(req: NextRequest) {
  try {
    // Kunci layanan wajib — tanpa itu endpoint menyerupai 404 generik.
    if (!process.env.AGENT_API_KEY || !isServiceAgent(req)) {
      return bad('Tidak ditemukan', 404)
    }

    // Rate limit defensif per-IP (jalur agen biasanya 1-2 panggilan per insiden).
    if (!rateLimit(`agent-recovery:${clientIp(req)}`, 10, 10 * 60 * 1000)) {
      return bad('Terlalu banyak permintaan. Coba lagi nanti.', 429)
    }

    const body = (await req.json().catch(() => null)) as
      | { action?: unknown; email?: unknown; password?: unknown; name?: unknown; role?: unknown }
      | null
    if (!body) return bad('Permintaan tidak valid', 400)

    const action = String(body.action || '')
    const email = String(body.email || '').toLowerCase().trim()
    const password = String(body.password || '')
    if (!EMAIL_RE.test(email)) return bad('Email tidak valid', 400)
    if (password.length < 8) return bad('Password minimal 8 karakter', 400)

    if (action === 'reset') {
      const user = await db.user.findUnique({ where: { email } })
      if (!user) return bad('Pengguna tidak ditemukan', 404)
      await db.user.update({ where: { id: user.id }, data: { password: hashPassword(password) } })
      // Audit: catat faktanya saja, tanpa materi rahasia.
      console.log(`[agent-recovery] reset password akun ${user.role} id=${user.id} pada ${new Date().toISOString()}`)
      return ok({ success: true, action: 'reset' })
    }

    if (action === 'create') {
      const role = String(body.role || 'ADMIN').toUpperCase()
      if (role !== 'ADMIN' && role !== 'GURU') return bad('Role harus ADMIN atau GURU', 400)
      const name = String(body.name || '').trim()
      if (name.length < 2) return bad('Nama wajib diisi (min 2 karakter)', 400)
      const existing = await db.user.findUnique({ where: { email } })
      if (existing) return bad('Email sudah terdaftar', 409)
      const created = await db.user.create({
        data: { email, name, password: hashPassword(password), role },
        select: { id: true, email: true, role: true },
      })
      console.log(`[agent-recovery] buat akun ${created.role} id=${created.id} pada ${new Date().toISOString()}`)
      return ok({ success: true, action: 'create', id: created.id })
    }

    return bad('Action tidak dikenal (reset | create)', 400)
  } catch {
    return bad('Permintaan tidak valid', 400)
  }
}
