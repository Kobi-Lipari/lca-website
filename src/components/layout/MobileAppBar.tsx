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
// - at the row's end, the bordered Menu button, which opens the Menu sheet
//   (src/components/layout/MobileMenu.tsx) over the whole window.
//
// The tab bar under the page, the current section's name and the Search
// button come with later steps of WS02. Until the tab bar exists, the Menu
// button is how a phone reaches the sections, Donate, Log in and the rest.
//
// The sheet's code is fetched the first time Menu is pressed, and the
// donation dialog's the first time the sheet's Donate is, rather than with
// the bar, which every page loads; once drawn each stays drawn, closed.
// Both are drawn inside the bars' own boundary (OnDemand), so a file that
// cannot be fetched closes what was opening and says so, and the page stays.
//
// The bar writes its height to --header-h on the page's root while it is
// drawn, which the page's scroll padding reads (src/index.css). Its navy is
// the brand navy read through its variable, not the navy band classes, whose
// gold focus ring rule would outrank the sheet's own; data-ring-ground="navy"
// gives its controls the gold ring.
import { lazy, useId, useRef } from 'react'
import { Menu as MenuIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LcaMark } from '@/components/LcaMark'
import { OnDemand } from '@/components/layout/OnDemand'
import { HOME_NAME, MENU_BUTTON, useClosedOnPageChange, useHeaderHeight, useOnDemandPart } from '@/components/layout/headerParts'
import { navEntry, navLabel } from '@/lib/nav'
import { cn } from '@/lib/utils'

/** The Menu sheet, fetched the first time Menu is pressed. */
const MobileMenu = lazy(() => import('@/components/layout/MobileMenu').then((m) => ({ default: m.MobileMenu })))

/** The donation dialog, fetched the first time the sheet's Donate is pressed. */
const DonateDialog = lazy(() => import('@/components/DonateButton').then((m) => ({ default: m.DonateDialog })))

export function MobileAppBar() {
  const headerRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const sheetId = useId()
  const sheet = useOnDemandPart()
  const donation = useOnDemandPart()
  const donate = navEntry('donate')

  useHeaderHeight(headerRef)
  useClosedOnPageChange(sheet)

  return (
    <header
      ref={headerRef}
      data-slot="app-bar"
      data-ring-ground="navy"
      className="sticky top-0 z-50 h-14 bg-(--color-brand-navy) text-white shadow-md print:hidden"
    >
      <div data-slot="app-bar-row" className="flex h-14 items-center gap-2 pr-2.5 pl-3.5">
        <Link to="/" aria-label={HOME_NAME} data-slot="app-bar-brand" className="flex min-h-11 min-w-0 items-center gap-2">
          <LcaMark title="" className="size-7" />
          <span data-slot="app-bar-name" className="flex flex-col leading-[1.12]">
            <span className="text-sm font-bold whitespace-nowrap">Louisiana Chess</span>
            <span className="text-[11px] font-medium whitespace-nowrap text-white/80">Association</span>
          </span>
        </Link>
        <button
          ref={menuRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={sheet.open}
          aria-controls={sheet.open ? sheetId : undefined}
          onClick={sheet.show}
          className={cn('ml-auto', MENU_BUTTON)}
        >
          <MenuIcon aria-hidden="true" className="size-5" />
          {navLabel('menu')}
        </button>
      </div>
      {sheet.drawn && (
        <OnDemand
          notice="The menu could not be loaded. Reload the page to try again."
          onFailed={() => sheet.setOpen(false)}
          returnFocus={() => menuRef.current}
          tries={sheet.tries}
        >
          <MobileMenu
            open={sheet.open}
            onOpenChange={sheet.setOpen}
            shape="full"
            id={sheetId}
            returnFocus={() => menuRef.current}
            onDonate={donation.show}
          />
        </OnDemand>
      )}
      {donate.href === null && donation.drawn && (
        // Only the sheet's Donate asks for the dialog here, and it goes with
        // the sheet, so the focus comes back to Menu, which opened the sheet.
        <OnDemand
          notice="The donation form could not be loaded. Reload the page to try again."
          onFailed={() => donation.setOpen(false)}
          returnFocus={() => menuRef.current}
          tries={donation.tries}
        >
          <DonateDialog open={donation.open} onOpenChange={donation.setOpen} returnFocus={() => menuRef.current} />
        </OnDemand>
      )}
    </header>
  )
}
