// K5, the end-to-end layer, covers three things this file checks:
//
// 1. playwright.config.ts refuses to start the e2e-preview project for an
//    empty E2E_BASE_URL and for any louisianachess.org host (www, the bare
//    domain, any subdomain, any spelling the URL parser folds to those) and
//    for the Pages production addresses. It is checked as a function, as the
//    config loads, and through the real Playwright command line.
// 2. test/e2e/register-family.spec.ts and test/e2e/publish-round.spec.ts are
//    pending (test.fixme) with their preconditions written out, and a real
//    run reports both as skipped without opening a browser.
// 3. The family spec reads the plan's child limit from the household domain
//    instead of writing the number again.
//
// Nothing here reaches a network, a browser or a remote database.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FAMILY_MEMBERSHIP_CHILDREN } from '../../domain/households/family'

const ROOT = resolve(__dirname, '../..')
const PLAYWRIGHT_CLI = join(ROOT, 'node_modules/@playwright/test/cli.js')
const BRANCH_PREVIEW = 'https://my-branch.lca-website.pages.dev'
/**
 * For the one real run: an address nothing answers on (port 9 refuses at
 * once), so even if a spec stopped being fixme, nothing would reach a preview.
 */
const UNROUTABLE = 'http://127.0.0.1:9'
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** Loads playwright.config.ts fresh, as Playwright does at the start of a run. */
async function loadConfig(env: { E2E_BASE_URL?: string; LCA_PW_PROJECTS?: string }) {
  vi.resetModules()
  vi.stubEnv('E2E_BASE_URL', env.E2E_BASE_URL ?? '')
  if (env.LCA_PW_PROJECTS === undefined) delete process.env.LCA_PW_PROJECTS
  else vi.stubEnv('LCA_PW_PROJECTS', env.LCA_PW_PROJECTS)
  return import('../../playwright.config.ts')
}

/** The Playwright command line with a clean environment (no inherited project choice or address). */
function playwright(args: string[], e2eBaseUrl?: string) {
  const env = { ...process.env }
  delete env.LCA_PW_PROJECTS
  delete env.E2E_BASE_URL
  delete env.CI
  if (e2eBaseUrl !== undefined) env.E2E_BASE_URL = e2eBaseUrl
  return spawnSync(process.execPath, [PLAYWRIGHT_CLI, 'test', ...args], { cwd: ROOT, env, encoding: 'utf8', timeout: 90_000 })
}

beforeEach(() => {
  delete process.env.LCA_PW_PROJECTS
})
afterEach(() => {
  vi.unstubAllEnvs()
  delete process.env.LCA_PW_PROJECTS
  vi.resetModules()
})

