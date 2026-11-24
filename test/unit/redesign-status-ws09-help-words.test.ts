// test/unit/redesign-status-ws09-help-words.test.ts
//
// REDESIGN_STATUS.md records the question marks' new words, by K's note of
// Thursday, November 19, 2026, in the block "WS09 aside: the question
// marks' words". This file holds the block to the tree: K's note as written,
// the words and their fixture, the one case of K's rule, what a person
// meets, what ships, the pins moved, the one entry under the deviations, the
// two follow-ups, the Status line's clause and the checks. Like the other
// record tests of WS09, it reads only the WS09 section, from its heading to
// the WS10 heading. No case reads or pins a switch's shipped value.
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
const BEFORE = '### WS09 aside: how Thursday\'s changes reached main'
const BLOCK = '### WS09 aside: the question marks\' words'
const LISTS = '### WS09 decisions'
const block = part(BLOCK)
const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS) - 1] === BLOCK
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const TAG = '(WS09 aside: the question marks\' words).'
const tagged = (list: string) => part(list).split('\n').filter((l) => l.startsWith('- **') && l.includes(`${TAG}**`))
const deviations = tagged('### WS09 deviations from the brief')
const followUps = tagged('### WS09 follow-ups')
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
/** A test file's cases as vitest counts them: each plain `it(`. */
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length

const EDITOR_HELP = read('src/areas/clubs/components/EditorHelp.tsx')
const REGION_HELP = read('src/areas/clubs/components/RegionHelp.tsx')
const EDITOR_TEST = 'test/unit/help-marks-editor.test.tsx'
const K_NOTE = '"never make references to how the pages are built or may change in the back end. only keep their practical experience in mind with no fluff or distracting info that is not pertinant to their use."'

