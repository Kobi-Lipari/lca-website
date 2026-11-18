// test/unit/redesign-status-ws09-switch-on-approval-order.test.ts
//
// REDESIGN_STATUS.md records the mend the switch-on of regionEvents
// uncovered, in the block "WS09 switch-on: the approval judges the person
// first": POST /api/admin/tournaments/[id]/approval judges the person before
// it reads the body. Like the other record tests of WS09, this file reads
// only the WS09 section, from its heading to the WS10 heading. Pinned here:
// the block, right after the switch-on of regionEvents and before the four
// lists while it is the section's latest; its opening and its parts in
// order; the rule and its order against the handler; what does not change,
// with the tests each line names; the sweep back as it was; the pins moved
// and their files' counts of cases; the follow-up closed in the block; what the
// merge carries; the Status line; the figures of the Checks line; and the
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
/** The source with its comments taken out, so a rule is found by its code alone. */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** A string constant of a file, as written there, its escaped quotes read back. */
const constant = (file: string, name: string) => new RegExp(`export const ${name} = '((?:[^'\\\\]|\\\\.)*)'`).exec(read(file))?.[1].replace(/\\'/g, '\'')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const REGION = '### WS09 switch-on: regionEvents and REGION_EVENTS_ON'
const BLOCK = '### WS09 switch-on: the approval judges the person first'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === BLOCK
const followUps = ws09.slice(ws09.indexOf('\n### WS09 follow-ups\n') + 1)

const SELF = 'test/unit/redesign-status-ws09-switch-on-approval-order.test.ts'
const HANDLER = 'functions/api/admin/tournaments/[id]/approval.ts'
const TABLE = 'test/integration/approval-judges-first.test.ts'
const SWEEP = 'test/integration/media-manager-reach.test.ts'
const REGION_TEST = 'test/unit/redesign-status-ws09-switch-on-region.test.ts'
/** The follow-up the switch-on of regionEvents wrote, by its title. */
const FOLLOW_UP = 'The approval endpoint reads its body before it judges the person (WS09 switch-on of regionEvents).'
/** The approval's tests from before this step, which pass untouched. */
const UNTOUCHED = [
  'test/integration/approval-edges.test.ts', 'test/integration/approval-submit-bound.test.ts', 'test/integration/club-events.test.ts',
  'test/integration/contracts/tournament-approval.test.ts', 'test/integration/region-events-by-person.test.ts', 'test/integration/role-safety.test.ts',
]

/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length

