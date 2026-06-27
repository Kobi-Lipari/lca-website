// src/components/layout/Footer.tsx
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { FacebookIcon } from '@/components/ui/FacebookIcon'

const footerSections = [
  { title: 'Tournaments', links: [{ label: 'Upcoming events', href: '/tournaments' }, { label: 'Past results', href: '/tournaments' }, { label: 'Bid on an event', href: '/contact' }] },
  { title: 'Scholastic', links: [{ label: 'Annual schedule', href: '/scholastic' }, { label: 'State scholastic championship', href: '/scholastic' }, { label: 'School programs', href: '/scholastic' }] },
  { title: 'Governance', links: [{ label: 'About LCA', href: '/about' }, { label: 'Board members', href: '/governance/board' }, { label: 'Bylaws', href: '/governance/bylaws' }, { label: 'Rules & policies', href: '/governance/rules' }, { label: 'Meeting minutes', href: '/governance/minutes' }, { label: 'Contact us', href: '/contact' }] },
  { title: 'Membership', links: [{ label: 'Join LCA', href: '/membership' }, { label: 'Renew membership', href: '/membership' }, { label: 'Member benefits', href: '/membership' }, { label: 'Log in', href: '/login' }, { label: 'My dashboard', href: '/dashboard' }] },
]

export function Footer() {
  const year = new Date().getFullYear()
  return (
    <footer className="bg-[#1a2744] text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c8a94a]">
                <Trophy className="size-4 text-[#1a2744]" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">Louisiana Chess Association</div>
                <div className="text-xs text-white/50">Serving Louisiana players since 1935</div>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
              The official home of chess in Louisiana — tournaments, clubs, scholastic programs, and community for players of every level.
            </p>
            <a href="https://www.facebook.com/LouisianaChessAssociation" target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-[#1877F2]">
              <FacebookIcon className="size-4" />
              LouisianaChessAssociation
            </a>
          </div>
          <div className="flex gap-3">
            <Link to="/tournaments" className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:border-[#c8a94a] hover:text-[#c8a94a]">Find a tournament</Link>
            <Link to="/membership" className="rounded-lg bg-[#c8a94a] px-4 py-2 text-sm font-semibold text-[#1a2744] transition-colors hover:bg-[#c8a94a]/90">Join LCA</Link>
          </div>
        </div>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {footerSections.map((section) => (
            <div key={section.title}>
              <p className="text-xs font-semibold uppercase tracking-widest text-[#c8a94a]">{section.title}</p>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.href} className="text-sm text-white/60 transition-colors hover:text-[#c8a94a]">{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 sm:flex-row">
          <p className="text-xs text-white/40">© {year} Louisiana Chess Association. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/contact" className="text-xs text-white/40 transition-colors hover:text-white/60">Contact</Link>
            <Link to="/support" className="text-xs text-white/40 transition-colors hover:text-white/60">Support</Link>
            <Link to="/about" className="text-xs text-white/40 transition-colors hover:text-white/60">About</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
