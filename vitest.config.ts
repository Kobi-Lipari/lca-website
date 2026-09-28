// vitest.config.ts — unit tests (node runtime): pairing engine, scoresheet
// scanner decoder, route audit
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'functions/utils/pairing/**/*.test.ts',
      'src/lib/scanner/**/*.test.ts',
      'test/unit/**/*.test.ts',
    ],
  },
})