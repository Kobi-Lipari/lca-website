// test/unit/redesign-status-ws08-step8.test.ts
//
// REDESIGN_STATUS.md records WS08 step 8, the second step of checkpoint L:
// New tournament on today's pages for a standing director and the president,
// behind standingDirectors, "Standing director" as the role's label with its
// one line beside the role choice, and the site's two calls of WS08 step 7's
// endpoints with the fixture of what the area modules have gained since
// WS01's split. Like the record tests of WS08 steps 1 to 7, this file reads
// only the WS08 section and the one piece of the date line the step writes,
// the date, never every table row or heading of the file, and it reads no
// count or figure from the code: the counts and the bytes the block gives are
// pinned here as text. Pinned here: the step's block, after WS08 step 7's and
// before the four lists, with its parts in order, every file it names and
// figures that agree with each other; the Status line's tail while this step
// is the latest; the PR line, as WS08 step 7 left it; the three sentences
// this step adds to the map, each held by its order, so the sentences later
// steps add may stand beside them; this step's entries in the decisions, the
// deviations and the verify items, and no follow-up of its own; the
// plain-language rules over everything the step wrote; and the date.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')

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
    `|\\b(${['LI' + 'NT', 'BUI' + 'LD', 'BROW' + 'SER', 'CHE' + 'CKS', 'GR' + 'EP', 'RECORD' + 'TESTS', 'UNIT' + '_AFTER', 'RECORD' + '_TEST'].join('|')})\\b`,
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
const TAG = '(WS08 step 8).'
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
]
const STEP = '### WS08 step 8: New tournament on today\'s pages, the standing director\'s label and the two calls behind them'
const LISTS = ['### WS08 decisions', '### WS08 deviations from the brief', '### WS08 verify items resolved', '### WS08 follow-ups']
const map = part(MAP)
const block = part(STEP)
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
/** The tail this step writes. */
const TAIL = 'steps 1 to 8 are built.'
/** The highest step with a block of its own in the section: a later step owns the Status line's tail. */
const latestStep = Math.max(0, ...[...ws08.matchAll(/^### WS08 step (\d+): /gm)].map((m) => Number(m[1])))
/** The PR line as WS08 step 7 left it, which stays until WS08 step 10 opens checkpoint L's pull request. */
const PR_LINE =
  '**PR:** checkpoint J (steps 1 to 3) was draft pull request 123, merged into `main` as `73943e1` on Wednesday, November 4, 2026; ' +
  'checkpoint K (steps 4 to 6) was draft pull request 124, merged into `main` as `9d3b13b` on Thursday, November 5, 2026; ' +
  'checkpoint L (steps 7 to 10) opens as a draft pull request after WS08 step 10, each merged on its own.'

/** The sentence AC12 and Q11 gain. */
const BUILT = 'Built in WS08 step 8: New tournament on `/workspace` for a standing director and on Admin › Tournaments for the president, each list showing the events the person created.'
/** The opening of the sentence Q4 gains. */
const Q4_PROVED = 'Proved in WS08 step 8 by `test/unit/roles-label.test.ts` and `test/unit/members-table-role-title.test.tsx`: '
/**
 * Each sentence with its item, the words of the sentence it follows and the words it stands in front of. Only the order is held, so a
 * later step's sentence may stand between either and its neighbours: WS08 step 9 adds its own to AC12 and puts its "Proved in" in
 * front of Q11's planned step.
 */
const MAP_SENTENCES: ReadonlyArray<readonly [string, string, string, string]> = [
  ['AC12', BUILT, 'Built in WS08 step 7: ', 'Proved in WS08 step 3 by '],
  ['Q4', Q4_PROVED, 'who holds it is K\'s read before the switch goes on.', 'Planned: WS08 step 8.'],
  ['Q11', BUILT, 'today\'s manage page for the event\'s creator.', 'Planned: WS08 step 9.'],
]
/** The words of AC12 that WS08 step 3's closed record test holds whole, so AC12's sentence stands before them. */
const AC12_ENDING = '; its member organizer half waits for Phase 4 and its console half for the console part. Planned: WS08 step 3.'

/** The files this step adds: the fixture, the four tests of the pages and the label, the six unit tests of the step's parts at their edges, and this record's test. */
const NEW_FIXTURE = 'test/unit/fixtures/api-added-since-split.json'
const NEW_TESTS = [
  'test/unit/workspace-new-tournament.test.tsx',
  'test/unit/admin-president-new-tournament.test.tsx',
  'test/unit/roles-label.test.ts',
  'test/unit/members-table-role-title.test.tsx',
  'test/unit/role-label-readers.test.tsx',
  'test/unit/members-table-line-edges.test.tsx',
  'test/unit/president-directors-rule.test.tsx',
  'test/unit/workspace-creation-edges.test.tsx',
  'test/unit/api-split-records-closed.test.ts',
  'test/unit/directors-modal-switch-words.test.tsx',
  'test/unit/redesign-status-ws08-step8.test.ts',
]
/** The integration test this step adds: the two pages' requests replayed through the real handlers. */
const NEW_INTEGRATION = ['test/integration/creation-pages-replay.test.ts']
/** The files of code and record this step changes. */
const CHANGED = [
  'src/areas/membership/api.ts', 'src/areas/events/api.ts', 'src/areas/admin/roles.ts', 'src/areas/admin/components/MembersTable.tsx',
  'src/areas/admin/components/DirectorsModal.tsx', 'src/pages/WorkspacePage.tsx', 'src/pages/AdminPage.tsx', 'REDESIGN_STATUS.md',
]
/** The tests whose pins this step moves, each named among the changed files with its count after and before. */
const MOVED: ReadonlyArray<readonly [string, number, number]> = [
  ['test/unit/route-audit.test.ts', 83, 80],
  ['test/unit/api-split-modules.test.ts', 28, 25],
  ['test/unit/api-exports.test.ts', 9, 9],
  ['test/unit/api-split-tool.test.ts', 39, 38],
]
/** The files beyond the step's list of fourteen: the list's sign-in, two more readers of the split's records, the Directors window's note, and the seven tests of the step's parts at their edges. */
const BEYOND = [
  'src/areas/events/api.ts', 'test/unit/api-exports.test.ts', 'test/unit/api-split-tool.test.ts', 'src/areas/admin/components/DirectorsModal.tsx',
  ...NEW_TESTS.slice(4, 10), ...NEW_INTEGRATION,
]
/** The split's three records, which stay as WS01 wrote them. */
const SPLIT_RECORDS = ['test/unit/fixtures/api-fetch-paths.json', 'test/unit/fixtures/api-exports.json', 'scripts/moves/api-split.json']
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

/** Everything this step wrote, each piece on its own. */
const written = [
  block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), statusLine.slice(STATUS_PREFIX.length),
  sentenceIn(mapItem('AC12'), BUILT, 'Proved in WS08 step 3 by '), sentenceIn(mapItem('Q4'), Q4_PROVED, 'Planned: WS08 step 8.'),
  sentenceIn(mapItem('Q11'), BUILT, 'Planned: WS08 step 9.'), date?.[0] ?? '',
]

describe('REDESIGN_STATUS.md, WS08 step 8: the step block', () => {
  it('sits after WS08 step 7\'s block and before the four lists, once, under a heading in the record\'s form', () => {
    const at = [MAP, ...BEFORE, STEP, ...LISTS].map((h) => ws08.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws08.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(STEP).toMatch(/^### WS08 step 8: \S/)
    expect(sectionLines.filter((l) => /^### Step\b/.test(l))).toEqual([])
    expect(sectionLines.filter((l) => l.startsWith('|'))).toEqual([])
    // The second step of checkpoint L: its section and its pull request's text come with WS08 step 10.
    expect(sectionLines.filter((l) => l.startsWith('### Checkpoint L'))).toEqual(latestStep < 10 ? [] : sectionLines.filter((l) => l.startsWith('### Checkpoint L')))
  })

  it('opens by naming the step and its checkpoint, and says what a visitor sees, by switch', () => {
    const first = block.split('\n')[2] ?? ''
    expect(first.startsWith('WS08 step 8 is the second step of checkpoint L.')).toBe(true)
    for (const piece of [
      'behind `standingDirectors`', 'New tournament for a standing director on `/workspace`\'s Events list and for the president on Admin › Tournaments in the view-only Admin',
      'each list showing the events the person created', 'with a Directors button on the LCA-run events the president created',
      '"Standing director" as the role\'s label wherever a page draws it', 'with the one line on what the role allows beside the role choice on the Members page',
      '`getTournamentCreation` and `requestPayoutAccount`', 'With every switch off every page is today\'s and neither endpoint is asked',
      'what a visitor sees, by switch, is nothing new', 'the manage page\'s part comes with WS08 step 9 and the payout panel with WS08 step 10',
    ]) expect(first, piece).toContain(piece)
  })

  it('has every part, in order, each once', () => {
    const parts = [
      '- **Files.**', '- **The label.**', '- **New tournament.**', '- **The wrappers.**', '- **What ships with every switch off.**',
      '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const p of parts) expect(block.split('\n').filter((l) => l.startsWith(p)), p).toHaveLength(1)
  })

  it('names every file it adds and changes, the new ones as new, each test with its count, the eleven beyond the plan\'s fourteen, and no other file', () => {
    const files = bullet(block, '- **Files.**')
    const fresh = files.slice(files.indexOf('New: '), files.indexOf(' Changed: '))
    expect(fresh).toContain(`\`${NEW_FIXTURE}\` (`)
    for (const name of [...NEW_TESTS, ...NEW_INTEGRATION]) expect(fresh, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    const changed = files.slice(files.indexOf(' Changed: '))
    for (const name of CHANGED) expect(changed, name).toContain(`\`${name}\``)
    for (const [name, after, before] of MOVED) {
      const form = after === before ? `\`${escape(name)}\` \\(${after}, as before: ` : `\`${escape(name)}\` \\(${after}, ${before} before: `
      expect(changed, name).toMatch(new RegExp(form))
    }
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const name of BEYOND) expect(beyond, name).toContain(`\`${name}\``)
    expect(BEYOND).toHaveLength(11)
    expect(beyond).toContain('Twenty-five files in all, where the plan counted fourteen.')
    for (const piece of [
      'No other file is added or changed: nothing under `functions/`, `domain/`, `migrations/`, `workers/`, `scripts/` or `scanner/`',
      'nor `src/lib/features.ts`, `src/lib/api.ts`', '`test/a11y/baseline.json`, `package.json` or the lock file',
    ]) expect(files, piece).toContain(piece)
    for (const name of SPLIT_RECORDS) expect(files, name).toContain(`\`${name}\``)
  })

  it('gives the label: a getter on the switch, its readers, the one line\'s words, beside the select and never a title', () => {
    const label = bullet(block, '- **The label.**')
    for (const piece of [
      '`ROLE_LABELS.tournament_director` in `src/areas/admin/roles.ts` is a getter', '`FEATURES.standingDirectors ? \'Standing director\' : \'Tournament Director\'`',
      'the switch is read each time a page draws the label, never once when the module loads',
      'the Members table\'s role select and its read-only role cell, the Workspace page\'s badge, the Dashboard\'s tools heading, "Standing director tools", and the activity log\'s role changes',
      '"A standing director creates and runs their own LCA-run tournaments here. An LCA admin grants the role on the Members page." (D20, Q4)',
      'names the line with `aria-describedby` and the line stands beside it as visible text', 'no option of the select carries a title in either state',
      'as the decision "The one line is visible help text beside the role select (WS08 step 8)" sets', 'which imports nothing, so no cycle forms',
      'Two places name the role in words of their own and read no label: the Directors window\'s note, which with the switch on says what naming a director does and names no role',
      'the group email\'s audience list on Admin › Email, "Tournament directors", which keeps its words, a question for K',
    ]) expect(label, piece).toContain(piece)
  })

  it('gives New tournament: who gets the button on each page, what each list reads, what the wizard sends, and who keeps today\'s page', () => {
    const create = bullet(block, '- **New tournament.**')
    for (const piece of [
      'a `tournament_director` asks `getTournamentCreation()` beside the list and reads the list signed in, `getTournaments({ signedIn: true })`',
      '`canCreate={(role === \'club_rep\' && !!clubId && !!memberId) || (FEATURES.standingDirectors && creation?.canCreate === true)}`',
      '"Create your first tournament to get started."', 'the hero\'s badge reads "Standing director"', 'every event whose `created_by` is theirs',
      'an `lca_observer` or an `lca_officer` asks `getTournamentCreation()` first', 'the list signed in only when the grant is `president`',
      '`canCreate={!viewOnly || president}`', '`canAssignDirectors={(t) => !viewOnly || (president && !!member && t.created_by === member.id && !t.club_id)}`',
      'the wizard draws no club picker and sends no `clubId`, and the president\'s event is LCA-run, as the create requires (WS08 step 3)',
      'an officer or an observer who holds no seat, whose list is read signed out after the answer', 'an LCA admin and every reader with the switch off, who never ask',
      'A failed creation answer leaves the Admin section as it is today, its list read signed out, and the Events list without New tournament, its rows read signed in all the same.', 'view-only for an observer until WS08 step 9 lifts it for an event\'s director',
      'checkpoint L merges steps 7 to 10 together',
      // The president's section keeps the listed events and the president's own drafts, never another person's.
      'and every draft on the site, of which the section keeps the president\'s own: it draws today\'s list, the listed events, `t.is_visible === 1`, with the drafts whose `created_by` is the president\'s, and no other person\'s draft',
      'the wizard\'s starting points are the same events',
      // The window the Directors button opens, in true words with the switch on.
      'says, with the switch on, what naming a director does, "A director you add runs this event only. Adding one never changes their role."',
      'naming writes a row of `tournament_directors` and nothing else',
      // The standing director's way to the manage page, which WS08 step 9 opens.
      'sends a `tournament_director` without it to `/dashboard`', 'the new row\'s Manage link on `/workspace` meets the same guard until a reload',
      'WS08 step 9 refreshes the member before the wizard navigates, so the guard finds the new director row',
    ]) expect(create, piece).toContain(piece)
    expect(create).not.toContain('the president\'s list holds every draft')
  })

  it('gives the wrappers: the two calls, their types from the contracts as types alone, the fixture whole, and the list\'s sign-in', () => {
    const wrappers = bullet(block, '- **The wrappers.**')
    for (const piece of [
      '`ApiTournamentCreation`, the contract\'s `TournamentCreationResponse`', 'a GET of `/api/me/tournament-creation` with `authHeaders` and `handleResponse`',
      '`ApiPayoutRequest`, the contract\'s `PayoutRequestResponse`', '`requestPayoutAccount(tournamentId?)`, a POST of `/api/me/payout-request` with `authHeaders` and the JSON body `{ tournamentId }`',
      'one type-only import from `@domain/contracts`', '`npm run check:bundle` finds none in `dist/assets`',
      '`requestPayoutAccount`, which no page calls yet, is left out of the production build by the bundler',
      '`{ "paths": ["/api/me/payout-request", "/api/me/tournament-creation"], "exports": { "ApiPayoutRequest": "membership", "ApiTournamentCreation": "membership", "getTournamentCreation": "membership", "requestPayoutAccount": "membership" } }`',
      'which stay as they are', 'the four tests that read the split\'s records join it to them',
      '`getTournaments` in `src/areas/events/api.ts` takes `{ signedIn }`', 'without it the call is today\'s, `fetch(\'/api/tournaments\')` with nothing else',
    ]) expect(wrappers, piece).toContain(piece)
  })

  it('says nothing a visitor sees ships with every switch off, and names the four pins it moves with their old and new expectations, the new fixture they join and the split\'s three records they read', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Nothing a visitor sees or hears.')).toBe(true)
    for (const piece of [
      'read `standingDirectors` through `FEATURES` at render', 'neither page asks `/api/me/tournament-creation`',
      'the Directors window\'s note is today\'s, word for word',
      'the list is asked as today, signed out', 'as the two page tests hold through a stub of `fetch`', '`requestPayoutAccount` is called by nothing and is not in the build',
      'the stylesheet and the switches chunk are the same, name for name and byte for byte', '`test/a11y/baseline.json` is unchanged',
      'No server file changes', 'the paths `deploy-worker.yml` watches',
    ]) expect(ships, piece).toContain(piece)
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins.startsWith('- **Pins moved.** Four, in the four tests that read WS01\'s split records')).toBe(true)
    // The opening names, by path, the fixture the four now join, as new, and the split's three records they read, each with its readers, as unchanged.
    const opening = pins.split('\n')[0]
    for (const name of [NEW_FIXTURE, ...SPLIT_RECORDS]) expect(opening, name).toContain(`\`${name}\``)
    for (const piece of [
      '`test/unit/fixtures/api-fetch-paths.json` (the paths the unsplit `src/lib/api.ts` fetched, read by `test/unit/route-audit.test.ts`)',
      '`test/unit/fixtures/api-exports.json` (the names it exported, read by the other three)',
      '`scripts/moves/api-split.json` (where the split sent each name, read by `test/unit/api-split-modules.test.ts` and `test/unit/api-split-tool.test.ts`)',
      `each test now joining to them the new fixture \`${NEW_FIXTURE}\` (new: the two paths and the four names)`,
      'the three records themselves staying as WS01 wrote them, unchanged',
    ]) expect(opening, piece).toContain(piece)
    for (const [name, after, before] of MOVED) {
      const sub = pins.split('\n').find((l) => l.startsWith(`  - \`${name}\`: `)) ?? ''
      expect(sub, name).not.toBe('')
      expect(sub, name).toContain(after === before ? `(${after} cases, as before)` : `(${before} cases to ${after})`)
    }
    for (const piece of [
      'held the paths found equal to `PATHS_BEFORE_SPLIT` and now holds them equal to that list and the fixture\'s two paths',
      'now lets membership hold one type-only import of `@domain/contracts`, for its two answer types, and no other module any',
      'its count of the snapshot, 182 names, is as it was', '"Barrel: 186 names, snapshot 186: the same set."',
      'the plan named the first two', '`scripts/split-api.ts` is unchanged, no record test of a closed step changes',
    ]) expect(pins, piece).toContain(piece)
  })

  it('gives its judgement calls, the lint as unchanged, the build file by file against the base, and each figure of the checks once', () => {
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(12)
    for (const piece of [
      'where the plan for this step named the option\'s title', 'never as a title attribute, which reaches a mouse alone',
      'Both lists were read signed out', 'the president\'s Directors button could never have shown',
      'The president\'s list waits for the creation answer', '`refreshMember` in `src/contexts/AuthContext.tsx`, which the wizard does not call',
      '`!t.club_id`', 'A creation answer that fails shows no New tournament and no error', 'The label is a getter',
      'The two answer types are type aliases', 'with `fetch` stubbed, rather than mocking the calls',
      'the Members table\'s live copy keeps them', 'No follow-up is written', 'as WS08 steps 6 and 7 found, and nothing has changed since',
      'so the four questions for K are written here', 'a change a visitor sees that waits for K\'s yes (Q34)',
      // The president's section, the window's note, the guard and the questions the step leaves for K.
      'drawing them all would show the president, and offer the wizard, the hidden drafts of every club and every LCA admin',
      'The manage page\'s guard reads the same events', 'The Directors window\'s note changes with the switch on alone',
      'Second, today\'s Directors window tells everyone who names a director', 'Third, the group email\'s audience list on Admin › Email offers "Tournament directors"',
      'Fourth, the one line stands beside the select of a member who holds the role', 'an admin who grants the role reads the line beside that member\'s select once the save answers',
      'and so does the Directors window\'s subtitle',
      'who may mark the State Championship (WS08 step 3)', 'the president\'s naming on events made before the term (WS08 step 6\'s judgement call)',
      'K\'s two production reads before the switch goes on (WS08 step 1)', 'The Status line\'s tail is "steps 1 to 8 are built."',
    ]) expect(calls, piece).toContain(piece)
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      '`6e6fe33`', '`index-Ci_BhDMR.js` 549,814 bytes', '`index-Dxhkeo-q.css` 130,292 bytes', '`features--b6t5tBm.js` 685 bytes',
      '`index-Ba2tMNJJ.js` at 550,171 bytes', 'the stylesheet and the switches chunk the same, name for name and byte for byte',
      '`AdminPage-B6Q4Fb3L.js`, 91,566 bytes, is `AdminPage-1yltLaje.js` at 92,029', '`WorkspacePage-wYCzi-Bw.js`, 6,962 bytes, is `WorkspacePage-BqU2w0-t.js` at 7,259',
      'the chunk that holds the Members table and the Directors window, `TournamentList-BRg05uGY.js`, 41,145 bytes, is `TournamentList-pBX08-Yr.js` at 41,711',
      'Six chunks move by a few bytes',
      '53 files of `dist/assets` take new names in all', '`index.html` names the new main script', 'the other 173 files of `dist` are the same',
    ]) expect(build, piece).toContain(piece)
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 8: the lines outside the block', () => {
  it('keeps the Status line\'s fixed prefix and gives it this step\'s tail while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(8)
    if (latestStep === 8) expect(tail).toBe(TAIL)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })

  it('leaves the PR line as WS08 step 7 left it while checkpoint L has no pull request', () => {
    if (latestStep < 10) expect(prLine).toBe(PR_LINE)
    expect(prLine).not.toContain('is pending')
  })

  it('adds its three sentences to the map, once each, each after the words it follows and in front of the words it goes before, and to no other item', () => {
    for (const [id, sentence, follows, before] of MAP_SENTENCES) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.indexOf(follows), `${id}: ${follows}`).toBeGreaterThan(-1)
      expect(item.indexOf(sentence), `${id}: after ${follows}`).toBeGreaterThan(item.indexOf(follows))
      expect(item.indexOf(sentence), `${id}: in front of ${before}`).toBeLessThan(item.lastIndexOf(before))
    }
    expect(mapItem('AC12').endsWith(AC12_ENDING)).toBe(true)
    expect(mapItem('Q4').endsWith('Planned: WS08 step 8.')).toBe(true)
    expect(mapItem('Q11').endsWith('Planned: WS08 step 9.')).toBe(true)
    expect(mapItems.filter((l) => l.includes('in WS08 step 8')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['AC12', 'Q4', 'Q11'])
  })

  it('proves Q4 as its item words it: visible text beside the role choice, never a title', () => {
    const q4 = mapItem('Q4')
    // WS08 step 1's words for the line stay, and the sentence this step adds holds to them.
    expect(q4).toContain('drawn as visible help text beside the role choice and never as a title attribute')
    const proved = sentenceIn(q4, Q4_PROVED, 'Planned: WS08 step 8.')
    for (const piece of [
      '`ROLE_LABELS` names `tournament_director` "Standing director" with the switch on and "Tournament Director" with it off, read each time a page draws it',
      '`STANDING_DIRECTOR_LINE` says what the role allows and names the Members page',
      'the role select of a member who holds the role has the one line beside it as visible text, which is the select\'s description',
      'no option of the select carries a title in either state',
    ]) expect(proved, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 8: the four lists', () => {
  it('records its three decisions, its deviation and its five verify items, each tagged and each verify item confirmed, and no entry in the follow-ups', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'The label follows the switch (WS08 step 8).',
      'The one line is visible help text beside the role select (WS08 step 8).',
      'Each creator\'s list is read signed in (WS08 step 8).',
    ])
    expect(tagged(deviations).map(head)).toEqual(['The president\'s events are LCA-run from the view-only Admin (WS08 step 8).'])
    expect(tagged(verify).map(head)).toEqual([
      'The anchors on the base (WS08 step 8).',
      'The pins on the client files (WS08 step 8).',
      'FEATURES in roles.ts (WS08 step 8).',
      'created_by in the president\'s list (WS08 step 8).',
      'Who reaches the president\'s button (WS08 step 8).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
    expect(tagged(followUps)).toEqual([])
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of entries(list)) expect(entry).toMatch(/^- \*\*[^*]+ \(WS08 step (?:[1-9]|10)\)\.\*\* \S/)
    }
    // Each list ends with this step's entries, after WS08 step 7's.
    for (const list of [decisions, deviations, verify]) {
      const heads = entries(list).map(head)
      const first = heads.findIndex((h) => h.endsWith(TAG))
      expect(heads.slice(first).every((h) => h.endsWith(TAG))).toBe(true)
      expect(heads[first - 1]).toMatch(/\(WS08 step 7\)\.$/)
    }
  })

  it('says in the decisions and the deviation what each decides and departs from', () => {
    const [label, line, lists] = tagged(decisions)
    for (const piece of [
      'wherever a page draws the role\'s label while `standingDirectors` is on', 'one getter in `ROLE_LABELS`, read each time a page draws it', 'granted and taken on the Members page by an LCA admin (Q4)',
      'Two places name the role in words of their own and read no label', 'the group email\'s audience list, "Tournament directors", which keeps its words, a question for K',
    ]) {
      expect(label, piece).toContain(piece)
    }
    expect(label).not.toContain('no page keeps a label of its own')
    for (const piece of [
      'Today\'s Members page has no Roles & access screen, which the admin home part builds', 'stands beside the select of each member who holds the role',
      'as visible text that is the select\'s description', 'no option of the select carries a title',
      'as Q4\'s map item and the decision "Q4: the role is today\'s tournament_director (WS08 step 1)" set it', 'a title reaches a mouse alone, never a keyboard or a touch screen',
      'The plan for this step named the option\'s title', 'the words the plan\'s notes held until Tuesday, November 3, 2026',
    ]) expect(line, piece).toContain(piece)
    for (const piece of [
      'both were read signed out, so neither held a draft or `created_by`', '`getTournaments({ signedIn: true })`', 'every row for the president', 'Everyone else\'s list is read as today.',
      'the president\'s the listed events and the president\'s own drafts, never another person\'s draft, though the answer gives an observer every draft on the site',
    ]) {
      expect(lists, piece).toContain(piece)
    }
    const [lcaRun] = tagged(deviations)
    for (const piece of ['"Always" under Create', 'draws no club picker for a view-only reader', 'the wizard sends no `clubId` and the president\'s event is LCA-run', 'the create refuses a club for the president as well (WS08 step 3)', 'asks an LCA admin']) {
      expect(lcaRun, piece).toContain(piece)
    }
  })

  it('gives in its verify items the lines and the files each one read', () => {
    const [anchors, pins, features, createdBy, reach] = tagged(verify)
    for (const piece of ['`getMe` at lines 46 to 56 of `src/areas/membership/api.ts`, where the plan has 44', '`tournament_director` at line 27', 'line 89 of `src/areas/admin/components/AuditLogPanel.tsx`, where the plan has 88', 'TournamentList\'s own empty note at line 133']) {
      expect(anchors, piece).toContain(piece)
    }
    for (const piece of ['with two more readers than the plan found', '`test/unit/route-audit.test.ts` (line 67)', '`test/unit/api-split-modules.test.ts` (lines 87 to 101)', 'line 115 held every module but events to no `@domain/` import', '`test/unit/api-split-tool.test.ts` (lines 484 to 490)']) {
      expect(pins, piece).toContain(piece)
    }
    for (const piece of ['where the plan left it unmeasured', '`features--b6t5tBm.js` at 685 bytes before and after', 'the main script grows by 357 bytes']) expect(features, piece).toContain(piece)
    for (const piece of ['Confirmed for the server and found missing from what the two pages asked', '(`functions/utils/events/publicAnswer.ts`, lines 73 to 79)', '(`functions/api/tournaments.ts`, lines 16 to 28)', '(`src/areas/events/api.ts`, line 146 on the base)']) {
      expect(createdBy, piece).toContain(piece)
    }
    for (const piece of ['`ADMIN_PANEL_ROLES`', 'a seat holder whose role is `member` or `lca_auditor` has no page with New tournament', 'the president keeping `lca_observer`']) expect(reach, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 8: plain language', () => {
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
})

describe('REDESIGN_STATUS.md, WS08 step 8: the date', () => {
  it('dates the record on a real day, on or after Thursday, November 5, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-05').toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 8: the figures agree', () => {
  const files = bullet(block, '- **Files.**')
  const countOf = (name: string) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+)[:,] `).exec(files)?.[1])

  it('gives unit counts that add up: the base\'s, the new files\' and the moved tests\' growth, eleven files more', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([7670, 282])
    const fresh = NEW_TESTS.map(countOf)
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    const grown = MOVED.map(([, a, b]) => a - b)
    expect(num(before) + [...fresh, ...grown].reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts as the base\'s with the new replay test\'s, one file more, since no other integration test changes', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1312, 84])
    const fresh = NEW_INTEGRATION.map(countOf)
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    expect([num(after), Number(afterFiles)]).toEqual([num(before) + fresh.reduce((a, n) => a + n, 0), Number(beforeFiles) + NEW_INTEGRATION.length])
  })

  it('gives the count of each new test file as the sum of its parts', () => {
    for (const name of [...NEW_TESTS, ...NEW_INTEGRATION]) {
      const found = new RegExp(`\`${escape(name)}\` \\((\\d+): ([^)]*)\\)`).exec(files)
      expect(found, name).not.toBeNull()
      const counts = [...found![2].matchAll(/, (\d+)(?=;|$)/g)].map((m) => Number(m[1]))
      expect(counts.length, name).toBeGreaterThan(1)
      expect(counts.reduce((a, n) => a + n, 0), name).toBe(Number(found![1]))
    }
  })

  it('gives the browser run as one run whose counts add up, the lint figures as the base\'s with the new files added, and the main script\'s growth as its two sizes\' difference', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(835)
    // The fixture is JSON, which the lint does not read; every other new file it does, the integration test among them.
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_TESTS.length + NEW_INTEGRATION.length)
    const build = bullet(block, '- **Build.**')
    const before = /`index-Ci_BhDMR\.js` ([\d,]+) bytes/.exec(build)
    const after = /`index-Ba2tMNJJ\.js` at ([\d,]+) bytes/.exec(build)
    expect(num(after![1]) - num(before![1])).toBe(357)
    expect(tagged(verify).find((l) => head(l).startsWith('FEATURES in roles.ts'))).toContain(`grows by ${num(after![1]) - num(before![1])} bytes`)
  })
})
