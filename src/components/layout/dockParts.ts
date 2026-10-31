// src/components/layout/dockParts.ts
//
// What the phone's dock shares (WS02 step 7): the dock and its provider,
// src/components/layout/BottomDock.tsx, the tab bar in it,
// src/components/layout/BottomTabs.tsx, and the two bars that read it, the
// app bar and the tablet header. It is a file of its own, not a component's,
// since the lint rule for fast refresh wants a file that exports a component
// to export components alone.
//
// - The dock's context: the one Menu sheet the bars and the tab bar share,
//   its id, the control that opened it and where the focus goes back to,
//   whether the dock draws its tab bar now, and the bars a page puts in the
//   dock's two places.
// - --bottom-chrome-h, the dock's height, on the page's root.
// - Whether the on-screen keyboard is open, by the phase 0 replan's rule:
//   the visual viewport more than 150 pixels shorter than the layout
//   viewport, or a field that takes typing holding the focus.
import { createContext, useContext, useLayoutEffect, useSyncExternalStore, type RefObject } from 'react'
import type { OnDemandPart } from '@/components/layout/headerParts'

/**
 * How much shorter than the layout viewport the visual viewport is, in CSS
 * pixels, when the on-screen keyboard counts as open (the phase 0 replan,
 * Q3): a phone's keyboard takes far more, and the browser's own bars, which
 * grow and shrink as a page scrolls, far less.
 */
export const KEYBOARD_ROOM = 150

/** The two bars a page may put in the dock: its action bar, as WS05's Register bar will be, and the event bar. */
export type DockBarKind = 'action' | 'event'

/**
 * The bars a page puts in the dock, and the places the dock holds for them:
 * a small store of its own, so a bar counts itself and finds its place
 * without setting any component's state as it comes and goes.
 */
export interface DockBars {
  subscribe: (changed: () => void) => () => void
  /** How many bars of a kind are drawn. */
  count: (kind: DockBarKind) => number
  /** Counts a bar of a kind as drawn, until the function it gives back is called. */
  add: (kind: DockBarKind) => () => void
  /** The dock's place for a kind, while the dock draws it. */
  place: (kind: DockBarKind) => HTMLElement | null
  /** The ref the dock gives a place, the same function every time, which keeps the place in the store. */
  placeRef: (kind: DockBarKind) => (el: HTMLElement | null) => void
}

export function createDockBars(): DockBars {
  const listeners = new Set<() => void>()
  const counts: Record<DockBarKind, number> = { action: 0, event: 0 }
  const places: Record<DockBarKind, HTMLElement | null> = { action: null, event: null }
  const tell = () => {
    for (const changed of [...listeners]) changed()
  }
  const refs: Record<DockBarKind, (el: HTMLElement | null) => void> = {
    action: (el) => {
      if (places.action === el) return
      places.action = el
      tell()
    },
    event: (el) => {
      if (places.event === el) return
      places.event = el
      tell()
    },
  }
  return {
    subscribe(changed) {
      listeners.add(changed)
      return () => {
        listeners.delete(changed)
      }
    },
    count: (kind) => counts[kind],
    add(kind) {
      counts[kind] += 1
      tell()
      let counted = true
      return () => {
        if (!counted) return
        counted = false
        counts[kind] -= 1
        tell()
      }
    },
    place: (kind) => places[kind],
    placeRef: (kind) => refs[kind],
  }
}

/** What the dock's provider gives the bars, the tab bar and the dock. */
export interface Dock {
  /** The one Menu sheet: one open state for every control that opens it, so a window crossing 768 pixels keeps it open. */
  readonly sheet: OnDemandPart
  /**
   * Whether the sheet is open now, read when asked, not as a bar last drew
   * it: a bar that goes as the window crosses a line asks once it has gone,
   * and the provider may have closed the sheet in that same draw, as it does
   * when the window reaches 1024 pixels.
   */
  readonly isSheetOpen: () => boolean
  /** The sheet's id, which the control that opened it names while it is open. */
  readonly sheetId: string
  /** Opens the sheet from a control, the one the focus goes back to while it is still in the page. */
  readonly openSheet: (from: HTMLElement | null) => void
  /**
   * Where the focus goes once the sheet, or the dialog its Donate handed on
   * to, closes: the control that opened it while it is still in the page,
   * else the bordered Menu button of the bar drawn, else the Menu tab, else
   * the brand link of the bar drawn.
   */
  readonly returnFocus: () => HTMLElement | null
  /** Whether the dock draws its tab bar now: below 768 pixels, outside the short window and high zoom, with no keyboard open, on a page that keeps it. */
  readonly tabBar: boolean
  /** The bars a page puts in the dock. */
  readonly bars: DockBars
}

