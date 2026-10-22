// test/unit/redesign-status-step27.test.ts
//
// REDESIGN_STATUS.md records step 27 (chess data, result cells and the table
// primitives) and REDESIGN_SPEC.md's WS01 deviation list carries its
// sentence. The living parts are pinned: the AC6 row names its proofs and the
// seed's figures as the browser test reads them, and the AC8 row its added
// sentence before the previous step's; the step block sits in order and
// describes the cell, the primitives, the two tables, the pages, the fixture
// page, the printed crosstable, the judgement calls, the lint, the build and
// the browser runs, with the counts the tree holds; the decisions are there,
// and the lines planned for this step (the ScrollPanel line and the White and
// Black markers line) keep their words with Done in step 27 added, as does
// the previous step's deviation about the table area; the verify items and
// follow-ups are there, none renamed or removed; and the plain-language rules
// hold (no em dash, none of the working words, no mention of an assistant,
// US Chess rather than its old initials).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
const spec = readFileSync(join(ROOT, 'docs/redesign/REDESIGN_SPEC.md'), 'utf8')
const fixture = readFileSync(join(ROOT, 'src/pages/fixtures/ScopeFixturePage.tsx'), 'utf8')

const BANNED = /\b(slice|builder|scout|planner|recorder|manifest|subagent|workflow)\b|the lead/i
const ASSISTANT = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** An en dash or an em dash, written by code so this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)

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

const HEADING = '### Step 27: chess data, result cells and the table primitives'
const block = between(HEADING, '### Decisions')
const ac6 = line('| AC6 |')
const ac8 = line('| AC8 |')
const decisions = between('### Decisions', '\n### ').split('\n').filter((l) => l.startsWith('- ') && l.includes('(step 27)'))
const tagged = lines.filter((l) => /\(step 27[;)]/.test(l))
const deviation = bullet('- **Step 27.**')
const verify = between('### Verify items resolved', '### Follow-ups')
const followUps = between('### Follow-ups', '\n## WS02')
const followUpEntries = followUps.split('\n').filter((l) => l.startsWith('- **'))
const headings = followUpEntries.map((l) => l.slice(4, l.indexOf('**', 4)))

