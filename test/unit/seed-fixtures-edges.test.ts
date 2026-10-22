// The edges of scripts/seed/fixtures.sql, on top of seed-fixtures.test.ts
// (which checks that it loads, loads twice, and holds what it says):
//
// - D1 limits: it is data only, with no transaction, PRAGMA or schema
//   statement, which wrangler d1 execute would refuse or which would change a
//   database it should only fill
// - replays: a second load puts every row it owns back as written, whatever
//   happened to those rows in between (changed, deleted, stale children),
//   without doubling the section and schedule rows the 0053 triggers build
// - the clock: every date is relative to the day it is loaded, so it is loaded
//   here at the instants that break date arithmetic (midnight in
//   America/Chicago, both DST changes, New Year, a leap day) and the open
//   event is still open, the finished one still finished and the expired
//   member still expired
// - ties and half points: the finished event's games add up to the standings
//   the notes and the champion row state, with a tie in them, scored with
//   half points that are written as ½ and never .5
// - plain language in every text value: "US Chess" never USCF, "7:00 PM" in
//   12-hour times, no em dashes
// - the partner event has a row in the feed and nothing to register for
// - the guardian's household fits the family plan with room for one more,
//   the children carry the guardian's address (as POST /api/me/children
//   stores them) and no entry keeps a child's grade, only a confirmed range
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { FAMILY_MEMBERSHIP_CHILDREN } from '../../domain/households/family'
import { gameResultSchema } from '../../domain/contracts/events'
import { formatGradeRange, parseGradeRange } from '../../domain/events/sectionRules'
import { formatScore } from '../../domain/format/score'
import { splitSql } from '../shared/splitSql'
import { openMigratedDb, userTables } from './helpers/sqlite'

const ROOT = resolve(__dirname, '../..')
const SEED = readFileSync(join(ROOT, 'scripts/seed/fixtures.sql'), 'utf8')

type Row = Record<string, unknown>
const load = (db: DatabaseSync, sql = SEED) => {
  for (const stmt of splitSql(sql)) db.exec(stmt)
}
const all = <T = Row>(db: DatabaseSync, sql: string, ...params: Array<string | number | null>) => db.prepare(sql).all(...params) as T[]
const one = <T = Row>(db: DatabaseSync, sql: string, ...params: Array<string | number | null>) => db.prepare(sql).get(...params) as T

