// test/unit/redesign-status-ws09-w-written-look.test.ts
//
// REDESIGN_STATUS.md records the small step of checkpoint W that makes the
// club page's written body read as a page before the app draws. Like the
// record test of the block before it, this file reads only the WS09 section,
// from its heading to the WS10 heading. Pinned here: the block right after
// the block of robots.txt and before the four lists while it is the latest;
// the Status line's tail while it is the latest; the block's parts in order
// and its figures, which must agree with each other and with the files they
// describe; and the plain-language rules over what the block wrote and the
// files it adds. No line here reads how a switch ships.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WRITTEN_PAGE_MARK, WRITTEN_PAGE_STYLE } from '../../functions/utils/clubs/pageHtml'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|[${String.fromCharCode(0x27e6, 0x27e7)}]|\\b[A-Z]+[0-9]*_[A-Z_0-9]+\\b(?!\`)|${'LINT' + 'LINE'}|${'BUILD' + 'LINE'}|${'CHECKS' + 'LINE'}|${'RECORD' + 'COUNT'}`)
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
const PREVIOUS = '### Checkpoint W: WS09 robots.txt names the sitemap'
const BLOCK = '### Checkpoint W: WS09 the written page reads as a page'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === BLOCK

const HTML = 'functions/utils/clubs/pageHtml.ts'
const NEW_TESTS = [
  'test/integration/club-written-look.test.ts', 'test/integration/club-written-look-edges.test.ts', 'test/unit/club-written-look-scope.test.tsx',
  'test/unit/club-written-look-guard.test.ts', 'test/unit/redesign-status-ws09-w-written-look.test.ts',
]
/** The test files whose checks this step makes false, each changed in place and keeping its count. */
const MOVED = ['test/integration/club-page-route.test.ts', 'test/integration/club-page-route-edges.test.ts', 'test/unit/club-page-html.test.tsx']
const HELD = [
  'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts',
  'test/a11y/signedIn.ts',
]
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])
/** What the look adds to each club page: the wrapper's mark, with its space, and the style element. */
const ADDED = ` ${WRITTEN_PAGE_MARK}`.length + `<style>${WRITTEN_PAGE_STYLE}</style>`.length

