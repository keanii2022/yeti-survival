import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGame } from './store.js'
import { playerBody, playerFacing } from './playerBody.js'

// The third-person body (V toggles into it — Player.jsx / cameraMode.js).
// Invisible in first person: there's nothing to draw when the camera sits
// exactly where the eyes would be. Built from primitives in the same low-poly
// style as YetiModel (Yeti.jsx) — modelled facing +Z, so
// `rotation.y = atan2(dirX, dirZ)` aims it, same convention the yeti uses.
// Reads playerBody / playerFacing each frame rather than driving anything
// itself; Player.jsx is the only writer of those.
const PARKA = '#c1442b'
const PANTS = '#2f3542'
const SKIN = '#e0ac80'
const PACK = '#333b47'

export default function PlayerAvatar() {
  const cameraMode = useGame((s) => s.cameraMode)
  const status = useGame((s) => s.status)
  const group = useRef()
  const bobT = useRef(0)
  const lastX = useRef(playerBody.x)
  const lastZ = useRef(playerBody.z)

  useFrame((_, rawDelta) => {
    const g = group.current
    if (!g) return
    if (useGame.getState().status !== 'playing') return
    const delta = Math.min(rawDelta, 0.1)

    g.position.set(playerBody.x, playerBody.y, playerBody.z)
    g.rotation.y = Math.atan2(playerFacing.x, playerFacing.z)

    // A little torso bob while actually covering ground — nothing fancy, just
    // enough that the body doesn't glide like a ghost from behind.
    const dx = playerBody.x - lastX.current
    const dz = playerBody.z - lastZ.current
    lastX.current = playerBody.x
    lastZ.current = playerBody.z
    const moving = dx * dx + dz * dz > 1e-6
    bobT.current = moving ? bobT.current + delta * 9 : 0
    const bob = moving ? Math.abs(Math.sin(bobT.current)) * 0.05 : 0
    g.position.y += bob
  })

  if (cameraMode !== 'third' || status !== 'playing') return null

  return (
    <group ref={group}>
      {/* legs */}
      <mesh position={[-0.18, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.13, 0.9, 6]} />
        <meshStandardMaterial color={PANTS} roughness={1} />
      </mesh>
      <mesh position={[0.18, 0.45, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.13, 0.9, 6]} />
        <meshStandardMaterial color={PANTS} roughness={1} />
      </mesh>

      {/* torso (parka) */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.55, 4, 10]} />
        <meshStandardMaterial color={PARKA} roughness={1} />
      </mesh>

      {/* backpack — reads the character from behind, over-the-shoulder view */}
      <mesh position={[0, 1.2, -0.32]} castShadow>
        <boxGeometry args={[0.42, 0.5, 0.22]} />
        <meshStandardMaterial color={PACK} roughness={1} />
      </mesh>

      {/* arms, hanging slightly forward */}
      <mesh position={[-0.42, 1.15, 0.06]} rotation={[0.15, 0, 0.1]} castShadow>
        <cylinderGeometry args={[0.1, 0.08, 0.65, 6]} />
        <meshStandardMaterial color={PARKA} roughness={1} />
      </mesh>
      <mesh position={[0.42, 1.15, 0.06]} rotation={[0.15, 0, -0.1]} castShadow>
        <cylinderGeometry args={[0.1, 0.08, 0.65, 6]} />
        <meshStandardMaterial color={PARKA} roughness={1} />
      </mesh>

      {/* head + beanie */}
      <mesh position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.2, 12, 10]} />
        <meshStandardMaterial color={SKIN} roughness={1} />
      </mesh>
      <mesh position={[0, 1.74, 0]} castShadow>
        <coneGeometry args={[0.22, 0.22, 10]} />
        <meshStandardMaterial color={PARKA} roughness={1} flatShading />
      </mesh>
    </group>
  )
}
