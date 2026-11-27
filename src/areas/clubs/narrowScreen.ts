// src/areas/clubs/narrowScreen.ts
//
// Whether the Clubs directory is drawn in its phone layout (WS09 step 35):
// below 1024 pixels, the width from which the list is a drawer beside the
// map (ClubDirectory.tsx, Tailwind's lg). The question is asked the other way
// round from src/hooks/useWideScreen.ts, as a largest width, so where there
// is no matchMedia, or it answers no to every query (the unit tests' page),
// the directory keeps the layout it has at wide widths. Read from the
// browser's own media query and followed as the window changes.
import { useSyncExternalStore } from 'react'

/** Below the directory's wide layout: the phone layout, with the map, the sheet and the Filters sheet. */
export const NARROW_QUERY = '(max-width: 1023.98px)'

function subscribe(changed: () => void): () => void {
  if (typeof window.matchMedia !== 'function') return () => {}
  const list = window.matchMedia(NARROW_QUERY)
  list.addEventListener('change', changed)
  return () => list.removeEventListener('change', changed)
}

const matches = (): boolean => (typeof window.matchMedia === 'function' ? window.matchMedia(NARROW_QUERY).matches : false)

/** True while the window is narrower than 1024 pixels. */
export function useNarrowScreen(): boolean {
  return useSyncExternalStore(subscribe, matches, () => false)
}
