// test/unit/redesign-status-ws08-step5.test.ts
//
// REDESIGN_STATUS.md records WS08 step 5, the second step of checkpoint K:
// D21 on the directors endpoint, the creator's delete with its row in the
// activity log, and README.md's Safe previews section said as ordering rule 2
// says it. Like the record tests of WS08 steps 1 to 4, this file reads only
// the WS08 section and the one piece of the date line the step writes, the
// date, never every table row or heading of the file, and it reads no count
// or figure from the code. Pinned here: the step's block, after WS08 step 4's
// and before the four lists, with its parts in order, every file it names and
// figures that agree with each other; the Status line's tail while this step
// is the latest; the PR line as it stands until checkpoint K's pull request
// opens; the two sentences this step adds to the map; its entries in the
// decisions, deviations and verify items, no follow-up of its own, and the
// sentence that ends WS08 step 4's follow-up on the README; the
// plain-language rules over everything the step wrote; and the date. The
// files the step touches are read only to find them and hold them to the
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
const TAG = '(WS08 step 5).'
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
const STEP4 = '### WS08 step 4: the entry fee rule on a save'
const STEP = '### WS08 step 5: the president names a one-event director, and a creator deletes a draft'
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
const followUp = (name: string) => entries(followUps).find((l) => head(l) === name) ?? ''
/** What this step added to an older line: from `from` to the end of the line. */
const closing = (line: string, from: string) => (line.includes(from) ? line.slice(line.indexOf(from)) : '')

