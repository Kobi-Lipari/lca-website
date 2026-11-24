// test/integration/club-written-look.test.ts
// How the club page the server writes before any script looks (checkpoint
// W), beside club-page-route.test.ts: with CLUB_PAGES_ON unset the address
// still answers the base's bytes. With it set, the written body is the
// base's body inside a wrapper with one style element of fixed text: take
// the wrapper's mark and the style element out and the body is the base's to
// the byte for the same club (its words, their order, every heading's level,
// every link's address and words), for a full club, a bare club and a club
// with nothing but its name. The style element is the same bytes for every
// club, whatever the club typed (markup, quote marks and a closing style
// tag in every field, each still escaped); it is the wrapper's first child,
// inside the root element and before the app's script; it adds under one
// kilobyte; the head, the redirects and the headers are left alone; and
// every reader gets the same bytes. The constant is set and unset through a
// getter on a mock of its module; no case reads how it ships. Every club,
// person and place here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import type { Env } from '../../functions/types'
import { accessToken, invoke } from './harness'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'
import { baseClubRoute } from './helpers/clubPreviewBase'

import { onRequestGet as routeGet } from '../../functions/clubs/[id]'
import { onRequestGet as pageGet } from '../../functions/api/clubs/[id]/page'
import { ABOUT_LABELS, ABOUT_TICKS, EVENTS_HEADING, PAGE_SECTION_IDS, aboutHeading, cityLine, eventDates, whenAndWhereHeading } from '../../domain/clubs/pageWords'
import type { ClubPageResponse } from '../../domain/contracts/clubPage'
import { clubLinks, escapeHtml, WRITTEN_PAGE_MARK, WRITTEN_PAGE_STYLE } from '../../functions/utils/clubs/pageHtml'

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

