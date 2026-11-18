// test/unit/redesign-status-ws09-v-asked.test.ts
//
// REDESIGN_STATUS.md records two blocks written at the start of WS09's
// checkpoint V, on K's decision 8 of Sunday, November 15, 2026: the block
// that says checkpoint U merged and is live, and the first step of
// checkpoint V, what checkpoint U's pictures asked. Like the other record
// tests of WS09, this file reads only the WS09 section, from its heading to
// the WS10 heading. Pinned here: both blocks, right after checkpoint U's
// review and in that order, and before the four lists while the second is
// the section's latest; the merge's facts; the Status and PR lines while it
// is; the second block's parts in order and its claims against the files
// they describe (the link's answer and its contract, the page, the email and
// the bar); the figures of its Checks line; K's decision 8 in the decisions
// list; the follow-ups it logs; the pins it moves; and the plain-language
// rules over what it wrote and the files it adds.
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[A-Z]+_(?:CASES|LINE|COUNT|TEXT|AFTER|FILES|TESTS|MORE)\\b(?<!PENDING_COUNT)|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
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
const TAG = '(WS09 checkpoint V).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const REVIEW = '### WS09 checkpoint U: the review of the whole and its fixes'
const MERGED = '### WS09 checkpoint U: checkpoint U merged and live'
const BLOCK = '### WS09 checkpoint V: what checkpoint U\'s pictures asked'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const merged = part(MERGED)
const block = part(BLOCK)
const decisions = part(LISTS[0])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''
const latest = latestBlock === BLOCK

const LINK = 'functions/api/clubs/confirm/[token].ts'
const CONTRACTS = 'domain/contracts/clubs.ts'
const HOME = 'domain/clubs/monthlyCheck.ts'
const EMAILS = 'functions/utils/clubs/emails.ts'
const PAGE = 'src/pages/ClubConfirmPage.tsx'
const BAR = 'src/areas/clubs/components/ThisMonthBar.tsx'
const BUTTONS_TEST = 'test/unit/club-check-email-buttons.test.ts'
const BAR_TEST = 'test/unit/my-region-this-month-bar.test.tsx'
const WORDS_TEST = 'test/unit/club-confirm-page-words.test.tsx'
const ROUND_TRIP_TEST = 'test/integration/club-check-email-link-round-trip.test.ts'
const SELF = 'test/unit/redesign-status-ws09-v-asked.test.ts'
const NEW_UNIT = [BUTTONS_TEST, BAR_TEST, WORDS_TEST, SELF]
const NEW_INTEGRATION = [ROUND_TRIP_TEST]
const NEW_TESTS = [...NEW_UNIT, ...NEW_INTEGRATION]
const PAGE_TEST = 'test/unit/club-confirm-page.test.tsx'
const LINK_TEST = 'test/integration/club-confirm-link.test.ts'
const CONTRACT_TEST = 'test/integration/contracts/club-confirm.test.ts'
/** The tests of these pieces that change, each with its count now and on the base. */
const CHANGED_TESTS: ReadonlyArray<readonly [string, number, number]> = [[PAGE_TEST, 25, 15], [LINK_TEST, 21, 14]]
/** The record tests whose pins this step moves. */
const MOVED = ['test/unit/redesign-status-ws09-step1.test.ts', 'test/unit/redesign-status-ws09-step14.test.ts', 'test/unit/redesign-status-ws09-u-review.test.ts']
/** The files the mail stream holds. */
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
const NONE = 'How the club meets is not listed yet.'

/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])

