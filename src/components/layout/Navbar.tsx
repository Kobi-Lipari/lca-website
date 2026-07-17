// src/components/layout/Navbar.tsx
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FacebookIcon } from '@/components/ui/FacebookIcon'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import lcaLogo from '@/assets/lca-logo.webp'

interface NavChild {
  label: string
  href: string
}

const navLinks: Array<{ label: string; href: string; items?: NavChild[] }> = [
  { label: 'Tournaments', href: '/tournaments' },
  { label: 'Scholastic', href: '/scholastic' },
  { label: 'Clubs', href: '/clubs' },
  {
    label: 'Governance',
    href: '/governance',
    items: [
      { label: 'About LCA', href: '/about' },
      { label: 'Board members', href: '/governance/board' },
      { label: 'Bylaws & rules', href: '/governance/bylaws' },
      { label: 'Meeting minutes', href: '/governance/minutes' },
    ],
  },
  { label: 'News', href: '/news' },
  { label: 'Membership', href: '/membership' },
]

// Gold tab-style underline for the active top-level item
const activeUnderline =
  'underline decoration-[#c8a94a] decoration-2 underline-offset-[10px]'

function isPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + '/')
}

function DropdownMenu({
  label,
  href,
  items,
}: {
  label: string
  href: string
  items: NavChild[]
}) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()

  // Active when on the section OR on any child page (e.g. /about lives
  // under Governance but doesn't share its path prefix)
  const isActive =
    isPathActive(location.pathname, href) ||
    items.some((item) => isPathActive(location.pathname, item.href))

  // Close on route change
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Close on outside click / tap and on Escape (returning focus to the button)
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
          isActive
            ? cn('text-[#c8a94a]', activeUnderline)
            : 'text-white/90 hover:text-[#c8a94a]',
        )}
      >
        {label}
        <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        // pt-1 keeps the visual gap but as PADDING inside the hover area,
        // so the pointer never crosses dead space between button and menu
        <div className="absolute left-0 top-full z-50 pt-1">
          <div
            role="menu"
            className="min-w-[180px] rounded-lg border border-white/10 bg-[#1a2744] py-1 shadow-xl"
          >
            {items.map((child) => (
              <Link
                key={child.href}
                role="menuitem"
                to={child.href}
                className={cn(
                  'block px-4 py-2 text-sm hover:bg-white/10 hover:text-[#c8a94a]',
                  isPathActive(location.pathname, child.href)
                    ? 'text-[#c8a94a]'
                    : 'text-white/80',
                )}
                onClick={() => setOpen(false)}
              >
                {child.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RoleLinks({ mobile, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const { role } = useAuth()
  const linkClass = mobile
    ? 'rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-[#c8a94a]'
    : 'text-sm font-medium text-white/90 transition-colors hover:text-[#c8a94a]'

  const items: { label: string; href: string }[] = []

  if (role === 'lca_admin' || role === 'club_rep' || role === 'tournament_director') {
    items.push({ label: 'Admin panel', href: '/admin' })
  }

  return (
    <>
      {items.map((item) => (
        <Link key={item.href} to={item.href} className={linkClass} onClick={onNavigate}>
          {item.label}
        </Link>
      ))}
    </>
  )
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileGovOpen, setMobileGovOpen] = useState(false)
  const { user, loading, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  function closeMobile() {
    setMobileOpen(false)
    setMobileGovOpen(false)
  }

  async function handleSignOut() {
    await signOut()
    closeMobile()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1a2744] text-white shadow-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3 transition-opacity hover:opacity-90" onClick={closeMobile}>
          <img src={lcaLogo} alt="Louisiana Chess Association" className="h-11 w-11 rounded-lg object-contain" />
          <div>
            <div className="text-base font-bold leading-tight text-white">Louisiana Chess</div>
            <div className="text-[10px] font-semibold uppercase leading-tight tracking-[0.18em] text-[#c8a94a]/90">
              Association
            </div>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 md:flex">
          {navLinks.map((link) =>
            link.items ? (
              <DropdownMenu key={link.href} label={link.label} href={link.href} items={link.items} />
            ) : (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'text-sm font-medium transition-colors',
                  isPathActive(location.pathname, link.href)
                    ? cn('text-[#c8a94a]', activeUnderline)
                    : 'text-white/90 hover:text-[#c8a94a]',
                )}
              >
                {link.label}
              </Link>
            ),
          )}
          {!loading && user && <RoleLinks />}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a
            href="https://www.facebook.com/LouisianaChessAssociation"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Follow LCA on Facebook"
            className="mr-1 flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-white/70 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-[#1877F2]"
          >
            <FacebookIcon className="size-6" />
          </a>
          {!loading && user ? (
            <>
              <Button asChild variant="outline" size="sm" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <Button type="button" size="sm" onClick={handleSignOut} className="bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">Log out</Button>
            </>
          ) : (
            <>
              <Button asChild variant="outline" size="sm" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild size="sm" className="bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
                <Link to="/membership">Join LCA</Link>
              </Button>
            </>
          )}
        </div>

        <button type="button" className="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/10 md:hidden" aria-expanded={mobileOpen} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} onClick={() => setMobileOpen((o) => !o)}>
          {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-white/10 bg-[#1a2744] md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
            {navLinks.map((link) =>
              link.items ? (
                <div key={link.href}>
                  <button
                    type="button"
                    aria-expanded={mobileGovOpen}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-[#c8a94a]"
                    onClick={() => setMobileGovOpen((o) => !o)}
                  >
                    {link.label}
                    <ChevronDown className={cn('size-4 transition-transform', mobileGovOpen && 'rotate-180')} />
                  </button>
                  {mobileGovOpen && (
                    <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-white/10 pl-3">
                      {link.items.map((child) => (
                        <Link key={child.href} to={child.href} className="rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-[#c8a94a]" onClick={closeMobile}>
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link key={link.href} to={link.href} className="rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-[#c8a94a]" onClick={closeMobile}>
                  {link.label}
                </Link>
              ),
            )}
            {!loading && user && <RoleLinks mobile onNavigate={closeMobile} />}
            <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3">
              <a href="https://www.facebook.com/LouisianaChessAssociation" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-white/80 hover:bg-white/10" onClick={closeMobile}>
                <FacebookIcon className="size-7 text-[#1877F2]" />
                Follow on Facebook
              </a>
              {!loading && user ? (
                <>
                  <Link to="/dashboard" className="rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-[#c8a94a]" onClick={closeMobile}>Dashboard</Link>
                  <Button type="button" onClick={handleSignOut} className="w-full bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">Log out</Button>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                    <Link to="/login" onClick={closeMobile}>Log in</Link>
                  </Button>
                  <Button asChild className="w-full bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
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