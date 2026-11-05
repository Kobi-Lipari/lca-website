// test/integration/published-review-edges.test.ts
//
// The notice of WS08 step 6 (D22 by email, criterion 13 of brief 1.4's WS08
// section) at its edges, through the real setup save, PATCH
// /api/admin/tournaments/[id], on the database built from the migrations,
// reading the stored row, the activity log and the harness's outbox after
// every call:
// - listed the moment it is published: a standing director's draft is in no
//   public list before the save and in all three right after it answers,
//   the list, the event page and the search, with the mark answered to the
//   event's managers alone, and an email outage holds nothing back;
// - the save calls the notice only on the change from hidden to listed and
//   only while CREATION_ROLES_ON is set: never while it is unset, whoever
//   publishes; not for a save that leaves the event hidden or listed, nor
//   an unpublish, nor a save refused for its role, its fee, its sections or
//   a missing event;
// - whose event sends is the grant its creator then holds, as the brief's
//   Listing paragraph has it: no club rep's event, no event of a creator
//   who holds the President seat or has since become an LCA admin, no event
//   with no creator; an event whose creator holds the standing director
//   grant at the publish sends, whoever publishes it, a one-event director
//   among them; and an event first published while the constant was unset
//   gets its one notice at its first publish once it is set;
// - role safety: everyone who may not save the event, signed out or of any
//   role, a guest named to direct it among them, is refused with no event in
//   the answer, nothing sent and no mark;
// - the admins' addresses: one email to each distinct address, blank ones,
//   ones with no @ and every other role left out, two rows that differ only
//   in letter case or spaces at either end getting one between them; no
//   admin at all, one admin's address failing, and the transport handed one
//   address in every message;
// - the email carries what the save stored: a new name and new days, an end
//   date cleared, and an id a link must write whole; and holds no dash, not
//   the old initials and a weekday on every date;
// - the mark is the database's own time in UTC; five publishes at once mark
//   once and send once; two drafts at once each send their own.
// CREATION_ROLES_ON is false in the tree. It is read here through a getter
// on the mocked module, set for every case but those that unset it. The
// notice's module is mocked to keep each call the save makes, and its
// answer, and to call the real notice for every one. The notice's 400 ms
// between one admin's email and the next take no time here (quickPauses,
// below).
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import { onRequestGet as tournamentGet } from '../../functions/api/tournaments/[id]'
import { sendPublishedReviewNotice } from '../../functions/utils/events/publishedReview'
import { answerSearch } from '../../functions/utils/search'
import { FEES_NEED_PAYOUT_ACCOUNT } from '../../domain/events/creation'
import type { Env } from '../../functions/types'
import { seedClub, seedMember, seedPresident, seedTournament, seedTournamentDirector } from './factories'
import { emailBehavior, emailOutbox, invoke, resetHarness } from './harness'

const flags = vi.hoisted(() => ({ rolesOn: false }))
vi.mock('../../functions/utils/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/creation')>()
  return {
    ...real,
    get CREATION_ROLES_ON() {
      return flags.rolesOn
    },
  }
})

/** Every call of the notice, in order, with the event it was asked about and what it answered. */
const notices = vi.hoisted(() => ({ calls: [] as Array<{ id: string; answer: { notified: boolean; sent: number } }> }))
vi.mock('../../functions/utils/events/publishedReview', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/publishedReview')>()
  return {
    ...real,
    sendPublishedReviewNotice: async (...args: Parameters<typeof real.sendPublishedReviewNotice>) => {
      const answer = await real.sendPublishedReviewNotice(...args)
      notices.calls.push({ id: args[1], answer })
      return answer
    },
  }
})

/**
 * The notice waits 400 ms between one admin's email and the next. The admins
 * each case seeds stay in the file's database for the cases after it, so
 * here setTimeout calls back on the next microtask and the waits take no
 * time. Nothing else the cases run sets a timer.
 */
function quickPauses() {
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void) => {
    queueMicrotask(callback)
    return 0
  }) as unknown as typeof setTimeout)
}

