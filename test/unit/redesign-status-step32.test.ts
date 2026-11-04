// test/unit/redesign-status-step32.test.ts
//
// REDESIGN_STATUS.md records step 32 (AC1's matrix in every look, and the
// close of WS01), and REDESIGN_SPEC.md's WS01 deviation list carries its
// sentence. Pinned here: the step block sits after step 31's and before the
// Checkpoint D section, which comes before the Decisions; the date line
// names the step first and still holds the older steps in its first 400
// characters; the AC1 row is filled, and every row of the table ends with a
// step and a proof, none of them Planned, with K's answer on K1d, the
// pending halves of AC7 and AC9 and the step's sentences on K5 and T1; the
// WS01 header and the Checkpoint D section say the merge has happened (they
// said it was pending until checkpoint D merged, and WS02 step 1 moved these
// two pins to the merged wording); the Checkpoint D section says what the
// merge does to production and lists every switch as off; the planned
// line for AC1 keeps its words with Done in step 32 added; the decisions,
// the deviation, the verify items and the follow-ups are there, none
// renamed or removed, the ones the step was handed closed or given a
// sentence; the files of the step hold no dash and name no tool; and the
// plain-language rules hold (no em dash, none of the working words, no
// mention of an assistant, US Chess rather than its old initials).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')
const spec = read('docs/redesign/REDESIGN_SPEC.md')

