// src/components/layout/headerParts.ts
//
// What the new chrome's bars share (WS02): the desktop and tablet header,
// src/components/layout/SiteHeader.tsx, and the phone's app bar,
// src/components/layout/MobileAppBar.tsx, with the My LCA menu and the Menu
// sheet they open. It is a file of its own, not a component's, since the
// lint rule for fast refresh wants a file that exports a component to
// export components alone.
//
// - The brand link's name, the same at every width.
// - The Join slot by the member's status, and the person the My LCA menu's
//   rows and the sheet's role rows are for, both from the sign-in context.
// - The page Log in hands /login: the one the person is on, or, on the
//   sign-in pages themselves, the one that page was handed.
// - --header-h, the height of the bar that is drawn, on the page's root.
// - The two parts each bar fetches the first time they are asked for, the
//   Menu sheet and the donation dialog, and the bordered Menu button that
//   opens the sheet.
// - Whether something in the page holds the focus, which the sheet and the
//   bars' boundary ask before they move it.
import { useLayoutEffect, useState, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { JoinSlot, MyLcaPerson } from '@/lib/nav'

/** The brand link's name, the same whether its two-line name shows or not. */
export const HOME_NAME = 'Louisiana Chess Association, home'

/**
 * The bordered Menu button of the tablet header and the app bar: the word
 * and its icon in the bar's white, with a line of white at 75 per cent
 * round them, 44 pixels high, as the decided phone board draws it.
 */
export const MENU_BUTTON =
  'inline-flex min-h-11 flex-none items-center gap-1.5 rounded-[9px] border-[1.5px] border-white/75 px-3 text-[15px] font-semibold hover:border-white'

/**
 * The slot after My LCA for someone signed in, by the member's status:
 * Renew once a membership has expired, Join LCA for someone with no
 * membership, and nothing for an active member, within 30 days of its end
 * too. Nothing while the member is loading, or when it could not be read,
 * rather than a wrong offer.
 */
export function joinSlotOf(auth: AuthContextValue): JoinSlot {
  const status = auth.member?.membership_status
  if (auth.memberLoading || !status) return null
  if (status === 'expired') return 'renew'
  if (status === 'none') return 'joinLca'
  return null
}

/**
 * The person the My LCA menu's rows and the sheet's role rows are for, as
 * the sign-in context holds them. It holds no children yet, so the Family
 * row waits for the step that brings them to it.
 */
export function personOf(auth: AuthContextValue): MyLcaPerson {
  return {
    role: auth.role,
    isBoardMember: auth.isBoardMember,
    managedClubs: auth.managedClubs.length,
    directedEvents: auth.directedTournamentIds.length,
    hasChildren: false,
  }
}

/**
 * The pages a person signs in from: /login and the two password pages. Log
 * in on one of them never hands /login that page itself, which would bring
 * the person back to a sign-in or password form once they are signed in.
 */
export const SIGN_IN_PAGES: readonly string[] = ['/login', '/forgot-password', '/reset-password']

/** Where a page is, as the router gives it. */
interface Where {
  readonly pathname: string
  readonly search: string
  readonly hash: string
  readonly state?: unknown
}

/**
 * The page Log in hands /login to bring the person back to once they are
 * signed in, which src/pages/LoginPage.tsx reads as one string: the page they
 * are on, its query and its hash too; on the sign-in pages, the page that
 * page was handed, or nothing, so they land on the dashboard. A sign-in page
 * is known the way the router finds it, whatever its letters' case and with
 * or without slashes at its end, so /Login and /login/ are /login.
 */
export function logInFrom(where: Where): string | undefined {
  const page = where.pathname.replace(/\/+$/, '').toLowerCase() || '/'
  if (SIGN_IN_PAGES.includes(page)) return (where.state as { from?: string } | null)?.from
  return `${where.pathname}${where.search}${where.hash}`
}

/**
 * Writes the bar's height to --header-h on the page's root, now and whenever
 * it changes, and takes it off when the bar goes. It is written on the
 * element, not through React, so a change of height draws nothing again.
 * The bar is the whole sticky stack at the top of the page today; the event
 * strip joins it later. When one bar gives way to another as the window
 * crosses a line, the one that leaves takes the variable off before the one
 * that comes writes its own.
 */
export function useHeaderHeight(header: RefObject<HTMLElement | null>) {
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

/** One part a bar fetches the first time it is asked for: the Menu sheet, or the donation dialog. */
export interface OnDemandPart {
  readonly open: boolean
  /** Whether it has been asked for yet, and so fetched and drawn; once drawn it stays drawn, closed. */
  readonly drawn: boolean
  /** How many times it has been asked for, so its boundary tries again after a failed fetch. */
  readonly tries: number
  /** Asks for it: draws it the first time, and opens it. */
  readonly show: () => void
  readonly setOpen: (open: boolean) => void
}

export function useOnDemandPart(): OnDemandPart {
  const [open, setOpen] = useState(false)
  const [drawn, setDrawn] = useState(false)
  const [tries, setTries] = useState(0)
  return {
    open,
    drawn,
    tries,
    show: () => {
      setDrawn(true)
      setTries((n) => n + 1)
      setOpen(true)
    },
    setOpen,
  }
}

/**
 * Closes the Menu sheet when the page changes, as following one of its rows
 * does. Adjusted while drawing, as React recommends for state that follows a
 * changed value, so the sheet is shut before the new page paints rather
 * than a frame later.
 */
export function useClosedOnPageChange(sheet: OnDemandPart) {
  const { pathname } = useLocation()
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    if (sheet.open) sheet.setOpen(false)
  }
}

/**
 * Whether something in the page holds the focus: a control still in the
 * page rather than the page's body, where the focus falls when the control
 * that held it goes, as the sheet's Donate goes with the sheet.
 */
export function focusIsHeld(): boolean {
  const active = document.activeElement
  return active !== null && active !== document.body && active.isConnected
}
