// test/unit/redesign-status-ws09-t-merge.test.ts
//
// REDESIGN_STATUS.md records the merge of checkpoint S's answers into
// checkpoint T's branch in a block of its own, "WS09 checkpoint T:
// checkpoint S's answers brought in", straight after WS09 step 8's block.
// Like the step record tests, this file reads only the WS09 section, from
// its heading to the WS10 heading, but for the conflict markers, which it
// looks for in the whole file. Pinned here: the section's blocks in the
// order the work was made on each checkpoint; the block's parts; no conflict
// marker anywhere; the key rosterKeptBack in the club's answer and in its
// contract; the five earlier lines this merge made untrue (the three
// follow-ups on items R3 and R4, WS09 step 6's bullet on what ships and WS09
// step 7's decision on the editor), their words kept and one marked sentence
// added to each; the Checks line's figures; and the plain-language rules.
// What a later step moves (the Status line's tail, the section's whole list
// of headings, the live counts of the changed tests and the page's line 412)
// is read only while WS09 step 8 is the latest step.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { adminClubResponseSchema } from '../../domain/contracts/clubs'

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
const BLOCK = '### WS09 checkpoint T: checkpoint S\'s answers brought in'
const block = part(BLOCK)
/** The section's headings in the order the work was made on each checkpoint. */
const ORDER = [
  '### WS09 map: what proves each acceptance criterion and decision',
  '### WS09 step 1: the record and a named public answer',
  '### WS09 step 2: the switches and the preview bucket',
  '### WS09 step 3: the regions fill',
  '### WS09 step 4: the club tables and the slug rule',
  '### WS09 step 5: the seed on today\'s clubs',
  '### WS09 checkpoint S, after K\'s answers: the roster kept back, hidden drafts and the card',
  '### WS09 step 6: saving a listing',
  '### WS09 step 7: the editor, basics first',
  '### WS09 step 8: the rest of the editor and its previews',
  BLOCK,
  '### WS09 decisions',
  '### WS09 deviations from the brief',
  '### WS09 verify items resolved',
  '### WS09 follow-ups',
]
const followUps = ws09.slice(ws09.indexOf('\n### WS09 follow-ups\n') + 1)
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))

const MARK = 'Changed after K\'s answers: '
/** The three follow-ups on items R3 and R4, each with the words it held before this merge. */
const R3_R4: ReadonlyArray<readonly [string, string]> = [
  ['- **Items R3 and R4 stay with K (WS09 step 6).** ', 'Whether a person admitted by the region alone keeps the hidden drafts in the GET\'s answer and may remove an officer is still K\'s to answer; this step leaves both exactly as they stand, the GET\'s events query included.'],
  ['- **Items R3 and R4 stay with K (WS09 step 7).** ', 'The Roster and officers tab, its words and its Remove buttons, and the sentences on the profile page and in Board seats that name officers are untouched by this step and still wait for K.'],
  ['- **Items R3 and R4 stay with K (WS09 step 8).** ', 'The Roster and officers tab and the sentences that name officers are untouched by this step and still wait for K.'],
]
const followUpLine = (start: string) => followUps.split('\n').find((l) => l.startsWith(start)) ?? ''
/** The two other lines this merge marks, each with the words it held before this merge ended and what the marked sentence says. */
const OTHERS: ReadonlyArray<readonly [string, string, string, readonly string[]]> = [
  [
    '### WS09 step 6: saving a listing', '- **What ships with every switch off.** ',
    'No switch is added; `newClubs`, `clubKeepers`, `regionEvents`, `clubEmailHidden` and the three constants stay off.',
    ['checkpoint S\'s answer, `rosterKeptBack: true` after the roster and no hidden draft', '`baseRegionAloneAnswer`', 'the answer is the base\'s, as before'],
  ],
  [
    '### WS09 decisions', '- **The editor in place of today\'s form (WS09 step 7).** ',
    'and the Roster and officers tab\'s words and Remove buttons stay as they are while they wait for K.',
    ['the Roster and officers tab is checkpoint S\'s', 'shows no Remove button', 'for everyone else it is as before'],
  ],
]
const otherLine = (heading: string, start: string) => part(heading).split('\n').find((l) => l.startsWith(start)) ?? ''
const added = (line: string) => (line.includes(MARK) ? line.slice(line.indexOf(MARK)) : '')

