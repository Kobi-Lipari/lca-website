// test/integration/approval-judges-first.test.ts
//
// POST /api/admin/tournaments/[id]/approval judges the person before it reads
// the body (WS09 switch-on of regionEvents, the approval judges the person
// first). The table below is every kind of person against every body, on a
// hidden event marked for approval that its region's representative made and
// on an event that does not exist, with the answer each cell got before the
// handler's order changed: the status, the words, and what was written and
// sent. Measured first on the handler as it stood, then held here. The cells
// that must not move are every body the endpoint takes, for everyone, and
// every body it does not take from a person who may act there (an LCA admin,
// with or without the second factor, and the representative who made the
// event) or from nobody signed in. The cells that moved, in MOVED, are a body
// it does not take from a signed-in person it refuses 403 for all three moves
// on that event: that person is now judged before the body is read and gets
// the words they get for a submit, with nothing written, sent or counted.
// With REGION_EVENTS_ON unset every call answers 403 in its closed words and
// reads nothing.
//
// The last describe holds the edges beside the table: the drafter whose seat
// has ended, an event with no club, an event already approved, the limit of
// five submits a day (a refusal ahead of the body counts nothing, and a person
// at the limit still gets 400 for a body the endpoint does not take), replays,
// and the refusal's words saying nothing of the event.
//
// REGION_EVENTS_ON is read through a getter on the mocked
// functions/utils/clubs/pages and set by each case, on and off; both mail
// switches are read through getters on the mocked
// functions/utils/mail/switches at today's values, so the emails go the same
// way whatever they ship as. Every club, person, address and event is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  APPROVAL_CLOSED,
  EMAIL_WORDS,
  NOT_IN_REVIEW,
  SUBMITS_A_DAY,
  TOO_MANY_SUBMITS,
  onRequestPost as approval,
} from '../../functions/api/admin/tournaments/[id]/approval'
import { APPROVAL_NOTE_MAX, APPROVAL_NOTE_TOO_LONG } from '../../domain/contracts/events'
import { MEDIA_MANAGER_SEAT } from '../../functions/utils/admin/mediaManager'
import { lcaAdminAddresses } from '../../functions/utils/events/publishedReview'
import { seedAdmin, seedClub, seedMember, seedSeat, seedTournament, seedTournamentDirector } from './factories'
import { emailOutbox, invoke, resetHarness } from './harness'
import { countingDb, noWaits } from './mailRuns'

const flags = vi.hoisted(() => ({ regionOn: true, listsOn: false, sender: 'resend' as 'resend' | 'ses' }))
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

beforeEach(async () => {
  resetHarness()
  flags.regionOn = true
  flags.listsOn = false
  flags.sender = 'resend'
  noWaits()
  await env.DB.prepare(`DELETE FROM board_members WHERE id LIKE 'seat-%'`).run()
})
afterEach(() => {
  flags.regionOn = true
  vi.restoreAllMocks()
})

const PEOPLE = [
  'an LCA admin with the second factor',
  'an LCA admin without the second factor',
  'the representative of the region who made the event',
  'a representative of another region',
  'the rep of the event\'s club',
  'a rep of another club',
  'a director named on the event',
  'a director of another event',
  'a media manager',
  'a plain member',
  'a guest account',
  'nobody signed in',
] as const
type Person = (typeof PEOPLE)[number]

/** The bodies the endpoint takes, then the ones it does not, in the table's column order. */
const BODIES = {
  'submit': { action: 'submit' },
  'approve': { action: 'approve' },
  'ask_changes with a note': { action: 'ask_changes', note: 'Please add the time control.' },
  'an empty object': {},
  'an unknown action': { action: 'publish' },
  'a value that is not an object': 42,
  'ask_changes with no note': { action: 'ask_changes' },
  'ask_changes with a note over the limit': { action: 'ask_changes', note: 'x'.repeat(APPROVAL_NOTE_MAX + 1) },
} as const
type Body = keyof typeof BODIES
const COLUMNS = Object.keys(BODIES) as Body[]
const TAKEN: Body[] = ['submit', 'approve', 'ask_changes with a note']
const NOT_TAKEN = COLUMNS.filter((b) => !TAKEN.includes(b))

