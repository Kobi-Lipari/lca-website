// scripts/perf-home.ts
//
// The homepage's lab performance check (npm run perf:home), for WS01
// acceptance criterion 7. It runs Lighthouse's mobile check (Lighthouse's own
// defaults: a phone's screen, a slow 4G network and a slowed processor, all
// simulated) on / of the accessibility test build with newLook on, served on
// this computer, and prints, for each run, the performance score, the five
// metrics, the page's largest element (its LCP element) with how its time
// breaks down, the pictures and the largest files the page fetched, and the
// insights that found something; then the scores of all runs and their
// median. The score is a measurement written down in REDESIGN_STATUS.md,
// not a gate: a lab score moves from run to run and machine to machine, so
// this never fails on a score.
//
// What it does:
//   1. builds the site into dist-a11y-on with newLook and themeHeritage on,
//      and builds the seeded local database in .wrangler/a11y/on, the a11y-on
//      server's own database folder, as npm run test:a11y does first
//      (buildVariant and buildDatabase in test/a11y/global-setup.ts; local
//      only, never a remote database). It keeps to that one folder, which
//      it may share because it never runs beside the test servers (below),
//      and leaves the a11y-off server's .wrangler/a11y/off alone;
//   2. serves the build with wrangler pages dev on 127.0.0.1:8801, on that
//      database, with the same fake settings and empty secrets as the
//      accessibility tests (a11yServerArgs);
//   3. starts Chromium headless with a debugging port, and runs Lighthouse
//      on http://127.0.0.1:8801/ through it, three times unless told;
//   4. stops the browser and the server.
//
// The browser is the one the browser tests use: PW_CHROMIUM_PATH when it is
// set (as in a container that has its own Chromium), otherwise Playwright's
// own Chromium. It is started here, with a debugging port Lighthouse is
// given, rather than through chrome-launcher, so the check needs no package
// beyond lighthouse itself.
//
// Never run it while npm run test:a11y runs, or two of it at once: they use
// the same port (8801), the same build folder and the same database folder
// (.wrangler/a11y/on), and this rebuilds the build and the database under
// whatever else is reading them. So before it builds anything it checks the
// ports the test servers use
// (8801 and 8802, and their inspector ports 9231 and 9232), and stops when
// something already listens on one: like playwright.config.ts
// (reuseExistingServer: false), it measures only a server it started itself,
// since one left behind may serve another build, or a database that has been
// rebuilt under it.
//
// The server and the browser run in process groups of their own, so a signal
// sent to this script's group never reaches them, and it stops them itself:
// when it ends, and when it is stopped early by Ctrl-C (SIGINT), by SIGTERM
// (what `timeout` or a command's time limit sends; npm passes SIGINT and
// SIGTERM on) or by SIGHUP (a closed terminal). Each is asked to stop and is
// killed if it is still running 10 seconds later. Only a SIGKILL of this
// script leaves them running, and the next run then refuses to start until
// they are stopped.
//
// Usage (see package.json):
//   npm run perf:home [-- --runs <n>] [-- --reuse] [-- --out <folder>]
//     --runs <n>      how many Lighthouse runs, 1 to 9 (3 when not given)
//     --reuse         serve dist-a11y-on and .wrangler/a11y/on as they are,
//                     built by an earlier run of this or of npm run test:a11y
//     --out <folder>  also write each run's full Lighthouse report there, as
//                     home-run<n>.json
import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { constants, tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import lighthouse from 'lighthouse'
import { A11Y_SERVER_ENV, A11Y_VARIANTS, ROOT, a11yServerArgs, buildDatabase, buildVariant } from '../test/a11y/global-setup.ts'

/** The build with newLook on, and where it is served. */
const VARIANT = A11Y_VARIANTS.find((v) => v.name === 'a11y-on')!
const URL_HOME = `http://127.0.0.1:${VARIANT.port}/`

/** The audits printed as the run's metrics, in Lighthouse's order. */
const METRICS = ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index'] as const

interface Options {
  runs: number
  reuse: boolean
  /** Where each run's full report is written, or null. */
  out: string | null
}

/** The options from the command line; an unknown one or a bad number stops the run. */
function parseOptions(argv: string[]): Options {
  const options: Options = { runs: 3, reuse: false, out: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--reuse') options.reuse = true
    else if (argv[i] === '--runs') {
      const n = Number(argv[++i])
      if (!Number.isInteger(n) || n < 1 || n > 9) throw new Error('--runs takes a whole number from 1 to 9.')
      options.runs = n
    } else if (argv[i] === '--out') {
      const folder = argv[++i]
      if (!folder) throw new Error('--out takes a folder.')
      options.out = folder
    } else throw new Error(`Unknown option ${argv[i]}. Use --runs <n>, --reuse or --out <folder>.`)
  }
  return options
}

/** The middle of a list of numbers: the middle one, or the mean of the two middle ones. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/** Sends a signal to a process started in a group of its own, and to everything it started. */
function signal(child: ChildProcess, name: NodeJS.Signals): void {
  try {
    process.kill(-child.pid!, name)
  } catch {
    child.kill(name)
  }
}

/** Stops a process and what it started, and waits for it to end: asked first, then made to after 10 seconds. */
async function stop(child: ChildProcess | undefined): Promise<void> {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return
  const ended = new Promise<void>((resolve) => child.once('exit', () => resolve()))
  signal(child, 'SIGTERM')
  const timer = setTimeout(() => signal(child, 'SIGKILL'), 10_000)
  await ended
  clearTimeout(timer)
}

/** Every process this run started that has not ended yet, so that whatever stops the run can stop them all. */
const running = new Set<ChildProcess>()

/** The signal that is stopping the run, once one has come. */
let stopping: NodeJS.Signals | null = null

/** The browser's profile folder while it exists, so that whatever ends the run can remove it. */
let browserProfile: string | null = null

/** Removes the browser's profile folder, once the browser has stopped. */
function removeProfile(): void {
  if (browserProfile) rmSync(browserProfile, { recursive: true, force: true })
  browserProfile = null
}

/**
 * Starts a process in a group of its own, so that it can be stopped with
 * everything it starts, and keeps it in `running` until it ends. Once a
 * signal is stopping the run, nothing new is started.
 */
function launch(command: string, args: string[], options: SpawnOptions): ChildProcess {
  if (stopping) throw new Error(`Stopped by ${stopping}.`)
  const child = spawn(command, args, { ...options, detached: true })
  running.add(child)
  const forget = () => running.delete(child)
  child.once('exit', forget)
  child.once('error', forget)
  return child
}

/** Stops every process this run started that is still running, and waits for them to end. */
async function stopAll(): Promise<void> {
  await Promise.all([...running].map((child) => stop(child)))
}

/**
 * Stops what the run started when the run itself is stopped early: by Ctrl-C
 * (SIGINT), SIGTERM or SIGHUP. Then the browser's profile folder is removed
 * and the script ends with the signal's own exit code. A Ctrl-C can reach
 * this script twice under npm (from the terminal and passed on by npm), and
 * `timeout` signals npm and this script alike, so a signal that comes while
 * the run is stopping is left alone: `stop` already kills what has not ended
 * after 10 seconds. Whatever else ends the script (an error nothing caught,
 * say), what it started is killed as it exits.
 */
function stopOnSignals(): void {
  process.on('exit', () => {
    for (const child of running) signal(child, 'SIGKILL')
  })
  for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(name, () => {
      if (stopping) return
      stopping = name
      const stopped = stopAll()
      console.error(`\n${name}: stopping the browser and the server this run started.`)
      void stopped.finally(() => {
        removeProfile()
        process.exit(128 + constants.signals[name])
      })
    })
  }
}