/** The Status line up to and including its last fixed words, which WS08 step 1 set and every step keeps. */
const STATUS_PREFIX = '**Status:** in progress: the first part, tournament creation, ten steps in three checkpoints (checkpoint J for steps 1 to 3, checkpoint K for 4 to 6, checkpoint L for 7 to 10); '
/** The tail this step writes. */
const TAIL = 'steps 1 to 5 are built.'
/** The highest step with a block of its own in the section: a later step owns the Status line's tail. */
const latestStep = Math.max(0, ...[...ws08.matchAll(/^### WS08 step (\d+): /gm)].map((m) => Number(m[1])))

const DIRECTORS = '`test/integration/directors.test.ts`'
const DIRECTORS_EDGES = '`test/integration/directors-edges.test.ts`'
const CREATE = '`test/integration/tournament-create.test.ts`'
const DELETE_EDGES = '`test/integration/tournament-delete-edges.test.ts`'
const SAFETY = '`test/integration/role-safety.test.ts`'
/** The words every map sentence of this step goes in front of. */
const PLANNED = ' Planned: WS08 step 5.'
/** The sentences this step adds to the map, each with the item it goes in. */
const SENTENCES: ReadonlyArray<readonly [string, string]> = [
  ['AC14', `Proved in WS08 step 5 by ${DIRECTORS}, ${DIRECTORS_EDGES}, ${CREATE}, ${DELETE_EDGES} and ${SAFETY}: `],
  ['D21', `Proved in WS08 step 5 by ${DIRECTORS}, ${DIRECTORS_EDGES} and ${SAFETY}: `],
]
/** AC14's sentence ends with the halves WS08 step 1 named as waiting, in this step's words. */
const AC14_ENDING = '; its console half waits for the console part, and the representative and member organizer columns for WS09 and Phase 4.'
/** A map sentence of this step: from its opening to the planned step it sits in front of. */
const sentenceOf = (id: string, opens: string) => {
  const item = mapItem(id)
  const at = item.indexOf(opens)
  const end = item.lastIndexOf(PLANNED)
  return at < 0 || end < at ? '' : item.slice(at, end)
}

/** WS08 step 4's follow-up on the README, which this step ends with one sentence. */
const README_FOLLOW_UP = 'README.md\'s Safe previews section and ordering rule 2 (WS08 step 4).'
const RESOLVED = 'Resolved in WS08 step 5: '

/** The files this step adds: its record test, and the four files of tests written once the naming and the delete were built. */
const NEW_FILES = [
  'test/unit/redesign-status-ws08-step5.test.ts',
  'test/integration/directors-edges.test.ts',
  'test/integration/tournament-delete-edges.test.ts',
  'test/unit/audit-log-delete-label.test.tsx',
  'test/unit/redesign-status-ws08-step5-claims.test.ts',
]
const NEW_UNIT = NEW_FILES.filter((name) => name.startsWith('test/unit/'))
const NEW_INTEGRATION = NEW_FILES.filter((name) => name.startsWith('test/integration/'))
/** The files of code and record this step changes. */
const CHANGED = [
  'functions/api/admin/tournaments/[id]/directors.ts', 'functions/api/admin/tournaments/[id].ts', 'functions/utils/admin/audit.ts',
  'src/areas/admin/components/AuditLogPanel.tsx', 'README.md', 'REDESIGN_STATUS.md',
]
/** The test files this step extends, each with its count written in the block. */
const CHANGED_TESTS = ['test/integration/directors.test.ts', 'test/integration/tournament-create.test.ts', 'test/integration/role-safety.test.ts']
/** The tests whose pins this step moves, each named among the changed files with its count as before. */
const MOVED = ['test/unit/goldText.test.ts', 'test/unit/preview-database.test.ts', 'test/unit/redesign-status-ws08-step4-claims.test.ts']
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
  block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), closing(followUp(README_FOLLOW_UP), RESOLVED),
  statusLine.slice(STATUS_PREFIX.length), ...SENTENCES.map(([id, opens]) => sentenceOf(id, opens)), date?.[0] ?? '',
]

describe('REDESIGN_STATUS.md, WS08 step 5: the step block', () => {
  it('sits after WS08 step 4\'s block and before the four lists, once, under a heading in the record\'s form', () => {
    const at = [MAP, STEP1, STEP2, STEP3, CHECKPOINT, STEP4, STEP, ...LISTS].map((h) => ws08.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws08.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(STEP).toMatch(/^### WS08 step 5: \S/)
    expect(sectionLines.filter((l) => /^### Step\b/.test(l))).toEqual([])
    expect(sectionLines.filter((l) => l.startsWith('|'))).toEqual([])
    // No checkpoint K section yet: WS08 step 6 writes it when the checkpoint closes.
    expect(sectionLines.filter((l) => l.startsWith('### Checkpoint K'))).toEqual(latestStep < 6 ? [] : sectionLines.filter((l) => l.startsWith('### Checkpoint K')))
  })

  it('opens by naming the step and its checkpoint, and says what a visitor sees, by switch', () => {
    const first = block.split('\n')[2] ?? ''
    expect(first.startsWith('WS08 step 5 is the second step of checkpoint K.')).toBe(true)
    for (const piece of [
      'the president names and removes one-event directors on an event the president created',
      'an event\'s creator deletes it while they still hold the grant that let them create it and it is an unpublished draft with no entries',
      'a one-event director still gets 403 on the membership switch, on naming or removing directors and on deleting',
      'with it unset, both endpoints answer, write and refuse as before', 'what a visitor sees, by switch, is nothing new',
    ]) expect(first, piece).toContain(piece)
  })

  it('has every part, in order, each once', () => {
    const parts = [
      '- **Files.**', '- **Naming.**', '- **The delete.**', '- **The table.**', '- **What ships with every switch off.**',
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
    for (const name of [...CHANGED, ...CHANGED_TESTS, ...MOVED]) expect(changed, name).toContain(`\`${name}\``)
    for (const name of CHANGED_TESTS) expect(changed, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, \\d+ before: `))
    for (const name of MOVED) expect(changed, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, as before: `))
    expect(files).toContain('No other file is added or changed: nothing under `domain/`, `migrations/`, `workers/`, `scripts/` or `scanner/`, nothing else under `src/` or `functions/`, nor `package.json` or the lock file.')
    expect(files).toContain('every case reading the stored rows after the call')
    expect(files).toContain('so no line above the delete moves')
    // The files beyond the step's list, the four files of tests written once it was built among them, each named once more.
    const beyond = files.split('\n').find((l) => l.startsWith('  - Files beyond the step\'s list: ')) ?? ''
    for (const name of [...NEW_FILES.slice(1), 'README.md', 'test/unit/preview-database.test.ts', 'test/unit/redesign-status-ws08-step4-claims.test.ts']) {
      expect(beyond, name).toContain(`\`${name}\``)
    }
  })

  it('gives the naming: one helper asked, the president on an event the president created, a club rep through repClubId, today\'s words and today\'s 404', () => {
    const naming = bullet(block, '- **Naming.**')
    for (const piece of [
      '`requireCanAssign` in `functions/api/admin/tournaments/[id]/directors.ts`, the gate of `POST` and `DELETE /api/admin/tournaments/[id]/directors`',
      'now selects the event\'s `created_by` beside its club', '`canAssignDirectors(person, { clubId, createdBy }, rolesOn)`',
      'the constant is read inside the function at each request', 'names and removes one-event directors on an event the president created, and on no other',
      'a club rep on its own club\'s events through `repClubId`, whatever the grant, so a club rep who holds the seat keeps that right',
      '"Only admins and the organizing club\'s rep can assign directors"', 'since the president, being admitted, never reads them',
      'With the constant unset `creationPerson` reads no seat', 'A missing event still answers 404 "Tournament not found" before the rule, as before',
      'so the helper decides alone, asked about the person, the event\'s club and creator and the constant the endpoint read',
    ]) expect(naming, piece).toContain(piece)
  })

  it('gives the delete: the role first, today\'s path for an admin and while the constant is unset, the creator\'s rule, one 403, and the row only while the constant is set', () => {
    const remove = bullet(block, '- **The delete.**')
    for (const piece of [
      '`onRequestDelete` in `functions/api/admin/tournaments/[id].ts` reads the role first', '`requireAuthedMember`, then the constant, read inside the handler at each request',
      'An LCA admin, and everyone while the constant is unset, goes through `requireAdmin` before anything about the event is read',
      '403 "Forbidden" for anyone but an LCA admin', 'the 403 with `mfaRequired` for an admin without two-step sign-in', '404 "Tournament not found" for a missing event',
      'the six deletes in their order', '`canDeleteDraft(person, { clubId, createdBy, isVisible, entries }, rolesOn)`',
      '`SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?`, withdrawn ones included',
      'while `canCreate` still lets them create for the event\'s club and it is an unpublished draft (`is_visible` 0) with no entries',
      'Anyone it refuses gets one 403, "Forbidden", whether the event exists or not, so the answer says nothing about a hidden draft',
      'in both branches and only while the constant is set', '`{ tournament_id, entries, was_visible, grant }`, the grant `admin` on the admin\'s branch',
      'with it unset no row is written', '`tournament_delete` joins `AdminAction` in `functions/utils/admin/audit.ts` after `tournament_unpublish`', '"Deleted event"',
      'one statement at a time, with `{ success: true }`', 'the six are one list, `EVENT_DELETES`, which both paths run',
      'The creator\'s six deletes then run in one batch, led by `draftGuard`',
      'when the event as the batch runs is published, has another club or has an entry',
      'and so does a delete that finds the draft already taken by another',
      'only from the request whose `DELETE FROM tournaments` took the event\'s row, so a delete sent twice at once is logged once',
    ]) expect(remove, piece).toContain(piece)
  })

  it('gives the table\'s cells grant by grant, the files that hold them, and what is left for later', () => {
    const table = bullet(block, '- **The table.**')
    for (const piece of [
      'brief 1.4\'s table "Who may do what on an event"', 'Name or remove directors, an LCA admin on any event, the president on an event the president drafted and not on an admin\'s',
      'a standing director no', 'a club rep its own club\'s events and not another\'s', 'a one-event director no, and no other officer',
      'the president no ("No: their events are LCA-run")',
      'Run the event, a one-event director\'s setup saves, Details with the sections and their fees sent back, Registration settings with the close time and the early and late keys, and Schedule',
      'nor when a publish, an entry or a change of club lands after the check', DIRECTORS_EDGES, DELETE_EDGES,
      'Publish, the president on their own draft and a one-event director on the event they direct',
      'Delete the event, an LCA admin any event, the president, a standing director and a club rep a draft they created, unpublished and with no entries',
      'and not once it is published, has an entry or the grant is gone', DIRECTORS, CREATE, SAFETY,
      'a standing director\'s publish, listed at once, with D22 in WS08 step 6', 'the regional representative\'s and the member organizer\'s columns, with WS09 and the Phase 4 part',
    ]) expect(table, piece).toContain(piece)
  })

  it('says nothing a visitor sees ships with every switch off, names the files of the site that change, and the worker\'s bundle', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Nothing a visitor sees or hears.')).toBe(true)
    for (const piece of [
      'so both endpoints answer, write and refuse as before', 'name a row that nothing writes until the constant is set, so the panel draws as today',
      'the filter\'s request names one more action, which matches no row', 'the Admin page\'s chunk, which holds the activity log, grows by',
      '`deploy-worker.yml` redeploys the daily-emails worker when checkpoint K merges', 'the worker imports none of the files this step changes',
    ]) expect(ships, piece).toContain(piece)
  })

  it('names the three pins it moves, each with its old and new expectation and its reason', () => {
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins.startsWith(
      '- **Pins moved.** Three: one expectation of `test/unit/goldText.test.ts` and one case of `test/unit/preview-database.test.ts`, each a pin on the tree as it stands, ' +
        'and one case of `test/unit/redesign-status-ws08-step4-claims.test.ts`, one of the record tests closed with WS08 step 4,',
    )).toBe(true)
    expect(pins.split('\n')[0]).toContain('moves because the delete reads the constant in its own handler')
    const moved = pins.split('\n').filter((l) => /^\s+- /.test(l))
    expect(moved).toHaveLength(3)
    for (const piece of [
      '`test/unit/goldText.test.ts`', '`\'src/areas/admin/components/AuditLogPanel.tsx:270 \'` to `\'src/areas/admin/components/AuditLogPanel.tsx:271 \'`',
      'at line 1246 of the test, where the plan has line 1244', 'moves the card\'s `<span` from line 270 to 271, as measured on the base and after', 'a live line number, not history',
    ]) expect(moved[0], piece).toContain(piece)
    for (const piece of [
      '`test/unit/preview-database.test.ts`', '"says K migrates the preview from the branch before each checkpoint review, not after the merge"',
      '"says the preview is migrated from the branch before anyone reviews a checkpoint\'s preview, not after the merge, by the cloud session that prepares it or by K"',
      'the one of "K runs `npm run db:migrate:preview` from the branch" to one of "The preview database is migrated from the branch before anyone reviews a checkpoint\'s preview, not after the merge"',
      'the one of "before reviewing each checkpoint\'s preview, not after the merge" to one of "`npm run db:migrate:preview` is run from the branch, from the cloud session that prepares the checkpoint or by K"',
      'the plan names one expectation, and two move with one sentence', '"never target the preview database"',
    ]) expect(moved[1], piece).toContain(piece)
    for (const piece of [
      '`test/unit/redesign-status-ws08-step4-claims.test.ts`', 'the one read of the constant in `functions/api/admin/tournaments/[id].ts`, inside `onRequestPatch`, to two',
      'one inside `onRequestPatch` and one inside `onRequestDelete`', 'the plan does not name this pin', '"the constant is read inside the handler at each request"',
      'It is the one pin of a closed record test this step moves, and a pin on the code',
    ]) expect(moved[2], piece).toContain(piece)
  })

  it('gives its judgement calls, the lint as unchanged, the build against the base, and each figure of the checks once', () => {
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(13)
    for (const piece of [
      'The delete reads the role before anything else', 'a non-admin\'s delete of an event that does not exist answers 403 "Forbidden", not 404',
      'The entries are every registrations row, withdrawn ones included', 'the entries are counted only while the constant is set, for the activity log\'s row',
      'The six deletes are one list, `EVENT_DELETES`, in today\'s order', 'the creator\'s branch runs them in one batch led by `draftGuard`',
      'The guard checks again, as the batch runs, the facts of the event that `canDeleteDraft` read and a save can change',
      'The row is written only by the request whose `DELETE FROM tournaments` took the event\'s row',
      '`requireCanAssign` keeps its 404 for a missing event before the rule',
      'The president\'s right reads the seat at each request', 'D21\'s sentence in the map names the three files that hold the naming',
      'rewrites the sections\' JSON with every rule\'s key, null or false', 'never the sections, which the plan put in it', 'No follow-up is added',
      'The README\'s last line on the preview scripts is reworded with its bullet', '"The five endpoints a former creator is refused (WS08 step 3)"',
      'keeps the dashes on five of its lines, all in what it draws', 'The manage page\'s danger zone',
    ]) expect(calls, piece).toContain(piece)
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['`1627670`', '`index-BK-tB9L4.js` 549,814 bytes', '`index-Dxhkeo-q.css` 130,292 bytes', '`features--b6t5tBm.js` 685 bytes', 'name for name and byte for byte', '`index.html` names the new main script']) {
      expect(build, piece).toContain(piece)
    }
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 5: the lines outside the block', () => {
  it('keeps the Status line\'s fixed prefix and gives it this step\'s tail while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(5)
    if (latestStep === 5) expect(tail).toBe(TAIL)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })

  it('keeps the PR line: checkpoint J merged, and the parts of checkpoint K and checkpoint L until checkpoint K\'s pull request opens', () => {
    expect(prLine).toContain('**PR:** checkpoint J (steps 1 to 3) was draft pull request 123, merged into `main` as `73943e1` on Wednesday, November 4, 2026; ')
    if (latestStep < 6) {
      expect(prLine.endsWith('checkpoint K (steps 4 to 6) opens as a draft pull request after WS08 step 6 and checkpoint L (steps 7 to 10) after WS08 step 10, each merged on its own.')).toBe(true)
    }
    expect(prLine).not.toContain('is pending')
  })

  it('adds its two sentences to the map, once each, in front of the planned step, and to no other item', () => {
    for (const [id, sentence] of SENTENCES) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.endsWith(`${sentenceOf(id, sentence)}${PLANNED}`), id).toBe(true)
      expect(sentenceOf(id, sentence).endsWith('.'), id).toBe(true)
    }
    expect(mapItems.filter((l) => l.includes('in WS08 step 5')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(SENTENCES.map(([id]) => id))
    const ac14 = sentenceOf(...SENTENCES[0])
    expect(ac14.endsWith(AC14_ENDING)).toBe(true)
    for (const piece of [
      'names a one-event director on it and removes them, and is refused naming on an event an LCA admin created',
      'Details with the sections and their fees sent back as the manage answer gave them, Registration settings with the close time and the early and late keys',
      `with the bodies today's manage page sends from each tab as ${DIRECTORS_EDGES} holds them`, 'opens registration and publishes the event',
      'is refused the membership switch, naming, removing and the delete', 'the president publishes their own draft and is refused its membership switch',
      'an officer and an observer who hold no seat, and a standing director on their own event, are refused naming',
      'deletes their unpublished draft with no entries', 'once the draft is published, once it has an entry, once the role is gone and for an event that does not exist',
      'an LCA admin deletes any event with two-step sign-in', 'with the constant unset the president\'s naming and the creators\' deletes are refused, as today',
      'when a publish, an entry or a change of club lands after the check', 'a delete sent twice at once is logged once',
    ]) expect(ac14, piece).toContain(piece)
    const d21 = sentenceOf(...SENTENCES[1])
    for (const piece of [
      '`requireCanAssign` asks `canAssignDirectors` about the person `creationPerson` reads', 'and nothing else in the endpoint decides',
      'with the helper made to refuse an LCA admin and the organizing club\'s rep are turned away and made to allow a plain member names',
      'a club rep who holds the President seat among them', 'with it unset the president is refused, as today',
      `as ${DIRECTORS_EDGES} holds for every person against every kind of event in both states`,
    ]) expect(d21, piece).toContain(piece)
    // WS08 step 1's own words of the two items stand in front of the new sentences.
    expect(mapItem('AC14')).toContain('The director using the console waits for the console part')
    expect(mapItem('D21')).toContain('no other officer, and never a standing director. Built in WS08 step 1: the rule, in `domain/events/creation.ts`. Proved in WS08 step 5 by')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 5: the four lists', () => {
  it('records its two decisions, its two deviations and its five verify items, each tagged and each verify item confirmed', () => {
    expect(tagged(decisions).map(head)).toEqual(['D21: who names a one-event director (WS08 step 5).', 'An admin\'s delete keeps its two-step sign-in (WS08 step 5).'])
    expect(tagged(deviations).map(head)).toEqual([
      'The delete\'s audit row is new and waits for the constant (WS08 step 5).',
      'Contracts for DELETE and the directors endpoints wait for the console part (WS08 step 5).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'The audit panel\'s label map (WS08 step 5).',
      'DELETE today (WS08 step 5).',
      'The CORS methods line (WS08 step 5).',
      'requireAdmin after requireAuthedMember (WS08 step 5).',
      'The one 403 for a missing event (WS08 step 5).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of entries(list)) expect(entry).toMatch(/^- \*\*[^*]+ \(WS08 step (?:[1-9]|10)\)\.\*\* \S/)
    }
    const [d21, signIn] = tagged(decisions)
    for (const piece of [
      'the president on events the president drafted, read from `created_by`', 'no other officer does', '`canAssignDirectors` in `domain/events/creation.ts`',
      'the endpoint names no role', '"Only admins and the organizing club\'s rep can assign directors"',
    ]) expect(d21, piece).toContain(piece)
    for (const piece of ['goes through `requireAdmin`', 'answers the 403 with `mfaRequired` without it, in both states', 'A creator\'s delete of their own draft asks none']) {
      expect(signIn, piece).toContain(piece)
    }
    const [row, contracts] = tagged(deviations)
    for (const piece of [
      'nothing recorded a delete before this step', 'written only while `CREATION_ROLES_ON` is set', 'for an LCA admin\'s delete as for a creator\'s',
      'The row is written once for each event deleted, by the request whose `DELETE FROM tournaments` took the event\'s row.',
    ]) expect(row, piece).toContain(piece)
    for (const piece of ['`PENDING_COUNT` 110', '`DELETE admin/tournaments/[id]` keeps its line, line 71 of the file', 'the three directors lines theirs, lines 73 to 75', 'leaves these for the console part, which rewrites them']) {
      expect(contracts, piece).toContain(piece)
    }
    expect(tagged(verify)[1]).toContain('at lines 289 to 308 of `functions/api/admin/tournaments/[id].ts` on the base, where the plan has 237 to 256')
  })

  it('writes no follow-up of its own, and ends WS08 step 4\'s follow-up on the README with one sentence at its end', () => {
    expect(tagged(followUps)).toEqual([])
    const entry = followUp(README_FOLLOW_UP)
    expect(entry).not.toBe('')
    expect(entry.split(RESOLVED)).toHaveLength(2)
    expect(entry).toContain('`test/unit/preview-database.test.ts` holds the section\'s words')
    const resolved = closing(entry, RESOLVED)
    for (const piece of [
      'migrated from the branch before anyone reviews a checkpoint\'s preview, not after the merge',
      'from the cloud session that prepares the checkpoint or by K with K\'s own Cloudflare credentials, and never against production', 'as ordering rule 2 does',
      'its last line says the preview scripts run only by hand', '`test/unit/preview-database.test.ts` holds the new words',
    ]) expect(resolved, piece).toContain(piece)
    expect(resolved.endsWith('holds the new words.')).toBe(true)
  })

  it('says in README.md what the record says: the words ordering rule 2 reads, K never as he or his, and no claim that only K runs the preview scripts', () => {
    const readme = read('README.md')
    const start = readme.indexOf('### Safe previews')
    const safe = readme.slice(start, readme.indexOf('\n### ', start + 1)).replace(/\s+/g, ' ')
    for (const piece of [
      'The preview database is migrated from the branch before anyone reviews a checkpoint\'s preview, not after the merge',
      '`npm run db:migrate:preview` is run from the branch, from the cloud session that prepares the checkpoint or by K with K\'s own Cloudflare credentials, and never against production',
      'the preview scripts run only by hand, from the cloud session that prepares a checkpoint or by K',
    ]) expect(safe, piece).toContain(piece)
    expect(safe).not.toMatch(/\b(?:he|his|him)\b/i)
    expect(safe).not.toContain('only K runs')
    expect(safe).not.toMatch(DASHES)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 5: plain language', () => {
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

  it('keeps every file the step adds or changes free of a dash, a tool\'s name, the two letters on their own and the old initials, reading the two files with today\'s words in the lines this step wrote', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_TESTS, ...MOVED]) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      if (file === 'REDESIGN_STATUS.md') continue
      const whole = read(file)
      // README.md keeps today's words outside its Safe previews section, which the case above reads; the activity
      // log keeps today's dashes in what it draws, so of it the lines that name the new action are read.
      const text = file === 'README.md'
        ? whole.slice(whole.indexOf('### Safe previews'), whole.indexOf('\n### ', whole.indexOf('### Safe previews') + 1))
        : file.endsWith('AuditLogPanel.tsx') ? whole.split('\n').filter((l) => l.includes('tournament_delete')).join('\n') : whole
      expect(text, file).not.toBe('')
      expect(text, file).not.toMatch(DASHES)
      expect(whole, file).not.toMatch(TOOLS)
      expect(whole, file).not.toMatch(BARE)
      if (file !== 'README.md') expect(whole, file).not.toMatch(OLD_INITIALS)
    }
  })
})

describe('REDESIGN_STATUS.md, WS08 step 5: the date', () => {
  it('dates the record on a real day, on or after Thursday, November 5, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-05').toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 5: the figures agree', () => {
  const files = bullet(block, '- **Files.**')

  it('gives unit counts that add up: the base\'s and the new unit files\', three files more', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([7429, 272])
    const fresh = NEW_UNIT.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    expect(NEW_UNIT).toHaveLength(3)
    expect(num(before) + fresh.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s, the three extended files\' gains and the new integration files\', two files more', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1169, 78])
    const gains = CHANGED_TESTS.map((name) => {
      const m = new RegExp(`\`${escape(name)}\` \\((\\d+), (\\d+) before: `).exec(files)
      return m ? Number(m[1]) - Number(m[2]) : NaN
    })
    for (const n of gains) expect(Number.isNaN(n)).toBe(false)
    const fresh = NEW_INTEGRATION.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    for (const n of fresh) expect(Number.isNaN(n)).toBe(false)
    expect(NEW_INTEGRATION).toHaveLength(2)
    expect(num(before) + gains.reduce((a, n) => a + n, 0) + fresh.reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the count of each extended test file as the sum of its parts', () => {
    for (const name of CHANGED_TESTS) {
      const found = new RegExp(`\`${escape(name)}\` \\((\\d+), (\\d+) before: ([^)]*(?:\\([^)]*\\)[^)]*)*)\\)`).exec(files)
      expect(found, name).not.toBeNull()
      const counts = [...found![3].matchAll(/, (\d+)(?=;|,|$)/g)].map((m) => Number(m[1]))
      expect(counts.reduce((a, n) => a + n, 0), name).toBe(Number(found![1]) - Number(found![2]))
    }
  })

  it('gives the browser run as one run whose counts add up, and the lint figures as the base\'s with the new files added', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(815)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_FILES.length)
  })
})
