// test/unit/redesign-status-ws09-u-notice.test.ts
//
// REDESIGN_STATUS.md records the save notice at most once an hour, a step of
// WS09's checkpoint U added on K's decision 7, of Sunday, November 15, 2026.
// Like the record test of the reload of a guarded page, this file reads only
// the WS09 section, from its heading to the WS10 heading. Pinned here: the
// block right after the reload's block, and before the four lists while it
// is the section's latest block; the Status line's tail while it is; the
// block's parts in order and its claims against the files they describe (the
// save's row and its decision, the notice's sentence, the two handlers and
// the Activity page); the figures of its Checks line; K's decision 7 in the
// decisions list; item T10 and its follow-up closed and the sentences it
// adds to earlier bullets; the two pins it moves; and the plain-language
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
const TAG = '(WS09 checkpoint U).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 checkpoint U: the reload of a guarded page'
const BLOCK = '### WS09 checkpoint U: the save notice at most once an hour'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const decisions = part(LISTS[0])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''

const SAVE = 'functions/utils/clubs/save.ts'
const EMAILS = 'functions/utils/clubs/emails.ts'
const HANDLER = 'functions/api/admin/clubs/[id].ts'
const PLACES = 'functions/api/admin/clubs/[id]/places.ts'
const PANEL = 'src/areas/admin/components/AuditLogPanel.tsx'
const ROUTING = 'functions/utils/clubs/routing.ts'
const LIMIT_TEST = 'test/integration/club-save-notice-limit.test.ts'
const WORDS_TEST = 'test/unit/club-save-notice-words.test.ts'
const SELF = 'test/unit/redesign-status-ws09-u-notice.test.ts'
const NEW_UNIT = [WORDS_TEST, SELF]
const NEW_TESTS = [LIMIT_TEST, ...NEW_UNIT]
/** The Activity page's test, to which one case is added for the notice key; the file is not new. */
const ACTIVITY_TEST = 'test/unit/audit-log-delete-label.test.tsx'
/** The tests of the notice whose one case's meaning moves, each with its count, the same before and after. */
const CHANGED_TESTS: ReadonlyArray<readonly [string, number]> = [
  ['test/integration/club-save.test.ts', 18],
  ['test/integration/role-safety.test.ts', 8],
  ['test/integration/club-save-one-press.test.ts', 9],
]
/** The record tests whose one pin each this step moves. */
const MOVED = ['test/unit/redesign-status-ws09-t-review.test.ts', 'test/unit/redesign-status-ws09-u-reload.test.ts']
/** The files the mail stream holds. */
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
/** The sentence the notice gains, for a saver's name. */
const sentence = (name: string) => `If ${name} saves again within the hour, no second email follows; the link shows the listing as it stands.`

/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])

