// test/unit/redesign-status-ws09-switch-on-region-main.test.ts
//
// REDESIGN_STATUS.md records the switch-on of the representatives' club
// events as it stands on main's own tree, in the block "WS09 switch-on:
// regionEvents on main's tree": the two commits gated on a rehearsal base,
// picked onto the head of the clubs switch-on's branch, and what that tree
// asked of them. Like the other record tests of WS09, this file reads only
// the WS09 section, from its heading to the WS10 heading. Pinned here: the
// block, right after the approval's mend and before the four lists while it
// is the section's latest; its opening and its parts in order; the picks'
// conflicts against the file they settled; the two mends of the first picked
// block's record test against that file; the sweep; the way back against the
// order check and the ordinary save; what a representative may do and what
// mail it can cause, against the handlers and the send; the pins moved and
// their file's count of cases; what is owed; what the merge carries; the
// Status and PR lines; the figures of the Checks line; and the plain-language
// rules over what the block wrote and over the two new mail tests. No case reads or pins a switch's shipped
// value: the record test of the first picked block holds the two lines on,
// and the order check as shipped is held by the two tests the block names.
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

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const REGION = '### WS09 switch-on: regionEvents and REGION_EVENTS_ON'
const APPROVAL = '### WS09 switch-on: the approval judges the person first'
const BLOCK = '### WS09 switch-on: regionEvents on main\'s tree'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === BLOCK

const SELF = 'test/unit/redesign-status-ws09-switch-on-region-main.test.ts'
const REGION_TEST = 'test/unit/redesign-status-ws09-switch-on-region.test.ts'
const MAIL_TEST = 'test/integration/region-events-mail-rules.test.ts'
const EDGES_TEST = 'test/integration/region-events-mail-edges.test.ts'
const SWEEP = 'test/integration/media-manager-reach.test.ts'
const HANDLER = 'functions/api/admin/tournaments/[id]/approval.ts'
const ANNOUNCE = 'functions/api/admin/tournaments/[id]/announce.ts'
const SHEETS = ['1-way-in-and-create.png', '2-waiting-and-review.png', '3-changes-and-approval.png', '4-running-the-event.png', '5-club-rep-and-member.png']

/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length

