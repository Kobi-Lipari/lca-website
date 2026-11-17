// test/unit/redesign-status-ws09-step19.test.ts
//
// REDESIGN_STATUS.md records WS09 step 19: events on the pages, the last of
// the plan's four steps of checkpoint V. Like WS09 step 18's record test,
// this file reads only the WS09 section, from its heading to the WS10
// heading. Pinned here: this step's block right after step 18's, and before
// the four lists while it is the latest; the Status line's tail while this
// step is the latest; the block's parts in order and its figures, which must
// agree with each other and with the files they describe; the sentence this
// step added to the map; the tagged entries of the lists and the follow-up it
// closes; and the plain-language rules over what the step wrote and the files
// it adds.
import { existsSync, readFileSync } from 'node:fs'
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
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
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
const TAG = '(WS09 step 19).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 18: submit, approve, ask for changes'
const STEP = '### WS09 step 19: events on the pages'
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
const latest = latestStep === 19 && latestBlock === STEP

const RIGHTS = 'functions/utils/clubs/eventRights.ts'
const CLUB_GET = 'functions/api/admin/clubs/[id].ts'
const MANAGE_GET = 'functions/api/admin/tournaments/[id]/manage.ts'
const REGION = 'functions/api/workspace/region.ts'
const WAIT = 'src/areas/clubs/components/ApprovalWait.tsx'
const WAITING = 'src/areas/clubs/components/ClubWaitingEvents.tsx'
const GUARD = 'src/components/auth/RoleProtectedRoute.tsx'
const ASKS = 'src/areas/clubs/useManagesEvent.ts'
const WIZARD = 'src/areas/admin/components/TournamentWizard.tsx'
const NOTICE = 'src/areas/admin/components/FeeNotice.tsx'
const PAGES_TEST = 'test/unit/region-events-pages.test.tsx'
const ANSWERS_TEST = 'test/integration/region-events-answers.test.ts'
const REGION_TEST = 'test/integration/workspace-region.test.ts'
const SELF = 'test/unit/redesign-status-ws09-step19.test.ts'
const NEW_FILES = [RIGHTS, 'domain/events/approvalWords.ts', 'src/areas/clubs/approval.ts', WAIT, WAITING, ASKS]
/** The tests written beside the step's own to try what it built: the wait's words, its panel on its own, the creation steps by who is adding, the plain words of the files, and the answers held against the moves they speak of. */
const MORE_TESTS = [
  'test/unit/approval-words.test.ts', 'test/unit/approval-wait-panel.test.tsx', 'test/unit/region-events-steps.test.tsx', 'test/unit/region-events-plain-words.test.ts',
  'test/integration/region-events-agreement.test.ts',
]
const NEW_TESTS = [PAGES_TEST, ANSWERS_TEST, SELF, ...MORE_TESTS]
const NEW_UNIT = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
const NEW_INTEGRATION = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
/** The integration test that grows, with its count and the base's. */
const GROWN: ReadonlyArray<readonly [string, number, number]> = [[REGION_TEST, 20, 16]]
/** The unit tests that grow by the tree alone, a case for each file or path they meet, with their counts and the base's. */
const GROWN_UNIT: ReadonlyArray<readonly [string, number, number]> = [['test/unit/domain-boundaries.test.ts', 56, 55], ['test/unit/route-audit.test.ts', 94, 93]]
const CHANGED = [
  'domain/contracts/clubs.ts', 'domain/contracts/events.ts', CLUB_GET, MANAGE_GET, REGION, 'src/areas/admin/api.ts', NOTICE, WIZARD, 'src/areas/clubs/api.ts',
  'src/areas/clubs/components/ClubEventsList.tsx', 'src/areas/clubs/components/RegionClubCard.tsx', 'src/areas/clubs/components/ThisMonthBar.tsx', 'src/areas/events/api.ts',
  GUARD, 'src/pages/AdminClubPage.tsx', 'src/pages/MyRegionClubPage.tsx', 'src/pages/TournamentManagePage.tsx', 'test/unit/fixtures/api-added-since-split.json', REGION_TEST,
]
const MOVED = ['test/unit/api-split-modules.test.ts', 'test/integration/club-events-edges.test.ts', 'test/unit/redesign-status-ws09-step10.test.ts']
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** A file's cases: every plain `it(` line; none of this step's files uses `it.each`. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, file).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
/**
 * The cases a file runs: its `it(` lines, and for an `it(` straight inside a
 * `for (const x of list)`, one case more for each entry of the list past the
 * first, the list written in place or as a `const` of the same file.
 */
