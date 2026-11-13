// test/unit/redesign-status-ws09-step4.test.ts
//
// REDESIGN_STATUS.md records WS09 step 4: the club tables and the slug rule,
// migration 0066, a new club's slug, and the member delete and the club
// delete clearing the new references, each going on when the migration run
// lags. Like WS09 step 3's record test, this file reads only the WS09
// section, from its heading to the WS10 heading. Pinned here: the block's
// place, right after WS09 step 3's and before the four lists; the Status
// line's tail while this step is the latest; the block's parts in order and
// its figures, which must agree with each other and with the files they
// describe; the sentences this step added to the map; the tagged entries of
// the four lists; and the plain-language rules over the block and the files
// the step adds or changes. What a later step will change in the tree (the
// next number, the journal, the pinned counts) is read only while this step
// is the latest.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nextMigrationNumber } from '../../scripts/db/generate'
import { RESERVED_SLUGS } from '../../domain/clubs/slug'

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
const TAG = '(WS09 step 4).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const STEP_3 = '### WS09 step 3: the regions fill'
const STEP = '### WS09 step 4: the club tables and the slug rule'
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

/** The files this step adds, and those of them that are unit tests and integration tests. */
const NEW_FILES = [
  'migrations/0066_club_pages.sql', 'drizzle/meta/0011_snapshot.json', 'domain/clubs/slug.ts', 'functions/utils/clubs/adminAnswer.ts',
  'functions/utils/clubs/migrationLag.ts', 'test/integration/clubTables.ts', 'test/unit/club-slug.test.ts', 'test/unit/migration-0066-club-pages.test.ts',
  'test/unit/club-tables-lagging-run.test.ts', 'test/integration/member-delete-club-refs.test.ts', 'test/integration/club-delete.test.ts',
  'test/integration/club-create-slug.test.ts', 'test/unit/club-slug-edges.test.ts', 'test/integration/club-tables-edges.test.ts',
  'test/integration/club-columns-stay-off-answers.test.ts', 'test/unit/redesign-status-ws09-step4.test.ts',
]
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.ts$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new files lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => f.endsWith('.ts'))
/** The files this step changes that are not tests. */
const CHANGED = [
  'functions/db/schema.ts', 'functions/api/admin/clubs.ts', 'functions/api/admin/members/[id].ts', 'functions/api/admin/clubs/[id].ts',
  'drizzle/meta/_journal.json', 'migrations/README.md',
]
/** The tests this step changes, each with its count and the count before, unit and integration apart. */
const CHANGED_INTEGRATION: ReadonlyArray<readonly [string, number, number]> = [
  ['test/integration/public-answer-columns.test.ts', 11, 11],
  ['test/integration/club-permissions.test.ts', 23, 23],
]
const CHANGED_UNIT: ReadonlyArray<readonly [string, number, number]> = [
  ['test/unit/schema-drift.test.ts', 13, 13],
  ['test/unit/drizzle-baseline.test.ts', 26, 26],
  ['test/unit/db-generate-guard.test.ts', 31, 31],
  ['test/unit/db-generate-real-kit.test.ts', 13, 13],
  ['test/unit/seed-fixtures.test.ts', 14, 14],
  ['test/unit/redesign-status-ws09-step3.test.ts', 22, 22],
]
const CHANGED_TESTS = [...CHANGED_INTEGRATION, ...CHANGED_UNIT]
/** The cases a unit test that grew with no change of its own gained. */
const GROWN = 1
/** The fifteen columns on clubs and the four tables, as the brief writes them. */
const CLUB_COLUMNS = [
  'slug', 'about_text', 'how_we_meet_text', 'cost_text', 'welcome_text', 'weekend_play', 'scholastic_friendly', 'contact_name_public',
  'facebook_url', 'website_url', 'other_url', 'told_updated_at', 'told_by', 'last_confirmed_at', 'confirmed_by',
]
const TABLES: Record<string, number> = { club_slug_history: 2, club_places: 8, club_reports: 13, club_rep_requests: 9 }
/** The statements each delete adds, in the handler the record names. */
const MEMBER_DELETE = [
  'UPDATE clubs SET told_by = NULL WHERE told_by = ?', 'UPDATE clubs SET confirmed_by = NULL WHERE confirmed_by = ?',
  'UPDATE club_reports SET resolved_by = NULL WHERE resolved_by = ?', 'UPDATE club_rep_requests SET decided_by = NULL WHERE decided_by = ?',
  'DELETE FROM club_rep_requests WHERE member_id = ?',
]
const CLUB_DELETE = [
  'DELETE FROM club_places WHERE club_id = ?', 'DELETE FROM club_slug_history WHERE club_id = ?',
  'DELETE FROM club_reports WHERE club_id = ?', 'DELETE FROM club_rep_requests WHERE club_id = ?',
]
/** The map items this step adds a sentence to. */
const MAPPED = ['Criterion 5', 'Criterion 9', 'Criterion 10', 'Criterion 11', 'Criterion 12']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])

