// test/integration/contracts/me-creation.test.ts
//
// The two endpoints WS08 step 7 adds under functions/api/me/, each to its
// contract in domain/contracts/me.ts, on the database every integration
// test runs on:
// - GET /api/me/tournament-creation answers the signed-in person's own
//   grant and the two rules for an LCA-run event: with CREATION_ROLES_ON
//   set, a standing director, the president, an LCA admin, a club rep, a
//   club rep who holds the seat, a plain member, an officer, an observer and
//   an auditor who hold no seat, a one-event director and a club rep with no
//   club each get theirs; with it unset, today's grants and canChargeFees
//   true for everyone; the constant read at each request; 401 signed out;
//   and nothing stored or sent;
// - POST /api/me/payout-request opens one support ticket of kind
//   payout_request per member while one is open or in progress: a one-event
//   director's first request 201, about the event, in Admin's support list,
//   with the admins' note and the member's confirmation, the answer naming
//   the ticket by its id and never its number, which is for staff and board
//   members only; a second request 200 with the same ticket and nothing more
//   stored or sent; two requests fired together, and five, one ticket, one
//   note and one confirmation; a new ticket once the open one is resolved;
//   an event named only when the member manages it, so a hidden draft's id
//   teaches nothing; a two-day event's days with a weekday on each and no
//   dash; the body's other keys ignored; 400 on a body that is not valid;
//   with the constant unset 403 before the body or any ticket is read; 401
//   signed out;
// - createTicket called twice in a row with oneOpenPerMember and no read
//   between, the helper itself, so its guard alone decides, held per member
//   and per kind.
// Every case reads the stored rows and the outbox after the call.
// CREATION_ROLES_ON is read through a getter on the mocked module, set for
// every case unless the case says otherwise and put back after each. The
// tickets helper is mocked as a pass-through to the real one, but for the
// one case that has it answer as if a ticket opened by a request in flight
// had been closed again before the endpoint reads it.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema } from '../../../domain/contracts'
import { onRequestGet as adminSupportGet } from '../../../functions/api/admin/support'
import { onRequestPost as payoutPost } from '../../../functions/api/me/payout-request'
import { onRequestGet as creationGet } from '../../../functions/api/me/tournament-creation'
import type { Env } from '../../../functions/types'
import { seedAdmin, seedClub, seedMember, seedPresident, seedTournament, seedTournamentDirector } from '../factories'
import { emailOutbox, expectContract, invoke, resetHarness } from '../harness'

const flags = vi.hoisted(() => ({ rolesOn: false, insertNothing: false }))
vi.mock('../../../functions/utils/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/events/creation')>()
  return {
    ...real,
    get CREATION_ROLES_ON() {
      return flags.rolesOn
    },
  }
})
vi.mock('../../../functions/utils/admin/tickets', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/admin/tickets')>()
  return {
    ...real,
    createTicket: (...args: Parameters<typeof real.createTicket>) =>
      flags.insertNothing
        ? Promise.resolve({ ticketId: 'ticket-never-stored', ticketNumber: null, seat: null, holders: [], created: false })
        : real.createTicket(...args),
  }
})

beforeEach(() => {
  resetHarness()
  flags.rolesOn = true
  flags.insertNothing = false
})
afterEach(() => {
  flags.rolesOn = false
  flags.insertNothing = false
  vi.restoreAllMocks()
})

const creation = contracts['me/tournament-creation'].GET
const payout = contracts['me/payout-request'].POST

/** Where the admins' note goes: CONTACT_EMAIL in vitest.integration.config.ts. */
const ADMINS = 'contact@louisianachess.org'
const SITE = 'https://www.louisianachess.org'
/** A hyphen, an en dash or an em dash, the last two written by code so that this file holds neither. */
const ANY_DASH = new RegExp(`[-${String.fromCharCode(0x2013, 0x2014)}]`)