const EVENTS = ['the draft', 'no event'] as const
type EventKind = (typeof EVENTS)[number]

const SECOND_FACTOR = 'Two-factor authentication is required for admin access. Set it up in your account security settings.'
const NO_ACTION = 'Invalid discriminator value. Expected \'submit\' | \'approve\' | \'ask_changes\''
const INVALID = 'Some fields are missing or not valid.'

interface Effects {
  /** Where the event stands after the call, or "no event". */
  event: string
  /** The actions of the activity log's rows the call wrote. */
  rows: string[]
  /** Who was emailed. */
  sent: string
}
interface Answer {
  status: number
  body: unknown
  effects: Effects
}

/** What a call that is refused leaves: the event as it was, no row, no email. */
const NOTHING = (event: EventKind): Effects => ({ event: event === 'the draft' ? 'hidden draft' : 'no event', rows: [], sent: 'nothing' })
const refusal = (status: number, body: unknown) => (event: EventKind): Answer => ({ status, body, effects: NOTHING(event) })

/** Every answer the table holds, by a short name. */
const ANSWERS = {
  signIn: refusal(401, { error: 'Unauthorized' }),
  forbidden: refusal(403, { error: 'Forbidden' }),
  secondFactor: refusal(403, { error: SECOND_FACTOR, mfaRequired: true }),
  notFound: refusal(404, { error: 'Tournament not found' }),
  notInReview: refusal(409, { error: NOT_IN_REVIEW }),
  noAction: refusal(400, { error: INVALID, fields: { action: NO_ACTION } }),
  notObject: refusal(400, { error: INVALID, fields: { body: 'Invalid input: expected object, received number' } }),
  noNote: refusal(400, { error: INVALID, fields: { note: 'Invalid input: expected string, received undefined' } }),
  noteTooLong: refusal(400, { error: INVALID, fields: { note: APPROVAL_NOTE_TOO_LONG } }),
  sentForReview: (): Answer => ({
    status: 200,
    body: { needs_lca_approval: 1, approval_requested_at: 'a time', approved_at: null, approved_by: null, email: EMAIL_WORDS.reviewSent },
    effects: { event: 'in review', rows: ['tournament_submitted'], sent: 'each LCA admin' },
  }),
  approved: (): Answer => ({
    status: 200,
    body: { needs_lca_approval: 1, approval_requested_at: null, approved_at: 'a time', approved_by: 'an LCA admin with the second factor', email: EMAIL_WORDS.approvedSent },
    effects: { event: 'approved and listed', rows: ['tournament_approved'], sent: 'the representative of the region who made the event' },
  }),
} as const
type Key = keyof typeof ANSWERS

/** The untaken bodies' answers for anyone the body is read for, in column order. */
const READ: Key[] = ['noAction', 'noAction', 'notObject', 'noNote', 'noteTooLong']
const NEVER: Key[] = ['forbidden', 'forbidden', 'forbidden']

/** The base's answers on the draft, measured before the order changed. Columns as COLUMNS. */
const BASE_ON_THE_DRAFT: Record<Person, Key[]> = {
  'an LCA admin with the second factor': ['sentForReview', 'approved', 'notInReview', ...READ],
  'an LCA admin without the second factor': ['sentForReview', 'secondFactor', 'secondFactor', ...READ],
  'the representative of the region who made the event': ['sentForReview', 'forbidden', 'forbidden', ...READ],
  'a representative of another region': [...NEVER, ...READ],
  'the rep of the event\'s club': [...NEVER, ...READ],
  'a rep of another club': [...NEVER, ...READ],
  'a director named on the event': [...NEVER, ...READ],
  'a director of another event': [...NEVER, ...READ],
  'a media manager': [...NEVER, ...READ],
  'a plain member': [...NEVER, ...READ],
  'a guest account': [...NEVER, ...READ],
  'nobody signed in': Array<Key>(8).fill('signIn'),
}

