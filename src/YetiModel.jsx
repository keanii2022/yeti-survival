// The shaggy brute model, built from primitives to match the tree style.
// Shared by Yeti.jsx (the Hunter) and Guardian.jsx (8.3) so the two read as
// the same kind of creature while still being told apart at a glance — pass a
// `palette` to recolor the fur and eye glow; the defaults are the Hunter's
// original colors, so Yeti.jsx is pixel-identical with no palette passed.
//
// Stands ~2.6m — taller than the player's 1.7m eye height, so it reads as
// looming. Modelled facing +Z so `rotation.y = atan2(dx, dz)` aims it at a
// target. `eyeRef` is a ref to a 2-slot array the caller drives per frame
// (emissiveIntensity) for the "spotted you" glow.
//
// 8.7: `poseRef` (optional) is a 2-slot array the same way — [upper body,
// head] groups, pivoted at the hips and the neck, that the caller pitches
// forward (rotation.x) for the feeding hunch. At rotation 0 every part sits
// exactly where it always has.
const HIP_Y = 1.3
const NECK_Y = 2.35
const DEFAULT_PALETTE = {
  legFur: '#e9eef2',
  torsoFur: '#f2f6fa',
  armFur: '#e4eaef',
  headFur: '#f6f9fc',
  eyeBase: '#2a0000',
  eyeGlow: '#ff2a1a',
}

export function YetiModel({ eyeRef, poseRef, palette }) {
  const p = { ...DEFAULT_PALETTE, ...palette }
  return (
    <group>
      {/* legs */}
      <mesh position={[-0.45, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.28, 1.4, 6]} />
        <meshStandardMaterial color={p.legFur} roughness={1} />
      </mesh>
      <mesh position={[0.45, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.28, 1.4, 6]} />
        <meshStandardMaterial color={p.legFur} roughness={1} />
      </mesh>

      {/* upper body, pivoting at the hips (8.7) */}
      <group position={[0, HIP_Y, 0]} ref={poseRef && ((g) => (poseRef.current[0] = g))}>
        {/* torso */}
        <mesh position={[0, 1.85 - HIP_Y, 0]} castShadow>
          <capsuleGeometry args={[0.85, 1.1, 4, 10]} />
          <meshStandardMaterial color={p.torsoFur} roughness={1} />
        </mesh>

        {/* arms, hanging slightly forward */}
        <mesh position={[-1.0, 1.8 - HIP_Y, 0.15]} rotation={[0.3, 0, 0.15]} castShadow>
          <cylinderGeometry args={[0.24, 0.2, 1.5, 6]} />
          <meshStandardMaterial color={p.armFur} roughness={1} />
        </mesh>
        <mesh position={[1.0, 1.8 - HIP_Y, 0.15]} rotation={[0.3, 0, -0.15]} castShadow>
          <cylinderGeometry args={[0.24, 0.2, 1.5, 6]} />
          <meshStandardMaterial color={p.armFur} roughness={1} />
        </mesh>

        {/* head, pivoting at the neck (8.7) */}
        <group
          position={[0, NECK_Y - HIP_Y, 0]}
          ref={poseRef && ((g) => (poseRef.current[1] = g))}
        >
          <mesh position={[0, 2.75 - NECK_Y, 0.05]} castShadow>
            <dodecahedronGeometry args={[0.55, 0]} />
            <meshStandardMaterial color={p.headFur} roughness={1} flatShading />
          </mesh>

          {/* eyes — emissive so they can glow brighter the instant it spots you */}
          <mesh position={[-0.2, 2.82 - NECK_Y, 0.5]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial
              ref={(m) => (eyeRef.current[0] = m)}
              color={p.eyeBase}
              emissive={p.eyeGlow}
              emissiveIntensity={0.15}
            />
          </mesh>
          <mesh position={[0.2, 2.82 - NECK_Y, 0.5]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial
              ref={(m) => (eyeRef.current[1] = m)}
              color={p.eyeBase}
              emissive={p.eyeGlow}
              emissiveIntensity={0.15}
            />
          </mesh>
        </group>
      </group>
    </group>
  )
}
