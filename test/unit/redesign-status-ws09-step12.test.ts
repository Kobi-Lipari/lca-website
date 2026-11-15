// test/unit/redesign-status-ws09-step12.test.ts
//
// REDESIGN_STATUS.md records WS09 step 12: a club in My region, the third
// step of checkpoint U, and the merges of checkpoints S and T into main
// before it. Like WS09 step 11's record test, this file reads only the WS09
// section, from its heading to the WS10 heading. Pinned here: the merges'
// block, right after WS09 step 11's block, with the facts it records; this
// step's block right after it, and before the four lists while it is the
// latest; the Status line's tail while this step is the latest, and the PR
// line; the block's parts in order and its figures, which must agree with
// each other and with the files they describe; the sentences this step
// added to criteria 1 and 9 of the map; the tagged entries of the four
// lists and the three entries of WS09 step 11 this step closes or adds to;
// and the plain-language rules over what the step wrote and the files it
// adds or changes. What a later step will change in the tree (the lazy
// pages, the cases of a test a later step grows) is read only while this
// step is the latest.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[A-Z]+_(?:CASES|LINE|COUNT|TEXT|AFTER|FILES|TESTS)\\b(?<!PENDING_COUNT)|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
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
const TAG = '(WS09 step 12).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 11: the My region page'
const MERGES = '### WS09 checkpoint T: checkpoints S and T merged and live'
const STEP = '### WS09 step 12: a club in My region'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const merges = part(MERGES)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))
const headings = lines.filter((l) => l.startsWith('### '))

const PAGE = 'src/pages/MyRegionClubPage.tsx'
const NEWS = 'src/areas/clubs/components/ClubNewsPanel.tsx'
const EVENTS = 'src/areas/clubs/components/ClubEventsList.tsx'
const ADMIN = 'src/pages/AdminClubPage.tsx'
const APP = 'src/App.tsx'
const CARD = 'src/areas/clubs/components/RegionClubCard.tsx'
const PAGE_TEST = 'test/unit/my-region-club-page.test.tsx'
const EDGES = 'test/unit/my-region-club-page-edges.test.tsx'
const LIFT = 'test/unit/admin-club-news-lift.test.tsx'
const BEFORE = 'test/unit/fixtures/admin-club-news-before.json'
const NO_DATES = 'test/unit/club-pages-no-dates.test.tsx'
const SELF = 'test/unit/redesign-status-ws09-step12.test.ts'
/** The files this step adds, and those of them that are unit tests. */
const NEW_FILES = [PAGE, NEWS, EVENTS, PAGE_TEST, EDGES, LIFT, BEFORE, SELF]
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
/** The files lint reads that this step adds. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.tsx?$/.test(f))
/** The tests whose pins this step moves. */
const MOVED = [
  'test/unit/app-routes.test.tsx', 'test/unit/themeScopes.test.ts', 'test/unit/my-region-page.test.tsx', 'test/unit/redesign-status-ws09-step11.test.ts',
  'test/unit/redesign-status-ws09-t-merge2.test.ts', 'test/unit/redesign-status-ws09-t-review.test.ts',
]
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
/**
 * A file's cases as vitest counts them, for a file some of whose cases are made
 * in a loop: each plain `it(` line once, and the `it(` right inside a loop once
 * for each value the loop runs over, a list written in the loop itself or a
 * list of rows named in it and written above it.
 */
function loopedCasesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  const loops = [...text.matchAll(/^\s*for \(const (?:\w+|\[[^\]]*\]) of ([^)]+)\) \{\n\s*it\(/gm)]
  let count = (text.match(/^\s*it\(/gm) ?? []).length - loops.length
  for (const loop of loops) {
    const over = loop[1].trim()
    if (over.startsWith('[')) {
      count += (over.match(/'[^']*'/g) ?? []).length
      continue
    }
    const at = text.lastIndexOf(`const ${over}`, loop.index)
    expect(at, `${file}: the rows of ${over}`).toBeGreaterThan(-1)
    const rows = /= \[\n([\s\S]*?)\n\s*\]/.exec(text.slice(at))?.[1] ?? ''
    count += rows.split('\n').filter((l) => /^\s*\[/.test(l)).length
  }
  return count
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out, line comments and block comments alike. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
/** The cases other unit tests gained, as the Files part writes them: "(41 cases, 40 on the base)". */
const grownOf = (files: string) => [...files.matchAll(/\((\d+) cases, (\d+) on the base/g)].reduce((a, m) => a + Number(m[1]) - Number(m[2]), 0)

describe('REDESIGN_STATUS.md, WS09 checkpoints S and T: the merges', () => {
  it('sits once, right after WS09 step 11\'s block, and right before this step\'s', () => {
    expect(merges).not.toBe('')
    expect(ws09.split(`\n${MERGES}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(MERGES)
    expect(headings[headings.indexOf(MERGES) + 1]).toBe(STEP)
  })

  it('records K\'s word, both pull requests with their commits and parents, the order of the build and the checks, and nothing more', () => {
    for (const piece of [
      'Sun, Nov 15, 2026', 'about 12:15 AM UTC', '"You can merge."', 'checkpoint S and then checkpoint T', 'ahead of the mail stream\'s checkpoint P by K\'s choice',
      'no merge of its own and no fence day stood in the way',
      'Pull request 130, merged as `bd808c5`, its parents `f914d8f` and `402f7f0`', 'K turned "Apply database migrations" off', 'live at 12:25 AM UTC',
      'run 25 was started by hand on `main` on K\'s plain word and was green at 12:27 AM UTC', 'migrations 0065, 0066 and 0067 applied',
      '25 clubs with a region and a distinct short address, 18 statements, 7 About texts, 26 places all pinned, 6 old addresses, no doubled apostrophe, and the ledger ending at 0067',
      'The Baton Rouge / East Central seat still had no region.',
      'Pull request 131, merged as `9293e2f`, its parents `bd808c5` and `bc13162`', 'It adds no migration; it was live at 12:43 AM UTC', 'every clubs switch off',
      'CI on `main` was green for both merge commits.', 'left as written history',
    ]) expect(merges, piece).toContain(piece)
  })

  it('gives the Status line this step\'s tail while this step is the latest, and the PR line the two merges', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestStep === 12) {
      expect(tail).toBe('checkpoints S and T merged into `main` on Sun, Nov 15, 2026; checkpoint U goes on on its own branch; steps 1 to 12, K\'s answers to checkpoint S\'s review and K\'s second answer, the Clubs page on a narrow phone, are built.')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(statusLine).not.toContain('checkpoint S waits for its pull request')
    expect(prLine).toBe('**PR:** checkpoint S (steps 1 to 5) merged into `main` as pull request 130, `bd808c5`, and checkpoint T (steps 6 to 9) as pull request 131, `9293e2f`, both on Sun, Nov 15, 2026, on K\'s word, ahead of the mail stream\'s checkpoint P by K\'s choice; the six checkpoints after them come one at a time, each merged on its own.')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 12: the block', () => {
  it('sits once, right after the merges\' block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    if (latestStep === 12) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('opens by saying what the step draws, behind which switch, and what ships', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the third step of checkpoint U', '`/workspace/region/clubs/:id`', 'behind `clubKeepers`, which stays off', 'Work-H-2', 'Listing, News and Events, with no Tonight tab',
      'This step turns nothing on', 'the page\'s file is never fetched', 'draws exactly what it drew on the base for every kind of person',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **Who may open.**', '- **The header and Still accurate.**', '- **The tabs.**', '- **News as today.**', '- **The events.**',
      '- **No weekly claims.**', '- **The words and the look.**', '- **The map.**', '- **The branch.**', '- **What the merge does.**',
      '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Pins moved.**',
      '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })

  it('names every file it adds and changes, each new test with its count, and the two sub-lines, and leaves the held files alone', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ADMIN, APP, CARD, NO_DATES, ...MOVED, 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    expect(files).toContain('`src/App.tsx`, this stream\'s own lines alone: the lazy page and its route')
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const piece of [`\`${CARD}\``, `\`${LIFT}\``, 'No file the mail stream holds is touched', '`src/components/layout/Navbar.tsx`', '`src/lib/features.ts`', '`src/contexts/AuthContext.tsx`']) {
      expect(beyond, piece).toContain(piece)
    }
    for (const file of ['src/components/layout/Navbar.tsx', 'src/pages/AdminPage.tsx', 'src/pages/AdminEmailPage.tsx', 'src/lib/features.ts', 'src/contexts/AuthContext.tsx']) {
      expect(read(file), file).not.toMatch(/MyRegionClub|workspace\/region\/clubs|ClubNewsPanel|WS09 step 12/)
    }
    expect(read('src/lib/features.ts')).toContain('  clubKeepers: false,')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 12: the parts against the files', () => {
  it('names who may open as the route, the guard and the page hold it', () => {
    const who = bullet(block, '- **Who may open.**')
    for (const piece of [
      '`<RoleProtectedRoute requireSeat requireClubMatch>`', '`managedClubs`', 'another region\'s representative, a club\'s own rep with no seat over it, a plain member and a guest',
      '`test/integration/club-permissions.test.ts` holds, unchanged', '"This club is not found here."', 'a club\'s own rep whose seat covers only other regions', 'Back to My region', '`<Navigate to="/dashboard" replace />`', `\`${PAGE_TEST}\``,
    ]) expect(who, piece).toContain(piece)
    const app = read(APP)
    expect(app).toContain('const MyRegionClubPage = lazy(() => import(\'@/pages/MyRegionClubPage\').then(m => ({ default: m.MyRegionClubPage })))')
    expect(app).toContain('<Route path="/workspace/region/clubs/:id" element={FEATURES.clubKeepers ? <RoleProtectedRoute requireSeat requireClubMatch><MyRegionClubPage /></RoleProtectedRoute> : <Navigate to="/dashboard" replace />} />')
    const page = codeOf(PAGE)
    expect(page).toContain('const keeps = !!data && (isAdmin || regionalClubIds.includes(data.club.id))')
    expect(page).toContain('return <ClubInRegion key={id} id={id} />')
    expect(page).toContain('if (err instanceof ApiError && (err.status === 403 || err.status === 404)) return { kind: \'not-here\' }')
    expect(read('test/integration/club-permissions.test.ts')).toContain('role safety: signed out, a member with no seat and another region')
  })

  it('names the header, Still accurate and the tabs as the page draws them', () => {
    const header = bullet(block, '- **The header and Still accurate.**')
    for (const piece of ['"My LCA › My region › {club}"', '`checkWords`', '"Not checked since Aug 2026"', 'There is no "kept by"', 'sends `{}`', '"View public page (opens in a new tab)"', '"You\'re here as an LCA admin" with Back to Admin']) {
      expect(header, piece).toContain(piece)
    }
    const page = codeOf(PAGE)
    expect(page).toContain('checkWords(club.last_confirmed_at, openedAt)')
    expect(page).toContain('aria-label="View public page (opens in a new tab)"')
    expect(page).toContain('target="_blank" rel="noopener noreferrer"')
    expect(page).not.toMatch(/kept by/)
    const tabs = bullet(block, '- **The tabs.**')
    for (const piece of ['Listing, News and Events, and no Tonight tab', '`?tab=news`', '44px', '`aria-current`', 'the one club editor', 'the one PATCH', 'Nothing about saving is written on the page itself']) {
      expect(tabs, piece).toContain(piece)
    }
    expect(page).toContain('{ id: \'listing\', label: \'Listing\' },\n  { id: \'news\', label: \'News\' },\n  { id: \'events\', label: \'Events\' },')
    expect(page).not.toMatch(/saveClubListing|adminUpdateClub|text-lca-gold/)
    expect(page).toContain('const ClubEditor = lazy(() => import(\'@/areas/clubs/components/ClubEditor\')')
  })

  it('names News as today and the events as the files hold them', () => {
    const news = bullet(block, '- **News as today.**')
    for (const piece of ['moved line for line', 'There is no edit', '"Sat, Nov 7, 2026"', '"Delete: Example club night"', `\`${LIFT}\``, 'passed unchanged before and after the move']) {
      expect(news, piece).toContain(piece)
    }
    expect(read(ADMIN)).toContain('import { ClubNewsPanel } from \'@/areas/clubs/components/ClubNewsPanel\'')
    expect(read(ADMIN)).not.toContain('myRegion')
    expect(read(NEWS)).toContain('{myRegion ? formatDate(item.news_date, { year: true }) : item.news_date}')
    expect(Object.keys(JSON.parse(read(BEFORE)) as Record<string, string>)).toHaveLength(8)
    const events = bullet(block, '- **The events.**')
    for (const piece of ['`formatDate`', '"Sat, Dec 5, 2026"', 'Upcoming, Under way or Finished', '"Draft, not public"', '`/admin/tournaments/:id`', '`/tournaments/:id`', 'WS09 step 19']) {
      expect(events, piece).toContain(piece)
    }
    const list = codeOf(EVENTS)
    expect(list).toContain('formatDate(event.date, { year: true })')
    expect(list).toContain('Draft, not public')
    expect(codeOf(PAGE)).toContain('if (isAdmin || isViewOnlyAdmin(role) || ownRep || directs) return \'manage\'')
    expect(codeOf(PAGE)).toContain('return event.is_visible === 1 ? \'public\' : null')
    expect(read('functions/utils/admin/permissions.ts')).toMatch(/export async function canManageTournament/)
  })

  it('names the look and its mends, and Open\'s new address', () => {
    const look = bullet(block, '- **The words and the look.**')
    for (const piece of ['Player One', 'Player Two', '320, 360, 390, 768 and 1280', 'no axe violation', 'four mends', 'put back afterwards', 'deleted afterwards']) expect(look, piece).toContain(piece)
    expect(codeOf(CARD)).toContain('<Link to={`/workspace/region/clubs/${encodeURIComponent(club.id)}`} aria-label={`Open: ${club.name}`}>Open</Link>')
    expect(codeOf(EVENTS)).toContain('{registration ? `${stateWords(event.status)} · ${registration}` : stateWords(event.status)}')
    expect(codeOf(PAGE)).toContain('<li><Link to="/workspace/region" className={BAND_LINK}>My region</Link></li>')
    expect(codeOf(PAGE)).toContain('<div className={CLEAR_OF_HEADER} onFocus={keepClearOfHeader}>')
  })

  it('names the map\'s sentences, the branch and what the merge does, with the figures while this step is the latest', () => {
    const mapPart = bullet(block, '- **The map.**')
    for (const piece of ['20 items', 'a sentence added to criterion 1 and to criterion 9', 'It proves no item in full']) expect(mapPart, piece).toContain(piece)
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-u`', '`173319c`', 'This step\'s diff is against `173319c`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of ['No migration and no handler', '101 handler files', '33 of the 140 methods', '`PENDING_COUNT` 107', 'lazy pages are 38, 37 before', '`deploy-worker.yml` does not start']) {
      expect(does, piece).toContain(piece)
    }
    if (latestStep !== 12) return
    expect(Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)).toBe(33)
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 107')
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(101)')
    expect(read('test/unit/app-routes.test.tsx')).toContain('expect(pages.length).toBe(38)')
  })

  it('answers what main\'s code does on this database, what a revert leaves and what ships with every switch off', () => {
    const main = bullet(block, '- **What `main`\'s code does on this step\'s database.**')
    for (const piece of ['adds no migration', 'migrations 0065 to 0067']) expect(main, piece).toContain(piece)
    const revert = bullet(block, '- **What a revert leaves.**')
    for (const piece of ['leaves the database exactly as it found it', 'Open goes back to Your club\'s page']) expect(revert, piece).toContain(piece)
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Today\'s admin club page, unchanged:')).toBe(true)
    for (const piece of ['A visitor', 'never fetched', 'No switch is added']) expect(ships, piece).toContain(piece)
    expect(read(PAGE_TEST)).toContain('  it(\'sends every kind of person to the dashboard, fetches no file of the page and calls no answer\', async () => {')
    expect(read(LIFT)).toContain('  it(\'draws the markup it drew before the move, for each kind of person, with news and with none\', async () => {')
  })

  it('names its pins, and each moved check holds', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of ['`test/unit/app-routes.test.tsx`, one assertion: 38 lazy pages in place of 37', ...MOVED.slice(1).map((f) => `\`${f}\`, `), 'Not moved:', 'line 428']) {
      expect(pins, piece).toContain(piece)
    }
    expect(read('test/unit/themeScopes.test.ts')).toContain('      \'/workspace/region\',\n      \'/workspace/region/clubs/:id\',\n    ])')
    expect(read('test/unit/my-region-page.test.tsx')).toContain('toBe(\'/workspace/region/clubs/c-chess\')')
    const step11 = read('test/unit/redesign-status-ws09-step11.test.ts')
    expect(step11).toContain('if (latestStep === 11 || file !== NO_DATES) expect(writtenCount(files, file), file).toBe(casesIn(file))')
    for (const file of MOVED.slice(4)) expect(read(file), file).toContain('if (!ws09.includes(\'\\n### WS09 checkpoint T: checkpoints S and T merged and live\\n\')) expect(statusLine).toContain(')
    // The line pin of the admin club page holds where it was, and the page keeps its three lines with a long dash.
    expect(read('test/unit/goldText.test.ts')).toContain('\'src/pages/AdminClubPage.tsx:428 the style colour color: clubTextColor(color) -> light\'')
    expect(read(ADMIN).split('\n')[427]).toContain('color: clubTextColor(color),')
    expect(read(ADMIN).split('\n').filter((l) => DASHES.test(l))).toHaveLength(3)
  })

  it('gives the lint as unchanged and the build\'s figures as measured', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '556,219 bytes, 555,748 on the base, 471 more', '134,731 bytes, 134,117 on the base, 614 more',
      '`features-nZCZoT6G.js` 729 bytes, as on the base', '205 files, 202 on the base', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 12: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `173319c`\'s tree')
  })

  it('counts as many cases for each new test as the file holds, and for the test it grows', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(file === EDGES ? loopedCasesIn(file) : casesIn(file))
    if (latestStep === 12) expect(casesIn(NO_DATES)).toBe(7)
  })

  it('gives unit counts that add up: the base\'s, the new files\' and the cases other tests gained', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([9770, 402])
    const fresh = NEW_TESTS.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    expect(num(before) + fresh + grownOf(files)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts as the base\'s, since no integration test changes', () => {
    expect(checksLine).toContain('integration 2,404 in 134 files (2,404 in 134 on the base), every one passing')
  })

  it('gives the lint files as the base\'s with the new files lint reads added, and the build\'s file count once on each side', () => {
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1084)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_LINTED.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, 202 on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    expect(bullet(block, '- **Build.**')).toContain(`${built?.[1]} files, 202 on the base`)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 12: the map and the lists', () => {
  it('adds one sentence to criterion 1 and one to criterion 9, each before the planned step, and to no other item', () => {
    for (const [id, planned] of [['Criterion 1', 33], ['Criterion 9', 6]] as const) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 12: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 12: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
      expect(item.endsWith(`Planned: WS09 step ${planned}.`), id).toBe(true)
    }
    expect(mapItem('Criterion 1').indexOf('Built in WS09 step 11: ')).toBeLessThan(mapItem('Criterion 1').indexOf('Built in WS09 step 12: '))
    expect(mapItem('Criterion 9').indexOf('Built in WS09 step 6: ')).toBeLessThan(mapItem('Criterion 9').indexOf('Built in WS09 step 12: '))
    expect(mapItem('Criterion 1')).toContain(`\`${NO_DATES}\` and \`${PAGE_TEST}\``)
    expect(mapItem('Criterion 9')).toContain('`test/integration/club-permissions.test.ts`')
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 12:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 1', 'Criterion 9'])
  })

  it('records the step\'s decisions, deviations, verify items and follow-ups, each tagged, and closes WS09 step 11\'s two entries on Open', () => {
    expect(tagged(decisions).map(head)).toEqual(['One News tab for two pages (WS09 step 12).', 'An event leads only where the person may go (WS09 step 12).'])
    expect(tagged(deviations).map(head)).toEqual(['No keeper in the header (WS09 step 12).', 'No report banner yet (WS09 step 12).', 'News with no edit (WS09 step 12).'])
    expect(tagged(verify).map(head)).toEqual(['The brief over the board (WS09 step 12).', 'Today\'s news form (WS09 step 12).', 'Who may open an event\'s manage page (WS09 step 12).'])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed (?:on `173319c`|against)/)
    expect(tagged(followUps).map(head)).toEqual(['The admin club page\'s news dates (WS09 step 12).', 'Add a club event (WS09 step 12).'])
    const of = (text: string, start: string) => entries(text).find((l) => l.startsWith(start)) ?? ''
    expect(of(deviations, '- **Open goes to Your club\'s page (WS09 step 11).**')).toContain('Closed in WS09 step 12: Open goes to the club\'s page in My region')
    expect(of(followUps, '- **Open moves with WS09 step 12 (WS09 step 11).**')).toContain('Closed in WS09 step 12 for Open')
    expect(of(followUps, '- **A reload of My region before the seats arrive (WS09 step 11).**')).toContain('WS09 step 12\'s page, `/workspace/region/clubs/:id`, has the same window')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 12: plain language', () => {
  const added = (text: string, start: string) => {
    const entry = entries(text).find((l) => l.startsWith(start)) ?? ''
    return entry.slice(Math.max(0, entry.indexOf('WS09 step 12')))
  }
  const written = [
    merges, block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps),
    mapItem('Criterion 1').slice(mapItem('Criterion 1').indexOf('Built in WS09 step 12: ')),
    mapItem('Criterion 9').slice(mapItem('Criterion 9').indexOf('Built in WS09 step 12: ')),
    added(deviations, '- **Open goes to Your club\'s page (WS09 step 11).**'), added(followUps, '- **Open moves with WS09 step 12 (WS09 step 11).**'),
    statusLine, prLine,
  ].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the step wrote, and dates and times in their plain form', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    expect(written).not.toMatch(/\.github\//)
    const prose = proseOf(written)
    expect(prose).not.toMatch(HE)
    expect(written).not.toMatch(/\(step \d+[;),]/)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const found of prose.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}\b(?!:)/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds or changes', () => {
    // App.tsx and the admin club page held long dashes before this step; App's own lines are read alone, and the page keeps its three.
    const own = read(APP).split('\n').filter((l) => /MyRegionClub|workspace\/region\/clubs/.test(l)).join('\n')
    expect(own).not.toBe('')
    for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(own).not.toMatch(rule)
    for (const file of [...NEW_FILES, CARD, NO_DATES, ...MOVED]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })

  it('writes the page\'s own words plainly, and the tests\' names and places plainly made up', () => {
    for (const file of [PAGE, NEWS, EVENTS]) {
      const text = codeOf(file)
      expect(text, file).not.toMatch(/\b(?:Tonight|calendar|your page|your club)\b/i)
      for (const found of text.matchAll(/'[^'\n]*\b\d{1,2}:\d{2}[^'\n]*'/g)) expect(found[0], file).toMatch(/\b(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)\b/)
    }
    for (const file of [PAGE_TEST, LIFT, NO_DATES, BEFORE]) expect(read(file), file).not.toMatch(/@(?!example\.org|testing-library|\/|domain|vitest)[a-z]/)
  })
})
