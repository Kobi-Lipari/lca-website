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
// This file uses no browser globals directly: the caller hands in storage,
// the media query and the root element. That keeps it testable and lets
// vite.config.ts import PREPAINT_SCRIPT under Node.

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
 * The script the build puts in the page head when newLook is on. It runs
 * before the first paint: it sets data-look="new" and adds .dark when the
 * stored choice, or the device on System, says dark. Plain ES5 in one
 * expression, so it runs in any browser that can show the site; a storage
 * error leaves the choice on System. test/unit/prepaint-gate.test.ts runs it
 * against isDarkScheme for every stored value.
 */
export const PREPAINT_SCRIPT =
  '(function(){' +
  'var r=document.documentElement,a;' +
  "r.setAttribute('data-look','new');" +
  `try{a=window.localStorage.getItem('${APPEARANCE_KEY}')}catch(e){}` +
  `var d=a==='dark'||(a!=='light'&&!!window.matchMedia&&window.matchMedia('${SYSTEM_DARK_QUERY}').matches);` +
  `r.classList.toggle('${DARK_CLASS}',d)` +
  '})()'

export interface ColorSchemeOptions {
  /** Whether newLook is on. When it is not, .dark is never added. */
  enabled: boolean
  root: RootLike
  getStorage: () => StorageLike | null | undefined
  /** The device's dark setting, or null when the browser cannot say. */
  systemQuery: () => MediaQueryLike | null | undefined
}

export interface ColorScheme {
  /** The visitor's choice. */
  appearance(): Appearance
  /** Whether the page is dark now. */
  dark(): boolean
  /** Changes the choice, keeps it when storage allows, and applies it. */
  setAppearance(appearance: Appearance): void
  /** Applies the current choice to the root element. */
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
  const { enabled, root, getStorage, systemQuery } = options
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
