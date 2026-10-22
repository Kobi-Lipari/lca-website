// test/integration/contracts/walkins-waitlist-json.test.ts
// The walk-in and waitlist-offer handlers no longer read tournaments.sections:
// with the JSON empty, malformed, stale or listing a section the table does
// not have, the table alone decides which section is live and what it costs.
// The 0053 triggers that copy a JSON write into the table are dropped for
// this file only (each test file has its own database), so the JSON can be
// made to disagree with the rows; the triggers stay installed everywhere else.
import { env } from 'cloudflare:test'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { contracts, errorBodySchema } from '../../../domain/contracts'
import { onRequestPost as walkInPost } from '../../../functions/api/admin/tournaments/[id]/walk-ins'
import { onRequestPost as waitlistPost } from '../../../functions/api/admin/tournaments/[id]/waitlist'
import { seedAdmin, seedMember, seedRegistration, seedTournament } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

beforeAll(async () => {
  for (const name of ['tournaments_sections_sync_update', 'tournaments_sections_sync_insert']) {
    await env.DB.prepare(`DROP TRIGGER IF EXISTS ${name}`).run()
  }
})
beforeEach(resetHarness)

const walkIn = contracts['admin/tournaments/[id]/walk-ins'].POST
const offer = contracts['admin/tournaments/[id]/waitlist'].POST

const countOf = async (sqlText: string, ...binds: unknown[]) =>
  (await env.DB.prepare(sqlText).bind(...binds).first<{ n: number }>())?.n ?? 0

const setJson = (tournamentId: string, json: string) =>
  env.DB.prepare('UPDATE tournaments SET sections = ? WHERE id = ?').bind(json, tournamentId).run()

const sectionRow = (tournamentId: string, name: string) =>
  env.DB.prepare('SELECT id FROM tournament_sections WHERE tournament_id = ? AND name = ? AND archived_at IS NULL')
    .bind(tournamentId, name).first<{ id: string }>()

const addWalkIn = (admin: string, tournamentId: string, body: Record<string, unknown>) =>
  invoke(walkInPost, { method: 'POST', as: admin, params: { id: tournamentId }, body })

async function waitlisted(tournamentId: string, section: string) {
  const memberId = await seedMember({ membershipStatus: 'pending' })
  const reg = await seedRegistration({ tournamentId, memberId, section, paymentStatus: 'pending' })
  await env.DB.prepare(`UPDATE registrations SET waitlisted_at = datetime('now') WHERE id = ?`).bind(reg).run()
  return reg
}

it('the sync triggers are really gone for this file', async () => {
  const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 20 }] })
  await setJson(tournamentId, '[{"name":"Open","entryFee":20},{"name":"Extra","entryFee":5}]')
  expect(await sectionRow(tournamentId, 'Extra')).toBeNull()
})

describe('walk-ins read the sections table, not the legacy JSON', () => {
  it.each([
    ['empty', '[]'],
    ['not JSON at all', 'garbage {'],
    ['a different list', '[{"name":"Elsewhere","entryFee":1}]'],
  ])('a live section is still taken when the JSON is %s', async (_label, json) => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 20 }] })
    await setJson(tournamentId, json)
    const res = await addWalkIn(admin, tournamentId, { fullName: 'Door Player', section: 'Open' })
    expect(res.status).toBe(201)
    const body = await expectContract(res, walkIn.response)
    expect(body.registration.section_id).toBe((await sectionRow(tournamentId, 'Open'))?.id)
    expect(await env.DB.prepare('SELECT amount FROM payments WHERE reference_id = ?').bind(body.registration.id).first()).toEqual({ amount: 20 })
  })

  it('a section only the JSON lists is refused with 400 and { error }, and nothing is written', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ sections: [{ name: 'Open', entryFee: 20 }] })
    await setJson(tournamentId, '[{"name":"Open","entryFee":20},{"name":"Ghost","entryFee":5}]')
    const guestsBefore = await countOf(`SELECT COUNT(*) AS n FROM members WHERE role = 'guest'`)
    const res = await addWalkIn(admin, tournamentId, { fullName: 'Door Player', section: 'Ghost' })
    expect(res.status).toBe(400)
    expect(await expectContract(res, errorBodySchema)).toEqual({ error: 'Invalid section' })
    expect(await countOf('SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?', tournamentId)).toBe(0)
    expect(await countOf(`SELECT COUNT(*) AS n FROM members WHERE role = 'guest'`)).toBe(guestsBefore)
  })
})

describe('waitlist offers read the sections table, not the legacy JSON', () => {
  it('a spot is priced from the row’s fee when the JSON is stale, empty or malformed', async () => {
    const admin = await seedAdmin()
    const tournamentId = await seedTournament({ entryFee: 40, sections: [{ name: 'Open', entryFee: 25 }] })
    await env.DB.prepare(`UPDATE tournament_sections SET fee_regular = 22 WHERE tournament_id = ? AND name = 'Open'`).bind(tournamentId).run()
    for (const json of ['[{"name":"Open","entryFee":99}]', '[]', 'garbage {']) {
      await setJson(tournamentId, json)
      const reg = await waitlisted(tournamentId, 'Open')
      const res = await invoke(waitlistPost, { method: 'POST', as: admin, params: { id: tournamentId }, body: { registrationId: reg } })
      expect(res.status, json).toBe(200)
      expect(await expectContract(res, offer.response), json).toEqual({ success: true, amount: 22 })
    }
  })
})
