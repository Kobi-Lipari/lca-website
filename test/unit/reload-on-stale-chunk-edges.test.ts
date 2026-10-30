// test/unit/reload-on-stale-chunk-edges.test.ts
//
// The stale-tab reload (src/lib/reloadOnStaleChunk.ts) at its edges, with
// stand-ins for the window, the storage and the reload, as
// test/unit/reload-on-stale-chunk.test.ts has them. That file pins the rule
// itself, and test/unit/reload-on-stale-chunk-loader.test.ts runs it with the
// loader the build emits; this one adds what they leave out.
//
// - Calling the guard reaches nothing but the window: storage is reached
//   only when the loader's event comes. src/main.tsx calls the guard before
//   the app is drawn, so a throw there, from a browser that throws on the
//   mere mention of sessionStorage, would leave the page blank.
// - Called twice on one window, as a second run of src/main.tsx would call
//   it, the guard still reloads once and cancels the event once, and the
//   next event goes through.
// - A stylesheet's failure that comes once the mark is set is left alone
//   too, without a read of storage.
// - Nothing governs the guard: the module imports nothing, so no switch,
//   contract or validation library reaches it, and src/main.tsx calls it at
//   the top level with no arguments, so it gets the page's own window,
//   storage and reload.
// - What leaving a stylesheet alone relies on: every stylesheet the site's
//   code imports is the site's own, in src/main.tsx, or a look's, in
//   src/lib/scopeStylesheets.ts, which handles its own failure. The loader
//   asks for a page's stylesheets before its script, so a page loaded on
//   demand with a stylesheet of its own would meet the error screen on a
//   stale tab, the guard leaving that stylesheet's failure alone. The
//   follow-up "Stylesheets loaded with a page (WS02 step 1)" asks the change
//   that adds one to handle it; the last test here is where that change
//   learns of it.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { PRELOAD_ERROR_EVENT, reloadOnStaleChunk, STALE_RELOAD_KEY, type MarkStorage } from '@/lib/reloadOnStaleChunk'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** The loader's event, as it builds it: one that can be cancelled, with the failure as its payload. */
function loaderEvent(payload: Error): Event {
  return Object.assign(new Event(PRELOAD_ERROR_EVENT, { cancelable: true }), { payload })
}
const scriptGone = () => new TypeError('Failed to fetch dynamically imported module: /assets/RichTextEditor-old.js')
const sheetFailed = () => new Error('Unable to preload CSS for /assets/live-old.css')

/** A sessionStorage stand-in whose reads and writes are counted. */
function storage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    map,
    store: {
      getItem: vi.fn((key: string) => map.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => void map.set(key, value)),
    } satisfies MarkStorage,
  }
}