describe('REDESIGN_STATUS.md, WS09 step 4: the block and the Status line', () => {
  it('sits once, right after WS09 step 3\'s block and before the four lists', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    const at = [STEP_3, STEP, LISTS[0]].map((h) => ws09.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
    expect(headings[headings.indexOf(STEP_3) + 1]).toBe(STEP)
    if (latestStep === 4) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest', () => {
    expect(latestStep).toBeGreaterThanOrEqual(4)
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestStep === 4) expect(tail).toBe('steps 1 to 4 are built.')
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying the step changes no page, what it adds, and why every club gets a slug now, by K\'s choice', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the fourth step of checkpoint S', 'It changes no page', '`0066_club_pages.sql`', '`functions/db/schema.ts`', '`domain/clubs/slug.ts`',
      'K\'s decision 1, choice 8 (a), of Friday, November 13, 2026', 'from checkpoint W a club\'s short address finds today\'s page with every switch off',
      'filled by WS09 step 5',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The tables.**', '- **The slug rule.**', '- **The deletes.**', '- **A lagging migration run.**',
      '- **The generator\'s run.**', '- **The map.**', '- **The branch.**', '- **What the merge does.**', '- **What ships with every switch off.**',
      '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 4: the parts', () => {
  it('names every file it adds and changes, each test with its count, and the two sub-lines', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_TESTS.map(([f]) => f), 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of [...NEW_TESTS, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const [name, after, before] of CHANGED_TESTS) {
      expect(files, name).toContain(after === before ? `\`${name}\` (${after}, as before: ` : `\`${name}\` (${after}, ${before} before: `)
    }
    expect(files).toContain('  - Grown with no change: `test/unit/domain-boundaries.test.ts`, by one case')
    expect(files).toContain('  - Files beyond the step\'s list: `functions/utils/clubs/adminAnswer.ts`')
    expect(files).toContain('Nothing under `src/` or `workers/` changes, no handler file is added, and no file the mail stream holds is touched.')
  })

  it('gives the tables their fifteen columns and four tables, as the migration and the schema hold them', () => {
    const tables = bullet(block, '- **The tables.**')
    for (const column of CLUB_COLUMNS) expect(tables, column).toContain(`\`${column}\``)
    for (const [table, n] of Object.entries(TABLES)) expect(tables, table).toMatch(new RegExp(`\`${table}\`, (?:${n} columns|${n})[;,.]`))
    for (const piece of [
      '`idx_clubs_slug`', '`escalated_at`', 'WS09 step 29', '`club_photos`, for WS09 step 36', 'for WS09 step 16', '`zip_regions` and `club_distances`',
      '40 tables and 390 columns, 36 and 343 on the base', '`test/unit/schema-drift.test.ts` finds no difference', '`test/unit/migration-0066-club-pages.test.ts`',
      '`slug` is NULL for every club that exists, which the unique index allows for any number of rows',
    ]) expect(tables, piece).toContain(piece)
    const sql = read('migrations/0066_club_pages.sql').replace(/--[^\n]*/g, '')
    for (const column of CLUB_COLUMNS) expect(sql, column).toMatch(new RegExp(`ALTER TABLE clubs ADD COLUMN ${column} `))
    expect(sql).toContain('CREATE UNIQUE INDEX idx_clubs_slug ON clubs(slug);')
    for (const table of Object.keys(TABLES)) expect(sql, table).toContain(`CREATE TABLE ${table} (`)
    for (const piece of ['`suggestion`, `new_club` and `start_club`', '`open`, `applied`, `answered` and `dismissed`', '`runs_it`, `helps_run_it`, `keeps_page` and `other`', '`open`, `approved` and `declined`']) {
      expect(tables, piece).toContain(piece)
    }
    const schema = read('functions/db/schema.ts')
    for (const name of ['clubSlugHistory', 'clubPlaces', 'clubReports', 'clubRepRequests']) expect(schema, name).toContain(`export const ${name} = sqliteTable(`)
  })

  it('gives the slug rule as the module and the create hold it', () => {
    const rule = bullet(block, '- **The slug rule.**')
    for (const piece of [
      '`domain/clubs/slug.ts`, which imports nothing', '`slugFor(name)`', '`uniqueSlug(base, taken)`', '`slugAtSave(current, name, taken)`', 'at most 48 characters, with a hyphen the cut leaves at the end dropped',
      '`-2`, `-3`', 'a slug is made once and kept on rename', '`POST /api/admin/clubs`', '`club_slug_history.old_slug`', '`uniqueSlug(slugFor(name), taken)`',
      'written in the same insert', 'never fails on the unique slug index with a 500', '"Slidell Chess Club"', '`slidell-chess-club`',
      '`test/unit/club-slug.test.ts`', '`test/integration/club-create-slug.test.ts`',
    ]) expect(rule, piece).toContain(piece)
    expect(rule).toContain(`\`RESERVED_SLUGS\` is ${RESERVED_SLUGS.slice(0, -1).map((w) => `\`${w}\``).join(', ')} and \`${RESERVED_SLUGS.at(-1)}\``)
    const create = read('functions/api/admin/clubs.ts')
    expect(create).toContain('const id = uniqueSlug(slugFor(name), taken)')
    expect(create).toContain('INSERT INTO clubs (id, name, city, region, contact_email, slug) VALUES (?, ?, ?, ?, ?, ?)')
    expect(read('domain/clubs/slug.ts')).not.toMatch(/^\s*import\b/m)
  })

  it('names what each delete clears, as the two handlers hold it', () => {
    const deletes = bullet(block, '- **The deletes.**')
    for (const piece of [
      '`DELETE /api/admin/members/[id]`', '`clubs.told_by`, `clubs.confirmed_by`, `club_reports.resolved_by` and `club_rep_requests.decided_by`',
      'deletes the member\'s own `club_rep_requests`', '`DELETE /api/admin/clubs/[id]`', '`club_places`, `club_slug_history`, `club_reports` and `club_rep_requests`',
      'No new reference has a delete action', 'each of the nine references', '`test/integration/member-delete-club-refs.test.ts`', '`test/integration/club-delete.test.ts`',
      'A club that owns a mail list still fails the delete, as before',
    ]) expect(deletes, piece).toContain(piece)
    const member = read('functions/api/admin/members/[id].ts')
    for (const statement of MEMBER_DELETE) expect(member, statement).toContain(`prepare('${statement}')`)
    expect(member.indexOf(MEMBER_DELETE[0])).toBeLessThan(member.indexOf('DELETE FROM members WHERE id = ?'))
    const club = read('functions/api/admin/clubs/[id].ts')
    for (const statement of CLUB_DELETE) expect(club, statement).toContain(`prepare('${statement}')`)
    expect(club.indexOf(CLUB_DELETE[0])).toBeLessThan(club.indexOf('DELETE FROM clubs WHERE id = ?'))
  })

  it('names each path\'s log line and the test that tells a missing table or column, as the handlers export them', () => {
    const lag = bullet(block, '- **A lagging migration run.**')
    const owners: Array<[string, string]> = [
      ['CLUB_REFERENCES_UNCLEARED_LOG', 'functions/api/admin/members/[id].ts'], ['CLUB_ROWS_UNCLEARED_LOG', 'functions/api/admin/clubs/[id].ts'],
      ['CLUB_SLUGS_UNREAD_LOG', 'functions/api/admin/clubs.ts'],
    ]
    for (const [name, file] of owners) {
      expect(lag, name).toContain(`\`${name}\``)
      expect(read(file), name).toContain(`export const ${name} = '`)
      expect(read(file), name).toContain(`console.warn(${name})`)
      expect(read(file), name).toContain('if (!isMissingTableOrColumn(err)) throw err')
    }
    for (const piece of [
      '`isMissingTableOrColumn`', '`functions/utils/clubs/migrationLag.ts`', '"no such table" or "no such column"', 'names no club and no person',
      '`NEWSLETTER_ROWS_UNREAD_LOG`', 'Any other failure is not caught', '`test/unit/club-tables-lagging-run.test.ts`', 'migrations 0001 to 0060 alone',
    ]) expect(lag, piece).toContain(piece)
  })

  it('gives the generator\'s run as the journal, the snapshot and the README hold it', () => {
    const run = bullet(block, '- **The generator\'s run.**')
    for (const piece of [
      '`npm run db:generate -- club pages --custom --number 0066`', '`drizzle/0011_club_pages.sql`', 'idx 11, tag `0011_club_pages`', '`drizzle/meta/0011_snapshot.json`',
      '"No schema changes, nothing to migrate"', 'the generator now gives `0067`', 'No file was renamed by hand.',
    ]) expect(run, piece).toContain(piece)
    expect(read('migrations/0066_club_pages.sql')).toContain('-- drizzle/0011_club_pages.sql.')
    if (latestStep !== 4) return
    const journal = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: Array<{ idx: number; tag: string; version: string; breakpoints: boolean }> }
    expect(journal.entries).toHaveLength(12)
    expect(journal.entries[11]).toMatchObject({ idx: 11, tag: '0011_club_pages', version: '6', breakpoints: true })
    expect(nextMigrationNumber(readdirSync(join(ROOT, 'migrations')))).toBe('0067')
    expect(read('migrations/README.md').replace(/\s+/g, ' ')).toContain('`0067` is next')
  })

  it('names the map\'s five sentences, the branch and what the merge does', () => {
    const mapPart = bullet(block, '- **The map.**')
    for (const piece of ['20 items', 'one sentence added to each of five', 'criterion 5', 'criterion 9', 'criterion 10', 'criterion 11', 'criterion 12', 'It proves no item in full.']) {
      expect(mapPart, piece).toContain(piece)
    }
    expect(bullet(block, '- **The branch.**')).toContain('`redesign/ws09-clubs`, with WS09 step 3 at `391796d` on WS09 step 2\'s `42e232a`, WS09 step 1\'s `0fec98b` and `af4a21c`; this step\'s diff is against `391796d`.')
    expect(bullet(block, '- **The branch.**')).toContain('`13a2c36`')
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['One migration and no new endpoint or route.', '`migrate-db.yml`', 'must be seen green before the live check', 'a failed run means the merge is not finished', '`deploy-worker.yml`', 'byte for byte as before']) {
      expect(does, piece).toContain(piece)
    }
  })

  it('says nothing a person can meet ships with every switch off, and names the answers that now name their columns', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Nothing a visitor or a member can see or do.')).toBe(true)
    for (const piece of [
      'nullable or defaulted', 'the four new tables are empty', '`test/integration/public-answer-columns.test.ts`', '`GET` and `PATCH /api/admin/clubs/[id]` and `POST /api/admin/clubs`',
      '`ADMIN_CLUB_COLUMNS`', 'answers exactly what it answered before', '`workers/` reads no club', 'today\'s answer, byte for byte', 'No switch is added',
    ]) expect(ships, piece).toContain(piece)
    expect(read('functions/utils/clubs/adminAnswer.ts')).toContain(
      'export const ADMIN_CLUB_COLUMNS =\n  \'id, name, city, location, description, meeting_schedule, contact_email, created_at, color, image_url, region, latitude, longitude\'',
    )
    for (const file of ['functions/api/admin/clubs.ts', 'functions/api/admin/clubs/[id].ts']) expect(read(file), file).toContain('SELECT ${ADMIN_CLUB_COLUMNS} FROM clubs WHERE id = ?')
    expect(read('functions/api/admin/clubs/[id].ts').split('SELECT ${ADMIN_CLUB_COLUMNS} FROM clubs')).toHaveLength(3)
  })

  it('names its pins with the figures as they stand on this branch', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/unit/drizzle-baseline.test.ts`, both cases', '"all 63 migrations"', '`{ files: 63, tables: 40 }`', '`0066_club_pages.sql`', '41 with the case\'s own table, 37 on the base',
      '`test/unit/db-generate-guard.test.ts`', '`0067` today', '`test/unit/redesign-status-ws08-step2-claims.test.ts` with `migrations/README.md`', '`test/unit/seed-fixtures.test.ts`',
      '"0001 to 0066"', '`test/unit/schema-drift.test.ts`: 40 tables and 390 columns, 36 and 343 on the base', '`test/unit/db-generate-real-kit.test.ts`: "40 tables"',
      '12 entries, 11 on the base', 'Not moved: `test/unit/migration-safety.test.ts`, 19 links', '`test/integration/public-answer-columns.test.ts`',
      '`test/integration/club-permissions.test.ts`', '`test/unit/redesign-status-ws09-step3.test.ts`, a closed check', 'No pin of WS09 step 1\'s or WS09 step 2\'s record test moves.',
    ]) expect(pins, piece).toContain(piece)
    if (latestStep !== 4) return
    expect(read('test/unit/drizzle-baseline.test.ts')).toContain('expect(buildLocalSqlite(out)).toEqual({ files: 63, tables: 40 })')
    expect(read('test/unit/drizzle-baseline.test.ts')).toContain('expect(sql.at(-1)).toBe(\'0066_club_pages.sql\')')
    expect(read('test/unit/db-generate-guard.test.ts')).toContain('toBe(\'0067\')')
    expect(read('test/unit/db-generate-real-kit.test.ts')).toContain('expect(journal.entries).toHaveLength(12)')
    expect(read('test/unit/db-generate-real-kit.test.ts')).toContain('expect(run.output).toMatch(/40 tables/)')
    expect(read('test/unit/seed-fixtures.test.ts')).toContain('expect(files.at(-1)).toMatch(/^0066_/)')
    expect(read('test/unit/schema-drift.test.ts')).toContain('expect(counted).toBe(390)')
    expect(read('test/unit/migration-safety.test.ts')).toContain('expect(links()).toHaveLength(19)')
  })

  it('gives the lint as unchanged and the build\'s names and sizes as the base\'s', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-YVdCmnd0.js` 554,147 bytes', '`index-MGRWYyBv.css` 131,136 bytes', '`features-nZCZoT6G.js` 729 bytes',
      'the same names and sizes as the base `391796d`\'s', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes', 'on the base and on the finished tree alike',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 4: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('from 7:00 AM to 7:22 AM UTC')
  })

  it('counts as many cases for each new test as the file holds', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [...NEW_TESTS, ...NEW_INTEGRATION]) expect(writtenCount(files, file), file).toBe(casesIn(file))
  })

  it('gives unit counts that add up: the base\'s, the new files\', the grown file\'s and the changed files\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([9014, 346])
    const fresh = NEW_TESTS.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    const moved = CHANGED_UNIT.reduce((a, [, n, was]) => a + n - was, 0)
    expect(num(before) + fresh + GROWN + moved).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts that add up: the base\'s, the new files\' and the cases the changed files gained', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1859, 111])
    const fresh = NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    expect(num(before) + fresh + CHANGED_INTEGRATION.reduce((a, [, n, was]) => a + n - was, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
    for (const [file, n] of CHANGED_INTEGRATION) expect(casesIn(file), file).toBe(n)
  })

  it('gives the lint files as the base\'s with the new files lint reads added, and the build\'s file count once on each side', () => {
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(Number(lint![2])).toBe(973)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_LINTED.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 4: the map and the lists', () => {
  it('adds one sentence to each of the five items, before the planned step, and to no other item', () => {
    for (const id of MAPPED) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 4: the ground, '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 4: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
      expect(item, id).toContain('(migration 0066)')
    }
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 4:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(MAPPED)
    expect(mapItem('Criterion 5')).toContain('`domain/clubs/slug.ts`')
    expect(mapItem('Criterion 10')).toContain('`club_reports`')
    expect(mapItem('Criterion 11')).toContain('`club_rep_requests`')
    expect(mapItem('Criterion 12')).toContain('`last_confirmed_at` and `confirmed_by`')
  })

  it('records the step\'s decisions, deviations, verify items and follow-ups, each tagged', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'The club tables\' references have no delete action (WS09 step 4).', 'A new club\'s id and slug are one value (WS09 step 4).',
    ])
    expect(tagged(deviations).map(head)).toEqual(['Today\'s admin club answers name their columns (WS09 step 4).', 'More tests move than the entry names (WS09 step 4).'])
    expect(tagged(verify).map(head)).toEqual([
      'The member delete (WS09 step 4).', 'The club delete (WS09 step 4).', 'References on ALTER (WS09 step 4).', 'The id is already the slug (WS09 step 4).',
      'The snapshot chain (WS09 step 4).', 'Every other read of a whole club row (WS09 step 4).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `391796d`: /)
    expect(tagged(verify)[3]).toContain('19 of the 25 clubs')
    expect(tagged(followUps).map(head)).toEqual([
      'A club that owns a mail list, for the mail stream (WS09 step 4).', 'The staging snapshot 0011 beside the mail stream\'s (WS09 step 4).',
      'The migration run at checkpoint S\'s merge (WS09 step 4).', 'The slugs of the 25 clubs (WS09 step 4).',
      'The child profile delete clears no club reference (WS09 step 4).', 'Two creates of one name at the same moment (WS09 step 4).',
    ])
    expect(tagged(followUps)[0]).toContain('this step changes nothing of theirs')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 4: plain language', () => {
  const written = [block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), ...MAPPED.map(mapItem)].join('\n')

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
      const rules = file === 'test/unit/drizzle-baseline.test.ts' ? [DASHES, OLD_INITIALS] : [DASHES, TOOLS, BARE, OLD_INITIALS]
      for (const rule of rules) expect(text, file).not.toMatch(rule)
    }
  })
})
