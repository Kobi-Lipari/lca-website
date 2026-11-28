// test/integration/club-reports-region.test.ts
//
// Suggest an update on the keeper's side (WS09 step 28): the open items of
// GET /api/workspace/region, the open suggestions of GET
// /api/admin/clubs/[id] for a keeper of the club, and the wait of Still
// accurate, by the card (POST /api/admin/clubs/[id]/confirm) and by the
// monthly check's emailed link (POST /api/clubs/confirm/[token]), while a
// suggestion is open. With none open, each answers as before. The member
// delete and the club delete of WS09 step 4 are run on rows of this step's
// making. Each case sets CLUB_PAGES_ON and CLUB_KEEPERS_ON itself through a
// getter on a mock of their module; every club, person and address is made
// up.
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { contracts } from '../../domain/contracts'
import { CONFIRM_WAITS, LINK_WAITS } from '../../domain/clubs/suggestion'
import { onRequestPost as suggestPost } from '../../functions/api/clubs/[id]/reports'
import { onRequestPost as resolvePost } from '../../functions/api/admin/clubs/[id]/reports/[reportId]'
import { onRequestGet as regionGet } from '../../functions/api/workspace/region'
import { onRequestPost as confirmPost } from '../../functions/api/admin/clubs/[id]/confirm'
import { onRequestDelete as clubDelete, onRequestGet as adminClubGet } from '../../functions/api/admin/clubs/[id]'
import { onRequestDelete as memberDelete } from '../../functions/api/admin/members/[id]'
import { onRequestPost as linkPost } from '../../functions/api/clubs/confirm/[token]'
import { CONFIRM_PURPOSE, LINK_TTL_SECONDS } from '../../functions/utils/clubs/monthlyCheck'
import { signToken } from '../../functions/utils/tokens'
import { ADDRESS_HEADER } from '../../functions/utils/rateLimit'
import { seedMember } from './factories'
import { expectContract, invoke, resetHarness } from './harness'

