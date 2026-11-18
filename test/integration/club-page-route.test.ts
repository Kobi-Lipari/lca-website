// test/integration/club-page-route.test.ts
// GET /clubs/[id], the page the server writes before any script (WS09 step
// 23). With CLUB_PAGES_ON unset the route is today's link preview, held byte
// for byte against the base's own code (./helpers/clubPreviewBase.ts) for a
// club's id, its slug, an unknown part and a failing database, and nothing
// redirects. With it set: the fixed order (a current slug serves the page;
// an old slug, an id that is not the slug and a slug in other letters
// answer 301 to the slug on this site, the query kept, each target served);
// the head (title, description, canonical link, share card and one JSON-LD
// block, each of today's tags once); the body inside the root element, with
// only the sections that have something in them; a club's words escaped in
// the HTML and in the JSON-LD block; no email, officer or roster; the same
// bytes for every reader; and the plain shell for a reserved word, an
// unknown part, a part too long and any failure. CLUB_PAGES_ON is set and
// unset here through a getter on a mock of its module, as
// test/integration/club-page.test.ts does; no case reads how it ships.
// Every club, person and place here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import type { Env } from '../../functions/types'
import { accessToken, invoke } from './harness'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedTournament } from './factories'
import { countingDb } from './mailRuns'
import { baseClubRoute } from './helpers/clubPreviewBase'

import { onRequestGet as routeGet } from '../../functions/clubs/[id]'
import { onRequestGet as pageGet } from '../../functions/api/clubs/[id]/page'
import { PAGE_DESCRIPTION_MAX } from '../../domain/clubs/pageMeta'
import { RESERVED_SLUGS } from '../../domain/clubs/slug'

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

let made = 0
const mark = () => `${++made}${crypto.randomUUID().slice(0, 6)}`

interface Asked {
  part: string
  search?: string
  db?: D1Database
  headers?: Record<string, string>
}

/** The route's context, as Pages builds it, with the shell as the next answer. */
function contextFor({ part, search = '', db, headers = {} }: Asked) {
  return {
    request: new Request(`${SITE}/clubs/${part}${search}`, { headers }),
    env: { ...(env as unknown as Env), ...(db ? { DB: db } : {}) },
    params: { id: part },
    data: {},
    functionPath: `/clubs/${part}`,
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  } as unknown as EventContext<Env, string, Record<string, unknown>>
}

/** An answer as its status, its headers and its bytes. */
async function answerOf(res: Response) {
  return { status: res.status, headers: Object.fromEntries([...res.headers.entries()].sort()), text: await res.text() }
}
const route = async (asked: Asked) => answerOf(await routeGet(contextFor(asked)))
const base = async (asked: Asked) => answerOf(await baseClubRoute(contextFor(asked)))
const served = async (asked: Asked) => {
  const res = await route(asked)
  expect(res.status, `${asked.part} ${res.text.slice(0, 80)}`).toBe(200)
  return res.text
}

/** A made-up club with an id that is not its slug, unless the case says otherwise. */
async function makeClub(opts: { id?: string; slug?: string | null; name?: string; city?: string } = {}) {
  const m = mark()
  const id = await seedClub({ id: opts.id ?? `example-club-id-${m}`, name: opts.name ?? `Example Chess Club ${m}`, city: opts.city ?? 'Example City' })
  const slug = opts.slug === undefined ? `example-chess-club-${m}` : opts.slug
  await env.DB.prepare('UPDATE clubs SET slug = ? WHERE id = ?').bind(slug, id).run()
  return { id, slug, m }
}

