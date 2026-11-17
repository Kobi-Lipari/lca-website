// test/integration/club-page-edges.test.ts
// The edges of GET /api/clubs/[id]/page beside test/integration/club-page.test.ts
// (WS09 step 20): OPTIONS, what the lookup does with odd address parts and
// with an old slug that matches another club's id, a club with nothing filled
// in, text of spaces alone, the told line when the saver has since changed or
// gone, the order of places and events on a tie, a read that never writes,
// and every other reader's 404 for an address by old slug. CLUB_PAGES_ON and
// CLUB_KEEPERS_ON are set through getters on a mock of their module. Every
// club, person and place here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke } from './harness'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'
import { countingDb } from './mailRuns'
import { clubPageResponseSchema } from '../../domain/contracts/clubPage'

import { onRequestGet as pageGet, onRequestOptions as pageOptions, CLUB_PAGE_NOT_FOUND } from '../../functions/api/clubs/[id]/page'

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

let made = 0
const mark = () => `${++made}${crypto.randomUUID().slice(0, 6)}`
const NOT_FOUND_BODY = JSON.stringify({ error: CLUB_PAGE_NOT_FOUND })

async function makeClub(opts: { id?: string; slug?: string | null; region?: string | null } = {}) {
  const m = mark()
  const id = await seedClub({ id: opts.id, name: `Example Chess Club ${m}`, city: 'Example City' })
  const slug = opts.slug === undefined ? `example-edge-club-${m}` : opts.slug
  const region = opts.region === undefined ? `Example Edge Region ${m}` : opts.region
  await env.DB.prepare('UPDATE clubs SET slug = ?, region = ? WHERE id = ?').bind(slug, region, id).run()
  return { id, slug, region }
}

const ask = async (who: string | undefined, address: string) => {
  const res = await invoke(pageGet, { ...(who ? { as: who } : {}), params: { id: address } })
  return { status: res.status, body: await res.response.clone().text(), cache: res.response.headers.get('Cache-Control') }
}
const page = async (address: string) => {
  const res = await ask(undefined, address)
  expect(res.status, res.body).toBe(200)
  return JSON.parse(res.body) as {
    club: { id: string; slug: string }
    sections: string[]
    author: string
    about: Record<string, unknown>
    statement: { text: string | null; told: string }
    places: Array<Record<string, unknown>>
    contact: { name: string | null }
    events: Array<Record<string, unknown>>
    news: unknown[]
    nearest: unknown[]
  }
}

describe('GET /api/clubs/[id]/page: OPTIONS and reads that change nothing', () => {
  it('answers OPTIONS 204 with an empty body in every state of the two constants, reading nothing', async () => {
    for (const [pagesOn, keepersOn] of [[false, false], [false, true], [true, false], [true, true]]) {
      flags.pagesOn = pagesOn
      flags.keepersOn = keepersOn
      const { db, ran } = countingDb()
      const res = await invoke(pageOptions, { method: 'OPTIONS', env: { DB: db } })
      expect(res.status, `${pagesOn} ${keepersOn}`).toBe(204)
      expect(await res.response.text()).toBe('')
      expect(ran).toEqual([])
    }
  })

  it('writes nothing for any reader: every statement a full page runs is a read, and asking twice gives the same bytes', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await seedMember({ role: 'club_rep', clubId: club.id, fullName: 'Rita Sample', email: `rita.${mark()}@example.org` })
    await seedTournament({ clubId: club.id, name: 'Example Edge Open', date: '2026-12-05' })
    const before = JSON.stringify(await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(club.id).first())
    const { db, ran } = countingDb()
    const first = await invoke(pageGet, { params: { id: club.id }, env: { DB: db } })
    const second = await invoke(pageGet, { params: { id: club.id }, env: { DB: db } })
    expect(first.status).toBe(200)
    expect(await first.response.text()).toBe(await second.response.text())
    expect(ran.length).toBeGreaterThan(0)
    for (const { sql } of ran) expect(sql.trim(), sql).toMatch(/^SELECT\b/i)
    expect(JSON.stringify(await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(club.id).first())).toBe(before)
  })

  it('reads no member for a club that does not exist, whatever the state, and never asks who is signed in', async () => {
    const admin = await seedAdmin()
    for (const [pagesOn, keepersOn] of [[true, false], [false, true], [true, true]]) {
      flags.pagesOn = pagesOn
      flags.keepersOn = keepersOn
      const { db, ran } = countingDb()
      const res = await invoke(pageGet, { as: admin, params: { id: `no-such-club-${mark()}` }, env: { DB: db } })
      expect(res.status).toBe(404)
      expect(ran.length).toBeGreaterThan(0)
      for (const { sql } of ran) expect(sql, sql).toMatch(/FROM clubs\b/)
    }
  })
})