describe('checkE2EBaseUrl', () => {
  it.each([
    ['a branch preview', BRANCH_PREVIEW, BRANCH_PREVIEW],
    ['a branch preview with a path and query, reduced to its origin', `${BRANCH_PREVIEW}/tournaments?x=1`, BRANCH_PREVIEW],
    ['spaces around the address', `  ${BRANCH_PREVIEW}  `, BRANCH_PREVIEW],
    ['capital letters in the host', 'https://My-Branch.LCA-Website.Pages.Dev', BRANCH_PREVIEW],
    ['a local server', 'http://127.0.0.1:8788', 'http://127.0.0.1:8788'],
  ])('accepts %s', async (_name, raw, origin) => {
    const { checkE2EBaseUrl } = await loadConfig({ E2E_BASE_URL: BRANCH_PREVIEW })
    expect(checkE2EBaseUrl(raw)).toBe(origin)
  })

  it.each([
    ['nothing at all', undefined, /E2E_BASE_URL is empty/],
    ['an empty string', '', /E2E_BASE_URL is empty/],
    ['only spaces', '   ', /E2E_BASE_URL is empty/],
    ['words, not an address', 'my branch preview', /not a web address/],
    ['no scheme', 'my-branch.lca-website.pages.dev', /not a web address/],
    ['an ftp address', 'ftp://example.org/preview', /must start with https:\/\/ or http:\/\//],
    ['a file address', 'file:///etc/passwd', /must start with https:\/\/ or http:\/\//],
    ['a script address', 'javascript:alert(1)', /must start with https:\/\/ or http:\/\//],
  ])('refuses %s', async (_name, raw, message) => {
    const { checkE2EBaseUrl } = await loadConfig({ E2E_BASE_URL: BRANCH_PREVIEW })
    expect(() => checkE2EBaseUrl(raw)).toThrow(message)
  })

  it.each([
    'https://www.louisianachess.org',
    'https://www.louisianachess.org/',
    'http://www.louisianachess.org',
    'https://louisianachess.org',
    'louisianachess.org/x',
    'https://WWW.LouisianaChess.ORG/tournaments?x=1',
    'https://www.louisianachess.org:443',
    'https://www.louisianachess.org:8443/login',
    'https://louisianachess.org.',
    'https://www.louisianachess.org.',
    'https://user:secret@www.louisianachess.org',
    'https://anything.louisianachess.org',
    'https://staging.www.louisianachess.org',
    // The URL parser folds these to louisianachess.org, so they must be refused too.
    'https://louisianachess。org',
    'https://louisianachess.org\\@example.org',
    'https://lca-website.pages.dev',
    'https://main.lca-website.pages.dev',
    'https://LCA-Website.Pages.Dev/admin',
    'https://louisianachess.org..',
    // A single deployment's own address, which for a production deployment
    // runs on production data.
    'https://1a2b3c4d.lca-website.pages.dev',
    'https://0123ABCD.lca-website.pages.dev/register',
  ])('refuses the live site: %s', async (raw) => {
    const { checkE2EBaseUrl } = await loadConfig({ E2E_BASE_URL: BRANCH_PREVIEW })
    expect(() => checkE2EBaseUrl(raw)).toThrow()
  })

  it('says which host it refused, in plain words', async () => {
    const { checkE2EBaseUrl } = await loadConfig({ E2E_BASE_URL: BRANCH_PREVIEW })
    expect(() => checkE2EBaseUrl('https://www.louisianachess.org/x')).toThrow(
      'E2E_BASE_URL points at the live site (www.louisianachess.org). The end-to-end tests run only against a branch preview.',
    )
  })
})

describe('playwright.config.ts as Playwright loads it', () => {
  it('refuses to load for the e2e project when E2E_BASE_URL is empty', async () => {
    await expect(loadConfig({ LCA_PW_PROJECTS: 'e2e-preview', E2E_BASE_URL: '' })).rejects.toThrow(/E2E_BASE_URL is empty/)
  })

  it('refuses to load for the e2e project when E2E_BASE_URL is the live site', async () => {
    await expect(loadConfig({ LCA_PW_PROJECTS: 'e2e-preview', E2E_BASE_URL: 'https://www.louisianachess.org' })).rejects.toThrow(/live site/)
    await expect(loadConfig({ LCA_PW_PROJECTS: 'e2e-preview', E2E_BASE_URL: 'https://louisianachess.org' })).rejects.toThrow(/live site/)
  })

  it('checks the address too when no project is named, because every project would run', async () => {
    await expect(loadConfig({ LCA_PW_PROJECTS: 'all', E2E_BASE_URL: '' })).rejects.toThrow(/E2E_BASE_URL is empty/)
  })

  it('uses E2E_BASE_URL (as an origin) for the e2e project and nothing else', async () => {
    const { default: config } = await loadConfig({ LCA_PW_PROJECTS: 'e2e-preview', E2E_BASE_URL: `${BRANCH_PREVIEW}/some/path` })
    const e2e = config.projects?.find((p) => p.name === 'e2e-preview')
    expect(e2e?.use?.baseURL).toBe(BRANCH_PREVIEW)
    expect(e2e?.testDir).toBe('test/e2e')
    // Only the e2e project was asked for, so no local server is started.
    expect(config.webServer).toEqual([])
  })

  it('records no trace, screenshot or video for the e2e project, since a trace holds the typed passwords', async () => {
    const { default: config } = await loadConfig({ LCA_PW_PROJECTS: 'e2e-preview', E2E_BASE_URL: BRANCH_PREVIEW })
    const use = config.projects?.find((p) => p.name === 'e2e-preview')?.use
    expect(use?.trace).toBe('off')
    expect(use?.screenshot).toBe('off')
    expect(use?.video).toBe('off')
  })

  it('does not need an address for the accessibility projects, and does not point the e2e project anywhere', async () => {
    const { default: config } = await loadConfig({ LCA_PW_PROJECTS: 'a11y-on,a11y-off', E2E_BASE_URL: '' })
    const names = (config.projects ?? []).map((p) => p.name)
    expect(names).toEqual(['a11y-on', 'a11y-off', 'e2e-preview'])
    expect(config.projects?.find((p) => p.name === 'e2e-preview')?.use?.baseURL).toBeUndefined()
  })

  it('serves each accessibility build on its own port from its own local database, with fake settings only', async () => {
    const { default: config } = await loadConfig({ LCA_PW_PROJECTS: 'a11y-on,a11y-off' })
    const servers = Array.isArray(config.webServer) ? config.webServer : config.webServer ? [config.webServer] : []
    expect(servers).toHaveLength(2)

    const [on, off] = servers
    expect(on.command).toContain('pages dev dist-a11y-on')
    expect(off.command).toContain('pages dev dist-a11y-off')
    const port = (cmd: string) => cmd.match(/--port (\d+)/)?.[1]
    const inspector = (cmd: string) => cmd.match(/--inspector-port (\d+)/)?.[1]
    expect(port(on.command as string)).not.toBe(port(off.command as string))
    expect(inspector(on.command as string)).not.toBe(inspector(off.command as string))
    expect(on.url).toBe(`http://127.0.0.1:${port(on.command as string)}/`)
    expect(off.url).toBe(`http://127.0.0.1:${port(off.command as string)}/`)

    const devVars = read('.dev.vars.a11y')
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'))
    expect(devVars.length).toBeGreaterThan(0)
    // Two servers on one SQLite file locked each other out now and then
    // ("database is locked: SQLITE_BUSY"), so each has a folder of its own.
    const persist = (cmd: string) => cmd.match(/--persist-to (\S+)/)?.[1]
    expect(persist(on.command as string)).toBe('.wrangler/a11y/on')
    expect(persist(off.command as string)).toBe('.wrangler/a11y/off')
    for (const server of servers) {
      const command = server.command as string
      expect(command.match(/--persist-to /g)).toHaveLength(1)
      expect(command).toContain('--ip 127.0.0.1')
      // A reused server could be serving another database or another build.
      expect(server.reuseExistingServer).toBe(false)
      // Never a remote database or the Cloudflare account.
      expect(command).not.toMatch(/--remote|--experimental-remote|--env preview|lca-db-preview/)
      for (const line of devVars) expect(command).toContain(`-b ${line.trim()}`)
      expect(command).toContain('-b SUPABASE_URL=http://127.0.0.1:9')
      expect(server.env).toMatchObject({ WRANGLER_SEND_METRICS: 'false' })
    }
  })

  it('maps the projects to their own folders', async () => {
    const { default: config } = await loadConfig({ LCA_PW_PROJECTS: 'a11y-on,a11y-off' })
    const dirs = Object.fromEntries((config.projects ?? []).map((p) => [p.name, p.testDir]))
    expect(dirs).toEqual({ 'a11y-on': 'test/a11y', 'a11y-off': 'test/a11y', 'e2e-preview': 'test/e2e' })
    const match = (name: string, file: string) =>
      [config.projects?.find((p) => p.name === name)?.testMatch ?? []].flat().some((m) => (m as RegExp).test(file))
    // The baseline is recorded from the site as it is today only.
    expect(match('a11y-off', 'baseline.ts')).toBe(true)
    expect(match('a11y-on', 'baseline.ts')).toBe(false)
    expect(match('a11y-on', 'smoke.spec.ts')).toBe(true)
  })
})

describe('the Playwright command line', () => {
  it('refuses to start the e2e project with no address', () => {
    const r = playwright(['--project=e2e-preview', '--list'], '')
    expect(r.status).not.toBe(0)
    expect(`${r.stdout}${r.stderr}`).toMatch(/E2E_BASE_URL is empty/)
  })

  it.each(['https://www.louisianachess.org', 'https://louisianachess.org', 'https://lca-website.pages.dev'])(
    'refuses to start the e2e project against %s',
    (url) => {
      const r = playwright(['--project=e2e-preview', '--list'], url)
      expect(r.status).not.toBe(0)
      expect(`${r.stdout}${r.stderr}`).toMatch(/points at the live site/)
      expect(`${r.stdout}${r.stderr}`).not.toMatch(/Total: \d+ tests?/)
    },
  )

  it('lists both end-to-end specs for a branch preview', () => {
    const r = playwright(['--project=e2e-preview', '--list'], BRANCH_PREVIEW)
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toContain('test/e2e/register-family.spec.ts')
    expect(r.stdout).toContain('test/e2e/publish-round.spec.ts')
    expect(r.stdout).toMatch(/Total: 2 tests in 2 files/)
  })

  it('does not ask for an address when only the accessibility projects are named', () => {
    const r = playwright(['--project=a11y-on', '--project=a11y-off', '--list'])
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).not.toContain('test/e2e')
  })

  it('reports both end-to-end specs as skipped (fixme) and runs nothing against the address', () => {
    const r = playwright(['--project=e2e-preview', '--reporter=json'], UNROUTABLE)
    expect(r.status, r.stderr).toBe(0)
    const report = JSON.parse(r.stdout) as {
      stats: { expected: number; unexpected: number; flaky: number; skipped: number }
      suites: Array<{ file: string; suites?: unknown[]; specs?: unknown[] }>
    }
    expect(report.stats).toMatchObject({ expected: 0, unexpected: 0, flaky: 0, skipped: 2 })

    const tests: Array<{ file: string; status: string; annotations: Array<{ type: string }> }> = []
    const walk = (suite: { file?: string; suites?: unknown[]; specs?: unknown[] }) => {
      for (const spec of (suite.specs ?? []) as Array<{ file: string; tests: Array<{ status: string; annotations: Array<{ type: string }> }> }>) {
        for (const t of spec.tests) tests.push({ file: spec.file, status: t.status, annotations: t.annotations })
      }
      for (const child of (suite.suites ?? []) as Array<typeof suite>) walk(child)
    }
    for (const s of report.suites) walk(s)
    expect(tests.map((t) => t.file).sort()).toEqual(['test/e2e/publish-round.spec.ts', 'test/e2e/register-family.spec.ts'])
    for (const t of tests) {
      expect(t.status).toBe('skipped')
      expect(t.annotations.map((a) => a.type)).toContain('fixme')
    }
  }, 90_000)
})

describe('the end-to-end specs', () => {
  const family = read('test/e2e/register-family.spec.ts')
  const publish = read('test/e2e/publish-round.spec.ts')

  it.each([
    ['register-family.spec.ts', family],
    ['publish-round.spec.ts', publish],
  ])('%s is pending: every test is test.fixme and none is a live test()', (_name, source) => {
    expect(source).toMatch(/test\.fixme\(/)
    // test( on its own would run against the preview; test.step( and test.describe( are fine.
    expect(source.match(/(^|[^.\w])test\(/gm) ?? []).toEqual([])
    expect(source).not.toMatch(/\btest\.skip\(|\btest\.only\(|\.only\(/)
  })

  it.each([
    ['register-family.spec.ts', family],
    ['publish-round.spec.ts', publish],
  ])('%s spells out the preconditions the workflow asks for', (_name, source) => {
    const header = source.slice(0, source.indexOf('import '))
    expect(header).toMatch(/Preconditions/)
    for (const phrase of ['[env.preview]', 'E2E_BASE_URL', 'db:migrate:preview', 'db:seed:preview', 'Stripe test keys', 'test login']) {
      expect(header, phrase).toContain(phrase)
    }
    // Five numbered preconditions, in order.
    for (const n of [1, 2, 3, 4, 5]) expect(header).toMatch(new RegExp(`^//   ${n}\\. `, 'm'))
  })

  it('the family spec names WS06 and the publish spec names WS07 and WS08', () => {
    expect(family).toMatch(/WS06/)
    expect(publish).toMatch(/WS07/)
    expect(publish).toMatch(/WS08/)
  })

  it('each spec uses test accounts from the environment and writes no password', () => {
    expect(family).toContain('process.env.E2E_GUARDIAN_EMAIL')
    expect(family).toContain('process.env.E2E_GUARDIAN_PASSWORD')
    expect(publish).toContain('process.env.E2E_DIRECTOR_EMAIL')
    expect(publish).toContain('process.env.E2E_DIRECTOR_PASSWORD')
    for (const source of [family, publish]) {
      expect(source).not.toMatch(/fill\(\s*['"`][^'"`]*@/)
      expect(source).not.toMatch(/louisianachess/i)
      expect(source).not.toMatch(/https?:\/\//)
    }
  })

  it('both specs work from the seed: the open event, and made-up names', () => {
    expect(family).toContain("EVENT_ID = 'fx-t-open'")
    expect(publish).toContain("EVENT_ID = 'fx-t-open'")
    expect(read('scripts/seed/fixtures.sql')).toContain("'fx-t-open'")
  })

  it('the family spec reads the plan limit from domain/households/family', () => {
    expect(family).toMatch(/import \{ FAMILY_MEMBERSHIP_CHILDREN \} from '\.\.\/\.\.\/domain\/households\/family'/)
    expect(Number.isInteger(FAMILY_MEMBERSHIP_CHILDREN)).toBe(true)
    expect(FAMILY_MEMBERSHIP_CHILDREN).toBeGreaterThan(0)
    // The limit is used in the step title, the fill loop and the final count.
    expect((family.match(/FAMILY_MEMBERSHIP_CHILDREN/g) ?? []).length).toBeGreaterThanOrEqual(5)
    // No child count is written as a number next to the plan's assertions.
    expect(family).not.toMatch(/family-child'\)\)\.toHaveCount\(\d/)
    expect(family).not.toMatch(/i < \d/)
    expect(family).not.toMatch(/covers \$\{?\d/)
  })

  it('the family spec has the step that a further child is not covered by the plan', () => {
    expect(family).toMatch(/the Family plan covers at most \$\{FAMILY_MEMBERSHIP_CHILDREN\} children/)
    expect(family).toContain('Scholastic membership')
    expect(family).toMatch(/toHaveCount\(FAMILY_MEMBERSHIP_CHILDREN\)/)
  })

  it('the publish spec checks the round is hidden before publishing and visible after', () => {
    const before = publish.indexOf('shows nothing for round 1 yet')
    const publishStep = publish.indexOf("name: 'Publish round'")
    const after = publish.indexOf('a signed-out visitor sees round 1')
    expect(before).toBeGreaterThan(-1)
    expect(publishStep).toBeGreaterThan(before)
    expect(after).toBeGreaterThan(publishStep)
  })
})
