// test/unit/redesign-status-ws09-step35.test.ts
//
// REDESIGN_STATUS.md records WS09's thirty-fifth step, phones and below the
// fold, the last of the plan's four steps of checkpoint Y. Like step 34's
// record test, this file reads only the WS09 section, from its heading to the
// WS10 heading. Pinned here: this step's block right after step 34's, and
// before the four lists while it is the latest; the Status line's clause and
// tail while this step is the latest; the block's parts in order and this
// step's own figures, which must agree with the files they describe; the parts
// of the entry the first ruling leaves out, each said with its reason, and the
// choices owed to K; the sentences this step added to the map; the tagged
// entries of the lists; and the plain-language rules over what the step wrote
// and the files it adds. It counts no file of the whole tree, holds no line of
// another file by its number, and no line here reads how a switch ships.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NARROW_QUERY } from '../../src/areas/clubs/narrowScreen'
import {
  CLOSE, FILTERS_TITLE, LIST_SHEET, MISSING_CLUB, NO_CLUB_NEAR, NOT_HERE, OUT_OF_DATE, OUT_OF_DATE_HOW, SHOW_LIST, SHOW_MAP, SKIP_TO_LIST, START_ONE, SUGGEST_A_CLUB, listCaption,
} from '../../src/areas/clubs/directoryWords'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|${'Z' + 'Z'}[A-Z]|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|${'CHECKS' + '_LINE'}|[\\u00ab\\u00bb]|<<|[A-Z]+_(?:${['WORDS', 'LINE', 'BYTES', 'SHA', 'CASES', 'RESULT', 'OWED'].join('|')})\\b`)
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
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))
const head = (entry: string) => entry.slice(4, entry.indexOf('**', 4))
const TAG = '(WS09 step 35).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 34: a place, Near me and the filters'
const STEP = '### WS09 step 35: phones and below the fold'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))
const headings = lines.filter((l) => l.startsWith('### '))
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''
const latest = latestStep === 35 && latestBlock === STEP
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''

const SELF = 'test/unit/redesign-status-ws09-step35.test.ts'
const C = 'src/areas/clubs/'
const NEW_FILES = [`${C}narrowScreen.ts`]
/** Each new test with the count of cases its run gives. */
const NEW_TESTS: Record<string, number> = {
  'test/unit/club-directory-phone.test.tsx': 12,
  'test/unit/club-directory-phone-edges.test.tsx': 9,
  'test/unit/narrow-screen.test.tsx': 4,
}
/** Each grown spec, from and to, by its written cases. */
const GROWN_TESTS: Record<string, readonly [number, number]> = {
  'test/a11y/clubs-directory-keys.spec.ts': [6, 12],
  'test/a11y/clubs-reflow.spec.ts': [2, 3],
}
const CHANGED = [`${C}components/ClubDirectory.tsx`, `${C}components/ClubFilters.tsx`, `${C}directoryWords.ts`, 'test/a11y/clubs-directory.spec.ts']
const MOVED = ['test/unit/club-directory-edges.test.tsx', 'test/a11y/clubs-directory.spec.ts', 'test/a11y/clubs-directory-keys.spec.ts']
const UNTOUCHED = [
  'functions/api/contact.ts', 'functions/utils/admin/tickets.ts', 'src/pages/ContactPage.tsx', 'test/unit/contracts-pending.ts', 'domain/contracts/registry.ts', 'src/App.tsx', 'src/lib/features.ts', 'src/lib/nav.ts',
  'src/pages/ClubsIndexPage.tsx', 'src/pages/ClubsPage.tsx', `${C}components/LCAMap.tsx`, `${C}components/ClubCard.tsx`, `${C}components/DirectoryMap.tsx`, `${C}components/PlaceField.tsx`, `${C}directoryPins.ts`, `${C}api.ts`,
  'src/components/ui/dialog.tsx', 'src/hooks/useWideScreen.ts', 'test/unit/club-directory.test.tsx', 'test/a11y/clubs-directory-place.spec.ts', 'test/a11y/scopes.spec.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts',
  'test/a11y/global-setup.ts', 'test/a11y/baseline.json', 'test/unit/fixtures/api-added-since-split.json', 'functions/utils/auth.ts', 'functions/utils/email.ts', 'functions/utils/admin/campaigns.ts', 'test/integration/harness.ts',
]
/** What this step names, which no untouched file may hold. */
const OURS = /narrowScreen|NotHere|SKIP_TO_LIST|RegionMessageSheet|WS09 step 35/
/** The entry's files that the first ruling leaves unwritten. */
const NOT_WRITTEN = [`${C}components/RegionMessageSheet.tsx`, 'test/integration/contact-region.test.ts', 'test/integration/contracts/contact.test.ts', 'test/unit/contact-page-spam.test.tsx']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,)]`).exec(files)?.[1])
/** A file's cases as written: every `it(` and `test(` line. */
function casesIn(file: string): number {
  return (read(file).match(/^\s*(?:it|test)\(/gm) ?? []).length
}

describe('REDESIGN_STATUS.md, the thirty-fifth step of WS09: the block', () => {
  it('sits once, right after step 34\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s clause and its name among the built while it is the latest', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    const tail = statusLine.slice(statusLine.lastIndexOf('; ') + 2)
    if (latest) {
      expect(statusLine).toContain('WS09 step 35, phones and below the fold, gives the directory on a phone the map with the list in a sheet of two rests and the Filters panel as a sheet of its own, and under the list at every width three tiles, "Not here?", only with `newClubs` and `newLook` on')
      expect(tail).toContain('step 32, step 33, step 34, step 35, K\'s answers to checkpoint S\'s review')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying where the step sits, what it builds, what the first ruling leaves out and what ships', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the fourth and last of the plan\'s four steps of checkpoint Y (steps 32 to 35)', '`redesign/ws09-clubs-y`', '`1ab56aa`', '`clubPagesOn()`', '`src/areas/clubs/narrowScreen.ts`', `\`${C}components/ClubDirectory.tsx\``,
      `\`${C}components/ClubFilters.tsx\``, '"Not here?"', 'by K\'s decision 12', 'today\'s page to the byte', 'No handler file, no switch and no migration is added, and no file under `functions/` changes.',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The phone layout.**', '- **The sheet\'s two rests.**', '- **A pin\'s press.**', '- **Keyboard.**', '- **The site\'s dock.**', '- **The Filters sheet.**',
      '- **The three tiles.**', '- **With no map.**', '- **The keepers.**', '- **The browser run.**', '- **The map (criteria 2, 3 and 15 on phones).**', '- **Branch.**', '- **What the merge does.**',
      '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Rulings not kept.**', '- **Not built, by K\'s decision 12.**',
      '- **Owed before newClubs goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })

  it('names every file it adds and changes, each new test with its count, and leaves the held, shared and contact files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...Object.keys(NEW_TESTS), ...Object.keys(GROWN_TESTS), SELF, ...CHANGED, ...MOVED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...Object.keys(NEW_TESTS)]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const [file, count] of Object.entries(NEW_TESTS)) {
      expect(writtenCount(files, file), file).toBe(count)
      expect(casesIn(file), file).toBe(count)
    }
    for (const [file, [from, to]] of Object.entries(GROWN_TESTS)) {
      expect(files, file).toContain(`\`${file}\` (${from} to ${to}: `)
      expect(casesIn(file), file).toBe(to)
    }
    expect(writtenCount(files, SELF)).toBe(casesIn(SELF))
    // The pins moved in place: the closed tests keep their counts.
    expect(casesIn('test/unit/club-directory.test.tsx')).toBe(16)
    expect(casesIn('test/unit/club-directory-edges.test.tsx')).toBe(17)
    expect(casesIn('test/a11y/clubs-directory.spec.ts')).toBe(9)
    expect(casesIn('test/a11y/clubs-directory-place.spec.ts')).toBe(6)
    const grown = bullet(files, '  - Grown with no change:')
    for (const piece of ['63 tests, 54 on the base and 9 new', '`test/unit/chrome-reads.test.ts`', '117 handler files', '`test/unit/domain-boundaries.test.ts` does not move']) expect(grown, piece).toContain(piece)
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const file of UNTOUCHED) {
      expect(beyond, file).toContain(`\`${file}\``)
      expect(read(file), file).not.toMatch(OURS)
    }
    for (const dir of ['functions/', 'functions/utils/mail/', 'domain/mail/', 'workers/daily-emails/', 'src/components/layout/']) expect(beyond, dir).toContain(`\`${dir}\``)
    for (const file of NOT_WRITTEN) expect(existsSync(join(ROOT, file)), file).toBe(false)
  })
})

