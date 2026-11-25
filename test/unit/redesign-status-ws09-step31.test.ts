// test/unit/redesign-status-ws09-step31.test.ts
//
// REDESIGN_STATUS.md records WS09's thirty-first step, Ask to be its named
// rep, the last of the plan's seven steps of checkpoint X. Like step 30's
// record test, this file reads only the WS09 section, from its heading to the
// WS10 heading. Pinned here: this step's block right after step 30's, and
// before the four lists while it is the latest; the Status line's tail while
// this step is the latest; the block's parts in order and its figures, which
// must agree with each other and with the files they describe; the sentence
// this step added to the map; the tagged entries of the lists; and the
// plain-language rules over what the step wrote and the files it adds. No
// line here reads how a switch ships.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
import { REP_CONNECTIONS } from '../../domain/clubs/repRequest'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|${'Z' + 'Z'}[A-Z]|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|${'OWED' + '_LIST'}|${'CHECKS' + '_LINE'}|${'STEP31' + '_CASES'}|[A-Z]+_(?:${['WORDS', 'LINE', 'BYTES', 'SHA', 'CASES', 'RESULT', 'OWED'].join('|')})\\b`)
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
const TAG = '(WS09 step 31).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 30: Suggest a club, or start one'
const STEP = '### WS09 step 31: Ask to be its named rep'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))
const headings = lines.filter((l) => l.startsWith('### '))
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''
const latest = latestStep === 31 && latestBlock === STEP

const PUBLIC = 'functions/api/clubs/[id]/rep-requests.ts'
const DECIDE = 'functions/api/admin/clubs/[id]/rep-requests/[requestId].ts'
const SAVE = 'functions/utils/clubs/repRequests.ts'
const NAME = 'functions/utils/clubs/nameRep.ts'
const EMAILS = 'functions/utils/clubs/emails.ts'
const RULES = 'domain/clubs/repRequest.ts'
const SHEET = 'src/areas/clubs/components/RepRequestSheet.tsx'
const ROWS = 'src/areas/clubs/components/RepRequestRows.tsx'
const SELF = 'test/unit/redesign-status-ws09-step31.test.ts'
const NEW_FILES = [
  RULES, 'domain/contracts/clubRepRequests.ts', SAVE, NAME, PUBLIC, DECIDE, 'src/areas/clubs/components/RepRequestLink.tsx', SHEET, ROWS, 'src/areas/clubs/repRequestRows.ts',
]
/** Each new test with the count of cases its run gives. */
const NEW_TESTS: Record<string, number> = {
  'test/integration/club-rep-requests.test.ts': 36,
  'test/integration/club-rep-requests-edges.test.ts': 51,
  'test/integration/contracts/club-rep-requests.test.ts': 3,
  'test/unit/rep-request-sheet.test.tsx': 7,
  'test/unit/rep-request-rows.test.tsx': 10,
  'test/unit/rep-request-words.test.ts': 7,
  'test/a11y/clubs-rep-request.spec.ts': 4,
}
const FIXTURE = 'test/unit/fixtures/my-region-club-base-markup.json'
const CHANGED = [
  EMAILS, 'functions/api/workspace/region.ts', 'functions/api/admin/clubs/[id].ts', 'functions/utils/clubs/pageAnswer.ts', 'functions/utils/admin/audit.ts', 'domain/contracts/clubs.ts',
  'domain/contracts/clubPage.ts', 'domain/contracts/index.ts', 'domain/contracts/registry.ts', 'domain/clubs/slug.ts', 'src/areas/clubs/api.ts', 'test/unit/fixtures/api-added-since-split.json',
  'src/areas/clubs/components/ClubPage.tsx', 'src/pages/MyRegionPage.tsx', 'src/pages/MyRegionClubPage.tsx',
]
const MOVED = [
  'test/unit/routes.test.ts', 'test/unit/redesign-status-ws09-step20.test.ts', 'test/unit/redesign-status-ws09-step21.test.ts', 'test/unit/redesign-status-ws09-step22.test.ts',
  'test/unit/redesign-status-ws09-step23.test.ts', 'test/unit/redesign-status-ws09-step24.test.ts', 'test/unit/redesign-status-ws09-w-takes-main.test.ts',
  'test/unit/redesign-status-ws09-step28.test.ts', 'test/unit/redesign-status-ws09-step30.test.ts', 'test/unit/club-slug.test.ts', 'test/unit/migration-0067-club-seed.test.ts',
  'test/unit/redesign-status-ws09-step4.test.ts', 'test/unit/rate-limit-boundaries.test.ts', 'test/unit/base-components-scope.test.ts', 'test/unit/api-split-modules.test.ts',
  'test/integration/region-events-answers.test.ts', 'test/integration/club-page.test.ts',
]
const UNTOUCHED = [
  'workers/daily-emails/src/index.ts', 'test/unit/mail-worker-closure.test.ts', 'functions/utils/admin/campaigns.ts', 'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx',
  'src/pages/AdminNewsletterPage.tsx', 'src/lib/nav.ts', 'src/lib/features.ts', 'functions/utils/clubs/pages.ts', 'functions/utils/auth.ts', 'functions/utils/admin/members.ts',
  'functions/utils/supabase.ts', 'functions/api/admin/members/[id]/role.ts', 'functions/api/admin/members/[id]/club.ts', 'test/integration/harness.ts', 'test/a11y/builds.spec.ts',
  'test/a11y/signedIn.ts', 'playwright.config.ts', 'package.json', 'wrangler.toml', 'src/areas/clubs/components/AuthorLine.tsx', 'src/pages/AdminClubPage.tsx',
  'src/areas/admin/components/AuditLogPanel.tsx',
]
/** What this step names, which no untouched file may hold. */
const OURS = /repRequest|RepRequest|rep-request|club_rep_named|club_rep_request_declined|nameRep|WS09 step 31/
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,)]`).exec(files)?.[1])
/**
 * A file's cases as its run gives them: every `it(` and `test(` line, each item of a one-line table of cases, each
 * row of a table written one row a line, and a second for a `test(` in a loop over the two sizes.
 */
