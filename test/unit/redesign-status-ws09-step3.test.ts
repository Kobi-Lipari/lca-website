// test/unit/redesign-status-ws09-step3.test.ts
//
// REDESIGN_STATUS.md records WS09 step 3: the regions fill, migration 0065,
// and the roster and the officers' emails held back from a person admitted
// to a club by a regional seat alone. Like WS09 step 2's record test, this
// file reads only the WS09 section, from its heading to the WS10 heading.
// Pinned here: the block's place, right after WS09 step 2's and before the
// four lists; the Status line's tail while this step is the latest; the
// block's parts in order and its figures, which must agree with each other
// and with the files they describe; the sentence this step added to the
// map; the tagged entries of the four lists; and the plain-language rules
// over the block and the files the step adds or changes. What a later step
// will change in the tree (the next number, the journal, the handlers that
// call the club guards) is read only while this step is the latest.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { nextMigrationNumber } from '../../scripts/db/generate'
import { REGIONS } from '../../domain/clubs/regions'

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
const TAG = '(WS09 step 3).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const STEP_2 = '### WS09 step 2: the switches and the preview bucket'
const STEP = '### WS09 step 3: the regions fill'
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
  'migrations/0065_club_regions.sql', 'drizzle/meta/0010_snapshot.json', 'functions/utils/clubs/memberView.ts',
  'test/unit/migration-0065-club-regions.test.ts', 'test/unit/member-view.test.ts', 'test/unit/redesign-status-ws09-step3.test.ts',
  'test/integration/club-regions-fill.test.ts',
]
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.ts$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new files lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => f.endsWith('.ts'))
/** The files this step changes that are not tests. */
const CHANGED = [
  'functions/api/admin/clubs/[id].ts', 'functions/api/admin/clubs/[id]/roster.ts', 'functions/api/admin/clubs/[id]/officers.ts',
  'drizzle/meta/_journal.json', 'migrations/README.md', 'docs/redesign/club_regions.sql',
]
/** The tests this step changes, each with its count and the count before, unit and integration apart. */
const CHANGED_INTEGRATION: ReadonlyArray<readonly [string, number, number]> = [
  ['test/integration/club-permissions.test.ts', 23, 14],
  ['test/integration/officer-regions.test.ts', 12, 12],
  ['test/integration/nav-personas.test.ts', 11, 11],
]
const CHANGED_UNIT: ReadonlyArray<readonly [string, number, number]> = [
  ['test/unit/drizzle-baseline.test.ts', 26, 26],
  ['test/unit/db-generate-guard.test.ts', 31, 31],
  ['test/unit/db-generate-real-kit.test.ts', 13, 13],
  ['test/unit/seed-fixtures.test.ts', 14, 14],
  ['test/unit/redesign-status-ws09-step2.test.ts', 23, 23],
]
const CHANGED_TESTS = [...CHANGED_INTEGRATION, ...CHANGED_UNIT]
/** The 25 clubs of Appendix C by id, in the regions the migration gives them. */
const PLACED: Record<string, string[]> = {
  'New Orleans Metro': [
    'downriver-chess-club', 'greater-new-orleans-chess-club', 'new-orleans-westbank-chess-club', 'marrero-chess-organization',
    'north-kenner-library-chess-club', 'metairie', 'knight-light-chess', 'strategic-thoughts-nola',
  ],
  'North of Lake Pontchartrain': ['mandeville-chess-club', 'slidell', 'picayune-chess-club'],
  'South Central Louisiana': ['baton-rouge', 'bluebonnet-chess-club', 'gonzales-chess-club', 'lafayette-chess-club', 'heart-of-worship-church-chess'],
  'Bayou Region': ['houma-chess-club', 'morgan-city-chess-club'],
  'Southwest Louisiana': ['casa-de-ajedrez', 'beauregard-parish-youth-chess'],
  'Central Louisiana': ['bunkie-chess-club', 'pineville-homeschool-chess-club'],
  'North Louisiana': ['shreveport', 'monroe', 'ruston'],
}
/** The handlers under functions/api/admin/clubs/ the block says it read, and every file that calls a club guard. */
const CLUB_HANDLERS = [
  'functions/api/admin/clubs/[id].ts', 'functions/api/admin/clubs/[id]/logo.ts', 'functions/api/admin/clubs/[id]/news.ts',
  'functions/api/admin/clubs/[id]/news/[newsId].ts', 'functions/api/admin/clubs/[id]/officers.ts',
  'functions/api/admin/clubs/[id]/officers/[officerId].ts', 'functions/api/admin/clubs/[id]/roster.ts',
]
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])
/** Every file under a folder, as a path from the root. */
function filesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true, recursive: true })
    .filter((d) => d.isFile() && d.name.endsWith('.ts'))
    .map((d) => join(d.parentPath, d.name).slice(ROOT.length + 1))
}

