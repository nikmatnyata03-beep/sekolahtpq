'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  BookMarked,
  RefreshCw,
  AlertCircle,
  Inbox,
  Plus,
  Trash2,
  Loader2,
} from 'lucide-react'
import type { Hafalan, Student } from '@/lib/types'
import { apiGet, apiSend, formatShortDate } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const SURAH_LIST = [
  'An-Naba', "An-Nazi'at", 'Abasa', 'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin', 'Al-Insyiqaq',
  'Al-Buruj', 'Ath-Thariq', "Al-A'la", 'Al-Ghasyiyah', 'Al-Fajr', 'Al-Balad', 'Asy-Syams',
  'Al-Lail', 'Ad-Duha', 'Al-Insyirah', 'Al-Bayyinah', 'Al-Qadr', 'Al-Alaq', 'At-Tin',
  'Al-Isyroq', "Al-Ma'un", 'Al-Kautsar', 'Al-Kafirun', 'An-Nasr', 'Al-Lahab', 'Al-Ikhlas',
  'Al-Falaq', 'An-Nas', 'Al-Fatihah',
]

const TYPES = [
  { value: 'TAHFIDZ', label: 'Tahfidz (Setoran Baru)' },
  { value: 'TAHSHIN', label: 'Tahshin (Perbaikan)' },
  { value: 'MURAJAAH', label: 'Murajaah (Pengulangan)' },
]

function typeBadgeClass(type: string): string {
  if (type === 'TAHFIDZ') return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  if (type === 'TAHSHIN') return 'border-amber-200 bg-amber-100 text-amber-800'
  return 'border-teal-200 bg-teal-100 text-teal-800'
}

function gradeClass(grade: number | null): string {
  if (grade === null) return 'text-stone-400'
  if (grade >= 85) return 'font-bold text-emerald-700'
  if (grade >= 70) return 'font-bold text-amber-600'
  return 'font-bold text-red-600'
}

