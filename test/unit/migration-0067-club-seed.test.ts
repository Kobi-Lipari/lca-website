// test/unit/migration-0067-club-seed.test.ts
//
// Migration 0067 (WS09 step 5), the seed on today's clubs, on a real SQLite
// database with foreign keys on, as on D1, built from every migration before
// it and then 0067:
// - 25 distinct slugs, none NULL and none a reserved word, each the slug of
//   the club's name or its id, the six that differ typed out;
// - six old-address rows, none pointing a club at its own slug;
// - the 18 statements the Clubs-H board draws, and seven empty;
// - seven About texts, from today's description, and 18 empty;
// - 25 first places and Shreveport-Bossier's second, each pin the one
//   today's map list holds for that club, matched by hand;
// - no doubled apostrophe, none of US Chess's old initials, no long or
//   short dash and no range written with a hyphen in any seeded text, and
//   the two doubled apostrophes in today's text mended;
// - a row whose description was changed keeps an empty statement and an
//   empty About; a club added since gets slug = id and the told date alone;
//   a club with a stored point keeps it; a slug another club holds is left;
//   a second run changes nothing;
// - nothing else moves: no other column, no other table, no schema;
// - its header names the staged file its journal entry names, and that
//   entry's snapshot follows the one before with the same schema.
// The clubs a case adds are made up.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { RESERVED_SLUGS, slugFor } from '../../domain/clubs/slug'
import { CLUB_MAP_PINS } from '../../src/areas/clubs/clubMapData'
import { splitSql } from '../shared/splitSql'
import { MIGRATIONS_DIR, migrationFiles, openMigratedDb, userTables } from './helpers/sqlite'

const FILE = '0067_club_pages_seed.sql'
const BEFORE = migrationFiles().filter((f) => f < '0067')
const TEXT = readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8')
const STATEMENTS = splitSql(TEXT)

/** A long or a short dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** A range of numbers written with a hyphen, as "1-5". */
const HYPHEN_RANGE = /\d\s*-\s*\d/

/** The six clubs whose id differs from the slug of their name, and that slug. */
const TYPED_SLUGS: Record<string, string> = {
  'baton-rouge': 'baton-rouge-chess-club',
  metairie: 'metairie-chess-academy',
  monroe: 'monroe-chess-club',
  ruston: 'ruston-knights-chess-club',
  shreveport: 'shreveport-bossier-chess-club',
  slidell: 'slidell-chess-club',
}

/** The 18 statements, as the Clubs-H board draws them, with "to" in each range. */
const STATEMENTS_BY_ID: Record<string, string> = {
  'baton-rouge': 'Saturdays 10:00 AM at Jones Creek Branch Library, G/90+30. Casual meets Wednesdays 6:00 PM at Boba ParTea on O\'Neil Lane.',
  'beauregard-parish-youth-chess': 'Every Wednesday during the summer months, 1:00 to 2:00 PM.',
  'bluebonnet-chess-club': 'Meets bi-weekly at Bluebonnet Library on the 1st and 3rd Sunday of the month, 4:30 to 5:30 PM.',
  'bunkie-chess-club': 'Tuesdays 4:00 to 6:00 PM at the Bunkie Library. Open to all ages 8 to 108. Free to join.',
  'downriver-chess-club': 'Monday and Thursday evenings at 7:00 PM. Game 15, no delay. $1 to 2 entry with US Chess membership.',
  'greater-new-orleans-chess-club': 'Tuesdays 7:00 PM. 5-round G/90 tournaments, one round per week. Arrive by 6:30 PM to register.',
  'heart-of-worship-church-chess': 'Fridays 5:30 to 7:00 PM. Open to anyone: join before church for chess.',
  'houma-chess-club': 'Mondays 6:00 to 8:30 PM at Terrebonne Parish North Library.',
  'mandeville-chess-club': 'Meets Mondays at 5:00 PM at George\'s Mexican Restaurant.',
  'marrero-chess-organization': 'Wednesdays 6:00 to 10:00 PM at Chopsticks Buffet. No entry fee, all welcome. Skittles games only.',
  monroe: 'Monday evenings 5:30 PM at Enochs Pub and Grill. Saturday mornings 10:00 AM at Books-A-Million. All ages welcome.',
  'morgan-city-chess-club': '1st, 3rd and 5th Tuesday evenings at 5:30 PM at First Baptist Church.',
  'new-orleans-westbank-chess-club': 'US Chess rated tournaments Thursdays 7:30 to 11:30 PM. Beginners welcome.',
  'picayune-chess-club': 'Mondays 6:00 to 10:00 PM at IHOP. Casual games. Quick-rated tournaments the 1st Monday of each month (4 rounds, G/20 d5).',
  'pineville-homeschool-chess-club': 'Meets monthly 12:30 to 2:30 PM at 300 Pearce Rd, Pineville. Must be a CCHSA homeschool group member.',
  ruston: 'Tuesday nights at 6:00 PM at Utility Brewing Company.',
  shreveport: 'Mondays at Gamers XP, 1:00 to 5:00 PM. Thursdays at Pierre Bossier Mall in the food court, 1:00 to 5:00 PM.',
  slidell: 'Fridays at 7:00 PM at St. Luke\'s, 910 Cross Gates Blvd., Classroom 3.',
}

