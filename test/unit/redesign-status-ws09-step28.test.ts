// test/unit/redesign-status-ws09-step28.test.ts
//
// REDESIGN_STATUS.md records WS09's twenty-eighth step, Suggest an update,
// the fourth of the plan's seven steps of checkpoint X. Like Reply through
// LCA's record test, this file reads only the WS09 section, from its heading
// to the WS10 heading. Pinned here: this step's block right after the block
// of checkpoint W taken in with main, and before the four lists while it is
// the latest; the Status line's tail while this step is the latest; the
// block's parts in order and its figures, which must agree with each other
// and with the files they describe; the sentences this step added to the
// map; the tagged entries of the lists; and the plain-language rules over
// what the step wrote and the files it adds. No line here reads how a switch
// ships.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|${'Z' + 'Z'}[A-Z]|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|[${String.fromCharCode(0x27e6, 0x27e7)}]|\\b[A-Z]+[0-9]*_[A-Z_0-9]+\\b(?!\`)`)
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
const TAG = '(WS09 step 28).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### Checkpoint X: WS09 checkpoint W taken in with main as it stands'
const STEP = '### WS09 step 28: Suggest an update'
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
const latest = latestStep === 28 && latestBlock === STEP

const SUGGEST = 'functions/api/clubs/[id]/reports.ts'
const ANSWER = 'functions/api/admin/clubs/[id]/reports/[reportId].ts'
const UTIL = 'functions/utils/clubs/suggestions.ts'
const RULES = 'domain/clubs/suggestion.ts'
const CONTRACT = 'domain/contracts/clubReports.ts'
const SHEET = 'src/areas/clubs/components/SuggestUpdateSheet.tsx'
const LINK = 'src/areas/clubs/components/SuggestUpdateLink.tsx'
const ROWS = 'src/areas/clubs/components/SuggestionRows.tsx'
const SHARED = 'src/areas/clubs/suggestionRows.ts'
const EMAILS = 'functions/utils/clubs/emails.ts'
const SELF = 'test/unit/redesign-status-ws09-step28.test.ts'
const SPEC = 'test/a11y/clubs-suggest.spec.ts'
const NEW_FILES = [SUGGEST, ANSWER, UTIL, RULES, CONTRACT, SHEET, LINK, ROWS, SHARED]
const NEW_TESTS = [
  'test/integration/club-reports.test.ts', 'test/integration/club-reports-region.test.ts', 'test/integration/contracts/club-reports.test.ts',
  'test/unit/suggest-update-sheet.test.tsx', 'test/unit/my-region-suggestions.test.tsx', 'test/integration/club-reports-edges.test.ts',
  'test/unit/suggestion-domain.test.ts', 'test/unit/suggestion-pages.test.tsx', SELF,
]
const CHANGED = [
  EMAILS, 'functions/utils/clubs/pageAnswer.ts', 'functions/api/workspace/region.ts', 'functions/api/admin/clubs/[id].ts', 'functions/api/admin/clubs/[id]/confirm.ts',
  'functions/api/clubs/confirm/[token].ts', 'functions/utils/admin/audit.ts', 'domain/clubs/regionCards.ts', 'domain/contracts/clubs.ts', 'domain/contracts/clubPage.ts', 'domain/contracts/index.ts',
  'domain/contracts/registry.ts', 'src/areas/clubs/api.ts', 'test/unit/fixtures/api-added-since-split.json', 'src/areas/clubs/region.ts', 'src/areas/clubs/components/ClubPage.tsx',
  'src/areas/clubs/components/WhenAndWhere.tsx', 'src/areas/clubs/components/ContactRelayForm.tsx', 'src/areas/clubs/components/RegionClubCard.tsx', 'src/components/ui/dialog.tsx',
  'src/pages/MyRegionPage.tsx', 'src/pages/MyRegionClubPage.tsx', 'src/pages/AdminClubPage.tsx', 'src/pages/YourClubPage.tsx', 'src/pages/ClubConfirmPage.tsx',
]
/** The test files whose checks this step makes false, each changed in place. */
const MOVED = [
  'test/unit/routes.test.ts', 'test/unit/redesign-status-ws09-step20.test.ts', 'test/unit/redesign-status-ws09-step21.test.ts', 'test/unit/redesign-status-ws09-step22.test.ts',
  'test/unit/redesign-status-ws09-step23.test.ts', 'test/unit/redesign-status-ws09-step24.test.ts', 'test/unit/redesign-status-ws09-w-takes-main.test.ts',
  'test/unit/club-page-bare.test.tsx', 'test/unit/club-page-rest.test.tsx', 'test/unit/my-region-page.test.tsx', 'test/integration/region-events-answers.test.ts',
  'test/unit/api-split-modules.test.ts', 'test/unit/base-components-scope.test.ts', 'test/unit/rate-limit-boundaries.test.ts', 'test/unit/spam-check-widget.test.tsx',
]
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
const UNTOUCHED = [
  'src/lib/features.ts', 'functions/utils/clubs/pages.ts', 'src/lib/nav.ts', 'scripts/seed/fixtures.sql', 'playwright.config.ts', 'wrangler.toml', 'test/unit/contracts-pending.ts',
  'functions/api/contact.ts', 'functions/utils/clubs/publicAnswer.ts', 'functions/utils/events/publicAnswer.ts', 'test/unit/features.test.ts', 'functions/utils/rateLimit.ts',
  'functions/utils/spamCheck.ts', 'functions/utils/tokens.ts', 'src/areas/admin/components/AuditLogPanel.tsx', 'src/areas/clubs/components/RegionHelp.tsx',
  'src/areas/clubs/components/EditorHelp.tsx',
]
const num = (text: string) => Number(text.replace(/,/g, ''))
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A file's cases: every `it(` line; none of this step's files draws cases from a table or a loop. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, file).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,)]`).exec(files)?.[1])
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** A quoted constant's words in a file's code. */
const wordsOf = (file: string, name: string) => /'((?:[^'\\]|\\.)*)'/.exec(codeOf(file).slice(codeOf(file).indexOf(`export const ${name} = `)))?.[1].replace(/\\'/g, '\'') ?? ''

describe('REDESIGN_STATUS.md, the twenty-eighth step of WS09: the block', () => {
  it('sits once, right after the block of checkpoint W taken in with main, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest, and keeps the section\'s heading and the pull request numbers', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'WS09 step 28, Suggest an update, lets a visitor tell whoever keeps a club\'s listing that it is out of date, only with `CLUB_PAGES_ON` set',
        'checkpoint W taken into checkpoint X with `main` as it stands, step 28, K\'s answers',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens by saying where the step sits, what it builds, and that two endpoints and two contracts are added and no switch', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the fourth of the plan\'s seven steps of checkpoint X (steps 25 to 31)', '`redesign/ws09-clubs-x`', 'WS09 step 15, the worker\'s one line, is still to come', 'step 29, the fourteen days, is the next step',
      '`POST /api/clubs/:id/reports`', `\`${SUGGEST}\``, `\`${ANSWER}\``, `\`${SHEET}\``, 'answers 403 in words and reads nothing', 'Two endpoints and two contracts are added, and no switch and no migration',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **Routing.**', '- **The wait.**', '- **The keeper\'s side.**', '- **Where it opens.**', '- **What the row holds.**',
      '- **Nothing shown of the visitor.**', '- **The map (criteria 10 and 12).**', '- **Branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**',
      '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **What ships as main stands.**', '- **Owed before newClubs goes on.**', '- **Pins moved.**',
      '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })

  it('names every file it adds and changes, each new test with its count, the files grown with no change, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...NEW_TESTS, ...CHANGED, SPEC, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...NEW_TESTS, SPEC]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    expect(writtenCount(files, SPEC)).toBe(3)
    const grown = bullet(files, '  - Grown with no change:')
    for (const piece of ['`test/unit/domain-boundaries.test.ts`', 'from 68 cases to 70', '`test/unit/route-audit.test.ts`', 'from 101 to 103', '`test/unit/chrome-reads.test.ts`', 'from 53 to 54', 'from 18 tests to 21']) expect(grown, piece).toContain(piece)
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['No file the mail stream holds is touched', '`AuthorLine.tsx`', '`test/integration/harness.ts`, `src/App.tsx` and `public/_headers` are not changed', ...HELD.map((f) => `\`${f}\``), ...UNTOUCHED.map((f) => `\`${f}\``)]) {
      expect(beyond, piece).toContain(piece)
    }
    for (const file of [...HELD, ...UNTOUCHED, 'test/integration/harness.ts', 'src/App.tsx', 'public/_headers']) expect(read(file), file).not.toMatch(/clubs\/reports|ClubSuggestion|SuggestUpdate|club_suggestion|WS09 step 28/)
  })
})

