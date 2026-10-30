// test/unit/redesign-status-ws02-step3.test.ts
//
// REDESIGN_STATUS.md records WS02 step 3: the page frame (the skip link and
// the loading line, with the chrome on), the browser bar's colour after an
// Appearance pick, the chrome's own focus rings and the banners' ring on
// gold, and the four @source not lines. Like the step 1 and step 2 record
// tests, this file reads only the WS02 section and the lines the step wrote
// outside its block (the Status, PR and date lines), never every table row
// or heading of the file, which WS01's record tests read. Pinned here: those
// lines; the step's block with every part and every file; its decisions,
// deviations, verify items and follow-ups, each with its tag; the five
// follow-ups WS01 handed to this step, each closed with a sentence of its
// own; K's yes on the stale-tab reload in the Q34 item and in its follow-up;
// the map still holding its 23 criteria and 12 decisions, each planned for
// exactly one step, with the four items this step fills in; the
// plain-language rules over what the step wrote; and, checked against the
// files they describe, the record's claims: the two browser bar colours, the
// four @source not lines in their order, the skip link's words, the main's
// tabindex and the loading line's class, the rule that keeps the footer from
// being drawn while that line shows, the attribute of the chrome's rings,
// and the step's new files. It never reads whether a switch is on, so K
// turning one on fails nothing here.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT } from '@/lib/colorScheme'

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
const UNFILLED = new RegExp(`${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|\\b(${['LI' + 'NT', 'BUI' + 'LD', 'BROW' + 'SER', 'CHE' + 'CKS', 'GR' + 'EP', 'CSS' + 'GROWTH'].join('|')})\\b`)

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
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith('(WS02 step 3).'))

const ws02 = between(status, '## WS02: Information architecture and navigation', '\n## WS03:')
const part = (heading: string) => between(ws02, heading, '\n### ')
const STEP2 = '### WS02 step 2: the navigation model, the signed-in visitor and the browser build\'s switches'
const STEP = '### WS02 step 3: the page frame, the chrome\'s rings, the browser bar colour and the loading line'
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
const mapItem = (id: string) => mapItems.find((l) => l.startsWith(`- **${id}.**`)) ?? ''
/** What this step added to an older line: from `from` to the end of the line. */
const closing = (entry: string, from: string) => (entry.includes(from) ? entry.slice(entry.indexOf(from)) : '')

/** The follow-ups WS01 handed to this step, by their headings here. */
const HANDED = [
  'From WS01: the browser bar colour',
  'From WS01: a light card inside a navy band',
  'From WS01: classes only the documents and tests name',
  'From WS01: gold grounds in dark mode',
  'From WS01: the layout shift',
]
const handed = HANDED.map((name) => entries(followUps).find((l) => l.startsWith(`- **${name} (WS02 step 3).**`)) ?? '')
const reloadFollowUp = entries(followUps).find((l) => l.startsWith('- **K\'s yes for the stale-tab reload (WS02 step 1).**')) ?? ''

