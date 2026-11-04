// test/integration/ticket-kinds-answers.test.ts
//
// The ticket kinds, support_tickets.kind and support_tickets.about_id (WS08
// step 2), through the real handlers on the database every integration test
// runs on, and the President seat's factory at its edges:
// - no request writes either column: the contact form and the support form,
//   signed out and signed in, a member's reply, Admin's reply and a change
//   of status leave a new ticket's two NULL and a stored kind as it was,
//   whatever the body says, so only the writers WS04 and WS08 step 7 add
//   will set them;
// - the four answers that read every column of a ticket carry both, as
//   stored: the owner's list and ticket (which still leave out the ticket's
//   number) and Admin's support list and ticket, for an LCA admin, an
//   observer and an officer;
// - no one else is answered either: signed out 401, another member no row
//   in their list and 404 on the ticket, and a plain member, a club rep, a
//   standing director and an auditor 403 from Admin's two, none with a trace
//   of the kind or of what the ticket is about;
// - the President seat the migrations made has no holder until
//   seedPresident gives it one; the factory adds a term and ends none, so a
//   second current term for the same member is refused, as 0027's index
//   refuses it, while a term that has ended leaves room for a new one; and
//   seedTournament's createdBy must name a member.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { onRequestPost as contactPost } from '../../functions/api/contact'
import { onRequestGet as supportListGet, onRequestPost as supportPost } from '../../functions/api/support'
import { onRequestGet as supportTicketGet, onRequestPost as supportReply } from '../../functions/api/support/[id]'
import { onRequestGet as adminSupportGet } from '../../functions/api/admin/support'
import {
  onRequestGet as adminTicketGet,
  onRequestPatch as adminTicketPatch,
  onRequestPost as adminTicketReply,
} from '../../functions/api/admin/support/[id]'
import { holdsPresidentSeat } from '../../functions/utils/events/creation'
import { seedAdmin, seedClub, seedDirector, seedMember, seedPresident, seedTournament } from './factories'
import { invoke, resetHarness } from './harness'

beforeEach(resetHarness)

interface TicketRow {
  id: string
  kind: string | null
  about_id: string | null
  number?: number | null
  [column: string]: unknown
}

const kindsOf = async (ticketId: string) =>
  (await env.DB.prepare('SELECT kind, about_id FROM support_tickets WHERE id = ?').bind(ticketId).first<{ kind: string | null; about_id: string | null }>())!

/** What a visitor or a member types into either form, with the two columns added, in both spellings. */
const formBody = (subject: string) => ({
  name: 'Lee Visitor', email: 'lee.visitor@example.org', subject, body: 'Where is the playing hall?',
  kind: 'payout_request', about_id: 'tour-claimed', aboutId: 'tour-claimed',
})

describe('the President seat on the test database, and the factories WS08 steps 3 to 7 read', () => {
  /** The members holding the seat whose slug is president now. */
  const holders = async () =>
    (await env.DB.prepare(
      `SELECT a.member_id FROM board_seat_assignments a JOIN board_members s ON s.id = a.seat_id
        WHERE s.slug = 'president' AND a.ended_at IS NULL ORDER BY a.started_at, a.rowid`,
    ).all<{ member_id: string }>()).results.map((r) => r.member_id)

  it('the seat the migrations made has no holder until seedPresident gives it one', async () => {
    const seat = await env.DB.prepare(`SELECT role, category, is_active FROM board_members WHERE slug = 'president'`).first()
    expect(seat).toEqual({ role: 'President', category: 'officer', is_active: 1 })
    expect(await holders()).toEqual([])
    const president = await seedMember({ role: 'lca_observer' })
    await seedPresident(president)
    expect(await holders()).toEqual([president])
    const term = await env.DB.prepare(
      `SELECT a.started_at, a.ended_at FROM board_seat_assignments a JOIN board_members s ON s.id = a.seat_id WHERE s.slug = 'president' AND a.member_id = ?`,
    ).bind(president).first<{ started_at: string; ended_at: string | null }>()
    expect(term?.ended_at).toBeNull()
    // The term starts at once, in the form datetime('now') writes.
    expect(Math.abs(Date.parse(`${term!.started_at.replace(' ', 'T')}Z`) - Date.now())).toBeLessThan(60_000)
  })

  it('adds a term and ends none: a second current term for the same member is refused, as 0027\'s index refuses it, and a second member holds the seat beside the first', async () => {
    const first = await seedMember({ role: 'lca_observer' })
    const second = await seedMember({ role: 'lca_observer' })
    await seedPresident(first)
    await expect(seedPresident(first)).rejects.toThrow(/UNIQUE constraint failed/)
    await seedPresident(second)
    expect(await holders()).toEqual(expect.arrayContaining([first, second]))
    expect([await holdsPresidentSeat(env.DB, first), await holdsPresidentSeat(env.DB, second)]).toEqual([true, true])
  })

  it('a term that has ended no longer counts, and leaves room for a new one', async () => {
    const member = await seedMember({ role: 'lca_observer' })
    await seedPresident(member)
    await env.DB.prepare(`UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE member_id = ? AND ended_at IS NULL`).bind(member).run()
    expect(await holdsPresidentSeat(env.DB, member)).toBe(false)
    await seedPresident(member)
    expect(await holdsPresidentSeat(env.DB, member)).toBe(true)
    const terms = await env.DB.prepare('SELECT COUNT(*) AS n FROM board_seat_assignments WHERE member_id = ?').bind(member).first<{ n: number }>()
    expect(terms?.n).toBe(2)
  })

  it('seedTournament\'s createdBy must name a member: one that does not exist is refused by the foreign key, and no event is left', async () => {
    await expect(seedTournament({ name: 'Nobody\'s Open', createdBy: 'mem-that-does-not-exist' })).rejects.toThrow(/FOREIGN KEY constraint failed/)
    const left = await env.DB.prepare(`SELECT COUNT(*) AS n FROM tournaments WHERE name = 'Nobody''s Open'`).first<{ n: number }>()
    expect(left?.n).toBe(0)
  })
})

