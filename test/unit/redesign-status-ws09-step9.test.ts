// test/unit/redesign-status-ws09-step9.test.ts
//
// REDESIGN_STATUS.md records WS09 step 9: Your club's page and the ways in,
// and checkpoint T's own section after it. Like WS09 step 8's record test,
// this file reads only the WS09 section, from its heading to the WS10
// heading. Pinned here: the block's place, right after the block for the
// merge of checkpoint S's answers, with checkpoint T's section after it and
// before the four lists; the Status line's tail while this step is the
// latest; the block's parts in order and its figures, which must agree with
// each other and with the files they describe; checkpoint T's section, with
// what ships with every switch off for steps 6 to 9 and K's note on the
// order of the switches; the sentence this step added to the map; the
// tagged entries of the four lists; and the plain-language rules over the
// block and the files the step adds or changes. What a later step will
// change in the tree (the pending count, the handler count, the count of
// lazy pages, the cases of a test a later step grows) is read only while
// this step is the latest.
import { readFileSync } from 'node:fs'
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
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[A-Z]+_(?:CASES|LINE)\\b|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i
/** The phrase checkpoint T's merge marks its own lines with, which this step does not write. */
const MERGE_MARK = 'Changed after K\'s answers: '

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
const TAG = '(WS09 step 9).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const MERGE = '### WS09 checkpoint T: checkpoint S\'s answers brought in'
const STEP = '### WS09 step 9: Your club\'s page and the ways in'
const CHECKPOINT = '### Checkpoint T: WS09 steps 6 to 9, the keepers\' editor and its ways in'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const checkpoint = part(CHECKPOINT)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))

