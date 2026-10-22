// @vitest-environment jsdom
//
// The loader of the looks' own stylesheets (src/lib/scopeStylesheets.ts,
// WS01 step 31) at its edges, with imports that act as Vite's loader does in
// a built site: the import adds its links as it starts, resolves when they
// have all loaded, fails when one fails, and a second import of the same
// file resolves at once and adds nothing.
//
// - An import whose file brings two stylesheets, one of which fails: only
//   the one that failed is replaced by a fresh link, the one that loaded is
//   left alone, and the request settles once the fresh link has loaded.
// - When a fresh link fails too, the request settles as not loaded, never
//   rejecting, and only the addresses still failing are tried again by a
//   later request, once RETRY_AFTER_MS have passed, each with a query of
//   its own; the import is never called a second time.
// - An address that already has a query, or a fragment, keeps both: the
//   fresh one joins its own query with "&", before the fragment.
// - A failed link that is no longer in the page is not looked for: the
//   fresh link is added to the head.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RETRY_AFTER_MS, scopeStylesheetLoader } from '@/lib/scopeStylesheets'

const links = () => [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((l) => l.getAttribute('href'))
const fire = (href: string, event: 'load' | 'error') => {
  const link = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].find((l) => l.getAttribute('href') === href)
  if (!link) throw new Error(`no link for ${href}; the page has ${links().join(', ') || 'none'}`)
  link.dispatchEvent(new Event(event))
}
const flush = () => new Promise((r) => setTimeout(r, 0))

/** An import of a file that brings these stylesheets, as Vite's loader in a built site adds and waits on them. */
function viteLikeImport(...hrefs: string[]) {
  let seen = false
  return vi.fn(() => {
    if (seen) return Promise.resolve({})
    seen = true
    const waits = hrefs.map((href) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      document.head.append(link)
      return new Promise((resolve, reject) => {
        link.addEventListener('load', resolve)
        link.addEventListener('error', () => reject(new Error(`Unable to preload CSS for ${href}`)))
      })
    })
    return Promise.all(waits).then(() => ({}))
  })
}

afterEach(() => {
  document.head.innerHTML = ''
})

describe('a file that brings two stylesheets', () => {
  const A = '/assets/heritage-a.css'
  const B = '/assets/heritage-b.css'

  it('replaces only the one that failed, leaves the one that loaded, and settles once the fresh link has loaded', async () => {
    const heritage = viteLikeImport(A, B)
    // A timer that never runs out, so a page waits for the request itself.
    const loader = scopeStylesheetLoader({ heritage }, undefined, () => new Promise<void>(() => {}))
    const request = loader.load('heritage')
    let settled = false
    void request.then(() => (settled = true))
    fire(A, 'load')
    fire(B, 'error')
    await flush()
    expect(links()).toEqual([A, `${B}?retry=1`])
    expect(settled).toBe(false)
    const held = loader.pending('heritage')
    expect(held).toBeInstanceOf(Promise)
    fire(`${B}?retry=1`, 'load')
    await request
    await held
    expect(settled).toBe(true)
    expect(loader.pending('heritage')).toBeNull()
    expect(heritage).toHaveBeenCalledTimes(1)
  })

  it('when a fresh link fails too it settles as not loaded, and a later request tries again only what still fails', async () => {
    let clock = 0
    const heritage = viteLikeImport(A, B)
    const loader = scopeStylesheetLoader({ heritage }, () => clock)
    const request = loader.load('heritage')
    const rejected = vi.fn()
    request.catch(rejected)
    fire(A, 'error')
    fire(B, 'error')
    await flush()
    expect(links()).toEqual([`${A}?retry=1`, `${B}?retry=1`])
    fire(`${A}?retry=1`, 'load')
    fire(`${B}?retry=1`, 'error')
    await request
    expect(rejected).not.toHaveBeenCalled()
    // The fresh link that failed is taken away; the one that loaded stays.
    expect(links()).toEqual([`${A}?retry=1`])
    expect(loader.pending('heritage')).toBeNull()

    // Soon after, the failure is taken as it is.
    clock = RETRY_AFTER_MS - 1
    expect(loader.load('heritage')).toBe(request)
    expect(links()).toEqual([`${A}?retry=1`])

    // Later, only the address still failing is tried again, with a query of its own.
    clock = RETRY_AFTER_MS
    const again = loader.load('heritage')
    expect(again).not.toBe(request)
    await flush()
    expect(links()).toEqual([`${A}?retry=1`, `${B}?retry=2`])
    fire(`${B}?retry=2`, 'load')
    await again
    expect(loader.pending('heritage')).toBeNull()
    expect(heritage).toHaveBeenCalledTimes(1)

    // Loaded now: nothing more is asked for, however long after.
    clock = 10 * RETRY_AFTER_MS
    await loader.load('heritage')
    expect(links()).toEqual([`${A}?retry=1`, `${B}?retry=2`])
    expect(heritage).toHaveBeenCalledTimes(1)
  })
})

describe('the fresh link\'s address', () => {
  it('keeps a query the address already has, joining its own with "&", and keeps a fragment after it', async () => {
    const withQuery = '/assets/heritage-q.css?v=2'
    const withHash = '/assets/heritage-h.css#layer'
    const both = '/assets/heritage-qh.css?v=3#layer'
    for (const [href, fresh] of [
      [withQuery, '/assets/heritage-q.css?v=2&retry=1'],
      [withHash, '/assets/heritage-h.css?retry=1#layer'],
      [both, '/assets/heritage-qh.css?v=3&retry=1#layer'],
    ] as const) {
      document.head.innerHTML = ''
      const loader = scopeStylesheetLoader({ heritage: viteLikeImport(href) })
      const request = loader.load('heritage')
      fire(href, 'error')
      await flush()
      expect(links(), href).toEqual([fresh])
      fire(fresh, 'load')
      await request
      expect(loader.pending('heritage')).toBeNull()
    }
  })

  it('adds the fresh link to the head when the one that failed has been taken out of the page', async () => {
    const SHEET = '/assets/heritage-gone.css'
    const heritage = vi.fn(() => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = SHEET
      document.head.append(link)
      return new Promise((_resolve, reject) => {
        link.addEventListener('error', () => {
          // Something else in the page takes the failed link out before the loader reads it.
          link.remove()
          reject(new Error(`Unable to preload CSS for ${SHEET}`))
        })
      })
    })
    const loader = scopeStylesheetLoader({ heritage })
    const request = loader.load('heritage')
    document.querySelector('link')!.dispatchEvent(new Event('error'))
    await flush()
    expect(links()).toEqual([`${SHEET}?retry=1`])
    expect(document.head.lastElementChild!.getAttribute('href')).toBe(`${SHEET}?retry=1`)
    fire(`${SHEET}?retry=1`, 'load')
    await request
    expect(loader.pending('heritage')).toBeNull()
  })
})
