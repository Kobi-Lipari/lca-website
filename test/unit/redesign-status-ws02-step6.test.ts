// test/unit/redesign-status-ws02-step6.test.ts
//
// REDESIGN_STATUS.md records WS02 step 6, the first of checkpoint F: the
// Menu sheet, the tablet header and the phone's app bar, with the chrome
// on. Like the record tests of WS02's first five steps, this file reads
// only the WS02 section and the lines the step wrote outside its block (the
// Status, PR and date lines, the sentences it added to eight map items and
// to one older follow-up, and the Checkpoint E section's first paragraph,
// written once checkpoint E had merged), never every table row or heading
// of the file. Pinned here: the Status and PR lines in forms the next steps
// keep; the date line's parts; the map; the step's block with every part
// and every file; the decisions, deviations, verify items and follow-ups,
// each with its tag and in its place; the plain-language rules over all of
// it; and, checked against the files they describe, the record's claims:
// the new files, the sheet's entry in the gold fixture, and the figures it
// states in more than one place, which must agree. It reads no switch, no
// answer of the browser tests' helper and no source text a later step is
// named to change, so K turning a switch on, or the tab bar of the next
// step, fails nothing here.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')
const lines = status.split('\n')

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
const UNFILLED = new RegExp(`${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|\\b(${['LI' + 'NT', 'BUI' + 'LD', 'BROW' + 'SER', 'CHE' + 'CKS', 'GR' + 'EP', 'CSS' + 'GROWTH', 'RELOAD' + 'TESTS', 'RECORD' + 'TESTS', 'SETUP' + 'TESTS', 'FEATURES' + 'TESTS', 'STEP32' + 'TESTS'].join('|')})\\b`)

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
const line = (start: string) => lines.find((l) => l.startsWith(start)) ?? ''
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
const TAG = '(WS02 step 6).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
/** What this step added to an older line: from `from` to the end of the line. */
const closing = (entry: string, from: string) => (entry.includes(from) ? entry.slice(entry.indexOf(from)) : '')

const ws02 = between(status, '## WS02: Information architecture and navigation', '\n## WS03:')
/** A part of the WS02 section, from its heading to the next: the heading as a line of its own, since a sentence may name one in backticks. */
const part = (heading: string) => {
  const at = ws02.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws02.slice(at + 1), heading, '\n### ')
}
const STEP = '### WS02 step 6: the Menu sheet, the tablet header and the app bar'
const CHECKPOINT = '### Checkpoint E: WS02 steps 1 to 5'
const block = part(STEP)
const checkpoint = part(CHECKPOINT)
/** The Checkpoint E section's first paragraph, which this step wrote once checkpoint E had merged. */
const checkpointOpening = checkpoint.split('\n')[2] ?? ''
const map = part('### WS02 map: what proves each acceptance criterion and decision')
const decisions = part('### WS02 decisions')
const deviations = part('### WS02 deviations from the brief')
const verify = part('### WS02 verify items resolved')
const followUps = between(ws02, '### WS02 follow-ups', '\n## ')
const statusLine = ws02.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = ws02.split('\n').find((l) => l.startsWith('**PR:**')) ?? ''
const dateLine = line('Last updated:')
/** WS02's part of the date line, which the steps of WS02 write. */
const datePart = dateLine.slice(dateLine.indexOf('; WS02, ') + 2)
/** The block's closing line of checks; older blocks have one each, so it is read from the block alone. */
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItems = entries(map)
const mapItem = (id: string) => mapItems.find((l) => l.startsWith(`- **${id}.**`)) ?? ''

/** The map items this step built a part of, each with the planned step it keeps as its last words. */
const BUILT: ReadonlyArray<readonly [string, number]> = [
  ['AC3', 7], ['AC6', 7], ['AC15', 5], ['AC16', 7], ['AC21', 7], ['D1', 5], ['Phone rulings 1.2', 7], ['D16', 7],
]
/** WS02 step 5's follow-up this step closes, and the two the review of WS02 step 5 handed it. */
const STAND_IN = entries(followUps).find((l) => l.startsWith('- **The tablet header and the app bar take the stand-in\'s place (WS02 step 5).**')) ?? ''
const CARRIED = ['From WS02 step 5: the header\'s own error boundary (WS02 step 6).', 'From WS02 step 5: Log in on the password pages (WS02 step 6).']

