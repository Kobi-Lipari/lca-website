// test/integration/review-mark-answers.test.ts
//
// The review mark, tournaments.review_notified_at (WS08 step 2), through the
// real handlers on the database every integration test runs on, built from
// every migration, 0059 included, with the mark stored as D1's
// datetime('now') writes it:
// - every answer that carries a tournament answers the mark, as stored, to
//   the event's managers: the list and the event page to an LCA admin, an
//   observer, an officer, the organizing club's rep and an assigned
//   director; the manage page to the same; the edit and the registration
//   settings to those of them who may save;
// - no one else is answered the key or the mark: a visitor, a session that
//   fails, a plain member, a member of the organizing club, an auditor,
//   another club's rep, a standing director with no assignment, a guest
//   assigned to direct the event and the event's creator once they no
//   longer run it find neither in the list or the event page, a 404 for the
//   hidden draft, and 401 or 403 with none of it from the manage page, the
//   edit and the registration settings, as do the observer and the officer
//   from the two saves, which they may not make;
// - no request writes the mark: the create, an edit, unpublishing and
//   publishing again, and the registration settings leave it as stored (or
//   NULL), whatever the body says, so only the notice of WS08 step 6 can
//   set it;
// - with every switch off a publish writes no mark and sends no email,
//   whoever publishes, as today.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts'
import { onRequestPost as createTournament } from '../../functions/api/admin/tournaments'
import { onRequestPatch as tournamentPatch } from '../../functions/api/admin/tournaments/[id]'
import { onRequestGet as manageGet } from '../../functions/api/admin/tournaments/[id]/manage'
import { onRequestPatch as registrationPatch } from '../../functions/api/admin/tournaments/[id]/registration'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import { onRequestGet as tournamentGet } from '../../functions/api/tournaments/[id]'
import { seedAdmin, seedClub, seedDirector, seedMember, seedTournament, seedTournamentDirector } from './factories'
import { emailOutbox, expectContract, flushWaitUntil, invoke, resetHarness } from './harness'

beforeEach(resetHarness)

const listContract = contracts['tournaments'].GET
const detailContract = contracts['tournaments/[id]'].GET
const manageContract = contracts['admin/tournaments/[id]/manage'].GET
const createContract = contracts['admin/tournaments'].POST
const editContract = contracts['admin/tournaments/[id]'].PATCH
const settingsContract = contracts['admin/tournaments/[id]/registration'].PATCH

const KEY = 'review_notified_at'

const markOf = async (tournamentId: string) =>
  (await env.DB.prepare('SELECT review_notified_at FROM tournaments WHERE id = ?').bind(tournamentId).first<{ review_notified_at: string | null }>())!.review_notified_at

const auditCount = async (action: string, tournamentId: string) =>
  (await env.DB.prepare(`SELECT COUNT(*) AS n FROM admin_audit_log WHERE action = ? AND detail LIKE ?`).bind(action, `%${tournamentId}%`).first<{ n: number }>())!.n

interface Viewer {
  label: string
  as?: string
  headers?: Record<string, string>
  /** Whether this viewer manages each of the club's events (the event and its draft) and the LCA-run one, written out by hand. */
  manages: { club: boolean; lca: boolean }
  /** Whether this viewer may save the club's event (requireTournamentManager), written out by hand. */
  saves: boolean
}

/**
 * A club's visible event and hidden draft and an LCA-run event, each marked
 * two hours ago as datetime('now') writes it, and fourteen kinds of viewer.
 * The club's rep who made the club's two has since handed the club over and
 * is a plain member again.
 */
