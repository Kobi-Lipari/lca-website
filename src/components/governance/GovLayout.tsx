// src/components/governance/GovLayout.tsx
import { Link, useLocation } from 'react-router-dom'
import { PageHero } from '@/components/PageHero'
import { cn } from '@/lib/utils'

const GOV_LINKS = [
  { label: 'About LCA',        href: '/about' },
  { label: 'Board members',    href: '/governance/board' },
  { label: 'Bylaws & rules',   href: '/governance/bylaws' },
  { label: 'Meeting minutes',  href: '/governance/minutes' },
]

export function GovSidebar() {
  const { pathname } = useLocation()
  return (
    <aside className="hidden lg:block lg:w-52 lg:flex-shrink-0">
      <div className="sticky top-24 overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="bg-lca-navy px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60">Governance</p>
        </div>
        <nav className="py-1">
          {GOV_LINKS.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                'block border-l-2 px-4 py-2.5 text-sm transition-colors',
                pathname === link.href
                  ? 'border-lca-gold bg-lca-gold/5 font-medium text-lca-navy'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  )
}

export function GovLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div>
      <PageHero title={title} subtitle={subtitle} />
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex gap-8">
          <GovSidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </section>
    </div>
  )
}

export function DocRow({
  title,
  filename,
  file_url,
}: {
  title: string
  filename?: string | null
  file_url?: string | null
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-0">
      <div className="flex items-center gap-3 min-w-0">
        <svg viewBox="0 0 24 24" className="size-5 flex-shrink-0 fill-red-500" aria-hidden="true">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zm-5.5-9.5C11 11.1 9.5 12 8 12H7v4H5.5V8H8c1.5 0 3 .9 3 2.5zM7 11h1c.8 0 1.5-.4 1.5-1.5S8.8 8 8 8H7v3z"/>
        </svg>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{title}</p>
          {filename && <p className="text-xs text-muted-foreground">{filename}</p>}
        </div>
      </div>
      {file_url ? (
        <a
          href={file_url}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="flex flex-shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-border-strong hover:bg-muted/30"
        >
          <svg viewBox="0 0 24 24" className="size-3.5 fill-current" aria-hidden="true">
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
          </svg>
          Download
        </a>
      ) : (
        <span className="flex-shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Pending upload</span>
      )}
    </div>
  )
}