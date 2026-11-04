// src/components/layout/Footer.tsx
import { Link } from 'react-router-dom'
import { AppearanceControl } from '@/components/AppearanceControl'
import { LcaLogo } from '@/components/LcaLogo'
import { FacebookIcon } from '@/components/ui/FacebookIcon'
import lcaLogo from '@/assets/lca-logo.webp'
import { FEATURES } from '@/lib/features'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { chromeOn } from '@/lib/nav'

// Every link of today's footer points somewhere distinct, and a richer link waits for the page that has it.
const footerSections = [
  {
    title: 'Play',
    links: [
      { label: 'Tournaments', href: '/tournaments' },
      { label: 'Chess clubs', href: '/clubs' },
      { label: 'Scholastic chess', href: '/scholastic' },
      { label: 'State champions', href: '/champions' },
      { label: 'Scoresheet scanner', href: '/scanner' },
    ],
  },
  {
    title: 'Governance',
    links: [
      { label: 'About LCA', href: '/about' },
      { label: 'Board members', href: '/governance/board' },
      { label: 'Bylaws & rules', href: '/governance/bylaws' },
      { label: 'Meeting minutes', href: '/governance/minutes' },
    ],
  },
  {
    title: 'Membership',
    links: [
      { label: 'Join or renew', href: '/membership' },
      { label: 'Log in', href: '/login' },
      { label: 'My profile', href: '/dashboard' },
    ],
  },
  {
    title: 'Connect',
    links: [
      { label: 'News', href: '/news' },
      { label: 'Contact us', href: '/contact' },
      { label: 'Support', href: '/support' },
    ],
  },
]

function TodaysFooter() {
  const year = new Date().getFullYear()
  return (
    <footer className="border-t-[3px] border-lca-gold bg-brand-navy text-white print:hidden">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_2fr] lg:gap-16">
          {/* Brand column, identity, social, and actions as one anchored block */}
          <div>
            <div className="flex items-center gap-3.5">
              {/* Under the new look the logo's words are empty: the name beside it says them once. */}
              {FEATURES.newLook
                ? <LcaLogo width={56} height={56} alt="" />
                : <img src={lcaLogo} alt="Louisiana Chess Association" className="h-14 w-14 rounded-xl object-contain" />}
              <div>
                <div className="text-lg font-bold leading-tight text-white">
                  Louisiana Chess Association
                </div>
                <div className="mt-0.5 text-sm text-white/60">
                  Serving Louisiana players since 1915
                </div>
              </div>
            </div>

            <a
              href="https://www.facebook.com/LouisianaChessAssociation"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/5 py-2 pl-3 pr-5 text-sm font-medium text-white/85 transition-colors hover:border-[#1877F2] hover:bg-[#1877F2] hover:text-white"
            >
              <FacebookIcon className="size-6 shrink-0" />
              Follow us on Facebook
            </a>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/tournaments" className="rounded-lg border border-white/20 px-4 py-2 text-sm text-white/80 transition-colors hover:border-lca-gold hover:text-lca-gold">Find a tournament</Link>
              <Link to="/membership" className="rounded-lg bg-lca-gold px-4 py-2 text-sm font-semibold text-brand-navy transition-colors hover:bg-lca-gold/90">Join LCA</Link>
            </div>
          </div>

          {/* Link columns, left-aligned on a shared grid so every column
              scans down one clean edge */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-4">
            {footerSections.map((section) => (
              <div key={section.title}>
                <p className="text-sm font-bold uppercase tracking-widest text-lca-gold">
                  {section.title}
                </p>
                <ul className="mt-4 space-y-2.5">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.href} className="text-sm text-white/60 transition-colors hover:text-lca-gold">{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-white/50">
            © {year} Louisiana Chess Association. All rights reserved.
          </p>
          {/* The Appearance control, under the new look only, until the
              footer is rebuilt; the empty line keeps today's layout. */}
          {FEATURES.newLook ? (
            <AppearanceControl />
          ) : (
            <p className="text-sm text-white/40">
              
            </p>
          )}
        </div>
      </div>
    </footer>
  )
}

/**
 * The site's footer. With the chrome on (newNav and newLook, chromeOn in
 * src/lib/nav.ts) it is the new footer, src/components/layout/SiteFooter.tsx,
 * at every width. With either switch off it is today's footer, above, which
 * every visitor sees with every switch off, drawn as it always was
 * (test/unit/footer-today.test.tsx). It calls no hook itself, so the branch
 * it takes is chosen before any hook of the footer it draws runs.
 */
export function Footer() {
  return chromeOn() ? <SiteFooter /> : <TodaysFooter />
}
