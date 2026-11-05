// test/integration/me-creation-edges.test.ts
//
// The two endpoints of WS08 step 7 at their edges, through the real handlers
// on the database built from the migrations, reading the stored rows and the
// harness's outbox after every call:
// - role safety: both answer a preflight with 204 and no body, in both
//   states of the constant, whoever asks; a token the sign-in service refuses
//   is 401 { error } in both states, with no member row made and nothing
//   stored or sent; a person signed in for the first time is answered from
//   the row their sign-in makes; and the request is answered without its
//   number and is in the member's own support list and conversation without
//   it, in no one else's, and in Admin's support list, with its number, for
//   the three roles that read it alone;
// - the grant answer reads the member as they are at each request: an LCA
//   admin before the seat and the seat before the role, and a term that has
//   ended, a role taken away or a club taken from a club rep taking the grant
//   with it;
// - one open request per member through the admins' own handlers: a reply
//   puts the ticket in progress and holds it open, a resolve or a delete
//   frees the next request, and a resolved ticket the member reopens beside a
//   newer one leaves the newer the one answered;
// - only the member's own open payout request holds a request back: an open
//   ticket of another kind, an ordinary ticket from the support form, a
//   resolved request and another member's request do not, the support form
//   and the contact form answer, store and send as before while one is open,
//   and members asking at the same moment, a contact form among them, each
//   get their own ticket, numbered in turn;
// - a second request naming another event, a hidden draft or nothing changes
//   nothing on the open ticket;
// - the event line: a weekday on each day across the clocks' changes in
//   Louisiana and the new year, a day once when the event ends on it, and an
//   event named only as canManageTournament admits it, an LCA admin's any
//   event that exists and a one-event director's own hidden draft, and not a
//   creator's with no director row;
// - names are stored as written and escaped in the emails;
// - empty data: the first ticket on an empty support list is 1001;
// - an email outage, or one address failing, fails no request;
// - a body that is not an object, or none, answers 400 with its fields, and
//   an empty tournamentId names no event;
// - createTicket's guard with a board seat holds back all three emails, and
//   holds back only the kind it is given.
// CREATION_ROLES_ON is false in the tree. It is read here through a getter on
// the mocked module, set for every case unless the case says otherwise and
// put back after each.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema } from '../../domain/contracts'
import { onRequestGet as adminSupportGet } from '../../functions/api/admin/support'
import {
  onRequestDelete as adminTicketDelete,
  onRequestPatch as adminTicketPatch,
  onRequestPost as adminTicketReply,
} from '../../functions/api/admin/support/[id]'
import { onRequestPost as contactPost } from '../../functions/api/contact'
import { onRequestOptions as payoutOptions, onRequestPost as payoutPost } from '../../functions/api/me/payout-request'
import { onRequestGet as creationGet, onRequestOptions as creationOptions } from '../../functions/api/me/tournament-creation'
import { onRequestGet as supportListGet, onRequestPost as supportPost } from '../../functions/api/support'
import { onRequestGet as supportTicketGet, onRequestPost as memberReply } from '../../functions/api/support/[id]'
import type { Env } from '../../functions/types'
import { createTicket } from '../../functions/utils/admin/tickets'
import { seedAdmin, seedClub, seedMember, seedPresident, seedTournament, seedTournamentDirector } from './factories'
import { emailBehavior, emailOutbox, expectContract, invoke, resetHarness } from './harness'

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

beforeEach(() => {
  resetHarness()
  flags.rolesOn = true
})
afterEach(() => {
  flags.rolesOn = false
})

const creation = contracts['me/tournament-creation'].GET
const payout = contracts['me/payout-request'].POST

/** Where the admins' note goes: CONTACT_EMAIL in vitest.integration.config.ts. */
const ADMINS = 'contact@louisianachess.org'
const SITE = 'https://www.louisianachess.org'
/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)

/** The words of the ticket's first message for a member of this name, before any line about an event. */
const words = (name: string) =>
  `${name} asked LCA to set up a payout account for them: a connected account inside LCA's Stripe account (Stripe Connect), so their events can charge entry fees and the money reaches them. Until it exists their events run at $0.`

const grantOf = (as?: string) => invoke(creationGet, { method: 'GET', as, path: '/api/me/tournament-creation' })
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

/** Every ticket a member holds, oldest first by number. */
const ticketsOf = async (memberId: string) =>
  (await env.DB.prepare(
    'SELECT id, number, member_id, name, email, subject, status, seat_id, kind, about_id FROM support_tickets WHERE member_id = ? ORDER BY number',
  ).bind(memberId).all<TicketRow>()).results
const ticket = async (id: string) =>
  env.DB.prepare('SELECT id, number, member_id, name, email, subject, status, seat_id, kind, about_id FROM support_tickets WHERE id = ?').bind(id).first<TicketRow>()
/** A ticket's messages, oldest first. */
const messagesOf = async (ticketId: string) =>
  (await env.DB.prepare('SELECT ticket_id, sender_id, sender_type, body FROM support_messages WHERE ticket_id = ? ORDER BY created_at, id')
    .bind(ticketId).all<MessageRow>()).results
