// test/unit/redesign-status-ws09-step38.test.ts
//
// REDESIGN_STATUS.md records WS09's thirty-eighth step, the browser matrix
// and the switch-on notes, the last step built of checkpoint Z, and
// checkpoint Z's own section. Like the other record tests of WS09, this file
// reads only the WS09 section, from its heading to the WS10 heading. Pinned
// here: the step's block right after step 37's and the checkpoint's section
// right after it, before the four lists; the Status and PR lines' clauses;
// the block's parts in order and its own figures, which must agree with the
// files they describe; the rehearsal's three lists; K's note for newClubs
// and what K is asked, in the section; the moved pins against their file;
// the Checks line in the forms the close reads; the sentences this step
// added to the map; the tagged entries of the four lists; and the
// plain-language rules over what the step wrote and the files it adds. It
// counts no file of the whole tree, holds no line of another file by its
// number, and no line here reads how a switch ships.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, in the plural as well, and the two words that name a person's role in the work. */
const BANNED = new RegExp(`\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow'].join('|')})s?\\b|${'the ' + 'lead'}`, 'i')
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored', 'assis' + 'tant'].join('|')})\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|${'%' + '[A-Z]'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|${'CHECKS' + '_LINE'}|<<|>>`)
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
/** A sub-bullet and the lines indented deeper under it. */
function sub(text: string, start: string): string {
  const all = text.split('\n')
  const at = all.findIndex((l) => l.startsWith(start))
  if (at < 0) return ''
  const depth = start.length - start.trimStart().length
  let end = at + 1
  while (end < all.length && all[end].length - all[end].trimStart().length > depth) end++
  return all.slice(at, end).join('\n')
}
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))
const head = (entry: string) => entry.slice(4, entry.indexOf('**', 4))
const TAG = '(WS09 step 38).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 37: players are not tied to clubs'
const STEP = '### WS09 step 38: the browser matrix and the switch-on notes'
const SECTION = '### Checkpoint Z: WS09 steps 37 and 38, the close'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const zone = part(SECTION)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))
/** Step 38 is the latest while it is the last step's block and only checkpoint Z's own section stands between it and the four lists. */
const latest = latestStep === 38 && headings[headings.indexOf(LISTS[0]) - 1] === SECTION && headings[headings.indexOf(LISTS[0]) - 2] === STEP
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''

