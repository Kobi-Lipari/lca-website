// src/lib/scopeStylesheets.ts
//
// Each look's own stylesheet, fetched on demand: src/styles/themes/heritage.css
// for heritage (its faces and the type rules its pages opt into) and
// src/styles/themes/live.css for live. Scholastic's arrives with the
// Scholastic work; base never has one. ThemeScope (src/components/ThemeScope.tsx)
// is the only file that uses this one, so a page fetches a look's file only
// when it draws that look.
//
// A look's file is asked for once for the whole visit, and the request is one
// promise, which settles when the file has loaded, or when it could not be
// loaded, and never rejects: without its file a look keeps the type it had,
// which is not an error for the visitor. It must be the one promise. In a
// built site Vite's loader adds the file's <link> and resolves the import
// once the stylesheet has loaded, but it remembers every stylesheet it has
// added, so a second import() of the same file resolves at once, before the
// first has loaded, and after a failed load it fetches nothing at all and
// leaves the failed <link> in the page.
//
// So a failed load is handled here. The links the import added are noted as
// it starts; when the import fails, each link that failed is replaced by a
// fresh one whose address carries a query that sets it apart from the one
// that failed, once, at once. If that fails too, the request settles as not
// loaded and the addresses are kept, so a later request for the look (a
// heritage page drawn on a later visit, say) adds fresh links again rather
// than calling import(), which would fetch nothing. Where the import added no
// link of its own (the development server, which puts the file in a <style>,
// or the unit tests, which replace it), a later request calls import() again.
// A request made less than RETRY_AFTER_MS after the failure takes the failure
// as it is instead: the scope that asked for the file is often drawn just as
// its request fails, and asking a third time at once would only fail again.
//
// scopeStylesheetPending is for a page that should not paint before its
// look's type rules are in place (HeritageLayout, through ThemeScope's
// ScopeStylesheetReady): it starts the first request, gives something to wait
// on while the request is on its way, and gives nothing once it has settled.
// The wait is bounded. What it gives settles when the request does, or once
// HOLD_AT_MOST_MS have passed since a page first waited on it, whichever
// comes first, and from then on it gives nothing for that request: on a slow
// or stalled connection the page is drawn in the type it has, and the look's
// type takes its place when the file arrives, as when the file cannot be
// loaded at all. It never starts a request again after one failed, since a
// page waiting on it is drawn again each time it settles; a later request
// comes from a scope drawn later, which asks for its look's file as it is
// drawn.
import type { ThemeScopeName } from '@/lib/themeScopes'

/** What loads a look's stylesheet: an import() of the file. */
export type StylesheetImport = () => Promise<unknown>

/** What waits a number of milliseconds: a timer in the site, one a test drives in a test. */
export type Wait = (ms: number) => Promise<void>

/** How long after a failed request a new request for the look takes the failure as it is, in milliseconds. */
export const RETRY_AFTER_MS = 10_000

/** The longest a page waits for its look's stylesheet before it is drawn without it, in milliseconds. */
export const HOLD_AT_MOST_MS = 3_000

const timer: Wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Each look's stylesheet, imported the first time the look renders. */
const SCOPE_STYLESHEETS: Partial<Record<ThemeScopeName, StylesheetImport>> = {
  heritage: () => import('@/styles/themes/heritage.css'),
  live: () => import('@/styles/themes/live.css'),
}

const SETTLED: Promise<void> = Promise.resolve()

