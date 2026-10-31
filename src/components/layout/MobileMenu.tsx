// src/components/layout/MobileMenu.tsx
//
// The Menu sheet of the new chrome (WS02): what the bordered Menu button of
// the tablet header and of the phone's app bar opens. It is a modal dialog
// named Menu, on the site's dialog primitive, the one the donation dialog
// uses: src/components/ui/dialog.tsx gives its root, portal, scrim, title
// and close control as they are, and only the content comes from the
// primitive itself, since the wrapper's content is a centred box with a
// close button of its own. Its shape comes from the bar that opens it: the
// whole window from the app bar, and a drawer 400 pixels wide from the right
// from the tablet header, over a scrim.
//
// The primitive keeps the focus inside the sheet while it is open, closes
// it on Esc and on a press outside it, hides the page behind it from
// assistive technology and keeps that page from scrolling. The sheet opens
// on its own close control, "Close menu", first in it, so a screen reader
// hears that a dialog named Menu opened and how to leave it; when it closes
// the focus goes back to the button that opened it. Following a row closes
// it, and so does a change of page, which the bar that holds it sees. Its
// Donate hands the focus on to the bar's donation dialog, which takes it
// once it is drawn; until then, or when the dialog's code cannot be had,
// nothing holds the focus, so it goes back to that button as well.
//
// Its rows are navSheet's from src/lib/nav.ts, every label from there, in
// its order, inside ScrollPanel, so the list scrolls inside the sheet while
// the page stays still (decision D16):
//
// - the six sections: Tournaments, Clubs and About are disclosures that show
//   or hide their rows, the other three are links to their pages; the
//   section the page is in starts open each time the sheet opens, on its
//   own tint with "You are here" beside its name, hidden from screen
//   readers, and the link of the page itself carries aria-current="page";
// - the bar's buttons in the bar's order: Donate, Log in or My LCA, and
//   Join LCA or Renew by the member's status, the gold Button;
// - for someone signed in, today's role rows and the Admin row the person
//   holds, as the My LCA menu has them, and last Log out, which signs the
//   person out and goes to the home page, as the My LCA menu's does;
// - LCA on Facebook, in a new tab, Contact and Website help;
// - the theme switch: the footer's Appearance control drawn again, on the
//   sheet's light ground, with a label id of its own.
//
// The current section's tint and its "You are here" are the one place this
// file writes gold on a light ground, as test/unit/fixtures/goldAllowlist.ts
// lists it (WS02_GOLD): the words at 13 pixels and weight 600 in #866a1e on
// the tint #fbfaf6, 4.91:1, as the decided phone board draws them. Both are
// hex classes, as the fixture and the brief's AC21 write them, and the gold
// guard (test/unit/goldText.test.ts) finds the words beside their label, at
// their size and on their ground. In dark mode the section takes the look's
// muted ground and the words the sheet's ink, never gold on the dark row.
// The sheet is a light surface, so data-ring-ground="light" gives its
// controls the look's own focus ring (src/index.css).
import { useId, useRef, useState } from 'react'
import { Content as SheetContent } from '@radix-ui/react-dialog'
import { ChevronDown, X } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AppearanceControl } from '@/components/AppearanceControl'
import { ScrollPanel } from '@/components/ScrollPanel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog'
import { focusIsHeld, joinSlotOf, logInFrom, personOf } from '@/components/layout/headerParts'
import { useAuth } from '@/contexts/auth-context'
import { navEntry, navLabel, navSheet, pathIsUnder, sectionFor, sheetRowLabel, type NavEntry, type SectionId, type SheetRow } from '@/lib/nav'
import { cn } from '@/lib/utils'

export interface MobileMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The whole window, from the phone's app bar, or a drawer 400 pixels wide from the right, from the tablet header. */
  shape: 'full' | 'drawer'
  /** The sheet's id, which the Menu button's aria-controls names while it is open. */
  id: string
  /** The button that opened the sheet, which the focus goes back to as it closes. */
  returnFocus: () => HTMLElement | null
  /** Asks the bar for its donation dialog, the sheet's Donate while Donate has no page of its own. */
  onDonate: () => void
}

/** The sheet's two shapes. Both are a column the height of the window, the list scrolling inside it. */
const SHAPES = {
  full: 'inset-0',
  drawer:
    'inset-y-0 right-0 w-[400px] max-w-full border-l border-hairline shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
} as const

/** The close control's name: the visible word, Close, and what it closes. */
const CLOSE_NAME = 'Close menu'

