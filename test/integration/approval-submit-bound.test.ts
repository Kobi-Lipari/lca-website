// test/integration/approval-submit-bound.test.ts
//
// The bound on Submit for LCA review (WS09 checkpoint V's review), POST
// /api/admin/tournaments/[id]/approval with action submit. Every submit that
// goes through emails each LCA admin, against a sending limit for everything
// the site sends, so a person who is not an LCA admin has at most
// SUBMITS_A_DAY submits go through in any 24 hours, counted from their
// tournament_submitted rows in the activity log:
// - five go through and the sixth is refused with 429 in words, sends no
//   email, writes no row and leaves the event a draft;
// - rows older than 24 hours do not count, nor another person's;
// - an LCA admin is not counted or bounded, and the count is never read for
//   them;
// - a submit that would not go through (an event already in review) answers
//   as before and reads no count;
// - with REGION_EVENTS_ON unset the endpoint answers 403 before anything is
//   read.
// REGION_EVENTS_ON and both mail switches are read through getters on their
// mocked modules, the mail switches at today's values, so the emails go the
// same way whatever they ship as. Every club, person, address and event is
// made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APPROVAL_CLOSED,
  EMAIL_WORDS,
  SUBMITS_A_DAY,
  TOO_MANY_SUBMITS,
  onRequestPost as approval,
} from '../../functions/api/admin/tournaments/[id]/approval'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'
import { emailOutbox, invoke, resetHarness } from './harness'
import { countingDb, noWaits } from './mailRuns'

const flags = vi.hoisted(() => ({ regionOn: false, listsOn: false, sender: 'resend' as 'resend' | 'ses' }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get REGION_EVENTS_ON() {
      return flags.regionOn
    },
  }
})
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
    get MAIL_SENDER() {
      return flags.sender
    },
  }
})

beforeEach(() => {
  resetHarness()
  flags.regionOn = true
  flags.listsOn = false
  flags.sender = 'resend'
  noWaits()
})
afterEach(() => {
  flags.regionOn = false
  vi.restoreAllMocks()
})

const REGION = 'Example Cypress Region'
const COUNT_SQL = 'FROM admin_audit_log'
let seq = 0

/** A representative with a seat over a club of the region, and an LCA admin to email. */
async function representative() {
  const n = ++seq
  const club = await seedClub({ name: `Example Chess Club ${n}` })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(REGION, club).run()
  const id = await seedMember({ fullName: 'Player One', email: `player.one.${n}@example.org` })
  const seat = `seat-bound-${n}`
  await env.DB.prepare("INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)").bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, REGION).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(`term-${seat}`, seat, id).run()
  return { id, club }
}

/** A draft of the club, marked for approval, made by the member. */
async function draft(club: string, createdBy: string): Promise<string> {
  const id = await seedTournament({ name: `Example Club Night ${++seq}`, date: '2026-12-12', clubId: club, createdBy, entryFee: 0, sections: [{ name: 'Open', entryFee: 0 }], isVisible: false })
  await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1 WHERE id = ?').bind(id).run()
  return id
}

/** Rows of the activity log as earlier submits left them, at the age given in hours. */
async function earlierSubmits(actor: string, count: number, hoursAgo: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await env.DB.prepare(
      `INSERT INTO admin_audit_log (id, actor_id, actor_email, action, target_label, detail, created_at)
       VALUES (?, ?, 'player@example.org', 'tournament_submitted', 'Example Club Night', '{}', datetime('now', ?))`,
    ).bind(`aud-bound-${++seq}`, actor, `-${hoursAgo} hours`).run()
  }
}

const submit = (as: string, id: string, db?: D1Database) =>
  invoke(approval, { method: 'POST', as, aal: 'aal1', params: { id }, body: { action: 'submit' }, ...(db ? { env: { DB: db } } : {}) })
const submitted = async (actor: string) =>
  (await env.DB.prepare("SELECT COUNT(*) AS n FROM admin_audit_log WHERE actor_id = ? AND action = 'tournament_submitted'").bind(actor).first<{ n: number }>())!.n
