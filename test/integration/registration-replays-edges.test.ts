// test/integration/registration-replays-edges.test.ts
// The player endpoints on their awkward paths: the same request sent twice,
// Stripe down, a full or closed event, a request that is refused half way
// through a family, and changes to an entry that is withdrawn, paired or
// owned by a child. Whatever is refused writes nothing.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { onRequestPost as registerPost } from '../../functions/api/registrations'
import { onRequestPost as batchPost } from '../../functions/api/registrations/batch'
import { onRequestPatch as registrationPatch } from '../../functions/api/registrations/[id]'
import { seedAdmin, seedMember, seedRegistration, seedTournament, seedTournamentDirector } from './factories'
import { emailOutbox, invoke, resetHarness, stripeBehavior, stripeSessions } from './harness'

beforeEach(resetHarness)

const count = async (sqlText: string, ...binds: unknown[]) =>
  (await env.DB.prepare(sqlText).bind(...binds).first<{ n: number }>())?.n ?? 0
const regCount = (tournamentId: string) => count('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?', tournamentId)
const payCount = (memberId: string) => count('SELECT COUNT(*) AS n FROM payments WHERE member_id = ?', memberId)
const errorOf = async (res: { json: <T>() => Promise<T> }) => (await res.json<{ error: string }>()).error

async function household(kids = 1) {
  const parent = await seedMember()
  const children: string[] = []
  for (let i = 0; i < kids; i++) {
    const kid = await seedMember({ uscfRating: 700 + i })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, kid).run()
    children.push(kid)
  }
  return { parent, children }
}

