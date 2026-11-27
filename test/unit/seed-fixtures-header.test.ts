// test/unit/seed-fixtures-header.test.ts
//
// The header of scripts/seed/fixtures.sql, the words a person reads before
// loading the seed into the branch preview database, says what a load does
// (checkpoint W's review): every table the file deletes from is named in
// it, a row the seed owns has an id or a club_id that starts "fx-", the
// fixture clubs' places are said to be deleted and written again, and the
// newest migration it names is a migration that exists and is the newest
// one whose schema the file writes to. Reads the file only.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const SEED = readFileSync(join(ROOT, 'scripts/seed/fixtures.sql'), 'utf8')

/** The header: the comment lines the file opens with, up to its first line of SQL. */
function header(): string {
  const lines: string[] = []
  for (const line of SEED.split('\n')) {
    if (line.startsWith('--')) lines.push(line.replace(/^--\s?/, ''))
    else if (line.trim() === '') lines.push('')
    else break
  }
  return lines.join('\n').replace(/\s+/g, ' ')
}

describe('the seed\'s header', () => {
  it('names every table the file deletes from', () => {
    const tables = [...new Set([...SEED.matchAll(/^\s*DELETE FROM (\w+)/gim)].map((m) => m[1]))]
    expect(tables.sort()).toEqual(['club_places', 'registrations', 'tournaments'])
    for (const table of tables) expect(header(), table).toMatch(new RegExp(`\\b${table}\\b`))
  })

  it('says a row it owns has an id, or a club_id, that starts "fx-", and that the fixture clubs\' places are deleted and written again', () => {
    const words = header()
    expect(words).toContain('Every row it owns has an id, or a club_id, starting "fx-"')
    expect(words).toContain('the fixture clubs\' places (club_places) are deleted and written again with their fixed ids, 90001 to 90003, on every load, which removes any other place on a fixture club')
    for (const id of ['90001', '90002', '90003']) expect(SEED).toContain(`(${id}, 'fx-club-`)
    for (const m of SEED.matchAll(/^\s*DELETE FROM \w+ WHERE (\w+) LIKE '(.*?)';/gim)) expect(m[2], m[1]).toBe('fx-%')
  })

  it('names the newest migration the file needs, which exists, and no older one as its last', () => {
    const named = header().match(/written against the schema after migration (\d{4}), the newest it needs \((\d{4})_(\w+)\.sql/)
    expect(named, 'the migration line').not.toBeNull()
    const [, number, file, rest] = named!
    expect(file).toBe(number)
    expect(existsSync(join(ROOT, 'migrations', `${file}_${rest}.sql`))).toBe(true)
    expect(header()).toContain(`needs migrations 0001 to ${number} applied first`)
    // The club page's columns and club_places, which the file writes, come from this migration.
    const migration = readFileSync(join(ROOT, 'migrations', `${file}_${rest}.sql`), 'utf8')
    for (const piece of ['\nCREATE TABLE club_places (', 'how_we_meet_text']) expect(migration, piece).toContain(piece)
    // No migration after it adds a column or a table the file names.
    const later = readdirSync(join(ROOT, 'migrations')).filter((f) => /^\d{4}_.*\.sql$/.test(f) && f.slice(0, 4) > number)
    for (const f of later) {
      const sql = readFileSync(join(ROOT, 'migrations', f), 'utf8')
      for (const m of sql.matchAll(/ALTER TABLE (\w+) ADD COLUMN (\w+)|CREATE TABLE(?: IF NOT EXISTS)? (\w+)/g)) {
        const column = m[2] ?? m[3]
        expect(SEED.includes(column), `${f} adds ${column}, which the seed writes`).toBe(false)
      }
    }
  })
})
