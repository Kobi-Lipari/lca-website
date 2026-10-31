// src/components/layout/SiteHeader.tsx
//
// The new header (WS02), which Navbar draws with the chrome on (newNav and
// newLook, chromeOn in src/lib/nav.ts) in two forms: the desktop form for
// windows 1024 pixels wide and wider, and the tablet form, its narrower
// form, from 768 to 1023 pixels. Below 768 pixels the phone's app bar,
// src/components/layout/MobileAppBar.tsx, is drawn instead. Crossing 1024
// pixels keeps this header and changes its form.
//
// One navy row, 64 pixels high, that stays at the top of the window and
// never condenses (brief 1.4; the decided board's bar that shrinks on scroll
// gives way to K's rulings). In it, in order:
//
// - the brand link to the home page, always named "Louisiana Chess
//   Association, home": the rook mark (LcaMark, decision D1), hidden from
//   screen readers, beside the two-line name, with no plate;
// - the sections from src/lib/nav.ts: all six in the desktop form, About
//   opening the About menu (src/components/layout/AboutMenu.tsx), and
//   Tournaments and Clubs alone in the tablet form; the one the page is in
//   carries aria-current="page" and a gold line at its foot, drawn inside
//   its box so nothing in the row moves when the page changes, and an
//   underline in forced colours, which draw no such line;
// - the utilities: Donate, then Log in, which hands /login the page the
//   person is on, or the My LCA menu (src/components/layout/MyLcaMenu.tsx)
//   once they are signed in; then, in the desktop form, Join LCA or Renew,
//   the gold button, by the member's status, and in the tablet form the
//   bordered Menu button, which opens the Menu sheet
//   (src/components/layout/MobileMenu.tsx) as a drawer from the right, where
//   Join LCA and Renew are. In the page frame the sheet is the one the dock's
//   provider holds (src/components/layout/BottomDock.tsx), which the phone's
//   app bar and its Menu tab open too, so a drawer open as the window
//   narrows below 768 pixels stays open as the phone's sheet, and the
//   phone's sheet stays open as the drawer; the window widening into the
//   desktop form closes it, with the focus on the brand link, since that form
//   has no Menu button to come back to.
//
// Donate opens the donation dialog until the Give page exists behind
// newMembership, then goes to /give. The dialog's code is fetched the first
// time it opens, and the sheet's the first time Menu is pressed, rather than
// with the header, which every page loads, since their parts would otherwise
// join the script every visitor waits for; once drawn each stays drawn,
// closed, so it closes as it always has and hands the focus back. Both are
// drawn inside the bars' own boundary (OnDemand), so a file that cannot be
// fetched closes what was opening and says so, and the page stays.
//
// When the desktop row is too tight it gives way in a fixed order, measured
// from the row's natural width rather than set by breakpoint: first Donate
// leaves the bar for the About menu's last row, then the two-line name hides
// while the link keeps its name. No section, Log in or My LCA, Join LCA or
// Renew ever leaves the bar. In the tablet form Donate never leaves it, and
// the name is the one part that gives way.
//
// The header writes its height to --header-h on the page's root while it is
// drawn, which the page's scroll padding reads (src/index.css), so a control
// the keyboard moves to is scrolled clear of it. Its navy is the brand navy
// read through its variable, not the navy band classes, whose gold focus
// ring rule would outrank the menus' own; data-ring-ground="navy" gives its
// controls the gold ring.
import { lazy, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Menu as MenuIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { LcaMark } from '@/components/LcaMark'
import { AboutMenu } from '@/components/layout/AboutMenu'
import { MyLcaMenu } from '@/components/layout/MyLcaMenu'
import { OnDemand } from '@/components/layout/OnDemand'
import { useDock } from '@/components/layout/dockParts'
import {
  HOME_NAME,
  MENU_BUTTON,
  joinSlotOf,
  logInFrom,
  useClosedOnPageChange,
  useHeaderHeight,
  useOnDemandPart,
} from '@/components/layout/headerParts'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { headerSections, headerUtilities, navEntry, navLabel, sectionFor } from '@/lib/nav'
import { cn } from '@/lib/utils'

/** The donation dialog, fetched the first time Donate is pressed. */
const DonateDialog = lazy(() => import('@/components/DonateButton').then((m) => ({ default: m.DonateDialog })))

/** The Menu sheet, fetched the first time Menu is pressed in the tablet form. */
const MobileMenu = lazy(() => import('@/components/layout/MobileMenu').then((m) => ({ default: m.MobileMenu })))

/** The header's two forms: the desktop's from 1024 pixels up, and the tablet's from 768 to 1023. */
export type HeaderForm = 'desktop' | 'tablet'

/**
 * A section of the row: 15 pixels at weight 500, 12 pixels a side and 44
 * high. The current one has a 2-pixel line in the gold for dark grounds at
 * its foot; hover draws a 1-pixel white line in the same place, never a veil.
 * Both are shadows inside the box, so no width or height changes with them.
 * Forced colours (Windows High Contrast and the like) draw no shadow at all,
 * so there the current section, and a hovered one, is underlined instead, in
 * the colour the person's own palette gives words; an underline changes no
 * box either.
 */
function sectionClass(current: boolean): string {
  return cn(
    'inline-flex min-h-11 items-center gap-1 px-3 text-[15px] font-medium forced-colors:underline-offset-8',
    current
      ? 'shadow-[inset_0_-2px_0_var(--gold-on-dark)] forced-colors:underline forced-colors:decoration-2'
      : 'hover:shadow-[inset_0_-1px_0_currentColor] forced-colors:hover:underline',
  )
}

/** Donate, Log in and the My LCA button: 14 pixels at weight 500, 44 high, underlined on hover. */
const UTILITY = 'inline-flex min-h-11 items-center px-2 text-sm font-medium underline-offset-4 hover:underline'

/** How far the row has given way: 0, everything in the bar; 1, Donate in the About menu; 2, the two-line name hidden as well. */
type Level = 0 | 1 | 2

/** The widths the squeeze reads, in pixels. */
interface RowWidths {
  /** The row's own width, inside its padding. */
  room: number
  /** The gap between the brand link, the sections and the utilities. */
  gap: number
  /** The rook mark, the gap inside the brand link and the two-line name. */
  mark: number
  brandGap: number
  words: number
  /** The sections. */
  nav: number
  /** Donate, and the gap after it inside the utilities. */
  donate: number
  utilitiesGap: number
  /** Log in or My LCA, with the join slot or the Menu button. */
  account: number
}

/**
 * The first level whose natural width fits the room. Each level's natural
 * width is a sum of widths kept from when each part was last drawn, so it
 * does not change with the level, and the level depends on the room alone:
 * it cannot flap at its edge. When even the last level does not fit, the
 * row stays at it and no part leaves. Where Donate never leaves the bar, as
 * in the tablet form, every level counts it, so the row goes from 0 to 2.
 */
function squeezeLevel(w: RowWidths, donateLeaves: boolean): Level {
  const natural = (level: Level) =>
    w.mark + (level < 2 ? w.brandGap + w.words : 0) + w.gap + w.nav + w.gap + (level < 1 || !donateLeaves ? w.donate + w.utilitiesGap : 0) + w.account
  return ([0, 1] as const).find((level) => natural(level) <= w.room) ?? 2
}

interface RowParts {
  row: RefObject<HTMLDivElement | null>
  brand: RefObject<HTMLAnchorElement | null>
  words: RefObject<HTMLSpanElement | null>
  nav: RefObject<HTMLElement | null>
  donate: RefObject<HTMLSpanElement | null>
  account: RefObject<HTMLDivElement | null>
}

/**
 * The level the row is at, worked out in a ResizeObserver's callback over
 * the row and each part that can change width (fonts arriving, someone
 * signing in, the window resized, the form changing). A hidden part measures
 * nothing, so the width Donate and the name had when last drawn is kept while
 * they hide. The observer's first callback comes as it starts watching, so
 * nothing is measured, and no state is set, in the effect itself.
 */
function useSqueeze(parts: RowParts, donateLeaves: boolean): Level {
  const [level, setLevel] = useState<Level>(0)
  const kept = useRef({ words: 0, donate: 0 })
  useLayoutEffect(() => {
    const row = parts.row.current
    const brand = parts.brand.current
    const words = parts.words.current
    const nav = parts.nav.current
    const donate = parts.donate.current
    const account = parts.account.current
    if (!row || !brand || !words || !nav || !donate || !account || typeof ResizeObserver === 'undefined') return
    const width = (el: Element | null) => (el ? el.getBoundingClientRect().width : 0)
    const px = (value: string) => parseFloat(value) || 0
    const measure = () => {
      if (width(words) > 0) kept.current.words = width(words)
      if (width(donate) > 0) kept.current.donate = width(donate)
      const rowStyle = getComputedStyle(row)
      setLevel(
        squeezeLevel(
          {
            room: row.clientWidth - px(rowStyle.paddingLeft) - px(rowStyle.paddingRight),
            gap: px(rowStyle.columnGap),
            mark: width(brand.querySelector('[data-slot="lca-mark"]')),
            brandGap: px(getComputedStyle(brand).columnGap),
            words: kept.current.words,
            nav: width(nav),
            donate: kept.current.donate,
            utilitiesGap: donate.parentElement ? px(getComputedStyle(donate.parentElement).columnGap) : 0,
            account: width(account),
          },
          donateLeaves,
        ),
      )
    }
    const watch = new ResizeObserver(measure)
    for (const el of [row, words, nav, donate, account]) watch.observe(el)
    return () => watch.disconnect()
  }, [parts.row, parts.brand, parts.words, parts.nav, parts.donate, parts.account, donateLeaves])
  return level
}

export interface SiteHeaderProps {
  /** The desktop form, from 1024 pixels up (the default), or the tablet form, from 768 to 1023. */
  form?: HeaderForm
}

export function SiteHeader({ form = 'desktop' }: SiteHeaderProps) {
  const auth = useAuth()
  const location = useLocation()
  const tablet = form === 'tablet'
  const headerRef = useRef<HTMLElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const brandRef = useRef<HTMLAnchorElement>(null)
  const wordsRef = useRef<HTMLSpanElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const donateRef = useRef<HTMLSpanElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  /** The control the focus goes back to when the donation dialog closes. */
  const donateFrom = useRef<HTMLElement | null>(null)
  const dock = useDock()
  const ownSheetId = useId()
  const donation = useOnDemandPart()
  const ownSheet = useOnDemandPart()
  // The one sheet of the dock's provider, or, drawn on its own, a drawer of its own.
  const sheet = dock?.sheet ?? ownSheet
  const sheetId = dock?.sheetId ?? ownSheetId

  useHeaderHeight(headerRef)
  // The provider closes its own sheet on a change of page and from 1024
  // pixels up; these two close the header's own, when it is drawn alone.
  useClosedOnPageChange(ownSheet)
  const level = useSqueeze({ row: rowRef, brand: brandRef, words: wordsRef, nav: navRef, donate: donateRef, account: accountRef }, !tablet)
  // The drawer has no Menu button to come back to from 1024 pixels up, so
  // the window widening into the desktop form closes it.
  if (!tablet && ownSheet.open) ownSheet.setOpen(false)

  /**
   * Where the focus goes back to once the drawer, or a part that failed,
   * has closed: the Menu button, or the brand link, the header's first
   * control, once the Menu button has gone with the tablet form; in the page
   * frame, the dock's way back, which ends on the brand link too.
   */
  const back = (): HTMLElement | null => (dock ? dock.returnFocus() : (menuRef.current ?? brandRef.current))
  /**
   * The same for the drawer, but for one that goes with this header while
   * it is still open, as the window crosses 768 pixels; the provider is
   * asked whether the sheet is open now, as the app bar asks it.
   */
  const backFromSheet = (): HTMLElement | null => (dock?.isSheetOpen() ? null : back())

  const section = sectionFor(location.pathname)
  const signedIn = !auth.loading && !!auth.user
  const [, account, slot] = headerUtilities({ signedIn, joinSlot: signedIn ? joinSlotOf(auth) : undefined })
  const donate = navEntry('donate')
  const joinEntry = !tablet && slot ? navEntry(slot) : null
  const logIn = navEntry('logIn')
  // Log in hands /login the page the person is on, its query and its hash
  // too, which src/pages/LoginPage.tsx returns them to once they are signed
  // in. On the sign-in pages it hands on the page that page was handed.
  const from = logInFrom(location)
  // The tablet form's two sections: Tournaments and Clubs, the first two,
  // which the phone's first two tabs reuse as well.
  const sections = tablet ? headerSections().slice(0, 2) : headerSections()

  function openDonate(from: HTMLElement | null) {
    donateFrom.current = from
    donation.show()
  }

  return (
    <header
      ref={headerRef}
      data-slot="site-header"
      data-form={form}
      data-ring-ground="navy"
      className="sticky top-0 z-50 h-16 bg-(--color-brand-navy) text-white shadow-md print:hidden"
    >
      <div ref={rowRef} data-slot="site-header-row" className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6">
        <Link ref={brandRef} to="/" aria-label={HOME_NAME} data-slot="site-header-brand" className="flex flex-none items-center gap-3">
          <LcaMark title="" className="size-[30px]" />
          <span ref={wordsRef} data-slot="site-header-name" hidden={level === 2} className="leading-tight">
            <span className="block text-base font-bold">Louisiana Chess</span>{' '}
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em]">Association</span>
          </span>
        </Link>

        <nav ref={navRef} aria-label="Main" data-slot="site-header-sections" className="flex flex-none items-center">
          {sections.map((id) => {
            const current = section === id
            if (id === 'about') {
              return <AboutMenu key={id} current={current} buttonClassName={sectionClass(current)} squeezed={level > 0} onDonate={openDonate} />
            }
            const entry = navEntry(id)
            if (entry.href === null) return null
            return (
              <Link key={id} to={entry.href} aria-current={current ? 'page' : undefined} className={sectionClass(current)}>
                {entry.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex flex-none items-center gap-1">
          <span ref={donateRef} data-slot="site-header-donate" hidden={!tablet && level > 0} className="flex">
            {donate.href === null ? (
              <button type="button" onClick={(event) => openDonate(event.currentTarget)} className={UTILITY}>
                {donate.label}
              </button>
            ) : (
              <Link to={donate.href} className={UTILITY}>
                {donate.label}
              </Link>
            )}
          </span>
          <div ref={accountRef} data-slot="site-header-account" className="flex items-center gap-2">
            {account === 'myLca' ? (
              <MyLcaMenu buttonClassName={UTILITY} />
            ) : (
              logIn.href !== null && (
                <Link to={logIn.href} state={{ from }} className={UTILITY}>
                  {logIn.label}
                </Link>
              )
            )}
            {joinEntry?.href && (
              <Button asChild variant="gold" size="lg" className="px-3.5">
                <Link to={joinEntry.href}>{joinEntry.label}</Link>
              </Button>
            )}
            {tablet && (
              <button
                ref={menuRef}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={sheet.open}
                aria-controls={sheet.open ? sheetId : undefined}
                onClick={(event) => (dock ? dock.openSheet(event.currentTarget) : ownSheet.show())}
                className={MENU_BUTTON}
              >
                <MenuIcon aria-hidden="true" className="size-5" />
                {navLabel('menu')}
              </button>
            )}
          </div>
        </div>
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
            shape="drawer"
            id={sheetId}
            returnFocus={backFromSheet}
            onDonate={() => openDonate(menuRef.current)}
          />
        </OnDemand>
      )}
      {donate.href === null && donation.drawn && (
        // The control that asked for the dialog: Donate, the About menu's
        // button when Donate is in that menu, or Menu for the sheet's Donate.
        <OnDemand
          notice="The donation form could not be loaded. Reload the page to try again."
          onFailed={() => donation.setOpen(false)}
          returnFocus={() => donateFrom.current}
          tries={donation.tries}
        >
          <DonateDialog open={donation.open} onOpenChange={donation.setOpen} returnFocus={() => donateFrom.current} />
        </OnDemand>
      )}
    </header>
  )
}