/** How many tickets and messages the whole database holds. */
const totals = async () => ({
  tickets: (await env.DB.prepare('SELECT COUNT(*) AS n FROM support_tickets').first<{ n: number }>())!.n,
  messages: (await env.DB.prepare('SELECT COUNT(*) AS n FROM support_messages').first<{ n: number }>())!.n,
})
const memberRow = (id: string) => env.DB.prepare('SELECT id, role, full_name, email FROM members WHERE id = ?').bind(id).first()
/** Who the outbox has written to, in order. */
const recipients = () => emailOutbox.map((e) => e.to)
const sorted = (list: string[]) => [...list].sort()

let people = 0
/** A member with a name and an address of their own, so each case's emails can be told apart. */
async function person(fullName: string, opts: { role?: string; clubId?: string | null } = {}): Promise<{ id: string; name: string; email: string }> {
  const email = `edge-person${++people}@example.org`
  const id = await seedMember({ fullName, email, ...opts })
  return { id, name: fullName, email }
}
/** A one-event director of a new event, and the event. */
async function directorOf(fullName: string, event: { name: string; date: string; endDate?: string | null; isVisible?: boolean }) {
  const director = await person(fullName)
  const id = await seedTournament({ name: event.name, date: event.date, isVisible: event.isVisible })
  if (event.endDate !== undefined) await env.DB.prepare('UPDATE tournaments SET end_date = ? WHERE id = ?').bind(event.endDate, id).run()
  await seedTournamentDirector(id, director.id)
  return { director, event: id }
}

describe('role safety on both endpoints', () => {
  it('answers a preflight with 204 and no body, signed out or in, whether the constant is set or not', async () => {
    const admin = await seedAdmin()
    const before = await totals()
    for (const on of [true, false]) {
      flags.rolesOn = on
      for (const [handler, path] of [[creationOptions, '/api/me/tournament-creation'], [payoutOptions, '/api/me/payout-request']] as const) {
        for (const as of [undefined, admin]) {
          const res = await invoke(handler, { method: 'OPTIONS', as, path })
          expect(res.status, `${path} ${as ?? 'signed out'}`).toBe(204)
          expect(await res.response.text()).toBe('')
          expect(res.response.headers.get('Content-Type')).toBeNull()
        }
      }
    }
    expect(await totals()).toEqual(before)
    expect(emailOutbox).toEqual([])
  })

  it('answers a token the sign-in service refuses with 401 { error } in both states, making no member row and storing and sending nothing', async () => {
    const refused = `invalid-edge-${++people}`
    const before = await totals()
    for (const on of [true, false]) {
      flags.rolesOn = on
      for (const res of [await grantOf(refused), await request(refused, { tournamentId: 'tour-anything' })]) {
        expect(res.status).toBe(401)
        expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Unauthorized' })
      }
    }
    expect(await memberRow(refused)).toBeNull()
    expect(await totals()).toEqual(before)
    expect(emailOutbox).toEqual([])
  })

  it('answers a person signed in for the first time from the row their sign-in makes: no grant, and a ticket in that row\'s name and address', async () => {
    const newcomer = `edge-newcomer-${++people}`
    expect(await memberRow(newcomer)).toBeNull()
    expect(await expectContract(await grantOf(newcomer), creation.response)).toEqual({ grant: 'none', canCreate: false, canChargeFees: false, clubId: null })
    expect(await memberRow(newcomer)).toEqual({ id: newcomer, role: 'member', full_name: `Test User ${newcomer}`, email: `${newcomer}@test.lca` })

    const res = await request(newcomer)
    expect(res.status).toBe(201)
    const body = await expectContract(res, payout.response)
    expect(await ticketsOf(newcomer)).toEqual([{
      id: body.ticket.id, number: expect.any(Number), member_id: newcomer, name: `Test User ${newcomer}`, email: `${newcomer}@test.lca`,
      subject: `Payout account request from Test User ${newcomer}`, status: 'open', seat_id: null, kind: 'payout_request', about_id: null,
    }])
    expect(sorted(recipients())).toEqual(sorted([ADMINS, `${newcomer}@test.lca`]))
  })

  it('answers the request and puts it in the member\'s own support list and conversation without its number, in no one else\'s, and in Admin\'s list for its three roles alone', async () => {
    const { director, event } = await directorOf('Agnes Thibodeaux', { name: 'Opelousas Fall Quads', date: '2026-11-21' })
    const opened = await expectContract(await request(director.id, { tournamentId: event }), payout.response)
    const id = opened.ticket.id
    expect(Object.keys(opened.ticket).sort()).toEqual(['id', 'kind', 'status'])
    const number = (await ticket(id))?.number
    expect(number).toBeGreaterThan(1000)

    const own = await invoke(supportListGet, { method: 'GET', as: director.id, path: '/api/support' })
    expect(own.status).toBe(200)
    const listed = (await own.json<{ tickets: Array<Record<string, unknown>> }>()).tickets.find((t) => t.id === id)
    expect(listed).toMatchObject({ id, kind: 'payout_request', about_id: event, member_id: director.id, status: 'open', subject: 'Payout account request from Agnes Thibodeaux' })
    expect(Object.keys(listed!)).not.toContain('number')

    const conversation = await invoke(supportTicketGet, { method: 'GET', as: director.id, params: { id }, path: `/api/support/${id}` })
    expect(conversation.status).toBe(200)
    const read = await conversation.json<{ ticket: Record<string, unknown>; messages: Array<{ body: string }> }>()
    expect(read.ticket).toMatchObject({ id, kind: 'payout_request', about_id: event })
    expect(Object.keys(read.ticket)).not.toContain('number')
    expect(read.messages.map((m) => m.body)).toEqual([`${words('Agnes Thibodeaux')}\n\nEvent: Opelousas Fall Quads (Sat, Nov 21, 2026)`])

    const stranger = await person('Basile Comeaux')
    const theirs = await invoke(supportListGet, { method: 'GET', as: stranger.id, path: '/api/support' })
    expect((await theirs.json<{ tickets: Array<{ id: string }> }>()).tickets.map((t) => t.id)).not.toContain(id)
    const peek = await invoke(supportTicketGet, { method: 'GET', as: stranger.id, params: { id }, path: `/api/support/${id}` })
    expect(peek.status).toBe(404)
    expect(await expectContract(peek, errorBodySchema)).toEqual({ error: 'Ticket not found' })

    for (const role of ['lca_admin', 'lca_observer', 'lca_officer']) {
      const res = await invoke(adminSupportGet, { method: 'GET', as: await seedMember({ role }), path: '/api/admin/support' })
      expect(res.status, role).toBe(200)
      const row = (await res.json<{ tickets: Array<Record<string, unknown>> }>()).tickets.find((t) => t.id === id)
      expect(row, role).toMatchObject({ kind: 'payout_request', about_id: event, number, message_count: 1 })
    }
    const club = await seedClub()
    for (const role of ['member', 'lca_auditor', 'tournament_director', 'club_rep']) {
      const res = await invoke(adminSupportGet, { method: 'GET', as: await seedMember({ role, clubId: role === 'club_rep' ? club : null }), path: '/api/admin/support' })
      expect(res.status, role).toBe(403)
      const text = await res.response.text()
      expect(text, role).not.toContain(id)
      expect(text, role).not.toContain('payout_request')
    }
    // Reading the lists stores and sends nothing: the request's two emails are all there is.
    expect(await ticketsOf(director.id)).toHaveLength(1)
    expect(await messagesOf(id)).toHaveLength(1)
    expect(sorted(recipients())).toEqual(sorted([ADMINS, director.email]))
  })
})

