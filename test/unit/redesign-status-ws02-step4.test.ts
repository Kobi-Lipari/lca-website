// test/unit/redesign-status-ws02-step4.test.ts
//
// REDESIGN_STATUS.md records WS02 step 4: the browser specs read the site's
// header and footer through one helper, test/a11y/chrome.ts, which also says
// which chrome each test build draws; the checks that hold for today's
// chrome alone say so through it; today's chrome under the new look keeps
// its unit checks, three of them new, and the rest goes on K's preview list;
// and the unit tests' comment stripper keeps quoted strings. Like the record
// tests of WS02's first three steps, this file reads only the WS02 section,
// the lines the step wrote outside its block (the Status, PR and date lines)
// and the two sentences it added to older follow-ups, never every table row
// or heading of the file. Pinned here: those lines; the map, which this step
// leaves as it was; the step's block with every part and every file; its
// decisions, deviations, verify items and follow-ups, each with its tag; the
// plain-language rules over what the step wrote; and, checked against the
// files they describe, the record's claims: the helper's exports, read from
// its text; the nine specs that read the chrome through it and hold no read
// of their own; the list of browser test files; the comment stripper, called
// as the unit tests call it; the four @source not lines; and the step's new
// files. It never reads whether a switch is on, nor which chrome the helper
// says a build draws, so K turning a switch on, or the step that draws the
// new header, fails nothing here.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { stripComments } from './helpers/cssTokens'

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
/** What a draft would hold before its figures were filled in, and the marks this step's drafts used for them. */
const UNFILLED = new RegExp(`${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|\\b(${['LI' + 'NT', 'BUI' + 'LD', 'BROW' + 'SER', 'CHE' + 'CKS', 'GR' + 'EP', 'CSS' + 'GROWTH'].join('|')})\\b`)

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
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith('(WS02 step 4).'))
/** What this step added to an older line: from `from` to the end of the line. */
const closing = (entry: string, from: string) => (entry.includes(from) ? entry.slice(entry.indexOf(from)) : '')

const ws02 = between(status, '## WS02: Information architecture and navigation', '\n## WS03:')
const part = (heading: string) => between(ws02, heading, '\n### ')
const STEP3 = '### WS02 step 3: the page frame, the chrome\'s rings, the browser bar colour and the loading line'
const STEP = '### WS02 step 4: the browser specs read the chrome through one helper'
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
const mapItems = entries(map)

/** The two older follow-ups this step ends with a sentence of its own, and those sentences' first words. */
const otherPages = entries(followUps).find((l) => l.startsWith('- **Other pages loaded on demand (WS02 step 3).**')) ?? ''
const headerDate = entries(followUps).find((l) => l.startsWith('- **A date in today\'s header file (WS02 step 2).**')) ?? ''
const OWNER = 'The shift on a short heritage page is WS02 step 18\'s to settle in its sweep'
const SETTLED = 'The merge of `main` after WS02 step 3 settled it before then'