/** The base's answers on an event that does not exist, measured before the order changed. */
const BASE_ON_NO_EVENT: Record<Person, Key[]> = {
  'an LCA admin with the second factor': ['notFound', 'notFound', 'notFound', ...READ],
  'an LCA admin without the second factor': ['notFound', 'secondFactor', 'secondFactor', ...READ],
  'the representative of the region who made the event': [...NEVER, ...READ],
  'a representative of another region': [...NEVER, ...READ],
  'the rep of the event\'s club': [...NEVER, ...READ],
  'a rep of another club': [...NEVER, ...READ],
  'a director named on the event': [...NEVER, ...READ],
  'a director of another event': [...NEVER, ...READ],
  'a media manager': [...NEVER, ...READ],
  'a plain member': [...NEVER, ...READ],
  'a guest account': [...NEVER, ...READ],
  'nobody signed in': Array<Key>(8).fill('signIn'),
}

const BASE: Record<EventKind, Record<Person, Key[]>> = { 'the draft': BASE_ON_THE_DRAFT, 'no event': BASE_ON_NO_EVENT }
const baseKey = (event: EventKind, person: Person, body: Body): Key => BASE[event][person][COLUMNS.indexOf(body)]

/** Everyone signed in but an LCA admin. */
const NOT_ADMINS = PEOPLE.filter((p) => !p.startsWith('an LCA admin') && p !== 'nobody signed in')

/**
 * The cells that moved: a body the endpoint does not take, from a signed-in
 * person it refuses 403 for all three moves on that event, now answered
 * before the body is read, in the words that person gets for a submit. On
 * the draft that is everyone but the two LCA admins and the representative
 * who made it; on no event, everyone signed in but the two LCA admins.
 */
const MOVED: Array<{ event: EventKind; people: readonly Person[]; bodies: readonly Body[]; to: Key }> = [
  { event: 'the draft', people: NOT_ADMINS.filter((p) => p !== 'the representative of the region who made the event'), bodies: NOT_TAKEN, to: 'forbidden' },
  { event: 'no event', people: NOT_ADMINS, bodies: NOT_TAKEN, to: 'forbidden' },
]
const movedTo = (event: EventKind, person: Person, body: Body): Key | undefined =>
  MOVED.find((m) => m.event === event && m.people.includes(person) && m.bodies.includes(body))?.to

const REGION = 'Example Cypress Region'
const OTHER_REGION = 'Example Magnolia Region'
let seq = 0

async function regionalSeat(memberId: string, region: string): Promise<void> {
  const seat = `area-seat-order-${++seq}`
  await env.DB.prepare("INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)").bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(`term-${seat}`, seat, memberId).run()
}

interface World {
  ids: Record<Person, string | undefined>
  /** Each person by their id and by their address. */
  names: Map<string, Person>
  club: string
}