describe('the grant answer reads the member as they are at each request', () => {
  it('puts an LCA admin before the seat and the seat before the role, and with the constant unset answers both as today', async () => {
    const admin = await seedAdmin()
    await seedPresident(admin)
    const director = await seedMember({ role: 'tournament_director' })
    await seedPresident(director)
    const before = await totals()
    expect(await expectContract(await grantOf(admin), creation.response)).toEqual({ grant: 'admin', canCreate: true, canChargeFees: true, clubId: null })
    expect(await expectContract(await grantOf(director), creation.response)).toEqual({ grant: 'president', canCreate: true, canChargeFees: true, clubId: null })
    flags.rolesOn = false
    expect(await expectContract(await grantOf(admin), creation.response)).toEqual({ grant: 'admin', canCreate: true, canChargeFees: true, clubId: null })
    expect(await expectContract(await grantOf(director), creation.response)).toEqual({ grant: 'none', canCreate: false, canChargeFees: true, clubId: null })
    expect(await totals()).toEqual(before)
    expect(emailOutbox).toEqual([])
  })

  it('takes the grant away with the term, the role or the club: each change shows in the next answer, nothing kept from the one before', async () => {
    const seated = await seedMember({ role: 'tournament_director' })
    await seedPresident(seated)
    expect((await expectContract(await grantOf(seated), creation.response)).grant).toBe('president')
    await env.DB.prepare("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE member_id = ? AND ended_at IS NULL").bind(seated).run()
    expect(await expectContract(await grantOf(seated), creation.response)).toEqual({ grant: 'standing_director', canCreate: true, canChargeFees: true, clubId: null })
    await env.DB.prepare("UPDATE members SET role = 'member' WHERE id = ?").bind(seated).run()
    expect(await expectContract(await grantOf(seated), creation.response)).toEqual({ grant: 'none', canCreate: false, canChargeFees: false, clubId: null })

    const club = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: club })
    expect(await expectContract(await grantOf(rep), creation.response)).toEqual({ grant: 'club_rep', canCreate: false, canChargeFees: true, clubId: club })
    await env.DB.prepare('UPDATE members SET club_id = NULL WHERE id = ?').bind(rep).run()
    expect(await expectContract(await grantOf(rep), creation.response)).toEqual({ grant: 'none', canCreate: false, canChargeFees: false, clubId: null })
    expect(emailOutbox).toEqual([])
  })
})