describe('POST /api/registrations, sent twice or sent into trouble', () => {
  it('a replay is 409, and leaves one entry, one payment and one checkout', async () => {
    const tournamentId = await seedTournament()
    const member = await seedMember()
    const body = { tournamentId, section: 'Open' }
    const first = await invoke(registerPost, { method: 'POST', as: member, body })
    expect(first.status).toBe(201)
    const second = await invoke(registerPost, { method: 'POST', as: member, body })
    expect(second.status).toBe(409)
    expect(await errorOf(second)).toBe('You are already registered for this tournament')
    expect(await regCount(tournamentId)).toBe(1)
    expect(await payCount(member)).toBe(1)
    expect(stripeSessions).toHaveLength(1)
  })

  it('a replay of a free entry is 409 and sends the confirmation once', async () => {
    const tournamentId = await seedTournament()
    const member = await seedMember()
    const body = { tournamentId, section: 'U1200' }
    expect((await invoke(registerPost, { method: 'POST', as: member, body })).status).toBe(201)
    const sent = emailOutbox.length
    expect((await invoke(registerPost, { method: 'POST', as: member, body })).status).toBe(409)
    expect(emailOutbox).toHaveLength(sent)
    expect(await payCount(member)).toBe(1)
  })

  it('a withdrawn player is told to ask the director, whatever section they send', async () => {
    const tournamentId = await seedTournament()
    const member = await seedMember()
    const reg = await seedRegistration({ tournamentId, memberId: member })
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(reg).run()
    const res = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId, section: 'U1200' } })
    expect(res.status).toBe(409)
    expect(await errorOf(res)).toMatch(/Ask the tournament director to reinstate you/)
    expect(await regCount(tournamentId)).toBe(1)
  })

  it('Stripe down is 502 and writes no entry and no payment, so the player can try again', async () => {
    const tournamentId = await seedTournament()
    const member = await seedMember()
    stripeBehavior.succeed = false
    const down = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId, section: 'Open' } })
    expect(down.status).toBe(502)
    expect(Object.keys(await down.json())).toEqual(['error'])
    expect(await regCount(tournamentId)).toBe(0)
    expect(await payCount(member)).toBe(0)

    stripeBehavior.succeed = true
    const again = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId, section: 'Open' } })
    expect(again.status).toBe(201)
    expect(await regCount(tournamentId)).toBe(1)
  })

  it('a free section needs no Stripe, so Stripe being down does not stop it', async () => {
    const tournamentId = await seedTournament()
    stripeBehavior.succeed = false
    const res = await invoke(registerPost, { method: 'POST', as: await seedMember(), body: { tournamentId, section: 'U1200' } })
    expect(res.status).toBe(201)
  })

  it('the waitlist takes no payment, no checkout and no confirmation, and a second request is 409', async () => {
    const tournamentId = await seedTournament({ maxPlayers: 1 })
    await seedRegistration({ tournamentId, memberId: await seedMember() })
    const late = await seedMember()
    const body = { tournamentId, section: 'Open', waitlist: true }
    const joined = await invoke(registerPost, { method: 'POST', as: late, body })
    expect(joined.status).toBe(201)
    expect(await payCount(late)).toBe(0)
    expect(stripeSessions).toHaveLength(0)
    const row = await env.DB.prepare('SELECT waitlisted_at, payment_status FROM registrations WHERE member_id = ?').bind(late)
      .first<{ waitlisted_at: string | null; payment_status: string }>()
    expect(row?.waitlisted_at).not.toBeNull()
    expect(row?.payment_status).toBe('pending')

    const replay = await invoke(registerPost, { method: 'POST', as: late, body })
    expect(replay.status).toBe(409)
    expect(await errorOf(replay)).toBe("You're already on the waitlist for this tournament")
    expect(await regCount(tournamentId)).toBe(2)
  })

  it('a full event with a spot just freed by a withdrawal takes the entry; waitlisted players hold no spot', async () => {
    const tournamentId = await seedTournament({ maxPlayers: 2 })
    const a = await seedRegistration({ tournamentId, memberId: await seedMember() })
    await seedRegistration({ tournamentId, memberId: await seedMember() })
    const waiting = await seedMember()
    await env.DB.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section, payment_status, waitlisted_at) VALUES ('w1', ?, ?, 'Open', 'pending', datetime('now'))`)
      .bind(tournamentId, waiting).run()
    const full = await invoke(registerPost, { method: 'POST', as: await seedMember(), body: { tournamentId, section: 'Open' } })
    expect(full.status).toBe(400)
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(a).run()
    const open = await invoke(registerPost, { method: 'POST', as: await seedMember(), body: { tournamentId, section: 'Open' } })
    expect(open.status).toBe(201)
  })

  it('the waitlist for a removed section is refused like any other entry', async () => {
    const tournamentId = await seedTournament({ maxPlayers: 1 })
    await seedRegistration({ tournamentId, memberId: await seedMember() })
    await env.DB.prepare(`UPDATE tournament_sections SET archived_at = datetime('now') WHERE tournament_id = ? AND name = 'Open'`).bind(tournamentId).run()
    const late = await seedMember()
    const res = await invoke(registerPost, { method: 'POST', as: late, body: { tournamentId, section: 'Open', waitlist: true } })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid section' })
    expect(await regCount(tournamentId)).toBe(1)
  })

  it('closed, auto-closed and unknown events are refused with { error } and write nothing', async () => {
    const closed = await seedTournament({ registrationStatus: 'closed' })
    const past = await seedTournament({ registrationClosesAt: '2020-01-01T00:00' })
    const member = await seedMember()
    const a = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId: closed, section: 'Open' } })
    expect([a.status, await errorOf(a)]).toEqual([400, 'Registration is not open for this tournament'])
    const b = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId: past, section: 'Open' } })
    expect([b.status, await errorOf(b)]).toEqual([400, 'Registration is closed for this tournament'])
    const c = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId: 'nope', section: 'Open' } })
    expect([c.status, await errorOf(c)]).toEqual([404, 'Tournament not found'])
    expect(await count('SELECT COUNT(*) AS n FROM registrations WHERE member_id = ?', member)).toBe(0)
  })

  it('byes: one fewer than the rounds, and only rounds of this event', async () => {
    const tournamentId = await seedTournament({ rounds: 3 })
    const member = await seedMember()
    const many = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId, section: 'Open', byeRounds: [1, 2, 3] } })
    expect([many.status, await errorOf(many)]).toEqual([400, 'You can request at most 2 byes (one less than total rounds)'])
    const outside = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId, section: 'Open', byeRounds: [4] } })
    expect([outside.status, await errorOf(outside)]).toEqual([400, 'Round 4 is not valid for this tournament'])
    const zero = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId, section: 'Open', byeRounds: [0] } })
    expect(zero.status).toBe(400)
    expect(await regCount(tournamentId)).toBe(0)
    expect(stripeSessions).toHaveLength(0)
    const fine = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId, section: 'Open', byeRounds: [1, 3] } })
    expect(fine.status).toBe(201)
    expect(await env.DB.prepare('SELECT bye_rounds FROM registrations WHERE member_id = ?').bind(member).first()).toEqual({ bye_rounds: '[1,3]' })
  })
})

describe('POST /api/registrations/batch, sent twice or refused half way', () => {
  it('a replay of a whole family is 409 and adds nothing', async () => {
    const tournamentId = await seedTournament()
    const { parent, children } = await household()
    const body = { tournamentId, entries: [{ section: 'Open' }, { memberId: children[0], section: 'U1200' }] }
    expect((await invoke(batchPost, { method: 'POST', as: parent, body })).status).toBe(201)
    const regs = await regCount(tournamentId)
    const sessions = stripeSessions.length
    const again = await invoke(batchPost, { method: 'POST', as: parent, body })
    expect(again.status).toBe(409)
    expect(await errorOf(again)).toMatch(/is already registered for this tournament$/)
    expect(await regCount(tournamentId)).toBe(regs)
    expect(stripeSessions).toHaveLength(sessions)
  })

  it('one player already in refuses the whole request: the others are not entered and no checkout starts', async () => {
    const tournamentId = await seedTournament()
    const { parent, children } = await household(2)
    await seedRegistration({ tournamentId, memberId: children[1], section: 'U1200' })
    const res = await invoke(batchPost, {
      method: 'POST', as: parent,
      body: { tournamentId, entries: [{ section: 'Open' }, { memberId: children[0], section: 'U1200' }, { memberId: children[1], section: 'U1200' }] },
    })
    expect(res.status).toBe(409)
    expect(await regCount(tournamentId)).toBe(1)
    expect(await payCount(parent)).toBe(0)
    expect(stripeSessions).toHaveLength(0)
  })

  it('a withdrawn child is not re-entered', async () => {
    const tournamentId = await seedTournament()
    const { parent, children } = await household()
    const reg = await seedRegistration({ tournamentId, memberId: children[0], section: 'U1200' })
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(reg).run()
    const res = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ memberId: children[0], section: 'U1200' }] } })
    expect(res.status).toBe(409)
    expect(await errorOf(res)).toMatch(/was withdrawn from this tournament\. Ask the tournament director to reinstate them\.$/)
  })

  it('the same player twice in one request is 400', async () => {
    const tournamentId = await seedTournament()
    const { parent, children } = await household()
    const res = await invoke(batchPost, {
      method: 'POST', as: parent,
      body: { tournamentId, entries: [{ memberId: children[0], section: 'U1200' }, { memberId: children[0], section: 'Open' }] },
    })
    expect(res.status).toBe(400)
    expect(await errorOf(res)).toBe('Each player can only be entered once')
    // Naming yourself with and without an id is the same player.
    const self = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ section: 'U1200' }, { memberId: parent, section: 'U1200' }] } })
    expect(self.status).toBe(400)
    expect(await regCount(tournamentId)).toBe(0)
  })

  it('a player who is not yours is 403, and an unknown tournament is 404', async () => {
    const tournamentId = await seedTournament()
    const parent = await seedMember()
    const stranger = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ memberId: 'ghost', section: 'U1200' }] } })
    expect(stranger.status).toBe(403)
    const none = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId: 'nope', entries: [{ section: 'U1200' }] } })
    expect([none.status, await errorOf(none)]).toEqual([404, 'Tournament not found'])
  })

  it('Stripe down is 502 and writes nothing for any player', async () => {
    const tournamentId = await seedTournament()
    const { parent, children } = await household()
    stripeBehavior.succeed = false
    const res = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ section: 'Open' }, { memberId: children[0], section: 'U1200' }] } })
    expect(res.status).toBe(502)
    expect(await regCount(tournamentId)).toBe(0)
    expect(await payCount(parent)).toBe(0)
    expect(await payCount(children[0])).toBe(0)
  })

  it('an all-free family needs no checkout: paid at once, completed payments, confirmations sent', async () => {
    const tournamentId = await seedTournament()
    const { parent, children } = await household(2)
    stripeBehavior.succeed = false
    const res = await invoke(batchPost, {
      method: 'POST', as: parent,
      body: { tournamentId, entries: [{ memberId: children[0], section: 'U1200' }, { memberId: children[1], section: 'U1200' }] },
    })
    expect(res.status).toBe(201)
    const body = await res.json<{ total: number; paymentUrl: string | null; registrations: Array<{ paymentStatus: string; amount: number }> }>()
    expect(body.total).toBe(0)
    expect(body.paymentUrl).toBeNull()
    expect(body.registrations.every((r) => r.paymentStatus === 'paid' && r.amount === 0)).toBe(true)
    expect(await count(`SELECT COUNT(*) AS n FROM payments WHERE status = 'completed' AND amount = 0 AND member_id IN (?, ?)`, children[0], children[1])).toBe(2)
    expect(await count(`SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ? AND payment_status = 'paid'`, tournamentId)).toBe(2)
  })

  it('a mixed family shares one checkout across the paid entries only', async () => {
    const tournamentId = await seedTournament()
    const { parent, children } = await household()
    const res = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ section: 'Open' }, { memberId: children[0], section: 'U1200' }] } })
    expect(res.status).toBe(201)
    expect(stripeSessions).toHaveLength(1)
    expect(stripeSessions[0].lineItems).toHaveLength(1)
    const sessionIds = (await env.DB.prepare('SELECT stripe_session_id AS s, status FROM payments WHERE member_id IN (?, ?) ORDER BY member_id').bind(parent, children[0]).all<{ s: string | null; status: string }>()).results
    expect(sessionIds.filter((r) => r.s === stripeSessions[0].id)).toHaveLength(1)
    expect(sessionIds.find((r) => r.s === null)?.status).toBe('completed')
  })

  it('counts the spots left: too few is 400 and nobody is entered; waitlisted and withdrawn players hold none', async () => {
    const tournamentId = await seedTournament({ maxPlayers: 2, sections: [{ name: 'Open', entryFee: 0 }] })
    const { parent, children } = await household(2)
    await seedRegistration({ tournamentId, memberId: await seedMember() })
    const tooMany = await invoke(batchPost, {
      method: 'POST', as: parent,
      body: { tournamentId, entries: [{ section: 'Open' }, { memberId: children[0], section: 'Open' }] },
    })
    expect(tooMany.status).toBe(400)
    expect(await errorOf(tooMany)).toBe('Only 1 spot left — fewer than the 2 players you selected')
    expect(await regCount(tournamentId)).toBe(1)

    const gone = await seedMember()
    const goneReg = await seedRegistration({ tournamentId, memberId: gone })
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(goneReg).run()
    await env.DB.prepare(`INSERT INTO registrations (id, tournament_id, member_id, section, payment_status, waitlisted_at) VALUES ('w2', ?, ?, 'Open', 'pending', datetime('now'))`)
      .bind(tournamentId, await seedMember()).run()
    const one = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ memberId: children[0], section: 'Open' }] } })
    expect(one.status).toBe(201)
    const full = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ memberId: children[1], section: 'Open' }] } })
    expect(full.status).toBe(400)
    expect(await errorOf(full)).toBe('This tournament is full')
  })

  it('a closed event refuses the family', async () => {
    const tournamentId = await seedTournament({ registrationStatus: 'closed' })
    const res = await invoke(batchPost, { method: 'POST', as: await seedMember(), body: { tournamentId, entries: [{ section: 'Open' }] } })
    expect([res.status, await errorOf(res)]).toEqual([400, 'Registration is not open for this tournament'])
  })

  it('a bye round that is not a whole round of the event is 400 and names the player', async () => {
    const tournamentId = await seedTournament({ rounds: 4 })
    const parent = await seedMember({ fullName: 'Pat Parent' })
    const res = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ section: 'Open', byeRounds: [1.5] }] } })
    expect(res.status).toBe(400)
    expect(await errorOf(res)).toBe('Pat Parent: a requested bye round is not part of this tournament')
    const over = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ section: 'Open', byeRounds: [1, 2, 3, 4] }] } })
    expect(await errorOf(over)).toBe('Pat Parent: at most 3 byes')
    expect(await regCount(tournamentId)).toBe(0)
  })
})

describe('PATCH /api/registrations/[id] on awkward entries', () => {
  async function paired(tournamentId: string, memberId: string, section = 'Open') {
    await env.DB.prepare(
      `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result) VALUES (?, ?, 1, 1, ?, ?, NULL, 'pending')`,
    ).bind(`g-${memberId}`, tournamentId, section, memberId).run()
  }

  it('an unknown entry is 404, and so is one for a body that would not parse', async () => {
    const player = await seedMember()
    const res = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: 'nope' }, body: { section: 'Open' } })
    expect([res.status, await errorOf(res)]).toEqual([404, 'Registration not found'])
    const broken = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: 'nope' }, rawBody: '{' })
    expect(broken.status).toBe(404)
  })

  it('a body with none of the editable keys is 400 with { error }', async () => {
    const tournamentId = await seedTournament()
    const player = await seedMember()
    const reg = await seedRegistration({ tournamentId, memberId: player })
    for (const body of [{}, { note: 'hello' }]) {
      const res = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, body })
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'No editable fields provided' })
    }
    const notAnObject = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, rawBody: '[]' })
    expect(notAnObject.status).toBe(400)
    const nothing = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, rawBody: 'null' })
    expect(nothing.status).toBe(400)
  })

  it('byes that are not whole rounds are 400 with { error } and change nothing', async () => {
    const tournamentId = await seedTournament({ rounds: 4 })
    const player = await seedMember()
    const reg = await seedRegistration({ tournamentId, memberId: player, byeRounds: [2] })
    const half = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, body: { byeRounds: [1.5] } })
    expect([half.status, await errorOf(half)]).toEqual([400, 'byeRounds must be an array of whole numbers'])
    const outside = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, body: { byeRounds: [5] } })
    expect([outside.status, await errorOf(outside)]).toEqual([400, 'Round 5 is not valid for this tournament'])
    expect(await env.DB.prepare('SELECT bye_rounds FROM registrations WHERE id = ?').bind(reg).first()).toEqual({ bye_rounds: '[2]' })
  })

  it('byes are saved sorted and without repeats, and an empty list clears them', async () => {
    const tournamentId = await seedTournament({ rounds: 5 })
    const player = await seedMember()
    const reg = await seedRegistration({ tournamentId, memberId: player })
    const set = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, body: { byeRounds: [3, 1, 3] } })
    expect((await set.json<{ registration: { bye_rounds: number[] } }>()).registration.bye_rounds).toEqual([1, 3])
    const clear = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, body: { byeRounds: [] } })
    expect((await clear.json<{ registration: { bye_rounds: number[] } }>()).registration.bye_rounds).toEqual([])
    expect(await env.DB.prepare('SELECT bye_rounds FROM registrations WHERE id = ?').bind(reg).first()).toEqual({ bye_rounds: null })
  })

  it('a withdrawn entry cannot change section until it is reinstated', async () => {
    const tournamentId = await seedTournament()
    const admin = await seedAdmin()
    const reg = await seedRegistration({ tournamentId, memberId: await seedMember() })
    expect((await invoke(registrationPatch, { method: 'PATCH', as: admin, params: { id: reg }, body: { withdrawn: true } })).status).toBe(200)
    const move = await invoke(registrationPatch, { method: 'PATCH', as: admin, params: { id: reg }, body: { section: 'U1200' } })
    expect([move.status, await errorOf(move)]).toEqual([400, 'Reinstate this player before changing their section'])
    expect((await invoke(registrationPatch, { method: 'PATCH', as: admin, params: { id: reg }, body: { withdrawn: false } })).status).toBe(200)
    expect((await invoke(registrationPatch, { method: 'PATCH', as: admin, params: { id: reg }, body: { section: 'U1200' } })).status).toBe(200)
  })

  it('a paired player cannot change section, and nothing moves', async () => {
    const tournamentId = await seedTournament()
    const player = await seedMember()
    const reg = await seedRegistration({ tournamentId, memberId: player })
    await paired(tournamentId, player)
    const res = await invoke(registrationPatch, { method: 'PATCH', as: await seedAdmin(), params: { id: reg }, body: { section: 'U1200' } })
    expect([res.status, await errorOf(res)]).toEqual([400, 'This player has already been paired and cannot change sections'])
    const row = await env.DB.prepare('SELECT section, section_id FROM registrations WHERE id = ?').bind(reg).first<{ section: string; section_id: string }>()
    expect(row?.section).toBe('Open')
    const open = await env.DB.prepare(`SELECT id FROM tournament_sections WHERE tournament_id = ? AND name = 'Open' AND archived_at IS NULL`).bind(tournamentId).first<{ id: string }>()
    expect(row?.section_id).toBe(open?.id)
  })

  it('a section move with byes together checks the byes against the new section', async () => {
    const tournamentId = await seedTournament({ rounds: 4 })
    const player = await seedMember()
    const reg = await seedRegistration({ tournamentId, memberId: player })
    // Round 1 of U1200 is already paired by someone else, so a bye in round 1 there is locked.
    await env.DB.prepare(
      `INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result) VALUES ('g-other', ?, 1, 1, 'U1200', ?, NULL, 'pending')`,
    ).bind(tournamentId, await seedMember()).run()
    const res = await invoke(registrationPatch, { method: 'PATCH', as: await seedAdmin(), params: { id: reg }, body: { section: 'U1200', byeRounds: [1] } })
    expect(res.status).toBe(400)
    expect(await errorOf(res)).toMatch(/^Round 1 has already been paired/)
    expect((await env.DB.prepare('SELECT section FROM registrations WHERE id = ?').bind(reg).first<{ section: string }>())?.section).toBe('Open')
  })

  it("a parent can move a child's entry; a stranger and a director of another event cannot", async () => {
    const tournamentId = await seedTournament()
    const { parent, children } = await household()
    const reg = await seedRegistration({ tournamentId, memberId: children[0], section: 'Open' })
    const other = await seedTournament()
    const otherTd = await seedMember()
    await seedTournamentDirector(other, otherTd)

    const stranger = await invoke(registrationPatch, { method: 'PATCH', as: await seedMember(), params: { id: reg }, body: { section: 'U1200' } })
    expect(stranger.status).toBe(403)
    const wrongTd = await invoke(registrationPatch, { method: 'PATCH', as: otherTd, params: { id: reg }, body: { section: 'U1200' } })
    expect(wrongTd.status).toBe(403)
    expect((await env.DB.prepare('SELECT section FROM registrations WHERE id = ?').bind(reg).first<{ section: string }>())?.section).toBe('Open')

    const ok = await invoke(registrationPatch, { method: 'PATCH', as: parent, params: { id: reg }, body: { section: 'U1200' } })
    expect(ok.status).toBe(200)
    expect((await env.DB.prepare('SELECT section FROM registrations WHERE id = ?').bind(reg).first<{ section: string }>())?.section).toBe('U1200')
  })

  it("a director of this event can record cash; a director of another event cannot; nobody gets the row back on a refusal", async () => {
    const tournamentId = await seedTournament()
    const td = await seedMember()
    await seedTournamentDirector(tournamentId, td)
    const other = await seedTournament()
    const otherTd = await seedMember()
    await seedTournamentDirector(other, otherTd)
    const reg = await seedRegistration({ tournamentId, memberId: await seedMember(), paymentStatus: 'pending' })

    const wrong = await invoke(registrationPatch, { method: 'PATCH', as: otherTd, params: { id: reg }, body: { paymentStatus: 'paid' } })
    expect(wrong.status).toBe(403)
    expect(Object.keys(await wrong.json())).toEqual(['error'])
    const ok = await invoke(registrationPatch, { method: 'PATCH', as: td, params: { id: reg }, body: { paymentStatus: 'paid' } })
    expect(ok.status).toBe(200)
    expect((await env.DB.prepare('SELECT payment_status FROM registrations WHERE id = ?').bind(reg).first<{ payment_status: string }>())?.payment_status).toBe('paid')
  })

  it('a payment status outside the three is 400 with fields for a director', async () => {
    const tournamentId = await seedTournament()
    const reg = await seedRegistration({ tournamentId, memberId: await seedMember(), paymentStatus: 'pending' })
    const res = await invoke(registrationPatch, { method: 'PATCH', as: await seedAdmin(), params: { id: reg }, body: { paymentStatus: 'comped' } })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.any(String), fields: { paymentStatus: expect.any(String) } })
    expect((await env.DB.prepare('SELECT payment_status FROM registrations WHERE id = ?').bind(reg).first<{ payment_status: string }>())?.payment_status).toBe('pending')
  })

  it('a player can withdraw themselves before pairings but cannot undo it', async () => {
    const tournamentId = await seedTournament()
    const player = await seedMember()
    const reg = await seedRegistration({ tournamentId, memberId: player })
    const out = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, body: { withdrawn: true } })
    expect(out.status).toBe(200)
    const again = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, body: { withdrawn: true } })
    expect([again.status, await errorOf(again)]).toEqual([400, 'This player is already withdrawn'])
    const back = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, body: { withdrawn: false } })
    expect([back.status, await errorOf(back)]).toEqual([403, 'Ask the tournament director to reinstate you'])
  })
})
