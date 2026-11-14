// test/unit/redesign-status-ws09-step1.test.ts
//
// REDESIGN_STATUS.md records WS09 step 1: the WS09 section opened, with its
// Status, Branch and PR lines and its opening paragraph, its map of what
// proves each acceptance criterion and decision, the step's block and the
// four lists, each opened with this step's entries. Like the record tests
// of WS08 and WS16, this file reads only the WS09 section, from its heading
// to the WS10 heading, never every table row or heading of the file, and it
// reads no figure from the code but the new files' cases. Pinned here: the
// heading word for word, which WS08's record tests cut on; the Status line's
// fixed prefix, which every step of WS09 keeps, and its tail while this
// step is the latest; the Branch and PR lines; each checkpoint named in
// full; the map, each item with exactly one planned step, and the
// sentences this step added; the block's parts in order and its figures,
// which must agree with each other; the tagged entries of the four lists;
// no table row and no merge called pending; and the plain-language rules
// over everything the step wrote. The new files are read to find them, to
// count their cases against the Files bullet and to hold them to the
// plain-language rules.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

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
const UNFILLED = new RegExp(
  `${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}|${'T' + 'BD'}\\b`,
)
/** The merge-pending phrases. */
const PENDING = new RegExp(`merge into \`main\` is ${'pen' + 'ding'}|is ${'pen' + 'ding'}`)
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i

const between = (text: string, from: string, to: string) => {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return text.slice(start, end < 0 ? undefined : end)
}
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
const TAG = '(WS09 step 1).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))

const HEADING = '## WS09: Clubs as living listings'
/** The WS09 section, from its heading to the WS10 heading. */
const ws09 = between(status, `\n${HEADING}\n`, '\n## WS10:')
const sectionLines = ws09.split('\n')
/** A part of the section, from its heading, a line of its own, to the next. */
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const MAP = '### WS09 map: what proves each acceptance criterion and decision'
const STEP = '### WS09 step 1: the record and a named public answer'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const map = part(MAP)
const block = part(STEP)
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
/** The follow-ups, the section's last list, to the section's end. */
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const statusLine = sectionLines.find((l) => l.startsWith('**Status:**')) ?? ''
const branchLine = sectionLines.find((l) => l.startsWith('**Branch:**')) ?? ''
const prLine = sectionLines.find((l) => l.startsWith('**PR:**')) ?? ''
/** The paragraph under the three lines, which says where WS09 comes from. */
const openingParagraph = sectionLines[7] ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItems = entries(map)
const mapItem = (id: string) => mapItems.find((l) => l.startsWith(`- **${id}.**`)) ?? ''
/** The highest step of WS09 with a block of its own: this step's tail of the Status line holds only while it is the latest. */
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))

/** The Status line up to and including its last fixed words: every step of WS09 keeps it, and writes only what follows. */
const STATUS_PREFIX =
  '**Status:** in progress: 38 steps in eight checkpoints (checkpoint S for steps 1 to 5, checkpoint T for steps 6 to 9, checkpoint U for steps 10 to 15, checkpoint V for steps 16 to 19, checkpoint W for steps 20 to 24, checkpoint X for steps 25 to 31, checkpoint Y for steps 32 to 35, checkpoint Z for steps 36 to 38); '
const TAIL = 'step 1 is built.'

/** A checkpoint named in full, in a sentence, or two or more named together in the plural. */
const IN_FULL = /\b[Cc]heckpoints [S-Z](?:, [S-Z])* and [S-Z]\b|\b[Cc]heckpoint [S-Z]\b/g
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
/** What is left of the prose once every checkpoint is named in full and "A to Z" is read as words: a letter of WS09's checkpoints on its own. */
const bareLetters = (section: string) =>
  [...proseOf(section).replace(IN_FULL, 'checkpoint').replace(/\bA to Z\b/g, 'in order').matchAll(/(?<![\w-])[S-Z](?![\w-])/g)].map((m) => m[0])

