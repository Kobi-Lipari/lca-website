// test/unit/redesign-status-ws08-step10.test.ts
//
// REDESIGN_STATUS.md records WS08 step 10, the fourth and last step of
// checkpoint L and the last of the first part: D24's two notices on today's
// pages, behind standingDirectors, G1 for someone who may not charge an entry
// fee and G2 under a standing director's fees, and the close of the first
// part in the record, with the hand-ons, K's items and the Checkpoint L
// section. Like the record tests of WS08 steps 1 to 9, this file reads only
// the WS08 section and the date at the start of the date line, never every
// table row or heading of the file, and it reads no count or figure from the
// code: the counts and the bytes the block and the section give are pinned
// here as text. Pinned here: the step's block, after WS08 step 9's and before
// the Checkpoint L section and the four lists, with its parts in order, every
// file it names and figures that agree with each other; the Status line's
// tail while this step is the latest and checkpoint L waits for its merge;
// the PR line's parts for checkpoints J and K word for word and its part for
// checkpoint L; the four sentences this step adds to the map, each held by
// its order, so the sentences later steps add may stand beside them, and
// every other map item holding a sentence of a step but the two that keep
// WS08 step 1's words; the Checkpoint L section in the form the Checkpoint K
// section has, its figures agreeing with the block's; this step's entries in
// the decisions, the deviations and the verify items, each together and in
// its place, and the sentence that ends each of the three follow-ups tagged
// with this step; every record line the step names by its head words, which
// must stand in the record under those words; the plain-language rules over
// everything the step wrote; and the date.
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
/**
 * What a draft would hold before its figures were filled in: the marks of the earlier records' drafts and their capitalised names, and
 * the three names this step's draft held for its own figures.
 */
