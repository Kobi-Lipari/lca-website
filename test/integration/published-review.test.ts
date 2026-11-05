// test/integration/published-review.test.ts
//
// D22 by email (WS08 step 6: the email half of criterion 13 of brief 1.4's
// WS08 section). A standing director's event lists the moment it is
// published, and the LCA admins are told after the fact, once per event:
// - with CREATION_ROLES_ON set, the first publish by hand of a standing
//   director's event, made through the create so its creator and its first
//   director row are real, sends one email to each LCA admin's address and
//   to no one else, each to one address, naming the director as a standing
//   director, the event and its date with a weekday on every day, with Look
//   it over opening the event's manage page; it sets review_notified_at, and
//   the publish's row in the activity log says so and counts the emails;
// - unpublishing and publishing again sends nothing more and leaves the
//   mark as it was, and two publishes at once send once, as two calls of
//   the helper at once do, one setting the mark and the other finding it;
// - a two-day event's days are written day by day, with "to" between them
//   and no dash; eventDays reads an end date equal to the start as one day,
//   as it reads none, and gives a span over New Year both years;
// - an LCA admin's event, the president's and an event whose creator has
//   lost the role since send nothing and get no mark, while an LCA admin who
//   publishes a standing director's draft sends the notice, since it reads
//   the creator's grant and not the publisher's;
// - with the constant unset, a standing director's event published sends
//   nothing, gets no mark, and its activity log row is today's;
// - an email outage leaves the mark set, the event listed and the save
//   answering 200; a failure of the database inside the notice fails
//   neither the save nor the publish's row in the activity log, and leaves
//   the event listed: after the mark it leaves the mark set and sends
//   nothing, and before it it leaves no mark, so the next publish sends the
//   event's one notice; and a member who may not publish is refused, with
//   nothing sent and no mark.
// Every case reads the stored row, the activity log and the harness's
// outbox after the call. CREATION_ROLES_ON is false in the tree; it is read
// here through a getter on the mocked module, set for every case but the one
// that unsets it, and put back after each. The notice's 400 ms between one
// admin's email and the next take no time here (quickPauses, below);
// test/unit/published-review-notice.test.ts holds the pace.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as patchTournament } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import { eventDays, markReviewNotified, sendPublishedReviewNotice } from '../../functions/utils/events/publishedReview'
import type { Env } from '../../functions/types'
import { seedMember, seedPresident, seedTournament, seedTournamentDirector } from './factories'
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
  quickPauses()
})
afterEach(() => {
  flags.rolesOn = false
  vi.restoreAllMocks()
})

let seq = 0

const SITE = 'https://www.louisianachess.org'
/** The paragraph every notice carries under its details. */
const AFTER_THE_FACT = "After the fact: nothing holds a standing director's event. It is already listed. Look it over when you can."
/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)

/** Two LCA admins with addresses of their own, and their addresses. */
async function seedAdmins(): Promise<string[]> {
  const n = ++seq
  const addresses = [`review-admin-${n}-a@test.lca`, `review-admin-${n}-b@test.lca`]
  for (const [i, email] of addresses.entries()) await seedMember({ role: 'lca_admin', email, fullName: `Review Admin ${n}${i}` })
  return addresses
}

/** Every LCA admin's address in the database, as the notice reads them. */
async function everyAdminAddress(): Promise<string[]> {
  const { results } = await env.DB.prepare("SELECT email FROM members WHERE role = 'lca_admin' AND email LIKE '%@%' ORDER BY email").all<{ email: string }>()
  return results.map((r) => r.email)
}

/** A standing director, today's tournament_director role, named as the brief's example is. */
async function seedStandingDirector(): Promise<{ id: string; email: string }> {
  const email = `gerald-landry-${++seq}@test.lca`
  return { id: await seedMember({ role: 'tournament_director', fullName: 'Gerald Landry', email }), email }
}

/** An event made through the create, as its creator makes it: a hidden draft. */
async function created(as: string, body: Record<string, unknown>): Promise<string> {
  const res = await invoke(createTournament, { method: 'POST', as, body: { location: 'Lafayette, LA', entryFee: 20, ...body } })
  expect(res.status).toBe(201)
  return (await res.json<{ tournament: { id: string } }>()).tournament.id
}

