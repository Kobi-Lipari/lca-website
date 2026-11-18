// test/unit/redesign-status-ws09-step10.test.ts
//
// REDESIGN_STATUS.md records WS09 step 10: My region's answer and Still
// accurate, the first step of checkpoint U. Like WS09 step 9's record test,
// this file reads only the WS09 section, from its heading to the WS10
// heading. Pinned here: the block's place, right after the block for the
// Clubs page fix brought into checkpoint T and before the four lists; the
// Status line's tail while this step is the latest; the block's parts in
// order and its figures, which must agree with each other and with the
// files they describe; the sentence this step added to criterion 12 of the
// map; the tagged entries of the four lists; and the plain-language rules
// over the block and the files the step adds or changes. What a later step
// will change in the tree (the handler count, the contracted count, the
// cases of a test a later step grows) is read only while this step is the
// latest.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[A-Z]+_(?:CASES|LINE|COUNT|TEXT)\\b(?<!PENDING_COUNT)|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
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
const TAG = '(WS09 step 10).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const FIX = '### WS09 checkpoint T: the Clubs page fix brought in'
const STEP = '### WS09 step 10: My region\'s answer and Still accurate'
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

const REGION = 'functions/api/workspace/region.ts'
const CONFIRM = 'functions/api/admin/clubs/[id]/confirm.ts'
const CARDS = 'domain/clubs/regionCards.ts'
const CHECK = 'domain/clubs/monthlyCheck.ts'
const CONTRACTS = 'domain/contracts/clubs.ts'
const REGISTRY = 'domain/contracts/registry.ts'
const ROUTES = 'test/unit/routes.test.ts'
const INTEGRATION = 'test/integration/workspace-region.test.ts'
const CONTRACT_TEST = 'test/integration/contracts/workspace-region.test.ts'
/** The files this step adds, those of them that are unit tests, and those that are integration tests. */
const NEW_FILES = [
  REGION, CONFIRM, CARDS, CHECK, INTEGRATION, CONTRACT_TEST, 'test/unit/region-card-sort.test.ts', 'test/unit/monthly-check-date.test.ts',
  'test/unit/monthly-check-edges.test.ts', 'test/unit/region-card-edges.test.ts', 'test/integration/workspace-region-edges.test.ts',
  'test/unit/redesign-status-ws09-step10.test.ts',
]
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new files lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.tsx?$/.test(f))
/** The files this step changes that are not tests. */
const CHANGED = [CONTRACTS, REGISTRY]
/** The unit tests this step changes, each with its count and the count before. */
const CHANGED_UNIT: ReadonlyArray<readonly [string, number, number]> = [[ROUTES, 15, 15]]
/** The cases a unit test gained with no case of its own changed: one for each new file under domain/, in test/unit/domain-boundaries.test.ts. */
const GROWN = 2
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out, line comments and block comments alike. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** The body of an exported handler, to the next export or the end of the file. */
const handlerOf = (file: string, name: string) => between(codeOf(file), `export const ${name}`, '\nexport ')

