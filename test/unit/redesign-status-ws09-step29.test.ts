// test/unit/redesign-status-ws09-step29.test.ts
//
// REDESIGN_STATUS.md records WS09's twenty-ninth step, the fourteen days,
// the fifth of the plan's seven steps of checkpoint X. Like step 28's record
// test, this file reads only the WS09 section, from its heading to the WS10
// heading. Pinned here: this step's block right after step 28's, and before
// the four lists while it is the latest; the Status line's tail while this
// step is the latest; the block's parts in order and its figures, which must
// agree with each other and with the files they describe; the sentence this
// step added to the map; the tagged entries of the lists, the held line's
// follow-up first among this step's; and the plain-language rules over what
// the step wrote and the files it adds. No line here reads how a switch
// ships.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|${'Z' + 'Z'}[A-Z]|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|${'OWED' + '_LIST'}|${'CHECKS' + '_LINE'}|${'RECORD' + '_CASES'}|${'LOOK' + '_RESULT'}`)
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
const TAG = '(WS09 step 29).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 28: Suggest an update'
const STEP = '### WS09 step 29: the fourteen-day step'
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
const latest = latestStep === 29 && latestBlock === STEP

const CLOCK = 'functions/utils/clubs/reportClock.ts'
const BUTTON = 'src/areas/clubs/components/OverdueSuggestionsButton.tsx'
const WORDS = 'src/areas/clubs/overdueWords.ts'
const EMAILS = 'functions/utils/clubs/emails.ts'
const ENDPOINT = 'functions/api/admin/clubs/monthly-check.ts'
const RULE = 'domain/clubs/regionCards.ts'
const ROWS = 'src/areas/clubs/components/SuggestionRows.tsx'
const SHARED = 'src/areas/clubs/suggestionRows.ts'
const SELF = 'test/unit/redesign-status-ws09-step29.test.ts'
const NEW_FILES = [CLOCK, BUTTON, WORDS]
/**
 * The cases WS09 checkpoint X's review added to this block's test files, each held to a fix of that review; the
 * block keeps the count each file had at this step.
 */
const X_REVIEW_ADDED: Record<string, number> = {
  'test/unit/overdue-suggestions-button.test.tsx': 1,
}
const NEW_TESTS = [
  'test/integration/club-report-clock.test.ts', 'test/integration/contracts/club-report-clock.test.ts', 'test/unit/club-report-clock.test.ts',
  'test/unit/overdue-suggestions-button.test.tsx', 'test/integration/club-report-clock-edges.test.ts', 'test/unit/overdue-suggestions-markup.test.tsx',
  'test/unit/club-report-clock-contract.test.ts', SELF,
]
/** The drawing of the rows as the base drew them, which test/unit/overdue-suggestions-markup.test.tsx compares against. */
const FIXTURE = 'test/unit/fixtures/suggestion-rows-base-markup.json'
const CHANGED = [
  EMAILS, 'functions/utils/clubs/suggestions.ts', ENDPOINT, 'functions/utils/admin/audit.ts', RULE, 'domain/contracts/clubs.ts', 'domain/contracts/clubReports.ts',
  'domain/contracts/registry.ts', 'src/areas/clubs/api.ts', 'test/unit/fixtures/api-added-since-split.json', 'src/areas/clubs/region.ts', ROWS, SHARED, 'src/pages/MyRegionPage.tsx',
]
const MOVED = ['test/unit/automation-runs-lagging-run.test.ts', 'test/unit/redesign-status-ws09-u-review.test.ts']
const UNTOUCHED = [
  'workers/daily-emails/src/index.ts', 'test/unit/mail-worker-closure.test.ts', 'functions/utils/admin/campaigns.ts', 'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx',
  'src/pages/AdminNewsletterPage.tsx', 'src/lib/nav.ts', 'src/lib/features.ts', 'functions/utils/clubs/pages.ts', 'test/integration/harness.ts', 'scripts/seed/fixtures.sql',
  'playwright.config.ts', 'package.json', 'wrangler.toml', 'functions/utils/rateLimit.ts', 'functions/utils/spamCheck.ts', 'src/areas/admin/components/AuditLogPanel.tsx',
  'src/areas/clubs/components/RegionHelp.tsx', 'src/areas/clubs/components/EditorHelp.tsx', 'src/areas/clubs/components/HelpMark.tsx', 'src/pages/AdminClubPage.tsx', 'src/App.tsx',
]
/** What this step names, which no untouched file may hold. */
const OURS = /reportClock|run_report_clock|club_report_clock|OverdueSuggestions|passedOnAt|isSuggestionOverdue|WS09 step 29/
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

