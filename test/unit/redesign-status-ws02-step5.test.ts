// test/unit/redesign-status-ws02-step5.test.ts
//
// REDESIGN_STATUS.md records WS02 step 5, the new desktop header and the
// About menu, and closes checkpoint E with a section of its own. Like the
// record tests of WS02's first four steps, this file reads only the WS02
// section and the lines the step wrote outside its block (the Status and
// date lines, the map items it filled in, and the sentences it ended three
// older follow-ups with), never every table row or heading of the file.
// Pinned here: the Status line in a form the next steps keep, the PR line,
// the date line's parts, the map, the step's block with every part and
// every file, the Checkpoint E section in its pending or its merged form,
// the decisions, deviations, verify items and follow-ups with their tags,
// and the plain-language rules over all of it; and, checked against the
// files they describe, the record's claims: the new files, the About
// menu's entry in the gold fixture, and the figures it states in more than
// one place, which must agree. It reads no switch, no answer of the browser
// tests' helper and no source text a later step is named to change, so K
// turning a switch on, or WS02 step 6 taking the stand-in out, fails
// nothing here.
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
const UNFILLED = new RegExp(`${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|\\b(${['LI' + 'NT', 'BUI' + 'LD', 'BROW' + 'SER', 'CHE' + 'CKS', 'GR' + 'EP', 'CSS' + 'GROWTH'].join('|')})\\b`)

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
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith('(WS02 step 5).'))
/** What this step added to an older line: from `from` to the end of the line. */
const closing = (entry: string, from: string) => (entry.includes(from) ? entry.slice(entry.indexOf(from)) : '')

const ws02 = between(status, '## WS02: Information architecture and navigation', '\n## WS03:')
/** A part of the WS02 section, from its heading to the next: the heading as a line of its own, since a sentence may name one in backticks. */
const part = (heading: string) => {
  const at = ws02.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws02.slice(at + 1), heading, '\n### ')
}
const STEP4 = '### WS02 step 4: the browser specs read the chrome through one helper'
const STEP = '### WS02 step 5: the desktop header and the About menu'
const CHECKPOINT = '### Checkpoint E: WS02 steps 1 to 5'
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

/** The map items this step proves, and those it built a part of. */
const PROVED = ['AC2', 'AC15', 'D1', 'Header rulings 1.2', 'Q34']
const BUILT = ['AC6', 'AC16', 'AC21']
/** The two follow-ups WS01 handed to this step, and the one of WS02 step 3 it adds a sentence to. */
const NAVY = entries(followUps).find((l) => l.startsWith('- **From WS01: selected navy controls, the header\'s part (WS02 step 5).**')) ?? ''
const BRAND = entries(followUps).find((l) => l.startsWith('- **From WS01: the header\'s brand link (WS02 step 5).**')) ?? ''
const LOADING = entries(followUps).find((l) => l.startsWith('- **The header\'s height in the loading line (WS02 step 3).**')) ?? ''
const LOADING_SENTENCE = 'From WS02 step 5 the new header writes `--header-h` from 1024 pixels up, its own 64 pixels; below that, today\'s header still stands in with the fallback until WS02 step 6.'

