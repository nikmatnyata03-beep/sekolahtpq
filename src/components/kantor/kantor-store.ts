'use client'
// Zustand store Kantor AI Agent — state UI global (bukan data per-frame 3D).
import { create } from 'zustand'

export interface ManifestCharacter {
  id: string
  assetKey: string
  name: string
  division: string
  colorHex: string | null
  accentHex: string | null
  modelUrl: string | null
  animations: string[]
  role: string | null
  tasks: string[]
  badge: string | null
  status: string
  tasksDone: number
  feedbackCount: number
}

export interface CameraPreset {
  key: string
  pos: [number, number, number]
  look: [number, number, number]
}

interface KantorState {
  manifest: ManifestCharacter[]
  loading: boolean
  loadError: string | null
  selected: string | null // divisionId meja yang dipilih
  quality: 'HIGH' | 'LOW'
  preset: CameraPreset | null
  autoRotate: boolean
  webglOk: boolean
  setManifest: (m: ManifestCharacter[]) => void
  setLoading: (v: boolean) => void
  setLoadError: (v: string | null) => void
  select: (divisionId: string | null) => void
  setQuality: (q: 'HIGH' | 'LOW') => void
  setPreset: (p: CameraPreset | null) => void
  setAutoRotate: (v: boolean) => void
  setWebglOk: (v: boolean) => void
  bumpFeedback: (divisionId: string) => void
}

export const useKantorStore = create<KantorState>((set) => ({
  manifest: [],
  loading: true,
  loadError: null,
  selected: null,
  quality: 'HIGH',
  preset: null,
  autoRotate: false,
  webglOk: true,
  setManifest: (m) => set({ manifest: m, loading: false, loadError: null }),
  setLoading: (v) => set({ loading: v }),
  setLoadError: (v) => set({ loadError: v, loading: false }),
  select: (divisionId) => set({ selected: divisionId }),
  setQuality: (q) => set({ quality: q }),
  setPreset: (p) => set({ preset: p }),
  setAutoRotate: (v) => set({ autoRotate: v }),
  setWebglOk: (v) => set({ webglOk: v }),
  bumpFeedback: (divisionId) =>
    set((s) => ({
      manifest: s.manifest.map((c) =>
        c.division === divisionId ? { ...c, feedbackCount: c.feedbackCount + 1 } : c,
      ),
    })),
}))