describe('no request writes a ticket\'s kind or what it is about', () => {
  it('the contact form and the support form, signed out and signed in, open an ordinary ticket whatever the body says', async () => {
    const member = await seedMember()
    const opened: Array<[string, Awaited<ReturnType<typeof invoke>>]> = [
      ['support, signed out', await invoke(supportPost, { method: 'POST', body: formBody('Support, signed out') })],
      ['support, signed in', await invoke(supportPost, { method: 'POST', as: member, body: formBody('Support, signed in') })],
      ['contact, signed out', await invoke(contactPost, { method: 'POST', body: formBody('Contact, signed out') })],
      ['contact, signed in', await invoke(contactPost, { method: 'POST', as: member, body: formBody('Contact, signed in') })],
    ]
    for (const [label, result] of opened) {
      expect(result.status, label).toBe(201)
      const { ticketId } = await result.json<{ ticketId: string }>()
      expect(await kindsOf(ticketId), label).toEqual({ kind: null, about_id: null })
    }
  })

  it('a member\'s reply, Admin\'s reply and a change of status keep a stored kind and what it is about, whatever the body says', async () => {
    const member = await seedMember()
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ name: 'Lafayette Winter Quads' })
    const opened = await invoke(supportPost, { method: 'POST', as: member, body: formBody('A payout account for the Winter Quads') })
    const { ticketId } = await opened.json<{ ticketId: string }>()
    // As WS08 step 7 will write it: a request for a payout account, about the event.
    await env.DB.prepare(`UPDATE support_tickets SET kind = 'payout_request', about_id = ? WHERE id = ?`).bind(tournamentId, ticketId).run()
    const stored = { kind: 'payout_request', about_id: tournamentId }

    const steps: Array<[string, () => ReturnType<typeof invoke>, number]> = [
      ['the member replies', () => invoke(supportReply, { method: 'POST', as: member, params: { id: ticketId }, body: { body: 'Any news?', kind: null, about_id: null } }), 201],
      ['Admin replies', () => invoke(adminTicketReply, { method: 'POST', as: admin, params: { id: ticketId }, body: { body: 'We are on it.', kind: 'listing_report', aboutId: 'ch-1' } }), 201],
      ['Admin resolves it', () => invoke(adminTicketPatch, { method: 'PATCH', as: admin, params: { id: ticketId }, body: { status: 'resolved', kind: null, about_id: null } }), 200],
    ]
    for (const [label, step, status] of steps) {
      expect((await step()).status, label).toBe(status)
      expect(await kindsOf(ticketId), label).toEqual(stored)
    }
    const { status } = (await env.DB.prepare('SELECT status FROM support_tickets WHERE id = ?').bind(ticketId).first<{ status: string }>())!
    expect(status).toBe('resolved')
  })
})