describe('REDESIGN_STATUS.md, WS09 checkpoint U, the save notice at most once an hour: the block', () => {
  it('sits once, right after the reload\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(BLOCK)
    if (latestBlock === BLOCK) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this block\'s tail while it is the latest', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestBlock === BLOCK) {
      expect(tail).toBe('checkpoints S and T merged into `main` on Sun, Nov 15, 2026; checkpoint U goes on on its own branch, and on K\'s decision 7 the reload of a guarded page is mended at its root there and the save notice goes at most once an hour for one club and one saver, behind `clubKeepers`; steps 1 to 13, K\'s answers to checkpoint S\'s review and K\'s second answer, the Clubs page on a narrow phone, are built.')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens with what was found, K\'s answer and what was built', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'K\'s decision 7, of Sunday, November 15, 2026', 'What was found: the record\'s item T10', 'with no limit by club, saver or time', 'K\'s answer:',
      'the notice is the second pair of eyes', 'chose the first of the four', 'an LCA admin\'s saves sending it as anyone\'s do', 'What was built:',
      'behind `CLUB_KEEPERS_ON`, which stays unset', 'decided inside the statement that writes the row', 'with every switch off nothing a person meets changes',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The hour.**', '- **The log.**', '- **Two at once.**', '- **The words.**', '- **Who reads the detail.**',
      '- **The follow-ups it closes.**', '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**',
      '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(6)
    for (const piece of ['A failed send waits out the hour, for K\'s sheet', 'Saves within the hour reach the representative through the link and not through a second email', 'A save that moves the club to another region is decided on the region it leaves the club in']) {
      expect(calls, piece).toContain(piece)
    }
  })

  it('names every file it adds and changes, each test with its count, and leaves the held files and the Activity page alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_TESTS, SAVE, EMAILS, HANDLER, PLACES, ROUTING, ...MOVED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const file of NEW_TESTS) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const [file, count] of CHANGED_TESTS) expect(files, file).toContain(`\`${file}\` (${count}, as before: `)
    expect(files).toContain('  - Grown with no change: none by a case.')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['No file the mail stream holds is touched', `\`${PANEL}\``, `\`${ROUTING}\`, one function added`, ...HELD.map((f) => `\`${f}\``)]) expect(beyond, piece).toContain(piece)
    for (const file of [...HELD, PANEL, 'src/App.tsx', 'src/lib/features.ts', ROUTING]) expect(read(file), file).not.toMatch(/noticeMayGo|NOTICE_IN_THE_HOUR|SavedChange|"notice"/)
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint U, the save notice at most once an hour: the parts against the files', () => {
  const save = read(SAVE)
  const emails = read(EMAILS)

  it('names the row\'s new key and the decision inside its INSERT, as save.ts holds them', () => {
    const log = bullet(block, '- **The log.**')
    for (const piece of ['`"notice": true` or `"notice": false`', '`{"club_id":"example-chess-club","fields":["cost_text"],"notice":true}`', 'still writes its row with its fields', 'writes no row and sends nothing, as before', '`recordAdminAction`', 'byte for byte as on the base', 'its rows never count']) {
      expect(log, piece).toContain(piece)
    }
    for (const piece of [
      'const detail = (notice: boolean) => JSON.stringify({ club_id: clubId, fields, notice })',
      'CASE WHEN ? = 1 AND NOT EXISTS (${NOTICE_IN_THE_HOUR}) THEN ? ELSE ? END',
      'WHERE EXISTS (SELECT 1 FROM clubs WHERE id = ?)',
      'RETURNING json_extract(detail, \'$.notice\') AS notice',
      'await noticeMayGo(db, save.clubId, save.saver.id, changed)',
      'await noticeMayGo(db, save.clubId, save.saver.id, changed, region)',
      'const region = \'region\' in next ? (typeof next.region === \'string\' ? next.region : null) : undefined',
    ]) expect(save, piece).toContain(piece)
    expect(save.match(/return \{ fields: changed, notice: changed\.length > 0 && noticeGoes\(results\[statements\.length - 1\]\) \}/g)).toHaveLength(2)
    // Today's save writes its row as before, with no notice key.
    expect(read(HANDLER)).toContain('detail: { club_id: clubId, fields: changed },')
  })

  it('names the hour\'s column and its bound, as the statement holds them, and the two at once', () => {
    const hour = bullet(block, '- **The hour.**')
    for (const piece of [
      '`created_at > datetime(\'now\', \'-3600 seconds\')`', 'the database\'s clock that stamps the row', 'a row 3,599 seconds old counts and one 3,600 seconds old does not',
      'never from the last save', 'sends at the first save, not the second, and at the third', 'share the one count, both ways', 'counted as anyone\'s', `\`${LIMIT_TEST}\``,
    ]) expect(hour, piece).toContain(piece)
    for (const piece of ['WHERE actor_id = ? AND action = \'club_edit\'', 'AND created_at > datetime(\'now\', \'-3600 seconds\')', 'THEN json_extract(detail, \'$.club_id\') = ? AND json_extract(detail, \'$.notice\') = 1', 'CASE WHEN json_valid(detail)']) {
      expect(save, piece).toContain(piece)
    }
    expect(read('migrations/0029_admin_audit_log.sql')).toMatch(/created_at\s+TEXT NOT NULL DEFAULT \(datetime\('now'\)\)/)
    const twice = bullet(block, '- **Two at once.**')
    for (const piece of ['one statement of the save\'s batch', 'one transaction on D1\'s one writer', 'whichever batch runs second sees the first one\'s row', '`RETURNING json_extract(detail, \'$.notice\')`']) {
      expect(twice, piece).toContain(piece)
    }
  })

  it('names the sentence the notice gains as emails.ts holds it, and the two calls send only when the row says so', () => {
    const words = bullet(block, '- **The words.**')
    expect(words).toContain(`"${sentence('Player One')}"`)
    for (const piece of ['in the HTML and the text alike', '`oneLine`', 'escaped', 'the pause of 400 milliseconds', `\`${WORDS_TEST}\``]) expect(words, piece).toContain(piece)
    expect(emails).toContain('const later = `If ${saverName} saves again within the hour, no second email follows; the link shows the listing as it stands.`')
    expect(emails).toContain(']) + p(escapeHtml(why)) + p(escapeHtml(later)),')
    expect(emails).toContain('const SEND_INTERVAL_MS = 400')
    expect(emails).toContain('const HEADING = \'A club\\\'s listing in your region was updated\'')
    expect(emails).toContain('export async function noticeMayGo(\n  db: D1Database,\n  clubId: string,\n  saverId: string,\n  columns: readonly string[],\n  region?: string | null,\n): Promise<boolean> {')
    expect(emails).toContain('region === undefined ? await regionRepresentativesOf(db, clubId) : await representativesOfRegion(db, region)')
    expect(read(ROUTING)).toContain('export async function representativesOfRegion(db: D1Database, region: string | null): Promise<Keeper[]> {')
    expect(read(HANDLER)).toContain('  if (!changed.notice) return null\n\n  context.waitUntil(sendClubSaveNotice(')
    expect(read(PLACES)).toContain('  if (changed.notice) {\n    context.waitUntil(sendClubSaveNotice(')
    for (const file of [HANDLER, PLACES]) expect(read(file), file).toContain('columns: changed.fields,')
  })

  it('names who reads the detail, and the Activity page draws the fields alone', () => {
    const who = bullet(block, '- **Who reads the detail.**')
    for (const piece of [`\`${PANEL}\``, 'reads `fields` alone', '"Changed cost text, weekend play"', 'the key is never drawn', '`functions/api/admin/audit.ts`', '`scripts/apply-memberships.mjs`', 'no export reads it']) {
      expect(who, piece).toContain(piece)
    }
    const panel = read(PANEL)
    expect(panel).toContain('    case \'club_edit\':\n      return Array.isArray(parsed.fields) ? `Changed ${parsed.fields.join(\', \').replace(/_/g, \' \')}` : null')
    expect(panel).not.toMatch(/parsed\.notice/)
  })

  it('names what ships with every switch off, the merge, the database and a revert', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['Nothing a person meets', '`CLUB_KEEPERS_ON` is `false`', '"The new club page fields cannot be saved yet."', '"A club\'s places cannot be saved yet."', 'no notice is sent or counted', 'No switch is added']) {
      expect(ships, piece).toContain(piece)
    }
    expect(read('functions/utils/clubs/pages.ts')).toContain('export const CLUB_KEEPERS_ON = false')
    expect(read('src/lib/features.ts')).toContain('  clubKeepers: false,')
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration, no route and no contract', '`deploy-worker.yml`', 'keep their names and sizes']) expect(does, piece).toContain(piece)
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('This step changes no table')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('every save that changes a field emails the representatives again')
  })

  it('names the cases that hold each claim, as the tests name them', () => {
    const limit = read(LIMIT_TEST)
    for (const name of [
      'a save that changes a field sends one notice to each representative, and its row says so',
      'a second save ten minutes later sends none, and still lands, stamps the club and writes its row with its fields and no notice',
      'a save 59 minutes 59 seconds after the notice sends none, and one at 60 minutes sends one',
      'a chain of saves 50 minutes apart sends at the first, not the second, and at the third: the hour counts from the last notice, not the last save',
      'another saver on the same club within the hour sends, and the same saver on another club sends',
      'an LCA admin\\\'s saves are counted as anyone\\\'s: one notice in the hour',
      'an LCA admin who moves a club from no region into a seated one tells that region\\\'s representatives once',
      'an LCA admin who moves a club out of a seated region into one with no representative tells no one and starts no hour',
      'two saves by one saver on one club started together send one notice between them',
      'a save by one of the region\\\'s representatives sends none, its row says so, and it starts no hour for anyone',
      'a region with no representative sends none and its row says so, so a seat filled within the hour hears of the next save',
      'a send that fails is not tried again within the hour: its row says the notice went',
      'role safety: a person the save refuses writes no row and starts no hour',
      'today\\\'s save writes its row as before, with no notice key, and its rows are never counted',
      'with CLUB_KEEPERS_ON unset the listing save and the places save are refused as before, and nothing is sent or counted',
    ]) expect(limit, name).toContain(`it('${name}'`)
    expect(limit).not.toMatch(/vi\.useFakeTimers|setSystemTime/)
    const words = read(WORDS_TEST)
    for (const name of ['keeps a name that carries a comma whole, in the HTML and the text', 'escapes a name that carries markup in the HTML, and gives it as typed in the text']) {
      expect(words, name).toContain(`it('${name}'`)
    }
  })

  it('gives the lint as unchanged and the build\'s figures as the base\'s', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', '`index-DDIOQyC-.js` 556,593 bytes', '`index-DURnNUWK.css` 134,731 bytes', '`features-nZCZoT6G.js` 729 bytes', 'byte for byte', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(build, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint U, the save notice at most once an hour: the Checks line', () => {
  it('gives each figure once, and no browser run of the suite', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `7533255`\'s tree')
  })

  it('counts as many cases for each new test as the file holds', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    for (const [file, count] of CHANGED_TESTS) expect(casesIn(file), file).toBe(count)
  })

  it('gives unit counts that add up: the base\'s and the new files\'', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([10037, 416])
    expect(num(before) + NEW_UNIT.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + 1).toBe(num(after))
    expect(files).toContain(`\`${ACTIVITY_TEST}\``)
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up, and the lint files as the base\'s with the new files added', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2433, 136])
    expect(num(before) + writtenCount(files, LIMIT_TEST)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(1)
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1105)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_TESTS.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(built?.[2])
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint U, the save notice at most once an hour: the lists and the earlier bullets', () => {
  it('adds what this step settles to the first part of K\'s decision 7, and tags nothing else', () => {
    expect(tagged(decisions).map(head)).toEqual(['The five open choices (WS09 checkpoint U).'])
    const entry = tagged(decisions)[0]
    const first = entry.slice(entry.indexOf('Its five parts: '), entry.indexOf('; what a first save does to today\'s page'))
    for (const piece of [
      'at most once an hour for one club and one saver', 'built behind `clubKeepers` by a later step, which is the block "WS09 checkpoint U: the save notice at most once an hour"',
      'the hour is 3,600 seconds counted from the last notice', '`created_at`', '`"notice": true`', 'decided in the same statement that writes the save\'s row', 'sharing the one count',
    ]) expect(first, piece).toContain(piece)
    if (latestBlock === BLOCK) expect(decisions.trim().split('\n').at(-1)).toBe(entry)
    expect(tagged(followUps)).toEqual([])
  })

  it('marks item T10 and its follow-up closed with their words kept, and adds one marked sentence to each of two earlier bullets', () => {
    const review = part('### WS09 checkpoint T: the review of the whole and its fixes')
    const t10 = review.split('\n').find((l) => l.startsWith('  - T10. ')) ?? ''
    expect(t10).toContain(' Not fixed: ')
    expect(t10).toContain('keeps the representative told of every saver within the hour. Closed in WS09 checkpoint U: K chose the first in K\'s decision 7')
    expect(t10.split('Closed in WS09 checkpoint U: ')).toHaveLength(2)
    const stays = entries(followUps).find((l) => l.startsWith('- **Items T10 and P9 stay with K (WS09 step 10).**')) ?? ''
    expect(stays).toContain('and Still accurate sends no email. Closed in WS09 checkpoint U, for T10 alone: ')
    expect(stays).toContain('this closing says nothing of P9.')
    const notice = bullet(part('### WS09 step 6: saving a listing'), '- **The notice.**')
    expect(notice).toContain('names a mail service\'s address. Changed at checkpoint U: on K\'s decision 7 the notice goes at most once an hour')
    const decision = entries(decisions).find((l) => l.startsWith('- **The save notice goes to the region\'s representatives (WS09 step 6).**')) ?? ''
    expect(decision).toContain('the notice names fields and never a value. Changed at checkpoint U: on K\'s decision 7, at most once an hour for one club and one saver.')
    // The reload's three and this block's two.
    if (latestBlock === BLOCK) expect(ws09.split('Changed at checkpoint U: ')).toHaveLength(6)
  })

  it('moves only the two pins it names, each gated the narrowest way', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    const review = read(MOVED[0])
    expect(review).toContain('if (!ws09.includes(`\\n${NOTICE_BLOCK}\\n`)) expect(read(\'functions/utils/clubs/emails.ts\')).not.toMatch(/club_edit|within the hour|one notice an hour/)')
    expect(review).toContain('if (!ws09.includes(`\\n${NOTICE_BLOCK}\\n`)) expect(save).toContain(\'SELECT ?, ?, ?, \\\'club_edit\\\', NULL, ?, ? WHERE EXISTS (SELECT 1 FROM clubs WHERE id = ?)\')')
    expect(read(MOVED[1])).toContain('    if (latestBlock === BLOCK) expect(ws09.split(\'Changed at checkpoint U: \')).toHaveLength(4)')
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint U, the save notice at most once an hour: plain language', () => {
  const marked = ws09.split('\n').filter((l) => l.includes('Changed at checkpoint U: ') || l.includes('Closed in WS09 checkpoint U'))
  const written = [block, ...tagged(decisions), ...marked, statusLine].join('\n')

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

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds and changes', () => {
    for (const file of [...NEW_TESTS, SAVE, EMAILS, HANDLER, PLACES]) {
      const text = read(file)
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })

  it('writes the tests\' people and places plainly made up', () => {
    for (const file of [LIMIT_TEST, WORDS_TEST]) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      expect(text, file).not.toMatch(/@(?!(?:[a-z0-9-]+\.)*example\.org|\/)[a-z]/)
      expect(text, file).toContain('Example Chess Club')
    }
  })
})
