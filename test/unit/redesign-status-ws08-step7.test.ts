// test/unit/redesign-status-ws08-step7.test.ts
//
// REDESIGN_STATUS.md records WS08 step 7, the first step of checkpoint L:
// the two endpoints the first part's pages read, GET
// /api/me/tournament-creation and POST /api/me/payout-request, each with its
// contract, and checkpoint K's merge. Like the record tests of WS08 steps 1
// to 6, this file reads only the WS08 section and the one piece of the date
// line the step writes, the date, never every table row or heading of the
// file, and it reads no count or figure from the code: the ratchet's figures
// the block gives, 15 to 17 contracted, 125 to 127 api methods and 110
// pending, are pinned here as text, as WS02 step 9's record test pins its
// own, and the live balance stays with test/unit/contracts-status.test.ts
// and test/unit/contract-coverage.test.ts, which a later endpoint moves
// without touching this file. Pinned here: the step's block, after the
// Checkpoint K section and before the four lists, with its parts in order,
// every file it names and figures that agree with each other; the
// Checkpoint K section's merged opening, in the form the Checkpoint J
// section took at WS08 step 4, and the sentence its Before merging bullet
// gains; the Status line's tail while this step is the latest; the PR
// line's part for checkpoint K; the two sentences this step adds to the
// map, each held by its order, as WS08 step 4's record test holds its own,
// so the sentences later steps add may stand beside them, and AC12's where
// WS08 step 3's closed test lets it stand; the sentence
// that ends WS08 step 4's deviation on the empty club id; this step's
// entries in the decisions, deviations and verify items, and no follow-up
// of its own; the plain-language rules over everything the step wrote; and
// the date. The files the step touches are read only to find them and hold
// them to the plain-language rules.
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
const TAG = '(WS08 step 7).'
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
const STEPS = [
  '### WS08 step 1: the record and the creation rules',
  '### WS08 step 2: migration 0059, the ticket kinds and the review mark',
  '### WS08 step 3: the create through the creation rules and the first director',
  '### Checkpoint J: WS08 steps 1 to 3',
  '### WS08 step 4: the entry fee rule on a save',
  '### WS08 step 5: the president names a one-event director, and a creator deletes a draft',
  '### WS08 step 6: the notice to the LCA admins at a standing director\'s first publish',
]
const CHECKPOINT = '### Checkpoint K: WS08 steps 4 to 6'
const STEP = '### WS08 step 7: what a person may create, and the payout request'
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
const listEntry = (list: string, name: string) => entries(list).find((l) => head(l) === name) ?? ''

