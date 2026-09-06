import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import World from './World.jsx'
import Player from './Player.jsx'
import Hud from './Hud.jsx'
import './App.css'

export default function App() {
  const [locked, setLocked] = useState(false)

  // Track pointer-lock state at the document level so the HUD can react to it
  // without reaching into the controls instance.
  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement !== null)
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  return (
    <>
      <Canvas
        shadows
        camera={{ position: [0, 1.7, 8], fov: 70, near: 0.1, far: 200 }}
      >
        <World />
        <Player />
      </Canvas>
      <Hud locked={locked} />
    </>
  )
}
