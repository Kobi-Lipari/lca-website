// test/unit/redesign-status-ws09-z-review.test.ts
//
// REDESIGN_STATUS.md records checkpoint Z's merge-safety review of the whole
// and the one round of fixes it led to, in one block straight after the
// checkpoint's own section, "Checkpoint Z: WS09 steps 37 and 38, the close",
// and before the four lists while it is the latest. Like the other record
// tests of WS09, this file reads only the WS09 section, from its heading to
// the WS10 heading. Pinned here: the block's place and its bullets in order;
// one sub-bullet for each ruling by its findings' ids, and the five refuted;
// the sentences the review showed false, each corrected in its own block and
// held by its words; what K is asked and the section's closing bullet; the
// Status and PR lines; the moved pins against their files; the follow-ups
// for their owners; the Checks line in the forms the close reads; and the
// plain-language rules over what the block wrote. It counts only what it
// names, and no line here reads how a switch ships.
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
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored', 'assis' + 'tant'].join('|')})\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|${'%' + '[A-Z]'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|<<|>>`)
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
/** A sub-bullet and the lines indented deeper under it. */
function sub(text: string, start: string): string {
  const all = text.split('\n')
  const at = all.findIndex((l) => l.startsWith(start))
  if (at < 0) return ''
  const depth = start.length - start.trimStart().length
  let end = at + 1
  while (end < all.length && all[end].length - all[end].trimStart().length > depth) end++
  return all.slice(at, end).join('\n')
}
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const SECTION = '### Checkpoint Z: WS09 steps 37 and 38, the close'
const REVIEW = '### WS09 checkpoint Z: the review of the whole and its fixes'
const STEP37 = '### WS09 step 37: players are not tied to clubs'
const STEP38 = '### WS09 step 38: the browser matrix and the switch-on notes'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const review = part(REVIEW)
const section = part(SECTION)
const step37 = part(STEP37)
const step38 = part(STEP38)
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
const latest = headings[headings.indexOf(LISTS[0]) - 1] === REVIEW
const checksLine = review.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const entry = (text: string, title: string) => text.split('\n').find((l) => l.startsWith(`- **${title}**`)) ?? ''

