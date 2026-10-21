// test/a11y/global-setup.ts
//
// Prepares everything the accessibility tests run on, from a clean checkout:
//
//   1. builds the site twice with `vite build --mode a11y`:
//        dist-a11y-on   VITE_FLAGS=newLook,themeHeritage
//        dist-a11y-off  no switches turned on (the site as it is today)
//      The mode is what lets src/lib/features.ts read VITE_FLAGS and what
//      adds the /__fixtures/:name page; every value the build reads is given
//      on the command line here, so a developer's own .env files never leak
//      in (vite gives the process environment priority over .env files).
//   2. deletes .wrangler/a11y and builds a fresh local database for each
//      server in a folder of its own inside it:
//        .wrangler/a11y/on   for the a11y-on server (port 8801)
//        .wrangler/a11y/off  for the a11y-off server (port 8802)
//      each with
//        wrangler d1 migrations apply lca-db --local --persist-to <folder>
//      then scripts/seed/fixtures.sql loaded into it. Only ever --local: this
//      never touches a remote database. The two servers once shared one
//      folder, and under the parallel workers that one SQLite file answered
//      "database is locked: SQLITE_BUSY" now and then, so a page's data
//      request failed and the page drew its empty state. With a file each,
//      the two wrangler processes never open the same database.
//
// npm run test:a11y runs this, then Playwright, whose webServer entries in
// playwright.config.ts serve each build with `wrangler pages dev` on its own
// database built here. It runs before Playwright rather than as Playwright's
// globalSetup because Playwright starts its web servers before globalSetup,
// and the servers need the builds to exist. playwright.config.ts imports the
// folder names and ports from here, so the two cannot drift apart.
//
// Usage: node --no-warnings --experimental-strip-types test/a11y/global-setup.ts
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))

/**
 * The folder that holds the local databases. Each server's database is in a
 * folder of its own inside it (A11yVariant.persist), so that deleting this one
 * clears them all, and so that .gitignore's .wrangler/a11y/ covers them.
 */
export const A11Y_PERSIST = '.wrangler/a11y'

/** Where the seed comes from. */
export const SEED_FILE = 'scripts/seed/fixtures.sql'

/** A Supabase address that refuses connections at once: nothing can sign in. */
export const FAKE_SUPABASE_URL = 'http://127.0.0.1:9'

export interface A11yVariant {
  /** The Playwright project name. */
  name: 'a11y-on' | 'a11y-off'
  /** The build folder, at the repository root. */
  dist: string
  /** The switches the build turns on, comma-separated. */
  flags: string
  /** Where wrangler pages dev serves it. */
  port: number
  /** Each server needs its own inspector port, or the second one fails to start. */
  inspectorPort: number
  /**
   * The server's own local database folder (wrangler's --persist-to), inside
   * A11Y_PERSIST. No two servers share one, so neither ever waits on the
   * other's lock.
   */
  persist: string
}

export const A11Y_VARIANTS: readonly A11yVariant[] = [
  { name: 'a11y-on', dist: 'dist-a11y-on', flags: 'newLook,themeHeritage', port: 8801, inspectorPort: 9231, persist: `${A11Y_PERSIST}/on` },
  { name: 'a11y-off', dist: 'dist-a11y-off', flags: '', port: 8802, inspectorPort: 9232, persist: `${A11Y_PERSIST}/off` },
]

/** The environment every wrangler command here runs with. */
export const WRANGLER_ENV = { WRANGLER_SEND_METRICS: 'false', CI: process.env.CI ?? '1' }

/** The fake settings the two servers run with. Fake values only. */
export const A11Y_VARS_FILE = '.dev.vars.a11y'

/**
 * Secrets the functions read that the a11y servers must hold empty. Each is
 * passed to wrangler as an empty binding (-b NAME=), which overrides any value
 * a developer keeps in .dev.vars, .env or their shell, so no test server ever
 * holds a key that could charge a card, send mail, read the Facebook page or
 * call the scanning service. With an empty key every such call is refused,
 * but not every function stops before calling out: the Facebook feed and the
 * scanner check for a missing key first, while createCheckoutSession and the
 * Resend helpers still send their request to api.stripe.com or api.resend.com
 * (with no key, so it is refused there). Those requests run in the worker,
 * where page.route cannot stop them. test/unit/browser-test-wiring.test.ts
 * checks that every setting the functions read is either here, in
 * .dev.vars.a11y, or a database or storage binding.
 */
export const A11Y_EMPTY_SECRETS = [
  'STRIPE_SECRET_KEY',
  'RESEND_API_KEY',
  'FACEBOOK_PAGE_TOKEN',
  'FACEBOOK_PAGE_ID',
  'ANTHROPIC_API_KEY',
] as const

