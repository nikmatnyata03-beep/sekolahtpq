'use client'

// Scene 3D Hero — lapisan WebGL di atas ilustrasi hero portal publik.
// Isi: bulan sabit emas (extrude shape), dua lapangan bintang berkelip,
// lentera melayang, dan debu cahaya — kamera ber-parallax mengikuti pointer.
//
// Aturan performa & aksesibilitas (di-guard oleh pemanggil di hero.tsx):
//   - dimount lazy (next/dynamic, ssr:false) SETELAH hero ter-render → three.js
//     tidak pernah masuk chunk awal halaman.
//   - prefers-reduced-motion → scene tidak dimount sama sekali.
//   - pointer kasar (sentuh) → populasi partikel dikurangi.
//   - Canvas pointer-events:none → tak mengganggu klik/konten.

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'

type SceneProps = { dense: boolean }

/* ---------- Bulan sabit emas: lingkaran luar − lubang lingkaran geser ---------- */
function CrescentMoon() {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.absarc(0, 0, 1, 0, Math.PI * 2, false)
    const hole = new THREE.Path()
    hole.absarc(0.5, 0.24, 0.84, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.22,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      bevelSegments: 4,
      curveSegments: 64,
    })
    geo.center()
    return geo
  }, [])

  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (!ref.current) return
    ref.current.position.y = 1.12 + Math.sin(t * 0.55) * 0.07
    ref.current.rotation.z = -0.38 + Math.sin(t * 0.35) * 0.04
  })

  return (
    <mesh ref={ref} geometry={geometry} position={[1.75, 1.12, 0]} scale={0.6}>
      <meshStandardMaterial
        color="#f7e7b0"
        emissive="#fbbf24"
        emissiveIntensity={0.5}
        metalness={0.35}
        roughness={0.35}
      />
    </mesh>
  )
}

/* ---------- Bintang berkelip: dua lapangan Points berlawanan arah ---------- */
function StarField({ count }: { count: number }) {
  const groupA = useRef<THREE.Points>(null)
  const groupB = useRef<THREE.Points>(null)

  const [positionsA, positionsB] = useMemo(() => {
    const rand = (min: number, max: number) => min + Math.random() * (max - min)
    const make = (n: number) => {
      const arr = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        arr[i * 3] = rand(-7.5, 7.5)
        arr[i * 3 + 1] = rand(-4.2, 4.2)
        arr[i * 3 + 2] = rand(-4, 0.5)
      }
      return arr
    }
    return [make(count), make(Math.round(count * 0.6))]
  }, [count])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (groupA.current) {
      groupA.current.rotation.z = t * 0.008
      const m = groupA.current.material as THREE.PointsMaterial
      m.opacity = 0.55 + Math.sin(t * 1.4) * 0.18
    }
    if (groupB.current) {
      groupB.current.rotation.z = -t * 0.012
      const m = groupB.current.material as THREE.PointsMaterial
      m.opacity = 0.7 + Math.sin(t * 2.1 + 1.3) * 0.22
    }
  })

  return (
    <>
      <points ref={groupA}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positionsA, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.02} color="#ffffff" transparent opacity={0.7} sizeAttenuation depthWrite={false} />
      </points>
      <points ref={groupB}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positionsB, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.034} color="#fde68a" transparent opacity={0.8} sizeAttenuation depthWrite={false} />
      </points>
    </>
  )
}