/** The words of the ticket's first message for a member of this name, before any line about an event. */
const words = (name: string) =>
  `${name} asked LCA to set up a payout account for them: a connected account inside LCA's Stripe account (Stripe Connect), so their events can charge entry fees and the money reaches them. Until it exists their events run at $0.`

const grantOf = (as?: string, path = '/api/me/tournament-creation') => invoke(creationGet, { method: 'GET', as, path })
const request = (as: string | undefined, body: unknown = {}) => invoke(payoutPost, { method: 'POST', as, body, path: '/api/me/payout-request' })

interface TicketRow {
  id: string
  number: number | null
  member_id: string | null
  name: string
  email: string
  subject: string
  status: string
  seat_id: string | null
  kind: string | null
  about_id: string | null
}
interface MessageRow {
  ticket_id: string
  sender_id: string | null
  sender_type: string
  body: string
}

/** Every ticket a member holds, oldest first. */
const ticketsOf = async (memberId: string) =>
  (await env.DB.prepare(
    'SELECT id, number, member_id, name, email, subject, status, seat_id, kind, about_id FROM support_tickets WHERE member_id = ? ORDER BY number',
  ).bind(memberId).all<TicketRow>()).results
/** A ticket's messages, oldest first. */
const messagesOf = async (ticketId: string) =>
  (await env.DB.prepare('SELECT ticket_id, sender_id, sender_type, body FROM support_messages WHERE ticket_id = ? ORDER BY created_at, id')
    .bind(ticketId).all<MessageRow>()).results
/** How many tickets and messages the whole database holds. */
const totals = async () => ({
  tickets: (await env.DB.prepare('SELECT COUNT(*) AS n FROM support_tickets').first<{ n: number }>())!.n,
  messages: (await env.DB.prepare('SELECT COUNT(*) AS n FROM support_messages').first<{ n: number }>())!.n,
})

let people = 0
/** A member with a name and an address of their own, so each case's emails can be told apart. */
async function person(fullName: string, opts: { role?: string; clubId?: string | null } = {}): Promise<{ id: string; name: string; email: string }> {
  const email = `person${++people}@example.org`
  const id = await seedMember({ fullName, email, ...opts })
  return { id, name: fullName, email }
}