/** The files this block adds. */
const NEW_FILES = ['test/integration/club-roster-kept-back-keepers.test.ts', 'test/unit/redesign-status-ws09-t-merge.test.ts']
/** The tests this block changes by hand, each with its count, which does not move. */
const CHANGED_TESTS: ReadonlyArray<readonly [string, number]> = [
  ['test/integration/contracts/admin-clubs.test.ts', 12], ['test/integration/club-permissions.test.ts', 35], ['test/integration/club-save.test.ts', 18],
  ['test/unit/redesign-status-ws09-s-answers.test.ts', 14], ['test/unit/redesign-status-ws09-step1.test.ts', 33],
  ['test/unit/redesign-status-ws09-step6.test.ts', 24], ['test/unit/redesign-status-ws09-step8.test.ts', 26],
]
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])

describe('REDESIGN_STATUS.md, WS09 checkpoint T: the merge of checkpoint S\'s answers', () => {
  it('sits once, right after WS09 step 8\'s block, with the section\'s blocks in the order the work was made and the Status line true of the merged tree', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
    // A later step writes its block after this one, so the whole list is read only while WS09 step 8 is the latest.
    if (latestStep === 8) expect(headings).toEqual(ORDER)
    expect(headings[headings.indexOf(ORDER[ORDER.indexOf(BLOCK) - 1]) + 1]).toBe(BLOCK)
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestStep === 8) expect(tail).toBe('checkpoint S waits for its pull request; checkpoint T has begun on its own branch; steps 1 to 8 and K\'s answers to checkpoint S\'s review are built.')
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(ws09.split('\n').filter((l) => l.startsWith('**Status:**'))).toHaveLength(1)
  })

  it('has every part, in order, and names what it brought in and what the merge needed by hand', () => {
    const parts = [
      '- **Files.**', '- **The key in the answer.**', '- **The contract.**', '- **The branch.**', '- **What the merge does.**',
      '- **What `main`\'s code does on this database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**',
      '- **Pins moved.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const opening = block.split('\n')[2] ?? ''
    for (const piece of ['`60267d4`', '`71e744c`', 'merged by itself but this record', 'and nothing more']) expect(opening, piece).toContain(piece)
    const files = bullet(block, '- **Files.**')
    for (const file of NEW_FILES) expect(writtenCount(files, file), file).toBe(casesIn(file))
    for (const [file, n] of CHANGED_TESTS) {
      expect(files, file).toContain(`\`${file}\` (${n}, as before`)
      // A later step may add cases to these files, so their live counts are read only while WS09 step 8 is the latest.
      if (latestStep === 8) expect(casesIn(file), file).toBe(n)
    }
    const pins = bullet(block, '- **Pins moved.**')
    for (const [file] of CHANGED_TESTS.slice(1)) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('Not moved: `test/unit/goldText.test.ts`')
    // A later change to the page moves its line 412, so the two pins by line are read only while WS09 step 8 is the latest.
    if (latestStep === 8) {
      expect(read('test/unit/goldText.test.ts')).toContain('\'src/pages/AdminClubPage.tsx:412 the style colour color: clubTextColor(color) -> light\'')
      expect(read('src/pages/AdminClubPage.tsx').split('\n')[411]).toContain('color: clubTextColor(color),')
    }
    expect(bullet(block, '- **What ships with every switch off.**')).toContain('The same as on checkpoint S\'s branch after K\'s answers, nothing more')
  })

  it('leaves no conflict marker anywhere in the file', () => {
    for (const marker of MARKERS) expect(status).not.toMatch(marker)
  })

  it('answers the key rosterKeptBack in both of the GET\'s answers and names it in the contract as an optional true', () => {
    const get = read('functions/api/admin/clubs/[id].ts')
    const answer = between(get, '  const answer = {\n', '  }\n')
    const key = '    ...(regionAlone ? { rosterKeptBack: true } : {}),\n'
    expect(answer).toContain(key)
    expect(answer.indexOf('    roster: roster.results,\n')).toBeLessThan(answer.indexOf(key))
    expect(answer.indexOf(key)).toBeLessThan(answer.indexOf('    tournaments: tournaments.results,\n'))
    expect(get).toContain('  if (!CLUB_KEEPERS_ON) return jsonResponse(answer)\n')
    expect(get).toContain('  return jsonResponse({\n    ...answer,\n')
    expect(get.match(/rosterKeptBack/g)).toHaveLength(1)
    const contract = between(read('domain/contracts/clubs.ts'), 'export const adminClubResponseSchema = z.strictObject({', '\n})\n')
    expect(contract).toContain('  rosterKeptBack: z.literal(true).optional(),\n  tournaments: ')
    const shape = adminClubResponseSchema.shape.rosterKeptBack
    expect(shape.safeParse(true).success).toBe(true)
    expect(shape.safeParse(undefined).success).toBe(true)
    for (const wrong of [false, 1, 'true', null]) expect(shape.safeParse(wrong).success, String(wrong)).toBe(false)
    const tests = read('test/integration/contracts/admin-clubs.test.ts')
    expect(tests).toContain('expect(\'rosterKeptBack\' in body, `${who} ${on}`).toBe(who === holder)')
    expect(tests).toContain('expect(text, who).not.toContain(\'rosterKeptBack\')')
  })

  it('keeps the words of the five lines it made untrue, the three follow-ups on items R3 and R4 among them, adds one marked sentence to each, and gives the Checks line\'s figures', () => {
    for (const [start, words] of R3_R4) {
      const line = followUpLine(start)
      expect(line.startsWith(`${start}${words} ${MARK}`), start).toBe(true)
      expect(line.split(MARK), start).toHaveLength(2)
      expect(added(line), start).toContain('K answered on Saturday, November 14, 2026')
      expect(added(line), start).toContain('on this branch')
    }
    for (const [heading, start, ending, pieces] of OTHERS) {
      const line = otherLine(heading, start)
      expect(line.startsWith(start), start).toBe(true)
      expect(line.split(MARK), start).toHaveLength(2)
      expect(line.slice(0, line.indexOf(MARK)), start).toBe(`${line.slice(0, line.indexOf(ending))}${ending} `)
      expect(added(line), start).toContain('K answered on Saturday, November 14, 2026, in K\'s decision 3, answer 2 (a), and on this branch')
      for (const piece of pieces) expect(added(line), `${start}${piece}`).toContain(piece)
    }
    // Exactly these five lines carry this merge's mark beside the 17 checkpoint S's block marked, which its own record test holds.
    const marks = ws09.split('\n').filter((l) => l.includes(MARK))
    const ours = [...R3_R4.map(([start]) => followUpLine(start)), ...OTHERS.map(([heading, start]) => otherLine(heading, start))]
    for (const line of ours) expect(marks, line.slice(0, 60)).toContain(line)
    expect(marks).toHaveLength(17 + ours.length)
    expect(ours).toHaveLength(5)
    for (const piece of [
      '`npm run lint` 13 errors and 12 warnings over ', '(1,033 on the base), none in a file this merge touches', 'files in `dist/assets`, 198 on the base)',
      '`npm run typecheck:functions`', '(9,429 in 371 on the base), every one passing', '(2,320 in 124 on the base), every one passing',
      'the base\'s run 995 tests, 659 that run and 336 that skip', '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched',
      'the base\'s figures from the gate on `71e744c`\'s tree',
    ]) expect(checksLine, piece).toContain(piece)
    expect(checksLine).not.toContain('`npm run test:a11y`')
    const unit = /unit ([\d,]+) tests in (\d+) files \(9,429 in 371 on the base\)/.exec(checksLine)
    const integration = /integration ([\d,]+) in (\d+) files \(2,320 in 124 on the base\)/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    expect(integration, 'the integration counts').not.toBeNull()
    expect(num(unit![1])).toBeGreaterThan(9429)
    expect(Number(unit![2])).toBe(371 + 5)
    expect(Number(integration![2])).toBe(124 + 3)
    const built = /`npm run build` \((\d+) files in `dist\/assets`/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    for (const piece of ['a local production build', '`VITE_`', '`features-', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(bullet(block, '- **Build.**'), piece).toContain(piece)
    }
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what it wrote and the files it adds', () => {
    const written = [block, ...R3_R4.map(([start]) => added(followUpLine(start))), ...OTHERS.map(([heading, start]) => added(otherLine(heading, start))), statusLine].join('\n')
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    expect(written).not.toMatch(/\.github\//)
    const prose = proseOf(written)
    expect(prose).not.toMatch(HE)
    expect(written).not.toMatch(/\(step \d+[;),]/)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    expect(written).not.toMatch(/\bUS Chess Federation\b/)
    for (const file of [...NEW_FILES, 'domain/contracts/clubs.ts']) {
      const text = read(file)
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })
})
