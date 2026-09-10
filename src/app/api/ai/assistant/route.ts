// Asisten AI Guru — generator bahan ajar berbasis Workers AI.
//
//   POST /api/ai/assistant
//   { kind: 'KUIS' | 'IDE_MATERI' | 'RENCANA', surah, ayat?, level?, topic? }
//
//   - KUIS        → 5 soal pilihan ganda (JSON) untuk kuis hafalan/tajwid
//   - IDE_MATERI  → 3 ide aktivitas materi (teks)
//   - RENCANA     → rencana pembelajaran 4 pertemuan (teks)
//
// Akses: ADMIN, GURU, DEVELOPER. Rate limit 8 permintaan / 10 menit / user.

import { NextRequest } from 'next/server'
import { db, ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { runAi, aiErrorMessage, extractJsonBlock } from '@/lib/ai'

export const dynamic = 'force-dynamic'

const KINDS = ['KUIS', 'IDE_MATERI', 'RENCANA'] as const
type Kind = (typeof KINDS)[number]

export async function POST(req: NextRequest) {
  const g = await guard(req, ['ADMIN', 'GURU', 'DEVELOPER'])
  if ('res' in g) return g.res

  if (!rateLimit(`ai-assist:${g.session.id}`, 8, 600_000)) {
    return bad('Terlalu banyak permintaan. Coba lagi dalam 10 menit.', 429)
  }

  const body = (await req.json().catch(() => null)) as
    | { kind?: string; surah?: string; ayat?: string; level?: string; topic?: string }
    | null
  if (!body) return bad('Permintaan tidak valid', 400)

  const kind = String(body.kind || '').toUpperCase() as Kind
  if (!KINDS.includes(kind)) return bad('Jenis keluaran tidak dikenal', 400)
  const surah = String(body.surah || '').trim()
  if (surah.length < 2) return bad('Sebutkan nama surah (minimal 2 karakter)')
  const ayat = String(body.ayat || '').trim().slice(0, 60)
  const level = String(body.level || '').trim().slice(0, 40)
  const topic = String(body.topic || '').trim().slice(0, 300)

  const konteks = `Surah: ${surah}${ayat ? ` (ayat ${ayat})` : ''}${level ? `, jenjang santri: ${level}` : ''}${
    topic ? `, fokus tambahan dari guru: ${topic}` : ''
  }`

  const SYSTEM = `Anda adalah asisten pengajar TPQ (Taman Pendidikan Al-Qur'an) yang membantu ustadz/ustadzah menyiapkan bahan ajar. Gunakan Bahasa Indonesia yang hangat, islami, dan mudah dipahami santri. Jangan mengarang terjemahan ayat — bila butuh terjemahan, gunakan terjemahan standar Kemenag yang umum dikenal. Berhasil berarti output siap pakai tanpa perlu edit besar.`

  try {
    if (kind === 'KUIS') {
      const raw = await runAi(
        SYSTEM +
          `\n\nATURAN OUTPUT — WAJIB JSON MURNI (tanpa markdown fence, tanpa teks lain): array berisi 5 objek soal:
[{"question":"pertanyaan","options":["A. ...","B. ...","C. ...","D. ..."],"answerIndex":0,"note":"penjelasan singkat 1 kalimat"}]
- answerIndex = indeks (0-3) jawaban benar.
- Sebar jawaban benar tidak selalu di posisi yang sama.
- Soal sesuai jenjang dan surah yang diminta (isi, nomor ayat, hukum tajwid, atau makna umum).`,
        `Buat 5 soal kuis untuk santri dengan data berikut.\n${konteks}`,
        1600,
      )
      const json = extractJsonBlock(raw)
      let questions: Array<{ question: string; options: string[]; answerIndex: number; note?: string }> = []
      if (json) {
        try {
          const parsed = JSON.parse(json)
          if (Array.isArray(parsed)) questions = parsed
        } catch {
          // biarkan kosong → fallback ke teks mentah di bawah
        }
      }
      if (questions.length === 0) return ok({ kind, questions: [], text: raw })
      return ok({ kind, questions, text: null })
    }

    if (kind === 'IDE_MATERI') {
      const text = await runAi(
        SYSTEM,
        `Berikan 3 ide aktivitas materi pembelajaran yang kreatif dan siap dipakai, format markdown ringkas (judul tebal + 2-3 kalimat penjelasan per ide, termasuk alat bantu dan durasi).\n${konteks}`,
        1200,
      )
      return ok({ kind, questions: null, text })
    }

    // RENCANA
    const text = await runAi(
      SYSTEM,
      `Susun rencana pembelajaran 4 pertemuan (per pertemuan: tujuan, kegiatan inti 2-3 butir, penilaian sederhana). Format markdown ringkas.\n${konteks}`,
      1400,
    )
    return ok({ kind, questions: null, text })
  } catch (e) {
    console.error('[ai assistant]', e)
    return bad(aiErrorMessage(e), 502)
  }
}
