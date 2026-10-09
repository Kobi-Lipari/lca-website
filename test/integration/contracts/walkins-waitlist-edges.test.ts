// test/integration/contracts/walkins-waitlist-edges.test.ts
// The edges of the director's walk-in and waitlist-offer endpoints that
// walkins-waitlist.test.ts leaves out: the fee a walk-in is charged, the full-event and duplicate guards, an offer
// replayed, an entry from another event, a section renamed or archived since
// the player joined the waitlist, and the early deadline and late date read
// as Central wall-clock time across midnight and both daylight-saving days.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema } from '../../../domain/contracts'
import { onRequestPost as walkInPost } from '../../../functions/api/admin/tournaments/[id]/walk-ins'
import { onRequestPost as waitlistPost } from '../../../functions/api/admin/tournaments/[id]/waitlist'
import { seedAdmin, seedClub, seedDirector, seedMember, seedRegistration, seedTournament, seedTournamentDirector } from '../factories'
import { emailOutbox, expectContract, invoke, resetHarness } from '../harness'

beforeEach(resetHarness)
afterEach(() => { vi.useRealTimers() })

const walkIn = contracts['admin/tournaments/[id]/walk-ins'].POST
const offer = contracts['admin/tournaments/[id]/waitlist'].POST

const countOf = async (sqlText: string, ...binds: unknown[]) =>
  (await env.DB.prepare(sqlText).bind(...binds).first<{ n: number }>())?.n ?? 0

const setColumns = async (tournamentId: string, columns: Record<string, unknown>) => {
  const sets = Object.keys(columns).map((k) => `${k} = ?`).join(', ')
  await env.DB.prepare(`UPDATE tournaments SET ${sets} WHERE id = ?`).bind(...Object.values(columns), tournamentId).run()
}

const sectionRow = (tournamentId: string, name: string) =>
  env.DB.prepare('SELECT * FROM tournament_sections WHERE tournament_id = ? AND name = ? AND archived_at IS NULL')
    .bind(tournamentId, name).first<{ id: string; position: number }>()

async function addWalkIn(admin: string, tournamentId: string, body: Record<string, unknown>) {
  return invoke(walkInPost, { method: 'POST', as: admin, params: { id: tournamentId }, body })
}

/** Every sentence a response carries, without the field names (uscfId is a field name, not copy). */
async function messagesOf(res: { json: <T>() => Promise<T> }) {
  const body = await res.json<{ error?: string; fields?: Record<string, string> }>()
  return [body.error ?? '', ...Object.values(body.fields ?? {})].join(' ')
}

async function waitlisted(tournamentId: string, section: string, opts: { membershipStatus?: string; sectionId?: string | null } = {}) {
  const memberId = await seedMember({ membershipStatus: opts.membershipStatus ?? 'pending' })
  const reg = await seedRegistration({ tournamentId, memberId, section, paymentStatus: 'pending' })
  await env.DB.prepare(`UPDATE registrations SET waitlisted_at = datetime('now') WHERE id = ?`).bind(reg).run()
  if (opts.sectionId !== undefined) await env.DB.prepare('UPDATE registrations SET section_id = ? WHERE id = ?').bind(opts.sectionId, reg).run()
  return { memberId, reg }
}

async function offerSpot(admin: string, tournamentId: string, registrationId: string) {
  return invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { registrationId } })
}

