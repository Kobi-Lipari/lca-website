// test/unit/schema-drift.test.ts
//
// functions/db/schema.ts must describe exactly the database the migrations
// build. This applies migrations/*.sql in order to a node:sqlite database
// (foreign keys on, as on D1) and compares it with the Drizzle tables, in
// both directions:
//
// - tables: every table in one is in the other
// - columns: name, type affinity, NOT NULL, default and primary key
// - indexes made with CREATE INDEX: name, unique, columns (with DESC) and
//   the WHERE of a partial index
// - foreign keys: columns, parent table and columns, ON DELETE and ON UPDATE
//
// So a migration that adds a column (or table, index or foreign key) without
// the same change in schema.ts fails here, and so does the reverse. What the
// schema leaves out on purpose (CHECK constraints, inline UNIQUE constraints,
// triggers) is listed in its header comment and not compared.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { is, SQL } from 'drizzle-orm'
import { getTableConfig, integer, primaryKey, SQLiteSyncDialect, SQLiteTable, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import * as schema from '../../functions/db/schema'
import { foreignKeysOn, openMigratedDb, userTables } from './helpers/sqlite'

const dialect = new SQLiteSyncDialect()
const render = (s: SQL) => dialect.sqlToQuery(s).sql

/** The affinity SQLite gives a declared column type (section 3.1 of its datatype docs). */
export function affinity(declared: string): 'INTEGER' | 'TEXT' | 'BLOB' | 'REAL' | 'NUMERIC' {
  const t = declared.toUpperCase()
  if (t.includes('INT')) return 'INTEGER'
  if (/CHAR|CLOB|TEXT/.test(t)) return 'TEXT'
  if (t === '' || t.includes('BLOB')) return 'BLOB'
  if (/REAL|FLOA|DOUB/.test(t)) return 'REAL'
  return 'NUMERIC'
}

/** A default as comparable text: outer brackets and spacing removed. */
export function normaliseDefault(value: string | null): string | null {
  if (value === null) return null
  let v = value.trim()
  while (v.startsWith('(') && v.endsWith(')') && balanced(v.slice(1, -1))) v = v.slice(1, -1).trim()
  return v.replace(/\s+/g, ' ')
}

function balanced(s: string): boolean {
  let depth = 0
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')' && --depth < 0) return false
  }
  return depth === 0
}

/** A Drizzle default written the way SQLite reports it. */
function drizzleDefault(value: unknown): string | null {
  if (value === undefined) return null
  if (value === null) return 'NULL'
  if (is(value, SQL)) return render(value)
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`
  if (typeof value === 'boolean') return value ? '1' : '0'
  return String(value)
}

const drizzleTables = Object.values(schema).filter((v): v is SQLiteTable => is(v, SQLiteTable))

interface ColumnShape { affinity: string; notnull: boolean; default: string | null; pk: boolean }
interface IndexShape { unique: boolean; columns: string[]; where: string | null }

const pragma = <T>(db: DatabaseSync, sql: string) => db.prepare(sql).all() as unknown as T[]

function dbColumns(db: DatabaseSync, table: string): Map<string, ColumnShape> {
  const rows = pragma<{ name: string; type: string; notnull: number; dflt_value: string | null; pk: number }>(db, `PRAGMA table_info("${table}")`)
  const pkCount = rows.filter((r) => r.pk > 0).length
  return new Map(rows.map((r) => [r.name, {
    affinity: affinity(r.type),
    // SQLite lets a lone non-INTEGER primary key hold NULL unless it says
    // NOT NULL; Drizzle always marks a primary key NOT NULL.
    notnull: r.notnull === 1 || (r.pk > 0 && pkCount === 1),
    default: normaliseDefault(r.dflt_value),
    pk: r.pk > 0,
  }]))
}

function schemaColumns(table: SQLiteTable): Map<string, ColumnShape> {
  const config = getTableConfig(table)
  const compositePk = new Set(config.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name)))
  return new Map(config.columns.map((c) => [c.name, {
    affinity: affinity(c.getSQLType()),
    notnull: c.notNull,
    default: normaliseDefault(drizzleDefault(c.default)),
    pk: c.primary || compositePk.has(c.name),
  }]))
}

function dbIndexes(db: DatabaseSync, table: string): Map<string, IndexShape> {
  const out = new Map<string, IndexShape>()
  for (const ix of pragma<{ name: string; unique: number; origin: string; partial: number }>(db, `PRAGMA index_list("${table}")`)) {
    if (ix.origin !== 'c') continue // pk and inline UNIQUE indexes are SQLite's own
    const columns = pragma<{ name: string | null; desc: number; key: number }>(db, `PRAGMA index_xinfo("${ix.name}")`)
      .filter((c) => c.key === 1)
      .map((c) => `${c.name}${c.desc ? ' DESC' : ''}`)
    const created = (db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ?`).get(ix.name) as { sql: string }).sql
    const where = ix.partial ? /\bWHERE\b([\s\S]*)$/i.exec(created)?.[1] ?? '' : null
    out.set(ix.name, { unique: ix.unique === 1, columns, where: where === null ? null : normaliseDefault(where) })
  }
  return out
}

