// test/integration/club-page-route-edges.test.ts
// The edges of GET /clubs/[id] with CLUB_PAGES_ON set (WS09 step 23), beside
// club-page-route.test.ts: the fixed order where addresses collide (the route
// finds the club GET /api/clubs/[id]/page finds, and every 301's target is
// served), dates in America/Chicago across both clock changes and a year's
// end, an event with no end date, events on the same day, empty and stale
// data (a place with no point, blank words, links the page would not draw, a
// logo that is not ours), the plain-language rules, replays and concurrent
// reads, and the head's title and attributes under typed markup. The
// constant is set through a getter on a mock of its module. Every club,
// person and place here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import type { Env } from '../../functions/types'
import { invoke } from './harness'
import { seedClub, seedMember, seedRegistration, seedTournament } from './factories'

import { onRequestGet as routeGet } from '../../functions/clubs/[id]'
import { onRequestGet as pageGet } from '../../functions/api/clubs/[id]/page'
import { eventDates } from '../../domain/clubs/pageWords'

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

let made = 0
const mark = () => `${++made}${crypto.randomUUID().slice(0, 6)}`

function contextFor(part: string, search = '') {
  return {
    request: new Request(`${SITE}/clubs/${part}${search}`),
    env: env as unknown as Env,
    params: { id: part },
    data: {},
    functionPath: `/clubs/${part}`,
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  } as unknown as EventContext<Env, string, Record<string, unknown>>
}

async function route(part: string, search = '') {
  const res = await routeGet(contextFor(part, search))
  return { status: res.status, location: res.headers.get('location'), text: await res.text() }
}

async function makeClub(opts: { id?: string; slug?: string | null; name?: string; city?: string } = {}) {
  const m = mark()
  const id = await seedClub({ id: opts.id ?? `example-club-id-${m}`, name: opts.name ?? `Example Chess Club ${m}`, city: opts.city ?? 'Example City' })
  const slug = opts.slug === undefined ? `example-chess-club-${m}` : opts.slug
  await env.DB.prepare('UPDATE clubs SET slug = ? WHERE id = ?').bind(slug, id).run()
  return { id, slug, m }
}

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
interface JsonLd {
  url: string
  name: string
  description: string
  address: { streetAddress?: string; addressLocality?: string }
  geo?: unknown
  event?: Array<Record<string, string>>
  [key: string]: unknown
}
const jsonLdOf = (html: string) => JSON.parse(between(html, '<script type="application/ld+json">', '</script>')) as JsonLd

/** The club GET /api/clubs/[id]/page finds for an address part, or null. */
async function endpointClub(part: string): Promise<string | null> {
  const res = await invoke(pageGet, { params: { id: part } })
  if (res.status !== 200) return null
  return (await res.json<{ club: { id: string } }>()).club.id
}

/** The club the route serves, or sends the browser on to, for an address part, with the page it ends on. */
async function routeClub(part: string, search = ''): Promise<{ slug: string; redirected: boolean }> {
  const first = await route(part, search)
  if (first.status === 200) return { slug: jsonLdOf(first.text).url.replace(`${SITE}/clubs/`, ''), redirected: false }
  expect(first.status).toBe(301)
  const target = (first.location ?? '').replace('/clubs/', '')
  const again = await route(decodeURIComponent(target), search)
  // The target of every 301, asked again, is served and does not send the browser on.
  expect([again.status, again.location], part).toEqual([200, null])
  return { slug: decodeURIComponent(target), redirected: true }
}

