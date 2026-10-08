// domain/ holds pure code that the site, the server functions and the
// workers all import, so it must never reach back into any of them. Two
// guards prove it here: a scan of every import in domain/, and ESLint's
// domain/ rules run over a fixture that breaks each of them. The wiring that
// makes domain/ reachable (tsconfig paths and includes, the aliases) is
// checked too, so a later edit cannot quietly drop it.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { ESLint } from 'eslint'
import { loadConfigFromFile } from 'vite'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const DOMAIN = join(ROOT, 'domain')
const FIXTURE = 'test/unit/fixtures/lint/domain-violations.ts'
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? filesUnder(full) : [full]
  })
}

/** Every module specifier a file names: static imports, re-exports, import() and require(). */
function specifiers(source: string): string[] {
  const found: string[] = []
  const patterns = [
    /\b(?:import|export)\s[^'"]*?\sfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) for (const m of source.matchAll(re)) found.push(m[1])
  return found
}

/** Where a specifier points: a bare package name, or a repo-relative path for relative imports. */
function target(file: string, spec: string): string {
  if (!spec.startsWith('.')) return spec
  return relative(ROOT, resolve(file, '..', spec)).split('\\').join('/')
}

const BANNED: Array<[string, RegExp]> = [
  ['the site through @/', /^@\//],
  ['src/', /^src(\/|$)/],
  ['functions/', /^functions(\/|$)/],
  ['workers/', /^workers(\/|$)/],
  ['React', /^react(-dom)?(\/|$)/],
  ['a cloudflare: module', /^cloudflare:/],
  ['the Workers types', /^@cloudflare\/workers-types/],
]

describe('domain/ imports nothing from the site, the server, React or Cloudflare', () => {
  const files = filesUnder(DOMAIN)

  it('has the format helpers', () => {
    const names = files.map((f) => relative(ROOT, f).split('\\').join('/'))
    for (const f of ['score', 'date', 'clock', 'timeControl', 'index']) expect(names).toContain(`domain/format/${f}.ts`)
  })

  it('holds TypeScript only, no TSX', () => {
    for (const f of files) expect(f, relative(ROOT, f)).toMatch(/\.ts$/)
  })

  it.each(filesUnder(DOMAIN).map((f) => [relative(ROOT, f).split('\\').join('/'), f]))('%s', (_name, file) => {
    const source = readFileSync(file, 'utf8')
    expect(source).not.toMatch(/<reference\s+types=/)
    for (const spec of specifiers(source)) {
      const to = target(file, spec)
      for (const [what, re] of BANNED) expect(re.test(to), `${spec} reaches ${what}`).toBe(false)
      // A relative import must stay inside domain/.
      if (spec.startsWith('.')) expect(to.startsWith('domain/'), `${spec} leaves domain/`).toBe(true)
    }
  })

  it('the scan sees every kind of import', () => {
    const sample = [
      "import { a } from '../../src/lib/a'",
      "import type { B } from '@/lib/b'",
      "export * from 'react'",
      "import 'cloudflare:workers'",
      "const c = await import('../../functions/utils/c')",
    ].join('\n')
    expect(specifiers(sample).sort()).toEqual(
      ['../../functions/utils/c', '../../src/lib/a', '@/lib/b', 'cloudflare:workers', 'react'].sort(),
    )
  })
})

describe('ESLint enforces the domain/ boundary', () => {
  const eslint = new ESLint({ cwd: ROOT })
  const fixture = read(FIXTURE)

  // The fixture is linted as if it sat in domain/, so the real config's
  // domain/ block applies, not a copy of it.
  const lintAsDomain = async () => {
    const [result] = await eslint.lintText(fixture, { filePath: join(ROOT, 'domain/__lint_fixture__/domain-violations.ts') })
    return result.messages
  }

  it('reports each restricted import as an error', async () => {
    const messages = (await lintAsDomain()).filter((m) => m.ruleId === 'no-restricted-imports')
    const lines = fixture.split('\n')
    const reported = messages.map((m) => lines[m.line - 1])
    for (const spec of ['@/lib/features', '../../src/lib/lcaTime', '../../functions/utils/response', "'react'", 'react-dom/client', 'cloudflare:workers']) {
      expect(reported.some((l) => l.includes(spec)), spec).toBe(true)
    }
    expect(messages).toHaveLength(6)
    for (const m of messages) expect(m.severity).toBe(2)
  })

  it('reports window, document, localStorage and navigator as errors', async () => {
    const messages = (await lintAsDomain()).filter((m) => m.ruleId === 'no-restricted-globals')
    const names = messages.map((m) => /'(\w+)'/.exec(m.message)?.[1]).sort()
    expect(names).toEqual(['document', 'localStorage', 'navigator', 'window'])
    for (const m of messages) expect(m.severity).toBe(2)
  })

  it('applies the rules only inside domain/', async () => {
    const [result] = await eslint.lintText(fixture, { filePath: join(ROOT, 'src/lib/__lint_fixture__.ts') })
    expect(result.messages.filter((m) => m.ruleId?.startsWith('no-restricted-'))).toEqual([])
  })

  it('keeps the fixture out of the default lint run', async () => {
    expect(await eslint.isPathIgnored(join(ROOT, FIXTURE))).toBe(true)
  })

  it('passes every real file in domain/', async () => {
    const results = await eslint.lintFiles(['domain/**/*.ts'])
    expect(results.length).toBeGreaterThan(0)
    const problems = results.flatMap((r) => r.messages.map((m) => `${relative(ROOT, r.filePath)}:${m.line} ${m.ruleId} ${m.message}`))
    expect(problems).toEqual([])
  })
})

describe('domain/ is wired into the site, the server functions and the workers', () => {
  const json = (p: string) => JSON.parse(read(p)) as { include?: string[]; compilerOptions?: { paths?: Record<string, string[]>; lib?: string[] } }

  it('the site resolves @domain/* in TypeScript and checks domain/ itself', () => {
    const app = json('tsconfig.app.json')
    expect(app.compilerOptions?.paths?.['@domain/*']).toEqual(['./domain/*'])
    expect(app.compilerOptions?.paths?.['@/*']).toEqual(['./src/*'])
    expect(app.include).toEqual(expect.arrayContaining(['src', 'domain']))
  })

  it('the site build aliases @domain to domain/', () => {
    expect(read('vite.config.ts')).toMatch(/'@domain':\s*path\.resolve\(__dirname,\s*'\.\/domain'\)/)
  })

  it('the unit tests alias @domain to domain/', async () => {
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, join(ROOT, 'vitest.config.ts'))
    const alias = (loaded?.config as { resolve?: { alias?: Record<string, string> } }).resolve?.alias
    expect(alias?.['@domain']).toBe(join(ROOT, 'domain'))
    expect(alias?.['@']).toBe(join(ROOT, 'src'))
  })

  it('typecheck:functions covers domain/ and the daily-emails worker, with no DOM', () => {
    const fns = json('tsconfig.functions.json')
    expect(fns.include).toEqual(['functions', 'domain', 'workers/daily-emails/src'])
    expect(fns.compilerOptions?.lib?.some((l) => /dom/i.test(l))).toBe(false)
    expect(fns.compilerOptions?.paths).toBeUndefined()
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    expect(pkg.scripts['typecheck:functions']).toBe('tsc -p tsconfig.functions.json')
  })

  it('the daily-emails worker checks domain/ with its own config', () => {
    expect(json('workers/daily-emails/tsconfig.json').include).toContain('../../domain')
  })

  it('src/lib/format.ts is a one-line re-export of domain/format', () => {
    expect(read('src/lib/format.ts').trim()).toBe("export * from '@domain/format'")
  })
})