describe('one open request per member, through the admins\' own handlers', () => {
  it('holds a ticket the admin has answered as open, in progress, and opens a new one, numbered after it, once the admin marks it resolved', async () => {
    const member = await person('Celestin Guidry')
    const admin = await seedAdmin()
    const first = await expectContract(await request(member.id), payout.response)
    const id = first.ticket.id

    const reply = await invoke(adminTicketReply, { method: 'POST', as: admin, params: { id }, body: { body: 'We are setting up your payout account.' }, path: `/api/admin/support/${id}` })
    expect(reply.status).toBe(201)
    emailOutbox.length = 0
    const held = await request(member.id)
    expect(held.status).toBe(200)
    expect(await expectContract(held, payout.response)).toEqual({ ticket: { ...first.ticket, status: 'in_progress' }, created: false })
    expect(emailOutbox).toEqual([])
    expect((await messagesOf(id)).map((m) => m.sender_type)).toEqual(['member', 'admin'])

    const resolved = await invoke(adminTicketPatch, { method: 'PATCH', as: admin, params: { id }, body: { status: 'resolved' }, path: `/api/admin/support/${id}` })
    expect(resolved.status).toBe(200)
    const next = await request(member.id)
    expect(next.status).toBe(201)
    const opened = await expectContract(next, payout.response)
    expect(opened.created).toBe(true)
    const rows = await ticketsOf(member.id)
    expect(rows.map((r) => [r.id, r.status])).toEqual([[id, 'resolved'], [opened.ticket.id, 'open']])
    expect(rows[1].number!).toBeGreaterThan(rows[0].number!)
    expect(sorted(recipients())).toEqual(sorted([ADMINS, member.email]))
  })

  it('opens a new ticket once an admin has deleted the open one', async () => {
    const member = await person('Dorothee Breaux')
    const first = await expectContract(await request(member.id), payout.response)
    const removed = await invoke(adminTicketDelete, { method: 'DELETE', as: await seedAdmin(), params: { id: first.ticket.id }, path: `/api/admin/support/${first.ticket.id}` })
    expect(removed.status).toBe(200)
    expect(await ticketsOf(member.id)).toEqual([])
    emailOutbox.length = 0

    const next = await request(member.id)
    expect(next.status).toBe(201)
    const opened = await expectContract(next, payout.response)
    expect(opened.ticket.id).not.toBe(first.ticket.id)
    expect((await ticketsOf(member.id)).map((r) => [r.id, r.status, r.kind])).toEqual([[opened.ticket.id, 'open', 'payout_request']])
    expect(await messagesOf(opened.ticket.id)).toHaveLength(1)
    expect(sorted(recipients())).toEqual(sorted([ADMINS, member.email]))
  })

  it('answers the newer of two open requests when the member reopens a resolved one by replying, and opens nothing more, the helper\'s guard alone included', async () => {
    const member = await person('Etienne Savoie')
    const older = await expectContract(await request(member.id), payout.response)
    // Long before the newer one, whatever the clock of the test's runtime says.
    await env.DB.prepare("UPDATE support_tickets SET status = 'resolved', created_at = '2000-01-01 00:00:00' WHERE id = ?").bind(older.ticket.id).run()
    const newer = await expectContract(await request(member.id), payout.response)
    expect(newer.created).toBe(true)

    const reopened = await invoke(memberReply, { method: 'POST', as: member.id, params: { id: older.ticket.id }, body: { body: 'One more thing about the account.' }, path: `/api/support/${older.ticket.id}` })
    expect(reopened.status).toBe(201)
    expect((await ticketsOf(member.id)).map((r) => [r.id, r.status])).toEqual([[older.ticket.id, 'open'], [newer.ticket.id, 'open']])
    const before = await totals()
    emailOutbox.length = 0

    const again = await request(member.id)
    expect(again.status).toBe(200)
    expect(await expectContract(again, payout.response)).toEqual({ ticket: newer.ticket, created: false })
    const helper = await createTicket(env as unknown as Env, {
      name: member.name, email: member.email, subject: `Payout account request from ${member.name}`, body: 'A third time.', memberId: member.id,
      seatRef: null, siteUrl: SITE, kind: 'payout_request', aboutId: null, oneOpenPerMember: true,
    })
    expect(helper.created).toBe(false)
    expect(await totals()).toEqual(before)
    expect(emailOutbox).toEqual([])
  })
})

