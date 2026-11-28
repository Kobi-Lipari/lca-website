// test/unit/redesign-status-ws09-w-robots.test.ts
//
// REDESIGN_STATUS.md records the small robots.txt that names the sitemap,
// asked by K's decision 11, choice 3 (a), a step of checkpoint W. Like the
// record test of the block before it, this file reads only the WS09 section,
// from its heading to the WS10 heading. Pinned here: the block right after
// the block of K's look at the test site and before the four lists while it
// is the latest; the Status line's tail while it is the latest; the
// follow-up it closes; the block's parts in order and its figures, which
// must agree with each other and with the files they describe; and the
// plain-language rules over what the block wrote and the files it adds. No
// line here reads how a switch ships.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
import { PENDING_CONTRACTS } from './contracts-pending'
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
const PREVIOUS = '### Checkpoint W: WS09 what K\'s look at the test site asked'
const BLOCK = '### Checkpoint W: WS09 robots.txt names the sitemap'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === BLOCK
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const FOLLOW_UP = '- **How a search engine learns of the sitemap (WS09 step 24).**'
const followUp = followUps.split('\n').find((l) => l.startsWith(FOLLOW_UP)) ?? ''
const CLOSING = ' Closed in checkpoint W by K\'s decision 11, choice 3 (a): '

const ROBOTS = 'functions/robots.txt.ts'
const NEW_TESTS = ['test/integration/robots.test.ts', 'test/unit/robots-boundaries.test.ts', 'test/unit/redesign-status-ws09-w-robots.test.ts']
/** The test files whose checks this step makes false, each changed in place and keeping its count. */
const MOVED = [
  'test/unit/contract-coverage.test.ts', 'test/unit/routes.test.ts', 'test/unit/contracts-status.test.ts', 'test/unit/sitemap-boundaries.test.ts',
  'test/unit/redesign-status-ws09-step24.test.ts',
]
const HELD = [
  'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts',
  'test/a11y/signedIn.ts',
]
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** The page routes outside functions/api, from the tree: every file under functions/ but api, utils and db that exports a handler. */
const pageRoutes = () =>
  collectRouteFiles(join(ROOT, 'functions'))
    .filter((r) => !['api', 'utils', 'db'].includes(r.segments[0]))
    .map((r) => r.file.slice(ROOT.length + 1).split('\\').join('/'))
    .filter((f) => exportedMethods(read(f)).length > 0)
    .sort()

describe('REDESIGN_STATUS.md, checkpoint W: robots.txt names the sitemap', () => {
  it('sits once, right after the block of K\'s look at the test site, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line its tail while it is the latest, and keeps the pull request numbers', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'and on K\'s decision 11 a small `robots.txt` that names the sitemap is served only with `CLUB_PAGES_ON` set;',
        'what K\'s look at the test site asked, the `robots.txt` that names the sitemap, K\'s answers',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens with why, K\'s decision 11, its choice and its day, and has every part in order', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'K\'s decision 11 of Tuesday, November 17, 2026, choice 3 (a)', 'a small `robots.txt` naming the sitemap ship with the public club pages\' first version',
      '`functions/robots.txt.ts`', '`CLUB_PAGES_ON`', 'nothing changes with every switch off',
    ]) expect(opening, piece).toContain(piece)
    const parts = [
      '- **The file.**', '- **Behind the constant.**', '- **The same for everyone.**', '- **What ships with every switch off.**', '- **The follow-up closed.**',
      '- **Pins moved.**', '- **Grown with no change.**', '- **The judgement calls.**', '- **What K still owes before newClubs goes on.**', '- **What the merge carries.**',
      '- **Lint.**', '- **Build.**', '- Checks:', '- **Files.**', '- **Branch.**',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(subBullets(bullet(block, '- **The judgement calls.**')).length).toBeGreaterThanOrEqual(5)
  })
})