function schemaIndexes(table: SQLiteTable): Map<string, IndexShape> {
  return new Map(getTableConfig(table).indexes.map((ix) => [ix.config.name, {
    unique: ix.config.unique,
    columns: ix.config.columns.map((c) => (is(c, SQL) ? normaliseDefault(render(c)) as string : c.name)),
    where: ix.config.where ? normaliseDefault(render(ix.config.where)) : null,
  }]))
}

const action = (a: string | undefined | null) => (a ?? 'no action').toLowerCase()

function dbForeignKeys(db: DatabaseSync, table: string): string[] {
  const rows = pragma<{ id: number; table: string; from: string; to: string | null; on_update: string; on_delete: string }>(db, `PRAGMA foreign_key_list("${table}")`)
  const byId = new Map<number, typeof rows>()
  for (const r of rows) byId.set(r.id, [...(byId.get(r.id) ?? []), r])
  return [...byId.values()].map((fk) => {
    const parentPk = () => pragma<{ name: string; pk: number }>(db, `PRAGMA table_info("${fk[0].table}")`).filter((c) => c.pk > 0).map((c) => c.name)
    const to = fk.every((r) => r.to !== null) ? fk.map((r) => r.to) : parentPk()
    return `(${fk.map((r) => r.from).join(', ')}) -> ${fk[0].table}(${to.join(', ')}) on delete ${action(fk[0].on_delete)} on update ${action(fk[0].on_update)}`
  }).sort()
}

function schemaForeignKeys(table: SQLiteTable): string[] {
  return getTableConfig(table).foreignKeys.map((fk) => {
    const ref = fk.reference()
    return `(${ref.columns.map((c) => c.name).join(', ')}) -> ${getTableConfig(ref.foreignTable).name}(${ref.foreignColumns.map((c) => c.name).join(', ')}) on delete ${action(fk.onDelete)} on update ${action(fk.onUpdate)}`
  }).sort()
}

