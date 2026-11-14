// test/integration/club-permissions.test.ts
// What a club rep can and cannot do before clubs are handed their accounts:
// which drafts they can see, what they may edit on their club, officers,
// organizing-club changes, and managing events they were asked to direct.
// And, once the clubs' regions are filled (migration 0065), what a person
// admitted to a club by a regional seat alone sees of its members: the club
// without its roster or any officer's email, while an LCA admin, an
// observer and the club's own rep get today's answer, byte for byte.
import { afterEach, describe, it, expect, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { flushWaitUntil, invoke } from './harness'
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
import { onRequestGet as rosterGet } from '../../functions/api/admin/clubs/[id]/roster'
import { onRequestGet as newsGet } from '../../functions/api/admin/clubs/[id]/news'
import { ROSTER_KEPT_BACK } from '../../functions/utils/clubs/memberView'
import { onRequestPut as placesPut, PLACES_CLOSED } from '../../functions/api/admin/clubs/[id]/places'

// CLUB_KEEPERS_ON is false in the tree, and every case above the keepers'
// save runs with it unset; the cases of criterion 9 at the end set it through
// a getter on the mocked module, as functions/utils/clubs/pages.ts describes.
const flags = vi.hoisted(() => ({ keepersOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_KEEPERS_ON() {
      return flags.keepersOn
    },
  }
})
afterEach(() => {
  flags.keepersOn = false
})

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

// The regions fill (migration 0065) lets a regional seat holder into every
// club of the seat's regions on today's admin club page. They keep the
// listing, the news and the logo; the roster and the officers' emails stay
// with LCA admins, observers and the club's own rep.

const REGION = 'Bayou Region'

/** A regional seat covering the regions, held by the member, as the seat screens write one. */
async function regionalSeat(memberId: string, regions: string[] = [REGION]): Promise<string> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(id, id).run()
  for (const region of regions) {
    await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  }
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(id, memberId).run()
  return id
}

/**
 * A made up club in the region with its own rep, an officer and two members
 * who carry every field the roster answers, and a hidden draft.
 */
async function exampleClub(region: string | null = REGION) {
  const clubId = await seedClub({ name: 'Example Chess Club', city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ?, contact_email = ? WHERE id = ?')
    .bind(region, 'club@example.org', clubId).run()
  const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: 'club.rep.one@example.org' })
  const one = await seedMember({
    clubId, fullName: 'Player One', email: 'player.one@example.org', uscfId: '90000001', uscfRating: 1500, membershipStatus: 'active',
  })
  const two = await seedMember({
    clubId, fullName: 'Player Two', email: 'player.two@example.org', uscfId: '90000002', uscfRating: 1200, membershipStatus: 'expired',
  })
  const admin = await seedAdmin()
  const added = await invoke(officersPost, {
    method: 'POST', as: admin, params: { id: clubId }, body: { memberId: one, title: 'President' },
  })
  expect(added.status).toBe(201)
  const draft = await seedTournament({ clubId, isVisible: false })
  return { clubId, rep, one, two, admin, draft }
}

/** GET /api/admin/clubs/[id] as the code before migration 0065 answered it, for anyone it admitted; its club is the row's 13 columns of that time, which SELECT * read before migration 0066 added more. */
async function todaysClubAnswer(clubId: string): Promise<string> {
  const club = await env.DB.prepare(
    'SELECT id, name, city, location, description, meeting_schedule, contact_email, created_at, color, image_url, region, latitude, longitude FROM clubs WHERE id = ?',
  ).bind(clubId).first()
  const officers = await env.DB.prepare(
    `SELECT co.id, co.member_id, co.role, m.full_name, m.email
     FROM club_officers co
     JOIN members m ON co.member_id = m.id
     WHERE co.club_id = ? ORDER BY co.created_at`,
  ).bind(clubId).all()
  const roster = await env.DB.prepare(
    `SELECT m.id, m.full_name, m.email, m.uscf_id, m.uscf_rating, m.membership_status
     FROM members m WHERE m.club_id = ? AND m.role != 'guest' ORDER BY m.full_name`,
  ).bind(clubId).all()
  const tournaments = await env.DB.prepare(
    `SELECT id, name, date, end_date, status, is_visible, registration_status
     FROM tournaments WHERE club_id = ? ORDER BY date DESC`,
  ).bind(clubId).all()
  return JSON.stringify({ club, officers: officers.results, roster: roster.results, tournaments: tournaments.results })
}