describe('the fixed order where addresses collide', () => {
  it('finds the club the page\'s endpoint finds, and every 301 ends on a served page', async () => {
    flags.pagesOn = true
    const m = mark()
    const shared = `example-shared-${m}`
    // One address part that is a club's current slug, another club's id and a third club's old slug.
    const bySlug = await makeClub({ slug: shared })
    const byId = await makeClub({ id: shared })
    const byOld = await makeClub()
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(shared, byOld.id).run()
    // An old slug that is another club's id: the old slug wins over the id.
    const idOnly = await makeClub({ id: `example-id-only-${m}`, slug: null })
    const oldOverId = await makeClub()
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(idOnly.id, oldOverId.id).run()
    // A slug a club has gone back to: the history names it, and the current slug still wins.
    const back = await makeClub()
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(back.slug, back.id).run()

    const expected: Array<[string, string]> = [
      [shared, bySlug.id],
      [byId.slug ?? byId.id, byId.id],
      [idOnly.id, oldOverId.id],
      [back.slug ?? '', back.id],
    ]
    for (const [part, id] of expected) {
      expect(await endpointClub(part), part).toBe(id)
      const found = await routeClub(part)
      const owner = (await env.DB.prepare('SELECT id FROM clubs WHERE slug = ?').bind(found.slug).first<{ id: string }>())?.id ?? found.slug
      expect(owner, part).toBe(id)
    }
    // The current slug serves with no redirect, though the history names it too.
    expect((await routeClub(back.slug ?? '')).redirected).toBe(false)
    expect((await routeClub(shared)).redirected).toBe(false)
    // The club whose id is the shared word is reached at its own slug, which is its address.
    expect((await routeClub(byId.slug ?? '')).redirected).toBe(false)
  })

  it('keeps the query exactly as it came on every 301, and adds none to a page that is served', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const old = `example-old-${club.m}`
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(old, club.id).run()
    const search = '?q=a%20b&q=c&flag&e=%E2%9C%93&url=https%3A%2F%2Fexample.org%2F%3Fx%3D1'
    for (const part of [old, club.id]) {
      const res = await route(part, search)
      expect([res.status, res.location, res.text]).toEqual([301, `/clubs/${club.slug}${search}`, ''])
    }
    expect((await route(club.slug ?? '', search)).location).toBeNull()
  })

  it('a 301 is kept by a browser for a day at most, so two slugs a keeper swaps back cannot send a browser round in a loop', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const old = `example-old-${club.m}`
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(old, club.id).run()
    for (const part of [old, club.id]) {
      const res = await routeGet(contextFor(part))
      expect(res.status).toBe(301)
      expect(res.headers.get('cache-control')).toBe('max-age=86400')
    }
    // A served page adds no Cache-Control of its own: the day's lifetime is the 301's alone.
    const served = await routeGet(contextFor(club.slug ?? ''))
    expect(served.status).toBe(200)
    expect(served.headers.get('cache-control')).toBeNull()
  })

  it('asks the shell without the reader\'s validators and serves the page with none of the shell\'s, so a changed page is never answered as unchanged', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const asked: Request[] = []
    const context = contextFor(club.slug ?? '') as unknown as { request: Request; next: (input?: Request) => Promise<Response> }
    context.request = new Request(`${SITE}/clubs/${club.slug}`, {
      headers: { 'If-None-Match': '"example-shell-tag"', 'If-Modified-Since': 'Sat, 24 Oct 2026 19:00:00 GMT', Accept: 'text/html' },
    })
    context.next = async (input?: Request) => {
      if (input) asked.push(input)
      return new Response(SHELL, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8', ETag: '"example-shell-tag"', 'Last-Modified': 'Sat, 24 Oct 2026 19:00:00 GMT' },
      })
    }
    const res = await routeGet(context as unknown as EventContext<Env, string, Record<string, unknown>>)
    expect(res.status).toBe(200)
    expect([res.headers.get('etag'), res.headers.get('last-modified')]).toEqual([null, null])
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await res.text()).toContain('<script type="application/ld+json">')
    expect(asked).toHaveLength(1)
    expect([asked[0].headers.get('if-none-match'), asked[0].headers.get('if-modified-since')]).toEqual([null, null])
    // The reader's other headers and its address go on to the shell as they came.
    expect([asked[0].url, asked[0].headers.get('accept')]).toEqual([`${SITE}/clubs/${club.slug}`, 'text/html'])
  })

  it('a reserved word that is also a club\'s id or old slug gives the plain shell, never a page or a 301', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await env.DB.prepare('INSERT OR IGNORE INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind('suggest', club.id).run()
    const res = await route('suggest')
    expect([res.status, res.location, res.text]).toEqual([200, null, SHELL])
  })
})