async function seedMarkedEvents() {
  const clubId = await seedClub({ name: 'Acadiana Knights', city: 'Lafayette' })
  const otherClub = await seedClub({ name: 'Delta Rooks', city: 'Monroe' })
  const creator = await seedMember({ role: 'club_rep', clubId, fullName: 'Casey Creator' })
  const event = await seedTournament({ clubId, name: 'Acadiana Winter Quads', createdBy: creator })
  const draft = await seedTournament({ clubId, name: 'Acadiana Spring Swiss', createdBy: creator, isVisible: false })
  const lcaEvent = await seedTournament({ name: 'Louisiana Open' })
  await env.DB.prepare(`UPDATE members SET role = 'member' WHERE id = ?`).bind(creator).run()
  await env.DB.prepare(`UPDATE tournaments SET review_notified_at = datetime('now', '-2 hours') WHERE id IN (?, ?, ?)`).bind(event, draft, lcaEvent).run()
  const mark = (await markOf(event))!

  const director = await seedMember({ fullName: 'Dana Director' })
  for (const id of [event, draft, lcaEvent]) await seedTournamentDirector(id, director)
  const guest = await seedMember({ role: 'guest' })
  await seedTournamentDirector(event, guest)

  const nobody = { club: false, lca: false }
  const everything = { club: true, lca: true }
  const viewers: Viewer[] = [
    { label: 'signed out', manages: nobody, saves: false },
    { label: 'a session that fails', headers: { Authorization: 'Bearer invalid-session' }, manages: nobody, saves: false },
    { label: 'a plain member', as: await seedMember(), manages: nobody, saves: false },
    { label: 'a member of the organizing club', as: await seedMember({ clubId }), manages: nobody, saves: false },
    { label: 'an auditor', as: await seedMember({ role: 'lca_auditor' }), manages: nobody, saves: false },
    { label: 'another club\'s rep', as: await seedMember({ role: 'club_rep', clubId: otherClub }), manages: nobody, saves: false },
    { label: 'a standing director with no assignment', as: await seedDirector(), manages: nobody, saves: false },
    { label: 'a guest assigned to direct the event', as: guest, manages: nobody, saves: false },
    { label: 'the creator, no longer the club\'s rep', as: creator, manages: nobody, saves: false },
    { label: 'the organizing club\'s rep', as: await seedMember({ role: 'club_rep', clubId }), manages: { club: true, lca: false }, saves: true },
    { label: 'a member assigned to direct all three', as: director, manages: everything, saves: true },
    { label: 'an LCA admin', as: await seedAdmin(), manages: everything, saves: true },
    { label: 'an observer', as: await seedMember({ role: 'lca_observer' }), manages: everything, saves: false },
    { label: 'an officer', as: await seedMember({ role: 'lca_officer' }), manages: everything, saves: false },
  ]
  return { event, draft, lcaEvent, mark, viewers }
}

const signIn = (viewer: Viewer) => ({ as: viewer.as, headers: viewer.headers })
const managesNone = (viewer: Viewer) => !viewer.manages.club && !viewer.manages.lca

