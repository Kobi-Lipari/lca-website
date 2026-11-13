// test/integration/club-create-after-seed.test.ts
//
// POST /api/admin/clubs on the test database, which applies every migration,
// so today's 25 clubs carry the slugs and old addresses migration 0067
// seeds (WS09 step 5):
// - the six clubs whose id differs from the slug of their name hold that
//   slug, with their id kept as an old slug;
// - a new club whose name gives one of those slugs, or one of those old
//   ids, gets the first free suffix on its id and its slug alike, and the
//   seeded club keeps its own;
// - a new club whose name gives the slug of a club whose id is its slug
//   gets a suffix too.
// Only the names are like the seeded clubs'; every person here is made up.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { onRequestPost as clubCreate } from '../../functions/api/admin/clubs'
import { seedAdmin } from './factories'
import { invoke, resetHarness } from './harness'

beforeEach(resetHarness)

const create = (as: string, name: string) => invoke(clubCreate, { method: 'POST', as, body: { name, city: 'Example City' } })
const row = (id: string) => env.DB.prepare('SELECT id, name, slug FROM clubs WHERE id = ?').bind(id).first<{ id: string; name: string; slug: string | null }>()

describe('a new club after the seed', () => {
  it('finds the six seeded slugs and old addresses in the test database', async () => {
    const { results } = await env.DB.prepare(
      'SELECT h.old_slug, c.slug FROM club_slug_history h JOIN clubs c ON c.id = h.club_id ORDER BY h.old_slug',
    ).all<{ old_slug: string; slug: string }>()
    expect(results).toEqual([
      { old_slug: 'baton-rouge', slug: 'baton-rouge-chess-club' },
      { old_slug: 'metairie', slug: 'metairie-chess-academy' },
      { old_slug: 'monroe', slug: 'monroe-chess-club' },
      { old_slug: 'ruston', slug: 'ruston-knights-chess-club' },
      { old_slug: 'shreveport', slug: 'shreveport-bossier-chess-club' },
      { old_slug: 'slidell', slug: 'slidell-chess-club' },
    ])
  })

  it('a new club named as one of the six gets a suffix, from the seeded slug or the old id, and the seeded club keeps its own', async () => {
    const admin = await seedAdmin()
    for (const [name, expected] of [
      ['Slidell Chess Club', 'slidell-chess-club-2'],
      ['Slidell', 'slidell-2'],
      ['Shreveport Bossier Chess Club', 'shreveport-bossier-chess-club-2'],
      ['Metairie', 'metairie-2'],
      ['Houma Chess Club', 'houma-chess-club-2'],
    ] as const) {
      const res = await create(admin, name)
      expect(res.status, name).toBe(201)
      const { club } = await res.json<{ club: { id: string } }>()
      expect(club.id, name).toBe(expected)
      expect(await row(expected), name).toEqual({ id: expected, name, slug: expected })
    }
    expect(await row('slidell')).toEqual({ id: 'slidell', name: 'Slidell Chess Club', slug: 'slidell-chess-club' })
    expect(await row('houma-chess-club')).toEqual({ id: 'houma-chess-club', name: 'Houma Chess Club', slug: 'houma-chess-club' })
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM club_slug_history').first()).toEqual({ n: 6 })
  })
})
