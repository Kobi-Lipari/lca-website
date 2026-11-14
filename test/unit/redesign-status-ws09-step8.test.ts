// test/unit/redesign-status-ws09-step8.test.ts
//
// REDESIGN_STATUS.md records WS09 step 8: the rest of the editor and its
// previews. Like WS09 step 7's record test, this file reads only the WS09
// section, from its heading to the WS10 heading. Pinned here: the block's
// place, right after WS09 step 7's and before the four lists; the Status
// line's tail while this step is the latest; the block's parts in order and
// its figures, which must agree with each other and with the files they
// describe; the five things the second review found and the one the third
// found, as the files now hold them; the sentences this step added to the map; the tagged entries of
// the four lists, and WS09 step 7's two follow-ups this step closes; and the
// plain-language rules over the block and the files the step adds or
// changes. What a later step will change in the tree (the pending count, the
// handler count, the cases of a test a later step grows) is read only while
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[A-Z]+_(?:CASES|LINE)\\b`)
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
const TAG = '(WS09 step 8).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const STEP_7 = '### WS09 step 7: the editor, basics first'
const STEP = '### WS09 step 8: the rest of the editor and its previews'
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
const EDITOR = 'src/areas/clubs/components/ClubEditor.tsx'
const BASICS = 'src/areas/clubs/components/EditorBasics.tsx'
const PLACES = 'src/areas/clubs/components/EditorPlaces.tsx'
const HELP = 'src/areas/clubs/components/EditorHelp.tsx'
const RULES = 'src/areas/clubs/editor.ts'
const PICKER = 'src/areas/clubs/components/ClubLocationPicker.tsx'
const META = 'domain/clubs/pageMeta.ts'
const PREVIEWS = 'src/areas/clubs/previews.ts'
const SEARCH = 'src/areas/clubs/components/SearchPreview.tsx'
const SHARE = 'src/areas/clubs/components/SharePreview.tsx'
const CARD = 'src/areas/clubs/components/CardPreview.tsx'
const CHECKLIST = 'src/areas/clubs/components/PageChecklist.tsx'
/** The files this step adds, and those of them that are unit tests. */
const NEW_FILES = [
  META, PREVIEWS, SEARCH, SHARE, CARD, CHECKLIST,
  'test/unit/page-meta.test.ts', 'test/unit/page-meta-edges.test.ts', 'test/unit/club-previews.test.tsx', 'test/unit/club-previews-edges.test.tsx',
  'test/unit/redesign-status-ws09-step8.test.ts',
]
const NEW_TESTS = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
/** The new files lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.tsx?$/.test(f))
/** The files this step changes that are not tests. */
const CHANGED = [EDITOR, BASICS, PLACES, HELP, RULES, PICKER, PAGE, 'test/unit/helpers/clubSaveServer.ts']
/** The unit tests this step changes, each with its count and the count before. */
const CHANGED_UNIT: ReadonlyArray<readonly [string, number, number]> = [
  ['test/unit/club-editor.test.tsx', 43, 27],
  ['test/unit/club-editor-off.test.tsx', 8, 7],
  ['test/unit/redesign-status-ws09-step7.test.ts', 25, 25],
  // Its helper waits for the first draw's effects and gives the editor's file longer to load, after the second review; no case changes.
  ['test/unit/club-editor-edges.test.tsx', 31, 31],
]
/** The unit tests that grew with no change of its own, each with its count and the count before: one domain file and one written class form more. */
const GROWN_EACH: ReadonlyArray<readonly [string, number, number]> = [
  ['test/unit/domain-boundaries.test.ts', 52, 51],
  ['test/unit/semantic-map-cascade.test.ts', 42, 40],
]
const GROWN = GROWN_EACH.reduce((a, [, n, was]) => a + n - was, 0)
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
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('REDESIGN_STATUS.md, WS09 step 8: the block and the Status line', () => {
  it('sits once, right after WS09 step 7\'s block and before the four lists', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${STEP}\n`)).toHaveLength(2)
    const at = [STEP_7, STEP, LISTS[0]].map((h) => ws09.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
    expect(headings[headings.indexOf(STEP_7) + 1]).toBe(STEP)
    if (latestStep === 8) expect(headings.slice(headings.indexOf(STEP) + 1).find((h) => !h.startsWith('### WS09 checkpoint T: '))).toBe(LISTS[0])
  })

  it('gives the Status line this step\'s tail while this step is the latest', () => {
    expect(latestStep).toBeGreaterThanOrEqual(8)
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latestStep === 8) expect(tail).toBe('checkpoint S waits for its pull request; checkpoint T has begun on its own branch; steps 1 to 8 and K\'s answers to checkpoint S\'s review are built.')
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens by saying what the step builds, behind which switch, and what it keeps of WS09 step 7', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'the third step of checkpoint T', 'its second page step', '`clubKeepers` is on, which stays false', '`Club-G-2`\'s frame B', 'WS09 step 36',
      'one press of Save and publish is one call and one notice', 'This step turns nothing on', 'today\'s admin club page, unchanged',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **What the step builds.**', '- **The fields.**', '- **The previews.**', '- **No weekly claims.**', '- **One press, one save.**', '- **Help.**',
      '- **On a phone.**', '- **The map.**', '- **The branch.**', '- **What the merge does.**', '- **What `main`\'s code does on this step\'s database.**',
      '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **After the second review.**',
      '- **After the third review.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 8: the parts', () => {
  it('names every file it adds and changes, each test with its count, and the two sub-lines', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT.map(([f]) => f), 'REDESIGN_STATUS.md']) expect(files, name).toContain(`\`${name}\``)
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const [name, after, before] of CHANGED_UNIT) {
      expect(files, name).toContain(after === before ? `\`${name}\` (${after}, as before: ` : `\`${name}\` (${after}, ${before} before: `)
    }
    const grown = bullet(files, '  - Grown with no change:')
    for (const [name, after, before] of GROWN_EACH) expect(grown, name).toContain(`\`${name}\` (${after}, ${before} before: `)
    expect(grown).toContain('the editor makes no new call')
    expect(grown).toContain('`test/unit/route-audit.test.ts` keeps its 89 cases.')
    expect(files).toContain('  - Files beyond the step\'s list: `src/areas/clubs/previews.ts`')
    expect(files).toContain('Nothing under `functions/`, `domain/contracts/` or `workers/` changes, no migration, endpoint or call is added, and no file the mail stream holds is touched.')
  })

  it('names the fields in the site\'s order, as the components draw them, each saved through the one call', () => {
    const fields = bullet(block, '- **The fields.**')
    for (const piece of [
      '"Name and address"', '"N of 2,000 characters"', '"Add another place"', '"Remove place 2"', '"Cost and who is welcome"', '"The club plays on weekends"',
      '"Scholastic friendly"', '"Links"', '"Logo and club colour"', '`saveClubListing`', 'held equal to `isWebAddress` by a case', '"Kept by LCA admins"',
      'sent only when they differ from what was stored', 'no tick but the brief\'s two',
    ]) expect(fields, piece).toContain(piece)
    const code = codeOf(BASICS)
    const order = ['<legend className={PART_NAME}>Name and address</legend>', 'Cost and who is welcome</legend>', 'Links</legend>', 'Logo and club colour</legend>']
    const at = order.map((p) => code.indexOf(p))
    for (const [i, p] of order.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const label of ['\'The club plays on weekends\'', '\'Scholastic friendly\'', 'label="Facebook page"', 'label="Website"', 'label="Another link"', 'label="City"', 'label="Cost"', 'label="Who is welcome"']) {
      expect(code, label).toContain(label)
    }
    expect(code).toContain('<dd>Kept by LCA admins</dd>')
    expect(codeOf(PLACES)).toContain('bare={{ inputId: \'editor-point-2\', onChange: onPoint2, place: \'place 2\' }}')
    const editor = codeOf(EDITOR)
    expect(editor.match(/await saveClubListing\(club\.id, body\)/g) ?? []).toHaveLength(1)
    expect(editor).toContain('if (values.city !== start.city) body.city = values.city')
    expect(editor).toContain('for (const key of TICKS) if (values[key] !== start[key]) body[key] = values[key]')
    expect(editor).not.toMatch(/imageUrl:|body\.imageUrl/)
    const rules = read(RULES)
    expect(rules).toContain('export const WEB_ADDRESS_FORM = /^https?:\\/\\/[^\\s\\\\/\\p{Cc}][^\\s\\\\\\p{Cc}]*$/iu')
    expect(rules).toContain('export const LINK_WORDS = \'A link must be a web address that starts with http:// or https://.\'')
  })

  it('names the previews, made by the one rule the server page will use, and no weekly claim on the card', () => {
    const previews = bullet(block, '- **The previews.**')
    for (const piece of [
      '"How your page shows up in a search"', '"When someone shares your page"', '"Your card in LCA\'s club directory"', '"Your page\'s checklist"',
      '`clubPageTitle`', '`clubPageDescription`', '`domain/clubs/pageMeta.ts`', 'at most 155 characters', 'they make no request', '"Done" or "Not yet"',
      '`test/unit/page-meta.test.ts`', '`test/unit/club-previews.test.tsx`',
    ]) expect(previews, piece).toContain(piece)
    const weekly = bullet(block, '- **No weekly claims.**')
    for (const piece of ['no computed date, no "Checked" month, no claim about a week', '"Schedule not listed · Know when they meet? Suggest an update"']) expect(weekly, piece).toContain(piece)
    expect(read(META)).toContain('export const PAGE_DESCRIPTION_MAX = 155')
    expect(read(META)).not.toMatch(/^\s*import\b/m)
    expect(read(CARD)).toContain('Schedule not listed · Know when they meet? Suggest an update')
    for (const file of [SEARCH, SHARE]) expect(read(file), file).toContain('from \'@domain/clubs/pageMeta\'')
  })

  it('says one press is still one save, the logo is today\'s upload, and Help holds the new words', () => {
    const save = bullet(block, '- **One press, one save.**')
    for (const piece of [
      'calls `saveClubListing` once', 'one notice', 'every box is read only', 'a press of Save and publish while it uploads is held', 'saved once the upload ends',
      'never writes the old logo back', 'one press is enough',
    ]) {
      expect(save, piece).toContain(piece)
    }
    expect(codeOf(EDITOR)).toContain('if (uploadingNow.current) {')
    expect(codeOf(EDITOR)).toContain('void publish(true)')
    expect(codeOf(EDITOR)).toContain('const { imageUrl } = await adminUploadClubLogo(club.id, blob)')
    const help = bullet(block, '- **Help.**')
    for (const piece of ['behind Help', 'a search result shows the start of About and then how the club meets', 'only while', '"Google shows about the first 60 characters"']) {
      expect(help, piece).toContain(piece)
    }
    const sentences = read(HELP)
    expect(sentences).toContain('A search result shows the start of About and then How the club meets, in words, about 155 characters in all. Keep that box short so both fit.')
    expect(sentences).not.toContain('then when the club meets')
    expect(read(BASICS)).toContain('field="howWeMeetText" label="How the club meets, in words"')
    expect(read(META)).toContain('only while the statement leaves ABOUT_ROOM_MIN (60) or more')
    expect(sentences).not.toContain('the first 155 characters show in search results')
    expect(sentences).toContain('Google shows about the first 60 characters of a title')
    expect(sentences).not.toContain('come from LCA\\\'s club list')
  })

  it('says the form is one column and the previews fold under one Preview button on a phone', () => {
    const phone = bullet(block, '- **On a phone.**')
    for (const piece of ['one column in the site\'s order', 'at least 44 pixels tall', 'one "Preview" button', '`aria-expanded`', 'sticky']) expect(phone, piece).toContain(piece)
    const code = codeOf(EDITOR)
    expect(code).toContain('aria-expanded={previewOpen}')
    expect(code).toContain('lg:sticky')
    expect(code).toContain('!previewOpen && \'hidden lg:block\'')
  })

  it('names the map\'s sentences, the branch, what the merge does, and the figures while this step is the latest', () => {
    const mapPart = bullet(block, '- **The map.**')
    for (const piece of ['20 items', 'a sentence added to criterion 1', 'one to criterion 7', 'Neither is proved in full']) expect(mapPart, piece).toContain(piece)
    const branch = bullet(block, '- **The branch.**')
    for (const piece of ['`redesign/ws09-clubs-t`', '`f4d83cd`', 'this step\'s diff is against `f4d83cd`']) expect(branch, piece).toContain(piece)
    const does = bullet(block, '- **What the merge does.**')
    for (const piece of [
      'No migration and no route', '99 handler files', '31 of the 138 methods under `functions/api` contracted', '`PENDING_COUNT` 107', '`deploy-worker.yml` starts',
      'the worker imports none of the files this step adds or changes',
    ]) expect(does, piece).toContain(piece)
    if (latestStep !== 8) return
    expect(read('test/unit/contracts-pending.ts')).toContain('export const PENDING_COUNT = 107')
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(99)')
  })

  it('answers what main\'s code does on this database and what a revert leaves', () => {
    const main = bullet(block, '- **What `main`\'s code does on this step\'s database.**')
    for (const piece of ['adds no migration', 'writes nothing with the switch off', 'only through WS09 step 6\'s PATCH and today\'s logo upload']) expect(main, piece).toContain(piece)
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
    expect(read(PAGE)).toContain('        {tab === \'details\' && !keepersOn() && (')
  })

  it('names its pins, and the moved checks hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of ['`test/unit/club-editor.test.tsx`, six of WS09 step 7\'s cases', '`test/unit/redesign-status-ws09-step7.test.ts` line 353', 'Not moved:', 'keeps line 412']) {
      expect(pins, piece).toContain(piece)
    }
    expect(read('test/unit/redesign-status-ws09-step7.test.ts')).toContain('if (latestStep !== 7 && [\'test/unit/club-editor.test.tsx\', \'test/unit/club-editor-off.test.tsx\'].includes(file)) continue')
    expect(read('test/unit/goldText.test.ts')).toContain('\'src/pages/AdminClubPage.tsx:412 the style colour color: clubTextColor(color) -> light\'')
    expect(read(PAGE).split('\n')[411]).toContain('color: clubTextColor(color),')
  })

  it('closes the five things the second review found, each as the files now hold it, the description\'s rule among the judgement calls', () => {
    const closed = bullet(block, '- **After the second review.**')
    expect(closed.split('\n').filter((l) => /^\s+- /.test(l))).toHaveLength(5)
    for (const piece of [
      'Help opening by itself', 'a longer wait', 'two PATCHes', 'aria-disabled', 'shut', 'the meeting statement', '`ABOUT_ROOM_MIN`',
      'are now marked shut while a save runs', 'not disabled', '`vi.setConfig({ testTimeout: 15000 })`', 'asks for that box to be kept short',
    ]) expect(closed, piece).toContain(piece)
    const calls = bullet(block, '- **Judgement calls.**')
    for (const piece of ['Decided at the second review', 'About is cut and the statement kept whole', 'at least 60 characters']) expect(calls, piece).toContain(piece)
    const editor = codeOf(EDITOR)
    expect(editor).toContain('aria-disabled={busy || undefined}')
    expect(editor).toMatch(/async function publish\(afterLogo: boolean\) \{\n\s*if \(saving\.current\) return\n/)
    expect(editor).toContain('const afterLogo = heldNow.current')
    const basics = codeOf(BASICS)
    expect(basics).not.toMatch(/readOnly=\{waiting \|\| undefined\}|aria-readonly/)
    // The ticks and the swatch are marked shut, never disabled, so they keep the focus; from WS09 step 9 the region's select is
    // marked shut the same way, so it is the third such mark and nothing in the basics is disabled while a save runs.
    expect(basics.match(/aria-disabled=\{waiting \|\| undefined\}/g)?.length).toBe(3)
    expect(basics.match(/ disabled=\{waiting\}/g)).toBeNull()
    expect(basics).toContain('id="editor-region" className={SELECT} value={values.region} aria-disabled={waiting || undefined}')
    expect(basics).toContain('onClick={(e) => { if (waiting) e.preventDefault() }}')
    expect(basics).toMatch(/onClickCapture=\{\(e\) => \{\n\s*if \(!waiting\) return\n\s*e\.preventDefault\(\)\n\s*e\.stopPropagation\(\)\n/)
    expect(read(META)).toContain('export const ABOUT_ROOM_MIN = 60')
    for (const file of ['test/unit/club-editor.test.tsx', 'test/unit/club-editor-edges.test.tsx']) {
      const text = read(file)
      expect(text, file).toContain('const save = await screen.findByRole(\'button\', { name: \'Save and publish\' }, { timeout: 5000 })')
      expect(text, file).toMatch(/\{ timeout: 5000 \}\)\n(?:\s*\/\/.*\n)*\s*await act\(async \(\) => \{\}\)\n/)
    }
    // Each file that loads the editor gives a case 15 seconds, more than its 5 second wait for the first draw.
    for (const file of ['test/unit/club-editor.test.tsx', 'test/unit/club-editor-edges.test.tsx', 'test/unit/club-editor-off.test.tsx']) {
      const text = read(file)
      expect(text.match(/^vi\.setConfig\(\{ testTimeout: 15000 \}\)$/gm), file).toHaveLength(1)
      expect(text, file).toContain('{ timeout: 5000 })')
    }
  })

  it('closes the one thing the third review found: the logo\'s box is marked shut, never disabled, so it keeps the focus', () => {
    const closed = bullet(block, '- **After the third review.**')
    expect(closed.split('\n').filter((l) => /^\s+- /.test(l))).toHaveLength(1)
    for (const piece of ['dropped the focus', '`aria-disabled`', 'opens no picker', 'still disabled by the view only fieldset', '`test/unit/club-editor.test.tsx`']) {
      expect(closed, piece).toContain(piece)
    }
    const basics = codeOf(BASICS)
    expect(basics).toContain('aria-disabled={logoShut || undefined}')
    expect(basics).toContain('onClick={(e) => { if (logoShut) e.preventDefault() }}')
    expect(basics).not.toContain('disabled={logoShut}')
    expect(basics).toContain('aria-disabled:opacity-50')
    expect(codeOf(EDITOR)).toContain('if (saving.current || uploadingNow.current || viewOnly) return')
    expect(read('test/unit/club-editor.test.tsx')).toContain('it(\'keeps the focus on the logo\\\'s box while its upload runs, and opens no second picker until it ends\'')
  })

  it('gives the lint as unchanged and the build\'s figures with their reasons', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local production build', '`VITE_`', '`index-DgyBtaCx.js` 554,420 bytes', '`index-D0zefOY4.css` 132,067 bytes', '`features-nZCZoT6G.js` 729 bytes',
      '`ClubEditor`', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
    ]) expect(build, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 step 8: the Checks line', () => {
  it('gives each figure once, and no browser run', () => {
    expect(checksLine).not.toBe('')
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    expect(checksLine).toContain('995 tests, 659 that run and 336 that skip')
  })

  it('counts as many cases for each new test and each changed test as the file holds, while this step is the latest', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of NEW_TESTS) expect(writtenCount(files, file), file).toBe(casesIn(file))
    if (latestStep !== 8) return
    for (const [file, n] of CHANGED_UNIT) expect(casesIn(file), file).toBe(n)
  })

  it('gives unit counts that add up: the base\'s, the new files\' and the cases the changed files gained', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([9329, 366])
    const fresh = NEW_TESTS.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    const moved = CHANGED_UNIT.reduce((a, [, n, was]) => a + n - was, 0)
    expect(num(before) + fresh + GROWN + moved).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_TESTS.length)
  })

  it('gives integration counts as the base\'s, since no integration test changes', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([2320, 124])
    expect([num(after), Number(afterFiles)]).toEqual([2320, 124])
  })

  it('gives the lint files as the base\'s with the new files lint reads added, and the build\'s file count once on each side', () => {
    const lint = /`npm run lint` 13 errors and 13 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1022)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_LINTED.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, 198 on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
  })
})

