// test/unit/redesign-status-ws09-switch-on-words.test.ts
//
// REDESIGN_STATUS.md records the two wordings K chose before the clubs
// switch-on, K's decision 10, choices 5 and 7, in the block "WS09 switch-on:
// the two wordings K chose". Like the other record tests of WS09, this file
// reads only the WS09 section, from its heading to the WS10 heading. Pinned
// here: the block, right after the switch-on of clubKeepers and before the
// four lists while it is the section's latest; its parts in order; the two
// wordings against the files; who meets each, with the tests each line
// names; what ships with every switch off; the pins moved and their files'
// counts of cases; the Status line; the figures of the Checks line; and the
// plain-language rules over what the block wrote. No case reads a switch's
// shipped value.
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
const KEEPERS = '### WS09 switch-on: clubKeepers and CLUB_KEEPERS_ON'
const BLOCK = '### WS09 switch-on: the two wordings K chose'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === BLOCK

const SELF = 'test/unit/redesign-status-ws09-switch-on-words.test.ts'
const BAR = 'src/areas/clubs/components/ThisMonthBar.tsx'
const DASHBOARD = 'src/pages/DashboardPage.tsx'
const SENTENCE = 'As regional representative you can update these clubs\' pages and news.'
/** The files whose cases moved in place, each with its count of cases, which this step keeps. */
const MOVED: ReadonlyArray<readonly [string, number]> = [
  ['test/unit/my-region-this-month-bar.test.tsx', 5], ['test/unit/my-region-page.test.tsx', 16], ['test/unit/my-region-edges.test.tsx', 14],
  ['test/unit/club-pages-no-dates.test.tsx', 7], ['test/unit/my-region-ways-in.test.tsx', 3], ['test/unit/club-region-words.test.tsx', 3],
  ['test/unit/redesign-status-ws09-review.test.ts', 6], ['test/unit/redesign-status-ws09-s-answers.test.ts', 14], ['test/unit/redesign-status-ws09-step11.test.ts', 22],
]
const RECORD_TURNS = ['test/unit/redesign-status-ws09-review.test.ts', 'test/unit/redesign-status-ws09-s-answers.test.ts', 'test/unit/redesign-status-ws09-step11.test.ts']

/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length