describe('GET /api/me/tournament-creation, to its contract', () => {
  it('answers each person their own grant and the rules for an LCA-run event, with the constant set', async () => {
    const club = await seedClub()
    const president = await seedMember({ role: 'lca_observer' })
    await seedPresident(president)
    const seatedRep = await seedMember({ role: 'club_rep', clubId: club })
    await seedPresident(seatedRep)
    const event = await seedTournament()
    const oneEvent = await seedMember()
    await seedTournamentDirector(event, oneEvent)
    const cases: ReadonlyArray<readonly [string, string, Record<string, unknown>]> = [
      ['a standing director', await seedMember({ role: 'tournament_director' }), { grant: 'standing_director', canCreate: true, canChargeFees: true, clubId: null }],
      ['the president, an observer who holds the seat', president, { grant: 'president', canCreate: true, canChargeFees: true, clubId: null }],
      ['an LCA admin', await seedAdmin(), { grant: 'admin', canCreate: true, canChargeFees: true, clubId: null }],
      ['a club rep', await seedMember({ role: 'club_rep', clubId: club }), { grant: 'club_rep', canCreate: false, canChargeFees: true, clubId: club }],
      ['a club rep who holds the seat', seatedRep, { grant: 'president', canCreate: true, canChargeFees: true, clubId: club }],
      ['a plain member', await seedMember(), { grant: 'none', canCreate: false, canChargeFees: false, clubId: null }],
      ['an officer who holds no seat', await seedMember({ role: 'lca_officer' }), { grant: 'none', canCreate: false, canChargeFees: false, clubId: null }],
      ['an observer who holds no seat', await seedMember({ role: 'lca_observer' }), { grant: 'none', canCreate: false, canChargeFees: false, clubId: null }],
      ['an auditor', await seedMember({ role: 'lca_auditor' }), { grant: 'none', canCreate: false, canChargeFees: false, clubId: null }],
      ['a one-event director', oneEvent, { grant: 'none', canCreate: false, canChargeFees: false, clubId: null }],
      ['a club rep with no club', await seedMember({ role: 'club_rep' }), { grant: 'none', canCreate: false, canChargeFees: false, clubId: null }],
    ]
    const before = await totals()
    for (const [who, as, expected] of cases) {
      const res = await grantOf(as)
      expect(res.status, who).toBe(200)
      expect(await expectContract(res, creation.response), who).toEqual(expected)
    }
    expect(await totals()).toEqual(before)
    expect(emailOutbox).toEqual([])
  })

  it('answers today\'s grants with the constant unset: the seat and the standing director grant nothing, and everyone may set a fee', async () => {
    flags.rolesOn = false
    const club = await seedClub()
    const president = await seedMember({ role: 'lca_observer' })
    await seedPresident(president)
    const seatedRep = await seedMember({ role: 'club_rep', clubId: club })
    await seedPresident(seatedRep)
    const cases: ReadonlyArray<readonly [string, string, Record<string, unknown>]> = [
      ['a standing director', await seedMember({ role: 'tournament_director' }), { grant: 'none', canCreate: false, canChargeFees: true, clubId: null }],
      ['the president', president, { grant: 'none', canCreate: false, canChargeFees: true, clubId: null }],
      ['an LCA admin', await seedAdmin(), { grant: 'admin', canCreate: true, canChargeFees: true, clubId: null }],
      ['a club rep', await seedMember({ role: 'club_rep', clubId: club }), { grant: 'club_rep', canCreate: false, canChargeFees: true, clubId: club }],
      ['a club rep who holds the seat', seatedRep, { grant: 'club_rep', canCreate: false, canChargeFees: true, clubId: club }],
      ['a plain member', await seedMember(), { grant: 'none', canCreate: false, canChargeFees: true, clubId: null }],
    ]
    const before = await totals()
    for (const [who, as, expected] of cases) {
      const res = await grantOf(as)
      expect(res.status, who).toBe(200)
      expect(await expectContract(res, creation.response), who).toEqual(expected)
    }
    expect(await totals()).toEqual(before)
    expect(emailOutbox).toEqual([])
  })

  it('reads the constant at each request, so the same standing director\'s answer follows it', async () => {
    const director = await seedMember({ role: 'tournament_director' })
    const before = await totals()
    const grants: string[] = []
    for (const on of [true, false, true]) {
      flags.rolesOn = on
      grants.push((await expectContract(await grantOf(director), creation.response)).grant)
    }
    expect(grants).toEqual(['standing_director', 'none', 'standing_director'])
    expect(await totals()).toEqual(before)
    expect(emailOutbox).toEqual([])
  })

  it('role safety: answers only the caller\'s own grant, whatever the query asks, with jsonResponse\'s headers alone, and 401 with no sign-in in both states', async () => {
    const admin = await seedAdmin()
    const member = await seedMember()
    const before = await totals()
    const res = await grantOf(member, `/api/me/tournament-creation?memberId=${encodeURIComponent(admin)}&grant=admin`)
    expect(await expectContract(res, creation.response)).toEqual({ grant: 'none', canCreate: false, canChargeFees: false, clubId: null })
    expect(res.response.headers.get('Content-Type')).toBe('application/json')
    expect(res.response.headers.get('Cache-Control')).toBeNull()
    for (const on of [true, false]) {
      flags.rolesOn = on
      const anonymous = await grantOf(undefined)
      expect(anonymous.status).toBe(401)
      expect(await expectContract(anonymous, errorBodySchema)).toEqual({ error: 'Unauthorized' })
    }
    expect(await totals()).toEqual(before)
    expect(emailOutbox).toEqual([])
  })
})

