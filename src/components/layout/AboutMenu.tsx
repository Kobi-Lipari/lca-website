// src/components/layout/AboutMenu.tsx
//
// The new header's About menu (WS02): About ▾ in the row of sections, and
// the panel it opens, with the association's seven pages from
// src/lib/nav.ts and "LCA on Facebook ↗" below them. Board & regions, Bylaws
// & rules and Minutes open the About page's tabs once newAbout is on, and
// State champions its champions tab once newNews is on; until then each
// opens today's page. When the header's row is too tight to hold Donate, it
// becomes the menu's last row, above the Facebook row.
//
// The row of the page a visitor is on is marked "You are here", beside its
// title, and carries aria-current="page", which a screen reader announces in
// place of the words, so they are hidden from it: the one row whose address
// the path is at or under, the longest when several are, so About LCA is
// the current row only when no other row is. The menu opens on a click and by
// the keyboard, as src/components/layout/navMenu.ts sets out, never on hover.
// The panel is a light surface inside the navy header, so it gives its
// controls the look's own focus ring back (data-ring-ground, src/index.css).
//
// The current row is the one place WS02 writes gold on a light ground in
// this file, as test/unit/fixtures/goldAllowlist.ts lists it (WS02_GOLD):
// "You are here" at 13 pixels and weight 600 in #705718 on the row's
// #f3eedc tint, 5.9:1, as the decided board draws it. Both are hex classes,
// as the fixture and the brief's AC21 write them: the new look has no token
// for the tint, and the gold guard (test/unit/goldText.test.ts) places a
// WS02 use only as a hex class, beside its words, at its size and on its
// ground. In dark mode the row takes the look's muted ground and the words
// its ink, never gold on the dark row.
import { useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useNavMenu } from '@/components/layout/navMenu'
import { aboutMenu, navEntry, navLabel, pathIsUnder, type NavEntry, type NavId } from '@/lib/nav'
import { cn } from '@/lib/utils'

interface AboutMenuProps {
  /** The page is in the About section: the button carries aria-current and the section's line. */
  current: boolean
  /** The classes of the row's sections, which the button shares. */
  buttonClassName: string
  /** The bar is too tight for Donate, so it is the menu's last row. */
  squeezed: boolean
  /** Opens the donation dialog, handed the control the focus goes back to when it closes. */
  onDonate: (from: HTMLElement | null) => void
}

/** The current row: the one whose address the path is at or under, the longest when several are. */
function currentRow(pathname: string, rows: readonly NavEntry[]): NavId | null {
  let best: { id: NavId; length: number } | null = null
  for (const row of rows) {
    if (row.id === 'donate' || row.href === null || row.leavesSite) continue
    const address = row.href.split(/[?#]/)[0]
    if (pathIsUnder(pathname, address) && (!best || address.length > best.length)) best = { id: row.id, length: address.length }
  }
  return best?.id ?? null
}

export function AboutMenu({ current, buttonClassName, squeezed, onDonate }: AboutMenuProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menu = useNavMenu({ wrapper: wrapperRef, button: buttonRef, panel: panelRef })
  const { pathname } = useLocation()
  const { rows, footer } = aboutMenu(squeezed)
  const entries = rows.map((id) => navEntry(id))
  const here = currentRow(pathname, entries)
  const facebook = navEntry(footer)

  return (
    <div ref={wrapperRef} className="relative" onKeyDown={menu.onKeyDown} onBlur={menu.onBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={menu.open}
        aria-controls={menu.open ? menu.panelId : undefined}
        aria-current={current ? 'page' : undefined}
        onClick={menu.toggle}
        onKeyDown={menu.onButtonKeyDown}
        className={buttonClassName}
      >
        {navLabel('about')}
        <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform', menu.open && 'rotate-180')} />
      </button>
      {menu.open && (
        <div
          ref={panelRef}
          id={menu.panelId}
          data-slot="about-menu"
          data-ring-ground="light"
          className="absolute left-0 top-full z-50 mt-3 w-[340px] rounded-xl border border-hairline bg-raised p-2 text-ink shadow-xl"
        >
          <ul>
            {entries.map((entry) => (
              <li key={entry.id}>
                {entry.href === null ? (
                  <button
                    type="button"
                    onClick={() => {
                      menu.close()
                      onDonate(buttonRef.current)
                    }}
                    className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-[15px] font-medium hover:bg-muted"
                  >
                    {entry.label}
                  </button>
                ) : (
                  <Link
                    to={entry.href}
                    aria-current={entry.id === here ? 'page' : undefined}
                    onClick={menu.close}
                    className={cn(
                      'flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-[15px] font-medium',
                      entry.id === here ? 'bg-[#f3eedc] font-semibold dark:bg-muted' : 'hover:bg-muted',
                    )}
                  >
                    <span>{entry.label}</span>
                    {entry.id === here && (
                      <span aria-hidden="true" className="text-[13px] font-semibold text-[#705718] dark:text-ink">
                        You are here
                      </span>
                    )}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-1.5 border-t border-hairline pt-1.5">
            <a
              href={facebook.href ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={menu.close}
              className="flex min-h-11 items-center rounded-lg px-3 text-[15px] font-medium hover:bg-muted"
            >
              {facebook.label}
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
