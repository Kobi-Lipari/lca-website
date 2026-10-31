// src/components/layout/BottomDock.tsx
//
// The phone's dock of the new chrome (WS02 step 7): one stack fixed to the
// window's foot below 768 pixels, with the chrome on (newNav and newLook,
// chromeOn in src/lib/nav.ts), as brief 1.4's phone section and the phase 0
// replan (Q3, "The bottom stack") set it out. Top to bottom, in the page's
// order and the eye's:
//
// - the page's action bar's place (WS05's Register bar);
// - the event bar's place (WS02 step 16), which outranks the action bar: one
//   contextual bar at a time, so while an event bar is drawn the action
//   bar's place is not;
// - the tab bar, src/components/layout/BottomTabs.tsx.
//
// The places are empty until a page puts a bar in one (DockBar), so the tab
// bar alone is the dock's height today: 56 pixels and the safe area under
// it. The dock writes that height to --bottom-chrome-h on the page's root,
// which the page keeps as room after its last line and in its scroll
// padding (src/index.css), so nothing fixed covers the page and a control
// the keyboard moves to is never left under the dock (decision D16). It sits
// under every dialog, scrim and the sticky bar, and over the page.
//
// The dock hides, drawing nothing at all, from 768 pixels up, where the
// tablet and desktop headers hold the sections; on the pages that hide the
// tab bar (hidesTabBar in src/lib/nav.ts); while the on-screen keyboard is
// open; and in the reflow fallback, under 480 pixels tall or under 300 wide.
// The app bar then shows its bordered Menu button again.
//
// DockProvider, around the whole page frame with the chrome on, holds the
// one Menu sheet that the app bar, the tablet header and the Menu tab open
// (each bar still draws it, in its own shape), so the sheet stays open as
// the window crosses 768 pixels, and says whether the dock draws its tab bar
// now, which the app bar reads on the same draw.
import { useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { BottomTabs } from '@/components/layout/BottomTabs'
import {
  DockContext,
  createDockBars,
  useBottomChromeHeight,
  useDock,
  useKeyboardOpen,
  wayBack,
  type Dock,
  type DockBarKind,
  type DockBars,
} from '@/components/layout/dockParts'
import { useClosedOnPageChange, useOnDemandPart } from '@/components/layout/headerParts'
import { useReflowFallback, useTabletScreen, useWideScreen } from '@/hooks/useWideScreen'
import { hidesTabBar } from '@/lib/nav'

/**
 * Holds the one Menu sheet, its id, the control that opened it and whether
 * the dock draws its tab bar, for the bars, the tab bar and the dock inside
 * it. Its two adjustments of the sheet are made to its own state while it
 * draws: a change of page closes the sheet, as following one of its rows
 * does, and so does the window reaching 1024 pixels, where the desktop
 * header has no Menu button to come back to.
 */
export function DockProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const sheet = useOnDemandPart()
  const sheetId = useId()
  const opener = useRef<HTMLElement | null>(null)
  const [bars] = useState(createDockBars)
  const tablet = useTabletScreen()
  const wide = useWideScreen()
  const reflow = useReflowFallback()
  const keyboard = useKeyboardOpen()

  useClosedOnPageChange(sheet)
  if (wide && sheet.open) sheet.setOpen(false)

  // The sheet's open state as last drawn, kept once each draw is in the
  // page, for a bar's way back that is asked after the bar has gone.
  const openNow = useRef(sheet.open)
  useLayoutEffect(() => {
    openNow.current = sheet.open
  }, [sheet.open])

  // The router matches a route whatever its letters' case, so the pages
  // that hide the tab bar are read the same way.
  const tabBar = !tablet && !reflow && !keyboard && !hidesTabBar(pathname.toLowerCase())
  const dock: Dock = {
    sheet,
    isSheetOpen: () => openNow.current,
    sheetId,
    tabBar,
    bars,
    openSheet: (from) => {
      opener.current = from
      sheet.show()
    },
    returnFocus: () => wayBack(opener.current),
  }
  return <DockContext.Provider value={dock}>{children}</DockContext.Provider>
}

/** The dock, while it draws its tab bar; nothing at all while it hides. */
export function BottomDock() {
  const dock = useDock()
  return dock?.tabBar ? <DrawnDock bars={dock.bars} /> : null
}

/** The dock as drawn: its two places and the tab bar, its height on the page's root. */
function DrawnDock({ bars }: { bars: DockBars }) {
  const ref = useRef<HTMLDivElement>(null)
  useBottomChromeHeight(ref)
  const events = useSyncExternalStore(bars.subscribe, () => bars.count('event'), () => 0)
  return (
    <div
      ref={ref}
      data-slot="bottom-dock"
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] print:hidden"
    >
      {events === 0 && <div data-slot="dock-action" ref={bars.placeRef('action')} />}
      <div data-slot="dock-event" ref={bars.placeRef('event')} />
      <BottomTabs />
    </div>
  )
}

/** A store's subscription for where there is no dock: nothing ever changes. */
const NOTHING = () => () => {}

/**
 * A page's bar in the dock: the page action bar (kind "action") or the event
 * bar ("event"), drawn into its place while the dock draws it, and nothing
 * otherwise, so the page decides what it shows where there is no dock. An
 * event bar drawn takes the action bar's place away.
 */
export function DockBar({ kind, children }: { kind: DockBarKind; children: ReactNode }) {
  const bars = useDock()?.bars ?? null
  // Counted before the first paint, so an event bar never lets the action bar show for a frame.
  useLayoutEffect(() => bars?.add(kind), [bars, kind])
  const place = useSyncExternalStore(bars?.subscribe ?? NOTHING, () => bars?.place(kind) ?? null, () => null)
  return place ? createPortal(children, place) : null
}