/** The bare club's basics: one sentence, how it meets, a place, a contact name and a private contact email. */
async function giveBasics(clubId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE clubs SET about_text = 'A friendly made up club.', how_we_meet_text = 'Tuesdays at 7:00 PM',
            contact_name_public = 'Contact P.', contact_email = 'club.contact@example.org' WHERE id = ?`,
  ).bind(clubId).run()
  await env.DB.prepare(`INSERT INTO club_places (club_id, name, street, note, sort) VALUES (?, 'Example Library', NULL, NULL, 0)`).bind(clubId).run()
}

/** The fuller club: About in two paragraphs, cost, who is welcome, three links, two places with points, a logo and events. */
async function giveEverything(clubId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE clubs SET about_text = ?, how_we_meet_text = 'Tuesdays at 7:00 PM in the reading room', cost_text = 'Free for everyone',
            welcome_text = 'Players of every level', weekend_play = 1, scholastic_friendly = 1, region = 'Example Region',
            facebook_url = 'https://www.facebook.com/example-chess-club', website_url = 'https://www.example.org/chess', other_url = 'https://example.org/ratings',
            contact_name_public = 'Contact P.', contact_email = 'club.contact@example.org', image_url = ? WHERE id = ?`,
  ).bind('We are a made up club for players of every level.\n\nBring a board if you have one.', `/api/clubs/${clubId}/logo?v=1`, clubId).run()
  await env.DB.prepare(
    `INSERT INTO club_places (club_id, name, street, note, latitude, longitude, sort) VALUES
       (?, 'Example Library', '1 Example Street', 'Room past the front desk', 30.45, -91.18, 0),
       (?, 'Example Hall', '2 Example Avenue', NULL, 30.5, -91.2, 1)`,
  ).bind(clubId, clubId).run()
}

/** The text between two marks, or the empty string. */
const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return end < 0 ? '' : text.slice(start + from.length, end)
}
const rootOf = (html: string) => between(html, '<div id="root">', '</div>\n')
/** The written body with its wrapper's mark and its style element taken out: its words, their order and their tags. */
const plainOf = (root: string) => root.replace(/^<main data-club-written-page><style>[^<]*<\/style>/, '<main>')
const headOf = (html: string) => between(html, '<head>', '</head>')
const count = (text: string, piece: string) => text.split(piece).length - 1
const jsonLdOf = (html: string) => JSON.parse(between(html, '<script type="application/ld+json">', '</script>')) as Record<string, unknown>

describe('GET /clubs/[id] with CLUB_PAGES_ON unset', () => {
  it('with the constant unset the answer is today\'s preview byte for byte and nothing redirects', async () => {
    const club = await makeClub()
    await giveEverything(club.id)
    const plain = await makeClub({ slug: null })
    for (const part of [club.id, club.slug ?? '', plain.id, `no-such-club-${mark()}`, 'suggest', encodeURIComponent(' Example Club ')]) {
      const now = await route({ part, search: '?from=share' })
      expect(now, part).toEqual(await base({ part, search: '?from=share' }))
      expect(now.status, part).toBe(200)
      expect(now.headers.location, part).toBeUndefined()
    }
    // Today's preview finds the club by its id alone: its slug gets the plain shell, as on the base.
    expect((await route({ part: club.slug ?? '' })).text).toBe(SHELL)
    expect((await route({ part: club.id })).text).toContain('<link rel="canonical"')
  })

  it('with the constant unset a failing database gives the base\'s plain shell, and the route reads nothing new', async () => {
    const club = await makeClub()
    const { db } = countingDb({ refuse: 'FROM clubs' })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await route({ part: club.id, db })).toEqual(await base({ part: club.id, db }))
    expect((await route({ part: club.id, db })).text).toBe(SHELL)
    const { db: counted, ran } = countingDb()
    await route({ part: club.slug ?? '', db: counted })
    expect(ran.map((r) => r.sql)).toEqual(['SELECT name, city, meeting_schedule, location, description, image_url FROM clubs WHERE id = ?'])
  })
})