describe('only the member\'s own open payout request holds a request back', () => {
  it('opens the request beside an open ticket of another kind, an ordinary ticket from the support form and a resolved request, and another member\'s beside it', async () => {
    const member = await person('Fleur Arceneaux')
    const ordinary = await invoke(supportPost, {
      method: 'POST', as: member.id, path: '/api/support', body: { name: member.name, email: member.email, subject: 'Parking at the hall', body: 'Where do we park?' },
    })
    expect(ordinary.status).toBe(201)
    const insertTicket = (id: string, kind: string, status: string, aboutId: string | null) =>
      env.DB.prepare(
        `INSERT INTO support_tickets (id, number, member_id, name, email, subject, status, kind, about_id)
         SELECT ?, COALESCE(MAX(number), 1000) + 1, ?, ?, ?, ?, ?, ?, ? FROM support_tickets`,
      ).bind(id, member.id, member.name, member.email, `A ${kind} ticket`, status, kind, aboutId).run()
    await insertTicket(`ticket-edge-listing-${people}`, 'listing_report', 'open', 'listing-edge')
    await insertTicket(`ticket-edge-resolved-${people}`, 'payout_request', 'resolved', null)
    emailOutbox.length = 0

    const res = await request(member.id)
    expect(res.status).toBe(201)
    const body = await expectContract(res, payout.response)
    expect((await ticketsOf(member.id)).map((r) => [r.kind, r.status])).toEqual([
      [null, 'open'], ['listing_report', 'open'], ['payout_request', 'resolved'], ['payout_request', 'open'],
    ])
    expect((await ticketsOf(member.id)).at(-1)!.id).toBe(body.ticket.id)

    const neighbour = await person('Gaston Hebert')
    const theirs = await request(neighbour.id)
    expect(theirs.status).toBe(201)
    const other = await expectContract(theirs, payout.response)
    expect(other.ticket.id).not.toBe(body.ticket.id)
    expect((await ticketsOf(neighbour.id)).map((r) => [r.id, r.kind])).toEqual([[other.ticket.id, 'payout_request']])
    expect(sorted(recipients())).toEqual(sorted([ADMINS, member.email, ADMINS, neighbour.email]))
  })

  it('leaves the support form and the contact form as they were while a request is open: each answers, stores and sends as before', async () => {
    const member = await person('Henriette Landry')
    const open = await expectContract(await request(member.id), payout.response)
    emailOutbox.length = 0
    const form = (subject: string) => ({ name: member.name, email: member.email, subject, body: `About ${subject.toLowerCase()}.` })
    const answers = [
      await invoke(supportPost, { method: 'POST', as: member.id, path: '/api/support', body: form('Rating question') }),
      await invoke(supportPost, { method: 'POST', as: member.id, path: '/api/support', body: form('Second question') }),
      await invoke(contactPost, { method: 'POST', as: member.id, path: '/api/contact', body: form('Contact question') }),
    ]
    const ids: string[] = []
    for (const answer of answers) {
      expect(answer.status).toBe(201)
      const json = await answer.json<{ success: boolean; ticketId: string; routedTo: string | null }>()
      expect(Object.keys(json).sort()).toEqual(['routedTo', 'success', 'ticketId'])
      expect(json).toMatchObject({ success: true, routedTo: null })
      ids.push(json.ticketId)
    }
    const rows = await ticketsOf(member.id)
    const number = (await ticket(open.ticket.id))!.number!
    expect(rows.map((r) => [r.id, r.kind, r.about_id, r.status, r.number])).toEqual([
      [open.ticket.id, 'payout_request', null, 'open', number],
      [ids[0], null, null, 'open', number + 1],
      [ids[1], null, null, 'open', number + 2],
      [ids[2], null, null, 'open', number + 3],
    ])
    for (const id of ids) expect((await messagesOf(id)).map((m) => [m.sender_id, m.sender_type])).toEqual([[member.id, 'member']])
    expect(sorted(recipients())).toEqual(sorted([ADMINS, member.email, ADMINS, member.email, ADMINS, member.email]))

    const again = await request(member.id)
    expect(again.status).toBe(200)
    expect(await expectContract(again, payout.response)).toEqual({ ticket: open.ticket, created: false })
  })

  it('gives members asking at the same moment their own tickets, numbered in turn, a contact form among them, and one ticket to the member who asks twice', async () => {
    const [a, b, c] = [await person('Isaure Mouton'), await person('Jules Prejean'), await person('Lucie Richard')]
    const highest = (await env.DB.prepare('SELECT COALESCE(MAX(number), 1000) AS n FROM support_tickets').first<{ n: number }>())!.n
    const visitor = { name: 'Nora Visitor', email: `edge-visitor${++people}@example.org`, subject: 'Hall hours', body: 'When does the hall open?' }
    const answers = await Promise.all([
      request(a.id), invoke(contactPost, { method: 'POST', body: visitor, path: '/api/contact' }), request(b.id), request(c.id), request(a.id),
    ])
    expect(answers.map((r) => r.status)).toEqual([expect.any(Number), 201, 201, 201, expect.any(Number)])
    expect([answers[0].status, answers[4].status].sort()).toEqual([200, 201])

    const fresh = (await env.DB.prepare('SELECT number, member_id, kind FROM support_tickets WHERE number > ? ORDER BY number').bind(highest)
      .all<{ number: number; member_id: string | null; kind: string | null }>()).results
    expect(fresh.map((r) => r.number)).toEqual([highest + 1, highest + 2, highest + 3, highest + 4])
    expect(sorted(fresh.map((r) => `${r.member_id ?? 'visitor'} ${r.kind ?? 'ordinary'}`))).toEqual(sorted([
      `${a.id} payout_request`, `${b.id} payout_request`, `${c.id} payout_request`, 'visitor ordinary',
    ]))
    for (const member of [a, b, c]) expect((await ticketsOf(member.id)).map((r) => r.kind)).toEqual(['payout_request'])
    const [first, last] = [await expectContract(answers[0], payout.response), await expectContract(answers[4], payout.response)]
    expect(first.ticket.id).toBe(last.ticket.id)
    expect(sorted(recipients())).toEqual(sorted([ADMINS, ADMINS, ADMINS, ADMINS, a.email, b.email, c.email, visitor.email]))
  })
})