describe('what D1 will run', () => {
  const statements = splitSql(SEED)

  it('is data only: no transaction, PRAGMA, schema or file statements', () => {
    expect(statements.length).toBeGreaterThan(10)
    for (const stmt of statements) {
      expect(stmt, stmt.slice(0, 60)).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|PRAGMA|ATTACH|DETACH|VACUUM|CREATE|DROP|ALTER|REINDEX|ANALYZE)\b/i)
      expect(stmt).not.toMatch(/^\s*\./)
      expect(Buffer.byteLength(stmt)).toBeLessThan(100_000)
    }
  })

  it('only deletes or updates rows it owns', () => {
    const deletes = statements.filter((s) => /^\s*DELETE\b/i.test(s))
    expect(deletes.length).toBeGreaterThan(0)
    for (const stmt of deletes) expect(stmt).toMatch(/WHERE [a-z_]+ LIKE 'fx-%'/)
    for (const stmt of statements.filter((s) => /^\s*UPDATE\b/i.test(s))) expect(stmt).toMatch(/WHERE tournament_id = 'fx-/)
  })

  it('writes nothing that is not its own: every id it inserts starts with fx-', () => {
    const db = openMigratedDb()
    const before = Object.fromEntries(userTables(db).map((t) => [t, all(db, `SELECT * FROM "${t}"`).map((r) => JSON.stringify(r))]))
    load(db)
    for (const table of userTables(db)) {
      const old = new Set(before[table])
      const added = all(db, `SELECT * FROM "${table}"`).filter((r) => !old.has(JSON.stringify(r)))
      if (table === 'tournament_schedules' || table === 'tournament_schedule_rounds' || table === 'tournament_sections') continue
      for (const row of added) {
        const key = ['id', 'tournament_id', 'seat_id'].map((k) => row[k]).find((v) => typeof v === 'string')
        expect(key, `${table}: ${JSON.stringify(row).slice(0, 120)}`).toMatch(/^fx-/)
      }
    }
  })

  it('is plain text: no em dash, no en dash, no emoji, no tab characters', () => {
    expect(SEED).not.toMatch(/[\u2013\u2014]/)
    expect(SEED).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe('replays', () => {
  const rowsOwnedBySeed = (db: DatabaseSync) => {
    const out: Record<string, string[]> = {}
    for (const table of userTables(db)) {
      if (table === 'tournament_sections' || table === 'tournament_schedules' || table === 'tournament_schedule_rounds') continue
      const rows = all(db, `SELECT * FROM "${table}"`).filter((r) => ['id', 'tournament_id', 'seat_id'].some((k) => typeof r[k] === 'string' && (r[k] as string).startsWith('fx-')))
      // section_id and schedule_id are random ids the triggers make again on every load.
      out[table] = rows.map((r) => JSON.stringify(r, (k, v) => ((/(_at|cached_at)$/.test(k) && k !== 'archived_at') || k === 'section_id' || k === 'schedule_id' ? undefined : v))).sort()
    }
    return out
  }
  const counts = (db: DatabaseSync) => ({
    activeSections: all(db, "SELECT tournament_id, COUNT(*) AS n FROM tournament_sections WHERE tournament_id LIKE 'fx-%' AND archived_at IS NULL GROUP BY tournament_id ORDER BY 1"),
    allSections: one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM tournament_sections WHERE tournament_id LIKE 'fx-%'").n,
    schedules: all(db, "SELECT tournament_id, COUNT(*) AS n, SUM(is_primary) AS primaries FROM tournament_schedules WHERE tournament_id LIKE 'fx-%' GROUP BY tournament_id ORDER BY 1"),
    rounds: one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM tournament_schedule_rounds r JOIN tournament_schedules s ON s.id = r.schedule_id WHERE s.tournament_id LIKE 'fx-%'").n,
  })

  it('does not double the section and schedule rows when loaded again, or a third time', () => {
    const db = openMigratedDb()
    load(db)
    const once = counts(db)
    expect(once.activeSections).toEqual([
      { tournament_id: 'fx-t-done', n: 1 },
      { tournament_id: 'fx-t-legacy', n: 3 },
      { tournament_id: 'fx-t-open', n: 3 },
      { tournament_id: 'fx-t-quads', n: 1 },
    ])
    expect(once.schedules).toEqual([
      { tournament_id: 'fx-t-done', n: 1, primaries: 1 },
      { tournament_id: 'fx-t-legacy', n: 1, primaries: 1 },
      { tournament_id: 'fx-t-open', n: 1, primaries: 1 },
      { tournament_id: 'fx-t-quads', n: 1, primaries: 1 },
    ])
    expect(once.rounds).toBe(3)
    load(db)
    load(db)
    expect(counts(db)).toEqual(once)
    // The old section rows are removed with their tournament, not left archived.
    expect(counts(db).allSections).toBe(once.allSections)
  })

  it('puts back every row it owns after they were changed, removed or added to', () => {
    const db = openMigratedDb()
    load(db)
    const wanted = rowsOwnedBySeed(db)

    // Changed rows.
    db.exec("UPDATE state_champions SET title = 'Changed', champion = 'Someone Else' WHERE id = 'fx-champ-1'")
    db.exec("UPDATE clubs SET name = 'Changed club', city = 'Nowhere' WHERE id = 'fx-club-capital'")
    db.exec("UPDATE members SET membership_status = 'expired', full_name = 'Changed Name' WHERE id = 'fx-m-p1'")
    db.exec("UPDATE lca_posts SET pinned = 0, status = 'draft' WHERE id = 'fx-post-pinned'")
    db.exec("UPDATE governance_documents SET title = 'Changed' WHERE id = 'fx-doc-bylaws'")
    db.exec("UPDATE board_seat_assignments SET ended_at = datetime('now') WHERE id = 'fx-assign-officer'")
    db.exec("UPDATE clearinghouse SET link = 'https://example.org/changed', name = 'Changed' WHERE id = 'fx-partner-1'")
    db.exec("UPDATE tournaments SET status = 'completed', registration_status = 'closed', is_visible = 0, name = 'Changed' WHERE id = 'fx-t-open'")
    // Removed rows.
    db.exec("DELETE FROM registrations WHERE id = 'fx-r-open-1'")
    db.exec("DELETE FROM tournament_games WHERE id = 'fx-g-1-1'")
    db.exec("DELETE FROM governance_documents WHERE id = 'fx-doc-minutes'")
    db.exec("DELETE FROM state_champions WHERE id = 'fx-champ-2'")
    // Stale rows added under the seed's tournaments (the games and directors cascade; entries do not).
    db.exec("INSERT INTO registrations (id, tournament_id, member_id, section, payment_status) VALUES ('stale-r', 'fx-t-open', 'fx-m-p3', 'Open', 'paid')")
    db.exec("INSERT INTO tournament_games (id, tournament_id, round, board, section, white_member_id, black_member_id, result) VALUES ('stale-g', 'fx-t-done', 3, 9, 'Open', 'fx-m-p1', 'fx-m-p2', '1-0')")
    db.exec("UPDATE tournament_sections SET fee_regular = 999 WHERE tournament_id = 'fx-t-open' AND name = 'Open'")

    load(db)
    expect(rowsOwnedBySeed(db)).toEqual(wanted)
    expect(one(db, "SELECT COUNT(*) AS n FROM registrations WHERE id = 'stale-r'")).toEqual({ n: 0 })
    expect(one(db, "SELECT COUNT(*) AS n FROM tournament_games WHERE id = 'stale-g'")).toEqual({ n: 0 })
    expect(one(db, "SELECT fee_regular, fee_early, fee_late FROM tournament_sections WHERE tournament_id = 'fx-t-open' AND name = 'Open' AND archived_at IS NULL")).toEqual({
      fee_regular: 40,
      fee_early: 32,
      fee_late: 50,
    })
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })

  it('leaves rows that are not its own alone, including a real tournament and its entries', () => {
    const db = openMigratedDb()
    db.exec("INSERT INTO members (id, email, full_name, membership_status, membership_type, role) VALUES ('real-m', 'real.person@example.net', 'Real Person', 'active', 'adult', 'member')")
    db.exec("INSERT INTO tournaments (id, name, location, date, sections, rounds, status, registration_status, is_visible) VALUES ('real-t', 'Real Open', 'Elsewhere', '2030-01-05', '[\"Open\"]', 4, 'upcoming', 'open', 1)")
    db.exec("INSERT INTO registrations (id, tournament_id, member_id, section, payment_status) VALUES ('real-r', 'real-t', 'real-m', 'Open', 'paid')")
    const mine = () => ({
      tournament: one(db, "SELECT * FROM tournaments WHERE id = 'real-t'"),
      entry: one(db, "SELECT * FROM registrations WHERE id = 'real-r'"),
      member: one(db, "SELECT * FROM members WHERE id = 'real-m'"),
      sections: all(db, "SELECT name, position FROM tournament_sections WHERE tournament_id = 'real-t' AND archived_at IS NULL"),
    })
    const before = mine()
    load(db)
    load(db)
    expect(mine()).toEqual(before)
    expect(before.sections).toHaveLength(1)
  })

  it('does not touch a member who is not its own, even one with a seed address', () => {
    const db = openMigratedDb()
    db.exec("INSERT INTO members (id, email, full_name, membership_status, membership_type, role) VALUES ('other', 'other.person@example.net', 'Other Person', 'active', 'adult', 'member')")
    load(db)
    expect(one(db, "SELECT email, full_name, membership_type FROM members WHERE id = 'other'")).toEqual({ email: 'other.person@example.net', full_name: 'Other Person', membership_type: 'adult' })
  })
})

describe('the clock', () => {
  // The instants that break date arithmetic, in UTC. The comments give America/Chicago.
  const INSTANTS = [
    ['Chicago midnight, just before (05:59 UTC, CST)', '2026-12-01 05:59:59'],
    ['Chicago midnight, just after (06:00 UTC, CST)', '2026-12-01 06:00:00'],
    ['Chicago midnight in summer (04:59 UTC, CDT)', '2026-07-15 04:59:59'],
    ['the spring DST change (2:00 AM CST becomes 3:00 AM CDT)', '2026-03-08 08:00:00'],
    ['the hour before the spring change', '2026-03-08 07:59:59'],
    ['the fall DST change (2:00 AM CDT becomes 1:00 AM CST)', '2026-11-01 07:00:00'],
    ['New Year in UTC, still December 31 in Chicago', '2027-01-01 00:00:00'],
    ['New Year in Chicago', '2027-01-01 06:00:00'],
    ['a leap day', '2028-02-29 12:00:00'],
    ['the end of February in a leap year', '2028-02-28 23:59:59'],
    ['the end of the month', '2026-10-31 23:59:59'],
  ] as const

  /** The seed with its "now" replaced by a fixed instant. */
  const loadedAt = (instant: string) => {
    const db = openMigratedDb()
    load(db, SEED.replaceAll("'now'", `'${instant}'`))
    return db
  }
  const day = (db: DatabaseSync, sql: string, today: string, ...params: Array<string | number | null>) => {
    const row = one<{ v: string | null }>(db, sql, ...params)
    return row.v === null ? null : Math.round((Date.parse(row.v.slice(0, 10)) - Date.parse(today.slice(0, 10))) / 86_400_000)
  }

  it('the seed replaces every "now" it was written with, so the replacement is complete', () => {
    expect(SEED.match(/'now'/g)?.length).toBeGreaterThan(20)
    expect(SEED.replaceAll("'now'", "'x'")).not.toContain("'now'")
    expect(SEED).not.toMatch(/CURRENT_(DATE|TIMESTAMP)|localtime|unixepoch/i)
  })

  it.each(INSTANTS)('%s: the open event is open, the finished one finished, the expired member expired', (_label, instant) => {
    const db = loadedAt(instant)
    const open = (col: string) => day(db, `SELECT ${col} AS v FROM tournaments WHERE id = 'fx-t-open'`, instant)
    // Whole days from the day of loading, so a few hours either way cannot move them across a date.
    expect(open('date')).toBe(24)
    expect(open('end_date')).toBe(25)
    expect(open('early_deadline')).toBe(7)
    expect(open('late_after')).toBe(20)
    expect(open('registration_closes_at')).toBe(22)
    expect(open('registration_opens_at')).toBe(-10)
    expect(one(db, "SELECT status, registration_status FROM tournaments WHERE id = 'fx-t-open'")).toEqual({ status: 'upcoming', registration_status: 'open' })
    // Early price, then regular, then late, then the close, then the event.
    expect(open('early_deadline')!).toBeLessThan(open('late_after')!)
    expect(open('late_after')!).toBeLessThan(open('registration_closes_at')!)
    expect(open('registration_closes_at')!).toBeLessThan(open('date')!)

    expect(day(db, "SELECT date AS v FROM tournaments WHERE id = 'fx-t-quads'", instant)).toBe(10)
    expect(day(db, "SELECT date AS v FROM tournaments WHERE id = 'fx-t-legacy'", instant)).toBe(45)
    expect(day(db, "SELECT date AS v FROM tournaments WHERE id = 'fx-t-done'", instant)).toBe(-30)
    expect(day(db, "SELECT start_date AS v FROM clearinghouse WHERE id = 'fx-partner-1'", instant)).toBe(31)
    expect(day(db, "SELECT membership_expiry AS v FROM members WHERE id = 'fx-m-p4'", instant)).toBe(-20)
    expect(one(db, "SELECT membership_status AS s FROM members WHERE id = 'fx-m-p4'")).toEqual({ s: 'expired' })
    for (const id of ['fx-m-guardian', 'fx-m-child-1', 'fx-m-child-2', 'fx-m-p1', 'fx-m-p2', 'fx-m-p3', 'fx-m-p5']) {
      expect(day(db, 'SELECT membership_expiry AS v FROM members WHERE id = ?', instant, id)!, id).toBeGreaterThanOrEqual(90)
    }
  })

  it.each(INSTANTS)('%s: the rounds of the quads sit on the event day and the pinned post is the newest', (_label, instant) => {
    const db = loadedAt(instant)
    const dates = all<{ round: number; time: string }>(db, `SELECT r.round, r.time FROM tournament_schedule_rounds r JOIN tournament_schedules s ON s.id = r.schedule_id WHERE s.tournament_id = 'fx-t-quads' ORDER BY r.round`)
    expect(dates).toEqual([{ round: 1, time: '10:00' }, { round: 2, time: '11:30' }, { round: 3, time: '13:00' }])
    const rs = JSON.parse(one<{ round_schedule: string }>(db, "SELECT round_schedule FROM tournaments WHERE id = 'fx-t-quads'").round_schedule) as Array<{ date: string }>
    const quadsDate = one<{ date: string }>(db, "SELECT date FROM tournaments WHERE id = 'fx-t-quads'").date
    for (const r of rs) expect(r.date).toBe(quadsDate)
    const posts = all<{ id: string; published_at: string }>(db, "SELECT id, published_at FROM lca_posts WHERE id LIKE 'fx-%' ORDER BY published_at DESC")
    expect(posts.map((p) => p.id)).toEqual(['fx-post-pinned', 'fx-post-recap'])
    expect(posts[0].published_at < instant).toBe(true)
  })

  it('the champions are for this year and last year, whichever instant it is loaded', () => {
    for (const [, instant] of INSTANTS) {
      const db = loadedAt(instant)
      const year = Number(instant.slice(0, 4))
      expect(all(db, "SELECT year FROM state_champions WHERE id LIKE 'fx-%' ORDER BY year DESC"), instant).toEqual([{ year }, { year: year - 1 }])
    }
  })
})

describe('the finished event: half points and a tie', () => {
  const db = openMigratedDb()
  load(db)
  const games = all<{ round: number; board: number; white_member_id: string; black_member_id: string | null; result: string }>(
    db,
    "SELECT round, board, white_member_id, black_member_id, result FROM tournament_games WHERE tournament_id = 'fx-t-done' ORDER BY round, board",
  )
  const SCORES: Record<string, [number, number]> = { '1-0': [1, 0], '0-1': [0, 1], '1/2-1/2': [0.5, 0.5], bye: [1, 0], 'bye-half': [0.5, 0] }
  const totals = new Map<string, number>()
  for (const g of games) {
    const [w, b] = SCORES[g.result]
    totals.set(g.white_member_id, (totals.get(g.white_member_id) ?? 0) + w)
    if (g.black_member_id) totals.set(g.black_member_id, (totals.get(g.black_member_id) ?? 0) + b)
  }
  const name = (id: string) => one<{ full_name: string }>(db, 'SELECT full_name FROM members WHERE id = ?', id).full_name

  it('uses only results the site accepts, and scores each as a whole or half point', () => {
    for (const g of games) {
      expect(gameResultSchema.safeParse(g.result).success, g.result).toBe(true)
      expect(Object.keys(SCORES)).toContain(g.result)
    }
    expect(games.some((g) => g.result === '1/2-1/2')).toBe(true)
    expect(games.some((g) => g.result === 'bye')).toBe(true)
    expect(games.filter((g) => g.result === 'bye-half').length).toBe(2)
    expect(games.some((g) => g.result === 'pending')).toBe(false)
  })

  it('has each of the five players once in every round, and no pair of them twice', () => {
    const entrants = all<{ member_id: string }>(db, "SELECT member_id FROM registrations WHERE tournament_id = 'fx-t-done'").map((r) => r.member_id).sort()
    expect(entrants).toHaveLength(5)
    const pairs = new Set<string>()
    for (const round of [1, 2, 3]) {
      const inRound = games.filter((g) => g.round === round)
      const players = inRound.flatMap((g) => [g.white_member_id, g.black_member_id]).filter((p): p is string => p !== null).sort()
      expect(players, `round ${round}`).toEqual(entrants)
      expect(new Set(inRound.map((g) => g.board)).size, `boards in round ${round}`).toBe(inRound.length)
      // A bye has no opponent and the sit-out is only ever one player.
      expect(inRound.filter((g) => g.black_member_id === null)).toHaveLength(1)
    }
    for (const g of games) {
      if (!g.black_member_id) continue
      const key = [g.white_member_id, g.black_member_id].sort().join('|')
      expect(pairs.has(key), key).toBe(false)
      pairs.add(key)
      expect(g.white_member_id).not.toBe(g.black_member_id)
    }
    expect(games.length).toBe(9)
  })

  it('adds up to the standings the seed describes: 2½, 2, 1½, 1½ and ½', () => {
    const standings = [...totals.entries()].map(([id, pts]) => ({ player: name(id), pts })).sort((a, b) => b.pts - a.pts || a.player.localeCompare(b.player))
    expect(standings).toEqual([
      { player: 'Avery Fixture', pts: 2.5 },
      { player: 'Riley Fixture', pts: 2 },
      { player: 'Casey Fixture', pts: 1.5 },
      { player: 'Morgan Fixture', pts: 1.5 },
      { player: 'Jordan Fixture', pts: 0.5 },
    ])
    // Every game hands out one point in all.
    expect([...totals.values()].reduce((a, b) => a + b, 0)).toBe(games.filter((g) => g.black_member_id !== null).length + games.filter((g) => g.result === 'bye').length + 0.5 * games.filter((g) => g.result === 'bye-half').length)
  })

  it('has a tie, and the tie is not for first place', () => {
    const values = [...totals.values()]
    const tied = values.filter((v, i) => values.indexOf(v) !== i)
    expect(tied).toEqual([1.5])
    expect(Math.max(...values)).toBe(2.5)
    expect(values.filter((v) => v === 2.5)).toHaveLength(1)
  })

  it('the champion row and its notes agree with the winner, and write the score with ½', () => {
    const champion = one<{ champion: string; notes: string; tournament_id: string }>(db, "SELECT champion, notes, tournament_id FROM state_champions WHERE id = 'fx-champ-1'")
    const [winnerId, winnerScore] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0]
    expect(champion.champion).toBe(name(winnerId))
    expect(champion.notes).toBe(`Won with ${formatScore(winnerScore)} of ${one<{ rounds: number }>(db, "SELECT rounds FROM tournaments WHERE id = 'fx-t-done'").rounds}.`)
    expect(champion.notes).toContain('2½')
    expect(champion.tournament_id).toBe('fx-t-done')
  })

  it('the news recap says the same thing', () => {
    expect(one<{ body_html: string }>(db, "SELECT body_html FROM lca_posts WHERE id = 'fx-post-recap'").body_html).toContain('Avery Fixture won with 2½ of 3.')
  })

  it('every game is in the section the entries are in', () => {
    const sections = new Set(all<{ section: string }>(db, "SELECT DISTINCT section FROM registrations WHERE tournament_id = 'fx-t-done'").map((r) => r.section))
    for (const g of all<{ section: string }>(db, "SELECT section FROM tournament_games WHERE tournament_id = 'fx-t-done'")) expect(sections.has(g.section)).toBe(true)
  })
})

describe('plain language in every text value', () => {
  const db = openMigratedDb()
  load(db)

  /** Every text value of every row the seed owns, with where it is. */
  const texts: Array<{ where: string; value: string }> = []
  for (const table of userTables(db)) {
    for (const row of all(db, `SELECT * FROM "${table}"`)) {
      const owned = ['id', 'tournament_id', 'seat_id'].some((k) => typeof row[k] === 'string' && (row[k] as string).startsWith('fx-'))
      if (!owned) continue
      for (const [col, value] of Object.entries(row)) if (typeof value === 'string') texts.push({ where: `${table}.${col} of ${String(row.id ?? row.tournament_id)}`, value })
    }
  }

  it('finds the text it is checking', () => {
    expect(texts.length).toBeGreaterThan(150)
  })

  it('says "US Chess", never USCF', () => {
    // pairing_system holds the code 'uscf', the column's default; it is never shown as text.
    expect(texts.filter((t) => /\bUSCF\b/i.test(t.value) && !t.where.startsWith('tournaments.pairing_system')).map((t) => t.where)).toEqual([])
    expect(texts.some((t) => /\bUS Chess\b/.test(t.value))).toBe(true)
    expect(SEED.replace(/uscf_(rating|id)/g, '')).not.toMatch(/uscf/i)
  })

  it('writes half points as ½, never .5, in any sentence', () => {
    const decimals = texts.filter((t) => /(^|[^\d.])\d+\.5(?!\d)/.test(t.value) && !/^[-\d.]+$/.test(t.value))
    expect(decimals.map((t) => `${t.where}: ${t.value}`)).toEqual([])
    expect(texts.some((t) => t.value.includes('2½'))).toBe(true)
  })

  it('writes every 12-hour time as "7:00 PM": a space, capital letters, no dots', () => {
    const found = texts.flatMap((t) => (t.value.match(/\b\d{1,2}:\d{2}\s*(?:[ap]\.m\.|[ap]m)(?![a-z])/gi) ?? []).map((m) => ({ where: t.where, time: m })))
    expect(found.length).toBeGreaterThan(3)
    expect(found.filter((f) => !/^\d{1,2}:\d{2} (AM|PM)$/.test(f.time))).toEqual([])
    expect(found.some((f) => f.time === '7:00 PM')).toBe(true)
  })

  it('keeps stored round times as plain 24-hour HH:MM, which is a storage format and not text shown to people', () => {
    for (const t of all<{ time: string }>(db, 'SELECT time FROM tournament_schedule_rounds')) expect(t.time).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
  })

  it('has no em dash or en dash in any value, and no leading or trailing space', () => {
    expect(texts.filter((t) => /[\u2013\u2014]/.test(t.value)).map((t) => t.where)).toEqual([])
    expect(texts.filter((t) => t.value !== t.value.trim()).map((t) => t.where)).toEqual([])
  })

  it('shows no real name: every person, champion and seat holder is "<first name> Fixture"', () => {
    const names = [
      ...all<{ v: string }>(db, "SELECT full_name AS v FROM members WHERE id LIKE 'fx-%'"),
      ...all<{ v: string }>(db, "SELECT champion AS v FROM state_champions WHERE id LIKE 'fx-%'"),
      ...all<{ v: string }>(db, "SELECT name AS v FROM board_members WHERE id LIKE 'fx-%'"),
    ]
    expect(names.length).toBeGreaterThan(10)
    for (const n of names) expect(n.v).toMatch(/^[A-Z][a-z]+ Fixture$/)
  })

  it('names every event, club, post and document with "Fixture", so a test page can never be mistaken for the real site', () => {
    const titles = [
      ...all<{ v: string }>(db, "SELECT name AS v FROM tournaments WHERE id LIKE 'fx-%'"),
      ...all<{ v: string }>(db, "SELECT name AS v FROM clubs WHERE id LIKE 'fx-%'"),
      ...all<{ v: string }>(db, "SELECT title AS v FROM lca_posts WHERE id LIKE 'fx-%'"),
      ...all<{ v: string }>(db, "SELECT title AS v FROM governance_documents WHERE id LIKE 'fx-%'"),
      ...all<{ v: string }>(db, "SELECT name AS v FROM clearinghouse WHERE id LIKE 'fx-%'"),
      ...all<{ v: string }>(db, "SELECT title AS v FROM state_champions WHERE id LIKE 'fx-%'"),
    ]
    expect(titles.length).toBe(4 + 2 + 2 + 3 + 1 + 2)
    for (const t of titles) expect(t.v, t.v).toMatch(/Fixture/)
  })
})

describe('the partner event and the household', () => {
  const db = openMigratedDb()
  load(db)

  it('the partner event is in the feed only: nothing to register for, no entries, no count', () => {
    expect(one(db, "SELECT is_lca, link FROM clearinghouse WHERE id = 'fx-partner-1'")).toEqual({ is_lca: 0, link: 'https://example.org/fixture-gulf-coast-open' })
    for (const sql of [
      "SELECT COUNT(*) AS n FROM tournaments WHERE id = 'fx-partner-1'",
      "SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = 'fx-partner-1'",
      "SELECT COUNT(*) AS n FROM tournament_sections WHERE tournament_id = 'fx-partner-1'",
      "SELECT COUNT(*) AS n FROM tournament_games WHERE tournament_id = 'fx-partner-1'",
    ]) {
      expect(one(db, sql), sql).toEqual({ n: 0 })
    }
    // It is out of state, so it falls under the regional list on the Tournaments page.
    expect(one(db, "SELECT state FROM clearinghouse WHERE id = 'fx-partner-1'")).toEqual({ state: 'MS' })
  })

  it('the open event has an entry for the guardian\'s children and a spot count to show', () => {
    expect(all(db, "SELECT member_id FROM registrations WHERE tournament_id = 'fx-t-open' AND member_id LIKE 'fx-m-child-%' ORDER BY 1")).toEqual([{ member_id: 'fx-m-child-1' }, { member_id: 'fx-m-child-2' }])
    expect(one(db, "SELECT max_players, (SELECT COUNT(*) FROM registrations WHERE tournament_id = 'fx-t-open') AS entered FROM tournaments WHERE id = 'fx-t-open'")).toEqual({ max_players: 120, entered: 3 })
  })

  it('the guardian has two children on the family plan, which leaves room for one more', () => {
    const children = all<{ id: string; membership_type: string; guardian_id: string }>(db, "SELECT id, membership_type, guardian_id FROM members WHERE guardian_id = 'fx-m-guardian'")
    expect(children).toHaveLength(2)
    expect(children.length).toBeLessThan(FAMILY_MEMBERSHIP_CHILDREN)
    for (const c of children) expect(c.membership_type).toBe('family')
    expect(one(db, "SELECT membership_type, guardian_id FROM members WHERE id = 'fx-m-guardian'")).toEqual({ membership_type: 'family', guardian_id: null })
    // The children are not their own guardians and the guardian is nobody's child.
    expect(one(db, "SELECT COUNT(*) AS n FROM members WHERE id LIKE 'fx-%' AND guardian_id = id")).toEqual({ n: 0 })
    expect(one(db, "SELECT COUNT(*) AS n FROM members WHERE id LIKE 'fx-%' AND guardian_id IS NOT NULL AND guardian_id NOT LIKE 'fx-m-%'")).toEqual({ n: 0 })
  })

  it('one guardian only, so the e2e family spec has one household to sign in as', () => {
    expect(one(db, "SELECT COUNT(DISTINCT guardian_id) AS n FROM members WHERE guardian_id LIKE 'fx-%'")).toEqual({ n: 1 })
  })

  it('every adult has their own example.org address, and each child carries the guardian\'s, as POST /api/me/children stores it', () => {
    const adults = all<{ email: string }>(db, "SELECT email FROM members WHERE id LIKE 'fx-%' AND guardian_id IS NULL").map((r) => r.email)
    expect(new Set(adults).size).toBe(adults.length)
    for (const e of adults) expect(e).toMatch(/^[a-z.]+@example\.org$/)
    expect(all(db, "SELECT c.id FROM members c JOIN members g ON g.id = c.guardian_id WHERE c.id LIKE 'fx-%' AND c.email <> g.email")).toEqual([])
    expect(one(db, "SELECT COUNT(*) AS n FROM members WHERE guardian_id = 'fx-m-guardian' AND email = 'dana.fixture@example.org'")).toEqual({ n: 2 })
  })

  it('no entry stores a child\'s grade: only the confirmed range, in the "min-max" shape the registration endpoints write', () => {
    const grades = all<{ member_id: string; grade: string | null }>(db, "SELECT member_id, grade FROM registrations WHERE id LIKE 'fx-%' ORDER BY id")
    expect(grades.filter((r) => r.member_id.startsWith('fx-m-child-')).map((r) => r.grade)).toEqual(['0-12', '0-12'])
    for (const { member_id, grade } of grades) {
      if (grade === null) continue
      const range = parseGradeRange(grade)
      expect(range, member_id).not.toBeNull()
      expect(formatGradeRange(range!), member_id).toBe(grade)
    }
  })
})
