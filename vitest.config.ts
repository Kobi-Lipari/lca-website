import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['functions/utils/pairing/**/*.test.ts'],
  },
})
