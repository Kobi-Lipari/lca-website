// src/components/layout/MyLcaMenu.tsx
//
// The new header's My LCA menu (WS02), in the place of Log in once a person
// is signed in, in the header's desktop and tablet forms alike: My LCA ▾ and
// the short list it opens, its rows from myLcaRows in src/lib/nav.ts for
// what the person holds (the person as src/components/layout/headerParts.ts
// reads them from the sign-in context, which the Menu sheet reads too). That
// is My LCA,
// today's role rows (Workspace, Board inbox and My region's clubs, by the
// conditions today's header uses) until myLcaRail gives My LCA its rail, the
// Admin row the person holds, and Log out, which signs the person out and
// goes to the home page. The sign-in context holds no children, so the
// Family row waits for the step that brings them to it; the Membership card
// waits for newMembership, and the to-do group and the event line come
// later.
//
// It opens on a click and by the keyboard, as src/components/layout/navMenu.ts
// sets out, never on hover. The panel is a light surface inside the navy
// header, so it gives its controls the look's own focus ring back
// (data-ring-ground, src/index.css).
import { useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { personOf } from '@/components/layout/headerParts'
import { useNavMenu } from '@/components/layout/navMenu'
import { useAuth } from '@/contexts/auth-context'
import { myLcaRows, navLabel } from '@/lib/nav'
import { cn } from '@/lib/utils'

interface MyLcaMenuProps {
  /** The classes of the bar's utilities, which the button shares. */
  buttonClassName: string
}

export function MyLcaMenu({ buttonClassName }: MyLcaMenuProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const menu = useNavMenu({ wrapper: wrapperRef, button: buttonRef, panel: panelRef })
  const auth = useAuth()
  const navigate = useNavigate()
  const rows = myLcaRows(personOf(auth))

  async function logOut() {
    menu.close()
    await auth.signOut()
    navigate('/')
  }

  return (
    <div ref={wrapperRef} className="relative" onKeyDown={menu.onKeyDown} onBlur={menu.onBlur}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={menu.open}
        aria-controls={menu.open ? menu.panelId : undefined}
        onClick={menu.toggle}
        onKeyDown={menu.onButtonKeyDown}
        className={cn(buttonClassName, 'gap-1')}
      >
        {navLabel('myLca')}
        <ChevronDown aria-hidden="true" className={cn('size-4 transition-transform', menu.open && 'rotate-180')} />
      </button>
      {menu.open && (
        <div
          ref={panelRef}
          id={menu.panelId}
          data-slot="my-lca-menu"
          data-ring-ground="light"
          className="absolute right-0 top-full z-50 mt-3 w-[280px] rounded-xl border border-hairline bg-raised p-2 text-ink shadow-xl"
        >
          <ul>
            {rows.map((row) => (
              <li key={row.id} className={cn(row.href === null && 'mt-1.5 border-t border-hairline pt-1.5')}>
                {row.href === null ? (
                  <button
                    type="button"
                    onClick={logOut}
                    className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-[15px] font-medium hover:bg-muted"
                  >
                    {row.label}
                  </button>
                ) : (
                  <Link
                    to={row.href}
                    onClick={menu.close}
                    className="flex min-h-11 items-center rounded-lg px-3 text-[15px] font-medium hover:bg-muted"
                  >
                    {row.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