/** Every difference between the database and the Drizzle tables, in plain words. */
export function schemaDrift(db: DatabaseSync, tables: SQLiteTable[] = drizzleTables): string[] {
  const problems: string[] = []
  const inDb = new Set(userTables(db))
  const inSchema = new Map(tables.map((t) => [getTableConfig(t).name, t]))
  for (const name of inDb) if (!inSchema.has(name)) problems.push(`table ${name}: in the database, not in schema.ts`)
  for (const name of inSchema.keys()) if (!inDb.has(name)) problems.push(`table ${name}: in schema.ts, not in the database`)

  for (const [name, table] of inSchema) {
    if (!inDb.has(name)) continue
    const compare = <T>(kind: string, a: Map<string, T>, b: Map<string, T>) => {
      for (const key of a.keys()) if (!b.has(key)) problems.push(`${kind} ${name}.${key}: in the database, not in schema.ts`)
      for (const key of b.keys()) if (!a.has(key)) problems.push(`${kind} ${name}.${key}: in schema.ts, not in the database`)
      for (const [key, shape] of a) {
        const other = b.get(key)
        if (other && JSON.stringify(shape) !== JSON.stringify(other)) {
          problems.push(`${kind} ${name}.${key}: database ${JSON.stringify(shape)}, schema.ts ${JSON.stringify(other)}`)
        }
      }
    }
    compare('column', dbColumns(db, name), schemaColumns(table))
    compare('index', dbIndexes(db, name), schemaIndexes(table))
    const dbFks = dbForeignKeys(db, name)
    const schemaFks = schemaForeignKeys(table)
    for (const fk of dbFks) if (!schemaFks.includes(fk)) problems.push(`foreign key ${name} ${fk}: in the database, not in schema.ts`)
    for (const fk of schemaFks) if (!dbFks.includes(fk)) problems.push(`foreign key ${name} ${fk}: in schema.ts, not in the database`)
  }
  return problems
}

describe('functions/db/schema.ts matches the migrations', () => {
  const db = openMigratedDb()

  it('builds the database with foreign keys on, as on D1', () => {
    expect(foreignKeysOn(db)).toBe(1)
  })

  it('has the 32 tables the migrations create', () => {
    expect(userTables(db)).toHaveLength(32)
    expect(drizzleTables).toHaveLength(32)
  })

  it('has no difference in tables, columns, indexes or foreign keys', () => {
    expect(schemaDrift(db)).toEqual([])
  })

  it('compares every column of every table', () => {
    const counted = userTables(db).reduce((n, t) => n + dbColumns(db, t).size, 0)
    const modelled = drizzleTables.reduce((n, t) => n + getTableConfig(t).columns.length, 0)
    expect(counted).toBe(313)
    expect(modelled).toBe(313)
  })
})

describe('the drift check fails when the two disagree', () => {
  it('fails when a migration adds a column that schema.ts lacks', () => {
    const db = openMigratedDb({ extra: 'ALTER TABLE members ADD COLUMN nickname TEXT;' })
    expect(schemaDrift(db)).toEqual(['column members.nickname: in the database, not in schema.ts'])
  })

  it('fails when a migration adds a table, an index or a foreign key that schema.ts lacks', () => {
    const db = openMigratedDb({
      extra: `CREATE TABLE notes (id TEXT PRIMARY KEY);
              CREATE INDEX idx_members_full_name ON members(full_name);
              ALTER TABLE clubs ADD COLUMN owner_id TEXT REFERENCES members(id) ON DELETE SET NULL;`,
    })
    const drift = schemaDrift(db)
    expect(drift).toContain('table notes: in the database, not in schema.ts')
    expect(drift).toContain('index members.idx_members_full_name: in the database, not in schema.ts')
    expect(drift).toContain('column clubs.owner_id: in the database, not in schema.ts')
    expect(drift).toContain('foreign key clubs (owner_id) -> members(id) on delete set null on update no action: in the database, not in schema.ts')
  })

  it('fails when schema.ts has a column the database lacks', () => {
    const db = openMigratedDb()
    const scanUsage = sqliteTable('scan_usage', {
      memberId: text('member_id').notNull().references(() => schema.members.id),
      day: text().notNull(),
      count: integer().default(0).notNull(),
      extra: integer(),
    }, (t) => [primaryKey({ columns: [t.memberId, t.day] })])
    const tables = drizzleTables.map((t) => (t === schema.scanUsage ? scanUsage : t))
    expect(schemaDrift(db, tables)).toContain('column scan_usage.extra: in schema.ts, not in the database')
  })

  it('fails on a changed type, NOT NULL, default or primary key', () => {
    const db = openMigratedDb()
    const tables = drizzleTables.map((t) => (getTableConfig(t).name === 'site_announcement'
      ? sqliteTable('site_announcement', {
        id: text().primaryKey(),
        enabled: integer().default(1),
        message: text().default('').notNull(),
        linkUrl: text('link_url'),
        linkLabel: text('link_label'),
        updatedAt: text('updated_at').notNull(),
        updatedBy: text('updated_by'),
      })
      : t))
    const drift = schemaDrift(db, tables).join('\n')
    expect(drift).toMatch(/column site_announcement\.id: .*"affinity":"INTEGER".*"affinity":"TEXT"/)
    expect(drift).toMatch(/column site_announcement\.enabled: .*"notnull":true,"default":"0".*"notnull":false,"default":"1"/)
    expect(drift).toMatch(/column site_announcement\.updated_at: .*"default":"datetime\('now'\)".*"default":null/)
  })
})