describe('GET /clubs/[id] with CLUB_PAGES_ON set: the head and the body', () => {
  it('a full club: title, canonical, description of at most 155 characters, JSON-LD and body', async () => {
    flags.pagesOn = true
    const club = await makeClub({ name: 'Example Chess Club Full' })
    await giveEverything(club.id)
    await seedTournament({ clubId: club.id, name: 'Example Winter Open', date: '2026-12-12' })
    await env.DB.prepare('UPDATE tournaments SET end_date = ? WHERE name = ? AND club_id = ?').bind('2026-12-13', 'Example Winter Open', club.id).run()
    await seedTournament({ clubId: club.id, name: 'Example Hidden Draft', date: '2026-12-19', isVisible: false })
    const html = await served({ part: club.slug ?? '' })
    const head = headOf(html)
    const address = `${SITE}/clubs/${club.slug}`

    expect(head).toContain('<title>Example Chess Club Full · Chess club in Example City, Louisiana · Louisiana Chess Association</title>')
    expect(head).toContain(`<link rel="canonical" href="${address}" />`)
    expect(head).toContain(`<meta property="og:url" content="${address}" />`)
    const description = /<meta\s+name="description"\s+content="([^"]*)"/.exec(head)?.[1] ?? ''
    expect(description.length).toBeGreaterThan(0)
    expect(description.length).toBeLessThanOrEqual(PAGE_DESCRIPTION_MAX)
    expect(description.startsWith('We are a made up club for players of every level.')).toBe(true)
    // The share card: the logo uploaded through the site, square, by today's rule.
    expect(head).toContain(`property="og:image" content="${SITE}/api/clubs/${club.id}/logo?v=1"`)
    expect(head).toContain('name="twitter:card" content="summary"')
    expect(head).not.toContain('og:image:width')

    const ld = jsonLdOf(html)
    expect(ld).toMatchObject({
      '@context': 'https://schema.org', '@type': 'SportsClub', name: 'Example Chess Club Full', sport: 'Chess', description, url: address,
      address: { '@type': 'PostalAddress', streetAddress: '1 Example Street', addressLocality: 'Example City', addressRegion: 'LA', addressCountry: 'US' },
      geo: { '@type': 'GeoCoordinates', latitude: 30.45, longitude: -91.18 },
      memberOf: { '@type': 'SportsOrganization', name: 'Louisiana Chess Association', url: SITE },
      sameAs: ['https://www.facebook.com/example-chess-club', 'https://www.example.org/chess', 'https://example.org/ratings'],
    })
    const events = ld.event as Array<Record<string, unknown>>
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ '@type': 'Event', name: 'Example Winter Open', startDate: '2026-12-12', endDate: '2026-12-13' })
    expect(String(events[0].url)).toMatch(new RegExp(`^${SITE}/tournaments/`))
    expect(ld).not.toHaveProperty('image')

    const body = rootOf(html)
    for (const piece of [
      '<h1>Example Chess Club Full</h1>', '<p>Chess club in Example City, Louisiana · Example Region</p>', '<p>Tuesdays at 7:00 PM in the reading room</p>',
      '<h2>About Example Chess Club Full</h2>', '<p>We are a made up club for players of every level.</p><p>Bring a board if you have one.</p>',
      '<h3>Cost</h3><p>Free for everyone</p>', '<h3>Who is welcome</h3><p>Players of every level</p><ul><li>The club plays on weekends</li><li>Scholastic friendly</li></ul>',
      '<h3>Find us online</h3>', '>Facebook</a>', '>Website: example.org</a>', '>example.org</a>',
      '<h2>When and where Example Chess Club Full meets</h2>', '<p>Example Library</p><p>1 Example Street</p><p>Room past the front desk</p>', '<p>Example Hall</p><p>2 Example Avenue</p>',
      '<h2>Events</h2>', '>Example Winter Open</a></h3><p>Sat, Dec 12, 2026 to Sun, Dec 13, 2026</p>',
    ]) expect(body, piece).toContain(piece)
    expect(body).not.toContain('Example Hidden Draft')
    expect(html).not.toContain('Example Hidden Draft')
    expect(count(body, '<h1')).toBe(1)
    // The body sits inside the root element, before the app's script.
    expect(html.search(/<div id="root"><main[\s>]/)).toBeGreaterThan(-1)
    expect(html.indexOf('</main></div>')).toBeLessThan(html.indexOf('<script type="module"'))
  })

  it('a bare club writes only its sections', async () => {
    flags.pagesOn = true
    const club = await makeClub({ name: 'Example Chess Club Bare' })
    await giveBasics(club.id)
    const html = await served({ part: club.slug ?? '' })
    expect(plainOf(rootOf(html))).toBe([
      '<main><h1>Example Chess Club Bare</h1><p>Chess club in Example City, Louisiana</p><p>Tuesdays at 7:00 PM</p>',
      '<section><h2>About Example Chess Club Bare</h2><p>A friendly made up club.</p></section>',
      '<section><h2>When and where Example Chess Club Bare meets</h2><ul><li><p>Example Library</p></li></ul></section>',
      '<section><h2>Contact</h2><p>You can send the club a message through this site. Its address stays private.</p></section></main>',
    ].join(''))
    for (const word of ['Events', 'News', 'Cost', 'Who is welcome', 'Find us online', 'not listed', 'Contact P.']) expect(rootOf(html), word).not.toContain(word)
    const ld = jsonLdOf(html)
    for (const key of ['geo', 'sameAs', 'event', 'image']) expect(ld, key).not.toHaveProperty(key)
    expect(ld.address).toEqual({ '@type': 'PostalAddress', addressLocality: 'Example City', addressRegion: 'LA', addressCountry: 'US' })
    // No logo: the share card is today's site card, with its banner's size.
    expect(headOf(html)).toContain(`property="og:image" content="${SITE}/og-default.jpg"`)
    expect(headOf(html)).toContain('property="og:image:width" content="1200"')

    // A club with nothing but its name: the h1 and the line under it, and a description from that line.
    const empty = await makeClub({ name: 'Example Chess Club Empty' })
    const emptyHtml = await served({ part: empty.slug ?? '' })
    expect(plainOf(rootOf(emptyHtml))).toBe('<main><h1>Example Chess Club Empty</h1><p>Chess club in Example City, Louisiana</p><section><h2>Contact</h2><p>You can send the club a message through this site. Its address stays private.</p></section></main>')
    expect(jsonLdOf(emptyHtml).description).toBe('Chess club in Example City, Louisiana')
  })

  it('the head carries each of today\'s preview tags once, one JSON-LD block, and nothing the site\'s policy would refuse', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await giveEverything(club.id)
    const res = await route({ part: club.slug ?? '' })
    const html = res.text
    for (const tag of [
      '<title>', 'property="og:url"', 'rel="canonical"', 'name="twitter:title"', 'name="twitter:description"', 'name="twitter:image"', 'property="og:title"',
      'property="og:description"', 'property="og:image"', 'property="og:type"', 'name="twitter:card"', 'name="description"', '<script type="application/ld+json">',
    ]) expect(count(html, tag), tag).toBe(1)
    // The only scripts are the shell's own and the JSON-LD block, which is data; the body's one style element is its wrapper's, and nothing carries a style attribute or a handler.
    expect(count(html, '<script')).toBe(count(SHELL, '<script') + 1)
    expect(plainOf(rootOf(html))).not.toMatch(/<script|<style|\sstyle=|\son[a-z]+=|javascript:/i)
    // The route adds no header of its own to the shell's.
    expect(res.headers).toEqual({ 'content-type': 'text/html; charset=utf-8' })
  })

  it('draws from the same answer as GET /api/clubs/[id]/page, asks nothing over the network, and reads no cookie', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await giveEverything(club.id)
    await seedTournament({ clubId: club.id, name: 'Example Spring Open', date: '2027-03-06' })
    const answer = await (await invoke(pageGet, { params: { id: club.slug ?? '' } })).json<{ events: Array<{ name: string; id: string }>; places: Array<{ name: string }> }>()
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const html = await served({ part: club.slug ?? '' })
    expect(fetchSpy).not.toHaveBeenCalled()
    for (const event of answer.events) expect(rootOf(html), event.name).toContain(`<a href="/tournaments/${encodeURIComponent(event.id)}">${event.name}</a>`)
    for (const place of answer.places) expect(rootOf(html), place.name).toContain(`<p>${place.name}</p>`)
    expect(answer.events.length).toBe((jsonLdOf(html).event as unknown[]).length)
  })
})