function casesIn(file: string): number {
  const text = read(file)
  let count = (text.match(/^\s*(?:it|test)\(/gm) ?? []).length
  for (const m of text.matchAll(/^\s*it\.each\(\[([^\]\n]*)\]/gm)) count += m[1].split(',').length
  // A table of cases written one row a line, each row its own case.
  for (const m of text.matchAll(/^\s*it\.each\(\[\n((?:[ \t]*\[.*\],?\n)+)[ \t]*\]\)/gm)) count += m[1].split('\n').filter((l) => l.trim().startsWith('[')).length
  count += (text.match(/^for \(const size of SIZES\) \{\n\s+test\(/gm) ?? []).length
  return count
}
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** A quoted constant's words in a file's code. */
const wordsOf = (file: string, name: string) => /'((?:[^'\\]|\\.)*)'/.exec(codeOf(file).slice(codeOf(file).indexOf(`export const ${name} = `)))?.[1].replace(/\\'/g, '\'') ?? ''
/** Every code file under a folder. */
function codeFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const path = `${dir}/${name}`
    if (statSync(join(ROOT, path)).isDirectory()) out.push(...codeFiles(path))
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(path)
  }
  return out
}

describe('REDESIGN_STATUS.md, the thirty-first step of WS09: the block', () => {
  it('sits once, right after step 30\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest, and keeps the section\'s heading', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of ['WS09 step 31, Ask to be its named rep, lets a signed-in member ask to be named a club\'s rep', 'only with `CLUB_PAGES_ON` set', 'step 30, step 31, K\'s answers']) {
        expect(tail, piece).toContain(piece)
      }
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying where the step sits and what it builds, behind which constants', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the last of the plan\'s seven steps of checkpoint X (steps 25 to 31)', '`redesign/ws09-clubs-x`', `\`${SHEET}\``, '`POST /api/clubs/[id]/rep-requests`', `\`${PUBLIC}\``,
      '`POST /api/admin/clubs/[id]/rep-requests/[requestId]`', `\`${DECIDE}\``, `\`${NAME}\``, '`CLUB_PAGES_ON` and `clubPagesOn()`', '`CLUB_KEEPERS_ON`',
      'Two endpoints and two handler files are added; no switch and no migration.',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order, with the invitation\'s place first among the judgement calls and the sent sentence second', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The request.**', '- **Naming.**', '- **One role.**', '- **Routing.**', '- **What the row holds.**', '- **The keeper\'s side.**',
      '- **The page.**', '- **The map (criterion 11).**', '- **Branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**',
      '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **What ships as main stands.**', '- **Rulings not kept.**', '- **Owed before newClubs goes on.**',
      '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const calls = bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l))
    expect(calls.length).toBeGreaterThanOrEqual(10)
    expect(calls[0]).toMatch(/^ {2}- The invitation's place: /)
    expect(calls[1]).toMatch(/^ {2}- The sent sentence names no person, region or seat:/)
    // The entry's three record lines, each in its part.
    for (const [part, words] of [
      ['- **The request.**', 'Ask to be its named rep needs a sign-in and reaches the region\'s representatives and the LCA admins.'],
      ['- **Naming.**', 'Only a representative of the club\'s region or an LCA admin can approve; approving sets `club_rep` with the member\'s club and emails them'],
      ['- **One role.**', 'A member who holds another role, another club\'s rep included, is sent to the LCA admins with the reason, and nothing about their role or club changes.'],
      ['- **Build.**', 'Bundle'],
    ] as const) expect(bullet(block, part), words).toContain(words)
  })

  it('names every file it adds and changes, each new test with its count, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...Object.keys(NEW_TESTS), SELF, FIXTURE, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...Object.keys(NEW_TESTS), FIXTURE]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const [file, count] of Object.entries(NEW_TESTS)) {
      expect(writtenCount(files, file), file).toBe(count)
      expect(casesIn(file), file).toBe(count)
    }
    expect(writtenCount(files, SELF)).toBe((read(SELF).match(/^\s*it\(/gm) ?? []).length)
    const grown = bullet(files, '  - Grown with no change:')
    for (const piece of ['`test/unit/domain-boundaries.test.ts` from 75 to 77', '`test/unit/route-audit.test.ts` from 105 to 107', '`test/unit/chrome-reads.test.ts` from 55 to 56', 'from 25 to 29', '117 handler files']) {
      expect(grown, piece).toContain(piece)
    }
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const file of UNTOUCHED.filter((f) => f !== 'workers/daily-emails/src/index.ts')) expect(beyond, file).toContain(`\`${file}\``)
    expect(beyond).toContain('everything under `workers/daily-emails/`')
    for (const file of UNTOUCHED) expect(read(file), file).not.toMatch(OURS)
    for (const file of [...codeFiles('workers'), ...codeFiles('functions/utils/mail'), ...codeFiles('domain/mail')]) expect(read(file), file).not.toMatch(OURS)
    expect(readdirSync(join(ROOT, 'migrations')).filter((f) => /^\d{4}_/.test(f)).sort().at(-1)).toBe('0072_regions_by_seat.sql')
  })
})

