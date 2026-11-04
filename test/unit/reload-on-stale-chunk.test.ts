// test/unit/reload-on-stale-chunk.test.ts
//
// The stale-tab reload in src/lib/reloadOnStaleChunk.ts. A tab left open
// across a deploy asks for a page's file under the name of the build it first
// loaded; the build loader then fires 'vite:preloadError' on window, and the
// guard reloads the page once, with a mark in sessionStorage so that it can
// never loop. Pinned here: one listener, for the loader's own event; the
// first event cancelled, marked and reloaded; every later one left to reach
// the error screen; storage that throws, on reading, on writing or on being
// reached at all, left alone as well; a stylesheet's failure left to the code
// that asked for it, without using up the one reload; the mark never cleared;
// the event's name, and the words it gives a stylesheet, as the installed
// loader types and fires them; and src/main.tsx calling the guard once,
// before the app is drawn and outside the newLook block.
//
// This file runs in node: a plain EventTarget stands in for the window, a
// Map for sessionStorage and a spy for the reload.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { PRELOAD_ERROR_EVENT, reloadOnStaleChunk, STALE_RELOAD_KEY, STYLESHEET_FAILURE, type MarkStorage } from '@/lib/reloadOnStaleChunk'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** A sessionStorage stand-in over a Map, whose reads and writes can be counted. */
function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  const storage = {
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, value)
    }),
  }
  return { storage, map }
}

/** A page's script that could not be fetched, as the browser rejects its import. */
const SCRIPT_FAILED = () => new TypeError('Failed to fetch dynamically imported module: /assets/RichTextEditor-old.js')
/** A stylesheet the loader could not load, in the loader's own words. */
const STYLESHEET_FAILED = () => new Error('Unable to preload CSS for /assets/heritage-old.css')

/** The event as the loader builds it: cancelable, with the failure as its payload. */
function preloadError(payload: Error = SCRIPT_FAILED()): Event {
  const event = new Event(PRELOAD_ERROR_EVENT, { cancelable: true })
  return Object.assign(event, { payload })
}

/** A guard on a fresh stand-in window; fire() sends the loader's event and hands it back. */
function guard(getStorage: () => MarkStorage) {
  const win = new EventTarget()
  const reload = vi.fn()
  reloadOnStaleChunk(win, getStorage, reload)
  const fire = (payload?: Error) => {
    const event = preloadError(payload)
    win.dispatchEvent(event)
    return event
  }
  return { win, reload, fire }
}