/** Everything this step wrote, each piece on its own. */
const written = [
  block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), statusLine, prLine, datePart,
  closing(otherPages, OWNER), closing(headerDate, SETTLED),
]
/** The same, with what sits in backticks taken out, since code is not prose. */
const prose = written.map((text) => text.replace(/`[^`\n]*`/g, '``'))

/** The files this step adds: the helper, its unit test, this record test and the six that test the step's edges. */
const NEW_FILES = [
  'test/a11y/chrome.ts', 'test/unit/chrome-helper.test.tsx', 'test/unit/redesign-status-ws02-step4.test.ts',
  'test/unit/chrome-helper-edges.test.ts', 'test/unit/chrome-reads.test.ts', 'test/unit/chrome-helper-types.test.ts',
  'test/unit/strip-comments-edges.test.ts', 'test/unit/redesign-status-ws02-step4-claims.test.ts', 'test/unit/chrome-helper-app.test.tsx',
]
/** The nine specs whose reads of the chrome now go through the helper: WS01's five, then WS02's own four. */
const NINE = [
  'test/a11y/brand.spec.ts', 'test/a11y/brand-edges.spec.ts', 'test/a11y/heritage.spec.ts', 'test/a11y/home.spec.ts', 'test/a11y/tokens.spec.ts',
  'test/a11y/nav.spec.ts', 'test/a11y/nav-edges.spec.ts', 'test/a11y/signed-in.spec.ts', 'test/a11y/signed-in-edges.spec.ts',
]
/** The test files this step changes, each with its count written in the block. */
const CHANGED_TESTS = [
  'test/unit/brand-placements.test.tsx', 'test/unit/appearance-control.test.tsx', 'test/unit/heritage-app-routes.test.tsx', 'test/unit/source-not-lines.test.ts',
  'test/unit/browser-test-wiring.test.ts', 'test/unit/gold-ink.test.ts', 'test/unit/redesign-status-ws02-step3.test.ts',
]
/** What the helper exports and the record names. */
const EXPORTS = [
  'SITE', 'siteHeader', 'siteFooter', 'brandLink', 'rookMark', 'headerImages', 'footerLogo', 'footerImages', 'appearanceControl',
  'CHROME_NAMES', 'TODAYS_NAMES', 'DRAWN', 'chromeAt', 'onlyToday', 'ifToday', 'todayAt', 'widthOf',
]
/** The three jsdom forms this step adds, each in the file where its drawing already is. */
const NEW_FORMS: Array<[string, string]> = [
  ['test/unit/brand-placements.test.tsx', 'has nothing from the logo up to the footer that could recolour it: no opacity, filter, blend or brightness class'],
  ['test/unit/appearance-control.test.tsx', 'sits on the footer\'s own navy, with nothing between giving a ground or a ring of its own, so the navy band rule rings it gold'],
  ['test/unit/heritage-app-routes.test.tsx', '%s draws the header, its brand link, the footer and the footer\'s first four links with the classes the home page gives them'],
]
/** The fixture page's own header, read inside its container: the one line of the nine specs that names a header and is not the site's. */
const FIXTURE_HEADER = 'container.locator(\'header p\')'
/** A quote mark of any kind. */
const Q = '[\'"`]'
/** Reads of the site's chrome that the nine specs leave to the helper. */
const OWN_READS = [
  new RegExp(`locator\\(\\s*${Q}header`), new RegExp(`locator\\(\\s*${Q}footer`),
  new RegExp(`getByRole\\(\\s*${Q}banner${Q}`), new RegExp(`getByRole\\(\\s*${Q}contentinfo${Q}`),
  new RegExp(`querySelector(?:All)?\\(\\s*${Q}header${Q}`), new RegExp(`querySelector(?:All)?\\(\\s*${Q}footer${Q}`),
  new RegExp(`closest\\(\\s*${Q}header${Q}`), new RegExp(`closest\\(\\s*${Q}footer${Q}`),
  new RegExp(`getByRole\\(\\s*${Q}group${Q}\\s*,\\s*\\{\\s*name:\\s*${Q}Appearance${Q}`),
]
/** The comment stripper's pattern, as test/unit/helpers/cssTokens.ts writes it. */
const STRIP = String.raw`/("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\/\*[\s\S]*?\*\//g`

