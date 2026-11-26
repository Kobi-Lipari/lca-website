// test/unit/redesign-status-ws09-step34.test.ts
//
// REDESIGN_STATUS.md records WS09's thirty-fourth step, a place, Near me and
// the filters, the third of the plan's four steps of checkpoint Y. Like step
// 33's record test, this file reads only the WS09 section, from its heading
// to the WS10 heading. Pinned here: this step's block right after step 33's,
// and before the four lists while it is the latest; the Status line's clause
// and tail while this step is the latest; the block's parts in order and this
// step's own figures, which must agree with the files they describe; the
// sentences this step added to the map; the tagged entries of the lists, the
// choices owed to K among them; and the plain-language rules over what the
// step wrote and the files it adds. It counts no file of the whole tree,
// holds no line of another file by its number, and no line here reads how a
// switch ships.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLACE_ZOOM } from '../../src/areas/clubs/directoryPins'
import { FARTHEST_MILES } from '../../src/areas/clubs/components/PlaceField'
import {
  CLEAR_PLACE, DEVICE_WAIT_MS, FIELD_LABEL, NEAREST_WHY, NO_DISTANCE, NOT_FOUND, OUTSIDE, OWN_WORD, SCHOLASTIC, START_A_CLUB, TYPING_PAUSE_MS, WEEKENDS, nearYou, noClubIn,
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
const TAG = '(WS09 step 34).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 33: the directory and its map'
const STEP = '### WS09 step 34: a place, Near me and the filters'
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
const latest = latestStep === 34 && latestBlock === STEP
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''

const SELF = 'test/unit/redesign-status-ws09-step34.test.ts'
const C = 'src/areas/clubs/'
const NEW_FILES = [`${C}components/PlaceField.tsx`, `${C}components/ClubFilters.tsx`]
/** Each new test with the count of cases its run gives. */
const NEW_TESTS: Record<string, number> = {
  'test/unit/place-field.test.tsx': 16,
  'test/unit/club-filters.test.tsx': 9,
  'test/unit/place-field-edges.test.tsx': 33,
  'test/unit/club-filters-edges.test.tsx': 13,
  'test/unit/near-town-words.test.ts': 12,
  'test/a11y/clubs-directory-place.spec.ts': 6,
}
const CHANGED = [`${C}components/ClubDirectory.tsx`, `${C}components/DirectoryMap.tsx`, `${C}directoryPins.ts`, `${C}directoryWords.ts`, 'domain/clubs/nearZip.ts']
const MOVED = ['test/unit/club-directory.test.tsx', 'test/unit/club-directory-edges.test.tsx', 'test/unit/near-zip.test.ts', 'test/unit/redesign-status-ws09-step32.test.ts', 'test/unit/base-components-scope.test.ts']
const UNTOUCHED = [
  'src/App.tsx', 'src/pages/ClubsPage.tsx', 'src/pages/ClubsIndexPage.tsx', `${C}components/LCAMap.tsx`, `${C}components/ClubCard.tsx`, `${C}clubMap.ts`, `${C}api.ts`, 'src/lib/features.ts', 'src/lib/nav.ts',
  'domain/clubs/order.ts', 'domain/clubs/directoryAddress.ts', 'domain/clubs/laPoints.ts', 'test/a11y/clubs-directory.spec.ts', 'test/a11y/clubs-directory-keys.spec.ts', 'test/a11y/builds.spec.ts',
  'test/a11y/signedIn.ts', 'test/a11y/global-setup.ts', 'test/a11y/baseline.json', 'domain/contracts/registry.ts', 'test/unit/contracts-pending.ts', 'test/unit/fixtures/api-added-since-split.json',
  'functions/utils/auth.ts', 'functions/utils/email.ts', 'functions/utils/admin/campaigns.ts', 'test/integration/harness.ts',
]
/** What this step names, which no untouched file may hold. */
const OURS = /PlaceField|ClubFilters|nearestTown|MapFocus|WS09 step 34/
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,)]`).exec(files)?.[1])
/** A file's cases as its run gives them: every `it(` and `test(` line. */
function casesIn(file: string): number {
  return (read(file).match(/^\s*(?:it|test)\(/gm) ?? []).length
}

/**
 * The cases WS09 checkpoint Y's review added to the directory's test files, each held to a fix of that review; the
 * block keeps the count each file had at its step.
 */
const Y_REVIEW_ADDED: Record<string, number> = {
  'test/unit/club-directory-phone.test.tsx': 2,
  'test/unit/club-directory.test.tsx': 5,
  'test/unit/club-list-callers.test.ts': 2,
  'test/unit/club-map-pins.test.ts': 11,
  'test/unit/la-places.test.ts': 1,
  'test/unit/near-town-words.test.ts': 2,
  'test/unit/place-field-edges.test.tsx': 3,
  'test/a11y/clubs-directory-keys.spec.ts': 2,
}

describe('REDESIGN_STATUS.md, the thirty-fourth step of WS09: the block', () => {
  it('sits once, right after step 33\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s clause and its name among the built while it is the latest', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    const tail = statusLine.slice(statusLine.lastIndexOf('; ') + 2)
    if (latest) {
      expect(statusLine).toContain('WS09 step 34, a place, Near me and the filters, gives the directory its one field, Near me, the two orders and the filters, with only a ZIP code kept in the address, only with `newClubs` and `newLook` on')
      expect(tail).toContain('checkpoint X\'s review and its fixes, step 32, step 33, step 34, K\'s answers to checkpoint S\'s review')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying where the step sits, what it builds and what ships', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the third of the plan\'s four steps of checkpoint Y (steps 32 to 35)', '`redesign/ws09-clubs-y`', '`5121e82`', '`clubPagesOn()`', `\`${C}components/PlaceField.tsx\``, `\`${C}components/ClubFilters.tsx\``,
      `\`${C}components/ClubDirectory.tsx\``, 'today\'s page to the byte', 'No handler file, no switch and no migration is added, and no file under `functions/` changes.',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order, with the outside sentence first among the judgement calls', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **Place and filters.**', '- **The orders.**', '- **The filters.**', '- **The caption.**', '- **The position stays on the device.**', '- **Denied.**',
      '- **The map.**', '- **The keepers.**', '- **The map (criteria 2 and 4 on the page).**', '- **Branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**',
      '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Rulings not kept.**', '- **Owed before newClubs goes on.**', '- **Pins moved.**', '- **Judgement calls.**',
      '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const calls = bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l))
    expect(calls.length).toBeGreaterThanOrEqual(8)
    expect(calls[0]).toMatch(/^ {2}- The outside sentence: /)
  })

  it('names every file it adds and changes, each new test with its count, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...Object.keys(NEW_TESTS), SELF, ...CHANGED, ...MOVED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...Object.keys(NEW_TESTS)]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const [file, count] of Object.entries(NEW_TESTS)) {
      expect(writtenCount(files, file), file).toBe(count)
      expect(casesIn(file), file).toBe(count + (Y_REVIEW_ADDED[file] ?? 0))
    }
    expect(writtenCount(files, SELF)).toBe(casesIn(SELF))
    // The pins moved in place: the step 33 tests keep their counts.
    expect(casesIn('test/unit/club-directory.test.tsx')).toBe(16 + Y_REVIEW_ADDED['test/unit/club-directory.test.tsx'])
    expect(casesIn('test/unit/club-directory-edges.test.tsx')).toBe(17)
    expect(casesIn('test/unit/near-zip.test.ts')).toBe(12)
    const grown = bullet(files, '  - Grown with no change:')
    for (const piece of ['54 tests, 48 on the base and the new spec\'s 6', '`test/unit/chrome-reads.test.ts` goes from 58 to 59', '117 handler files', '`test/unit/domain-boundaries.test.ts` does not move']) {
      expect(grown, piece).toContain(piece)
    }
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const file of UNTOUCHED) {
      expect(beyond, file).toContain(`\`${file}\``)
      expect(read(file), file).not.toMatch(OURS)
    }
    for (const dir of ['functions/', 'functions/utils/mail/', 'domain/mail/', 'workers/daily-emails/', 'src/components/layout/']) expect(beyond, dir).toContain(`\`${dir}\``)
  })
})