describe('reloadOnStaleChunk', () => {
  it('adds one listener, for the build loader\'s event and no other', () => {
    const addEventListener = vi.fn()
    reloadOnStaleChunk({ addEventListener }, () => memoryStorage().storage, vi.fn())
    expect(addEventListener).toHaveBeenCalledTimes(1)
    expect(addEventListener).toHaveBeenCalledWith('vite:preloadError', expect.any(Function))
    expect(PRELOAD_ERROR_EVENT).toBe('vite:preloadError')
  })

  it('on the first event sets the mark, cancels the event so the error is not thrown, and reloads once', () => {
    const { storage, map } = memoryStorage()
    const { reload, fire } = guard(() => storage)
    const event = fire()
    expect(map.get(STALE_RELOAD_KEY)).toBe('1')
    expect(event.defaultPrevented).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('leaves a second event alone once the mark is set, so the error reaches the error screen and nothing loops', () => {
    const { storage } = memoryStorage()
    const { reload, fire } = guard(() => storage)
    fire()
    const second = fire()
    expect(second.defaultPrevented).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('leaves the event alone on the page the reload brought, since the mark outlives the reload', () => {
    // The reloaded page is a new listener over the same tab's storage.
    const { storage } = memoryStorage({ [STALE_RELOAD_KEY]: '1' })
    const { reload, fire } = guard(() => storage)
    expect(fire().defaultPrevented).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it.each([
    ['reading the mark', (): MarkStorage => ({ getItem: () => { throw new Error('storage blocked') }, setItem: () => {} })],
    ['writing the mark', (): MarkStorage => ({ getItem: () => null, setItem: () => { throw new Error('storage full') } })],
    ['being reached at all', (): MarkStorage => { throw new Error('SecurityError') }],
  ])('neither cancels nor reloads when storage throws on %s', (_, getStorage) => {
    const { reload, fire } = guard(getStorage)
    expect(fire().defaultPrevented).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('leaves a stylesheet the loader could not load to the code that asked for it, and keeps the one reload for a script', () => {
    // src/lib/scopeStylesheets.ts asks once more for a look's stylesheet and draws the page without it.
    const { storage, map } = memoryStorage()
    const { reload, fire } = guard(() => storage)
    const sheet = fire(STYLESHEET_FAILED())
    expect(sheet.defaultPrevented).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    expect(storage.getItem).not.toHaveBeenCalled()
    expect(map.has(STALE_RELOAD_KEY)).toBe(false)
    // A script that fails afterwards still gets its one reload.
    expect(fire(SCRIPT_FAILED()).defaultPrevented).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('answers any other failure the loader reports, whatever its error, the first time', () => {
    const { storage } = memoryStorage()
    const { reload, fire } = guard(() => storage)
    expect(fire(new Error('Importing a module script failed.')).defaultPrevented).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('pays no heed to any other event', () => {
    const { storage } = memoryStorage()
    const { win, reload } = guard(() => storage)
    const other = new Event('error', { cancelable: true })
    win.dispatchEvent(other)
    expect(other.defaultPrevented).toBe(false)
    expect(reload).not.toHaveBeenCalled()
    expect(storage.getItem).not.toHaveBeenCalled()
  })

  it('never clears the mark, and keeps to its one key', () => {
    const source = read('src/lib/reloadOnStaleChunk.ts')
    expect(source).not.toMatch(/removeItem|\.clear\(/)
    expect(STALE_RELOAD_KEY).toBe('lca-stale-reload')
  })
})

describe('the build loader\'s event', () => {
  it('is the name the installed loader types and fires, it can be cancelled, and a stylesheet\'s failure is named in the loader\'s words', () => {
    expect(read('node_modules/vite/client.d.ts')).toContain(`'${PRELOAD_ERROR_EVENT}': VitePreloadErrorEvent`)
    // The preload helper the build writes into the site: it throws the error only when no listener cancelled the event.
    const chunks = join(ROOT, 'node_modules/vite/dist/node/chunks')
    const helper = readdirSync(chunks)
      .filter((name) => name.endsWith('.js'))
      .map((name) => readFileSync(join(chunks, name), 'utf8'))
      .find((text) => text.includes(`new Event("${PRELOAD_ERROR_EVENT}", { cancelable: true })`))
    expect(helper, 'the loader builds the event as a cancelable one').toBeDefined()
    expect(helper).toMatch(/window\.dispatchEvent\(e\);\s*if \(!e\.defaultPrevented\) throw err;/)
    // The error the loader gives a stylesheet that failed, which the guard leaves alone.
    expect(STYLESHEET_FAILURE).toBe('Unable to preload CSS')
    expect(helper).toContain('new Error(`Unable to preload CSS for ${dep}`)')
  })
})

describe('src/main.tsx', () => {
  const main = read('src/main.tsx')

  it('imports the guard and calls it once, at the top level, before the app is drawn and outside the newLook block', () => {
    expect(main).toContain('import { reloadOnStaleChunk } from \'@/lib/reloadOnStaleChunk\'')
    const calls = [...main.matchAll(/^reloadOnStaleChunk\(\)$/gm)]
    expect(calls).toHaveLength(1)
    expect(main.match(/reloadOnStaleChunk\(/g)).toHaveLength(1)
    const at = calls[0].index ?? -1
    const drawn = main.indexOf('createRoot(document')
    expect(drawn).toBeGreaterThan(-1)
    expect(at).toBeLessThan(drawn)
    const block = main.indexOf('if (FEATURES.newLook) {')
    const blockEnd = main.indexOf('\n}\n', block)
    expect(block).toBeGreaterThan(-1)
    expect(at < block || at > blockEnd).toBe(true)
  })
})