describe('POST /api/me/payout-request, to its contract, with the constant set', () => {
  it('opens one ticket of kind payout_request about the event a one-event director names, in Admin\'s support list, with the admins\' note and the confirmation', async () => {
    const director = await person('Remy Guidry')
    const event = await seedTournament({ name: 'Lafayette Winter Quads', date: '2026-12-05' })
    await seedTournamentDirector(event, director.id)

    const res = await request(director.id, { tournamentId: event })
    expect(res.status).toBe(201)
    const body = await expectContract(res, payout.response)
    expect(body).toEqual({ ticket: { id: body.ticket.id, kind: 'payout_request', status: 'open' }, created: true })
    // Ticket numbers are for staff and board members only: the answer names the ticket by its id.
    expect(Object.keys(body.ticket).sort()).toEqual(['id', 'kind', 'status'])
    expect(await res.response.text()).not.toContain('number')

    const number = (await ticketsOf(director.id))[0]?.number
    expect(number).toBeGreaterThan(1000)
    expect(await ticketsOf(director.id)).toEqual([{
      id: body.ticket.id, number, member_id: director.id, name: 'Remy Guidry', email: director.email,
      subject: 'Payout account request from Remy Guidry', status: 'open', seat_id: null, kind: 'payout_request', about_id: event,
    }])
    expect(await messagesOf(body.ticket.id)).toEqual([{
      ticket_id: body.ticket.id, sender_id: director.id, sender_type: 'member',
      body: `${words('Remy Guidry')}\n\nEvent: Lafayette Winter Quads (Sat, Dec 5, 2026)`,
    }])

    const admin = await seedAdmin()
    const list = await invoke(adminSupportGet, { method: 'GET', as: admin, path: '/api/admin/support' })
    expect(list.status).toBe(200)
    const { tickets } = await list.json<{ tickets: Array<Record<string, unknown>> }>()
    expect(tickets.find((t) => t.id === body.ticket.id)).toMatchObject({
      kind: 'payout_request', about_id: event, member_id: director.id, status: 'open', number,
      subject: 'Payout account request from Remy Guidry', message_count: 1,
    })

    expect(emailOutbox.map((e) => e.to).sort()).toEqual([ADMINS, director.email].sort())
    const note = emailOutbox.find((e) => e.to === ADMINS)!
    expect(note.subject).toBe(`Payout account request from Remy Guidry (from Remy Guidry) [Ticket: ${number}]`)
    expect(note.text).toContain('Event: Lafayette Winter Quads (Sat, Dec 5, 2026)')
    expect(note.html).toContain(`${SITE}/admin/support?ticket=${encodeURIComponent(body.ticket.id)}`)
    const confirmation = emailOutbox.find((e) => e.to === director.email)!
    expect(confirmation.subject).toBe('We got your message')
    expect(confirmation.html).toContain(`${SITE}/support?ticket=${encodeURIComponent(body.ticket.id)}`)
    expect(confirmation.html).not.toContain(`Ticket: ${number}`)
    expect(confirmation.html).not.toContain(`>${number}<`)
  })

  it('answers a second request with the open ticket, 200 and created false, storing and sending nothing more', async () => {
    const member = await person('Nadia Broussard')
    const first = await expectContract(await request(member.id), payout.response)
    const before = { ...(await totals()), emails: emailOutbox.length }
    expect(before.emails).toBe(2)

    const again = await request(member.id, { tournamentId: null })
    expect(again.status).toBe(200)
    expect(await expectContract(again, payout.response)).toEqual({ ticket: first.ticket, created: false })
    expect(await again.response.text()).not.toContain('number')
    expect({ ...(await totals()), emails: emailOutbox.length }).toEqual(before)
    expect(await ticketsOf(member.id)).toHaveLength(1)
    expect(await messagesOf(first.ticket.id)).toEqual([{ ticket_id: first.ticket.id, sender_id: member.id, sender_type: 'member', body: words('Nadia Broussard') }])
  })

  it('opens one ticket for two requests fired together, one note and one confirmation, one answer 201 and the other 200 with the same ticket', async () => {
    const member = await person('Pierre Hebert')
    const before = await totals()
    const answers = await Promise.all([request(member.id), request(member.id)])
    const bodies = await Promise.all(answers.map((a) => expectContract(a, payout.response)))
    expect(answers.map((a) => a.status).sort()).toEqual([200, 201])
    expect(bodies.map((b) => b.created).sort()).toEqual([false, true])
    expect(new Set(bodies.map((b) => b.ticket.id)).size).toBe(1)

    const rows = await ticketsOf(member.id)
    expect(rows.map((r) => [r.id, r.kind, r.status])).toEqual([[bodies[0].ticket.id, 'payout_request', 'open']])
    expect(await messagesOf(rows[0].id)).toHaveLength(1)
    expect(await totals()).toEqual({ tickets: before.tickets + 1, messages: before.messages + 1 })
    expect(emailOutbox.filter((e) => e.to === ADMINS)).toHaveLength(1)
    expect(emailOutbox.filter((e) => e.to === member.email)).toHaveLength(1)
    expect(emailOutbox).toHaveLength(2)
  })

  it('opens one ticket for five requests fired together, as for two', async () => {
    const member = await person('Celeste Arceneaux')
    const answers = await Promise.all(Array.from({ length: 5 }, () => request(member.id)))
    const bodies = await Promise.all(answers.map((a) => expectContract(a, payout.response)))
    expect(answers.map((a) => a.status).sort()).toEqual([200, 200, 200, 200, 201])
    expect(new Set(bodies.map((b) => b.ticket.id)).size).toBe(1)
    const rows = await ticketsOf(member.id)
    expect(rows).toHaveLength(1)
    expect(await messagesOf(rows[0].id)).toHaveLength(1)
    expect(emailOutbox.map((e) => e.to).sort()).toEqual([ADMINS, member.email].sort())
  })

  it('holds a ticket in progress as open, and opens a new one once an admin has resolved it', async () => {
    const member = await person('Luc Fontenot')
    const first = await expectContract(await request(member.id), payout.response)
    await env.DB.prepare("UPDATE support_tickets SET status = 'in_progress' WHERE id = ?").bind(first.ticket.id).run()
    const held = await request(member.id)
    expect(held.status).toBe(200)
    expect(await expectContract(held, payout.response)).toEqual({ ticket: { ...first.ticket, status: 'in_progress' }, created: false })
    expect(emailOutbox).toHaveLength(2)

    await env.DB.prepare("UPDATE support_tickets SET status = 'resolved' WHERE id = ?").bind(first.ticket.id).run()
    const third = await request(member.id)
    expect(third.status).toBe(201)
    const opened = await expectContract(third, payout.response)
    expect(opened.created).toBe(true)
    expect(opened.ticket.id).not.toBe(first.ticket.id)
    const rows = await ticketsOf(member.id)
    expect(rows.map((r) => [r.id, r.status, r.kind])).toEqual([
      [first.ticket.id, 'resolved', 'payout_request'],
      [opened.ticket.id, 'open', 'payout_request'],
    ])
    expect(rows[1].number!).toBeGreaterThan(rows[0].number!)
    expect(await messagesOf(opened.ticket.id)).toHaveLength(1)
    expect(emailOutbox.map((e) => e.to).sort()).toEqual([ADMINS, ADMINS, member.email, member.email].sort())
  })

  it('writes a two-day event\'s days with a weekday on each, joined by "to", and no dash anywhere in the message', async () => {
    const director = await person('Marie Landry')
    const event = await seedTournament({ name: 'Acadiana Open', date: '2026-12-05' })
    await env.DB.prepare('UPDATE tournaments SET end_date = ? WHERE id = ?').bind('2026-12-06', event).run()
    await seedTournamentDirector(event, director.id)
    const body = await expectContract(await request(director.id, { tournamentId: event }), payout.response)
    const [message] = await messagesOf(body.ticket.id)
    expect(message.body.split('\n\n')).toEqual([words('Marie Landry'), 'Event: Acadiana Open (Sat, Dec 5 to Sun, Dec 6, 2026)'])
    expect(message.body).not.toMatch(ANY_DASH)
    expect((await ticketsOf(director.id))[0].about_id).toBe(event)
    expect(emailOutbox.find((e) => e.to === ADMINS)!.text).toContain('Event: Acadiana Open (Sat, Dec 5 to Sun, Dec 6, 2026)')
  })

  it('role safety: names an event only when the member manages it, so a hidden draft\'s id, another\'s event and an id with no event teach nothing', async () => {
    const club = await seedClub()
    const otherClub = await seedClub()
    const draft = await seedTournament({ name: 'Bayou Secret Draft', isVisible: false })
    const listed = await seedTournament({ name: 'Cajun Listed Swiss' })
    const ownClubEvent = await seedTournament({ name: 'Club Rep Quads', clubId: club })
    const otherClubEvent = await seedTournament({ name: 'Other Club Quads', clubId: otherClub })
    const cases: ReadonlyArray<readonly [string, { id: string; name: string; email: string }, string, string | null, string | null]> = [
      ['a member naming a hidden draft they do not manage', await person('Ines Mouton'), draft, null, 'Bayou Secret Draft'],
      ['a member naming a listed event they do not manage', await person('Jules Prejean'), listed, null, 'Cajun Listed Swiss'],
      ['a club rep naming another club\'s event', await person('Kara Babineaux', { role: 'club_rep', clubId: club }), otherClubEvent, null, 'Other Club Quads'],
      ['a club rep naming its own club\'s event', await person('Leon Savoie', { role: 'club_rep', clubId: club }), ownClubEvent, ownClubEvent, null],
      ['an LCA admin naming an id with no event', await person('Mona Richard', { role: 'lca_admin' }), 'tour-that-does-not-exist', null, 'tour-that-does-not-exist'],
    ]
    for (const [who, member, tournamentId, aboutId, unseen] of cases) {
      emailOutbox.length = 0
      const res = await request(member.id, { tournamentId })
      expect(res.status, who).toBe(201)
      const body = await expectContract(res, payout.response)
      const [row] = await ticketsOf(member.id)
      expect(row, who).toMatchObject({ id: body.ticket.id, member_id: member.id, kind: 'payout_request', about_id: aboutId })
      const [message] = await messagesOf(row.id)
      if (aboutId === null) {
        expect(message.body, who).toBe(words(member.name))
        expect(message.body, who).not.toContain('Event:')
      } else {
        expect(message.body, who).toBe(`${words(member.name)}\n\nEvent: Club Rep Quads (Sat, Sep 12, 2026)`)
      }
      if (unseen) {
        expect(JSON.stringify(await res.json()), who).not.toContain(unseen)
        for (const email of emailOutbox) expect(`${email.subject}${email.html}${email.text ?? ''}`, who).not.toContain(unseen)
      }
      expect(emailOutbox.map((e) => e.to).sort(), who).toEqual([ADMINS, member.email].sort())
    }
  })

  it('role safety: makes the ticket the caller\'s own, from their member row, whatever else the body carries', async () => {
    const caller = await person('Odette Guillory')
    const other = await person('Paul Boudreaux')
    const res = await request(caller.id, {
      memberId: other.id, member_id: other.id, name: 'Someone Else', email: 'someone.else@example.org', kind: 'listing_report', aboutId: 'tour-claimed', about_id: 'tour-claimed', subject: 'Other words',
    })
    expect(res.status).toBe(201)
    const body = await expectContract(res, payout.response)
    expect(await ticketsOf(caller.id)).toEqual([{
      id: body.ticket.id, number: expect.any(Number), member_id: caller.id, name: 'Odette Guillory', email: caller.email,
      subject: 'Payout account request from Odette Guillory', status: 'open', seat_id: null, kind: 'payout_request', about_id: null,
    }])
    expect(await messagesOf(body.ticket.id)).toEqual([{ ticket_id: body.ticket.id, sender_id: caller.id, sender_type: 'member', body: words('Odette Guillory') }])
    expect(await ticketsOf(other.id)).toEqual([])
    expect(emailOutbox.map((e) => e.to).sort()).toEqual([ADMINS, caller.email].sort())
  })

  it('answers a body that is not valid with 400 and the fields, storing and sending nothing', async () => {
    const member = await person('Quinn Thibodeaux')
    const before = await totals()
    const notJson = await invoke(payoutPost, { method: 'POST', as: member.id, rawBody: 'not json', path: '/api/me/payout-request' })
    expect(notJson.status).toBe(400)
    expect(await expectContract(notJson, fieldErrorBodySchema)).toEqual({ error: 'Invalid JSON body', fields: { body: 'The body is not valid JSON.' } })
    const wrongType = await request(member.id, { tournamentId: 7 })
    expect(wrongType.status).toBe(400)
    const refused = await expectContract(wrongType, fieldErrorBodySchema)
    expect(Object.keys(refused.fields)).toEqual(['tournamentId'])
    expect(await totals()).toEqual(before)
    expect(emailOutbox).toEqual([])
  })

  it('answers 409 with plain words, storing and sending nothing, when nothing was inserted and nothing is open once it reads again', async () => {
    const member = await person('Rosa Doucet')
    const before = await totals()
    flags.insertNothing = true
    const res = await request(member.id)
    expect(res.status).toBe(409)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'We could not save your request just now. Please try again.' })
    expect(await ticketsOf(member.id)).toEqual([])
    expect(await totals()).toEqual(before)
    expect(emailOutbox).toEqual([])
  })
})