describe('REDESIGN_STATUS.md, WS02 step 4: the lines outside the block', () => {
  it('says in the Status line that steps 1 to 4 are built, or, once a later step has landed, steps 1 to that step, and leaves the PR line naming checkpoint E\'s draft pull request', () => {
    // WS02 step 5 moved this pin: each later step writes "steps 1 to N are built", which keeps steps 1 to 4 built.
    const head = '**Status:** in progress: nineteen steps in five checkpoints (E for steps 1 to 5, F for 6 to 8, G for 9 to 11, H for 12 to 16, I for 17 to 19); '
    expect(statusLine.startsWith(head)).toBe(true)
    const built = /^steps 1 to (\d+) are built\.$/.exec(statusLine.slice(head.length))
    expect(built, statusLine).not.toBeNull()
    expect(Number(built![1])).toBeGreaterThanOrEqual(4)
    // WS02 step 6 moved this pin to a general form: from checkpoint F the line names two pull requests.
    expect(prLine.startsWith('**PR:** ')).toBe(true)
    expect(prLine).toContain('pull request 110')
    expect(prLine).toContain('checkpoint E (steps 1 to 5)')
  })

  it('keeps WS01\'s part of the date line first and word for word, and puts step 4 before step 3 before step 2 before step 1 in WS02\'s part', () => {
    const after = dateLine.replace(/^Last updated: \S+ /, '')
    expect(after.startsWith('(WS01, step 32: a11y sweep; step 31: heritage layout; step 30: heritage fonts; step 29: hero images; step 28: brand marks; step 27: chess data; step 26: status tags; step 25: gold text; step 24: colours; step 23: grounds; step 22: ThemeScope; step 21: dark mode; step 20 opened checkpoint D; checkpoint C, after step 16, step 17 and step 18, is merged; checkpoint D is merged; WS02, ')).toBe(true)
    expect(after).toMatch(/; WS02, (?:[^;()]+; )*step 4: browser specs read the chrome through one helper; step 3: page frame, browser bar colour and rings; step 2: navigation model and signed-in visitor; step 1: record and brief 1\.4\)$/)
    for (const step of ['step 18', 'step 21', 'step 23', 'step 26', 'step 27', 'step 28', 'step 29', 'step 30', 'step 31', 'step 32']) expect(status.slice(0, 400), step).toContain(step)
    expect((/^Last updated: (\d{4}-\d{2}-\d{2}) /.exec(dateLine)?.[1] ?? '') >= '2026-10-29').toBe(true)
  })

  it('ends the follow-up on other pages loaded on demand with the owner of the short heritage page\'s shift, WS02 step 18\'s sweep', () => {
    expect(otherPages).toContain('`/champions`, short there since its data call failed, 0.3188 at 390 pixels')
    const owner = closing(otherPages, OWNER)
    expect(owner).toBe('The shift on a short heritage page is WS02 step 18\'s to settle in its sweep, which gives `HeldPage` in `src/layouts/HeritageLayout.tsx` the `data-loading-line` marker and widens the rule in `src/index.css` to `main:has([data-loading-line]) + footer`; nothing is built for it before then.')
    expect(otherPages.endsWith(owner)).toBe(true)
    expect(read('src/layouts/HeritageLayout.tsx')).toContain('function HeldPage()')
  })

  it('ends the follow-up on the date in today\'s header file with the merge that settled it, under the heading it had', () => {
    const settled = closing(headerDate, SETTLED)
    expect(settled).toBe('The merge of `main` after WS02 step 3 settled it before then: main\'s `3e14ce9`, pull request 113, changed the comment in `src/components/layout/Navbar.tsx` to `(Friday, October 23, 2026)`.')
    expect(headerDate.endsWith(settled)).toBe(true)
    expect(read('src/components/layout/Navbar.tsx')).not.toContain('(Thursday, October 23, 2026)')
  })
})

