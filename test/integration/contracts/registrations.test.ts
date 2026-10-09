// test/integration/contracts/registrations.test.ts
// POST /api/registrations, POST /api/registrations/batch and PATCH
// /api/registrations/[id] keep their contracts (domain/contracts/
// registration.ts): the real handlers, rows from the factories. The requests
// are the bodies createRegistration, createBatchRegistration and
// updateRegistration in src/lib/api.ts send, through JSON as fetch sends
// them (undefined keys dropped). Refusals keep the plain { error } body, and
// a body that is not JSON, or breaks the request contract, gets { error,
// fields }.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema, registrationFullBodySchema } from '../../../domain/contracts'
import { onRequestPost as registerPost } from '../../../functions/api/registrations'
import { onRequestPost as batchPost } from '../../../functions/api/registrations/batch'
import { onRequestPatch as registrationPatch } from '../../../functions/api/registrations/[id]'
import { seedAdmin, seedMember, seedRegistration, seedTournament, seedTournamentDirector } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

beforeEach(resetHarness)

const single = contracts['registrations'].POST
const family = contracts['registrations/batch'].POST
const edit = contracts['registrations/[id]'].PATCH

/** What fetch sends: JSON.stringify drops undefined keys. */
const sent = <T>(body: T): T => JSON.parse(JSON.stringify(body)) as T

/** createRegistration(tournamentId, section, byeRounds = [], extra = {}) in src/lib/api.ts. */
const createBody = (
  tournamentId: string,
  section: string,
  byeRounds: number[] = [],
  extra: { gradeRange?: string | null; waitlist?: boolean } = {},
) => sent({ tournamentId, section, byeRounds, gradeRange: extra.gradeRange ?? undefined, waitlist: extra.waitlist || undefined })

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

describe('POST /api/registrations contract', () => {
  it('takes what createRegistration sends', () => {
    expect(single.request.safeParse(createBody('t-1', 'Open')).success).toBe(true)
    expect(single.request.safeParse(createBody('t-1', 'K-5', [2], { gradeRange: '0-5', waitlist: true })).success).toBe(true)
  })

  it('answers a free entry with the row, its section id and a completed payment', async () => {
    const tournamentId = await seedTournament()
    const member = await seedMember()
    const result = await invoke(registerPost, { method: 'POST', as: member, body: createBody(tournamentId, 'U1200') })
    expect(result.status).toBe(201)
    const body = await expectContract(result, single.response)
    if (!('payment' in body)) throw new Error('expected an entry, not the waitlist')
    expect(body.payment).toMatchObject({ amount: 0, status: 'completed' })
    expect(body.paymentUrl).toBeNull()
    expect(body.registration.section_id).toBe(await sectionIdOf(tournamentId, 'U1200'))
  })

  it('answers a paid entry with a pending payment and the checkout link', async () => {
    const tournamentId = await seedTournament()
    const member = await seedMember()
    const result = await invoke(registerPost, { method: 'POST', as: member, body: createBody(tournamentId, 'Open', [2]) })
    expect(result.status).toBe(201)
    const body = await expectContract(result, single.response)
    if (!('payment' in body)) throw new Error('expected an entry, not the waitlist')
    expect(body.payment).toMatchObject({ amount: 25, status: 'pending' })
    expect(typeof body.paymentUrl).toBe('string')
    expect(body.registration).toMatchObject({ section: 'Open', bye_rounds: '[2]', payment_status: 'pending' })
  })

  it('answers a full event with { error, full }, and a waitlist place with its own shape', async () => {
    const tournamentId = await seedTournament({ maxPlayers: 1 })
    await seedRegistration({ tournamentId, memberId: await seedMember() })
    const late = await seedMember()
    const full = await invoke(registerPost, { method: 'POST', as: late, body: createBody(tournamentId, 'Open') })
    expect(full.status).toBe(400)
    await expectContract(full, registrationFullBodySchema)

    const joined = await invoke(registerPost, { method: 'POST', as: late, body: createBody(tournamentId, 'Open', [], { waitlist: true }) })
    expect(joined.status).toBe(201)
    const body = await expectContract(joined, single.response)
    expect(body.registration).toMatchObject({ waitlisted: true })
  })

  it('a body that is not JSON, or has no section, is 400 with fields and writes nothing', async () => {
    const tournamentId = await seedTournament()
    const member = await seedMember()
    const broken = await invoke(registerPost, { method: 'POST', as: member, rawBody: '{"tournamentId":', headers: { 'Content-Type': 'application/json' } })
    expect(broken.status).toBe(400)
    expect((await expectContract(broken, fieldErrorBodySchema)).error).toBe('Invalid JSON body')

    const noSection = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId } })
    expect(noSection.status).toBe(400)
    expect((await expectContract(noSection, fieldErrorBodySchema)).fields).toHaveProperty('section')

    const badByes = await invoke(registerPost, { method: 'POST', as: member, body: { tournamentId, section: 'Open', byeRounds: '1,2' } })
    expect(badByes.status).toBe(400)
    await expectContract(badByes, fieldErrorBodySchema)
    expect(await countOf('SELECT COUNT(*) AS n FROM registrations WHERE member_id = ?', member)).toBe(0)
  })

  it('a removed (archived) section is refused with { error }', async () => {
    const tournamentId = await seedTournament()
    await archiveSection(tournamentId, 'U1200')
    const member = await seedMember()
    const res = await invoke(registerPost, { method: 'POST', as: member, body: createBody(tournamentId, 'U1200') })
    expect(res.status).toBe(400)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Invalid section' })
    expect(await countOf('SELECT COUNT(*) AS n FROM registrations WHERE member_id = ?', member)).toBe(0)
  })

  it('role safety: no sign-in is 401 with { error } and writes nothing', async () => {
    const tournamentId = await seedTournament()
    const before = await countOf('SELECT COUNT(*) AS n FROM registrations')
    const res = await invoke(registerPost, { method: 'POST', body: createBody(tournamentId, 'U1200') })
    expect(res.status).toBe(401)
    await expectContract(res, errorBodySchema)
    expect(await countOf('SELECT COUNT(*) AS n FROM registrations')).toBe(before)
  })
})