/** The stylesheet links in the page now. */
function stylesheetLinks(): HTMLLinkElement[] {
  return typeof document === 'undefined' ? [] : [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
}

/** True once a stylesheet link has loaded, false if it fails. Listen before the link can settle. */
function outcome(link: HTMLLinkElement): Promise<boolean> {
  return new Promise((resolve) => {
    link.addEventListener('load', () => resolve(true), { once: true })
    link.addEventListener('error', () => resolve(false), { once: true })
  })
}

/** An address with a query of its own added to it. */
function withQuery(href: string, query: string): string {
  const [path, hash] = href.split('#', 2)
  const joined = `${path}${path.includes('?') ? '&' : '?'}${query}`
  return hash === undefined ? joined : `${joined}#${hash}`
}

interface Request {
  status: 'loading' | 'loaded' | 'failed'
  promise: Promise<void>
  /** When the request settled as not loaded, by the loader's clock. */
  failedAt?: number
  /** What a page waits on: the request, or HOLD_AT_MOST_MS, whichever comes first. Made once, the first time a page waits, so a page drawn again waits on the same promise. */
  hold?: Promise<void>
  /** True once HOLD_AT_MOST_MS have passed with the request still on its way: no page waits on it any longer. */
  released: boolean
}

/**
 * The loader over a set of imports: load starts or joins a look's request,
 * pending gives what a page waits on while it is on its way. The site uses
 * the one made from SCOPE_STYLESHEETS below; a test can make one of its own
 * over imports that act as Vite's loader does, with a clock and a timer of
 * its own.
 */
export function scopeStylesheetLoader(
  imports: Partial<Record<ThemeScopeName, StylesheetImport>>,
  now: () => number = () => Date.now(),
  wait: Wait = timer,
) {
  const requests = new Map<ThemeScopeName, Request>()
  /** The addresses whose links failed in a look's last request, to be added afresh by the next. */
  const failedAddresses = new Map<ThemeScopeName, string[]>()
  let fresh = 0

  /** Puts a fresh link for each address in the page, in place of the one that failed where there is one; gives back the addresses whose fresh link failed too. */
  async function addFresh(addresses: string[], failedLinks: HTMLLinkElement[] = []): Promise<string[]> {
    fresh += 1
    const query = `retry=${fresh}`
    const results = await Promise.all(
      addresses.map((address, i) => {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = withQuery(address, query)
        const settled = outcome(link)
        const old = failedLinks[i]
        if (old?.isConnected) old.replaceWith(link)
        else document.head.append(link)
        return settled.then((loaded) => {
          if (!loaded) link.remove()
          return loaded
        })
      }),
    )
    return addresses.filter((_, i) => !results[i])
  }

  /** One request for a look's file: true when it has loaded. */
  async function request(scope: ThemeScopeName, load: StylesheetImport): Promise<boolean> {
    const again = failedAddresses.get(scope)
    if (again) {
      const still = await addFresh(again)
      if (still.length === 0) failedAddresses.delete(scope)
      else failedAddresses.set(scope, still)
      return still.length === 0
    }
    const before = new Set(stylesheetLinks())
    let imported: Promise<unknown>
    try {
      imported = load()
    } catch {
      return false
    }
    // Vite's loader adds the file's link as the import starts; note it, and listen to it, before it can settle.
    const outcomes = stylesheetLinks()
      .filter((link) => !before.has(link))
      .map((link) => outcome(link).then((loaded) => ({ link, loaded })))
    try {
      await imported
      return true
    } catch {
      const failed = (await Promise.all(outcomes)).filter((o) => !o.loaded).map((o) => o.link)
      // Nothing of the import's own to add again: the next request calls import() again.
      if (failed.length === 0) return false
      const addresses = failed.map((link) => link.getAttribute('href') ?? link.href)
      const still = await addFresh(addresses, failed)
      if (still.length > 0) failedAddresses.set(scope, still)
      return still.length === 0
    }
  }

  /** Settles a request as not loaded, noting when. */
  function markFailed(entry: Request) {
    entry.status = 'failed'
    entry.failedAt = now()
  }

  /**
   * Starts the look's request, or joins the one on its way or loaded; a
   * request that failed is made again, once RETRY_AFTER_MS have passed since
   * it failed, and until then is given as it is. Never rejects.
   */
  function load(scope: ThemeScopeName): Promise<void> {
    const importFile = imports[scope]
    if (!importFile) return SETTLED
    const known = requests.get(scope)
    if (known && (known.status !== 'failed' || now() - (known.failedAt ?? 0) < RETRY_AFTER_MS)) return known.promise
    const entry: Request = { status: 'loading', promise: SETTLED, released: false }
    entry.promise = request(scope, importFile).then(
      (loaded) => {
        if (loaded) entry.status = 'loaded'
        else markFailed(entry)
      },
      () => markFailed(entry),
    )
    requests.set(scope, entry)
    return entry.promise
  }

  /**
   * What a page waits on while the look's request is on its way, starting the
   * first request: one promise per request, settling when the request does or
   * once HOLD_AT_MOST_MS have passed since a page first waited on it. Null
   * once the request has settled or the wait has run out, and for a look with
   * no file.
   */
  function pending(scope: ThemeScopeName): Promise<void> | null {
    if (!imports[scope]) return null
    if (!requests.has(scope)) void load(scope)
    const known = requests.get(scope)
    if (!known || known.status !== 'loading' || known.released) return null
    known.hold ??= Promise.race([
      known.promise,
      wait(HOLD_AT_MOST_MS).then(() => {
        if (known.status === 'loading') known.released = true
      }),
    ])
    return known.hold
  }

  return { load, pending }
}

const site = scopeStylesheetLoader(SCOPE_STYLESHEETS)

/** Asks for a look's stylesheet, once for the whole visit; settles when it has loaded or could not be. */
export const loadScopeStylesheet = site.load

/** What a page waits on while a look's stylesheet is on its way (the first request started here), for HOLD_AT_MOST_MS at most; null once it has settled or the wait has run out. */
export const scopeStylesheetPending = site.pending