describe('replays and concurrent reads', () => {
  it('the same address asked again, and asked at once, answers the same bytes', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await env.DB.prepare(`UPDATE clubs SET about_text = 'A friendly made up club.', how_we_meet_text = 'Tuesdays at 7:00 PM' WHERE id = ?`).bind(club.id).run()
    await seedTournament({ clubId: club.id, name: 'Example Open', date: '2026-12-12' })
    const old = `example-old-${club.m}`
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(old, club.id).run()

    const once = await route(club.slug ?? '')
    const moved = await route(old, '?a=1')
    const runs = await Promise.all(Array.from({ length: 6 }, (_, i) => (i % 2 === 0 ? route(club.slug ?? '') : route(old, '?a=1'))))
    runs.forEach((run, i) => expect(run, `run ${i}`).toEqual(i % 2 === 0 ? once : moved))
    expect(await route(club.slug ?? '')).toEqual(once)
    expect(moved.status).toBe(301)
  })
})

describe('events and their dates', () => {
  it('writes a weekday on every full date, in Central time, across both clock changes and a year\'s end, with no end date and with one', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const events: Array<[string, string, string | null, string]> = [
      ['Example Fall Back Open', '2026-11-01', null, 'Sun, Nov 1, 2026'],
      ['Example Spring Forward Open', '2027-03-14', '2027-03-15', 'Sun, Mar 14, 2027 to Mon, Mar 15, 2027'],
      ['Example New Year Open', '2026-12-31', '2027-01-01', 'Thu, Dec 31, 2026 to Fri, Jan 1, 2027'],
      ['Example One Day Open', '2026-11-08', '2026-11-08', 'Sun, Nov 8, 2026'],
      ['Example Leap Day Open', '2028-02-29', null, 'Tue, Feb 29, 2028'],
    ]
    for (const [name, date, end] of events) {
      const id = await seedTournament({ clubId: club.id, name, date })
      if (end) await env.DB.prepare('UPDATE tournaments SET end_date = ? WHERE id = ?').bind(end, id).run()
    }
    const html = (await route(club.slug ?? '')).text
    for (const [name, , , words] of events) expect(rootOf(html), name).toContain(`>${name}</a></h3><p>${words}</p>`)
    // Every date in the body carries its weekday; none is written as a bare number or an ISO date.
    expect(rootOf(html)).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    const ld = jsonLdOf(html).event ?? []
    const byName = Object.fromEntries(ld.map((e) => [e.name, e]))
    expect(byName['Example Fall Back Open']).not.toHaveProperty('endDate')
    expect(byName['Example Leap Day Open']).not.toHaveProperty('endDate')
    expect(byName['Example One Day Open'].endDate).toBe('2026-11-08')
    expect(byName['Example New Year Open']).toMatchObject({ startDate: '2026-12-31', endDate: '2027-01-01' })
  })

  it('reads a stored instant as its Louisiana day: just after midnight and just before it, in winter and summer time', () => {
    const day = (value: string) => eventDates({ date: value, end_date: null })
    // 2026-11-02 05:59 UTC is 11:59 PM Central on Sunday, November 1; 06:01 UTC is Monday.
    expect(day('2026-11-02T05:59:00Z')).toBe('Sun, Nov 1, 2026')
    expect(day('2026-11-02T06:01:00Z')).toBe('Mon, Nov 2, 2026')
    // Summer time: 2026-07-05 04:59 UTC is 11:59 PM Central on Saturday, July 4.
    expect(day('2026-07-05T04:59:00Z')).toBe('Sat, Jul 4, 2026')
    expect(day('2026-07-05T05:01:00Z')).toBe('Sun, Jul 5, 2026')
    // A stored day with a wall-clock time is read as written.
    expect(day('2026-11-01T00:00')).toBe('Sun, Nov 1, 2026')
    expect(day('2027-03-14T02:30')).toBe('Sun, Mar 14, 2027')
  })

  it('lists events on the same day in the endpoint\'s order, and writes the same list in the body and the JSON-LD block', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const m = mark()
    for (const suffix of ['c', 'a', 'b']) await seedTournament({ id: `example-tie-${m}-${suffix}`, clubId: club.id, name: `Example Tie ${suffix}`, date: '2026-12-12' })
    await seedTournament({ clubId: club.id, name: 'Example Later Open', date: '2027-01-09' })
    await seedTournament({ clubId: club.id, name: 'Example Old Open', date: '2019-05-04' })
    const html = (await route(club.slug ?? '')).text
    const answer = await (await invoke(pageGet, { params: { id: club.slug ?? '' } })).json<{ events: Array<{ name: string }> }>()
    const inBody = [...rootOf(html).matchAll(/<h3><a [^>]*>([^<]*)<\/a><\/h3>/g)].map((x) => x[1])
    expect(inBody).toEqual(answer.events.map((e) => e.name))
    expect((jsonLdOf(html).event as Array<{ name: string }>).map((e) => e.name)).toEqual(inBody)
    // Same day: by the event's id, so a replay never reorders them.
    expect(inBody.filter((n) => n.startsWith('Example Tie '))).toEqual(['Example Tie a', 'Example Tie b', 'Example Tie c'])
  })

  it('writes no Events section and no event data for a club whose only event is hidden', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await seedTournament({ clubId: club.id, name: 'Example Hidden Draft', date: '2026-12-19', isVisible: false })
    const html = (await route(club.slug ?? '')).text
    expect(rootOf(html)).not.toContain('Events')
    expect(html).not.toContain('Example Hidden Draft')
    expect(jsonLdOf(html)).not.toHaveProperty('event')
  })

  it('writes no Register link, no count and no seats for an event that takes entries', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const event = await seedTournament({ clubId: club.id, name: 'Example Entry Open', date: '2026-12-12', maxPlayers: 30, registrationStatus: 'open' })
    for (const name of ['Player One', 'Player Two']) {
      const member = await seedMember({ clubId: club.id, fullName: name, email: `${name.replace(' ', '.').toLowerCase()}.${mark()}@example.org` })
      await seedRegistration({ tournamentId: event, memberId: member })
    }
    const html = (await route(club.slug ?? '')).text
    expect(rootOf(html)).toContain('Example Entry Open')
    for (const word of ['Register', 'register', 'spot', 'seat', 'full', 'waitlist', 'of 30', 'Player One', 'Player Two']) expect(html, word).not.toContain(word)
    expect(JSON.stringify(jsonLdOf(html))).not.toMatch(/offers|maximumAttendeeCapacity|remainingAttendeeCapacity/)
  })
})