describe('a second request changes nothing on the open ticket', () => {
  it('answers the open ticket to a request naming another event the member directs, a hidden draft or nothing, its event, its message and the outbox as the first left them', async () => {
    const { director, event } = await directorOf('Marcel Doucet', { name: 'Ruston Fall Swiss', date: '2026-11-14' })
    const other = await seedTournament({ name: 'Monroe Winter Open', date: '2026-12-12' })
    await seedTournamentDirector(other, director.id)
    const draft = await seedTournament({ name: 'Shreveport Secret Draft', isVisible: false })
    const opened = await expectContract(await request(director.id, { tournamentId: event }), payout.response)
    const left = { tickets: await ticketsOf(director.id), messages: await messagesOf(opened.ticket.id), totals: await totals(), emails: recipients() }
    expect(left.messages.map((m) => m.body)).toEqual([`${words('Marcel Doucet')}\n\nEvent: Ruston Fall Swiss (Sat, Nov 14, 2026)`])

    for (const body of [{ tournamentId: other }, { tournamentId: draft }, {}, { tournamentId: null }]) {
      const res = await request(director.id, body)
      expect(res.status, JSON.stringify(body)).toBe(200)
      expect(await expectContract(res, payout.response)).toEqual({ ticket: opened.ticket, created: false })
      const text = await res.response.text()
      expect(text).not.toContain('Monroe Winter Open')
      expect(text).not.toContain('Shreveport Secret Draft')
    }
    expect({ tickets: await ticketsOf(director.id), messages: await messagesOf(opened.ticket.id), totals: await totals(), emails: recipients() }).toEqual(left)
    expect(left.tickets.map((r) => r.about_id)).toEqual([event])
  })
})

describe('the event line', () => {
  it('writes a weekday on each day across the clocks\' changes in Louisiana and the new year, and one day when the event ends on the day it starts', async () => {
    const cases: ReadonlyArray<readonly [string, string, string | null, string]> = [
      ['Bayou Fall Back Open', '2026-11-01', null, 'Sun, Nov 1, 2026'],
      ['Spring Forward Swiss', '2026-03-08', '2026-03-08', 'Sun, Mar 8, 2026'],
      ['Clocks Change Weekend', '2026-10-31', '2026-11-01', 'Sat, Oct 31 to Sun, Nov 1, 2026'],
      ['New Year Open', '2026-12-31', '2027-01-01', 'Thu, Dec 31, 2026 to Fri, Jan 1, 2027'],
    ]
    for (const [name, date, endDate, days] of cases) {
      emailOutbox.length = 0
      const { director, event } = await directorOf(`Director of ${name}`, { name, date, endDate })
      const res = await request(director.id, { tournamentId: event })
      expect(res.status, name).toBe(201)
      const body = await expectContract(res, payout.response)
      const [message] = await messagesOf(body.ticket.id)
      const line = `Event: ${name} (${days})`
      expect(message.body.split('\n\n'), name).toEqual([words(`Director of ${name}`), line])
      expect(message.body, name).not.toMatch(DASHES)
      expect(message.body, name).not.toMatch(/-/)
      expect((await ticket(body.ticket.id))?.about_id, name).toBe(event)
      const note = emailOutbox.find((e) => e.to === ADMINS)!
      expect(note.text, name).toContain(line)
      expect(note.html, name).toContain(line)
      expect(emailOutbox.find((e) => e.to === director.email)!.html, name).toContain(line)
    }
  })

  it('names an event as canManageTournament admits it: an LCA admin any event that exists, a hidden draft among them; a one-event director their own hidden draft; a creator with no director row none', async () => {
    const admin = await person('Noemie Richard', { role: 'lca_admin' })
    const draft = await seedTournament({ name: 'Lake Charles Hidden Draft', date: '2026-12-19', isVisible: false })
    const fromAdmin = await expectContract(await request(admin.id, { tournamentId: draft }), payout.response)
    expect(sorted(recipients())).toEqual(sorted([ADMINS, admin.email]))
    expect(emailOutbox.find((e) => e.to === ADMINS)!.text).toContain('Event: Lake Charles Hidden Draft (Sat, Dec 19, 2026)')
    expect((await ticket(fromAdmin.ticket.id))?.about_id).toBe(draft)
    expect((await messagesOf(fromAdmin.ticket.id))[0].body).toBe(`${words('Noemie Richard')}\n\nEvent: Lake Charles Hidden Draft (Sat, Dec 19, 2026)`)

    const { director, event } = await directorOf('Octave Fontenot', { name: 'Houma Draft Quads', date: '2027-01-09', isVisible: false })
    const fromDirector = await expectContract(await request(director.id, { tournamentId: event }), payout.response)
    expect((await ticket(fromDirector.ticket.id))?.about_id).toBe(event)
    expect((await messagesOf(fromDirector.ticket.id))[0].body).toBe(`${words('Octave Fontenot')}\n\nEvent: Houma Draft Quads (Sat, Jan 9, 2027)`)

    const creator = await person('Paulette Babineaux', { role: 'tournament_director' })
    const made = await seedTournament({ name: 'Creator Only Swiss', isVisible: false, createdBy: creator.id })
    emailOutbox.length = 0
    const res = await request(creator.id, { tournamentId: made })
    expect(res.status).toBe(201)
    const fromCreator = await expectContract(res, payout.response)
    expect((await ticket(fromCreator.ticket.id))?.about_id).toBeNull()
    expect((await messagesOf(fromCreator.ticket.id))[0].body).toBe(words('Paulette Babineaux'))
    expect(await res.response.text()).not.toContain('Creator Only Swiss')
    expect(sorted(recipients())).toEqual(sorted([ADMINS, creator.email]))
    for (const email of emailOutbox) expect(`${email.subject}${email.html}${email.text ?? ''}`).not.toContain('Creator Only Swiss')
  })
})

