import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { rateLimit, clientIp } from '@/lib/rate-limit'

/**
 * GET /api/registrations/check — public PPDB status lookup (no auth required).
 *
 * Contract:
 *   Query params (BOTH required):
 *     - regNumber : registration number, e.g. "PPDB-2025-0001"
 *                   (trimmed + uppercased before compare; stored format "PPDB-2025-XXXX")
 *     - phone     : phone used at registration — full or partial accepted; matched by
 *                   comparing the LAST 5 DIGITS after stripping non-digits from both
 *                   the input and the stored phone (anti-enumeration guard).
 *
 *   Responses:
 *     400 { error: 'Nomor pendaftaran dan nomor HP wajib diisi' }  — either param missing/empty
 *     404 { error: 'Pendaftaran tidak ditemukan. Periksa kembali nomor Anda.' }
 *          — generic message when regNumber unknown OR phone mismatch;
 *            deliberately never reveals which field failed.
 *     200 { regNumber, childName, parentName, status, reviewNote, createdAt, updatedAt }
 *          — SAFE FIELDS ONLY: never returns phone, email, address, documents or note.
 *     400 { error: 'Gagal memeriksa status' } — unexpected failure (catch-all).
 */
export async function GET(req: NextRequest) {
  try {
    // Temuan pentest F-08: batasi pencarian status (regNumber + 5 digit HP)
    // agar tidak bisa di-brute-force masif oleh anonim.
    if (!rateLimit(`regcheck:${clientIp(req)}`, 10, 60 * 1000)) {
      return bad('Terlalu banyak percobaan. Tunggu sebentar.', 429)
    }
    const regNumber = (req.nextUrl.searchParams.get('regNumber') || '').trim().toUpperCase()
    const phone = req.nextUrl.searchParams.get('phone') || ''
    if (!regNumber || !phone.trim()) {
      return bad('Nomor pendaftaran dan nomor HP wajib diisi')
    }

    const reg = await db.registration.findUnique({ where: { regNumber } })

    // Anti-enumeration: phone must match the LAST 5 digits (non-digits ignored),
    // so parents may type the full number or only its last 5 digits. Inputs shorter
    // than 5 digits can never match, keeping brute-force space reasonably large.
    const digits = (s: string) => s.replace(/\D/g, '')
    const inputDigits = digits(phone)
    const phoneOk =
      !!reg && inputDigits.length >= 5 && digits(reg.phone).slice(-5) === inputDigits.slice(-5)

    if (!reg || !phoneOk) {
      return bad('Pendaftaran tidak ditemukan. Periksa kembali nomor Anda.', 404)
    }

    // Success — expose ONLY safe fields (no phone/email/address/documents leakage)
    return ok({
      regNumber: reg.regNumber,
      childName: reg.childName,
      parentName: reg.parentName,
      status: reg.status,
      reviewNote: reg.reviewNote,
      createdAt: reg.createdAt,
      updatedAt: reg.updatedAt,
    })
  } catch {
    return bad('Gagal memeriksa status')
  }
}
