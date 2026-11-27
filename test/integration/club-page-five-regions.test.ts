// test/integration/club-page-five-regions.test.ts
// The public club page (WS09 checkpoint W) read through the five regions main
// took in (migration 0072, domain/clubs/regions.ts). Where the two sides'
// code meets: a club in each of the five regions, a regional seat that covers
// that region alone, and the page's answer and the page the server writes.
// - with CLUB_PAGES_ON and CLUB_KEEPERS_ON as shipped (both unset here) every
//   reader, the region's own representative included, gets the one 404 and
//   never the page, whatever the region;
// - with only CLUB_KEEPERS_ON set the representative of a region reads the
//   clubs of that region and no other, for all five names, including the
//   names with a slash;
// - with CLUB_PAGES_ON set the answer carries the region as written, and the
//   page the server writes has the line under the club's name exactly once,
//   with the region as written, the slash and all, and never null or
//   undefined;
// - a club with no region, or one the list does not hold, still gets a page
//   with no region on its line.
// Both constants are set and unset through getters on a mock of their module,
// as test/integration/club-page.test.ts does; no case reads how they ship.
// Every club, person and place here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import type { Env } from '../../functions/types'
import { invoke } from './harness'
import { seedClub, seedMember } from './factories'

import { onRequestGet as pageGet, CLUB_PAGE_NOT_FOUND } from '../../functions/api/clubs/[id]/page'
import { onRequestGet as routeGet } from '../../functions/clubs/[id]'
import { REGIONS, isRegion } from '../../domain/clubs/regions'
import { cityLine } from '../../domain/clubs/pageWords'