describe('REDESIGN_STATUS.md, WS02 step 4: the map', () => {
  it('still maps the 23 criteria and the 12 decisions, each with exactly one planned step and no second "WS02 step"', () => {
    expect(mapItems.filter((l) => /^- \*\*AC\d+\.\*\*/.test(l))).toHaveLength(23)
    expect(mapItems).toHaveLength(35)
    for (const item of mapItems) {
      expect(item.match(/Planned: WS02 step \d+\./g), head(item)).toHaveLength(1)
      expect(item.match(/WS02 step \d+/g), head(item)).toHaveLength(1)
    }
  })

  it('fills in no item, as the map says of step 4', () => {
    expect(map).toContain('Steps 2, 4, 6, 10, 14 and 19 fill in no item: step 2 builds what every criterion reads (the navigation model, the chrome\'s one condition and the signed-in visitor of the browser tests), step 4 moves the browser specs\' reads of the chrome into one helper, step 6 builds the sheet that AC3 and AC6 are proved on')
    for (const item of mapItems) expect(item, head(item)).not.toMatch(/\bin step 4\b/)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 4: the step block', () => {
  it('sits after the step 3 block and before the decisions', () => {
    const at = [STEP3, STEP, '### WS02 decisions'].map((h) => ws02.indexOf(h))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws02.split(STEP)).toHaveLength(2)
  })

  it('has every part, every file and nothing left to fill in', () => {
    for (const piece of [
      '**Files.**', '**The helper.**', '**The reads moved.**', '**Any chrome and today\'s only.**', '**Today\'s chrome under newLook.**',
      '**The comment stripper.**', '**What ships with every switch off.**', '**Pins moved.**', '**Judgement calls.**', '**Lint.**', '**Build.**',
      '**The browser runs.**', '\n- Checks:', 'Files beyond the step\'s list:',
    ]) expect(block, piece).toContain(piece)
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...NINE, ...CHANGED_TESTS, 'src/index.css', 'test/unit/helpers/cssTokens.ts', 'REDESIGN_STATUS.md']) {
      expect(files, name).toContain(`\`${name}\``)
    }
    const escape = (name: string) => name.replace(/[./]/g, '\\$&')
    // Each new unit test file with the number of its tests, each changed one with its number before, and each spec with its count in each project.
    for (const name of NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of CHANGED_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before): `))
    for (const name of NINE) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+ in each project, as before\\)`))
    const beyond = files.slice(files.indexOf('Files beyond the step\'s list:'))
    for (const piece of ['`test/unit/gold-ink.test.ts`', '`}, 20_000)`', '`test/unit/redesign-status-ws02-step3.test.ts`', '`test/unit/helpers/cssTokens.ts`', '`test/a11y/nav.spec.ts`']) {
      expect(beyond, piece).toContain(piece)
    }
    expect(block).toContain('Baseline matches: no colour or font changed.')
    expect(block).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(7)
    for (const text of [block, decisions, deviations, verify, followUps, map]) expect(text).not.toMatch(UNFILLED)
  })

  it('says what a visitor sees by switch, and that nothing ships with every switch off', () => {
    expect(block).toContain('What a visitor sees, by switch: nothing with every switch off, nothing with `newLook` on alone, nothing with `newNav` on alone and nothing with the chrome on')
    expect(block).toContain('the built site is the base\'s, file for file and byte for byte')
    expect(bullet(block, '- **What ships with every switch off.**').startsWith('- **What ships with every switch off.** Nothing.')).toBe(true)
  })

  it('gives the plan\'s count of the reads, this tree\'s by the rule it states, and the lines that moved', () => {
    const reads = bullet(block, '- **The reads moved.**')
    for (const piece of [
      'Friday, October 23, 2026', '56 lines reading the header and 75 the footer in 11 specs', 'about 200 with comments in 15',
      '`\\bheader\\b|\\bbanner\\b|lca-mark|\\bProfile\\b|\\bMore\\b|Log in|Log out|Join LCA`', '`\\bfooter\\b|contentinfo|\\blogo\\b|lca-logo|Appearance`',
      '77 header lines and 88 footer lines, 150 lines in all', '229 lines in 18 files', 'add 53 and 12, 61 lines', '96 in 9 files',
    ]) expect(reads, piece).toContain(piece)
    for (const name of NINE) expect(reads, name).toContain(`\`${name}\`, `)
    for (const name of ['components.spec.ts', 'chess-data.spec.ts', 'chess-data-edges.spec.ts', 'builds.spec.ts', 'home-edges.spec.ts', 'dark-grounds.spec.ts']) {
      expect(reads, name).toContain(`\`${name}\``)
    }
    const size = line('- **The size of the rework (WS02 step 4).**')
    for (const piece of ['56 lines reading the header and 75 the footer in 11 specs', '77 and 88 lines, 150 in all', '229 lines with comments in 18 files', '96 lines in 9 files']) {
      expect(size, piece).toContain(piece)
    }
  })

  it('lists the eighteen checks of today\'s chrome under newLook, each sorted and each kept in jsdom or put on K\'s preview list', () => {
    const eighteen = bullet(block, '- **Today\'s chrome under newLook.**').split('\n').filter((l) => /^ {2}- \d+, /.test(l))
    expect(eighteen.map((l) => Number(/^ {2}- (\d+), /.exec(l)?.[1]))).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
    for (const item of eighteen) {
      expect(item, item.slice(0, 40)).toMatch(/any chrome|today's only|today's markup/)
      expect(item, item.slice(0, 40)).toMatch(/\b[Kk]ept\b|K's preview list/)
    }
    expect(followUps).toContain('- **K looks at today\'s chrome under newLook on a preview (WS02 step 4).**')
  })
})

