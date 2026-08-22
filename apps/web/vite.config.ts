import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@salt/sim': fileURLToPath(new URL('../../packages/sim/src/index.ts', import.meta.url)),
      '@salt/game': fileURLToPath(new URL('../../packages/game/src/index.ts', import.meta.url)),
    },
  },
})