const SELF = 'test/unit/redesign-status-ws09-step38.test.ts'
/** Each new test with the count of cases its run gives. */
const NEW_TESTS: Record<string, number> = {
  'test/a11y/clubs-matrix.spec.ts': 13,
  'test/unit/club-pages-no-dates-more.test.tsx': 3,
  'test/unit/workspace-club-tile-width.test.tsx': 2,
  'test/unit/ws09-map-names-real-tests.test.ts': 23,
}
/** The new tests whose loops write fewer `test(` and `it(` lines than their runs give cases, with their written counts. */
const WRITTEN: Record<string, number> = { 'test/a11y/clubs-matrix.spec.ts': 1, 'test/unit/ws09-map-names-real-tests.test.ts': 3 }
const MOVED = 'test/unit/redesign-status-ws09-step37.test.ts'
const MOVED_TOO = 'test/unit/redesign-status-ws09-y-review.test.ts'
/** The closed records of steps 16 to 28, each with one assertion moved. */
const MOVED_CLOSED = Array.from({ length: 13 }, (_, i) => `test/unit/redesign-status-ws09-step${i + 16}.test.ts`)
/** The sentence that ends each decision the close records for an earlier step or checkpoint. */
const CLOSE = ' Recorded at the close, in WS09 step 38.'
/** Files this step leaves alone, which no line of it may name. */
const UNTOUCHED = [
  'src/lib/features.ts', 'functions/utils/clubs/pages.ts', 'test/a11y/global-setup.ts', 'playwright.config.ts', 'test/a11y/scopes.spec.ts', 'test/a11y/scopes-edges.spec.ts',
  'test/a11y/clubs-reflow.spec.ts', 'test/a11y/clubs-directory.spec.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts', 'test/unit/club-pages-no-dates.test.tsx',
  'test/unit/club-pages-switch.test.ts', 'test/unit/club-switches.test.ts', 'test/unit/club-switches-exhaustive.test.ts', 'src/App.tsx', 'src/lib/nav.ts',
  'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'functions/utils/admin/campaigns.ts', 'functions/utils/email.ts', 'test/integration/harness.ts',
]
const OURS = /WS09 step 38|clubs-matrix|club-pages-no-dates-more|workspace-club-tile-width|ws09-map-names-real-tests/
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,)]`).exec(files)?.[1])
/** A file's cases as written: every `it(` and `test(` line. */
function casesIn(file: string): number {
  return (read(file).match(/^\s*(?:it|test)\(/gm) ?? []).length
}

describe('REDESIGN_STATUS.md, the thirty-eighth step of WS09: the block and the section', () => {
  it('sits once, right after step 37\'s block, with checkpoint Z\'s section after it and the four lists after that', () => {
    expect(block).not.toBe('')
    expect(zone).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(ws09.split(`\n${SECTION}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    expect(headings[headings.indexOf(STEP) + 1]).toBe(SECTION)
    if (latest) expect(headings[headings.indexOf(SECTION) + 1]).toBe(LISTS[0]) // guarded by WS09 checkpoint Z's review, whose block follows the section
  })

  it('gives the Status and PR lines what the step makes true: checkpoint Z built and waiting, step 38 among the built', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    expect(statusLine).toContain('and checkpoint Z, WS09 steps 37 and 38, is built on `redesign/ws09-clubs-z`, cut from checkpoint Y\'s head, `c930b20`, and reviewed there, holds checkpoints Y, X and W and `main` at `85f20ec`, and waits for its own draft pull request, to be opened once its review\'s fixes are in, and K\'s word, merging after 159: WS09 step 37, players are not tied to clubs, takes') // moved by WS09 checkpoint Z's review: the checkpoint is reviewed
    expect(statusLine).toContain('and WS09 step 38, the browser matrix and the switch-on notes, reads both clubs pages in every look')
    expect(statusLine).toContain('while step 36, club photos, waits for K\'s preview bucket as a checkpoint of its own; steps 1 to 14')
    expect(statusLine).not.toContain('checkpoint Z has begun')
    expect(statusLine).toContain('waits in draft pull request 154 for K\'s word')
    expect(statusLine).toContain('waits in draft pull request 158 for K\'s word')
    expect(statusLine).toContain('waits in draft pull request 159 for K\'s word')
    const tail = statusLine.slice(statusLine.lastIndexOf('; ') + 2)
    if (latest) expect(tail).toContain('checkpoint Y\'s review and its fixes, step 37, step 38, K\'s answers') // guarded by WS09 checkpoint Z's review, whose round the tail names after step 38
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(prLine).toContain('checkpoint Z, steps 37 and 38, is built on `redesign/ws09-clubs-z`, cut from checkpoint Y\'s head, and reviewed there, holds checkpoints Y, X and W and `main` at `85f20ec`, and waits for its own draft pull request and K\'s word for its merge, after 159, and step 36 waits for K\'s preview bucket as a checkpoint of its own') // moved by WS09 checkpoint Z's review: the checkpoint is reviewed
    expect(prLine).not.toContain('checkpoint Z has begun')
    expect(prLine.endsWith('wait in pull request 151 for K\'s word.')).toBe(true)
    const said = bullet(block, '- **The Status and PR lines.**')
    for (const piece of ['three clauses', 'has begun with WS09 step 37', 'its tail names step 38', 'changes in one']) expect(said, piece).toContain(piece)
  })

  it('opens by saying where the step sits, that nothing is new for a visitor, and why step 36 waits', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the last step built of checkpoint Z (steps 36 to 38)', 'the close of WS09 but for club photos', '`c40402d`', 'Nothing new for a visitor', '`newClubs` with `CLUB_PAGES_ON`',
      'Three of the four switches', 'waits for K\'s preview bucket as a checkpoint of its own', '`src/lib/features.ts` and `functions/utils/clubs/pages.ts` are the base\'s to the byte',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The matrix.**', '- **The sweep.**', '- **The tile row.**', '- **The map.**', '- **The closing sections.**', '- **The rehearsal.**',
      '- **Branch.**', '- **The Status and PR lines.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**',
      '- **What ships with every switch off.**', '- **The last look.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(6)
  })

  it('names every file it adds and changes, each new test with its count, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...Object.keys(NEW_TESTS), SELF, MOVED, MOVED_TOO, MOVED_CLOSED[0], MOVED_CLOSED[12], 'src/pages/WorkspacePage.tsx', 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    expect(files).toContain('the 13 closed records of steps 16 to 28')
    for (const [file, count] of Object.entries(NEW_TESTS)) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect(writtenCount(files, file), file).toBe(count)
      expect(casesIn(file), file).toBe(WRITTEN[file] ?? count)
    }
    expect(writtenCount(files, SELF)).toBe(casesIn(SELF))
    const grown = sub(files, '  - Grown with no change:')
    for (const piece of ['117 handler files', '`PENDING_COUNT` stays 104', '`test/unit/fixtures/api-added-since-split.json` does not move', 'keeps its 11 cases', 'its 9']) expect(grown, piece).toContain(piece)
    expect(grown).toContain('`test/unit/chrome-reads.test.ts` goes from 59 to 60') // added by WS09 checkpoint Z's review
    const beyond = sub(files, '  - Files beyond the step\'s list:')
    for (const file of UNTOUCHED) {
      expect(beyond, file).toContain(`\`${file}\``)
      expect(read(file), file).not.toMatch(OURS)
    }
    for (const dir of ['functions/utils/mail/', 'domain/mail/', 'workers/daily-emails/', 'src/components/layout/', 'src/areas/admin/newsletter/']) expect(beyond, dir).toContain(`\`${dir}\``)
  })
})

