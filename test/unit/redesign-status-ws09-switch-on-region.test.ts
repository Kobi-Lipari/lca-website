// test/unit/redesign-status-ws09-switch-on-region.test.ts
//
// REDESIGN_STATUS.md records the switch-on of the representatives' club
// events, regionEvents in src/lib/features.ts with REGION_EVENTS_ON in
// functions/utils/clubs/pages.ts, in the block "WS09 switch-on: regionEvents
// and REGION_EVENTS_ON". Like the other record tests of WS09, this file
// reads only the WS09 section, from its heading to the WS10 heading. Pinned
// here: the block, right after the two wordings K chose and before the four
// lists while it is the section's latest; its parts in order; the two lines
// as they ship, on, and the order check empty, which this file alone holds
// beside the list of test/unit/features.test.ts; every reader of the two
// lines; the claims against the files and the tests each line of What a
// person meets names; what a representative may do and what mail it can
// cause, in the handlers' own words; the endpoints' words; the pins moved;
// the Status and PR lines; the figures of the Checks line; and the
// plain-language rules over what the block wrote. No case reads the shipped
// value of another switch: clubKeepers, newClubs and their constants reach
// this file only through the order check.
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[A-Z]+_(?:CASES|LINE|COUNT|TEXT|AFTER|FILES|TESTS|MORE|PENDING)\\b|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
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
/** A string constant of a file, as written there, its escaped quotes read back. */
const constant = (file: string, name: string) => new RegExp(`export const ${name} = '((?:[^'\\\\]|\\\\.)*)'`).exec(read(file))?.[1].replace(/\\'/g, '\'')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const WORDS = '### WS09 switch-on: the two wordings K chose'
const BLOCK = '### WS09 switch-on: regionEvents and REGION_EVENTS_ON'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === BLOCK

const FEATURES_FILE = 'src/lib/features.ts'
const PAGES_FILE = 'functions/utils/clubs/pages.ts'
const APPROVAL = 'functions/api/admin/tournaments/[id]/approval.ts'
const ANNOUNCE = 'functions/api/admin/tournaments/[id]/announce.ts'
const REGISTRATION = 'functions/api/registrations/[id].ts'
const SELF = 'test/unit/redesign-status-ws09-switch-on-region.test.ts'
/** The one case this file holds the shipped lines in, which fails with the two lines back at false. */
const SHIPS = 'ships regionEvents and REGION_EVENTS_ON on, as written in their files'

/** The site's readers of the switch, through regionEventsOn(), and the server's readers of the constant. */
const SITE_READERS = [
  'src/areas/clubs/components/RegionClubCard.tsx', 'src/areas/clubs/components/ThisMonthBar.tsx', 'src/components/auth/RoleProtectedRoute.tsx',
  'src/pages/AdminClubPage.tsx', 'src/pages/MyRegionClubPage.tsx', 'src/pages/TournamentManagePage.tsx',
]
const SERVER_READERS = [
  'functions/api/admin/clubs/[id].ts', 'functions/api/admin/tournaments/[id]/approval.ts', 'functions/api/admin/tournaments/[id]/directors.ts',
  'functions/api/admin/tournaments/[id]/manage.ts', 'functions/api/workspace/region.ts', 'functions/utils/admin/permissions.ts', 'functions/utils/events/creation.ts',
]
/** The record tests whose pins of the two shipped lines this block moves, each with its count of cases. */
const LINE_PINS: ReadonlyArray<readonly [string, number]> = [['step16', 25], ['step17', 25], ['step18', 26], ['step19', 21], ['v-review', 25]]
/** The integration files that now set the constant off themselves, each with its count of cases. */
const OFF_FILES: ReadonlyArray<readonly [string, number]> = [
  ['test/integration/club-by-slug-edges.test.ts', 9], ['test/integration/club-permissions.test.ts', 43], ['test/integration/club-roster-kept-back-keepers.test.ts', 3],
  ['test/integration/club-roster-kept-back.test.ts', 6], ['test/integration/club-save.test.ts', 18], ['test/integration/workspace-region-edges.test.ts', 13],
  ['test/integration/contracts/admin-clubs.test.ts', 12], ['test/integration/contracts/workspace-region.test.ts', 4], ['test/integration/club-roster-kept-back-edges.test.ts', 11],
]
/** The unit files that now set the constant off themselves on the server side. */
const UNIT_OFF = ['test/unit/creation-rules.test.ts', 'test/unit/public-answer-rules.test.ts', 'test/unit/published-review-notice.test.ts']
const recordTest = (name: string) => `test/unit/redesign-status-ws09-${name}.test.ts`

