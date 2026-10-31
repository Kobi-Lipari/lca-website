// test/unit/redesign-status-ws02-step7.test.ts
//
// REDESIGN_STATUS.md records WS02 step 7, the second of checkpoint F: the
// phone's tab bar and the dock that holds it, with the chrome on. Like the
// record tests of WS02's first six steps, this file reads only the WS02
// section and the lines the step wrote outside its block (the Status, PR
// and date lines, the sentences it added to eight map items, the sentences
// that end six older follow-ups, and the one it added to an older
// deviation), never every table row or heading of the file. Pinned here:
// the Status and PR lines in forms the next steps keep; the date line's
// parts; the map; the step's block with every part and every file; the
// decisions, deviations, verify items and follow-ups, each with its tag
// and in its place; the plain-language rules over all of it; and, checked
// against the files they describe, the record's claims: the new files, the
// tab bar's entry in the gold fixture, and the figures it states in more
// than one place, which must agree. It reads no switch, no answer of the
// browser tests' helper and no source text a later step is named to
// change, so K turning a switch on, the new footer of the next step, the
// Search button beside the section's name or the event bar in the dock
// fails nothing here.
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
const TAG = '(WS02 step 7).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
/** What this step added to an older line: from `from` to the end of the line. */
const closing = (entry: string, from: string) => (entry.includes(from) ? entry.slice(entry.indexOf(from)) : '')

const ws02 = between(status, '## WS02: Information architecture and navigation', '\n## WS03:')
/** A part of the WS02 section, from its heading to the next: the heading as a line of its own, since a sentence may name one in backticks. */
const part = (heading: string) => {
  const at = ws02.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws02.slice(at + 1), heading, '\n### ')
}
const STEP = '### WS02 step 7: the tab bar and the bottom dock'
const BEFORE = '### WS02 step 6: the Menu sheet, the tablet header and the app bar'
const block = part(STEP)
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

/** The map items this step proves, each keeping WS02 step 7 as its planned step. */
const PROVED = ['AC3', 'AC6', 'AC16', 'AC21', 'Phone rulings 1.2', 'D16']
/** The map items this step built a part of, each with the planned step it keeps as its last words. */
const BUILT: ReadonlyArray<readonly [string, number]> = [['AC9', 16], ['AC11', 8]]
/** The older deviation this step ends with a sentence of its own, read from that sentence to the entry's end. */
const GOLD_HEAD = 'WS02\'s gold as hex classes (WS02 steps 5 to 7).'
const GOLD = entries(deviations).find((l) => head(l) === GOLD_HEAD) ?? ''
const GOLD_SENTENCE = 'WS02 step 7 draws the tab bar\'s line'
/** The older follow-ups this step ends with a sentence of its own. */
const CLOSED = [
  'From WS01: WS02\'s gold (WS02 step 7).',
  'Donate, Log in and the gold on phones (WS02 step 5).',
  'The Menu tab opens the same sheet (WS02 step 6).',
  'The section\'s name and the short window (WS02 step 6).',
  'Tab through a bar on a scrolled page (WS02 step 6).',
  'The helper library back in the main script (WS02 step 6).',
]
const closed = (name: string) => entries(followUps).find((l) => head(l) === name) ?? ''
/** The follow-ups the reviews of WS02 step 6 and of checkpoint E handed on, each ended in this step. */
const CARRIED = [
  'From WS02 step 6: the sheet\'s list region\'s ring (WS02 step 7).',
  'From WS02 step 6: Log in\'s sign-in pages as the router reads them (WS02 step 7).',
  'From WS02 step 6: the focus when the drawer closes at 1024 pixels (WS02 step 7).',
  'From WS02 step 6: the current section\'s cue in the sheet (WS02 step 7).',
  'From the review of checkpoint E: the command line tests\' time limits (WS02 step 7).',
  'From the review of checkpoint E: Tailwind\'s class scanner, `@tailwindcss/oxide`, declared (WS02 step 7).',
  'From the review of checkpoint E: the record test\'s banned words built from pieces (WS02 step 7).',
]