describe('what the ticket stores and the emails show', () => {
  it('stores the member\'s name and the event\'s name as written, and the emails escape them', async () => {
    const name = `Zoe <b>O'Neil</b>`
    const { director, event } = await directorOf(name, { name: 'Bayou <Open> & "Quads"', date: '2026-12-05' })
    const body = await expectContract(await request(director.id, { tournamentId: event }), payout.response)
    expect(await ticket(body.ticket.id)).toMatchObject({ name, subject: `Payout account request from ${name}`, kind: 'payout_request', about_id: event })
    expect((await messagesOf(body.ticket.id))[0].body).toBe(`${words(name)}\n\nEvent: Bayou <Open> & "Quads" (Sat, Dec 5, 2026)`)

    const note = emailOutbox.find((e) => e.to === ADMINS)!
    const confirmation = emailOutbox.find((e) => e.to === director.email)!
    for (const html of [note.html, confirmation.html]) {
      expect(html).toContain('Zoe &lt;b&gt;O&#39;Neil&lt;/b&gt;')
      expect(html).toContain('Event: Bayou &lt;Open&gt; &amp; &quot;Quads&quot; (Sat, Dec 5, 2026)')
      expect(html).not.toContain('<b>O')
      expect(html).not.toContain('<Open>')
    }
    for (const email of [note, confirmation]) {
      expect(`${email.subject}${email.text ?? ''}`).not.toMatch(OLD_INITIALS)
      expect(email.subject).not.toMatch(DASHES)
    }
  })
})

describe('empty data and outages', () => {
  it('opens ticket 1001 on an empty support list, and another member\'s request 1002', async () => {
    await env.DB.batch([env.DB.prepare('DELETE FROM support_messages'), env.DB.prepare('DELETE FROM support_tickets')])
    const [first, second] = [await person('Quentin Melancon'), await person('Rosalie Ardoin')]
    const one = await expectContract(await request(first.id), payout.response)
    const two = await expectContract(await request(second.id), payout.response)
    expect([(await ticket(one.ticket.id))?.number, (await ticket(two.ticket.id))?.number]).toEqual([1001, 1002])
    expect(await totals()).toEqual({ tickets: 2, messages: 2 })
    expect((await ticketsOf(first.id)).map((r) => [r.number, r.kind])).toEqual([[1001, 'payout_request']])
    expect(sorted(recipients())).toEqual(sorted([ADMINS, first.email, ADMINS, second.email]))
    expect(emailOutbox.filter((e) => e.to === ADMINS).map((e) => e.subject)).toEqual([
      'Payout account request from Quentin Melancon (from Quentin Melancon) [Ticket: 1001]',
      'Payout account request from Rosalie Ardoin (from Rosalie Ardoin) [Ticket: 1002]',
    ])
  })

  it('fails no request in an email outage: 201 with the ticket stored and nothing sent, and the next request answers 200 and sends nothing either', async () => {
    const member = await person('Sabine Ortego')
    emailBehavior.succeed = false
    const res = await request(member.id)
    expect(res.status).toBe(201)
    const body = await expectContract(res, payout.response)
    expect((await ticketsOf(member.id)).map((r) => [r.id, r.status])).toEqual([[body.ticket.id, 'open']])
    expect(await messagesOf(body.ticket.id)).toHaveLength(1)
    expect(emailOutbox).toEqual([])

    emailBehavior.succeed = true
    const again = await request(member.id)
    expect(again.status).toBe(200)
    expect(await expectContract(again, payout.response)).toEqual({ ticket: body.ticket, created: false })
    expect(emailOutbox).toEqual([])
  })

  it('still sends the admins\' note, once, when the member\'s own address fails', async () => {
    const member = await person('Thierry Castille')
    emailBehavior.succeed = false
    emailBehavior.failFor = [member.email]
    const res = await request(member.id)
    expect(res.status).toBe(201)
    await expectContract(res, payout.response)
    expect(recipients()).toEqual([ADMINS])
    expect(await ticketsOf(member.id)).toHaveLength(1)
  })
})