beforeEach(() => {
  resetHarness()
  flags.rolesOn = true
  notices.calls.length = 0
  quickPauses()
})
afterEach(() => {
  flags.rolesOn = false
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const SITE = 'https://www.louisianachess.org'
/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)

let seq = 0
/** A word of letters alone that no other row holds, so a search finds this test's event and no other. */
const uniqueWord = () => `Kisatchie${String(++seq).split('').map((d) => 'abcdefghij'[Number(d)]).join('')}`

/** Two LCA admins with addresses of their own, and their addresses. */
async function seedAdmins(): Promise<string[]> {
  const n = ++seq
  const addresses = [`edge-admin-${n}-a@test.lca`, `edge-admin-${n}-b@test.lca`]
  for (const email of addresses) await seedMember({ role: 'lca_admin', email, fullName: `Edge Admin ${email}` })
  return addresses
}

/** Every distinct LCA admin address in the database, read here as the brief has it: each address once, whatever its letter case or spaces. */
async function expectedRecipients(): Promise<string[]> {
  const { results } = await env.DB.prepare("SELECT email FROM members WHERE role = 'lca_admin'").all<{ email: string }>()
  return [...new Set(results.map((r) => r.email.trim().toLowerCase()).filter((e) => e.includes('@')))].sort()
}

/** The outbox's addresses, as written, in letter case folded and sorted. */
const recipients = () => emailOutbox.map((e) => e.to.toLowerCase()).sort()

/** A standing director, today's tournament_director role. */
async function seedStandingDirector(fullName = 'Gerald Landry'): Promise<{ id: string; email: string }> {
  const email = `standing-${++seq}@test.lca`
  return { id: await seedMember({ role: 'tournament_director', fullName, email }), email }
}

/** An event made through the create, as its creator makes it: a hidden draft. */
async function created(as: string, body: Record<string, unknown>): Promise<string> {
  const res = await invoke(createTournament, { method: 'POST', as, body: { location: 'Lafayette, LA', entryFee: 20, ...body } })
  expect(res.status).toBe(201)
  return (await res.json<{ tournament: { id: string } }>()).tournament.id
}

const save = (as: string | undefined, id: string, body: Record<string, unknown>) =>
  invoke(patchTournament, { method: 'PATCH', ...(as ? { as } : {}), params: { id }, body })

async function rowOf(id: string) {
  return env.DB.prepare('SELECT is_visible, review_notified_at, created_by, name FROM tournaments WHERE id = ?')
    .bind(id).first<{ is_visible: number; review_notified_at: string | null; created_by: string | null; name: string }>()
}

/** The event's publish and unpublish rows in the activity log, oldest first, each with its detail read. */
async function publishRows(id: string): Promise<Array<{ action: string; actor_id: string; target_label: string; detail: Record<string, unknown> }>> {
  const { results } = await env.DB.prepare(
    "SELECT action, actor_id, target_label, detail FROM admin_audit_log WHERE action IN ('tournament_publish', 'tournament_unpublish') AND json_extract(detail, '$.tournament_id') = ? ORDER BY rowid",
  ).bind(id).all<{ action: string; actor_id: string; target_label: string; detail: string }>()
  return results.map((r) => ({ ...r, detail: JSON.parse(r.detail) as Record<string, unknown> }))
}

/** The public list's rows, as a visitor or the member given reads them. */
async function listed(as?: string): Promise<Array<Record<string, unknown>>> {
  const res = await invoke(tournamentsGet, as ? { as } : {})
  expect(res.status).toBe(200)
  return (await res.json<{ tournaments: Array<Record<string, unknown>> }>()).tournaments
}

/** The search's Tournaments group, as a visitor reads it, with the clock held at noon in Louisiana on Thursday, November 5, 2026. */
async function searched(word: string): Promise<string[]> {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-05T18:00:00.000Z'))
  try {
    const res = await invoke((context) => answerSearch(context, null), { path: `/api/search?q=${encodeURIComponent(word)}` })
    expect(res.status).toBe(200)
    const body = await res.json<{ groups: Array<{ type: string; items: Array<{ id: string }> }> }>()
    return body.groups.find((g) => g.type === 'tournaments')?.items.map((i) => i.id) ?? []
  } finally {
    vi.useRealTimers()
  }
}

describe('listed the moment it is published (criterion 13)', () => {
  it('a standing director\'s draft is in no public list before the save and in the list, the event page and the search the moment it answers, the mark answered to its managers alone', async () => {
    await seedAdmins()
    const admin = await seedMember({ role: 'lca_admin', email: `listing-admin-${++seq}@test.lca` })
    const director = await seedStandingDirector()
    const word = uniqueWord()
    const id = await created(director.id, { name: `${word} Winter Quads`, date: '2026-12-05' })

    expect((await listed()).map((t) => t.id)).not.toContain(id)
    expect((await invoke(tournamentGet, { params: { id } })).status).toBe(404)
    expect(await searched(word)).not.toContain(`event:${id}`)

    expect((await save(director.id, id, { isVisible: true })).status).toBe(200)
    const mark = (await rowOf(id))?.review_notified_at
    expect(mark).toBeTruthy()

    const item = (await listed()).find((t) => t.id === id)
    expect(item).toBeDefined()
    expect(item).not.toHaveProperty('review_notified_at')
    const page = await invoke(tournamentGet, { params: { id } })
    expect(page.status).toBe(200)
    const { tournament } = await page.json<{ tournament: Record<string, unknown> }>()
    expect(tournament.id).toBe(id)
    expect(tournament).not.toHaveProperty('review_notified_at')
    expect(await searched(word)).toContain(`event:${id}`)

    // The event's managers are answered the mark as stored.
    expect((await listed(admin)).find((t) => t.id === id)?.review_notified_at).toBe(mark)
    expect((await listed(director.id)).find((t) => t.id === id)?.review_notified_at).toBe(mark)
    expect(recipients()).toEqual(await expectedRecipients())
  })

  it('an email outage holds nothing back: the event is in the public list and on its page the moment the save answers 200', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Outage Listing Open ${++seq}`, date: '2026-12-05' })
    emailBehavior.succeed = false
    expect((await save(director.id, id, { isVisible: true })).status).toBe(200)
    expect((await listed()).map((t) => t.id)).toContain(id)
    expect((await invoke(tournamentGet, { params: { id } })).status).toBe(200)
    expect(await rowOf(id)).toMatchObject({ is_visible: 1 })
    expect((await rowOf(id))?.review_notified_at).toBeTruthy()
    expect(emailOutbox).toEqual([])
  })
})

describe('the save calls the notice only on the change from hidden to listed, and only while the constant is set', () => {
  it('with the constant unset no save calls it, whoever publishes: a standing director, an LCA admin and a club rep, a listed event saved and one published again', async () => {
    flags.rolesOn = false
    await seedAdmins()
    const director = await seedStandingDirector()
    const admin = await seedMember({ role: 'lca_admin', email: `unset-admin-${++seq}@test.lca` })
    const club = await seedClub({ name: `Unset Club ${seq}` })
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    const mine = await seedTournament({ name: `Unset Director Open ${++seq}`, isVisible: false, createdBy: director.id })
    await seedTournamentDirector(mine, director.id)
    const adminsOwn = await seedTournament({ name: `Unset Admin Open ${++seq}`, isVisible: false, createdBy: admin })
    const repsOwn = await seedTournament({ name: `Unset Club Open ${++seq}`, isVisible: false, clubId: club, createdBy: rep })

    for (const [as, id] of [[director.id, mine], [admin, adminsOwn], [rep, repsOwn]] as const) {
      expect((await save(as, id, { isVisible: true })).status).toBe(200)
    }
    for (const isVisible of [true, false, true]) expect((await save(director.id, mine, { isVisible })).status).toBe(200)

    expect(notices.calls).toEqual([])
    expect(emailOutbox).toEqual([])
    for (const id of [mine, adminsOwn, repsOwn]) {
      expect(await rowOf(id), id).toMatchObject({ is_visible: 1, review_notified_at: null })
      for (const row of await publishRows(id)) expect(row.detail, id).toEqual({ tournament_id: id })
    }
  })

  it('with the constant set it is called once for each change from hidden to listed, and not for a save that keeps the event hidden or listed, nor for an unpublish', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Call Count Open ${++seq}`, date: '2026-12-05' })
    const steps: Array<[Record<string, unknown>, number]> = [
      [{ name: `Call Count Open ${seq}, renamed` }, 0],
      [{ isVisible: false }, 0],
      [{ isVisible: true }, 1],
      [{ isVisible: true }, 1],
      [{ description: 'Four rounds, G/45 d5.' }, 1],
      [{ isVisible: false }, 1],
      [{ isVisible: true }, 2],
    ]
    for (const [body, calls] of steps) {
      const res = await save(director.id, id, body)
      expect(res.status, JSON.stringify(body)).toBe(200)
      expect(notices.calls, JSON.stringify(body)).toHaveLength(calls)
    }
    const everyAdmin = await expectedRecipients()
    expect(notices.calls).toEqual([
      { id, answer: { notified: true, sent: everyAdmin.length } },
      { id, answer: { notified: false, sent: 0 } },
    ])
    expect(recipients()).toEqual(everyAdmin)
    expect((await publishRows(id)).map((r) => [r.action, r.detail])).toEqual([
      ['tournament_publish', { tournament_id: id, review_notified: true, review_notices_sent: everyAdmin.length }],
      ['tournament_unpublish', { tournament_id: id }],
      ['tournament_publish', { tournament_id: id, review_notified: false, review_notices_sent: 0 }],
    ])
  })

  it('a refused save calls nothing: a member who does not run the event, a one-event director\'s fee raise, a body the contract refuses, sections the writer refuses and an event that does not exist; the one-event director\'s publish then sends the standing director\'s notice', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const name = `Refusal Open ${++seq}`
    const id = await created(director.id, { name, date: '2026-12-05', entryFee: 20 })
    const oneEvent = await seedMember({ fullName: 'Renee Broussard' })
    await seedTournamentDirector(id, oneEvent)
    const stranger = await seedMember()
    const admin = await seedMember({ role: 'lca_admin', email: `refusal-admin-${++seq}@test.lca` })

    const refusals: Array<[string, string, string, Record<string, unknown>, number, unknown]> = [
      ['a member who does not run the event', stranger, id, { isVisible: true }, 403, { error: 'Forbidden' }],
      ['a one-event director who raises a fee', oneEvent, id, { isVisible: true, sections: [{ name: 'Open', entryFee: 35 }] }, 403, { error: FEES_NEED_PAYOUT_ACCOUNT }],
      ['a body the contract refuses', director.id, id, { isVisible: true, sections: [{ name: ' ', entryFee: 20 }] }, 400, {
        error: 'Some fields are missing or not valid.', fields: { 'sections.0.name': 'Give the section a name.' },
      }],
      ['sections the writer refuses', director.id, id, { isVisible: true, sections: [{ name: 'Open', entryFee: 20 }, { name: 'Open', entryFee: 20 }] }, 400, {
        error: expect.stringMatching(/^Two sections are named .Open.\. Give each section its own name\.$/),
      }],
      ['an event that does not exist', admin, `no-such-event-${++seq}`, { isVisible: true }, 404, { error: 'Tournament not found' }],
    ]
    for (const [label, as, target, body, status, answer] of refusals) {
      const res = await save(as, target, body)
      expect([res.status, await res.json()], label).toEqual([status, answer])
      expect(notices.calls, label).toEqual([])
      expect(emailOutbox, label).toEqual([])
      expect(await rowOf(id), label).toMatchObject({ is_visible: 0, review_notified_at: null })
    }
    expect(await publishRows(id)).toEqual([])

    expect((await save(oneEvent, id, { isVisible: true })).status).toBe(200)
    const everyAdmin = await expectedRecipients()
    expect(notices.calls).toEqual([{ id, answer: { notified: true, sent: everyAdmin.length } }])
    expect(recipients()).toEqual(everyAdmin)
    for (const email of emailOutbox) expect(email.subject).toBe(`Published by Gerald Landry, standing director: ${name} (Sat, Dec 5, 2026)`)
    expect((await publishRows(id)).map((r) => r.actor_id)).toEqual([oneEvent])
  })
})

