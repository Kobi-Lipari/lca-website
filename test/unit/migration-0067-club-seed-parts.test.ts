// test/unit/migration-0067-club-seed-parts.test.ts
//
// Migration 0067's data points and rows already set, on a real SQLite
// database built from every migration before it (WS09 step 5):
// - each of the parts K may turn the other way (the pins with the second
//   place's pin, the shared New Orleans point, Heart of Worship's point,
//   Shreveport-Bossier's second place, the apostrophe mend) can be taken out
//   of the file alone, and
//   what that leaves is the full seed with that part's effect missing and
//   nothing else different;
// - the order of the statement part and the apostrophe mend does not matter,
//   and a description already mended still gets its statement;
// - a slug, an About text, a told date or a keeper's name already there is
//   kept, a typed slug is not written over one, and no old address is made
//   for a slug that was not seeded;
// - a club whose location was changed since 0013 gets a place named from it
//   and no pin from the map list;
// - a second run after a person's edits changes nothing;
// - the seeded texts follow the plain-language rules: times read "7:00 PM",
//   no lowercase am or pm, no ".5", "US Chess" and no old initials.
// The clubs and words a case adds are made up.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { splitSql } from '../shared/splitSql'
import { MIGRATIONS_DIR, migrationFiles, openMigratedDb } from './helpers/sqlite'

const FILE = '0067_club_pages_seed.sql'
const BEFORE = migrationFiles().filter((f) => f < '0067')
const TEXT = readFileSync(join(MIGRATIONS_DIR, FILE), 'utf8')

type Row = Record<string, unknown>
const all = <T = Row>(db: DatabaseSync, sql: string, ...args: Array<string | number | null>) =>
  db.prepare(sql).all(...args) as unknown as T[]

/** The file's parts, each from its heading comment to the line before the next heading, after a blank line. */
function parts(text: string): Array<{ key: string; body: string }> {
  const marks = [...text.matchAll(/\n\n-- \(([a-g]\d?)\)/g)]
  return marks.map((m, i) => ({ key: m[1], body: text.slice(m.index, marks[i + 1]?.index ?? text.length) }))
}
const PARTS = parts(TEXT)
const without = (...keys: string[]) => PARTS.filter((p) => keys.includes(p.key)).reduce((t, p) => t.replace(p.body, '\n'), TEXT)
const only = (key: string) => PARTS.find((p) => p.key === key)!.body

function seedWith(text: string, extra = ''): DatabaseSync {
  const db = openMigratedDb({ files: BEFORE, extra })
  for (const stmt of splitSql(text)) db.exec(stmt)
  return db
}
const run = (db: DatabaseSync, text = TEXT) => {
  let changed = 0
  for (const stmt of splitSql(text)) changed += Number(db.prepare(stmt).run().changes)
  return changed
}

const clubRows = (db: DatabaseSync) => all(db, 'SELECT * FROM clubs ORDER BY id')
const placeRows = (db: DatabaseSync) => all(db, 'SELECT club_id, name, street, note, latitude, longitude, sort FROM club_places ORDER BY club_id, sort, name')
const historyRows = (db: DatabaseSync) => all(db, 'SELECT old_slug, club_id FROM club_slug_history ORDER BY old_slug')
/** The told date and the creation time are the moment of the run, so a comparison leaves them out. */
const ignoreTold = (rows: Row[]) => rows.map((r) => ({ ...r, told_updated_at: null, created_at: null }))
/** The ids of the rows of `a` that differ from `b`, by their key. */
const differing = (a: Row[], b: Row[], key: (r: Row) => string) => {
  const was = new Map(b.map((r) => [key(r), JSON.stringify(r)]))
  return a.filter((r) => was.get(key(r)) !== JSON.stringify(r)).map(key).sort()
}
const placeKey = (r: Row) => `${r.club_id}#${r.sort}`

const FULL = seedWith(TEXT)
const FULL_CLUBS = ignoreTold(clubRows(FULL))
const FULL_PLACES = placeRows(FULL)

