// test/unit/redesign-status-ws09-step7.test.ts
//
// REDESIGN_STATUS.md records WS09 step 7: the editor, basics first, the one
// club editor drawn on today's admin club page while clubKeepers is on. Like
// WS09 step 6's record test, this file reads only the WS09 section, from its
// heading to the WS10 heading. Pinned here: the block's place, right after
// WS09 step 6's and before the four lists; the Status line's tail while this
// step is the latest; the block's parts in order and its figures, which must
// agree with each other and with the files they describe; the sentences this
// step added to the map; the tagged entries of the four lists, the follow-up
// on one notice for one press closed by this step's one save; and the
// plain-language rules over the block and the files the step adds or
// changes. What a later step will change in the tree (the page's line
// numbers, the pending count, the handler count) is read only while this
// step is the latest.
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'UNIT' + 'COUNT'}|${'RECORD' + '_CASES'}|${'LINT' + '_FILES'}`)
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
const TAG = '(WS09 step 7).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const STEP_6 = '### WS09 step 6: saving a listing'
const STEP = '### WS09 step 7: the editor, basics first'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(STEP)
const map = part('### WS09 map: what proves each acceptance criterion and decision')
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))

const PAGE = 'src/pages/AdminClubPage.tsx'
const API = 'src/areas/clubs/api.ts'
const PICKER = 'src/areas/clubs/components/ClubLocationPicker.tsx'
const EDITOR = 'src/areas/clubs/components/ClubEditor.tsx'
const BASICS = 'src/areas/clubs/components/EditorBasics.tsx'
const PLACES = 'src/areas/clubs/components/EditorPlaces.tsx'
const HELP = 'src/areas/clubs/components/EditorHelp.tsx'
const RULES = 'src/areas/clubs/editor.ts'
const FIXTURE = 'test/unit/fixtures/api-added-since-split.json'
const HANDLER = 'functions/api/admin/clubs/[id].ts'
const SAVE = 'functions/utils/clubs/save.ts'
const CONTRACT = 'domain/contracts/clubs.ts'
const ONE_PRESS = 'test/integration/club-save-one-press.test.ts'
/** The files this step adds, and those of them that are unit tests and integration tests. */
const NEW_FILES = [
  EDITOR, BASICS, PLACES, HELP, RULES, 'test/unit/helpers/clubSaveServer.ts',
  'test/unit/club-editor.test.tsx', 'test/unit/club-editor-edges.test.tsx', 'test/unit/club-editor-off.test.tsx', 'test/unit/redesign-status-ws09-step7.test.ts',
  ONE_PRESS,
]
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new files lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.tsx?$/.test(f))
/** The files this step changes that are not tests: WS09 step 6's PATCH, its save and its contract among them, for one press as one save. */
const CHANGED = [HANDLER, SAVE, CONTRACT, PAGE, API, PICKER, FIXTURE]
/** The unit tests this step changes, each with its count and the count before; the two whose cases are partly made by each are counted by vitest. */
const CHANGED_UNIT: ReadonlyArray<readonly [string, number, number]> = [
  ['test/unit/api-split-modules.test.ts', 28, 28],
  ['test/unit/redesign-status-ws09-step6.test.ts', 24, 24],
]
const CHANGED_EACH: ReadonlyArray<readonly [string, number]> = [
  ['test/unit/base-components-scope.test.ts', 9],
  ['test/unit/goldText.test.ts', 131],
]
/** The cases a unit test that grew with no change of its own gained: none, since the one save fetches a path the site already fetched. */
const GROWN = 0
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])
/** A file's code with its comments taken out, line comments and block comments alike. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('REDESIGN_STATUS.md, WS09 step 7: the block and the Status line', () => {
  it('sits once, right after WS09 step 6\'s block and before the four lists', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    const at = [STEP_6, STEP, LISTS[0]].map((h) => ws09.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
    expect(headings[headings.indexOf(STEP_6) + 1]).toBe(STEP)
    if (latestStep === 7) expect(headings[headings.indexOf(STEP) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest', () => {
    expect(latestStep).toBeGreaterThanOrEqual(7)
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestStep === 7) expect(tail).toBe('checkpoint S waits for its pull request; checkpoint T has begun on its own branch; steps 1 to 7 are built.')
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying what the step builds, behind which switch, and K\'s two choices that bind it', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the second step of checkpoint T', 'its first page step', 'the one club editor every keeper uses', '`clubKeepers` is on, which stays false',
      'K\'s decision 1 of Friday, November 13, 2026', 'choice 3 (a)', 'the one line about differing words is built too', 'choice 2 (a)', 'this step turns nothing on',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The basics.**', '- **One press, one save.**', '- **Help.**', '- **The promise holds.**', '- **On a phone.**',
      '- **The map.**', '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**', '- **What a revert leaves.**',
      '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 7: the parts', () => {
  it('names every file it adds and changes, each test with its count, and the two sub-lines', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT.map(([f]) => f), ...CHANGED_EACH.map(([f]) => f), 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const [name, after, before] of CHANGED_UNIT) {
      expect(files, name).toContain(after === before ? `\`${name}\` (${after}, as before: ` : `\`${name}\` (${after}, ${before} before: `)
    }
    for (const [name, n] of CHANGED_EACH) expect(files, name).toContain(`\`${name}\` (${n}, as before: `)
    for (const name of NEW_INTEGRATION) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    expect(files).toContain('  - Grown with no change: none, since the one save fetches `/api/admin/clubs/[id]`, a path the site already fetched, and `test/unit/route-audit.test.ts` keeps its 89 cases.')
    expect(files).toContain('  - Files beyond the step\'s list: `src/areas/clubs/editor.ts`')
    expect(files).toContain('WS09 step 6\'s PATCH, its save and its contract, which now take the places with the listing (the deviation "One press is one save (WS09 step 7).")')
    expect(files).toContain('Nothing under `workers/` changes, no migration is added, and no file the mail stream holds is touched.')
  })

  it('names the basics in the board\'s order and words, as the components draw them', () => {
    const basics = bullet(block, '- **The basics.**')
    for (const piece of [
      '"One sentence about the club"', '"How the club meets, in words"', '"Where"', '"Contact name shown on the page"',
      '"Contact name, shown once the new club pages open" until those pages are on', '"Email for messages"', '`ClubLocationPicker`',
      'no grade, no birthdate, no roster, no schedule table', '"Today\'s page shows different words here"', 'one "Save and publish"',
    ]) expect(basics, piece).toContain(piece)
    const code = codeOf(BASICS)
    const order = [
      'label="One sentence about the club"', 'label="How the club meets, in words"', '<li>{where}</li>',
      'label={pagesOn ? \'Contact name shown on the page\' : \'Contact name, shown once the new club pages open\'}', 'Email for messages, never shown',
    ]
    const at = order.map((p) => code.indexOf(p))
    for (const [i, p] of order.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const label of ['label="Place name"', 'label="Street address"', 'label="Note about the place"', 'bare={{ inputId: \'editor-point\', onChange: onPoint }}']) expect(codeOf(PLACES), label).toContain(label)
    expect(codeOf(EDITOR).match(/'Save and publish'/g)).toHaveLength(1)
  })

  it('names one press as one save, as the editor, the client and WS09 step 6\'s PATCH make it', () => {
    const save = bullet(block, '- **One press, one save.**')
    for (const piece of [
      '`saveClubListing`', '`PATCH /api/admin/clubs/[id]`', 'once, with the listing\'s fields and `places`', 'goes back unchanged', 'in one batch', 'one notice to each of the region\'s representatives',
      'today\'s pin is sent as empty too', 'every box is read only', '"Saving. The form is read only until the save is done."',
      'filled again from the club and the places the answer says were stored', 'says nothing was saved', 'never shows "Saved"',
      'a second press while a save is under way does nothing', 'held equal to it by a case', 'before anything is sent',
      'The editor no longer calls `PUT /api/admin/clubs/[id]/places`',
    ]) expect(save, piece).toContain(piece)
    const code = codeOf(EDITOR)
    expect(code.match(/await saveClubListing\(club\.id, body\)/g) ?? []).toHaveLength(1)
    expect(code).not.toMatch(/saveClubPlaces|\/places/)
    expect(code).toContain('body.places = toSend')
    expect(code).toContain('if (toSend.length === 0 && club.location) body.location = null')
    expect(code).toContain('if (!placeFilled && toSend[0] && !toSend[0].point && pointOf(club)) body.mapLocation = null')
    expect(code).toContain('setValues(startValues(answer.club, savedPlaces))')
    expect(code).toContain('setPoint(pointOf(savedPlaces[0]) ?? pointOf(answer.club))')
    expect(code).toContain('if (saving.current || viewOnly) return')
    expect(code).toContain('const SAVING_WORDS = \'Saving. The form is read only until the save is done.\'')
    expect(code).not.toMatch(/\bfetch\(/)
    const api = read(API)
    expect(api).toContain('export async function saveClubListing(id: string, body: UpdateClubRequest): Promise<{ club: ApiClubListing; places?: ApiClubPlace[] }> {')
    expect(api).not.toContain('saveClubPlaces')
    const added = JSON.parse(read(FIXTURE)) as { paths: string[]; exports: Record<string, string> }
    expect(added.paths).not.toContain('/api/admin/clubs/*/places')
    for (const name of ['ApiClubListing', 'ApiClubPlace', 'saveClubListing']) expect(added.exports[name], name).toBe('clubs')
    expect(added.exports).not.toHaveProperty('saveClubPlaces')
    // WS09 step 6's PATCH takes the places in the listing's own batch, by the PUT's own list.
    expect(codeOf(HANDLER)).toContain('changed = await saveListing(context.env.DB, { clubId, saver, existing, next, places: body.places })')
    expect(codeOf(SAVE)).toContain('if (places) statements.push(...places.statements)')
    expect(codeOf(SAVE)).toContain('  \'slug\',\n  \'places\',\n]')
    const contract = codeOf(CONTRACT)
    expect(contract).toContain('  places: clubPlacesListSchema.optional(),')
    expect(contract).toContain('  places: clubPlacesListSchema,\n})')
    expect(contract).toContain('export const updateClubResponseSchema = z.strictObject({ club: adminClubRowSchema, places: z.array(clubPlaceSchema).optional() })')
    expect(read(ONE_PRESS)).toContain('  it(\'leaves the listing, the places, the stamps, today\\\'s fields and the activity log as they were when a statement of the save fails\', async () => {')
  })

  it('says Help holds the explaining words, opens by itself once, and gives the focus back, as the files do', () => {
    const help = bullet(block, '- **Help.**')
    for (const piece of [
      'behind `Help`', 'opens by itself once', '`lca-club-editor-help`', 'it never opens by itself and opens from its button alone', 'the focus goes into it',
      'where it can be read but keeps nothing it opens by itself on each visit', 'Help opens and shuts for an observer too',
      'Escape or `Close help` shuts it', 'the focus goes back to its button', 'only labels, the heading, the buttons\' words and the pin\'s place',
    ]) expect(help, piece).toContain(piece)
    const rules = read(RULES)
    expect(rules).toContain('export const HELP_SHOWN_KEY = \'lca-club-editor-help\'')
    expect(rules).toContain('return window.localStorage.getItem(HELP_SHOWN_KEY) !== null\n  } catch {\n    return true')
    expect(codeOf(HELP)).toContain('if (e.key !== \'Escape\') return')
    expect(codeOf(EDITOR)).toContain('const [helpOpen, setHelpOpen] = useState(() => !helpShownBefore())')
  })

  it('says the email\'s promise follows clubEmailHidden, and the order the switches go on in holds it', () => {
    const promise = bullet(block, '- **The promise holds.**')
    for (const piece of [
      '"Email for messages, never shown"', '"Email for messages, shown on your club\'s page today"', '`test/unit/club-pages-switch.test.ts`',
      '"Contact name, shown once the new club pages open"', '"Your changes go live on your club\'s page at once"', 'are drawn only once those pages are on',
    ]) expect(promise, piece).toContain(piece)
    const code = codeOf(BASICS)
    expect(code).toContain('const emailHidden = FEATURES.clubEmailHidden')
    expect(code).toContain('const pagesOn = clubPagesOn()')
    expect(codeOf(EDITOR)).toContain('pagesOn={clubPagesOn()}')
    expect(codeOf(EDITOR)).toContain('if (pointTouched && point === null) body.mapLocation = null')
    expect(code).toContain('label={emailHidden ? \'Email for messages, never shown\' : \'Email for messages, shown on your club\\\'s page today\'}')
    expect(read('src/areas/clubs/switches.ts')).toContain('if (features.clubKeepers && !features.clubEmailHidden) {')
  })

  it('says the form is one column of 44px controls on a phone, in today\'s look', () => {
    const phone = bullet(block, '- **On a phone.**')
    for (const piece of ['one column in the same order at every width', 'at least 44 pixels tall', '`min-h-11`', '`ScrollPanel`', 'no gold word', 'light and dark']) expect(phone, piece).toContain(piece)
    expect(codeOf(EDITOR)).toContain('<ScrollPanel')
    for (const file of [EDITOR, BASICS, HELP]) expect(read(file), file).toContain('min-h-11')
  })

  it('names the map\'s sentences, the branch, what the merge does, and the figures while this step is the latest', () => {
    const mapPart = bullet(block, '- **The map.**')
    for (const piece of ['20 items', 'a sentence added to criterion 6', 'one to D17', 'Neither is proved in full']) expect(mapPart, piece).toContain(piece)
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-t`', '`91e0f35`', 'this step\'s diff is against `91e0f35`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of [
      'No migration and no route', '99 handler files', '31 of the 138 methods under `functions/api` contracted', '`PENDING_COUNT` 107', 'refusing a body that carries `places` 403 in words',
      '`deploy-worker.yml` starts', 'the worker imports none of the files this step changes',
    ]) {
      expect(does, piece).toContain(piece)
    }
    if (latestStep !== 7) return
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 107')
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(99)')
  })

  it('answers what main\'s code does on this database and what a revert leaves', () => {
    const main = bullet(block, '- **What `main`\'s code does on this step\'s database.**')
    for (const piece of ['adds no migration', 'writes nothing with the switch off', 'only through WS09 step 6\'s PATCH']) expect(main, piece).toContain(piece)
    const revert = bullet(block, '- **What a revert leaves.**')
    for (const piece of ['leaves the database exactly as it found it', 'today\'s form comes back', 'the rows its saves wrote stay']) expect(revert, piece).toContain(piece)
  })

  it('says what ships with every switch off, and the switch stays false', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Today\'s admin club page, unchanged')).toBe(true)
    for (const piece of ['an LCA admin, an observer, the club\'s rep and the region\'s representative', '`test/unit/club-editor-off.test.tsx`', 'never fetched', 'No switch is added']) {
      expect(ships, piece).toContain(piece)
    }
    expect(read('src/lib/features.ts')).toContain('  clubKeepers: false,')
    const page = read(PAGE)
    expect(page).toContain('        {tab === \'details\' && !keepersOn() && (')
    expect(page).toContain('        {tab === \'details\' && keepersOn() && (')
    expect(page).toContain('const ClubEditor = lazy(() => import(\'@/areas/clubs/components/ClubEditor\').then((m) => ({ default: m.ClubEditor })))')
  })

  it('names its pins with the lines as they stand on this branch, and the moved checks hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/unit/goldText.test.ts`', 'line 406 on the base and 412 now', '`test/unit/redesign-status-ws09-step6.test.ts` lines 261 and 262', 'lines 140 and 478 now',
      '`test/unit/api-split-modules.test.ts`', '`test/unit/base-components-scope.test.ts`', 'Not moved:', 'moves none of its record test\'s pins',
    ]) expect(pins, piece).toContain(piece)
    expect(read('test/unit/goldText.test.ts')).toContain('\'src/pages/AdminClubPage.tsx:412 the style colour color: clubTextColor(color) -> light\'')
    const step6 = read('test/unit/redesign-status-ws09-step6.test.ts').split('\n')
    expect(step6[260]).toContain('if (latestStep === 6) expect(callers[133])')
    expect(step6[261]).toContain('if (latestStep === 6) expect(callers[471])')
    if (latestStep !== 7) return
    const callers = read(PAGE).split('\n')
    expect(callers[139]).toContain('await adminUpdateClub(id, {')
    expect(callers[477]).toContain('await adminUpdateClub(club.id, { mapLocation: location })')
    expect(callers[411]).toContain('color: clubTextColor(color),')
  })

  it('gives the lint as unchanged and the build\'s moved figures with their reasons', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-YVdCmnd0.js` 554,147 bytes', '`index-MGRWYyBv.css` 131,136 bytes', '`features-nZCZoT6G.js` 729 bytes, unchanged',
      '554,420 bytes', '132,067 bytes', '`ClubEditor`', '`ClubLocationPicker`', '`ScrollPanel`', '198 files', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 7: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
  })

  it('counts as many cases for each new test and each changed test as the file holds', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [...NEW_TESTS, ...NEW_INTEGRATION]) {
      // WS09 step 8 adds cases to these two, so the counts this step wrote for them are read only while it is the latest.
      if (latestStep !== 7 && ['test/unit/club-editor.test.tsx', 'test/unit/club-editor-off.test.tsx'].includes(file)) continue
      expect(writtenCount(files, file), file).toBe(casesIn(file))
    }
    for (const [file, n] of CHANGED_UNIT) expect(casesIn(file), file).toBe(n)
  })

  it('gives unit counts that add up: the base\'s, the new files\', and the case the route audit gained', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([9239, 362])
    const fresh = NEW_TESTS.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    const moved = CHANGED_UNIT.reduce((a, [, n, was]) => a + n - was, 0)
    expect(num(before) + fresh + GROWN + moved).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts that add up: the base\'s and the new file\'s, since no integration test of the base changes', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2311, 123])
    expect(num(before) + NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the lint files as the base\'s with the new files lint reads added, and the build\'s file count once on each side', () => {
    const lint = /`npm run lint` 13 errors and 13 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1011)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_LINTED.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, 194 on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    expect(Number(built?.[1]) - 194).toBe(4)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 7: the map and the lists', () => {
  it('adds one sentence to criterion 6 and one to D17, each before the planned step, and to no other item', () => {
    for (const id of ['Criterion 6', 'D17']) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 7: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 7: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    }
    expect(mapItem('Criterion 6').endsWith('Planned: WS09 step 22.')).toBe(true)
    expect(mapItem('D17').endsWith('Planned: WS09 step 37.')).toBe(true)
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 7:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 6', 'D17'])
  })

  it('records the step\'s decisions, deviations, verify items and follow-ups, each tagged', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'The editor in place of today\'s form (WS09 step 7).', 'Help opens by itself once (WS09 step 7).', 'One column at every width (WS09 step 7).',
    ])
    expect(tagged(deviations).map(head)).toEqual([
      'The pin is set by hand (WS09 step 7).', 'The board\'s side notes go behind Help (WS09 step 7).', 'Saved names the address that works today (WS09 step 7).',
      'One press is one save (WS09 step 7).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'Who reaches the page (WS09 step 7).', 'The picker (WS09 step 7).', 'The boards\' editor (WS09 step 7).', 'The browser tests cannot sign in (WS09 step 7).',
      'Where the email shows today (WS09 step 7).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `91e0f35`/)
    expect(tagged(followUps).map(head)).toEqual([
      'The rest of the listing joins the editor (WS09 step 7).', 'The links\' rule in the page (WS09 step 7).', 'Items R3 and R4 stay with K (WS09 step 7).',
      'One notice for one press (WS09 step 7).',
    ])
    // This step closes its own follow-up: one press is one save and one notice.
    expect(tagged(followUps).find((l) => head(l) === 'One notice for one press (WS09 step 7).')).toContain('Closed in WS09 step 7: one press is one PATCH, one batch and one notice')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 7: plain language', () => {
  const written = [block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), mapItem('Criterion 6'), mapItem('D17'), statusLine].join('\n')

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
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of every file the step adds or changes', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT.map(([f]) => f), ...CHANGED_EACH.map(([f]) => f)]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
      // The page and the client each held long dashes before this step, which adds none: the page three lines, the client one.
      const dashed = text.split('\n').filter((l) => DASHES.test(l))
      expect(dashed.length, file).toBe(file === PAGE ? 3 : file === API ? 1 : 0)
    }
  })

  it('writes the words a person reads on the editor plainly: no dash, a time as 7:00 PM, US Chess in full', () => {
    for (const file of [EDITOR, BASICS, PLACES, HELP, RULES, PICKER]) {
      const text = read(file)
      for (const found of text.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(found[0], file).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
      expect(text, file).not.toMatch(/\bUSC\b|US Chess Federation/)
    }
  })
})
