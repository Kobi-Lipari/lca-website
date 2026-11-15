// test/unit/redesign-status-ws09-step16.test.ts
//
// REDESIGN_STATUS.md records WS09 step 16: the representative's grant, the
// first of the plan's four steps of checkpoint V. Like WS09 step 14's record
// test, this file reads only the WS09 section, from its heading to the WS10
// heading. Pinned here: this step's block right after the block of
// checkpoint V's first step, and before the four lists while it is the
// latest; the Status line's tail while this step is the latest; the block's
// parts in order and its figures, which must agree with each other and with
// the files they describe; the two sentences this step added to the map;
// the tagged entries of the lists; and the plain-language rules over what
// the step wrote and the files it adds. What a later step will change in
// the tree (the next number, the journal, the column count, the handler
// count, the contracted methods) is read only while this step is the latest.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MANAGER_ONLY_TOURNAMENT_KEYS } from '../../domain/contracts/events'
import { creationGrantSchema } from '../../domain/contracts/me'
import { contracts } from '../../domain/contracts/registry'
import { WAITING_FOR_APPROVAL } from '../../domain/events/approval'
import { nextMigrationNumber } from '../../scripts/db/generate'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[A-Z]+_(?:CASES|LINE|COUNT|TEXT|AFTER|FILES|TESTS|NAME|SIZE)\\b(?<!PENDING_COUNT)|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
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
const TAG = '(WS09 step 16).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 checkpoint V: what checkpoint U\'s pictures asked'
const STEP = '### WS09 step 16: the representative\'s grant'
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
const latest = latestStep === 16 && latestBlock === STEP

