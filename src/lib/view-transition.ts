// Gelombang 7 (#9 matriks riset) — View Transitions API util.
//
// Membungkus pembaruan state React dalam document.startViewTransition agar
// perpindahan section SPA teranimasi (cross-fade + slide halus, lihat
// ::view-transition-* di globals.css). Browser tanpa dukungan → pembaruan
// dijalankan langsung (hard cut, graceful degradation).
//
// flushSync di dalam callback startViewTransition adalah pola resmi agar
// pembaruan DOM selesai sinkron sebelum snapshot "new" diambil (React 19 /
// Next.js 16 view transitions). Dipanggil hanya dari event handler.
import { flushSync } from 'react-dom'

type StartViewTransition = (updateCallback: () => void) => unknown

export function withViewTransition(update: () => void): void {
  if (typeof document === 'undefined') {
    update()
    return
  }
  const d = document as Document & { startViewTransition?: StartViewTransition }
  if (typeof d.startViewTransition !== 'function') {
    update()
    return
  }
  try {
    d.startViewTransition(() => flushSync(update))
  } catch {
    // flushSync dari konteks yang tidak aman (mis. render/effect) → fallback tanpa animasi
    update()
  }
}
