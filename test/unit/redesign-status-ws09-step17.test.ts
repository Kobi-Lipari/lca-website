// test/unit/redesign-status-ws09-step17.test.ts
//
// REDESIGN_STATUS.md records WS09 step 17: create and run in the region, the
// second of the plan's four steps of checkpoint V. Like WS09 step 16's record
// test, this file reads only the WS09 section, from its heading to the WS10
// heading. Pinned here: this step's block right after step 16's, and before
// the four lists while it is the latest; the Status line's tail while this
// step is the latest; the block's parts in order and its figures, which must
// agree with each other and with the files they describe; the callers it
// lists, against the case that runs them; the two sentences this step added
// to the map; the tagged entries of the lists; and the plain-language rules
// over what the step wrote and the files it adds. What a later step will
// change in the tree (the contracted methods, the pending count) is read
// only while this step is the latest.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
import { WAITING_FOR_APPROVAL } from '../../domain/events/approval'
import { FEES_NEED_PAYOUT_ACCOUNT } from '../../domain/events/creation'
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[A-Z]+_(?:CASES|LINE|COUNT|TEXT|AFTER|FILES|TESTS|NAME|SIZE)\\b(?<!PENDING_COUNT)|${'UNIT' + 'NOW'}|${'INT' + 'NOW'}|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
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
const TAG = '(WS09 step 17).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 16: the representative\'s grant'
const STEP = '### WS09 step 17: create and run in the region'
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
const latest = latestStep === 17 && latestBlock === STEP

