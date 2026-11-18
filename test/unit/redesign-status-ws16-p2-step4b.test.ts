// test/unit/redesign-status-ws16-p2-step4b.test.ts
//
// REDESIGN_STATUS.md records the second half of WS16 part two's page step 4,
// the newsletter's own page on a tablet and a phone. Like the page half's
// other record tests, this file reads only the WS16 section, and in it only
// two things: the page half's status line, and this half's block, from its
// heading to the next heading of its level or of the part's, whatever a later
// step puts there; it never holds the block to be the last, and it reads no
// count or figure from the code. Pinned here: the block's place, after the
// first half's, under a heading the page steps' own count passes over; the
// status line, in this half's words while page step 4 is the latest; the
// block's opening, which says page step 4 is whole; its parts, in order;
// what each part holds; the files, with each test file's count of cases;
// the build, worker and lint lines and the checks line, each check once with
// the base's figures; and the plain-language rules over the block and the
// status line. Since the close before the commit, what each part holds
// includes the close's words: the computer's page as its pictures show it
// and what behaves differently there, the Subject's two fields, the frames
// that add nothing to the browser's history, the dim, the controls counted
// by width, the contrast's ground, the differences from the board and the
// follow-ups it added, and the record's tests run again after its figures.
// Since the last fixes after a second look at the close, it holds as well
// the paste's wider rule, with the kinds of line break named; the caret
// left in view on a computer; the focus going with the frame on show when a
// frame is replaced; the carried focus's scroll; a drop left the base's
// way; and the new counts of cases. Since the mend after a check of those
// fixes, it holds the day the half was finished; the field's scroll kept
// across the page's insert and its selection set again after it, so letters
// typed straight after such a paste are a step of their own for Undo, and
// the step that letters typed straight before one still join; a real drop
// tried in Chromium; the drop, the long paste on a phone and the step
// joined before a paste left for page step 5; the browser run made again;
// and the new counts of cases.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, in the plural as well, and the two words that name a person's role in the work. */
const BANNED = new RegExp(`\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow', 'revie' + 'wer', 'tes' + 'ter'].join('|')})s?\\b|${'the ' + 'lead'}`, 'i')
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** An assistant named, or a line about how the words came to be. */
const ASSISTANT = new RegExp(`\\b(?:${'assis' + 'tant'}|${'gener' + 'ated'}|${'wri' + 'tten by'})\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(
  `${String.fromCharCode(0x27ea)}|${String.fromCharCode(0xab)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}|${'T' + 'BD'}`,
)
const CAPITALS = /\b[A-Z0-9]{8,}\b/
/** The merge-pending phrase, which this part never holds. */
const PENDING = new RegExp(`merge into \`main\` is ${'pen' + 'ding'}|is ${'pen' + 'ding'}`)
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
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const HEADING = '## WS16: Mail (the mail engine, lists and the LCA newsletter)'
/** The WS16 section, from its heading to the Phase 0 heading. */
const ws16 = between(status, `\n${HEADING}\n`, '\n## Phase 0:')
const PART = '### WS16 part two: the newsletter\'s own page'
/** The page half's part: from its heading to the next heading of the section's level. */
const part = ws16.includes(`\n${PART}\n`) ? between(ws16.slice(ws16.indexOf(`\n${PART}\n`) + 1), PART, '\n### ') : ''
const FIRST_HALF = '#### WS16 part two, page step 4: the page on a computer'
const BLOCK = '#### WS16 part two, page step 4, second half: the page on a tablet and a phone'
/** This half's block: from its heading to the next block's heading or the part's end. */
const block = part.includes(`\n${BLOCK}\n`) ? between(part.slice(part.indexOf(`\n${BLOCK}\n`) + 1), BLOCK, '\n#### ') : ''
const blockLines = block.split('\n')
const opening = blockLines[2] ?? ''
const PART_STATUS = '**Status of the page half:** in progress: '
const partStatus = part.split('\n').find((l) => l.startsWith(PART_STATUS)) ?? ''
/** The highest page step with a block of its own in the part, which this half's heading does not count as a step of its own. */
const latestPageStep = Math.max(0, ...[...part.matchAll(/^#### WS16 part two, page step (\d+): /gm)].map((m) => Number(m[1])))
const checksLine = blockLines.find((l) => l.startsWith('- Checks:')) ?? ''

/** The block's parts, in their order. */
const PARTS = [
  '- **The widths.**', '- **The tablet.**', '- **The phone.**', '- **The sheet.**', '- **Touch.**', '- **Carried from the first half.**', '- **Focus at three widths.**',
  '- **The browser run.**', '- **What ships with every switch off.**', '- **Differences from the board.**', '- **Deviations from the entry.**', '- **Judgement calls.**',
  '- **Follow-ups.**', '- **Files.**', '- **Build.**', '- **Worker.**', '- **Lint.**', '- Checks:',
]

describe('REDESIGN_STATUS.md, WS16 part two: page step 4\'s second half, its place and the status line', () => {
  it('sits in the page half\'s part once, after the first half\'s block, one level under the part\'s heading', () => {
    expect(part).not.toBe('')
    expect(block.length).toBeGreaterThan(5000)
    expect(status.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(part.indexOf(`\n${FIRST_HALF}\n`)).toBeGreaterThan(-1)
    expect(part.indexOf(`\n${BLOCK}\n`)).toBeGreaterThan(part.indexOf(`\n${FIRST_HALF}\n`))
    expect(blockLines.filter((l) => /^#{1,4} /.test(l))).toEqual([BLOCK])
    // The heading is page step 4's still, so the page steps' own count, which the part's other record tests read, passes over it.
    expect(BLOCK).not.toMatch(/^#### WS16 part two, page step (\d+): /)
    expect(latestPageStep).toBeGreaterThanOrEqual(4)
  })

  it('gives the part\'s status line this half\'s words while page step 4 is the latest', () => {
    for (const piece of ['`redesign/ws16-page`', 'nothing of it is merged']) expect(partStatus, piece).toContain(piece)
    if (latestPageStep === 4 && !part.includes('\n#### WS16 part two, page step 5, first part: ')) {
      expect(partStatus).toBe(
        `${PART_STATUS}four of its twelve steps are built, page step 4 in two halves, the page on a computer and then on a tablet and a phone, on the branch \`redesign/ws16-page\`, cut from \`d2c5ec0\`, the merge of checkpoint M (pull request 126); nothing of it is merged, and no pull request is opened before checkpoint P, the page, is ready, which is after checkpoint N has merged.`,
      )
    }
  })

  it('opens with what this half is, its base and its day, and says page step 4 is whole with it', () => {
    for (const piece of [
      'the second half of page step 4, the page on a tablet and a phone', 'built on Saturday, November 14, 2026 on `5527d9d`, the first half\'s commit',
      'and with it page step 4 is whole', 'P19 and P20', 'K\'s decision 51', '"See the email"', '"Back to writing"', 'the four points the first half\'s reviews left for it',
      'the focus proofs at a computer\'s, a tablet\'s and a phone\'s width', 'the page\'s full browser run',
      'finished the next day, Sunday, November 15, 2026, after a close and a check',
      'On a computer the page looks as the first half\'s did, by its pictures 01 to 27 taken again', 'the caret is brought into view when Tab gives the letter the focus',
      'with the crumb, the heading, Help, Admin sections and the side column put away behind it', 'a tab or a line break of any kind pasted into the Subject becomes one space',
      'letters typed straight before such a paste, the caret not moved between, join its step for Undo',
      'the preview\'s frames add nothing to the browser\'s history', 'no press on the dim behind the email\'s sheet moves the focus',
      'the frame\'s copy of a link keeps only its style, its tabindex and a jump link\'s address',
      'registered only with the switch `mailPage` on, which stays off', 'nothing in this half sends an email',
      'no file under `functions/`, `domain/`, `workers/` or `migrations/` changes',
    ]) expect(opening, piece).toContain(piece)
  })

  it('holds its parts once each, in order', () => {
    const at = PARTS.map((p) => blockLines.findIndex((l) => l.startsWith(p)))
    for (const [i, p] of PARTS.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const p of PARTS) expect(blockLines.filter((l) => l.startsWith(p)), p).toHaveLength(1)
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: page step 4\'s second half, what it holds', () => {
  it('says at which widths the page is the computer\'s, the tablet\'s and the phone\'s, and what each width shows', () => {
    const widths = bullet(block, '- **The widths.**')
    for (const piece of [
      '`src/hooks/useWideScreen.ts`', 'from 1024 pixels up the computer\'s page', 'from 768 to 1023 the tablet\'s (board P19)', 'under 768 the phone\'s (board P20)',
      'A tablet held upright, 820 by 1180, is the tablet\'s page, and on its side, 1180 by 820, the computer\'s',
      'a phone held upright is the phone\'s page, and on its side, 844 by 390, the tablet\'s',
      '1440 by 1000 being 720 by 500 pixels of page', '320 pixels wide', 'the Subject\'s field follows the same line by `useWideScreen`',
    ]) expect(widths, piece).toContain(piece)
    const tablet = bullet(block, '- **The tablet.**')
    for (const piece of [
      '`src/areas/admin/newsletter/NewsletterHead.tsx`', 'Help as its mark alone, 44 pixels square', '"See the email", navy, 50 pixels tall', '"Admin sections" gives way to the crumb\'s Admin',
      '`src/areas/admin/newsletter/FromSubjectRow.tsx`', 'From and Subject stacked', '`src/areas/admin/newsletter/LetterEditor.tsx`', '48 pixels tall with their words',
      '`src/areas/admin/newsletter/InThisIssue.tsx`', 'each part 44 pixels both ways', 'The side column is not drawn',
    ]) expect(tablet, piece).toContain(piece)
    const phone = bullet(block, '- **The phone.**')
    for (const piece of [
      'until it is built, the phone\'s "See the email" sits where the tablet\'s does', 'page step 5 moves it into its bar', 'each its mark alone',
      'its word kept inside it for a screen reader', 'More options sits at the page\'s end on a phone (K\'s decision 52, item 3)', 'so none is drawn',
      'The Subject\'s field wraps its words on a narrow window, under 1024 pixels', 'from 1024 pixels up it keeps its words on one line, scrolling inside it',
      'Enter types nothing, and a line break pasted becomes a space',
      'so the words either side never run together', 'Its words are 16 pixels, as at every width, so a phone\'s browser does not zoom the page in',
      'its count stays in its own line under the row', 'to the pixel, in every one of the first half\'s pictures',
      'on a phone held upright, under 640 pixels', 'from 640 to 767 the letter 52 pixels, its band 60 and "In this issue" 52, as on a computer',
      'the first half\'s own field of one line, an input as `5527d9d` draws it', '(`aria-multiline` false)',
      'brings its whole box into view, with its own scroll margins, as it takes the focus', 'the browser\'s Undo does not cross the line',
      'put in by the browser\'s own insert so that Undo takes the paste back in one step', 'is the base\'s to the pixel in 208 of 210 pictures',
      'a line break of any kind: the line feed and the carriage return that end a line', 'is dropped from the paste first', 'nothing changes them by script after it',
      'a paste the page takes over leaves the field scrolled where the browser\'s own paste of the same words leaves it, in every case tried, over chosen words too',
      'the field\'s scroll is kept across the page\'s insert', 'Letters typed straight after such a paste are a step of their own for Undo, as with the first half\'s field',
      'the field sets its selection again where it stands, which ends that step', 'Letters typed straight before such a paste, the caret not moved between, still join its step',
    ]) expect(phone, piece).toContain(piece)
  })

  it('says what the sheet is, what it does with the focus and the page behind it, and what its frame is', () => {
    const sheet = bullet(block, '- **The sheet.**')
    for (const piece of [
      '`src/areas/admin/newsletter/SidePreview.tsx`, `EmailSheet`', '"What members will get"', 'K\'s decision 29', 'Board P19 does not say what the tablet\'s button opens',
      '"Back to writing"', 'the board draws no Phone, Computer or Hide there, and there are none', 'a dialog on the site\'s dialog primitive',
      'It takes the focus as it opens, on itself', 'it closes on Escape, on "Back to writing" and on a press outside it, and gives the focus back to the control that opened it',
      'Shift and Tab goes round the other way, to "Back to writing" from the frame and from the sheet itself, and never reaches the page behind',
      'the page behind it is hidden from a screen reader, does not scroll by wheel or by touch, and takes no press', 'The site\'s root, the page behind it, is inert while it is open',
      'goes straight on to "Back to writing"', 'The root is let go as the sheet closes, before the focus is given back', 'no focus event reached the page behind', '`SavedLineNotice`',
      'Escape pressed while the focus is in the email\'s frame is the email document\'s key', 'so it is no trap', 'Its frames are the side preview\'s own',
      'the same sandbox of no allowances', 'marked as a link that is not available', 'a jump link scrolling inside the frame', 'never on an empty frame',
      'page step 6\'s Send and Send later', 'Proved again in Chromium on the sheet', 'No press on the dim moves the focus',
      'the sheet passes the focus on from that guard', 'so nothing else written on a link, a ping or a target, reaches the frame',
      'each new email in a frame element of its own, so the frames add nothing to the browser\'s history', 'Proved in the close, on copies built from the finished tree',
      'nor dropped to the page when a newer email takes the place of the frame that held it', 'Proved after a second look at the close, on copies built from the finished tree',
    ]) expect(sheet, piece).toContain(piece)
  })

  it('gives every control\'s size by touch, the four carried points with their cases, and the focus at three widths with the Tab order', () => {
    const touch = bullet(block, '- **Touch.**')
    for (const piece of [
      'at least 44 pixels in both directions at the tablet\'s width and the phone\'s', '32 pixels tall on a computer and 44 both ways here', 'Measured in the browser run',
      'the Add menu, 48 pixels tall on a tablet and 44 on a phone', 'controls at the tablet\'s width and the phone\'s', 'are counted apart and held to no such floor',
    ]) expect(touch, piece).toContain(piece)
    const carried = bullet(block, '- **Carried from the first half.**')
    for (const piece of [
      '(1) The saved line\'s two regions stay in place', 'the letter made bigger is now the page itself as the dialog', '(2) A read of their letter tried again',
      '`readFailures`', 'the first half\'s `region2.cjs` method', '(3) "Show the email" after Hide shows no empty frame', 'keeps its frames',
      '(4) The page does not send again by itself the words a 400 or a 413 refused', 'a change to the words sends them', 'failed before',
      'in a frame drawn for that email while the column was hidden', 'were signalled to it',
    ]) expect(carried, piece).toContain(piece)
    const focus = bullet(block, '- **Focus at three widths.**')
    for (const piece of [
      'At a computer\'s width (1440 by 1000), a tablet\'s (820 by 1180) and a phone\'s (390 by 844)', 'under today\'s menu and under the new one',
      'the 80 pixels kept at the window\'s foot for page step 5\'s bar', 'The bar is not built, so what was measured is the room kept for it; page step 5 measures again with its bar',
      'each was mended rather than listed', '144 pixels below it', 'The Tab order:', 'Help is not among them', 'Dragging Movements (WCAG 2.2, 2.5.7)', 'Nothing moves under reduced motion',
    ]) expect(focus, piece).toContain(piece)
  })

  it('gives the browser run, what ships with every switch off, the differences from the board and the entry, the judgement calls and the follow-ups', () => {
    const run = bullet(block, '- **The browser run.**')
    for (const piece of [
      '`mailLists` and `mailPage` on', 'never on the tree', '`npm run test:a11y`, is not run in this half', 'blended with what is under it',
      'the brand\'s gold at a tenth over the strip\'s white', 'with the 1,008 measured at a computer\'s width counted apart',
      'after a second look at the close, 25 real pastes from the browser\'s clipboard', 'The whole run was made again after a check of the last fixes',
    ]) expect(run, piece).toContain(piece)
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['No route', 'which Admin sends to `/admin`', 'no zod', '`test/a11y/baseline.json` is unchanged']) expect(ships, piece).toContain(piece)
    const board = bullet(block, '- **Differences from the board.**')
    for (const piece of [
      '"Tap to edit"', 'K\'s choice 5', 'K\'s decision 40', 'the Subject\'s words are 16 pixels, 1 more than the board\'s 15', 'numbers 49 and 50',
      'the head stands on a white band with a rule under it', 'the count\'s line under the row is kept at every width', 'the parts of "In this issue" stand 46 pixels apart',
      'below the board\'s crop at a tablet\'s full height',
    ]) expect(board, piece).toContain(piece)
    const deviations = bullet(block, '- **Deviations from the entry.**')
    for (const piece of ['The entry\'s point 10', '`src/areas/admin/newsletter/letterRules.ts`']) expect(deviations, piece).toContain(piece)
    const calls = bullet(block, '- **Judgement calls.**')
    for (const piece of [
      'One sheet for the tablet and the phone', 'K\'s decision 33', 'never sent again by the page itself', 'The Subject is two fields by the window\'s width',
      'and the browser\'s Undo does not cross the line', 'Under 1024 pixels Undo after typing takes back one letter at a time', 'Each new email goes into a frame element of its own',
      'the new field takes the focus without the browser\'s own scroll', 'A drop is left the base\'s way',
      'so the focus goes with the frame on show also when a newer email takes the place of the frame that held it',
      'first its scroll is put back as it stood before the insert', 'its selection is set again where it stands, with the same start, end and direction',
      'A real drop was tried in Chromium by a second look at the close',
    ]) expect(calls, piece).toContain(piece)
    const follow = bullet(block, '- **Follow-ups.**')
    for (const piece of [
      'Page step 5:', 'takes "See the email" beside "Pick a template" from the head', 'More options, which a phone shows at the page\'s end (K\'s decision 52, item 3)',
      'Page step 6:', 'K\'s decision 52, item 4', '`MAIL_PAGE_ON`', 'whether the system\'s Back, which now leaves the page at once, should first close the email\'s sheet',
      'pasted into the month\'s box', 'the Subject\'s Undo after typing', 'passes the focus on from the dialog\'s guard to its last control',
      'dropped onto the Subject, which joins the words either side', 'can carry the caret\'s line into the bar\'s room',
      'letters typed straight before a paste the page takes over, the caret not moved between, which join its step for Undo in Chromium',
    ]) expect(follow, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: page step 4\'s second half, its files and figures', () => {
  it('names every file it changes and adds, each test file with its count of cases, and the one file beyond the step\'s list', () => {
    const files = bullet(block, '- **Files.**')
    for (const piece of [
      '`src/pages/AdminNewsletterPage.tsx`', '`src/areas/admin/newsletter/NewsletterHead.tsx`', '`src/areas/admin/newsletter/FromSubjectRow.tsx`',
      '`src/areas/admin/newsletter/LetterEditor.tsx`', '`src/areas/admin/newsletter/InThisIssue.tsx`', '`src/areas/admin/newsletter/SidePreview.tsx`',
      '`src/areas/admin/newsletter/useIssue.ts`', '`test/unit/admin-newsletter-page.test.tsx` (31: ', '`test/unit/admin-newsletter-save.test.tsx` (40: ',
      '`test/unit/admin-newsletter-focus.test.tsx` (27: ', '`test/unit/admin-newsletter-edges.test.tsx` (21: ', '`test/unit/redesign-status-ws16-p2-step4.test.ts` (15, as before)',
      '`REDESIGN_STATUS.md`', '`test/unit/admin-newsletter-sheet.test.tsx` (32: ', '`test/unit/admin-newsletter-refused.test.tsx` (6: ',
      'the field of one line then scrolled to the caret', 'the focus going with the frame on show also when a newer email takes the place of the frame that held it',
      'its selection set again where it stands', 'its scroll from before the insert put back first',
      '`test/unit/redesign-status-ws16-p2-step4b.test.ts` (13: ', 'Beyond the step\'s list, one file', '`src/areas/admin/newsletter/letterRules.ts`',
      '`test/unit/redesign-status-ws16-p2-step3.test.ts`',
    ]) expect(files, piece).toContain(piece)
  })

  it('gives the build, the worker and the lint against the base, measured first', () => {
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local build of the base `5527d9d` made first', '239 files in `dist` and 200 in `dist/assets`, as on the base', 'against 12,298,228',
      '`AdminNewsletterPage-CnUonU-P.js` at 52,321 bytes', '`index-Dnjz0G33.css` at 146,819', '`index-h4CJPsZR.js` at 555,457 bytes',
      '`features-Bz-URkAf.js` at 710 bytes', 'the base\'s byte for byte', 'No file is new and none is gone',
    ]) expect(build, piece).toContain(piece)
    const worker = bullet(block, '- **Worker.**')
    for (const piece of ['`WRANGLER_HIDE_BANNER=true WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run`', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes', 'byte for byte the base\'s']) {
      expect(worker, piece).toContain(piece)
    }
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings over 992 files, 989 on the base')
  })

  it('gives each check once in its checks line, with the base\'s figures', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    for (const piece of [
      '(989 on the base)', '(9,095 in 346 on the base)', '(2,151 in 114 on the base)', '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`',
      'from 4:29 AM to 4:53 AM UTC', 'every one passing', 'every test file that reads `REDESIGN_STATUS.md` was run again after these figures went in',
    ]) expect(checksLine, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: plain language over page step 4\'s second block and the status line', () => {
  const text = `${partStatus}\n${block}`

  it('keeps the dashes, the working words, any tool\'s name, the old initials, unfilled marks and the merge-pending phrase out of them', () => {
    expect(block).not.toBe('')
    for (const rule of [DASHES, BANNED, TOOLS, ASSISTANT, BARE, OLD_INITIALS, UNFILLED, PENDING]) expect(text).not.toMatch(rule)
    expect(proseOf(text)).not.toMatch(CAPITALS)
    expect(proseOf(text)).not.toMatch(HE)
    expect(text).not.toMatch(/\(step \d+[;),]/)
    expect(blockLines.filter((l) => l.startsWith('|'))).toEqual([])
  })

  it('gives every date its weekday, writes every time on the twelve-hour clock, and names checkpoints in full', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const prose = proseOf(text)
    for (const found of prose.matchAll(new RegExp(`\\b(?:${MONTHS.join('|')}|${MONTHS.map((m) => m.slice(0, 3)).join('|')}) \\d{1,2}\\b`, 'g'))) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const [whole, weekday, month, day, year] of prose.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${MONTHS.join('|')}) (\\d{1,2})\\b(?:, (\\d{4}))?`, 'g'))) {
      expect(WEEKDAYS[new Date(Date.UTC(Number(year ?? 2026), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
    const bare = prose.replace(/\b[Cc]heckpoints [J-R](?:, [J-R])* and [J-R]\b|\b[Cc]heckpoint [J-R]\b/g, 'checkpoint')
    expect([...bare.matchAll(/(?<![\w-])[JLMNOPQR](?![\w-])/g)].map((m) => m[0])).toEqual([])
  })
})