describe('GET /api/clubs/[id]/page: odd address parts', () => {
  it('takes an old slug over an id that is the same word, the last step of the lookup being the id', async () => {
    flags.pagesOn = true
    const word = `example-word-${mark()}`
    const idHolder = await makeClub({ id: word })
    const former = await makeClub()
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(word, former.id).run()
    expect((await page(word)).club.id).toBe(former.id)
    expect((await page(idHolder.slug ?? '')).club.id).toBe(idHolder.id)
  })

  it('finds a club by its id written in capitals, as the slug rule reads a slug in lower case', async () => {
    flags.pagesOn = true
    const id = `example-id-${mark()}`
    const club = await makeClub({ id, slug: null })
    expect((await page(id.toUpperCase())).club.id).toBe(club.id)
    expect((await page(`  ${id}  `)).club.id).toBe(club.id)
  })

  it('answers the one 404 for an address too long, one with a broken percent sign, one with quotes or slashes, and an empty one', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const nothing = await ask(undefined, `no-such-club-${mark()}`)
    expect(nothing).toEqual({ status: 404, body: NOT_FOUND_BODY, cache: null })
    for (const address of ['a'.repeat(201), `${club.slug}%E0%A4%A`, '%', `x' OR '1'='1`, `${club.slug}/page`, '../', '', '%00']) {
      expect(await ask(undefined, address), address).toEqual(nothing)
    }
  })

  it('names the current slug whichever way the club was found, an old slug and an id alike', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const old = `example-former-${mark()}`
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(old, club.id).run()
    for (const address of [old, old.toUpperCase(), club.id, club.slug ?? '']) expect((await page(address)).club.slug, address).toBe(club.slug)
  })

  it('gives a stranger the same 404 for an old slug and an id as for a club that does not exist, while only keepers may read', async () => {
    flags.keepersOn = true
    const club = await makeClub()
    const old = `example-former-${mark()}`
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(old, club.id).run()
    const stranger = await seedMember({ fullName: 'Player One', email: `player.${mark()}@example.org` })
    const missing = await ask(stranger, `no-such-club-${mark()}`)
    expect(missing).toEqual({ status: 404, body: NOT_FOUND_BODY, cache: 'no-store' })
    for (const address of [old, club.id, club.slug ?? '']) {
      expect(await ask(stranger, address), address).toEqual(missing)
      expect(await ask(undefined, address), address).toEqual(missing)
    }
    const admin = await seedAdmin()
    for (const address of [old, club.id, club.slug ?? '']) expect((await ask(admin, address)).status, address).toBe(200)
  })
})