export const DockContext = createContext<Dock | null>(null)

/** The dock's provider's answer, or null outside one, as where a bar is drawn on its own. */
export function useDock(): Dock | null {
  return useContext(DockContext)
}

/** The bars' bordered Menu buttons, the Menu tab and the bars' brand links, in the order the focus tries them. */
const WAY_BACK = [
  '[data-slot="app-bar"] button[aria-haspopup="dialog"], [data-slot="site-header"] button[aria-haspopup="dialog"]',
  '[data-slot="tab-bar"] button[aria-haspopup="dialog"]',
  '[data-slot="app-bar-brand"], [data-slot="site-header-brand"]',
] as const

/** The control the focus goes back to, in the dock's order: the one that opened the sheet, if still in the page, then the first of the others drawn. */
export function wayBack(opener: HTMLElement | null): HTMLElement | null {
  if (opener?.isConnected) return opener
  for (const selector of WAY_BACK) {
    const found = document.querySelector<HTMLElement>(selector)
    if (found) return found
  }
  return null
}

/**
 * Writes the dock's height to --bottom-chrome-h on the page's root, now and
 * whenever it changes, and takes it off when the dock goes, as the bars
 * write --header-h (useHeaderHeight in src/components/layout/headerParts.ts).
 * The page keeps that much room after its last line and in its scroll
 * padding (src/index.css), so nothing fixed covers it.
 */
export function useBottomChromeHeight(dock: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = dock.current
    if (!el) return
    const root = document.documentElement
    const write = () => root.style.setProperty('--bottom-chrome-h', `${el.offsetHeight}px`)
    write()
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(write)
    watch?.observe(el)
    return () => {
      watch?.disconnect()
      root.style.removeProperty('--bottom-chrome-h')
    }
  }, [dock])
}

/** The input types the on-screen keyboard types into; an input with no type, or one the browser does not know, is text. */
const TYPED = new Set(['text', 'search', 'email', 'tel', 'url', 'password', 'number', 'date', 'datetime-local', 'month', 'time', 'week'])

/** Whether an element is a field the on-screen keyboard types into: a text input of any kind, a text area, or content that can be edited. */
export function isTextField(el: Element | null): boolean {
  if (!el) return false
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (el instanceof HTMLInputElement) return TYPED.has(el.type) && !el.readOnly && !el.disabled
  if (!(el instanceof HTMLElement)) return false
  const editable = el.getAttribute('contenteditable')
  return el.isContentEditable === true || (editable !== null && editable !== 'false')
}

/**
 * Whether the on-screen keyboard counts as open now. A field inside a modal
 * dialog, such as the donation form's amount, does not count by the focus
 * alone: the dock is behind the dialog's scrim then, and stays, so the Menu
 * tab that opened the sheet the dialog came from is there to take the focus
 * back as the dialog closes. The visual viewport's rule counts everywhere.
 */
function keyboardOpenNow(): boolean {
  const view = window.visualViewport
  if (view && window.innerHeight - view.height > KEYBOARD_ROOM) return true
  const active = document.activeElement
  return isTextField(active) && !active?.closest('[role="dialog"], [role="alertdialog"]')
}

/**
 * Follows what the keyboard rule reads: the visual viewport's size, and the
 * focus. A focus leaving one field for another passes through the page's
 * body, so the focus going out is read once it has landed.
 */
function watchKeyboard(changed: () => void): () => void {
  const view = window.visualViewport
  let later: ReturnType<typeof setTimeout> | undefined
  const landed = () => {
    clearTimeout(later)
    later = setTimeout(changed, 0)
  }
  view?.addEventListener('resize', changed)
  document.addEventListener('focusin', changed)
  document.addEventListener('focusout', landed)
  return () => {
    clearTimeout(later)
    view?.removeEventListener('resize', changed)
    document.removeEventListener('focusin', changed)
    document.removeEventListener('focusout', landed)
  }
}

/**
 * True while the on-screen keyboard counts as open: the visual viewport more
 * than KEYBOARD_ROOM pixels shorter than the layout viewport, which Chrome
 * and Safari both shrink as the keyboard opens, or, for a browser that does
 * not, a field that takes typing holding the focus. False when drawn to a
 * string, as a server draws.
 */
export function useKeyboardOpen(): boolean {
  return useSyncExternalStore(watchKeyboard, keyboardOpenNow, () => false)
}