describe('REDESIGN_STATUS.md, the thirty-first step of WS09: the parts against the files', () => {
  it('gives the request\'s guards in their order, with the limits\' figures and words as the endpoint and the rules hold them', () => {
    const request = bullet(block, '- **The request.**')
    for (const name of ['REP_REQUESTS_CLOSED', 'REP_REQUEST_GUEST', 'REP_REQUEST_HAS_REP', 'REP_REQUEST_ALREADY', 'REP_REQUEST_MEMBER_BUSY', 'REP_REQUEST_KEEPERS_BUSY']) {
      expect(request, name).toContain(`"${wordsOf(RULES, name)}"`)
    }
    for (const c of REP_CONNECTIONS) expect(request, c.key).toContain(`"${c.label}"`)
    for (const piece of ['three requests an hour from one member', 'ten requests an hour to one set of keepers', '`clubs/rep-requests` and `clubs/rep-requests:keepers`', 'at most 1,000 characters']) {
      expect(request, piece).toContain(piece)
    }
    const code = codeOf(PUBLIC)
    expect(code).toMatch(/REP_REQUESTS_AN_HOUR_FROM_ONE_MEMBER = 3\b/)
    expect(code).toMatch(/REP_REQUESTS_AN_HOUR_TO_ONE_KEEPER = 10\b/)
    const order = ['if (!CLUB_PAGES_ON)', 'requireAuthedMember(request, env)', 'parseBody(request, repRequestSchema)', 'REP_REQUEST_MEMBER_ROUTE, {', 'clubNamedBy(env.DB, raw)', 'clubHasRep(env.DB', 'hasOpenRepRequest(env.DB', 'REP_REQUEST_KEEPER_ROUTE, {', 'saveRepRequest(env']
    const at = order.map((piece) => code.indexOf(piece))
    for (const [i, piece] of order.entries()) expect(at[i], piece).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(read(RULES)).toContain('export const REP_REQUEST_LIMITS = { note: 1000 } as const')
  })

  it('says how naming writes, copies and tells, as the files hold it', () => {
    const naming = bullet(block, '- **Naming.**')
    for (const piece of ['one `db.batch`', 'never the count of the statement before', '`syncSupabaseUserMetadata`', '`upsertMemberFromAuth`', '`club_rep_named`', '`club_rep_request_declined`', '`/manage/club`', '`requireAdmin`', '`isRegionalRepFor`']) {
      expect(naming, piece).toContain(piece)
    }
    for (const name of ['REP_DECIDE_ALREADY', 'REP_DECIDE_FOR_KEEPERS', 'REP_DECIDE_OWN', 'REP_DECIDE_NOT_THIS_CLUBS', 'REP_DECIDE_CLOSED']) expect(naming, name).toContain(`"${wordsOf(RULES, name)}"`)
    expect(naming).toContain(`"${wordsOf(EMAILS, 'REP_NAMED_CAN')}"`)
    const code = codeOf(NAME)
    expect(code).toContain('db.batch([')
    // Each guard reads the rows: neither statement reads the count of the one before.
    expect(code).not.toContain('changes()')
    expect(code).toContain(`AND EXISTS (SELECT 1 FROM members WHERE id = ?4 AND role = 'club_rep' AND club_id = ?3)`)
    expect(code).toContain('syncSupabaseUserMetadata(env, member.id, { role: updated.role, club_id: updated.club_id })')
    for (const action of ['club_rep_named', 'club_rep_request_declined']) expect(read('functions/utils/admin/audit.ts')).toContain(`| '${action}'`)
    expect(codeOf(DECIDE)).toContain('requireAdmin(request, env)')
  })

  it('says one role\'s rule in the words the rules hold', () => {
    const role = bullet(block, '- **One role.**')
    for (const piece of ['exactly `member`', '"An LCA admin decides this one."', `"${wordsOf(RULES, 'REP_ROLE_CHANGED')}"`, 'but `lca_admin` and `guest`', 'every role for a representative and for an admin']) {
      expect(role, piece).toContain(piece)
    }
    expect(wordsOf(RULES, 'ADMINS_DECIDE')).toBe('An LCA admin decides this one.')
  })

  it('says where a request goes and what the email holds, in the words the files hold', () => {
    const routing = bullet(block, '- **Routing.**')
    for (const piece of ['`regionRepresentativesOf`', '`lcaAdmins`', 'a guest never', 'never the member who asked', '`renderEmail`', '`sendEmail`', '`/workspace/region#rep-request-{id}`', 'neither the member\'s name nor their address']) {
      expect(routing, piece).toContain(piece)
    }
    expect(routing).toContain(`"${wordsOf(EMAILS, 'REP_REQUEST_KEEPER_SUBJECT')}"`)
    expect(routing).toContain(`"${wordsOf(SAVE, 'REP_REQUEST_NOT_SENT_LOG')}"`)
    expect(routing).toContain(`"${wordsOf(NAME, 'REP_DECISION_NOT_SENT_LOG')}"`)
    expect(codeOf(SAVE)).toContain('from \'./emails\'')
    expect(codeOf(SAVE)).not.toMatch(/from '\.\/routing'|\bdeliver\(|replyTo/)
    expect(codeOf(NAME)).not.toMatch(/from '\.\/routing'|\bdeliver\(|replyTo/)
  })

  it('says what the row holds and that one open request is held by the insert\'s own statement', () => {
    const row = bullet(block, '- **What the row holds.**')
    for (const piece of ['migration 0066', 'no network address', 'the insert\'s own statement', 'No index is added', '`club_rep_requests` and `rate_limits` alone', '`admin_audit_log` alone']) expect(row, piece).toContain(piece)
    expect(codeOf(SAVE)).toContain('WHERE NOT EXISTS (SELECT 1 FROM club_rep_requests WHERE club_id = ?1 AND member_id = ?2 AND status = \'open\')')
  })

  it('says what a keeper meets, in the words the rows hold', () => {
    const side = bullet(block, '- **The keeper\'s side.**')
    for (const piece of ['"Rep requests"', '`repRequests`', '`Cache-Control: no-store`', '"Email {first name}"', '"Name as rep"', '"Decline"', 'never to an observer', 'after step 30\'s "New clubs to check"']) {
      expect(side, piece).toContain(piece)
    }
    expect(read('src/areas/clubs/repRequestRows.ts')).toContain('export const REP_REQUEST_ROWS_HEADING = \'Rep requests\'')
    expect(read('src/pages/AdminClubPage.tsx')).not.toMatch(OURS)
  })

  it('says what the page draws, in the words the rules hold', () => {
    const page = bullet(block, '- **The page.**')
    for (const name of ['REP_SIGNED_OUT_LINE', 'REP_REQUEST_SENT']) expect(page, name).toContain(`"${wordsOf(RULES, name)}"`)
    for (const piece of ['"Is this your club? Ask to be its named rep"', '`rep_wanted`', '"Log in to ask"', '"Not now"', '"How are you connected to the club?"', '`aria-pressed`', '"Send request"', '`AuthorLine.tsx` is not changed']) {
      expect(page, piece).toContain(piece)
    }
    expect(codeOf('functions/utils/clubs/pageAnswer.ts')).toContain('...(CLUB_PAGES_ON ? { rep_wanted: suggestionTo !== \'club_rep\' } : {}),')
    expect(page).toContain('sent only while `CLUB_PAGES_ON` is set')
  })

  it('gives the branch, the merge, what ships with every switch off and as main stands, and what is owed, with the figures the tree holds', () => {
    expect(bullet(block, '- **Branch.**')).toContain('`redesign/ws09-clubs-x`, at `380ff75`, "WS09 step 30: Suggest a club, or start one"')
    const merge = bullet(block, '- **What the merge does.**')
    for (const piece of ['117 handler files', '58 of the 162 methods', '`PENDING_COUNT` still 104', '`deploy-worker.yml`']) expect(merge, piece).toContain(piece)
    expect(Number(/expect\(real\.filter\(\(r\) => r\.startsWith\('api\/'\)\)\.length\)\.toBe\((\d+)\)/.exec(read('test/unit/routes.test.ts'))?.[1])).toBeGreaterThanOrEqual(117)
    if (latest) {
      expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
      expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(58)
    }
    expect(Object.keys(contracts['clubs/[id]/rep-requests'])).toEqual(['POST'])
    expect(Object.keys(contracts['admin/clubs/[id]/rep-requests/[requestId]'])).toEqual(['POST'])
    expect(read('test/unit/contracts-pending.ts')).not.toMatch(/rep-requests/)
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['Two endpoints that answer 403', `"${wordsOf(RULES, 'REP_REQUESTS_CLOSED')}"`, `"${wordsOf(RULES, 'REP_DECIDE_CLOSED')}"`, 'No switch is added']) expect(off, piece).toContain(piece)
    const stands = bullet(block, '- **What ships as main stands.**')
    for (const piece of ['no request can exist', 'nothing a keeper meets changes', 'to the byte', 'only by the new key, which is absent', `"${wordsOf(RULES, 'REP_DECIDE_NOT_THIS_CLUBS')}"`]) {
      expect(stands, piece).toContain(piece)
    }
    const kept = bullet(block, '- **Rulings not kept.**')
    for (const piece of ['One.', 'ruling seventeen', '`admin_audit_log`', 'a 500']) expect(kept, piece).toContain(piece)
    expect(kept).not.toContain('ruling two')
    expect(stands).toContain('carries no `rep_wanted`')
    const owed = bullet(block, '- **Owed before newClubs goes on.**')
    expect(owed).toContain('Step 30\'s thirty-four as they stand, with none taken away')
    const items = owed.split('\n').filter((l) => l.startsWith('  - '))
    expect(items).toHaveLength(42)
    const before = bullet(part(PREVIOUS), '- **Owed before newClubs goes on.**').split('\n').filter((l) => l.startsWith('  - '))
    expect(items.slice(0, 34)).toEqual(before)
    for (const [i, piece] of ['the power itself', 'the sent sentence', 'where the invitation sits', 'the member told of a decline', 'the keeper seeing the member\'s name and address', 'the rows on a club in My region', 'no reminder for a request no keeper decides', 'an LCA admin\'s naming replacing another role'].entries()) {
      expect(items[34 + i], piece).toContain(piece)
    }
  })

  it('names each moved pin by its file, and each moved file holds the count as it stands', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('no earlier test file changes its count of cases')
    expect(read(MOVED[0])).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(117)')
    for (const file of MOVED.slice(1, 7)) expect(read(file), file).toContain('expect(read(\'test/unit/routes.test.ts\')).toContain(\'expect(real.filter((r) => r.startsWith(\\\'api/\\\')).length).toBe(117)\')')
    for (const file of ['test/unit/redesign-status-step30.test.ts', 'test/unit/club-routing-server-only.test.ts', 'test/unit/mail-worker-closure.test.ts']) expect(pins, file).toContain(`\`${file}\``)
  })

  it('gives the lint as the base\'s and the build\'s figures with why each moved, and the worker\'s dry run unmoved', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `380ff75`')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', '`index-Y-JsvWGF.js` at 523,163 bytes', '`index-B62MA3MO.css` at 173,817 bytes', '`features-BFUKrFdH.js` at 741 bytes', '76.61 KiB, gzip 20.53 KiB', '78,448 bytes']) {
      expect(build, piece).toContain(piece)
    }
    const grew = /at 523,163 bytes to `index-[\w-]+\.js` at ([\d,]+), ([\d,]+) bytes/.exec(build)
    expect(grew).not.toBeNull()
    expect(Number(grew![1].replace(/,/g, '')) - 523163).toBe(Number(grew![2].replace(/,/g, '')))
    for (const file of codeFiles('workers')) expect(read(file), file).not.toMatch(/repRequests|nameRep/)
  })
})

