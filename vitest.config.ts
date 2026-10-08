// vitest.config.ts — unit tests (node runtime): pairing engine, scoresheet
// scanner decoder, route audit
//
// Tests run in node by default. A component test that needs a DOM opts in
// with a `// @vitest-environment jsdom` comment at the top of its own file,
// so the swiss and scanner tests never pay for a browser environment.
// The React plugin compiles .tsx tests with the automatic JSX runtime (test/
// sits in no tsconfig, so nothing else tells the compiler which runtime to
// use), and '@' resolves to src/ exactly as it does in vite.config.ts.
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: [
      'functions/utils/swiss/**/*.test.ts',
      'src/lib/scanner/**/*.test.ts',
      'test/unit/**/*.test.ts',
      'test/unit/**/*.test.tsx',
    ],
  },
})