describe('walk-ins read the sections table', () => {
  it('the fee is the row’s own fee, not the JSON’s, and a free section stays free under a paid event', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 30, sections: [{ name: 'Open', entryFee: 20 }, { name: 'Youth', entryFee: 0 }] })
    await env.DB.prepare(`UPDATE tournament_sections SET fee_regular = 18 WHERE tournament_id = ? AND name = 'Open'`).bind(tournamentId).run()
    const paid = await expectContract(await addWalkIn(admin, tournamentId, { fullName: 'Door One', section: 'Open' }), walkIn.response)
    const free = await expectContract(await addWalkIn(admin, tournamentId, { fullName: 'Door Two', section: 'Youth' }), walkIn.response)
    const amountOf = async (reg: string) => (await env.DB.prepare('SELECT amount, status FROM payments WHERE reference_id = ?').bind(reg).first())
    expect(await amountOf(paid.registration.id)).toEqual({ amount: 18, status: 'completed' })
    expect(await amountOf(free.registration.id)).toEqual({ amount: 0, status: 'completed' })
  })

  it('early, late and member pricing do not apply at the door', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 40, sections: [{ name: 'Open', entryFee: 40 }] })
    await setColumns(tournamentId, { early_deadline: '2099-01-01T00:00', early_discount: 10, member_discount: 5, late_after: '2020-01-01T00:00', late_fee: 7 })
    const res = await addWalkIn(admin, tournamentId, { fullName: 'Door Player', section: 'Open' })
    const body = await expectContract(res, walkIn.response)
    expect(await env.DB.prepare('SELECT amount FROM payments WHERE reference_id = ?').bind(body.registration.id).first()).toEqual({ amount: 40 })
  })

  it('a section whose live row shares its name with an archived row takes the live row’s id and fee', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Reserve', entryFee: 15 }] })
    await env.DB.prepare(`INSERT INTO tournament_sections (id, tournament_id, position, name, fee_regular, archived_at)
      VALUES ('old-reserve-edge', ?, 9, 'Reserve', 99, datetime('now'))`).bind(tournamentId).run()
    const body = await expectContract(await addWalkIn(admin, tournamentId, { fullName: 'Door Player', section: 'Reserve' }), walkIn.response)
    expect(body.registration.section_id).toBe((await sectionRow(tournamentId, 'Reserve'))?.id)
    expect(body.registration.section_id).not.toBe('old-reserve-edge')
    expect(await env.DB.prepare('SELECT amount FROM payments WHERE reference_id = ?').bind(body.registration.id).first()).toEqual({ amount: 15 })
  })

  it('a section a director removed after the manage page loaded is refused, with the entry count unchanged', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const typed = 'U1200'
    await env.DB.prepare(`UPDATE tournament_sections SET archived_at = datetime('now') WHERE tournament_id = ? AND name = ?`).bind(tournamentId, typed).run()
    const res = await addWalkIn(admin, tournamentId, { fullName: 'Door Player', section: typed })
    expect(res.status).toBe(400)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Invalid section' })
    expect(await countOf('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?', tournamentId)).toBe(0)
  })
})

