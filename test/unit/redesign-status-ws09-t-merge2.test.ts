// test/unit/redesign-status-ws09-t-merge2.test.ts
//
// REDESIGN_STATUS.md records the merge of checkpoint S's Clubs page fix into
// checkpoint T's branch in a block of its own, "WS09 checkpoint T: the Clubs
// page fix brought in", straight after the block of checkpoint T's review.
// Like the step record tests, this file reads only the WS09 section, from its
// heading to the WS10 heading, but for the conflict markers, which it looks
// for in the whole file. Pinned here: the block's place, and the fix's block
// straight after K's answers' block and before WS09 step 6's; the block's
// parts and what it says ships; no conflict marker anywhere; the page's two
// places as the fix left them; the Checks line's figures; and the
// plain-language rules. What a later block moves (the heading after this
// block, the live counts of the tests it names) is read only while this
// block is the section's latest.
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i
/** The three forms of a conflict marker at the start of a line, written by code so that this file holds none. */
const MARKERS = [
  new RegExp(`^${'<'.repeat(7)}(?: |$)`, 'm'),
  new RegExp(`^${'='.repeat(7)}$`, 'm'),
  new RegExp(`^${'>'.repeat(7)}(?: |$)`, 'm'),
]

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
const BLOCK = '### WS09 checkpoint T: the Clubs page fix brought in'
const REVIEW = '### WS09 checkpoint T: the review of the whole and its fixes'
const ANSWERS = '### WS09 checkpoint S, after K\'s answers: the roster kept back, hidden drafts and the card'
const FIX = '### WS09 checkpoint S, after K\'s second answer: the Clubs page on a narrow phone'
const STEP_6 = '### WS09 step 6: saving a listing'
const DECISIONS = '### WS09 decisions'
const block = part(BLOCK)
const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latestBlock = headings[headings.indexOf(DECISIONS) - 1] ?? ''
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''

