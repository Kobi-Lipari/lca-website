// vitest.config.ts — unit tests (node runtime): pairing engine + route audit
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'functions/utils/pairing/**/*.test.ts',
      'test/unit/**/*.test.ts',
    ],
  },
})