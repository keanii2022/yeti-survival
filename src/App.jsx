import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import World from './World.jsx'
import Snow from './Snow.jsx'
import Player from './Player.jsx'
import Yeti from './Yeti.jsx'
import Items from './Items.jsx'
import Survival from './Survival.jsx'
import Sound from './Sound.jsx'
import Hud from './Hud.jsx'
import { useGame } from './store.js'
import './App.css'

export default function App() {
  const [locked, setLocked] = useState(false)
  const runId = useGame((s) => s.runId)

  // Track pointer-lock state at the document level so the HUD can react to it
  // without reaching into the controls instance.
  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement !== null)
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  // Global keys that aren't movement: Space toggles pause, R restarts once the
  // run is over. Handled here rather than in the pointer-lock controller so they
  // work whether or not the mouse is currently captured.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        const { status, pause, resume } = useGame.getState()
        if (status === 'playing') pause()
        else if (status === 'paused') resume()
      } else if (e.code === 'KeyR') {
        const { status, reset } = useGame.getState()
        if (status === 'caught' || status === 'frozen') reset()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      {/* Keyed on runId: a reset remounts the whole scene, snapping the camera
          back to the spawn and the yeti back to its post. */}
      <Canvas
        key={runId}
        shadows
        camera={{ position: [0, 1.7, 8], fov: 70, near: 0.1, far: 320 }}
      >
        <World />
        <Snow />
        <Player />
        <Yeti />
        <Items />
        <Survival />
        <Sound />
      </Canvas>
      <Hud locked={locked} />
    </>
  )
}
