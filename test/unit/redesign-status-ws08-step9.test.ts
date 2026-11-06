// test/unit/redesign-status-ws08-step9.test.ts
//
// REDESIGN_STATUS.md records WS08 step 9, the third step of checkpoint L:
// the new event in today's manage page for its creator, behind
// standingDirectors, with view-only lifted on an event the person directs,
// the Danger zone for the creator of an unpublished draft with no entries,
// and the wizard's refresh of the signed-in member before it navigates.
// Like the record tests of WS08 steps 1 to 8, this file reads only the WS08
// section and the lines the step wrote elsewhere, the date at the start of
// the date line and the sentence that ends WS02 step 2's follow-up on
// signed-in pages, never every table row or heading of the file, and it
// reads no count or figure from the code: the counts and the bytes the block
// gives are pinned here as text. Pinned here: the step's block, after WS08
// step 8's and before the four lists, with its parts in order, every file it
// names and figures that agree with each other; the Status line's tail while
// this step is the latest; the PR line, as WS08 step 7 left it; the three
// sentences this step adds to the map, each held by its order, so the
// sentences later steps add may stand beside them; this step's entries in
// the deviations and the verify items, together, and none in the decisions
// or the follow-ups; the sentence at the end of WS02 step 2's follow-up; the
// plain-language rules over everything the step wrote; and the date.
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
const TAG = '(WS08 step 9).'
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
  '### WS08 step 8: New tournament on today\'s pages, the standing director\'s label and the two calls behind them',
]
const STEP = '### WS08 step 9: the manage page for the event\'s creator, and the wizard\'s refresh before it opens'
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
const TAIL = 'steps 1 to 9 are built.'
/** The highest step with a block of its own in the section: a later step owns the Status line's tail. */
const latestStep = Math.max(0, ...[...ws08.matchAll(/^### WS08 step (\d+): /gm)].map((m) => Number(m[1])))
/** The PR line as WS08 step 7 left it, which stays until WS08 step 10 opens checkpoint L's pull request. */
const PR_LINE =
  '**PR:** checkpoint J (steps 1 to 3) was draft pull request 123, merged into `main` as `73943e1` on Wednesday, November 4, 2026; ' +
  'checkpoint K (steps 4 to 6) was draft pull request 124, merged into `main` as `9d3b13b` on Thursday, November 5, 2026; ' +
  'checkpoint L (steps 7 to 10) opens as a draft pull request after WS08 step 10, each merged on its own.'

/** The sentence AC12 gains, in the plan's words. */
const BUILT = 'Built in WS08 step 9: the manage page for the creator, through their director row.'
/** The opening of the sentence Q11 and WS02's follow-up item gain. */
const PROVED = 'Proved in WS08 step 9 by `test/unit/manage-page-creator.test.tsx` and `test/unit/wizard-refresh.test.tsx`: '
const FOLLOW_ITEM = 'WS02\'s follow-up on signed-in pages in the browser tests'
/**
 * Each sentence with its item, the words of the sentence it follows and the words it stands in front of. Only the order is held, so a
 * later step's sentence may stand between either and its neighbours.
 */
const MAP_SENTENCES: ReadonlyArray<readonly [string, string, string, string]> = [
  ['AC12', BUILT, 'Built in WS08 step 8: ', 'Proved in WS08 step 3 by '],
  ['Q11', PROVED, 'Built in WS08 step 8: ', 'Planned: WS08 step 9.'],
  [FOLLOW_ITEM, PROVED, 'and the pages join the browser tests with the console part.', 'Planned: WS08 step 9.'],
]
/** The sentence that ends WS02 step 2's follow-up on signed-in pages, outside the WS08 section. */
const WS02_HEAD = '- **Signed-in pages and states in the browser tests (WS02 step 2).**'
const WS02_SENTENCE =
  'For WS08\'s part, as WS08 step 9 records: what the first part of WS08 changes on `/workspace`, `/admin` and `/admin/tournaments/:id` is proved in jsdom, and those pages join `test/a11y/scopes.spec.ts` when WS08\'s console part rebuilds them.'
const ws02FollowUp = status.split('\n').find((l) => l.startsWith(WS02_HEAD)) ?? ''

/** The files this step adds: the two tests of the manage page and the wizard, the test of the manage page's edges, and this record's test. */
const NEW_TESTS = [
  'test/unit/manage-page-creator.test.tsx', 'test/unit/manage-page-creator-edges.test.tsx', 'test/unit/wizard-refresh.test.tsx',
  'test/unit/redesign-status-ws08-step9.test.ts',
]
/** The new test beyond the step's list, of the step's parts at their edges. */
const EDGES = 'test/unit/manage-page-creator-edges.test.tsx'
/** The files of code and record this step changes. */
const CHANGED = ['src/pages/TournamentManagePage.tsx', 'src/lib/viewOnly.tsx', 'src/areas/admin/components/TournamentWizard.tsx', 'REDESIGN_STATUS.md']
/** The tests whose pins this step moves, each named among the changed files with its count, which does not move. */
const MOVED: ReadonlyArray<readonly [string, number]> = [
  ['test/unit/workspace-new-tournament.test.tsx', 11],
  ['test/unit/admin-president-new-tournament.test.tsx', 10],
  ['test/unit/president-directors-rule.test.tsx', 12],
  ['test/unit/redesign-status-ws08-step5-claims.test.ts', 18],
]
const DEVIATIONS = [
  'The wizard refreshes the member before it navigates, only with the switch on (WS08 step 9).',
  'The view-only helpers take an explicit prop (WS08 step 9).',
]
const VERIFIED = [
  'The anchors on the base (WS08 step 9).',
  'The president is view-only on the manage page today (WS08 step 9).',
  'The route guard, a fresh director row and the refresh\'s cost (WS08 step 9).',
  'The Danger zone\'s reads (WS08 step 9).',
  'WS02 step 2\'s follow-up and the WS08 follow-ups (WS08 step 9).',
  'The closed pins this step meets (WS08 step 9).',
]
/** The follow-up the plan names, which every place in the list of follow-ups would move a closed pin for, so a judgement call carries it. */
const FOLLOW_UP_HEAD = '**The signed-in pages join the browser tests with the console part (WS08 step 9).**'
/** The follow-up WS08 step 1 carried from WS02 and tagged with this step, the one it takes; this step leaves it as WS08 step 1 wrote it. */
const CARRIED =
  '- **From WS02: signed-in pages in the browser tests (WS08 step 9).** "Signed-in pages and states in the browser tests (WS02 step 2)", its WS08 part: ' +
  'what this part changes on `/workspace`, `/admin` and the manage page is proved in jsdom, and WS08 step 9 hands the pages to the console part, with which they join the browser tests.'
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
  block, ...tagged(deviations), ...tagged(verify), statusLine.slice(STATUS_PREFIX.length),
  sentenceIn(mapItem('AC12'), BUILT, 'Proved in WS08 step 3 by '), sentenceIn(mapItem('Q11'), PROVED, 'Planned: WS08 step 9.'),
  sentenceIn(mapItem(FOLLOW_ITEM), PROVED, 'Planned: WS08 step 9.'), ws02FollowUp.includes(WS02_SENTENCE) ? WS02_SENTENCE : '', date?.[0] ?? '',
]

describe('REDESIGN_STATUS.md, WS08 step 9: the step block', () => {
  it('sits after WS08 step 8\'s block and before the four lists, once, under a heading in the record\'s form', () => {
    const at = [MAP, ...BEFORE, STEP, ...LISTS].map((h) => ws08.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws08.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(STEP).toMatch(/^### WS08 step 9: \S/)
    expect(sectionLines.filter((l) => /^### Step\b/.test(l))).toEqual([])
    expect(sectionLines.filter((l) => l.startsWith('|'))).toEqual([])
    // The third step of checkpoint L: its section and its pull request's text come with WS08 step 10.
    expect(sectionLines.filter((l) => l.startsWith('### Checkpoint L'))).toEqual(latestStep < 10 ? [] : sectionLines.filter((l) => l.startsWith('### Checkpoint L')))
  })

  it('opens by naming the step and its checkpoint, and says what a visitor sees, by switch', () => {
    const first = block.split('\n')[2] ?? ''
    expect(first.startsWith('WS08 step 9 is the third step of checkpoint L.')).toBe(true)
    for (const piece of [
      'behind `standingDirectors`', 'the president working through the director row the create wrote',
      'stays view-only on every other event', 'the creator of an unpublished draft with no entries sees the Danger zone in today\'s words',
      'every entry counted as the server\'s delete counts them', 'the wizard reads the signed-in member again after a create and before it navigates',
      'With every switch off the manage page and the wizard are today\'s and no request follows a create', 'what a visitor sees, by switch, is nothing new',
      'the payout panel comes with WS08 step 10',
    ]) expect(first, piece).toContain(piece)
  })

  it('has every part, in order, each once', () => {
    const parts = [
      '- **Files.**', '- **The manage page.**', '- **The refresh.**', '- **What ships with every switch off.**',
      '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const p of parts) expect(block.split('\n').filter((l) => l.startsWith(p)), p).toHaveLength(1)
  })

  it('names every file it adds and changes, the new ones as new, each test with its count, the five beyond the plan\'s seven, and no other file', () => {
    const files = bullet(block, '- **Files.**')
    const fresh = files.slice(files.indexOf('New: '), files.indexOf(' Changed: '))
    for (const name of NEW_TESTS) expect(fresh, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    const changed = files.slice(files.indexOf(' Changed: '))
    for (const name of CHANGED) expect(changed, name).toContain(`\`${name}\``)
    for (const [name, count] of MOVED) expect(changed, name).toMatch(new RegExp(`\`${escape(name)}\` \\(${count}, as before: Pins moved, below\\)`))
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const [name] of MOVED) expect(beyond, name).toContain(`\`${name}\``)
    expect(beyond).toContain(`and one new test of the step's parts at their edges, \`${EDGES}\`.`)
    expect(beyond).toContain('Twelve files in all, where the plan counted seven.')
    expect(NEW_TESTS.length + CHANGED.length + MOVED.length).toBe(12)
    for (const piece of [
      'No other file is added or changed: nothing under `functions/`, `domain/`, `migrations/`, `workers/`, `scripts/` or `scanner/`',
      'nor `src/lib/features.ts`, `src/contexts/AuthContext.tsx`, `src/components/auth/RoleProtectedRoute.tsx`, `src/hooks/useViewOnly.ts`',
      '`test/a11y/baseline.json`, `package.json` or the lock file',
    ]) expect(files, piece).toContain(piece)
  })

  it('gives the manage page: the lift for an event the person directs, the prop, the Danger zone and its count, the server deciding, and the way back', () => {
    const page = bullet(block, '- **The manage page.**')
    for (const piece of [
      '`const viewOnly = useViewOnly() && !(FEATURES.standingDirectors && !!id && directedTournamentIds.includes(id))`',
      'lifts view-only for an event the person directs and for no other', 'stays view-only on every event they do not direct',
      '`ViewOnlyFieldset` and `ViewOnlyNote` in `src/lib/viewOnly.tsx` take an optional `viewOnly` prop that, when passed, replaces the hook\'s answer',
      'passes `viewOnly={viewOnly}` at its four places', 'every other caller', 'passes none and reads the hook as before',
      '`canManageTournament` (`functions/utils/admin/permissions.ts`) admits an observer with a director row',
      '`creatorMayDelete`, `FEATURES.standingDirectors && !!tournament && !!authMember && tournament.created_by === authMember.id && tournament.is_visible === 0 && entryCount === 0`',
      '`(myRole === \'lca_admin\' || creatorMayDelete) &&`', '`entryCount` is new state set in `splitRoster`',
      'waitlisted and withdrawn entries included, as the delete\'s `SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?` counts them',
      'either would show the zone on a draft whose only entry is waitlisted, or withdrawn, and the delete would be refused',
      'The zone\'s words are unchanged, and the server decides', '`canDeleteDraft` (`domain/events/creation.ts`) refuses anyone else',
      'The two comments that said the zone is `lca_admin` only now say who sees it and that the server decides, without their dashes',
      '`backHref` sends the president to `/admin/tournaments` and a standing director to `/workspace?tab=events`',
    ]) expect(page, piece).toContain(piece)
  })

  it('gives the refresh: gated, awaited before the navigation, after a create the server took, and what it costs with the switch on', () => {
    const refresh = bullet(block, '- **The refresh.**')
    for (const piece of [
      '`if (FEATURES.standingDirectors) await refreshMember()`', 'after `adminCreateTournament` answers and before `navigate`',
      'with `refreshMember` from `useAuth`, which the wizard now imports with `FEATURES`',
      '`canAccessTournament` in `src/components/auth/RoleProtectedRoute.tsx`', 'which the sign-in context read at sign-in',
      'WS08 step 8\'s judgement call on the standing director\'s way to the manage page is now met',
      'The refresh is gated, never unconditional', 'the guard draws "Loading..." in place of the page meanwhile',
      'every LCA admin\'s and club rep\'s create blink the page to "Loading..." (0.2, Q34)', 'a failed `GET /api/me` at that moment would leave the member `null`',
      'With the switch off a create is followed by the navigation and by no request at all',
      'its cost, a judgement call below, is what a creator sees between the create and the manage page: the one "Loading..." the guard draws while the member is read',
      'and then the page that holds the wizard, the Workspace page or Admin › Tournaments, drawn once more at its own address, where it reads its lists again, before the manage page draws',
      'inside React\'s `startTransition` (`BrowserRouter` in react-router 7.18.1, which `src/main.tsx` draws, and `MemoryRouter` the same)',
      'so React draws the member first, at the old address', 'a refused create keeps the wizard and its words, with no refresh',
    ]) expect(refresh, piece).toContain(piece)
  })

  it('says nothing a visitor sees ships with every switch off, and names the four pins it moves with their old and new expectations', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Nothing a visitor sees or hears.')).toBe(true)
    for (const piece of [
      'The lift, the Danger zone and the refresh each read `standingDirectors` through `FEATURES`',
      'the president is view-only on every event with today\'s note, the Danger zone is an LCA admin\'s alone, and a create is followed by the navigation and by no request',
      'as `test/unit/manage-page-creator.test.tsx` and `test/unit/wizard-refresh.test.tsx` hold through a stub of `fetch`',
      'the stylesheet and the switches chunk are the same, name for name and byte for byte', '`test/a11y/baseline.json` is unchanged',
      'No server file changes', 'the paths `deploy-worker.yml` watches',
    ]) expect(ships, piece).toContain(piece)
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins.startsWith('- **Pins moved.** Four, each a pin on the tree\'s live code and none on words a record wrote:')).toBe(true)
    for (const piece of [
      'gave a sign-in context with no `refreshMember`', 'now gives `refreshMember: async () => {}` beside its other values', '(11, 10 and 12 cases, as before)',
      'held that the Danger zone\'s one Delete button sits under `myRole === \'lca_admin\' &&`, drawn for an LCA admin alone',
      'now holds it under `(myRole === \'lca_admin\' || creatorMayDelete) &&`, with `creatorMayDelete` reading `FEATURES.standingDirectors` first',
      'the WS08 step 5 record\'s words stay as they were (18 cases, as before)', 'WS08 step 5\'s judgement call left showing the delete to a creator to the pages, with Q11 in WS08 step 9',
      'No other test\'s exact list, count, line number or fixture moves',
    ]) expect(pins, piece).toContain(piece)
  })

  it('gives its judgement calls, the follow-up the plan names among them, the lint as unchanged, the build file by file against the base, and each figure of the checks once', () => {
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
    expect(calls.split('\n').filter((l) => l.startsWith(`  - ${FOLLOW_UP_HEAD} `))).toHaveLength(1)
    for (const piece of [
      'With the switch on, every create reads the member once more', 'the console part\'s setup checklist replaces the wizard',
      'that page is then drawn once more at its own address, since the router\'s move waits in a transition while the refreshed member is drawn at once',
      'the Workspace page its list and the creation answer, Admin › Tournaments the creation answer, the list and the clubs',
      'in a tab that has not loaded it yet the router keeps the page drawn again on screen, its list with it, until the code has loaded',
      '`test/unit/wizard-refresh.test.tsx` holds the second draw and the second reads on both pages, and the wait on the Workspace page',
      'Navigating first and awaiting the refresh after would leave the guard\'s "Loading..."', 'so that order is K\'s to choose',
      'react-router 7.18.1 marks a navigate ready once its component has drawn and never unmarks it', 'a real browser on a preview with the switch on is K\'s to check',
      'with the router\'s `useNavigate` wrapped so that each navigate is noted when it is called',
      'the president after an LCA admin has removed their director row', 'The page reads no grant',
      'The delete\'s way out is today\'s, `navigate(\'/admin/tournaments\')`',
      'The comments of the files this step touches lose their dashes and the old initials for US Chess',
      'stand in their lists before WS08 step 7\'s entries, not after WS08 step 8\'s', 'no decision is written',
      'every place in the list of follow-ups moves a pin of a closed record test, as WS08 steps 6, 7 and 8 found, and nothing has changed since',
      'the pages join `test/a11y/scopes.spec.ts` when the console part rebuilds them',
      'The four questions for K that WS08 step 8 wrote, and the open questions of WS08 steps 3, 4 and 6, stay as recorded',
      'The Status line\'s tail is "steps 1 to 9 are built."',
    ]) expect(calls, piece).toContain(piece)
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      '`366e682`', '`index-Ba2tMNJJ.js` 550,171 bytes', '`index-Dxhkeo-q.css` 130,292 bytes', '`features--b6t5tBm.js` 685 bytes',
      '`index-uLjVexnt.js` at 550,171 bytes', 'the stylesheet and the switches chunk the same, name for name and byte for byte',
      '`TournamentManagePage-B-2E_3ch.js`, 85,355 bytes, is `TournamentManagePage-C2qXRiSE.js` at 85,595',
      'the chunk that holds the wizard, `TournamentList-pBX08-Yr.js`, 41,711 bytes, is `TournamentList-CopWruIB.js` at 41,774',
      '`viewOnly-C00s3MKF.js`, 512 bytes, is `viewOnly-Dgd8mzC_.js` at 556',
      '`AdminPage-1yltLaje.js` is `AdminPage-CPPPWw2l.js`', '`WorkspacePage-BqU2w0-t.js` is `WorkspacePage-BAhV_1Q8.js`',
      '53 files of `dist/assets` take new names in all, those three and 50 others whose only change is the names of the files they import, each the same size',
      '`index.html` names the new main script', 'the other 173 files of `dist` are the same, name for name and byte for byte',
    ]) expect(build, piece).toContain(piece)
    // The 50 that keep their size are named one by one, by their names before the hash.
    const named = between(build, 'each the same size: ', '; `index.html`')
    expect([...named.matchAll(/`[A-Za-z]+`/g)]).toHaveLength(50)
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 9: the lines outside the block', () => {
  it('keeps the Status line\'s fixed prefix and gives it this step\'s tail while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(9)
    if (latestStep === 9) expect(tail).toBe(TAIL)
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
    expect(mapItem('Q11').endsWith('Planned: WS08 step 9.')).toBe(true)
    expect(mapItem(FOLLOW_ITEM).endsWith('Planned: WS08 step 9.')).toBe(true)
    expect(mapItems.filter((l) => l.includes('in WS08 step 9')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['AC12', 'Q11', FOLLOW_ITEM])
  })

  it('proves Q11 as its item words it: the creator works through their director row, the Danger zone counts every entry, and the switch off is today\'s', () => {
    const proved = sentenceIn(mapItem('Q11'), PROVED, 'Planned: WS08 step 9.')
    for (const piece of [
      'the president, who directs the event they created, finds today\'s manage page open to change on its three tabs with no View only note',
      'an observer who does not direct the event stays view-only', 'the creator of an unpublished draft with no entries sees the Danger zone in today\'s words',
      'every entry counted as the server\'s delete counts them, so a waitlisted or a withdrawn entry hides it',
      'a one-event director who did not create the event never sees it', 'so the site\'s own guard admits a standing director to the new event',
      'with the switch off the page and the wizard are today\'s, and a create is followed by no request', 'the first phase ships on today\'s pages',
    ]) expect(proved, piece).toContain(piece)
  })

  it('ends WS02 step 2\'s follow-up on signed-in pages with its one sentence, and leaves the rest of that line as it was', () => {
    expect(ws02FollowUp.endsWith(` ${WS02_SENTENCE}`)).toBe(true)
    expect(ws02FollowUp.split(WS02_SENTENCE)).toHaveLength(2)
    expect(ws02FollowUp).toContain('WS01\'s follow-up on the pages AC1 does not name stays as it is.')
    expect(ws02FollowUp.indexOf('WS01\'s follow-up on the pages AC1 does not name stays as it is.')).toBeLessThan(ws02FollowUp.indexOf(WS02_SENTENCE))
  })
})

describe('REDESIGN_STATUS.md, WS08 step 9: the four lists', () => {
  it('records its two deviations and its six verify items, each tagged and each verify item confirmed, together in each list, and no decision or follow-up of its own', () => {
    expect(tagged(deviations).map(head)).toEqual(DEVIATIONS)
    expect(tagged(verify).map(head)).toEqual(VERIFIED)
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
    expect(tagged(decisions)).toEqual([])
    // The one follow-up tagged with this step is the one WS08 step 1 carried for it, word for word as WS08 step 1 wrote it.
    expect(tagged(followUps)).toEqual([CARRIED])
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of entries(list)) expect(entry).toMatch(/^- \*\*[^*]+ \(WS08 step (?:[1-9]|10)\)\.\*\* \S/)
    }
    // This step's entries stand together in each list.
    for (const list of [deviations, verify]) {
      const heads = entries(list).map(head)
      const first = heads.findIndex((h) => h.endsWith(TAG))
      const count = heads.filter((h) => h.endsWith(TAG)).length
      expect(heads.slice(first, first + count).every((h) => h.endsWith(TAG))).toBe(true)
    }
  })

  it('says in the deviations what each departs from, and gives in its verify items the lines and the files each one read', () => {
    const [refresh, prop] = tagged(deviations)
    for (const piece of [
      '"whose access check admits its directors, its creator among them"', 'the site reads the events a person directs once, at sign-in',
      'with `standingDirectors` on alone', 'which with every switch off would be a change every LCA admin and club rep sees at each create (Q34)',
      'one "Loading..." between the create and the manage page, for every creator',
      'and then the page that holds the wizard drawn once more at its own address, its lists read again',
    ]) expect(refresh, piece).toContain(piece)
    for (const piece of ['`ViewOnlyFieldset` and `ViewOnlyNote` (`src/lib/viewOnly.tsx`) read the role alone', 'replaces the hook\'s answer', 'every other caller passes none']) {
      expect(prop, piece).toContain(piece)
    }
    const [anchors, president, guard, zone, follow, pins] = tagged(verify)
    for (const piece of [
      'Confirmed on `366e682`', 'the function is at lines 159 to 193, with `setMemberLoading(true)` at line 168 and the catch that sets the member to `null` at line 175',
      '`RoleProtectedRoute` draws "Loading..." at lines 54 to 60', 'at line 2945 of this file, where the plan has 2944',
      'the three fieldsets at 1151, 1497 and 1882', 'the wizard\'s `handleCreate` is at lines 546 to 573, `adminCreateTournament` at 550 and `navigate` at 568',
    ]) expect(anchors, piece).toContain(piece)
    for (const piece of ['`isViewOnlyAdmin(role)`, true for `lca_observer` and `lca_officer`', 'the president could create an event and change nothing on it', '(`functions/utils/admin/permissions.ts`, line 58)']) {
      expect(president, piece).toContain(piece)
    }
    for (const piece of [
      '(`src/components/auth/RoleProtectedRoute.tsx`, lines 21 to 31)', '(`loadMemberProfile`, lines 101 to 107)', 'The wizard imported neither `useAuth` nor `FEATURES` (lines 7 to 26)',
      '`upsertMemberFromAuth` in `functions/utils/admin/members.ts`',
      '(`node_modules/react-router/dist/development/chunk-G5KIBF6U.js`, line 293, for `BrowserRouter`, which `src/main.tsx` draws with no `useTransitions`, and `chunk-SA4DP3SF.js`, line 9835, for `MemoryRouter`)',
    ]) {
      expect(guard, piece).toContain(piece)
    }
    for (const piece of ['(lines 452 to 456)', '`SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?`, line 308 of `functions/api/admin/tournaments/[id].ts`', 'its waitlist the withdrawn ones']) {
      expect(zone, piece).toContain(piece)
    }
    for (const piece of ['`test/unit/redesign-status-ws02-step2.test.ts` (line 237)', 'no closed record test holds its end', 'WS08 step 1\'s record test holds its first ten heads']) {
      expect(follow, piece).toContain(piece)
    }
    for (const piece of ['WS08 step 8\'s record test (lines 439 to 445 on the base)', 'WS08 step 5\'s claims test (lines 455 to 480 on the base)', 'a sign-in context that gives no `refreshMember`']) {
      expect(pins, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS08 step 9: plain language', () => {
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
    for (const file of NEW_TESTS) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
  })
})

describe('REDESIGN_STATUS.md, WS08 step 9: the date', () => {
  it('dates the record on a real day, on or after Thursday, November 5, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-05').toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 9: the figures agree', () => {
  const files = bullet(block, '- **Files.**')
  const countOf = (name: string) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+)[:,] `).exec(files)?.[1])

  it('gives unit counts that add up: the base\'s and the new files\', four files more, since the moved tests keep their counts', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([7789, 293])
    const fresh = NEW_TESTS.map(countOf)
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    for (const [name, count] of MOVED) expect(countOf(name), name).toBe(count)
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

  it('gives the browser run as one run whose counts add up, the lint figures as the base\'s with the new files added, and each chunk\'s growth as its two sizes\' difference', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), no error in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(847)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_TESTS.length)
    const build = bullet(block, '- **Build.**')
    const grew = (from: string, to: string) => {
      const found = new RegExp(`\`${escape(from)}\`, ([\\d,]+) bytes, is \`${escape(to)}\` at ([\\d,]+)`).exec(build)
      expect(found, `${from} to ${to}`).not.toBeNull()
      return num(found![2]) - num(found![1])
    }
    expect(grew('TournamentManagePage-B-2E_3ch.js', 'TournamentManagePage-C2qXRiSE.js')).toBe(240)
    expect(grew('TournamentList-pBX08-Yr.js', 'TournamentList-CopWruIB.js')).toBe(63)
    expect(grew('viewOnly-C00s3MKF.js', 'viewOnly-Dgd8mzC_.js')).toBe(44)
  })
})
