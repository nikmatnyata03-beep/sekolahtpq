'use client'

// Panggung 3D Studio Model — Canvas R3F yang memuat:
//   1. Showcase bawaan: masjid mini prosedural (geometri murni, nol aset unduhan)
//   2. Model pengguna: file .glb/.gltf (dipilih/drag-drop di section wrapper)
//      dinormalisasi otomatis (center + skala + duduk di podium).
//
// Catatan teknis:
//   - Dimount lazy via next/dynamic ssr:false dari model-3d-section.tsx —
//     three.js TIDAK pernah masuk chunk awal halaman.
//   - frameloop dikendalikan wrapper (only render saat section terlihat).
//   - Nol aset jaringan: pencahayaan manual (tanpa Environment preset HDR),
//     sehingga aman offline & produksi.
//   - Model pengguna di-dispose saat unmount agar memori GPU bebas.

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  ContactShadows,
  Html,
  OrbitControls,
  useGLTF,
} from '@react-three/drei'

export type ModelStats = { triangles: number; meshes: number }

type StageProps = {
  /** URL model pengguna (blob: atau http) — null = tampilkan masjid bawaan */
  modelUrl: string | null
  autoRotate: boolean
  frameloop: 'always' | 'never'
  /** Lapor statistik mesh model pengguna (null saat kembali ke masjid) */
  onStats: (stats: ModelStats | null) => void
  /** Pesan error jika model gagal dimuat/diparsing */
  onError: (message: string) => void
  /** Kunci ulang kamera (remount) saat nilai berubah */
  resetKey: number
}

/* ====================== Kamera adaptif layar sempit ====================== */

function useInitialCamera(): [number, number, number] {
  return useMemo(() => {
    const narrow =
      typeof window !== 'undefined' &&
      window.matchMedia('(max-width: 640px)').matches
    return narrow ? [4.4, 2.6, 5.0] : [3.4, 2.1, 4.1]
  }, [])
}

/* ============================ Masjid bawaan ============================ */

/** Bulan sabit emas kecil (extrude) untuk puncak kubah & menara. */
function SmallCrescent({ scale = 0.12 }: { scale?: number }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.absarc(0, 0, 1, 0, Math.PI * 2, false)
    const hole = new THREE.Path()
    hole.absarc(0.5, 0.24, 0.84, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.2,
      bevelEnabled: true,
      bevelSize: 0.03,
      bevelThickness: 0.03,
      bevelSegments: 3,
      curveSegments: 32,
    })
    geo.center()
    return geo
  }, [])

  return (
    <mesh geometry={geometry} scale={scale} rotation={[0, 0, -0.35]}>
      <meshStandardMaterial
        color="#f7e7b0"
        emissive="#fbbf24"
        emissiveIntensity={0.45}
        metalness={0.4}
        roughness={0.3}
      />
    </mesh>
  )
}

/** Jendela lengkung menyala (rect + setengah lingkaran di atasnya). */
function ArchedWindow({
  position,
  width = 0.16,
  height = 0.24,
}: {
  position: [number, number, number]
  width?: number
  height?: number
}) {
  return (
    <group position={position}>
      <mesh position={[0, -height / 4, 0]}>
        <planeGeometry args={[width, height / 2]} />
        <meshStandardMaterial
          color="#fcd34d"
          emissive="#fbbf24"
          emissiveIntensity={1.6}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <circleGeometry args={[width / 2, 16, 0, Math.PI]} />
        <meshStandardMaterial
          color="#fcd34d"
          emissive="#fbbf24"
          emissiveIntensity={1.6}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function Minaret({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* tiang */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.095, 1.5, 12]} />
        <meshStandardMaterial color="#f5f0e6" roughness={0.7} />
      </mesh>
      {/* cincin balkon */}
      <mesh position={[0, 1.18, 0]}>
        <torusGeometry args={[0.11, 0.028, 8, 20]} />
        <meshStandardMaterial color="#d4a53f" metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.62, 0]}>
        <torusGeometry args={[0.09, 0.026, 8, 20]} />
        <meshStandardMaterial color="#d4a53f" metalness={0.75} roughness={0.3} />
      </mesh>
      {/* kubah kecil + bulan sabit */}
      <mesh position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.12, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#d4a53f" metalness={0.8} roughness={0.28} />
      </mesh>
      <group position={[0, 1.95, 0]}>
        <SmallCrescent scale={0.075} />
      </group>
    </group>
  )
}

