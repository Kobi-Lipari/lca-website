// test/unit/redesign-status-phase0-club-email-switch-on.test.ts
//
// REDESIGN_STATUS.md, the club email switch-on: the block it wrote in the
// Phase 0 trim's section, "The switch-on: the club email switch turned on",
// read from the record alone. It reads only that block, from its heading to
// the next heading of the section or the section's end; the trim's own lines
// this change made true, its Status and PR lines and the sentence that closes
// the first half of its first follow-up, are held by
// test/unit/redesign-status-phase0-trim.test.ts. Pinned here: the block's
// heading and its place after the trim's follow-ups, its bullets in their
// order and the key words of each, K's word and its day, the roster switch
// kept off and why, what a club with no other way to be reached relies on,
// the files with each test file's count, the pins moved, what is checked, the
// Checks line's form, and the plain-language rules on all of it. It holds the
// block's figures by their form, and the new test's count by this file's own
// cases, not by a figure a later change moves, and it does not hold the block
// to be the section's last. Its banned patterns are built from split strings,
// so this file holds none of them, and it is plain ASCII.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
const SELF = 'test/unit/redesign-status-phase0-club-email-switch-on.test.ts'

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, in the plural as well, and the words that name a person's role in the work. */
const BANNED = new RegExp(
  `\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'age' + 'nt', 'work' + 'flow', 'revi' + 'ewer', 'tes' + 'ter', 'age' + 'nt', 'mo' + 'del'].join('|')})s?\\b|${'the ' + 'lead'}`,
  'i',
)
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** A session's link or its id. */
const SESSION = new RegExp(`${'sess' + 'ion_'}[0-9A-Za-z]{6,}|${'/co' + 'de/'}`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}|${'to be ' + 'measured'}|${'X' + 'XX'}|${'@' + '@'}`)
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i
/** The merge-pending phrase. */
const PENDING = new RegExp(`is ${'pen' + 'ding'}`)

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
/** A sub-bullet of a bullet, one line of its own, by the words it starts with. */
const sub = (text: string, start: string) => text.split('\n').find((l) => l.startsWith(`  - ${start}`)) ?? ''
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

const TRIM = '## Phase 0: the public-answer trim'
/** The trim's section, from its heading to the next section's. */
const trim = between(status, `\n${TRIM}\n`, '\n## ')
const BLOCK_HEADING = '### The switch-on: the club email switch turned on'
const FOLLOW_UPS = '### Phase 0 follow-ups'
/** This block, from its heading to the next heading of the section or the section's end, so a later block is never read as its own. */
const block = (() => {
  const at = trim.indexOf(`\n${BLOCK_HEADING}\n`)
  if (at < 0) return ''
  const rest = trim.slice(at + 1)
  const next = rest.indexOf('\n### ', BLOCK_HEADING.length)
  return next < 0 ? rest : rest.slice(0, next + 1)
})()
const opening = block.split('\n')[2] ?? ''

const BULLETS = [
  '- **What it carries.**', '- **What the merge does to production.**', '- **A club with no other way to be reached.**', '- **The roster switch stays off.**',
  '- **What it meets from the clubs work.**', "- **K's part.**", '- **Rollback.**', '- **Files.**', '- **Pins moved.**', '- **What is checked.**', '- Checks:',
]
const [CARRIES, PRODUCTION, NO_OTHER_WAY, ROSTER, CLUBS, K_PART, ROLLBACK, FILES, PINS, CHECKED] = BULLETS.slice(0, 10).map((name) => bullet(block, name))
const CHECKS = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''

/** The code and test files the change itself carries, each named in the first line of What it carries. */
const CARRIED = ['src/lib/features.ts', 'functions/utils/clubs/publicAnswer.ts', 'test/unit/features.test.ts', 'test/a11y/builds.spec.ts', 'test/a11y/scopes-edges.spec.ts']
/** The five files of the clubs work's commit. */
const CLUBS_FIVE = [
  'test/integration/public-answer-columns.test.ts', 'test/integration/club-seed-live.test.ts', 'test/integration/club-columns-stay-off-answers.test.ts',
  'test/unit/sweep-fixes.test.tsx', 'test/unit/redesign-status-ws09-step9.test.ts',
]
/** The test files the Files bullet gives a count of cases beside. */
const COUNTED = ['test/unit/features.test.ts', 'test/unit/redesign-status-phase0-trim.test.ts', SELF, ...CLUBS_FIVE]
/** The people and the parts of the site the merge reaches, each a sub-bullet of its own, in this order. */
const KINDS = [
  'A visitor who is not signed in.', 'The contact form the link opens.', 'A member who keeps no club.', "A club's rep and a regional representative.",
  'An LCA admin, `lca_observer` and `lca_officer`.', 'The people who keep club listings.', 'A tab left open across the deploy.', 'Email.',
  'The daily-emails worker.',
]
const kind = (name: string) => sub(PRODUCTION, name)

describe('REDESIGN_STATUS.md, the club email switch-on: where the block stands and what it opens with', () => {
  it('sits once, inside the trim\'s section right after its follow-ups, its heading word for word, its bullets in order, each once, and its Checks line last', () => {
    expect(status.split(`\n${BLOCK_HEADING}\n`)).toHaveLength(2)
    expect(trim).not.toBe('')
    const at = [FOLLOW_UPS, BLOCK_HEADING].map((h) => trim.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect(at[1]).toBeGreaterThan(at[0])
    // Nothing stands between the trim's follow-ups and this block.
    expect(trim.slice(at[0], at[1]).split('\n').filter((l) => l.startsWith('### '))).toEqual([FOLLOW_UPS])
    expect(block.split('\n').filter((l) => l.startsWith('#'))).toEqual([BLOCK_HEADING])
    const places = BULLETS.map((name) => block.indexOf(`\n${name}`))
    for (const [i, name] of BULLETS.entries()) {
      expect(places[i], name).toBeGreaterThan(-1)
      expect(block.split('\n').filter((l) => l.startsWith(name)), name).toHaveLength(1)
    }
    expect([...places].sort((a, b) => a - b)).toEqual(places)
    expect(block.trimEnd().split('\n').at(-1)!.startsWith('- Checks:')).toBe(true)
  })

  it('opens with what the change is: the follow-up\'s first half, both halves on together, the roster switch off, K\'s word and its day, the base, and the merge K\'s', () => {
    for (const piece of [
      'the first half of the one the follow-up "K looks at a preview with `clubEmailHidden` on, then with `rosterShortNames` on, and turns each on (Phase 0)" sets out',
      '`clubEmailHidden` in `src/lib/features.ts`', '`CLUB_EMAIL_HIDDEN` in `functions/utils/clubs/publicAnswer.ts`, on together', '`rosterShortNames` and `ROSTER_SHORT_NAMES` stay off',
      'decision 68 of `docs/redesign/ws16-k-decisions.md`', 'on Monday, November 16, 2026, from about 8:50 PM to 9:25 PM UTC', '`preview-switches`, cut from `ccf65c3`',
      '"yes all that looks and works great, good job"', 'decision 67, the same day at about 8:40 PM UTC', '"everything else that is done has got my go ahead"',
      'this change carries the club email switch alone', 'by Thursday, November 19, 2026', 'while the roster switch waits for K\'s two answers',
      'made on Monday, November 16, 2026 from `ccf65c3`', 'checkpoint U (pull request 132)', 'on top of `a4206fb`', 'picked from `6c52968`', 'made ready as a draft pull request',
    ]) expect(opening, piece).toContain(piece)
    // The merge is K's: the block speaks of it as waiting for K's word, or, once a later change records it, as having waited.
    expect(/the merge is K's, and (?:waits|waited) for K's word/.test(opening)).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, the club email switch-on: what it carries and what the merge does', () => {
  it('carries the two halves and three tests, the clubs work\'s commit with its five files, the record\'s own lines, and names what it does not carry', () => {
    const first = CARRIES.split('\n')[0]
    for (const file of CARRIED) expect(first, file).toContain(`\`${file}\``)
    for (const piece of ['`clubEmailHidden` true', '`CLUB_EMAIL_HIDDEN` true, its comment as it was', 'the section\'s own comment, the switch\'s one-line comment and the blank lines are as they were', 'taken out of `PHASE_0`', '`SHIPPED_ON`']) {
      expect(first, piece).toContain(piece)
    }
    const commit = sub(CARRIES, 'The clubs work\'s commit `a4206fb`')
    for (const file of CLUBS_FIVE) expect(commit, file).toContain(`\`${file}\``)
    for (const piece of ['picked from `6c52968` on `redesign/ws09-privacy-tests`', 'set it themselves and check both states inside their cases', 'every file\'s count of cases as before']) {
      expect(commit, piece).toContain(piece)
    }
    const own = sub(CARRIES, 'The record\'s own lines:')
    for (const piece of [
      'this section\'s Status and PR lines', 'now give its merge into `main` as `0018039` on Tuesday, November 3, 2026 at 6:34 PM UTC', 'checked with `git log` on `main`',
      'gains a sentence that closes its first half', 'and this block', 'Every other line of the record is as it was.',
    ]) expect(own, piece).toContain(piece)
    const not = sub(CARRIES, 'Not carried:')
    for (const piece of ['`rosterShortNames` and `ROSTER_SHORT_NAMES`', '`src/pages/ClubDetailPage.tsx`', 'the two fixes decision 68 names', 'a migration', 'any file under `workers/`', 'the relay of a club\'s messages', '`CLUB_PAGES_ON`']) {
      expect(not, piece).toContain(piece)
    }
  })

  it('says what the merge does for each kind of person and part of the site, in order, the visitor who is not signed in first', () => {
    expect(PRODUCTION.split('\n')[0]).toContain('Read from the code with `clubEmailHidden` on and `CLUB_EMAIL_HIDDEN` set')
    const places = KINDS.map((name) => PRODUCTION.indexOf(`\n  - ${name}`))
    for (const [i, name] of KINDS.entries()) expect(places[i], name).toBeGreaterThan(-1)
    expect([...places].sort((a, b) => a - b)).toEqual(places)
    const pieces: ReadonlyArray<readonly [string, string[]]> = [
      [KINDS[0], [
        '"Contact this club through LCA", a link to the contact form at `/contact`', 'in the header strip beside the mail icon', 'under Contact in the Visit us card',
        'a club that gave no address shows both links too', 'The address is drawn nowhere', 'GET `/api/clubs/[id]` answers the club\'s row without `contact_email`, the key left out, to everyone',
        'GET `/api/clubs`, the search and the club page\'s link preview never carried it', 'no public page or answer carries a club\'s address',
      ]],
      [KINDS[1], ['It names no club', '"General inquiry"', 'stored as a support ticket in Admin', '`CONTACT_EMAIL`', 'a copy to the sender', 'D29', 'Q14 chose this form for Phase 0']],
      [KINDS[2], ['The same as a visitor.']],
      [KINDS[3], ['`/admin/clubs/:id`', 'GET `/api/admin/clubs/[id]`', 'which this change does not touch', '"a contact email" gap']],
      [KINDS[4], ['The links on the public page, not the address', 'the admin club page']],
    ]
    for (const [name, words] of pieces) for (const piece of words) expect(kind(name), `${name} ${piece}`).toContain(piece)
  })

  it('says what the editor\'s words, a tab left open, email and the daily-emails worker meet from the merge on', () => {
    const pieces: ReadonlyArray<readonly [string, string[]]> = [
      [KINDS[5], ['"Email for messages, never shown"', '"It is never shown on your club\'s page or to visitors."', 'drawn only while `clubKeepers` is on', 'nobody meets them yet', '"Contact email" box']],
      [KINDS[6], ['keeps what it drew', 'still on the old code with the switch off', 'shows no contact line at all until the tab is reloaded', '`test/unit/club-email-hidden-edges.test.tsx`']],
      [KINDS[7], ['No email reads either half, so none changes.']],
      [KINDS[8], ['`deploy-worker.yml` redeploys `lca-daily-emails` on the merge', 'a file under `functions/utils/` changes', 'the worker\'s bundle reaches neither file', '`test/unit/public-answer.test.ts`', '`migrate-db.yml` does not run']],
    ]
    for (const [name, words] of pieces) for (const piece of words) expect(kind(name), `${name} ${piece}`).toContain(piece)
  })

  it('says what a club with no other way to be reached relies on until the relay, and why the roster switch stays off', () => {
    for (const piece of [
      'no public page or answer gives a club\'s address', 'by the general contact form, which names no club', 'LCA\'s inbox reads which club a message is for and passes it on by hand',
      'never giving the sender the club\'s address (D29)', 'until the clubs work\'s relay', 'and replaces the link', 'no read of production was made',
    ]) expect(NO_OTHER_WAY, piece).toContain(piece)
    for (const piece of [
      '`rosterShortNames` and `ROSTER_SHORT_NAMES` stay off', 'K answers the two questions the roster rule leaves', 'the standings before an event\'s first result',
      'the US Chess ID beside a shortened name', 'no answer to either is on record', 'held no tournament', 'a picture of them', 'the roster keeps full names for everyone',
    ]) expect(ROSTER, piece).toContain(piece)
  })

  it('says what it meets from the clubs work and the mail switch-on, and gives K\'s part and the rollback', () => {
    for (const piece of [
      '`switchOrderProblems` in `src/areas/clubs/switches.ts`', 'has this pair first', '`test/unit/club-pages-switch.test.ts`', '`clubKeepers` with `CLUB_KEEPERS_ON`',
      'is the next pair the order allows', 'Pull request 133, the mail switch-on', '`test/a11y/builds.spec.ts`', '`mailLists`', 'whichever of the two merges second',
      'which name no switch', '`[\'clubEmailHidden\', \'mailLists\']`', 'so it merges by itself',
      'Both changes take a case out of `test/unit/features.test.ts`', 'whichever merges second finds one case fewer there than its block gives', '25, 26 before',
    ]) expect(CLUBS, piece).toContain(piece)
    for (const piece of [
      'K looked on Monday, November 16, 2026 (decision 68)', 'nothing to set: no secret, no setting and no migration', 'K\'s word on this pull request', 'opened signed out',
      'shows the two links and no address', 'a link opens the contact form', 'passed on to that club by hand',
    ]) expect(K_PART, piece).toContain(piece)
    for (const piece of [
      '`git revert -m 1` with this change\'s merge commit', 'with `clubEmailHidden` off and `CLUB_EMAIL_HIDDEN` unset', 'carry the address again', '`deploy-worker.yml`',
      'no migration to undo', 'stay in Admin\'s queue',
    ]) expect(ROLLBACK, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, the club email switch-on: files, pins and checks', () => {
  it('names every file it changes and adds, each test file with its count in the record\'s form, the new one with this file\'s own count', () => {
    for (const file of [...CARRIED, ...CLUBS_FIVE, 'REDESIGN_STATUS.md', 'test/unit/redesign-status-phase0-trim.test.ts', SELF]) expect(FILES.split(`\`${file}\``), file).toHaveLength(2)
    const counts = new Map<string, RegExpExecArray>()
    for (const file of COUNTED) {
      const m = new RegExp(`\`${escaped(file)}\` \\((\\d+), (?:(\\d+) before|(as before)|(new))[:)]`).exec(FILES)
      expect(m, file).not.toBeNull()
      expect(Boolean(m![4]), `${file} is new`).toBe(file === SELF)
      counts.set(file, m!)
    }
    // The one case PHASE_0 held for the switch is gone, and no file of the clubs work's commit gained or lost one.
    const features = counts.get('test/unit/features.test.ts')!
    expect(Number(features[2]) - Number(features[1])).toBe(1)
    for (const file of [...CLUBS_FIVE, 'test/unit/redesign-status-phase0-trim.test.ts']) expect(counts.get(file)![3], file).toBe('as before')
    // The new record test's count is this file's own number of cases.
    const own = (readFileSync(join(ROOT, SELF), 'utf8').match(/^\s*it\(/gm) ?? []).length
    expect(Number(counts.get(SELF)![1])).toBe(own)
    expect(FILES).toMatch(/`test\/a11y\/builds\.spec\.ts` \(\d+ tests on both builds, as before[:)]/)
    expect(FILES).toContain('`test/a11y/scopes-edges.spec.ts` (its two tests of a club\'s page, one on each build, as before)')
  })

  it('lists each pin moved under its file, once, with its old words and its new', () => {
    for (const file of ['test/unit/features.test.ts', 'test/a11y/builds.spec.ts', 'test/a11y/scopes-edges.spec.ts', 'test/unit/redesign-status-phase0-trim.test.ts']) {
      expect(PINS.split('\n').filter((l) => l.startsWith(`  - \`${file}\`:`)), file).toHaveLength(1)
    }
    for (const words of [
      '`PHASE_0` held `clubEmailHidden` off, and no longer names it', 'it still holds `rosterShortNames` off', 'is now held as the site ships it, `clubEmailHidden` on',
      'waited for the seeded club\'s address as a link', 'the club\'s own navy blue', 'now end with this block\'s heading', '"not merged yet."',
      '"**PR:** draft pull request 120, not merged into `main` yet."', '"merged into `main` as `0018039` on Tuesday, November 3, 2026 at 6:34 PM UTC."',
      'the first follow-up\'s new last sentence', 'Its count of cases stays 17.', 'No other pin moves',
    ]) expect(PINS, words).toContain(words)
  })

  it('says what is checked, and gives the Checks line in its form: the runs by name, the record\'s readers, eslint, and the gate with its one browser run', () => {
    for (const piece of [
      '`test/unit/public-answer-switches.test.ts` holds the two halves equal', '`test/unit/club-pages-switch.test.ts`', '`test/unit/club-email-hidden-edges.test.tsx`',
      '`test/integration/public-answer-trim-edges.test.ts`', 'the two browser tests read the page as the site ships it, on both builds',
    ]) expect(CHECKED, piece).toContain(piece)
    expect(CHECKS).toMatch(/unit [\d,]+ tests in \d+ files and integration [\d,]+ in \d+ files, every one passing/)
    expect(CHECKS).toMatch(/every unit test file that reads this record, [\d,]+ tests in \d+ files, every one passing/)
    expect(CHECKS).toContain('`npx eslint` on every code and test file it changes found nothing')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', '`npm run test:all`', '`npm run test:a11y`']) {
      expect(CHECKS.split(piece), piece).toHaveLength(2)
    }
    for (const piece of ['`test/a11y/baseline.json` unchanged', 'the two browser tests of a club\'s page']) expect(CHECKS, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, the club email switch-on: plain language', () => {
  it('keeps the dashes, the working words, any tool\'s name, a session\'s link, the old initials, unfilled marks, the merge-pending phrase and a he out of the block', () => {
    expect(block.length).toBeGreaterThan(20)
    for (const rule of [DASHES, BANNED, TOOLS, BARE, SESSION, OLD_INITIALS, UNFILLED, PENDING]) expect(block).not.toMatch(rule)
    expect(proseOf(block)).not.toMatch(HE)
    expect(block).not.toMatch(/\.github\//)
    // A step is named as "WS09 step N", never with the bare form WS01's record tests look for.
    expect(block).not.toMatch(/\(step \d+[;),]/)
    // No table, and the old initials nowhere, US Chess written out where it is named.
    expect(block.split('\n').filter((l) => l.startsWith('|'))).toEqual([])
    expect(block).toContain('US Chess ID')
  })

  it('gives every date the weekday it falls on and every time the twelve-hour clock', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    // The block is there to read, so an empty block cannot pass for one with no date.
    expect(block.length).toBeGreaterThan(20)
    const text = proseOf(block)
    for (const found of text.matchAll(new RegExp(`\\b(?:${MONTHS.join('|')}) \\d{1,2}\\b`, 'g'))) {
      expect(text.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const [whole, weekday, month, day, year] of text.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${MONTHS.join('|')}) (\\d{1,2}), (\\d{4})`, 'g'))) {
      expect(WEEKDAYS[new Date(Date.UTC(Number(year), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
    }
    for (const time of text.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })
})
