// test/integration/region-events-agreement.test.ts
//
// The pages draw only what the server says (WS09 step 19), so what the
// server says must be what the server then does. Each case here asks one
// answer, then makes the move or the create it speaks of, for every kind of
// person, and holds the two together:
// - GET /api/admin/tournaments/[id]/manage's `approval` against what
//   POST /api/admin/tournaments/[id]/approval then does with submit, approve
//   and ask for changes, and what each of them answers to a person who is
//   refused (the error alone, never the event);
// - GET /api/admin/clubs/[id]'s `eventRights.add` against what
//   POST /api/admin/tournaments then does, with CREATION_ROLES_ON unset and
//   set, and its mark on a representative's event;
// - after a move, the manage answer's `approval` as the page redraws it,
//   with the email's outcome in the answer when the send goes and when it
//   fails;
// - GET /api/workspace/region's `inReview` for a club in another region, an
//   event with no club and a region with no clubs.
// These cases send mail, so they set the mail switches themselves, through
// getters on the mocked module, and run under one rule: MAIL_LISTS_ON set
// and MAIL_SENDER 'resend', the rule the mail stream turns on, under which a
// failed send reads as in functions/utils/mail/outcome.ts (classifyOnce).
// They do not read the switches as they ship. Every club, region, person and
// event is made up ("Example Knights Club", "Player One", example.org).
import { env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMAIL_WORDS, onRequestPost as approval } from '../../functions/api/admin/tournaments/[id]/approval'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestGet as clubGet } from '../../functions/api/admin/clubs/[id]'
import { onRequestGet as regionGet } from '../../functions/api/workspace/region'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { workspaceRegionResponseSchema } from '../../domain/contracts/clubs'
import type { WorkspaceRegionResponse } from '../../domain/contracts/clubs'
import { emailBehavior, emailOutbox, invoke, resetHarness, type Aal } from './harness'
import { noWaits } from './mailRuns'
import { seedAdmin, seedClub, seedMember, seedTournament, seedTournamentDirector } from './factories'

const flags = vi.hoisted(() => ({ keepersOn: true, regionOn: true, rolesOn: false, listsOn: true }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
    get REGION_EVENTS_ON() {
      return flags.regionOn
    },
  }
})
vi.mock('../../functions/utils/events/creation', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/events/creation')>()
  return {
    ...real,
    get CREATION_ROLES_ON() {
      return flags.rolesOn
    },
  }
})
vi.mock('../../functions/utils/mail/switches', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/mail/switches')>()
  return {
    ...real,
    get MAIL_LISTS_ON() {
      return flags.listsOn
    },
    get MAIL_SENDER() {
      return 'resend' as const
    },
  }
})

beforeEach(() => {
  resetHarness()
  flags.keepersOn = true
  flags.regionOn = true
  flags.rolesOn = false
  flags.listsOn = true
  noWaits()
})
afterEach(() => {
  flags.keepersOn = false
  flags.regionOn = false
  flags.rolesOn = false
  vi.restoreAllMocks()
})

let seq = 0
const newRegion = () => `Example Region ${crypto.randomUUID().slice(0, 8)}`

async function seat(memberId: string, region: string): Promise<void> {
  const id = `seat-agree-${++seq}-${crypto.randomUUID().slice(0, 6)}`
  await env.DB.prepare("INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active) VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)").bind(id, id).run()
  await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(id, memberId).run()
}

