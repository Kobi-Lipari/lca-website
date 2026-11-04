// test/unit/redesign-status-ws02-step9.test.ts
//
// REDESIGN_STATUS.md records WS02 step 9, the first of checkpoint G: checkpoint
// F's merge, the one listing condition, the search's normaliser, GET
// /api/search with its contract and its cache, and the five footer items the
// reviews of WS02 step 8 handed on. Like the record tests of WS02's first
// eight steps, this file reads only the WS02 section and the lines the step
// wrote outside its block (the Status and PR lines, the date line's part, the
// sentences it added to four map items, the sentence that ends one older
// deviation and one older follow-up, and the Checkpoint F section's opening),
// never every table row or heading of the file. Pinned here: the Status and
// PR lines in forms the next steps keep; the date line's parts; the map; the
// step's block with every part and every file; the Checkpoint F section's
// merged opening; the decisions, deviations, verify items and follow-ups,
// each with its tag and in its place; the plain-language rules over all of
// it; and, checked against the files they describe, the record's claims: the
// new files, and the figures it states in more than one place, which must
// agree. It pins no line of the search's files, of the footer or of the
// contact page, which later steps are named to change, and reads the new
// files only to find them and hold them to the plain-language rules; it reads
// no switch's value, no figure of the contract ratchet from the code, and
// never the clock.
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
/** What a draft would hold before its figures were filled in: the marks of WS02 step 8's drafts and the capitalised names of the earlier steps'. */
const UNFILLED = new RegExp(
  `${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}` +
    `|\\b(${['LI' + 'NT', 'BUI' + 'LD', 'BROW' + 'SER', 'CHE' + 'CKS', 'GR' + 'EP', 'CSS' + 'GROWTH', 'RELOAD' + 'TESTS', 'RECORD' + 'TESTS', 'SETUP' + 'TESTS', 'FEATURES' + 'TESTS', 'STEP32' + 'TESTS'].join('|')})\\b`,
)
/** The merge-pending phrase, of which the whole file holds one line, WS01 step 32's. */
const PENDING = new RegExp(`checkpoint D's merge is ${'pen' + 'ding'}|merge into \`main\` is ${'pen' + 'ding'}`)

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
const TAG = '(WS02 step 9).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
/** What this step added to an older line: from `from` to the end of the line. */
const closing = (entry: string, from: string) => (entry.includes(from) ? entry.slice(entry.indexOf(from)) : '')

const ws02 = between(status, '## WS02: Information architecture and navigation', '\n## WS03:')
/** A part of the WS02 section, from its heading to the next: the heading as a line of its own, since a sentence may name one in backticks. */
const part = (heading: string) => {
  const at = ws02.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws02.slice(at + 1), heading, '\n### ')
}
const STEP = '### WS02 step 9: the listing rule and the search endpoint'
const CHECKPOINT = '### Checkpoint F: WS02 steps 6 to 8'
const block = part(STEP)
const checkpoint = part(CHECKPOINT)
/** The Checkpoint F section's opening paragraph, which this step wrote. */
const opening = checkpoint.split('\n')[2] ?? ''
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