/** The seven clubs with no statement, each with its About text. */
const ABOUT_BY_ID: Record<string, string> = {
  'casa-de-ajedrez': 'Leisure/casual play, US Chess rated tournaments, online chess, and lessons. Sulphur/Lake Charles area.',
  'gonzales-chess-club': 'Chess club serving the Gonzales area.',
  'knight-light-chess': 'Summer camps, after-school programs, private instruction, and community tournaments.',
  'lafayette-chess-club': 'Hosts the Louisiana Open every Memorial Day Weekend and Lafayette Open in October. All skill levels welcome.',
  metairie: 'Chess instruction and play for kids of all ages.',
  'north-kenner-library-chess-club': 'Skittles chess for players of all ages and abilities. North Kenner Public Library Meeting Room.',
  'strategic-thoughts-nola': 'Youth chess programs in schools and NORD centers. Building a diverse chess community in New Orleans.',
}

const ALL_IDS = [...Object.keys(STATEMENTS_BY_ID), ...Object.keys(ABOUT_BY_ID)].sort()

/** Each club's pin in today's map list, matched to its id by hand: the pins' names differ from the clubs'. */
const PIN_BY_ID: Record<string, string> = {
  'baton-rouge': 'Baton Rouge Chess Club',
  'beauregard-parish-youth-chess': 'Beauregard Parish Youth Chess',
  'bluebonnet-chess-club': 'Bluebonnet Chess Club (B.R.)',
  'bunkie-chess-club': 'Bunkie Chess Club',
  'casa-de-ajedrez': 'Casa de Ajedrez',
  'downriver-chess-club': 'Downriver Chess Club',
  'gonzales-chess-club': 'Gonzales Chess Club',
  'greater-new-orleans-chess-club': 'Greater New Orleans Chess Club',
  'heart-of-worship-church-chess': 'Heart of Worship Church',
  'houma-chess-club': 'Houma Chess Club',
  'knight-light-chess': 'Knight Light Chess',
  'lafayette-chess-club': 'Lafayette Chess Club',
  'mandeville-chess-club': 'Mandeville Chess Club',
  'marrero-chess-organization': 'Marrero Chess Organization',
  metairie: 'Metairie Chess Academy',
  monroe: 'Monroe Chess Club',
  'morgan-city-chess-club': 'Morgan City Chess Club',
  'new-orleans-westbank-chess-club': 'New Orleans Westbank Chess Club',
  'north-kenner-library-chess-club': 'North Kenner Library',
  'picayune-chess-club': 'Picayune Chess Club',
  'pineville-homeschool-chess-club': 'Pineville Homeschool Chess Club',
  ruston: 'Ruston Knights Chess Club',
  shreveport: 'Shreveport-Bossier Chess Club (Monday)',
  slidell: 'Slidell Chess Club',
  'strategic-thoughts-nola': 'Strategic Thoughts NOLA',
}
const pin = (name: string) => {
  const found = CLUB_MAP_PINS.find((p) => p.name === name)
  expect(found, name).toBeDefined()
  return { latitude: found!.lat, longitude: found!.lng }
}

