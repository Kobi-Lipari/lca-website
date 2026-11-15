// test/integration/clubTables.ts
//
// Helpers for the tests of migration 0066's tables and columns (WS09 step
// 4): rows that name a club or a member in every new place, and a database
// that answers as one would before 0066 has run.
//
// The test database applies every migration before each file, so a
// database built to 0060 alone is not on hand here. laggingDb wraps the
// test's D1 and refuses each statement that names a table or a column 0066
// adds with the words D1 itself answers ("D1_ERROR: no such table: x" or
// "no such column: x"), a batch that holds one included, as D1 refuses the
// whole batch. test/unit/club-tables-lagging-run.test.ts runs the same
// handlers on a real database built to 0060 alone.
import { env } from 'cloudflare:test'

/** What a database before migration 0066 lacks. */
export interface Missing {
  /** A table or a column 0066 adds, such as 'club_rep_requests' or 'told_by'. */
  name: string
  kind: 'table' | 'column'
}

/** The test's D1, refusing every statement that names `missing` as D1 would before 0066 ran. */
export function laggingDb(missing: Missing): D1Database {
  const word = new RegExp(`\\b${missing.name}\\b`)
  const refusal = () => new Error(`D1_ERROR: no such ${missing.kind}: ${missing.name}: SQLITE_ERROR`)
  const sqlOf = new WeakMap<object, string>()
  const real = new WeakMap<object, D1PreparedStatement>()
  const wrap = (statement: D1PreparedStatement, sql: string): D1PreparedStatement => {
    const run = <T>(work: () => Promise<T>): Promise<T> => (word.test(sql) ? Promise.reject(refusal()) : work())
    const wrapped = {
      bind: (...values: unknown[]) => wrap(statement.bind(...values), sql),
      first: (column?: string) => run(() => (column === undefined ? statement.first() : statement.first(column))),
      run: () => run(() => statement.run()),
      all: () => run(() => statement.all()),
      raw: (options?: { columnNames?: boolean }) => run(() => statement.raw(options as { columnNames: true })),
    }
    sqlOf.set(wrapped, sql)
    real.set(wrapped, statement)
    return wrapped as unknown as D1PreparedStatement
  }
  const db = {
    prepare: (sql: string) => wrap(env.DB.prepare(sql), sql),
    batch: (statements: D1PreparedStatement[]) => {
      if (statements.some((s) => word.test(sqlOf.get(s) ?? ''))) return Promise.reject(refusal())
      return env.DB.batch(statements.map((s) => real.get(s) ?? s))
    },
    exec: (sql: string) => (word.test(sql) ? Promise.reject(refusal()) : env.DB.exec(sql)),
    dump: () => env.DB.dump(),
  }
  return db as unknown as D1Database
}

/** The tables and columns migration 0066 adds, each as a database before it would miss it. */
export const MISSING_BEFORE_0066: Missing[] = [
  { name: 'club_slug_history', kind: 'table' },
  { name: 'club_places', kind: 'table' },
  { name: 'club_reports', kind: 'table' },
  { name: 'club_rep_requests', kind: 'table' },
  { name: 'slug', kind: 'column' },
  { name: 'told_by', kind: 'column' },
  { name: 'confirmed_by', kind: 'column' },
]

const count = async (sql: string, ...binds: unknown[]) => (await env.DB.prepare(sql).bind(...binds).first<{ n: number }>())!.n

/** How many rows of each new table name the club, and of clubs name the member as its last save or check. */
export async function clubRowCounts(clubId: string): Promise<Record<string, number>> {
  return {
    club_places: await count('SELECT COUNT(*) AS n FROM club_places WHERE club_id = ?', clubId),
    club_slug_history: await count('SELECT COUNT(*) AS n FROM club_slug_history WHERE club_id = ?', clubId),
    club_reports: await count('SELECT COUNT(*) AS n FROM club_reports WHERE club_id = ?', clubId),
    club_rep_requests: await count('SELECT COUNT(*) AS n FROM club_rep_requests WHERE club_id = ?', clubId),
  }
}

/** A club with a row in each of the four new tables: two places, an old slug, a report and a rep request from `member`. */
export async function giveClubRows(clubId: string, member: string, oldSlug: string): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO club_places (club_id, name, street, note, latitude, longitude, sort) VALUES (?, 'Example Library', '1 Example Street', 'Meeting room past the front desk', 30.45, -91.15, 0)`).bind(clubId),
    env.DB.prepare(`INSERT INTO club_places (club_id, name, sort) VALUES (?, 'Example Coffee House', 1)`).bind(clubId),
    env.DB.prepare('INSERT INTO club_slug_history (old_slug, club_id) VALUES (?, ?)').bind(oldSlug, clubId),
    env.DB.prepare(`INSERT INTO club_reports (club_id, kind, field, message) VALUES (?, 'suggestion', 'when', 'They meet on Tuesdays now.')`).bind(clubId),
    env.DB.prepare(`INSERT INTO club_rep_requests (club_id, member_id, connection, note) VALUES (?, ?, 'runs_it', 'A made up note.')`).bind(clubId, member),
  ])
}
