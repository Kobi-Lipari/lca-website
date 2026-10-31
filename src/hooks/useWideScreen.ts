// src/hooks/useWideScreen.ts
//
// Whether the window is wide enough for each form of the new chrome's header
// (src/components/layout/Navbar.tsx): 1024 pixels or wider, where the
// desktop header is drawn, and 768 pixels or wider, where the tablet header
// is drawn; below 768 the phone's app bar is. Since WS02 step 7, also whether
// the window is in the reflow fallback, under 480 pixels tall or under 300
// wide, where the phone's dock hides and the app bar scrolls away with the
// page, its bordered Menu button opening the sheet (the phase 0 replan,
// Q3). Each is read from the browser's own media query and followed as the
// window changes, so the chrome changes the moment the window crosses a
// line. Where there is no matchMedia (the unit tests' page), each answers
// false, and the app bar is drawn.
import { useSyncExternalStore } from 'react'

/** The width from which the desktop header is drawn. */
export const WIDE_QUERY = '(min-width: 1024px)'

/** The width from which the tablet header is drawn, up to the desktop's. */
export const TABLET_QUERY = '(min-width: 768px)'

/**
 * The reflow fallback: a window under 480 pixels tall, as a phone on its
 * side is, or under 300 CSS pixels wide, which is how high zoom shows (a
 * phone 375 pixels wide zoomed past 125 per cent). One query for both, as
 * the decided phone board names it; a pinch zoom leaves the layout viewport
 * as it is, so it does not count.
 */
export const REFLOW_QUERY = '(max-height: 479.98px), (max-width: 299.98px)'

/**
 * What useSyncExternalStore needs to follow one media query: a way to listen
 * for its changes, its answer now, and the answer when drawn to a string, as
 * a server draws, which is always false.
 */
function mediaStore(media: string) {
  const query = (): MediaQueryList | null => (typeof window.matchMedia === 'function' ? window.matchMedia(media) : null)
  return {
    subscribe(changed: () => void): () => void {
      const list = query()
      if (!list) return () => {}
      list.addEventListener('change', changed)
      return () => list.removeEventListener('change', changed)
    },
    matches: (): boolean => query()?.matches ?? false,
    server: (): boolean => false,
  }
}

const wide = mediaStore(WIDE_QUERY)
const tablet = mediaStore(TABLET_QUERY)
const reflow = mediaStore(REFLOW_QUERY)

/** True while the window is 1024 pixels wide or wider. */
export function useWideScreen(): boolean {
  return useSyncExternalStore(wide.subscribe, wide.matches, wide.server)
}

/** True while the window is 768 pixels wide or wider: the tablet header up to 1023, the desktop header from 1024. */
export function useTabletScreen(): boolean {
  return useSyncExternalStore(tablet.subscribe, tablet.matches, tablet.server)
}

/** True while the window is in the reflow fallback: under 480 pixels tall, or under 300 wide. */
export function useReflowFallback(): boolean {
  return useSyncExternalStore(reflow.subscribe, reflow.matches, reflow.server)
}