/** One made-up club in its own region and a person of every kind around it. */
async function people() {
  const region = newRegion()
  const clubId = await seedClub({ name: 'Example Knights Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(region, clubId).run()
  const representative = await seedMember({ fullName: 'Player One', email: `player.one.${++seq}@example.org` })
  await seat(representative, region)
  const otherRegion = await seedMember({ fullName: 'Player Two', email: `player.two.${seq}@example.org` })
  await seat(otherRegion, newRegion())
  const otherClub = await seedClub({ name: 'Example Rooks Club' })
  return {
    region,
    clubId,
    representative,
    otherRegion,
    ownRep: await seedMember({ role: 'club_rep', clubId, fullName: 'Player Three', email: `player.three.${seq}@example.org` }),
    otherClubRep: await seedMember({ role: 'club_rep', clubId: otherClub, fullName: 'Player Seven', email: `player.seven.${seq}@example.org` }),
    observer: await seedMember({ role: 'lca_observer', fullName: 'Player Four', email: `player.four.${seq}@example.org` }),
    member: await seedMember({ fullName: 'Player Five', email: `player.five.${seq}@example.org` }),
    director: await seedMember({ fullName: 'Player Six', email: `player.six.${seq}@example.org` }),
    admin: await seedAdmin(),
  }
}
type World = Awaited<ReturnType<typeof people>>
const aalOf = (who: string, w: World): Aal => (who === w.admin ? 'aal2' : 'aal1')
const kinds = (w: World): Array<[string, string]> => [
  ['the region\'s representative', w.representative],
  ['an LCA admin', w.admin],
  ['the club\'s own rep', w.ownRep],
  ['a named director', w.director],
  ['an observer', w.observer],
  ['another region\'s representative', w.otherRegion],
  ['another club\'s rep', w.otherClubRep],
  ['a plain member', w.member],
]

/** An event drafted by the representative in the state asked, with the director named on it. */
async function drafted(w: World, state: 'draft' | 'review'): Promise<string> {
  const id = await seedTournament({ clubId: w.clubId, createdBy: w.representative, isVisible: false, entryFee: 0, sections: [{ name: 'Open', entryFee: 0 }], name: `Example Club Quads ${++seq}` })
  await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1, approval_requested_at = ? WHERE id = ?').bind(state === 'review' ? '2026-11-14 18:00:00' : null, id).run()
  await seedTournamentDirector(id, w.director)
  return id
}

const manage = (as: string, id: string, aal: Aal = 'aal1') => invoke(manageGet, { as, aal, params: { id } })
const move = (as: string, id: string, body: unknown, aal: Aal = 'aal1') => invoke(approval, { method: 'POST', as, aal, params: { id }, body })
const columns = (id: string) => env.DB.prepare('SELECT needs_lca_approval, approval_requested_at, approved_at, is_visible FROM tournaments WHERE id = ?').bind(id).first<{
  needs_lca_approval: number; approval_requested_at: string | null; approved_at: string | null; is_visible: number
}>()

describe('the manage answer\'s approval against the approval endpoint, for every kind of person', () => {
  it('lets submit through for exactly the people whose answer says maySubmit, and refuses the rest with the error alone', async () => {
    const w = await people()
    for (const [label, who] of kinds(w)) {
      const id = await drafted(w, 'draft')
      const read = await manage(who, id, aalOf(who, w))
      let maySubmit = false
      if (read.status === 200) maySubmit = (await read.json<{ approval: { maySubmit: boolean } }>()).approval.maySubmit
      else expect(read.status, label).toBe(403)
      const before = await columns(id)
      const res = await move(who, id, { action: 'submit' }, aalOf(who, w))
      const body = await res.json<Record<string, unknown>>()
      if (maySubmit) {
        expect(res.status, label).toBe(200)
        expect(await columns(id), label).toMatchObject({ needs_lca_approval: 1, approval_requested_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2} /) })
      } else {
        expect([401, 403], label).toContain(res.status)
        expect(Object.keys(body), label).toEqual(['error'])
        expect(await columns(id), label).toEqual(before)
      }
    }
  })

  it('lets approve and ask for changes through for exactly the people whose answer says mayDecide, and changes nothing for the rest', async () => {
    const w = await people()
    for (const action of ['approve', 'ask_changes'] as const) {
      for (const [label, who] of kinds(w)) {
        const id = await drafted(w, 'review')
        const read = await manage(who, id, aalOf(who, w))
        let mayDecide = false
        if (read.status === 200) mayDecide = (await read.json<{ approval: { mayDecide: boolean } }>()).approval.mayDecide
        const before = await columns(id)
        const res = await move(who, id, action === 'approve' ? { action } : { action, note: 'Please give the round times.' }, aalOf(who, w))
        const name = `${action} by ${label}`
        if (mayDecide) {
          expect(res.status, name).toBe(200)
        } else {
          expect([401, 403], name).toContain(res.status)
          expect(Object.keys(await res.json<Record<string, unknown>>()), name).toEqual(['error'])
          expect(await columns(id), name).toEqual(before)
        }
      }
    }
  })

  it('without the second factor an LCA admin\'s move is refused whatever the manage answer said, and nothing moves', async () => {
    const w = await people()
    const id = await drafted(w, 'review')
    expect((await (await manage(w.admin, id, 'aal2')).json<{ approval: { mayDecide: boolean } }>()).approval.mayDecide).toBe(true)
    const before = await columns(id)
    const res = await move(w.admin, id, { action: 'approve' }, 'aal1')
    expect([401, 403]).toContain(res.status)
    expect(await columns(id)).toEqual(before)
    expect(emailOutbox).toHaveLength(0)
  })

  it('answers, after each move, a manage answer that matches the answer to the move, so the page redraws one way from either', async () => {
    const w = await people()
    const id = await drafted(w, 'draft')
    const sent = await move(w.representative, id, { action: 'submit' })
    expect(sent.status).toBe(200)
    const answer = await sent.json<{ needs_lca_approval: number; approval_requested_at: string | null; approved_at: string | null; email: string }>()
    expect(answer.email).toBe(EMAIL_WORDS.reviewSent)
    expect(emailOutbox.length).toBeGreaterThan(0)
    const read = await (await manage(w.representative, id)).json<{ tournament: Record<string, unknown>; approval: unknown }>()
    expect(read.tournament).toMatchObject({ needs_lca_approval: answer.needs_lca_approval, approval_requested_at: answer.approval_requested_at, approved_at: answer.approved_at })
    // In review the drafter may still press Submit (the endpoint answers that it is already waiting and sends no second email), so the
    // server's answer keeps it true and the page draws Submit from a draft alone; an LCA admin may also approve and ask for changes.
    expect(read.approval).toEqual({ maySubmit: true, mayDecide: false })
    expect((await (await manage(w.admin, id, 'aal2')).json<{ approval: unknown }>()).approval).toEqual({ maySubmit: true, mayDecide: true })
    const again = await move(w.representative, id, { action: 'submit' })
    expect(again.status).toBe(200)
    expect((await again.json<{ email: string }>()).email).toBe(EMAIL_WORDS.alreadyInReview)
    const approved = await move(w.admin, id, { action: 'approve' }, 'aal2')
    expect(approved.status).toBe(200)
    expect((await approved.json<{ email: string }>()).email).toBe(EMAIL_WORDS.approvedSent)
    for (const who of [w.representative, w.admin]) {
      expect((await (await manage(who, id, aalOf(who, w))).json<{ approval: unknown }>()).approval, who).toEqual({ maySubmit: false, mayDecide: false })
    }
    // A replay of the move the page just made changes nothing and sends nothing.
    const sentBefore = emailOutbox.length
    const rowBefore = await columns(id)
    const replay = await move(w.admin, id, { action: 'approve' }, 'aal2')
    expect(replay.status).toBe(409)
    expect(emailOutbox).toHaveLength(sentBefore)
    expect(await columns(id)).toEqual(rowBefore)
  })

  it('moves the event and says in words that the email did not go, when the send fails, so the page can show the answer as it comes', async () => {
    const w = await people()
    emailBehavior.succeed = false
    const id = await drafted(w, 'draft')
    const sent = await move(w.representative, id, { action: 'submit' })
    expect(sent.status).toBe(200)
    expect((await sent.json<{ email: string }>()).email).toBe(EMAIL_WORDS.reviewNotSent)
    expect(await columns(id)).toMatchObject({ approval_requested_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2} /) })
    const asked = await move(w.admin, id, { action: 'ask_changes', note: 'Please give the round times.' }, 'aal2')
    expect(asked.status).toBe(200)
    expect((await asked.json<{ email: string }>()).email).toBe(EMAIL_WORDS.changesNotSent)
    expect(await columns(id)).toMatchObject({ approval_requested_at: null })
    // The page's next read says the same thing the move said: a draft again, to be submitted again.
    expect((await (await manage(w.representative, id)).json<{ approval: unknown }>()).approval).toEqual({ maySubmit: true, mayDecide: false })
    emailBehavior.succeed = true
    const resent = await move(w.representative, id, { action: 'submit' })
    expect((await resent.json<{ email: string }>()).email).toBe(EMAIL_WORDS.reviewSent)
  })
})

