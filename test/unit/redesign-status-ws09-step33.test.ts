// test/unit/redesign-status-ws09-step33.test.ts
//
// REDESIGN_STATUS.md records WS09's thirty-third step, the directory and its
// map, the second of the plan's four steps of checkpoint Y. Like step 32's
// record test, this file reads only the WS09 section, from its heading to the
// WS10 heading. Pinned here: this step's block right after step 32's, and
// before the four lists while it is the latest; the Status line's clause and
// tail while this step is the latest; the block's parts in order and this
// step's own figures, which must agree with the files they describe; the
// sentences this step added to the map; the tagged entries of the lists; and
// the plain-language rules over what the step wrote and the files it adds.
// It counts no file of the whole tree, holds no line of another file by its
// number, and no line here reads how a switch ships.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PIN_RING } from '../../src/areas/clubs/directoryPins'
import { CONFIRM_FIRST, MAP_KEY, NO_CLUBS, NO_MAP, THIN_CARD, FAILED, SLOW, listCaption, stripLine } from '../../src/areas/clubs/directoryWords'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|${'Z' + 'Z'}[A-Z]|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|${'CHECKS' + '_LINE'}|[\\u00ab\\u00bb]|[A-Z]+_(?:${['WORDS', 'LINE', 'BYTES', 'SHA', 'CASES', 'RESULT', 'OWED'].join('|')})\\b`)
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
const TAG = '(WS09 step 33).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 32: the list\'s answer and the order'
const STEP = '### WS09 step 33: the directory and its map'
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
const latest = latestStep === 33 && latestBlock === STEP
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''

const SELF = 'test/unit/redesign-status-ws09-step33.test.ts'
const C = 'src/areas/clubs/'
const NEW_FILES = [
  'src/pages/ClubsIndexPage.tsx', `${C}components/ClubDirectory.tsx`, `${C}components/ClubCard.tsx`, `${C}components/DirectoryMap.tsx`, `${C}directoryPins.ts`, `${C}directoryWords.ts`,
  `${C}directoryRows.ts`, 'test/unit/fixtures/clubs-page-base-markup.json',
]
/** Each new test with the count of cases its run gives. */
const NEW_TESTS: Record<string, number> = {
  'test/unit/club-map-pins.test.ts': 12,
  'test/unit/club-directory.test.tsx': 16,
  'test/unit/clubs-index-page.test.tsx': 6,
  'test/unit/clubs-page-base-markup.test.tsx': 2,
  'test/a11y/clubs-directory.spec.ts': 13,
  'test/a11y/clubs-directory-keys.spec.ts': 6,
  'test/unit/club-directory-edges.test.tsx': 17,
  'test/unit/clubs-index-page-edges.test.tsx': 5,
  'test/integration/clubs-directory-site-reads.test.ts': 7,
}
/** Each test this step grew, from its count on the base to its count now. */
const GROWN_TESTS: Record<string, [number, number]> = { 'test/unit/club-pages-no-dates.test.tsx': [9, 11] }
const CHANGED = ['src/App.tsx', `${C}components/LCAMap.tsx`, ...Object.keys(GROWN_TESTS)]
const MOVED = ['test/unit/redesign-status-ws09-step32.test.ts', 'test/unit/redesign-status-ws09-w-review.test.ts', 'test/unit/redesign-status-ws09-switch-on-words.test.ts', 'test/unit/redesign-status-ws09-step21.test.ts']
const UNTOUCHED = [
  'src/pages/ClubsPage.tsx', `${C}clubMap.ts`, `${C}api.ts`, 'src/lib/features.ts', 'src/lib/nav.ts', 'test/a11y/scopes.spec.ts', 'test/a11y/scopes-edges.spec.ts', 'test/a11y/builds.spec.ts',
  'test/a11y/signedIn.ts', 'test/a11y/baseline.json', 'domain/contracts/registry.ts', 'test/unit/contracts-pending.ts', 'test/unit/fixtures/api-added-since-split.json',
  'functions/utils/auth.ts', 'functions/utils/email.ts', 'functions/utils/admin/campaigns.ts', 'test/integration/harness.ts',
]
/** What this step names, which no untouched file may hold. */
const OURS = /ClubsIndexPage|\bClubDirectory\b|DirectoryMap|directoryPins|directoryWords|directoryRows|WS09 step 33/
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,)]`).exec(files)?.[1])
/** A file's cases as its run gives them: every `it(` and `test(` line, and each case a loop of a size and a look writes. */
function casesIn(file: string): number {
  return (read(file).match(/^\s*(?:it|test)\(/gm) ?? []).length
}

describe('REDESIGN_STATUS.md, the thirty-third step of WS09: the block', () => {
  it('sits once, right after step 32\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s clause and its name among the built while it is the latest', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    const tail = statusLine.slice(statusLine.lastIndexOf('; ') + 2)
    if (latest) {
      expect(statusLine).toContain('WS09 step 33, the directory and its map, draws `/clubs` as the new directory, every club A to Z beside a map whose pins are buttons in the list\'s order, only with `newClubs` and `newLook` on and the list\'s wider answer, and today\'s Clubs page otherwise')
      expect(tail).toContain('checkpoint X\'s review and its fixes, step 32, step 33, K\'s answers to checkpoint S\'s review')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying where the step sits, what chooses the page and what ships', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the second of the plan\'s four steps of checkpoint Y (steps 32 to 35)', '`redesign/ws09-clubs-y`', '`875f2e6`', '`clubPagesOn()`', '`CLUB_PAGES_ON`', '`src/pages/ClubsIndexPage.tsx`',
      `\`${C}components/ClubDirectory.tsx\``, `\`${C}components/DirectoryMap.tsx\``, `\`${C}components/LCAMap.tsx\``, `\`${C}components/ClubCard.tsx\``, 'today\'s page to the byte',
      'No handler file, no switch and no migration is added.',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order, with the caption first among the judgement calls', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The choice.**', '- **The list and the map.**', '- **Cards and pins.**', '- **The ring.**', '- **The grey words.**', '- **With no map.**',
      '- **The keepers.**', '- **Today\'s map and its callers.**', '- **The map (criteria 1, 2, 3 and 15 on the directory).**', '- **Branch.**', '- **What the merge does.**',
      '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Rulings not kept.**',
      '- **Owed before newClubs goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const calls = bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l))
    expect(calls.length).toBeGreaterThanOrEqual(10)
    expect(calls[0]).toMatch(/^ {2}- The caption: /)
    // The entry's record lines, each in its part.
    for (const [name, words] of [
      ['- **The list and the map.**', 'On first paint every club of the answer, A to Z'],
      ['- **Cards and pins.**', 'Each card is one link to the club\'s page'],
      ['- **The ring.**', '4.46 to 1 in the light look and 4.46 to 1 in the dark look'],
      ['- **What ships with every switch off.**', 'Today\'s `/clubs`, unchanged'],
      ['- **Build.**', 'Bundle'],
    ] as const) expect(bullet(block, name), words).toContain(words)
  })

  it('names every file it adds and changes, each new test with its count, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...Object.keys(NEW_TESTS), SELF, ...CHANGED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...Object.keys(NEW_TESTS)]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const [file, count] of Object.entries(NEW_TESTS)) expect(writtenCount(files, file), file).toBe(count)
    for (const file of Object.keys(NEW_TESTS).filter((f) => f.startsWith('test/unit/'))) expect(casesIn(file), file).toBe(NEW_TESTS[file])
    // The browser spec writes four of its cases in a loop of two sizes and two looks, and two in a loop of two sizes.
    expect(casesIn('test/a11y/clubs-directory.spec.ts') + 3 + 1).toBe(NEW_TESTS['test/a11y/clubs-directory.spec.ts'])
    for (const [file, [from, to]] of Object.entries(GROWN_TESTS)) {
      expect(files, file).toContain(`\`${file}\` (${from} to ${to}: `)
      expect(casesIn(file), file).toBe(to)
    }
    expect(writtenCount(files, SELF)).toBe(casesIn(SELF))
    const grown = bullet(files, '  - Grown with no change:')
    for (const piece of ['48 tests, 29 on the base and the two new specs\' 13 and 6', '`test/unit/chrome-reads.test.ts` goes from 56 to 58', '`test/unit/app-routes.test.tsx` goes from 46 to 47', 'from 43 to 44', '117 handler files', '`test/unit/domain-boundaries.test.ts` does not move']) expect(grown, piece).toContain(piece)
    expect(read('test/unit/app-routes.test.tsx')).toContain('expect(pages.length).toBe(44)')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const file of UNTOUCHED) {
      expect(beyond, file).toContain(`\`${file}\``)
      expect(read(file), file).not.toMatch(OURS)
    }
    for (const dir of ['functions/utils/mail/', 'domain/mail/', 'workers/daily-emails/', 'src/components/layout/']) expect(beyond, dir).toContain(`\`${dir}\``)
  })
})

