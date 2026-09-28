// test/integration/posts.test.ts — LCA news posts written in the admin panel.
import { beforeEach, describe, expect, it } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedMember } from './factories'

import { onRequestGet as publicList } from '../../functions/api/posts'
import { onRequestGet as publicGet } from '../../functions/api/posts/[slug]'
import { onRequestGet as adminList, onRequestPost as adminCreate } from '../../functions/api/admin/posts'
import {
  onRequestDelete as adminDelete,
  onRequestPatch as adminPatch,
} from '../../functions/api/admin/posts/[id]'
import { onRequestPost as imageUpload } from '../../functions/api/admin/posts/[id]/image'

beforeEach(resetHarness)

type Post = { id: string; slug: string; title: string; status: string; body_html: string; published_at: string | null; pinned: number }

async function create(admin: string, body: Record<string, unknown>): Promise<Post> {
  const res = await invoke(adminCreate, { method: 'POST', as: admin, body })
  expect(res.status).toBe(201)
  return (await res.json<{ post: Post }>()).post
}

async function publicSlugs(): Promise<string[]> {
  const res = await invoke(publicList, { path: '/api/posts?limit=50' })
  return (await res.json<{ posts: Post[] }>()).posts.map((p) => p.slug)
}

describe('LCA news posts', () => {
  it('the three announcements that were hard-coded on the News page are still published', async () => {
    const slugs = await publicSlugs()
    expect(slugs).toEqual(expect.arrayContaining([
      '2025-26-tournament-calendar-published', 'new-board-members-elected', 'lca-website-now-live',
    ]))
  })

  it('a draft is invisible to the public until published', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'State Championship registration open', summary: 'Sign up now.' })
    expect(post.status).toBe('draft')
    expect(post.slug).toBe('state-championship-registration-open')
    expect(await publicSlugs()).not.toContain(post.slug)
    expect((await invoke(publicGet, { params: { slug: post.slug } })).status).toBe(404)

    const pub = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { status: 'published' } })
    expect(pub.status).toBe(200)
    const published = (await pub.json<{ post: Post }>()).post
    expect(published.published_at).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    expect(await publicSlugs()).toContain(post.slug)
    expect((await invoke(publicGet, { params: { slug: post.slug } })).status).toBe(200)
  })

  it('pinned posts come first', async () => {
    const admin = await seedAdmin()
    const pinned = await create(admin, { title: 'Pinned one', summary: 'x', status: 'published', pinned: true, publishedAt: '2020-01-01' })
    const slugs = await publicSlugs()
    expect(slugs[0]).toBe(pinned.slug)
  })

  it('cannot publish an empty post', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Nothing here' })
    const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { status: 'published' } })
    expect(res.status).toBe(400)
  })

  it('strips scripts, event handlers and javascript: links from the body', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, {
      title: 'Sanitise me',
      bodyHtml: '<p onclick="steal()">Hello <strong>world</strong></p><script>alert(1)</script>'
        + '<a href="javascript:alert(1)">bad</a> <a href="https://uschess.org">good</a> <img src=x onerror=alert(1)>',
    })
    const body = post.body_html
    expect(body).toContain('<strong>world</strong>')
    expect(body).not.toContain('script')
    expect(body).not.toContain('onclick')
    expect(body).not.toContain('onerror')
    expect(body).not.toContain('javascript:')
    expect(body).toContain('href="https://uschess.org"')
  })

  it('rejects an unsafe button link', async () => {
    const admin = await seedAdmin()
    const res = await invoke(adminCreate, { method: 'POST', as: admin, body: { title: 'Bad link', linkUrl: 'javascript:alert(1)' } })
    expect(res.status).toBe(400)
  })

  it('titles that repeat get distinct links', async () => {
    const admin = await seedAdmin()
    const a = await create(admin, { title: 'Monthly update' })
    const b = await create(admin, { title: 'Monthly update' })
    expect(a.slug).not.toBe(b.slug)
  })

  it('a published post keeps its link when its title is edited', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Original title', summary: 's', status: 'published' })
    const res = await invoke(adminPatch, { method: 'PATCH', as: admin, params: { id: post.id }, body: { title: 'Better title' } })
    expect((await res.json<{ post: Post }>()).post.slug).toBe(post.slug)
  })

  it('is admin-only', async () => {
    const member = await seedMember()
    const rep = await seedMember({ role: 'club_rep' })
    for (const who of [member, rep]) {
      expect((await invoke(adminCreate, { method: 'POST', as: who, body: { title: 'x' } })).status).toBe(403)
      expect((await invoke(adminList, { as: who })).status).toBe(403)
    }
  })

  it('deleting removes it from the site', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'Delete me', summary: 's', status: 'published' })
    expect((await invoke(adminDelete, { method: 'DELETE', as: admin, params: { id: post.id } })).status).toBe(200)
    expect(await publicSlugs()).not.toContain(post.slug)
  })

  it('stores an uploaded picture and records its URL', async () => {
    const admin = await seedAdmin()
    const post = await create(admin, { title: 'With picture' })
    const res = await invoke(imageUpload, {
      method: 'POST', as: admin, params: { id: post.id },
      headers: { 'Content-Type': 'image/jpeg' }, rawBody: 'fake-jpeg-bytes',
    })
    expect(res.status).toBe(200)
    const { imageUrl } = await res.json<{ imageUrl: string }>()
    expect(imageUrl).toMatch(new RegExp(`^/api/post-images/${post.id}\\?v=`))
    expect(await env.CLUB_LOGOS.get(`posts/${post.id}.jpg`)).not.toBeNull()
  })
})
