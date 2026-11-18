// test/unit/redesign-status-ws09-u-review.test.ts
//
// REDESIGN_STATUS.md records checkpoint U in two blocks of its own, straight
// after WS09 step 14's block and before the decisions: "Checkpoint U: WS09
// steps 10 to 14, My region and the monthly check", what the checkpoint is,
// what its merge carries and what it asks of K; and "WS09 checkpoint U: the
// review of the whole and its fixes", its merge-safety review and the one
// round of fixes. Like the step record tests, this file reads only the WS09
// section, from its heading to the WS10 heading. Pinned here: the blocks'
// place and order; the Status line's tail and the PR line; the seven commits;
// the reload's words as its own block gives them; the eleven findings that
// stood, by their ids, and the two refuted; what each fix is in the files it
// names; the follow-up from B1; the pins moved; the figures of the Checks
// line, which must add up; and the plain-language rules. What a later block
// moves (the heading after the review, the Status line's tail) is read only
// while the review is the section's latest block.
import { readFileSync } from 'node:fs'
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
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
/** A file's code with its comments taken out, line comments and block comments alike. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const STEP14 = '### WS09 step 14: the monthly check'
const CHECKPOINT = '### Checkpoint U: WS09 steps 10 to 14, My region and the monthly check'
const REVIEW = '### WS09 checkpoint U: the review of the whole and its fixes'
const RELOAD = '### WS09 checkpoint U: the reload of a guarded page'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const checkpoint = part(CHECKPOINT)
const review = part(REVIEW)
const lines = ws09.split('\n')
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''
const latest = latestBlock === REVIEW
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const followUps = ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1)
const checksLine = review.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const buildLine = review.split('\n').find((l) => l.startsWith('- **Build.**')) ?? ''

/** The seven commits of the checkpoint, in order. */
const COMMITS = ['db332ab', '173319c', 'ff917fa', '224b670', '7533255', '82f197f', 'e3ef2c2']
/** The eleven findings that stood, as the block writes their ids, C1 and E2 being one fix. */
const STOOD = ['A1', 'A2', 'C1 and E2, one fix', 'C2', 'D1', 'D3', 'E1', 'E3', 'E4', 'E5']
const FOLLOW_UP = '- **The run record\'s prune and the read of `seen_by` (WS09 checkpoint U).** '

const SELF = 'test/unit/redesign-status-ws09-u-review.test.ts'
const NEW_UNIT = ['test/unit/region-failure-words.test.ts', 'test/unit/my-region-review-fixes.test.tsx', 'test/unit/my-region-editor-first-drawn.test.tsx', 'test/unit/audit-log-monthly-check-label.test.tsx', SELF]
const NEW_INTEGRATION = ['test/integration/club-check-activity.test.ts']
const NEW_TESTS = [...NEW_UNIT, ...NEW_INTEGRATION]

/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])

describe('REDESIGN_STATUS.md, WS09 checkpoint U: the two blocks and the lines at the top', () => {
  it('sit once each, straight after WS09 step 14\'s block, the checkpoint\'s section first, and before the four lists while the review is the latest', () => {
    expect(checkpoint).not.toBe('')
    expect(review).not.toBe('')
    for (const heading of [CHECKPOINT, REVIEW]) expect(ws09.split(`\n${heading}\n`), heading).toHaveLength(2)
    expect(headings[headings.indexOf(STEP14) + 1]).toBe(CHECKPOINT)
    expect(headings[headings.indexOf(CHECKPOINT) + 1]).toBe(REVIEW)
    if (latest) expect(headings[headings.indexOf(REVIEW) + 1]).toBe(LISTS[0])
    // Both forms of heading are the record's own, as WS09 step 1's test allows them.
    expect(read('test/unit/redesign-status-ws09-step1.test.ts')).toContain('Checkpoint [S-Z]: WS09 |WS09 checkpoint T: \\S|WS09 checkpoint U: \\S')
  })

  it('gives the Status line its tail while the review is the latest: S and T live, U built and reviewed and waiting for K\'s word, the reload live and the notice behind the switch, and step 15 on its own', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      expect(tail).toBe('checkpoints S and T merged into `main` on Sun, Nov 15, 2026 and are live; checkpoint U, steps 10 to 14 with the two small steps of K\'s decision 7, is built and reviewed on its own branch and waits for K\'s word for its merge: in it the reload of a guarded page is mended at its root, live with every switch off, and, behind `clubKeepers`, the save notice goes at most once an hour for one club and one saver; step 15 follows as its own pull request; steps 1 to 14, K\'s answers to checkpoint S\'s review and K\'s second answer, the Clubs page on a narrow phone, are built.')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    // D1: the reload fix is never read as behind the switch.
    expect(statusLine).not.toContain('mended at its root there and the save notice')
  })

  it('names checkpoint U and step 15 in the PR line, after the two merges, with no pull request number of their own', () => {
    if (latest) expect(prLine.endsWith('; checkpoint U waits for K\'s word, and WS09 step 15 follows it as a pull request of its own.')).toBe(true)
    if (latest) expect(prLine.match(/pull request \d+/g)).toEqual(['pull request 130', 'pull request 131'])
  })
})