/** One of each kind of person, two clubs in two regions, and another event with its own director. */
async function world(): Promise<World> {
  const n = ++seq
  const addresses = new Map<string, string>()
  const person = async (who: string, role = 'member', clubId: string | null = null) => {
    const email = `player.${who.toLowerCase()}.${n}@example.org`
    const id = await seedMember({ role, clubId, fullName: `Player ${who}`, email })
    addresses.set(id, email)
    return id
  }
  const club = await seedClub({ name: `Example Chess Club ${n}` })
  const otherClub = await seedClub({ name: `Example Chess Club ${n} East` })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(REGION, club).run()
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(OTHER_REGION, otherClub).run()
  const ids: Record<Person, string | undefined> = {
    'an LCA admin with the second factor': await person('One', 'lca_admin'),
    'an LCA admin without the second factor': await person('Two', 'lca_admin'),
    'the representative of the region who made the event': await person('Three'),
    'a representative of another region': await person('Four'),
    'the rep of the event\'s club': await person('Five', 'club_rep', club),
    'a rep of another club': await person('Six', 'club_rep', otherClub),
    'a director named on the event': await person('Seven', 'tournament_director'),
    'a director of another event': await person('Eight', 'tournament_director'),
    'a media manager': await person('Nine'),
    'a plain member': await person('Ten'),
    'a guest account': await person('Eleven', 'guest'),
    'nobody signed in': undefined,
  }
  await regionalSeat(ids['the representative of the region who made the event']!, REGION)
  await regionalSeat(ids['a representative of another region']!, OTHER_REGION)
  const elsewhere = await seedTournament({ name: `Example Open ${n}`, date: '2026-12-19' })
  await seedTournamentDirector(elsewhere, ids['a director of another event']!)
  await seedSeat({ slug: MEDIA_MANAGER_SEAT, role: 'Media manager' }, [ids['a media manager']!])
  const names = new Map<string, Person>()
  for (const who of PEOPLE) {
    const id = ids[who]
    if (id) names.set(id, who).set(addresses.get(id)!, who)
  }
  return { ids, names, club }
}

/** A hidden draft of the club, marked for approval, made by its region's representative, with a director named on it. */
async function draft(w: World): Promise<string> {
  const id = await seedTournament({
    name: `Example Club Night ${++seq}`,
    date: '2026-12-12',
    clubId: w.club,
    createdBy: w.ids['the representative of the region who made the event'],
    entryFee: 0,
    sections: [{ name: 'Open', entryFee: 0 }],
    isVisible: false,
  })
  await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1 WHERE id = ?').bind(id).run()
  await seedTournamentDirector(id, w.ids['a director named on the event']!)
  return id
}

interface WaitRow {
  approval_requested_at: string | null
  approved_at: string | null
  approved_by: string | null
  is_visible: number
}
const waitOf = (id: string) =>
  env.DB.prepare('SELECT approval_requested_at, approved_at, approved_by, is_visible FROM tournaments WHERE id = ?').bind(id).first<WaitRow>()

function standing(row: WaitRow | null): string {
  if (!row) return 'no event'
  if (row.approved_at) return row.is_visible ? 'approved and listed' : 'approved, hidden'
  if (row.approval_requested_at) return 'in review'
  return row.is_visible ? 'listed draft' : 'hidden draft'
}

const auditActions = async () =>
  ((await env.DB.prepare('SELECT action FROM admin_audit_log ORDER BY rowid').all<{ action: string }>()).results ?? []).map((r) => r.action)

/** One cell: a fresh draft (or no event), the call, and what it answered, wrote and sent, with ids and times read as names. */
async function cell(w: World, person: Person, event: EventKind, body: Body, db?: D1Database): Promise<Answer> {
  const id = event === 'the draft' ? await draft(w) : 'no-such-event'
  emailOutbox.length = 0
  const before = await auditActions()
  const res = await invoke(approval, {
    method: 'POST',
    as: w.ids[person],
    aal: person === 'an LCA admin without the second factor' ? 'aal1' : 'aal2',
    params: { id },
    body: BODIES[body],
    ...(db ? { env: { DB: db } } : {}),
  })
  const answer = await res.json<Record<string, unknown>>()
  for (const stamp of ['approval_requested_at', 'approved_at'] as const) {
    if (typeof answer[stamp] === 'string') answer[stamp] = 'a time'
  }
  if (typeof answer.approved_by === 'string') answer.approved_by = w.names.get(answer.approved_by) ?? 'someone else'
  const to = emailOutbox.map((e) => e.to as string).sort()
  const admins = [...(await lcaAdminAddresses(env.DB))].sort()
  const sent = to.length === 0
    ? 'nothing'
    : JSON.stringify(to) === JSON.stringify(admins)
      ? 'each LCA admin'
      : to.map((address) => w.names.get(address) ?? 'someone else').join(', ')
  return {
    status: res.status,
    body: answer,
    effects: {
      event: event === 'the draft' ? standing(await waitOf(id)) : 'no event',
      rows: (await auditActions()).slice(before.length),
      sent,
    },
  }
}

