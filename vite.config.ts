import { readFileSync } from 'node:fs'
import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { PREPAINT_SCRIPT } from './src/lib/colorScheme.ts'

/** The mode of the accessibility test build, the only mode that reads VITE_FLAGS (FLAG_OVERRIDE_MODE in src/lib/features.ts). */
const FLAG_OVERRIDE_MODE = 'a11y'

/**
 * Whether the newLook switch is on in this build. src/lib/features.ts cannot
 * be imported here, because it reads import.meta.env, which only exists
 * inside the site's own bundle; so this reads the value written in that file
 * and, in the accessibility test build only, the names in VITE_FLAGS, the
 * same rule as applyFlagOverrides. test/unit/prepaint-gate.test.ts checks
 * the two agree.
 */
export function newLookInBuild(featuresSource: string, mode: string, flags: string | undefined): boolean {
  const written = [...featuresSource.matchAll(/^\s*newLook:\s*(true|false),/gm)]
  if (written.length !== 1) {
    throw new Error(`src/lib/features.ts should set newLook once, as true or false; found ${written.length} settings.`)
  }
  if (written[0][1] === 'true') return true
  if (mode !== FLAG_OVERRIDE_MODE) return false
  return (flags ?? '').split(',').map((name) => name.trim()).includes('newLook')
}

/**
 * Puts the color scheme script (PREPAINT_SCRIPT in src/lib/colorScheme.ts)
 * at the top of the page head when newLook is on, so the new look and dark
 * mode are applied before the first paint. With newLook off it adds nothing:
 * a build without the switch can never add .dark to the page.
 */
export function prepaintPlugin(featuresFile = path.resolve(__dirname, 'src/lib/features.ts')): Plugin {
  let newLook = false
  return {
    name: 'lca-prepaint',
    configResolved(config) {
      newLook = newLookInBuild(readFileSync(featuresFile, 'utf8'), config.mode, config.env.VITE_FLAGS)
    },
    transformIndexHtml() {
      if (!newLook) return undefined
      return [{ tag: 'script', children: PREPAINT_SCRIPT, injectTo: 'head-prepend' }]
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    prepaintPlugin(),
  ],
  build: {
    rolldownOptions: {
      output: {
        // The switches keep a chunk of their own (features-[hash].js) now
        // that src/main.tsx reads one, so the accessibility tests can load
        // the very switches a build was made with (test/a11y/builds.spec.ts).
        codeSplitting: {
          groups: [{ name: 'features', test: /[\\/]src[\\/]lib[\\/]features\.ts$/ }],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@domain': path.resolve(__dirname, './domain'),
    },
  },
})