describe('REDESIGN_STATUS.md, the twenty-ninth step of WS09: the block', () => {
  it('sits once, right after step 28\'s block, and before the four lists while it is the latest', () => {
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
        'WS09 step 29, the fourteen days, passes a suggestion no keeper has answered in 14 days on to the LCA admins',
        'only when an LCA admin presses Send overdue suggestions on in My region until its one line in the daily run lands',
        'checkpoint W taken into checkpoint X with `main` as it stands, step 28, step 29, K\'s answers',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens by saying where the step sits, what it builds, and that no endpoint, switch or migration is added', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the fifth of the plan\'s seven steps of checkpoint X (steps 25 to 31)', '`redesign/ws09-clubs-x`', 'WS09 step 15, the worker\'s one line, is still to come', 'step 30 is the next step',
      '`runReportClock`', `\`${CLOCK}\``, '"Send overdue suggestions on"', '`POST /api/admin/clubs/monthly-check`', 'No endpoint, no handler file, no switch and no migration is added',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order, with the held line first among the judgement calls', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The rule of the 14 days.**', '- **Who it is passed to.**', '- **The run.**', '- **The admin\'s button.**',
      '- **The row\'s line.**', '- **The map (criterion 10).**', '- **Branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**',
      '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **What ships as main stands.**', '- **Owed before newClubs goes on.**', '- **Pins moved.**',
      '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const calls = bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l))
    expect(calls.length).toBeGreaterThanOrEqual(8)
    expect(calls[0]).toMatch(/^ {2}- The held line is not written\./)
  })

  it('names every file it adds and changes, each new test with its count, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...NEW_TESTS, FIXTURE, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...NEW_TESTS, FIXTURE]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file) - (X_REVIEW_ADDED[file] ?? 0))
    const grown = bullet(files, '  - Grown with no change:')
    for (const piece of ['none', '`test/unit/domain-boundaries.test.ts` at 70', '`test/unit/route-audit.test.ts` at 103', '`test/unit/chrome-reads.test.ts` at 54', '113 handler files']) expect(grown, piece).toContain(piece)
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const file of UNTOUCHED.filter((f) => !['src/App.tsx', 'workers/daily-emails/src/index.ts'].includes(f))) expect(beyond, file).toContain(`\`${file}\``)
    expect(beyond).toContain('everything under `workers/daily-emails/`')
    for (const file of UNTOUCHED) expect(read(file), file).not.toMatch(OURS)
    for (const file of [...codeFiles('workers'), ...codeFiles('functions/utils/mail'), ...codeFiles('domain/mail')]) expect(read(file), file).not.toMatch(OURS)
    expect(readdirSync(join(ROOT, 'migrations')).filter((f) => /^\d{4}_/.test(f)).sort().at(-1)).not.toMatch(/clock|fourteen|escalat/)
  })
})