/** Everything this step wrote, each piece on its own. */
const written = [
  block, checkpoint, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), statusLine, datePart,
  ...PROVED.map((id) => closing(mapItem(id), 'Proved in step 5')), ...BUILT.map((id) => closing(mapItem(id), 'Built in step 5:')),
  closing(NAVY, 'Done in WS02 step 5:'), closing(BRAND, 'Done in WS02 step 5:'), closing(LOADING, LOADING_SENTENCE),
]
/** The same, with what sits in backticks taken out, since code is not prose. */
const prose = written.map((text) => text.replace(/`[^`\n]*`/g, '``'))

/** The files this step adds, the tests of the new parts' edges among them. */
const NEW_FILES = [
  'src/components/layout/SiteHeader.tsx', 'src/components/layout/AboutMenu.tsx', 'src/components/layout/MyLcaMenu.tsx',
  'src/components/layout/navMenu.ts', 'src/hooks/useWideScreen.ts', 'test/unit/fixtures/navbar-today.tsx',
  'test/unit/header-today.test.tsx', 'test/unit/site-header.test.tsx', 'test/unit/site-header-menus.test.tsx',
  'test/unit/donate-button.test.tsx', 'test/unit/redesign-status-ws02-step5.test.ts',
  'test/unit/site-header-edges.test.tsx', 'test/unit/donate-dialog-edges.test.tsx', 'test/unit/nav-menu-hook.test.tsx',
  'test/unit/use-wide-screen.test.tsx', 'test/unit/header-today-edges.test.tsx', 'test/unit/login-return.test.tsx',
  'test/integration/donation-return.test.ts',
]
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The specs this step changes, each with its count in each project. */
const SPECS = ['test/a11y/nav.spec.ts', 'test/a11y/signed-in.spec.ts', 'test/a11y/signed-in-edges.spec.ts']
/** The unit test files this step changes, each with its count written in the block. */
const CHANGED_TESTS = [
  'test/unit/chrome-helper.test.tsx', 'test/unit/chrome-reads.test.ts', 'test/unit/chrome-helper-types.test.ts', 'test/unit/nav.test.ts',
  'test/unit/goldText.test.ts', 'test/unit/raw-colours.test.ts', 'test/unit/contrast.test.ts', 'test/unit/base-components-scope.test.ts',
  'test/unit/brand-edges.test.tsx', 'test/unit/lca-mark.test.tsx', 'test/unit/redesign-status-step24.test.ts', 'test/unit/redesign-status-step26.test.ts',
  'test/unit/dark-spot-later.test.ts', 'test/unit/redesign-status-ws02-step1.test.ts', 'test/unit/redesign-status-ws02-step4.test.ts',
]
/** A unit test file this step does not change whose cases grow with the files it reads, with its count before and after in the block. */
const GROWN = ['test/unit/semantic-map-cascade.test.ts']
/** The other files this step changes. */
const CHANGED = [
  'src/components/layout/Navbar.tsx', 'src/components/DonateButton.tsx', 'src/index.css', 'src/App.tsx', 'src/lib/nav.ts', 'test/a11y/chrome.ts',
  'test/unit/fixtures/navPersonas.ts', 'test/unit/fixtures/goldAllowlist.ts', 'test/unit/fixtures/raw-colours-allowlist.json', 'test/integration/harness.ts',
  'REDESIGN_STATUS.md',
]
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))

describe('REDESIGN_STATUS.md, WS02 step 5: the lines outside the block', () => {
  it('says in the Status line that steps 1 to 5 are built, or, once a later step has landed, steps 1 to that step, and leaves the PR line naming checkpoint E\'s draft pull request', () => {
    const start = '**Status:** in progress: nineteen steps in five checkpoints (E for steps 1 to 5, F for 6 to 8, G for 9 to 11, H for 12 to 16, I for 17 to 19); '
    expect(statusLine.startsWith(start)).toBe(true)
    const built = /^steps 1 to (\d+) are built\.$/.exec(statusLine.slice(start.length))
    expect(built, statusLine).not.toBeNull()
    expect(Number(built![1])).toBeGreaterThanOrEqual(5)
    // WS02 step 6 moved this pin to a general form: from checkpoint F the line names two pull requests.
    expect(prLine.startsWith('**PR:** ')).toBe(true)
    expect(prLine).toContain('pull request 110')
    expect(prLine).toContain('checkpoint E (steps 1 to 5)')
  })

  it('keeps WS01\'s part of the date line first and word for word, and puts step 5 before step 4 before step 3 before step 2 before step 1 in WS02\'s part', () => {
    const after = dateLine.replace(/^Last updated: \S+ /, '')
    expect(after.startsWith('(WS01, step 32: a11y sweep; step 31: heritage layout; step 30: heritage fonts; step 29: hero images; step 28: brand marks; step 27: chess data; step 26: status tags; step 25: gold text; step 24: colours; step 23: grounds; step 22: ThemeScope; step 21: dark mode; step 20 opened checkpoint D; checkpoint C, after step 16, step 17 and step 18, is merged; checkpoint D is merged; WS02, ')).toBe(true)
    expect(after).toMatch(/; WS02, (?:[^;()]+; )*step 5: desktop header and About menu, the last of checkpoint E; step 4: browser specs read the chrome through one helper; step 3: page frame, browser bar colour and rings; step 2: navigation model and signed-in visitor; step 1: record and brief 1\.4\)$/)
    for (const step of ['step 18', 'step 21', 'step 23', 'step 26', 'step 27', 'step 28', 'step 29', 'step 30', 'step 31', 'step 32']) expect(status.slice(0, 400), step).toContain(step)
    expect((/^Last updated: (\d{4}-\d{2}-\d{2}) /.exec(dateLine)?.[1] ?? '') >= '2026-10-30').toBe(true)
  })

  it('ends the two follow-ups WS01 handed to this step with a sentence of its own each, quoting no heading', () => {
    for (const entry of [NAVY, BRAND]) {
      expect(entry).not.toBe('')
      const done = closing(entry, 'Done in WS02 step 5:')
      expect(done, head(entry)).not.toBe('')
      expect(entry.endsWith(done)).toBe(true)
      expect(done).not.toMatch(/"[^"]*\(step \d+\)"/)
    }
    expect(closing(NAVY, 'Done in WS02 step 5:')).toContain('`aria-current="page"`')
    expect(closing(BRAND, 'Done in WS02 step 5:')).toContain('"Louisiana Chess Association, home"')
    // The heading WS01 wrote is still quoted in each, once.
    expect(NAVY).toContain('"Selected navy controls in dark mode (step 23)", its header part')
    expect(BRAND).toContain('"The header\'s brand link in WS02 (step 28)"')
  })

  it('ends WS02 step 3\'s follow-up on the header\'s height in the loading line with the sentence this step adds', () => {
    expect(LOADING.endsWith(` ${LOADING_SENTENCE}`)).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 5: the map', () => {
  it('still maps the 23 criteria and the 12 decisions, each with exactly one planned step and no second "WS02 step"', () => {
    expect(mapItems.filter((l) => /^- \*\*AC\d+\.\*\*/.test(l))).toHaveLength(23)
    expect(mapItems).toHaveLength(35)
    for (const item of mapItems) {
      expect(item.match(/Planned: WS02 step \d+\./g), head(item)).toHaveLength(1)
      expect(item.match(/WS02 step \d+/g), head(item)).toHaveLength(1)
    }
  })

  it('says what proves AC2, AC15, D1, Header rulings 1.2 and Q34, and what this step built of AC6, AC16 and AC21', () => {
    for (const id of PROVED) {
      expect(mapItem(id), id).toContain('Proved in step 5 by ')
      expect(mapItem(id).endsWith('Planned: WS02 step 5.'), id).toBe(true)
    }
    for (const id of BUILT) {
      expect(mapItem(id), id).toContain('Built in step 5: ')
      expect(mapItem(id).endsWith('Planned: WS02 step 7.'), id).toBe(true)
    }
    // Q34 keeps its sentences, the stale-tab reload's among them.
    for (const piece of [
      'Only what a screen reader hears ships with every switch off: `aria-current` on today\'s header links.',
      'K gave that yes on Friday, October 23, 2026, so the reload ships without a switch.',
      'The four `@source not` lines of step 3 ship with every switch off too',
      '`test/unit/header-today.test.tsx`',
    ]) expect(mapItem('Q34'), piece).toContain(piece)
    expect(mapItem('AC2')).toContain('`aria-expanded`')
    expect(mapItem('AC15')).toContain('"Louisiana Chess Association, home"')
    expect(mapItem('D1')).toContain('`src/components/layout/SiteHeader.tsx`')
    expect(mapItem('AC21')).toContain('`#705718` on `#f3eedc`')
    for (const item of mapItems) expect(item, head(item)).not.toMatch(/\bin step 4\b/)
  })

  it('keeps the sentence the map closes with, word for word', () => {
    expect(map).toContain('Steps 2, 4, 6, 10, 14 and 19 fill in no item: step 2 builds what every criterion reads (the navigation model, the chrome\'s one condition and the signed-in visitor of the browser tests), step 4 moves the browser specs\' reads of the chrome into one helper, step 6 builds the sheet that AC3 and AC6 are proved on, steps 10 and 14 prove halves of AC5 and AC4, and step 19 closes the record.')
  })
})