describe('REDESIGN_STATUS.md, WS09 step 3: the block and the Status line', () => {
  it('sits once, right after WS09 step 2\'s block and before the four lists', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    const at = [STEP_2, STEP, LISTS[0]].map((h) => ws09.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
    expect(headings[headings.indexOf(STEP_2) + 1]).toBe(STEP)
    if (latestStep === 3) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest', () => {
    expect(latestStep).toBeGreaterThanOrEqual(3)
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestStep === 3) expect(tail).toBe('steps 1 to 3 are built.')
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying the step changes no page\'s code and ships the fill by K\'s yes', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the third step of checkpoint S', 'It changes no page\'s code', '`0065_club_regions.sql`', 'Appendix C', 'admitted to the club by a regional seat alone',
      'decision 1, choice 1 (a), of Friday, November 13, 2026',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The fill.**', '- **The roster stays back.**', '- **The generator\'s run.**', '- **The map.**',
      '- **The branch.**', '- **What the merge does.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 3: the parts', () => {
  it('names every file it adds and changes, each test with its count, and the two sub-lines', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_TESTS.map(([f]) => f), 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of [...NEW_TESTS, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const [name, after, before] of CHANGED_TESTS) {
      expect(files, name).toContain(after === before ? `\`${name}\` (${after}, as before: ` : `\`${name}\` (${after}, ${before} before: `)
    }
    expect(files).toContain('  - Grown with no change: none.')
    expect(files).toContain('  - Files beyond the step\'s list: `functions/utils/clubs/memberView.ts`')
    expect(files).toContain('`functions/utils/admin/permissions.ts` and `seat_regions` are untouched')
  })

  it('gives the fill\'s 25 ids in their seven regions, by id and blank only, as the migration holds them', () => {
    const fill = bullet(block, '- **The fill.**')
    const sql = read('migrations/0065_club_regions.sql')
    expect(Object.keys(PLACED).sort()).toEqual([...REGIONS].sort())
    for (const [region, ids] of Object.entries(PLACED)) {
      expect(fill, region).toContain(`${region}, ${ids.length} (${ids.map((id) => `\`${id}\``).join(', ')})`)
      expect(sql, region).toContain(`UPDATE clubs SET region = '${region}'\n WHERE id IN (${ids.map((id) => `'${id}'`).join(', ')})\n   AND (region IS NULL OR region = '');`)
    }
    expect(sql.match(/^UPDATE clubs SET region = /gm) ?? []).toHaveLength(7)
    for (const piece of ['`AND (region IS NULL OR region = \'\')`', 'a second run changes no row', '`test/unit/migration-0065-club-regions.test.ts`', '36 tables, 343 columns and 19 links do not move']) {
      expect(fill, piece).toContain(piece)
    }
  })

  it('says who is admitted by the region alone and what each endpoint answers them, as the helper and the handlers hold', () => {
    const back = bullet(block, '- **The roster stays back.**')
    for (const piece of [
      '`admittedByRegionAlone`', '`functions/utils/clubs/memberView.ts`', 'not an LCA admin, not an observer (`lca_observer` or `lca_officer`) and not the club\'s own rep',
      '`GET /api/admin/clubs/[id]`', 'an empty roster', '`GET /api/admin/clubs/[id]/roster` answers them 403', '`GET /api/admin/clubs/[id]/officers` answers them the officers without their emails',
      '`POST /api/admin/clubs/[id]/officers` answers them the same 403', 'never says whether a member id is on the roster',
      'byte for byte', 'The person keeps the listing, its save, the news and the logo.', '`functions/utils/admin/permissions.ts` is not changed',
    ]) expect(back, piece).toContain(piece)
    const helper = read('functions/utils/clubs/memberView.ts')
    const words = /export const ROSTER_KEPT_BACK = '(.*)'$/m.exec(helper)?.[1]?.replace(/\\'/g, '\'')
    expect(back).toContain(`\`${JSON.stringify({ error: words })}\``)
    for (const handler of ['functions/api/admin/clubs/[id].ts', 'functions/api/admin/clubs/[id]/roster.ts', 'functions/api/admin/clubs/[id]/officers.ts']) {
      expect(read(handler), handler).toContain('admittedByRegionAlone(authResult.member, clubId)')
    }
    expect(read('functions/utils/admin/permissions.ts')).not.toContain('memberView')
    for (const handler of ['functions/api/admin/clubs/[id]/roster.ts', 'functions/api/admin/clubs/[id]/officers.ts']) {
      expect(read(handler), handler).toContain('if (admittedByRegionAlone(authResult.member, clubId)) return errorResponse(ROSTER_KEPT_BACK, 403)')
    }
  })

  it('names every handler under functions/api/admin/clubs/ it read, and while this step is the latest no other file calls a club guard', () => {
    const back = bullet(block, '- **The roster stays back.**')
    for (const piece of ['`officers/[officerId].ts`', '`news.ts`', '`news/[newsId].ts`', '`logo.ts`', 'the PATCH of `[id].ts`', 'a member\'s id is not secret', '`GET /api/tournaments/[id]` answers each entrant\'s `member_id`']) {
      expect(back, piece).toContain(piece)
    }
    expect(latestStep).toBeGreaterThanOrEqual(3)
    if (latestStep !== 3) return
    expect(filesUnder('functions/api/admin/clubs/[id]').concat('functions/api/admin/clubs/[id].ts').sort()).toEqual([...CLUB_HANDLERS].sort())
    const callers = filesUnder('functions').filter((f) => /\b(?:requireClubView|requireClubRep|canManageClub)\(/.test(read(f)))
    expect(callers.sort()).toEqual([...CLUB_HANDLERS, 'functions/utils/admin/permissions.ts', 'functions/utils/auth.ts'].sort())
  })

  it('gives the generator\'s run as the journal, the snapshot and the README hold it', () => {
    const run = bullet(block, '- **The generator\'s run.**')
    for (const piece of [
      '`npm run db:generate -- club regions --custom --number 0065`', '`drizzle/0010_club_regions.sql`', 'It did write a staging journal entry and a snapshot',
      'idx 10, tag `0010_club_regions`', '`drizzle/meta/0010_snapshot.json`', '"No schema changes, nothing to migrate"', 'the generator now gives `0066`', 'No file was renamed by hand.',
    ]) expect(run, piece).toContain(piece)
    expect(read('migrations/0065_club_regions.sql')).toContain('-- drizzle/0010_club_regions.sql.')
    const readme = read('migrations/README.md').replace(/\s+/g, ' ')
    expect(readme).toContain('The clubs work\'s next file, `0066`, is made with `--number`')
    if (latestStep !== 3) return
    const journal = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: Array<{ idx: number; tag: string; version: string; breakpoints: boolean }> }
    expect(journal.entries).toHaveLength(11)
    expect(journal.entries[10]).toMatchObject({ idx: 10, tag: '0010_club_regions', version: '6', breakpoints: true })
    expect(nextMigrationNumber(readdirSync(join(ROOT, 'migrations')))).toBe('0066')
    expect(readme).toContain('`0066` is next')
  })

  it('names the map\'s sentence, the branch and what the merge does', () => {
    const mapPart = bullet(block, '- **The map.**')
    for (const piece of ['20 items', 'one sentence added to criterion 12', '(D10)', 'It proves no item in full.']) expect(mapPart, piece).toContain(piece)
    expect(bullet(block, '- **The branch.**')).toContain('`redesign/ws09-clubs`, with WS09 step 2 at `42e232a` on WS09 step 1\'s `0fec98b` and `af4a21c`; this step\'s diff is against `42e232a`.')
    expect(bullet(block, '- **The branch.**')).toContain('`13a2c36`')
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['One migration and no new endpoint or route.', '`migrate-db.yml`', 'must be seen green before the live check', '`deploy-worker.yml`', 'byte for byte as before']) {
      expect(does, piece).toContain(piece)
    }
  })

  it('names the three changes that ship with every switch off, with K\'s yes and its day', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Three changes a person can meet, each by K\'s yes of Friday, November 13, 2026 (decision 1, choice 1 (a))')).toBe(true)
    for (const piece of [
      'today\'s public `/clubs`', 'the region pills start to filter', 'can open and save that region\'s clubs on today\'s admin club page',
      'what that person sees of the club\'s members is nothing', 'An LCA admin, an observer and the club\'s own rep see exactly what they saw before.', 'No switch is added',
      '"Roster & officers (0)"', '"Club roster · 0 members"', '"No members assigned to this club yet."', '"Officers are chosen from the roster, which is empty right now."',
      '"Listed on your public club page with their name and email, so visitors know who to contact."', 'with the line under each name blank',
      'These words are shown to K in checkpoint S\'s note before the merge (see the follow-ups).',
    ]) expect(ships, piece).toContain(piece)
    // K's choice 1 (a) keeps the roster back; it does not approve the page's words for it.
    expect(ships).not.toContain('K\'s yes covers these words')
    // The page's words the block quotes are the page's own, while this step is the latest.
    if (latestStep !== 3) return
    const page = read('src/pages/AdminClubPage.tsx')
    for (const words of [
      'Roster & officers (${roster.length})', 'Club roster · {roster.length} members', 'No members assigned to this club yet.',
      'Officers are chosen from the roster, which is empty right now.', 'Listed on your public club page with their name and email, so visitors know who to contact.',
    ]) expect(page, words).toContain(words)
  })

  it('names its pins with the figures as they stand on this branch', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/unit/drizzle-baseline.test.ts`, both cases', '"all 62 migrations"', '`{ files: 62, tables: 36 }`', '`0065_club_regions.sql`', '`test/unit/db-generate-guard.test.ts`',
      '`0066` today', '`test/unit/redesign-status-ws08-step2-claims.test.ts` with `migrations/README.md`', '`test/unit/seed-fixtures.test.ts`', '"0001 to 0065"',
      '`test/unit/db-generate-real-kit.test.ts`', '11 entries, 10 on the base', 'Not moved: `test/unit/schema-drift.test.ts`, 36 tables and 343 columns',
      '`test/unit/migration-safety.test.ts`, 19 links', '`test/integration/officer-regions.test.ts`', '`test/integration/nav-personas.test.ts`',
      '`test/unit/redesign-status-ws09-step2.test.ts`, a closed check', 'No pin of WS09 step 1\'s record test moves.',
    ]) expect(pins, piece).toContain(piece)
    if (latestStep !== 3) return
    expect(read('test/unit/drizzle-baseline.test.ts')).toContain('expect(buildLocalSqlite(out)).toEqual({ files: 62, tables: 36 })')
    expect(read('test/unit/drizzle-baseline.test.ts')).toContain('expect(sql.at(-1)).toBe(\'0065_club_regions.sql\')')
    expect(read('test/unit/db-generate-guard.test.ts')).toContain('toBe(\'0066\')')
    expect(read('test/unit/db-generate-real-kit.test.ts')).toContain('expect(journal.entries).toHaveLength(11)')
    expect(read('test/unit/seed-fixtures.test.ts')).toContain('expect(files.at(-1)).toMatch(/^0065_/)')
  })

  it('gives the lint as unchanged and the build\'s names and sizes as the base\'s', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-YVdCmnd0.js` 554,147 bytes', '`index-MGRWYyBv.css` 131,136 bytes', '`features-nZCZoT6G.js` 729 bytes',
      'the same names and sizes as the base `42e232a`\'s', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes', 'on the base and on the finished tree alike',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 3: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('from 5:04 AM to 5:28 AM UTC')
  })

  it('counts as many cases for each new test as the file holds', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [...NEW_TESTS, ...NEW_INTEGRATION]) expect(writtenCount(files, file), file).toBe(casesIn(file))
    expect(writtenCount(files, 'test/unit/migration-0065-club-regions.test.ts')).toBe(9)
  })

  it('gives unit counts that add up: the base\'s, the new files\' and the changed files\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([8971, 343])
    const fresh = NEW_TESTS.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    const moved = CHANGED_UNIT.reduce((a, [, n, was]) => a + n - was, 0)
    expect(num(before) + fresh + moved).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts that add up: the base\'s, the new files\' and the cases the changed files gained', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1836, 110])
    const fresh = NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    expect(num(before) + fresh + CHANGED_INTEGRATION.reduce((a, [, n, was]) => a + n - was, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
    expect(casesIn('test/integration/club-permissions.test.ts')).toBe(23)
  })

  it('gives the lint files as the base\'s with the new files lint reads added, and the build\'s file count once on each side', () => {
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(Number(lint![2])).toBe(968)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_LINTED.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 3: the map and the lists', () => {
  it('adds one sentence to criterion 12, before the planned step, and to no other item', () => {
    const item = mapItem('Criterion 12')
    expect(item.split('Built in WS09 step 3: '), 'Criterion 12').toHaveLength(2)
    expect(item.indexOf('Built in WS09 step 3: ')).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    expect(item).toContain('by migration 0065 from the brief\'s Appendix C (D10)')
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 3:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 12'])
  })

  it('records the step\'s decisions, deviations, verify items and follow-ups, each tagged', () => {
    expect(tagged(decisions).map(head)).toEqual(['The regions are filled, and the roster stays with its keepers (WS09 step 3).'])
    expect(tagged(decisions)[0]).toContain('K\'s choice 1 (a), in K\'s decision 1 of Friday, November 13, 2026')
    expect(tagged(deviations).map(head)).toEqual(['The officers endpoint is held back too (WS09 step 3).', 'Three more tests move than the entry names (WS09 step 3).'])
    expect(tagged(verify).map(head)).toEqual([
      'A gap in the numbers (WS09 step 3).', 'Regions today (WS09 step 3).', 'Appendix C against the rows (WS09 step 3).', 'The unmatched seat (WS09 step 3).',
      'A journal entry for a custom file (WS09 step 3).', 'What a filled region opens (WS09 step 3).',
    ])
    for (const entry of tagged(verify)) {
      expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^(?:Confirmed on `42e232a`: |Confirmed in the brief's Appendix C: |Measured on `42e232a`'s tree )/)
    }
    expect(tagged(followUps).map(head)).toEqual([
      'The one read of production, owed before checkpoint S merges (WS09 step 3).', 'The Baton Rouge seat, owed before checkpoint S merges (WS09 step 3).',
      'The staging snapshot beside the mail stream\'s (WS09 step 3).', 'The persona list\'s regional seat (WS09 step 3).', 'The browser run (WS09 step 3).',
      'The admin club page\'s words for a roster kept back (WS09 step 3).',
    ])
    expect(tagged(followUps)[0]).toContain('no remote read was made here')
    expect(tagged(followUps)[5]).toContain('These words are shown to K in checkpoint S\'s note before the merge.')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 3: plain language', () => {
  const written = [block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), mapItem('Criterion 12')].join('\n')

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
