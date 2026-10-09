// test/integration/contracts/walkins-waitlist.test.ts
// POST /api/admin/tournaments/[id]/walk-ins and POST /api/admin/tournaments/
// [id]/waitlist keep their contracts (domain/contracts/registration.ts): the
// real handlers, rows from the factories. The requests are the bodies
// adminAddWalkIn and offerWaitlistSpot in src/lib/api.ts send, as the manage
// page fills them, through JSON as fetch sends them. Refusals keep the plain
// { error } body, and a body that is not JSON, or breaks the request
// contract, gets { error, fields }.
//
// Both handlers read sections from tournament_sections: a walk-in takes a
// live section only, matched by exact name, and carries its section_id; a
// spot offered from the waitlist is priced from the section row and the
// tournament's live pricing columns, the same amount the old reader of the
// sections JSON gave (oldReaderPrice below is that reader, as the pages'
// adapter priced it before it was removed).
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema } from '../../../domain/contracts'
import { priceEntry, type Price, type PriceTournament } from '../../../domain/registration/pricing'
import { normalizeLegacySections } from '../../../domain/events/sections'
import { onRequestPost as walkInPost } from '../../../functions/api/admin/tournaments/[id]/walk-ins'
import { onRequestPost as waitlistPost } from '../../../functions/api/admin/tournaments/[id]/waitlist'
import { seedAdmin, seedClub, seedDirector, seedMember, seedRegistration, seedTournament, seedTournamentDirector } from '../factories'
import { emailOutbox, expectContract, invoke, resetHarness } from '../harness'

beforeEach(resetHarness)

const walkIn = contracts['admin/tournaments/[id]/walk-ins'].POST
const offer = contracts['admin/tournaments/[id]/waitlist'].POST

/**
 * The price the old reader of the sections JSON gave: the section's entryFee
 * when it is a number, else the event fee, priced through priceEntry.
 */
function oldReaderPrice(t: PriceTournament & { sections: string }, sectionName: string, isLcaMember: boolean): Price {
  const match = normalizeLegacySections(t.sections).find((s) => s.name === sectionName)
  const feeRegular = typeof match?.entryFee === 'number' ? match.entryFee : t.entry_fee
  return priceEntry({ feeRegular }, t, Date.now(), { isLcaMember })
}

/** What fetch sends: JSON.stringify drops undefined keys. */
const sent = <T>(body: T): T => JSON.parse(JSON.stringify(body)) as T

/** The body handleAddWalkIn in TournamentManagePage.tsx gives adminAddWalkIn. */
const walkInBody = (
  section: string,
  form: { fullName?: string; uscfId?: string; uscfRating?: string; markPaid?: boolean } = {},
) => sent({
  fullName: (form.fullName ?? 'Door Player').trim(),
  uscfId: (form.uscfId ?? '').trim() || null,
  uscfRating: form.uscfRating ? Number(form.uscfRating) : null,
  section,
  markPaid: form.markPaid ?? true,
})

const countOf = async (sqlText: string, ...binds: unknown[]) =>
  (await env.DB.prepare(sqlText).bind(...binds).first<{ n: number }>())?.n ?? 0

const sectionIdOf = async (tournamentId: string, name: string) =>
  (await env.DB.prepare('SELECT id FROM tournament_sections WHERE tournament_id = ? AND name = ? AND archived_at IS NULL')
    .bind(tournamentId, name).first<{ id: string }>())?.id

/**
 * Archives a section row and leaves the legacy JSON as it was, so the JSON
 * still lists the section: a refusal can only come from reading the table.
 */
async function archiveSection(tournamentId: string, name: string) {
  await env.DB.prepare(`UPDATE tournament_sections SET archived_at = datetime('now') WHERE tournament_id = ? AND name = ?`)
    .bind(tournamentId, name).run()
}

/** Everything a walk-in writes, counted for one tournament. */
const walkInRows = async (tournamentId: string) => ({
  entries: await countOf('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?', tournamentId),
  guests: await countOf(`SELECT COUNT(*) AS n FROM members WHERE role = 'guest'`),
  payments: await countOf(`SELECT COUNT(*) AS n FROM payments WHERE reference_id LIKE ?`, `reg-${tournamentId}-%`),
})

/** A player on the event's waitlist, as registrations.ts leaves one: pending, nothing charged. */
async function waitlisted(tournamentId: string, section: string, member?: { membershipStatus?: string }) {
  const memberId = await seedMember({ membershipStatus: member?.membershipStatus ?? 'active' })
  const reg = await seedRegistration({ tournamentId, memberId, section, paymentStatus: 'pending' })
  await env.DB.prepare(`UPDATE registrations SET waitlisted_at = datetime('now') WHERE id = ?`).bind(reg).run()
  return { memberId, reg }
}

