// test/unit/redesign-status-ws09-switch-on-keepers.test.ts
//
// REDESIGN_STATUS.md records the switch-on of the clubs staff half,
// clubKeepers in src/lib/features.ts with CLUB_KEEPERS_ON in
// functions/utils/clubs/pages.ts, in the block "WS09 switch-on: clubKeepers
// and CLUB_KEEPERS_ON". Like the other record tests of WS09, this file reads
// only the WS09 section, from its heading to the WS10 heading. Pinned here:
// the block, right after checkpoint V's review and before the four lists
// while it is the section's latest; its parts in order; the two lines as
// they ship, on, and the four other clubs switches off, with the order check
// empty, which this file alone holds (test/unit/features.test.ts no longer
// lists clubKeepers, having no list of switches that ship on); the claims
// against the files and the tests each line of What a person meets names;
// the endpoints' words; the pins moved; the Status and PR lines; the signing
// secret's follow-up; the figures of the Checks line; and the plain-language
// rules over what the block wrote.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FEATURES } from '@/lib/features'
import { switchOrderProblems } from '@/areas/clubs/switches'
import * as pages from '../../functions/utils/clubs/pages'
import * as publicAnswer from '../../functions/utils/clubs/publicAnswer'

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
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const REVIEW = '### WS09 checkpoint V: the review of the whole and its fixes'
const BLOCK = '### WS09 switch-on: clubKeepers and CLUB_KEEPERS_ON'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''
const latest = latestBlock === BLOCK

const FEATURES_FILE = 'src/lib/features.ts'
const PAGES_FILE = 'functions/utils/clubs/pages.ts'
const SELF = 'test/unit/redesign-status-ws09-switch-on-keepers.test.ts'
const SECRET_FOLLOW_UP = '- **K\'s signing secret, owed before clubKeepers goes on (WS09 step 13).** '
/** The record tests whose pins of a shipped line this block moves, each with how many lines it held. */
const LINE_PINS: ReadonlyArray<readonly [string, number]> = [
  ['step6', 1], ['step7', 1], ['step8', 1], ['step9', 2], ['step10', 2], ['step11', 1], ['step12', 1], ['step13', 1], ['step14', 2], ['u-notice', 2], ['u-reload', 1], ['v-asked', 2],
]
const PR_PINS = ['step16', 'step17', 'step18', 'v-asked']
const PAGE_TESTS = ['test/unit/club-confirm-page.test.tsx', 'test/unit/my-region-page.test.tsx', 'test/unit/my-region-club-page.test.tsx']
/** The integration files that now set the constant off themselves, each with its count of cases, which a record test counts. */
const OFF_FILES: ReadonlyArray<readonly [string, number]> = [
  ['test/integration/club-columns-stay-off-answers.test.ts', 7], ['test/integration/club-seed-live.test.ts', 8], ['test/integration/club-roster-kept-back.test.ts', 6],
]
const recordTest = (name: string) => `test/unit/redesign-status-ws09-${name}.test.ts`

/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length