/** Whether anything takes a connection on 127.0.0.1 at a port. */
function listening(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port })
    const answer = (yes: boolean) => {
      socket.destroy()
      resolve(yes)
    }
    socket.once('connect', () => answer(true))
    socket.once('error', () => answer(false))
    socket.setTimeout(2000, () => answer(false))
  })
}

/**
 * Stops the run when something already listens on one of these ports: a run
 * of npm run test:a11y or of this check, or a server one of them left
 * running. The run measures only a server it started itself.
 */
async function refuseBusyPorts(ports: readonly number[]): Promise<void> {
  const busy: number[] = []
  for (const port of ports) if (await listening(port)) busy.push(port)
  if (busy.length > 0) {
    throw new Error(
      `Something already listens on 127.0.0.1 at ${busy.length === 1 ? 'port' : 'ports'} ${busy.join(' and ')}: a run of npm run test:a11y or of this check, or a server one of them left running. Stop it first. This check measures only a server it starts itself, and it rebuilds the test build and database that a server there may be using.`,
    )
  }
}

/** Starts wrangler pages dev on the newLook build, on the a11y-on server's local test database, and waits until / answers. */
async function startServer(): Promise<void> {
  // Checked again now that the build is done, just before the server starts.
  await refuseBusyPorts([VARIANT.port, VARIANT.inspectorPort])
  const args = [
    join(ROOT, 'node_modules/wrangler/bin/wrangler.js'), 'pages', 'dev', VARIANT.dist,
    '--ip', '127.0.0.1', '--port', String(VARIANT.port), '--inspector-port', String(VARIANT.inspectorPort),
    '--persist-to', VARIANT.persist, '--show-interactive-dev-session=false', '--log-level', 'warn',
    ...a11yServerArgs(),
  ]
  const server = launch(process.execPath, args, { cwd: ROOT, env: { ...process.env, ...A11Y_SERVER_ENV }, stdio: ['ignore', 'ignore', 'inherit'] })
  const ended = () => server.exitCode !== null || server.signalCode !== null
  const started = Date.now()
  while (Date.now() - started < 180_000) {
    if (ended()) throw new Error(`wrangler pages dev stopped (${server.exitCode !== null ? `exit ${server.exitCode}` : server.signalCode}) before it served ${URL_HOME}.`)
    try {
      const res = await fetch(URL_HOME, { signal: AbortSignal.timeout(10_000) })
      // An answer counts only while the server this run started is running;
      // once it has ended, whatever answered is something else.
      if (res.ok && !ended()) return
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  await stop(server)
  throw new Error(`wrangler pages dev did not serve ${URL_HOME} within 3 minutes.`)
}

/** Starts Chromium headless with a debugging port on 127.0.0.1, and gives back the port. */
async function startBrowser(profile: string): Promise<number> {
  const path = process.env.PW_CHROMIUM_PATH || chromium.executablePath()
  if (!existsSync(path)) throw new Error(`No Chromium at ${path}. Set PW_CHROMIUM_PATH, or run npx playwright install chromium.`)
  const flags = [
    '--headless=new',
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    // The page is measured on its own: every host but this computer is
    // refused, as the accessibility tests refuse them, so neither the
    // browser's own calls home nor anything outside enters the measurement.
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    // The settings Lighthouse's own launcher gives Chromium, so nothing in
    // the background competes with the page.
    '--disable-features=Translate,OptimizationHints,MediaRouter,DialMediaRouteProvider,CalculateNativeWinOcclusion,InterestFeedContentSuggestions,CertificateTransparencyComponentUpdater,AutofillServerCommunication,PrivacySandboxSettings4,RenderDocument',
    '--disable-extensions',
    '--disable-component-extensions-with-background-pages',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-client-side-phishing-detection',
    '--disable-sync',
    '--metrics-recording-only',
    '--disable-default-apps',
    '--mute-audio',
    '--no-default-browser-check',
    '--no-first-run',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-timer-throttling',
    '--disable-ipc-flooding-protection',
    '--password-store=basic',
    '--use-mock-keychain',
    '--disable-hang-monitor',
    '--disable-prompt-on-repost',
    '--disable-domain-reliability',
    '--disable-dev-shm-usage',
  ]
  // A browser run by root (as in a container) cannot use Chromium's sandbox.
  if (process.getuid?.() === 0) flags.push('--no-sandbox')
  const browser = launch(path, flags, { stdio: ['ignore', 'ignore', 'pipe'] })
  return await new Promise<number>((resolve, reject) => {
    let said = ''
    let timedOut = false
    // A browser that never says where it listens is stopped here, before the
    // run gives up on it; its exit then ends the wait below.
    const timer = setTimeout(() => {
      timedOut = true
      void stop(browser)
    }, 30_000)
    browser.stderr?.on('data', (chunk: Buffer) => {
      said += chunk.toString()
      const m = said.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//)
      if (m) {
        clearTimeout(timer)
        resolve(Number(m[1]))
      }
    })
    browser.once('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    browser.once('exit', (code, name) => {
      clearTimeout(timer)
      reject(new Error(timedOut
        ? 'Chromium did not open its debugging port within 30 seconds, so it was stopped.'
        : `Chromium stopped (${code !== null ? `exit ${code}` : name}) before it opened its debugging port.\n${said}`))
    })
  })
}

const ms = (n: number) => `${Math.round(n).toLocaleString('en-US')} ms`
const bytes = (n: number) => `${Math.round(n).toLocaleString('en-US')} bytes`

interface Item {
  [key: string]: unknown
}
interface Details {
  type?: string
  items?: Item[]
}
interface AuditResult {
  title: string
  score: number | null
  scoreDisplayMode?: string
  displayValue?: string
  numericValue?: number
  metricSavings?: Record<string, number>
  details?: Details
}

/** What an item of a finding's table names: a file by its path, or an element by its label and where it is. */
function named(value: unknown): string {
  if (typeof value === 'string') return (value.startsWith('http') ? new URL(value).pathname : value).replace(/\s+/g, ' ').slice(0, 80)
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>
    if (v.type === 'node') return `<${named(v.nodeLabel)}> at ${String(v.selector ?? '')}`
    if (v.type === 'url' || v.type === 'text') return named(v.value)
  }
  return ''
}