describe('REDESIGN_STATUS.md, the twenty-eighth step of WS09: the parts against the files', () => {
  it('says where a suggestion goes, by the routing that already knows, in the words and figures the files hold', () => {
    const routing = bullet(block, '- **Routing.**')
    for (const piece of ['`keeperOf`', '`clubRepsOf`', '`regionRepresentativesOf`', '`lcaAdmins`', '`suggestion.goes_to`', '`\'club_rep\'`', '`resolveSiteUrl`', '`/my/club/{slug}`', '`/workspace/region/clubs/{id}`', '`/admin/clubs/{id}`', '#suggestion-{id}', 'five an hour from one place and twenty an hour to one club', '`clubs/reports`', '"Sent."']) {
      expect(routing, piece).toContain(piece)
    }
    expect(routing).toContain(`"${wordsOf(UTIL, 'SUGGESTION_NOT_SENT_LOG')}"`)
    expect(routing).toContain(`"${wordsOf(EMAILS, 'SUGGESTION_FOOTER')}"`)
    const code = codeOf(SUGGEST)
    expect(code).toMatch(/SUGGESTIONS_AN_HOUR_FROM_ONE_PLACE = 5\b/)
    expect(code).toMatch(/SUGGESTIONS_AN_HOUR_TO_ONE_CLUB = 20\b/)
    // The guards in the relay's order.
    const order = ['if (!CLUB_PAGES_ON)', 'parseBody(request, clubSuggestionRequestSchema)', 'limit(env, request, SUGGEST_PLACE_ROUTE', 'checkSpam(env', 'clubNamedBy(env.DB', 'limit(env, request, SUGGEST_CLUB_ROUTE', 'saveSuggestion(env']
    const at = order.map((piece) => code.indexOf(piece))
    expect(at.every((i) => i > 0), JSON.stringify(at)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(code).not.toMatch(/requireUser|requireAuthedMember|Authorization|CF-Connecting-IP|user-agent/i)
    expect(codeOf(UTIL)).toContain('from \'./emails\'')
    expect(codeOf(UTIL)).not.toMatch(/from '\.\/routing'|\bdeliver\(|trySendEmail|replyTo/)
  })

  it('says how Still accurate waits, in the words the files hold', () => {
    const wait = bullet(block, '- **The wait.**')
    expect(wait).toContain(`"${wordsOf(RULES, 'LINK_WAITS')}"`)
    for (const piece of ['409', '"A visitor\'s suggestion for this club is waiting. Answer it, then confirm."', '"Answer it, then confirm"', '`clubsToConfirm`', '"1 club with a suggestion waiting was skipped: answer it, then confirm."', '"Log in to My region"', 'One kind of open item exists']) {
      expect(wait, piece).toContain(piece)
    }
    expect(read(RULES)).toContain('export const ANSWER_FIRST = \'Answer it, then confirm\'')
    expect(codeOf('functions/api/admin/clubs/[id]/confirm.ts')).toContain('if (await hasOpenSuggestion(context.env.DB, clubId)) return errorResponse(CONFIRM_WAITS, 409)')
    expect(codeOf('functions/api/clubs/confirm/[token].ts')).toContain('if (await hasOpenSuggestion(context.env.DB, link.club.id)) return refuse(LINK_WAITS, 409)')
  })

  it('says what a keeper may do, who, and that the reply is kept nowhere, as the endpoint holds it', () => {
    const keeper = bullet(block, '- **The keeper\'s side.**')
    for (const name of ['NOT_THIS_CLUBS', 'ALREADY_HANDLED', 'NO_ADDRESS']) expect(keeper, name).toContain(`"${wordsOf(ANSWER, name)}"`)
    for (const piece of ['`requireClubRep`', '`canManageClub`', '`club_suggestion_resolved`', '`{ clubId, reportId, action }`', '`clubReplyEmail`', '`firstLines`', '"LCA {region} representative"', '"{Club} representative"', '"Louisiana Chess Association"', 'second factor', 'kept nowhere', '"1 suggestion · 9 days"', 'Fix the listing', 'Reply to visitor', 'Not an issue', 'Apply this']) {
      expect(keeper, piece).toContain(piece)
    }
    const code = codeOf(ANSWER)
    expect(code).toContain('SET status = ?, resolved_by = ?, resolved_at = datetime(\'now\'), reporter_email = NULL')
    expect(code).toContain('WHERE id = ? AND club_id = ? AND kind = \'suggestion\' AND status = \'open\'')
    expect([...code.matchAll(/\bsendEmail\(/g)]).toHaveLength(1)
    expect(code).not.toMatch(/replyTo|\bcc\b|\bbcc\b|deliver\(|trySendEmail|INSERT INTO/i)
    expect([...code.matchAll(/console\.\w+\(([^)]*)\)/g)].map((m) => m[1])).toEqual(['ANSWER_NOT_SENT_LOG'])
    expect(read('functions/utils/admin/audit.ts')).toContain('| \'club_suggestion_resolved\'')
  })

  it('says where it opens and what the sheet holds, in the words the files hold', () => {
    const opens = bullet(block, '- **Where it opens.**')
    for (const piece of ['"Last checked"', 'beside Contact\'s heading', 'never on a block', '`src/components/ui/dialog.tsx`', '768 pixels', '"Suggest an update to {Club}"', '`aria-pressed`', '"Your email (optional)"', '"Sent. Whoever keeps this club\'s listing checks it before anything changes."', 'Escape', 'Close', '"Sending…"']) {
      expect(opens, piece).toContain(piece)
    }
    expect(opens).toContain(`"${wordsOf(SHEET, 'EMAIL_HELP')}"`)
    expect(opens).toContain(`"${wordsOf(SHEET, 'SEND_HELP')}"`)
    expect(read(RULES)).toContain('export const SUGGESTION_SENT = \'Sent. Whoever keeps this club\\\'s listing checks it before anything changes.\'')
    expect(codeOf(LINK)).toContain('lazy(() => import(\'@/areas/clubs/components/SuggestUpdateSheet\')')
    // The sheet's two ways in are the page's alone, and its words live outside the page's own file.
    expect(codeOf('src/areas/clubs/components/ClubPage.tsx').match(/suggest=\{suggestLink\}/g)).toHaveLength(2)
    expect(codeOf('src/areas/clubs/components/ClubPage.tsx')).not.toMatch(/Suggest an update/)
    for (const file of ['src/areas/clubs/components/RegionHelp.tsx', 'src/areas/clubs/components/EditorHelp.tsx']) expect(read(file), file).not.toMatch(/suggestion|Suggest an update/i)
    expect(read(RULES)).not.toMatch(/14 days/)
  })

  it('says what the row holds and that nothing of the visitor is shown, as the files hold it', () => {
    const row = bullet(block, '- **What the row holds.**')
    for (const piece of ['`meets`', '`venue`', '`cost`', '`contact`', '`closed`', '`other`', '2,000 characters', '254', '`reporter_email` is set to NULL in the same statement', 'until the club is deleted', 'a choice for K', '`proposed_json` stays empty']) expect(row, piece).toContain(piece)
    expect(read(RULES)).toContain('export const SUGGESTION_LIMITS = { message: 2000, email: 254 } as const')
    expect(codeOf(UTIL)).toContain('INSERT INTO club_reports (club_id, kind, field, message, region, reporter_email)')
    const hidden = bullet(block, '- **Nothing shown of the visitor.**')
    for (const piece of ['`hasAddress`', 'in no audit entry and in no log line', '`test/integration/club-reports.test.ts`']) expect(hidden, piece).toContain(piece)
    expect(read(CONTRACT)).not.toMatch(/reporter_email|email: z\.string\(\)\.?[^,]*\n[^}]*openSuggestion/)
  })

  it('gives the branch, the merge, what ships with every switch off and as main stands, and what is owed, with the figures the tree holds', () => {
    expect(bullet(block, '- **Branch.**')).toContain('`redesign/ws09-clubs-x`, at `8932948`, "WS09 checkpoint X takes checkpoint W in, with main as it stands"')
    const merge = bullet(block, '- **What the merge does.**')
    for (const piece of ['113 handler files', '54 of the 158 methods', '`PENDING_COUNT` still 104', '`deploy-worker.yml`']) expect(merge, piece).toContain(piece)
    expect(Number(/expect\(real\.filter\(\(r\) => r\.startsWith\('api\/'\)\)\.length\)\.toBe\((\d+)\)/.exec(read('test/unit/routes.test.ts'))?.[1])).toBeGreaterThanOrEqual(113)
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
    expect(Object.keys(contracts['clubs/[id]/reports'])).toEqual(['POST'])
    expect(Object.keys(contracts['admin/clubs/[id]/reports/[reportId]'])).toEqual(['POST'])
    expect(PENDING_CONTRACTS.some((p) => String(p).includes('reports'))).toBe(false)
    if (latest) expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(54)
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const name of ['SUGGEST_CLOSED']) expect(ships, name).toContain(`"${wordsOf(SUGGEST, name)}"`)
    expect(ships).toContain(`"${wordsOf(ANSWER, 'SUGGESTIONS_CLOSED')}"`)
    for (const piece of ['No sheet is on any page today', 'No switch is added']) expect(ships, piece).toContain(piece)
    const stands = bullet(block, '- **What ships as main stands.**')
    for (const piece of ['nothing a keeper meets changes', 'byte for byte', 'the dashboard']) expect(stands, piece).toContain(piece)
    const owed = bullet(block, '- **Owed before newClubs goes on.**')
    expect(owed).toContain('Step 27\'s twenty-two as they stand, with none taken away')
    expect(owed.split('\n').filter((l) => l.startsWith('  - '))).toHaveLength(25)
    for (const piece of ['the words of a resolved suggestion', 'beside a control all the same', '"{Club} representative"']) expect(owed, piece).toContain(piece)
  })

  it('names each moved pin by its file, and each moved file keeps its count of cases', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('no earlier test file changes its count of cases')
    for (const file of MOVED.slice(1, 7)) expect(read(file), file).toContain('expect(real.filter((r) => r.startsWith(\\\'api/\\\')).length).toBe(113)')
    for (const file of ['test/unit/redesign-status-step28.test.ts', 'test/unit/club-routing-server-only.test.ts']) expect(pins, file).toContain(`\`${file}\``)
    // The lines held by number stand where they stood.
    expect(read('src/pages/AdminClubPage.tsx').split('\n')[427]).toContain('color: clubTextColor(color),')
    expect(read('src/areas/admin/components/AuditLogPanel.tsx').split('\n')[277]).toContain('<span')
  })

  it('gives the lint as the base\'s and the build\'s figures with why each moved, and the worker\'s dry run', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `8932948`')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-D7gy2YPT.js` at 521,529 bytes', 'at 522,130, 601 bytes', 'stays at 10 files', '777,663 bytes to 779,659', '605,319 bytes to 605,920',
      '`index-CEht-dmK.css` at 172,344 bytes', 'at 173,739', '`features-BFUKrFdH.js` stays at 741 bytes', '`SuggestUpdateSheet-', '8,387 bytes', '24 files of 782,193 bytes', '76.61 KiB, gzip 20.53 KiB', '78,448 bytes',
    ]) expect(build, piece).toContain(piece)
    // The rules the pages draw read nothing of My region's cards, so the start keeps the base's shape.
    expect(codeOf(RULES)).not.toMatch(/from '\.\/regionCards'/)
    expect(codeOf('domain/clubs/regionCards.ts')).toContain('export function wholeDaysSince(')
  })
})