describe('walk-in guest, guards and body edges', () => {
  it('makes a guest who can never be emailed, trims the name and ID, and keeps the rating', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const res = await addWalkIn(admin, tournamentId, { fullName: '  Door Player  ', uscfId: ' 12345678 ', uscfRating: 1432, section: 'Open', markPaid: false })
    expect(res.status).toBe(201)
    const body = await expectContract(res, walkIn.response)
    expect(await env.DB.prepare('SELECT full_name, uscf_id, uscf_rating, role, membership_status, email FROM members WHERE id = ?').bind(body.guestId).first())
      .toEqual({ full_name: 'Door Player', uscf_id: '12345678', uscf_rating: 1432, role: 'guest', membership_status: 'pending', email: `${body.guestId}@walkin.lca.invalid` })
    expect(body.registration).toMatchObject({ rating_at_entry: 1432, payment_status: 'pending' })
    expect(await env.DB.prepare('SELECT status FROM payments WHERE reference_id = ?').bind(body.registration.id).first()).toEqual({ status: 'pending' })
    expect(emailOutbox).toHaveLength(0)
  })

  it('markPaid left out means paid at the door', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const body = await expectContract(await addWalkIn(admin, tournamentId, { fullName: 'Door Player', section: 'Open' }), walkIn.response)
    expect(body.registration.payment_status).toBe('paid')
    expect(await env.DB.prepare('SELECT status FROM payments WHERE reference_id = ?').bind(body.registration.id).first()).toEqual({ status: 'completed' })
  })

  it('a blank US Chess ID is treated as none: fine for an unrated event, refused for a rated one', async () => {
    const admin = await seedAdmin()
    const unrated = await seedTournament()
    const ok = await addWalkIn(admin, unrated, { fullName: 'Door Player', uscfId: '   ', section: 'Open' })
    expect(ok.status).toBe(201)
    const guest = (await expectContract(ok, walkIn.response)).guestId
    expect(await env.DB.prepare('SELECT uscf_id FROM members WHERE id = ?').bind(guest).first()).toEqual({ uscf_id: null })
    const rated = await seedTournament({ isRated: true })
    const refused = await addWalkIn(admin, rated, { fullName: 'Door Player', uscfId: '   ', section: 'Open' })
    expect(refused.status).toBe(400)
    expect(await expectContract(refused, errorBodySchema)).toEqual({ error: 'A US Chess ID is required for walk-ins to rated tournaments.' })
  })

  it('one place under the cap is taken, then the event is full; a withdrawn entry does not count', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ maxPlayers: 2 })
    const gone = await seedRegistration({ tournamentId, memberId: await seedMember() })
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(gone).run()
    await seedRegistration({ tournamentId, memberId: await seedMember() })
    const last = await addWalkIn(admin, tournamentId, { fullName: 'Last Seat', section: 'Open' })
    expect(last.status).toBe(201)
    const over = await addWalkIn(admin, tournamentId, { fullName: 'One Too Many', section: 'Open' })
    expect(over.status).toBe(400)
    expect(await expectContract(over, errorBodySchema)).toEqual({ error: 'This tournament is full' })
  })

  it('a withdrawn player with the same ID is let through, and the same ID at another event is not a duplicate', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const other = await seedTournament()
    const earlier = await seedMember({ uscfId: '30000001' })
    const withdrawn = await seedRegistration({ tournamentId, memberId: earlier })
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(withdrawn).run()
    expect((await addWalkIn(admin, tournamentId, { fullName: 'Back Again', uscfId: '30000001', section: 'Open' })).status).toBe(201)
    const elsewhere = await seedMember({ uscfId: '30000002' })
    await seedRegistration({ tournamentId: other, memberId: elsewhere })
    expect((await addWalkIn(admin, tournamentId, { fullName: 'Same ID', uscfId: '30000002', section: 'Open' })).status).toBe(201)
  })

  it('an active entry with the same ID is 409 and writes nothing', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    await seedRegistration({ tournamentId, memberId: await seedMember({ uscfId: '30000003' }) })
    const before = await countOf('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?', tournamentId)
    const res = await addWalkIn(admin, tournamentId, { fullName: 'Twice', uscfId: '30000003', section: 'U1200' })
    expect(res.status).toBe(409)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'A player with this US Chess ID is already registered.' })
    expect(await countOf('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?', tournamentId)).toBe(before)
  })

  it('a body that is JSON but not an object is 400 with fields, and writes nothing', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    for (const rawBody of ['null', '[]', '"Open"', '7']) {
      const res = await invoke(walkInPost, { method: 'POST', as: admin, params: { id: tournamentId }, rawBody, headers: { 'Content-Type': 'application/json' } })
      expect(res.status, rawBody).toBe(400)
      await expectContract(res, fieldErrorBodySchema)
    }
    const empty = await invoke(walkInPost, { method: 'POST', as: admin, params: { id: tournamentId } })
    expect(empty.status).toBe(400)
    await expectContract(empty, fieldErrorBodySchema)
    expect(await countOf('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?', tournamentId)).toBe(0)
  })

  it('refusals and field messages never say USCF', async () => {
    const admin = await seedAdmin()
    const rated = await seedTournament({ isRated: true })
    const seen: string[] = []
    for (const body of [
      { fullName: 'Door Player', section: 'Open' },
      { fullName: 'Door Player', section: 'Open', uscfId: 12345678 },
      { fullName: 'Door Player', section: 'Open', uscfId: '99999999' },
    ]) {
      const res = await addWalkIn(admin, rated, body)
      seen.push(await messagesOf(res))
    }
    const dup = await addWalkIn(admin, rated, { fullName: 'Door Player', section: 'Open', uscfId: '99999999' })
    expect(dup.status).toBe(409)
    seen.push(await messagesOf(dup))
    expect(seen.join(' ')).toMatch(/US Chess/)
    expect(seen.join(' ')).not.toMatch(/USCF/i)
  })

  it('an assigned director of another event and a rep of no club get 403 and nothing is written', async () => {
    const tournamentId = await seedTournament({ clubId: await seedClub() })
    const elsewhere = await seedTournament()
    const td = await seedDirector()
    await seedTournamentDirector(elsewhere, td)
    const unaffiliated = await seedMember({ role: 'club_rep' })
    for (const who of [td, unaffiliated]) {
      const res = await addWalkIn(who, tournamentId, { fullName: 'Door Player', section: 'Open' })
      expect(res.status).toBe(403)
      await expectContract(res, errorBodySchema)
    }
    expect(await countOf('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?', tournamentId)).toBe(0)
  })
})