describe('the four answers that read every column of a ticket', () => {
  /** A member's ticket that asks for a payout account for an event, kind and about_id stored as WS08 step 7 will store them. */
  async function seedKindedTicket() {
    const owner = await seedMember({ fullName: 'Gerald Landry' })
    const tournamentId = await seedTournament({ name: 'Lafayette Winter Quads' })
    const opened = await invoke(supportPost, { method: 'POST', as: owner, body: formBody('A payout account for the Winter Quads') })
    const { ticketId } = await opened.json<{ ticketId: string }>()
    await env.DB.prepare(`UPDATE support_tickets SET kind = 'payout_request', about_id = ? WHERE id = ?`).bind(tournamentId, ticketId).run()
    const { number } = (await env.DB.prepare('SELECT number FROM support_tickets WHERE id = ?').bind(ticketId).first<{ number: number }>())!
    return { owner, tournamentId, ticketId, number }
  }

  it('the owner\'s list and ticket carry the kind and what the ticket is about, as stored, and still leave out its number', async () => {
    const { owner, tournamentId, ticketId } = await seedKindedTicket()
    const list = await invoke(supportListGet, { as: owner, path: '/api/support' })
    expect(list.status).toBe(200)
    const row = (await list.json<{ tickets: TicketRow[] }>()).tickets.find((t) => t.id === ticketId)
    expect(row).toMatchObject({ kind: 'payout_request', about_id: tournamentId })
    expect(Object.hasOwn(row!, 'number')).toBe(false)

    const one = await invoke(supportTicketGet, { as: owner, params: { id: ticketId } })
    expect(one.status).toBe(200)
    const { ticket } = await one.json<{ ticket: TicketRow }>()
    expect(ticket).toMatchObject({ id: ticketId, kind: 'payout_request', about_id: tournamentId })
    expect(Object.hasOwn(ticket, 'number')).toBe(false)
  })

  it('Admin\'s support list and ticket carry them, as stored, for an LCA admin, an observer and an officer', async () => {
    const { tournamentId, ticketId, number } = await seedKindedTicket()
    for (const as of [await seedAdmin(), await seedMember({ role: 'lca_observer' }), await seedMember({ role: 'lca_officer' })]) {
      const list = await invoke(adminSupportGet, { as, path: '/api/admin/support' })
      expect(list.status, as).toBe(200)
      expect((await list.json<{ tickets: TicketRow[] }>()).tickets.find((t) => t.id === ticketId), as)
        .toMatchObject({ kind: 'payout_request', about_id: tournamentId, number })
      const one = await invoke(adminTicketGet, { as, params: { id: ticketId } })
      expect(one.status, as).toBe(200)
      expect((await one.json<{ ticket: TicketRow }>()).ticket, as).toMatchObject({ kind: 'payout_request', about_id: tournamentId, number })
    }
  })

  it('role safety: no one else is answered the ticket, its kind or what it is about', async () => {
    const { tournamentId, ticketId } = await seedKindedTicket()
    const clubId = await seedClub()
    const traceless = async (label: string, result: Awaited<ReturnType<typeof invoke>>) => {
      const text = await result.response.text()
      expect(text, label).not.toContain('payout_request')
      expect(text, label).not.toContain(tournamentId)
      expect(text, label).not.toContain(ticketId)
    }

    for (const [label, result] of [
      ['the owner\'s list, signed out', await invoke(supportListGet, { path: '/api/support' })],
      ['the owner\'s ticket, signed out', await invoke(supportTicketGet, { params: { id: ticketId } })],
      ['Admin\'s list, signed out', await invoke(adminSupportGet, { path: '/api/admin/support' })],
      ['Admin\'s ticket, signed out', await invoke(adminTicketGet, { params: { id: ticketId } })],
    ] as const) {
      expect(result.status, label).toBe(401)
      await traceless(label, result)
    }

    const stranger = await seedMember()
    const theirList = await invoke(supportListGet, { as: stranger, path: '/api/support' })
    expect(theirList.status).toBe(200)
    expect((await theirList.json<{ tickets: TicketRow[] }>()).tickets).toEqual([])
    await traceless('another member\'s list', theirList)
    const theirTicket = await invoke(supportTicketGet, { as: stranger, params: { id: ticketId } })
    expect(theirTicket.status).toBe(404)
    await traceless('another member opening the ticket', theirTicket)

    for (const [label, as] of [
      ['a plain member', await seedMember()],
      ['a club rep', await seedMember({ role: 'club_rep', clubId })],
      ['a standing director', await seedDirector()],
      ['an auditor', await seedMember({ role: 'lca_auditor' })],
    ] as const) {
      for (const result of [await invoke(adminSupportGet, { as, path: '/api/admin/support' }), await invoke(adminTicketGet, { as, params: { id: ticketId } })]) {
        expect(result.status, label).toBe(403)
        await traceless(label, result)
      }
    }
  })
})
