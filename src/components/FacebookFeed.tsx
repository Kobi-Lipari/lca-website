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
import { ArrowRight, Link2, MessageSquareText, PlayCircle } from 'lucide-react'

const FACEBOOK_PAGE_URL = 'https://www.facebook.com/LouisianaChessAssociation'

interface FacebookFeedPost {
  id: string
  message: string
  createdAt: string
  permalinkUrl: string
  imageUrl: string | null
  linkTitle?: string | null
  linkUrl?: string | null
}

const URL_RE = /https?:\/\/\S+/g

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^(www|m)\./, '')
  } catch {
    return null
  }
}

/**
 * What to show as a post's text. Posts that are only a pasted link used to
 * render the raw URL (e.g. a long youtube.com/shorts/… string). URLs are
 * dropped from the text; if nothing is left, the shared link's title is
 * used, and failing that a plain "Shared a link from youtube.com".
 */
const UNAVAILABLE_TITLE = /^(this )?content (isn.t|is not|not) available/i

/**
 * Posts Facebook won't show to apps (shares of personal or group posts).
 * The server skips these now; this also drops any still sitting in the
 * fallback cache from before that change.
 */
export function isUsablePost(post: FacebookFeedPost): boolean {
  const text = post.message.replace(URL_RE, '').trim()
  const title = post.linkTitle && !UNAVAILABLE_TITLE.test(post.linkTitle) ? post.linkTitle : null
  return !!(text || title || post.linkUrl || post.imageUrl)
}

function postText(post: FacebookFeedPost): string {
  const text = post.message.replace(URL_RE, '').replace(/\s+/g, ' ').trim()
  if (text) return text
  if (post.linkTitle && !UNAVAILABLE_TITLE.test(post.linkTitle)) return post.linkTitle
  if (post.imageUrl && !post.linkUrl && !/https?:\/\//.test(post.message)) return 'Shared a photo'
  const host = hostOf(post.linkUrl) ?? hostOf(post.message.match(URL_RE)?.[0])
  if (host === 'youtube.com' || host === 'youtu.be') return 'Shared a video on YouTube'
  return host ? `Shared a link from ${host}` : 'Shared a link'
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
        setPosts((data.posts as FacebookFeedPost[]).filter(isUsablePost).slice(0, limit))
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
}

export function FacebookFeed({ variant, limit = variant === 'compact' ? 5 : 6 }: FacebookFeedProps) {
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
            className="flex items-center gap-0.5 text-xs text-lca-navy hover:underline"
          >
            Follow us <ArrowRight className="size-3" />
          </a>
        </div>
        <div>
          <div>
            {error ? (
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <p className="text-xs text-muted-foreground">Couldn't load posts right now.</p>
                <a href={FACEBOOK_PAGE_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-lca-navy hover:underline">
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
                    <p className="line-clamp-2 text-[13px] font-medium text-foreground">{postText(post)}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(post.createdAt)}</p>
                  </div>
                </a>
              ))
            )}
          </div>
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
            <a href={FACEBOOK_PAGE_URL} target="_blank" rel="noopener noreferrer" className="text-[#1668d8] hover:underline">
              visit the page directly
            </a>
            .
          </p>
        ) : posts === null ? (
          <p className="text-sm text-muted-foreground">Loading Facebook posts…</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent posts.</p>
        ) : (
          <FullFeed posts={posts} />
        )}
      </div>

      <div className="border-t border-border px-5 py-3 text-center">
        <a
          href={FACEBOOK_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#1668d8] hover:underline"
        >
          See all posts on Facebook →
        </a>
      </div>
    </div>
  )
}
// ── News page layout ────────────────────────────────────────────────────────
//
// Photo posts and text/link posts are laid out separately. Mixed together in
// one grid, a two-line text post sat beside a tall photo and left a large
// empty gap under it. Photos get even-sized cards; everything else is a
// compact list alongside (below on phones). Both stay newest-first.

function FullFeed({ posts }: { posts: FacebookFeedPost[] }) {
  const photos = posts.filter((p) => p.imageUrl)
  const others = posts.filter((p) => !p.imageUrl)

  const photoGrid = photos.length > 0 && (
    <div className={others.length > 0 ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
      {photos.map((post) => (
        <a
          key={post.id}
          href={post.permalinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
        >
          <img src={post.imageUrl!} alt="" loading="lazy" className="aspect-[4/3] w-full bg-muted object-cover" />
          <div className="flex flex-1 flex-col border-t-2 border-lca-gold p-4">
            <p className="text-[11px] text-muted-foreground">{formatDate(post.createdAt)}</p>
            <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-lca-navy group-hover:underline">{postText(post)}</p>
          </div>
        </a>
      ))}
    </div>
  )

  const list = others.length > 0 && (
    <div>
      {photos.length > 0 && (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">More updates</p>
      )}
      <ul className="divide-y overflow-hidden rounded-xl border bg-card">
        {others.map((post) => {
          const Icon = kindIcon(post)
          return (
            <li key={post.id}>
              <a
                href={post.permalinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <Icon className="mt-0.5 size-4 flex-shrink-0 text-lca-gold" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="line-clamp-2 text-sm text-lca-navy group-hover:underline">{postText(post)}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatDate(post.createdAt)}</span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )

  if (photoGrid && list) {
    return <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">{photoGrid}{list}</div>
  }
  return <>{photoGrid || list}</>
}

function kindIcon(post: FacebookFeedPost) {
  const host = hostOf(post.linkUrl) ?? hostOf(post.message.match(URL_RE)?.[0])
  if (host === 'youtube.com' || host === 'youtu.be') return PlayCircle
  if (host) return Link2
  return MessageSquareText
}