/** Everything this step wrote, each piece on its own. */
const written = [
  block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), statusLine, prLine, datePart,
  ...PROVED.map((id) => closing(mapItem(id), 'Proved in step 7')), ...BUILT.map(([id]) => closing(mapItem(id), 'Built in step 7:')),
  ...CLOSED.filter((name) => !name.endsWith(TAG)).map((name) => closing(closed(name), 'Done in WS02 step 7:')), closing(GOLD, GOLD_SENTENCE),
]
/** The same, with what sits in backticks taken out, since code is not prose. */
const prose = written.map((text) => text.replace(/`[^`\n]*`/g, '``'))

/** The spec this step adds, with its count in each project. */
const NEW_SPECS = ['test/a11y/dock.spec.ts']
/** The files this step adds: the dock's parts, the tab bar, their tests and their edges', the build's edges, the record's test, and the new spec. */
const NEW_FILES = [
  'src/components/layout/BottomDock.tsx', 'src/components/layout/BottomTabs.tsx', 'src/components/layout/dockParts.ts',
  'test/unit/bottom-dock.test.tsx', 'test/unit/bottom-dock-edges.test.tsx', 'test/unit/dock-build-edges.test.ts',
  'test/unit/redesign-status-ws02-step7.test.ts', ...NEW_SPECS,
]
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
/** The specs this step changes, with their counts in each project. */
const SPECS = ['test/a11y/nav.spec.ts', 'test/a11y/nav-bars-edges.spec.ts']
/** The unit test files this step changes, each with its count written in the block. */
const CHANGED_TESTS = [
  'test/unit/prepaint-gate.test.ts', 'test/unit/header-parts.test.tsx', 'test/unit/e2e-preview-guard.test.ts',
  'test/unit/redesign-status-ws02-step1.test.ts', 'test/unit/redesign-status-ws02-step1-edges.test.ts', 'test/unit/source-not-lines.test.ts',
  'test/unit/goldText.test.ts', 'test/unit/raw-colours.test.ts', 'test/unit/redesign-status-step24.test.ts', 'test/unit/redesign-status-step26.test.ts',
  'test/unit/dark-spot-later.test.ts', 'test/unit/chrome-bars-app.test.tsx', 'test/unit/chrome-bars-swap.test.tsx', 'test/unit/mobile-app-bar.test.tsx',
  'test/unit/mobile-menu.test.tsx', 'test/unit/menu-sheet-edges.test.tsx', 'test/unit/tablet-header.test.tsx', 'test/unit/login-return.test.tsx',
  'test/unit/use-wide-screen.test.tsx', 'test/unit/chrome-helper.test.tsx',
]
/** The other files this step changes. */
const CHANGED = [
  'src/App.tsx', 'src/components/layout/MobileAppBar.tsx', 'src/components/layout/MobileMenu.tsx', 'src/components/layout/SiteHeader.tsx',
  'src/components/layout/headerParts.ts', 'src/hooks/useWideScreen.ts', 'src/index.css', 'src/lib/nav.ts', 'vite.config.ts', 'package.json',
  'package-lock.json', 'test/a11y/chrome.ts', 'test/unit/fixtures/goldAllowlist.ts', 'test/unit/fixtures/raw-colours-allowlist.json', 'REDESIGN_STATUS.md',
]
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))

describe('REDESIGN_STATUS.md, WS02 step 7: the lines outside the block', () => {
  it('says in the Status line that steps 1 to 7 are built, or, once a later step has landed, steps 1 to that step', () => {
    const start = '**Status:** in progress: nineteen steps in five checkpoints (E for steps 1 to 5, F for 6 to 8, G for 9 to 11, H for 12 to 16, I for 17 to 19); '
    expect(statusLine.startsWith(start)).toBe(true)
    const built = /^steps 1 to (\d+) are built\.$/.exec(statusLine.slice(start.length))
    expect(built, statusLine).not.toBeNull()
    expect(Number(built![1])).toBeGreaterThanOrEqual(7)
  })

  it('names checkpoint E\'s pull request and checkpoint F\'s, number 118, in the PR line, in a form the next steps keep, and never calls a merge pending', () => {
    expect(prLine.startsWith('**PR:** ')).toBe(true)
    for (const piece of ['pull request 110', 'checkpoint E (steps 1 to 5)', 'checkpoint F (steps 6 to 8)', 'pull request 118']) expect(prLine, piece).toContain(piece)
    expect(prLine).not.toContain('is pending')
  })

  it('keeps WS01\'s part of the date line first and word for word, and puts step 7 first in WS02\'s part, ahead of step 6', () => {
    const after = dateLine.replace(/^Last updated: \S+ /, '')
    expect(after.startsWith('(WS01, step 32: a11y sweep; step 31: heritage layout; step 30: heritage fonts; step 29: hero images; step 28: brand marks; step 27: chess data; step 26: status tags; step 25: gold text; step 24: colours; step 23: grounds; step 22: ThemeScope; step 21: dark mode; step 20 opened checkpoint D; checkpoint C, after step 16, step 17 and step 18, is merged; checkpoint D is merged; WS02, ')).toBe(true)
    expect(after).toMatch(/; WS02, (?:[^;()]+; )*step 7: tab bar and bottom dock, the second of checkpoint F; step 6: Menu sheet, tablet header and app bar, the first of checkpoint F; step 5: desktop header and About menu, the last of checkpoint E; step 4: browser specs read the chrome through one helper; step 3: page frame, browser bar colour and rings; step 2: navigation model and signed-in visitor; step 1: record and brief 1\.4\)$/)
    for (const step of ['step 18', 'step 21', 'step 23', 'step 26', 'step 27', 'step 28', 'step 29', 'step 30', 'step 31', 'step 32']) expect(status.slice(0, 400), step).toContain(step)
    expect((/^Last updated: (\d{4}-\d{2}-\d{2}) /.exec(dateLine)?.[1] ?? '') >= '2026-10-31').toBe(true)
  })

  it('ends the older deviation on WS02\'s gold with a sentence of its own, its head as it was', () => {
    expect(GOLD).not.toBe('')
    const done = closing(GOLD, GOLD_SENTENCE)
    expect(done).not.toBe('')
    expect(GOLD.endsWith(done)).toBe(true)
    for (const piece of ['`--hairline`', '`#d9d8d1`', '"The tab bar\'s line is the hairline token (WS02 step 7)."']) expect(done, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 7: the map', () => {
  it('still maps the 23 criteria and the 12 decisions, each with exactly one planned step and no second "WS02 step"', () => {
    expect(mapItems.filter((l) => /^- \*\*AC\d+\.\*\*/.test(l))).toHaveLength(23)
    expect(mapItems).toHaveLength(35)
    for (const item of mapItems) {
      expect(item.match(/Planned: WS02 step \d+\./g), head(item)).toHaveLength(1)
      expect(item.match(/WS02 step \d+/g), head(item)).toHaveLength(1)
    }
  })

  it('says what proves AC3, AC6, AC16, AC21, Phone rulings 1.2 and D16, after the sentence of WS02 step 6 and before the planned step, which stays their last words', () => {
    for (const id of PROVED) {
      const item = mapItem(id)
      expect(item.split('Proved in step 7 by '), id).toHaveLength(2)
      expect(item.indexOf('Built in step 6: '), id).toBeLessThan(item.indexOf('Proved in step 7 by '))
      expect(item.endsWith('Planned: WS02 step 7.'), id).toBe(true)
    }
    for (const [id, piece] of [
      ['AC3', '`test/a11y/nav.spec.ts`'], ['AC3', '`test/unit/bottom-dock.test.tsx`'], ['AC6', 'two taps'], ['AC16', '`test/unit/login-return.test.tsx`'],
      ['AC21', '`border-t-[#866a1e]`'], ['AC21', '`src/components/layout/BottomTabs.tsx`'], ['D16', '`--bottom-chrome-h`'], ['D16', '`test/a11y/dock.spec.ts`'],
      ['D16', '320, 360, 390, 768 and 1023 pixels'], ['Phone rulings 1.2', 'under 768 pixels'],
    ] as const) expect(closing(mapItem(id), 'Proved in step 7'), `${id}: ${piece}`).toContain(piece)
  })

  it('says what this step built of AC9 and AC11, each keeping its planned step, and leaves AC13 as it was', () => {
    for (const [id, planned] of BUILT) {
      const item = mapItem(id)
      expect(item.split('Built in step 7: '), id).toHaveLength(2)
      expect(item.endsWith(`Built in step 7: ${closing(item, 'Built in step 7: ').slice('Built in step 7: '.length)}`)).toBe(true)
      expect(item.endsWith(`Planned: WS02 step ${planned}.`), id).toBe(true)
    }
    expect(closing(mapItem('AC9'), 'Built in step 7:')).toContain('`test/a11y/dock.spec.ts`')
    expect(closing(mapItem('AC9'), 'Built in step 7:')).toContain('step 16')
    expect(closing(mapItem('AC11'), 'Built in step 7:')).toContain('`src/lib/nav.ts`')
    expect(closing(mapItem('AC11'), 'Built in step 7:')).toContain('step 8')
    expect(mapItem('AC13')).not.toContain('step 7')
    for (const item of mapItems) expect(item, head(item)).not.toMatch(/\bin step 4\b/)
  })

  it('keeps the sentence the map closes with, word for word', () => {
    expect(map).toContain('Steps 2, 4, 6, 10, 14 and 19 fill in no item: step 2 builds what every criterion reads (the navigation model, the chrome\'s one condition and the signed-in visitor of the browser tests), step 4 moves the browser specs\' reads of the chrome into one helper, step 6 builds the sheet that AC3 and AC6 are proved on, steps 10 and 14 prove halves of AC5 and AC4, and step 19 closes the record.')
  })
})