/** A test file's cases as vitest counts them when each is a plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
/** The new integration file of this block, what each person meets in one place. */
const BY_PERSON = 'test/integration/region-events-by-person.test.ts'
/** A test file's cases as vitest counts them, a plain `it(` once and an `it.each` once for each row of its table. */
const casesWithTables = (file: string) => {
  const rows = [...read(file).matchAll(/^\s*it\.each\(\[([\s\S]*?)\] as const\)\(/gm)].map(([, table]) =>
    table.includes('\n') ? (table.match(/^\s*\[/gm) ?? []).length : (table.match(/'[^']*'/g) ?? []).length)
  return casesIn(file) + rows.reduce((sum, n) => sum + n, 0)
}
/** The source with its comments taken out, so a reader is found by its code alone. */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
function filesUnder(dir: string): string[] {
  return (readdirSync(join(ROOT, dir), { recursive: true }) as string[]).map((f) => `${dir}/${f.split('\\').join('/')}`).filter((f) => /\.(?:ts|tsx|mts)$/.test(f))
}

describe('REDESIGN_STATUS.md, WS09 switch-on of regionEvents: the block', () => {
  it('sits once, right after the two wordings K chose, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(WORDS) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
    expect(read(recordTest('step1'))).toContain('|WS09 switch-on: \\S|')
  })

  it('opens with why now, in two sentences: K\'s decisions 10 and 11, and K\'s own yes only if the clubs switch-on went cleanly', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'K\'s decisions 10 and 11 of Tuesday, November 17, 2026', 'sooner than the site\'s move to Amazon SES', 'the morning of Thursday, November 19, 2026',
      'its pull request waits for K\'s own yes, given only if the clubs switch-on went cleanly',
    ]) expect(opening, piece).toContain(piece)
    expect(opening.split(/\.(?: |$)/).filter(Boolean)).toHaveLength(2)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **What goes on.**', '- **What a person meets.**', '- **What a representative can and cannot do, for K to read once more.**', '- **What mail it can cause, for K to read once more.**',
      '- **What does not go on.**', '- **Owed, K\'s own.**', '- **What the merge carries.**', '- **How it comes back off.**', '- **The live check.**', '- **Both states.**',
      '- **Pins moved.**', '- **Files.**', '- **The pictures.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of regionEvents: what ships', () => {
  it(SHIPS, () => {
    expect(read(FEATURES_FILE)).toMatch(/^ {2}regionEvents: true,$/m)
    expect(read(PAGES_FILE)).toMatch(/^export const REGION_EVENTS_ON = true$/m)
    expect(FEATURES.regionEvents).toBe(true)
    expect(pages.REGION_EVENTS_ON).toBe(true)
  })

  it('finds nothing in the order check, so clubKeepers and CLUB_KEEPERS_ON are on before them', () => {
    // The order check is asked, not the other switches' lines: with regionEvents on it is empty only with clubKeepers on.
    const constants = { CLUB_EMAIL_HIDDEN: publicAnswer.CLUB_EMAIL_HIDDEN, CLUB_PAGES_ON: pages.CLUB_PAGES_ON, CLUB_KEEPERS_ON: pages.CLUB_KEEPERS_ON, REGION_EVENTS_ON: pages.REGION_EVENTS_ON }
    expect(switchOrderProblems(FEATURES, constants)).toEqual([])
    expect(switchOrderProblems({ ...FEATURES, regionEvents: true, clubKeepers: false }, constants)).toContain('regionEvents is on while clubKeepers is off: the representatives\' club events live on My region, which comes with clubKeepers.')
  })

  it('gives each line its comment: what it opens and that it is on with its twin, with no date', () => {
    const features = read(FEATURES_FILE).split('\n')
    const comment = features[features.findIndex((l) => /^ {2}regionEvents: /.test(l)) - 1]
    expect(comment).toBe('  /** Regional representatives create and run their clubs\' events, which wait for an LCA admin\'s approval before they list. On, together with REGION_EVENTS_ON. */')
    const server = read(PAGES_FILE)
    const doc = server.slice(server.lastIndexOf('/**', server.indexOf('export const REGION_EVENTS_ON')), server.indexOf('export const REGION_EVENTS_ON'))
    for (const piece of ['Set: a regional representative creates, names the director of and runs the', 'On, together with regionEvents in', 'test/unit/club-pages-switch.test.ts']) expect(doc, piece).toContain(piece)
    for (const text of [comment, doc]) expect(text).not.toMatch(/\b(?:20\d\d|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|meeting)\b/)
  })

  it('names what goes on, what stays off and why, the order, and every reader of the two lines as the tree holds them', () => {
    const on = bullet(block, '- **What goes on.**')
    for (const piece of [
      '`regionEvents: true` in `src/lib/features.ts`', '`export const REGION_EVENTS_ON = true` in `functions/utils/clubs/pages.ts`', 'in one change',
      'WS09 steps 16 to 19 and checkpoint V\'s review of the whole', '"WS09 switch-on: clubKeepers and CLUB_KEEPERS_ON"', '`newClubs` and `CLUB_PAGES_ON` stay off',
      '`switchOrderProblems` over the switches and the server\'s constants is empty', `\`${SELF}\``, 'The daily-emails worker reads neither',
    ]) expect(on, piece).toContain(piece)
    const site = filesUnder('src').filter((f) => /\bregionEventsOn\(\)/.test(code(read(f)))).sort()
    expect(site).toEqual(SITE_READERS)
    const server = filesUnder('functions').filter((f) => f !== PAGES_FILE && /\bREGION_EVENTS_ON\b/.test(code(read(f)))).sort()
    expect(server).toEqual(SERVER_READERS)
    for (const file of [...SITE_READERS, ...SERVER_READERS]) expect(on, file).toContain(`\`${file}\``)
    // No file of the site reads the switch but through regionEventsOn(), and no worker reads the constant.
    expect(filesUnder('src').filter((f) => /FEATURES\.regionEvents\b/.test(code(read(f))))).toEqual([])
    expect(filesUnder('workers').filter((f) => /REGION_EVENTS_ON|clubs\/pages/.test(read(f)))).toEqual([])
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of regionEvents: the parts against the files', () => {
  it('lists what a person meets by who they are, each line naming tests that exist, and what does not change', () => {
    const meets = bullet(block, '- **What a person meets.**')
    const people = meets.split('\n').filter((l) => l.startsWith('  - '))
    expect(people.map((l) => l.slice(4, l.indexOf(':')))).toEqual([
      'A visitor', 'A member with no seat and no club', 'An entrant of a club event', 'A club\'s rep', 'A director a representative named',
      'A holder of a regional seat, whatever their role', 'An LCA admin',
    ])
    for (const line of people) {
      const named = [...line.matchAll(/`(test\/[^`]+)`/g)].map((m) => m[1])
      expect(named.length, line.slice(4, 40)).toBeGreaterThan(0)
      for (const file of named) expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect(named, line.slice(4, 40)).toContain(BY_PERSON)
      expect(line, line.slice(4, 40)).toMatch(/as before|Nothing else changes|What does not change|nothing new/i)
    }
    expect(people[0]).toContain(`403 "${constant(APPROVAL, 'APPROVAL_CLOSED')}"`)
    expect(people[2]).toContain('never an email address')
    expect(people[3]).toContain('K\'s choice 2 (b)')
    expect(people[4]).toContain('"No page names a director for a representative (WS09 checkpoint V)."')
    expect(people[5]).toContain('"Add a club event"')
    expect(people[6]).toContain('"Approve and publish" and "Ask for changes"')
    // The console's roster carries no email: the manage answer's roster reads none.
    const manage = read('functions/api/admin/tournaments/[id]/manage.ts')
    const roster = between(manage, 'SELECT r.id as registration_id', 'ORDER BY m.full_name ASC')
    expect(roster).not.toBe('')
    expect(roster).not.toMatch(/\bemail\b/)
  })

  it('gives what a representative may and may not do in K\'s choices and the handlers\' own words', () => {
    const can = bullet(block, '- **What a representative can and cannot do, for K to read once more.**')
    const registration = read(REGISTRATION)
    for (const words of ['Only an LCA admin can record refunds', 'This entry was paid by card. Ask an LCA admin to change it.']) {
      expect(registration, words).toContain(`'${words}'`)
      expect(can, words).toContain(`("${words}")`)
    }
    const fees = constant('domain/events/creation.ts', 'FEES_NEED_PAYOUT_ACCOUNT')
    expect(fees).toBeTruthy()
    expect(can).toContain(`("${fees}")`)
    expect(read(APPROVAL)).toContain('export const SUBMITS_A_DAY = 5\n')
    for (const piece of [
      'K\'s choice 2 (b) in K\'s decision 10', 'a club rep\'s own included', 'supervise and correct', 'by K\'s choice 3', 'K\'s choice 4',
      '"You have sent 5 events for LCA review in the last day. Try again tomorrow."', 'Nothing in this change widens or narrows any of it',
    ]) expect(can, piece).toContain(piece)
  })

  it('says what mail it can cause as the handlers send it, and the rule of thumb', () => {
    const mail = bullet(block, '- **What mail it can cause, for K to read once more.**')
    for (const piece of [
      'one email to each LCA admin with an address on file', '400 ms apart', 'one email to the person who drafted the event', 'with the LCA admin\'s note',
      '`trySendEmail` in `functions/utils/email.ts`', 'five times the number of LCA admins a day', '`POST /api/admin/tournaments/[id]/announce`',
      'not withdrawn, not on the waitlist and not a walk-in', 'Nothing meters it', 'about 40 people at once', '100 emails a day', 'Nothing in this change widens it',
    ]) expect(mail, piece).toContain(piece)
    const approval = read(APPROVAL)
    expect(approval).toContain('const SEND_INTERVAL_MS = 400\n')
    expect(approval).toContain('import { trySendEmail } from \'../../../../utils/email\'')
    const announce = code(read(ANNOUNCE))
    for (const piece of ['r.withdrawn_at IS NULL', 'r.waitlisted_at IS NULL', '@walkin.lca.invalid']) expect(announce, piece).toContain(piece)
    // Nothing in the announce path counts or caps what it sends.
    expect(announce).not.toMatch(/\bLIMIT\b|SUBMITS_A_DAY|budget|\.slice\(0,/)
  })

  it('names what stays off, what is owed as K\'s own, and who answers a submitted event', () => {
    const not = bullet(block, '- **What does not go on.**')
    for (const piece of ['behind `newClubs` and `CLUB_PAGES_ON`', 'WS09 step 15', 'no page that names a director for a representative']) expect(not, piece).toContain(piece)
    const owed = bullet(block, '- **Owed, K\'s own.**')
    for (const piece of [
      'K\'s word on this pull request, given only if the clubs switch-on went cleanly', 'K\'s decision 11 of Tuesday, November 17, 2026',
      'Telling the board who answers an event a representative submits: the LCA admins', 'if no LCA admin answers, the event never lists', 'The move to Amazon SES',
    ]) expect(owed, piece).toContain(piece)
  })

  it('names what the merge carries and how it comes back off, as the files hold it', () => {
    const carries = bullet(block, '- **What the merge carries.**')
    for (const piece of [
      'Two product lines and their comments; no migration', '`index-D5jXQwel.js` 558,793 bytes on the base', '`index-B9z7qSj6.css` 134,857 bytes on both',
      '`features-iax1oMxJ.js` 729 bytes on the base', 'no chunk is new or gone', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
      '`60caafa9f2090793aea06d2123c38257526bc91ff6fbafc4ace8625120eee47d`', '`deploy-worker.yml`',
    ]) expect(carries, piece).toContain(piece)
    const off = bullet(block, '- **How it comes back off.**')
    for (const piece of [
      'Both lines back to `false` in one change, or a revert of the merge', '`regionEvents` goes off before `clubKeepers` or with it, never after',
      '`needs_lca_approval` 1', `403, "${constant(APPROVAL, 'APPROVAL_CLOSED')}"`, '`WAITING_FOR_APPROVAL`, 409', 'Nothing else to undo',
    ]) expect(off, piece).toContain(piece)
    // The ordinary save reads the mark, not the switch, so a waiting event stays hidden with the switch off.
    expect(read('functions/api/admin/tournaments/[id].ts')).toContain('if (body.isVisible && !mayList({ needs_lca_approval: existing.needsLcaApproval, approved_at: existing.approvedAt })) {\n    return errorResponse(WAITING_FOR_APPROVAL, 409)')
    expect(read('domain/events/approval.ts')).not.toMatch(/REGION_EVENTS_ON|regionEvents/)
  })

  it('gives the live check\'s answers in the handlers\' own words, and K\'s five steps', () => {
    const live = bullet(block, '- **The live check.**')
    expect(read(APPROVAL)).toContain('  if (!REGION_EVENTS_ON) return errorResponse(APPROVAL_CLOSED, 403)\n\n  const authed = await requireAuthedMember(context.request, context.env)')
    expect(read('functions/utils/auth.ts')).toContain('return errorResponse(\'Unauthorized\', 401)')
    for (const piece of [
      `off, 403 "${constant(APPROVAL, 'APPROVAL_CLOSED')}"; on, 401 "Unauthorized"`, '401 "Unauthorized" either way', 'GET `/api/tournaments`',
      'no hidden draft is in any answer to a visitor', 'in five steps: one,', 'five, press one',
    ]) expect(live, piece).toContain(piece)
  })

  it('names the one case that fails with the two lines back at false, in this file', () => {
    const both = bullet(block, '- **Both states.**')
    for (const piece of ['in a throwaway copy of this tree outside the repository', `"${SHIPS}"`, `\`${SELF}\``, 'every one passing but the one todo', `\`${BY_PERSON}\` among them`]) expect(both, piece).toContain(piece)
    expect(read(SELF)).toContain('  it(SHIPS, () => {')
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of regionEvents: the pins', () => {
  it('moves each record pin of a shipped line to a match of the declared line with either value', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const [name, count] of LINE_PINS) {
      const text = read(recordTest(name))
      expect(pins, name).toContain(`\`${recordTest(name)}\` (${count})`)
      expect(casesIn(recordTest(name)), name).toBe(count)
      expect(text, name).toContain('expect(read(\'functions/utils/clubs/pages.ts\')).toMatch(/^export const REGION_EVENTS_ON = (?:false|true)$/m)')
      expect(text, name).toContain('expect(read(\'src/lib/features.ts\')).toMatch(/^ {2}regionEvents: (?:false|true),$/m)')
      expect(text, name).toContain('// regionEvents and REGION_EVENTS_ON went on together in the block "WS09 switch-on: regionEvents and REGION_EVENTS_ON", so this step holds only that each is declared.')
    }
    const keepers = read(recordTest('switch-on-keepers'))
    expect(keepers).toContain('expect([FEATURES.newClubs, pages.CLUB_PAGES_ON]).toEqual([false, false])')
    expect(keepers).toContain('expect(read(PAGES_FILE)).toMatch(/^export const REGION_EVENTS_ON = (?:false|true)$/m)')
    expect(keepers).toContain('expect(features).toMatch(/^const WS09 = \\[\'newClubs\'(?:, \'regionEvents\')?\\] as const$/m)')
    expect(keepers).not.toMatch(/FEATURES\.regionEvents\b/)
    expect(read(recordTest('step2'))).toContain('between(text, \'  // Redesign, clubs.\', \'regionEvents: \')')
    expect(pins).toContain('the file\'s cases go from 25 to 24')
    // The two line pins of test/integration/club-permissions.test.ts, five lines lower.
    for (const name of ['step6', 'step9']) {
      expect(pins, name).toContain(`\`${recordTest(name)}\` (${casesIn(recordTest(name))})`)
      expect(read(recordTest(name)), name).toContain('split(\'\\n\')[403]).toContain(\'body.tournaments\')')
    }
    expect(read('test/integration/club-permissions.test.ts').split('\n')[403]).toContain('body.tournaments')
  })

  it('leaves this file the only test under test/ that pins either shipped line as text, beside the list in test/unit/features.test.ts', () => {
    const pinned = /' {2}regionEvents: (?:true|false),'|'export const REGION_EVENTS_ON = (?:true|false)'|regionEvents: (?:true|false),\$\/m|REGION_EVENTS_ON = (?:true|false)\$\/m|'regionEvents: (?:true|false),'/
    const files = filesUnder('test').filter((f) => f !== SELF)
    expect(files.length).toBeGreaterThan(100)
    expect(files.filter((f) => pinned.test(read(f)))).toEqual([])
    // No other test reads the shipped values either: every other reader sets them through a mock.
    const reads = /\bFEATURES\.regionEvents\)\.toBe\(|\bREGION_EVENTS_ON\)\.toBe\(true\)/
    expect(files.filter((f) => reads.test(read(f)))).toEqual([])
    const features = read('test/unit/features.test.ts')
    expect(features).toContain('const WS09 = [\'newClubs\'] as const')
    expect(features).toContain('// regionEvents has been turned on that way too, with REGION_EVENTS_ON.')
  })

  it('sets the constant off itself in each file whose cases meant it off, keeping their counts of cases', () => {
    const pins = bullet(block, '- **Pins moved.**')
    const getter = /get REGION_EVENTS_ON\(\) \{\n\s+return false\n\s+\}/
    for (const [file, count] of OFF_FILES) {
      const text = read(file)
      expect(pins, file).toContain(`\`${file}\` (${count})`)
      expect(casesIn(file), file).toBe(count)
      expect(text, file).toMatch(getter)
      expect(text.match(/vi\.mock\('(?:\.\.\/)+functions\/utils\/clubs\/pages'/g), file).toHaveLength(1)
    }
    expect(read('test/integration/directors-edges.test.ts')).toMatch(getter)
    for (const file of UNIT_OFF) {
      expect(pins, file).toContain(`\`${file}\``)
      expect(read(file), file).toMatch(getter)
    }
    expect(read('test/unit/admin-club-page-roster.test.tsx')).toContain('    flags.regionEvents = false\n')
    expect(read('test/unit/tournament-manage-membership-switch.test.tsx')).toContain('const flags = vi.hoisted(() => ({ membershipRequirementSwitch: true, regionEvents: false }))')
  })

  it('moves the media manager\'s sweep to the on state with the off state beside it, and waits for the focus in the timing case', () => {
    const pins = bullet(block, '- **Pins moved.**')
    const sweep = read('test/integration/media-manager-reach.test.ts')
    expect(casesIn('test/integration/media-manager-reach.test.ts')).toBe(4)
    expect(sweep).toContain('with nothing written and nothing sent, with REGION_EVENTS_ON set as it ships and unset\', async () => {')
    expect(sweep).toContain('    expect(await sweep()).toEqual([\'POST tournaments/[id]/approval.ts: 400\'])\n')
    expect(sweep).toContain('    region.on = false\n    expect(await sweep()).toEqual([])\n')
    expect(pins).toContain('`test/integration/media-manager-reach.test.ts` (4)')
    const timing = read('test/unit/region-events-pages.test.tsx')
    expect(casesIn('test/unit/region-events-pages.test.tsx')).toBe(27)
    expect(between(timing, 'each move redraws the page from the answer', '\n  })\n').match(/await waitFor\(\(\) => expect\(document\.activeElement\)/g)).toHaveLength(2)
    expect(pins).toContain('`test/unit/region-events-pages.test.tsx` (27)')
    // The officers' emails, held off by club-permissions.test.ts, are held as it ships here.
    const answers = 'test/integration/region-events-answers.test.ts'
    expect(casesIn(answers)).toBe(10)
    expect(read(answers)).toContain('expect((body.officers as Array<Record<string, unknown>>).map((o) => [o.member_id, \'email\' in o])).toEqual([[p.ownRep, false]])')
    expect(pins).toContain(`\`${answers}\` (10)`)
    expect(pins).toContain('"The approval endpoint reads its body before it judges the person (WS09 switch-on of regionEvents)."')
  })

  it('adds the one name to the browser builds\' list of switches that ship on', () => {
    expect(read('test/a11y/builds.spec.ts')).toMatch(/^const SHIPPED_ON = \['clubEmailHidden', 'clubKeepers', 'regionEvents'\]$/m)
    expect(bullet(block, '- **Pins moved.**')).toContain('the one name `regionEvents` added to `SHIPPED_ON`')
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of regionEvents: the Status and PR lines', () => {
  it('gives the Status line the switch-on while this block is the latest, with no merge that has not happened', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'the switch-on of `regionEvents` and `REGION_EVENTS_ON` is built after them on the same branch, by K\'s decisions 10 and 11',
        'once the clubs switch-on is on `main` and went cleanly', 'WS09 step 15 follows as its own pull request',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(statusLine).not.toMatch(/switch-on[^;]*\bmerged\b/)
  })

  it('gives the PR line the switch-on\'s own pull request to come, and no merge that has not happened', () => {
    if (latest) expect(prLine).toContain('; the switch-on of `regionEvents` and `REGION_EVENTS_ON` is built after it and is put to K as its own pull request once the clubs switch-on is on `main`, live only on K\'s word there; ')
    expect(prLine).not.toMatch(/switch-on[^;]*\bmerged\b/)
    expect(prLine).not.toMatch(/pull request 13[34][^;]*\bmerged\b/)
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of regionEvents: the Checks line', () => {
  it('gives each figure once, with one browser run and the baseline unchanged', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`')
    expect(checksLine).toContain('995, 659 and 336 on the base')
    expect(checksLine).toContain('the base\'s figures from the gate on `71cc235`\'s tree')
  })

  it('gives unit and integration counts that add up, and the lint files as the base\'s with the two new files added', () => {
    const files = bullet(block, '- **Files.**')
    const written = Number(new RegExp(`\`${escape(SELF)}\` \\((\\d+): `).exec(files)?.[1])
    expect(written).toBe(casesIn(SELF))
    const byPerson = Number(new RegExp(`\`${escape(BY_PERSON)}\` \\((\\d+): `).exec(files)?.[1])
    expect(byPerson).toBe(casesWithTables(BY_PERSON))
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([10580, 450])
    // The new file's cases, less the one case test/unit/features.test.ts no longer runs for regionEvents.
    expect(num(before) + written - 1).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(1)
    const integration = /integration ([\d,]+) tests that run in (\d+) files, with the one todo beside them \(([\d,]+) in (\d+) files and the one todo on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect([num(integration![3]), Number(integration![4])]).toEqual([2799, 155])
    // The files mended keep their counts, so the suite grows by the new file's cases alone.
    expect(num(integration![3]) + byPerson).toBe(num(integration![1]))
    expect(Number(integration![2]) - Number(integration![4])).toBe(1)
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1172)
    expect(num(lint![1]) - num(lint![2])).toBe(2)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[2]).toBe('210')
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of regionEvents: plain language', () => {
  const written = [block, statusLine, prLine].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the block wrote, and dates and times in their plain form', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(block).not.toMatch(rule)
    for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(written).not.toMatch(rule)
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
    const comments = [features[features.findIndex((l) => /^ {2}regionEvents: /.test(l)) - 1], server.slice(server.lastIndexOf('/**', server.indexOf('export const REGION_EVENTS_ON')), server.indexOf('export const REGION_EVENTS_ON'))]
    for (const text of [read(SELF), ...comments]) {
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text).not.toMatch(rule)
    }
  })
})