/** The file this block adds. */
const NEW_FILE = 'test/unit/redesign-status-ws09-t-merge2.test.ts'
/** The fix's new tests, brought in by the merge, each with its count. */
const BROUGHT_IN: ReadonlyArray<readonly [string, number]> = [
  ['test/unit/clubs-page-narrow.test.tsx', 3], ['test/unit/clubs-page-narrow-css.test.tsx', 6], ['test/unit/redesign-status-ws09-s-scroll.test.ts', 11],
]
/** The tests the merge changed by hand, each with its count, which does not move. */
const CHANGED_TESTS: ReadonlyArray<readonly [string, number]> = [
  ['test/unit/redesign-status-ws09-step1.test.ts', 33], ['test/unit/redesign-status-ws09-step6.test.ts', 24],
  ['test/unit/redesign-status-ws09-step9.test.ts', 26], ['test/unit/redesign-status-ws09-t-review.test.ts', 12],
]
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,)]`).exec(files)?.[1])

describe('REDESIGN_STATUS.md, WS09 checkpoint T: the merge of checkpoint S\'s Clubs page fix', () => {
  it('sits once, right after the review\'s block, with the fix\'s block right after K\'s answers\' and before WS09 step 6\'s', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(ws09.split(`\n${FIX}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(REVIEW) + 1]).toBe(BLOCK)
    expect(headings[headings.indexOf(ANSWERS) + 1]).toBe(FIX)
    expect(headings[headings.indexOf(FIX) + 1]).toBe(STEP_6)
    // A later block is written after this one, so the heading after it is read only while this block is the latest.
    if (latestBlock === BLOCK) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(DECISIONS)
    expect(ws09.split('\n').filter((l) => l.startsWith('**Status:**'))).toHaveLength(1)
    // Read until the record says checkpoints S and T have merged, when the Status line says so instead.
    if (!ws09.includes('\n### WS09 checkpoint T: checkpoints S and T merged and live\n')) expect(statusLine).toContain('checkpoint T, steps 6 to 9, has had the review of the whole with its fixes and waits on its own branch for K\'s look at the pictures and K\'s own word;')
    expect(statusLine).toContain('K\'s second answer, the Clubs page on a narrow phone, are built.')
  })

  it('has every part, in order, and names what it brought in, what the merge needed by hand and what ships', () => {
    const parts = [
      '- **Files.**', '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this database.**', '- **What a revert leaves.**',
      '- **What ships with every switch off.**', '- **Pins moved.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const bullets = block.split('\n').filter((l) => l.startsWith('- '))
    expect(bullets[bullets.length - 1].startsWith('- Checks:')).toBe(true)
    const opening = block.split('\n')[2] ?? ''
    for (const piece of ['`402f7f0`', '`d23dda6`', 'K\'s decision 4, answer 1 (a)', 'none of the plan\'s 38 steps', 'merged by itself but this record', 'and nothing more']) {
      expect(opening, piece).toContain(piece)
    }
    const files = bullet(block, '- **Files.**')
    expect(writtenCount(files, NEW_FILE)).toBe(casesIn(NEW_FILE))
    for (const [file, n] of BROUGHT_IN) {
      expect(writtenCount(files, file), file).toBe(n)
      if (latestBlock === BLOCK) expect(casesIn(file), file).toBe(n)
    }
    const pins = bullet(block, '- **Pins moved.**')
    for (const [file, n] of CHANGED_TESTS) {
      expect(files, file).toContain(`\`${file}\` (${n}, as before`)
      expect(pins, file).toContain(`\`${file}\``)
      if (latestBlock === BLOCK) expect(casesIn(file), file).toBe(n)
    }
    expect(pins).toContain('Not moved: the pins of `test/unit/redesign-status-ws09-s-scroll.test.ts` gated on the section\'s latest block')
    expect(bullet(block, '- **What ships with every switch off.**')).toContain(
      'on a phone 320 pixels wide the public Clubs page no longer scrolls sideways and a long meeting time wraps, nothing more',
    )
  })

  it('leaves no conflict marker anywhere in the file, and the page\'s two places as the fix left them', () => {
    for (const marker of MARKERS) expect(status).not.toMatch(marker)
    const page = read('src/pages/ClubsPage.tsx')
    expect(page).toContain('<div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-6">')
    expect(page).toContain('<Calendar className="mt-0.5 size-3 flex-shrink-0 text-gold-ink" />\n              <span className="min-w-0 break-words">{club.meeting_schedule}</span>')
    expect(page).not.toMatch(/\btruncate\b/)
  })

  it('gives the Checks line\'s figures, the base\'s and counts that add up from them', () => {
    for (const piece of [
      '`npm run lint` 13 errors and 12 warnings over ', '(1,056 on the base), none in a file this merge touches', 'files in `dist/assets`, 201 on the base)',
      '`npm run typecheck:functions`', '(9,597 in 386 on the base), every one passing', '(2,371 in 131 on the base), every one passing',
      'the base\'s run 995 tests, 659 that run and 336 that skip', '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched',
      'the base\'s figures from the gate on `d23dda6`\'s tree',
    ]) expect(checksLine, piece).toContain(piece)
    expect(checksLine).not.toContain('`npm run test:a11y`')
    const unit = /unit ([\d,]+) tests in (\d+) files \(9,597 in 386 on the base\)/.exec(checksLine)
    const integration = /integration ([\d,]+) in (\d+) files \(2,371 in 131 on the base\)/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    expect(integration, 'the integration counts').not.toBeNull()
    const added = [...BROUGHT_IN.map(([, n]) => n), casesIn(NEW_FILE)].reduce((a, n) => a + n, 0)
    expect(num(unit![1])).toBe(9597 + added)
    expect(Number(unit![2])).toBe(386 + BROUGHT_IN.length + 1)
    expect([num(integration![1]), Number(integration![2])]).toEqual([2371, 131])
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files/.exec(checksLine)
    expect(num(lint![1])).toBe(1056 + BROUGHT_IN.length + 1)
    const built = /`npm run build` \((\d+) files in `dist\/assets`/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    for (const piece of ['a local production build', '`VITE_`', '`features-nZCZoT6G.js` 729 bytes', '`index-lX6U4TLf.js` on the base', '`index-Bi8fz2Bp.css` 133,867 bytes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(bullet(block, '- **Build.**'), piece).toContain(piece)
    }
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what it wrote and the file it adds', () => {
    const written = [block, statusLine].join('\n')
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
    const text = read(NEW_FILE)
    for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, NEW_FILE).not.toMatch(rule)
  })
})