describe('REDESIGN_STATUS.md, the thirty-first step of WS09: the Checks line, the map and the lists', () => {
  it('gives each figure once, the third browser project before and after, and the base\'s figures', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', ' over ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toMatch(/over [\d,]+ files/)
    expect(checksLine).toMatch(/unit [\d,]+ tests in [\d,]+ files/)
    expect(checksLine).toMatch(/integration [\d,]+ in [\d,]+ files[^;]*with the one todo beside them/)
    expect(checksLine).not.toMatch(/that run in [\d,]+ files/)
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('the base\'s browser run 1,024 tests, 687 that run and 337 that skip')
    expect(checksLine).toMatch(/the third project, `a11y-clubs`, alone: 25 passed on the base and 29 passed/)
    for (const file of ['`test/integration/member-delete-club-refs.test.ts`', '`test/integration/club-delete.test.ts`']) expect(checksLine, file).toContain(file)
  })

  it('adds one sentence to criterion 11, before its planned step', () => {
    const eleven = entries(map).find((l) => l.startsWith('- **Criterion 11.**')) ?? ''
    const sentence = 'Built in WS09 step 31: Ask to be its named rep'
    expect(eleven.split(sentence)).toHaveLength(2)
    expect(eleven.indexOf(sentence)).toBeLessThan(eleven.indexOf('Planned: WS09 step 31.'))
    expect(eleven).toContain('`test/integration/club-rep-requests.test.ts`')
  })

  it('tags its deviations, verify items and follow-ups', () => {
    expect(tagged(deviations).map(head)).toEqual([
      'The invitation near the foot (WS09 step 31).', 'The page names no rep (WS09 step 31).', 'The rows on a club in My region (WS09 step 31).', 'Checkpoint X\'s section left for the checkpoint (WS09 step 31).',
    ])
    expect(tagged(verify).length).toBeGreaterThanOrEqual(4)
    for (const piece of ['`380ff75`', 'line 68', '`Club-Final-Bare-2`', 'migrations 0046, 0050 and 0057', '`syncSupabaseUserMetadata`']) expect(tagged(verify).join('\n'), piece).toContain(piece)
    const follows = tagged(followUps).map(head)
    for (const name of ['One open request held by an index (WS09 step 31).', 'The audit page\'s names for a naming and a decline (WS09 step 31).', 'A named rep and the member delete (WS09 step 31).', 'No reminder for an undecided request (WS09 step 31).']) {
      expect(follows, name).toContain(name)
    }
  })

  it('keeps the plain-language rules in what the step wrote and in the files it adds', () => {
    const written = [block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps)].join('\n')
    const files = [...NEW_FILES, ...Object.keys(NEW_TESTS)].map((f) => read(f)).join('\n')
    for (const [name, rule] of [['dashes', DASHES], ['working words', BANNED], ['tools', TOOLS], ['bare letters', BARE], ['old initials', OLD_INITIALS], ['unfilled', UNFILLED], ['he', HE]] as const) {
      expect(written, name).not.toMatch(rule)
      // The files' code calls .slice(), so the working words are read in their comments alone.
      const text = name === 'working words' ? files.split('\n').filter((l) => /^\s*(?:\/\/|\*)/.test(l)).join('\n') : files
      if (name !== 'unfilled' && name !== 'he') expect(text, name).not.toMatch(rule)
    }
    expect(read(SELF)).not.toMatch(DASHES)
  })
})