describe('REDESIGN_STATUS.md, the twenty-ninth step of WS09: the parts against the files', () => {
  it('says the rule once, in the domain, with its figure and its edge', () => {
    const rule = bullet(block, '- **The rule of the 14 days.**')
    for (const piece of ['`domain/clubs/regionCards.ts`', '`wholeDaysSince`', '`SUGGESTION_DUE_DAYS`, 14', '`isSuggestionOverdue`', '13 days and 23 hours is not due and 14 days is', 'never due']) {
      expect(rule, piece).toContain(piece)
    }
    expect(read(RULE)).toContain('export const SUGGESTION_DUE_DAYS = 14')
    expect(read(RULE)).toContain('export function isSuggestionOverdue(')
    expect(codeOf(CLOCK)).toContain('isSuggestionOverdue({')
    expect(codeOf('src/pages/MyRegionPage.tsx')).toContain('isSuggestionOverdue({')
  })

  it('says who it is passed to, by the routing that already knows, in the words the email holds', () => {
    const who = bullet(block, '- **Who it is passed to.**')
    for (const piece of ['`keeperOf`', '`regionRepresentativesOf`', '`lcaAdmins`', 'is stored nowhere', 'written to once, as an LCA admin', 'a guest never', '`renderEmail`', '`suggestionLink`', '`resolveSiteUrl` with no request', '`/admin/clubs/{id}`', '`/workspace/region/clubs/{id}`', '#suggestion-{id}']) {
      expect(who, piece).toContain(piece)
    }
    expect(who).toContain(`"${wordsOf(EMAILS, 'OVERDUE_HEADING')}"`)
    expect(who).toContain(`"${wordsOf(EMAILS, 'SUGGESTION_FOOTER')}"`)
    expect(read(EMAILS)).toContain('It went first to the LCA admins, so this is a reminder.')
    expect(codeOf(CLOCK)).toContain('from \'./emails\'')
    expect(codeOf(CLOCK)).not.toMatch(/from '\.\/routing'|from '\.\/suggestions'|\bdeliver\(|trySendEmail|sendEmailOutcome|replyTo/)
  })

  it('says how the run goes, in the words and figures the file holds', () => {
    const run = bullet(block, '- **The run.**')
    for (const name of ['CLOCK_NONE_TAKEN_LOG', 'CLOCK_NOT_SENT_LOG']) expect(run, name).toContain(`"${wordsOf(CLOCK, name)}"`)
    for (const piece of ['`club_report_clock`', '`recordRun`', '"manual: "', '`escalated_at IS NULL AND status = \'open\'`', '`sendEmail`', '`MAX_SENDS`, ten emails a run', 'nothing is ever half sent', 'at most 11 outside calls', 'at most 47 queries']) {
      expect(run, piece).toContain(piece)
    }
    const code = codeOf(CLOCK)
    expect(code).toMatch(/export const MAX_SENDS = 10\b/)
    expect(wordsOf(CLOCK, 'CLOCK_JOB')).toBe('club_report_clock')
    expect(code).toContain('WHERE id = ? AND kind = \'suggestion\' AND escalated_at IS NULL AND status = \'open\'')
    expect(code.indexOf('if (!CLUB_KEEPERS_ON) return none(\'closed\')')).toBeLessThan(code.indexOf('const due = await dueRows('))
    expect(code.indexOf('return none(\'nothing_due\')')).toBeLessThan(code.indexOf('await recordRun('))
    for (const piece of ['on every way out of the loop', '`waitUntil`']) expect(run, piece).toContain(piece)
    expect(code.indexOf('} finally {')).toBeGreaterThan(code.indexOf('const claim = await'))
    expect(codeOf(ENDPOINT)).toContain('context.waitUntil(run)')
  })

  it('says what the admin\'s button and its action do, in the words the files hold', () => {
    const button = bullet(block, '- **The admin\'s button.**')
    for (const piece of ['`action: \'run_report_clock\'`', '`club_report_clock_sent`', '`{ passedOn, sent, notSent, notReached }`', '"Overdue suggestions"', '`requireAdmin`', '"The monthly check cannot be sent yet."', 'under the to-do list\'s heading', '"1 suggestion passed on: 3 emails sent, 0 not sent."']) {
      expect(button, piece).toContain(piece)
    }
    expect(button).toContain(`"${wordsOf(WORDS, 'OVERDUE_BUTTON')}"`)
    expect(button).toContain('"2 suggestions have waited 14 days or more with no answer. Send them on to the LCA admins and the regions\' representatives?"')
    expect(read('domain/contracts/clubs.ts')).toContain('export const REPORT_CLOCK_ACTION = \'run_report_clock\'')
    expect(codeOf(ENDPOINT)).toContain('if (body.action === REPORT_CLOCK_ACTION) return reportClock(context, authResult.member, body.send)')
    expect(codeOf(ENDPOINT).indexOf('body.action === REPORT_CLOCK_ACTION')).toBeLessThan(codeOf(ENDPOINT).indexOf('signingKeyReady(context.env)'))
    expect(read('functions/utils/admin/audit.ts')).toContain('| \'club_report_clock_sent\'')
    for (const file of ['src/areas/clubs/components/RegionHelp.tsx', 'src/areas/clubs/components/EditorHelp.tsx']) expect(read(file), file).not.toMatch(/overdue|14 days|passed on/i)
  })

  it('says what the row\'s line says and that the open item gains one key, absent until it is passed on', () => {
    const line = bullet(block, '- **The row\'s line.**')
    for (const piece of ['"Passed to the LCA admins on Mon, Nov 23, 2026"', '`formatDate`', '`passedOnAt`', 'absent until then', 'to the byte']) expect(line, piece).toContain(piece)
    expect(read('domain/contracts/clubReports.ts')).toContain('passedOnAt: storedTimestampSchema.optional(),')
    expect(codeOf(ROWS)).toContain('{row.passedOnAt && <p className="text-sm text-ink">{passedOnWords(row.passedOnAt)}</p>}')
    expect(codeOf('functions/utils/clubs/suggestions.ts')).toContain('...(row.escalated_at ? { passedOnAt: row.escalated_at } : {}),')
  })

  it('gives the branch, the merge, what ships with every switch off and as main stands, and what is owed, with the figures the tree holds', () => {
    expect(bullet(block, '- **Branch.**')).toContain('`redesign/ws09-clubs-x`, at `8d21b19`, "WS09 step 28: Suggest an update"')
    const merge = bullet(block, '- **What the merge does.**')
    for (const piece of ['113 handler files', '54 of the 158 methods', '`PENDING_COUNT` still 104', '`deploy-worker.yml`']) expect(merge, piece).toContain(piece)
    expect(Number(/expect\(real\.filter\(\(r\) => r\.startsWith\('api\/'\)\)\.length\)\.toBe\((\d+)\)/.exec(read('test/unit/routes.test.ts'))?.[1])).toBeGreaterThanOrEqual(113)
    if (latest) {
      expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
      expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(54)
    }
    expect(Object.keys(contracts['admin/clubs/monthly-check'])).toEqual(['POST'])
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['One function that does nothing', `"${wordsOf(ENDPOINT, 'CHECK_CLOSED')}"`, 'No switch is added']) expect(off, piece).toContain(piece)
    const stands = bullet(block, '- **What ships as main stands.**')
    for (const piece of ['nothing a keeper meets changes while no suggestion is overdue', 'younger than the 14 days', 'to the byte', '14 drawings', 'no button is drawn', 'an idle run writes no row']) expect(stands, piece).toContain(piece)
    const owed = bullet(block, '- **Owed before newClubs goes on.**')
    expect(owed).toContain('Step 28\'s twenty-five as they stand, with none taken away')
    const items = owed.split('\n').filter((l) => l.startsWith('  - '))
    expect(items).toHaveLength(28)
    expect(items[24]).toContain('"{Club} representative"')
    for (const [i, piece] of ['reminded at 14 days when they were the club\'s first keepers', '"Unanswered at 14 days this also reaches the LCA admins"', 'the clock runs only when an LCA admin presses'].entries()) {
      expect(items[25 + i], piece).toContain(piece)
    }
  })

  it('names each moved pin by its file, and each moved file keeps its count of cases', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('no earlier test file changes its count of cases')
    expect(read(MOVED[0])).toContain('\'functions/utils/clubs/reply.ts\', \'functions/utils/clubs/reportClock.ts\']')
    expect(read(MOVED[1])).toContain('expect(check.match(/recordAdminAction\\(/g)).toHaveLength(2)')
    for (const file of ['test/unit/redesign-status-step29.test.ts', 'test/unit/club-routing-server-only.test.ts', 'test/unit/club-monthly-check.test.ts', 'test/unit/mail-worker-closure.test.ts']) {
      expect(pins, file).toContain(`\`${file}\``)
    }
  })

  it('gives the lint as the base\'s and the build\'s figures with why each moved, and the worker\'s dry run unmoved', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `8d21b19`')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-D1LKODrj.js` at 522,130 bytes', 'at 522,522, 392 bytes', 'the same 10 files', '779,659 bytes to 780,051', '605,920 bytes to 606,312',
      '`index-BA4R4uMw.css` at 173,739 bytes', '`features-BFUKrFdH.js` stays at 741 bytes', '`regionCards-', '503 bytes', '231 files', '76.61 KiB, gzip 20.53 KiB', '78,448 bytes',
    ]) expect(build, piece).toContain(piece)
    expect(num(/at 522,522, ([\d,]+) bytes/.exec(build)?.[1] ?? '0')).toBe(522522 - 522130)
    for (const file of codeFiles('workers')) expect(read(file), file).not.toMatch(/runReportClock|clubs\/reportClock/)
  })
})