describe('REDESIGN_STATUS.md, WS02 step 5: the step block', () => {
  it('sits after the step 4 block, with the Checkpoint E section after it and before the decisions, each once', () => {
    const at = [STEP4, STEP, CHECKPOINT, '### WS02 decisions'].map((h) => ws02.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws02.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(ws02.split(`\n${CHECKPOINT}\n`)).toHaveLength(2)
  })

  it('has every part, every file and nothing left to fill in', () => {
    for (const piece of [
      '**Files.**', '**Today\'s header.**', '**The header and its brand link.**', '**The sections.**', '**The About menu.**', '**The utilities.**',
      '**The My LCA menu.**', '**Donate.**', '**The squeeze.**', '**The header\'s height.**', '**The WS02 gold.**', '**The helper\'s answer.**',
      '**The board and the brief.**', '**What ships with every switch off.**', '**Pins moved.**', '**Judgement calls.**', '**Lint.**', '**Build.**',
      '**The browser runs.**', '\n- Checks:', 'Files beyond the step\'s list:',
    ]) expect(block, piece).toContain(piece)
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...SPECS, ...CHANGED_TESTS, ...GROWN, ...CHANGED]) expect(files, name).toContain(`\`${name}\``)
    // Each new unit or integration test file with the number of its tests, each changed one with its number before, and each spec with its count in each project.
    for (const name of [...NEW_TESTS, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of [...CHANGED_TESTS, ...GROWN]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before): `))
    for (const name of SPECS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+ in each project, (?:\\d+ before|as before): `))
    expect(block).toContain('Baseline matches: no colour or font changed.')
    expect(block).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
    for (const text of [block, checkpoint, decisions, deviations, verify, followUps, map]) expect(text).not.toMatch(UNFILLED)
  })

  it('says what a visitor sees by switch, and that only aria-current on today\'s header ships with every switch off', () => {
    expect(block).toContain('What a visitor sees, by switch: with every switch off, `aria-current` on today\'s header\'s links and nothing else; with `newLook` alone and with `newNav` alone, the same; with the chrome on, the new header from 1024 pixels up and today\'s below until WS02 step 6.')
    expect(bullet(block, '- **What ships with every switch off.**').startsWith('- **What ships with every switch off.** Only `aria-current` on today\'s header\'s links')).toBe(true)
  })

  it('gives the widest row\'s figures signed out, as an active member and as an expired member, with what Search and the Live tag would add', () => {
    const squeeze = bullet(block, '- **The squeeze.**')
    for (const piece of ['976 pixels at 1024', '1,104 at 1280 and 1440', 'Signed out', 'as an active member', 'as an expired member', 'Search\'s button, 112 pixels on the decided board', 'The Live tag, 50 pixels']) {
      expect(squeeze, piece).toContain(piece)
    }
    expect(line('- **The widest row (WS02 step 5).**')).toMatch(/^- \*\*The widest row \(WS02 step 5\)\.\*\* Measured, /)
  })

  it('names each difference between the decided board and the brief, the brief ruling', () => {
    const board = bullet(block, '- **The board and the brief.**')
    for (const piece of ['68 pixels', '8 pixels of padding', '`#e6cf86`', '`#d9c27c`', '`aria-haspopup="true"`', '`aria-haspopup="menu"`', 'the brief rules']) expect(board, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 5: the Checkpoint E section', () => {
  it('opens pending its merge, or once it has merged, with the merge commit and its day, and never calls the merge pending in the old words', () => {
    const first = checkpoint.split('\n')[2] ?? ''
    const pending = first.startsWith('**Not merged yet: checkpoint E waits for its merge into `main`** (draft pull request 110)')
    const merged = /^\*\*Merged into `main` as `[0-9a-f]{7,40}` on (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]+ \d{1,2}, \d{4}/.test(first)
    expect(pending || merged, first.slice(0, 120)).toBe(true)
    expect(checkpoint).not.toMatch(/merge into `main` is pending|checkpoint D's merge is pending/)
    expect(checkpoint).toContain('It changes no database.')
  })

  it('has a bullet for each of the five steps and each part a checkpoint\'s section gives', () => {
    for (const name of [
      '- **WS02 step 1:**', '- **WS02 step 2:**', '- **WS02 step 3:**', '- **WS02 step 4:**', '- **WS02 step 5:**', '- **What the merge does to production.**',
      '- **Before merging.**', '- **Rollback.**', '- **For K, on a preview, with the chrome on.**', '- **Checks at the end of the checkpoint.**',
    ]) expect(checkpoint.split('\n').filter((l) => l.startsWith(name)), name).toHaveLength(1)
    const production = bullet(checkpoint, '- **What the merge does to production.**')
    for (const piece of ['No migration.', '`0058_state_champion_2026.sql`', 'No server change.', '`deploy-worker.yml`', '`migrate-db.yml`', 'Pages rebuilds the site.', '`39e35e8`']) {
      expect(production, piece).toContain(piece)
    }
    expect(bullet(checkpoint, '- **For K, on a preview, with the chrome on.**')).toContain('1024 pixels or wider')
    expect(bullet(checkpoint, '- **Rollback.**')).toContain('`git revert -m 1 <merge sha>`')
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
    expect(production).toContain('What reaches a visitor with every switch off:')
    expect(production).toContain('`aria-current` on today\'s header\'s links, from WS02 step 5')
    expect(production).toContain('What reaches a visitor with `newLook` on as well')
    expect(production).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
  })
})

describe('REDESIGN_STATUS.md, WS02 step 5: the lists', () => {
  it('records the step\'s decisions, each tagged with it', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'Navbar draws the new header from 1024 pixels with the chrome on (WS02 step 5).',
      'Today\'s header is held to a copy of itself (WS02 step 5).',
      'The About and My LCA menus are disclosures the arrow keys move through (WS02 step 5).',
      'Join LCA or Renew from the member\'s status (WS02 step 5).',
      'Donate hands off to Stripe in the same tab (WS02 step 5).',
      'The squeeze reads the row\'s natural width (WS02 step 5).',
      'The header writes its own height (WS02 step 5).',
      'The About menu\'s gold is held in its context and counted with its reason (WS02 step 5).',
      'Checkpoint sections in the WS02 section (WS02 step 5).',
    ])
  })

  it('records what differs from the brief, the plan or the notes for this workstream right after the four planned step 5 entries, and before WS02 step 8\'s first', () => {
    const heads = entries(deviations).map(head)
    const planned = [
      'What Donate opens before the Give page (WS02 step 5).',
      '`aria-current` on today\'s header (WS02 step 5).',
      'Today\'s header below 1024 pixels in checkpoint E (WS02 step 5).',
      'WS02\'s gold as hex classes (WS02 steps 5 to 7).',
    ]
    const own = [
      'The decided header board differs, and the brief rules (WS02 step 5).',
      'The header\'s height from the new header alone (WS02 step 5).',
      'The member\'s status alone decides the Join slot (WS02 step 5).',
      'No Family row before the children reach the header (WS02 step 5).',
      'Search\'s place in the row waits for its button (WS02 step 5).',
      'Donate on a phone waits for the sheet (WS02 step 5).',
      'The gold guard\'s counts stay (WS02 step 5).',
      'The current About row is darker than the menu in dark mode (WS02 step 5).',
      'The map items this step fills in (WS02 step 5).',
      'The plan\'s figures that moved (WS02 step 5).',
      'The comparison shows notes, not skips (WS02 step 5).',
      'Log in\'s page from the new header alone (WS02 step 5).',
      'Files beyond the plan\'s list (WS02 step 5).',
    ]
    const at = heads.indexOf(planned[0])
    expect(at).toBeGreaterThan(-1)
    expect(heads.slice(at, at + planned.length + own.length)).toEqual([...planned, ...own])
    // WS02 step 6 moved this pin: the entries of WS02 steps 6 and 7 come right after this step's own, in step order, and WS02 step 8's first after them.
    const footer = heads.indexOf('The footer\'s logo file (WS02 step 8).')
    expect(footer).toBeGreaterThanOrEqual(at + planned.length + own.length)
    for (const later of heads.slice(at + planned.length + own.length, footer)) expect(later, later).toMatch(/\(WS02 step [67]\)\.$/)
    // None takes a phrase of the brief's own deviation bullets, or the words the step 1 record test finds them by.
    for (const entry of entries(deviations).filter((l) => own.includes(head(l)))) {
      expect(entry).not.toContain('the `/about` tabs')
      expect(entry).not.toMatch(/^- \*\*From v1\.[13]: /)
      for (const phrase of ['the rook mark at every width and no longer condenses', 'Renew shows only once a membership has expired', 'Donate moves into the About menu, then the brand name hides']) {
        expect(entry, phrase).not.toContain(phrase)
      }
    }
  })

  it('resolves each verify item, found in the code or measured, in the order the notes for this workstream give them', () => {
    const names = [
      'The tree', 'Today\'s header', 'Log in\'s return', 'Donate today', 'Membership state', '`WS02_GOLD` and where it can be written',
      'Switches in unit tests', 'Specs that read today\'s header', 'The widest row', 'Pins on the header\'s files and parts', 'The sticky stack',
      'The board and the brief', 'The record\'s headings', 'Lint and counts', 'The baseline', 'The built site', 'The closing search', 'The grep check',
    ]
    expect(tagged(verify).map(head)).toEqual(names.map((n) => `${n} (WS02 step 5).`))
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^(Confirmed|Measured|Not found)\b/)
    expect(line('- **The grep check (WS02 step 5).**')).toMatch(/Measured: .*\d+ lines/)
  })

  it('gives the closing search\'s kinds, each with its files and a count by file, adding up to the lines it found', () => {
    const search = line('- **The closing search (WS02 step 5).**')
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

  it('adds its own follow-ups, each handing on what this step leaves, and keeps the twelve WS01 handed on', () => {
    expect(tagged(followUps).filter((l) => !l.startsWith('- **From WS01: ')).map(head)).toEqual([
      'The tablet header and the app bar take the stand-in\'s place (WS02 step 5).',
      'Donate, Log in and the gold on phones (WS02 step 5).',
      'The footer\'s Donate (WS02 step 5).',
      'Search in the row (WS02 step 5).',
      'The strip in the header\'s height (WS02 step 5).',
      'The My LCA menu\'s later rows (WS02 step 5).',
      'The widest row and the rings as drawn (WS02 step 5).',
      'A focused control under the header (WS02 step 5).',
      'K looks at the new header on a preview (WS02 step 5).',
      'Where a donor who cancels comes back to (WS02 step 5).',
    ])
    expect(entries(followUps).filter((l) => l.startsWith('- **From WS01: '))).toHaveLength(12)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 5: plain language', () => {
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

describe('REDESIGN_STATUS.md, WS02 step 5: its claims against the files', () => {
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

  it('finds the About menu\'s entry in the gold fixture as it was: #705718 in its file, beside "You are here", at 13 pixels, on #f3eedc', () => {
    const fixture = read('test/unit/fixtures/goldAllowlist.ts')
    const about = between(fixture, 'export const WS02_GOLD', '\n  },')
    for (const piece of ['colour: \'#705718\'', 'file: \'src/components/layout/AboutMenu.tsx\'', 'use: \'text\'', 'label: \'You are here\'', 'minPx: 13', 'ground: \'#f3eedc\'']) {
      expect(about, piece).toContain(piece)
    }
  })

  it('gives unit and integration counts that add up: the base\'s, the new files\' tests and the changed files\' gains, file for file with the Files bullet, and the Checkpoint E section the same', () => {
    const files = bullet(block, '- **Files.**')
    const checks = checksLine
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base/.exec(checks)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    const fresh = NEW_TESTS.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    const gains = [...CHANGED_TESTS, ...GROWN].map((name) => {
      const m = new RegExp(`\`${escape(name)}\` \\((\\d+), (?:(\\d+) before|as before): `).exec(files)
      return m ? Number(m[1]) - Number(m[2] ?? m[1]) : NaN
    })
    for (const n of [...fresh, ...gains]) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + fresh.reduce((a, n) => a + n, 0) + gains.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
    expect(line('- **Lint and counts (WS02 step 5).**')).toContain(`unit ${before} tests in ${beforeFiles} files`)
    // The integration tests: the base's and the new file's.
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base/.exec(checks)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, afterIntegration, afterIntegrationFiles, beforeIntegration, beforeIntegrationFiles] = integration!
    const freshIntegration = NEW_INTEGRATION.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    for (const n of freshIntegration) expect(Number.isNaN(n)).toBe(false)
    expect(num(beforeIntegration) + freshIntegration.reduce((a, n) => a + n, 0)).toBe(num(afterIntegration))
    expect(Number(afterIntegrationFiles) - Number(beforeIntegrationFiles)).toBe(NEW_INTEGRATION.length)
    expect(line('- **Lint and counts (WS02 step 5).**')).toContain(`integration ${beforeIntegration} in ${beforeIntegrationFiles}`)
    // The checkpoint's own checks give the same figures as the step's.
    const closingChecks = bullet(checkpoint, '- **Checks at the end of the checkpoint.**')
    expect(closingChecks).toContain(`unit ${after} in ${afterFiles} files`)
    expect(closingChecks).toContain(`integration ${afterIntegration} in ${afterIntegrationFiles} files`)
  })

  it('gives browser counts that add up: the base\'s and the new cases in each project, the runs, the Checks line and the Checkpoint E section alike', () => {
    const files = bullet(block, '- **Files.**')
    const nav = /`test\/a11y\/nav\.spec\.ts` \((\d+) in each project, (\d+) before/.exec(files)
    expect(nav).not.toBeNull()
    const added = 2 * (Number(nav![1]) - Number(nav![2]))
    const runs = bullet(block, '- **The browser runs.**')
    const base = /the base's run: ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip/.exec(runs)
    expect(base, 'the base\'s run').not.toBeNull()
    const after = [...runs.matchAll(/"Running ([\d,]+) tests using 2 workers", "([\d,]+) skipped" and "([\d,]+) passed/g)]
    expect(after.length).toBeGreaterThanOrEqual(3)
    for (const [, total, skipped, passed] of after) {
      expect(num(total)).toBe(num(base![1]) + added)
      expect(num(skipped) + num(passed)).toBe(num(total))
    }
    const [, total, skipped, passed] = after[0]
    expect(checksLine).toContain(`${total} tests, ${passed} that run and ${skipped} that skip`)
    expect(bullet(checkpoint, '- **Checks at the end of the checkpoint.**')).toContain(`${total} tests, ${passed} that run and ${skipped} that skip`)
    // Each project's tests, run and skipped, add up to the run's.
    const projects = /`a11y-on` holds ([\d,]+) tests \(([\d,]+) that run and ([\d,]+) that skip\) and `a11y-off` ([\d,]+) \(([\d,]+) and ([\d,]+)\)/.exec(runs)
    expect(projects, 'the counts in each project').not.toBeNull()
    const [on, onRun, onSkip, off, offRun, offSkip] = projects!.slice(1).map(num)
    expect([onRun + onSkip, offRun + offSkip]).toEqual([on, off])
    expect([on + off, onRun + offRun, onSkip + offSkip]).toEqual([num(total), num(passed), num(skipped)])
  })
})