export function HafalanAdmin() {
  const { toast } = useToast()
  const [hafalans, setHafalans] = useState<Hafalan[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Hafalan | null>(null)

  const [studentId, setStudentId] = useState('none')
  const [surahName, setSurahName] = useState('')
  const [ayatRange, setAyatRange] = useState('')
  const [type, setType] = useState('TAHFIDZ')
  const [grade, setGrade] = useState('')
  const [teacherNote, setTeacherNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [h, s] = await Promise.all([
        apiGet<Hafalan[]>('/api/hafalan'),
        apiGet<Student[]>('/api/students'),
      ])
      setHafalans(h)
      setStudents(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data hafalan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function submit() {
    if (studentId === 'none') {
      toast({ title: 'Pilih santri', description: 'Tentukan santri yang menyetor hafalan.' })
      return
    }
    if (!surahName.trim()) {
      toast({ title: 'Nama surah wajib diisi', description: 'Masukkan nama surah yang disetor.' })
      return
    }
    setIsPending(true)
    try {
      await apiSend('/api/hafalan', 'POST', {
        studentId,
        surahName: surahName.trim(),
        ayatRange: ayatRange.trim() || undefined,
        type,
        grade: grade === '' ? undefined : Number(grade),
        teacherNote: teacherNote.trim() || undefined,
      })
      toast({
        title: 'Setoran hafalan dicatat',
        description: 'Progres hafalan santri diperbarui dan notifikasi WhatsApp terkirim ke wali.',
      })
      setSurahName('')
      setAyatRange('')
      setGrade('')
      setTeacherNote('')
      await load()
    } catch (e) {
      toast({ title: 'Gagal mencatat hafalan', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  async function submitDelete() {
    if (!deleteTarget) return
    setIsPending(true)
    try {
      await apiSend(`/api/hafalan?id=${deleteTarget.id}`, 'DELETE')
      toast({ title: 'Catatan dihapus', description: `Setoran ${deleteTarget.surahName} telah dihapus.` })
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast({ title: 'Gagal menghapus', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
      setDeleteTarget(null)
    } finally {
      setIsPending(false)
    }
  }

  const selectedStudent = students.find((s) => s.id === studentId)

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="size-4" />
          <AlertTitle>Gagal memuat data hafalan</AlertTitle>
          <AlertDescription>
            {error}
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={() => void load()}>
                <RefreshCw className="size-4" /> Coba Lagi
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Form catat setoran */}
        <Card className="rounded-2xl border-stone-200 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4 text-emerald-700" /> Catat Setoran Hafalan
            </CardTitle>
            <CardDescription>Progres terkirim otomatis ke wali via WhatsApp.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-1.5">
              <Label>Santri</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Pilih santri" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Pilih santri —</SelectItem>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.fullName}{s.class ? ` · ${s.class.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedStudent && (
                <p className="text-xs text-stone-500">
                  Kelas: {selectedStudent.class?.name ?? '—'}
                </p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="h-surah">Nama Surah *</Label>
              <Input
                id="h-surah"
                list="surah-juz-30"
                value={surahName}
                onChange={(e) => setSurahName(e.target.value)}
                placeholder="Ketik atau pilih surah…"
              />
              <datalist id="surah-juz-30">
                {SURAH_LIST.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="h-ayat">Rentang Ayat</Label>
                <Input id="h-ayat" value={ayatRange} onChange={(e) => setAyatRange(e.target.value)} placeholder="1-20" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="h-grade">Nilai (0–100)</Label>
                <Input
                  id="h-grade"
                  type="number"
                  min={0}
                  max={100}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="85"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Jenis Setoran</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="h-note">Catatan Guru</Label>
              <Textarea
                id="h-note"
                rows={2}
                value={teacherNote}
                onChange={(e) => setTeacherNote(e.target.value)}
                placeholder="Masukan tajwid, kelancaran, dsb."
              />
            </div>
            <Button onClick={() => void submit()} disabled={isPending} className="w-full bg-emerald-700 hover:bg-emerald-800">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <BookMarked className="size-4" />} Simpan Setoran
            </Button>
          </CardContent>
        </Card>

        {/* Riwayat */}
        <Card className="rounded-2xl border-stone-200 py-0 shadow-sm lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
            <div>
              <h3 className="font-semibold text-stone-900">Riwayat Setoran</h3>
              <p className="text-xs text-stone-500">{hafalans.length} catatan hafalan</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} /> Muat Ulang
            </Button>
          </div>
          {loading ? (
            <div className="p-4"><Skeleton className="h-72 rounded-xl" /></div>
          ) : hafalans.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <Inbox className="size-9 text-stone-300" />
              <p className="font-medium text-stone-600">Belum ada setoran hafalan</p>
              <p className="text-sm text-stone-400">Catat setoran pertama melalui formulir di samping.</p>
            </div>
          ) : (
            <div className="p-4 pt-2">
              <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow className="bg-stone-50/60 hover:bg-stone-50/60">
                      <TableHead>Santri</TableHead>
                      <TableHead>Surah</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Nilai</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hafalans.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>
                          <p className="font-medium text-stone-800">{h.student?.fullName ?? '—'}</p>
                          <p className="text-xs text-stone-500">{h.student?.className ?? h.student?.nis ?? ''}</p>
                        </TableCell>
                        <TableCell className="text-sm text-stone-700">
                          {h.surahName} <span className="text-xs text-stone-400">{h.ayatRange}</span>
                        </TableCell>
                        <TableCell><Badge className={typeBadgeClass(h.type)}>{h.type}</Badge></TableCell>
                        <TableCell><span className={gradeClass(h.grade)}>{h.grade ?? '—'}</span></TableCell>
                        <TableCell className="max-w-44 truncate text-xs text-stone-500">{h.teacherNote ?? '—'}</TableCell>
                        <TableCell className="text-sm text-stone-600">{formatShortDate(h.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-stone-400 hover:text-red-600"
                            onClick={() => setDeleteTarget(h)}
                            aria-label="Hapus catatan"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* AlertDialog Hapus */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus catatan hafalan?</AlertDialogTitle>
            <AlertDialogDescription>
              Setoran {deleteTarget?.surahName} {deleteTarget?.ayatRange} akan dihapus permanen dari riwayat santri.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void submitDelete() }}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isPending}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />} Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
