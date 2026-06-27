import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'

const FACEBOOK_PAGE_URL = 'https://www.facebook.com/LouisianaChessAssociation'

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
    date: 'June 30, 2025',
  },
  {
    title: 'LCA website now live at louisianachess.org',
    summary: 'Our new site is up. Member registration, tournament registration, and club info are all available online.',
    href: '/',
    date: 'June 1, 2025',
  },
]

export function NewsPage() {
  usePageTitle('News')

  return (
    <div>
      {/* ── Hero ── */}
      <section className="border-b-[3px] border-[#c8a94a] bg-[#1a2744]">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-2 inline-block rounded-full border border-[#c8a94a]/50 bg-[#c8a94a]/15 px-2.5 py-0.5 text-[10px] text-[#f0d07a]">
            Louisiana Chess Association
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            News & updates
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/60">
            The latest from the LCA and the Louisiana chess community.
          </p>
        </div>
      </section>

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

              For now this iframe links directly to the Facebook page as a fallback.
              Remind K to set up the Facebook App ID when ready.
            */}
            <div className="p-5">
              <iframe
                src={`https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2FLouisianaChessAssociation&tabs=timeline&width=680&height=500&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false`}
                width="100%"
                height="500"
                style={{ border: 'none', overflow: 'hidden', display: 'block' }}
                scrolling="no"
                frameBorder="0"
                allowFullScreen
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
                title="Louisiana Chess Association Facebook feed"
              />
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
      </section>
    </div>
  )
}