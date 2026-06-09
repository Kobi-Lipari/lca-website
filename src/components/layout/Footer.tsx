import { Link } from 'react-router-dom'

const quickLinks = [
  { label: 'Tournaments', href: '/tournaments' },
  { label: 'Clubs', href: '/clubs' },
  { label: 'Membership', href: '/membership' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
]

const memberLinks = [
  { label: 'Log in', href: '/login' },
  { label: 'Join LCA', href: '/membership' },
  { label: 'My Dashboard', href: '/dashboard' },
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-[#1a2744] text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-lg font-semibold">Louisiana Chess Association</p>
            <p className="mt-2 max-w-xs text-sm text-white/70">
              The official home of chess in Louisiana — tournaments, clubs, and
              community for players of every level.
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#c8a94a]">
              Quick Links
            </p>
            <ul className="mt-4 space-y-2">
              {quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-white/80 transition-colors hover:text-[#c8a94a]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#c8a94a]">
              Members
            </p>
            <ul className="mt-4 space-y-2">
              {memberLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-white/80 transition-colors hover:text-[#c8a94a]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-sm text-white/60">
          © {year} Louisiana Chess Association. All rights reserved.
        </div>
      </div>
    </footer>
  )
}