const PAGE = 'src/pages/YourClubPage.tsx'
const APP = 'src/App.tsx'
const GUARD = 'src/components/auth/RoleProtectedRoute.tsx'
const ROLES = 'src/areas/admin/roles.ts'
const MANAGE = 'src/pages/ManageClubPage.tsx'
const WORKSPACE = 'src/pages/WorkspacePage.tsx'
const HANDLER = 'functions/api/admin/clubs/[id].ts'
const API = 'src/areas/clubs/api.ts'
const BASICS = 'src/areas/clubs/components/EditorBasics.tsx'
const PLACES = 'src/areas/clubs/components/EditorPlaces.tsx'
const PICKER = 'src/areas/clubs/components/ClubLocationPicker.tsx'
const EDITOR = 'src/areas/clubs/components/ClubEditor.tsx'
const PERMISSIONS = 'test/integration/club-permissions.test.ts'
/** The integration test this step adds, beside the one it changes. */
const EDGES = 'test/integration/club-by-slug-edges.test.ts'
/** The files this step adds, those of them that are unit tests, and those that are integration tests. */
const NEW_FILES = [
  PAGE, 'test/unit/your-club-route.test.tsx', 'test/unit/your-club-page-edges.test.tsx', 'test/unit/club-editor-shut-while-saving.test.tsx',
  'test/unit/keeps-any-club.test.ts', 'test/unit/redesign-status-ws09-step9.test.ts', EDGES,
]
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new files lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.tsx?$/.test(f))
/** The files this step changes that are not tests. */
const CHANGED = [APP, GUARD, ROLES, MANAGE, WORKSPACE, HANDLER, API, BASICS, PLACES, PICKER, EDITOR]
/** The unit tests this step changes, each with its count and the count before. */
const CHANGED_UNIT: ReadonlyArray<readonly [string, number, number]> = [
  ['test/unit/club-editor.test.tsx', 44, 43],
  ['test/unit/redesign-status-ws09-step8.test.ts', 26, 26],
  ['test/unit/redesign-status-ws09-step6.test.ts', 24, 24],
]
/** The integration tests this step changes, each with its count and the count before. */
const CHANGED_INTEGRATION: ReadonlyArray<readonly [string, number, number]> = [[PERMISSIONS, 43, 35]]
/** The cases a unit test gained with no case of its own changed: one for the new lazy page. */
const GROWN = 1
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])
/** A file's code with its comments taken out, line comments and block comments alike. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

describe('REDESIGN_STATUS.md, WS09 step 9: the block and the Status line', () => {
  it('sits once, right after the block for the merge of checkpoint S\'s answers, with checkpoint T\'s section after it and before the four lists', () => {
    expect(block).not.toBe('')
    expect(checkpoint).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(ws09.split(`\n${CHECKPOINT}\n`)).toHaveLength(2)
    const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
    expect(headings[headings.indexOf(MERGE) + 1]).toBe(STEP)
    expect(headings[headings.indexOf(STEP) + 1]).toBe(CHECKPOINT)
    if (latestStep === 9) expect(headings[headings.indexOf(CHECKPOINT) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest', () => {
    expect(latestStep).toBeGreaterThanOrEqual(9)
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestStep === 9) {
      expect(tail).toBe('checkpoint S waits for its pull request; checkpoint T, steps 6 to 9, waits on its own branch for its review; steps 1 to 9 and K\'s answers to checkpoint S\'s review are built.')
    }
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying what the step builds, behind which switch, and what ships', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the fourth and last step of checkpoint T', 'its third page step', '`/my/club/:slug`', '`clubKeepers` is on, which stays false', '`CLUB_KEEPERS_ON` is set, which stays unset',
      'what WS09 step 8 carried over', 'This step turns nothing on', 'sends everyone to the dashboard', 'today\'s admin club page, unchanged',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The ways in.**', '- **Who may open.**', '- **The page.**', '- **Carried from WS09 step 8.**', '- **The map.**',
      '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**',
      '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 9: the parts', () => {
  it('names every file it adds and changes, each test with its count, and the two sub-lines', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT.map(([f]) => f), ...CHANGED_INTEGRATION.map(([f]) => f), 'test/unit/app-routes.test.tsx', 'REDESIGN_STATUS.md']) {
      expect(files, name).toContain(`\`${name}\``)
    }
    for (const name of [...NEW_TESTS, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const [name, after, before] of [...CHANGED_UNIT, ...CHANGED_INTEGRATION]) {
      expect(files, name).toContain(after === before ? `\`${name}\` (${after}, as before: ` : `\`${name}\` (${after}, ${before} before: `)
    }
    expect(files).toContain('`test/unit/app-routes.test.tsx` (36 lazy pages in place of 35')
    const grown = bullet(files, '  - Grown with no change:')
    for (const piece of ['`test/unit/themeScopes.test.ts`', '`test/unit/search-addresses.test.ts`', '`test/unit/route-audit.test.ts` keeps its 89 cases', 'the page makes no new call']) {
      expect(grown, piece).toContain(piece)
    }
    expect(files).toContain('  - Files beyond the step\'s list: `src/areas/admin/roles.ts`')
    expect(files).toContain('Nothing under `functions/utils/`, `domain/` or `workers/` changes, no migration, endpoint, contract, call or switch is added, and no file the mail stream holds is touched; `src/components/layout/Navbar.tsx` is untouched.')
  })

  it('names the ways in as the route, the guard and the pages hold them', () => {
    const ways = bullet(block, '- **The ways in.**')
    for (const piece of [
      '`keepsAClub`', '`canManageClub`', 'never asking for another club', 'an observer, whom the server reads as today, is sent away', 'with no second request',
      'an LCA admin goes to the Clubs list, `/admin/clubs`', '"Edit club"', '"Add it"', '"Public page" and the two counts keep today\'s links', '`test/unit/your-club-route.test.tsx`',
    ]) expect(ways, piece).toContain(piece)
    const app = read(APP)
    expect(app).toContain('const YourClubPage = lazy(() => import(\'@/pages/YourClubPage\').then(m => ({ default: m.YourClubPage })))')
    expect(app).toContain('<Route path="/my/club/:slug" element={FEATURES.clubKeepers ? <RoleProtectedRoute keepsAClub><YourClubPage /></RoleProtectedRoute> : <Navigate to="/dashboard" replace />} />')
    expect(app).toContain('<Route path="/manage/club" element={<RoleProtectedRoute roles={FEATURES.clubKeepers ? [\'club_rep\', \'lca_admin\'] : [\'club_rep\']}><ManageClubPage /></RoleProtectedRoute>} />')
    expect(codeOf(GUARD)).toContain('if (keepsAClub && !keepsAnyClub(role, member?.club_id, regionalClubIds)) {')
    expect(codeOf(ROLES)).toContain('if (role === \'club_rep\' && !!memberClubId) return true\n  return regionalClubIds.length > 0')
    const manage = codeOf(MANAGE)
    expect(manage).toContain('if (role === \'lca_admin\') return <Navigate to="/admin/clubs" replace />')
    expect(manage).toContain('return <Navigate to={`/my/club/${member.club_id}`} replace />')
    expect(manage).toContain('return <Navigate to={`/admin/clubs/${member.club_id}`} replace />')
    const workspace = codeOf(WORKSPACE)
    expect(workspace).toContain('const editTo = keepersOn() ? `/my/club/${club.slug || club.id}` : `/admin/clubs/${club.id}`')
    expect(workspace.match(/to=\{editTo\}/g)).toHaveLength(2)
    expect(workspace).toContain('<Link to={`/clubs/${club.id}`}>')
    expect(workspace.match(/to=\{`\/admin\/clubs\/\$\{club\.id\}\?tab=roster`\}/g)).toHaveLength(2)
    const page = codeOf(PAGE)
    expect(page).toContain('const ownClub = role === \'club_rep\' && regionalClubIds.length === 0 ? member?.club_id ?? null : null')
    expect(page).toContain('|| !canManageClub(role, member?.club_id, data.club.id, regionalClubIds)')
  })

  it('names who may open as the GET holds it, and the pins of the GET hold', () => {
    const who = bullet(block, '- **Who may open.**')
    for (const piece of [
      'reads the value as a club\'s id first, then as a club\'s page address now, and follows no old address', '`requireClubView`', 'observers aside as today',
      'another region\'s representative, another club\'s rep, a one-event director, a member, a seat holder whose term has ended, a guest and a child account get 403',
      'not found for an LCA admin and an observer, 403 for everyone else', '`admittedByRegionAlone` reads the club\'s own id', 'as at the base',
      '`test/integration/club-permissions.test.ts`', 'the `slug` column of migration 0066',
    ]) expect(who, piece).toContain(piece)
    const handler = read(HANDLER)
    const get = between(handler, 'export const onRequestGet', 'export const onRequestPatch')
    expect(get).toMatch(/^export const onRequestGet: PagesFunction<Env> = async \(context\) => \{\n\s*\/\/.*\n\s*const clubId = CLUB_KEEPERS_ON\n\s*\? await clubNamedBy\(context\.env\.DB, context\.params\.id as string\)\n\s*: context\.params\.id as string\n\s*const authResult = await requireClubView\(context\.request, context\.env, clubId\)\n/)
    const lookup = between(handler, 'async function clubNamedBy(', '\n}\n')
    expect(lookup.indexOf('WHERE id = ?')).toBeGreaterThan(-1)
    expect(lookup.indexOf('WHERE id = ?')).toBeLessThan(lookup.indexOf('WHERE slug = ?'))
    expect(lookup).toContain('return bySlug?.id ?? value')
    expect(lookup).not.toContain('club_slug_history')
    // The pins earlier steps hold on the handler still hold.
    expect(handler.split('SELECT ${ADMIN_CLUB_COLUMNS} FROM clubs')).toHaveLength(3)
    expect(handler.match(/rosterKeptBack/g)).toHaveLength(1)
    expect(handler).toContain('admittedByRegionAlone(authResult.member, clubId)')
    expect(handler).toContain('  if (!CLUB_KEEPERS_ON) return jsonResponse(answer)\n')
    expect(handler).toContain('await requireClubRep(context.request, context.env, clubId)')
    const cases = read(PERMISSIONS)
    for (const name of [
      'with CLUB_KEEPERS_ON unset, a page address that is not the club\\\'s id and an old address name no club, as at the base: not found for an LCA admin and an observer, 403 for the rest',
      'with CLUB_KEEPERS_ON set, an LCA admin, the club\\\'s rep and the region\\\'s representative find the club by its page address, with the answer they get by its id',
      'with CLUB_KEEPERS_ON set, an old address finds no club and never another: not found for an LCA admin, 403 for the club\\\'s rep and the region\\\'s representative',
      'with CLUB_KEEPERS_ON set, a person admitted by the region alone gets no roster, no officer\\\'s email and no hidden draft by the page address, and is still refused adding or removing an officer',
      'role safety: signed out, the GET by a page address answers 401, with CLUB_KEEPERS_ON set and unset',
    ]) expect(cases, name).toContain(`  it('${name}', async () => {`)
    expect(cases.split('\n')[398]).toContain('body.tournaments')
  })

  it('says what the page draws, its last save read in Central time, and what it never draws', () => {
    const drawn = bullet(block, '- **The page.**')
    for (const piece of [
      '"Your club\'s page"', 'one main heading', '"Last saved Sat, Nov 14, 2026 at 7:00 PM."', 'Central time', '`stored: \'utc\'`', '"Not saved here yet."', '"See your page"',
      '`/clubs/` and the club\'s id', 'the address that exists today', 'The browser\'s title names the club', '"This club\'s page is not one you keep, so it cannot be changed here."',
      '"No club has this address."', 'draws nothing of any club', 'never the roster, an officer or an event', 'at least 44 pixels tall', 'no gold word on a light ground',
    ]) expect(drawn, piece).toContain(piece)
    const page = codeOf(PAGE)
    expect(page).toContain('const date = formatDate(club.told_updated_at, { stored: \'utc\', year: true })')
    expect(page).toContain('const time = formatTime(club.told_updated_at, { stored: \'utc\' })')
    expect(page).toContain('<Link to={`/clubs/${club.id}`}>')
    expect(page.match(/<h1\b/g)).toHaveLength(1)
    expect(page).toContain('usePageTitle(club ? `Your club\'s page: ${club.name}` : \'Your club\\\'s page\')')
    expect(page).not.toMatch(/\.(?:officers|roster|rosterKeptBack|tournaments)\b/)
    expect(read(API)).toContain('fetch(`/api/admin/clubs/${encodeURIComponent(id)}`')
  })

  it('closes what WS09 step 8 carried over, as the files hold it', () => {
    const carried = bullet(block, '- **Carried from WS09 step 8.**')
    for (const piece of [
      'the region\'s list, the pins\' boxes, Use this, Remove pin, Remove place 2 and Add another place', '`aria-disabled`', 'disabled only inside an observer\'s shut fieldset',
      'every key but Tab are cancelled', 'its own handler refuses the press', 'read only as well', 'the map takes no click or drag', '`test/unit/club-editor.test.tsx`',
    ]) expect(carried, piece).toContain(piece)
    const basics = codeOf(BASICS)
    expect(basics).toContain('id="editor-region" className={SELECT} value={values.region} aria-disabled={waiting || undefined}')
    expect(basics).toContain('onMouseDown={(e) => { if (waiting) e.preventDefault() }}')
    expect(basics).toContain('onKeyDown={(e) => { if (waiting && e.key !== \'Tab\') e.preventDefault() }}')
    expect(basics).toContain('onChange={(e) => { if (!waiting) onChange(\'region\', e.target.value) }}')
    expect(basics).not.toMatch(/ disabled=\{waiting\}/)
    expect(between(basics, 'const SELECT =', '\n\n')).toContain('aria-disabled:cursor-not-allowed aria-disabled:opacity-50')
    const places = codeOf(PLACES)
    expect(places.match(/disabled=\{disabled\} aria-disabled=\{waiting \|\| undefined\}/g)).toHaveLength(2)
    expect(places.match(/if \(waiting\) return\n/g)).toHaveLength(2)
    expect(places.match(/waiting=\{waiting\}\n/g)).toHaveLength(2)
    const picker = codeOf(PICKER)
    expect(picker).toContain('const shut = !!disabled || !!waiting')
    expect(picker).toContain('readOnly={waiting}')
    expect(picker.match(/aria-disabled=\{waiting \|\| undefined\}/g)).toHaveLength(3)
    expect(picker).toContain('function applyPasted() {\n    if (waiting) return')
    expect(picker).toContain('onClick={() => { if (!waiting) setDraft(null) }}')
    const editor = codeOf(EDITOR)
    expect(editor).toContain('disabled={viewOnly}\n                      waiting={busy}')
    expect(editor).not.toContain('disabled={viewOnly || busy}')
    expect(read('test/unit/club-editor.test.tsx')).toContain('  it(\'keeps the focus on the region\\\'s list, the pin\\\'s box and buttons and the second place\\\'s button when a press held for the logo starts its save, and none of them takes a press until it ends\', async () => {')
  })

  it('names the map\'s sentence, the brief\'s three addresses, the branch, and what the merge does, with the figures while this step is the latest', () => {
    const mapPart = bullet(block, '- **The map.**')
    for (const piece of ['20 items', 'a sentence added to D17', '`/my/club/:slug`', '`/workspace/region/clubs/:id`', '`/admin/clubs/:id`', 'WS09 steps 11 and 12', 'It proves no item in full.']) {
      expect(mapPart, piece).toContain(piece)
    }
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-t`', '`3ab1ddf`', 'this step\'s diff is against `3ab1ddf`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of [
      'No migration and no handler', '99 handler files', '31 of the 138 methods under `functions/api` contracted', '`PENDING_COUNT` 107', '36 lazy pages', '`deploy-worker.yml` does not start',
    ]) expect(does, piece).toContain(piece)
    const worker = read('.github/workflows/deploy-worker.yml')
    expect(worker).not.toContain('functions/api/')
    if (latestStep !== 9) return
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 107')
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(99)')
    expect(read('test/unit/app-routes.test.tsx')).toContain('expect(pages.length).toBe(36)')
  })

  it('answers what main\'s code does on this database and what a revert leaves', () => {
    const main = bullet(block, '- **What `main`\'s code does on this step\'s database.**')
    for (const piece of ['adds no migration and writes nothing', 'the GET\'s lookup only reads', 'only through WS09 step 6\'s PATCH and today\'s logo upload']) expect(main, piece).toContain(piece)
    const revert = bullet(block, '- **What a revert leaves.**')
    for (const piece of ['leaves the database exactly as it found it', 'the rows the editor\'s saves wrote stay']) expect(revert, piece).toContain(piece)
  })

  it('says what ships with every switch off, and the switch and its constant stay off', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Today\'s `/manage/club`, Workspace and admin club page, unchanged')).toBe(true)
    for (const piece of [
      '"off: the route sends to the dashboard and /manage/club is today\'s"', '`test/unit/your-club-route.test.tsx`', 'compares with the base\'s own answer', 'No switch is added',
    ]) expect(ships, piece).toContain(piece)
    expect(read('src/lib/features.ts')).toContain('  clubKeepers: false,')
    expect(read('src/lib/features.ts')).toContain('  clubEmailHidden: false,')
    expect(read('functions/utils/clubs/pages.ts')).toContain('export const CLUB_KEEPERS_ON = false')
    expect(read('test/unit/your-club-route.test.tsx')).toContain('  it(\'off: the route sends to the dashboard and /manage/club is today\\\'s\', async () => {')
  })

  it('names its pins, and the moved checks hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/unit/redesign-status-ws09-step8.test.ts`, three assertions', '`test/unit/redesign-status-ws09-step6.test.ts`, one assertion', '`test/unit/club-editor.test.tsx`, one case of WS09 step 8',
      '`test/unit/app-routes.test.tsx`, one assertion', 'Not moved:', 'line 412',
    ]) expect(pins, piece).toContain(piece)
    const step8 = read('test/unit/redesign-status-ws09-step8.test.ts')
    expect(step8).toContain('expect(basics.match(/aria-disabled=\\{waiting \\|\\| undefined\\}/g)?.length).toBe(3)')
    expect(step8).toContain('expect(basics.match(/ disabled=\\{waiting\\}/g)).toBeNull()')
    expect(read('test/unit/redesign-status-ws09-step6.test.ts')).toContain('if (latestStep === 6 || file !== \'test/integration/club-permissions.test.ts\') expect(casesIn(file), file).toBe(n)')
    expect(read('test/unit/goldText.test.ts')).toContain('\'src/pages/AdminClubPage.tsx:412 the style colour color: clubTextColor(color) -> light\'')
    expect(read('src/pages/AdminClubPage.tsx').split('\n')[411]).toContain('color: clubTextColor(color),')
  })

  it('gives the lint as unchanged and the build\'s figures with their reasons', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-BT5YUxh0.js` 554,420 bytes', '`index-DZjlh98x.css` 133,102 bytes', '`features-nZCZoT6G.js` 729 bytes', '`YourClubPage`', '`switches`', '`clock`',
      '201 files, 198 on the base', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 9: checkpoint T\'s section', () => {
  it('has its parts in order, and says what ships with every switch off for steps 6 to 9', () => {
    const parts = [
      '- **What ships with every switch off.**', '- **What `main`\'s code does on this database.**', '- **What a revert leaves.**', '- **The order of the switches, for K.**',
      '- **Still with K.**', '- **The gate.**',
    ]
    const at = parts.map((p) => checkpoint.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const opening = checkpoint.split('\n')[2] ?? ''
    for (const piece of ['WS09 steps 6 to 9', '`redesign/ws09-clubs-t`', '`3ab1ddf`', 'It adds no migration and turns nothing on.']) expect(opening, piece).toContain(piece)
    const ships = bullet(checkpoint, '- **What ships with every switch off.**')
    for (const piece of [
      '`GET /api/admin/clubs/[id]`', 'by the id alone', 'a body carrying a new field is refused 403', '`PUT /api/admin/clubs/[id]/places` refuses every keeper 403',
      'the editor\'s file is never fetched', '`/my/club/:slug` sends everyone to the dashboard', 'the child profile delete of WS09 step 6', '`test/unit/club-editor-off.test.tsx`',
    ]) expect(ships, piece).toContain(piece)
    const main = bullet(checkpoint, '- **What `main`\'s code does on this database.**')
    expect(main).toContain('WS09 steps 6 to 9 add no migration')
    expect(main).toContain('migrations 0065 to 0067')
    expect(bullet(checkpoint, '- **Still with K.**')).toContain('items R3 and R4')
  })

  it('gives K\'s note on the order of the switches, as step 2\'s rule holds it', () => {
    const order = bullet(checkpoint, '- **The order of the switches, for K.**')
    for (const piece of [
      '`clubEmailHidden` on with `CLUB_EMAIL_HIDDEN` first', '(Q14)', '"Contact this club through LCA"', 'K\'s to make', 'Then, or in the same change, K turns `clubKeepers` on with `CLUB_KEEPERS_ON`',
      'the 25 clubs\' basics from the check sheet', '`switchOrderProblems`', '`test/unit/club-pages-switch.test.ts`', 'an email typed under "never shown" is never printed',
    ]) expect(order, piece).toContain(piece)
    expect(order.indexOf('`clubEmailHidden`')).toBeLessThan(order.indexOf('`clubKeepers`'))
    const rule = read('src/areas/clubs/switches.ts')
    expect(rule).toContain('if (features.clubKeepers && !features.clubEmailHidden) {')
    expect(rule).toContain('if (constants.CLUB_KEEPERS_ON && !constants.CLUB_EMAIL_HIDDEN) {')
    expect(read('src/pages/ClubDetailPage.tsx')).toContain('Contact this club through LCA')
    const gate = bullet(checkpoint, '- **The gate.**')
    for (const piece of ['WS09 step 9\'s Checks line', 'the one browser run of checkpoint T is made at its gate', '995 tests, 659 that run and 336 that skip']) expect(gate, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 9: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
    expect(checksLine).toContain('the base\'s figures from the gate on `3ab1ddf`\'s tree')
  })

  it('counts as many cases for each new test and each changed test as the file holds, while this step is the latest', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [...NEW_TESTS, ...NEW_INTEGRATION]) expect(writtenCount(files, file), file).toBe(casesIn(file))
    if (latestStep !== 9) return
    for (const [file, n] of [...CHANGED_UNIT, ...CHANGED_INTEGRATION]) expect(casesIn(file), file).toBe(n)
  })

  it('gives unit counts that add up: the base\'s, the new files\', the case the lazy pages gained and the cases the changed files gained', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([9466, 376])
    const fresh = NEW_TESTS.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    const moved = CHANGED_UNIT.reduce((a, [, n, was]) => a + n - was, 0)
    expect(num(before) + fresh + GROWN + moved).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts as the base\'s with the cases this step adds, in the changed file and the new one', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2340, 127])
    const added = CHANGED_INTEGRATION.reduce((a, [, n, was]) => a + n - was, 0)
    const fresh = NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    expect([num(after), Number(afterFiles)]).toEqual([2340 + added + fresh, 127 + NEW_INTEGRATION.length])
  })

  it('gives the lint files as the base\'s with the new files lint reads added, and the build\'s file count once on each side', () => {
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1041)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_LINTED.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, 198 on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    expect(bullet(block, '- **Build.**')).toContain(`${built?.[1]} files, 198 on the base`)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 9: the map and the lists', () => {
  it('adds one sentence to D17, before the planned step, and to no other item', () => {
    const item = mapItem('D17')
    expect(item.split('Built in WS09 step 9: ')).toHaveLength(2)
    expect(item.indexOf('Built in WS09 step 9: ')).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    expect(item.indexOf('Built in WS09 step 7: ')).toBeLessThan(item.indexOf('Built in WS09 step 9: '))
    expect(item.endsWith('Planned: WS09 step 37.')).toBe(true)
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 9:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['D17'])
  })

  it('records the step\'s decisions, deviations, verify items and follow-ups, each tagged, without the merge\'s mark', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'Your club\'s page at `/my/club/:slug` (WS09 step 9).', 'An old address finds no club in the keepers\' GET (WS09 step 9).',
      'Observers keep the admin club page (WS09 step 9).', 'The controls a save shuts keep the focus (WS09 step 9).',
    ])
    expect(tagged(deviations).map(head)).toEqual([
      'The editor\'s address rides on `clubKeepers` (WS09 step 9).', 'The representative reaches the same page (WS09 step 9).', 'More files than the entry names (WS09 step 9).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      '`/manage/club` today (WS09 step 9).', 'No address under `/my/` (WS09 step 9).', '`src/App.tsx` is shared (WS09 step 9).', 'The guard cannot read a page address (WS09 step 9).',
      'A club may have no page address (WS09 step 9).', 'Today\'s club page takes an id (WS09 step 9).', 'Who the GET admits (WS09 step 9).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `3ab1ddf`/)
    expect(tagged(followUps).map(head)).toEqual([
      'Items R3 and R4, answered by K, are left as they stand (WS09 step 9).','A focus held in a pin\'s picker when a save ends (WS09 step 9).', 'My LCA\'s own row and the header\'s link (WS09 step 9).',
      'Bring `main` in before checkpoint T\'s pull request (WS09 step 9).', 'Pictures with a stand-in sign-in (WS09 step 9).',
    ])
    for (const text of [block, checkpoint, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps)]) expect(text).not.toContain(MERGE_MARK)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 9: plain language', () => {
  const written = [
    block, checkpoint, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps),
    mapItem('D17').slice(mapItem('D17').indexOf('Built in WS09 step 9: ')), statusLine,
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
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    expect(written).not.toMatch(/\bUS Chess Federation\b/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds or changes', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT.map(([f]) => f), ...CHANGED_INTEGRATION.map(([f]) => f), 'test/unit/app-routes.test.tsx']) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
      // The clubs calls held one long dash before this step, which adds none.
      expect(text.split('\n').filter((l) => DASHES.test(l)).length, file).toBe(file === API ? 1 : 0)
    }
  })

  it('writes the words a person reads on the page plainly: a weekday on the date, a time as 7:00 PM, no old name for US Chess', () => {
    const text = read(PAGE)
    for (const found of text.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(found[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    expect(text).not.toMatch(/\bUSC\b|US Chess Federation/)
    expect(read('test/unit/your-club-route.test.tsx')).toContain('Last saved Sat, Nov 14, 2026 at 7:00 PM.')
  })
})
