// test/integration/club-answer-by-address.test.ts
// GET /api/clubs/[id], today's club page's answer, finds a club by its id
// first, as it always has, and then by its short address, a current slug or
// an old one, matched as the new club page's finder matches them (WS09 step
// 23, K's choice 8 (a)). It does so in both states of every switch, so a
// browser sent on to a slug by a 301 still finds today's page if the switch
// is turned back off. The answer by slug is the answer by id, byte for byte,
// officers, events and news included, for every reader; an address that
// names no club still answers "Club not found". CLUB_PAGES_ON and
// CLUB_EMAIL_HIDDEN are set and unset here through getters on mocks of their
// modules; no case reads how either ships. Every club and person here is
// made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke } from './harness'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'
import { countingDb } from './mailRuns'

import { onRequestGet as clubGet } from '../../functions/api/clubs/[id]'

const flags = vi.hoisted(() => ({ pagesOn: false, emailHidden: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
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
  flags.emailHidden = false
})

let made = 0
const mark = () => `${++made}${crypto.randomUUID().slice(0, 6)}`

/** Every state of the two switches this answer could meet. */
const STATES = [[false, false], [true, false], [false, true], [true, true]] as const

/** A made-up club with an id that is not its slug, an old slug, an officer, an event and a news row. */
async function makeClub() {
  const m = mark()
  const id = await seedClub({ id: `example-club-id-${m}`, name: `Example Chess Club ${m}`, city: 'Example City' })
  const slug = `example-chess-club-${m}`
  const old = `example-old-name-${m}`
  await env.DB.prepare(`UPDATE clubs SET slug = ?, contact_email = 'club.contact@example.org' WHERE id = ?`).bind(slug, id).run()
  await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(old, id).run()
  const officer = await seedMember({ fullName: 'Player One', email: `player.${m}@example.org`, clubId: id })
  await env.DB.prepare(`INSERT INTO club_officers (id, club_id, member_id, role) VALUES (?, ?, ?, 'President')`).bind(`officer-${m}`, id, officer).run()
  await seedTournament({ clubId: id, name: `Example Open ${m}`, date: '2026-12-05' })
  await env.DB.prepare(`INSERT INTO club_news (id, club_id, title, excerpt, news_date) VALUES (?, ?, 'Example news', 'A made up note.', '2026-11-01')`)
    .bind(`news-${m}`, id).run()
  return { id, slug, old }
}

const ask = async (address: string, as?: string) => {
  const res = await invoke(clubGet, { ...(as ? { as } : {}), params: { id: address } })
  return { status: res.status, headers: Object.fromEntries([...res.response.headers.entries()].sort()), body: await res.response.text() }
}

describe('GET /api/clubs/[id] by a club\'s short address', () => {
  it('finds a club by its slug and by an old slug, the same bytes as by its id, in every state of the switches', async () => {
    const club = await makeClub()
    for (const [pagesOn, emailHidden] of STATES) {
      flags.pagesOn = pagesOn
      flags.emailHidden = emailHidden
      const byId = await ask(club.id)
      expect(byId.status).toBe(200)
      const body = JSON.parse(byId.body) as { club: { id: string }; officers: unknown[]; tournaments: unknown[]; news: unknown[] }
      expect([body.club.id, body.officers.length, body.tournaments.length, body.news.length]).toEqual([club.id, 1, 1, 1])
      for (const address of [club.slug, club.old, club.slug.toUpperCase(), encodeURIComponent(` ${club.slug} `)]) {
        expect(await ask(address), `${address} ${pagesOn} ${emailHidden}`).toEqual(byId)
      }
    }
  })

  it('answers the same bytes by slug as by id for every reader', async () => {
    const club = await makeClub()
    const m = mark()
    const rep = await seedMember({ role: 'club_rep', clubId: club.id, fullName: 'Rita Sample', email: `rita.${m}@example.org` })
    const member = await seedMember({ fullName: 'Player Two', email: `two.${m}@example.org` })
    const admin = await seedAdmin()
    for (const who of [undefined, member, rep, admin]) {
      expect(await ask(club.slug, who), String(who)).toEqual(await ask(club.id, who))
    }
  })

  it('looks the address part up by id first, so every address that found a club finds the same one, and reads the rest by the found id', async () => {
    const club = await makeClub()
    const { db, ran } = countingDb()
    const res = await invoke(clubGet, { params: { id: club.id }, env: { DB: db } })
    expect(res.status).toBe(200)
    // By its id: today's reads alone, in today's order, and no lookup by slug.
    expect(ran.map((r) => r.sql).filter((sql) => /club_slug_history|WHERE slug = \?/.test(sql))).toEqual([])
    expect(ran[0].sql).toMatch(/FROM clubs\s+WHERE id = \?$/)

    const { db: bySlugDb, ran: bySlug } = countingDb()
    await invoke(clubGet, { params: { id: club.slug }, env: { DB: bySlugDb } })
    const sqls = bySlug.map((r) => r.sql)
    expect(sqls[0]).toMatch(/FROM clubs\s+WHERE id = \?$/)
    expect(sqls[1]).toBe('SELECT id FROM clubs WHERE slug = ?')
    expect(sqls[2]).toMatch(/FROM clubs\s+WHERE id = \?$/)
    expect(sqls.slice(3).join('\n')).not.toMatch(/club_slug_history|WHERE slug = \?/)
  })

  it('an unknown part, a reserved word and a part too long still answer "Club not found"', async () => {
    for (const address of [`no-such-club-${mark()}`, 'suggest', 'x'.repeat(201), '%E0%A4%A']) {
      const res = await ask(address)
      expect([res.status, res.body], address.slice(0, 20)).toEqual([404, JSON.stringify({ error: 'Club not found' })])
    }
  })
})
