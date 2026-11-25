// test/unit/redesign-status-ws09-step25.test.ts
//
// REDESIGN_STATUS.md records WS09 step 25: the limit and the spam check, the
// first of the plan's seven steps of checkpoint X. Like WS09 step 24's
// record test, this file reads only the WS09 section, from its heading to
// the WS10 heading. Pinned here: this step's block right after step 24's,
// and before the four lists while it is the latest; the Status line's tail
// while this step is the latest; the block's parts in order and its
// figures, which must agree with each other and with the files they
// describe; the sentences this step added to the map; the tagged entries of
// the lists; and the plain-language rules over what the step wrote and the
// files it adds. No line here reads how a switch ships.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
import { nextMigrationNumber } from '../../scripts/db/generate'
import { PENDING_CONTRACTS } from './contracts-pending'
import { migrationFiles } from './helpers/sqlite'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|[${String.fromCharCode(0x27e6, 0x27e7)}]|\\b[A-Z]+[0-9]*_[A-Z_0-9]+\\b(?!\`)`)
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
const TAG = '(WS09 step 25).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
// Checkpoint W's three later blocks stand between step 24's and this one since
// checkpoint X took them in, the last of them straight before this block.
// Since checkpoint X took checkpoint W in with main as it stands, checkpoint W's five newer blocks stand between
// that one and this, so the order is held, and the neighbour only while this block is the latest.
const PREVIOUS = '### Checkpoint W: WS09 the written page reads as a page'
const STEP = '### WS09 step 25: the limit and the spam check'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
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
const latest = latestStep === 25 && latestBlock === STEP

const LIMIT = 'functions/utils/rateLimit.ts'
const SPAM = 'functions/utils/spamCheck.ts'
const WIDGET = 'src/areas/clubs/components/SpamCheck.tsx'
const LOADER = 'src/areas/clubs/spamCheckScript.ts'
const MIGRATION = 'migrations/0071_rate_limits.sql'
const SNAPSHOT = 'drizzle/meta/0016_snapshot.json'
const CONFIRM = 'functions/api/clubs/confirm/[token].ts'
const PAGE = 'src/pages/ClubConfirmPage.tsx'
const HARNESS = 'test/integration/harness.ts'
const SETUP = 'test/a11y/global-setup.ts'
const SELF = 'test/unit/redesign-status-ws09-step25.test.ts'
const NEW_FILES = [MIGRATION, SNAPSHOT, LIMIT, SPAM, WIDGET, LOADER]
const NEW_TESTS = [
  'test/integration/rate-limit.test.ts', 'test/integration/rate-limit-confirm.test.ts', 'test/integration/rate-limit-lagging-run.test.ts', 'test/integration/spam-check.test.ts',
  'test/unit/spam-check.test.ts', 'test/unit/spam-check-widget.test.tsx', 'test/unit/club-confirm-page-limit.test.tsx', 'test/unit/migration-0071-rate-limits.test.ts',
  'test/unit/rate-limit-boundaries.test.ts', 'test/integration/rate-limit-edges.test.ts', 'test/integration/rate-limit-confirm-edges.test.ts', 'test/integration/rate-limit-ipv6.test.ts',
  'test/unit/spam-check-edges.test.ts', 'test/unit/spam-check-widget-edges.test.tsx', 'test/unit/spam-check-keys-names-only.test.ts', 'test/unit/spam-check-widget-focus.test.tsx', SELF,
]
const CHANGED = ['functions/db/schema.ts', 'drizzle/meta/_journal.json', CONFIRM, 'functions/types.ts', '.env.example', SETUP, 'src/vite-env.d.ts', PAGE, 'functions/utils/clubs/migrationLag.ts', HARNESS, 'migrations/README.md']
/** The test files whose checks this step makes false, each changed in place. */
const MOVED = [
  'test/unit/drizzle-baseline.test.ts', 'test/unit/db-generate-guard.test.ts', 'test/unit/redesign-status-ws08-step2-claims.test.ts', 'test/unit/seed-fixtures.test.ts',
  'test/unit/schema-drift.test.ts', 'test/unit/db-generate-real-kit.test.ts', 'test/unit/migration-safety.test.ts', 'test/unit/migration-0070-club-event-approval.test.ts',
  'test/unit/redesign-status-ws09-step16.test.ts',
]
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
const UNTOUCHED = [
  'src/lib/features.ts', 'functions/utils/clubs/pages.ts', 'src/lib/nav.ts', 'scripts/seed/fixtures.sql', 'playwright.config.ts', 'wrangler.toml', 'src/App.tsx', 'domain/contracts/registry.ts',
  'test/unit/contracts-pending.ts', 'test/unit/fixtures/api-added-since-split.json', 'functions/api/contact.ts', 'functions/utils/clubs/publicAnswer.ts', 'functions/utils/events/publicAnswer.ts',
  'test/unit/features.test.ts', 'test/unit/nav.test.ts', 'test/unit/sweep-fixes.test.tsx', 'test/unit/club-confirm-page.test.tsx', 'test/unit/my-region-page.test.tsx',
  'test/unit/my-region-club-page.test.tsx', 'test/integration/public-answer-columns.test.ts', 'test/integration/club-seed-live.test.ts',
  'test/integration/club-columns-stay-off-answers.test.ts', 'test/integration/club-roster-kept-back.test.ts',
]
const num = (text: string) => Number(text.replace(/,/g, ''))
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A file's plain cases: every `it(` line; none of this step's files draws cases from a table. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, file).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** A quoted constant's words in a file's code. */
const wordsOf = (file: string, name: string) => /'((?:[^'\\]|\\.)*)'/.exec(codeOf(file).slice(codeOf(file).indexOf(`export const ${name} = `)))?.[1].replace(/\\'/g, '\'') ?? ''

