'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Newspaper,
  Megaphone,
  RefreshCw,
  AlertCircle,
  Inbox,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MessageCircle,
} from 'lucide-react'
import type { Announcement, Post, Teacher } from '@/lib/types'
import { apiGet, apiSend, formatShortDate } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

const CATEGORIES = [
  { value: 'BERITA', label: 'Berita' },
  { value: 'ARTIKEL', label: 'Artikel' },
  { value: 'KEGIATAN', label: 'Kegiatan' },
]

function categoryBadgeClass(category: string): string {
  if (category === 'BERITA') return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  if (category === 'ARTIKEL') return 'border-violet-200 bg-violet-100 text-violet-800'
  return 'border-amber-200 bg-amber-100 text-amber-800'
}

interface PostFormState {
  title: string
  category: string
  coverImage: string
  content: string
  published: boolean
  authorId: string
}

const EMPTY_POST: PostFormState = {
  title: '',
  category: 'BERITA',
  coverImage: '',
  content: '',
  published: false,
  authorId: 'none',
}

export function ContentAdmin() {
  const { toast } = useToast()
  const [posts, setPosts] = useState<Post[]>([])
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [postOpen, setPostOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<Post | null>(null)
  const [postForm, setPostForm] = useState<PostFormState>(EMPTY_POST)
  const [deletePost, setDeletePost] = useState<Post | null>(null)

  const [annOpen, setAnnOpen] = useState(false)
  const [annTitle, setAnnTitle] = useState('')
  const [annContent, setAnnContent] = useState('')
  const [annPriority, setAnnPriority] = useState('NORMAL')
  const [annBroadcast, setAnnBroadcast] = useState(false)
  const [deleteAnn, setDeleteAnn] = useState<Announcement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [p, a, t] = await Promise.all([
        apiGet<Post[]>('/api/posts'),
        apiGet<Announcement[]>('/api/announcements'),
        apiGet<Teacher[]>('/api/teachers'),
      ])
      setPosts(p)
      setAnnouncements(a)
      setTeachers(t)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat konten')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreatePost() {
    setEditingPost(null)
    setPostForm(EMPTY_POST)
    setPostOpen(true)
  }

  function openEditPost(p: Post) {
    setEditingPost(p)
    setPostForm({
      title: p.title,
      category: p.category,
      coverImage: p.coverImage ?? '',
      content: p.content,
      published: p.published,
      authorId: p.authorId ?? 'none',
    })
    setPostOpen(true)
  }

  async function submitPost() {
    if (!postForm.title.trim() || !postForm.content.trim()) {
      toast({ title: 'Data belum lengkap', description: 'Judul dan konten artikel wajib diisi.' })
      return
    }
    setIsPending(true)
    const payload = {
      title: postForm.title.trim(),
      category: postForm.category,
      coverImage: postForm.coverImage.trim() || null,
      content: postForm.content,
      published: postForm.published,
      authorId: postForm.authorId === 'none' ? null : postForm.authorId,
    }
    try {
      if (editingPost) {
        await apiSend('/api/posts', 'PUT', { id: editingPost.id, ...payload })
        toast({ title: 'Artikel diperbarui', description: `Perubahan pada "${payload.title}" telah disimpan.` })
      } else {
        await apiSend('/api/posts', 'POST', payload)
        toast({ title: 'Artikel ditulis', description: `"${payload.title}" berhasil${payload.published ? ' dipublikasikan' : ' disimpan sebagai draf'}.` })
      }
      setPostOpen(false)
      await load()
    } catch (e) {
      toast({ title: editingPost ? 'Gagal memperbarui' : 'Gagal menulis artikel', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  async function togglePublished(p: Post, published: boolean) {
    setBusyId(p.id)
    try {
      await apiSend('/api/posts', 'PUT', { id: p.id, published })
      toast({ title: published ? 'Artikel dipublikasikan' : 'Artikel dijadikan draf', description: `"${p.title}" ${published ? 'kini tampil di portal publik.' : 'disembunyikan dari portal publik.'}` })
      await load()
    } catch (e) {
      toast({ title: 'Gagal mengubah status', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setBusyId(null)
    }
  }

  async function submitDeletePost() {
    if (!deletePost) return
    setIsPending(true)
    try {
      await apiSend(`/api/posts?id=${deletePost.id}`, 'DELETE')
      toast({ title: 'Artikel dihapus', description: `"${deletePost.title}" telah dihapus.` })
      setDeletePost(null)
      await load()
    } catch (e) {
      toast({ title: 'Gagal menghapus artikel', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
      setDeletePost(null)
    } finally {
      setIsPending(false)
    }
  }

  async function submitAnnouncement() {
    if (!annTitle.trim() || !annContent.trim()) {
      toast({ title: 'Data belum lengkap', description: 'Judul dan isi pengumuman wajib diisi.' })
      return
    }
    setIsPending(true)
    try {
      await apiSend('/api/announcements', 'POST', {
        title: annTitle.trim(),
        content: annContent.trim(),
        priority: annPriority,
        broadcast: annPriority === 'PENTING' && annBroadcast,
      })
      toast({
        title: 'Pengumuman diterbitkan',
        description:
          annPriority === 'PENTING' && annBroadcast
            ? 'Pengumuman penting juga di-broadcast ke WhatsApp seluruh wali santri.'
            : 'Pengumuman kini tampil di portal wali santri.',
      })
      setAnnOpen(false)
      setAnnTitle('')
      setAnnContent('')
      setAnnPriority('NORMAL')
      setAnnBroadcast(false)
      await load()
    } catch (e) {
      toast({ title: 'Gagal menerbitkan pengumuman', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    } finally {
      setIsPending(false)
    }
  }

  async function submitDeleteAnn() {
    if (!deleteAnn) return
    setIsPending(true)
    try {
      await apiSend(`/api/announcements?id=${deleteAnn.id}`, 'DELETE')
      toast({ title: 'Pengumuman dihapus', description: `"${deleteAnn.title}" telah dihapus.` })
      setDeleteAnn(null)
      await load()
    } catch (e) {
      toast({ title: 'Gagal menghapus pengumuman', description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
      setDeleteAnn(null)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive" className="rounded-2xl">
          <AlertCircle className="size-4" />
          <AlertTitle>Gagal memuat konten</AlertTitle>
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

      <Tabs defaultValue="posts">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="posts" className="gap-1.5">
              <Newspaper className="size-3.5" /> Berita &amp; Artikel
            </TabsTrigger>
            <TabsTrigger value="announcements" className="gap-1.5">
              <Megaphone className="size-3.5" /> Pengumuman
            </TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} /> Muat Ulang
          </Button>
        </div>

        {/* TAB POSTS */}
        <TabsContent value="posts" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={openCreatePost} className="bg-emerald-700 hover:bg-emerald-800">
              <Plus className="size-4" /> Tulis Artikel
            </Button>
          </div>
          {loading ? (
            <Skeleton className="h-72 rounded-2xl" />
          ) : posts.length === 0 ? (
            <Card className="rounded-2xl border-stone-200 shadow-sm">
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                <Inbox className="size-9 text-stone-300" />
                <p className="font-medium text-stone-600">Belum ada artikel</p>
                <p className="text-sm text-stone-400">Tulis artikel atau berita pertama untuk portal publik.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl border-stone-200 py-0 shadow-sm">
              <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow className="bg-stone-50/60 hover:bg-stone-50/60">
                      <TableHead>Judul</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Penulis</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Tayang</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {posts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="max-w-64">
                          <p className="truncate font-medium text-stone-800">{p.title}</p>
                          <p className="truncate text-xs text-stone-400">{p.slug}</p>
                        </TableCell>
                        <TableCell><Badge className={categoryBadgeClass(p.category)}>{p.category}</Badge></TableCell>
                        <TableCell className="text-sm text-stone-600">{p.author?.fullName ?? '—'}</TableCell>
                        <TableCell className="text-sm text-stone-600">{formatShortDate(p.createdAt)}</TableCell>
                        <TableCell>
                          <Switch
                            checked={p.published}
                            disabled={busyId === p.id}
                            onCheckedChange={(v) => void togglePublished(p, v)}
                            aria-label="Status publikasi"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" size="sm" onClick={() => openEditPost(p)}>
                              <Pencil className="size-3.5" /> Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-8 border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => setDeletePost(p)}
                              aria-label="Hapus artikel"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* TAB ANNOUNCEMENTS */}
        <TabsContent value="announcements" className="space-y-3">
          <div className="flex justify-end">
            <Button onClick={() => setAnnOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
              <Plus className="size-4" /> Buat Pengumuman
            </Button>
          </div>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <Card className="rounded-2xl border-stone-200 shadow-sm">
              <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                <Inbox className="size-9 text-stone-300" />
                <p className="font-medium text-stone-600">Belum ada pengumuman</p>
                <p className="text-sm text-stone-400">Terbitkan pengumuman untuk wali santri.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {announcements.map((a) => (
                <Card key={a.id} className="rounded-2xl border-stone-200 shadow-sm">
                  <CardContent className="flex h-full flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-stone-900">{a.title}</h4>
                      <Badge
                        className={
                          a.priority === 'PENTING'
                            ? 'border-amber-200 bg-amber-100 text-amber-800'
                            : 'border-stone-200 bg-stone-100 text-stone-600'
                        }
                      >
                        {a.priority === 'PENTING' ? 'PENTING' : 'NORMAL'}
                      </Badge>
                    </div>
                    <p className="flex-1 whitespace-pre-line text-sm leading-relaxed text-stone-600">{a.content}</p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-stone-400">{formatShortDate(a.createdAt)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-stone-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setDeleteAnn(a)}
                      >
                        <Trash2 className="size-3.5" /> Hapus
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog Tulis/Edit Artikel */}
      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-2xl sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingPost ? 'Edit Artikel' : 'Tulis Artikel Baru'}</DialogTitle>
            <DialogDescription>
              Artikel tayang di portal publik TPQ Darul Jinan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="p-title">Judul *</Label>
              <Input id="p-title" value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} placeholder="Judul berita atau artikel" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Kategori</Label>
                <Select value={postForm.category} onValueChange={(v) => setPostForm({ ...postForm, category: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Penulis (opsional)</Label>
                <Select value={postForm.authorId} onValueChange={(v) => setPostForm({ ...postForm, authorId: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Tanpa penulis" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa penulis</SelectItem>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-cover">URL Gambar Sampul</Label>
              <Input id="p-cover" value={postForm.coverImage} onChange={(e) => setPostForm({ ...postForm, coverImage: e.target.value })} placeholder="https://…" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="p-content">Konten *</Label>
              <Textarea id="p-content" rows={8} value={postForm.content} onChange={(e) => setPostForm({ ...postForm, content: e.target.value })} placeholder="Tulis isi artikel di sini…" className="text-sm leading-relaxed" />
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={postForm.published}
                onCheckedChange={(v) => setPostForm({ ...postForm, published: v === true })}
              />
              <span className="text-sm text-stone-700">Publikasikan sekarang</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={() => void submitPost()} disabled={isPending} className="bg-emerald-700 hover:bg-emerald-800">
              {isPending && <Loader2 className="size-4 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Buat Pengumuman */}
      <Dialog open={annOpen} onOpenChange={setAnnOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="size-4 text-emerald-700" /> Buat Pengumuman
            </DialogTitle>
            <DialogDescription>Pengumuman tampil di portal wali santri.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="a-title">Judul *</Label>
              <Input id="a-title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Judul pengumuman" />
            </div>
            <div className="grid gap-1.5">
              <Label>Priority</Label>
              <Select value={annPriority} onValueChange={setAnnPriority}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="PENTING">Penting</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="a-content">Isi Pengumuman *</Label>
              <Textarea id="a-content" rows={5} value={annContent} onChange={(e) => setAnnContent(e.target.value)} placeholder="Tulis isi pengumuman…" />
            </div>
            {annPriority === 'PENTING' && (
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                <Checkbox
                  checked={annBroadcast}
                  onCheckedChange={(v) => setAnnBroadcast(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-stone-700">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <MessageCircle className="size-3.5 text-amber-600" /> Broadcast WhatsApp ke semua wali
                  </span>
                  <span className="mt-0.5 block text-xs text-stone-500">
                    Pengumuman penting dikirim langsung ke nomor WhatsApp seluruh wali santri.
                  </span>
                </span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnnOpen(false)} disabled={isPending}>Batal</Button>
            <Button onClick={() => void submitAnnouncement()} disabled={isPending} className="bg-emerald-700 hover:bg-emerald-800">
              {isPending && <Loader2 className="size-4 animate-spin" />} Terbitkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog Hapus Artikel */}
      <AlertDialog open={!!deletePost} onOpenChange={(open) => !open && setDeletePost(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus artikel ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Artikel &quot;{deletePost?.title}&quot; akan dihapus permanen dari portal publik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void submitDeletePost() }}
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isPending}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />} Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog Hapus Pengumuman */}
      <AlertDialog open={!!deleteAnn} onOpenChange={(open) => !open && setDeleteAnn(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengumuman ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Pengumuman &quot;{deleteAnn?.title}&quot; akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void submitDeleteAnn() }}
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
