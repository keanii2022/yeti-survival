import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // react-three-fiber is mutation-based by design: every frame we write
      // straight to camera.position, mesh.rotation, etc. inside useFrame. The
      // react-hooks immutability rule flags those legitimate mutations, so we
      // switch it off for this project.
      'react-hooks/immutability': 'off',
    },
  },
])
