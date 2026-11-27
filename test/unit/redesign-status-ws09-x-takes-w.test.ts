// test/unit/redesign-status-ws09-x-takes-w.test.ts
//
// REDESIGN_STATUS.md records checkpoint X taking in checkpoint W's three
// newer commits: a merge and its mend pass, none of the plan's 38 steps. Like
// the record tests of the blocks before it, this file reads only the WS09
// section, from its heading to the WS10 heading. Pinned here: the block right
// after step 25's and before the four lists while it is the latest; the
// Status line's tail while it is the latest; the block's parts in order and
// what they say, against the files they describe; and the Checks line's
// figures, which must agree with each parent's own block. No line here reads
// how a switch ships.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
import { PENDING_CONTRACTS } from './contracts-pending'
import { migrationFiles } from './helpers/sqlite'
import { collectRouteFiles, exportedMethods } from './routes'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|[${String.fromCharCode(0x27e6, 0x27e7)}]|\\b[A-Z]+[0-9]*_[A-Z_0-9]+\\b(?!\`)`)
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
const STEP_24 = '### WS09 step 24: the sitemap'
const W_BLOCKS = ['### Checkpoint W: WS09 what K\'s look at the test site asked', '### Checkpoint W: WS09 robots.txt names the sitemap', '### Checkpoint W: WS09 the written page reads as a page']
const PREVIOUS = '### WS09 step 25: the limit and the spam check'
const BLOCK = '### Checkpoint X: WS09 checkpoint W\'s newer commits taken in'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksOf = (text: string) => text.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const checksLine = checksOf(block)
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === BLOCK
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''

const SELF = 'test/unit/redesign-status-ws09-x-takes-w.test.ts'
const STEP_25_TEST = 'test/unit/redesign-status-ws09-step25.test.ts'
const CONFIRM = 'functions/api/clubs/confirm/[token].ts'
const PAGE = 'src/pages/ClubConfirmPage.tsx'
const HELD = [
  'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts',
  'test/a11y/signedIn.ts',
]
const num = (text: string) => Number(text.replace(/,/g, ''))
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** A test file's case titles as they read, their escaped quotes put back. */
const titlesOf = (file: string) => read(file).replace(/\\'/g, '\'')
/** Every TypeScript file under a folder of the tree. */
function filesUnder(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = `${dir}/${name}`
    if (statSync(join(ROOT, path)).isDirectory()) return filesUnder(path)
    return /\.tsx?$/.test(name) ? [path] : []
  })
}
/** The page routes outside functions/api, from the tree: every file under functions/ but api, utils and db that exports a handler. */
const pageRoutes = () =>
  collectRouteFiles(join(ROOT, 'functions'))
    .filter((r) => !['api', 'utils', 'db'].includes(r.segments[0]))
    .map((r) => r.file.slice(ROOT.length + 1).split('\\').join('/'))
    .filter((f) => exportedMethods(read(f)).length > 0)
    .sort()

