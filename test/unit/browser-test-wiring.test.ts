// How the browser test layer (K5: Playwright, axe, the a11y and e2e projects)
// is wired into the repository, checked without a browser:
//
// - the two packages are pinned exactly, play together, and are at least two
//   weeks older than the day this slice was built
// - test:a11y and test:e2e exist and sit outside test, test:all, the
//   integration run and CI's check job; vitest never collects the Playwright
//   specs (and Playwright never collects a vitest file)
// - CI gains an a11y job on pull requests that installs Chromium first
// - the files the tests write or hold are ignored or committed as they should
//   be, and the fake settings file holds nothing that could reach a real
//   service
// - baseline.json is the proof the legacy colours are today's: its values are
//   the ones src/index.css gives the legacy tokens
// - known-violations.json lists each current axe finding by rule and selector
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import integrationConfig from '../../vitest.integration.config'
import unitConfig from '../../vitest.config'
import { A11Y_EMPTY_SECRETS, A11Y_SERVER_ENV, a11yServerArgs } from '../a11y/global-setup'
import { block, fileLines } from './helpers/workflow'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const json = <T = any>(path: string) => JSON.parse(read(path)) as T // eslint-disable-line @typescript-eslint/no-explicit-any

interface Pkg {
  scripts: Record<string, string>
  devDependencies: Record<string, string>
  dependencies: Record<string, string>
  overrides?: Record<string, string>
}
const pkg = json<Pkg>('package.json')
const EXACT = /^\d+\.\d+\.\d+$/