/** The map items this step proves, each keeping WS02 step 9 as its last words. */
const PROVED = ['D9', 'D26']
/** The map items later steps own that this step built a part of, each with the planned step it keeps as its last words. */
const BUILT: ReadonlyArray<readonly [string, number]> = [['AC5', 11], ['AC22', 13]]
/** The planned deviation this step ends with a sentence of its own, read from that sentence to the entry's end. */
const NORMALISER = 'The search normaliser in `domain/` (WS02 step 9).'
const NORMALISER_DONE = 'Built in WS02 step 9: `domain/format/searchText.ts` holds `normalizeSearchText` and `matchesSearch`'
const deviation = (name: string) => entries(deviations).find((l) => head(l) === name) ?? ''
/** Step 8's follow-up on the merge, which this step ends. */
const MERGE_FOLLOW_UP = 'Checkpoint F\'s merge in the record (WS02 step 8).'
const followUp = (name: string) => entries(followUps).find((l) => head(l) === name) ?? ''
/** The follow-ups the reviews of WS02 step 8 handed on, each ended in this step, and the file each names. */
const CARRIED: ReadonlyArray<readonly [string, string]> = [
  ['From WS02 step 8: the footer\'s failure notice in view (WS02 step 9).', '`src/components/layout/OnDemand.tsx`'],
  ['From WS02 step 8: the brand block\'s empty cell (WS02 step 9).', '`src/components/layout/SiteFooter.tsx`'],
  ['From WS02 step 8: the contact page\'s seat (WS02 step 9).', '`src/pages/ContactPage.tsx`'],
  ['From WS02 step 8: the trust line\'s dots between 768 and 1023 pixels (WS02 step 9).', '`src/components/layout/SiteFooter.tsx`'],
  ['From WS02 step 8: the fold keeps the focus across 768 pixels (WS02 step 9).', '`src/components/layout/SiteFooter.tsx`'],
]

