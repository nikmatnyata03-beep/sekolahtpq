'use client'
// Director — orkestrasi interaksi antar agent: pertemuan acak tiap ±15–30 dtk
// + animasi feedback (agen membawa laporan ke Head Office). (Task 51)
import { useEffect, useRef } from 'react'
import { allAgents, getAgent } from './agent-registry'
import { FEEDBACK_DIALOG, MEET_DIALOGS, MEET_POINT } from '@/lib/kantor/data'

export function Director() {
  const autoBusy = useRef(false)
  const pendingFeedback = useRef<string | null>(null)

  useEffect(() => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

    // ---- Laporan feedback ke Head Office — diproses via antrean agar tidak
    //      hilang saat agen masih sibuk pertemuan otomatis ----
    const tryFeedback = () => {
      const division = pendingFeedback.current
      if (!division) return
      const agent = getAgent(division)
      const head = getAgent('HEAD')
      if (!agent || !head || !agent.isFree() || !head.isFree()) return
      pendingFeedback.current = null
      let arrived = 0
      const both = (cb: () => void) => {
        if (++arrived === 2) cb()
      }
      agent.walkTo({
        x: MEET_POINT[0] - 0.55,
        z: MEET_POINT[1] + 0.25,
        dialog: FEEDBACK_DIALOG,
        folder: true,
        faceTo: [MEET_POINT[0], MEET_POINT[1] - 0.3],
        onArrive: () => both(() => head.talk(2.4, 'Terima kasih, laporannya sudah kuterima!')),
      })
      head.walkTo({
        x: MEET_POINT[0],
        z: MEET_POINT[1] - 0.3,
        faceTo: [MEET_POINT[0] - 0.55, MEET_POINT[1] + 0.25],
        onArrive: () => both(() => head.talk(2.4, 'Terima kasih, laporannya sudah kuterima!')),
      })
    }

    // ---- Pertemuan acak antar divisi (ditahan bila ada laporan menunggu) ----
    const tick = () => {
      if (autoBusy.current || pendingFeedback.current || document.hidden) return
      const free = allAgents().filter((a) => a.division !== 'HEAD' && a.isFree())
      if (free.length < 2 || Math.random() < 0.35) return
      autoBusy.current = true
      const shuffled = [...free].sort(() => Math.random() - 0.5)
      const [a, b] = [shuffled[0], shuffled[1]]
      const dialog = pick(MEET_DIALOGS)
      let arrived = 0
      const done = () => {
        if (++arrived === 2) {
          // biarkan dialog terbaca (talk 4,5 dtk auto pulang), lalu kunci lepas
          setTimeout(() => (autoBusy.current = false), 5600)
        }
      }
      a.walkTo({ x: MEET_POINT[0] - 0.55, z: MEET_POINT[1], dialog, faceTo: [MEET_POINT[0] + 0.55, MEET_POINT[1]], onArrive: done })
      b.walkTo({ x: MEET_POINT[0] + 0.55, z: MEET_POINT[1], dialog, faceTo: [MEET_POINT[0] - 0.55, MEET_POINT[1]], onArrive: done })
    }

    const onFeedback = (e: Event) => {
      const division = (e as CustomEvent).detail?.division as string | undefined
      if (division) pendingFeedback.current = division
    }

    const iv = setInterval(tick, 9000)
    const ivFeedback = setInterval(tryFeedback, 1500)
    window.addEventListener('kantor:feedback', onFeedback)
    return () => {
      clearInterval(iv)
      clearInterval(ivFeedback)
      window.removeEventListener('kantor:feedback', onFeedback)
    }
  }, [])

  return null
}
