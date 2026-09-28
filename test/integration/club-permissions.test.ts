// test/integration/club-permissions.test.ts
// What a club rep can and cannot do before clubs are handed their accounts:
// which drafts they can see, what they may edit on their club, officers,
// organizing-club changes, and managing events they were asked to direct.
import { describe, it, expect } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke } from './harness'
import {
  seedAdmin,
  seedClub,
  seedMember,
  seedTournament,
  seedTournamentDirector,
} from './factories'

import { onRequestGet as tournamentsGet } from '../../functions/api/tournaments'
import { onRequestPatch as tournamentPatch } from '../../functions/api/admin/tournaments/[id]'
import {
  onRequestGet as adminClubGet,
  onRequestPatch as adminClubPatch,
} from '../../functions/api/admin/clubs/[id]'
import { onRequestPost as clubCreate } from '../../functions/api/admin/clubs'
import {
  onRequestGet as officersGet,
  onRequestPost as officersPost,
} from '../../functions/api/admin/clubs/[id]/officers'
import { onRequestDelete as officerDelete } from '../../functions/api/admin/clubs/[id]/officers/[officerId]'

async function listIds(as?: string): Promise<string[]> {
  const res = await invoke(tournamentsGet, as ? { as } : {})
  const { tournaments } = await res.json<{ tournaments: { id: string }[] }>()
  return tournaments.map((t) => t.id)
}

describe('tournament list: who sees hidden drafts', () => {
  it('a club rep sees their own club drafts but not other clubs’', async () => {
    const own = await seedClub()
    const other = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: own })
    const ownDraft = await seedTournament({ clubId: own, isVisible: false })
    const otherDraft = await seedTournament({ clubId: other, isVisible: false })
    const publicEvent = await seedTournament({ clubId: other })

    const ids = await listIds(rep)
    expect(ids).toContain(ownDraft)
    expect(ids).toContain(publicEvent)
    expect(ids).not.toContain(otherDraft)
  })

  it('a director sees drafts they direct, and no other drafts', async () => {
    const td = await seedMember({ role: 'tournament_director' })
    const directed = await seedTournament({ isVisible: false })
    const unrelated = await seedTournament({ isVisible: false })
    await seedTournamentDirector(directed, td)

    const ids = await listIds(td)
    expect(ids).toContain(directed)
    expect(ids).not.toContain(unrelated)
  })

  it('a rep with no club sees only the public list', async () => {
    const rep = await seedMember({ role: 'club_rep' })
    const clubless = await seedTournament({ isVisible: false })
    expect(await listIds(rep)).not.toContain(clubless)
  })
})

describe('club edits by a club rep', () => {
  it('can edit details but not rename, change region, or set an image URL', async () => {
    const clubId = await seedClub({ name: 'Original Name' })
    const rep = await seedMember({ role: 'club_rep', clubId })

    const ok = await invoke(adminClubPatch, {
      method: 'PATCH', as: rep, params: { id: clubId },
      body: { name: 'Original Name', description: 'We meet weekly', contactEmail: 'club@example.com' },
    })
    expect(ok.status).toBe(200)

    for (const body of [
      { name: 'New Name' },
      { region: 'Bayou Region' },
      { imageUrl: 'https://elsewhere.example/logo.png' },
    ]) {
      const res = await invoke(adminClubPatch, { method: 'PATCH', as: rep, params: { id: clubId }, body })
      expect(res.status).toBe(403)
    }

    const row = await env.DB.prepare('SELECT name, description, region FROM clubs WHERE id = ?')
      .bind(clubId).first<{ name: string; description: string; region: string | null }>()
    expect(row?.name).toBe('Original Name')
    expect(row?.description).toBe('We meet weekly')
    expect(row?.region).toBeNull()
  })

  it('an admin can rename and set the region; an invalid email is refused', async () => {
    const clubId = await seedClub()
    const admin = await seedAdmin()
    const res = await invoke(adminClubPatch, {
      method: 'PATCH', as: admin, params: { id: clubId }, body: { name: 'Renamed', region: 'Bayou Region' },
    })
    expect(res.status).toBe(200)
    const bad = await invoke(adminClubPatch, {
      method: 'PATCH', as: admin, params: { id: clubId }, body: { contactEmail: 'not-an-email' },
    })
    expect(bad.status).toBe(400)
  })

  it('the manage view includes the club’s drafts', async () => {
    const clubId = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const draft = await seedTournament({ clubId, isVisible: false })
    const res = await invoke(adminClubGet, { as: rep, params: { id: clubId } })
    expect(res.status).toBe(200)
    const { tournaments } = await res.json<{ tournaments: { id: string }[] }>()
    expect(tournaments.map((t) => t.id)).toContain(draft)
  })
})