const flags = vi.hoisted(() => ({ pagesOn: false, keepersOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})

const KEYED = {
  SIGNING_SECRET: 'example-made-up-signing-key-for-the-wait-00028',
  TURNSTILE_SECRET_KEY: 'example-made-up-spam-check-secret-00028',
}

let seq = 0
const mark = () => `${++seq}${crypto.randomUUID().slice(0, 6)}`
const place = () => (++seq % 2 === 0 ? `198.51.100.${seq % 250}` : `203.0.113.${seq % 250}`)

beforeEach(() => {
  resetHarness()
  flags.pagesOn = false
  flags.keepersOn = false
})
afterEach(() => {
  vi.restoreAllMocks()
})

interface Made { id: string; slug: string; name: string; region: string; holder: string; rep: string }

/** A club in a region of its own, with a rep of its own and one holder of the region's seat. */
async function makeClub(): Promise<Made> {
  const m = mark()
  const club = { id: `club-${m}`, slug: `example-knights-club-${m}`, name: `Example Knights Club ${m}`, region: `Example Region ${m}` }
  await env.DB.prepare(
    `INSERT INTO clubs (id, name, city, slug, region, how_we_meet_text) VALUES (?, ?, 'Example City', ?, ?, 'Tuesdays at 7:00 PM')`,
  ).bind(club.id, club.name, club.slug, club.region).run()
  const holder = await seedMember({ fullName: `Example Rep ${m}`, email: `rep-${m}@example.org` })
  const seat = `seat-${m}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(seat, seat).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(seat, club.region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(seat, holder).run()
  const rep = await seedMember({ fullName: `Example Club Rep ${m}`, email: `club-rep-${m}@example.org`, role: 'club_rep', clubId: club.id })
  return { ...club, holder, rep }
}

/** A suggestion sent as a visitor would, and its id. */
async function suggested(club: Made, over: Record<string, unknown> = {}): Promise<{ id: number; email: string; message: string }> {
  const m = mark()
  const body = { field: 'venue', message: `Player One ${m}: the club meets at the Example Library now.`, email: `player-${m}@example.org`, token: 'example-made-up-token', ...over }
  flags.pagesOn = true
  const result = await invoke(suggestPost, { method: 'POST', params: { id: club.slug }, body, env: KEYED, path: `/api/clubs/${club.slug}/reports`, headers: { [ADDRESS_HEADER]: place() } })
  expect(result.status).toBe(200)
  const row = await env.DB.prepare('SELECT id FROM club_reports WHERE club_id = ? ORDER BY id DESC LIMIT 1').bind(club.id).first<{ id: number }>()
  return { id: row!.id, email: body.email as string, message: body.message }
}

const region = (as: string, aal: 'aal1' | 'aal2' = 'aal1') => invoke(regionGet, { as, aal, path: '/api/workspace/region' })
const cardOf = async (as: string, clubId: string) =>
  (await (await region(as)).json<{ clubs: Array<Record<string, unknown> & { id: string; openItems: unknown[] }> }>()).clubs.find((c) => c.id === clubId)!
const adminClub = (as: string, clubId: string, aal: 'aal1' | 'aal2' = 'aal1') => invoke(adminClubGet, { as, aal, params: { id: clubId }, path: `/api/admin/clubs/${clubId}` })
const confirm = (as: string, clubId: string) => invoke(confirmPost, { method: 'POST', as, aal: 'aal1', params: { id: clubId }, body: {}, path: `/api/admin/clubs/${clubId}/confirm` })
const dismiss = (as: string, clubId: string, reportId: number) =>
  invoke(resolvePost, { method: 'POST', as, aal: 'aal1', params: { id: clubId, reportId: String(reportId) }, body: { action: 'dismiss' }, env: KEYED, path: `/api/admin/clubs/${clubId}/reports/${reportId}` })

describe('the open items', () => {
  it('My region\'s answer fills each club\'s open suggestions with their age in whole days, and never an address', async () => {
    flags.keepersOn = true
    const club = await makeClub()
    const older = await suggested(club, { field: 'meets' })
    const newer = await suggested(club, { email: undefined, field: 'closed' })
    await env.DB.prepare(`UPDATE club_reports SET created_at = datetime('now', '-9 days', '-3 hours') WHERE id = ?`).bind(older.id).run()
    flags.pagesOn = false
    const result = await region(club.holder)
    expect(result.status).toBe(200)
    const body = await expectContract(result, contracts['workspace/region'].GET.response)
    const card = body.clubs.find((c) => c.id === club.id)!
    expect(card.openItems).toEqual([
      { kind: 'suggestion', id: older.id, field: 'meets', message: older.message, hasAddress: true, ageDays: 9 },
      { kind: 'suggestion', id: newer.id, field: 'closed', message: newer.message, hasAddress: false, ageDays: 0 },
    ])
    expect(JSON.stringify(body)).not.toContain(older.email)
    // A resolved suggestion leaves the open items.
    expect((await dismiss(club.holder, club.id, older.id)).status).toBe(200)
    expect((await cardOf(club.holder, club.id)).openItems).toEqual([expect.objectContaining({ id: newer.id })])
  })

  it('with no suggestion each card\'s open items are empty and the card has the keys it had', async () => {
    flags.keepersOn = true
    const club = await makeClub()
    const card = await cardOf(club.holder, club.id)
    expect(card.openItems).toEqual([])
    expect(Object.keys(card)).toEqual([
      'id', 'name', 'city', 'region', 'color', 'logoUrl', 'statement', 'lastConfirmedAt', 'lastCheckWords', 'needsCheck', 'events', 'openItems', 'inReview',
    ])
  })

  it('the admin club answer gives a keeper of the club its open suggestions, only while one is open, and never an address', async () => {
    flags.keepersOn = true
    const club = await makeClub()
    const admin = await seedMember({ role: 'lca_admin', email: `admin-${mark()}@example.org` })
    const observer = await seedMember({ role: 'lca_observer', email: `observer-${mark()}@example.org` })
    const before = await (await adminClub(club.rep, club.id)).json<Record<string, unknown>>()
    expect(Object.keys(before)).not.toContain('openSuggestions')
    const open = await suggested(club)
    for (const [as, aal] of [[club.rep, 'aal1'], [club.holder, 'aal1'], [admin, 'aal2']] as const) {
      const result = await adminClub(as, club.id, aal)
      expect(result.status, as).toBe(200)
      const body = await expectContract(result, contracts['admin/clubs/[id]'].GET.response)
      expect(body.openSuggestions, as).toEqual([{ kind: 'suggestion', id: open.id, field: 'venue', message: open.message, hasAddress: true, ageDays: 0 }])
      expect(JSON.stringify(body), as).not.toContain(open.email)
    }
    // An observer views the club and keeps none of it: no suggestion is answered to them.
    const viewed = await (await adminClub(observer, club.id)).json<Record<string, unknown>>()
    expect(Object.keys(viewed)).not.toContain('openSuggestions')
    expect((await dismiss(club.rep, club.id, open.id)).status).toBe(200)
    expect(Object.keys(await (await adminClub(club.rep, club.id)).json<Record<string, unknown>>())).toEqual(Object.keys(before))
  })
})

describe('Still accurate waits while one is open', () => {
  it('the card\'s Still accurate is refused with "Answer it, then confirm" and stamps nothing, then works once it is answered', async () => {
    flags.keepersOn = true
    const club = await makeClub()
    const open = await suggested(club)
    flags.pagesOn = false
    const refused = await confirm(club.holder, club.id)
    expect(refused.status).toBe(409)
    expect(await refused.json()).toEqual({ error: CONFIRM_WAITS })
    expect(CONFIRM_WAITS).toContain('Answer it, then confirm')
    expect((await env.DB.prepare('SELECT last_confirmed_at FROM clubs WHERE id = ?').bind(club.id).first<{ last_confirmed_at: string | null }>())!.last_confirmed_at).toBeNull()
    expect((await dismiss(club.rep, club.id, open.id)).status).toBe(200)
    expect((await confirm(club.holder, club.id)).status).toBe(200)
  })

  it('the emailed link waits the same way, in words that send the person to My region, and stamps nothing', async () => {
    flags.keepersOn = true
    const club = await makeClub()
    const open = await suggested(club)
    const token = await signToken(KEYED.SIGNING_SECRET, CONFIRM_PURPOSE, { club: club.id, member: club.holder }, LINK_TTL_SECONDS, new Date())
    const post = () => invoke(linkPost, { method: 'POST', params: { token }, body: {}, env: KEYED, path: `/api/clubs/confirm/${token}`, headers: { [ADDRESS_HEADER]: place() } })
    const refused = await post()
    expect(refused.status).toBe(409)
    expect(await refused.json()).toEqual({ error: LINK_WAITS })
    expect(LINK_WAITS).toContain('Log in to My region')
    expect((await env.DB.prepare('SELECT last_confirmed_at FROM clubs WHERE id = ?').bind(club.id).first<{ last_confirmed_at: string | null }>())!.last_confirmed_at).toBeNull()
    expect((await dismiss(club.holder, club.id, open.id)).status).toBe(200)
    expect((await post()).status).toBe(200)
  })
})

describe('the deletes of WS09 step 4, on rows of this step\'s making', () => {
  it('the member delete clears who resolved a suggestion, and the club delete takes the club\'s suggestions with it', async () => {
    flags.keepersOn = true
    const club = await makeClub()
    const admin = await seedMember({ role: 'lca_admin', email: `admin-${mark()}@example.org` })
    const resolved = await suggested(club)
    const open = await suggested(club)
    expect((await dismiss(club.holder, club.id, resolved.id)).status).toBe(200)
    // The audit log keeps a member who acted, as for every audited action (the delete's own note); its entry is
    // taken away here so the delete of the member who resolved the suggestion can run.
    await env.DB.prepare(`DELETE FROM admin_audit_log WHERE actor_id = ?`).bind(club.holder).run()
    expect((await invoke(memberDelete, { method: 'DELETE', as: admin, params: { id: club.holder } })).status).toBe(200)
    const rows = (await env.DB.prepare('SELECT id, status, resolved_by, message FROM club_reports WHERE club_id = ? ORDER BY id').bind(club.id).all()).results
    expect(rows).toEqual([
      { id: resolved.id, status: 'dismissed', resolved_by: null, message: resolved.message },
      { id: open.id, status: 'open', resolved_by: null, message: open.message },
    ])
    expect((await invoke(clubDelete, { method: 'DELETE', as: admin, params: { id: club.id } })).status).toBe(200)
    expect((await env.DB.prepare('SELECT COUNT(*) AS n FROM club_reports WHERE club_id = ?').bind(club.id).first<{ n: number }>())!.n).toBe(0)
  })
})
