import { Sky } from '@react-three/drei'

// Step 1: an empty snowy world — ground, sky, lighting, fog.
// No player, no yeti, no items yet.
export default function World() {
  return (
    <>
      {/* Cold blue-grey fog closes visibility down fast for a claustrophobic feel */}
      <fog attach="fog" args={['#c8d2dc', 12, 70]} />
      <color attach="background" args={['#c8d2dc']} />

      {/* Overcast winter sky */}
      <Sky sunPosition={[8, 4, -10]} turbidity={8} rayleigh={0.6} inclination={0.48} />

      {/* Soft fill so nothing is pitch black, plus a low sun for long shadows */}
      <hemisphereLight args={['#eaf1f7', '#9fb0bf', 0.9]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[8, 12, -6]}
        intensity={1.1}
        color="#f2f6ff"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      {/* Snowy ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#eef4f8" roughness={1} metalness={0} />
      </mesh>
    </>
  )
}