/** The Status line up to and including its last fixed words, which WS08 step 1 set and every step keeps. */
const STATUS_PREFIX = '**Status:** in progress: the first part, tournament creation, ten steps in three checkpoints (checkpoint J for steps 1 to 3, checkpoint K for 4 to 6, checkpoint L for 7 to 10); '
/** The tail this step writes. */
const TAIL = 'steps 1 to 7 are built.'
/** The highest step with a block of its own in the section: a later step owns the Status line's tail. */
const latestStep = Math.max(0, ...[...ws08.matchAll(/^### WS08 step (\d+): /gm)].map((m) => Number(m[1])))
/** The PR line's part for checkpoint J, which WS08 step 4 wrote and this step keeps word for word. */
const J_PART = '**PR:** checkpoint J (steps 1 to 3) was draft pull request 123, merged into `main` as `73943e1` on Wednesday, November 4, 2026; '
/** The PR line's part for checkpoint K, as this step writes it once checkpoint K has merged. */
const K_PART = 'checkpoint K (steps 4 to 6) was draft pull request 124, merged into `main` as `9d3b13b` on Thursday, November 5, 2026; '
/** The PR line's part for checkpoint L, which stays until WS08 step 10 opens its pull request. */
const L_PART = 'checkpoint L (steps 7 to 10) opens as a draft pull request after WS08 step 10, each merged on its own.'

/** The two sentences this step adds to the map. */
const AC12_SENTENCE = 'Built in WS08 step 7: the grant answer, `GET /api/me/tournament-creation`, to its contract.'
const AC15_SENTENCE = 'Built in WS08 step 7: the ticket, one open per member, through `POST /api/me/payout-request`.'
/**
 * Each of the two with its item, the words of the sentence it follows and the words it stands in front of. Only the order is
 * held, so a later step's sentence may stand between either and its neighbours: WS08 steps 8 and 9 add theirs to AC12 after
 * this one, and WS08 step 10 puts its "Proved in" in front of AC15's planned step.
 */
const MAP_SENTENCES: ReadonlyArray<readonly [string, string, string, string]> = [
  ['AC12', AC12_SENTENCE, 'Built in WS08 step 1: ', 'Proved in WS08 step 3 by '],
  ['AC15', AC15_SENTENCE, 'Built in WS08 step 4: ', 'Planned: WS08 step 10.'],
]
/** The words of AC12 that WS08 step 3's closed record test holds whole, so AC12's sentence stands before them. */
const AC12_ENDING = '; its member organizer half waits for Phase 4 and its console half for the console part. Planned: WS08 step 3.'
/** K's go, as the sentence this step adds to WS08 step 4's deviation on the empty club id writes it. */
const GO = 'K said go for checkpoint K on Thursday, November 5, 2026 with the reading as it is, so it shipped with the merge.'
const EMPTY_CLUB = 'An empty club id is read as none with every switch off (WS08 step 4).'
/** The sentence the Checkpoint K section's Before merging bullet gains, in the past. */
const BEFORE_GO = 'K said go for checkpoint K on Thursday, November 5, 2026 with the empty club id read as it is, so that reading shipped with the merge, and the two questions for K stayed open.'
/** The sentence the section's opening gains after its words on the empty club id. */
const OPENING_GO = 'K said go for checkpoint K on Thursday, November 5, 2026 with that reading as it is, so it shipped with the merge.'

/**
 * The files this step adds: the two endpoints, their contracts, the contract
 * test, the endpoints' edges, the contracts on their own, and this record's
 * two tests, this one and the one that holds its claims about the code.
 */
const NEW_CODE = ['functions/api/me/tournament-creation.ts', 'functions/api/me/payout-request.ts', 'domain/contracts/me.ts']
const NEW_TESTS = [
  'test/integration/contracts/me-creation.test.ts',
  'test/integration/me-creation-edges.test.ts',
  'test/unit/me-contract.test.ts',
  'test/unit/redesign-status-ws08-step7.test.ts',
  'test/unit/redesign-status-ws08-step7-claims.test.ts',
]
const NEW_FILES = [...NEW_CODE, ...NEW_TESTS]
const NEW_UNIT = NEW_TESTS.filter((name) => name.startsWith('test/unit/'))
const NEW_INTEGRATION = NEW_TESTS.filter((name) => name.startsWith('test/integration/'))
/** The files of code and record this step changes. */
const CHANGED = ['functions/utils/admin/tickets.ts', 'domain/contracts/registry.ts', 'domain/contracts/index.ts', 'REDESIGN_STATUS.md']
/** The test whose pin this step moves, named among the changed files with its count as before. */
const MOVED = ['test/unit/routes.test.ts']
/** The unit test file whose count grows with no change of its own. */
const GROWN = ['test/unit/domain-boundaries.test.ts']
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
  block, opening, closing(bullet(checkpoint, '- **Before merging.**'), BEFORE_GO), ...tagged(decisions), ...tagged(deviations), ...tagged(verify),
  statusLine.slice(STATUS_PREFIX.length), closing(prLine, 'checkpoint K (steps 4 to 6)'), AC12_SENTENCE, AC15_SENTENCE,
  closing(listEntry(deviations, EMPTY_CLUB), GO), date?.[0] ?? '',
]

describe('REDESIGN_STATUS.md, WS08 step 7: the step block', () => {
  it('sits after the Checkpoint K section and before the four lists, once, under a heading in the record\'s form', () => {
    const at = [MAP, ...STEPS, CHECKPOINT, STEP, ...LISTS].map((h) => ws08.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws08.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(STEP).toMatch(/^### WS08 step 7: \S/)
    expect(sectionLines.filter((l) => /^### Step\b/.test(l))).toEqual([])
    expect(sectionLines.filter((l) => l.startsWith('|'))).toEqual([])
    // This step opens checkpoint L: its section and its pull request's text come with WS08 step 10.
    expect(sectionLines.filter((l) => l.startsWith('### Checkpoint L'))).toEqual(latestStep < 10 ? [] : sectionLines.filter((l) => l.startsWith('### Checkpoint L')))
  })

  it('opens by naming the step and its checkpoint, and says what a visitor sees, by switch', () => {
    const first = block.split('\n')[2] ?? ''
    expect(first.startsWith('WS08 step 7 is the first step of checkpoint L.')).toBe(true)
    for (const piece of [
      '`GET /api/me/tournament-creation`, what the signed-in person may create, their grant and the two rules for an LCA-run event',
      'with `CREATION_ROLES_ON` set and today\'s grants with it unset', '`POST /api/me/payout-request`, the request for a payout account',
      'which opens one support ticket of kind `payout_request` per member, in Admin\'s support list today',
      'decided by one statement so that two requests in flight together open one ticket', 'and is refused with 403 while the constant is unset',
      'It also records checkpoint K\'s merge', 'No page calls either endpoint yet', 'what a visitor sees, by switch, is nothing new with every switch off',
      'the pages that call them come with WS08 steps 8 and 10',
    ]) expect(first, piece).toContain(piece)
  })

  it('has every part, in order, each once', () => {
    const parts = [
      '- **Files.**', '- **The grant answer.**', '- **The payout request.**', '- **The contracts and the ratchet.**', '- **What ships with every switch off.**',
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
    for (const name of NEW_CODE) expect(fresh, name).toContain(`\`${name}\` (`)
    for (const name of NEW_TESTS) expect(fresh, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    const changed = files.slice(files.indexOf(' Changed: '))
    for (const name of [...CHANGED, ...MOVED]) expect(changed, name).toContain(`\`${name}\``)
    for (const name of MOVED) expect(changed, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, as before: `))
    for (const name of GROWN) expect(bullet(files, '  - Grown with no change:'), name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, \\d+ before: `))
    for (const piece of [
      '`createTicket` gains `kind`, `aboutId` and `oneOpenPerMember` in its input', 'and `created` in its result',
      'its comments\' three dashes and the old initials, in its note on a shared seat, put in plain words, comments only',
      'No other file is added or changed: nothing under `src/`, `migrations/`, `workers/`, `scripts/` or `scanner/`',
      'nor `functions/api/me.ts`, `test/unit/contracts-pending.ts`, `package.json` or the lock file',
      'every case of the contract test reading the stored rows, `support_tickets` with `kind` and `about_id` and `support_messages`, and the outbox after the call',
    ]) expect(files, piece).toContain(piece)
  })

  it('gives the grant answer: its four fields, what each grant gets in both states, and what it never does', () => {
    const grant = bullet(block, '- **The grant answer.**')
    for (const piece of [
      '`requireAuthedMember` (`functions/utils/auth.ts`, line 80)', 'reads `CREATION_ROLES_ON` once into `rolesOn` at each request',
      '`{ grant, canCreate, canChargeFees, clubId }`', '`creationPerson(db, member, rolesOn)`', '`canCreate(person, null, rolesOn)`, the answer for an LCA-run event',
      '`canChargeFees(person, { clubId: person.repClubId, createdBy: null }, rolesOn)`', '`person.repClubId`, null for everyone else',
      'With the constant set an LCA admin gets `admin`, true and true', 'the president and a standing director `president` and `standing_director`, true and true',
      'a club rep `club_rep`, false and true, with its club', 'a club rep who holds the seat `president`, true and true, with its club',
      'everyone else `none`, false and false', 'With it unset the answer is today\'s grants',
      'everyone else `none`, false and true, since today anyone who manages an event may set a fee', 'It answers only the caller\'s own grant, whatever the query string asks, 401 signed out',
      'no cache header of its own', 'it stores and sends nothing', '`TournamentCreationResponse`',
    ]) expect(grant, piece).toContain(piece)
  })

  it('gives the payout request: its refusal, its words, the one statement, the event line only for an event the member manages, and what the admins see', () => {
    const payout = bullet(block, '- **The payout request.**')
    for (const piece of [
      'refuses with 403, "Not available yet.", while `CREATION_ROLES_ON` is unset, its one read of the constant, before the body or any ticket is read',
      '`parseBody` and `payoutRequestRequestSchema`',
      '`SELECT id, status FROM support_tickets WHERE member_id = ? AND kind = \'payout_request\' AND status IN (\'open\', \'in_progress\') ORDER BY created_at DESC LIMIT 1`',
      'answers 200 with it and `created` false, storing and sending nothing', 'the subject "Payout account request from Remy Guidry"',
      '"Remy Guidry asked LCA to set up a payout account for them: a connected account inside LCA\'s Stripe account (Stripe Connect), so their events can charge entry fees and the money reaches them. Until it exists their events run at $0."',
      '`{ ticket: { id, kind: \'payout_request\', status: \'open\' }, created: true }`', 'with no ticket number, as the decision "The payout request\'s answer carries no ticket number (WS08 step 7)" sets',
      '"Event: Lafayette Winter Quads (Sat, Dec 5, 2026)"',
      '"Sat, Dec 5 to Sun, Dec 6, 2026" for two days', 'only for an event the member manages, as `canManageTournament` (`functions/utils/admin/permissions.ts`, line 58) answers, and that exists',
      'so a member who knows a draft\'s id learns nothing of it',
      '`INSERT INTO support_tickets (id, number, member_id, name, email, subject, seat_id, kind, about_id) SELECT ?, (SELECT COALESCE(MAX(number), 1000) + 1 FROM support_tickets), ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM support_tickets WHERE member_id = ? AND kind = ? AND status IN (\'open\', \'in_progress\'))`',
      '`INSERT INTO support_messages (id, ticket_id, sender_id, sender_type, body) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM support_tickets WHERE id = ?)`',
      'The batch\'s first `meta.changes` gives `created` on the guarded form, today\'s form always inserting', 'the helper sends none of its three best-effort emails and answers with no number',
      'D1 runs one batch after another, so of two requests in flight together one inserts and the other answers 200 with its ticket',
      'a `WHERE NOT EXISTS` on it would insert ticket 1001 and fail on `idx_support_tickets_number`',
      'Admin\'s support list, `GET /api/admin/support`, with its `kind` and `about_id`', 'the admins\' note to `CONTACT_EMAIL`',
      '"We got your message"', 'nothing more is sent', '`POST /api/support` and `POST /api/contact`, pass none of the three new inputs',
    ]) expect(payout, piece).toContain(piece)
  })

  it('gives the contracts and the ratchet, its figures as text: 15 to 17 contracted, 125 to 127 api methods, 110 pending', () => {
    const contracts = bullet(block, '- **The contracts and the ratchet.**')
    for (const piece of [
      '`domain/contracts/me.ts` imports zod and `./common` alone', '`creationGrantSchema`, the five grants', '`tournamentCreationResponseSchema`, strict',
      '`payoutRequestRequestSchema`, loose, `{ tournamentId?: string | null }`',
      '`payoutRequestResponseSchema`, strict, `{ ticket: { id, kind: \'payout_request\', status }, created }`, the ticket with no number', 'and their four types',
      '`\'me/tournament-creation\'` with its GET and `\'me/payout-request\'` with its POST', '`domain/contracts/index.ts` re-exports `./me`',
      'no file under `functions/api` imports zod', 'The ratchet moves by two contracted methods',
      '15 contracted of 125 api methods in 89 handler files on the base', '17 contracted of 127 api methods in 91 handler files after',
      '`test/unit/contracts-pending.ts` untouched at 110 pending, its `PENDING_COUNT` 110 and the K1d row\'s "110 lines, count pinned" as they were',
      'now 17 and 110 to 127', 'this step\'s record test reads none of them from the code',
    ]) expect(contracts, piece).toContain(piece)
  })

  it('says nothing a visitor sees ships with every switch off, and names the one pin it moves with its old and new expectation and its reason', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Nothing a visitor sees or hears.')).toBe(true)
    for (const piece of [
      'Two endpoints answer that did not before, and no page calls either', 'answers a signed-in member their own grant under today\'s rules',
      'answers 401 signed out and 403, "Not available yet.", to everyone signed in, storing and sending nothing', 'where before this step it answered 405',
      'the support form and the contact form, answer, store and send as before', 'The site\'s files are the base\'s, path for path and byte for byte',
      '`deploy-worker.yml` redeploys the daily-emails worker when checkpoint L merges', 'with its bundle unchanged',
      'gives `index.js`, 32,757 bytes, byte for byte the bundle measured before checkpoint K\'s merge',
    ]) expect(ships, piece).toContain(piece)
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins.startsWith('- **Pins moved.** One, in `test/unit/routes.test.ts`, closed with WS02 step 9,')).toBe(true)
    for (const piece of [
      '"finds the 89 handler files under api plus the page routes"', '`toBe(89)` to `toBe(91)`', 'since the two new files are new routes',
      'as WS02 step 9 moved it from 88 to 89 for `functions/api/search.ts`', 'It is a pin on the tree\'s live count, not on words a record wrote, and the plan does not name it',
      'no record test of a closed step changes', '`test/unit/domain-boundaries.test.ts` gains one case on its own',
    ]) expect(pins, piece).toContain(piece)
  })

  it('gives its judgement calls, the lint as unchanged, the build against the base, and each figure of the checks once', () => {
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(12)
    for (const piece of [
      'AC12\'s sentence goes after WS08 step 1\'s "Built in" sentence and before WS08 step 3\'s "Proved in"',
      'since WS08 step 3\'s closed record test holds the item\'s last words whole',
      'its Before merging and preview bullets keep their words, as the Checkpoint J section\'s kept theirs',
      'WS08 step 4 rewrote only that section\'s opening', 'WS08 step 6\'s closed record test holds those two bullets\' words as written before the merge',
      'Before merging gains one sentence in the past', 'a club rep who holds the seat reads `canCreate` true with its club in `clubId`',
      'the request answers 409, "We could not save your request just now. Please try again.", storing and sending nothing',
      'since `canManageTournament` answers true for any LCA admin on any id',
      '"Payout account request from Remy Guidry (from Remy Guidry)"', 'so the panel\'s button (WS08 step 10) sends `{}` or the event\'s id',
      'The constant is read once in each handler', 'through `vi.importActual`, so its guard alone decides there',
      'No follow-up is written', 'every place in the list of follow-ups moves a pin of a closed record test',
      'who may mark the State Championship (WS08 step 3)', 'the president\'s naming on events made before the term (WS08 step 6\'s judgement call)',
      'K\'s two production reads before the switch goes on (WS08 step 1)', 'The Status line\'s tail is "steps 1 to 7 are built."',
      'This step\'s record test holds each of the two by its order alone, as WS08 step 4\'s holds its own',
      'so the sentences WS08 steps 8 and 9 add to AC12 can follow it', 'so WS08 step 10\'s "Proved in" can stand between it and the planned step',
      'The claims test reads `createTicket`\'s callers by containment', 'and the two forms only for leaving out the three new inputs',
      'WS04\'s listing reports and the region target WS09 adds to `POST /api/contact` among them', 'it pins no comment of another file',
      'So a later caller of the helper moves no pin of this step\'s.',
    ]) expect(calls, piece).toContain(piece)
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      '`9d3b13b`', '`index-Ci_BhDMR.js` 549,814 bytes', '`index-Dxhkeo-q.css` 130,292 bytes', '`features--b6t5tBm.js` 685 bytes', 'name for name and byte for byte',
      'path for path and byte for byte', '`AdminPage-B6Q4Fb3L.js` at 91,566 bytes',
    ]) expect(build, piece).toContain(piece)
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 7: checkpoint K\'s merge', () => {
  it('opens the Checkpoint K section with the merge, its commit, its day and its time in UTC and Central', () => {
    expect(opening.startsWith(
      '**Merged into `main` as `9d3b13b` on Thursday, November 5, 2026 at 1:07 PM UTC** (pull request 124, a merge commit on head `b63cb43`), which was 7:07 AM Central. What the merge did, as seen afterwards:',
    )).toBe(true)
  })

  it('says what the merge did, as seen afterwards: the commits, no migration, the worker, the Pages build, CI and the live check', () => {
    for (const piece of [
      'the four commits K made since `73943e1`, `1627670`, `9215a72`, `e592afe` and `b63cb43`', 'No migration job ran, since nothing under `migrations/` changed',
      '`deploy-worker.yml` started with the push at 1:07 PM UTC and succeeded at 1:08 PM UTC', 'redeploying the daily-emails worker with its bundle unchanged, 32,757 bytes',
      'as dry runs on `9215a72`, `e592afe` and `b63cb43` had measured it before the merge', 'The Pages build went live at about 1:09 PM UTC',
      '`index-xBX31BFi.js` at 549,724 bytes, where the local production build names it `index-Ci_BhDMR.js` at 549,814',
      'the production build\'s names differ from a local build\'s, as they did at checkpoint J, when the live site named `index-YXn07qp7.js` where the local build named `index-BK-tB9L4.js`',
      'CI\'s Build and test on `main` (`ci.yml`) started with the push at 1:07 PM UTC and succeeded at 1:14 PM UTC, its browser job skipped on a push by design',
      'In the live check at 1:12 PM UTC the home page answered 200 in under a second, naming `index-xBX31BFi.js`, `index-Dxhkeo-q.css` and `features--b6t5tBm.js`',
      '`GET /api/tournaments` answered 200', 'a signed-out `POST /api/admin/tournaments` answered 401 Unauthorized, as before',
      '`POST /api/me/payout-request`, not built until WS08 step 7, answered 405',
    ]) expect(opening, piece).toContain(piece)
  })

  it('keeps the section\'s own words after the merge\'s, with K\'s go on the empty club id after them, and never calls a merge pending', () => {
    for (const piece of [
      'Checkpoint K builds the first part\'s rules into the endpoints that exist today', 'which K may still have wait for the constant',
      'it stays unset until checkpoint L', 'No page draws anything new.',
    ]) expect(opening, piece).toContain(piece)
    expect(opening.split(OPENING_GO)).toHaveLength(2)
    expect(opening.indexOf(OPENING_GO)).toBeGreaterThan(opening.indexOf('which K may still have wait for the constant'))
    expect(opening.indexOf(OPENING_GO)).toBeLessThan(opening.indexOf('it stays unset until checkpoint L'))
    expect(checkpoint).not.toContain('Not merged yet')
    expect(checkpoint).not.toContain('waits for its merge')
    expect(checkpoint).not.toMatch(PENDING)
    expect(checkpoint).not.toContain('is pending')
  })

  it('ends the Before merging bullet with K\'s go, keeping its words before it, and leaves the preview bullet as it was', () => {
    const before = bullet(checkpoint, '- **Before merging.**')
    expect(before.startsWith('- **Before merging.** The checks of the pull request pass on its head, the build-and-test job and the `a11y` job.')).toBe(true)
    expect(before.endsWith(BEFORE_GO)).toBe(true)
    expect(before.split(BEFORE_GO)).toHaveLength(2)
    const preview = bullet(checkpoint, '- **What K looks at on a throwaway preview.**')
    expect(preview.endsWith('that is the email to look at, and only the preview\'s admins get it.')).toBe(true)
    expect(preview).not.toContain('K said go')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 7: the lines outside the block', () => {
  it('keeps the Status line\'s fixed prefix and gives it this step\'s tail while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(7)
    if (latestStep === 7) expect(tail).toBe(TAIL)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })

  it('keeps checkpoint J\'s part of the PR line word for word, gives checkpoint K\'s as merged, and keeps checkpoint L\'s', () => {
    expect(prLine.startsWith(`${J_PART}${K_PART}`)).toBe(true)
    if (latestStep < 10) expect(prLine).toBe(`${J_PART}${K_PART}${L_PART}`)
    expect(prLine).not.toContain('is pending')
    expect(prLine).not.toMatch(/\bnone yet\b/)
  })

  it('adds its two sentences to the map, once each, each after the sentence it follows and in front of the words it goes before, AC12\'s where WS08 step 3\'s closed test lets it stand, and to no other item', () => {
    for (const [id, sentence, follows, before] of MAP_SENTENCES) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.indexOf(follows), `${id}: ${follows}`).toBeGreaterThan(-1)
      expect(item.indexOf(sentence), `${id}: after ${follows}`).toBeGreaterThan(item.indexOf(follows))
      expect(item.indexOf(sentence), `${id}: in front of ${before}`).toBeLessThan(item.lastIndexOf(before))
    }
    expect(mapItem('AC12').endsWith(AC12_ENDING)).toBe(true)
    expect(mapItem('AC15').endsWith('Planned: WS08 step 10.')).toBe(true)
    expect(mapItems.filter((l) => l.includes('in WS08 step 7')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['AC12', 'AC15'])
  })

  it('ends WS08 step 4\'s deviation on the empty club id with K\'s go, once', () => {
    const entry = listEntry(deviations, EMPTY_CLUB)
    expect(entry.endsWith(`K may still have it wait for the constant before checkpoint K merges. ${GO}`)).toBe(true)
    expect(entry.split(GO)).toHaveLength(2)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 7: the four lists', () => {
  it('records its two decisions, its two deviations and its six verify items, each tagged and each verify item confirmed, and no entry in the follow-ups', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'A second payout request answers the open one, and one statement decides it (WS08 step 7).',
      'The payout request\'s answer carries no ticket number (WS08 step 7).',
    ])
    expect(tagged(deviations).map(head)).toEqual([
      'The payout request is refused while the constant is unset (WS08 step 7).',
      'The grant answer leaves the member organizer\'s two fields to Phase 4 (WS08 step 7).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'The ratchet on the base (WS08 step 7).',
      'createTicket\'s shape (WS08 step 7).',
      'The batch\'s changes and the race (WS08 step 7).',
      'The support list answers the new columns (WS08 step 7).',
      'The contracts\' import rule (WS08 step 7).',
      'GET /api/me untouched (WS08 step 7).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
    expect(tagged(followUps)).toEqual([])
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of entries(list)) expect(entry).toMatch(/^- \*\*[^*]+ \(WS08 step (?:[1-9]|10)\)\.\*\* \S/)
    }
  })

  it('says in the decisions and the deviations what each decides and departs from', () => {
    const [decision, noNumber] = tagged(decisions)
    for (const piece of [
      'A member has one payout request open at a time', 'answers 200 with that ticket and `created` false, storing and sending nothing',
      'once an admin resolves it, the next request opens a new one', '`createTicket`\'s own insert decides it',
      'so two requests in flight together open one ticket whichever lands first', 'the read beforehand only spares the insert',
      'and the helper called twice in a row, where its guard alone decides',
    ]) expect(decision, piece).toContain(piece)
    for (const piece of [
      '"Ticket numbers are for staff and board members only."', '(`functions/api/support.ts`, line 74, and `functions/api/support/[id].ts`, line 38)',
      '(`functions/utils/email.ts`, line 301)', '`test/integration/emails.test.ts` (line 34)',
      'answers `{ ticket: { id, kind: \'payout_request\', status }, created }`', 'without the `number` the plan\'s contract gave the ticket',
      'its read of the open request names `id` and `status` alone', 'the admins\' note keeps the number at the end of its subject',
      'the panel of WS08 step 10 names a request by its words and its status, never by a number',
    ]) expect(noNumber, piece).toContain(piece)
    const [refused, fields] = tagged(deviations)
    for (const piece of [
      'The brief gives `POST /api/me/payout-request` no switch', 'refused with 403, "Not available yet.", before the body or any ticket is read, while `CREATION_ROLES_ON` is unset',
      'as brief 0.2 has every change a visitor could notice wait for its constant', 'the panel that sends it comes with WS08 step 10', 'Signed out it answers 401 in both states',
    ]) expect(refused, piece).toContain(piece)
    for (const piece of [
      '(line 1955)', 'their open member-created events out of three and whether the setting is on', '`member_events_enabled` come with the Phase 4 part',
      'it answers `canCreate` and `clubId` beside the grant and `canChargeFees`',
    ]) expect(fields, piece).toContain(piece)
  })

  it('gives in its verify items the figures, the lines and the runs each one read, the ratchet\'s as text', () => {
    const [ratchet, shape, race, list, imports, me] = tagged(verify)
    for (const piece of [
      '89 handler files under `functions/api`, 125 api methods, 15 contracted', '110 pending in `test/unit/contracts-pending.ts`, whose `PENDING_COUNT` is 110 (line 17)',
      '15 and 110 to 125 (line 35)', '"110 lines, count pinned" (line 30)', '91 handler files, 127 api methods, 17 contracted and 110 pending',
      '`contracts[\'me/tournament-creation\'].GET` and `contracts[\'me/payout-request\'].POST`', '(lines 168 to 179)',
    ]) expect(ratchet, piece).toContain(piece)
    for (const piece of [
      '`CreateTicketInput` is at lines 83 to 94, where the plan has 83 to 93', 'the ticket\'s insert at lines 119 to 124, where the plan has 120 to 125',
      'taken from `results[2]` at line 138', '`functions/api/support.ts` (line 38) and `functions/api/contact.ts` (line 40)', '`test/integration/ticket-kinds.test.ts` (line 82)',
      'On SQLite through `node:sqlite`', '"UNIQUE constraint failed: support_tickets.number"',
    ]) expect(shape, piece).toContain(piece)
    for (const piece of [
      'where the plan left it unchecked', '1 for the ticket\'s insert when it inserts and 0 when the guard finds one open', '"FOREIGN KEY constraint failed"',
      'with the guard taken out for one run, both found no open request and both inserted', 'the race case proves the guard and not the order the harness runs them in',
    ]) expect(race, piece).toContain(piece)
    for (const piece of ['`functions/api/admin/support.ts`, lines 14 to 22', 'reads `t.*`', '"GET admin/support"', '`test/integration/ticket-kinds-answers.test.ts`']) {
      expect(list, piece).toContain(piece)
    }
    for (const piece of ['(lines 50 to 60)', '(lines 62 to 69)', 'a list that does not name `me.ts`', '`domain/contracts/me.ts` imports zod and `./common` alone all the same']) {
      expect(imports, piece).toContain(piece)
    }
    for (const piece of ['`functions/api/me.ts`, 135 lines, is as it was', '(`test/unit/contracts-pending.ts`, lines 104 to 106)', '`/api/me/tournament-creation` and `/api/me/payout-request`']) {
      expect(me, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS08 step 7: plain language', () => {
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
    for (const file of [...NEW_FILES, ...CHANGED, ...MOVED]) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      if (file === 'REDESIGN_STATUS.md') continue
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
    for (const file of GROWN) expect(existsSync(join(ROOT, file)), file).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 7: the date', () => {
  it('dates the record on a real day, on or after Thursday, November 5, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-05').toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 7: the figures agree', () => {
  const files = bullet(block, '- **Files.**')
  const countOf = (name: string) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+)[:,] `).exec(files)?.[1])

  it('gives unit counts that add up: the base\'s, the new unit file\'s, the grown file\'s growth and the moved test\'s count as before, one file more', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([7569, 279])
    const fresh = NEW_UNIT.map(countOf)
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    const grown = [...bullet(files, '  - Grown with no change:').matchAll(/`[^`]+` \((\d+), (\d+) before: /g)].map((m) => Number(m[1]) - Number(m[2]))
    expect(grown).toHaveLength(GROWN.length)
    expect(num(before) + [...fresh, ...grown].reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s and the contract test\'s, one file more', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1271, 82])
    const fresh = NEW_INTEGRATION.map(countOf)
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + fresh.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
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

  it('gives the browser run as one run whose counts add up, and the lint figures as the base\'s with the new files added', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(827)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_FILES.length)
  })
})