const UNFILLED = new RegExp(
  `${String.fromCharCode(0x27ea)}|${String.fromCharCode(0xa7)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}` +
    `|\\b(${['LI' + 'NT', 'BUI' + 'LD', 'BROW' + 'SER', 'CHE' + 'CKS', 'GR' + 'EP', 'RECORD' + 'TESTS', 'UNIT' + '_AFTER', 'RECORD' + '_TEST'].join('|')})\\b` +
    `|${'STEP' + 'TEN'}|${'CHECKPOINT' + 'CHECKS'}|${'CHECKPOINT' + 'RENAMED'}`,
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
const TAG = '(WS08 step 10).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
/** The step each entry is tagged with, in the list's order. */
const stepsOf = (text: string) => entries(text).map((l) => Number(/\(WS08 step (\d+)\)\.$/.exec(head(l))?.[1]))

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
const BEFORE = [
  '### WS08 step 1: the record and the creation rules',
  '### WS08 step 2: migration 0059, the ticket kinds and the review mark',
  '### WS08 step 3: the create through the creation rules and the first director',
  '### Checkpoint J: WS08 steps 1 to 3',
  '### WS08 step 4: the entry fee rule on a save',
  '### WS08 step 5: the president names a one-event director, and a creator deletes a draft',
  '### WS08 step 6: the notice to the LCA admins at a standing director\'s first publish',
  '### Checkpoint K: WS08 steps 4 to 6',
  '### WS08 step 7: what a person may create, and the payout request',
  '### WS08 step 8: New tournament on today\'s pages, the standing director\'s label and the two calls behind them',
  '### WS08 step 9: the manage page for the event\'s creator, and the wizard\'s refresh before it opens',
]
const STEP = '### WS08 step 10: the two fee notices on today\'s pages, and the close of the first part'
const CHECKPOINT = '### Checkpoint L: WS08 steps 7 to 10'
const LISTS = ['### WS08 decisions', '### WS08 deviations from the brief', '### WS08 verify items resolved', '### WS08 follow-ups']
const map = part(MAP)
const block = part(STEP)
const checkpoint = part(CHECKPOINT)
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
/** The follow-ups, the section's last part, to its end. */
const followUps = ws08.includes(`\n${LISTS[3]}\n`) ? ws08.slice(ws08.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const statusLine = sectionLines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = sectionLines.find((l) => l.startsWith('**PR:**')) ?? ''
/** The date at the start of the date line, the one piece of that line this step writes. */
const date = /^Last updated: (\d{4})-(\d{2})-(\d{2}) \(/.exec(status.split('\n').find((l) => l.startsWith('Last updated:')) ?? '')
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItems = entries(map)
const mapItem = (id: string) => mapItems.find((l) => l.startsWith(`- **${id}.**`)) ?? ''
/** The Checkpoint L section's opening paragraph, the line after its heading and a blank line. */
const opening = checkpoint.split('\n')[2] ?? ''

/** The Status line up to and including its last fixed words, which WS08 step 1 set and every step keeps. */
const STATUS_PREFIX = '**Status:** in progress: the first part, tournament creation, ten steps in three checkpoints (checkpoint J for steps 1 to 3, checkpoint K for 4 to 6, checkpoint L for 7 to 10); '
/** The tail this step writes, while checkpoint L waits for its merge. */
const TAIL = 'steps 1 to 10 are built: the first part is built; the console part and the admin home part come later.'
/** The highest step with a block of its own in the section: a later step owns the Status line's tail. */
const latestStep = Math.max(0, ...[...ws08.matchAll(/^### WS08 step (\d+): /gm)].map((m) => Number(m[1])))
/** The PR line's parts for checkpoints J and K, which WS08 steps 4 and 7 wrote and this step keeps word for word. */
const J_PART = '**PR:** checkpoint J (steps 1 to 3) was draft pull request 123, merged into `main` as `73943e1` on Wednesday, November 4, 2026; '
const K_PART = 'checkpoint K (steps 4 to 6) was draft pull request 124, merged into `main` as `9d3b13b` on Thursday, November 5, 2026; '
/** The PR line's part for checkpoint L, as this step writes it before the pull request is open. */
const L_PART = 'checkpoint L (steps 7 to 10) is a draft pull request to be opened from this branch now that WS08 step 10 is built, its number written here once it is open; each merged on its own.'
/** What this step added to an older line: from `from` to the end of the line. */
const closing = (line: string, from: string) => (line.includes(from) ? line.slice(line.indexOf(from)) : '')

/** The opening of the sentence AC15 and Q3 gain. */
const PROVED = 'Proved in WS08 step 10 by `test/unit/fee-notice.test.tsx`, `test/unit/manage-page-fee-notice.test.tsx` and `test/unit/wizard-fee-notice.test.tsx`: '
const PRICES_ITEM = 'WS01\'s three follow-ups on section prices'
const WS02_ITEM = 'WS02\'s hand-ons to WS08'
const PRICES_HANDED = 'Handed on in WS08 step 10 to the console part: "To the console part (WS08 step 10)".'
const WS02_HANDED =
  'Handed on in WS08 step 10 to the Phase 4 part, the admin home part and the console part: "To Phase 4 (WS08 step 10)", "To the admin home part (WS08 step 10)" and "To the console part (WS08 step 10)".'
/**
 * Each sentence with its item, the words of the sentence it follows and the words it stands in front of. Only the order is held, so a
 * later step's sentence may stand between either and its neighbours.
 */
const MAP_SENTENCES: ReadonlyArray<readonly [string, string, string, string]> = [
  ['AC15', PROVED, 'Built in WS08 step 7: ', 'Planned: WS08 step 10.'],
  [PRICES_ITEM, PRICES_HANDED, 'Read in WS08 step 4: ', 'Planned: WS08 step 4.'],
  [WS02_ITEM, WS02_HANDED, 'handed on to the Phase 4 part, the admin home part and the console part.', 'Planned: WS08 step 10.'],
  ['Q3', PROVED, 'and G2 says so.', 'Planned: WS08 step 10.'],
]
/** The two map items the plan names as hand-ons that keep WS08 step 1's words, with those words, for WS08 step 1's closed claims test. */
const KEPT: ReadonlyArray<readonly [string, string]> = [
  ['WS01\'s follow-up on schedules, and the wizard\'s move', ': handed on to the console part. Planned: WS08 step 10.'],
  ['WS02\'s follow-up on the Admin row', '; handed on to that part. Planned: WS08 step 10.'],
]
/** A sentence of a step in a map item. */
const STEP_SENTENCE = /\b(?:Proved|Built|Read|Handed on) in WS08 step \d+\b/

/** The files this step adds: the component, its five tests, each page's followed by the file of its edges, and this record's test. */
const NEW_CODE = 'src/areas/admin/components/FeeNotice.tsx'
const NEW_TESTS = [
  'test/unit/fee-notice.test.tsx', 'test/unit/manage-page-fee-notice.test.tsx', 'test/unit/manage-page-fee-notice-edges.test.tsx',
  'test/unit/wizard-fee-notice.test.tsx', 'test/unit/wizard-fee-notice-edges.test.tsx', 'test/unit/redesign-status-ws08-step10.test.ts',
]
/** The files of code and record this step changes. */
const CHANGED = ['src/pages/TournamentManagePage.tsx', 'src/areas/admin/components/TournamentWizard.tsx', 'REDESIGN_STATUS.md']
/** The test whose pin this step moves, named among the changed files with its count, which does not move. */
const MOVED = ['test/unit/base-components-scope.test.ts', 9] as const
const DECISION = 'The notices live in the admin area for now (WS08 step 10).'
const DEVIATIONS = ['G1 for a price typed above the one the page loaded (WS08 step 10).', 'Keep it at $0 puts back the prices the page loaded (WS08 step 10).']
const VERIFIED = [
  'The anchors on the base (WS08 step 10).',
  'The page\'s loaded prices (WS08 step 10).',
  'The error strip and the refusal\'s words (WS08 step 10).',
  'The info tint, the ink and the icon (WS08 step 10).',
  'Who can see G1 in Phase 1 (WS08 step 10).',
  'The gold button\'s pins (WS08 step 10).',
  'The wizard\'s dash and its requests (WS08 step 10).',
  'The follow-ups list and the three other lists (WS08 step 10).',
]
/** The three follow-ups WS08 step 1 carried and tagged with this step: each as WS08 step 1 wrote it, then the one sentence this step adds. */
const CARRIED: ReadonlyArray<readonly [string, string]> = [
  [
    '- **From WS01: schedules and the wizard\'s move (WS08 step 10).** "Schedules in WS06 and WS08", and the line of "Imports across areas" that moves the wizard with event setup: WS08 step 10 hands both on to the console part.',
    'Handed on in WS08 step 10 to the console part: "To the console part (WS08 step 10)", among the judgement calls of WS08 step 10.',
  ],
  [
    '- **From WS02: the Admin row without a count (WS08 step 10).** "The Admin row without a count (WS02 step 17)": the count comes from Needs attention, which the admin home part builds; WS08 step 10 hands it on to that part.',
    'Handed on in WS08 step 10 to the admin home part: "To the admin home part (WS08 step 10)", among the judgement calls of WS08 step 10.',
  ],
  [
    '- **From WS02: the hand-ons to WS08 (WS08 step 10).** `listedWhere`\'s rule for member-created events, with Q18\'s case (WS02\'s map item D26 and its follow-up on the seven inline uses of the listing rule), the Admin row\'s count, and the console\'s check-in step, which WS01\'s follow-up on the check-in toggle gives to WS08: WS08 step 10 hands them on to the Phase 4 part, the admin home part and the console part.',
    WS02_HANDED.replace(/\.$/, ', among the judgement calls of WS08 step 10.'),
  ],
]
/** The judgement calls whose head words are in bold: the four hand-ons and K's items. */
const BOLD_CALLS = [
  'To the console part (WS08 step 10).', 'To the admin home part (WS08 step 10).', 'To Phase 4 (WS08 step 10).', 'To WS09 (WS08 step 10).',
  'K\'s items before standingDirectors goes on (WS08 step 10).',
]
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
/** What this step added to a map item: from its sentence to the words after it. */
const sentenceIn = (item: string, from: string, to: string) => {
  const at = item.indexOf(from)
  if (at < 0) return ''
  const end = item.indexOf(to, at)
  return item.slice(at, end < 0 ? undefined : end).trim()
}
/** The name of a chunk before its hash, and its size, as the Build bullet and the section list the files that take new names. */
const sized = (text: string) => new Map([...text.matchAll(/`([A-Za-z]+)` \(([\d,]+)\)/g)].map((m) => [m[1], num(m[2])] as const))

/** Everything this step wrote, each piece on its own. */
const written = [
  block, checkpoint, ...tagged(decisions), ...tagged(deviations), ...tagged(verify),
  ...tagged(followUps).map((entry) => closing(entry, 'Handed on in WS08 step 10')),
  statusLine.slice(STATUS_PREFIX.length), closing(prLine, 'checkpoint L (steps 7 to 10)'),
  ...MAP_SENTENCES.map(([id, sentence, , before]) => sentenceIn(mapItem(id), sentence, before)), date?.[0] ?? '',
]

describe('REDESIGN_STATUS.md, WS08 step 10: the step block', () => {
  it('sits after WS08 step 9\'s block and before the Checkpoint L section and the four lists, once, under a heading in the record\'s form', () => {
    const at = [MAP, ...BEFORE, STEP, CHECKPOINT, ...LISTS].map((h) => ws08.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws08.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(ws08.split(`\n${CHECKPOINT}\n`)).toHaveLength(2)
    expect(STEP).toMatch(/^### WS08 step 10: \S/)
    expect(sectionLines.filter((l) => /^### Step\b/.test(l))).toEqual([])
    expect(sectionLines.filter((l) => l.startsWith('|'))).toEqual([])
  })

  it('opens by naming the step, its checkpoint and the part it closes, and says what a visitor sees, by switch', () => {
    const first = block.split('\n')[2] ?? ''
    expect(first.startsWith('WS08 step 10 is the fourth and last step of checkpoint L, and the last of the first part.')).toBe(true)
    for (const piece of [
      'It draws D24\'s two notices on today\'s pages, behind `standingDirectors`',
      'G1, the panel that tells someone who may not charge an entry fee that fees need a payout account first',
      'under the manage page\'s sections table and under its Registration tab\'s prices once a typed price is above the price the page loaded',
      'with Keep it at $0, the ask for a payout account and both Save buttons held while it shows',
      'the server\'s refusal of a raised fee drawn as the same panel and never in red',
      'G2, the note under a standing director\'s fees, on the manage page and on the wizard\'s sections step',
      'the hand-ons to the console part, the admin home part, the Phase 4 part and WS09, K\'s items before the switch goes on',
      'every map item proved, built in part or handed on', 'the Checkpoint L section below, with the text of its pull request',
      'With every switch off the manage page and the wizard are today\'s and neither asks anything new, so what a visitor sees, by switch, is nothing new',
      'with `standingDirectors` on, and `CREATION_ROLES_ON` set with it, the two notices show as this block says.',
    ]) expect(first, piece).toContain(piece)
  })

  it('has every part, in order, each once', () => {
    const parts = [
      '- **Files.**', '- **G1.**', '- **G2.**', '- **The hand-ons.**', '- **K\'s items.**', '- **What ships with every switch off.**',
      '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const p of parts) expect(block.split('\n').filter((l) => l.startsWith(p)), p).toHaveLength(1)
  })

  it('names every file it adds and changes, the new ones as new, each test with its count, and no other file', () => {
    const files = bullet(block, '- **Files.**')
    const fresh = files.slice(files.indexOf('New: '), files.indexOf(' Changed: '))
    expect(fresh.startsWith(`New: \`${NEW_CODE}\` (`)).toBe(true)
    for (const name of NEW_TESTS) expect(fresh, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    const changed = files.slice(files.indexOf(' Changed: '))
    for (const name of CHANGED) expect(changed, name).toContain(`\`${name}\` (`)
    expect(changed).toContain(`\`${MOVED[0]}\` (${MOVED[1]}, as before: Pins moved, below)`)
    // Every file the bullet names in its New and Changed lists, and no other.
    const named = [...files.slice(0, files.indexOf(' No other file')).matchAll(/`((?:src|test)\/[^`]+|REDESIGN_STATUS\.md)` \(/g)].map((m) => m[1])
    expect(named).toEqual([NEW_CODE, ...NEW_TESTS, CHANGED[0], CHANGED[1], MOVED[0], CHANGED[2]])
    for (const piece of [
      'the sentences of AC15, Q3 and two other map items, this block and its entries, the Checkpoint L section, and one sentence at the end of each of the three follow-ups tagged with this step',
      'No other file is added or changed: nothing under `functions/`, `domain/`, `migrations/`, `workers/`, `scripts/` or `scanner/`, `functions/utils/stripe.ts` among them',
      'nor `src/lib/features.ts`, `src/lib/brand.ts`, `src/components/ui/button.tsx`, `src/areas/membership/api.ts`, `test/a11y/baseline.json`, `package.json` or the lock file',
      'and no other test that existed before this step changes.',
      'and `FeeNoticeStatus`, the polite status line, visually hidden, that holds G1\'s title while the panel shows',
    ]) expect(files, piece).toContain(piece)
  })

  it('gives G1 in K\'s words, as information, where it shows and for whom, what Keep it at $0 and the ask do, the refusal drawn as the panel, and the wizard\'s', () => {
    const g1 = bullet(block, '- **G1.**')
    for (const piece of [
      '`FeeNotice` with `kind="needs-account"` draws a note, `role="note"` named by its title through `aria-labelledby`, on the info tint with the navy ink',
      '`rounded-lg border border-info-200 bg-info-50 px-4 py-3 text-sm text-ink`', 'with lucide-react\'s `Info` beside it, hidden from screen readers, and no red',
      'the title "Entry fees need a payout account first" as a heading, `h3`',
      'the body "LCA takes entry fees through its own Stripe account. Before your event can charge a fee, LCA sets up an account for you inside LCA\'s Stripe account, called a connected account (Stripe Connect). It keeps your event\'s money apart from LCA\'s and pays it out to you. Until then, your event can run at $0."',
      'the two buttons, "Keep it at $0", an outline button, and "Ask LCA to set up my payout account", the Button\'s gold variant, `variant="gold"`',
      'the line "Who can charge fees for now: LCA admins, club reps, the president and standing directors.", K\'s words as brief 1.4 gives them, word for word',
      'the page asks `getTournamentCreation()` once as it opens, beside `getMe`, and a failed answer draws nothing',
      'G1 shows when the answer\'s `canChargeFees` is false and a typed price is above the price the page loaded, at any tier of any section',
      '`feesRaised` (`domain/events/creation.ts`) compares a list over the loaded snapshot with one over the edited state',
      'or for a section added on the page by the id of a loaded section of the same name, as the server\'s save matches it',
      '`tierFees` (`domain/events/sections.ts`) over `{ feeRegular: entryFee, feeEarly: null, feeLate: null }` and the event\'s side, `{ entry_fee, early_deadline, early_discount, late_after, late_fee }`',
      'read from the Registration tab\'s boxes as the save sends them, a blank box $0 and a number below $0 read as $0',
      'so the comparison is exact while no section has an own tier price, which the console part\'s Fees step is the first to set',
      'So an event the president priced at $25 shows no panel as it opens and shows it once 30 is typed',
      'a new section at $15, a late fee raised with its date set, a discount lowered, an early deadline cleared, or "Late fee starts" set on an event storing a late fee with no date',
      'while a late fee with no date, which does not apply, shows only today\'s warning',
      'It is drawn under the sections table on the Details tab and under the two warnings below the prices on the Registration tab, and while it shows Save details and Save registration settings are disabled',
      'never meets the red strip',
      'Keep it at $0 puts back every price the comparison reads, each section\'s entry fee and the whole of the Registration tab\'s prices, both dates included, so the event goes back to $25 and a free one to $0',
      'a section added on the page goes to $0, and the rest of the form stays as typed',
      'Keep it at $0 takes the panel away with the button pressed in it, so the focus is moved, once the page has drawn the prices put back, to the box whose price it put back',
      'for a press from the keyboard, and never left to fall to the page', 'a tap or a mouse press, a click whose `detail` is not 0, moves no focus',
      'Once the ask has gone, the focus moves to Keep it at $0, since the ask\'s button then reads as asked and stays disabled',
      'on the Details tab the fee box of the first section whose fee changes, or the first section\'s, and on the Registration tab the early-entry discount box when its amount or its end changes and the late fee box otherwise',
      'the wizard\'s Keep it at $0 does the same, moving it to the fee box of the first section whose fee was above $0.',
      'The ask calls `requestPayoutAccount(id)`, `POST /api/me/payout-request` with the event\'s id, which opens one `payout_request` ticket in Admin\'s support list, one per member, as WS08 step 7 built it',
      'the press held by a ref as well as by state, so two presses before the first render ask once, and then reads "Asked. LCA has your request." and stays disabled',
      'As the panel shows, a screen reader hears its title: `FeeNoticeStatus` draws a polite status line, `role="status"`, visually hidden, which holds "Entry fees need a payout account first" while the panel shows and nothing otherwise',
      'whether the panel comes as a price is typed or as a refused save is drawn (WCAG 2.2, 4.1.3, status messages)',
      'the manage page draws the line once, with the switch on, first in the section that holds the tabs, and the wizard first in its sections step\'s column, so no other child\'s spacing moves, and the panel keeps role note',
      'a failed ask is drawn in the page\'s error line, as its other failed actions are, and leaves the button free',
      'If a save is refused all the same with the payout words, `FEES_NEED_PAYOUT_ACCOUNT`, from a page loaded before the rule changed, both saves\' catches draw the panel in place of the red strip, which stays empty',
      'and hold the save until Keep it at $0, a discard or the next save; any other error is drawn in today\'s strip',
      'In the wizard, G1 is wired for WS09\'s regional representatives, the first creators not on D24\'s list',
      'since the wizard loads no prices, and its Keep it at $0 puts every section at $0; every grant that may create may charge today, so it shows to nobody.',
    ]) expect(g1, piece).toContain(piece)
  })

  it('gives G2 in K\'s words, where it shows, and that no checkout sends money anywhere but LCA\'s account', () => {
    const g2 = bullet(block, '- **G2.**')
    for (const piece of [
      '`FeeNotice` with `kind="accepted"` draws the same tint with one paragraph, K\'s words word for word',
      '"You can charge an entry fee. Fees are paid into LCA\'s Stripe account. To have them paid straight to you, LCA sets up a connected account for you inside its Stripe account (Stripe Connect), so your event\'s money stays apart from LCA\'s. Until then, your fees wait in LCA\'s account and are paid out to you after the event."',
      'With the switch on it shows when the creation answer\'s grant is `standing_director`, once, under the manage page\'s sections table and under the wizard\'s fee table, each while there is a section, and never on the Registration tab',
      'a standing director\'s raise shows no G1 and holds no save, since the answer\'s `canChargeFees` is true',
      'on the manage page only on an event the standing director created, its `created_by` the signed-in member\'s id, since on an event an LCA admin, the president or a club rep created and named them on, the fees are not paid out to them',
      'and never beside G1, which a save refused all the same can draw for them, so the two never show together',
      'no file under `functions/`, `src/`, `domain/` or `workers/` names a Stripe Connect routing parameter, as `test/unit/fee-notice.test.tsx` holds, and `functions/utils/stripe.ts` is untouched (Q3).',
    ]) expect(g2, piece).toContain(piece)
  })

  it('gives the hand-ons, as bold judgement calls, the map items and follow-ups they end, and K\'s items with where the questions for K are', () => {
    const handOns = bullet(block, '- **The hand-ons.**')
    for (const piece of [
      'each written among the judgement calls below with its head words in bold, since every place in the list of follow-ups moves a pin of a closed record test',
      'as the verify item "The follow-ups list and the three other lists (WS08 step 10)" sets out',
      '"To the console part (WS08 step 10)", "To the admin home part (WS08 step 10)", "To Phase 4 (WS08 step 10)" and "To WS09 (WS08 step 10)"',
      'Each names the record line it comes from, so nothing is lost when those parts are planned',
      'WS01\'s three follow-ups on section prices and WS02\'s hand-ons to WS08 each gain a sentence "Handed on in WS08 step 10 to the ... part" naming the judgement call',
      'WS01\'s follow-up on schedules and the wizard\'s move and WS02\'s follow-up on the Admin row keep the words WS08 step 1 gave them, which already say each is handed on',
      'the three follow-ups tagged with this step, which WS08 step 1 carried from WS01 and WS02, among them the two those items name, each end with a sentence "Handed on in WS08 step 10 to the ... part".',
    ]) expect(handOns, piece).toContain(piece)
    const items = bullet(block, '- **K\'s items.**')
    for (const piece of [
      'What K does before `standingDirectors` goes on is one judgement call below, "K\'s items before standingDirectors goes on (WS08 step 10)"',
      'K\'s two read-only production reads, the look at the pages on a throwaway preview, and the one change that turns the switch and the constant on together',
      'The decisions K is asked for before checkpoint L merges are in the Checkpoint L section\'s Before merging bullet, each with the record line it comes from.',
    ]) expect(items, piece).toContain(piece)
  })

  it('says nothing a visitor sees ships with every switch off, and names the one pin it moves with its old and new expectations', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Nothing a visitor sees or hears.')).toBe(true)
    for (const piece of [
      'The manage page reads `standingDirectors` through `FEATURES` before it asks for the creation answer, as it draws G1 and G2 and in the saves\' catches',
      'so with it off the page asks nothing new, draws neither notice, holds no save and draws every error, the payout words among them, in today\'s strip',
      'the wizard asks nothing as its sections step opens and draws no note',
      'in today\'s strip, and draws no status line', 'draws no note and no status line',
      '`test/unit/manage-page-fee-notice.test.tsx` and `test/unit/wizard-fee-notice.test.tsx` hold both through a stub of `fetch`',
      'The Registration tab\'s save reads each dollar box with the reader it had, moved, so what each save sends is today\'s',
      'draw nothing and act only once Keep it at $0 is pressed, which needs the panel, so with the switch off the focus moves as today',
      'the chunk those two shared, `SectionRulesEditor`, now holds `FeeNotice` as well and takes its name',
      'the event page\'s `tierFees` moves into a small chunk of its own, `sections`, which the manage page shares',
      'the stylesheet and the switches chunk are the same, name for name and byte for byte', '`test/a11y/baseline.json` is unchanged',
      'neither of which turns `standingDirectors` on', 'No server file changes', 'the paths `deploy-worker.yml` watches, changes.',
    ]) expect(ships, piece).toContain(piece)
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins.startsWith('- **Pins moved.** One, a pin on the tree\'s live code and none on words a record wrote: `test/unit/base-components-scope.test.ts`, WS01 step 26\'s closed list of the files that draw the Button\'s gold variant')).toBe(true)
    for (const piece of [
      'which its header asks a later workstream to change in the same change so that each new place is a decision someone made',
      'held that the fixture page, the new header, the Menu sheet and the new footer draw it, and now holds `src/areas/admin/components/FeeNotice.tsx` among them, for G1\'s ask',
      `(${MOVED[1]} cases, as before)`, 'No record test of a closed step changes, and no other test\'s exact list, count, line number or fixture moves.',
      'its import of `SectionRulesEditor` from another area, moves from line 26 to line 29 with the three lines its import of the client gains',
      '`test/unit/area-boundaries.test.ts` holds it by file and import', 'WS01\'s follow-up "Imports across areas" still names line 26, as WS01 wrote it',
    ]) expect(pins, piece).toContain(piece)
  })

  it('gives its judgement calls, the four hand-ons and K\'s items among them in bold, each once', () => {
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(20)
    for (const name of BOLD_CALLS) expect(calls.split('\n').filter((l) => l.startsWith(`  - **${name}** `)), name).toHaveLength(1)
    // Every other judgement call is plain, so the five in bold are the step's hand-ons and K's items alone.
    expect(calls.split('\n').filter((l) => l.startsWith('  - **')).map((l) => l.slice(6, l.indexOf('**', 6)))).toEqual(BOLD_CALLS)
    for (const piece of [
      'The creation answer is read once as the manage page opens, beside `getMe`, and in the wizard as its sections step first opens, never as the wizard opens',
      'so a read as the wizard opens would have broken four of its closed cases',
      'as `savedSectionFees` in `functions/utils/events/sectionsRepo.ts` matches a section sent without an id, so a section removed and added again reads at its loaded price',
      'a section brought back from the archive, whose prices the page never loaded, reads as new',
      'Keep it at $0 puts back prices alone', 'Discard changes stays free for putting every edit back',
      'The focus after Keep it at $0 goes to the box whose price was put back, the first in the page\'s order where several were',
      'It moves only for a press from the keyboard, read as a click whose `detail` is 0',
      'It moves in a layout effect once the prices are drawn, as `src/components/layout/navMenu.ts` moves the focus once its panel is drawn',
      'The server\'s refusal is told apart by its message, equal to `FEES_NEED_PAYOUT_ACCOUNT`, in both saves, since a raise can come from either tab, and only with the switch on',
      'A page whose loaded prices are stale, one an LCA admin repriced after it opened, can be refused again after Keep it at $0 until it is loaded again.',
      'A failed ask is drawn in the page\'s error line, the red strip, as the manage page draws its other failed actions',
      'The one refusal a page can meet is "Not available yet.", answered while `CREATION_ROLES_ON` is unset, which `test/unit/creation-switch.test.ts` keeps from happening with the switch on.',
      'The press is held by a ref as well as by state', 'so a double tap asks once in a browser as in jsdom',
      'The panel\'s title is an `h3`, under the Details card\'s `h2`, and names the note through `aria-labelledby`; the buttons\' row is a polite live region',
      'The ask is the Button\'s gold variant, as the plan has it, so `FeeNotice` joins the closed list of the files that draw that variant in `test/unit/base-components-scope.test.ts`, the one pin this step moves',
      'The wizard\'s Keep it at $0 sets every section\'s fee to $0 in one update',
      'G2 shows only beside a fee table, while there is a section, and once, under the manage page\'s sections table',
      'On the manage page G2 shows only on an event the standing director created, the plan\'s condition narrowed',
      'on an event an LCA admin, the president or a club rep created and named them on, where the fees are LCA\'s or the club\'s, the note would say what is not so',
      'G2 also gives way to G1 when a save is refused all the same, for a grant lost since the page opened, so the two never show together and contradict each other',
      'The panel is announced through a status line of its own, `FeeNoticeStatus`, which holds only its title, rather than through a live region around the panel',
      'a live region is read out only when what it holds changes, so the line is drawn from before the panel can show and the panel keeps role note',
      'drawn as the first child of its container it changes no other child\'s spacing',
      'it is drawn only with the switch on, so with it off the markup is today\'s.',
      'A build setting that kept the old chunks would reach every page\'s files, so the step leaves the bundler\'s choice as it is',
      '`amountOf`, the Registration tab\'s save\'s own reader of a dollar box, a blank box $0 and a number below $0 read as $0, is moved to the file\'s top unchanged',
      'The decision "The notices live in the admin area for now (WS08 step 10)" stands before WS08 step 7\'s entries in the decisions',
      'this step\'s two deviations and eight verify items after WS08 step 9\'s and before WS08 step 7\'s',
      `The Status line's tail is "${TAIL}"`, 'every closed record test lets a later step write the tail so long as it says "built" and ends with a full stop',
      'The PR line keeps checkpoint J\'s and checkpoint K\'s parts word for word, as WS08 steps 6 and 7\'s closed tests hold them',
      'WS08 step 1\'s claims test, `test/unit/redesign-status-ws08-step1-claims.test.ts` (line 87), holds that more than four map items still end with the words WS08 step 1 wrote',
      'The pin holds closed history, so it stays as it is',
      'So every map item but those two holds a sentence of the step that proved it, built a part of it or handed it on, and those two say in WS08 step 1\'s words that they are handed on.',
      'The wizard\'s draft note keeps its em dash, now at line 554',
      'The questions for K are not answered here: WS08 step 8\'s four and WS08 step 9\'s two, and the open questions of WS08 steps 3, 4 and 6, are collected in the Checkpoint L section\'s Before merging bullet',
    ]) expect(calls, piece).toContain(piece)
  })

  it('gives the four hand-ons, each with what its part takes and the record lines it comes from, and K\'s items in their order', () => {
    const call = (name: string) => bullet(block, `  - **${name}**`)
    const [consolePart, adminHome, phase4, ws09, kItems] = BOLD_CALLS.map(call)
    for (const piece of [
      'The console part, which builds the setup checklist in the workspace area, takes: `FeeNotice`, into the workspace area with the checklist, whose Fees step draws its own G1 and G2 in place of the manage page\'s and the wizard\'s',
      'the wizard, which the checklist replaces, with its draft note\'s em dash and the move that WS01\'s follow-up "Imports across areas" gives it',
      'WS01\'s three follow-ups on section prices and the question whether a save that changes when a tier applies is a raise, "The fee tiers\' follow-ups wait for the Fees step (WS08 step 4)"',
      'WS01\'s follow-up "Schedules in WS06 and WS08"', 'the console\'s check-in step, which WS01\'s follow-up on the check-in toggle gives WS08',
      'the pages joining `test/a11y/scopes.spec.ts`, as WS08 step 9 handed them on from WS02 step 2\'s follow-up on signed-in pages',
      'the contracts for `DELETE /api/admin/tournaments/[id]` and the three methods of the directors endpoint, unless K takes them now, as "Contracts for DELETE and the directors endpoints wait for the console part (WS08 step 5)" has it',
      '`publish_at` and the scheduled publish, as "The scheduled publish waits for the console part (WS08 step 6)" has it',
      '`test/unit/published-review-closure.test.ts`, whose list that run\'s import of `sendPublishedReviewNotice` makes false, rewritten with it',
      '`recordRun` on that run once WS09 builds `automation_runs`', 'D23\'s rating report stage on every event, reading `lcaAffiliateAllowed`, "D23 noted (WS08 step 1)"',
      '"An officer president in the console part (WS08 step 1)" and "A guest\'s assignment lists a hidden draft (WS08 step 2)"',
    ]) expect(consolePart, piece).toContain(piece)
    for (const piece of [
      'The admin home part, which builds the admin home, Needs attention and `ADMIN_HOME_ON`, takes: the `published_review` row in place of the email while `ADMIN_HOME_ON` is set, with Done and its audit entry',
      'AC13\'s row half and the deviation "The notice is email only (WS08 step 6)"',
      'the `payout_request` ticket and the other ticket kinds as rows in Needs attention, the payout request being in Admin\'s support list until then',
      'Roles & access, where the standing director\'s one line takes its place in the role list, WS08 step 8\'s fourth question',
      'the My LCA menu\'s Admin row\'s count from Needs attention, WS02\'s follow-up "The Admin row without a count (WS02 step 17)"',
    ]) expect(adminHome, piece).toContain(piece)
    for (const piece of [
      'The Phase 4 part, member-created events, takes: the member organizer\'s grant, its first director row and its two fields in the grant answer, "The grant answer leaves the member organizer\'s two fields to Phase 4 (WS08 step 7)"',
      '`lcaAffiliateAllowed`\'s false case, a member-created event\'s report carrying only its organizer\'s own IDs',
      '`listedWhere`\'s rule for member-created events, never listed, with Q18\'s case, from WS02\'s map items D26 and Q18',
      'WS02\'s follow-up on the seven inline uses of the listing rule',
      '`canChargeFees`\'s member-event case, every fee $0 whoever saves, an LCA admin included, until the event has a connected account, AC15\'s member-event half',
    ]) expect(phase4, piece).toContain(piece)
    for (const piece of [
      'WS09, with its regional representatives, takes: their grant in `creationGrant` and `canCreate` for a club in their region, with `CLUB_PAGES_ON`',
      'G1 for them, the first creators not on D24\'s list, in the wizard, where it is wired, with the wizard\'s buttons held while it shows and the create\'s refusal drawn as the panel',
      '"No creator is refused a fee on create in Phase 1 (WS08 step 3)"', 'the approval before a representative\'s club event lists (Q15)',
    ]) expect(ws09, piece).toContain(piece)
    const steps = [
      'After checkpoint L has merged, and before `standingDirectors` goes on: K\'s two read-only reads of production, one statement each and never a write, reporting names and never emails, as "K\'s two production reads before standingDirectors goes on (WS08 step 1)" gives them',
      'first the members who hold `tournament_director` today, K taking the role from any who should not create',
      'and second the President seat\'s active assignment, whose holder\'s role must be `lca_observer` or `lca_officer`',
      'so K sets the role to `lca_observer` first', 'then K\'s look at the pages on a throwaway preview, as the Checkpoint L section\'s preview bullet lists it',
      'and then one change that turns `standingDirectors` on in `src/lib/features.ts` together with `CREATION_ROLES_ON` in `functions/utils/events/creation.ts` and takes `standingDirectors` out of the WS08 list in `test/unit/features.test.ts`',
      'since `test/unit/creation-switch.test.ts` and `test/unit/features.test.ts` fail anything else',
      'The defaults of Q2, Q3, Q4 and Q37 stand until K says otherwise, as "K\'s questions for WS08, with their defaults (WS08 step 1)" sets them.',
    ]
    const at = steps.map((piece) => kItems.indexOf(piece))
    for (const [i, piece] of steps.entries()) expect(at[i], piece).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('gives the lint as unchanged, the build file by file against the base, and each figure of the checks once', () => {
    const lint = bullet(block, '- **Lint.**')
    for (const piece of [
      '13 errors and 13 warnings, unchanged: the same findings in the same files as on the base `5448de2`, no error in a file this step touches',
      'the import of `SectionRulesEditor` from another area in `src/areas/admin/components/TournamentWizard.tsx`, now at line 29, which `test/unit/area-boundaries.test.ts` lists among the known ones',
    ]) expect(lint, piece).toContain(piece)
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'Every switch off, on the base `5448de2` and on the finished tree, compared file by file',
      'the main script `index-uLjVexnt.js` 550,171 bytes, the stylesheet `index-Dxhkeo-q.css` 130,292 bytes and the switches chunk `features--b6t5tBm.js` 685 bytes on the base',
      'after, the main script `index-CMYi2if3.js` at 550,347 bytes, 176 more, with `requestPayoutAccount`, which the build left out while no page called it',
      'and the stylesheet and the switches chunk the same, name for name and byte for byte',
      '`dist` holds 228 files, 190 of them in `dist/assets`, where the base holds 227 and 189', 'Five other chunks change size',
      '`TournamentManagePage-C2qXRiSE.js`, 85,595 bytes, is `TournamentManagePage-Bj9OYTq1.js` at 88,178, with G1, G2, the comparison, the focus after Keep it at $0 and the status line',
      '`TournamentList-CopWruIB.js`, 41,774 bytes, is `TournamentList-D96TRGlf.js` at 42,907, with its read, its notes, the focus after Keep it at $0 and the status line',
      '`TournamentDetailPage-CHdnoTEd.js`, 37,648 bytes, is `TournamentDetailPage-NCnW-mEA.js` at 37,424, 224 bytes less, since `tierFees` moved out of it',
      '`AdminPage-CPPPWw2l.js` 92,029 to `AdminPage-DbYX0QSG.js` 92,035', '`DashboardPage-DFJcgt27.js` 28,625 to `DashboardPage-CIlG9jqr.js` 28,621',
      'One chunk goes, `SectionRulesEditor-B-rSIBXU.js` at 3,260 bytes, whose code is now in `FeeNotice-BJPf5_PW.js` at 5,773 with `FeeNotice`',
      'one more is new, `sections-BfEDugbO.js` at 273, `tierFees`, which the event page and the manage page share',
      '47 files of `dist/assets` take new names at the same size, their only change the names of the files they import',
      '`index.html`, 2,212 bytes in both, names the new main script', 'and the other 172 files of `dist` are the same, name for name and byte for byte.',
    ]) expect(build, piece).toContain(piece)
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 10: the lines outside the block', () => {
  it('keeps the Status line\'s fixed prefix and gives it this step\'s tail while this step is the latest and checkpoint L waits for its merge', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(10)
    if (latestStep === 10 && opening.startsWith('**Not merged yet:')) expect(tail).toBe(TAIL)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })

  it('keeps checkpoint J\'s and checkpoint K\'s parts of the PR line word for word, and gives checkpoint L\'s pull request as to be opened, open by its number or merged', () => {
    expect(prLine.startsWith(`${J_PART}${K_PART}`)).toBe(true)
    const lPart = closing(prLine, 'checkpoint L (steps 7 to 10)')
    expect(lPart).toMatch(/to be opened|pull request \d+|merged/)
    if (latestStep === 10 && opening.includes('(a draft pull request to be opened from this branch)')) expect(lPart).toBe(L_PART)
    expect(prLine).not.toContain('is pending')
    expect(prLine).not.toMatch(/\bnone yet\b/)
  })

  it('adds its four sentences to the map, once each, each after the words it follows and in front of the words it goes before, and to no other item', () => {
    for (const [id, sentence, follows, before] of MAP_SENTENCES) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.indexOf(follows), `${id}: ${follows}`).toBeGreaterThan(-1)
      expect(item.indexOf(sentence), `${id}: after ${follows}`).toBeGreaterThan(item.indexOf(follows))
      expect(item.indexOf(sentence), `${id}: in front of ${before}`).toBeLessThan(item.lastIndexOf(before))
    }
    expect(mapItems.filter((l) => l.includes('in WS08 step 10')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['AC15', PRICES_ITEM, WS02_ITEM, 'Q3'])
  })

  it('leaves the two kept items in WS08 step 1\'s words, and every other item with a sentence of the step that proved it, built a part of it or handed it on', () => {
    for (const [id, words] of KEPT) {
      const item = mapItem(id)
      expect(item, id).toContain(words)
      if (latestStep === 10) {
        expect(item.endsWith(words), id).toBe(true)
        expect(item, id).not.toMatch(STEP_SENTENCE)
      }
    }
    const kept = KEPT.map(([id]) => id)
    const others = mapItems.filter((l) => !kept.some((id) => l.startsWith(`- **${id}.**`)))
    expect(others.length).toBe(mapItems.length - KEPT.length)
    for (const item of others) expect(item, item.slice(0, 60)).toMatch(STEP_SENTENCE)
  })

  it('proves AC15 and Q3 as their items word them: G1 with its words, buttons and holds, Keep it at $0, one ask, the refusal as the panel, G2, the switch off, and no routing', () => {
    const ac15 = sentenceIn(mapItem('AC15'), PROVED, 'Planned: WS08 step 10.')
    for (const piece of [
      'a one-event director, who may not charge a fee, opening an event the president priced at $25 sees no panel until a price above it is typed',
      'G1\'s panel with the brief\'s words, its two buttons, Keep it at $0 and Ask LCA to set up my payout account, and its line, as information, role note on the info tint with no red',
      'under the Registration tab\'s prices for a late fee raised with its date, a date set on a stored late fee, a discount lowered or its deadline cleared, with both Save buttons held while it shows',
      'Keep it at $0 puts back every loaded price, both dates included, so the event goes back to $25 and a free one to $0',
      'and puts the focus back in the box whose price it put back',
      'the ask posts one payout request about the event through a double tap, which opens one `payout_request` ticket, and then reads "Asked. LCA has your request."',
      'a save the server refuses with the payout words all the same is drawn as the panel and never in the red strip',
      'a standing director\'s fee is taken with G2\'s note under it, on the manage page and on the wizard\'s sections step',
      'as the panel shows, a polite status line, visually hidden, says its title, so a screen reader hears it',
      'the manage page\'s only on an event they created and never beside the panel',
      'with the switch off neither shows and the page asks nothing',
      'no file of the server, the site, the shared rules or the workers names a Stripe Connect routing parameter, so no checkout sends money anywhere but LCA\'s account',
      'its member-event half waits for Phase 4 and the Fees step itself for the console part.',
    ]) expect(ac15, piece).toContain(piece)
    const q3 = sentenceIn(mapItem('Q3'), PROVED, 'Planned: WS08 step 10.')
    for (const piece of [
      'G2\'s note, word for word, tells a standing director that fees are paid into LCA\'s Stripe account and wait there until LCA sets up a connected account',
      'under the fees on the manage page and on the wizard\'s sections step',
      'no file under `functions/`, `src/`, `domain/` or `workers/` names a Stripe Connect routing parameter, `transfer_data`, `on_behalf_of`, `application_fee_amount` or a `Stripe-Account` header',
      'so no connected account is built and every payment stays in LCA\'s account.',
    ]) expect(q3, piece).toContain(piece)
  })

  it('ends each of the three follow-ups tagged with this step with its one sentence, and leaves the rest as WS08 step 1 wrote it', () => {
    expect(tagged(followUps)).toEqual(CARRIED.map(([first, last]) => `${first} ${last}`))
  })

  it('names every record line it points to by head words that stand in the record under those words', () => {
    const named = new Set<string>()
    for (const text of [block, checkpoint, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps)]) {
      for (const m of text.matchAll(/"([^"]+ \(WS\d\d step \d+\))"/g)) named.add(m[1])
    }
    expect(named.size).toBeGreaterThanOrEqual(20)
    // Every head stands in the WS08 section but one, WS02's follow-up on the Admin row's count: the one line this test reads
    // outside the section, held by name.
    const OUTSIDE_HEAD = 'The Admin row without a count (WS02 step 17)'
    for (const name of named) {
      if (name === OUTSIDE_HEAD) expect(status.split('\n').some((l) => l.startsWith(`- **${name}.**`)), name).toBe(true)
      else expect(ws08.includes(`- **${name}.**`), name).toBe(true)
    }
  })
})

describe('REDESIGN_STATUS.md, WS08 step 10: the Checkpoint L section', () => {
  it('opens waiting for its merge, or once it has merged, with the merge commit and its day, never calls the merge pending, and says what the checkpoint puts on today\'s pages', () => {
    const waiting = /^\*\*Not merged yet: checkpoint L waits for its merge into `main`\*\* \((?:a draft pull request to be opened from this branch|draft pull request \d+)\)\. /.test(opening)
    const merged = /^\*\*Merged into `main` as `[0-9a-f]{7,40}` on (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]+ \d{1,2}, \d{4}/.test(opening)
    expect(waiting || merged, opening.slice(0, 120)).toBe(true)
    expect(checkpoint).not.toMatch(PENDING)
    expect(checkpoint).not.toContain('is pending')
    for (const piece of [
      'Checkpoint L puts the first part on today\'s pages and closes it',
      'New tournament for a standing director on `/workspace` and for the president on Admin › Tournaments, with "Standing director" as the role\'s label',
      'D24\'s two notices, G1 for someone who may not charge a fee and G2 under a standing director\'s fees',
      'Every change a visitor could notice waits for `standingDirectors`, which stays off, and `CREATION_ROLES_ON`, which stays unset, so production behaves as today after the merge',
      'two endpoints answer that did not before, one answering only the caller\'s own grant and one refusing until the constant is set, and no page calls either while the switch is off',
      'With checkpoint L merged the first part is whole on `main`, and the switch and the constant go on together, in one change, once K\'s items are done',
      'as WS08 step 10\'s judgement call "K\'s items before standingDirectors goes on (WS08 step 10)" lists them', 'No page draws anything new.',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has a bullet for each of its four steps and each part a checkpoint\'s section gives, once each, in order', () => {
    const names = [
      '- **WS08 step 7:**', '- **WS08 step 8:**', '- **WS08 step 9:**', '- **WS08 step 10:**', '- **What the merge does to production.**', '- **Before merging.**',
      '- **Rollback.**', '- **What K looks at on a throwaway preview.**', '- **Checks at the end of the checkpoint.**',
    ]
    for (const name of names) expect(checkpoint.split('\n').filter((l) => l.startsWith(name)), name).toHaveLength(1)
    const at = names.map((name) => checkpoint.indexOf(`\n${name}`))
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const piece of ['`GET /api/me/tournament-creation`', '`POST /api/me/payout-request`', 'refused with "Not available yet." while the constant is unset', 'the record of checkpoint K\'s merge']) {
      expect(bullet(checkpoint, '- **WS08 step 7:**'), piece).toContain(piece)
    }
    expect(bullet(checkpoint, '- **WS08 step 9:**')).toContain('the Danger zone for the creator of an unpublished draft with no entries')
    for (const piece of [
      'D24\'s two notices', 'holding both Save buttons, with Keep it at $0 and the ask for a payout account, and the server\'s refusal drawn as it',
      'G2 under a standing director\'s fees, in the wizard and on the manage page of an event they created; the status line a screen reader hears as G1 shows',
      'K\'s items; and this section, with the text of the pull request.',
    ]) {
      expect(bullet(checkpoint, '- **WS08 step 10:**'), piece).toContain(piece)
    }
  })

  it('says what the merge does to production against main\'s head: no migration, the worker with its bundle unchanged, the endpoints, no window, the site\'s files measured and nothing a visitor sees', () => {
    const production = bullet(checkpoint, '- **What the merge does to production.**')
    for (const piece of [
      'Measured against `main`\'s head, `9d3b13b`, the merge of checkpoint K (pull request 124), on which WS08 step 7 began, and on the finished tree of WS08 step 10',
      'the merge-safety review measures again if `main` moves',
      'No migration. Nothing under `migrations/` changes, so `migrate-db.yml` does not start; production holds 0059 since checkpoint J\'s merge',
      'the payout request writes `support_tickets.kind` and `about_id`, which 0059 added',
      '`deploy-worker.yml` starts, since files under `functions/utils/` and `domain/` change, all in WS08 step 7',
      '(`functions/utils/admin/tickets.ts`, and under `domain/contracts` the new `me.ts`, with `registry.ts` and `index.ts`)',
      'redeploys the daily-emails worker with its bundle unchanged, since none of them is in its import closure',
      '`test/unit/published-review-closure.test.ts` and `test/unit/search-worker-closure.test.ts` hold',
      'a dry run of its bundle on `9d3b13b`\'s tree, exported read-only, and on the finished tree gives the same `index.js`, 32,757 bytes, byte for byte',
      'While `CREATION_ROLES_ON` is unset, every endpoint that existed answers, writes and refuses as today',
      '`GET /api/me/tournament-creation` answers a signed-in member their own grant under today\'s rules',
      'with `canChargeFees` true, and 401 signed out',
      '`POST /api/me/payout-request` answers 401 signed out and 403, "Not available yet.", to everyone signed in, before the body or any ticket is read, storing and sending nothing, where it answered 405 before',
      '`createTicket`\'s two callers today, the support form and the contact form, answer, store and send as before',
      'No page calls either endpoint while the switch is off, and every page is today\'s: the wizard\'s create is followed by the navigation and by no request, with no refresh of the member',
      'No window. Checkpoint L carries no migration, so no answer depends on which of the migration job and the Pages build finishes first.',
      'a production build of `main`\'s tree at `9d3b13b` and one of the finished tree give 227 files and 228 in `dist`, 189 and 190 of them in `dist/assets`',
      '172 are the same, path for path and byte for byte, the stylesheet `index-Dxhkeo-q.css` at 130,292 bytes and the switches chunk `features--b6t5tBm.js` at 685 among them, every switch off',
      'Twelve files of `dist/assets` change size, each by its name before the hash and its size on `main` and after',
      'the main script, `index-Ci_BhDMR.js` at 549,814 bytes to `index-CMYi2if3.js` at 550,347',
      'One file goes, `SectionRulesEditor-B-rSIBXU.js` at 3,260 bytes, its code now in `FeeNotice-BJPf5_PW.js` at 5,773 with `FeeNotice`, and one more is new, `sections-BfEDugbO.js` at 273',
      '41 files of `dist/assets` take new names at the same size, their only change the names of the files they import',
      '`index.html`, 2,212 bytes in both, names the new main script',
      'A tab left open across the deploy that then asks for one of the renamed files by its old name reloads once, through the stale-tab reload of WS02 step 1.',
      'Nothing a visitor sees: every page a visitor reaches is as it was, the event page loading one small file more with the same code',
      'every answer as it was but for `POST /api/me/payout-request`, which answers 403 where it answered 405 and which no page calls; `test/a11y/baseline.json` is unchanged.',
    ]) expect(production, piece).toContain(piece)
  })

  it('says no preview migration is needed, gives the decisions K is asked for with their record lines, what K looks at on a throwaway preview, and how to roll the merge back', () => {
    const before = bullet(checkpoint, '- **Before merging.**')
    for (const piece of [
      'The checks of the pull request pass on its head, the build-and-test job and the `a11y` job',
      'No preview migration is needed: checkpoint L carries no migration, and the preview database already holds 0059',
      'migrated from the branch on Wednesday, November 4, 2026 at about 7:05 PM UTC, before checkpoint J merged, as ordering rule 2 has it',
      'nothing runs on production by hand', 'The decisions K is asked for, each with the record line it comes from',
      'the deviation "An empty club id is read as none with every switch off (WS08 step 4)"', 'the follow-up "Who may mark the State Championship (WS08 step 3)"',
      'the follow-up "The fee tiers\' follow-ups wait for the Fees step (WS08 step 4)"', 'the decision "The president names directors on LCA-run events alone (WS08 step 6)"',
      'WS08 step 8\'s four questions, among its judgement calls', 'WS08 step 9\'s two, among its judgement calls',
      'WS08 step 10\'s two deviations, "G1 for a price typed above the one the page loaded (WS08 step 10)" and "Keep it at $0 puts back the prices the page loaded (WS08 step 10)"',
      'Each keeps its default until K answers, and none changes what this merge ships',
    ]) expect(before, piece).toContain(piece)
    const rollback = bullet(checkpoint, '- **Rollback.**')
    for (const piece of [
      '`git revert -m 1 <merge sha>` on `main` and push', 'so `deploy-worker.yml` redeploys the worker, its bundle the same', 'No migration job starts',
      'nothing in the database needs undoing', '`POST /api/me/payout-request` answering 405 again', 'revert the revert commit',
    ]) expect(rollback, piece).toContain(piece)
    const preview = bullet(checkpoint, '- **What K looks at on a throwaway preview.**')
    for (const piece of [
      'With `standingDirectors` on, on a preview built from a branch that turns it on in `src/lib/features.ts` and sets `CREATION_ROLES_ON` in `functions/utils/events/creation.ts` in one change',
      'taking `standingDirectors` out of the WS08 list in `test/unit/features.test.ts` in the same change so that its checks pass',
      '`npm run db:migrate:preview` is not needed first, since the preview database already holds 0059',
      'a standing director\'s New tournament on `/workspace`, and the wizard\'s G2 note on its sections step',
      'the created event on the manage page, open to change, with its Danger zone',
      'and G2\'s note under its sections table, and no note on an event an LCA admin created and named the standing director on',
      'a publish, its row "Made event public" in Admin › Admin activity, with the review mark, `review_notified_at`, stored on the event',
      'the president\'s New tournament on Admin › Tournaments, and the Directors button on the event the president created',
      'a one-event director\'s G1 panel on the manage page after typing a price above the loaded one, with Save held and Keep it at $0 putting the price back',
      'the payout ticket in Admin › Support tickets after the ask', 'the Members page\'s role select reading "Standing director", with its one line',
      'No email goes from a preview: ordering rule 1 keeps the live Resend key out of the Preview environment',
    ]) expect(preview, piece).toContain(piece)
  })

  it('gives the checks at its end as the figures of WS08 step 10, the same as the block\'s', () => {
    const checks = bullet(checkpoint, '- **Checks at the end of the checkpoint.**')
    expect(checks).toContain('The figures of WS08 step 10, the checkpoint\'s last step')
    expect(checks).toContain('no error in a file checkpoint L touches')
    const unit = /unit ([\d,]+) in (\d+) files and integration ([\d,]+) in (\d+), every one passing/.exec(checks)
    expect(unit, 'the counts in the checkpoint\'s checks').not.toBeNull()
    const blockUnit = /unit ([\d,]+) tests in (\d+) files/.exec(checksLine)
    const blockIntegration = /integration ([\d,]+) in (\d+) files/.exec(checksLine)
    expect([unit![1], unit![2]]).toEqual([blockUnit?.[1], blockUnit?.[2]])
    expect([unit![3], unit![4]]).toEqual([blockIntegration?.[1], blockIntegration?.[2]])
    const run = /`npm run test:a11y`, once, ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip/.exec(checks)
    const blockRun = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip/.exec(checksLine)
    expect(run?.slice(1)).toEqual(blockRun?.slice(1))
    const built = /`npm run build` \((\d+) files in `dist\/assets`\)/
    expect(built.exec(checks)?.[1]).toBe(built.exec(checksLine)?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS08 step 10: the four lists', () => {
  it('records its decision, its two deviations and its eight verify items, each tagged, each verify item confirmed, and no follow-up of its own beyond the three WS08 step 1 carried', () => {
    expect(tagged(decisions).map(head)).toEqual([DECISION])
    expect(tagged(deviations).map(head)).toEqual(DEVIATIONS)
    expect(tagged(verify).map(head)).toEqual(VERIFIED)
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
    expect(tagged(followUps).map(head)).toEqual(CARRIED.map(([first]) => head(first)))
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of entries(list)) expect(entry).toMatch(/^- \*\*[^*]+ \(WS08 step (?:[1-9]|10)\)\.\*\* \S/)
    }
  })

  it('stands its entries together in each list, the decision before WS08 step 7\'s, the deviations and the verify items after WS08 step 9\'s and before WS08 step 7\'s', () => {
    for (const list of [decisions, deviations, verify]) {
      const steps = stepsOf(list)
      const first = steps.indexOf(10)
      const count = steps.filter((n) => n === 10).length
      expect(steps.slice(first, first + count).every((n) => n === 10)).toBe(true)
      // The entry right after this step's is WS08 step 7's first.
      expect(steps[first + count]).toBe(7)
      expect(steps.indexOf(7)).toBe(first + count)
    }
    const decisionSteps = stepsOf(decisions)
    expect(decisionSteps[decisionSteps.indexOf(10) - 1]).toBe(6)
    for (const list of [deviations, verify]) {
      const steps = stepsOf(list)
      expect(steps[steps.indexOf(10) - 1]).toBe(9)
    }
  })

  it('says in the deviations what each departs from, and gives in its verify items the lines and the files each one read', () => {
    const [decision] = tagged(decisions)
    for (const piece of [
      '`FeeNotice`, the one component that draws both of D24\'s notices, G1 and G2, sits in `src/areas/admin/components`, beside `TournamentList` and the wizard',
      'no import crosses into another area\'s files, which `test/unit/area-boundaries.test.ts` holds to the five it knows',
      'The notices are information, never an error: navy words on the info tint, an "i" beside them, role note, no destructive or red class, and K\'s words, word for word, with no dash',
      'the ask is the Button\'s gold variant and never the brand\'s gold classes, whose importers `test/unit/button-gold-edges.test.tsx` holds to a closed list',
      'The setup checklist\'s Fees step, which the console part builds in the workspace area, takes `FeeNotice` with it',
    ]) expect(decision, piece).toContain(piece)
    const [typed, keep] = tagged(deviations)
    for (const piece of [
      'The brief shows G1 to anyone not on D24\'s list "who types a price above $0"', 'once a typed price is above the price the page loaded, at any tier',
      'since D24\'s rule lets a save that leaves the fees as they are pass and WS08 step 4\'s fee rule compares a save with the stored prices',
      'a one-event director finishing an event the president priced at $25 sees no panel, and the save is the server\'s to judge',
      'The wizard, which loads no prices, reads any fee above $0 as a raise, as the brief does.',
    ]) expect(typed, piece).toContain(piece)
    for (const piece of [
      'The brief\'s button keeps the event at $0', 'the loaded price is one the director may keep',
      'each section\'s entry fee and the whole of the Registration tab\'s prices, both dates included',
      'an event the president priced at $25 goes back to $25, and a free one to $0, the brief\'s own case',
      'The button keeps K\'s words; whether it should read otherwise on an event already priced is K\'s to say.',
    ]) expect(keep, piece).toContain(piece)
    const [anchors, loaded, strip, tint, who, gold, wizard, lists] = tagged(verify)
    for (const piece of [
      'Confirmed on `5448de2`, each about 20 lines below where the plan has it, since WS08 step 9 moved them',
      'in `src/pages/TournamentManagePage.tsx` the error strip is at lines 1161 to 1165, the sections table at 1352 to 1413 with the fee box at 1375 to 1381, Save details at 1461 to 1468',
      'the prices at 1572 to 1589 with their two warnings at 1590 to 1595, Save registration settings at 1618 to 1625, the `getMe` effect at 466 to 470, `updateSectionFee` at 761 to 765',
      'in `src/areas/admin/components/TournamentWizard.tsx` the fee table is at lines 399 to 427 with the fee box at 411 and `updateFee` at 361',
      'No Banner, Callout or Notice component exists, the nearest notes being `PreviewBanner` and `ViewOnlyNote`, so `FeeNotice` is new.',
    ]) expect(anchors, piece).toContain(piece)
    for (const piece of [
      '`FormSnapshot` (lines 88 to 111), which `applyManage` fills (lines 364 to 387)', 'a stored $0 discount or late fee read as an empty box by `money` (line 327)',
      '`refreshLive` replaces that state and leaves the snapshot as it was', '(`sectionResponse` in `functions/utils/events/sectionsRepo.ts`, line 696)',
    ]) expect(loaded, piece).toContain(piece)
    for (const piece of [
      'the strip at lines 1161 to 1165 draws any error in `border-destructive/30`, `bg-destructive/10` and `text-destructive`, which is red',
      '`handleResponse` in `src/lib/http.ts` throws an `ApiError` with the answer\'s `error`', '`FEES_NEED_PAYOUT_ACCOUNT`, which `domain/events/creation.ts` exports at line 44',
      'so neither brings zod into the site',
    ]) expect(strip, piece).toContain(piece)
    for (const piece of [
      '`--info-50`, `--info-100`, `--info-200` and `--info-800` are at lines 326 to 329 of `src/index.css`, their utilities at lines 135 to 138',
      '`test/unit/contrast.test.ts` holds `text-ink` at 4.5:1 on every tint the status map writes, in every look', 'lucide-react exports `Info`',
    ]) expect(tint, piece).toContain(piece)
    for (const piece of [
      'with `CREATION_ROLES_ON` unset `GET /api/me/tournament-creation` answers `canChargeFees` true to everyone (`functions/api/me/tournament-creation.ts`)',
      'an assigned one-event director', 'the wizard\'s G1 is wired for WS09\'s representatives and shows to nobody now',
    ]) expect(who, piece).toContain(piece)
    for (const piece of [
      '`test/unit/button-gold-edges.test.tsx` (lines 144 to 156) holds the importers of `GOLD_BUTTON` to the eighteen files that imported it at `a74f221`',
      '(`gold: GOLD_BUTTON`, line 33 of `src/components/ui/button.tsx`)', '`FeeNotice` imports neither `GOLD` nor `GOLD_BUTTON`',
      '`test/unit/base-components-scope.test.ts` (lines 70 to 73 on the base) holds the files that draw `variant="gold"` to the fixture page, the new header, the Menu sheet and the new footer',
      'so `FeeNotice` joins it there, the one pin this step moves.',
    ]) expect(gold, piece).toContain(piece)
    for (const piece of [
      'the draft note\'s em dash is at line 506 of `src/areas/admin/components/TournamentWizard.tsx` on `5448de2`, where the plan has 503, and at line 554 after this step',
      '`test/unit/wizard-refresh.test.tsx` holds, at lines 170, 185, 188 and 199, every request a create makes with the switch on',
      'so the wizard asks for the creation answer as its sections step first opens',
    ]) expect(wizard, piece).toContain(piece)
    for (const piece of [
      'every place in the list of follow-ups moves a pin of a closed record test, as WS08 steps 6 to 9 found', 'WS08 step 1\'s test holds its first ten heads',
      'so this step\'s entries stand after WS08 step 9\'s and before WS08 step 7\'s, and its hand-ons are judgement calls with their head words in bold',
    ]) expect(lists, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 10: plain language', () => {
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

  it('writes each checkpoint in full, and K only as K the person, never as he or his', () => {
    for (const text of written) expect(bareLetters(text), text.slice(0, 60)).toEqual([])
    for (const text of written) expect(text.replace(IN_FULL, 'checkpoint')).not.toMatch(/\bK (?:for|after|opens|merges|carries|holds) /)
    for (const text of prose) expect(text).not.toMatch(/\b(?:he|his|him)\b/i)
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

  it('adds only files that exist, each free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of [NEW_CODE, ...NEW_TESTS]) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
  })
})

describe('REDESIGN_STATUS.md, WS08 step 10: the date', () => {
  it('dates the record on a real day, on or after Friday, November 6, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-06').toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 10: the figures agree', () => {
  const files = bullet(block, '- **Files.**')
  const countOf = (name: string) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+)[:,] `).exec(files)?.[1])
  const build = bullet(block, '- **Build.**')
  const production = bullet(checkpoint, '- **What the merge does to production.**')
  const site = production.split('\n').find((l) => l.startsWith('  - The site.')) ?? ''

  it('gives unit counts that add up: the base\'s and the new files\', six files more, since the moved test keeps its count', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([7861, 297])
    const fresh = NEW_TESTS.map(countOf)
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    expect(countOf(MOVED[0]), MOVED[0]).toBe(MOVED[1])
    expect(num(before) + fresh.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts as the base\'s, since no integration test changes', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1321, 85])
    expect([num(after), Number(afterFiles)]).toEqual([num(before), Number(beforeFiles)])
  })

  it('gives the count of each new test file as the sum of its parts', () => {
    for (const name of NEW_TESTS) {
      const found = new RegExp(`\`${escape(name)}\` \\((\\d+): ([^)]*)\\)`).exec(files)
      expect(found, name).not.toBeNull()
      const counts = [...found![2].matchAll(/, (\d+)(?=;|$)/g)].map((m) => Number(m[1]))
      expect(counts.length, name).toBeGreaterThan(1)
      expect(counts.reduce((a, n) => a + n, 0), name).toBe(Number(found![1]))
    }
  })

  it('gives the browser run as one run whose counts add up, and the lint figures as the base\'s with the seven new files added', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), no error in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(851)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_TESTS.length + 1)
    expect(/`npm run build` \((\d+) files in `dist\/assets`\)/.exec(checksLine)?.[1]).toBe('190')
  })

  it('gives each chunk\'s growth as its two sizes\' difference, and the build\'s files as the sum of its parts', () => {
    const grew = (from: string, to: string) => {
      const found = new RegExp(`\`${escape(from)}\`, ([\\d,]+) bytes, is \`${escape(to)}\` at ([\\d,]+)`).exec(build)
      expect(found, `${from} to ${to}`).not.toBeNull()
      return num(found![2]) - num(found![1])
    }
    const moved = (from: string, to: string) => {
      const found = new RegExp(`\`${escape(from)}\` ([\\d,]+) to \`${escape(to)}\` ([\\d,]+)`).exec(build)
      expect(found, `${from} to ${to}`).not.toBeNull()
      return num(found![2]) - num(found![1])
    }
    expect(grew('TournamentManagePage-C2qXRiSE.js', 'TournamentManagePage-Bj9OYTq1.js')).toBe(2583)
    expect(grew('TournamentList-CopWruIB.js', 'TournamentList-D96TRGlf.js')).toBe(1133)
    expect(grew('TournamentDetailPage-CHdnoTEd.js', 'TournamentDetailPage-NCnW-mEA.js')).toBe(-224)
    expect(moved('AdminPage-CPPPWw2l.js', 'AdminPage-DbYX0QSG.js')).toBe(6)
    expect(moved('DashboardPage-DFJcgt27.js', 'DashboardPage-CIlG9jqr.js')).toBe(-4)
    expect(550347 - 550171).toBe(176)
    const renamed = sized(between(build, 'each by its name before the hash and its size in bytes on both sides: ', '; `index.html`'))
    expect(renamed.size).toBe(47)
    // The same files, the main script and five chunks that change size, one that goes and the ones that take new names, and index.html: the base's 227.
    expect(172 + 6 + 1 + renamed.size + 1).toBe(227)
    // After, two new chunks in place of the one that goes: 228.
    expect(172 + 6 + 2 + renamed.size + 1).toBe(228)
  })

  it('gives the checkpoint\'s files against main\'s head as the sum of their parts, and the same sizes after as the block gives', () => {
    const changed = between(site, 'change size, each by its name before the hash and its size on `main` and after: ', '. One file goes')
    const chunks = new Map([...changed.matchAll(/`([A-Za-z]+)`(?:,[^`;]*?)? ([\d,]+) to ([\d,]+)/g)].map((m) => [m[1], [num(m[2]), num(m[3])] as const]))
    // The main script and eleven chunks.
    expect(chunks.size + 1).toBe(12)
    expect(chunks.get('TournamentManagePage')).toEqual([85352, 88178])
    expect(chunks.get('TournamentList')).toEqual([41145, 42907])
    expect(chunks.get('TournamentDetailPage')).toEqual([37648, 37424])
    expect(chunks.get('AdminPage')?.[1]).toBe(92035)
    expect(chunks.get('DashboardPage')?.[1]).toBe(28621)
    const renamed = sized(between(site, 'their only change the names of the files they import: ', '; and `index.html`'))
    expect(renamed.size).toBe(41)
    expect(172 + 12 + 1 + renamed.size + 1).toBe(227)
    expect(172 + 12 + 2 + renamed.size + 1).toBe(228)
    // Each file the block gives as taking a new name at the same size is one the section gives the same way at that size, or one that
    // changed size since main's head, at the size the block gives.
    const blockRenamed = sized(between(build, 'each by its name before the hash and its size in bytes on both sides: ', '; `index.html`'))
    for (const [name, size] of blockRenamed) {
      if (renamed.has(name)) expect(renamed.get(name), name).toBe(size)
      else expect(chunks.get(name)?.[1], name).toBe(size)
    }
    for (const [name] of renamed) expect(blockRenamed.has(name), name).toBe(true)
  })
})
