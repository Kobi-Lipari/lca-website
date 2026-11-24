// test/a11y/global-setup.ts
//
// Prepares everything the accessibility tests run on, from a clean checkout:
//
//   1. builds the site twice with `vite build --mode a11y`:
//        dist-a11y-on   VITE_FLAGS=newLook,themeHeritage,newNav,siteSearch,eventStrip,eventStripLive,liveMarker
//        dist-a11y-off  no switches turned on (the site as it is today)
//      a11y-on turns on the new look, the heritage look and the five switches
//      of the new header, menus, footer, search and event strip, which show
//      only with the new look on as well (chromeOn in src/lib/nav.ts).
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
//   3. builds a third time, for the new club pages alone (WS09 step 24):
//        dist-a11y-clubs  the a11y-on build's switches and newClubs, nothing else
//      with its own database in .wrangler/a11y/clubs (port 8803), and makes
//      the folder its server runs from, .wrangler/a11y/clubs-server: a fresh
//      copy of functions/ in which the one line of
//      functions/utils/clubs/pages.ts that sets CLUB_PAGES_ON reads true,
//      with links to what the functions import from outside functions/ and
//      to what wrangler reads beside them (makeClubsServer). The tree's
//      constant stays false; only this server answers as with it set. The
//      setup stops with a plain error unless exactly that one line was found
//      and changed and the copy differs from functions/ by that line alone.
//      A11Y_VARIANTS stays the two builds every other reader means; the third
//      is A11Y_CLUBS_VARIANT, and A11Y_ALL_VARIANTS gives all three.
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
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
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
  { name: 'a11y-on', dist: 'dist-a11y-on', flags: 'newLook,themeHeritage,newNav,siteSearch,eventStrip,eventStripLive,liveMarker', port: 8801, inspectorPort: 9231, persist: `${A11Y_PERSIST}/on` },
  { name: 'a11y-off', dist: 'dist-a11y-off', flags: '', port: 8802, inspectorPort: 9232, persist: `${A11Y_PERSIST}/off` },
]

/** The a11y-on build's switches, read from its own entry, so the clubs build cannot drift from it. */
function a11yOnFlags(): string {
  const on = A11Y_VARIANTS.find((v) => v.name === 'a11y-on')
  if (!on || !on.flags) throw new Error('[a11y setup] the a11y-on build has no switches to build the clubs build from.')
  return on.flags
}

/** The folder the clubs build's server runs from: a copy of functions/, made afresh by every setup run. */
export const A11Y_CLUBS_SERVER = `${A11Y_PERSIST}/clubs-server`

/**
 * The clubs build: a variant of its own type, so that A11yVariant, which the
 * readers of the two builds take their names from, stays the two names.
 */
export interface A11yClubsVariant extends Omit<A11yVariant, 'name'> {
  name: 'a11y-clubs'
  /** The folder the server runs from, inside A11Y_PERSIST: its copy of functions/ (makeClubsServer). */
  serveFrom: string
}

/** Any of the three builds. */
export type AnyA11yVariant = A11yVariant | A11yClubsVariant

/**
 * The third build, for the new club pages alone: the a11y-on build's seven
 * switches and newClubs, nothing else, on its own port, inspector port and
 * database, served from A11Y_CLUBS_SERVER. Only the clubs pages' own spec
 * files (test/a11y/clubs-*.spec.ts) run on it. It is not in A11Y_VARIANTS,
 * which every reader that means the two builds goes on reading.
 */
export const A11Y_CLUBS_VARIANT: A11yClubsVariant = {
  name: 'a11y-clubs',
  dist: 'dist-a11y-clubs',
  flags: `${a11yOnFlags()},newClubs`,
  port: 8803,
  inspectorPort: 9233,
  persist: `${A11Y_PERSIST}/clubs`,
  serveFrom: A11Y_CLUBS_SERVER,
}