describe('REDESIGN_STATUS.md, the thirty-third step of WS09: the parts against the files', () => {
  it('gives the choice as the route and the thin page hold it', () => {
    const choice = bullet(block, '- **The choice.**')
    for (const piece of ['`clubPagesOn()`', '`getClubs()`', '`directoryRowsOf`', 'never half a directory', '`test/unit/clubs-index-page.test.tsx`']) expect(choice, piece).toContain(piece)
    expect(read('src/App.tsx')).toContain('<Route path="/clubs" element={clubPagesOn() ? <ClubsIndexPage /> : <ClubsPage />} />')
    expect(read('src/pages/ClubsIndexPage.tsx')).toContain('getClubs()')
    expect(read('src/pages/ClubsIndexPage.tsx')).toContain('directoryRowsOf(rows)')
  })

  it('gives the page\'s words as the code writes them, every count counted', () => {
    const list = bullet(block, '- **The list and the map.**')
    for (const piece of [`"${stripLine(8, 5)}"`, `"${listCaption(8)}"`, `"${NO_CLUBS}"`, `"${FAILED}"`, `"${SLOW}"`, '`REGIONS`', '`readDirectoryAddress`']) expect(list, piece).toContain(piece)
    expect(listCaption(8)).toContain(CONFIRM_FIRST)
    const cards = bullet(block, '- **Cards and pins.**')
    for (const piece of [`"${THIN_CARD}"`, `"${MAP_KEY}"`, '`aria-pressed`', '"All of Louisiana"', '"Skip to the map"', 'with no number']) expect(cards, piece).toContain(piece)
    expect(bullet(block, '- **With no map.**')).toContain(`"${NO_MAP}"`)
  })

  it('gives the ring and the grey words with their figures, and the ring\'s colour as the code holds it', () => {
    const ring = bullet(block, '- **The ring.**')
    expect(PIN_RING).toBe('#866a1e')
    for (const piece of [`\`${PIN_RING}\``, '`#f2efe6`', '4.58 to 1 on `#f4f2ec`', '4.27 on `#eeeadf`', '3.36 on the water, `#bfd4e6`', '1.98 to 1 on the paper', 'brand gold is never drawn on the map']) {
      expect(ring, piece).toContain(piece)
    }
    const grey = bullet(block, '- **The grey words.**')
    for (const piece of ['`#5b6478` on `#ffffff`, 5.93 to 1', '`#9aa6bf` on `#111a2c`, 7.10 to 1']) expect(grey, piece).toContain(piece)
  })

  it('says no keeper is named, and the stand-in, today\'s callers and the branch as the files hold them', () => {
    expect(bullet(block, '- **The keepers.**')).toContain('No keeper is named, by K\'s decision 12')
    const none = bullet(block, '- **With no map.**')
    for (const piece of ['`lcaMapStandIn`', '`mapSource`', 'no script of the provider\'s', 'step 35\'s']) expect(none, piece).toContain(piece)
    expect(read(`${C}directoryPins.ts`)).toContain('export const STAND_IN_FLAG = \'lcaMapStandIn\'')
    expect(read(`${C}directoryPins.ts`)).toContain('import.meta.env.MODE === \'a11y\'')
    const callers = bullet(block, '- **Today\'s map and its callers.**')
    for (const piece of ['`mode="directory"`', '`test/unit/clubs-page-base-markup.test.tsx`', '`test/unit/club-map-places.test.tsx`', '`test/unit/club-map-places-edges.test.tsx`']) expect(callers, piece).toContain(piece)
    expect(read(`${C}components/LCAMap.tsx`)).toContain('const DirectoryMap = lazy(() => import(\'@/areas/clubs/components/DirectoryMap\'))')
    expect(bullet(block, '- **Branch.**')).toContain('`redesign/ws09-clubs-y` at `875f2e6`, "WS09 step 32: The list\'s answer and the order"')
    const merge = bullet(block, '- **What the merge does.**')
    for (const piece of ['117 handler files', '58 of the 162 methods', '`PENDING_COUNT` still 104', '`deploy-worker.yml` does not run']) expect(merge, piece).toContain(piece)
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['whose file is the base\'s, every line', '`test/unit/clubs-page-base-markup.test.tsx`', 'run what they ran', 'No switch is added.']) expect(off, piece).toContain(piece)
  })

  it('names each moved pin by its file and what it now holds, the choices owed to K, the ruling not kept, and the build\'s figures', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of [...MOVED, 'test/a11y/scopes.spec.ts', 'test/a11y/scopes-edges.spec.ts', 'test/unit/goldText.test.ts', 'test/unit/club-list-callers.test.ts']) expect(pins, file).toContain(`\`${file}\``)
    expect(read(MOVED[0])).toContain('[\'src/areas/clubs/components/ClubDirectory.tsx\', \'src/areas/clubs/directoryWords.ts\'].includes(file) ? /nearZip|laPoints|answerDirectory/')
    expect(read(MOVED[1])).toContain('expect(one.endsWith(\'Planned: WS09 step 33.\')).toBe(true)')
    expect(read(MOVED[3])).toContain('expect(read(\'test/unit/app-routes.test.tsx\')).toContain(\'expect(pages.length).toBe(44)\')')
    expect(read(MOVED[2])).toContain('(file === \'test/unit/club-pages-no-dates.test.tsx\' ? 4 : 0)')
    const owed = bullet(block, '- **Owed before newClubs goes on.**').split('\n').filter((l) => l.startsWith('  - '))
    expect(owed).toHaveLength(3)
    for (const [i, piece] of ['without "300+ members"', 'the caption\'s second sentence', 'the layout below 1,024 pixels'].entries()) expect(owed[i], piece).toContain(piece)
    expect(bullet(block, '- **Rulings not kept.**')).toMatch(/^- \*\*Rulings not kept\.\*\* One, in part: ruling seven/)
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `875f2e6`')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-CrDF3D7U.js` at 523,761 bytes', '`index-BCAQ-6Nr.js` at 524,031', '`index-B62MA3MO.css` at 173,817 bytes', '`index-Cl4hRNEd.css` at 174,428',
      '`features-BFUKrFdH.js` stays at 741 bytes', '244 files, 237 on the base', 'keeps its 13,386 bytes',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, the thirty-third step of WS09: the Checks line, the map and the lists', () => {
  it('gives each figure once, in the forms the close reads, with the base\'s figures', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', ' over ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toMatch(/over [\d,]+ files \(1,526 on the base\)/)
    expect(checksLine).toMatch(/unit [\d,]+ tests in [\d,]+ files \(13,315 in 616 on the base\)/)
    expect(checksLine).toMatch(/integration [\d,]+ in [\d,]+ files \(3,968 in 222 on the base\)[^;]*with the one todo beside them/)
    expect(checksLine).not.toMatch(/that run in [\d,]+ files/)
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('the base\'s browser run 1,028 tests, 691 that run and 337 that skip')
    expect(checksLine).toContain('the third project by itself, 48 tests passing, 29 on the base')
  })

  it('adds one sentence to criteria 1, 2, 3 and 15, each before its planned step, and to no other item', () => {
    for (const [id, step] of [['Criterion 1', 33], ['Criterion 2', 34], ['Criterion 3', 33], ['Criterion 15', 38]] as const) {
      const item = mapItem(id)
      const sentence = 'Built in WS09 step 33: '
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.endsWith(`Planned: WS09 step ${step}.`), id).toBe(true)
      expect(item.indexOf(sentence), id).toBeLessThan(item.lastIndexOf('Planned: WS09 step'))
      expect(item.slice(item.indexOf(sentence)), id).toContain('`test/')
    }
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 33:')).map(head)).toEqual(['Criterion 1.', 'Criterion 2.', 'Criterion 3.', 'Criterion 15.'])
  })

  it('tags its deviations, verify items and follow-ups', () => {
    expect(tagged(deviations).map(head)).toEqual([
      'Five regions on the strip (WS09 step 33).', 'The browser spec\'s name (WS09 step 33).', 'Today\'s browser checks stay (WS09 step 33).', 'A thin page chooses (WS09 step 33).',
      'The ring in the light look\'s gold ink (WS09 step 33).', 'The pins are the page\'s buttons (WS09 step 33).', 'The five minutes said nowhere (WS09 step 33).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'The thin card (WS09 step 33).', 'Gold on the map (WS09 step 33).', 'Two clubs, one point (WS09 step 33).', 'The map in the browser tests (WS09 step 33).', 'Today\'s heading (WS09 step 33).',
      'The counts the entry gives (WS09 step 33).',
    ])
    expect(tagged(followUps).map(head)).toEqual(['The real map in a browser (WS09 step 33).', 'The phone\'s layout (WS09 step 33).', 'The address applied (WS09 step 33).'])
  })

  it('keeps the plain-language rules in what the step wrote and in the files it adds', () => {
    const written = [block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps), ...['Criterion 1', 'Criterion 2', 'Criterion 3', 'Criterion 15'].map((id) => mapItem(id).slice(mapItem(id).indexOf('Built in WS09 step 33: ')))].join('\n')
    const files = [...NEW_FILES.filter((f) => !f.endsWith('.json')), ...Object.keys(NEW_TESTS)].map((f) => read(f)).join('\n')
    for (const [name, rule] of [['dashes', DASHES], ['working words', BANNED], ['tools', TOOLS], ['bare letters', BARE], ['old initials', OLD_INITIALS], ['unfilled', UNFILLED], ['he', HE]] as const) {
      expect(written, name).not.toMatch(rule)
      // The files' code calls .slice(), so the working words are read in their comments alone.
      const text = name === 'working words' ? files.split('\n').filter((l) => /^\s*(?:\/\/|\*)/.test(l)).join('\n') : files
      if (name !== 'unfilled' && name !== 'he') expect(text, name).not.toMatch(rule)
    }
    expect(read(SELF)).not.toMatch(DASHES)
  })
})
