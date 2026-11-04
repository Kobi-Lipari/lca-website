// src/lib/reloadOnStaleChunk.ts
//
// A tab left open across a deploy recovers by itself. Such a tab still asks
// for the site's pages and editors by the file names of the build it first
// loaded, and a deploy replaces those files, so the next page or editor it
// opens fails to load. When that happens the build loader fires the
// 'vite:preloadError' event on window; left alone, the error reaches the
// "Something went wrong" screen of ErrorBoundary.
//
// This guard answers the event by reloading the page once, which loads the
// new build. A mark in sessionStorage (this tab only) records the reload, and
// while it is set the guard steps aside: the next failure reaches the error
// screen as before, so a file that fails for any other reason can never start
// a loop of reloads. The guard never clears the mark. When storage cannot be
// read or written (a private window, blocked site data) it steps aside as
// well, since it could not keep the reload to once.
//
// A stylesheet the loader could not load is not the guard's to answer. The
// looks' stylesheets are the only ones a page asks for on demand, and
// src/lib/scopeStylesheets.ts, which asks for them, tries once more and then
// draws the page without one, so such a failure never reaches the error
// screen. The loader names a stylesheet it could not load in its error's
// message, and the guard leaves that event as it is.
//
// Two imports are not loaded through lazy() but awaited by a handler inside
// a try of its own: the governance documents' file reader, in handleFile of
// src/areas/governance/components/GovernanceDocuments.tsx, and the scanner's
// decoder, which src/lib/scanner/decodeInBackground.ts loads on demand only
// in a browser without Web Workers. The one reload comes before that
// handler's catch, which then meets a TypeError, since the loader answers
// with nothing, in place of the load error; and the reload replaces the
// page, with whatever its open form or scan held.
//
// No switch governs it. What a visitor sees changes only when a file fails
// to load, and only through the one reload in a tab: a stale tab mends
// itself, a page asked for while the connection is down reloads into the
// browser's own offline page, and the two handlers above meet the reload as
// set out here. src/main.tsx calls it before the app is drawn. Its window,
// storage and reload are passed in, so a test can drive it without a browser.

/** The event the build loader fires on window when a page's file fails to load. */
export const PRELOAD_ERROR_EVENT = 'vite:preloadError'

/** The sessionStorage key that marks a tab as already reloaded once. */
export const STALE_RELOAD_KEY = 'lca-stale-reload'

/** How the build loader's message for a stylesheet it could not load begins. */
export const STYLESHEET_FAILURE = 'Unable to preload CSS'

/** The parts of a window used here: somewhere to listen for the event. */
export interface EventSourceLike {
  addEventListener(type: string, listener: (event: Event) => void): void
}

/** The parts of sessionStorage used here. */
export interface MarkStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** True when the loader's event is about a stylesheet: its payload is the loader's error naming one. */
function forStylesheet(event: Event): boolean {
  const payload = (event as Event & { payload?: unknown }).payload
  return payload instanceof Error && payload.message.startsWith(STYLESHEET_FAILURE)
}

/**
 * Listens on `win` for the build loader's event. The first time a script
 * fails to load with no mark set, the guard sets the mark, keeps the error
 * from being thrown and reloads the page. Once the mark is set, or when
 * storage throws, it does nothing, and the error goes on to the error screen;
 * a stylesheet's failure it always leaves to the code that asked for it.
 *
 * `getStorage` is a function, not the storage itself, because some browsers
 * throw on the mere mention of window.sessionStorage when site data is
 * blocked; calling it inside the guard keeps that from stopping the page.
 */
export function reloadOnStaleChunk(
  win: EventSourceLike = window,
  getStorage: () => MarkStorage = () => window.sessionStorage,
  reload: () => void = () => window.location.reload(),
): void {
  win.addEventListener(PRELOAD_ERROR_EVENT, (event) => {
    if (forStylesheet(event)) return
    try {
      const storage = getStorage()
      if (storage.getItem(STALE_RELOAD_KEY) !== null) return
      storage.setItem(STALE_RELOAD_KEY, '1')
    } catch {
      return
    }
    event.preventDefault()
    reload()
  })
}