describe('REDESIGN_STATUS.md, WS09 step 25: the block', () => {
  it('sits once, right after step 24\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings.indexOf(PREVIOUS)).toBeGreaterThanOrEqual(0)
    expect(headings.indexOf(PREVIOUS)).toBeLessThan(headings.indexOf(STEP))
    if (latest) expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest, and keeps the section\'s heading and the pull request numbers', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'checkpoint X is under way on `redesign/ws09-clubs-x`, cut from checkpoint W\'s head', 'WS09 step 25, the limit and the spam check, adds one empty table and two helpers no form calls yet',
        'the monthly check\'s confirm endpoints taking 30 calls an hour wherever `CLUB_KEEPERS_ON` is on', 'the sitemap of step 24, step 25,', 'WS09 step 15 follows as its own pull request',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens by saying where the step sits, what it builds, and that no endpoint, contract or switch is added', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the first of the plan\'s seven steps of checkpoint X (steps 25 to 31)', '`redesign/ws09-clubs-x`', 'checkpoint W\'s browser half comes as a step of its own',
      'WS09 step 15, the worker\'s one line, is still to come', `\`${LIMIT}\``, '`rate_limits`', '`0071_rate_limits.sql`', `\`${SPAM}\``, `\`${WIDGET}\``,
      'No page draws the check and no form calls either helper yet', '30 calls an hour', 'No endpoint, no contract and no switch is added',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The limit.**', '- **Fails closed.**', '- **The spam check.**', '- **The widget.**', '- **The confirm endpoints.**', '- **The harness.**',
      '- **Shapes handed on.**', '- **The map (criteria 4 and 8, the guards).**', '- **The migration.**', '- **The branch.**', '- **What the merge does.**',
      '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Owed before newClubs goes on.**',
      '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })

  it('names every file it adds and changes, each new test with its count, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...NEW_TESTS, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...NEW_TESTS]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    expect(bullet(files, '  - Grown with no change:')).toContain('none')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['No file the mail stream holds is touched', ...HELD.map((f) => `\`${f}\``), ...UNTOUCHED.map((f) => `\`${f}\``)]) expect(beyond, piece).toContain(piece)
    for (const file of [...HELD, 'src/lib/features.ts', 'functions/utils/clubs/pages.ts', 'src/App.tsx', 'domain/contracts/registry.ts', 'test/unit/contracts-pending.ts']) {
      expect(read(file), file).not.toMatch(/rateLimit|spamCheck|SpamCheck|TURNSTILE|rate_limits|WS09 step 25/)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 25: the parts against the files', () => {
  it('says how the limit counts, as the file does', () => {
    const limit = bullet(block, '- **The limit.**')
    for (const piece of [
      '`limit(env, request, route, { perHour, key? })`', '`CF-Connecting-IP`', '`X-Forwarded-For`', 'HMAC-SHA-256', 'the HMAC of `SIGNING_SECRET` over the text "rate-limit"',
      'never stored, never logged and never part of an answer', '`ON CONFLICT (bucket) DO UPDATE SET hits = hits + 1 RETURNING hits`', 'of twelve calls made together under a limit of five, five are allowed',
      'the route\'s one shared count', 'deleted in the same batch',
    ]) expect(limit, piece).toContain(piece)
    expect(limit).toContain(`"${wordsOf(LIMIT, 'TOO_MANY')}"`)
    expect(wordsOf(LIMIT, 'TOO_MANY')).toBe('Too many messages from here. Try again in an hour.')
    const code = codeOf(LIMIT)
    expect(code).toContain('export const ADDRESS_HEADER = \'CF-Connecting-IP\'')
    expect(code).toContain('export const LIMITER_KEY_LABEL = \'rate-limit\'')
    expect(code).toContain('\'INSERT INTO rate_limits (bucket, hits, window_start) VALUES (?, 1, ?) ON CONFLICT (bucket) DO UPDATE SET hits = hits + 1 RETURNING hits\',')
    expect(code).toContain('env.DB.prepare(\'DELETE FROM rate_limits WHERE window_start < ?\').bind(hour),')
  })

  it('says how it fails closed, and the one thing it lets through, as the file does', () => {
    const closed = bullet(block, '- **Fails closed.**')
    for (const piece of ['`SIGNING_SECRET` missing, empty or shorter than the 32 characters', '503', 'writes no row and never falls back to an unkeyed hash', 'Only a database before migration 0071 is let through', 'any other error is not caught']) {
      expect(closed, piece).toContain(piece)
    }
    expect(closed).toContain(`"${wordsOf(LIMIT, 'CANT_SEND_NOW')}"`)
    expect(closed).toContain(`"${wordsOf(LIMIT, 'RATE_LIMITS_MISSING_LOG')}"`)
    expect(codeOf(LIMIT)).toContain('if (typeof secret !== \'string\' || secret.length < MIN_SECRET_LENGTH) return { ok: false, status: 503, error: CANT_SEND_NOW }')
    expect(codeOf(LIMIT)).toContain('    if (!isMissingTableOrColumn(err)) throw err\n    console.warn(RATE_LIMITS_MISSING_LOG)\n')
  })

  it('says what the spam check sends, waits for and refuses, as the file does', () => {
    const spam = bullet(block, '- **The spam check.**')
    for (const piece of [
      '`checkSpam(env, token, request)`', '`https://challenges.cloudflare.com/turnstile/v0/siteverify`', 'five seconds', '`success` is true', '`TURNSTILE_SECRET_KEY`',
      'in production and everywhere else', 'The one exception is the provider\'s own published test secret', 'Nothing passes silently', 'The visitor\'s network address is not sent',
    ]) expect(spam, piece).toContain(piece)
    expect(spam).toContain(`"${wordsOf(LIMIT, 'CANT_SEND_NOW')}"`)
    const code = codeOf(SPAM)
    expect(code).toContain('export const SITEVERIFY_URL = \'https://challenges.cloudflare.com/turnstile/v0/siteverify\'')
    expect(code).toContain('export const SPAM_CHECK_TIMEOUT_MS = 5_000')
    expect(code).toContain('return (answer as { success: boolean }).success === true ? { ok: true } : refuse(403)')
  })

  it('says how the widget loads, hands back and fails, as the files do', () => {
    const widget = bullet(block, '- **The widget.**')
    for (const piece of ['`https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`', 'only when it is drawn', 'never at page load', '`onToken`', '"Spam check"', '`min-h-11`', 'nothing moves on by itself']) {
      expect(widget, piece).toContain(piece)
    }
    expect(widget).toContain('"The spam check didn\'t load. Try again."')
    expect(read(WIDGET)).toContain('const DIDNT_LOAD = \'The spam check didn\\\'t load. Try again.\'')
    expect(read(WIDGET)).toContain('const FRAME_TITLE = \'Spam check\'')
    expect(codeOf(LOADER)).toContain('export const SPAM_CHECK_SCRIPT = \'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit\'')
    expect(read(WIDGET)).not.toMatch(/#[0-9a-f]{3,8}\b/i)
  })

  it('says how the confirm endpoints take the limit and what the page shows, as the files do', () => {
    const endpoints = bullet(block, '- **The confirm endpoints.**')
    for (const piece of ['30 calls an hour from one place', '`LINK_CALLS_AN_HOUR`', 'only once the token holds', 'the base\'s 403', 'the base\'s 400 with no statement run', 'today\'s 503', 'to the byte', '429 now joins its refusals']) {
      expect(endpoints, piece).toContain(piece)
    }
    expect(codeOf(CONFIRM)).toContain('export const LINK_CALLS_AN_HOUR = 30')
    expect(endpoints).toContain(`"${wordsOf(CONFIRM, 'LINK_NO_KEY')}"`)
    expect(read(PAGE)).toContain('const REFUSALS = new Set([400, 403, 404, 410, 429, 503])')
    expect(read(PAGE)).toContain('const LOG_IN_HELPS = new Set([400, 410, 503])')
  })

  it('names the harness\'s three hunks, after the mail stream\'s lines, as the file holds them', () => {
    const harness = bullet(block, '- **The harness.**')
    for (const piece of ['`spamCheckBehavior`', '`spamCheckRequests`', '`resetHarness`', 'straight after the SNS block', 'changes no line of the mail stream\'s']) expect(harness, piece).toContain(piece)
    const text = read(HARNESS)
    const sns = text.indexOf('return new Response(\'harness: no such path on Amazon SNS\', { status: 404 })')
    const catchPoint = text.indexOf('if (url.hostname === \'challenges.cloudflare.com\' && url.pathname === \'/turnstile/v0/siteverify\') {')
    expect(sns).toBeGreaterThan(-1)
    expect(catchPoint).toBeGreaterThan(sns)
    // The scanner's block, after it; its name is put together so that this file does not hold it.
    expect(catchPoint).toBeLessThan(text.indexOf(`// ${'Anth' + 'ropic'}: the scanner's vision model.`))
    expect(text).toContain('export const spamCheckBehavior: { answer: \'pass\' | \'fail\' | \'none\' } = { answer: \'pass\' }')
    expect(text).toContain('  anthropicRequests.length = 0\n  spamCheckBehavior.answer = \'pass\'\n  spamCheckRequests.length = 0\n}')
  })

  it('hands on both signatures as the files export them', () => {
    const shapes = bullet(block, '- **Shapes handed on.**')
    expect(shapes).toContain('`limit(env, request, route, { perHour, key? }): Promise<LimitAnswer>`')
    expect(shapes).toContain('`{ ok: true } | { ok: false; status: 429 | 503; error: string }`')
    expect(shapes).toContain('`checkSpam(env, token, request): Promise<SpamAnswer>`')
    expect(shapes).toContain('`{ ok: true } | { ok: false; status: 403 | 503; error: string }`')
    expect(codeOf(LIMIT)).toContain('export async function limit(env: LimitEnv, request: Request, route: string, options: LimitOptions): Promise<LimitAnswer> {')
    expect(codeOf(LIMIT)).toContain('export type LimitAnswer = { ok: true } | { ok: false; status: 429 | 503; error: string }')
    expect(codeOf(SPAM)).toContain('export async function checkSpam(env: SpamEnv, token: unknown, request: Request): Promise<SpamAnswer> {')
    expect(codeOf(SPAM)).toContain('export type SpamAnswer = { ok: true } | { ok: false; status: 403 | 503; error: string }')
  })

  it('gives the migration as the generator made it, and the folder\'s figures from the tree', () => {
    const migration = bullet(block, '- **The migration.**')
    for (const piece of ['`npm run db:generate -- rate limits --number 0071`', '`drizzle/0016_rate_limits.sql`', 'idx 16, tag `0016_rate_limits`', 'No file was renamed by hand', '"No schema changes, nothing to migrate"', 'no production or preview database was read or written']) {
      expect(migration, piece).toContain(piece)
    }
    // Since checkpoint X took checkpoint W in a third time, the generator stages it as 0018, after main's seat listing, and the header names that.
    expect(read(MIGRATION)).toContain('-- staged as drizzle/0018_rate_limits.sql.')
    const journal = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: Array<{ idx: number; tag: string }> }
    expect(journal.entries.some((e) => e.idx === 18 && e.tag === '0018_rate_limits')).toBe(true)
    if (!latest) return
    expect(migration).toContain(`${migrationFiles().length} files in \`migrations/\``)
    expect(migration).toContain('43 tables of 409 columns and 20 links between tables')
    expect(migration).toContain(`gives \`${nextMigrationNumber(readdirSync(join(ROOT, 'migrations')))}\` next`)
    expect(journal.entries).toHaveLength(17)
    expect(read('test/unit/schema-drift.test.ts')).toContain('expect(counted).toBe(409)')
    expect(read('test/unit/migration-safety.test.ts')).toContain('expect(links()).toHaveLength(20)')
    expect(read('migrations/README.md').replace(/\s+/g, ' ')).toContain('the rate limits `0071`; `0072` is next')
  })

  it('names the branch, the merge, the database, a revert, what ships and what is owed', () => {
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-x`', '`ad47e8a`', 'neither checkpoint V nor checkpoint W is on `main` yet', 'this step\'s diff is against `ad47e8a`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['`0071_rate_limits.sql`', '105 handler files', '41 of the 145 methods', '`PENDING_COUNT` 104', 'Apply database migrations run must be seen green before the live check']) {
      expect(does, piece).toContain(piece)
    }
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('names `rate_limits`')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('no address among them')
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of [
      'One empty table, `rate_limits`, and two helpers no form calls', 'with `clubKeepers` unset or set', '`GET` and `POST /api/clubs/confirm/:token`',
      'the one live path that reads the new table', 'until the thirtieth call in an hour from one place', 'Where the migration run lags the site\'s build, each call writes one log line',
      'No address is in any row or log line', 'No switch is added',
    ]) expect(ships, piece).toContain(piece)
    const owed = bullet(block, '- **Owed before newClubs goes on.**')
    expect(owed).toContain('Step 24\'s thirteen, with this step\'s')
    expect(owed.split('\n').filter((l) => /^\s+- /.test(l))).toHaveLength(16)
    for (const piece of ['`TURNSTILE_SECRET_KEY`', '`VITE_TURNSTILE_SITE_KEY`', '`SIGNING_SECRET` for every public form', 'only when the form opens', 'past ones included']) expect(owed, piece).toContain(piece)
  })

  it('names each moved pin by its file, and the names stand where the step 13 pins read them', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('no earlier test file changes its count of cases')
    expect(read('functions/types.ts')).toContain('  SIGNING_SECRET?: string\n  SIGNING_SECRET_PREVIOUS?: string\n')
    expect(read(SETUP)).toContain('  \'SES_SNS_TOPIC_ARN\',\n  // The spam check\'s two keys')
    expect(read(SETUP)).toContain('  \'TURNSTILE_SECRET_KEY\',\n  \'VITE_TURNSTILE_SITE_KEY\',\n')
    expect(read(SETUP)).toContain('  \'SIGNING_SECRET\',\n  \'SIGNING_SECRET_PREVIOUS\',\n] as const')
    expect(read('.env.example')).toContain('\nVITE_TURNSTILE_SITE_KEY=\n')
    expect(read('.env.example')).toContain('\n# TURNSTILE_SECRET_KEY=\n')
    // The figure read from the routes' own test, so a later route moves nothing here: 105 at this step, a later figure since checkpoint X took checkpoint W in.
    expect(Number(/expect\(real\.filter\(\(r\) => r\.startsWith\('api\/'\)\)\.length\)\.toBe\((\d+)\)/.exec(read('test/unit/routes.test.ts'))?.[1])).toBeGreaterThanOrEqual(105)
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
    if (!latest) return
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(41)
    expect(PENDING_CONTRACTS).toHaveLength(104)
  })

  it('gives the lint as the base\'s, the build\'s figures, the one chunk that moves, and the worker\'s dry run', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `ad47e8a`')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-YvQuSpxy.css` at 138,154', '`features-nZCZoT6G.js` at 729', '`ClubConfirmPage-CEaBCw7D.js`, from 3,288 bytes to 3,292',
      'The main script is 559,676 bytes', '`index-Df1Lv5gj.js` for `index-BaGFPaC6.js`', '`challenges.cloudflare.com`, is in no file of `dist/`', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
    // Read the build where one is at hand: while this step is the latest, no file it wrote holds the provider's address.
    if (!latest || !existsSync(join(ROOT, 'dist/assets'))) return
    const built = readdirSync(join(ROOT, 'dist/assets')).filter((f) => /\.(?:js|css)$/.test(f))
    expect(built.filter((f) => read(`dist/assets/${f}`).includes('challenges.cloudflare.com'))).toEqual([])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 25: the Checks line', () => {
  it('gives each figure once, and no browser run of its own', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `ad47e8a`\'s tree')
  })

  it('gives unit and integration counts that add up: the base\'s and the new files\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    expect([num(unit![3]), Number(unit![4])]).toEqual([11114, 476])
    const newUnit = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
    expect(num(unit![3]) + newUnit.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(unit![1]))
    expect(Number(unit![2]) - Number(unit![4])).toBe(newUnit.length)
    // The integration figures count the tests that run, as the gate gives them; the one todo stands beside them.
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing, with the one todo beside them/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect([num(integration![3]), Number(integration![4])]).toEqual([2902, 164])
    const newIntegration = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
    expect(num(integration![3]) + newIntegration.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(integration![1]))
    expect(Number(integration![2]) - Number(integration![4])).toBe(newIntegration.length)
  })

  it('gives the lint files as the base\'s with the new code and test files, and the build\'s file counts', () => {
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(([\d,]+) on the base\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1235)
    const linted = [...NEW_FILES, ...NEW_TESTS].filter((f) => /\.tsx?$/.test(f))
    expect(num(lint![1]) - num(lint![2])).toBe(linted.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[2]).toBe('214')
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 25: the map and the lists', () => {
  it('adds one sentence to criteria 4 and 8, each before its planned step, and to no other item', () => {
    for (const [id, planned] of [['Criterion 4', 34], ['Criterion 8', 27]] as const) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 25: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 25: ')).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
      expect(item.endsWith(`Planned: WS09 step ${planned}.`), id).toBe(true)
      expect(item.slice(item.indexOf('Built in WS09 step 25: ')), id).toContain('`test/integration/rate-limit.test.ts`')
    }
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 25:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 4', 'Criterion 8'])
  })

  it('records the step\'s deviations, verify items and follow-ups, each tagged, adds no decision, and leaves step 14\'s line on the limit as it was', () => {
    expect(tagged(part(LISTS[0]))).toEqual([])
    expect(tagged(deviations).map(head)).toEqual(['The migration\'s number (WS09 step 25).', 'No address sent to the provider (WS09 step 25).', 'The test secret in the browser builds (WS09 step 25).', 'The harness\'s catch point (WS09 step 25).'])
    expect(tagged(verify).map(head)).toEqual([
      'Neither exists (WS09 step 25).', 'The provider\'s check (WS09 step 25).', 'The brief\'s table (WS09 step 25).', 'The harness refuses unknown hosts (WS09 step 25).',
      'How the visitor\'s address is read (WS09 step 25).', 'The confirm tests and the limit (WS09 step 25).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed (?:on `ad47e8a`|in the provider's documentation|in the brief's live-mode section|on this step's tree)/)
    expect(tagged(followUps).map(head)).toEqual([
      'The confirm tests near the limit (WS09 step 25).', 'The shared count of the confirm link (WS09 step 25).', 'A lagging migration counts nothing (WS09 step 25).',
      'The test keys in the browser builds (WS09 step 25).', 'A token is good once (WS09 step 25).',
    ])
    expect(followUps).toContain('- **The link\'s rate limit (WS09 step 14).** Both methods of `/api/clubs/confirm/:token` are rate limited from WS09 step 25 on, as the step\'s entry says.')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 25: plain language', () => {
  const sentences = ['Criterion 4', 'Criterion 8'].map((id) => mapItem(id)).map((item) => item.slice(item.indexOf('Built in WS09 step 25: '), item.search(/ Planned: WS09 step \d+\.$/)))
  const written = [block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps), ...sentences, statusLine].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the step wrote, and dates and times in their plain form', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS]) expect(written).not.toMatch(rule)
    const prose = proseOf(written)
    expect(prose).not.toMatch(UNFILLED)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const found of prose.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b(?!:)/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds, and writes the tests\' people made up, reading no switch\'s shipped value', () => {
    for (const file of [...NEW_FILES, ...NEW_TESTS]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
    for (const file of NEW_TESTS.filter((f) => f !== SELF)) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
      expect(text, file).not.toMatch(/src\/lib\/features|\bfeatures\.\w+|FEATURES\.\w+/)
      // A server switch is never imported: it is read only as a getter on a mock of its module, which the case sets itself.
      expect(text, file).not.toMatch(/import\s*\{[^}]*\b(?:CLUB_PAGES_ON|CLUB_EMAIL_HIDDEN|ROSTER_SHORT_NAMES|CLUB_KEEPERS_ON)\b/)
      for (const name of new Set(text.match(/\b(?:CLUB_PAGES_ON|CLUB_KEEPERS_ON)\b/g) ?? [])) expect(text, `${file} ${name}`).toContain(`get ${name}() {`)
      // Every network address a test writes is from the ranges set aside for documentation.
      for (const address of text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) ?? []) expect(address, file).toMatch(/^(?:192\.0\.2|198\.51\.100|203\.0\.113)\./)
    }
  })
})
