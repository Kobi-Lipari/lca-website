// test/unit/redesign-status-ws09-step20.test.ts
//
// REDESIGN_STATUS.md records WS09 step 20: the club page's answer, the first
// of the plan's five steps of checkpoint W. Like WS09 step 19's record test,
// this file reads only the WS09 section, from its heading to the WS10
// heading. Pinned here: this step's block right after checkpoint V's review,
// and before the four lists while it is the latest; the Status line's tail
// while this step is the latest; the block's parts in order and its figures,
// which must agree with each other and with the files they describe; the
// sentences this step added to the map; the tagged entries of the lists; and
// the plain-language rules over what the step wrote and the files it adds.
// No line here reads how a switch ships.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
import { RESERVED_SLUGS } from '../../domain/clubs/slug'
import { PENDING_CONTRACTS } from './contracts-pending'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|[${String.fromCharCode(0x27e6, 0x27e7)}]|\\b[A-Z]+[0-9]*_[A-Z_0-9]+\\b(?!\`)`)
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
const TAG = '(WS09 step 20).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 checkpoint V: the review of the whole and its fixes'
const STEP = '### WS09 step 20: the club page\'s answer'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''
const latest = latestStep === 20 && latestBlock === STEP

const HANDLER = 'functions/api/clubs/[id]/page.ts'
const AUTHOR = 'functions/utils/clubs/authorLine.ts'
const NEAREST = 'functions/utils/clubs/nearest.ts'
const SECTIONS = 'domain/clubs/sections.ts'
const DISTANCE = 'domain/clubs/distance.ts'
const CONTRACT = 'domain/contracts/clubPage.ts'
const PAGE_TEST = 'test/integration/club-page.test.ts'
const CONTRACT_TEST = 'test/integration/contracts/club-page.test.ts'
const SELF = 'test/unit/redesign-status-ws09-step20.test.ts'
const NEW_FILES = [HANDLER, SECTIONS, DISTANCE, AUTHOR, NEAREST, CONTRACT]
const NEW_TESTS = [
  'test/unit/club-sections.test.ts', 'test/unit/club-distance.test.ts', 'test/unit/club-page-lines.test.ts', PAGE_TEST, CONTRACT_TEST,
  'test/integration/club-page-edges.test.ts', 'test/unit/club-page-contract.test.ts', 'test/unit/club-page-call.test.ts', 'test/unit/club-page-reserved-names.test.ts', SELF,
]
const NEW_UNIT = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
const NEW_INTEGRATION = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
/** The unit tests that grow, with their counts and the base's: two by the tree alone, and the listing rule by its list. */
const GROWN_UNIT: ReadonlyArray<readonly [string, number, number]> = [
  ['test/unit/domain-boundaries.test.ts', 59, 56], ['test/unit/route-audit.test.ts', 95, 94], ['test/unit/listing-rule.test.ts', 20, 18],
]
const CHANGED = [
  'domain/contracts/registry.ts', 'domain/contracts/index.ts', 'src/areas/clubs/api.ts', 'test/unit/fixtures/api-added-since-split.json', 'test/unit/listing-rule.test.ts',
  'test/unit/routes.test.ts',
]
const MOVED = ['test/unit/routes.test.ts', 'test/unit/api-split-modules.test.ts', 'test/unit/redesign-status-ws09-step19.test.ts', 'test/unit/club-routing-server-only.test.ts']
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** A file's cases: every plain `it(` line; none of this step's files uses `it.each`. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, file).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('REDESIGN_STATUS.md, WS09 step 20: the block', () => {
  it('sits once, right after checkpoint V\'s review, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    // Written straight after checkpoint V's review; with main taken in it stands after main's blocks of Thursday's changes, the aside on how they reached main last.
    // Once the question marks' words are on main too, that aside's block stands between them and this one.
    expect([PREVIOUS, '### WS09 aside: how Thursday\'s changes reached main', '### WS09 aside: the question marks\' words']).toContain(headings[headings.indexOf(STEP) - 1])
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest, and keeps the section\'s heading', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'checkpoint W is under way on `redesign/ws09-clubs-w`', 'WS09 step 20, the club page\'s answer', 'answers 404 to everyone while both are unset',
        'WS09 step 15 follows as its own pull request', 'steps 1 to 14 and 16 to 20',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying where the step sits, that step 15 is still to come, and what it builds and leaves', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the first of the plan\'s five steps of checkpoint W (steps 20 to 24)', '`redesign/ws09-clubs-w`', 'WS09 step 15, the worker\'s one line, is still to come',
      '`GET /api/clubs/[id]/page`', '`CLUB_PAGES_ON`', '`CLUB_KEEPERS_ON`', 'no table, no migration and no switch is added', 'are untouched',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **Who may read.**', '- **Finding a club.**', '- **The sections.**', '- **Never on a club page.**',
      '- **The author line.**', '- **The told line.**', '- **Places.**', '- **Events.**', '- **News.**', '- **The nearest clubs.**', '- **The headers.**',
      '- **The contract and the call.**', '- **The map (criteria 6, 8 and 16).**', '- **Step 15.**', '- **The branch.**', '- **What the merge does.**',
      '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**',
      '- **Owed before newClubs goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(6)
  })

  it('names every file it adds and changes, each new test with its count, the grown tests with theirs, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...NEW_TESTS, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...NEW_TESTS]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    for (const [file, now, was] of GROWN_UNIT) expect(files, file).toContain(`\`${file}\` (${now}, ${was} on the base: `)
    expect(files).toContain('  - Grown with no change:')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['No file the mail stream holds is touched', '`src/App.tsx`', '`src/lib/features.ts`', '`test/unit/contracts-pending.ts`', ...HELD.map((f) => `\`${f}\``)]) {
      expect(beyond, piece).toContain(piece)
    }
    for (const file of [...HELD, 'src/App.tsx', 'src/lib/features.ts', 'test/unit/contracts-pending.ts', 'functions/utils/clubs/publicAnswer.ts', 'functions/utils/events/publicAnswer.ts']) {
      expect(read(file), file).not.toMatch(/clubPage(?!sOn\b)|getClubPage|authorLine|nearestClubs|clubPageSections/)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 20: the parts against the files', () => {
  it('says who may read in each state of the two constants, as the handler reads them', () => {
    const who = bullet(block, '- **Who may read.**')
    for (const piece of [
      'Both unset, as this step ships', 'not one query', '`{"error":"Club not found"}`', '`CLUB_KEEPERS_ON` alone', '`requireClubRep`', 'another region\'s representative',
      'answers 401 to a visitor and 403 to a person it turns away', '`isResponse`', 'the one 404', '`CLUB_PAGES_ON`: the page to everyone',
    ]) expect(who, piece).toContain(piece)
    const code = codeOf(HANDLER)
    expect(code).toContain('  const pagesOn = CLUB_PAGES_ON\n  const keepersOn = CLUB_KEEPERS_ON\n')
    expect(code).toContain('  if (!pagesOn && !keepersOn) return notFound(headers)\n\n  const raw =')
    expect(code).toContain('    const authed = await requireClubRep(context.request, context.env, club.id)\n    if (isResponse(authed)) return notFound(headers)\n')
    expect(code).toContain('export const CLUB_PAGE_NOT_FOUND = \'Club not found\'')
    expect(read('functions/api/clubs/[id].ts')).toContain('return errorResponse(\'Club not found\', 404)')
  })

  it('gives the lookup\'s order, the collisions held and the fixed names a slug may not take', () => {
    const finding = bullet(block, '- **Finding a club.**')
    for (const piece of [
      'a current slug, then an old slug from `club_slug_history`, then a club\'s id', 'finds the slug\'s club', 'finds the current one', 'upper case, stray spaces and an encoded space',
      '`confirm`', '`logo` and `page`', '`RESERVED_SLUGS` already holds all three', 'no stored slug changes', '`clubNamedBy`',
    ]) expect(finding, piece).toContain(piece)
    for (const word of ['confirm', 'logo', 'page']) expect(RESERVED_SLUGS, word).toContain(word)
    // WS09 step 23 moved the order into functions/utils/clubs/pageAnswer.ts, which the handler and the new route both call.
    const code = codeOf('functions/utils/clubs/pageAnswer.ts')
    const order = ['FROM clubs WHERE slug = ?', 'FROM club_slug_history WHERE old_slug = ?', 'FROM clubs WHERE id = ?'].map((sql) => code.indexOf(sql))
    for (const at of order) expect(at).toBeGreaterThan(-1)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(existsSync(join(ROOT, 'functions/api/clubs/confirm/[token].ts'))).toBe(true)
  })

  it('names what the answer never carries and the three author lines as the code words them', () => {
    const never = bullet(block, '- **Never on a club page.**')
    for (const piece of ['never a spread of a row', 'no `contact_email` or any other email address', 'no officer, no roster, no member\'s id, no count of members', 'no `told_by` or `confirmed_by`', 'With `CLUB_EMAIL_HIDDEN` unset or set']) {
      expect(never, piece).toContain(piece)
    }
    // WS09 step 23 moved the answer's reads into functions/utils/clubs/pageAnswer.ts: the ban reads the handler and the shared file.
    for (const file of [HANDLER, 'functions/utils/clubs/pageAnswer.ts']) expect(codeOf(file), file).not.toMatch(/\.\.\.club\b|\.\.\.row\b|contact_email|club_officers|CLUB_EMAIL_HIDDEN/)
    const author = bullet(block, '- **The author line.**')
    for (const piece of [
      '"Kept by the club\'s rep, {first name and last initial}"', '"This club hasn\'t named a rep yet · Kept by {name}, the {region} representative"',
      '"Kept by LCA admins until the {region} seat is filled"', 'line 2095', '`firstNameLastInitial`', '`guardian_id`', '`registrations.grade`', 'is never named', '"Kept by the club\'s rep"',
    ]) expect(author, piece).toContain(piece)
    // Checkpoint W (K's decision 12) took the author line off the page and out of the answer: the file builds none of it now.
    const words = read(AUTHOR)
    expect(codeOf(AUTHOR)).not.toContain('m.guardian_id IS NOT NULL')
    for (const piece of ['`Kept by the club\'s rep, ${name}`', '`This club hasn\'t named a rep yet · Kept by ${keeper}`', '`Kept by LCA admins until the ${place} seat is filled`']) {
      expect(words, piece).not.toContain(piece)
    }
  })

  it('names the told line, the places, the events through listedWhere, the news and the nearest clubs as the files hold them', () => {
    const told = bullet(block, '- **The told line.**')
    for (const piece of ['"As told by the club, updated {month}"', '"As told to LCA, {month}"', '`monthInWords`', 'A representative\'s save reads "As told to LCA"', 'line 2098']) {
      expect(told, piece).toContain(piece)
    }
    // Checkpoint W (K's decision 12) worded the told line "Last checked" and its month.
    expect(read(AUTHOR)).toContain('`Last checked ${month}`')
    expect(bullet(block, '- **Places.**')).toContain('`name`, `street`, `note`, `latitude` and `longitude`')
    expect(codeOf('functions/utils/clubs/pageAnswer.ts')).toContain('SELECT name, street, note, latitude, longitude FROM club_places WHERE club_id = ? ORDER BY sort, id LIMIT 2')
    const events = bullet(block, '- **Events.**')
    for (const piece of ['`${listedWhere(\'t\')}`', '`LISTED`', '`registered_count`', '`GET /api/clearinghouse`', 'lines 390 to 405']) expect(events, piece).toContain(piece)
    expect(read('test/unit/listing-rule.test.ts')).toContain('\'functions/utils/clubs/pageAnswer.ts\']')
    expect(codeOf('functions/utils/clubs/pageAnswer.ts')).toContain('WHERE t.club_id = ? AND ${listedWhere(\'t\')}')
    expect(bullet(block, '- **News.**')).toContain('`club_news` has no draft or published column')
    const nearest = bullet(block, '- **The nearest clubs.**')
    for (const piece of ['`milesBetween`', '"about N mi"', '"less than 1 mi"', 'Ties go by name and then id']) expect(nearest, piece).toContain(piece)
    expect(read(DISTANCE)).toContain('export const UNDER_A_MILE = \'less than 1 mi\'')
    expect(read(NEAREST)).toContain('export const NEAREST_COUNT = 3')
  })

  it('gives the headers in each state and the contract and the call as the tree holds them', () => {
    const headers = bullet(block, '- **The headers.**')
    for (const piece of ['no instruction to a cache', '`Cache-Control: no-store`', 'the 404s among them', 'exactly today\'s public headers']) expect(headers, piece).toContain(piece)
    expect(codeOf(HANDLER)).toContain('const NOT_PUBLIC_HEADERS = { \'Cache-Control\': \'no-store\' } as const')
    expect(Object.keys(contracts['clubs/[id]/page'])).toEqual(['GET'])
    expect(PENDING_CONTRACTS.filter((line) => line.endsWith(' clubs/[id]/page'))).toEqual([])
    expect(read(CONTRACT)).toContain('export const clubPageResponseSchema = z.strictObject({')
    expect(read(CONTRACT_TEST)).toContain('contracts[\'clubs/[id]/page\'].GET')
    expect(read('src/areas/clubs/api.ts')).toContain('export async function getClubPage(address: string): Promise<ClubPageResponse> {')
    const fixture = JSON.parse(read('test/unit/fixtures/api-added-since-split.json')) as { paths: string[]; exports: Record<string, string> }
    expect(fixture.paths).toContain('/api/clubs/*/page')
    expect(fixture.exports.getClubPage).toBe('clubs')
  })

  it('names the branch, what the merge does, the database, a revert, what ships with every switch off and what is owed', () => {
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-w`', '`redesign/ws09-clubs-v`', '`5d96486`', 'checkpoint V is not on `main` yet', 'this step\'s diff is against `5d96486`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration and one handler file', '105 handler files', '41 of the 145 methods', '`PENDING_COUNT` 104', '`deploy-worker.yml`']) expect(does, piece).toContain(piece)
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('This step changes no table')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('leaves no row behind')
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['answers 404 to everyone before anything is read', 'with no query made', 'the counting database', 'byte for byte', 'No switch is added']) expect(ships, piece).toContain(piece)
    const owed = bullet(block, '- **Owed before newClubs goes on.**')
    expect(owed.split('\n')[1]).toContain('that volunteers\' first names and last initials show on public club pages')
    expect(bullet(block, '- **Step 15.**')).toContain('Still to come')
  })

  it('names its pins with their figures, and the moved checks hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('105 handler files, 145 methods under `functions/api`, 41 contracted and `PENDING_COUNT` 104')
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(110)')
    expect(read('test/unit/api-split-modules.test.ts')).toContain('\'/api/admin/tournaments/*/approval\', \'/api/clubs/*/page\', \'/api/clubs/confirm/*\',')
    // Checkpoint W (K's decision 12) took the author line off the page, so routing.ts's readers no longer hold authorLine.ts.
    expect(read('test/unit/club-routing-server-only.test.ts')).toContain('expect(all).not.toContain(\'functions/utils/clubs/authorLine.ts\')')
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
    if (!latest) return
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(41)
    expect(PENDING_CONTRACTS).toHaveLength(104)
  })

  it('gives the lint as unchanged and the build\'s figures', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', '`index-Blmdhdb_.js` 558,793 bytes', '`index-B9z7qSj6.css` 134,857 bytes', '`features-nZCZoT6G.js` 729 bytes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(build, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 20: the Checks line', () => {
  it('gives each figure once, and no browser run of its own', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `5d96486`\'s tree')
  })

  it('gives unit counts that add up: the base\'s, the new files\' and the grown ones\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([10534, 447])
    const grown = GROWN_UNIT.reduce((n, [, now, was]) => n + now - was, 0)
    expect(num(before) + NEW_UNIT.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + grown).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts as the base\'s with the new files', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing but the one todo/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect(Number(beforeFiles)).toBe(155)
    expect(num(before) + NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the lint files as the base\'s with the new files, and the build\'s file counts', () => {
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1169)
    expect(num(lint![1]) - num(lint![2])).toBe([...NEW_FILES, ...NEW_TESTS].length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.slice(1)).toEqual(['210', '210'])
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 20: the map and the lists', () => {
  it('adds one sentence to each of criteria 6, 8 and 16, before the planned step, and to no other item', () => {
    for (const id of ['Criterion 6', 'Criterion 8', 'Criterion 16']) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 20: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 20: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
      expect(item.slice(item.indexOf('Built in WS09 step 20: ')), id).toContain('`test/')
    }
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 20:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 6', 'Criterion 8', 'Criterion 16'])
  })

  it('records the step\'s deviations, verify items and follow-ups, each tagged, and adds no decision', () => {
    expect(tagged(part(LISTS[0]))).toEqual([])
    expect(tagged(deviations).map(head)).toEqual(['Straight-line miles on the club page (WS09 step 20).', 'No Photos section yet (WS09 step 20).'])
    expect(tagged(verify).map(head)).toEqual([
      'listedWhere today (WS09 step 20).', 'Two names for one address part (WS09 step 20).', 'A partner event (WS09 step 20).', 'The representative\'s name (WS09 step 20).',
    ])
    for (const entry of tagged(verify).slice(0, 3)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `5d96486`/)
    expect(tagged(followUps).map(head)).toEqual(['A child the site cannot tell (WS09 step 20).', 'The told line reads the saver\'s role as it is now (WS09 step 20).'])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 20: plain language', () => {
  const written = [
    block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps),
    ...['Criterion 6', 'Criterion 8', 'Criterion 16'].map((id) => mapItem(id).slice(mapItem(id).indexOf('Built in WS09 step 20: '))), statusLine,
  ].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the step wrote, and dates and times in their plain form', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS]) expect(written).not.toMatch(rule)
    const prose = proseOf(written)
    expect(prose).not.toMatch(UNFILLED)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const found of prose.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b(?!:)/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds', () => {
    for (const file of [...NEW_FILES, ...NEW_TESTS]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })

  it('writes the tests\' people, clubs and places plainly made up, reading no setting from the environment and no switch\'s shipped value', () => {
    for (const file of [PAGE_TEST, CONTRACT_TEST]) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      expect(text, file).toMatch(/Example [A-Z][a-z]+ Club/)
      for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
      expect(text, file).not.toMatch(/src\/lib\/features|toBe\(false\)\s*\/\/\s*shipped/)
    }
    for (const file of NEW_TESTS) expect(read(file), file).not.toMatch(/\bfeatures\.(?:clubEmailHidden|rosterShortNames|newClubs|clubKeepers)\b/)
  })
})
