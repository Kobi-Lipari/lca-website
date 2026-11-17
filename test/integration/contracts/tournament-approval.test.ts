// test/integration/contracts/tournament-approval.test.ts
//
// POST /api/admin/tournaments/[id]/approval keeps its contract
// (domain/contracts/events.ts), given in WS09 step 18 with the endpoint, which
// never joined test/unit/contracts-pending.ts:
// - each move's answer is the event's four approval columns and the email's
//   words, every key named and nothing more;
// - the request is strict and read through parseBody: the action one of three,
//   a note only with Ask for changes and required there, and an unknown key
//   refused, each with parseBody's field errors; a body that is not JSON gets
//   parseBody's own words;
// - the answer's contract refuses a key it does not name;
// - the refusals keep the plain { error } body.
// REGION_EVENTS_ON, false in the tree, is read through a getter on its own
// module.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts, errorBodySchema, fieldErrorBodySchema } from '../../../domain/contracts'
import { onRequestPost as approval } from '../../../functions/api/admin/tournaments/[id]/approval'
import { seedAdmin, seedClub, seedMember, seedTournament } from '../factories'
import { expectContract, invoke, resetHarness } from '../harness'
import { noWaits } from '../mailRuns'

const flags = vi.hoisted(() => ({ regionOn: false }))
vi.mock('../../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get REGION_EVENTS_ON() {
      return flags.regionOn
    },
  }
})

beforeEach(() => {
  resetHarness()
  flags.regionOn = true
  noWaits()
})
afterEach(() => {
  flags.regionOn = false
  vi.restoreAllMocks()
})

const move = contracts['admin/tournaments/[id]/approval'].POST

let seq = 0
/** A club event marked for an LCA admin's approval, drafted by a member who holds the region's seat. */
async function world() {
  const admin = await seedAdmin()
  const club = await seedClub({ name: 'Example Chess Club' })
  await env.DB.prepare("UPDATE clubs SET region = 'Example Bayou Region' WHERE id = ?").bind(club).run()
  const drafter = await seedMember({ fullName: 'Player One', email: `player.one.${++seq}@example.org` })
  const seat = `seat-contract-${seq}`
  await env.DB.prepare("INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)").bind(seat, seat).run()
  await env.DB.prepare("INSERT INTO seat_regions (seat_id, region) VALUES (?, 'Example Bayou Region')").bind(seat).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (id, seat_id, member_id) VALUES (?, ?, ?)').bind(`term-${seat}`, seat, drafter).run()
  const event = await seedTournament({ name: 'Example Winter Open', date: '2026-12-12', clubId: club, createdBy: drafter, entryFee: 0, sections: [{ name: 'Open', entryFee: 0 }], isVisible: false })
  await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1 WHERE id = ?').bind(event).run()
  return { admin, drafter, event }
}

const post = (as: string, id: string, body: unknown) => invoke(approval, { method: 'POST', as, params: { id }, body })

describe('the approval endpoint keeps its contract', () => {
  it('submit answers the four columns and the email\'s words under its contract, and the request its contract gives', async () => {
    const { drafter, event } = await world()
    const body = { action: 'submit' }
    expect(move.request.safeParse(body).success).toBe(true)
    const res = await post(drafter, event, body)
    expect(res.status).toBe(200)
    const answer = await expectContract(res, move.response)
    expect(Object.keys(answer).sort()).toEqual(['approval_requested_at', 'approved_at', 'approved_by', 'email', 'needs_lca_approval'])
    expect(answer).toMatchObject({ needs_lca_approval: 1, approved_at: null, approved_by: null })
  })

  it('approve answers under its contract, with the approver\'s id the one person\'s id it carries', async () => {
    const { admin, event } = await world()
    const answer = await expectContract(await post(admin, event, { action: 'approve' }), move.response)
    expect(answer.approved_by).toBe(admin)
    expect(answer.approved_at).not.toBeNull()
  })

  it('ask for changes answers under its contract, with the note trimmed on the way in', async () => {
    const { admin, drafter, event } = await world()
    await post(drafter, event, { action: 'submit' })
    const body = { action: 'ask_changes', note: '  Add the time control.  ' }
    const parsed = move.request.safeParse(body)
    expect(parsed.success && parsed.data).toEqual({ action: 'ask_changes', note: 'Add the time control.' })
    const answer = await expectContract(await post(admin, event, body), move.response)
    expect(answer.approval_requested_at).toBeNull()
  })

  it('reads a strict request through parseBody: an unknown key, a note on submit or approve, no note or no action, and a body that is not JSON are each 400', async () => {
    const { admin, event } = await world()
    for (const body of [
      { action: 'submit', extra: true },
      { action: 'submit', note: 'Example note' },
      { action: 'approve', note: 'Example note' },
      { action: 'ask_changes' },
      { action: 'ask_changes', note: 'Example note', extra: 1 },
      { action: 'publish' },
      {},
    ]) {
      expect(move.request.safeParse(body).success, JSON.stringify(body)).toBe(false)
      const res = await post(admin, event, body)
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect((await expectContract(res, fieldErrorBodySchema)).error).toBe('Some fields are missing or not valid.')
    }
    const raw = await invoke(approval, { method: 'POST', as: admin, params: { id: event }, rawBody: 'not json' })
    expect(raw.status).toBe(400)
    expect(await expectContract(raw, fieldErrorBodySchema)).toEqual({ error: 'Invalid JSON body', fields: { body: 'The body is not valid JSON.' } })
  })

  it('the answer\'s contract refuses a key it does not name, and a missing email\'s words', () => {
    const good = { needs_lca_approval: 1, approval_requested_at: null, approved_at: null, approved_by: null, email: 'Example words.' }
    expect(move.response.safeParse(good).success).toBe(true)
    expect(move.response.safeParse({ ...good, created_by: 'mem-1' }).success).toBe(false)
    expect(move.response.safeParse({ ...good, email: '' }).success).toBe(false)
  })

  it('keeps the plain { error } body on its refusals: 403, 404 and 409', async () => {
    const { admin, event } = await world()
    const member = await seedMember()
    await expectContract(await post(member, event, { action: 'approve' }), errorBodySchema)
    await expectContract(await post(admin, 'no-such-event', { action: 'approve' }), errorBodySchema)
    await post(admin, event, { action: 'approve' })
    const again = await post(admin, event, { action: 'approve' })
    expect(again.status).toBe(409)
    await expectContract(again, errorBodySchema)
  })
})
