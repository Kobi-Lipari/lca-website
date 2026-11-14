// test/integration/club-by-slug-edges.test.ts
// The edges of GET /api/admin/clubs/[id] finding a club by its page address
// (WS09 step 9), beside the cases of test/integration/club-permissions.test.ts:
// a page address an admin has just changed, a club with no page address, a
// value written to read as another one, a rep who also holds the region's
// seat, the order of an id, a page address and an old address, the stamp the
// page reads its last save from, and the one place the address does not
// reach, the save. With CLUB_KEEPERS_ON unset every value but a club's id
// names no club, as before. Every name and address here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { invoke } from './harness'
import { seedAdmin, seedClub, seedMember, seedTournament } from './factories'

import { onRequestGet as adminClubGet, onRequestPatch as adminClubPatch } from '../../functions/api/admin/clubs/[id]'

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

const REGION = 'Bayou Region'

/** A regional seat covering the region, held by the member. */
async function regionalSeat(memberId: string, regions: string[] = [REGION]): Promise<void> {
  const id = `seat-${crypto.randomUUID().slice(0, 8)}`
  await env.DB.prepare(
    `INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)
     VALUES (?, 'Example Region Representative', '', 99, ?, 'regional_rep', 1)`,
  ).bind(id, id).run()
  for (const region of regions) await env.DB.prepare('INSERT INTO seat_regions (seat_id, region) VALUES (?, ?)').bind(id, region).run()
  await env.DB.prepare('INSERT INTO board_seat_assignments (seat_id, member_id) VALUES (?, ?)').bind(id, memberId).run()
}

/** A made-up club in the region with its rep, a member on its roster and a hidden draft; the club has no page address yet. */
async function club(name = 'Example Chess Club') {
  const clubId = await seedClub({ name, city: 'Example City' })
  await env.DB.prepare('UPDATE clubs SET region = ?, contact_email = ? WHERE id = ?').bind(REGION, 'club@example.org', clubId).run()
  const rep = await seedMember({ role: 'club_rep', clubId, fullName: 'Club Rep One', email: 'club.rep.one@example.org' })
  const member = await seedMember({ clubId, fullName: 'Player One', email: 'player.one@example.org' })
  const draft = await seedTournament({ clubId, isVisible: false })
  return { clubId, rep, member, draft }
}

const get = async (who: string | undefined, value: string, aal: 'aal1' | 'aal2' = 'aal1') => {
  const res = await invoke(adminClubGet, { ...(who ? { as: who } : {}), aal, params: { id: value } })
  return { status: res.status, body: await res.response.clone().text() }
}
const stored = (clubId: string) => env.DB.prepare('SELECT slug, told_updated_at, told_by FROM clubs WHERE id = ?').bind(clubId).first<{ slug: string | null; told_updated_at: string | null; told_by: string | null }>()