describe('REDESIGN_STATUS.md, checkpoint X: checkpoint W\'s newer commits taken in', () => {
  it('sits once, right after step 25\'s block, with checkpoint W\'s three blocks before step 25\'s, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(BLOCK)
    // Since checkpoint X took checkpoint W in with main as it stands, checkpoint W's five newer blocks follow the three, before step 25's.
    const before25 = headings.slice(headings.indexOf(STEP_24) + 1, headings.indexOf(PREVIOUS))
    expect(before25.slice(0, W_BLOCKS.length)).toEqual(W_BLOCKS)
    if (latest) expect(before25).toEqual(W_BLOCKS)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line its tail while it is the latest, with checkpoint W\'s clauses before step 25\'s, and keeps the heading and the pull request numbers', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'is on, and checkpoint X takes in checkpoint W\'s newer commits, so its forms are built on the club page as K\'s notes left it; steps 1 to 14',
        'the written page\'s look, step 25, checkpoint W\'s newer commits taken into checkpoint X, K\'s answers',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail.indexOf('on K\'s decision 12')).toBeGreaterThan(-1)
    // Since checkpoint X's review the clause reads that checkpoint X is built and reviewed, where it read under way.
    expect(tail.indexOf('on K\'s decision 12')).toBeLessThan(tail.indexOf('checkpoint X, steps 25 to 31, is built and reviewed'))
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens with why, says it is none of the plan\'s steps, and has every part in order', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'Checkpoint X\'s branch was cut from checkpoint W\'s head at WS09 step 24\'s sitemap', 'so this merge takes them into `redesign/ws09-clubs-x`', 'as K\'s notes left it',
      'It is none of the plan\'s 38 steps', 'it changes no code, and adds no migration, no endpoint, no contract and no switch',
    ]) expect(opening, piece).toContain(piece)
    const parts = [
      '- **What the merge holds.**', '- **Where the two meet.**', '- **What the merged tree asked.**', '- **Pins moved.**', '- **What ships with every switch off.**',
      '- **What the merge carries.**', '- Checks:', '- **Files.**', '- **Branch.**',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const branch = bullet(block, '- **Branch.**')
    for (const piece of ['`redesign/ws09-clubs-x`', '`40e0586`', 'whose parents are `d0779a4` and `216e7ae`', 'this block\'s diff is against `40e0586`']) expect(branch, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, checkpoint X, W taken in: the parts against the files', () => {
  it('names both parents and the one conflict, says nothing was dropped and how that was checked, and says where the two meet, as the files hold it', () => {
    const holds = bullet(block, '- **What the merge holds.**')
    for (const piece of [
      '`40e0586`', '`d0779a4`, "WS09 step 25: the limit and the spam check (checkpoint X)"', '`216e7ae`, "WS09 the written page reads as a page (checkpoint W)"', '`ad47e8a`',
      '`b6bf464`', '`9549f4f`', 'One file conflicted, `REDESIGN_STATUS.md`, in two places', 'Nothing of either side was dropped', 'overlap in `REDESIGN_STATUS.md` alone',
      'compared file by file', '`42 files changed, 8054 insertions(+), 49 deletions(-)`', '`42 files changed, 2962 insertions(+), 305 deletions(-)`', '43 files and 44 files',
    ]) expect(holds, piece).toContain(piece)
    // Each side's lines kept: step 25's sentences on the map, and checkpoint W's closing of step 24's follow-up.
    for (const id of ['Criterion 4', 'Criterion 8']) expect(map.split('\n').find((l) => l.startsWith(`- **${id}.**`)), id).toContain('Built in WS09 step 25: ')
    const followUp = followUps.split('\n').find((l) => l.startsWith('- **How a search engine learns of the sitemap (WS09 step 24).**')) ?? ''
    expect(followUp).toContain(' Closed in checkpoint W by K\'s decision 11, choice 3 (a): ')
    const meet = bullet(block, '- **Where the two meet.**')
    for (const piece of [
      'Nowhere in the code', '`domain/contracts/clubPage.ts` names no author key', '"Last checked"', '30 calls an hour from one place', 'still the one caller of `limit`',
      '`src/pages/ClubConfirmPage.tsx` reads nothing of the club page\'s answer', '`test/integration/harness.ts` is step 25\'s', '`0071_rate_limits.sql` the newest',
      '"No schema changes, nothing to migrate"', 'No production or preview database was read or written',
    ]) expect(meet, piece).toContain(piece)
    expect(codeOf('domain/contracts/clubPage.ts')).not.toMatch(/\bauthor\w*\s*:/)
    expect(codeOf('functions/utils/clubs/authorLine.ts')).toContain('`Last checked ${month}`')
    expect(codeOf(CONFIRM)).toContain('export const LINK_CALLS_AN_HOUR = 30')
    expect(codeOf(CONFIRM).match(/await limit\(/g) ?? []).toHaveLength(1)
    expect(read(PAGE)).not.toMatch(/clubPage|pageAnswer/)
    expect(read('test/integration/harness.ts')).toContain('if (url.hostname === \'challenges.cloudflare.com\' && url.pathname === \'/turnstile/v0/siteverify\') {')
    if (!latest) return
    expect(filesUnder('functions').filter((f) => /\bawait limit\(/.test(codeOf(f)))).toEqual([CONFIRM])
    expect(migrationFiles()).toHaveLength(68)
    expect(migrationFiles().at(-1)).toBe('0071_rate_limits.sql')
    expect((JSON.parse(read('drizzle/meta/_journal.json')) as { entries: unknown[] }).entries).toHaveLength(17)
  })

  it('sorts what the merged tree asked by kind, names the moved pin by its file and title, and the owed lists it finds', () => {
    const asked = bullet(block, '- **What the merged tree asked.**')
    for (const piece of [
      'unit 11,274 tests in 494 files with 2 failing, both in `test/unit/redesign-status-ws09-step25.test.ts`',
      'integration 3,004 in 176 files, every one passing, with the one todo beside them', 'A meeting of the two branches\' code: none',
    ]) expect(asked, piece).toContain(piece)
    expect(subBullets(asked)).toHaveLength(5)
    const titles = titlesOf(STEP_25_TEST)
    for (const title of [
      'sits once, right after step 24\'s block, and before the four lists while it is the latest',
      'gives the Status line this step\'s tail while this step is the latest, and keeps the section\'s heading and the pull request numbers',
    ]) {
      expect(asked, title).toContain(`"${title}"`)
      expect(titles, title).toContain(`it('${title}'`)
    }
    expect(titles).toContain('\'the sitemap of step 24, step 25,\'')
    // The found and not mended: step 25's sixteen owed still hold the three checkpoint W settled; the robots.txt block's ten do not.
    expect(asked).toContain('the ten of the block of the `robots.txt` with step 25\'s three')
    expect(subBullets(bullet(part(W_BLOCKS[1]), '- **What K still owes before newClubs goes on.**'))).toHaveLength(10)
    expect(subBullets(bullet(part(PREVIOUS), '- **Owed before newClubs goes on.**'))).toHaveLength(16)
    // The Status and PR lines still read checkpoint V as waiting; the block names that and leaves both lines as they stand.
    expect(asked).toContain('The Status line and the PR line still read checkpoint V as waiting for K\'s word for its merge')
    expect(asked).toContain('pull request 134, `498ec7f`, on Tue, Nov 17, 2026')
    // Checkpoint W's lines, taken in with main as it stands, name the pull request between the two pieces.
    expect(statusLine).toContain('and waits in draft pull request 134 for K\'s word for its merge')
    expect(lines.find((l) => l.startsWith('**PR:**'))).toContain('waits in draft pull request 134 for K\'s word for its merge')
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      `\`${STEP_25_TEST}\``, '"sits once, right after step 24\'s block, and before the four lists while it is the latest"', '`PREVIOUS`',
      '"Checkpoint W: WS09 the written page reads as a page"', 'no test file changes its count of cases', 'no case is deleted or skipped', '`test/unit/redesign-status-ws09-step1.test.ts`',
    ]) expect(pins, piece).toContain(piece)
    expect(read(STEP_25_TEST)).toContain('const PREVIOUS = \'### Checkpoint W: WS09 the written page reads as a page\'')
    expect(writtenCount(bullet(block, '- **Files.**'), STEP_25_TEST)).toBe(casesIn(STEP_25_TEST))
    expect(read('test/unit/redesign-status-ws09-step1.test.ts')).toContain('Checkpoint [S-Z]: WS09 ')
    expect(BLOCK).toMatch(/^### Checkpoint [S-Z]: WS09 /)
  })

  it('says what ships is each parent\'s, and gives what the merge carries beside each parent\'s figures', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of [
      'As each parent\'s blocks say, and nothing new', 'behind `CLUB_PAGES_ON`', 'one empty table, `rate_limits`', '30 calls an hour from one place wherever `CLUB_KEEPERS_ON` is on',
      'No switch is added and none changes',
    ]) expect(ships, piece).toContain(piece)
    const carries = bullet(block, '- **What the merge carries.**')
    for (const piece of [
      '105 handler files under `functions/api`', '41 of the 145 methods there contracted', '`PENDING_COUNT` 104', 'a local production build', '`VITE_`', '214 files in `dist/assets`',
      '`index-D8ekMO07.js` at 559,676 bytes', '`index-EymzK9bA.js` on checkpoint W\'s head', '`index-Df1Lv5gj.js` on step 25\'s', '`index-DpyXZnV6.css` at 138,073 bytes',
      '`index-YvQuSpxy.css` was the base\'s 138,154', '`features-nZCZoT6G.js` at 729 bytes', 'at 3,292 bytes', '`challenges.cloudflare.com`, is in no file of `dist/`',
      '76.61 KiB, gzip 20.53 KiB', '78,449 bytes', '13 errors and 11 warnings, as on each parent',
    ]) expect(carries, piece).toContain(piece)
    // The parents' own Build lines, which the figures stand beside.
    const wBuild = bullet(part(W_BLOCKS[2]), '- **Build.**')
    for (const piece of ['`index-EymzK9bA.js` at 559,676 bytes', '`index-DpyXZnV6.css` at 138,073 bytes', '`features-nZCZoT6G.js` at 729 bytes', '76.61 KiB, gzip 20.53 KiB']) expect(wBuild, piece).toContain(piece)
    const xBuild = bullet(part(PREVIOUS), '- **Build.**')
    for (const piece of ['The main script is 559,676 bytes', '`index-Df1Lv5gj.js`', '`index-YvQuSpxy.css` at 138,154', 'from 3,288 bytes to 3,292', '76.61 KiB, gzip 20.53 KiB']) expect(xBuild, piece).toContain(piece)
    const sha = /sha256 `([0-9a-f]{64})`/.exec(carries)?.[1]
    expect(sha).toBe(/sha256 `([0-9a-f]{64})`/.exec(wBuild)?.[1])
    if (!latest) return
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(105)')
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(41)
    expect(PENDING_CONTRACTS).toHaveLength(104)
    expect(pageRoutes()).toEqual(['functions/clubs/[id].ts', 'functions/news/[slug].ts', 'functions/robots.txt.ts', 'functions/sitemap.xml.ts', 'functions/tournaments/[id].ts'])
  })
})

