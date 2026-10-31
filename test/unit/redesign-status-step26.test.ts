// test/unit/redesign-status-step26.test.ts
//
// REDESIGN_STATUS.md records step 26 (status tags, the gold button, filter
// chips, date blocks and the scroll panel) and REDESIGN_SPEC.md's WS01
// deviation list carries its sentence (the step's acceptance criterion 8).
// The living parts are pinned: the AC5 and AC14 rows name their proofs and
// the AC8 row its added sentence; the step block sits in order and describes
// each component, the judgement calls, the lint, the build and the browser
// runs, with the counts the tree holds; the decisions, deviations (the
// ScrollPanel line naming the table area as step 27's), verify items and
// follow-ups are there; the earlier follow-ups this step closes say so under
// their old names, none is renamed or removed; and the plain-language rules
// hold (no em dash, none of the working words, no mention of an assistant,
// US Chess rather than its old initials).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STATUS_MAP, loadMap } from '../../scripts/codemods/semantic-colours'
import { BADGE_STATUSES, STATUS_LABELS } from '../../src/lib/badgeStatus'

const ROOT = join(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
const spec = readFileSync(join(ROOT, 'docs/redesign/REDESIGN_SPEC.md'), 'utf8')
const fixture = readFileSync(join(ROOT, 'src/pages/fixtures/ScopeFixturePage.tsx'), 'utf8')
const allowlist = (JSON.parse(readFileSync(join(ROOT, 'test/unit/fixtures/raw-colours-allowlist.json'), 'utf8')) as {
  entries: Array<{ file: string; class: string; count: number; reason: string }>
}).entries

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

const HEADING = '### Step 26: status tags, the gold button, filter chips, date blocks and the scroll panel'
const block = between(HEADING, '### Decisions')
const ac5 = line('| AC5 |')
const ac8 = line('| AC8 |')
const ac14 = line('| AC14 |')
const decisions = between('### Decisions', '\n### ').split('\n').filter((l) => l.startsWith('- ') && l.includes('(step 26)'))
const tagged = lines.filter((l) => /\(step 26[;)]/.test(l))
const deviation = bullet('- **Step 26.**')
const verify = between('### Verify items resolved', '### Follow-ups')
const followUps = between('### Follow-ups', '\n## WS02')
const followUpEntries = followUps.split('\n').filter((l) => l.startsWith('- **'))
const headings = followUpEntries.map((l) => l.slice(4, l.indexOf('**', 4)))

/** The status badges the fixture page draws: today's three pills, a tag for every status, and the tags with words of their own. */
const fixtureBadges = (() => {
  const pills = (fixture.match(/<StatusBadge tone=/g) ?? []).length
  const own = (fixture.match(/<StatusBadge status="[a-z]+" on="light">/g) ?? []).length
  return { pills, own, total: pills + BADGE_STATUSES.length + own }
})()

describe('REDESIGN_STATUS.md, step 26: the acceptance rows', () => {
  it('fills the AC5 row for step 26: no longer planned, with its proofs', () => {
    expect(ac5).toMatch(/^\| AC5 \| Every status shows its label in words \| 26 \| /)
    expect(ac5).not.toContain('Planned')
    for (const piece of [
      'test/unit/status-badge.test.tsx',
      'test/unit/status-badge-edges.test.tsx',
      'test/unit/status-dot-newlook.test.tsx',
      'test/unit/status-dot-edges.test.tsx',
      'test/unit/draws-nothing.test.tsx',
      'test/a11y/components.spec.ts',
      'test/a11y/components-edges.spec.ts',
      'src/lib/badgeStatus.ts',
      'src/lib/drawsNothing.ts',
      '`data-status`',
      '`StatusBadgeProps`',
      'test/a11y/baseline.json',
      '`/tournaments`',
      '#737373 on #f5f5f5',
      'Muted `StatusBadge` contrast (step 20)',
    ]) expect(ac5, piece).toContain(piece)
  })

  it('says what counts as no words, and every word StatusDot shows, a closed registration\'s among them', () => {
    expect(ac5).toContain('a fragment holding only those')
    expect(ac5).toContain('a status tag never shows its mark without words')
    // A tone pill draws what it is given, so the row claims no more than the status path keeps.
    expect(ac5).not.toContain('no badge renders empty')
    expect(ac5).toContain('(Registration open, Opening soon, Registration closed, and Coming soon for a status it does not know)')
  })

  it('states the count of [data-status] elements the fixture page draws', () => {
    expect(fixtureBadges).toEqual({ pills: 3, own: 2, total: 13 })
    expect(ac5).toContain(`each of the ${fixtureBadges.total} \`[data-status]\` elements (today's three pills and ten status tags)`)
    expect(ac5).toContain(`each of the eight statuses (${BADGE_STATUSES.slice(0, -1).join(', ')} and ${BADGE_STATUSES.at(-1)})`)
  })

  it('fills the AC14 row for step 26, measured with no reduced motion asked for', () => {
    expect(ac14).toMatch(/^\| AC14 \| The live tag's dot does not move \| 26 \| /)
    expect(ac14).not.toContain('Planned')
    for (const piece of ['test/unit/status-badge.test.tsx', 'test/a11y/components.spec.ts', 'test/a11y/components-edges.spec.ts', '`animation-name`', '`none`', '`getAnimations()`', 'no reduced motion asked for', 'pulse, ping or bounce']) {
      expect(ac14, piece).toContain(piece)
    }
  })

  it('adds one sentence to the AC8 row, since the fixture\'s badges now draw tokens', () => {
    expect(ac8).toMatch(/^\| AC8 \| Switching look on a container causes no layout shift \| 22 \| /)
    expect(ac8).toContain('Since step 26 the fixture also draws a status tag for each of the eight statuses on the status tokens')
    expect(ac8).toContain('(13 badges and five `Button`s)')
    // The switch specs measure the tags' boxes, not their colours, so the row claims the boxes only.
    expect(ac8).toMatch(/the status tags' boxes stay put in every look too\. \|$/)
    expect(ac8).not.toMatch(/their colours follow the look/)
    // The step 22 text stays as it was.
    expect(ac8).toContain('`StatusBadge` still uses fixed Tailwind colours, so colour is measured on the token-backed elements.')
  })
})

describe('REDESIGN_STATUS.md, step 26: the step block', () => {
  it('sits after step 25 and before the Decisions, and the date line names it, after any later step', () => {
    const at = status.indexOf(HEADING)
    expect(at).toBeGreaterThan(status.indexOf('### Step 25:'))
    expect(at).toBeLessThan(status.indexOf('### Decisions'))
    expect(line('Last updated:')).toMatch(/^Last updated: \S+ \(WS01, (?:step (?:2[7-9]|3\d): [^;]+; )*step 26: /)
  })

  it('records each component, the fallback, the fixture page, the judgement calls, the lint, the build and the browser runs', () => {
    for (const part of ['**Files.**', '**StatusBadge.**', '**StatusDot.**', '**The gold button.**', '**FilterChip**', '**DateBlock**', '**ScrollPanel**', '**Browsers that cannot mix colours.**', '**The fixture page.**', '**Judgement calls.**', '**Lint.**', '**Build.**', '**The browser runs.**']) {
      expect(block, part).toContain(part)
    }
    const calls = bullet('- **Judgement calls.**', HEADING)
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
    expect(calls).toContain('K reviews these calls, with those of steps 23 to 25, before `newLook` is turned on')
    for (const piece of ['light tones are kept', 'tile\'s tag', '`on="light"`', '`LcaMark`', '`bg-ok-500`', '24 by 24 pixels', '`zonedParts`', '`known-violations.json`']) {
      expect(calls, piece).toContain(piece)
    }
    expect(block).toMatch(/13 errors and 13 warnings before and after/)
    expect(block).not.toContain('@@')
  })

  it('names every file the step adds, in its Files', () => {
    const files = bullet('- **Files.**', HEADING)
    for (const name of [
      'src/lib/badgeStatus.ts',
      'src/lib/drawsNothing.ts',
      'src/components/ui/filter-chip.tsx',
      'src/components/DateBlock.tsx',
      'src/components/ScrollPanel.tsx',
      'test/unit/status-badge.test.tsx',
      'test/unit/status-badge-edges.test.tsx',
      'test/unit/status-dot-newlook.test.tsx',
      'test/unit/status-dot-edges.test.tsx',
      'test/unit/button-gold.test.tsx',
      'test/unit/button-gold-edges.test.tsx',
      'test/unit/filter-chip.test.tsx',
      'test/unit/filter-chip-edges.test.tsx',
      'test/unit/date-block.test.tsx',
      'test/unit/date-block-edges.test.tsx',
      'test/unit/scroll-panel.test.tsx',
      'test/unit/scroll-panel-edges.test.tsx',
      'test/unit/draws-nothing.test.tsx',
      'test/unit/base-components-scope.test.ts',
      'test/unit/base-components-types.test.ts',
      'test/unit/redesign-status-step26.test.ts',
      'test/a11y/components.spec.ts',
      'test/a11y/components-edges.spec.ts',
    ]) expect(files, name).toContain(`\`${name}\``)
  })

  it('names every test whose header says it is of step 26 in its Files, and the edge, scope and type tests among the files beyond the step\'s list', () => {
    const files = bullet('- **Files.**', HEADING)
    const ofStep = ['test/unit', 'test/a11y'].flatMap((dir) =>
      readdirSync(join(ROOT, dir))
        .filter((name) => /\.(test|spec)\.tsx?$/.test(name))
        .map((name) => `${dir}/${name}`)
        .filter((path) => readFileSync(join(ROOT, path), 'utf8').split('\n').slice(0, 25).join('\n').includes('step 26')),
    )
    expect(ofStep.length).toBeGreaterThanOrEqual(19)
    for (const path of ofStep) expect(files, path).toContain(`\`${path}\``)
    const beyond = bullet('  - Files beyond the step\'s list:', '- **Step 26.**')
    for (const path of [
      'src/lib/drawsNothing.ts',
      'test/unit/status-badge-edges.test.tsx',
      'test/unit/status-dot-edges.test.tsx',
      'test/unit/button-gold-edges.test.tsx',
      'test/unit/filter-chip-edges.test.tsx',
      'test/unit/date-block-edges.test.tsx',
      'test/unit/scroll-panel-edges.test.tsx',
      'test/unit/base-components-scope.test.ts',
      'test/unit/base-components-types.test.ts',
      'test/unit/draws-nothing.test.tsx',
      'test/a11y/components-edges.spec.ts',
    ]) expect(beyond, path).toContain(`\`${path}\``)
  })

  it('records the closed registration\'s words beside StatusDot\'s others, the header ScrollPanel leaves out, and its scroll padding', () => {
    const dot = bullet('- **StatusDot.**', HEADING)
    for (const piece of ['Registration open, Opening soon, Registration closed, and Coming soon for a status it does not know', '`migrations/0005_email_registration_support.sql`', 'still "Coming soon"']) {
      expect(dot, piece).toContain(piece)
    }
    const panel = bullet('- **ScrollPanel**', HEADING)
    expect(panel).toContain('a header that draws nothing')
    // A control the keyboard moves to is scrolled out from under the header (review of step 26).
    for (const piece of ['scroll padding', 'WCAG 2.4.11', 'Shift+Tab']) expect(panel, piece).toContain(piece)
    const calls = bullet('- **Judgement calls.**', HEADING)
    expect(calls).toContain('`drawsNothing`')
    expect(calls).toContain('the header\'s height is read as it is drawn')
    expect(line('- **ScrollPanel on the long screens (step 26).**')).toContain('Shift+Tab')
  })

  it('gives the default words of every status as src/lib/badgeStatus.ts holds them', () => {
    const calls = bullet('- **Judgement calls.**', HEADING)
    const words = BADGE_STATUSES.map((s) => STATUS_LABELS[s])
    expect(calls).toContain(`The default words, kept in one module: ${words.slice(0, -1).join(', ')} and ${words.at(-1)}.`)
  })

  it('states the counts the allowlist and the status map hold now', () => {
    // WS02 steps 5 and 6 added two entries each, for the About menu's gold and
    // the Menu sheet's, and WS02 step 7 one, for the tab bar's gold line, which
    // are not WS01's: the figures this record states are the allowlist less
    // those, named beside them.
    const WS02_FILES = ['src/components/layout/AboutMenu.tsx', 'src/components/layout/BottomTabs.tsx', 'src/components/layout/MobileMenu.tsx']
    expect(allowlist.filter((e) => WS02_FILES.includes(e.file)).map((e) => `${e.class} ${e.count}`).sort()).toEqual(['bg-[#f3eedc] 1', 'bg-[#fbfaf6] 1', 'border-t-[#866a1e] 1', 'text-[#705718] 1', 'text-[#866a1e] 1'])
    const ws01 = allowlist.filter((e) => !WS02_FILES.includes(e.file))
    const uses = ws01.reduce((n, e) => n + e.count, 0)
    expect([ws01.length, uses]).toEqual([35, 49])
    expect(verify).toContain(`from 43 entries and 57 uses to ${ws01.length} and ${uses}`)
    const badge = loadMap(STATUS_MAP).keep.filter((k) => k.file === 'src/components/StatusBadge.tsx')
    expect(badge).toHaveLength(14)
    for (const k of badge) expect(k.contains, k.class).toBeDefined()
    expect(verify).toContain('14 of them StatusBadge\'s, as before, every one of StatusBadge\'s now by its one string')
  })

  it('reports the build before and after, and the browser runs as measured', () => {
    const build = bullet('- **Build.**', HEADING)
    expect(build).toMatch(/CSS 122,025 and [\d,]+ bytes/)
    expect(build).toMatch(/JavaScript 2,568,391 and [\d,]+ bytes/)
    expect(build).toContain('`npm run check:bundle` finds no zod')
    const runs = bullet('- **The browser runs.**', HEADING)
    for (const route of ['/', '/tournaments', '/membership']) expect(runs).toContain(`axe in dark mode on ${route}:`)
    expect(runs).toContain('`test/a11y/components-edges.spec.ts`')
    expect(block).toContain('"Baseline matches: no colour or font changed."')
    // The last run, after the fixes the two reviews asked for, is the one quoted, with both new specs in it.
    expect(block).toContain('193 passed and 38 skipped (125 and 30 before;')
    expect(block).toContain('`components.spec.ts` adds 14 tests that run on `a11y-on` and 13 on `a11y-off`')
    expect(block).toContain('`components-edges.spec.ts` adds 23 that run on `a11y-on` and 18 on `a11y-off`')
    // The runs before it are recorded, the ones that failed with their cause.
    expect(block).toContain('Five full runs were made before it.')
    expect(block).toContain('`SQLITE_BUSY`')
  })

  it('states the unit counts the tree holds', () => {
    const checks = bullet('- Checks:', HEADING)
    expect(checks).toContain('unit 3507 tests in 131 files (3117 in 115 before;')
    expect(checks).toContain('integration 790 in 58 (unchanged)')
  })
})

describe('REDESIGN_STATUS.md, step 26: decisions, deviations, verify items and follow-ups', () => {
  it('records the status tag, dot, gold button, component and tint decisions', () => {
    expect(decisions).toHaveLength(5)
    const text = decisions.join('\n')
    for (const piece of ['`<StatusBadge status="..." on="light">`', 'src/lib/badgeStatus.ts', '`<Button variant="gold">`', '`GOLD_BUTTON`', '`FilterChip`', '`DateBlock`', '`ScrollPanel`', '`formatDate`', '`#rrggbbaa`', '`ADMIN_SCROLL`']) {
      expect(text, piece).toContain(piece)
    }
  })

  it('keeps the planned ScrollPanel line under its heading, naming the table area as step 27\'s', () => {
    const planned = line('- **ScrollPanel (step 26).**')
    expect(planned).toContain('step 27\'s')
    expect(planned).toContain('`Table`')
    expect(planned).toContain('Done in step 26 for the scroll panel')
    expect(planned).toContain('WS06 and WS08')
  })

  it('lists the step 26 deviations from the brief and the plan', () => {
    for (const piece of ['`ScrollPanel` is not in the brief', 'step 27\'s', 'status prop', '`GOLD_BUTTON`', 'tile\'s tag', '`LcaMark`', '`test/a11y/components.spec.ts`', '`test/a11y/scopes.spec.ts`', '`DateBlock`', 'cannot mix colours', 'Files beyond the step\'s list']) {
      expect(deviation, piece).toContain(piece)
    }
  })

  it('resolves each verify item the step was given, and the ones it found', () => {
    for (const name of [
      'StatusBadge today',
      'Pulsing elements',
      '`ADMIN_SCROLL`',
      'Two functions named formatDate',
      '`data-status` on the fixture page',
      'The gold guard\'s line pins',
      'What the status path writes',
      'Where the label table lives',
      'The checker on the fixture page',
      '`GOLD_BUTTON` and the Button',
      'StatusDot on `/tournaments`',
      'The boards',
      'Counts',
      'Records',
      'Lint, build and the browser runs',
    ]) expect(verify, name).toContain(`- **${name} (step 26).**`)
    // The date line still names the steps the older record tests look for in the file's first 400 characters.
    for (const step of ['step 18', 'step 21', 'step 23', 'step 26']) expect(status.slice(0, 400), step).toContain(step)
  })

  it('closes the follow-ups it meets under their old names, and leaves the muted pair open', () => {
    for (const name of [
      'Dark mode on pages not converted yet (step 21)',
      'Tokens with no reader yet (step 21)',
      'Selected navy controls in dark mode (step 23)',
      'StatusBadge\'s tones (step 24)',
      'What the gold guard\'s reading leaves out (step 25)',
    ]) {
      const entry = line(`- **${name}.**`)
      expect(entry, name).toContain('Done in step 26')
      expect(followUps, name).toContain(entry)
    }
    const muted = line('- **Muted `StatusBadge` contrast (step 20).**')
    expect(muted).toContain('test/a11y/components.spec.ts')
    expect(muted).toContain('Still open for the step 32 sweep')
    expect(muted).not.toContain('Done in step 26')
    for (const name of ['Classes only docs and tests name reach the CSS (step 23)', 'Gold grounds in dark mode (step 23)', 'The a11y servers share one database (step 23)']) {
      expect(line(`- **${name}.**`), name).toContain('Step 26')
    }
    const shared = line('- **The a11y servers share one database (step 23).**')
    expect(shared).toContain('`/tournaments/fx-t-done`')
    expect(shared).not.toContain('Done in step 26')
  })

  it('lists what it leaves as follow-ups headed with step 26', () => {
    for (const name of [
      'K reviews the step 26 judgement calls',
      'ScrollPanel on the long screens',
      'HomePage\'s own StatusDot',
      'The Scholastic page\'s pill',
      'The LCA tag\'s rook',
      'FilterChip in the Tournaments filters',
      'Date ranges in a DateBlock',
      'A status tag on a navy band',
    ]) expect(followUps, name).toContain(`- **${name} (step 26).**`)
    expect(line('- **ScrollPanel on the long screens (step 26).**')).toContain('WS06 and WS08')
    expect(line('- **HomePage\'s own StatusDot (step 26).**')).toContain('WS03')
  })

  it('removes none: the 124 follow-ups before it are all still counted, beside the 8 it adds, and none says it was done in step 25 that did not', () => {
    const ofStep = (n: number) => headings.filter((h) => new RegExp(`\\(step ${n}[;)]`).test(h))
    const later = headings.filter((h) => /\(step (?:2[6-9]|3\d)[;)]/.test(h))
    expect(ofStep(26)).toHaveLength(8)
    expect(headings.length - later.length).toBe(124)
    expect(new Set(headings).size).toBe(headings.length)
    expect(followUpEntries.filter((l) => l.includes('Done in step 26'))).toHaveLength(5)
    expect(followUpEntries.filter((l) => l.includes('Done in step 25'))).toHaveLength(3)
  })
})

describe('REDESIGN_STATUS.md, step 26: plain language', () => {
  it('keeps the working words, em dashes, any mention of an assistant and the old initials out of what it adds', () => {
    expect(block).not.toBe('')
    for (const text of [block, ac5, ac8, ac14, ...decisions, ...tagged, deviation]) {
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(ASSISTANT)
      expect(text).not.toMatch(/\bUSCF\b/)
    }
  })
})

describe('REDESIGN_SPEC.md, the WS01 deviations list', () => {
  const ws01 = spec.split('\n').find((l) => l.startsWith('- WS01:')) ?? ''
  const at = ws01.indexOf('Step 26 ')
  const sentence = at < 0 ? '' : ws01.slice(at, ws01.indexOf('. ', at) < 0 ? undefined : ws01.indexOf('. ', at) + 1)

  it('has the step 26 sentence after step 25\'s', () => {
    expect(at).toBeGreaterThan(ws01.indexOf('Step 25 '))
    expect(sentence.length).toBeGreaterThan(200)
  })

  it('names the scroll panel and the table area, the status prop, the dot, the gold variant, the chip, the date block, the fallback and the browser test', () => {
    for (const piece of ['`ScrollPanel`', 'step 27', 'WS06 and WS08', '`StatusBadge`', 'status prop', 'src/lib/badgeStatus.ts', '`StatusDot`', '`GOLD_BUTTON`', '`FilterChip`', '`DateBlock`', 'cannot mix colours', '`test/a11y/components.spec.ts`', 'fixture page']) {
      expect(sentence, piece).toContain(piece)
    }
    expect(sentence).not.toMatch(DASHES)
    expect(sentence).not.toMatch(ASSISTANT)
    expect(sentence).not.toMatch(BANNED)
  })
})
