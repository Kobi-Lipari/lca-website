// src/pages/NewsPage.tsx
import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { PageHero } from '@/components/PageHero'
import { FacebookFeed } from '@/components/FacebookFeed'
import { usePageTitle } from '@/hooks/usePageTitle'
// Re-add when club news is re-enabled:
// import { useEffect, useState } from 'react'
// import { ExternalLink } from 'lucide-react'
// import { getNews, type ApiNewsItem } from '@/lib/api'

// LCA_GOLD and formatDate are only used by the disabled ClubNewsFeed below —
// uncomment both when club news is re-enabled.
// const LCA_GOLD = '#c8a94a'

// Pinned LCA announcements — edit this array to update pinned items
const PINNED: { title: string; summary: string; href: string; date: string }[] = [
  {
    title: '2025–26 tournament calendar published',
    summary: 'The full calendar of LCA-sanctioned events is now available on the tournaments page.',
    href: '/tournaments',
    date: 'July 14, 2025',
  },
  {
    title: 'New board members elected at annual meeting',
    summary: 'The LCA held its annual meeting on June 28. See governance for the updated board listing.',
    href: '/governance/board',
    date: 'Dec 1, 2025',
  },
  {
    title: 'LCA website now live at louisianachess.org',
    summary: 'Our new site is up. Member registration, tournament registration, and club info are all available online.',
    href: '/',
    date: 'July 1, 2026',
  },
]

// function formatDate(dateStr: string): string {
//   const d = new Date(dateStr + 'T00:00:00')
//   if (isNaN(d.getTime())) return dateStr
//   return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
// }

// ── Club news feed ────────────────────────────────────────────────────────────
// Commented out along with its call site below until club news posting is
// set up for all clubs — uncomment this whole block plus the imports above
// to re-enable.
/*
function ClubNewsFeed({
  news,
  loading,
}: {
  news: ApiNewsItem[]
  loading: boolean
}) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading club news…</p>
  }

  if (news.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/10 px-6 py-10 text-center">
        <Building2 className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="font-medium text-[#1a2744]">No club news yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Updates posted by clubs will appear here.{' '}
          <Link to="/clubs" className="text-[#1a2744] hover:underline">
            Browse clubs →
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {news.map((item) => {
        const color = item.club_color || LCA_GOLD
        return (
          <div
            key={item.id}
            className="rounded-xl border bg-card p-4 shadow-sm"
            style={{ borderLeftColor: color, borderLeftWidth: 3 }}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
              <span
                className="size-2 flex-shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
              <Link
                to={`/clubs/${item.club_id}`}
                className="font-medium text-[#1a2744] transition-colors hover:underline"
              >
                {item.club_name}
              </Link>
              <span className="text-muted-foreground">· {formatDate(item.news_date)}</span>
            </div>
            <p className="mt-1.5 font-semibold leading-snug text-[#1a2744]">{item.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.excerpt}</p>
          </div>
        )
      })}
    </div>
  )
}
*/

// ── Main page ─────────────────────────────────────────────────────────────────

export function NewsPage() {
  usePageTitle('News')

  // news/newsLoading state + the getNews() fetch removed along with
  // ClubNewsFeed above — restore both together when re-enabling.

  return (
    <div>
      {/* ── Hero ── */}
      <PageHero
        title="News & updates"
        subtitle="The latest from the LCA, our clubs, and the Louisiana chess community."
      />

      <section className="mx-auto max-w-6xl px-6 py-10">
        {/* ── Pinned announcements ── */}
        <div className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            LCA announcements
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {PINNED.map((item) => (
              <Link
                key={item.title}
                to={item.href}
                className="min-w-[220px] max-w-xs flex-shrink-0 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                style={{ borderLeftColor: '#c8a94a', borderLeftWidth: 3 }}
              >
                <p className="mb-1 text-[10px] font-medium text-[#1a2744]">{item.date}</p>
                <p className="font-semibold text-[#1a2744] leading-snug">{item.title}</p>
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{item.summary}</p>
              </Link>
            ))}
            {/* Future native posts placeholder */}
            <div className="min-w-[200px] flex-shrink-0 rounded-xl border border-dashed bg-muted/10 p-4 flex items-center justify-center">
              <p className="text-center text-xs text-muted-foreground italic leading-relaxed">
                More LCA posts will appear here as they are published.
              </p>
            </div>
          </div>
        </div>

        {/* ── Club news + Facebook ──
            "From the clubs" is temporarily commented out until club news
            posting is set up for all clubs (K, July 2026) — re-enable by
            uncommenting the block below and switching this back to the
            two-column grid. Facebook feed goes full-width/centered in the
            meantime so the page doesn't look lopsided with an empty left
            column next to a long right one. */}
        {/*
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,520px)]">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Building2 className="size-4 text-[#c8a94a]" />
                From the clubs
              </h2>
              <Link to="/clubs" className="flex items-center gap-1 text-xs text-[#1a2744] hover:underline">
                All clubs <ExternalLink className="size-3" />
              </Link>
            </div>
            <ClubNewsFeed news={news} loading={newsLoading} />
          </div>
          <div>
            <FacebookFeed variant="full" limit={8} />
          </div>
        </div>
        */}

        <div>
          <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Building2 className="size-4 text-[#c8a94a]" />
            Latest from Facebook
          </h2>
          <FacebookFeed variant="full" limit={8} />
        </div>
      </section>
    </div>
  )
}