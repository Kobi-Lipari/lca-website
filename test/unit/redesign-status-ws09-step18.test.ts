// test/unit/redesign-status-ws09-step18.test.ts
//
// REDESIGN_STATUS.md records WS09 step 18: submit, approve, ask for changes,
// the third of the plan's four steps of checkpoint V. Like WS09 step 17's
// record test, this file reads only the WS09 section, from its heading to the
// WS10 heading. Pinned here: this step's block right after step 17's, and
// before the four lists while it is the latest; the Status line's tail while
// this step is the latest; the block's parts in order and its figures, which
// must agree with each other and with the files they describe; the sentence
// this step added to the map; the tagged entries of the lists; and the
// plain-language rules over what the step wrote and the files it adds. What a
// later step will change in the tree (the contracted methods, the handler
// count) is read only while this step is the latest.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
import { APPROVAL_NOTE_EMPTY, APPROVAL_NOTE_TOO_LONG } from '../../domain/contracts/events'
import { PENDING_CONTRACTS } from './contracts-pending'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[A-Z0-9]+_(?:CASES|LINE|COUNT|TEXT|AFTER|FILES|TESTS|NAME|SIZE)\\b(?<!PENDING_COUNT)|${'UNIT' + 'NOW'}|${'INT' + 'NOW'}|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
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
const TAG = '(WS09 step 18).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 17: create and run in the region'
const STEP = '### WS09 step 18: submit, approve, ask for changes'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''
const latest = latestStep === 18 && latestBlock === STEP