describe('whose event sends: the grant its creator holds at the publish', () => {
  it('a club rep\'s own club event, made through the create and published by the rep: the notice is asked and sends nothing, with no mark', async () => {
    await seedAdmins()
    const club = await seedClub({ name: `Acadiana Knights ${++seq}`, city: 'Lafayette' })
    const rep = await seedMember({ role: 'club_rep', clubId: club, fullName: 'Casey Rep' })
    const id = await created(rep, { name: `Knights Rapid ${seq}`, date: '2026-12-05' })
    expect(await env.DB.prepare('SELECT club_id, created_by FROM tournaments WHERE id = ?').bind(id).first()).toEqual({ club_id: club, created_by: rep })
    expect((await save(rep, id, { isVisible: true })).status).toBe(200)
    expect(notices.calls).toEqual([{ id, answer: { notified: false, sent: 0 } }])
    expect(await rowOf(id)).toMatchObject({ is_visible: 1, review_notified_at: null })
    expect(emailOutbox).toEqual([])
    expect((await publishRows(id)).map((r) => r.detail)).toEqual([{ tournament_id: id, review_notified: false, review_notices_sent: 0 }])
  })

  it('a tournament director who holds the President seat creates as the president, and that event sends nothing', async () => {
    await seedAdmins()
    const holder = await seedStandingDirector('Pat Seatholder')
    await seedPresident(holder.id)
    const id = await created(holder.id, { name: `Seat Holder Open ${++seq}`, date: '2026-12-05' })
    const createRow = await env.DB.prepare("SELECT detail FROM admin_audit_log WHERE action = 'tournament_create' AND json_extract(detail, '$.tournament_id') = ?")
      .bind(id).first<{ detail: string }>()
    expect(JSON.parse(createRow!.detail)).toEqual({ tournament_id: id, grant: 'president' })
    expect((await save(holder.id, id, { isVisible: true })).status).toBe(200)
    expect(await rowOf(id)).toMatchObject({ is_visible: 1, review_notified_at: null })
    expect(emailOutbox).toEqual([])
  })

  it('a standing director given the President seat after creating, and one made an LCA admin after creating: their events send nothing', async () => {
    await seedAdmins()
    const later = await seedStandingDirector('Dana Laterseat')
    const promoted = await seedStandingDirector('Lee Promoted')
    const seated = await created(later.id, { name: `Later Seat Open ${++seq}`, date: '2026-12-05' })
    const admins = await created(promoted.id, { name: `Promoted Open ${++seq}`, date: '2026-12-05' })
    await seedPresident(later.id)
    await env.DB.prepare("UPDATE members SET role = 'lca_admin' WHERE id = ?").bind(promoted.id).run()
    expect((await save(later.id, seated, { isVisible: true })).status).toBe(200)
    expect((await save(promoted.id, admins, { isVisible: true })).status).toBe(200)
    for (const id of [seated, admins]) expect(await rowOf(id), id).toMatchObject({ is_visible: 1, review_notified_at: null })
    expect(notices.calls.map((c) => c.answer)).toEqual([{ notified: false, sent: 0 }, { notified: false, sent: 0 }])
    expect(emailOutbox).toEqual([])
  })

  it('an event with no creator, published by an LCA admin with the constant set: no email and no mark', async () => {
    await seedAdmins()
    const admin = await seedMember({ role: 'lca_admin', email: `no-creator-admin-${++seq}@test.lca` })
    const id = await seedTournament({ name: `Old Event ${++seq}`, isVisible: false })
    expect((await rowOf(id))?.created_by).toBeNull()
    expect((await save(admin, id, { isVisible: true })).status).toBe(200)
    expect(notices.calls).toEqual([{ id, answer: { notified: false, sent: 0 } }])
    expect(await rowOf(id)).toMatchObject({ is_visible: 1, review_notified_at: null })
    expect(emailOutbox).toEqual([])
  })

  it('an event whose creator holds the standing director grant at the publish sends, though it was made as a club rep\'s, since the brief reads the grant the creator then holds', async () => {
    await seedAdmins()
    const club = await seedClub({ name: `Delta Rooks ${++seq}`, city: 'Monroe' })
    const rep = await seedMember({ role: 'club_rep', clubId: club, fullName: 'Morgan Thibodeaux' })
    const name = `Rooks Swiss ${seq}`
    const id = await created(rep, { name, date: '2026-12-12' })
    await env.DB.prepare("UPDATE members SET role = 'tournament_director' WHERE id = ?").bind(rep).run()
    const admin = await seedMember({ role: 'lca_admin', email: `then-admin-${++seq}@test.lca` })
    expect((await save(admin, id, { isVisible: true })).status).toBe(200)
    expect((await rowOf(id))?.review_notified_at).toBeTruthy()
    expect(recipients()).toEqual(await expectedRecipients())
    for (const email of emailOutbox) expect(email.subject).toBe(`Published by Morgan Thibodeaux, standing director: ${name} (Sat, Dec 12, 2026)`)
  })

  it('an event first published while the constant was unset has no mark, so its first publish once the constant is set sends, once', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Switch Later Open ${++seq}`, date: '2026-12-05' })
    flags.rolesOn = false
    expect((await save(director.id, id, { isVisible: true })).status).toBe(200)
    expect((await save(director.id, id, { isVisible: false })).status).toBe(200)
    expect(notices.calls).toEqual([])
    expect((await rowOf(id))?.review_notified_at).toBeNull()

    flags.rolesOn = true
    expect((await save(director.id, id, { isVisible: true })).status).toBe(200)
    const everyAdmin = await expectedRecipients()
    expect(recipients()).toEqual(everyAdmin)
    for (const isVisible of [false, true]) expect((await save(director.id, id, { isVisible })).status).toBe(200)
    expect(recipients()).toEqual(everyAdmin)
    expect((await publishRows(id)).map((r) => r.detail)).toEqual([
      { tournament_id: id },
      { tournament_id: id },
      { tournament_id: id, review_notified: true, review_notices_sent: everyAdmin.length },
      { tournament_id: id },
      { tournament_id: id, review_notified: false, review_notices_sent: 0 },
    ])
  })
})

describe('role safety: no one who may not save the event can make the notice go', () => {
  it('a signed-out visitor gets 401, and a member of every role who does not run the event 403, a guest named to direct it among them, each with no event in the answer, nothing sent and no mark', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Guarded Open ${++seq}`, date: '2026-12-05' })
    const club = await seedClub({ name: `Guard Club ${seq}` })
    const guest = await seedMember({ role: 'guest' })
    await seedTournamentDirector(id, guest)
    const people: Array<[string, string | undefined, number, string]> = [
      ['a signed-out visitor', undefined, 401, 'Unauthorized'],
      ['a plain member', await seedMember(), 403, 'Forbidden'],
      ['an observer who holds no seat', await seedMember({ role: 'lca_observer' }), 403, 'Forbidden'],
      ['an officer', await seedMember({ role: 'lca_officer' }), 403, 'Forbidden'],
      ['an auditor', await seedMember({ role: 'lca_auditor' }), 403, 'Forbidden'],
      ['another standing director', (await seedStandingDirector('Other Director')).id, 403, 'Forbidden'],
      ['a club rep', await seedMember({ role: 'club_rep', clubId: club }), 403, 'Forbidden'],
      ['a guest named to direct the event', guest, 403, 'Forbidden'],
    ]
    for (const [label, as, status, error] of people) {
      const res = await save(as, id, { isVisible: true })
      expect([res.status, await res.json()], label).toEqual([status, { error }])
    }
    expect(notices.calls).toEqual([])
    expect(emailOutbox).toEqual([])
    expect(await rowOf(id)).toMatchObject({ is_visible: 0, review_notified_at: null })
    expect(await publishRows(id)).toEqual([])
  })
})