describe('REDESIGN_STATUS.md, WS09 switch-on: the block', () => {
  it('sits once, right after checkpoint V\'s review, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(REVIEW) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
    // The heading's form is the record's own, as WS09 step 1's test allows it.
    expect(read(recordTest('step1'))).toContain('|WS09 switch-on: \\S|')
  })

  it('opens with why now, in two sentences: K\'s words passed on by the mail stream, and K\'s own yes', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'K\'s words, passed on by the mail stream on Monday, November 16, 2026', 'the board should be able to manage and see everything they need for their clubs by Thursday, November 19, 2026',
      'its pull request waits for K\'s own yes',
    ]) expect(opening, piece).toContain(piece)
    expect(opening.split(/\.(?: |$)/).filter(Boolean)).toHaveLength(2)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **What goes on.**', '- **What a person meets.**', '- **What does not go on.**', '- **What a save does, for K to read once more.**', '- **Owed, K\'s own.**',
      '- **What the merge carries.**', '- **How it comes back off.**', '- **The live check.**', '- **Both states.**', '- **Pins moved.**', '- **Files.**', '- **The pictures.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on: what ships', () => {
  it('ships clubKeepers and CLUB_KEEPERS_ON on, as written in their files', () => {
    expect(read(FEATURES_FILE)).toMatch(/^ {2}clubKeepers: true,$/m)
    expect(read(PAGES_FILE)).toMatch(/^export const CLUB_KEEPERS_ON = true$/m)
    expect(FEATURES.clubKeepers).toBe(true)
    expect(pages.CLUB_KEEPERS_ON).toBe(true)
  })

  it('keeps newClubs and CLUB_PAGES_ON off, declares regionEvents and REGION_EVENTS_ON, and the order check finds nothing', () => {
    expect([FEATURES.newClubs, pages.CLUB_PAGES_ON]).toEqual([false, false])
    // regionEvents and REGION_EVENTS_ON went on together in the block "WS09 switch-on: regionEvents and REGION_EVENTS_ON", so this block holds only that each is declared.
    expect(read(FEATURES_FILE)).toMatch(/^ {2}regionEvents: (?:false|true),$/m)
    expect(read(PAGES_FILE)).toMatch(/^export const REGION_EVENTS_ON = (?:false|true)$/m)
    const constants = { CLUB_EMAIL_HIDDEN: publicAnswer.CLUB_EMAIL_HIDDEN, CLUB_PAGES_ON: pages.CLUB_PAGES_ON, CLUB_KEEPERS_ON: pages.CLUB_KEEPERS_ON, REGION_EVENTS_ON: pages.REGION_EVENTS_ON }
    expect(switchOrderProblems(FEATURES, constants)).toEqual([])
  })

  it('gives each line its comment: what it opens and that it is on with its twin, with no date', () => {
    const features = read(FEATURES_FILE)
    const comment = features.split('\n')[features.split('\n').findIndex((l) => /^ {2}clubKeepers: /.test(l)) - 1]
    expect(comment).toBe('  /** The one club editor, Your club\'s page, My region and the monthly check, for the people who keep club listings. On, together with CLUB_KEEPERS_ON. */')
    const server = read(PAGES_FILE)
    const doc = server.slice(server.lastIndexOf('/**', server.indexOf('export const CLUB_KEEPERS_ON')), server.indexOf('export const CLUB_KEEPERS_ON'))
    for (const piece of ['Set: the one club editor, Your club\'s page, My region, Still accurate and', 'On, together with clubKeepers in src/lib/features.ts', 'test/unit/club-pages-switch.test.ts']) expect(doc, piece).toContain(piece)
    for (const text of [comment, doc]) expect(text).not.toMatch(/\b(?:20\d\d|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|meeting)\b/)
  })

  it('names what goes on, what stays off and why, and the order', () => {
    const on = bullet(block, '- **What goes on.**')
    for (const piece of [
      '`clubKeepers: true` in `src/lib/features.ts`', '`export const CLUB_KEEPERS_ON = true` in `functions/utils/clubs/pages.ts`', 'in one change',
      '`regionEvents` and `REGION_EVENTS_ON` stay off', 'the move to Amazon SES', '`newClubs` and `CLUB_PAGES_ON` stay off', 'from the club email switch, a change of its own',
      '`switchOrderProblems` finds nothing', `\`${SELF}\``,
    ]) expect(on, piece).toContain(piece)
    const not = bullet(block, '- **What does not go on.**')
    for (const piece of ['The representatives\' club events', 'the contact form, the directory and the photos', 'WS09 step 15', 'only when an LCA admin presses "Send this month\'s check now"', '"Next monthly check lands"']) {
      expect(not, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on: the parts against the files', () => {
  it('lists what a person meets by who they are, each line naming tests that exist', () => {
    const meets = bullet(block, '- **What a person meets.**')
    const people = meets.split('\n').filter((l) => l.startsWith('  - '))
    expect(people.map((l) => l.slice(4, l.indexOf(':')))).toEqual([
      'A visitor and a plain member with no seat and no club', 'A club\'s rep', 'A holder of a regional seat, whatever their role', 'An LCA admin',
    ])
    for (const line of people) {
      const named = [...line.matchAll(/`(test\/[^`]+)`/g)].map((m) => m[1])
      expect(named.length, line.slice(4, 40)).toBeGreaterThan(0)
      for (const file of named) expect(existsSync(join(ROOT, file)), file).toBe(true)
    }
    expect(people[0]).toContain('nothing new but the address `/clubs/confirm/:token`')
    expect(people[1]).toContain('`/manage/club` lead to Your club\'s page at `/my/club/:slug`')
    expect(people[2]).toContain('Open My region')
    expect(people[3]).toContain('"Send this month\'s check now"')
  })

  it('names the readers the lines open, as the files hold them', () => {
    const app = read('src/App.tsx')
    expect(app).toContain('{FEATURES.clubKeepers && <Route path="/clubs/confirm/:token" element={<ClubConfirmPage />} />}')
    expect(app).toContain('<Route path="/my/club/:slug" element={FEATURES.clubKeepers ? <RoleProtectedRoute keepsAClub><YourClubPage /></RoleProtectedRoute> : <Navigate to="/dashboard" replace />} />')
    expect(app).toContain('<Route path="/workspace/region" element={FEATURES.clubKeepers ? <RoleProtectedRoute requireSeat><MyRegionPage /></RoleProtectedRoute> : <Navigate to="/dashboard" replace />} />')
    expect(read('src/pages/DashboardPage.tsx')).toContain('<Link to="/workspace/region">Open My region</Link>')
    expect(read('src/pages/ManageClubPage.tsx')).toContain('if (keepersOn()) {')
    expect(read('src/pages/WorkspacePage.tsx')).toContain('const editTo = keepersOn() ? `/my/club/${club.slug || club.id}` : `/admin/clubs/${club.id}`')
    for (const file of ['functions/api/admin/clubs/[id].ts', 'functions/api/admin/clubs/[id]/confirm.ts', 'functions/api/admin/clubs/[id]/places.ts', 'functions/api/admin/clubs/monthly-check.ts', 'functions/api/clubs/confirm/[token].ts', 'functions/api/workspace/region.ts', 'functions/utils/clubs/monthlyCheck.ts']) {
      expect(read(file), file).toMatch(/^import \{[^}]*\bCLUB_KEEPERS_ON\b[^}]*\} from '[./a-z]*pages'$/m)
    }
  })

  it('says what a save does, in K\'s decisions\' terms, and that nothing here changes it', () => {
    const save = bullet(block, '- **What a save does, for K to read once more.**')
    for (const piece of [
      'writes today\'s public columns too', '`description`', '`meeting_schedule`', 'K\'s choice 3 (a)', 'the first save of a seeded club puts the listing\'s words on today\'s public page',
      '"Today\'s page shows different words here. Saving puts this listing\'s words on today\'s page."', 'at most once an hour for one club and one saver, by K\'s decision 7',
      'Nothing in this change widens or narrows any of it',
    ]) expect(save, piece).toContain(piece)
    expect(read('functions/utils/clubs/save.ts')).toContain('// The mirror, by K\'s choice 3 (a) on the WS09 plan: a save also writes')
  })

  it('names what is owed as K\'s own, and the refusals without the secret in the handlers\' own words', () => {
    const owed = bullet(block, '- **Owed, K\'s own.**')
    const noKey = /export const CHECK_NO_KEY = '((?:[^'\\]|\\.)*)'/.exec(read('functions/api/admin/clubs/monthly-check.ts'))?.[1].replace(/\\'/g, '\'')
    expect(noKey).toBeTruthy()
    for (const piece of [
      '`SIGNING_SECRET`, set in Cloudflare by K\'s own hands before the merge', 'a different one for Preview', '"K\'s signing secret, owed before clubKeepers goes on (WS09 step 13)."',
      `"Could not ask how many people the check goes to: ${noKey}"`, '"Links from the monthly check can\'t be read on the site right now. Try again later."',
      '"Baton Rouge / East Central Representative" seat\'s region', '100 emails a day', 'Amazon SES', 'Handing out the regional seats and the club rep roles in Admin',
    ]) expect(owed, piece).toContain(piece)
    expect(read('src/areas/clubs/region.ts')).toContain('return `Could not ask how many people the check goes to: ${errorWords(err)}`')
    expect(read('functions/api/clubs/confirm/[token].ts')).toContain('Links from the monthly check can\\\'t be read on the site right now. Try again later.')
  })

  it('gives the live check\'s answers in the handlers\' own words, and K\'s five steps', () => {
    const live = bullet(block, '- **The live check.**')
    const constant = (file: string, name: string) => new RegExp(`export const ${name} = '((?:[^'\\\\]|\\\\.)*)'`).exec(read(file))?.[1].replace(/\\'/g, '\'')
    for (const [file, name] of [
      ['functions/api/workspace/region.ts', 'REGION_CLOSED'], ['functions/api/admin/clubs/[id]/confirm.ts', 'CONFIRM_CLOSED'],
      ['functions/api/admin/clubs/monthly-check.ts', 'CHECK_CLOSED'], ['functions/api/clubs/confirm/[token].ts', 'LINK_CLOSED'],
    ]) {
      const words = constant(file, name)
      expect(words, name).toBeTruthy()
      expect(live, name).toContain(`403 "${words}"`)
    }
    for (const piece of [
      '401 "Unauthorized"', '400 "This link can\'t be read. Check that the whole link was copied from the email."', '`Cache-Control: no-store`', '`Referrer-Policy: no-referrer`',
      '`X-Robots-Tag: noindex`', 'GET `/api/clubs` and a club\'s public page: unchanged', 'in five steps: one,', 'five, give one board member',
    ]) expect(live, piece).toContain(piece)
    expect(read('public/_headers')).toContain('/clubs/confirm/*')
  })

  it('names what the merge carries and how it comes back off', () => {
    const carries = bullet(block, '- **What the merge carries.**')
    for (const piece of [
      'Two product lines and their comments; no migration', '`index-CwclVgsP.js` 558,793 bytes on the base', '`index-B9z7qSj6.css` 134,857 bytes on both', '`features-0jpIA_W-.js` 729 bytes on the base',
      'no chunk is new or gone', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes', '`60caafa9f2090793aea06d2123c38257526bc91ff6fbafc4ace8625120eee47d`', '`deploy-worker.yml`',
    ]) expect(carries, piece).toContain(piece)
    const off = bullet(block, '- **How it comes back off.**')
    for (const piece of ['Both lines back to `false` in one change, or a revert of the merge', 'the words saves put on today\'s public columns', '403, "Still accurate cannot be used yet."', 'Nothing else to undo']) {
      expect(off, piece).toContain(piece)
    }
    const both = bullet(block, '- **Both states.**')
    for (const piece of ['in a throwaway copy of this tree outside the repository', '"ships clubKeepers and CLUB_KEEPERS_ON on, as written in their files"', `\`${SELF}\``, 'every one passing but the one todo, nothing failing']) {
      expect(both, piece).toContain(piece)
    }
    expect(read(SELF)).toContain('  it(\'ships clubKeepers and CLUB_KEEPERS_ON on, as written in their files\', () => {')
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on: the pins', () => {
  it('moves each pin of a shipped line to a match of the declared line with either value', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const [name, count] of LINE_PINS) {
      const text = read(recordTest(name))
      expect(pins, name).toContain(`\`${recordTest(name)}\``)
      const matched = (text.match(/toMatch\(\/\^ \{2\}clubKeepers: \(\?:false\|true\),\$\/m\)|toMatch\(\/\^export const CLUB_KEEPERS_ON = \(\?:false\|true\)\$\/m\)/g) ?? []).length
      expect(matched, name).toBe(count)
      expect((text.match(/went on (?:together )?in the block "WS09 switch-on: clubKeepers and CLUB_KEEPERS_ON"/g) ?? []).length, name).toBeGreaterThan(0)
    }
    for (const name of PR_PINS) {
      expect(pins, name).toContain(`\`${recordTest(name)}\``)
      expect(read(recordTest(name)), name).toContain('    if (latest) expect(prLine.match(/pull request \\d+/g)).toEqual([\'pull request 130\', \'pull request 131\', \'pull request 132\'])')
    }
    for (const file of PAGE_TESTS) {
      expect(pins, file).toContain(`\`${file}\``)
      expect(read(file), file).toContain('expect(read(\'src/lib/features.ts\')).toMatch(/^ {2}clubKeepers: (?:false|true),$/m)')
    }
  })

  it('leaves this file the only test under test/ that pins either shipped line as text', () => {
    const pinned = /' {2}clubKeepers: (?:true|false),'|'export const CLUB_KEEPERS_ON = (?:true|false)'|clubKeepers: (?:true|false),\$\/m|CLUB_KEEPERS_ON = (?:true|false)\$\/m/
    const files = (readdirSync(join(ROOT, 'test'), { recursive: true }) as string[])
      .map((f) => `test/${f.split('\\').join('/')}`)
      .filter((f) => /\.(?:ts|tsx|mts)$/.test(f) && f !== SELF)
    expect(files.length).toBeGreaterThan(100)
    expect(files.filter((f) => pinned.test(read(f)))).toEqual([])
  })

  it('takes clubKeepers out of the WS09 list held off in test/unit/features.test.ts, as its header says', () => {
    const features = read('test/unit/features.test.ts')
    // regionEvents left the list in the block "WS09 switch-on: regionEvents and REGION_EVENTS_ON", so this holds only that clubKeepers is not in it.
    expect(features).toMatch(/^const WS09 = \['newClubs'(?:, 'regionEvents')?\] as const$/m)
    expect(features).toContain('// clubKeepers has been turned on that way, with CLUB_KEEPERS_ON.')
    expect(bullet(block, '- **Pins moved.**')).toContain('the file\'s cases go from 26 to 25')
  })

  it('sets the constant off itself in the three integration files, keeping their counts of cases', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const [file, count] of OFF_FILES) {
      const text = read(file)
      expect(pins, file).toContain(`\`${file}\` (${count})`)
      expect(casesIn(file), file).toBe(count)
      expect(text, file).toContain('vi.mock(\'../../functions/utils/clubs/pages\', async (importOriginal) => {')
      expect(text, file).toMatch(/get CLUB_KEEPERS_ON\(\) \{\n\s+return \w+\.keepersOn\n/)
      expect(text, file).toMatch(/vi\.hoisted\(\(\) => \(\{ keepersOn: false \}\)\)/)
    }
  })

  it('adds the one name to the browser builds\' list of switches that ship on', () => {
    expect(read('test/a11y/builds.spec.ts')).toMatch(/^const SHIPPED_ON = \[[^\]]*'clubKeepers'[^\]]*\]$/m)
    expect(bullet(block, '- **Pins moved.**')).toContain('`test/a11y/builds.spec.ts`, the mail stream\'s file, by its agreement')
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on: the Status and PR lines, and the follow-up', () => {
  it('gives the Status line its tail while this block is the latest', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'waits in draft pull request 134 for K\'s word for its merge', 'the switch-on of `clubKeepers` and `CLUB_KEEPERS_ON` is built on a branch of its own',
        'once checkpoint V and the club email switch are on `main`', 'checkpoint W is under way on `redesign/ws09-clubs-w`', 'WS09 step 15 follows as its own pull request',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(statusLine).not.toMatch(/switch-on[^;]*\bmerged\b/)
  })

  it('gives the PR line checkpoint V\'s draft pull request and no merge that has not happened', () => {
    if (latest) {
      expect(prLine.endsWith('; checkpoint V, its first step and steps 16 to 19, is built and reviewed on `redesign/ws09-clubs-v` and waits in draft pull request 134 for K\'s word for its merge, after the mail stream\'s switch-on, pull request 133; the switch-on of `clubKeepers` and `CLUB_KEEPERS_ON` is built on a branch of its own and is put to K as its own pull request once checkpoint V and the club email switch are on `main`; checkpoint W is under way on `redesign/ws09-clubs-w`, and WS09 step 15 follows as a pull request of its own.')).toBe(true)
      expect(prLine.match(/pull request \d+/g)).toEqual(['pull request 130', 'pull request 131', 'pull request 132', 'pull request 134', 'pull request 133'])
    }
    expect(prLine).not.toMatch(/pull request 13[34][^;]*\bmerged\b/)
  })

  it('keeps the signing secret\'s follow-up open, with one sentence marked for the switch-on', () => {
    const entry = followUps.split('\n').find((l) => l.startsWith(SECRET_FOLLOW_UP)) ?? ''
    expect(entry).not.toBe('')
    expect(entry.split('Changed at the switch-on: ')).toHaveLength(2)
    expect(entry).toContain('Changed at the switch-on: the switch-on\'s pull request names setting `SIGNING_SECRET` as K\'s step before its merge')
    expect(entry).not.toMatch(/\bClosed\b/)
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on: the Checks line', () => {
  it('gives each figure once, with one browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`')
    expect(checksLine).toContain('995, 659 and 336 on the base')
    expect(checksLine).toContain('the base\'s figures from the gate on `8105849`\'s tree')
  })

  it('gives unit and integration counts that add up, and the lint files as the base\'s with the new file added', () => {
    const files = bullet(block, '- **Files.**')
    const written = Number(new RegExp(`\`${escape(SELF)}\` \\((\\d+): `).exec(files)?.[1])
    expect(written).toBe(casesIn(SELF))
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([10545, 448])
    // The new file's cases, less the one case test/unit/features.test.ts no longer runs for clubKeepers.
    expect(num(before) + written - 1).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(1)
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing but the one todo/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    // No integration case is added or removed: the three files mended keep their counts.
    expect(num(integration![1]) - num(integration![3])).toBe(0)
    expect(Number(integration![2]) - Number(integration![4])).toBe(0)
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1170)
    expect(num(lint![1]) - num(lint![2])).toBe(1)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[2]).toBe('210')
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on: plain language', () => {
  const entry = followUps.split('\n').find((l) => l.startsWith(SECRET_FOLLOW_UP)) ?? ''
  const written = [block, entry.slice(entry.indexOf('Changed at the switch-on: ')), statusLine, prLine].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the block wrote, and dates and times in their plain form', () => {
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

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of this file and the two lines\' comments', () => {
    const features = read(FEATURES_FILE).split('\n')
    const server = read(PAGES_FILE)
    const comments = [features[features.findIndex((l) => /^ {2}clubKeepers: /.test(l)) - 1], server.slice(server.lastIndexOf('/**', server.indexOf('export const CLUB_KEEPERS_ON')), server.indexOf('export const CLUB_KEEPERS_ON'))]
    for (const text of [read(SELF), ...comments]) {
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text).not.toMatch(rule)
    }
  })
})
