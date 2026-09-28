// src/pages/NewsPage.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Megaphone, Pin } from 'lucide-react'
import { PageHero } from '@/components/PageHero'
import { FacebookFeed } from '@/components/FacebookFeed'
import { usePageTitle } from '@/hooks/usePageTitle'
import { LCA } from '@/lib/brand'
import { getPosts, type ApiPost } from '@/lib/api'
import { formatPostDate } from '@/lib/posts'
// Re-add when club news is re-enabled:
// import { ExternalLink } from 'lucide-react'
// import { getNews, type ApiNewsItem } from '@/lib/api'

// LCA_GOLD and formatDate are only used by the disabled ClubNewsFeed below —
// uncomment both when club news is re-enabled.

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
        <p className="font-medium text-lca-navy">No club news yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Updates posted by clubs will appear here.{' '}
          <Link to="/clubs" className="text-lca-navy hover:underline">
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
                className="font-medium text-lca-navy transition-colors hover:underline"
              >
                {item.club_name}
              </Link>
              <span className="text-muted-foreground">· {formatDate(item.news_date)}</span>
            </div>
            <p className="mt-1.5 font-semibold leading-snug text-lca-navy">{item.title}</p>
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

  const [posts, setPosts] = useState<ApiPost[] | null>(null)
  useEffect(() => {
    let cancelled = false
    getPosts(24)
      .then((list) => { if (!cancelled) setPosts(list) })
      .catch(() => { if (!cancelled) setPosts([]) })
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      {/* ── Hero ── */}
      <PageHero
        title="News & updates"
        subtitle="The latest from the LCA, our clubs, and the Louisiana chess community."
      />

      <section className="mx-auto max-w-6xl px-6 py-10">
        {/* ── LCA posts (written in the admin panel → News posts) ── */}
        <div className="mb-12">
          <h2 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <Megaphone className="size-4 text-lca-gold" />
            LCA announcements
          </h2>
          {posts === null ? (
            <p className="text-sm text-muted-foreground" role="status">Loading…</p>
          ) : posts.length === 0 ? (
            <p className="rounded-xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
              No announcements yet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  to={`/news/${post.slug}`}
                  className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
                  style={{ borderLeftColor: LCA.gold, borderLeftWidth: 3 }}
                >
                  {post.image_url && (
                    <img src={post.image_url} alt="" loading="lazy" className="aspect-[1.91/1] w-full object-cover" />
                  )}
                  <div className="flex flex-1 flex-col p-4">
                    <p className="mb-1 flex items-center gap-2 text-[11px] font-medium text-lca-navy/80">
                      {post.pinned === 1 && <Pin className="size-3 text-lca-gold" aria-label="Pinned" />}
                      {formatPostDate(post.published_at)}
                    </p>
                    <p className="font-semibold leading-snug text-lca-navy group-hover:underline">{post.title}</p>
                    {post.summary && (
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{post.summary}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
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
                <Building2 className="size-4 text-lca-gold" />
                From the clubs
              </h2>
              <Link to="/clubs" className="flex items-center gap-1 text-xs text-lca-navy hover:underline">
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
            <Building2 className="size-4 text-lca-gold" />
            Latest from Facebook
          </h2>
          <FacebookFeed variant="full" limit={8} />
        </div>
      </section>
    </div>
  )
}