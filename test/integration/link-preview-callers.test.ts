// test/integration/link-preview-callers.test.ts
// The link preview gained one thing in WS09 step 23: the body the club page
// writes inside the shell's root element, only when its caller gives one.
// Today's callers give none, so the news and tournament previews, and the
// club preview with CLUB_PAGES_ON unset, answer the base's bytes: each call
// the routes make is answered again by the base's own code
// (./helpers/clubPreviewBase.ts) from the same shell and the same words, and
// the two are held equal. CLUB_PAGES_ON is set and unset here through a
// getter on a mock of its module; no case reads how it ships. Every post,
// event and club here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import type { Env } from '../../functions/types'
import { seedClub, seedTournament } from './factories'
import type { LinkPreview } from '../../functions/utils/events/linkPreview'

import { onRequestGet as newsGet } from '../../functions/news/[slug]'
import { onRequestGet as tournamentGet } from '../../functions/tournaments/[id]'
import { onRequestGet as clubRouteGet } from '../../functions/clubs/[id]'

const flags = vi.hoisted(() => ({ pagesOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
  }
})

/** Every call the routes make to the link preview: what it was given, and the base's answer to the same. */
const calls = vi.hoisted(() => [] as Array<{ preview: unknown; base: Promise<string> }>)
vi.mock('../../functions/utils/events/linkPreview', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/linkPreview')>()
  const { baseWithLinkPreview: baseOf } = await import('./helpers/clubPreviewBase')
  return {
    ...real,
    withLinkPreview: (shell: Response, preview: LinkPreview, siteEnv: Env, request: Request) => {
      calls.push({ preview, base: baseOf(shell.clone(), preview, siteEnv, request).text() })
      return real.withLinkPreview(shell, preview, siteEnv, request)
    },
  }
})
afterEach(() => {
  flags.pagesOn = false
  calls.length = 0
})

const SHELL = Object.values(import.meta.glob('../../index.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0]
const SITE = 'https://www.louisianachess.org'

let made = 0
const mark = () => `${++made}${crypto.randomUUID().slice(0, 6)}`

/** A route's context, as Pages builds it, with the shell as the next answer. */
function contextFor(path: string, params: Record<string, string>) {
  return {
    request: new Request(`${SITE}${path}`),
    env: env as unknown as Env,
    params,
    data: {},
    functionPath: path,
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  } as unknown as EventContext<Env, string, Record<string, unknown>>
}

/** The route's answer as text, held equal to the base's answer to the one preview it asked for. */
async function heldToBase(answer: Response): Promise<string> {
  const text = await answer.text()
  expect(calls).toHaveLength(1)
  expect(calls[0].preview).not.toHaveProperty('root')
  expect(text).toBe(await calls[0].base)
  expect(text).not.toBe(SHELL)
  expect(text).toContain('<div id="root"></div>')
  calls.length = 0
  return text
}

describe('the link preview\'s callers answer the base\'s bytes', () => {
  it('the news preview, for a post with a picture and one without', async () => {
    const m = mark()
    for (const [slug, image] of [[`example-news-${m}`, '/images/example.jpg'], [`example-news-plain-${m}`, null]] as const) {
      await env.DB.prepare(
        `INSERT INTO lca_posts (id, slug, title, summary, body_html, image_url, status) VALUES (?, ?, 'Example news "post" & more', '', '<p>A made up <b>post</b>.</p>', ?, 'published')`,
      ).bind(`post-${slug}`, slug, image).run()
      const text = await heldToBase(await newsGet(contextFor(`/news/${slug}`, { slug })))
      expect(text).toContain(`<link rel="canonical" href="${SITE}/news/${slug}" />`)
    }
  })

  it('the tournament preview, for an event with a club and one without', async () => {
    const clubId = await seedClub({ name: `Example Chess Club ${mark()}` })
    for (const id of [await seedTournament({ name: 'Example Open <b>', date: '2026-12-05', clubId }), await seedTournament({ name: 'Example Quick', date: '2026-12-12' })]) {
      await env.DB.prepare('UPDATE tournaments SET end_date = ? WHERE id = ?').bind('2026-12-06', id).run()
      const text = await heldToBase(await tournamentGet(contextFor(`/tournaments/${id}`, { id })))
      expect(text).toContain(`${SITE}/tournaments/${id}`)
    }
  })

  it('the club preview with CLUB_PAGES_ON unset, for a club with a logo and one without', async () => {
    const m = mark()
    const withLogo = await seedClub({ id: `example-logo-club-${m}`, name: `Example Logo Club ${m}` })
    await env.DB.prepare(`UPDATE clubs SET image_url = ?, meeting_schedule = 'Tuesdays at 7:00 PM', location = 'Example Library' WHERE id = ?`)
      .bind(`/api/clubs/${withLogo}/logo?v=1`, withLogo).run()
    const plain = await seedClub({ id: `example-plain-club-${m}`, name: `Example Plain Club ${m}` })
    for (const id of [withLogo, plain]) {
      const text = await heldToBase(await clubRouteGet(contextFor(`/clubs/${id}`, { id })))
      expect(text).toContain(`<link rel="canonical" href="${SITE}/clubs/${id}" />`)
    }
  })
})