type Row = Record<string, unknown>
const all = <T = Row>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) =>
  db.prepare(sql).all(...args) as unknown as T[]
const one = <T = Row>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) =>
  db.prepare(sql).get(...args) as unknown as T

/** The database as it stands before 0067, with any rows a case adds. */
function before(extra = ''): DatabaseSync {
  return openMigratedDb({ files: BEFORE, extra })
}
/** Runs 0067's statements and answers how many rows they changed. */
function run(db: DatabaseSync): number {
  let changed = 0
  for (const stmt of STATEMENTS) changed += Number(db.prepare(stmt).run().changes)
  return changed
}
const seeded = () => {
  const db = before()
  run(db)
  return db
}
const clubs = (db: DatabaseSync) =>
  Object.fromEntries(all<Row & { id: string }>(db, 'SELECT * FROM clubs ORDER BY id').map((r) => [r.id, r]))
const places = (db: DatabaseSync, id: string) =>
  all<{ name: string; street: string | null; note: string | null; latitude: number | null; longitude: number | null; sort: number }>(
    db, 'SELECT name, street, note, latitude, longitude, sort FROM club_places WHERE club_id = ? ORDER BY sort, id', id,
  )
/** Every row of every table, and the schema's every definition. */
function everything(db: DatabaseSync) {
  const rows: Record<string, Row[]> = {}
  for (const table of userTables(db)) rows[table] = all(db, `SELECT rowid AS _rowid, * FROM "${table}" ORDER BY rowid`)
  return { rows, schema: all(db, 'SELECT type, name, tbl_name, sql FROM sqlite_master ORDER BY type, name') }
}