describe('REDESIGN_STATUS.md, step 27: the acceptance rows', () => {
  it('fills the AC6 row for step 27: no longer planned, with its proofs', () => {
    expect(ac6).toMatch(/^\| AC6 \| Standings and crosstables show ½ in tabular figures \| 27 \| /)
    expect(ac6).not.toContain('Planned')
    for (const piece of [
      'test/unit/standings-format.test.tsx',
      'test/unit/fixtures/chess-tables-today.ts',
      'test/unit/result-cell.test.tsx',
      'test/unit/table-primitives.test.tsx',
      'test/a11y/chess-data.spec.ts',
      '`formatScore`',
      '`font-mono`',
      '`tabular-nums`',
      '`font-variant-numeric`',
      '`/tournaments/fx-t-done/pairings`',
      '`/tournaments/fx-t-done/print?what=standings`',
      '`?what=crosstable`',
      'test/a11y/baseline.json',
      '`scope="col"`',
      '`a12c74e`',
    ]) expect(ac6, piece).toContain(piece)
  })

  it('gives the seed\'s figures as the browser test reads them on each build, and the render test\'s', () => {
    expect(ac6).toContain('on `a11y-on` the scores read 2½, 2, 1½, 1½ and ½')
    expect(ac6).toContain('on `a11y-off` the same cells read 2.5, 2, 1.5, 1.5 and 0.5')
    expect(ac6).toContain('3½, 13½, ½, 7½ and 10½, never with a point')
    expect(ac6).toContain('"Geist Mono Variable", ui-monospace')
  })

  it('adds one sentence to the AC8 row before step 26\'s, which still ends the row', () => {
    expect(ac8).toContain('Since step 27 the fixture also draws a sample crosstable in a bounded box with pinned columns')
    expect(ac8.indexOf('Since step 27')).toBeLessThan(ac8.indexOf('Since step 26'))
    expect(ac8).toMatch(/the status tags' boxes stay put in every look too\. \|$/)
  })
})

describe('REDESIGN_STATUS.md, step 27: the step block', () => {
  it('sits after step 26 and before the Decisions, and the date line names it, after any later step', () => {
    const at = status.indexOf(HEADING)
    expect(at).toBeGreaterThan(status.indexOf('### Step 26:'))
    expect(at).toBeLessThan(status.indexOf('### Decisions'))
    expect(line('Last updated:')).toMatch(/^Last updated: \S+ \(WS01, (?:step (?:2[8-9]|3\d): [^;]+; )*step 27: /)
    // The older record tests look for these steps in the file's first 400 characters.
    for (const step of ['step 18', 'step 21', 'step 23', 'step 26', 'step 27']) expect(status.slice(0, 400), step).toContain(step)
  })

  it('records the cell, the primitives, the tables, the pages, the fixture page, printing, the judgement calls, the lint, the build and the browser runs', () => {
    for (const part of ['**Files.**', '**ResultCell**', '**The table primitives**', '**The two tables.**', '**The pages.**', '**The fixture page.**', '**Printing.**', '**Judgement calls.**', '**Lint.**', '**Build.**', '**The browser runs.**']) {
      expect(block, part).toContain(part)
    }
    const calls = bullet('- **Judgement calls.**', HEADING)
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
    expect(calls).toContain('K reviews these calls, with those of steps 23 to 26, before `newLook` is turned on')
    for (const piece of ['Two columns are pinned', '`--row-tint`', 'tone shade words', 'no mark', '`aria-label`', 'sans face', '12px', 'on paper', 'named region', '`bounded`', 'live scope']) {
      expect(calls.toLowerCase(), piece).toContain(piece.toLowerCase())
    }
    expect(block).toMatch(/13 errors and 13 warnings before and after/)
  })

  it('describes the cell as the board draws it, its marks as drawn shapes and its words for a screen reader', () => {
    const cell = bullet('- **ResultCell**', HEADING)
    for (const piece of ['24px high, a 6px radius, at least 58px wide, a 4px gap and 13px figures', 'inline SVG circles', 'a 1.5px ring for White and a filled disc for Black', '"Won with White against 17"', 'ARIA 1.2', '`ResultLegend`']) {
      expect(cell, piece).toContain(piece)
    }
  })

  it('describes each new prop of the primitives as opt-in, and the measuring', () => {
    const table = bullet('- **The table primitives**', HEADING)
    for (const piece of ['`TableRowHeader`', '`scope="row"`', '`stickyFirst`', '`border-separate`', '`bg-surface`', '`ResizeObserver`', '`label`', '`bounded`', '`containerClassName`', 'WCAG 2.4.11', '`ADMIN_SCROLL`']) {
      expect(table, piece).toContain(piece)
    }
    expect(table).toContain('gets today\'s markup to the letter but for `scope="col"`')
  })

  it('names every file the step adds, in its Files', () => {
    const files = bullet('- **Files.**', HEADING)
    for (const name of [
      'src/components/ResultCell.tsx',
      'test/unit/result-cell.test.tsx',
      'test/unit/standings-format.test.tsx',
      'test/unit/fixtures/chess-tables-today.ts',
      'test/unit/table-primitives.test.tsx',
      'test/unit/redesign-status-step27.test.ts',
      'test/a11y/chess-data.spec.ts',
      'test/unit/chess-data-edges.test.tsx',
      'test/unit/result-cell-tones.test.tsx',
      'test/a11y/chess-data-edges.spec.ts',
    ]) expect(files, name).toContain(`\`${name}\``)
  })

  it('names every test whose header says it is of step 27 in its Files, and the files beyond the step\'s list in the deviation', () => {
    const files = bullet('- **Files.**', HEADING)
    const ofStep = ['test/unit', 'test/a11y'].flatMap((dir) =>
      readdirSync(join(ROOT, dir))
        .filter((name) => /\.(test|spec)\.tsx?$/.test(name))
        .map((name) => `${dir}/${name}`)
        // Of step 27, not a test of an earlier step that names something as step 27's.
        .filter((path) => /\bstep 27\b(?!'s)/.test(readFileSync(join(ROOT, path), 'utf8').split('\n').slice(0, 25).join('\n'))),
    )
    expect(ofStep.length).toBeGreaterThanOrEqual(5)
    for (const path of ofStep) expect(files, path).toContain(`\`${path}\``)
    const beyond = bullet('  - Files beyond the step\'s list:', '- **Step 27.**')
    for (const path of [
      'src/pages/fixtures/ScopeFixturePage.tsx',
      'docs/redesign/REDESIGN_SPEC.md',
      'test/unit/table-primitives.test.tsx',
      'test/unit/fixtures/chess-tables-today.ts',
      'test/unit/geist-mono-glyphs.test.ts',
      'test/unit/redesign-status-step27.test.ts',
      'test/unit/chess-data-edges.test.tsx',
      'test/unit/result-cell-tones.test.tsx',
      'test/a11y/chess-data-edges.spec.ts',
      'test/a11y/print-look.spec.ts',
      'test/a11y/seeded-data.spec.ts',
    ]) expect(beyond, path).toContain(`\`${path}\``)
  })

  it('says where the fixture page draws the sample crosstable, and that the gold guard\'s lines stay', () => {
    const page = bullet('- **The fixture page.**', HEADING)
    expect(page).toContain('(114 to 116, 213, 217 and 218)')
    for (const at of [114, 115, 116, 213, 217, 218]) expect(fixture.split('\n')[at - 1], String(at)).toContain('<StatusBadge')
    expect(fixture).toMatch(/<ChessData \/>\n {4}<\/>\n {2}\)\n\}/)
    expect(page).toContain('"Sample crosstable"')
  })

  it('records where the printed crosstable stops fitting, and that nothing is added outside the new look', () => {
    const print = bullet('- **Printing.**', HEADING)
    expect(print).toContain('740 pixels')
    expect(print).toContain('stops fitting at eight rounds')
    expect(print).toContain('still fits at 12')
    expect(print).toContain('`src/index.css` is unchanged')
  })

  it('reports the build before and after, and the browser runs as measured', () => {
    const build = bullet('- **Build.**', HEADING)
    expect(build).toMatch(/CSS 123,531 and [\d,]+ bytes/)
    expect(build).toMatch(/JavaScript 2,571,529 and [\d,]+ bytes/)
    expect(build).toContain('115,394 bytes before')
    expect(build).toContain('`npm run check:bundle` finds no zod')
    const runs = bullet('- **The browser runs.**', HEADING)
    for (const piece of ['`scrollable-region-focusable`', '`SQLITE_BUSY`', 'stops fitting at 8', '½-½', '1/2-1/2']) expect(runs, piece).toContain(piece)
    expect(block).toContain('"Baseline matches: no colour or font changed."')
    expect(block).toContain('260 passed and 51 skipped (193 and 38 before;')
    expect(block).toContain('`chess-data.spec.ts` adds 24 tests that run on `a11y-on` and 18 on `a11y-off`')
    expect(block).toContain('`chess-data-edges.spec.ts` adds 15 that run on `a11y-on` and 10 on `a11y-off`')
    // The print rule that lost to the pinning selectors on paper, and what was done about it.
    expect(runs).toContain('written important')
    for (const route of ['/', '/tournaments', '/membership']) expect(block).toContain(`axe in dark mode on ${route}:`)
  })

  it('states the unit and integration counts the tree holds', () => {
    const checks = bullet('- Checks:', HEADING)
    expect(checks).toMatch(/unit \d{4} tests in 137 files \(3507 in 131 before;/)
    expect(checks).toContain('integration 790 in 58 (unchanged)')
  })
})

describe('REDESIGN_STATUS.md, step 27: decisions, deviations, verify items and follow-ups', () => {
  it('records the chess data and table decisions, and marks the White and Black markers done', () => {
    expect(decisions).toHaveLength(3)
    const text = decisions.join('\n')
    for (const piece of ['`formatScore`', '`ResultCell`', '`scope="col"`', '`TableRowHeader`', '`stickyFirst`', '`--row-tint`', '`bounded`', '`label`', 'Done in step 27']) {
      expect(text, piece).toContain(piece)
    }
    const markers = line('- **White and Black markers (step 27)**')
    // The planned words stay, and what was built follows them.
    expect(markers).toContain('- **White and Black markers (step 27)** in result cells are drawn as small images, because the Geist Mono file has no ○ or ● characters. Done in step 27:')
    for (const piece of ['inline SVG circles', 'a 1.5px ring for White and a filled disc for Black', 'hidden from screen readers', 'test/unit/geist-mono-glyphs.test.ts']) expect(markers, piece).toContain(piece)
  })

  it('keeps the ScrollPanel decision word for word, with the table area marked done after it', () => {
    const planned = line('- **ScrollPanel (step 26).**')
    expect(planned).toContain('The bounded table scroll area with its sticky header, which this line also named, is step 27\'s, as an optional prop of `Table` (`src/components/ui/table.tsx`).')
    expect(planned).toContain('Done in step 26 for the scroll panel')
    expect(planned).toMatch(/\(see Follow-ups\)\. Done in step 27 for the table area: the `bounded` prop of `Table`/)
  })

  it('keeps step 26\'s deviation about the table area word for word, with Done in step 27 after it', () => {
    const step26 = bullet('- **Step 26.**')
    expect(step26).toContain('The plan also named a bounded table scroll area for this step; that area, with its sticky header, is step 27\'s, an optional prop of `Table`. Done in step 27: the `bounded` prop of `Table`')
  })

  it('lists the step 27 deviations from the brief and the plan', () => {
    for (const piece of ['`scope="col"`', 'read together', '`label`', '`containerClassName`', '`stickyFirst` takes 2', 'hidden words', 'no mark', 'WS08', '`/tournaments/fx-t-done`', 'snapshot', '`--font-mono-face`', 'step 30', 'Files beyond the step\'s list']) {
      expect(deviation, piece).toContain(piece)
    }
  })

  it('resolves both verify items it was given, and the ones it found', () => {
    for (const name of [
      '3.5 today',
      'Marker glyph coverage',
      'The table primitives\' callers',
      'The first column',
      'Score sites',
      'Half points elsewhere',
      'Colour today',
      'The record\'s promise of the markers',
      'Where AC6 is proved',
      'The baseline',
      'The browser pins',
      'The fixture page',
      'The unit pins',
      'The checker on the chess pages',
      'Printing',
      'Records',
      'Lint, build and the browser runs',
      'Counts',
    ]) expect(verify, name).toContain(`- **${name} (step 27).**`)
    const glyphs = line('- **Marker glyph coverage (step 27).**')
    for (const piece of ['U+00BD', 'U+25CB', 'U+25CF', 'symbols2', 'Libre Caslon Display and Source Serif 4 are not installed']) expect(glyphs, piece).toContain(piece)
    const today = line('- **3.5 today (step 27).**')
    for (const piece of ['line 11', 'line 9', '`tabular-nums`', 'line 85', 'em dash']) expect(today, piece).toContain(piece)
  })

  it('lists what it leaves as follow-ups headed with step 27, and adds its sentences to the open ones it meets', () => {
    for (const name of [
      'K reviews the step 27 judgement calls (step 27)',
      'The US Chess report\'s total (step 27; older than the step)',
      'The print page\'s half scores of 10 and more (step 27; older than the step)',
      'One standings and crosstable component (step 27)',
      'The heritage faces\' glyphs (step 27)',
      'The baseline sampler waits for content (step 27)',
      'Header cells in the other tables (step 27; older than the step)',
      'Shorthand in the chess tables\' headers (step 27; older than the step)',
      'Dashes in the pairings list (step 27; older than the step)',
    ]) expect(followUps, name).toContain(`- **${name}.**`)
    expect(line('- **The US Chess report\'s total (step 27; older than the step).**')).toContain('WS08')
    // Today's formatter on the print page, kept with newLook off, and K's choice about it.
    const halves = line('- **The print page\'s half scores of 10 and more (step 27; older than the step).**')
    for (const piece of ['10.5 prints as 1½', '`formatScore` writes 10½', 'K decides', 'test/unit/chess-data-edges.test.tsx']) expect(halves, piece).toContain(piece)
    expect(line('- **One standings and crosstable component (step 27).**')).toContain('WS07')
    expect(line('- **The heritage faces\' glyphs (step 27).**')).toContain('Step 30')
    expect(line('- **The baseline sampler waits for content (step 27).**')).toContain('step 32')
    for (const name of ['Classes only docs and tests name reach the CSS (step 23)', 'The a11y servers share one database (step 23)', 'What printing leaves (step 24)']) {
      expect(line(`- **${name}.**`), name).toContain('Step 27')
    }
    // Still open: the step adds to them and closes none.
    expect(line('- **The a11y servers share one database (step 23).**')).not.toContain('Done in step 27')
  })

  it('removes none: the 132 follow-ups before it are all still counted, beside the 9 it adds, and no entry says done in a step that did not do it', () => {
    const ofStep = (n: number) => headings.filter((h) => new RegExp(`\\(step ${n}[;)]`).test(h))
    const later = headings.filter((h) => /\(step (?:2[7-9]|3\d)[;)]/.test(h))
    expect(ofStep(27)).toHaveLength(9)
    expect(headings.length - later.length).toBe(132)
    expect(new Set(headings).size).toBe(headings.length)
    expect(followUpEntries.filter((l) => l.includes('Done in step 27'))).toHaveLength(0)
    expect(followUpEntries.filter((l) => l.includes('Done in step 26'))).toHaveLength(5)
    expect(followUpEntries.filter((l) => l.includes('Done in step 25'))).toHaveLength(3)
  })
})

describe('REDESIGN_STATUS.md, step 27: plain language', () => {
  it('keeps the working words, em dashes, any mention of an assistant and the old initials out of what it adds', () => {
    expect(block).not.toBe('')
    for (const text of [block, ac6, ac8, ...decisions, ...tagged, deviation]) {
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(ASSISTANT)
      expect(text).not.toMatch(/\bUSCF\b/)
    }
  })
})

describe('REDESIGN_SPEC.md, the WS01 deviations list', () => {
  const ws01 = spec.split('\n').find((l) => l.startsWith('- WS01:')) ?? ''
  const at = ws01.indexOf('Step 27 ')
  const end = ws01.indexOf('. ', at)
  const sentence = at < 0 ? '' : ws01.slice(at, end < 0 ? undefined : end + 1)

  it('has the step 27 sentence after step 26\'s', () => {
    expect(at).toBeGreaterThan(ws01.indexOf('Step 26 '))
    expect(sentence.length).toBeGreaterThan(200)
    expect(sentence.startsWith('Step 27 (recorded in step 27) adds `ResultCell`')).toBe(true)
  })

  it('names the result cell, the table props, formatScore, the two tables, the pages and the browser test', () => {
    for (const piece of ['`ResultCell`', '`src/components/ResultCell.tsx`', '`Table`', '`src/components/ui/table.tsx`', '`scope="col"`', '`TableRowHeader`', '`stickyFirst`', '`label`', '`bounded`', '`formatScore`', '`Crosstable`', '`StandingsTable`', '½-½', 'WS08', 'fixture page', '`test/a11y/chess-data.spec.ts`']) {
      expect(sentence, piece).toContain(piece)
    }
    expect(sentence).not.toMatch(DASHES)
    expect(sentence).not.toMatch(ASSISTANT)
    expect(sentence).not.toMatch(BANNED)
  })
})