describe('the parts of the file', () => {
  it('are found, in order, each under a comment of its own', () => {
    expect(PARTS.map((p) => p.key)).toEqual(['a', 'b', 'c', 'd', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'f', 'g'])
    for (const p of PARTS) expect(splitSql(p.body).length, p.key).toBeGreaterThan(0)
    expect(splitSql(PARTS.map((p) => p.body).join('\n')).length).toBe(splitSql(TEXT).length)
  })
})

describe('a data point taken out of the file alone', () => {
  it('(g) taken out leaves the doubled apostrophes in today\'s text, and every statement, place and slug as before', () => {
    const db = seedWith(without('g'))
    expect(all(db, `SELECT id FROM clubs WHERE description LIKE '%''''%' OR location LIKE '%''''%' ORDER BY id`)).toEqual([
      { id: 'mandeville-chess-club' }, { id: 'slidell' },
    ])
    expect(differing(ignoreTold(clubRows(db)), FULL_CLUBS, (r) => String(r.id))).toEqual(['mandeville-chess-club', 'slidell'])
    // What the seed writes is mended either way: the statement and the place's name.
    expect(all(db, `SELECT how_we_meet_text AS t FROM clubs WHERE id IN ('slidell', 'mandeville-chess-club') ORDER BY id`)).toEqual([
      { t: 'Meets Mondays at 5:00 PM at George\'s Mexican Restaurant.' }, { t: 'Fridays at 7:00 PM at St. Luke\'s, 910 Cross Gates Blvd., Classroom 3.' },
    ])
    expect(placeRows(db)).toEqual(FULL_PLACES)
    expect(historyRows(db)).toEqual(historyRows(FULL))
  })

  it('(e2), (e3), (e4) and (e6) taken out leave no pin at all, and nothing else different', () => {
    const db = seedWith(without('e2', 'e3', 'e4', 'e6'))
    expect(all(db, 'SELECT club_id, sort FROM club_places WHERE latitude IS NOT NULL OR longitude IS NOT NULL')).toEqual([])
    expect(all(db, 'SELECT COUNT(*) AS n FROM club_places')).toEqual([{ n: 26 }])
    const unpinned = (rows: Row[]) => rows.map((r) => ({ ...r, latitude: null, longitude: null }))
    expect(unpinned(placeRows(db))).toEqual(unpinned(FULL_PLACES))
    expect(ignoreTold(clubRows(db))).toEqual(FULL_CLUBS)
    expect(historyRows(db)).toEqual(historyRows(FULL))
  })

  it('(e2) alone taken out leaves the shared New Orleans pins and Heart of Worship\'s, which are their own parts', () => {
    const db = seedWith(without('e2'))
    const pinned = all<{ club_id: string }>(db, 'SELECT club_id FROM club_places WHERE (latitude IS NOT NULL AND sort = 0) ORDER BY club_id').map((r) => r.club_id)
    expect(pinned).toEqual(['heart-of-worship-church-chess', 'knight-light-chess', 'strategic-thoughts-nola'])
  })

  it('(e3) taken out leaves Knight Light Chess and Strategic Thoughts NOLA without a pin, and nothing else different', () => {
    const db = seedWith(without('e3'))
    expect(differing(placeRows(db), FULL_PLACES, placeKey)).toEqual(['knight-light-chess#0', 'strategic-thoughts-nola#0'])
    expect(all(db, `SELECT latitude, longitude FROM club_places WHERE club_id IN ('knight-light-chess', 'strategic-thoughts-nola')`)).toEqual([
      { latitude: null, longitude: null }, { latitude: null, longitude: null },
    ])
    expect(ignoreTold(clubRows(db))).toEqual(FULL_CLUBS)
  })

  it('(e4) taken out leaves Heart of Worship Church Chess without a pin, and nothing else different', () => {
    const db = seedWith(without('e4'))
    expect(differing(placeRows(db), FULL_PLACES, placeKey)).toEqual(['heart-of-worship-church-chess#0'])
    expect(ignoreTold(clubRows(db))).toEqual(FULL_CLUBS)
  })

  it('(e5) taken out leaves one place for Shreveport-Bossier with both sites named, and nothing else different', () => {
    const db = seedWith(without('e5'))
    expect(all(db, `SELECT name, sort FROM club_places WHERE club_id = 'shreveport'`)).toEqual([
      { name: 'Gamers XP / Pierre Bossier Mall, Shreveport, LA', sort: 0 },
    ])
    expect(placeRows(db).filter((p) => p.club_id !== 'shreveport')).toEqual(FULL_PLACES.filter((p) => p.club_id !== 'shreveport'))
    expect(ignoreTold(clubRows(db))).toEqual(FULL_CLUBS)
  })

  it('(e6) taken out leaves Shreveport-Bossier\'s second place without a pin, and nothing else different', () => {
    const db = seedWith(without('e6'))
    expect(differing(placeRows(db), FULL_PLACES, placeKey)).toEqual(['shreveport#1'])
    expect(all(db, `SELECT name, latitude, longitude FROM club_places WHERE club_id = 'shreveport' AND sort = 1`)).toEqual([
      { name: 'Pierre Bossier Mall, Shreveport, LA', latitude: null, longitude: null },
    ])
    expect(ignoreTold(clubRows(db))).toEqual(FULL_CLUBS)
  })

  it('(e5) taken out with (e6) kept writes no Thursday pin anywhere', () => {
    const db = seedWith(without('e5'))
    expect(all(db, `SELECT COUNT(*) AS n FROM club_places WHERE latitude = 32.5264466`)).toEqual([{ n: 0 }])
  })

  it('all six taken out leave the slugs, old addresses, statements, About texts and 25 places with no pin, and a second run still changes nothing', () => {
    const text = without('e2', 'e3', 'e4', 'e5', 'e6', 'g')
    const db = seedWith(text)
    expect(all(db, 'SELECT COUNT(*) AS n FROM club_places WHERE latitude IS NOT NULL')).toEqual([{ n: 0 }])
    expect(all(db, 'SELECT COUNT(*) AS n FROM club_places')).toEqual([{ n: 25 }])
    expect(all(db, 'SELECT COUNT(DISTINCT slug) AS n FROM clubs')).toEqual([{ n: 25 }])
    expect(all(db, 'SELECT COUNT(*) AS n FROM clubs WHERE how_we_meet_text IS NOT NULL')).toEqual([{ n: 18 }])
    expect(all(db, 'SELECT COUNT(*) AS n FROM clubs WHERE about_text IS NOT NULL')).toEqual([{ n: 7 }])
    expect(historyRows(db)).toEqual(historyRows(FULL))
    expect(run(db, text)).toBe(0)
  })
})

