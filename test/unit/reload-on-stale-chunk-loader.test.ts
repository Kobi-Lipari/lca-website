// test/unit/reload-on-stale-chunk-loader.test.ts
//
// The stale-tab reload (src/lib/reloadOnStaleChunk.ts) with the loader the
// build emits, rather than with stand-ins for it. A small site is built with
// the installed Vite and the site's own vite.config.ts: an entry that takes
// the guard through the same '@' import src/main.tsx uses, two pages loaded
// on demand that share a file (so the build wraps each import in its preload
// helper, as it wraps the governance editor's), and a stylesheet loaded on
// demand, as a look's is. Each case then runs in a process of its own, in a
// jsdom page at https://lca.test/governance/minutes, where the guard is
// called with no arguments, exactly as src/main.tsx calls it: it listens on
// that page's window, keeps its mark in that page's sessionStorage and
// reloads through location.reload, which jsdom reports as a navigation it
// does not carry out, and the probe counts. A deploy is played by deleting a
// page's file from the build before the page is asked for, as a new
// deployment stops serving the old build's files.
//
// Pinned here:
// - With every file in place, a page loads, no event fires, nothing reloads
//   and no mark is set.
// - A stale tab: the first page whose file is gone is answered with one
//   reload, the loader's promise resolves with nothing instead of rejecting,
//   and the tab is marked. A second page gone in the same tab reaches the
//   code that asked for it, as before the guard, and nothing reloads again.
// - The page the reload brought, with the mark already set in the tab: a
//   file that is gone reaches the code that asked for it, and nothing
//   reloads, so a file that keeps failing can never start a loop.
// - Two pages gone at once: one reload; one import resolves with nothing and
//   the other rejects.
// - A look's stylesheet that fails: the import rejects with the loader's own
//   words, which src/lib/scopeStylesheets.ts waits for before it asks again,
//   nothing reloads and no mark is spent; a stale page afterwards still gets
//   its one reload.
// - A page whose storage is blocked (an opaque origin, where jsdom throws a
//   SecurityError on sessionStorage, as a browser with site data blocked
//   does): nothing reloads, and the error goes on as before.
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PRELOAD_ERROR_EVENT, STALE_RELOAD_KEY, STYLESHEET_FAILURE } from '@/lib/reloadOnStaleChunk'

const ROOT = resolve(__dirname, '../..')
const work = mkdtempSync(join(tmpdir(), 'lca-stale-tab-'))
const source = join(work, 'source')
const built = join(work, 'built')
afterAll(() => rmSync(work, { recursive: true, force: true }))

/** The small site: the guard as src/main.tsx imports it, two pages that share a file, and a stylesheet on demand. */
const FIXTURE: Record<string, string> = {
  'entry.js': [
    "export { PRELOAD_ERROR_EVENT, STALE_RELOAD_KEY, reloadOnStaleChunk } from '@/lib/reloadOnStaleChunk'",
    "export const loadEditor = () => import('./editor.js')",
    "export const loadMinutes = () => import('./minutes.js')",
    "export const loadLook = () => import('./look.css')",
    '',
  ].join('\n'),
  'editor.js': "import { shared } from './shared.js'\nexport const page = 'the editor, ' + shared\n",
  'minutes.js': "import { shared } from './shared.js'\nexport const page = 'the minutes, ' + shared\n",
  'shared.js': "export const shared = 'with what it shares'\n",
  'look.css': '.stale-tab-look { color: #123456 }\n',
}

beforeAll(async () => {
  mkdirSync(source, { recursive: true })
  for (const [name, text] of Object.entries(FIXTURE)) writeFileSync(join(source, name), text)
  await build({
    root: ROOT,
    configFile: join(ROOT, 'vite.config.ts'),
    mode: 'production',
    envFile: false,
    logLevel: 'silent',
    build: {
      outDir: built,
      emptyOutDir: true,
      copyPublicDir: false,
      rolldownOptions: { input: { entry: join(source, 'entry.js') }, preserveEntrySignatures: 'exports-only' },
    },
  })
}, 120_000)

