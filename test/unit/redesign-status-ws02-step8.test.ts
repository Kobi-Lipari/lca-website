// test/unit/redesign-status-ws02-step8.test.ts
//
// REDESIGN_STATUS.md records WS02 step 8, the last of checkpoint F: the new
// footer with the chrome on, the dock before it in the page's order, the two
// pages its links reach, and the three items the reviews of WS02 step 7
// handed on. Like the record tests of WS02's first seven steps, this file
// reads only the WS02 section and the lines the step wrote outside its block
// (the Status and PR lines, the date line's part, the sentences it added to
// eight map items, the sentences that end four older follow-ups and four
// older deviations), never every table row or heading of the file. Pinned
// here: the Status and PR lines in forms the next steps keep; the date
// line's parts; the map; the step's block with every part and every file;
// the Checkpoint F section; the decisions, deviations, verify items and
// follow-ups, each with its tag and in its place; the plain-language rules
// over all of it; and, checked against the files they describe, the
// record's claims: the new files, and the figures it states in more than one
// place, which must agree. It reads no switch, no line of the footer's
// columns or of the dock's places, which later steps are named to change,
// and never the build's own date, so K turning a switch on, a column gaining
// a link, the event bar in the dock or the record of checkpoint F's merge
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
/** What a draft would hold before its figures were filled in, the stand-in marks of this step's drafts among them. */
const UNFILLED = new RegExp(`${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}`)

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
const TAG = '(WS02 step 8).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
/** What this step added to an older line: from `from` to the end of the line. */
const closing = (entry: string, from: string) => (entry.includes(from) ? entry.slice(entry.indexOf(from)) : '')

const ws02 = between(status, '## WS02: Information architecture and navigation', '\n## WS03:')
/** A part of the WS02 section, from its heading to the next: the heading as a line of its own, since a sentence may name one in backticks. */
const part = (heading: string) => {
  const at = ws02.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws02.slice(at + 1), heading, '\n### ')
}
const STEP = '### WS02 step 8: the new footer'
const BEFORE = '### WS02 step 7: the tab bar and the bottom dock'
const CHECKPOINT = '### Checkpoint F: WS02 steps 6 to 8'
const block = part(STEP)
const checkpoint = part(CHECKPOINT)
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

/** The map items this step proves, each keeping WS02 step 8 as its planned step. */
const PROVED = ['AC7', 'AC8', 'AC11', 'AC13', 'AC18', 'Q32']
/** The map items other steps own that this step built a part of, each with the planned step it keeps as its last words. */
const BUILT: ReadonlyArray<readonly [string, number]> = [['AC9', 16], ['AC23', 3]]
/** The older deviations this step ends with a sentence of its own, each read from that sentence to the entry's end. */
const ENDED: ReadonlyArray<readonly [string, string]> = [
  ['The room for the dock is kept after the footer (WS02 step 7).', 'Since WS02 step 8 the room is the footer\'s `padding-bottom`'],
  ['The dock comes after the footer in the page\'s order (WS02 step 7).', 'Since WS02 step 8 the dock comes after the main and before the footer'],
  ['The footer\'s logo file (WS02 step 8).', 'Built in WS02 step 8: `src/assets/lca-logo-56.webp`'],
  ['Two pages read the footer\'s links (WS02 step 8).', 'Built in WS02 step 8: `src/pages/ContactPage.tsx`'],
]
const deviation = (name: string) => entries(deviations).find((l) => head(l) === name) ?? ''
/** The older follow-ups this step ends with a sentence of its own, and a piece each sentence names. */
const CLOSED: ReadonlyArray<readonly [string, string]> = [
  ['The helper\'s answer moves with the chrome (WS02 step 4).', '`test/unit/chrome-helper.test.tsx`'],
  ['The footer\'s Donate (WS02 step 5).', '`DonateDialog`'],
  ['The footer\'s theme switch (WS02 step 6).', '`appearanceControl`'],
  ['The footer above the tab bar (WS02 step 7).', '`#main-content ~ footer`'],
]
const closed = (name: string) => entries(followUps).find((l) => head(l) === name) ?? ''
/** The follow-ups the reviews of WS02 step 7 handed on, each ended in this step, and the file each names. */
const CARRIED: ReadonlyArray<readonly [string, string]> = [
  ['From WS02 step 7: the dock\'s width under the scroll lock (WS02 step 8).', '`src/components/layout/BottomDock.tsx`'],
  ['From WS02 step 7: the Menu buttons\' and the Menu tab\'s slots (WS02 step 8).', '`src/components/layout/dockParts.ts`'],
  ['From WS02 step 7: the current mark and the section\'s name in any letter case (WS02 step 8).', '`src/lib/nav.ts`'],
]