/** GET /api/admin/clubs/[id]/roster as the code before migration 0065 answered it. */
async function todaysRoster(clubId: string): Promise<string> {
  const roster = await env.DB.prepare(
    `SELECT m.id, m.full_name, m.email, m.uscf_id,
            m.membership_status, m.role, m.created_at
     FROM members m
     WHERE m.club_id = ?
     ORDER BY m.full_name`,
  ).bind(clubId).all()
  return JSON.stringify({ roster: roster.results })
}

/** GET /api/admin/clubs/[id]/officers as the code before migration 0065 answered it. */
async function todaysOfficers(clubId: string): Promise<string> {
  const { results } = await env.DB.prepare(
    `SELECT co.id, co.member_id, co.role, m.full_name, m.email
     FROM club_officers co
     JOIN members m ON co.member_id = m.id
     WHERE co.club_id = ?
     ORDER BY co.created_at`,
  ).bind(clubId).all()
  return JSON.stringify({ officers: results ?? [] })
}

const text = (res: { response: Response }) => res.response.clone().text()

/** Holds that no member's email, US Chess ID, rating or membership status is in an answer. */
function holdsNoMemberData(body: string) {
  for (const piece of ['player.one@example.org', 'player.two@example.org', 'club.rep.one@example.org', '90000001', '90000002', '"uscf_rating"', '"membership_status"', '"email"']) {
    expect(body, piece).not.toContain(piece)
  }
}

