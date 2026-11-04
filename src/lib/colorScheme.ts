// src/lib/colorScheme.ts
//
// Light and dark for the new look (the newLook switch). A visitor picks
// System, Light or Dark in the Appearance control; System, the default,
// follows the device setting (prefers-color-scheme). The choice is kept in
// this browser's localStorage, and every read and write is wrapped, so a
// browser that blocks storage simply stays on System.
//
// The dark look is the .dark class on <html>. It is only ever added when
// newLook is on: with the switch off, .dark would wake the stock shadcn dark
// block in src/index.css, which is not a finished look.
//
// Two places apply the choice:
//   - PREPAINT_SCRIPT, which vite.config.ts writes into the page head only
//     when the build has newLook on, so the page is drawn in the right
//     scheme from the first frame (no flash of the light look);
//   - createColorScheme, which src/hooks/useColorScheme.ts runs in the page
//     to apply a new choice and follow the device setting as it changes.
//
// The browser bar follows the choice too (WS02 step 3). index.html gives it
// two theme-color metas, one for a light device and one for a dark one, so
// on System it follows the device. A pick of Light or Dark adds one more
// theme-color meta, with no media and that look's colour, first in the head:
// a browser takes the first theme-color meta whose media matches or that has
// none, so it wins over the two. Picking System again takes it away. The
// script adds it before the first paint, before the two metas are parsed;
// createColorScheme keeps the same one up to date afterwards and never
// makes a second.
//
// This file uses no browser globals directly: the caller hands in storage,
// the media query, the root element and the head. That keeps it testable
// and lets vite.config.ts import PREPAINT_SCRIPT under Node.

/** What the visitor picked. */
export type Appearance = 'system' | 'light' | 'dark'

/** The three choices, in the order the control shows them. */
export const APPEARANCES: readonly Appearance[] = ['system', 'light', 'dark']

/** The localStorage key the choice is kept under. */
export const APPEARANCE_KEY = 'lca-appearance'

/** The media query for the device's dark setting. */
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

/** The class that turns on the dark tokens. */
export const DARK_CLASS = 'dark'

/**
 * The browser bar's colour in each look, the same as index.html's two
 * theme-color metas give for a light and a dark device
 * (test/unit/theme-color.test.tsx holds the three places to one value each).
 */
export const THEME_COLOR_LIGHT = '#1a2744'
export const THEME_COLOR_DARK = '#0b1220'

/**
 * The attribute that marks the one theme-color meta the choice owns, holding
 * the look it was added for, so neither the script nor the module ever
 * touches index.html's own two.
 */
export const THEME_COLOR_ATTRIBUTE = 'data-appearance'

/** The parts of localStorage used here. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** The parts of a MediaQueryList used here. */
export interface MediaQueryLike {
  readonly matches: boolean
  addEventListener?(type: 'change', listener: () => void): void
  removeEventListener?(type: 'change', listener: () => void): void
}

/** The parts of the <html> element used here. */
export interface RootLike {
  classList: {
    toggle(token: string, force?: boolean): boolean
    contains(token: string): boolean
  }
}

/** The parts of a <meta> element used here. */
export interface MetaLike {
  setAttribute(name: string, value: string): void
  remove(): void
}

/** The parts of the page's <head> used here. */
export interface HeadLike {
  querySelectorAll(selectors: string): ArrayLike<MetaLike>
  readonly firstChild: unknown
  insertBefore(node: object, child: unknown): unknown
  readonly ownerDocument: { createElement(tagName: 'meta'): MetaLike }
}

/** A stored value as a choice: anything other than light or dark is System. */
export function parseAppearance(value: unknown): Appearance {
  return value === 'light' || value === 'dark' ? value : 'system'
}

/**
 * The stored choice, or System when there is none or storage cannot be
 * read. `getStorage` may itself throw: some browsers throw on the mere
 * mention of window.localStorage when site data is blocked.
 */
export function readAppearance(getStorage: () => StorageLike | null | undefined): Appearance {
  try {
    return parseAppearance(getStorage()?.getItem(APPEARANCE_KEY))
  } catch {
    return 'system'
  }
}

/**
 * Keeps the choice; System removes the key rather than storing it. Returns
 * false when storage refused, in which case the choice lasts only until the
 * page is reloaded.
 */
export function writeAppearance(getStorage: () => StorageLike | null | undefined, appearance: Appearance): boolean {
  try {
    const storage = getStorage()
    if (!storage) return false
    if (appearance === 'system') storage.removeItem(APPEARANCE_KEY)
    else storage.setItem(APPEARANCE_KEY, appearance)
    return true
  } catch {
    return false
  }
}

/** Whether the page should be dark, given the choice and the device setting. */
export function isDarkScheme(appearance: Appearance, systemDark: boolean): boolean {
  return appearance === 'dark' || (appearance === 'system' && systemDark)
}

/**
 * The browser bar's colour a choice asks for: Light's or Dark's, or null for
 * System, which leaves it to index.html's two metas and the device.
 */
export function themeColorFor(appearance: Appearance): string | null {
  if (appearance === 'light') return THEME_COLOR_LIGHT
  if (appearance === 'dark') return THEME_COLOR_DARK
  return null
}

/** The one theme-color meta the choice owns. */
const OWN_THEME_COLOR = `meta[name="theme-color"][${THEME_COLOR_ATTRIBUTE}]`

