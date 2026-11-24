/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    // Node 25 active le webstorage et vitest passe `--localstorage-file` sans
    // chemin aux workers, d'où un avertissement ; on le désactive (jsdom fournit
    // son propre localStorage).
    execArgv: ['--no-experimental-webstorage'],
    css: {
      include: [/\.css/], // lus en brut par tokens.test.ts et responsive.test.tsx
      modules: { classNameStrategy: 'non-scoped' },
    },
  },
})
