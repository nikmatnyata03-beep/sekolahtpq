import type { MetadataRoute } from 'next'

// PWA manifest — portal sekolah banyak diakses via ponsel (wali santri);
// installable ke layar utama memperkuat kehadiran brand & akses cepat.
// Ikon memakai logo.svg yang sudah ada (SVG = tajam di semua ukuran).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SIMADJI — TPQ Darul Jinan',
    short_name: 'Darul Jinan',
    description:
      "Portal digital TPQ Darul Jinan: PPDB online, absensi QR, hafalan santri, dan portal wali santri.",
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#047857',
    lang: 'id',
    icons: [
      {
        src: '/logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  }
}