const save = (as: string | undefined, id: string, isVisible: boolean) =>
  invoke(patchTournament, { method: 'PATCH', ...(as ? { as } : {}), params: { id }, body: { isVisible } })

async function rowOf(id: string) {
  return env.DB.prepare('SELECT is_visible, review_notified_at, created_by FROM tournaments WHERE id = ?')
    .bind(id).first<{ is_visible: number; review_notified_at: string | null; created_by: string | null }>()
}

/** The event's publish and unpublish rows in the activity log, oldest first, each with its detail read. */
async function publishRows(id: string): Promise<Array<{ action: string; detail: Record<string, unknown> }>> {
  const { results } = await env.DB.prepare(
    "SELECT action, detail FROM admin_audit_log WHERE action IN ('tournament_publish', 'tournament_unpublish') AND json_extract(detail, '$.tournament_id') = ? ORDER BY rowid",
  ).bind(id).all<{ action: string; detail: string }>()
  return results.map((r) => ({ action: r.action, detail: JSON.parse(r.detail) as Record<string, unknown> }))
}

/** The outbox's addresses, sorted. */
const sentTo = () => emailOutbox.map((e) => e.to).sort()

/** The ids in the public list, as a signed-out visitor reads it. */
async function publicList(): Promise<string[]> {
  const res = await invoke(tournamentsGet)
  expect(res.status).toBe(200)
  return (await res.json<{ tournaments: Array<{ id: string }> }>()).tournaments.map((t) => t.id)
}

/** What D1 throws when its connection drops under a statement. */
const D1_FAILURE = 'D1_ERROR: Network connection lost.'
/** The notice's read of every admin's address, and creatorGrant's read of the event's creator, as they prepare them. */
const ADMINS_READ = "SELECT email, full_name FROM members WHERE role = 'lca_admin' AND email LIKE '%@%' ORDER BY email"
const CREATOR_READ = 'SELECT m.id, m.role, m.club_id FROM tournaments t JOIN members m ON m.id = t.created_by WHERE t.id = ?'

/**
 * Makes the database fail the one statement given when it runs, as D1 fails a
 * statement whose connection drops, and runs every other statement as it is.
 * Answers how many times it failed, and puts prepare back.
 */
function failWhenRun(sql: string): { failures: () => number; restore: () => void } {
  const real = env.DB.prepare.bind(env.DB)
  let failures = 0
  const fail = async (): Promise<never> => {
    failures++
    throw new Error(D1_FAILURE)
  }
  const failing: { bind: () => unknown; first: () => Promise<never>; all: () => Promise<never>; run: () => Promise<never>; raw: () => Promise<never> } = {
    bind: () => failing, first: fail, all: fail, run: fail, raw: fail,
  }
  const spy = vi.spyOn(env.DB, 'prepare').mockImplementation((query: string) => (query === sql ? (failing as unknown as D1PreparedStatement) : real(query)))
  return { failures: () => failures, restore: () => spy.mockRestore() }
}

