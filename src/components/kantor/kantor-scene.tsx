'use client'
// Scene 3D Kantor AI Agent — Canvas, pencahayaan, environment IBL lokal,
// OrbitControls (360°, clamp polar, damping), preset kamera halus. (Task 51)
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { Office } from './office'
import { Agent } from './agent'
import { Director } from './director'
import { KANTOR_CHARACTERS } from '@/lib/kantor/data'
import { useKantorStore } from './kantor-store'

/** IBL lokal (RoomEnvironment) — tanpa fetch CDN, aman offline/produksi. */
function LocalEnv() {
  const gl = useThree((s) => s.gl)
  const envMap = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    return tex
  }, [gl])
  useEffect(() => () => envMap.dispose(), [envMap])
  return <primitive object={envMap} attach="environment" />
}

const V = (a: [number, number, number]) => new THREE.Vector3(...a)

/** Lerp halus kamera menuju preset; batal saat user mulai berinteraksi. */
function CameraRig() {
  const preset = useKantorStore((s) => s.preset)
  const setPreset = useKantorStore((s) => s.setPreset)
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as
    | { target: THREE.Vector3; addEventListener: (t: string, f: () => void) => void; removeEventListener: (t: string, f: () => void) => void }
    | undefined

  useEffect(() => {
    if (!preset || !controls) return
    const cancel = () => setPreset(null)
    controls.addEventListener('start', cancel)
    return () => controls.removeEventListener('start', cancel)
  }, [preset, controls, setPreset])

  useFrame((_, dt) => {
    if (!preset || !controls) return
    const k = 1 - Math.pow(0.002, Math.min(dt, 0.05))
    camera.position.lerp(V(preset.pos), k)
    controls.target.lerp(V(preset.look), k)
    if (camera.position.distanceTo(V(preset.pos)) < 0.08) setPreset(null)
  })
  return null
}

function FpsMeter() {
  const acc = useRef({ t: 0, n: 0 })
  useFrame((_, dt) => {
    const a = acc.current
    a.t += dt
    a.n += 1
    if (a.t >= 0.5) {
      const el = document.getElementById('kantor-fps')
      if (el) el.textContent = `${Math.round(a.n / a.t)} fps`
      a.t = 0
      a.n = 0
    }
  })
  return null
}

export function KantorScene() {
  const quality = useKantorStore((s) => s.quality)
  const autoRotate = useKantorStore((s) => s.autoRotate)
  const selected = useKantorStore((s) => s.selected)
  const select = useKantorStore((s) => s.select)
  const high = quality === 'HIGH'
  const devMode = typeof window !== 'undefined' && window.location.search.includes('dev=1')

  const handleSelect = (division: string) => {
    select(division === selected ? null : division)
  }

  return (
    <Canvas
      shadows={high ? 'percentage' : false}
      dpr={high ? [1, 2] : 1}
      camera={{ position: [0, 8.2, 10.4], fov: 50, near: 0.1, far: 80 }}
      gl={{ antialias: true }}
      className="touch-none"
    >
      <color attach="background" args={['#efe9df']} />
      <fog attach="fog" args={['#efe9df', 20, 40]} />
      <LocalEnv />

      {/* Cahaya: matahari lewat jendela kiri + ambient hangat */}
      <ambientLight intensity={0.55} color="#fff7ed" />
      <directionalLight
        position={[-6, 6.5, 2]}
        intensity={1.35}
        color="#fffbeb"
        castShadow={high}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0004}
      />
      <hemisphereLight intensity={0.35} color="#fef3c7" groundColor="#a1887f" />

      <Office onSelect={handleSelect} />

      {KANTOR_CHARACTERS.map((c) => (
        <Agent
          key={c.assetKey}
          division={c.division}
          name={c.name}
          color={c.colorHex}
          accent={c.accentHex}
          badge={c.badge}
          home={c.home}
          isHead={c.division === 'HEAD'}
        />
      ))}

      <Director />
      <CameraRig />
      {devMode && <FpsMeter />}

      <OrbitControls
        makeDefault
        target={[0, 0.9, -0.4]}
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={24}
        minPolarAngle={Math.PI / 18} // 10°
        maxPolarAngle={(85 * Math.PI) / 180} // 85° — tidak tembus lantai
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
      />
    </Canvas>
  )
}