describe('the approval with REGION_EVENTS_ON set: the cells that must not move', () => {
  it.each(PEOPLE)('answers %s exactly as the base did, for every body the table does not mark as moved, on the draft and on no event', async (person) => {
    const w = await world()
    for (const event of EVENTS) {
      for (const body of COLUMNS) {
        if (movedTo(event, person, body)) continue
        expect(await cell(w, person, event, body), `${event}, ${body}`).toEqual(ANSWERS[baseKey(event, person, body)](event))
      }
    }
  })
})

describe('the approval with REGION_EVENTS_ON set: the cells that moved', () => {
  it.each(NOT_ADMINS)('refuses %s 403 for a body it does not take, before the body is read, in their words for a submit, with nothing written, sent or counted', async (person) => {
    const w = await world()
    for (const event of EVENTS) {
      const submit = await cell(w, person, event, 'submit')
      for (const body of NOT_TAKEN) {
        const to = movedTo(event, person, body)
        if (!to) continue
        // The base answered 400 here, after reading the body.
        expect(ANSWERS[baseKey(event, person, body)](event).status, `${event}, ${body}`).toBe(400)
        const { db, ran } = countingDb()
        const now = await cell(w, person, event, body, db)
        expect(now, `${event}, ${body}`).toEqual(ANSWERS[to](event))
        expect(now, `${event}, ${body}`).toEqual(submit)
        // Only reads, and never the count of submits.
        expect(ran.filter((r) => !/^\s*SELECT\b/i.test(r.sql)), `${event}, ${body}`).toEqual([])
        expect(ran.some((r) => r.sql.includes('FROM admin_audit_log')), `${event}, ${body}`).toBe(false)
      }
    }
  })
})

describe('the approval with REGION_EVENTS_ON unset', () => {
  it.each(PEOPLE)('answers %s 403 in its closed words for every body, reading nothing', async (person) => {
    const w = await world()
    flags.regionOn = false
    for (const event of EVENTS) {
      for (const body of COLUMNS) {
        const { db, ran } = countingDb()
        expect(await cell(w, person, event, body, db), `${event}, ${body}`).toEqual({ status: 403, body: { error: APPROVAL_CLOSED }, effects: NOTHING(event) })
        expect(ran, `${event}, ${body}`).toEqual([])
      }
    }
  })
})

describe('the table itself', () => {
  it('has a row for every person and a cell for every body', () => {
    for (const event of EVENTS) {
      expect(Object.keys(BASE[event]).sort()).toEqual([...PEOPLE].sort())
      for (const person of PEOPLE) expect(BASE[event][person], `${event}, ${person}`).toHaveLength(COLUMNS.length)
    }
    expect(NOT_TAKEN).toHaveLength(5)
  })

  it('moves exactly the cells the rule names: an untaken body, from a signed-in person the base refused 403 for all three moves on that event', () => {
    for (const event of EVENTS) {
      for (const person of PEOPLE) {
        const refusedAll = person !== 'nobody signed in' && TAKEN.every((b) => ANSWERS[baseKey(event, person, b)](event).status === 403)
        for (const body of COLUMNS) {
          const moved = movedTo(event, person, body)
          expect(moved !== undefined, `${event}, ${person}, ${body}`).toBe(refusedAll && NOT_TAKEN.includes(body))
          // A moved cell gets what the same person got for a submit on the base.
          if (moved) expect(moved, `${event}, ${person}, ${body}`).toBe(baseKey(event, person, 'submit'))
        }
      }
    }
    expect(MOVED.reduce((n, m) => n + m.people.length * m.bodies.length, 0)).toBe(8 * 5 + 9 * 5)
  })
})

