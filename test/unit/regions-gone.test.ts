// test/unit/regions-gone.test.ts
//
// The club regions as the five regional seats' titles (K's decision 14 of
// Wednesday, November 18, 2026), held from the outside:
// - nothing the product ships (the site, the functions, the shared domain
//   code, the worker, the seed and the static files) names any of the five
//   region names that are gone, and no schema file or drizzle snapshot holds
//   a region's name or knows migration 0072;
// - migration 0072 and the way back written for it: on the real clubs, and on
//   a club of every town the way back names, the reverse table puts each club
//   in the region it held before, so the record's reverse table is true of
//   the clubs as the migration left them.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REGIONS } from '../../domain/clubs/regions'
import { splitSql } from '../shared/splitSql'
import { MIGRATIONS_DIR, migrationFiles, openMigratedDb } from './helpers/sqlite'

const ROOT = resolve(__dirname, '../..')
const GONE = ['Central Louisiana', 'North of Lake Pontchartrain', 'Southwest Louisiana', 'South Central Louisiana', 'Bayou Region']
const TEXT_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|json|sql|html|css|md|toml|txt|xml|svg|_headers)$|^_headers$|^_redirects$/

/** Every text file under the folders, never inside node_modules, dist or a build's output. */
function filesUnder(path: string): string[] {
  const full = join(ROOT, path)
  if (!existsSync(full)) return []
  if (statSync(full).isFile()) return [path]
  const out: string[] = []
  for (const entry of readdirSync(full, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.wrangler', '.git'].includes(entry.name)) continue
    const child = join(path, entry.name)
    if (entry.isDirectory()) out.push(...filesUnder(child))
    else if (TEXT_FILE.test(entry.name)) out.push(child)
  }
  return out
}

describe('nothing the product ships names a region that is gone', () => {
  const shipped = ['src', 'functions', 'domain', 'workers', 'public', 'scripts/seed', 'index.html']

  it('holds none of the five names in the site, the functions, the shared code, the worker, the seed or the static files', () => {
    const files = shipped.flatMap(filesUnder)
    expect(files.length).toBeGreaterThan(200)
    const hits: string[] = []
    for (const file of files) {
      const text = readFileSync(join(ROOT, file), 'utf8')
      for (const name of GONE) if (text.includes(name)) hits.push(`${file}: ${name}`)
    }
    expect(hits).toEqual([])
  })

  it('holds each of the five names in the one list and nowhere the list is not read', () => {
    const text = readFileSync(join(ROOT, 'domain/clubs/regions.ts'), 'utf8')
    for (const region of REGIONS) expect(text, region).toContain(`'${region}'`)
    for (const name of GONE) expect(text, name).not.toContain(name)
  })

  it('leaves the schema and the drizzle baseline with no region name and no knowledge of 0072', () => {
    const files = ['functions/db/schema.ts', ...filesUnder('drizzle')]
    expect(files.length).toBeGreaterThan(1)
    for (const file of files) {
      const text = readFileSync(join(ROOT, file), 'utf8')
      for (const name of [...GONE, ...REGIONS, 'regions_by_seat']) expect(text, `${file}: ${name}`).not.toContain(name)
    }
  })
})

/** The way back as the record gives it, in SQL, by new region and town. */
const WAY_BACK = [
  `UPDATE clubs SET region = 'Southwest Louisiana' WHERE region = 'Lake Charles / Southwestern'`,
  `UPDATE clubs SET region = 'South Central Louisiana' WHERE region = 'Baton Rouge / East Central'`,
  `UPDATE clubs SET region = 'South Central Louisiana' WHERE region = 'Lafayette / South Central' AND city IN ('Lafayette', 'Opelousas')`,
  `UPDATE clubs SET region = 'Bayou Region' WHERE region = 'Lafayette / South Central' AND city = 'Morgan City'`,
  `UPDATE clubs SET region = 'Central Louisiana' WHERE region = 'Lafayette / South Central' AND city IN ('Pineville', 'Bunkie')`,
  `UPDATE clubs SET region = 'North of Lake Pontchartrain' WHERE region = 'New Orleans Metro' AND city IN ('Mandeville', 'Slidell', 'Picayune')`,
  `UPDATE clubs SET region = 'Bayou Region' WHERE region = 'New Orleans Metro' AND city = 'Houma'`,
]

describe('the way back for the clubs as the migration left them', () => {
  const forward = splitSql(readFileSync(join(MIGRATIONS_DIR, '0072_regions_by_seat.sql'), 'utf8'))

  it('puts each of the real clubs back in the region it held before', () => {
    const db = openMigratedDb({ files: migrationFiles().filter((f) => f < '0072') })
    const before = db.prepare('SELECT id, city, region FROM clubs ORDER BY id').all()
    expect(before).toHaveLength(25)
    for (const stmt of forward) db.prepare(stmt).run()
    const moved = db.prepare('SELECT id, region FROM clubs ORDER BY id').all() as Array<{ id: string; region: string }>
    for (const club of moved) expect(REGIONS as readonly string[], club.id).toContain(club.region)
    for (const stmt of WAY_BACK) db.prepare(stmt).run()
    expect(db.prepare('SELECT id, city, region FROM clubs ORDER BY id').all()).toEqual(before)
    db.close()
  })

  it('puts a club of every town the way back names in its old region, and leaves the two regions that stayed', () => {
    const db = openMigratedDb({ files: migrationFiles().filter((f) => f < '0072') })
    // Clubs the migrations seeded are left and the example clubs are read apart by their ids.
    const rows: Array<[string, string]> = [
      ['Southwest Louisiana', 'Sulphur'],
      ['South Central Louisiana', 'Baton Rouge'],
      ['South Central Louisiana', 'Gonzales'],
      ['South Central Louisiana', 'Lafayette'],
      ['South Central Louisiana', 'Opelousas'],
      ['Bayou Region', 'Morgan City'],
      ['Bayou Region', 'Houma'],
      ['Central Louisiana', 'Pineville'],
      ['Central Louisiana', 'Bunkie'],
      ['North of Lake Pontchartrain', 'Mandeville'],
      ['North of Lake Pontchartrain', 'Slidell'],
      ['North of Lake Pontchartrain', 'Picayune'],
      ['New Orleans Metro', 'Metairie'],
      ['North Louisiana', 'Shreveport'],
    ]
    const insert = db.prepare(`INSERT INTO clubs (id, name, city, region) VALUES (?, 'Example Knights Club', ?, ?)`)
    rows.forEach(([region, city], i) => insert.run(`example-${i}`, city, region))
    for (const stmt of forward) db.prepare(stmt).run()
    for (const stmt of WAY_BACK) db.prepare(stmt).run()
    const after = db.prepare(`SELECT city, region FROM clubs WHERE id LIKE 'example-%' ORDER BY rowid`).all() as Array<{ city: string; region: string }>
    expect(after).toEqual(rows.map(([region, city]) => ({ city, region })))
    db.close()
  })
})
