// test/unit/redesign-status-ws09-step11.test.ts
//
// REDESIGN_STATUS.md records WS09 step 11: the My region page, the second
// step of checkpoint U. Like WS09 step 10's record test, this file reads
// only the WS09 section, from its heading to the WS10 heading. Pinned here:
// the block's place, right after WS09 step 10's block and before the four
// lists while it is the latest; the Status line's tail while this step is
// the latest; the block's parts in order and its figures, which must agree
// with each other and with the files they describe; the sentences this step
// added to criteria 1 and 12 of the map; the tagged entries of the four
// lists; and the plain-language rules over the block and the files the step
// adds or changes. What a later step will change in the tree (the lazy
// pages, the cases of a test a later step grows) is read only while this
// step is the latest.
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[A-Z]+_(?:CASES|LINE|COUNT|TEXT|AFTER)\\b(?<!PENDING_COUNT)|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
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
const TAG = '(WS09 step 11).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 10: My region\'s answer and Still accurate'
const STEP = '### WS09 step 11: the My region page'
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

const PAGE = 'src/pages/MyRegionPage.tsx'
const BAR = 'src/areas/clubs/components/ThisMonthBar.tsx'
const CARD = 'src/areas/clubs/components/RegionClubCard.tsx'
const HELP = 'src/areas/clubs/components/RegionHelp.tsx'
const REGION = 'src/areas/clubs/region.ts'
const APP = 'src/App.tsx'
const GUARD = 'src/components/auth/RoleProtectedRoute.tsx'
const DASHBOARD = 'src/pages/DashboardPage.tsx'
const API = 'src/areas/clubs/api.ts'
const FIXTURE = 'test/unit/fixtures/api-added-since-split.json'
const PAGE_TEST = 'test/unit/my-region-page.test.tsx'
const NO_DATES = 'test/unit/club-pages-no-dates.test.tsx'
const WAYS_IN = 'test/unit/my-region-ways-in.test.tsx'
const EDGES = 'test/unit/my-region-edges.test.tsx'
const GUARD_TEST = 'test/unit/my-region-guard.test.tsx'
const WORDS = 'test/unit/my-region-words.test.ts'
/** The files this step adds, and those of them that are unit tests. */
const NEW_FILES = [PAGE, BAR, CARD, HELP, REGION, PAGE_TEST, NO_DATES, WAYS_IN, EDGES, GUARD_TEST, WORDS, 'test/unit/redesign-status-ws09-step11.test.ts']
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
/** The files lint reads that this step adds. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.tsx?$/.test(f))
/** The files this step changes that are not tests. */
const CHANGED = [APP, GUARD, DASHBOARD, API, FIXTURE]
/** The tests whose one pin this step moves, beside test/unit/app-routes.test.tsx. */
const MOVED = ['test/unit/redesign-status-ws09-step10.test.ts', 'test/unit/club-editor.test.tsx', 'test/unit/api-split-modules.test.ts', 'test/unit/themeScopes.test.ts']
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
/** The cases other unit tests gained with no case of their own changed, as the Files part writes them. */
const grownOf = (files: string) => [...bullet(files, '  - Grown with no change:').matchAll(/\((\d+) cases, (\d+) on the base\)/g)].reduce((a, m) => a + Number(m[1]) - Number(m[2]), 0)

