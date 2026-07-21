// src/components/FacebookFeed.tsx
//
// Replaces FacebookPanel (HomePage.tsx) and the raw Facebook iframe
// (NewsPage.tsx). Pulls posts from our own /api/facebook-posts
// endpoint — no Facebook chrome, no cross-origin iframe.
//
// variant="compact" fully replaces the HomePage grid column (renders its
//   own header + scrollable list + bottom fade, matching the Tournaments/
//   Clubs columns exactly).
// variant="full" fully replaces the NewsPage Facebook card (renders its
//   own bordered card + post grid + "See all posts" footer link).

import { useEffect, useState } from 'react'
import { FacebookIcon } from '@/components/ui/FacebookIcon'
import { ArrowRight } from 'lucide-react'

const FACEBOOK_PAGE_URL = 'https://www.facebook.com/LouisianaChessAssociation'
const LCA_GOLD = '#c8a94a'

interface FacebookFeedPost {
  id: string
  message: string
  createdAt: string
  permalinkUrl: string
  imageUrl: string | null
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function useFacebookPosts(limit: number) {
  const [posts, setPosts] = useState<FacebookFeedPost[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/facebook-posts?limit=${limit}`)
      .then(async (res) => {
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data.error)
        setPosts(data.posts)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [limit])

  return { posts, error }
}

interface FacebookFeedProps {
  variant: 'compact' | 'full'
  limit?: number
  height?: number
}

export function FacebookFeed({ variant, limit = variant === 'compact' ? 5 : 6, height = 340 }: FacebookFeedProps) {
  const { posts, error } = useFacebookPosts(limit)

  if (variant === 'compact') {
    return (
      <>
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
          <div className="flex items-center gap-2">
            <FacebookIcon className="size-3.5 text-[#1877F2]" />
            <span className="text-[13px] font-semibold text-foreground">Facebook</span>
          </div>
          <a
            href={FACEBOOK_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 text-xs text-[#c8a94a] hover:underline"
          >
            Follow us <ArrowRight className="size-3" />
          </a>
        </div>
        <div className="relative">
          <div className="overflow-y-auto" style={{ maxHeight: height }}>
            {error ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <p className="text-xs text-muted-foreground">Couldn't load posts right now.</p>
                <a href={FACEBOOK_PAGE_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-[#c8a94a] hover:underline">
                  Visit our Facebook page
                </a>
              </div>
            ) : posts === null ? (
              <div className="px-4 py-6 text-xs text-muted-foreground">Loading…</div>
            ) : posts.length === 0 ? (
              <div className="px-4 py-6 text-xs text-muted-foreground">No recent posts.</div>
            ) : (
              posts.map((post) => (
                <a
                  key={post.id}
                  href={post.permalinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start justify-between gap-2 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/30"
                >
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-[13px] font-medium text-foreground">{post.message}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(post.createdAt)}</p>
                  </div>
                </a>
              ))
            )}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background to-transparent" />
        </div>
      </>
    )
  }

  // variant === 'full' — NewsPage card
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="p-5">
        {error ? (
          <p className="text-sm text-muted-foreground">
            Couldn't load Facebook posts right now — you can still{' '}
            <a href={FACEBOOK_PAGE_URL} target="_blank" rel="noopener noreferrer" className="text-[#1877F2] hover:underline">
              visit the page directly
            </a>
            .
          </p>
        ) : posts === null ? (
          <p className="text-sm text-muted-foreground">Loading Facebook posts…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent posts.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <a
                key={post.id}
                href={post.permalinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                style={{ borderLeftColor: LCA_GOLD, borderLeftWidth: 3 }}
              >
                <p className="text-[11px] text-muted-foreground">{formatDate(post.createdAt)}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-[#1a2744]">{post.message}</p>
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="" className="mt-3 h-40 w-full rounded-lg object-cover" loading="lazy" />
                )}
              </a>
            ))}
          </div>
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
  )
}