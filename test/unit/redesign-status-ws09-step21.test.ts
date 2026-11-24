// test/unit/redesign-status-ws09-step21.test.ts
//
// REDESIGN_STATUS.md records WS09 step 21: the club page from the top, the
// second of the plan's five steps of checkpoint W. Like WS09 step 20's record
// test, this file reads only the WS09 section, from its heading to the WS10
// heading. Pinned here: this step's block right after step 20's, and before
// the four lists while it is the latest; the Status line's tail while this
// step is the latest; the block's parts in order and its figures, which must
// agree with each other and with the files they describe; the sentences this
// step added to the map; the tagged entries of the lists; and the
// plain-language rules over what the step wrote and the files it adds. No
// line here reads how a switch ships.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
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
const TAG = '(WS09 step 21).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 20: the club page\'s answer'
const STEP = '### WS09 step 21: the club page from the top'
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
const latest = latestStep === 21 && latestBlock === STEP

const C = 'src/areas/clubs/components/'
const PAGE = `${C}ClubPage.tsx`
const COVER = `${C}ClubCover.tsx`
const PREVIEW = `${C}PagePreview.tsx`
const PLAIN = 'src/areas/clubs/clubPage.ts'
const ROUTE_PAGE = 'src/pages/ClubListingPage.tsx'
const MAP = `${C}LCAMap.tsx`
const SELF = 'test/unit/redesign-status-ws09-step21.test.ts'
const NEW_FILES = [PAGE, COVER, `${C}AuthorLine.tsx`, `${C}SectionNav.tsx`, `${C}ClubAbout.tsx`, `${C}WhenAndWhere.tsx`, PREVIEW, PLAIN, ROUTE_PAGE]
const NEW_TESTS = [
  'test/unit/club-page-bare.test.tsx', 'test/unit/club-page-full.test.tsx', 'test/unit/club-page-off.test.tsx', 'test/unit/club-editor-page-preview.test.tsx',
  'test/unit/club-map-places.test.tsx', 'test/unit/club-page-helpers.test.ts', 'test/unit/club-page-edges.test.tsx',
  'test/unit/club-map-places-edges.test.tsx', 'test/unit/club-page-words.test.tsx', SELF,
]
/**
 * The new tests that draw some of their cases from a table (`it.each`), whose
 * count cannot be read off their `it(` lines: each with its count as a full
 * run gives it, which is never less than its plain cases and its tables.
 */