/** Everything this step wrote, each piece on its own. */
const written = [
  block, checkpointOpening, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), statusLine, prLine, datePart,
  ...BUILT.map(([id]) => closing(mapItem(id), 'Built in step 6:')), closing(STAND_IN, 'Done in WS02 step 6:'),
]
/** The same, with what sits in backticks taken out, since code is not prose. */
const prose = written.map((text) => text.replace(/`[^`\n]*`/g, '``'))

/** The spec this step adds, with its count in each project. */
const NEW_SPECS = ['test/a11y/nav-bars-edges.spec.ts']
/** The files this step adds: the parts and their tests, then the tests of the bars' edges, a fixture among them, and the new spec. */
const NEW_FILES = [
  'src/components/layout/headerParts.ts', 'src/components/layout/MobileAppBar.tsx', 'src/components/layout/MobileMenu.tsx',
  'src/components/layout/OnDemand.tsx', 'test/unit/mobile-app-bar.test.tsx', 'test/unit/mobile-menu.test.tsx',
  'test/unit/tablet-header.test.tsx', 'test/unit/on-demand.test.tsx', 'test/unit/redesign-status-ws02-step6.test.ts',
  'test/unit/menu-sheet-edges.test.tsx', 'test/unit/on-demand-edges.test.tsx', 'test/unit/chrome-bars-swap.test.tsx',
  'test/unit/chrome-bars-app.test.tsx', 'test/unit/header-parts.test.tsx', 'test/unit/appearance-control-today.test.tsx',
  'test/unit/fixtures/appearance-control-today.tsx', ...NEW_SPECS,
]
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
/** The spec this step changes, with its count in each project. */
const SPECS = ['test/a11y/nav.spec.ts']
/** The unit test files this step changes, each with its count written in the block. */
const CHANGED_TESTS = [
  'test/unit/use-wide-screen.test.tsx', 'test/unit/appearance-control.test.tsx', 'test/unit/login-return.test.tsx',
  'test/unit/header-today.test.tsx', 'test/unit/header-today-edges.test.tsx', 'test/unit/site-header.test.tsx',
  'test/unit/site-header-edges.test.tsx', 'test/unit/brand-edges.test.tsx', 'test/unit/lca-mark.test.tsx', 'test/unit/contrast.test.ts',
  'test/unit/base-components-scope.test.ts', 'test/unit/reload-on-stale-chunk-pages.test.tsx', 'test/unit/goldText.test.ts',
  'test/unit/raw-colours.test.ts', 'test/unit/redesign-status-step24.test.ts', 'test/unit/redesign-status-step26.test.ts',
  'test/unit/dark-spot-later.test.ts', 'test/unit/chrome-helper.test.tsx', 'test/unit/chrome-reads.test.ts', 'test/unit/nav.test.ts',
  'test/unit/redesign-status-ws02-step3.test.ts', 'test/unit/redesign-status-ws02-step4.test.ts', 'test/unit/redesign-status-ws02-step5.test.ts',
]
/** The other files this step changes. */
const CHANGED = [
  'src/hooks/useWideScreen.ts', 'src/components/layout/SiteHeader.tsx', 'src/components/layout/MyLcaMenu.tsx', 'src/components/layout/Navbar.tsx',
  'src/components/AppearanceControl.tsx', 'src/components/DonateButton.tsx', 'src/lib/nav.ts', 'src/App.tsx', 'src/index.css', 'test/a11y/chrome.ts',
  'test/unit/fixtures/goldAllowlist.ts', 'test/unit/fixtures/raw-colours-allowlist.json', 'REDESIGN_STATUS.md',
]
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))

describe('REDESIGN_STATUS.md, WS02 step 6: the lines outside the block', () => {
  it('says in the Status line that steps 1 to 6 are built, or, once a later step has landed, steps 1 to that step', () => {
    const start = '**Status:** in progress: nineteen steps in five checkpoints (E for steps 1 to 5, F for 6 to 8, G for 9 to 11, H for 12 to 16, I for 17 to 19); '
    expect(statusLine.startsWith(start)).toBe(true)
    const built = /^steps 1 to (\d+) are built\.$/.exec(statusLine.slice(start.length))
    expect(built, statusLine).not.toBeNull()
    expect(Number(built![1])).toBeGreaterThanOrEqual(6)
  })

  it('names checkpoint E\'s pull request and checkpoint F\'s in the PR line, in a form the next steps keep, and never calls a merge pending', () => {
    expect(prLine.startsWith('**PR:** ')).toBe(true)
    for (const piece of ['pull request 110', 'checkpoint E (steps 1 to 5)', 'checkpoint F (steps 6 to 8)']) expect(prLine, piece).toContain(piece)
    expect(prLine).not.toContain('is pending')
  })

  it('keeps WS01\'s part of the date line first and word for word, and puts step 6 first in WS02\'s part', () => {
    const after = dateLine.replace(/^Last updated: \S+ /, '')
    expect(after.startsWith('(WS01, step 32: a11y sweep; step 31: heritage layout; step 30: heritage fonts; step 29: hero images; step 28: brand marks; step 27: chess data; step 26: status tags; step 25: gold text; step 24: colours; step 23: grounds; step 22: ThemeScope; step 21: dark mode; step 20 opened checkpoint D; checkpoint C, after step 16, step 17 and step 18, is merged; checkpoint D is merged; WS02, ')).toBe(true)
    expect(after).toMatch(/; WS02, (?:[^;()]+; )*step 6: Menu sheet, tablet header and app bar, the first of checkpoint F; step 5: desktop header and About menu, the last of checkpoint E; step 4: browser specs read the chrome through one helper; step 3: page frame, browser bar colour and rings; step 2: navigation model and signed-in visitor; step 1: record and brief 1\.4\)$/)
    for (const step of ['step 18', 'step 21', 'step 23', 'step 26', 'step 27', 'step 28', 'step 29', 'step 30', 'step 31', 'step 32']) expect(status.slice(0, 400), step).toContain(step)
    expect((/^Last updated: (\d{4}-\d{2}-\d{2}) /.exec(dateLine)?.[1] ?? '') >= '2026-10-30').toBe(true)
  })

  it('ends WS02 step 5\'s follow-up on the stand-in with a sentence of its own, quoting no heading, its head as it was', () => {
    expect(STAND_IN).not.toBe('')
    const done = closing(STAND_IN, 'Done in WS02 step 6:')
    expect(done).not.toBe('')
    expect(STAND_IN.endsWith(done)).toBe(true)
    expect(done).not.toMatch(/"[^"]*\(step \d+\)"/)
    for (const piece of ['`src/components/layout/Navbar.tsx`', '`DRAWN`', '`test/unit/chrome-helper.test.tsx`', '`--header-h`']) expect(done, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 6: the map', () => {
  it('still maps the 23 criteria and the 12 decisions, each with exactly one planned step and no second "WS02 step"', () => {
    expect(mapItems.filter((l) => /^- \*\*AC\d+\.\*\*/.test(l))).toHaveLength(23)
    expect(mapItems).toHaveLength(35)
    for (const item of mapItems) {
      expect(item.match(/Planned: WS02 step \d+\./g), head(item)).toHaveLength(1)
      expect(item.match(/WS02 step \d+/g), head(item)).toHaveLength(1)
    }
  })

  it('says what this step built of AC3, AC6, AC15, AC16, AC21, D1, Phone rulings 1.2 and D16, each item keeping its planned step as its last words, and proves none', () => {
    for (const [id, planned] of BUILT) {
      const item = mapItem(id)
      expect(item.split('Built in step 6: '), id).toHaveLength(2)
      expect(item.endsWith(`Planned: WS02 step ${planned}.`), id).toBe(true)
    }
    expect(closing(mapItem('AC15'), 'Built in step 6:')).toContain('"Louisiana Chess Association, home"')
    expect(closing(mapItem('D1'), 'Built in step 6:')).toContain('`src/components/layout/MobileAppBar.tsx`')
    expect(closing(mapItem('AC21'), 'Built in step 6:')).toContain('`#866a1e` on `#fbfaf6`')
    expect(map).not.toContain('Proved in step 6')
    for (const item of mapItems) expect(item, head(item)).not.toMatch(/\bin step 4\b/)
  })

  it('keeps the sentence the map closes with, word for word', () => {
    expect(map).toContain('Steps 2, 4, 6, 10, 14 and 19 fill in no item: step 2 builds what every criterion reads (the navigation model, the chrome\'s one condition and the signed-in visitor of the browser tests), step 4 moves the browser specs\' reads of the chrome into one helper, step 6 builds the sheet that AC3 and AC6 are proved on, steps 10 and 14 prove halves of AC5 and AC4, and step 19 closes the record.')
  })
})

