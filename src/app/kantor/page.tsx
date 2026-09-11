// Halaman web 3D "Kantor AI Agent" — fitur terisolasi, tidak menyentuh
// alur operasional TPQ. (Task 51)
import type { Metadata } from 'next'
import { KantorApp } from '@/components/kantor/kantor-app'

export const metadata: Metadata = {
  title: 'Kantor AI Agent',
  description:
    'Web 3D interaktif kantor AI Agent: 7 agen divisi (Head Gemini 2.5 Flash, divisi GLM 5.3 Flash), animasi berjalan & bertemu, kamera 360°, dan fitur kritik-saran.',
}

export default function KantorPage() {
  return <KantorApp />
}