describe('REDESIGN_STATUS.md, the thirty-fourth step of WS09: the parts against the files', () => {
  it('gives the field, the orders and the filters in the words the code writes', () => {
    const place = bullet(block, '- **Place and filters.**')
    for (const piece of [`"${FIELD_LABEL}"`, `"${nearYou('Baton Rouge', '70808')}"`, `"${CLEAR_PLACE}"`, '"about N mi"', '"Farther than 75 miles"', `"${NO_DISTANCE}"`, `"${noClubIn('{town}')}"`, `"${START_A_CLUB}"`, '`/clubs/suggest?kind=start`', '`START_QUERY`', `"${OUTSIDE}"`]) {
      expect(place, piece).toContain(piece)
    }
    const orders = bullet(block, '- **The orders.**')
    for (const piece of ['"A to Z"', '"Nearest"', '`aria-pressed`', 'a check mark', `"${NEAREST_WHY}"`, '`aria-describedby`']) expect(orders, piece).toContain(piece)
    const filters = bullet(block, '- **The filters.**')
    for (const piece of ['`aria-expanded`', '`REGIONS`', `"${OWN_WORD}"`, `"${WEEKENDS}"`, `"${SCHOLASTIC}"`, '"Clear"', '"Done"', '`FilterChip`', '`directoryView`', '"Filters · 2 on"', 'no Copy link']) {
      expect(filters, piece).toContain(piece)
    }
    expect(bullet(block, '- **The caption.**')).toContain(`${TYPING_PAUSE_MS} milliseconds`)
    expect(bullet(block, '- **The caption.**')).toContain('`role="status"`')
  })

  it('gives what stays on the device, the refusal and the map with the figures the code holds', () => {
    const device = bullet(block, '- **The position stays on the device.**')
    for (const piece of ['`nearestZip`', '`placeFor`', 'no state, no storage, no log line and no request', '`test/unit/place-field.test.tsx`', `${FARTHEST_MILES} miles`, 'no reader of `near`']) expect(device, piece).toContain(piece)
    const denied = bullet(block, '- **Denied.**')
    for (const piece of [`"${NOT_FOUND}"`, 'the focus moves to the field', 'A to Z', `${DEVICE_WAIT_MS / 1000} seconds`, '`test/a11y/clubs-directory-place.spec.ts`']) expect(denied, piece).toContain(piece)
    const shown = bullet(block, '- **The map.**')
    for (const piece of ['"All of Louisiana"', `zoom ${PLACE_ZOOM}`, '`data-view`', 'three nearest', 'nothing is asked of the map\'s provider']) expect(shown, piece).toContain(piece)
    expect(bullet(block, '- **The keepers.**')).toContain('No keeper is named, by K\'s decision 12')
    expect(bullet(block, '- **Branch.**')).toContain('`redesign/ws09-clubs-y` at `5121e82`, "WS09 step 33: The directory and its map"')
    const merge = bullet(block, '- **What the merge does.**')
    // Since checkpoint Y's review: `domain/**` sends the worker's deploy, with its bundle unchanged (ruling A2).
    for (const piece of ['117 handler files', '58 of the 162 methods', '`PENDING_COUNT` still 104', '`deploy-worker.yml` redeploys the daily-emails worker with its bundle unchanged']) expect(merge, piece).toContain(piece)
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['Today\'s `/clubs`, unchanged', '`test/unit/clubs-page-base-markup.test.tsx`', 'run what they ran', 'No switch is added.']) expect(off, piece).toContain(piece)
  })

  it('names each moved pin by its file and what it now holds, the choices owed to K, and the build\'s figures', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of [...MOVED, 'test/unit/redesign-status-ws09-step33.test.ts', 'test/a11y/clubs-directory-keys.spec.ts']) expect(pins, file).toContain(`\`${file}\``)
    expect(read(MOVED[0])).toContain('reads the address on load and applies it, the filters narrowing the list, and writes it back canonical')
    expect(read(MOVED[1])).toContain('\'Filters\', \'Skip to the map\', \'a\', \'b\', \'c\'')
    expect(read(MOVED[2])).toContain('only the directory\\\'s field and page import the nearest ZIP code')
    expect(read(MOVED[4])).toContain('\'src/areas/clubs/components/ClubFilters.tsx\', \'src/areas/clubs/components/RepRequestSheet.tsx\'')
    expect(read(MOVED[3])).toContain('reads[file] ?? ([\'src/areas/clubs/components/ClubDirectory.tsx\', \'src/areas/clubs/directoryWords.ts\'].includes(file) ? /nearZip|laPoints|answerDirectory/')
    const owed = bullet(block, '- **Owed before newClubs goes on.**').split('\n').filter((l) => l.startsWith('  - '))
    // Since checkpoint Y's review the list carries the 25 mile rule as its fourth (ruling D2).
    expect(owed).toHaveLength(4)
    for (const [i, piece] of ['the outside sentence without Picayune', 'the reason beside Nearest', `"${NO_DISTANCE}"`, 'the 25 mile rule at the state line'].entries()) expect(owed[i], piece).toContain(piece)
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `5121e82`')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', '`index-BCAQ-6Nr.js` at 524,031 bytes', '`index-Cl4hRNEd.css` at 174,428 bytes', '`features-BFUKrFdH.js`']) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, the thirty-fourth step of WS09: the Checks line, the map and the lists', () => {
  it('gives each figure once, in the forms the close reads, with the base\'s figures', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', ' over ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toMatch(/over [\d,]+ files \(1,543 on the base\)/)
    expect(checksLine).toMatch(/unit [\d,]+ tests in [\d,]+ files \(13,392 in 623 on the base\)/)
    expect(checksLine).toMatch(/integration [\d,]+ in [\d,]+ files \(3,975 in 223 on the base\)[^;]*with the one todo beside them/)
    expect(checksLine).not.toMatch(/that run in [\d,]+ files/)
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('the base\'s browser run 1,047 tests, 710 that run and 337 that skip')
    expect(checksLine).toContain('the third project by itself, 54 tests passing, 48 on the base')
  })

  it('adds one sentence to criteria 2 and 4, each before its planned step, and to no other item', () => {
    for (const [id, test] of [['Criterion 2', '`test/unit/club-filters.test.tsx`'], ['Criterion 4', '`test/unit/place-field.test.tsx`']] as const) {
      const item = mapItem(id)
      const sentence = 'Built in WS09 step 34: '
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.endsWith('Planned: WS09 step 34.'), id).toBe(true)
      expect(item.indexOf(sentence), id).toBeGreaterThan(item.indexOf('Built in WS09 step 3' + (id === 'Criterion 2' ? '3' : '2') + ': '))
      expect(item.slice(item.indexOf(sentence)), id).toContain(test)
    }
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 34:')).map(head)).toEqual(['Criterion 2.', 'Criterion 4.'])
  })

  it('tags its deviations, verify items and follow-ups', () => {
    expect(tagged(deviations).map(head)).toEqual([
      'Five regions in the filter (WS09 step 34).', 'A typed place is read in the browser (WS09 step 34).', 'The outside sentence without Picayune (WS09 step 34).',
      'A second divider (WS09 step 34).', 'The browser spec\'s name (WS09 step 34).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'The components (WS09 step 34).', 'The states\' words (WS09 step 34).', 'Stronger than the brief (WS09 step 34).', 'The map is a provider\'s (WS09 step 34).', 'The counts the entry gives (WS09 step 34).',
    ])
    expect(tagged(followUps).map(head)).toEqual(['A real device in a browser (WS09 step 34).', 'Town names as the points file keeps them (WS09 step 34).', 'The phone\'s field over the map (WS09 step 34).'])
  })

  it('keeps the plain-language rules in what the step wrote and in the files it adds', () => {
    const written = [block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps), ...['Criterion 2', 'Criterion 4'].map((id) => mapItem(id).slice(mapItem(id).indexOf('Built in WS09 step 34: ')))].join('\n')
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
