// test/unit/redesign-status-ws08-step3.test.ts
//
// REDESIGN_STATUS.md records WS08 step 3, the last step of checkpoint J: the
// create widened through the creation rules, with the first director row,
// and the Checkpoint J section that closes the checkpoint. Like the record
// tests of WS08 steps 1 and 2, this file reads only the WS08 section and the
// one piece of the date line the step writes, the date, never every table
// row or heading of the file, and it reads no count or figure from the code.
// Pinned here: the step's block, after step 2's and before the Checkpoint J
// section and the four lists, with its parts in order, every file it names
// and figures that agree with each other; the Checkpoint J section, which
// opens waiting for its merge or, once merged, with the merge, and says what
// the merge does to production; the Status line's tail while this step is
// the latest, tied to the section's opening; the PR line; the four sentences
// this step adds to the map; its tagged entries in the four lists, the
// sentence that ends the follow-up WS08 step 1 handed to it, and the three
// follow-ups it hands on, all three to WS08 step 4, right after WS08 step
// 2's last; the plain-language rules over everything it wrote; and the date.
// The files the step touches are read only to find them and hold them to the
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
const TAG = '(WS08 step 3).'
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
const STEP = '### WS08 step 3: the create through the creation rules and the first director'
const CHECKPOINT = '### Checkpoint J: WS08 steps 1 to 3'
const LISTS = ['### WS08 decisions', '### WS08 deviations from the brief', '### WS08 verify items resolved', '### WS08 follow-ups']
const map = part(MAP)
const block = part(STEP)
const checkpoint = part(CHECKPOINT)
/** The Checkpoint J section's opening paragraph. */
const opening = checkpoint.split('\n')[2] ?? ''
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

