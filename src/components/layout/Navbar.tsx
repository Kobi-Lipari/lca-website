import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FacebookIcon } from '@/components/ui/FacebookIcon'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import lcaLogo from '@/assets/lca-logo.jpg'

const navLinks = [
  { label: 'Tournaments', href: '/tournaments' },
  { label: 'Scholastic', href: '/scholastic' },
  { label: 'Clubs', href: '/clubs' },
  {
    label: 'Governance',
    href: '/governance',
    children: [
      { label: 'About LCA', href: '/about' },
      { label: 'Board members', href: '/governance/board' },
      { label: 'Bylaws', href: '/governance/bylaws' },
      { label: 'Rules & policies', href: '/governance/rules' },
      { label: 'Meeting minutes', href: '/governance/minutes' },
    ],
  },
  { label: 'News', href: '/news' },
  { label: 'Membership', href: '/membership' },
]

function DropdownMenu({ label, href, children }: { label: string; href: string; children: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const isActive = location.pathname.startsWith(href)
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" className={cn('flex items-center gap-1 text-sm font-medium transition-colors', isActive ? 'text-[#c8a94a]' : 'text-white/90 hover:text-[#c8a94a]')}>
        {label}
        <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-white/10 bg-[#1a2744] py-1 shadow-xl">
          {children.map((child) => (
            <Link key={child.href} to={child.href} className="block px-4 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-[#c8a94a]" onClick={() => setOpen(false)}>
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function RoleLinks({ mobile, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const { role, member } = useAuth()
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

  async function handleSignOut() {
    await signOut()
    setMobileOpen(false)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#1a2744] text-white shadow-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90" onClick={() => setMobileOpen(false)}>
          <img src={lcaLogo} alt="Louisiana Chess Association" className="h-8 w-8 rounded-lg object-cover" />
          <div>
            <div className="text-sm font-semibold leading-tight text-white">Louisiana Chess</div>
            <div className="text-[10px] leading-tight text-white/50">Association</div>
          </div>
        </Link>

        <nav className="hidden items-center gap-5 md:flex">
          {navLinks.map((link) =>
            link.children ? (
              <DropdownMenu key={link.href} label={link.label} href={link.href} children={link.children} />
            ) : (
              <Link key={link.href} to={link.href} className={cn('text-sm font-medium transition-colors', location.pathname === link.href || location.pathname.startsWith(link.href + '/') ? 'text-[#c8a94a]' : 'text-white/90 hover:text-[#c8a94a]')}>
                {link.label}
              </Link>
            ),
          )}
          {!loading && user && <RoleLinks />}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <a href="https://www.facebook.com/LouisianaChessAssociation" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-[#1877F2]">
            <FacebookIcon className="size-4" />
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
        <div className="border-t border-white/10 bg-[#1a2744] md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
            {navLinks.map((link) =>
              link.children ? (
                <div key={link.href}>
                  <button type="button" className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-[#c8a94a]" onClick={() => setMobileGovOpen((o) => !o)}>
                    {link.label}
                    <ChevronDown className={cn('size-4 transition-transform', mobileGovOpen && 'rotate-180')} />
                  </button>
                  {mobileGovOpen && (
                    <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-white/10 pl-3">
                      {link.children.map((child) => (
                        <Link key={child.href} to={child.href} className="rounded-md px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-[#c8a94a]" onClick={() => setMobileOpen(false)}>
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link key={link.href} to={link.href} className="rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-[#c8a94a]" onClick={() => setMobileOpen(false)}>
                  {link.label}
                </Link>
              ),
            )}
            {!loading && user && <RoleLinks mobile onNavigate={() => setMobileOpen(false)} />}
            <div className="mt-2 flex flex-col gap-2 border-t border-white/10 pt-3">
              <a href="https://www.facebook.com/LouisianaChessAssociation" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10" onClick={() => setMobileOpen(false)}>
                <FacebookIcon className="size-4 text-[#1877F2]" />
                Follow on Facebook
              </a>
              {!loading && user ? (
                <>
                  <Link to="/dashboard" className="rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-[#c8a94a]" onClick={() => setMobileOpen(false)}>Dashboard</Link>
                  <Button type="button" onClick={handleSignOut} className="w-full bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">Log out</Button>
                </>
              ) : (
                <>
                  <Button asChild variant="outline" className="w-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                    <Link to="/login" onClick={() => setMobileOpen(false)}>Log in</Link>
                  </Button>
                  <Button asChild className="w-full bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90">
                    <Link to="/membership" onClick={() => setMobileOpen(false)}>Join LCA</Link>
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