describe('REDESIGN_STATUS.md, WS09 switch-on of the approval\'s order: the block', () => {
  it('sits once, right after the switch-on of regionEvents, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(REGION) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
    expect(read('test/unit/redesign-status-ws09-step1.test.ts')).toContain('|WS09 switch-on: \\S|')
  })

  it('opens with why, in two sentences: what the switch-on uncovered, and the same pull request', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of ['The switch-on of `regionEvents` uncovered', 'read its body before it judged the person', 'in the same pull request', 'never ships with an exception']) {
      expect(opening, piece).toContain(piece)
    }
    expect(opening.split(/\.(?: |$)/).filter(Boolean)).toHaveLength(2)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **What changes.**', '- **What does not change.**', '- **How.**', '- **The sweep.**', '- **Pins moved.**', '- **The follow-up closed.**',
      '- **What the merge carries.**', '- Checks:', '- **Files.**', '- **Branch.**',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of the approval\'s order: against the files', () => {
  const handler = code(read(HANDLER))
  const post = between(handler, 'export const onRequestPost', '\n}\n')

  it('gives the rule by who the person is, each line naming the test that holds it', () => {
    const changes = bullet(block, '- **What changes.**')
    const people = changes.split('\n').filter((l) => l.startsWith('  - '))
    expect(people).toHaveLength(3)
    for (const line of people) expect(line, line.slice(4, 40)).toContain(`\`${TABLE}\``)
    for (const piece of [
      '403 "Forbidden"', 'an empty object, an unknown action, a value that is not an object, Ask for changes with no note and Ask for changes with a note over 500 characters',
      'a media manager', 'a plain member', 'a guest', 'a director', 'a representative of another region', 'everyone signed in but an LCA admin',
      'Nothing is written, nothing is sent, no submit is counted', 'the words they get for a submit',
    ]) expect(changes, piece).toContain(piece)
    expect(existsSync(join(ROOT, TABLE))).toBe(true)
    const table = read(TABLE)
    expect(table).toContain('const MOVED: Array<{ event: EventKind; people: readonly Person[]; bodies: readonly Body[]; to: Key }> = [')
    expect(table).toContain('describe(\'the approval with REGION_EVENTS_ON set: the cells that must not move\', () => {')
    expect(table).toContain('describe(\'the approval with REGION_EVENTS_ON set: the cells that moved\', () => {')
  })

  it('says what does not change, in the handler\'s own words, each test it names there and untouched', () => {
    const kept = bullet(block, '- **What does not change.**')
    for (const piece of [
      'Every answer to a body the endpoint takes', 'status, words and effects', `403 "${constant(HANDLER, 'APPROVAL_CLOSED')}"`, 'before anything is read',
      '404 "Tournament not found"', '401 "Unauthorized"', 'with or without the second factor', 'five submits a person in 24 hours',
      'No page, email, contract, migration or style changes',
    ]) expect(kept, piece).toContain(piece)
    for (const file of UNTOUCHED) {
      expect(kept, file).toContain(`\`${file}\``)
      expect(existsSync(join(ROOT, file)), file).toBe(true)
    }
    expect(handler).toContain('export const SUBMITS_A_DAY = 5')
  })

  it('gives the order before and after, with the one judgement of a submit called once and nothing written twice', () => {
    const how = bullet(block, '- **How.**')
    for (const piece of ['Before:', 'After:', '`draftedInRegion`', '`functions/utils/events/creation.ts`', 'called once', 'no rule is written twice', 'no new kind of query']) {
      expect(how, piece).toContain(piece)
    }
    const order = ['requireAuthedMember(', 'await draftedInRegion(', 'parseBody(', 'requireAdmin(', 'event ??= await readEvent(db, tournamentId)', 'settled(body.action, approvalState(event), event)', 'submitsInLastDay(db, member.id)']
    const at = order.map((piece) => post.indexOf(piece))
    for (const [i, piece] of order.entries()) expect(at[i], piece).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(post.match(/draftedInRegion\(/g)).toHaveLength(1)
    expect(post).toContain("if (member.role !== 'lca_admin') {\n    event = await readEvent(db, tournamentId)")
    expect(read(HANDLER)).toContain('// While it is set the checks run in this order: the sign in; then, for')
  })

  it('puts the sweep back as it was, with its four cases and no switch of this workstream in it', () => {
    const sweep = bullet(block, '- **The sweep.**')
    for (const piece of [`\`${SWEEP}\``, 'byte for byte', '`71cc235`', 'passes as it stands', 'whatever the method, the address or the body']) {
      expect(sweep, piece).toContain(piece)
    }
    const text = read(SWEEP)
    expect(casesIn(SWEEP)).toBe(4)
    expect(text).not.toMatch(/REGION_EVENTS_ON|clubs\/pages/)
  })

  it('names every pin moved, with its file\'s count of cases as the file holds it', () => {
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins).toContain(`\`${REGION_TEST}\` (25)`)
    expect(casesIn(REGION_TEST)).toBe(25)
    expect(pins).toContain('"moves the media manager\'s sweep to the on state with the off state beside it, and waits for the focus in the timing case"')
    expect(read(REGION_TEST).match(/^ {4}expect\(sweep\)\.not\.toContain\(/gm)).toHaveLength(3)
    expect(pins).toContain(`\`${SWEEP}\` (4)`)
  })

  it('closes the follow-up in the block, in the lists\' own words, leaving the switch-on\'s own words as written', () => {
    const closed = bullet(block, '- **The follow-up closed.**')
    expect(closed).toContain(`"${FOLLOW_UP}"`)
    expect(closed).toContain('Closed in the block "WS09 switch-on: the approval judges the person first":')
    // The lists' entries each carry a step's or a checkpoint's tag, so the follow-up has no entry there.
    expect(followUps).not.toContain(FOLLOW_UP)
    expect(part(REGION)).toContain(`That order in the endpoint is a follow-up for when the lists are next opened, "${FOLLOW_UP}"`)
  })


  it('says what the merge carries: one handler\'s order, the worker byte for byte and the site unmoved', () => {
    const carries = bullet(block, '- **What the merge carries.**')
    for (const piece of [
      '76.61 KiB, gzip 20.53 KiB', '78,449 bytes', '`60caafa9f2090793aea06d2123c38257526bc91ff6fbafc4ace8625120eee47d`', 'byte for byte the base\'s',
      '`index-D25gfptl.js` 558,793 bytes', '`index-B9z7qSj6.css` 134,857 bytes', '`features-JuKfa3EC.js` 729 bytes', 'none of the Pages build\'s `VITE_` values',
    ]) expect(carries, piece).toContain(piece)
  })

  it('names the rehearsal branch and the later pick', () => {
    const branch = bullet(block, '- **Branch.**')
    for (const piece of ['`redesign/ws09-keepers-on-build`', '`de7ab36`', 'with the commit before it', 'a branch cut from `main`']) expect(branch, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of the approval\'s order: the Status line and the Checks line', () => {
  it('gives the Status line its tail while this block is the latest, with no merge that has not happened', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) expect(tail).toContain('the mend that has the approval judge the person before it reads the body is built straight after it on the same branch and goes in its pull request')
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(statusLine).not.toMatch(/switch-on[^;]*\bmerged\b/)
  })

  it('gives each figure once, the counts adding up to the base\'s and the two new files', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run in this build']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    const files = bullet(block, '- **Files.**')
    const written = Number(new RegExp(`\`${escape(SELF)}\` \\((\\d+): `).exec(files)?.[1])
    expect(written).toBe(casesIn(SELF))
    const table = Number(new RegExp(`\`${escape(TABLE)}\` \\((\\d+) as the suite runs them`).exec(files)?.[1])
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    expect([num(unit![3]), Number(unit![4])]).toEqual([10604, 451])
    expect(num(unit![3]) + written).toBe(num(unit![1]))
    expect(Number(unit![2]) - Number(unit![4])).toBe(1)
    const integration = /integration ([\d,]+) tests that run in (\d+) files, with the one todo beside them \(([\d,]+) in (\d+) files and the one todo on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect([num(integration![3]), Number(integration![4])]).toEqual([2821, 156])
    expect(num(integration![3]) + table).toBe(num(integration![1]))
    expect(Number(integration![2]) - Number(integration![4])).toBe(1)
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![1]) - num(lint![2])).toBe(2)
    expect(checksLine).toContain('the main script `index-D25gfptl.js` 558,793 bytes')
    expect(checksLine).not.toContain('`npm run test:a11y`')
  })
})

describe('REDESIGN_STATUS.md, WS09 switch-on of the approval\'s order: plain language', () => {
  const written = [block, statusLine].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the block wrote, and dates in their plain form', () => {
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

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of this file, the new table and the handler', () => {
    for (const file of [SELF, TABLE, HANDLER]) {
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(read(file), file).not.toMatch(rule)
    }
  })
})
