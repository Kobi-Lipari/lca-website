// @vitest-environment jsdom
//
// The loader of the looks' own stylesheets (WS01 step 31,
// src/lib/scopeStylesheets.ts), which ThemeScope uses and through it
// HeritageLayout, so a heritage page waits for its type before it paints.
//
// - A look's file is asked for once for the whole visit: every call while
//   it is on its way, and after it has loaded, gives the one promise, which
//   settles when the file has loaded and never rejects. Base and scholastic
//   have no file and settle at once.
// - Driven with imports that act as Vite's loader does in a built site (the
//   import adds the file's <link> as it starts, resolves when the link
//   loads, fails when it fails, and a second import of the same file
//   resolves at once and adds nothing), a failed load is handled by the
//   loader itself: the failed link is replaced by a fresh one whose address
//   carries a query of its own, once, at once; if that fails too the
//   request settles as not loaded. A request made within RETRY_AFTER_MS of
//   the failure takes it as it is, so a failing file is asked for twice in a
//   row at most; a later one adds a fresh link again, never calling the
//   import, which would fetch nothing. An import that fails having added no
//   link (the development server, a unit test's stand-in) is called again by
//   a later request instead.
// - pending gives what a page waits on while the request is on its way,
//   starting the first one, and nothing once it has settled; it never starts
//   another after a failure, since a page waiting on it draws again each
//   time it settles.
// - A page waits HOLD_AT_MOST_MS (three seconds) at most: what pending gives
//   is one promise per request, made the first time a page waits, which
//   settles when the request does or when that time has passed, whichever
//   comes first; after that pending gives nothing for the request, though
//   the file is still on its way and still loads. No timer runs for a
//   request no page waits on.
// - The site's own loader names only the heritage and live files.
import { afterEach, describe, expect, it, vi } from 'vitest'

const files = vi.hoisted(() => ({ heritage: vi.fn(), live: vi.fn() }))
vi.mock('@/styles/themes/heritage.css', () => {
  files.heritage()
  return {}
})
vi.mock('@/styles/themes/live.css', () => {
  files.live()
  return {}
})

const { HOLD_AT_MOST_MS, RETRY_AFTER_MS, scopeStylesheetLoader, loadScopeStylesheet, scopeStylesheetPending } = await import('@/lib/scopeStylesheets')

const SHEET = '/assets/heritage-test.css'

/** A timer the test runs itself: each wait is noted with its length, and ends when the test says. */
function testTimer() {
  const waits: { ms: number; end: () => void }[] = []
  const wait = vi.fn((ms: number) => new Promise<void>((resolve) => waits.push({ ms, end: resolve })))
  return { wait, waits }
}