async function representative(opts: { seated?: boolean } = {}) {
  const n = ++seq
  const club = await seedClub({ name: `Example Chess Club ${n}` })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(REGION, club).run()
  const id = await seedMember({ fullName: 'Player One', email: `player.one.edge.${n}@example.org` })
  if (opts.seated !== false) {
    const seat = `area-seat-edge-${n}`
    await env.DB.prepare("INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)").bind(seat, seat).run()
    await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, REGION).run()
    await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(`term-${seat}`, seat, id).run()
  }
  return { id, club }
}

async function edgeDraft(club: string | null, createdBy: string, extra = ''): Promise<string> {
  const id = await seedTournament({
    name: `Example Club Night ${++seq}`,
    date: '2026-12-12',
    ...(club ? { clubId: club } : {}),
    createdBy,
    entryFee: 0,
    sections: [{ name: 'Open', entryFee: 0 }],
    isVisible: false,
  })
  await env.DB.prepare(`UPDATE tournaments SET needs_lca_approval = 1 ${extra} WHERE id = ?`).bind(id).run()
  return id
}

const call = (as: string, id: string, body: unknown, db?: D1Database) =>
  invoke(approval, { method: 'POST', as, aal: 'aal1', params: { id }, body, ...(db ? { env: { DB: db } } : {}) })
const logRows = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').first<{ n: number }>())!.n
const EMPTY = {}
const UNKNOWN = { action: 'publish' }

