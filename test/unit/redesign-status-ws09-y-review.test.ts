// test/unit/redesign-status-ws09-y-review.test.ts
//
// REDESIGN_STATUS.md records checkpoint Y at its end: the checkpoint's own
// section, "Checkpoint Y: WS09 steps 32 to 35, the clubs directory", and its
// merge-safety review with the one round of fixes it led to. Like the other
// record tests of WS09, this file reads only the WS09 section, from its
// heading to the WS10 heading. Pinned here: the two blocks, in their order,
// straight after step 35's block and before the four lists while they are
// the latest; the section's parts in order, what the merge carries and does,
// what ships with every switch as shipped with the first download's figures,
// its one list of what is owed before newClubs goes on and its one numbered
// list of what K is asked, grouped by what a person meets; the review's
// bullets in order, one sub-bullet for each ruling by its findings' ids and
// the eight refuted; the sentences the review showed false, each corrected in
// its own block, held by their words; the Status and PR lines; the Checks
// line in the forms the close reads, with its own figures (the whole tree's
// count of test files is everyone's, so it is not read here); the moved pins
// against their files; and the plain-language rules over what both blocks
// wrote. No line here reads how a switch ships.
import { createHash } from 'node:crypto'
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
/** A mark left where a figure or a word was still to come. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|\\b${'Q' + 'Q'}|\\b${'Q'}[A-Z]{3,}\\b|\\b(?:${['PI' + 'NS', 'CHE' + 'CKS', 'FI' + 'LES', 'FIND' + 'INGS', 'REC' + 'ORD_COUNT', 'CHECKS' + '_LINE', 'WHOLE' + '_RUN'].join('|')})\\b`)
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
const num = (text: string) => Number(text.replace(/,/g, ''))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 35: phones and below the fold'
const SECTION = '### Checkpoint Y: WS09 steps 32 to 35, the clubs directory'
const REVIEW = '### WS09 checkpoint Y: the review of the whole and its fixes'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const section = part(SECTION)
const review = part(REVIEW)
const lines = ws09.split('\n')
const headings = lines.filter((l) => l.startsWith('### '))
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const checksLine = review.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
/** The review is the section's latest block while it stands straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === REVIEW
const step = (n: number, name: string) => part(`### WS09 step ${n}: ${name}`)

/** The rulings, each by the ids of the findings it closes, in the order the review lists them. */
const RULINGS = ['A1 and B3', 'A2 and D5', 'A3 and D6', 'B1', 'B2 and D9', 'B4', 'C1', 'C2 and E4', 'C3', 'D2', 'D4', 'D10', 'D11', 'E1', 'E2', 'E3', 'E6', 'E7', 'E8']
const REFUTED = ['B5', 'B6', 'C4', 'D1', 'D3', 'D7', 'D8', 'E5']
/** The files whose pins moved, each named in Pins moved. */
const MOVED = [
  'test/unit/redesign-status-ws09-step34.test.ts', 'test/unit/redesign-status-ws09-step32.test.ts', 'test/unit/redesign-status-ws09-x-review.test.ts', 'test/unit/redesign-status-ws09-step1.test.ts',
  'test/unit/near-town-words.test.ts', 'test/unit/near-zip.test.ts', 'test/unit/near-zip-edges.test.ts', 'test/unit/la-places.test.ts',
  'test/unit/place-field.test.tsx', 'test/unit/place-field-edges.test.tsx', 'test/a11y/clubs-directory-place.spec.ts', 'test/unit/club-map-pins.test.ts',
  'test/unit/club-directory-phone.test.tsx', 'test/unit/clubs-index-page.test.tsx', 'test/unit/clubs-index-page-edges.test.tsx', 'test/a11y/clubs-directory-keys.spec.ts',
  'test/unit/fixtures/clubs-page-base-markup.json', 'test/unit/fixtures/api-added-since-split.json',
]
const NEW_TESTS: Record<string, number> = {
  'test/unit/club-directory-crossing.test.tsx': 8,
  'test/unit/clubs-page-base-markup-dashes.test.ts': 1,
  'test/unit/la-points-rules.test.ts': 11,
  'test/unit/club-directory-crossing-order.test.tsx': 5,
  'test/unit/place-field-late.test.tsx': 10,
  'test/unit/club-directory-map-spread.test.tsx': 5,
}
const SELF = 'test/unit/redesign-status-ws09-y-review.test.ts'
const casesIn = (file: string) => (read(file).match(/^\s*(?:it|test)\(/gm) ?? []).length

describe('REDESIGN_STATUS.md, checkpoint Y: the section and the review, in their places', () => {
  it('stands once each, the section then the review, straight after step 35, and before the four lists while the review is the latest', () => {
    expect(section).not.toBe('')
    expect(review).not.toBe('')
    for (const heading of [SECTION, REVIEW]) expect(ws09.split(`\n${heading}\n`), heading).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(SECTION)
    expect(headings[headings.indexOf(SECTION) + 1]).toBe(REVIEW)
    if (latest) expect(headings[headings.indexOf(REVIEW) + 1]).toBe(LISTS[0])
  })
})

describe('the checkpoint\'s own section', () => {
  it('says what the checkpoint is, with each step and its commit, and has its parts in the form of checkpoint X\'s', () => {
    const opening = section.split('\n')[2] ?? ''
    for (const piece of ['WS09 steps 32 to 35', '`redesign/ws09-clubs-y`', '`f46fd6d`', '`875f2e6`', '`5121e82`', '`1ab56aa`', '`631589e`', 'draft pull request 158', 'draft pull request 154', '`85f20ec`', 'waits for its own draft pull request', 'it merges after 158, which merges after 154', '`clubPagesOn()`', '`CLUB_PAGES_ON`']) {
      expect(opening, piece).toContain(piece)
    }
    const parts = ['- **The steps.**', '- **What the merge carries.**', '- **What the merge does.**', '- **What ships with every switch as shipped.**', '- **Not built from the plan, and why.**', '- **Owed before newClubs goes on.**', '- **What K is asked.**', '- **The way a revert goes.**']
    const at = parts.map((p) => section.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const steps = bullet(section, '- **The steps.**')
    for (const n of [32, 33, 34, 35]) expect(steps, `step ${n}`).toContain(`  - Step ${n}, `)
  })

  it('says what the merge carries as one list, and what it does: no migration, no endpoint, no switch, and the worker deployed with the same bundle', () => {
    const carries = bullet(section, '- **What the merge carries.**')
    for (const piece of ['No migration', '`functions/api/clubs.ts`', '`functions/utils/clubs/directory.ts`', '`domain/clubs/laPoints.ts`, 22,472 bytes', 'five public files of the Census Bureau', '`getClubsFromOrigin()`', '`src/App.tsx`', 'No switch is added and none changes']) {
      expect(carries, piece).toContain(piece)
    }
    expect(Buffer.byteLength(read('domain/clubs/laPoints.ts'))).toBe(22472)
    const does = bullet(section, '- **What the merge does.**')
    for (const piece of ['No migration, no endpoint and no switch', '`deploy-worker.yml`', 'with the same bundle', '76.61 KiB, gzip 20.53 KiB', '78,448 bytes', 'Nothing else']) expect(does, piece).toContain(piece)
    for (const dir of ['functions/utils/**', 'domain/**']) expect(read('.github/workflows/deploy-worker.yml'), dir).toContain(`'${dir}'`)
  })

  it('says what ships with every switch as shipped, with what every visitor\'s first download gains, file by file', () => {
    const ships = bullet(section, '- **What ships with every switch as shipped.**')
    for (const piece of ['Today\'s `/clubs`, unchanged', '`test/unit/clubs-page-base-markup.test.tsx`', 'the base\'s bytes', '`test/unit/club-list-callers.test.ts`', 'The directory\'s own scripts, and all of the points file, are in chunks no live page fetches', 'from 173,817 bytes to 176,332, 2,515 more', 'from 523,761 bytes to 524,195, 434 more', 'from 6,085 to 7,084 bytes', 'every chunk that imports the main script takes a new name','`test/a11y/baseline.json` is the base\'s to the byte']) {
      expect(ships, piece).toContain(piece)
    }
    expect(176332 - 173817).toBe(611 + 126 + 1667 + 111)
    expect(524195 - 523761).toBe(270 + 37 + 10 + 117)
  })

  it('says what was not built from the plan and why, and carries the one whole list of what is owed before newClubs goes on', () => {
    const notBuilt = bullet(section, '- **Not built from the plan, and why.**')
    for (const piece of ['"Who keeps these listings"', 'K\'s decision 12', 'the region target on the general contact form', 'built as one', 'title strip and the controls']) expect(notBuilt, piece).toContain(piece)
    const owed = bullet(section, '- **Owed before newClubs goes on.**')
    expect(owed).toContain('One list, all of it')
    for (const piece of ['Checkpoint X\'s list as it stands in its section, with none taken away', '`SIGNING_SECRET`', 'a day\'s bound on the forms\' emails, its choice 26', 'the daily-emails worker\'s two held lines', 'K\'s answers to What K is asked', 'a maps key', 'a phone of one\'s own', '`CLUB_PAGES_ON` set on the server']) {
      expect(owed, piece).toContain(piece)
    }
  })

  it('asks K everything in one numbered list, grouped by what a person meets, each with the built way first, and this review\'s choices among it', () => {
    const asked = bullet(section, '- **What K is asked.**')
    expect(asked).toContain('all recommended')
    const numbered = asked.split('\n').filter((l) => /^\s+\d+\. /.test(l))
    expect(numbered.map((l) => Number(/^\s+(\d+)\. /.exec(l)?.[1]))).toEqual(numbered.map((_, i) => i + 1))
    expect(numbered).toHaveLength(20)
    const groups = asked.split('\n').filter((l) => /^ {2}- [^:]+:$/.test(l)).map((l) => l.trim())
    expect(groups).toEqual(['- The list and its order:', '- A place and Near me:', '- The filters:', '- The map:', '- A phone:', '- What the page does not show:', '- The page\'s address and what is kept:', '- Before the directory goes on:'])
    const choice = (words: string) => numbered.find((l) => l.includes(words)) ?? ''
    expect(choice('one stylesheet')).toMatch(/built, about 2\.5 KB of 176 KB .*; or a stylesheet of the directory's own/)
    expect(choice('stays in the page\'s address')).toMatch(/built, so a link can be shared, a reload keeps the place and Back works; or the place is kept out of the address and lost on a reload/)
    expect(choice('ZIP code area to place file')).toContain('"Near you: 70352"')
    expect(choice('after the ten seconds')).toContain('built, since the person may still be answering')
    expect(choice('Marks whose boxes would touch')).toContain('built, so each can be seen and pressed with a pointer')
    expect(choice('Two dashes')).toMatch(/`src\/pages\/ClubsPage\.tsx`.*Mend them now in a small change of their own, recommended, two characters; or leave them until the directory replaces the page/)
    expect(choice('25 mile rule')).toContain('built')
    expect(choice('lowering the sheet bringing its list back to the top')).toContain('a card raised by its pin kept in sight at the low rest')
    for (const line of numbered) expect(line, line).toMatch(/built|recommended/)
  })

  it('says the way a revert goes', () => {
    const revert = bullet(section, '- **The way a revert goes.**')
    for (const piece of ['puts back checkpoint X\'s site', 'Nothing is left in the database', 'at most five minutes']) expect(revert, piece).toContain(piece)
  })
})

describe('the review\'s block', () => {
  it('has its bullets in order, one sub-bullet for each ruling by its findings\' ids, and the eight refuted with why', () => {
    const parts = ['- **What this is.**', '- **Findings and fixes.**', '- **The Status and PR lines.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Follow-ups.**', '- **Judgement calls.**', '- **Build.**', '- Checks:', '- **Files.**', '- **Branch.**']
    const at = parts.map((p) => review.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(review, '- **What this is.**')).toContain('twenty-four stood')
    const findings = bullet(review, '- **Findings and fixes.**').split('\n').filter((l) => /^ {2}- /.test(l))
    const ids = findings.filter((l) => /^ {2}- [A-E]\d/.test(l)).map((l) => /^ {2}- ([A-E]\d+(?: and [A-E]\d+)?),/.exec(l)?.[1])
    expect(ids).toEqual(RULINGS)
    expect(RULINGS.flatMap((r) => r.split(' and '))).toHaveLength(24)
    const refuted = findings.at(-1)!
    expect(refuted).toMatch(/^ {2}- Refuted, and not acted on: /)
    for (const id of REFUTED) expect(refuted, id).toMatch(new RegExp(`\\b${id}, since `))
    expect(refuted).toContain('which ruling B1 answers')
  })

  it('gives B1\'s figures as the points file holds them, Houma left out of the six miles with its reason', () => {
    const b1 = bullet(review, '- **Findings and fixes.**').split('\n').find((l) => l.startsWith('  - B1,')) ?? ''
    for (const piece of ['`tab20_zcta520_place20_natl.txt`, 9,811,563 bytes', '540 areas, 472 with a town and 68 with none', '365 are some area\'s town', 'Lebeau', 'New Orleans 70163', 'Baton Rouge 70825', 'Shreveport 71103', 'Lafayette 70503', 'Lake Charles 70629', 'Monroe 71209', 'Alexandria 71301', 'Houma 70363, 6.24', 'whose point lies nearest the town\'s own point (of two the same distance apart, the lower ZIP code)', 'not tuned for one city', 'Refuted finding E5', '22,472 bytes']) {
      expect(b1, piece).toContain(piece)
    }
    const points = read('domain/clubs/laPoints.ts')
    expect(points).toContain('540 ZIP code areas\' points, 472 of them with a town and\n// 68 with none')
    expect(points).toContain('Of the\n// towns, 365 are some area\'s town')
    expect(points).toContain('//   tab20_zcta520_place20_natl.txt: 9,811,563 bytes, sha256 698a5dad71ed419411677d0ffd8ecd9331067f59c472cdd239b92c12f698285d')
    expect(createHash('sha256').update(readFileSync(join(ROOT, 'domain/clubs/laPlaces.ts'))).digest('hex')).toBe('3ef591ab11e4fbd72c0404ab649b3a6e1347d6de0903248ebd1f14991599ee1d')
    expect(read('test/unit/near-town-words.test.ts')).toContain('const PAST_SIX_MILES = new Set([\'houma\'])')
  })

  it('says what ships with every switch off', () => {
    const ships = bullet(review, '- **What ships with every switch off.**')
    for (const piece of ['What `631589e` ships', 'is a comment (`functions/utils/clubs/directory.ts`)', '`getClubsFromOrigin()`', 'answers the base\'s bytes', 'unchanged', 'asks as on the base for every live caller', 'ran what they ran with the results they had', '`test/a11y/baseline.json` is the base\'s to the byte', 'with its bundle unchanged', 'reads a switch\'s shipped value']) {
      expect(ships, piece).toContain(piece)
    }
  })

  it('names each moved pin by its file, each file standing in the tree, and each new test with its count', () => {
    const pins = bullet(review, '- **Pins moved.**')
    for (const file of MOVED) {
      expect(pins, file).toContain(`\`${file}\``)
      expect(existsSync(join(ROOT, file)), file).toBe(true)
    }
    for (const n of [30, 32, 33, 34, 35]) expect(read(`test/unit/redesign-status-ws09-step${n}.test.ts`), String(n)).toContain('const Y_REVIEW_ADDED: Record<string, number> = {')
    const files = bullet(review, '- **Files.**')
    for (const [file, count] of Object.entries(NEW_TESTS)) {
      expect(files, file).toContain(`\`${file}\` (${count}: `)
      expect(casesIn(file), file).toBe(count)
    }
    expect(files).toContain(`\`${SELF}\` (${casesIn(SELF)}: `)
  })

  it('writes the Build line and the Checks line in the forms the close reads, with the base\'s figures beside', () => {
    const build = bullet(review, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', '`index-D4xKxTrV.js` at 524,078 bytes', '`index-whXnuZ9_.js` at 524,195', '`index-DVm0ssZV.css` at 176,221 bytes', '`index-BUAlFXpD.css` at 176,332', '`features-BFUKrFdH.js` stays at 741 bytes', '245 files', 'the other 156 files keep theirs', 'Every chunk that imports the main script takes a new name']) expect(build, piece).toContain(piece)
    for (const wrong of ['Every chunk takes a new name', 'every other file keep their sizes and take new names']) expect(build, wrong).not.toContain(wrong)
    expect(checksLine).toMatch(/`npm run lint` 13 errors and 11 warnings over [\d,]+ files \(1,557 on the base\)/)
    expect(checksLine).toMatch(/unit [\d,]+ tests in \d+ files \(13,525 in 633 on the base\)/)
    expect(checksLine).toMatch(/integration [\d,]+ in \d+ files \(3,975 in 223 on the base\), every one that runs passing in one full run, with the one todo beside them/)
    expect(checksLine).not.toMatch(/\d that run in \d/)
    const unit = /unit ([\d,]+) tests in (\d+) files/.exec(checksLine)!
    expect(num(unit[1])).toBeGreaterThan(13525)
    expect(num(unit[2])).toBe(640)
    const integration = /integration ([\d,]+) in (\d+) files/.exec(checksLine)!
    expect(num(integration[1])).toBe(3975)
    expect(num(integration[2])).toBe(223)
    for (const piece of ['`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`', '`a11y-clubs` 66 passed', '725 passed and 337 skipped', 'Thursday, November 26, 2026']) expect(checksLine, piece).toContain(piece)
  })
})

describe('the sentences the review showed false, each corrected in its own block', () => {
  const s33 = step(33, 'the directory and its map')
  const s34 = step(34, 'a place, Near me and the filters')
  const s35 = step(35, 'phones and below the fold')

  it('corrects what ships with every switch off in steps 34 and 35, and the worker\'s deploy in step 34 (A1, A2)', () => {
    for (const block of [s34, s35]) {
      const off = bullet(block, '- **What ships with every switch off.**')
      expect(off).toContain('the directory\'s own scripts, and all of the points file, are in chunks no live page fetches, and what every visitor\'s first download gains is in the Build bullet')
      expect(off).not.toMatch(/lazy chunks alone/)
    }
    expect(bullet(s34, '- **What the merge does.**')).toContain('one function is added to `domain/clubs/nearZip.ts`, which no server file imports, so `deploy-worker.yml` redeploys the daily-emails worker with its bundle unchanged.')
  })

  it('corrects the main script\'s name and the directory\'s chunk in step 34\'s Build, and says what the chunk carries (A3, D10)', () => {
    const build = bullet(s34, '- **Build.**')
    expect(build).toContain('`index-DwnaKu8n.js` at 524,068 (the name the full check on `1ab56aa` built;')
    expect(build).not.toContain('BE9nnAeQ')
    expect(build).toContain('to 37,794 (37,699 before the same mend)')
    expect(build).toContain('The directory\'s chunk carries `domain/clubs/placeNames.ts` through `domain/clubs/nearZip.ts`: plain code, no region and no point.')
    expect(bullet(s35, '- **Build.**')).toContain('from 37,794 bytes (the full check\'s figure on `1ab56aa`) to 45,760')
    const follow = lines.find((l) => l.startsWith('- **The place names in the site\'s scripts (WS09 step 32).**')) ?? ''
    expect(follow.endsWith('WS09 step 34 is that step, and its Build bullet says so since checkpoint Y\'s review.')).toBe(true)
  })

  it('says plainly what is kept of a place and where it goes, and that a late answer is taken (C1, C2)', () => {
    const stays = bullet(s34, '- **The position stays on the device.**')
    expect(stays).not.toMatch(/sent nowhere|asks the server for nothing/)
    for (const piece of ['kept in the page\'s address (`near=70808`)', 'whenever that address is loaded', 'stays in the browser\'s history', 'in the Referer of the page\'s own later requests', 'the map\'s provider is shown the area', 'a position that comes after the page\'s ten seconds is taken as if it had come in time']) {
      expect(stays, piece).toContain(piece)
    }
    expect(stays).not.toContain('and a late answer is let go')
    const comment = read('functions/utils/clubs/directory.ts')
    expect(comment).not.toContain('never reaches the server')
    expect(comment).toContain('The ZIP\n// code the directory keeps in its own address (near=) does reach this site')
  })

  it('adds each owed list\'s missing choice (D2, D4) and says what now holds of the marks and the low sheet (E6, E1)', () => {
    const owed34 = bullet(s34, '- **Owed before newClubs goes on.**')
    expect(owed34).toContain('and four of this step\'s own')
    expect(owed34).toContain('the 25 mile rule at the state line: a device farther than 25 miles from every ZIP code area\'s point reads as outside Louisiana, as built, or another distance.')
    const owed35 = bullet(s35, '- **Owed before newClubs goes on.**')
    expect(owed35).toContain('lowering the sheet bringing its list back to the top')
    expect(owed35).toContain('or a card raised by its pin kept in sight at the low rest.')
    expect(bullet(s33, '- **Cards and pins.**')).toContain('Since checkpoint Y\'s review the same holds of every mark whose box would touch another\'s, pins and circles alike')
    expect(bullet(s35, '- **The site\'s dock.**')).toContain('Since checkpoint Y\'s review the page itself scrolls such a control, Skip to the list among them, clear of the low sheet when it takes the focus')
  })
})

describe('the Status and PR lines', () => {
  it('say what is true on the day: W in draft pull request 154, X in 158, and Y built and reviewed, waiting for its own (D11)', () => {
    expect(statusLine).toContain('waits in draft pull request 154 for K\'s word')
    expect(statusLine).toContain('holds checkpoint W and `main` as it stands, at `85f20ec`, and waits in draft pull request 158 for K\'s word, checkpoint Y, steps 32 to 35, is built and reviewed on `redesign/ws09-clubs-y`, cut from checkpoint X\'s head, holds checkpoints X and W and `main` at `85f20ec`, and waits for its own draft pull request, which is opened after its review\'s fixes, and K\'s word, merging after 158, which merges after 154')
    expect(statusLine).not.toContain('checkpoint Y, steps 32 to 35, is under way')
    const tail = statusLine.slice(statusLine.lastIndexOf('; ') + 2)
    if (latest) expect(tail).toContain('step 35, checkpoint Y\'s review and its fixes, K\'s answers')
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(prLine).toContain('checkpoint X, steps 25 to 31, is built and reviewed on `redesign/ws09-clubs-x`, holds checkpoint W and `main` at `85f20ec`, and waits in draft pull request 158 for K\'s word for its merge, after 154; checkpoint Y, steps 32 to 35, is built and reviewed on `redesign/ws09-clubs-y`, cut from checkpoint X\'s head, holds checkpoints X and W and `main` at `85f20ec`, and waits for its own draft pull request, opened after its review\'s fixes, and K\'s word for its merge, after 158; the question marks\' words')
    expect(prLine.endsWith('wait in pull request 151 for K\'s word.')).toBe(true)
  })
})

describe('the plain-language rules over both blocks', () => {
  it('keeps the dashes, the working words, any tool\'s name, the old initials, unfilled marks and a he out, and writes every date with its weekday', () => {
    for (const [name, text] of [['section', section], ['review', review]] as const) {
      expect(text, name).not.toMatch(DASHES)
      expect(proseOf(text), name).not.toMatch(BANNED)
      expect(text, name).not.toMatch(TOOLS)
      expect(proseOf(text), name).not.toMatch(BARE)
      expect(text, name).not.toMatch(OLD_INITIALS)
      expect(text, name).not.toMatch(UNFILLED)
      expect(proseOf(text), name).not.toMatch(HE)
      for (const date of text.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, 2026\b/g)) {
        const before = text.slice(Math.max(0, date.index - 12), date.index)
        expect(before, `${name}: ${date[0]}`).toMatch(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
      }
      expect(text, name).not.toMatch(/\b\d{1,2}\s?(?:am|pm)\b/i)
    }
  })
})