describe('the roster stays back from a region\'s representative', () => {
  it('a region\'s representative gets the club without its roster or any officer\'s email', async () => {
    const { clubId, one, draft } = await exampleClub()
    const holder = await seedMember({ fullName: 'Region Holder One', email: 'region.holder.one@example.org' })
    await regionalSeat(holder)

    const res = await invoke(adminClubGet, { as: holder, aal: 'aal1', params: { id: clubId } })
    expect(res.status).toBe(200)
    const body = await res.json<{
      club: { id: string; contact_email: string; region: string }
      officers: Array<Record<string, unknown>>
      roster: unknown[]
      tournaments: Array<{ id: string }>
    }>()
    expect(Object.keys(body)).toEqual(['club', 'officers', 'roster', 'rosterKeptBack', 'tournaments'])
    expect(body.club).toMatchObject({ id: clubId, region: REGION, contact_email: 'club@example.org' })
    expect(body.roster).toEqual([])
    expect(body.officers).toHaveLength(1)
    expect(Object.keys(body.officers[0])).toEqual(['id', 'member_id', 'role', 'full_name'])
    expect(body.officers[0]).toMatchObject({ member_id: one, role: 'President', full_name: 'Player One' })
    expect(body.tournaments.map((t) => t.id), draft).toEqual([])
    holdsNoMemberData(await text(res))

    // The listing stays theirs to keep, and the news to read.
    const edit = await invoke(adminClubPatch, {
      method: 'PATCH', as: holder, aal: 'aal1', params: { id: clubId }, body: { description: 'We meet on Tuesdays' },
    })
    expect(edit.status).toBe(200)
    expect((await invoke(newsGet, { as: holder, aal: 'aal1', params: { id: clubId } })).status).toBe(200)
  })

  it('the club\'s rep and an admin get today\'s answer', async () => {
    const { clubId, rep, admin } = await exampleClub()
    await regionalSeat(await seedMember())
    // A rep who holds the region's seat too is still the club's own rep.
    await regionalSeat(rep)
    for (const who of [rep, admin]) {
      const res = await invoke(adminClubGet, { as: who, params: { id: clubId } })
      expect(res.status, who).toBe(200)
      expect(await text(res), who).toBe(await todaysClubAnswer(clubId))
      const roster = await res.json<{ roster: Array<{ email: string; uscf_id: string }> }>()
      expect(roster.roster.map((m) => m.email).sort(), who).toEqual(['club.rep.one@example.org', 'player.one@example.org', 'player.two@example.org'])
    }
  })

  it('an observer and an LCA officer get today\'s answer from the club and its roster', async () => {
    const { clubId } = await exampleClub()
    for (const role of ['lca_observer', 'lca_officer']) {
      const who = await seedMember({ role })
      const club = await invoke(adminClubGet, { as: who, aal: 'aal1', params: { id: clubId } })
      expect(club.status, role).toBe(200)
      expect(await text(club), role).toBe(await todaysClubAnswer(clubId))
      const roster = await invoke(rosterGet, { as: who, aal: 'aal1', params: { id: clubId } })
      expect(roster.status, role).toBe(200)
      expect(await text(roster), role).toBe(await todaysRoster(clubId))
    }
  })

  it('the roster endpoint answers 403 in words to a region\'s representative, and today\'s roster to an admin and the club\'s rep', async () => {
    const { clubId, rep, admin } = await exampleClub()
    const holder = await seedMember({ email: 'region.holder.two@example.org' })
    await regionalSeat(holder)

    const refused = await invoke(rosterGet, { as: holder, aal: 'aal1', params: { id: clubId } })
    expect(refused.status).toBe(403)
    expect(await text(refused)).toBe(JSON.stringify({ error: ROSTER_KEPT_BACK }))
    expect(ROSTER_KEPT_BACK).toBe('A club\'s roster is kept for LCA admins and the club\'s own rep.')

    for (const who of [rep, admin]) {
      const res = await invoke(rosterGet, { as: who, params: { id: clubId } })
      expect(res.status, who).toBe(200)
      expect(await text(res), who).toBe(await todaysRoster(clubId))
    }
  })

  it('the officers list comes without emails for a region\'s representative, and as today for the rest', async () => {
    const { clubId, rep, admin } = await exampleClub()
    const observer = await seedMember({ role: 'lca_observer' })
    const holder = await seedMember()
    await regionalSeat(holder)

    const listed = await invoke(officersGet, { as: holder, aal: 'aal1', params: { id: clubId } })
    expect(listed.status).toBe(200)
    const { officers } = await listed.json<{ officers: Array<Record<string, unknown>> }>()
    expect(officers.map((o) => Object.keys(o))).toEqual([['id', 'member_id', 'role', 'full_name']])
    holdsNoMemberData(await text(listed))

    for (const who of [rep, admin, observer]) {
      const res = await invoke(officersGet, { as: who, params: { id: clubId } })
      expect(res.status, who).toBe(200)
      expect(await text(res), who).toBe(await todaysOfficers(clubId))
    }
    const byRep = await invoke(officersPost, {
      method: 'POST', as: rep, params: { id: clubId }, body: { memberId: rep, title: 'Treasurer' },
    })
    expect(byRep.status).toBe(201)
    expect(await text(byRep)).toBe(await todaysOfficers(clubId))
  })

  it('a region\'s representative cannot add an officer, so the answer never tells who is on the roster', async () => {
    const { clubId, rep, admin, two } = await exampleClub()
    const holder = await seedMember()
    await regionalSeat(holder)
    const officerRows = async () => (await env.DB.prepare('SELECT COUNT(*) AS n FROM club_officers WHERE club_id = ?').bind(clubId).first<{ n: number }>())?.n

    // A member on the roster and an id that is not on it get the same answer, and no row is written.
    for (const memberId of [two, `${two}-x`]) {
      const res = await invoke(officersPost, {
        method: 'POST', as: holder, aal: 'aal1', params: { id: clubId }, body: { memberId, title: 'Secretary' },
      })
      expect(res.status, memberId).toBe(403)
      expect(await text(res), memberId).toBe(JSON.stringify({ error: ROSTER_KEPT_BACK }))
    }
    expect(await officerRows()).toBe(1)

    // The club's rep and an admin add officers as today, and refuse an id off the roster as today.
    for (const who of [rep, admin]) {
      const off = await invoke(officersPost, {
        method: 'POST', as: who, params: { id: clubId }, body: { memberId: `${two}-x`, title: 'Treasurer' },
      })
      expect(off.status, who).toBe(400)
      expect(await off.json(), who).toEqual({ error: 'That member is not on this club\'s roster' })
    }
    const byAdmin = await invoke(officersPost, {
      method: 'POST', as: admin, params: { id: clubId }, body: { memberId: two, title: 'Secretary' },
    })
    expect(byAdmin.status).toBe(201)
    expect(await text(byAdmin)).toBe(await todaysOfficers(clubId))
  })

  it('another club\'s rep who holds the region\'s seat is held back here, and keeps today\'s answer on their own club', async () => {
    const { clubId } = await exampleClub()
    const own = await exampleClub(null)
    await regionalSeat(own.rep)

    const here = await invoke(adminClubGet, { as: own.rep, params: { id: clubId } })
    expect(here.status).toBe(200)
    expect((await here.json<{ roster: unknown[] }>()).roster).toEqual([])
    expect((await invoke(rosterGet, { as: own.rep, params: { id: clubId } })).status).toBe(403)

    const home = await invoke(adminClubGet, { as: own.rep, params: { id: own.clubId } })
    expect(await text(home)).toBe(await todaysClubAnswer(own.clubId))
    const homeRoster = await invoke(rosterGet, { as: own.rep, params: { id: own.clubId } })
    expect(await text(homeRoster)).toBe(await todaysRoster(own.clubId))
  })

  it('role safety: signed out, a member with no seat and another region\'s representative get today\'s refusals', async () => {
    const { clubId } = await exampleClub()
    const member = await seedMember()
    const elsewhere = await seedMember()
    await regionalSeat(elsewhere, ['North Louisiana'])
    for (const handler of [adminClubGet, rosterGet, officersGet]) {
      expect((await invoke(handler, { params: { id: clubId } })).status).toBe(401)
      for (const who of [member, elsewhere]) {
        const res = await invoke(handler, { as: who, aal: 'aal1', params: { id: clubId } })
        expect(res.status, who).toBe(403)
        expect(await res.json(), who).toEqual({ error: 'Forbidden' })
      }
    }
  })

  it('an LCA admin who also holds the region\'s seat gets today\'s answer', async () => {
    const { clubId, admin } = await exampleClub()
    await regionalSeat(admin)
    expect(await text(await invoke(adminClubGet, { as: admin, params: { id: clubId } }))).toBe(await todaysClubAnswer(clubId))
    expect(await text(await invoke(rosterGet, { as: admin, params: { id: clubId } }))).toBe(await todaysRoster(clubId))
  })
})

