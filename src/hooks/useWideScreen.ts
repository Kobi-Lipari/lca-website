// src/hooks/useWideScreen.ts
//
// Whether the window is 1024 pixels wide or wider, where the new header is
// drawn with the chrome on (src/components/layout/Navbar.tsx). It is read
// from the browser's own media query and followed as the window changes,
// so the header swaps the moment the width crosses 1024 pixels. Where
// there is no matchMedia (the unit tests' page), it answers false, and
// today's header is drawn.
import { useSyncExternalStore } from 'react'

/** The width from which the new header is drawn. */
export const WIDE_QUERY = '(min-width: 1024px)'

const query = (): MediaQueryList | null => (typeof window.matchMedia === 'function' ? window.matchMedia(WIDE_QUERY) : null)

function subscribe(changed: () => void): () => void {
  const list = query()
  if (!list) return () => {}
  list.addEventListener('change', changed)
  return () => list.removeEventListener('change', changed)
}

const wide = () => query()?.matches ?? false

/** True while the window is 1024 pixels wide or wider. */
export function useWideScreen(): boolean {
  return useSyncExternalStore(subscribe, wide, () => false)
}
