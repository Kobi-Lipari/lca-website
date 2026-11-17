// test/unit/club-seed-review.test.ts
//
// What checkpoint S's merge-safety review changed in migration 0067 and in
// its check sheet, on a real SQLite database built from every migration
// before 0067:
// - a typed slug is written only while the club keeps the name 0013 stored,
//   since the slug is made from that name; one of the six renamed since takes
//   its id, as the other 19 do, and gets no old address;
// - a club added since the 25 takes its id as its slug only when the id has
//   the form domain/clubs/slug.ts gives a slug; any other id leaves the slug
//   empty for K;
// - the check sheet prints each club's description and location as they now
//   stand, so the apostrophe mend, part (g), shows on it, and a sheet made
//   without part (g) differs from the full one there.
// The clubs a case adds are made up; the six are the clubs under test.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { afterAll, describe, expect, it } from 'vitest'
import { slugFor } from '../../domain/clubs/slug'
import { clubSeedSheet } from '../../scripts/db/club-seed-sheet'
import { splitSql } from '../shared/splitSql'
import { MIGRATIONS_DIR, migrationFiles, openMigratedDb } from './helpers/sqlite'

const FILE = '0067_club_pages_seed.sql'
const BEFORE = migrationFiles().filter((f) => f < '0067')
const TEXT = readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8')
// Each build applies every migration; the cases get room, as the sheet's own test does.
const BUILD_TIME = 60_000

/** The six clubs whose id differs from the slug of their name, each with its name as 0013 stored it and that slug. */
const SIX: Record<string, [string, string]> = {
  'baton-rouge': ['Baton Rouge Chess Club', 'baton-rouge-chess-club'],
  metairie: ['Metairie Chess Academy', 'metairie-chess-academy'],
  monroe: ['Monroe Chess Club', 'monroe-chess-club'],
  ruston: ['Ruston Knights Chess Club', 'ruston-knights-chess-club'],
  shreveport: ['Shreveport-Bossier Chess Club', 'shreveport-bossier-chess-club'],
  slidell: ['Slidell Chess Club', 'slidell-chess-club'],
}

type Row = Record<string, unknown>
const all = <T = Row>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) =>
  db.prepare(sql).all(...args) as unknown as T[]
const slugs = (db: DatabaseSync) => Object.fromEntries(all<{ id: string; slug: string | null }>(db, 'SELECT id, slug FROM clubs').map((r) => [r.id, r.slug]))
const history = (db: DatabaseSync) => all<{ old_slug: string; club_id: string }>(db, 'SELECT old_slug, club_id FROM club_slug_history ORDER BY old_slug')

function seeded(extra = '', text = TEXT, path?: string): DatabaseSync {
  const db = openMigratedDb({ files: BEFORE, extra, path })
  for (const stmt of splitSql(text)) db.exec(stmt)
  return db
}
/** The file with one of its parts taken out: from the part's comment, after a blank line, to the next part's. */
function without(key: string): string {
  const marks = [...TEXT.matchAll(/\n\n-- \(([a-g]\d?)\)/g)]
  const at = marks.findIndex((m) => m[1] === key)
  expect(at, key).toBeGreaterThan(-1)
  return TEXT.slice(0, marks[at].index) + (at + 1 < marks.length ? TEXT.slice(marks[at + 1].index) : '\n')
}

const dirs: string[] = []
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