describe('POST /api/me/payout-request with the constant unset, and signed out', () => {
  it('refuses with 403 and the plain words before the body or any ticket is read, storing and sending nothing', async () => {
    flags.rolesOn = false
    const director = await person('Sylvie Romero')
    const event = await seedTournament({ name: 'Unset Quads' })
    await seedTournamentDirector(event, director.id)
    const before = await totals()
    for (const body of [{}, { tournamentId: event }, { tournamentId: 7 }]) {
      const res = await request(director.id, body)
      expect(res.status, JSON.stringify(body)).toBe(403)
      expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Not available yet.' })
    }
    const notJson = await invoke(payoutPost, { method: 'POST', as: director.id, rawBody: 'not json', path: '/api/me/payout-request' })
    expect(notJson.status).toBe(403)
    expect(await ticketsOf(director.id)).toEqual([])
    expect(await totals()).toEqual(before)
    expect(emailOutbox).toEqual([])
  })

  it('refuses with 403 even for a member whose request is open, without answering it', async () => {
    const member = await person('Theo Breaux')
    const first = await expectContract(await request(member.id), payout.response)
    flags.rolesOn = false
    emailOutbox.length = 0
    const before = await totals()
    const res = await request(member.id)
    expect(res.status).toBe(403)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Not available yet.' })
    expect((await ticketsOf(member.id)).map((r) => r.id)).toEqual([first.ticket.id])
    expect(await totals()).toEqual(before)
    expect(emailOutbox).toEqual([])
  })

  it('answers 401 with no sign-in in both states, storing and sending nothing', async () => {
    const before = await totals()
    for (const on of [true, false]) {
      flags.rolesOn = on
      const res = await request(undefined)
      expect(res.status).toBe(401)
      expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Unauthorized' })
    }
    expect(await totals()).toEqual(before)
    expect(emailOutbox).toEqual([])
  })
})