/** Everything this step wrote, each piece on its own. */
const written = [
  block, opening, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), statusLine, prLine, datePart,
  ...PROVED.map((id) => closing(mapItem(id), 'Proved in step 9 by')),
  ...BUILT.map(([id]) => mapItem(id).slice(mapItem(id).indexOf('Built in step 9:'), mapItem(id).indexOf(id === 'AC5' ? 'The panel and the inline combobox' : 'Planned:'))),
  closing(deviation(NORMALISER), NORMALISER_DONE), closing(followUp(MERGE_FOLLOW_UP), 'Done in WS02 step 9:'),
]
/** The same, with what sits in backticks taken out, since code is not prose. */
const prose = written.map((text) => text.replace(/`[^`\n]*`/g, '``'))

/**
 * The files this step adds: the listing condition, the endpoint's two files, the normaliser, the contract and their tests; the ten files of edge
 * tests written once the step was built, nine of them unit tests and one an integration test; and this record's test.
 */
const NEW_FILES = [
  'functions/utils/events/listing.ts', 'functions/api/search.ts', 'functions/utils/search.ts', 'domain/format/searchText.ts', 'domain/contracts/search.ts',
  'test/unit/listing-rule.test.ts', 'test/unit/search.test.ts', 'test/unit/json-response.test.ts', 'test/unit/redesign-status-ws02-step9.test.ts',
  'test/unit/search-edges.test.ts', 'test/unit/search-contract.test.ts', 'test/unit/listing-rule-edges.test.ts', 'test/unit/footer-carried-edges.test.tsx',
  'test/unit/search-worker-closure.test.ts', 'test/unit/search-addresses.test.ts', 'test/unit/contact-seat-edges.test.tsx',
  'test/unit/on-demand-scroll-edges.test.tsx', 'test/unit/json-response-edges.test.ts',
  'test/integration/search.test.ts', 'test/integration/contracts/search.test.ts', 'test/integration/search-edges.test.ts',
]
const NEW_UNIT = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The spec this step changes, with its count in each project. */
const SPECS = ['test/a11y/nav.spec.ts']
/** The unit test files whose count grows with no change of their own. */
const GROWN = ['test/unit/domain-boundaries.test.ts']
/** The unit test files this step changes, each with its count written in the block. */
const CHANGED_TESTS = [
  'test/unit/domain-shims.test.ts', 'test/unit/format-edges.test.ts', 'test/unit/routes.test.ts', 'test/unit/on-demand.test.tsx',
  'test/unit/on-demand-edges.test.tsx', 'test/unit/footer.test.tsx', 'test/unit/footer-edges.test.tsx', 'test/unit/footer-page-links.test.tsx',
]
/** The other files this step changes. */
const CHANGED = [
  'domain/contracts/registry.ts', 'domain/contracts/index.ts', 'functions/utils/response.ts', 'src/components/layout/OnDemand.tsx',
  'src/components/layout/SiteFooter.tsx', 'src/pages/ContactPage.tsx', 'REDESIGN_STATUS.md',
]
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))

describe('REDESIGN_STATUS.md, WS02 step 9: the lines outside the block', () => {
  it('says in the Status line that steps 1 to 9 are built, or, once a later step has landed, steps 1 to that step', () => {
    const start = '**Status:** in progress: nineteen steps in five checkpoints (E for steps 1 to 5, F for 6 to 8, G for 9 to 11, H for 12 to 16, I for 17 to 19); '
    expect(statusLine.startsWith(start)).toBe(true)
    const built = /^steps 1 to (\d+) are built\.$/.exec(statusLine.slice(start.length))
    expect(built, statusLine).not.toBeNull()
    expect(Number(built![1])).toBeGreaterThanOrEqual(9)
  })

  it('names checkpoint E\'s and checkpoint F\'s pull requests and merges, and checkpoint G\'s, in the PR line, and never calls a merge pending', () => {
    expect(prLine.startsWith('**PR:** ')).toBe(true)
    for (const piece of ['pull request 110', 'checkpoint E (steps 1 to 5)', 'checkpoint F (steps 6 to 8)', 'pull request 118', '`ed03823`', 'checkpoint G (steps 9 to 11)']) {
      expect(prLine, piece).toContain(piece)
    }
    expect(prLine).not.toContain('is pending')
  })

  it('keeps WS01\'s part of the date line first and word for word, and puts step 9 first in WS02\'s part, ahead of step 8', () => {
    const after = dateLine.replace(/^Last updated: \S+ /, '')
    expect(after.startsWith('(WS01, step 32: a11y sweep; step 31: heritage layout; step 30: heritage fonts; step 29: hero images; step 28: brand marks; step 27: chess data; step 26: status tags; step 25: gold text; step 24: colours; step 23: grounds; step 22: ThemeScope; step 21: dark mode; step 20 opened checkpoint D; checkpoint C, after step 16, step 17 and step 18, is merged; checkpoint D is merged; WS02, ')).toBe(true)
    expect(after).toMatch(/; WS02, (?:[^;()]+; )*step 9: listing rule and search endpoint, the first of checkpoint G; step 8: new footer, the last of checkpoint F; /)
    expect(after.endsWith('step 1: record and brief 1.4)')).toBe(true)
    expect((/^Last updated: (\d{4}-\d{2}-\d{2}) /.exec(dateLine)?.[1] ?? '') >= '2026-11-01').toBe(true)
  })

  it('ends the planned deviation on the normaliser with a sentence of its own, its last words, its head and its place as they were', () => {
    const entry = deviation(NORMALISER)
    const done = closing(entry, NORMALISER_DONE)
    expect(done).not.toBe('')
    expect(entry.endsWith(done)).toBe(true)
    expect(entry.split(NORMALISER_DONE)).toHaveLength(2)
    expect(done).toContain('`test/unit/domain-shims.test.ts`')
  })

  it('ends step 8\'s follow-up on the merge with a sentence of its own, its last words, its head as it was', () => {
    const entry = followUp(MERGE_FOLLOW_UP)
    const done = closing(entry, 'Done in WS02 step 9:')
    expect(done).not.toBe('')
    expect(entry.endsWith(done)).toBe(true)
    for (const piece of ['`ed03823`', 'Sunday, November 1, 2026 at 11:23 AM UTC', '"Checkpoint F\'s merge (WS02 step 9)."']) expect(done, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 9: the map', () => {
  it('still maps the 23 criteria and the 12 decisions, each with exactly one planned step and no second "WS02 step"', () => {
    expect(mapItems.filter((l) => /^- \*\*AC\d+\.\*\*/.test(l))).toHaveLength(23)
    expect(mapItems).toHaveLength(35)
    for (const item of mapItems) {
      expect(item.match(/Planned: WS02 step \d+\./g), head(item)).toHaveLength(1)
      expect(item.match(/WS02 step \d+/g), head(item)).toHaveLength(1)
      expect(item, head(item)).not.toMatch(/\bin step 4\b/)
    }
  })

  it('says what proves D9 and D26, each once, each keeping WS02 step 9 as its last words, D26 naming the workstreams that build on it', () => {
    for (const id of PROVED) {
      const item = mapItem(id)
      expect(item.split('Proved in step 9 by '), id).toHaveLength(2)
      expect(item.endsWith('Planned: WS02 step 9.'), id).toBe(true)
    }
    for (const [id, piece] of [
      ['D9', '`test/integration/search.test.ts`'], ['D9', '`test/integration/contracts/search.test.ts`'], ['D9', 'never its champions, notes, ids or photos'],
      ['D26', '`test/unit/listing-rule.test.ts`'], ['D26', '`listedWhere`'], ['D26', 'WS03'], ['D26', 'WS08'], ['D26', 'to a visitor or to an admin, in either group'],
    ] as const) expect(closing(mapItem(id), 'Proved in step 9 by'), `${id}: ${piece}`).toContain(piece)
  })

  it('says what this step built of AC5 and AC22, which later steps own, each keeping its planned step as its last words', () => {
    for (const [id, planned] of BUILT) {
      const item = mapItem(id)
      expect(item.split('Built in step 9: '), id).toHaveLength(2)
      expect(item.endsWith(`Planned: WS02 step ${planned}.`), id).toBe(true)
    }
    const ac5 = mapItem('AC5')
    expect(ac5.indexOf('never an event that is not listed.')).toBeLessThan(ac5.indexOf('Built in step 9: '))
    expect(ac5.indexOf('Built in step 9: ')).toBeLessThan(ac5.indexOf('The panel and the inline combobox are built in step 10.'))
    const ac22 = mapItem('AC22')
    expect(ac22.indexOf('Search\'s contract ships with its endpoint in step 9.')).toBeLessThan(ac22.indexOf('Built in step 9: '))
    expect(ac22).toContain('`contracts[\'search\'].GET`')
    expect(ac22).toContain('`PENDING_COUNT` stays 110')
  })

  it('keeps the sentence the map closes with, word for word', () => {
    expect(map).toContain('Steps 2, 4, 6, 10, 14 and 19 fill in no item: step 2 builds what every criterion reads (the navigation model, the chrome\'s one condition and the signed-in visitor of the browser tests), step 4 moves the browser specs\' reads of the chrome into one helper, step 6 builds the sheet that AC3 and AC6 are proved on, steps 10 and 14 prove halves of AC5 and AC4, and step 19 closes the record.')
  })
})