const flags = vi.hoisted(() => ({ pagesOn: false, keepersOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})
afterEach(() => {
  flags.pagesOn = false
  flags.keepersOn = false
})

const SHELL = '<!doctype html><html><head><title>Example shell</title></head><body><div id="root"></div></body></html>'
const SITE = 'https://www.example.org'
const NOT_FOUND_BODY = JSON.stringify({ error: CLUB_PAGE_NOT_FOUND })

let made = 0
const mark = () => `${++made}${crypto.randomUUID().slice(0, 6)}`

/** A made-up club with a page address and the region given, and the five basics. */
async function makeClub(region: string | null, city = 'Example City') {
  const m = mark()
  const id = await seedClub({ name: `Example Chess Club ${m}`, city })
  const slug = `example-chess-club-${m}`
  await env.DB.prepare(
    `UPDATE clubs SET slug = ?, region = ?, about_text = 'A friendly made up club.', how_we_meet_text = 'Tuesdays at 7:00 PM',
            contact_name_public = 'Contact P.', contact_email = 'club.contact@example.org' WHERE id = ?`,
  ).bind(slug, region, id).run()
  await env.DB.prepare(`INSERT INTO club_places (club_id, name, street, note, sort) VALUES (?, 'Example Library', '1 Example Street', NULL, 0)`).bind(id).run()
  return { id, slug, name: `Example Chess Club ${m}` }
}

/** A person holding a regional seat that covers the given regions alone. */
async function representativeOf(regions: string[]): Promise<string> {
  const m = mark()
  const memberId = await seedMember({ fullName: 'Player Three', email: `player.three.${m}@example.org` })
  const seat = `seat-${m}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  for (const region of regions) await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, memberId).run()
  return memberId
}

const ask = async (who: string | undefined, address: string) => {
  const res = await invoke(pageGet, { ...(who ? { as: who } : {}), params: { id: address } })
  return { status: res.status, body: await res.response.clone().text(), cache: res.response.headers.get('Cache-Control') }
}

async function written(part: string): Promise<{ status: number; text: string }> {
  const ctx = {
    request: new Request(`${SITE}/clubs/${part}`),
    env: env as unknown as Env,
    params: { id: part },
    data: {},
    functionPath: `/clubs/${part}`,
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  } as unknown as EventContext<Env, string, Record<string, unknown>>
  const res = await routeGet(ctx)
  return { status: res.status, text: await res.text() }
}

describe('the club page and the five regions: as shipped', () => {
  it('the list holds the five names the regional seats carry, and nothing else', () => {
    expect([...REGIONS]).toEqual([
      'New Orleans Metro',
      'Baton Rouge / East Central',
      'Lafayette / South Central',
      'Lake Charles / Southwestern',
      'North Louisiana',
    ])
    for (const gone of ['Central Louisiana', 'North of Lake Pontchartrain', 'Southwest Louisiana', 'South Central Louisiana', 'Bayou Region']) {
      expect(isRegion(gone), gone).toBe(false)
    }
  })

  it('with both constants unset a visitor, a member and the region\'s own representative get the one 404 for a club of each region, and never the page', async () => {
    for (const region of REGIONS) {
      const club = await makeClub(region)
      const representative = await representativeOf([region])
      const member = await seedMember({ clubId: club.id, fullName: 'Player One', email: `player.${mark()}@example.org` })
      for (const who of [undefined, member, representative]) {
        for (const address of [club.slug, club.id]) {
          const res = await ask(who, address)
          expect([res.status, res.body, res.cache], `${region} ${who} ${address}`).toEqual([404, NOT_FOUND_BODY, 'no-store'])
        }
      }
    }
  })

  it('with both constants unset the page the server writes is the plain shell for a club of each region: no club name, no region', async () => {
    for (const region of REGIONS) {
      const club = await makeClub(region)
      const res = await written(club.slug)
      expect(res.status, region).toBe(200)
      expect(res.text, region).not.toContain(club.name)
      expect(res.text, region).not.toContain(region)
      expect(res.text, region).not.toContain('Chess club in Example City, Louisiana')
    }
  })
})

describe('the club page and the five regions: who may read, with only CLUB_KEEPERS_ON set', () => {
  it('a region\'s representative reads a club of that region, for each of the five names, and a representative of another region gets the 404', async () => {
    flags.keepersOn = true
    for (const [index, region] of REGIONS.entries()) {
      const club = await makeClub(region)
      const own = await representativeOf([region])
      const elsewhere = await representativeOf([REGIONS[(index + 1) % REGIONS.length]])
      const missing = await ask(undefined, `no-such-club-${mark()}`)
      expect(missing.status).toBe(404)
      for (const address of [club.slug, club.id]) {
        const res = await ask(own, address)
        expect([res.status, res.cache], `${region} ${address}`).toEqual([200, 'no-store'])
        expect(JSON.parse(res.body).club.region, region).toBe(region)
        expect(await ask(elsewhere, address), `${region} ${address}`).toEqual(missing)
        expect(await ask(undefined, address), `${region} ${address}`).toEqual(missing)
      }
    }
  })

  it('a seat that covers two regions reads the clubs of both and not a third', async () => {
    flags.keepersOn = true
    const both = await representativeOf([REGIONS[0], REGIONS[1]])
    const first = await makeClub(REGIONS[0])
    const second = await makeClub(REGIONS[1])
    const third = await makeClub(REGIONS[4])
    const missing = await ask(undefined, `no-such-club-${mark()}`)
    expect((await ask(both, first.slug)).status).toBe(200)
    expect((await ask(both, second.slug)).status).toBe(200)
    expect(await ask(both, third.slug)).toEqual(missing)
  })

  it('a seat still filed under a name that is gone reads no club of the five, and no club filed under that old name is read by a seat of the five', async () => {
    flags.keepersOn = true
    const missing = await ask(undefined, `no-such-club-${mark()}`)
    const oldSeat = await representativeOf(['Bayou Region'])
    const newSeat = await representativeOf([REGIONS[2]])
    const oldClub = await makeClub('Bayou Region')
    const newClub = await makeClub(REGIONS[2])
    expect(await ask(oldSeat, newClub.slug)).toEqual(missing)
    expect(await ask(newSeat, oldClub.slug)).toEqual(missing)
  })
})

describe('the club page and the five regions: with CLUB_PAGES_ON set', () => {
  it('the answer carries the region as written for each of the five, the same bytes for a visitor and for the region\'s representative', async () => {
    flags.pagesOn = true
    for (const region of REGIONS) {
      const club = await makeClub(region)
      const representative = await representativeOf([region])
      const visitor = await ask(undefined, club.slug)
      expect(visitor.status, region).toBe(200)
      expect(JSON.parse(visitor.body).club.region, region).toBe(region)
      expect(await ask(representative, club.slug), region).toEqual(visitor)
    }
  })

  it('the page the server writes says the region once on the line under the club\'s name, escaped as text, for each of the five', async () => {
    flags.pagesOn = true
    for (const region of REGIONS) {
      const club = await makeClub(region, 'Example Town')
      const res = await written(club.slug)
      expect(res.status, region).toBe(200)
      const line = cityLine('Example Town', region)
      expect(line, region).toBe(`Chess club in Example Town, Louisiana · ${region}`)
      expect(res.text, region).toContain(`<p>${line}</p>`)
      expect(res.text.split(`<p>${line}</p>`).length - 1, region).toBe(1)
      expect(res.text, region).not.toContain('null')
      expect(res.text, region).not.toContain('undefined')
    }
  })

  it('a club with no region, and a club filed under a name that is gone, still get a page; the line has no region for the first and carries the stored words for the second', async () => {
    flags.pagesOn = true
    const none = await makeClub(null, 'Example Town')
    const noneAnswer = await ask(undefined, none.slug)
    expect(noneAnswer.status).toBe(200)
    expect(JSON.parse(noneAnswer.body).club.region).toBeNull()
    const noneHtml = await written(none.slug)
    expect(noneHtml.text).toContain('<p>Chess club in Example Town, Louisiana</p>')
    expect(noneHtml.text).not.toMatch(/<p>Chess club in [^<]*·/)

    const old = await makeClub('Bayou Region', 'Example Town')
    const oldAnswer = await ask(undefined, old.slug)
    expect(oldAnswer.status).toBe(200)
    expect(JSON.parse(oldAnswer.body).club.region).toBe('Bayou Region')
  })

  it('a club in a seat\'s own town reads the town twice on the line, as cityLine writes it; the page serves it and nothing breaks', async () => {
    flags.pagesOn = true
    const club = await makeClub('Lake Charles / Southwestern', 'Lake Charles')
    const res = await written(club.slug)
    expect(res.status).toBe(200)
    expect(res.text).toContain('<p>Chess club in Lake Charles, Louisiana · Lake Charles / Southwestern</p>')
  })
})
