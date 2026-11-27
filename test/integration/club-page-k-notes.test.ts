// test/integration/club-page-k-notes.test.ts
// What K's look at the test site asked of the new club page (K's decision
// 12, checkpoint W). Who keeps a club is not public: no answer of
// GET /api/clubs/[id]/page and no page the server writes, GET /clubs/[id],
// holds any form of the author line or any keeper's name, for a visitor, a
// member, the club's rep, the region's representative or an LCA admin, with
// CLUB_PAGES_ON set, and none for a keeper or an LCA admin with
// CLUB_KEEPERS_ON alone. The
// told line reads "Last checked" with the month of the later of the last
// save and the last Still accurate, a real Still accurate among them, and
// none with neither. With both constants unset every reader still gets the
// one 404. CLUB_PAGES_ON and CLUB_KEEPERS_ON are set here through getters on
// a mock of their module; no case reads how either ships. Every club, person
// and place here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import type { Env } from '../../functions/types'
import { accessToken, invoke } from './harness'
import { seedAdmin, seedClub, seedMember } from './factories'

import { onRequestGet as pageGet, CLUB_PAGE_NOT_FOUND } from '../../functions/api/clubs/[id]/page'
import { onRequestGet as routeGet } from '../../functions/clubs/[id]'
import { markStillAccurate } from '../../functions/utils/clubs/stillAccurate'
import { monthInWords } from '../../domain/clubs/monthlyCheck'
import { clubPageResponseSchema } from '../../domain/contracts/clubPage'

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

/** Every form the author line took, and the words of a keeper's seat. */
const AUTHOR_WORDS = /Kept by|named a rep|LCA admins|seat is filled|representative/

/** A made-up club with every block a page draws, and the people around it. */
async function clubWithPeople() {
  const m = mark()
  const id = await seedClub({ id: `example-club-${m}`, name: `Example Chess Club ${m}`, city: 'Example City' })
  const region = `Example Region ${m}`
  await env.DB.prepare(
    `UPDATE clubs SET slug = ?, region = ?, about_text = 'A friendly made up club.', how_we_meet_text = 'Tuesdays at 7:00 PM',
            contact_name_public = 'Contact P.', told_updated_at = '2026-10-05 15:00:00', last_confirmed_at = '2026-11-02 15:00:00' WHERE id = ?`,
  ).bind(`example-chess-club-${m}`, region, id).run()
  await env.DB.prepare(`INSERT INTO club_places (club_id, name, street, note, sort) VALUES (?, 'Example Library', '1 Example Street', NULL, 0)`).bind(id).run()
  const rep = await seedMember({ role: 'club_rep', clubId: id, fullName: 'Rita Keeper', email: `rita.${m}@example.org` })
  const representative = await seedMember({ fullName: 'Theo Seatholder', email: `theo.${m}@example.org` })
  const seat = `seat-${m}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, representative).run()
  const member = await seedMember({ clubId: id, fullName: 'Player One', email: `player.${m}@example.org` })
  const admin = await seedAdmin()
  return { id, slug: `example-chess-club-${m}`, rep, representative, member, admin, names: ['Rita', 'Keeper', 'Theo', 'Seatholder'] }
}

const answer = async (who: string | undefined, id: string) => {
  const res = await invoke(pageGet, { ...(who ? { as: who } : {}), params: { id } })
  return { status: res.status, text: await res.response.clone().text() }
}

/** The page the server writes, as Pages hands the route its context, for a visitor or a signed-in reader. */
async function written(part: string, who?: string): Promise<{ status: number; text: string }> {
  const token = who ? accessToken(who) : null
  const res = await routeGet({
    request: new Request(`https://www.louisianachess.org/clubs/${part}`, { headers: token ? { Authorization: `Bearer ${token}`, Cookie: `sb-access-token=${token}` } : {} }),
    env: env as unknown as Env,
    params: { id: part },
    data: {},
    functionPath: `/clubs/${part}`,
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response('<!doctype html><html><head><title>Example</title></head><body><div id="root"></div></body></html>', { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  } as unknown as EventContext<Env, string, Record<string, unknown>>)
  return { status: res.status, text: await res.text() }
}

