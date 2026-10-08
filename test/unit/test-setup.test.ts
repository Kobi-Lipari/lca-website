// Checks the groundwork for the redesign: the switch list matches the brief
// and each switch is explained, the unit test configuration supports
// component tests without changing how node tests run, the test packages are
// pinned, and REDESIGN_STATUS.md carries this step's record in plain words.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FEATURES } from '@/lib/features'
import { loadConfigFromFile } from 'vite'

const ROOT = resolve(__dirname, '../..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

// The config file is read the way vitest itself reads it, not imported: it
// uses import.meta.url, which a test module's URL cannot stand in for.
const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, join(ROOT, 'vitest.config.ts'))
const config = (loaded?.config ?? {}) as Record<string, unknown>

const pkg = JSON.parse(read('package.json')) as {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}
const lock = JSON.parse(read('package-lock.json')) as {
  packages: Record<string, { version?: string; dev?: boolean; devDependencies?: Record<string, string> }>
}

const EARLIER = ['clubTournaments', 'tournamentQuickFilters', 'externalTags']

describe('switch list matches the brief', () => {
  const spec = read('docs/redesign/REDESIGN_SPEC.md')
  const specKeys = [...spec.matchAll(/^\| `([a-zA-Z]+)` \| .* \| (?:Phase 0[^|]*|WS\d+) \|$/gm)].map((m) => m[1])

  it('finds the 15 switches in the brief', () => {
    expect(specKeys).toHaveLength(15)
  })

  // A subset check, not an exact one: later work adds its own switches. The
  // values are only checked to be booleans here, so turning a switch on never
  // fails this file; features.test.ts checks the starting state.
  it('FEATURES holds each switch from the brief, plus the earlier three, as booleans', () => {
    expect(Object.keys(FEATURES)).toEqual(expect.arrayContaining([...specKeys, ...EARLIER]))
    for (const k of [...specKeys, ...EARLIER]) expect(typeof (FEATURES as Record<string, unknown>)[k]).toBe('boolean')
  })
})

