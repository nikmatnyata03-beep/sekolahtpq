'use client'

/**
 * Task 48 — Provider tema (next-themes).
 * - attribute="class": tema diaktifkan lewat class `dark` di <html> (sinkron dengan
 *   @custom-variant dark di globals.css).
 * - defaultTheme="system": ikuti preferensi OS pengguna (umumnya HP).
 * - disableTransitionOnChange: cegah flash transisi saat ganti tema.
 */
import { ThemeProvider as NextThemesProvider } from 'next-themes'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  )
}