/** All three builds: the two, then the clubs build. The setup's loops and playwright.config.ts's projects and servers read this. */
export const A11Y_ALL_VARIANTS: readonly AnyA11yVariant[] = [...A11Y_VARIANTS, A11Y_CLUBS_VARIANT]

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
  // The keys of the links in optional email: with none, as on the Preview environment, no link is signed and every link
  // answers that it isn't working.
  'MAIL_LINK_SECRET',
  'MAIL_LINK_SECRET_PREVIOUS',
  'SES_ACCESS_KEY_ID',
  'SES_SECRET_ACCESS_KEY',
  'SES_SNS_TOPIC_ARN',
  // The spam check's two keys: with none, as on the Preview environment until K sets them, a form that checks refuses in words.
  'TURNSTILE_SECRET_KEY',
  'VITE_TURNSTILE_SITE_KEY',
  // The secret of the expiring tokens in links: with none, as on the Preview environment until K sets it, no token is made.
  'SIGNING_SECRET',
  'SIGNING_SECRET_PREVIOUS',
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
export function buildVariant(variant: AnyA11yVariant): void {
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
export function buildDatabase(variant: AnyA11yVariant): void {
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

/** The one file of functions/ the clubs server's copy changes, by its path inside functions/. */
export const CLUB_PAGES_FILE = 'utils/clubs/pages.ts'

/** The line of that file the copy changes, as the tree holds it, and as the copy holds it. */
export const CLUB_PAGES_LINE = { tree: 'export const CLUB_PAGES_ON = false', copy: 'export const CLUB_PAGES_ON = true' } as const

/**
 * What the clubs server's folder reaches in the repository by a link rather
 * than a copy: the folders outside functions/ the functions import from
 * (domain/, and src/ for one import of types alone), the installed packages,
 * and the two files wrangler reads beside functions/ (wrangler.toml, for the
 * database and storage bindings, and package.json). wrangler compiles and
 * serves through the links, so nothing else is copied.
 */
export const A11Y_CLUBS_LINKS = ['domain', 'src', 'node_modules', 'wrangler.toml', 'package.json'] as const

/** Every file under a folder, by its path inside it with / between parts, in order. Refuses a link, which a copy would follow. */
function filesUnder(dir: string, inside = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(join(dir, inside), { withFileTypes: true })) {
    const path = inside ? `${inside}/${entry.name}` : entry.name
    if (entry.isSymbolicLink()) throw new Error(`[a11y setup] ${path} in ${dir} is a link; functions/ must hold files only.`)
    if (entry.isDirectory()) out.push(...filesUnder(dir, path))
    else out.push(path)
  }
  return out.sort()
}

/** The file's text with the one CLUB_PAGES_ON line set; throws unless the line is there exactly once. */
export function setClubPagesLine(text: string): string {
  const lines = text.split('\n')
  const at = lines.flatMap((line, i) => (line === CLUB_PAGES_LINE.tree ? [i] : []))
  if (at.length !== 1) {
    throw new Error(
      `[a11y setup] functions/${CLUB_PAGES_FILE} holds the line "${CLUB_PAGES_LINE.tree}" ${at.length} times, not once, so the clubs server cannot be made. Stopping.`,
    )
  }
  lines[at[0]] = CLUB_PAGES_LINE.copy
  return lines.join('\n')
}

/**
 * How the copy differs from the tree's functions/ other than by the one
 * line: a file one has and the other has not, a file whose bytes differ, or
 * in CLUB_PAGES_FILE any line but that one. An empty list is the copy as it
 * must be.
 */
export function copyDifferences(treeDir: string, copyDir: string): string[] {
  const problems: string[] = []
  const tree = filesUnder(treeDir)
  const copy = filesUnder(copyDir)
  for (const path of tree) if (!copy.includes(path)) problems.push(`${path} is missing from the copy`)
  for (const path of copy) if (!tree.includes(path)) problems.push(`${path} is in the copy and not in functions/`)
  for (const path of tree.filter((p) => copy.includes(p))) {
    const a = readFileSync(join(treeDir, path))
    const b = readFileSync(join(copyDir, path))
    if (path !== CLUB_PAGES_FILE) {
      if (!a.equals(b)) problems.push(`${path} differs`)
      continue
    }
    const before = a.toString('utf8').split('\n')
    const after = b.toString('utf8').split('\n')
    if (before.length !== after.length) {
      problems.push(`${path} has ${after.length} lines in the copy and ${before.length} in functions/`)
      continue
    }
    const changed = before.flatMap((line, i) => (line !== after[i] ? [i] : []))
    const one = changed.length === 1 && before[changed[0]] === CLUB_PAGES_LINE.tree && after[changed[0]] === CLUB_PAGES_LINE.copy
    if (!one) problems.push(`${path} differs in ${changed.length} lines, not in the one CLUB_PAGES_ON line alone`)
  }
  return problems
}

/** The names at the repository root that the copy's relative imports reach outside functions/. */
export function reachedOutside(folder: string): string[] {
  const reached = new Set<string>()
  for (const path of filesUnder(join(folder, 'functions'))) {
    if (!/\.[cm]?[jt]sx?$/.test(path)) continue
    const file = join(folder, 'functions', path)
    for (const m of readFileSync(file, 'utf8').matchAll(/\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]|\bimport\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
      const top = relative(folder, resolve(dirname(file), m[1] ?? m[2])).split(sep)[0]
      if (top !== 'functions') reached.add(top)
    }
  }
  return [...reached].sort()
}

/**
 * Makes the folder the clubs build's server runs from, afresh: a copy of
 * functions/ with the one CLUB_PAGES_ON line set, and a link to each of
 * A11Y_CLUBS_LINKS. Stops with a plain error unless exactly that one line
 * was found and changed, the copy differs from functions/ by that line
 * alone, and every folder the functions import from outside functions/ is
 * linked. The tree's functions/ is only read.
 */
export function makeClubsServer(): void {
  if (!A11Y_CLUBS_SERVER.startsWith(`${A11Y_PERSIST}/`)) throw new Error(`[a11y setup] ${A11Y_CLUBS_SERVER} is not inside ${A11Y_PERSIST}.`)
  const started = Date.now()
  const folder = join(ROOT, A11Y_CLUBS_SERVER)
  console.log(`[a11y setup] make ${A11Y_CLUBS_SERVER}: functions/ copied with CLUB_PAGES_ON set`)
  rmSync(folder, { recursive: true, force: true })
  mkdirSync(folder, { recursive: true })
  cpSync(join(ROOT, 'functions'), join(folder, 'functions'), { recursive: true })
  const file = join(folder, 'functions', CLUB_PAGES_FILE)
  writeFileSync(file, setClubPagesLine(readFileSync(file, 'utf8')))
  const problems = copyDifferences(join(ROOT, 'functions'), join(folder, 'functions'))
  if (problems.length > 0) throw new Error(`[a11y setup] the copy of functions/ in ${A11Y_CLUBS_SERVER} is not the tree's with one line set: ${problems.join('; ')}. Stopping.`)
  const unlinked = reachedOutside(folder).filter((name) => !(A11Y_CLUBS_LINKS as readonly string[]).includes(name))
  if (unlinked.length > 0) throw new Error(`[a11y setup] the functions import from ${unlinked.join(', ')}, which ${A11Y_CLUBS_SERVER} does not link. Stopping.`)
  for (const name of A11Y_CLUBS_LINKS) {
    const target = join(ROOT, name)
    if (!existsSync(target)) throw new Error(`[a11y setup] ${name} is missing. Run npm ci first.`)
    symlinkSync(target, join(folder, name), statSync(target).isDirectory() ? 'dir' : 'file')
  }
  console.log(`[a11y setup] make ${A11Y_CLUBS_SERVER}: done in ${((Date.now() - started) / 1000).toFixed(1)} s`)
}

export default async function globalSetup(): Promise<void> {
  for (const path of [VITE, WRANGLER]) {
    if (!existsSync(path)) throw new Error(`[a11y setup] ${path} is missing. Run npm ci first.`)
  }
  for (const variant of A11Y_ALL_VARIANTS) buildVariant(variant)
  // Whatever an earlier run left, the old shared database included, goes first.
  rmSync(join(ROOT, A11Y_PERSIST), { recursive: true, force: true })
  for (const variant of A11Y_ALL_VARIANTS) buildDatabase(variant)
  makeClubsServer()
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  globalSetup().catch((err: unknown) => {
    console.error((err as Error).message)
    process.exit(1)
  })
}