describe('REDESIGN_STATUS.md, WS02 step 9: the Checkpoint F section\'s merged opening', () => {
  it('opens with the merge commit, its day and its time, and keeps the rest of its first paragraph', () => {
    expect(opening).toMatch(/^\*\*Merged into `main` as `ed03823` on Sunday, November 1, 2026 at 11:23 AM UTC\*\*/)
    for (const piece of [
      '`80839da`', '11:05 AM to 11:20 AM UTC', '11:25 AM UTC', '`index-BP5ORuyk.css`', '`features--b6t5tBm.js`', '42 entries, every one off',
      '5:23 AM Central', '`MobileMenu-QkI59fPU.js`', 'It changes no database.',
    ]) expect(opening, piece).toContain(piece)
    expect(checkpoint).not.toContain('Not merged yet')
    // The class helpers' file is fetched by every page, so it is not among the files no page fetches.
    expect(opening).not.toContain('utils-DmiqQ2Hc.js')
  })

  it('leaves the whole file with the one line that calls a merge pending, and never writes the hour an hour off', () => {
    expect(lines.filter((l) => PENDING.test(l))).toHaveLength(1)
    for (const text of written) expect(text).not.toContain('6:23')
  })
})

describe('REDESIGN_STATUS.md, WS02 step 9: the step block', () => {
  it('sits after the Checkpoint F section and before the decisions, once', () => {
    const at = [CHECKPOINT, STEP, '### WS02 decisions'].map((h) => ws02.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws02.split(`\n${STEP}\n`)).toHaveLength(2)
  })

  it('has every part, in order, every file and nothing left to fill in', () => {
    const parts = [
      '- **Files.**', '- **Checkpoint F\'s merge.**', '- **The listing rule.**', '- **The normaliser.**', '- **The endpoint.**', '- **The windows and the Central day.**',
      '- **The partner rows.**', '- **No name and nothing private.**', '- **The headers and the cache.**', '- **The contract and the ratchet.**', '- **The carried items.**',
      '- **The board and the brief.**', '- **What ships with every switch off.**', '- **What the merge of checkpoint G does.**', '- **Pins moved.**',
      '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- **The browser runs.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const files = bullet(block, '- **Files.**')
    expect(files).toContain('Files beyond the step\'s list:')
    for (const name of [...NEW_FILES, ...SPECS, ...CHANGED_TESTS, ...CHANGED, ...GROWN]) expect(files, name).toContain(`\`${name}\``)
    for (const name of [...NEW_UNIT, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of CHANGED_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before): `))
    for (const name of SPECS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+ in each project, (?:\\d+ before|as before): `))
    for (const name of GROWN) expect(bullet(files, '  - Grown with no change:'), name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, \\d+ before: `))
    expect(block).toContain('Baseline matches: no colour or font changed.')
    expect(block).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(15)
    for (const text of [block, opening, decisions, deviations, verify, followUps, map, statusLine, prLine, datePart]) expect(text).not.toMatch(UNFILLED)
  })

  it('says what a visitor sees by switch, and that nothing a visitor sees or hears ships with every switch off', () => {
    expect(block).toContain('What a visitor sees, by switch: with every switch off, nothing; with `newLook` alone and with `newNav` alone, the same; with the chrome on, the new footer as WS02 step 8 drew it, but that a part\'s failure notice (the donation form\'s or the menu\'s) comes into view when it shows, Donate fills the brand block\'s row on a phone where no Join LCA or Renew stands beside it, the contact page\'s board seat follows a new address, the trust line\'s dots begin at 1024 pixels, and the focus stays on the footer\'s control as the window crosses 768 pixels; with `siteSearch` on as well, nothing yet, since no page reads the endpoint until WS02 step 10.')
    expect(bullet(block, '- **What ships with every switch off.**').startsWith('- **What ships with every switch off.** Nothing a visitor sees or hears:')).toBe(true)
  })

  it('gives the listing rule\'s file, its rule, its refused aliases and the seven older uses with their files and lines', () => {
    const rule = bullet(block, '- **The listing rule.**')
    for (const piece of [
      '`functions/utils/events/listing.ts`', '`listedWhere`', '`test/unit/listing-rule.test.ts`', '`functions/api/tournaments.ts` 40 and 46',
      '`functions/api/clearinghouse.ts` 48', '`functions/api/champions.ts` 14 and 20', '`functions/api/clubs/[id].ts` 38', '`functions/tournaments/[id].ts` 36',
      'no Drizzle form', 'No index',
    ]) expect(rule, piece).toContain(piece)
  })

  it('gives the endpoint\'s groups in their order, the caps, the bound of 500 rows a read and the two reads of the tournaments', () => {
    const endpoint = bullet(block, '- **The endpoint.**')
    for (const piece of ['`functions/api/search.ts`', '`functions/utils/search.ts`', 'Tournaments, Clubs, News, Results and Champions', 'at most 5 a group and 20 in all', '500', '`db.batch`']) {
      expect(endpoint, piece).toContain(piece)
    }
    const windows = bullet(block, '- **The windows and the Central day.**')
    for (const piece of ['`zonedParts`', '`LCA_TIME_ZONE`', '`date(\'now\')`', '`functions/api/clearinghouse.ts`', 'cancelled', '`2026-11-02T04:30:00.000Z`']) expect(windows, piece).toContain(piece)
    const cache = bullet(block, '- **The headers and the cache.**')
    for (const piece of ['`Cache-Control: public, max-age=60`', '`caches.default`', '`search:v1:`', '`test/unit/json-response.test.ts`', 'in this runtime']) expect(cache, piece).toContain(piece)
    const ratchet = bullet(block, '- **The contract and the ratchet.**')
    for (const piece of ['88 handler files, 124 methods, 14 contracted and 110 pending', '89, 125, 15 and 110', '`PENDING_COUNT`', '`test/unit/routes.test.ts`']) expect(ratchet, piece).toContain(piece)
    const merge = bullet(block, '- **What the merge of checkpoint G does.**')
    for (const piece of ['merges into `main` on its own', 'No migration', '`deploy-worker.yml`', '`lca-daily-emails`', '`siteSearch`', 'WS07', '`git revert -m 1 <merge sha>`', 'WS02 step 10', 'WS02 step 11']) {
      expect(merge, piece).toContain(piece)
    }
  })

  it('says what was measured of the trust line at 800 by 1000, and the board and the brief\'s difference for it', () => {
    const carried = bullet(block, '- **The carried items.**')
    for (const piece of ['800 by 1000', '1024 pixels', '`gap-x-6`', '`scrollIntoView`', '`block: \'nearest\'`', '`?to=`', '`grid-cols-1`']) expect(carried, piece).toContain(piece)
    expect(bullet(block, '- **The board and the brief.**')).toContain('from 1024 pixels up')
  })
})