describe('POST /api/admin/tournaments/[id]/walk-ins contract', () => {
  it('takes what adminAddWalkIn sends from the manage page', () => {
    for (const body of [
      walkInBody('Open'),
      walkInBody('Open', { uscfId: ' 12345678 ', uscfRating: '1500', markPaid: false }),
      sent({ fullName: 'Door Player', section: 'Open' }),
    ]) expect(walkIn.request.safeParse(body).success, JSON.stringify(body)).toBe(true)
  })

  it('answers a walk-in with the whole row, its section id set, and the guest id', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 20 }, { name: 'Reserve', entryFee: 15 }] })
    const result = await invoke(walkInPost, {
      method: 'POST', as: admin, params: { id: tournamentId }, body: walkInBody('Reserve', { uscfRating: '1320' }),
    })
    expect(result.status).toBe(201)
    const body = await expectContract(result, walkIn.response)
    expect(body.registration).toMatchObject({
      tournament_id: tournamentId, member_id: body.guestId, section: 'Reserve', section_id: await sectionIdOf(tournamentId, 'Reserve'),
      payment_status: 'paid', bye_rounds: null, rating_at_entry: 1320, waitlisted_at: null,
    })
    expect(await env.DB.prepare('SELECT amount, status, stripe_session_id FROM payments WHERE reference_id = ?').bind(body.registration.id).first())
      .toEqual({ amount: 15, status: 'completed', stripe_session_id: null })
  })

  it('a walk-in still owing the fee is pending, and a section with no fee of its own takes the event fee', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 30 })
    // An old event stored its sections as bare names; the table row has no fee of its own.
    await env.DB.prepare('UPDATE tournaments SET sections = ? WHERE id = ?').bind('["Open","Reserve"]', tournamentId).run()
    const result = await invoke(walkInPost, {
      method: 'POST', as: admin, params: { id: tournamentId }, body: walkInBody('Open', { markPaid: false }),
    })
    expect(result.status).toBe(201)
    const body = await expectContract(result, walkIn.response)
    expect(body.registration).toMatchObject({ section: 'Open', section_id: await sectionIdOf(tournamentId, 'Open'), payment_status: 'pending' })
    expect(await env.DB.prepare('SELECT amount, status FROM payments WHERE reference_id = ?').bind(body.registration.id).first())
      .toEqual({ amount: 30, status: 'pending' })
  })

  it('a section is matched by its exact name: another case, an unknown name or an archived section is 400 with { error }', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    await archiveSection(tournamentId, 'U1200')
    const before = await walkInRows(tournamentId)
    for (const section of ['open', 'OPEN', 'Open ', 'Reserve', 'U1200']) {
      const res = await invoke(walkInPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: walkInBody(section) })
      expect(res.status, section).toBe(400)
      expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Invalid section' })
    }
    expect(await walkInRows(tournamentId)).toEqual(before)

    const ok = await invoke(walkInPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: walkInBody('Open') })
    expect(ok.status).toBe(201)
    expect((await expectContract(ok, walkIn.response)).registration.section_id).toBe(await sectionIdOf(tournamentId, 'Open'))
  })

  it('a body that is not JSON, or breaks the contract, is 400 with fields and writes nothing', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const before = await walkInRows(tournamentId)

    const broken = await invoke(walkInPost, { method: 'POST', as: admin, params: { id: tournamentId }, rawBody: '{"fullName":', headers: { 'Content-Type': 'application/json' } })
    expect(broken.status).toBe(400)
    expect((await expectContract(broken, fieldErrorBodySchema)).error).toBe('Invalid JSON body')

    for (const [body, field] of [
      [{ section: 'Open' }, 'fullName'],
      [{ fullName: '   ', section: 'Open' }, 'fullName'],
      [{ fullName: 'Door Player' }, 'section'],
      [{ fullName: 'Door Player', section: 'Open', uscfRating: '1500' }, 'uscfRating'],
      [{ fullName: 'Door Player', section: 'Open', uscfId: 12345678 }, 'uscfId'],
      [{ fullName: 'Door Player', section: 'Open', markPaid: 'no' }, 'markPaid'],
    ] as const) {
      const res = await invoke(walkInPost, { method: 'POST', as: admin, params: { id: tournamentId }, body })
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect((await expectContract(res, fieldErrorBodySchema)).fields, JSON.stringify(body)).toHaveProperty(field)
    }
    expect(await walkInRows(tournamentId)).toEqual(before)
  })

  it('a rated event needs a US Chess ID, and the same ID twice is 409, both in plain words', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ isRated: true })
    const noId = await invoke(walkInPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: walkInBody('Open') })
    expect(noId.status).toBe(400)
    expect(await expectContract(noId, errorBodySchema)).toEqual({ error: 'A US Chess ID is required for walk-ins to rated tournaments.' })

    const first = await invoke(walkInPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: walkInBody('Open', { uscfId: '12345678' }) })
    expect(first.status).toBe(201)
    const again = await invoke(walkInPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: walkInBody('U1200', { uscfId: '12345678' }) })
    expect(again.status).toBe(409)
    expect(await expectContract(again, errorBodySchema)).toEqual({ error: 'A player with this US Chess ID is already registered.' })
  })

  it('a full event and a missing event answer with { error }', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ maxPlayers: 1 })
    await seedRegistration({ tournamentId, memberId: await seedMember() })
    const full = await invoke(walkInPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: walkInBody('Open') })
    expect(full.status).toBe(400)
    expect(await expectContract(full, errorBodySchema)).toEqual({ error: 'This tournament is full' })
    const missing = await invoke(walkInPost, { method: 'POST', as: admin, params: { id: 'no-such-event' }, body: walkInBody('Open') })
    expect(missing.status).toBe(404)
    await expectContract(missing, errorBodySchema)
  })

  it('the organizing club’s rep and an assigned director may add a walk-in', async () => {
    const clubId = await seedClub()
    const tournamentId = await seedTournament({ clubId })
    const td = await seedDirector()
    await seedTournamentDirector(tournamentId, td)
    for (const who of [await seedMember({ role: 'club_rep', clubId }), td]) {
      const res = await invoke(walkInPost, { method: 'POST', as: who, params: { id: tournamentId }, body: walkInBody('Open', { fullName: `Door ${who}` }) })
      expect(res.status).toBe(201)
      await expectContract(res, walkIn.response)
    }
  })

  it('role safety: another club’s rep and a plain member get 403, no sign-in is 401, and nothing is written', async () => {
    const clubId = await seedClub()
    const otherClub = await seedClub()
    const tournamentId = await seedTournament({ clubId })
    const before = await walkInRows(tournamentId)
    for (const who of [await seedMember({ role: 'club_rep', clubId: otherClub }), await seedMember()]) {
      const res = await invoke(walkInPost, { method: 'POST', as: who, params: { id: tournamentId }, body: walkInBody('Open') })
      expect(res.status).toBe(403)
      await expectContract(res, errorBodySchema)
      // The permission check comes before the body is read.
      const broken = await invoke(walkInPost, { method: 'POST', as: who, params: { id: tournamentId }, rawBody: '{' })
      expect(broken.status).toBe(403)
      await expectContract(broken, errorBodySchema)
    }
    const anon = await invoke(walkInPost, { method: 'POST', params: { id: tournamentId }, body: walkInBody('Open') })
    expect(anon.status).toBe(401)
    await expectContract(anon, errorBodySchema)
    expect(await walkInRows(tournamentId)).toEqual(before)
  })
})