describe('the club answer\'s eventRights.add against the create, for every kind of person the club answer admits', () => {
  async function createFor(who: string, w: World, aal: Aal) {
    return invoke(createTournament, {
      method: 'POST', as: who, aal,
      body: { name: `Example Club Quads ${++seq}`, location: 'Example City', date: '2027-02-06', entryFee: 0, clubId: w.clubId },
    })
  }

  for (const rolesOn of [false, true]) {
    it(`admits a create exactly where the answer says yes or for_approval, and marks only the region's representative's, with CREATION_ROLES_ON ${rolesOn ? 'set' : 'unset'}`, async () => {
      flags.rolesOn = rolesOn
      const w = await people()
      let checked = 0
      for (const [label, who] of kinds(w)) {
        const read = await invoke(clubGet, { as: who, aal: aalOf(who, w), params: { id: w.clubId } })
        if (read.status !== 200) {
          // The club answer gives no one the data it refuses, and the create refuses the same people.
          expect(read.status, label).toBe(403)
          expect(Object.keys(await read.json<Record<string, unknown>>()), label).toEqual(['error'])
          const made = await createFor(who, w, aalOf(who, w))
          expect([401, 403], label).toContain(made.status)
          continue
        }
        const rights = (await read.json<{ eventRights: { add: 'no' | 'yes' | 'for_approval'; askPayout: boolean } }>()).eventRights
        expect(rights.askPayout, label).toBe(rolesOn)
        const made = await createFor(who, w, aalOf(who, w))
        if (rights.add === 'no') {
          expect([401, 403], label).toContain(made.status)
        } else {
          expect(made.status, label).toBe(201)
          const created = (await made.json<{ tournament: { needs_lca_approval: number; club_id: string | null; entry_fee: number } }>()).tournament
          expect(created.club_id, label).toBe(w.clubId)
          expect(created.needs_lca_approval, label).toBe(rights.add === 'for_approval' ? 1 : 0)
          expect(created.entry_fee, label).toBe(0)
        }
        checked++
      }
      // At least the LCA admin, the club's rep and the region's representative were admitted and held to it.
      expect(checked).toBeGreaterThanOrEqual(3)
    })
  }

  it('refuses a representative\'s fee above $0 whatever the creation roles switch says, so the notice\'s ask is never the way around the server', async () => {
    for (const rolesOn of [false, true]) {
      flags.rolesOn = rolesOn
      const w = await people()
      const res = await invoke(createTournament, {
        method: 'POST', as: w.representative, aal: 'aal1',
        body: { name: 'Example Paid Quads', location: 'Example City', date: '2027-02-06', entryFee: 25, clubId: w.clubId },
      })
      expect(res.status, String(rolesOn)).toBe(403)
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM tournaments WHERE name = ?').bind('Example Paid Quads').first<{ n: number }>()
      expect(count?.n, String(rolesOn)).toBe(0)
    }
  })
})

