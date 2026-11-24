// test/integration/club-written-look-edges.test.ts
// The edges of the look on the club page the server writes before any script
// (checkpoint W), beside club-written-look.test.ts, with CLUB_PAGES_ON set
// through a getter on a mock of its module: the look adds the one style
// element and the wrapper's mark and no other tag, attribute or address
// (no script, no link, no handler, no picture, no frame, no new request);
// dates with their weekday across both clock changes in America/Chicago and
// a year's end, an event with no end date and events on the same day keep
// the answer's order under the look; the plain-language words the club typed
// ("7:00 PM", a half written as a half, "US Chess") come through as typed
// with the old initials nowhere; a replay and a burst of reads while the club
// is edited each carry the same style bytes and one whole body; an address
// that gets no written page (an unknown part, an id's redirect) is not given
// a look. Every club, person and place here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import type { Env } from '../../functions/types'
import { seedClub, seedTournament } from './factories'

import { onRequestGet as routeGet } from '../../functions/clubs/[id]'
import { WRITTEN_PAGE_MARK, WRITTEN_PAGE_STYLE } from '../../functions/utils/clubs/pageHtml'

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
afterEach(() => {
  flags.pagesOn = false
  vi.restoreAllMocks()
})

const SHELL = Object.values(import.meta.glob('../../index.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0]
const SITE = 'https://www.louisianachess.org'
const STYLE_ELEMENT = `<style>${WRITTEN_PAGE_STYLE}</style>`

let made = 0
const mark = () => `${++made}${crypto.randomUUID().slice(0, 6)}`

function contextFor(part: string) {
  return {
    request: new Request(`${SITE}/clubs/${part}`),
    env: env as unknown as Env,
    params: { id: part },
    data: {},
    functionPath: `/clubs/${part}`,
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  } as unknown as EventContext<Env, string, Record<string, unknown>>
}
const route = async (part: string) => {
  const res = await routeGet(contextFor(part))
  return { status: res.status, location: res.headers.get('location'), text: await res.text() }
}

async function makeClub(name: string, extra = ''): Promise<{ id: string; slug: string; m: string }> {
  const m = mark()
  const id = await seedClub({ id: `example-club-id-${m}`, name: `${name} ${m}`, city: 'Example City' })
  const slug = `example-chess-club-${m}`
  await env.DB.prepare(`UPDATE clubs SET slug = ?${extra} WHERE id = ?`).bind(slug, id).run()
  return { id, slug, m }
}

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return end < 0 ? '' : text.slice(start + from.length, end)
}
const rootOf = (html: string) => between(html, '<div id="root">', '</div>\n')
const withoutStyle = (text: string) => text.replace(STYLE_ELEMENT, '')
/** The names of the tags a page writes, each once, in the order they first appear. */
const tagNames = (html: string) => [...new Set([...html.matchAll(/<([a-z][a-z0-9]*)[\s>/]/gi)].map((m) => m[1].toLowerCase()))]
/** The words of the written body, the style element taken out, one per element. */
const wordsOf = (root: string) => withoutStyle(root).replace(/<[^>]+>/g, '\n').split('\n').map((part) => part.trim()).filter(Boolean)

describe('what the look adds to the page', () => {
  it('is the style element and the wrapper\'s mark and nothing else: no new tag, no handler, no address, no picture, no frame, no script', async () => {
    flags.pagesOn = true
    const club = await makeClub('Example Chess Club')
    await seedTournament({ clubId: club.id, name: 'Example Winter Open', date: '2030-12-12' })
    const html = (await route(club.slug)).text
    const root = rootOf(html)
    const lookless = withoutStyle(root).replace(` ${WRITTEN_PAGE_MARK}`, '')
    // The tags of the body without the look, and with it: the only tag the look brings is style.
    expect(tagNames(root).filter((tag) => !tagNames(lookless).includes(tag))).toEqual(['style'])
    for (const tag of ['script', 'link', 'img', 'iframe', 'form', 'noscript', 'svg', 'object', 'embed', 'base', 'meta']) expect(tagNames(root), tag).not.toContain(tag)
    // The app's one module script is still the only script of the shell, once.
    const count = (text: string, piece: string) => text.split(piece).length - 1
    expect(count(html, '<script type="module"')).toBe(count(SHELL, '<script type="module"'))
    // No handler attribute and no address inside the written body, the links the club typed apart.
    expect(root).not.toMatch(/\son[a-z]+\s*=/i)
    // The three sections' ids, which checkpoint W's review gave the body, are the body's own and not the look's.
    expect(root.replace(/<section id="(?:about|when-and-where|events)">/g, '<section>')).not.toMatch(/\ssrc\s*=|\ssrcset\s*=|\sstyle\s*=|\sclass\s*=|\sid\s*=/i)
    expect(WRITTEN_PAGE_STYLE).not.toMatch(/url\(|@import|http|\/\//i)
    // The one added attribute is the mark, on the wrapper alone.
    expect(withoutStyle(root).match(new RegExp(WRITTEN_PAGE_MARK, 'g'))).toHaveLength(1)
    expect(root.startsWith(`<main ${WRITTEN_PAGE_MARK}>`)).toBe(true)
  })

  it('is not written for an unknown part, a part too long or an id\'s redirect, whatever the club\'s words', async () => {
    flags.pagesOn = true
    const club = await makeClub('Example Chess Club')
    for (const part of [`no-such-club-${mark()}`, 'x'.repeat(201), 'suggest']) {
      const res = await route(part)
      expect(res.status, part).toBe(200)
      expect(res.text, part).toBe(SHELL)
    }
    const moved = await route(club.id)
    expect([moved.status, moved.location, moved.text]).toEqual([301, `/clubs/${club.slug}`, ''])
  })
})

describe('dates and order under the look', () => {
  it('each event reads weekday, month, day and year in America/Chicago; no end date writes one date; a range writes both; the same day keeps the answer\'s order', async () => {
    flags.pagesOn = true
    const club = await makeClub('Example Chess Club')
    const add = async (id: string, name: string, date: string, endDate: string | null) => {
      await seedTournament({ id, clubId: club.id, name, date })
      if (endDate) await env.DB.prepare('UPDATE tournaments SET end_date = ? WHERE id = ?').bind(endDate, id).run()
    }
    await add(`example-event-${club.m}-c`, 'Example Spring Forward Open', '2030-03-10', null)
    await add(`example-event-${club.m}-d`, 'Example Fall Back Open', '2030-11-03', null)
    await add(`example-event-${club.m}-e`, 'Example Year End Open', '2030-12-31', '2031-01-01')
    await add(`example-event-${club.m}-b`, 'Example Tie Second', '2030-05-04', null)
    await add(`example-event-${club.m}-a`, 'Example Tie First', '2030-05-04', null)
    const root = rootOf((await route(club.slug)).text)
    const events = between(root, '<h2>Events</h2>', '</section>')
    expect(events).not.toBe('')
    const items = [...events.matchAll(/<li><h3><a href="[^"]*">(.*?)<\/a><\/h3><p>(.*?)<\/p><\/li>/g)].map((m) => [m[1], m[2]])
    // Newest first, and on one day by the event's id, as the answer orders them.
    expect(items).toEqual([
      ['Example Year End Open', 'Tue, Dec 31, 2030 to Wed, Jan 1, 2031'],
      ['Example Fall Back Open', 'Sun, Nov 3, 2030'],
      ['Example Tie First', 'Sat, May 4, 2030'],
      ['Example Tie Second', 'Sat, May 4, 2030'],
      ['Example Spring Forward Open', 'Sun, Mar 10, 2030'],
    ])
    for (const [, dates] of items) expect(dates).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat), [A-Z][a-z]{2} \d{1,2}, \d{4}/)
  })
})

describe('the plain words come through the look as typed', () => {
  it('keeps "7:00 PM", a half written as a half and "US Chess", with the old initials nowhere in the written body or the look', async () => {
    flags.pagesOn = true
    const club = await makeClub('Example Chess Club', `, how_we_meet_text = 'Tuesdays at 7:00 PM', about_text = 'We play US Chess rated games and give a ½ point bye.', cost_text = 'Free'`)
    const root = rootOf((await route(club.slug)).text)
    const words = wordsOf(root)
    expect(words).toContain('Tuesdays at 7:00 PM')
    expect(words).toContain('We play US Chess rated games and give a ½ point bye.')
    const spoken = words.join('\n')
    const oldInitials = 'US' + 'CF'
    expect(spoken).not.toMatch(new RegExp(`${oldInitials}|\\d\\.5\\b|\\bp\\.m\\.|\\b7 ?pm\\b|[\\u2013\\u2014]`, 'i'))
    expect(WRITTEN_PAGE_STYLE).not.toMatch(new RegExp(`${oldInitials}|[\\u2013\\u2014]`))
  })
})

describe('replays and a burst of reads while the club is edited', () => {
  it('gives the same bytes on a replay, and the same style bytes after the club\'s words change', async () => {
    flags.pagesOn = true
    const club = await makeClub('Example Chess Club', `, about_text = 'First words.'`)
    const first = (await route(club.slug)).text
    expect((await route(club.slug)).text).toBe(first)
    expect((await route(club.slug)).text).toBe(first)
    await env.DB.prepare('UPDATE clubs SET about_text = ? WHERE id = ?').bind('Second words.', club.id).run()
    const second = (await route(club.slug)).text
    expect(second).not.toBe(first)
    expect(second).toContain('Second words.')
    expect(second).not.toContain('First words.')
    expect(between(rootOf(first), '<style>', '</style>')).toBe(WRITTEN_PAGE_STYLE)
    expect(between(rootOf(second), '<style>', '</style>')).toBe(WRITTEN_PAGE_STYLE)
    expect(withoutStyle(second).replace(` ${WRITTEN_PAGE_MARK}`, '')).toBe(withoutStyle(first).replace(` ${WRITTEN_PAGE_MARK}`, '').replaceAll('First words.', 'Second words.'))
  })

  it('every read in a burst, with a write between, is one whole page: one style element before the heading, and the old words or the new, never a mix', async () => {
    flags.pagesOn = true
    const club = await makeClub('Example Chess Club', `, about_text = 'First words.'`)
    const reads = Array.from({ length: 8 }, () => route(club.slug))
    const write = env.DB.prepare('UPDATE clubs SET about_text = ? WHERE id = ?').bind('Second words.', club.id).run()
    const [pages] = await Promise.all([Promise.all(reads), write])
    for (const page of pages) {
      expect(page.status).toBe(200)
      const root = rootOf(page.text)
      expect(root.startsWith(`<main ${WRITTEN_PAGE_MARK}>${STYLE_ELEMENT}<h1>`)).toBe(true)
      expect(root.split('<style').length - 1).toBe(1)
      expect(root.endsWith('</main>')).toBe(true)
      expect(['First words.', 'Second words.'].filter((words) => root.includes(words))).toHaveLength(1)
    }
  })
})