describe('the LCA admins\' addresses', () => {
  it('one email to each distinct admin address: blank ones and ones with no @ left out, two rows that differ only in letter case and spaces getting one, and no other role written to', async () => {
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Address Open ${++seq}`, date: '2026-12-05' })
    const n = ++seq
    const shared = `shared.admin-${n}@test.lca`
    const odd = [
      await seedMember({ role: 'lca_admin', email: '' }),
      await seedMember({ role: 'lca_admin', email: `no-at-sign-${n}.test.lca` }),
      await seedMember({ role: 'lca_admin', email: `  Shared.Admin-${n}@Test.LCA  ` }),
      await seedMember({ role: 'lca_admin', email: shared }),
    ]
    const club = await seedClub({ name: `Address Club ${n}` })
    const others: string[] = []
    for (const role of ['lca_observer', 'lca_officer', 'lca_auditor', 'club_rep', 'tournament_director', 'member', 'guest']) {
      const email = `${role}-${n}@test.lca`
      others.push(email)
      await seedMember({ role, email, ...(role === 'club_rep' ? { clubId: club } : {}) })
    }
    try {
      expect((await save(director.id, id, { isVisible: true })).status).toBe(200)
      const sent = emailOutbox.map((e) => e.to)
      for (const to of sent) {
        expect(to, to).toBe(to.trim())
        expect(to, to).toMatch(/^[^\s,;]+@[^\s,;]+$/)
      }
      expect(new Set(sent.map((to) => to.toLowerCase())).size).toBe(sent.length)
      expect(sent.filter((to) => to.toLowerCase() === shared)).toHaveLength(1)
      for (const email of [...others, director.email]) expect(recipients(), email).not.toContain(email)
      expect(recipients()).toEqual(await expectedRecipients())
      expect((await publishRows(id))[0].detail).toEqual({ tournament_id: id, review_notified: true, review_notices_sent: sent.length })
    } finally {
      for (const member of odd) await env.DB.prepare("UPDATE members SET role = 'member' WHERE id = ?").bind(member).run()
    }
  })

  it('with no LCA admin at all, the publish sets the mark, sends nothing and answers 200, and no later publish sends once the admins are back', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `No Admin Open ${++seq}`, date: '2026-12-05' })
    const { results } = await env.DB.prepare("SELECT id FROM members WHERE role = 'lca_admin'").all<{ id: string }>()
    expect(results.length).toBeGreaterThan(0)
    try {
      await env.DB.prepare("UPDATE members SET role = 'member' WHERE role = 'lca_admin'").run()
      expect((await save(director.id, id, { isVisible: true })).status).toBe(200)
      expect(await rowOf(id)).toMatchObject({ is_visible: 1 })
      expect((await rowOf(id))?.review_notified_at).toBeTruthy()
      expect(emailOutbox).toEqual([])
      expect((await publishRows(id))[0].detail).toEqual({ tournament_id: id, review_notified: true, review_notices_sent: 0 })
      expect((await listed()).map((t) => t.id)).toContain(id)
    } finally {
      for (const { id: member } of results) await env.DB.prepare("UPDATE members SET role = 'lca_admin' WHERE id = ?").bind(member).run()
    }
    for (const isVisible of [false, true]) expect((await save(director.id, id, { isVisible })).status).toBe(200)
    expect(emailOutbox).toEqual([])
  })

  it('an outage for one admin\'s address: the others get theirs, the row counts what went, and that admin is never sent one later', async () => {
    const [failing] = await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Partial Outage Open ${++seq}`, date: '2026-12-05' })
    emailBehavior.succeed = false
    emailBehavior.failFor = [failing]
    expect((await save(director.id, id, { isVisible: true })).status).toBe(200)
    const everyAdmin = await expectedRecipients()
    expect(recipients()).toEqual(everyAdmin.filter((to) => to !== failing))
    expect((await publishRows(id))[0].detail).toEqual({ tournament_id: id, review_notified: true, review_notices_sent: everyAdmin.length - 1 })
    expect((await rowOf(id))?.review_notified_at).toBeTruthy()
    emailBehavior.succeed = true
    emailBehavior.failFor = null
    for (const isVisible of [false, true]) expect((await save(director.id, id, { isVisible })).status).toBe(200)
    expect(recipients()).not.toContain(failing)
    expect(emailOutbox).toHaveLength(everyAdmin.length - 1)
  })

  it('the transport is handed one address in every message, never several, and no message names any admin\'s address', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Transport Open ${++seq}`, date: '2026-12-05' })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect((await save(director.id, id, { isVisible: true })).status).toBe(200)
    const handed = fetchSpy.mock.calls
      .filter(([input]) => (input instanceof Request ? input.url : String(input)).startsWith('https://api.resend.com/'))
      .map(([, init]) => JSON.parse(String(init?.body)) as { to: unknown; subject: string; html: string; text?: string })
    const everyAdmin = await expectedRecipients()
    expect(handed).toHaveLength(everyAdmin.length)
    for (const message of handed) {
      expect(Array.isArray(message.to)).toBe(true)
      expect(message.to).toHaveLength(1)
      for (const address of everyAdmin) expect(`${message.subject}\n${message.html}\n${message.text}`.toLowerCase()).not.toContain(address)
    }
    expect(handed.map((m) => (m.to as string[])[0].toLowerCase()).sort()).toEqual(everyAdmin)
  })
})

describe('the email carries what the save stored', () => {
  it('a publish that also renames and moves the event writes the new name and days in the subject, the details and the text, and the row\'s label', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const n = ++seq
    const id = await created(director.id, { name: `Bayou Quads ${n}`, date: '2026-12-05' })
    const res = await save(director.id, id, { isVisible: true, name: `Bayou Swiss ${n}`, date: '2026-12-12', endDate: '2026-12-13' })
    expect(res.status).toBe(200)
    expect(emailOutbox.length).toBe((await expectedRecipients()).length)
    for (const email of emailOutbox) {
      expect(email.subject).toBe(`Published by Gerald Landry, standing director: Bayou Swiss ${n} (Sat, Dec 12 to Sun, Dec 13, 2026)`)
      expect(email.html).toContain(`>Bayou Swiss ${n}<`)
      expect(email.html).toContain('>Sat, Dec 12 to Sun, Dec 13, 2026<')
      expect(`${email.subject}${email.html}${email.text}`).not.toContain(`Bayou Quads ${n}`)
      expect(email.text?.split('\n')).toEqual(expect.arrayContaining([`Event: Bayou Swiss ${n}`, 'When: Sat, Dec 12 to Sun, Dec 13, 2026']))
    }
    expect((await publishRows(id)).map((r) => r.target_label)).toEqual([`Bayou Swiss ${n}`])
  })

  it('a publish that clears the end date writes the one day', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const name = `Cleared End Open ${++seq}`
    const id = await created(director.id, { name, date: '2026-12-05', endDate: '2026-12-06' })
    expect((await save(director.id, id, { isVisible: true, endDate: null })).status).toBe(200)
    expect(emailOutbox.length).toBeGreaterThan(0)
    for (const email of emailOutbox) {
      expect(email.subject).toBe(`Published by Gerald Landry, standing director: ${name} (Sat, Dec 5, 2026)`)
      expect(email.text?.split('\n')).toContain('When: Sat, Dec 5, 2026')
    }
  })

  it('writes an id a link must encode whole, so Look it over opens that event\'s manage page and no other', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = `gulf coast quads & blitz #${++seq}`
    await seedTournament({ id, name: `Gulf Coast Quads ${seq}`, isVisible: false, createdBy: director.id, date: '2026-12-05' })
    await seedTournamentDirector(id, director.id)
    expect((await save(director.id, id, { isVisible: true })).status).toBe(200)
    const link = `${SITE}/admin/tournaments/${encodeURIComponent(id)}`
    expect(link).not.toMatch(/[ &#]/)
    expect(emailOutbox.length).toBeGreaterThan(0)
    for (const email of emailOutbox) {
      expect(email.html).toContain(`href="${link}"`)
      expect(email.text?.split('\n').at(-1)).toBe(`Look it over: ${link}`)
    }
  })

  it('holds no dash and not the old initials anywhere, gives every date its weekday, writes no time on a 24-hour clock, and keeps names as text', async () => {
    await seedAdmins()
    const director = await seedStandingDirector("Gerald O'Landry")
    const name = `New Year <Blitz> & Quads ${++seq}`
    const id = await created(director.id, { name, date: '2026-12-31', endDate: '2027-01-01' })
    expect((await save(director.id, id, { isVisible: true })).status).toBe(200)
    expect(emailOutbox.length).toBeGreaterThan(0)
    const months = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec'
    for (const email of emailOutbox) {
      const shown = email.html
        .replace(/<style[\s\S]*?<\/style>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
      expect(email.subject).toBe(`Published by Gerald O'Landry, standing director: ${name} (Thu, Dec 31, 2026 to Fri, Jan 1, 2027)`)
      expect(shown).toContain(`Gerald O'Landry, standing director`)
      expect(shown).toContain(name)
      expect(email.html).not.toContain('<Blitz>')
      for (const text of [email.subject, email.html, email.text ?? '', shown]) {
        expect(text).not.toMatch(DASHES)
        expect(text).not.toMatch(OLD_INITIALS)
      }
      for (const text of [email.subject, email.text ?? '', shown]) {
        for (const found of text.matchAll(new RegExp(`\\b(?:${months}) \\d{1,2}\\b`, 'g'))) {
          expect(text.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/^(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat), $/)
        }
        expect(text).not.toMatch(/\b\d{1,2}:\d{2}\b/)
      }
    }
  })
})