// Criterion 9 for the keepers' save (WS09 step 6): only an LCA admin, the
// club's named rep and the representative for the club's region save a
// listing or its places, and only an LCA admin changes its region or its page
// address. With CLUB_KEEPERS_ON unset the GET answers each person the base's
// own answer.

/** The listing's columns the keepers' save writes, read to see that a refusal wrote nothing. */
async function listing(clubId: string) {
  return env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first()
}
async function places(clubId: string) {
  return (await env.DB.prepare('SELECT name, sort FROM club_places WHERE club_id = ? ORDER BY sort').bind(clubId).all()).results
}

/**
 * GET /api/admin/clubs/[id] as the base answers a person admitted by the
 * region alone: no roster, the officers without their email, rosterKeptBack
 * and the visible events only, by K's answer 2 (a) to checkpoint S's review.
 */
async function baseRegionAloneAnswer(clubId: string): Promise<string> {
  const today = JSON.parse(await todaysClubAnswer(clubId)) as { club: unknown; officers: Array<Record<string, unknown>>; tournaments: Array<{ is_visible: number }> }
  return JSON.stringify({
    club: today.club,
    officers: today.officers.map((officer) => Object.fromEntries(Object.entries(officer).filter(([key]) => key !== 'email'))),
    roster: [],
    rosterKeptBack: true,
    tournaments: today.tournaments.filter((event) => event.is_visible === 1),
  })
}

