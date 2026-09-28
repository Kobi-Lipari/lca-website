// src/components/layout/Navbar.tsx
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FacebookIcon } from '@/components/ui/FacebookIcon'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import lcaLogo from '@/assets/lca-logo.webp'

interface NavLink {
  label: string
  href: string
  /** Other path prefixes that should light this item up as active. */
  activeFor?: string[]
}

// What players come for, always inline on desktop.
const primaryLinks: NavLink[] = [
  { label: 'Tournaments', href: '/tournaments' },
  { label: 'Scholastic', href: '/scholastic' },
  { label: 'Clubs', href: '/clubs' },
  { label: 'News', href: '/news' },
  { label: 'Scanner', href: '/scanner' },
]

// The association's own pages, under "More". Membership is also reachable
// from the Join LCA button and the dashboard, so it loses little here.
const moreLinks: NavLink[] = [
  // Opens straight on Board members; the governance pages carry their own
  // navigation (GovLayout) to About, Bylaws and Minutes from there.
  { label: 'Governance', href: '/governance/board', activeFor: ['/governance', '/about'] },
  { label: 'Membership', href: '/membership' },
]

// Labels shown inline at the "hybrid" mid-width tier (md-lg). Everything
// else only appears inline at full desktop width (lg+) and otherwise lives
// in the hamburger drawer.
const HYBRID_VISIBLE_LABELS = ['Tournaments', 'Clubs']

// Gold tab-style underline for the active top-level item
const activeUnderline =
  'underline decoration-lca-gold decoration-2 underline-offset-[10px]'

function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

function isLinkActive(pathname: string, link: NavLink): boolean {
  return [link.href, ...(link.activeFor ?? [])].some((href) => isPathActive(pathname, href))
}

/**
 * Links only some signed-in accounts get. They go under "More" with the
 * association pages rather than inline, so the bar reads the same for
 * everyone and an admin's bar is no wider than a player's.
 */
function useAccountLinks(): NavLink[] {
  const { user, loading, role, isBoardMember } = useAuth()
  if (loading || !user) return []

  const links: NavLink[] = []
  if (role === 'lca_admin' || role === 'club_rep' || role === 'tournament_director') {
    links.push({ label: 'Admin panel', href: '/admin' })
  }
  // Not a role check: isBoardMember comes from a current seat assignment (or
  // lca_admin, who can read every seat). It appears the moment someone is
  // given a seat and disappears the moment their term ends, without their
  // account changing in any other way.
  if (isBoardMember) {
    links.push({ label: 'Board inbox', href: '/board/inbox' })
  }
  return links
}

