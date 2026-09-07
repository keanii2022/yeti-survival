import { Suspense, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useGame } from './store.js'
import { shelter, resetShelter } from './shelter.js'
import {
  generateSheds,
  pointInsideShed,
  SHED_WALLS,
  SHED_HALF,
  WALL_THICK,
  WALL_HEIGHT,
  ROOF_RISE,
} from './sheds.js'

// Step 6.12: the sheds you can duck into. The layout, the wall colliders and
// the "am I inside" test all live in sheds.js so this file is just the meshes
// plus the per-frame interior check that feeds the shared `shelter` readout.
//
// Each hut is built from primitives to match the tree / mountain style: plank
// walls straight off the collider rect list (so what you bump is what you see),
// a squat pyramid roof with a snow cap like the peaks, a board floor, and a dim
// cold interior light so stepping in reads as "sheltered" rather than a black box.

const ROOF_R = (SHED_HALF + WALL_THICK) * 1.5
const INNER = (SHED_HALF - WALL_THICK) * 2

// A framed print hung on the interior of the back wall, facing the doorway.
// One image per shed: public/shed-picture-<0..3>.jpg — swap those files to
// change them. Portrait crop (~9:16) to match the phone photos they started as.
// Wrapped in <Suspense> by the caller since useTexture suspends while it loads.
//
// The photo is drawn unlit (meshBasicMaterial): the shed interior is close to
// pitch black, so a lit material renders the picture as a black rectangle —
// basic + toneMapped:false keeps it legible and true to the source. `color`
// knocks it down a touch so it still sits in the gloom rather than glowing.
const PIC_W = 0.82
const PIC_H = 1.46
const PIC_Y = 1.5
// Group origin sits ~7cm off the back wall's inner face; the frame nests just
// behind it and the photo plane rides in front, so nothing occludes the photo.
const BACK_Z = -(SHED_HALF - WALL_THICK) + 0.07

function Picture({ index }) {
  const tex = useTexture(`/shed-picture-${index}.jpg`)
  tex.colorSpace = THREE.SRGBColorSpace
  return (
    <group position={[0, PIC_Y, BACK_Z]}>
      {/* frame: a touch wider all round, its front face behind the photo */}
      <mesh position={[0, 0, -0.03]} castShadow>
        <boxGeometry args={[PIC_W + 0.14, PIC_H + 0.14, 0.04]} />
        <meshStandardMaterial color="#241c14" roughness={1} />
      </mesh>
      {/* photo, proud of the frame's front face by ~1cm */}
      <mesh>
        <planeGeometry args={[PIC_W, PIC_H]} />
        <meshBasicMaterial map={tex} color="#c8c8c8" toneMapped={false} />
      </mesh>
    </group>
  )
}

function Shed({ x, z, yaw, index }) {
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {/* board floor — keeps the snow from showing through inside */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[INNER, INNER]} />
        <meshStandardMaterial color="#4f4030" roughness={1} />
      </mesh>

      {/* walls — one box per collider rect; the doorway is the gap in the front */}
      {SHED_WALLS.map((R, i) => (
        <mesh
          key={i}
          position={[(R.minX + R.maxX) / 2, WALL_HEIGHT / 2, (R.minZ + R.maxZ) / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[R.maxX - R.minX, WALL_HEIGHT, R.maxZ - R.minZ]} />
          <meshStandardMaterial color="#6b5640" roughness={1} />
        </mesh>
      ))}

      {/* squat pyramid roof + snow cap, same two-cone trick as Mountains' peaks */}
      <mesh position={[0, WALL_HEIGHT + ROOF_RISE / 2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[ROOF_R, ROOF_RISE, 4]} />
        <meshStandardMaterial color="#4a3b2c" roughness={1} flatShading />
      </mesh>
      <mesh
        position={[0, WALL_HEIGHT + ROOF_RISE * 0.83, 0]}
        rotation={[0, Math.PI / 4, 0]}
      >
        <coneGeometry args={[ROOF_R * 0.5, ROOF_RISE * 0.34, 4]} />
        <meshStandardMaterial color="#eef4f8" roughness={1} flatShading />
      </mesh>

      <pointLight
        position={[0, WALL_HEIGHT * 0.75, 0]}
        intensity={4}
        distance={SHED_HALF * 2.6}
        decay={2}
        color="#cdd9ec"
      />

      <Suspense fallback={null}>
        <Picture index={index} />
      </Suspense>
    </group>
  )
}

export default function Sheds() {
  const { camera } = useThree()
  const sheds = useMemo(() => generateSheds(), [])

  // Fresh scene: nobody's hiding yet, and clear it on the way out.
  useEffect(() => {
    resetShelter()
    return () => resetShelter()
  }, [])

  useFrame(() => {
    if (useGame.getState().status !== 'playing') {
      shelter.inside = false
      shelter.shedIndex = -1
      return
    }
    let idx = -1
    for (let i = 0; i < sheds.length; i++) {
      if (pointInsideShed(sheds[i], camera.position.x, camera.position.z)) {
        idx = i
        break
      }
    }
    shelter.inside = idx >= 0
    shelter.shedIndex = idx
  })

  return sheds.map((s, i) => <Shed key={i} index={i} {...s} />)
}
