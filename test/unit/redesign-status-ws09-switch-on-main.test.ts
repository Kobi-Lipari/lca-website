// test/unit/redesign-status-ws09-switch-on-main.test.ts
//
// REDESIGN_STATUS.md records the clubs switch-on as it stands on main's own
// tree, in the block "WS09 switch-on: on main's tree": the two commits gated
// on a rehearsal base, picked onto the head of the club email switch-on's
// branch, what that tree asked of them, and the two mends of the dashboard's
// card for a guest account that holds a regional seat. Like the other record
// tests of WS09, this file reads only the WS09 section, from its heading to
// the WS10 heading. Pinned here: the block, right after the two wordings'
// block and before the four lists while it is the section's latest; its
// opening and its parts in order; the pick's one conflict against the file
// it settled; the guest's card, the guard and the answer against their
// files; the order of turning off against the order check; the mail it can
// cause against the monthly check's gate read; the pins moved and the counts
// of the files they name; the Status and PR lines; the figures of the Checks
// line; and the plain-language rules over what the block wrote. No case reads
// or pins a switch's shipped value: the record test of the first picked block
// holds the two lines on, and the order check as shipped is held by the two
// tests the block names.
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[A-Z]+_(?:CASES|LINE|COUNT|TEXT|AFTER|FILES|TESTS|MORE)\\b|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
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
const WORDS = '### WS09 switch-on: the two wordings K chose'
const BLOCK = '### WS09 switch-on: on main\'s tree'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === BLOCK

const SELF = 'test/unit/redesign-status-ws09-switch-on-main.test.ts'
const GUEST_TEST = 'test/unit/dashboard-region-card-guest.test.tsx'
const AGREE_TEST = 'test/unit/dashboard-card-guard-agree.test.tsx'
const SEAT_TEST = 'test/integration/guest-regional-seat.test.ts'
const DASHBOARD = 'src/pages/DashboardPage.tsx'
const GUARD = 'src/components/auth/RoleProtectedRoute.tsx'
const REGION = 'functions/api/workspace/region.ts'
const ROUTE_TEST = 'test/unit/your-club-route.test.tsx'
const STEP11 = 'test/unit/redesign-status-ws09-step11.test.ts'
/** The one line the pick's conflict settled, as the block quotes it. */
const SHIPPED_ON = 'const SHIPPED_ON = [\'clubEmailHidden\', \'mailLists\', \'clubKeepers\']'
/** The files whose cases moved in place, each with its count of cases, which this step keeps. */
const MOVED: ReadonlyArray<readonly [string, number]> = [[ROUTE_TEST, 15], [STEP11, 22]]

/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length

