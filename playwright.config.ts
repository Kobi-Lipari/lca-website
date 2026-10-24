// playwright.config.ts
//
// The browser tests. Three projects, none of them part of npm test or CI's
// build-and-test job:
//
// a11y-on and a11y-off (npm run test:a11y)
//   The site built twice with `vite build --mode a11y` by
//   test/a11y/global-setup.ts, which npm run test:a11y runs first: once with
//   the switches newLook, themeHeritage, newNav, siteSearch, eventStrip,
//   eventStripLive and liveMarker on (dist-a11y-on) and once with none
//   (dist-a11y-off, the site as visitors see it today). Each build is
//   served by `wrangler pages dev`, with the functions folder, on its own
//   port, on its own local database built from the migrations and
//   scripts/seed/fixtures.sql (.wrangler/a11y/on and .wrangler/a11y/off;
//   two servers on one SQLite file locked each other out now and then, and
//   a page whose data request met the lock drew its empty state). Each line
//   of .dev.vars.a11y (fake values only) is passed to wrangler as a binding,
//   replacing the production values in wrangler.toml's [vars], and every
//   real secret the functions read is bound empty (A11Y_EMPTY_SECRETS in
//   test/a11y/global-setup.ts), which overrides anything in a developer's own
//   .dev.vars, .env or shell. So no test can sign in or use a real service
//   (a checkout or an email may still send a request, which is refused for
//   want of a key; see A11Y_EMPTY_SECRETS).
//   The specs stub the Facebook feed in the browser.
//
// e2e-preview (npm run test:e2e)
//   Runs against a branch preview deployment named by E2E_BASE_URL. This
//   file refuses to start that project with no URL, or with a URL on
//   louisianachess.org (www or the bare domain), the Pages production
//   address, or a deployment's own address (<8 hex>.lca-website.pages.dev),
//   which for a production deployment runs on production data. It is run
//   by hand, or by .github/workflows/e2e-preview.yml, which runs only when
//   started by hand.
//
// Browser: CI installs Playwright's Chromium (npx playwright install
// --with-deps chromium). Where another Chromium is already installed, set
// PW_CHROMIUM_PATH to its executable to use that one instead.
import { defineConfig, devices } from '@playwright/test'
import { A11Y_SERVER_ENV, A11Y_VARIANTS, ROOT, a11yServerArgs } from './test/a11y/global-setup.ts'

/** Hosts the end-to-end tests must never run against: the live site. */
const PRODUCTION_HOSTS = ['louisianachess.org', 'lca-website.pages.dev', 'main.lca-website.pages.dev']

/**
 * A single deployment's own address, such as 1a2b3c4d.lca-website.pages.dev.
 * A production deployment's address runs with production's database and keys,
 * so none of these is accepted; a branch preview uses its branch name.
 */
const DEPLOYMENT_HOST = /^[0-9a-f]{8}\.lca-website\.pages\.dev$/

/**
 * The end-to-end base URL, checked. Throws, so Playwright refuses to start,
 * when it is empty, not a web address, or the live site.
 */
export function checkE2EBaseUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim()
  if (!value) {
    throw new Error('E2E_BASE_URL is empty. Set it to a branch preview address, such as https://my-branch.lca-website.pages.dev.')
  }
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`E2E_BASE_URL is not a web address: "${value}".`)
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`E2E_BASE_URL must start with https:// or http://, not "${url.protocol}".`)
  }
  const host = url.hostname.toLowerCase().replace(/\.+$/, '')
  const live = PRODUCTION_HOSTS.some((p) => host === p) || host.endsWith('.louisianachess.org') || DEPLOYMENT_HOST.test(host)
  if (live) {
    throw new Error(`E2E_BASE_URL points at the live site (${host}). The end-to-end tests run only against a branch preview.`)
  }
  return url.origin
}

/**
 * The projects this run asked for, from --project on the command line, or
 * "all" when none was named. Worked out once, in the main process, and handed
 * to the test workers through the environment, because the workers load this
 * file again with a different command line.
 */
function selectedProjects(): string[] | 'all' {
  const saved = process.env.LCA_PW_PROJECTS
  if (saved) return saved === 'all' ? 'all' : saved.split(',')
  const names: string[] = []
  const argv = process.argv
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--project') names.push(argv[i + 1] ?? '')
    else if (argv[i].startsWith('--project=')) names.push(argv[i].slice('--project='.length))
  }
  process.env.LCA_PW_PROJECTS = names.length > 0 ? names.join(',') : 'all'
  return names.length > 0 ? names : 'all'
}

const selected = selectedProjects()
const wants = (prefix: string) => selected === 'all' || selected.some((name) => name.startsWith(prefix) || name.includes('*'))

const e2eBaseURL = wants('e2e') ? checkE2EBaseUrl(process.env.E2E_BASE_URL) : undefined

const chromiumPath = process.env.PW_CHROMIUM_PATH
const launchOptions = chromiumPath ? { executablePath: chromiumPath } : {}

export default defineConfig({
  outputDir: 'test-results',
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices['Desktop Chrome'],
    launchOptions,
    trace: 'retain-on-failure',
  },
  projects: [
    ...A11Y_VARIANTS.map((variant) => ({
      name: variant.name,
      testDir: 'test/a11y',
      // The baseline is recorded from the site as it is today, so only the
      // build with no switches on runs it.
      testMatch: variant.name === 'a11y-off' ? [/\.spec\.ts$/, /baseline\.ts$/] : [/\.spec\.ts$/],
      use: { baseURL: `http://127.0.0.1:${variant.port}` },
    })),
    {
      name: 'e2e-preview',
      testDir: 'test/e2e',
      testMatch: [/\.spec\.ts$/],
      // A trace records every value typed into a form, the test passwords
      // included, and the workflow keeps the report, so this project records
      // no trace, screenshot or video.
      use: { baseURL: e2eBaseURL, trace: 'off', screenshot: 'off', video: 'off' },
    },
  ],
  webServer: wants('a11y')
    ? A11Y_VARIANTS.map((variant) => ({
        command: [
          'node node_modules/wrangler/bin/wrangler.js pages dev',
          variant.dist,
          `--ip 127.0.0.1 --port ${variant.port} --inspector-port ${variant.inspectorPort}`,
          // Each server on its own database, never the other's.
          `--persist-to ${variant.persist}`,
          '--show-interactive-dev-session=false --log-level warn',
          ...a11yServerArgs(),
        ].join(' '),
        url: `http://127.0.0.1:${variant.port}/`,
        cwd: ROOT,
        env: A11Y_SERVER_ENV,
        // Compiling the functions and starting the runtime takes a while.
        timeout: 180_000,
        // A server left over from another run could be serving another
        // database, so never reuse one.
        reuseExistingServer: false,
        stdout: 'ignore' as const,
        stderr: 'pipe' as const,
      }))
    : [],
})
