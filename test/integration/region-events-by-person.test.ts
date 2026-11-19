// test/integration/region-events-by-person.test.ts
//
// The regional representatives' club events (WS09 steps 16 to 19) by who the
// person is, as the handlers answer on a database built from the migrations,
// with REGION_EVENTS_ON and CLUB_KEEPERS_ON set through getters on their own
// module and no rule mocked. The other integration files of these steps hold
// each power's edge one endpoint at a time; this file holds what each person
// meets across all of them, in one place, so the order a person works in is
// held as well as each step:
// - a visitor and a plain member: 401 and 403, never the data, with nothing
//   written and nothing sent, and OPTIONS answering 204;
// - a regional representative: creates a hidden, marked, free event for a club
//   of the region, cannot list it, submits it, is refused approve and ask for
//   changes, hears of an answer by email, and after approval keeps hiding and
//   listing it by the ordinary save with the approval standing;
// - an LCA admin: approves, asks for changes with a note, and a replayed
//   approve changes nothing, sends nothing and writes no second row;
// - the dates the emails name: a weekday on each, across the clock change in
//   America/Chicago, a year's end and an event with no end date;
// - a holder of a regional seat whatever their role, a club's rep, a director
//   a representative named, and another region's representative;
// - what a representative may not do while running an event: record a refund,
//   change a card entry, or raise a price; and what they may: mark cash and
//   email the entrants.
// The mail switches are set through getters on the mocked
// functions/utils/mail/switches so no case reads their shipped values. Every
// club, person, address and event is made up, and mail is read from the test
// outbox.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WAITING_FOR_APPROVAL } from '../../domain/events/approval'
import { FEES_NEED_PAYOUT_ACCOUNT } from '../../domain/events/creation'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestPost as announce } from '../../functions/api/admin/tournaments/[id]/announce'
import { onRequestPost as assignDirector } from '../../functions/api/admin/tournaments/[id]/directors'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import {
  ALREADY_APPROVED,
  APPROVAL_CLOSED,
  EMAIL_WORDS,
  onRequestOptions as approvalOptions,
  onRequestPost as approval,
} from '../../functions/api/admin/tournaments/[id]/approval'
import { onRequestPatch as patchRegistration } from '../../functions/api/registrations/[id]'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import { onRequestGet as regionGet } from '../../functions/api/workspace/region'
import { seedAdmin, seedClub, seedMember, seedRegistration, seedTournament } from './factories'
import { emailOutbox, invoke, resetHarness } from './harness'
import { noWaits } from './mailRuns'

// Both are set here, so the file holds the same cases whichever way the lines ship.
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return true
    },
    get REGION_EVENTS_ON() {
      return true
    },
  }
})
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return false
    },
    get MAIL_SENDER() {
      return 'resend' as const
    },
  }
})

beforeEach(() => {
  resetHarness()
  noWaits()
})
afterEach(() => {
  vi.restoreAllMocks()
})

let seq = 0
const REGION = 'Example Bayou Region'
const FAR = 'Example Far Region'
/** An en dash or an em dash, written by code so that this file holds neither. */
const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
const OLD_INITIALS = new RegExp(`\\b${'US'}${'CF'}\\b`)

async function clubIn(region: string | null, label = 'Example Chess Club'): Promise<string> {
  const id = await seedClub({ name: `${label} ${++seq}` })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, id).run()
  return id
}