describe('REDESIGN_STATUS.md, checkpoint W, robots.txt: the parts against the files', () => {
  it('says the three lines, the host and how it is built, the headers, that it forbids nothing and reads no database, as the file writes it', () => {
    const file = bullet(block, '- **The file.**')
    for (const piece of [
      'RFC 9309', '`User-agent: *`', '`Allow: /`', '`Sitemap: https://www.louisianachess.org/sitemap.xml`', 'each ended by a line feed', '`pageAddress`', '`SITE_URL`',
      '`resolveSiteUrl`', 'never by a second copy of the rule', '`X-Forwarded-Host`', 'a query', 'the sitemap answering its XML at the very address the line names',
      '`Content-Type: text/plain; charset=utf-8`', '`Cache-Control: public, max-age=3600`', 'no cookie is read or set', 'It forbids nothing', '`X-Robots-Tag: noindex`',
      'It reads no database',
    ]) expect(file, piece).toContain(piece)
    const code = codeOf(ROBOTS)
    expect(code).toContain("['User-agent: *', 'Allow: /', `Sitemap: ${sitemap}`].map((line) => `${line}\\n`).join('')")
    expect(code).toContain('pageAddress(context.env, new Request(new URL(SITEMAP_PATH, context.request.url)))')
    expect(code).toContain("headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': KEPT_AN_HOUR },")
    expect(code).not.toMatch(/Disallow|\.DB\b|prepare\(/)
    expect(read('public/_headers')).toContain('X-Robots-Tag: noindex')
    expect(read('wrangler.toml')).toContain('SITE_URL = "https://www.louisianachess.org"')
  })

  it('says why a handler behind the constant, what the address answers unset, the same bytes for everyone, and what ships', () => {
    const behind = bullet(block, '- **Behind the constant.**')
    for (const piece of ['a file under `public/` would be served with every switch off', '`context.next()` before anything else', 'byte for byte', 'reads nothing', 'the site\'s shell with status 200']) {
      expect(behind, piece).toContain(piece)
    }
    expect(codeOf(ROBOTS)).toContain('  if (!CLUB_PAGES_ON) return context.next()\n')
    for (const file of ['public/robots.txt', 'public/_routes.json', 'public/_redirects', 'public/404.html']) expect(existsSync(join(ROOT, file)), file).toBe(false)
    const same = bullet(block, '- **The same for everyone.**')
    for (const piece of ['reads no cookie, no sign-in and no header', 'a signed-out visitor, a member, a club\'s rep and an LCA admin get the same bytes', 'with any query']) {
      expect(same, piece).toContain(piece)
    }
    expect(bullet(block, '- **What ships with every switch off.**')).toContain('nothing a person or a crawler meets changes')
  })

  it('closes step 24\'s follow-up by K\'s decision, its words kept, and takes the choice out of what K still owes', () => {
    expect(followUp).not.toBe('')
    expect(followUp.startsWith(`${FOLLOW_UP} There is no \`robots.txt\` today, so nothing names \`sitemap.xml\` to a crawler`)).toBe(true)
    expect(followUp.split(CLOSING)).toHaveLength(2)
    expect(followUp.endsWith('(`test/integration/robots.test.ts`).')).toBe(true)
    expect(followUp.slice(0, followUp.indexOf(CLOSING))).toContain('A choice for K before `newClubs` goes on.')
    expect(bullet(block, '- **The follow-up closed.**')).toContain('"How a search engine learns of the sitemap (WS09 step 24)" is closed by K\'s decision')
    const owed = bullet(block, '- **What K still owes before newClubs goes on.**')
    expect(subBullets(owed)).toHaveLength(10)
    expect(owed).toContain('Step 24\'s thirteen, less the three now settled')
    for (const gone of ['learns of the sitemap', 'first names and last initials show', 'a representative\'s save reads']) expect(subBullets(owed).join('\n'), gone).not.toContain(gone)
    for (const piece of ['straight-line miles', 'hard to take back', 'past ones included', '`og-default.jpg`']) expect(owed, piece).toContain(piece)
  })

  it('names each moved pin by its file and title, the five page routes from the tree, no contract and no call', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('no earlier step\'s test file changes its count of cases')
    expect(pins).toContain('`test/unit/listing-rule.test.ts` is not changed')
    expect(pageRoutes()).toEqual(['functions/clubs/[id].ts', 'functions/news/[slug].ts', ROBOTS, 'functions/sitemap.xml.ts', 'functions/tournaments/[id].ts'])
    const coverage = read('test/unit/contract-coverage.test.ts')
    expect(coverage).toContain("'GET /robots.txt':\n    \"Page route: serves the plain text robots.txt that names the sitemap to search engines, or passes on to the site's HTML, not JSON.\",")
    expect(coverage).toContain('for (const reason of Object.values(EXCLUDED)) expect(reason).toMatch(/HTML/)')
    expect(read('test/unit/routes.test.ts')).toContain("expect(real).toContain('robots.txt')")
    expect(read('test/unit/listing-rule.test.ts')).not.toContain('robots')
    expect(Object.keys(contracts).filter((key) => /robots/i.test(key))).toEqual([])
    expect(PENDING_CONTRACTS.filter((line) => /robots/i.test(line))).toEqual([])
    expect(bullet(block, '- **Grown with no change.**')).toContain('None')
    const carries = bullet(block, '- **What the merge carries.**')
    for (const piece of ['the fifth beside the three link previews and the sitemap', '105 handler files', '41 of the 145 methods', '`PENDING_COUNT` 104', 'no call in `src/`']) {
      expect(carries, piece).toContain(piece)
    }
  })

  it('names every file it adds with its count of cases, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [ROBOTS, ...NEW_TESTS, 'REDESIGN_STATUS.md']) expect(files, file).toContain(`\`${file}\``)
    for (const file of [ROBOTS, ...NEW_TESTS]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    for (const piece of ['No file the mail stream holds is touched', ...HELD.map((f) => `\`${f}\``)]) expect(files, piece).toContain(piece)
    for (const file of ['src/lib/features.ts', 'functions/utils/clubs/pages.ts', ...HELD]) expect(read(file), file).not.toMatch(/robots\.txt/)
    const branch = bullet(block, '- **Branch.**')
    for (const piece of ['`redesign/ws09-clubs-w`', '`b6bf464`', 'Checkpoint V is on `main` since its pull request merged', 'this branch does not hold `main`\'s later changes yet']) {
      expect(branch, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, checkpoint W, robots.txt: the figures and the plain words', () => {
  it('gives each figure of the checks once, counts that add up, and the build and the worker as the base\'s', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).not.toContain('`npm run test:a11y`')
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    expect([num(unit![3]), Number(unit![4])]).toEqual([11138, 479])
    const newUnit = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
    expect(num(unit![3]) + newUnit.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(unit![1]))
    expect(Number(unit![2]) - Number(unit![4])).toBe(newUnit.length)
    // The integration figures count the tests that run, as the gate gives them; the one todo stands beside them.
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing, with the one todo beside them/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect([num(integration![3]), Number(integration![4])]).toEqual([2921, 166])
    const newIntegration = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
    expect(num(integration![3]) + newIntegration.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(integration![1]))
    expect(Number(integration![2]) - Number(integration![4])).toBe(newIntegration.length)
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(([\d,]+) on the base\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1240)
    expect(num(lint![1]) - num(lint![2])).toBe([ROBOTS, ...NEW_TESTS].length)
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
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `b6bf464`')
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what it wrote and the files it adds', () => {
    const written = [block, statusLine, followUp.slice(followUp.indexOf(CLOSING))].join('\n')
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS]) expect(written).not.toMatch(rule)
    const prose = proseOf(written)
    expect(prose).not.toMatch(UNFILLED)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    for (const file of [ROBOTS, ...NEW_TESTS]) {
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