describe('REDESIGN_STATUS.md, checkpoint X, W taken in: the figures and the plain words', () => {
  it('gives each figure of the checks once, the merged tree\'s beside each parent\'s as its own block gives it, and counts that add up', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('the merged tree\'s from Wednesday, November 18, 2026')
    const w = checksOf(part(W_BLOCKS[2]))
    const x = checksOf(part(PREVIOUS))
    const both = '\\(([\\d,]+) in (\\d+) on checkpoint W\'s head, ([\\d,]+) in (\\d+) on step 25\'s\\)'
    const unit = new RegExp(`unit ([\\d,]+) tests in (\\d+) files ${both}, every one passing`).exec(checksLine)
    const wUnit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\)/.exec(w)
    const xUnit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\)/.exec(x)
    expect(unit, 'the unit counts').not.toBeNull()
    expect([num(unit![3]), Number(unit![4])]).toEqual([num(wUnit![1]), Number(wUnit![2])])
    expect([num(unit![5]), Number(unit![6])]).toEqual([num(xUnit![1]), Number(xUnit![2])])
    const files = bullet(block, '- **Files.**')
    expect(writtenCount(files, SELF)).toBe(casesIn(SELF))
    expect(num(unit![1])).toBe(num(wUnit![1]) + num(xUnit![1]) - num(xUnit![3]) + casesIn(SELF))
    expect(Number(unit![2])).toBe(Number(wUnit![2]) + Number(xUnit![2]) - Number(xUnit![4]) + 1)
    // The integration figures count the tests that run, as the gate gives them; the one todo stands beside them.
    const integration = new RegExp(`integration ([\\d,]+) in (\\d+) files ${both}, every one passing, with the one todo beside them`).exec(checksLine)
    const wInt = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\)/.exec(w)
    const xInt = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\)/.exec(x)
    expect(integration, 'the integration counts').not.toBeNull()
    expect([num(integration![3]), Number(integration![4])]).toEqual([num(wInt![1]), Number(wInt![2])])
    expect([num(integration![5]), Number(integration![6])]).toEqual([num(xInt![1]), Number(xInt![2])])
    expect(num(integration![1])).toBe(num(wInt![1]) + num(xInt![1]) - num(xInt![3]))
    expect(Number(integration![2])).toBe(Number(wInt![2]) + Number(xInt![2]) - Number(xInt![4]))
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(([\d,]+) on checkpoint W's head, ([\d,]+) on step 25's\), none new/.exec(checksLine)
    const parentLint = (line: string) => /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(([\d,]+) on the base\)/.exec(line)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(num(parentLint(w)![1]))
    expect(num(lint![3])).toBe(num(parentLint(x)![1]))
    expect(num(lint![1])).toBe(num(lint![2]) + num(lint![3]) - num(parentLint(x)![2]) + 1)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on each parent\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    for (const line of [w, x]) expect(/`npm run build` \((\d+) files in `dist\/assets`/.exec(line)?.[1]).toBe(built?.[2])
    expect(built?.[1]).toBe(checked?.[1])
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what it wrote and the files it touches, and leaves the held files alone', () => {
    const written = [block, statusLine].join('\n')
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS]) expect(written).not.toMatch(rule)
    const prose = proseOf(written)
    expect(prose).not.toMatch(UNFILLED)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const found of prose.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b(?!:)/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    for (const file of [SELF, STEP_25_TEST]) {
      const text = read(file)
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
    const files = bullet(block, '- **Files.**')
    for (const piece of ['No file the mail stream holds is touched', ...HELD.map((f) => `\`${f}\``), '`test/integration/harness.ts`', '`src/lib/features.ts`']) expect(files, piece).toContain(piece)
    for (const file of [...HELD, 'src/lib/features.ts']) expect(read(file), file).not.toMatch(/Checkpoint X: WS09|checkpoint W's newer commits/)
  })
})