const EVENTS_TEST = 'test/integration/club-events.test.ts'
const EDGES_TEST = 'test/integration/club-events-edges.test.ts'
const CONTRACT_TEST = 'test/integration/contracts/tournament-directors.test.ts'
const MARKED_TEST = 'test/unit/creation-marked-events.test.ts'
const SELF = 'test/unit/redesign-status-ws09-step17.test.ts'
const PERMISSIONS = 'functions/utils/admin/permissions.ts'
const CREATE = 'functions/api/admin/tournaments.ts'
const SAVE = 'functions/api/admin/tournaments/[id].ts'
const DIRECTORS = 'functions/api/admin/tournaments/[id]/directors.ts'
const SERVER = 'functions/utils/events/creation.ts'
const RULES = 'domain/events/creation.ts'
const NEW_TESTS = [EVENTS_TEST, EDGES_TEST, CONTRACT_TEST, MARKED_TEST, SELF]
const NEW_UNIT = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
const NEW_INTEGRATION = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
/** The files this step changes, its own lines alone in the shared ones. */
const CHANGED = [
  PERMISSIONS, CREATE, SAVE, DIRECTORS, SERVER, RULES, 'domain/events/approval.ts', 'domain/contracts/events.ts', 'domain/contracts/registry.ts',
  'test/unit/contracts-pending.ts', 'test/integration/directors.test.ts', 'test/integration/creation-grant.test.ts', 'test/integration/region-grant-handlers.test.ts',
]
/** The tests whose pins this step moves. */
const MOVED = [
  'test/integration/region-grant-handlers.test.ts', 'test/unit/contracts-pending.ts', 'test/unit/redesign-status-ws09-step16.test.ts',
  'test/unit/redesign-status-ws09-v-asked.test.ts', 'test/unit/redesign-status-ws08-step4-claims.test.ts',
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

describe('REDESIGN_STATUS.md, WS09 step 17: the block', () => {
  it('sits once, right after step 16\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest, and leaves the PR line\'s merges as they were', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      expect(tail).toBe('checkpoints S and T merged into `main` on Sun, Nov 15, 2026, and checkpoint U, steps 10 to 14 with the two small steps of K\'s decision 7, merged on the same day as pull request 132, and all three are live; checkpoint V is under way on `redesign/ws09-clubs-v`, its first step mending, behind `clubKeepers`, what checkpoint U\'s pictures showed, WS09 step 16 giving the regional representative\'s grant and the four columns of the approval wait, and WS09 step 17 the representative\'s club events on the server, created, named and run in the region and held back from listing until an LCA admin approves them, both behind `regionEvents`; WS09 step 15 follows as a pull request of its own; steps 1 to 14, 16 and 17, K\'s answers to checkpoint S\'s review and K\'s second answer, the Clubs page on a narrow phone, are built.')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    // Read only while this block is the latest: the switch-on's block names checkpoint V's own pull request.
    if (latest) expect(prLine.match(/pull request \d+/g)).toEqual(['pull request 130', 'pull request 131', 'pull request 132'])
  })

  it('opens by saying where the step sits, that step 15 is still to come, K\'s answer and what it builds', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the second of the plan\'s four steps of checkpoint V (steps 16 to 19)', 'WS09 step 15, the worker\'s one line, is still to come', 'choice 6 with (a)',
      'K\'s decision 1 of Friday, November 13, 2026', '`regionEvents` and `REGION_EVENTS_ON`', 'always at $0', '`needs_lca_approval` 1', '`canManageTournament`',
      '`mayList` with `WAITING_FOR_APPROVAL`', 'an LCA admin included', 'No page, no email, no route, no table and no switch is added',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The four grants.**', '- **The callers.**', '- **The refusals.**', '- **The price endpoints.**',
      '- **The writes of `is_visible`.**', '- **What a manager reads.**', '- **What the constant costs.**', '- **Q2 stands.**', '- **The directors\' contract.**',
      '- **The copy of an event.**', '- **The map (criterion 14 and D24).**', '- **What regionEvents opens when it goes on.**', '- **Step 15.**', '- **The branch.**',
      '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**',
      '- **Owed before regionEvents goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })

  it('names every file it adds and changes, each new test with its count, the two sub-lines, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_TESTS, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const file of NEW_TESTS) expect(existsSync(join(ROOT, file)), file).toBe(true)
    expect(files).toContain('`test/integration/directors.test.ts` (23, 19 on the base: ')
    expect(files).toContain('`test/integration/creation-grant.test.ts` (56, 54 on the base: ')
    expect(casesIn('test/integration/directors.test.ts')).toBe(23)
    expect(casesIn('test/integration/region-grant-handlers.test.ts')).toBe(22)
    expect(files).toContain('  - Grown with no change: none by a case')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['`functions/api/tournaments.ts`', '`functions/utils/events/publicAnswer.ts`', 'No file the mail stream holds is touched', 'Nothing under `src/` changes', ...HELD.map((f) => `\`${f}\``)]) {
      expect(beyond, piece).toContain(piece)
    }
    for (const file of [...HELD, 'src/lib/features.ts', 'src/App.tsx', 'test/unit/fixtures/api-added-since-split.json']) {
      expect(read(file), file).not.toMatch(/draftedInRegion|WAITING_FOR_APPROVAL|tournamentDirectorsResponseSchema|regionAlone/)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 17: the parts against the files', () => {
  it('names the four grants as the code holds them, each read only while the constant is set', () => {
    const grants = bullet(block, '- **The four grants.**')
    for (const piece of ['`regionAlone`', '`needs_lca_approval` 1', '`repClubId` is left off', '`const clubId = person.repClubId ?? (body.clubId ?? null)`', 'no first director row', '`draftedInRegion`', '`isRegionalRepFor`', 'added regions count', '`requireCanAssign` is unchanged']) {
      expect(grants, piece).toContain(piece)
    }
    const manage = between(codeOf(PERMISSIONS), 'export async function canManageTournament(', '\n}\n')
    expect(manage).toContain('  if (await isTournamentDirector(db, member.id, tournamentId)) return true')
    expect(manage).toContain('  if (!REGION_EVENTS_ON || !clubId) return false\n  return isRegionalRepFor(db, member.id, clubId)')
    expect(manage.indexOf('isTournamentDirector(')).toBeLessThan(manage.indexOf('isRegionalRepFor('))
    expect(read(PERMISSIONS)).toContain("import { REGION_EVENTS_ON } from '../clubs/pages'")
    const create = codeOf(CREATE)
    for (const line of [
      'const asRepresentative = !!body.clubId && regionAlone(person, body.clubId)', 'if (asRepresentative) person = { ...person, repClubId: null }',
      'const clubId = person.repClubId ?? (body.clubId ?? null)', '...(asRepresentative ? { needsLcaApproval: 1 } : {}),', 'person.repClubId === null && !asRepresentative',
    ]) expect(create, line).toContain(line)
    expect(codeOf(SERVER)).toContain('  if (!REGION_EVENTS_ON || event.clubId === null || event.createdBy !== member.id) return false')
    expect(codeOf(SAVE)).toContain('if (member.role !== \'lca_admin\' && !ownsEvent && !(await draftedInRegion(context.env.DB, member, existing))) {')
    expect(codeOf(DIRECTORS)).toContain('const person = await creationPerson(context.env.DB, authed.member, rolesOn)')
  })

  it('lists every caller the case runs, in its order, with the mail stream\'s line', () => {
    const callers = bullet(block, '- **The callers.**')
    const labels = [...read(EVENTS_TEST).matchAll(/\{ label: '([A-Z]+ \/api\/[^']+)'|label: '([A-Z]+ \/api\/[^']+)',/g)].map((m) => m[1] ?? m[2])
    expect(labels).toHaveLength(16)
    const at = labels.map((label) => callers.indexOf(`  - \`${label}\``))
    for (const [i, label] of labels.entries()) expect(at[i], label).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const piece of ['sixteen methods in sixteen files', 'none under `workers/` and none in a file the mail stream holds', '  - For the mail stream:', '`functions/utils/mail/gate.ts`', 'A refund is not among them', '  - Not a caller, the same rule written again: `GET /api/tournaments`']) {
      expect(callers, piece).toContain(piece)
    }
    expect(read('functions/api/registrations/[id].ts')).toContain("'Only an LCA admin can record refunds'")
  })

  it('names the refusals, their words and where they are asked', () => {
    const refusals = bullet(block, '- **The refusals.**')
    expect(refusals).toContain(`"${WAITING_FOR_APPROVAL}"`)
    expect(refusals).toContain(`"${FEES_NEED_PAYOUT_ACCOUNT}"`)
    for (const piece of ['refused 409', 'an LCA admin included', 'compares it with the number 1', 'the one home of the rule', 'approved or not', 'in both states of `CREATION_ROLES_ON`']) expect(refusals, piece).toContain(piece)
    const save = codeOf(SAVE)
    expect(flat(save)).toContain('if (body.isVisible && !mayList({ needs_lca_approval: existing.needsLcaApproval, approved_at: existing.approvedAt })) { return errorResponse(WAITING_FOR_APPROVAL, 409) }')
    expect(save.indexOf('mayList(')).toBeLessThan(save.indexOf('await runBatch(db, queries)'))
    expect(save).toContain('canChargeFees(person, { clubId: existing.clubId, createdBy: existing.createdBy, needsLcaApproval: existing.needsLcaApproval }, rolesOn)')
    const fees = between(codeOf(RULES), 'export function canChargeFees(', '\n}\n')
    const markLine = "  if (event.needsLcaApproval === 1 && person.grant !== 'admin' && !repsClub(person, event.clubId)) return false"
    expect(fees).toContain(markLine)
    expect(fees.indexOf('if (regionAlone(person, event.clubId)) return false')).toBeLessThan(fees.indexOf(markLine))
    expect(fees.indexOf(markLine)).toBeLessThan(fees.indexOf('if (!rolesOn) return true'))
    expect(read('domain/events/approval.ts')).toContain('if (event.needs_lca_approval !== 1) return true')
  })

  it('names the price endpoints, the writes of is_visible and the publish date\'s todo case', () => {
    const prices = bullet(block, '- **The price endpoints.**')
    for (const piece of ['two endpoints, both through the fee check', '`POST /api/admin/tournaments`', '`PATCH /api/admin/tournaments/[id]`', 'there is no gap to report', 'a smaller early discount']) {
      expect(prices, piece).toContain(piece)
    }
    const visible = bullet(block, '- **The writes of `is_visible`.**')
    for (const piece of ['Two, as on the base', 'So no path lists an event marked for approval', 'No `publish_at` column and no scheduled publish exist', '"a publish date is refused before approval"']) {
      expect(visible, piece).toContain(piece)
    }
    expect(read(EVENTS_TEST)).toContain("  it.todo('a publish date is refused before approval')")
    expect(codeOf(CREATE)).toContain('    isVisible: 0,')
  })

  it('says what a manager reads, what the constant costs and that Q2 stands', () => {
    const reads = bullet(block, '- **What a manager reads.**')
    for (const piece of ['Checkpoint S\'s answer stands', '`GET /api/me/tournament-creation` is left as WS09 step 16 left it', 'a page must not take a representative\'s fee from that answer']) {
      expect(reads, piece).toContain(piece)
    }
    const costs = bullet(block, '- **What the constant costs.**')
    for (const piece of ['With `REGION_EVENTS_ON` unset no seat is read', '`canManageTournament` reads the region last', 'through step 16\'s `creationPerson`']) expect(costs, piece).toContain(piece)
    const q2 = bullet(block, '- **Q2 stands.**')
    for (const file of ['test/integration/club-permissions.test.ts', 'test/integration/tournament-create.test.ts', 'test/integration/role-safety.test.ts', 'test/integration/directors-edges.test.ts', 'test/integration/public-tournament-columns.test.ts']) {
      expect(q2, file).toContain(`\`${file}\``)
      expect(existsSync(join(ROOT, file)), file).toBe(true)
    }
  })

  it('names the directors\' contract and its figures, read from the tree while this step is the latest', () => {
    const contract = bullet(block, '- **The directors\' contract.**')
    for (const piece of ['`tournamentDirectorsResponseSchema`', '`tournamentDirectorRequestSchema`', '"memberId is required"', '39 of them contracted, 36 on the base', '`PENDING_COUNT` 104, 107 on the base']) {
      expect(contract, piece).toContain(piece)
    }
    expect(Object.keys(contracts['admin/tournaments/[id]/directors'])).toEqual(['GET', 'POST', 'DELETE'])
    expect(PENDING_CONTRACTS.filter((line) => line.endsWith(' admin/tournaments/[id]/directors'))).toEqual([])
    expect(codeOf(DIRECTORS)).toContain('const body = await parseBody(context.request, tournamentDirectorRequestSchema)')
    expect(read(CONTRACT_TEST)).toContain("contracts['admin/tournaments/[id]/directors'].DELETE")
    if (!latest) return
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(39)
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
    expect(PENDING_CONTRACTS).toHaveLength(104)
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(103)')
  })

  it('gives K the paragraph on what regionEvents opens, in everyday words', () => {
    const opens = bullet(block, '- **What regionEvents opens when it goes on.**')
    for (const piece of ['For K, in everyday words', 'publishing a club\'s own event, taking it off the site', 'create an event for that club', 'choose who directs the events they create', 'whether entering needs an LCA membership', 'run every event of every club in their region', 'seeing who registered with their details', 'US Chess IDs', 'never record a refund', 'A representative of another region gets none of this.']) {
      expect(opens, piece).toContain(piece)
    }
    // C2 of checkpoint V's review: the directors' emails are kept from a representative whose one standing on the event is the region.
    for (const piece of ['and the directors\' names. Corrected in checkpoint V\'s review:', 'is answered the directors without their emails']) expect(opens, piece).toContain(piece)
  })

  it('names the branch, what the merge does, the database, a revert, what ships with every switch off and what is owed', () => {
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-v`', '`7f9bce2`', 'this step\'s diff is against `7f9bce2`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration and no handler file', '103 handler files', '39 of the 143 methods', '`PENDING_COUNT` 104', '`deploy-worker.yml` redeploys the daily-emails worker']) expect(does, piece).toContain(piece)
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('This step changes no table')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('the constant goes off before any revert of this step')
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['every representative gets 403 on all four grants and on every caller', 'with not one query more', 'refuse nothing', '"Invalid JSON body"', 'No switch is added']) expect(ships, piece).toContain(piece)
    // A1 of checkpoint V's review: the three kinds of body answered otherwise than on main, and "each 400 as before" gone.
    expect(['three kinds of body no page sends', 'a body of JSON that is not an object', 'a number such as 7 got 404 "Member not found" on the POST and 200 with the directors\' list on the DELETE', 'each 400 as before'].map((piece) => ships.includes(piece))).toEqual([true, true, true, false])
    expect(read('functions/utils/clubs/pages.ts')).toContain('export const REGION_EVENTS_ON = false')
    expect(read('src/lib/features.ts')).toContain('  regionEvents: false,')
    expect(bullet(block, '- **Owed before regionEvents goes on.**')).toContain('WS09 steps 18 and 19 first')
    expect(bullet(block, '- **Step 15.**')).toContain('Still to come')
  })

  it('names its pins, and the moved checks hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('Not moved: `test/unit/routes.test.ts`, 103 handler files')
    expect(read('test/unit/redesign-status-ws09-step16.test.ts')).toContain('    if (latest) expect(importers).toEqual([])\n')
    expect(read('test/unit/redesign-status-ws09-v-asked.test.ts')).toContain("    if (latest) expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 107')\n")
    expect(read('test/unit/redesign-status-ws08-step4-claims.test.ts')).toContain('needsLcaApproval: existing.needsLcaApproval }, rolesOn)')
    const handlers = read('test/integration/region-grant-handlers.test.ts')
    expect(handlers).toContain('with its creator written and marked for approval (WS09 step 17)')
    expect(handlers).toContain('lets them create for another club in the region as its representative, hidden, marked and at $0 (WS09 step 17)')
  })

  it('gives the lint as unchanged and the build\'s figures', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', 'made from `7f9bce2` in a scratch folder', 'byte for byte the base\'s, by its sha256', '`index-BfU-3DzB.js` is 557,579 bytes', '`index-B9z7qSj6.css` 134,857 bytes', '`features-nZCZoT6G.js` 729 bytes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(build, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 17: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `7f9bce2`\'s tree')
  })

  it('counts as many cases for each new test as the file holds', () => {
    const files = bullet(block, '- **Files.**')
    // WS09 step 18 adds the approval wait's cases to club-events.test.ts, so its count is read only while this step is the latest.
    for (const file of NEW_TESTS) if (latest || file !== EVENTS_TEST) expect(writtenCount(files, file), file).toBe(casesIn(file))
  })

  it('gives unit counts that add up: the base\'s and the new file\'s', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([10280, 434])
    expect(num(before) + NEW_UNIT.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts as the base\'s with the new files and the cases added to the directors\' and the grant\'s tests', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing but the one todo/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2589, 145])
    expect(num(before) + NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + (23 - 19) + (56 - 54)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the lint files as the base\'s with the new files, and the build\'s file count as the base\'s', () => {
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1139)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_TESTS.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.slice(1)).toEqual(['207', '207'])
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 17: the map and the lists', () => {
  it('adds one sentence to criterion 14 and one to D24, each after step 16\'s and before the planned step, and to no other item', () => {
    for (const id of ['Criterion 14', 'D24']) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 17: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 16: '), id).toBeLessThan(item.indexOf('Built in WS09 step 17: '))
      expect(item.indexOf('Built in WS09 step 17: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
      expect(item.slice(item.indexOf('Built in WS09 step 17: ')), id).toContain(`\`${EVENTS_TEST}\``)
    }
    expect(mapItem('Criterion 14')).toMatch(/Planned: WS09 step 18\.$/)
    expect(mapItem('D24')).toMatch(/Planned: WS09 step 17\.$/)
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 17:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 14', 'D24'])
  })

  it('records the step\'s deviations, verify items and follow-ups, each tagged, and no decision of its own', () => {
    expect(tagged(part(LISTS[0]))).toEqual([])
    expect(tagged(deviations).map(head)).toEqual([
      'A refund stays an LCA admin\'s (WS09 step 17).', 'The publish date half of criterion 14 (WS09 step 17).', 'The list\'s own manager rule (WS09 step 17).',
      'The directors\' request passes unknown keys (WS09 step 17).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'A club rep can publish today (WS09 step 17).', 'Where the grants are read (WS09 step 17).', 'No scheduled publish (WS09 step 17).', 'A club rep\'s create is pinned to their club (WS09 step 17).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `7f9bce2`/)
    expect(tagged(followUps).map(head)).toEqual([
      'A publish date before approval (WS09 step 17).', 'Emailing a club event\'s entrants (WS09 step 17).', 'The creation answer for a representative (WS09 step 17).',
      'A deleted club\'s marked events (WS09 step 17).',
    ])
    // D3 of checkpoint V's review, refuted, closed in place all the same.
    expect(entries(followUps).find((l) => l.startsWith('- **The creation answer for a representative (WS09 step 17).**'))).toContain(' Closed in WS09 step 19: the creation steps take a representative\'s fee rule from the club\'s answer')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 17: plain language', () => {
  const written = [
    block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps),
    ...['Criterion 14', 'D24'].map((id) => mapItem(id).slice(mapItem(id).indexOf('Built in WS09 step 17: '))), statusLine,
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
    for (const file of [...NEW_TESTS, PERMISSIONS, CREATE, SAVE, DIRECTORS, SERVER, RULES, 'domain/events/approval.ts', 'functions/api/tournaments.ts', 'functions/utils/events/publicAnswer.ts']) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
    // The shared files held other lines before this step; its own lines are read alone.
    const own = [
      between(read('domain/contracts/events.ts'), ' * POST and DELETE /api/admin/tournaments/[id]/directors', ' * PATCH /api/admin/tournaments/[id]/registration'),
      between(read('domain/contracts/registry.ts'), "  'admin/tournaments/[id]/directors': {", "  'admin/tournaments/[id]/manage': {"),
    ]
    for (const text of own) {
      expect(text).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text).not.toMatch(rule)
    }
  })

  it('writes the tests\' people, clubs and places plainly made up, reading no setting from the environment', () => {
    for (const file of [EVENTS_TEST, EDGES_TEST, CONTRACT_TEST]) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
      if (file !== EDGES_TEST) expect(text, file).toContain('Example Chess Club')
      else expect(text, file).toMatch(/'Example [A-Z][a-z]+ Club'/)
    }
  })
})