describe('REDESIGN_STATUS.md, the thirty-fifth step of WS09: the parts against the files', () => {
  it('gives the layout, the sheet, the keyboard, the dock, the Filters sheet and the tiles in the words the code writes', () => {
    expect(NARROW_QUERY).toBe('(max-width: 1023.98px)')
    const layout = bullet(block, '- **The phone layout.**')
    for (const piece of ['Below 1,024 pixels', `"${LIST_SHEET}"`, `"${listCaption(25)}"`, 'the one live region', 'the position rules of step 34 hold as they are']) expect(layout, piece).toContain(piece)
    const rests = bullet(block, '- **The sheet\'s two rests.**')
    for (const piece of [`"${SHOW_LIST}"`, `"${SHOW_MAP}"`, 'nothing is moved by a drag', 'brings its list back to the top', 'never more than half the window', 'at least 60 percent', 'never covers the footer', 'without animation']) expect(rests, piece).toContain(piece)
    const pin = bullet(block, '- **A pin\'s press.**')
    for (const piece of ['raises the sheet to its card', 'moves the focus to it', 'not a dialog and holds no focus', 'goes back to its low rest']) expect(pin, piece).toContain(piece)
    const keys = bullet(block, '- **Keyboard.**')
    for (const piece of [`"${SKIP_TO_LIST}"`, 'the map\'s pins as buttons in the list\'s order', 'writes nothing in the address', '`test/a11y/clubs-directory-keys.spec.ts`']) expect(keys, piece).toContain(piece)
    const dock = bullet(block, '- **The site\'s dock.**')
    for (const piece of ['`--bottom-chrome-h`', 'never reaches under the dock', 'a margin of its own', '390 by 844']) expect(dock, piece).toContain(piece)
    const filters = bullet(block, '- **The Filters sheet.**')
    for (const piece of ['`src/components/ui/dialog.tsx`', `named "${FILTERS_TITLE}"`, 'the focus kept inside it', '"Clear"', '"Done"', `${CLOSE}`, 'the focus goes back to the Filters button']) expect(filters, piece).toContain(piece)
    const tiles = bullet(block, '- **The three tiles.**')
    for (const piece of [`"${NOT_HERE}"`, `"${MISSING_CLUB}"`, `"${SUGGEST_A_CLUB}"`, '`/clubs/suggest`', `"${NO_CLUB_NEAR}"`, `"${START_ONE}"`, '`/clubs/suggest?kind=start`', '`START_QUERY`', `"${OUT_OF_DATE}"`, `"${OUT_OF_DATE_HOW}"`]) {
      expect(tiles, piece).toContain(piece)
    }
    expect(bullet(block, '- **The keepers.**')).toContain('No keeper is named, by K\'s decision 12')
    const run = bullet(block, '- **The browser run.**')
    for (const piece of ['63 tests, 54 on the base', '320 by 568 and 390 by 844', 'light and dark looks at 390, at both rests, and at 1440', '`test/a11y/clubs-reflow.spec.ts`']) expect(run, piece).toContain(piece)
  })

  it('gives the branch, the merge, the revert, what ships, the rulings and what the first ruling leaves out', () => {
    expect(bullet(block, '- **Branch.**')).toContain('`redesign/ws09-clubs-y` at `1ab56aa`, "WS09 step 34: A place, Near me and the filters"')
    const merge = bullet(block, '- **What the merge does.**')
    for (const piece of ['117 handler files', '58 of the 162 methods', '`PENDING_COUNT` still 104', '`deploy-worker.yml` does not run']) expect(merge, piece).toContain(piece)
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['Today\'s `/clubs`, unchanged', '`test/unit/clubs-page-base-markup.test.tsx`', 'run what they ran', 'Today\'s contact endpoint', 'today\'s body answers as today', 'No switch is added.']) expect(off, piece).toContain(piece)
    const notKept = bullet(block, '- **Rulings not kept.**')
    for (const piece of ['Two parts of ruling two are not built as written.', '"Show the list" and "Map", are built as one button', 'the title strip and the controls in the page above the map', 'at 320 by 568', 'a pointer must scroll before it presses Filters']) {
      expect(notKept, piece).toContain(piece)
    }
    const left = bullet(block, '- **Not built, by K\'s decision 12.**')
    for (const piece of [
      '"Who keeps these listings"', 'Tuesday, November 17, 2026', 'items 3, 3a and 4', '`POST /api/contact`', '`RegionMessageSheet`', '`test/integration/contact-region.test.ts`', '`test/integration/contracts/contact.test.ts`',
      '`test/unit/contact-page-spam.test.tsx`', 'criteria 3, 4 and 5', 'three ways to write', 'item 7', 'after the review of the whole',
    ]) expect(left, piece).toContain(piece)
  })

  it('names each moved pin by its file, the choices owed to K, and the build\'s figures', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('`PENDING_COUNT`, still 104')
    expect(read(MOVED[0])).toContain('words.WHOLE_STATE, words.SUGGEST_A_CLUB, words.START_ONE])')
    expect(read(MOVED[1])).toContain('expect((await sheet(page).boundingBox())!.y).toBeGreaterThan(drawn!.y)')
    expect(read(MOVED[2])).toContain('expect(low.y + low.height).toBeCloseTo(400, 0)')
    const owed = bullet(block, '- **Owed before newClubs goes on.**').split('\n').filter((l) => l.startsWith('  - '))
    expect(owed).toHaveLength(3)
    for (const [i, piece] of ['the row of the regions', 'the general contact form\'s spam check', 'the phone layout as built'].entries()) expect(owed[i], piece).toContain(piece)
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `1ab56aa`')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', '`index-DwnaKu8n.js` at 524,068 bytes', '`index-swkDuaB9.css` at 174,554 bytes', '`features-BFUKrFdH.js` stays at 741 bytes']) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, the thirty-fifth step of WS09: the Checks line, the map and the lists', () => {
  it('gives each figure once, in the forms the close reads, with the base\'s figures', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', ' over ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toMatch(/over [\d,]+ files \(1,552 on the base\)/)
    expect(checksLine).toMatch(/unit [\d,]+ tests in [\d,]+ files \(13,488 in 629 on the base\)/)
    expect(checksLine).toMatch(/integration [\d,]+ in [\d,]+ files \(3,975 in 223 on the base\)[^;]*with the one todo beside them/)
    expect(checksLine).not.toMatch(/that run in [\d,]+ files/)
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('the base\'s browser run 1,053 tests, 716 that run and 337 that skip')
    expect(checksLine).toContain('the third project by itself, 63 tests passing, 54 on the base')
  })

  it('adds one sentence to criteria 2, 3 and 15, each before its planned step, and to no other item', () => {
    for (const [id, step, test] of [['Criterion 2', 34, '`test/unit/club-directory-phone.test.tsx`'], ['Criterion 3', 33, '`test/a11y/clubs-directory-keys.spec.ts`'], ['Criterion 15', 38, '`test/a11y/clubs-reflow.spec.ts`']] as const) {
      const item = mapItem(id)
      const sentence = 'Built in WS09 step 35: '
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.endsWith(`Planned: WS09 step ${step}.`), id).toBe(true)
      expect(item.indexOf(sentence), id).toBeGreaterThan(item.indexOf('Built in WS09 step 33: '))
      expect(item.slice(item.indexOf(sentence)), id).toContain(test)
    }
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 35:')).map(head)).toEqual(['Criterion 2.', 'Criterion 3.', 'Criterion 15.'])
  })

  it('tags its deviations, verify items and follow-ups, the choices for K among them', () => {
    expect(tagged(deviations).map(head)).toEqual([
      'No row of who keeps the listings (WS09 step 35).', 'No region target on the contact (WS09 step 35).', 'The sheet\'s caption (WS09 step 35).', 'One button for the two rests (WS09 step 35).',
      'The browser specs\' names (WS09 step 35).', 'Checkpoint Y\'s own section (WS09 step 35).',
    ])
    expect(tagged(deviations).filter((l) => l.includes('A choice for K')).map(head)).toEqual([
      'No row of who keeps the listings (WS09 step 35).', 'No region target on the contact (WS09 step 35).', 'One button for the two rests (WS09 step 35).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'The board contact today (WS09 step 35).', 'The seat holder sees the sender (WS09 step 35).', 'No Volunteer page (WS09 step 35).', 'The representative\'s name shown (WS09 step 35).',
      'The phone layout\'s width and the dock (WS09 step 35).', 'The path of Suggest a club (WS09 step 35).', 'The counts the entry gives (WS09 step 35).',
    ])
    expect(tagged(followUps).map(head)).toEqual(['The phone layout on a phone (WS09 step 35).', 'What the phone layout answers (WS09 step 35).', 'The title strip on a phone (WS09 step 35).'])
  })

  it('keeps the plain-language rules in what the step wrote and in the files it adds', () => {
    const written = [block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps), ...['Criterion 2', 'Criterion 3', 'Criterion 15'].map((id) => mapItem(id).slice(mapItem(id).indexOf('Built in WS09 step 35: ')))].join('\n')
    const files = [...NEW_FILES, ...Object.keys(NEW_TESTS)].map((f) => read(f)).join('\n')
    for (const [name, rule] of [['dashes', DASHES], ['working words', BANNED], ['tools', TOOLS], ['bare letters', BARE], ['old initials', OLD_INITIALS], ['unfilled', UNFILLED], ['he', HE]] as const) {
      expect(written, name).not.toMatch(rule)
      // The files' code calls .slice(), so the working words are read in their comments alone.
      const text = name === 'working words' ? files.split('\n').filter((l) => /^\s*(?:\/\/|\*)/.test(l)).join('\n') : files
      if (name !== 'unfilled' && name !== 'he') expect(text, name).not.toMatch(rule)
    }
    expect(read(SELF)).not.toMatch(DASHES)
  })
})