/** Everything this step wrote, each piece on its own. */
const written = [
  block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), statusLine, prLine, datePart,
  ...['AC13', 'AC19', 'AC20', 'AC23'].map((id) => closing(mapItem(id), id === 'AC13' || id === 'AC19' ? 'Built in step 3:' : 'Proved in step 3')),
  closing(mapItem('Q34'), 'K gave that yes'),
  ...handed.map((l) => closing(l, 'Done in WS02 step 3:')),
  closing(reloadFollowUp, 'K said yes on'),
]
/** The same, with what sits in backticks taken out, since code is not prose. */
const prose = written.map((text) => text.replace(/`[^`\n]*`/g, '``'))

/** The files this step adds: the four the plan names, then the six that test its edges. */
const NEW_FILES = [
  'test/unit/theme-color.test.tsx',
  'test/unit/app-frame.test.tsx',
  'test/a11y/nav.spec.ts',
  'test/unit/redesign-status-ws02-step3.test.ts',
  'test/unit/source-not-lines.test.ts',
  'test/unit/theme-color-edges.test.tsx',
  'test/unit/app-frame-edges.test.tsx',
  'test/unit/chrome-rings-edges.test.tsx',
  'test/unit/redesign-status-ws02-step3-claims.test.ts',
  'test/a11y/nav-edges.spec.ts',
]

describe('REDESIGN_STATUS.md, WS02 step 3: the lines outside the block', () => {
  it('says in the Status line that steps 1 to 3 are built, or, once a later step has landed, steps 1 to that step, and names checkpoint E\'s draft pull request', () => {
    // WS02 step 4 moved this pin: each later step writes "steps 1 to N are built", which keeps steps 1 to 3 built.
    const head = '**Status:** in progress: nineteen steps in five checkpoints (E for steps 1 to 5, F for 6 to 8, G for 9 to 11, H for 12 to 16, I for 17 to 19); '
    expect(statusLine.startsWith(head)).toBe(true)
    const built = /^steps 1 to (\d+) are built\.$/.exec(statusLine.slice(head.length))
    expect(built, statusLine).not.toBeNull()
    expect(Number(built![1])).toBeGreaterThanOrEqual(3)
    expect(prLine).toBe('**PR:** draft pull request 110, which carries checkpoint E (steps 1 to 5).')
  })

  it('keeps WS01\'s part of the date line first and word for word, and puts step 3 before step 2 before step 1 in WS02\'s part', () => {
    const after = dateLine.replace(/^Last updated: \S+ /, '')
    expect(after.startsWith('(WS01, step 32: a11y sweep; step 31: heritage layout; step 30: heritage fonts; step 29: hero images; step 28: brand marks; step 27: chess data; step 26: status tags; step 25: gold text; step 24: colours; step 23: grounds; step 22: ThemeScope; step 21: dark mode; step 20 opened checkpoint D; checkpoint C, after step 16, step 17 and step 18, is merged; checkpoint D is merged; WS02, ')).toBe(true)
    expect(after).toMatch(/; WS02, (?:[^;()]+; )*step 3: page frame, browser bar colour and rings; step 2: navigation model and signed-in visitor; step 1: record and brief 1\.4\)$/)
    for (const step of ['step 18', 'step 21', 'step 23', 'step 26', 'step 27', 'step 28', 'step 29', 'step 30', 'step 31', 'step 32']) expect(status.slice(0, 400), step).toContain(step)
    expect((/^Last updated: (\d{4}-\d{2}-\d{2}) /.exec(dateLine)?.[1] ?? '') >= '2026-10-23').toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 3: the map', () => {
  it('still maps the 23 criteria and the 12 decisions, each with exactly one planned step and no second "WS02 step"', () => {
    expect(mapItems.filter((l) => /^- \*\*AC\d+\.\*\*/.test(l))).toHaveLength(23)
    expect(mapItems).toHaveLength(35)
    for (const item of mapItems) {
      expect(item.match(/Planned: WS02 step \d+\./g), head(item)).toHaveLength(1)
      expect(item.match(/WS02 step \d+/g), head(item)).toHaveLength(1)
    }
    expect(map).toContain('Steps 2, 4, 6, 10, 14 and 19 fill in no item')
  })

  it('fills in AC20 and AC23, which this step proves, and the halves of AC13 and AC19 it builds', () => {
    expect(mapItem('AC20')).toContain('Proved in step 3 by `test/unit/theme-color.test.tsx`, the extended `test/unit/prepaint-gate.test.ts` and `test/a11y/nav.spec.ts`')
    expect(mapItem('AC20')).toContain('`#1a2744` or `#0b1220`')
    expect(mapItem('AC20').endsWith('Planned: WS02 step 3.')).toBe(true)
    expect(mapItem('AC23')).toContain('Proved in step 3 by `test/a11y/nav.spec.ts`')
    for (const figure of ['0.0000 at 390 pixels and 0.0001 at 1280', '0.6718 and 0.2494 on `/about`', '0.6718 and 0.4045 on `/membership`', '`/donate/success`']) expect(mapItem('AC23'), figure).toContain(figure)
    expect(mapItem('AC23').endsWith('Planned: WS02 step 3.')).toBe(true)
    expect(mapItem('AC13')).toContain('Built in step 3: the skip link')
    expect(mapItem('AC13')).toContain('the tab bar and the footer\'s folded links are proved in step 8. Planned: WS02 step 8.')
    expect(mapItem('AC19')).toContain('Built in step 3: the chrome\'s ring rules, set by an attribute of their own, `data-ring-ground`')
    expect(mapItem('AC19')).toContain('are proved in step 18. Planned: WS02 step 18.')
  })

  it('closes the Q34 item\'s wait for K\'s yes with the day K gave it, and says the stylesheet ships with every switch off', () => {
    const q34 = mapItem('Q34')
    expect(q34).toContain('The stale-tab reload ships with every switch off as well, an exception Q34 allows only with K\'s yes, so it waits for that yes before checkpoint E merges.')
    expect(q34).toContain('K gave that yes on Friday, October 23, 2026, so the reload ships without a switch.')
    expect(q34).toContain('The four `@source not` lines of step 3 ship with every switch off too')
    expect(q34.endsWith('Planned: WS02 step 5.')).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 3: the step block', () => {
  it('sits after the step 2 block and before the decisions', () => {
    const at = [STEP2, STEP, '### WS02 decisions'].map((h) => ws02.indexOf(h))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws02.split(STEP)).toHaveLength(2)
  })

  it('has every part, every file and nothing left to fill in', () => {
    for (const piece of [
      '**Files.**', '**The browser bar colour.**', '**The chrome\'s rings.**', '**The banners\' ring.**', '**The skip link and the loading line.**',
      '**The `@source not` lines.**', '**What ships with every switch off.**', '**Pins moved.**', '**Judgement calls.**', '**Lint.**', '**Build.**',
      '**The browser runs.**', '\n- Checks:', 'Files beyond the step\'s list:',
    ]) expect(block, piece).toContain(piece)
    const files = bullet(block, '- **Files.**')
    for (const name of [
      ...NEW_FILES, 'src/App.tsx', 'src/lib/colorScheme.ts', 'src/hooks/useColorScheme.ts', 'src/index.css', 'src/components/AnnouncementBanner.tsx',
      'src/components/ImpersonationBanner.tsx', 'REDESIGN_STATUS.md', 'test/unit/prepaint-gate.test.ts', 'test/unit/contrast.test.ts',
      'test/unit/announcement-banner-ground.test.tsx', 'test/unit/appearance-control.test.tsx', 'test/unit/tokens.test.ts',
      'test/unit/redesign-status-ws02-step2.test.ts',
    ]) expect(files, name).toContain(`\`${name}\``)
    // Each new test file of the unit suite with the number of its tests, and the spec with its count in each project.
    for (const name of NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))) {
      expect(files, name).toMatch(new RegExp(`\`${name.replace(/[./]/g, '\\$&')}\` \\(\\d+: `))
    }
    expect(files).toContain('`test/a11y/nav.spec.ts` (29 in each project, 58 in all, 35 that run and 23 that skip')
    expect(files).toContain('`test/a11y/nav-edges.spec.ts` (6 in each project, 12 in all, 8 that run and 4 that skip')
    expect(block).toContain('Baseline matches: no colour or font changed.')
    expect(block).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
    for (const text of [block, decisions, deviations, verify, followUps, map]) expect(text).not.toMatch(UNFILLED)
  })

  it('says what a visitor sees by switch, and what ships with every switch off', () => {
    for (const piece of [
      'with every switch off, nothing, though the site\'s stylesheet loses rules no page uses',
      'with `newLook` on and `newNav` off, two things and nothing else',
      'with `newNav` on and `newLook` off, nothing',
      'with the chrome on, "Skip to content" is the first thing Tab reaches on every page',
    ]) expect(block, piece).toContain(piece)
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships).toContain('K said yes to on Friday, October 23, 2026')
    expect(ships).toContain('the site\'s stylesheet without the rules no page uses')
  })

  it('records the theme colour mechanism the notes for this workstream accept as a judgement call', () => {
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls).toContain('The browser bar\'s colour comes from a meta of the module\'s own, first in the head and owned afterwards by the colour scheme code')
    expect(calls).toContain('The notes for this workstream accept this.')
  })

  it('names the figures of the @source not lines and of the stylesheet\'s growth', () => {
    const lines4 = bullet(block, '- **The `@source not` lines.**')
    for (const piece of ['130,465 to 122,366 bytes, 8,099 fewer', '105 utility rules', '94 class names', '43 variables']) expect(lines4, piece).toContain(piece)
    expect(line('- **The stylesheet\'s growth (WS02 step 3).**')).toContain('from 122,366 bytes with the four lines alone to 123,380')
  })
})

