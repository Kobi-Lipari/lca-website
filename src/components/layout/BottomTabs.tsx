// src/components/layout/BottomTabs.tsx
//
// The phone's tab bar of the new chrome (WS02 step 7), which the dock,
// src/components/layout/BottomDock.tsx, draws at the window's foot below 768
// pixels with the chrome on (newNav and newLook, chromeOn in src/lib/nav.ts),
// as the decided phone board draws it (Nav-Mobile-Final):
//
// - one <nav aria-label="Main">, white with the look's hairline above it
//   (the dark table's #111a2c under .dark), 56 pixels high and the safe area
//   under it, so the row stays whole above a phone's home indicator;
// - four tabs, navTabs in src/lib/nav.ts, each the full cell and at least 44
//   by 44 pixels, an icon over its label, the label always shown, at 12
//   pixels and 11 under 360: Tournaments and Clubs, the entries themselves;
//   Log in, which hands /login the page, or My LCA once signed in; and Menu,
//   which opens the Menu sheet and reads Close while it is open;
// - the current tab (currentTab), its label bold and its control
//   aria-current="page", with a 3 pixel bar across its top, a mark beside
//   the bold label and never colour alone; Menu is current on the pages of
//   the sections the sheet holds.
//
// The icons are nav.ts's names, each mapped to its lucide-react icon here,
// hidden from screen readers, so a tab is heard by its words alone. Every
// colour is a token of the new look, but for the current tab's bar in the
// light look (WS02_GOLD in test/unit/fixtures/goldAllowlist.ts).
import { Menu as MenuIcon, Trophy, User, Users, X, type LucideIcon } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useDock } from '@/components/layout/dockParts'
import { logInFrom } from '@/components/layout/headerParts'
import { useAuth } from '@/contexts/auth-context'
import { currentTab, navEntry, navLabel, navTabs, type NavIcon } from '@/lib/nav'
import { cn } from '@/lib/utils'

/** Each icon name of the navigation model and the icon drawn for it; a name with no icon here fails the type check. */
const ICONS: { readonly [I in NavIcon]: LucideIcon } = {
  trophy: Trophy,
  users: Users,
  user: User,
  menu: MenuIcon,
}

/**
 * A tab: the whole cell, the icon over its label, 12 pixels at weight 500
 * (11 under 360 pixels, the words never changing), in the look's ink, its
 * muted ink in dark mode; the current one bold in the full ink.
 */
const TAB =
  'relative flex h-full min-h-11 w-full min-w-11 flex-col items-center justify-center gap-[3px] text-xs leading-[1.2] max-[360px]:text-[11px]'

/**
 * The current tab's bar: 3 pixels across the middle of its top, rounded
 * below, in gold-ink #866a1e on the tab bar's white (5.13:1), a line and
 * never words, as test/unit/fixtures/goldAllowlist.ts's tab bar entry
 * allows it, and in dark mode the gold-ink token, brand gold #c8a94a on the
 * dark surface (7.6:1).
 */
const MARK = 'pointer-events-none absolute inset-x-[22%] top-0 rounded-b-[3px] border-t-[3px] border-t-[#866a1e] dark:border-t-gold-ink'

export function BottomTabs() {
  const dock = useDock()
  const auth = useAuth()
  const location = useLocation()
  const signedIn = !auth.loading && !!auth.user
  const current = currentTab(location.pathname)
  const open = dock?.sheet.open ?? false
  // Log in hands /login the page the person is on, its query and its hash,
  // as the header's and the sheet's do (logInFrom).
  const from = logInFrom(location)

  return (
    <nav aria-label="Main" data-slot="tab-bar" className="border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)] text-ink">
      <ul className="grid h-14 grid-cols-4">
        {navTabs(signedIn).map((tab) => {
          const here = current === tab.id
          const closes = tab.id === 'menu' && open
          const Icon = closes ? X : ICONS[tab.icon]
          const words = closes && tab.whileOpen ? tab.whileOpen : navLabel(tab.entry)
          const look = cn(TAB, here ? 'font-bold' : 'font-medium dark:text-ink-muted')
          const inside = (
            <>
              {here && <span aria-hidden="true" data-slot="tab-mark" className={MARK} />}
              <Icon aria-hidden="true" className="size-5 flex-none" />
              <span>{words}</span>
            </>
          )
          if (tab.id === 'menu') {
            return (
              <li key={tab.id} className="flex">
                <button
                  type="button"
                  data-tab={tab.id}
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  aria-controls={open && dock ? dock.sheetId : undefined}
                  aria-current={here ? 'page' : undefined}
                  disabled={!dock}
                  onClick={(event) => {
                    if (!dock) return
                    // A press on Close is a press outside the open sheet, which closes it and opens nothing.
                    if (open) dock.sheet.setOpen(false)
                    else dock.openSheet(event.currentTarget)
                  }}
                  className={look}
                >
                  {inside}
                </button>
              </li>
            )
          }
          const entry = navEntry(tab.entry)
          if (entry.href === null) return null
          return (
            <li key={tab.id} className="flex">
              <Link
                to={entry.href}
                state={tab.entry === 'logIn' ? { from } : undefined}
                data-tab={tab.id}
                aria-current={here ? 'page' : undefined}
                className={look}
              >
                {inside}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