describe('waitlist offers read the sections table', () => {
  it('an entry into a section with no row anywhere is charged the event fee, less the member discount', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 40 })
    await setColumns(tournamentId, { member_discount: 5 })
    const member = await waitlisted(tournamentId, 'Ghost', { membershipStatus: 'active' })
    const guest = await waitlisted(tournamentId, 'Ghost', { membershipStatus: 'pending' })
    expect(await expectContract(await offerSpot(admin, tournamentId, member.reg), offer.response)).toEqual({ success: true, amount: 35 })
    expect(await expectContract(await offerSpot(admin, tournamentId, guest.reg), offer.response)).toEqual({ success: true, amount: 40 })
  })

  it('the row the entry points at wins over a row of the same name as its section text', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }, { name: 'Premier', entryFee: 60 }] })
    const premier = await sectionRow(tournamentId, 'Premier')
    // The section was renamed after the entry was made: the text is old, the link is current.
    const { reg } = await waitlisted(tournamentId, 'Open', { sectionId: premier?.id ?? null })
    expect(await expectContract(await offerSpot(admin, tournamentId, reg), offer.response)).toEqual({ success: true, amount: 60 })
  })

  it('a link to a row of another event is not followed to a price: the name decides', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }] })
    const other = await seedTournament({ sections: [{ name: 'Open', entryFee: 500 }] })
    const foreign = await sectionRow(other, 'Open')
    const { reg } = await waitlisted(tournamentId, 'Open', { sectionId: foreign?.id ?? null })
    const res = await offerSpot(admin, tournamentId, reg)
    expect(await expectContract(res, offer.response)).toEqual({ success: true, amount: 25 })
  })

  it('a section’s own early price is honoured while the early deadline stands', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 30 }] })
    await setColumns(tournamentId, { early_deadline: '2099-01-01T00:00', early_discount: 4 })
    await env.DB.prepare(`UPDATE tournament_sections SET fee_early = 20 WHERE tournament_id = ? AND name = 'Open'`).bind(tournamentId).run()
    const { reg } = await waitlisted(tournamentId, 'Open')
    expect(await expectContract(await offerSpot(admin, tournamentId, reg), offer.response)).toEqual({ success: true, amount: 20 })
  })

  it('a member discount larger than the fee never goes below zero, and the spot is then free and confirmed', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 10, sections: [{ name: 'Open', entryFee: 10 }] })
    await setColumns(tournamentId, { member_discount: 25 })
    const { memberId, reg } = await waitlisted(tournamentId, 'Open', { membershipStatus: 'active' })
    expect(await expectContract(await offerSpot(admin, tournamentId, reg), offer.response)).toEqual({ success: true, amount: 0 })
    expect(await env.DB.prepare('SELECT payment_status, waitlisted_at FROM registrations WHERE id = ?').bind(reg).first()).toEqual({ payment_status: 'paid', waitlisted_at: null })
    expect(await env.DB.prepare('SELECT amount, status FROM payments WHERE reference_id = ?').bind(reg).first()).toEqual({ amount: 0, status: 'completed' })
    expect(emailOutbox.map((m) => m.to)).toEqual([`${memberId}@test.lca`])
  })
})