/** The brief's 16 criteria and the four decisions, in the map's order, each with the step planned to prove it. */
const PLANNED: ReadonlyArray<readonly [string, number]> = [
  ['Criterion 1', 33], ['Criterion 2', 34], ['Criterion 3', 33], ['Criterion 4', 34], ['Criterion 5', 23], ['Criterion 6', 22],
  ['Criterion 7', 26], ['Criterion 8', 27], ['Criterion 9', 6], ['Criterion 10', 30], ['Criterion 11', 31], ['Criterion 12', 11],
  ['Criterion 13', 14], ['Criterion 14', 18], ['Criterion 15', 38], ['Criterion 16', 22],
  ['D17', 37], ['D24', 17], ['D26', 22], ['D29', 26],
]
/** The items this step builds the first part of. */
const BUILT = ['Criterion 8', 'D29']

/** The files this step adds. */
const NEW_FILES = ['test/integration/public-answer-columns.test.ts', 'test/integration/contracts/clubs.test.ts', 'test/unit/redesign-status-ws09-step1.test.ts']
const NEW_UNIT = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.ts$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The files of code this step changes. */
const CHANGED = ['functions/api/clubs/[id].ts', 'functions/utils/clubs/publicAnswer.ts', 'domain/contracts/clubs.ts', 'domain/contracts/registry.ts', 'test/unit/contracts-pending.ts']
/** The unit test files this step changes, each with its count written in the block. */
const CHANGED_TESTS = ['test/unit/contracts-status.test.ts']
/** The tests that pass unchanged. */
const UNCHANGED = ['test/integration/public-answer-trim.test.ts', 'test/integration/public-answer-trim-edges.test.ts', 'test/unit/public-answer.test.ts']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))

