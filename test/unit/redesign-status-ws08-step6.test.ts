// test/unit/redesign-status-ws08-step6.test.ts
//
// REDESIGN_STATUS.md records WS08 step 6, the third and last step of
// checkpoint K: D22 by email, the LCA admins told once per event at a
// standing director's first publish, with the review mark set by the
// statement that decides the send; and the Checkpoint K section, which
// closes the checkpoint. Like the record tests of WS08 steps 1 to 5, this
// file reads only the WS08 section and the one piece of the date line the
// step writes, the date, never every table row or heading of the file, and
// it reads no count or figure from the code. Pinned here: the step's block,
// after WS08 step 5's and before the Checkpoint K section and the four
// lists, with its parts in order, every file it names and figures that agree
// with each other; the Checkpoint K section in the form the Checkpoint J
// section took before its merge; the Status line's tail while this step is
// the latest; the PR line's part for checkpoint K; the two sentences this
// step adds to the map; its entries in the decisions, deviations and verify
// items, and no follow-up of its own; the plain-language rules over
// everything the step wrote; and the date. The files the step touches are
// read only to find them and hold them to the plain-language rules.
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
  `${String.fromCharCode(0x27ea)}|${String.fromCharCode(0xa7)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}` +
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
const TAG = '(WS08 step 6).'
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
const CHECKPOINT_J = '### Checkpoint J: WS08 steps 1 to 3'
const STEP4 = '### WS08 step 4: the entry fee rule on a save'
const STEP5 = '### WS08 step 5: the president names a one-event director, and a creator deletes a draft'
const STEP = '### WS08 step 6: the notice to the LCA admins at a standing director\'s first publish'
const CHECKPOINT = '### Checkpoint K: WS08 steps 4 to 6'
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
/** The Checkpoint K section's opening paragraph, the line after its heading and a blank line. */
const opening = checkpoint.split('\n')[2] ?? ''
const mapItems = entries(map)
const mapItem = (id: string) => mapItems.find((l) => l.startsWith(`- **${id}.**`)) ?? ''
/** What this step added to an older line: from `from` to the end of the line. */
const closing = (line: string, from: string) => (line.includes(from) ? line.slice(line.indexOf(from)) : '')