/* ---------- Lentera melayang: bodi kuningan + cahaya di dalam ---------- */
function Lantern({
  position,
  scale = 1,
  phase = 0,
}: {
  position: [number, number, number]
  scale?: number
  phase?: number
}) {
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (!group.current) return
    group.current.position.y = position[1] + Math.sin(t * 0.7 + phase) * 0.13
    group.current.rotation.y = Math.sin(t * 0.4 + phase) * 0.22
    group.current.rotation.z = Math.sin(t * 0.5 + phase) * 0.05
  })

  return (
    <group ref={group} position={position} scale={scale}>
      {/* tali gantung */}
      <mesh position={[0, 0.62, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.75, 6]} />
        <meshStandardMaterial color="#3f2d16" roughness={0.9} />
      </mesh>
      {/* tutup atas */}
      <mesh position={[0, 0.28, 0]}>
        <coneGeometry args={[0.17, 0.14, 12]} />
        <meshStandardMaterial color="#8a5a1b" metalness={0.55} roughness={0.4} />
      </mesh>
      {/* bodi kaca */}
      <mesh>
        <cylinderGeometry args={[0.15, 0.17, 0.42, 14]} />
        <meshStandardMaterial color="#b3731f" metalness={0.5} roughness={0.35} emissive="#f59e0b" emissiveIntensity={0.35} />
      </mesh>
      {/* cahaya di dalam */}
      <mesh>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial color="#fde68a" emissive="#fbbf24" emissiveIntensity={2.4} />
      </mesh>
      {/* dudukan bawah */}
      <mesh position={[0, -0.26, 0]}>
        <cylinderGeometry args={[0.13, 0.1, 0.08, 12]} />
        <meshStandardMaterial color="#8a5a1b" metalness={0.55} roughness={0.4} />
      </mesh>
      <pointLight color="#fbbf24" intensity={1.6} distance={2.4} decay={2} />
    </group>
  )
}

/* ---------- Debu cahaya: partikel naik pelan, wrap ke bawah ---------- */
function Dust({ count }: { count: number }) {
  const ref = useRef<THREE.Points>(null)
  const { positions, speeds } = useMemo(() => {
    const rand = (min: number, max: number) => min + Math.random() * (max - min)
    const pos = new Float32Array(count * 3)
    const spd = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = rand(-7, 7)
      pos[i * 3 + 1] = rand(-4, 4)
      pos[i * 3 + 2] = rand(-2.5, 1)
      spd[i] = rand(0.08, 0.3)
    }
    return { positions: pos, speeds: spd }
  }, [count])

  useFrame((_, dt) => {
    const pts = ref.current
    if (!pts) return
    const attr = pts.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i] * dt
      if (arr[i * 3 + 1] > 4.2) arr[i * 3 + 1] = -4.2
    }
    attr.needsUpdate = true
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.026} color="#fef3c7" transparent opacity={0.4} sizeAttenuation depthWrite={false} />
    </points>
  )
}

/* ---------- Jarak kamera adaptif: mundur di layar sempit (ponsel) ---------- */
function AdaptiveCameraZ() {
  const { size } = useThree()
  const targetZ = size.width / size.height < 1 ? 6.9 : 5.2
  useFrame(({ camera }, dt) => {
    const k = 1 - Math.pow(0.001, dt)
    camera.position.z += (targetZ - camera.position.z) * k
  })
  return null
}

/* ---------- Kamera parallax pointer (lerp halus, listener window) ---------- */
function ParallaxCamera({ amplitude = 0.42 }: { amplitude?: number }) {
  const target = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      target.current.x = (e.clientX / window.innerWidth) * 2 - 1
      target.current.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [])

  useFrame(({ camera }, dt) => {
    const k = 1 - Math.pow(0.002, dt) // damping independen frame-rate
    camera.position.x += (target.current.x * amplitude - camera.position.x) * k
    camera.position.y += (-target.current.y * amplitude * 0.6 - camera.position.y) * k
    camera.lookAt(0, 0.1, 0)
  })

  return null
}

export default function HeroScene3d({ dense = true }: SceneProps) {
  const starCount = dense ? 900 : 340
  const dustCount = dense ? 130 : 60

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 5.2], fov: 42 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 4, 5]} intensity={1.1} color="#fff7e0" />
        <pointLight position={[1.75, 1.12, 1.4]} intensity={2.2} distance={6} decay={2} color="#fde68a" />

        <CrescentMoon />
        <StarField count={starCount} />
        <Lantern position={[-2.15, -0.35, -0.5]} scale={1} phase={0} />
        <Lantern position={[-1.15, 0.95, -1.5]} scale={0.72} phase={2.1} />
        <Lantern position={[2.5, -0.95, -1.3]} scale={0.62} phase={4.2} />
        <Dust count={dustCount} />
        <ParallaxCamera />
        <AdaptiveCameraZ />
      </Canvas>
    </div>
  )
}