describe('REDESIGN_STATUS.md, WS09 step 1: the section and its three lines', () => {
  it('keeps the WS09 heading word for word, once, after WS08\'s section and before WS10\'s', () => {
    expect(status.split(`\n${HEADING}\n`)).toHaveLength(2)
    expect(ws09).not.toBe('')
    expect(ws09.slice(1).includes('\n## ')).toBe(false)
    expect(status.indexOf('\n## WS08:')).toBeLessThan(status.indexOf(`\n${HEADING}\n`))
    expect(status.indexOf(`\n${HEADING}\n`)).toBeLessThan(status.indexOf('\n## WS10:'))
  })

  it('quotes no other section\'s heading in its words, and holds no table row', () => {
    expect(ws09.split('\n').filter((l) => !l.startsWith('#') && /(?:^|[^#`])#{2} [A-Z]/.test(l))).toEqual([])
    expect(ws09.split('\n').filter((l) => l.startsWith('|'))).toEqual([])
  })

  it('opens with the Status, Branch and PR lines, one after another under the heading, and then its opening paragraph', () => {
    expect(sectionLines.slice(1, 7)).toEqual([HEADING, '', statusLine, branchLine, prLine, ''])
    for (const line of [statusLine, branchLine, prLine, openingParagraph]) expect(line).not.toBe('')
  })

  it('keeps the Status line\'s fixed prefix and gives it this step\'s tail while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(1)
    if (latestStep === 1) expect(tail).toBe(TAIL)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })

  it('names the branch and the commit of main it was cut from', () => {
    expect(branchLine).toBe('**Branch:** `redesign/ws09-clubs`, cut from `main` at `af4a21c`.')
  })

  it('names checkpoint S in the PR line in full, waiting for its merge, by a pull request or merged, after the mail stream\'s checkpoint P', () => {
    expect(prLine.startsWith('**PR:** checkpoint S (steps 1 to 5) ')).toBe(true)
    expect(prLine).toMatch(/waits for its merge into `main`|pull request \d+|merged/)
    expect(prLine).toContain('the mail stream\'s checkpoint P')
    expect(prLine).not.toMatch(PENDING)
    expect(prLine).not.toMatch(/\bnone yet\b/)
  })

  it('says in its opening paragraph where WS09 comes from and how it runs beside the mail work', () => {
    for (const piece of [
      'the WS09 section of brief 1.4', '`docs/redesign/REDESIGN_SPEC.md`, lines 2062 to 2300', '`ws09-plan.md`', 'Thursday, November 12, 2026', '`redesign/docs-phase2`',
      'K\'s decision 1 on that plan, of Friday, November 13, 2026', 'option (a) of each of the plan\'s nine choices', '`docs/redesign/STREAMS.md`',
      'WS09 writes only inside this section of the record', 'Checkpoint S, steps 1 to 5, changes no page and needs no switch',
    ]) expect(openingParagraph, piece).toContain(piece)
  })

  it('writes the checkpoint letters in full everywhere, and still finds a letter alone', () => {
    expect(bareLetters(ws09)).toEqual([])
    expect(bareLetters('Checkpoints T, U and V come next; W waits.')).toEqual(['W'])
    expect(bareLetters('checkpoint S, A to Z, and `Work-S` in backticks')).toEqual([])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 1: the map', () => {
  it('maps the 16 criteria and the four decisions as a list, in order, and says so', () => {
    expect(map).not.toBe('')
    expect(mapItems.map((l) => l.slice(4, l.indexOf('.**')))).toEqual(PLANNED.map(([id]) => id))
    expect(map).toContain('20 in all')
    expect(map).toContain('The map is a list and not a table')
    expect(map).toContain('the step the plan gives the item, with any part another step brings, earlier or later, named in the item')
  })

  it('ends each item with exactly one planned step, the step the plan gives it', () => {
    for (const [id, step] of PLANNED) {
      const item = mapItem(id)
      const planned = item.match(/Planned: WS09 step (?:[1-9]|[1-3]\d)\./g) ?? []
      expect(planned.length, id).toBe(1)
      expect(item.endsWith(`Planned: WS09 step ${step}.`), id).toBe(true)
    }
  })

  it('says what this step built of criterion 8 and D29, each once, ahead of the planned step, and proves no item in full', () => {
    for (const id of BUILT) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 1: the first part, '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 1: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    }
    expect(mapItems.filter((l) => l.includes('Built in WS09 step 1:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(BUILT)
    expect(map).not.toContain('Proved in WS09 step 1')
    for (const piece of ['`PUBLIC_CLUB_COLUMNS`', '`publicClubAnswer`', '`test/integration/public-answer-columns.test.ts`', '`clubEmailHidden`', '`CLUB_EMAIL_HIDDEN`']) {
      expect(mapItem('Criterion 8'), piece).toContain(piece)
    }
  })

  it('gives the decisions their settled words and days, and the criteria the brief\'s words', () => {
    for (const [id, piece] of [
      ['D17', 'settled by K, Fri, Oct 9 and Thu, Oct 15, 2026'], ['D24', 'settled by K, Mon, Oct 19, 2026'], ['D26', 'settled by K, Tue, Oct 20, 2026'],
      ['D29', 'relayed, never shown (settled by K, Mon, Oct 19, 2026'], ['Criterion 8', 'No public page, API response or page HTML carries a club\'s contact email'],
      ['Criterion 2', '"N clubs match <text> · Show all 25"'], ['Criterion 16', 'A member-created event (D26) never shows on a club page'],
      ['Criterion 2', 'its phones part with WS09 step 35'], ['Criterion 3', 'Its phones part comes with WS09 step 35'],
    ] as const) expect(mapItem(id), `${id}: ${piece}`).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 1: the step block', () => {
  it('sits after the map and before the four lists, once, and every heading of the section is WS09\'s', () => {
    const at = [MAP, STEP, ...LISTS].map((h) => ws09.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    const headings = sectionLines.filter((l) => l.startsWith('### '))
    const FIXED = [MAP, STEP, ...LISTS]
    for (const fixed of FIXED) expect(headings.filter((h) => h === fixed), fixed).toHaveLength(1)
    for (const h of headings.filter((l) => !FIXED.includes(l))) expect(/^### (?:WS09 step (?:[1-9]|[1-3]\d): \S|Checkpoint [S-Z]: WS09 |WS09 checkpoint T: \S|WS09 checkpoint S, after K's answers: \S)/.test(h), h).toBe(true)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The named answer.**', '- **The list\'s contract.**', '- **The map.**', '- **The branch.**',
      '- **What the merge does.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(checksLine).not.toBe('')
  })

  it('names every file it adds and changes, each new and changed test with its count, and the three sub-lines', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_TESTS, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_FILES) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of CHANGED_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before): `))
    expect(files).toContain('  - Grown with no change: none.')
    expect(files).toContain('  - Files beyond the step\'s list: `test/unit/contracts-status.test.ts`')
    expect(files).toContain('Nothing under `src/`, `workers/`, `migrations/` or `scripts/` changes')
  })

  it('gives the named answer its 13 columns in the table\'s order, its list and its unchanged constant', () => {
    const named = bullet(block, '- **The named answer.**')
    for (const piece of [
      '`id, name, city, location, description, meeting_schedule, contact_email, created_at, color, image_url, region, latitude, longitude`',
      '`SELECT *`', '`PUBLIC_CLUB_COLUMNS`', '`functions/utils/clubs/publicAnswer.ts`', '`publicClubAnswer` keeps only those keys', 'before the contact email\'s trim',
      '`CLUB_EMAIL_HIDDEN` and its comment are as they were', '`clubRowSchema`',
    ]) expect(named, piece).toContain(piece)
  })

  it('gives the list its contract, its nine columns and its line in the registry, and leaves its query alone', () => {
    const list = bullet(block, '- **The list\'s contract.**')
    for (const piece of ['`clubListResponseSchema`', '`clubListItemSchema`', 'the nine columns `functions/api/clubs.ts` selects, whose query is not touched', '`domain/contracts/registry.ts`', '`test/integration/contracts/clubs.test.ts`']) {
      expect(list, piece).toContain(piece)
    }
  })

  it('names the map\'s two items, the branch, and what the merge does', () => {
    const mapPart = bullet(block, '- **The map.**')
    for (const piece of ['20 items', 'criterion 8 and D29', 'It proves no item in full.']) expect(mapPart, piece).toContain(piece)
    expect(bullet(block, '- **The branch.**')).toContain('`redesign/ws09-clubs`, cut from `main` at `af4a21c`, the merge of pull request 127')
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration and no new endpoint.', '`deploy-worker.yml`', 'daily-emails worker', 'byte for byte as before']) expect(does, piece).toContain(piece)
  })

  it('says nothing a visitor or a member can see or do ships with every switch off, and names the tests that pass unchanged', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Nothing a visitor or a member can see or do.')).toBe(true)
    for (const piece of ['`GET /api/clubs` and `GET /api/clubs/[id]`', 'byte for byte, for every seeded club', 'pass unchanged', 'No switch is added']) expect(ships, piece).toContain(piece)
    for (const name of UNCHANGED) expect(ships, name).toContain(`\`${name}\``)
  })

  it('names the two pins it moves, the pending count among them, and its judgement calls', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/unit/contracts-pending.ts`', '`GET clubs` leaves the list', '`PENDING_COUNT` goes from 110 to 109', '28 contracted and 109 pending, 27 and 110 on the base',
      '`test/unit/contracts-status.test.ts`', '"110 lines, count pinned"', 'no pin on words a record wrote moves',
    ]) expect(pins, piece).toContain(piece)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })

  it('gives the lint as unchanged, the build and the worker against the base, and each figure of the checks once', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      '`af4a21c`', 'a local production build', '`VITE_`', '`index-B-xykFls.js` 554,147 bytes', '`index-MGRWYyBv.css` 131,136 bytes', '`features-DxqQlIon.js` 698 bytes',
      'the same names and sizes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes', 'on the base and on the finished tree alike',
    ]) expect(build, piece).toContain(piece)
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 1: the lists', () => {
  it('tags every entry of the four lists in the form the record keeps', () => {
    for (const list of [decisions, verify, followUps]) {
      expect(entries(list).length).toBeGreaterThan(0)
      for (const entry of entries(list)) expect(entry).toMatch(/^- \*\*[^*]+ \(WS09 step (?:[1-9]|[1-3]\d)\)\.\*\* \S/)
    }
    expect(deviations).toContain('None in WS09 step 1.')
  })

  it('records the decisions this step takes, K\'s decision 1 with its day', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'K\'s nine choices on the plan (WS09 step 1).',
      '38 steps in eight checkpoints (WS09 step 1).',
      'The public club answer names its columns (WS09 step 1).',
    ])
    expect(tagged(decisions)[0]).toContain('K\'s decision 1, of Friday, November 13, 2026: "All recommendations are good"')
  })

  it('resolves the four verify items, each confirmed on the base', () => {
    expect(tagged(verify).map(head)).toEqual([
      'The public answer read every column (WS09 step 1).',
      'The contract is strict (WS09 step 1).',
      'The pending count (WS09 step 1).',
      'The WS09 record section (WS09 step 1).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `af4a21c`: /)
  })

  it('records its own follow-ups, each once', () => {
    const own = ['The pending count beside the mail stream\'s (WS09 step 1).', 'The site\'s type for the clubs list (WS09 step 1).']
    expect(tagged(followUps).map(head)).toEqual(own)
    expect(tagged(followUps)[1]).toContain('`ApiClubListItem`')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 1: plain language', () => {
  const prose = proseOf(ws09)

  it('reads every piece it means to', () => {
    for (const text of [ws09, map, block, decisions, deviations, verify, followUps, openingParagraph, checksLine]) expect(text).not.toBe('')
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials, unfilled marks and the merge-pending phrases out of what the step wrote', () => {
    expect(ws09).not.toMatch(DASHES)
    expect(ws09).not.toMatch(BANNED)
    expect(ws09).not.toMatch(TOOLS)
    expect(ws09).not.toMatch(BARE)
    expect(ws09).not.toMatch(OLD_INITIALS)
    expect(ws09).not.toMatch(UNFILLED)
    expect(ws09).not.toMatch(PENDING)
    expect(ws09).not.toMatch(/\.github\//)
  })

  it('calls K, the owner, K or they, never he, and names steps as "WS09 step N"', () => {
    expect(prose).not.toMatch(HE)
    expect(ws09).not.toMatch(/\(step \d+[;),]/)
  })

  it('gives every date the weekday it falls on, and writes every time on the twelve-hour clock', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const months = MONTHS.join('|')
    const short = MONTHS.map((m) => m.slice(0, 3)).join('|')
    for (const found of prose.matchAll(new RegExp(`\\b(?:${months}|${short}) \\d{1,2}\\b`, 'g'))) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const [whole, weekday, month, day, year] of prose.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${months}) (\\d{1,2})\\b(?:, (\\d{4}))?`, 'g'))) {
      expect(WEEKDAYS[new Date(Date.UTC(Number(year ?? 2026), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 1: its claims against the files', () => {
  it('lists as new only files that exist, each with as many cases as the Files bullet gives it and free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_TESTS]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_FILES) {
      const written = Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])
      expect(written, file).toBe((read(file).match(/^\s*it\(/gm) ?? []).length)
    }
    for (const file of NEW_FILES) {
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
  })

  it('gives unit counts that add up: the base\'s and the new file\'s tests', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([8841, 338])
    const fresh = NEW_UNIT.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + fresh.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s and the two new files\' tests', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1817, 108])
    const fresh = NEW_INTEGRATION.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + fresh.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the lint figures as the base\'s with the new files added, and the build\'s file count once on each side', () => {
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(959)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_FILES.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built, 'the build in the Checks line').not.toBeNull()
    expect(checked, 'the bundle check in the Checks line').not.toBeNull()
    expect(built![1]).toBe(checked![1])
  })
})