/** Up to five lines of what a finding names: its files or elements with the numbers beside them, or its checks. */
function whatItFound(details: Details | undefined): string[] {
  if (!details) return []
  const tables = details.type === 'list' && Array.isArray(details.items) ? (details.items as Details[]) : [details]
  const lines: string[] = []
  for (const table of tables) {
    if (table.type === 'checklist' && table.items && !Array.isArray(table.items)) {
      for (const check of Object.values(table.items as Record<string, { label: string; value: boolean }>)) lines.push(`${check.label}: ${check.value ? 'yes' : 'no'}`)
      continue
    }
    if (!Array.isArray(table.items)) continue
    for (const item of table.items) {
      const what = named(item.url) || named(item.node) || named(item.source)
      if (!what) continue
      const numbers = ['totalBytes', 'wastedBytes', 'wastedMs', 'score'].filter((k) => typeof item[k] === 'number').map((k) => `${k} ${k === 'score' ? Number(item[k]).toFixed(3) : Math.round(Number(item[k])).toLocaleString('en-US')}`)
      const causes = ((item.subItems as Details | undefined)?.items ?? []).map((sub) => `${String(sub.cause ?? '')} ${named(sub.extra)}`.trim()).filter(Boolean)
      lines.push(`${what}${numbers.length > 0 ? ` (${numbers.join(', ')})` : ''}${causes.length > 0 ? `; ${causes.join('; ')}` : ''}`)
    }
  }
  return lines.slice(0, 5)
}