describe('REDESIGN_STATUS.md, WS09 switch-on of regionEvents on main\'s tree: the block', () => {
  it('sits once, right after the approval\'s mend, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(REGION) + 1]).toBe(APPROVAL)
    expect(headings[headings.indexOf(APPROVAL) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
    expect(read('test/unit/redesign-status-ws09-step1.test.ts')).toContain('|WS09 switch-on: \\S|')
  })

  it('opens with why, in two sentences: the rehearsal base, and what K is asked to merge only if the clubs switch-on went cleanly', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of ['rehearsal base', 'the same two commits', 'main\'s own tree', 'K is asked to merge', 'went cleanly']) expect(opening, piece).toContain(piece)
    expect(opening.split(/\.(?: |$)/).filter(Boolean)).toHaveLength(2)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **The pick.**', '- **What goes on.**', '- **What the real tree asked.**', '- **The sweep.**', '- **Both states.**', '- **How it comes back off.**',
      '- **What a representative can and cannot do, for K to read once more.**', '- **What mail it can cause.**', '- **The pictures.**', '- **Pins moved.**',
      '- **Owed, K\'s own.**', '- **What the merge carries.**', '- **Lint.**', '- **Build.**', '- Checks:', '- **Files.**', '- **Branch.**',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of regionEvents on main\'s tree: against the files', () => {
  it('names the base, the two commits by their subjects and each conflict, quoting the one list the browser builds\' file holds', () => {
    const pick = bullet(block, '- **The pick.**')
    for (const piece of [
      '`01d05ed`', '`redesign/ws09-keepers-on`', '`a45c951`', '`498ec7f`', '"WS09 switch-on: regionEvents and REGION_EVENTS_ON go on together"',
      '"WS09 switch-on: the approval judges the person before it reads the body"', '`test/a11y/builds.spec.ts`', '`REDESIGN_STATUS.md`', 'the WS09 Status line',
      '"WS09 switch-on: on main\'s tree"', 'after a semicolon',
    ]) expect(pick, piece).toContain(piece)
    // The file holds the one list, and the block quotes it as its own tree held it. Since main was taken in, in the block after this one, the list has grown: the exact line is held while this block is the section's latest, and after it every name the block quotes still stands in the file's list, in the same order.
    const spec = read('test/a11y/builds.spec.ts').split('\n').filter((l) => l.startsWith('const SHIPPED_ON = '))
    expect(spec).toHaveLength(1)
    const namesIn = (line: string) => (/\[([^\]]*)\]/.exec(line)?.[1] ?? '').split(',').map((n) => n.trim()).filter(Boolean)
    const quoted = namesIn(/`const SHIPPED_ON = \[[^\]]*\]`/.exec(pick)?.[0] ?? '')
    expect(quoted.length).toBeGreaterThan(0)
    if (latest) expect(pick).toContain(`\`${spec[0]}\``)
    else expect(namesIn(spec[0]).filter((n) => quoted.includes(n))).toEqual(quoted)
  })

  it('says what goes on and what stays off, and names the two tests that hold the order check as shipped', () => {
    const on = bullet(block, '- **What goes on.**')
    for (const piece of [
      '`regionEvents: true`', '`export const REGION_EVENTS_ON = true`', '`clubKeepers`', '`CLUB_KEEPERS_ON`', '`newClubs`', '`CLUB_PAGES_ON`', '`switchOrderProblems`', 'finds nothing',
      'No line of product changes beyond the two picks',
    ]) expect(on, piece).toContain(piece)
    for (const file of ['test/unit/club-pages-switch.test.ts', REGION_TEST]) {
      expect(on, file).toContain(`\`${file}\``)
      expect(existsSync(join(ROOT, file)), file).toBe(true)
    }
  })

  it('names what the real tree asked: the worklist, the two mends of the first picked block\'s record test, the mail cases added, and what was found', () => {
    const asked = bullet(block, '- **What the real tree asked.**')
    for (const piece of [
      'before any change', 'two failing', `\`${REGION_TEST}\``, 'nothing else failing', 'no test of another workstream', `\`${MAIL_TEST}\``, `\`${EDGES_TEST}\``, 'Found and not mended',
      'no fault of the product',
    ]) expect(asked, piece).toContain(piece)
    // The two mends, as the first picked block's record test now holds them.
    const region = read(REGION_TEST)
    expect(region).toContain('expect(headings[headings.indexOf(MAIN) + 1]).toBe(BLOCK)')
    expect(region).toContain('expect(read(\'test/a11y/builds.spec.ts\')).toMatch(/^const SHIPPED_ON = \\[[^\\]]*\'regionEvents\'[^\\]]*\\]$/m)')
  })

  it('holds the sweep as the mail stream wrote it, with its four cases and no switch of this workstream in it', () => {
    const sweep = bullet(block, '- **The sweep.**')
    for (const piece of [`\`${SWEEP}\``, 'byte for byte', '`01d05ed`', 'passes as it stands']) expect(sweep, piece).toContain(piece)
    expect(casesIn(SWEEP)).toBe(4)
    expect(read(SWEEP)).not.toMatch(/REGION_EVENTS_ON|clubs\/pages/)
  })

  it('says how it comes back off: regionEvents first, and an event that waits stays hidden, as the order check and the ordinary save hold', () => {
    const off = bullet(block, '- **How it comes back off.**')
    for (const piece of [
      '`regionEvents` and `REGION_EVENTS_ON` first', 'never `clubKeepers` before `regionEvents`', '`needs_lca_approval` 1', '`WAITING_FOR_APPROVAL`, 409',
      '403 "LCA review of club events is not open yet."', '`functions/api/admin/tournaments/[id].ts`',
    ]) expect(off, piece).toContain(piece)
    expect(read('src/areas/clubs/switches.ts')).toContain('problems.push(\'regionEvents is on while clubKeepers is off: ')
    expect(read('functions/api/admin/tournaments/[id].ts')).toContain('if (body.isVisible && !mayList({ needs_lca_approval: existing.needsLcaApproval, approved_at: existing.approvedAt })) {\n    return errorResponse(WAITING_FOR_APPROVAL, 409)')
    expect(read('domain/events/approval.ts')).not.toMatch(/REGION_EVENTS_ON|regionEvents/)
  })

  it('gives what a representative can and cannot do as the first picked block does, and says this tree changes no line of it', () => {
    const can = bullet(block, '- **What a representative can and cannot do, for K to read once more.**')
    // The powers and the three refusals, each as the first picked block gives them.
    const asBuilt = [
      'the setup, entries opened and closed, pairings and results, walk-ins and the waitlist, cash and check entries marked paid, emailing every entrant',
      'the entrants\' names, US Chess IDs, ratings, grades and payment status', '"Only an LCA admin can record refunds"', '"This entry was paid by card. Ask an LCA admin to change it."',
      '"Entry fees need a payout account first. Until then, your event can run at $0."',
    ]
    for (const piece of asBuilt) {
      expect(can, piece).toContain(piece)
      expect(part(REGION), piece).toContain(piece)
    }
    for (const piece of [
      'K\'s choice 2 (b) in K\'s decision 10', 'K\'s choice 3', 'K\'s choice 4', 'This tree changes no line of it', 'Nothing here widens or narrows any of it',
    ]) expect(can, piece).toContain(piece)
    expect(part(REGION)).toContain('Nothing in this change widens or narrows any of it.')
    const registration = read('functions/api/registrations/[id].ts')
    for (const words of ['Only an LCA admin can record refunds', 'This entry was paid by card. Ask an LCA admin to change it.']) expect(registration, words).toContain(`'${words}'`)
    expect(read('domain/events/creation.ts')).toContain('export const FEES_NEED_PAYOUT_ACCOUNT = \'Entry fees need a payout account first. Until then, your event can run at $0.\'')
    expect(read(HANDLER)).toContain('export const SUBMITS_A_DAY = 5\n')
  })

  it('says what mail it can cause under the engine\'s rules, against the handlers, the send and the gate, and names the test that holds it', () => {
    const mail = bullet(block, '- **What mail it can cause.**')
    for (const piece of [
      '`mailLists`', '`MAIL_LISTS_ON`', 'kind \'event\'', 'do-not-send list', 'an address mail cannot reach', '400 ms apart', 'never ends the loop', 'a 429 or a 503',
      `"${'Sent for LCA review, but the email did not reach every LCA admin.'}"`, `"${'Sent for LCA review, but the email to the LCA admins was not sent.'}"`,
      'no LCA admin told', 'Nothing sends it again', '`POST /api/admin/tournaments/[id]/announce`', 'reads the do-not-send list once', 'Nothing meters it', 'about 40 people at once', '100 emails a day',
      'Nothing here widens it', `\`${MAIL_TEST}\``, 'This change touches no line of mail',
    ]) expect(mail, piece).toContain(piece)
    const handler = read(HANDLER)
    expect(handler).toContain('    if (await trySendEmail(env, { ...message, to })) sent++\n')
    expect(handler).toContain('const SEND_INTERVAL_MS = 400\n')
    expect(handler).toContain('reviewPartly: \'Sent for LCA review, but the email did not reach every LCA admin.\',')
    expect(handler).toContain('reviewNotSent: \'Sent for LCA review, but the email to the LCA admins was not sent.\',')
    expect(read('functions/utils/mail/send.ts')).toContain('const ruled = engineRulesOn() || kind === \'optional\' || sender === \'ses\'')
    expect(read('functions/utils/mail/gate.ts')).toContain('if (kind !== \'event\' && !isListAddress(address)) return \'not_sendable\'')
    expect(read(ANNOUNCE)).toContain('const gate = engineRulesOn() ? await openLoopGate(context.env.DB, list.map((r) => r.email)) : undefined')
    expect(mail).toContain(`\`${MAIL_TEST}\` (${casesIn(MAIL_TEST)})`)
    expect(mail).toContain(`\`${EDGES_TEST}\` (${casesIn(EDGES_TEST)})`)
    expect(mail).toContain(`"${'Sent for LCA review. No LCA admin has an email address on file, so no email was sent.'}"`)
    expect(handler).toContain('reviewNoAdmin: \'Sent for LCA review. No LCA admin has an email address on file, so no email was sent.\',')
  })

  it('names the pictures by their sheets, taken with no switch flipped at both widths, and the sideways measure', () => {
    const pictures = bullet(block, '- **The pictures.**')
    for (const sheet of SHEETS) expect(pictures, sheet).toContain(`\`${sheet}\``)
    for (const piece of ['no switch flipped', '390 and 1280 pixels', 'made-up', 'no request left the machine', 'sideways', 'not this change\'s', 'Every server the look started was stopped']) {
      expect(pictures, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of regionEvents on main\'s tree: the pins, the owed, the merge and the Status and PR lines', () => {
  it('names every pin moved, with its file\'s count of cases as the file holds it, and which way each case meant', () => {
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins).toContain(`\`${REGION_TEST}\` (${casesIn(REGION_TEST)})`)
    expect(casesIn(REGION_TEST)).toBe(25)
    for (const title of [
      'sits once, right after the two wordings K chose and the block on main\'s tree, and before the four lists while it is the latest',
      'adds the one name to the browser builds\' list of switches that ship on',
    ]) {
      expect(pins, title).toContain(`"${title}"`)
      expect(read(REGION_TEST), title).toContain(`it('${title.replace(/'/g, '\\\'')}'`)
    }
    expect(pins).toContain('No case meant the switch as it ships and was turned to set it')
  })

  it('names what is owed by K\'s own hands', () => {
    const owed = bullet(block, '- **Owed, K\'s own.**')
    for (const piece of [
      'K\'s word on the pull request', 'only if the clubs switch-on went cleanly', 'Telling the board', 'an LCA admin answers each submitted event', 'no page yet lets a representative name a director',
      'The move to Amazon SES', 'regional seats', 'member accounts',
    ]) expect(owed, piece).toContain(piece)
  })

  it('says what the merge carries: three commits, two switch lines and the approval\'s order, the worker as on the base', () => {
    const carries = bullet(block, '- **What the merge carries.**')
    for (const piece of [
      'Three commits', 'the two switch lines with their comments', 'the approval\'s order of checks', 'no migration, no contract, no page', '76.61 KiB, gzip 20.53 KiB', '78,448 bytes',
      '`80390f9febd8d7b1046bf946c84522abe6330f4f6894b65c93f2873174143079`', 'on this tree and on `01d05ed` alike', '`deploy-worker.yml`',
    ]) expect(carries, piece).toContain(piece)
  })

  it('moves the Status line\'s tail while this block is the latest, keeps the pull request numbers, and says no merge that the record does not hold', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'built again on `main`\'s own tree, on `redesign/ws09-keepers-on`', 'the switch-on of `regionEvents` and `REGION_EVENTS_ON`, by K\'s decisions 10 and 11',
        'the mend that has the approval judge the person before it reads the body', 'built again on `main`\'s own tree, on `redesign/ws09-region-on`',
        'once the clubs switch-on is on `main` and went cleanly', 'WS09 step 15 follows as its own pull request',
      ]) expect(tail, piece).toContain(piece)
      expect(tail).not.toContain('on the same branch')
      expect(statusLine.match(/pull request \d+/g)).toEqual(['pull request 132', 'pull request 134'])
      expect(prLine.match(/pull request \d+/g)).toEqual(['pull request 130', 'pull request 131', 'pull request 132', 'pull request 134', 'pull request 133'])
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(statusLine).not.toMatch(/switch-on[^;]*\bmerged\b/)
    expect(prLine).not.toMatch(/pull request 13[34][^;]*\bmerged\b/)
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of regionEvents on main\'s tree: the Checks line', () => {
  it('gives each figure once, the counts adding up to the base\'s and the new files, with no browser run of this step', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run in this build']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    const files = bullet(block, '- **Files.**')
    const self = Number(new RegExp(`\`${escape(SELF)}\` \\((\\d+): `).exec(files)?.[1])
    const mail = Number(new RegExp(`\`${escape(MAIL_TEST)}\` \\((\\d+): `).exec(files)?.[1])
    const edges = Number(new RegExp(`\`${escape(EDGES_TEST)}\` \\((\\d+): `).exec(files)?.[1])
    expect(self).toBe(casesIn(SELF))
    expect(mail).toBe(casesIn(MAIL_TEST))
    expect(edges).toBe(casesIn(EDGES_TEST))
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on `02dfa9b` before any change\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    expect([num(unit![3]), Number(unit![4])]).toEqual([10669, 456])
    // The one new unit file's cases alone: the two mends keep their file's count.
    expect(num(unit![3]) + self).toBe(num(unit![1]))
    expect(Number(unit![2]) - Number(unit![4])).toBe(1)
    const integration = /integration ([\d,]+) tests that run in (\d+) files, with the one todo beside them \(([\d,]+) in (\d+) and the one todo on `02dfa9b` before any change\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect([num(integration![3]), Number(integration![4])]).toEqual([2872, 158])
    // The two new integration files' cases: the mail under the rules and its edges.
    expect(num(integration![3]) + mail + edges).toBe(num(integration![1]))
    expect(Number(integration![2]) - Number(integration![4])).toBe(2)
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on `01d05ed`\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    // The two picked commits' four new files and this step's three.
    expect(num(lint![1]) - num(lint![2])).toBe(7)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on `01d05ed`\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(built?.[2])
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of regionEvents on main\'s tree: plain language', () => {
  const written = [block, statusLine].join('\n')

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

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of this file and the two new mail tests', () => {
    for (const file of [SELF, MAIL_TEST, EDGES_TEST]) {
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(read(file), file).not.toMatch(rule)
    }
  })

  it('reads no other change\'s switch in the two new mail tests, which set every switch they read through getters on mocked modules', () => {
    // The names are put together so that this file does not hold them as a list of its own.
    const others = new RegExp(`\\b(${['club' + 'EmailHidden', 'CLUB_' + 'EMAIL_HIDDEN', 'roster' + 'ShortNames', 'ROSTER_' + 'SHORT_NAMES', 'new' + 'Clubs', 'CLUB_' + 'PAGES_ON', 'club' + 'Keepers', 'mail' + 'Lists'].join('|')})\\b`)
    for (const file of [MAIL_TEST, EDGES_TEST]) {
      const test = read(file)
      expect(test, file).not.toMatch(others)
      for (const getter of ['get CLUB_KEEPERS_ON() {', 'get REGION_EVENTS_ON() {', 'get MAIL_LISTS_ON() {', 'get MAIL_SENDER() {']) expect(test, `${file}: ${getter}`).toContain(getter)
      expect(test, file).not.toContain('@/lib/features')
      expect(test.match(/vi\.mock\('\.\.\/\.\.\/functions\/utils\/(?:clubs\/pages|mail\/switches)'/g), file).toHaveLength(2)
    }
  })
})
