// src/components/layout/MobileAppBar.tsx
//
// The phone's app bar of the new chrome (WS02), which Navbar draws with the
// chrome on (newNav and newLook, chromeOn in src/lib/nav.ts) below 768
// pixels, and wherever the window's width cannot be asked. One navy row, 56
// pixels high, that stays at the top of the window, as the decided phone
// board draws it (Nav-Mobile-Final):
//
// - the brand link to the home page, always named "Louisiana Chess
//   Association, home": the rook mark (LcaMark, decision D1) at 28 pixels,
//   hidden from screen readers, beside the two-line name, with no plate;
// - beside the tab bar (since WS02 step 7), the current section's name at
//   the row's end on a page of a section the Menu tab stands for
//   (Scholastic, News, Membership and About), and no Menu button, since the
//   Menu tab opens the sheet;
// - wherever no tab bar is drawn, at the row's end, the bordered Menu
//   button, which opens the Menu sheet (src/components/layout/MobileMenu.tsx)
//   over the window: drawn on its own, as in a test, in the reflow fallback,
//   under 480 pixels tall or under 300 wide, while the on-screen keyboard is
//   open and on the pages that hide the tab bar, so a phone is never left
//   without a way to the sections. A Menu button that holds the focus stays
//   until the focus leaves it, so a press on it is never lost as the tab
//   bar comes back.
//
// In the page frame the dock's provider (src/components/layout/BottomDock.tsx)
// holds the one Menu sheet that this bar, the tablet header and the Menu tab
// all open, so the sheet stays open as the window crosses 768 pixels; drawn
// on its own the bar holds a sheet of its own, as in WS02 step 6. Search
// comes with WS02 step 11.
//
// The sheet's code is fetched the first time Menu is pressed, and the
// donation dialog's the first time the sheet's Donate is, rather than with
// the bar, which every page loads; once drawn each stays drawn, closed.
// Both are drawn inside the bars' own boundary (OnDemand), so a file that
// cannot be fetched closes what was opening and says so, and the page stays.
//
// The bar writes its height to --header-h on the page's root while it stays
// at the top, which the page's scroll padding reads (src/index.css); in the
// reflow fallback it scrolls away with the page, as the board's landscape
// frame draws it, and writes nothing. It keeps its row clear of a phone's
// status bar, the safe area at the window's top, above the row. Its navy is
// the brand navy read through its variable, not the navy band classes, whose
// gold focus ring rule would outrank the sheet's own; data-ring-ground="navy"
// gives its controls the gold ring.
import { lazy, useId, useRef, useState, type RefObject } from 'react'
import { Menu as MenuIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { LcaMark } from '@/components/LcaMark'
import { OnDemand } from '@/components/layout/OnDemand'
import { useDock } from '@/components/layout/dockParts'
import { HOME_NAME, MENU_BUTTON, useClosedOnPageChange, useHeaderHeight, useOnDemandPart } from '@/components/layout/headerParts'
import { useReflowFallback } from '@/hooks/useWideScreen'
import { currentTab, navEntry, navLabel, sectionFor } from '@/lib/nav'
import { cn } from '@/lib/utils'

/** The Menu sheet, fetched the first time Menu is pressed. */
const MobileMenu = lazy(() => import('@/components/layout/MobileMenu').then((m) => ({ default: m.MobileMenu })))

/** The donation dialog, fetched the first time the sheet's Donate is pressed. */
const DonateDialog = lazy(() => import('@/components/DonateButton').then((m) => ({ default: m.DonateDialog })))

/** No bar, for the height of a bar that does not stay at the top: nothing is written. */
const NO_BAR: RefObject<HTMLElement | null> = { current: null }

export function MobileAppBar() {
  const dock = useDock()
  const location = useLocation()
  const headerRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const ownSheetId = useId()
  const ownSheet = useOnDemandPart()
  const donation = useOnDemandPart()
  const reflow = useReflowFallback()
  const [menuHeld, setMenuHeld] = useState(false)
  const donate = navEntry('donate')
  // The one sheet of the dock's provider, or, drawn on its own, a sheet of its own.
  const sheet = dock?.sheet ?? ownSheet
  const sheetId = dock?.sheetId ?? ownSheetId
  const tabBar = dock?.tabBar ?? false
  const menuButton = !tabBar || menuHeld
  // The section the Menu tab stands for, beside the tab bar.
  const section = tabBar && currentTab(location.pathname) === 'menu' ? sectionFor(location.pathname) : null

  useHeaderHeight(reflow ? NO_BAR : headerRef)
  useClosedOnPageChange(ownSheet)

  /** Where the focus goes back to once the sheet, the donation dialog or a part that failed has closed. */
  const back = (): HTMLElement | null => (dock ? dock.returnFocus() : menuRef.current)
  /**
   * The same for the sheet, but for a sheet that goes with this bar while
   * it is still open, as the window crosses 768 pixels: the bar then drawn
   * draws it open and takes the focus, so this bar moves it nowhere. The
   * provider is asked whether the sheet is open now, since this bar's last
   * draw may say open where the window jumped straight to 1024 pixels and
   * the provider closed the sheet as the bar went.
   */
  const backFromSheet = (): HTMLElement | null => (dock?.isSheetOpen() ? null : back())

  return (
    <header
      ref={headerRef}
      data-slot="app-bar"
      data-ring-ground="navy"
      className={cn(
        'z-50 box-content h-14 bg-(--color-brand-navy) pt-[env(safe-area-inset-top)] text-white shadow-md print:hidden',
        reflow ? 'static' : 'sticky top-0',
      )}
    >
      <div data-slot="app-bar-row" className="flex h-14 items-center gap-2 pr-2.5 pl-3.5">
        <Link to="/" aria-label={HOME_NAME} data-slot="app-bar-brand" className="flex min-h-11 min-w-0 items-center gap-2">
          <LcaMark title="" className="size-7" />
          <span data-slot="app-bar-name" className="flex flex-col leading-[1.12]">
            <span className="text-sm font-bold whitespace-nowrap">Louisiana Chess</span>
            <span className="text-[11px] font-medium whitespace-nowrap text-white/80">Association</span>
          </span>
        </Link>
        {section && (
          <span data-slot="app-bar-section" className="ml-auto min-w-0 truncate pr-1 text-[15px] font-semibold">
            {navLabel(section)}
          </span>
        )}
        {menuButton && (
          <button
            ref={menuRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={sheet.open}
            aria-controls={sheet.open ? sheetId : undefined}
            onClick={(event) => (dock ? dock.openSheet(event.currentTarget) : ownSheet.show())}
            onFocus={() => setMenuHeld(true)}
            onBlur={() => setMenuHeld(false)}
            className={cn(section ? 'ml-1' : 'ml-auto', MENU_BUTTON)}
          >
            <MenuIcon aria-hidden="true" className="size-5" />
            {navLabel('menu')}
          </button>
        )}
      </div>
      {sheet.drawn && (
        <OnDemand
          notice="The menu could not be loaded. Reload the page to try again."
          onFailed={() => sheet.setOpen(false)}
          returnFocus={back}
          tries={sheet.tries}
        >
          <MobileMenu
            open={sheet.open}
            onOpenChange={sheet.setOpen}
            shape="full"
            id={sheetId}
            returnFocus={backFromSheet}
            onDonate={donation.show}
          />
        </OnDemand>
      )}
      {donate.href === null && donation.drawn && (
        // Only the sheet's Donate asks for the dialog here, and it goes with
        // the sheet, so the focus comes back to the control that opened the
        // sheet: the Menu tab, or Menu.
        <OnDemand
          notice="The donation form could not be loaded. Reload the page to try again."
          onFailed={() => donation.setOpen(false)}
          returnFocus={back}
          tries={donation.tries}
        >
          <DonateDialog open={donation.open} onOpenChange={donation.setOpen} returnFocus={back} />
        </OnDemand>
      )}
    </header>
  )
}