describe('POST /api/registrations/batch contract', () => {
  /** A parent and one child on the family account. */
  async function household() {
    const parent = await seedMember()
    const child = await seedMember({ uscfRating: 700 })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(parent, child).run()
    return { parent, child }
  }

  it('takes what createBatchRegistration sends', () => {
    const entries = [
      { memberId: undefined, section: 'Open', byeRounds: [], gradeRange: undefined },
      { memberId: 'mem-2', section: 'K-8', byeRounds: [1], gradeRange: '0-8' },
      { memberId: 'mem-3', section: 'K-8', byeRounds: [], gradeRange: null },
    ]
    expect(family.request.safeParse(sent({ tournamentId: 't-1', entries })).success).toBe(true)
  })

  it('answers a mixed free and paid family entry with one checkout', async () => {
    const tournamentId = await seedTournament()
    const { parent, child } = await household()
    const result = await invoke(batchPost, {
      method: 'POST', as: parent,
      body: sent({ tournamentId, entries: [{ section: 'Open', byeRounds: [] }, { memberId: child, section: 'U1200', byeRounds: [1] }] }),
    })
    expect(result.status).toBe(201)
    const body = await expectContract(result, family.response)
    expect(body.total).toBe(25)
    expect(typeof body.paymentUrl).toBe('string')
    expect(body.registrations.map((r) => [r.memberId, r.section, r.amount, r.paymentStatus]))
      .toEqual([[parent, 'Open', 25, 'pending'], [child, 'U1200', 0, 'paid']])
  })

  it('a body that is not JSON, or has no list of players, is 400 with fields; an empty list is 400 with { error }', async () => {
    const tournamentId = await seedTournament()
    const parent = await seedMember()
    const broken = await invoke(batchPost, { method: 'POST', as: parent, rawBody: 'entries=1', headers: { 'Content-Type': 'application/json' } })
    expect(broken.status).toBe(400)
    await expectContract(broken, fieldErrorBodySchema)

    const noList = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: 'Open' } })
    expect(noList.status).toBe(400)
    expect((await expectContract(noList, fieldErrorBodySchema)).fields).toHaveProperty('entries')

    const empty = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [] } })
    expect(empty.status).toBe(400)
    await expectContract(empty, errorBodySchema)
    expect(await countOf('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?', tournamentId)).toBe(0)
  })

  it('a removed (archived) section is refused with { error }', async () => {
    const tournamentId = await seedTournament()
    await archiveSection(tournamentId, 'U1200')
    const { parent, child } = await household()
    const res = await invoke(batchPost, { method: 'POST', as: parent, body: { tournamentId, entries: [{ memberId: child, section: 'U1200' }] } })
    expect(res.status).toBe(400)
    await expectContract(res, errorBodySchema)
    expect(await countOf('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?', tournamentId)).toBe(0)
  })

  it("role safety: entering someone else's child is 403 with { error }; no sign-in is 401; nothing is written", async () => {
    const tournamentId = await seedTournament()
    const { child } = await household()
    const stranger = await seedMember()
    const res = await invoke(batchPost, { method: 'POST', as: stranger, body: { tournamentId, entries: [{ memberId: child, section: 'U1200' }] } })
    expect(res.status).toBe(403)
    await expectContract(res, errorBodySchema)
    const anon = await invoke(batchPost, { method: 'POST', body: { tournamentId, entries: [{ section: 'U1200' }] } })
    expect(anon.status).toBe(401)
    await expectContract(anon, errorBodySchema)
    expect(await countOf('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?', tournamentId)).toBe(0)
  })
})

