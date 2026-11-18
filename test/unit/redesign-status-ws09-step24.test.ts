// test/unit/redesign-status-ws09-step24.test.ts
//
// REDESIGN_STATUS.md records the first half of WS09 step 24: the sitemap,
// in the fifth of the plan's five steps of checkpoint W. Like WS09 step 23's
// record test, this file reads only the WS09 section, from its heading to
// the WS10 heading. Pinned here: this step's block right after step 23's,
// and before the four lists while it is the latest; the Status line's tail
// while this step is the latest; the block's parts in order and its
// figures, which must agree with each other and with the files they
// describe; the sentence this step added to the map; the tagged entries of
// the lists; and the plain-language rules over what the step wrote and the
// files it adds. No line here reads how a switch ships.
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
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))
const head = (entry: string) => entry.slice(4, entry.indexOf('**', 4))
const TAG = '(WS09 step 24).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 23: the page before any script'
const STEP = '### WS09 step 24: the sitemap'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latestBlock = headings[headings.indexOf(LISTS[0]) - 1] ?? ''
const latest = latestStep === 24 && latestBlock === STEP

const SITEMAP = 'functions/sitemap.xml.ts'
const PREVIEW = 'functions/utils/events/linkPreview.ts'
const ROUTE = 'functions/clubs/[id].ts'
const SELF = 'test/unit/redesign-status-ws09-step24.test.ts'
const NEW_FILES = [SITEMAP]
const NEW_TESTS = ['test/integration/sitemap.test.ts', 'test/unit/sitemap-xml.test.tsx', 'test/integration/sitemap-edges.test.ts', 'test/unit/sitemap-boundaries.test.ts', SELF]
const CHANGED = [PREVIEW]
/** The test files whose checks this step makes false or widens, each changed in place. */
const MOVED = ['test/unit/contracts-status.test.ts', 'test/unit/contract-coverage.test.ts', 'test/unit/routes.test.ts', 'test/unit/listing-rule.test.ts']
/** The one file that draws cases from a list the sitemap joins, with its count before and after. */
const GROWN = ['test/unit/listing-rule.test.ts', 20, 22] as const
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
const UNTOUCHED = [
  'src/lib/features.ts', 'functions/utils/clubs/pages.ts', 'scripts/seed/fixtures.sql', 'playwright.config.ts', 'domain/contracts/registry.ts', 'test/unit/contracts-pending.ts',
  'functions/clubs/[id].ts', 'functions/news/[slug].ts', 'functions/tournaments/[id].ts', 'functions/utils/clubs/publicAnswer.ts', 'functions/utils/events/publicAnswer.ts',
  'test/integration/public-answer-columns.test.ts', 'test/integration/club-seed-live.test.ts', 'test/integration/club-columns-stay-off-answers.test.ts',
  'test/integration/club-roster-kept-back.test.ts',
]
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** A file's plain cases: every `it(` line; none of this step's files draws cases from a table. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, file).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** The page routes outside functions/api, from the tree: every file under functions/ but api, utils and db that exports a handler. */
const pageRoutes = () =>
  collectRouteFiles(join(ROOT, 'functions'))
    .filter((r) => !['api', 'utils', 'db'].includes(r.segments[0]))
    .map((r) => r.file.slice(ROOT.length + 1).split('\\').join('/'))
    .filter((f) => exportedMethods(read(f)).length > 0)
    .sort()

