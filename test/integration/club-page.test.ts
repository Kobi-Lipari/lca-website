// test/integration/club-page.test.ts
// GET /api/clubs/[id]/page, the read behind the new club page (WS09 step 20).
// Who may read in each state of the two constants, CLUB_PAGES_ON and
// CLUB_KEEPERS_ON, both false in the tree and set here through getters on a
// mock of their module, as test/integration/club-by-slug-edges.test.ts does;
// the role-safety cases are the keepers-only ones, where everyone but the
// club's keepers gets the one 404. Then how a club is found, the sections,
// what the answer never carries, the author and told lines, the places, the
// events through listedWhere, the news, the nearest clubs and the headers.
// CLUB_EMAIL_HIDDEN is set and unset here through a getter on a mock of its
// own module, as test/integration/public-answer-trim.test.ts does; no case
// reads how it ships. Every club, person and place here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke } from './harness'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedTournament } from './factories'
import { countingDb } from './mailRuns'

import { onRequestGet as pageGet, CLUB_PAGE_NOT_FOUND, PAGE_NAVY } from '../../functions/api/clubs/[id]/page'
import { onRequestGet as clubGet } from '../../functions/api/clubs/[id]'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import { onRequestGet as feedGet } from '../../functions/api/clearinghouse'

const flags = vi.hoisted(() => ({ pagesOn: false, keepersOn: false, emailHidden: false }))
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
vi.mock('../../functions/utils/clubs/publicAnswer', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/publicAnswer')>()
  return {
    ...real,
    get CLUB_EMAIL_HIDDEN() {
      return flags.emailHidden
    },
  }
})
afterEach(() => {
  flags.pagesOn = false
  flags.keepersOn = false
  flags.emailHidden = false
})

/** A short mark of its own for each club, region and address a case makes, since the database is kept across a file's cases. */
let made = 0
const mark = () => `${++made}${crypto.randomUUID().slice(0, 6)}`

/** A regional seat covering the regions, held by the member. */
async function regionalSeat(memberId: string, regions: string[]): Promise<void> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(id, id).run()
  for (const region of regions) await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(id, memberId).run()
}

interface ClubOptions {
  name?: string
  city?: string
  region?: string | null
  slug?: string | null
  id?: string
}

/** A made-up club with a page address and a region of its own, and nothing else. */
async function makeClub(opts: ClubOptions = {}): Promise<{ id: string; slug: string | null; region: string | null }> {
  const m = mark()
  const id = await seedClub({ id: opts.id, name: opts.name ?? `Example Chess Club ${m}`, city: opts.city ?? 'Example City' })
  const slug = opts.slug === undefined ? `example-chess-club-${m}` : opts.slug
  const region = opts.region === undefined ? `Example Region ${m}` : opts.region
  await env.DB.prepare('UPDATE clubs SET slug = ?, region = ? WHERE id = ?').bind(slug, region, id).run()
  return { id, slug, region }
}