describe('waitlist offers: replays, other events and who is told', () => {
  it('offering the same spot twice is 404 the second time and leaves one payment and one email', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }] })
    const { reg } = await waitlisted(tournamentId, 'Open')
    expect((await offerSpot(admin, tournamentId, reg)).status).toBe(200)
    const emailsAfterFirst = emailOutbox.length
    const again = await offerSpot(admin, tournamentId, reg)
    expect(again.status).toBe(404)
    expect(await expectContract(again, errorBodySchema)).toEqual({ error: 'That player is not on the waitlist' })
    expect(await countOf('SELECT COUNT(*) AS n FROM payments WHERE reference_id = ?', reg)).toBe(1)
    expect(await countOf(`SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = 'waitlist_offer' AND detail LIKE ?`, `%${reg}%`)).toBe(1)
    expect(emailOutbox).toHaveLength(emailsAfterFirst)
  })

  it('an entry of another event is 404 even for a manager of this one, and is left as it was', async () => {
    const admin = await seedAdmin()
    const clubId = await seedClub()
    const mine = await seedTournament({ clubId })
    const theirs = await seedTournament({ clubId: await seedClub() })
    const { reg } = await waitlisted(theirs, 'Open')
    const rep = await seedMember({ role: 'club_rep', clubId })
    for (const who of [rep, admin]) {
      const res = await offerSpot(who, mine, reg)
      expect(res.status).toBe(404)
      await expectContract(res, errorBodySchema)
    }
    expect(await env.DB.prepare('SELECT payment_status, waitlisted_at IS NOT NULL AS waiting FROM registrations WHERE id = ?').bind(reg).first())
      .toEqual({ payment_status: 'pending', waiting: 1 })
    expect(await countOf('SELECT COUNT(*) AS n FROM payments WHERE reference_id = ?', reg)).toBe(0)
  })

  it('a withdrawn entry, a missing entry and a missing event are not offered a spot', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const { reg } = await waitlisted(tournamentId, 'Open')
    await env.DB.prepare(`UPDATE registrations SET withdrawn_at = datetime('now') WHERE id = ?`).bind(reg).run()
    expect((await offerSpot(admin, tournamentId, reg)).status).toBe(404)
    expect((await offerSpot(admin, tournamentId, 'reg-does-not-exist')).status).toBe(404)
    const noEvent = await offerSpot(admin, 'no-such-event', reg)
    expect(noEvent.status).toBe(404)
    await expectContract(noEvent, errorBodySchema)
    expect(await countOf('SELECT COUNT(*) AS n FROM payments WHERE reference_id = ?', reg)).toBe(0)
  })

  it('a child’s spot is emailed to the parent, with the amount in dollars and cents and no mention of USCF', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }] })
    const parent = await seedMember({ email: 'parent@test.lca', fullName: 'Pat Parent' })
    const { memberId, reg } = await waitlisted(tournamentId, 'Open')
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, memberId).run()
    expect(await expectContract(await offerSpot(admin, tournamentId, reg), offer.response)).toEqual({ success: true, amount: 25 })
    expect(emailOutbox).toHaveLength(1)
    expect(emailOutbox[0].to).toBe('parent@test.lca')
    expect(emailOutbox[0].text).toContain('$25.00')
    expect(`${emailOutbox[0].subject} ${emailOutbox[0].html} ${emailOutbox[0].text}`).not.toMatch(/USCF/)
  })

  it('records who made the offer, for which player and at what price', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }] })
    const { memberId, reg } = await waitlisted(tournamentId, 'Open')
    await offerSpot(admin, tournamentId, reg)
    const row = await env.DB.prepare(`SELECT actor_id, target_member_id, detail FROM admin_audit_log WHERE action = 'waitlist_offer' AND detail LIKE ?`)
      .bind(`%${reg}%`).first<{ actor_id: string; target_member_id: string; detail: string }>()
    expect(row).toMatchObject({ actor_id: admin, target_member_id: memberId })
    expect(JSON.parse(row!.detail)).toEqual({ tournament_id: tournamentId, registration_id: reg, amount: 25 })
  })

  it('a rep of another club and a plain member cannot make an offer for an entry in a section they could see', async () => {
    const clubId = await seedClub()
    const tournamentId = await seedTournament({ clubId })
    const { reg } = await waitlisted(tournamentId, 'Open')
    for (const who of [await seedMember({ role: 'club_rep', clubId: await seedClub() }), await seedMember(), await seedDirector()]) {
      const res = await offerSpot(who, tournamentId, reg)
      expect(res.status).toBe(403)
      expect(JSON.stringify(await res.json())).not.toMatch(/amount|full_name|email/)
    }
    expect(await countOf('SELECT COUNT(*) AS n FROM payments WHERE reference_id = ?', reg)).toBe(0)
    expect(emailOutbox).toHaveLength(0)
  })
})

