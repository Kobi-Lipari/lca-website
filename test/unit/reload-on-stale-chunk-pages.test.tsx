// @vitest-environment jsdom
//
// test/unit/reload-on-stale-chunk-pages.test.tsx
//
// The stale-tab reload (src/lib/reloadOnStaleChunk.ts) followed past the
// loader's promise to what a visitor sees. The other reload tests stop where
// the loader answers; this one draws a page the way the site draws it. The
// page's import goes through the loader's own error handler, read from the
// installed build tool and run as it is written there; the page is loaded as
// src/App.tsx loads every page, lazy(() => import(...).then(m => ({ default:
// m.X }))); and the error screen is src/components/errors/ErrorBoundary.tsx,
// which src/main.tsx wraps the app in. The guard listens on this page's
// window and keeps its mark in this page's sessionStorage, as it does in
// src/main.tsx; only the reload is a spy.
//
// Pinned here:
// - Before the guard, a page whose file is gone ends on the error screen,
//   which is handed the loader's error.
// - With the mark set (the page the reload brought, or a second stale file
//   in the same tab) the guard steps aside, and the page ends on the same
//   screen with the same error: exactly as before the guard.
// - The first time, the guard cancels the event, sets the mark and asks for
//   one reload, and the loader answers with nothing, so the page fails all
//   the same and the error screen shows from then until the reload replaces
//   the page: the instant the record describes. That holds whichever side
//   of the loader's call the page's export is read on (the build reads it
//   inside the call, the source after it).
// - A page whose file is there draws as before, with no event, no reload
//   and no mark.
// - The error screen's Refresh button reloads the page whatever the mark
//   says, so a tab that has used its one reload still has a way back.
// - Every import the site makes on demand, and what its failure meets: a
//   page or a component loaded with lazy() meets the error screen, the one
//   error boundary in src; a look's stylesheet is left to
//   src/lib/scopeStylesheets.ts; and an import that a handler awaits inside
//   its own try meets that handler's catch, which the first reload in a tab
//   comes before: the catch meets a TypeError in place of the loader's
//   error, and the reload replaces the page that held the open form. That is
//   a change a visitor can see, so the WS02 record must name each such
//   import.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { lazy, Suspense, type ComponentType } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import { PRELOAD_ERROR_EVENT, reloadOnStaleChunk, STALE_RELOAD_KEY } from '@/lib/reloadOnStaleChunk'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
/** The text from `from` up to `to`, or nothing when `from` is missing. */
const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}

/** The installed build tool's preload helper, which the build writes into the site. */
const CHUNKS = 'node_modules/vite/dist/node/chunks'
const HELPER =
  readdirSync(join(ROOT, CHUNKS))
    .filter((name) => name.endsWith('.js'))
    .map((name) => read(`${CHUNKS}/${name}`))
    .find((text) => text.includes('function handlePreloadError(err) {')) ?? ''
/** The helper's error handler, word for word: it fires the event and throws the error only when no listener cancelled it. */
const HANDLER_SOURCE = /\tfunction handlePreloadError\(err\) \{\n[\s\S]*?\n\t\}\n/.exec(HELPER)?.[0] ?? ''
const makeHandler = new Function(`${HANDLER_SOURCE}\nreturn handlePreloadError`) as () => (err: unknown) => void
const handlePreloadError = makeHandler()

/**
 * An import as the build wraps it, for a file with no stylesheet to wait
 * for: the helper's last step, `baseModule().catch(handlePreloadError)`, once
 * its preloads have settled.
 */
function throughLoader<T>(baseModule: () => Promise<T>): Promise<T | undefined> {
  return Promise.resolve().then(() => baseModule().catch(handlePreloadError)) as Promise<T | undefined>
}

function TheMinutes() {
  return <p>The minutes of the board</p>
}
type MinutesModule = { MinutesPage: ComponentType }
type Load = () => Promise<MinutesModule>

/** What the browser rejects the import with once the deployment no longer serves the page's file. */
const goneError = () => new TypeError('Failed to fetch dynamically imported module: https://lca.test/assets/MinutesPage-old.js')

/**
 * The minutes page loaded as src/App.tsx loads it. The build reads the
 * page's export inside the loader's call; the source reads it after.
 */
const SHAPES: Array<[string, (load: Load) => ComponentType]> = [
  [
    'inside the loader\'s call, as the build writes it',
    (load) => lazy(() => throughLoader(() => load().then((m) => ({ default: m.MinutesPage }))) as Promise<{ default: ComponentType }>),
  ],
  [
    'after the loader\'s call, as the source writes it',
    (load) => lazy(() => throughLoader(load).then((m) => ({ default: (m as MinutesModule).MinutesPage }))),
  ],
]