/**
 * Asks PATCH and PUT places as one person the keepers' save does not admit,
 * and holds that each answers 403 (in the words given, where the case names
 * them) and that neither the club nor its places changed.
 */
async function expectSaveRefused(clubId: string, who: string, body: Record<string, unknown>, placesBody: unknown[], words?: string) {
  const before = { club: await listing(clubId), places: await places(clubId) }
  const saved = await invoke(adminClubPatch, { method: 'PATCH', as: who, aal: 'aal1', params: { id: clubId }, body })
  expect(saved.status).toBe(403)
  if (words) expect(await saved.json()).toEqual({ error: words })
  const placed = await invoke(placesPut, { method: 'PUT', as: who, aal: 'aal1', params: { id: clubId }, body: { places: placesBody } })
  expect(placed.status).toBe(403)
  if (words) expect(await placed.json()).toEqual({ error: words })
  expect(await listing(clubId)).toEqual(before.club)
  expect(await places(clubId)).toEqual(before.places)
}

describe('who may save a listing and its places (criterion 9)', () => {
  it('with CLUB_KEEPERS_ON set, an LCA admin, the club\'s rep and the region\'s representative save the listing and its places', async () => {
    flags.keepersOn = true
    const { clubId, rep, admin } = await exampleClub()
    const holder = await seedMember()
    await regionalSeat(holder)
    for (const [who, aal] of [[admin, 'aal2'], [rep, 'aal2'], [holder, 'aal1']] as const) {
      const saved = await invoke(adminClubPatch, { method: 'PATCH', as: who, aal, params: { id: clubId }, body: { aboutText: `Saved by ${who}` } })
      expect(saved.status, who).toBe(200)
      const placed = await invoke(placesPut, { method: 'PUT', as: who, aal, params: { id: clubId }, body: { places: [{ name: `Example Hall of ${who}` }] } })
      expect(placed.status, who).toBe(200)
      expect(await listing(clubId), who).toMatchObject({ about_text: `Saved by ${who}`, told_by: who, confirmed_by: who })
      expect(await places(clubId), who).toEqual([{ name: `Example Hall of ${who}`, sort: 0 }])
    }
    await flushWaitUntil()
  })

  it('with CLUB_KEEPERS_ON set, another region\'s representative gets 403 on PATCH and PUT, and nothing is written', async () => {
    flags.keepersOn = true
    const { clubId } = await exampleClub()
    const elsewhere = await seedMember()
    await regionalSeat(elsewhere, ['North Louisiana'])
    await expectSaveRefused(clubId, elsewhere, { aboutText: 'Not theirs to save' }, [{ name: 'Example Hall' }], 'Forbidden')
  })

  it('with CLUB_KEEPERS_ON set, another club\'s rep gets 403 on PATCH and PUT, and nothing is written', async () => {
    flags.keepersOn = true
    const { clubId } = await exampleClub()
    const otherRep = (await exampleClub()).rep
    await expectSaveRefused(clubId, otherRep, { aboutText: 'Not theirs to save' }, [{ name: 'Example Hall' }], 'Forbidden')
  })

  it('with CLUB_KEEPERS_ON set, a one-event director gets 403 on PATCH and PUT, and nothing is written', async () => {
    flags.keepersOn = true
    const { clubId, draft } = await exampleClub()
    const director = await seedMember()
    await seedTournamentDirector(draft, director)
    await expectSaveRefused(clubId, director, { aboutText: 'Not theirs to save' }, [{ name: 'Example Hall' }], 'Forbidden')
  })

  it('with CLUB_KEEPERS_ON set, a member of the club gets 403 on PATCH and PUT, and nothing is written', async () => {
    flags.keepersOn = true
    const { clubId } = await exampleClub()
    const member = await seedMember({ clubId })
    await expectSaveRefused(clubId, member, { aboutText: 'Not theirs to save' }, [{ name: 'Example Hall' }], 'Forbidden')
  })

  it('with CLUB_KEEPERS_ON set, an observer gets 403 on PATCH and PUT, and nothing is written', async () => {
    flags.keepersOn = true
    const { clubId } = await exampleClub()
    const observer = await seedMember({ role: 'lca_observer' })
    await expectSaveRefused(clubId, observer, { description: 'Not theirs to save' }, [])
  })

  it('with CLUB_KEEPERS_ON set, an LCA officer gets 403 on PATCH and PUT, and nothing is written', async () => {
    flags.keepersOn = true
    const { clubId } = await exampleClub()
    const officer = await seedMember({ role: 'lca_officer' })
    await expectSaveRefused(clubId, officer, { description: 'Not theirs to save' }, [])
  })

  it('with CLUB_KEEPERS_ON set, a seat holder whose term has ended gets 403 on PATCH and PUT, and nothing is written', async () => {
    flags.keepersOn = true
    const { clubId } = await exampleClub()
    const ended = await seedMember()
    const seat = await regionalSeat(ended)
    await env.DB.prepare('UPDATE board_seat_assignments SET ended_at = \'2026-10-01 00:00:00\' WHERE seat_id = ?').bind(seat).run()
    await expectSaveRefused(clubId, ended, { description: 'Not theirs to save' }, [])
  })

  it('with CLUB_KEEPERS_ON set, a guest gets 403 on PATCH and PUT, and nothing is written', async () => {
    flags.keepersOn = true
    const { clubId } = await exampleClub()
    const guest = await seedMember({ role: 'guest', clubId })
    await expectSaveRefused(clubId, guest, { description: 'Not theirs to save' }, [])
  })

  it('with CLUB_KEEPERS_ON set, a child account gets 403 on PATCH and PUT, and nothing is written', async () => {
    flags.keepersOn = true
    const { clubId, rep } = await exampleClub()
    const child = await seedMember({ clubId, fullName: 'Player Junior' })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(rep, child).run()
    await expectSaveRefused(clubId, child, { description: 'Not theirs to save' }, [])
  })

  it('with CLUB_KEEPERS_ON set, only an LCA admin changes a club\'s region or its page address', async () => {
    flags.keepersOn = true
    const { clubId, rep, admin } = await exampleClub()
    const holder = await seedMember()
    await regionalSeat(holder)
    for (const who of [rep, holder]) {
      for (const [body, words] of [
        [{ region: 'North Louisiana' }, 'Only LCA admins can change a club\'s region'],
        [{ slug: `moved-${clubId}` }, 'Only LCA admins can change a club\'s page address'],
      ] as const) {
        const res = await invoke(adminClubPatch, { method: 'PATCH', as: who, aal: 'aal1', params: { id: clubId }, body })
        expect(res.status, `${who} ${JSON.stringify(body)}`).toBe(403)
        expect(await res.json()).toEqual({ error: words })
      }
    }
    expect(await listing(clubId)).toMatchObject({ region: REGION, slug: null })
    const res = await invoke(adminClubPatch, { method: 'PATCH', as: admin, params: { id: clubId }, body: { region: 'North Louisiana', slug: `moved-${clubId}` } })
    expect(res.status).toBe(200)
    expect(await listing(clubId)).toMatchObject({ region: 'North Louisiana', slug: `moved-${clubId}` })
  })

  it('with CLUB_KEEPERS_ON unset, the GET answers a region\'s representative the base\'s own answer, and PUT places is refused in words', async () => {
    const { clubId, rep, admin } = await exampleClub()
    const holder = await seedMember()
    await regionalSeat(holder)
    const res = await invoke(adminClubGet, { as: holder, aal: 'aal1', params: { id: clubId } })
    expect(await text(res)).toBe(await baseRegionAloneAnswer(clubId))
    for (const [who, aal] of [[admin, 'aal2'], [rep, 'aal2'], [holder, 'aal1']] as const) {
      const placed = await invoke(placesPut, { method: 'PUT', as: who, aal, params: { id: clubId }, body: { places: [{ name: 'Example Hall' }] } })
      expect(placed.status, who).toBe(403)
      expect(await placed.json(), who).toEqual({ error: PLACES_CLOSED })
    }
    expect(await places(clubId)).toEqual([])
  })
})