describe('REDESIGN_STATUS.md, WS09 switch-on of the two wordings: the block', () => {
  it('sits once, right after the switch-on of clubKeepers, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(KEEPERS) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
    expect(read('test/unit/redesign-status-ws09-step1.test.ts')).toContain('|WS09 switch-on: \\S|')
  })

  it('opens with why, in two sentences: K\'s decision 10 of Tuesday, November 17, 2026, choices 5 and 7', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of ['K\'s decision 10 of Tuesday, November 17, 2026', 'choices 5 and 7', 'before the clubs switch-on', 'nothing else of the product']) {
      expect(opening, piece).toContain(piece)
    }
    expect(opening.split(/\.(?: |$)/).filter(Boolean)).toHaveLength(2)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **What changes.**', '- **What a person meets.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Files.**', '- **The pictures.**',
      '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of the two wordings: against the files', () => {
  it('names the two wordings, each with K\'s reason, as the files hold them', () => {
    const changes = bullet(block, '- **What changes.**')
    for (const piece of [
      '"Next monthly check lands Mon, Dec 7, 2026" becomes "Next monthly check due Mon, Dec 7, 2026"', `\`${BAR}\` and its header comment`, 'WS09 step 15',
      '"Send this month\'s check now"', 'no date code changes', `"${SENTENCE}" goes`, `\`${DASHBOARD}\``, 'explaining sentences sit behind Help or nowhere', 'no empty element is left',
    ]) expect(changes, piece).toContain(piece)
    const bar = read(BAR)
    expect(bar).toContain('`Next monthly check due ${thisMonth.nextCheck.date}`,')
    expect(bar).toContain('// "This month · Next monthly check due Mon, Dec 7, 2026 · 3 of 5 checked')
    expect(bar).not.toMatch(/\blands\b/)
    const dashboard = read(DASHBOARD)
    expect(dashboard).not.toContain('As regional representative')
    // The heading is followed straight away by the way into My region.
    expect(dashboard).toContain('Clubs in your region\n                </h2>\n                {/* With clubKeepers on, the way into My region (WS09 step 11). */}')
  })

  it('lists who meets each wording by who they are, each line naming tests that exist', () => {
    const meets = bullet(block, '- **What a person meets.**')
    const people = meets.split('\n').filter((l) => l.startsWith('  - '))
    expect(people.map((l) => l.slice(4, l.indexOf(':')))).toEqual([
      'A holder of a regional seat whose regions hold a club, whatever their role but an LCA admin, other than a guest', 'An LCA admin',
      'A holder of a regional seat whose regions hold no club, other than a guest', 'A guest who holds a regional seat',
      'Everyone else, a visitor, a member with no seat and a club\'s rep with no seat',
    ])
    // A holder over an empty region is let into My region and meets the bar there.
    expect(people[2]).toContain('its bar says "due"')
    expect(read('test/unit/my-region-page.test.tsx')).toContain('open(\'seatNoClub\')')
    // A guest with a seat sees the card, but My region's guard sends them to the dashboard.
    expect(people[3]).toContain('they meet no bar')
    expect(read('src/components/auth/RoleProtectedRoute.tsx')).toContain('if (accountRole === \'guest\') return false')
    expect(read('test/unit/my-region-page.test.tsx')).toContain('for (const person of [\'guestWithSeat\', ')
    for (const line of people) {
      const named = [...line.matchAll(/`(test\/[^`]+)`/g)].map((m) => m[1])
      expect(named.length, line.slice(4, 40)).toBeGreaterThan(0)
      for (const file of named) expect(existsSync(join(ROOT, file)), file).toBe(true)
    }
    expect(people[0]).toContain('with `clubKeepers` off and on')
    // The card's case sets the switch both ways itself, through the mocked FEATURES.
    const words = read('test/unit/club-region-words.test.tsx')
    expect(words).toContain('vi.mock(\'@/lib/features\', async (importOriginal) => {')
    expect(words).toContain('for (const on of [false, true]) {')
  })

  it('says what ships with every switch off: the sentence gone for every seat holder, the bar only behind clubKeepers', () => {
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['gone for every holder of a regional seat', 'the card reads no switch', '`GET /api/board/my-seats`', 'by K\'s own decision', 'drawn only with `clubKeepers` on']) {
      expect(off, piece).toContain(piece)
    }
    expect(read(DASHBOARD)).toContain('{role !== \'lca_admin\' && managedClubs.length > 0 && (')
    expect(read('src/App.tsx')).toContain('<Route path="/workspace/region" element={FEATURES.clubKeepers ? <RoleProtectedRoute requireSeat><MyRegionPage /></RoleProtectedRoute> : <Navigate to="/dashboard" replace />} />')
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of the two wordings: the pins and the Status line', () => {
  it('names every file whose cases moved, with its count of cases as the file holds it, and the closed assertions turned', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const [file, count] of MOVED) {
      expect(pins, file).toContain(`\`${file}\` (${count})`)
      expect(casesIn(file), file).toBe(count)
    }
    for (const file of RECORD_TURNS) {
      const text = read(file)
      expect(text, file).toContain('// K\'s decision 10 of Tuesday, November 17, 2026 removed the sentence from the dashboard.')
      expect(text.match(/\)\)\.not\.toContain\((?:'As regional representative you can update these clubs\\' pages and news\.'|DASHBOARD_NEW)\)/g), file).toHaveLength(1)
    }
    // No test pins the old word of the bar.
    for (const [file] of MOVED.slice(0, 4)) expect(read(file), file).not.toContain('Next monthly check lands')
  })

  it('gives the Status line its tail while this block is the latest, with no merge that has not happened', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'the switch-on of `clubKeepers` and `CLUB_KEEPERS_ON` is built on a branch of its own, with the two wordings of K\'s decision 10 built after it there',
        'once checkpoint V and the club email switch are on `main`', 'WS09 step 15 follows as its own pull request',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(statusLine).not.toMatch(/switch-on[^;]*\bmerged\b/)
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of the two wordings: the Checks line', () => {
  it('gives each figure once, the counts adding up, and the build moving only in the two chunks', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    const written = Number(new RegExp(`\`${escape(SELF)}\` \\((\\d+): `).exec(bullet(block, '- **Files.**'))?.[1])
    expect(written).toBe(casesIn(SELF))
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    // No case is added or removed in any other file: the new file's cases alone.
    expect(num(unit![3]) + written).toBe(num(unit![1]))
    expect(Number(unit![2]) - Number(unit![4])).toBe(1)
    const integration = /integration ([\d,]+) tests that run in (\d+) files, with the one todo beside them \(([\d,]+) and the one todo on the base\)/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect(num(integration![1])).toBe(num(integration![3]))
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![1]) - num(lint![2])).toBe(1)
    const built = bullet(block, '- **Build.**')
    for (const piece of ['`DashboardPage` from 28,819 to 28,673 bytes', '`MyRegionPage` from 15,473 to 15,471 bytes', 'keeps its 558,793 bytes', '134,857 bytes', '729 bytes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(built, piece).toContain(piece)
    }
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`')
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of the two wordings: plain language', () => {
  const written = [block, statusLine].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the block wrote, and dates in their plain form', () => {
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

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of this file, the bar\'s file and the lines that name K\'s decision 10', () => {
    const tenth = MOVED.flatMap(([f]) => read(f).split('\n').filter((l) => l.includes('K\'s decision 10')))
    expect(tenth.length).toBeGreaterThanOrEqual(RECORD_TURNS.length)
    for (const text of [read(SELF), read(BAR), ...tenth]) {
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text).not.toMatch(rule)
    }
  })
})