describe('who keeps a club is not public', () => {
  it('the answer holds no author line and no keeper\'s name for a visitor, a member, the club\'s rep, the region\'s representative and an LCA admin', async () => {
    flags.pagesOn = true
    const club = await clubWithPeople()
    for (const who of [undefined, club.member, club.rep, club.representative, club.admin]) {
      const res = await answer(who, club.id)
      expect(res.status, String(who)).toBe(200)
      const body = JSON.parse(res.text) as Record<string, unknown>
      expect(clubPageResponseSchema.safeParse(body).success, String(who)).toBe(true)
      expect(Object.keys(body), String(who)).not.toContain('author')
      expect(res.text, String(who)).not.toMatch(AUTHOR_WORDS)
      for (const name of club.names) expect(res.text, `${who} ${name}`).not.toContain(name)
      // The contact name the club chose to show stays.
      expect((body.contact as { name: string | null }).name).toBe('Contact P.')
    }
  })

  it('a keeper or an LCA admin let in by CLUB_KEEPERS_ON alone gets no author line and no keeper\'s name either, and a visitor and a member the one 404', async () => {
    flags.keepersOn = true
    const club = await clubWithPeople()
    for (const who of [club.rep, club.representative, club.admin]) {
      const res = await answer(who, club.id)
      expect(res.status, who).toBe(200)
      expect(Object.keys(JSON.parse(res.text) as object)).not.toContain('author')
      expect(res.text, who).not.toMatch(AUTHOR_WORDS)
      for (const name of club.names) expect(res.text, `${who} ${name}`).not.toContain(name)
    }
    for (const who of [undefined, club.member]) {
      const res = await answer(who, club.id)
      expect(res.status, String(who)).toBe(404)
      expect(res.text).toBe(JSON.stringify({ error: CLUB_PAGE_NOT_FOUND }))
    }
  })

  it('the page the server writes, and its JSON-LD block, hold no author line and no keeper\'s name for any reader', async () => {
    flags.pagesOn = true
    const club = await clubWithPeople()
    for (const who of [undefined, club.member, club.rep, club.representative, club.admin]) {
      const page = await written(club.slug, who)
      expect(page.status, String(who)).toBe(200)
      expect(page.text).toContain('application/ld+json')
      expect(page.text, String(who)).not.toMatch(AUTHOR_WORDS)
      for (const name of club.names) expect(page.text, `${who} ${name}`).not.toContain(name)
    }
  })

  it('with both constants unset every reader gets the one 404, as before', async () => {
    const club = await clubWithPeople()
    for (const who of [undefined, club.member, club.rep, club.representative, club.admin]) {
      const res = await answer(who, club.id)
      expect(res.status, String(who)).toBe(404)
      expect(res.text).toBe(JSON.stringify({ error: CLUB_PAGE_NOT_FOUND }))
    }
  })
})

describe('Last checked', () => {
  it('reads the month of a real Still accurate when it is later than the last save, and of the save when the save is later', async () => {
    flags.pagesOn = true
    const club = await clubWithPeople()
    const told = async () => (JSON.parse((await answer(undefined, club.id)).text) as { statement: { told: string } }).statement.told
    // The save in October, the last Still accurate in November.
    expect(await told()).toBe('Last checked November 2026')
    await env.DB.prepare(`UPDATE clubs SET told_updated_at = '2026-12-03 15:00:00' WHERE id = ?`).bind(club.id).run()
    expect(await told()).toBe('Last checked December 2026')
    // Still accurate stamps the club now; the line reads that stamp's month, read as the month of any stamp is read.
    await env.DB.prepare(`UPDATE clubs SET told_updated_at = '2020-01-06 15:00:00', told_by = ?, last_confirmed_at = NULL WHERE id = ?`).bind(club.representative, club.id).run()
    expect(await told()).toBe('Last checked January 2020')
    const stamped = await markStillAccurate(env.DB, club.id, club.representative)
    expect(stamped).not.toBeNull()
    expect(await told()).toBe(`Last checked ${monthInWords(stamped?.last_confirmed_at)}`)
  })

  it('draws no line with neither stamp, or with a stamp that is no date, and never the time of the request', async () => {
    flags.pagesOn = true
    const club = await clubWithPeople()
    for (const [saved, checked] of [[null, null], ['not a date', null], [null, ''], ['soon', 'later']] as const) {
      await env.DB.prepare('UPDATE clubs SET told_updated_at = ?, last_confirmed_at = ? WHERE id = ?').bind(saved, checked, club.id).run()
      const res = await answer(undefined, club.id)
      const body = JSON.parse(res.text) as { statement: { text: string | null; told: string } }
      expect(body.statement, `${saved} ${checked}`).toEqual({ text: 'Tuesdays at 7:00 PM', told: '' })
      expect(res.text).not.toMatch(/Last checked|Invalid|NaN/)
    }
  })
})