/**
 * Puts the choice's browser bar colour in the head: for Light or Dark, the
 * one meta the choice owns, first in the head, with that look's colour
 * (added if it is not there, brought up to date if it is); for System, no
 * such meta. Never leaves two, and never touches any other meta.
 */
export function applyThemeColor(head: HeadLike, appearance: Appearance): void {
  const color = themeColorFor(appearance)
  const [own, ...extra] = Array.from(head.querySelectorAll(OWN_THEME_COLOR))
  for (const meta of extra) meta.remove()
  if (color === null) {
    own?.remove()
    return
  }
  if (own) {
    own.setAttribute('content', color)
    own.setAttribute(THEME_COLOR_ATTRIBUTE, appearance)
    // First in the head, where it wins over index.html's two.
    if (head.firstChild !== own) head.insertBefore(own, head.firstChild)
    return
  }
  const meta = head.ownerDocument.createElement('meta')
  meta.setAttribute('name', 'theme-color')
  meta.setAttribute('content', color)
  meta.setAttribute(THEME_COLOR_ATTRIBUTE, appearance)
  head.insertBefore(meta, head.firstChild)
}

/**
 * The script the build puts in the page head when newLook is on. It runs
 * before the first paint: it sets data-look="new" and adds .dark when the
 * stored choice, or the device on System, says dark. Then, in a try of its
 * own so that a head it cannot reach never costs the dark class, it adds the
 * choice's theme-color meta first in the head when Light or Dark is stored
 * (see applyThemeColor; the script runs before index.html's two metas are
 * parsed, so it can only add one of its own). Plain ES5 in one expression,
 * so it runs in any browser that can show the site; a storage error leaves
 * the choice on System. test/unit/prepaint-gate.test.ts runs it against
 * isDarkScheme for every stored value, and test/unit/theme-color.test.tsx
 * reads the browser bar's colour it leaves.
 */
export const PREPAINT_SCRIPT =
  '(function(){' +
  'var r=document.documentElement,a;' +
  "r.setAttribute('data-look','new');" +
  `try{a=window.localStorage.getItem('${APPEARANCE_KEY}')}catch(e){}` +
  `var d=a==='dark'||(a!=='light'&&!!window.matchMedia&&window.matchMedia('${SYSTEM_DARK_QUERY}').matches);` +
  `r.classList.toggle('${DARK_CLASS}',d);` +
  "try{if(a==='light'||a==='dark'){" +
  "var h=document.head,m=document.createElement('meta');" +
  "m.setAttribute('name','theme-color');" +
  `m.setAttribute('content',a==='dark'?'${THEME_COLOR_DARK}':'${THEME_COLOR_LIGHT}');` +
  `m.setAttribute('${THEME_COLOR_ATTRIBUTE}',a);` +
  'h.insertBefore(m,h.firstChild)' +
  '}}catch(e){}' +
  '})()'

export interface ColorSchemeOptions {
  /** Whether newLook is on. When it is not, .dark is never added. */
  enabled: boolean
  root: RootLike
  getStorage: () => StorageLike | null | undefined
  /** The device's dark setting, or null when the browser cannot say. */
  systemQuery: () => MediaQueryLike | null | undefined
  /**
   * The page's <head>, for the browser bar's colour. Without it, or when it
   * gives nothing or throws, the choice leaves the browser bar to the page's
   * own metas and still sets the dark class.
   */
  head?: () => HeadLike | null | undefined
}

export interface ColorScheme {
  /** The visitor's choice. */
  appearance(): Appearance
  /** Whether the page is dark now. */
  dark(): boolean
  /** Changes the choice, keeps it when storage allows, and applies it. */
  setAppearance(appearance: Appearance): void
  /** Applies the current choice to the root element and, given the head, to the browser bar. */
  apply(): void
  /** Calls `listener` whenever the choice or the device setting changes. */
  subscribe(listener: () => void): () => void
  /**
   * Follows the device setting while the choice is System. Returns a
   * function that stops following it.
   */
  start(): () => void
}

/** The page's light and dark state; see the comment at the top of the file. */
export function createColorScheme(options: ColorSchemeOptions): ColorScheme {
  const { enabled, root, getStorage, systemQuery, head } = options
  let appearance = readAppearance(getStorage)
  const listeners = new Set<() => void>()

  const query = (): MediaQueryLike | null => {
    try {
      return systemQuery() ?? null
    } catch {
      return null
    }
  }
  const systemDark = () => query()?.matches === true
  const dark = () => enabled && isDarkScheme(appearance, systemDark())
  const apply = () => {
    if (!enabled) return
    root.classList.toggle(DARK_CLASS, dark())
    if (!head) return
    try {
      const target = head()
      if (target) applyThemeColor(target, appearance)
    } catch {
      // A head that cannot be reached leaves the browser bar to the page's own metas.
    }
  }
  const notify = () => {
    for (const listener of listeners) listener()
  }

  return {
    appearance: () => appearance,
    dark,
    apply,
    setAppearance(next) {
      appearance = parseAppearance(next)
      writeAppearance(getStorage, appearance)
      apply()
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start() {
      apply()
      const mql = query()
      if (!enabled || !mql?.addEventListener) return () => {}
      const onChange = () => {
        apply()
        notify()
      }
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener?.('change', onChange)
    },
  }
}