describe('club creation', () => {
  it('is admin-only', async () => {
    const clubId = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const denied = await invoke(clubCreate, { method: 'POST', as: rep, body: { name: 'Rogue Club', city: 'Hammond' } })
    expect(denied.status).toBe(403)

    const admin = await seedAdmin()
    const res = await invoke(clubCreate, { method: 'POST', as: admin, body: { name: 'New Club', city: 'Hammond' } })
    expect(res.status).toBe(201)
  })

  it('does not collide with an existing club id', async () => {
    const admin = await seedAdmin()
    const first = await invoke(clubCreate, { method: 'POST', as: admin, body: { name: 'Twin Club', city: 'A' } })
    const second = await invoke(clubCreate, { method: 'POST', as: admin, body: { name: 'Twin Club', city: 'B' } })
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    const a = (await first.json<{ club: { id: string } }>()).club.id
    const b = (await second.json<{ club: { id: string } }>()).club.id
    expect(a).not.toBe(b)
  })
})

describe('club officers', () => {
  it('a rep can list roster members as officers and remove them', async () => {
    const clubId = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const onRoster = await seedMember({ clubId })

    const add = await invoke(officersPost, {
      method: 'POST', as: rep, params: { id: clubId }, body: { memberId: onRoster, title: 'President' },
    })
    expect(add.status).toBe(201)
    const { officers } = await add.json<{ officers: { id: string; member_id: string; role: string }[] }>()
    expect(officers).toHaveLength(1)
    expect(officers[0]).toMatchObject({ member_id: onRoster, role: 'President' })

    const del = await invoke(officerDelete, {
      method: 'DELETE', as: rep, params: { id: clubId, officerId: officers[0].id },
    })
    expect(del.status).toBe(200)
    const after = await invoke(officersGet, { as: rep, params: { id: clubId } })
    expect((await after.json<{ officers: unknown[] }>()).officers).toHaveLength(0)
  })

  it('refuses someone who is not on the roster', async () => {
    const clubId = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const stranger = await seedMember()
    const res = await invoke(officersPost, {
      method: 'POST', as: rep, params: { id: clubId }, body: { memberId: stranger, title: 'President' },
    })
    expect(res.status).toBe(400)
  })

  it('another club’s rep cannot add or remove officers', async () => {
    const clubId = await seedClub()
    const otherClub = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const foreignRep = await seedMember({ role: 'club_rep', clubId: otherClub })
    const onRoster = await seedMember({ clubId })

    const add = await invoke(officersPost, {
      method: 'POST', as: foreignRep, params: { id: clubId }, body: { memberId: onRoster, title: 'President' },
    })
    expect(add.status).toBe(403)

    const ok = await invoke(officersPost, {
      method: 'POST', as: rep, params: { id: clubId }, body: { memberId: onRoster, title: 'Secretary' },
    })
    const officerId = (await ok.json<{ officers: { id: string }[] }>()).officers[0].id

    // Guessing the id through their own club's URL must not reach it either.
    const viaOwnClub = await invoke(officerDelete, {
      method: 'DELETE', as: foreignRep, params: { id: otherClub, officerId },
    })
    expect(viaOwnClub.status).toBe(404)
  })
})

describe('organizing club and cross-club directing', () => {
  it('only an admin can change a tournament’s organizing club', async () => {
    const clubA = await seedClub()
    const clubB = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: clubA })
    const tournamentId = await seedTournament({ clubId: clubA })

    const denied = await invoke(tournamentPatch, {
      method: 'PATCH', as: rep, params: { id: tournamentId }, body: { clubId: clubB },
    })
    expect(denied.status).toBe(403)

    const admin = await seedAdmin()
    const ok = await invoke(tournamentPatch, {
      method: 'PATCH', as: admin, params: { id: tournamentId }, body: { clubId: clubB },
    })
    expect(ok.status).toBe(200)
    const row = await env.DB.prepare('SELECT club_id FROM tournaments WHERE id = ?')
      .bind(tournamentId).first<{ club_id: string }>()
    expect(row?.club_id).toBe(clubB)
  })

  it('an ordinary edit leaves the organizing club alone', async () => {
    const clubId = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId })
    const tournamentId = await seedTournament({ clubId })
    const res = await invoke(tournamentPatch, {
      method: 'PATCH', as: rep, params: { id: tournamentId }, body: { name: 'Renamed Open' },
    })
    expect(res.status).toBe(200)
    const row = await env.DB.prepare('SELECT club_id FROM tournaments WHERE id = ?')
      .bind(tournamentId).first<{ club_id: string }>()
    expect(row?.club_id).toBe(clubId)
  })

  it('a club rep asked to direct another club’s event can manage it', async () => {
    const ownClub = await seedClub()
    const hostClub = await seedClub()
    const rep = await seedMember({ role: 'club_rep', clubId: ownClub })
    const tournamentId = await seedTournament({ clubId: hostClub })

    const before = await invoke(tournamentPatch, {
      method: 'PATCH', as: rep, params: { id: tournamentId }, body: { name: 'Nope' },
    })
    expect(before.status).toBe(403)

    await seedTournamentDirector(tournamentId, rep)
    const after = await invoke(tournamentPatch, {
      method: 'PATCH', as: rep, params: { id: tournamentId }, body: { name: 'Directed Open' },
    })
    expect(after.status).toBe(200)
  })
})
