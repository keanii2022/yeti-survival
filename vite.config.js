/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://keanii2022.github.io/yeti-survival/ — assets must
  // resolve under that sub-path. Local dev stays at "/".
  base: '/yeti-survival/',
  plugins: [react()],
  test: {
    // Component and hook tests need a DOM; the pure store tests don't care.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    // The 3D scene isn't unit-tested — that's what playtesting is for. These
    // cover the game logic that's easy to break silently: the store, the input
    // hook, the HUD.
    include: ['src/**/*.test.{js,jsx}'],
  },
})
