// Halaman web 3D "Kantor AI Agent" — fitur terisolasi, tidak menyentuh
// alur operasional TPQ. (Task 51)
// Task 52 — gate akses (server-side):
//   ADMIN & DEVELOPER → akses penuh (lihat + interaksi: kritik-saran, chat AI)
//   GURU             → mode lihat saja
//   ORANG_TUA / tamu → ditolak (halaman akses terbatas)
import type { Metadata } from 'next'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { ShieldAlert, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session'
import { KantorApp } from '@/components/kantor/kantor-app'

export const metadata: Metadata = {
  title: 'Kantor AI Agent',
  description:
    'Web 3D interaktif kantor AI Agent: 7 agen divisi (Head Gemini 3.6 Flash + mode agent Antigravity, divisi GLM 5.3 Flash), animasi berjalan & bertemu, kamera 360°, dan fitur kritik-saran.',
}

export default async function KantorPage() {
  const store = await cookies()
  const session = await verifySessionToken(store.get(SESSION_COOKIE)?.value)

  // Hanya ADMIN, DEVELOPER (akses penuh) dan GURU (lihat saja) yang boleh masuk.
  if (!session || session.role === 'ORANG_TUA') {
    return <AccessDenied loggedIn={!!session} />
  }

  const access = session.role === 'GURU' ? 'view' : 'full'
  return <KantorApp access={access} userName={session.name} />
}

function AccessDenied({ loggedIn }: { loggedIn: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-100 px-4" data-testid="akses-terbatas">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="mt-4 flex items-center justify-center gap-2 text-lg font-bold text-stone-900">
          <Sparkles className="h-4 w-4 text-emerald-700" /> Akses Terbatas
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          Kantor AI Agent hanya bisa dilihat & diakses oleh <strong>Admin</strong> dan{' '}
          <strong>Developer</strong>. Guru dapat masuk dengan mode <em>lihat saja</em>.
        </p>
        {!loggedIn && (
          <p className="mt-1 text-xs text-stone-500">
            Silakan login terlebih dahulu melalui portal.
          </p>
        )}
        <Button asChild className="mt-5 w-full bg-emerald-700 text-white hover:bg-emerald-800">
          <Link href="/">Ke Portal &amp; Login</Link>
        </Button>
      </div>
    </div>
  )
}