describe('GET /clubs/[id] with CLUB_PAGES_ON set: the fixed order', () => {
  it('an old slug, and an id that differs from its slug, answer 301 to the slug', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await giveBasics(club.id)
    const old = `example-old-name-${club.m}`
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(old, club.id).run()
    const slug = club.slug ?? ''
    for (const [part, search] of [[old, ''], [club.id, ''], [old, '?from=share&x=1'], [club.id, '?utm=example'], [slug.toUpperCase(), ''], [encodeURIComponent(` ${slug} `), '?a=b']]) {
      const res = await route({ part, search })
      expect([res.status, res.headers.location, res.text], part).toEqual([301, `/clubs/${slug}${search}`, ''])
      // The target, asked again, is served: nothing loops.
      const target = new URL(res.headers.location ?? '', SITE)
      expect(target.origin).toBe(SITE)
      const again = await route({ part: target.pathname.slice('/clubs/'.length), search: target.search })
      expect(again.status, part).toBe(200)
      expect(again.headers.location).toBeUndefined()
      expect(rootOf(again.text)).toContain('<h1>')
    }
  })

  it('a club whose id is its slug gets the page with status 200 and no redirect, and so does a club with no slug at its id', async () => {
    flags.pagesOn = true
    const m = mark()
    const same = await makeClub({ id: `example-same-club-${m}`, slug: `example-same-club-${m}` })
    const none = await makeClub({ slug: null })
    for (const club of [same, none]) {
      const res = await route({ part: club.id, search: '?from=share' })
      expect([res.status, res.headers.location], club.id).toEqual([200, undefined])
      expect(headOf(res.text)).toContain(`<link rel="canonical" href="${SITE}/clubs/${club.id}" />`)
    }
    // A club with no slug, asked in other letters, is sent on to its id, which is served.
    const res = await route({ part: none.id.toUpperCase() })
    expect([res.status, res.headers.location]).toEqual([301, `/clubs/${none.id}`])
  })

  it('no 301 leaves the site, whatever the address part holds', async () => {
    flags.pagesOn = true
    const m = mark()
    // A club with no slug whose id holds the signs an address could be bent with; ids are made by the slug rule, so this one is made up by hand.
    const odd = await makeClub({ id: `//evil.example.org/${m}?@x`, slug: null })
    const res = await route({ part: encodeURIComponent(odd.id.toUpperCase()), search: '?next=//evil.example.org' })
    expect(res.status).toBe(301)
    const location = res.headers.location ?? ''
    expect(location.startsWith('/clubs/')).toBe(true)
    expect(location).toBe(`/clubs/${encodeURIComponent(odd.id)}?next=//evil.example.org`)
    expect(new URL(location, SITE).origin).toBe(SITE)
    for (const part of ['%2F%2Fevil.example.org', 'https:%2F%2Fevil.example.org', '%5C%5Cevil.example.org', 'javascript:alert(1)']) {
      const plain = await route({ part })
      expect([plain.status, plain.headers.location, plain.text], part).toEqual([200, undefined, SHELL])
    }
  })

  it('a reserved word, an unknown part, a part too long and a failing database give the plain shell', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await giveBasics(club.id)
    for (const part of [...RESERVED_SLUGS, 'SUGGEST', `no-such-club-${mark()}`, 'x'.repeat(201), '%E0%A4%A', '']) {
      const res = await route({ part })
      expect([res.status, res.headers.location, res.text], part.slice(0, 20)).toEqual([200, undefined, SHELL])
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const refuse of ['FROM clubs', 'FROM club_places', 'FROM tournaments', 'FROM club_news']) {
      const { db } = countingDb({ refuse })
      const res = await route({ part: club.slug ?? '', db })
      expect([res.status, res.text], refuse).toEqual([200, SHELL])
    }
  })
})