describe('GET /api/workspace/region\'s count of events in LCA review: whose events it counts', () => {
  async function marked(clubId: string | null, requested: string | null, approved: string | null = null): Promise<void> {
    const id = await seedTournament({ clubId, isVisible: false, name: `Example Club Quads ${++seq}` })
    await env.DB.prepare('UPDATE tournaments SET needs_lca_approval = 1, approval_requested_at = ?, approved_at = ? WHERE id = ?').bind(requested, approved, id).run()
  }
  const answerFor = async (who: string, aal: Aal = 'aal1') => {
    const res = await invoke(regionGet, { as: who, aal })
    expect(res.status).toBe(200)
    const body = await res.json<WorkspaceRegionResponse>()
    expect(workspaceRegionResponseSchema.safeParse(body).success).toBe(true)
    return body
  }

  it('leaves out the events of a club in another region and an event with no club, and counts the club\'s own', async () => {
    const w = await people()
    const elsewhere = await seedClub({ name: 'Example Bishops Club' })
    await env.DB.prepare('UPDATE clubs SET region = ? WHERE id = ?').bind(newRegion(), elsewhere).run()
    await marked(w.clubId, '2026-11-14 18:00:00')
    await marked(elsewhere, '2026-11-14 18:00:00')
    await marked(elsewhere, '2026-11-14 18:00:00')
    await marked(null, '2026-11-14 18:00:00')
    const read = await answerFor(w.representative)
    expect(read.clubs.map((c) => c.id)).toEqual([w.clubId])
    expect(read.clubs[0].inReview).toBe(1)
    expect(read.thisMonth.inReview).toBe(1)
    // The other region's representative sees the other club's two and none of this club's.
    const other = await answerFor(w.otherRegion)
    expect(other.clubs.some((c) => c.id === w.clubId)).toBe(false)
    expect(other.thisMonth.inReview).toBe(0)
  })

  it('gives a region with no club a bar of none, and a club whose only event was approved or never sent no count', async () => {
    const w = await people()
    const empty = await seedMember({ fullName: 'Player Eight' })
    await seat(empty, newRegion())
    const none = await answerFor(empty)
    expect(none.clubs).toEqual([])
    expect(none.thisMonth.inReview).toBe(0)
    await marked(w.clubId, '2026-11-14 18:00:00', '2026-11-16 15:00:00')
    await marked(w.clubId, null)
    const read = await answerFor(w.representative)
    expect(read.clubs[0].inReview).toBe(0)
    expect(read.thisMonth.inReview).toBe(0)
  })

  it('moves with the approval endpoint: one more in review after a submit, one fewer after an approval or a request for changes', async () => {
    const w = await people()
    const first = await drafted(w, 'draft')
    const second = await drafted(w, 'draft')
    expect((await answerFor(w.representative)).thisMonth.inReview).toBe(0)
    expect((await move(w.representative, first, { action: 'submit' })).status).toBe(200)
    expect((await move(w.representative, second, { action: 'submit' })).status).toBe(200)
    let read = await answerFor(w.representative)
    expect(read.clubs[0].inReview).toBe(2)
    expect(read.thisMonth.inReview).toBe(2)
    expect((await move(w.admin, first, { action: 'approve' }, 'aal2')).status).toBe(200)
    read = await answerFor(w.representative)
    expect(read.thisMonth.inReview).toBe(1)
    expect((await move(w.admin, second, { action: 'ask_changes', note: 'Please give the round times.' }, 'aal2')).status).toBe(200)
    read = await answerFor(w.representative)
    expect(read.clubs[0].inReview).toBe(0)
    expect(read.thisMonth.inReview).toBe(0)
  })

  it('gives no one the count while the constant is unset, and the same refusals as before to a member with no seat', async () => {
    const w = await people()
    await drafted(w, 'review')
    flags.regionOn = false
    const body = await answerFor(w.representative)
    expect(body.clubs[0].inReview).toBeUndefined()
    expect(body.thisMonth.inReview).toBeUndefined()
    flags.regionOn = true
    const refused = await invoke(regionGet, { as: w.member, aal: 'aal1' })
    expect(refused.status).toBe(403)
    expect(Object.keys(await refused.json<Record<string, unknown>>())).toEqual(['error'])
  })
})