/** Everything this step wrote, each piece on its own. */
const written = [
  block, checkpoint, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), statusLine, prLine, datePart,
  ...PROVED.map((id) => closing(mapItem(id), 'Proved in step 8 by')), ...BUILT.map(([id]) => closing(mapItem(id), 'Built in step 8:')),
  ...CLOSED.map(([name]) => closing(closed(name), 'Done in WS02 step 8:')), ...ENDED.map(([name, from]) => closing(deviation(name), from)),
]
/** The same, with what sits in backticks taken out, since code is not prose. */
const prose = written.map((text) => text.replace(/`[^`\n]*`/g, '``'))

/**
 * The files this step adds: the footer and its date's reader, the logo's two files, their tests, the frozen footer and the
 * record's test, and the six unit files and the spec, written once the rest was built, that hold the step's parts at their edges.
 */
const NEW_FILES = [
  'src/components/layout/SiteFooter.tsx', 'src/components/layout/footerParts.ts', 'src/assets/lca-logo-56.webp', 'src/assets/lca-logo-112.webp',
  'test/unit/footer.test.tsx', 'test/unit/footer-today.test.tsx', 'test/unit/fixtures/footer-today.tsx', 'test/unit/footer-page-links.test.tsx',
  'test/unit/redesign-status-ws02-step8.test.ts',
  'test/unit/build-date-edges.test.ts', 'test/unit/footer-edges.test.tsx', 'test/unit/footer-page-links-edges.test.tsx', 'test/unit/frame-footer-edges.test.tsx',
  'test/unit/nav-letter-case-edges.test.ts', 'test/unit/footer-ground-edges.test.ts', 'test/a11y/footer-edges.spec.ts',
]
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
/** The new specs, with their counts in each project. */
const NEW_SPECS = NEW_FILES.filter((f) => /^test\/a11y\/.*\.spec\.ts$/.test(f))
/** The new files that hold text. */
const NEW_TEXT = NEW_FILES.filter((f) => !f.endsWith('.webp'))
/** The specs this step changes, with their counts in each project. */
const SPECS = ['test/a11y/nav.spec.ts', 'test/a11y/dock.spec.ts', 'test/a11y/nav-bars-edges.spec.ts']
/** The unit test files whose count grows with no change of their own, each with its count and its count before. */
const GROWN = ['test/unit/chrome-reads.test.ts']
/** The unit test files this step changes, each with its count written in the block. */
const CHANGED_TESTS = [
  'test/unit/lca-mark.test.tsx', 'test/unit/brand-edges.test.tsx', 'test/unit/image-budget.test.ts', 'test/unit/dock-build-edges.test.ts',
  'test/unit/prepaint-gate.test.ts', 'test/unit/goldText.test.ts', 'test/unit/gold-ink.test.ts', 'test/unit/contrast.test.ts',
  'test/unit/base-components-scope.test.ts', 'test/unit/mobile-menu.test.tsx', 'test/unit/bottom-dock.test.tsx', 'test/unit/app-frame.test.tsx',
  'test/unit/bottom-dock-edges.test.tsx', 'test/unit/chrome-bars-app.test.tsx', 'test/unit/chrome-helper.test.tsx', 'test/unit/redesign-status-ws02-step3.test.ts',
  'test/unit/nav.test.ts', 'test/unit/mobile-app-bar.test.tsx', 'test/unit/site-header.test.tsx', 'test/unit/site-header-menus.test.tsx',
  'test/unit/redesign-status-step25.test.ts',
]
/** The other files this step changes. */
const CHANGED = [
  'src/components/layout/Footer.tsx', 'src/components/LcaLogo.tsx', 'src/components/AppearanceControl.tsx', 'scripts/images.mjs', 'vite.config.ts',
  'src/App.tsx', 'src/index.css', 'src/pages/ContactPage.tsx', 'src/pages/ClubsPage.tsx', 'src/components/layout/BottomDock.tsx',
  'src/components/layout/BottomTabs.tsx', 'src/components/layout/MobileAppBar.tsx', 'src/components/layout/SiteHeader.tsx',
  'src/components/layout/dockParts.ts', 'src/lib/nav.ts', 'scripts/codemods/gold-ink.ts', 'test/a11y/chrome.ts',
]
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))

describe('REDESIGN_STATUS.md, WS02 step 8: the lines outside the block', () => {
  it('says in the Status line that steps 1 to 8 are built, or, once a later step has landed, steps 1 to that step', () => {
    const start = '**Status:** in progress: nineteen steps in five checkpoints (E for steps 1 to 5, F for 6 to 8, G for 9 to 11, H for 12 to 16, I for 17 to 19); '
    expect(statusLine.startsWith(start)).toBe(true)
    const built = /^steps 1 to (\d+) are built\.$/.exec(statusLine.slice(start.length))
    expect(built, statusLine).not.toBeNull()
    expect(Number(built![1])).toBeGreaterThanOrEqual(8)
  })

  it('names checkpoint E\'s pull request and checkpoint F\'s, number 118, in the PR line, and never calls a merge pending', () => {
    expect(prLine.startsWith('**PR:** ')).toBe(true)
    for (const piece of ['pull request 110', 'checkpoint E (steps 1 to 5)', 'checkpoint F (steps 6 to 8)', 'pull request 118']) expect(prLine, piece).toContain(piece)
    expect(prLine).not.toContain('is pending')
  })

  it('keeps WS01\'s part of the date line first and word for word, and puts step 8 first in WS02\'s part, ahead of step 7', () => {
    const after = dateLine.replace(/^Last updated: \S+ /, '')
    expect(after.startsWith('(WS01, step 32: a11y sweep; step 31: heritage layout; step 30: heritage fonts; step 29: hero images; step 28: brand marks; step 27: chess data; step 26: status tags; step 25: gold text; step 24: colours; step 23: grounds; step 22: ThemeScope; step 21: dark mode; step 20 opened checkpoint D; checkpoint C, after step 16, step 17 and step 18, is merged; checkpoint D is merged; WS02, ')).toBe(true)
    expect(after).toMatch(/; WS02, (?:[^;()]+; )*step 8: new footer, the last of checkpoint F; step 7: tab bar and bottom dock, the second of checkpoint F; step 6: Menu sheet, tablet header and app bar, the first of checkpoint F; step 5: desktop header and About menu, the last of checkpoint E; /)
    expect(after.endsWith('step 1: record and brief 1.4)')).toBe(true)
    expect((/^Last updated: (\d{4}-\d{2}-\d{2}) /.exec(dateLine)?.[1] ?? '') >= '2026-11-01').toBe(true)
  })

  it('ends four older deviations with a sentence of its own, each the entry\'s last words, their heads as they were', () => {
    for (const [name, from] of ENDED) {
      const entry = deviation(name)
      const done = closing(entry, from)
      expect(done, name).not.toBe('')
      expect(entry.endsWith(done), name).toBe(true)
      expect(entry.split(from), name).toHaveLength(2)
    }
    expect(closing(deviation(ENDED[0][0]), ENDED[0][1])).toContain('`#main-content ~ footer`')
    expect(closing(deviation(ENDED[1][0]), ENDED[1][1])).toContain('the skip link still comes first')
    expect(closing(deviation(ENDED[2][0]), ENDED[2][1])).toContain('`scripts/images.mjs`')
    expect(closing(deviation(ENDED[3][0]), ENDED[3][1])).toContain('`id="map"`')
  })
})

