// src/components/layout/SiteHeader.tsx
//
// The new header (WS02), for windows 1024 pixels wide and wider. Navbar
// draws it with the chrome on (newNav and newLook, chromeOn in
// src/lib/nav.ts) and today's header otherwise, and below 1024 pixels until
// the tablet header and the phone's app bar are built.
//
// One navy row, 64 pixels high, that stays at the top of the window and
// never condenses (brief 1.4; the decided board's bar that shrinks on scroll
// gives way to K's rulings). In it, in order:
//
// - the brand link to the home page, always named "Louisiana Chess
//   Association, home": the rook mark (LcaMark, decision D1), hidden from
//   screen readers, beside the two-line name, with no plate;
// - the six sections from src/lib/nav.ts, About opening the About menu
//   (src/components/layout/AboutMenu.tsx); the one the page is in carries
//   aria-current="page" and a gold line at its foot, drawn inside its box so
//   nothing in the row moves when the page changes, and an underline in
//   forced colours, which draw no such line;
// - the utilities: Donate, then Log in, which hands /login the page the
//   person is on, or the My LCA menu (src/components/layout/MyLcaMenu.tsx)
//   once they are signed in, then Join LCA or Renew, the gold button, by the
//   member's status.
//
// Donate opens the donation dialog until the Give page exists behind
// newMembership, then goes to /give. The dialog's code is fetched the first
// time it opens rather than with the header, which every page loads, since
// its form parts would otherwise join the script every visitor waits for;
// once drawn it stays drawn, closed, so it closes as it always has and
// hands the focus back.
//
// When the row is too tight it gives way in a fixed order, measured from
// the row's natural width rather than set by breakpoint: first Donate leaves
// the bar for the About menu's last row, then the two-line name hides while
// the link keeps its name. No section, Log in or My LCA, Join LCA or Renew
// ever leaves the bar.
//
// The header writes its height to --header-h on the page's root while it is
// drawn, which the page's scroll padding reads (src/index.css), so a control
// the keyboard moves to is scrolled clear of it. Its navy is the brand navy
// read through its variable, not the navy band classes, whose gold focus
// ring rule would outrank the menus' own; data-ring-ground="navy" gives its
// controls the gold ring.
import { lazy, Suspense, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LcaMark } from '@/components/LcaMark'
import { AboutMenu } from '@/components/layout/AboutMenu'
import { MyLcaMenu } from '@/components/layout/MyLcaMenu'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { headerSections, headerUtilities, navEntry, sectionFor, type JoinSlot } from '@/lib/nav'
import { cn } from '@/lib/utils'

/** The donation dialog, fetched the first time Donate is pressed. */
const DonateDialog = lazy(() => import('@/components/DonateButton').then((m) => ({ default: m.DonateDialog })))

/** The brand link's name, the same whether its two-line name shows or not. */
const HOME_NAME = 'Louisiana Chess Association, home'

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

/**
 * The slot after My LCA for someone signed in, by the member's status:
 * Renew once a membership has expired, Join LCA for someone with no
 * membership, and nothing for an active member, within 30 days of its end
 * too. Nothing while the member is loading, or when it could not be read,
 * rather than a wrong offer.
 */
function joinSlotOf(auth: AuthContextValue): JoinSlot {
  const status = auth.member?.membership_status
  if (auth.memberLoading || !status) return null
  if (status === 'expired') return 'renew'
  if (status === 'none') return 'joinLca'
  return null
}

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
  /** The six sections. */
  nav: number
  /** Donate, and the gap after it inside the utilities. */
  donate: number
  utilitiesGap: number
  /** Log in or My LCA, with the join slot. */
  account: number
}

/**
 * The first level whose natural width fits the room. Each level's natural
 * width is a sum of widths kept from when each part was last drawn, so it
 * does not change with the level, and the level depends on the room alone:
 * it cannot flap at its edge. When even the last level does not fit, the
 * row stays at it and no part leaves.
 */