describe('REDESIGN_STATUS.md, WS09 checkpoint U merged and live', () => {
  it('sits once, right after checkpoint U\'s review, with this step\'s block after it, and before the four lists while that is the latest', () => {
    expect(merged).not.toBe('')
    expect(block).not.toBe('')
    for (const heading of [MERGED, BLOCK]) expect(ws09.split(`\n${heading}\n`), heading).toHaveLength(2)
    expect(headings[headings.indexOf(REVIEW) + 1]).toBe(MERGED)
    expect(headings[headings.indexOf(MERGED) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
    // The heading's form is the record's own, as WS09 step 1's test allows it.
    expect(read(MOVED[0])).toContain('|WS09 checkpoint U: \\S|WS09 checkpoint V: \\S|')
  })

  it('records K\'s word, the pull request with its commit and parents, the order of the build and the checks, and changes no code', () => {
    for (const piece of [
      'Sun, Nov 15, 2026', 'about 5:20 PM UTC', '"All recommended"', 'K\'s decision 8', 'three numbered choices put with draft pull request 132 and eight sheets of pictures',
      'the first of the choices the merge itself', 'on a day the mail stream had named clear', 'none of the plan\'s 38 steps and changes no code',
      'Pull request 132, merged as `ccf65c3`, its parents `9293e2f` and `f817c38`, at 5:23 PM UTC, its tree the tree the gate ran on',
      '"Apply database migrations" run 26 started by itself on the push and was green at 5:24 PM UTC, with migrations 0068 and 0069 applied, each one empty table, before the new build was live',
      'No read of the production database was made', 'the green run is the proof for two empty tables',
      'The worker\'s deploy, run 34, was green with its bundle unchanged', 'the Pages build was live at 5:27 PM UTC',
      'It passed with every clubs switch off', 'GET `/api/workspace/region`, POST `/api/admin/clubs/[id]/confirm`, GET and POST `/api/clubs/confirm/[token]` and POST `/api/admin/clubs/monthly-check` each answer 403 in their words',
      'GET `/api/clubs` answers the 25 clubs, each with a region and no email', 'a signed-out GET of a club\'s admin answer is 401 as before',
      '`Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex`, while `/clubs` keeps the header it had',
      'A signed-in reload of a guarded page was not checked on the live site, since no session signs in there; it is held by the reload step\'s tests',
      'CI on `main` for the merge commit, run 448, was green at 5:36 PM UTC: the build, the typecheck of the functions, the unit tests and the integration tests. Its accessibility job does not run on a push.', 'left as written history',
    ]) expect(merged, piece).toContain(piece)
  })

  it('gives the Status line its tail while this step is the latest, and the PR line the three merges', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      expect(tail).toBe('checkpoints S and T merged into `main` on Sun, Nov 15, 2026, and checkpoint U, steps 10 to 14 with the two small steps of K\'s decision 7, merged on the same day as pull request 132, and all three are live; checkpoint V is under way on `redesign/ws09-clubs-v`, its first step mending, behind `clubKeepers`, what checkpoint U\'s pictures showed; WS09 step 15 follows as a pull request of its own; steps 1 to 14, K\'s answers to checkpoint S\'s review and K\'s second answer, the Clubs page on a narrow phone, are built.')
      expect(prLine.endsWith('; checkpoint U (steps 10 to 14) merged as pull request 132, `ccf65c3`, on Sun, Nov 15, 2026, on K\'s word; checkpoint V is under way on `redesign/ws09-clubs-v`, and WS09 step 15 follows as a pull request of its own.')).toBe(true)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    // Checkpoint U no longer waits; checkpoint V's review moves the Status line to V waiting for K's word.
    expect(statusLine).not.toMatch(/checkpoint U[^;]*waits for K's word for its merge/)
    expect(prLine).not.toContain('checkpoint U waits for K\'s word')
    // Read only while this block is the latest: the switch-on's block names checkpoint V's own pull request.
    if (latest) expect(prLine.match(/pull request \d+/g)).toEqual(['pull request 130', 'pull request 131', 'pull request 132'])
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint V, what checkpoint U\'s pictures asked: the block', () => {
  it('opens with what was found, K\'s answer and what was built', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'The first step of checkpoint V, on `redesign/ws09-clubs-v`, and none of the plan\'s 38 steps', 'What was found: the pictures of checkpoint U\'s pages',
      'with made-up clubs and people', 'about 18 pixels tall with a dot between them', 'at 390 pixels wide every wrapped line of My region\'s This month bar started with the separator dot',
      'K\'s answer, decision 8 of Sunday, November 15, 2026: "All recommended"', 'What was built:', 'behind `clubKeepers` and `CLUB_KEEPERS_ON`, which stay off',
      'with every switch off nothing a person meets changes',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The answer.**', '- **The page.**', '- **The email.**', '- **The bar.**', '- **The pictures.**',
      '- **The follow-ups it logs.**', '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**',
      '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(4)
  })

  it('names every file it adds and changes, each test with its count, and leaves the held files and the shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_TESTS, LINK, CONTRACTS, HOME, EMAILS, PAGE, BAR, PAGE_TEST, LINK_TEST, CONTRACT_TEST, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const file of NEW_TESTS) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const [file, now, base] of CHANGED_TESTS) expect(files, file).toContain(`\`${file}\` (${now}, ${base} on the base: `)
    expect(files).toContain(`\`${CONTRACT_TEST}\` (4, as before: `)
    expect(files).toContain('  - Grown with no change: none by a case.')
    expect(files).toContain('the three record tests under Pins moved; and `REDESIGN_STATUS.md`')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    expect(beyond).toContain('`test/unit/redesign-status-ws09-step14.test.ts` and `test/unit/redesign-status-ws09-u-review.test.ts`, the two record tests under Pins moved beyond step 1\'s')
    expect(beyond).not.toContain('the one record test')
    for (const piece of ['No file the mail stream holds is touched', '`functions/utils/emailLayout.ts`', '`src/App.tsx`', '`src/lib/features.ts`', '`src/pages/MyRegionPage.tsx`, which only places it', ...HELD.map((f) => `\`${f}\``)]) {
      expect(beyond, piece).toContain(piece)
    }
    for (const file of [...HELD, 'src/App.tsx', 'src/lib/features.ts', 'functions/utils/emailLayout.ts', 'src/pages/MyRegionPage.tsx']) expect(read(file), file).not.toMatch(/NO_STATEMENT|LOG_IN_HELPS|buttonHtml/)
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint V, what checkpoint U\'s pictures asked: the parts against the files', () => {
  it('names the answer\'s one key as the link\'s handler and the contract hold it', () => {
    const answer = bullet(block, '- **The answer.**')
    for (const piece of [
      '`statement`', '`CheckClub.statement`', '`RegionClub.statement`', '`SELECT id, name, city, how_we_meet_text FROM clubs WHERE id = ?`', '`oneLine`',
      'null when the listing has none or only white space', 'no refused answer changes by a byte', 'the POST\'s answer, `name`, `city` and `month`, is unchanged',
      'so nothing new is told to a holder of a good link', 'stays strict', `\`${LINK_TEST}\``, `\`${CONTRACT_TEST}\``,
    ]) expect(answer, piece).toContain(piece)
    const link = read(LINK)
    expect(link).toContain('\'SELECT id, name, city, how_we_meet_text FROM clubs WHERE id = ?\'')
    expect(link).toContain('const statement = link.club.how_we_meet_text === null ? null : oneLine(link.club.how_we_meet_text) || null')
    expect(link).toContain('const body: ClubLinkResponse = { name: link.club.name, city: link.club.city, statement }')
    expect(link).toContain('const body: ClubLinkConfirmResponse = { name: link.club.name, city: link.club.city, month: monthInWords(row.last_confirmed_at) }')
    expect(read(CONTRACTS)).toContain('export const clubLinkResponseSchema = z.strictObject({\n  name: z.string(),\n  city: z.string(),\n  statement: z.string().nullable(),\n})')
    expect(read('src/areas/clubs/api.ts')).not.toMatch(/statement/)
  })

  it('names the page\'s words, its links told by status and what it never does with the token, as the page holds them', () => {
    const page = bullet(block, '- **The page.**')
    for (const piece of [
      `"${NONE}"`, '`NO_STATEMENT`', `\`${HOME}\``, 'the heading, the town, the words, the button and the status', 'A press that did not go through keeps the words',
      '`break-words` with `min-w-0`', 'told by the answer\'s status, never by the server\'s words', '"Log in to My region"', '`{ from: \'/workspace/region\' }`', '`src/pages/LoginPage.tsx`',
      '"Go to the home page"', 'The ready and done states carry no link', 'the token is in no link\'s address, no title and no log line', `\`${PAGE_TEST}\``,
    ]) expect(page, piece).toContain(piece)
    const source = read(PAGE)
    expect(source).toContain('const LOG_IN_HELPS = new Set([400, 410, 503])')
    expect(source).toContain('<Link to="/login" state={{ from: \'/workspace/region\' }} className={LINK}>Log in to My region</Link>')
    expect(source).toContain('<Link to="/" className={LINK}>Go to the home page</Link>')
    expect(source).toContain('{club.statement ?? NO_STATEMENT}')
    expect(source).not.toMatch(/https?:\/\/|token\}?["`]|console\./)
    expect(read(HOME)).toContain(`export const NO_STATEMENT = '${NONE}'`)
    expect(read('src/pages/LoginPage.tsx')).toContain('(location.state as { from?: string } | null)?.from ?? \'/dashboard\'')
  })

  it('names the email\'s two buttons, their measures and what stays, as emails.ts holds them', () => {
    const email = bullet(block, '- **The email.**')
    for (const piece of [
      'the dot between them is gone', '`emailButton` in `functions/utils/emailLayout.ts`', 'no gold word sits on a light ground', '48 pixels tall',
      'Measured in the picture at 390 pixels wide: each button 48 pixels tall', 'at 320 pixels the second wraps under the first, 8 pixels below it',
      'no media query the look depends on', 'two plain links', '`functions/utils/emailLayout.ts` is not changed', 'held byte for byte against the base\'s template', `\`${BUTTONS_TEST}\``,
    ]) expect(email, piece).toContain(piece)
    const emails = read(EMAILS)
    expect(emails).toContain('style="display:inline-block;margin:8px 8px 0 0;vertical-align:top;"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;${ground}font-family:${SANS};font-size:15px;line-height:20px;font-weight:bold;color:${NAVY};text-decoration:none;border-radius:8px;">')
    expect(emails).toContain('`background:${GOLD};border:2px solid ${GOLD};` : `background:#ffffff;border:2px solid ${NAVY};`')
    expect(emails).not.toContain('&middot;')
    expect(emails).toContain('club.statement ? oneLine(club.statement) : NO_STATEMENT,')
    expect(read('functions/utils/emailLayout.ts')).toContain('export function emailButton(label: string, url: string): string {')
  })

  it('names the bar\'s classes and its width, as ThisMonthBar.tsx holds them', () => {
    const bar = bullet(block, '- **The bar.**')
    for (const piece of ['`<span aria-hidden="true">· </span>`', '`lg`, 1024 pixels', '`flex-col`', '`hidden`', '`flex-row flex-wrap items-baseline gap-x-1.5`', 'the row needs 769 pixels for one line', `\`${BAR_TEST}\``]) {
      expect(bar, piece).toContain(piece)
    }
    const source = read(BAR)
    expect(source).toContain('<div className="flex min-w-0 flex-col gap-y-1 text-sm text-ink lg:flex-row lg:flex-wrap lg:items-baseline lg:gap-x-1.5">')
    expect(source).toContain('<span aria-hidden="true" className="hidden lg:inline">· </span>')
  })

  it('names what ships with every switch off, the merge, the database and a revert', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['Nothing a person meets', '`clubKeepers` is `false`', '`/clubs/confirm/:token` is still not registered', 'My region still sends everyone to the dashboard', '`CLUB_KEEPERS_ON` is `false`', 'refuse 403 before anything is read, with no query made', 'no email is sent', 'No switch is added']) {
      expect(ships, piece).toContain(piece)
    }
    // clubKeepers and CLUB_KEEPERS_ON went on together in the block "WS09 switch-on: clubKeepers and CLUB_KEEPERS_ON", so this step holds only that each is declared.
    expect(read('functions/utils/clubs/pages.ts')).toMatch(/^export const CLUB_KEEPERS_ON = (?:false|true)$/m)
    expect(read('src/lib/features.ts')).toMatch(/^ {2}clubKeepers: (?:false|true),$/m)
    expect(read('src/App.tsx')).toContain('{FEATURES.clubKeepers && <Route path="/clubs/confirm/:token" element={<ClubConfirmPage />} />}')
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration, no route and no endpoint', '103 handler files', '`PENDING_COUNT` 107', '`deploy-worker.yml`']) expect(does, piece).toContain(piece)
    if (latest) expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 107')
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('This step changes no table and writes no row')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('puts back checkpoint U\'s page, answer, email and bar')
    expect(bullet(block, '- **The branch.**')).toContain('cut from `main` at `ccf65c3`')
  })

  it('names the cases that hold each claim, as the tests name them', () => {
    const link = read(LINK_TEST)
    for (const name of [
      'a good link\\\'s GET carries the club\\\'s meeting words, as one line', 'null for a listing with no words, and for one whose words are only white space',
      'every refused GET is byte for byte the base\\\'s answer, and none carries the meeting words', 'with CLUB_KEEPERS_ON unset the GET still refuses before anything is read, words or none',
    ]) expect(link, name).toContain(`it('${name}'`)
    const page = read(PAGE_TEST)
    for (const name of ['draws the email\\\'s own sentence when the listing has no meeting words', 'tells the states apart by status, never by the server\\\'s words']) expect(page, name).toContain(`it('${name}'`)
  })

  it('gives the lint as unchanged and the build\'s figures with what moved and why', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', '`index-CePIMrHe.js` 557,538 bytes', '`index-BvZSeG0t.css` 134,782 bytes', '`features-nZCZoT6G.js` 729 bytes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(build, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint V, what checkpoint U\'s pictures asked: the Checks line', () => {
  it('gives each figure once, and no browser run of the suite', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `ccf65c3`\'s tree')
  })

  it('counts as many cases for each new and changed test as the file holds', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    for (const [file, now] of CHANGED_TESTS) expect(casesIn(file), file).toBe(now)
    expect(casesIn(CONTRACT_TEST)).toBe(4)
  })

  it('gives unit and integration counts that add up, and the lint files as the base\'s with the new files added', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([10167, 426])
    expect(num(before) + NEW_UNIT.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + (CHANGED_TESTS[0][1] - CHANGED_TESTS[0][2])).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, iAfter, iAfterFiles, iBefore, iBeforeFiles] = integration!
    expect([num(iBefore), Number(iBeforeFiles)]).toEqual([2530, 142])
    expect(num(iBefore) + NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + (CHANGED_TESTS[1][1] - CHANGED_TESTS[1][2])).toBe(num(iAfter))
    expect(Number(iAfterFiles) - Number(iBeforeFiles)).toBe(NEW_INTEGRATION.length)
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1127)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_TESTS.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[2]).toBe('206')
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint V, what checkpoint U\'s pictures asked: the lists and the pins', () => {
  it('adds K\'s decision 8 with K\'s words, in the list\'s form', () => {
    expect(tagged(decisions).map(head)).toEqual(['Checkpoint U\'s three choices (WS09 checkpoint V).'])
    const entry = tagged(decisions)[0]
    for (const piece of [
      'K\'s decision 8, of Sunday, November 15, 2026, about 5:20 PM UTC', '"All recommended"', 'checkpoint U merges into `main` now',
      'an LCA admin who also holds a regional seat is emailed that seat\'s clubs, not every club', 'a save notice that fails to send is not tried again within the hour',
      'the small things the pictures showed are fixed as the first step of checkpoint V', 'It does not cover any switch, WS09 step 15\'s pull request, any later merge',
    ]) expect(entry, piece).toContain(piece)
    if (latest) expect(decisions.trim().split('\n').at(-1)).toBe(entry)
  })

  it('logs each thing the pictures showed that this step does not fix, tagged for checkpoint V', () => {
    // The first seven entries tagged for checkpoint V are this step's; checkpoint V's review adds its own after them.
    expect(tagged(followUps).map(head).slice(0, 7)).toEqual([
      'The header marks Clubs on the no-login page (WS09 checkpoint V).',
      'The email\'s time names no zone (WS09 checkpoint V).',
      'The editor\'s share preview and its box\'s title (WS09 checkpoint V).',
      'The Listing tab\'s two checkboxes (WS09 checkpoint V).',
      'Today\'s dashboard: a date in numbers and a sentence beside the links (WS09 checkpoint V).',
      'A statement of white space alone in the email (WS09 checkpoint V).',
      'The email\'s buttons in Outlook on Windows (WS09 checkpoint V).',
    ])
    const all = tagged(followUps).slice(0, 7).join('\n')
    for (const piece of ['`src/components/layout/Navbar.tsx`, the mail stream\'s file', '"7:0..."', 'pressing the label ticks the box', '"valid through 2027-10-31"', 'needs K\'s own yes, which is put to K with checkpoint V', 'This was not seen: that program was not at hand.', 'One look in it is owed before `clubKeepers` goes on']) {
      expect(all, piece).toContain(piece)
    }
    // The checkboxes' labels are 44 pixels tall and name their box, as the follow-up says.
    const basics = read('src/areas/clubs/components/EditorBasics.tsx')
    expect(basics).toContain('const TICK_ROW = \'flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink\'')
    expect(basics).toContain('<label htmlFor={`editor-${field}`} className={TICK_ROW}>')
  })

  it('moves the pins it names, each the narrowest way', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    const step1 = read(MOVED[0])
    expect(step1).toContain('|WS09 checkpoint U: \\S|WS09 checkpoint V: \\S|WS09 checkpoint S, after K\'s second answer: \\S')
    expect(step1).toContain('toMatch(/^- \\*\\*[^*]+ \\(WS09 checkpoint V\\)\\.\\*\\* \\S|^- \\*\\*[^*]+ \\(WS09 (?:step')
    expect(read(MOVED[1])).toContain('const grown = ws09.includes(\'\\n### WS09 checkpoint V: what checkpoint U\\\'s pictures asked\\n\') ? [LINK_TEST, PAGE_TEST] : []')
    const review = read(MOVED[2])
    expect(review).toContain('    if (latest) expect(prLine.endsWith(\'; checkpoint U waits for K\\\'s word, and WS09 step 15 follows it as a pull request of its own.\')).toBe(true)')
    expect(review).toContain('    if (latest) expect(prLine.match(/pull request \\d+/g)).toEqual([\'pull request 130\', \'pull request 131\'])')
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint V, what checkpoint U\'s pictures asked: plain language', () => {
  const written = [merged, block, ...tagged(decisions), ...tagged(followUps), statusLine, prLine].join('\n')

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

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds and changes', () => {
    for (const file of [...NEW_TESTS, LINK, CONTRACTS, HOME, EMAILS, PAGE, BAR, PAGE_TEST, LINK_TEST, CONTRACT_TEST]) {
      const text = read(file)
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })

  it('writes the tests\' people and places plainly made up', () => {
    for (const file of [BUTTONS_TEST, BAR_TEST, WORDS_TEST, ROUND_TRIP_TEST, PAGE_TEST, LINK_TEST, CONTRACT_TEST]) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      expect(text, file).not.toMatch(/@(?!(?:[a-z0-9-]+\.)*example\.org|\/|domain\\?\/|testing-library\/|vitest-environment|font-face|media\/)[a-z]/)
    }
    for (const file of [BUTTONS_TEST, WORDS_TEST, ROUND_TRIP_TEST, PAGE_TEST, LINK_TEST]) expect(read(file), file).toContain('Example Chess Club')
  })
})