/** The stylesheet links in the page, by address. */
const links = () => [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((l) => l.getAttribute('href'))
const linkFor = (href: string) => document.querySelector<HTMLLinkElement>(`link[rel="stylesheet"][href="${href}"]`)!
const fire = (href: string, event: 'load' | 'error') => linkFor(href).dispatchEvent(new Event(event))
/** Lets the promise callbacks in flight run. */
const flush = () => new Promise((r) => setTimeout(r, 0))

/**
 * An import of one stylesheet that acts as Vite's loader in a built site:
 * the first call adds the link and settles with it; every later call
 * resolves at once and adds nothing, whatever became of the first.
 */
function viteLikeImport(href = SHEET) {
  let seen = false
  const calls = vi.fn(() => {
    if (seen) return Promise.resolve({})
    seen = true
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    document.head.append(link)
    return new Promise((resolve, reject) => {
      link.addEventListener('load', () => resolve({}))
      link.addEventListener('error', () => reject(new Error(`Unable to preload CSS for ${href}`)))
    })
  })
  return calls
}

afterEach(() => {
  document.head.innerHTML = ''
})

describe('one request per look', () => {
  it('gives the one promise while the file is on its way and after it has loaded, and settles when it loads', async () => {
    const heritage = viteLikeImport()
    const loader = scopeStylesheetLoader({ heritage }, undefined, testTimer().wait)
    const first = loader.load('heritage')
    expect(loader.load('heritage')).toBe(first)
    const held = loader.pending('heritage')
    expect(held).toBeInstanceOf(Promise)
    expect(loader.pending('heritage')).toBe(held)
    expect(heritage).toHaveBeenCalledTimes(1)
    expect(links()).toEqual([SHEET])

    let settled = false
    void first.then(() => (settled = true))
    await flush()
    expect(settled).toBe(false)
    fire(SHEET, 'load')
    await first
    await held
    expect(settled).toBe(true)
    expect(loader.pending('heritage')).toBeNull()
    expect(loader.load('heritage')).toBe(first)
    expect(heritage).toHaveBeenCalledTimes(1)
    expect(links()).toEqual([SHEET])
  })

  it('a look with no file settles at once and imports nothing', async () => {
    const heritage = viteLikeImport()
    const loader = scopeStylesheetLoader({ heritage })
    for (const scope of ['base', 'scholastic', 'live'] as const) {
      await loader.load(scope)
      expect(loader.pending(scope), scope).toBeNull()
    }
    expect(heritage).not.toHaveBeenCalled()
    expect(links()).toEqual([])
  })

  it('pending starts the first request itself', async () => {
    const heritage = viteLikeImport()
    const loader = scopeStylesheetLoader({ heritage }, undefined, testTimer().wait)
    const pending = loader.pending('heritage')
    expect(pending).toBeInstanceOf(Promise)
    expect(heritage).toHaveBeenCalledTimes(1)
    const request = loader.load('heritage')
    expect(loader.load('heritage')).toBe(request)
    expect(heritage).toHaveBeenCalledTimes(1)
    expect(loader.pending('heritage')).toBe(pending)
    fire(SHEET, 'load')
    await pending
    expect(loader.pending('heritage')).toBeNull()
  })
})

describe('a page waits HOLD_AT_MOST_MS at most', () => {
  it('is three seconds', () => {
    expect(HOLD_AT_MOST_MS).toBe(3_000)
  })

  it('what a page waits on is one promise per request, made the first time a page waits: no timer runs for a request no page waits on', async () => {
    const { wait, waits } = testTimer()
    const loader = scopeStylesheetLoader({ heritage: viteLikeImport() }, undefined, wait)
    const request = loader.load('heritage')
    await flush()
    expect(wait).not.toHaveBeenCalled()
    const held = loader.pending('heritage')
    expect(held).toBeInstanceOf(Promise)
    expect(held).not.toBe(request)
    expect(loader.pending('heritage')).toBe(held)
    expect(waits.map((w) => w.ms)).toEqual([HOLD_AT_MOST_MS])
  })

  it('settles when the file has loaded, if that comes first, and the time running out later changes nothing', async () => {
    const { wait, waits } = testTimer()
    const loader = scopeStylesheetLoader({ heritage: viteLikeImport() }, undefined, wait)
    const held = loader.pending('heritage')!
    let settled = false
    void held.then(() => (settled = true))
    await flush()
    expect(settled).toBe(false)
    fire(SHEET, 'load')
    await held
    expect(settled).toBe(true)
    expect(loader.pending('heritage')).toBeNull()
    waits[0].end()
    await flush()
    expect(loader.pending('heritage')).toBeNull()
    expect(waits).toHaveLength(1)
  })

  it('once the time has run out with the file still on its way, it settles and pending gives nothing more, while the file still loads', async () => {
    const { wait, waits } = testTimer()
    const heritage = viteLikeImport()
    const loader = scopeStylesheetLoader({ heritage }, undefined, wait)
    const held = loader.pending('heritage')!
    const request = loader.load('heritage')
    let settled = false
    void request.then(() => (settled = true))
    waits[0].end()
    await held
    // The page waiting on it is drawn; drawn again, it gets nothing to wait for, and no new wait starts.
    expect(loader.pending('heritage')).toBeNull()
    expect(loader.pending('heritage')).toBeNull()
    expect(waits).toHaveLength(1)
    // The file is still on its way: the request is the same one, still unsettled, and nothing is asked for again.
    expect(loader.load('heritage')).toBe(request)
    await flush()
    expect(settled).toBe(false)
    expect(links()).toEqual([SHEET])
    fire(SHEET, 'load')
    await request
    expect(settled).toBe(true)
    expect(loader.pending('heritage')).toBeNull()
    expect(heritage).toHaveBeenCalledTimes(1)
  })

  it('settles too when the file cannot be loaded, before the time runs out', async () => {
    const { wait } = testTimer()
    const loader = scopeStylesheetLoader({ heritage: viteLikeImport() }, undefined, wait)
    const held = loader.pending('heritage')!
    fire(SHEET, 'error')
    await flush()
    fire(`${SHEET}?retry=1`, 'error')
    await held
    expect(loader.pending('heritage')).toBeNull()
  })

  it('a request made again after a failure has a wait of its own', async () => {
    let clock = 0
    const { wait, waits } = testTimer()
    const loader = scopeStylesheetLoader({ heritage: viteLikeImport() }, () => clock, wait)
    const first = loader.pending('heritage')!
    fire(SHEET, 'error')
    await flush()
    fire(`${SHEET}?retry=1`, 'error')
    await first
    expect(loader.pending('heritage')).toBeNull()
    clock = RETRY_AFTER_MS
    const again = loader.load('heritage')
    await flush()
    const held = loader.pending('heritage')!
    expect(held).toBeInstanceOf(Promise)
    expect(held).not.toBe(first)
    expect(waits).toHaveLength(2)
    fire(`${SHEET}?retry=2`, 'load')
    await again
    await held
    expect(loader.pending('heritage')).toBeNull()
  })
})

describe('a failed load, handled by the loader', () => {
  it('replaces the failed link with a fresh one that carries a query of its own, once, without importing again', async () => {
    const heritage = viteLikeImport()
    const loader = scopeStylesheetLoader({ heritage }, undefined, testTimer().wait)
    const request = loader.load('heritage')
    fire(SHEET, 'error')
    await flush()
    // The failed link is gone and a fresh one stands in its place; a page still waits.
    expect(links()).toEqual([`${SHEET}?retry=1`])
    const held = loader.pending('heritage')
    expect(held).toBeInstanceOf(Promise)
    fire(`${SHEET}?retry=1`, 'load')
    await request
    await held
    expect(loader.pending('heritage')).toBeNull()
    expect(heritage).toHaveBeenCalledTimes(1)
    // Loaded now: nothing is asked for again.
    await loader.load('heritage')
    expect(heritage).toHaveBeenCalledTimes(1)
    expect(links()).toEqual([`${SHEET}?retry=1`])
  })

  it('when the fresh link fails too it settles as not loaded, never rejecting; a request soon after takes the failure as it is, and a later one adds a fresh link again', async () => {
    let clock = 1_000
    const heritage = viteLikeImport()
    const loader = scopeStylesheetLoader({ heritage }, () => clock, testTimer().wait)
    const request = loader.load('heritage')
    const rejected = vi.fn()
    request.catch(rejected)
    fire(SHEET, 'error')
    await flush()
    fire(`${SHEET}?retry=1`, 'error')
    await request
    expect(rejected).not.toHaveBeenCalled()
    expect(links()).toEqual([])
    // A page waiting on it is drawn again; it gets nothing to wait for, and no new request starts.
    expect(loader.pending('heritage')).toBeNull()
    expect(loader.pending('heritage')).toBeNull()
    expect(links()).toEqual([])

    // The scope drawn as the request failed asks too: within RETRY_AFTER_MS it is given the failure, and nothing is fetched a third time.
    clock += RETRY_AFTER_MS - 1
    expect(loader.load('heritage')).toBe(request)
    await flush()
    expect(links()).toEqual([])

    // A scope drawn later adds a fresh link of its own; the import, which would fetch nothing, is not called.
    clock += 1
    const again = loader.load('heritage')
    expect(again).not.toBe(request)
    await flush()
    expect(links()).toEqual([`${SHEET}?retry=2`])
    const held = loader.pending('heritage')
    expect(held).toBeInstanceOf(Promise)
    fire(`${SHEET}?retry=2`, 'load')
    await again
    await held
    expect(loader.pending('heritage')).toBeNull()
    expect(heritage).toHaveBeenCalledTimes(1)
  })

  it('an import that fails having added no link of its own is called again by a later request', async () => {
    let clock = 0
    let fail = true
    const heritage = vi.fn(() => (fail ? Promise.reject(new Error('the file did not load')) : Promise.resolve({})))
    const loader = scopeStylesheetLoader({ heritage }, () => clock)
    await loader.load('heritage')
    expect(heritage).toHaveBeenCalledTimes(1)
    expect(loader.pending('heritage')).toBeNull()
    fail = false
    await loader.load('heritage')
    expect(heritage).toHaveBeenCalledTimes(1)
    clock = RETRY_AFTER_MS
    await loader.load('heritage')
    expect(heritage).toHaveBeenCalledTimes(2)
    await loader.load('heritage')
    expect(heritage).toHaveBeenCalledTimes(2)
    expect(links()).toEqual([])
  })

  it('waits ten seconds after a failure before asking again', () => {
    expect(RETRY_AFTER_MS).toBe(10_000)
  })

  it('an import that throws as it is called settles as not loaded too', async () => {
    const heritage = vi.fn((): Promise<unknown> => {
      throw new Error('no import')
    })
    const loader = scopeStylesheetLoader({ heritage })
    await expect(loader.load('heritage')).resolves.toBeUndefined()
    expect(loader.pending('heritage')).toBeNull()
  })

  it('keeps the looks apart: a failed live file does not touch the heritage request', async () => {
    const heritage = viteLikeImport()
    const live = viteLikeImport('/assets/live-test.css')
    const loader = scopeStylesheetLoader({ heritage, live })
    const h = loader.load('heritage')
    const l = loader.load('live')
    fire('/assets/live-test.css', 'error')
    fire(SHEET, 'load')
    await h
    await flush()
    expect(links()).toEqual([SHEET, '/assets/live-test.css?retry=1'])
    fire('/assets/live-test.css?retry=1', 'load')
    await l
    expect([loader.pending('heritage'), loader.pending('live')]).toEqual([null, null])
  })
})

describe('the site\'s own loader', () => {
  it('imports the heritage file for a heritage scope and the live file for a live one, each once, and nothing for base or scholastic', async () => {
    await loadScopeStylesheet('base')
    await loadScopeStylesheet('scholastic')
    expect(files.heritage).not.toHaveBeenCalled()
    expect(files.live).not.toHaveBeenCalled()
    await loadScopeStylesheet('heritage')
    await loadScopeStylesheet('heritage')
    expect(files.heritage).toHaveBeenCalledTimes(1)
    expect(files.live).not.toHaveBeenCalled()
    expect(scopeStylesheetPending('heritage')).toBeNull()
    await loadScopeStylesheet('live')
    expect(files.live).toHaveBeenCalledTimes(1)
  })
})