describe('REDESIGN_STATUS.md, the thirty-eighth step of WS09: the parts against the files', () => {
  it('gives the matrix as the new spec reads it, and each run\'s figures', () => {
    const spec = read('test/a11y/clubs-matrix.spec.ts')
    expect(spec).toContain('const WIDTHS = [1440, 390] as const')
    for (const look of ['light', 'dark', 'live', 'heritage', 'heritage on a dark device']) expect(spec, look).toContain(`name: '${look}'`)
    expect(spec).toContain('looks: [LIVE, HERITAGE, HERITAGE_DARK]')
    expect(spec).toContain('looks: [LIGHT, DARK, LIVE, HERITAGE, HERITAGE_DARK]')
    expect(spec).toContain('testInfo.project.name !== A11Y_CLUBS_VARIANT.name')
    expect(spec).toContain('the page draws a scope of its own')
    const matrix = bullet(block, '- **The matrix.**')
    for (const piece of ['`test/a11y/clubs-directory.spec.ts`', '`test/a11y/clubs-reflow.spec.ts`', '`test/a11y/clubs-page.spec.ts`', 'light, dark, live, heritage and heritage on a dark device', 'no flaky case', 'My region, a club in My region and Your club', 'cannot sign in']) {
      expect(matrix, piece).toContain(piece)
    }
    expect(matrix).toMatch(/three runs in a row: 79, 79 and 79 tests, all passing/)
    expect(matrix).toMatch(/The one whole run of `npm run test:a11y` at the end, alone on the machine: [\d,]+ tests, [\d,]+ that run and [\d,]+ that skip/)
  })

  it('gives the sweep, the tile row and the map as the files hold them', () => {
    const sweep = bullet(block, '- **The sweep.**')
    for (const piece of ['below 1,024 pixels', '`functions/utils/clubs/pageHtml.ts`', 'both rests of its sheet', '"Sat, Oct 24, 2026"']) expect(sweep, piece).toContain(piece)
    const page = read('src/pages/WorkspacePage.tsx')
    expect(page).toContain('<div className={clubPagesOn() ? \'grid gap-4\' : \'grid gap-4 sm:grid-cols-3\'}>')
    const tile = bullet(block, '- **The tile row.**')
    for (const piece of ['`grid gap-4`', '`grid gap-4 sm:grid-cols-3`', 'from 13,800 bytes to']) expect(tile, piece).toContain(piece)
    if (latest) expect(tile).toContain(`to ${Buffer.byteLength(page).toLocaleString('en-US')} bytes`) // guarded by WS09 checkpoint Z's review: the page is a live one that later work changes
    const said = bullet(block, '- **The map.**')
    for (const piece of ['16 criteria', 'D17, D24, D26 and D29', 'eight items', '`test/unit/listing-rule.test.ts`']) expect(said, piece).toContain(piece)
  })

  it('gives the rehearsal\'s three lists, the three order tests in each state, and a checkout that is gone', () => {
    const rehearsal = bullet(block, '- **The rehearsal.**')
    for (const piece of ['a git worktree of `c40402d`', 'never committed and never pushed', '`git status`']) expect(rehearsal, piece).toContain(piece)
    const three = sub(rehearsal, '  - The three order tests:')
    for (const piece of ['63 passing', '`test/unit/club-pages-switch.test.ts`', '`test/unit/club-switches.test.ts`', '`test/unit/club-switches-exhaustive.test.ts`', 'newLook is off', 'differ']) {
      expect(three, piece).toContain(piece)
    }
    const look = sub(rehearsal, '  - The new look\'s own value')
    expect(look).toMatch(/46 cases in 12 files/)
    for (const file of ['test/unit/features.test.ts', 'test/unit/status-badge.test.tsx', 'test/unit/dock-build-edges.test.ts', 'test/unit/prepaint-gate.test.ts']) expect(look, file).toContain(`\`${file}\``)
    const clubs = sub(rehearsal, '  - `newClubs` and `CLUB_PAGES_ON` as shipped')
    expect(clubs).toMatch(/20 cases in 7 files/)
    for (const file of [
      'test/unit/features.test.ts', 'test/unit/redesign-status-ws09-switch-on-keepers.test.ts', 'test/unit/a11y-clubs-build.test.ts', 'test/a11y/global-setup.ts', 'test/unit/admin-club-page-roster.test.tsx',
      'test/unit/admin-club-page-roster-reading.test.tsx', 'test/unit/club-editor-off.test.tsx', 'test/unit/club-previews-edges.test.tsx',
    ]) {
      expect(clubs, file).toContain(`\`${file}\``)
      expect(existsSync(join(ROOT, file)), file).toBe(true)
    }
    expect(read('test/a11y/global-setup.ts')).toContain('export const CLUB_PAGES_LINE = ')
    expect(sub(rehearsal, '  - Anything else:')).toContain('no fault')
  })

  it('gives the branch, the merge, the database, a revert, what ships and the last look', () => {
    expect(bullet(block, '- **Branch.**')).toContain('`redesign/ws09-clubs-z`, after WS09 step 37, `c40402d`')
    const merge = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration', '117 handler files', '58 of the 162 methods', '`PENDING_COUNT` 104', '`deploy-worker.yml`']) expect(merge, piece).toContain(piece)
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('writes no row')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('changes nothing a person meets')
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['Nothing a visitor or a member can see or do differs from the base', '`test/unit/workspace-club-tile-width.test.tsx`', 'No switch is added.']) expect(off, piece).toContain(piece)
    const last = bullet(block, '- **The last look.**')
    for (const piece of ['76.61 KiB', 'gzip 20.53 KiB', '`index.js` 78,448 bytes', '`npm run check:bundle`', '`85f20ec`']) expect(last, piece).toContain(piece)
  })

  it('names the moved pins against their file, and the build\'s figures', () => {
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins).toContain(`\`${MOVED}\`, two assertions`)
    expect(read(MOVED).split('\n').filter((l) => l.includes('// moved by WS09 step 38'))).toHaveLength(2)
    expect(pins).toContain(`\`${MOVED_TOO}\`, one assertion`)
    expect(read(MOVED_TOO).split('\n').filter((l) => l.includes('Moved by WS09 step 38: checkpoint Z is built.'))).toHaveLength(1)
    expect(pins).toContain(`The 13 closed records of steps 16 to 28, \`${MOVED_CLOSED[0]}\` to \`${MOVED_CLOSED[12]}\`, one assertion each`)
    for (const file of MOVED_CLOSED) {
      const moved = read(file).split('\n').filter((l) => l.includes('// moved by WS09 step 38: the close records the step\'s decisions under its own tag'))
      expect(moved, file).toHaveLength(1)
      expect(moved[0], file).toContain(`!l.endsWith('${CLOSE}')`)
    }
    expect(bullet(block, '- **Lint.**')).toMatch(/13 errors and 11 warnings/)
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', '`index-Dhfva_cE.js`', '`index-BUAlFXpD.css`', '`features-BFUKrFdH.js`', '245 files']) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, checkpoint Z\'s section: K\'s note for newClubs', () => {
  it('opens with the checkpoint\'s steps, what it holds and what waits', () => {
    const opening = zone.split('\n')[2] ?? ''
    for (const piece of ['WS09 steps 37 and 38', '`c930b20`', '`c40402d`', 'draft pull request 159', 'draft pull request 158', 'draft pull request 154', '`85f20ec`', 'its own draft pull request', 'club photos']) {
      expect(opening, piece).toContain(piece)
    }
  })

  it('has the parts of checkpoint Y\'s section, in order, with K\'s note', () => {
    const parts = [
      '- **The steps.**', '- **What the merge carries.**', '- **What the merge does.**', '- **What ships with every switch as shipped.**', '- **Not in it.**', '- **K\'s switch-on note for newClubs.**',
      '- **What K is asked.**', '- **The way a revert goes.**',
    ]
    const at = parts.map((p) => zone.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('says what must be true first, in order, what the switch turns on and does not, when, how and how it comes back out', () => {
    const note = bullet(zone, '- **K\'s switch-on note for newClubs.**')
    const first = between(note, '  - What must be true first, in this order:', '  - What turning it on does at once:')
    const steps = first.split('\n').filter((l) => /^ {4}\d+\. /.test(l))
    expect(steps.map((l) => Number(/(\d+)\./.exec(l)?.[1]))).toEqual([1, 2, 3, 4, 5, 6, 7]) // moved by WS09 checkpoint Z's review, whose item 4 names three more owed things
    for (const [i, piece] of ['Checkpoints W, X and Y merged', '`newLook`', 'choice 26', 'the daily worker\'s two held lines', '`TURNSTILE_SECRET_KEY`', 'a maps key', 'each checkpoint\'s choices'].entries()) expect(steps[i], piece).toContain(piece) // moved by WS09 checkpoint Z's review
    expect(steps[0]).toContain('each with its migrations seen green in Apply database migrations before its live check')
    expect(steps[0]).toContain('`0071_rate_limits.sql`')
    expect(steps[4]).toContain('`VITE_TURNSTILE_SITE_KEY`') // moved by WS09 checkpoint Z's review
    expect(steps[4]).toContain('`SIGNING_SECRET`') // moved by WS09 checkpoint Z's review
    const now = sub(note, '  - What turning it on does at once:')
    for (const piece of ['`/clubs`', '`/clubs/<short address>`', '301', 'before any script', '`/sitemap.xml`', 'the Contact form', 'Reply through LCA', 'Suggest an update', 'Suggest a club or start one', 'Ask to be its named rep', 'The keepers\' rows', 'no officers', '"Family members and players from the same club"', 'five minutes']) {
      expect(now, piece).toContain(piece)
    }
    const not = sub(note, '  - What it does not turn on:')
    for (const piece of ['limit and spam check', 'region target', 'club photos']) expect(not, piece).toContain(piece)
    expect(sub(note, '  - When:')).toContain('between events')
    const how = sub(note, '  - How:')
    for (const piece of ['`newClubs: true`', '`export const CLUB_PAGES_ON = true`', 'its own pull request that K merges', '`test/a11y/global-setup.ts`', '`test/unit/club-pages-switch.test.ts`']) expect(how, piece).toContain(piece)
    for (const piece of ['The browser suite was not rehearsed with the switches set', 'one whole `npm run test:a11y` run of its own', '`test/a11y/scopes-edges.spec.ts`', 'perhaps `test/a11y/baseline.json`']) expect(how, piece).toContain(piece)
    const back = sub(note, '  - How it comes back out:')
    for (const piece of ['the same two lines set back', 'What stays in the database', 'What the edge keeps', 'a 301 for a day']) expect(back, piece).toContain(piece)
  })

  it('asks K in one numbered list, the built way first, with step 37\'s four', () => {
    const asked = bullet(zone, '- **What K is asked.**')
    const numbered = asked.split('\n').filter((l) => /^ {2}\d+\. /.test(l))
    expect(numbered.map((l) => Number(/(\d+)\./.exec(l)?.[1]))).toEqual([1, 2, 3, 4, 5, 6, 7]) // moved by WS09 checkpoint Z's review, whose ruling B4 made a choice on K's behalf
    for (const l of numbered) expect(l).toMatch(/built/)
    for (const [i, piece] of ['The roster and officers tools', '"Family members and players from the same club"', 'no officers', 'the mail work\'s files', 'events tile', 'The switch-on'].entries()) expect(numbered[i], piece).toContain(piece)
    expect(asked).toContain('The choices of checkpoints W, X and Y stand in their sections')
  })
})

describe('REDESIGN_STATUS.md, the thirty-eighth step of WS09: the Checks line, the map and the lists', () => {
  it('gives each figure once, in the forms the close reads, with the base\'s figures', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', ' over ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toMatch(/over [\d,]+ files \(1,570 on the base\)/)
    expect(checksLine).toMatch(/unit [\d,]+ tests in [\d,]+ files \(13,641 in 645 on the base\)/)
    expect(checksLine).toMatch(/integration [\d,]+ in [\d,]+ files \(3,996 in 224 on the base\)[^;]*with the one todo beside them/)
    expect(checksLine).not.toMatch(/that run in [\d,]+ files/)
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('the base\'s browser run 1,065 tests, 728 that run and 337 that skip')
  })

  it('adds one sentence to eight map items, each before its planned step, and to no other item', () => {
    const ids = ['Criterion 1', 'Criterion 2', 'Criterion 3', 'Criterion 7', 'Criterion 9', 'Criterion 14', 'Criterion 15', 'D26']
    const sentence = 'Built in WS09 step 38: '
    for (const id of ids) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item, id).toMatch(/ Planned: WS09 step \d+\.$/)
      expect(item.indexOf(sentence), id).toBeLessThan(item.lastIndexOf(' Planned: '))
    }
    expect(entries(map).filter((l) => l.includes(sentence)).map(head)).toEqual(ids.map((id) => `${id}.`))
    expect(mapItem('Criterion 15').slice(mapItem('Criterion 15').indexOf(sentence))).toContain('`test/a11y/clubs-matrix.spec.ts`')
    expect(mapItem('Criterion 1').slice(mapItem('Criterion 1').indexOf(sentence))).toContain('`test/unit/club-pages-no-dates-more.test.tsx`')
    expect(entries(map)).toHaveLength(20)
  })

  it('tags its decisions, deviations, verify items and follow-ups, and loses none of the others', () => {
    // The decisions the list did not carry for steps 16 to 37 and checkpoint W carry their own tags and end with the close's sentence;
    // the switch-ons, the asides and the reviews' rounds belong to no step, so they carry this one's.
    expect(tagged(decisions).map(head)).toEqual([
      'The switch-ons: the keepers\' half turned on for the board (WS09 step 38).', 'The switch-ons: the two wordings before the switch-on (WS09 step 38).',
      'The switch-ons: the club events turned on as built (WS09 step 38).', 'An aside: the regions are the five seats\' titles (WS09 step 38).', 'An aside: Help as small question marks (WS09 step 38).',
      'The reviews: one round of fixes after each review (WS09 step 38).', 'The matrix\'s rest in a file of its own (WS09 step 38).', 'K\'s note for the last switch (WS09 step 38).',
      'The Workspace\'s tile row follows what is drawn (WS09 step 38).',
    ])
    const closed = entries(decisions).filter((l) => l.endsWith(CLOSE))
    expect(closed).toHaveLength(25)
    for (const l of closed) expect(head(l), head(l)).not.toMatch(/^(?:Step \d+|Checkpoint W): /)
    const byTag = (tag: string) => closed.filter((l) => head(l).endsWith(`(WS09 ${tag}).`)).length
    for (const step of [16, 17, 18, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 37]) expect(byTag(`step ${step}`), `step ${step}`).toBe(1)
    expect(byTag('step 24')).toBe(2)
    expect(byTag('checkpoint W')).toBe(3)
    expect(entries(decisions).length).toBeGreaterThanOrEqual(38 + 34)
    expect(tagged(deviations).map(head)).toEqual([
      'No clubs.spec.ts (WS09 step 38).', 'One switch-on note, not four (WS09 step 38).', 'Today\'s club page in both older builds (WS09 step 38).', 'No held line to make here (WS09 step 38).',
      'The sweep\'s two parts in a new file (WS09 step 38).', 'Two of the three order tests pass in every state (WS09 step 38).', 'The switch-on is more than its two lines (WS09 step 38).',
      'Not built, so not turned on (WS09 step 38).', 'The three browser runs (WS09 step 38).',
    ])
    expect(entries(deviations).length).toBeGreaterThanOrEqual(131 + 9)
    expect(tagged(verify).map(head)).toEqual([
      'The matrix\'s looks (WS09 step 38).', 'What the clubs build already proved (WS09 step 38).', 'Signed-in pages in the browser tests (WS09 step 38).', 'The record\'s closing lists (WS09 step 38).',
      'The brief\'s seven, read again (WS09 step 38).', 'What turning newClubs on reaches, from the tree (WS09 step 38).', 'The counts the entry gives (WS09 step 38).',
    ])
    expect(entries(verify).length).toBeGreaterThanOrEqual(188 + 7)
    expect(tagged(followUps).map(head)).toEqual([
      'What the mail work\'s files still owe (WS09 step 38).', 'The daily worker\'s two held lines (WS09 step 38).', 'A refused address kept apart from a busy service (WS09 step 38).',
      'Club photos and the preview bucket (WS09 step 38).', 'Set the crop (WS09 step 38).', 'Road miles (WS09 step 38).', 'The publish date\'s refusal (WS09 step 38).',
      'Follow, Add to calendar and partner events (WS09 step 38).', 'The admin queue (WS09 step 38).', 'A look on a build with a maps key and on a real phone (WS09 step 38).',
      'Today\'s club pages\' two contrast follow-ups of WS01 (WS09 step 38).', 'The browser builds after the switch-on (WS09 step 38).', 'The choices still open with K (WS09 step 38).',
    ])
    expect(entries(followUps).length).toBeGreaterThanOrEqual(163 + 13)
    const builds = entries(followUps).find((l) => l.startsWith('- **The browser builds after the switch-on (WS09 step 38).**')) ?? ''
    for (const piece of ['The browser suite was not rehearsed with the switches set', 'one whole `npm run test:a11y` run', '`test/a11y/scopes-edges.spec.ts`', 'perhaps `test/a11y/baseline.json`']) {
      expect(builds, piece).toContain(piece)
    }
  })

  it('keeps the plain-language rules in what the step wrote and in the files it adds', () => {
    const mapped = entries(map).filter((l) => l.includes('Built in WS09 step 38: ')).map((l) => l.slice(l.indexOf('Built in WS09 step 38: ')))
    const listed = [...[decisions, deviations, verify, followUps].flatMap((t) => tagged(t)), ...entries(decisions).filter((l) => l.endsWith(CLOSE))]
    const written = [block, zone, ...listed, ...mapped].join('\n')
    const files = [...Object.keys(NEW_TESTS), SELF].map((f) => read(f)).join('\n')
    for (const [name, rule] of [['dashes', DASHES], ['working words', BANNED], ['tools', TOOLS], ['bare letters', BARE], ['old initials', OLD_INITIALS], ['unfilled', UNFILLED], ['he', HE]] as const) {
      expect(name === 'working words' || name === 'bare letters' || name === 'he' ? proseOf(written) : written, name).not.toMatch(rule)
      // The files' code calls the string and array helpers, so the working words are read in their comments alone.
      const text = name === 'working words' ? files.split('\n').filter((l) => /^\s*(?:\/\/|\*)/.test(l)).join('\n') : files
      if (name !== 'unfilled' && name !== 'he') expect(text, name).not.toMatch(rule)
    }
    for (const date of written.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 2026\b/g)) {
      expect(written.slice(Math.max(0, date.index - 12), date.index), date[0]).toMatch(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), $/)
    }
    expect(read(SELF)).not.toMatch(DASHES)
  })
})
