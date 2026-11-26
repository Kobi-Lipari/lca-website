// test/integration/club-rep-requests-words.test.ts
//
// The sentence a keeper reads about a member whose account names another club
// (WS09 checkpoint Z's review, ruling B4). Where the rep request's row is
// built, functions/utils/clubs/repRequests.ts reads CLUB_PAGES_ON at each
// call: with it unset the question says "is on {Other club}'s roster now"
// (today's words, to the letter), and with it set, when no page shows a
// roster, it says the member's account names the other club. The rows are
// read through the real handlers, GET /api/workspace/region and GET
// /api/admin/clubs/[id], into the real database. The constant is set through
// a getter on a mock of its module, so no case reads a shipped value of any
// switch; CLUB_KEEPERS_ON is set the same way, since the keepers' answers
// close without it. Every club, person and address is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REP_DIRECTORY_WORDS } from '../../domain/clubs/repRequest'
import { onRequestPost as askPost } from '../../functions/api/clubs/[id]/rep-requests'
import { onRequestGet as regionGet } from '../../functions/api/workspace/region'
import { onRequestGet as clubGet } from '../../functions/api/admin/clubs/[id]'
import type { RepRequestRow, WorkspaceRegionResponse } from '../../domain/contracts'
import { seedClub, seedMember } from './factories'
import { invoke, resetHarness } from './harness'

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

const KEYED = { SIGNING_SECRET: 'example-made-up-signing-key-for-rep-request-words' }
const NORTH = 'North Louisiana'
const SLOW = 30_000

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`

beforeEach(async () => {
  resetHarness()
  flags.pagesOn = false
  flags.keepersOn = false
  // The middle of the run's own hour, held still, so every call of a case lands in one hour.
  const middle = new Date()
  middle.setUTCMinutes(30, 0, 0)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(middle)
  await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE ended_at IS NULL`).run()
  await env.DB.prepare(`UPDATE club_rep_requests SET status = 'declined' WHERE status = 'open'`).run()
  await env.DB.prepare('DELETE FROM rate_limits').run()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

interface Person { id: string; name: string }

async function person(opts: { role?: string; clubId?: string | null } = {}): Promise<Person> {
  const m = mark()
  const name = `Player ${m}`
  const id = await seedMember({ id: crypto.randomUUID(), fullName: name, email: `player-${m}@example.org`, role: opts.role, clubId: opts.clubId ?? null })
  return { id, name }
}

