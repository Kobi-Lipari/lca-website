// test/unit/redesign-status-ws09-w-takes-main-2.test.ts
//
// REDESIGN_STATUS.md records checkpoint W taking main in a second time, as
// main stood after the record's mend and the mail work's saved templates had
// merged. Like the record test of the first taking in, this file reads only
// the WS09 section, from its heading to the WS10 heading. Pinned here: the
// block right after the block of the new club page in the browser and before
// the four lists while it is the latest; its parts in order; what it says of
// the merge and of where the two sides meet, against the files; each moved
// pin against its file, with the count of handler files read from the routes'
// own test and never written here; its figures, which must agree with each
// other; and the plain-language rules over what the block wrote. No line here
// reads how a switch ships.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
const subBullets = (text: string) => text.split('\n').filter((l) => /^\s+- /.test(l))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 24: the new club page in the browser'
const BLOCK = '### Checkpoint W: WS09 main taken in again after the saved templates'
const LISTS = '### WS09 decisions'
const block = part(BLOCK)
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS) - 1] === BLOCK

const SELF = 'test/unit/redesign-status-ws09-w-takes-main-2.test.ts'
const ROUTES = 'test/unit/routes.test.ts'
/** The files whose one figure moved, each with its count of cases. */
const MOVED: ReadonlyArray<readonly [string, number]> = [
  ['test/unit/redesign-status-ws09-step20.test.ts', 22], ['test/unit/redesign-status-ws09-step21.test.ts', 22],
  ['test/unit/redesign-status-ws09-step22.test.ts', 21], ['test/unit/redesign-status-ws09-step23.test.ts', 21],
  ['test/unit/redesign-status-ws09-step24.test.ts', 18], ['test/unit/redesign-status-ws09-w-takes-main.test.ts', 9],
]
const HELD = [
  'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts',
  'test/a11y/signedIn.ts',
]
const num = (text: string) => Number(text.replace(/,/g, ''))
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])
/** The line of the routes' own test that holds the count of handler files under api, as the file has it. */
const countLine = /expect\(real\.filter\(\(r\) => r\.startsWith\('api\/'\)\)\.length\)\.toBe\(\d+\)/.exec(read(ROUTES))?.[0] ?? ''

describe('REDESIGN_STATUS.md, checkpoint W: main taken in again after the saved templates', () => {
  it('sits once, right after the block of the new club page in the browser, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS)
  })

  it('opens with why in one sentence, and has every part in order', () => {
    const opening = block.split('\n')[2] ?? ''
    expect(opening.split(/\.\s/).length).toBe(1)
    for (const piece of ['the record\'s mend', 'the mail work\'s saved templates', 'the tree that would merge']) expect(opening, piece).toContain(piece)
    const parts = ['- **What the merge holds.**', '- **Where the two meet.**', '- **What the merged tree asked.**', '- **Pins moved.**', '- **What ships with every switch off.**', '- Checks:', '- **Files.**', '- **Branch.**']
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })
})