/**
 * The settings for `wrangler pages dev`, as command-line arguments:
 *
 * - one `-b NAME=value` per line of .dev.vars.a11y, which overrides the
 *   production values in wrangler.toml's [vars];
 * - one empty `-b NAME=` per name in A11Y_EMPTY_SECRETS.
 *
 * `wrangler pages dev` (4.112) still reads a developer's .dev.vars even when
 * --env-file is given, so that flag is not used: a -b binding overrides every
 * other source, which is what keeps a real key out of the servers. Only plain
 * NAME=value lines are allowed in the file, so nothing in it can change the
 * command.
 */
export function a11yServerArgs(text = readFileSync(join(ROOT, A11Y_VARS_FILE), 'utf8')): string[] {
  const args: string[] = []
  const named = new Set<string>()
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    if (!/^[A-Z][A-Z0-9_]*=[A-Za-z0-9._:/@-]*$/.test(line)) {
      throw new Error(`${A11Y_VARS_FILE} has a line that is not a plain NAME=value: "${line}"`)
    }
    const name = line.slice(0, line.indexOf('='))
    if ((A11Y_EMPTY_SECRETS as readonly string[]).includes(name)) {
      throw new Error(`${A11Y_VARS_FILE} sets ${name}, which the a11y servers must hold empty.`)
    }
    named.add(name)
    args.push('-b', line)
  }
  for (const name of A11Y_EMPTY_SECRETS) if (!named.has(name)) args.push('-b', `${name}=`)
  return args
}

/**
 * The environment the two servers run with. CLOUDFLARE_INCLUDE_PROCESS_ENV is
 * forced off so wrangler never copies a key from the developer's shell into
 * the functions.
 */
export const A11Y_SERVER_ENV = { ...WRANGLER_ENV, CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false' }

/**
 * Runs one step with node. With `quiet`, its output is shown only when it
 * fails (wrangler d1 execute prints a JSON result for every statement).
 */
function run(label: string, args: string[], env: Record<string, string> = {}, quiet = false): void {
  const started = Date.now()
  console.log(`[a11y setup] ${label}`)
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
    env: { ...process.env, ...env },
  })
  if (result.status !== 0) {
    if (quiet) console.error(`${result.stdout ?? ''}${result.stderr ?? ''}`)
    throw new Error(`[a11y setup] ${label} failed (exit ${result.status ?? result.signal}).`)
  }
  console.log(`[a11y setup] ${label}: done in ${((Date.now() - started) / 1000).toFixed(1)} s`)
}

const VITE = join(ROOT, 'node_modules/vite/bin/vite.js')
const WRANGLER = join(ROOT, 'node_modules/wrangler/bin/wrangler.js')

/** Builds one variant into its own folder. */
export function buildVariant(variant: A11yVariant): void {
  run(
    `build ${variant.dist} (VITE_FLAGS=${variant.flags || 'none'})`,
    [VITE, 'build', '--mode', 'a11y', '--outDir', variant.dist, '--emptyOutDir', '--logLevel', 'warn'],
    {
      NODE_ENV: 'production',
      VITE_FLAGS: variant.flags,
      VITE_SUPABASE_URL: FAKE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: 'fake-anon-key-for-a11y-tests',
      // Empty on purpose: the clubs map shows its "no key" message instead of
      // loading Google Maps.
      VITE_GOOGLE_MAPS_API_KEY: '',
      VITE_FORMSPREE_FORM_ID: '',
      VITE_SITE_URL: `http://127.0.0.1:${variant.port}`,
    },
  )
}

/**
 * Deletes one server's database folder and builds the seeded database in it:
 * the same migrations and the same seed for every server.
 */
export function buildDatabase(variant: A11yVariant): void {
  if (!variant.persist.startsWith(`${A11Y_PERSIST}/`)) {
    throw new Error(`[a11y setup] ${variant.persist} is not inside ${A11Y_PERSIST}.`)
  }
  rmSync(join(ROOT, variant.persist), { recursive: true, force: true })
  run(
    `apply migrations to the local a11y database in ${variant.persist}`,
    [WRANGLER, 'd1', 'migrations', 'apply', 'lca-db', '--local', '--persist-to', variant.persist],
    WRANGLER_ENV,
  )
  run(
    `load ${SEED_FILE} into ${variant.persist}`,
    [WRANGLER, 'd1', 'execute', 'lca-db', '--local', '--persist-to', variant.persist, `--file=${SEED_FILE}`, '--yes'],
    WRANGLER_ENV,
    true,
  )
}

export default async function globalSetup(): Promise<void> {
  for (const path of [VITE, WRANGLER]) {
    if (!existsSync(path)) throw new Error(`[a11y setup] ${path} is missing. Run npm ci first.`)
  }
  for (const variant of A11Y_VARIANTS) buildVariant(variant)
  // Whatever an earlier run left, the old shared database included, goes first.
  rmSync(join(ROOT, A11Y_PERSIST), { recursive: true, force: true })
  for (const variant of A11Y_VARIANTS) buildDatabase(variant)
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  globalSetup().catch((err: unknown) => {
    console.error((err as Error).message)
    process.exit(1)
  })
}
