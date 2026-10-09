// test/integration/drizzle-d1-schema.test.ts
//
// functions/db/schema.ts and relations.ts against the real Workers runtime
// and the D1 database built from migrations/*.sql, not the node:sqlite copy
// the unit drift test uses. No endpoint calls Drizzle yet, so there is no
// route and no role-safety case; this checks the typed layer agrees with D1:
//
// - every table and column in the schema exists in D1, and the reverse
// - every table can be selected through getDb with all its columns
// - every relation compiles and runs as a relational query
// - foreign keys are enforced and cascade on D1 when the write goes through
//   Drizzle (the behaviour the migration-safety rules depend on)
// - the Drizzle write keeps the column defaults and the member role triggers
//   the schema leaves out
import { env } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { eq, is, sql } from 'drizzle-orm'
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core'
import { getDb } from '../../functions/db/client'
import * as schema from '../../functions/db/schema'
import { resetHarness } from './harness'
import { seedMember, seedTournament } from './factories'

beforeEach(resetHarness)

const tables = Object.values(schema).filter((v): v is SQLiteTable => is(v, SQLiteTable))

async function d1Tables(): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
       AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
       AND name <> 'd1_migrations'
     ORDER BY name`,
  ).all<{ name: string }>()
  return results.map((r) => r.name)
}

describe('schema.ts against D1', () => {
  it('has the same tables as D1, in both directions', async () => {
    expect(tables.map((t) => getTableConfig(t).name).sort()).toEqual(await d1Tables())
  })

  it('has the same columns as D1 for every table, in both directions', async () => {
    for (const table of tables) {
      const { name, columns } = getTableConfig(table)
      const { results } = await env.DB.prepare(`SELECT name FROM pragma_table_info('${name}') ORDER BY name`).all<{ name: string }>()
      expect({ table: name, columns: columns.map((c) => c.name).sort() }).toEqual({ table: name, columns: results.map((r) => r.name) })
    }
  })

  it('selects every column of every table through getDb', async () => {
    const db = getDb(env.DB)
    for (const table of tables) {
      const rows = await db.select().from(table).limit(1)
      expect(Array.isArray(rows), getTableConfig(table).name).toBe(true)
    }
  })
})

describe('relations.ts against D1', () => {
  it('runs every relation of every table as a relational query', async () => {
    const db = getDb(env.DB)
    const config = db._.schema
    expect(Object.keys(config).length).toBe(tables.length)
    let relationCount = 0
    for (const [key, table] of Object.entries(config)) {
      const names = Object.keys(table.relations)
      relationCount += names.length
      const withAll = Object.fromEntries(names.map((n) => [n, true])) as Record<string, true>
      const query = (db.query as unknown as Record<string, { findMany(o: object): Promise<unknown[]> }>)[key]
      const rows = await query.findMany({ with: withAll, limit: 1 })
      expect(Array.isArray(rows), `${key}: ${names.join(', ')}`).toBe(true)
    }
    // Every foreign key has a relation on its own table.
    const fkCount = tables.reduce((n, t) => n + getTableConfig(t).foreignKeys.length, 0)
    expect(relationCount).toBeGreaterThanOrEqual(fkCount)
  })

  it('reads the guardian and dependents of a family account', async () => {
    const guardian = await seedMember({ email: 'guardian@test.lca', fullName: 'Gail Guardian' })
    const child = await seedMember({ email: 'child@test.lca', fullName: 'Cal Child' })
    await env.DB.prepare('UPDATE members SET guardian_id = ? WHERE id = ?').bind(guardian, child).run()
    const db = getDb(env.DB)
    const parent = await db.query.members.findFirst({ where: eq(schema.members.id, guardian), with: { dependents: true } })
    expect(parent?.dependents.map((d) => d.id)).toEqual([child])
    const kid = await db.query.members.findFirst({ where: eq(schema.members.id, child), with: { guardian: true } })
    expect(kid?.guardian?.fullName).toBe('Gail Guardian')
  })
})

describe('writes through Drizzle keep the database rules', () => {
  it('enforces foreign keys on D1', async () => {
    const db = getDb(env.DB)
    await expect(db.insert(schema.tournamentDirectors).values({ tournamentId: 'no-such-tournament', memberId: 'no-such-member' })).rejects.toThrow()
    const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(schema.tournamentDirectors)
    expect(n).toBe(0)
  })

  it('cascades a delete to the child rows', async () => {
    const memberId = await seedMember()
    const tournamentId = await seedTournament()
    const db = getDb(env.DB)
    await db.insert(schema.tournamentDirectors).values({ tournamentId, memberId })
    expect(await db.select().from(schema.tournamentDirectors)).toHaveLength(1)
    await db.delete(schema.tournaments).where(eq(schema.tournaments.id, tournamentId))
    expect(await db.select().from(schema.tournamentDirectors)).toHaveLength(0)
  })

  it('fills the defaults the migrations set when a column is left out', async () => {
    const db = getDb(env.DB)
    await db.insert(schema.members).values({ id: 'm-defaults', email: 'defaults@test.lca', fullName: 'Dee Faults' })
    const [row] = await db.select().from(schema.members).where(eq(schema.members.id, 'm-defaults'))
    expect(row.role).toBe('member')
    expect(row.createdAt).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/)
  })

  it('still runs the members role trigger on a Drizzle write', async () => {
    const db = getDb(env.DB)
    await db.insert(schema.members).values({ id: 'm-role', email: 'role@test.lca', fullName: 'Rae Role' })
    await expect(db.update(schema.members).set({ role: 'not_a_role' }).where(eq(schema.members.id, 'm-role'))).rejects.toThrow()
    const [row] = await db.select({ role: schema.members.role }).from(schema.members).where(eq(schema.members.id, 'm-role'))
    expect(row.role).toBe('member')
  })

  it('batches statements in one round trip', async () => {
    const db = getDb(env.DB)
    await db.batch([
      db.insert(schema.clubs).values({ id: 'batch-a', name: 'Batch A', city: 'Houma' }),
      db.insert(schema.clubs).values({ id: 'batch-b', name: 'Batch B', city: 'Monroe' }),
    ])
    const rows = await db.select({ id: schema.clubs.id }).from(schema.clubs).where(sql`${schema.clubs.id} LIKE 'batch-%'`)
    expect(rows.map((r) => r.id).sort()).toEqual(['batch-a', 'batch-b'])
  })
})