describe('REDESIGN_STATUS.md, WS09 step 24: the block', () => {
  it('sits once, right after step 23\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(STEP)
    if (latest) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest, and keeps the section\'s heading and the pull request numbers', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of [
        'checkpoint W is under way on `redesign/ws09-clubs-w`', 'WS09 step 23, the page before any script, is written by the server only with `CLUB_PAGES_ON` set',
        'the first half of WS09 step 24, the sitemap, is served only with `CLUB_PAGES_ON` set, its browser half to come as a step of its own',
        'WS09 step 15 follows as its own pull request', 'steps 1 to 14 and 16 to 23, the sitemap of step 24,',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens by saying where the step sits, that its browser half and step 15 are still to come, and that nothing changes with every switch off', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the fifth of the plan\'s five steps of checkpoint W (steps 20 to 24)', '`redesign/ws09-clubs-w`', 'its browser half comes as a step of its own',
      'WS09 step 15, the worker\'s one line, is still to come', '`CLUB_PAGES_ON`', '`functions/sitemap.xml.ts`', 'Nothing changes with every switch off',
      'No endpoint under `functions/api`, no contract, no table, no migration and no switch is added',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The sitemap.**', '- **The addresses.**', '- **The same for everyone.**', '- **When the database fails.**',
      '- **The map (criterion 7, the sitemap).**', '- **The split.**', '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**',
      '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Owed before newClubs goes on.**', '- **Pins moved.**', '- **Judgement calls.**',
      '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(6)
  })

  it('names every file it adds and changes, each new test with its count, the grown file with its counts, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...NEW_TESTS, ...CHANGED, ...MOVED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...NEW_TESTS]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    const grown = bullet(files, '  - Grown with no change:')
    expect(grown).toContain(`\`${GROWN[0]}\``)
    expect(grown).toContain(`from ${GROWN[1]} cases to ${GROWN[2]}`)
    // Two of the file's checks are drawn from LISTED, which now holds four files, the sitemap among them.
    const listing = read(GROWN[0])
    expect(listing.match(/^\s*it\.each\(LISTED\)/gm)).toHaveLength(2)
    expect(/const LISTED = \[([^\]]*)\]/.exec(listing)?.[1].split(',').map((f) => f.trim())).toEqual([
      '\'functions/api/search.ts\'', '\'functions/utils/search.ts\'', `'${SITEMAP}'`, '\'functions/utils/clubs/pageAnswer.ts\'',
    ])
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['No file the mail stream holds is touched', ...HELD.map((f) => `\`${f}\``), ...UNTOUCHED.map((f) => `\`${f}\``)]) expect(beyond, piece).toContain(piece)
    for (const file of ['src/lib/features.ts', 'functions/utils/clubs/pages.ts', ...HELD]) expect(read(file), file).not.toMatch(/sitemap\.xml|pageAddress|WS09 step 24/)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 24: the parts against the files', () => {
  it('says what the sitemap lists and how, as the file writes it', () => {
    const sitemap = bullet(block, '- **The sitemap.**')
    for (const piece of [
      '`http://www.sitemaps.org/schemas/sitemap/0.9`', '`loc`', '`lastmod`', 'escaped for XML', 'once', '`told_updated_at`', '`2026-11-02T15:00:00Z`', 'no `lastmod`',
      '`/tournaments/{id}`', '`listedWhere(\'t\')`', 'a hidden draft is never in it', 'no old slug', 'no address with a query', 'a follow-up asks',
    ]) expect(sitemap, piece).toContain(piece)
    const code = codeOf(SITEMAP)
    expect(read(SITEMAP)).not.toContain('is_visible')
    expect(code).toContain('.prepare(`SELECT t.id FROM tournaments t WHERE ${listedWhere(\'t\')} ORDER BY t.date DESC, t.id`)')
    expect(code).toContain('const SITEMAP_NAMESPACE = \'http://www.sitemaps.org/schemas/sitemap/0.9\'')
    expect(code).toContain('const KEPT_AN_HOUR = \'public, max-age=3600\'')
    expect(code).toContain('headers: { \'Content-Type\': \'application/xml; charset=utf-8\', \'Cache-Control\': KEPT_AN_HOUR },')
    expect(code).toContain('  if (!CLUB_PAGES_ON) return context.next()\n')
    expect(bullet(block, '- **What the step builds.**')).toContain('`Cache-Control: public, max-age=3600`')
  })

  it('says each address is the canonical link\'s, built by the same code, on the site\'s own host', () => {
    const addresses = bullet(block, '- **The addresses.**')
    for (const piece of ['`clubAddress`', '`clubPagePath`', '`pageAddress`', '`clubNamedBy`', '`resolveSiteUrl`', '`SITE_URL`', '`wrangler.toml`', 'the unique index on `clubs.slug`', 'listed once']) {
      expect(addresses, piece).toContain(piece)
    }
    expect(codeOf(SITEMAP)).toContain('return pageAddress(env, new Request(new URL(path, request.url)))')
    expect(codeOf(SITEMAP)).toContain('const path = clubPagePath(clubAddress(club))')
    expect(codeOf(PREVIEW)).toContain('  const pageUrl = pageAddress(env, request)\n')
    expect(codeOf(PREVIEW)).toContain('  return `${resolveSiteUrl(env, request)}${new URL(request.url).pathname}`\n')
    expect(codeOf(ROUTE)).toContain('const pageRequest = new Request(new URL(clubPagePath(answer.club.slug), context.request.url))')
  })

  it('says every reader gets the same bytes and a failure is a 503 in plain words kept by no one, as the file answers', () => {
    expect(bullet(block, '- **The same for everyone.**')).toContain('reads no cookie, no sign-in and no header')
    const fails = bullet(block, '- **When the database fails.**')
    for (const piece of ['503', '`Content-Type: text/plain; charset=utf-8`', '`Cache-Control: no-store`', 'never half a sitemap', 'never kept for the hour']) expect(fails, piece).toContain(piece)
    const words = /const SITEMAP_UNAVAILABLE = '([^']*)'/.exec(codeOf(SITEMAP))?.[1] ?? ''
    expect(words).not.toBe('')
    expect(fails).toContain(`"${words}"`)
    expect(codeOf(SITEMAP)).toContain('headers: { \'Content-Type\': \'text/plain; charset=utf-8\', \'Cache-Control\': \'no-store\' },')
    expect(codeOf(SITEMAP)).not.toMatch(/[Cc]ookie|Authorization|headers\.get|requireAuth|requireAdmin/)
  })

  it('names the split, the branch, the merge, the database, a revert, what ships and what is owed', () => {
    const split = bullet(block, '- **The split.**')
    for (const piece of ['two halves', 'the browser build for the new clubs pages', 'checkpoint W\'s section', 'a step of its own', 'a change not yet on this branch\'s base']) {
      expect(split, piece).toContain(piece)
    }
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-w`', '`09ca444`', 'is not cut from `main`', 'this step\'s diff is against `09ca444`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['`functions/sitemap.xml.ts`', 'the fourth beside the three link previews', '105 handler files', '41 of the 145 methods', '`PENDING_COUNT` 104']) {
      expect(does, piece).toContain(piece)
    }
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('This step changes no table')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('leaves no row behind')
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['no sitemap, as today', 'the base\'s bytes', 'reads nothing', '`test/integration/link-preview-callers.test.ts`', 'Nothing else changes anywhere', 'No switch is added']) {
      expect(ships, piece).toContain(piece)
    }
    const owed = bullet(block, '- **Owed before newClubs goes on.**')
    expect(owed.split('\n')[1]).toContain('how a search engine learns of the sitemap: there is no `robots.txt` today')
    expect(owed.split('\n').filter((l) => /^\s+- /.test(l))).toHaveLength(13)
    for (const piece of ['Step 23\'s eleven', 'straight-line miles', 'hard to take back', 'past ones included']) expect(owed, piece).toContain(piece)
  })

  it('names each moved pin by its file, and the page routes, handler and contract figures hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('no file changes its count of cases but `test/unit/listing-rule.test.ts`')
    expect(pageRoutes()).toEqual(['functions/clubs/[id].ts', 'functions/news/[slug].ts', 'functions/robots.txt.ts', SITEMAP, 'functions/tournaments/[id].ts'])
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(105)')
    expect(read('test/unit/routes.test.ts')).toContain('expect(real).toEqual(expect.arrayContaining([\'tournaments/[id]\', \'clubs/[id]\', \'news/[slug]\', \'sitemap.xml\']))')
    expect(read('test/unit/contract-coverage.test.ts')).toContain('\'GET /sitemap.xml\':')
    expect(read('test/unit/contract-coverage.test.ts')).toContain('for (const reason of Object.values(EXCLUDED)) expect(reason).toMatch(/HTML/)')
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
    expect(read('domain/contracts/registry.ts')).not.toContain('sitemap')
    if (!latest) return
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(41)
    expect(PENDING_CONTRACTS).toHaveLength(104)
  })

  it('gives the lint as the base\'s and the build\'s figures as the base\'s, and the worker\'s dry run', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `09ca444`')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-BaGFPaC6.js` at 559,676', '`index-YvQuSpxy.css` at 138,154', '`features-nZCZoT6G.js` at 729', 'each the base\'s to the byte',
      '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 24: the Checks line', () => {
  it('gives each figure once, and no browser run of its own', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `09ca444`\'s tree')
  })

  it('gives unit counts that add up: the base\'s, the new files\' and the one grown by its list', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([11082, 473])
    const newUnit = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
    expect(num(before) + newUnit.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + GROWN[2] - GROWN[1]).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(newUnit.length)
  })

  it('gives integration counts as the base\'s with the new file, the lint files as the base\'s with the new files, and the build\'s file counts', () => {
    const files = bullet(block, '- **Files.**')
    // The integration figures count the tests that run, as the gate gives them; the one todo stands beside them.
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing, with the one todo beside them/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2880, 162])
    const newIntegration = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
    expect(num(before) + newIntegration.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(newIntegration.length)
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(([\d,]+) on the base\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1229)
    expect(num(lint![1]) - num(lint![2])).toBe([...NEW_FILES, ...NEW_TESTS].length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[2]).toBe('214')
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 24: the map and the lists', () => {
  it('adds one sentence to criterion 7, before its planned step, and to no other item', () => {
    const item = mapItem('Criterion 7')
    expect(item.split('Built in WS09 step 24: ')).toHaveLength(2)
    expect(item.indexOf('Built in WS09 step 23: ')).toBeLessThan(item.indexOf('Built in WS09 step 24: '))
    expect(item.indexOf('Built in WS09 step 24: ')).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    expect(item.endsWith('Planned: WS09 step 26.')).toBe(true)
    expect(item.slice(item.indexOf('Built in WS09 step 24: '))).toContain('`test/integration/sitemap.test.ts`')
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 24:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 7'])
  })

  it('records the step\'s deviations, verify items and follow-ups, each tagged, and adds no decision', () => {
    expect(tagged(part(LISTS[0]))).toEqual([])
    expect(tagged(deviations).map(head)).toEqual(['The step in two halves (WS09 step 24).', 'The document read back in a unit test (WS09 step 24).'])
    expect(tagged(verify).map(head)).toEqual([
      'No sitemap today (WS09 step 24).', 'The listing rule (WS09 step 24).', 'Which clubs are served (WS09 step 24).', 'The form of `told_updated_at` (WS09 step 24).',
      'The page routes\' counts (WS09 step 24).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `09ca444`/)
    expect(tagged(followUps).map(head)).toEqual([
      'How a search engine learns of the sitemap (WS09 step 24).', 'The Clubs page and the home page in the sitemap (WS09 step 24).',
      'The sitemap\'s exports unchecked (WS09 step 24).', 'A HEAD request at the sitemap (WS09 step 24).', 'A sitemap past the protocol\'s limit (WS09 step 24).',
    ])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 24: plain language', () => {
  const item = mapItem('Criterion 7')
  const written = [block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps), item.slice(item.indexOf('Built in WS09 step 24: ')), statusLine].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the step wrote, and dates and times in their plain form', () => {
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
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds and the lines it adds to the preview, and writes the tests\' clubs and people made up, reading no switch\'s shipped value', () => {
    for (const file of [...NEW_FILES, ...NEW_TESTS]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
    // The lines the step adds to the preview, its one function and the comment over it.
    const added = between(read(PREVIEW), '/**\n * A page\'s address on this site', 'export function withLinkPreview(')
    expect(added).toContain('export function pageAddress(env: SiteEnv, request: Request): string {')
    for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(added).not.toMatch(rule)
    for (const file of NEW_TESTS.filter((f) => f !== SELF)) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      // The boundaries test reads only the tree: it holds no club or person, and names a switch only in the source text it checks, never reading its value.
      const treeOnly = file === 'test/unit/sitemap-boundaries.test.ts'
      if (!treeOnly) expect(text, file).toMatch(/Example [A-Z][a-z]+ Club/)
      for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
      expect(text, file).not.toMatch(/src\/lib\/features|\bfeatures\.\w+|FEATURES\.\w+/)
      // A server switch is never imported: it is read only as a getter on a mock of its module, which the case sets itself.
      expect(text, file).not.toMatch(/import\s*\{[^}]*\b(?:CLUB_PAGES_ON|CLUB_EMAIL_HIDDEN|ROSTER_SHORT_NAMES|CLUB_KEEPERS_ON)\b/)
      if (treeOnly) expect(text, file).not.toMatch(/vi\.mock|from '\.\.\/\.\.\/functions\//)
      else for (const name of new Set(text.match(/\b(?:CLUB_PAGES_ON|CLUB_EMAIL_HIDDEN)\b/g) ?? [])) expect(text, `${file} ${name}`).toContain(`get ${name}() {`)
    }
  })
})
