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
import { ok, bad } from '@/lib/api'
import { guard } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { runAi, aiErrorMessage } from '@/lib/ai'

export const dynamic = 'force-dynamic'

const KINDS = ['KUIS', 'IDE_MATERI', 'RENCANA'] as const
type Kind = (typeof KINDS)[number]

interface AiQuestion {
  question: string
  options: string[]
  answerIndex: number
  note?: string
}

/** Validasi + sanitasi satu objek soal dari AI (tolak yang cacat). */
function sanitizeQuestion(o: unknown): AiQuestion | null {
  if (!o || typeof o !== 'object') return null
  const q = o as Record<string, unknown>
  const question = typeof q.question === 'string' ? q.question.trim() : ''
  if (question.length < 5) return null
  if (!Array.isArray(q.options)) return null
  const options = q.options
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim().slice(0, 160))
    .filter(Boolean)
  if (options.length < 2 || options.length > 6) return null
  let idx = typeof q.answerIndex === 'number' ? Math.round(q.answerIndex) : -1
  if (idx < 0 || idx >= options.length) {
    // coba deteksi dari awalan "A." / "B." bila ada field benar bertipe string
    const correct = typeof q.correct === 'string' ? q.correct.trim() : ''
    idx = options.findIndex((opt) => correct && opt.toLowerCase().startsWith(correct.toLowerCase().slice(0, 2)))
    if (idx < 0) return null
  }
  const note = typeof q.note === 'string' ? q.note.trim().slice(0, 240) : undefined
  return { question: question.slice(0, 300), options, answerIndex: idx, note: note || undefined }
}

/**
 * Salvage butir soal dari jawaban AI yang mungkin rusak sebagian:
 * parse utuh dulu (array / {questions}), lalu tangkap tiap blok {...}
 * secara independen agar 1 soal cacat tidak membuang 4 soal yang valid.
 */
function salvageQuestions(raw: string): AiQuestion[] {
  const out: AiQuestion[] = []
  const pushParsed = (parsed: unknown) => {
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const s = sanitizeQuestion(item)
        if (s && !out.some((x) => x.question === s.question)) out.push(s)
      }
    } else if (parsed && typeof parsed === 'object') {
      const q = (parsed as { questions?: unknown }).questions
      if (Array.isArray(q)) pushParsed(q)
    }
  }
  const cleaned = raw.replace(/```(?:json)?/g, '').trim()
  const start = cleaned.indexOf('[')
  const objStart = cleaned.indexOf('{')
  try {
    if (start !== -1 && (objStart === -1 || start < objStart)) {
      pushParsed(JSON.parse(cleaned.slice(start, cleaned.lastIndexOf(']') + 1)))
    } else if (objStart !== -1) {
      pushParsed(JSON.parse(cleaned.slice(objStart, cleaned.lastIndexOf('}') + 1)))
    }
  } catch {
    /* utuh gagal → lanjut salvage per blok */
  }
  if (out.length === 0) {
    for (const m of cleaned.matchAll(/\{[^{}]+\}/g)) {
      try {
        const s = sanitizeQuestion(JSON.parse(m[0]))
        if (s && !out.some((x) => x.question === s.question)) out.push(s)
      } catch {
        /* blok ini cacat — lewati */
      }
    }
  }
  return out
}

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
      const KUIS_RULES =
        `\n\nATURAN OUTPUT — WAJIB JSON MURNI (tanpa markdown fence, tanpa teks lain): array berisi 5 objek soal:\n` +
        `[{"question":"pertanyaan","options":["A. ...","B. ...","C. ...","D. ..."],"answerIndex":0,"note":"penjelasan singkat 1 kalimat"}]\n` +
        `- answerIndex = indeks (0-3) jawaban benar.\n` +
        `- Sebar jawaban benar tidak selalu di posisi yang sama.\n` +
        `- Soal sesuai jenjang dan surah yang diminta (isi, nomor ayat, hukum tajwid, atau makna umum).`
      const userPrompt = `Buat 5 soal kuis untuk santri dengan data berikut.\n${konteks}`

      // Model kadang mengembalikan respons kosong (transient) — coba maksimal 3x.
      // Percobaan ke-2/3 memakai bentuk objek {"questions":[...]} yang lebih stabil.
      let raw = ''
      for (let attempt = 0; attempt < 3 && !raw; attempt++) {
        const msg =
          attempt === 0
            ? userPrompt
            : userPrompt +
              '\n\nBalas dengan OBJEK JSON tunggal berformat {"questions":[ ...5 soal... ]} — tanpa markdown, tanpa teks lain, mulai langsung dengan karakter {.'
        raw = await runAi(SYSTEM + KUIS_RULES, msg, 1600).catch(() => '')
      }
      if (!raw) throw new Error('Model AI memberikan respons kosong — coba lagi sebentar')

      // Salvage: 1 soal cacat tidak boleh membuang soal yang valid.
      const questions = salvageQuestions(raw)
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