describe('REDESIGN_STATUS.md, WS02 step 7: the step block', () => {
  it('sits after WS02 step 6\'s block and before the decisions, once', () => {
    const at = [BEFORE, STEP, '### WS02 decisions'].map((h) => ws02.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws02.split(`\n${STEP}\n`)).toHaveLength(2)
  })

  it('has every part, in order, every file and nothing left to fill in', () => {
    const parts = [
      '- **Files.**', '- **The dock.**', '- **The tab bar.**', '- **The Menu tab and the sheet.**', '- **The app bar beside the tab bar.**', '- **When the dock hides.**',
      '- **The room for the dock.**', '- **The viewport tag and the safe areas.**', '- **Log in from the tab.**', '- **The WS02 gold.**', '- **The helper.**',
      '- **The helper library.**', '- **The carried items.**', '- **The board and the brief.**', '- **What ships with every switch off.**', '- **Pins moved.**',
      '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- **The browser runs.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const files = bullet(block, '- **Files.**')
    expect(files).toContain('Files beyond the step\'s list:')
    for (const name of [...NEW_FILES, ...SPECS, ...CHANGED_TESTS, ...CHANGED]) expect(files, name).toContain(`\`${name}\``)
    // Each new unit test file with the number of its tests, each changed one with its number before, and each spec with its count in each project.
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of CHANGED_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before): `))
    for (const name of SPECS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+ in each project, (?:\\d+ before|as before): `))
    for (const name of NEW_SPECS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+ in each project: `))
    expect(block).toContain('Baseline matches: no colour or font changed.')
    expect(block).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
    for (const text of [block, decisions, deviations, verify, followUps, map, statusLine, prLine, datePart]) expect(text).not.toMatch(UNFILLED)
  })

  it('says what a visitor sees by switch, and that nothing ships with every switch off', () => {
    expect(block).toContain('What a visitor sees, by switch: with every switch off, nothing; with `newLook` alone and with `newNav` alone, the same, and the page\'s viewport tag today\'s; with the chrome on, below 768 pixels the tab bar fixed under the page in the dock, with Tournaments, Clubs, Log in or My LCA and Menu, the Menu tab opening the Menu sheet above it and reading Close while it is open, the app bar with no Menu button beside the tab bar and with the section\'s name when the Menu tab stands for the page, and the app bar\'s Menu button back where the dock hides; from 768 pixels up no tab bar.')
    expect(bullet(block, '- **What ships with every switch off.**').startsWith('- **What ships with every switch off.** Nothing a visitor sees or hears:')).toBe(true)
  })

  it('gives the tab bar\'s figures, the section\'s name\'s row with what Search would leave, and the tablet header in a short window', () => {
    const tabs = bullet(block, '- **The tab bar.**')
    for (const piece of ['57 pixels', '56', '320', '360', '390', '80 pixels', '11 pixels', '12 pixels', '`aria-current="page"`', '`--hairline`']) expect(tabs, piece).toContain(piece)
    const bar = bullet(block, '- **The app bar beside the tab bar.**')
    for (const piece of ['320', '390', 'Scholastic', 'News', 'Membership', 'About', 'Search', '44 by 44']) expect(bar, piece).toContain(piece)
    const hides = bullet(block, '- **When the dock hides.**')
    for (const piece of ['667 by 375', '568 by 320', '299 by 640', '844 by 390', '150 pixels', '`/login`']) expect(hides, piece).toContain(piece)
  })

  it('names each difference between the decided phone board and the brief that this step ruled on', () => {
    const board = bullet(block, '- **The board and the brief.**')
    for (const piece of ['`docs/redesign/decided-boards/Nav-Mobile-Final.dc.html`', '`#d9d8d1`', '`#e6cf86`', 'icons', 'after the footer', 'Menu button', 'above the tab bar', '844 by 390']) {
      expect(board, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS02 step 7: the lists', () => {
  it('records the step\'s decisions, each tagged with it, the five of the replan citing its lines', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'The dock holds the tab bar and the places of two bars (WS02 step 7).',
      'The dock writes its height, and the page keeps that room (WS02 step 7).',
      'The on-screen keyboard counts as open by the replan\'s rule (WS02 step 7).',
      'Short windows and high zoom take the app bar\'s Menu button (WS02 step 7).',
      'The event bar outranks the page\'s action bar (WS02 step 7).',
      'The Menu tab reads Close while the sheet is open (WS02 step 7).',
      'The app bar names the section the Menu tab stands for (WS02 step 7).',
      'One Menu sheet for the bars and the tab bar (WS02 step 7).',
      'The tab bar\'s words and icons come from the navigation model (WS02 step 7).',
      'The viewport tag follows the chrome (WS02 step 7).',
      'The tab bar\'s gold is held in its context and counted with its reason (WS02 step 7).',
      'The helper library back in the class helpers\' file (WS02 step 7).',
      'Log in passes the page from the tab too (WS02 step 7).',
    ])
    for (const [name, at] of [
      ['The on-screen keyboard counts as open by the replan\'s rule (WS02 step 7).', 'line 315'],
      ['Short windows and high zoom take the app bar\'s Menu button (WS02 step 7).', 'line 280'],
      ['The event bar outranks the page\'s action bar (WS02 step 7).', 'line 315'],
      ['The Menu tab reads Close while the sheet is open (WS02 step 7).', 'line 293'],
      ['The app bar names the section the Menu tab stands for (WS02 step 7).', 'line 284'],
    ] as const) {
      const entry = tagged(decisions).find((l) => head(l) === name) ?? ''
      expect(entry, name).toContain(at)
      expect(entry, name).toMatch(/replan/)
    }
  })

  it('records what differs from the brief, the plan or the notes for this workstream right after WS02 step 6\'s own entries, and before WS02 step 8\'s first', () => {
    const heads = entries(deviations).map(head)
    const own = [
      '`viewport-fit=cover` waits for `newLook` as well as `newNav` (WS02 step 7).',
      'The tab bar\'s line is the hairline token (WS02 step 7).',
      'The tab bar\'s gold kind is read in `test/unit/dark-spot-later.test.ts` (WS02 step 7).',
      'The room for the dock is kept after the footer (WS02 step 7).',
      'The dock comes after the footer in the page\'s order (WS02 step 7).',
      'The page\'s sides and the app bar\'s top keep clear of a notch too (WS02 step 7).',
      'The app bar\'s Menu button whenever no tab bar is drawn (WS02 step 7).',
      'The section\'s name is white, not the board\'s light gold (WS02 step 7).',
      'Tests of step 6 that the tab bar changes (WS02 step 7).',
      'The map items this step fills in (WS02 step 7).',
      'The keyboard rule leaves a field inside a dialog to the dialog (WS02 step 7).',
      'Files beyond the plan\'s list (WS02 step 7).',
    ]
    const at = heads.indexOf('Files beyond the plan\'s list (WS02 step 6).')
    expect(at).toBeGreaterThan(-1)
    expect(heads.slice(at + 1, at + 1 + own.length)).toEqual(own)
    expect(heads[at + 1 + own.length]).toBe('The footer\'s logo file (WS02 step 8).')
    // WS02 step 1 tagged two of the brief's own deviations with this step; they keep their places among the brief's.
    expect(tagged(deviations).map(head).filter((h) => !own.includes(h))).toEqual([
      'From v1.1: Donate in two taps on phones (WS02 step 7).',
      'From v1.3: `viewport-fit=cover` at build time (WS02 step 7).',
    ])
    // None takes a phrase of the brief's own deviation bullets, or the words the step 1 record test finds them by.
    for (const entry of entries(deviations).filter((l) => own.includes(head(l)))) {
      expect(entry).not.toMatch(/^- \*\*From v1\./)
      for (const phrase of ['written into `index.html` at build time', 'WS02 AC6 and WS12 AC6 follow', 'The mobile layout is M2 under 768 pixels']) expect(entry, phrase).not.toContain(phrase)
    }
  })

  it('resolves each verify item, found in the code or measured, in the order of the brief\'s own list', () => {
    const names = [
      'The tree', 'The viewport tag', 'The routes that hide the tab bar', 'The on-screen keyboard', 'High zoom', 'The order of the phone\'s chrome',
      'The sheet\'s open state', 'Pins on the tab bar and the dock', 'The helper library', 'The carried items', 'Lint and counts', 'The baseline',
      'The built site', 'The closing search', 'The grep check',
    ]
    expect(tagged(verify).map(head)).toEqual(names.map((n) => `${n} (WS02 step 7).`))
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^(Confirmed|Measured|Not found)\b/)
    expect(line('- **The grep check (WS02 step 7).**')).toMatch(/Measured: .*\d+ lines/)
  })

  it('gives the closing search\'s kinds, each with its files and a count by file, adding up to the lines it found', () => {
    const search = line('- **The closing search (WS02 step 7).**')
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

  it('ends WS01\'s follow-up on the gold, WS02 step 5\'s on phones and four of WS02 step 6\'s, each with a sentence of its own quoting no WS01 heading', () => {
    for (const name of CLOSED) {
      const entry = closed(name)
      const done = closing(entry, 'Done in WS02 step 7:')
      expect(done, name).not.toBe('')
      expect(entry.endsWith(done), name).toBe(true)
      expect(done, name).not.toMatch(/"[^"]*\(step \d+\)"/)
    }
    expect(closing(closed('From WS01: WS02\'s gold (WS02 step 7).'), 'Done in WS02 step 7:')).toContain('`test/unit/goldText.test.ts`')
    const tab = closing(closed('Tab through a bar on a scrolled page (WS02 step 6).'), 'Done in WS02 step 7:')
    for (const piece of ['1280', '900', '390', '0 pixels', '`src/index.css`']) expect(tab, piece).toContain(piece)
    const library = closing(closed('The helper library back in the main script (WS02 step 6).'), 'Done in WS02 step 7:')
    for (const piece of ['`utils-*.js`', '`/scanner`', '`/tournaments`', '`/scholastic`']) expect(library, piece).toContain(piece)
  })

  it('closes the seven follow-ups the reviews handed on, then adds its own, and keeps the twelve WS01 handed on', () => {
    const own = tagged(followUps)
    expect(own.map(head)).toEqual([
      'From WS01: WS02\'s gold (WS02 step 7).',
      ...CARRIED,
      'The footer above the tab bar (WS02 step 7).',
      'The search field and the keyboard (WS02 step 7).',
      'Search beside the section\'s name (WS02 step 7).',
      'The event bar in the dock (WS02 step 7).',
      'The to-do count on the account tab (WS02 step 7).',
      'The tab bar in the sweep (WS02 step 7).',
      'The Register bar in the dock (WS02 step 7).',
      'The home page\'s first visit moves its main (WS02 step 7).',
      'K looks at the tab bar on a phone (WS02 step 7).',
    ])
    const files: Record<string, string> = {
      [CARRIED[0]]: '`src/index.css`', [CARRIED[1]]: '`src/components/layout/headerParts.ts`', [CARRIED[2]]: '`test/unit/tablet-header.test.tsx`',
      [CARRIED[3]]: '`aria-current="true"`', [CARRIED[4]]: '`test/unit/e2e-preview-guard.test.ts`', [CARRIED[5]]: '`package.json`',
      [CARRIED[6]]: '`test/unit/redesign-status-ws02-step1.test.ts`',
    }
    for (const name of CARRIED) {
      const entry = own.find((l) => head(l) === name) ?? ''
      const done = closing(entry, 'Done in WS02 step 7:')
      expect(done, name).not.toBe('')
      expect(entry.endsWith(done)).toBe(true)
      expect(done).not.toMatch(/\(step \d+\)/)
      expect(done, name).toContain(files[name])
    }
    expect(entries(followUps).filter((l) => l.startsWith('- **From WS01: '))).toHaveLength(12)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 7: plain language', () => {
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
    expect(block).not.toMatch(/\.github\//)
    expect(block).not.toContain('_' + '_fixtures')
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

describe('REDESIGN_STATUS.md, WS02 step 7: its claims against the files', () => {
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

  it('finds the tab bar\'s entry in the gold fixture as it was: #866a1e in its file, a bar and not words, on the tab bar\'s surface above the hairline token', () => {
    const fixture = read('test/unit/fixtures/goldAllowlist.ts')
    const at = fixture.indexOf('file: \'src/components/layout/BottomTabs.tsx\'')
    expect(at).toBeGreaterThan(-1)
    const tabBar = fixture.slice(fixture.lastIndexOf('{', at), fixture.indexOf('},', at))
    for (const piece of ['colour: \'#866a1e\'', 'use: \'bar\'', 'bg-surface', '--hairline', '5.13:1']) expect(tabBar, piece).toContain(piece)
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
    // The files whose count grows with no change of their own, each written with its count and its count before.
    const grown = [...bullet(files, '  - Grown with no change:').matchAll(/`[^`]+` \((\d+), (\d+) before: /g)].map((m) => Number(m[1]) - Number(m[2]))
    for (const n of [...fresh, ...gains]) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + [...fresh, ...gains, ...grown].reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
    expect(line('- **Lint and counts (WS02 step 7).**')).toContain(`unit ${before} tests in ${beforeFiles} files`)
    // No integration test is added or changed, so its counts are the base's.
    const integration = /integration ([\d,]+) in (\d+) files, as on the base/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    expect(line('- **Lint and counts (WS02 step 7).**')).toContain(`integration ${integration![1]} in ${integration![2]}`)
  })

  it('gives browser counts that add up: the base\'s and the new cases in each project, the runs and the Checks line alike', () => {
    const files = bullet(block, '- **Files.**')
    const grew = SPECS.map((name) => {
      const m = new RegExp(`\`${escape(name)}\` \\((\\d+) in each project, (?:(\\d+) before|as before): `).exec(files)
      return m ? Number(m[1]) - Number(m[2] ?? m[1]) : NaN
    })
    const fresh = NEW_SPECS.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+) in each project: `).exec(files)?.[1]))
    for (const n of [...grew, ...fresh]) expect(Number.isNaN(n)).toBe(false)
    const added = 2 * [...grew, ...fresh].reduce((a, n) => a + n, 0)
    const runs = bullet(block, '- **The browser runs.**')
    const base = /the base's run: ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip/.exec(runs)
    expect(base, 'the base\'s run').not.toBeNull()
    const quoted = [...runs.matchAll(/"Running ([\d,]+) tests using 2 workers", (?:"(\d+) failed", )?"([\d,]+) skipped" and "([\d,]+) passed/g)]
    expect(quoted.length).toBeGreaterThanOrEqual(1)
    const [, total, failed, skipped, passed] = quoted.at(-1)!
    expect(num(total)).toBe(num(base![1]) + added)
    expect(num(skipped) + num(passed) + Number(failed ?? 0)).toBe(num(total))
    // The last run quoted is the one the step ends on, with nothing failed.
    expect(failed).toBeUndefined()
    expect(checksLine).toContain(`${total} tests, ${passed} that run and ${skipped} that skip`)
    // Each project's tests, run and skipped, add up to the run's.
    const projects = /`a11y-on` holds ([\d,]+) tests \(([\d,]+) that run and ([\d,]+) that skip\) and `a11y-off` ([\d,]+) \(([\d,]+) and ([\d,]+)\)/.exec(runs)
    expect(projects, 'the counts in each project').not.toBeNull()
    const [on, onRun, onSkip, off, offRun, offSkip] = projects!.slice(1).map(num)
    expect([onRun + onSkip, offRun + offSkip]).toEqual([on, off])
    expect([on + off, onRun + offRun, onSkip + offSkip]).toEqual([num(total), num(passed), num(skipped)])
  })

  it('gives the helper library\'s figures the same in the block, the follow-up it ends and the verify item', () => {
    const library = bullet(block, '- **The helper library.**')
    const pages = /every page fetches (\d+) files and `\/scanner` (\d+)/.exec(library)
    expect(pages, 'the files every page and /scanner fetch').not.toBeNull()
    for (const text of [closing(closed('The helper library back in the main script (WS02 step 6).'), 'Done in WS02 step 7:'), line('- **The helper library (WS02 step 7).**')]) {
      expect(text).toContain(`every page fetches ${pages![1]} files and \`/scanner\` ${pages![2]}`)
    }
  })
})