const requestedAt = async (id: string) =>
  (await env.DB.prepare('SELECT approval_requested_at FROM tournaments WHERE id = ?').bind(id).first<{ approval_requested_at: string | null }>())!.approval_requested_at

describe('the bound on submits', () => {
  it('lets five submits go through in a day and refuses the sixth with 429 in words, no email, no row and the event still a draft', async () => {
    expect(SUBMITS_A_DAY).toBe(5)
    await seedAdmin()
    const rep = await representative()
    for (let i = 0; i < SUBMITS_A_DAY; i++) {
      const res = await submit(rep.id, await draft(rep.club, rep.id))
      expect(res.status, `submit ${i + 1}`).toBe(200)
      expect((await res.json<{ email: string }>()).email).toBe(EMAIL_WORDS.reviewSent)
    }
    expect(await submitted(rep.id)).toBe(5)
    const sixth = await draft(rep.club, rep.id)
    const mailBefore = emailOutbox.length
    const refused = await submit(rep.id, sixth)
    expect(refused.status).toBe(429)
    expect(await refused.json()).toEqual({ error: TOO_MANY_SUBMITS })
    expect(TOO_MANY_SUBMITS).toBe('You have sent 5 events for LCA review in the last day. Try again tomorrow.')
    expect(emailOutbox).toHaveLength(mailBefore)
    expect(await submitted(rep.id)).toBe(5)
    expect(await requestedAt(sixth)).toBeNull()
  })

  it('does not count rows older than 24 hours', async () => {
    await seedAdmin()
    const rep = await representative()
    await earlierSubmits(rep.id, 5, 25)
    const event = await draft(rep.club, rep.id)
    expect((await submit(rep.id, event)).status).toBe(200)
    expect(await requestedAt(event)).not.toBeNull()
  })

  it('counts rows of the last 24 hours, so five from an hour ago bound the next', async () => {
    await seedAdmin()
    const rep = await representative()
    await earlierSubmits(rep.id, 5, 1)
    const event = await draft(rep.club, rep.id)
    expect((await submit(rep.id, event)).status).toBe(429)
    expect(await requestedAt(event)).toBeNull()
  })

  it('does not count another person\'s rows', async () => {
    await seedAdmin()
    const rep = await representative()
    const other = await representative()
    await earlierSubmits(other.id, 5, 1)
    const event = await draft(rep.club, rep.id)
    expect((await submit(rep.id, event)).status).toBe(200)
  })

  it('does not count or bound an LCA admin, and reads no count for them', async () => {
    const admin = await seedAdmin()
    const rep = await representative()
    await earlierSubmits(admin, 6, 1)
    const event = await draft(rep.club, rep.id)
    const { db, ran } = countingDb()
    const res = await invoke(approval, { method: 'POST', as: admin, aal: 'aal2', params: { id: event }, body: { action: 'submit' }, env: { DB: db } })
    expect(res.status).toBe(200)
    expect(ran.some((r) => r.sql.includes(COUNT_SQL) && r.sql.startsWith('SELECT COUNT(*)'))).toBe(false)
    expect(await requestedAt(event)).not.toBeNull()
  })

  it('reads no count for a submit that would not go through: an event in review answers as before', async () => {
    await seedAdmin()
    const rep = await representative()
    const event = await draft(rep.club, rep.id)
    expect((await submit(rep.id, event)).status).toBe(200)
    await earlierSubmits(rep.id, 5, 1)
    const { db, ran } = countingDb()
    const again = await submit(rep.id, event, db)
    expect(again.status).toBe(200)
    expect((await again.json<{ email: string }>()).email).toBe(EMAIL_WORDS.alreadyInReview)
    expect(ran.some((r) => r.sql.startsWith('SELECT COUNT(*)') && r.sql.includes(COUNT_SQL))).toBe(false)
  })

  it('with REGION_EVENTS_ON unset answers 403 before anything is read, with no query made', async () => {
    const rep = await representative()
    const event = await draft(rep.club, rep.id)
    flags.regionOn = false
    const { db, ran } = countingDb()
    const res = await submit(rep.id, event, db)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: APPROVAL_CLOSED })
    expect(ran).toEqual([])
  })
})
