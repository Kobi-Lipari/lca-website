// functions/news/[slug].ts
//
// Serves the app shell for /news/:slug with the post's own link preview —
// title, summary and picture — so sharing a post to Facebook shows it
// properly. Drafts and unknown slugs keep the site-wide default preview.
import type { Env } from '../types'
import { withLinkPreview } from '../utils/linkPreview'

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const shell = await context.next()
  try {
    const post = await context.env.DB.prepare(
      `SELECT title, summary, body_html, image_url FROM lca_posts WHERE slug = ? AND status = 'published'`,
    ).bind(context.params.slug as string).first<{
      title: string
      summary: string
      body_html: string
      image_url: string | null
    }>()
    if (!post) return shell

    const description = post.summary ||
      post.body_html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()

    return withLinkPreview(
      shell,
      { title: post.title, description: description || 'News from the Louisiana Chess Association', image: post.image_url, type: 'article' },
      context.env,
      context.request,
    )
  } catch (err) {
    console.error('news link preview failed', err)
    return shell
  }
}
