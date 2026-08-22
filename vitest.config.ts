import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@salt/sim': fileURLToPath(new URL('./packages/sim/src/index.ts', import.meta.url)),
      '@salt/game': fileURLToPath(new URL('./packages/game/src/index.ts', import.meta.url)),
    },
  },
  test: { include: ['packages/*/test/**/*.test.ts'] },
})
