'use client'

/**
 * Asisten AI Guru — generator bahan ajar (kuis hafalan, ide materi,
 * rencana pembelajaran) berbasis Workers AI.
 * Akses: ADMIN, GURU, DEVELOPER.
 */

import { useMemo, useState } from 'react'
import {
  Sparkles,
  Loader2,
  Copy,
  ListChecks,
  Lightbulb,
  ClipboardList,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'
import { apiSend } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Daftar surah populer Juz 30 + beberapa surah umum untuk saran cepat
const SURAH_SUGGESTIONS = [
  'An-Naba', 'An-Nazi-at', 'Abasa', 'At-Takwir', 'Al-Infithar', 'Al-Muthaffifin',
  'Al-Insyiqaq', 'Al-Buruj', 'Ath-Thariq', 'Al-A-la', 'Al-Ghasyiyah', 'Al-Fajr',
  'Al-Balad', 'Asy-Syams', 'Al-Lail', 'Ad-Dhuha', 'Al-Insyirah', 'Al-Tin',
  'Al-Alaq', 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah', 'Al-Adiyat', 'Al-Qariah',
  'At-Takatsur', 'Al-Asr', 'Al-Humazah', 'Al-Fil', 'Quraisy', 'Al-Maun',
  'Al-Kausar', 'Al-Kafirun', 'An-Nasr', 'Al-Lahab', 'Al-Ikhlas', 'Al-Falaq', 'An-Nas',
]

const LEVELS = [
  'Iqra 1-2',
  'Iqra 3-4',
  'Iqra 5-6',
  'Juz 30 (Tahfidz)',
  'Tahsin/Tajwid',
  'Akhlak & Ibadah',
]

const KINDS = [
  { value: 'KUIS', label: 'Kuis Hafalan', desc: '5 soal pilihan ganda', icon: ListChecks },
  { value: 'IDE_MATERI', label: 'Ide Materi', desc: '3 ide aktivitas kreatif', icon: Lightbulb },
  { value: 'RENCANA', label: 'Rencana Belajar', desc: 'Rencana 4 pertemuan', icon: ClipboardList },
] as const

interface AiQuestion {
  question: string
  options: string[]
  answerIndex: number
  note?: string
}

interface AiResponse {
  kind: string
  questions: AiQuestion[] | null
  text: string | null
  error?: string
}

export function AiAssistant() {
  const { toast } = useToast()
  const [kind, setKind] = useState<string>('KUIS')
  const [surah, setSurah] = useState('')
  const [ayat, setAyat] = useState('')
  const [level, setLevel] = useState<string>('Juz 30 (Tahfidz)')
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiResponse | null>(null)

  const activeKind = useMemo(() => KINDS.find((k) => k.value === kind) ?? KINDS[0], [kind])

  async function generate() {
    if (surah.trim().length < 2) {
      setError('Sebutkan nama surah terlebih dahulu (contoh: An-Naba).')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await apiSend<AiResponse>('/api/ai/assistant', 'POST', {
        kind,
        surah: surah.trim(),
        ayat: ayat.trim(),
        level,
        topic: topic.trim(),
      })
      setResult(res)
      if (res.kind === 'KUIS' && res.questions?.length) {
        toast({ title: 'Kuis siap!', description: `${res.questions.length} soal berhasil dibuat.` })
      } else if (res.text) {
        toast({ title: 'Bahan ajar siap!', description: 'Hasil AI berhasil dibuat.' })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghubungi AI. Coba lagi sebentar.')
    } finally {
      setLoading(false)
    }
  }

  function kuisPlainText(): string {
    if (!result?.questions?.length) return ''
    const lines: string[] = [`KUIS HAFALAN — ${surah}${ayat ? ` (ayat ${ayat})` : ''}`, '']
    result.questions.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.question}`)
      q.options.forEach((o) => lines.push(`   ${o}`))
      const ans = q.options[q.answerIndex] ?? '-'
      lines.push(`   Jawaban: ${ans}${q.note ? ` — ${q.note}` : ''}`)
      lines.push('')
    })
    return lines.join('\n')
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: `${label} disalin ke clipboard` })
    } catch {
      toast({ title: 'Gagal menyalin', variant: 'destructive' })
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {/* ===== Form ===== */}
      <Card className="border-emerald-100 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Sparkles className="size-4.5" />
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base text-emerald-900">Asisten AI Guru</CardTitle>
              <CardDescription>
                Generator bahan ajar — kuis hafalan, ide materi, dan rencana pembelajaran
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Jenis keluaran */}
          <div className="grid gap-2 sm:grid-cols-3">
            {KINDS.map((k) => {
              const Icon = k.icon
              const isActive = k.value === kind
              return (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => {
                    setKind(k.value)
                    setResult(null)
                    setError(null)
                  }}
                  aria-pressed={isActive}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                    isActive
                      ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-300'
                      : 'border-stone-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40'
                  }`}
                >
                  <Icon className={`mt-0.5 size-4 shrink-0 ${isActive ? 'text-emerald-700' : 'text-stone-400'}`} />
                  <span className="min-w-0">
                    <span className={`block text-sm font-semibold ${isActive ? 'text-emerald-900' : 'text-stone-700'}`}>
                      {k.label}
                    </span>
                    <span className="block text-xs text-stone-500">{k.desc}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-surah" className="text-xs font-semibold text-stone-600">
                Surah <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ai-surah"
                list="ai-surah-list"
                placeholder="cth. An-Naba"
                value={surah}
                onChange={(e) => setSurah(e.target.value)}
                maxLength={40}
              />
              <datalist id="ai-surah-list">
                {SURAH_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ai-ayat" className="text-xs font-semibold text-stone-600">
                Rentang Ayat (opsional)
              </Label>
              <Input
                id="ai-ayat"
                placeholder="cth. 1-10"
                value={ayat}
                onChange={(e) => setAyat(e.target.value)}
                maxLength={20}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-stone-600">Jenjang Santri</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih jenjang" />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="ai-topik" className="text-xs font-semibold text-stone-600">
                Fokus Tambahan (opsional)
              </Label>
              <Input
                id="ai-topik"
                placeholder="cth. fokus hukum nun sukun"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Terjadi kendala</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 break-words">{error}</span>
                <Button size="sm" variant="outline" onClick={generate} disabled={loading} className="ml-auto">
                  <RotateCcw className="size-3.5" /> Coba Lagi
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Button
            onClick={generate}
            disabled={loading}
            className="w-full bg-emerald-700 text-white hover:bg-emerald-800 sm:w-auto sm:self-start"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {loading ? 'AI sedang menyiapkan…' : `Buat ${activeKind.label}`}
          </Button>
        </CardContent>
      </Card>

      {/* ===== Hasil ===== */}
      {loading && (
        <Card className="border-dashed border-stone-200 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 className="size-6 animate-spin text-emerald-600" />
            <p className="text-sm text-stone-500">
              Menyusun {activeKind.label.toLowerCase()} untuk surah {surah}…
            </p>
          </CardContent>
        </Card>
      )}

      {result && !loading && result.kind === 'KUIS' && result.questions && result.questions.length > 0 && (
        <Card className="border-emerald-100 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex min-w-0 items-center gap-2">
              <ListChecks className="size-4 shrink-0 text-emerald-700" />
              <CardTitle className="min-w-0 truncate text-base text-emerald-900">
                Kuis: {surah}
                {ayat ? ` (ayat ${ayat})` : ''}
              </CardTitle>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => copyText(kuisPlainText(), 'Kuis')}>
                <Copy className="size-3.5" /> Salin Teks
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => copyText(JSON.stringify(result.questions, null, 2), 'JSON')}
              >
                <Copy className="size-3.5" /> JSON
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="flex max-h-96 list-decimal flex-col gap-4 overflow-y-auto pl-5 pr-1">
              {result.questions.map((q, i) => (
                <li key={i} className="rounded-xl border border-stone-100 bg-stone-50/60 p-3">
                  <p className="mb-2 break-words text-sm font-semibold text-stone-800">{q.question}</p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {q.options.map((opt, oi) => {
                      const correct = oi === q.answerIndex
                      return (
                        <span
                          key={oi}
                          className={`flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
                            correct
                              ? 'bg-emerald-100 font-semibold text-emerald-900 ring-1 ring-emerald-300'
                              : 'bg-white text-stone-600 ring-1 ring-stone-100'
                          }`}
                        >
                          <span className="min-w-0 break-words">{opt}</span>
                          {correct && <Badge className="ml-auto shrink-0 bg-emerald-600 text-[10px] text-white">Benar</Badge>}
                        </span>
                      )
                    })}
                  </div>
                  {q.note && <p className="mt-2 text-xs italic text-stone-500">{q.note}</p>}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      {result && !loading && result.text && (
        <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="size-4 shrink-0 text-amber-600" />
              <CardTitle className="min-w-0 truncate text-base text-amber-900">
                Hasil {activeKind.label}
              </CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => copyText(result.text || '', 'Hasil')}>
              <Copy className="size-3.5" /> Salin
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1 text-sm leading-relaxed text-stone-700">
              {result.text
                .split(/\n{2,}/)
                .filter(Boolean)
                .map((para, i) => (
                  <p key={i} className="whitespace-pre-wrap break-words">
                    {para}
                  </p>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
