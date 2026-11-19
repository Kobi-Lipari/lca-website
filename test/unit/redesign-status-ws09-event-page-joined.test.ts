// test/unit/redesign-status-ws09-event-page-joined.test.ts
//
// REDESIGN_STATUS.md records the public event page's mend with main taken
// in, in the block "WS09 aside: the public event page with main taken in":
// the join of two files by hand, where the mend's own block now stands, the
// one pin moved and the checks. Like the other record tests of WS09, this
// file reads only the WS09 section, from its heading to the WS10 heading. No
// case reads or pins a switch's shipped value.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, and the two words that name a person's role in the work. */
const BANNED = new RegExp(`\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow'].join('|')})s?\\b|${'the ' + 'lead'}`, 'i')
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
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

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const REGIONS = '### WS09 aside: the regions by the five seats'
const BEFORE = '### WS09 aside: the public event page on a phone'
const BLOCK = '### WS09 aside: the public event page with main taken in'
const LISTS = '### WS09 decisions'
const block = part(BLOCK)
const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS) - 1] === BLOCK
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const MOVED = 'test/unit/redesign-status-ws09-event-page.test.ts'
/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length

describe('REDESIGN_STATUS.md, WS09 aside on the public event page with main taken in', () => {
  it('sits once, right after the mend\'s own block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(BEFORE) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS)
  })

  it('has every part, in order', () => {
    const parts = ['- **The join.**', '- **Pins moved.**', '- Checks:', '- **Branch.**']
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('names the two files joined by hand, and the section stands as the join says', () => {
    const joined = bullet(block, '- **The join.**')
    for (const piece of ['`REDESIGN_STATUS.md`', '`test/unit/redesign-status-ws09-step1.test.ts`', 'joined by hand', '"WS09 switch-on: on main\'s tree"', '"WS09 aside: the regions by the five seats"', 'No sentence of any block moved', 'No line of product moved in the join', '`src/pages/TournamentDetailPage.tsx`']) expect(joined, piece).toContain(piece)
    // The mend's own block follows the regions' block, as the join says.
    expect(headings[headings.indexOf(BEFORE) - 1]).toBe(REGIONS)
    // The Status line keeps both clauses, this aside's straight before the regions'.
    const aside = 'an aside of K\'s decision 13, the public event page on a phone with its six wordings for US Chess, is built as a small pull request of its own and waits for K\'s word; '
    const regions = 'the regions by the five seats, by K\'s decision 14,'
    expect(statusLine).toContain(`${aside}${regions}`)
    // The one line of the other file names both kinds of heading the two sides added.
    const kinds = read('test/unit/redesign-status-ws09-step1.test.ts').split('\n').filter((l) => l.includes('WS09 aside: \\S') && l.includes('WS09 switch-on: \\S'))
    expect(kinds).toHaveLength(1)
  })

  it('lists the one pin moved with its file\'s count of cases and its case\'s title', () => {
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins).toContain(`\`${MOVED}\` (${casesIn(MOVED)})`)
    const title = 'sits once, right after the clubs switch-on\\\'s block on main\\\'s tree, and before the four lists while it is the latest'
    expect(read(MOVED)).toContain(`it('${title}'`)
    expect(pins).toContain(`"${title.replace(/\\'/g, '\'')}"`)
    expect(read(MOVED)).toContain(`expect([MAIN, '${REGIONS}']).toContain(headings[headings.indexOf(BLOCK) - 1])`)
  })

  it('names each part of the full check once, the integration tests with the one todo beside them', () => {
    const checks = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'every unit test', 'with the one todo beside them', 'the browser run ', 'the stored baseline unchanged', 'the worker\'s dry run', 'The figures are in the pull request\'s text']) {
      expect(checks.split(piece), piece).toHaveLength(2)
    }
  })

  it('keeps the record\'s plain language in what it wrote', () => {
    for (const rule of [DASHES, BANNED, TOOLS, OLD_INITIALS, HE]) expect(block).not.toMatch(rule)
    for (const date of block.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/g) ?? []) {
      expect(block, date).toMatch(new RegExp(`(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), ${date}`))
    }
  })
})