describe('REDESIGN_STATUS.md, checkpoint W: the written page reads as a page', () => {
  it('sits once, right after the block of robots.txt, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line its tail while it is the latest, and keeps the pull request numbers', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'and the club page\'s written body reads as a plain page before the app draws, by one small style element of its own, only with `CLUB_PAGES_ON` set;',
        'the `robots.txt` that names the sitemap, the written page\'s look, K\'s answers',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens with why in two sentences, and has every part in order', () => {
    const opening = block.split('\n')[2] ?? ''
    expect(opening.split(/\.\s/).length).toBe(2)
    for (const piece of ['WS09 step 23\'s pictures', 'before the app draws', 'scripts off', 'changes how that written body looks and nothing of what it says', '`CLUB_PAGES_ON`']) {
      expect(opening, piece).toContain(piece)
    }
    const parts = [
      '- **What a person meets.**', '- **What does not change.**', '- **How.**', '- **The site\'s own colours.**', '- **Scoped.**', '- **Nothing of a club in the styling.**',
      '- **What it weighs.**', '- **What ships with every switch off.**', '- **The pictures.**', '- **Pins moved.**', '- **Grown with no change.**', '- **The judgement calls.**',
      '- **Follow-ups.**', '- **What the merge carries.**', '- **Lint.**', '- **Build.**', '- Checks:', '- **Files.**', '- **Branch.**',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const calls = subBullets(bullet(block, '- **The judgement calls.**')).join('\n')
    for (const piece of ['The measure', 'The sizes', 'The underline', 'A style element over classes']) expect(calls, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, checkpoint W, the written page: the parts against the files', () => {
  it('says what a person meets at each width and in each scheme, as the styling sets it', () => {
    const meets = bullet(block, '- **What a person meets.**')
    for (const piece of ['42rem', '1rem', '2rem', '1.375rem', '1.125rem', 'every link underlined', '320 and 390', '1280', 'the dark', 'scripts off for good', 'today\'s behaviour for every page']) {
      expect(meets, piece).toContain(piece)
    }
    for (const piece of ['max-width:42rem', 'padding:2rem 1rem 3rem', 'h1{font-size:2rem', 'h2{font-size:1.375rem', 'h3{font-size:1.125rem', 'a{text-decoration:underline}']) {
      expect(WRITTEN_PAGE_STYLE, piece).toContain(piece)
    }
  })

  it('says how the styling is written, why that way, its scope and what happens when the app draws, as the code holds it', () => {
    const how = bullet(block, '- **How.**')
    for (const piece of ['`<main data-club-written-page>`', '`clubPageBody`', '`WRITTEN_PAGE_STYLE`', '`WRITTEN_PAGE_MARK`', 'no content security policy', '`createRoot`', 'the wrapper is gone']) {
      expect(how, piece).toContain(piece)
    }
    expect(read(HTML)).toContain('return `<main ${WRITTEN_PAGE_MARK}><style>${WRITTEN_PAGE_STYLE}</style>${words}</main>`')
    expect(read('src/main.tsx')).toContain('createRoot(document.getElementById(\'root\')!).render(')
    for (const file of ['public/_headers', 'index.html', 'functions/clubs/[id].ts']) expect(read(file), file).not.toMatch(/Content-Security-Policy/i)
    expect(readdirSync(join(ROOT, 'functions')).filter((name) => name.startsWith('_middleware'))).toEqual([])
    expect(bullet(block, '- **Scoped.**')).toContain('`main[data-club-written-page]`')
    expect(WRITTEN_PAGE_MARK).toBe('data-club-written-page')
  })

  it('says no colour, nothing of a club, the weight, and what ships, as the files give them', () => {
    expect(bullet(block, '- **The site\'s own colours.**')).toContain('no colour, no background, no font family and no font file')
    expect(WRITTEN_PAGE_STYLE).not.toMatch(/colou?r|background|font-family/)
    expect(bullet(block, '- **Nothing of a club in the styling.**')).toContain('the style element\'s bytes are the same as for any other club')
    const weighs = bullet(block, '- **What it weighs.**')
    expect(weighs).toContain(`${ADDED} bytes on each club page's HTML`)
    expect(weighs).toContain(`the styling's ${WRITTEN_PAGE_STYLE.length}`)
    expect(ADDED).toBeLessThan(1024)
    expect(bullet(block, '- **What ships with every switch off.**')).toContain('nothing a person or a crawler meets changes')
  })

  it('names each moved pin by its file and title, the follow-up, and the pictures', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) {
      expect(pins, file).toContain(`\`${file}\``)
      expect(read(file), file).toContain('const plainOf = ')
    }
    expect(pins).toContain('no earlier step\'s test file changes its count of cases')
    expect(subBullets(pins)).toHaveLength(6)
    expect(bullet(block, '- **Grown with no change.**')).toContain('None')
    const follow = bullet(block, '- **Follow-ups.**')
    for (const piece of ['no way to the rest of the site', 'a link home is a question for K, not built here', '"The plain page before the scripts"']) expect(follow, piece).toContain(piece)
    const pictures = bullet(block, '- **The pictures.**')
    for (const piece of ['"Example Knights Club"', '"Example Chess Club"', '320, 390 and 1280', 'in the light and on a device set to the dark', '200 percent zoom', 'No width scrolled sideways', 'step 23\'s own']) {
      expect(pictures, piece).toContain(piece)
    }
  })

  it('names every file it adds with its count of cases, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [HTML, ...NEW_TESTS, 'REDESIGN_STATUS.md']) expect(files, file).toContain(`\`${file}\``)
    for (const file of NEW_TESTS) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    for (const piece of ['No file the mail stream holds is touched', ...HELD.map((f) => `\`${f}\``)]) expect(files, piece).toContain(piece)
    for (const file of ['src/lib/features.ts', 'functions/utils/clubs/pages.ts', 'functions/clubs/[id].ts', ...HELD]) expect(read(file), file).not.toMatch(/club-written-page|WRITTEN_PAGE/)
    const branch = bullet(block, '- **Branch.**')
    for (const piece of ['`redesign/ws09-clubs-w`', '`9549f4f`', 'Checkpoint V is on `main` since its pull request merged', 'this branch does not hold `main`\'s later changes yet']) {
      expect(branch, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, checkpoint W, the written page: the figures and the plain words', () => {
  it('gives each figure of the checks once, counts that add up, and the build and the worker as the base\'s', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).not.toContain('`npm run test:a11y`')
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    expect([num(unit![3]), Number(unit![4])]).toEqual([11155, 481])
    const newUnit = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
    expect(num(unit![3]) + newUnit.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(unit![1]))
    expect(Number(unit![2]) - Number(unit![4])).toBe(newUnit.length)
    // The integration figures count the tests that run, as the gate gives them; the one todo stands beside them.
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing, with the one todo beside them/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect([num(integration![3]), Number(integration![4])]).toEqual([2931, 167])
    const newIntegration = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
    expect(num(integration![3]) + newIntegration.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(integration![1]))
    expect(Number(integration![2]) - Number(integration![4])).toBe(newIntegration.length)
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(([\d,]+) on the base\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1244)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_TESTS.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[2]).toBe('214')
    expect(built?.[1]).toBe(checked?.[1])
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-EymzK9bA.js` at 559,676 bytes', '`index-DpyXZnV6.css` at 138,073 bytes', '`features-nZCZoT6G.js` at 729 bytes',
      'each the base\'s to the byte', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
    const shas = [...build.matchAll(/sha256 `([0-9a-f]{64})`/g)].map((m) => m[1])
    expect(shas).toHaveLength(2)
    expect(shas[0]).toBe(shas[1])
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `9549f4f`')
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what it wrote and the files it adds', () => {
    const written = [block, statusLine].join('\n')
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS]) expect(written).not.toMatch(rule)
    const prose = proseOf(written)
    expect(prose).not.toMatch(UNFILLED)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    for (const file of [HTML, ...NEW_TESTS, ...MOVED]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
    const cases = read(NEW_TESTS[0])
    expect(cases).toMatch(/Example [A-Z][a-z]+ Club/)
    for (const address of cases.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address).toMatch(/@example\.org$/)
    // This file names the switches' homes only as paths it reads, so it is left out of the check on the test files' own words.
    for (const file of NEW_TESTS.filter((f) => !f.includes('redesign-status'))) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env|src\/lib\/features|\bfeatures\.\w+|FEATURES\.\w+/)
      // A server switch is never imported: it is read only as a getter on a mock of its module, which the case sets itself.
      expect(text, file).not.toMatch(/import\s*\{[^}]*\b(?:CLUB_PAGES_ON|CLUB_EMAIL_HIDDEN|ROSTER_SHORT_NAMES|CLUB_KEEPERS_ON|REGION_EVENTS_ON)\b/)
    }
    expect(cases).toContain('get CLUB_PAGES_ON() {')
  })
})