describe('REDESIGN_STATUS.md, WS02 step 6: the step block', () => {
  it('sits after the Checkpoint E section and before the decisions, once', () => {
    const at = [CHECKPOINT, STEP, '### WS02 decisions'].map((h) => ws02.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws02.split(`\n${STEP}\n`)).toHaveLength(2)
  })

  it('has every part, every file and nothing left to fill in', () => {
    for (const piece of [
      '**Files.**', '**The widths.**', '**The tablet header.**', '**The app bar.**', '**The Menu sheet.**', '**The sheet\'s rows.**', '**The theme switch.**',
      '**Log in\'s page.**', '**The bars\' height.**', '**The WS02 gold.**', '**The helper\'s answer.**', '**What is fetched on demand.**',
      '**The board and the brief.**', '**What ships with every switch off.**', '**Pins moved.**', '**Judgement calls.**', '**Lint.**', '**Build.**',
      '**The browser runs.**', '\n- Checks:', 'Files beyond the step\'s list:',
    ]) expect(block, piece).toContain(piece)
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...SPECS, ...CHANGED_TESTS, ...CHANGED]) expect(files, name).toContain(`\`${name}\``)
    // Each new unit test file with the number of its tests, each changed one with its number before, and the spec with its count in each project.
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of CHANGED_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before): `))
    for (const name of SPECS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+ in each project, (?:\\d+ before|as before): `))
    for (const name of NEW_SPECS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+ in each project: `))
    expect(block).toContain('Baseline matches: no colour or font changed.')
    expect(block).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
    for (const text of [block, checkpoint, decisions, deviations, verify, followUps, map, statusLine, prLine, datePart]) expect(text).not.toMatch(UNFILLED)
  })

  it('says what a visitor sees by switch, and that nothing ships with every switch off', () => {
    expect(block).toContain('What a visitor sees, by switch: with every switch off, nothing; with `newLook` alone and with `newNav` alone, the same; with the chrome on, the new header from 1024 pixels up, the tablet header from 768 to 1023 pixels and the app bar below 768, each Menu button opening the Menu sheet, and today\'s header at no width.')
    expect(bullet(block, '- **What ships with every switch off.**').startsWith('- **What ships with every switch off.** Nothing a visitor sees or hears:')).toBe(true)
  })

  it('gives the rows\' figures, the tablet header\'s at 768, 900 and 1023 pixels and the app bar\'s at 320, 390 and 767, with what Search would add', () => {
    const tablet = bullet(block, '- **The tablet header.**')
    for (const piece of ['768', '900', '1023', 'signed out', 'active member', 'Search', '112 pixels']) expect(tablet, piece).toContain(piece)
    const bar = bullet(block, '- **The app bar.**')
    for (const piece of ['320', '390', '767', 'Search', '44 by 44']) expect(bar, piece).toContain(piece)
    expect(line('- **The tablet row (WS02 step 6).**')).toMatch(/^- \*\*The tablet row \(WS02 step 6\)\.\*\* Measured, /)
  })

  it('names each difference between the decided phone board and the brief, the brief ruling', () => {
    const board = bullet(block, '- **The board and the brief.**')
    for (const piece of ['`docs/redesign/decided-boards/Nav-Mobile-Final.dc.html`', '"LCA"', 'drawer', 'whole window', 'Renew', '"LCA on Facebook ↗"', 'dark', 'sticky', 'Search', 'Menu button', 'radio group', 'close control', 'the brief rules']) {
      expect(board, piece).toContain(piece)
    }
  })

  it('opens the Checkpoint E section pending its merge, or merged, with the merge commit and its day, never calling the merge pending in the old words', () => {
    const pending = checkpointOpening.startsWith('**Not merged yet: checkpoint E waits for its merge into `main`** (draft pull request 110)')
    const merged = /^\*\*Merged into `main` as `[0-9a-f]{7,40}` on (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]+ \d{1,2}, \d{4}/.test(checkpointOpening)
    expect(pending || merged, checkpointOpening.slice(0, 120)).toBe(true)
    expect(checkpoint).not.toMatch(/merge into `main` is pending|checkpoint D's merge is pending/)
    expect(checkpoint).toContain('It changes no database.')
  })
})

describe('REDESIGN_STATUS.md, WS02 step 6: the lists', () => {
  it('records the step\'s decisions, each tagged with it', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'Navbar draws the tablet header and the app bar below 1024 pixels with the chrome on (WS02 step 6).',
      'The tablet header is the new header\'s narrower form (WS02 step 6).',
      'The Menu sheet is a modal dialog on the site\'s dialog primitive (WS02 step 6).',
      'The sheet opens on its close control and gives the focus back to its button (WS02 step 6).',
      'The bars\' focus moves leave the page where it is (WS02 step 6).',
      'The sheet\'s code is fetched the first time Menu is pressed (WS02 step 6).',
      'What the bars fetch fails on its own (WS02 step 6).',
      'The sign-in pages hand on what they were handed (WS02 step 6).',
      'One Appearance control, drawn twice (WS02 step 6).',
      'Each bar writes its own height (WS02 step 6).',
      'The sheet\'s gold is held in its context and counted with its reason (WS02 step 6).',
      'The bars share one file of parts (WS02 step 6).',
    ])
  })

  it('records what differs from the brief, the plan or the notes for this workstream right after WS02 step 5\'s own entries, and before WS02 step 8\'s first', () => {
    const heads = entries(deviations).map(head)
    const own = [
      'The decided phone board differs, and the brief rules (WS02 step 6).',
      'The Menu button on every phone until the tab bar (WS02 step 6).',
      'Search waits for its buttons in both bars (WS02 step 6).',
      'The sheet\'s current section is darker than the sheet in dark mode (WS02 step 6).',
      'The checks of today\'s header under the new look below 1024 pixels leave the browser runs (WS02 step 6).',
      'The map items this step fills in (WS02 step 6).',
      'The donation form\'s message names no address (WS02 step 6).',
      'The plan\'s figures that moved (WS02 step 6).',
      'The sheet\'s role rows come before the Admin row (WS02 step 6).',
      'A Log out row in the sheet (WS02 step 6).',
      'The Appearance control takes its ground as well as its label\'s id (WS02 step 6).',
      'More switches than the plan names (WS02 step 6).',
      'One more file on every page with every switch off (WS02 step 6).',
      'Files beyond the plan\'s list (WS02 step 6).',
    ]
    const at = heads.indexOf('Files beyond the plan\'s list (WS02 step 5).')
    expect(at).toBeGreaterThan(-1)
    expect(heads.slice(at + 1, at + 1 + own.length)).toEqual(own)
    // WS02 step 7's own may come between this step's and WS02 step 8's first.
    const footer = heads.indexOf('The footer\'s logo file (WS02 step 8).')
    expect(footer).toBeGreaterThanOrEqual(at + 1 + own.length)
    for (const later of heads.slice(at + 1 + own.length, footer)) expect(later, later).toMatch(/\(WS02 step 7\)\.$/)
    // None takes a phrase of the brief's own deviation bullets, or the words the step 1 record test finds them by.
    for (const entry of entries(deviations).filter((l) => own.includes(head(l)))) {
      expect(entry).not.toContain('the `/about` tabs')
      expect(entry).not.toMatch(/^- \*\*From v1\.[13]: /)
      for (const phrase of [
        'The mobile layout is M2 under 768 pixels', 'WS02 AC6 and WS12 AC6 follow', 'Renew shows only once a membership has expired',
        'the rook mark at every width and no longer condenses', 'Donate moves into the About menu, then the brand name hides', 'keeps today\'s role rows until `myLcaRail`',
      ]) expect(entry, phrase).not.toContain(phrase)
    }
  })

  it('resolves each verify item, found in the code or measured, in the order the notes for this workstream give them', () => {
    const names = [
      'The tree', 'Checkpoint E\'s merge', 'The sheet\'s theme switch', 'A dialog for the sheet', 'Today\'s phone menu', 'AppearanceControl', 'ScrollPanel',
      'Pins on the sheet and the app bar', 'The widths', 'The tablet row', 'The sheet\'s rows by person', 'Specs that read today\'s header below 1024 pixels',
      'The board and the brief', 'The carried items', 'Lint and counts', 'The baseline', 'The built site', 'The closing search', 'The grep check',
    ]
    expect(tagged(verify).map(head)).toEqual(names.map((n) => `${n} (WS02 step 6).`))
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^(Confirmed|Measured|Not found)\b/)
    // Checkpoint E's merge, with the merge time GitHub gives and the commit's own, never the one the notes of that day stamped.
    const merge = line('- **Checkpoint E\'s merge (WS02 step 6).**')
    for (const piece of ['`8d7df98`', '`39e35e8`', '`c0e17fc`', '3:20:46 PM UTC', '10:20:45 AM Central', '3:20:45 PM UTC']) expect(merge, piece).toContain(piece)
    expect(merge).not.toContain('3:20:44')
    expect(line('- **The grep check (WS02 step 6).**')).toMatch(/Measured: .*\d+ lines/)
  })

  it('gives the closing search\'s kinds, each with its files and a count by file, adding up to the lines it found', () => {
    const search = line('- **The closing search (WS02 step 6).**')
    const total = /found ([\d,]+) lines in (\d+) files/.exec(search)
    expect(total, 'its total').not.toBeNull()
    const kinds = [...search.matchAll(/([a-z][a-z ']+?): ([\d,]+) lines? in (\d+) files? \(([^)]*)\)/g)]
    expect(kinds.length).toBeGreaterThanOrEqual(6)
    let sum = 0
    for (const [, kind, count, files, list] of kinds) {
      const byFile = [...list.matchAll(/`[^`]+` (\d+)/g)].map((m) => Number(m[1]))
      expect(byFile, kind).toHaveLength(Number(files))
      expect(byFile.reduce((a, n) => a + n, 0), kind).toBe(num(count))
      sum += num(count)
    }
    expect(sum).toBe(num(total![1]))
  })

  it('closes the two follow-ups the review of WS02 step 5 handed on, then adds its own, and keeps the twelve WS01 handed on', () => {
    const own = tagged(followUps)
    expect(own.map(head)).toEqual([
      ...CARRIED,
      'The Menu tab opens the same sheet (WS02 step 6).',
      'The section\'s name and the short window (WS02 step 6).',
      'The footer\'s theme switch (WS02 step 6).',
      'Search in the tablet header and the app bar (WS02 step 6).',
      'The event bar\'s row in the sheet and a focused control under the bars (WS02 step 6).',
      'Tab through a bar on a scrolled page (WS02 step 6).',
      'K looks at the tablet header, the app bar and the sheet on a preview (WS02 step 6).',
      'The helper library back in the main script (WS02 step 6).',
    ])
    for (const name of CARRIED) {
      const entry = own.find((l) => head(l) === name) ?? ''
      const done = closing(entry, 'Done in WS02 step 6:')
      expect(done, name).not.toBe('')
      expect(entry.endsWith(done)).toBe(true)
      expect(done).not.toMatch(/\(step \d+\)/)
    }
    // The preview list keeps the question of where a signed-in person logs out below 768 pixels, which the sheet's row answers.
    expect(own.find((l) => head(l) === 'K looks at the tablet header, the app bar and the sheet on a preview (WS02 step 6).')).toContain('logs out below 768 pixels')
    expect(entries(followUps).filter((l) => l.startsWith('- **From WS01: '))).toHaveLength(12)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 6: plain language', () => {
  it('reads every piece it means to', () => {
    for (const text of written) expect(text).not.toBe('')
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and table rows out of what the step wrote', () => {
    for (const text of written) {
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(TOOLS)
      expect(text).not.toMatch(BARE)
      expect(text).not.toMatch(OLD_INITIALS)
      expect(text.split('\n').filter((l) => l.startsWith('|'))).toEqual([])
    }
    // The CI files are named by their file names alone, and the fixture page by its words, never by its address.
    for (const text of [block, checkpoint]) {
      expect(text).not.toMatch(/\.github\//)
      expect(text).not.toContain('_' + '_fixtures')
    }
  })

  it('names steps as "WS02 step N", never with the bare "(step N)" WS01\'s tests look for, but in a quoted WS01 heading', () => {
    for (const text of written) expect(text.replace(/"[^"]*\(step \d+\)"/g, '""')).not.toMatch(/\(step \d+[;)]/)
  })

  it('gives every date the weekday it falls on, and writes every time on the twelve-hour clock', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const months = MONTHS.join('|')
    const short = MONTHS.map((m) => m.slice(0, 3)).join('|')
    for (const text of prose) {
      for (const date of text.matchAll(new RegExp(`\\b(?:${months}|${short}) \\d{1,2}\\b`, 'g'))) {
        expect(text.slice(Math.max(0, (date.index ?? 0) - 11), date.index), date[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
      }
      for (const [whole, weekday, month, day, year] of text.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${months}) (\\d{1,2})\\b(?:, (\\d{4}))?`, 'g'))) {
        expect(WEEKDAYS[new Date(Date.UTC(Number(year ?? 2026), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
      }
      for (const time of text.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
    }
  })
})

describe('REDESIGN_STATUS.md, WS02 step 6: its claims against the files', () => {
  it('lists as new only files that exist, each free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of NEW_FILES) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
  })

  it('finds the sheet\'s entry in the gold fixture as it was: #866a1e in its file, beside "You are here", at 13 pixels, on #fbfaf6', () => {
    const fixture = read('test/unit/fixtures/goldAllowlist.ts')
    const at = fixture.indexOf('file: \'src/components/layout/MobileMenu.tsx\'')
    expect(at).toBeGreaterThan(-1)
    const sheet = fixture.slice(fixture.lastIndexOf('{', at), fixture.indexOf('},', at))
    for (const piece of ['colour: \'#866a1e\'', 'use: \'text\'', 'label: \'You are here\'', 'minPx: 13', 'ground: \'#fbfaf6\'']) expect(sheet, piece).toContain(piece)
  })

  it('gives unit and integration counts that add up: the base\'s, the new files\' tests and the changed files\' gains, file for file with the Files bullet', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    const fresh = NEW_TESTS.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    const gains = CHANGED_TESTS.map((name) => {
      const m = new RegExp(`\`${escape(name)}\` \\((\\d+), (?:(\\d+) before|as before): `).exec(files)
      return m ? Number(m[1]) - Number(m[2] ?? m[1]) : NaN
    })
    for (const n of [...fresh, ...gains]) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + fresh.reduce((a, n) => a + n, 0) + gains.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
    expect(line('- **Lint and counts (WS02 step 6).**')).toContain(`unit ${before} tests in ${beforeFiles} files`)
    // No integration test is added or changed, so its counts are the base's.
    const integration = /integration ([\d,]+) in (\d+) files, as on the base/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    expect(line('- **Lint and counts (WS02 step 6).**')).toContain(`integration ${integration![1]} in ${integration![2]}`)
  })

  it('gives browser counts that add up: the base\'s and the new cases in each project, the runs and the Checks line alike', () => {
    const files = bullet(block, '- **Files.**')
    const nav = /`test\/a11y\/nav\.spec\.ts` \((\d+) in each project, (\d+) before/.exec(files)
    expect(nav).not.toBeNull()
    // Every spec that grew: the cases nav.spec.ts gains and each new spec's, in each of the two projects.
    const fresh = NEW_SPECS.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+) in each project: `).exec(files)?.[1]))
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    const added = 2 * (Number(nav![1]) - Number(nav![2]) + fresh.reduce((a, n) => a + n, 0))
    const runs = bullet(block, '- **The browser runs.**')
    const base = /the base's run: ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip/.exec(runs)
    expect(base, 'the base\'s run').not.toBeNull()
    const quoted = [...runs.matchAll(/"Running ([\d,]+) tests using 2 workers", (?:"(\d+) failed", )?"([\d,]+) skipped" and "([\d,]+) passed/g)]
    expect(quoted.length).toBeGreaterThanOrEqual(2)
    for (const [, total, failed, skipped, passed] of quoted) {
      expect(num(total)).toBe(num(base![1]) + added)
      expect(num(skipped) + num(passed) + Number(failed ?? 0)).toBe(num(total))
    }
    // The last run quoted is the one the step ends on, with nothing failed.
    const [, total, failed, skipped, passed] = quoted.at(-1)!
    expect(failed).toBeUndefined()
    expect(checksLine).toContain(`${total} tests, ${passed} that run and ${skipped} that skip`)
    // Each project's tests, run and skipped, add up to the run's.
    const projects = /`a11y-on` holds ([\d,]+) tests \(([\d,]+) that run and ([\d,]+) that skip\) and `a11y-off` ([\d,]+) \(([\d,]+) and ([\d,]+)\)/.exec(runs)
    expect(projects, 'the counts in each project').not.toBeNull()
    const [on, onRun, onSkip, off, offRun, offSkip] = projects!.slice(1).map(num)
    expect([onRun + onSkip, offRun + offSkip]).toEqual([on, off])
    expect([on + off, onRun + offRun, onSkip + offSkip]).toEqual([num(total), num(passed), num(skipped)])
  })
})
