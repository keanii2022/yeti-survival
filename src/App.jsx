import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import World from './World.jsx'
import './App.css'

export default function App() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 2, 10], fov: 60, near: 0.1, far: 200 }}
    >
      <World />
      {/* Temporary: lets us orbit to confirm the world renders.
          Replaced by the real player/camera controller in step 2. */}
      <OrbitControls target={[0, 1, 0]} maxPolarAngle={Math.PI / 2 - 0.05} />
    </Canvas>
  )
}
