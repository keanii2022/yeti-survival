import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import World from './World.jsx'
import Player from './Player.jsx'
import Yeti from './Yeti.jsx'
import Hud from './Hud.jsx'
import { useGame } from './store.js'
import './App.css'

export default function App() {
  const [locked, setLocked] = useState(false)
  const status = useGame((s) => s.status)
  const runId = useGame((s) => s.runId)
  const reset = useGame((s) => s.reset)

  // Track pointer-lock state at the document level so the HUD can react to it
  // without reaching into the controls instance.
  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement !== null)
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  return (
    <>
      {/* Keyed on runId: a reset remounts the whole scene, snapping the camera
          back to the spawn and the yeti back to its post. */}
      <Canvas
        key={runId}
        shadows
        camera={{ position: [0, 1.7, 8], fov: 70, near: 0.1, far: 200 }}
      >
        <World />
        <Player />
        <Yeti />
      </Canvas>
      <Hud locked={locked} status={status} onReset={reset} />
    </>
  )
}