/** The page under the error screen, as src/main.tsx nests the app. */
function draw(Page: ComponentType) {
  return render(
    <MemoryRouter>
      <ErrorBoundary>
        <Suspense fallback={<p>Loading the page</p>}>
          <Page />
        </Suspense>
      </ErrorBoundary>
    </MemoryRouter>,
  )
}

/** Listeners this file adds to the page's window, taken off after each test. */
const added: Array<[string, (event: Event) => void]> = []
const page = {
  addEventListener(type: string, listener: (event: Event) => void) {
    window.addEventListener(type, listener)
    added.push([type, listener])
  },
}

/** What happened, in order: each reload asked for, each event as the guard left it, and the error screen catching an error. */
type Step = { reload: true } | { event: 'cancelled' | 'left alone' } | { screen: unknown }

/** The guard as src/main.tsx calls it, on this page's window and storage, with the reload as a spy. */
function guarded(log: Step[]) {
  const reload = vi.fn(() => {
    log.push({ reload: true })
  })
  reloadOnStaleChunk(page, undefined, reload)
  page.addEventListener(PRELOAD_ERROR_EVENT, (event) => {
    log.push({ event: event.defaultPrevented ? 'cancelled' : 'left alone' })
  })
  return reload
}

/** Keeps the console quiet, and writes each error the error screen catches into the log. */
function watchConsole(log: Step[]) {
  return vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (args[0] === 'Application error:') log.push({ screen: args[1] })
  })
}

const errorScreen = () => screen.findByRole('heading', { name: 'Something went wrong' })

afterEach(() => {
  cleanup()
  for (const [type, listener] of added.splice(0)) window.removeEventListener(type, listener)
  window.sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('the error handler these tests run is the installed loader\'s', () => {
  it('is read from the helper that fires the build loader\'s event, and the helper ends on it', () => {
    expect(HANDLER_SOURCE).toContain('const e = new Event("vite:preloadError", { cancelable: true });')
    expect(HANDLER_SOURCE).toContain('if (!e.defaultPrevented) throw err;')
    expect(HELPER).toContain('return baseModule().catch(handlePreloadError);')
  })
})

describe.each(SHAPES)('a stale page, its export read %s', (_, shape) => {
  it('before the guard, ends on the error screen, which is handed the loader\'s error', async () => {
    const log: Step[] = []
    watchConsole(log)
    const gone = goneError()
    draw(shape(() => Promise.reject(gone)))
    await errorScreen()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go home' })).toBeTruthy()
    expect(log).toEqual([{ screen: gone }])
  })

  it('with the mark set, ends on the same screen with the same error, exactly as before the guard', async () => {
    const before: Step[] = []
    watchConsole(before)
    const first = goneError()
    draw(shape(() => Promise.reject(first)))
    await errorScreen()
    const screenBefore = document.body.innerHTML
    cleanup()
    vi.restoreAllMocks()

    window.sessionStorage.setItem(STALE_RELOAD_KEY, '1')
    const log: Step[] = []
    watchConsole(log)
    const reload = guarded(log)
    const again = goneError()
    draw(shape(() => Promise.reject(again)))
    await errorScreen()
    expect(document.body.innerHTML).toBe(screenBefore)
    expect(log).toEqual([{ event: 'left alone' }, { screen: again }])
    expect(reload).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(STALE_RELOAD_KEY)).toBe('1')
  })

  it('the first time, asks for one reload, and the page fails all the same, so the error screen shows until the reload replaces it', async () => {
    const log: Step[] = []
    watchConsole(log)
    const reload = guarded(log)
    const gone = goneError()
    draw(shape(() => Promise.reject(gone)))
    await errorScreen()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(STALE_RELOAD_KEY)).toBe('1')
    // The reload is asked for first; the loader then answers with nothing,
    // the page cannot read its export from nothing, and the screen catches that.
    expect(log.map((step) => Object.keys(step)[0])).toEqual(['reload', 'event', 'screen'])
    expect(log[1]).toEqual({ event: 'cancelled' })
    const caught = (log[2] as { screen: unknown }).screen
    expect(caught).toBeInstanceOf(TypeError)
    expect(caught).not.toBe(gone)
  })

  it('draws a page whose file is there as before, with no event, no reload and no mark', async () => {
    const log: Step[] = []
    watchConsole(log)
    const reload = guarded(log)
    draw(shape(() => Promise.resolve({ MinutesPage: TheMinutes })))
    expect(await screen.findByText('The minutes of the board')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Something went wrong' })).toBeNull()
    expect(log).toEqual([])
    expect(reload).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(STALE_RELOAD_KEY)).toBeNull()
  })
})