describe('GET /api/admin/clubs/[id] by a page address, at its edges (WS09 step 9)', () => {
  it('a page address an admin changes leads to the club, its old one leads to none, and a rep keeps one answer through both', async () => {
    flags.keepersOn = true
    const { clubId, rep } = await club()
    const admin = await seedAdmin()
    const first = `example-chess-${clubId}`
    const second = `example-chess-renamed-${clubId}`
    for (const slug of [first, second]) {
      const saved = await invoke(adminClubPatch, { method: 'PATCH', as: admin, params: { id: clubId }, body: { slug } })
      expect(saved.status, slug).toBe(200)
    }
    const byId = await get(rep, clubId, 'aal2')
    expect(byId.status).toBe(200)
    expect(await get(rep, second, 'aal2')).toEqual(byId)
    // The address it had before is an old one now: no club, as for an id no club has.
    const old = await get(rep, first, 'aal2')
    expect(old).toEqual(await get(rep, `no-club-${clubId}`, 'aal2'))
    expect([old.status, JSON.parse(old.body)]).toEqual([403, { error: 'Forbidden' }])
    expect([(await get(admin, first, 'aal2')).status, (await get(admin, second, 'aal2')).status]).toEqual([404, 200])
    // Taking the first address back makes it the present one again.
    expect((await invoke(adminClubPatch, { method: 'PATCH', as: admin, params: { id: clubId }, body: { slug: first } })).status).toBe(200)
    expect((await get(rep, first, 'aal2')).status).toBe(200)
    expect((await get(rep, second, 'aal2')).status).toBe(403)
  })

  it('a club with no page address is found by its id, answers its slug as null, and no value stands in for the missing address', async () => {
    flags.keepersOn = true
    const { clubId, rep } = await club()
    const admin = await seedAdmin()
    expect((await stored(clubId))?.slug).toBeNull()
    const byId = await get(rep, clubId, 'aal2')
    expect(byId.status).toBe(200)
    expect((JSON.parse(byId.body) as { club: { slug: string | null } }).club.slug).toBeNull()
    for (const value of ['null', 'undefined', 'NULL', 'none', '0']) {
      expect(await get(rep, value, 'aal2'), value).toEqual({ status: 403, body: JSON.stringify({ error: 'Forbidden' }) })
      expect(await get(admin, value, 'aal2'), value).toEqual({ status: 404, body: JSON.stringify({ error: 'Club not found' }) })
    }
  })

  it('a value written to read as another one finds no club: another case, wildcards, quotes, a path and a long value answer as an id no club has', async () => {
    flags.keepersOn = true
    const { clubId, rep } = await club()
    const admin = await seedAdmin()
    const slug = `example-chess-${clubId}`
    await env.DB.prepare('UPDATE clubs SET slug = ? WHERE id = ?').bind(slug, clubId).run()
    const values = [
      slug.toUpperCase(), ` ${slug}`, `${slug} `, `${slug}%`, '%', '_', `${slug.slice(0, -1)}_`, `' OR '1'='1`, `${slug}' --`, `${slug}/officers`, `../${slug}`, 'a'.repeat(300),
    ]
    for (const value of values) {
      for (const who of [rep, admin]) {
        const asked = await get(who, value, 'aal2')
        expect(asked, `${who} ${value}`).toEqual(await get(who, `no-club-${clubId}`, 'aal2'))
        expect(asked.body, `${who} ${value}`).not.toContain(clubId)
      }
    }
    expect((await get(rep, slug, 'aal2')).status).toBe(200)
  })

  it('a rep of another club who holds the region\'s seat is held to the region alone by the page address, and keeps today\'s answer on their own club', async () => {
    flags.keepersOn = true
    const here = await club()
    const home = await club('Example Home Club')
    await regionalSeat(home.rep)
    const slug = `example-chess-${here.clubId}`
    const homeSlug = `example-home-${home.clubId}`
    await env.DB.prepare('UPDATE clubs SET slug = ? WHERE id = ?').bind(slug, here.clubId).run()
    await env.DB.prepare('UPDATE clubs SET slug = ? WHERE id = ?').bind(homeSlug, home.clubId).run()
    const away = await get(home.rep, slug)
    expect(away.status).toBe(200)
    expect(away).toEqual(await get(home.rep, here.clubId))
    const body = JSON.parse(away.body) as { roster: unknown[]; rosterKeptBack?: boolean; officers: Array<Record<string, unknown>>; tournaments: Array<{ id: string }> }
    expect([body.roster, body.rosterKeptBack]).toEqual([[], true])
    expect(away.body).not.toContain('player.one@example.org')
    expect(body.tournaments.map((t) => t.id)).not.toContain(here.draft)
    // On their own club, by either value, the roster and the draft are theirs.
    const own = JSON.parse((await get(home.rep, homeSlug)).body) as { roster: unknown[]; rosterKeptBack?: boolean; tournaments: Array<{ id: string }> }
    expect(own.roster).toHaveLength(2)
    expect(own.rosterKeptBack).toBeUndefined()
    expect(own.tournaments.map((t) => t.id)).toContain(home.draft)
    expect(await get(home.rep, homeSlug)).toEqual(await get(home.rep, home.clubId))
  })

  it('a present page address is read before an old one: the club that holds it now is the one asked, and the old holder\'s rep is refused', async () => {
    flags.keepersOn = true
    const holder = await club()
    const former = await club('Example Former Club')
    const shared = `example-shared-${holder.clubId}`
    await env.DB.prepare('UPDATE clubs SET slug = ? WHERE id = ?').bind(shared, holder.clubId).run()
    // No save writes this (slugLeadsElsewhere refuses it); it is written here to hold the order of the reads.
    await env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(shared, former.clubId).run()
    const byHolder = await get(holder.rep, shared, 'aal2')
    expect(byHolder.status).toBe(200)
    expect((JSON.parse(byHolder.body) as { club: { id: string } }).club.id).toBe(holder.clubId)
    const byFormer = await get(former.rep, shared, 'aal2')
    expect(byFormer).toEqual({ status: 403, body: JSON.stringify({ error: 'Forbidden' }) })
    expect(byFormer.body).not.toContain(holder.clubId)
  })

  it('the stamp the page reads its last save from is the club\'s own, in UTC, for a save made by its rep, and is the same by id and by page address', async () => {
    flags.keepersOn = true
    const { clubId, rep } = await club()
    const admin = await seedAdmin()
    const slug = `example-chess-${clubId}`
    expect((await invoke(adminClubPatch, { method: 'PATCH', as: admin, params: { id: clubId }, body: { slug } })).status).toBe(200)
    const before = Date.now()
    const saved = await invoke(adminClubPatch, { method: 'PATCH', as: rep, aal: 'aal2', params: { id: clubId }, body: { aboutText: 'A friendly made-up club.' } })
    expect(saved.status).toBe(200)
    const byId = await get(rep, clubId, 'aal2')
    const bySlug = await get(rep, slug, 'aal2')
    expect(bySlug).toEqual(byId)
    const answered = (JSON.parse(bySlug.body) as { club: { told_updated_at: string; told_by: string } }).club
    // The form the page reads with stored: 'utc', whose clock is read as Greenwich's, not the server's.
    expect(answered.told_updated_at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    expect(answered.told_by).toBe(rep)
    const at = Date.parse(`${answered.told_updated_at.replace(' ', 'T')}Z`)
    expect(at).toBeGreaterThan(before - 5000 - 1000)
    expect(at).toBeLessThan(Date.now() + 5000)
    expect((await stored(clubId))?.told_updated_at).toBe(answered.told_updated_at)
  })

  it('a club saved nothing has a null stamp, so the page can say it was not saved here yet', async () => {
    flags.keepersOn = true
    const { clubId, rep } = await club()
    const answered = (JSON.parse((await get(rep, clubId, 'aal2')).body) as { club: { told_updated_at: string | null; told_by: string | null } }).club
    expect([answered.told_updated_at, answered.told_by]).toEqual([null, null])
  })

  it('the save does not take a page address: PATCH by it writes nothing, 404 for an LCA admin and 403 for the club\'s rep', async () => {
    flags.keepersOn = true
    const { clubId, rep } = await club()
    const admin = await seedAdmin()
    const slug = `example-chess-${clubId}`
    await env.DB.prepare('UPDATE clubs SET slug = ? WHERE id = ?').bind(slug, clubId).run()
    const before = await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first()
    for (const [who, status] of [[admin, 404], [rep, 403]] as const) {
      const res = await invoke(adminClubPatch, { method: 'PATCH', as: who, aal: 'aal2', params: { id: slug }, body: { aboutText: 'Not saved by an address.' } })
      expect(res.status, who).toBe(status)
    }
    expect(await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first()).toEqual(before)
  })

  it('with CLUB_KEEPERS_ON unset the GET by a page address writes nothing and answers the same twice, for the admin and the rep alike', async () => {
    const { clubId, rep } = await club()
    const admin = await seedAdmin()
    const slug = `example-chess-${clubId}`
    await env.DB.prepare('UPDATE clubs SET slug = ? WHERE id = ?').bind(slug, clubId).run()
    const before = await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first()
    for (const who of [rep, admin]) {
      const first = await get(who, slug, 'aal2')
      expect(first.status, who).toBe(who === admin ? 404 : 403)
      expect(await get(who, slug, 'aal2'), who).toEqual(first)
    }
    expect(await env.DB.prepare('SELECT * FROM clubs WHERE id = ?').bind(clubId).first()).toEqual(before)
  })
})