describe('REDESIGN_STATUS.md, WS02 step 9: the lists', () => {
  it('records the step\'s decisions, each tagged with it', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'The listing rule is one condition, `listedWhere` (WS02 step 9).',
      'Search decides upcoming and past by the Central day (WS02 step 9).',
      'Search answers five groups in brief 1.4\'s order (WS02 step 9).',
      'Partner events sit in the Tournaments group, after the LCA events (WS02 step 9).',
      'Search matches in code, with one normaliser (WS02 step 9).',
      'No person\'s name in search: the honor roll by year and title (WS02 step 9).',
      'The search answer is kept for a minute at the edge (WS02 step 9).',
      'The chrome\'s failure notice comes into view (WS02 step 9).',
      'Donate fills the brand block\'s row when no join slot is drawn (WS02 step 9).',
      'The contact page\'s seat follows a new address (WS02 step 9).',
      'The footer keeps the focus as the window crosses 768 pixels (WS02 step 9).',
      'The trust line\'s dots from 1024 pixels (WS02 step 9).',
    ])
  })

  it('records what differs from the brief, the plan or the notes for this workstream right after the planned entry on the normaliser, and before WS02 step 10\'s first', () => {
    const heads = entries(deviations).map(head)
    const own = [
      'Search matches in code, not by LIKE (WS02 step 9).',
      'Partner rows carry no words of their own (WS02 step 9).',
      'No 180 day bound on partner rows (WS02 step 9).',
      'No count on a tournament row (WS02 step 9).',
      'Headlines and event names are matched by their words (WS02 step 9).',
      'Champions rows open their list on the champions page (WS02 step 9).',
      'The trust line\'s dots from 1024 pixels (WS02 step 9).',
      'The map items this step fills in (WS02 step 9).',
      'Files beyond the plan\'s list (WS02 step 9).',
    ]
    const at = heads.indexOf(NORMALISER)
    expect(at).toBeGreaterThan(-1)
    expect(heads.slice(at + 1, at + 1 + own.length)).toEqual(own)
    expect(heads[at + 1 + own.length]).toBe('Search\'s final tag (WS02 step 10).')
    // The brief's own entry tagged with this step keeps its place among the brief's.
    expect(tagged(deviations).map(head)).toEqual([NORMALISER, ...own, 'From v1.3: `listedWhere` (WS02 step 9).'])
    for (const entry of entries(deviations).filter((l) => own.includes(head(l)))) {
      expect(entry).not.toMatch(/^- \*\*From v1\./)
      expect(entry).not.toContain('WS02 creates `listedWhere`')
    }
  })

  it('resolves each verify item, found in the code or measured, the plan\'s seven in the plan\'s order', () => {
    const names = [
      'The tree', 'Checkpoint F\'s merge', 'No search endpoint today', 'The tables and columns', 'Partner events in both tables', 'Caching', 'Contracts',
      'Where the normaliser lives', 'The worker', 'The seven inline uses', 'The Central day', 'The carried items', 'Lint and counts', 'The baseline',
      'The built site', 'The closing search', 'The grep check',
    ]
    expect(tagged(verify).map(head)).toEqual(names.map((n) => `${n} (WS02 step 9).`))
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^(Confirmed|Measured|Not found)\b/)
    const merge = line('- **Checkpoint F\'s merge (WS02 step 9).**')
    for (const piece of ['`ed03823`', '`8d7df98`', '`80839da`', '5:23:31 AM Central', '11:23:31 AM UTC', 'the visitor and infrastructure judges said merge']) expect(merge, piece).toContain(piece)
    expect(line('- **The grep check (WS02 step 9).**')).toMatch(/Measured: .*\d+ lines/)
  })

  it('gives the closing search\'s kinds, each with its files and a count by file, adding up to the lines it found', () => {
    const search = line('- **The closing search (WS02 step 9).**')
    const total = /found ([\d,]+) lines in (\d+) files/.exec(search)
    expect(total, 'its total').not.toBeNull()
    const kinds = [...search.matchAll(/([a-z][a-z ']+?): ([\d,]+) lines? in (\d+) files? \(([^)]*)\)/g)]
    expect(kinds.length).toBeGreaterThanOrEqual(5)
    let sum = 0
    for (const [, kind, count, files, list] of kinds) {
      const byFile = [...list.matchAll(/`[^`]+` (\d+)/g)].map((m) => Number(m[1]))
      expect(byFile, kind).toHaveLength(Number(files))
      expect(byFile.reduce((a, n) => a + n, 0), kind).toBe(num(count))
      sum += num(count)
    }
    expect(sum).toBe(num(total![1]))
  })

  it('closes the five follow-ups the reviews of WS02 step 8 handed on, then adds its own, and keeps the twelve WS01 handed on', () => {
    const own = tagged(followUps)
    expect(own.map(head)).toEqual([
      ...CARRIED.map(([name]) => name),
      'The seven inline uses of the listing rule (WS02 step 9).',
      'The panel reads the answer as it is (WS02 step 9).',
      'The page, the Popular list and the speed (WS02 step 9).',
      'A rate limit on search (WS02 step 9).',
      'News and results in search after WS10 (WS02 step 9).',
      'Checkpoint G\'s section and its pull request (WS02 step 9).',
      'From the review of checkpoint F: thirteen WS01 record tests\' banned words (WS02 step 9).',
    ])
    for (const [name, file] of CARRIED) {
      const entry = own.find((l) => head(l) === name) ?? ''
      const done = closing(entry, 'Done in WS02 step 9:')
      expect(done, name).not.toBe('')
      expect(entry.endsWith(done), name).toBe(true)
      expect(done, name).not.toMatch(/\(step \d+\)/)
      expect(done, name).toContain(file)
    }
    // The review's follow-up names the thirteen files by their lines and quotes none of the words they spell.
    const thirteen = own.find((l) => head(l).startsWith('From the review of checkpoint F:')) ?? ''
    for (const file of ['k3c', 'step21', 'step23', 'step24', 'step25', 'step26', 'step27', 'step28', 'step29', 'step30', 'step31', 'step32']) {
      expect(thirteen, file).toContain(`\`test/unit/redesign-status-${file}.test.ts\``)
    }
    expect(thirteen).toContain('`test/unit/test-setup.test.ts` lines 302 and 303')
    expect(entries(followUps).filter((l) => l.startsWith('- **From WS01: '))).toHaveLength(12)
  })
})

describe('REDESIGN_STATUS.md, WS02 step 9: plain language', () => {
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
    // The CI files are named by their file names alone.
    expect(block + opening).not.toMatch(/\.github\//)
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

describe('REDESIGN_STATUS.md, WS02 step 9: its claims against the files', () => {
  it('lists as new only files that exist, each free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of NEW_FILES) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
    for (const file of [...SPECS, ...CHANGED_TESTS, ...CHANGED, ...GROWN]) expect(existsSync(join(ROOT, file)), file).toBe(true)
  })

  it('gives unit counts that add up: the base\'s, the new files\' tests, the changed files\' gains and the grown file\'s growth, file for file with the Files bullet', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([6329, 234])
    const fresh = NEW_UNIT.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    const gains = CHANGED_TESTS.map((name) => {
      const m = new RegExp(`\`${escape(name)}\` \\((\\d+), (?:(\\d+) before|as before): `).exec(files)
      return m ? Number(m[1]) - Number(m[2] ?? m[1]) : NaN
    })
    const grown = [...bullet(files, '  - Grown with no change:').matchAll(/`[^`]+` \((\d+), (\d+) before: /g)].map((m) => Number(m[1]) - Number(m[2]))
    expect(grown).toHaveLength(GROWN.length)
    for (const n of [...fresh, ...gains]) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + [...fresh, ...gains, ...grown].reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
    expect(line('- **Lint and counts (WS02 step 9).**')).toContain(`unit ${before} tests in ${beforeFiles} files`)
  })

  it('gives integration counts that add up: the base\'s and the two new files\' tests, in two files more', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\)/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([821, 60])
    const fresh = NEW_INTEGRATION.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + fresh.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
    expect(line('- **Lint and counts (WS02 step 9).**')).toContain(`integration ${before} in ${beforeFiles}`)
  })

  it('gives browser counts that add up: the base\'s, one run on the finished tree with no test added, and the Checks line alike', () => {
    const runs = bullet(block, '- **The browser runs.**')
    const base = /the base's run: ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip/.exec(runs)
    expect(base, 'the base\'s run').not.toBeNull()
    expect([base![1], base![2], base![3]].map(num)).toEqual([995, 659, 336])
    const one = /the one run on the finished tree: "Running ([\d,]+) tests using 2 workers", "([\d,]+) skipped" and "([\d,]+) passed \(\d+\.\dm\)"/.exec(runs)
    expect(one, 'the one run').not.toBeNull()
    const [, total, skipped, passed] = one!
    expect(num(total)).toBe(num(base![1]))
    expect(num(skipped) + num(passed)).toBe(num(total))
    expect(checksLine).toContain(`${total} tests, ${passed} that run and ${skipped} that skip`)
    const projects = /`a11y-on` holds ([\d,]+) tests \(([\d,]+) that run and ([\d,]+) that skip\) and `a11y-off` ([\d,]+) \(([\d,]+) and ([\d,]+)\)/.exec(runs)
    expect(projects, 'the counts in each project').not.toBeNull()
    const [on, onRun, onSkip, off, offRun, offSkip] = projects!.slice(1).map(num)
    expect([onRun + onSkip, offRun + offSkip]).toEqual([on, off])
    expect([on + off, onRun + offRun, onSkip + offSkip]).toEqual([num(total), num(passed), num(skipped)])
  })

  it('gives the lint figures the same in the block, the verify item and the Checks line', () => {
    const lint = /the same 13 errors and 13 warnings over (\d+) files/.exec(bullet(block, '- **Lint.**'))
    expect(lint, 'the lint figures after').not.toBeNull()
    expect(checksLine).toContain(`13 errors and 13 warnings over ${lint![1]} files (749 on the base)`)
    expect(line('- **Lint and counts (WS02 step 9).**')).toContain('13 errors and 13 warnings over 749 files')
  })
})
