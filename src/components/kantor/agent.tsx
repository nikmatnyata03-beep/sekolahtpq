'use client'
// Agent procedural stylized (humanoid low-poly dari primitif) + state machine
// IDLE (napas/ktur mikir) → WALK (waypoint) → ACT (talk + chat bubble) → pulang.
// Animasi 100% via useFrame — tanpa aset GLB eksternal. (Task 51)
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { registerAgent, type AgentController, type WalkOptions } from './agent-registry'

interface AgentState {
  mode: 'IDLE' | 'WALK' | 'ACT'
  from: THREE.Vector3
  to: THREE.Vector3
  t: number
  dur: number
  faceTo: [number, number] | null
  onArrive: (() => void) | null
  talkUntil: number
  dialog: string
  folder: boolean
  phase: number
}

const SPEED = 1.5 // m/s

function dampAngle(cur: number, target: number, lambda: number, dt: number): number {
  const d = Math.atan2(Math.sin(target - cur), Math.cos(target - cur))
  return cur + d * (1 - Math.exp(-lambda * dt))
}

export function Agent({
  division,
  name,
  color,
  accent,
  badge,
  home,
  isHead,
}: {
  division: string
  name: string
  color: string
  accent: string
  badge: string
  home: [number, number]
  isHead?: boolean
}) {
  const group = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Mesh>(null)
  const head = useRef<THREE.Group>(null)
  const [bubble, setBubble] = useState<string | null>(null)
  const [folderVisible, setFolderVisible] = useState(false)

  const st = useRef<AgentState>({
    mode: 'IDLE',
    from: new THREE.Vector3(),
    to: new THREE.Vector3(),
    t: 0,
    dur: 0,
    faceTo: null,
    onArrive: null,
    talkUntil: 0,
    dialog: '',
    folder: false,
    phase: 0,
  })

  const controller: AgentController = useMemo(
    () => ({
      division,
      isFree: () => st.current.mode === 'IDLE',
      walkTo: (opts: WalkOptions) => {
        const s = st.current
        if (!group.current) return
        s.mode = 'WALK'
        s.from.copy(group.current.position)
        s.to.set(opts.x, 0, opts.z)
        s.dur = Math.max(0.4, s.from.distanceTo(s.to) / SPEED)
        s.t = 0
        s.faceTo = opts.faceTo ?? null
        s.onArrive = opts.onArrive ?? null
        s.dialog = opts.dialog ?? ''
        s.folder = opts.folder ?? false
        setFolderVisible(s.folder)
        setBubble(null)
      },
      talk: (seconds: number, dialog?: string) => {
        const s = st.current
        s.mode = 'ACT'
        s.talkUntil = performance.now() / 1000 + seconds
        setBubble(dialog ?? '…')
      },
      goHome: () => {
        const s = st.current
        s.mode = 'WALK'
        s.from.copy(group.current?.position ?? new THREE.Vector3())
        s.to.set(home[0], 0, home[1])
        s.dur = Math.max(0.4, s.from.distanceTo(s.to) / SPEED)
        s.t = 0
        s.faceTo = null
        s.onArrive = null
        s.dialog = ''
        s.folder = false
        setFolderVisible(false)
        setBubble(null)
      },
    }),
    [division, home],
  )

  useEffect(() => registerAgent(controller), [controller])

  useFrame((state, dt) => {
    const s = st.current
    const g = group.current
    if (!g) return
    const now = state.clock.elapsedTime
    const perfNow = performance.now() / 1000

    if (s.mode === 'WALK') {
      s.t += dt
      const k = Math.min(1, s.t / s.dur)
      const eased = k < 1 ? k * k * (3 - 2 * k) : 1 // smoothstep
      g.position.set(
        s.from.x + (s.to.x - s.from.x) * eased,
        Math.abs(Math.sin(s.phase * 1.0)) * 0.035,
        s.from.z + (s.to.z - s.from.z) * eased,
      )
      // hadap arah jalan
      const heading = Math.atan2(s.to.x - s.from.x, s.to.z - s.from.z)
      g.rotation.y = dampAngle(g.rotation.y, heading, 10, dt)
      // siklus jalan
      s.phase += dt * 9
      const swing = Math.sin(s.phase) * 0.55
      if (legL.current) legL.current.rotation.x = swing
      if (legR.current) legR.current.rotation.x = -swing
      if (armL.current) armL.current.rotation.x = -swing * 0.7
      if (armR.current) armR.current.rotation.x = swing * 0.7
      if (k >= 1) {
        g.position.set(s.to.x, 0, s.to.z)
        s.mode = s.dialog ? 'ACT' : 'IDLE'
        s.phase = 0
        if (s.faceTo) {
          g.rotation.y = Math.atan2(s.faceTo[0] - s.to.x, s.faceTo[1] - s.to.z)
          s.faceTo = null
        }
        if (s.dialog) {
          s.talkUntil = perfNow + 4.5
          setBubble(s.dialog)
          s.dialog = ''
        }
        s.onArrive?.()
        s.onArrive = null
      }
    } else if (s.mode === 'ACT') {
      // gestur bicara: lengan kanan terangkat + badan sedikit condong
      const wob = Math.sin(now * 6)
      if (armR.current) armR.current.rotation.x = -1.7 + wob * 0.28
      if (armL.current) armL.current.rotation.x = -0.25 + wob * 0.1
      if (legL.current) legL.current.rotation.x = 0
      if (legR.current) legR.current.rotation.x = 0
      if (head.current) head.current.rotation.y = Math.sin(now * 2.2) * 0.12
      if (perfNow > s.talkUntil) {
        setBubble(null)
        s.mode = 'IDLE'
        controller.goHome()
      }
    } else {
      // IDLE: napas + tatap sekitar
      const breathe = 1 + Math.sin(now * 2.1) * 0.018
      if (torso.current) torso.current.scale.set(1, breathe, 1)
      if (head.current) {
        head.current.rotation.y = Math.sin(now * 0.55 + home[0]) * 0.18
        head.current.rotation.x = Math.sin(now * 0.4) * 0.04
      }
      if (armL.current) armL.current.rotation.x = Math.sin(now * 2.1) * 0.045
      if (armR.current) armR.current.rotation.x = -Math.sin(now * 2.1) * 0.045
      if (legL.current) legL.current.rotation.x = 0
      if (legR.current) legR.current.rotation.x = 0
      g.position.y = 0
    }
  })

  return (
    <group ref={group} position={[home[0], 0, home[1]]} rotation-y={0} scale={isHead ? 1.07 : 1} data-testid={`agent-${division}`}>
      {/* Kaki (pivot di pinggul) */}
      <group ref={legL} position={[-0.085, 0.4, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.24, 3, 8]} />
          <meshStandardMaterial color="#292524" roughness={0.8} />
        </mesh>
      </group>
      <group ref={legR} position={[0.085, 0.4, 0]}>
        <mesh position={[0, -0.19, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.24, 3, 8]} />
          <meshStandardMaterial color="#292524" roughness={0.8} />
        </mesh>
      </group>

      {/* Torso (vest warna divisi) */}
      <mesh ref={torso} position={[0, 0.72, 0]} castShadow>
        <capsuleGeometry args={[0.185, 0.3, 4, 12]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      {/* Kemeja + ikat pinggang */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.19, 0.2, 0.1, 14]} />
        <meshStandardMaterial color="#292524" roughness={0.7} />
      </mesh>
      {isHead && (
        <mesh position={[0, 0.86, 0.145]}>
          <boxGeometry args={[0.055, 0.3, 0.02]} />
          <meshStandardMaterial color="#7c2d12" roughness={0.5} />
        </mesh>
      )}

      {/* Lengan (pivot di bahu) */}
      <group ref={armL} position={[-0.26, 0.98, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.05, 0.22, 3, 8]} />
          <meshStandardMaterial color={color} roughness={0.65} />
        </mesh>
        <mesh position={[0, -0.31, 0]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshStandardMaterial color="#f3c29e" roughness={0.7} />
        </mesh>
      </group>
      <group ref={armR} position={[0.26, 0.98, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.05, 0.22, 3, 8]} />
          <meshStandardMaterial color={color} roughness={0.65} />
        </mesh>
        <mesh position={[0, -0.31, 0]}>
          <sphereGeometry args={[0.05, 10, 10]} />
          <meshStandardMaterial color="#f3c29e" roughness={0.7} />
        </mesh>
        {/* Folder dokumen di tangan kanan */}
        {folderVisible && (
          <mesh position={[0.02, -0.36, 0.08]} rotation-x={0.4}>
            <boxGeometry args={[0.16, 0.02, 0.22]} />
            <meshStandardMaterial color="#b45309" roughness={0.6} />
          </mesh>
        )}
      </group>
      {isHead && (
        <>
          <mesh position={[-0.26, 1.03, 0]}>
            <boxGeometry args={[0.09, 0.03, 0.09]} />
            <meshStandardMaterial color="#eab308" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0.26, 1.03, 0]}>
            <boxGeometry args={[0.09, 0.03, 0.09]} />
            <meshStandardMaterial color="#eab308" metalness={0.7} roughness={0.3} />
          </mesh>
        </>
      )}

      {/* Kepala + wajah + peci */}
      <group ref={head} position={[0, 1.06, 0]}>
        <group position={[0, 0.22, 0]}>
          <mesh castShadow>
            <sphereGeometry args={[0.155, 18, 18]} />
            <meshStandardMaterial color="#f3c29e" roughness={0.7} />
          </mesh>
          <mesh position={[-0.055, 0.02, 0.135]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial color="#1c1917" />
          </mesh>
          <mesh position={[0.055, 0.02, 0.135]}>
            <sphereGeometry args={[0.018, 8, 8]} />
            <meshStandardMaterial color="#1c1917" />
          </mesh>
          {/* Peci */}
          <mesh position={[0, 0.115, 0]}>
            <cylinderGeometry args={[0.155, 0.16, 0.09, 16]} />
            <meshStandardMaterial color={isHead ? '#0c0a09' : '#1c1917'} roughness={0.85} />
          </mesh>
          {isHead && (
            <mesh position={[0, 0.075, 0]}>
              <cylinderGeometry args={[0.162, 0.162, 0.02, 16]} />
              <meshStandardMaterial color="#eab308" metalness={0.8} roughness={0.25} />
            </mesh>
          )}
        </group>
      </group>

      {/* Name-tag + badge model AI */}
      <Html position={[0, 1.72, 0]} center distanceFactor={9} style={{ pointerEvents: 'none' }} zIndexRange={[15, 0]}>
        <div className="pointer-events-none flex select-none flex-col items-center gap-0.5" data-testid={`nametag-${division}`}>
          <div className="whitespace-nowrap rounded-md border-2 bg-white/95 px-2 py-0.5 text-[11px] font-bold text-stone-800 shadow" style={{ borderColor: color }}>
            {name}
          </div>
          <div className="whitespace-nowrap rounded-full px-1.5 py-[1px] text-[9px] font-semibold text-white shadow" style={{ background: color }}>
            {badge}
          </div>
        </div>
      </Html>

      {/* Chat bubble */}
      {bubble && (
        <Html position={[0, 2.14, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }} zIndexRange={[16, 10]}>
          <div
            data-testid={`bubble-${division}`}
            className="pointer-events-none max-w-[190px] whitespace-nowrap rounded-xl border-2 bg-white px-3 py-1.5 text-center text-[11px] font-medium text-stone-800 shadow-lg"
            style={{ borderColor: accent }}
          >
            {bubble}
          </div>
        </Html>
      )}
    </group>
  )
}
