// test/unit/redesign-status-ws09-s-scroll.test.ts
//
// REDESIGN_STATUS.md records K's second answer at checkpoint S, decision 4,
// answer 1 (a), in a block of its own, "WS09 checkpoint S, after K's second
// answer", straight after the block of K's answers, and marks the sentence it
// added to that block's "Seen in a browser" with "Changed after K's second
// answer:". Like the step record tests, this file reads only the WS09 section,
// from its heading to the WS10 heading. Pinned here: the block's place and
// parts; what was found, K's answer and what was built in its opening; its
// claims against the page and the tests it names; the measures; the sentence
// it marks; decision 4 in the decisions; the Status line's tail; the Checks
// line's figures; and the plain-language rules. What a later block moves (the
// heading after this block, the Status line's tail, the page's line numbers)
// is read only while this block is the section's latest.
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b`)
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
const ANSWERS = '### WS09 checkpoint S, after K\'s answers: the roster kept back, hidden drafts and the card'
const BLOCK = '### WS09 checkpoint S, after K\'s second answer: the Clubs page on a narrow phone'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const answers = part(ANSWERS)
const decisions = part(LISTS[0])
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''

const MARK = 'Changed after K\'s second answer: '
/** The sentences this block added to a line: from the mark to the line's end. */
const added = (line: string) => (line.includes(MARK) ? line.slice(line.indexOf(MARK)) : '')
const marked = ws09.split('\n').filter((l) => l.includes(MARK)).map(added)

const PAGE = 'src/pages/ClubsPage.tsx'
const GRID = '<div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-6">'
const MEETING = '<p className="flex items-start gap-1.5">\n              <Calendar className="mt-0.5 size-3 flex-shrink-0 text-gold-ink" />\n              <span className="min-w-0 break-words">{club.meeting_schedule}</span>'
/** The files this block adds. */
const NEW_UNIT = ['test/unit/clubs-page-narrow.test.tsx', 'test/unit/clubs-page-narrow-css.test.tsx', 'test/unit/redesign-status-ws09-s-scroll.test.ts']
/** The tests this block changes, each with its count, which does not move. */
const CHANGED_TESTS: ReadonlyArray<readonly [string, number]> = [
  ['test/unit/club-region-words.test.tsx', 3], ['test/unit/redesign-status-ws09-s-answers.test.ts', 14],
  ['test/unit/redesign-status-ws09-step5.test.ts', 23], ['test/unit/redesign-status-ws09-step1.test.ts', 33],
]
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])

describe('REDESIGN_STATUS.md, WS09 checkpoint S after K\'s second answer: the block and the Status line', () => {
  it('sits once, right after the block of K\'s answers, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(ANSWERS) + 1]).toBe(BLOCK)
    const at = [ANSWERS, BLOCK, ...LISTS].map((h) => ws09.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    if (latestBlock === BLOCK) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line its tail while this block is the latest', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestBlock === BLOCK) {
      expect(tail).toBe('checkpoint S waits for its pull request; steps 1 to 5, K\'s answers to its review and K\'s second answer, the Clubs page on a narrow phone, are built.')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens with what was found, K\'s answer in one sentence and what the block builds', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'scrolled sideways by 20 pixels on a phone 320 pixels wide', 'sound at 360, 375, 390, 412, 768 and 1,280 pixels', 'on production today and was not brought by this work',
      '`main`\'s page at `f914d8f`', 'had no column template', '"1st, 3rd & 5th Tuesdays 5:30 PM"', 'made the column 324 pixels wide',
      'K\'s decision 4, of Saturday, November 14, 2026, about 12:15 PM UTC, "Recommend is fine for everything."', 'answer 1 (a)', '`ws09-k-decisions.md`',
      '`redesign/docs-phase2`', 'in `src/pages/ClubsPage.tsx` alone', 'none of the plan\'s 38 steps', 'ships with every switch off, on K\'s answer',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What it builds.**', '- **The page.**', '- **The words, old and new.**', '- **The branch.**', '- **What the merge does.**',
      '- **What `main`\'s code does on this database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Seen in a browser.**',
      '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(6)
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint S after K\'s second answer: its claims against the files', () => {
  it('names every file it adds and changes, each test with its count, and only files that exist', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [PAGE, ...NEW_UNIT, ...CHANGED_TESTS.map(([f]) => f), 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of NEW_UNIT) expect(writtenCount(files, file), file).toBe(casesIn(file))
    for (const [file, n] of CHANGED_TESTS) {
      expect(files, file).toContain(`\`${file}\` (${n}, as before: `)
      expect(casesIn(file), file).toBe(n)
    }
    expect(files).toContain('No migration, switch, route or contract is added')
    const paths = [...block.matchAll(/`([a-z][\w./[\]-]*\/[\w.[\]-]+\.(?:ts|tsx|sql|md|json))`/g)].map((m) => m[1])
    expect(paths.length).toBeGreaterThan(8)
    for (const path of new Set(paths)) expect(existsSync(join(ROOT, path)), path).toBe(true)
  })

  it('gives the grid and the meeting line as the page holds them, at the lines it names while it is the latest', () => {
    const page = bullet(block, '- **The page.**')
    for (const piece of [
      '`grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-6`', '`<p className="flex items-start gap-1.5">`',
      '`<Calendar className="mt-0.5 size-3 flex-shrink-0 text-gold-ink" />`', '`<span className="min-w-0 break-words">`', '`test/unit/clubs-page-narrow.test.tsx`',
    ]) expect(page, piece).toContain(piece)
    const source = read(PAGE)
    expect(source).toContain(GRID)
    expect(source).toContain(MEETING)
    expect(source).not.toMatch(/\btruncate\b/)
    // The line of city and region is as K's answers left it, and the meeting line now takes its form.
    expect(source).toContain('<p className="flex items-start gap-1.5">\n            <MapPin className="mt-0.5 size-3 flex-shrink-0 text-gold-ink" />\n            <span className="min-w-0 break-words">')
    if (latestBlock !== BLOCK) return
    const line = (n: number) => source.split('\n')[n - 1] ?? ''
    expect(line(408).trim()).toBe(GRID)
    expect(line(163)).toContain('flex items-start gap-1.5')
    expect(line(165)).toContain('min-w-0 break-words')
    expect(line(75)).toContain('style={{ color: clubTextColor(club.color) }}')
  })

  it('names its pins, each against the file it moved', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const [file] of CHANGED_TESTS) expect(pins, file).toContain(`\`${file}\``)
    for (const piece of ['`truncate` before', '`flex items-center gap-1.5` before', 'Its 3 cases stand', 'the tag "(WS09 checkpoint S)"', '`test/unit/goldText.test.ts`']) {
      expect(pins, piece).toContain(piece)
    }
    const words = read('test/unit/club-region-words.test.tsx')
    expect(words).toContain('expect(meeting.className).toBe(\'min-w-0 break-words\')')
    expect(words).toContain('expect(meeting.parentElement?.className).toBe(\'flex items-start gap-1.5\')')
    const sAnswers = read('test/unit/redesign-status-ws09-s-answers.test.ts')
    expect(sAnswers).toContain('if (latestStep === 5 && latestBlock === BLOCK) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])')
    expect(sAnswers).toContain('if (latestBlock === BLOCK) expect(card).toContain(\'<span className="truncate">{club.meeting_schedule}</span>\')')
    expect(read('test/unit/redesign-status-ws09-step5.test.ts')).toContain('!h.startsWith(\'### WS09 checkpoint S, after K\\\'s second answer: \')')
    const step1 = read('test/unit/redesign-status-ws09-step1.test.ts')
    expect(step1).toContain('|WS09 checkpoint S, after K\'s second answer: \\S|')
    expect(step1).toContain('\\(WS09 (?:step (?:[1-9]|[1-3]\\d)|checkpoint S)\\)')
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint S after K\'s second answer: the measures and what a visitor meets', () => {
  it('gives the measures before and after, at the widths K was told of', () => {
    const seen = bullet(block, '- **Seen in a browser.**')
    for (const piece of [
      '340 and 320 at 320 pixels', '360 and 360 at 360', '390 and 390 at 390', '768 and 768 at 768', '1,280 and 1,280 at 1,280', 'North of Lake Pontchartrain pressed',
      'was 324 pixels at 320 and is 288', '400 and 680 at 1,280, before and after', '624 pixels tall over 3,449 of cards', 'scrolls into view inside it', '0 pixels apart',
      'no meeting time is cut short', 'were kept for K',
    ]) expect(seen, piece).toContain(piece)
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of [
      'K\'s decision 4, answer 1 (a)', 'At 320 pixels with no region pressed the page no longer scrolls sideways', '288 pixels wide, not 324', '"Visit club" and "Directions" sit on two rows',
      'Beauregard Parish Youth Chess, Bluebonnet Chess Club, Marrero Chess Organization, Monroe Chess Club and Morgan City Chess Club', 'From 321 to 356 pixels',
      'At every width from 357 pixels up the page is as before to the pixel', '`newClubs`, `clubKeepers`, `regionEvents`, `clubEmailHidden` and the three constants stay off',
    ]) expect(ships, piece).toContain(piece)
    expect(bullet(block, '- **The words, old and new.**')).toContain('No word changes')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('by 20 pixels again')
  })

  it('marks the one sentence it added to the block of K\'s answers, and records decision 4', () => {
    expect(marked).toHaveLength(1)
    const seenBefore = bullet(answers, '- **Seen in a browser.**')
    expect(seenBefore).toContain('507 pixels with the base\'s classes and 496 with this block\'s. Changed after K\'s second answer: ')
    for (const piece of ['the page at 320 pixels was 340 pixels wide, 20 more than the window', '324 pixels wide', 'the next block mends it']) expect(marked[0], piece).toContain(piece)
    const decision = bullet(decisions, '- **The Clubs page on a narrow phone (WS09 checkpoint S).**')
    for (const piece of ['K\'s decision 4, answer 1 (a), of Saturday, November 14, 2026, about 12:15 PM UTC: "Recommend is fine for everything."', 'ships with every switch off']) {
      expect(decision, piece).toContain(piece)
    }
    // Decision 4 follows the decisions of WS09 step 5 and, while this block is the latest, comes last.
    expect(decisions.indexOf('- **The Clubs page on a narrow phone')).toBeGreaterThan(decisions.indexOf('- **The seed writes only empty fields of known clubs (WS09 step 5).**'))
    if (latestBlock === BLOCK) expect(decisions.trim().split('\n').at(-1)?.startsWith('- **The Clubs page on a narrow phone (WS09 checkpoint S).**')).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS09 checkpoint S after K\'s second answer: the Checks line and plain language', () => {
  it('gives each figure once, and counts that add up from the base\'s', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the gate on `60267d4`\'s tree')
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    expect([num(unit![3]), Number(unit![4])]).toEqual([9243, 364])
    expect(num(unit![3]) + NEW_UNIT.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(unit![1]))
    expect(Number(unit![2]) - Number(unit![4])).toBe(NEW_UNIT.length)
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect([num(integration![1]), Number(integration![2]), num(integration![3]), Number(integration![4])]).toEqual([2260, 122, 2260, 122])
    const lint = /`npm run lint` 13 errors and (\d+) warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this block touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![3])).toBe(1008)
    expect(num(lint![2]) - num(lint![3])).toBe(NEW_UNIT.length)
    expect(bullet(block, '- **Lint.**')).toContain(`13 errors and ${lint![1]} warnings`)
    const built = /`npm run build` \((\d+) files in `dist\/assets`\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    for (const piece of [
      'a local production build', '`VITE_`', '`index-Bf0ABzl0.js`', '554,147 bytes', '`index-dZAu1zXL.css` 131,174 bytes, its name and size the base\'s', '29 more than the 13,318',
      '`features-nZCZoT6G.js` 729 bytes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(bullet(block, '- **Build.**'), piece).toContain(piece)
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what it wrote and the files it adds or changes', () => {
    const decision = bullet(decisions, '- **The Clubs page on a narrow phone (WS09 checkpoint S).**')
    const written = [block, ...marked, decision, statusLine].join('\n')
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    expect(written).not.toMatch(/\.github\//)
    const prose = proseOf(written)
    expect(prose).not.toMatch(HE)
    expect(written).not.toMatch(/\(step \d+[;),]/)
    expect(written).not.toMatch(/\bUS Chess Federation\b/)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    for (const file of [...NEW_UNIT, ...CHANGED_TESTS.map(([f]) => f)]) {
      const text = read(file)
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
    // The page holds dashes in words older than this block, so only a tool's name is read there.
    for (const rule of [TOOLS, BARE]) expect(read(PAGE), PAGE).not.toMatch(rule)
  })
})