/** The five basics: one sentence, how the club meets, a place, a contact name and a private contact email. */
async function giveBasics(clubId: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE clubs SET about_text = 'A friendly made up club.', how_we_meet_text = 'Tuesdays at 7:00 PM',
            contact_name_public = 'Contact P.', contact_email = 'club.contact@example.org' WHERE id = ?`,
  ).bind(clubId).run()
  await env.DB.prepare(`INSERT INTO club_places (club_id, name, street, note, sort) VALUES (?, 'Example Library', '1 Example Street', 'Room past the front desk', 0)`)
    .bind(clubId).run()
}

type Who = string | undefined
const ask = async (who: Who, address: string) => {
  const res = await invoke(pageGet, { ...(who ? { as: who } : {}), params: { id: address } })
  return { status: res.status, body: await res.response.clone().text(), cache: res.response.headers.get('Cache-Control') }
}
const page = async (who: Who, address: string) => {
  const res = await ask(who, address)
  expect(res.status, res.body).toBe(200)
  return JSON.parse(res.body) as Record<string, unknown> & {
    club: { id: string; slug: string; color: string; logo: string | null }
    sections: string[]
    statement: { text: string | null; told: string }
    places: Array<Record<string, unknown>>
    events: Array<Record<string, unknown>>
    news: Array<Record<string, unknown>>
    nearest: Array<Record<string, unknown>>
  }
}
const NOT_FOUND_BODY = JSON.stringify({ error: CLUB_PAGE_NOT_FOUND })

/** The club's keepers and the people who are not, each made up. */
async function cast(club: { id: string; region: string | null }) {
  const m = mark()
  const rep = await seedMember({ role: 'club_rep', clubId: club.id, fullName: 'Rita Sample', email: `rita.${m}@example.org` })
  const representative = await seedMember({ fullName: 'Theo Region', email: `theo.${m}@example.org` })
  await regionalSeat(representative, [club.region ?? ''])
  const admin = await seedAdmin()
  const member = await seedMember({ clubId: club.id, fullName: 'Player One', email: `player.${m}@example.org` })
  const other = await makeClub()
  const otherRep = await seedMember({ role: 'club_rep', clubId: other.id, fullName: 'Olive Other', email: `olive.${m}@example.org` })
  const otherRepresentative = await seedMember({ fullName: 'Owen Elsewhere', email: `owen.${m}@example.org` })
  await regionalSeat(otherRepresentative, [other.region ?? ''])
  return { rep, representative, admin, member, otherRep, otherRepresentative }
}

describe('GET /api/clubs/[id]/page: who may read', () => {
  it('404 with both constants unset, for a visitor, a member, a keeper and an LCA admin, before the sign-in or any query', async () => {
    const club = await makeClub()
    await giveBasics(club.id)
    const people = await cast(club)
    for (const who of [undefined, people.member, people.rep, people.representative, people.admin]) {
      for (const address of [club.slug ?? '', club.id, `no-such-club-${mark()}`]) {
        const { db, ran } = countingDb()
        const res = await invoke(pageGet, { ...(who ? { as: who } : {}), params: { id: address }, env: { DB: db } })
        expect([res.status, await res.response.text(), res.response.headers.get('Cache-Control')], `${who} ${address}`).toEqual([404, NOT_FOUND_BODY, 'no-store'])
        expect(ran, `${who} ${address}`).toEqual([])
      }
    }
  })

  it('with only CLUB_KEEPERS_ON set a visitor and another club\'s rep get 404 and the club\'s keeper gets the page: its rep, the region\'s representative and an LCA admin', async () => {
    flags.keepersOn = true
    const club = await makeClub()
    await giveBasics(club.id)
    const people = await cast(club)
    const missing = await ask(people.admin, `no-such-club-${mark()}`)
    expect(missing).toEqual({ status: 404, body: NOT_FOUND_BODY, cache: 'no-store' })
    for (const who of [people.rep, people.representative, people.admin]) {
      const res = await ask(who, club.slug ?? '')
      expect([res.status, res.cache], who).toEqual([200, 'no-store'])
      expect(JSON.parse(res.body).club.id).toBe(club.id)
    }
    // Everyone else: the same bytes and headers as for a club that does not exist, never a 401 or a 403.
    for (const who of [undefined, people.member, people.otherRep, people.otherRepresentative]) {
      for (const address of [club.slug ?? '', club.id]) expect(await ask(who, address), `${who} ${address}`).toEqual(missing)
    }
  })

  it('with only CLUB_KEEPERS_ON set a guest holding the region\'s seat and a signed-in person the site has never seen get the same 404', async () => {
    flags.keepersOn = true
    const club = await makeClub()
    const guest = await seedMember({ role: 'guest', fullName: 'Guest Person', email: `guest.${mark()}@example.org` })
    await regionalSeat(guest, [club.region ?? ''])
    const missing = await ask(undefined, `no-such-club-${mark()}`)
    expect(await ask(guest, club.id)).toEqual(missing)
    expect(await ask(`unknown-${mark()}`, club.id)).toEqual(missing)
  })

  it('with CLUB_PAGES_ON set a visitor gets the page, and every reader the same bytes', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await giveBasics(club.id)
    const people = await cast(club)
    const visitor = await ask(undefined, club.slug ?? '')
    expect(visitor.status).toBe(200)
    for (const who of [people.member, people.rep, people.otherRep, people.admin]) expect(await ask(who, club.slug ?? ''), who).toEqual(visitor)
    flags.keepersOn = true
    expect(await ask(undefined, club.slug ?? '')).toEqual(visitor)
  })

  it('sends no-store on every answer while the page is not public, and today\'s public headers once it is', async () => {
    const club = await makeClub()
    const admin = await seedAdmin()
    const headersOf = async (who: Who, address: string) => {
      const res = await invoke(pageGet, { ...(who ? { as: who } : {}), params: { id: address } })
      return Object.fromEntries([...res.response.headers.entries()].sort())
    }
    const today = Object.fromEntries([...(await invoke(clubGet, { params: { id: club.id } })).response.headers.entries()].sort())
    expect(today['cache-control']).toBeUndefined()
    const closed = await headersOf(admin, club.id)
    expect(closed).toEqual({ ...today, 'cache-control': 'no-store' })
    flags.keepersOn = true
    expect(await headersOf(admin, club.id)).toEqual({ ...today, 'cache-control': 'no-store' })
    expect(await headersOf(undefined, club.id)).toEqual({ ...today, 'cache-control': 'no-store' })
    flags.pagesOn = true
    expect(await headersOf(undefined, club.id)).toEqual(today)
    expect(await headersOf(undefined, `no-such-club-${mark()}`)).toEqual(today)
  })
})

describe('GET /api/clubs/[id]/page: finding a club', () => {
  it('by slug, by old slug and by id, the answer naming the current slug', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const old = `example-old-address-${mark()}`
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(old, club.id).run()
    const bySlug = await ask(undefined, club.slug ?? '')
    expect(JSON.parse(bySlug.body).club).toMatchObject({ id: club.id, slug: club.slug })
    expect(await ask(undefined, old)).toEqual(bySlug)
    expect(await ask(undefined, club.id)).toEqual(bySlug)
  })

  it('names the id as the address while a club has no slug, and finds it by its id', async () => {
    flags.pagesOn = true
    const club = await makeClub({ slug: null })
    expect((await page(undefined, club.id)).club.slug).toBe(club.id)
  })

  it('takes a slug over an id that is the same word, and a current slug over an old one', async () => {
    flags.pagesOn = true
    const word = `example-shared-word-${mark()}`
    const byIdOnly = await makeClub({ id: word, slug: `example-first-${mark()}` })
    const bySlug = await makeClub({ slug: word })
    expect((await page(undefined, word)).club.id).toBe(bySlug.id)
    expect((await page(undefined, byIdOnly.slug ?? '')).club.id).toBe(byIdOnly.id)

    const moved = `example-moved-word-${mark()}`
    const formerHolder = await makeClub()
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(moved, formerHolder.id).run()
    const currentHolder = await makeClub({ slug: moved })
    expect((await page(undefined, moved)).club.id).toBe(currentHolder.id)
  })

  it('reads letter case and stray spaces as the slug rule does, and an encoded address as it was meant', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const slug = club.slug ?? ''
    const plain = await ask(undefined, slug)
    for (const address of [slug.toUpperCase(), `  ${slug} `, `%20${slug}%20`]) expect(await ask(undefined, address), address).toEqual(plain)
    expect((await ask(undefined, `${slug}-x`)).status).toBe(404)
    expect((await ask(undefined, '   ')).status).toBe(404)
  })
})

describe('GET /api/clubs/[id]/page: what it carries', () => {
  it('gives the bare club About, When and where and Contact alone, in navy with no logo', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await giveBasics(club.id)
    const body = await page(undefined, club.id)
    expect(body.sections).toEqual(['about', 'when_and_where', 'contact'])
    expect(body.club.color).toBe(PAGE_NAVY)
    expect(body.club.logo).toBeNull()
    await env.DB.prepare(`UPDATE clubs SET color = '#C8A94A', image_url = 'https://example.org/logo.png' WHERE id = ?`).bind(club.id).run()
    expect((await page(undefined, club.id)).club).toMatchObject({ color: PAGE_NAVY, logo: null })
    await env.DB.prepare(`UPDATE clubs SET color = '#1F3A5F', image_url = ? WHERE id = ?`).bind(`/api/clubs/${club.id}/logo?v=1`, club.id).run()
    expect((await page(undefined, club.id)).club).toMatchObject({ color: '#1f3a5f', logo: `/api/clubs/${club.id}/logo?v=1` })
  })

  it('no contact email, officer, roster or member id anywhere in the body, for any reader, of a club that has them all', async () => {
    const club = await makeClub()
    await giveBasics(club.id)
    const people = await cast(club)
    const m = mark()
    const officer = await seedMember({ clubId: club.id, fullName: 'Oscar Officerly', email: `oscar.${m}@example.org` })
    await env.DB.prepare(`INSERT INTO club_officers (id, club_id, member_id, role) VALUES (?, ?, ?, 'Treasurer')`).bind(`officer-${m}`, club.id, officer).run()
    const roster = [people.member, officer]
    for (let i = 0; i < 3; i++) roster.push(await seedMember({ clubId: club.id, fullName: `Rosterly Person${i}`, email: `roster${i}.${m}@example.org` }))
    await env.DB.prepare(
      `UPDATE clubs SET told_by = ?, told_updated_at = '2026-11-02 15:00:00', confirmed_by = ?, last_confirmed_at = '2026-11-03 15:00:00',
              facebook_url = 'https://example.org/facebook', website_url = 'https://example.org', cost_text = '$5 a night' WHERE id = ?`,
    ).bind(people.rep, people.representative, club.id).run()
    await env.DB.prepare(`INSERT INTO club_reports (club_id, kind, message, reporter_email) VALUES (?, 'suggestion', 'Example change', ?)`)
      .bind(club.id, `reporter.${m}@example.org`).run()
    await env.DB.prepare(`INSERT INTO club_rep_requests (club_id, member_id, connection, note, status, decided_by) VALUES (?, ?, 'helps_run_it', 'Example note', 'declined', ?)`)
      .bind(club.id, people.member, people.admin).run()
    const listed = await seedTournament({ clubId: club.id, name: 'Example Listed Open', date: '2026-12-05' })
    for (const player of roster.slice(2)) await seedRegistration({ tournamentId: listed, memberId: player })
    const waiting = await seedTournament({ clubId: club.id, name: 'Example Waiting Open', isVisible: false, createdBy: people.representative })
    await env.DB.prepare(`UPDATE tournaments SET needs_lca_approval = 1, approval_requested_at = '2026-11-04 15:00:00' WHERE id = ?`).bind(waiting).run()
    await env.DB.prepare(`UPDATE tournaments SET needs_lca_approval = 1, approval_requested_at = '2026-11-01 15:00:00', approved_at = '2026-11-02 15:00:00', approved_by = ? WHERE id = ?`)
      .bind(people.admin, listed).run()

    const ids = [...roster, people.rep, people.representative, people.admin, people.otherRep, people.otherRepresentative]
    const names = ['Sample', 'Officerly', 'Rosterly', 'Player One', 'Treasurer', 'Theo Region', 'Example change', 'Example note', 'Example Waiting Open']
    const banned = /email|officer|roster|member|told_by|confirmed|approv|created_by|keep_apart|report|request|guardian|count_of/i
    const keysOf = (value: unknown, found: string[] = []): string[] => {
      if (Array.isArray(value)) for (const item of value) keysOf(item, found)
      else if (value && typeof value === 'object') {
        for (const [key, inner] of Object.entries(value)) {
          found.push(key)
          keysOf(inner, found)
        }
      }
      return found
    }
    const bodies: Array<[string, string]> = []
    flags.keepersOn = true
    for (const who of [people.rep, people.representative, people.admin]) bodies.push([`keeper ${who}`, (await ask(who, club.id)).body])
    flags.pagesOn = true
    for (const who of [undefined, people.member, people.otherRep]) bodies.push([`reader ${who}`, (await ask(who, club.id)).body])
    for (const [reader, body] of bodies) {
      expect(body, reader).not.toMatch(/@/)
      for (const id of ids) expect(body, `${reader} ${id}`).not.toContain(id)
      for (const name of names) expect(body, `${reader} ${name}`).not.toContain(name)
      expect(keysOf(JSON.parse(body)).filter((key) => banned.test(key) && key !== 'registered_count'), reader).toEqual([])
      expect(body, reader).toContain('Example Listed Open')
      expect(body, reader).toContain('"registered_count":3')
    }
    // Every reader is answered the same words.
    expect(new Set(bodies.map(([, body]) => body)).size).toBe(1)
  })

  it('answers the same bytes with CLUB_EMAIL_HIDDEN unset and set, neither carrying the club\'s email', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await giveBasics(club.id)
    flags.emailHidden = false
    const unset = await ask(undefined, club.id)
    flags.emailHidden = true
    const set = await ask(undefined, club.id)
    expect(set).toEqual(unset)
    expect(unset.body).not.toContain('club.contact@example.org')
    expect(JSON.parse(unset.body).contact).toEqual({ name: 'Contact P.' })
  })

  it('a place\'s name and street are in the answer and no email address is, two places at most in the editor\'s order, by named columns', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await env.DB.prepare(
      `INSERT INTO club_places (club_id, name, street, note, latitude, longitude, sort) VALUES
         (?, 'Example Second Hall', '2 Example Avenue', NULL, 30.5, -91.1, 1),
         (?, 'Example First Hall', '1 Example Street', 'Ask at the front desk', 30.4, -91.2, 0),
         (?, 'Example Third Hall', '3 Example Road', NULL, 30.6, -91.0, 2)`,
    ).bind(club.id, club.id, club.id).run()
    const body = await page(undefined, club.id)
    expect(body.places.map((p) => p.name)).toEqual(['Example First Hall', 'Example Second Hall'])
    for (const place of body.places) expect(Object.keys(place)).toEqual(['name', 'street', 'note', 'latitude', 'longitude'])
    expect(body.places[0]).toMatchObject({ street: '1 Example Street', latitude: 30.4, longitude: -91.2 })
    expect(body.places[0].note).toBe('Ask at the front desk')
    expect(body.sections).toContain('when_and_where')
    expect(JSON.stringify(body)).not.toMatch(/@/)
  })
})

describe('GET /api/clubs/[id]/page: the author and told lines', () => {
  // K's decision 12 (checkpoint W): who keeps a club is not public, so the answer carries no author line and no
  // keeper's name, and the told line reads "Last checked" with its month.
  it('no author line for any keeper: the club\'s rep, the region\'s representative while it has no rep, and the LCA admins while the seat is open', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await seedAdmin()
    const bare = await page(undefined, club.id)
    expect(Object.keys(bare)).not.toContain('author')
    expect(JSON.stringify(bare)).not.toMatch(/Kept by|LCA admins|representative/)
    const m = mark()
    const second = await seedMember({ fullName: 'Zed Second', email: `zed.${m}@example.org` })
    const first = await seedMember({ fullName: 'Ann Firstly', email: `ann.${m}@example.org` })
    await regionalSeat(second, [club.region ?? ''])
    await regionalSeat(first, [club.region ?? ''])
    const seat = await page(undefined, club.id)
    expect(Object.keys(seat)).not.toContain('author')
    expect(JSON.stringify(seat)).not.toMatch(/Kept by|Ann|Firstly|Zed|representative/)
    await seedMember({ role: 'club_rep', clubId: club.id, fullName: '  Rita   Sample  Jr. ', email: `rita.${m}@example.org` })
    const rep = await page(undefined, club.id)
    expect(Object.keys(rep)).not.toContain('author')
    expect(JSON.stringify(rep)).not.toMatch(/Kept by|Rita|Sample/)
    const noRegion = await makeClub({ region: null })
    expect(JSON.stringify(await page(undefined, noRegion.id))).not.toMatch(/Kept by/)
  })

  it('never names a child: no line and no name for a rep or a representative with a guardian', async () => {
    flags.pagesOn = true
    const m = mark()
    const guardian = await seedMember({ fullName: 'Parent Person', email: `parent.${m}@example.org` })
    const club = await makeClub()
    const child = await seedMember({ role: 'club_rep', clubId: club.id, fullName: 'Kid Junior', email: `kid.${m}@example.org` })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(guardian, child).run()
    const rep = await page(undefined, club.id)
    expect(Object.keys(rep)).not.toContain('author')
    expect(JSON.stringify(rep)).not.toMatch(/Kid|Junior|Parent|Kept by/)

    const another = await makeClub()
    const childSeat = await seedMember({ fullName: 'Kid Seatholder', email: `kid.seat.${m}@example.org` })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(guardian, childSeat).run()
    await regionalSeat(childSeat, [another.region ?? ''])
    expect(JSON.stringify(await page(undefined, another.id))).not.toMatch(/Kid|Seatholder|Kept by/)
  })

  it('never names a child with no guardian whose entry confirmed a scholastic range, as a rep or a representative', async () => {
    flags.pagesOn = true
    const m = mark()
    const tournamentId = await seedTournament({ name: `Example Scholastic ${m}` })
    const club = await makeClub()
    const teen = await seedMember({ role: 'club_rep', clubId: club.id, fullName: 'Sam Player', email: `sam.${m}@example.org` })
    const entry = await seedRegistration({ tournamentId, memberId: teen })
    expect(JSON.stringify(await page(undefined, club.id))).not.toMatch(/Sam|Player|Kept by/)
    await env.DB.prepare('UPDATE registrations SET grade = ? WHERE id = ?').bind('9-12', entry).run()
    const rep = await page(undefined, club.id)
    expect(Object.keys(rep)).not.toContain('author')
    expect(JSON.stringify(rep)).not.toMatch(/Sam|Player|Kept by/)

    const another = await makeClub()
    const teenSeat = await seedMember({ fullName: 'Tess Seatholder', email: `tess.${m}@example.org` })
    const seatEntry = await seedRegistration({ tournamentId, memberId: teenSeat })
    await env.DB.prepare('UPDATE registrations SET grade = ? WHERE id = ?').bind('0-8', seatEntry).run()
    await regionalSeat(teenSeat, [another.region ?? ''])
    const seat = await page(undefined, another.id)
    expect(Object.keys(seat)).not.toContain('author')
    expect(JSON.stringify(seat)).not.toMatch(/Tess|Seatholder|Kept by/)
  })

  it('the told line reads "Last checked" with the month of the later of the last save and the last Still accurate, at a month\'s edge, and none with neither', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    await giveBasics(club.id)
    // A save writes its saver with its stamp; a stamp with no saver and no check is not a save.
    const saver = await seedMember({ fullName: 'Player One', email: `player.${mark()}@example.org` })
    const told = async (saved: string | null, checked: string | null) => {
      await env.DB.prepare('UPDATE clubs SET told_updated_at = ?, told_by = ?, last_confirmed_at = ? WHERE id = ?').bind(saved, saved === null ? null : saver, checked, club.id).run()
      return (await page(undefined, club.id)).statement
    }
    expect(await told(null, null)).toEqual({ text: 'Tuesdays at 7:00 PM', told: '' })
    expect((await told('2026-11-02 15:00:00', null)).told).toBe('Last checked November 2026')
    expect((await told(null, '2026-11-02 15:00:00')).told).toBe('Last checked November 2026')
    expect((await told('2026-12-01 05:59:59', null)).told).toBe('Last checked November 2026')
    expect((await told('2026-12-01 06:00:00', null)).told).toBe('Last checked December 2026')
    expect((await told('2026-09-10 15:00:00', '2026-12-01 05:59:59')).told).toBe('Last checked November 2026')
    expect((await told('2026-12-01 06:00:00', '2026-09-10 15:00:00')).told).toBe('Last checked December 2026')
    expect((await told('2026-09-10 15:00:00', '2026-10-05 15:00:00')).told).toBe('Last checked October 2026')
  })
})

describe('GET /api/clubs/[id]/page: events, news and the nearest clubs', () => {
  it('a hidden draft is not among the events, nor an event waiting for approval, nor another club\'s', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const other = await makeClub()
    const listed = await seedTournament({ clubId: club.id, name: 'Example Club Open', date: '2026-12-05' })
    const draft = await seedTournament({ clubId: club.id, name: 'Example Hidden Draft', isVisible: false })
    const waiting = await seedTournament({ clubId: club.id, name: 'Example Waiting Event', isVisible: false })
    await env.DB.prepare(`UPDATE tournaments SET needs_lca_approval = 1, approval_requested_at = '2026-11-04 15:00:00' WHERE id = ?`).bind(waiting).run()
    const theirs = await seedTournament({ clubId: other.id, name: 'Example Other Club Open' })
    const body = await page(undefined, club.id)
    expect(body.events.map((e) => e.id)).toEqual([listed])
    expect(JSON.stringify(body)).not.toMatch(new RegExp(`${draft}|${waiting}|${theirs}|Hidden Draft|Waiting Event|Other Club Open`))
    expect(body.sections).toContain('events')
  })

  it('events carry their dates, Register state and counts, each key one a visitor\'s event answer already carries', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    const later = await seedTournament({ clubId: club.id, name: 'Example Winter Open', date: '2026-12-12', maxPlayers: 40, registrationStatus: 'open' })
    const earlier = await seedTournament({ clubId: club.id, name: 'Example Fall Open', date: '2026-12-05', registrationStatus: 'closed' })
    await env.DB.prepare(`UPDATE tournaments SET end_date = '2026-12-13' WHERE id = ?`).bind(later).run()
    const m = mark()
    const players = [] as string[]
    for (let i = 0; i < 4; i++) players.push(await seedMember({ fullName: `Player Entrant${i}`, email: `entrant${i}.${m}@example.org` }))
    const entries = [] as string[]
    for (const player of players) entries.push(await seedRegistration({ tournamentId: later, memberId: player }))
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = '2026-11-10 15:00:00' WHERE id = ?`).bind(entries[0]).run()
    await env.DB.prepare(`UPDATE registrations SET waitlisted_at = '2026-11-10 15:00:00' WHERE id = ?`).bind(entries[1]).run()

    const body = await page(undefined, club.id)
    expect(body.events).toEqual([
      { id: later, name: 'Example Winter Open', date: '2026-12-12', end_date: '2026-12-13', status: 'upcoming', registration_status: 'open', max_players: 40, registered_count: 2 },
      { id: earlier, name: 'Example Fall Open', date: '2026-12-05', end_date: null, status: 'upcoming', registration_status: 'closed', max_players: null, registered_count: 0 },
    ])
    const list = await (await invoke(tournamentsGet, { path: '/api/tournaments' })).json<{ tournaments?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>()
    const rows = Array.isArray(list) ? list : list.tournaments ?? []
    const feed = await (await invoke(feedGet, { path: '/api/clearinghouse?upcoming=false' })).json<{ tournaments?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>()
    const feedRows = Array.isArray(feed) ? feed : feed.tournaments ?? []
    const visitorKeys = new Set([...Object.keys(rows.find((t) => t.id === later) ?? {}), ...Object.keys(feedRows.find((t) => t.id === later) ?? {})])
    for (const key of Object.keys(body.events[0])) expect(visitorKeys.has(key), key).toBe(true)
    expect(feedRows.find((t) => t.id === later)?.registered_count).toBe(2)
  })

  it('the news are the rows today\'s public club answer sends, by its rule', async () => {
    flags.pagesOn = true
    const club = await makeClub()
    expect((await page(undefined, club.id)).sections).not.toContain('news')
    for (let i = 1; i <= 12; i++) {
      await env.DB.prepare('INSERT INTO club_news (id, club_id, title, news_date, excerpt) VALUES (?, ?, ?, ?, ?)')
        .bind(`news-${club.id}-${i}`, club.id, `Example News ${i}`, `2026-10-${String(i).padStart(2, '0')}`, `Example excerpt ${i}`).run()
    }
    const today = await (await invoke(clubGet, { params: { id: club.id } })).json<{ news: unknown[] }>()
    const body = await page(undefined, club.id)
    expect(body.news).toEqual(today.news)
    expect(body.news).toHaveLength(10)
    expect(body.news[0]).toMatchObject({ title: 'Example News 12' })
    expect(body.sections).toContain('news')
  })

  it('the three nearest clubs with their miles, the club itself and a club with no coordinates left out, ties by name', async () => {
    flags.pagesOn = true
    const at = async (name: string, latitude: number | null, longitude: number | null, statement: string | null = null) => {
      const club = await makeClub({ name, city: `${name} Town` })
      await env.DB.prepare('UPDATE clubs SET how_we_meet_text = ? WHERE id = ?').bind(statement, club.id).run()
      await env.DB.prepare(`INSERT INTO club_places (club_id, name, latitude, longitude, sort) VALUES (?, 'Example Hall', ?, ?, 0)`).bind(club.id, latitude, longitude).run()
      return club
    }
    const m = mark()
    // Far out in the southern ocean, where no seeded club is.
    const home = await at(`Home Example ${m}`, -50, 100)
    const near = await at(`Near Example ${m}`, -50, 100.005, 'Mondays at 6:00 PM')
    const tieB = await at(`Tie B Example ${m}`, -50, 100.5)
    const tieA = await at(`Tie A Example ${m}`, -50, 99.5)
    await at(`Farther Example ${m}`, -50, 102)
    await at(`Unpinned Example ${m}`, null, null)
    // A club with no place is read at today's pin.
    const pinned = await makeClub({ name: `Pinned Example ${m}` })
    await env.DB.prepare('UPDATE clubs SET latitude = -50, longitude = 101 WHERE id = ?').bind(pinned.id).run()

    const body = await page(undefined, home.id)
    expect(body.nearest).toEqual([
      { name: `Near Example ${m}`, city: `Near Example ${m} Town`, slug: near.slug, statement: 'Mondays at 6:00 PM', distance: 'less than 1 mi' },
      { name: `Tie A Example ${m}`, city: `Tie A Example ${m} Town`, slug: tieA.slug, statement: null, distance: 'about 22 mi' },
      { name: `Tie B Example ${m}`, city: `Tie B Example ${m} Town`, slug: tieB.slug, statement: null, distance: 'about 22 mi' },
    ])
    expect((await page(undefined, pinned.id)).nearest.map((c) => c.name)).toEqual([`Tie B Example ${m}`, `Near Example ${m}`, `Farther Example ${m}`])
    const unpinned = await makeClub({ name: `Lost Example ${m}` })
    expect((await page(undefined, unpinned.id)).nearest).toEqual([])
  })
})