const SELF = 'test/unit/redesign-status-ws09-z-review.test.ts'
const casesIn = (file: string) => (read(file).match(/^\s*(?:it|test)\(/gm) ?? []).length
const RULINGS = ['A1', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'C6', 'C7', 'D2', 'D3']
const REFUTED = ['C5', 'C8', 'C9', 'C10', 'D1']

describe('REDESIGN_STATUS.md, checkpoint Z\'s review: its place and its parts', () => {
  it('stands once, straight after checkpoint Z\'s section, and before the four lists while it is the latest', () => {
    expect(review).not.toBe('')
    expect(ws09.split(`\n${REVIEW}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(STEP38) + 1]).toBe(SECTION)
    expect(headings[headings.indexOf(SECTION) + 1]).toBe(REVIEW)
    if (latest) expect(headings[headings.indexOf(REVIEW) + 1]).toBe(LISTS[0])
  })

  it('opens with what it reviews, and has its bullets in the ruled order', () => {
    const opening = review.split('\n')[2] ?? ''
    for (const piece of ['`git diff c930b20 6781d8a`', '`redesign/ws09-clubs-z` at `6781d8a`', 'no migration, no endpoint and no switch', 'none of the plan\'s 38 steps']) expect(opening, piece).toContain(piece)
    const parts = [
      '- **What this is.**', '- **Findings and fixes.**', '- **Beyond the review.**', '- **The Status and PR lines.**', '- **What ships with every switch off.**', '- **Pins moved.**',
      '- **Follow-ups.**', '- **Judgement calls.**', '- **Build.**', '- Checks:', '- **Files.**', '- **Branch.**',
    ]
    const at = parts.map((p) => review.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(review.split('\n').filter((l) => l.startsWith('- ')).length).toBe(parts.length)
    expect(bullet(review, '- **What this is.**')).toContain('Eighteen were reported and thirteen stood')
  })

  it('gives one sub-bullet for each ruling by its id, in order, and one line for the five refuted with why', () => {
    const found = bullet(review, '- **Findings and fixes.**').split('\n').filter((l) => /^ {2}- /.test(l))
    expect(found).toHaveLength(RULINGS.length + 1)
    for (const [i, id] of RULINGS.entries()) expect(found[i], id).toMatch(new RegExp(`^ {2}- ${id}, (?:nit|should-fix)`))
    for (const id of ['C1', 'C3', 'C4']) expect(found[RULINGS.indexOf(id)], id).toContain(`${id}, should-fix`)
    const refuted = found[RULINGS.length]
    expect(refuted.startsWith('  - Refuted, and not acted on: ')).toBe(true)
    for (const id of REFUTED) expect(refuted, id).toMatch(new RegExp(`\\b${id}, since `))
    const beyond = bullet(review, '- **Beyond the review.**').split('\n').filter((l) => /^ {2}- /.test(l))
    expect(beyond.map((l) => l.slice(4, 6))).toEqual(['E1', 'E2', 'E3'])
  })
})

describe('the sentences the review showed false, corrected in their own blocks', () => {
  it('A1 and B4 in step 37\'s block', () => {
    const off = bullet(step37, '- **What ships with every switch off.**')
    expect(off).toContain('the three page chunks the Build bullet names, and the main script and every chunk that imports it, which take new names at their own sizes since the main script names the changed chunks.')
    const kept = sub(step37, '  - Kept, a club rep\'s own club')
    expect(kept.endsWith('held by `test/integration/club-rep-requests.test.ts` and `test/unit/rep-request-words.test.ts`.')).toBe(true)
    expect(kept).toContain('Since WS09 checkpoint Z\'s review, the rep request\'s question that `functions/utils/clubs/repRequests.ts` builds names')
    // The words a keeper reads with the club pages on, and today's, as the rules file writes them.
    const rules = read('domain/clubs/repRequest.ts')
    expect(rules).toContain('return `${name}\'s account names ${otherClub} as their club. Naming them rep changes that to ${clubName}.`')
    expect(rules).toContain('return `${name} is on ${otherClub}\'s roster now. Naming them rep moves them to ${clubName}\'s.`')
  })

  it('C1 and D2 in step 38\'s block, and C1 in the deviation and the follow-up', () => {
    const rehearsal = bullet(step38, '- **The rehearsal.**')
    expect(rehearsal).toContain('since WS09 checkpoint Z\'s review the setup in `test/a11y/global-setup.ts` takes the tree with the line set as well as unset and does not change at the switch-on')
    expect(rehearsal).not.toContain('so `CLUB_PAGES_LINE` in `test/a11y/global-setup.ts` changes with it')
    expect(rehearsal).toContain('and the one case `test/unit/chrome-reads.test.ts` gains for the new spec, 59 to 60')
    expect(sub(bullet(step38, '- **Files.**'), '  - Grown with no change:')).toContain('`test/unit/chrome-reads.test.ts` goes from 59 to 60, its one case for the new spec')
    expect(bullet(step38, '- **Judgement calls.**')).toContain('Since WS09 checkpoint Z\'s review the setup takes the tree either way, so the switch-on sets the two lines and moves the named pins')
    expect(entry(deviations, 'The switch-on is more than its two lines (WS09 step 38).')).toContain('Since WS09 checkpoint Z\'s review the setup takes the tree with the line set as well')
    const builds = entry(followUps, 'The browser builds after the switch-on (WS09 step 38).')
    expect(builds).toContain('while the browser setup\'s clubs server takes the tree either way since WS09 checkpoint Z\'s review')
    expect(builds).not.toContain('read a line the tree no longer holds')
    expect(builds).toContain('`test/a11y/tokens.spec.ts`')
    expect(read('test/a11y/global-setup.ts')).toContain('export function clubPagesLineSet(text: string): boolean')
  })

  it('C1, C2, C3, C4, C6 and C7 in K\'s switch-on note, and C4 in the verify item', () => {
    const note = bullet(section, '- **K\'s switch-on note for newClubs.**')
    const first = between(note, '  - What must be true first, in this order:', '  - What turning it on does at once:')
    const steps = first.split('\n').filter((l) => /^ {4}\d+\. /.test(l))
    expect(steps.map((l) => Number(/(\d+)\./.exec(l)?.[1]))).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(steps[2]).toContain('choice 26')
    for (const piece of ['the daily worker\'s two held lines', 'keeps a refused address apart from a busy service', 'the privacy words', 'K says in so many words to go on without it', '(The daily worker\'s two held lines, WS09 step 38)', '(A refused address kept apart from a busy service, WS09 step 38)']) {
      expect(steps[3], piece).toContain(piece)
    }
    for (const title of ['The daily worker\'s two held lines (WS09 step 38).', 'A refused address kept apart from a busy service (WS09 step 38).']) expect(entry(followUps, title), title).not.toBe('')
    const now = sub(note, '  - What turning it on does at once:')
    expect(now).toContain('the site\'s first `/sitemap.xml`, with every club\'s page and every listed event\'s page, named by the site\'s first `/robots.txt`')
    expect(now).toContain('(the page is reached from the directory\'s "Not here?" tiles and by its address, and its link stands in the new menus and footer once the new navigation is on as well)')
    expect(now).not.toContain('with its link in the menus and the footer')
    const how = sub(note, '  - How:')
    expect(how).toContain('among them two cases of `test/unit/a11y-clubs-build.test.ts`; the browser setup in `test/a11y/global-setup.ts` takes the tree with the line set or unset, so it does not change.')
    expect(how).toContain('`test/a11y/tokens.spec.ts`, whose case of the club page hero opens a club\'s old address')
    const back = sub(note, '  - How it comes back out:')
    expect(back).toContain('What the edge keeps: nothing that is served')
    expect(back).toContain('`/sitemap.xml` and `/robots.txt`, each sent with an hour\'s life')
    expect(back).not.toContain('the directory\'s list for up to five minutes')
    const reaches = entry(verify, 'What turning newClubs on reaches, from the tree (WS09 step 38).')
    expect(reaches).toContain('the "Suggest a club" link that `src/lib/nav.ts` gives the new menus and the new footer, which draw it only once the new navigation, `newNav`, is on as well')
  })

  it('D3 and E3 in the checkpoint\'s section: one closing bullet with no figure, and K\'s list seven long', () => {
    const full = bullet(section, '- **The full check.**')
    expect(full).toContain('are the Checks line of the next block, the review of the whole and its fixes')
    expect(full).toContain('`main` at `85f20ec`')
    expect(full).not.toMatch(/\d,\d{3}|\d+ tests/)
    expect(section.split('\n').filter((l) => l.startsWith('- Checks:'))).toEqual([])
    const lastBullet = section.split('\n').filter((l) => l.startsWith('- **')).pop() ?? ''
    expect(lastBullet.startsWith('- **The full check.**')).toBe(true)
    const asked = bullet(section, '- **What K is asked.**').split('\n').filter((l) => /^ {2}\d+\. /.test(l))
    expect(asked).toHaveLength(7)
    expect(asked[6]).toContain('"Player One\'s account names Example Rooks Club as their club. Naming them rep changes that to Example Knights Club."')
    expect(asked[6]).toMatch(/built; or other words K gives/)
  })
})

describe('the Status and PR lines, the moved pins and the follow-ups', () => {
  it('say what is true on the day: checkpoint Z built and reviewed, holding Y, X and W and main, waiting for its own draft pull request and K\'s word', () => {
    expect(statusLine).toContain('and checkpoint Z, WS09 steps 37 and 38, is built on `redesign/ws09-clubs-z`, cut from checkpoint Y\'s head, `c930b20`, and reviewed there, holds checkpoints Y, X and W and `main` at `85f20ec`, and waits for its own draft pull request, to be opened once its review\'s fixes are in, and K\'s word, merging after 159: ')
    expect(statusLine).not.toContain('and waits for its review, its own draft pull request')
    const tail = statusLine.slice(statusLine.lastIndexOf('; ') + 2)
    if (latest) expect(tail).toContain('step 37, step 38, checkpoint Z\'s review and its fixes, K\'s answers')
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(prLine).toContain('checkpoint Z, steps 37 and 38, is built on `redesign/ws09-clubs-z`, cut from checkpoint Y\'s head, and reviewed there, holds checkpoints Y, X and W and `main` at `85f20ec`, and waits for its own draft pull request and K\'s word for its merge, after 159,')
    expect(prLine).not.toContain('and waits for its review')
  })

  it('names each moved pin against its file, each with its comment', () => {
    const pins = bullet(review, '- **Pins moved.**')
    const moved: ReadonlyArray<readonly [string, number]> = [
      ['test/integration/club-rep-requests.test.ts', 1],
      ['test/unit/redesign-status-ws09-step24-browser.test.ts', 1],
      ['test/unit/redesign-status-ws09-step37.test.ts', 4],
      ['test/unit/redesign-status-ws09-step38.test.ts', 11],
      ['test/unit/redesign-status-ws09-step1.test.ts', 0],
    ]
    for (const [file, comments] of moved) {
      expect(pins, file).toContain(`\`${file}\``)
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect(read(file).split('\n').filter((l) => /checkpoint Z's review/.test(l)).length, file).toBeGreaterThanOrEqual(comments)
    }
    expect(read('test/unit/redesign-status-ws09-step1.test.ts')).toContain('|WS09 checkpoint Z: \\S|')
    expect(read('test/unit/redesign-status-ws09-step37.test.ts').split('\n').filter((l) => l.includes('// moved by WS09 step 38'))).toHaveLength(2)
    expect(pins).toContain('Not moved: every other pin')
  })

  it('lists the five tests of another workstream that leave folders behind, for their owners, and names the four it mended', () => {
    const follow = bullet(review, '- **Follow-ups.**')
    for (const file of ['test/unit/api-split-modules.test.ts', 'test/unit/check-bundle.test.ts', 'test/unit/preview-database.test.ts', 'test/unit/seed-fixtures.test.ts', 'test/unit/wrangler-config.test.ts']) {
      expect(follow, file).toContain(`\`${file}\``)
      expect(read(file), file).toContain('mkdtemp')
    }
    const e1 = sub(bullet(review, '- **Beyond the review.**'), '  - E1, ')
    for (const file of ['test/unit/db-generate-guard.test.ts', 'test/unit/la-places.test.ts', 'test/unit/la-places-edges.test.ts', 'test/unit/la-points-rules.test.ts']) {
      expect(e1, file).toContain(`\`${file}\``)
      expect(read(file), file).toMatch(/afterAll\(\(\) => \{\n {2}for \(const dir of TEMP_FOLDERS\.splice\(0\)\) rmSync\(dir, \{ recursive: true, force: true \}\)\n\}\)/)
    }
  })
})

describe('the Checks line and the plain-language rules', () => {
  it('gives each figure once, in the forms the close reads, with the base\'s figures', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', ' over ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toMatch(/13 errors and 11 warnings over [\d,]+ files \(1,575 on the base\)/)
    expect(checksLine).toMatch(/unit [\d,]+ tests in [\d,]+ files \(13,688 in 649 on the base\)/)
    expect(checksLine).toMatch(/integration [\d,]+ in [\d,]+ files \(3,996 in 224 on the base\)[^;]*with the one todo beside them/)
    expect(checksLine).not.toMatch(/that run in [\d,]+ files/)
    expect(checksLine).toContain('the base\'s browser run 1,078 tests, 741 that run and 337 that skip')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`')
    expect(checksLine).toContain('76.61 KiB, gzip 20.53 KiB')
    const files = bullet(review, '- **Files.**')
    expect(files).toContain(`\`${SELF}\` (${casesIn(SELF)}: `)
    expect(files).toContain('`test/unit/a11y-clubs-build.test.ts` (11: ')
    expect(casesIn('test/unit/a11y-clubs-build.test.ts')).toBe(11)
    // The integration file that holds ruling B4's words in both states is named with its count, and its cases are the ones B4 names.
    expect(files).toContain(`\`test/integration/club-rep-requests-words.test.ts\` (${casesIn('test/integration/club-rep-requests-words.test.ts')}: `)
    expect(casesIn('test/integration/club-rep-requests-words.test.ts')).toBe(5)
    expect(bullet(review, '- **Findings and fixes.**')).toContain('`test/integration/club-rep-requests-words.test.ts`')
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials, unfilled marks and a he out, and writes every date with its weekday', () => {
    const added = [review, bullet(section, '- **The full check.**'), statusLine, prLine]
    for (const text of added) {
      expect(text).not.toMatch(DASHES)
      expect(proseOf(text)).not.toMatch(BANNED)
      expect(text).not.toMatch(TOOLS)
      expect(proseOf(text)).not.toMatch(BARE)
      expect(text).not.toMatch(OLD_INITIALS)
      expect(text).not.toMatch(UNFILLED)
      expect(proseOf(text)).not.toMatch(HE)
      for (const date of text.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, 2026\b/g)) {
        const before = text.slice(Math.max(0, date.index - 12), date.index)
        expect(before, date[0]).toMatch(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
      }
      expect(text).not.toMatch(/\b\d{1,2}\s?(?:am|pm)\b/i)
    }
    for (const file of [SELF, 'test/a11y/global-setup.ts', 'test/unit/a11y-clubs-build.test.ts', 'domain/clubs/repRequest.ts', 'functions/utils/clubs/repRequests.ts', 'test/unit/ws09-map-names-real-tests.test.ts']) {
      expect(read(file), file).not.toMatch(DASHES)
      expect(read(file), file).not.toMatch(TOOLS)
    }
  })
})