/** The link of the page itself among a section's rows: the one whose address the path is at or under, the longest when several are. */
function currentLink(pathname: string, entries: readonly NavEntry[]): NavEntry | null {
  let best: { entry: NavEntry; length: number } | null = null
  for (const entry of entries) {
    if (entry.href === null || entry.leavesSite) continue
    const address = entry.href.split(/[?#]/)[0]
    if (pathIsUnder(pathname, address) && (!best || address.length > best.length)) best = { entry, length: address.length }
  }
  return best?.entry ?? null
}

/**
 * A section's own row: 46 pixels high at 16.5 pixels and weight 600, as the
 * decided phone board draws it, kept 4 pixels from the sheet's edges so its
 * focus ring is drawn whole inside the list that scrolls.
 */
const HEAD = 'mx-1 flex min-h-[46px] items-center gap-2.5 px-3.5 text-[16.5px] font-semibold hover:bg-muted'

/** A row of the account group: 44 pixels high, 15 pixels at weight 500, with a hairline under it. */
const ROW = 'flex min-h-11 w-full items-center border-b border-hairline text-left text-[15px] font-medium underline-offset-4 hover:underline'

export function MobileMenu({ open, onOpenChange, shape, id, returnFocus, onDonate }: MobileMenuProps) {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const closeRef = useRef<HTMLButtonElement>(null)
  /** Set when the sheet closes for the bar's donation dialog, which takes the focus once it is drawn. */
  const handedOn = useRef(false)
  const listIds = useId()
  const appearanceLabel = useId()

  const signedIn = !auth.loading && !!auth.user
  const current = sectionFor(location.pathname)
  const sheet = navSheet({
    pathname: location.pathname,
    signedIn,
    joinSlot: signedIn ? joinSlotOf(auth) : undefined,
    person: signedIn ? personOf(auth) : null,
  })

  // The section the page is in is open each time the sheet opens. Adjusted
  // while drawing, as React recommends for state that follows a changed
  // value, so the sheet never opens on the sections left open last time.
  const [shown, setShown] = useState<ReadonlySet<SectionId>>(() => new Set(current ? [current] : []))
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setShown(new Set(current ? [current] : []))
  }

  const close = () => onOpenChange(false)
  const toggle = (section: SectionId) =>
    setShown((was) => {
      const next = new Set(was)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })

  async function logOut() {
    close()
    await auth.signOut()
    navigate('/')
  }

  const from = logInFrom(location)
  const rowEntry = (row: SheetRow): NavEntry => navEntry(row.entry)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay data-slot="menu-sheet-scrim" className="bg-black/50" />
        <SheetContent
          id={id}
          data-slot="menu-sheet"
          data-shape={shape}
          data-ring-ground="light"
          aria-describedby={undefined}
          // Both moves of the focus leave the page where it is, as the
          // primitive's own do: the sheet and the bar that opened it are
          // fixed to the window, so neither needs the page scrolled to be
          // seen, and a scroll would lose the reader's place.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            closeRef.current?.focus({ preventScroll: true })
          }}
          onCloseAutoFocus={(event) => {
            const handed = handedOn.current
            handedOn.current = false
            // Handed on, the sheet leaves the focus where the donation dialog
            // has put it. A dialog still on its way, or one whose code cannot
            // be had, holds nothing, so the focus comes back to the button.
            if (handed && focusIsHeld()) {
              event.preventDefault()
              return
            }
            const to = returnFocus()
            if (!to || !to.isConnected) return
            event.preventDefault()
            to.focus({ preventScroll: true })
          }}
          className={cn('fixed z-50 flex flex-col bg-raised text-ink outline-none', SHAPES[shape])}
        >
          <div data-slot="menu-sheet-bar" className="flex h-14 flex-none flex-row-reverse items-center justify-between gap-3 border-b border-hairline pr-2.5 pl-[18px]">
            <DialogClose
              ref={closeRef}
              aria-label={CLOSE_NAME}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[9px] border-[1.5px] border-hairline px-3 text-[15px] font-semibold hover:bg-muted"
            >
              <X aria-hidden="true" className="size-5" />
              Close
            </DialogClose>
            <DialogTitle className="text-lg">{navLabel('menu')}</DialogTitle>
          </div>

          <ScrollPanel label="Sections and links" className="max-h-none min-h-0 flex-1 rounded-none border-0 bg-raised pt-1 pb-3">
            <ul data-slot="menu-sheet-sections">
              {sheet.sections.map((section) => {
                const here = section.section === current
                const page = navEntry(section.section)
                const entries = section.rows.map(rowEntry)
                // A section with rows of its own shows or hides them; one with none is a link to its page.
                const disclosure = entries.length > 0
                const isShown = disclosure && shown.has(section.section)
                const listId = `${listIds}-${section.section}`
                const marked = here ? currentLink(location.pathname, disclosure ? entries : [page]) : null
                const words = (
                  <span className={cn('flex flex-1 flex-col leading-tight', here && 'pr-24')}>
                    <span>{page.label}</span>
                    {section.note && <span className="text-[12.5px] font-normal">{section.note}</span>}
                  </span>
                )
                if (!disclosure && page.href === null) return null
                return (
                  <li key={section.section} className={cn('relative border-b border-hairline', here && 'bg-[#fbfaf6] dark:bg-muted')}>
                    {disclosure ? (
                      <button
                        type="button"
                        aria-expanded={isShown}
                        aria-controls={isShown ? listId : undefined}
                        onClick={() => toggle(section.section)}
                        className={cn(HEAD, 'w-[calc(100%-0.5rem)] text-left')}
                      >
                        {words}
                        <ChevronDown aria-hidden="true" className={cn('size-5 flex-none transition-transform', isShown && 'rotate-180')} />
                      </button>
                    ) : (
                      <Link to={page.href ?? '/'} aria-current={marked ? 'page' : undefined} onClick={close} className={HEAD}>
                        {words}
                      </Link>
                    )}
                    {here && (
                      <span
                        aria-hidden="true"
                        className={cn(
                          'pointer-events-none absolute top-[23px] -translate-y-1/2 text-[13px] font-semibold text-[#866a1e] dark:text-ink',
                          disclosure ? 'right-12' : 'right-[18px]',
                        )}
                      >
                        You are here
                      </span>
                    )}
                    {isShown && (
                      <ul id={listId} className="px-[18px] pb-1.5">
                        {section.rows.map((row, i) => {
                          const entry = entries[i]
                          if (entry.href === null) return null
                          return (
                            <li key={row.entry}>
                              <Link
                                to={entry.href}
                                aria-current={marked?.id === entry.id ? 'page' : undefined}
                                onClick={close}
                                className="flex min-h-11 items-center border-t border-hairline text-[15px] underline-offset-4 hover:underline"
                              >
                                {sheetRowLabel(row)}
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>

            <div data-slot="menu-sheet-buttons" className="grid auto-cols-fr grid-flow-col gap-2 px-[18px] pt-3 pb-1.5">
              {sheet.utilities.map((id) => {
                const entry = navEntry(id)
                if (id === 'donate') {
                  return entry.href === null ? (
                    <Button
                      key={id}
                      type="button"
                      variant="secondary"
                      className="h-11 text-[15px]"
                      onClick={() => {
                        handedOn.current = true
                        close()
                        onDonate()
                      }}
                    >
                      {entry.label}
                    </Button>
                  ) : (
                    <Button key={id} asChild variant="secondary" className="h-11 text-[15px]">
                      <Link to={entry.href} onClick={close}>
                        {entry.label}
                      </Link>
                    </Button>
                  )
                }
                if (entry.href === null) return null
                if (id === 'joinLca' || id === 'renew') {
                  return (
                    <Button key={id} asChild variant="gold" className="h-11 text-[15px]">
                      <Link to={entry.href} onClick={close}>
                        {entry.label}
                      </Link>
                    </Button>
                  )
                }
                return (
                  <Button key={id} asChild variant="outline" className="h-11 text-[15px]">
                    <Link to={entry.href} state={id === 'logIn' ? { from } : undefined} onClick={close}>
                      {entry.label}
                    </Link>
                  </Button>
                )
              })}
            </div>

            {sheet.roles.length + sheet.logOut.length > 0 && (
              <ul data-slot="menu-sheet-account" className="px-[18px] pt-1.5">
                {sheet.roles.map((id) => {
                  const entry = navEntry(id)
                  if (entry.href === null) return null
                  return (
                    <li key={id}>
                      <Link to={entry.href} onClick={close} className={ROW}>
                        {entry.label}
                      </Link>
                    </li>
                  )
                })}
                {sheet.logOut.map((id) => (
                  <li key={id}>
                    <button type="button" onClick={logOut} className={ROW}>
                      {navLabel(id)}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <ul data-slot="menu-sheet-links" className="flex flex-wrap gap-x-[18px] px-[18px] pt-1.5">
              {sheet.links.map((id) => {
                const entry = navEntry(id)
                if (entry.href === null) return null
                const look = 'inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline'
                return (
                  <li key={id}>
                    {entry.leavesSite ? (
                      <a href={entry.href} target={entry.newTab ? '_blank' : undefined} rel="noopener noreferrer" onClick={close} className={look}>
                        {entry.label}
                      </a>
                    ) : (
                      <Link to={entry.href} onClick={close} className={look}>
                        {entry.label}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>

            {sheet.controls.includes('appearance') && (
              <AppearanceControl labelId={appearanceLabel} on="light" className="flex-wrap justify-between px-[18px] pt-2" />
            )}
          </ScrollPanel>
        </SheetContent>
      </DialogPortal>
    </Dialog>
  )
}