describe('REDESIGN_STATUS.md, WS02 step 3: the lists', () => {
  it('records the step\'s decisions, each tagged with it', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'The skip link and the loading line follow the chrome\'s condition (WS02 step 3).',
      'The browser bar colour follows the Appearance pick under newLook alone (WS02 step 3).',
      'The chrome\'s rings are set by an attribute of their own (WS02 step 3).',
      'The banners\' ring on gold is navy (WS02 step 3).',
      'The four `@source not` lines ship with every switch off (WS02 step 3).',
      'The skip link has a ground of its own (WS02 step 3).',
      'Checkpoint E merges after the merge-safety review alone (WS02 step 3).',
    ])
  })

  it('records what it found or chose that differs from the plan or the brief, after the skip link\'s entry and before WS02 step 4\'s', () => {
    const heads = entries(deviations).map(head)
    const own = [
      'The skip link first at every width (WS02 step 3).',
      'The browser bar colour from a meta of the module\'s own (WS02 step 3).',
      'An attribute of the chrome\'s own for its rings (WS02 step 3).',
      'The ring colours written as hex (WS02 step 3).',
      'The frame follows the chrome\'s condition (WS02 step 3).',
      'The footer waits for the page (WS02 step 3).',
      'No ring around the main (WS02 step 3).',
      'The main takes its tabindex from the skip link alone (WS02 step 3).',
      'The theme colour test ends in `.tsx` (WS02 step 3).',
      'Ten more test files than the plan names (WS02 step 3).',
      'The browser counts rise (WS02 step 3).',
    ]
    expect(tagged(deviations).map(head)).toEqual(own)
    const first = heads.indexOf(own[0])
    expect(heads.slice(first, first + own.length)).toEqual(own)
    expect(heads[first + own.length]).toBe('The browser specs read the chrome through one helper (WS02 step 4).')
  })

  it('resolves each verify item, found in the code or measured, in the order the brief gives them', () => {
    const names = [
      'The tree', 'Lint and counts', 'The baseline', 'Where the Appearance choice is applied', 'The theme-color metas', 'The script\'s place in the head',
      'The prepaint test', 'The loading line today', 'No skip link today', 'The ring rules today', 'The banners today', 'The ring pins in the grounds tests',
      'The specs that press Tab', 'The @source not measurement', 'The dash in the site\'s description', 'The layout shift as measured',
      'The stylesheet\'s growth', 'The closing search', 'The grep check',
    ]
    expect(tagged(verify).map(head)).toEqual(names.map((n) => `${n} (WS02 step 3).`))
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^(Confirmed|Measured|Not found)\b/)
    expect(line('- **The grep check (WS02 step 3).**')).toMatch(/Measured: .*\d+ lines/)
    // The specs that press Tab, each site by file and line.
    const tab = line('- **The specs that press Tab (WS02 step 3).**')
    for (const site of ['`tokens.spec.ts` line 70', '`scopes-edges.spec.ts` line 608', '`heritage.spec.ts` line 494', '`home.spec.ts` lines 237 and 258', '`chess-data-edges.spec.ts` line 380', '`chess-data.spec.ts` line 385', '`components-edges.spec.ts` lines 266, 281 and 293', '`components.spec.ts` line 275', '`scopes-edges.spec.ts` lines 465, 563 and 627', '`scopes-edges.spec.ts` line 589']) {
      expect(tab, site).toContain(site)
    }
  })

  it('closes each follow-up WS01 handed to it with a sentence of its own, quoting no other follow-up\'s heading', () => {
    for (const [i, entry] of handed.entries()) {
      expect(entry, HANDED[i]).not.toBe('')
      const done = closing(entry, 'Done in WS02 step 3:')
      expect(done, HANDED[i]).not.toBe('')
      expect(entry.endsWith(done)).toBe(true)
      expect(done).not.toMatch(/"[^"]*\(step \d+\)"/)
    }
    // The heading WS01 wrote is still quoted in exactly one follow-up each.
    for (const quote of ['"The browser bar colour when the choice differs from the device (step 21)"', '"A light card inside a navy band (step 21)"', '"Classes only docs and tests name reach the CSS (step 23)"', '"Gold grounds in dark mode (step 23)"', '"The layout shift as measured (step 31)"']) {
      expect(entries(followUps).filter((l) => l.includes(quote)), quote).toHaveLength(1)
    }
  })

  it('closes the follow-up on K\'s yes for the stale-tab reload with the day K gave it', () => {
    expect(reloadFollowUp).toContain('Checkpoint E\'s pull request asks K for this.')
    expect(closing(reloadFollowUp, 'K said yes on')).toBe('K said yes on Friday, October 23, 2026, so the reload ships without a switch and checkpoint E waits for no other answer from K.')
  })

  it('adds its own follow-ups, none of them one WS01 handed on', () => {
    expect(tagged(followUps).filter((l) => !l.startsWith('- **From WS01: ')).map(head)).toEqual([
      'What a phone\'s browser bar shows (WS02 step 3).',
      'No chrome surface inside a navy band (WS02 step 3).',
      'The header\'s height in the loading line (WS02 step 3).',
      'Other pages loaded on demand (WS02 step 3).',
      'K looks at what `newLook` alone brings (WS02 step 3).',
      'The navigation model in the main script (WS02 step 3).',
    ])
    expect(entries(followUps).filter((l) => l.startsWith('- **From WS01: '))).toHaveLength(12)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 3: plain language', () => {
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

describe('REDESIGN_STATUS.md, WS02 step 3: its claims against the files', () => {
  it('names the two browser bar colours the module exports and index.html\'s two metas hold', () => {
    expect([THEME_COLOR_LIGHT, THEME_COLOR_DARK]).toEqual(['#1a2744', '#0b1220'])
    const colour = bullet(block, '- **The browser bar colour.**')
    expect(colour).toContain(`\`${THEME_COLOR_LIGHT}\` for Light and \`${THEME_COLOR_DARK}\` for Dark`)
    expect(colour).toContain('`THEME_COLOR_LIGHT` and `THEME_COLOR_DARK`')
    const html = read('index.html')
    expect(html).toContain(`<meta name="theme-color" content="${THEME_COLOR_LIGHT}" media="(prefers-color-scheme: light)" />`)
    expect(html).toContain(`<meta name="theme-color" content="${THEME_COLOR_DARK}" media="(prefers-color-scheme: dark)" />`)
    expect(read('src/lib/colorScheme.ts')).toContain("export const THEME_COLOR_ATTRIBUTE = 'data-appearance'")
    expect(colour).toContain('`data-appearance`')
  })

  it('names the four @source not lines src/index.css holds, in their order, the last one last', () => {
    const named = [...bullet(block, '- **The `@source not` lines.**').matchAll(/`(@source not "[^"]+";)`/g)].map((m) => m[1])
    expect(named).toEqual(['@source not "../docs";', '@source not "../test";', '@source not "../scripts";', '@source not "../*.md";'])
    const css = read('src/index.css').split('\n').filter((l) => l.startsWith('@source'))
    expect(css).toEqual(named)
  })

  it('gives the skip link\'s words, the main\'s tabindex and the loading line\'s class as src/App.tsx writes them, behind the chrome\'s condition', () => {
    const app = read('src/App.tsx')
    expect(app).toContain('      Skip to content\n')
    expect(app).toContain('min-h-[calc(100vh-var(--header-h,64px))]')
    expect(app).toContain("import { chromeOn } from '@/lib/nav'")
    expect(app).toContain('const chrome = chromeOn()')
    // The main takes its tabindex from the skip link's click and gives it back on blur; it never holds one from the start.
    expect(app).toContain("main.setAttribute('tabindex', '-1')")
    expect(app).toContain("main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true })")
    expect(app).toContain('<main className="flex-1" {...(chrome ? { id: MAIN_ID } : {})}>')
    expect(app).not.toMatch(/tabIndex[:=]/)
    const frame = bullet(block, '- **The skip link and the loading line.**')
    expect(frame).toContain('"Skip to content"')
    expect(frame).toContain('`min-h-[calc(100vh-var(--header-h,64px))]`')
    expect(frame).toContain('`#main-content`')
    expect(frame).toContain('The main takes `tabindex="-1"` from that click and gives it back as soon as the focus leaves it')
  })

  it('names the rule that keeps the footer from being drawn while the loading line shows, as src/index.css writes it, and the marker src/App.tsx puts on that line alone', () => {
    const rule = ':root[data-look="new"] main:has(> [data-loading-line]) + footer'
    expect(read('src/index.css')).toContain(`${rule} {\n    display: none;\n}`)
    expect(read('src/App.tsx').match(/data-loading-line=""/g)).toHaveLength(1)
    const frame = bullet(block, '- **The skip link and the loading line.**')
    expect(frame).toContain(`\`${rule}\``)
    expect(frame).toContain('`data-loading-line`')
    expect(frame).toContain('`/donate/success`')
  })

  it('names the attribute src/index.css keys the chrome\'s rings on and both banners carry', () => {
    const rings = bullet(block, '- **The chrome\'s rings.**')
    expect(rings).toContain('`data-ring-ground`')
    const css = read('src/index.css')
    for (const value of ['navy', 'light', 'gold']) expect(css, value).toContain(`[data-ring-ground="${value}"]`)
    expect(read('src/components/AnnouncementBanner.tsx')).toContain("data-ring-ground={toneOf(a.tone) === TONES.gold ? 'gold' : undefined}")
    expect(read('src/components/ImpersonationBanner.tsx')).toContain('data-ring-ground="gold"')
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
