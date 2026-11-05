// test/unit/redesign-status-ws08-step4.test.ts
//
// REDESIGN_STATUS.md records WS08 step 4, the first step of checkpoint K: D24's
// rule on the setup save, the create's fee list built by the same helper, an
// empty club id read as no club, checkpoint J's merge and ordering rule 2. Like
// the record tests of WS08 steps 1 to 3, this file reads only the WS08 section,
// ordering rule 2, which this step rewords, and the one piece of the date line
// the step writes, the date, never every table row or heading of the file, and
// it reads no count or figure from the code. Pinned here: the step's block,
// after the Checkpoint J section and before the four lists, with its parts in
// order, every file it names, the four of tests written once the rule was
// built among them, and figures that agree with each other; the
// Status line's tail while this step is the latest; the PR line; the
// Checkpoint J section's merged opening; the five sentences this step adds to
// the map; its entries in the four lists, the two new follow-ups in their
// place and the sentences that end seven older follow-ups; ordering rule 2's
// new words; the plain-language rules over everything the step wrote; and the
// date. The files the step touches are read only to find them and hold them to
// the plain-language rules.
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
/** What a draft would hold before its figures were filled in: the marks of the earlier records' drafts and their capitalised names. */
const UNFILLED = new RegExp(
  `${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}` +
    `|\\b(${['LI' + 'NT', 'BUI' + 'LD', 'BROW' + 'SER', 'CHE' + 'CKS', 'GR' + 'EP', 'CSS' + 'GROWTH', 'RELOAD' + 'TESTS', 'RECORD' + 'TESTS', 'SETUP' + 'TESTS', 'FEATURES' + 'TESTS', 'STEP32' + 'TESTS'].join('|')})\\b`,
)
/** The merge-pending phrase, which the file holds once, in WS01 step 32's line, and this section never. */
const PENDING = new RegExp(`checkpoint D's merge is ${'pen' + 'ding'}|merge into \`main\` is ${'pen' + 'ding'}`)

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
const TAG = '(WS08 step 4).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))

