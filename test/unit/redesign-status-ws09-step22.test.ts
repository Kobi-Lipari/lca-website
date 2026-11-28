// test/unit/redesign-status-ws09-step22.test.ts
//
// REDESIGN_STATUS.md records WS09 step 22: the rest of the club page, the
// third of the plan's five steps of checkpoint W. Like WS09 step 21's record
// test, this file reads only the WS09 section, from its heading to the WS10
// heading. Pinned here: this step's block right after step 21's, and before
// the four lists while it is the latest; the Status line's tail while this
// step is the latest; the block's parts in order and its figures, which must
// agree with each other and with the files they describe; the sentences this
// step added to the map; the tagged entries of the lists and step 21's two
// follow-ups it closes; and the plain-language rules over what the step
// wrote and the files it adds. No line here reads how a switch ships.
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
const TAG = '(WS09 step 22).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 21: the club page from the top'
const STEP = '### WS09 step 22: the rest of the club page'
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
const latest = latestStep === 22 && latestBlock === STEP

const C = 'src/areas/clubs/components/'
const PAGE = `${C}ClubPage.tsx`
const EVENTS = `${C}ClubEvents.tsx`
const NEWS = `${C}ClubNews.tsx`
const NEARBY = `${C}NearbyClubs.tsx`
const FOOT = `${C}ClubFootLine.tsx`
const BAR = `${C}ClubBar.tsx`
const ROWS = 'src/areas/clubs/clubPageRows.ts'
const PLAIN = 'src/areas/clubs/clubPage.ts'
const COVER = `${C}ClubCover.tsx`
const NAV = `${C}SectionNav.tsx`
const SELF = 'test/unit/redesign-status-ws09-step22.test.ts'
const NEW_FILES = [EVENTS, NEWS, NEARBY, FOOT, BAR, ROWS]
const NEW_TESTS = [
  'test/unit/club-events.test.tsx', 'test/unit/club-page-rest.test.tsx', 'test/unit/club-page-phone.test.tsx', 'test/unit/club-page-mends.test.ts',
  'test/unit/club-page-rest-edges.test.tsx', 'test/unit/club-page-rest-words.test.tsx', SELF,
]
/**
 * The new tests that draw some of their cases from a table (`it.each`), whose
 * count cannot be read off their `it(` lines: each with its count as a full
 * run gives it, which is never less than its plain cases and its tables.
 */
const TABLE_CASES: Readonly<Record<string, number>> = {
  'test/unit/club-page-mends.test.ts': 34, 'test/unit/club-page-rest-edges.test.tsx': 17, 'test/unit/club-page-rest-words.test.tsx': 64,
}
const HELPER = 'test/unit/helpers/clubPageRest.ts'
const CHANGED = [PAGE, COVER, NAV, PLAIN]
/** The tests whose cases this step makes false, each changed in place, with its count, which does not move. */
const MOVED: ReadonlyArray<readonly [string, number]> = [
  ['test/unit/club-page-bare.test.tsx', 7], ['test/unit/club-page-full.test.tsx', 23], ['test/unit/club-page-helpers.test.ts', 64],
  ['test/unit/redesign-status-ws09-step21.test.ts', 22], ['test/unit/goldText.test.ts', 131], ['test/unit/base-components-scope.test.ts', 9],
]
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