describe('REDESIGN_STATUS.md, Checkpoint U: what it is and what it asks of K', () => {
  it('names its steps and the two small steps, each with its commit in order, and its branch', () => {
    const opening = checkpoint.split('\n')[2] ?? ''
    expect(opening).toContain('`redesign/ws09-clubs-u`')
    expect(opening).toContain('`9293e2f`')
    const at = COMMITS.map((c) => opening.indexOf(`\`${c}\``))
    expect(at.every((n) => n > 0), 'every commit named').toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const piece of ['WS09 step 10', 'WS09 step 11', 'WS09 step 12', 'WS09 step 13', 'the reload of a guarded page', 'the save notice at most once an hour', 'WS09 step 14', 'WS09 step 15, the worker\'s one line, is not in it']) {
      expect(opening, piece).toContain(piece)
    }
  })

  it('says what the merge carries: two migrations of one table each with no order, the reload in its own block\'s words, the two addresses, the headers file and the worker', () => {
    const carries = bullet(checkpoint, '- **What the merge carries.**')
    for (const piece of [
      '`0068_automation_runs.sql`', '`0069_club_check_marks.sql`', 'each adding one table that nothing live reads', 'the merge needs no order between the site\'s build and the migration run',
      '`/workspace/region` and `/workspace/region/clubs/:id`, addresses no link names, send to the dashboard, and a signed-out visitor from there to the login page, where the base drew the site\'s frame with an empty main area',
      '`public/_headers`, for `/clubs/confirm/*` alone', 'a byte-identical bundle, because files under `functions/utils/` change', 'No switch is added',
    ]) expect(carries, piece).toContain(piece)
    // The reload's landings are its own block's, word for word.
    const ships = bullet(part(RELOAD), '- **What ships with every switch off.**')
    const words = ships.slice(ships.indexOf('A visitor meets nothing new'), ships.indexOf(' No switch is added'))
    expect(words.length).toBeGreaterThan(400)
    expect(carries).toContain(words)
    // Each migration adds one table and nothing else; the headers file names one address.
    for (const file of ['migrations/0068_automation_runs.sql', 'migrations/0069_club_check_marks.sql']) {
      const sql = read(file).replace(/^--.*$/gm, '')
      expect(sql.match(/CREATE TABLE/g), file).toHaveLength(1)
      expect(sql, file).not.toMatch(/^\s*(?:DROP|ALTER|UPDATE|DELETE|INSERT)\b/m)
    }
    // The headers file named one address at checkpoint U; WS09 step 27 adds the Reply through LCA page's, after it.
    expect(read('public/_headers').split('\n').filter((l) => l.startsWith('/'))).toEqual(['/clubs/confirm/*', '/clubs/reply/*'])
  })

  it('names what is owed before clubKeepers goes on as K\'s own, step 15 by agreement, and the days for the merge', () => {
    const owed = bullet(checkpoint, '- **Owed before clubKeepers goes on, K\'s own.**')
    for (const piece of [
      '`SIGNING_SECRET`, set in Cloudflare by K\'s own hands', 'one value for production and a different one for Preview', '32 random bytes or more', 'The look at the picture sheets',
      'the "Baton Rouge / East Central Representative" seat', 'The Baton Rouge seat, owed before checkpoint S merges (WS09 step 3).', 'until the site\'s mail moves to Amazon SES, the sending service allows 100 emails a day',
      'one email for each regional seat holder', 'seven regions', 'each press of "Send this month\'s check now" counts against the same day',
    ]) expect(owed, piece).toContain(piece)
    // The two follow-ups it points to are in the list, as written.
    for (const start of ['- **The Baton Rouge seat, owed before checkpoint S merges (WS09 step 3).** ', '- **K\'s signing secret, owed before clubKeepers goes on (WS09 step 13).** ']) {
      expect(followUps.split('\n').some((l) => l.startsWith(start)), start).toBe(true)
    }
    expect(read('migrations/0050_officer_role_seat_regions.sql').match(/INSERT OR IGNORE INTO seat_regions/g)).toHaveLength(7)
    const step15 = bullet(checkpoint, '- **Step 15, by agreement with the mail stream.**')
    for (const piece of [
      'Sunday, November 15, 2026', 'a pull request of their own after checkpoint U and after the mail stream\'s first newsletter has gone out', 'with the mail stream\'s written word',
      'exactly an import, `SIGNING_SECRET` in the worker\'s `Env` and one phase after the campaign sweep', 'from 76.61 KiB to 96.69 KiB', 'only from the LCA admin\'s button',
    ]) expect(step15, piece).toContain(piece)
    expect(step15).not.toMatch(/pull request \d+/)
    expect(bullet(checkpoint, '- **The days for the merge.**')).toContain('Sunday, November 15 to Tuesday, November 17, 2026 are clear days for checkpoint U\'s merge, and Wednesday, November 18, 2026 is not')
    // Nothing under workers/ calls the check yet.
    expect(read('workers/daily-emails/src/index.ts')).not.toMatch(/runMonthlyCheck|clubs\/monthlyCheck/)
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint U: the review of the whole and its fixes', () => {
  it('names the five lenses, thirteen reported, eleven stood, none blocking, and the two refuted with their reasons', () => {
    const what = bullet(review, '- **What this is.**')
    for (const piece of [
      'what ships with every switch off (A)', 'the database (B)', 'security (C)', 'the other stream, the shared files and the owner\'s rules (D)', 'the pages with the switch on (E)',
      'A second reader tested each finding', 'Thirteen were reported and eleven stood, none blocking', 'B1, since', 'its 90-day prune is WS08\'s in the brief', 'D2, since the Branch line names the branch WS09 was first cut on',
    ]) expect(what, piece).toContain(piece)
    expect(ws09).toContain('**Branch:** `redesign/ws09-clubs`, cut from `main` at `af4a21c`.')
  })

  it('gives each of the eleven by its id, in order, with what was found and what was done', () => {
    const found = bullet(review, '- **Findings and fixes.**').split('\n').slice(1)
    expect(found.map((l) => l.slice(4, l.indexOf('. ')))).toEqual(STOOD)
    for (const line of found) expect(line, line.slice(0, 12)).toMatch(/ (?:Fixed|Recorded, the code kept|Fixed in words)[:.]/)
    expect(found.join('\n')).not.toMatch(/\b(?:B1|D2)\./)
  })

  it('A1 and A2: the record corrected in each step, the routes kept, and the places comment in its new words', () => {
    const app = read('src/App.tsx')
    expect(app).toContain('<Route path="/workspace/region" element={FEATURES.clubKeepers ? <RoleProtectedRoute requireSeat><MyRegionPage /></RoleProtectedRoute> : <Navigate to="/dashboard" replace />} />')
    expect(app).toContain('<Route path="/workspace/region/clubs/:id" element={FEATURES.clubKeepers ? <RoleProtectedRoute requireSeat requireClubMatch><MyRegionClubPage /></RoleProtectedRoute> : <Navigate to="/dashboard" replace />} />')
    expect(ws09).not.toContain('which carries the button, is not routed')
    expect(ws09).not.toContain('as before, before anything is read or written')
    // Twice in each of WS09 steps 11 and 12, once in the checkpoint's section and once in A1.
    expect(ws09.split('where the base drew the site\'s frame with an empty main area').length - 1).toBe(6)
    const places = read('functions/api/admin/clubs/[id]/places.ts')
    expect(places).toContain('// unset every keeper is answered 403 in words after the sign-in and\n// permission check (requireClubRep, which reads the session and the member\n// and, for a region\'s representative, the club\'s region), before this\n// handler reads the club or the body, and nothing is written.')
    expect(places.indexOf('await requireClubRep(')).toBeLessThan(places.indexOf('if (!CLUB_KEEPERS_ON) return errorResponse(PLACES_CLOSED, 403)'))
  })

  it('C1 and E2, and C2: the button\'s words in the files, and the activity row written only after a press where the check ran', () => {
    const region = read('src/areas/clubs/region.ts')
    expect(region).toContain('export const SEND_UNSURE = \'The send may not have finished, so some people may already have the email. Pressing again sends it to everyone again.\'')
    expect(region).toContain('return err instanceof ApiError && err.status >= 400 && err.status < 500 && err.message !== `Request failed (${err.status})`')
    expect(region).toContain('return `Could not ask how many people the check goes to: ${errorWords(err)}`')
    const button = codeOf('src/areas/clubs/components/MonthlyCheckButton.tsx')
    expect(button).toContain('setSaid(sendFailedWords(err))')
    expect(button).toContain('setSaid(askFailedWords(err))')
    expect(button).not.toContain('Not sent:')
    const check = codeOf('functions/api/admin/clubs/monthly-check.ts')
    const send = check.indexOf('const done = await runMonthlyCheck(context.env, now, true, { request: context.request })')
    const row = check.indexOf('  if (done.stopped === null) {\n    await recordAdminAction(context.env.DB, authResult.member, {')
    expect(send).toBeGreaterThan(check.indexOf('if (!body.send) {'))
    expect(row).toBeGreaterThan(send)
    expect(check).toContain('      action: \'club_monthly_check_sent\',\n      targetLabel: done.month,\n      detail: { sent: done.sent, notSent: done.notSent, notReached: done.notReached },')
    expect(check.match(/recordAdminAction\(/g)).toHaveLength(1)
    expect(read('functions/utils/admin/audit.ts')).toContain('  | \'club_monthly_check_sent\'\n')
    expect(read('src/areas/admin/components/AuditLogPanel.tsx')).toContain('club_monthly_check_sent: { label: \'Sent the monthly check\', icon: Mail, className: \'bg-info-100 text-info-800\' },')
    expect(read('functions/utils/clubs/monthlyCheck.ts')).not.toMatch(/admin\/audit|recordAdminAction/)
    const c2 = bullet(review, '- **Findings and fixes.**').split('\n').find((l) => l.startsWith('  - C2. ')) ?? ''
    expect(c2).toContain('K\'s decision 7, that Still accurate writes no row in the activity log, is about Still accurate and is untouched: this row is for a bulk send by an admin.')
    expect(part(LISTS[0])).toContain('Still accurate writes no row in the activity log')
  })

  it('D3 and E1 to E5: the claims against the pages', () => {
    const news = read('src/areas/clubs/components/ClubNewsPanel.tsx')
    expect(news).toContain('{myRegion ? \'Nothing posted yet.\' : \'Nothing posted yet. Anything you publish below appears on the club\\\'s public page.\'}')
    const page = codeOf('src/pages/MyRegionClubPage.tsx')
    expect(page).toContain('const [editorDrawn, setEditorDrawn] = useState(false)')
    expect(page).toContain('{club && data && (tab === \'listing\' || editorDrawn) && (\n          <div hidden={tab !== \'listing\'}>')
    // The editor is marked as drawn from inside its own Suspense, so only once its file has come with Listing showing.
    expect(page).toMatch(/<ClubEditor\b[\s\S]*?\/>\n\s*<EditorDrawn onDrawn=\{keepEditor\} \/>\n\s*<\/Suspense>/)
    expect(page).toContain('<h1 ref={heading} tabIndex={-1} className="mt-1 break-words text-3xl font-bold tracking-tight outline-none sm:text-4xl">')
    expect(page).toContain('if (attempt > 0 && loadKind !== null) heading.current?.focus()')
    expect(page).toContain('if (newsAttempt === 0 || newsKind === null) return')
    expect(page).toContain('const lost = document.activeElement === null || document.activeElement === document.body')
    expect(page).toContain('if (tab === \'news\' && lost) heading.current?.focus()')
    expect(page).toContain('}, [newsAttempt, newsKind, tab])')
    expect(page).toContain('    setConfirming(true)\n')
    expect(page.indexOf('    setSaid(\'\')\n    try {\n      const answer = await confirmClubStillAccurate(clubId)')).toBeGreaterThan(0)
    expect(page).toContain('aria-current={tab === tid ? \'true\' : undefined}')
    const region = codeOf('src/pages/MyRegionPage.tsx')
    expect(region).toContain('    if (!onItsWay.current.has(club.id)) setSaid(\'\')\n    const stamp = await confirmOne(club)')
    expect(read('src/areas/clubs/region.ts')).toContain('export const SITE_UNREACHED = \'The site could not be reached. Check your connection, then try again.\'')
    expect(read('src/areas/clubs/region.ts')).toContain('  if (!(err instanceof ApiError)) return SITE_UNREACHED')
  })

  it('logs B1\'s follow-up in the list\'s form, under its tag', () => {
    expect(bullet(review, '- **The follow-up.**')).toContain(`"${FOLLOW_UP.slice(4, FOLLOW_UP.indexOf('**', 4))}"`)
    const entry = followUps.split('\n').find((l) => l.startsWith(FOLLOW_UP)) ?? ''
    for (const piece of [
      'Logged in checkpoint U\'s review, from B1, which did not stand.', 'The brief\'s 90-day prune of `automation_runs`', 'an index for the member delete\'s read of `seen_by`',
      'WS08\'s by the brief or the mail stream\'s send-later phase', 'nothing in WS09 writes more than a few rows a month', 'must call `recordRun` only when something is due',
    ]) expect(entry, piece).toContain(piece)
    expect(read('functions/api/admin/members/[id].ts')).toContain('UPDATE automation_runs SET seen_by = NULL WHERE seen_by = ?')
    // The brief's one index is the only one the table has.
    expect(read('migrations/0068_automation_runs.sql').replace(/^--.*$/gm, '').match(/CREATE INDEX/g)).toHaveLength(1)
  })

  it('names its pins, and each moved check holds', () => {
    const pins = bullet(review, '- **Pins moved.**')
    for (const file of [
      'test/unit/goldText.test.ts', 'test/unit/redesign-status-ws09-step12.test.ts', 'test/unit/redesign-status-ws09-step14.test.ts', 'test/unit/redesign-status-ws09-step11.test.ts',
      'test/unit/redesign-status-ws09-u-notice.test.ts', 'test/unit/redesign-status-ws09-u-reload.test.ts',
    ]) expect(pins, file).toContain(`\`${file}\``)
    // WS09 step 18 adds three labels above the badge, so the line both read moves from 275 to 278.
    expect(read('test/unit/goldText.test.ts')).toContain('\'src/areas/admin/components/AuditLogPanel.tsx:278 \',')
    expect(read('src/areas/admin/components/AuditLogPanel.tsx').split('\n')[277]).toContain('<span')
    expect(read('test/unit/redesign-status-ws09-step12.test.ts')).toContain('expect(prLine.startsWith(\'**PR:** checkpoint S (steps 1 to 5) merged into `main` as pull request 130')
    for (const file of ['test/unit/redesign-status-ws09-u-notice.test.ts', 'test/unit/redesign-status-ws09-u-reload.test.ts']) {
      expect(read(file), file).toContain('expect(tagged(followUps).map(head).filter((h) => h !== \'The run record\\\'s prune and the read of `seen_by` (WS09 checkpoint U).\')).toEqual([])')
    }
    expect(read('test/unit/redesign-status-ws09-step14.test.ts')).toContain('const latest = latestStep === 14 && latestBlock === STEP')
    expect(read('test/unit/admin-club-news-lift.test.tsx')).toContain('draws the markup it drew before the move, for each kind of person, with news and with none')
  })

  it('names the judgement calls for A1 and C2', () => {
    const calls = bullet(review, '- **Judgement calls.**')
    expect(calls).toContain('  - A1: the record is corrected and the code kept.')
    expect(calls).toContain('  - C2: an activity row for a bulk send by an admin')
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint U\'s review: the figures', () => {
  it('counts as many cases for each new test as the file holds', () => {
    const files = bullet(review, '- **Files.**')
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
  })

  it('gives unit counts that add up: the base\'s and the new files\'', () => {
    const files = bullet(review, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([10125, 421])
    expect(num(before) + NEW_UNIT.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts as the base\'s with the new file added', () => {
    const files = bullet(review, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2524, 141])
    expect(num(before) + NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the lint files as the base\'s with the new tests added, and the build beside the base\'s', () => {
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this block touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1121)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_TESTS.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(Number(built?.[2])).toBe(206)
    expect(Number(checked?.[1])).toBe(Number(built?.[1]))
    for (const piece of ['`index-1YA0aIES.js` 557,538 bytes', '`index-BvZSeG0t.css` 134,782 bytes', '`features-nZCZoT6G.js` 729 bytes']) expect(buildLine, piece).toContain(piece)
    expect(buildLine).toMatch(/the main script `index-[\w-]+\.js` [\d,]+ bytes/)
    expect(checksLine).toContain('`npm run typecheck:functions`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `e3ef2c2`\'s tree')
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint U: the plain-language rules in what it wrote', () => {
  const written = [
    checkpoint, review, statusLine, prLine, followUps.split('\n').find((l) => l.startsWith(FOLLOW_UP)) ?? '',
    ...ws09.split('\n').filter((l) => l.includes('where the base drew the site\'s frame with an empty main area')),
  ].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials, unfilled marks and a he for K out of what it wrote', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    expect(proseOf(written)).not.toMatch(HE)
  })

  it('gives every date its weekday and writes "US Chess" where the federation is named', () => {
    const prose = proseOf(written)
    for (const m of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/g)) {
      const before = prose.slice(Math.max(0, m.index! - 12), m.index!)
      expect(before, m[0]).toMatch(/(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), $|(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), (?:November) \d{1,2} to [A-Z][a-z]+day, $/)
    }
    expect(prose).not.toMatch(/\d{1,2}:\d{2}\s?(?:am|pm)\b/)
  })
})
