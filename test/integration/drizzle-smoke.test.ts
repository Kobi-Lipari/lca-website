// test/integration/drizzle-smoke.test.ts
//
// Drizzle through getDb (functions/db/client.ts) on the Miniflare D1 binding
// the rest of the suite uses, with the database built from migrations/*.sql
// by setup.ts. No endpoint uses Drizzle yet, so there is no route to call and
// no role-safety case to add; this only proves the query builder, the
// relational API and the D1 driver work together in the Workers runtime.
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { and, count, eq } from 'drizzle-orm'
import { getDb } from '../../functions/db/client'
import { clubs, members, tournamentDirectors, tournaments } from '../../functions/db/schema'
import { resetHarness } from './harness'
import { seedClub, seedMember, seedTournament, seedTournamentDirector } from './factories'

beforeEach(resetHarness)

describe('Drizzle on D1', () => {
  it('selects a row the plain D1 factories wrote', async () => {
    const id = await seedMember({ fullName: 'Ada Arceneaux', email: 'ada@test.lca' })
    const db = getDb(env.DB)
    const rows = await db.select({ id: members.id, fullName: members.fullName, role: members.role })
      .from(members)
      .where(eq(members.id, id))
    expect(rows).toEqual([{ id, fullName: 'Ada Arceneaux', role: 'member' }])
  })

  it('reads the column defaults the migrations set', async () => {
    const id = await seedTournament()
    const [row] = await getDb(env.DB).select().from(tournaments).where(eq(tournaments.id, id))
    expect(row.lateFee).toBe(0)
    expect(row.keepApart).toBe('family')
    expect(row.pairingSystem).toBe('uscf')
    expect(row.createdAt).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/)
  })

  it('writes through Drizzle and reads back through plain D1', async () => {
    const db = getDb(env.DB)
    await db.insert(clubs).values({ id: 'club-drizzle', name: 'Drizzle Chess Club', city: 'Lafayette' })
    const row = await env.DB.prepare('SELECT name, color FROM clubs WHERE id = ?').bind('club-drizzle').first()
    expect(row).toEqual({ name: 'Drizzle Chess Club', color: '#c8a94a' })
  })

  it('runs aggregates and the relational API', async () => {
    const clubId = await seedClub()
    const memberId = await seedMember({ clubId })
    const tournamentId = await seedTournament({ clubId })
    await seedTournamentDirector(tournamentId, memberId)
    const db = getDb(env.DB)

    const [{ n }] = await db.select({ n: count() }).from(tournamentDirectors)
      .where(and(eq(tournamentDirectors.tournamentId, tournamentId), eq(tournamentDirectors.memberId, memberId)))
    expect(n).toBe(1)

    const found = await db.query.members.findFirst({
      where: eq(members.id, memberId),
      with: { club: true, tournamentDirectors: true },
    })
    expect(found?.club?.id).toBe(clubId)
    expect(found?.tournamentDirectors.map((d) => d.tournamentId)).toEqual([tournamentId])
  })
})