/** The Status line up to and including its last fixed words, which WS08 step 1 set and every step keeps. */
const STATUS_PREFIX = '**Status:** in progress: the first part, tournament creation, ten steps in three checkpoints (checkpoint J for steps 1 to 3, checkpoint K for 4 to 6, checkpoint L for 7 to 10); '
/** The tail this step writes, while checkpoint J waits for its merge. */
const TAIL = 'steps 1 to 3 are built; checkpoint J waits for its merge into `main`.'
/** The highest step with a block of its own in the section: a later step owns the Status line's tail. */
const latestStep = Math.max(0, ...[...ws08.matchAll(/^### WS08 step (\d+): /gm)].map((m) => Number(m[1])))

const BOTH = '`test/integration/tournament-create.test.ts` and `test/integration/contracts/admin-tournaments.test.ts`'
/** The map items this step proves, each with the words its sentence opens with, in front of the item's planned step. */
const PROVED: ReadonlyArray<readonly [string, string]> = [
  ['AC12', `Proved in WS08 step 3 by ${BOTH}: `],
  ['D20', `Proved in WS08 step 3 by ${BOTH}: `],
  ['Q2', `Proved in WS08 step 3 by ${BOTH}: `],
]
/** The waiting halves AC12's sentence ends with, as criterion 12 leaves them to later parts. */
const AC12_ENDING = '; its member organizer half waits for Phase 4 and its console half for the console part. Planned: WS08 step 3.'
/** Q37's sentence, which supports the item WS08 step 4 proves. */
const Q37 = 'Built in WS08 step 3: the create refuses a club for a standing director and the president with the `LCA_RUN_ONLY` words, and a standing director\'s event has no club and requires LCA membership.'

/** WS08 step 1's follow-up that this step takes, and the sentence that ends it. */
const SEAT = 'A club rep who holds the seat creates its own club\'s draft (WS08 step 3).'
const RESOLVED = 'Resolved in WS08 step 3, by design: '
/** WS08 step 2's last follow-up, which this step leaves as it was, for the console part. */
const GUEST = 'A guest\'s assignment lists a hidden draft (WS08 step 2).'
/** The follow-ups this step hands on, all three to WS08 step 4, right after the one on a guest's assignment. */
const HANDED = [
  'The create\'s fee list and a section\'s own early and late prices (WS08 step 4).',
  'Checkpoint J\'s pull request and merge in the record (WS08 step 4).',
  'An empty club id refused with the LCA-run words (WS08 step 4).',
]

/** The files this step adds: this record's test, and the six files of tests written once the create was built. */
const NEW_FILES = [
  'test/unit/redesign-status-ws08-step3.test.ts',
  'test/integration/first-director.test.ts',
  'test/integration/tournament-create-rules.test.ts',
  'test/integration/tournament-create-edges.test.ts',
  'test/integration/tournament-create-former-grant.test.ts',
  'test/integration/contracts/admin-tournaments-creation.test.ts',
  'test/unit/redesign-status-ws08-step3-claims.test.ts',
]
/** The new files of each suite, whose counts the Checks line's figures take. */
const NEW_UNIT = NEW_FILES.filter((name) => name.startsWith('test/unit/'))
const NEW_INTEGRATION = NEW_FILES.filter((name) => name.startsWith('test/integration/'))
/** The files of code and record this step changes. */
const CHANGED = ['functions/api/admin/tournaments.ts', 'REDESIGN_STATUS.md']
/** The test files this step extends, each with its count written in the block. */
const CHANGED_TESTS = ['test/integration/tournament-create.test.ts', 'test/integration/contracts/admin-tournaments.test.ts']
/** The closed test one of whose pins this step moves, named among the changed files with its count as before. */
const MOVED = ['test/unit/redesign-status-ws08-step1-claims.test.ts']
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
/** What this step added to an older line: from `from` to the end of the line. */
const closing = (line: string, from: string) => (line.includes(from) ? line.slice(line.indexOf(from)) : '')
const followUp = (name: string) => entries(followUps).find((l) => head(l) === name) ?? ''

/** Everything this step wrote, each piece on its own. */
const written = [
  block, checkpoint, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...HANDED.map(followUp), closing(followUp(SEAT), RESOLVED),
  statusLine.slice(STATUS_PREFIX.length), prLine, ...PROVED.map(([id, opens]) => closing(mapItem(id), opens)), Q37, date?.[0] ?? '',
]

describe('REDESIGN_STATUS.md, WS08 step 3: the step block', () => {
  it('sits after step 2\'s block and before the Checkpoint J section and the four lists, once, under a heading in the record\'s form', () => {
    const at = [MAP, STEP1, STEP2, STEP, CHECKPOINT, ...LISTS].map((h) => ws08.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws08.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(STEP).toMatch(/^### WS08 step 3: \S/)
    expect(sectionLines.filter((l) => /^### Step\b/.test(l))).toEqual([])
    expect(ws08.split('\n').filter((l) => l.startsWith('|'))).toEqual([])
  })

  it('opens by naming the step and its checkpoint, and says what a visitor sees, by switch', () => {
    const first = block.split('\n')[2] ?? ''
    expect(first.startsWith('WS08 step 3 is the third and last step of checkpoint J.')).toBe(true)
    expect(first).toContain('what a visitor sees, by switch, is nothing new')
    expect(first).toContain('with it unset, the create answers, writes and refuses as before')
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **The create.**', '- **The former grant.**', '- **The tests.**', '- **What ships with every switch off.**',
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
    for (const name of NEW_FILES) expect(fresh, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    const changed = files.slice(files.indexOf(' Changed: '))
    for (const name of [...CHANGED, ...CHANGED_TESTS]) expect(changed, name).toContain(`\`${name}\``)
    for (const name of CHANGED_TESTS) expect(changed, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, \\d+ before: `))
    for (const name of MOVED) expect(changed, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, as before: `))
    expect(files).toContain('No other file is added or changed: nothing under `src/`, `domain/`, `functions/utils/`, `migrations/`, `workers/`, `scripts/` or `scanner/`')
  })

  it('gives the create\'s checks in order, with the words of each refusal, the club, the fee check, the first director row and the audit entry', () => {
    const create = bullet(block, '- **The create.**')
    const pieces = [
      'reads `CREATION_ROLES_ON` inside the handler, at each request', 'reads the President seat only while the constant is set',
      'is 403 "Forbidden", today\'s first refusal, before the body is read',
      '400 "name, location, date, and entryFee are required"',
      '403 "Your account is not linked to a club yet. Ask an LCA admin to assign you one."',
      '403 "Club reps can only create tournaments for their club"',
      '`const clubId = person.repClubId ?? (body.clubId ?? null)`',
      '403 with `LCA_RUN_ONLY`, "Standing directors and the president create LCA-run events, not a club\'s."',
      '`canCreate(person, clubId, rolesOn)` answering no is 403 "Forbidden"',
      'it stays as the one place the answer is decided, except a club rep with no club, whom today\'s check refuses first whatever the seat (Q2)',
      '`feesRaised([], after)`', 'keyed "section:" and its name', 'keyed "event"', 'each with early and late null',
      '403 with `FEES_NEED_PAYOUT_ACCOUNT`, "Entry fees need a payout account first. Until then, your event can run at $0."',
      'no creator is refused by it',
      '`db.insert(tournamentDirectors).values({ tournamentId, memberId }).onConflictDoNothing()`',
      'an LCA admin, a club rep and a club rep who holds the seat manage the event by role and get no row',
      'carries `grant` beside `tournament_id` while the constant is set, and is `{ tournament_id }` alone, as before, while it is unset',
    ]
    for (const piece of pieces) expect(create, piece).toContain(piece)
    // The checks in the order the create makes them.
    const at = pieces.slice(2, 9).map((p) => create.indexOf(p))
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('names the five endpoints a former creator is refused, each with its check, in both states', () => {
    const former = bullet(block, '- **The former grant.**')
    for (const piece of [
      'with the constant set and unset', 'a club rep made `member` with no club, and an LCA admin made `member`',
      '`PATCH /api/admin/tournaments/[id]`, through `requireTournamentManager`', '`GET /api/admin/tournaments/[id]/manage`',
      '`GET /api/admin/tournaments/[id]/rating-report`', 'both through `requireTournamentView`',
      '`PATCH /api/registrations/[id]`, through `requireTournamentManager`', '`DELETE /api/admin/tournaments/[id]`, through `requireAdmin`',
      '`canManageTournament` never reads it', 'each with "Forbidden"', 'a cash payment moved to pending and back to paid',
      'so its 403 is the manage check\'s and not the refund rule\'s',
    ]) expect(former, piece).toContain(piece)
  })

  it('says which cases prove which half of criterion 12, in which state, and what waits for later parts', () => {
    const tests = bullet(block, '- **The tests.**')
    for (const piece of [
      'through a getter on the mocked module', 'puts it back to unset after every case',
      'Criterion 12\'s half with the constant set, in eight cases', 'Its half with the constant unset, in four',
      'Q2, in both states, seven cases each', 'The former grant, in both states', '`test/integration/contracts/admin-tournaments.test.ts`, with the constant set',
      'Against the create before this step, 8 of the 33 cases fail', 'with this step\'s create all 33 pass',
      'Six files written once the create was built hold the rest at its edges',
      'The member organizer\'s first director row waits for the Phase 4 part, and the former creator\'s 403 on the console for the console part.',
    ]) expect(tests, piece).toContain(piece)
  })

  it('says nothing a visitor sees ships with every switch off, and names the one pin it moves, in WS08 step 1\'s claims test, with its reason', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Nothing a visitor sees or hears.')).toBe(true)
    expect(ships).toContain('`POST /api/admin/tournaments` answers, writes and refuses as before while `CREATION_ROLES_ON` is unset')
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins.startsWith('- **Pins moved.** One, in a test closed with WS08 step 1, because D20\'s sentence in the map takes the standard form; nothing else in that test changes but what its line below says, and no other test\'s exact list, count, line number or fixture moves.')).toBe(true)
    expect(pins).toContain('the case at lines 54 to 60 keeps its body and gains its state in its name')
    // The one pin moved: its test, its old and new expectation, and why it moves.
    const moved = pins.split('\n').filter((l) => /^\s+- /.test(l))
    expect(moved).toHaveLength(1)
    for (const piece of [
      '`test/unit/redesign-status-ws08-step1-claims.test.ts`: in its case "reads only what step 1 wrote, so a sentence a later step adds to an item leaves both checks as they were"',
      '`toBe(mapItem(\'D20\'))` to `toBe(ownOf(mapItem(\'D20\')))`', 'the old expectation held D20 to no such sentence',
      'so it was going to fail the day D20 was proved', 'the moved pin still checks that `ownOf` cuts a later sentence off D20',
    ]) expect(moved[0], piece).toContain(piece)
  })

  it('gives its judgement calls, D20\'s standard form among them, the lint as unchanged, the build against the base, and each figure of the checks once', () => {
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(12)
    for (const piece of [
      'D20\'s sentence in the map takes the standard form, "Proved in WS08 step 3 by", as AC12\'s and Q2\'s do',
      'from `toBe(mapItem(\'D20\'))` to `toBe(ownOf(mapItem(\'D20\')))` (Pins moved, above)',
      'the handler only words the refusals, except a club rep with no club, whom today\'s check refuses first whatever the seat (Q2)',
      'the follow-up on a guest\'s assignment',
      'stays as WS08 step 2 wrote it, for the console part',
    ]) {
      expect(calls, piece).toContain(piece)
    }
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['`e9b9ecf`', 'the main script', 'the stylesheet', 'the switches chunk', 'bytes', 'byte for byte']) expect(build, piece).toContain(piece)
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 3: the Checkpoint J section', () => {
  it('opens waiting for its merge, or once it has merged, with the merge commit and its day, and never calls the merge pending in the old words', () => {
    const waiting = /^\*\*Not merged yet: checkpoint J waits for its merge into `main`\*\* \((?:a draft pull request to be opened|draft pull request \d+)\)\. /.test(opening)
    const merged = /^\*\*Merged into `main` as `[0-9a-f]{7,40}` on (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]+ \d{1,2}, \d{4}/.test(opening)
    expect(waiting || merged, opening.slice(0, 120)).toBe(true)
    expect(checkpoint).not.toMatch(PENDING)
    expect(opening).toContain('It changes no page.')
  })

  it('has a bullet for each of its three steps and each part a checkpoint\'s section gives, once each', () => {
    for (const name of [
      '- **WS08 step 1:**', '- **WS08 step 2:**', '- **WS08 step 3:**', '- **What the merge does to production.**', '- **Before merging.**',
      '- **Rollback.**', '- **What K looks at on a throwaway preview.**', '- **Checks at the end of the checkpoint.**',
    ]) expect(checkpoint.split('\n').filter((l) => l.startsWith(name)), name).toHaveLength(1)
  })

  it('says what the merge does to production: the migration, the worker with its bundle unchanged, the create as today, the window and nothing a visitor sees', () => {
    const production = bullet(checkpoint, '- **What the merge does to production.**')
    for (const piece of [
      'Measured against `main`\'s head as last fetched, `f58efd5`',
      '`migrate-db.yml` starts', 'applies 0059 to production: three nullable columns', 'so no row changes and no table is rebuilt',
      '`deploy-worker.yml` starts', 'redeploys the daily-emails worker with its bundle unchanged, since nothing it imports changed',
      'gives the same `index.js`, 32,757 bytes, byte for byte',
      '`POST /api/admin/tournaments` answers, writes and refuses as today while `CREATION_ROLES_ON` is unset',
      'the create and every save through `PATCH /api/admin/tournaments/[id]`', 'answer 500', 'watch it apply 0059, and re-run it at once if it fails',
      'path for path and byte for byte', 'Nothing a visitor sees',
    ]) expect(production, piece).toContain(piece)
  })

  it('says K migrates the preview database before the review and looks at nothing yet, the pages coming in checkpoint L, and how to roll the merge back', () => {
    expect(bullet(checkpoint, '- **Before merging.**')).toContain('K runs `npm run db:migrate:preview` from the branch')
    const preview = bullet(checkpoint, '- **What K looks at on a throwaway preview.**')
    expect(preview.startsWith('- **What K looks at on a throwaway preview.** Nothing yet: checkpoint J changes no page, and the pages come in checkpoint L')).toBe(true)
    const rollback = bullet(checkpoint, '- **Rollback.**')
    for (const piece of ['`git revert -m 1 <merge sha>` on `main` and push', '0059 stays on production', 'never in 0059']) expect(rollback, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 3: the lines outside the block', () => {
  it('keeps the Status line\'s fixed prefix and gives it this step\'s tail while this step is the latest, as the section\'s opening has it', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(3)
    if (latestStep === 3) {
      if (opening.startsWith('**Not merged yet:')) expect(tail).toBe(TAIL)
      else expect(tail.startsWith('steps 1 to 3 are built') && !tail.includes('waits for its merge')).toBe(true)
    }
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })

  it('says in checkpoint J\'s part of the PR line where its pull request stands, and names each checkpoint in full', () => {
    for (const piece of ['checkpoint J (steps 1 to 3)', 'checkpoint K (steps 4 to 6)', 'checkpoint L (steps 7 to 10)']) expect(prLine, piece).toContain(piece)
    // Checkpoint J's part, the line up to checkpoint K's: its pull request to be opened, open by its number, or merged. The line
    // before this step, which said none yet and had checkpoint J open after step 3, holds none of the three there.
    const jPart = prLine.slice(0, prLine.indexOf('checkpoint K (steps 4 to 6)'))
    expect(jPart).toContain('checkpoint J (steps 1 to 3)')
    expect(jPart).toMatch(/to be opened|pull request \d+|merged/)
    expect(prLine).not.toMatch(/\bnone yet\b/)
    expect(prLine).not.toContain('is pending')
  })

  it('adds its sentences to AC12, D20 and Q2 and to Q37, once each, in front of the planned step, and to no other item', () => {
    for (const [id, opens] of PROVED) {
      const item = mapItem(id)
      expect(item.split(opens), id).toHaveLength(2)
      expect(item.endsWith('Planned: WS08 step 3.'), id).toBe(true)
      expect(item.indexOf(opens), id).toBeLessThan(item.lastIndexOf('Planned: WS08 step'))
    }
    expect(mapItem('D20').split('in WS08 step 3'), 'D20 opens one way').toHaveLength(2)
    expect(mapItem('AC12').endsWith(AC12_ENDING)).toBe(true)
    for (const piece of ['a standing director and the president', 'are written as its first director', 'get 403 on its setup save, its manage answer, an entry\'s payment change, its rating report and its delete', 'meets the POST contract']) {
      expect(mapItem('AC12'), piece).toContain(piece)
    }
    expect(mapItem('D20')).toContain('refused with the `LCA_RUN_ONLY` words')
    expect(mapItem('Q2')).toContain('as the decision "Q2 keeps club reps as today (WS08 step 1)" sets')
    expect(mapItem('Q37').split(Q37)).toHaveLength(2)
    expect(mapItem('Q37').endsWith(`${Q37} Planned: WS08 step 4.`)).toBe(true)
    expect(mapItems.filter((l) => l.includes('in WS08 step 3')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['AC12', 'D20', 'Q2', 'Q37'])
  })

  it('records its two decisions, its two deviations and its six verify items, each tagged and each verify item confirmed', () => {
    expect(tagged(decisions).map(head)).toEqual(['D20: who may create now (WS08 step 3).', 'Who is written as a first director (WS08 step 3).'])
    expect(tagged(deviations).map(head)).toEqual([
      'A standing director and the president create LCA-run events only (WS08 step 3).',
      'No creator is refused a fee on create in Phase 1 (WS08 step 3).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'runBatch takes Drizzle queries alone (WS08 step 3).',
      'The five endpoints a former creator is refused (WS08 step 3).',
      'The getter reaches the handler (WS08 step 3).',
      'An officer or an observer with no seat (WS08 step 3).',
      'The president\'s club (WS08 step 3).',
      'The order of the create\'s checks (WS08 step 3).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of entries(list)) expect(entry).toMatch(/^- \*\*[^*]+ \(WS08 step (?:[1-9]|10)\)\.\*\* \S/)
    }
    expect(tagged(decisions)[0]).toContain('nothing else in the handler decides who may create, except a club rep with no club, whom today\'s check refuses first whatever the seat (Q2)')
    expect(tagged(deviations)[0]).toContain('"Standing directors and the president create LCA-run events, not a club\'s."')
  })

  it('ends the follow-up WS08 step 1 handed to it in place, leaves the guest\'s as it was, and hands three to WS08 step 4 right after it', () => {
    const heads = entries(followUps).map(head)
    // WS08 step 1's follow-up keeps its place and its words, and ends with this step's sentence.
    expect(heads.indexOf(SEAT)).toBe(3)
    const seat = followUp(SEAT)
    for (const piece of ['`canCreate` answers yes for a club rep who holds the President seat on an LCA-run event', 'it takes a club rep\'s own club first', 'the seat adds nothing on create']) {
      expect(seat, piece).toContain(piece)
    }
    expect(seat.split(RESOLVED)).toHaveLength(2)
    expect(seat.indexOf(RESOLVED)).toBeGreaterThan(seat.indexOf('the seat adds nothing on create'))
    expect(closing(seat, RESOLVED)).toContain('`const clubId = person.repClubId ?? (body.clubId ?? null)`')
    expect(tagged(followUps).map(head)).toEqual([SEAT])
    // The guest's follow-up stays as WS08 step 2 wrote it, and this step's three come right after it.
    const at = heads.indexOf(GUEST)
    expect(at).toBeGreaterThan(-1)
    expect(followUp(GUEST).endsWith('Owner: WS08 step 3 or the console part.')).toBe(true)
    expect(heads.slice(at + 1, at + 1 + HANDED.length)).toEqual(HANDED)
    expect(followUp(HANDED[0])).toContain('`sectionFeeOverrides` in `domain/events/sections.ts`')
    expect(followUp(HANDED[1])).toContain('as WS02 step 6 and WS02 step 9 recorded checkpoint E\'s and checkpoint F\'s')
    // An empty club id, refused with the LCA-run words where the create's later checks read it as no club, for WS08 step 4 to read as null.
    for (const piece of [
      'a standing director or the president who sends `clubId: ""` is refused with the `LCA_RUN_ONLY` words',
      'the check at line 95 of `functions/api/admin/tournaments.ts` tests `clubId !== null`', 'read an empty string as no club',
      'The wizard sends null for no club, so only a request made by hand meets it, and nothing is written.',
      'WS08 step 4, which touches the create\'s fee list, reads an empty string as null before that check.',
    ]) {
      expect(followUp(HANDED[2]), piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS08 step 3: plain language', () => {
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
      expect(text).not.toMatch(/\.github\//)
      expect(text).not.toMatch(/\(step \d+[;),]/)
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

describe('REDESIGN_STATUS.md, WS08 step 3: the date', () => {
  it('dates the record on a real day, on or after Wednesday, November 4, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-04').toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 3: the figures agree', () => {
  const files = bullet(block, '- **Files.**')

  it('gives unit counts that add up: the base\'s and the two new unit files\', in as many files more', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([7223, 266])
    const fresh = NEW_UNIT.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + fresh.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s, the two extended files\' gains and the five new files\', in five files more', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1002, 70])
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

  it('gives the count of test/integration/tournament-create.test.ts as the sum of its parts', () => {
    const found = /`test\/integration\/tournament-create\.test\.ts` \((\d+), \d+ before: ([^)]*)\)/.exec(files)
    expect(found).not.toBeNull()
    const counts = [...found![2].matchAll(/, (\d+)(?=;|$)/g)].map((m) => Number(m[1]))
    expect(counts).toHaveLength(5)
    expect(counts.reduce((a, n) => a + n, 0)).toBe(Number(found![1]))
    expect(bullet(block, '- **The tests.**')).toContain(`all ${found![1]} pass`)
  })

  it('gives the browser run as one run whose counts add up, and the lint figures as the base\'s with the new files added', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_FILES.length)
  })

  it('closes the checkpoint with the figures of its last step', () => {
    const closingChecks = bullet(checkpoint, '- **Checks at the end of the checkpoint.**')
    const unit = /unit ([\d,]+) tests in (\d+) files/.exec(checksLine)
    const integration = /integration ([\d,]+) in (\d+) files/.exec(checksLine)
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip/.exec(checksLine)
    expect(unit).not.toBeNull()
    expect(integration).not.toBeNull()
    expect(run).not.toBeNull()
    expect(closingChecks).toContain(`unit ${unit![1]} in ${unit![2]} files and integration ${integration![1]} in ${integration![2]}`)
    expect(closingChecks).toContain(`${run![1]} tests, ${run![2]} that run and ${run![3]} that skip`)
  })
})