const HEADING = '## WS08: Director and admin tools (TD console, setup checklist, admin home and queues)'
/** The WS08 section, from its heading to the WS09 heading. */
const ws08 = between(status, `\n${HEADING}\n`, '\n## WS09:')
const sectionLines = ws08.split('\n')
/** A part of the section, from its heading, a line of its own, to the next. */
const part = (heading: string) => {
  const at = ws08.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws08.slice(at + 1), heading, '\n### ')
}
const MAP = '### WS08 map: what proves each acceptance criterion and decision'
const STEP1 = '### WS08 step 1: the record and the creation rules'
const STEP2 = '### WS08 step 2: migration 0059, the ticket kinds and the review mark'
const STEP3 = '### WS08 step 3: the create through the creation rules and the first director'
const CHECKPOINT = '### Checkpoint J: WS08 steps 1 to 3'
const STEP = '### WS08 step 4: the entry fee rule on a save'
const LISTS = ['### WS08 decisions', '### WS08 deviations from the brief', '### WS08 verify items resolved', '### WS08 follow-ups']
const map = part(MAP)
const block = part(STEP)
const checkpoint = part(CHECKPOINT)
/** The Checkpoint J section's opening paragraph, which this step rewrites in its merged form. */
const opening = checkpoint.split('\n')[2] ?? ''
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
/** The follow-ups, the section's last part, to its end. */
const followUps = ws08.includes(`\n${LISTS[3]}\n`) ? ws08.slice(ws08.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const statusLine = sectionLines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = sectionLines.find((l) => l.startsWith('**PR:**')) ?? ''
/** Ordering rule 2, outside the section, which this step rewords. */
const RULE_OPENING = '2. **The preview database is migrated from the branch before anyone reviews a checkpoint\'s preview, not after the merge.** '
const rules = status.split('\n').filter((l) => l.startsWith('2. **'))
const rule = rules.find((l) => l.startsWith(RULE_OPENING)) ?? ''
/** The date at the start of the date line, the one piece of that line this step writes. */
const date = /^Last updated: (\d{4})-(\d{2})-(\d{2}) \(/.exec(status.split('\n').find((l) => l.startsWith('Last updated:')) ?? '')
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItems = entries(map)
const mapItem = (id: string) => mapItems.find((l) => l.startsWith(`- **${id}.**`)) ?? ''
const followUp = (name: string) => entries(followUps).find((l) => head(l) === name) ?? ''
/** What this step added to an older line: from `from` to the end of the line. */
const closing = (line: string, from: string) => (line.includes(from) ? line.slice(line.indexOf(from)) : '')

/** The Status line up to and including its last fixed words, which WS08 step 1 set and every step keeps. */
const STATUS_PREFIX = '**Status:** in progress: the first part, tournament creation, ten steps in three checkpoints (checkpoint J for steps 1 to 3, checkpoint K for 4 to 6, checkpoint L for 7 to 10); '
/** The tail this step writes. */
const TAIL = 'steps 1 to 4 are built.'
/** The highest step with a block of its own in the section: a later step owns the Status line's tail. */
const latestStep = Math.max(0, ...[...ws08.matchAll(/^### WS08 step (\d+): /gm)].map((m) => Number(m[1])))

const ENTRY_FEES = '`test/integration/entry-fees.test.ts`'
const EDGES = '`test/integration/entry-fees-edges.test.ts`'
/** The sentences this step adds to the map, each with the item it goes in and the words it must sit in front of. */
const SENTENCES: ReadonlyArray<readonly [string, string, string]> = [
  ['AC15', 'Built in WS08 step 4: the server\'s refusal and what passes.', 'Planned: WS08 step 10.'],
  ['D24', `Proved in WS08 step 4 by ${ENTRY_FEES} and ${EDGES}: `, 'Planned: WS08 step 4.'],
  ['Q37', `Proved in WS08 step 4 by ${ENTRY_FEES}: `, 'Built in WS08 step 3: '],
  ['WS01\'s follow-up on the LCA membership requirement', `Proved in WS08 step 4 by ${ENTRY_FEES}: the echoed answer passes.`, 'Planned: WS08 step 4.'],
  ['WS01\'s three follow-ups on section prices', 'Read in WS08 step 4: no row has a tier price yet; handed to the console part.', 'Planned: WS08 step 4.'],
]

/** The follow-ups this step writes, after the six WS08 step 1 carried and before WS08 step 2's first. */
const NEW_FOLLOW_UPS = [
  'The fee tiers\' follow-ups wait for the Fees step (WS08 step 4).',
  'README.md\'s Safe previews section and ordering rule 2 (WS08 step 4).',
]
/** The older follow-ups this step ends, each with the words its sentence opens with. */
const ENDED: ReadonlyArray<readonly [string, string]> = [
  ['From WS01: the LCA membership requirement (WS08 step 4).', 'Done in WS08 step 4: '],
  ['From WS01: the three follow-ups on section prices (WS08 step 4).', 'Read in WS08 step 4 and left open, '],
  ['K migrates the preview database before checkpoint J\'s preview (WS08 step 2).', 'Resolved in WS08 step 4: '],
  ['The create\'s fee list and a section\'s own early and late prices (WS08 step 4).', 'Resolved in WS08 step 4: '],
  ['Checkpoint J\'s merge in the record (WS08 step 4).', 'Resolved in WS08 step 4: '],
  ['An empty club id refused with the LCA-run words (WS08 step 4).', 'Resolved in WS08 step 4: '],
  ['K watches migrate-db.yml apply 0059 when checkpoint J merges (WS08 step 3).', 'Resolved in WS08 step 4: '],
]

/** The files this step adds: its own two, and the four of tests written once the rule was built. */
const NEW_FILES = [
  'test/integration/entry-fees.test.ts',
  'test/unit/redesign-status-ws08-step4.test.ts',
  'test/integration/entry-fees-edges.test.ts',
  'test/integration/tournament-create-fees.test.ts',
  'test/unit/saved-section-fees.test.ts',
  'test/unit/redesign-status-ws08-step4-claims.test.ts',
]
const NEW_UNIT = NEW_FILES.filter((name) => name.startsWith('test/unit/'))
const NEW_INTEGRATION = NEW_FILES.filter((name) => name.startsWith('test/integration/'))
/** The files of code and record this step changes. */
const CHANGED = ['functions/api/admin/tournaments/[id].ts', 'functions/utils/events/sectionsRepo.ts', 'functions/api/admin/tournaments.ts', 'domain/events/creation.ts', 'REDESIGN_STATUS.md']
/** The test file this step extends, with its count written in the block. */
const CHANGED_TESTS = ['test/integration/tournament-create.test.ts']
/** The tests whose pins this step moves, each named among the changed files with its count as before. */
const MOVED = ['test/unit/preview-database.test.ts', 'test/unit/redesign-status-ws08-step2-claims.test.ts']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
/** A checkpoint named in full, or several named together, as WS08 step 1's record test reads them. */
const IN_FULL = /\b[Cc]heckpoints [JKL](?:, [JKL])* and [JKL]\b|\b[Cc]heckpoint [JKL]\b/g
/** A J or an L on its own in the prose, or a K in the place a checkpoint's letter takes. */
const bareLetters = (text: string) =>
  [...proseOf(text).replace(IN_FULL, 'checkpoint').matchAll(/(?<![\w-])[JL](?![\w-])|(?<![\w-])K (?:for (?:steps )?\d|\(steps? \d)/g)].map((m) => m[0])

/** Everything this step wrote, each piece on its own. */
const written = [
  block, opening, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...NEW_FOLLOW_UPS.map(followUp),
  ...ENDED.map(([name, opens]) => closing(followUp(name), opens)), statusLine.slice(STATUS_PREFIX.length), prLine,
  ...SENTENCES.map(([id, opens]) => closing(mapItem(id), opens).slice(0, closing(mapItem(id), opens).indexOf('.', opens.length) + 1)),
  rule, date?.[0] ?? '',
]

describe('REDESIGN_STATUS.md, WS08 step 4: the step block', () => {
  it('sits after the Checkpoint J section and before the four lists, once, under a heading in the record\'s form', () => {
    const at = [MAP, STEP1, STEP2, STEP3, CHECKPOINT, STEP, ...LISTS].map((h) => ws08.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws08.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(STEP).toMatch(/^### WS08 step 4: \S/)
    expect(sectionLines.filter((l) => /^### Step\b/.test(l))).toEqual([])
    expect(sectionLines.filter((l) => l.startsWith('|'))).toEqual([])
  })

  it('opens by naming the step and its checkpoint, and says what a visitor sees, by switch', () => {
    const first = block.split('\n')[2] ?? ''
    expect(first.startsWith('WS08 step 4 is the first step of checkpoint K.')).toBe(true)
    for (const piece of [
      'a save that raises what an entrant pays, at any tier of any section, above the stored price is refused',
      'so a one-event director can finish an event the president priced', 'with it unset, the save answers, writes and refuses as before',
      'what a visitor sees, by switch, is nothing new',
    ]) expect(first, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **The rule.**', '- **The comparison.**', '- **The membership switch.**', '- **The create.**',
      '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const p of parts) expect(block.split('\n').filter((l) => l.startsWith(p)), p).toHaveLength(1)
  })

  it('names every file it adds and changes, the new ones as new, each test with its count, and no other file', () => {
    const files = bullet(block, '- **Files.**')
    const fresh = files.slice(files.indexOf('New: '), files.indexOf(' Changed: '))
    for (const name of NEW_FILES) expect(fresh, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    const changed = files.slice(files.indexOf(' Changed: '))
    for (const name of [...CHANGED, ...CHANGED_TESTS, ...MOVED]) expect(changed, name).toContain(`\`${name}\``)
    for (const name of CHANGED_TESTS) expect(changed, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, \\d+ before: `))
    for (const name of MOVED) expect(changed, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, as before: `))
    expect(files).toContain('No other file is added or changed: nothing under `src/`, `migrations/`, `workers/`, `scripts/` or `scanner/`, nothing else under `domain/`, nor `package.json` or the lock file.')
    const beyond = bullet(block, '  - Files beyond the step\'s list:')
    for (const name of NEW_FILES.slice(2)) expect(beyond, name).toContain(`\`${name}\``)
    expect(beyond).toContain('`domain/events/creation.ts`')
    expect(files).toContain('every case reading the stored rows after the call')
  })

  it('gives the rule: the words of the refusal, one helper deciding with no role named, what counts as a raise and what passes', () => {
    const rule = bullet(block, '- **The rule.**')
    for (const piece of [
      'Once `CREATION_ROLES_ON` is set, `PATCH /api/admin/tournaments/[id]` refuses a save that raises what an entrant pays, at any tier, early, regular or late, of any section, above the stored price',
      '`canChargeFees(person, { clubId, createdBy }, rolesOn)`',
      '403 with `FEES_NEED_PAYOUT_ACCOUNT`, "Entry fees need a payout account first. Until then, your event can run at $0."',
      'The handler names no role', 'the constant is read inside the handler at each request', '`feesRaised(before, after)`',
      'a late fee that appears with its date or a date that makes a stored late fee real', 'the manage answer sent back among them', 'since a discount lowers the early price',
      'a late fee with no late date', 'a new section at $0', 'and a raised event fee that no section pays, live or archived',
      'the event\'s fee raised where a section pays it, an archived one included', 'a price stored below $0 set to $0 among them',
      'a section brought back from the archive above the prices its row kept', 'a discount lowered or taken away, its deadline cleared among them',
      'a save that changes when a tier applies but not the price `tierFees` gives it, a stored late date or early deadline moved earlier among them, since the rule reads what each tier costs and not when it applies',
      'with the constant unset so does everyone the manage check admits, an assigned director among them, as today', 'so a refused save writes nothing',
    ]) expect(rule, piece).toContain(piece)
  })

  it('gives the comparison: the stored rows as the base, by id then by name, every element as the writer stores it, a bare name at the event\'s fee, a left-out section and a null tier', () => {
    const comparison = bullet(block, '- **The comparison.**')
    for (const piece of [
      '`savedSectionFees(stored, list, tournament)`', 'on the event\'s rows as `loadSections` reads them with the archived ones',
      'both take every row, the archived ones included', 'the waitlist\'s offer prices it from that row',
      '`before` is every row as stored, keyed by its id', '`after` is the same with the save applied',
      '`entryFee`, `earlyDeadline`, `earlyDiscount`, `lateAfter` and `lateFee`', 'every element read as `buildSaveSections` stores it',
      'matched to a row by id, else to the live row of its name, else to the latest archived row of that name',
      '`columnsFromLegacy`\'s `fee_regular`, its `entryFee` when that is a number and null otherwise, for a matched section and a new one alike',
      'so a bare name, or a section whose fee is left out, null or not a number, pays the event\'s fee', '(`sectionFeeOverrides`)',
      'so the manage answer sent back, whose fees carry it, sets nothing', 'null for a new section',
      'so a section brought back from the archive is compared with its own row',
      'Every row the list does not take keeps its own prices in `after`', 'neither losing its prices, so leaving a section out raises nothing',
      'A null early or late price reads as the regular price in both lists, so a discount is never a raise.',
      'A price below $0 reads as $0 in both, as checkout charges it.',
    ]) expect(comparison, piece).toContain(piece)
  })

  it('keeps the membership switch as it was, a standing director refused with today\'s words (Q37), and gives the create\'s list and the empty club id', () => {
    const membership = bullet(block, '- **The membership switch.**')
    for (const piece of [
      'Unchanged: only an LCA admin or the organizing club\'s rep may send `requiresLcaMembership`',
      '"Only the organizing club\'s rep or an LCA admin can change whether an LCA membership is required"', 'whether it sends the switch off or on',
      'their LCA-run event keeps `requires_lca_membership` 1', '"Q37 on its default: a standing director\'s and the president\'s events are LCA-run (WS08 step 1)"',
    ]) expect(membership, piece).toContain(piece)
    const create = bullet(block, '- **The create.**')
    for (const piece of [
      '`feesRaised([], savedSectionFees([], sections, { entry_fee }))`', 'its default Open section at the event\'s fee included',
      '`createdFees`, which built it, are gone', '`if (body.clubId === \'\') body.clubId = null`',
      '`const clubId = person.repClubId ?? (body.clubId ?? null)`, stays word for word',
      'which failed on the club\'s foreign key and answered 500, now makes an LCA-run event', 'where it was refused with `LCA_RUN_ONLY`',
    ]) expect(create, piece).toContain(piece)
  })

  it('says nothing a visitor sees ships with every switch off, names the one answer a request no page sends changes, and the worker\'s bundle', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Nothing a visitor sees or hears.')).toBe(true)
    for (const piece of [
      'so the setup save answers, writes and refuses as before', 'The create\'s fee check refuses no creator in either state',
      'an LCA admin\'s create with `clubId: ""`, which answered 500 and now makes an LCA-run event', 'since the wizard sends null for no club',
      '`deploy-worker.yml` redeploys the daily-emails worker when checkpoint K merges', 'gives the same `index.js`, 32,757 bytes, byte for byte',
    ]) expect(ships, piece).toContain(piece)
  })

  it('names the two pins it moves, each with its old and new expectation and its reason, and leaves the README\'s case as it was', () => {
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins.startsWith('- **Pins moved.** Two, because ordering rule 2 is reworded to say who migrates the preview database')).toBe(true)
    const moved = pins.split('\n').filter((l) => /^\s+- /.test(l))
    expect(moved).toHaveLength(2)
    for (const piece of [
      '`test/unit/preview-database.test.ts`: in its case "records both ordering rules"',
      '`/K migrates the preview database from the branch before reviewing each checkpoint/i` to `/The preview database is migrated from the branch before anyone reviews a checkpoint\'s preview, not after the merge/i`',
      'reads that section and not ordering rule 2, so it does not move',
    ]) expect(moved[0], piece).toContain(piece)
    for (const piece of [
      '`test/unit/redesign-status-ws08-step2-claims.test.ts`: its case "quotes ordering rule 2 word for word"',
      '`2. **K migrates the preview database`', '`2. **The preview database is migrated from the branch`',
      '"ordering rule 2 applies to it:"', '"ordering rule 2 now reads:"', 'with the same three checks',
    ]) expect(moved[1], piece).toContain(piece)
  })

  it('gives its judgement calls, the lint as unchanged, the build against the base, and each figure of the checks once', () => {
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(12)
    for (const piece of [
      'The rows are read with the archived ones', 'and both lists take every row', 'The person is read only once a raise is found',
      'A section the list leaves out keeps its own prices in `after`', '`feesRaised` reads a price below $0 as $0, as checkout charges it',
      'The lists have no entry for the event\'s own fee', 'The comparison reads the prices `tierFees` gives',
      'The rule comes before the writers\' own checks of a list', 'The club line stays word for word',
      'Q37\'s sentence in the map goes before WS08 step 3\'s "Built" sentence', 'The two new follow-ups sit after the six WS08 step 1 carried',
      'The rule reads what each tier costs and not when each tier applies',
      'a stored late date or early deadline moved earlier, a late date added under a section\'s own late price, and an early deadline cleared over a section\'s own early price',
      'a section\'s own late price above its regular price with no late date is refused',
      'is a question for K, in the follow-up "The fee tiers\' follow-ups wait for the Fees step (WS08 step 4)"',
    ]) expect(calls, piece).toContain(piece)
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['`73943e1`', '`index-BK-tB9L4.js` 549,814 bytes', '`index-Dxhkeo-q.css` 130,292 bytes', '`features--b6t5tBm.js` 685 bytes', 'byte for byte']) {
      expect(build, piece).toContain(piece)
    }
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 4: the lines outside the block', () => {
  it('keeps the Status line\'s fixed prefix and gives it this step\'s tail while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(4)
    if (latestStep === 4) expect(tail).toBe(TAIL)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })

  it('says in the PR line that checkpoint J was merged, and keeps the parts of checkpoint K and checkpoint L until checkpoint K\'s pull request opens', () => {
    expect(prLine).toContain('**PR:** checkpoint J (steps 1 to 3) was draft pull request 123, merged into `main` as `73943e1` on Wednesday, November 4, 2026; ')
    if (latestStep < 6) {
      expect(prLine.endsWith('checkpoint K (steps 4 to 6) opens as a draft pull request after WS08 step 6 and checkpoint L (steps 7 to 10) after WS08 step 10, each merged on its own.')).toBe(true)
    }
    expect(prLine).not.toContain('is pending')
  })

  it('opens the Checkpoint J section with the merge, what it was seen to do and the window it left, and keeps the section\'s own words after it', () => {
    expect(opening.startsWith('**Merged into `main` as `73943e1` on Wednesday, November 4, 2026 at 7:15 PM UTC** (pull request 123, a merge commit on head `f009186`), which was 1:15 PM Central.')).toBe(true)
    for (const piece of [
      'What the merge did, as seen afterwards:', 'the daily-emails worker\'s redeploy, its bundle unchanged, had both succeeded by 7:17 PM UTC',
      '`migrate-db.yml` started with the push at 7:15 PM UTC and failed at 7:16 PM on its first step, wrangler\'s list of the migrations, with a Cloudflare API internal error (code 7500), before anything was applied',
      'its failed job was re-run at 7:19 PM, the re-run applied 0059 at 7:21 PM', 'one read-only `SELECT` of `d1_migrations` then showed `0059_ticket_kinds.sql` as the last file applied',
      'from about 7:17 PM, when the Pages build went live, to 7:21 PM UTC, about four minutes', 'would have answered 500 and everything else answered as before',
      'byte for byte the build measured on `5a3ae15` and `3463307`', '`index-BK-tB9L4.js` at 549,814 bytes', '`index-Dxhkeo-q.css` at 130,292', '`features--b6t5tBm.js` at 685',
      'at about 7:05 PM UTC, before the merge', 'which applied 0058 and 0059', 'Checkpoint J lays the ground of the first part', 'It changes no page.',
    ]) expect(opening, piece).toContain(piece)
    expect(checkpoint).not.toContain('Not merged yet')
    expect(checkpoint).not.toContain('waits for its merge')
    expect(checkpoint).not.toMatch(PENDING)
  })

  it('adds its five sentences to the map, once each, each in front of the words it goes before, and to no other item', () => {
    for (const [id, sentence, before] of SENTENCES) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.indexOf(sentence), id).toBeLessThan(item.lastIndexOf(before))
      expect(item, id).toMatch(/Planned: WS08 step (?:[1-9]|10)\.$/)
    }
    expect(mapItems.filter((l) => l.includes('in WS08 step 4')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(SENTENCES.map(([id]) => id))
    for (const piece of [
      'a one-event director\'s save that raises what an entrant pays at any tier is refused with 403 and the payout words and stores nothing',
      'a standing director, the president, an LCA admin and the organizing club\'s rep each raise a fee', 'with the constant unset the one-event director\'s raise passes, as today',
    ]) expect(mapItem('D24'), piece).toContain(piece)
    for (const piece of ['gets today\'s 403', '`requires_lca_membership` 1', 'as the decision "Q37 on its default: a standing director\'s and the president\'s events are LCA-run (WS08 step 1)" sets it']) {
      expect(mapItem('Q37'), piece).toContain(piece)
    }
  })

  it('rewords ordering rule 2: from the branch, before anyone reviews a preview, by the cloud session or by K, through the guard, never after the merge', () => {
    expect(rules).toHaveLength(1)
    expect(rule).not.toBe('')
    for (const piece of [
      '`npm run db:migrate:preview` is run from the branch, from the cloud session that prepares the checkpoint or by K',
      'runs `scripts/db/preview-guard.ts` first, which stops it unless its target is the preview\'s own database, `lca-db-preview`',
      'Merging to `main` migrates production only', 'nothing migrates `lca-db-preview` automatically',
    ]) expect(rule, piece).toContain(piece)
    expect(rule).not.toMatch(/\b(?:he|his|him)\b/i)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 4: the four lists', () => {
  it('records its two decisions, its deviation and its six verify items, each tagged and each verify item confirmed', () => {
    expect(tagged(decisions).map(head)).toEqual(['D24: the fee rule (WS08 step 4).', 'Raises are read against the stored prices (WS08 step 4).'])
    expect(tagged(deviations).map(head)).toEqual(['An empty club id is read as none with every switch off (WS08 step 4).'])
    expect(tagged(verify).map(head)).toEqual([
      'Where the check sits and what it needs (WS08 step 4).',
      'The names tierFees reads (WS08 step 4).',
      'Echoed answers set nothing, and a missing fee is the event\'s (WS08 step 4).',
      'The tiers and what counts (WS08 step 4).',
      'Seeding the tiers (WS08 step 4).',
      'An event\'s fee is paid only through a section (WS08 step 4).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of entries(list)) expect(entry).toMatch(/^- \*\*[^*]+ \(WS08 step (?:[1-9]|10)\)\.\*\* \S/)
    }
    const [d24, stored] = tagged(decisions)
    for (const piece of ['only D24\'s list may raise a price', '`canChargeFees` in `domain/events/creation.ts`', 'the handler names no role', '"Entry fees need a payout account first. Until then, your event can run at $0."']) {
      expect(d24, piece).toContain(piece)
    }
    for (const piece of ['the manage page sends every section back with its `entryFee`', 'reprice a $0 section at $25', 'so a discount is never a raise']) expect(stored, piece).toContain(piece)
    expect(tagged(deviations)[0]).toContain('(Q34)')
  })

  it('writes its two follow-ups after the six WS08 step 1 carried and before WS08 step 2\'s first, and names the three fee-tier follow-ups', () => {
    const heads = entries(followUps).map(head)
    const at = heads.indexOf(NEW_FOLLOW_UPS[0])
    expect(heads.slice(at, at + NEW_FOLLOW_UPS.length)).toEqual(NEW_FOLLOW_UPS)
    expect(heads[at - 1]).toBe('From WS02: the hand-ons to WS08 (WS08 step 10).')
    expect(heads[at + NEW_FOLLOW_UPS.length]).toBe('K migrates the preview database before checkpoint J\'s preview (WS08 step 2).')
    const tiers = followUp(NEW_FOLLOW_UPS[0])
    for (const piece of [
      '"A section\'s own early price needs one rule"', '"Bare-name section pinned to the event fee"', '"An own early price of $0 under a larger discount"',
      'no section has `fee_early` or `fee_late` until then', 'This step changes nothing in `buildSaveSections`, `priceEntry` or `tierFees`.', 'Owner: the console part',
      'since it shows the ladder as a timeline with weekday dates: whether a save that changes when a tier applies, and not its price, counts as a raise',
      'a late date or an early deadline earlier than the stored one',
    ]) expect(tiers, piece).toContain(piece)
    expect(followUp(NEW_FOLLOW_UPS[1])).toContain('`test/unit/preview-database.test.ts` holds the section\'s words')
  })

  it('ends seven older follow-ups, each with one sentence of its own at its end', () => {
    for (const [name, opens] of ENDED) {
      const entry = followUp(name)
      expect(entry, name).not.toBe('')
      expect(entry.split(opens), name).toHaveLength(2)
    }
    const preview = closing(followUp(ENDED[2][0]), ENDED[2][1])
    for (const piece of ['at about 7:05 PM UTC, before checkpoint J merged', 'which applied 0058 and 0059', 'ordering rule 2 now reads: "']) expect(preview, piece).toContain(piece)
    const job = closing(followUp(ENDED[6][0]), ENDED[6][1])
    for (const piece of ['failed at 7:16 PM on its first step', 'the re-run applied 0059 at 7:21 PM', 'about four minutes']) expect(job, piece).toContain(piece)
    expect(closing(followUp(ENDED[5][0]), ENDED[5][1])).toContain('line 70 of `functions/api/admin/tournaments.ts`')
    expect(closing(followUp(ENDED[3][0]), ENDED[3][1])).toContain('`savedSectionFees`')
    expect(closing(followUp(ENDED[4][0]), ENDED[4][1])).toContain('`73943e1` on Wednesday, November 4, 2026 at 7:15 PM UTC')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 4: plain language', () => {
  /** The same, with what sits in backticks taken out, since code is not prose. */
  const prose = written.map(proseOf)

  it('reads every piece it means to', () => {
    for (const text of written) expect(text).not.toBe('')
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials, unfilled marks and the merge-pending phrase out of what the step wrote', () => {
    for (const text of written) {
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(TOOLS)
      expect(text).not.toMatch(BARE)
      expect(text).not.toMatch(OLD_INITIALS)
      expect(text).not.toMatch(UNFILLED)
      expect(text).not.toMatch(PENDING)
      expect(text).not.toContain('is pending')
      expect(text).not.toMatch(/\(step \d+[;),]/)
      // The CI files are named by their file names alone.
      expect(text).not.toMatch(/\.github\//)
    }
  })

  it('writes each checkpoint in full, and K only as K the person', () => {
    for (const text of written) expect(bareLetters(text), text.slice(0, 60)).toEqual([])
    for (const text of written) expect(text.replace(IN_FULL, 'checkpoint')).not.toMatch(/\bK (?:for|after|opens|merges|carries|holds) /)
  })

  it('gives every date the weekday it falls on, and writes every time on the twelve-hour clock', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const months = MONTHS.join('|')
    const short = MONTHS.map((m) => m.slice(0, 3)).join('|')
    for (const text of prose) {
      for (const found of text.matchAll(new RegExp(`\\b(?:${months}|${short}) \\d{1,2}\\b`, 'g'))) {
        expect(text.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
      }
      for (const [whole, weekday, month, day, year] of text.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${months}) (\\d{1,2})\\b(?:, (\\d{4}))?`, 'g'))) {
        expect(WEEKDAYS[new Date(Date.UTC(Number(year ?? 2026), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
      }
      for (const time of text.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
    }
  })

  it('keeps every file the step adds or changes free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_TESTS, ...MOVED]) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      if (file === 'REDESIGN_STATUS.md') continue
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
  })
})

describe('REDESIGN_STATUS.md, WS08 step 4: the date', () => {
  it('dates the record on a real day, on or after Wednesday, November 4, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-04').toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 4: the figures agree', () => {
  const files = bullet(block, '- **Files.**')

  it('gives unit counts that add up: the base\'s and the new unit files\', one file more for each', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([7360, 269])
    const fresh = NEW_UNIT.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + fresh.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s, the extended file\'s gain and the new files\', one file more for each', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1090, 75])
    const gains = CHANGED_TESTS.map((name) => {
      const m = new RegExp(`\`${escape(name)}\` \\((\\d+), (\\d+) before: `).exec(files)
      return m ? Number(m[1]) - Number(m[2]) : NaN
    })
    for (const n of gains) expect(Number.isNaN(n)).toBe(false)
    const fresh = NEW_INTEGRATION.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + gains.reduce((a, n) => a + n, 0) + fresh.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the count of test/integration/entry-fees.test.ts as the sum of its parts', () => {
    const found = /`test\/integration\/entry-fees\.test\.ts` \((\d+): ([\s\S]*?)\), every case reading/.exec(files)
    expect(found).not.toBeNull()
    const counts = [...found![2].matchAll(/, (\d+)(?=;|$)/g)].map((m) => Number(m[1]))
    expect(counts.length).toBeGreaterThanOrEqual(10)
    expect(counts.reduce((a, n) => a + n, 0)).toBe(Number(found![1]))
  })

  it('gives the browser run as one run whose counts add up, and the lint figures as the base\'s with the new files added', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(809)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_FILES.length)
  })
})
