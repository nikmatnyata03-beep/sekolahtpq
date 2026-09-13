'use client'

// FAB WhatsApp — tombol melayang kanan-bawah portal publik (di atas
// ScrollTopFab yang memakai bottom-5). Membuka chat ke nomor WA sekretariat
// (dari CMS contact.whatsapp) dengan teks sapaan terisi otomatis via wa.me.
// Menghormati prefers-reduced-motion; disembunyikan saat cetak.

import { motion, useReducedMotion } from 'framer-motion'
import { MessageCircle } from 'lucide-react'
import { usePortalSettings } from '@/hooks/use-portal-settings'

const SALAM = "Assalamu'alaikum, saya ingin bertanya tentang TPQ Darul Jinan."

export function WhatsAppFab() {
  const reduced = useReducedMotion()
  const { settings } = usePortalSettings()
  const number = settings.contact.whatsapp.replace(/\D/g, '')
  if (!number) return null
  const href = `https://wa.me/${number}?text=${encodeURIComponent(SALAM)}`

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Hubungi sekretariat via WhatsApp — ${settings.contact.whatsapp}`}
      initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.5, y: 18 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: reduced ? 0 : 0.8 }}
      whileHover={reduced ? undefined : { scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      data-slot="whatsapp-fab"
      className="group fixed bottom-[4.75rem] right-5 z-40 flex size-13 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-900/25 ring-2 ring-white/60 transition-colors hover:bg-emerald-500 md:bottom-21 md:right-7 print:hidden"
    >
      {/* denyut lembut — dimatikan bila user memilih reduce motion */}
      {!reduced && (
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 animate-ping rounded-full bg-emerald-500/30"
        />
      )}
      <MessageCircle className="relative size-6" aria-hidden="true" />
      {/* label mengembang di layar lebar */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-[calc(100%+0.75rem)] hidden whitespace-nowrap rounded-full border border-emerald-200/70 bg-white/95 px-3.5 py-1.5 text-xs font-semibold text-emerald-900 opacity-0 shadow-md backdrop-blur transition-all duration-300 group-hover:opacity-100 lg:block"
      >
        Chat Sekretariat
      </span>
    </motion.a>
  )
}
