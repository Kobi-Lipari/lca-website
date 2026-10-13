// The accessibility test build (vite build --mode a11y, run by
// npm run test:a11y) may turn switches on through VITE_FLAGS, so the browser
// tests can check a look before it ships. Nothing else may: in every other
// mode the switches are exactly the values written in src/lib/features.ts.
//
// This file proves that twice. applyFlagOverrides is checked directly in
// each mode, and FEATURES is loaded with VITE_FLAGS set. Then the site is
// built the way it is deployed, with VITE_FLAGS set, and the output is
// searched for the fixture route, the fixture page's file and the flag list;
// an accessibility test build of the same tree is searched the same way, to
// show the search finds them when they are there.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { applyFlagOverrides, FEATURES, FLAG_OVERRIDE_MODE, type Features } from '@/lib/features'

const ROOT = resolve(__dirname, '../..')
const FLAGS = 'newLook,themeHeritage'

/** Every switch off, so a switch that comes back on can only have come from the override. */
const ALL_OFF = Object.fromEntries(Object.keys(FEATURES).map((k) => [k, false])) as unknown as Features

describe('applyFlagOverrides', () => {
  it.each(['production', 'development', 'test', 'preview', 'A11Y', 'a11y-on', '', undefined])(
    'leaves the switches exactly as written in mode %s',
    (mode) => {
      const out = applyFlagOverrides(ALL_OFF, mode, FLAGS)
      expect(out).toBe(ALL_OFF)
      expect(Object.values(out).every((v) => v === false)).toBe(true)
    },
  )

  it('turns on the listed switches, and only those, in the accessibility test build', () => {
    const out = applyFlagOverrides(ALL_OFF, FLAG_OVERRIDE_MODE, ' newLook , themeHeritage,')
    expect(FLAG_OVERRIDE_MODE).toBe('a11y')
    expect(out.newLook).toBe(true)
    expect(out.themeHeritage).toBe(true)
    const others = Object.entries(out).filter(([k]) => k !== 'newLook' && k !== 'themeHeritage')
    expect(others.every(([, v]) => v === false)).toBe(true)
    // The switches as written are not changed in place.
    expect(ALL_OFF.newLook).toBe(false)
  })

  it('leaves the switches as written when the list is empty or missing', () => {
    expect(applyFlagOverrides(ALL_OFF, FLAG_OVERRIDE_MODE, '')).toBe(ALL_OFF)
    expect(applyFlagOverrides(ALL_OFF, FLAG_OVERRIDE_MODE, undefined)).toBe(ALL_OFF)
  })

  it('refuses a name that is not a switch', () => {
    expect(() => applyFlagOverrides(ALL_OFF, FLAG_OVERRIDE_MODE, 'newLook,newLok')).toThrow(/"newLok", which is not a switch/)
  })
})

describe('FEATURES', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('ignores VITE_FLAGS outside the accessibility test build', async () => {
    vi.stubEnv('VITE_FLAGS', FLAGS)
    vi.resetModules()
    const { FEATURES: loaded } = await import('@/lib/features')
    expect(import.meta.env.MODE).toBe('test')
    expect(loaded.newLook).toBe(false)
    expect(loaded.themeHeritage).toBe(false)
  })

  it('reads VITE_FLAGS when the mode is a11y', async () => {
    vi.stubEnv('MODE', 'a11y')
    vi.stubEnv('VITE_FLAGS', FLAGS)
    vi.resetModules()
    const { FEATURES: loaded } = await import('@/lib/features')
    expect(loaded.newLook).toBe(true)
    expect(loaded.themeHeritage).toBe(true)
    expect(loaded.newNav).toBe(false)
  })
})

/** Every file under `dir`, as paths relative to it. */
function filesUnder(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path, base) : [path.slice(base.length + 1)]
  })
}

/** Builds the site into a new folder with vite (not npm run build, which also runs tsc). */
function build(mode: 'production' | 'a11y'): string {
  const out = mkdtempSync(join(tmpdir(), `lca-${mode}-`))
  built.push(out)
  execFileSync(
    process.execPath,
    [join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--mode', mode, '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
    {
      cwd: ROOT,
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        VITE_FLAGS: FLAGS,
        VITE_SUPABASE_URL: 'http://127.0.0.1:9',
        VITE_SUPABASE_ANON_KEY: 'fake-anon-key',
        VITE_GOOGLE_MAPS_API_KEY: '',
      },
    },
  )
  return out
}

/** What a build carries of the fixture page and the flag list. */
function fixtureTraces(dir: string) {
  const files = filesUnder(dir)
  const text = files.filter((f) => /\.(js|html|css)$/.test(f)).map((f) => readFileSync(join(dir, f), 'utf8'))
  return {
    chunk: files.filter((f) => /ScopeFixturePage/.test(f)),
    route: text.some((t) => t.includes('/__fixtures/')),
    pageName: text.some((t) => t.includes('ScopeFixturePage')),
    flagList: text.some((t) => t.includes(FLAGS)),
  }
}

const built: string[] = []
afterAll(() => {
  for (const dir of built) rmSync(dir, { recursive: true, force: true })
})

describe('the site build', () => {
  it('carries no fixture route, no fixture chunk and no VITE_FLAGS value', () => {
    const traces = fixtureTraces(build('production'))
    expect(traces).toEqual({ chunk: [], route: false, pageName: false, flagList: false })
  }, 180_000)

  it('while the accessibility test build of the same tree carries all three', () => {
    const traces = fixtureTraces(build('a11y'))
    expect(traces.chunk).toHaveLength(1)
    expect(traces.chunk[0]).toMatch(/^assets\/ScopeFixturePage-[\w-]+\.js$/)
    expect(traces.route).toBe(true)
    expect(traces.flagList).toBe(true)
  }, 180_000)
})