describe('REDESIGN_STATUS.md, WS09 switch-on on main\'s tree: the block', () => {
  it('sits once, right after the two wordings\' block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(WORDS) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
    expect(read('test/unit/redesign-status-ws09-step1.test.ts')).toContain('|WS09 switch-on: \\S|')
  })

  it('opens with why, in two sentences: the rehearsal base, and what K is asked to merge', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of ['rehearsal base', 'the same two commits', 'main\'s own tree', 'K is asked to merge']) expect(opening, piece).toContain(piece)
    expect(opening.split(/\.(?: |$)/).filter(Boolean)).toHaveLength(2)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **The pick.**', '- **What goes on.**', '- **What the real tree asked.**', '- **The guest\'s card.**', '- **Both states.**',
      '- **How it comes back off.**', '- **What mail it can cause.**', '- **The pictures.**', '- **Pins moved.**', '- **Owed, K\'s own.**',
      '- **What the merge carries.**', '- **Lint.**', '- **Build.**', '- Checks:', '- **Files.**', '- **Branch.**',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on on main\'s tree: against the files', () => {
  it('names the base, the two commits by their subjects and the one conflict with its line, as the file holds it', () => {
    const pick = bullet(block, '- **The pick.**')
    for (const piece of [
      '`a45c951`', 'pull request 135', '`498ec7f`', '"WS09 switch-on: clubKeepers and CLUB_KEEPERS_ON go on together"', '"WS09 switch-on: the two wordings K chose"',
      '`test/a11y/builds.spec.ts`', `\`${SHIPPED_ON}\``, 'went on clean',
    ]) expect(pick, piece).toContain(piece)
    // The file holds the one list; what it names is the file's own, and moves with the switches.
    const spec = read('test/a11y/builds.spec.ts')
    expect(spec.split('\n').filter((l) => l.startsWith('const SHIPPED_ON = '))).toHaveLength(1)
  })

  it('says what goes on and what stays off, and names the two tests that hold the order check as shipped', () => {
    const on = bullet(block, '- **What goes on.**')
    for (const piece of ['`clubKeepers`', '`CLUB_KEEPERS_ON`', '`regionEvents`', '`REGION_EVENTS_ON`', '`newClubs`', '`CLUB_PAGES_ON`', '`switchOrderProblems`', 'finds nothing']) {
      expect(on, piece).toContain(piece)
    }
    for (const file of ['test/unit/club-pages-switch.test.ts', 'test/unit/redesign-status-ws09-switch-on-keepers.test.ts']) {
      expect(on, file).toContain(`\`${file}\``)
      expect(existsSync(join(ROOT, file)), file).toBe(true)
    }
  })

  it('names what the real tree asked: an empty worklist, each mend with its file, and what was found and left', () => {
    const asked = bullet(block, '- **What the real tree asked.**')
    for (const piece of [
      'nothing failing', `\`${DASHBOARD}\``, `\`${ROUTE_TEST}\``, '`waitFor`', `\`${STEP11}\``, 'Manage →', '`functions/utils/admin/permissions.ts`',
      'Found here and mended here', 'The follow-up that stays', '`canManageClub` in `src/areas/admin/roles.ts`', 'still meets the server\'s refusal',
      'draft pull request 134', '`498ec7f`',
    ]) expect(asked, piece).toContain(piece)
    expect(asked).not.toContain('Found and not mended')
    // The focus read waits, in the one case the mend names, and the file keeps its count.
    const route = read(ROUTE_TEST)
    const named = between(route, 'it(\'tells a person the browser lets through but the server refuses why, with a way back, and draws nothing of the club\'', '\n  it(')
    expect(named).toContain('await waitFor(() => expect(document.activeElement).toBe(screen.getByRole(\'heading\', { level: 1 })))')
    expect(casesIn(ROUTE_TEST)).toBe(15)
    // The admin club page's guard in the browser names no account role; the server's rule refuses a guest.
    expect(read('src/areas/admin/roles.ts')).toContain('  return regionalClubIds.includes(clubId)\n}')
    expect(read('functions/utils/admin/permissions.ts')).toContain('  if (member.role === \'guest\') return false\n  return isRegionalRepFor(db, member.id, clubId)')
  })

  it('names the guest\'s card: the fault, the mend, what a guest now sees, the judgement call and K\'s question, against the files', () => {
    const card = bullet(block, '- **The guest\'s card.**')
    for (const piece of [
      'Open My region', 'straight back to the dashboard', '`authMember?.role !== \'guest\'`', 'no new request', 'judgement call', 'whether a seat alone should let a guest account into My region',
      `\`${GUEST_TEST}\``, `\`${GUARD}\``, `\`${REGION}\``, 'Two mends', 'in both states of `clubKeepers`', 'plain row', 'ships with every switch off', 'K\'s yes',
    ]) expect(card, piece).toContain(piece)
    // The plain rows ship with every switch off, so the merge's list of product changes says so too.
    expect(bullet(block, '- **What the merge carries.**')).toContain('the guest\'s plain rows of clubs on the same card, which are behind no switch and ship with every switch off, so they need K\'s yes')
    const dashboard = read(DASHBOARD)
    expect(dashboard).toContain('{FEATURES.clubKeepers && authMember?.role !== \'guest\' && (\n                  <Button asChild variant="outline" className="mt-3 min-h-11 px-4">\n                    <Link to="/workspace/region">Open My region</Link>')
    expect(dashboard).toContain('{role !== \'lca_admin\' && managedClubs.length > 0 && (')
    // A guest's club is a plain row, behind no switch: the link's classes less its hover and transition.
    expect(dashboard).toContain('{managedClubs.map((c) =>\n                    authMember?.role === \'guest\' ? (\n                      <li\n                        key={c.id}\n                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"\n                      >')
    expect(read(GUARD)).toContain('  if (accountRole === \'guest\') return false\n  return seats.some((seat) => seat.category === \'regional_rep\')')
    expect(read(REGION)).toContain('if (member.role === \'guest\') return errorResponse(REGION_FOR_SEATS, 403)')
    expect(card).toContain(`\`${GUEST_TEST}\` (${casesIn(GUEST_TEST)})`)
  })

  it('says how it comes back off: clubKeepers first, or both together, never clubEmailHidden alone, as the order check holds', () => {
    const off = bullet(block, '- **How it comes back off.**')
    for (const piece of ['`clubKeepers` and `CLUB_KEEPERS_ON` first', 'all four together', 'never `clubEmailHidden` alone']) expect(off, piece).toContain(piece)
    expect(read('src/areas/clubs/switches.ts')).toContain('problems.push(\'clubKeepers is on while clubEmailHidden is off: ')
  })

  it('says what mail it can cause, against the monthly check\'s one gate read and the send\'s rule', () => {
    const mail = bullet(block, '- **What mail it can cause.**')
    for (const piece of ['`mailLists`', '`MAIL_LISTS_ON`', 'do-not-send list', 'no line of the first picked block\'s list changes', '`functions/utils/clubs/monthlyCheck.ts`', '`functions/utils/mail/send.ts`']) {
      expect(mail, piece).toContain(piece)
    }
    expect(read('functions/utils/clubs/monthlyCheck.ts')).toContain('const gate = engineRulesOn() && addresses.length > 0 ? await openLoopGate(env.DB, addresses) : undefined')
    expect(read('functions/utils/mail/send.ts')).toContain('const ruled = engineRulesOn() || kind === \'optional\' || sender === \'ses\'')
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on on main\'s tree: the pins, the owed and the Status and PR lines', () => {
  it('names every file whose cases moved, with its count of cases as the file holds it', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const [file, count] of MOVED) {
      expect(pins, file).toContain(`\`${file}\` (${count})`)
      expect(casesIn(file), file).toBe(count)
    }
    expect(pins).toContain('"names the way in as the route and the guard hold it"')
    expect(read(STEP11)).toContain('    // The switch-on on main\'s tree offers a guest account no Open My region.\n')
    // No case of this step meant the switch as it ships and was moved to set it.
    expect(pins).toContain('No case meant the switch as it ships')
  })

  it('names what is owed by K\'s own hands', () => {
    const owed = bullet(block, '- **Owed, K\'s own.**')
    for (const piece of [
      'pull request', '`SIGNING_SECRET`', 'Baton Rouge', 'member accounts, not guest accounts', 'five signed-in steps',
      'K\'s yes to what was built for the guest\'s card', 'K may ask for the links back',
    ]) expect(owed, piece).toContain(piece)
    expect(owed).not.toContain('A ruling before the merge on the guest\'s card')
  })

  it('moves the Status line\'s tail while this block is the latest, keeps the pull request numbers, and says no merge that the record does not hold', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'built again on `main`\'s own tree, on `redesign/ws09-keepers-on`', 'offers a guest account no Open My region', 'draws a guest\'s clubs without Manage → links',
        'WS09 step 15 follows as its own pull request',
      ]) {
        expect(tail, piece).toContain(piece)
      }
      expect(statusLine.match(/pull request \d+/g)).toEqual(['pull request 132', 'pull request 134'])
      expect(prLine.match(/pull request \d+/g)).toEqual(['pull request 130', 'pull request 131', 'pull request 132', 'pull request 134', 'pull request 133'])
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(statusLine).not.toMatch(/switch-on[^;]*\bmerged\b/)
    expect(prLine).not.toMatch(/pull request 13[34][^;]*\bmerged\b/)
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on on main\'s tree: the Checks line', () => {
  it('gives each figure once, the counts adding up with the new files', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    const files = bullet(block, '- **Files.**')
    const self = Number(new RegExp(`\`${escape(SELF)}\` \\((\\d+): `).exec(files)?.[1])
    const guest = Number(new RegExp(`\`${escape(GUEST_TEST)}\` \\((\\d+): `).exec(files)?.[1])
    expect(self).toBe(casesIn(SELF))
    expect(guest).toBe(casesIn(GUEST_TEST))
    const agree = Number(new RegExp(`\`${escape(AGREE_TEST)}\` \\((\\d+): `).exec(files)?.[1])
    const seat = Number(new RegExp(`\`${escape(SEAT_TEST)}\` \\((\\d+): `).exec(files)?.[1])
    // Some `it(` lines sit in loops: one over seven accounts in the first file, two over two switch states in the second.
    expect(agree).toBe(casesIn(AGREE_TEST) + 6)
    expect(seat).toBe(casesIn(SEAT_TEST) + 2)
    // The last copy with the switch off ran these files with the counts they hold now.
    expect(bullet(block, '- **Both states.**')).toContain(`ran the guest's test with its ${guest} cases, the agreement test's ${agree}, the seat test's ${seat} and this block's record test with its ${self}, and every one passed there`)
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on `da76e4a`\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    // No case is added or removed in any other file: the three new unit files' cases alone.
    expect(num(unit![3]) + self + guest + agree).toBe(num(unit![1]))
    expect(Number(unit![2]) - Number(unit![4])).toBe(3)
    const integration = /integration ([\d,]+) tests that run in (\d+) files, with the one todo beside them \(([\d,]+) in (\d+) and the one todo on `da76e4a`\)/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    // The one new integration file's cases alone.
    expect(num(integration![1])).toBe(num(integration![3]) + seat)
    expect(Number(integration![2]) - Number(integration![4])).toBe(1)
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on `da76e4a`\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![1]) - num(lint![2])).toBe(4)
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`')
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on on main\'s tree: plain language', () => {
  const written = [block, statusLine].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the block wrote, and dates and times in their plain form', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(block).not.toMatch(rule)
    for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(written).not.toMatch(rule)
    const prose = proseOf(block)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const found of prose.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b(?!:)/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of this file, the guest\'s test and the dashboard\'s lines this step wrote', () => {
    const dashboard = read(DASHBOARD)
    const card = between(dashboard, '{/* Regional representatives manage every club in their region.', '<Button asChild variant="outline" className="mt-3 min-h-11 px-4">')
    expect(card).toContain('authMember?.role !== \'guest\'')
    for (const text of [read(SELF), read(GUEST_TEST), read(AGREE_TEST), read(SEAT_TEST), card]) {
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text).not.toMatch(rule)
    }
  })

  it('reads and pins no other change\'s switch in the three test files this step added, and sets clubKeepers itself where it needs a state', () => {
    // The names are put together so that this file does not hold them as a list of its own.
    const others = new RegExp(`\\b(${['club' + 'EmailHidden', 'CLUB_' + 'EMAIL_HIDDEN', 'roster' + 'ShortNames', 'ROSTER_' + 'SHORT_NAMES', 'region' + 'Events', 'REGION_' + 'EVENTS_ON', 'new' + 'Clubs', 'CLUB_' + 'PAGES_ON', 'mail' + 'Lists', 'MAIL_' + 'LISTS_ON', 'MAIL_' + 'SENDER'].join('|')})\\b`)
    for (const file of [GUEST_TEST, AGREE_TEST, SEAT_TEST]) expect(read(file), file).not.toMatch(others)
    // Each sets the keepers' switch through a mock or a getter, and none reads the file's shipped value.
    expect(read(GUEST_TEST)).toContain('flags.clubKeepers = ')
    expect(read(AGREE_TEST)).toContain('flags.clubKeepers = ')
    expect(read(SEAT_TEST)).toContain('flags.keepersOn = ')
    expect(read(SEAT_TEST)).not.toContain('CLUB_KEEPERS_ON)')
  })
})
