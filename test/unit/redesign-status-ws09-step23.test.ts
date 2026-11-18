// test/unit/redesign-status-ws09-step23.test.ts
//
// REDESIGN_STATUS.md records WS09 step 23: the page before any script, the
// fourth of the plan's five steps of checkpoint W. Like WS09 step 22's record
// test, this file reads only the WS09 section, from its heading to the WS10
// heading. Pinned here: this step's block right after step 22's, and before
// the four lists while it is the latest; the Status line's tail while this
// step is the latest; the block's parts in order and its figures, which must
// agree with each other and with the files they describe; the sentences this
// step added to the map; the tagged entries of the lists; and the
// plain-language rules over what the step wrote and the files it adds. No
// line here reads how a switch ships.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
import { PENDING_CONTRACTS } from './contracts-pending'

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
const TAG = '(WS09 step 23).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 22: the rest of the club page'
const STEP = '### WS09 step 23: the page before any script'
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
const latest = latestStep === 23 && latestBlock === STEP

const ROUTE = 'functions/clubs/[id].ts'
const SHARED = 'functions/utils/clubs/pageAnswer.ts'
const HTML = 'functions/utils/clubs/pageHtml.ts'
const WORDS = 'domain/clubs/pageWords.ts'
const PREVIEW = 'functions/utils/events/linkPreview.ts'
const TODAY = 'functions/api/clubs/[id].ts'
const ENDPOINT = 'functions/api/clubs/[id]/page.ts'
const SELF = 'test/unit/redesign-status-ws09-step23.test.ts'
const NEW_FILES = [SHARED, HTML, WORDS]
const NEW_TESTS = [
  'test/integration/club-page-route.test.ts', 'test/integration/club-page-route-edges.test.ts', 'test/integration/club-answer-by-address.test.ts',
  'test/integration/link-preview-callers.test.ts', 'test/unit/club-page-html.test.tsx', SELF,
]
const HELPER = 'test/integration/helpers/clubPreviewBase.ts'
const CHANGED = [
  ROUTE, PREVIEW, TODAY, ENDPOINT, 'src/areas/clubs/clubPage.ts', 'src/areas/clubs/clubPageRows.ts', 'src/areas/clubs/components/ClubAbout.tsx',
  'src/areas/clubs/components/WhenAndWhere.tsx', 'src/areas/clubs/components/ClubEvents.tsx',
]
/** The test files whose checks this step makes false, each changed in place, its count unmoved. */
const MOVED = [
  'test/unit/redesign-status-ws09-step5.test.ts', 'test/unit/redesign-status-ws09-step20.test.ts', 'test/unit/redesign-status-ws09-step21.test.ts',
  'test/unit/listing-rule.test.ts',
]
const HELD = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts']
const UNTOUCHED = [
  'functions/news/[slug].ts', 'functions/tournaments/[id].ts', 'functions/utils/clubs/publicAnswer.ts', 'functions/utils/events/publicAnswer.ts',
  'test/integration/public-answer-columns.test.ts', 'test/integration/club-seed-live.test.ts', 'test/integration/club-columns-stay-off-answers.test.ts',
  'test/integration/club-roster-kept-back.test.ts', 'test/integration/club-page.test.ts', 'test/integration/club-page-edges.test.ts',
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

describe('REDESIGN_STATUS.md, WS09 step 23: the block', () => {
  it('sits once, right after step 22\'s block, and before the four lists while it is the latest', () => {
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
        'today\'s club answer finds a club by its short address too, by K\'s choice 8 (a)', 'WS09 step 15 follows as its own pull request', 'steps 1 to 14 and 16 to 23',
      ]) expect(tail, piece).toContain(piece)
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens by saying where the step sits, that step 15 is still to come, and what it builds and changes with every switch off', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the fourth of the plan\'s five steps of checkpoint W (steps 20 to 24)', '`redesign/ws09-clubs-w`', 'WS09 step 15, the worker\'s one line, is still to come',
      '`CLUB_PAGES_ON`', '`functions/clubs/[id].ts`', 'K\'s choice 8 (a)', 'No endpoint, no contract, no table, no migration and no switch is added',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **Before any script.**', '- **The 301s.**', '- **Never on a club page.**', '- **One truth.**',
      '- **Today\'s answer at a short address.**', '- **The map (criteria 5, 7 and 8, the server page).**', '- **What later steps add.**', '- **The look.**',
      '- **Step 15.**', '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**',
      '- **What ships with every switch off.**', '- **Owed before newClubs goes on.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(6)
  })

  it('names every file it adds and changes, each new test with its count, and leaves the held and shared files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...NEW_TESTS, HELPER, ...CHANGED, ...MOVED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...NEW_TESTS, HELPER]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    expect(bullet(files, '  - Grown with no change:')).toContain('`test/unit/domain-boundaries.test.ts`')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of ['No file the mail stream holds is touched', '`src/lib/features.ts`', '`functions/utils/clubs/pages.ts`', ...HELD.map((f) => `\`${f}\``), ...UNTOUCHED.map((f) => `\`${f}\``)]) {
      expect(beyond, piece).toContain(piece)
    }
    // Today's club page and the switches are not this step's to change.
    expect(read('src/pages/ClubDetailPage.tsx')).toContain('const textColor = clubTextColor(club.color)')
    for (const file of ['src/lib/features.ts', 'functions/utils/clubs/pages.ts', ...HELD]) expect(read(file), file).not.toMatch(/pageHtml|pageAnswer|pageWords|WS09 step 23/)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 23: the parts against the files', () => {
  it('says what is written before any script, as the route and the strings file write it', () => {
    const before = bullet(block, '- **Before any script.**')
    for (const piece of [
      '`clubPageTitle`', '`clubPageDescription`', 'at most 155 characters', 'canonical link', '`og-default.jpg`', '`SportsClub`', '`memberOf`', '`sameAs`', 'no `image`',
      'inside the shell\'s root element', 'one h1', 'no Contact section', 'no content security policy', '`application/ld+json`', 'written once',
      '`setAttribute`', 'writes them again by `escapeHtml`', 'The news and tournament previews keep their bytes',
    ]) expect(before, piece).toContain(piece)
    expect(codeOf(ROUTE)).toContain('const OWN_WORDS_TAGS = new Set([\'og:title\', \'og:description\', \'description\'])')
    expect(codeOf(ROUTE)).toContain('`<meta property="og:title" content="${escapeHtml(head.cardTitle)}" />`,')
    const route = codeOf(ROUTE)
    expect(route).toContain('  if (!CLUB_PAGES_ON) return todaysPreview(context)\n')
    expect(route).toContain('root: clubPageBody(answer),')
    expect(codeOf(PREVIEW)).toContain('    rewriter.on(\'#root\', {')
    expect(codeOf(HTML)).toContain('\'@type\': \'SportsClub\'')
    expect(read('public/_headers')).not.toMatch(/Content-Security-Policy/i)
  })

  it('names the 301s and the order they follow, as the route and the shared finder hold them', () => {
    const redirects = bullet(block, '- **The 301s.**')
    for (const piece of ['a current slug, then an old slug, then a club\'s id', '`clubNamedBy`', '301', 'the query', 'to another host', 'asked again, answers 200', 'whose id is its slug', 'no slug']) {
      expect(redirects, piece).toContain(piece)
    }
    expect(redirects).toContain('`Cache-Control: max-age=86400`')
    expect(codeOf(ROUTE)).toContain('headers: { Location: `${clubPagePath(address)}${search}`, \'Cache-Control\': REDIRECT_KEPT },')
    expect(codeOf(ROUTE)).toContain('const REDIRECT_KEPT = \'max-age=86400\'')
    expect(codeOf(HTML)).toContain('return `/clubs/${encodeURIComponent(slug)}`')
  })

  it('says what a club page never carries and how a club\'s words are escaped', () => {
    const never = bullet(block, '- **Never on a club page.**')
    for (const piece of ['no contact email', 'no officer', 'no roster', 'the same bytes', '`escapeHtml`', '`jsonForScript`', '"<", ">", "&"', 'line separator']) expect(never, piece).toContain(piece)
    expect(codeOf(HTML)).not.toMatch(/contact_email|club_officers|registrations/)
    expect(codeOf(ROUTE)).not.toMatch(/[Cc]ookie|Authorization/)
  })

  it('says the route and the endpoint build the one answer by the same code', () => {
    const truth = bullet(block, '- **One truth.**')
    for (const piece of ['`clubPageAnswer`', '`clubNamedBy`', '`functions/utils/clubs/pageAnswer.ts`', 'never asks its own endpoint', '`domain/clubs/pageWords.ts`', 'untouched and passing']) {
      expect(truth, piece).toContain(piece)
    }
    expect(codeOf(ENDPOINT)).toContain('return jsonResponse(await clubPageAnswer(db, club), 200, headers)')
    expect(codeOf(ROUTE)).toContain('const answer = await clubPageAnswer(db, club)')
  })

  it('says how today\'s answer finds a club by its short address, as the file reads it', () => {
    const today = bullet(block, '- **Today\'s answer at a short address.**')
    for (const piece of ['by id first', 'a current slug', 'an old slug', 'byte for byte', '`clubIdByShortAddress`', 'the column list', '`publicClubAnswer`', '`ClubDetailPage`']) {
      expect(today, piece).toContain(piece)
    }
    const code = codeOf(TODAY)
    expect(code).toContain('return errorResponse(\'Club not found\', 404)')
    expect(code).toContain('club: publicClubAnswer(club, CLUB_EMAIL_HIDDEN),')
    expect(code).not.toMatch(/clubs\/pages|CLUB_PAGES_ON/)
  })

  it('names the look, the branch, the merge, the database, a revert, what ships and what is owed', () => {
    const look = bullet(block, '- **The look.**')
    for (const piece of ['a scratch copy of the tree outside the repository', 'in the copy alone', 'every seeded club and person deleted', 'scripts turned off', 'at 390 and 1280', 'one h1', 'Every server the look started was stopped', 'a slow connection']) {
      expect(look, piece).toContain(piece)
    }
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-w`', '`0a25e33`', 'is not cut from `main`', 'this step\'s diff is against `0a25e33`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration, no handler, no endpoint and no contract', '105 handler files', '41 of the 145 methods', '`PENDING_COUNT` 104']) expect(does, piece).toContain(piece)
    expect(bullet(block, '- **What `main`\'s code does on this step\'s database.**')).toContain('This step changes no table')
    expect(bullet(block, '- **What a revert leaves.**')).toContain('leaves no row behind')
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['today\'s link preview, byte for byte', 'nothing redirects', 'K\'s choice 8 (a)', 'Friday, November 13, 2026', '"Club not found"', 'switch-off after a switch-on', 'No switch is added']) {
      expect(ships, piece).toContain(piece)
    }
    const owed = bullet(block, '- **Owed before newClubs goes on.**')
    expect(owed.split('\n')[1]).toContain('that volunteers\' first names and last initials show on public club pages')
    for (const piece of ['straight-line miles', '"N of M spots filled"', 'the plain page a reader with no script meets']) expect(owed, piece).toContain(piece)
    expect(bullet(block, '- **Step 15.**')).toContain('Still to come')
  })

  it('names each moved pin by its file, and the handler and contract figures hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    expect(pins).toContain('no file changes its count of cases')
    expect(read('test/unit/routes.test.ts')).toMatch(/expect\(real\.filter\(\(r\) => r\.startsWith\('api\/'\)\)\.length\)\.toBe\(10[5-9]\)/)
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 104')
    expect(read('test/unit/contract-coverage.test.ts')).toContain('\'GET /clubs/[id]\'')
    if (!latest) return
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(41)
    expect(PENDING_CONTRACTS).toHaveLength(104)
  })

  it('gives the lint as the base\'s and the build\'s figures with what moved, and the worker\'s dry run', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `0a25e33`')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', '`index-D41OofoE.js` at 559,676', '`index-YvQuSpxy.css` at 138,154', '`features-nZCZoT6G.js`', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(build, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 step 23: the Checks line', () => {
  it('gives each figure once, and no browser run of its own', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `0a25e33`\'s tree')
  })

  it('gives unit counts that add up: the base\'s, the new files\' and the one grown by the tree', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([11049, 471])
    const newUnit = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
    expect(num(before) + newUnit.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0) + 1).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(newUnit.length)
  })

  it('gives integration counts as the base\'s with the new files, the lint files as the base\'s with the new files, and the build\'s file counts', () => {
    const files = bullet(block, '- **Files.**')
    // The integration figures count the tests that run, as the gate gives them; the one todo stands beside them.
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing, with the one todo beside them/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2843, 158])
    const newIntegration = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
    expect(num(before) + newIntegration.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(newIntegration.length)
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(([\d,]+) on the base\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1219)
    expect(num(lint![1]) - num(lint![2])).toBe([...NEW_FILES, ...NEW_TESTS, HELPER].length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[2]).toBe('214')
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 23: the map and the lists', () => {
  it('adds one sentence to each of criteria 5, 7 and 8, before the planned step, and to no other item', () => {
    for (const id of ['Criterion 5', 'Criterion 7', 'Criterion 8']) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 23: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 23: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
      expect(item.slice(item.indexOf('Built in WS09 step 23: ')), id).toContain('`test/')
    }
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 23:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 5', 'Criterion 7', 'Criterion 8'])
  })

  it('records the step\'s deviations, verify items and follow-ups, each tagged, and adds no decision', () => {
    expect(tagged(part(LISTS[0]))).toEqual([])
    expect(tagged(deviations).map(head)).toEqual([
      'The route keeps its name (WS09 step 23).', 'The share card with no logo (WS09 step 23).', 'No Contact in the written body yet (WS09 step 23).',
      'The tests in files of their own (WS09 step 23).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'Today\'s preview (WS09 step 23).', 'The image rule (WS09 step 23).', 'A rename would move pins (WS09 step 23).', 'A 301 is remembered (WS09 step 23).',
      'The site\'s content security policy (WS09 step 23).', 'Today\'s club page at a slug (WS09 step 23).',
    ])
    for (const entry of tagged(verify).slice(0, 3)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `0a25e33`/)
    expect(tagged(followUps).map(head)).toEqual([
      'The plain page before the scripts (WS09 step 23).', 'An ampersand in the news and tournament previews\' tags (WS09 step 23).',
      'The shell\'s validators on the news and tournament previews (WS09 step 23).',
    ])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 23: plain language', () => {
  const written = [
    block, ...tagged(deviations), ...tagged(verify), ...tagged(followUps),
    ...['Criterion 5', 'Criterion 7', 'Criterion 8'].map((id) => mapItem(id).slice(mapItem(id).indexOf('Built in WS09 step 23: '))), statusLine,
  ].join('\n')

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

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds', () => {
    for (const file of [...NEW_FILES, ...NEW_TESTS, HELPER, ROUTE]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })

  it('writes the tests\' people, clubs and places plainly made up, reading no setting from the environment and no switch\'s shipped value', () => {
    for (const file of [...NEW_TESTS.filter((f) => f !== SELF), HELPER]) {
      const text = read(file)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env/)
      if (file !== HELPER) expect(text, file).toMatch(/Example [A-Z][a-z]+ Club/)
      for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
      expect(text, file).not.toMatch(/src\/lib\/features|\bfeatures\.\w+|FEATURES\.\w+/)
      // A server switch is never imported: it is read only as a getter on a mock of its module, which the case sets itself.
      expect(text, file).not.toMatch(/import\s*\{[^}]*\b(?:CLUB_PAGES_ON|CLUB_EMAIL_HIDDEN|ROSTER_SHORT_NAMES|CLUB_KEEPERS_ON)\b/)
      if (file.startsWith('test/integration/') && file !== HELPER) {
        for (const name of new Set(text.match(/\b(?:CLUB_PAGES_ON|CLUB_EMAIL_HIDDEN)\b/g) ?? [])) expect(text, `${file} ${name}`).toContain(`get ${name}() {`)
      }
    }
  })
})