const BANNED = /\b(slice|builder|scout|planner|recorder|manifest|subagent|workflow)\b|the lead/i
/** The names of the tools a record must not mention, split up so this file does not mention them either. */
const ASSISTANT = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'l' + 'lm', 'co-authored' + '-by'].join('|')})\\b`, 'i')
/** An en dash or an em dash, written by code so this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The names the records were drafted with before their figures were filled in. */
const UNFILLED = /\b(RECORDTESTCOUNT|BROWSERRUNSTEXT|CHECKSTEXT|CHECKPOINTCHECKS|GREPMEASURE)\b/

const lines = status.split('\n')
const line = (start: string) => lines.find((l) => l.startsWith(start)) ?? ''
const between = (from: string, to: string) => {
  const start = status.indexOf(from)
  if (start < 0) return ''
  const end = status.indexOf(to, start + from.length)
  return status.slice(start, end < 0 ? undefined : end)
}
/** A bullet and the indented lines under it, from the first line that starts with `start` after `after`. */
function bullet(start: string, after = ''): string {
  const from = after ? lines.findIndex((l) => l.startsWith(after)) : 0
  const at = lines.findIndex((l, i) => i >= from && l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < lines.length && /^\s+\S/.test(lines[end])) end++
  return lines.slice(at, end).join('\n')
}

const HEADING = '### Step 32: AC1 in every look, and WS01 closed'
const CHECKPOINT = '### Checkpoint D: steps 20 to 32'
const block = between(HEADING, CHECKPOINT)
const checkpoint = between(CHECKPOINT, '### Decisions')
const header = between('## WS01:', '### What each acceptance criterion')
const table = lines.filter((l) => /^\| (AC\d+|K\d[a-g]?|T\d) \|/.test(l))
const row = (id: string) => table.find((l) => l.startsWith(`| ${id} |`)) ?? ''
const decisions = between('### Decisions', '\n### ').split('\n').filter((l) => l.startsWith('- ') && l.includes('(step 32)'))
const tagged = lines.filter((l) => /\(step 32[;)]/.test(l))
const deviation = bullet('- **Step 32.**')
const verify = between('### Verify items resolved', '### Follow-ups')
const followUps = between('### Follow-ups', '\n## WS02')
const followUpEntries = followUps.split('\n').filter((l) => l.startsWith('- **'))
const headings = followUpEntries.map((l) => l.slice(4, l.indexOf('**', 4)))
/** A follow-up by its heading, from the Follow-ups alone (a verify item can share a heading). */
const entry = (name: string) => followUpEntries.find((l) => l.startsWith(`- **${name}.**`)) ?? ''
/** What this step wrote at the end of an older entry: from its first "Step 32" or "Done in step 32" on. */
function ours(text: string): string {
  const at = [text.indexOf('Step 32'), text.indexOf('Done in step 32')].filter((i) => i >= 0)
  return at.length ? text.slice(Math.min(...at)) : ''
}

/** The follow-ups handed to this step: closed, or answered with a sentence. */
const DONE = [
  'Dark, live and heritage under axe (step 21)',
  'Navy text on the tournament hero\'s gold tint (step 23; older than the step)',
  'The filter menu clips its options\' ring (step 23)',
  'The State champions link (step 25; older than the step)',
]
const ANSWERED = [
  'Hero carousel and the known-violations list (step 20)',
  'Muted `StatusBadge` contrast (step 20)',
  'Classes only docs and tests name reach the CSS (step 23)',
  'Selected navy controls in dark mode (step 23)',
  'Gold grounds in dark mode (step 23)',
  'Gold that is not text (step 25)',
  'The baseline sampler waits for content (step 27)',
  'Image files nothing uses (step 28; older than the step)',
  'The Facebook band\'s image with no width or height (step 29; older than the step)',
  'The layout shift as measured (step 31)',
]
/** Older entries the step meets and gives a sentence. */
const MET = [
  'AC9 live check',
  'Contracts as endpoints change (step 7)',
  'Retiring the JSON columns',
  'K\'s lab run on the preview (step 29)',
  'The Georgia run (step 31)',
  'Club colours in dark mode (step 23)',
  'A club\'s own colour as words (step 25)',
]
const NEW = [
  'K reviews the step 32 judgement calls (step 32)',
  'K\'s checks before the switches go on (step 32)',
  'Today\'s site keeps what the sweep mended under the new look (step 32; older than the step)',
  'The known-violations entries with every switch off (step 32)',
  'The pages AC1 does not name (step 32)',
  'Caps, holds and the family limit at registration (step 32)',
  'Pages to thin in WS05, WS06 and WS08 (step 32)',
]

describe('REDESIGN_STATUS.md, step 32: the acceptance table', () => {
  it('fills the AC1 row with the matrix, its cells, what it found and what became of the known list', () => {
    const ac1 = row('AC1')
    expect(ac1).toMatch(/^\| AC1 \| axe finds no serious or critical issue on the listed pages in every look \| 32 \| `test\/a11y\/scopes\.spec\.ts` on `a11y-on` \(`newLook` and `themeHeritage` on\), 52 tests: /)
    expect(ac1).not.toContain('Planned')
    for (const piece of [
      '`wcag22aa`',
      '`/tournaments/fx-t-done`',
      '`/tournaments/fx-t-open`',
      '`/governance/minutes`',
      '100 cells',
      '104 cells',
      '"AC1 /clubs, dark, 390 pixels (a11y-on): 28 rules passed, 0 finding(s), 0 contrast check(s) axe could not finish."',
      '`data-theme=""`',
      '`link-in-text-block`',
      '`nested-interactive`',
      '1.29:1',
      '1.86:1 and 2.87:1 in the live look',
      '`test/unit/sweep-fixes.test.tsx`',
      'are read on their pixels by `test/a11y/scopes-edges.spec.ts`',
      '`img.decode()`',
      '5.93:1',
      '`test/a11y/known-violations.json` lists nothing for `a11y-on`',
      'the file is not emptied',
      'The 26 routes AC1 does not name',
      // The cells are read signed out, and the row says so, with what that leaves unread.
      'Every cell is read signed out',
      '`button-name` (critical)',
      '`nested-interactive` (serious)',
      'WS14 mends it',
      '(WS05\'s and WS06\'s)',
      '"The pages AC1 does not name (step 32)"',
    ]) expect(ac1, piece).toContain(piece)
    expect(ac1.split(' | ')).toHaveLength(4)
  })

  it('has a row for each of the 32 criteria and decisions and for T1 and T2, each with its step and a proof, and none Planned', () => {
    const ids = table.map((l) => l.split(' | ')[0].slice(2))
    const expected = [
      ...Array.from({ length: 14 }, (_, i) => `AC${i + 1}`),
      'K1a', 'K1b', 'K1c', 'K1d', 'K2a', 'K2b', 'K2c', 'K2d', 'K2e', 'K2f', 'K2g', 'K3a', 'K3b', 'K3c', 'K3d', 'K4', 'K5', 'K6',
      'T1', 'T2',
    ]
    expect(ids).toEqual(expected)
    expect(ids.filter((id) => !id.startsWith('T'))).toHaveLength(32)
    for (const l of table) {
      const cells = l.split(' | ')
      expect(cells, cells[0]).toHaveLength(4)
      expect(cells[2], cells[0]).toMatch(/^\d+$/)
      expect(Number(cells[2]), cells[0]).toBeGreaterThanOrEqual(1)
      expect(Number(cells[2]), cells[0]).toBeLessThanOrEqual(32)
      expect(cells[3].length, cells[0]).toBeGreaterThan(200)
      expect(l, cells[0]).not.toContain('Planned')
    }
  })

  it('gives K1d the sentence K\'s answer gives, keeps the pending halves of AC9 and AC7, and answers step 20 and step 23 on K5 and T1', () => {
    const k1d = row('K1d')
    expect(k1d).toContain('| 7 | **Partial: ratchet.**')
    expect(k1d).toContain('110 lines, count pinned')
    for (const piece of ['K answered on October 8, before step 7: the ratchet, as planned', '"Contracts are a ratchet"', '110 endpoint methods (`PENDING_COUNT`)']) expect(k1d, piece).toContain(piece)
    const ac9 = row('AC9')
    for (const piece of ['Live half: K checks a branch deploy\'s bindings after the first push (not done yet).', 'Step 32: still K\'s to do', '"K\'s checks before the switches go on (step 32)"']) expect(ac9, piece).toContain(piece)
    expect(row('AC7')).toContain('Step 32: K\'s run on a preview is still to do')
    expect(row('K5')).toContain('Step 32: the list is not emptied.')
    expect(row('T1')).toContain('Step 32: done; `test/a11y/scopes.spec.ts` reads every AC1 page in dark mode, the live look and heritage')
  })

  it('updates the WS01 header: all 32 steps built, the four checkpoints merged and live, draft pull request 108, and the head that merged', () => {
    for (const piece of ['**Status:** built. All 32 steps are on the branch', 'All four checkpoints are merged into `main` and live', 'draft pull request 108']) expect(header, piece).toContain(piece)
    expect(header).not.toMatch(/in progress/)
    expect(header).not.toMatch(/merge is pending/)
    // Until the merge the header named no head, and a pin held that no commit
    // stood in backticks there. The Branch line promised to name the head that
    // merges once it had merged, so it now names ffee346, and that pin went.
    expect(header).toMatch(/\*\*Branch:\*\* [^\n]*the head that merged is `ffee346`/)
  })
})

describe('REDESIGN_STATUS.md, step 32: the step block', () => {
  it('sits after step 31 and before the Checkpoint D section, which comes before the Decisions, and the date line names it first', () => {
    const at = status.indexOf(HEADING)
    expect(at).toBeGreaterThan(status.indexOf('### Step 31:'))
    expect(at).toBeLessThan(status.indexOf(CHECKPOINT))
    expect(status.indexOf(CHECKPOINT)).toBeLessThan(status.indexOf('### Decisions'))
    expect(line('Last updated:')).toMatch(/^Last updated: \S+ \(WS01, step 32: [^;]+; step 31: [^;]+; step 30: [^;]+; step 29: [^;]+; /)
    for (const step of ['step 18', 'step 21', 'step 23', 'step 26', 'step 27', 'step 28', 'step 29', 'step 30', 'step 31', 'step 32']) expect(status.slice(0, 400), step).toContain(step)
  })

  it('records every part, and nothing left to fill in', () => {
    for (const part of [
      '**Files.**', '**The sweep.**', '**What is asserted and what is printed.**', '**What the matrix found, and the fixes.**', '**The toggles\' pressed state.**', '**The known-violations list.**',
      '**The muted pair.**', '**The fixtures.**', '**The unfinished contrast checks.**', '**The follow-ups handed to this step.**', '**The switches.**', '**The tests.**',
      '**The places left for later.**', '**Judgement calls.**', '**Records corrected.**', '**Lint.**', '**Build.**', '**The browser runs.**', '\n- Checks:',
    ]) expect(block, part).toContain(part)
    expect(block).toMatch(/13 errors and 13 warnings before and after/)
    for (const text of [block, checkpoint]) {
      expect(text).not.toContain('__')
      expect(text).not.toContain('@@')
      expect(text).not.toMatch(/\{[A-Z_0-9]+\}/)
      expect(text).not.toMatch(UNFILLED)
    }
    expect(verify).not.toMatch(UNFILLED)
  })

  it('names every file the step adds or changes in its Files', () => {
    const files = bullet('- **Files.**', HEADING)
    for (const name of [
      'test/a11y/scopes.spec.ts',
      'test/a11y/scopes-edges.spec.ts',
      'test/unit/sweep-fixes.test.tsx',
      'test/unit/sweep-fixes-edges.test.tsx',
      'test/unit/scopes-edges.test.ts',
      'test/unit/redesign-status-step32.test.ts',
      'src/index.css',
      'src/areas/clubs/clubColors.ts',
      'src/pages/ClubsPage.tsx',
      'src/pages/ClubDetailPage.tsx',
      'src/pages/AdminClubPage.tsx',
      'src/pages/TournamentDetailPage.tsx',
      'src/pages/TournamentsPage.tsx',
      'src/areas/households/components/FamilyRegistrationPanel.tsx',
      'src/areas/events/components/MiniCalendar.tsx',
      'src/areas/events/components/AgendaList.tsx',
      'src/components/FilterDropdown.tsx',
      'test/a11y/known-violations.json',
      'docs/redesign/REDESIGN_SPEC.md',
      'test/a11y/smoke.spec.ts',
      'test/a11y/tokens.spec.ts',
      'test/unit/browser-test-wiring.test.ts',
      'test/unit/gold-icons-words.test.ts',
      'test/unit/goldText.test.ts',
      'test/unit/contrast.test.ts',
      'test/unit/semantic-map-cascade.test.ts',
    ]) expect(files, name).toContain(`\`${name}\``)
    expect(files).toContain('`test/a11y/scopes.spec.ts` (52 tests on each build; 52 run on `a11y-on` and none on `a11y-off`, where each skips)')
    expect(files).toMatch(/`test\/unit\/redesign-status-step32\.test\.ts` \(\d+: these records\)/)
  })

  it('describes the sweep: the pages, the five readings, where each look is set, the grounds and the cells', () => {
    const sweep = bullet('- **The sweep.**', HEADING)
    for (const piece of [
      '`openDrawn`',
      '`.dark` on `<html>`',
      '`color-scheme: dark`',
      'So the four looks are read five ways.',
      '`bg-background` and `text-foreground`',
      '`asLiveScope`',
      '`data-layout="heritage"`',
      '`""` for the base look',
      '`rgb(7, 11, 20)`',
      '`rgb(247, 243, 232)`',
      '`rgb(255, 250, 241)`',
      'colours and not its faces',
      '104 cells in 52 tests',
      '`AXE_TAGS`',
      'Every cell is read signed out, as a visitor sees the page',
    ]) expect(sweep, piece).toContain(piece)
    const asserted = bullet('- **What is asserted and what is printed.**', HEADING)
    for (const piece of ['A finding of any impact fails the test', 'do not fail it', '"AC1 /tournaments/fx-t-open, live, 390 pixels (a11y-on): 31 rules passed, 0 finding(s), 2 contrast check(s) axe could not finish."']) expect(asserted, piece).toContain(piece)
  })

  it('describes each finding with its colours and its fix under newLook, and the code holds each fix', () => {
    const found = bullet('- **What the matrix found, and the fixes.**', HEADING)
    for (const piece of [
      '26 of the 104 cells',
      '`link-in-text-block`',
      '1.03:1',
      '`:root[data-look="new"] p > a.text-lca-gold`',
      '`#1a2744` on `#343a45`, 1.29:1',
      '11.43:1',
      '506 pixels wide at 390',
      '`grid grid-cols-1 gap-8 lg:grid-cols-3`',
      '`role="region"`',
      '`scrollable-region-focusable`',
      '27 club cards',
      '`nested-interactive`',
      '`#1f4e79` on `#14253d`, 1.78:1',
      '`#2e7d32` on `#17302d`, 2.73:1',
      '`dark:text-ink!` and `in-data-[theme=live]:text-ink!`',
      'The second run found nothing in any cell',
    ]) expect(found, piece).toContain(piece)
    const css = read('src/index.css')
    expect(css).toMatch(/:root\[data-look="new"\] p > a\.text-lca-gold \{\s*text-decoration-line: underline;\s*\}/)
    expect(css).toMatch(/:root\[data-look="new"\] \.bg-popover\.overflow-y-auto > button:focus-visible \{\s*outline-offset: -2px;\s*\}/)
    // The club colour's classes are written once, in the helper beside clubTextColor, and wait for the switch.
    const colours = read('src/areas/clubs/clubColors.ts')
    expect(colours).toContain('if (!FEATURES.newLook || !color || color.trim().toLowerCase() === LCA.gold) return undefined')
    expect(colours).toContain('return \'dark:text-ink! in-data-[theme=live]:text-ink!\'')
    expect(read('src/pages/ClubsPage.tsx').match(/clubTextOnDark\(club\.color\)/g)).toHaveLength(1)
    expect(read('src/pages/ClubDetailPage.tsx').match(/clubTextOnDark\(club\.color\)/g)).toHaveLength(3)
    expect(read('src/pages/AdminClubPage.tsx').match(/clubTextOnDark\(color\)/g)).toHaveLength(1)
    const detail = read('src/pages/TournamentDetailPage.tsx')
    expect(detail).toContain('FEATURES.newLook ? \'grid grid-cols-1 gap-8 lg:grid-cols-3\' : \'grid gap-8 lg:grid-cols-3\'')
    expect(detail).toContain('tabIndex: 0, role: \'region\', \'aria-label\': \'Sections\'')
  })

  it('records the toggles that say their state with every switch off, and the code holds each', () => {
    const pressed = bullet('- **The toggles\' pressed state.**', HEADING)
    for (const piece of [
      '`aria-pressed`', '`aria-current`', '`aria-expanded`', '1.17:1', 'with every switch off as well',
      '`src/pages/TournamentDetailPage.tsx`', '`src/areas/households/components/FamilyRegistrationPanel.tsx`', '`src/pages/TournamentsPage.tsx`',
      '`src/areas/events/components/MiniCalendar.tsx`', '`src/areas/events/components/AgendaList.tsx`', '`src/components/FilterDropdown.tsx`',
      'the List and Calendar views', 'the organizer column\'s rows', '`aria-current="date"`',
      '(WS02)', '(WS14)', '(WS03 deletes the slideshow)',
    ]) {
      expect(pressed, piece).toContain(piece)
    }
    // The claim the review found too wide is not made: what is left on the AC1 pages is named, each with its workstream.
    expect(pressed).not.toContain('the other toggles on those pages had it already')
    expect(read('src/pages/TournamentDetailPage.tsx').match(/aria-pressed=\{isSel\}/g)).toHaveLength(2)
    expect(read('src/areas/households/components/FamilyRegistrationPanel.tsx')).toContain('aria-pressed={on}')
    const list = read('src/pages/TournamentsPage.tsx')
    for (const attr of ['aria-pressed={timeTab === tab}', 'aria-pressed={viewMode === \'list\'}', 'aria-pressed={viewMode === \'calendar\'}', 'aria-current={isSel ? \'true\' : undefined}']) expect(list, attr).toContain(attr)
    expect(list.match(/aria-pressed=\{isSelected\(\{ kind: '[a-z-]+'(, clubId)? \}\)\}/g)).toHaveLength(4)
    const calendar = read('src/areas/events/components/MiniCalendar.tsx')
    expect(calendar).toContain('aria-pressed={isSelected}')
    expect(calendar).toContain('aria-current={isToday ? \'date\' : undefined}')
    expect(read('src/areas/events/components/AgendaList.tsx')).toContain('aria-current={isSelected ? \'true\' : undefined}')
    const filter = read('src/components/FilterDropdown.tsx')
    expect(filter).toContain('aria-expanded={open}')
    expect(filter).toContain('aria-pressed={opt.value === value}')
    const switches = bullet('- **The switches.**', HEADING)
    expect(switches).toContain('One fix is ungated, `aria-pressed`')
    expect(switches).not.toContain('There is no ungated fix')
  })

  it('accounts for the known list: nine entries left, all of them today\'s site with every switch off', () => {
    const known = JSON.parse(read('test/a11y/known-violations.json')) as { comment: string; violations: Array<{ project: string; route: string; rule: string }> }
    expect(known.violations).toHaveLength(9)
    expect(known.violations.every((v) => v.project === 'a11y-off' && v.route === '/')).toBe(true)
    expect(known.comment).toContain('step 32')
    const list = bullet('- **The known-violations list.**', HEADING)
    for (const piece of [
      '"axe on / (a11y-off): 21 rules passed, 8 violation(s) found, 8 of them known."',
      '"axe on / (a11y-on): 25 rules passed, 0 violation(s) found, 0 of them known."',
      'the greys go when `newLook` is turned on, and the dots when WS03 deletes the slideshow',
      'Nothing was added.',
      'Step 20\'s decision that step 32 empties the file is left as written',
    ]) expect(list, piece).toContain(piece)
    // Step 20's decision keeps its words, and the step 20 line on the list gains the answer.
    expect(line('- **Known axe violations (step 20).**')).toContain('step 32 (AC1) fixes each entry and empties the file.')
    expect(line('- **The known-violations baseline.**')).toContain('Step 32 empties the list. Step 32: it does not;')
  })

  it('reports the build, the browser runs and the counts', () => {
    const build = bullet('- **Build.**', HEADING)
    for (const piece of [
      'CSS 141,280 and 141,596 bytes in three files',
      'JavaScript 2,594,198 and 2,595,407 bytes in 109 and 109 files',
      '186 and 186 files in all (192 and 192 in `dist`)',
      '130,131 to 130,447 bytes, 316 more',
      '`ClubsPage-*.js` 12,810 to 13,125',
      '`TournamentDetailPage-*.js` 38,546 to 38,857',
      '`ClubDetailPage-*.js` 9,302 to 9,346',
      '`AdminClubPage-*.js` 25,025 to 25,043',
      '`TournamentsPage-*.js` 29,303 to 29,683',
      '510,514 to 510,649',
      '40 other files change their hash only',
      '190 files as before',
      'no zod in 186 files',
    ]) expect(build, piece).toContain(piece)
    const runs = bullet('- **The browser runs.**', HEADING)
    for (const piece of [
      'no finding in any of the 104 cells',
      '"AC1 /clubs, live, 390 pixels (a11y-on): 28 rules passed, 0 finding(s), 0 contrast check(s) axe could not finish."',
      '"AC1 /champions, heritage on a dark device, 1280 pixels (a11y-on): 26 rules passed, 0 finding(s), 0 contrast check(s) axe could not finish."',
      '"axe in dark mode on /tournaments: 28 rules passed, 0 colour-contrast failure(s), 0 other rule(s) with findings."',
      '"Baseline matches: no colour or font changed."',
      '`test/a11y/scopes-edges.spec.ts` runs 29 tests on `a11y-on` and 8 on `a11y-off`',
      'It reads 161 unfinished checks on their pixels',
      '"AC1 unfinished checks on /tournaments/fx-t-open, light, 390 pixels (a11y-on): 2 read on their pixels."',
      '14.68:1 in the look\'s ink on a dark one',
    ]) expect(runs, piece).toContain(piece)
    for (const route of ['/', '/tournaments', '/membership']) expect(runs).toContain(`axe in dark mode on ${route}:`)
    const checks = bullet('- Checks:', HEADING)
    expect(checks).toMatch(/unit \d{4} tests in 167 files \(4379 in 163 before;/)
    expect(checks).toContain('integration 790 in 58 (unchanged)')
    expect(checks).toContain('657 tests, 463 that run and 194 that skip (479, 374 and 105 before;')
    expect(checks).toContain('`scopes.spec.ts` adds 52 tests on each build, 104 in all, 52 that run on `a11y-on` and none on `a11y-off`')
    expect(checks).toContain('`scopes-edges.spec.ts` 37 on each build, 74 in all, 29 that run on `a11y-on` and 8 on `a11y-off`')
    expect(checks).toContain('Three full runs passed with exit 0')
    expect(checks).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
  })

  it('records the late change to src/lib/features.ts from step 31\'s commit', () => {
    const corrected = bullet('- **Records corrected.**', HEADING)
    for (const piece of ['`c52848e`', '`src/lib/features.ts`', 'lines 46 to 52', 'from line 50 to 53', 'from 194 to 197', '"The late record (step 32)"']) expect(corrected, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, the Checkpoint D section', () => {
  it('says the merge has happened, with its merge commit and what it was seen to do, and what each step of the checkpoint did', () => {
    expect(checkpoint).toContain('**Merged into `main` as `34b721c` on Thursday, October 22, 2026 at 6:52 PM UTC** (pull request 108, a merge commit on head `ffee346`)')
    for (const piece of [
      'a green CI run on `ffee346`',
      'the pull request\'s own merge time',
      'the CI run for the push to `main` passed',
      '`.github/workflows/migrate-db.yml` and `.github/workflows/deploy-worker.yml` did not run',
      'production stays at `0054_requires_lca_membership.sql`',
      'at 7:10 PM UTC',
      'a local production build of `ffee346`\'s tree',
      'all 24 switches are off in production',
    ]) expect(checkpoint, piece).toContain(piece)
    expect(checkpoint).not.toContain('Not merged yet')
    expect(checkpoint).not.toContain('merge into `main` is pending')
    for (let n = 20; n <= 32; n++) expect(checkpoint, `step ${n}`).toContain(`\n- **Step ${n}:** `)
  })

  it('says what the merge does to production, measured against a25c4a5', () => {
    for (const piece of [
      'Measured against `a25c4a5`',
      '`.github/workflows/migrate-db.yml`',
      '`0054_requires_lca_membership.sql`',
      '`.github/workflows/deploy-worker.yml`, whose paths are `workers/**`, `functions/utils/**` and `domain/**`, does not run',
      '115 files in `dist/assets` (121 in `dist`)',
      'CSS 141,596 in three and JavaScript 2,595,407 in 109',
      '100,254 to 130,447',
      'the first load of `/` asks for two more script files than at `a25c4a5`',
      'exact-pinned at 5.3.0',
      '`@axe-core/playwright` 4.13.0',
      '`@playwright/test` 1.63.0',
      '`lighthouse` 13.5.0',
      '`sharp` 0.34.5',
      '`playwright-core` at 1.63.0',
      '`ci.yml` gains the `a11y` job',
      '`e2e-preview.yml` is new and starts only by hand',
      'ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef',
      '`git revert -m 1 <merge sha>`',
      'There is nothing to undo in a database',
    ]) expect(checkpoint, piece).toContain(piece)
  })

  it('lists all 24 switches as off and says what K looks at for each switch WS01 added', () => {
    const switches = bullet('  - Every switch in `src/lib/features.ts` is off', CHECKPOINT)
    const names = [...switches.slice(0, switches.indexOf(', each `false`')).matchAll(/`([a-zA-Z]+)`/g)].map((m) => m[1])
    expect(names).toHaveLength(24)
    expect(new Set(names).size).toBe(24)
    expect(switches).toContain('is off, all 24:')
    const forK = bullet('- **For K, on a preview, switch by switch.**', CHECKPOINT)
    for (const piece of ['`VITE_FLAGS`', 'throwaway branch', '`PHASE_0`', '`newLook`:', '`themeHeritage`, with `newLook`:', '`themeScholastic`:', '`membershipRequirementSwitch`:', '"K reviews the step 32 judgement calls"', '"K\'s checks before the switches go on (step 32)"']) {
      expect(forK, piece).toContain(piece)
    }
    // The preview is built whatever that branch's tests say, and the tests that hold a switch off are named as measured.
    for (const piece of [
      'whatever the branch\'s tests would say',
      'is never opened as a pull request or merged',
      '`.github/workflows/ci.yml` runs on pull requests to `main` and on pushes to `main`',
      '`newLook` fails 25 unit tests in eight files',
      '`test/unit/features.test.ts`', '`test/unit/feature-overrides.test.ts`', '`test/unit/prepaint-gate.test.ts`',
      '`test/unit/status-badge.test.tsx`', '`test/unit/status-badge-edges.test.tsx`', '`test/unit/appearance-control-off.test.tsx`',
      '`test/unit/news-pinned-off.test.tsx`', '`test/unit/brand-placements.test.tsx`',
      '`test/unit/heritage-layout.test.tsx`', '`test/unit/tournament-manage-membership-switch.test.tsx`',
    ]) expect(forK, piece).toContain(piece)
    expect(forK).not.toContain('or that branch\'s checks fail')
    const checks = bullet('- **Checks at the end of the checkpoint.**', CHECKPOINT)
    expect(checks).toMatch(/unit \d{4} in 167 files \(1601 in 74 at the end of checkpoint C\)/)
    expect(checks).toContain('657 tests, 463 that run and 194 that skip')
  })
})

describe('REDESIGN_STATUS.md, step 32: decisions, deviations, verify items and follow-ups', () => {
  it('keeps the line planned for this step word for word, with Done in step 32 after it', () => {
    const planned = line('- **AC1\'s live and heritage runs (step 32)**')
    expect(planned).toContain('- **AC1\'s live and heritage runs (step 32)** set the look on each page\'s `<main>` inside the test, since few routes use those looks in WS01. Done in step 32:')
    for (const piece of ['`test/a11y/scopes.spec.ts`', 'on the layout\'s own scope div', '`data-theme=""`']) expect(planned, piece).toContain(piece)
  })

  it('records the step\'s own decisions, none of them under an earlier step\'s name', () => {
    expect(decisions).toHaveLength(7)
    const text = decisions.join('\n')
    for (const piece of [
      '`test/a11y/scopes.spec.ts`',
      '`PAGES`',
      'A control holds no other control',
      '`src/index.css`',
      '`grid-cols-1`',
      '`test/a11y/known-violations.json` lists nothing for `a11y-on`',
      '`clubTextColor` for their colour and `clubTextOnDark` for their classes',
      'carries `aria-pressed`',
      'carries `aria-current`',
      'carries `aria-expanded`',
    ]) expect(text, piece).toContain(piece)
    for (const d of decisions) for (const older of ['(step 31)', '(step 30)', '(step 29)', '(step 28)', '(step 27)']) expect(d).not.toContain(older)
  })

  it('lists the step 32 deviations and the files beyond the step\'s list, after step 31\'s', () => {
    for (const piece of ['of any impact', 'on the scope\'s div', '`fx-t-done`', '`fx-t-open`', 'it does not', '`test/a11y/heritage.spec.ts` keeps AC11 to AC13', '`src/pages/TournamentsPage.tsx`', 'the one ungated fix is `aria-pressed`', 'Files beyond the step\'s list']) {
      expect(deviation, piece).toContain(piece)
    }
    expect(deviation).not.toContain('there is no ungated fix')
    const beyond = bullet('  - Files beyond the step\'s list:', '- **Step 32.**')
    for (const path of [
      'src/pages/ClubsPage.tsx',
      'src/areas/clubs/clubColors.ts',
      'src/pages/ClubDetailPage.tsx',
      'src/pages/AdminClubPage.tsx',
      'src/pages/TournamentsPage.tsx',
      'src/areas/households/components/FamilyRegistrationPanel.tsx',
      'src/areas/events/components/MiniCalendar.tsx',
      'src/areas/events/components/AgendaList.tsx',
      'src/components/FilterDropdown.tsx',
      'test/a11y/scopes-edges.spec.ts',
      'test/unit/scopes-edges.test.ts',
      'test/unit/sweep-fixes-edges.test.tsx',
      'test/unit/sweep-fixes.test.tsx',
      'test/a11y/smoke.spec.ts',
      'test/a11y/tokens.spec.ts',
      'test/unit/contrast.test.ts',
      'test/unit/goldText.test.ts',
      'test/unit/gold-icons-words.test.ts',
      'test/unit/browser-test-wiring.test.ts',
      'test/unit/redesign-status-step32.test.ts',
      'docs/redesign/REDESIGN_SPEC.md',
    ]) expect(beyond, path).toContain(`\`${path}\``)
    const steps = between('### Deviations from the brief', '### Verify items resolved').split('\n').filter((l) => /^- \*\*Step \d+\.\*\*/.test(l)).map((l) => Number(l.match(/Step (\d+)/)![1]))
    expect(steps.slice(steps.indexOf(31), steps.indexOf(31) + 2)).toEqual([31, 32])
  })

  it('resolves the verify item it was given, and the ones it found', () => {
    for (const name of [
      'AC1 page list against routes',
      'The looks on the three heritage pages',
      'What the checker runs on today',
      'The failure rule',
      'The known-violations list',
      'The findings no spec fails on',
      'The fixtures',
      'Dark',
      'The harness',
      'The pins that move',
      'The table and the records',
      'The header and checkpoint D',
      'The date line',
      'Lint and counts',
      'The baseline',
      'The grep check',
      'The late record',
      'The follow-ups handed over',
    ]) expect(verify, name).toContain(`- **${name} (step 32).**`)
    const routes = line('- **AC1 page list against routes (step 32).**')
    for (const piece of ['Confirmed in part', '`fx-t-quads`', '`fx-t-legacy`', '35 page routes']) expect(routes, piece).toContain(piece)
    for (const piece of ['394', '415', '377', '393']) expect(line('- **The date line (step 32).**'), piece).toContain(piece)
    expect(line('- **The baseline (step 32).**')).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
    expect(line('- **The grep check (step 32).**')).toMatch(/Measured: .*\d+ lines/)
  })

  it('closes four of the follow-ups it was handed, answers the other ten, and gives the older entries it meets a sentence', () => {
    for (const name of DONE) expect(entry(name), name).toContain('Done in step 32')
    for (const name of ANSWERED) {
      expect(entry(name), name).toContain('Step 32')
      expect(entry(name), name).not.toContain('Done in step 32')
    }
    for (const name of MET) {
      expect(entry(name), name).toContain('Step 32')
      expect(entry(name), name).not.toContain('Done in step 32')
    }
    expect(followUpEntries.filter((l) => l.includes('Done in step 32'))).toHaveLength(4)
    // The muted pair keeps the words step 26 pinned, and the known list is not called done.
    expect(entry('Muted `StatusBadge` contrast (step 20)')).toContain('Still open for the step 32 sweep')
    // The selected navy controls: the toggles on the AC1 pages say their state, and each page's fill goes to the workstream that rebuilds it.
    const navy = ours(entry('Selected navy controls in dark mode (step 23)'))
    for (const piece of ['`aria-pressed`', 'WS04 for `/tournaments`', 'WS05 and WS06 for the tournament page', 'WS09 for the `/clubs` region pills', 'WS10 for `/champions`', '1.17:1']) expect(navy, piece).toContain(piece)
    // What is left on the AC1 pages is named with its workstream, and the wider claim is not made.
    for (const piece of ['`aria-current`', '`aria-expanded`', 'the List and Calendar views', 'the header\'s links', '(WS02)', '(WS14)', '(WS03 deletes the slideshow)', 'the email page\'s three menus']) expect(navy, piece).toContain(piece)
    expect(navy).not.toContain('every such control now says its state')
    for (const name of ['Club colours in dark mode (step 23)', 'A club\'s own colour as words (step 25)']) expect(ours(entry(name)), name).toContain('`clubTextOnDark`')
    // The AC9 entry keeps the words the preview database test reads.
    expect(entry('AC9 live check')).toMatch(/first push[\s\S]*Record the result here/)
    for (const older of ['Done in step 31', 'Done in step 30', 'Done in step 29', 'Done in step 28', 'Done in step 27']) {
      for (const name of [...DONE, ...ANSWERED, ...MET]) expect(ours(entry(name)), `${name}: ${older}`).not.toContain(older)
    }
  })

  it('adds its own follow-ups headed with step 32, and renames or removes none', () => {
    for (const name of NEW) expect(followUps, name).toContain(`- **${name}.**`)
    const later = headings.filter((h) => /\(step (?:3[2-9])[;)]/.test(h))
    expect(later).toHaveLength(NEW.length)
    expect(headings.length - later.length).toBe(172)
    expect(new Set(headings).size).toBe(headings.length)
    // The pages AC1 does not name: 26 routes, none of the nine it names.
    const pages = entry('The pages AC1 does not name (step 32)')
    const routes = new Set([...pages.matchAll(/`(\/[^`]*)`/g)].map((m) => m[1]).filter((r) => !r.includes('.')))
    expect(routes.size).toBe(26)
    for (const named of ['/', '/tournaments', '/tournaments/:id', '/clubs', '/membership', '/scholastic', '/about', '/governance/minutes', '/champions']) expect(routes.has(named), named).toBe(false)
    // What the nine pages draw only for someone signed in waits here too, as the AC1 row says.
    expect(pages).toContain('the states the nine pages draw only for someone signed in')
    const caps = entry('Caps, holds and the family limit at registration (step 32)')
    for (const piece of ['WS06', '`tournament_sections.cap`', '15 minutes', 'up to 9 players', 'up to 8 profiles']) expect(caps, piece).toContain(piece)
    const thin = entry('Pages to thin in WS05, WS06 and WS08 (step 32)')
    for (const piece of ['"Thin pages (step 19)"', '`src/pages/TournamentDetailPage.tsx`', '`src/pages/TournamentManagePage.tsx`', '`ScrollPanel`']) expect(thin, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, step 32: plain language', () => {
  it('keeps the working words, em dashes, any mention of an assistant and the old initials out of what it adds', () => {
    expect(block).not.toBe('')
    expect(checkpoint).not.toBe('')
    expect(tagged.length).toBeGreaterThanOrEqual(30)
    const appended = [...DONE, ...ANSWERED, ...MET].map((name) => ours(entry(name)))
    for (const text of appended) expect(text).not.toBe('')
    const rows = ['AC1', 'K1d', 'AC7', 'AC9', 'K5', 'T1'].map((id) => ours(row(id)) || row(id))
    for (const text of [block, checkpoint, header, ...rows, ...decisions, ...tagged, deviation, ...appended, line('Last updated:')]) {
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(ASSISTANT)
      expect(text).not.toMatch(/\bUSCF\b/)
    }
  })
})

describe('the files of the step', () => {
  it.each([
    'test/a11y/scopes.spec.ts',
    'test/a11y/scopes-edges.spec.ts',
    'test/unit/sweep-fixes.test.tsx',
    'test/unit/sweep-fixes-edges.test.tsx',
    'test/unit/scopes-edges.test.ts',
    'test/unit/redesign-status-step32.test.ts',
    'test/a11y/known-violations.json',
    'src/areas/clubs/clubColors.ts',
  ])('%s has no em dash, no en dash and no reference to a tool that wrote it', (file) => {
    const text = read(file)
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(TOOLS)
    expect(text).not.toMatch(/\bAI\b/)
  })
})

describe('REDESIGN_SPEC.md, the WS01 deviations list', () => {
  const ws01 = spec.split('\n').find((l) => l.startsWith('- WS01:')) ?? ''
  const at = ws01.indexOf('Step 32 ')
  const sentence = at < 0 ? '' : ws01.slice(at)

  it('has the step 32 sentence after step 31\'s, which still ends where it did, as one sentence', () => {
    expect(at).toBeGreaterThan(ws01.indexOf('Step 31 '))
    expect(ws01.slice(0, at)).toMatch(/measured apart from the page's own arrival\. $/)
    expect(sentence.startsWith('Step 32 (recorded in step 32) adds `test/a11y/scopes.spec.ts`')).toBe(true)
    expect(sentence.endsWith('.')).toBe(true)
    expect(sentence.slice(0, -1)).not.toContain('. ')
    expect(sentence.length).toBeGreaterThan(300)
  })

  it('names the matrix, the known list, the stylesheet, the switches, the record test and AC1', () => {
    for (const piece of [
      '`test/a11y/known-violations.json`',
      '`src/index.css`',
      '`newLook`',
      '`themeHeritage`',
      '`test/unit/redesign-status-step32.test.ts`',
      'AC1',
      '`<main>`',
      '`test/a11y/baseline.json` is unchanged',
    ]) expect(sentence, piece).toContain(piece)
    expect(sentence).not.toMatch(DASHES)
    expect(sentence).not.toMatch(ASSISTANT)
    expect(sentence).not.toMatch(BANNED)
  })
})