describe('REDESIGN_STATUS.md, WS02 step 8: the map', () => {
  it('still maps the 23 criteria and the 12 decisions, each with exactly one planned step and no second "WS02 step"', () => {
    expect(mapItems.filter((l) => /^- \*\*AC\d+\.\*\*/.test(l))).toHaveLength(23)
    expect(mapItems).toHaveLength(35)
    for (const item of mapItems) {
      expect(item.match(/Planned: WS02 step \d+\./g), head(item)).toHaveLength(1)
      expect(item.match(/WS02 step \d+/g), head(item)).toHaveLength(1)
      expect(item, head(item)).not.toMatch(/\bin step 4\b/)
    }
  })

  it('says what proves AC7, AC8, AC11, AC13, AC18 and Q32, each once, each keeping WS02 step 8 as its last words', () => {
    for (const id of PROVED) {
      const item = mapItem(id)
      expect(item.split('Proved in step 8 by '), id).toHaveLength(2)
      expect(item.endsWith('Planned: WS02 step 8.'), id).toBe(true)
    }
    // AC13's comes right after the criterion's own words, before WS02 step 3's sentence, which keeps its place;
    // AC11's after WS02 step 7's sentence, which the item holds once.
    expect(mapItem('AC13').indexOf('Proved in step 8 by ')).toBeLessThan(mapItem('AC13').indexOf('Built in step 3: '))
    expect(mapItem('AC13')).toContain('the tab bar and the footer\'s folded links are proved in step 8. Planned: WS02 step 8.')
    expect(mapItem('AC13')).not.toContain('step 7')
    expect(mapItem('AC11').split('Built in step 7: ')).toHaveLength(2)
    expect(mapItem('AC11').indexOf('Built in step 7: ')).toBeLessThan(mapItem('AC11').indexOf('Proved in step 8 by '))
    for (const [id, piece] of [
      ['AC7', '`LouisianaChess@gmail.com`'], ['AC7', '`Sat, Oct 31, 2026`'], ['AC7', 'at build time'], ['AC8', 'three mixes of the switches on'],
      ['AC11', '"Board & regions"'], ['AC11', '"Scholastic"'], ['AC13', '`aria-expanded`'], ['AC13', '`/tournaments`'], ['AC18', '`/about/board`'],
      ['AC18', '`test/unit/site-header-menus.test.tsx`'], ['Q32', '`src/assets/lca-logo-56.webp`'], ['Q32', '`src/assets/lca-logo-112.webp`'], ['Q32', '16,468'],
    ] as const) expect(closing(mapItem(id), 'Proved in step 8 by'), `${id}: ${piece}`).toContain(piece)
  })

  it('says what this step built of AC9 and AC23, which other steps own, each keeping its planned step as its last words', () => {
    for (const [id, planned] of BUILT) {
      const item = mapItem(id)
      expect(item.split('Built in step 8: '), id).toHaveLength(2)
      expect(item.endsWith(`Planned: WS02 step ${planned}.`), id).toBe(true)
    }
    expect(mapItem('AC9').indexOf('Built in step 7: ')).toBeLessThan(mapItem('AC9').indexOf('Built in step 8: '))
    expect(closing(mapItem('AC9'), 'Built in step 8:')).toContain('`#main-content ~ footer`')
    expect(closing(mapItem('AC23'), 'Built in step 8:')).toContain('`~ footer`')
    // WS02 step 3's figures keep their place in AC23, before this step's sentence.
    expect(mapItem('AC23').indexOf('Proved in step 3 by ')).toBeLessThan(mapItem('AC23').indexOf('Built in step 8: '))
  })

  it('leaves AC14 and AC19, which WS02 step 18 proves, as they were, and keeps the sentence the map closes with, word for word', () => {
    expect(mapItem('AC14')).not.toContain('step 8')
    expect(mapItem('AC19')).not.toContain('step 8')
    expect(map).toContain('Steps 2, 4, 6, 10, 14 and 19 fill in no item: step 2 builds what every criterion reads (the navigation model, the chrome\'s one condition and the signed-in visitor of the browser tests), step 4 moves the browser specs\' reads of the chrome into one helper, step 6 builds the sheet that AC3 and AC6 are proved on, steps 10 and 14 prove halves of AC5 and AC4, and step 19 closes the record.')
  })
})