describe('switch comments in src/lib/features.ts', () => {
  const src = read('src/lib/features.ts')
  const lines = src.split('\n')

  /** The comment text sitting directly above a `key: false,` line. */
  const commentAbove = (key: string): string => {
    const at = lines.findIndex((l) => new RegExp(`^  ${key}: (false|true),$`).test(l))
    expect(at, `${key} is not declared as a plain switch`).toBeGreaterThan(-1)
    const out: string[] = []
    for (let i = at - 1; i >= 0; i--) {
      const l = lines[i].trim()
      if (l === '') break
      out.unshift(l)
      if (l.startsWith('/**') || (l.startsWith('/*') && !l.startsWith('/**'))) break
    }
    return out
      .join(' ')
      .replace(/\/\*\*?|\*\//g, '')
      .replace(/\s\*\s/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  it.each(Object.keys(FEATURES))('%s has a JSDoc comment of real words', (key) => {
    const above = lines.findIndex((l) => new RegExp(`^  ${key}:`).test(l))
    // JSDoc form: the line above is either the closing "*/" or a one-line /** ... */
    expect(lines[above - 1].trim()).toMatch(/\*\/$/)
    expect(commentAbove(key).split(' ').length, `${key} comment too short`).toBeGreaterThanOrEqual(5)
  })

  it('keeps the three earlier switches and their comments as they were', () => {
    expect(commentAbove('clubTournaments')).toBe(
      'The "By organizer" column on the Tournaments page, which lets visitors filter by LCA club. Off until clubs are given permission to run their own tournaments here.',
    )
    expect(commentAbove('tournamentQuickFilters')).toBe(
      'The "USCF rated" and "Register on this site" quick filters on the Tournaments page. Off until the listings carry reliable rating and registration details for every event.',
    )
    expect(commentAbove('externalTags')).toBe(
      'The "Ext" / "External" tags that mark events not run through this site. Off while every listed event is external, since the tag says nothing.',
    )
  })

  it('declares every switch as a plain true or false, never a computed value', () => {
    const decl = lines.filter((l) => /^ {2}[a-zA-Z]+: (true|false),$/.test(l))
    expect(decl).toHaveLength(Object.keys(FEATURES).length)
  })

  it('uses plain wording in the new comments: no workflow terms, no USCF, no em dashes', () => {
    const newPart = src.slice(src.indexOf('// Redesign, Phase 0'))
    expect(newPart.length).toBeGreaterThan(0)
    expect(newPart).not.toMatch(/\bUSCF\b/)
    expect(newPart).not.toMatch(/—/)
    expect(newPart).not.toMatch(/\b(slice|WS\d\d|builder|scout)\b/i)
  })
})

describe('vitest.config.ts', () => {
  const test = (config as { test?: { include?: string[]; environment?: string } }).test ?? {}
  const resolveCfg = (config as { resolve?: { alias?: Record<string, string> } }).resolve ?? {}

  it('aliases @ to src', () => {
    expect(resolveCfg.alias?.['@']).toBe(join(ROOT, 'src'))
  })

  it('collects .ts and .tsx unit tests and keeps the earlier locations', () => {
    expect(test.include).toEqual(
      expect.arrayContaining([
        'functions/utils/swiss/**/*.test.ts',
        'src/lib/scanner/**/*.test.ts',
        'test/unit/**/*.test.ts',
        'test/unit/**/*.test.tsx',
      ]),
    )
  })

  it('keeps node as the default environment', () => {
    expect(test.environment === undefined || test.environment === 'node').toBe(true)
  })

  it('loads the React plugin', () => {
    const plugins = ((config as { plugins?: unknown[] }).plugins ?? []).flat(Infinity) as { name?: string }[]
    expect(plugins.some((p) => /react/i.test(p?.name ?? ''))).toBe(true)
  })

  it('has jsdom only in files that ask for it, and those files are .tsx', () => {
    const asking: string[] = []
    const walk = (dir: string) => {
      for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const p = `${dir}/${e.name}`
        if (e.isDirectory()) walk(p)
        else if (/\.test\.tsx?$/.test(e.name) && /^\s*\/\/\s*@vitest-environment\s+jsdom/m.test(read(p))) asking.push(p)
      }
    }
    for (const d of ['test/unit', 'src', 'functions']) walk(d)
    expect(asking.length).toBeGreaterThan(0)
    expect(asking.every((p) => p.endsWith('.tsx'))).toBe(true)
    // the node-only suites never ask for a DOM
    expect(asking.filter((p) => /swiss|scanner/.test(p))).toEqual([])
  })

  it('the smoke test has no React import and uses an @ import', () => {
    const smoke = read('test/unit/render-smoke.test.tsx')
    expect(smoke).not.toMatch(/from ['"]react['"]/)
    expect(smoke).not.toMatch(/import\s+React\b/)
    expect(smoke).toMatch(/from '@\/components\/StatusBadge'/)
    expect(smoke.split('\n')[0]).toBe('// @vitest-environment jsdom')
  })
})

describe('component test packages', () => {
  const wanted = ['jsdom', '@testing-library/react', '@testing-library/dom']

  it.each(wanted)('%s is an exact-pinned devDependency, not a runtime one', (name) => {
    expect(pkg.devDependencies?.[name]).toMatch(/^\d+\.\d+\.\d+$/)
    expect(pkg.dependencies?.[name]).toBeUndefined()
  })

  it.each(wanted)('%s is locked at the pinned version', (name) => {
    expect(lock.packages[`node_modules/${name}`]?.version).toBe(pkg.devDependencies?.[name])
    expect(lock.packages[''].devDependencies?.[name]).toBe(pkg.devDependencies?.[name])
  })

  it('does not put the test packages into the site build', () => {
    for (const name of wanted) expect(lock.packages[`node_modules/${name}`]?.dev).toBe(true)
  })

  it('keeps the plugin the config loads as a devDependency', () => {
    expect(pkg.devDependencies?.['@vitejs/plugin-react']).toBeDefined()
  })
})

describe('REDESIGN_STATUS.md, step 2', () => {
  const status = read('REDESIGN_STATUS.md')
  const ws01 = status.split(/^## /m).find((p) => /^WS01:/.test(p)) as string
  const subsection = (re: RegExp) => {
    const part = ws01.split(/^### /m).find((p) => re.test(p))
    expect(part, `no subsection ${re}`).toBeDefined()
    return part as string
  }
  const step2 = subsection(/^Step 2/)
  const rows = status
    .split('\n')
    .filter((l) => /^\| (AC\d+|K\d[a-z]?) \|/.test(l))
    .map((l) => l.split('|').map((c) => c.trim()))
  const row = (id: string) => rows.find((r) => r[1] === id) as string[]

  it('names all 15 new switches and the earlier three in the step 2 record', () => {
    const spec = read('docs/redesign/REDESIGN_SPEC.md')
    const specKeys = [...spec.matchAll(/^\| `([a-zA-Z]+)` \| .* \| (?:Phase 0[^|]*|WS\d+) \|$/gm)].map((m) => m[1])
    for (const k of [...specKeys, ...EARLIER]) expect(step2, k).toContain(k)
  })

  it('records the test counts and the lint count for this step', () => {
    expect(step2).toMatch(/unit 477/)
    expect(step2).toMatch(/integration 267/)
    expect(step2).toMatch(/36 errors and 4 warnings/)
  })

  it('says this step proves no criterion by itself, and the table agrees', () => {
    expect(step2).toMatch(/proves no acceptance criterion/i)
    for (const r of rows) if (r[1] !== 'AC9') expect(r[3], `${r[1]} is not step 1 or 2`).not.toBe('2')
  })

  it('gives each item exactly one step, in the right checkpoint order', () => {
    expect(rows).toHaveLength(14 + 4 + 7 + 4 + 3)
    const step = (id: string) => Number(row(id)[3])
    // structural work in the order the table says: K1a..c, K4, K1d, K2a..g, K6, K3
    expect([step('K1a'), step('K1b'), step('K1c'), step('K4'), step('K1d')]).toEqual([3, 4, 5, 6, 7])
    for (const [i, id] of ['K2a', 'K2b', 'K2c', 'K2d', 'K2e', 'K2f', 'K2g'].entries()) expect(step(id)).toBe(8 + i)
    expect(step('K6')).toBe(15)
    expect([step('K3a'), step('K3b'), step('K3c'), step('K3d')]).toEqual([16, 17, 18, 19])
    expect(step('K5')).toBe(20)
  })

  it('marks K1d as partial: ratchet, and only K1d', () => {
    expect(row('K1d')[4]).toMatch(/partial: ratchet/i)
    for (const r of rows) if (r[1] !== 'K1d') expect(r[4], r[1]).not.toMatch(/partial: ratchet/i)
  })

  it('records the heritage fonts line from brief 0.2 under deviations', () => {
    const dev = subsection(/^Deviations/)
    expect(dev).toMatch(/Heritage loads Libre Caslon Display and Source Serif 4 instead of reusing Instrument Serif/)
    expect(dev).toMatch(/Baloo 2 and Nunito[^.]*move to WS11/)
  })

  it('records the four resolved verify items for step 2', () => {
    const verify = subsection(/^Verify items resolved/)
    for (const item of ['Phase 0 switch list (step 2)', 'Unit tests and the `@` alias (step 2)', 'JSX in test files (step 2)', 'jsdom and Node (step 2)']) {
      expect(verify, item).toContain(item)
    }
  })

  it('records the decisions that apply to this branch', () => {
    const dec = subsection(/^Decisions/)
    for (const re of [/Contracts are a ratchet/, /Dark mode/, /Member discount/, /LCA membership requirement/, /Removing a section that has entries/, /Checkpoints/]) {
      expect(dec).toMatch(re)
    }
    expect(dec).toContain('3 entries are in this section. Move them to another section first.')
    expect(dec).toMatch(/enforce|WS06/)
  })

  it('uses no workflow terms in the step 2 record, the table or the decisions', () => {
    const text = [
      step2,
      subsection(/^What each acceptance criterion/),
      subsection(/^Decisions/),
    ]
      .join('\n')
      // paths and code in backticks (such as `.github/workflows/ci.yml`) are not prose
      .replace(/`[^`]*`/g, '')
    expect(text).not.toMatch(/\b(slice|builder|scout|planner|recorder|manifest|subagent|workflow)s?\b/i)
    expect(text).not.toMatch(/\bthe lead\b/i)
  })

  it('has no AI references and no em dashes in the status file, the config, the switches or the other new test files', () => {
    for (const p of ['REDESIGN_STATUS.md', 'test/unit/features.test.ts', 'test/unit/render-smoke.test.tsx', 'vitest.config.ts', 'src/lib/features.ts']) {
      const t = read(p)
      expect(t, p).not.toMatch(/\b(claude|chatgpt|copilot|llm|anthropic|openai)\b/i)
      expect(t, p).not.toMatch(/\bAI\b/)
    }
  })

  it('refers to the right files for the setup it describes', () => {
    expect(step2).toContain('test/unit/features.test.ts')
    expect(step2).toContain('test/unit/render-smoke.test.tsx')
    expect(step2).toContain('// @vitest-environment jsdom')
  })
})