describe('PATCH /api/registrations/[id] contract', () => {
  it('takes what updateRegistration sends', () => {
    for (const body of [
      { byeRounds: [1, 3] }, { section: 'U1200' }, { paymentStatus: 'refunded' }, { withdrawn: true }, { checkedIn: false },
    ]) expect(edit.request.safeParse(sent(body)).success, JSON.stringify(body)).toBe(true)
  })

  it('answers the owner changing byes with the whole row, bye_rounds parsed', async () => {
    const tournamentId = await seedTournament()
    const player = await seedMember()
    const reg = await seedRegistration({ tournamentId, memberId: player })
    const result = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, body: sent({ byeRounds: [3, 2] }) })
    expect(result.status).toBe(200)
    const body = await expectContract(result, edit.response)
    expect(body).toMatchObject({ registration: { bye_rounds: [2, 3] }, feeNote: null })
  })

  it('answers a director moving a paid entry to a cheaper section with the fee note', async () => {
    const tournamentId = await seedTournament()
    const td = await seedMember()
    await seedTournamentDirector(tournamentId, td)
    const player = await seedMember()
    const reg = await seedRegistration({ tournamentId, memberId: player, section: 'Open', paymentStatus: 'paid' })
    await env.DB.prepare(`INSERT INTO payments (id, member_id, amount, type, reference_id, status) VALUES (?, ?, 25, 'tournament', ?, 'completed')`)
      .bind(`pay-${reg}`, player, reg).run()
    const result = await invoke(registrationPatch, { method: 'PATCH', as: td, params: { id: reg }, body: sent({ section: 'U1200' }) })
    expect(result.status).toBe(200)
    const body = await expectContract(result, edit.response)
    expect(body.registration).toMatchObject({ section: 'U1200', section_id: await sectionIdOf(tournamentId, 'U1200') })
    expect(body.feeNote).toMatch(/\$25 to \$0/)
  })

  it('a body that is not JSON, or of the wrong types, is 400 with fields for the owner; a stranger still gets 403', async () => {
    const tournamentId = await seedTournament()
    const player = await seedMember()
    const reg = await seedRegistration({ tournamentId, memberId: player })
    const broken = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, rawBody: '{', headers: { 'Content-Type': 'application/json' } })
    expect(broken.status).toBe(400)
    await expectContract(broken, fieldErrorBodySchema)
    const wrongType = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, body: { withdrawn: 'yes' } })
    expect(wrongType.status).toBe(400)
    expect((await expectContract(wrongType, fieldErrorBodySchema)).fields).toHaveProperty('withdrawn')

    const stranger = await invoke(registrationPatch, { method: 'PATCH', as: await seedMember(), params: { id: reg }, rawBody: '{' })
    expect(stranger.status).toBe(403)
    await expectContract(stranger, errorBodySchema)
  })

  it('a move into a removed (archived) section is refused with { error } and changes nothing', async () => {
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 25 }, { name: 'U1200', entryFee: 0 }, { name: 'Closed', entryFee: 10 }] })
    await archiveSection(tournamentId, 'Closed')
    const admin = await seedAdmin()
    const player = await seedMember()
    const reg = await seedRegistration({ tournamentId, memberId: player })
    const before = await env.DB.prepare('SELECT section, section_id FROM registrations WHERE id = ?').bind(reg).first()
    const res = await invoke(registrationPatch, { method: 'PATCH', as: admin, params: { id: reg }, body: { section: 'Closed' } })
    expect(res.status).toBe(400)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Invalid section' })
    expect(await env.DB.prepare('SELECT section, section_id FROM registrations WHERE id = ?').bind(reg).first()).toEqual(before)
  })

  it('role safety: a plain member cannot move another entry or mark payment, and no sign-in is 401', async () => {
    const tournamentId = await seedTournament()
    const player = await seedMember()
    const reg = await seedRegistration({ tournamentId, memberId: player, paymentStatus: 'pending' })
    const other = await invoke(registrationPatch, { method: 'PATCH', as: await seedMember(), params: { id: reg }, body: { section: 'U1200' } })
    expect(other.status).toBe(403)
    await expectContract(other, errorBodySchema)
    const self = await invoke(registrationPatch, { method: 'PATCH', as: player, params: { id: reg }, body: { paymentStatus: 'paid' } })
    expect(self.status).toBe(403)
    await expectContract(self, errorBodySchema)
    const anon = await invoke(registrationPatch, { method: 'PATCH', params: { id: reg }, body: { section: 'U1200' } })
    expect(anon.status).toBe(401)
    await expectContract(anon, errorBodySchema)
    expect(await env.DB.prepare('SELECT section, payment_status FROM registrations WHERE id = ?').bind(reg).first())
      .toEqual({ section: 'Open', payment_status: 'pending' })
  })
})