describe('the order of the statement part and the apostrophe mend', () => {
  it('(g) first gives the same rows as (g) last', () => {
    const first = seedWith(`${only('g')}\n${without('g')}`)
    expect(ignoreTold(clubRows(first))).toEqual(FULL_CLUBS)
    expect(placeRows(first)).toEqual(FULL_PLACES)
    expect(historyRows(first)).toEqual(historyRows(FULL))
  })

  it('a description already written with one apostrophe still gets its statement and its pin', () => {
    const mended = openMigratedDb({
      files: BEFORE,
      extra: `UPDATE clubs SET description = 'Meets Fridays at 7 PM at St. Luke''s, 910 Cross Gates Blvd., Slidell, LA 70461, Classroom 3.', location = 'St. Luke''s, 910 Cross Gates Blvd., Slidell, LA 70461' WHERE id = 'slidell'`,
    })
    run(mended)
    expect(ignoreTold(clubRows(mended))).toEqual(FULL_CLUBS)
    expect(placeRows(mended)).toEqual(FULL_PLACES)
  })
})

describe('rows already set', () => {
  it('keeps a slug, an About text, a told date and a keeper\'s name already there, and writes no old address for a slug it did not seed', () => {
    const db = openMigratedDb({
      files: BEFORE,
      extra: [
        `INSERT INTO members (id, email, full_name) VALUES ('member-player-one', 'player.one@example.org', 'Player One')`,
        `UPDATE clubs SET slug = 'example-baton-rouge', told_updated_at = '2026-09-01 12:00:00', told_by = 'member-player-one' WHERE id = 'baton-rouge'`,
        `UPDATE clubs SET about_text = 'Example About words for the club.' WHERE id = 'gonzales-chess-club'`,
      ].join(';\n'),
    })
    run(db)
    const row = (id: string) => all(db, 'SELECT slug, about_text, told_updated_at, told_by FROM clubs WHERE id = ?', id)[0]
    expect(row('baton-rouge')).toEqual({ slug: 'example-baton-rouge', about_text: null, told_updated_at: '2026-09-01 12:00:00', told_by: 'member-player-one' })
    expect(row('gonzales-chess-club')).toMatchObject({ about_text: 'Example About words for the club.', slug: 'gonzales-chess-club' })
    expect(all(db, `SELECT old_slug FROM club_slug_history WHERE club_id = 'baton-rouge'`)).toEqual([])
    expect(all(db, 'SELECT COUNT(*) AS n FROM club_slug_history')).toEqual([{ n: 5 }])
    // Its statement is still written, as its description is what 0013 stored.
    expect(all(db, `SELECT how_we_meet_text AS t FROM clubs WHERE id = 'baton-rouge'`)[0].t).toMatch(/^Saturdays 10:00 AM/)
  })

  it('a second run after a person\'s edits changes nothing, and the edits stand', () => {
    const db = openMigratedDb({ files: BEFORE })
    run(db)
    db.exec(`UPDATE clubs SET how_we_meet_text = 'Example edited meeting words.', slug = 'example-houma' WHERE id = 'houma-chess-club'`)
    db.exec(`UPDATE club_places SET name = 'Example Hall, Houma, LA', latitude = NULL, longitude = NULL WHERE club_id = 'houma-chess-club'`)
    db.exec(`UPDATE club_places SET name = 'Example Hall, Shreveport, LA' WHERE club_id = 'shreveport' AND sort = 0`)
    db.exec(`DELETE FROM club_places WHERE club_id = 'shreveport' AND sort = 1`)
    const edited = { clubs: clubRows(db), places: placeRows(db), history: historyRows(db) }
    expect(run(db)).toBe(0)
    expect({ clubs: clubRows(db), places: placeRows(db), history: historyRows(db) }).toEqual(edited)
    expect(all(db, `SELECT how_we_meet_text, slug FROM clubs WHERE id = 'houma-chess-club'`)).toEqual([{ how_we_meet_text: 'Example edited meeting words.', slug: 'example-houma' }])
  })

  it('names the place of a club whose location was changed from what it now holds, and gives it no pin from the map list', () => {
    const db = openMigratedDb({
      files: BEFORE,
      extra: [
        `UPDATE clubs SET location = 'Example Branch Library, Houma, LA' WHERE id = 'houma-chess-club'`,
        `UPDATE clubs SET location = 'Example Hall, New Orleans, LA' WHERE id = 'knight-light-chess'`,
        `UPDATE clubs SET location = 'Example Church, Opelousas, LA' WHERE id = 'heart-of-worship-church-chess'`,
        `UPDATE clubs SET location = 'Example Hall, Slidell, LA' WHERE id = 'slidell'`,
      ].join(';\n'),
    })
    run(db)
    expect(all(db, `SELECT club_id, name, latitude, longitude FROM club_places
                    WHERE club_id IN ('houma-chess-club', 'knight-light-chess', 'heart-of-worship-church-chess', 'slidell') ORDER BY club_id`)).toEqual([
      { club_id: 'heart-of-worship-church-chess', name: 'Example Church, Opelousas, LA', latitude: null, longitude: null },
      { club_id: 'houma-chess-club', name: 'Example Branch Library, Houma, LA', latitude: null, longitude: null },
      { club_id: 'knight-light-chess', name: 'Example Hall, New Orleans, LA', latitude: null, longitude: null },
      { club_id: 'slidell', name: 'Example Hall, Slidell, LA', latitude: null, longitude: null },
    ])
    // Every other club still gets its pin, the shared one included.
    expect(all(db, `SELECT latitude, longitude FROM club_places WHERE club_id = 'strategic-thoughts-nola'`)).toEqual([{ latitude: 29.9508941, longitude: -90.0758356 }])
    expect(all(db, 'SELECT COUNT(*) AS n FROM club_places WHERE sort = 0 AND latitude IS NOT NULL')).toEqual([{ n: 21 }])
  })

  it('leaves a club with a place that someone else made without a pin from the map list', () => {
    const db = openMigratedDb({
      files: BEFORE,
      extra: `INSERT INTO club_places (club_id, name, sort) VALUES ('houma-chess-club', 'Example Hall, Houma, LA', 0)`,
    })
    run(db)
    expect(all(db, `SELECT name, latitude, longitude FROM club_places WHERE club_id = 'houma-chess-club'`)).toEqual([
      { name: 'Example Hall, Houma, LA', latitude: null, longitude: null },
    ])
  })
})