describe('REDESIGN_STATUS.md, WS09 step 22: the block', () => {
  it('sits once, right after step 21\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest, and keeps the section\'s heading and the pull request numbers', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'checkpoint W is under way on `redesign/ws09-clubs-w`', 'WS09 steps 21 and 22, the club page from the top and the rest of the club page, are drawn only with `newClubs` and `newLook` on',
        'WS09 step 15 follows as its own pull request', 'steps 1 to 14 and 16 to 22',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens by saying where the step sits, that step 15 is still to come, and what it builds and leaves', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the third of the plan\'s five steps of checkpoint W (steps 20 to 24)', '`redesign/ws09-clubs-w`', 'WS09 step 15, the worker\'s one line, is still to come',
      '`GET /api/clubs/[id]/page`', '`clubPagesOn()`', 'No endpoint, no contract, no table, no migration and no switch is added',
      'no file under `functions/`, `domain/` or `workers/` changes', '`src/pages/ClubDetailPage.tsx`, today\'s club page, is untouched',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **Events.**', '- **News.**', '- **Nearby clubs.**', '- **The foot line and Copy link.**', '- **On a phone.**',
      '- **The two mends.**', '- **Left out.**', '- **The map (criteria 6, 15 and 16, the rest of the page).**', '- **What later steps add.**',
      '- **Differences from the boards.**', '- **The look.**', '- **Step 15.**', '- **The branch.**', '- **What the merge does.**',
      '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**',
      '- **Owed before newClubs goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(6)
  })

  it('names every file it adds and changes, each new test with its count, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...NEW_TESTS, HELPER, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...NEW_TESTS, HELPER]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    expect(files).toContain('  - Grown with no change: none.')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['No file the mail stream holds is touched', '`src/lib/features.ts`', '`src/lib/nav.ts`', 'everything under `src/components/layout/`', ...HELD.map((f) => `\`${f}\``)]) {
      expect(beyond, piece).toContain(piece)
    }
    // Today's club page is the base's file; the switches and the dock are not this step's to change.
    expect(read('src/pages/ClubDetailPage.tsx')).toContain('const textColor = clubTextColor(club.color)')
    for (const file of ['src/lib/features.ts', 'src/lib/nav.ts', 'src/components/layout/BottomDock.tsx', 'src/components/layout/dockParts.ts', 'functions/utils/clubs/pages.ts', ...HELD]) {
      expect(read(file), file).not.toMatch(/ClubEvents|ClubBar|clubPageRows|WS09 step 22/)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 22: the parts against the files', () => {
  it('draws from the one answer, Events and News only with a row, as the code holds them', () => {
    const builds = bullet(block, '- **What the step builds.**')
    for (const piece of ['asks one thing, `getClubPage`', '`events`, `news` and `nearest`', 'makes no second call', 'only when the answer names the section and carries a row', 'one status']) {
      expect(builds, piece).toContain(piece)
    }
    expect(read(PLAIN)).toMatch(/export const DRAWN_SECTIONS = \['about', 'when_and_where', 'events', 'news'(?:, 'contact')?\] as const/)
    expect(codeOf(PAGE)).toContain('drawnSections(answer.sections, { events: answer.events.length, news: answer.news.length })')
    expect(codeOf(PAGE).match(/getClubPage\(/g)).toHaveLength(1)
  })

  it('says the events, the news, the nearest clubs and the foot line as the plain code words them', () => {
    const events = bullet(block, '- **Events.**')
    for (const piece of ['`DateBlock`', '`StatusBadge`', '`/tournaments/{id}`', '"N of M spots filled"', '`registrationSummary`', 'writes no clock time']) expect(events, piece).toContain(piece)
    expect(codeOf(ROWS)).toContain('return event.registration_status === \'open\' && event.status !== \'completed\'')
    expect(codeOf(ROWS)).toContain('`${event.registered_count} of ${event.max_players} spots filled`')
    expect(bullet(block, '- **News.**')).toContain('never "Invalid Date"')
    expect(codeOf(ROWS)).toContain('return zonedParts(value) ? formatDate(value, { year: true }) : null')
    const nearby = bullet(block, '- **Nearby clubs.**')
    for (const piece of ['"Chess clubs near {city}"', '"Schedule not listed"', 'never worked out or mended', '"Clubs near you"', 'reads only `club`']) expect(nearby, piece).toContain(piece)
    expect(codeOf(NEARBY)).toContain('<Link to="/clubs"')
    const foot = bullet(block, '- **The foot line and Copy link.**')
    for (const piece of ['"{Club} · {city}, Louisiana · a club listed by the Louisiana Chess Association · {address}"', '`pageLink`', '"Link copied."', 'nothing is sent to any other site']) {
      expect(foot, piece).toContain(piece)
    }
    expect(codeOf(FOOT)).toContain('a club listed by the Louisiana Chess Association')
    expect(codeOf(COVER)).toContain('const address = pageLink(window.location.origin, slug)')
  })

  it('keeps the phone\'s row and the club bar as the code builds them, with the dock as it stands', () => {
    const phone = bullet(block, '- **On a phone.**')
    for (const piece of ['32 pixels tall for the eye inside a link 44 pixels tall', 'scrolls sideways inside itself and the page never does', 'step 21\'s three states', '`DockBar` of kind action', 'Directions stays in When and where']) {
      expect(phone, piece).toContain(piece)
    }
    const nav = codeOf(NAV)
    for (const piece of ['sticky top-[var(--header-h,0px)]', 'sticky top-[var(--header-h,4.0625rem)]', 'reflow ? \'static\'', '@max-3xl:min-h-8', 'overflow-x-auto']) expect(nav, piece).toContain(piece)
    expect(codeOf(BAR)).toContain('<DockBar kind="action">')
    expect(codeOf(BAR)).toMatch(/if \(!place\) return null|\{place && \(/)
  })

  it('names the two mends and closes step 21\'s two follow-ups', () => {
    const mends = bullet(block, '- **The two mends.**')
    for (const piece of ['`webLink`', '`URL`', '`isWebAddress`', '`oneSentence`', '"We meet at St. Example\'s hall on Tuesdays."']) expect(mends, piece).toContain(piece)
    expect(codeOf(PLAIN)).toContain('return parsed.username === \'\' && parsed.password === \'\' ? trimmed : null')
    expect(codeOf(PLAIN)).not.toMatch(/isWebAddress|from 'zod'/)
    for (const name of ['The club\'s links on the page (WS09 step 21).', 'One sentence or more (WS09 step 21).']) {
      const entry = entries(followUps).find((l) => head(l) === name) ?? ''
      expect(entry, name).toContain(' Closed in WS09 step 22: ')
    }
  })

  it('names what is left out, each with what brings it, and none of it in the page\'s files', () => {
    const left = bullet(block, '- **Left out.**')
    for (const piece of ['Follow this club', 'Add to calendar', 'partner events', 'Photos', 'Contact', 'Suggest an update', 'WS04', 'WS07', 'WS09 step 36', 'WS09 step 26', 'WS09 step 28']) {
      expect(left, piece).toContain(piece)
    }
    for (const file of [...NEW_FILES, PAGE]) expect(codeOf(file), file).not.toMatch(/Follow this club|Add to calendar|Registers on the organizer|Suggest an update/)
  })

  it('names the differences from the boards, the look, the branch, the merge, the database, a revert, what ships and what is owed', () => {
    const boards = bullet(block, '- **Differences from the boards.**')
    for (const name of ['`Club-G`', '`Club-G-2`', '`Club-Final-Bare`', '`Club-Final-Bare-2`', 'Follow button', 'Add to calendar']) expect(boards, name).toContain(name)
    expect(boards.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
    const look = bullet(block, '- **The look.**')
    for (const piece of ['a scratch copy of the tree outside the repository', 'in the copy alone', 'every seeded club and person deleted', 'at 1280, 390 and 320 pixels', 'a window 667 by 375', 'axe finds nothing', 'Every server the look started was stopped']) {
      expect(look, piece).toContain(piece)
    }
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-w`', '`0b75f5d`', 'is not cut from `main`', 'this step\'s diff is against `0b75f5d`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration, no handler, no endpoint and no contract', '105 handler files', '41 of the 145 methods', '`PENDING_COUNT` 104']) expect(does, piece).toContain(piece)
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('This step changes no table')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('leaves no row behind')
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['with `clubKeepers` unset or set', '`ClubDetailPage` with none of its lines changed', 'node for node', 'nothing calls `GET /api/clubs/[id]/page`', 'No switch is added']) {
      expect(ships, piece).toContain(piece)
    }
    const owed = bullet(block, '- **Owed before newClubs goes on.**')
    expect(owed.split('\n')[1]).toContain('that volunteers\' first names and last initials show on public club pages')
    for (const piece of ['straight-line miles', 'Follow this club and Add to calendar', '"N of M spots filled"', '"All {region} clubs"']) expect(owed, piece).toContain(piece)
    expect(bullet(block, '- **Step 15.**')).toContain('Still to come')
  })

  it('names each moved pin by its file, and the moved files keep their counts', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const [file] of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('no file changes its count of cases')
    for (const [file, count] of MOVED.slice(0, 3)) expect((read(file).match(/^\s*it\(/gm) ?? []).length + (read(file).match(/^\s*it\.each\(/gm) ?? []).length, file).toBeLessThanOrEqual(count)
    // Moved at WS09 step 28, whose two routes are the 112th and 113th: 111 before it, a later figure now.
    // Moved at WS09 step 31, whose two routes are the 116th and 117th: 115 before it.
    // Moved when the newsletter's Send joined main: its route is the 118th, 117 before it.
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(118)')
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
    if (!latest) return
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(41)
    expect(PENDING_CONTRACTS).toHaveLength(104)
  })

  it('gives the lint as the base\'s and the build\'s figures with what moved', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `0b75f5d`')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-D41OofoE.js` 559,676 bytes', '`index-Uph1B3QY.js` at 559,365', '`index-YvQuSpxy.css` 138,154 bytes', '`index-Dsp3Dd0U.css` at 137,070',
      '`features-nZCZoT6G.js` 729 bytes', '`ClubListingPage` goes from 5,935 bytes to 13,859', '`StatusBadge`', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 22: the Checks line', () => {
  it('gives each figure once, and no browser run of its own', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `0b75f5d`\'s tree')
  })

  it('gives unit counts that add up: the base\'s and the new files\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([10883, 464])
    expect(num(before) + NEW_TESTS.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts as the base\'s, the lint files as the base\'s with the new files, and the build\'s file counts', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing but the one todo/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect(integration!.slice(1)).toEqual(['2,844', '158', '2,844', '158'])
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(([\d,]+) on the base\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1205)
    expect(num(lint![1]) - num(lint![2])).toBe([...NEW_FILES, ...NEW_TESTS, HELPER].length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.slice(1)).toEqual(['214', '213'])
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 22: the map and the lists', () => {
  it('adds one sentence to each of criteria 6, 15 and 16, before the planned step, and to no other item', () => {
    for (const id of ['Criterion 6', 'Criterion 15', 'Criterion 16']) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 22: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 22: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
      expect(item.slice(item.indexOf('Built in WS09 step 22: ')), id).toContain('`test/')
    }
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 22:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 6', 'Criterion 15', 'Criterion 16'])
  })

  it('records the step\'s deviations, verify items and follow-ups, each tagged, and adds no decision', () => {
    expect(tagged(part(LISTS[0]))).toEqual([])
    expect(tagged(deviations).map(head)).toEqual([
      'The tests in files of their own (WS09 step 22).', 'The count in the events pages\' words (WS09 step 22).', 'One link after the nearest clubs (WS09 step 22).',
    ])
    expect(tagged(deviations)[1]).toContain('A choice for K at checkpoint W')
    expect(tagged(verify).map(head)).toEqual([
      'The components (WS09 step 22).', 'Follow has no base (WS09 step 22).', 'No calendar file (WS09 step 22).', 'From the clubs (WS09 step 22).',
      'Register\'s rule (WS09 step 22).', 'The Clubs page\'s address (WS09 step 22).', 'The phone boards (WS09 step 22).',
    ])
    for (const entry of tagged(verify).slice(0, 4)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `0b75f5d`/)
    expect(tagged(followUps).map(head)).toEqual(['All {region} clubs (WS09 step 22).', 'Message the club in the club bar (WS09 step 22).'])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 22: plain language', () => {
  const closings = ['The club\'s links on the page (WS09 step 21).', 'One sentence or more (WS09 step 21).'].map((name) => {
    const entry = entries(followUps).find((l) => head(l) === name) ?? ''
    return entry.slice(entry.indexOf(' Closed in WS09 step 22: '))
  })
  const written = [
    block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps), ...closings,
    ...['Criterion 6', 'Criterion 15', 'Criterion 16'].map((id) => mapItem(id).slice(mapItem(id).indexOf('Built in WS09 step 22: '))), statusLine,
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
      if (!/from '\.\/helpers\/clubPage(?:Answer|Rest)'/.test(text) && !/from '\.\/clubPageAnswer'/.test(text)) expect(text, file).toMatch(/Example [A-Z][a-z]+ Club/)
      for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
      expect(text, file).not.toMatch(/src\/lib\/features|\bfeatures\.(?:clubEmailHidden|rosterShortNames|newClubs|clubKeepers|mailLists)\b|FEATURES\.(?:clubEmailHidden|rosterShortNames|clubKeepers|mailLists)\b/)
      expect(text, file).not.toMatch(/\b(?:CLUB_EMAIL_HIDDEN|ROSTER_SHORT_NAMES|CLUB_KEEPERS_ON)\b/)
    }
  })
})