describe('GET /api/clubs/[id]/page: a club with little or nothing filled in', () => {
  it('answers a club with nothing at all: Contact alone, empty lists, no month on the told line, and passes the contract', async () => {
    flags.pagesOn = true
    const club = await makeClub({ region: null, slug: null })
    const body = await page(club.id)
    expect(clubPageResponseSchema.safeParse(body).success).toBe(true)
    expect(body.sections).toEqual(['contact'])
    expect(body.places).toEqual([])
    expect(body.events).toEqual([])
    expect(body.news).toEqual([])
    expect(body.statement).toEqual({ text: null, told: 'As told to LCA' })
    expect(body.contact).toEqual({ name: null })
    expect(body.about).toEqual({
      text: null, cost: null, welcome: null, facebook: null, website: null, other: null, weekend_play: false, scholastic_friendly: false,
    })
    expect(body.author).toBe('Kept by LCA admins')
  })

  it('reads text of spaces alone as empty: no About, no statement, no street and no note, and no section for them', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await env.DB.prepare(
      `UPDATE clubs SET about_text = '   ', how_we_meet_text = '  ', cost_text = ' ', welcome_text = '  ', facebook_url = ' ',
              website_url = '', other_url = '  ', contact_name_public = '  ' WHERE id = ?`,
    ).bind(club.id).run()
    await env.DB.prepare(`INSERT INTO club_places (club_id, name, street, note, sort) VALUES (?, 'Example Hall', '  ', ' ', 0)`).bind(club.id).run()
    const body = await page(club.id)
    expect(body.about).toMatchObject({ text: null, cost: null, welcome: null, facebook: null, website: null, other: null })
    expect(body.statement.text).toBeNull()
    expect(body.contact.name).toBeNull()
    expect(body.places).toEqual([{ name: 'Example Hall', street: null, note: null, latitude: null, longitude: null }])
    // A place alone brings When and where; nothing else is named.
    expect(body.sections).toEqual(['when_and_where', 'contact'])
  })

  it('names each optional block\'s section the first time it has content, and leaves the bare club alone', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    expect((await page(club.id)).sections).toEqual(['contact'])
    await env.DB.prepare(`UPDATE clubs SET weekend_play = 1 WHERE id = ?`).bind(club.id).run()
    expect((await page(club.id)).sections).toEqual(['about', 'contact'])
    await env.DB.prepare(`INSERT INTO club_news (id, club_id, title, news_date, excerpt) VALUES (?, ?, 'Example News', '2026-10-01', 'Example excerpt')`)
      .bind(`news-${club.id}`, club.id).run()
    await seedTournament({ clubId: club.id, name: 'Example Edge Open' })
    expect((await page(club.id)).sections).toEqual(['about', 'events', 'news', 'contact'])
  })
})

describe('GET /api/clubs/[id]/page: the told line when the saver has changed or gone', () => {
  it('reads "As told to LCA" once the club\'s rep who saved has become a plain member, or has moved to another club', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const other = await makeClub()
    const rep = await seedMember({ role: 'club_rep', clubId: club.id, fullName: 'Rita Sample', email: `rita.${mark()}@example.org` })
    await env.DB.prepare(`UPDATE clubs SET told_by = ?, told_updated_at = '2026-11-02 15:00:00' WHERE id = ?`).bind(rep, club.id).run()
    expect((await page(club.id)).statement.told).toBe('As told by the club, updated November 2026')
    await env.DB.prepare(`UPDATE members SET role = 'member' WHERE id = ?`).bind(rep).run()
    expect((await page(club.id)).statement.told).toBe('As told to LCA, November 2026')
    await env.DB.prepare(`UPDATE members SET role = 'club_rep', club_id = ? WHERE id = ?`).bind(other.id, rep).run()
    expect((await page(club.id)).statement.told).toBe('As told to LCA, November 2026')
  })

  it('reads "As told by the club" with no month for a stamp that is not a date, never "Invalid Date"', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const rep = await seedMember({ role: 'club_rep', clubId: club.id, fullName: 'Rita Sample', email: `rita.${mark()}@example.org` })
    for (const stamp of ['not a date', '', '0000-00-00 00:00:00']) {
      await env.DB.prepare('UPDATE clubs SET told_by = ?, told_updated_at = ? WHERE id = ?').bind(rep, stamp, club.id).run()
      const told = (await page(club.id)).statement.told
      expect(told, stamp).toBe('As told by the club')
      expect(told, stamp).not.toMatch(/Invalid|NaN|undefined/)
    }
  })
})