describe('empty and stale data', () => {
  it('writes the address and the point from the first place that has each, and nothing from a place with half of one', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await env.DB.prepare(
      `INSERT INTO club_places (club_id, name, street, note, latitude, longitude, sort) VALUES
         (?, 'Example Library', '   ', NULL, 30.5, NULL, 0),
         (?, 'Example Hall', '2 Example Avenue', '   ', NULL, -91.2, 1)`,
    ).bind(club.id, club.id).run()
    let ld = jsonLdOf((await route(club.slug ?? '')).text)
    expect(ld.address.streetAddress).toBe('2 Example Avenue')
    expect(ld).not.toHaveProperty('geo')
    const html = (await route(club.slug ?? '')).text
    // A blank street and a blank note write no line.
    expect(rootOf(html)).toContain('<li><p>Example Library</p></li>')
    expect(rootOf(html)).toContain('<li><p>Example Hall</p><p>2 Example Avenue</p></li>')

    await env.DB.prepare(`UPDATE club_places SET latitude = 30.4, longitude = -91.1 WHERE club_id = ? AND name = 'Example Hall'`).bind(club.id).run()
    ld = jsonLdOf((await route(club.slug ?? '')).text)
    expect(ld.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 30.4, longitude: -91.1 })
  })

  it('writes no section, no heading and no sameAs for words that are only spaces and links the page would not draw', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await env.DB.prepare(
      `UPDATE clubs SET about_text = '  \n \n ', how_we_meet_text = '   ', cost_text = ' ', welcome_text = '', region = '  ',
              facebook_url = 'ftp://example.org/chess', website_url = 'javascript:alert(1)', other_url = 'https://user:secret@example.org/chess' WHERE id = ?`,
    ).bind(club.id).run()
    const html = (await route(club.slug ?? '')).text
    expect(plainOf(rootOf(html))).toBe(`<main><h1>${(await env.DB.prepare('SELECT name FROM clubs WHERE id = ?').bind(club.id).first<{ name: string }>())?.name}</h1><p>Chess club in Example City, Louisiana</p></main>`)
    expect(html).not.toMatch(/secret|javascript:|ftp:/)
    const ld = jsonLdOf(html)
    expect(ld).not.toHaveProperty('sameAs')
    expect(ld.description).toBe('Chess club in Example City, Louisiana')
  })

  it('writes no empty section under any shape of club, and one h1', async () => {
    flags.pagesOn = true
    const shapes: string[] = []
    const tweak = [
      `about_text = 'About words.'`,
      `how_we_meet_text = 'Tuesdays at 7:00 PM'`,
      `cost_text = 'Free'`,
      `welcome_text = 'Everyone'`,
      `weekend_play = 1`,
      `scholastic_friendly = 1`,
      `website_url = 'https://example.org'`,
      `region = 'Example Region'`,
    ]
    for (let mask = 0; mask < 32; mask++) {
      const club = await makeClub()
      const sets = tweak.filter((_, i) => (mask >> (i % 5)) & 1 && (i < 5 || mask & 1))
      if (sets.length) await env.DB.prepare(`UPDATE clubs SET ${sets.join(', ')} WHERE id = ?`).bind(club.id).run()
      if (mask & 2) await env.DB.prepare(`INSERT INTO club_places (club_id, name, sort) VALUES (?, 'Example Library', 0)`).bind(club.id).run()
      if (mask & 4) await seedTournament({ clubId: club.id, name: 'Example Open', date: '2026-12-12' })
      shapes.push((await route(club.slug ?? '')).text)
    }
    for (const html of shapes) {
      const root = rootOf(html)
      expect(count(root, '<h1>')).toBe(1)
      expect(root).not.toMatch(/<h2>[^<]*<\/h2>(<\/section>|<\/main>)/)
      expect(root).not.toMatch(/<h3>[^<]*<\/h3>(<\/section>|<\/main>|<h3>)/)
      expect(root).not.toMatch(/<(p|li|ul|section)><\/\1>/)
      expect(root).not.toMatch(/null|undefined|not listed/)
      expect(count(html, '<script type="application/ld+json">')).toBe(1)
    }
  })

  it('draws a logo only when it is one the site stored, and writes a logo path that holds a quote mark as an attribute value', async () => {
    flags.pagesOn = true
    const external = await makeClub()
    await env.DB.prepare('UPDATE clubs SET image_url = ? WHERE id = ?').bind('https://images.example.org/logo.png', external.id).run()
    const head = headOf((await route(external.slug ?? '')).text)
    expect(head).toContain(`property="og:image" content="${SITE}/og-default.jpg"`)
    expect(head).not.toContain('images.example.org')

    const odd = await makeClub()
    await env.DB.prepare('UPDATE clubs SET image_url = ? WHERE id = ?').bind('/api/clubs/x"><script>alert(1)</script>/logo', odd.id).run()
    const html = (await route(odd.slug ?? '')).text
    expect(html.replace(/="[^"]*"/g, '=""')).not.toMatch(/<script>alert/)
    expect(count(headOf(html), 'property="og:image"')).toBe(1)
  })
})

