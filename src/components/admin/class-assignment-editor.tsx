'use client'

/**
 * Komponen bersama "Kelas yang Diampu" (Task 36 + Task 40).
 * Dipakai di:
 *  - teachers-admin.tsx  (form profil guru — tambah & edit)
 *  - users-admin.tsx     (form akun — role Guru, agar admin bisa langsung
 *                         memilih kelas & jenjang saat menambah akun guru)
 *
 * Checkbox dikelompokkan per jenjang. Kelas yang sudah punya pengampu lain
 * tetap bisa diambil alih — ditandai jelas agar admin sadar penugasan berpindah.
 */
import { CheckSquare } from 'lucide-react'
import type { ClassRoom } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

// Label jenjang kelas (konsisten dengan menu Kelas)
const LEVEL_LABELS: Record<string, string> = {
  IQRA: 'Iqra',
  TAHFIDZ: 'Tahfidz',
  AL_QURAN: 'Al-Quran',
}

export function levelLabel(level: string): string {
  return LEVEL_LABELS[level] ?? level.replace('_', ' ')
}

export function ClassAssignmentEditor({
  classes,
  selected,
  onChange,
}: {
  classes: ClassRoom[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const groups = Array.from(new Set(classes.map((c) => c.level)))
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((v) => v !== id) : [...selected, id])
  }
  if (classes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50/50 p-3">
        <p className="text-sm text-stone-500">
          Belum ada kelas terdaftar. Buat kelas terlebih dahulu di menu <span className="font-medium">Kelas</span>.
        </p>
      </div>
    )
  }
  return (
    <div className="max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50/50 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-stone-700">Kelas yang Diampu</p>
          <p className="text-xs text-stone-500">Centang kelas yang diamanahkan. Guru bisa mengampu lebih dari satu kelas.</p>
        </div>
        <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-800">
          {selected.length} kelas
        </Badge>
      </div>
      <div className="space-y-3">
        {groups.map((level) => (
          <div key={level}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">{levelLabel(level)}</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {classes
                .filter((c) => c.level === level)
                .map((c) => {
                  const checked = selected.includes(c.id)
                  const takenByOther = c.teacherId && !checked
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => toggle(c.id)}
                      aria-pressed={checked}
                      className={cn(
                        'flex items-start gap-2 rounded-lg border p-2 text-left transition-colors',
                        checked
                          ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300'
                          : 'border-stone-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40',
                      )}
                    >
                      <CheckSquare
                        className={cn(
                          'mt-0.5 size-4 shrink-0',
                          checked ? 'text-emerald-700' : 'text-stone-300',
                        )}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-stone-800">{c.name}</span>
                        <span className="block truncate text-[11px] text-stone-500">
                          {takenByOther ? `Pengampu saat ini: ${c.teacher?.fullName ?? '—'}` : c.room || `Jadwal: ${c.schedule}`}
                        </span>
                      </span>
                      {takenByOther && (
                        <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-[10px] text-amber-800">
                          pindah
                        </Badge>
                      )}
                    </button>
                  )
                })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
