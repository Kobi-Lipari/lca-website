// @vitest-environment jsdom
//
// Every page in src/App.tsx past the home page is loaded with
// lazy(() => import('@/pages/X').then(m => ({ default: m.X }))). A module
// that moved, or an export that was renamed, only fails when someone opens
// that page. This loads each lazy target the way the route does and checks
// the named export is a component, so a missed rename fails here instead.
// One lazy target is not a page: the heritage pages' layout route,
// src/layouts/HeritageLayout.tsx, loaded the same way.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const ROOT = resolve(__dirname, '../..')
const APP = readFileSync(join(ROOT, 'src/App.tsx'), 'utf8')

const LAZY = /lazy\(\s*\(\)\s*=>\s*import\(\s*'([^']+)'\s*\)\.then\(\s*\(?m\)?\s*=>\s*\(\{\s*default:\s*m\.(\w+)\s*\}\)\s*\)\s*\)/g
const routes = [...APP.matchAll(LAZY)].map((m) => ({ specifier: m[1], name: m[2] }))

/** The file a '@/...' specifier names, as the build resolves it. */
const fileFor = (specifier: string) => join(ROOT, specifier.replace(/^@\//, 'src/')) + '.tsx'

/** The accessibility test build's fixture page, the one lazy page outside src/pages itself. */
const FIXTURE = '@/pages/fixtures/ScopeFixturePage'
/** The heritage pages' layout route, the one lazy target that is not a page. */
const LAYOUT = '@/layouts/HeritageLayout'

describe('every lazy route in src/App.tsx resolves', () => {
  it('reads each lazy() call in App.tsx', () => {
    // A lazy() call in another shape would be missed, so the counts must agree.
    expect(routes.length).toBe((APP.match(/\blazy\(/g) ?? []).length)
    const pages = routes.filter((r) => r.specifier !== FIXTURE && r.specifier !== LAYOUT)
    expect(pages.length).toBe(33)
    for (const r of pages) expect(r.specifier, r.name).toMatch(/^@\/pages\/\w+$/)
    // The fixture page is loaded only in that build (see feature-overrides.test.ts).
    expect(routes.filter((r) => r.specifier === FIXTURE)).toEqual([{ specifier: FIXTURE, name: 'ScopeFixturePage' }])
    // The layout is loaded once, and nothing else is loaded from src/layouts.
    expect(routes.filter((r) => r.specifier.startsWith('@/layouts/'))).toEqual([{ specifier: LAYOUT, name: 'HeritageLayout' }])
  })

  it.each(routes.map((r) => [r.specifier, r.name]))('%s exports %s', async (specifier, name) => {
    const mod = (await import(/* @vite-ignore */ fileFor(specifier))) as Record<string, unknown>
    expect(typeof mod[name], `${specifier} has no export named ${name}`).toBe('function')
  }, 30_000)
})
