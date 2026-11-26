// test/integration/club-rep-naming-kept.test.ts
// WS09 step 37: naming a club's rep (PATCH /api/admin/members/[id]/club) is a
// reader and writer of members.club_id that the step keeps, with the club
// pages off and on. A club rep's scope is their club_id, so the endpoint
// answers the same with CLUB_PAGES_ON unset and set, and only an LCA admin may
// use it. CLUB_PAGES_ON is held unset but in the cases that set it, through a
// getter on the mocked module.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke, resetHarness } from './harness'
import { seedAdmin, seedClub, seedMember, seedTournamentDirector, seedTournament } from './factories'

import { onRequestPatch as clubPatch } from '../../functions/api/admin/members/[id]/club'
import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'

const flags = vi.hoisted(() => ({ pagesOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
  }
})

beforeEach(resetHarness)
afterEach(() => {
  flags.pagesOn = false
})

const clubOf = async (memberId: string) =>
  (await env.DB.prepare('SELECT club_id FROM members WHERE id = ?').bind(memberId).first<{ club_id: string | null }>())?.club_id ?? null

const auditRows = async (memberId: string) =>
  (await env.DB.prepare("SELECT detail FROM admin_audit_log WHERE action = 'club_change' AND target_member_id = ?").bind(memberId).all<{ detail: string }>()).results.map((r) => JSON.parse(r.detail) as { from: string | null; to: string | null })

for (const on of [false, true]) {
  describe(`naming a rep, with CLUB_PAGES_ON ${on ? 'set' : 'unset'}`, () => {
    beforeEach(() => {
      flags.pagesOn = on
    })

    it('an LCA admin names a club for a member, which is recorded, and a rep then sees that club\'s hidden drafts', async () => {
      const admin = await seedAdmin()
      const club = await seedClub({ name: 'Example Chess Club' })
      const rep = await seedMember({ role: 'club_rep', fullName: 'Player One' })
      const draft = await seedTournament({ clubId: club, isVisible: false })

      const res = await invoke(clubPatch, { method: 'PATCH', as: admin, params: { id: rep }, body: { clubId: club } })
      expect(res.status).toBe(200)
      const body = await res.json<{ member: { id: string; club_id: string | null } }>()
      expect(body.member.id).toBe(rep)
      expect(body.member.club_id).toBe(club)
      expect(await clubOf(rep)).toBe(club)
      expect(await auditRows(rep)).toEqual([{ from: null, to: club }])

      const list = await (await invoke(tournamentsGet, { as: rep })).json<{ tournaments: { id: string }[] }>()
      expect(list.tournaments.map((t) => t.id)).toContain(draft)
    })

    it('null takes the club away again, and naming the club a member already has records nothing new', async () => {
      const admin = await seedAdmin()
      const club = await seedClub({ name: 'Example Chess Club' })
      const rep = await seedMember({ role: 'club_rep', clubId: club })

      const same = await invoke(clubPatch, { method: 'PATCH', as: admin, params: { id: rep }, body: { clubId: club } })
      expect(same.status).toBe(200)
      expect(await auditRows(rep)).toEqual([])

      const away = await invoke(clubPatch, { method: 'PATCH', as: admin, params: { id: rep }, body: { clubId: null } })
      expect(away.status).toBe(200)
      expect(await clubOf(rep)).toBeNull()
      expect(await auditRows(rep)).toEqual([{ from: club, to: null }])
    })

    it('refuses a missing clubId with 400, an unknown club and an unknown member with 404, and changes nothing', async () => {
      const admin = await seedAdmin()
      const club = await seedClub({ name: 'Example Chess Club' })
      const rep = await seedMember({ role: 'club_rep' })

      expect((await invoke(clubPatch, { method: 'PATCH', as: admin, params: { id: rep }, body: {} })).status).toBe(400)
      expect((await invoke(clubPatch, { method: 'PATCH', as: admin, params: { id: rep }, body: { clubId: 'no-such-club' } })).status).toBe(404)
      expect((await invoke(clubPatch, { method: 'PATCH', as: admin, params: { id: 'no-such-member' }, body: { clubId: club } })).status).toBe(404)
      expect(await clubOf(rep)).toBeNull()
      expect(await auditRows(rep)).toEqual([])
    })

    it('role safety: signed out gets 401, and a member, a club rep and a tournament director get 403, with nothing changed and no member in the answer', async () => {
      const club = await seedClub({ name: 'Example Chess Club' })
      const rep = await seedMember({ role: 'club_rep' })
      const ownClub = await seedClub({ name: 'Another Example Chess Club' })
      const director = async () => {
        const id = await seedMember({ role: 'tournament_director' })
        await seedTournamentDirector(await seedTournament(), id)
        return id
      }
      const askers: Array<[string, string | undefined, number]> = [
        ['signed out', undefined, 401],
        ['a member', await seedMember(), 403],
        ['a club rep', await seedMember({ role: 'club_rep', clubId: ownClub }), 403],
        ['a tournament director', await director(), 403],
      ]
      for (const [label, as, status] of askers) {
        const res = await invoke(clubPatch, { method: 'PATCH', as, params: { id: rep }, body: { clubId: club } })
        expect(res.status, label).toBe(status)
        expect(await res.response.text(), label).not.toContain('"member"')
      }
      expect(await clubOf(rep)).toBeNull()
      expect(await auditRows(rep)).toEqual([])
    })
  })
}