describe('helpers', () => {
  it('reads affinity the way SQLite does', () => {
    expect(['INTEGER', 'BIGINT', 'TEXT', 'VARCHAR(20)', 'CLOB', 'BLOB', '', 'REAL', 'DOUBLE', 'FLOAT', 'NUMERIC', 'DATETIME', 'BOOLEAN'].map(affinity))
      .toEqual(['INTEGER', 'INTEGER', 'TEXT', 'TEXT', 'TEXT', 'BLOB', 'BLOB', 'REAL', 'REAL', 'REAL', 'NUMERIC', 'NUMERIC', 'NUMERIC'])
  })

  it('compares defaults without their outer brackets', () => {
    expect(normaliseDefault("(datetime('now'))")).toBe("datetime('now')")
    expect(normaliseDefault('((lower(hex(randomblob(8)))))')).toBe('lower(hex(randomblob(8)))')
    expect(normaliseDefault('(a) + (b)')).toBe('(a) + (b)')
    expect(normaliseDefault('(NULL)')).toBe('NULL')
    expect(normaliseDefault(null)).toBeNull()
  })
})

describe('test/unit/helpers/sqlite.ts', () => {
  it('does not rely on the driver default: SQLite itself starts with foreign keys off', () => {
    // node:sqlite happens to switch them on by default (its
    // enableForeignKeyConstraints option); SQLite and other drivers do not.
    const plain = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false })
    expect(foreignKeysOn(plain)).toBe(0)
    plain.close()
    const helper = readFileSync(join(__dirname, 'helpers/sqlite.ts'), 'utf8')
    expect(helper.indexOf("db.exec('PRAGMA foreign_keys = ON')")).toBeGreaterThan(-1)
    expect(helper.indexOf("db.exec('PRAGMA foreign_keys = ON')")).toBeLessThan(helper.indexOf('applyMigrations(db, options.files)'))
  })

  it('switches foreign keys on before the first migration runs', () => {
    expect(foreignKeysOn(openMigratedDb({ files: [] }))).toBe(1)
  })

  it('keeps them on through every migration, so cascades behave as on D1', () => {
    const db = openMigratedDb()
    expect(foreignKeysOn(db)).toBe(1)
    db.exec(`INSERT INTO members (id, email, full_name) VALUES ('m1', 'm1@test.lca', 'M One')`)
    db.exec(`INSERT INTO tournaments (id, name, location, date, entry_fee) VALUES ('t1', 'T', 'Kenner, LA', '2026-09-12', 0)`)
    db.exec(`INSERT INTO tournament_directors (tournament_id, member_id) VALUES ('t1', 'm1')`)
    expect(() => db.exec(`INSERT INTO tournament_directors (tournament_id, member_id) VALUES ('t1', 'nobody')`)).toThrow(/FOREIGN KEY/)
    db.exec(`DELETE FROM tournaments WHERE id = 't1'`)
    expect(db.prepare('SELECT COUNT(*) AS n FROM tournament_directors').get()).toEqual({ n: 0 })
  })
})
