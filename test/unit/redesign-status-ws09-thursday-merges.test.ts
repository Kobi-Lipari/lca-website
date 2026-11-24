// test/unit/redesign-status-ws09-thursday-merges.test.ts
//
// REDESIGN_STATUS.md records, in the block "WS09 aside: how Thursday's
// changes reached main", that K merged the week's changes by hand on
// Thursday, November 19, 2026, what the record lost where conflicts were
// settled, and what was put back. The cases hold the block to the history
// git keeps and to the file as it stands. Like the other record tests of
// WS09, this file reads only the WS09 section, from its heading to the WS10
// heading, but for the two cases that count the whole file's sections. No
// case reads or pins a switch's shipped value.
import { execFileSync } from 'node:child_process'
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
const HELP = '### WS09 aside: Help as small question marks'
const EVENT = '### WS09 aside: the public event page on a phone'
const REGIONS = '### WS09 aside: the regions by the five seats'
const BLOCK = '### WS09 aside: how Thursday\'s changes reached main'
const LISTS = '### WS09 decisions'
const block = part(BLOCK)
const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS) - 1] === BLOCK
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
/** What git keeps, or nothing where the history is not at hand (a shallow copy of the repository). */
const git = (...args: string[]): string => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).trim()
  } catch {
    return ''
  }
}
/** The seven merges the block names, in its order: the pull request, the merge's short id and its time in UTC. */
const MERGES: Array<[number, string, string]> = [
  [140, '6257419', '12:36 PM'], [142, '5c20ff4', '12:47 PM'], [144, '886c578', '1:01 PM'], [143, '458c76f', '1:17 PM'],
  [145, '0053d7a', '1:34 PM'], [146, 'a4c4125', '4:09 PM'], [141, '07504c2', '8:19 PM'],
]