describe('the head under typed markup', () => {
  it('keeps one title element and writes no tag out of the title, the card or the description', async () => {
    flags.pagesOn = true
    const name = 'Tom & Jerry <i>Chess</i> </title><img src=x onerror=alert(1)> "Club"'
    const club = await makeClub({ name, city: 'Example City </title><b>' })
    await env.DB.prepare(`UPDATE clubs SET about_text = ? WHERE id = ?`).bind('Words </title><img src=y onerror=alert(2)> & more "quoted"', club.id).run()
    const html = (await route(club.slug ?? '')).text
    const head = headOf(html)
    expect(count(head, '<title>')).toBe(1)
    // Outside the quoted attribute values, the head holds one title element and no tag a club typed.
    const outside = head.replace(/="[^"]*"/g, '=""')
    expect(count(outside, '</title>')).toBe(1)
    expect(outside).not.toContain('<img')
    expect(head).toContain('<title>Tom &amp; Jerry Chess "Club" · Chess club in Example City, Louisiana · Louisiana Chess Association</title>')
    const block = between(html, '<script type="application/ld+json">', '</script>')
    expect(block).not.toMatch(/[<>&]/)
    expect(html.replace(block, '').replace(/="[^"]*"/g, '=""')).not.toMatch(/<img/)
    expect(jsonLdOf(html).name).toBe(name)
  })

  it('writes og:title and og:description as attribute text: "<", ">" and "&" escaped, so a crawler reads back what the club typed', async () => {
    flags.pagesOn = true
    const typed = 'Example Chess &amp; Friends <b>1</b>'
    const club = await makeClub({ name: typed })
    await env.DB.prepare('UPDATE clubs SET about_text = ? WHERE id = ?').bind('Rated &amp; casual play, 5 < 6.', club.id).run()
    const head = headOf((await route(club.slug ?? '')).text)
    const read = (raw: string) => raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    const title = /property="og:title"\s+content="([^"]*)"/.exec(head)?.[1] ?? ''
    expect(title).not.toMatch(/[<>]/)
    expect(read(title)).toBe(typed)
    const description = /property="og:description"\s+content="([^"]*)"/.exec(head)?.[1] ?? ''
    expect(description).not.toMatch(/[<>]/)
    expect(read(description)).toBe('Rated &amp; casual play, 5 < 6.')
  })
})

