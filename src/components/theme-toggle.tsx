'use client'

/**
 * Task 48 — Tombol pengalih tema (Terang / Gelap / Sistem).
 * - Ikon mengikuti tema aktif; sebelum "mounted" render ikon statis agar HTML
 *   server & client identik (tanpa hydration mismatch).
 * - Dipakai di header dashboard admin dan header portal publik.
 */
import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/** Deteksi hydration tanpa setState-in-effect: false saat SSR, true setelah mount. */
const emptySubscribe = () => () => {}
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useMounted()

  const isDark = mounted && theme === 'dark'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-9 shrink-0 rounded-xl"
          aria-label="Ganti tema tampilan"
        >
          {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="size-4" /> Terang
          {mounted && theme === 'light' && <Check className="ml-auto size-4 text-emerald-600" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="size-4" /> Gelap
          {mounted && theme === 'dark' && <Check className="ml-auto size-4 text-emerald-600" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="size-4" /> Sistem
          {mounted && theme === 'system' && <Check className="ml-auto size-4 text-emerald-600" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