function squeezeLevel(w: RowWidths): Level {
  const natural = (level: Level) =>
    w.mark + (level < 2 ? w.brandGap + w.words : 0) + w.gap + w.nav + w.gap + (level < 1 ? w.donate + w.utilitiesGap : 0) + w.account
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
 * signing in, the window resized). A hidden part measures nothing, so the
 * width Donate and the name had when last drawn is kept while they hide.
 * The observer's first callback comes as it starts watching, so nothing is
 * measured, and no state is set, in the effect itself.
 */
function useSqueeze(parts: RowParts): Level {
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
        squeezeLevel({
          room: row.clientWidth - px(rowStyle.paddingLeft) - px(rowStyle.paddingRight),
          gap: px(rowStyle.columnGap),
          mark: width(brand.querySelector('[data-slot="lca-mark"]')),
          brandGap: px(getComputedStyle(brand).columnGap),
          words: kept.current.words,
          nav: width(nav),
          donate: kept.current.donate,
          utilitiesGap: donate.parentElement ? px(getComputedStyle(donate.parentElement).columnGap) : 0,
          account: width(account),
        }),
      )
    }
    const watch = new ResizeObserver(measure)
    for (const el of [row, words, nav, donate, account]) watch.observe(el)
    return () => watch.disconnect()
  }, [parts.row, parts.brand, parts.words, parts.nav, parts.donate, parts.account])
  return level
}

/**
 * Writes the header's height to --header-h on the page's root, now and
 * whenever it changes, and takes it off when the header goes. It is written
 * on the element, not through React, so a change of height draws nothing
 * again. The header is the whole sticky stack at the top of the page today;
 * the event strip joins it later.
 */
function useHeaderHeight(header: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const el = header.current
    if (!el) return
    const root = document.documentElement
    const write = () => root.style.setProperty('--header-h', `${el.offsetHeight}px`)
    write()
    const watch = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(write)
    watch?.observe(el)
    return () => {
      watch?.disconnect()
      root.style.removeProperty('--header-h')
    }
  }, [header])
}

export function SiteHeader() {
  const auth = useAuth()
  const location = useLocation()
  const headerRef = useRef<HTMLElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const brandRef = useRef<HTMLAnchorElement>(null)
  const wordsRef = useRef<HTMLSpanElement>(null)
  const navRef = useRef<HTMLElement>(null)
  const donateRef = useRef<HTMLSpanElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  /** The control the focus goes back to when the donation dialog closes. */
  const donateFrom = useRef<HTMLElement | null>(null)
  const [donateOpen, setDonateOpen] = useState(false)
  /** Whether the donation dialog has been opened yet, and so fetched and drawn. */
  const [donateDrawn, setDonateDrawn] = useState(false)

  useHeaderHeight(headerRef)
  const level = useSqueeze({ row: rowRef, brand: brandRef, words: wordsRef, nav: navRef, donate: donateRef, account: accountRef })

  const section = sectionFor(location.pathname)
  const signedIn = !auth.loading && !!auth.user
  const [, account, slot] = headerUtilities({ signedIn, joinSlot: signedIn ? joinSlotOf(auth) : undefined })
  const donate = navEntry('donate')
  const joinEntry = slot ? navEntry(slot) : null
  const logIn = navEntry('logIn')
  // Log in hands /login the page the person is on, its query and its hash
  // too, which src/pages/LoginPage.tsx returns them to once they are signed
  // in. On /login itself it keeps the page it was handed.
  const here = `${location.pathname}${location.search}${location.hash}`
  const from = location.pathname === logIn.href ? (location.state as { from?: string } | null)?.from : here

  function openDonate(from: HTMLElement | null) {
    donateFrom.current = from
    setDonateDrawn(true)
    setDonateOpen(true)
  }

  return (
    <header
      ref={headerRef}
      data-slot="site-header"
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
          {headerSections().map((id) => {
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
          <span ref={donateRef} data-slot="site-header-donate" hidden={level > 0} className="flex">
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
          </div>
        </div>
      </div>
      {donate.href === null && donateDrawn && (
        <Suspense fallback={null}>
          <DonateDialog open={donateOpen} onOpenChange={setDonateOpen} returnFocus={() => donateFrom.current} />
        </Suspense>
      )}
    </header>
  )
}