describe('GET /api/clubs/[id]/page: order on a tie', () => {
  it('lists places of the same sort by id, and no more than two', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    for (const name of ['Example Hall B', 'Example Hall A', 'Example Hall C']) {
      await env.DB.prepare(`INSERT INTO club_places (club_id, name, sort) VALUES (?, ?, 0)`).bind(club.id, name).run()
    }
    expect((await page(club.id)).places.map((p) => p.name)).toEqual(['Example Hall B', 'Example Hall A'])
  })

  it('lists events of the same date by id, a later date first, and gives a one-day event no end date', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const m = mark()
    const b = await seedTournament({ id: `edge-b-${m}`, clubId: club.id, name: 'Example B Open', date: '2026-12-05' })
    const a = await seedTournament({ id: `edge-a-${m}`, clubId: club.id, name: 'Example A Open', date: '2026-12-05' })
    const later = await seedTournament({ id: `edge-z-${m}`, clubId: club.id, name: 'Example Later Open', date: '2027-01-09' })
    const body = await page(club.id)
    expect(body.events.map((e) => e.id)).toEqual([later, a, b])
    expect(body.events.every((e) => e.end_date === null)).toBe(true)
  })

  it('keeps a past event among the listed ones, with its status in words and its full date', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const past = await seedTournament({ clubId: club.id, name: 'Example Old Open', date: '2024-03-02', status: 'completed', registrationStatus: 'closed' })
    const body = await page(club.id)
    expect(body.events).toEqual([
      { id: past, name: 'Example Old Open', date: '2024-03-02', end_date: null, status: 'completed', registration_status: 'closed', max_players: null, registered_count: 0 },
    ])
  })
})

describe('GET /api/clubs/[id]/page: the nearest clubs, where the first place has no point', () => {
  it('leaves a club out whose first place has no point, even when a later place has one, and reads a club with no place at its own pin', async () => {
    flags.pagesOn = true
    const m = mark()
    // Far out in the south Pacific, where no seeded club is.
    const named = async (name: string, places: Array<[number | null, number | null]>, pin?: [number, number]) => {
      const club = await makeClub()
      await env.DB.prepare('UPDATE clubs SET name = ? WHERE id = ?').bind(`${name} ${m}`, club.id).run()
      let sort = 0
      for (const [latitude, longitude] of places) {
        await env.DB.prepare(`INSERT INTO club_places (club_id, name, latitude, longitude, sort) VALUES (?, 'Example Hall', ?, ?, ?)`)
          .bind(club.id, latitude, longitude, sort++).run()
      }
      if (pin) await env.DB.prepare('UPDATE clubs SET latitude = ?, longitude = ? WHERE id = ?').bind(pin[0], pin[1], club.id).run()
      return club
    }
    const home = await named('Edge Home', [[-40, -150]])
    await named('Edge First Unpinned', [[null, null], [-40, -149.9]])
    await named('Edge Pinned Only', [], [-40, -149.5])
    await named('Edge Second Place Ignored', [[-40, -149], [-40, 10]])
    const names = (await page(home.id)).nearest as Array<{ name: string; distance: string }>
    // A seeded club may fill the third place; the two of ours come first, in miles, and the unpinned one never appears.
    expect(names.slice(0, 2).map((c) => c.name)).toEqual([`Edge Pinned Only ${m}`, `Edge Second Place Ignored ${m}`])
    expect(names.map((c) => c.name)).not.toContain(`Edge First Unpinned ${m}`)
    expect(names.every((c) => /^about \d+ mi$/.test(c.distance))).toBe(true)
  })

  it('names no club for a club whose own first place has no point, and carries only the five keys for each club it names', async () => {
    flags.pagesOn = true
    const lost = await makeClub()
    await env.DB.prepare(`INSERT INTO club_places (club_id, name, latitude, longitude, sort) VALUES (?, 'Example Hall', NULL, NULL, 0)`).bind(lost.id).run()
    expect((await page(lost.id)).nearest).toEqual([])
    const home = await makeClub()
    await env.DB.prepare(`INSERT INTO club_places (club_id, name, latitude, longitude, sort) VALUES (?, 'Example Hall', -30, -140, 0)`).bind(home.id).run()
    const near = await makeClub()
    await env.DB.prepare(`UPDATE clubs SET contact_email = 'near.club@example.org', contact_name_public = 'Contact P.' WHERE id = ?`).bind(near.id).run()
    await env.DB.prepare(`INSERT INTO club_places (club_id, name, latitude, longitude, sort) VALUES (?, 'Example Hall', -30, -139.9, 0)`).bind(near.id).run()
    const found = (await page(home.id)).nearest as Array<Record<string, unknown>>
    expect(found[0].slug).toBe(near.slug)
    for (const club of found) expect(Object.keys(club).sort()).toEqual(['city', 'distance', 'name', 'slug', 'statement'])
    expect(Object.keys(found[0]).sort()).toEqual(['city', 'distance', 'name', 'slug', 'statement'])
    expect(JSON.stringify(found)).not.toMatch(/@|Contact P/)
  })
})