/** The Status line up to and including its last fixed words, which WS08 step 1 set and every step keeps. */
const STATUS_PREFIX = '**Status:** in progress: the first part, tournament creation, ten steps in three checkpoints (checkpoint J for steps 1 to 3, checkpoint K for 4 to 6, checkpoint L for 7 to 10); '
/** The tail this step writes, while checkpoint K waits for its merge. */
const TAIL = 'steps 1 to 6 are built; checkpoint K waits for its merge into `main`.'
/** The highest step with a block of its own in the section: a later step owns the Status line's tail. */
const latestStep = Math.max(0, ...[...ws08.matchAll(/^### WS08 step (\d+): /gm)].map((m) => Number(m[1])))
/** The PR line's part for checkpoint J, which WS08 step 4 wrote and this step keeps word for word. */
const J_PART = '**PR:** checkpoint J (steps 1 to 3) was draft pull request 123, merged into `main` as `73943e1` on Wednesday, November 4, 2026; '
/** The PR line's part for checkpoint K, as this step writes it, before the pull request has a number. */
const K_PART = 'checkpoint K (steps 4 to 6) is a draft pull request to be opened from this branch now that WS08 step 6 is built, its number written here once it is open; '

const NOTICE_TEST = '`test/integration/published-review.test.ts`'
const EDGES_TEST = '`test/integration/published-review-edges.test.ts`'
const UNIT_TEST = '`test/unit/published-review-notice.test.ts`'
/** The words every map sentence of this step goes in front of. */
const PLANNED = ' Planned: WS08 step 6.'
/** The sentences this step adds to the map, each with the item it goes in. */
const SENTENCES: ReadonlyArray<readonly [string, string]> = [
  ['AC13', `Proved in WS08 step 6 by ${NOTICE_TEST} and ${EDGES_TEST}: `],
  ['D22', `Proved in WS08 step 6 by ${NOTICE_TEST}, ${EDGES_TEST} and ${UNIT_TEST}: `],
]
/** AC13's sentence ends with the halves WS08 step 1 named as waiting, in this step's words. */
const AC13_ENDING = '; its row half waits for the admin home part and its scheduled half for the console part.'
/** A map sentence of this step: from its opening to the planned step it sits in front of. */
const sentenceOf = (id: string, opens: string) => {
  const item = mapItem(id)
  const at = item.indexOf(opens)
  const end = item.lastIndexOf(PLANNED)
  return at < 0 || end < at ? '' : item.slice(at, end)
}

/** The files this step adds: the notice, its two tests, this record's test, and the three files of tests written once the notice was built. */
const NEW_CODE = ['functions/utils/events/publishedReview.ts']
/** The three files of tests written once the notice was built. */
const WRITTEN_AFTER = ['test/integration/published-review-edges.test.ts', 'test/unit/published-review-notice.test.ts', 'test/unit/redesign-status-ws08-step6-claims.test.ts']
const NEW_TESTS = [
  'test/integration/published-review.test.ts', 'test/unit/published-review-closure.test.ts', 'test/unit/redesign-status-ws08-step6.test.ts', ...WRITTEN_AFTER,
]
const NEW_FILES = [...NEW_CODE, ...NEW_TESTS]
const NEW_UNIT = NEW_TESTS.filter((name) => name.startsWith('test/unit/'))
const NEW_INTEGRATION = NEW_TESTS.filter((name) => name.startsWith('test/integration/'))
/** The new test files whose counts the block gives part by part. */
const PARTED = ['test/integration/published-review.test.ts', 'test/unit/published-review-closure.test.ts', ...WRITTEN_AFTER]
/** The files of code and record this step changes. */
const CHANGED = ['functions/api/admin/tournaments/[id].ts', 'REDESIGN_STATUS.md']
/** The test whose pin this step moves, named among the changed files with its count as before. */
const MOVED = ['test/integration/directors-edges.test.ts']
/** The closed test whose setup alone changes, so the notice's pauses take no time there, named the same way. */
const PACED = ['test/integration/tournament-create.test.ts']
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
  block, checkpoint, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), statusLine.slice(STATUS_PREFIX.length),
  closing(prLine, 'checkpoint K (steps 4 to 6)'), ...SENTENCES.map(([id, opens]) => sentenceOf(id, opens)), date?.[0] ?? '',
]

describe('REDESIGN_STATUS.md, WS08 step 6: the step block', () => {
  it('sits after WS08 step 5\'s block and before the Checkpoint K section and the four lists, once, under a heading in the record\'s form', () => {
    const at = [MAP, STEP1, STEP2, STEP3, CHECKPOINT_J, STEP4, STEP5, STEP, CHECKPOINT, ...LISTS].map((h) => ws08.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws08.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(ws08.split(`\n${CHECKPOINT}\n`)).toHaveLength(2)
    expect(STEP).toMatch(/^### WS08 step 6: \S/)
    expect(sectionLines.filter((l) => /^### Step\b/.test(l))).toEqual([])
    expect(sectionLines.filter((l) => l.startsWith('|'))).toEqual([])
    // No checkpoint L section yet: WS08 step 10 writes it when that checkpoint closes.
    expect(sectionLines.filter((l) => l.startsWith('### Checkpoint L'))).toEqual(latestStep < 10 ? [] : sectionLines.filter((l) => l.startsWith('### Checkpoint L')))
  })

  it('opens by naming the step and its checkpoint, and says what a visitor sees, by switch', () => {
    const first = block.split('\n')[2] ?? ''
    expect(first.startsWith('WS08 step 6 is the third and last step of checkpoint K.')).toBe(true)
    for (const piece of [
      'the first publish by hand of a standing director\'s event lists it at once', 'one email to each admin\'s address, once per event',
      'the mark `tournaments.review_notified_at` being set by the one statement that decides the send', 'so unpublishing and publishing again sends nothing more',
      'an event whose creator holds an LCA admin\'s, the president\'s or a club rep\'s grant at the publish sends nothing',
      'with the constant unset the save answers, writes and refuses as before, with no email and no mark', 'The step also closes checkpoint K',
      'what a visitor sees, by switch, is nothing new with every switch off', 'the publish\'s row in the activity log carries two more keys',
    ]) expect(first, piece).toContain(piece)
  })

  it('has every part, in order, each once', () => {
    const parts = [
      '- **Files.**', '- **The notice.**', '- **The mark.**', '- **The dates.**', '- **The worker.**', '- **What ships with every switch off.**',
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
    expect(fresh).toContain('`functions/utils/events/publishedReview.ts` (the notice: `markReviewNotified`, `creatorIsStandingDirector`, `eventDays` and `sendPublishedReviewNotice`')
    expect(fresh).toContain('`sendPublishedReviewNotice` never throws, logging a failure of any of its statements)')
    for (const name of NEW_TESTS) expect(fresh, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    const changed = files.slice(files.indexOf(' Changed: '))
    for (const name of [...CHANGED, ...MOVED, ...PACED]) expect(changed, name).toContain(`\`${name}\``)
    for (const name of [...MOVED, ...PACED]) expect(changed, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, as before: `))
    for (const name of [...MOVED, ...PACED]) expect(changed, name).toMatch(new RegExp(`\`${escape(name)}\` \\([^)]*\`setTimeout\` now calls back at once`))
    expect(files).toContain('No other file is added or changed: nothing under `src/`, `domain/`, `migrations/`, `workers/`, `scripts/` or `scanner/`, nothing else under `functions/`, nor `package.json` or the lock file.')
    expect(files).toContain('every case reading the stored row, the activity log and the outbox after the call')
    const beyond = files.split('\n').find((l) => l.startsWith('  - Files beyond the step\'s list: ')) ?? ''
    for (const name of [...MOVED, ...PACED, ...WRITTEN_AFTER]) expect(beyond, name).toContain(`\`${name}\``)
    expect(beyond).toContain('closed with WS08 step 5')
    expect(beyond).toContain('the three files of tests written once the notice was built')
    expect(fresh).toContain('and three files of tests written once the notice was built: ')
  })

  it('gives the notice: where the save calls it, who it reads, the one email to each address, the words, and the row\'s two keys', () => {
    const notice = bullet(block, '- **The notice.**')
    for (const piece of [
      '`sendPublishedReviewNotice(env, tournamentId)` in `functions/utils/events/publishedReview.ts` is called by `onRequestPatch`',
      'between the save\'s batch and the publish\'s row in the activity log, in the request and not through `waitUntil`',
      '`rolesOn`, the one read of it the save makes', '`if (rolesOn && isVisible && !existing.isVisible)`',
      'It asks `creatorIsStandingDirector`, which reads the grant the event\'s creator holds now through `creatorGrant`',
      'so an event whose creator holds an LCA admin\'s, the president\'s or a club rep\'s grant at the publish never sends, nor one whose creator has lost the role since',
      'while one whose creator has become a standing director since it was made does',
      'it reads the creator\'s grant and not the publisher\'s, so an LCA admin who publishes a standing director\'s draft sends it too',
      '`SELECT email, full_name FROM members WHERE role = \'lca_admin\' AND email LIKE \'%@%\' ORDER BY email`',
      'one `trySendEmail` to each address, never one message to several', '`functions/utils/admin/tickets.ts`',
      'the emails 400 ms apart, the pace `functions/utils/admin/campaigns.ts` sends the group email at, with no wait before the first',
      '`renderEmail`, `emailDetails` and `p` from `functions/utils/emailLayout.ts`, the button being `renderEmail`\'s `cta` field',
      '"Published by Gerald Landry, standing director: Lafayette Winter Quads (Sat, Dec 5, 2026)"', '"A standing director published an event"',
      '"now, on Tournaments"', '"After the fact: nothing holds a standing director\'s event. It is already listed. Look it over when you can."',
      'the button "Look it over", which opens `/admin/tournaments/` and the event\'s id, its manage page', '`resolveSiteUrl`', 'the same lines in plain text',
      'It answers `{ notified, sent }`', 'false as well when the creator is not a standing director, since the mark is then never tried',
      'It never throws: its statements run inside one `try`, whose `catch` logs an error from any of them with `console.warn`',
      'so a failure there never fails the save (Judgement calls, below)',
      'gains `review_notified` and `review_notices_sent` in its detail only while the constant is set', 'with it unset the row is today\'s, `{ tournament_id }`',
    ]) expect(notice, piece).toContain(piece)
  })

  it('gives the mark: the one statement and why it decides, and the dates: eventDays and why not formatEventDate', () => {
    const mark = bullet(block, '- **The mark.**')
    for (const piece of [
      '`UPDATE tournaments SET review_notified_at = datetime(\'now\') WHERE id = ? AND is_visible = 1 AND review_notified_at IS NULL`',
      'answers whether its `meta.changes` is 1', 'The statement is the decision', 'of two publishes at the same moment only one changes the row and only that one sends',
      'an event unpublished and published again, its mark set, changes nothing and sends nothing', 'The mark is set before the first email',
      '"The mark is database time (WS08 step 2)"', '`test/integration/review-mark-answers.test.ts`',
    ]) expect(mark, piece).toContain(piece)
    const dates = bullet(block, '- **The dates.**')
    for (const piece of [
      '`eventDays(date, endDate)` writes an event\'s days with a weekday on each', '`formatDate` in `domain/format/date.ts`', 'a file the worker already bundles',
      '"Sat, Dec 5, 2026"', '"Sat, Dec 5 to Sun, Dec 6, 2026"', '"Thu, Dec 31, 2026 to Fri, Jan 1, 2027"',
      '`formatEventDate` in `functions/utils/emailLayout.ts`', 'writes a two-day event with no weekday and joins the days with a dash', 'and it is unchanged',
    ]) expect(dates, piece).toContain(piece)
  })

  it('gives the worker: untouched, its closure the base\'s and held by the closure test, the five imports, the dry run, and the part that rewrites the test', () => {
    const worker = bullet(block, '- **The worker.**')
    for (const piece of [
      'Not touched: `workers/daily-emails/` is as it was', 'lines 72 to 75 of its `src/index.ts`, where the plan has 70 to 73', 'still runs the campaign sweep alone',
      'is the same eleven files as on the base', '`test/unit/published-review-closure.test.ts` holds that it reaches none of this part\'s server files',
      '`functions/utils/events/publishedReview.ts`, `functions/utils/events/creation.ts` and `functions/utils/admin/tickets.ts`',
      'names exactly five imports, `../email`, `../emailLayout`, `./creation`, `../site` and `../../../domain/format/date`',
      'not `functions/utils/admin/members.ts`, whose sign-in client would reach a worker\'s bundle',
      'A dry run of the worker\'s bundle on the base and on the finished tree gives the same `index.js`, 32,757 bytes, byte for byte',
      'The console part changes that test', '`publishedReview.ts` and `creation.ts` join the worker\'s imports and that part rewrites the test\'s lists',
      'which no record test of a closed step reads',
    ]) expect(worker, piece).toContain(piece)
  })

  it('says nothing a visitor sees ships with every switch off, and names the one pin it moves with its old and new expectation and its reason', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Nothing a visitor sees or hears.')).toBe(true)
    for (const piece of [
      'While `CREATION_ROLES_ON` is unset the save never calls the notice: it sends no email, sets no mark and writes the publish\'s row as today',
      'The site\'s files are the base\'s, path for path and byte for byte', '`deploy-worker.yml` redeploys the daily-emails worker when checkpoint K merges',
      'the worker imports none of the files this step adds or changes',
    ]) expect(ships, piece).toContain(piece)
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins.startsWith('- **Pins moved.** One, in `test/integration/directors-edges.test.ts`, closed with WS08 step 5,')).toBe(true)
    const moved = pins.split('\n').filter((l) => /^\s+- /.test(l))
    expect(moved).toHaveLength(1)
    for (const piece of [
      '`[\'is_visible\']` for every person, to `[\'is_visible\', \'review_notified_at\']` for "a standing director, their own draft"',
      'since that publish is the first publish of a standing director\'s event', 'the plan does not name this pin', 'the case is otherwise as WS08 step 5 left it',
      'but for its setup, where `setTimeout` now calls back at once',
    ]) expect(moved[0], piece).toContain(piece)
  })

  it('gives its judgement calls, the lint as unchanged, the build against the base, and each figure of the checks once', () => {
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(15)
    for (const piece of [
      'The notice runs in the request', 'An email outage leaves the mark set, the event listed and the save answering 200',
      'a send that fails is not tried again, so an event is never announced twice, and the admins are not told of that event',
      'records `review_notified` true and `review_notices_sent` 0', 'The notice reads the creator\'s grant at the publish',
      'The save reads the constant once, into `rolesOn`', 'hold the file to one read in each handler', 'One email for each address',
      'since `members.email` is not unique', 'the query reads `full_name` as the plan writes it', 'and not in `functions/utils/email.ts` beside the other templates',
      'passes the event\'s id through `encodeURIComponent`', '`eventDays` compares the two days as written out',
      'The publish\'s row carries its two keys on every publish while the constant is set', 'is no publish: it sends nothing and writes no row',
      'No follow-up is added', 'The Status line\'s tail says the checkpoint waits for its merge',
      'The notice reads the grant the creator holds at each publish while the constant is set, and the mark is set only when the notice goes',
      'an event first published while the constant was unset gets its one notice at its first publish once the constant is set',
      'a club rep\'s draft whose creator has become a tournament director among them',
      'The email names the event\'s creator, the standing director, as the one who published it',
      'even when an LCA admin or a one-event director made the publish', 'the publish\'s row in the activity log names who made it',
      'The emails go 400 ms apart, with no wait before the first, at the pace `functions/utils/admin/campaigns.ts` sends the group email',
      'a send it refuses is not tried again, since the mark decides the send', 'A publish\'s answer waits 400 ms more for each admin after the first',
      '`test/unit/published-review-notice.test.ts` holds the pace',
      'A failure of the database inside the notice does not fail the save either',
      'logs it with `console.warn` for the Worker tail, as `recordAdminAction` does its own',
      'so the save still writes the publish\'s row with its two keys and answers 200 for an event its batch has already listed',
      'Thrown out of the save, the error would answer 500 for a publish that had worked, with no row in the activity log',
      'the answer is `review_notified` false and the next publish tries the mark again',
      'the admins are not told of that event, as after an email outage',
      '`test/unit/published-review-notice.test.ts` each of the five statements',
    ]) expect(calls, piece).toContain(piece)
    // The new call sits beside the email outage's, right after it.
    const lines = calls.split('\n')
    const outage = lines.findIndex((l) => l.startsWith('  - An email outage leaves the mark set'))
    expect(lines[outage + 1]?.startsWith('  - A failure of the database inside the notice does not fail the save either')).toBe(true)
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      '`9215a72`', '`index-Ci_BhDMR.js` 549,814 bytes', '`index-Dxhkeo-q.css` 130,292 bytes', '`features--b6t5tBm.js` 685 bytes', 'name for name and byte for byte',
      'path for path and byte for byte', '`AdminPage-B6Q4Fb3L.js` at 91,566 bytes',
    ]) expect(build, piece).toContain(piece)
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 6: the Checkpoint K section', () => {
  it('opens waiting for its merge, or once it has merged, with the merge commit and its day, and never calls the merge pending', () => {
    const waiting = /^\*\*Not merged yet: checkpoint K waits for its merge into `main`\*\* \((?:a draft pull request to be opened|draft pull request \d+)\)\. /.test(opening)
    const merged = /^\*\*Merged into `main` as `[0-9a-f]{7,40}` on (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]+ \d{1,2}, \d{4}/.test(opening)
    expect(waiting || merged, opening.slice(0, 120)).toBe(true)
    expect(checkpoint).not.toMatch(PENDING)
    expect(checkpoint).not.toContain('is pending')
    for (const piece of [
      'Every change a visitor could notice waits for `CREATION_ROLES_ON`, which stays unset, and `standingDirectors`, which stays off',
      'an LCA admin\'s create with an empty club id, which WS08 step 4\'s deviation sets out and which K may still have wait for the constant',
      'it stays unset until checkpoint L', 'No page draws anything new.',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has a bullet for each of its three steps and each part a checkpoint\'s section gives, once each', () => {
    for (const name of [
      '- **WS08 step 4:**', '- **WS08 step 5:**', '- **WS08 step 6:**', '- **What the merge does to production.**', '- **Before merging.**',
      '- **Rollback.**', '- **What K looks at on a throwaway preview.**', '- **Checks at the end of the checkpoint.**',
    ]) expect(checkpoint.split('\n').filter((l) => l.startsWith(name)), name).toHaveLength(1)
  })

  it('says what the merge does to production against main\'s head: no migration, the worker with its bundle unchanged, the endpoints as today, the rows that wait, the site\'s files measured and nothing a visitor sees', () => {
    const production = bullet(checkpoint, '- **What the merge does to production.**')
    for (const piece of [
      'Measured against `main`\'s head, `73943e1`, the merge of checkpoint J (pull request 123)', 'the merge-safety review measures again if `main` moves',
      'No migration. Nothing under `migrations/` changes, so `migrate-db.yml` does not start',
      '`deploy-worker.yml` starts', 'redeploys the daily-emails worker with its bundle unchanged, since none of the files this checkpoint adds or changes is in its import closure',
      'a dry run of its bundle on `9215a72`, WS08 step 5\'s commit, and on the finished tree gives the same `index.js`, 32,757 bytes, byte for byte',
      'answer, write and refuse as today', 'its answers today\'s byte for byte, as `test/integration/tournament-delete-edges.test.ts` holds',
      'The activity log gains nothing while the constant is unset', '`tournament_delete` (WS08 step 5)', '`review_notified` and `review_notices_sent` (WS08 step 6)',
      'No email can go, since the notice is called only while the constant is set', 'No window. Checkpoint K carries no migration',
      'a production build of `main`\'s tree at `73943e1` and one of the finished tree give 227 files each in `dist`, 189 of them in `dist/assets`',
      '173 are the same, path for path and byte for byte', '53 files of `dist/assets` take new names',
      '`AdminPage-DEuc-Wha.js` at 91,463 bytes on `main` and `AdminPage-B6Q4Fb3L.js` at 91,566 after, 103 bytes more',
      '`index-BK-tB9L4.js` to `index-Ci_BhDMR.js` at 549,814 bytes', '`index.html`, 2,212 bytes in both, names the new main script',
      'WS08 step 6 changes none of the site\'s files', 'Nothing a visitor sees', '`test/a11y/baseline.json` is unchanged',
    ]) expect(production, piece).toContain(piece)
  })

  it('says no preview migration is needed and K looks at nothing yet, the pages coming in checkpoint L, and how to roll the merge back', () => {
    const before = bullet(checkpoint, '- **Before merging.**')
    for (const piece of [
      'No preview migration is needed: checkpoint K carries no migration, and the preview database already holds 0059', 'nothing runs on production by hand',
      'K decides before the merge whether the empty club id waits for the constant', 'who may mark the State Championship',
    ]) expect(before, piece).toContain(piece)
    const preview = bullet(checkpoint, '- **What K looks at on a throwaway preview.**')
    expect(preview.startsWith('- **What K looks at on a throwaway preview.** Nothing: checkpoint K changes no page a visitor sees, and the pages come in checkpoint L')).toBe(true)
    const rollback = bullet(checkpoint, '- **Rollback.**')
    for (const piece of ['`git revert -m 1 <merge sha>` on `main` and push', 'No migration job starts', 'nothing in the database needs undoing', 'revert the revert commit']) {
      expect(rollback, piece).toContain(piece)
    }
  })

  it('gives the checks at its end as the figures of WS08 step 6, the same as the block\'s', () => {
    const checks = bullet(checkpoint, '- **Checks at the end of the checkpoint.**')
    expect(checks).toContain('The figures of WS08 step 6, the checkpoint\'s last step')
    const unit = /unit ([\d,]+) in (\d+) files and integration ([\d,]+) in (\d+), every one passing/.exec(checks)
    expect(unit, 'the counts in the checkpoint\'s checks').not.toBeNull()
    const blockUnit = /unit ([\d,]+) tests in (\d+) files/.exec(checksLine)
    const blockIntegration = /integration ([\d,]+) in (\d+) files/.exec(checksLine)
    expect([unit![1], unit![2]]).toEqual([blockUnit?.[1], blockUnit?.[2]])
    expect([unit![3], unit![4]]).toEqual([blockIntegration?.[1], blockIntegration?.[2]])
    const run = /`npm run test:a11y`, once, ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip/.exec(checks)
    const blockRun = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip/.exec(checksLine)
    expect(run?.slice(1)).toEqual(blockRun?.slice(1))
  })
})

describe('REDESIGN_STATUS.md, WS08 step 6: the lines outside the block', () => {
  it('keeps the Status line\'s fixed prefix and gives it this step\'s tail while this step is the latest, as the checkpoint\'s opening has it', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(6)
    if (latestStep === 6) {
      if (opening.startsWith('**Not merged yet:')) expect(tail).toBe(TAIL)
      else expect(tail.startsWith('steps 1 to 6 are built') && !tail.includes('waits for its merge')).toBe(true)
    }
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })

  it('keeps checkpoint J\'s part of the PR line word for word, gives checkpoint K\'s pull request as to be opened, open by its number or merged, and keeps checkpoint L\'s', () => {
    expect(prLine.startsWith(J_PART)).toBe(true)
    const kPart = between(prLine, 'checkpoint K (steps 4 to 6)', 'checkpoint L (steps 7 to 10)')
    expect(kPart).toMatch(/to be opened|pull request \d+|merged/)
    if (latestStep === 6 && /\(a draft pull request to be opened\)/.test(opening)) expect(kPart).toBe(K_PART)
    if (latestStep < 10) expect(prLine.endsWith('checkpoint L (steps 7 to 10) opens as a draft pull request after WS08 step 10, each merged on its own.')).toBe(true)
    expect(prLine).not.toContain('is pending')
    expect(prLine).not.toMatch(/\bnone yet\b/)
  })

  it('adds its two sentences to the map, once each, in front of the planned step, and to no other item', () => {
    for (const [id, sentence] of SENTENCES) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.endsWith(`${sentenceOf(id, sentence)}${PLANNED}`), id).toBe(true)
      expect(sentenceOf(id, sentence).endsWith('.'), id).toBe(true)
    }
    expect(mapItems.filter((l) => l.includes('in WS08 step 6')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(SENTENCES.map(([id]) => id))
    const ac13 = sentenceOf(...SENTENCES[0])
    expect(ac13.endsWith(AC13_ENDING)).toBe(true)
    for (const piece of [
      'a standing director\'s event made through the create and published by hand lists at once and sends one email to each LCA admin\'s address and to no one else, each to one address',
      'naming the director as a standing director, the event and its date with its weekday', 'and sets the mark, which the publish\'s row in the activity log reports',
      'unpublishing and publishing again sends nothing more and leaves the mark as it was, and two publishes at once send once',
      'an LCA admin\'s event, the president\'s and one whose creator has lost the role send nothing and get no mark',
      'with the constant unset a standing director\'s event published sends nothing and gets no mark',
      'an email outage leaves the mark set, the event listed and the save answering 200',
      'the event is in the public list, on its page and in the search the moment the save answers, and in none of them before',
      'and two publishes at once send once, as five do', 'nor a club rep\'s or one with no creator',
      'as a failure of the database inside the notice after the mark does, the publish\'s row still written',
      'while one before the mark leaves none, so the next publish sends the notice',
    ]) expect(ac13, piece).toContain(piece)
    const d22 = sentenceOf(...SENTENCES[1])
    for (const piece of [
      'the mark is set by one conditional statement that decides the send', 'of two calls of the helper at the same moment one sets the mark and sends while the other sends nothing',
      'the email names the director as a standing director, the event and its days with a weekday on each', '"Sat, Dec 5 to Sun, Dec 6, 2026" with no dash',
      'an end date equal to the start read as one day and a span over New Year with both years', '"Look it over", opens the event\'s manage page',
      'the one it holds at the publish, so a club rep\'s draft whose creator has become a tournament director sends', 'and the emails go one to each address, 400 ms apart',
    ]) expect(d22, piece).toContain(piece)
    // The words of WS08 steps 1 and 2 stand in front of the new sentences.
    expect(mapItem('AC13')).toContain('Built in WS08 step 2: the column, `tournaments.review_notified_at`, nullable, in migration 0059. Proved in WS08 step 6 by')
    expect(mapItem('D22')).toContain('and the LCA admins are told after the fact, once per event, by email. Proved in WS08 step 6 by')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 6: the four lists', () => {
  it('records its three decisions, its three deviations and its eight verify items, each tagged and each verify item confirmed, and no follow-up', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'D22: listed at once, told after the fact (WS08 step 6).',
      'The mark decides the send (WS08 step 6).',
      'Two-day dates day by day (WS08 step 6).',
    ])
    expect(tagged(deviations).map(head)).toEqual([
      'The notice is email only (WS08 step 6).',
      'The scheduled publish waits for the console part (WS08 step 6).',
      'The notice runs inline (WS08 step 6).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'publish_at and the worker (WS08 step 6).',
      'meta.changes on D1 (WS08 step 6).',
      'The creator\'s row without members.ts (WS08 step 6).',
      'Every admin\'s address (WS08 step 6).',
      'formatEventDate\'s two-day form (WS08 step 6).',
      'The layout helpers (WS08 step 6).',
      'The worker\'s closure on the base (WS08 step 6).',
      'The save\'s one read of the constant (WS08 step 6).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
    expect(tagged(followUps)).toEqual([])
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of entries(list)) expect(entry).toMatch(/^- \*\*[^*]+ \(WS08 step (?:[1-9]|10)\)\.\*\* \S/)
    }
  })

  it('says in each decision what it decides', () => {
    const [d22, mark, days] = tagged(decisions)
    for (const piece of [
      'a standing director\'s event lists the moment it is published', 'nothing holds it', 'the LCA admins are told by one email each, after the fact',
      'The notice reads the grant the event\'s creator holds at the publish, through `creatorGrant`, and not the publisher\'s', 'With the constant unset nothing is sent and no mark is set.',
    ]) expect(d22, piece).toContain(piece)
    for (const piece of [
      '`markReviewNotified` is one conditional statement', 'the email goes only when it changed the row', 'two writers cannot both send',
      'a send after a failed email is not tried again, so once per event wins over a notice that may not arrive',
    ]) expect(mark, piece).toContain(piece)
    for (const piece of ['`eventDays` writes each day with its weekday and "to" between them', 'where `formatEventDate`\'s two-day form has neither weekday nor "to" and joins the days with a dash']) {
      expect(days, piece).toContain(piece)
    }
  })

  it('says in each deviation what departs from the brief and what waits for which part', () => {
    const [emailOnly, scheduled, inline] = tagged(deviations)
    for (const piece of [
      '`ADMIN_HOME_ON` does not exist yet', 'turns the email into a `published_review` row while the constant is set',
      'its Phase 4 backfill starts every event already emailed as reviewed', 'criterion 13\'s row half waits for that part',
    ]) expect(emailOnly, piece).toContain(piece)
    for (const piece of [
      '`tournaments.publish_at` is the console part\'s column (brief line 1910)', 'written only by the setup checklist\'s Publish step (line 1860)', '(line 1982)',
      'builds `sendPublishedReviewNotice` so that phase calls it', 'that phase is to clear `publish_at` in the write that publishes',
    ]) expect(scheduled, piece).toContain(piece)
    for (const piece of [
      'and not through `waitUntil`', 'so the row can say whether the mark was set and how many emails went', 'waits for one email to each admin, 400 ms apart', 'an email that fails does not fail the save',
      'nor does a failure of the database inside the notice, which the notice catches and logs',
    ]) {
      expect(inline, piece).toContain(piece)
    }
  })

  it('names in its verify items the lines and files each one read', () => {
    const items = tagged(verify)
    expect(items[0]).toContain('lines 72 to 75 of `workers/daily-emails/src/index.ts`, where the plan has 70 to 73')
    expect(items[1]).toContain('`functions/utils/membership/membershipActivation.ts` (line 108')
    expect(items[2]).toContain('`functions/utils/admin/members.ts` line 2 imports `../supabase`, which imports `@supabase/supabase-js`')
    expect(items[3]).toContain('(`functions/utils/admin/campaigns.ts`, lines 85 to 87)')
    expect(items[4]).toContain('`functions/utils/emailLayout.ts` lines 56 to 69')
    expect(items[5]).toContain('`staffTicketNotificationEmail` (`functions/utils/email.ts`, line 348)')
    expect(items[5]).toContain('its button is `renderEmail`\'s `cta` field, `{ label, url }`')
    expect(items[5]).toContain('builds its email with `renderEmail`, `emailDetails` and `emailQuote` from `functions/utils/emailLayout.ts`')
    expect(items[5]).toContain('The notice uses `p`, the layout\'s paragraph, where that template uses `emailQuote`')
    expect(items[6]).toContain('the worker reaches eleven files')
    expect(items[7]).toContain('so the notice\'s call reads `rolesOn` and the file still reads the constant twice')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 6: plain language', () => {
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
      // A short weekday is checked too, where the record writes the year.
      for (const [whole, weekday, month, day, year] of text.matchAll(new RegExp(`\\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat), (${short}) (\\d{1,2}), (\\d{4})`, 'g'))) {
        const index = MONTHS.map((m) => m.slice(0, 3)).indexOf(month)
        expect(WEEKDAYS[new Date(Date.UTC(Number(year), index, Number(day))).getUTCDay()].slice(0, 3), whole).toBe(weekday)
      }
      for (const time of text.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
    }
  })

  it('keeps every file the step adds or changes free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...MOVED, ...PACED]) {
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

describe('REDESIGN_STATUS.md, WS08 step 6: the date', () => {
  it('dates the record on a real day, on or after Thursday, November 5, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-05').toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 6: the figures agree', () => {
  const files = bullet(block, '- **Files.**')

  it('gives unit counts that add up: the base\'s and the new unit files\', four files more', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([7477, 275])
    const fresh = NEW_UNIT.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    expect(NEW_UNIT).toHaveLength(4)
    expect(num(before) + fresh.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s and the new integration files\', two files more, the moved test\'s and the paced test\'s counts as before', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1227, 80])
    const fresh = NEW_INTEGRATION.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    expect(NEW_INTEGRATION).toHaveLength(2)
    expect(num(before) + fresh.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the count of each new test file the block sets out part by part as the sum of its parts', () => {
    for (const name of PARTED) {
      const found = new RegExp(`\`${escape(name)}\` \\((\\d+): ([^)]*(?:\\([^)]*\\)[^)]*)*)\\)`).exec(files)
      expect(found, name).not.toBeNull()
      const counts = [...found![2].matchAll(/, (\d+)(?=;|,|$)/g)].map((m) => Number(m[1]))
      expect(counts.length, name).toBeGreaterThan(1)
      expect(counts.reduce((a, n) => a + n, 0), name).toBe(Number(found![1]))
    }
  })

  it('gives the browser run as one run whose counts add up, and the lint figures as the base\'s with the new files added', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(820)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_FILES.length)
  })
})
