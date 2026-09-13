import Link from 'next/link'
import { MoonStar } from 'lucide-react'

// 404 kustom berbahasa Indonesia — halaman default Next berbahasa Inggris dan
// tidak berbrand. Tetap ringan (tanpa animasi berat), konsisten dengan identitas
// hijau zamrud + emas portal.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-stone-50 px-4 text-center">
      <span
        className="flex size-16 items-center justify-center rounded-2xl text-white shadow-lg"
        style={{ backgroundImage: 'linear-gradient(to bottom right, #065f46, #047857)' }}
        aria-hidden="true"
      >
        <MoonStar className="size-8" />
      </span>

      <div className="space-y-2">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-600">Error 404</p>
        <h1 className="text-2xl font-extrabold tracking-tight text-emerald-900 md:text-3xl">
          Halaman tidak ditemukan
        </h1>
        <p className="mx-auto max-w-md text-sm leading-relaxed text-stone-500">
          Maaf, halaman yang Anda cari tidak ada atau sudah dipindahkan. Silakan kembali ke
          beranda portal TPQ Darul Jinan.
        </p>
      </div>

      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-emerald-800"
      >
        Kembali ke Beranda
      </Link>
    </main>
  )
}