describe('migration 0067: the seed on today\'s clubs', () => {
  it('25 distinct slugs', () => {
    const db = before()
    expect(all(db, 'SELECT id FROM clubs WHERE slug IS NOT NULL')).toEqual([])
    run(db)
    const rows = all<{ id: string; name: string; slug: string | null }>(db, 'SELECT id, name, slug FROM clubs ORDER BY id')
    expect(rows.map((r) => r.id)).toEqual(ALL_IDS)
    expect(new Set(rows.map((r) => r.slug)).size).toBe(25)
    for (const { id, name, slug } of rows) {
      expect(slug, id).not.toBeNull()
      expect(RESERVED_SLUGS, id).not.toContain(slug)
      expect(slug, id).toBe(slugFor(name))
      expect(slug === id || slug === TYPED_SLUGS[id], id).toBe(true)
    }
    expect(rows.filter((r) => r.slug !== r.id).map((r) => [r.id, r.slug])).toEqual(Object.entries(TYPED_SLUGS))
    // The words the file keeps out of a slug are the slug rule's.
    expect(/id NOT IN \(([^)]*)\)/.exec(TEXT)?.[1]).toBe(RESERVED_SLUGS.map((w) => `'${w}'`).join(', '))
  })

  it('six history rows and none pointing at itself', () => {
    const db = seeded()
    const rows = all<{ old_slug: string; club_id: string; slug: string }>(
      db, 'SELECT h.old_slug, h.club_id, c.slug FROM club_slug_history h JOIN clubs c ON c.id = h.club_id ORDER BY h.old_slug',
    )
    expect(rows.map((r) => [r.old_slug, r.club_id])).toEqual(Object.keys(TYPED_SLUGS).map((id) => [id, id]))
    for (const row of rows) expect(row.old_slug, row.club_id).not.toBe(row.slug)
    // No old slug is any club's slug, so no address sends to another club either.
    expect(all(db, 'SELECT old_slug FROM club_slug_history WHERE old_slug IN (SELECT slug FROM clubs)')).toEqual([])
  })

  it('18 statements, seven empty', () => {
    const db = seeded()
    const statements = Object.fromEntries(
      all<{ id: string; how_we_meet_text: string | null }>(db, 'SELECT id, how_we_meet_text FROM clubs ORDER BY id').map((r) => [r.id, r.how_we_meet_text]),
    )
    expect(Object.keys(STATEMENTS_BY_ID)).toHaveLength(18)
    for (const [id, text] of Object.entries(STATEMENTS_BY_ID)) expect(statements[id], id).toBe(text)
    expect(Object.keys(ABOUT_BY_ID)).toEqual([
      'casa-de-ajedrez', 'gonzales-chess-club', 'knight-light-chess', 'lafayette-chess-club', 'metairie', 'north-kenner-library-chess-club', 'strategic-thoughts-nola',
    ])
    for (const id of Object.keys(ABOUT_BY_ID)) expect(statements[id], id).toBeNull()
    // The seven are the clubs whose meeting line today reads "See club for details".
    expect(all<{ id: string }>(db, `SELECT id FROM clubs WHERE meeting_schedule = 'See club for details' ORDER BY id`).map((r) => r.id)).toEqual(Object.keys(ABOUT_BY_ID))
  })

  it('seven About texts, from today\'s description, and the other 18 empty', () => {
    const db = before()
    const descriptions = Object.fromEntries(all<{ id: string; description: string }>(db, 'SELECT id, description FROM clubs').map((r) => [r.id, r.description]))
    run(db)
    const about = Object.fromEntries(all<{ id: string; about_text: string | null }>(db, 'SELECT id, about_text FROM clubs').map((r) => [r.id, r.about_text]))
    for (const [id, text] of Object.entries(ABOUT_BY_ID)) {
      expect(about[id], id).toBe(text)
      // Today's description as it is, but for US Chess's name, written out where the old initials stood.
      expect(text, id).toBe(descriptions[id].replace(OLD_INITIALS, 'US Chess'))
    }
    for (const id of Object.keys(STATEMENTS_BY_ID)) expect(about[id], id).toBeNull()
  })

  it('25 first places and one second place, each pin the one today\'s map list holds for the club', () => {
    const db = before()
    const locations = Object.fromEntries(all<{ id: string; location: string }>(db, 'SELECT id, location FROM clubs').map((r) => [r.id, r.location]))
    run(db)
    expect(one(db, 'SELECT COUNT(*) AS n FROM club_places WHERE sort = 0')).toEqual({ n: 25 })
    expect(one(db, 'SELECT COUNT(DISTINCT club_id) AS n FROM club_places')).toEqual({ n: 25 })
    expect(all(db, 'SELECT club_id, sort FROM club_places WHERE sort <> 0')).toEqual([{ club_id: 'shreveport', sort: 1 }])
    for (const id of ALL_IDS) {
      const [first] = places(db, id)
      expect({ latitude: first.latitude, longitude: first.longitude }, id).toEqual(pin(PIN_BY_ID[id]))
      expect([first.street, first.note], id).toEqual([null, null])
      if (!['slidell', 'mandeville-chess-club', 'shreveport'].includes(id)) expect(first.name, id).toBe(locations[id])
    }
    expect(places(db, 'slidell')[0].name).toBe('St. Luke\'s, 910 Cross Gates Blvd., Slidell, LA 70461')
    expect(places(db, 'mandeville-chess-club')[0].name).toBe('George\'s Mexican Restaurant, Mandeville, LA')
    expect(places(db, 'shreveport')).toEqual([
      { name: 'Gamers XP, Shreveport, LA', street: null, note: null, ...pin('Shreveport-Bossier Chess Club (Monday)'), sort: 0 },
      { name: 'Pierre Bossier Mall, Shreveport, LA', street: null, note: null, ...pin('Shreveport-Bossier Chess Club (Thursday)'), sort: 1 },
    ])
    // The one shared New Orleans pin, and Heart of Worship's as the map list holds it.
    expect(places(db, 'knight-light-chess')[0].latitude).toBe(places(db, 'strategic-thoughts-nola')[0].latitude)
    expect(places(db, 'knight-light-chess')[0].longitude).toBe(places(db, 'strategic-thoughts-nola')[0].longitude)
    expect(places(db, 'heart-of-worship-church-chess')[0]).toMatchObject({ latitude: 30.9735709, longitude: -91.7961073 })
    // Every pin of today's map is placed: 26 pins for 25 clubs.
    expect(CLUB_MAP_PINS).toHaveLength(26)
    expect(one(db, 'SELECT COUNT(DISTINCT latitude || \',\' || longitude) AS n FROM club_places')).toEqual({ n: 25 })
  })

  it('no doubled apostrophe, none of the old initials and no long dash in any seeded text', () => {
    const db = before()
    expect(all(db, `SELECT id FROM clubs WHERE description LIKE '%''''%' OR location LIKE '%''''%' ORDER BY id`)).toEqual([
      { id: 'mandeville-chess-club' }, { id: 'slidell' },
    ])
    run(db)
    const texts = [
      ...all<{ t: string }>(db, 'SELECT slug AS t FROM clubs UNION ALL SELECT how_we_meet_text FROM clubs WHERE how_we_meet_text IS NOT NULL UNION ALL SELECT about_text FROM clubs WHERE about_text IS NOT NULL'),
      ...all<{ t: string }>(db, 'SELECT name AS t FROM club_places UNION ALL SELECT old_slug FROM club_slug_history'),
    ].map((r) => r.t)
    expect(texts).toHaveLength(25 + 18 + 7 + 26 + 6)
    for (const text of texts) {
      expect(text).not.toContain('\'\'')
      expect(text).not.toMatch(OLD_INITIALS)
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(HYPHEN_RANGE)
    }
    // Today's text loses its doubled apostrophes, and nothing else of it changes.
    expect(all(db, `SELECT id FROM clubs WHERE description LIKE '%''''%' OR location LIKE '%''''%'`)).toEqual([])
    expect(one(db, `SELECT description, location FROM clubs WHERE id = 'slidell'`)).toEqual({
      description: 'Meets Fridays at 7 PM at St. Luke\'s, 910 Cross Gates Blvd., Slidell, LA 70461, Classroom 3.',
      location: 'St. Luke\'s, 910 Cross Gates Blvd., Slidell, LA 70461',
    })
    expect(one(db, `SELECT description, location FROM clubs WHERE id = 'mandeville-chess-club'`)).toEqual({
      description: 'Meets Mondays at 5:00 PM at George\'s Mexican Restaurant.',
      location: 'George\'s Mexican Restaurant, Mandeville, LA',
    })
  })

  it('a row whose description was changed keeps an empty statement', () => {
    const db = before([
      `UPDATE clubs SET description = 'Example meets on the second Saturday.' WHERE id = 'houma-chess-club'`,
      `UPDATE clubs SET description = 'Example club text written by K.' WHERE id = 'gonzales-chess-club'`,
      `UPDATE clubs SET how_we_meet_text = 'Example statement already there.' WHERE id = 'ruston'`,
      `UPDATE clubs SET description = 'Meets Fridays at the Example Hall.', location = 'Example Hall, Slidell, LA' WHERE id = 'slidell'`,
    ].join(';\n'))
    run(db)
    const after = clubs(db)
    expect(after['houma-chess-club']).toMatchObject({ how_we_meet_text: null, about_text: null, description: 'Example meets on the second Saturday.' })
    expect(after['gonzales-chess-club']).toMatchObject({ how_we_meet_text: null, about_text: null, description: 'Example club text written by K.' })
    expect(after.ruston.how_we_meet_text).toBe('Example statement already there.')
    expect(after.slidell).toMatchObject({ how_we_meet_text: null, description: 'Meets Fridays at the Example Hall.', location: 'Example Hall, Slidell, LA' })
    // Their slug, place and told date are filled all the same, the place named from the location as it now stands.
    expect(places(db, 'slidell').map((p) => p.name)).toEqual(['Example Hall, Slidell, LA'])
    for (const id of ['houma-chess-club', 'gonzales-chess-club', 'ruston', 'slidell']) {
      expect(after[id].slug, id).not.toBeNull()
      expect(after[id].told_updated_at, id).not.toBeNull()
    }
    // The other statements are all written.
    expect(Object.values(after).filter((c) => c.how_we_meet_text !== null)).toHaveLength(16)
  })

  it('a club added since gets slug = id and nothing else', () => {
    const db = before([
      `INSERT INTO clubs (id, name, city, location, description) VALUES ('example-chess-club', 'Example Chess Club', 'Example City', 'Example Library, Example City, LA', 'Meets Mondays at 7:00 PM at the Example Library.')`,
      `INSERT INTO clubs (id, name, city) VALUES ('example-renamed', 'Example Renamed Chess Club', 'Example Town')`,
      `INSERT INTO clubs (id, name, city) VALUES ('contact', 'Contact', 'Example Town')`,
    ].join(';\n'))
    const was = clubs(db)
    run(db)
    const after = clubs(db)
    for (const id of ['example-chess-club', 'example-renamed']) {
      expect(after[id].slug, id).toBe(id)
      expect(after[id].told_updated_at, id).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
      expect({ ...after[id], slug: null, told_updated_at: null }, id).toEqual(was[id])
      expect(places(db, id), id).toEqual([])
    }
    // A club whose id is a word the club pages keep gets no slug, for K to give it one.
    expect(after.contact.slug).toBeNull()
    expect(all(db, `SELECT old_slug FROM club_slug_history WHERE club_id IN ('example-chess-club', 'example-renamed', 'contact')`)).toEqual([])
    expect(new Set(Object.values(after).map((c) => c.slug)).size).toBe(Object.keys(after).length)
  })

  it('a slug another club already holds as its id is left, and that club keeps its id as its slug', () => {
    const db = before(`INSERT INTO clubs (id, name, city) VALUES ('slidell-chess-club', 'Example Slidell Chess Club', 'Example City')`)
    run(db)
    const after = clubs(db)
    expect(after['slidell-chess-club'].slug).toBe('slidell-chess-club')
    expect(after.slidell.slug).toBe('slidell')
    expect(all(db, `SELECT old_slug FROM club_slug_history WHERE club_id = 'slidell'`)).toEqual([])
    expect(one(db, 'SELECT COUNT(*) AS n FROM club_slug_history')).toEqual({ n: 5 })
  })

  it('a club with a stored point keeps it', () => {
    const db = before([
      `UPDATE clubs SET latitude = 30.5, longitude = -91.5 WHERE id = 'heart-of-worship-church-chess'`,
      `UPDATE clubs SET latitude = 30.25 WHERE id = 'houma-chess-club'`,
    ].join(';\n'))
    run(db)
    expect(places(db, 'heart-of-worship-church-chess')[0]).toMatchObject({ latitude: 30.5, longitude: -91.5 })
    // A point with only one half stored is no point: the map list's pin is placed.
    expect(places(db, 'houma-chess-club')[0]).toMatchObject(pin('Houma Chess Club'))
    expect(one(db, `SELECT latitude, longitude FROM clubs WHERE id = 'houma-chess-club'`)).toEqual({ latitude: 30.25, longitude: null })
  })

  it('a club that already has a place keeps it, and gets no second', () => {
    const db = before(`INSERT INTO club_places (club_id, name, sort) VALUES ('shreveport', 'Example Hall, Shreveport, LA', 0), ('monroe', 'Example Room, Monroe, LA', 3)`)
    run(db)
    expect(places(db, 'shreveport')).toEqual([{ name: 'Example Hall, Shreveport, LA', street: null, note: null, latitude: null, longitude: null, sort: 0 }])
    expect(places(db, 'monroe')).toEqual([{ name: 'Example Room, Monroe, LA', street: null, note: null, latitude: null, longitude: null, sort: 3 }])
  })

  it('a second run changes nothing', () => {
    const db = before()
    expect(run(db)).toBeGreaterThan(0)
    const once = everything(db)
    expect(run(db)).toBe(0)
    expect(everything(db)).toEqual(once)
  })

  it('touches nothing else: no other column of clubs, no other table and no schema', () => {
    const db = before()
    const was = everything(db)
    run(db)
    const now = everything(db)
    expect(now.schema).toEqual(was.schema)
    const filled = ['slug', 'about_text', 'how_we_meet_text', 'told_updated_at']
    const mended: Record<string, string[]> = { slidell: ['description', 'location'], 'mandeville-chess-club': ['description', 'location'] }
    for (const [i, row] of now.rows.clubs.entries()) {
      const id = String(row.id)
      for (const [column, value] of Object.entries(row)) {
        if (filled.includes(column) || mended[id]?.includes(column)) continue
        expect(value, `${id}.${column}`).toEqual(was.rows.clubs[i][column])
      }
      expect(row.told_by, id).toBeNull()
    }
    for (const table of Object.keys(was.rows)) {
      if (['clubs', 'club_places', 'club_slug_history'].includes(table)) continue
      expect(now.rows[table], table).toEqual(was.rows[table])
    }
  })

  it('names in its header the staged file its journal entry names, whose snapshot follows the one before with the same schema', () => {
    const META = join(MIGRATIONS_DIR, '../drizzle/meta')
    const journal = JSON.parse(readFileSync(join(META, '_journal.json'), 'utf8')) as {
      entries: Array<{ idx: number; version: string; when: number; tag: string; breakpoints: boolean }>
    }
    const entry = journal.entries.find((e) => e.tag.endsWith('_club_pages_seed'))
    expect(entry, 'the journal entry').toBeDefined()
    expect(entry).toEqual({ idx: entry!.idx, version: '6', when: expect.any(Number), tag: `${String(entry!.idx).padStart(4, '0')}_club_pages_seed`, breakpoints: true })
    expect(TEXT).toMatch(/^-- 0067_club_pages_seed\.sql\n/)
    expect(TEXT).toContain(`-- drizzle/${entry!.tag}.sql.`)
    const snapshot = (n: number) => JSON.parse(readFileSync(join(META, `${String(n).padStart(4, '0')}_snapshot.json`), 'utf8')) as Row
    expect(readdirSync(META)).toContain(`${entry!.tag.slice(0, 4)}_snapshot.json`)
    const now = snapshot(entry!.idx)
    const was = snapshot(entry!.idx - 1)
    expect(now.prevId).toBe(was.id)
    const rest = (s: Row) => {
      const others = { ...s }
      delete others.id
      delete others.prevId
      return others
    }
    expect(rest(now)).toEqual(rest(was))
  })

  it('is the only file with its number, applied after every file it was written against, and writes no DROP, ALTER or CREATE', () => {
    const files = migrationFiles()
    expect(files.filter((f) => f.startsWith('0067_'))).toEqual([FILE])
    for (const f of BEFORE) expect(files.indexOf(f), f).toBeLessThan(files.indexOf(FILE))
    for (const stmt of STATEMENTS) expect(stmt, stmt).toMatch(/^(?:UPDATE (?:clubs|club_places) SET |INSERT (?:OR IGNORE )?INTO (?:club_places|club_slug_history) )/)
    expect(TEXT.replace(/--[^\n]*/g, '')).not.toMatch(/\b(?:DROP|ALTER|CREATE|DELETE|PRAGMA)\b/i)
    // The old initials stand only in the guards that compare today's text.
    for (const line of TEXT.split('\n').filter((l) => OLD_INITIALS.test(l))) expect(line, line).toMatch(/^ {3}AND description = '/)
    expect(TEXT).not.toMatch(DASHES)
  })
})