describe('calling the guard', () => {
  it('reaches nothing but the window: storage is only reached once the loader\'s event comes', () => {
    const win = new EventTarget()
    const getStorage = vi.fn((): MarkStorage => {
      throw new Error('SecurityError: the page may not use sessionStorage')
    })
    const reload = vi.fn()
    expect(() => reloadOnStaleChunk(win, getStorage, reload)).not.toThrow()
    expect(getStorage).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
    // The event reaches storage, which throws, and the guard steps aside without throwing itself.
    const event = loaderEvent(scriptGone())
    expect(() => win.dispatchEvent(event)).not.toThrow()
    expect(getStorage).toHaveBeenCalledTimes(1)
    expect(event.defaultPrevented).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('twice on one window, as a second run of src/main.tsx would, still cancels once and reloads once', () => {
    const win = new EventTarget()
    const { store, map } = storage()
    const reload = vi.fn()
    reloadOnStaleChunk(win, () => store, reload)
    reloadOnStaleChunk(win, () => store, reload)
    const first = loaderEvent(scriptGone())
    win.dispatchEvent(first)
    expect(first.defaultPrevented).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(store.setItem).toHaveBeenCalledTimes(1)
    expect(map.get(STALE_RELOAD_KEY)).toBe('1')
    const next = loaderEvent(scriptGone())
    win.dispatchEvent(next)
    expect(next.defaultPrevented).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('leaves a stylesheet\'s failure alone once the mark is set as well, without reading storage', () => {
    const win = new EventTarget()
    const { store } = storage({ [STALE_RELOAD_KEY]: '1' })
    const reload = vi.fn()
    reloadOnStaleChunk(win, () => store, reload)
    const sheet = loaderEvent(sheetFailed())
    win.dispatchEvent(sheet)
    expect(sheet.defaultPrevented).toBe(false)
    expect(store.getItem).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()
  })
})

describe('nothing governs the guard', () => {
  it('imports nothing: no switch, contract or validation library can reach it', () => {
    const source = read('src/lib/reloadOnStaleChunk.ts')
    expect(source).not.toMatch(/^\s*import\b/m)
    expect(source).not.toMatch(/\bimport\s*\(/)
    expect(source).not.toMatch(/\brequire\s*\(/)
    expect(source).not.toMatch(/FEATURES/)
  })

  it('is called by src/main.tsx at the top level, with no arguments, ahead of every block', () => {
    const main = read('src/main.tsx')
    const lines = main.split('\n')
    const at = lines.findIndex((l) => l.includes('reloadOnStaleChunk('))
    expect(lines[at]).toBe('reloadOnStaleChunk()')
    // No block is open where it is called: every brace and bracket before it is closed.
    const before = lines.slice(0, at).join('\n').replace(/\/\/.*$/gm, '').replace(/'[^'\n]*'/g, "''")
    let depth = 0
    for (const ch of before) {
      if (ch === '{' || ch === '(' || ch === '[') depth++
      if (ch === '}' || ch === ')' || ch === ']') depth--
    }
    expect(depth).toBe(0)
    // Nothing that decides whether code runs comes before it: no if, no switch, no ternary on a switch.
    expect(before).not.toMatch(/\bif\s*\(|\bswitch\s*\(|FEATURES\./)
  })
})

describe('what leaving a stylesheet alone relies on', () => {
  /** Every .ts and .tsx file under src, as a path from the repository's root. */
  function sourceFiles(dir = 'src'): string[] {
    return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) return sourceFiles(path)
      return /\.tsx?$/.test(entry.name) ? [path] : []
    })
  }

  /** Each stylesheet a file imports, in any form: a plain import, an import with a name, or an import() on demand, with or without a query. */
  const STYLESHEET = /(?:\bimport\s*\(\s*|\bimport\s+(?:[\w{},*\s]+\s+from\s+)?|\bfrom\s+)(['"`])([^'"`\n]+\.(?:css|scss|sass|less|styl|pcss|postcss)(?:\?[^'"`\n]*)?)\1/g

  it('finds a stylesheet in each form it looks for, and nothing in plain text', () => {
    const found = (text: string) => [...text.matchAll(STYLESHEET)].map((m) => m[2])
    expect(found("import './index.css'")).toEqual(['./index.css'])
    expect(found("import styles from './page.module.css'")).toEqual(['./page.module.css'])
    expect(found("const url = await import('./print.css?url')")).toEqual(['./print.css?url'])
    expect(found("export { default } from 'some-package/dist/style.css'")).toEqual(['some-package/dist/style.css'])
    expect(found('// the site stylesheet is index.css')).toEqual([])
  })

  it('every stylesheet the site\'s code imports is the site\'s own or a look\'s, which src/lib/scopeStylesheets.ts loads and retries', () => {
    const imports = sourceFiles().flatMap((path) => [...read(path).matchAll(STYLESHEET)].map((m) => `${path}: ${m[2]}`))
    expect(
      imports.sort(),
      'A new stylesheet import: if it loads with a page on demand, the stale-tab reload leaves its failure alone and a stale tab meets the error screen on that page. Load it as src/lib/scopeStylesheets.ts loads the looks\' stylesheets, or let src/lib/reloadOnStaleChunk.ts reload for it, with a test; see the follow-up "Stylesheets loaded with a page (WS02 step 1)" in REDESIGN_STATUS.md. Then add it here.',
    ).toEqual([
      'src/lib/scopeStylesheets.ts: @/styles/themes/heritage.css',
      'src/lib/scopeStylesheets.ts: @/styles/themes/live.css',
      'src/main.tsx: ./index.css',
    ])
  })
})
