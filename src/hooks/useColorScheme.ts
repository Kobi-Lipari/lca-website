// src/hooks/useColorScheme.ts
//
// The page's light and dark state (src/lib/colorScheme.ts), wired to this
// browser: localStorage, the prefers-color-scheme query, <html>, and the
// head, where a pick of Light or Dark sets the browser bar's colour. With
// newLook off it never touches the page.
//
// src/main.tsx calls startColorScheme() once when newLook is on, so the page
// follows the device setting even where no Appearance control is shown;
// useColorScheme() is for the control itself.
import { useSyncExternalStore } from 'react'
import { FEATURES } from '@/lib/features'
import { createColorScheme, SYSTEM_DARK_QUERY, type Appearance, type ColorScheme } from '@/lib/colorScheme'

let scheme: ColorScheme | null = null

function pageScheme(): ColorScheme {
  if (!scheme) {
    scheme = createColorScheme({
      enabled: FEATURES.newLook,
      root: document.documentElement,
      getStorage: () => window.localStorage,
      systemQuery: () => (typeof window.matchMedia === 'function' ? window.matchMedia(SYSTEM_DARK_QUERY) : null),
      head: () => document.head,
    })
  }
  return scheme
}

/** Applies the choice and follows the device setting. Returns a stop function. */
export function startColorScheme(): () => void {
  return pageScheme().start()
}

/** The visitor's choice, whether the page is dark, and a way to change it. */
export function useColorScheme(): { appearance: Appearance; dark: boolean; setAppearance: (a: Appearance) => void } {
  const s = pageScheme()
  const appearance = useSyncExternalStore(s.subscribe, s.appearance, s.appearance)
  const dark = useSyncExternalStore(s.subscribe, s.dark, s.dark)
  return { appearance, dark, setAppearance: s.setAppearance }
}