describe('the error screen\'s Refresh button', () => {
  it('is drawn for a stale page once the mark is set, and reloads the page with no regard to the mark, so a tab that has used its one reload still has a way back', async () => {
    window.sessionStorage.setItem(STALE_RELOAD_KEY, '1')
    const log: Step[] = []
    watchConsole(log)
    const reload = guarded(log)
    draw(SHAPES[0][1](() => Promise.reject(goneError())))
    await errorScreen()
    expect(reload).not.toHaveBeenCalled()
    const refresh = screen.getByRole('button', { name: 'Refresh' })
    // The test page's own reload cannot be watched, so what the button does is read from the screen's code:
    // a plain reload of the page, and nothing in the error screen reads the tab's storage or the mark.
    const boundary = read('src/components/errors/ErrorBoundary.tsx')
    expect(boundary.match(/window\.location\.reload\(\)/g)).toHaveLength(1)
    expect(boundary).toMatch(/onClick=\{\(\) => window\.location\.reload\(\)\}>\s*Refresh\s*</)
    expect(boundary).not.toMatch(/sessionStorage|localStorage|reloadOnStaleChunk|lca-stale-reload/)
    expect(refresh.getAttribute('type')).toBe('button')
    expect(window.sessionStorage.getItem(STALE_RELOAD_KEY)).toBe('1')
  })
})