describe('createTicket called twice in a row with oneOpenPerMember, no read between', () => {
  /** The real helper, not this file's pass-through, so its guard alone decides. */
  const realHelper = async () => (await vi.importActual<typeof import('../../../functions/utils/admin/tickets')>('../../../functions/utils/admin/tickets')).createTicket
  const input = (member: { id: string; name: string; email: string }, body: string) => ({
    name: member.name, email: member.email, subject: `Payout account request from ${member.name}`, body, memberId: member.id,
    seatRef: null, siteUrl: SITE, kind: 'payout_request', aboutId: null, oneOpenPerMember: true,
  })

  it('opens the ticket on the first call and nothing on the second: the tickets, the messages and the outbox stay as the first call left them', async () => {
    const createTicket = await realHelper()
    const member = await person('Vera Melancon')
    const first = await createTicket(env as unknown as Env, input(member, 'First call.'))
    expect(first).toEqual({ ticketId: first.ticketId, ticketNumber: first.ticketNumber, seat: null, holders: [], created: true })
    expect(first.ticketNumber).toBeGreaterThan(1000)
    const left = { ...(await totals()), emails: emailOutbox.map((e) => e.to).sort() }
    expect(left.emails).toEqual([ADMINS, member.email].sort())

    const second = await createTicket(env as unknown as Env, input(member, 'Second call.'))
    expect(second).toEqual({ ticketId: second.ticketId, ticketNumber: null, seat: null, holders: [], created: false })
    expect(second.ticketId).not.toBe(first.ticketId)
    expect({ ...(await totals()), emails: emailOutbox.map((e) => e.to).sort() }).toEqual(left)
    expect(await ticketsOf(member.id)).toEqual([expect.objectContaining({ id: first.ticketId, number: first.ticketNumber, kind: 'payout_request', status: 'open' })])
    expect((await messagesOf(first.ticketId)).map((m) => m.body)).toEqual(['First call.'])
    expect(await messagesOf(second.ticketId)).toEqual([])
  })

  it('holds one open ticket per member and per kind: another member, an ordinary ticket, a guest and the call without the guard still open theirs', async () => {
    const createTicket = await realHelper()
    const member = await person('Wade Hebert')
    const neighbour = await person('Xavier Comeaux')
    expect((await createTicket(env as unknown as Env, input(member, 'Open.'))).created).toBe(true)
    const before = await totals()
    const results = [
      await createTicket(env as unknown as Env, input(neighbour, 'Another member.')),
      await createTicket(env as unknown as Env, { ...input(member, 'An ordinary ticket.'), kind: null }),
      await createTicket(env as unknown as Env, { ...input(member, 'A guest.'), memberId: null }),
      await createTicket(env as unknown as Env, { ...input(member, 'No guard.'), oneOpenPerMember: false }),
    ]
    expect(results.map((r) => r.created)).toEqual([true, true, true, true])
    for (const r of results) expect(r.ticketNumber).toBeGreaterThan(1000)
    expect(await totals()).toEqual({ tickets: before.tickets + 4, messages: before.messages + 4 })
    expect((await ticketsOf(member.id)).map((r) => r.kind)).toEqual(['payout_request', null, 'payout_request'])
    expect((await ticketsOf(neighbour.id)).map((r) => r.kind)).toEqual(['payout_request'])
    const guest = await env.DB.prepare('SELECT member_id, kind FROM support_tickets WHERE id = ?').bind(results[2].ticketId).first()
    expect(guest).toEqual({ member_id: null, kind: 'payout_request' })
    expect((await messagesOf(results[2].ticketId))[0]).toMatchObject({ sender_id: null, sender_type: 'guest', body: 'A guest.' })
    // Each of the five tickets sent the admins' note and its confirmation, the guest's to the address it gave.
    expect(emailOutbox.map((e) => e.to).sort()).toEqual([
      ADMINS, ADMINS, ADMINS, ADMINS, ADMINS, member.email, member.email, member.email, member.email, neighbour.email,
    ].sort())
  })
})