describe('POST /api/admin/tournaments/[id]/waitlist contract', () => {
  it('takes what offerWaitlistSpot sends', () => {
    expect(offer.request.safeParse(sent({ registrationId: 'reg-1' })).success).toBe(true)
  })

  it('answers a free spot with amount 0 and confirms the entry at once', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ maxPlayers: 1 })
    const { reg } = await waitlisted(tournamentId, 'U1200')
    const result = await invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: sent({ registrationId: reg }) })
    expect(result.status).toBe(200)
    expect(await expectContract(result, offer.response)).toEqual({ success: true, amount: 0 })
    expect(await env.DB.prepare('SELECT waitlisted_at, payment_status FROM registrations WHERE id = ?').bind(reg).first())
      .toEqual({ waitlisted_at: null, payment_status: 'paid' })
  })

  it('prices a paid spot exactly as the old reader of the sections JSON did, from the live columns', async () => {
    const admin = await seedAdmin()
    const pricing = [
      {},
      { member_discount: 5 },
      { early_deadline: '2099-01-01T00:00', early_discount: 4, member_discount: 3 },
      { early_deadline: '2020-01-01T00:00', early_discount: 4 },
      { late_after: '2020-01-01T00:00', late_fee: 10, member_discount: 5 },
      { early_deadline: '2099-01-01T00:00', early_discount: 30 },
    ]
    for (const columns of pricing) {
      for (const membershipStatus of ['active', 'pending']) {
        const tournamentId = await seedTournament({ entryFee: 40, sections: [{ name: 'Open', entryFee: 25 }, { name: 'Reserve', entryFee: 15 }] })
        // One plain-name section with no fee of its own: priced at the event fee.
        await env.DB.prepare(`UPDATE tournaments SET sections = '[{"name":"Open","entryFee":25},{"name":"Reserve","entryFee":15},"Side"]' WHERE id = ?`)
          .bind(tournamentId).run()
        const sets = Object.keys(columns).map((k) => `${k} = ?`).join(', ')
        if (sets) await env.DB.prepare(`UPDATE tournaments SET ${sets} WHERE id = ?`).bind(...Object.values(columns), tournamentId).run()
        const t = await env.DB.prepare('SELECT * FROM tournaments WHERE id = ?').bind(tournamentId).first<PriceTournament & { sections: string }>()
        for (const section of ['Open', 'Reserve', 'Side']) {
          const { memberId, reg } = await waitlisted(tournamentId, section, { membershipStatus })
          const expected = oldReaderPrice(t!, section, membershipStatus === 'active').amount
          const res = await invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { registrationId: reg } })
          const label = `${JSON.stringify(columns)} ${membershipStatus} ${section}`
          expect(res.status, label).toBe(200)
          expect(await expectContract(res, offer.response), label).toEqual({ success: true, amount: expected })
          expect(await env.DB.prepare('SELECT amount, status, member_id FROM payments WHERE id = ?').bind(`pay-${reg}`).first(), label)
            .toEqual({ amount: expected, status: expected > 0 ? 'pending' : 'completed', member_id: memberId })
        }
      }
    }
  })

  it('a paid spot emails the player the amount owed', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ maxPlayers: 1 })
    const { reg } = await waitlisted(tournamentId, 'Open', { membershipStatus: 'pending' })
    const res = await invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { registrationId: reg } })
    expect(await expectContract(res, offer.response)).toEqual({ success: true, amount: 25 })
    expect(emailOutbox.some((m) => m.text?.includes('$25.00'))).toBe(true)
    expect(await env.DB.prepare('SELECT payment_status FROM registrations WHERE id = ?').bind(reg).first()).toEqual({ payment_status: 'pending' })
  })

  it('a body that is not JSON, or has no registrationId, is 400 with fields; a player not waiting is 404 with { error }', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament()
    const broken = await invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, rawBody: 'registrationId=1', headers: { 'Content-Type': 'application/json' } })
    expect(broken.status).toBe(400)
    expect((await expectContract(broken, fieldErrorBodySchema)).error).toBe('Invalid JSON body')
    for (const body of [{}, { registrationId: '' }, { registrationId: 7 }]) {
      const res = await invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, body })
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect((await expectContract(res, fieldErrorBodySchema)).fields).toHaveProperty('registrationId')
    }
    const entered = await seedRegistration({ tournamentId, memberId: await seedMember() })
    const notWaiting = await invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { registrationId: entered } })
    expect(notWaiting.status).toBe(404)
    expect(await expectContract(notWaiting, errorBodySchema)).toEqual({ error: 'That player is not on the waitlist' })
  })

  it('role safety: another club’s rep and a plain member get 403, no sign-in is 401, and the entry stays on the waitlist', async () => {
    const clubId = await seedClub()
    const otherClub = await seedClub()
    const tournamentId = await seedTournament({ clubId })
    const { memberId, reg } = await waitlisted(tournamentId, 'Open')
    const before = await env.DB.prepare('SELECT * FROM registrations WHERE id = ?').bind(reg).first()
    for (const who of [await seedMember({ role: 'club_rep', clubId: otherClub }), await seedMember(), memberId]) {
      const res = await invoke(waitlistPost, { method: 'POST', as: who, params: { id: tournamentId }, body: { registrationId: reg } })
      expect(res.status).toBe(403)
      await expectContract(res, errorBodySchema)
    }
    const anon = await invoke(waitlistPost, { method: 'POST', params: { id: tournamentId }, body: { registrationId: reg } })
    expect(anon.status).toBe(401)
    await expectContract(anon, errorBodySchema)
    expect(await env.DB.prepare('SELECT * FROM registrations WHERE id = ?').bind(reg).first()).toEqual(before)
    expect(await countOf('SELECT COUNT(*) AS n FROM payments WHERE reference_id = ?', reg)).toBe(0)

    const ownRep = await seedMember({ role: 'club_rep', clubId })
    const allowed = await invoke(waitlistPost, { method: 'POST', as: ownRep, params: { id: tournamentId }, body: { registrationId: reg } })
    expect(allowed.status).toBe(200)
    await expectContract(allowed, offer.response)
  })
})