describe('a standing director publishes their event (criterion 13, D22)', () => {
  it('sends one email to each LCA admin and no one else, naming the director, the event and its day, and sets the mark the activity log reports', async () => {
    const admins = await seedAdmins()
    const director = await seedStandingDirector()
    const name = `Lafayette Winter Quads ${++seq}`
    const id = await created(director.id, { name, date: '2026-12-05' })
    expect(await rowOf(id)).toMatchObject({ is_visible: 0, review_notified_at: null, created_by: director.id })
    expect(emailOutbox).toEqual([])

    const res = await save(director.id, id, true)
    expect(res.status).toBe(200)
    const { tournament } = await res.json<{ tournament: { is_visible: number; review_notified_at: string | null } }>()

    const row = await rowOf(id)
    expect(row?.is_visible).toBe(1)
    expect(row?.review_notified_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(tournament).toMatchObject({ is_visible: 1, review_notified_at: row?.review_notified_at })

    const everyAdmin = await everyAdminAddress()
    expect(everyAdmin).toEqual(expect.arrayContaining(admins))
    expect(sentTo()).toEqual([...everyAdmin].sort())
    expect(new Set(sentTo()).size).toBe(emailOutbox.length)
    expect(sentTo()).not.toContain(director.email)
    for (const email of emailOutbox) {
      expect(email.to).toMatch(/^[^\s,;]+@[^\s,;]+$/)
      expect(email.subject).toBe(`Published by Gerald Landry, standing director: ${name} (Sat, Dec 5, 2026)`)
      for (const piece of [
        'A standing director published an event', 'Published by', 'Gerald Landry, standing director', name, 'Sat, Dec 5, 2026',
        'now, on Tournaments', AFTER_THE_FACT, 'Look it over', `${SITE}/admin/tournaments/${id}`,
      ]) expect(email.html, piece).toContain(piece)
      for (const line of [
        'Published by: Gerald Landry, standing director', `Event: ${name}`, 'When: Sat, Dec 5, 2026', 'Listed: now, on Tournaments', AFTER_THE_FACT,
        `Look it over: ${SITE}/admin/tournaments/${id}`,
      ]) expect(email.text?.split('\n'), line).toContain(line)
      expect(email.subject).not.toMatch(DASHES)
    }

    expect(await publishRows(id)).toEqual([
      { action: 'tournament_publish', detail: { tournament_id: id, review_notified: true, review_notices_sent: everyAdmin.length } },
    ])
  })

  it('unpublished and published again, sends nothing more and leaves the mark as it was', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Acadiana Swiss ${++seq}`, date: '2026-12-12' })
    expect((await save(director.id, id, true)).status).toBe(200)
    const mark = (await rowOf(id))?.review_notified_at
    expect(mark).toBeTruthy()
    const first = emailOutbox.length
    expect(first).toBe((await everyAdminAddress()).length)

    for (const isVisible of [false, true, false, true]) {
      const res = await save(director.id, id, isVisible)
      expect(res.status, String(isVisible)).toBe(200)
      expect(await rowOf(id), String(isVisible)).toMatchObject({ is_visible: isVisible ? 1 : 0, review_notified_at: mark })
    }
    expect(emailOutbox).toHaveLength(first)

    const rows = await publishRows(id)
    expect(rows.map((r) => r.action)).toEqual(['tournament_publish', 'tournament_unpublish', 'tournament_publish', 'tournament_unpublish', 'tournament_publish'])
    // The first publish set the mark; the later ones found it set and sent nothing; an unpublish's row is today's.
    expect(rows[0].detail).toEqual({ tournament_id: id, review_notified: true, review_notices_sent: first })
    for (const later of [rows[2], rows[4]]) expect(later.detail).toEqual({ tournament_id: id, review_notified: false, review_notices_sent: 0 })
    for (const hidden of [rows[1], rows[3]]) expect(hidden.detail).toEqual({ tournament_id: id })
  })

  it('a save of a listed event that sends isVisible true again, a change of nothing, sends nothing and writes no row', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Bayou Rapid ${++seq}`, date: '2026-12-19' })
    expect((await save(director.id, id, true)).status).toBe(200)
    const sent = emailOutbox.length
    const res = await save(director.id, id, true)
    expect(res.status).toBe(200)
    expect(emailOutbox).toHaveLength(sent)
    expect((await publishRows(id)).map((r) => r.action)).toEqual(['tournament_publish'])
  })

  it('two publishes at once mark the event once and send each admin one email', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Crescent City Open ${++seq}`, date: '2027-01-09' })
    const answers = await Promise.all([save(director.id, id, true), save(director.id, id, true)])
    expect(answers.map((a) => a.status)).toEqual([200, 200])
    const everyAdmin = await everyAdminAddress()
    expect(sentTo()).toEqual([...everyAdmin].sort())
    expect((await rowOf(id))?.review_notified_at).toBeTruthy()
    // The helper itself, asked twice at once about an event already marked, sends nothing more.
    const again = await Promise.all([sendPublishedReviewNotice(env as unknown as Env, id), sendPublishedReviewNotice(env as unknown as Env, id)])
    expect(again).toEqual([{ notified: false, sent: 0 }, { notified: false, sent: 0 }])
    expect(sentTo()).toEqual([...everyAdmin].sort())
  })

  it('the helper asked twice at once about a listed event with no mark: one call sets it and sends, the other sends nothing', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Twin Call Open ${++seq}`, date: '2026-12-05' })
    // Listed as the save's batch lists it, with the mark still empty.
    await env.DB.prepare('UPDATE tournaments SET is_visible = 1 WHERE id = ?').bind(id).run()
    const everyAdmin = await everyAdminAddress()
    const answers = await Promise.all([sendPublishedReviewNotice(env as unknown as Env, id), sendPublishedReviewNotice(env as unknown as Env, id)])
    expect([...answers].sort((a, b) => Number(b.notified) - Number(a.notified))).toEqual([
      { notified: true, sent: everyAdmin.length },
      { notified: false, sent: 0 },
    ])
    expect(sentTo()).toEqual([...everyAdmin].sort())
    expect((await rowOf(id))?.review_notified_at).toBeTruthy()
  })

  it('writes a two-day event day by day, a weekday on each and "to" between them, with no dash', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const name = `Louisiana Open ${++seq}`
    const id = await created(director.id, { name, date: '2026-12-05', endDate: '2026-12-06' })
    expect((await save(director.id, id, true)).status).toBe(200)
    expect(emailOutbox.length).toBe((await everyAdminAddress()).length)
    for (const email of emailOutbox) {
      expect(email.subject).toBe(`Published by Gerald Landry, standing director: ${name} (Sat, Dec 5 to Sun, Dec 6, 2026)`)
      expect(email.html).toContain('Sat, Dec 5 to Sun, Dec 6, 2026')
      expect(email.text?.split('\n')).toContain('When: Sat, Dec 5 to Sun, Dec 6, 2026')
      for (const text of [email.subject, email.text ?? '']) {
        expect(text).not.toMatch(DASHES)
        expect(text).not.toMatch(/Dec 5 ?- ?/)
      }
    }
    expect((await rowOf(id))?.review_notified_at).toBeTruthy()
  })
})

