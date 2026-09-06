// Runs once before the test files (see vite.config.js `test.setupFiles`).
//
//  - `@testing-library/jest-dom` adds DOM matchers like `toBeInTheDocument()`
//    and `toHaveTextContent()`.
//  - `cleanup()` unmounts anything a test rendered, so tests don't leak DOM
//    into each other.
//  - the zustand store is a module singleton; snapshot its initial state here
//    and restore it after every test so each one starts from a fresh run.
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { useGame } from '../store.js'

const initialGameState = useGame.getState()

beforeEach(() => {
  useGame.setState(initialGameState, true)
})

afterEach(() => {
  cleanup()
})