describe('REDESIGN_STATUS.md, the twenty-eighth step of WS09: the Checks line', () => {
  it('gives each figure once, and no whole browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'third project alone']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('1,017 tests, 680 that run and 337 that skip')
    expect(checksLine).toContain('21 passed (18 on the base)')
    expect(checksLine).toContain('the base\'s figures from the gate on `8932948`\'s tree')
  })

  it('gives unit and integration counts that add up: the base\'s, the files grown and the new files\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    expect([num(unit![3]), Number(unit![4])]).toEqual([12697, 577])
    const newUnit = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
    // Five cases grow in three files that draw their cases from the tree, by Grown with no change.
    expect(num(unit![3]) + 5 + newUnit.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(unit![1]))
    expect(Number(unit![2]) - Number(unit![4])).toBe(newUnit.length)
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing, with the one todo beside them/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect([num(integration![3]), Number(integration![4])]).toEqual([3635, 204])
    const newIntegration = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
    expect(num(integration![3]) + newIntegration.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(integration![1]))
    expect(Number(integration![2]) - Number(integration![4])).toBe(newIntegration.length)
  })

  it('gives the lint files as the base\'s with the new code and test files, and the build\'s file counts', () => {
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(([\d,]+) on the base\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1421)
    const linted = [...NEW_FILES, ...NEW_TESTS, SPEC].filter((f) => /\.tsx?$/.test(f))
    expect(num(lint![1]) - num(lint![2])).toBe(linted.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[2]).toBe('225')
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, the twenty-eighth step of WS09: the map and the lists', () => {
  it('adds one sentence each to criteria 10 and 12, before their planned steps, and to no other item', () => {
    for (const id of ['Criterion 10', 'Criterion 12']) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 28: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 28: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    }
    expect(mapItem('Criterion 10')).toContain('`test/integration/club-reports.test.ts`')
    expect(mapItem('Criterion 12')).toContain('`test/unit/my-region-suggestions.test.tsx`')
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 28:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 10', 'Criterion 12'])
  })

  it('records the step\'s deviations, verify items and follow-ups, each tagged, and adds no decision', () => {
    expect(tagged(part(LISTS[0]))).toEqual([])
    expect(tagged(deviations).map(head)).toEqual([
      'The way in at the told line (WS09 step 28).', 'The address\'s label (WS09 step 28).', 'The rows of one club (WS09 step 28).', 'No line of the 14 days (WS09 step 28).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'Three sent lines on the boards (WS09 step 28).', 'The choices (WS09 step 28).', 'Copied or routed (WS09 step 28).', 'No sheet component (WS09 step 28).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed (?:on `8932948`|in the brief)/)
    expect(tagged(followUps).map(head)).toEqual([
      'A resolved suggestion\'s words (WS09 step 28).', 'The audit page\'s name for the action (WS09 step 28).', 'A keeper who answered and the member delete (WS09 step 28).', 'Two rows alike (WS09 step 28).',
      'The emailed link\'s place on the page (WS09 step 28).', 'The emailed Still accurate page while a suggestion waits (WS09 step 28).',
      'Confirm all\'s skipped words for several clubs (WS09 step 28).', 'Who a suggestion goes to, read on each page answer (WS09 step 28).',
    ])
  })
})