describe('REDESIGN_STATUS.md, WS09 step 8: the map and the lists', () => {
  it('adds one sentence to criterion 1 and one to criterion 7, each before the planned step, and to no other item', () => {
    for (const id of ['Criterion 1', 'Criterion 7']) {
      const item = mapItem(id)
      expect(item.split('Built in WS09 step 8: '), id).toHaveLength(2)
      expect(item.indexOf('Built in WS09 step 8: '), id).toBeLessThan(item.search(/Planned: WS09 step \d+\.$/))
    }
    expect(mapItem('Criterion 1').endsWith('Planned: WS09 step 33.')).toBe(true)
    expect(mapItem('Criterion 7').endsWith('Planned: WS09 step 26.')).toBe(true)
    expect(entries(map).filter((l) => l.includes('Built in WS09 step 8:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['Criterion 1', 'Criterion 7'])
  })

  it('records the step\'s decisions, deviations, verify items and follow-ups, each tagged, and closes WS09 step 7\'s two', () => {
    expect(tagged(decisions).map(head)).toEqual([
      'The rest of the editor in the site\'s order (WS09 step 8).', 'Words for what an LCA admin keeps (WS09 step 8).', 'The preview column (WS09 step 8).',
    ])
    expect(tagged(deviations).map(head)).toEqual([
      'About is one box (WS09 step 8).', 'No typed colour code (WS09 step 8).', 'A second place\'s pin is set by hand (WS09 step 8).',
      'The board\'s side notes go behind Help, again (WS09 step 8).', 'The logo saves on its own (WS09 step 8).',
    ])
    expect(tagged(verify).map(head)).toEqual(['The two ticks (WS09 step 8).', 'Work-H-2\'s editor (WS09 step 8).', 'A club\'s colour as words (WS09 step 8).'])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed on `f4d83cd`/)
    expect(tagged(followUps).map(head)).toEqual([
      'Not built in the editor (WS09 step 8).', 'The page preview waits for its page (WS09 step 8).', 'Items R3 and R4 stay with K (WS09 step 8).',
    ])
    const closed = entries(followUps)
    for (const name of ['The rest of the listing joins the editor (WS09 step 7).', 'The links\' rule in the page (WS09 step 7).']) {
      expect(closed.find((l) => head(l) === name), name).toContain('Closed in WS09 step 8: ')
    }
    expect(tagged(followUps)[0]).toContain('Getting in')
    expect(tagged(followUps)[0]).toContain('Change history')
    expect(tagged(followUps)[0]).toContain('Set the crop')
  })
})

describe('REDESIGN_STATUS.md, WS09 step 8: plain language', () => {
  const closings = entries(followUps).filter((l) => l.includes('Closed in WS09 step 8: ')).map((l) => l.slice(l.indexOf('Closed in WS09 step 8: ')))
  const written = [block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps), ...closings, mapItem('Criterion 1'), mapItem('Criterion 7'), statusLine].join('\n')

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
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT.map(([f]) => f)]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
      // The page held three long dashes before WS09 step 7, which adds none, and this step adds none either.
      expect(text.split('\n').filter((l) => DASHES.test(l)).length, file).toBe(file === PAGE ? 3 : 0)
    }
  })

  it('writes the words a person reads on the editor and the previews plainly: a time as 7:00 PM, US Chess in full', () => {
    for (const file of [EDITOR, BASICS, PLACES, HELP, RULES, PICKER, SEARCH, SHARE, CARD, CHECKLIST, PREVIEWS, META]) {
      const text = read(file)
      for (const found of text.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(found[0], file).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
      expect(text, file).not.toMatch(/\bUSC\b|US Chess Federation/)
    }
  })
})
