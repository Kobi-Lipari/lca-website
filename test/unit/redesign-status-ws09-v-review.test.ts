// test/unit/redesign-status-ws09-v-review.test.ts
//
// REDESIGN_STATUS.md records checkpoint V in two blocks of its own, straight
// after WS09 step 19's block and before the decisions: "Checkpoint V: WS09
// steps 16 to 19, the representatives' club events", what the checkpoint is,
// what its merge carries and what it asks of K; and "WS09 checkpoint V: the
// review of the whole and its fixes", its merge-safety review and the one
// round of fixes. Like the step record tests, this file reads only the WS09
// section, from its heading to the WS10 heading. Pinned here: the blocks'
// place and order; the Status line's tail and the PR line; the five commits;
// the eight findings that stood, by their ids, and the six refuted; what each
// fix is in the files it names; the sentences corrected in place in WS09
// steps 16 to 19 and their follow-ups; the pins moved; the figures of the
// Checks line, which must add up; and the plain-language rules. What a later
// block moves (the heading after the review, the Status and PR lines) is read
// only while the review is the section's latest block.
import { readFileSync } from 'node:fs'
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
/** The two words that name a person's role in the work, on their own, put together so that this file does not hold them. */
const ROLE = new RegExp(`\\b${'the ' + 'lead'}\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|\\b(?:COUNT|PINS|LINT|UNIT)_V\\b|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
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
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
/** A file's code with its comments taken out, line comments and block comments alike. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))
const entry = (text: string, start: string) => entries(text).find((l) => l.startsWith(start)) ?? ''

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const STEP16 = '### WS09 step 16: the representative\'s grant'
const STEP17 = '### WS09 step 17: create and run in the region'
const STEP18 = '### WS09 step 18: submit, approve, ask for changes'
const STEP19 = '### WS09 step 19: events on the pages'
const CHECKPOINT = '### Checkpoint V: WS09 steps 16 to 19, the representatives\' club events'
const REVIEW = '### WS09 checkpoint V: the review of the whole and its fixes'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const checkpoint = part(CHECKPOINT)
const review = part(REVIEW)
const lines = ws09.split('\n')
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''
const latest = latestBlock === REVIEW
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const followUps = ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1)
const checksLine = review.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const buildLine = review.split('\n').find((l) => l.startsWith('- **Build.**')) ?? ''

/** The checkpoint's five commits, its first step and WS09 steps 16 to 19, in order. */
const COMMITS = ['c476203', '7f9bce2', '80680f1', '57fd960', 'a6e766a']
/** The eight findings that stood, as the block writes their ids, E2 with L2 being one fix. */
const STOOD = ['A1', 'B1', 'B2', 'C1', 'C2', 'C3', 'E1', 'E2, with L2, one fix']
/** The six refuted, each with the start of its reason. */
const REFUTED = ['C4, since', 'D1, since', 'D2, since', 'D3, since', 'E3, since', 'E4, since']
/** The fixes asked from the checkpoint's pictures, as the block writes their ids. */
const FROM_PICTURES = ['L1', 'L3', 'L4', 'L5', 'L6', 'L9', 'L10, from E3']

const DELETE = 'functions/api/admin/members/[id].ts'
const APPROVAL = 'functions/api/admin/tournaments/[id]/approval.ts'
const DIRECTORS = 'functions/api/admin/tournaments/[id]/directors.ts'
const MANAGE = 'functions/api/admin/tournaments/[id]/manage.ts'
const CREATION = 'functions/utils/events/creation.ts'
const WAIT = 'src/areas/clubs/components/ApprovalWait.tsx'
const WAITING = 'src/areas/clubs/components/ClubWaitingEvents.tsx'
const SELF = 'test/unit/redesign-status-ws09-v-review.test.ts'
const NEW_UNIT = [SELF]
const NEW_INTEGRATION = ['test/integration/member-delete-approver.test.ts', 'test/integration/region-directors.test.ts', 'test/integration/approval-submit-bound.test.ts']
const NEW_TESTS = [...NEW_UNIT, ...NEW_INTEGRATION]
/** The tests the round grows, with their counts and the base's. */
const GROWN_UNIT: ReadonlyArray<readonly [string, number, number]> = [
  ['test/unit/approval-wait-panel.test.tsx', 17, 15], ['test/unit/region-events-pages.test.tsx', 27, 21], ['test/unit/region-events-steps.test.tsx', 5, 4],
  ['test/unit/directors-modal-switch-words.test.tsx', 3, 2],
]
const GROWN_INTEGRATION: ReadonlyArray<readonly [string, number, number]> = [
  ['test/integration/region-events-answers.test.ts', 10, 9], ['test/integration/club-check-edges.test.ts', 28, 25], ['test/integration/club-check-emails.test.ts', 24, 22],
]
/** The tests the round changes with their count as before. */
const SAME = [['test/integration/public-tournament-columns.test.ts', 18], ['test/unit/approval-words.test.ts', 15]] as const
/** M2's file, whose one `it.each` vitest counts once for each item: 11 cases, as before. */
const READERS = 'test/unit/auth-first-draw-readers.test.tsx'
/** The four follow-ups tagged for checkpoint V that its review leaves, in order. */
const FOLLOW_UPS = [
  'A member delete that fails has already deleted (WS09 checkpoint V).', 'No page names a director for a representative (WS09 checkpoint V).',
  'The wait after Ask for changes reads as a draft never sent (WS09 checkpoint V).', 'Today\'s layouts at a phone\'s width (WS09 checkpoint V).',
]

/** A file's cases as vitest counts them: each plain `it(`; none of the files counted here uses `it.each`. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, file).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])

describe('REDESIGN_STATUS.md, WS09 checkpoint V: the two blocks and the lines at the top', () => {
  it('sit once each, straight after WS09 step 19\'s block, the checkpoint\'s section first, and before the four lists while the review is the latest', () => {
    expect(checkpoint).not.toBe('')
    expect(review).not.toBe('')
    for (const heading of [CHECKPOINT, REVIEW]) expect(ws09.split(`\n${heading}\n`), heading).toHaveLength(2)
    expect(headings[headings.indexOf(STEP19) + 1]).toBe(CHECKPOINT)
    expect(headings[headings.indexOf(CHECKPOINT) + 1]).toBe(REVIEW)
    if (latest) expect(headings[headings.indexOf(REVIEW) + 1]).toBe(LISTS[0])
    // Both forms of heading are the record's own, as WS09 step 1's test allows them.
    expect(read('test/unit/redesign-status-ws09-step1.test.ts')).toMatch(/Checkpoint \[S-Z\]: WS09 /)
    expect(read('test/unit/redesign-status-ws09-step1.test.ts')).toContain('WS09 checkpoint V: \\S')
  })

  it('gives the Status line its tail while the review is the latest: S, T and U live, V built and reviewed and waiting for K\'s word after the mail stream\'s switch-on, and step 15 on its own', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      expect(tail).toBe('checkpoints S and T merged into `main` on Sun, Nov 15, 2026, and checkpoint U, steps 10 to 14 with the two small steps of K\'s decision 7, merged on the same day as pull request 132, and all three are live; checkpoint V, its first step and WS09 steps 16 to 19, the regional representatives\' club events behind `regionEvents` and `REGION_EVENTS_ON`, with an LCA admin\'s approval and always at $0, is built and reviewed on its own branch, `redesign/ws09-clubs-v`, and waits for K\'s word for its merge, after the mail stream\'s switch-on; WS09 step 15 follows as its own pull request; steps 1 to 14 and 16 to 19, K\'s answers to checkpoint S\'s review and K\'s second answer, the Clubs page on a narrow phone, are built.')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('names checkpoint V and step 15 in the PR line, after the three merges, with no pull request number of their own, and leaves the Branch line as it was', () => {
    if (latest) {
      expect(prLine.endsWith('; checkpoint V, its first step and steps 16 to 19, is built and reviewed on `redesign/ws09-clubs-v` and waits for K\'s word for its merge, after the mail stream\'s switch-on, and WS09 step 15 follows as a pull request of its own.')).toBe(true)
      expect(prLine.match(/pull request \d+/g)).toEqual(['pull request 130', 'pull request 131', 'pull request 132'])
    }
    expect(ws09).toContain('**Branch:** `redesign/ws09-clubs`, cut from `main` at `af4a21c`.')
  })
})

describe('REDESIGN_STATUS.md, Checkpoint V: what it is and what it asks of K', () => {
  it('names its first step and its four steps, each with its commit in order, its branch, its base and step 15 still to come', () => {
    const opening = checkpoint.split('\n')[2] ?? ''
    for (const piece of ['`redesign/ws09-clubs-v`', '`ccf65c3`', 'WS09 step 16', 'WS09 step 17', 'WS09 step 18', 'WS09 step 19', 'WS09 step 15, the worker\'s one line, is not in it', 'choice 6 with (a)', 'K\'s decision 1 of Friday, November 13, 2026']) {
      expect(opening, piece).toContain(piece)
    }
    const at = COMMITS.map((c) => opening.indexOf(`\`${c}\``))
    expect(at.every((n) => n > 0), 'every commit named').toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('says what the merge carries: the one migration and its order, every difference with every switch off, the worker, the growth against main and the revert', () => {
    const carries = bullet(checkpoint, '- **What the merge carries.**')
    for (const piece of [
      '`0070_club_event_approval.sql`', 'adding only, with no row changed and no table rebuilt', '"Apply database migrations" starts by itself on the merge', 'must be seen green before the live check',
      'a create of an event that passes its checks fails and writes nothing', 'as it did at checkpoint U\'s merge', 'so no order has to be forced and K has no clicks to make',
      'three kinds of body no page sends', 'its Events filter asks for three more actions', 'answers 403 "LCA review of club events is not open yet." to everyone before anything is read',
      '`SELECT approved_by FROM tournaments LIMIT 0`', 'its answers are `main`\'s', 'the manage page\'s back link reads "All Tournaments"', 'byte for byte `main`\'s',
      '76.61 KiB, gzip 20.53 KiB', '78,449 bytes', 'from `index-CePIMrHe.js` at 557,538 bytes to 558,793, 1,255 bytes more', 'from 134,782 bytes to 134,857', '`dist/assets` from 206 files to 210',
      'No switch is added', 'keeps the four names in `MANAGER_ONLY_TOURNAMENT_KEYS`, reverting everything but that, or clears `approved_by`',
    ]) expect(carries, piece).toContain(piece)
    // The migration adds four columns and nothing else; the endpoint answers 403 before anything else; the switches ship off.
    const sql = read('migrations/0070_club_event_approval.sql').replace(/^--.*$/gm, '')
    expect(sql.match(/^ALTER TABLE tournaments ADD COLUMN /gm)).toHaveLength(4)
    expect(sql).not.toMatch(/^\s*(?:DROP|UPDATE|DELETE|INSERT|CREATE)\b/m)
    expect(codeOf(APPROVAL)).toContain('export const onRequestPost: PagesFunction<Env> = async (context) => {\n  if (!REGION_EVENTS_ON) return errorResponse(APPROVAL_CLOSED, 403)\n')
    expect(read('src/areas/admin/components/AuditLogPanel.tsx')).toMatch(/tournament_submitted[\s\S]*tournament_approved[\s\S]*tournament_changes_asked/)
    // regionEvents and REGION_EVENTS_ON went on together in the block "WS09 switch-on: regionEvents and REGION_EVENTS_ON", so this step holds only that each is declared.
    expect(read('functions/utils/clubs/pages.ts')).toMatch(/^export const REGION_EVENTS_ON = (?:false|true)$/m)
    expect(read('src/lib/features.ts')).toMatch(/^ {2}regionEvents: (?:false|true),$/m)
    // The bodies are the three step 17's corrected sentence names.
    const step17 = bullet(part(STEP17), '- **What ships with every switch off.**')
    for (const piece of ['a body that is not JSON, 400 "Invalid JSON body", where `main` answered 400 "memberId is required"', 'a body of JSON that is not an object', 'a `memberId` that is not text, 400 with the field\'s error']) {
      expect(carries, piece).toContain(piece)
      expect(step17, piece).toContain(piece)
    }
  })

  it('names what is owed before regionEvents goes on as K\'s own, each pointing where the record says it', () => {
    const owed = bullet(checkpoint, '- **Owed before regionEvents goes on, K\'s own.**')
    for (const piece of [
      '"What regionEvents opens when it goes on"', 'a club rep\'s own included, and can email its entrants', 'a choice between that and a narrower grant, only the events the representative drafted',
      '"What an approval covers afterwards, for K."', '"A save after approval (WS09 step 18)."', '`SUBMITS_A_DAY` in `functions/api/admin/tournaments/[id]/approval.ts`, which K may change',
      'no send to more than about 40 people at once', '"Emailing a club event\'s entrants (WS09 step 17)."', '100 emails a day', '`SIGNING_SECRET` set in Cloudflare by K\'s own hands',
      '"Owed before clubKeepers goes on, K\'s own."', '`regionEvents` and `REGION_EVENTS_ON` go on together, in one change', '`switchOrderProblems`',
    ]) expect(owed, piece).toContain(piece)
    for (const start of [
      '- **A save after approval (WS09 step 18).** ', '- **Emailing a club event\'s entrants (WS09 step 17).** ', '- **K\'s signing secret, owed before clubKeepers goes on (WS09 step 13).** ',
      '- **The Baton Rouge seat, owed before checkpoint S merges (WS09 step 3).** ',
    ]) expect(entry(followUps, start), start).not.toBe('')
    expect(bullet(part('### Checkpoint U: WS09 steps 10 to 14, My region and the monthly check'), '- **Owed before clubKeepers goes on, K\'s own.**')).not.toBe('')
    expect(bullet(part(STEP18), '- **What an approval covers afterwards, for K.**')).not.toBe('')
    expect(codeOf(APPROVAL)).toContain('export const SUBMITS_A_DAY = 5')
    expect(read('src/areas/clubs/switches.ts') + read('src/lib/features.ts')).toContain('switchOrderProblems')
  })

  it('gives K the mail stream\'s side, step 15 by agreement and the days, with no pull request number', () => {
    const mail = bullet(checkpoint, '- **For K, from the mail stream\'s side.**')
    for (const piece of ['meets a 500 from the sending service keeps its mark and is not tried again by the timed run that month', 'a 429 or a 503 gives its mark back and is tried again', 'still sends']) {
      expect(mail, piece).toContain(piece)
    }
    expect(bullet(checkpoint, '- **Step 15, by agreement with the mail stream.**')).toContain('Still to come as a pull request of its own')
    const days = bullet(checkpoint, '- **The days for the merge.**')
    for (const piece of ['neither merges on the mail stream\'s switch-on day', 'Monday, November 16, 2026 in Louisiana', 'waits until the mail stream\'s change is merged and checked live', '`main` is merged into this branch and the gate is run again']) {
      expect(days, piece).toContain(piece)
    }
    expect(checkpoint + review).not.toMatch(/pull request \d+/)
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint V: the review of the whole and its fixes', () => {
  it('names the five lenses one after another, fourteen reported, eight stood, none blocking, and the six refuted with their reasons and what was done all the same', () => {
    const what = bullet(review, '- **What this is.**')
    for (const piece of [
      'one after another', 'what ships with every switch off (A)', 'the database and the merge (B)', 'security and privacy (C)', 'the other stream, the shared files, the mail switches and the owner\'s rules (D)',
      'the pages with the switches on (E)', 'A second reader tested each finding', 'Fourteen were reported and eight stood, none blocking; six were refuted', ...REFUTED,
      'a clause was added all the same', 'L5 rebuilt the spot', 'it is closed in place all the same', 'L10 now reads the event again', 'L3 now draws Submit only for a person who cannot decide',
    ]) expect(what, piece).toContain(piece)
    expect(review.split('\n')[2]).toContain('`a6e766a`, read against `ccf65c3`')
  })

  it('gives each of the eight by its id, in order, with what was found and what was done, and no refuted id among them', () => {
    const found = bullet(review, '- **Findings and fixes.**').split('\n').slice(1)
    expect(found.map((l) => l.slice(4, l.indexOf('. ')))).toEqual(STOOD)
    for (const line of found) expect(line, line.slice(0, 12)).toMatch(/ (?:Fixed|Fixed in words)[:.]/)
    expect(found.join('\n')).not.toMatch(/^ {2}- (?:C4|D1|D2|D3|E3|E4)\./m)
    const pictures = bullet(review, '- **From the pictures.**').split('\n').slice(1)
    expect(pictures.map((l) => l.slice(4, l.indexOf('. ')))).toEqual(FROM_PICTURES)
    for (const line of pictures) expect(line, line.slice(0, 12)).toContain(' Fixed: ')
    const mail = bullet(review, '- **The mail stream\'s two items.**').split('\n').slice(1)
    expect(mail.map((l) => l.slice(4, l.indexOf('. ')))).toEqual(['M1', 'M2'])
  })

  it('B1: the clear in the batch behind a read that changes nothing, and what a delete of an approver answers', () => {
    const code = codeOf(DELETE)
    const probe = code.indexOf('await context.env.DB.prepare(\'SELECT approved_by FROM tournaments LIMIT 0\').all()')
    const batch = code.indexOf('await context.env.DB.batch([')
    expect(probe).toBeGreaterThan(code.indexOf('console.warn(RUN_MARKS_UNCLEARED_LOG)'))
    expect(batch).toBeGreaterThan(probe)
    const inBatch = code.slice(batch, code.indexOf('])', batch))
    expect(inBatch.indexOf('...approvalsClear,')).toBeGreaterThan(inBatch.indexOf('DELETE FROM club_rep_requests WHERE member_id = ?'))
    expect(inBatch.indexOf('...approvalsClear,')).toBeLessThan(inBatch.indexOf('DELETE FROM members WHERE id = ?'))
    expect(code.match(/UPDATE tournaments SET approved_by = NULL WHERE approved_by = \?/g)).toHaveLength(1)
    expect(code).not.toMatch(/created_by = NULL/)
    expect(read('test/integration/member-delete-approver.test.ts')).toContain('await expect(remove(deleter, approver)).rejects.toThrow(/FOREIGN KEY constraint failed/)')
    expect(read('migrations/0029_admin_audit_log.sql')).toMatch(/actor_id\s+TEXT NOT NULL REFERENCES members\(id\)/)
    const b1 = bullet(review, '- **Findings and fixes.**').split('\n').find((l) => l.startsWith('  - B1. ')) ?? ''
    for (const piece of ['"FOREIGN KEY constraint failed", answered 500 by the runtime', 'with `approved_by` on the event still theirs', 'its first and third cases pass there', 'because `main` never clears `approved_by`']) {
      expect(b1, piece).toContain(piece)
    }
    expect(read('test/unit/automation-runs-lagging-run.test.ts')).toContain('.toEqual([RUN_MARKS_UNCLEARED_LOG, APPROVALS_UNCLEARED_LOG])')
  })

  it('C1 and C2: the naming refused in words with no query more, and the emails left out only while the constant is set', () => {
    const directors = codeOf(DIRECTORS)
    expect(read(DIRECTORS)).toContain('export const NO_SELF_DIRECTOR = \'You run this event as its regional representative, so you cannot name yourself a director.\'')
    expect(directors).toContain('  if (body.memberId === gate.actor.id && regionAlone(gate.person, gate.clubId)) {\n    return errorResponse(NO_SELF_DIRECTOR, 403)\n  }')
    // An observer and an LCA admin are answered from the list alone; anyone else, a director included, costs the event's read.
    expect(directors).toContain('  if (!REGION_EVENTS_ON || rows.length === 0 || isObserver(member) || member.role === \'lca_admin\') return rows\n  const event = { ...(await eventOf()), directorIds:')
    expect(directors).not.toContain('rows.some((row) => String(row.member_id) === member.id)')
    expect(directors).toContain('SELECT club_id, needs_lca_approval FROM tournaments WHERE id = ?')
    expect(directors).toContain('SELECT needs_lca_approval FROM tournaments WHERE id = ?')
    const c2 = bullet(review, '- **Findings and fixes.**').split('\n').find((l) => l.startsWith('  - C2. ')) ?? ''
    for (const piece of [
      'As it stands since the ruling on the check\'s third finding (below)', 'true for everyone else, one of the event\'s own directors included',
      'answers an observer and an LCA admin from the directors\' list alone, and for anyone else, one of the event\'s own directors and the club\'s own rep included, reads the event\'s club and its mark in one statement',
      'which carries the column once migration 0070 has run, so it adds no statement', 'no statement names a column of 0070',
    ]) expect(c2, piece).toContain(piece)
    expect(c2).not.toContain('only past those early answers')
    expect(c2).not.toContain('false before any read of its own for an observer, an LCA admin, an event with no director, one of the event\'s own directors')
    // The rule as it now stands, read from the code: the club's own rep before the mark, the mark before a director.
    const hidden = codeOf(CREATION)
    const order = [
      '  if (!REGION_EVENTS_ON || observer || event.directorIds.length === 0) return false',
      '  if (member.role === \'lca_admin\') return false',
      '  if (member.role === \'club_rep\' && member.club_id != null && member.club_id === event.clubId) return false',
      '  if ((await event.mark()) === 1) return true',
      '  if (event.directorIds.includes(member.id)) return false',
      '  return regionAlone(built ?? await creationPerson(db, member, rolesOn), event.clubId)',
    ].map((line) => hidden.indexOf(line))
    expect(order.every((at) => at > 0), 'every line of the rule').toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(codeOf(MANAGE)).toContain('mark: async () => event.needs_lca_approval,')
    const ruling = entry(review, '- **The ruling on the check\'s third finding.**')
    for (const piece of [
      'the rule moves to the event', 'only an LCA admin, an observer and the club\'s own rep read the directors\' emails', 'a director named on that event included',
      'with it unset every answer and every statement is the base\'s', 'passes unchanged', '`domain/events/creation.ts` is unchanged',
    ]) expect(ruling, piece).toContain(piece)
    expect(codeOf(MANAGE)).toContain('directors: REGION_EVENTS_ON && await directorEmailsHidden(')
    expect(read('domain/contracts/events.ts').match(/email: z\.string\(\)\.nullable\(\),/g)).toHaveLength(2)
    expect(read('src/areas/admin/components/DirectorsModal.tsx')).toContain('{d.email !== null && <p className="truncate text-xs text-muted-foreground">{d.email}</p>}')
    expect(read('src/areas/events/api.ts')).toContain('directors: Array<{ member_id: string; full_name: string; email: string | null }>')
  })

  it('C3: five submits a day for anyone but an LCA admin, counted after the state and before the guarded statement', () => {
    const code = codeOf(APPROVAL)
    expect(code).toContain('export const SUBMITS_A_DAY = 5')
    expect(code).toContain('export const TOO_MANY_SUBMITS = `You have sent ${SUBMITS_A_DAY} events for LCA review in the last day. Try again tomorrow.`')
    expect(code).toContain('WHERE actor_id = ? AND action = \'tournament_submitted\' AND created_at > datetime(\'now\', \'-1 day\')')
    const early = code.indexOf('const early = settled(body.action, approvalState(event), event)')
    const bound = code.indexOf('if (body.action === \'submit\' && member.role !== \'lca_admin\' && (await submitsInLastDay(db, member.id)) >= SUBMITS_A_DAY) {\n    return errorResponse(TOO_MANY_SUBMITS, 429)')
    const statement = code.indexOf('const result = await statement.run()')
    expect(early).toBeGreaterThan(0)
    expect(bound).toBeGreaterThan(early)
    expect(statement).toBeGreaterThan(bound)
    expect(read(APPROVAL)).toContain('K may change the number.')
  })

  it('E1 and E2 with L2: the steps kept hidden, the rows in review alone, each headed by its event, and each button named with it', () => {
    expect(codeOf('src/pages/MyRegionClubPage.tsx')).toContain('{club && data && adding && mayAdd && rights && (\n          <div hidden={tab !== \'events\'}>')
    const waiting = codeOf(WAITING)
    expect(waiting).toContain('const inReview = all.filter((row) => approvalState(waitOf(row)) === \'in_review\')')
    expect(waiting).toContain('{row.name}<span className="sr-only">, </span>')
    expect(waiting).toContain('Events waiting for LCA approval')
    const wait = codeOf(WAIT)
    expect(wait).toContain('const named = (words: string) => (inRow ? `${words}: ${event.name}` : undefined)')
    expect(wait).toContain('if (inRow) return <div className="min-w-0 space-y-3 text-sm text-ink">{content}</div>')
    for (const words of ['Approve and publish', 'Ask for changes']) expect(wait, words).toContain(`aria-label={named('${words}')}`)
  })

  it('L1 to L10: the wait\'s words, Submit, the empty tab, the wizard\'s line, the back link and the read after a 409', () => {
    const words = read('domain/events/approvalWords.ts')
    for (const line of ['\'Draft. Not sent for LCA review yet.\'', '`Waiting for LCA approval. Sent for review on ${dayOf(event.approval_requested_at)}.`', '`Approved by LCA on ${dayOf(event.approved_at)}.`']) {
      expect(words, line).toContain(line)
    }
    const wait = codeOf(WAIT)
    // The heading and Help on one line, their middles level (from the pictures at the round's end).
    expect(wait).toContain('<div className="flex min-w-0 items-center justify-between gap-2">\n      <Heading id={`${ids}-title`} className="min-w-0 break-words text-base font-semibold">LCA approval</Heading>')
    expect(entry(review, '- **From the pictures at the round\'s end.**')).toContain('the two share one line at every width')
    expect(wait).toContain('const showSubmit = state === \'draft\' && maySubmit && !mayDecide')
    // A 409 moves the focus to the status line before the caller reads the event again, since the button pressed may go.
    expect(wait).toContain('if (err instanceof ApiError && err.status === 409) {\n          moveFocus(\'status\')\n          onStale?.()\n        }')
    const l10 = bullet(review, '- **From the pictures.**').split('\n').find((l) => l.startsWith('  - L10, from E3. ')) ?? ''
    expect(l10).toContain('the focus moved to the status line first, since the read again may take away the button pressed; any other failure calls nothing and keeps the focus on the button.')
    expect(bullet(part(STEP19), '- **On the pages.**')).toContain('the status line\'s words kept and the focus moved to it, since the button pressed may be gone.')
    for (const file of ['test/unit/region-events-pages.test.tsx', 'test/unit/approval-wait-panel.test.tsx']) expect(read(file), file).not.toContain('expect(document.activeElement).toBe(approve)\n    // The 409 reads')
    const club = read('src/pages/AdminClubPage.tsx')
    expect(club.split('\n')[427]).toContain('color: clubTextColor(color),')
    expect(club.split('\n')[709]).toContain('? <KeptBackEmptyWords club={club} />')
    expect(club.indexOf('function KeptBackEmptyWords(')).toBeGreaterThan(club.indexOf('const ClubWaitingEvents = lazy('))
    // The wizard keeps the base's line once, unchanged, inside the conditional's fragment.
    const wizard = read('src/areas/admin/components/TournamentWizard.tsx')
    expect(wizard.split('hidden from the public until you make it visible in the management page.')).toHaveLength(2)
    expect(wizard).toContain(`\n          Tournament will be created as a <strong>draft</strong> ${String.fromCharCode(0x2014)} hidden from the public until you make it visible in the management page.\n`)
    const manage = codeOf('src/pages/TournamentManagePage.tsx')
    expect(manage).toContain('const backToRegion = regionEventsOn() && !canAccessAdmin(authRole) && !WORKSPACE_ROLES.includes(authRole) && directedTournamentIds.length === 0')
    expect(manage).toContain('{backToRegion ? \'My region\' : \'All Tournaments\'}')
    expect(manage).toContain('onStale={() => { void rereadWait() }}')
    expect(read('test/integration/region-events-answers.test.ts')).toContain('with both constants unset, as the checkpoint ships, the answer is the base\\\'s, byte for byte')
  })

  it('M1 and M2: both monthly-check files set the mail switches through getters and name their rule, and the two phrases read "with mailLists off"', () => {
    for (const file of ['test/integration/club-check-emails.test.ts', 'test/integration/club-check-edges.test.ts']) {
      const text = read(file)
      expect(text, file).toContain('vi.mock(\'../../functions/utils/mail/switches\'')
      expect(text, file).toMatch(/get MAIL_LISTS_ON\(\) \{/)
      expect(text, file).toMatch(/get MAIL_SENDER\(\) \{/)
      expect(text, file).toMatch(/under today\\?'s rule, the engine\\?'s rules off: /)
      expect(text, file).toMatch(/under the engine\\?'s rules: /)
    }
    const readers = read('test/unit/auth-first-draw-readers.test.tsx')
    expect(readers.split('with mailLists off')).toHaveLength(3)
    expect(readers).not.toContain('with mailLists as it ships')
    const agreed = bullet(review, '- **The mail stream\'s two items.**')
    for (const piece of ['Monday, November 16, 2026', 'line 252 of `test/unit/auth-first-draw-guard.test.tsx`', 'one line of `test/integration/club-check-emails.test.ts`', 'set the mail switches themselves']) {
      expect(agreed, piece).toContain(piece)
    }
    const run = bullet(review, '- **The run with the mail stream\'s values on.**')
    for (const piece of ['nothing of steps 16 to 19 failed', '`MAIL_SENDER` \'ses\' and `WORKERS_PLAN` \'paid\'', 'since deleted', 'holds only in a git checkout']) expect(run, piece).toContain(piece)
  })

  it('corrects the sentences in place in WS09 steps 16 to 19 and their follow-ups, and closes two follow-ups', () => {
    expect(bullet(part(STEP16), '- **The member delete.**')).toContain('Changed in checkpoint V\'s review: the clear is a statement of the batch of WS09 step 4')
    expect(bullet(part(STEP16), '- **What a revert leaves.**')).toContain('Changed in checkpoint V\'s review: such a revert, made with `REGION_EVENTS_ON` set and approvals written')
    expect(bullet(part(STEP16), '- **What ships with every switch off.**')).toContain('(a clause added in checkpoint V\'s review)')
    expect(bullet(part(STEP16), '- **Judgement calls.**')).toContain('since checkpoint V\'s review a statement of the same batch as the member\'s delete')
    expect(bullet(part(STEP17), '- **What ships with every switch off.**')).toContain('(corrected in checkpoint V\'s review)')
    expect(bullet(part(STEP17), '- **What regionEvents opens when it goes on.**')).toContain('Corrected in checkpoint V\'s review:')
    expect(bullet(part(STEP17), '- **What regionEvents opens when it goes on.**')).not.toContain('and the directors\' emails.')
    expect(bullet(part(STEP18), '- **The emails against the day\'s 100.**')).toContain('Changed in checkpoint V\'s review:')
    expect(bullet(part(STEP18), '- **The order and the refusals.**')).toContain('answered 429 "You have sent 5 events for LCA review in the last day. Try again tomorrow."')
    expect(bullet(part(STEP19), '- **On the pages.**')).toContain('Changed in checkpoint V\'s review:')
    expect(bullet(part(STEP19), '- **Owed before regionEvents goes on.**')).toContain('the way back from the manage page being closed in checkpoint V\'s review')
    expect(entry(followUps, '- **The day\'s 100 emails (WS09 step 18).**')).toContain('Changed in checkpoint V\'s review: the cost is the submits times the LCA admins')
    expect(entry(followUps, '- **The creation answer for a representative (WS09 step 17).**')).toContain(' Closed in WS09 step 19: ')
    expect(entry(followUps, '- **The way back from the manage page (WS09 step 19).**')).toContain(' Closed in checkpoint V\'s review: ')
    // No follow-up is tagged for this review by that name: the four it leaves are tagged for checkpoint V, after the seven before them.
    expect(entries(followUps).filter((l) => l.includes('(WS09 checkpoint V review)'))).toEqual([])
    const tagged = entries(followUps).filter((l) => l.slice(4, l.indexOf('**', 4)).endsWith('(WS09 checkpoint V).')).map((l) => l.slice(4, l.indexOf('**', 4)))
    expect(tagged.slice(7)).toEqual(FOLLOW_UPS)
    const deleted = entry(followUps, `- **${FOLLOW_UPS[0]}**`)
    for (const piece of [
      'live on `main` today and not this checkpoint\'s', 'one statement at a time', 'only then does it delete the member, in a batch', '(`tournaments.created_by`)', '(`admin_audit_log.actor_id`)',
      'the member stays, and the rows removed earlier are gone', 'in one batch or to check the references first', 'K is told with checkpoint V\'s pull request',
    ]) expect(deleted, piece).toContain(piece)
    // Each claim against the code: the clears one at a time before the batch, and the case that holds main's behaviour.
    const del = codeOf(DELETE)
    for (const table of ['registrations', 'payments', 'club_officers', 'tournament_directors', 'tournament_reminders', 'tournament_attendee_reminders', 'support_tickets', 'board_seat_assignments', 'email_campaign_recipients']) {
      expect(del.indexOf(`await context.env.DB.prepare('DELETE FROM ${table} WHERE member_id = ?').bind(memberId).run()`), table).toBeLessThan(del.indexOf('await context.env.DB.batch(['))
    }
    expect(read('test/integration/member-delete-approver.test.ts')).toContain('main\'s behaviour today and a known fault')
    expect(entry(followUps, `- **${FOLLOW_UPS[1]}**`)).toContain('The manage page lists no directors.')
    expect(read('src/pages/WorkspacePage.tsx')).toContain('canAssignDirectors={ownClub}')
    expect(entry(followUps, `- **${FOLLOW_UPS[2]}**`)).toContain('"Draft. Not sent for LCA review yet."')
    expect(entry(followUps, `- **${FOLLOW_UPS[3]}**`)).toContain('none of it this checkpoint\'s and each live today')
  })

  it('names its pins, and each moved check holds', () => {
    const pins = bullet(review, '- **Pins moved.**')
    for (const file of [
      'test/unit/redesign-status-ws08-step5-claims.test.ts', 'test/unit/redesign-status-ws09-step14.test.ts', 'test/unit/redesign-status-ws09-step16.test.ts', 'test/unit/redesign-status-ws09-step17.test.ts',
      'test/unit/redesign-status-ws09-step18.test.ts', 'test/unit/redesign-status-ws09-step19.test.ts', 'test/unit/redesign-status-ws09-v-asked.test.ts',
    ]) expect(pins, file).toContain(`\`${file}\``)
    expect(read('test/unit/redesign-status-ws08-step5-claims.test.ts')).toContain('expect(rules.flatMap(importedNames)).toEqual([\'canAssignDirectors\', \'regionAlone\', \'CreationPerson\'])')
    expect(read('test/unit/redesign-status-ws08-step5-claims.test.ts')).toContain('\'return { tournamentId, tournamentName: tournament.name, actor: authed.member, person, clubId: tournament.club_id }\',')
    expect(read('test/unit/redesign-status-ws09-step14.test.ts')).toContain('? [EMAILS_TEST, EDGES_TEST] : []')
    expect(read('test/unit/redesign-status-ws09-step19.test.ts')).toContain('[PAGES_TEST, ANSWERS_TEST, \'test/unit/approval-wait-panel.test.tsx\', \'test/unit/region-events-steps.test.tsx\'] : []')
    expect(read('test/unit/redesign-status-ws09-v-asked.test.ts')).toContain('expect(statusLine).not.toMatch(/checkpoint U[^;]*waits for K\'s word for its merge/)')
    expect(read('test/unit/goldText.test.ts')).toContain('expect(result.badgeUses).toHaveLength(33)')
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
  })

  it('names the judgement calls: the limit of five, the emails kept back, the rows in review alone, Submit for an LCA admin and the delete\'s clear in the batch', () => {
    const calls = bullet(review, '- **Judgement calls.**')
    for (const start of ['  - The limit is five submits', '  - The directors\' emails are sent as null rather than left out', '  - The admin club page\'s waiting rows are the events in review alone', '  - Submit is not drawn for an LCA admin', '  - The member delete\'s clear goes in the batch']) {
      expect(calls, start).toContain(start)
    }
    // Representatives naming each other: closed for the emails since the ruling, and what stays, the row and the way in.
    expect(calls).toContain('the path is closed for the emails')
    expect(calls).toContain('a person named a director keeps their row, and with it their way into the event, until the row is removed, whoever named them and whatever becomes of the namer\'s seat')
    expect(calls).not.toContain('each read every director\'s email on the other\'s draft')
    expect(calls).toContain('the row\'s status line keeps its words and takes the focus')
    expect(calls).not.toContain('the focus and the status line stay where they were')
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint V\'s review: the figures', () => {
  it('counts as many cases for each new test as the file holds, and each grown or changed test as it now holds', () => {
    const files = bullet(review, '- **Files.**')
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    for (const [file, now, was] of [...GROWN_UNIT, ...GROWN_INTEGRATION]) {
      expect(files, file).toContain(`\`${file}\` (${now}, ${was} on the base: `)
      expect(casesIn(file), file).toBe(now)
    }
    for (const [file, now] of SAME) {
      expect(files, file).toContain(`\`${file}\` (${now}, as before: `)
      expect(casesIn(file), file).toBe(now)
    }
    expect(files).toContain(`\`${READERS}\` (11, as before, each item of its \`it.each\` counted: M2)`)
  })

  it('gives unit counts that add up: the base\'s, the new file\'s and the grown cases', () => {
    const files = bullet(review, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([10499, 446])
    const grown = GROWN_UNIT.reduce((n, [, now, was]) => n + now - was, 0)
    expect(num(before) + NEW_UNIT.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + grown).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts as the base\'s with the new files and the grown cases added', () => {
    const files = bullet(review, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing but the one todo/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2769, 152])
    const grown = GROWN_INTEGRATION.reduce((n, [, now, was]) => n + now - was, 0)
    expect(num(before) + NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + grown).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the lint files as the base\'s with the new tests added, and the build beside the base\'s', () => {
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1165)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_TESTS.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.slice(1)).toEqual(['210', '210'])
    expect(checked?.[1]).toBe(built?.[1])
    for (const piece of ['made from `a6e766a` in a scratch folder', '`index-DOo8piRG.js`', '558,793 bytes', '`index-B9z7qSj6.css` 134,857 bytes', '`features-nZCZoT6G.js` 729 bytes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(buildLine, piece).toContain(piece)
    }
    expect(buildLine).toMatch(/the main script `index-[\w-]+\.js` 558,793 bytes/)
    expect(checksLine).toContain('`npm run typecheck:functions`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `a6e766a`\'s tree')
    expect(bullet(review, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint V: the plain-language rules in what it wrote', () => {
  const corrected = [
    ...['- **The member delete.**', '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Judgement calls.**'].map((b) => bullet(part(STEP16), b)),
    ...['- **What ships with every switch off.**', '- **What regionEvents opens when it goes on.**', '- **The callers.**'].map((b) => bullet(part(STEP17), b)),
    ...['- **The three moves.**', '- **The order and the refusals.**', '- **The emails against the day\'s 100.**'].map((b) => bullet(part(STEP18), b)),
    ...['- **On the pages.**', '- **The workspace and the dashboard.**', '- **Owed before regionEvents goes on.**'].map((b) => bullet(part(STEP19), b)),
    ...['- **The day\'s 100 emails (WS09 step 18).**', '- **The creation answer for a representative (WS09 step 17).**', '- **The way back from the manage page (WS09 step 19).**'].map((s) => entry(followUps, s)),
    ...FOLLOW_UPS.map((head) => entry(followUps, `- **${head}**`)),
  ]
  const written = [checkpoint, review, statusLine, prLine, ...corrected].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials, unfilled marks and a he for K out of what it wrote', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    expect(proseOf(written)).not.toMatch(HE)
  })

  it('gives every date its weekday, writes "US Chess" where the federation is named and writes no time in a clock\'s other form', () => {
    const prose = proseOf(written)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const found of prose.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b(?!:)/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own, the old initials and the words for a person\'s role in the work out of the new tests, whose people, clubs and addresses are plainly made up', () => {
    for (const file of NEW_TESTS) {
      const text = read(file)
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS, ROLE]) expect(text, file).not.toMatch(rule)
    }
    for (const file of NEW_INTEGRATION) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      expect(text, file).toMatch(/Example [A-Z][a-z]+ Club/)
      for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
    }
  })
})