describe('REDESIGN_STATUS.md, the twenty-ninth step of WS09: the Checks line, the map and the lists', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('no browser run in this step\'s build')
    expect(checksLine).toContain('with the one todo beside them')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('the base\'s browser run 1,020 tests, 683 that run and 337 that skip')
  })

  it('adds one sentence to criterion 10, before its planned step', () => {
    const item = entries(map).find((l) => l.startsWith('- **Criterion 10.**')) ?? ''
    const sentence = 'Built in WS09 step 29: the 14 days, `runReportClock` in `functions/utils/clubs/reportClock.ts`'
    expect(item.split(sentence)).toHaveLength(2)
    expect(item.indexOf(sentence)).toBeLessThan(item.indexOf('Planned: WS09 step 30.'))
    expect(item).toContain('`test/integration/club-report-clock.test.ts`')
  })

  it('tags its deviations, verify items and follow-ups, the worker\'s line first among the follow-ups', () => {
    expect(tagged(deviations).map(head)).toEqual(['The held line (WS09 step 29).', 'The clock\'s cases in a file of their own (WS09 step 29).', 'The line\'s words and day (WS09 step 29).'])
    expect(tagged(verify)).toHaveLength(5)
    for (const piece of ['line 419', '`0 12 * * *`', 'line 50', '`ADMIN_HOME_ON`', 'migration 0066']) expect(tagged(verify).join('\n'), piece).toContain(piece)
    const follows = tagged(followUps)
    expect(head(follows[0])).toBe('The clock\'s one line in the daily run (WS09 step 29).')
    expect(follows[0]).toContain('runs only when an LCA admin presses "Send overdue suggestions on" in My region')
    expect(follows[0]).toContain('`await phase(\'club report clock\', () => runReportClock(env, new Date()))`')
  })

  it('keeps the plain-language rules in what the step wrote and in the files it adds', () => {
    const written = [block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps)].join('\n')
    const files = [...NEW_FILES, ...NEW_TESTS.filter((f) => f !== SELF)].map((f) => read(f)).join('\n')
    for (const [name, rule] of [['dashes', DASHES], ['working words', BANNED], ['tools', TOOLS], ['bare letters', BARE], ['old initials', OLD_INITIALS], ['unfilled', UNFILLED], ['he', HE]] as const) {
      expect(written, name).not.toMatch(rule)
      // The files' code calls .slice(), so the working words are read in their comments alone.
      const text = name === 'working words' ? files.split('\n').filter((l) => /^\s*(?:\/\/|\*)/.test(l)).join('\n') : files
      if (name !== 'unfilled' && name !== 'he') expect(text, name).not.toMatch(rule)
    }
    expect(read(SELF)).not.toMatch(DASHES)
  })
})
