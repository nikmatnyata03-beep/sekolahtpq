'use client'
// Kantor procedural low-poly — lantai, dinding, jendela, 7 meja divisi,
// podium head, tanaman, whiteboard, rak buku, lampu gantung. (Task 51)
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { KANTOR_CHARACTERS, DIVISION_LABELS } from '@/lib/kantor/data'
import { useKantorStore } from './kantor-store'

const FLOOR_COLOR = '#b08968'
const WALL_COLOR = '#eae5df'
const WOOD_DARK = '#7c5c44'

export function Office({ onSelect }: { onSelect: (division: string) => void }) {
  const quality = useKantorStore((s) => s.quality)
  const high = quality === 'HIGH'

  return (
    <group>
      {/* Lantai kayu */}
      <mesh receiveShadow={high} position={[0, 0, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[14, 10]} />
        <meshStandardMaterial color={FLOOR_COLOR} roughness={0.85} />
      </mesh>
      {/* Karpet emerald area podium */}
      <mesh receiveShadow={high} position={[0, 0.01, -2.6]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[2.5, 40]} />
        <meshStandardMaterial color="#0f766e" roughness={0.95} />
      </mesh>
      <mesh receiveShadow={high} position={[0, 0.008, 1.4]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[3.4, 40]} />
        <meshStandardMaterial color="#d6c7ae" roughness={0.95} />
      </mesh>

      {/* Dinding belakang + samping */}
      <mesh position={[0, 1.75, -5]} receiveShadow={high}>
        <boxGeometry args={[14, 3.5, 0.2]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
      </mesh>
      <mesh position={[-7, 1.75, 0]} receiveShadow={high}>
        <boxGeometry args={[0.2, 3.5, 10]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
      </mesh>
      <mesh position={[7, 1.75, 0]} receiveShadow={high}>
        <boxGeometry args={[0.2, 3.5, 10]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
      </mesh>

      {/* Jendela besar di dinding kiri (emissive = cahaya hari) */}
      <WindowPanel position={[-6.88, 1.9, -2.2]} />
      <WindowPanel position={[-6.88, 1.9, 1.6]} />
      {/* Pintu kaca depan */}
      <GlassDoor />

      {/* Sign nama kantor */}
      <Html position={[0, 2.9, -4.85]} center transform distanceFactor={9} style={{ pointerEvents: 'none' }} data-testid="sign-kantor">
        <div className="whitespace-nowrap rounded-xl border border-amber-200 bg-stone-900/90 px-6 py-2 text-2xl font-bold tracking-widest text-amber-300 shadow-xl">
          KANTOR AI AGENT
        </div>
      </Html>

      {/* Whiteboard */}
      <Whiteboard position={[-3.4, 1.9, -4.87]} />
      {/* Rak buku di dinding kanan */}
      <Bookshelf position={[6.6, 0, -3.2]} />

      {/* Tanaman */}
      <Plant position={[-6.2, 0, -4.2]} />
      <Plant position={[6.2, 0, 3.9]} />
      <Plant position={[-6.2, 0, 3.9]} />

      {/* Lampu gantung */}
      <Pendant position={[-3, 3.2, 0.6]} />
      <Pendant position={[3, 3.2, 0.6]} />
      <Pendant position={[0, 3.2, -2.8]} />

      {/* Podium + meja head */}
      <mesh position={[0, 0.12, -3.6]} receiveShadow={high}>
        <boxGeometry args={[3.0, 0.24, 1.8]} />
        <meshStandardMaterial color="#cbb79a" roughness={0.8} />
      </mesh>
      <HeadDesk onSelect={onSelect} />

      {/* Meja 6 divisi */}
      {KANTOR_CHARACTERS.filter((c) => c.division !== 'HEAD').map((c) => (
        <Desk key={c.assetKey} division={c.division} color={c.colorHex ?? '#10b981'} position={c.desk} onSelect={onSelect} />
      ))}
    </group>
  )
}

function WindowPanel({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.08, 1.7, 2.6]} />
        <meshStandardMaterial color="#fefce8" emissive="#fef9c3" emissiveIntensity={0.85} />
      </mesh>
      <mesh position={[0.02, 0, 0]}>
        <boxGeometry args={[0.1, 1.78, 0.08]} />
        <meshStandardMaterial color="#d6d3d1" />
      </mesh>
      <mesh position={[0.02, 0, 0]}>
        <boxGeometry args={[0.1, 0.08, 2.68]} />
        <meshStandardMaterial color="#d6d3d1" />
      </mesh>
    </group>
  )
}

function GlassDoor() {
  return (
    <group position={[0, 0, 5]}>
      <mesh position={[-1.05, 1.25, 0]}>
        <boxGeometry args={[0.9, 2.5, 0.15]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
      </mesh>
      <mesh position={[1.05, 1.25, 0]}>
        <boxGeometry args={[0.9, 2.5, 0.15]} />
        <meshStandardMaterial color={WALL_COLOR} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[1.2, 2.5, 0.06]} />
        <meshStandardMaterial color="#e0f2fe" transparent opacity={0.35} roughness={0.15} metalness={0.1} />
      </mesh>
    </group>
  )
}

function Pendant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 1.4, 6]} />
        <meshStandardMaterial color="#57534e" />
      </mesh>
      <mesh>
        <coneGeometry args={[0.3, 0.26, 20]} />
        <meshStandardMaterial color="#44403c" roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.14, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#fef9c3" emissive="#fde68a" emissiveIntensity={2.2} />
      </mesh>
      <pointLight position={[0, -0.35, 0]} intensity={5} distance={6.5} color="#fff7ed" />
    </group>
  )
}