function casesRun(file: string): number {
  const text = read(file)
  let extra = 0
  for (const loop of text.matchAll(/^\s*for \(const \w+ of (\[[^\]\n]*\]|\w+)\) \{\n\s*it\(/gm)) {
    const list = loop[1].startsWith('[') ? loop[1] : new RegExp(`^const ${loop[1]} = (\\[[\\s\\S]*?\\])$`, 'm').exec(text)?.[1] ?? '[]'
    extra += list.slice(1, -1).split(',').filter((entry) => entry.trim() !== '').length - 1
  }
  return casesIn(file) + extra
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('REDESIGN_STATUS.md, WS09 step 19: the block', () => {
  it('sits once, right after step 18\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'and WS09 step 19 the wait on the pages', 'Add a club event', 'the manage page', 'the admin club page', 'My region\'s cards and This month bar',
        'all behind `regionEvents`', 'WS09 step 15 follows as a pull request of its own', 'steps 1 to 14 and 16 to 19',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying where the step sits, that step 15 is still to come, K\'s answer and what it builds', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the last of the plan\'s four steps of checkpoint V (steps 16 to 19)', 'WS09 step 15, the worker\'s one line, is still to come', 'choice 6 with (a)',
      'K\'s decision 1 of Friday, November 13, 2026', '`regionEvents`', '`REGION_EVENTS_ON`', 'No table, no migration, no endpoint and no switch is added',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **Which answer tells each page what it may draw.**', '- **The guard.**', '- **The fee notice, by the state of CREATION_ROLES_ON.**',
      '- **On the pages.**', '- **In My region.**', '- **The workspace and the dashboard.**', '- **The map (criterion 14).**', '- **Step 15.**', '- **The branch.**',
      '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**',
      '- **Owed before regionEvents goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(6)
  })

  it('names every file it adds and changes, each new test with its count, the grown test with its, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...NEW_TESTS, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...NEW_TESTS]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    // Four of them grow at checkpoint V's review, whose block counts them anew.
    const grownInReview = ws09.includes('\n### WS09 checkpoint V: the review of the whole and its fixes\n') ? [PAGES_TEST, ANSWERS_TEST, 'test/unit/approval-wait-panel.test.tsx', 'test/unit/region-events-steps.test.tsx'] : []
    for (const file of NEW_TESTS.filter((f) => !grownInReview.includes(f))) expect(writtenCount(files, file), file).toBe(casesRun(file))
    for (const [file, after, before] of GROWN) {
      expect(files, file).toContain(`\`${file}\` (${after}, ${before} on the base: `)
      expect(casesIn(file), file).toBe(after)
    }
    expect(files).toContain('  - Grown with no change:')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['No file the mail stream holds is touched', '`src/App.tsx`', ...HELD.map((f) => `\`${f}\``)]) expect(beyond, piece).toContain(piece)
    for (const file of [...HELD, 'src/lib/features.ts', 'test/unit/contracts-pending.ts', 'domain/contracts/registry.ts']) {
      expect(read(file), file).not.toMatch(/eventRights|moveTournamentApproval|useManagesEvent|ApprovalWait/)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 19: the parts against the files', () => {
  it('names the answer that tells each page what it may draw, as the handlers answer it only while the constant is set', () => {
    const answers = bullet(block, '- **Which answer tells each page what it may draw.**')
    for (const piece of ['`eventRights`', '`approval`', '`inReview`', '`GET /api/admin/clubs/[id]`', '`GET /api/admin/tournaments/[id]/manage`', '`GET /api/workspace/region`', '`GET /api/me/tournament-creation`']) {
      expect(answers, piece).toContain(piece)
    }
    expect(codeOf(CLUB_GET)).toContain('...(regionEvents ? { eventRights: await clubEventRights(context.env.DB, authResult.member, clubId) } : {}),')
    expect(codeOf(CLUB_GET)).toContain('  if (!CLUB_KEEPERS_ON) return jsonResponse(answer)\n')
    expect(codeOf(MANAGE_GET)).toContain('...(REGION_EVENTS_ON ? { approval: await approvalRights(context.env.DB, authResult.member, tournament) } : {}),')
    expect(codeOf(REGION)).toContain('const inReview = regionEvents ? await reviewCounts(db, ids) : null')
    expect(codeOf(RIGHTS)).toContain('return { add, manage, decide: person.grant === \'admin\', askPayout: rolesOn }')
    expect(read('domain/contracts/clubs.ts')).toContain('eventRights: clubEventRightsSchema.optional(),')
    expect(read('domain/contracts/events.ts')).toContain('approval: z.strictObject({ maySubmit: z.boolean(), mayDecide: z.boolean() }).optional(),')
  })

  it('names the guard as the route holds it, with no line of src/App.tsx moved', () => {
    const guard = bullet(block, '- **The guard.**')
    for (const piece of ['`useManagesEvent`', '`GET /api/admin/tournaments/[id]/directors`', '`canManageTournament`', 'No line of `src/App.tsx` moved', 'as on the base']) {
      expect(guard, piece).toContain(piece)
    }
    const code = codeOf(GUARD)
    expect(code).toContain('const askManager = regionEventsOn() && !!requireTournamentAccess')
    expect(code).toContain('const eventManager = useManagesEvent(askManager, id, member?.id)')
    expect(codeOf(ASKS)).toContain('adminGetTournamentDirectors(tournamentId)')
    expect(read('src/App.tsx')).toContain('<Route path="/admin/tournaments/:id" element={<RoleProtectedRoute roles={[\'lca_admin\', \'lca_observer\', \'lca_officer\', \'club_rep\', \'tournament_director\']} allowDirectors requireTournamentAccess><TournamentManagePage /></RoleProtectedRoute>} />')
  })

  it('says what a representative meets at the fee notice in each state of CREATION_ROLES_ON, as the wizard and the notice draw it', () => {
    const fees = bullet(block, '- **The fee notice, by the state of CREATION_ROLES_ON.**')
    for (const piece of ['"Entry fees need a payout account first"', '"Keep it at $0"', '"Ask LCA to set up my payout account"', '"Not available yet."', '`FEES_NEED_PAYOUT_ACCOUNT`', '`canAsk`']) {
      expect(fees, piece).toContain(piece)
    }
    expect(read(NOTICE)).toContain('const NEEDS_ACCOUNT_TITLE = \'Entry fees need a payout account first\'')
    expect(codeOf(NOTICE)).toContain('{canAsk && (')
    expect(codeOf(WIZARD)).toContain('canAsk={fixedClub?.waitsForApproval ? fixedClub.mayAskForPayout : true}')
    expect(codeOf('functions/api/me/payout-request.ts')).toContain('if (!CREATION_ROLES_ON) return errorResponse(\'Not available yet.\', 403)')
  })

  it('names the pages\' and My region\'s parts as the components draw them', () => {
    const pages = bullet(block, '- **On the pages.**')
    for (const piece of ['"Add a club event"', '"Submit for LCA review"', '"Approve and publish"', '"Ask for changes"', '`WAITING_FOR_APPROVAL`', '`EMAIL_WORDS`', '`approvalState`', `\`${PAGES_TEST}\``]) {
      expect(pages, piece).toContain(piece)
    }
    // Checkpoint V's review: the wait's heading and lines, Submit only for a person who cannot decide, the rows in review, the kept steps, and the old line gone.
    expect([
      'the heading "LCA approval"', '"Draft. Not sent for LCA review yet."', 'for a person the answer lets submit and who cannot decide', 'a row for each event of the club in review, sent and not approved',
      'once opened, the steps stay drawn while another tab shows', 'Waiting for LCA approval: sent for review',
    ].map((piece) => pages.includes(piece))).toEqual([true, true, true, true, true, false])
    expect(read(WAIT)).toContain('Submit for LCA review')
    expect(read(WAIT)).toContain('Approve and publish')
    expect(read('src/pages/TournamentManagePage.tsx')).toContain('<p className="text-sm text-ink">Hidden (draft). {WAITING_FOR_APPROVAL}</p>')
    const region = bullet(block, '- **In My region.**')
    for (const piece of ['"Event in LCA review"', '"1 event in review"', '"2 events in review"', `\`${REGION_TEST}\``]) expect(region, piece).toContain(piece)
    expect(read('src/areas/clubs/components/RegionClubCard.tsx')).toContain('n === 1 ? \'Event in LCA review\' : `${n} events in LCA review`')
    expect(read('src/areas/clubs/components/ThisMonthBar.tsx')).toContain('\'1 event in review\'')
  })

  it('names the branch, what the merge does, the database, a revert, what ships with every switch off and what is owed', () => {
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-v`', '`57fd960`', 'this step\'s diff is against `57fd960`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration and no handler file', '104 handler files', '`deploy-worker.yml`']) expect(does, piece).toContain(piece)
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('This step changes no table')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('leaves no row behind')
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['byte for byte', 'no query more', 'the counting database', 'No switch is added']) expect(ships, piece).toContain(piece)
    expect(read('functions/utils/clubs/pages.ts')).toContain('export const REGION_EVENTS_ON = false')
    expect(read('src/lib/features.ts')).toContain('  regionEvents: false,')
    const owed = bullet(block, '- **Owed before regionEvents goes on.**')
    for (const piece of ['one change that sets `regionEvents` and `REGION_EVENTS_ON` together', 'after `clubKeepers`']) expect(owed, piece).toContain(piece)
    expect(bullet(block, '- **Step 15.**')).toContain('Still to come')
  })

  it('names its pins, and the moved checks hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    // WS09 step 20 adds its own path between the two.
    expect(read('test/unit/api-split-modules.test.ts')).toMatch(/'\/api\/admin\/tournaments\/\*\/approval', (?:'\/api\/clubs\/\*\/page', )?'\/api\/clubs\/confirm\/\*',/)
    expect(read('test/unit/redesign-status-ws09-step10.test.ts')).toContain('if (latestStep <= 18 || file !== INTEGRATION) expect(writtenCount(files, file), file).toBe(casesIn(file))')
    expect(read('test/integration/club-events-edges.test.ts')).toContain('expect(await events(representative)).toEqual(regionOn ? [mine, theirs, listed].sort() : [listed])')
    expect(read('src/pages/AdminClubPage.tsx').split('\n')[427]).toContain('color: clubTextColor(color),')
  })

  it('gives the lint as unchanged and the build\'s figures', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', 'made from `57fd960` in a scratch folder', '`index-B9z7qSj6.css` 134,857 bytes', '`index-DpDZyFNB.js`', '557,579', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(build, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 19: the Checks line', () => {
  it('gives each figure once, and no browser run of its own', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `57fd960`\'s tree')
  })

  it('gives unit counts that add up: the base\'s and the new files\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([10404, 440])
    for (const [file, now, was] of GROWN_UNIT) expect(files, file).toContain(`\`${file}\` (${now}, ${was} on the base: `)
    const grown = GROWN_UNIT.reduce((n, [, now, was]) => n + now - was, 0)
    expect(num(before) + NEW_UNIT.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + grown).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts as the base\'s with the new file and the cases added to the grown test', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing but the one todo/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2744, 150])
    const grown = GROWN.reduce((n, [, now, was]) => n + now - was, 0)
    expect(num(before) + NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + grown).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the lint files as the base\'s with the new files, and the build\'s file counts', () => {
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1151)
    expect(num(lint![1]) - num(lint![2])).toBe([...NEW_FILES, ...NEW_TESTS].length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.slice(1)).toEqual(['210', '207'])
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 19: the map and the lists', () => {
  it('adds one sentence to criterion 14, after step 18\'s and before the planned step, and to no other item', () => {
    const item = mapItem('Criterion 14')
    expect(item.split('Built in WS09 step 19: ')).toHaveLength(2)
    expect(item.indexOf('Built in WS09 step 18: ')).toBeLessThan(item.indexOf('Built in WS09 step 19: '))
    expect(item.indexOf('Built in WS09 step 19: ')).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    expect(item.slice(item.indexOf('Built in WS09 step 19: '))).toContain(`\`${PAGES_TEST}\``)
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 19:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 14'])
  })

  it('records the step\'s deviations, verify items and follow-ups, each tagged, closes step 18\'s follow-up in place, and adds no decision', () => {
    expect(tagged(part(LISTS[0]))).toEqual([])
    expect(tagged(deviations).map(head)).toEqual([
      'No Publish button (WS09 step 19).', 'No Help hook (WS09 step 19).', 'The guard asks the server (WS09 step 19).', 'The approval call\'s file (WS09 step 19).',
    ])
    expect(tagged(verify).map(head)).toEqual(['The fee notice (WS09 step 19).', 'No setup checklist (WS09 step 19).', 'The inset\'s words (WS09 step 19).'])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `57fd960`/)
    expect(tagged(followUps).map(head)).toEqual([
      'The way back from the manage page (WS09 step 19).', 'The manage page\'s fee notice for a representative (WS09 step 19).', 'The creation steps\' small controls (WS09 step 19).',
      'The creation steps\' words (WS09 step 19).',
    ])
    const closed = entries(followUps).find((l) => l.startsWith('- **The manage page for a representative (WS09 step 18).**')) ?? ''
    expect(closed).toContain(' Closed in WS09 step 19: ')
    // Checkpoint V's review closes the way back from the manage page in place.
    expect(entries(followUps).find((l) => l.startsWith('- **The way back from the manage page (WS09 step 19).**'))).toContain(' Closed in checkpoint V\'s review: with `regionEvents` on, the link reads "My region" and leads to `/workspace/region`')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 19: plain language', () => {
  const closing = (() => {
    const entry = entries(followUps).find((l) => l.startsWith('- **The manage page for a representative (WS09 step 18).**')) ?? ''
    return entry.slice(entry.indexOf(' Closed in WS09 step 19: '))
  })()
  const written = [
    block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps), closing, mapItem('Criterion 14').slice(mapItem('Criterion 14').indexOf('Built in WS09 step 19: ')), statusLine,
  ].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the step wrote, and dates and times in their plain form', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    const prose = proseOf(written)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const found of prose.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b(?!:)/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds', () => {
    for (const file of [...NEW_FILES, ...NEW_TESTS]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })

  it('writes the tests\' people, clubs and places plainly made up, reading no setting from the environment', () => {
    for (const file of [PAGES_TEST, ANSWERS_TEST]) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      expect(text, file).toMatch(/Example [A-Z][a-z]+ Club/)
      for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
    }
  })
})