/** One Lighthouse run on /, printed; gives back its performance score out of 100. */
async function measure(port: number, run: number, runs: number, out: string | null): Promise<number> {
  const result = await lighthouse(URL_HOME, { port, output: 'json', logLevel: 'error', onlyCategories: ['performance'] })
  const lhr = result?.lhr
  if (out && result) writeFileSync(join(out, `home-run${run}.json`), typeof result.report === 'string' ? result.report : JSON.stringify(lhr))
  const category = lhr?.categories.performance
  if (!lhr || !category || category.score === null) throw new Error(`Run ${run} gave no performance score${lhr?.runtimeError ? `: ${lhr.runtimeError.message}` : ''}.`)
  const audits = lhr.audits as unknown as Record<string, AuditResult>
  const score = Math.round(category.score * 100)
  console.log(`\nRun ${run} of ${runs}: performance ${score} (Lighthouse ${lhr.lighthouseVersion}, ${lhr.configSettings.formFactor}, ${lhr.configSettings.throttlingMethod} throttling)`)
  console.log(`  ${METRICS.map((id) => `${audits[id].title} ${audits[id].displayValue ?? ''}`.trim()).join(', ')}`)

  const breakdown = audits['lcp-breakdown-insight']?.details?.items ?? []
  const node = breakdown.find((item) => item.type === 'node')
  const parts = (breakdown.find((item) => item.type === 'table') as Details | undefined)?.items ?? []
  console.log(`  LCP element: ${node ? `${String(node.nodeLabel ?? '')} ${String(node.snippet ?? '')} at ${String(node.selector ?? '')}`.trim() : 'not found'}`)
  if (parts.length > 0) console.log(`  LCP time: ${ms(audits['largest-contentful-paint'].numericValue ?? 0)}; ${parts.map((p) => `${String(p.label)} ${ms(Number(p.duration))}`).join(', ')}`)

  const requests = audits['network-requests']?.details?.items ?? []
  const images = requests.filter((r) => r.resourceType === 'Image')
  for (const r of images) console.log(`  Picture: ${new URL(String(r.url)).pathname} (${r.mimeType}), ${bytes(Number(r.transferSize))} transferred, priority ${r.priority}`)
  const largest = [...requests].sort((a, b) => Number(b.transferSize) - Number(a.transferSize)).slice(0, 5)
  console.log(`  Largest files: ${largest.map((r) => `${new URL(String(r.url)).pathname} ${bytes(Number(r.transferSize))}`).join('; ')}`)
  console.log(`  Total transferred: ${bytes(audits['total-byte-weight']?.numericValue ?? 0)} in ${requests.length} requests`)

  const found = category.auditRefs
    .filter((ref) => ref.group === 'insights' || ref.group === 'diagnostics')
    .map((ref) => audits[ref.id])
    .filter((a) => a && a.score !== null && a.score < 1 && a.scoreDisplayMode !== 'notApplicable' && a.scoreDisplayMode !== 'informative')
  for (const a of found) {
    const savings = Object.entries(a.metricSavings ?? {}).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${k === 'CLS' ? v.toFixed(3) : ms(v)}`)
    console.log(`  Found: ${a.title}${a.displayValue ? ` (${a.displayValue})` : ''}${savings.length > 0 ? `; could save ${savings.join(', ')}` : ''}`)
    for (const line of whatItFound(a.details)) console.log(`    ${line}`)
  }
  return score
}

async function main(): Promise<number> {
  const options = parseOptions(process.argv.slice(2))
  stopOnSignals()
  // First of all, before the build and the database are made again under
  // a server that may be reading them.
  await refuseBusyPorts(A11Y_VARIANTS.flatMap((v) => [v.port, v.inspectorPort]))
  if (options.reuse) {
    for (const folder of [VARIANT.dist, VARIANT.persist]) {
      if (!existsSync(join(ROOT, folder))) throw new Error(`--reuse needs ${folder}, which is missing. Run without --reuse to build it.`)
    }
  } else {
    buildVariant(VARIANT)
    buildDatabase(VARIANT)
  }
  const profile = mkdtempSync(join(tmpdir(), 'perf-home-'))
  browserProfile = profile
  try {
    console.log(`Serving ${VARIANT.dist} (newLook on) at ${URL_HOME}`)
    await startServer()
    const port = await startBrowser(profile)
    const scores: number[] = []
    if (options.out) mkdirSync(options.out, { recursive: true })
    for (let run = 1; run <= options.runs; run++) scores.push(await measure(port, run, options.runs, options.out))
    console.log(`\nPerformance on / (mobile, lab): ${scores.join(', ')} over ${scores.length} run(s); median ${median(scores)}. A measurement to record, not a gate.`)
    return 0
  } finally {
    await stopAll()
    removeProfile()
  }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      // When a signal stopped the run, what failed is only the stop itself,
      // and the signal's handler ends the script once everything the run
      // started has stopped.
      if (stopping) return
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    },
  )
}