/**
 * One case, in a page and a process of its own: jsdom's window, document and
 * Event stand in for the browser's, the built entry is imported, the guard is
 * called as src/main.tsx calls it, and a listener added after it records each
 * of the loader's events as the guard left it. It prints what each request
 * came to, the reloads asked for and the mark the tab holds.
 */
const PROBE = String.raw`
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
const [assets, root, scenario] = process.argv.slice(1)
const { JSDOM, VirtualConsole } = createRequire(join(root, 'package.json'))('jsdom')
const out = { reloads: 0, events: [], unexpected: [] }
const virtualConsole = new VirtualConsole()
virtualConsole.on('jsdomError', (error) => {
  if (error.type === 'not-implemented' && /navigation/.test(error.message)) out.reloads += 1
  else out.unexpected.push(error.message)
})
const url = scenario === 'blocked' ? 'about:blank' : 'https://lca.test/governance/minutes'
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url, virtualConsole })
Object.assign(globalThis, { window: dom.window, document: dom.window.document, Event: dom.window.Event })
const file = (name) => readdirSync(assets).find((f) => f.startsWith(name + '-'))
const deploy = (...names) => { for (const name of names) rmSync(join(assets, file(name))) }
const site = await import(pathToFileURL(join(assets, file('entry'))).href)
const mark = () => {
  try { return window.sessionStorage.getItem(site.STALE_RELOAD_KEY) } catch (error) { return 'unreadable: ' + error.name }
}
const outcome = (promise) => promise.then(
  (module) => (module === undefined ? 'resolved with nothing' : 'resolved: ' + (module.page ?? 'a module')),
  (error) => 'rejected: ' + (error.code ?? error.message),
)
if (scenario === 'reloaded') window.sessionStorage.setItem(site.STALE_RELOAD_KEY, '1')
site.reloadOnStaleChunk()
window.addEventListener(site.PRELOAD_ERROR_EVENT, (event) => {
  out.events.push({ cancelled: event.defaultPrevented, failure: event.payload?.code ?? event.payload?.message })
})
if (scenario === 'fresh') {
  out.editor = await outcome(site.loadEditor())
} else if (scenario === 'stale' || scenario === 'reloaded' || scenario === 'blocked') {
  deploy('editor', 'minutes')
  out.editor = await outcome(site.loadEditor())
  out.reloadsAfterEditor = out.reloads
  out.markAfterEditor = mark()
  out.minutes = await outcome(site.loadMinutes())
} else if (scenario === 'together') {
  deploy('editor', 'minutes')
  out.both = (await Promise.all([outcome(site.loadEditor()), outcome(site.loadMinutes())])).sort()
} else if (scenario === 'look') {
  const look = outcome(site.loadLook())
  document.querySelector('link[rel="stylesheet"]').dispatchEvent(new window.Event('error'))
  out.look = await look
  out.reloadsAfterLook = out.reloads
  out.markAfterLook = mark()
  deploy('editor')
  out.editor = await outcome(site.loadEditor())
}
out.mark = mark()
console.log(JSON.stringify(out))
`

type Outcome = {
  reloads: number
  events: Array<{ cancelled: boolean; failure: string }>
  unexpected: string[]
  mark: string | null
  [key: string]: unknown
}

/** Runs one case on a copy of the build of its own, so the files one case deletes are still there for the next. */
function run(scenario: string): Outcome {
  const copy = join(work, `case-${scenario}`)
  rmSync(copy, { recursive: true, force: true })
  cpSync(built, copy, { recursive: true })
  // The built files are modules, as a browser loads them; say so to node, rather than leave it to guess from their syntax.
  writeFileSync(join(copy, 'package.json'), '{ "type": "module" }\n')
  const printed = execFileSync(process.execPath, ['--input-type=module', '-e', PROBE, join(copy, 'assets'), ROOT, scenario], {
    cwd: ROOT,
    encoding: 'utf8',
  })
  return JSON.parse(printed.trim().split('\n').at(-1) ?? '{}') as Outcome
}

const GONE = 'rejected: ERR_MODULE_NOT_FOUND'

