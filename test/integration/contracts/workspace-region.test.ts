// test/integration/contracts/workspace-region.test.ts
// GET /api/workspace/region and POST /api/admin/clubs/[id]/confirm keep
// their contracts (domain/contracts/clubs.ts), through the real handlers,
// with CLUB_KEEPERS_ON set through a getter on the mocked module, and their
// refusals keep the error body's with it unset as the tree has it. Every
// club and person here is made up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema, workspaceRegionResponseSchema } from '../../../domain/contracts'
import { onRequestGet as regionGet, onRequestOptions as regionOptions } from '../../../functions/api/workspace/region'
import { onRequestOptions as confirmOptions, onRequestPost as confirmPost } from '../../../functions/api/admin/clubs/[id]/confirm'
import { seedAdmin, seedClub, seedMember, seedTournament } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'

const flags = vi.hoisted(() => ({ keepersOn: false }))
vi.mock('../../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
    // These cases were written with REGION_EVENTS_ON unset, so it is held unset here;
    // test/integration/workspace-region.test.ts holds the answer with it set.
    get REGION_EVENTS_ON() {
      return false
    },
  }
})

beforeEach(resetHarness)
afterEach(() => {
  flags.keepersOn = false
})

const regionContract = contracts['workspace/region'].GET
const confirmContract = contracts['admin/clubs/[id]/confirm'].POST

/** A made up club in a region of its own with a visible event and a hidden draft, and a holder of the region's seat. */
async function exampleRegion() {
  const region = `Example Region ${crypto.randomUUID().slice(0, 8)}`
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ?, contact_email = \'club@example.org\', how_we_meet_text = \'Tuesdays at 7:00 PM.\' WHERE id = ?').bind(region, clubId).run()
  await seedTournament({ clubId, isVisible: true })
  await seedTournament({ clubId, isVisible: false })
  const holder = await seedMember({ fullName: 'Player One' })
  const seat = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, holder).run()
  return { clubId, region, holder, admin: await seedAdmin(), rep: await seedMember({ role: 'club_rep', clubId, fullName: 'Player Two' }) }
}

describe('GET /api/workspace/region keeps its contract', () => {
  it('answers a seat holder and an LCA admin within it, and a refusal as an error body, set and unset', async () => {
    const { holder, admin } = await exampleRegion()
    flags.keepersOn = true
    for (const [who, aal] of [[holder, 'aal1'], [admin, 'aal2']] as const) {
      const result = await invoke(regionGet, { as: who, aal })
      expect(result.status, who).toBe(200)
      const body = await expectContract(result, regionContract.response)
      expect(body.clubs.length, who).toBeGreaterThan(0)
      for (const card of body.clubs) expect(card.openItems, card.id).toEqual([])
    }
    const refused = await invoke(regionGet, { as: await seedMember(), aal: 'aal1' })
    expect(refused.status).toBe(403)
    await expectContract(refused, errorBodySchema)
    flags.keepersOn = false
    for (const [who, aal] of [[holder, 'aal1'], [admin, 'aal2']] as const) {
      const closed = await invoke(regionGet, { as: who, aal })
      expect(closed.status, who).toBe(403)
      await expectContract(closed, errorBodySchema)
    }
    expect((await invoke(regionOptions, { method: 'OPTIONS' })).status).toBe(204)
  })

  it('the contract is strict: a key it does not name, an email beside a card and a wrong type are refused', async () => {
    const { holder } = await exampleRegion()
    flags.keepersOn = true
    const body = await (await invoke(regionGet, { as: holder, aal: 'aal1' })).json<Record<string, unknown>>()
    expect(Object.keys(body)).toEqual(['clubs', 'thisMonth', 'regions'])
    expect(workspaceRegionResponseSchema.safeParse(body).success).toBe(true)
    expect(workspaceRegionResponseSchema.safeParse({ ...body, roster: [] }).success).toBe(false)
    const [card] = body.clubs as Array<Record<string, unknown>>
    expect(Object.keys(card)).toEqual(['id', 'name', 'city', 'region', 'color', 'logoUrl', 'statement', 'lastConfirmedAt', 'lastCheckWords', 'needsCheck', 'events', 'openItems'])
    for (const wrong of [{ ...card, contact_email: 'club@example.org' }, { ...card, events: -1 }, { ...card, openItems: [{ kind: 'report' }] }, { ...card, needsCheck: 'yes' }]) {
      expect(workspaceRegionResponseSchema.safeParse({ ...body, clubs: [wrong] }).success, JSON.stringify(wrong)).toBe(false)
    }
    const regions = body.regions as Array<Record<string, unknown>>
    expect(workspaceRegionResponseSchema.safeParse({ ...body, regions: [{ ...regions[0], keepers: [{ name: 'Player Two', seat: 'Example Seat', email: 'two@example.org' }] }] }).success).toBe(false)
    const thisMonth = body.thisMonth as Record<string, unknown>
    expect(workspaceRegionResponseSchema.safeParse({ ...body, thisMonth: { ...thisMonth, nextCheck: { day: 'Mon, Dec 7', date: 'Mon, Dec 7, 2026', time: '8:00 AM' } } }).success).toBe(false)
  })
})

describe('POST /api/admin/clubs/[id]/confirm keeps its contract', () => {
  it('takes {} and passes an unexpected key through to be ignored, and refuses a body that is not an object', () => {
    expect(confirmContract.request.safeParse({}).success).toBe(true)
    expect(confirmContract.request.parse({ note: 'Example' })).toEqual({ note: 'Example' })
    for (const wrong of [null, [], 'yes', 1]) expect(confirmContract.request.safeParse(wrong).success, JSON.stringify(wrong)).toBe(false)
  })

  it('answers the club\'s rep, the region\'s representative and an LCA admin within it, and each refusal as an error body', async () => {
    const { clubId, holder, admin, rep } = await exampleRegion()
    flags.keepersOn = true
    for (const [who, aal] of [[rep, 'aal1'], [holder, 'aal1'], [admin, 'aal2']] as const) {
      const result = await invoke(confirmPost, { method: 'POST', as: who, aal, params: { id: clubId }, body: {} })
      expect(result.status, who).toBe(200)
      const body = await expectContract(result, confirmContract.response)
      expect(body.id, who).toBe(clubId)
    }
    const stranger = await invoke(confirmPost, { method: 'POST', as: await seedMember(), aal: 'aal1', params: { id: clubId }, body: {} })
    expect(stranger.status).toBe(403)
    await expectContract(stranger, errorBodySchema)
    const missing = await invoke(confirmPost, { method: 'POST', as: admin, params: { id: 'example-no-such-club' }, body: {} })
    expect(missing.status).toBe(404)
    await expectContract(missing, errorBodySchema)
    const notObject = await invoke(confirmPost, { method: 'POST', as: rep, aal: 'aal1', params: { id: clubId }, body: [1] })
    expect(notObject.status).toBe(400)
    await expectContract(notObject, fieldErrorBodySchema)
    flags.keepersOn = false
    const closed = await invoke(confirmPost, { method: 'POST', as: admin, params: { id: clubId }, body: {} })
    expect(closed.status).toBe(403)
    await expectContract(closed, errorBodySchema)
    expect((await invoke(confirmOptions, { method: 'OPTIONS' })).status).toBe(204)
  })
})