describe('REDESIGN_STATUS.md, WS02 step 4: the lists', () => {
  it('records the step\'s decisions, each tagged with it', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'One helper finds the chrome and says which one each build draws (WS02 step 4).',
      'A spec says what holds for today\'s chrome only (WS02 step 4).',
      'Today\'s chrome under newLook keeps its unit checks, and K\'s preview takes the rest (WS02 step 4).',
      'The helper\'s answer is held by a unit test (WS02 step 4).',
      'The comment stripper keeps quoted strings (WS02 step 4).',
    ])
  })

  it('records what differs from the plan or the notes for this workstream after the planned step 4 entry, which stays right after step 3\'s eleven, and before WS02 step 5\'s first', () => {
    const heads = entries(deviations).map(head)
    const planned = 'The browser specs read the chrome through one helper (WS02 step 4).'
    const own = [
      'The reads counted again (WS02 step 4).',
      'WS02\'s own specs read through the helper too (WS02 step 4).',
      'Six of the plan\'s files hold no read of the chrome (WS02 step 4).',
      'The stripper\'s strings end on their line (WS02 step 4).',
      'Files beyond the plan\'s list (WS02 step 4).',
    ]
    expect(tagged(deviations).map(head)).toEqual([planned, ...own])
    const at = heads.indexOf(planned)
    expect(heads.slice(at - 11, at).every((h) => h.endsWith('(WS02 step 3).'))).toBe(true)
    expect(heads[at - 12].endsWith('(WS02 step 3).')).toBe(false)
    expect(heads.slice(at + 1, at + 1 + own.length)).toEqual(own)
    expect(heads[at + 1 + own.length]).toBe('What Donate opens before the Give page (WS02 step 5).')
  })

  it('resolves each verify item, found in the code or measured, in the order the notes for this workstream give them', () => {
    const names = [
      'The tree', 'The size of the rework', 'What reads only today\'s chrome', 'Today\'s chrome in unit tests', 'Lint and counts', 'The baseline',
      'The browser test files', 'The header scans of the WS01 record tests', 'The signed-in specs\' counts', 'The comment stripper and its readers',
      'The comment in the stylesheet', 'The command line tests of the gold-ink codemod', 'The list of browser test files', 'The plan\'s other six files',
      'A second header on a page', 'The built site', 'The closing search', 'The grep check',
    ]
    expect(tagged(verify).map(head)).toEqual(names.map((n) => `${n} (WS02 step 4).`))
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^(Confirmed|Measured|Not found)\b/)
    expect(line('- **The grep check (WS02 step 4).**')).toMatch(/Measured: .*\d+ lines/)
    const tree = line('- **The tree (WS02 step 4).**')
    for (const piece of ['`(Friday, October 23, 2026)`', 'pull request 113', '"A date in today\'s header file (WS02 step 2)"']) expect(tree, piece).toContain(piece)
    const gold = line('- **The command line tests of the gold-ink codemod (WS02 step 4).**')
    for (const piece of ['5,703 ms', '`}, 20_000)`', '`test/unit/e2e-preview-guard.test.ts`', 'gets no limit']) expect(gold, piece).toContain(piece)
  })

  it('closes the two items carried from the review of WS02 step 3 as follow-ups of that step, each ended by a sentence of its own', () => {
    const carried = tagged(followUps).filter((l) => l.startsWith('- **From WS02 step 3: '))
    expect(carried.map(head)).toEqual([
      'From WS02 step 3: the unit tests\' comment stripper (WS02 step 4).',
      'From WS02 step 3: who settles the short heritage page\'s shift (WS02 step 4).',
    ])
    for (const entry of carried) {
      const done = closing(entry, 'Done in WS02 step 4:')
      expect(done, head(entry)).not.toBe('')
      expect(entry.endsWith(done)).toBe(true)
      expect(done).not.toMatch(/"[^"]*\(step \d+\)"/)
    }
  })

  it('adds its own follow-ups after them, and keeps the twelve WS01 handed on', () => {
    expect(tagged(followUps).map(head)).toEqual([
      'From WS02 step 3: the unit tests\' comment stripper (WS02 step 4).',
      'From WS02 step 3: who settles the short heritage page\'s shift (WS02 step 4).',
      'K looks at today\'s chrome under newLook on a preview (WS02 step 4).',
      'The helper\'s answer moves with the chrome (WS02 step 4).',
    ])
    expect(entries(followUps).filter((l) => l.startsWith('- **From WS01: '))).toHaveLength(12)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 4: plain language', () => {
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

describe('REDESIGN_STATUS.md, WS02 step 4: its claims against the files', () => {
  it('names what test/a11y/chrome.ts exports, read from the file\'s text, which imports from Playwright only its types', () => {
    const helper = read('test/a11y/chrome.ts')
    const exported = [...helper.matchAll(/^export (?:const|function|async function) (\w+)/gm)].map((m) => m[1])
    expect(exported).toEqual(expect.arrayContaining(EXPORTS))
    const named = bullet(block, '- **The helper.**')
    // A name in backticks, alone or with the arguments it takes.
    for (const name of EXPORTS) expect(named, name).toMatch(new RegExp(`\`${name}[\`(]`))
    const fromPlaywright = helper.split('\n').filter((l) => l.includes('from \'@playwright/test\''))
    expect(fromPlaywright.length).toBeGreaterThan(0)
    for (const l of fromPlaywright) expect(l.startsWith('import type ')).toBe(true)
  })

  it('has the nine specs it lists import the helper and hold no read of the chrome of their own, the fixture page\'s header aside', () => {
    for (const spec of NINE) {
      const text = read(spec)
      expect(text, spec).toMatch(/from '\.\/chrome'/)
      const rest = text.split(FIXTURE_HEADER).join('')
      for (const own of OWN_READS) expect(rest, `${spec}: ${own}`).not.toMatch(own)
    }
    // The fixture page draws a header of its own inside its container; tokens.spec.ts reads it there, and the record says so.
    expect(NINE.filter((spec) => read(spec).includes(FIXTURE_HEADER))).toEqual(['test/a11y/tokens.spec.ts'])
    expect(bullet(block, '- **The reads moved.**')).toContain(`\`${FIXTURE_HEADER}\``)
  })

  it('names the helper in the list of browser test files, after the support file', () => {
    expect(read('test/unit/browser-test-wiring.test.ts')).toContain('\'test/a11y/support.ts\',\n    \'test/a11y/chrome.ts\',\n')
  })

  it('has the comment stripper keep a quoted slash and star, take out a comment and end a string on its line, with the pattern the record gives', () => {
    expect(stripComments('@source not "../*.md";\n/* a comment */\na { color: red; }')).toBe('@source not "../*.md";\n\na { color: red; }')
    expect(stripComments('a::after { content: \'/* kept */\'; } /* gone */')).toBe('a::after { content: \'/* kept */\'; } ')
    expect(stripComments('a { content: "open }\n/* gone */ b { }')).toBe('a { content: "open }\n b { }')
    expect(read('test/unit/helpers/cssTokens.ts')).toContain(`css.replace(${STRIP}, `)
    expect(bullet(block, '- **The comment stripper.**')).toContain(`\`css.replace(${STRIP}, (_comment, quoted) => quoted ?? '')\``)
  })

  it('finds the four @source not lines in src/index.css in their order, under a comment that no longer speaks of the stripper', () => {
    const css = read('src/index.css')
    expect(css.split('\n').filter((l) => l.startsWith('@source'))).toEqual(['@source not "../docs";', '@source not "../test";', '@source not "../scripts";', '@source not "../*.md";'])
    expect(css).toContain(' * (WS02 step 3). One folder or pattern a line. */\n@source not "../docs";')
    expect(css).not.toMatch(/comment stripper|stays last/)
  })

  it('names the three jsdom forms it adds, each in the file where its drawing is', () => {
    const under = bullet(block, '- **Today\'s chrome under newLook.**')
    for (const [file, title] of NEW_FORMS) {
      expect(read(file).replace(/\\'/g, '\'')).toContain(title)
      expect(block, title).toContain(`"${title}"`)
      expect(under, file).toContain(`\`${file}\``)
    }
  })

  it('names jsdom test files that exist', () => {
    const named = new Set([...block.matchAll(/`(test\/unit\/[\w./-]+\.test\.tsx)`/g)].map((m) => m[1]))
    expect(named.size).toBeGreaterThanOrEqual(6)
    for (const file of named) expect(existsSync(join(ROOT, file)), file).toBe(true)
  })

  it('lists as new only files that exist', () => {
    for (const file of NEW_FILES) expect(existsSync(join(ROOT, file)), file).toBe(true)
  })
})

describe('the files of this step', () => {
  it.each(NEW_FILES)('%s has no em dash, no en dash, no tool\'s name and no old initials for US Chess', (file) => {
    const text = read(file)
    expect(text).not.toMatch(DASHES)
    expect(text).not.toMatch(TOOLS)
    expect(text).not.toMatch(BARE)
    expect(text).not.toMatch(OLD_INITIALS)
  })
})