describe('waitlist pricing reads deadlines as Central wall-clock time', () => {
  // [deadline, the last second it still stands, the first second it has passed]
  const cases: Array<[string, string, string, string]> = [
    ['midnight, daylight time', '2026-10-15T00:00', '2026-10-15T04:59:59Z', '2026-10-15T05:00:00Z'],
    ['midnight after the fall-back day', '2026-11-02T00:00', '2026-11-02T05:59:59Z', '2026-11-02T06:00:00Z'],
    ['first hour after the spring-forward gap', '2027-03-14T03:00', '2027-03-14T07:59:59Z', '2027-03-14T08:00:00Z'],
    ['a bare date is the end of that day', '2026-11-01', '2026-11-02T05:59:58Z', '2026-11-02T05:59:59Z'],
    ['an explicit offset is taken as written', '2026-10-15T12:00:00Z', '2026-10-15T11:59:59Z', '2026-10-15T12:00:00Z'],
  ]

  it.each(cases)('early deadline, %s', async (_label, deadline, stands, passed) => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 30, sections: [{ name: 'Open', entryFee: 30 }] })
    await setColumns(tournamentId, { early_deadline: deadline, early_discount: 6 })
    vi.useFakeTimers({ toFake: ['Date'] })
    for (const [at, expected] of [[stands, 24], [passed, 30]] as const) {
      vi.setSystemTime(new Date(at))
      const { reg } = await waitlisted(tournamentId, 'Open')
      expect(await expectContract(await offerSpot(admin, tournamentId, reg), offer.response), `${deadline} at ${at}`).toEqual({ success: true, amount: expected })
    }
  })

  it.each(cases)('late date, %s', async (_label, lateAfter, before, atOrAfter) => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 30, sections: [{ name: 'Open', entryFee: 30 }] })
    await setColumns(tournamentId, { late_after: lateAfter, late_fee: 8 })
    vi.useFakeTimers({ toFake: ['Date'] })
    for (const [at, expected] of [[before, 30], [atOrAfter, 38]] as const) {
      vi.setSystemTime(new Date(at))
      const { reg } = await waitlisted(tournamentId, 'Open')
      expect(await expectContract(await offerSpot(admin, tournamentId, reg), offer.response), `${lateAfter} at ${at}`).toEqual({ success: true, amount: expected })
    }
  })

  it('end_date null on the event changes nothing about the price or the offer', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }] })
    expect(await env.DB.prepare('SELECT end_date FROM tournaments WHERE id = ?').bind(tournamentId).first()).toEqual({ end_date: null })
    const { reg } = await waitlisted(tournamentId, 'Open')
    expect(await expectContract(await offerSpot(admin, tournamentId, reg), offer.response)).toEqual({ success: true, amount: 25 })
  })
})