const MIGRATION = 'migrations/0070_club_event_approval.sql'
const SNAPSHOT = 'drizzle/meta/0015_snapshot.json'
const APPROVAL = 'domain/events/approval.ts'
const RULES = 'domain/events/creation.ts'
const SERVER = 'functions/utils/events/creation.ts'
const MEMBER_DELETE = 'functions/api/admin/members/[id].ts'
const COLUMNS_TEST = 'test/integration/public-tournament-columns.test.ts'
const APPROVAL_TEST = 'test/unit/event-approval.test.ts'
const MIGRATION_TEST = 'test/unit/migration-0070-club-event-approval.test.ts'
const CELLS_TEST = 'test/unit/creation-region-rules.test.ts'
const HANDLERS_TEST = 'test/integration/region-grant-handlers.test.ts'
const GRANT_TEST = 'test/integration/creation-grant.test.ts'
const SELF = 'test/unit/redesign-status-ws09-step16.test.ts'
/** The files this step adds, the tests among them. */
const NEW_FILES = [MIGRATION, SNAPSHOT, APPROVAL, COLUMNS_TEST, HANDLERS_TEST, APPROVAL_TEST, MIGRATION_TEST, CELLS_TEST, SELF]
const NEW_TESTS = NEW_FILES.filter((f) => /\.test\.tsx?$/.test(f))
const NEW_UNIT = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
const NEW_INTEGRATION = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
const NEW_LINTED = NEW_FILES.filter((f) => /\.tsx?$/.test(f))
/** The files this step changes, its own lines alone in the shared ones. */
const CHANGED = [
  'functions/db/schema.ts', 'functions/types.ts', 'drizzle/meta/_journal.json', RULES, SERVER, 'domain/contracts/events.ts', 'domain/contracts/me.ts',
  MEMBER_DELETE, 'migrations/README.md', GRANT_TEST,
]
/** The tests whose pins this step moves. */
const MOVED = [
  'test/unit/drizzle-baseline.test.ts', 'test/unit/db-generate-guard.test.ts', 'test/unit/redesign-status-ws08-step2-claims.test.ts', 'test/unit/seed-fixtures.test.ts',
  'test/unit/schema-drift.test.ts', 'test/unit/db-generate-real-kit.test.ts', 'test/unit/migration-safety.test.ts', 'test/unit/fixtures/drizzle-sql/drop-quoted-parent.sql',
  'test/unit/public-answer.test.ts', 'test/unit/contracts-layer.test.ts', 'test/integration/contracts/tournaments-readers.test.ts', 'test/unit/me-contract.test.ts',
  'test/unit/automation-runs-lagging-run.test.ts',
]
/** The files the mail stream holds, which this step leaves alone. */
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
const FOUR = ['needs_lca_approval', 'approval_requested_at', 'approved_at', 'approved_by']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/**
 * A file's cases as vitest counts them, for a file whose every case is a plain
 * `it(` line or an `it.each([...])` over a written list, which vitest counts
 * once for each item of the list.
 */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:test|describe)\.each\(/gm) ?? []).length, `${file}: no each but it.each`).toBe(0)
  const each = [...text.matchAll(/^\s*it\.each(\()?/gm)]
  const lists = [...text.matchAll(/^\s*it\.each\(\[([^\]\n]*)\]\)\(/gm)]
  expect(lists.length, `${file}: every it.each over a written list`).toBe(each.length)
  const items = lists.reduce((n, list) => n + list[1].split(',').filter((item) => item.trim() !== '').length, 0)
  return (text.match(/^\s*it\(/gm) ?? []).length + items
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out, line comments and block comments alike. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('REDESIGN_STATUS.md, WS09 step 16: the block', () => {
  it('sits once, right after checkpoint V\'s first step, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest, and leaves the PR line\'s merges as they were', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      expect(tail).toBe('checkpoints S and T merged into `main` on Sun, Nov 15, 2026, and checkpoint U, steps 10 to 14 with the two small steps of K\'s decision 7, merged on the same day as pull request 132, and all three are live; checkpoint V is under way on `redesign/ws09-clubs-v`, its first step mending, behind `clubKeepers`, what checkpoint U\'s pictures showed, and WS09 step 16 giving the regional representative\'s grant and the four columns of the approval wait, behind `regionEvents`; WS09 step 15 follows as a pull request of its own; steps 1 to 14 and 16, K\'s answers to checkpoint S\'s review and K\'s second answer, the Clubs page on a narrow phone, are built.')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(prLine.match(/pull request \d+/g)).toEqual(['pull request 130', 'pull request 131', 'pull request 132'])
  })

  it('opens by saying where the step sits, that step 15 is still to come, K\'s answer and what it builds', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the first of the plan\'s four steps of checkpoint V (steps 16 to 19)', 'WS09 step 15, the worker\'s one line, is still to come', 'choice 6 with (a)',
      'K\'s decision 1 of Friday, November 13, 2026', '`regionEvents` and `REGION_EVENTS_ON`', 'always at $0', '`0070_club_event_approval.sql`', '`regional_rep`', '`mayList`',
      '`approved_by`', 'No page, no email, no route, no endpoint and no switch is added',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The number.**', '- **The table.**', '- **The generator\'s run.**', '- **The grant.**', '- **The cells.**',
      '- **The wait.**', '- **The member delete.**', '- **The answers that carry a tournament row.**', '- **The readers of the public answers.**',
      '- **The map (criterion 14\'s grants, D21 and D24).**', '- **Step 15.**', '- **The branch.**', '- **What the merge does.**',
      '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**',
      '- **Owed before regionEvents goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })

  it('names every file it adds and changes, each new test with its count, the two sub-lines, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const file of NEW_FILES) expect(existsSync(join(ROOT, file)), file).toBe(true)
    expect(files).toContain(`\`${GRANT_TEST}\` (54, 46 on the base: `)
    expect(files).toContain('  - Grown with no change: `test/unit/domain-boundaries.test.ts` by one case')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['`functions/types.ts`', '`domain/contracts/me.ts`', '`test/unit/fixtures/drizzle-sql/drop-quoted-parent.sql`', 'No file the mail stream holds is touched', 'Nothing under `src/` changes', ...HELD.map((f) => `\`${f}\``)]) {
      expect(beyond, piece).toContain(piece)
    }
    for (const file of [...HELD, 'src/lib/features.ts', 'src/App.tsx', 'domain/contracts/registry.ts', 'test/unit/contracts-pending.ts', 'test/unit/fixtures/api-added-since-split.json']) {
      expect(read(file), file).not.toMatch(/needs_lca_approval|approved_by|regional_rep'|regionClubIds|APPROVALS_UNCLEARED_LOG|mayList/)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 16: the parts against the files', () => {
  it('names the number, the table and the generator\'s run as the migration, the schema and the journal hold them', () => {
    for (const piece of ['`0070`, not the entry\'s `0069`', '`0068_automation_runs.sql` and `0069_club_check_marks.sql`', '`0065` to `0071`', '`0071` is the next file']) {
      expect(bullet(block, '- **The number.**'), piece).toContain(piece)
    }
    const table = bullet(block, '- **The table.**')
    for (const piece of ['four statements', '`needs_lca_approval INTEGER NOT NULL DEFAULT 0`', '`approved_by TEXT REFERENCES members(id)`', 'no table is rebuilt and no row is changed', '42 tables and 406 columns, 42 and 402 on the base', '20 links']) {
      expect(table, piece).toContain(piece)
    }
    const sql = read(MIGRATION)
    expect(sql.split('\n')[0]).toBe('-- 0070_club_event_approval.sql')
    expect(sql).toContain('-- drizzle/0015_club_event_approval.sql.')
    expect(sql).toContain([
      'ALTER TABLE tournaments ADD COLUMN needs_lca_approval INTEGER NOT NULL DEFAULT 0;',
      'ALTER TABLE tournaments ADD COLUMN approval_requested_at TEXT;',
      'ALTER TABLE tournaments ADD COLUMN approved_at TEXT;',
      'ALTER TABLE tournaments ADD COLUMN approved_by TEXT REFERENCES members(id);',
    ].join('\n'))
    const schema = read('functions/db/schema.ts')
    for (const line of ["  needsLcaApproval: integer('needs_lca_approval').default(0).notNull(),", "  approvedBy: text('approved_by').references(() => members.id),"]) expect(schema, line).toContain(line)
    const run = bullet(block, '- **The generator\'s run.**')
    for (const piece of ['`npm run db:generate -- club event approval --custom --number 0070`', 'Sunday, November 15, 2026', 'sixteenth entry, idx 15, tag `0015_club_event_approval`', '"No schema changes, nothing to migrate"', 'gives `0071`', 'No file was renamed by hand']) {
      expect(run, piece).toContain(piece)
    }
    expect(readdirSync(join(ROOT, 'drizzle'))).toEqual(['meta'])
  })

  it('names the grant and the person as the database half holds them, the constant read inside the function', () => {
    const grant = bullet(block, '- **The grant.**')
    for (const piece of ['`regional_rep`', '`regionClubIdsOf`', '`getRegionalClubIds`', 'the one seat rule the tree has', 'added regions', 'a guest gets none', 'whatever `CREATION_ROLES_ON` is', 'leaves `regionClubIds` out', '`creationGrantSchema`']) {
      expect(grant, piece).toContain(piece)
    }
    const code = codeOf(SERVER)
    expect(code).toContain("import { getRegionalClubIds } from '../admin/permissions'")
    expect(code).toContain("import { REGION_EVENTS_ON } from '../clubs/pages'")
    expect(code).toContain("  if (!REGION_EVENTS_ON || member.role === 'guest') return []")
    expect(code).toContain("  if ((await regions()).length > 0) return 'regional_rep'")
    expect(code).toContain('  if (!REGION_EVENTS_ON) return { grant: await creationGrant(db, member, rolesOn), memberId: member.id, repClubId }')
    expect(code).not.toMatch(/FROM seat_regions|board_seat_assignments a\s+JOIN board_members s ON s\.id = a\.seat_id\s+JOIN seat_regions/)
    expect(creationGrantSchema.options).toEqual(['admin', 'president', 'standing_director', 'club_rep', 'regional_rep', 'none'])
    expect(read(RULES)).toContain("export type CreationGrant = 'admin' | 'president' | 'standing_director' | 'club_rep' | 'regional_rep' | 'none'")
  })

  it('names the cells as the rules hold them, the fee refusal ahead of the line that lets everyone charge', () => {
    const cells = bullet(block, '- **The cells.**')
    for (const piece of ['keyed on the event\'s club, not on the grant\'s name', 'before the line that lets everyone charge', 'That order is the point', `\`${CELLS_TEST}\``, 'The existing tests pass unchanged']) {
      expect(cells, piece).toContain(piece)
    }
    const fees = between(codeOf(RULES), 'export function canChargeFees(', '\n}\n')
    expect(fees.indexOf('if (regionAlone(person, event.clubId)) return false')).toBeGreaterThan(-1)
    expect(fees.indexOf('if (regionAlone(person, event.clubId)) return false')).toBeLessThan(fees.indexOf('if (!rolesOn) return true'))
    expect(codeOf(RULES)).toContain("  return person.grant !== 'admin' && !repsClub(person, clubId) && inRegion(person, clubId)")
    expect(codeOf(RULES)).toContain('  if (inRegion(person, event.clubId) && event.createdBy === person.memberId) return true')
    expect(codeOf(RULES)).toContain("const MAY_CHARGE: ReadonlySet<CreationGrant> = new Set<CreationGrant>(['admin', 'president', 'standing_director', 'club_rep'])")
  })

  it('names the wait, its words and its file as they stand', () => {
    const wait = bullet(block, '- **The wait.**')
    expect(wait).toContain(`"${WAITING_FOR_APPROVAL}"`)
    expect(WAITING_FOR_APPROVAL).toBe('This event is waiting for LCA approval. An LCA admin publishes it.')
    for (const piece of ['`mayList(event)`', 'Nothing calls it yet', 'WS09 steps 17 to 19', `\`${APPROVAL_TEST}\``]) expect(wait, piece).toContain(piece)
    // Nothing under functions/ or src/ imports the rule yet.
    const importers = ['functions', 'src'].flatMap((dir) => (readdirSync(join(ROOT, dir), { recursive: true }) as string[])
      .filter((f) => /\.tsx?$/.test(f)).map((f) => `${dir}/${f}`).filter((f) => read(f).includes('events/approval\'')))
    if (latest) expect(importers).toEqual([])
  })

  it('names the member delete\'s clear as the handler holds it, outside step 13\'s span and before the batch', () => {
    const del = bullet(block, '- **The member delete.**')
    for (const piece of ['`APPROVALS_UNCLEARED_LOG`', '`isMissingTableOrColumn`', 'before the batch of WS09 step 4', '`{"success":true,"authDeleted":false}`', `\`${COLUMNS_TEST}\``, `\`${MIGRATION_TEST}\``]) {
      expect(del, piece).toContain(piece)
    }
    const handler = codeOf(MEMBER_DELETE)
    expect(handler).toContain("await context.env.DB.prepare('UPDATE tournaments SET approved_by = NULL WHERE approved_by = ?').bind(memberId).run()")
    expect(handler).toContain('console.warn(APPROVALS_UNCLEARED_LOG)')
    expect(handler.indexOf('console.warn(RUN_MARKS_UNCLEARED_LOG)')).toBeLessThan(handler.indexOf('UPDATE tournaments SET approved_by'))
    expect(handler.indexOf('UPDATE tournaments SET approved_by')).toBeLessThan(handler.indexOf('await context.env.DB.batch(['))
    expect(read(MEMBER_DELETE)).toContain("export const APPROVALS_UNCLEARED_LOG = 'member delete: the approval column of migration 0070 could not be read; the delete goes on without it'")
  })

  it('names every answer that carries a tournament row, and the four keys among the manager-only keys', () => {
    const answers = bullet(block, '- **The answers that carry a tournament row.**')
    for (const piece of [
      '`GET /api/tournaments` and `GET /api/tournaments/[id]`', '`MANAGER_ONLY_TOURNAMENT_KEYS`', '`POST /api/admin/tournaments`', '`PATCH /api/admin/tournaments/[id]/registration`',
      '`GET /api/admin/tournaments/[id]/manage`', 'all four are strict with every key required', 'No export carries a tournament row', 'Checkpoint S\'s answer stands',
    ]) expect(answers, piece).toContain(piece)
    expect([...MANAGER_ONLY_TOURNAMENT_KEYS]).toEqual(['created_by', 'keep_apart', 'report_settings', 'review_notified_at', ...FOUR])
    const readers = bullet(block, '- **The readers of the public answers.**')
    for (const file of ['src/areas/events/api.ts', 'src/lib/http.ts', 'src/pages/WorkspacePage.tsx', 'src/pages/TournamentDetailPage.tsx', 'src/pages/TournamentPairingsPage.tsx', 'src/pages/TournamentPrintPage.tsx']) {
      expect(readers, file).toContain(`\`${file}\``)
      expect(existsSync(join(ROOT, file)), file).toBe(true)
    }
    expect(readers).toContain('A key a reader does not know is ignored.')
  })

  it('names the branch, what the merge does and the figures while this step is the latest', () => {
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-v`', '`c476203`', 'this step\'s diff is against `c476203`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of [
      'One migration and no handler', '103 handler files', '36 of the 143 methods', '`PENDING_COUNT` 107', 'must be seen green before the live check',
      '"table tournaments has no column named needs_lca_approval"', 'The create is the one path that needs the migration first', '`deploy-worker.yml` redeploys the daily-emails worker',
    ]) expect(does, piece).toContain(piece)
    expect(read(COLUMNS_TEST)).toContain('.rejects.toThrow(/has no column named needs_lca_approval/)')
    if (!latest) return
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(36)
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 107')
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(103)')
    expect(nextMigrationNumber(readdirSync(join(ROOT, 'migrations')))).toBe('0071')
    const journal = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: Array<{ idx: number; tag: string }> }
    expect(journal.entries).toHaveLength(16)
    expect(journal.entries.at(-1)).toMatchObject({ idx: 15, tag: '0015_club_event_approval' })
    expect(read('test/unit/schema-drift.test.ts')).toContain('expect(counted).toBe(406)')
    expect(read('test/unit/migration-safety.test.ts')).toContain('expect(links()).toHaveLength(20)')
    expect(read('migrations/README.md').replace(/\s+/g, ' ')).toContain('the club event approval `0070`; `0071` is next')
  })

  it('answers what main\'s code does on this database, what a revert leaves, what ships with every switch off and what is owed', () => {
    const old = bullet(block, '- **What `main`\'s code does on this step\'s database.**')
    for (const piece of ['`needs_lca_approval` 0', '`approval_requested_at`, `approved_at` and `approved_by` null', 'no person\'s id', 'nothing draws them', 'this direction needs no order', 'need not be turned off']) {
      expect(old, piece).toContain(piece)
    }
    for (const piece of ['leaves the four columns', 'read by nothing']) expect(bullet(block, '- **What a revert leaves.**'), piece).toContain(piece)
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Four columns more on `tournaments` once 0070 has run, which nothing live writes and which no public answer carries')).toBe(true)
    for (const piece of [
      'byte for byte the base\'s with the four columns there and with them not there yet', 'A seat holder\'s grant is none, as today', 'an empty list for everyone',
      'The member delete answers as on the base in both worlds', 'no switch is added', '`REGION_EVENTS_ON` stays unset until WS09 steps 17 to 19',
      'with no approval mark', 'still refuses a club rep', 'any director the representative names', `\`${HANDLERS_TEST}\``,
    ]) {
      expect(ships, piece).toContain(piece)
    }
    expect(read('functions/utils/clubs/pages.ts')).toContain('export const REGION_EVENTS_ON = false')
    expect(read('src/lib/features.ts')).toContain('  regionEvents: false,')
    expect(bullet(block, '- **Owed before regionEvents goes on.**')).toContain('Nothing new from this step.')
    expect(bullet(block, '- **Step 15.**')).toContain('Still to come')
  })

  it('names its pins, and the moved checks hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('Not moved: `test/unit/routes.test.ts`, 103 handler files; `test/unit/contracts-pending.ts`, `PENDING_COUNT` 107')
    expect(read('test/unit/redesign-status-ws08-step2-claims.test.ts')).toContain('    expect([...keys.slice(0, 4)].sort()).toEqual(keys.slice(0, 4))\n')
    expect(read('test/unit/automation-runs-lagging-run.test.ts')).toContain('.toEqual([RUN_MARKS_UNCLEARED_LOG, APPROVALS_UNCLEARED_LOG])')
    expect(read('test/unit/drizzle-baseline.test.ts')).toContain("expect(sql.at(-1)).toBe('0070_club_event_approval.sql')")
  })

  it('gives the lint as unchanged and the build\'s figures', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', 'byte for byte the base\'s, by its sha256', '`index-BfU-3DzB.js` is 557,579 bytes', '`index-B9z7qSj6.css` 134,857 bytes', '`features-nZCZoT6G.js` 729 bytes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(build, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 16: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `c476203`\'s tree')
  })

  it('counts as many cases for each new test as the file holds', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
  })

  it('gives unit counts that add up: the base\'s, the new files\' and the two cases grown with no change', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([10216, 430])
    expect(num(before) + NEW_UNIT.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + 2).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts as the base\'s with the new file and the eight cases of the grant\'s test added', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2541, 143])
    expect(num(before) + NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + (54 - 46)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the lint files as the base\'s with the new files lint reads added, and the build\'s file count as the base\'s', () => {
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1132)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_LINTED.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.slice(1)).toEqual(['207', '207'])
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 16: the map and the lists', () => {
  it('adds one sentence to criterion 14 and one to D24, each before the planned step, and to no other item', () => {
    for (const id of ['Criterion 14', 'D24']) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 16: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 16: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
      expect(item, id).toContain(`\`${CELLS_TEST}\``)
    }
    expect(mapItem('Criterion 14')).toMatch(/Planned: WS09 step 18\.$/)
    expect(mapItem('D24')).toMatch(/Planned: WS09 step 17\.$/)
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 16:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 14', 'D24'])
  })

  it('records the step\'s deviations, verify items and follow-ups, each tagged, and no decision of its own', () => {
    expect(tagged(part(LISTS[0]))).toEqual([])
    expect(tagged(deviations).map(head)).toEqual([
      'The number 0070 (WS09 step 16).', 'The grant\'s name in the creation answer (WS09 step 16).', 'The cells in a file of their own (WS09 step 16).', 'More tests move than the entry names (WS09 step 16).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'Five grants today (WS09 step 16).', 'The brief on the fee list (WS09 step 16).', 'Everyone may charge while the roles switch is off (WS09 step 16).',
      'The public answers send the whole row (WS09 step 16).', 'No approval columns (WS09 step 16).', 'The record\'s handoff (WS09 step 16).', 'The seat rule (WS09 step 16).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed (?:on `c476203`|in the brief|in this file)/)
    expect(tagged(followUps).map(head)).toEqual([
      'The clubs work\'s last kept number (WS09 step 16).', 'The staging snapshot 0015 beside the mail stream\'s (WS09 step 16).',
      'The migration run at checkpoint V\'s merge (WS09 step 16).', 'A member who created an event (WS09 step 16).',
    ])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 16: plain language', () => {
  const written = [
    block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps),
    ...['Criterion 14', 'D24'].map((id) => mapItem(id).slice(mapItem(id).indexOf('Built in WS09 step 16: '))), statusLine,
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
    for (const file of [...NEW_FILES.filter((f) => f !== SNAPSHOT), RULES, SERVER, MEMBER_DELETE, 'domain/contracts/me.ts', GRANT_TEST]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
    // domain/contracts/events.ts held other lines before this step; its own lines are read alone.
    const contract = read('domain/contracts/events.ts')
    const own = [
      between(contract, '  /** 1: a regional representative', '  /** 1: entering needs'),
      between(contract, ' * since the Phase 0 trim, review_notified_at since WS08 step 2, and the', '] as const'),
    ]
    for (const text of own) {
      expect(text).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text).not.toMatch(rule)
    }
  })

  it('writes the tests\' people, clubs and places plainly made up, reading no setting from the environment', () => {
    for (const file of [COLUMNS_TEST, HANDLERS_TEST, APPROVAL_TEST, MIGRATION_TEST, CELLS_TEST]) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
    }
    for (const file of [COLUMNS_TEST, MIGRATION_TEST]) expect(read(file), file).toContain('Example Chess Club')
  })
})