describe('eventDays, the notice\'s dates', () => {
  it('reads an end date equal to the start as one day, as it reads none, and writes more days with a weekday on each and "to" between them', () => {
    expect(eventDays('2026-12-05', null)).toBe('Sat, Dec 5, 2026')
    expect(eventDays('2026-12-05', '2026-12-05')).toBe('Sat, Dec 5, 2026')
    expect(eventDays('2026-12-05', '')).toBe('Sat, Dec 5, 2026')
    expect(eventDays('2026-12-05', '2026-12-06')).toBe('Sat, Dec 5 to Sun, Dec 6, 2026')
    expect(eventDays('2026-11-28', '2026-12-01')).toBe('Sat, Nov 28 to Tue, Dec 1, 2026')
  })

  it('gives a span over New Year both years', () => {
    expect(eventDays('2026-12-31', '2027-01-01')).toBe('Thu, Dec 31, 2026 to Fri, Jan 1, 2027')
  })

  it('writes no dash in any form it gives', () => {
    for (const [date, end] of [['2026-12-05', null], ['2026-12-05', '2026-12-06'], ['2026-12-31', '2027-01-01']] as const) {
      expect(eventDays(date, end)).not.toMatch(DASHES)
      expect(eventDays(date, end)).not.toMatch(/\d ?- ?[A-Z]/)
    }
  })
})

describe('the mark decides the send', () => {
  it('markReviewNotified answers true once for a listed event, then false, and false for a hidden one and one that does not exist', async () => {
    const listed = await seedTournament({ name: `Mark Probe ${++seq}`, isVisible: true })
    const hidden = await seedTournament({ name: `Mark Probe ${++seq}`, isVisible: false })
    expect(await markReviewNotified(env.DB, listed)).toBe(true)
    const mark = (await rowOf(listed))?.review_notified_at
    expect(mark).toBeTruthy()
    expect(await markReviewNotified(env.DB, listed)).toBe(false)
    expect((await rowOf(listed))?.review_notified_at).toBe(mark)
    expect(await markReviewNotified(env.DB, hidden)).toBe(false)
    expect((await rowOf(hidden))?.review_notified_at).toBeNull()
    expect(await markReviewNotified(env.DB, `no-such-event-${++seq}`)).toBe(false)
    expect(emailOutbox).toEqual([])
  })
})