const HANDLER = 'functions/api/admin/tournaments/[id]/approval.ts'
const EMAILS = 'functions/utils/clubs/emails.ts'
const NOTICE = 'functions/utils/events/publishedReview.ts'
const CREATE = 'functions/api/admin/tournaments.ts'
const SAVE = 'functions/api/admin/tournaments/[id].ts'
const PANEL = 'src/areas/admin/components/AuditLogPanel.tsx'
const EVENTS_TEST = 'test/integration/club-events.test.ts'
const SAFETY_TEST = 'test/integration/role-safety.test.ts'
const CONTRACT_TEST = 'test/integration/contracts/tournament-approval.test.ts'
const LABELS_TEST = 'test/unit/audit-log-approval-labels.test.tsx'
const SELF = 'test/unit/redesign-status-ws09-step18.test.ts'
const STATE_TEST = 'test/unit/approval-state.test.ts'
const WAIT_EMAILS_TEST = 'test/unit/club-wait-emails.test.ts'
const EDGES_TEST = 'test/integration/approval-edges.test.ts'
const NEW_TESTS = [CONTRACT_TEST, EDGES_TEST, STATE_TEST, WAIT_EMAILS_TEST, LABELS_TEST, SELF]
const NEW_UNIT = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
const NEW_INTEGRATION = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
/** The two integration tests that grow, each with its count and the base's. */
const GROWN: ReadonlyArray<readonly [string, number, number]> = [[EVENTS_TEST, 82, 39], [SAFETY_TEST, 10, 8]]
/** The files this step changes, its own lines alone in the shared ones. */
const CHANGED = [
  'domain/events/approval.ts', 'domain/contracts/events.ts', 'domain/contracts/registry.ts', EMAILS, NOTICE, 'functions/utils/admin/audit.ts', CREATE, PANEL,
  EVENTS_TEST, SAFETY_TEST, 'test/unit/routes.test.ts',
]
/** The tests whose pins this step moves. */
const MOVED = [
  'test/unit/routes.test.ts', 'test/unit/redesign-status-ws09-step17.test.ts', 'test/unit/redesign-status-ws09-step6.test.ts', 'test/unit/redesign-status-ws09-u-notice.test.ts',
  'test/unit/goldText.test.ts', 'test/unit/redesign-status-ws09-u-review.test.ts', 'test/unit/redesign-status-ws08-step6-claims.test.ts',
]
/** The files the mail stream holds, which this step leaves alone. */
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** The items of the list written at `at` (its opening bracket), counted at its own depth. */
function itemsAt(text: string, at: number): number {
  let depth = 0
  let items = 0
  let pending = false
  let quote = ''
  for (let i = at; i < text.length; i++) {
    const c = text[i]
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = ''
      continue
    }
    if (c === '\'' || c === '"' || c === '`') {
      quote = c
      if (depth === 1) pending = true
    } else if ('[({'.includes(c)) {
      depth++
      if (depth === 2) pending = true
    } else if (')}]'.includes(c)) {
      depth--
      if (depth === 0) return items + (pending ? 1 : 0)
    } else if (depth === 1 && c === ',') {
      if (pending) items++
      pending = false
    } else if (depth === 1 && /\S/.test(c)) pending = true
  }
  return Number.NaN
}
/**
 * A file's cases as vitest counts them: every plain `it(` line, each item of
 * an `it.each(...)` over a written list, or over a list the file writes once
 * under a name of its own, and each `it.todo(`.
 */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:test|describe)\.each\(/gm) ?? []).length, `${file}: no each but it.each`).toBe(0)
  const each = [...text.matchAll(/^\s*it\.each\(([A-Z_]+\)|\[)/gm)]
  expect(each.length, `${file}: every it.each over a written list`).toBe((text.match(/^\s*it\.each\(/gm) ?? []).length)
  const items = each.reduce((n, found) => {
    if (found[1] === '[') return n + itemsAt(text, (found.index ?? 0) + found[0].length - 1)
    const listName = found[1].slice(0, -1)
    const written = [...text.matchAll(new RegExp(`const ${listName}(?:: [^=]+)? = \\[`, 'g'))]
    expect(written, `${file}: ${listName} written once`).toHaveLength(1)
    return n + itemsAt(text, (written[0].index ?? 0) + written[0][0].length - 1)
  }, 0)
  return (text.match(/^\s*it\(/gm) ?? []).length + (text.match(/^\s*it\.todo\(/gm) ?? []).length + items
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out, line comments and block comments alike. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const flat = (text: string) => text.replace(/\s+/g, ' ')
/** The string an exported constant of the handler is set to. */
const wordsOf = (name: string) => new RegExp(`export const ${name} = '((?:[^'\\\\]|\\\\.)*)'`).exec(read(HANDLER))?.[1].replace(/\\'/g, '\'') ?? ''

describe('REDESIGN_STATUS.md, WS09 step 18: the block', () => {
  it('sits once, right after step 17\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest, and leaves the PR line\'s merges as they were', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      expect(tail).toBe('checkpoints S and T merged into `main` on Sun, Nov 15, 2026, and checkpoint U, steps 10 to 14 with the two small steps of K\'s decision 7, merged on the same day as pull request 132, and all three are live; checkpoint V is under way on `redesign/ws09-clubs-v`, its first step mending, behind `clubKeepers`, what checkpoint U\'s pictures showed, WS09 step 16 giving the regional representative\'s grant and the four columns of the approval wait, WS09 step 17 the representative\'s club events on the server, created, named and run in the region and held back from listing until an LCA admin approves them, and WS09 step 18 the wait\'s three moves on the server, Submit for LCA review, Approve and publish and Ask for changes, all three behind `regionEvents`; WS09 step 15 follows as a pull request of its own; steps 1 to 14 and 16 to 18, K\'s answers to checkpoint S\'s review and K\'s second answer, the Clubs page on a narrow phone, are built.')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(prLine.match(/pull request \d+/g)).toEqual(['pull request 130', 'pull request 131', 'pull request 132'])
  })

  it('opens by saying where the step sits, that step 15 is still to come, K\'s answer and what it builds', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the third of the plan\'s four steps of checkpoint V (steps 16 to 19)', 'WS09 step 15, the worker\'s one line, is still to come', 'choice 6 with (a)',
      'K\'s decision 1 of Friday, November 13, 2026', '`regionEvents` and `REGION_EVENTS_ON`', 'always at $0', '`POST /api/admin/tournaments/[id]/approval`',
      'Submit for LCA review, Approve and publish and Ask for changes', 'No page, no table, no migration and no switch is added',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The three moves.**', '- **The guard.**', '- **The order and the refusals.**', '- **The note.**', '- **The emails.**',
      '- **The emails against the day\'s 100.**', '- **The effects of a first publish.**', '- **What an approval covers afterwards, for K.**', '- **The activity log.**',
      '- **The contract.**', '- **The map (criterion 14).**', '- **Step 15.**', '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**',
      '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Owed before regionEvents goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**',
      '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })

  it('names every file it adds and changes, each new test with its count, the two grown tests with theirs, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [HANDLER, ...NEW_TESTS, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const file of [HANDLER, ...NEW_TESTS]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const [file, after, before] of GROWN) {
      expect(files, file).toContain(`\`${file}\` (${after}, ${before} on the base: `)
      expect(casesIn(file), file).toBe(after)
    }
    expect(files).toContain('  - Grown with no change: none by a case')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of [`\`${NOTICE}\``, `\`${PANEL}\``, 'No file the mail stream holds is touched', `The one file under \`src/\` that changes is \`${PANEL}\``, ...HELD.map((f) => `\`${f}\``)]) {
      expect(beyond, piece).toContain(piece)
    }
    for (const file of [...HELD, 'src/lib/features.ts', 'src/App.tsx', 'test/unit/fixtures/api-added-since-split.json', 'test/unit/contracts-pending.ts']) {
      expect(read(file), file).not.toMatch(/admin\/tournaments\/\[id\]\/approval|tournamentApproval|tournament_submitted|tournament_approved|tournament_changes_asked/)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 18: the parts against the files', () => {
  const handler = codeOf(HANDLER)

  it('names the three moves and their guard as the handler holds them', () => {
    const moves = bullet(block, '- **The three moves.**')
    for (const piece of ['Written as a list and not a table', '`draftedInRegion`', '`requireAdmin`', '`markReviewNotified`', '`tournament_submitted`', '`tournament_approved`', '`tournament_changes_asked`', 'from a draft or in review']) {
      expect(moves, piece).toContain(piece)
    }
    expect(handler).toContain("submit: `UPDATE tournaments SET approval_requested_at = datetime('now') WHERE id = ? AND needs_lca_approval = 1 AND ${UNAPPROVED} AND NOT ${REQUESTED}`,")
    expect(handler).toContain("approve: `UPDATE tournaments SET approved_at = datetime('now'), approved_by = ?, is_visible = 1 WHERE id = ? AND needs_lca_approval = 1 AND ${UNAPPROVED}`,")
    expect(handler).toContain('ask_changes: `UPDATE tournaments SET approval_requested_at = NULL WHERE id = ? AND needs_lca_approval = 1 AND ${UNAPPROVED} AND ${REQUESTED}`,')
    expect(handler).toContain("if (!event || !(await draftedInRegion(db, member, { clubId: event.club_id, createdBy: event.created_by }))) {")
    expect(flat(handler)).toContain("if (body.action !== 'submit') { const admin = await requireAdmin(context.request, context.env) if (isResponse(admin)) return admin }")
    const guard = bullet(block, '- **The guard.**')
    for (const piece of ['`meta.changes`', 'one is 200 and the other 409', 'one row and one email']) expect(guard, piece).toContain(piece)
    expect(handler.indexOf('const result = await statement.run()')).toBeLessThan(handler.indexOf('await recordAdminAction('))
    expect(handler.indexOf('(result.meta.changes ?? 0) !== 1')).toBeLessThan(handler.indexOf('await recordAdminAction('))
    expect(handler.match(/recordAdminAction\(/g)).toHaveLength(1)
  })

  it('gives the refusals in the handler\'s own words and the constant read first', () => {
    const refusals = bullet(block, '- **The order and the refusals.**')
    for (const name of ['APPROVAL_CLOSED', 'NOT_MARKED', 'ALREADY_APPROVED', 'NOT_IN_REVIEW']) {
      const words = wordsOf(name)
      expect(words, name).not.toBe('')
      expect(refusals, name).toContain(`"${words}"`)
    }
    const post = between(handler, 'export const onRequestPost', '\n}\n')
    expect(post.split('\n')[1]).toBe('  if (!REGION_EVENTS_ON) return errorResponse(APPROVAL_CLOSED, 403)')
    expect(read(HANDLER)).toContain("import { REGION_EVENTS_ON } from '../../../../utils/clubs/pages'")
    expect(post.indexOf('requireAuthedMember(')).toBeLessThan(post.indexOf('parseBody('))
    expect(post.indexOf('parseBody(')).toBeLessThan(post.indexOf('requireAdmin('))
    for (const piece of ['"Tournament not found"', 'whether the event exists or not', 'with no query made', '`mfaRequired`']) expect(refusals, piece).toContain(piece)
  })

  it('names the note\'s rule and words, and keeps it out of the row and the columns', () => {
    const note = bullet(block, '- **The note.**')
    for (const words of [APPROVAL_NOTE_EMPTY, APPROVAL_NOTE_TOO_LONG]) expect(note).toContain(`"${words}"`)
    for (const piece of ['at most 500 characters', '`emailQuote`', 'no column holds it, the activity row does not carry it']) expect(note, piece).toContain(piece)
    expect(read('domain/contracts/events.ts')).toContain('note: z.string().trim().min(1, APPROVAL_NOTE_EMPTY).max(APPROVAL_NOTE_MAX, APPROVAL_NOTE_TOO_LONG),')
    expect(handler).toContain('    detail: { tournament_id: tournamentId },')
    expect(handler.match(/body\.note/g)).toHaveLength(1)
  })

  it('names the three emails as emails.ts draws them and the handler sends them', () => {
    const emails = bullet(block, '- **The emails.**')
    for (const piece of ['`reviewAskedEmail`', '`approvedEmail`', '`changesAskedEmail`', '`trySendEmail`', '`renderEmail`', '"Sat, Dec 12, 2026"', '`/admin/tournaments/`', '`/tournaments/`', '"No club on file"', 'it names no person']) {
      expect(emails, piece).toContain(piece)
    }
    const words = read(EMAILS)
    for (const name of ['reviewAskedEmail', 'approvedEmail', 'changesAskedEmail']) expect(words, name).toContain(`export function ${name}(`)
    expect(words).toContain('import { trySendEmail, type EmailEnv, type EmailMessage } from \'../email\'')
    expect(words).toContain('import { emailDetails, emailQuote, escapeHtml, p, renderEmail } from \'../emailLayout\'')
    expect(codeOf(EMAILS)).not.toMatch(/\bdeliver\(|listFooter|unsubscribe/i)
    expect(handler).not.toMatch(/\bdeliver\(|sendEmail\(/)
    expect(handler.match(/trySendEmail\(/g)).toHaveLength(3)
    expect(handler).toContain('const addresses = await lcaAdminAddresses(env.DB)')
  })

  it('counts the emails against the day\'s 100 and gives K the line on what an approval covers afterwards', () => {
    const day = bullet(block, '- **The emails against the day\'s 100.**')
    for (const piece of ['100 emails a day', 'one to each LCA admin\'s address', 'Approve sends one', 'Ask for changes one', 'twice the number of LCA admins and two more']) expect(day, piece).toContain(piece)
    // C3 of checkpoint V's review: a day costs the submits times the LCA admins, and one person's submits are bounded.
    for (const piece of ['the submits times the LCA admins', 'at most five submits go through in any 24 hours, `SUBMITS_A_DAY` in `functions/api/admin/tournaments/[id]/approval.ts`', 'at most five times the number of LCA admins a day']) expect(day, piece).toContain(piece)
    const covers = bullet(block, '- **What an approval covers afterwards, for K.**')
    for (const piece of ['does not ask for a new approval', 'The mark stays 1', 'K reads this before `regionEvents` goes on']) expect(covers, piece).toContain(piece)
  })

  it('names every effect of a first publish and what Approve does with each, as the files hold them', () => {
    const effects = bullet(block, '- **The effects of a first publish.**')
    for (const piece of ['`sendPublishedReviewNotice`', '`review_notified_at`', '`markReviewNotified`', '`tournament_publish`', '`functions/utils/events/listing.ts`', 'no scheduled publish']) {
      expect(effects, piece).toContain(piece)
    }
    expect(effects.split('\n').filter((l) => l.startsWith('  - '))).toHaveLength(4)
    expect(handler).toContain('await markReviewNotified(db, tournamentId)')
    expect(handler).not.toMatch(/sendPublishedReviewNotice|review_notified_at\s*=/)
    expect(codeOf(SAVE)).toContain('if (rolesOn && isVisible && !existing.isVisible) notice = await sendPublishedReviewNotice(context.env, tournamentId)')
    const notice = read(NOTICE)
    expect(notice).toContain('export async function lcaAdminAddresses(db: D1Database): Promise<string[]> {')
    expect(notice).toContain(".prepare(\"SELECT email, full_name FROM members WHERE role = 'lca_admin' AND email LIKE '%@%' ORDER BY email\")")
    expect(notice.match(/SELECT email, full_name FROM members/g)).toHaveLength(1)
  })

  it('names the activity log\'s rows, their labels and the create\'s key, as the files hold them', () => {
    const log = bullet(block, '- **The activity log.**')
    const audit = read('functions/utils/admin/audit.ts')
    const panel = read(PANEL)
    for (const [action, label] of [['tournament_submitted', 'Sent event for LCA review'], ['tournament_approved', 'Approved and published event'], ['tournament_changes_asked', 'Asked for changes to event']]) {
      expect(audit, action).toContain(`  | '${action}'\n`)
      expect(panel, action).toContain(`  ${action}: { label: '${label}', `)
      expect(log, action).toContain(`"${label}"`)
      expect(log, action).toContain(`\`${action}\``)
    }
    expect(log).toContain('`"as_representative": true`')
    expect(log).toContain('its Events filter asks for the three actions with the others about events, 17 in all within the 20 `functions/api/admin/audit.ts` reads')
    const events = /\{ value: '([a-z_,]+)', label: 'Events' \}/.exec(panel)?.[1].split(',') ?? []
    expect(events).toHaveLength(17)
    for (const action of ['tournament_publish', 'tournament_submitted', 'tournament_approved', 'tournament_changes_asked']) expect(events, action).toContain(action)
    expect(read('functions/api/admin/audit.ts')).toContain('.filter(Boolean).slice(0, 20)')
    expect(log).toContain('every other create\'s row is byte for byte as on the base')
    expect(codeOf(CREATE)).toContain('      ...(asRepresentative ? { as_representative: true } : {}),')
    expect(codeOf(CREATE)).toContain('      ...(rolesOn ? { tournament_id: id, grant: person.grant } : { tournament_id: id }),')
  })

  it('names the contract and its figures, read from the tree while this step is the latest', () => {
    const contract = bullet(block, '- **The contract.**')
    for (const piece of ['`tournamentApprovalRequestSchema`', '`tournamentApprovalResponseSchema`', 'The request is strict', 'The answer is strict', '40 of them contracted, 39 on the base', '`PENDING_COUNT` 104, as on the base']) {
      expect(contract, piece).toContain(piece)
    }
    expect(Object.keys(contracts['admin/tournaments/[id]/approval'])).toEqual(['POST'])
    expect(PENDING_CONTRACTS.filter((line) => line.endsWith(' admin/tournaments/[id]/approval'))).toEqual([])
    expect(codeOf(HANDLER)).toContain('const body = await parseBody(context.request, tournamentApprovalRequestSchema)')
    expect(read(CONTRACT_TEST)).toContain("contracts['admin/tournaments/[id]/approval'].POST")
    if (!latest) return
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(40)
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
    expect(PENDING_CONTRACTS).toHaveLength(104)
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(104)')
  })

  it('names the branch, what the merge does, the database, a revert, what ships with every switch off and what is owed', () => {
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-v`', '`80680f1`', 'this step\'s diff is against `80680f1`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration and one handler file', '104 handler files', '40 of the 144 methods', '`PENDING_COUNT` 104', '`deploy-worker.yml` redeploys the daily-emails worker']) expect(does, piece).toContain(piece)
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('This step changes no table')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('the constant goes off before any revert of this step')
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of [`"${wordsOf('APPROVAL_CLOSED')}"`, 'with no query made, no email sent and no row written', 'pass unchanged', 'three labels no row can ask for yet', 'No switch is added']) {
      expect(ships, piece).toContain(piece)
    }
    for (const file of ['test/integration/club-events-edges.test.ts', 'test/integration/region-grant-handlers.test.ts', 'test/unit/creation-marked-events.test.ts', 'test/unit/event-approval.test.ts']) {
      expect(ships, file).toContain(`\`${file}\``)
      expect(existsSync(join(ROOT, file)), file).toBe(true)
    }
    expect(read('functions/utils/clubs/pages.ts')).toContain('export const REGION_EVENTS_ON = false')
    expect(read('src/lib/features.ts')).toContain('  regionEvents: false,')
    expect(bullet(block, '- **Owed before regionEvents goes on.**')).toContain('WS09 step 19 first')
    expect(bullet(block, '- **Step 15.**')).toContain('Still to come')
  })

  it('names its pins, and the moved checks hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    for (const piece of ['103 handler files, now 104', 'now 40 of 144', '`PENDING_COUNT` 104, not moved']) expect(pins, piece).toContain(piece)
    expect(read('test/unit/redesign-status-ws09-step17.test.ts')).toContain('    for (const file of NEW_TESTS) if (latest || file !== EVENTS_TEST) expect(writtenCount(files, file), file).toBe(casesIn(file))\n')
    expect(read('test/unit/redesign-status-ws09-step6.test.ts')).toContain('for (const [file, n] of CHANGED_TESTS.filter(([f]) => latestStep === 6 || f !== \'test/integration/role-safety.test.ts\')) if (latestStep === 6 || file !== \'test/integration/club-permissions.test.ts\') expect(casesIn(file), file).toBe(n)')
    expect(read('test/unit/redesign-status-ws09-u-notice.test.ts')).toContain('if (latestBlock === BLOCK || file !== \'test/integration/role-safety.test.ts\') expect(casesIn(file), file).toBe(count)')
    expect(read('test/unit/goldText.test.ts')).toContain('\'src/areas/admin/components/AuditLogPanel.tsx:278 \',')
    expect(read(PANEL).split('\n')[277]).toContain('<span')
    expect(read('test/unit/redesign-status-ws08-step6-claims.test.ts')).toContain('[send, functionNamed(notice, \'lcaAdminAddresses\')]')
  })

  it('gives the lint as unchanged and the build\'s figures', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', 'made from `80680f1` in a scratch folder', '`index-B9z7qSj6.css` 134,857 bytes', '`features-nZCZoT6G.js` 729 bytes',
      'grows by 371 bytes', '`AdminPage-C5-Azghv.js` at 102,939 bytes', '`AdminPage-07b6Sfyk.js` at 103,310', '`index-DpDZyFNB.js`, 557,579 bytes', '68 files in all take new names',
      '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 18: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `80680f1`\'s tree')
  })

  it('counts as many cases for each new test as the file holds', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
  })

  it('gives unit counts that add up: the base\'s and the new files\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([10328, 436])
    expect(num(before) + NEW_UNIT.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts as the base\'s with the new file and the cases added to the two grown tests', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing but the one todo/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2659, 148])
    const grown = GROWN.reduce((n, [, now, was]) => n + now - was, 0)
    expect(num(before) + NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + grown).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the lint files as the base\'s with the new files, and the build\'s file count as the base\'s', () => {
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1144)
    expect(num(lint![1]) - num(lint![2])).toBe([HANDLER, ...NEW_TESTS].length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.slice(1)).toEqual(['207', '207'])
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 18: the map and the lists', () => {
  it('adds one sentence to criterion 14, after step 17\'s and before the planned step, and to no other item', () => {
    const item = mapItem('Criterion 14')
    expect(item.split('Built in WS09 step 18: ')).toHaveLength(2)
    expect(item.indexOf('Built in WS09 step 17: ')).toBeLessThan(item.indexOf('Built in WS09 step 18: '))
    expect(item.indexOf('Built in WS09 step 18: ')).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    for (const file of [EVENTS_TEST, SAFETY_TEST]) expect(item.slice(item.indexOf('Built in WS09 step 18: ')), file).toContain(`\`${file}\``)
    expect(item).toMatch(/Planned: WS09 step 18\.$/)
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 18:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 14'])
  })

  it('records the step\'s deviations, verify items and follow-ups, each tagged, and no decision of its own', () => {
    expect(tagged(part(LISTS[0]))).toEqual([])
    expect(tagged(deviations).map(head)).toEqual([
      'The approval request is strict (WS09 step 18).', 'The D22 notice\'s file changes (WS09 step 18).', 'The Activity page\'s three labels (WS09 step 18).',
    ])
    expect(tagged(verify).map(head)).toEqual(['The second factor (WS09 step 18).', 'No queue (WS09 step 18).', 'Approve before a submit (WS09 step 18).'])
    for (const entry of tagged(verify).slice(0, 2)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `80680f1`/)
    expect(tagged(followUps).map(head)).toEqual([
      'The manage page for a representative (WS09 step 18).', 'A save after approval (WS09 step 18).', 'The day\'s 100 emails (WS09 step 18).',
      'A save that crosses an approval (WS09 step 18).',
    ])
    expect(read('src/App.tsx')).toContain('<Route path="/admin/tournaments/:id" element={<RoleProtectedRoute roles={[\'lca_admin\', \'lca_observer\', \'lca_officer\', \'club_rep\', \'tournament_director\']} allowDirectors')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 18: plain language', () => {
  const written = [
    block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps), mapItem('Criterion 14').slice(mapItem('Criterion 14').indexOf('Built in WS09 step 18: ')), statusLine,
  ].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the step wrote, and dates and times in their plain form', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    expect(written).not.toMatch(/\.github\//)
    const prose = proseOf(written)
    expect(prose).not.toMatch(HE)
    expect(written).not.toMatch(/\(step \d+[;),]/)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const found of prose.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b(?!:)/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    expect(written).not.toMatch(/\bUSCF\b/i)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds and the code it changes', () => {
    for (const file of [HANDLER, ...NEW_TESTS, 'domain/events/approval.ts', 'functions/utils/admin/audit.ts', CREATE, EVENTS_TEST, SAFETY_TEST]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
    // The shared files and the ones that held other lines before: this step's own lines, read alone.
    const own = [
      between(read('domain/contracts/events.ts'), '/** The longest note Ask for changes takes', '/** US Chess crosstable codes'),
      between(read('domain/contracts/registry.ts'), "  'admin/tournaments/[id]/approval': {", "  'admin/tournaments/[id]/directors': {"),
      read(EMAILS).slice(read(EMAILS).indexOf('/** A representative\'s club event as the three emails of the wait name it. */')),
      between(read(NOTICE), ' * The LCA admins\' addresses, the one rule', '\n}\n'),
    ]
    for (const text of own) {
      expect(text).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text).not.toMatch(rule)
    }
  })

  it('writes the tests\' people, clubs and places plainly made up, reading no setting from the environment', () => {
    for (const file of [EVENTS_TEST, SAFETY_TEST, CONTRACT_TEST, EDGES_TEST, WAIT_EMAILS_TEST, LABELS_TEST]) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      expect(text, file).toMatch(/Example [A-Z][a-z]+ (?:Club|Open)/)
    }
    for (const file of [EVENTS_TEST, CONTRACT_TEST, WAIT_EMAILS_TEST, LABELS_TEST]) {
      for (const address of read(file).match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
    }
  })
})