function MoreMenu({ groups }: { groups: NavLink[][] }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const visibleGroups = groups.filter((group) => group.length > 0)
  const isActive = visibleGroups.some((group) =>
    group.some((link) => isLinkActive(location.pathname, link)),
  )

  // Adjusting state during render is what React recommends for resetting on
  // a changed value: the menu is shut before the new page paints, instead of
  // flashing open for one frame and being closed by an effect afterwards.
  const [lastPath, setLastPath] = useState(location.pathname)
  if (location.pathname !== lastPath) {
    setLastPath(location.pathname)
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-1 text-sm font-medium transition-colors',
          isActive ? cn('text-lca-gold', activeUnderline) : 'text-white/90 hover:text-lca-gold',
        )}
      >
        More
        <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 pt-1">
          <div role="menu" className="min-w-[180px] rounded-lg border border-white/10 bg-lca-navy py-1 shadow-xl">
            {visibleGroups.map((group, i) => (
              <div key={group[0]!.href} className={cn(i > 0 && 'mt-1 border-t border-white/10 pt-1')}>
                {group.map((link) => (
                  <Link
                    key={link.href}
                    role="menuitem"
                    to={link.href}
                    className={cn(
                      'block px-4 py-2 text-sm hover:bg-white/10 hover:text-lca-gold',
                      isLinkActive(location.pathname, link) ? 'text-lca-gold' : 'text-white/80',
                    )}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function NavLinkItem({ link }: { link: NavLink }) {
  const location = useLocation()
  return (
    <Link
      to={link.href}
      className={cn(
        'text-sm font-medium transition-colors',
        isLinkActive(location.pathname, link)
          ? cn('text-lca-gold', activeUnderline)
          : 'text-white/90 hover:text-lca-gold',
      )}
    >
      {link.label}
    </Link>
  )
}

function DrawerLink({ link, onNavigate }: { link: NavLink; onNavigate: () => void }) {
  const location = useLocation()
  return (
    <Link
      to={link.href}
      className={cn(
        'rounded-md px-3 py-2 text-sm font-medium hover:bg-white/10 hover:text-lca-gold',
        isLinkActive(location.pathname, link) ? 'text-lca-gold' : 'text-white/90',
      )}
      onClick={onNavigate}
    >
      {link.label}
    </Link>
  )
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const accountLinks = useAccountLinks()

  function closeMobile() {
    setMobileOpen(false)
  }

  async function handleSignOut() {
    await signOut()
    closeMobile()
    navigate('/')
  }

  const hybridLinks = primaryLinks.filter((link) => HYBRID_VISIBLE_LABELS.includes(link.label))
  const desktopOnlyLinks = primaryLinks.filter((link) => !HYBRID_VISIBLE_LABELS.includes(link.label))

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-lca-navy text-white shadow-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-90" onClick={closeMobile}>
          <img src={lcaLogo} alt="Louisiana Chess Association" className="h-11 w-11 rounded-lg object-contain" />
          <div>
            <div className="text-base font-bold leading-tight text-white">Louisiana Chess</div>
            <div className="text-[10px] font-semibold uppercase leading-tight tracking-[0.18em] text-lca-gold/90">
              Association
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 md:flex">
          {hybridLinks.map((link) => <NavLinkItem key={link.href} link={link} />)}
          <div className="hidden items-center gap-5 lg:flex">
            {desktopOnlyLinks.map((link) => <NavLinkItem key={link.href} link={link} />)}
            <MoreMenu groups={[moreLinks, accountLinks]} />
          </div>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          
            <a href="https://www.facebook.com/LouisianaChessAssociation"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow LCA on Facebook"
            className="mr-1 hidden h-9 w-9 items-center justify-center rounded-lg border border-transparent text-white/70 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-[#1877F2] lg:flex"
          >
            <FacebookIcon className="size-6" />
          </a>
          {!loading && user ? (
            <>
              <Button asChild variant="outline" size="sm" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <Button type="button" size="sm" onClick={handleSignOut} className="bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90">Log out</Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="sm" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" className="bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90">
                <Link to="/membership">Join LCA</Link>
              </Button>
            </>
          )}
        </div>

        <button type="button" className="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/10 lg:hidden" aria-expanded={mobileOpen} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} onClick={() => setMobileOpen((o) => !o)}>
          {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-white/10 bg-lca-navy lg:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
            {primaryLinks.map((link) => (
              <DrawerLink key={link.href} link={link} onNavigate={closeMobile} />
            ))}
            <p className="mt-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/45">More</p>
            {[...moreLinks, ...accountLinks].map((link) => (
              <DrawerLink key={link.href} link={link} onNavigate={closeMobile} />
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3">
              <a href="https://www.facebook.com/LouisianaChessAssociation" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-white/80 hover:bg-white/10" onClick={closeMobile}>
                <FacebookIcon className="size-7 text-[#1877F2]" />
                Follow on Facebook
              </a>
              {!loading && user ? (
                <>
                  <Link to="/dashboard" className="rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-lca-gold" onClick={closeMobile}>Dashboard</Link>
                  <Button type="button" onClick={handleSignOut} className="w-full bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90">Log out</Button>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                    <Link to="/login" onClick={closeMobile}>Log in</Link>
                  </Button>
                  <Button asChild className="w-full bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90">
                    <Link to="/membership" onClick={closeMobile}>Join LCA</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}