describe('REDESIGN_STATUS.md, WS02 step 8: the step block', () => {
  it('sits after WS02 step 7\'s block, then the Checkpoint F section, then the decisions, once each', () => {
    const at = [BEFORE, STEP, CHECKPOINT, '### WS02 decisions'].map((h) => ws02.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws02.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(ws02.split(`\n${CHECKPOINT}\n`)).toHaveLength(2)
  })

  it('has every part, in order, every file and nothing left to fill in', () => {
    const parts = [
      '- **Files.**', '- **The footer.**', '- **The brand block and the logo.**', '- **The build date and the trust line.**', '- **The fold below 768 pixels.**',
      '- **The theme switch and Donate.**', '- **The two pages.**', '- **The dock before the footer.**', '- **The carried items.**', '- **The WS02 gold and the rings.**',
      '- **The helper.**', '- **The board and the brief.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**',
      '- **Build.**', '- **The browser runs.**', '- Checks:',
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
    for (const name of GROWN) expect(bullet(files, '  - Grown with no change:'), name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, \\d+ before: `))
    expect(block).toContain('Baseline matches: no colour or font changed.')
    expect(block).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(12)
    // Among them the logo's quality and densities, the folds' state kept, the dock's class of the scroll lock and today's two buttons left out.
    for (const piece of ['quality 90', 'two densities', 'across a crossing of 768 pixels', 'a change of page', '`width-before-scroll-bar`', '"Find a tournament"']) {
      expect(calls, piece).toContain(piece)
    }
    for (const text of [block, checkpoint, decisions, deviations, verify, followUps, map, statusLine, prLine, datePart]) expect(text).not.toMatch(UNFILLED)
  })

  it('says what a visitor sees by switch, and that nothing ships with every switch off', () => {
    expect(block).toContain('What a visitor sees, by switch: with every switch off, nothing; with `newLook` alone and with `newNav` alone, the same, today\'s footer, contact page and clubs page as they were; with the chrome on, the new footer at every width, its columns folded below 768 pixels with Contact open, the logo from its sized files, the build\'s date in its trust line, the dock before it in the page\'s order, the contact page\'s subject filled from the footer\'s two links and the clubs page brought to its map.')
    expect(bullet(block, '- **What ships with every switch off.**').startsWith('- **What ships with every switch off.** Nothing a visitor sees or hears:')).toBe(true)
  })

  it('gives the footer\'s columns link by link with every switch off, what each switch adds or moves, and its heights by width', () => {
    const footer = bullet(block, '- **The footer.**')
    for (const piece of [
      'Tournaments (`/tournaments`)', 'Scholastic (`/scholastic`)', 'State champions (`/champions`)', 'Scoresheet scanner (`/scanner`)', 'Clubs (`/clubs`)',
      'Club map (`/clubs#map`)', 'List or update your club (`/contact?subject=club`)', 'News (`/news`)', 'LCA on Facebook ↗', 'About LCA (`/about`)',
      'Board & regions (`/governance/board`)', 'Bylaws & rules (`/governance/bylaws`)', 'Minutes (`/governance/minutes`)', 'Annual meeting (`/meeting`)',
      '`LouisianaChess@gmail.com`', 'Contact (`/contact`)', 'Membership help (`/contact?subject=membership`)', 'Website help (`/support`)', 'Donate',
      '`newTournaments`', '`newNews`', '`newClubs`', '`newAbout`', '`newMembership`', '`/give`', '<footer data-slot="site-footer" data-ring-ground="navy">',
    ]) expect(footer, piece).toContain(piece)
    for (const width of ['390', '768', '1023', '1024', '1280']) expect(footer, width).toMatch(new RegExp(`\\b${width}\\b`))
  })

  it('gives the logo\'s two files with their sizes, bytes and sha256, and the bytes fetched at each density against the official file and WS01 step 29\'s lab check', () => {
    const logo = bullet(block, '- **The brand block and the logo.**')
    for (const piece of [
      '`src/assets/lca-logo-56.webp`', '56 by 56 pixels and 1,818 bytes', '`5c1992cc7ae3e4cc3e3fefc2ce45e862df2112a273f9f0070051951b85437ec3`',
      '`src/assets/lca-logo-112.webp`', '112 by 112 pixels and 4,596 bytes', '`845e5220835af0faf4cc95f7d9546595fc876ce119cb1364783449292db3137f`',
      '16,468', 'WS01 step 29\'s lab check', '"about 15 KB"', '`npm run images`', '`sized`', '`srcset`', '`assetsInlineLimit`',
    ]) expect(logo, piece).toContain(piece)
    // The bytes saved at each density are the official file's less each sized file's.
    expect(logo).toContain(`${(16468 - 1818).toLocaleString('en-US')} and ${(16468 - 4596).toLocaleString('en-US')} bytes fewer`)
  })

  it('says the date is the build\'s, written into the page at build time with the chrome on alone, in the form the trust line draws', () => {
    const date = bullet(block, '- **The build date and the trust line.**')
    for (const piece of [
      'which the plugin writes into the page at build time', 'Only a build with the chrome on writes it', 'the date is the build\'s, not the commit\'s',
      'the CI build and the Pages build each run at their own time', '`<meta name="build-date">`', '`Sat, Oct 31, 2026`', '`Fri, Oct 30, 2026`',
      'hidden from screen readers', 'no script holds the build\'s instant',
    ]) expect(date, piece).toContain(piece)
  })

  it('names each difference between the decided footer board and the brief that this step ruled on', () => {
    const board = bullet(block, '- **The board and the brief.**')
    for (const piece of ['`docs/redesign/decided-boards/Nav-Footer-Final.dc.html`', 'plate', 'radio group', 'Suggest a club', '`#e6cf86`', 'not a link', 'chevron', '32 pixels', 'copyright', 'line 312', '" (opens in a new tab)"']) {
      expect(board, piece).toContain(piece)
    }
  })

  it('says the footer\'s layout is chosen from the widths its fold asks, read in the browser at other default font sizes, with a judgement call for it', () => {
    const fold = bullet(block, '- **The fold below 768 pixels.**')
    for (const piece of [
      'are chosen from the same two widths as the fold', 'from none of the stylesheet\'s breakpoints', 'at 20 pixels in a window 800 wide', 'at 24 in one 1100 wide',
      'at 14 in one 700 wide', 'at nine widths from 320 to 1600 pixels', '`test/unit/footer.test.tsx`', '`test/a11y/nav.spec.ts`',
    ]) expect(fold, piece).toContain(piece)
    expect(bullet(block, '- **Judgement calls.**')).toContain('The footer\'s layout is chosen from the widths its fold asks')
  })

  it('names, in the helper bullet, each marked check that stops on a11y-on and where it still runs', () => {
    const helper = bullet(block, '- **The helper.**')
    for (const piece of ['`test/a11y/brand.spec.ts`\'s four', '`test/a11y/home.spec.ts`\'s one', '`test/a11y/brand-edges.spec.ts`\'s one', 'on no build', '`a11y-off`', '`smoke.spec.ts` 55', '`scopes.spec.ts` 205 and 238']) {
      expect(helper, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS02 step 8: the Checkpoint F section', () => {
  it('opens waiting for its merge, or once it has merged, with the merge commit and its day, and never calls the merge pending in the old words', () => {
    const first = checkpoint.split('\n')[2] ?? ''
    const waiting = first.startsWith('**Not merged yet: checkpoint F waits for its merge into `main`** (draft pull request 118)')
    const merged = /^\*\*Merged into `main` as `[0-9a-f]{7,40}` on (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]+ \d{1,2}, \d{4}/.test(first)
    expect(waiting || merged, first.slice(0, 120)).toBe(true)
    expect(checkpoint).not.toMatch(/merge into `main` is pending|checkpoint D's merge is pending/)
    expect(checkpoint).toContain('It changes no database.')
    // The whole file still holds the one line WS02 step 1's test allows.
    expect(lines.filter((l) => /checkpoint D's merge is pending|merge into `main` is pending/.test(l))).toHaveLength(1)
  })

  it('has a bullet for each of its three steps and each part a checkpoint\'s section gives', () => {
    for (const name of [
      '- **WS02 step 6:**', '- **WS02 step 7:**', '- **WS02 step 8:**', '- **What the merge does to production.**', '- **Before merging.**', '- **Rollback.**',
      '- **For K, on a preview, with the chrome on.**', '- **Checks at the end of the checkpoint.**',
    ]) expect(checkpoint.split('\n').filter((l) => l.startsWith(name)), name).toHaveLength(1)
    const production = bullet(checkpoint, '- **What the merge does to production.**')
    for (const piece of ['No migration.', '`0058_state_champion_2026.sql`', 'No server change.', '`deploy-worker.yml`', '`migrate-db.yml`', 'Pages rebuilds the site.', '`8d7df98`']) {
      expect(production, piece).toContain(piece)
    }
    expect(bullet(checkpoint, '- **Rollback.**')).toContain('`git revert -m 1 <merge sha>`')
    expect(bullet(checkpoint, '- **For K, on a preview, with the chrome on.**')).toContain('"K looks at today\'s chrome under newLook on a preview (WS02 step 4)."')
  })

  it('names every switch, all 42, each off, read from its words', () => {
    const switches = bullet(checkpoint, '- **What the merge does to production.**').split('\n').find((l) => l.trim().startsWith('- Every switch in `src/lib/features.ts` is off, all 42:')) ?? ''
    expect(switches).not.toBe('')
    const named = [...switches.slice(0, switches.indexOf(', each `false`')).matchAll(/`([a-zA-Z][a-zA-Z0-9]*)`/g)].map((m) => m[1])
    expect(new Set(named).size).toBe(42)
    expect(named).toHaveLength(42)
  })

  it('says what reaches a visitor with every switch off and with newLook as well, with the baseline unchanged', () => {
    const production = bullet(checkpoint, '- **What the merge does to production.**')
    expect(production).toContain('What reaches a visitor with every switch off: nothing a visitor sees or hears.')
    expect(production).toContain('What reaches a visitor with `newLook` on as well, the switch K turns on first: nothing of checkpoint F')
    expect(production).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
  })
})

describe('REDESIGN_STATUS.md, WS02 step 8: the lists', () => {
  it('records the step\'s decisions, each tagged with it', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'The new footer draws the navigation model\'s four columns (WS02 step 8).',
      'Every footer link and button is an entry by id (WS02 step 8).',
      'The footer\'s logo comes from two sized files (WS02 step 8).',
      'The site\'s build date is written at build time and shown in Central time (WS02 step 8).',
      'The columns fold below 768 pixels, Contact open (WS02 step 8).',
      'The footer\'s theme switch has a label of its own (WS02 step 8).',
      'The footer\'s Donate opens the same dialog (WS02 step 8).',
      'The dock comes before the footer (WS02 step 8).',
      'The contact page and the clubs page read the footer\'s links (WS02 step 8).',
      'The Menu controls are found by slots of their own (WS02 step 8).',
      'The current mark and the section\'s name in any letter case (WS02 step 8).',
    ])
  })

  it('records what differs from the brief, the plan or the notes for this workstream right after the planned entry on the two pages, and before WS02 step 9\'s first', () => {
    const heads = entries(deviations).map(head)
    const own = [
      'The footer\'s logo from two sized files and a srcset (WS02 step 8).',
      'The footer\'s join slot follows the header\'s rule (WS02 step 8).',
      'The theme switch is a group of pressed buttons (WS02 step 8).',
      'The map items this step fills in (WS02 step 8).',
      'Files beyond the plan\'s list (WS02 step 8).',
    ]
    const at = heads.indexOf('Two pages read the footer\'s links (WS02 step 8).')
    expect(at).toBeGreaterThan(-1)
    expect(heads[at - 1]).toBe('The footer\'s logo file (WS02 step 8).')
    expect(heads[at - 2]).toBe('Files beyond the plan\'s list (WS02 step 7).')
    expect(heads.slice(at + 1, at + 1 + own.length)).toEqual(own)
    expect(heads[at + 1 + own.length]).toBe('The search normaliser in `domain/` (WS02 step 9).')
    // The brief's own entry tagged with this step keeps its place among the brief's.
    expect(tagged(deviations).map(head).filter((h) => ![...own, 'The footer\'s logo file (WS02 step 8).', 'Two pages read the footer\'s links (WS02 step 8).'].includes(h))).toEqual([
      'From v1.1: the footer\'s columns (WS02 step 8).',
    ])
    // None takes a phrase of the brief's own deviation bullets, or the words the step 1 record test finds them by.
    for (const entry of entries(deviations).filter((l) => own.includes(head(l)))) {
      expect(entry).not.toMatch(/^- \*\*From v1\./)
      for (const phrase of ['written into `index.html` at build time', 'WS02 AC6 and WS12 AC6 follow', 'The mobile layout is M2 under 768 pixels']) expect(entry, phrase).not.toContain(phrase)
    }
  })

  it('resolves each verify item, found in the code or measured, in the order of the brief\'s own list', () => {
    const names = [
      'The tree', 'Today\'s footer', 'The logo\'s file', '`?subject=` on the contact page', 'The club map\'s anchor', 'Website help', 'The build date',
      'The governance links elsewhere', 'Line pins in the pages this step edits', 'The carried items', 'Lint and counts', 'The baseline', 'The built site',
      'The closing search', 'The grep check',
    ]
    expect(tagged(verify).map(head)).toEqual(names.map((n) => `${n} (WS02 step 8).`))
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^(Confirmed|Measured|Not found)\b/)
    expect(line('- **The grep check (WS02 step 8).**')).toMatch(/Measured: .*\d+ lines/)
    // The dashes the clubs page keeps on lines this step does not write are named, not passed over.
    expect(line('- **The grep check (WS02 step 8).**')).toContain('Two dashes stay in `src/pages/ClubsPage.tsx`')
  })

  it('gives the closing search\'s kinds, each with its files and a count by file, adding up to the lines it found', () => {
    const search = line('- **The closing search (WS02 step 8).**')
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

  it('ends four older follow-ups, each with a sentence of its own quoting no WS01 heading', () => {
    for (const [name, piece] of CLOSED) {
      const entry = closed(name)
      const done = closing(entry, 'Done in WS02 step 8:')
      expect(done, name).not.toBe('')
      expect(entry.endsWith(done), name).toBe(true)
      expect(done, name).not.toMatch(/"[^"]*\(step \d+\)"/)
      expect(done, name).toContain(piece)
    }
  })

  it('closes the three follow-ups the reviews of WS02 step 7 handed on, then adds its own, and keeps the twelve WS01 handed on', () => {
    const own = tagged(followUps)
    expect(own.map(head)).toEqual([
      ...CARRIED.map(([name]) => name),
      'Checkpoint F\'s merge in the record (WS02 step 8).',
      'Search in the Menu buttons\' row (WS02 step 8).',
      'Search\'s page rows land on the footer\'s addresses (WS02 step 8).',
      'The event bar in the dock before the footer (WS02 step 8).',
      'The footer in the sweep (WS02 step 8).',
      'K looks at the new footer on a preview (WS02 step 8).',
    ])
    for (const [name, file] of CARRIED) {
      const entry = own.find((l) => head(l) === name) ?? ''
      const done = closing(entry, 'Done in WS02 step 8:')
      expect(done, name).not.toBe('')
      expect(entry.endsWith(done)).toBe(true)
      expect(done).not.toMatch(/\(step \d+\)/)
      expect(done, name).toContain(file)
    }
    // The dock's width under the scroll lock is measured in a browser that draws a classic scrollbar, here and in the block alike.
    const scrollLock = closing(own.find((l) => head(l) === CARRIED[0][0]) ?? '', 'Done in WS02 step 8:')
    for (const text of [scrollLock, bullet(block, '- **The carried items.**')]) {
      expect(text).toContain('`test/a11y/footer-edges.spec.ts`')
      expect(text).toContain('15 pixels wide')
      expect(text).not.toContain('reasoned from the package')
    }
    expect(entries(followUps).filter((l) => l.startsWith('- **From WS01: '))).toHaveLength(12)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 8: plain language', () => {
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
    expect(block + checkpoint).not.toMatch(/\.github\//)
    expect(block + checkpoint).not.toContain('_' + '_fixtures')
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

describe('REDESIGN_STATUS.md, WS02 step 8: its claims against the files', () => {
  it('lists as new only files that exist, each text file free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of NEW_FILES) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_TEXT) {
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
    for (const file of [...SPECS, ...CHANGED_TESTS, ...CHANGED]) expect(existsSync(join(ROOT, file)), file).toBe(true)
  })

  it('gives the logo files\' bytes as the files hold them', () => {
    expect(readFileSync(join(ROOT, 'src/assets/lca-logo-56.webp')).length).toBe(1818)
    expect(readFileSync(join(ROOT, 'src/assets/lca-logo-112.webp')).length).toBe(4596)
    expect(readFileSync(join(ROOT, 'src/assets/lca-logo.webp')).length).toBe(16468)
  })

  it('gives unit counts that add up: the base\'s, the new files\' tests and the changed files\' gains, file for file with the Files bullet', () => {
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
    expect(grown).toHaveLength(GROWN.length)
    for (const n of [...fresh, ...gains]) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + [...fresh, ...gains, ...grown].reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
    expect(line('- **Lint and counts (WS02 step 8).**')).toContain(`unit ${before} tests in ${beforeFiles} files`)
    // No integration test is added or changed, so its counts are the base's.
    const integration = /integration ([\d,]+) in (\d+) files, as on the base/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    expect(line('- **Lint and counts (WS02 step 8).**')).toContain(`integration ${integration![1]} in ${integration![2]}`)
  })

  it('gives browser counts that add up: the base\'s and the new cases in each project, three runs in a row on the finished tree, and the Checks line alike', () => {
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
    expect([base![1], base![2], base![3]].map(num)).toEqual([959, 641, 318])
    const three = /the three runs in a row on the finished tree: (.*)$/m.exec(runs)
    expect(three, 'the three runs').not.toBeNull()
    const quoted = [...three![1].matchAll(/"Running ([\d,]+) tests using 2 workers", "([\d,]+) skipped" and "([\d,]+) passed \(\d+\.\dm\)"/g)]
    expect(quoted).toHaveLength(3)
    for (const [, total, skipped, passed] of quoted) {
      expect(num(total)).toBe(num(base![1]) + added)
      expect(num(skipped) + num(passed)).toBe(num(total))
      expect(checksLine).toContain(`${total} tests, ${passed} that run and ${skipped} that skip`)
    }
    // Each project's tests, run and skipped, add up to the runs'.
    const projects = /`a11y-on` holds ([\d,]+) tests \(([\d,]+) that run and ([\d,]+) that skip\) and `a11y-off` ([\d,]+) \(([\d,]+) and ([\d,]+)\)/.exec(runs)
    expect(projects, 'the counts in each project').not.toBeNull()
    const [on, onRun, onSkip, off, offRun, offSkip] = projects!.slice(1).map(num)
    expect([onRun + onSkip, offRun + offSkip]).toEqual([on, off])
    const [, total, skipped, passed] = quoted[0]
    expect([on + off, onRun + offRun, onSkip + offSkip]).toEqual([num(total), num(passed), num(skipped)])
  })

  it('gives the lint figures the same in the block, the verify item and the Checks line', () => {
    const lint = /the same 13 errors and 13 warnings over (\d+) files/.exec(bullet(block, '- **Lint.**'))
    expect(lint, 'the lint figures after').not.toBeNull()
    expect(checksLine).toContain(`13 errors and 13 warnings over ${lint![1]} files (735 on the base)`)
    expect(line('- **Lint and counts (WS02 step 8).**')).toContain('13 errors and 13 warnings over 735 files')
  })
})