describe('the mark, and publishes at the same moment', () => {
  it('the mark is the database\'s own time in UTC, the moment of the publish, and not Louisiana\'s', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Clock Open ${++seq}`, date: '2026-12-05' })
    const before = Date.now()
    expect((await save(director.id, id, { isVisible: true })).status).toBe(200)
    const after = Date.now()
    const mark = (await rowOf(id))?.review_notified_at ?? ''
    expect(mark).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    const at = Date.parse(`${mark.replace(' ', 'T')}Z`)
    // Two minutes either way: Louisiana's clock is five or six hours from UTC.
    expect(at).toBeGreaterThanOrEqual(before - 120_000)
    expect(at).toBeLessThanOrEqual(after + 120_000)
  })

  it('five publishes of one draft at once mark it once, send each admin one email, and only one row says the mark was set', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Five At Once Open ${++seq}`, date: '2026-12-05' })
    const answers = await Promise.all(Array.from({ length: 5 }, () => save(director.id, id, { isVisible: true })))
    expect(answers.map((a) => a.status)).toEqual([200, 200, 200, 200, 200])
    const everyAdmin = await expectedRecipients()
    expect(recipients()).toEqual(everyAdmin)
    expect(notices.calls.filter((c) => c.answer.notified)).toEqual([{ id, answer: { notified: true, sent: everyAdmin.length } }])
    const rows = await publishRows(id)
    expect(rows.filter((r) => r.detail.review_notified === true).map((r) => r.detail)).toEqual([
      { tournament_id: id, review_notified: true, review_notices_sent: everyAdmin.length },
    ])
    for (const row of rows.filter((r) => r.detail.review_notified !== true)) expect(row.detail).toEqual({ tournament_id: id, review_notified: false, review_notices_sent: 0 })
  })

  it('two drafts published at once each send their own notice, naming their own event, one to each admin', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const names = [`Twin Open A ${++seq}`, `Twin Open B ${seq}`]
    const ids = [await created(director.id, { name: names[0], date: '2026-12-05' }), await created(director.id, { name: names[1], date: '2026-12-06' })]
    const answers = await Promise.all(ids.map((id) => save(director.id, id, { isVisible: true })))
    expect(answers.map((a) => a.status)).toEqual([200, 200])
    const everyAdmin = await expectedRecipients()
    expect(emailOutbox).toHaveLength(everyAdmin.length * 2)
    for (const [i, name] of names.entries()) {
      const mine = emailOutbox.filter((e) => e.subject.includes(`: ${name} (`))
      expect(mine.map((e) => e.to.toLowerCase()).sort(), name).toEqual(everyAdmin)
      for (const email of mine) expect(email.html).toContain(`/admin/tournaments/${ids[i]}"`)
      expect((await rowOf(ids[i]))?.review_notified_at, name).toBeTruthy()
    }
  })
})

describe('the helper on its own', () => {
  it('asked about a standing director\'s hidden draft, or an event that does not exist, it sets no mark and sends nothing', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Hidden Helper Open ${++seq}`, date: '2026-12-05' })
    expect(await sendPublishedReviewNotice(env as unknown as Env, id)).toEqual({ notified: false, sent: 0 })
    expect(await sendPublishedReviewNotice(env as unknown as Env, `no-such-event-${++seq}`)).toEqual({ notified: false, sent: 0 })
    expect(await rowOf(id)).toMatchObject({ is_visible: 0, review_notified_at: null })
    expect(emailOutbox).toEqual([])
  })
})