describe('REDESIGN_STATUS.md, the twenty-eighth step of WS09: plain language', () => {
  const sentences = ['Criterion 10', 'Criterion 12'].map((id) => {
    const item = mapItem(id)
    return item.slice(item.indexOf('Built in WS09 step 28: '), item.search(/ Planned: WS09 step \d+\.$/))
  })
  const written = [block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps), ...sentences, statusLine].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the step wrote, and dates and times in their plain form', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS]) expect(written).not.toMatch(rule)
    const prose = proseOf(written)
    expect(prose).not.toMatch(UNFILLED)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds, and writes the tests\' people made up, reading no switch\'s shipped value', () => {
    for (const file of [...NEW_FILES, ...NEW_TESTS, SPEC]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
    for (const file of [...NEW_TESTS.filter((f) => f !== SELF), SPEC]) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
      expect(text, file).not.toMatch(/src\/lib\/features|\bfeatures\.\w+|FEATURES\.\w+/)
      expect(text, file).not.toMatch(/import\s*\{[^}]*\b(?:CLUB_PAGES_ON|CLUB_KEEPERS_ON|MAIL_LISTS_ON|MAIL_SENDER)\b/)
      for (const name of new Set(text.match(/\b(?:CLUB_PAGES_ON|CLUB_KEEPERS_ON|MAIL_LISTS_ON|MAIL_SENDER)\b/g) ?? [])) expect(text, `${file} ${name}`).toContain(`get ${name}() {`)
      for (const address of text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) ?? []) expect(address, file).toMatch(/^(?:192\.0\.2|198\.51\.100|203\.0\.113)\./)
      // The twenty-eighth step is not named by number in the first 25 lines, so WS01's record test of its own step 28 does not take the file as one of its own.
      if (!file.startsWith('test/integration/')) expect(text.split('\n').slice(0, 25).join('\n'), file).not.toMatch(/\bstep 28\b(?!'s)/)
    }
  })
})