/** The site's own shell, index.html, as the build serves it to the route. */
const SHELL = Object.values(import.meta.glob('../../index.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0]
const SITE = 'https://www.louisianachess.org'
const STYLE_ELEMENT = `<style>${WRITTEN_PAGE_STYLE}</style>`

// The base's code that writes the body, as it stood at 9549f4f before this step, kept
// here so the cases can hold the written body's words to it byte for byte.
// Only the names are changed; every line that writes a byte is the base's.
// escapeHtml and clubLinks are imported: this step leaves both as they were.
// Checkpoint W's review since gave the three sections their ids and wrote how
// the club meets with its single line breaks as <br>: the copy takes those two
// changes alone (PAGE_SECTION_IDS and baseStatementOf), so it still holds the
// look to the body it wraps.
const hasWords = (value: string | null | undefined): value is string => typeof value === 'string' && value.trim() !== ''
function baseParagraphsOf(words: string): string[] {
  return words.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).map((part) => `<p>${escapeHtml(part)}</p>`)
}
function baseStatementOf(words: string): string[] {
  return words.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
    .map((part) => `<p>${part.split(/\r?\n/).map((line) => escapeHtml(line.trim())).join('<br>')}</p>`)
}
function baseAboutHtml(answer: ClubPageResponse): string[] {
  const { about } = answer
  const parts = hasWords(about.text) ? baseParagraphsOf(about.text) : []
  if (hasWords(about.cost)) parts.push(`<h3>${ABOUT_LABELS.cost}</h3>`, ...baseParagraphsOf(about.cost))
  const ticks: string[] = []
  if (about.weekend_play) ticks.push(ABOUT_TICKS.weekendPlay)
  if (about.scholastic_friendly) ticks.push(ABOUT_TICKS.scholasticFriendly)
  if (hasWords(about.welcome) || ticks.length > 0) {
    parts.push(`<h3>${ABOUT_LABELS.welcome}</h3>`)
    if (hasWords(about.welcome)) parts.push(...baseParagraphsOf(about.welcome))
    if (ticks.length > 0) parts.push(`<ul>${ticks.map((tick) => `<li>${tick}</li>`).join('')}</ul>`)
  }
  const links = clubLinks(about)
  if (links.length > 0) {
    const items = links.map((link) => `<li><a href="${escapeHtml(link.href)}" rel="noopener noreferrer">${escapeHtml(link.words)}</a></li>`)
    parts.push(`<h3>${ABOUT_LABELS.online}</h3>`, `<ul>${items.join('')}</ul>`)
  }
  if (parts.length === 0) return []
  return [`<section id="${PAGE_SECTION_IDS.about}"><h2>${escapeHtml(aboutHeading(answer.club.name))}</h2>${parts.join('')}</section>`]
}
function basePlacesHtml(answer: ClubPageResponse): string[] {
  if (answer.places.length === 0) return []
  const rows = answer.places.map((place) => {
    const lines = [`<p>${escapeHtml(place.name)}</p>`]
    if (hasWords(place.street)) lines.push(`<p>${escapeHtml(place.street.trim())}</p>`)
    if (hasWords(place.note)) lines.push(...baseParagraphsOf(place.note))
    return `<li>${lines.join('')}</li>`
  })
  return [`<section id="${PAGE_SECTION_IDS.when_and_where}"><h2>${escapeHtml(whenAndWhereHeading(answer.club.name))}</h2><ul>${rows.join('')}</ul></section>`]
}
function baseEventsHtml(answer: ClubPageResponse): string[] {
  if (answer.events.length === 0) return []
  const rows = answer.events.map((event) => {
    const link = `<a href="/tournaments/${escapeHtml(encodeURIComponent(event.id))}">${escapeHtml(event.name)}</a>`
    return `<li><h3>${link}</h3><p>${escapeHtml(eventDates(event))}</p></li>`
  })
  return [`<section id="${PAGE_SECTION_IDS.events}"><h2>${EVENTS_HEADING}</h2><ul>${rows.join('')}</ul></section>`]
}
function baseBody(answer: ClubPageResponse): string {
  const { club } = answer
  const top = [`<h1>${escapeHtml(club.name)}</h1>`, `<p>${escapeHtml(cityLine(club.city, club.region))}</p>`]
  if (hasWords(answer.statement.text)) top.push(...baseStatementOf(answer.statement.text))
  return `<main>${[...top, ...baseAboutHtml(answer), ...basePlacesHtml(answer), ...baseEventsHtml(answer)].join('')}</main>`
}

let made = 0
const mark = () => `${++made}${crypto.randomUUID().slice(0, 6)}`

/** The route's context, as Pages builds it, with the shell as the next answer. */
function contextFor(part: string, headers: Record<string, string> = {}) {
  return {
    request: new Request(`${SITE}/clubs/${part}`, { headers }),
    env: env as unknown as Env,
    params: { id: part },
    data: {},
    functionPath: `/clubs/${part}`,
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  } as unknown as EventContext<Env, string, Record<string, unknown>>
}
async function answerOf(res: Response) {
  return { status: res.status, headers: Object.fromEntries([...res.headers.entries()].sort()), text: await res.text() }
}
const route = async (part: string, headers?: Record<string, string>) => answerOf(await routeGet(contextFor(part, headers)))
const base = async (part: string) => answerOf(await baseClubRoute(contextFor(part)))

/** A made-up club with an id that is not its slug. */
async function makeClub(name: string) {
  const m = mark()
  const id = await seedClub({ id: `example-club-id-${m}`, name: `${name} ${m}`, city: 'Example City' })
  const slug = `example-knights-club-${m}`
  await env.DB.prepare('UPDATE clubs SET slug = ? WHERE id = ?').bind(slug, id).run()
  return { id, slug, m }
}

/** The fuller club: About in two paragraphs, cost, who is welcome, three links, two places and an event. */
async function giveEverything(clubId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE clubs SET about_text = ?, how_we_meet_text = 'Tuesdays at 7:00 PM in the reading room', cost_text = 'Free for everyone',
            welcome_text = 'Players of every level', weekend_play = 1, scholastic_friendly = 1, region = 'Example Region',
            facebook_url = 'https://www.facebook.com/example-knights-club', website_url = 'https://www.example.org/chess', other_url = 'https://example.org/ratings' WHERE id = ?`,
  ).bind('We are a made up club for players of every level.\n\nBring a board if you have one.', clubId).run()
  await env.DB.prepare(
    `INSERT INTO club_places (club_id, name, street, note, latitude, longitude, sort) VALUES
       (?, 'Example Library', '1 Example Street', 'Room past the front desk', 30.45, -91.18, 0),
       (?, 'Example Hall', '2 Example Avenue', NULL, NULL, NULL, 1)`,
  ).bind(clubId, clubId).run()
  await seedTournament({ clubId, name: 'Example Winter Open', date: '2026-12-12' })
}

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return end < 0 ? '' : text.slice(start + from.length, end)
}
const rootOf = (html: string) => between(html, '<div id="root">', '</div>\n')
const count = (text: string, piece: string) => text.split(piece).length - 1
/** The written body with the style element and the wrapper's mark taken out, by place rather than by pattern. */
function withoutTheLook(root: string): string {
  const styleAt = root.indexOf('<style>')
  const styleEnd = root.indexOf('</style>') + '</style>'.length
  const bare = styleAt < 0 ? root : root.slice(0, styleAt) + root.slice(styleEnd)
  return bare.replace(`<main ${WRITTEN_PAGE_MARK}>`, '<main>')
}
/** Every heading as its level and its words, and every link as its address and its words, in order. */
const headingsOf = (html: string) => [...html.matchAll(/<h([1-6])>(.*?)<\/h\1>/g)].map((m) => [m[1], m[2].replace(/<[^>]+>/g, '')])
const linksOf = (html: string) => [...html.matchAll(/<a href="([^"]*)"[^>]*>(.*?)<\/a>/g)].map((m) => [m[1], m[2]])
const textOf = (html: string) => html.replace(/<style>[^<]*<\/style>/g, '').replace(/<[^>]+>/g, '\n').split('\n').filter(Boolean)
const pageAnswer = async (slug: string) => (await invoke(pageGet, { params: { id: slug } })).json<ClubPageResponse>()

describe('the written page with CLUB_PAGES_ON unset', () => {
  it('answers the base\'s bytes at the club\'s id and its slug, and carries no styling', async () => {
    flags.pagesOn = false
    const club = await makeClub('Example Knights Club')
    await giveEverything(club.id)
    for (const part of [club.id, club.slug, `no-such-club-${mark()}`]) {
      const now = await route(part)
      expect(now, part).toEqual(await base(part))
      expect(now.text, part).not.toContain(WRITTEN_PAGE_MARK)
      expect(now.text, part).not.toContain('<style')
    }
  })
})

describe('the written page with CLUB_PAGES_ON set', () => {
  it('a full club: without the style element and the wrapper\'s mark, the body is the base\'s to the byte, its headings, links and words in order', async () => {
    flags.pagesOn = true
    const club = await makeClub('Example Knights Club')
    await giveEverything(club.id)
    const res = await route(club.slug)
    expect(res.status).toBe(200)
    const root = rootOf(res.text)
    const expected = baseBody(await pageAnswer(club.slug))
    expect(withoutTheLook(root)).toBe(expected)
    expect(headingsOf(root)).toEqual(headingsOf(expected))
    expect(headingsOf(root).map(([level]) => level)).toEqual(['1', '2', '3', '3', '3', '2', '2', '3'])
    expect(linksOf(root)).toEqual(linksOf(expected))
    expect(linksOf(root).length).toBe(4)
    expect(textOf(root)).toEqual(textOf(expected))
  })

  it('a bare club and a club with nothing but its name: the base\'s body once the look is taken out, and the same style element as the full club', async () => {
    flags.pagesOn = true
    const full = await makeClub('Example Knights Club')
    await giveEverything(full.id)
    const bare = await makeClub('Example Chess Club')
    await env.DB.prepare(`UPDATE clubs SET about_text = 'A friendly made up club.', how_we_meet_text = 'Tuesdays at 7:00 PM' WHERE id = ?`).bind(bare.id).run()
    await env.DB.prepare(`INSERT INTO club_places (club_id, name, sort) VALUES (?, 'Example Library', 0)`).bind(bare.id).run()
    const named = await makeClub('Example Chess Club')
    const styles: string[] = []
    for (const club of [full, bare, named]) {
      const html = (await route(club.slug)).text
      const root = rootOf(html)
      expect(withoutTheLook(root), club.slug).toBe(baseBody(await pageAnswer(club.slug)))
      expect(root.startsWith(`<main ${WRITTEN_PAGE_MARK}>${STYLE_ELEMENT}<h1>`), club.slug).toBe(true)
      styles.push(between(root, '<style>', '</style>'))
    }
    expect(new Set(styles)).toEqual(new Set([WRITTEN_PAGE_STYLE]))
  })

  it('writes one style element, the wrapper\'s first child, inside the root element and before the app\'s script, and adds under one kilobyte', async () => {
    flags.pagesOn = true
    const club = await makeClub('Example Knights Club')
    await giveEverything(club.id)
    const html = (await route(club.slug)).text
    expect(count(html, '<style')).toBe(count(SHELL, '<style') + 1)
    expect(count(html, '</style>')).toBe(1)
    expect(count(html, `<main ${WRITTEN_PAGE_MARK}>`)).toBe(1)
    expect(count(html.replace(STYLE_ELEMENT, ''), WRITTEN_PAGE_MARK)).toBe(1)
    const rootStart = html.indexOf('<div id="root">')
    expect(html.indexOf(`<div id="root"><main ${WRITTEN_PAGE_MARK}><style>`)).toBe(rootStart)
    expect(html.indexOf('</style>')).toBeLessThan(html.indexOf('<h1>'))
    expect(html.indexOf('</main></div>')).toBeLessThan(html.indexOf('<script type="module"'))
    // Outside the root element nothing names the wrapper or carries a style.
    const outside = html.replace(rootOf(html), '')
    expect(outside).not.toContain(WRITTEN_PAGE_MARK)
    expect(outside).not.toContain('<style')
    // What the look weighs on every club page.
    const added = rootOf(html).length - withoutTheLook(rootOf(html)).length
    expect(added).toBe(STYLE_ELEMENT.length + ` ${WRITTEN_PAGE_MARK}`.length)
    expect(new TextEncoder().encode(STYLE_ELEMENT).length + ` ${WRITTEN_PAGE_MARK}`.length).toBeLessThan(1024)
  })

  it('a club whose every field carries markup, quote marks and a closing style tag: each still escaped, and the style element the same bytes', async () => {
    flags.pagesOn = true
    const BAD = '</style><style>main{display:none}</style><b>"x"</b> & \'y\' </main><script>alert(1)</script> <!--'
    const m = mark()
    const id = await seedClub({ id: `example-club-id-${m}`, name: `Example Chess Club ${BAD}`, city: `Example City ${BAD}` })
    const slug = `example-chess-club-${m}`
    await env.DB.prepare(
      `UPDATE clubs SET slug = ?, about_text = ?, how_we_meet_text = ?, cost_text = ?, welcome_text = ?, region = ?,
              facebook_url = ?, website_url = ? WHERE id = ?`,
    ).bind(slug, `About ${BAD}`, `Statement ${BAD}`, `Cost ${BAD}`, `Welcome ${BAD}`, `Region ${BAD}`,
      'https://example.org/a?q=</style>', 'https://example.org/b"</style>', id).run()
    await env.DB.prepare(`INSERT INTO club_places (club_id, name, street, note, sort) VALUES (?, ?, ?, ?, 0)`).bind(id, `Place ${BAD}`, `Street ${BAD}`, `Note ${BAD}`).run()
    await seedTournament({ clubId: id, name: `Event ${BAD}`, date: '2026-12-05' })
    const html = (await route(slug)).text
    const root = rootOf(html)

    expect(between(root, '<style>', '</style>')).toBe(WRITTEN_PAGE_STYLE)
    expect(count(html, '</style>')).toBe(1)
    expect(count(html, '<style')).toBe(1)
    expect(root).not.toMatch(/<b>|<script|<!--/)
    for (const field of ['Example Chess Club', 'Example City', 'About', 'Statement', 'Cost', 'Welcome', 'Region', 'Place', 'Street', 'Note', 'Event']) {
      expect(root, field).toContain(`${field} &lt;/style&gt;&lt;style&gt;main{display:none}&lt;/style&gt;&lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; &#39;y&#39; &lt;/main&gt;`)
    }
    expect(root).toContain('href="https://example.org/a?q=&lt;/style&gt;"')
    expect(root).toContain('href="https://example.org/b&quot;&lt;/style&gt;"')
    // The escaping is the base's: once the look is taken out, the body is the base's body for this club.
    expect(withoutTheLook(root)).toBe(baseBody(await pageAnswer(slug)))
    for (const word of ['Example', 'Place', 'Street', 'Event', 'alert', 'display:none']) expect(WRITTEN_PAGE_STYLE, word).not.toContain(word)
  })

  it('leaves the redirect and the headers as they were, and gives every reader the same bytes', async () => {
    flags.pagesOn = true
    const club = await makeClub('Example Knights Club')
    await giveEverything(club.id)
    const moved = await route(club.id)
    expect([moved.status, moved.headers.location, moved.text]).toEqual([301, `/clubs/${club.slug}`, ''])
    const visitor = await route(club.slug)
    expect(visitor.headers).toEqual({ 'content-type': 'text/html; charset=utf-8' })
    const member = await seedMember({ clubId: club.id, fullName: 'Player One', email: `player.${club.m}@example.org` })
    const rep = await seedMember({ role: 'club_rep', clubId: club.id, fullName: 'Player Two', email: `player.two.${club.m}@example.org` })
    const admin = await seedAdmin()
    for (const who of [member, rep, admin]) {
      const token = accessToken(who)
      expect(await route(club.slug, { Authorization: `Bearer ${token}`, Cookie: `sb-access-token=${token}` }), who).toEqual(visitor)
    }
  })
})