describe('the approval judging the person first: edges', () => {
  beforeEach(async () => {
    await env.DB.prepare('DELETE FROM admin_audit_log').run()
  })

  it('refuses a drafter whose seat has ended 403 for every body, submit included, in the same words', async () => {
    await seedAdmin()
    const rep = await representative({ seated: false })
    const event = await edgeDraft(rep.club, rep.id)
    const submit = await call(rep.id, event, { action: 'submit' })
    expect(submit.status).toBe(403)
    const words = await submit.json()
    expect(words).toEqual({ error: 'Forbidden' })
    for (const body of [EMPTY, UNKNOWN, 42, { action: 'ask_changes' }, { action: 'approve' }]) {
      const res = await call(rep.id, event, body)
      expect(res.status, JSON.stringify(body)).toBe(403)
      expect(await res.json()).toEqual(words)
    }
    expect(await logRows()).toBe(0)
    expect(emailOutbox).toHaveLength(0)
  })

  it('refuses the drafter of an event with no club 403 for a body the endpoint does not take, as it does for a submit', async () => {
    await seedAdmin()
    const rep = await representative()
    const event = await edgeDraft(null, rep.id)
    expect((await call(rep.id, event, { action: 'submit' })).status).toBe(403)
    for (const body of [EMPTY, UNKNOWN, 42]) expect((await call(rep.id, event, body)).status, JSON.stringify(body)).toBe(403)
    expect(await logRows()).toBe(0)
  })

  it('keeps 400 and its words for the drafter on an event already approved and listed', async () => {
    await seedAdmin()
    const rep = await representative()
    const event = await edgeDraft(rep.club, rep.id, ", approved_at = datetime('now'), is_visible = 1")
    const res = await call(rep.id, event, EMPTY)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Some fields are missing or not valid.' })
    expect(await logRows()).toBe(0)
  })

  it('answers a person who may not act 403 on an approved event for a body it does not take', async () => {
    await seedAdmin()
    const rep = await representative()
    const other = await seedMember({ fullName: 'Player Two', email: `player.two.edge.${++seq}@example.org` })
    const event = await edgeDraft(rep.club, rep.id, ", approved_at = datetime('now'), is_visible = 1")
    for (const body of [EMPTY, UNKNOWN, 42, { action: 'ask_changes' }]) {
      const res = await call(other, event, body)
      expect(res.status, JSON.stringify(body)).toBe(403)
      expect(await res.json()).toEqual({ error: 'Forbidden' })
    }
  })

  it('does not name the event, its club or its state in a refusal ahead of the body', async () => {
    await seedAdmin()
    const rep = await representative()
    const other = await seedMember({ fullName: 'Player Two', email: `player.two.edge.${++seq}@example.org` })
    const event = await edgeDraft(rep.club, rep.id)
    const res = await call(other, event, EMPTY)
    const text = JSON.stringify(await res.json())
    expect(text).toBe('{"error":"Forbidden"}')
    expect(text).not.toMatch(/Example|review|approval|club/i)
  })

  it('lets a drafter at the limit of five submits still get 400 for a body it does not take, and 429 for a submit', async () => {
    expect(SUBMITS_A_DAY).toBe(5)
    await seedAdmin()
    const rep = await representative()
    for (let i = 0; i < SUBMITS_A_DAY; i++) {
      await env.DB.prepare(
        `INSERT INTO admin_audit_log (id, actor_id, actor_email, action, target_label, detail, created_at)
         VALUES (?, ?, 'player@example.org', 'tournament_submitted', 'Example Club Night', '{}', datetime('now', '-1 hours'))`,
      ).bind(`aud-edge-${++seq}`, rep.id).run()
    }
    const event = await edgeDraft(rep.club, rep.id)
    expect((await call(rep.id, event, EMPTY)).status).toBe(400)
    const refused = await call(rep.id, event, { action: 'submit' })
    expect(refused.status).toBe(429)
    expect(await refused.json()).toEqual({ error: TOO_MANY_SUBMITS })
    expect(await logRows()).toBe(5)
  })

  it('counts nothing and writes nothing however often a refused person asks: ten calls, no row, no count read, no email', async () => {
    await seedAdmin()
    const rep = await representative()
    const other = await seedMember({ fullName: 'Player Two', email: `player.two.edge.${++seq}@example.org` })
    const event = await edgeDraft(rep.club, rep.id)
    const { db, ran } = countingDb()
    for (let i = 0; i < 10; i++) {
      const res = await call(other, event, i % 2 ? EMPTY : UNKNOWN, db)
      expect(res.status).toBe(403)
    }
    expect(await logRows()).toBe(0)
    expect(emailOutbox).toHaveLength(0)
    expect(ran.filter((r) => !/^\s*SELECT\b/i.test(r.sql))).toEqual([])
    expect(ran.some((r) => r.sql.includes('FROM admin_audit_log'))).toBe(false)
    // The event is as it was.
    const row = await env.DB.prepare('SELECT approval_requested_at, approved_at FROM tournaments WHERE id = ?').bind(event).first<{ approval_requested_at: string | null; approved_at: string | null }>()
    expect(row).toEqual({ approval_requested_at: null, approved_at: null })
  })

  it('answers a replay of the same refused body the same, and a replay of a body not taken from the drafter the same 400', async () => {
    await seedAdmin()
    const rep = await representative()
    const other = await seedMember({ fullName: 'Player Two', email: `player.two.edge.${++seq}@example.org` })
    const event = await edgeDraft(rep.club, rep.id)
    const first = await call(other, event, EMPTY)
    const second = await call(other, event, EMPTY)
    expect([second.status, await second.json()]).toEqual([first.status, await first.json()])
    const a = await call(rep.id, event, EMPTY)
    const b = await call(rep.id, event, EMPTY)
    expect(a.status).toBe(400)
    expect([b.status, await b.json()]).toEqual([a.status, await a.json()])
  })

  it('answers nobody signed in 401 for a body it does not take, ahead of any event query', async () => {
    const { db, ran } = countingDb()
    const res = await invoke(approval, { method: 'POST', params: { id: 'no-such-event' }, body: EMPTY, env: { DB: db } })
    expect(res.status).toBe(401)
    expect(ran.some((r) => /FROM tournaments/i.test(r.sql))).toBe(false)
  })
})