/** Masjid mini prosedural — panggung default ketika tidak ada model pengguna. */
function MasjidShowcase() {
  return (
    <group position={[0, 0.22, 0]}>
      {/* plinth */}
      <mesh position={[0, 0.08, 0]} receiveShadow castShadow>
        <boxGeometry args={[2.5, 0.16, 1.9]} />
        <meshStandardMaterial color="#f5f0e6" roughness={0.75} />
      </mesh>

      {/* bangunan utama */}
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.05, 0.9, 1.5]} />
        <meshStandardMaterial color="#0f5c46" roughness={0.6} />
      </mesh>
      {/* lis atap emas */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[2.16, 0.07, 1.6]} />
        <meshStandardMaterial color="#d4a53f" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* pintu lengkung depan */}
      <mesh position={[0, 0.42, 0.751]}>
        <planeGeometry args={[0.34, 0.42]} />
        <meshStandardMaterial color="#3f2d16" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.63, 0.751]}>
        <circleGeometry args={[0.17, 24, 0, Math.PI]} />
        <meshStandardMaterial color="#3f2d16" roughness={0.85} side={THREE.DoubleSide} />
      </mesh>

      {/* jendela depan & samping */}
      <ArchedWindow position={[-0.62, 0.62, 0.752]} />
      <ArchedWindow position={[0.62, 0.62, 0.752]} />
      <ArchedWindow position={[1.026, 0.62, 0.2]} width={0.14} height={0.22} />
      <ArchedWindow position={[1.026, 0.62, -0.2]} width={0.14} height={0.22} />

      {/* kubah utama */}
      <mesh position={[0, 1.14, 0]} castShadow>
        <sphereGeometry args={[0.52, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#d4a53f" metalness={0.8} roughness={0.26} />
      </mesh>
      <mesh position={[0, 1.14, 0]}>
        <cylinderGeometry args={[0.54, 0.54, 0.05, 32]} />
        <meshStandardMaterial color="#b8860b" metalness={0.75} roughness={0.3} />
      </mesh>
      <group position={[0, 1.82, 0]}>
        <SmallCrescent scale={0.14} />
      </group>

      {/* kubah kecil samping */}
      <mesh position={[-0.78, 1.14, 0.45]} castShadow>
        <sphereGeometry args={[0.17, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#d4a53f" metalness={0.8} roughness={0.28} />
      </mesh>
      <mesh position={[0.78, 1.14, 0.45]} castShadow>
        <sphereGeometry args={[0.17, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#d4a53f" metalness={0.8} roughness={0.28} />
      </mesh>

      {/* menara kembar */}
      <Minaret position={[-1.05, 0.16, 0.62]} />
      <Minaret position={[1.05, 0.16, 0.62]} />

      {/* semak dekoratif */}
      <mesh position={[-1.35, 0.06, -0.35]} castShadow>
        <sphereGeometry args={[0.11, 12, 10]} />
        <meshStandardMaterial color="#166534" roughness={0.9} />
      </mesh>
      <mesh position={[1.4, 0.05, -0.5]} castShadow>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshStandardMaterial color="#15803d" roughness={0.9} />
      </mesh>
    </group>
  )
}

/* ====================== Bintang latar (dekoratif) ====================== */

function BackdropStars({ count = 260 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null)

  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // cangkang bola jauh di belakang objek utama
      const r = 9 + Math.random() * 4
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * 0.7 + 0.5
      arr[i * 3 + 2] = -Math.abs(r * Math.sin(phi) * Math.sin(theta)) - 1
    }
    return arr
  }, [count])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (!ref.current) return
    ref.current.rotation.y = t * 0.006
    const m = ref.current.material as THREE.PointsMaterial
    m.opacity = 0.5 + Math.sin(t * 1.1) * 0.15
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color="#fef3c7"
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  )
}

/* ========================== Loader model GLTF ========================== */

/** Bebaskan memori GPU untuk objek hasil loader (geometry/material/texture). */
function disposeObject3D(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.dispose()
    const material = mesh.material as THREE.Material | THREE.Material[]
    const list = Array.isArray(material) ? material : [material]
    for (const mat of list) {
      if (!mat) continue
      for (const value of Object.values(mat)) {
        if (value instanceof THREE.Texture) value.dispose()
      }
      mat.dispose()
    }
  })
}

function GltfModel({
  url,
  onStats,
}: {
  url: string
  onStats: (stats: ModelStats) => void
}) {
  const { scene } = useGLTF(url)

  const prepared = useMemo(() => {
    const obj = scene.clone(true)
    // Normalisasi: pusatkan X/Z, dudukkan di y=0, skala maks 2.2 unit.
    const box = new THREE.Box3().setFromObject(obj)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const scale = 2.2 / maxDim
    obj.scale.setScalar(scale)

    const box2 = new THREE.Box3().setFromObject(obj)
    const center = box2.getCenter(new THREE.Vector3())
    obj.position.x -= center.x
    obj.position.z -= center.z
    obj.position.y -= box2.min.y

    let triangles = 0
    let meshes = 0
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      meshes += 1
      mesh.castShadow = true
      mesh.receiveShadow = true
      const geo = mesh.geometry
      if (geo) {
        const count = geo.index ? geo.index.count : geo.attributes.position?.count ?? 0
        triangles += Math.round(count / 3)
      }
    })

    return { obj, stats: { triangles, meshes } }
  }, [scene])

  useEffect(() => {
    onStats(prepared.stats)
    return () => disposeObject3D(prepared.obj)
  }, [prepared, onStats])

  return (
    <group position={[0, 0.23, 0]}>
      <primitive object={prepared.obj} />
    </group>
  )
}

