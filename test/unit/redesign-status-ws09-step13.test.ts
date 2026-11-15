// test/unit/redesign-status-ws09-step13.test.ts
//
// REDESIGN_STATUS.md records WS09 step 13: signed links and the run record,
// the fourth step of checkpoint U. Like WS09 step 12's record test, this
// file reads only the WS09 section, from its heading to the WS10 heading.
// Pinned here: this step's block right after WS09 step 12's, and before the
// four lists while it is the latest; the Status line's tail while this step
// is the latest; the block's parts in order and its figures, which must
// agree with each other and with the files they describe; the sentence this
// step added to criterion 13 of the map; the tagged entries of the four
// lists; and the plain-language rules over what the step wrote and the
// files it adds or changes. What a later step will change in the tree (the
// migration count, the next number, the helpers' importers) is read only
// while this step is the latest.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[A-Z]+_(?:CASES|LINE|COUNT|TEXT|AFTER|FILES|TESTS)\\b(?<!PENDING_COUNT)|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
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
const TAG = '(WS09 step 13).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 12: a club in My region'
const STEP = '### WS09 step 13: signed links and the run record'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''

const TOKENS = 'functions/utils/tokens.ts'
const RUNS = 'functions/utils/admin/automations.ts'
const MIGRATION = 'migrations/0068_automation_runs.sql'
const SNAPSHOT = 'drizzle/meta/0013_snapshot.json'
const MEMBER_DELETE = 'functions/api/admin/members/[id].ts'
const TOKEN_TEST = 'test/unit/signed-tokens.test.ts'
const LAGGING = 'test/unit/automation-runs-lagging-run.test.ts'
const RUNS_TEST = 'test/integration/automation-runs.test.ts'
/** The tests written beside the step's own, which hold the edges of the two helpers and of the secret's names. */
const EDGES = ['test/unit/signed-tokens-edges.test.ts', 'test/unit/automation-detail-masking.test.ts', 'test/unit/signing-secret-names.test.ts', 'test/integration/automation-runs-table.test.ts']
const SELF = 'test/unit/redesign-status-ws09-step13.test.ts'
/** The files this step adds, the unit tests among them, and the new tests whose cases the Files part counts. */
const NEW_FILES = [TOKENS, RUNS, MIGRATION, SNAPSHOT, TOKEN_TEST, LAGGING, RUNS_TEST, ...EDGES, SELF]
const NEW_UNIT = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
const NEW_TESTS = NEW_FILES.filter((f) => /\.test\.tsx?$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.tsx?$/.test(f))
/** The files lint reads that this step adds. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.tsx?$/.test(f))
/** The files this step changes, its own lines alone in the shared ones. */
const CHANGED = ['functions/db/schema.ts', MEMBER_DELETE, 'functions/types.ts', 'test/a11y/global-setup.ts', '.env.example', 'drizzle/meta/_journal.json', 'migrations/README.md']
/** The tests whose pins this step moves. */
const MOVED = ['test/unit/drizzle-baseline.test.ts', 'test/unit/db-generate-guard.test.ts', 'test/unit/seed-fixtures.test.ts', 'test/unit/schema-drift.test.ts', 'test/unit/db-generate-real-kit.test.ts']
/** The files the mail stream holds, which this step leaves alone. */
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  expect((text.match(/^\s*for \(.*\) \{\n\s*it\(/gm) ?? []).length, `${file}: no case in a loop`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out, line comments and block comments alike. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('REDESIGN_STATUS.md, WS09 step 13: the block', () => {
  it('sits once, right after WS09 step 12\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latestStep === 13 && latestBlock === STEP) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestStep === 13 && latestBlock === STEP) {
      expect(tail).toBe('checkpoints S and T merged into `main` on Sun, Nov 15, 2026; checkpoint U goes on on its own branch; steps 1 to 13, K\'s answers to checkpoint S\'s review and K\'s second answer, the Clubs page on a narrow phone, are built.')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying what the step builds, for whom, and what ships', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the fourth step of checkpoint U', 'draws no page and adds no endpoint', '`functions/utils/tokens.ts`', '`functions/utils/admin/automations.ts`', '`automation_runs`',
      '`0068_automation_runs.sql`', 'to WS06', 'to WS08', 'WS09 step 14', 'WS09 step 27', 'Nothing calls either helper in this step', 'one empty table more',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **Tokens.**', '- **Runs.**', '- **Package-free.**', '- **The table.**', '- **The member delete.**', '- **The generator\'s run.**',
      '- **The map.**', '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**',
      '- **What ships with every switch off.**', '- **Owed before clubKeepers goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })

  it('names every file it adds and changes, each new test with its count, and the two sub-lines, and leaves the held files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...MOVED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const file of NEW_FILES) expect(existsSync(join(ROOT, file)), file).toBe(true)
    expect(files).toContain('  - Grown with no change: none by a case.')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of [`\`${LAGGING}\``, ...EDGES.map((f) => `\`${f}\``), `\`${TOKEN_TEST}\` in place of the step's \`test/unit/tokens.test.ts\``, 'No file the mail stream holds is touched', '`functions/utils/mail/links.ts`', ...HELD.map((f) => `\`${f}\``)]) {
      expect(beyond, piece).toContain(piece)
    }
    for (const file of HELD) expect(read(file), file).not.toMatch(/automation_runs|SIGNING_SECRET|utils\/tokens|recordRun/)
    expect(read('test/unit/tokens.test.ts')).toContain('// The design tokens in src/index.css (WS01 step 21).')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 13: the parts against the files', () => {
  it('names the tokens\' signatures and choices as the file holds them', () => {
    const tokens = bullet(block, '- **Tokens.**')
    for (const piece of [
      '`signToken(secret, purpose, claim, ttlSeconds, now = new Date())`', '`readToken(secrets, purpose, token, now)`', '`sealToken(secret, purpose, claim, ttlSeconds, now = new Date())`',
      '`openToken(secrets, purpose, token, now)`', '`v1.s.<payload>.<mac>`', '`v1.x.<header>.<iv>.<body>`', '`lca-token:v1:sign`', '`lca-token:v1:seal`', 'whole seconds since 1970',
      'forged first, then `wrong_purpose`, then `expired`', '`crypto.subtle.verify`', 'never throw', '4,096 characters', '32 characters', 'a fresh random 96-bit iv',
      'signed, not hidden', 'ids only, never an email address or a name', '`TokenKeyMissing`', '`key_missing`', `\`${TOKEN_TEST}\``,
    ]) expect(tokens, piece).toContain(piece)
    const code = codeOf(TOKENS)
    expect(code).toContain('export async function signToken(secret: string | null | undefined, purpose: string, claim: TokenClaim, ttlSeconds: number, now: Date = new Date()): Promise<string>')
    expect(code).toContain('export async function readToken(secrets: TokenSecrets, purpose: string, token: string, now: Date): Promise<TokenRead>')
    expect(code).toContain('export async function sealToken(secret: string | null | undefined, purpose: string, claim: TokenClaim, ttlSeconds: number, now: Date = new Date()): Promise<string>')
    expect(code).toContain('export async function openToken(secrets: TokenSecrets, purpose: string, token: string, now: Date): Promise<TokenRead>')
    for (const piece of ["const SIGN_LABEL = 'lca-token:v1:sign'", "const SEAL_LABEL = 'lca-token:v1:seal'", 'export const MAX_TOKEN_LENGTH = 4096', 'export const MIN_SECRET_LENGTH = 32', 'const IV_BYTES = 12', "const VERSION = 'v1'"]) {
      expect(code, piece).toContain(piece)
    }
    expect(code).not.toMatch(/^\s*import /m)
    expect(code).not.toMatch(/===\s*(?:mac|expected)|console\./)
    for (const name of ['A valid token reads back', 'Expired at the second', 'A changed byte is forged', 'Another purpose is refused', 'The earlier key still reads', 'A sealed claim cannot be read without the key', 'No key is a plain refusal']) {
      expect(read(TOKEN_TEST), name).toContain(`  it('${name[0].toLowerCase()}${name.slice(1)}', async () => {`)
    }
  })

  it('names the run record\'s signatures, its started row and its detail as the file holds them', () => {
    const runs = bullet(block, '- **Runs.**')
    for (const piece of [
      '`recordRun(db, job, fn)`', '`lastRun(db, job)`', '`RunReport`', '`ThrownRun`', 'A started row carries the outcome `failed`, no `finished_at` and no counts', '`ORDER BY started_at DESC, id DESC`',
      'never a secret, a token or an email address', '`[address]`', '`[hidden]`', '200 characters', '`RUN_NOT_RECORDED_LOG`', 'naming no person', `\`${RUNS_TEST}\``,
    ]) expect(runs, piece).toContain(piece)
    const code = codeOf(RUNS)
    expect(code).toContain('export async function recordRun<T extends RunReport>(db: D1Database, job: string, fn: () => Promise<T>): Promise<T | ThrownRun>')
    expect(code).toContain('export async function lastRun(db: D1Database, job: string): Promise<AutomationRun | null>')
    expect(code).toContain("INSERT INTO automation_runs (job, outcome) VALUES (?, 'failed') RETURNING id")
    expect(code).toContain('ORDER BY started_at DESC, id DESC LIMIT 1')
    expect(code).toContain('export const MAX_DETAIL_LENGTH = 200')
    expect(code).not.toMatch(/^\s*import /m)
    expect(read(RUNS_TEST)).toContain('  it(\'records a thrown phase as failed and does not throw on\', async () => {')
    expect(read(RUNS_TEST)).toContain('  it(\'records a run once, with its counts and its outcome, opened as failed while it runs\', async () => {')
  })

  it('names the package-free walk, the table and the member delete as the files hold them', () => {
    const free = bullet(block, '- **Package-free.**')
    for (const piece of ['`test/unit/mail-worker-closure.test.ts`, copied and not edited', 'no package', 'a throwaway bundle', 'empty list']) expect(free, piece).toContain(piece)
    if (latestStep === 13) expect(read(LAGGING)).toContain('const IMPORTERS: string[] = []')
    const table = bullet(block, '- **The table.**')
    for (const piece of ['to the letter', 'ten columns', '`idx_automation_runs_job`', '41 tables and 400 columns, 40 and 390 on the base']) expect(table, piece).toContain(piece)
    const sql = read(MIGRATION)
    for (const piece of [
      'CREATE TABLE automation_runs (', '  id INTEGER PRIMARY KEY AUTOINCREMENT,', '  job TEXT NOT NULL,', "  started_at TEXT NOT NULL DEFAULT (datetime('now')),", '  finished_at TEXT,',
      "  outcome TEXT NOT NULL CHECK (outcome IN ('ok','partial','failed')),", '  sent_count INTEGER, failed_count INTEGER,', '  detail TEXT,', '  seen_at TEXT, seen_by TEXT REFERENCES members(id)\n);',
      'CREATE INDEX idx_automation_runs_job ON automation_runs(job, started_at);', '-- drizzle/0013_automation_runs.sql.',
    ]) expect(sql, piece).toContain(piece)
    expect(sql.split('\n')[0]).toBe('-- 0068_automation_runs.sql')
    const del = bullet(block, '- **The member delete.**')
    for (const piece of ['`RUN_MARKS_UNCLEARED_LOG`', '`isMissingTableOrColumn`', 'before the batch of WS09 step 4', '`{"success":true,"authDeleted":false}`', '`functions/api/me/children/[id].ts`, is not changed']) {
      expect(del, piece).toContain(piece)
    }
    const handler = codeOf(MEMBER_DELETE)
    expect(handler).toContain("await context.env.DB.prepare('UPDATE automation_runs SET seen_by = NULL WHERE seen_by = ?').bind(memberId).run()")
    expect(handler.indexOf('UPDATE automation_runs')).toBeLessThan(handler.indexOf('await context.env.DB.batch(['))
    expect(handler).toContain('console.warn(RUN_MARKS_UNCLEARED_LOG)')
    expect(read('functions/types.ts')).toContain('  SIGNING_SECRET?: string\n  SIGNING_SECRET_PREVIOUS?: string\n')
    expect(read('test/a11y/global-setup.ts')).toContain("  'SIGNING_SECRET',\n  'SIGNING_SECRET_PREVIOUS',\n] as const")
    expect(read('.env.example')).toMatch(/^# SIGNING_SECRET=$/m)
    expect(read('.env.example')).toMatch(/^# SIGNING_SECRET_PREVIOUS=$/m)
  })

  it('names the generator\'s run and the pins as the journal, the snapshot and the README hold them, while this step is the latest', () => {
    const run = bullet(block, '- **The generator\'s run.**')
    for (const piece of ['`npm run db:generate -- automation runs --custom --number 0068`', 'its fourteenth entry, idx 13, tag `0013_automation_runs`', '"No schema changes, nothing to migrate"', 'No file was renamed by hand']) {
      expect(run, piece).toContain(piece)
    }
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of [...MOVED, 'test/unit/redesign-status-ws08-step2-claims.test.ts', 'test/unit/migration-safety.test.ts']) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('Not moved: `test/unit/migration-safety.test.ts`, 19 links')
    if (latestStep !== 13) return
    const journal = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: Array<{ idx: number; tag: string }> }
    expect(journal.entries).toHaveLength(14)
    expect(journal.entries.at(-1)).toMatchObject({ idx: 13, tag: '0013_automation_runs' })
    const snapshot = JSON.parse(read(SNAPSHOT)) as { prevId: string; tables: Record<string, { columns: Record<string, unknown> }> }
    expect(snapshot.prevId).toBe((JSON.parse(read('drizzle/meta/0012_snapshot.json')) as { id: string }).id)
    expect(Object.keys(snapshot.tables.automation_runs.columns)).toHaveLength(10)
    expect(nextMigrationNumber(readdirSync(join(ROOT, 'migrations')))).toBe('0069')
    const readme = read('migrations/README.md').replace(/\s+/g, ' ')
    for (const piece of ['the automation runs `0068`; `0069` is next', '`0069_club_notes.sql`', 'with `0068_automation_runs.sql` in this folder it gives `0069` next']) expect(readme, piece).toContain(piece)
    expect(read('test/unit/migration-safety.test.ts')).toContain('expect(links()).toHaveLength(19)')
    expect(read('test/unit/schema-drift.test.ts')).toContain('expect(counted).toBe(400)')
    expect(read('test/unit/drizzle-baseline.test.ts')).toContain("expect(sql.at(-1)).toBe('0068_automation_runs.sql')")
  })

  it('names the map\'s sentence, the branch and what the merge does, with the figures while this step is the latest', () => {
    for (const piece of ['20 items', 'one sentence added to criterion 13', 'It proves no item in full']) expect(bullet(block, '- **The map.**'), piece).toContain(piece)
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-u`', '`ff917fa`', 'This step\'s diff is against `ff917fa`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of [
      'One migration and no handler', '101 handler files', '33 of the 140 methods', '`PENDING_COUNT` 107', 'must be seen green before the live check', 'a failed run means the merge is not finished until it is run again and passes',
      'the member delete alone reads the new table', 'the merge needs no order between the site\'s build and the migration run', '`deploy-worker.yml` redeploys the daily-emails worker',
    ]) expect(does, piece).toContain(piece)
    if (latestStep !== 13) return
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(33)
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 107')
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(101)')
  })

  it('answers what main\'s code does on this database, what a revert leaves, what ships with every switch off and what is owed', () => {
    for (const piece of ['names no `automation_runs`', 'migrations 0065 to 0068', 'one empty table it never reads']) expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**'), piece).toContain(piece)
    for (const piece of ['leaves the table', 'empty and read by nothing', 'as WS09 step 12 left it']) expect(bullet(block, '- **What a revert leaves.**'), piece).toContain(piece)
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** One empty table and two helpers nothing calls.')).toBe(true)
    for (const piece of ['byte for byte', 'with the table there and with it not there yet', 'No switch is added']) expect(ships, piece).toContain(piece)
    const owed = bullet(block, '- **Owed before clubKeepers goes on.**')
    for (const piece of ['K\'s part', '`SIGNING_SECRET`', 'one value for production and a different one for the Preview environment', '32 random bytes or more', 'No value is set anywhere']) {
      expect(owed, piece).toContain(piece)
    }
    expect(read('src/lib/features.ts')).toContain('  clubKeepers: false,')
    expect(read('src/lib/features.ts')).not.toMatch(/SIGNING|automation|tokens/)
  })

  it('gives the lint as unchanged and the build\'s figures as the base\'s', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-T8w975b5.js` 556,219 bytes', '`index-DURnNUWK.css` 134,731 bytes', '`features-nZCZoT6G.js` 729 bytes', 'byte for byte',
      '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 13: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `ff917fa`\'s tree')
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
    expect([num(before), Number(beforeFiles)]).toEqual([9859, 406])
    const fresh = NEW_UNIT.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    expect(num(before) + fresh).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts as the base\'s with the new files added', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2404, 134])
    expect(num(before) + NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the lint files as the base\'s with the new files lint reads added, and the build\'s file count once on each side', () => {
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1091)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_LINTED.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(built?.[2])
    expect(built?.[1]).toBe(checked?.[1])
    expect(bullet(block, '- **Build.**')).toContain(`\`dist/assets\` holds ${built?.[1]} files, as on the base`)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 13: the map and the lists', () => {
  it('adds one sentence to criterion 13, before the planned step, and to no other item', () => {
    const item = mapItem('Criterion 13')
    expect(item.split('Built in WS09 step 13: ')).toHaveLength(2)
    expect(item.indexOf('Built in WS09 step 13: ')).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    expect(item.endsWith('Planned: WS09 step 14.')).toBe(true)
    expect(item).toContain(`\`${TOKEN_TEST}\``)
    expect(item).toContain(`\`${RUNS_TEST}\``)
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 13:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 13'])
  })

  it('records the step\'s decisions, deviations, verify items and follow-ups, each tagged', () => {
    expect(tagged(decisions).map(head)).toEqual(['The tokens\' form and rules (WS09 step 13).', 'A started run reads as failed (WS09 step 13).'])
    expect(tagged(deviations).map(head)).toEqual(['Built ahead of their owners (WS09 step 13).', 'A fourth answer when no secret is set (WS09 step 13).', 'The token tests\' file (WS09 step 13).'])
    expect(tagged(verify).map(head)).toEqual(['No expiring token exists (WS09 step 13).', 'Who expects the table (WS09 step 13).', 'The brief\'s token (WS09 step 13).', 'The table\'s columns (WS09 step 13).'])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed (?:on `ff917fa`|against)/)
    expect(tagged(followUps).map(head)).toEqual([
      'The staging snapshot beside the mail stream\'s (WS09 step 13).', 'K\'s signing secret, owed before clubKeepers goes on (WS09 step 13).', 'Each job\'s expected interval (WS09 step 13).',
      'The worker\'s deploy at the merge (WS09 step 13).',
    ])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 13: plain language', () => {
  const written = [
    block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps),
    mapItem('Criterion 13').slice(mapItem('Criterion 13').indexOf('Built in WS09 step 13: ')), statusLine,
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
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds, and its own lines of the files it changes', () => {
    // The moved tests held such words before this step and are not read whole; the README is.
    for (const file of [...NEW_FILES.filter((f) => f !== SNAPSHOT), 'migrations/README.md']) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
    // .env.example, functions/types.ts and the schema held other lines before this step; their own lines are read alone.
    const own = [
      read('.env.example').slice(read('.env.example').indexOf('# Server-side secrets')),
      between(read('functions/types.ts'), '   * The secret the expiring tokens', 'SIGNING_SECRET_PREVIOUS?: string'),
      between(read('functions/db/schema.ts'), '/**\n * One row for each run of a scheduled job', "index('idx_automation_runs_job')"),
      between(read(MEMBER_DELETE), "  // Migration 0068's one reference", '    console.warn(RUN_MARKS_UNCLEARED_LOG)'),
    ]
    for (const text of own) {
      expect(text).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text).not.toMatch(rule)
    }
  })

  it('writes the tests\' keys, names and places plainly made up, reading no key from the environment', () => {
    for (const file of [TOKEN_TEST, LAGGING, RUNS_TEST, ...EDGES.filter((f) => !f.includes('signing-secret-names'))]) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env|SIGNING_SECRET/)
      expect(text, file).not.toMatch(/@(?!(?:[a-z0-9-]+\.)*example\.org|testing-library|\/|domain|vitest)[a-z]/)
    }
    expect(read(TOKEN_TEST)).toContain("const KEY = 'example-signing-key-not-a-real-one-0001'")
  })
})