describe('the packages', () => {
  it('@playwright/test and @axe-core/playwright are pinned exactly, with no range', () => {
    expect(pkg.devDependencies['@playwright/test']).toMatch(EXACT)
    expect(pkg.devDependencies['@axe-core/playwright']).toMatch(EXACT)
    // Dev dependencies only: nothing the site ships.
    expect(pkg.dependencies['@playwright/test']).toBeUndefined()
    expect(pkg.dependencies['@axe-core/playwright']).toBeUndefined()
  })

  it('one playwright-core, the same version as @playwright/test, in package.json and the lock file', () => {
    const version = pkg.devDependencies['@playwright/test']
    expect(pkg.overrides?.['playwright-core']).toBe(version)

    const lock = json('package-lock.json')
    expect(lock.packages[''].devDependencies['@playwright/test']).toBe(version)
    expect(lock.packages[''].devDependencies['@axe-core/playwright']).toBe(pkg.devDependencies['@axe-core/playwright'])
    expect(lock.packages['node_modules/@playwright/test'].version).toBe(version)
    expect(lock.packages['node_modules/playwright'].version).toBe(version)
    expect(lock.packages['node_modules/playwright-core'].version).toBe(version)
    expect(lock.packages['node_modules/@axe-core/playwright'].version).toBe(pkg.devDependencies['@axe-core/playwright'])
    // No second copy of the browser driver hiding under another package.
    const copies = Object.keys(lock.packages).filter((k) => /(^|\/)node_modules\/playwright-core$/.test(k))
    expect(copies).toEqual(['node_modules/playwright-core'])
    // The lock file records where each came from, so npm ci checks it.
    for (const name of ['@playwright/test', 'playwright', 'playwright-core', '@axe-core/playwright']) {
      expect(lock.packages[`node_modules/${name}`].integrity, name).toMatch(/^sha512-/)
      expect(lock.packages[`node_modules/${name}`].resolved, name).toMatch(/^https:\/\/registry\.npmjs\.org\//)
    }
  })

  it('installs the versions the lock file names', () => {
    for (const name of ['@playwright/test', '@axe-core/playwright', 'playwright-core']) {
      const installed = json(`node_modules/${name}/package.json`).version
      expect(installed, name).toBe(json('package-lock.json').packages[`node_modules/${name}`].version)
    }
  })
})

describe('the scripts', () => {
  it('test:a11y builds and seeds first, then runs only the two accessibility projects', () => {
    const script = pkg.scripts['test:a11y']
    expect(script).toMatch(/^node .*test\/a11y\/global-setup\.ts && playwright test /)
    expect(script).toContain('--project=a11y-on')
    expect(script).toContain('--project=a11y-off')
    expect(script).not.toMatch(/e2e/)
    expect(existsSync(join(ROOT, 'test/a11y/global-setup.ts'))).toBe(true)
  })

  it('test:e2e runs only the preview project', () => {
    expect(pkg.scripts['test:e2e']).toBe('playwright test --project=e2e-preview')
  })

  it.each(['test', 'test:watch', 'test:integration', 'test:integration:watch', 'test:all', 'build', 'lint', 'typecheck:functions', 'check:bundle'])(
    'npm run %s does not run a browser',
    (name) => {
      expect(pkg.scripts[name], name).not.toMatch(/playwright|a11y|e2e|axe/i)
    },
  )

  it('db:seed:preview and the browser tests load the same seed file', () => {
    expect(pkg.scripts['db:seed:preview']).toContain('scripts/seed/fixtures.sql')
    expect(read('test/a11y/global-setup.ts')).toContain("'scripts/seed/fixtures.sql'")
  })
})

describe('what vitest collects', () => {
  /** A vitest include glob as a regular expression ("**" crosses folders, "*" does not). */
  const globToRegExp = (glob: string) =>
    new RegExp(
      '^' +
        glob
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*\*\//g, '(?:.*/)?')
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*') +
        '$',
    )
  const collected = (config: typeof unitConfig, file: string) =>
    (config.test?.include ?? []).some((glob: string) => globToRegExp(glob).test(file))

  const browserFiles = ['test/a11y', 'test/e2e'].flatMap((dir) => readdirSync(join(ROOT, dir)).map((f) => `${dir}/${f}`))

  it('finds the browser test files it is checking', () => {
    expect(browserFiles).toEqual(
      expect.arrayContaining(['test/a11y/smoke.spec.ts', 'test/a11y/baseline.ts', 'test/e2e/register-family.spec.ts', 'test/e2e/publish-round.spec.ts']),
    )
  })

  it.each([
    ['unit', unitConfig],
    ['integration', integrationConfig],
  ])('the %s run collects none of test/a11y or test/e2e, nor playwright.config.ts', (_name, config) => {
    for (const file of [...browserFiles, 'playwright.config.ts']) expect(collected(config as typeof unitConfig, file), file).toBe(false)
  })

  it('the matcher does collect a unit test and an integration test (so the check above can fail)', () => {
    expect(collected(unitConfig, 'test/unit/features.test.ts')).toBe(true)
    expect(collected(integrationConfig as typeof unitConfig, 'test/integration/role-safety.test.ts')).toBe(true)
  })

  it('no vitest-named file sits in the Playwright folders, where Playwright would not run it and vitest would', () => {
    for (const file of browserFiles) expect(file, file).not.toMatch(/\.test\.tsx?$/)
  })

  it('Playwright runs only the spec files and the baseline, never a vitest file', () => {
    const unit = readdirSync(join(ROOT, 'test/unit')).filter((f) => /\.spec\.tsx?$/.test(f))
    expect(unit).toEqual([])
    const config = read('playwright.config.ts')
    expect(config).toContain("testDir: 'test/a11y'")
    expect(config).toContain("testDir: 'test/e2e'")
  })
})

describe('continuous integration', () => {
  const lines = fileLines('.github/workflows/ci.yml')
  const jobs = block(lines, /^jobs:\s*$/)
  const job = (name: string) => block(jobs, new RegExp(`^ {2}${name}:\\s*$`)).join('\n')

  it('has the existing check job and the new a11y job, and no other', () => {
    const names = jobs.filter((l) => /^ {2}\w/.test(l)).map((l) => l.trim().replace(/:$/, ''))
    expect(names).toEqual(['check', 'a11y'])
  })

  it('leaves the check job as it was: build, typecheck, test, integration, and no browser', () => {
    const check = job('check')
    expect(check).toMatch(/run: npm ci/)
    expect(check).toMatch(/run: npm run build/)
    expect(check).toMatch(/run: npm run typecheck:functions/)
    expect(check).toMatch(/run: npm test\b/)
    expect(check).toMatch(/run: npm run test:integration/)
    expect(check).not.toMatch(/playwright|a11y|e2e|if:/)
  })

  it('runs the a11y job on pull requests only, installing Chromium before the tests', () => {
    const a11y = job('a11y')
    expect(a11y).toMatch(/if: github\.event_name == 'pull_request'/)
    const install = a11y.indexOf('npx playwright install --with-deps chromium')
    const run = a11y.indexOf('npm run test:a11y')
    expect(install).toBeGreaterThan(-1)
    expect(run).toBeGreaterThan(install)
    expect(a11y.indexOf('npm ci')).toBeLessThan(install)
    // Nothing in it points at a remote database or the e2e project.
    expect(a11y).not.toMatch(/--remote|test:e2e|E2E_BASE_URL|secrets\./)
  })

  it('does not run on a schedule or by hand just for the browser tests (the e2e workflow does that)', () => {
    expect(lines.join('\n')).not.toMatch(/^\s*schedule:/m)
    expect(lines.join('\n')).not.toMatch(/test:e2e/)
  })
})

describe('ignored and committed files', () => {
  const ignored = (path: string) => spawnSync('git', ['check-ignore', '-q', '--no-index', path], { cwd: ROOT }).status === 0

  // Each server has its own local database folder inside .wrangler/a11y (on
  // and off), since two servers on one SQLite file locked each other out
  // ("database is locked: SQLITE_BUSY"); both folders' files are ignored.
  it.each(['dist-a11y-on/index.html', 'dist-a11y-off/assets/x.js', '.wrangler/a11y/on/v3/d1/x.sqlite', '.wrangler/a11y/off/v3/d1/x.sqlite', 'test-results/x/trace.zip', 'playwright-report/index.html'])(
    'ignores %s',
    (path) => {
      expect(ignored(path)).toBe(true)
    },
  )

  it.each([
    '.dev.vars.a11y',
    'playwright.config.ts',
    'test/a11y/baseline.json',
    'test/a11y/known-violations.json',
    'test/a11y/baseline.ts',
    'scripts/seed/fixtures.sql',
    'test/e2e/register-family.spec.ts',
  ])('commits %s', (path) => {
    expect(ignored(path)).toBe(false)
  })

  it('still ignores the real .dev.vars', () => {
    expect(ignored('.dev.vars')).toBe(true)
  })
})

describe('.dev.vars.a11y holds fake values only', () => {
  const text = read('.dev.vars.a11y')
  const entries = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)] as const)
  const values = Object.fromEntries(entries)
  const toml = parse(read('wrangler.toml')) as { vars: Record<string, string> }

  it('says in its header that the values are fake', () => {
    expect(text.split('\n')[0]).toBe('# .dev.vars.a11y')
    expect(text).toMatch(/Fake values only/)
  })

  it('is one NAME=value per line, which is what playwright.config.ts accepts', () => {
    for (const [name, value] of entries) {
      expect(name).toMatch(/^[A-Z][A-Z0-9_]*$/)
      expect(value).toMatch(/^[A-Za-z0-9._:/@-]*$/)
    }
    expect(new Set(entries.map(([n]) => n)).size).toBe(entries.length)
  })

  it('points sign-in at a closed local port, so no sign-in can work', () => {
    expect(values.SUPABASE_URL).toBe('http://127.0.0.1:9')
    expect(values.SUPABASE_SERVICE_ROLE_KEY).toMatch(/fake/)
  })

  it('has no live key, no real host and no real address', () => {
    for (const [name, value] of entries) {
      expect(value, name).not.toMatch(/^(sk|pk|rk)_(live|test)_/)
      expect(value, name).not.toMatch(/^re_/)
      expect(value, name).not.toMatch(/louisianachess|gmail|supabase\.co|stripe\.com|resend/i)
      if (value.includes('@')) expect(value, name).toMatch(/@example\.org$/)
      if (/^https?:/.test(value)) expect(new URL(value).hostname, name).toBe('127.0.0.1')
    }
  })

  it('leaves out the keys that could charge a card, send mail or read a page', () => {
    for (const name of ['STRIPE_SECRET_KEY', 'RESEND_API_KEY', 'FACEBOOK_PAGE_TOKEN', 'ANTHROPIC_API_KEY'])
      expect(values[name], name).toBeUndefined()
    expect(Object.keys(values).filter((n) => /STRIPE|RESEND|FACEBOOK|TOKEN/.test(n) && !/WEBHOOK/.test(n))).toEqual([])
  })

  it('every setting the functions read is a fake value here, bound empty, or a database or storage binding', () => {
    const used = new Set<string>()
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`
        if (entry.isDirectory()) walk(path)
        else if (/\.tsx?$/.test(entry.name)) for (const m of read(path).matchAll(/\benv\??\.([A-Z][A-Z0-9_]+)/g)) used.add(m[1])
      }
    }
    walk('functions')
    expect(used.size).toBeGreaterThan(5)
    const resources = ['DB', 'CLUB_LOGOS']
    for (const name of used) {
      const covered = name in values || (A11Y_EMPTY_SECRETS as readonly string[]).includes(name) || resources.includes(name)
      expect(covered, `functions read env.${name}; add it to .dev.vars.a11y (fake) or A11Y_EMPTY_SECRETS`).toBe(true)
    }
  })

  it('the servers bind every line of this file, bind each real secret empty, and never copy the shell environment', () => {
    const args = a11yServerArgs()
    // Nothing but bindings: a -b value overrides .dev.vars, .env and the shell.
    expect(args.filter((_, i) => i % 2 === 0).every((a) => a === '-b')).toBe(true)
    const bound = args.filter((_, i) => args[i - 1] === '-b')
    for (const [name, value] of entries) expect(bound, name).toContain(`${name}=${value}`)
    for (const name of A11Y_EMPTY_SECRETS) expect(bound, name).toContain(`${name}=`)
    expect(bound.length).toBe(entries.length + A11Y_EMPTY_SECRETS.length)
    expect(A11Y_SERVER_ENV.CLOUDFLARE_INCLUDE_PROCESS_ENV).toBe('false')
    expect(A11Y_SERVER_ENV.WRANGLER_SEND_METRICS).toBe('false')
    const config = read('playwright.config.ts')
    expect(config).toContain('...a11yServerArgs()')
    expect(config).toContain('env: A11Y_SERVER_ENV')
  })

  it('refuses a settings file that sets one of the secrets, or a line that is not plain NAME=value', () => {
    expect(() => a11yServerArgs('STRIPE_SECRET_KEY=sk_test_x\n')).toThrow(/must hold empty/)
    expect(() => a11yServerArgs('SITE_URL=http://x $(rm -rf /)\n')).toThrow(/not a plain NAME=value/)
    expect(a11yServerArgs('# comment\n\nSITE_URL=http://127.0.0.1:1\n')).toContain('SITE_URL=http://127.0.0.1:1')
  })

  it('replaces every wrangler.toml [vars] value that names the live site or the real sign-in service', () => {
    const live = Object.entries(toml.vars).filter(([name, v]) => !name.startsWith('VITE_') && /louisianachess|supabase\.co/.test(v))
    expect(live.length).toBeGreaterThan(0)
    for (const [name, value] of live) {
      expect(values[name], `${name} (${value}) would reach the live site or the real service`).toBeDefined()
      expect(values[name], name).not.toBe(value)
    }
  })

  it('the build-time twins of those settings are also set on the command line by the setup script', () => {
    const setup = read('test/a11y/global-setup.ts')
    for (const name of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_GOOGLE_MAPS_API_KEY', 'VITE_SITE_URL', 'VITE_FLAGS'])
      expect(setup, name).toContain(`${name}:`)
    // Never an address taken from wrangler.toml or a dotfile.
    expect(setup).not.toMatch(/louisianachess|supabase\.co/)
    expect(setup).toContain("'--mode', 'a11y'")
    expect(setup).toContain('--local')
    expect(setup).not.toMatch(/--remote/)
  })
})

describe('test/a11y/baseline.json', () => {
  const baseline = json('test/a11y/baseline.json')
  const css = read('src/index.css')
  /** The value a token has in src/index.css: in the light :root block, else in a @theme block. */
  const token = (name: string) => {
    const rootAt = css.search(/^:root \{/m)
    const darkAt = css.search(/^\.dark \{/m)
    const light = css.slice(rootAt, darkAt)
    const m = light.match(new RegExp(`${name}:\\s*([^;]+);`)) ?? css.match(new RegExp(`${name}:\\s*([^;]+);`))
    if (!m) throw new Error(`${name} not found in src/index.css`)
    return m[1].trim()
  }
  const hexToRgb = (hex: string) => {
    const n = parseInt(hex.slice(1), 16)
    return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`
  }

  it('records the four elements on the four pages, light, in the build with no switches', () => {
    expect(baseline.build).toBe('a11y-off')
    expect(baseline.colorScheme).toBe('light')
    expect(Object.keys(baseline.routes)).toEqual(['/', '/tournaments', '/membership', '/tournaments/fx-t-done'])
    for (const route of Object.values<any>(baseline.routes)) expect(Object.keys(route)).toEqual(['body', 'button', 'tableHeader', 'mono']) // eslint-disable-line @typescript-eslint/no-explicit-any
  })

  it('has a colour and a font for every element it found, as a painted pixel too', () => {
    let found = 0
    for (const [path, route] of Object.entries<any>(baseline.routes)) { // eslint-disable-line @typescript-eslint/no-explicit-any
      for (const [key, m] of Object.entries<any>(route)) { // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!m.found) {
          expect(Object.keys(m), `${path} ${key}`).toEqual(['found'])
          continue
        }
        found++
        expect(m.color, `${path} ${key}`).toBeTruthy()
        expect(m.backgroundColor).toBeTruthy()
        expect(m.borderColor).toBeTruthy()
        expect(m.fontFamily).toBeTruthy()
        for (const prop of ['color', 'backgroundColor', 'borderColor']) {
          expect(m.pixels[prop], `${path} ${key} ${prop}`).toHaveLength(4)
          for (const v of m.pixels[prop] as number[]) {
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThanOrEqual(255)
          }
        }
      }
    }
    // Each of body, a button, a table header and a monospace element is found somewhere.
    expect(found).toBeGreaterThanOrEqual(8)
    for (const key of ['body', 'button', 'tableHeader', 'mono']) {
      expect(Object.values<any>(baseline.routes).some((r) => r[key].found), key).toBe(true) // eslint-disable-line @typescript-eslint/no-explicit-any
    }
  })

  it('the body is the legacy tokens of src/index.css: foreground on background, border, and the sans font', () => {
    for (const route of Object.values<any>(baseline.routes)) { // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(route.body.color).toBe(token('--foreground'))
      expect(route.body.backgroundColor).toBe(token('--background'))
      expect(route.body.borderColor).toBe(token('--border'))
      expect(route.body.fontFamily).toBe(token('--font-sans').replace(/'/g, '"'))
    }
  })

  it('the default Button is navy on gold, the brand colours of src/index.css', () => {
    const navy = hexToRgb(token('--color-lca-navy'))
    const gold = hexToRgb(token('--color-lca-gold'))
    expect(navy).toBe('rgb(26, 39, 68)')
    expect(gold).toBe('rgb(200, 169, 74)')
    for (const [path, route] of Object.entries<any>(baseline.routes)) { // eslint-disable-line @typescript-eslint/no-explicit-any
      const b = route.button
      if (b.found && b.variant === 'default') {
        expect(b.color, path).toBe(navy)
        expect(b.backgroundColor, path).toBe(gold)
      }
    }
  })

  it('the table header and the monospace element are measured on the finished event, with the system monospace stack', () => {
    const done = baseline.routes['/tournaments/fx-t-done']
    expect(done.tableHeader.found).toBe(true)
    expect(done.tableHeader.color).toBe(hexToRgb(token('--color-lca-navy')))
    expect(done.mono.found).toBe(true)
    expect(done.mono.fontFamily).toMatch(/^ui-monospace, /)
    expect(done.mono.fontFamily).toMatch(/monospace$/)
    expect(done.mono.color).toBe(token('--muted-foreground'))
  })

  it('A11Y_BASELINE=record is the only way the file is rewritten', () => {
    const source = read('test/a11y/baseline.ts')
    expect(source).toMatch(/!existsSync\(BASELINE\) \|\| process\.env\.A11Y_BASELINE === 'record'/)
    expect(source.match(/writeFileSync\(/g)).toHaveLength(1)
    expect(source).toContain('COLOUR_TOLERANCE = 2')
  })
})

describe('test/a11y/known-violations.json', () => {
  const known = json('test/a11y/known-violations.json')

  it('says what the sweep in step 32 did with it and that nothing new may be added', () => {
    expect(known.comment).toMatch(/step 32/)
    expect(known.comment).toMatch(/nothing new may be added/)
  })

  it('lists each finding by build, page, rule id and selector', () => {
    expect(known.violations.length).toBeGreaterThan(0)
    for (const v of known.violations) {
      expect(['a11y-on', 'a11y-off']).toContain(v.project)
      expect(v.route).toBe('/')
      expect(v.rule).toMatch(/^[a-z0-9-]+$/)
      expect(v.selector).toBeTruthy()
      // A selector that matched everything would hide new findings.
      expect(v.selector).not.toMatch(/^\*$|^body$|^html$|^main$|^div$/)
    }
    const keys = known.violations.map((v: any) => [v.project, v.route, v.rule, v.selector].join('|')) // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('lists today\'s findings for the build with no switch on, and none for the build with the switches on (step 32)', () => {
    // Until step 32 the two builds listed the same nine. The sweep found
    // none of them under the new look, so the a11y-on entries came out and
    // that build fails on any finding at all; the a11y-off entries are the
    // site as it is today, three muted grey lines and the slideshow's dots.
    const forProject = (p: string) => known.violations.filter((v: any) => v.project === p).map((v: any) => `${v.rule}|${v.selector}`).sort() // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(forProject('a11y-on')).toEqual([])
    const today = forProject('a11y-off')
    expect(today.filter((k) => k.startsWith('color-contrast|'))).toHaveLength(3)
    expect(today.filter((k) => k.startsWith('target-size|'))).toHaveLength(6)
    expect(today).toHaveLength(9)
  })

  it('only names real axe rules, and none of them is a rule turned off', () => {
    const axeSource = read('node_modules/axe-core/axe.min.js')
    for (const v of known.violations) expect(axeSource, v.rule).toContain(`id:"${v.rule}"`)
    const smoke = read('test/a11y/smoke.spec.ts')
    expect(smoke).not.toMatch(/disableRules|\.exclude\(|disableRules\(/)
    expect(smoke).toContain("'wcag22aa'")
  })
})

describe('the files of the browser test layer', () => {
  /** The names of the tools such a file must not mention, split up so this file does not mention them either. */
  const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'l' + 'lm', 'co-authored' + '-by'].join('|')})\\b`, 'i')
  /** An en dash or an em dash, written by code so this file holds neither. */
  const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
  const FILES = [
    'playwright.config.ts',
    'test/a11y/global-setup.ts',
    'test/a11y/support.ts',
    'test/a11y/chrome.ts',
    'test/a11y/smoke.spec.ts',
    'test/a11y/baseline.ts',
    'test/a11y/builds.spec.ts',
    'test/a11y/seeded-data.spec.ts',
    'test/a11y/axe-detects.spec.ts',
    'test/a11y/components.spec.ts',
    'test/a11y/components-edges.spec.ts',
    'test/a11y/chess-data.spec.ts',
    'test/a11y/chess-data-edges.spec.ts',
    'test/a11y/brand.spec.ts',
    'test/a11y/brand-edges.spec.ts',
    'test/a11y/home.spec.ts',
    'test/a11y/home-edges.spec.ts',
    'test/a11y/heritage.spec.ts',
    'test/a11y/scopes.spec.ts',
    'test/a11y/known-violations.json',
    'test/e2e/register-family.spec.ts',
    'test/e2e/publish-round.spec.ts',
    'scripts/seed/fixtures.sql',
    '.dev.vars.a11y',
    '.github/workflows/e2e-preview.yml',
    'src/pages/fixtures/ScopeFixturePage.tsx',
    'test/unit/feature-overrides.test.ts',
    'test/unit/seed-fixtures.test.ts',
    'test/unit/seed-fixtures-edges.test.ts',
    'test/unit/e2e-preview-guard.test.ts',
    'test/unit/e2e-preview-workflow.test.ts',
    'test/unit/browser-test-wiring.test.ts',
  ]

  it.each(FILES)('%s has no em dash, no en dash and no reference to a tool that wrote it', (file) => {
    const text = read(file)
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(TOOLS)
    expect(text).not.toMatch(/\bAI\b/)
  })

  it.each(['src/pages/fixtures/ScopeFixturePage.tsx', 'test/e2e/register-family.spec.ts', 'test/e2e/publish-round.spec.ts', 'scripts/seed/fixtures.sql'])(
    '%s writes US Chess, not USCF, wherever a person would read it',
    (file) => {
      // The seed's uscf_id and uscf_rating are column names and the e2e specs use no such text.
      const text = read(file).replace(/uscf_(id|rating|expiration)/g, '')
      expect(text).not.toMatch(/uscf/i)
    },
  )
})