describe('events that send nothing', () => {
  it('an LCA admin\'s event, published by that admin: no email and no mark, and the row says so', async () => {
    await seedAdmins()
    const admin = await seedMember({ role: 'lca_admin', email: `review-publisher-${++seq}@test.lca` })
    const id = await created(admin, { name: `Admin Open ${++seq}`, date: '2026-12-05' })
    expect((await save(admin, id, true)).status).toBe(200)
    expect(await rowOf(id)).toMatchObject({ is_visible: 1, review_notified_at: null })
    expect(emailOutbox).toEqual([])
    expect(await publishRows(id)).toEqual([{ action: 'tournament_publish', detail: { tournament_id: id, review_notified: false, review_notices_sent: 0 } }])
  })

  it('the president\'s event, made through the create and published by the president: no email and no mark', async () => {
    await seedAdmins()
    const president = await seedMember({ role: 'lca_observer', fullName: 'Pat President' })
    await seedPresident(president)
    const id = await created(president, { name: `President's Cup ${++seq}`, date: '2026-12-05' })
    expect((await rowOf(id))?.created_by).toBe(president)
    expect((await save(president, id, true)).status).toBe(200)
    expect(await rowOf(id)).toMatchObject({ is_visible: 1, review_notified_at: null })
    expect(emailOutbox).toEqual([])
  })

  it('a standing director\'s event whose creator has lost the role since: no email and no mark when it is published', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Former Director Open ${++seq}`, date: '2026-12-05' })
    await env.DB.prepare("UPDATE members SET role = 'member' WHERE id = ?").bind(director.id).run()
    // The first director row stays, so the former standing director still runs and publishes the event.
    expect((await save(director.id, id, true)).status).toBe(200)
    expect(await rowOf(id)).toMatchObject({ is_visible: 1, review_notified_at: null })
    expect(emailOutbox).toEqual([])
  })

  it('with the constant unset, a standing director\'s event published: no email, no mark, and today\'s row', async () => {
    flags.rolesOn = false
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await seedTournament({ name: `Unswitched Open ${++seq}`, date: '2026-12-05', isVisible: false, createdBy: director.id })
    await seedTournamentDirector(id, director.id)
    const res = await save(director.id, id, true)
    expect(res.status).toBe(200)
    expect(await rowOf(id)).toMatchObject({ is_visible: 1, review_notified_at: null })
    expect(emailOutbox).toEqual([])
    expect(await publishRows(id)).toEqual([{ action: 'tournament_publish', detail: { tournament_id: id } }])
    // The helper itself sends nothing and sets no mark while the constant is unset.
    expect(await sendPublishedReviewNotice(env as unknown as Env, id)).toEqual({ notified: false, sent: 0 })
    expect((await rowOf(id))?.review_notified_at).toBeNull()
    expect(emailOutbox).toEqual([])
  })
})

describe('who publishes, and what an outage does', () => {
  it('an LCA admin who publishes a standing director\'s draft sends the notice: it reads the creator\'s grant, not the publisher\'s', async () => {
    await seedAdmins()
    const admin = await seedMember({ role: 'lca_admin', email: `review-publisher-${++seq}@test.lca` })
    const director = await seedStandingDirector()
    const name = `Standing Director Open ${++seq}`
    const id = await created(director.id, { name, date: '2026-12-05' })
    expect((await save(admin, id, true)).status).toBe(200)
    expect((await rowOf(id))?.review_notified_at).toBeTruthy()
    expect(sentTo()).toEqual([...(await everyAdminAddress())].sort())
    for (const email of emailOutbox) expect(email.subject).toBe(`Published by Gerald Landry, standing director: ${name} (Sat, Dec 5, 2026)`)
  })

  it('an email outage leaves the mark set, the event listed and the save answering 200, and the row counts no email', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Outage Open ${++seq}`, date: '2026-12-05' })
    emailBehavior.succeed = false
    const res = await save(director.id, id, true)
    expect(res.status).toBe(200)
    expect(await rowOf(id)).toMatchObject({ is_visible: 1 })
    expect((await rowOf(id))?.review_notified_at).toBeTruthy()
    expect(emailOutbox).toEqual([])
    expect(await publishRows(id)).toEqual([{ action: 'tournament_publish', detail: { tournament_id: id, review_notified: true, review_notices_sent: 0 } }])
    // Once the email is back, publishing again sends nothing: the notice is not tried a second time.
    emailBehavior.succeed = true
    expect((await save(director.id, id, false)).status).toBe(200)
    expect((await save(director.id, id, true)).status).toBe(200)
    expect(emailOutbox).toEqual([])
  })

  it('a database failure inside the notice after the mark, on the admins\' read, leaves the save answering 200, the event listed and the mark set, and the row says the mark was set and no email went', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Database Outage Open ${++seq}`, date: '2026-12-05' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const admins = failWhenRun(ADMINS_READ)
    const res = await save(director.id, id, true)
    admins.restore()
    expect(admins.failures()).toBe(1)

    expect(res.status).toBe(200)
    expect((await res.json<{ tournament: Record<string, unknown> }>()).tournament).toMatchObject({ id, is_visible: 1 })
    expect(await rowOf(id)).toMatchObject({ is_visible: 1 })
    expect((await rowOf(id))?.review_notified_at).toBeTruthy()
    expect(await publicList()).toContain(id)
    expect(emailOutbox).toEqual([])
    expect(await publishRows(id)).toEqual([{ action: 'tournament_publish', detail: { tournament_id: id, review_notified: true, review_notices_sent: 0 } }])
    expect(warn).toHaveBeenCalledWith(`published review notice failed for ${id} (after the mark, 0 sent):`, D1_FAILURE)
    // The mark was set before the failure, so publishing again once the database is back sends nothing, as after an email outage.
    expect((await save(director.id, id, false)).status).toBe(200)
    expect((await save(director.id, id, true)).status).toBe(200)
    expect(emailOutbox).toEqual([])
  })

  it('a database failure inside the notice before the mark, on the creator\'s row, leaves the save answering 200 and the event listed with no mark, and the next publish sends the one notice', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const name = `Early Failure Open ${++seq}`
    const id = await created(director.id, { name, date: '2026-12-05' })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const creator = failWhenRun(CREATOR_READ)
    const res = await save(director.id, id, true)
    creator.restore()
    expect(creator.failures()).toBe(1)

    expect(res.status).toBe(200)
    expect(await rowOf(id)).toMatchObject({ is_visible: 1, review_notified_at: null })
    expect(await publicList()).toContain(id)
    expect(emailOutbox).toEqual([])
    expect(await publishRows(id)).toEqual([{ action: 'tournament_publish', detail: { tournament_id: id, review_notified: false, review_notices_sent: 0 } }])
    expect(warn).toHaveBeenCalledWith(`published review notice failed for ${id} (before the mark, 0 sent):`, D1_FAILURE)

    // With no mark set, the next publish once the database is back sends the event's one notice.
    expect((await save(director.id, id, false)).status).toBe(200)
    expect((await save(director.id, id, true)).status).toBe(200)
    const everyAdmin = await everyAdminAddress()
    expect(sentTo()).toEqual([...everyAdmin].sort())
    for (const email of emailOutbox) expect(email.subject).toBe(`Published by Gerald Landry, standing director: ${name} (Sat, Dec 5, 2026)`)
    expect((await rowOf(id))?.review_notified_at).toBeTruthy()
    expect((await publishRows(id)).map((r) => r.detail)).toEqual([
      { tournament_id: id, review_notified: false, review_notices_sent: 0 },
      { tournament_id: id },
      { tournament_id: id, review_notified: true, review_notices_sent: everyAdmin.length },
    ])
  })

  it('role safety: a signed-out visitor gets 401 and a member who does not run the event 403, with nothing sent, no mark and no row', async () => {
    await seedAdmins()
    const director = await seedStandingDirector()
    const id = await created(director.id, { name: `Refused Open ${++seq}`, date: '2026-12-05' })
    const member = await seedMember()
    expect((await save(undefined, id, true)).status).toBe(401)
    const refused = await save(member, id, true)
    expect(refused.status).toBe(403)
    expect(await refused.json()).toEqual({ error: 'Forbidden' })
    expect(await rowOf(id)).toMatchObject({ is_visible: 0, review_notified_at: null })
    expect(emailOutbox).toEqual([])
    expect(await publishRows(id)).toEqual([])
  })
})