describe('what each import the site makes on demand meets when its file is gone', () => {
  /** Every .ts and .tsx file under src, as a path from the repository's root. */
  function sourceFiles(dir = 'src'): string[] {
    return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path)
      return /\.tsx?$/.test(entry.name) ? [path] : []
    })
  }
  /** A file's code with its comments taken out, so an import() a comment mentions is not counted. */
  const code = (path: string) => read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1')
  const IMPORT = /\bimport\s*\(\s*(['"`])([^'"`]+)\1/g

  /** Each on-demand import: its file, what it imports, and whether lazy() makes it. */
  const imports = sourceFiles().flatMap((path) => {
    const text = code(path)
    return [...text.matchAll(IMPORT)].map((m) => ({
      path,
      specifier: m[2],
      lazy: /\blazy\(\s*\(\)\s*=>\s*$/.test(text.slice(Math.max(0, (m.index ?? 0) - 40), m.index)),
    }))
  })

  /**
   * The imports a handler awaits inside a try of its own, with the call its
   * caller awaits and the words its catch shows. With the guard, the first
   * such failure in a tab is cancelled and the page reloads: the catch then
   * meets a TypeError from reading the import's answer, which is nothing,
   * and the page that held the open form is replaced. Each names the files
   * the record may name it by.
   */
  const CAUGHT_BY_THEIR_CALLER = [
    {
      at: 'src/areas/governance/components/GovernanceDocuments.tsx: @/lib/parseDocumentFile',
      caller: 'src/areas/governance/components/GovernanceDocuments.tsx',
      call: 'await import(\'@/lib/parseDocumentFile\')',
      words: ['Could not read that file.'],
      names: ['src/areas/governance/components/GovernanceDocuments.tsx', 'src/lib/parseDocumentFile.ts'],
    },
    {
      at: 'src/lib/scanner/decodeInBackground.ts: ./decoder',
      caller: 'src/pages/ScannerPage.tsx',
      call: 'await decodeInBackground(',
      words: ['The moves were read, but checking them failed. Please try again.', 'Couldn\'t update the game. Please try that move again.'],
      names: ['src/lib/scanner/decodeInBackground.ts', 'src/lib/scanner/decoder.ts', 'src/pages/ScannerPage.tsx'],
    },
  ]

  /** Whether the text at `at` sits inside a try block: a `try {` opens before it with no catch between, and a catch follows. */
  const insideTry = (text: string, at: number) => text.lastIndexOf('try {', at) > text.lastIndexOf('} catch', at) && text.indexOf('} catch', at) > at

  /** A handler shaped as GovernanceDocuments' handleFile: it awaits the parser, and its catch shows what went wrong. */
  async function handleFile(load: () => Promise<{ parseFileToHtml: () => string }>): Promise<{ parsed: string } | { caught: unknown }> {
    try {
      const { parseFileToHtml } = (await throughLoader(load)) as { parseFileToHtml: () => string }
      return { parsed: parseFileToHtml() }
    } catch (err) {
      return { caught: err }
    }
  }

  it('finds each form of import it looks for, and none in a comment', () => {
    const found = (text: string) => [...text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1').matchAll(IMPORT)].map((m) => m[2])
    expect(found("const Page = lazy(() => import('@/pages/Page').then(m => ({ default: m.Page })))")).toEqual(['@/pages/Page'])
    expect(found('const { run } = await import("./run")')).toEqual(['./run'])
    expect(found("// calling import('./nothing') here would fetch nothing")).toEqual([])
    expect(found("/* import('./nothing') */ const url = 'https://lca.test/a'")).toEqual([])
  })

  it('has only one error boundary in src, the error screen, and src/main.tsx wraps the app in it', () => {
    const boundaries = sourceFiles().filter((path) => /getDerivedStateFromError|componentDidCatch/.test(code(path)))
    expect(boundaries).toEqual(['src/components/errors/ErrorBoundary.tsx'])
    expect(between(read('src/main.tsx'), '<ErrorBoundary>', '</ErrorBoundary>')).toContain('<App />')
  })

  it('loads every page in src/App.tsx, and the governance editor K\'s stale tab could not load, with lazy(), so a failure meets that error screen', () => {
    const app = imports.filter((i) => i.path === 'src/App.tsx')
    expect(app.length).toBeGreaterThan(0)
    for (const i of app) expect(i.lazy, i.specifier).toBe(true)
    expect(imports.filter((i) => i.lazy).map((i) => `${i.path}: ${i.specifier}`)).toContain(
      'src/areas/governance/components/GovernanceDocuments.tsx: @/areas/governance/components/RichTextEditor',
    )
  })

  it('leaves no import unaccounted for: lazy(), a look\'s stylesheet, or one its caller catches', () => {
    const rest = imports.filter((i) => !i.lazy).map((i) => `${i.path}: ${i.specifier}`)
    expect(
      rest.sort(),
      'A new import made on demand outside lazy(): if its caller catches its failure, the stale-tab reload comes first and the caller\'s own handling is lost on the first failure in a tab. Add it to CAUGHT_BY_THEIR_CALLER, with the words its caller shows, and name it in the WS02 record.',
    ).toEqual(
      [
        ...CAUGHT_BY_THEIR_CALLER.map((c) => c.at),
        'src/lib/scopeStylesheets.ts: @/styles/themes/heritage.css',
        'src/lib/scopeStylesheets.ts: @/styles/themes/live.css',
      ].sort(),
    )
  })

  it('tells a try from what is outside one', () => {
    const text = 'a(); try { b() } catch { c() } d(); try { e() } catch (err) { f(err) }'
    expect(['a()', 'b()', 'c()', 'd()', 'e()', 'f(err)'].map((piece) => insideTry(text, text.indexOf(piece)))).toEqual([false, true, false, false, true, false])
  })

  it.each(CAUGHT_BY_THEIR_CALLER.map((c) => [c.at, c]))('%s is awaited inside a try whose catch shows its own words', (_, c) => {
    const caller = code(c.caller)
    for (const words of c.words) expect(caller, words).toContain(words)
    const calls = [...caller.matchAll(new RegExp(c.call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))].map((m) => m.index ?? -1)
    expect(calls.length, c.call).toBeGreaterThan(0)
    for (const at of calls) expect(insideTry(caller, at), `${c.call} at ${at}`).toBe(true)
    if (c.caller === 'src/pages/ScannerPage.tsx') {
      // The scanner asks for its decoder on demand only where the browser has no Web Workers.
      expect(code('src/lib/scanner/decodeInBackground.ts')).toMatch(/if \(typeof Worker === 'undefined'\) \{\s*return import\('\.\/decoder'\)/)
    }
  })

  it('a handler\'s own catch meets the loader\'s error before the guard and with the mark set, but on the first failure in a tab meets a TypeError while the page reloads', async () => {
    const log: Step[] = []
    const gone = goneError()
    expect(await handleFile(() => Promise.reject(gone))).toEqual({ caught: gone })

    const reload = guarded(log)
    const first = await handleFile(() => Promise.reject(goneError()))
    expect(reload).toHaveBeenCalledTimes(1)
    expect((first as { caught: unknown }).caught).toBeInstanceOf(TypeError)
    expect(String((first as { caught: Error }).caught.message)).not.toMatch(/Failed to fetch dynamically imported module/)

    const again = goneError()
    expect(await handleFile(() => Promise.reject(again))).toEqual({ caught: again })
    expect(reload).toHaveBeenCalledTimes(1)
    expect(log).toEqual([{ reload: true }, { event: 'cancelled' }, { event: 'left alone' }])
  })

  it('the WS02 record names each import a handler catches for itself, since the first reload in a tab comes before that handler', () => {
    const ws02 = between(read('REDESIGN_STATUS.md'), '## WS02: Information architecture and navigation', '\n## WS03:')
    expect(ws02).not.toBe('')
    for (const c of CAUGHT_BY_THEIR_CALLER) {
      expect(c.names.some((name) => ws02.includes(`\`${name}\``)), `the WS02 section names ${c.names.join(' or ')}`).toBe(true)
    }
  })
})

describe('this file', () => {
  it('holds no en dash, no em dash, no old initials for US Chess and no name of a tool that helped write it', () => {
    const text = read('test/unit/reload-on-stale-chunk-pages.test.tsx')
    expect(text).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
    expect(text).not.toMatch(new RegExp(`\\b${'US' + 'CF'}\\b`))
    expect(text).not.toMatch(new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini'].join('|')})\\b`, 'i'))
  })
})