describe('the seeded texts, in plain language', () => {
  const texts = () => all<{ id: string; t: string }>(
    FULL,
    `SELECT id, how_we_meet_text AS t FROM clubs WHERE how_we_meet_text IS NOT NULL
     UNION ALL SELECT id, about_text FROM clubs WHERE about_text IS NOT NULL`,
  )

  it('writes every time of day as "7:00 PM", never "7 PM" or "7pm", and no lowercase am or pm', () => {
    expect(texts()).toHaveLength(25)
    for (const { id, t } of texts()) {
      expect(t, id).not.toMatch(/\d\s*(?:am|pm|a\.m\.|p\.m\.)/)
      expect(t, id).not.toMatch(/\b(?:am|pm)\b/)
      // Every time with a meridiem has its minutes, and a range such as "4:00 to 6:00" ends with one.
      for (const m of t.matchAll(/\b(\d{1,2})(:\d{2})?\s*(AM|PM)\b/g)) expect(m[2], `${id}: ${m[0]}`).toBeDefined()
      for (const m of t.matchAll(/\b\d{1,2}:\d{2}\s+to\s+\d{1,2}:\d{2}/g)) {
        expect(t.slice((m.index ?? 0) + m[0].length), `${id}: ${m[0]}`).toMatch(/^\s*(?:AM|PM)\b/)
      }
    }
  })

  it('writes "US Chess", never the old initials, and no ".5" where a half belongs', () => {
    for (const { id, t } of texts()) {
      expect(t, id).not.toMatch(new RegExp(`\\b${'US' + 'CF'}\\b`))
      expect(t, id).not.toMatch(/\b\d*\.5\b/)
    }
    const about = all<{ t: string }>(FULL, `SELECT about_text AS t FROM clubs WHERE id = 'casa-de-ajedrez'`)[0].t
    expect(about).toContain('US Chess rated tournaments')
    expect(all<{ t: string }>(FULL, `SELECT how_we_meet_text AS t FROM clubs WHERE id = 'downriver-chess-club'`)[0].t).toContain('US Chess membership')
    expect(all<{ t: string }>(FULL, `SELECT how_we_meet_text AS t FROM clubs WHERE id = 'new-orleans-westbank-chess-club'`)[0].t).toMatch(/^US Chess rated/)
  })

  it('writes every range with the word "to", and no dash of either length', () => {
    const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
    for (const { id, t } of texts()) {
      expect(t, id).not.toMatch(dashes)
      expect(t, id).not.toMatch(/\d\s*-\s*\d{1,3}\b(?!\w)/)
    }
    expect(all<{ t: string }>(FULL, `SELECT how_we_meet_text AS t FROM clubs WHERE id = 'bunkie-chess-club'`)[0].t).toContain('ages 8 to 108')
    expect(all<{ t: string }>(FULL, `SELECT how_we_meet_text AS t FROM clubs WHERE id = 'downriver-chess-club'`)[0].t).toContain('$1 to 2 entry')
  })
})