describe('the plain-language rules on the written page', () => {
  it('says "US Chess", writes times as 7:00 PM, and has no long dash, none of the old initials and no half written as .5', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await env.DB.prepare(
      `UPDATE clubs SET about_text = 'We play rated games reported to US Chess.', how_we_meet_text = 'Tuesdays at 7:00 PM',
              other_url = 'https://new.uschess.org/clubs/example', region = 'Example Region' WHERE id = ?`,
    ).bind(club.id).run()
    await env.DB.prepare(`INSERT INTO club_places (club_id, name, street, sort) VALUES (?, 'Example Library', '1 Example Street', 0)`).bind(club.id).run()
    const id = await seedTournament({ clubId: club.id, name: 'Example Winter Open', date: '2026-12-12' })
    await env.DB.prepare('UPDATE tournaments SET end_date = ? WHERE id = ?').bind('2026-12-13', id).run()
    const html = (await route(club.slug ?? '')).text
    const written = html.slice(html.indexOf('<h1>'), html.indexOf('</main>'))
    expect(written).toContain('US Chess')
    expect(written).toContain('Tuesdays at 7:00 PM')
    // The old initials for US Chess, written so this file does not carry them.
    expect(html).not.toMatch(/US[C]F/)
    expect(html.slice(html.indexOf('<title>'), html.indexOf('</head>'))).not.toMatch(/[\u2013\u2014]/)
    expect(written).not.toMatch(/[\u2013\u2014]/)
    expect(written).not.toMatch(/\d\.5\b/)
  })
})