async function seatOver(memberId: string, regions: readonly string[] = [REGION]): Promise<void> {
  const seat = `seat-person-${++seq}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  for (const region of regions) await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(`term-${seat}`, seat, memberId).run()
}

async function count(sql: string, ...args: unknown[]): Promise<number> {
  return (await env.DB.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0
}

interface Stored {
  id: string
  club_id: string | null
  created_by: string | null
  is_visible: number
  needs_lca_approval: number
  entry_fee: number
  approval_requested_at: string | null
  approved_at: string | null
  approved_by: string | null
}
const stored = (id: string) => env.DB.prepare(
  'SELECT id, club_id, created_by, is_visible, needs_lca_approval, entry_fee, approval_requested_at, approved_at, approved_by FROM tournaments WHERE id = ?',
).bind(id).first<Stored>()

async function actionsAbout(id: string): Promise<string[]> {
  const { results } = await env.DB.prepare(
    "SELECT action FROM admin_audit_log WHERE action LIKE 'tournament_%' AND json_extract(detail, '$.tournament_id') = ? ORDER BY rowid",
  ).bind(id).all<{ action: string }>()
  return results.map((r) => r.action)
}

const move = (as: string | undefined, id: string, body: unknown, extra: { aal?: 'aal1' | 'aal2' } = {}) =>
  invoke(approval, { method: 'POST', as, params: { id }, body, ...extra })
const submit = (as: string | undefined, id: string) => move(as, id, { action: 'submit' })
const approve = (as: string | undefined, id: string) => move(as, id, { action: 'approve' })
const ask = (as: string | undefined, id: string, note = 'Example note') => move(as, id, { action: 'ask_changes', note })
const save = (as: string | undefined, id: string, body: Record<string, unknown>) => invoke(patchTournament, { method: 'PATCH', as, params: { id }, body })
const error = async (res: { json: <T>() => Promise<T> }) => (await res.json<{ error: string }>()).error
const mailTo = (address: string) => emailOutbox.filter((e) => e.to === address)
/** Moves the person's oldest submit in the activity log to the age given, as SQLite writes it. */
const ageOldestSubmit = (actor: string, age: string) => env.DB.prepare(
  `UPDATE admin_audit_log SET created_at = datetime('now', ?)
    WHERE action = 'tournament_submitted' AND rowid = (SELECT MIN(rowid) FROM admin_audit_log WHERE action = 'tournament_submitted' AND actor_id = ?)`,
).bind(age, actor).run()
const addressOf = async (id: string) => (await env.DB.prepare('SELECT email FROM members WHERE id = ?').bind(id).first<{ email: string }>())!.email

/** The people of a region: its representative, an LCA admin, and a club of the region with its own rep. */
async function people() {
  const club = await clubIn(REGION)
  const farClub = await clubIn(FAR, 'Example Rooks Club')
  const representative = await seedMember({ fullName: 'Player One', email: `player.one.${++seq}@example.org` })
  await seatOver(representative)
  const admin = await seedAdmin()
  const clubRep = await seedMember({ role: 'club_rep', clubId: club, fullName: 'Player Three' })
  const member = await seedMember({ fullName: 'Player Four' })
  return { club, farClub, representative, admin, clubRep, member }
}

/** What the representative's create writes: hidden, marked, theirs, free, for the club. */
async function draftFor(representative: string, club: string | null, over: { name?: string; date?: string; endDate?: string | null } = {}): Promise<string> {
  const id = await seedTournament({
    name: over.name ?? `Example Fall Open ${++seq}`,
    date: over.date ?? '2026-12-12',
    clubId: club,
    createdBy: representative,
    entryFee: 0,
    sections: [{ name: 'Open', entryFee: 0 }],
    isVisible: false,
  })
  await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1, end_date = ? WHERE id = ?').bind(over.endDate ?? null, id).run()
  return id
}

const createBody = (club: string, extra: Record<string, unknown> = {}) => ({
  name: `Example Fall Open ${++seq}`, location: 'Kenner, LA', date: '2026-12-12', entryFee: 0, clubId: club, ...extra,
})

describe('a visitor and a plain member, with the switches set', () => {
  it('get 401 and 403 and never the data from each endpoint a representative works through, with nothing written and nothing sent', async () => {
    const { club, representative, member } = await people()
    const draft = await draftFor(representative, club, { name: 'Example Hidden Draft' })
    const player = await seedMember({ fullName: 'Player Two', email: 'player.two@example.org' })
    await seedRegistration({ tournamentId: draft, memberId: player })
    const tournaments = await count('SELECT COUNT(*) AS n FROM tournaments')
    const log = await count('SELECT COUNT(*) AS n FROM admin_audit_log')
    const before = await stored(draft)

    const calls: Array<[string, (as?: string) => Promise<{ status: number; response: Response }>]> = [
      ['approval submit', (as) => submit(as, draft)],
      ['approval approve', (as) => approve(as, draft)],
      ['approval ask_changes', (as) => ask(as, draft)],
      ['create', (as) => invoke(createTournament, { method: 'POST', as, body: createBody(club) })],
      ['save', (as) => save(as, draft, { venue: 'Example Hall' })],
      ['name a director', (as) => invoke(assignDirector, { method: 'POST', as, params: { id: draft }, body: { memberId: member } })],
      ['manage', (as) => invoke(manageGet, { as, params: { id: draft } })],
      ['announce', (as) => invoke(announce, { method: 'POST', as, params: { id: draft }, body: { subject: 'Example subject', body: 'Example body' } })],
      ['my region', (as) => invoke(regionGet, { as })],
    ]
    for (const [label, run] of calls) {
      const signedOut = await run(undefined)
      expect(signedOut.status, `${label}, signed out`).toBe(401)
      const plain = await run(member)
      expect(plain.status, `${label}, a plain member`).toBe(403)
      for (const res of [signedOut, plain]) {
        const text = await res.response.clone().text()
        for (const secret of ['Example Hidden Draft', 'Player Two', 'player.two@example.org']) expect(text, `${label}: ${secret}`).not.toContain(secret)
      }
    }
    expect(await count('SELECT COUNT(*) AS n FROM tournaments')).toBe(tournaments)
    expect(await count('SELECT COUNT(*) AS n FROM admin_audit_log')).toBe(log)
    expect(await count('SELECT COUNT(*) AS n FROM tournament_directors WHERE tournament_id = ?', draft)).toBe(0)
    expect(await stored(draft)).toEqual(before)
    expect(emailOutbox).toEqual([])
  })

  it('answers OPTIONS on the approval endpoint 204, and, with the switch set, does not answer that review is closed', async () => {
    const res = await invoke(approvalOptions, { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    const { club, representative } = await people()
    const draft = await draftFor(representative, club)
    expect(await error(await submit(undefined, draft))).not.toBe(APPROVAL_CLOSED)
  })

  it('see the public list without a hidden draft, and without the approval columns on a listed event', async () => {
    const { club, representative, admin } = await people()
    const hidden = await draftFor(representative, club, { name: 'Example Hidden Draft' })
    const listedId = await draftFor(representative, club, { name: 'Example Listed Open' })
    await submit(representative, listedId)
    expect((await approve(admin, listedId)).status).toBe(200)
    for (const as of [undefined, (await people()).member]) {
      const body = await (await invoke(tournamentsGet, { as })).json<{ tournaments: Array<Record<string, unknown>> }>()
      expect(body.tournaments.find((t) => t.id === hidden), 'the draft').toBeUndefined()
      const row = body.tournaments.find((t) => t.id === listedId)
      expect(row, 'the approved event').toBeDefined()
      for (const key of ['needs_lca_approval', 'approval_requested_at', 'approved_at', 'approved_by', 'created_by']) {
        expect(Object.hasOwn(row!, key), key).toBe(false)
      }
    }
  })
})

describe('a regional representative and an LCA admin, from the create to the public list', () => {
  it('moves one event through the wait, with the mail each move causes, the approval standing after, and a replay changing nothing', async () => {
    const { club, representative, admin } = await people()
    const repAddress = await addressOf(representative)
    const adminAddress = await addressOf(admin)

    // Create: hidden, marked, free, the representative's.
    const eventName = 'Example Fall Open'
    const created = await invoke(createTournament, { method: 'POST', as: representative, body: createBody(club, { name: eventName }) })
    expect(created.status).toBe(201)
    const row = await env.DB.prepare('SELECT id FROM tournaments WHERE name = ?').bind(eventName).first<{ id: string }>()
    const id = row!.id
    expect(await stored(id)).toMatchObject({ club_id: club, created_by: representative, is_visible: 0, needs_lca_approval: 1, entry_fee: 0, approval_requested_at: null, approved_at: null })

    // A price is refused with the payout words, and nothing about the event moves.
    const priced = await invoke(createTournament, { method: 'POST', as: representative, body: createBody(club, { entryFee: 25 }) })
    expect(priced.status).toBe(403)
    expect(await error(priced)).toBe(FEES_NEED_PAYOUT_ACCOUNT)

    // Not listed, and nobody lists it before approval.
    const publicIds = async () => (await (await invoke(tournamentsGet)).json<{ tournaments: Array<{ id: string }> }>()).tournaments.map((t) => t.id)
    expect(await publicIds()).not.toContain(id)
    for (const who of [representative, admin]) {
      const publish = await save(who, id, { isVisible: true })
      expect(publish.status, who).toBe(409)
      expect(await error(publish), who).toBe(WAITING_FOR_APPROVAL)
    }

    // Submit: every LCA admin hears, the representative does not, and the subject names the weekday.
    const sent = await submit(representative, id)
    expect(sent.status).toBe(200)
    expect((await sent.json<{ email: string }>()).email).toBe(EMAIL_WORDS.reviewSent)
    expect(mailTo(adminAddress).map((e) => e.subject)).toEqual([`For LCA review: ${eventName} (Sat, Dec 12, 2026)`])
    expect(mailTo(repAddress)).toEqual([])

    // The representative may not decide.
    for (const res of [await approve(representative, id), await ask(representative, id)]) {
      expect(res.status).toBe(403)
      expect(await res.json()).toEqual({ error: 'Forbidden' })
    }
    expect(await stored(id)).toMatchObject({ is_visible: 0, approved_at: null })

    // Ask for changes: the drafter is emailed the note, and the event is a draft again.
    const asked = await ask(admin, id, 'Example note: please add the room number.')
    expect(asked.status).toBe(200)
    expect((await asked.json<{ email: string }>()).email).toBe(EMAIL_WORDS.changesSent)
    const changes = mailTo(repAddress)
    expect(changes.map((e) => e.subject.split(':')[0])).toEqual(['Changes asked'])
    expect(changes[0].text ?? '').toContain('Example note: please add the room number.')
    expect((await stored(id))?.approval_requested_at).toBeNull()

    // Sent again, then approved: listed for the first time, the drafter told.
    expect((await submit(representative, id)).status).toBe(200)
    expect(mailTo(adminAddress)).toHaveLength(2)
    const approved = await approve(admin, id)
    expect(approved.status).toBe(200)
    expect((await approved.json<{ email: string }>()).email).toBe(EMAIL_WORDS.approvedSent)
    expect(mailTo(repAddress).map((e) => e.subject.split(':')[0])).toEqual(['Changes asked', 'Approved and listed'])
    const settled = await stored(id)
    expect(settled).toMatchObject({ is_visible: 1, approved_by: admin })
    expect(settled?.approved_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(await publicIds()).toContain(id)
    expect(await actionsAbout(id)).toEqual(['tournament_create', 'tournament_submitted', 'tournament_changes_asked', 'tournament_submitted', 'tournament_approved'])

    // A replay changes nothing, sends nothing and writes no second row.
    const mailBefore = emailOutbox.length
    for (const res of [await approve(admin, id), await approve(admin, id)]) {
      expect(res.status).toBe(409)
      expect(await error(res)).toBe(ALREADY_APPROVED)
    }
    expect((await submit(representative, id)).status).toBe(409)
    expect(emailOutbox).toHaveLength(mailBefore)
    expect(await stored(id)).toEqual(settled)
    expect(await actionsAbout(id)).toHaveLength(5)

    // After approval, hiding and listing again is the ordinary save and asks for nothing new.
    expect((await save(representative, id, { isVisible: false })).status).toBe(200)
    expect(await publicIds()).not.toContain(id)
    expect((await save(representative, id, { isVisible: true, venue: 'Example Hall' })).status).toBe(200)
    expect(await publicIds()).toContain(id)
    expect(await stored(id)).toMatchObject({ approved_at: settled?.approved_at, approved_by: admin, is_visible: 1 })
    expect(emailOutbox).toHaveLength(mailBefore)

    // And a raised price is still refused.
    const sectionId = (await env.DB.prepare("SELECT id FROM tournament_sections WHERE tournament_id = ? AND name = 'Open' AND archived_at IS NULL").bind(id).first<{ id: string }>())!.id
    const raised = await save(representative, id, { sections: [{ id: sectionId, name: 'Open', entryFee: 10 }] })
    expect(raised.status).toBe(403)
    expect(await error(raised)).toBe(FEES_NEED_PAYOUT_ACCOUNT)
    expect((await env.DB.prepare('SELECT fee_regular FROM tournament_sections WHERE id = ?').bind(sectionId).first<{ fee_regular: number }>())?.fee_regular).toBe(0)
  })

  it('counts five submits in 24 hours for a representative, refuses the sixth in words, and lets one through again once the oldest is a day old', async () => {
    const { club, representative } = await people()
    const drafts = []
    for (let i = 0; i < 6; i++) drafts.push(await draftFor(representative, club))
    for (const id of drafts.slice(0, 5)) expect((await submit(representative, id)).status).toBe(200)
    const sixth = await submit(representative, drafts[5])
    expect(sixth.status).toBe(429)
    expect(await error(sixth)).toBe('You have sent 5 events for LCA review in the last day. Try again tomorrow.')
    expect((await stored(drafts[5]))?.approval_requested_at).toBeNull()
    // Within the day the oldest row still counts; past it, it does not.
    await ageOldestSubmit(representative, '-23 hours')
    expect((await submit(representative, drafts[5])).status).toBe(429)
    await ageOldestSubmit(representative, '-25 hours')
    expect((await submit(representative, drafts[5])).status).toBe(200)
  })

  it('refuses an LCA admin\'s approve without the second factor, and changes nothing', async () => {
    const { club, representative, admin } = await people()
    const id = await draftFor(representative, club)
    const res = await move(admin, id, { action: 'approve' }, { aal: 'aal1' })
    expect([401, 403]).toContain(res.status)
    expect(await stored(id)).toMatchObject({ approved_at: null, is_visible: 0 })
    expect(emailOutbox).toEqual([])
  })
})

describe('the dates the emails name, across the clock change in America/Chicago', () => {
  it.each([
    ['the spring change, no end date', '2026-03-08', null, 'Sun, Mar 8, 2026'],
    ['the fall change, no end date', '2026-11-01', null, 'Sun, Nov 1, 2026'],
    ['a two day event over the fall change', '2026-10-31', '2026-11-01', 'Sat, Oct 31 to Sun, Nov 1, 2026'],
    ['a one day event whose end date repeats its date', '2026-11-01', '2026-11-01', 'Sun, Nov 1, 2026'],
    ['a two day event over a year\'s end', '2026-12-31', '2027-01-01', 'Thu, Dec 31, 2026 to Fri, Jan 1, 2027'],
  ] as const)('writes %s as a weekday on each day, in the review and approval emails', async (_label, date, endDate, words) => {
    const { club, representative, admin } = await people()
    const id = await draftFor(representative, club, { name: 'Example Fall Open', date, endDate })
    await submit(representative, id)
    await approve(admin, id)
    const adminMail = mailTo(await addressOf(admin))
    const repMail = mailTo(await addressOf(representative))
    expect(adminMail).toHaveLength(1)
    expect(repMail).toHaveLength(1)
    for (const mail of [...adminMail, ...repMail]) {
      expect(mail.subject.startsWith(mail === adminMail[0] ? 'For LCA review' : 'Approved and listed'), mail.subject).toBe(true)
      for (const text of [mail.subject, mail.html, mail.text ?? '']) {
        // The review's subject carries the days; the approval's names the event, and carries them in its body.
        if (!(text === mail.subject && mail !== adminMail[0])) expect(text, mail.subject).toContain(words)
        expect(text, mail.subject).not.toMatch(LONG_DASH)
        expect(text, mail.subject).not.toMatch(OLD_INITIALS)
        expect(text, mail.subject).not.toMatch(/\d\.5\b/)
      }
    }
  })
})

describe('a holder of a regional seat, whatever their role, and the people around them', () => {
  it.each(['member', 'club_rep', 'tournament_director', 'lca_observer'] as const)('lets a %s who holds the seat create for a club of the region and see My region, and not for another region\'s club', async (role) => {
    const { club, farClub } = await people()
    // A club's rep holds a club of their own in the region, as the rule for their own club needs.
    const own = role === 'club_rep' ? await clubIn(REGION, 'Example Knights Club') : undefined
    const holder = await seedMember({ role, fullName: 'Player Five', clubId: own })
    await seatOver(holder)
    const made = await invoke(createTournament, { method: 'POST', as: holder, body: createBody(club) })
    expect(made.status).toBe(201)
    const mine = await invoke(regionGet, { as: holder })
    expect(mine.status).toBe(200)
    const clubs = (await mine.json<{ clubs: Array<{ id: string }> }>()).clubs.map((c) => c.id)
    expect(clubs).toContain(club)
    expect(clubs).not.toContain(farClub)
    const far = await invoke(createTournament, { method: 'POST', as: holder, body: createBody(farClub) })
    expect(far.status).toBe(403)
  })

  it('refuses another region\'s representative every move on the event, and shows them no hidden draft', async () => {
    const { club, representative } = await people()
    const draft = await draftFor(representative, club)
    const other = await seedMember({ fullName: 'Player Six' })
    await seatOver(other, [FAR])
    expect((await invoke(createTournament, { method: 'POST', as: other, body: createBody(club) })).status).toBe(403)
    expect((await submit(other, draft)).status).toBe(403)
    expect((await approve(other, draft)).status).toBe(403)
    expect((await invoke(manageGet, { as: other, params: { id: draft } })).status).toBe(403)
    expect((await save(other, draft, { venue: 'Example Hall' })).status).toBe(403)
    expect((await invoke(assignDirector, { method: 'POST', as: other, params: { id: draft }, body: { memberId: other } })).status).toBe(403)
    expect(await stored(draft)).toMatchObject({ approval_requested_at: null, is_visible: 0 })
    expect(emailOutbox).toEqual([])
  })

  it('lets a club\'s rep run their own event as before, with no wait on it, and refuses them the representative\'s moves', async () => {
    const { club, clubRep, admin } = await people()
    const own = await seedTournament({ clubId: club, createdBy: clubRep, entryFee: 20, sections: [{ name: 'Open', entryFee: 20 }], isVisible: false })
    expect((await invoke(manageGet, { as: clubRep, params: { id: own } })).status).toBe(200)
    expect((await save(clubRep, own, { isVisible: true })).status).toBe(200)
    expect((await submit(clubRep, own)).status).toBe(403)
    expect((await approve(clubRep, own)).status).toBe(403)
    expect((await invoke(regionGet, { as: clubRep })).status).toBe(403)
    expect(await stored(own)).toMatchObject({ is_visible: 1, needs_lca_approval: 0 })
    // The event is not marked, so an LCA admin's move on it is refused in words, nothing written.
    const refused = await approve(admin, own)
    expect(refused.status).toBe(409)
    expect(await error(refused)).toBe('This event does not wait for LCA approval.')
  })

  it('gives a director a representative named the console of that event and not its price, its directors or the wait', async () => {
    const { club, representative, admin } = await people()
    const draft = await draftFor(representative, club)
    const director = await seedMember({ fullName: 'Player Seven' })
    const named = await invoke(assignDirector, { method: 'POST', as: representative, params: { id: draft }, body: { memberId: director } })
    expect(named.status).toBe(201)
    expect((await invoke(manageGet, { as: director, params: { id: draft } })).status).toBe(200)
    const sectionId = (await env.DB.prepare("SELECT id FROM tournament_sections WHERE tournament_id = ? AND name = 'Open' AND archived_at IS NULL").bind(draft).first<{ id: string }>())!.id
    const raised = await save(director, draft, { sections: [{ id: sectionId, name: 'Open', entryFee: 10 }] })
    expect(raised.status).toBe(403)
    expect(await error(raised)).toBe(FEES_NEED_PAYOUT_ACCOUNT)
    const another = await seedMember({ fullName: 'Player Eight' })
    expect((await invoke(assignDirector, { method: 'POST', as: director, params: { id: draft }, body: { memberId: another } })).status).toBe(403)
    expect((await submit(director, draft)).status).toBe(403)
    expect((await approve(director, draft)).status).toBe(403)
    const publish = await save(director, draft, { isVisible: true })
    expect(publish.status).toBe(409)
    expect(await error(publish)).toBe(WAITING_FOR_APPROVAL)
    expect((await approve(admin, draft)).status).toBe(200)
  })

  it('shows an LCA admin every club on My region, and an LCA admin\'s approval of an event of any region', async () => {
    const { club, farClub, representative, admin } = await people()
    const clubs = (await (await invoke(regionGet, { as: admin })).json<{ clubs: Array<{ id: string }> }>()).clubs.map((c) => c.id)
    expect(clubs).toEqual(expect.arrayContaining([club, farClub]))
    const farDraft = await draftFor(representative, farClub)
    expect((await approve(admin, farDraft)).status).toBe(200)
  })
})

describe('what a representative does while running an event', () => {
  async function runningEvent() {
    const world = await people()
    const id = await draftFor(world.representative, world.club, { name: 'Example Fall Open' })
    await env.DB.prepare("UPDATE tournaments SET approved_at = datetime('now'), is_visible = 1 WHERE id = ?").bind(id).run()
    const cash = await seedMember({ fullName: 'Player Two', email: 'player.two@example.org' })
    const card = await seedMember({ fullName: 'Player Nine', email: 'player.nine@example.org' })
    const walkIn = await seedMember({ role: 'guest', fullName: 'Player Ten', email: 'player.ten@walkin.lca.invalid' })
    const waitlisted = await seedMember({ fullName: 'Player Eleven', email: 'player.eleven@example.org' })
    const withdrawn = await seedMember({ fullName: 'Player Twelve', email: 'player.twelve@example.org' })
    const cashEntry = await seedRegistration({ tournamentId: id, memberId: cash, paymentStatus: 'pending' })
    const cardEntry = await seedRegistration({ tournamentId: id, memberId: card, paymentStatus: 'paid' })
    await seedRegistration({ tournamentId: id, memberId: walkIn, paymentStatus: 'paid' })
    const waitEntry = await seedRegistration({ tournamentId: id, memberId: waitlisted, paymentStatus: 'pending' })
    const outEntry = await seedRegistration({ tournamentId: id, memberId: withdrawn, paymentStatus: 'pending' })
    await env.DB.prepare("UPDATE registrations SET waitlisted_at = datetime('now') WHERE id = ?").bind(waitEntry).run()
    await env.DB.prepare("UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?").bind(outEntry).run()
    await env.DB.prepare(
      `INSERT INTO payments (id, member_id, amount, type, reference_id, status, stripe_session_id, stripe_payment_intent)
       VALUES (?, ?, 30, 'tournament', ?, 'completed', 'cs_example', 'pi_example')`,
    ).bind(`pay-${cardEntry}`, card, cardEntry).run()
    return { ...world, id, cash, card, cashEntry, cardEntry }
  }
  const mark = (as: string, entry: string, paymentStatus: string) =>
    invoke(patchRegistration, { method: 'PATCH', as, params: { id: entry }, body: { paymentStatus } })
  const status = async (entry: string) => (await env.DB.prepare('SELECT payment_status FROM registrations WHERE id = ?').bind(entry).first<{ payment_status: string }>())?.payment_status

  it('marks cash on an entry, and is refused a refund and a change to a card entry, which an LCA admin may make', async () => {
    const { representative, admin, cashEntry, cardEntry } = await runningEvent()
    expect((await mark(representative, cashEntry, 'paid')).status).toBe(200)
    expect(await status(cashEntry)).toBe('paid')

    const refund = await mark(representative, cashEntry, 'refunded')
    expect(refund.status).toBe(403)
    expect(await error(refund)).toBe('Only an LCA admin can record refunds')
    expect(await status(cashEntry)).toBe('paid')

    const cardChange = await mark(representative, cardEntry, 'pending')
    expect(cardChange.status).toBe(403)
    expect(await error(cardChange)).toBe('This entry was paid by card. Ask an LCA admin to change it.')
    expect(await status(cardEntry)).toBe('paid')

    expect((await mark(admin, cardEntry, 'refunded')).status).toBe(200)
    expect(await status(cardEntry)).toBe('refunded')
  })

  it('reads the console with every entrant\'s details, and refuses a plain member the same read', async () => {
    const { representative, member, id } = await runningEvent()
    const mine = await invoke(manageGet, { as: representative, params: { id } })
    expect(mine.status).toBe(200)
    const text = await mine.response.clone().text()
    expect(text).toContain('Player Two')
    const theirs = await invoke(manageGet, { as: member, params: { id } })
    expect(theirs.status).toBe(403)
    expect(await theirs.response.clone().text()).not.toContain('Player Two')
  })

  it('emails each active entrant once, and not a walk-in, a waitlisted or a withdrawn entry, and refuses a plain member', async () => {
    const { representative, member, id } = await runningEvent()
    const refused = await invoke(announce, { method: 'POST', as: member, params: { id }, body: { subject: 'Example subject', body: 'Example body' } })
    expect(refused.status).toBe(403)
    expect(emailOutbox).toEqual([])
    const res = await invoke(announce, { method: 'POST', as: representative, params: { id }, body: { subject: 'Example subject', body: 'Example body' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: 2, failed: 0, total: 2 })
    expect(emailOutbox.map((e) => e.to).sort()).toEqual(['player.nine@example.org', 'player.two@example.org'])
    expect(await count("SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'announcement_sent'")).toBe(1)
  })
})