describe('every answer that carries a tournament answers the mark to the event\'s managers alone', () => {
  it('the list: each row carries the mark, as stored, when the viewer manages that event, and no row carries a trace of it otherwise', async () => {
    const { event, draft, lcaEvent, mark, viewers } = await seedMarkedEvents()
    for (const viewer of viewers) {
      const result = await invoke(tournamentsGet, { ...signIn(viewer), path: '/api/tournaments' })
      expect(result.status, viewer.label).toBe(200)
      const rows = (await expectContract(result, listContract.response)).tournaments
      const rowOf = (id: string) => rows.find((t) => t.id === id)
      for (const [id, manages] of [[event, viewer.manages.club], [lcaEvent, viewer.manages.lca]] as const) {
        const row = rowOf(id)
        expect(row, `${viewer.label}: ${id}`).toBeDefined()
        if (manages) expect(row![KEY], `${viewer.label}: ${id}`).toBe(mark)
        else expect(Object.hasOwn(row!, KEY), `${viewer.label}: ${id}`).toBe(false)
      }
      if (viewer.manages.club) expect(rowOf(draft)?.[KEY], viewer.label).toBe(mark)
      else expect(rowOf(draft), viewer.label).toBeUndefined()
      if (managesNone(viewer)) {
        const text = await result.response.text()
        expect(text, viewer.label).not.toContain(KEY)
        expect(text, viewer.label).not.toContain(mark)
      }
    }
  })

  it('the event page: its managers get the mark, as stored; anyone else gets the visible event without it and a 404 for the draft, with no trace of it', async () => {
    const { event, draft, mark, viewers } = await seedMarkedEvents()
    for (const viewer of viewers) {
      for (const id of [event, draft]) {
        const result = await invoke(tournamentGet, { ...signIn(viewer), params: { id } })
        if (viewer.manages.club) {
          expect(result.status, `${viewer.label}: ${id}`).toBe(200)
          expect((await expectContract(result, detailContract.response)).tournament[KEY], `${viewer.label}: ${id}`).toBe(mark)
          continue
        }
        if (id === event) {
          expect(result.status, viewer.label).toBe(200)
          expect(Object.hasOwn((await expectContract(result, detailContract.response)).tournament, KEY), viewer.label).toBe(false)
        } else {
          expect(result.status, viewer.label).toBe(404)
        }
        const text = await result.response.text()
        expect(text, `${viewer.label}: ${id}`).not.toContain(KEY)
        expect(text, `${viewer.label}: ${id}`).not.toContain(mark)
      }
    }
  })

  it('the manage page: its managers get the mark, as stored; everyone else 401 or 403 with none of it', async () => {
    const { event, lcaEvent, mark, viewers } = await seedMarkedEvents()
    for (const viewer of viewers) {
      for (const [id, manages] of [[event, viewer.manages.club], [lcaEvent, viewer.manages.lca]] as const) {
        const result = await invoke(manageGet, { ...signIn(viewer), params: { id } })
        if (manages) {
          expect(result.status, `${viewer.label}: ${id}`).toBe(200)
          expect((await expectContract(result, manageContract.response)).tournament[KEY], `${viewer.label}: ${id}`).toBe(mark)
          continue
        }
        expect(result.status, `${viewer.label}: ${id}`).toBe(viewer.as ? 403 : 401)
        const text = await result.response.text()
        expect(text, `${viewer.label}: ${id}`).not.toContain(KEY)
        expect(text, `${viewer.label}: ${id}`).not.toContain(mark)
      }
    }
  })

  it('the edit and the registration settings: those who may save get the mark back, as stored and kept; everyone else 401 or 403, with none of it and nothing written', async () => {
    const { event, mark, viewers } = await seedMarkedEvents()
    for (const viewer of viewers) {
      const edit = await invoke(tournamentPatch, { ...signIn(viewer), method: 'PATCH', params: { id: event }, body: { description: `Saved by ${viewer.label}.` } })
      const settings = await invoke(registrationPatch, { ...signIn(viewer), method: 'PATCH', params: { id: event }, body: { reminder_2_enabled: false } })
      if (viewer.saves) {
        expect([edit.status, settings.status], viewer.label).toEqual([200, 200])
        expect((await expectContract(edit, editContract.response)).tournament[KEY], viewer.label).toBe(mark)
        expect((await expectContract(settings, settingsContract.response)).tournament[KEY], viewer.label).toBe(mark)
      } else {
        const refused = viewer.as ? 403 : 401
        expect([edit.status, settings.status], viewer.label).toEqual([refused, refused])
        for (const text of [await edit.response.text(), await settings.response.text()]) {
          expect(text, viewer.label).not.toContain(KEY)
          expect(text, viewer.label).not.toContain(mark)
        }
      }
      expect(await markOf(event), viewer.label).toBe(mark)
    }
    const saved = await env.DB.prepare('SELECT description FROM tournaments WHERE id = ?').bind(event).first<{ description: string }>()
    expect(saved?.description).toBe('Saved by an LCA admin.')
  })
})