describe('REDESIGN_STATUS.md, WS09 step 11: the block and the Status line', () => {
  it('sits once, right after WS09 step 10\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latestStep === 11) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest', () => {
    expect(latestStep).toBeGreaterThanOrEqual(11)
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestStep === 11) {
      expect(tail).toBe('checkpoint S waits for its pull request; checkpoint T, steps 6 to 9, has had the review of the whole with its fixes and waits on its own branch for K\'s look at the pictures and K\'s own word; checkpoint U has begun on its own branch; steps 1 to 11, K\'s answers to checkpoint S\'s review and K\'s second answer, the Clubs page on a narrow phone, are built.')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying what the step draws, behind which switch, and what ships', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the second step of checkpoint U', 'My region at `/workspace/region`', 'behind `clubKeepers`, which stays off', 'Work-H', 'This step turns nothing on',
      'the page\'s file is never fetched', 'no call reaches `GET /api/workspace/region`', 'the Dashboard and the Workspace draw as on the base',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The way in.**', '- **The cards.**', '- **Still accurate and Confirm all.**', '- **No weekly claims.**',
      '- **The words and the look.**', '- **The map.**', '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**',
      '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 11: the parts', () => {
  it('names every file it adds and changes, each new test with its count, and the two sub-lines', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...MOVED, 'test/unit/app-routes.test.tsx', 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    expect(files).toContain('`src/App.tsx`, this stream\'s own lines alone')
    expect(files).toContain('`test/unit/fixtures/api-added-since-split.json`, this stream\'s own lines alone')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of [`\`${HELP}\``, `\`${REGION}\``, `\`${WAYS_IN}\``, `\`${EDGES}\``, `\`${GUARD_TEST}\``, `\`${WORDS}\``, 'No file the mail stream holds is touched', '`src/components/layout/Navbar.tsx`', '`src/lib/features.ts` are untouched']) {
      expect(beyond, piece).toContain(piece)
    }
    // The held files and the switches are as on the base: no line of this step in them.
    for (const file of ['src/components/layout/Navbar.tsx', 'src/pages/AdminPage.tsx', 'src/pages/AdminEmailPage.tsx', 'src/lib/features.ts']) expect(read(file), file).not.toMatch(/MyRegion|workspace\/region|WS09 step 11/)
    expect(read('src/lib/features.ts')).toContain('  clubKeepers: false,')
  })

  it('names the way in as the route and the guard hold it', () => {
    const way = bullet(block, '- **The way in.**')
    for (const piece of [
      '`<RoleProtectedRoute requireSeat>`', 'whatever their role', '`GET /api/board/my-seats`', '`category` `regional_rep`', 'a seat whose region holds no club among them',
      'a club\'s rep with no seat', 'The server decides', 'Back to My LCA', '`<Navigate to="/dashboard" replace />`', 'Open My region', `\`${PAGE_TEST}\``, `\`${WAYS_IN}\``,
    ]) expect(way, piece).toContain(piece)
    const app = read(APP)
    expect(app).toContain('const MyRegionPage = lazy(() => import(\'@/pages/MyRegionPage\').then(m => ({ default: m.MyRegionPage })))')
    expect(app).toContain('<Route path="/workspace/region" element={FEATURES.clubKeepers ? <RoleProtectedRoute requireSeat><MyRegionPage /></RoleProtectedRoute> : <Navigate to="/dashboard" replace />} />')
    const guard = codeOf(GUARD)
    expect(guard).toContain('if (requireSeat && !holdsRegionalSeat(role, member?.role, seats)) {')
    expect(guard).toContain('return seats.some((seat) => seat.category === \'regional_rep\')')
    expect(guard).toContain('if (accountRole === \'guest\') return false')
    expect(read('functions/api/board/my-seats.ts')).toContain('AND a.ended_at IS NULL\n        AND s.is_active = 1')
    const dashboard = codeOf(DASHBOARD)
    expect(dashboard).toContain('{FEATURES.clubKeepers && (\n                  <Button asChild variant="outline" className="mt-3 min-h-11 px-4">\n                    <Link to="/workspace/region">Open My region</Link>')
    expect(read(DASHBOARD)).toContain('As regional representative you can update these clubs\' pages and news.')
  })

  it('names the cards, Still accurate and Confirm all as the files hold them', () => {
    const cards = bullet(block, '- **The cards.**')
    for (const piece of ['in the server\'s order', 'navy for a club with none', '"Schedule not listed"', '`lastCheckWords`', '"Checked Nov 2026"', '"Still accurate: Example Chess Club"', '44px']) {
      expect(cards, piece).toContain(piece)
    }
    const card = codeOf(CARD)
    expect(card).toContain('aria-label={`Still accurate: ${club.name}`}')
    expect(card).toContain('aria-label={`Open: ${club.name}`}')
    expect(card).toContain('const CONTROL = \'min-h-11 px-4 whitespace-normal\'')
    expect(card).toContain('{club.lastCheckWords}')
    expect(card).toContain('const STAMP_DUE = \'border border-warn-300 bg-warn-50 text-warn-900\'')
    const still = bullet(block, '- **Still accurate and Confirm all.**')
    for (const piece of ['sends `{}`', 'keeps the card where it is', 'marked busy rather than disabled', '"Mark 2 clubs still accurate?"', 'one after another', 'There is no call for all clubs at once', 'A club is never sent twice at once', `\`${EDGES}\``]) {
      expect(still, piece).toContain(piece)
    }
    expect(codeOf(API)).toContain('body: JSON.stringify({}),')
    expect(codeOf(REGION)).toContain('return clubs.filter((club) => club.needsCheck && club.openItems.length === 0)')
    expect(codeOf(PAGE)).toContain('for (const club of list) {')
    expect(codeOf(PAGE)).toContain('if (onItsWay.current.has(club.id) || markedHere.current.has(club.id)) continue')
    expect(codeOf(PAGE)).toContain('if (onItsWay.current.has(club.id)) return \'on its way\'')
    expect(codeOf(BAR)).not.toMatch(/window\.confirm/)
  })

  it('names no weekly claims, and the words and the look, with the tint\'s two colours', () => {
    const none = bullet(block, '- **No weekly claims.**')
    for (const piece of ['no computed next meeting', 'no Tonight or Meets today', 'no count of clubs meeting', '`thisMonth.nextCheck.date`', `\`${NO_DATES}\``]) expect(none, piece).toContain(piece)
    const look = bullet(block, '- **The words and the look.**')
    for (const piece of [
      '"You\'re here as an LCA admin"', '`--warn-50`, `#fffbeb`', '`--warn-900`, `#7b3306`, 8.73 to 1', 'brand gold is never words', '`lca-my-region-help`',
      'Player One', 'Player Two', '320, 360, 390, 768 and 1280', 'no axe violation', 'two mends',
    ]) expect(look, piece).toContain(piece)
    expect(read(REGION)).toContain('export const REGION_HELP_SHOWN_KEY = \'lca-my-region-help\'')
  })

  it('names the map\'s sentences, the branch and what the merge does, with the figures while this step is the latest', () => {
    const mapPart = bullet(block, '- **The map.**')
    for (const piece of ['20 items', 'a sentence added to criterion 1 and to criterion 12', 'It proves no item in full', 'WS09 step 12', 'WS09 step 28']) expect(mapPart, piece).toContain(piece)
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-u`', '`db332ab`', 'This step\'s diff is against `db332ab`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration and no handler', '101 handler files', '33 of the 140 methods', '`PENDING_COUNT` 107', 'lazy pages are 37, 36 before', '`deploy-worker.yml` does not start']) {
      expect(does, piece).toContain(piece)
    }
    expect(Object.keys(contracts)).toEqual(expect.arrayContaining(['workspace/region', 'admin/clubs/[id]/confirm']))
    if (latestStep !== 11) return
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(33)
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 107')
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(101)')
    expect(read('test/unit/app-routes.test.tsx')).toContain('expect(pages.length).toBe(37)')
  })

  it('answers what main\'s code does on this database, what a revert leaves and what ships with every switch off', () => {
    const main = bullet(block, '- **What `main`\'s code does on this step\'s database.**')
    for (const piece of ['adds no migration', 'migrations 0065 to 0067']) expect(main, piece).toContain(piece)
    const revert = bullet(block, '- **What a revert leaves.**')
    for (const piece of ['leaves the database exactly as it found it', 'the checks Still accurate wrote stay']) expect(revert, piece).toContain(piece)
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Today\'s Dashboard and Workspace, unchanged.')).toBe(true)
    for (const piece of ['A visitor', 'a member, a seat holder and an LCA admin', 'no Open My region', 'never fetched', 'No switch is added']) expect(ships, piece).toContain(piece)
    const test = read(PAGE_TEST)
    expect(test).toContain('  it(\'sends every kind of person to the dashboard, fetches no file of the page and calls no answer\', async () => {')
    expect(read(WAYS_IN)).toContain('  it(\'with clubKeepers off, draws the block for a seat holder as the base does, with no Open My region\', async () => {')
  })

  it('names its pins, and each moved check holds', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of ['`test/unit/app-routes.test.tsx`, one assertion: 37 lazy pages in place of 36', ...MOVED.map((f) => `\`${f}\`, one assertion`), 'Not moved:']) {
      expect(pins, piece).toContain(piece)
    }
    expect(read('test/unit/redesign-status-ws09-step10.test.ts')).toContain('    if (latestStep === 10) expect(read(\'src/areas/clubs/api.ts\')).not.toMatch(/workspace\\/region|\\/confirm\\b/)')
    expect(read('test/unit/club-editor.test.tsx')).toContain('import type { AdminClubResponse, ClubConfirmResponse, ClubPlace, UpdateClubRequest, WorkspaceRegionResponse } from \\\'@domain/contracts\\\'')
    expect(read('test/unit/api-split-modules.test.ts')).toContain('\'/api/me/media-manager\', \'/api/me/payout-request\', \'/api/me/tournament-creation\', \'/api/workspace/region\',')
    expect(read('test/unit/themeScopes.test.ts')).toContain('      \'/workspace\',\n      \'/workspace/region\',\n')
    const added = JSON.parse(read(FIXTURE)) as { paths: string[]; exports: Record<string, string> }
    expect(added.paths).toEqual(expect.arrayContaining(['/api/admin/clubs/*/confirm', '/api/workspace/region']))
    expect(added.exports).toMatchObject({ confirmClubStillAccurate: 'clubs', getWorkspaceRegion: 'clubs' })
    // The step 10 record test keeps its 25 cases.
    expect(casesIn(MOVED[0])).toBe(25)
  })

  it('gives the lint as unchanged and the build\'s figures as measured', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '555,748 bytes, 555,001 on the base, 747 more', '`index-DfETpAtB.css` 134,117 bytes, 133,867 on the base, 250 more',
      '`features-nZCZoT6G.js` 729 bytes, as on the base', '202 files, 201 on the base', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 11: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `db332ab`\'s tree')
  })

  it('counts as many cases for each new test as the file holds', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of NEW_TESTS) if (latestStep === 11 || file !== NO_DATES) expect(writtenCount(files, file), file).toBe(casesIn(file))
  })

  it('gives unit counts that add up: the base\'s, the new files\' and the cases other tests gained', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([9688, 395])
    const fresh = NEW_TESTS.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    expect(num(before) + fresh + grownOf(files)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts as the base\'s, since no integration test changes', () => {
    expect(checksLine).toContain('integration 2,404 in 134 files (2,404 in 134 on the base), every one passing')
  })

  it('gives the lint files as the base\'s with the new files lint reads added, and the build\'s file count once on each side', () => {
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1072)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_LINTED.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, 201 on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    expect(bullet(block, '- **Build.**')).toContain(`${built?.[1]} files, 201 on the base`)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 11: the map and the lists', () => {
  it('adds one sentence to criterion 1 and one to criterion 12, each before the planned step, and to no other item', () => {
    for (const [id, planned] of [['Criterion 1', 33], ['Criterion 12', 11]] as const) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 11: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 11: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
      expect(item.endsWith(`Planned: WS09 step ${planned}.`), id).toBe(true)
    }
    expect(mapItem('Criterion 12').indexOf('Built in WS09 step 10: ')).toBeLessThan(mapItem('Criterion 12').indexOf('Built in WS09 step 11: '))
    expect(mapItem('Criterion 1').indexOf('Built in WS09 step 8: ')).toBeLessThan(mapItem('Criterion 1').indexOf('Built in WS09 step 11: '))
    expect(mapItem('Criterion 1')).toContain(`\`${NO_DATES}\``)
    expect(mapItem('Criterion 12')).toContain(`\`${PAGE_TEST}\``)
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 11:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 1', 'Criterion 12'])
  })

  it('records the step\'s decisions, deviations, verify items and follow-ups, each tagged', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'Confirm all, one club after another (WS09 step 11).', 'My region\'s own Help (WS09 step 11).', 'One question, in the site\'s dialog parts (WS09 step 11).',
    ])
    expect(tagged(deviations).map(head)).toEqual([
      'The bar without reports and events in review (WS09 step 11).', 'Schedule not listed, with no Suggest an update (WS09 step 11).', 'Open goes to Your club\'s page (WS09 step 11).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      '`/workspace` today (WS09 step 11).', 'The seats in the sign-in (WS09 step 11).', 'The board\'s bar (WS09 step 11).', 'No phone frame (WS09 step 11).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed (?:on `db332ab`|against)/)
    expect(tagged(followUps).map(head)).toEqual([
      'Help on the monthly check\'s email (WS09 step 11).', 'A way in for every seat holder (WS09 step 11).', 'Open moves with WS09 step 12 (WS09 step 11).',
      'A reload of My region before the seats arrive (WS09 step 11).',
    ])
    // The guard's known window on a reload is written both as a judgement call and as a follow-up, each pointing at WS01's.
    expect(bullet(block, '- **Judgement calls.**')).toContain('WS01\'s follow-up "Admin link opened directly"')
    expect(bullet(block, '- **Still accurate and Confirm all.**')).toContain('The server\'s order comes back on the next visit through the Dashboard')
    expect(block).not.toContain('The next load brings the server\'s order')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 11: plain language', () => {
  const written = [
    block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps),
    mapItem('Criterion 1').slice(mapItem('Criterion 1').indexOf('Built in WS09 step 11: ')),
    mapItem('Criterion 12').slice(mapItem('Criterion 12').indexOf('Built in WS09 step 11: ')), statusLine,
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
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds or changes', () => {
    // The Dashboard, App.tsx, the clubs area's client and two of the tests held long dashes before this step; their own lines are read alone.
    const own = [
      between(read(DASHBOARD), '{/* With clubKeepers on, the way into My region (WS09 step 11). */}', '<ul '),
      read(APP).split('\n').filter((l) => /MyRegion|workspace\/region/.test(l)).join('\n'),
      between(read(API), '/**\n * My region\'s answer', 'export async function adminCreateClub'),
      read('test/unit/club-editor.test.tsx').split('\n').filter((l) => l.includes('WorkspaceRegionResponse')).join('\n'),
      read('test/unit/themeScopes.test.ts').split('\n').filter((l) => l.includes('/workspace/region')).join('\n'),
    ]
    for (const text of own) {
      expect(text).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text).not.toMatch(rule)
    }
    const whole = [...NEW_FILES, GUARD, FIXTURE, 'test/unit/redesign-status-ws09-step10.test.ts', 'test/unit/api-split-modules.test.ts', 'test/unit/app-routes.test.tsx']
    for (const file of whole) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })

  it('writes the page\'s own words plainly: no long dash, no old initials, and the made-up names of the tests', () => {
    for (const file of [PAGE, BAR, CARD, HELP, REGION]) {
      const text = read(file)
      expect(text, file).not.toMatch(/\b(?:Tonight|calendar)\b/)
      for (const found of text.matchAll(/'[^'\n]*\b\d{1,2}:\d{2}[^'\n]*'/g)) expect(found[0], file).toMatch(/\b(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)\b/)
    }
    for (const file of [PAGE_TEST, NO_DATES, WAYS_IN, EDGES, GUARD_TEST, WORDS]) expect(read(file), file).not.toMatch(/@(?!example\.org|testing-library|\/|domain|vitest)[a-z]/)
  })
})