describe('REDESIGN_STATUS.md, checkpoint W taking main in again: the parts against the files', () => {
  it('names the merge, its two parents by their subjects, the common commit, each file settled by hand and how nothing was dropped', () => {
    const holds = bullet(block, '- **What the merge holds.**')
    for (const piece of [
      '`0ec59cf`, "Merge main into redesign/ws09-clubs-w"', '`294cb1a`, "WS09 step 24: the new club page in the browser"',
      '`992b145`, "Newsletter page: saved templates, and the tutorial\'s first card (#150)"', '`18634b8`', '`9f522c9`, which changes no file', '`ea29ef9`',
      '`main` brings 29 files, all changed by the mail work\'s saved templates', 'Two files met and were settled by hand', '`test/unit/api-split-modules.test.ts`', `\`${ROUTES}\``,
      'Nothing of either side was dropped', '`git diff --stat 294cb1a` ends', '`git diff --stat 992b145` ends',
    ]) expect(holds, piece).toContain(piece)
    const routes = read(ROUTES)
    expect(countLine).not.toBe('')
    // Both sides' comment lines stand, main's route counted before checkpoint W's.
    const mains = routes.indexOf('// functions/api/admin/mail/newsletter/templates.ts, the newsletter\'s saved templates,')
    const ours = routes.indexOf('// functions/api/clubs/[id]/page.ts, the new club page\'s answer,')
    expect(mains).toBeGreaterThan(-1)
    expect(ours).toBeGreaterThan(mains)
    expect(routes.indexOf(countLine)).toBeGreaterThan(ours)
    for (const route of ['\'sitemap.xml\'', '\'robots.txt\'']) expect(routes, route).toContain(route)
    const paths = read('test/unit/api-split-modules.test.ts')
    for (const path of ['\'/api/admin/mail/newsletter/templates\'', '\'/api/clubs/*/page\'']) expect(paths, path).toContain(path)
  })

  it('says where the two meet, as the tree holds it, and that the saved templates brought no migration', () => {
    const meet = bullet(block, '- **Where the two meet.**')
    for (const piece of [
      '`domain/contracts/registry.ts`', '`clubs/[id]/page`', '`admin/mail/newsletter/templates`', '`test/unit/fixtures/api-added-since-split.json`', '`REDESIGN_STATUS.md` joined by itself',
      'No code of one side reads what the other changed', '`0072_regions_by_seat.sql` the newest',
    ]) expect(meet, piece).toContain(piece)
    const registry = read('domain/contracts/registry.ts')
    for (const key of ['\'clubs/[id]/page\': {', '\'admin/mail/newsletter/templates\': {']) expect(registry, key).toContain(key)
    const added = read('test/unit/fixtures/api-added-since-split.json')
    for (const path of ['"/api/admin/mail/newsletter/templates"', '"/api/clubs/*/page"']) expect(added, path).toContain(path)
    const migrations = readdirSync(join(ROOT, 'migrations')).filter((name) => /^\d{4}_/.test(name)).sort()
    if (latest) expect(migrations.at(-1)).toBe('0072_regions_by_seat.sql')
  })

  it('says what the merged tree asked, and names each moved pin by its file and its count, the figure read from the routes\' own test', () => {
    const asked = bullet(block, '- **What the merged tree asked.**')
    for (const piece of ['unit 12,344 tests in 547 files, 6 failing', 'integration 3,475 that run in 189 files, none failing', 'with the one todo beside them', 'six closed record tests', 'Anything else: none', 'No test of `main`\'s fails, and none is touched']) {
      expect(asked, piece).toContain(piece)
    }
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of ['the one figure and nothing else', 'no file\'s count of cases changes', 'stand as written', 'holds no count of its own']) expect(pins, piece).toContain(piece)
    expect(subBullets(pins)).toHaveLength(2)
    for (const [file, count] of MOVED) {
      expect(pins, file).toContain(`\`${file}\` (${count})`)
      expect(casesIn(file), file).toBe(count)
      // Each holds the line the routes' own test holds, whatever its figure is by now.
      expect(read(file), file).toContain(countLine.replace(/'/g, '\\\''))
    }
  })

  it('says what ships with every switch off, and names every file it changes and the branch', () => {
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of [
      'What the first taking in says, and nothing more', 'Every switch is as `main` ships it', '`CLUB_PAGES_ON` and `newClubs` stay off', 'K\'s choice 8 (a)', '`GET /api/clubs/{slug}`', '`GET /api/clubs/:id/page`',
      'This step adds no line of product', 'no migration, no table, no endpoint, no contract and no switch',
    ]) expect(off, piece).toContain(piece)
    const files = bullet(block, '- **Files.**')
    for (const file of [SELF, 'REDESIGN_STATUS.md']) expect(files, file).toContain(`\`${file}\``)
    expect(existsSync(join(ROOT, SELF))).toBe(true)
    expect(writtenCount(files, SELF)).toBe(casesIn(SELF))
    expect(files).toContain(`the ${['one', 'two', 'three', 'four', 'five', 'six'][MOVED.length - 1]} test files of Pins moved`)
    for (const piece of ['No product file is touched', 'No file the mail stream holds is touched', ...HELD.map((f) => `\`${f}\``)]) expect(files, piece).toContain(piece)
    for (const piece of ['`redesign/ws09-clubs-w`', '`0ec59cf`', 'pushed together']) expect(bullet(block, '- **Branch.**'), piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, checkpoint W taking main in again: the figures and the plain words', () => {
  it('gives each figure of the checks once, with checkpoint W\'s side beside it, the integration figure with the one todo beside it', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run in the build', 'the worker\'s dry run ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(checkpoint W's side 13 and 11 over 1,356; `main` brings five new files and this step one\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![1])).toBe(1356 + 5 + 1)
    const unit = /unit ([\d,]+) tests in (\d+) files \(12,294 in 545 on checkpoint W's side; 12,344 in 547 joined, before this step's record test\), every one passing/.exec(checksLine)
    expect(unit, 'the unit figures').not.toBeNull()
    // The merged tree's run before any change, and this file's own cases added to it.
    expect(num(unit![1])).toBe(12344 + casesIn(SELF))
    expect(Number(unit![2])).toBe(547 + 1)
    expect(checksLine).toMatch(/integration 3,475 tests that run in 189 files \(3,440 in 187 on checkpoint W's side\), every one passing, with the one todo beside them/)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, as on checkpoint W's side\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    for (const piece of [
      'a local production build', '`VITE_`', '`index-fk0AyRCw.js` at 520,712 bytes', '`index-DGvL9MYw.js` at 519,265', '`index-CGFkXpdq.css` at 171,910 bytes (171,757)', '`features-BFUKrFdH.js` at 741 bytes',
      '676 passed and 337 skipped', '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched', '76.61 KiB, gzip 20.53 KiB',
    ]) expect(checksLine, piece).toContain(piece)
  })

  it('keeps the dashes, the working words, any tool\'s name and the old initials out of what it wrote', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS]) expect(block).not.toMatch(rule)
    const prose = proseOf(block)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const file of [SELF, ...MOVED.map(([f]) => f)]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })
})
