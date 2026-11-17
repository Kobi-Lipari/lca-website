// test/unit/redesign-status-ws09-t-review.test.ts
//
// REDESIGN_STATUS.md records checkpoint T's merge-safety review of the whole
// and its one round of fixes in a block of its own, "WS09 checkpoint T: the
// review of the whole and its fixes", straight after checkpoint T's section
// and before the decisions. Like the step record tests, this file reads only
// the WS09 section, from its heading to the WS10 heading. Pinned here: the
// block's place; its parts in order; its ten findings, nine fixed and one
// left for K with the options K chooses from; the sentences it
// mended elsewhere in the section, each with one marked sentence; what the
// fixes are in the files they name; the pins it moved; the figures of its
// Checks line, which must add up; and the plain-language rules. Its part on
// the leftovers, the review's fourteen nits closed or recorded after the fix
// round, is held too: each nit's line, the three sentences it marks, its two
// follow-ups, and what each closing is in the code. So is its last round,
// after pictures of the real pages: P1 to P9, the five things the check of
// the leftovers found (C1 to C5) and N7, each line, the two sentences it
// marks, K's second choice, and what each closing is in the code and the
// tests. So is its last small round, Q1 to Q3: the editor's box on a phone,
// "your" only for the club's own rep, and the link's refusal saying what to
// do, each line, the one sentence it marks and its closings; and its closing
// mend, M1 to M4: Help on a phone by its top, the controls clear of the header
// below lg, the card's name in quotation marks and the box after a save left
// as it was, each line, its closings and its follow-up. What a later step moves
// (the whole list of headings, the live counts of the changed tests) is read
// only while WS09 step 9 is the latest step.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { updateClubRequestSchema } from '../../domain/contracts/clubs'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
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
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const BLOCK = '### WS09 checkpoint T: the review of the whole and its fixes'
/** The block of checkpoint U that builds K's choice for T10. */
const NOTICE_BLOCK = '### WS09 checkpoint U: the save notice at most once an hour'
const CHECKPOINT = '### Checkpoint T: WS09 steps 6 to 9, the keepers\' editor and its ways in'
const CHECKPOINT_HEADING = CHECKPOINT
const STEP9 = '### WS09 step 9: Your club\'s page and the ways in'
const block = part(BLOCK)
const followUps = ws09.slice(ws09.indexOf('\n### WS09 follow-ups\n') + 1)
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const latestStep = Math.max(0, ...[...ws09.matchAll(/^### WS09 step (\d+): /gm)].map((m) => Number(m[1])))

/** The mark of the sentences this block added to earlier lines. */
const MARK = 'Changed in checkpoint T\'s review: '
/** The three earlier lines this block marks, each found by its start, with a piece of the words kept and a piece of the sentence added. */
const MENDED: ReadonlyArray<readonly [string, string, string, string]> = [
  ['### WS09 step 7: the editor, basics first', '  - While a save runs the boxes wait, read only,', 'so the boxes keep the focus. ', 'moves to Add another place (T5)'],
  ['### WS09 decisions', '- **The child profile delete clears the club references (WS09 step 6).** ', '`test/integration/club-save.test.ts` holds the clearing. ', '`test/unit/club-tables-lagging-run.test.ts` holds the delete and its one log line'],
  ['### WS09 follow-ups', '- **A focus held in a pin\'s picker when a save ends (WS09 step 9).** ', 'the boxes of words and the second place\'s buttons keep it. ', 'hands the focus to the pin\'s box (T2)'],
]
/** The three lines the leftovers mark (N6), each found by its start, with the words that ended it before and a piece of the sentence added. */
const LEFTOVER_MENDED: ReadonlyArray<readonly [string, string, string, string]> = [
  ['### WS09 step 6: saving a listing', '- **What ships with every switch off.** Today\'s PATCH and GET for today\'s bodies', 'for an LCA admin, an observer and the club\'s rep the answer is the base\'s, as before. ', 'whatever checkpoint S answered it: a 500, a rep\'s 403, a 200 that wrote nothing'],
  ['### WS09 step 9: Your club\'s page and the ways in', '- **What ships with every switch off.** Today\'s `/manage/club`, Workspace', '`regionEvents` and the three constants stay off. ', '`adminGetClub` in `src/areas/clubs/api.ts` sends its value through `encodeURIComponent`'],
  [CHECKPOINT_HEADING, '- **What ships with every switch off.** With `clubKeepers`, `regionEvents`', '`test/unit/your-club-route.test.tsx`. ', 'a save\'s body of the wrong type is a 400 whatever checkpoint S answered it, and `adminGetClub` encodes its value'],
]
const lineOf = (heading: string, start: string) => (heading === '### WS09 follow-ups' ? followUps : part(heading)).split('\n').find((l) => l.startsWith(start)) ?? ''
/** The two follow-ups the leftovers log, N7 and N11. */
/** The two lines the last round marks (P1 and P7, and P9), each found by its start, with the words that end it before and a piece of the sentence added. */
const ROUND_MENDED: ReadonlyArray<readonly [string, string, string, string]> = [
  ['### WS09 step 7: the editor, basics first', '- **The basics.** With the switch on the Details tab draws the editor', 'shows one line, "Today\'s page shows different words here", with both texts. ', 'a club\'s first save, even one that changes only the contact name, puts the listing\'s words'],
  ['### WS09 step 9: Your club\'s page and the ways in', '- **The page.** Under the title "Your club\'s page"', 'with no gold word on a light ground. ', 'is no keeper\'s save, so the page says "Not saved here yet." for it'],
]
/** The one line the last small round marks (Q1), found by its start, with the words that end it before and a piece of the sentence added. */
const FINAL_MENDED: ReadonlyArray<readonly [string, string, string, string]> = [
  ['### WS09 step 7: the editor, basics first', '- **On a phone.** No board draws the editor on a phone', 'The checkpoint\'s pictures show it to K. ', 'the form runs the page\'s full length with no box of its own to scroll'],
]
const LEFTOVER_FOLLOW_UPS = ['- **The admin club page at a page address (WS09 step 9).** Logged in checkpoint T\'s review, N7. ', '- **The club page\'s head escapes its words (WS09 step 9).** Logged in checkpoint T\'s review, N11. ']
/** The follow-up the closing mend logs, M2's leftover from lg up. */
const MEND_FOLLOW_UP = '- **Controls under today\'s header from `lg` up (WS09 step 9).** Logged in checkpoint T\'s review, M2. '
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
const added = (line: string) => (line.includes(MARK) ? line.slice(line.indexOf(MARK)) : '')

/** The files this block adds: two tests of the fixes, and this one. */
const NEW_UNIT = [
  'test/unit/club-editor-review.test.tsx', 'test/unit/redesign-status-ws09-t-review.test.ts', 'test/unit/club-review-leftovers.test.tsx', 'test/unit/club-editor-pictures.test.tsx',
  'test/unit/club-editor-phone-words.test.tsx',
]
const NEW_INTEGRATION = ['test/integration/club-save-review.test.ts', 'test/integration/club-save-leftovers.test.ts', 'test/integration/club-save-pictures.test.ts']
/** The tests this block changes, each with its count and the count before. */
const CHANGED_UNIT: ReadonlyArray<readonly [string, number, number]> = [
  ['test/unit/club-tables-lagging-run.test.ts', 7, 6],
  ['test/unit/club-editor.test.tsx', 44, 44],
  ['test/unit/club-editor-edges.test.tsx', 31, 31],
  ['test/unit/club-editor-shut-while-saving.test.tsx', 7, 7],
  ['test/unit/redesign-status-ws09-step4.test.ts', 23, 23],
  ['test/unit/redesign-status-ws09-step9.test.ts', 26, 26],
  ['test/unit/club-previews.test.tsx', 15, 15],
  ['test/unit/club-previews-edges.test.tsx', 10, 10],
  ['test/unit/redesign-status-ws09-step8.test.ts', 26, 26],
]
/** The files this block changes that are not tests. */
const CHANGED = [
  'functions/api/admin/clubs/[id].ts', 'functions/utils/clubs/save.ts', 'functions/utils/clubs/migrationLag.ts', 'domain/contracts/clubs.ts',
  'src/areas/clubs/components/ClubLocationPicker.tsx', 'src/areas/clubs/components/EditorPlaces.tsx', 'src/areas/clubs/components/ClubEditor.tsx',
  'src/areas/clubs/components/EditorHelp.tsx',
  'functions/utils/clubs/emails.ts', 'functions/api/admin/clubs/[id]/places.ts', 'src/areas/clubs/editor.ts', 'domain/clubs/pageMeta.ts',
  'src/areas/clubs/components/EditorBasics.tsx', 'src/areas/clubs/previews.ts', 'src/pages/YourClubPage.tsx',
  'src/components/ScrollPanel.tsx', 'src/areas/clubs/components/SearchPreview.tsx', 'src/areas/clubs/components/SharePreview.tsx',
  'src/areas/clubs/components/CardPreview.tsx', 'src/areas/clubs/components/PageChecklist.tsx',
]
/** The files the mail stream holds, which this block does not touch. */
const MAIL_FILES = ['src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx']
/** A file's cases as vitest counts them, for a file whose every case is a plain `it(` line. */
function casesIn(file: string): number {
  const text = read(file)
  expect((text.match(/^\s*(?:it|test|describe)\.each\(/gm) ?? []).length, `${file}: no each`).toBe(0)
  return (text.match(/^\s*it\(/gm) ?? []).length
}
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+)[:,] `).exec(files)?.[1])

describe('REDESIGN_STATUS.md, WS09 checkpoint T: the review of the whole and its fixes', () => {
  it('sits once, right after checkpoint T\'s section and before the decisions', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
    expect(headings[headings.indexOf(CHECKPOINT) + 1]).toBe(BLOCK)
    // A later step writes its block before checkpoint T's section's successor, so the next heading is read only while WS09 step 9 is the latest, passing over the merge of checkpoint S's Clubs page fix.
    if (latestStep === 9) expect(headings.slice(headings.indexOf(BLOCK) + 1).find((h) => h !== '### WS09 checkpoint T: the Clubs page fix brought in')).toBe('### WS09 decisions')
    expect(headings.indexOf(STEP9)).toBeLessThan(headings.indexOf(BLOCK))
  })

  it('has every part, in order, the Checks line last, and opens with the head it reviewed and what it leaves', () => {
    const parts = [
      '- **What this is.**', '- **Findings and fixes.**', '- **Files.**', '- **The branch.**', '- **What the fixes do.**', '- **What `main`\'s code does on this database.**',
      '- **What a revert leaves.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const bullets = block.split('\n').filter((l) => l.startsWith('- '))
    expect(bullets[bullets.length - 1].startsWith('- Checks:')).toBe(true)
    const opening = block.split('\n')[2] ?? ''
    for (const piece of ['`8ace6a1`', 'none of the plan\'s 38 steps', 'Nine findings are fixed', 'one is left for K', 'and nothing more']) expect(opening, piece).toContain(piece)
    expect(bullet(block, '- **What ships with every switch off.**')).toContain('What WS09 step 9 ships, nothing more')
  })

  it('gives the ten findings in order, nine fixed and T10 left for K with the options K chooses from', () => {
    const findings = bullet(block, '- **Findings and fixes.**').split('\n').filter((l) => /^ {2}- T\d+\. /.test(l))
    expect(findings.map((l) => /^ {2}- (T\d+)\. /.exec(l)![1])).toEqual(['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10'])
    for (const line of findings.slice(0, 9)) expect(line, line.slice(0, 12)).toContain(' Fixed: ')
    expect(findings[9]).toContain(' Not fixed: ')
    for (const [i, piece] of [
      [0, '`CHILD_CLUB_REFERENCES_UNCLEARED_LOG`'], [1, 'the focus moves to the box'], [2, '"Paste coordinates or a Google Maps link in the box first."'],
      [3, 'not the roles `status` and `alert`'], [4, '`data-place="2"`'], [5, 'say these show once the new club pages open'], [6, 'decision 3, answer 2 (a)'],
      [7, '`toldUpdatedAt`'], [8, 'only when the body carries it'],
    ] as const) expect(findings[i], piece).toContain(piece)
    for (const piece of ['(1) ', '(2) ', '(3) ', '(4) ', 'The first is the one to build first', 'the choice is K\'s before `clubKeepers` goes on']) expect(findings[9], piece).toContain(piece)
    // The tree is as it was for T10: one notice to each representative for each save that changes a field, until checkpoint U builds K's choice.
    if (!ws09.includes(`\n${NOTICE_BLOCK}\n`)) expect(read('functions/utils/clubs/emails.ts')).not.toMatch(/club_edit|within the hour|one notice an hour/)
  })

  it('mends three earlier lines with one marked sentence each, keeps their words, and drops "which waits for K" from WS09 step 9\'s block', () => {
    for (const [heading, start, kept, piece] of MENDED) {
      const line = lineOf(heading, start)
      expect(line.split(MARK), start).toHaveLength(2)
      expect(line.slice(0, line.indexOf(MARK)).endsWith(kept), start).toBe(true)
      expect(added(line), start).toContain(piece)
    }
    expect(ws09.split('\n').filter((l) => l.includes(MARK))).toHaveLength(MENDED.length + LEFTOVER_MENDED.length + ROUND_MENDED.length + FINAL_MENDED.length)
    const step9 = part(STEP9)
    expect(step9).not.toContain('which waits for K')
    expect(step9.split('which stays as K\'s decision 3, answer 2 (a), of Saturday, November 14, 2026, left it')).toHaveLength(3)
  })

  it('names the files it adds and changes, each test with its count, and the fixes stand in them', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [...NEW_UNIT, ...NEW_INTEGRATION]) expect(writtenCount(files, file), file).toBe(casesIn(file))
    for (const [file, after, before] of CHANGED_UNIT) {
      expect(files, file).toContain(after === before ? `\`${file}\` (${after}, as before: ` : `\`${file}\` (${after}, ${before} before: `)
      // A later step may add cases to these files, so their live counts are read only while WS09 step 9 is the latest.
      if (latestStep === 9) expect(casesIn(file), file).toBe(after)
    }
    for (const file of CHANGED) expect(files, file).toContain(`\`${file}\``)
    for (const file of MAIL_FILES) expect(files, file).not.toContain(`\`${file}\` (`)
    const handler = read('functions/api/admin/clubs/[id].ts')
    expect(handler).toContain('export const SAVED_SINCE = \'This club\\\'s page was saved after you opened it. Copy what you want to keep, then reload the page to see the latest version\'')
    expect(handler).toContain('if (keepersOn && body.toldUpdatedAt !== undefined && (body.toldUpdatedAt ?? null) !== (existing.told_updated_at ?? null)) {\n    return errorResponse(SAVED_SINCE, 409)')
    expect(handler).toContain('if (fields[key] === undefined || (adminOnly && !admin)) continue')
    expect(handler).not.toContain('const next: Record<string, unknown> = { ...todays }')
    expect(read('functions/utils/clubs/save.ts')).toContain('function placesMirror(places: PlaceInput[]): Record<string, unknown> {\n  const mirror: Record<string, unknown> = {}')
    expect(updateClubRequestSchema.shape.toldUpdatedAt.safeParse(null).success).toBe(true)
    expect(read('src/areas/clubs/components/ClubEditor.tsx')).toContain('toldUpdatedAt: club.told_updated_at ?? null,')
    const picker = read('src/areas/clubs/components/ClubLocationPicker.tsx')
    for (const piece of ['<div aria-live="assertive">', '<p aria-live="polite" className="text-sm tabular-nums text-ink">', 'disabled={disabled} aria-disabled={waiting || undefined}\n              onClick={applyPasted}']) {
      expect(picker, piece).toContain(piece)
    }
    expect(read('src/areas/clubs/components/EditorPlaces.tsx')).toContain('<fieldset data-place="2" ')
    expect(read('functions/utils/clubs/migrationLag.ts')).toContain('and a parent\'s delete of a child profile')
    expect(read('test/unit/club-tables-lagging-run.test.ts')).toContain('expect(lines(warn)).toEqual([CHILD_CLUB_REFERENCES_UNCLEARED_LOG])')
  })

  it('names its pins, and the moved checks hold', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/unit/redesign-status-ws09-step4.test.ts`, one assertion', '`test/unit/redesign-status-ws09-step9.test.ts`, two assertions',
      '`test/unit/club-editor.test.tsx`, four assertions', '`test/unit/club-editor-edges.test.tsx`, one', 'Not moved:',
    ]) expect(pins, piece).toContain(piece)
    expect(read('test/unit/redesign-status-ws09-step4.test.ts')).toContain('if (latestStep === 4 || file !== \'test/unit/club-tables-lagging-run.test.ts\') expect(writtenCount(files, file), file).toBe(casesIn(file))')
    const step9 = read('test/unit/redesign-status-ws09-step9.test.ts')
    expect(step9).toContain('.find((h) => h !== \'### WS09 checkpoint T: the review of the whole and its fixes\' && h !== \'### WS09 checkpoint T: the Clubs page fix brought in\')).toBe(LISTS[0])')
    expect(step9).toContain('focusBox.current = bare.inputId')
    expect(read('test/unit/club-editor.test.tsx').match(/toldUpdatedAt/g)).toHaveLength(4)
    expect(read('test/unit/club-editor-edges.test.tsx').match(/toldUpdatedAt: null/g)).toHaveLength(1)
  })

  it('gives the Checks line\'s figures, which add up from the base\'s and the files\' counts', () => {
    const files = bullet(block, '- **Files.**')
    for (const piece of [
      '`npm run typecheck:functions`', 'the base\'s run 995 tests, 659 that run and 336 that skip', '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched',
      'the base\'s figures from the gate on `8ace6a1`\'s tree', 'no browser run of its own',
    ]) expect(checksLine, piece).toContain(piece)
    expect(checksLine).not.toContain('`npm run test:a11y`')
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on the base\), none in a file this block touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![2])).toBe(1048)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_UNIT.length + NEW_INTEGRATION.length)
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    expect([num(unit![3]), Number(unit![4])]).toEqual([9542, 381])
    const fresh = NEW_UNIT.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)
    const moved = CHANGED_UNIT.reduce((a, [, n, was]) => a + n - was, 0)
    expect(num(unit![1])).toBe(9542 + fresh + moved)
    expect(Number(unit![2])).toBe(381 + NEW_UNIT.length)
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts').not.toBeNull()
    expect([num(integration![3]), Number(integration![4])]).toEqual([2357, 128])
    expect([num(integration![1]), Number(integration![2])]).toEqual([2357 + NEW_INTEGRATION.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0), 128 + NEW_INTEGRATION.length])
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    const build = bullet(block, '- **Build.**')
    expect(build).toContain(`\`dist/assets\` holds ${built?.[1]} files`)
    for (const piece of ['a local production build', '`VITE_`', '`features-nZCZoT6G.js` 729 bytes', '`ClubEditor`', '`ClubLocationPicker`', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) {
      expect(build, piece).toContain(piece)
    }
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 12 warnings, unchanged')
  })

  it('gives the fourteen leftovers in order, thirteen closed and N7 recorded, marks three lines, logs two follow-ups, and the closings stand in the code', () => {
    const part = bullet(block, '- **The leftovers.**')
    const bullets = block.split('\n').filter((l) => l.startsWith('- '))
    expect(bullets.findIndex((l) => l.startsWith('- **The leftovers.**'))).toBe(bullets.findIndex((l) => l.startsWith('- **Findings and fixes.**')) + 1)
    const nits = part.split('\n').filter((l) => /^ {2}- N\d+\. /.test(l))
    expect(nits.map((l) => /^ {2}- (N\d+)\. /.exec(l)![1])).toEqual(Array.from({ length: 14 }, (_, i) => `N${i + 1}`))
    for (const [i, line] of nits.entries()) expect(line, `N${i + 1}`).toContain(i === 6 ? ' Recorded: ' : ' Closed: ')
    expect(part.split('\n')[0]).toContain('thirteen are closed')
    for (const [i, piece] of [
      [0, '"A club\'s listing in your region was updated"'], [1, '"Logo and club color"'], [2, 'one status paragraph'], [3, '`example-chess-club-of-example-city`'],
      [4, '`motion-reduce:transition-none`'], [5, 'Changed in checkpoint T\'s review:'], [6, 'owed before `CLUB_KEEPERS_ON` is set'], [7, 'K\'s to say'],
      [8, '`oneLine`'], [9, 'without a second race'], [10, 'WS09 step 23'], [11, '"Baton Rouge, LA"'], [12, 'draws each one afresh'], [13, 'T8 quotes it'],
    ] as const) expect(nits[i], piece).toContain(piece)
    for (const [heading, start, ended, piece] of LEFTOVER_MENDED) {
      const line = lineOf(heading, start)
      expect(line.split(MARK), start).toHaveLength(2)
      expect(line.slice(0, line.indexOf(MARK)).endsWith(ended), start).toBe(true)
      expect(added(line), start).toContain(piece)
    }
    for (const start of LEFTOVER_FOLLOW_UPS) expect(lineOf('### WS09 follow-ups', start), start).not.toBe('')
    if (!ws09.includes('\n### WS09 checkpoint T: checkpoints S and T merged and live\n')) expect(statusLine).toContain('checkpoint T, steps 6 to 9, has had the review of the whole with its fixes and waits on its own branch for K\'s look at the pictures and K\'s own word;')
    expect(statusLine).not.toContain('waits on its own branch for its review')
    expect(block).toContain('"This club\'s page was saved after you opened it. Copy what you want to keep, then reload the page to see the latest version"')
    expect(part.split('\n').filter((l) => /^ {2}- N\d+\. /.test(l))).toHaveLength(14)
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of ['For the leftovers, each the narrowest way', '`test/integration/club-save-edges.test.ts`, one', 'eight lines that find or read "Club color"', 'its count of the lines it marks, now six']) {
      expect(pins, piece).toContain(piece)
    }

    const emails = read('functions/utils/clubs/emails.ts')
    for (const piece of ['  description: \'One sentence about the club\',', '  latitude: \'Where\',', '  color: \'Club color\',', 'const changed = data.fields.join(\'; \')', 'return text.replace(/[\\s\\p{Cc}\\p{Zl}\\p{Zp}]+/gu, \' \').trim()']) {
      expect(emails, piece).toContain(piece)
    }
    expect(emails).not.toMatch(/'(?:Description|Meeting schedule|Contact email|Map pin|Other link|Places|Color)'/)
    const save = read('functions/utils/clubs/save.ts')
    // Checkpoint U decides the notice inside the row's INSERT, so with its block there the INSERT's head and its guard are read apart.
    if (!ws09.includes(`\n${NOTICE_BLOCK}\n`)) expect(save).toContain('SELECT ?, ?, ?, \'club_edit\', NULL, ?, ? WHERE EXISTS (SELECT 1 FROM clubs WHERE id = ?)')
    else for (const piece of ['SELECT ?, ?, ?, \'club_edit\', NULL, ?,', 'WHERE EXISTS (SELECT 1 FROM clubs WHERE id = ?)']) expect(save, piece).toContain(piece)
    expect(save.match(/if \(await clubGone\(db, save\.clubId, err\)\) return null/g)).toHaveLength(2)
    expect(read('functions/api/admin/clubs/[id].ts')).toContain('if (changed === null) return errorResponse(\'Club not found\', 404)')
    expect(read('functions/api/admin/clubs/[id]/places.ts')).toContain('if (changed === null) return errorResponse(\'Club not found\', 404)')
    for (const file of ['domain/contracts/clubs.ts', 'src/areas/clubs/editor.ts']) {
      const rule = read(file)
      expect(rule, file).toContain('const NOT_IN_A_LINK = /["<>`\\p{Cf}]/u')
      expect(rule, file).toContain('&& url.username === \'\' && url.password === \'\'')
    }
    expect(read('domain/clubs/pageMeta.ts')).toContain('What they return is plain text, not text made safe for HTML')
    for (const file of ['src/areas/clubs/components/EditorBasics.tsx', 'src/areas/clubs/components/EditorHelp.tsx', 'src/areas/clubs/previews.ts']) {
      const strings = read(file).split('\n').filter((l) => !/^\s*(?:\/\/|\*|\/\*)/.test(l)).join('\n').match(/'[^'\n]*'|"[^"\n]*"|>[^<>\n{}]+</g) ?? []
      expect(strings.filter((t) => /colour/i.test(t)), file).toEqual([])
    }
    const picker = read('src/areas/clubs/components/ClubLocationPicker.tsx')
    expect(picker).toContain('if (bare && reducesMotion()) mapRef.current?.setCenter(parsed)')
    expect(picker).toContain('{pasteError && <p key={refusals} id={errorId} className="text-sm text-destructive">{pasteError}</p>}')
    expect(read('src/areas/clubs/components/ClubEditor.tsx')).toContain('transition-transform motion-reduce:transition-none')
    const page = read('src/pages/YourClubPage.tsx')
    expect(page).toContain('<p role="status" className={refused ? \'text-sm text-ink\' : \'text-muted-foreground\'}>{refused ? refusalWords(refused) : \'Loading…\'}</p>')
    expect(page).toContain('<Suspense fallback={<p className="text-muted-foreground" role="status">Loading the editor…</p>}>')
    // N7, recorded in the leftovers and closed in the last round: the gold text guard's pin moves with the page's line.
    expect(read('test/unit/goldText.test.ts')).toContain('\'src/pages/AdminClubPage.tsx:428 the style colour color: clubTextColor(color) -> light\'')
    expect(read('test/integration/club-save.test.ts')).not.toMatch(/monroe/i)
  })

  it('gives the last round\'s fifteen lines in order, fourteen closed and P9 recorded with K\'s second choice, marks two lines, closes N7\'s follow-up, and the closings stand in the code', () => {
    const round = bullet(block, '- **The pictures and the last leftovers.**')
    const bullets = block.split('\n').filter((l) => l.startsWith('- '))
    expect(bullets.findIndex((l) => l.startsWith('- **The pictures and the last leftovers.**'))).toBe(bullets.findIndex((l) => l.startsWith('- **The leftovers.**')) + 1)
    const lines = round.split('\n').filter((l) => /^ {2}- (?:P\d|C\d|N7,)/.test(l))
    const names = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'C1', 'C2', 'C3', 'C4', 'C5', 'N7']
    expect(lines.map((l) => /^ {2}- (P\d|C\d|N7)[.,] /.exec(l)?.[1])).toEqual(names)
    for (const [i, line] of lines.entries()) expect(line, names[i]).toContain(names[i] === 'P9' ? ' Recorded: ' : ' Closed: ')
    expect(round.split('\n')[0]).toContain('Fourteen are closed')
    for (const [i, piece] of [
      [0, '"Not saved here yet."'], [1, '`m-0`'], [2, '`scroll-mt-[100vh]`'], [3, '`aria-labelledby`'], [4, '"No club color chosen yet"'], [5, 'today\'s club page keeps the address'],
      [6, '"The club\'s page"'], [7, 'the mark is gone'], [8, '"Saving puts this listing\'s words on today\'s page."'], [9, 'Loading…'], [10, 'a body no page sends and an address typed by hand'],
      [11, 'name no real club'], [12, '`WEB_ADDRESS_WORDS`'], [13, 'seventeen'], [14, '`/admin/clubs/` and the club\'s id'],
    ] as const) expect(lines[i], names[i]).toContain(piece)
    // K's second choice, in T10's form.
    for (const piece of ['K\'s second beside T10', '(1) a save publishes what the editor shows, as built', '(2) a save changes on today\'s page only the fields the keeper changed in that save', 'a rep who changes one thing', 'K\'s own pass through the 25 clubs', 'The first is the one to keep']) {
      expect(lines[8], piece).toContain(piece)
    }
    for (const [heading, start, ended, piece] of ROUND_MENDED) {
      const line = lineOf(heading, start)
      expect(line.split(MARK), start).toHaveLength(2)
      expect(line.slice(0, line.indexOf(MARK)).endsWith(ended), start).toBe(true)
      expect(added(line), start).toContain(piece)
    }
    expect(part('### WS09 step 7: the editor, basics first')).not.toContain('differ from today\'s page, after a change in today\'s form')
    expect(lineOf('### WS09 follow-ups', LEFTOVER_FOLLOW_UPS[0])).toContain('Closed in checkpoint T\'s review: the page moves to the club\'s id\'s address before it draws')
    expect(bullet(block, '- **Pins moved.**')).toContain('the admin club page\'s line 412, now 428')
    expect(bullet(block, '- **What ships with every switch off.**')).toContain('when both are refused it says the club\'s refusal, where it said whichever came first')

    const page = read('src/pages/YourClubPage.tsx')
    expect(page).toContain('if (!club.told_updated_at || (!club.told_by && !club.last_confirmed_at)) return \'Not saved here yet.\'')
    expect(page).toContain('const pageName = ownsIt ? \'Your club\\\'s page\' : \'The club\\\'s page\'')
    expect(page).not.toContain('ExternalLink')
    const basics = read('src/areas/clubs/components/EditorBasics.tsx')
    expect(basics).toContain('const PART = \'min-w-0 space-y-4 border-0 border-t border-hairline p-0 pt-6\'')
    expect(basics).toContain('<p>Saving puts this listing\'s words on today\'s page.</p>')
    expect(basics).toContain('{noColour && <p id="editor-color-none" className="text-sm text-ink">No club color chosen yet</p>}')
    const editor = read('src/areas/clubs/components/ClubEditor.tsx')
    expect(editor).toContain('el.focus({ preventScroll: true })')
    // A press of Help in a box scrolled down takes the box, and only the box, back to its top, where Help is.
    expect(editor).toContain('const box = el.closest<HTMLElement>(\'[data-slot="scroll-panel"]\')\n  if (box) box.scrollTop = 0')
    expect(lines[2], 'P3').toContain('as the focus moves into Help the box goes back to its top, which moves the box alone and never the page')
    // The box's scroll margin, in its classes since the last small round (Q1).
    expect(editor).toContain('className={BOX}')
    expect(editor).toContain('const BOX = \'scroll-mt-[100vh] ')
    expect(read('src/areas/clubs/components/EditorPlaces.tsx')).toContain('<fieldset aria-labelledby="editor-where" ')
    const admin = read('src/pages/AdminClubPage.tsx')
    expect(admin).toContain('navigate({ pathname: `/admin/clubs/${encodeURIComponent(c.id)}`, search: searchNow.current }, { replace: true })')
    expect(admin.split('\n')[427]).toContain('color: clubTextColor(color),')
    // The admin club page is older than checkpoint T: its three long dashes are today's, and the last round adds none.
    expect(admin.split('\n').filter((l) => DASHES.test(l))).toHaveLength(3)
    for (const rule of [TOOLS, BARE, OLD_INITIALS]) expect(admin).not.toMatch(rule)
    expect(bullet(block, '- **Files.**')).toContain('`src/pages/AdminClubPage.tsx` (N7)')
    // What a save writes is K's to choose (P9), so the mirror is as built.
    expect(read('functions/utils/clubs/save.ts')).toContain('The mirror, by K\'s choice 3 (a) on the WS09 plan: a save also writes')
  })

  it('gives the last small round\'s three lines, each closed, after the last round and before the files, marks WS09 step 7\'s line on a phone, and the closings stand in the code', () => {
    const round = bullet(block, '- **The last small round.**')
    const bullets = block.split('\n').filter((l) => l.startsWith('- '))
    const at = bullets.findIndex((l) => l.startsWith('- **The last small round.**'))
    expect(at).toBe(bullets.findIndex((l) => l.startsWith('- **The pictures and the last leftovers.**')) + 1)
    expect(bullets[at + 1].startsWith('- **Files.**')).toBe(true)
    expect(round.split('\n')[0]).toContain('all three are closed')
    const lines = round.split('\n').filter((l) => /^ {2}- Q\d\. /.test(l))
    expect(lines.map((l) => /^ {2}- (Q\d)\. /.exec(l)![1])).toEqual(['Q1', 'Q2', 'Q3'])
    for (const line of lines) expect(line, line.slice(0, 8)).toContain(' Closed: ')
    for (const [i, piece] of [
      [0, '`max-lg:max-h-none`'], [0, '`scrollsWhen`'], [0, 'neither a stop for Tab nor a named region'], [0, 'draws attribute for attribute as before'], [0, 'clear of the site\'s header'],
      [1, '`own`'], [1, '"How the club\'s page shows up in a search"'], [1, '"Checklist for the club\'s page"'], [1, '"Address of the club\'s page"'], [1, 'lets a club\'s rep in at their own club\'s id'],
      [2, '"Paste the whole web address copied from the browser\'s address bar, starting with https:// or http://"'], [2, 'true whichever reason refused the link'],
    ] as const) expect(lines[i], piece).toContain(piece)
    for (const [heading, start, ended, piece] of FINAL_MENDED) {
      const line = lineOf(heading, start)
      expect(line.split(MARK), start).toHaveLength(2)
      expect(line.slice(0, line.indexOf(MARK)).endsWith(ended), start).toBe(true)
      expect(added(line), start).toContain(piece)
    }
    expect(lineOf(BLOCK, '  - C4. ')).toContain('Q3 gives the words their present form.')
    expect(block.split('\n')[2]).toContain('closes three more (Q1 to Q3)')
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of ['For the last small round, each the narrowest way', '`LINK_WORDS` in its present words (Q3)', 'now the constant `BOX`','its count of the lines it marks, now nine']) expect(pins, piece).toContain(piece)
    expect(bullet(block, '- **What ships with every switch off.**')).toContain('`ScrollPanel` takes an optional width that no other page passes')

    const editor = read('src/areas/clubs/components/ClubEditor.tsx')
    expect(editor).toContain('const SIDE_BY_SIDE = \'(min-width: 64rem)\'')
    expect(editor).toContain('const BOX = \'scroll-mt-[100vh] max-lg:max-h-none max-lg:overflow-visible max-lg:[&>[data-slot=scroll-panel-header]]:static\'')
    expect(editor).toContain('scrollsWhen={SIDE_BY_SIDE}')
    expect(editor).toContain('focusRefused(document.getElementById(`editor-${found[0][0]}`))')
    const panel = read('src/components/ScrollPanel.tsx')
    expect(panel).toContain('tabIndex={scrolls ? 0 : undefined}')
    // Only the editor passes a width: every other panel scrolls at every width, as before.
    expect(read('src/components/layout/MobileMenu.tsx')).not.toContain('scrollsWhen')
    expect(read('src/pages/fixtures/ScopeFixturePage.tsx')).not.toContain('scrollsWhen')
    expect(read('src/pages/YourClubPage.tsx')).toContain('own={ownsIt}')
    expect(read('src/pages/AdminClubPage.tsx')).toContain('own={role === \'club_rep\' && !!member?.club_id && member.club_id === club.id}')
    for (const file of ['domain/contracts/clubs.ts', 'src/areas/clubs/editor.ts']) {
      const rule = read(file)
      expect(rule, file).toContain('Paste the whole web address copied from the browser\\\'s address bar, starting with https:// or http://')
      expect(rule, file).not.toContain('true of each reason')
    }
  })

  it('gives the closing mend\'s four lines after the last small round\'s three, three closed and M4 taken back, logs M2\'s follow-up, and the closings stand in the code', () => {
    const round = bullet(block, '- **The last small round.**')
    expect(round.split('\n')[0]).toContain('found four more (M1 to M4): M1 to M3 are closed in a closing mend')
    expect(block.split('\n')[2]).toContain('and a closing mend three more (M1 to M3) and takes back its change for a fourth (M4)')
    const lines = round.split('\n').filter((l) => /^ {2}- [QM]\d\. /.test(l))
    expect(lines.map((l) => /^ {2}- ([QM]\d)\. /.exec(l)![1])).toEqual(['Q1', 'Q2', 'Q3', 'M1', 'M2', 'M3', 'M4'])
    const mend = lines.slice(3)
    for (const line of mend.slice(0, 3)) expect(line, line.slice(0, 8)).toMatch(/ Closed[:,] /)
    expect(mend[3]).toContain(' Taken back: ')
    for (const [i, piece] of [
      [0, 'brought into view by its top'], [0, '`scroll-mt-24`'], [0, 'as P3 says'], [0, 'under the site\'s header, within the room `UNDER_HEADER` keeps'], [0, 'from `lg` up only Help above the window moves, as before'],
      [1, 'Focus Not Obscured'], [1, '`CLEAR_OF_HEADER`'], [1, 'in checkpoint T\'s own files alone'], [1, 'by its caret'], [1, 'stood exactly where it stood before'], [1, 'the site footer\'s two links'],
      [1, 'only when Tab brings the focus to it from another control'], [1, 'one such stop on Your club\'s page at 1024 by 768 and six at 1280 by 900'], [1, '"Controls under today\'s header from `lg` up (WS09 step 9)."'],
      [2, '`Today\'s club page keeps the address shown under "Address of the club\'s page", which stays the same if the club is renamed, so links and search results keep working.`'], [2, '"Your page\'s address"'],
      [3, 'after a save the box and the page stay where the keeper left them'], [3, 'was tried and taken back'], [3, '364 pixels at 1280 by 900'],
    ] as const) expect(mend[i], piece).toContain(piece)
    expect(mend[1]).not.toContain('the box\'s own scroll padding')
    expect(round.split('\n').filter((l) => l.startsWith('  - M4. '))).toHaveLength(1)
    const followUp = lineOf('### WS09 follow-ups', MEND_FOLLOW_UP)
    for (const piece of ['as it was before checkpoint T\'s review', 'today\'s look shares it on every page', '`scroll-padding-top: var(--header-h, 0px)` in `src/index.css`', 'Should K want it sooner, the smallest fix is `CLEAR_OF_HEADER`']) {
      expect(followUp, piece).toContain(piece)
    }
    expect(read('src/index.css')).toContain('scroll-padding-top: var(--header-h, 0px);')
    expect(bullet(block, '- **Pins moved.**')).toContain('For the closing mend, each the narrowest way')
    expect(bullet(block, '- **What ships with every switch off.**')).toContain('The closing mend\'s changes are each reached only with `clubKeepers` on')
    expect(bullet(block, '- **Build.**')).toContain('After the closing mend, with its change for M4 taken back:')

    const editor = read('src/areas/clubs/components/ClubEditor.tsx')
    // M1: Help above the window, or under the header below lg, by its top; below the window by its nearest edge.
    expect(editor).toContain('const room = typeof window.matchMedia === \'function\' && !window.matchMedia(SIDE_BY_SIDE).matches ? UNDER_HEADER : 0\n  if (top < room) el.scrollIntoView?.({ block: \'start\' })\n  else if (top > window.innerHeight - 48) el.scrollIntoView?.({ block: \'nearest\' })')
    // M2: the controls' room below lg alone, and the box of words brought down by its top when Tab brought the focus from another control.
    expect(editor).toContain('const CLEAR_OF_HEADER = \'max-lg:[&_:is(a,button,input,select,textarea,[tabindex])]:scroll-mt-24\'')
    expect(editor).toContain('onKeyDown={noteTab} onPointerDown={forgetTab} onFocus={focusMoved}')
    expect(editor).toContain('if (from && from !== e.target) textBoxClear(e.target)')
    expect(editor).toContain('if (!(el instanceof HTMLTextAreaElement) || typeof window.matchMedia !== \'function\' || window.matchMedia(SIDE_BY_SIDE).matches) return')
    expect(read('src/pages/YourClubPage.tsx')).toContain('max-lg:[&_a]:scroll-mt-24')
    // M3: the card's name in quotation marks, in both forms of the sentence.
    expect(read('src/areas/clubs/components/EditorHelp.tsx')).toContain('Today\'s club page keeps the address shown under "${addressCardName(own)}", which stays')
    // M4, taken back: nothing moves the box or the page once a save is done.
    expect(editor).not.toMatch(/saves > 0|ref=\{form\}|scrollTop = 0[^\n]*\n[^\n]*\}, \[saves\]/)
    expect(editor.match(/scrollTop = 0/g)).toHaveLength(1)
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what it wrote and the files it adds', () => {
    const written = [
      block, ...[...MENDED, ...LEFTOVER_MENDED, ...ROUND_MENDED, ...FINAL_MENDED].map(([heading, start]) => added(lineOf(heading, start))),
      ...[...LEFTOVER_FOLLOW_UPS, MEND_FOLLOW_UP].map((start) => lineOf('### WS09 follow-ups', start)), statusLine, lineOf('### WS09 step 7: the editor, basics first', '- **The basics.**'),
    ].join('\n')
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
    for (const file of [...NEW_UNIT, ...NEW_INTEGRATION, ...CHANGED]) {
      const text = read(file)
      for (const rule of [TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
      expect(text.split('\n').filter((l) => DASHES.test(l)).length, file).toBe(0)
    }
  })
})