describe('GET /clubs/[id] with CLUB_PAGES_ON set: never on a club page', () => {
  it('markup typed into every field comes out escaped', async () => {
    flags.pagesOn = true
    const BAD = '<b>"x"</b> & \'y\' </script><script>alert(1)</script> player.one@example.org \u2028 <!--'
    const club = await makeClub({ name: `Example Chess Club ${BAD}`, city: `Example City ${BAD}` })
    await env.DB.prepare(
      `UPDATE clubs SET about_text = ?, how_we_meet_text = ?, cost_text = ?, welcome_text = ?, region = ?,
              facebook_url = ?, website_url = ?, other_url = ? WHERE id = ?`,
    ).bind(
      `About ${BAD}`, `Statement ${BAD}`, `Cost ${BAD}`, `Welcome ${BAD}`, `Region ${BAD}`,
      `https://example.org/a?q=<script>&r="x"`, `https://example.org/b'onmouseover='alert(1)`, `https://user@example.org/c`, club.id,
    ).run()
    await env.DB.prepare(`INSERT INTO club_places (club_id, name, street, note, latitude, longitude, sort) VALUES (?, ?, ?, ?, 30.4, -91.1, 0)`)
      .bind(club.id, `Place ${BAD}`, `Street ${BAD}`, `Note ${BAD}`).run()
    await seedTournament({ clubId: club.id, name: `Event ${BAD}`, date: '2026-12-05' })
    const html = await served({ part: club.slug ?? '' })

    // The body and the head hold no tag a club typed: every sign of markup is escaped where it lands.
    const root = rootOf(html)
    expect(root).not.toMatch(/<b>|<\/script>|<script>|<!--/)
    for (const field of ['Example Chess Club', 'Example City', 'About', 'Statement', 'Cost', 'Welcome', 'Region', 'Place', 'Street', 'Note', 'Event']) {
      expect(root, field).toContain(`${field} &lt;b&gt;&quot;x&quot;&lt;/b&gt; &amp; &#39;y&#39; &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt; player.one@example.org`)
    }
    expect(root).toContain('href="https://example.org/a?q=&lt;script&gt;&amp;r=&quot;x&quot;"')
    expect(root).toContain('href="https://example.org/b&#39;onmouseover=&#39;alert(1)"')
    // A link with a name before the "@" is not drawn, as the site's page draws it.
    expect(html).not.toContain('user@example.org')
    // Outside every quoted attribute value no tag a club typed is left; inside one, the quote mark is escaped, so none ends early.
    const outsideValues = html.replace(/="[^"]*"/g, '=""')
    expect(count(outsideValues, '</script>')).toBe(count(SHELL, '</script>') + 1)
    expect(outsideValues).not.toMatch(/<b>|<script>alert|<!--\./)
    expect(count(outsideValues, '<meta')).toBe(count(SHELL, '<meta') + 4)

    // The JSON-LD block: no "<", ">" or "&" and no line separator inside it, and every value read back as typed.
    const block = between(html, '<script type="application/ld+json">', '</script>')
    expect(block).not.toMatch(/[<>&\u2028\u2029]/)
    const ld = JSON.parse(block) as { name: string; address: { addressLocality: string; streetAddress: string }; event: Array<{ name: string }>; sameAs: string[] }
    expect(ld.name).toBe(`Example Chess Club ${BAD}`)
    expect(ld.address.addressLocality).toBe(`Example City ${BAD}`)
    expect(ld.address.streetAddress).toBe(`Street ${BAD}`)
    expect(ld.event[0].name).toBe(`Event ${BAD}`)
    expect(ld.sameAs).toEqual(['https://example.org/a?q=<script>&r="x"', 'https://example.org/b\'onmouseover=\'alert(1)'])
  })

  it('no contact email in the HTML, no officer and no roster, and the same bytes for every reader', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await giveEverything(club.id)
    const m = mark()
    const rep = await seedMember({ role: 'club_rep', clubId: club.id, fullName: 'Rita Sample', email: `rita.${m}@example.org` })
    const member = await seedMember({ clubId: club.id, fullName: 'Player One', email: `player.${m}@example.org` })
    const admin = await seedAdmin()
    await env.DB.prepare(`INSERT INTO club_officers (id, club_id, member_id, role) VALUES (?, ?, ?, 'President')`).bind(`officer-${m}`, club.id, rep).run()
    const event = await seedTournament({ clubId: club.id, name: 'Example Roster Open', date: '2026-12-05' })
    await seedRegistration({ tournamentId: event, memberId: member })

    const visitor = await route({ part: club.slug ?? '' })
    expect(visitor.status).toBe(200)
    for (const piece of ['club.contact@example.org', `rita.${m}@example.org`, `player.${m}@example.org`, 'Rita Sample', 'Player One', 'President', 'mailto:']) {
      expect(visitor.text, piece).not.toContain(piece)
    }
    for (const who of [member, rep, admin]) {
      const token = accessToken(who)
      const signedIn = await route({ part: club.slug ?? '', headers: { Authorization: `Bearer ${token}`, Cookie: `sb-access-token=${token}` } })
      expect(signedIn, who).toEqual(visitor)
    }
  })
})