describe('REDESIGN_STATUS.md, WS09 aside on how Thursday\'s changes reached main', () => {
  it('sits once, right after Help\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(HELP) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS)
  })

  it('has every part, in order', () => {
    const parts = ['- **What happened.**', '- **The product is as it was built and checked.**', '- **What the record lost.**', '- **What is put back.**', '- **Pins moved.**', '- **What ships.**', '- Checks:', '- **Branch.**']
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('names the seven merges in the order and at the times git keeps', () => {
    const happened = bullet(block, '- **What happened.**')
    expect(happened).toContain('Thursday, November 19, 2026')
    const at = MERGES.map(([, id]) => happened.indexOf(`\`${id}\``))
    for (const [i, [pr, id, time]] of MERGES.entries()) {
      expect(at[i], id).toBeGreaterThan(-1)
      // The block writes each merge as its pull request, then its time with its id straight after.
      expect(happened, `${pr} at ${time}`).toContain(`${time} (\`${id}\`)`)
      expect(happened.slice(i === 0 ? 0 : at[i - 1], at[i]), `${pr} before ${id}`).toMatch(new RegExp(`\\b${pr}\\b`))
      // Where the history is at hand, each id is a merge of that pull request, made at that minute.
      const subject = git('log', '-1', '--format=%s', id)
      if (subject !== '') {
        expect(subject).toContain(`Merge pull request #${pr} `)
        const when = new Date(Number(git('log', '-1', '--format=%ct', id)) * 1000)
        const hour = when.getUTCHours()
        expect(`${hour % 12 === 0 ? 12 : hour % 12}:${String(when.getUTCMinutes()).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`).toBe(time)
        expect(when.toISOString().slice(0, 10)).toBe('2026-11-19')
      }
    }
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const piece of ['`bdc851c`', '`2e50add`', '`e1fb156`', '"Build and test"', 'decisions 13, 17 and 14', '`test/unit/redesign-status-ws09-step1.test.ts`']) expect(happened, piece).toContain(piece)
  })

  it('says what the record lost, with the file\'s lines as git keeps them', () => {
    const lost = bullet(block, '- **What the record lost.**')
    for (const piece of ['6,969 lines to 6,882', '6,464 lines', 'the regions\' block', 'Help\'s block', 'Help and "Add an event"', 'the bar\'s narrow form and its forms for raised text', 'the newsletter email in the Gmail phone apps', 'the Status line and the PR line', '"Phase 0: K\'s notes from the preview"', '183 cases', '15 record test files']) expect(lost, piece).toContain(piece)
    // Each count is held only where that commit is at hand.
    for (const [id, count] of [['0053d7a', 6969], ['a4c4125', 6882], ['07504c2', 6464]] as const) {
      const file = git('show', `${id}:REDESIGN_STATUS.md`)
      if (file !== '') expect(file.split('\n').length, id).toBe(count)
    }
  })

  it('finds every block the record lost back in its place, and the two rehearsal blocks not carried', () => {
    const order = [
      '### WS09 switch-on: on main\'s tree', '### WS09 switch-on: regionEvents and REGION_EVENTS_ON', '### WS09 switch-on: the approval judges the person first',
      '### WS09 switch-on: regionEvents on main\'s tree', '### WS09 switch-on: regionEvents with main taken in', REGIONS, EVENT, HELP, BLOCK,
    ]
    const at = order.map((h) => headings.indexOf(h))
    for (const [i, h] of order.entries()) expect(at[i], h).toBeGreaterThan(-1)
    expect(at).toEqual(at.map((_, i) => at[0] + i))
    for (const gone of ['### WS09 aside: the public event page with main taken in', '### WS09 aside: Help as small question marks with main taken in']) expect(headings).not.toContain(gone)
    // The other workstreams' parts the block names are back too, and the file's opening date is not the old one.
    for (const heading of [
      '## Phase 0: K\'s notes from the preview', '### WS16 part two: the newsletter\'s own page', '#### WS16 part two, page step 5, third part: Help and "Add an event"',
      '#### WS16 part two, page step 5, third part: the bar\'s narrow form and its forms for raised text', '#### WS16 part two: the newsletter email in the Gmail phone apps',
    ]) expect(status, heading).toContain(`\n${heading}\n`)
    expect(status).not.toContain('Last updated: 2026-11-13')
    // The two entries under the deviations and the PR line's clause are back.
    const deviations = part('### WS09 deviations from the brief')
    for (const entry of ['- **The brief\'s tables keep the seven regions (WS09 regions by seat).**', '- **An observer\'s marks are spans (WS09 aside: Help as small question marks).**']) expect(deviations, entry).toContain(`\n${entry}`)
    expect(ws09.split('\n').find((l) => l.startsWith('**PR:**')) ?? '').toContain('the switch-on of `regionEvents` and `REGION_EVENTS_ON` is built after it')
    // Where the history is at hand, every heading this section held before the two conflicts is in it today.
    const before = git('show', '0053d7a:REDESIGN_STATUS.md')
    if (before !== '') {
      const then = between(before, '\n## WS09: Clubs as living listings\n', '\n## WS10:').split('\n').filter((l) => l.startsWith('### '))
      expect(then.length).toBeGreaterThan(40)
      for (const heading of then) expect(headings, heading).toContain(heading)
    }
    const back = bullet(block, '- **What is put back.**')
    for (const piece of ['taken whole', 'word for word', 'no sentence of any earlier block is rewritten', 'not carried', 'the Status line gains one clause']) expect(back, piece).toContain(piece)
  })

  it('lists the pins moved with each file\'s count of cases, and the files hold what it says', () => {
    const pins = bullet(block, '- **Pins moved.**')
    const moved: Array<[string, string, string]> = [
      ['test/unit/redesign-status-ws09-event-page.test.ts', 'sits once, right after the clubs switch-on\\\'s block on main\\\'s tree, and before the four lists while it is the latest', `expect([MAIN, '${REGIONS}']).toContain(headings[headings.indexOf(BLOCK) - 1])`],
      ['test/unit/redesign-status-ws09-help-marks.test.ts', 'sits once, right after the block before it, and before the four lists while it is the latest', `expect([BEFORE, '${EVENT}']).toContain(headings[headings.indexOf(BLOCK) - 1])`],
    ]
    for (const [file, title, line] of moved) {
      expect(pins).toContain(`\`${file}\` (${casesIn(file)})`)
      expect(read(file)).toContain(`it('${title}'`)
      expect(pins).toContain(`"${title.replace(/\\'/g, '\'')}"`)
      expect(read(file)).toContain(line)
    }
    const step1 = 'test/unit/redesign-status-ws09-step1.test.ts'
    expect(pins).toContain(`\`${step1}\` (${casesIn(step1)})`)
    expect(read(step1).split('\n').filter((l) => l.includes('|WS09 aside: \\S|') && l.includes('|WS09 switch-on: \\S|'))).toHaveLength(1)
  })

  it('moves the Status line by one clause, before the clauses written while each change waited', () => {
    const clause = 'K merged the club events switch-on, the regions by the five seats, Help as small question marks and the public event page\'s mend into `main` by hand on Thursday, November 19, 2026, so the clauses of this line that say one of them waits for K\'s word stand as they were written before that day, and the block on how Thursday\'s changes reached `main` says what happened; an aside of K\'s decision 13,'
    expect(statusLine).toContain(clause)
    expect(statusLine).toMatch(/\bbuilt\.$/)
  })

  it('says what ships and names each part of the full check once', () => {
    const ships = bullet(block, '- **What ships.**')
    for (const piece of ['no product file, no migration, no switch', 'Pull request 147', '`functions/utils/admin/permissions.ts`']) expect(ships, piece).toContain(piece)
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