describe('migration 0067 after checkpoint S\'s review: the slugs', () => {
  it('writes each typed slug against the name 0013 stored, and a club of the six renamed since takes its id with no old address', () => {
    for (const [id, [name, slug]] of Object.entries(SIX)) {
      expect(slugFor(name), id).toBe(slug)
      expect(TEXT, id).toContain(`UPDATE clubs SET slug = '${slug}'\n WHERE id = '${id}' AND slug IS NULL\n   AND name = '${name}'\n`)
    }
    const db = seeded(`UPDATE clubs SET name = 'Example Renamed Chess Club' WHERE id = 'ruston'`)
    const after = slugs(db)
    expect(after.ruston).toBe('ruston')
    for (const [id, [, slug]] of Object.entries(SIX)) if (id !== 'ruston') expect(after[id], id).toBe(slug)
    expect(history(db).map((h) => h.old_slug)).toEqual(['baton-rouge', 'metairie', 'monroe', 'shreveport', 'slidell'])
    expect(new Set(Object.values(after)).size).toBe(Object.keys(after).length)
    // The seed as the migrations' rows hold it is unchanged: six typed, 19 equal to their id.
    const full = slugs(seeded())
    expect(Object.entries(full).filter(([id, slug]) => slug === id)).toHaveLength(19)
    for (const [id, [, slug]] of Object.entries(SIX)) expect(full[id], id).toBe(slug)
  }, BUILD_TIME)

  it('gives a club added since its id as its slug only when the id has the form of a slug, and leaves any other id empty for K', () => {
    const LONG = `${'example-'.repeat(6)}chess-club-lx2k9q1`
    expect(LONG.length).toBeGreaterThan(48)
    const added = ['example-chess-club', 'Example Club', 'example-club-', '-example-club', 'example--club', 'example_club', LONG]
    const db = seeded(added.map((id) => `INSERT INTO clubs (id, name, city) VALUES ('${id}', 'Example Chess Club', 'Example City')`).join(';\n'))
    const after = slugs(db)
    expect(after['example-chess-club']).toBe('example-chess-club')
    for (const id of added.slice(1)) expect(after[id], id).toBeNull()
    expect(slugFor('Example Chess Club')).toBe('example-chess-club')
    for (const [id, slug] of Object.entries(after)) {
      if (slug === null) continue
      expect(slug, id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      expect(slug.length, id).toBeLessThanOrEqual(48)
    }
  }, BUILD_TIME)
})

describe('the check sheet after checkpoint S\'s review', () => {
  it('prints each club\'s description and location as they now stand, so the mend of part (g) shows on it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'club-seed-review-'))
    dirs.push(dir)
    const fullPath = join(dir, 'full.sqlite')
    const noMendPath = join(dir, 'without-g.sqlite')
    const full = seeded('', TEXT, fullPath)
    const rows = all<{ id: string; description: string | null; location: string | null }>(full, 'SELECT id, description, location FROM clubs')
    full.close()
    seeded('', without('g'), noMendPath).close()
    const sheet = clubSeedSheet(fullPath)
    const sheetWithoutMend = clubSeedSheet(noMendPath)
    const entry = (text: string, id: string) => text.split(/\n(?=\d+\. )/).find((e) => e.includes(`(id ${id})\n`)) ?? ''
    expect(rows).toHaveLength(25)
    for (const row of rows) {
      expect(entry(sheet, row.id), row.id).toContain(`\n   Description today: ${row.description ?? 'None'}\n`)
      expect(entry(sheet, row.id), row.id).toContain(`\n   Location today: ${row.location ?? 'None'}\n`)
    }
    const twice = String.fromCharCode(39, 39)
    for (const id of ['slidell', 'mandeville-chess-club']) {
      expect(entry(sheet, id), id).not.toContain(twice)
      expect(entry(sheetWithoutMend, id), id).toContain(twice)
    }
    expect(entry(sheet, 'slidell')).toContain('   Location today: St. Luke\'s, 910 Cross Gates Blvd., Slidell, LA 70461\n')
    expect(entry(sheet, 'mandeville-chess-club')).toMatch(/\n {3}Description today: .*George's/)
    // Without the mend the two sheets differ in those two clubs' entries alone, and in the line that names the file.
    const differ = sheet.split('\n').filter((line, i) => line !== sheetWithoutMend.split('\n')[i])
    expect(differ.filter((l) => !l.startsWith('Read from ')).every((l) => /^ {3}(?:Description|Location) today: /.test(l))).toBe(true)
    expect(differ.filter((l) => !l.startsWith('Read from ')).length).toBe(4)
  }, BUILD_TIME)
})