/** Boundary khusus model — gagal parse/CORS → onError ke wrapper, panggung aman. */
class GltfErrorBoundary extends Component<
  { url: string; onError: (message: string) => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    const isGltfText = this.props.url.endsWith('.gltf')
    this.props.onError(
      isGltfText
        ? 'Gagal memuat model .gltf — kemungkinan file bergantung pada file eksternal (.bin/tekstur). Gunakan format .glb (satu file utuh).'
        : 'Gagal memuat model — pastikan file berformat glTF binary (.glb) yang valid.',
    )
    console.error('[Model3D] Gagal memuat model:', error)
  }

  render() {
    return this.state.hasError ? null : this.props.children
  }
}

/* ============================== Panggung ============================== */

export default function Model3dStage({
  modelUrl,
  autoRotate,
  frameloop,
  onStats,
  onError,
  resetKey,
}: StageProps) {
  const cameraPosition = useInitialCamera()

  return (
    <Canvas
      key={resetKey}
      frameloop={frameloop}
      // three 0.186 menghapus PCFSoftShadowMap — pakai PCF eksplisit agar
      // tidak memunculkan peringatan deprecation di konsol.
      shadows={THREE.PCFShadowMap}
      dpr={[1, 1.75]}
      camera={{ position: cameraPosition, fov: 42 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ background: 'transparent' }}
      aria-label="Panggung model 3D interaktif — seret untuk memutar, gulir untuk memperbesar"
    >
      {/* kabut lembut menyatu dengan latar CSS gelap */}
      <fog attach="fog" args={['#052e21', 9, 22]} />

      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#fde68a', '#064e3b', 0.5]} />
      <directionalLight
        position={[4, 6, 3]}
        intensity={1.5}
        color="#fff4dc"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={18}
      />
      <pointLight position={[-4, 3, -3]} intensity={14} distance={14} decay={2} color="#f59e0b" />
      <pointLight position={[2.5, 1.6, 4]} intensity={4} distance={10} decay={2} color="#a7f3d0" />

      <BackdropStars />

      {/* lantai gelap + podium pameran */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <circleGeometry args={[24, 48]} />
        <meshStandardMaterial color="#0a3d2e" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.11, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[2.55, 2.7, 0.22, 48]} />
        <meshStandardMaterial color="#134e39" roughness={0.55} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.225, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.5, 2.62, 48]} />
        <meshStandardMaterial color="#d4a53f" metalness={0.8} roughness={0.25} />
      </mesh>

      {modelUrl ? (
        <GltfErrorBoundary key={modelUrl} url={modelUrl} onError={onError}>
          <Suspense fallback={<ModelSpinner />}>
            <GltfModel url={modelUrl} onStats={onStats} />
          </Suspense>
        </GltfErrorBoundary>
      ) : (
        <MasjidShowcase />
      )}

      {/* bayangan kontak lembut di atas podium */}
      <ContactShadowsProxy />

      <OrbitControls
        makeDefault
        target={[0, 1.0, 0]}
        autoRotate={autoRotate}
        autoRotateSpeed={0.9}
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={2.2}
        maxDistance={9.5}
        maxPolarAngle={Math.PI / 2 - 0.04}
      />
    </Canvas>
  )
}

/* Bayangan kontak lembut di atas podium — dipanggil dari pohon Canvas. */
function ContactShadowsProxy() {
  return (
    <ContactShadows
      position={[0, 0.232, 0]}
      opacity={0.55}
      scale={7}
      blur={2.6}
      far={3}
      resolution={256}
      color="#022c22"
    />
  )
}

/* Pra-load spinner in-canvas (fallback Suspense untuk model besar). */
export function ModelSpinner() {
  return (
    <Html center>
      <div
        className="flex flex-col items-center gap-2"
        role="status"
        aria-label="Memuat model 3D"
      >
        <div className="size-9 animate-spin rounded-full border-2 border-amber-300/30 border-t-amber-300" />
        <span className="text-[11px] font-medium tracking-wide text-amber-200/90">
          Memuat model…
        </span>
      </div>
    </Html>
  )
}
