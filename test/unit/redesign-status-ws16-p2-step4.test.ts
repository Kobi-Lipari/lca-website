// test/unit/redesign-status-ws16-p2-step4.test.ts
//
// REDESIGN_STATUS.md records the first half of WS16 part two's page step 4,
// the newsletter's own page on a computer. Like the page half's other record
// test, this file reads only the WS16 section, and in it only two things: the
// page half's status line, and this step's block, from its heading to the
// next heading of its level or of the part's, whatever a later step puts
// there; it never holds the block to be the last, and it reads no count or
// figure from the code. Pinned here: the block's place, after page step 3's;
// the status line, in this half's words while page step 4 is the latest; the
// block's opening, which says the second half follows; its parts, in order;
// the page, saving, the preview, focus with its figures, what ships with
// every switch off and the editor kit with the files' bytes; the files, with
// each test file's count of cases; the verify items, the deviations, the
// judgement calls and the follow-ups; the build, worker and lint lines and
// the checks line, each check once with the base's figures; and the
// plain-language rules over the block and the status line.
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
  `${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}|${'T' + 'BD'}`,
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
const STEP_THREE = '#### WS16 part two, page step 3: the letter\'s storage and saving'
const BLOCK = '#### WS16 part two, page step 4: the page on a computer'
/** This step's block: from its heading to the next block's heading or the part's end. */
const block = part.includes(`\n${BLOCK}\n`) ? between(part.slice(part.indexOf(`\n${BLOCK}\n`) + 1), BLOCK, '\n#### ') : ''
const blockLines = block.split('\n')
const opening = blockLines[2] ?? ''
const PART_STATUS = '**Status of the page half:** in progress: '
const partStatus = part.split('\n').find((l) => l.startsWith(PART_STATUS)) ?? ''
/** The highest page step with a block in the part: this half's words of the status line hold only while it is the latest. */
const latestPageStep = Math.max(0, ...[...part.matchAll(/^#### WS16 part two, page step (\d+): /gm)].map((m) => Number(m[1])))
const checksLine = blockLines.find((l) => l.startsWith('- Checks:')) ?? ''

/** The block's parts, in their order. */
const PARTS = [
  '- **The page.**', '- **Saving.**', '- **The preview.**', '- **Focus.**', '- **What ships with every switch off.**', '- **The editor kit.**', '- **Files.**',
  '- **Verify items.**', '- **Deviations from the entry.**', '- **Judgement calls.**', '- **Follow-ups.**', '- **Build.**', '- **Worker.**', '- **Lint.**', '- Checks:',
]

describe('REDESIGN_STATUS.md, WS16 part two: page step 4\'s first half, its place and the status line', () => {
  it('sits in the page half\'s part once, after page step 3\'s block, one level under the part\'s heading', () => {
    expect(part).not.toBe('')
    expect(block.length).toBeGreaterThan(5000)
    expect(status.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(part.indexOf(`\n${STEP_THREE}\n`)).toBeGreaterThan(-1)
    expect(part.indexOf(`\n${BLOCK}\n`)).toBeGreaterThan(part.indexOf(`\n${STEP_THREE}\n`))
    expect(blockLines.filter((l) => /^#{1,4} /.test(l))).toEqual([BLOCK])
  })

  it('gives the part\'s status line this half\'s words while page step 4 is the latest', () => {
    for (const piece of ['`redesign/ws16-page`', 'nothing of it is merged']) expect(partStatus, piece).toContain(piece)
    expect(latestPageStep).toBeGreaterThanOrEqual(4)
    if (latestPageStep === 4) {
      expect(partStatus).toBe(
        `${PART_STATUS}three of its twelve steps are built, and the first half of page step 4, the page on a computer, with its second half to follow, on the branch \`redesign/ws16-page\`, cut from \`d2c5ec0\`, the merge of checkpoint M (pull request 126); nothing of it is merged, and no pull request is opened before checkpoint P, the page, is ready, which is after checkpoint N has merged.`,
      )
    }
  })

  it('opens with what this half is, its base and its day, and says the second half follows', () => {
    for (const piece of [
      'Page step 4 is the fourth step of checkpoint P', 'built in two halves, each with its own commit', 'the first half, the page on a computer',
      'built on Friday, November 13, 2026 on `a3a8ff5`, page step 3', 'and finished, after its reviews, on Saturday, November 14, 2026', '`/admin/newsletter`', 'registered only with the switch `mailPage` on, which stays off',
      '`renderNewsletter`', 'The second half follows', 'the tablet, the phone and its sheet, the focus proofs at three widths and the full browser run',
      'Nothing in this half sends an email', 'no file under `functions/`, `domain/`, `workers/` or `migrations/` changes',
    ]) expect(opening, piece).toContain(piece)
  })

  it('holds its parts once each, in order', () => {
    const at = PARTS.map((p) => blockLines.findIndex((l) => l.startsWith(p)))
    for (const [i, p] of PARTS.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const p of PARTS) expect(blockLines.filter((l) => l.startsWith(p)), p).toHaveLength(1)
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: page step 4\'s first half, what it holds', () => {
  it('says what the page holds, who is let in and the room it keeps', () => {
    const text = bullet(block, '- **The page.**')
    for (const piece of [
      '`src/pages/AdminNewsletterPage.tsx`', 'Newsletter-Page-4', '"Draft"', '"Not saved yet"', '"Help, not yet available"', '"Louisiana Chess Association · LCA Newsletter"',
      '"30 of 60 letters"', 'under the field at its right as board P4 draws it, in a line kept for it under the row, so the field keeps its whole width',
      '44 pixels tall', '`aria-pressed`', 'never the browser\'s prompt', '"The email cannot keep that address.', '"A line"', 'held to 40 characters',
      '`letterParts`', '"Write your opening here", "Add what is coming up" and "Add results or club news"', '"Click here to write the next part"', '"Pull to make taller"',
      'held to the board\'s 1200 pixels', 'November 2026', 'K\'s decision 52', '`requireListMailer`', 'an officer without the seat is sent to Admin', '"View only"',
      '"Set up two-factor sign-in to send group email."', 'At 320 pixels wide nothing runs off the side', 'at 200 per cent', 'below 1024 pixels',
      'at 320 pixels its words, wider than the field, scroll inside it; the second half makes the field wrap them on a phone',
      '80 pixels at its foot for page step 5\'s bar, which is 76 pixels tall on the board', '96 pixels clear',
    ]) expect(text, piece).toContain(piece)
    // The Subject's words are not said to be whole at every width: at 320 pixels they scroll inside their field.
    expect(text).not.toContain('nothing is cut off')
  })

  it('says how the letter saves and every word of the saved line', () => {
    const text = bullet(block, '- **Saving.**')
    for (const piece of [
      '`src/areas/admin/newsletter/useIssue.ts`', '2 seconds after the typing pauses', 'One save is on its way at a time', 'the version the answer gave',
      'Nothing is saved when nothing changed', 'id null and version 0', 'never moves the caret or replaces words', 'a request that outlives the page, of at most 60,000 bytes',
      'the browser asks its own question', '"Saving"', '"Saved automatically at 2:15 PM"', '"Saved on Thursday, November 12, 2026 at 2:15 PM"', '"Could not save" with "Try again"',
      '"This letter is too long for one email. Make it shorter, then save again."', '"Player Two changed this letter at 2:17 PM" with "Show their letter"',
      '"Player Two sent this letter at 2:17 PM"', '"Player Two started a new letter at 2:17 PM"', '"Nothing more is saved over their letter."', '"Your words stay here for you to copy."',
      '"Show their letter?"', '"Keep my words"', 'read out politely and a refusal at once', 'A reload keeps the letter.',
      'the pause is stopped as the page goes, so nothing goes off later', 'a page the browser brings back by Back or Forward, read the letter again',
      'when it holds exactly the words this page sent, the page takes that save\'s version and time and goes on saving, saying nothing',
      'the page asks first whenever words are not saved, "Leave this page? Your latest words may not be saved."',
      'after a refusal "Leave this page? Your words on it are not saved, and leaving loses them. Copy anything you want to keep first."',
      'a person who stays keeps the page and their words', 'one inside the letter ask nothing', 'The browser\'s Back within the site asks nothing',
      'after a refusal keeps nothing', 'pressing "Show their letter" tries again', 'every sentence of a refusal from its one region',
      'A page brought back while a save is still on its way waits for that save\'s answer and then sends at once the words typed after it',
      'and for a 400 that names a field, that field\'s own words, such as "Keep the subject to 200 characters."',
      'Log out, in today\'s header and in the new menu\'s My LCA, asks nothing either', 'the save sent as the page is left carries no sign-in, which the server refuses',
      'naming the writer and time of the letter so read when it is the page\'s own letter, since someone may have saved it after the 409 the page met',
      'a 400 or a 413 that brings no words of the server\'s own, an empty body or a page from the edge, is "Could not save" with "Try again", never a status code',
      'a read that fails again takes that sentence off the line while it reads and puts it back, so it is said again',
      'where before it showed "Request failed (400)" or "Request failed (413)" with nothing to press',
    ]) expect(text, piece).toContain(piece)
  })

  it('says what the preview is and what the browser proved of its frame', () => {
    const text = bullet(block, '- **The preview.**')
    for (const piece of [
      '`src/areas/admin/newsletter/SidePreview.tsx`', '"What members will get"', '`renderNewsletter`', '`LIST_FOOTER_WORDS`', 'no person\'s address (K\'s decision 23)',
      'whose sandbox has no allowances', 'never fetched', 'Proved in Chromium', 'did not run', '`about:srcdoc#board-business`', 'made no request',
      'nothing in the frame took the focus by surprise', 'Tab from Hide stops once, on the frame', '400 milliseconds', 'never flashes', '390 and 640 pixels', '"Show the email" stands where Hide was',
      '"155 people will get it"', '"The number of people who will get it could not be read."',
      'when the letter goes back to the email the second frame already holds, loaded, that frame goes on show at once',
      'Undo, a word typed and deleted, Bold put on and taken off, and the month changed and changed back', 'still did 4.5 seconds after Undo',
      'Two things are set on the frame\'s copy of the email, and nothing on the email that is sent', 'every other link\'s address taken off, its look kept by its own style',
      'from 1,021 to 688 pixels', 'each pressed plainly, with Ctrl, with Shift and with the middle button, and by Enter with the link focused by script',
      'opened no tab or window', 'at each link drawn in view at Phone and at Computer', 'not one pixel differs',
      'A jump link keeps its address, which it needs to scroll the frame with no script', 'opened an empty tab or window',
      'the focus goes with the frame coming on show', 'Tab could stop on the preview twice',
      'marked as a link that is not available, `role="link"` with `aria-disabled="true"`, so a screen reader still tells which words are links in the email that is sent',
      'as links marked unavailable, where before it gave them as plain words', '30 presses, opened nothing and asked for nothing', '24 in all',
      'do not differ by one pixel', 'the frame runs no script on purpose',
    ]) expect(text, piece).toContain(piece)
    // The frame's copy no longer gives a link a new window as its target.
    expect(text).not.toContain('a new window as its target')
  })

  it('says where the focus goes and gives the automated check\'s figures and the Tab order', () => {
    const text = bullet(block, '- **Focus.**')
    for (const piece of [
      '`test/unit/admin-newsletter-focus.test.tsx`', '14 states', 'in today\'s look and the new one, at 1440 and at 1280 pixels wide: 56 checks, none with a violation',
      'the same question asking over the letter made bigger', 'which closes the question alone while the letter fills the window',
      'pressed in the letter itself', 'The grip\'s name is its own words, "Pull to make taller"',
      'two moderate findings about landmarks', '17 stops', 'Help is not among them', 'the bright gold is never words on a light ground', 'in the words\' own ink',
      'the focus is back on "Show their letter" and the refusal\'s region says so at once', 'the same again on the finished tree, with a refusal\'s words in one region',
      'Dragging Movements (WCAG 2.2, 2.5.7) is met by a press', 'the 160 pixels Page Down gives', 'takes it to the shortest, 320 pixels',
      'a letter shorter than its first height among them',
      'A pointer that strays less than 10 pixels between going down and being let go is a press', 'a click with no pointer of its own, as a screen reader gives, is a press too',
      'by mouse and by touch', '"732 pixels tall"', 'once more on Saturday, November 14, 2026',
      'a height between those steps needs the keys or a drag', 'After a press the page scrolls by what the letter grew or shrank, at once and never smoothly',
      'so the grip stays under the pointer', 'on the letter made bigger, its own box scrolls the same way', 'is a press too, always from the height as it stands',
      'leaves nothing behind that swallows the next press', 'the one time in 35 presses that the pointer had to move', 'with reduced motion asked for',
      '32 passes where it had 25',
    ]) expect(text, piece).toContain(piece)
    // Presses no longer stop at the first height, under which only a drag reached.
    expect(text).not.toContain('takes it back to its first height')
  })

  it('says what ships with every switch off, and gives the editor kit with the files\' bytes', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of [
      'No route', 'which Admin sends to `/admin`', 'nothing loads while the switch is off', '`getNewsletterIssue` and `saveNewsletterIssue`', 'answers 404', '`MAIL_PAGE_ON`',
      '`--tw-content`', '`--font-serif`', '289 and 296 bytes more', 'types alone from `domain/contracts`', 'no zod', '`test/a11y/baseline.json` is unchanged',
    ]) expect(ships, piece).toContain(piece)
    const kit = bullet(block, '- **The editor kit.**')
    for (const piece of [
      '`@tiptap/extensions`, at 3.28.0', 'one line', 'at 6:29 PM UTC on Friday, November 13, 2026', '233 built files was the base\'s byte for byte, 12,227,651 bytes in all',
      '383,990 bytes', '380,138 bytes', 'with 4,141 left', '`cleanLetterHtml` in the Workers runtime', '27 in all', '`bodyHtml` null', 'begun at 0, or past 9,999',
    ]) expect(kit, piece).toContain(piece)
  })

  it('names every file it adds and changes, each test file with its count of cases', () => {
    const files = bullet(block, '- **Files.**')
    for (const piece of [
      '`src/pages/AdminNewsletterPage.tsx`', '`src/areas/admin/newsletter/NewsletterHead.tsx`', '`src/areas/admin/newsletter/FromSubjectRow.tsx`',
      '`src/areas/admin/newsletter/LetterEditor.tsx`', '`src/areas/admin/newsletter/InThisIssue.tsx`', '`src/areas/admin/newsletter/SidePreview.tsx`',
      '`src/areas/admin/newsletter/CountCard.tsx`', '`src/areas/admin/newsletter/useIssue.ts`', '`test/unit/admin-newsletter-page.test.tsx` (25: ',
      '`test/unit/admin-newsletter-save.test.tsx` (37: ', '`test/unit/admin-newsletter-focus.test.tsx` (21: ', '`test/unit/redesign-status-ws16-p2-step4.test.ts` (15: ',
      '`src/App.tsx`', '`package.json` and `package-lock.json`, one line each', '`test/unit/app-routes.test.tsx` (39, as before), the lazy pages 35 to 36', '`REDESIGN_STATUS.md`',
      'Beyond the step\'s list, nine files', '`src/areas/admin/newsletter/letterRules.ts`', '`test/integration/admin-newsletter-link-rule.test.ts` (38: ',
      '`test/unit/admin-newsletter-edges.test.tsx` (19: ', '`src/areas/admin/api.ts`',
      '`test/unit/goldText.test.ts` (131, as before)', '`test/unit/themeScopes.test.ts` (24, as before)', '`test/unit/brand-edges.test.tsx` (33, as before)',
      '`test/unit/lca-mark.test.tsx` (41, as before)', '`test/unit/mail-newsletter-layout.test.ts` (45, as before)', '`test/unit/route-audit.test.ts`',
      '`test/unit/redesign-status-ws16-p2-step3.test.ts`',
    ]) expect(files, piece).toContain(piece)
  })

  it('answers the verify items and names its deviations, judgement calls and follow-ups', () => {
    const verify = bullet(block, '- **Verify items.**')
    for (const piece of ['The kit\'s placeholder piece', 'a prompt can differ part by part', 'React Router 7 ranks a fixed path over a parameter', '`test/a11y/builds.spec.ts`', 'The page\'s chrome']) {
      expect(verify, piece).toContain(piece)
    }
    const deviations = bullet(block, '- **Deviations from the entry.**')
    for (const piece of [
      'Help is a button the keyboard does not stop on', 'The From box has no list', 'the tools are 28 pixels under From and Subject where the board draws 10',
      '"Made from your headings. Updates by itself."', 'K\'s decision 40', 'Nine files beyond the step\'s list',
    ]) {
      expect(deviations, piece).toContain(piece)
    }
    const calls = bullet(block, '- **Judgement calls.**')
    for (const piece of [
      'as the editor holds it', 'with the Link tool alone', 'the part being typed in outlined', 'The Subject\'s count has its line under the row at all times',
      'only when the letter read again holds its words exactly', 'only when it is pressed inside it', 'over 3 to 1', 'stops at 1200 pixels',
      'with the browser\'s own small question', 'A refusal\'s sentences are in one region',
      'The preview\'s links lose their address in the frame\'s copy alone', 'A press on the grip is a pointer that strays less than 10 pixels',
      'A 400 that names more than one field shows the first field\'s words', 'none of those links can be followed however it is pressed',
      'with no script a jump link needs its address to scroll the frame', 'opens an empty tab or window, which asks for nothing',
      'each is marked as a link that is not available', 'a plain press scrolls inside the frame', 'and that is accepted',
      'After a press the page scrolls by how far the grip moved, measured, not by the step', 'never smoothly, since a smooth scroll would carry the grip from under the pointer',
      'A click whose count of presses is 0 comes from no pointer', 'A 400 or a 413 with no words of the server\'s own is "Could not save" with "Try again"',
      'names the writer and time of that read when the letter is the page\'s own', 'so a failure that repeats is put back and said again',
    ]) expect(calls, piece).toContain(piece)
    // The judgement call says what was proved and no more: the jump links can open an empty tab or window.
    expect(calls).not.toContain('nothing in the preview can be followed however it is pressed')
    const follow = bullet(block, '- **Follow-ups.**')
    for (const piece of [
      'The second half of page step 4', 'the Subject\'s field made to wrap its words on a narrow window', 'Page step 5', 'in the 80 pixels kept for it', '`keepVisible`', 'Page step 6', '`MAIL_PAGE_ON`',
      'a way for Back and Log out to ask before unsaved words are lost', 'the grip\'s press tried on a tablet and a phone',
      'the saved line\'s two regions kept in place when the letter is made bigger or smaller, so a refusal is not read out a second time',
      'a read of their letter tried again after one that failed changing that region once',
      '"Show the email" after Hide showing no empty frame while its first email loads',
      'the page not sending the same refused words again by itself after a 400 or a 413 as it goes and comes back',
    ]) expect(follow, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: page step 4\'s first half, its figures', () => {
  it('gives the build, the worker and the lint against the base, measured first', () => {
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'a local build of the base `a3a8ff5` made first', '239 files in `dist` and 200 in `dist/assets`, against 233 and 194', '12,298,228 bytes in all against 12,227,651',
      '`AdminNewsletterPage-CnUonU-P.js` at 52,321 bytes', '`index-LImbWElX.js` at 554,147 bytes is `index-h4CJPsZR.js` at 555,457',
      '`index-BTmE8w6L.css` at 130,974 is `index-Dnjz0G33.css` at 146,819', 'the other 173 are the base\'s byte for byte',
      '`features-Bz-URkAf.js` at 710 bytes', 'Against the build of the half before its close, two files changed in size', 'the other 177 are the same byte for byte',
      'Against the close\'s own build, before its review, the page\'s chunk changed in size by 720 bytes and the main script by 101',
      'the finished tree\'s on Saturday, November 14, 2026 at 3:28 AM UTC',
    ]) expect(build, piece).toContain(piece)
    const worker = bullet(block, '- **Worker.**')
    for (const piece of [
      '`WRANGLER_HIDE_BANNER=true WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run`', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes',
      'and on the finished tree at 3:36 AM UTC that day', 'byte for byte',
    ]) {
      expect(worker, piece).toContain(piece)
    }
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings over 989 files, 974 on the base')
  })

  it('gives each check once in its checks line, with the base\'s figures', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    for (const piece of [
      '(974 on the base)', '(8,976 in 341 on the base)', '(2,113 in 113 on the base)', '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`', 'from 5:30 PM to 5:56 PM UTC',
      'over 989 files', 'unit 9,095 tests in 346 files', 'integration 2,151 in 114 files', 'from 3:27 AM to 3:36 AM UTC',
    ]) expect(checksLine, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: plain language over page step 4\'s block and the status line', () => {
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