describe('bodies', () => {
  it('answers a body that is not an object, or none at all, with 400 and its fields, storing and sending nothing, and names no event for an empty tournamentId', async () => {
    const member = await person('Ursule Lejeune')
    const before = await totals()
    const missing = await invoke(payoutPost, { method: 'POST', as: member.id, path: '/api/me/payout-request' })
    expect(missing.status).toBe(400)
    expect(await expectContract(missing, fieldErrorBodySchema)).toEqual({ error: 'Invalid JSON body', fields: { body: 'The body is not valid JSON.' } })
    for (const rawBody of ['', 'null', '[]', '"tour-anything"', '7']) {
      const res = await invoke(payoutPost, { method: 'POST', as: member.id, rawBody, headers: { 'Content-Type': 'application/json' }, path: '/api/me/payout-request' })
      expect(res.status, rawBody).toBe(400)
      const refused = await expectContract(res, fieldErrorBodySchema)
      expect(Object.keys(refused.fields), rawBody).toEqual(['body'])
      expect(refused.error, rawBody).toBe(rawBody === '' ? 'Invalid JSON body' : 'Some fields are missing or not valid.')
    }
    expect(await totals()).toEqual(before)
    expect(emailOutbox).toEqual([])

    const blank = await request(member.id, { tournamentId: '' })
    expect(blank.status).toBe(201)
    const body = await expectContract(blank, payout.response)
    expect((await ticket(body.ticket.id))?.about_id).toBeNull()
    expect((await messagesOf(body.ticket.id)).map((m) => m.body)).toEqual([words('Ursule Lejeune')])
  })
})

describe('createTicket\'s guard', () => {
  const input = (member: { id: string; name: string; email: string }, body: string, kind = 'payout_request') => ({
    name: member.name, email: member.email, subject: `Payout account request from ${member.name}`, body, memberId: member.id,
    seatRef: null as string | null, siteUrl: SITE, kind, aboutId: null, oneOpenPerMember: true,
  })

  it('holds back all three emails with a board seat: the first call sends the admins\' note, the holder\'s and the confirmation, the second none', async () => {
    const n = ++people
    const seatId = `seat-edge-${n}`
    const slug = `edge-payout-seat-${n}`
    await env.DB.prepare(`INSERT INTO board_members (id, role, name, slug, category, is_active) VALUES (?, 'Edge Payout Seat', 'TBD', ?, 'officer', 1)`).bind(seatId, slug).run()
    const holder = await person('Valentin Seatholder')
    await env.DB.prepare(`INSERT INTO board_seat_assignments (id, seat_id, member_id, started_at) VALUES (?, ?, ?, datetime('now'))`).bind(`term-edge-${n}`, seatId, holder.id).run()
    const member = await person('Wilhelmine Requester')

    const first = await createTicket(env as unknown as Env, { ...input(member, 'First call.'), seatRef: slug })
    expect(first.created).toBe(true)
    expect(first.seat?.id).toBe(seatId)
    expect(first.holders.map((h) => h.member_id)).toEqual([holder.id])
    expect((await ticket(first.ticketId))?.seat_id).toBe(seatId)
    const left = { totals: await totals(), emails: sorted(recipients()) }
    expect(left.emails).toEqual(sorted([ADMINS, holder.email, member.email]))

    const second = await createTicket(env as unknown as Env, { ...input(member, 'Second call.'), seatRef: slug })
    expect(second).toEqual({ ticketId: second.ticketId, ticketNumber: null, seat: first.seat, holders: first.holders, created: false })
    expect({ totals: await totals(), emails: sorted(recipients()) }).toEqual(left)
    expect(await ticket(second.ticketId)).toBeNull()
  })

  it('holds back only the kind it is given: an open payout request holds back a second, not a listing report, which then holds back its own second', async () => {
    const member = await person('Xaviere Comeaux')
    const calls = [
      await createTicket(env as unknown as Env, input(member, 'Payout one.')),
      await createTicket(env as unknown as Env, input(member, 'Payout two.')),
      await createTicket(env as unknown as Env, input(member, 'Listing one.', 'listing_report')),
      await createTicket(env as unknown as Env, input(member, 'Listing two.', 'listing_report')),
      await createTicket(env as unknown as Env, input(member, 'Payout three.')),
    ]
    expect(calls.map((c) => c.created)).toEqual([true, false, true, false, false])
    expect(calls.map((c) => c.ticketNumber === null)).toEqual([false, true, false, true, true])
    expect((await ticketsOf(member.id)).map((r) => [r.id, r.kind])).toEqual([[calls[0].ticketId, 'payout_request'], [calls[2].ticketId, 'listing_report']])
    expect((await messagesOf(calls[0].ticketId)).map((m) => m.body)).toEqual(['Payout one.'])
    expect((await messagesOf(calls[2].ticketId)).map((m) => m.body)).toEqual(['Listing one.'])
    expect(sorted(recipients())).toEqual(sorted([ADMINS, member.email, ADMINS, member.email]))
  })
})
