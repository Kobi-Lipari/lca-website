import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Tournaments', href: '/tournaments' },
  { label: 'Clubs', href: '/clubs' },
  { label: 'About', href: '/about' },
  { label: 'Membership', href: '/membership' },
]

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    setMobileMenuOpen(false)
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 bg-[#1a2744] text-white shadow-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="text-lg font-semibold tracking-tight text-white hover:text-[#c8a94a] sm:text-xl"
          onClick={() => setMobileMenuOpen(false)}
        >
          Louisiana Chess Association
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm font-medium text-white/90 transition-colors hover:text-[#c8a94a]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {!loading && user ? (
            <>
              <Button
                asChild
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/dashboard">Dashboard</Link>
              </Button>
              <Button
                type="button"
                onClick={handleSignOut}
                className="bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90"
              >
                Log out
              </Button>
            </>
          ) : (
            <Button
              asChild
              className="bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90"
            >
              <Link to="/login">Log in</Link>
            </Button>
          )}
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-white/10 md:hidden"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>

      <div
        className={cn(
          'border-t border-white/10 bg-[#1a2744] md:hidden',
          mobileMenuOpen ? 'block' : 'hidden',
        )}
      >
        <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-[#c8a94a]"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          {!loading && user ? (
            <>
              <Link
                to="/dashboard"
                className="rounded-md px-3 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-[#c8a94a]"
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Button
                type="button"
                onClick={handleSignOut}
                className="mt-2 w-full bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90"
              >
                Log out
              </Button>
            </>
          ) : (
            <Button
              asChild
              className="mt-2 w-full bg-[#c8a94a] font-semibold text-[#1a2744] hover:bg-[#c8a94a]/90"
            >
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                Log in
              </Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  )
}
