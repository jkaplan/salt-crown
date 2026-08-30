import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  server: {
    // Fixed rather than Vite's default auto-increment-on-conflict — a
    // predictable dev URL matters for scripted/browser-automation checks,
    // and `strictPort` fails loudly instead of silently landing on 5174+
    // when something else already holds 5173.
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@salt/sim': fileURLToPath(new URL('../../packages/sim/src/index.ts', import.meta.url)),
      '@salt/game': fileURLToPath(new URL('../../packages/game/src/index.ts', import.meta.url)),
    },
  },
})
