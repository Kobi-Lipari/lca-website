// test/unit/redesign-status-ws09-step5.test.ts
//
// REDESIGN_STATUS.md records WS09 step 5: the seed on today's clubs,
// migration 0067, and the check sheet that prints the clubs as seeded. Like
// WS09 step 4's record test, this file reads only the WS09 section, from its
// heading to the WS10 heading. Pinned here: the block's place, right after
// WS09 step 4's and before the four lists; the Status line's tail while this
// step is the latest; the block's parts in order and its figures, which must
// agree with each other and with the files they describe; the lines of the
// migration it names for each of K's four data points; the sentence this
// step added to the map; the tagged entries of the four lists; and the
// plain-language rules over the block and the files the step adds or
// changes. What a later step will change in the tree (the next number, the
// journal, the pinned counts) is read only while this step is the latest.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nextMigrationNumber } from '../../scripts/db/generate'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, in the plural as well, and the two words that name a person's role in the work. */
const BANNED = new RegExp(`\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow'].join('|')})s?\\b|${'the ' + 'lead'}`, 'i')
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'RECORD' + '_CASES'}|${'LINT' + '_FILES'}|${'UNIT' + '_TESTS'}`)
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
/** A bullet and the indented lines under it. */
function bullet(text: string, start: string): string {
  const all = text.split('\n')
  const at = all.findIndex((l) => l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < all.length && /^\s+\S/.test(all[end])) end++
  return all.slice(at, end).join('\n')
}
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))
const head = (entry: string) => entry.slice(4, entry.indexOf('**', 4))
const TAG = '(WS09 step 5).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const STEP_4 = '### WS09 step 4: the club tables and the slug rule'
const STEP = '### WS09 step 5: the seed on today\'s clubs'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))

const SEED = 'migrations/0067_club_pages_seed.sql'
const SHEET = 'scripts/db/club-seed-sheet.ts'
/** The files this step adds, and those of them that are unit tests and integration tests. */
const NEW_FILES = [
  SEED, 'drizzle/meta/0012_snapshot.json', SHEET, 'test/unit/migration-0067-club-seed.test.ts', 'test/unit/migration-0067-club-seed-parts.test.ts',
  'test/unit/club-seed-sheet.test.ts', 'test/integration/club-create-after-seed.test.ts', 'test/integration/club-seed-live.test.ts',
  'test/unit/redesign-status-ws09-step5.test.ts',
]
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.ts$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new files lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => f.endsWith('.ts'))
/** The files this step changes that are not tests. */
const CHANGED = ['drizzle/meta/_journal.json', 'migrations/README.md', 'package.json']
/** The tests this step changes, each with its count and the count before, unit and integration apart. */
const CHANGED_INTEGRATION: ReadonlyArray<readonly [string, number, number]> = [
  ['test/integration/club-columns-stay-off-answers.test.ts', 7, 7],
]
const CHANGED_UNIT: ReadonlyArray<readonly [string, number, number]> = [
  ['test/unit/drizzle-baseline.test.ts', 26, 26],
  ['test/unit/db-generate-guard.test.ts', 31, 31],
  ['test/unit/db-generate-real-kit.test.ts', 13, 13],
  ['test/unit/seed-fixtures.test.ts', 14, 14],
  ['test/unit/migration-0066-club-pages.test.ts', 15, 15],
  ['test/unit/club-tables-lagging-run.test.ts', 6, 6],
]
const CHANGED_TESTS = [...CHANGED_INTEGRATION, ...CHANGED_UNIT]
/** The cases a unit test that grew with no change of its own gained. */
const GROWN = 0
/** The six clubs whose id differs from the slug of their name, and that slug. */
const TYPED_SLUGS: Record<string, string> = {
  'baton-rouge': 'baton-rouge-chess-club',
  metairie: 'metairie-chess-academy',
  monroe: 'monroe-chess-club',
  ruston: 'ruston-knights-chess-club',
  shreveport: 'shreveport-bossier-chess-club',
  slidell: 'slidell-chess-club',
}
/** The seven clubs with no statement of how they meet. */
const NO_STATEMENT = [
  'casa-de-ajedrez', 'gonzales-chess-club', 'knight-light-chess', 'lafayette-chess-club', 'metairie', 'north-kenner-library-chess-club', 'strategic-thoughts-nola',
]
/** K's four data points, each a part of the migration under its own comment, as the block names them. */
const DATA_POINTS = ['(e2)', '(e3)', '(e4)', '(e5)', '(e6)', '(g)']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])
/** Whether a line of the migration opens a part: its comment, after a blank line, starts with the part's label and a capital. */
const opensPart = (lines: string[], i: number, label = '\\([a-z]\\d?\\)') => lines[i - 1] === '' && new RegExp(`^-- ${label} [A-Z]`).test(lines[i])
/** The first and last line, counted from 1, of a part of the migration: from its comment to its last statement before the next part. */
function linesOf(label: string): [number, number] {
  const lines = read(SEED).split('\n')
  const start = lines.findIndex((_, i) => opensPart(lines, i, escape(label)))
  expect(start, label).toBeGreaterThan(-1)
  let next = lines.findIndex((_, i) => i > start && opensPart(lines, i))
  if (next < 0) next = lines.length
  let end = next - 1
  while (end > start && lines[end].trim() === '') end--
  return [start + 1, end + 1]
}

describe('REDESIGN_STATUS.md, WS09 step 5: the block and the Status line', () => {
  it('sits once, right after WS09 step 4\'s block and before the four lists', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    const at = [STEP_4, STEP, LISTS[0]].map((h) => ws09.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
    expect(headings[headings.indexOf(STEP_4) + 1]).toBe(STEP)
    if (latestStep === 5) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest', () => {
    expect(latestStep).toBeGreaterThanOrEqual(5)
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestStep === 5) expect(tail).toBe('checkpoint S waits for its pull request; steps 1 to 5 are built.')
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying the step changes no page, what it adds, and K\'s choice that settles its four data points', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the fifth and last step of checkpoint S', 'It changes no page', '`0067_club_pages_seed.sql`', '`scripts/db/club-seed-sheet.ts`',
      'typed out per club id and written only to an empty field', 'K\'s decision 1, choice 4 (a), of Friday, November 13, 2026',
      'the two doubled apostrophes are mended', 'the pins come from today\'s map list', 'Shreveport-Bossier\'s second pin is its second place',
      'the one shared New Orleans pin is kept', 'Heart of Worship\'s pin stays as stored', 'checkpoint S waits for its pull request',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The seed, in figures.**', '- **Safe on rows nobody read.**', '- **The four data points.**',
      '- **The sheet.**', '- **Owed before the pull request.**', '- **The generator\'s run.**', '- **The map.**', '- **The branch.**',
      '- **What the merge does.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 5: the parts', () => {
  it('names every file it adds and changes, each test with its count, and the two sub-lines', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_TESTS.map(([f]) => f), 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of [...NEW_TESTS, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const [name, after, before] of CHANGED_TESTS) {
      expect(files, name).toContain(after === before ? `\`${name}\` (${after}, as before: ` : `\`${name}\` (${after}, ${before} before: `)
    }
    expect(files).toContain('  - Grown with no change: none')
    expect(files).toContain('  - Files beyond the step\'s list: `drizzle/meta/_journal.json` and `drizzle/meta/0012_snapshot.json`')
    expect(files).toContain('Nothing under `src/`, `functions/` or `workers/` changes, no handler file is added, and no file the mail stream holds is touched.')
  })

  it('gives the seed in figures, as the migration writes it', () => {
    const figures = bullet(block, '- **The seed, in figures.**')
    for (const [id, slug] of Object.entries(TYPED_SLUGS)) expect(figures, id).toContain(`\`${id}\` to \`${slug}\``)
    for (const id of NO_STATEMENT) expect(figures, id).toContain(`\`${id}\``)
    for (const piece of [
      '`test/unit/migration-0067-club-seed.test.ts`', '25 distinct slugs, none NULL and none a reserved word', '19 equal to the club\'s id and six typed out',
      'six rows in `club_slug_history`', '18 statements in `how_we_meet_text`', 'seven About texts in `about_text`', '25 first places and one second place, 26 in `club_places`',
      '"See club for details"', 'with `told_by` NULL', '"As told to LCA"', 'no doubled apostrophe, none of the old initials, no long or short dash',
    ]) expect(figures, piece).toContain(piece)
    const sql = read(SEED).replace(/--[^\n]*/g, '')
    for (const [id, slug] of Object.entries(TYPED_SLUGS)) {
      expect(sql, id).toContain(`UPDATE clubs SET slug = '${slug}'\n WHERE id = '${id}' AND slug IS NULL`)
      expect(sql, id).toContain(`SELECT '${id}', id FROM clubs WHERE id = '${id}' AND slug = '${slug}';`)
    }
    expect(sql.match(/^UPDATE clubs SET slug = /gm) ?? []).toHaveLength(7)
    expect(sql.match(/^INSERT OR IGNORE INTO club_slug_history /gm) ?? []).toHaveLength(6)
    expect(sql.match(/^UPDATE clubs SET how_we_meet_text = /gm) ?? []).toHaveLength(18)
    expect(sql.match(/^UPDATE clubs SET about_text = /gm) ?? []).toHaveLength(7)
    for (const id of NO_STATEMENT) {
      expect(sql, id).not.toContain(`WHERE id = '${id}' AND how_we_meet_text IS NULL`)
      expect(sql, id).toContain(`WHERE id = '${id}' AND about_text IS NULL`)
    }
    expect(sql).toContain('UPDATE clubs SET told_updated_at = datetime(\'now\') WHERE told_updated_at IS NULL;')
    expect(sql).not.toMatch(/\btold_by\b/)
  })

  it('says each write is to an empty field, a changed row keeps what it holds and a second run changes nothing, as the migration\'s test holds', () => {
    const safe = bullet(block, '- **Safe on rows nobody read.**')
    for (const piece of [
      'Every write is to an empty field of a known club id', 'still equals what migration 0013 stored',
      '"a row whose description was changed keeps an empty statement"', '"a second run changes nothing"', 'A club added since the 25 gets a slug equal to its id and the told date, and nothing else.',
      '`meeting_schedule`, `city`, `name`, `contact_email`, `region`, `told_by` and every other table stay as they were',
    ]) expect(safe, piece).toContain(piece)
    const cases = read('test/unit/migration-0067-club-seed.test.ts')
    for (const name of [
      '25 distinct slugs', 'six history rows and none pointing at itself', '18 statements, seven empty',
      'no doubled apostrophe, none of the old initials and no long dash in any seeded text', 'a row whose description was changed keeps an empty statement',
      'a club added since gets slug = id and nothing else', 'a club with a stored point keeps it', 'a second run changes nothing',
    ]) expect(cases, name).toContain(`  it('${name}', () => {`)
  })

  it('names the lines of each of K\'s four data points as the migration holds them', () => {
    const points = bullet(block, '- **The four data points.**')
    for (const label of DATA_POINTS) {
      const [from, to] = linesOf(label)
      expect(points, label).toContain(`part ${label}, lines ${from} to ${to}`)
    }
    for (const piece of [
      'K\'s choice 4', 'checkpoint S\'s look', 'from the check sheet', 'by removing its lines alone before the merge', 'Knight Light Chess and Strategic Thoughts NOLA', 'Opelousas',
      'taking out (e2), (e3), (e4) and (e6) leaves no pin at all', '`test/unit/migration-0067-club-seed-parts.test.ts`',
    ]) {
      expect(points, piece).toContain(piece)
    }
    const sql = read(SEED)
    expect(sql).toContain('-- K\'s decision 1, choice 4 (a), of Friday, November 13, 2026, settles four')
    const lines = sql.split('\n')
    for (const label of DATA_POINTS) expect(lines.filter((_, i) => opensPart(lines, i, escape(label))), label).toHaveLength(1)
    // Every pin is in a part of the pins: the second place's part writes no point.
    const [from5, to5] = linesOf('(e5)')
    expect(lines.slice(from5 - 1, to5).join('\n')).not.toMatch(/\d+\.\d{3,}/)
  })

  it('describes the sheet as the script and its npm script hold it, and what is owed before the pull request', () => {
    const sheet = bullet(block, '- **The sheet.**')
    for (const piece of [
      '`scripts/db/club-seed-sheet.ts`', '`npm run db:club-seed-sheet`', '`.drizzle/introspect.sqlite`', '`npm run db:local-sqlite`', 'opens that file read-only',
      'all 25 clubs A to Z', 'refuses in words', '`test/unit/club-seed-sheet.test.ts`', 'goes to K with checkpoint S\'s pull request',
    ]) expect(sheet, piece).toContain(piece)
    const code = read(SHEET)
    expect(code).toContain('new DatabaseSync(path, { readOnly: true })')
    expect(code).toContain('import { DEFAULT_OUT } from \'./build-local-sqlite.ts\'')
    expect(read('scripts/db/build-local-sqlite.ts')).toContain('.drizzle/introspect.sqlite')
    const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
    expect(pkg.scripts['db:club-seed-sheet']).toBe(`npm run db:local-sqlite && node --no-warnings --experimental-strip-types ${SHEET}`)
    const owed = bullet(block, '- **Owed before the pull request.**')
    for (const piece of [
      'none done in this step', '`npm run db:migrate:preview`', 'K told first', 'one read-only count per question', 'a region, a stored point, a description that differs from the seed and an id beyond the 25',
      'the check sheet sent to K', 'No remote database was read or written here.',
    ]) expect(owed, piece).toContain(piece)
  })

  it('gives the generator\'s run as the journal, the snapshot and the README hold it', () => {
    const run = bullet(block, '- **The generator\'s run.**')
    for (const piece of [
      '`npm run db:generate -- club pages seed --custom --number 0067`', '`drizzle/0012_club_pages_seed.sql`', 'idx 12, tag `0012_club_pages_seed`',
      '`drizzle/meta/0012_snapshot.json`', 'the generator now gives `0068`', 'No file was renamed by hand.',
    ]) expect(run, piece).toContain(piece)
    expect(read(SEED)).toContain('-- drizzle/0012_club_pages_seed.sql.')
    if (latestStep !== 5) return
    const journal = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: Array<{ idx: number; tag: string; version: string; breakpoints: boolean }> }
    expect(journal.entries).toHaveLength(13)
    expect(journal.entries[12]).toMatchObject({ idx: 12, tag: '0012_club_pages_seed', version: '6', breakpoints: true })
    expect(nextMigrationNumber(readdirSync(join(ROOT, 'migrations')))).toBe('0068')
    expect(read('migrations/README.md').replace(/\s+/g, ' ')).toContain('`0068` is next')
  })

  it('names the map\'s sentence, the branch and what the merge does', () => {
    const mapPart = bullet(block, '- **The map.**')
    for (const piece of ['20 items', 'one sentence added to criterion 5', 'It proves no item in full.']) expect(mapPart, piece).toContain(piece)
    expect(bullet(block, '- **The branch.**')).toContain('`redesign/ws09-clubs`, with WS09 step 4 at `535b6a9` on WS09 step 3\'s `391796d`, WS09 step 2\'s `42e232a`, WS09 step 1\'s `0fec98b` and `af4a21c`; this step\'s diff is against `535b6a9`.')
    expect(bullet(block, '- **The branch.**')).toContain('`13a2c36`')
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['One data migration and no new endpoint or route.', '`migrate-db.yml`', 'must be seen green before the live check', 'a failed run means the merge is not finished']) {
      expect(does, piece).toContain(piece)
    }
  })

  it('says what ships with every switch off: the fields read by no page, and with K\'s yes two clubs\' apostrophes', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Slugs, statements, About texts, places and the told date, filled where empty, read by no page and no answer')).toBe(true)
    for (const piece of [
      '`ADMIN_CLUB_COLUMNS`', '`workers/` reads no club', 'With K\'s yes of Friday, November 13, 2026', 'two clubs lose a doubled apostrophe on today\'s pages',
      'Slidell Chess Club', 'Mandeville Chess Club', '`GET /api/clubs/[id]`', '`functions/clubs/[id].ts`', 'That is the one change a visitor meets with every switch off.',
      '`test/integration/club-create-after-seed.test.ts`', 'No switch is added',
    ]) expect(ships, piece).toContain(piece)
    // The answers the block names read neither a new field nor a new table.
    const NEW_FIELDS = /\b(?:slug|about_text|how_we_meet_text|told_updated_at|told_by|club_places|club_slug_history)\b/
    for (const file of ['functions/api/clubs.ts', 'functions/api/clubs/[id].ts', 'functions/clubs/[id].ts', 'functions/utils/clubs/adminAnswer.ts']) {
      expect(read(file), file).not.toMatch(NEW_FIELDS)
    }
    // The search reads a news post's slug; its clubs read four columns of their own.
    const clubsSql = between(read('functions/utils/search.ts'), 'const CLUBS_SQL = `', '`')
    expect(clubsSql).toContain('SELECT id, name, city, region')
    expect(clubsSql).not.toMatch(NEW_FIELDS)
    expect(read('functions/api/clubs.ts')).not.toMatch(/\b(?:description|location)\b/)
  })

  it('names its pins with the figures as they stand on this branch', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/unit/drizzle-baseline.test.ts`, both cases', '"all 64 migrations"', '`{ files: 64, tables: 40 }`', '`0067_club_pages_seed.sql`',
      '`test/unit/db-generate-guard.test.ts`', '`0068` today', '`test/unit/redesign-status-ws08-step2-claims.test.ts` with `migrations/README.md`',
      '`test/unit/seed-fixtures.test.ts`', '"0001 to 0067"', '`test/unit/db-generate-real-kit.test.ts`', '13 entries, 12 on the base',
      'Not moved: `test/unit/schema-drift.test.ts`, 40 tables and 390 columns, and `test/unit/migration-safety.test.ts`, 19 links',
      '`test/unit/migration-0066-club-pages.test.ts`', '`test/unit/club-tables-lagging-run.test.ts`', '`test/integration/club-columns-stay-off-answers.test.ts`',
      'No pin of the record tests of WS09 steps 1 to 4 moves',
    ]) expect(pins, piece).toContain(piece)
    if (latestStep !== 5) return
    expect(read('test/unit/drizzle-baseline.test.ts')).toContain('expect(buildLocalSqlite(out)).toEqual({ files: 64, tables: 40 })')
    expect(read('test/unit/drizzle-baseline.test.ts')).toContain('expect(sql.at(-1)).toBe(\'0067_club_pages_seed.sql\')')
    expect(read('test/unit/db-generate-guard.test.ts')).toContain('toBe(\'0068\')')
    expect(read('test/unit/db-generate-real-kit.test.ts')).toContain('expect(journal.entries).toHaveLength(13)')
    expect(read('test/unit/seed-fixtures.test.ts')).toContain('expect(files.at(-1)).toMatch(/^0067_/)')
    expect(read('test/unit/schema-drift.test.ts')).toContain('expect(counted).toBe(390)')
    expect(read('test/unit/migration-safety.test.ts')).toContain('expect(links()).toHaveLength(19)')
  })

  it('gives the lint as unchanged and the build\'s names and sizes as the base\'s', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-YVdCmnd0.js` 554,147 bytes', '`index-MGRWYyBv.css` 131,136 bytes', '`features-nZCZoT6G.js` 729 bytes',
      'the same names and sizes as the base `535b6a9`\'s', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 5: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('from 9:18 AM to 9:44 AM UTC')
  })

  it('counts as many cases for each new test as the file holds', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [...NEW_TESTS, ...NEW_INTEGRATION]) expect(writtenCount(files, file), file).toBe(casesIn(file))
  })

  it('gives unit counts that add up: the base\'s, the new files\' and the changed files\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([9077, 351])
    const fresh = NEW_TESTS.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    const moved = CHANGED_UNIT.reduce((a, [, n, was]) => a + n - was, 0)
    expect(num(before) + fresh + GROWN + moved).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts that add up: the base\'s, the new file\'s and the cases the changed file gained', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1896, 116])
    const fresh = NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    expect(num(before) + fresh + CHANGED_INTEGRATION.reduce((a, [, n, was]) => a + n - was, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
    for (const [file, n] of CHANGED_INTEGRATION) expect(casesIn(file), file).toBe(n)
  })

  it('gives the lint files as the base\'s with the new files lint reads added, and the build\'s file count once on each side', () => {
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(Number(lint![2])).toBe(987)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_LINTED.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 5: the map and the lists', () => {
  it('adds one sentence to criterion 5, before the planned step, and to no other item', () => {
    const item = mapItem('Criterion 5')
    expect(item.split('Built in WS09 step 5: the slugs of the 25 clubs, '), 'Criterion 5').toHaveLength(2)
    expect(item.indexOf('Built in WS09 step 5: ')).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    expect(item).toContain('(migration 0067)')
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 5:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 5'])
  })

  it('records the step\'s decisions, deviations, verify items and follow-ups, each tagged', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'The seed\'s four data points, as K chose them (WS09 step 5).', 'The seed writes only empty fields of known clubs (WS09 step 5).',
    ])
    expect(tagged(deviations).map(head)).toEqual([
      'Three place names typed out (WS09 step 5).', 'The About texts typed out and guarded (WS09 step 5).', 'More guards than the entry names (WS09 step 5).',
      'Six old addresses, not one per club (WS09 step 5).', 'Tests beyond the entry\'s list (WS09 step 5).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'The 18 lines (WS09 step 5).', 'Descriptions and meeting lines (WS09 step 5).', 'The doubled apostrophes (WS09 step 5).', 'Stored points (WS09 step 5).',
      'Heart of Worship\'s point (WS09 step 5).', 'Production\'s rows (WS09 step 5).', 'The answers that read the new fields (WS09 step 5).', 'The local database (WS09 step 5).',
    ])
    for (const entry of tagged(verify)) {
      const body = entry.slice(entry.indexOf('.**') + 4)
      expect(body, head(entry)).toMatch(head(entry) === 'Production\'s rows (WS09 step 5).' ? /^Not checked: no remote read was made\./ : /^Confirmed on `535b6a9`/)
    }
    expect(tagged(followUps).map(head)).toEqual([
      'The rehearsal on the preview database, owed before checkpoint S\'s pull request (WS09 step 5).',
      'The four counts of production, owed before checkpoint S\'s pull request (WS09 step 5).',
      'The check sheet for K, owed with checkpoint S\'s pull request (WS09 step 5).', 'The staging snapshot 0012 beside the mail stream\'s (WS09 step 5).',
      'Heart of Worship\'s pin (WS09 step 5).', 'The told month (WS09 step 5).',
    ])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 5: plain language', () => {
  const written = [block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), mapItem('Criterion 5')].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the step wrote, and dates and times in their plain form', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    expect(written).not.toMatch(/\.github\//)
    const prose = proseOf(written)
    expect(prose).not.toMatch(HE)
    expect(written).not.toMatch(/\(step \d+[;),]/)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds or changes', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_TESTS.map(([f]) => f)]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      // test/unit/drizzle-baseline.test.ts names the tools in its own guard against them, so only the dashes and the initials are read there.
      const rules = file === 'test/unit/drizzle-baseline.test.ts' ? [DASHES, OLD_INITIALS] : [DASHES, TOOLS, BARE]
      for (const rule of rules) expect(text, file).not.toMatch(rule)
      // The migration compares today's text, old initials and all, in its guards, and writes them nowhere.
      if (file === SEED) {
        for (const line of text.split('\n').filter((l) => OLD_INITIALS.test(l))) expect(line, line).toMatch(/^ {3}AND description = '/)
      } else if (file !== 'test/unit/drizzle-baseline.test.ts') {
        expect(text, file).not.toMatch(OLD_INITIALS)
      }
    }
  })
})
