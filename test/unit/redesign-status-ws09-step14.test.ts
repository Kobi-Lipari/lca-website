// test/unit/redesign-status-ws09-step14.test.ts
//
// REDESIGN_STATUS.md records WS09 step 14: the monthly check, the fifth step
// of checkpoint U. Like WS09 step 13's record test, this file reads only the
// WS09 section, from its heading to the WS10 heading. Pinned here: this
// step's block right after the save notice's block, and before the four
// lists while it is the latest; the Status line's tail while this step is
// the latest; the block's parts in order and its figures, which must agree
// with each other and with the files they describe; the sentence this step
// added to criterion 13 of the map; the tagged entries of the four lists;
// and the plain-language rules over what the step wrote and the files it
// adds. What a later step will change in the tree (the migration count, the
// next number, the handler count, the contracted methods) is read only while
// this step is the latest.
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
const TAG = '(WS09 step 14).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 checkpoint U: the save notice at most once an hour'
const STEP = '### WS09 step 14: the monthly check'
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
const latest = latestStep === 14 && latestBlock === STEP

const CHECK = 'functions/utils/clubs/monthlyCheck.ts'
const STILL = 'functions/utils/clubs/stillAccurate.ts'
const LINK = 'functions/api/clubs/confirm/[token].ts'
const BUTTON = 'functions/api/admin/clubs/monthly-check.ts'
const PAGE = 'src/pages/ClubConfirmPage.tsx'
const BUTTON_PART = 'src/areas/clubs/components/MonthlyCheckButton.tsx'
const HEADERS = 'public/_headers'
const MIGRATION = 'migrations/0069_club_check_marks.sql'
const SNAPSHOT = 'drizzle/meta/0014_snapshot.json'
const EMAILS_TEST = 'test/integration/club-check-emails.test.ts'
const EDGES_TEST = 'test/integration/club-check-edges.test.ts'
const LINK_TEST = 'test/integration/club-confirm-link.test.ts'
const CONTRACT_TEST = 'test/integration/contracts/club-confirm.test.ts'
const PAGE_TEST = 'test/unit/club-confirm-page.test.tsx'
const CHECK_TEST = 'test/unit/club-monthly-check.test.ts'
const SELF = 'test/unit/redesign-status-ws09-step14.test.ts'
/** The files this step adds, the tests among them. */
const NEW_FILES = [CHECK, STILL, LINK, BUTTON, PAGE, BUTTON_PART, HEADERS, MIGRATION, SNAPSHOT, EMAILS_TEST, EDGES_TEST, LINK_TEST, CONTRACT_TEST, PAGE_TEST, CHECK_TEST, SELF]
const NEW_TESTS = NEW_FILES.filter((f) => /\.test\.tsx?$/.test(f))
const NEW_UNIT = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
const NEW_INTEGRATION = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
const NEW_LINTED = NEW_FILES.filter((f) => /\.tsx?$/.test(f))
/** The files this step changes, its own lines alone in the shared ones. */
const CHANGED = [
  'functions/utils/clubs/routing.ts', 'functions/utils/clubs/emails.ts', 'functions/api/admin/clubs/[id]/confirm.ts', 'functions/utils/admin/automations.ts',
  'domain/clubs/monthlyCheck.ts', 'domain/contracts/clubs.ts', 'domain/contracts/registry.ts', 'functions/db/schema.ts', 'src/areas/clubs/api.ts', 'src/areas/clubs/region.ts',
  'src/pages/MyRegionPage.tsx', 'src/App.tsx', 'test/unit/fixtures/api-added-since-split.json', 'drizzle/meta/_journal.json', 'migrations/README.md',
]
/** The tests whose pins this step moves. */
const MOVED = [
  'test/unit/routes.test.ts', 'test/unit/redesign-status-ws09-step10.test.ts', 'test/unit/app-routes.test.tsx', 'test/unit/automation-runs-lagging-run.test.ts',
  'test/unit/club-routing-server-only.test.ts', 'test/unit/api-split-modules.test.ts', 'test/unit/drizzle-baseline.test.ts', 'test/unit/db-generate-guard.test.ts',
  'test/unit/seed-fixtures.test.ts', 'test/unit/schema-drift.test.ts', 'test/unit/db-generate-real-kit.test.ts', 'test/unit/migration-safety.test.ts',
]
/** The files the mail stream holds, which this step leaves alone. */
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out, line comments and block comments alike. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('REDESIGN_STATUS.md, WS09 step 14: the block', () => {
  it('sits once, right after the save notice\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      expect(tail).toBe('checkpoints S and T merged into `main` on Sun, Nov 15, 2026; checkpoint U goes on on its own branch, and on K\'s decision 7 the reload of a guarded page is mended at its root there and the save notice goes at most once an hour for one club and one saver, behind `clubKeepers`; steps 1 to 14, K\'s answers to checkpoint S\'s review and K\'s second answer, the Clubs page on a narrow phone, are built.')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying what the step builds and what ships', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the fifth step of checkpoint U', 'first caller of step 13\'s two shared pieces', 'Still accurate', 'Update', '`/clubs/confirm/:token`', '"Send this month\'s check now"',
      '`club_check_marks`', '`0069_club_check_marks.sql`', 'WS09 step 15\'s', 'three methods that refuse in words before anything is read', 'no email', 'no route and no button', 'one empty table more',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The check.**', '- **The due rule.**', '- **The mark.**', '- **The table.**', '- **The generator\'s run.**', '- **The email.**',
      '- **The link.**', '- **An ended seat.**', '- **The page.**', '- **The token in the address.**', '- **The button.**', '- **The press\'s bound.**', '- **Static beside dynamic.**',
      '- **The look.**', '- **Package-free.**', '- **The map (criterion 13).**', '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**',
      '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Owed before clubKeepers goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**',
      '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })

  it('names every file it adds and changes, each new test with its count, and the two sub-lines, and leaves the held files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const file of NEW_FILES) expect(existsSync(join(ROOT, file)), file).toBe(true)
    expect(files).toContain('  - Grown with no change: `test/unit/app-routes.test.tsx` by one case')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of [`\`${STILL}\``, `\`${HEADERS}\``, `\`${CHECK_TEST}\``, 'No file the mail stream holds is touched', ...HELD.map((f) => `\`${f}\``)]) expect(beyond, piece).toContain(piece)
    for (const file of HELD) expect(read(file), file).not.toMatch(/club_check_marks|monthlyCheck|monthly-check|clubs\/confirm/)
    for (const file of ['src/lib/features.ts', 'test/unit/contracts-pending.ts', 'test/unit/mail-worker-closure.test.ts']) expect(read(file), file).not.toMatch(/monthly-check|monthlyCheck|clubs\/confirm/)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 14: the parts against the files', () => {
  it('names the check, its two ways in and its detail as the file holds them', () => {
    const check = bullet(block, '- **The check.**')
    for (const piece of [
      '`seatHoldersWithClubs`', '`SEAT_HOLD`', '`getRegionalClubIds`', 'in numbers alone', '`sendEmailOutcome`', '400 milliseconds', 'before any query and before the run record',
      '32 characters', '`isCheckDue(now)`', '`recordRun`', '`club_monthly_check`', '`TIMED_SENDS`, ten', '`PRESS_SENDS`', 'marked manual', 'does not stop Monday\'s email',
      '"December 2026, manual: 2 sent, 0 not sent, 0 not reached"',
    ]) expect(check, piece).toContain(piece)
    const code = codeOf(CHECK)
    for (const piece of [
      'export const CHECK_JOB = \'club_monthly_check\'', 'export const CONFIRM_PURPOSE = \'club_confirm\'', 'export const LINK_TTL_SECONDS = 30 * 24 * 60 * 60',
      'export const TIMED_SENDS = 10', 'export const PRESS_SENDS = 45', 'if (!CLUB_KEEPERS_ON) return none(\'closed\')', 'if (!signingKeyReady(env)) return none(\'key_missing\')',
      'if (!force && !isCheckDue(now)) return none(\'not_due\')', 'await recordRun(env.DB, CHECK_JOB, async () => {',
    ]) expect(code, piece).toContain(piece)
    expect(code.indexOf('return none(\'not_due\')')).toBeLessThan(code.indexOf('marked = await marksOf('))
    expect(code).not.toMatch(/\bdeliver\(|api\.resend\.com|amazonaws\.com|console\.\w+\([^)]*(?:email|token|full_name)/)
    expect(read('functions/utils/clubs/routing.ts')).not.toMatch(/^\s*import\s/m)
  })

  it('names the mark, its key and the table as the migration and the code hold them', () => {
    const mark = bullet(block, '- **The mark.**')
    for (const piece of [
      'moved to a table of its own', 'a run of 36 characters', 'cut at 200 characters', '`tournament_attendee_reminders`', 'The key is the person, not a seat', '"2026-12-07"',
      'no address and no name', '`INSERT INTO club_check_marks (member_id, month) VALUES (?, ?) ON CONFLICT DO NOTHING`', '`later`', 'ON DELETE CASCADE', '`MARKS_MISSING_LOG`',
      'it never sends unmarked', 'the button works without the table',
    ]) expect(mark, piece).toContain(piece)
    expect(codeOf(CHECK)).toContain('INSERT INTO club_check_marks (member_id, month) VALUES (?, ?) ON CONFLICT DO NOTHING')
    const sql = read(MIGRATION)
    expect(sql.split('\n')[0]).toBe('-- 0069_club_check_marks.sql')
    expect(sql).toContain('CREATE TABLE club_check_marks (\n  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,\n  month TEXT NOT NULL,\n  PRIMARY KEY (member_id, month)\n);')
    expect(sql).toContain('-- drizzle/0014_club_check_marks.sql.')
    for (const piece of ['42 tables and 402 columns, 41 and 400 on the base', '20 links']) expect(bullet(block, '- **The table.**'), piece).toContain(piece)
  })

  it('names the email\'s words as emails.ts holds them, with no unsubscribe line', () => {
    const email = bullet(block, '- **The email.**')
    for (const piece of [
      '"Your region\'s clubs: still accurate?"', '`monthlyCheckEmail`', '`renderEmail`', '`oneLine`', '"How the club meets is not listed yet."', '"Still accurate works without logging in for 30 days, until"',
      '"Tue, Dec 15, 2026"', '8:00 AM', '`club_confirm`', '`{ club, member }`', '2,592,000 seconds', '`/workspace/region/clubs/<id>`', 'no unsubscribe line',
    ]) expect(email, piece).toContain(piece)
    const words = read('functions/utils/clubs/emails.ts')
    expect(words).toContain('export const MONTHLY_CHECK_HEADING = \'Your region\\\'s clubs: still accurate?\'')
    expect(words).toContain('export const LINK_LIFE = \'Still accurate works without logging in for 30 days\'')
    for (const [name, line] of [
      ['MONTHLY_CHECK_WHY', 'You get this because you are a regional representative.'],
      ['MONTHLY_CHECK_TIMED', 'It comes on the first Monday of each month at 8:00 AM.'],
      ['MONTHLY_CHECK_BY_HAND', 'An LCA admin sent this one by hand.'],
    ]) {
      expect(words).toContain(`export const ${name} = '${line}'`)
      expect(email, name).toContain(`"${line}"`)
    }
    expect(email).toContain('"Here are the 2 clubs in your region, for December 2026."')
    expect(words).toContain('in your region, for ${data.month}.')
    expect(words).toContain('import { trySendEmail, type EmailEnv, type EmailMessage } from \'../email\'')
    expect(codeOf('functions/utils/clubs/emails.ts')).not.toMatch(/listFooter|unsubscribe/i)
  })

  it('names the link\'s answers in the handler\'s own words, the shared write, and the switch read first', () => {
    const link = bullet(block, '- **The link.**')
    const code = read(LINK)
    for (const [name, status] of [['LINK_CLOSED', 403], ['LINK_FORGED', 400], ['LINK_EXPIRED', 410], ['LINK_NO_KEY', 503], ['CLUB_GONE', 404], ['MEMBER_GONE', 404], ['SEAT_ENDED', 403]] as const) {
      const words = new RegExp(`export const ${name} = '((?:[^'\\\\]|\\\\.)*)'`).exec(code)![1].replace(/\\'/g, '\'')
      expect(link, name).toContain(`${status} "${words}"`)
    }
    for (const piece of ['`isRegionalRepFor`', '`markStillAccurate`', '`told_updated_at` and `told_by` left as they are', 'no activity row and no email', '`SIGNING_SECRET_PREVIOUS`', '`Referrer-Policy: no-referrer`']) {
      expect(link, piece).toContain(piece)
    }
    for (const method of ['onRequestGet', 'onRequestPost']) {
      const body = between(codeOf(LINK), `export const ${method}`, '\n}\n')
      expect(body.indexOf('if (!CLUB_KEEPERS_ON)'), method).toBeGreaterThan(-1)
      expect(body.indexOf('if (!CLUB_KEEPERS_ON)'), method).toBeLessThan(body.indexOf('opened(context)'))
    }
    expect(read(STILL)).toContain('`UPDATE clubs SET last_confirmed_at = datetime(\'now\'), confirmed_by = ?\n      WHERE id = ?\n      RETURNING last_confirmed_at`')
    expect(codeOf('functions/api/admin/clubs/[id]/confirm.ts')).toContain('await markStillAccurate(context.env.DB, clubId, authResult.member.id)')
    expect(codeOf(LINK)).not.toMatch(/console\.|told_updated_at|told_by|recordAdminAction|sendEmail/)
    expect(bullet(block, '- **An ended seat.**')).toContain('"Your seat no longer covers this club."')
    expect(read(LINK_TEST)).toContain('  it(\'a member whose seat has ended is refused at POST\', async () => {')
  })

  it('names the page, the token in the address and the headers file as the files hold them', () => {
    const page = bullet(block, '- **The page.**')
    for (const piece of ['only while `clubKeepers` is on, before `/clubs/:id`', 'never reads the sign-in context', '"Thanks. Example Chess Club is marked as checked for November 2026."', '`getClubLink`', '`confirmClubByLink`', '"Still accurate"']) {
      expect(page, piece).toContain(piece)
    }
    expect(read('src/App.tsx')).toContain('{FEATURES.clubKeepers && <Route path="/clubs/confirm/:token" element={<ClubConfirmPage />} />}')
    expect(read(PAGE)).not.toMatch(/useAuth|AuthContext|\bfetch\(/)
    const address = bullet(block, '- **The token in the address.**')
    for (const piece of ['`strict-origin-when-cross-origin`', 'the announcement banner', '`public/_headers`', 'no request from the page carried a Referer', '`rel="noopener noreferrer"`']) {
      expect(address, piece).toContain(piece)
    }
    expect(read(HEADERS)).toContain('/clubs/confirm/*\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex\n')
  })

  it('names the button, its bound and the proof of the static addresses', () => {
    const button = bullet(block, '- **The button.**')
    for (const piece of ['`requireAdmin`', '403 "Forbidden"', '"Two-factor authentication is required for admin access. Set it up in your account security settings."', '`send` false', '503', '"Send this month\'s check to 4 people now?"', '"This month\'s check was sent to 3 people; 1 not sent."']) {
      expect(button, piece).toContain(piece)
    }
    expect(read(BUTTON)).toContain('const authResult = await requireAdmin(context.request, context.env)')
    for (const piece of ['50 outside calls and 50 queries', '`PRESS_SENDS` 45', 'how many the press did not reach', 'Workers Paid']) expect(bullet(block, '- **The press\'s bound.**'), piece).toContain(piece)
    const proof = bullet(block, '- **Static beside dynamic.**')
    for (const piece of ['`wrangler pages dev` with `a11yServerArgs`', '403 "The monthly check cannot be sent yet."', '401 "Unauthorized"', '`GET /api/clubs/confirm/logo`', '404 "Club not found"', 'no address was moved']) {
      expect(proof, piece).toContain(piece)
    }
    expect(read(BUTTON)).toContain('export const CHECK_CLOSED = \'The monthly check cannot be sent yet.\'')
  })

  it('names the walk and the nine files the worker would gain', () => {
    const free = bullet(block, '- **Package-free.**')
    for (const file of [
      'domain/clubs/monthlyCheck.ts', 'domain/format/clock.ts', 'functions/utils/admin/automations.ts', 'functions/utils/clubs/emails.ts', 'functions/utils/clubs/migrationLag.ts',
      'functions/utils/clubs/monthlyCheck.ts', 'functions/utils/clubs/pages.ts', 'functions/utils/clubs/routing.ts', 'functions/utils/tokens.ts',
    ]) {
      expect(free, file).toContain(`\`${file}\``)
      expect(read(CHECK_TEST), file).toContain(`'${file}',`)
    }
    expect(free).toContain('nine files, each package-free')
  })

  it('names the branch, what the merge does and the figures while this step is the latest', () => {
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-u`', '`82f197f`', 'This step\'s diff is against `82f197f`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of [
      'One migration and two handlers', '103 handler files', '36 of the 143 methods', '`PENDING_COUNT` 107', 'must be seen green before the live check',
      'the merge needs no order between the site\'s build and the migration run', '`deploy-worker.yml` redeploys the daily-emails worker',
    ]) expect(does, piece).toContain(piece)
    if (!latest) return
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(36)
    expect(Object.keys(contracts)).toEqual(expect.arrayContaining(['clubs/confirm/[token]', 'admin/clubs/monthly-check']))
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 107')
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(103)')
    expect(read('test/unit/app-routes.test.tsx')).toContain('expect(pages.length).toBe(39)')
    expect(nextMigrationNumber(readdirSync(join(ROOT, 'migrations')))).toBe('0070')
    const journal = JSON.parse(read('drizzle/meta/_journal.json')) as { entries: Array<{ idx: number; tag: string }> }
    expect(journal.entries.at(-1)).toMatchObject({ idx: 14, tag: '0014_club_check_marks' })
    expect(read('test/unit/schema-drift.test.ts')).toContain('expect(counted).toBe(402)')
    expect(read('test/unit/migration-safety.test.ts')).toContain('expect(links()).toHaveLength(20)')
    expect(read('migrations/README.md').replace(/\s+/g, ' ')).toContain('the club check marks `0069`; `0070` is next')
  })

  it('answers what main\'s code does on this database, what a revert leaves, what ships with every switch off and what is owed', () => {
    for (const piece of ['names no `club_check_marks`', 'migrations 0065 to 0069', 'one empty table it never reads']) expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**'), piece).toContain(piece)
    for (const piece of ['leaves the table', 'empty and read by nothing']) expect(bullet(block, '- **What a revert leaves.**'), piece).toContain(piece)
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Three methods that refuse in words before anything is read')).toBe(true)
    for (const piece of ['No email', 'No route and no button', 'One empty table more', '`public/_headers`', 'No switch is added']) expect(ships, piece).toContain(piece)
    // Checkpoint U's review, A1: My region is routed, to the dashboard, since WS09 step 11.
    expect(ships.includes('and My region, which carries the button, sends everyone to the dashboard, as WS09 step 11\'s merge left it, so the button is never drawn.') && !ships.includes('is not routed')).toBe(true)
    // clubKeepers and CLUB_KEEPERS_ON went on together in the block "WS09 switch-on: clubKeepers and CLUB_KEEPERS_ON", so this step holds only that each is declared.
    expect(read('functions/utils/clubs/pages.ts')).toMatch(/^export const CLUB_KEEPERS_ON = (?:false|true)$/m)
    expect(read('src/lib/features.ts')).toMatch(/^ {2}clubKeepers: (?:false|true),$/m)
    for (const piece of ['K\'s part', '`SIGNING_SECRET`', '32 random bytes or more']) expect(bullet(block, '- **Owed before clubKeepers goes on.**'), piece).toContain(piece)
  })

  it('names its pins, and the moved checks hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('Not moved: `test/unit/contracts-pending.ts`, `PENDING_COUNT` 107')
    // Moved at WS09 step 27, whose link's file joins the list after these two: they stand first, and a later step may add more.
    expect(read('test/unit/automation-runs-lagging-run.test.ts')).toMatch(/const IMPORTERS: string\[\] = \['functions\/api\/clubs\/confirm\/\[token\]\.ts', 'functions\/utils\/clubs\/monthlyCheck\.ts'(?:, '[^']+')*\]/)
    expect(read('test/unit/club-routing-server-only.test.ts')).toContain('expect(readers).toEqual([\'functions/utils/clubs/emails.ts\', \'functions/utils/clubs/monthlyCheck.ts\'])')
  })

  it('gives the lint as unchanged and the build\'s figures', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', '556,593 as `index-DDIOQyC-.js` on the base', '134,731 as `index-DURnNUWK.css` on the base', '`features-nZCZoT6G.js` 729 bytes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(build, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 14: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `82f197f`\'s tree')
  })

  it('counts as many cases for each new test as the file holds', () => {
    const files = bullet(block, '- **Files.**')
    // The link's test and the page's test grow at WS09 checkpoint V, whose block counts them anew.
    const grown = ws09.includes('\n### WS09 checkpoint V: what checkpoint U\'s pictures asked\n') ? [LINK_TEST, PAGE_TEST] : []
    // The two monthly-check files grow at checkpoint V's review, whose block counts them anew.
    const grownInReview = ws09.includes('\n### WS09 checkpoint V: the review of the whole and its fixes\n') ? [EMAILS_TEST, EDGES_TEST] : []
    for (const file of NEW_TESTS.filter((f) => !grown.includes(f) && !grownInReview.includes(f))) expect(writtenCount(files, file), file).toBe(casesIn(file))
  })

  it('gives unit counts that add up: the base\'s, the new files\' and the three cases grown with no change', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([10066, 418])
    const fresh = NEW_UNIT.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    expect(num(before) + fresh + 3).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts as the base\'s with the new files added', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2459, 137])
    expect(num(before) + NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the lint files as the base\'s with the new files lint reads added, and the build\'s file count once more than the base\'s', () => {
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1108)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_LINTED.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(Number(built?.[1])).toBe(Number(built?.[2]) + 1)
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 14: the map and the lists', () => {
  it('adds one sentence to criterion 13, before the planned step, and to no other item', () => {
    const item = mapItem('Criterion 13')
    expect(item.split('Built in WS09 step 14: ')).toHaveLength(2)
    expect(item.indexOf('Built in WS09 step 14: ')).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    expect(item.indexOf('Built in WS09 step 13: ')).toBeLessThan(item.indexOf('Built in WS09 step 14: '))
    for (const file of [EMAILS_TEST, LINK_TEST]) expect(item).toContain(`\`${file}\``)
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 14:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 13'])
  })

  it('records the step\'s decisions, deviations, verify items and follow-ups, each tagged, and closes step 13\'s interval', () => {
    expect(tagged(decisions).map(head)).toEqual(['The monthly check\'s mark (WS09 step 14).', 'A press sends to everyone (WS09 step 14).'])
    expect(tagged(deviations).map(head)).toEqual(['The mark in a table (WS09 step 14).', 'A count before the question (WS09 step 14).', 'A headers file for the link\'s page (WS09 step 14).'])
    expect(tagged(verify).map(head)).toEqual([
      'The run cannot call it yet (WS09 step 14).', 'The test clock (WS09 step 14).', 'Static beside dynamic (WS09 step 14).', 'The plan\'s budget (WS09 step 14).',
      'An unsubscribe line (WS09 step 14).', 'A page\'s robots words and referrer policy (WS09 step 14).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `82f197f`/)
    expect(tagged(followUps).map(head)).toEqual([
      'The worker\'s one line (WS09 step 14).', 'The link\'s rate limit (WS09 step 14).', 'The platform\'s request log (WS09 step 14).',
      'A club\'s page address of "monthly-check" (WS09 step 14).', 'More holders than one press reaches (WS09 step 14).',
    ])
    const interval = entries(followUps).find((l) => head(l) === 'Each job\'s expected interval (WS09 step 13).') ?? ''
    expect(interval).toContain('Closed by WS09 step 14: `EXPECTED_INTERVAL_DAYS`')
    expect(read('functions/utils/admin/automations.ts')).toContain('  club_monthly_check: 35,')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 14: plain language', () => {
  const interval = entries(followUps).find((l) => head(l) === 'Each job\'s expected interval (WS09 step 13).') ?? ''
  const written = [
    block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), interval.slice(interval.indexOf('Closed by WS09 step 14')),
    mapItem('Criterion 13').slice(mapItem('Criterion 13').indexOf('Built in WS09 step 14: ')), statusLine,
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

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds', () => {
    for (const file of NEW_FILES.filter((f) => f !== SNAPSHOT)) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })

  it('writes the tests\' keys, names and places plainly made up, reading no key from the environment', () => {
    for (const file of [EMAILS_TEST, EDGES_TEST, LINK_TEST, CONTRACT_TEST, PAGE_TEST, CHECK_TEST]) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      expect(text, file).toMatch(/Example Chess Club/)
      for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
    }
    for (const file of [EMAILS_TEST, EDGES_TEST, LINK_TEST, CONTRACT_TEST]) expect(read(file), file).toMatch(/const KEY = 'example-made-up-/)
  })
})
