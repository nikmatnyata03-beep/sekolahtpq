'use client'
// Registry imperative controller tiap agent 3D — dipakai Director untuk
// memerintahkan WALK/MEET/TALK tanpa React re-render per-frame.
export interface WalkOptions {
  x: number
  z: number
  /** teks chat bubble saat tiba (mode talk sampai resume diberikan) */
  dialog?: string
  /** tampilkan folder dokumen di tangan */
  folder?: boolean
  /** hadap ke posisi ini saat tiba (x,z) */
  faceTo?: [number, number]
  onArrive?: () => void
}

export interface AgentController {
  division: string
  isFree: () => boolean
  walkTo: (opts: WalkOptions) => void
  /** bicara selama N detik (dipakai saat sudah di tempat) */
  talk: (seconds: number, dialog?: string) => void
  goHome: () => void
}

const registry = new Map<string, AgentController>()

export function registerAgent(controller: AgentController): () => void {
  registry.set(controller.division, controller)
  return () => registry.delete(controller.division)
}

export function getAgent(division: string): AgentController | undefined {
  return registry.get(division)
}

export function allAgents(): AgentController[] {
  return [...registry.values()]
}

/** Dispatch global — dipanggil panel feedback, didengar Director di dalam Canvas. */
export function dispatchFeedbackAnimation(divisionId: string): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kantor:feedback', { detail: { division: divisionId } }))
  }
}