describe('the build the stale-tab cases run on', () => {
  it('holds the loader\'s preload helper, which fires the event, beside the guard, with each page and the stylesheet a file of its own', () => {
    const files = readdirSync(join(built, 'assets'))
    for (const name of ['entry', 'editor', 'minutes', 'shared']) expect(files.filter((f) => f.startsWith(`${name}-`) && f.endsWith('.js')), name).toHaveLength(1)
    expect(files.filter((f) => /^look-[\w-]+\.css$/.test(f))).toHaveLength(1)
    const entry = readFileSync(join(built, 'assets', files.find((f) => f.startsWith('entry-')) as string), 'utf8')
    // The helper builds the event as one that can be cancelled, and names a failed stylesheet in its own words.
    expect(entry).toMatch(new RegExp(`new Event\\([\`'"]${PRELOAD_ERROR_EVENT}[\`'"],\\s*\\{\\s*cancelable:\\s*(?:!0|true)\\s*\\}\\)`))
    expect(entry).toContain(`${STYLESHEET_FAILURE} for `)
    // The guard is bundled with it.
    expect(entry).toContain(STALE_RELOAD_KEY)
  })
})

describe('a stale tab, with the loader the build emits', () => {
  it('loads a page whose file is there, with no event, no reload and no mark', () => {
    const out = run('fresh')
    expect(out).toEqual({ reloads: 0, events: [], unexpected: [], editor: 'resolved: the editor, with what it shares', mark: null })
  }, 30_000)

  it('reloads once for the first page whose file is gone, resolves its import with nothing, and lets the next one through', () => {
    const out = run('stale')
    // The first: cancelled, so the loader resolves instead of throwing, while the page reloads.
    expect(out.editor).toBe('resolved with nothing')
    expect(out.reloadsAfterEditor).toBe(1)
    expect(out.markAfterEditor).toBe('1')
    // The second, in the same tab: the error reaches the code that asked, as before the guard.
    expect(out.minutes).toBe(GONE)
    expect(out.reloads).toBe(1)
    expect(out.events).toEqual([
      { cancelled: true, failure: 'ERR_MODULE_NOT_FOUND' },
      { cancelled: false, failure: 'ERR_MODULE_NOT_FOUND' },
    ])
    expect(out.unexpected).toEqual([])
  }, 30_000)

  it('on the page the reload brought, with the mark set, lets a missing file reach the code that asked for it and never reloads', () => {
    const out = run('reloaded')
    expect(out.editor).toBe(GONE)
    expect(out.minutes).toBe(GONE)
    expect(out.reloads).toBe(0)
    expect(out.events.map((e) => e.cancelled)).toEqual([false, false])
    expect(out.mark).toBe('1')
  }, 30_000)

  it('reloads once when two pages are gone at once: one import resolves with nothing and the other rejects', () => {
    const out = run('together')
    expect(out.both).toEqual([GONE, 'resolved with nothing'])
    expect(out.reloads).toBe(1)
    expect(out.events.map((e) => e.cancelled).sort()).toEqual([false, true])
    expect(out.mark).toBe('1')
  }, 30_000)

  it('leaves a look\'s failed stylesheet to the code that asked for it, in the loader\'s words, and keeps the one reload for a page', () => {
    const out = run('look')
    expect(out.look).toMatch(/^rejected: Unable to preload CSS for \S*\/look-[\w-]+\.css$/)
    expect(out.reloadsAfterLook).toBe(0)
    expect(out.markAfterLook).toBeNull()
    // A page gone afterwards still gets its reload.
    expect(out.editor).toBe('resolved with nothing')
    expect(out.reloads).toBe(1)
    expect(out.events.map((e) => e.cancelled)).toEqual([false, true])
    expect(out.events[0].failure).toMatch(/^Unable to preload CSS for /)
    expect(out.mark).toBe('1')
  }, 30_000)

  it('never reloads when the page cannot reach its storage, and lets the error through', () => {
    const out = run('blocked')
    // jsdom throws on sessionStorage at an opaque origin, as a browser does with site data blocked.
    expect(out.mark).toBe('unreadable: SecurityError')
    expect(out.editor).toBe(GONE)
    expect(out.minutes).toBe(GONE)
    expect(out.reloads).toBe(0)
    expect(out.events.map((e) => e.cancelled)).toEqual([false, false])
    expect(out.unexpected).toEqual([])
  }, 30_000)
})