async function onlyAdmin(): Promise<Person> {
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE role = 'lca_admin'`).run()
  return person({ role: 'lca_admin' })
}

async function club(): Promise<{ id: string; name: string }> {
  const name = `Example Knights Club ${mark()}`
  const id = await seedClub({ name })
  await env.DB.prepare('UPDATE clubs SET region = ?, slug = ? WHERE id = ?').bind(NORTH, `example-${id}`, id).run()
  return { id, name }
}

/** The request a member sends from a club's page, which needs the club pages on; the flags are set as each case then wants them. */
async function asks(clubId: string, memberId: string): Promise<number> {
  flags.pagesOn = true
  flags.keepersOn = true
  const sent = await invoke(askPost, {
    method: 'POST', params: { id: clubId }, body: { connection: 'runs_it', note: 'I have run the Tuesday nights since spring.' }, as: memberId, aal: 'aal1', env: KEYED,
    path: `/api/clubs/${clubId}/rep-requests`,
  })
  expect(sent.status).toBe(200)
  const row = await env.DB.prepare('SELECT id FROM club_rep_requests WHERE club_id = ? AND member_id = ?').bind(clubId, memberId).first<{ id: number }>()
  return row!.id
}

const withPages = (on: boolean) => {
  flags.pagesOn = on
  flags.keepersOn = true
}

/** The row an LCA admin reads in My region, and the same row in the club's own answer. */
async function rowsFor(adminId: string, clubId: string, requestId: number): Promise<{ region: RepRequestRow; club: RepRequestRow }> {
  const region = await invoke(regionGet, { as: adminId, aal: 'aal1' })
  expect(region.status).toBe(200)
  const fromRegion = (await region.json<WorkspaceRegionResponse>()).repRequests!.find((r) => r.id === requestId)!
  const answer = await invoke(clubGet, { params: { id: clubId }, as: adminId, aal: 'aal1' })
  expect(answer.status).toBe(200)
  const fromClub = (await answer.json<{ repRequests?: RepRequestRow[] }>()).repRequests!.find((r) => r.id === requestId)!
  return { region: fromRegion, club: fromClub }
}

const FIRST = (name: string, clubName: string) => `${name} will be able to edit ${clubName}'s page, create its events and set their fees. ${REP_DIRECTORY_WORDS}`

describe('the keeper\'s question about a member whose account names another club', () => {
  it('with CLUB_PAGES_ON unset says today\'s sentence to the letter, in My region and in the club\'s answer', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const other = await club()
    const member = await person({ clubId: other.id })
    const id = await asks(c.id, member.id)
    withPages(false)
    const rows = await rowsFor(admin.id, c.id, id)
    const today = `${FIRST(member.name, c.name)} ${member.name} is on ${other.name}'s roster now. Naming them rep moves them to ${c.name}'s.`
    expect(rows.region.nameQuestion).toBe(today)
    expect(rows.club.nameQuestion).toBe(today)
  }, SLOW)

  it('with CLUB_PAGES_ON set names the member\'s account instead, and no row carries the word roster anywhere', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const other = await club()
    const member = await person({ clubId: other.id })
    const id = await asks(c.id, member.id)
    withPages(true)
    const rows = await rowsFor(admin.id, c.id, id)
    const now = `${FIRST(member.name, c.name)} ${member.name}'s account names ${other.name} as their club. Naming them rep changes that to ${c.name}.`
    expect(rows.region.nameQuestion).toBe(now)
    expect(rows.club.nameQuestion).toBe(now)
    expect(JSON.stringify(rows)).not.toMatch(/roster/i)
  }, SLOW)

  it('is read at each call: the same open request answers in either set of words as the constant is unset and set, and nothing else in its row moves', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const other = await club()
    const member = await person({ clubId: other.id })
    const id = await asks(c.id, member.id)
    withPages(false)
    const before = (await rowsFor(admin.id, c.id, id)).region
    withPages(true)
    const during = (await rowsFor(admin.id, c.id, id)).region
    withPages(false)
    const after = (await rowsFor(admin.id, c.id, id)).region
    expect(before.nameQuestion).toContain('roster')
    expect(during.nameQuestion).not.toContain('roster')
    expect(after).toEqual(before)
    expect({ ...during, nameQuestion: '' }).toEqual({ ...before, nameQuestion: '' })
  }, SLOW)

  it('leaves every other row as it is in both states: a member with no club, a member of this very club, a club rep and a tournament director', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const other = await club()
    const asked: Array<{ person: Person; id: number }> = []
    for (const who of [
      await person(),
      await person({ clubId: c.id }),
      await person({ role: 'club_rep', clubId: other.id }),
      await person({ role: 'tournament_director' }),
    ]) {
      asked.push({ person: who, id: await asks(c.id, who.id) })
    }
    withPages(false)
    const unset = await Promise.all(asked.map(async (a) => (await rowsFor(admin.id, c.id, a.id)).region))
    withPages(true)
    const set = await Promise.all(asked.map(async (a) => (await rowsFor(admin.id, c.id, a.id)).region))
    expect(set).toEqual(unset)
    expect(JSON.stringify(set)).not.toMatch(/roster/i)
    // The member of this very club is asked only the first question.
    expect(set[1].nameQuestion).toBe(FIRST(asked[1].person.name, c.name))
  }, SLOW)

  it('is shown only to a keeper: signed out gets 401, and a member, even the one named, is not given the row or the other club\'s name', async () => {
    const admin = await onlyAdmin()
    const c = await club()
    const other = await club()
    const member = await person({ clubId: other.id })
    const id = await asks(c.id, member.id)
    withPages(true)
    expect((await invoke(regionGet, {})).status).toBe(401)
    const asker = await invoke(regionGet, { as: member.id, aal: 'aal1' })
    expect([403, 404]).toContain(asker.status)
    const text = JSON.stringify(await asker.json())
    expect(text).not.toContain('account names')
    expect(text).not.toContain(other.name)
    const clubAnswerForMember = await invoke(clubGet, { params: { id: c.id }, as: member.id, aal: 'aal1' })
    expect(JSON.stringify(await clubAnswerForMember.json().catch(() => ({})))).not.toContain('account names')
    // The keeper's own read still has it, so the cases above are not passing for want of a row.
    expect((await rowsFor(admin.id, c.id, id)).region.nameQuestion).toContain('account names')
  }, SLOW)
})
