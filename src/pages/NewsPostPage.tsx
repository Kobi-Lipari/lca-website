// src/pages/NewsPostPage.tsx — one LCA news post at /news/:slug.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, Calendar, Pin } from 'lucide-react'

import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/button'
import { getPost, type ApiPost } from '@/lib/api'
import { formatPostDate } from '@/lib/posts'
import { usePageTitle } from '@/hooks/usePageTitle'
import { GOLD_BUTTON as GOLD } from '@/lib/brand'

export function NewsPostPage() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<ApiPost | null>(null)
  const [missing, setMissing] = useState(false)
  usePageTitle(post?.title ?? 'News')

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    getPost(slug)
      .then((p) => { if (!cancelled) setPost(p) })
      .catch(() => { if (!cancelled) setMissing(true) })
    return () => { cancelled = true }
  }, [slug])

  if (missing) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="font-medium text-lca-navy">This post isn't available.</p>
        <Button asChild variant="outline" className="mt-4"><Link to="/news">All news</Link></Button>
      </div>
    )
  }
  if (!post) {
    return <div className="mx-auto max-w-3xl px-6 py-16 text-muted-foreground" role="status">Loading…</div>
  }

  const external = post.link_url && !post.link_url.startsWith('/')

  return (
    <div>
      <PageHero
        size="compact"
        eyebrow={null}
        backTo={{ to: '/news', label: 'All news' }}
        title={post.title}
        meta={
          <span className="inline-flex items-center gap-3 text-sm text-white/70">
            {post.published_at && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4 text-lca-gold" /> {formatPostDate(post.published_at)}
              </span>
            )}
            {post.pinned === 1 && (
              <span className="inline-flex items-center gap-1.5"><Pin className="size-3.5 text-lca-gold" /> Pinned</span>
            )}
          </span>
        }
      />

      <article className="mx-auto max-w-3xl px-6 py-10">
        {post.image_url && (
          <img src={post.image_url} alt="" className="mb-8 w-full rounded-xl border object-cover" />
        )}
        {post.summary && <p className="text-lg leading-relaxed text-lca-navy">{post.summary}</p>}
        {post.body_html && (
          <div
            className="prose prose-sm mt-6 max-w-none sm:prose-base [&_a]:text-lca-navy [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
            // Sanitised server-side on save (functions/utils/posts.ts).
            dangerouslySetInnerHTML={{ __html: post.body_html }}
          />
        )}
        {post.link_url && (
          <Button asChild className={`mt-8 ${GOLD}`}>
            {external ? (
              <a href={post.link_url} target="_blank" rel="noopener noreferrer">
                {post.link_label ?? 'Learn more'} <ArrowRight className="ml-1.5 size-4" />
              </a>
            ) : (
              <Link to={post.link_url}>
                {post.link_label ?? 'Learn more'} <ArrowRight className="ml-1.5 size-4" />
              </Link>
            )}
          </Button>
        )}
      </article>
    </div>
  )
}
