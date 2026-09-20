// First-person / third-person view (V toggles — App.jsx). A session
// preference like difficulty.js — remembered across runs and reloads,
// untouched by reset() / startNightfall().
export const CAMERA_MODES = ['first', 'third']
const DEFAULT_MODE = 'first'
const STORAGE_KEY = 'yeti:cameraMode'

export function loadCameraMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return CAMERA_MODES.includes(stored) ? stored : DEFAULT_MODE
  } catch {
    return DEFAULT_MODE
  }
}

export function saveCameraMode(mode) {
  try {
    if (CAMERA_MODES.includes(mode)) localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // private mode / storage disabled — the choice just won't survive a reload
  }
}