describe('REDESIGN_STATUS.md, WS09 step 10: the block and the Status line', () => {
  it('sits once, right after the block for the Clubs page fix brought into checkpoint T, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
    expect(headings[headings.indexOf(FIX) + 1]).toBe(STEP)
    if (latestStep === 10) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest', () => {
    expect(latestStep).toBeGreaterThanOrEqual(10)
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestStep === 10) {
      expect(tail).toBe('checkpoint S waits for its pull request; checkpoint T, steps 6 to 9, has had the review of the whole with its fixes and waits on its own branch for K\'s look at the pictures and K\'s own word; checkpoint U has begun on its own branch; steps 1 to 10, K\'s answers to checkpoint S\'s review and K\'s second answer, the Clubs page on a narrow phone, are built.')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying what the step builds, behind which constant, and what ships', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the first step of checkpoint U', 'draws no page', '`GET /api/workspace/region`', '`POST /api/admin/clubs/[id]/confirm`', '`CLUB_KEEPERS_ON` is set, which stays unset',
      'This step turns nothing on', '403 in words before any query', 'WS09 step 11',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **Who sees what.**', '- **Still accurate.**', '- **The order.**', '- **The date.**', '- **The words a page shows.**',
      '- **The map.**', '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**',
      '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 10: the parts', () => {
  it('names every file it adds and changes, each test with its count, and the two sub-lines', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT.map(([f]) => f), 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of [...NEW_TESTS, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const [name, after, before] of CHANGED_UNIT) {
      expect(files, name).toContain(after === before ? `\`${name}\` (${after}, as before: ` : `\`${name}\` (${after}, ${before} before: `)
    }
    expect(files).toContain('this stream\'s own lines alone')
    const grown = bullet(files, '  - Grown with no change:')
    for (const piece of ['`test/unit/contract-coverage.test.ts`', '`test/unit/contracts-status.test.ts`', '`PENDING_COUNT` 107', 'no page calls either endpoint yet']) expect(grown, piece).toContain(piece)
    expect(grown).toContain(`\`test/unit/domain-boundaries.test.ts\` (${52 + GROWN} cases, 52 on the base)`)
    expect(read('test/unit/domain-boundaries.test.ts')).toContain('  it.each(filesUnder(DOMAIN).map((f) => [relative(ROOT, f).split(\'\\\\\').join(\'/\'), f]))(\'%s\', (name, file) => {')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['none', '`domain/contracts/index.ts` is untouched', '`functions/utils/clubs/emails.ts`', '`functions/api/board/my-seats.ts`', '`src/areas/clubs/api.ts`', 'no file the mail stream holds is touched']) {
      expect(beyond, piece).toContain(piece)
    }
    expect(read('domain/contracts/index.ts')).not.toContain('region')
    if (latestStep === 10) expect(read('src/areas/clubs/api.ts')).not.toMatch(/workspace\/region|\/confirm\b/)
  })

  it('names who sees what as the read holds it: the seat, the regions, the refusals and the count of events', () => {
    const who = bullet(block, '- **Who sees what.**')
    for (const piece of [
      'whatever their role', '`getRegionalClubIds`', 'a region an LCA admin adds to the seat', 'An LCA admin gets every club', 'A guest is refused whatever seat they hold',
      'a child account', 'a holder whose term has ended', 'a holder whose seat is inactive', 'a person signed out gets 401', 'Observers follow WS09 step 3\'s rule',
      'never an address', '`is_visible = 1` in the query itself', 'the count never tells that one exists', '`test/integration/workspace-region.test.ts`',
    ]) expect(who, piece).toContain(piece)
    expect(who).toContain(`"${'My region is for the holders of a regional representative\'s seat and the LCA admins.'}"`)
    const get = handlerOf(REGION, 'onRequestGet')
    expect(get.indexOf('if (!CLUB_KEEPERS_ON) return errorResponse(REGION_CLOSED, 403)')).toBeGreaterThan(-1)
    expect(get.indexOf('if (!CLUB_KEEPERS_ON)')).toBeLessThan(get.indexOf('requireAuthedMember('))
    expect(get).toContain('if (member.role === \'guest\') return errorResponse(REGION_FOR_SEATS, 403)')
    expect(get).toContain('if (!isAdmin && seats.length === 0) return errorResponse(REGION_FOR_SEATS, 403)')
    expect(get).toContain('ids.filter((id) => !admittedByRegionAlone(member, id))')
    const code = codeOf(REGION)
    expect(code).toContain('const ids = await getRegionalClubIds(db, member.id)')
    expect(code).toContain('AND (is_visible = 1 OR club_id IN (SELECT value FROM json_each(?2)))')
    expect(code).not.toMatch(/email|club_officers|roster|uscf/i)
    expect(read(REGION)).toContain('export const REGION_FOR_SEATS = \'My region is for the holders of a regional representative\\\'s seat and the LCA admins.\'')
  })

  it('names Still accurate as the endpoint holds it: who, that club alone, no stale refusal, no activity row and no email', () => {
    const still = bullet(block, '- **Still accurate.**')
    for (const piece of [
      '`requireClubRep`', 'an observer who holds the region\'s seat confirms as its holder', '`{"error":"Forbidden"}`', 'byte for byte, so no answer tells whether a club exists',
      '"Club not found"', '`parseBody`', 'passes through and is ignored', '`WHERE id = ?`', 'every other club\'s row is byte for byte as before',
      'It moves neither `told_updated_at` nor `told_by`', 'is not refused as stale by it', 'through the real PATCH with the constant set', 'A second confirm by the same person',
      'It writes no activity row', 'WS09 step 6\'s rule', 'It sends no email',
    ]) expect(still, piece).toContain(piece)
    const post = handlerOf(CONFIRM, 'onRequestPost')
    expect(post.indexOf('if (!CLUB_KEEPERS_ON) return errorResponse(CONFIRM_CLOSED, 403)')).toBeGreaterThan(-1)
    expect(post.indexOf('if (!CLUB_KEEPERS_ON)')).toBeLessThan(post.indexOf('requireClubRep('))
    expect(post.indexOf('requireClubRep(')).toBeLessThan(post.indexOf('parseBody(context.request, clubConfirmRequestSchema)'))
    // Since WS09 step 14 the one write lives in functions/utils/clubs/stillAccurate.ts, shared with the monthly check's link.
    expect(post).toContain('await markStillAccurate(context.env.DB, clubId, authResult.member.id)')
    expect(read('functions/utils/clubs/stillAccurate.ts')).toContain('`UPDATE clubs SET last_confirmed_at = datetime(\'now\'), confirmed_by = ?\n      WHERE id = ?\n      RETURNING last_confirmed_at`')
    expect(codeOf(CONFIRM)).not.toMatch(/told_updated_at|told_by|admin_audit_log|recordAdminAction|sendEmail|trySendEmail|waitUntil/)
    expect(read(INTEGRATION)).toContain('  it(\'leaves a form another keeper has open able to save: a confirm never makes the PATCH refuse it as stale\', async () => {')
  })

  it('names the order as the code holds it, and the never checked club of the migrations', () => {
    const order = bullet(block, '- **The order.**')
    for (const piece of [
      '`sortRegionCards`', 'need a check first, then those with open items, then A to Z', 'names that differ only in case or accents keep a stable order', 'more than 90 days old',
      'a check of exactly 90 days still counting', '`last_confirmed_at`', 'migration 0067 stamps `told_updated_at` on every club', 'checkpoint T\'s P1', '"Not checked yet"',
      'held on the 25 clubs the migrations seed', 'WS09 steps 19 and 28', '`test/unit/region-card-sort.test.ts`',
    ]) expect(order, piece).toContain(piece)
    const cards = codeOf(CARDS)
    expect(cards).toContain('Number(b.needsCheck) - Number(a.needsCheck)\n    || Number(b.openItems.length > 0) - Number(a.openItems.length > 0)\n    || byCodeUnits(plainName(a.name), plainName(b.name))')
    expect(cards).toContain('return nowMs - at > CHECK_WINDOW_DAYS * DAY_MS')
    expect(cards).toContain('export const CHECK_WINDOW_DAYS = 90')
    expect(read(INTEGRATION)).toContain('  it(\'reads a club nobody has saved or confirmed as never checked, on the 25 clubs the migrations seed, and sorts it as needing a check\', async () => {')
  })

  it('names the date as the code holds it: pure, the time an argument, Central time in summer and winter', () => {
    const date = bullet(block, '- **The date.**')
    for (const piece of [
      '`isCheckDue(now)`', 'from 8:00 AM to the last minute of that day', 'Mon, Dec 7, 2026', 'Mon, Jul 5, 2027', 'not at 7:59 AM', 'the second Monday', 'Sun, Mar 14 and Sun, Nov 7',
      '`nextCheckDate(now)`', 'December turning to January', '`zonedParts`', 'a switch turned on later in a month sends nothing by itself until the next first Monday',
      '`test/unit/monthly-check-date.test.ts`',
    ]) expect(date, piece).toContain(piece)
    const check = codeOf(CHECK)
    expect(check.match(/^import .*$/gm)).toEqual([
      'import { formatDate, zonedParts, type DateInput } from \'../format/date\'',
      'import { formatTime } from \'../format/clock\'',
    ])
    expect(check).toContain('return at.day === firstMondayOf(at.year, at.month) && at.hour >= CHECK_HOUR')
    expect(check).toContain('if (at.day < thisMonth || (at.day === thisMonth && at.hour < CHECK_HOUR)) {')
    for (const file of [CHECK, CARDS]) expect(codeOf(file), file).not.toMatch(/Date\.now\(|new Date\(\)|\.prepare\(|from '(?!\.)/)
  })

  it('names the helpers that write the words a page shows, as the answer uses them', () => {
    const words = bullet(block, '- **The words a page shows.**')
    for (const piece of [
      '`checkWords`', '`checkMonthWords`', '`nextCheckWords`', '"Checked Sep 2026"', '"Not checked since Jun 2026"', '"Mon, Dec 7, 2026"', '"8:00 AM"', '`stored: \'utc\'`',
      'WS09 step 11', 'Central time', '`checkCounts`',
    ]) expect(words, piece).toContain(piece)
    const code = codeOf(REGION)
    expect(code).toContain('lastCheckWords: checkWords(row.last_confirmed_at, now),')
    expect(code).toContain('thisMonth: { nextCheck: nextCheckWords(now), ...checkCounts(cards) },')
    expect(codeOf(CONFIRM)).toContain('lastCheckWords: checkWords(row.last_confirmed_at, Date.now()),')
  })

  it('names the map\'s sentence, the branch and what the merge does, with the figures while this step is the latest', () => {
    const mapPart = bullet(block, '- **The map.**')
    for (const piece of ['20 items', 'a sentence added to criterion 12', 'It proves no item in full', 'WS09 step 11', 'WS09 step 28']) expect(mapPart, piece).toContain(piece)
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-u`', '`redesign/ws09-clubs-t`', '`bc13162`', 'This step\'s diff is against `bc13162`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of [
      'No migration and two handlers', '101 handler files', '33 of the 140 methods under `functions/api` contracted, 31 of 138 before', '`PENDING_COUNT` 107', '36 lazy pages',
      '`deploy-worker.yml` starts',
    ]) expect(does, piece).toContain(piece)
    expect(read('.github/workflows/deploy-worker.yml')).toContain('      - \'domain/**\'')
    expect(Object.keys(contracts)).toEqual(expect.arrayContaining(['workspace/region', 'admin/clubs/[id]/confirm']))
    expect(Object.keys(contracts['workspace/region'])).toEqual(['GET'])
    expect(Object.keys(contracts['admin/clubs/[id]/confirm'])).toEqual(['POST'])
    expect(read('test/unit/contracts-pending.ts')).not.toMatch(/workspace\/region|admin\/clubs\/\[id\]\/confirm/)
    if (latestStep !== 10) return
    const methods = Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)
    expect(methods).toBe(33)
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 107')
    expect(read(ROUTES)).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(101)')
    expect(read('test/unit/app-routes.test.tsx')).toContain('expect(pages.length).toBe(36)')
  })

  it('answers what main\'s code does on this database and what a revert leaves', () => {
    const main = bullet(block, '- **What `main`\'s code does on this step\'s database.**')
    for (const piece of ['adds no migration', 'migrations 0065 to 0067', 'two columns of migration 0066', 'answer 403 before any query']) expect(main, piece).toContain(piece)
    const revert = bullet(block, '- **What a revert leaves.**')
    for (const piece of ['leaves the database exactly as it found it', 'the checks Still accurate wrote stay']) expect(revert, piece).toContain(piece)
  })

  it('says what ships with every switch off, and the switch and its constant stay off', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Two endpoints that answer 403')).toBe(true)
    for (const piece of [
      '"My region is not open yet."', '"Still accurate cannot be used yet."', 'an LCA admin and a person signed out included', 'a database that fails at the first statement',
      '"all 403 with the constant unset"', 'Nothing else in the site answers differently', 'No switch is added',
    ]) expect(ships, piece).toContain(piece)
    expect(read(REGION)).toContain('export const REGION_CLOSED = \'My region is not open yet.\'')
    expect(read(CONFIRM)).toContain('export const CONFIRM_CLOSED = \'Still accurate cannot be used yet.\'')
    // clubKeepers and CLUB_KEEPERS_ON went on together in the block "WS09 switch-on: clubKeepers and CLUB_KEEPERS_ON", so this step holds only that each is declared.
    expect(read('src/lib/features.ts')).toMatch(/^ {2}clubKeepers: (?:false|true),$/m)
    expect(read('functions/utils/clubs/pages.ts')).toMatch(/^export const CLUB_KEEPERS_ON = (?:false|true)$/m)
    expect(read(INTEGRATION)).toContain('  it(\'all 403 with the constant unset: both endpoints answer every kind of person 403 in words, an LCA admin included, before any query or sign in\', async () => {')
  })

  it('names its pins, and the moved check holds', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of ['`test/unit/routes.test.ts`, one assertion and its case\'s name', '101 handler files in place of 99', 'The contract lists', 'Not moved:']) expect(pins, piece).toContain(piece)
    const routes = read(ROUTES)
    if (latestStep === 10) expect(routes).toContain('  it(\'finds the 101 handler files under api plus the page routes\', () => {')
    expect(routes).toContain('functions/api/admin/clubs/[id]/confirm.ts, Still accurate, and functions/api/workspace/region.ts, My region\'s answer, two new routes, are the 100th and 101st since WS09 step 10.')
  })

  it('gives the lint as unchanged and the build\'s figures as the base\'s', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-CqsuFlw_.js` 555,001 bytes', '`index-Bi8fz2Bp.css` 133,867 bytes', '`features-nZCZoT6G.js` 729 bytes', 'no file under `src/` changes',
      '201 files, as on the base', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 10: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `bc13162`\'s tree')
  })

  it('counts as many cases for each new test and each changed test as the file holds, while this step is the latest', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [...NEW_TESTS, ...NEW_INTEGRATION]) if (latestStep <= 18 || file !== INTEGRATION) expect(writtenCount(files, file), file).toBe(casesIn(file))
    if (latestStep !== 10) return
    for (const [file, n] of CHANGED_UNIT) expect(casesIn(file), file).toBe(n)
  })

  it('gives unit counts that add up: the base\'s, the new files\' and the cases the domain boundary gained', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([9622, 390])
    const fresh = NEW_TESTS.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    const moved = CHANGED_UNIT.reduce((a, [, n, was]) => a + n - was, 0)
    expect(num(before) + fresh + GROWN + moved).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts as the base\'s with the cases of the two new files', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2371, 131])
    const fresh = NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    expect([num(after), Number(afterFiles)]).toEqual([2371 + fresh, 131 + NEW_INTEGRATION.length])
  })

  it('gives the lint files as the base\'s with the new files lint reads added, and the build\'s file count once on each side', () => {
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1060)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_LINTED.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, 201 on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    expect(bullet(block, '- **Build.**')).toContain(`${built?.[1]} files, as on the base`)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 10: the map and the lists', () => {
  it('adds one sentence to criterion 12, after the sentences of WS09 steps 3 and 4 and before the planned step, and to no other item', () => {
    const item = mapItem('Criterion 12')
    expect(item.split('Built in WS09 step 10: ')).toHaveLength(2)
    expect(item.indexOf('Built in WS09 step 4: ')).toBeLessThan(item.indexOf('Built in WS09 step 10: '))
    expect(item.indexOf('Built in WS09 step 10: ')).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    expect(item.endsWith('Planned: WS09 step 11.')).toBe(true)
    for (const piece of ['`GET /api/workspace/region`', '`POST /api/admin/clubs/[id]/confirm`', '`CLUB_KEEPERS_ON`', '`last_confirmed_at` and `confirmed_by` for that club alone']) {
      expect(item.slice(item.indexOf('Built in WS09 step 10: ')), piece).toContain(piece)
    }
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 10:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 12'])
  })

  it('records the step\'s decisions, deviations, verify items and follow-ups, each tagged', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'Still accurate writes no activity row (WS09 step 10).', 'The seat decides in My region (WS09 step 10).', 'The next check from 8:00 AM on the first Monday (WS09 step 10).',
    ])
    expect(tagged(deviations).map(head)).toEqual([
      'No to-do rows, rep requests or events list yet (WS09 step 10).', 'An LCA admin is told a missing club is not found (WS09 step 10).',
      'A seat with no club still opens My region (WS09 step 10).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'The seat read (WS09 step 10).', 'No weekday in `zonedParts` (WS09 step 10).', 'A database built from the migrations has no regional seat (WS09 step 10).',
      'The two columns of the check (WS09 step 10).', 'Who `requireClubRep` admits (WS09 step 10).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `bc13162`/)
    expect(tagged(followUps).map(head)).toEqual([
      'My region\'s page draws these words (WS09 step 10).', 'Items T10 and P9 stay with K (WS09 step 10).', 'The monthly check\'s run (WS09 step 10).',
    ])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 10: plain language', () => {
  const written = [
    block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps),
    mapItem('Criterion 12').slice(mapItem('Criterion 12').indexOf('Built in WS09 step 10: ')), statusLine,
  ].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the step wrote, and dates and times in their plain form', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    expect(written).not.toMatch(/\.github\//)
    const prose = proseOf(written)
    expect(prose).not.toMatch(HE)
    expect(written).not.toMatch(/\(step \d+[;),]/)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const found of prose.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b(?!:)/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    expect(written).not.toMatch(/\bUS Chess Federation\b/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds or changes', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT.map(([f]) => f)]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })

  it('writes the words the answer carries plainly: a weekday on every full date and a time as 8:00 AM', () => {
    const test = read('test/unit/monthly-check-date.test.ts')
    expect(test).toContain('{ day: \'2026-12-07\', date: \'Mon, Dec 7, 2026\', time: \'8:00 AM\' }')
    for (const found of test.matchAll(/date: '([^']+)'/g)) expect(found[1]).toMatch(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2} \d{1,2}, \d{4}$/)
    // A quoted time in the files the answer's words come from is written as 8:00 AM; regionCards.ts quotes a stored stamp, which is not a time a page shows.
    for (const file of [CHECK, REGION, CONFIRM]) {
      for (const found of read(file).matchAll(/"[^"\n]*\b\d{1,2}:\d{2}[^"\n]*"/g)) expect(found[0], file).toMatch(/\b(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)\b/)
    }
  })
})
