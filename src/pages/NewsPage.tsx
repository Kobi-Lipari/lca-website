// src/pages/NewsPage.tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ExternalLink } from 'lucide-react'
import { PageHero } from '@/components/PageHero'
import { getNews, type ApiNewsItem } from '@/lib/api'
import { usePageTitle } from '@/hooks/usePageTitle'

const FACEBOOK_PAGE_URL = 'https://www.facebook.com/LouisianaChessAssociation'
const LCA_GOLD = '#c8a94a'

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Facebook's raw iframe page-plugin embed does not honor adapt_container_width the
// way the JS SDK div version does — it locks in whatever `width` is passed in the
// URL. So we measure the real container width ourselves and rebuild the iframe src
// to match, keeping it responsive on resize.
function useMeasuredWidth(maxWidth: number) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function update() {
      if (!el) return
      const w = Math.min(Math.floor(el.getBoundingClientRect().width), maxWidth)
      setWidth(w)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [maxWidth])

  return { containerRef, width }
}

// ── Club news feed ────────────────────────────────────────────────────────────

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
          <Link to="/clubs" className="text-[#c8a94a] hover:underline">
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
                className="font-medium text-[#1a2744] transition-colors hover:text-[#c8a94a] hover:underline"
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

// ── Main page ─────────────────────────────────────────────────────────────────

export function NewsPage() {
  usePageTitle('News')
  const { containerRef, width } = useMeasuredWidth(500)

  const [news, setNews] = useState<ApiNewsItem[]>([])
  const [newsLoading, setNewsLoading] = useState(true)

  useEffect(() => {
    getNews()
      .then(setNews)
      .catch(() => setNews([]))
      .finally(() => setNewsLoading(false))
  }, [])

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
                <p className="mb-1 text-[10px] font-medium text-[#c8a94a]">{item.date}</p>
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

        {/* ── Club news + Facebook, side by side ── */}
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,520px)]">

          {/* ── From the clubs ── */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Building2 className="size-4 text-[#c8a94a]" />
                From the clubs
              </h2>
              <Link to="/clubs" className="flex items-center gap-1 text-xs text-[#c8a94a] hover:underline">
                All clubs <ExternalLink className="size-3" />
              </Link>
            </div>
            <ClubNewsFeed news={news} loading={newsLoading} />
          </div>

          {/* ── Facebook feed ── */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <svg viewBox="0 0 24 24" className="size-4 fill-[#1877F2]" aria-hidden="true">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Latest from Facebook
              </h2>
              <a
                href={FACEBOOK_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-[#1877F2] hover:underline"
              >
                View page <ExternalLink className="size-3" />
              </a>
            </div>

            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              {/* Facebook Page Plugin header */}
              <div className="flex items-center gap-3 border-b border-border bg-[#1877F2]/5 px-5 py-3">
                <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1877F2]">
                  <svg viewBox="0 0 24 24" className="size-5 fill-white" aria-hidden="true">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Louisiana Chess Association</p>
                  <a
                    href={FACEBOOK_PAGE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#1877F2] hover:underline"
                  >
                    facebook.com/LouisianaChessAssociation
                  </a>
                </div>
                <a
                  href={FACEBOOK_PAGE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto rounded-md bg-[#1877F2] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1877F2]/90"
                >
                  Follow
                </a>
              </div>

              {/*
                TODO: Replace this iframe with the Facebook Page Plugin for a richer embedded feed.
                Steps:
                  1. Go to https://developers.facebook.com/docs/plugins/page-plugin
                  2. Set the href to https://www.facebook.com/LouisianaChessAssociation
                  3. Create a Facebook App at developers.facebook.com to get an App ID
                  4. Add VITE_FACEBOOK_APP_ID to your .env.local
                  5. Load the FB SDK in index.html and replace this iframe with the Page Plugin div

                The raw iframe embed below doesn't honor adapt_container_width — Facebook only
                resizes the JS-SDK div version reliably. So we measure the container ourselves
                (useMeasuredWidth above) and rebuild the src with the real pixel width, updating
                on resize via ResizeObserver.
              */}
              <div ref={containerRef} className="flex justify-center p-5">
                {width && (
                  <iframe
                    key={width}
                    src={`https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2FLouisianaChessAssociation&tabs=timeline&width=${width}&height=500&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false`}
                    width={width}
                    height="500"
                    style={{ border: 'none', overflow: 'hidden', display: 'block' }}
                    scrolling="no"
                    frameBorder="0"
                    allowFullScreen
                    allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                    title="Louisiana Chess Association Facebook feed"
                  />
                )}
              </div>

              <div className="border-t border-border px-5 py-3 text-center">
                <a
                  href={FACEBOOK_PAGE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#1877F2] hover:underline"
                >
                  See all posts on Facebook →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}