describe('no request writes the mark', () => {
  it('the create leaves it NULL whatever the body says, for an LCA admin and for a club rep, and a plain member makes no event', async () => {
    const clubId = await seedClub()
    const claimed = '2026-11-03 20:00:00'
    const body = {
      name: 'Bayou Scholastic', location: 'Houma, LA', date: '2026-12-12', entryFee: 0,
      reviewNotifiedAt: claimed, review_notified_at: claimed,
    }
    for (const as of [await seedAdmin(), await seedMember({ role: 'club_rep', clubId })]) {
      const result = await invoke(createTournament, { method: 'POST', as, body })
      expect(result.status, as).toBe(201)
      const { tournament } = await expectContract(result, createContract.response)
      expect(tournament[KEY], as).toBeNull()
      expect(await markOf(tournament.id), as).toBeNull()
    }
    const member = await seedMember()
    const refused = await invoke(createTournament, { method: 'POST', as: member, body: { ...body, name: 'Not Made Open' } })
    expect(refused.status).toBe(403)
    const made = await env.DB.prepare(`SELECT COUNT(*) AS n FROM tournaments WHERE name = 'Not Made Open'`).first<{ n: number }>()
    expect(made?.n).toBe(0)
  })

  it('an edit, unpublishing and publishing again, and a replay leave a stored mark as it was, whatever the body says', async () => {
    const clubId = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const event = await seedTournament({ clubId, createdBy: rep })
    await env.DB.prepare(`UPDATE tournaments SET review_notified_at = datetime('now', '-1 day') WHERE id = ?`).bind(event).run()
    const mark = (await markOf(event))!
    const bodies: Array<Record<string, unknown>> = [
      { description: 'Doors open at 9:00 AM.', review_notified_at: null, reviewNotifiedAt: null },
      { review_notified_at: '2027-01-02 03:04:05', reviewNotifiedAt: '2027-01-02 03:04:05' },
      { isVisible: false, reviewNotifiedAt: null },
      { isVisible: true, reviewNotifiedAt: null },
      { isVisible: true, reviewNotifiedAt: null },
    ]
    for (const body of bodies) {
      const result = await invoke(tournamentPatch, { method: 'PATCH', as: rep, params: { id: event }, body })
      expect(result.status, JSON.stringify(body)).toBe(200)
      expect((await expectContract(result, editContract.response)).tournament[KEY], JSON.stringify(body)).toBe(mark)
      expect(await markOf(event), JSON.stringify(body)).toBe(mark)
    }
    // Unpublished once and published once: the replay of the publish wrote nothing more.
    expect([await auditCount('tournament_unpublish', event), await auditCount('tournament_publish', event)]).toEqual([1, 1])
  })

  it('the registration settings leave a stored mark, and a NULL one, as they were, whatever the body says', async () => {
    const director = await seedMember()
    const marked = await seedTournament()
    const unmarked = await seedTournament()
    for (const id of [marked, unmarked]) await seedTournamentDirector(id, director)
    await env.DB.prepare(`UPDATE tournaments SET review_notified_at = datetime('now', '-3 hours') WHERE id = ?`).bind(marked).run()
    const mark = await markOf(marked)
    for (const [id, expected] of [[marked, mark], [unmarked, null]] as const) {
      const result = await invoke(registrationPatch, {
        method: 'PATCH', as: director, params: { id },
        body: { registration_status: 'closed', review_notified_at: '2027-01-02 03:04:05', reviewNotifiedAt: null },
      })
      expect(result.status, id).toBe(200)
      expect((await expectContract(result, settingsContract.response)).tournament[KEY], id).toBe(expected)
      expect(await markOf(id), id).toBe(expected)
    }
  })
})

describe('with every switch off, a publish writes no mark and sends no email', () => {
  it('a club rep\'s draft made through the create, and a standing director\'s assigned LCA-run draft, published by each: the mark stays NULL and no one is emailed', async () => {
    const clubId = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const created = await invoke(createTournament, { method: 'POST', as: rep, body: { name: 'Acadiana Rapid', location: 'Lafayette, LA', date: '2026-12-19', entryFee: 10 } })
    expect(created.status).toBe(201)
    const repDraft = (await expectContract(created, createContract.response)).tournament.id

    const standing = await seedDirector()
    const lcaDraft = await seedTournament({ name: 'Louisiana Class Championships', isVisible: false, createdBy: standing })
    await seedTournamentDirector(lcaDraft, standing)
    await seedAdmin()

    for (const [as, id] of [[rep, repDraft], [standing, lcaDraft]] as const) {
      const result = await invoke(tournamentPatch, { method: 'PATCH', as, params: { id }, body: { isVisible: true } })
      expect(result.status, id).toBe(200)
      const { tournament } = await expectContract(result, editContract.response)
      expect([tournament.is_visible, tournament[KEY]], id).toEqual([1, null])
      await flushWaitUntil()
      expect(await markOf(id), id).toBeNull()
      expect(await auditCount('tournament_publish', id), id).toBe(1)
    }
    expect(emailOutbox).toEqual([])
  })
})