const TABLE_CASES: Readonly<Record<string, number>> = {
  'test/unit/club-page-helpers.test.ts': 64, 'test/unit/club-page-edges.test.tsx': 41, 'test/unit/club-page-words.test.tsx': 84,
}
const HELPER = 'test/unit/helpers/clubPageAnswer.ts'
/** The unit tests that grow, with their counts and the base's: three by a change, one by the tree alone. */
const GROWN_UNIT: ReadonlyArray<readonly [string, number, number]> = [
  ['test/unit/club-pages-no-dates.test.tsx', 9, 7], ['test/unit/nav.test.ts', 67, 66], ['test/unit/app-routes.test.tsx', 43, 42],
  ['test/unit/semantic-map.test.ts', 227, 225],
]
const CHANGED = [
  'src/App.tsx', MAP, 'src/areas/clubs/clubMap.ts', `${C}ClubEditor.tsx`, 'src/areas/clubs/previews.ts', 'test/unit/club-pages-no-dates.test.tsx',
  'test/unit/nav.test.ts', 'test/unit/app-routes.test.tsx',
]
const MOVED = ['test/unit/app-routes.test.tsx', 'test/unit/redesign-status-ws09-step20.test.ts']
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** A file's cases: every plain `it(` line, or, for a file with tables, its count from TABLE_CASES, never below its plain cases and its tables. */
function casesIn(file: string): number {
  const text = read(file)
  const tables = (text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length
  const plain = (text.match(/^\s*it\(/gm) ?? []).length
  if (!(file in TABLE_CASES)) {
    expect(tables, file).toBe(0)
    return plain
  }
  expect(tables, file).toBeGreaterThan(0)
  expect(TABLE_CASES[file], file).toBeGreaterThanOrEqual(plain + tables)
  return TABLE_CASES[file]
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('REDESIGN_STATUS.md, WS09 step 21: the block', () => {
  it('sits once, right after step 20\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest, and keeps the section\'s heading', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'checkpoint W is under way on `redesign/ws09-clubs-w`', 'WS09 step 21, the club page from the top, is drawn only with `newClubs` and `newLook` on',
        'WS09 step 15 follows as its own pull request', 'steps 1 to 14 and 16 to 21',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    // The pull request numbers stand as they were.
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens by saying where the step sits, that step 15 is still to come, and what it builds and leaves', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the second of the plan\'s five steps of checkpoint W (steps 20 to 24)', '`redesign/ws09-clubs-w`', 'WS09 step 15, the worker\'s one line, is still to come',
      '`GET /api/clubs/[id]/page`', '`clubPagesOn()`', 'No endpoint, no table, no migration and no switch is added', '`src/pages/ClubDetailPage.tsx`, today\'s club page, is untouched',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The bare page.**', '- **The keeper\'s line.**', '- **The address.**', '- **No weekly claims, no colour words.**',
      '- **The club map.**', '- **The editor\'s preview column.**', '- **The map (criteria 1, 6 and 15, the page\'s top).**', '- **What later steps add.**',
      '- **Differences from the boards.**', '- **The look.**', '- **Step 15.**', '- **The branch.**', '- **What the merge does.**',
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
    for (const name of [...NEW_FILES, ...NEW_TESTS, HELPER, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...NEW_TESTS, HELPER]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    for (const [file, now, was] of GROWN_UNIT) expect(files, file).toContain(`\`${file}\` (${now}, ${was} on the base: `)
    expect(files).toContain('  - Grown with no change:')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['No file the mail stream holds is touched', '`src/lib/features.ts`', '`functions/utils/clubs/pages.ts`', ...HELD.map((f) => `\`${f}\``)]) {
      expect(beyond, piece).toContain(piece)
    }
    // Today's club page is the base's file; the switches and the server's constants are not this step's to change.
    expect(read('src/pages/ClubDetailPage.tsx')).toContain('const textColor = clubTextColor(club.color)')
    for (const file of ['src/lib/features.ts', 'functions/utils/clubs/pages.ts', 'functions/utils/clubs/publicAnswer.ts', ...HELD]) {
      expect(read(file), file).not.toMatch(/ClubListingPage|PagePreview|keeperFor|WS09 step 21/)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 21: the parts against the files', () => {
  it('says what the page draws from the one answer, its states and its two buttons, as the code holds them', () => {
    const builds = bullet(block, '- **What the step builds.**')
    for (const piece of [
      'asks one thing, `getClubPage`', '`club.color`', 'never built or mended on the page', '"Loading the club…"', 'today\'s "Club not found"', '"Back to clubs"',
      '"This club\'s page did not load"', 'Try again', 'About and When and where', 'leads to `/contact`', 'share sheet', '"Link copied."', 'nothing is sent to any other site',
    ]) expect(builds, piece).toContain(piece)
    const page = codeOf(PAGE)
    expect(page).toContain('getClubPage(address)')
    expect(page).toContain('loading: \'Loading the club…\'')
    expect(page).toContain('err instanceof ApiError && err.status === 404 ? \'not-found\' : \'error\'')
    expect(read(PLAIN)).toMatch(/export const DRAWN_SECTIONS = \['about', 'when_and_where', 'events', 'news'(?:, 'contact')?\] as const/)
    expect(codeOf(COVER)).toMatch(/<Link to="\/contact"|<a href=\{`#\$\{SECTION_IDS\.contact\}`\}/)
    expect(codeOf(COVER)).not.toMatch(/fetch\(|sendBeacon|XMLHttpRequest/)
  })

  it('gives the bare page, the keeper\'s line and the address as the plain code words them', () => {
    const bare = bullet(block, '- **The bare page.**')
    for (const piece of ['"Chess club in {city}, Louisiana · {region}"', 'no bracket, no "not listed", no empty box, no Suggest an update', 'the line ends at Louisiana', '"Chess club in Louisiana"', 'never on the club\'s colour']) {
      expect(bare, piece).toContain(piece)
    }
    // WS09 step 23 moved the line's words into domain/clubs/pageWords.ts, which the page and the server's page both read.
    expect(read('domain/clubs/pageWords.ts')).toContain('return area ? `${place} · ${area}` : place')
    const keeper = bullet(block, '- **The keeper\'s line.**')
    for (const piece of ['`keeperFor`', '"This is your club\'s page · Edit"', '"You can edit this page as the {region} representative · Edit"', '`/my/club/{slug}`', '`/workspace/region/clubs/{id}`', 'only while `clubKeepers` is on', 'no new endpoint and no new key']) {
      expect(keeper, piece).toContain(piece)
    }
    expect(codeOf(PAGE)).toContain('const keeper = keepersOn() ? keeperFor(answer.club, { role, member, managedClubs }) : null')
    expect(read(PLAIN)).toContain('return { kind: \'region\', region: managed.region ?? club.region, edit: `/workspace/region/clubs/${encodeURIComponent(club.id)}` }')
    const address = bullet(block, '- **The address.**')
    for (const piece of ['by a replace and never a new history entry', 'the same query and hash', 'stays where it is', '19 of the seeded clubs']) expect(address, piece).toContain(piece)
    expect(codeOf(PAGE)).toContain('if (slug && slug !== address) navigate(pageAddress(slug, location.search, location.hash), { replace: true })')
  })

  it('makes no weekly claim and never makes a club\'s colour words, as the page\'s files hold', () => {
    const claims = bullet(block, '- **No weekly claims, no colour words.**')
    for (const piece of ['no Tonight and no "Checked" month', 'quoted as the club\'s own words', '`clubTextColor`, `clubTextOnDark`', 'gold is nowhere in it', '44 pixels tall', '`CLEAR_OF_BARS`']) {
      expect(claims, piece).toContain(piece)
    }
    for (const file of NEW_FILES) {
      const code = codeOf(file)
      expect(code, file).not.toMatch(/clubTextColor|clubTextOnDark|clubColors|gold/i)
      expect(code, file).not.toMatch(/new Date\(|Date\.now\(|Tonight|Checked /)
    }
  })

  it('gives the club map\'s three props, the effects as they are read now, and the one directions link', () => {
    const club = bullet(block, '- **The club map.**')
    for (const piece of ['`places`, `directions` and `quietWithoutKey`', '`placePoints`', 'run in a scratch copy, on the base\'s map file alike', '`useEffectEvent`', 'no effect runs more often', '`directionsUrl`']) {
      expect(club, piece).toContain(piece)
    }
    const code = read(MAP)
    expect(code).not.toContain('eslint-disable')
    expect(code.match(/useEffectEvent\(/g)).toHaveLength(3)
    for (const deps of ['[loaded]', '[loaded, clubsKey, frame]', '[loaded, selectedId, clubsKey]', '[loaded, userLat, userLng, isAll]']) expect(code, deps).toContain(`}, ${deps})`)
    expect(read('src/areas/clubs/clubMap.ts')).toContain('export function placePoints(')
  })

  it('draws the page\'s preview in the editor only with clubPagesOn(), and names the deviation', () => {
    const column = bullet(block, '- **The editor\'s preview column.**')
    for (const piece of ['only while `clubPagesOn()` holds', 'node for node, with `clubKeepers` unset or set', '`clubPageSections`', 'a deviation from the entry']) expect(column, piece).toContain(piece)
    const editor = codeOf(`${C}ClubEditor.tsx`)
    expect(editor).toContain('{clubPagesOn() && (\n            <PagePreview')
    expect(editor.indexOf('<PagePreview')).toBeLessThan(editor.indexOf('<SearchPreview'))
  })

  it('names what later steps add and the differences from the boards, each with the side that wins', () => {
    const later = bullet(block, '- **What later steps add.**')
    for (const piece of ['Events and News (WS09 step 22)', 'Contact with its form (WS09 step 26', 'Photos and the photo cover (WS09 step 36)', 'Suggest an update in the author line and beside Contact (WS09 step 28)', '(WS09 step 31)']) {
      expect(later, piece).toContain(piece)
    }
    const boards = bullet(block, '- **Differences from the boards.**')
    for (const name of ['`Club-Final-Bare`', '`Club-Final-Bare-2`', '`Club-G`']) expect(boards, name).toContain(name)
    expect(boards.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })

  it('names the look, the branch, what the merge does, the database, a revert, what ships with every switch off and what is owed', () => {
    const look = bullet(block, '- **The look.**')
    for (const piece of ['a scratch copy of the tree outside the repository', 'in the copy alone', 'every seeded club and person deleted', 'at 390 and 1280 pixels', 'the bare club at 320', 'axe finds nothing', 'Every server the look started was stopped']) {
      expect(look, piece).toContain(piece)
    }
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-w`', '`45d86bd`', 'is not cut from `main`', 'this step\'s diff is against `45d86bd`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration, no handler and no endpoint', '105 handler files', '41 of the 145 methods', '`PENDING_COUNT` 104']) expect(does, piece).toContain(piece)
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('This step changes no table')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('leaves no row behind')
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['with `clubKeepers` unset or set', '`ClubDetailPage` with none of its lines changed', '`/clubs/suggest` has no route', 'node for node', 'nothing calls `GET /api/clubs/[id]/page`', 'No switch is added']) {
      expect(ships, piece).toContain(piece)
    }
    const owed = bullet(block, '- **Owed before newClubs goes on.**')
    expect(owed.split('\n')[1]).toContain('that volunteers\' first names and last initials show on public club pages')
    expect(owed).toContain('the page\'s preview in the editor')
    expect(bullet(block, '- **Step 15.**')).toContain('Still to come')
  })

  it('names its pins with their figures, and the moved checks hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    // Moved at WS09 step 27, whose page is the 42nd: 40 at this step, a later figure now.
    expect(read('test/unit/app-routes.test.tsx')).toContain('expect(pages.length).toBe(42)')
    expect(read('test/unit/redesign-status-ws09-step20.test.ts')).toContain('/clubPage(?!sOn\\b)|getClubPage|authorLine|nearestClubs|clubPageSections/')
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(111)')
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
    if (!latest) return
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(41)
    expect(PENDING_CONTRACTS).toHaveLength(104)
  })

  it('gives the lint as one warning fewer and the build\'s figures with what moved', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, against 13 and 12 on the base `45d86bd`')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-Uph1B3QY.js` 559,365 bytes', '`index-Blmdhdb_.js` at 558,793', '`index-Dsp3Dd0U.css` 137,070 bytes', '`index-B9z7qSj6.css` at 134,857',
      '`features-nZCZoT6G.js` 729 bytes', '`ClubListingPage` at 5,935 bytes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 21: the Checks line', () => {
  it('gives each figure once, and no browser run of its own', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `45d86bd`\'s tree')
  })

  it('gives unit counts that add up: the base\'s, the new files\' and the grown ones\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([10608, 454])
    const grown = GROWN_UNIT.reduce((n, [, now, was]) => n + now - was, 0)
    expect(num(before) + NEW_TESTS.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + grown).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts as the base\'s, the lint files as the base\'s with the new files, and the build\'s file counts', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing but the one todo/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect(integration!.slice(1)).toEqual(['2,844', '158', '2,844', '158'])
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(([\d,]+) on the base\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1185)
    expect(num(lint![1]) - num(lint![2])).toBe([...NEW_FILES, ...NEW_TESTS, HELPER].length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.slice(1)).toEqual(['213', '210'])
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 21: the map and the lists', () => {
  it('adds one sentence to each of criteria 1, 6 and 15, before the planned step, and to no other item', () => {
    for (const id of ['Criterion 1', 'Criterion 6', 'Criterion 15']) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 21: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 21: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
      expect(item.slice(item.indexOf('Built in WS09 step 21: ')), id).toContain('`test/')
    }
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 21:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 1', 'Criterion 6', 'Criterion 15'])
  })

  it('records the step\'s deviations, verify items and follow-ups, each tagged, and adds no decision', () => {
    expect(tagged(part(LISTS[0]))).toEqual([])
    expect(tagged(deviations).map(head)).toEqual([
      'The page\'s preview waits with the public pages (WS09 step 21).', 'The choice of page made in the route (WS09 step 21).',
      'Plain pins on the club page\'s map (WS09 step 21).', 'The name off the club\'s colour (WS09 step 21).',
    ])
    expect(tagged(deviations)[0]).toContain('A choice for K at checkpoint W')
    expect(tagged(verify).map(head)).toEqual([
      'The suggest route (WS09 step 21).', 'Gold ink without the new look (WS09 step 21).', 'The bare board (WS09 step 21).', 'The map\'s warnings (WS09 step 21).',
      'The decided board for a fuller club (WS09 step 21).', 'Directions for a place (WS09 step 21).',
    ])
    for (const entry of tagged(verify).slice(0, 2)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `45d86bd`/)
    expect(tagged(followUps).map(head)).toEqual([
      'The cover\'s Contact the club (WS09 step 21).', 'The interim Suggest a club (WS09 step 21).', 'The map with no key (WS09 step 21).',
      'The club\'s links on the page (WS09 step 21).', 'One sentence or more (WS09 step 21).',
    ])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 21: plain language', () => {
  const written = [
    block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps),
    ...['Criterion 1', 'Criterion 6', 'Criterion 15'].map((id) => mapItem(id).slice(mapItem(id).indexOf('Built in WS09 step 21: '))), statusLine,
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
    for (const file of [...NEW_FILES, ...NEW_TESTS, HELPER]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })

  it('writes the tests\' people, clubs and places plainly made up, reading no setting from the environment and no switch\'s shipped value', () => {
    for (const file of [...NEW_TESTS.filter((f) => f !== SELF), HELPER]) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      // A test that draws its clubs from the shared made-up answers names none of its own.
      if (!text.includes('from \'./helpers/clubPageAnswer\'')) expect(text, file).toMatch(/Example [A-Z][a-z]+ Club/)
      for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
      expect(text, file).not.toMatch(/src\/lib\/features|\bfeatures\.(?:clubEmailHidden|rosterShortNames|newClubs|clubKeepers|mailLists)\b|FEATURES\.(?:clubEmailHidden|rosterShortNames|clubKeepers|mailLists)\b/)
      expect(text, file).not.toMatch(/\b(?:CLUB_EMAIL_HIDDEN|ROSTER_SHORT_NAMES|CLUB_KEEPERS_ON)\b/)
    }
  })
})