function Plant({ position }: { position: [number, number, number] }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        rot: (i / 7) * Math.PI * 2,
        tilt: 0.5 + (i % 3) * 0.16,
        h: 0.5 + ((i * 37) % 30) / 100,
      })),
    [],
  )
  return (
    <group position={position}>
      <mesh position={[0, 0.17, 0]} castShadow={undefined}>
        <cylinderGeometry args={[0.16, 0.12, 0.34, 12]} />
        <meshStandardMaterial color="#b45309" roughness={0.8} />
      </mesh>
      {leaves.map((l, i) => (
        <mesh key={i} position={[Math.sin(l.rot) * 0.1, 0.34 + l.h / 2, Math.cos(l.rot) * 0.1]} rotation={[l.tilt, l.rot, 0]}>
          <coneGeometry args={[0.09, l.h, 6]} />
          <meshStandardMaterial color={i % 2 ? '#15803d' : '#16a34a'} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function Whiteboard({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[2.7, 1.5, 0.05]} />
        <meshStandardMaterial color="#57534e" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.035]}>
        <planeGeometry args={[2.55, 1.35]} />
        <meshStandardMaterial color="#fafaf9" roughness={0.4} />
      </mesh>
      {[0.32, 0.05, -0.22].map((y, i) => (
        <mesh key={i} position={[-0.35 + i * 0.22, y, 0.045]}>
          <planeGeometry args={[1.1 - i * 0.25, 0.06]} />
          <meshStandardMaterial color={['#10b981', '#ec4899', '#f59e0b'][i]} />
        </mesh>
      ))}
      {[
        [0.7, 0.45, '#fbbf24'],
        [0.85, 0.2, '#34d399'],
        [0.6, -0.05, '#f472b6'],
      ].map(([x, y, c], i) => (
        <mesh key={`n${i}`} position={[Number(x), Number(y), 0.045]}>
          <planeGeometry args={[0.16, 0.16]} />
          <meshStandardMaterial color={String(c)} />
        </mesh>
      ))}
    </group>
  )
}

function Bookshelf({ position }: { position: [number, number, number] }) {
  const books = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        x: -0.55 + (i % 9) * 0.13,
        h: 0.3 + ((i * 29) % 12) / 100,
        c: ['#10b981', '#f59e0b', '#ec4899', '#a855f7', '#14b8a6'][i % 5],
        row: Math.floor(i / 9),
      })),
    [],
  )
  return (
    <group position={position} rotation-y={Math.PI / 2}>
      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[1.4, 1.9, 0.34]} />
        <meshStandardMaterial color={WOOD_DARK} roughness={0.75} />
      </mesh>
      {books.map((b, i) => (
        <mesh key={i} position={[b.x, 0.35 + b.row * 0.72 + b.h / 2, 0.2]}>
          <boxGeometry args={[0.09, b.h, 0.2]} />
          <meshStandardMaterial color={b.c} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

function HeadDesk({ onSelect }: { onSelect: (division: string) => void }) {
  const ref = useRef<THREE.Group>(null)
  const selected = useKantorStore((s) => s.selected)
  const setPreset = useKantorStore((s) => s.setPreset)
  const [hovered, setHovered] = useState(false)
  const isSel = selected === 'HEAD'
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (ref.current) ref.current.rotation.y = Math.sin(t * 0.6) * 0.08
  })
  return (
    <group position={[0, 0.24, -3.6]}>
      {/* Area klik tak terlihat */}
      <mesh
        position={[0, 0.9, 0]}
        onClick={(e) => {
          e.stopPropagation()
          onSelect('HEAD')
          setPreset({ key: 'desk-HEAD', pos: [0, 3.0, 0.6], look: [0, 1.0, -3.4] })
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <boxGeometry args={[3.0, 1.9, 2.0]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {(hovered || isSel) && (
        <mesh position={[0, -0.22, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.35, 1.52, 40]} />
          <meshBasicMaterial color={isSel ? '#eab308' : '#f5f5f4'} transparent opacity={isSel ? 0.9 : 0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
      <group ref={ref}>
        <mesh position={[0, 0.38, 0]}>
          <boxGeometry args={[2.0, 0.09, 0.9]} />
          <meshStandardMaterial color="#8b5e34" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <boxGeometry args={[1.7, 0.32, 0.7]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.75} />
        </mesh>
        {/* Monitor besar menghadap kamera */}
        <group position={[0, 0.72, -0.18]}>
          <mesh position={[0, -0.14, 0.06]}>
            <cylinderGeometry args={[0.03, 0.05, 0.24, 10]} />
            <meshStandardMaterial color="#292524" />
          </mesh>
          <mesh>
            <boxGeometry args={[0.95, 0.55, 0.04]} />
            <meshStandardMaterial color="#1c1917" />
          </mesh>
          <mesh position={[0, 0, 0.025]}>
            <planeGeometry args={[0.88, 0.48]} />
            <meshStandardMaterial color="#022c22" emissive="#10b981" emissiveIntensity={1.1} />
          </mesh>
        </group>
        {/* Trim emas */}
        <mesh position={[0, 0.44, 0.45]}>
          <boxGeometry args={[1.9, 0.03, 0.03]} />
          <meshStandardMaterial color="#eab308" emissive="#eab308" emissiveIntensity={0.5} metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}

function Desk({
  division,
  color,
  position,
  onSelect,
}: {
  division: string
  color: string
  position: [number, number]
  onSelect: (division: string) => void
}) {
  const selected = useKantorStore((s) => s.selected)
  const setPreset = useKantorStore((s) => s.setPreset)
  const [hovered, setHovered] = useState(false)
  const isSel = selected === division

  const pick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    onSelect(division)
    setPreset({ key: `desk-${division}`, pos: [position[0] * 0.55, 3.1, position[1] + 4.1], look: [position[0], 0.9, position[1]] })
  }

  return (
    <group position={[position[0], 0, position[1]]}>
      {/* Area klik tak terlihat */}
      <mesh
        position={[0, 0.8, 0]}
        onClick={pick}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = 'auto'
        }}
      >
        <boxGeometry args={[1.9, 1.7, 1.7]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Ring highlight */}
      {(hovered || isSel) && (
        <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[1.0, 1.16, 36]} />
          <meshBasicMaterial color={isSel ? color : '#f5f5f4'} transparent opacity={isSel ? 0.9 : 0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Meja */}
      <mesh position={[0, 0.74, 0]} castShadow={undefined}>
        <boxGeometry args={[1.6, 0.07, 0.8]} />
        <meshStandardMaterial color="#a1887f" roughness={0.65} />
      </mesh>
      {[[-0.72, -0.32], [0.72, -0.32], [-0.72, 0.32], [0.72, 0.32]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.37, z]}>
          <boxGeometry args={[0.07, 0.72, 0.07]} />
          <meshStandardMaterial color={WOOD_DARK} roughness={0.7} />
        </mesh>
      ))}
      {/* Pelat nama divisi */}
      <mesh position={[0.62, 0.795, 0.28]}>
        <boxGeometry args={[0.3, 0.015, 0.1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
      </mesh>

      {/* Monitor menghadap agent (agent berdiri di -z relatif meja) */}
      <group position={[0, 0.78, -0.1]}>
        <mesh position={[0, 0.12, 0.05]}>
          <cylinderGeometry args={[0.025, 0.045, 0.2, 10]} />
          <meshStandardMaterial color="#292524" />
        </mesh>
        <mesh>
          <boxGeometry args={[0.7, 0.42, 0.035]} />
          <meshStandardMaterial color="#1c1917" />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[0.64, 0.36]} />
          <meshStandardMaterial color="#1c1917" emissive={color} emissiveIntensity={0.55} />
        </mesh>
      </group>
      <mesh position={[0.25, 0.79, 0.22]} rotation-y={0.12}>
        <boxGeometry args={[0.34, 0.02, 0.13]} />
        <meshStandardMaterial color="#e7e5e4" roughness={0.5} />
      </mesh>

      {/* Kursi di belakang agent (sisi -z lebih jauh) */}
      <group position={[0, 0, -1.15]}>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[0.44, 0.06, 0.44]} />
          <meshStandardMaterial color="#57534e" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.75, -0.19]}>
          <boxGeometry args={[0.44, 0.55, 0.06]} />
          <meshStandardMaterial color={color} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.42, 8]} />
          <meshStandardMaterial color="#292524" />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <cylinderGeometry args={[0.24, 0.26, 0.05, 12]} />
          <meshStandardMaterial color="#292524" />
        </mesh>
      </group>

      {/* Label meja (DOM) */}
      <Html position={[0, 1.28, 0]} center distanceFactor={9} style={{ pointerEvents: 'none' }}>
        <div
          data-testid={`desk-label-${division}`}
          className="pointer-events-none select-none whitespace-nowrap rounded-md border bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-stone-800 shadow"
          style={{ borderColor: color }}
        >
          {DIVISION_LABELS[division as keyof typeof DIVISION_LABELS] ?? division}
        </div>
      </Html>
    </group>
  )
}