describe('REDESIGN_STATUS.md, WS09 aside: the question marks\' words', () => {
  it('sits once, right after the block on Thursday\'s merges, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(BLOCK) - 1]).toBe(BEFORE)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS)
  })

  it('opens with why in K\'s own words, quoted once, and has every part in order', () => {
    const opening = block.split('\n')[2]
    expect(opening).toContain(`wrote on Thursday, November 19, 2026 that their words must ${K_NOTE}`)
    expect(block.split(K_NOTE)).toHaveLength(2)
    const parts = [
      '- **The words.**', '- **K\'s rule, held.**', '- **What a person meets.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- Checks:', '- **Files.**', '- **Branch.**',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('says how many entries changed, where the whole list stands, which forms follow a switch, and the two sentences that say more than today\'s page shows', () => {
    const words = bullet(block, '- **The words.**')
    for (const piece of [
      'the editor\'s thirteen entries in each of its sixteen variants', 'My region\'s seven in both of its variants', '`test/unit/fixtures/help-words.json`, written from that list and not from the code',
      '`test/unit/fixtures/help-words-before.json`, the old list, stays as it was', 'follows `clubEmailHidden`', 'follows the new club pages (`clubPagesOn`)', '`club.color || LCA_GOLD`',
      'The contact name\'s term follows the new club pages', 'Save and publish\'s first sentence', 'and Preview\'s are true of the new club pages and say more than today\'s page shows', 'the bubble says "LCA can reach the club at this address."', 'the bubble says "Only My region shows when a club was checked."',
    ]) expect(words, piece).toContain(piece)
    const fixture = JSON.parse(read('test/unit/fixtures/help-words.json')) as { editor: Record<string, Array<[string, string]>>; region: Record<string, Array<[string, string]>> }
    expect(Object.keys(fixture.editor)).toHaveLength(16)
    expect(Object.keys(fixture.region)).toHaveLength(2)
    for (const list of Object.values(fixture.editor)) expect([12, 13]).toContain(list.length)
    for (const list of Object.values(fixture.region)) expect(list).toHaveLength(7)
    const before = JSON.parse(read('test/unit/fixtures/help-words-before.json')) as { editor: Record<string, unknown[]> }
    expect(Object.keys(before.editor)).toHaveLength(16)
    // The two forms that follow a switch, and the colors today's pages draw.
    expect(EDITOR_HELP).toContain('emailHidden\n        ? \'LCA can reach the club at this address. Visitors never see it.\'')
    expect(EDITOR_HELP).toContain('A club with none shows navy.')
    expect(EDITOR_HELP).toContain('A club with none shows LCA\\\'s gold.')
    expect(EDITOR_HELP).not.toContain('addressCardName')
    for (const page of ['src/pages/ClubDetailPage.tsx', 'src/pages/ClubsPage.tsx']) expect(read(page), page).toContain('club.color || LCA_GOLD')
  })

  it('names the one case of K\'s rule, as the test file holds it, and what it refuses', () => {
    const rule = bullet(block, '- **K\'s rule, held.**')
    const title = 'keeps K\'s rule in every sentence of every bubble, the editor\'s sixteen variants and My region\'s two: nothing of how the pages are made or of what may change, and none over 300 characters'
    expect(rule).toContain(`"${title}"`)
    expect(read(EDITOR_TEST)).toContain(`it('${title.replace(/'/g, '\\\'')}'`)
    for (const words of ['today\'s', 'once the', 'new club pages', 'older form', 'will show', 'will be', 'not yet', 'switch', 'is drawn', 'is used once']) {
      expect(rule, words).toContain(`"${words}"`)
      expect(read(EDITOR_TEST), words).toContain(`'${words.replace(/'/g, '\\\'')}'`)
    }
    expect(rule).toContain('longer than 300 characters')
  })

  it('says only words change, every mark where it was, and that it ships behind no switch and waits for K', () => {
    const meets = bullet(block, '- **What a person meets.**')
    for (const piece of ['Words only.', 'Every mark stands where it stood', '`HelpMark.tsx` and `helpMarks.ts` are as they were']) expect(meets, piece).toContain(piece)
    // My region's three marks keep their names and their entries, as the closed record test reads them.
    for (const line of [
      'month: { name: \'This month\', terms: [\'The monthly check\', \'The 90 days\'] },',
      'confirmAll: { name: \'Confirm all still accurate\', terms: [\'Confirm all still accurate\'] },',
      'clubs: { name: \'Clubs\', terms: [\'What this page is\', \'Still accurate\', \'Open\', \'Who sees the stamps\'] },',
    ]) expect(REGION_HELP).toContain(line)
    expect(EDITOR_HELP).toContain('if (part === \'logo\') return \'Logo\'')
    expect(EDITOR_HELP).toContain('if (part === \'color\') return \'Club color\'')
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['behind no switch', 'the day it merges', 'waits for K\'s own word']) expect(ships, piece).toContain(piece)
    for (const file of ['src/areas/clubs/components/EditorHelp.tsx', 'src/areas/clubs/components/RegionHelp.tsx']) expect(read(file), file).not.toMatch(/FEATURES|features'/)
  })

  it('lists every pin moved with its file, its count of cases and its titles, each as the file holds it', () => {
    const pins = bullet(block, '- **Pins moved.**')
    const listed = [...pins.matchAll(/^ {2}- `(test\/unit\/[^`]+)` \((\d+)\)/gm)].map((m) => [m[1], Number(m[2])] as const)
    expect(listed.map(([file]) => file)).toEqual([
      EDITOR_TEST, 'test/unit/help-marks-region.test.tsx', 'test/unit/club-editor.test.tsx', 'test/unit/club-editor-pictures.test.tsx', 'test/unit/club-review-leftovers.test.tsx',
      'test/unit/club-editor-review.test.tsx', 'test/unit/club-editor-phone-words.test.tsx', 'test/unit/my-region-edges.test.tsx', 'test/unit/my-region-page.test.tsx',
      'test/unit/redesign-status-ws09-step8.test.ts', 'test/unit/redesign-status-ws09-t-review.test.ts', 'test/unit/redesign-status-ws09-help-marks.test.ts',
      'test/unit/redesign-status-ws09-step1.test.ts', 'test/unit/redesign-status-ws09-event-page.test.ts',
    ])
    for (const [file, count] of listed) expect(casesIn(file), file).toBe(count)
    expect(pins).toContain('goes from 6 cases to 7')
    for (const [file, title] of [
      [EDITOR_TEST, 'holds every sentence of K\'s new list, word for word, in each of the sixteen variants of the words, and no other'],
      ['test/unit/club-editor.test.tsx', 'the contact name\'s label promises a page shows the contact name only once the new club pages are on, and Help\'s mark is named as the label is'],
      ['test/unit/club-editor-pictures.test.tsx', 'says the page\'s web address stays when the club is renamed, and who may change it, in the same words with the new club pages off and on'],
      ['test/unit/club-review-leftovers.test.tsx', 'says the city shows under the name and helps people find a club near them, in the same words with the new pages off and on'],
      ['test/unit/club-editor-review.test.tsx', 'says the cost, who is welcome, the two ticks, the links, Save and publish and the previews in the same words with the new club pages off and on, and says none of them wait for those pages'],
      ['test/unit/my-region-edges.test.tsx', 'names the seat holder\'s region and every region for an LCA admin, in Help, never "your region" for the admin'],
      ['test/unit/redesign-status-ws09-step8.test.ts', 'says one press is still one save, the logo is today\'s upload, and Help holds the new words'],
    ]) {
      expect(pins, title).toContain(`"${title}"`)
      expect(read(file), file).toContain(`it('${title.replace(/'/g, '\\\'')}'`)
    }
    expect(read('test/unit/help-marks-region.test.tsx')).toContain('holds every sentence of K\'s new list, word for word, for ${role === \'member\' ? \'a representative\' : \'an LCA admin\'}, and no other')
    expect(read('test/unit/redesign-status-ws09-help-marks.test.ts')).toContain('`${LOGO_WORDS} ${colorWords(pagesOn)}`')
  })

  it('adds one entry under the deviations and two under the follow-ups, tagged as this step', () => {
    expect(deviations).toHaveLength(1)
    for (const piece of ['decision 16\'s build kept every old sentence word for word', 'K\'s note of Thursday, November 19, 2026']) expect(deviations[0], piece).toContain(piece)
    expect(followUps).toHaveLength(2)
    expect(followUps[0]).toContain('`ApprovalWait.tsx`')
    expect(followUps[0]).toContain('still holds its old words and opens the old way')
    for (const piece of ['the contact name, the place\'s note, the cost, who is welcome, the two ticks and the three links', '"Visitors do not see this yet."', 'Until K answers, nothing is said.']) {
      expect(followUps[1], piece).toContain(piece)
    }
  })

  it('gives the Status line one clause, straight before Help\'s, and keeps it ending as before', () => {
    expect(statusLine).toContain('; the question marks\' words on My region and in the one club editor, made new by K\'s note of Thursday, November 19, 2026, are built on `redesign/ws09-help-words` and wait for K\'s word on their own pull request; Help as small question marks on My region')
    expect(statusLine).toMatch(/\bbuilt\.$/)
  })

  it('gives each figure of the checks once, the integration figure with the one todo beside it, and names the branch and its base', () => {
    for (const piece of ['`npm run lint` ', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', ' tests in ', 'with the one todo beside them', 'the browser run', 'the stored baseline unchanged']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toMatch(/PENDING|GATE_LINE/)
    const branch = bullet(block, '- **Branch.**')
    for (const piece of ['`redesign/ws09-help-words`', '`18634b8`', '`c8209eb`', 'draft pull request 149', '183 record cases fail']) expect(branch, piece).toContain(piece)
  })

  it('keeps the record\'s plain language in what it wrote', () => {
    const clause = statusLine.slice(statusLine.indexOf('; the question marks\' words'), statusLine.indexOf('; Help as small question marks'))
    for (const text of [block, ...deviations, ...followUps, clause]) {
      for (const rule of [DASHES, BANNED, TOOLS, OLD_INITIALS, HE]) expect(text).not.toMatch(rule)
      for (const date of text.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/g) ?? []) {
        expect(text, date).toMatch(new RegExp(`(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), ${date}`))
      }
    }
    for (const file of ['src/areas/clubs/components/EditorHelp.tsx', 'src/areas/clubs/components/RegionHelp.tsx', 'test/unit/fixtures/help-words.json', EDITOR_TEST, 'test/unit/help-marks-region.test.tsx']) {
      for (const rule of [DASHES, TOOLS, OLD_INITIALS]) expect(read(file), file).not.toMatch(rule)
    }
  })
})
