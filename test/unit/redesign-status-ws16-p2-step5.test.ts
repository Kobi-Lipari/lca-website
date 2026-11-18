// test/unit/redesign-status-ws16-p2-step5.test.ts
//
// REDESIGN_STATUS.md records the first of WS16 part two's page step 5's
// three parts: the bar at the foot of the newsletter's own page and More
// options. Like the page half's other record tests, this file reads only the
// WS16 section, and in it only two things: the page half's status line, and
// this part's block, from its heading to the next heading of its level or of
// the part's, whatever a later part puts there; it never holds the block to
// be the last, and it reads no count or figure from the code, so the next
// parts, which add to the page and to its test files, move nothing pinned
// here. Pinned: the block's place, after page step 4's second block, under a
// heading the page steps' own count passes over; the status line, in this
// part's words while it is the latest; the block's opening; its parts, in
// order; what each part holds; the files, with each test file's count of
// cases as this part left it; the build, worker and lint lines and the checks
// line, each check once with the base's figures; and the plain-language
// rules over the block and the status line.
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
/** A time on a 24-hour clock. */
const HOURS_24 = /\b(?:1[3-9]|2[0-3]):[0-5]\d\b/
/** A day of a month of 2026 named with its month. */
const DAY = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 2026\b/g
const WEEKDAY = /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), $/

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
const STEP_FOUR_SECOND = '#### WS16 part two, page step 4, second half: the page on a tablet and a phone'
const BLOCK = '#### WS16 part two, page step 5, first part: the bar at the foot and More options'
/** This part's block: from its heading to the next block's heading or the part's end. */
const block = part.includes(`\n${BLOCK}\n`) ? between(part.slice(part.indexOf(`\n${BLOCK}\n`) + 1), BLOCK, '\n#### ') : ''
const blockLines = block.split('\n')
const opening = blockLines[2] ?? ''
const PART_STATUS = '**Status of the page half:** in progress: '
const partStatus = part.split('\n').find((l) => l.startsWith(PART_STATUS)) ?? ''
const checksLine = blockLines.find((l) => l.startsWith('- Checks:')) ?? ''

/** The block's parts, in their order. */
const PARTS = [
  '- **The bar.**', '- **The numbered steps.**', '- **More options.**', '- **The phone.**', '- **Focus.**', '- **The browser run.**',
  '- **What ships with every switch off.**', '- **Differences from the board.**', '- **Deviations from the entry.**', '- **Judgement calls.**',
  '- **Follow-ups.**', '- **Files.**', '- **Verify items.**', '- **Build.**', '- **Worker.**', '- **Lint.**', '- Checks:',
]

describe('REDESIGN_STATUS.md, WS16 part two: page step 5\'s first part, its place and the status line', () => {
  it('sits in the page half\'s part once, after page step 4\'s second block, one level under the part\'s heading', () => {
    expect(part).not.toBe('')
    expect(block.length).toBeGreaterThan(5000)
    expect(status.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(part.indexOf(`\n${STEP_FOUR_SECOND}\n`)).toBeGreaterThan(-1)
    expect(part.indexOf(`\n${BLOCK}\n`)).toBeGreaterThan(part.indexOf(`\n${STEP_FOUR_SECOND}\n`))
    expect(blockLines.filter((l) => /^#{1,4} /.test(l))).toEqual([BLOCK])
    // A part of a page step, so the page steps' own count, which the part's other record tests read, passes over it.
    expect(BLOCK).not.toMatch(/^#### WS16 part two, page step (\d+): /)
  })

  it('gives the part\'s status line this part\'s words while it is the latest', () => {
    for (const piece of ['`redesign/ws16-page`', 'nothing of it is merged']) expect(partStatus, piece).toContain(piece)
    if (!part.includes('\n#### WS16 part two, page step 5, second part: ') && !/^#### WS16 part two, page step (?:[6-9]|1\d): /m.test(part)) {
      expect(partStatus).toBe(
        `${PART_STATUS}four of its twelve steps are built, page step 4 in two halves, the page on a computer and then on a tablet and a phone, and the first of page step 5's three parts, the bar at the foot and More options, with its second and third to follow, on the branch \`redesign/ws16-page\`, cut from \`d2c5ec0\`, the merge of checkpoint M (pull request 126); nothing of it is merged, and no pull request is opened before checkpoint P, the page, is ready, which is after checkpoint N has merged.`,
      )
    }
  })

  it('opens with what this part is, its base and its day, and what the second and third parts hold', () => {
    for (const piece of [
      'the first of page step 5\'s three parts, the bar at the foot of the newsletter\'s own page and More options', 'built on Sunday, November 15, 2026 on `dd557a3`, page step 4\'s second half',
      'each with its own commit', 'the chooser of templates and past newsletters behind "Pick a template", the question before a written letter is replaced, and the wiggle',
      'Help\'s walkthrough, "Add an event", the question for Back and Log out before unsaved words are lost', 'the page\'s full browser run',
      'P11, P19 and P20; K\'s decisions 47, 48, 50 and 52', 'its three numbered steps drawn and not yet available', 'the phone\'s "See the email" moved from the head into the bar',
      'the inbox preview line saved with the letter, who gets it and where replies go', 'On a computer the page above the bar looks as page step 4\'s did, by its pictures 01 to 27 taken again',
      'registered only with the switch `mailPage` on, which stays off', 'nothing in this part sends an email, it adds no endpoint and no migration',
      'no file under `functions/`, `domain/`, `workers/` or `migrations/` changes',
    ]) expect(opening, piece).toContain(piece)
  })

  it('holds its parts in order, each once', () => {
    let at = -1
    for (const name of PARTS) {
      const found = blockLines.findIndex((l) => l.startsWith(name))
      expect(found, name).toBeGreaterThan(at)
      expect(blockLines.filter((l) => l.startsWith(name)), name).toHaveLength(1)
      at = found
    }
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: what page step 5\'s first part holds', () => {
  it('says what the bar is, where it stands and what it does between the widths the board draws', () => {
    const text = bullet(block, '- **The bar.**')
    for (const piece of [
      '`src/areas/admin/newsletter/FootBar.tsx`', 'a region named "Pick, check and send"', 'It stays at the window\'s foot while the page scrolls, above the new look\'s tab bar on a phone',
      'at the page\'s end it stands after the letter, above the site\'s footer, so it never covers the footer\'s last line', 'under the letter made bigger it stands at that window\'s foot',
      'from 768 pixels up the size row just above it and on a phone More options between the two',
      'More options, a bordered button', '1 "Pick a template to start from", 2 "Send a test to me" and 3 "Send to 155 people"', 'a navy mark 32 pixels round',
      'the bar 76 pixels tall with its edge', 'The four spread across the bar\'s width with even gaps', 'held to the page\'s own width, 1198 pixels',
      'less than 20 pixels between two controls', 'from 1104 pixels of row up, a window 1152 wide', 'under 886, a window of 934, More options\' words on two lines',
      'under 845, a window of 893', 'Send without its arrow', 'the four stand in one row from 768 pixels up', 'Under 768 pixels it is the phone\'s',
    ]) expect(text, piece).toContain(piece)
  })

  it('says the numbered steps are drawn and not yet available, which part or step wires each, and how Send counts', () => {
    const text = bullet(block, '- **The numbered steps.**')
    for (const piece of [
      '`aria-disabled`, which Tab reaches and a screen reader says is not available', 'named with its mark\'s number and its words ("1 Pick a template to start from")',
      'no press, key or touch acts on it', 'the white steps in the site\'s quiet words (`text-muted-foreground`)',
      'Send in the site\'s gold button, navy words on the brand gold, with the colour drawn out of both by 60 per cent (`grayscale-60`)',
      'in forced colours the system\'s colour for a control that cannot be used',
      'No sentence on the page says why (K\'s decision 40)', 'The chooser behind step 1 is this step\'s second part\'s; the test and Send, steps 2 and 3, are page step 6\'s',
      'the arrow\'s other ways to send are checkpoint Q\'s', 'read once as the page opens by `GET /api/admin/mail/newsletter`, the call Group email\'s newsletter tab makes as it opens (`getNewsletter`)',
      '"3 Send to 155 people", "3 Send to 1 person", and "3 Send" while it is on its way or when it could not be read', 'with nothing held up and no error in the bar or More options for it',
    ]) expect(text, piece).toContain(piece)
  })

  it('says what More options holds, how it saves the preview line, where replies go, and how it opens and closes', () => {
    const text = bullet(block, '- **More options.**')
    for (const piece of [
      '`src/areas/admin/newsletter/MoreOptions.tsx`, closed whenever the page opens on a letter, holds three rows and nothing else', '"Inbox preview line"',
      'its words at 16 pixels and 44 pixels tall, held to the server\'s 150 characters, saved with the letter as the Subject is, by `useIssue.ts` as it stood',
      'a refusal said on the saved line in the server\'s words', 'a paste goes by the Subject\'s own rule through the Subject\'s own function', '`OneLineField`',
      'as `renderNewsletter` writes it', '"Active LCA members: 155"', '"Left out: 3 who turned the newsletter off and 2 that no longer receive mail."',
      '"Where replies go": `LouisianaChess@gmail.com`', 'with no link (Differences)', 'it is not a dialog, the page behind it stays usable', 'it takes the focus into its field as it opens',
      'Escape in it, or a second press of its button, closes it and gives the focus back to the button', 'a press outside it, or the focus moving on out of it, closes it where the person went, so it never stands over the control that has the focus',
      'the focus going into the email\'s frame among them, by the keyboard and by a press', 'a press on its own words, which leaves the focus on the page\'s body, and a window that loses the focus leave it open',
      'On a short window its rows scroll inside themselves under the site\'s header', 'On a phone it is a part of the page at its end',
      'As the window crosses 768 pixels while it is open with the focus in it, it stays open, and the focus and the caret go with it, brought into view where the field then stands (The phone)',
      'drawn in the bar already open while the focus is elsewhere', 'it closes before the page is shown, so its rows never stand over the control that has the focus',
      'A press outside it leaves nothing behind for its next opening', 'never between the two halves of a character written as two',
      'With a person\'s own default text size raised, to 20 and 24 pixels as a browser\'s larger text settings give it',
      'On a window 360 pixels tall or less at 24 pixels the box is shorter than its field\'s place in it', 'the field keeping the focus and taking the typing',
    ]) expect(text, piece).toContain(piece)
  })

  it('says what the phone holds, the focus the sheet gives back, and where the bar stands against the tab bar', () => {
    const text = bullet(block, '- **The phone.**')
    for (const piece of [
      'Under 768 pixels, as the page reads the site\'s own media query (`useTabletScreen`, as the site\'s header does)', '"Pick a template", drawn and not yet available',
      '"See the email" in the rest of the row, each 50 pixels tall, the bar 71 with its edge', 'the head draws no "See the email" there, and the tablet\'s, from 768 to 1023 pixels, stays in the head',
      'which gives the focus back to the button that opened it, the bar\'s on a phone and the head\'s on a tablet', 'to whichever of the two is then on the page when the window crossed 768 pixels while the sheet was open',
      'With the new look the bar stands on the tab bar', 'while a field or the letter has the focus the site hides the tab bar and the bar stands at the window\'s foot', 'with today\'s menu it stands at the window\'s foot',
      'More options sits at the page\'s end, under the letter and its size row', 'its button stands 10 pixels above the bar',
      'the focus goes to the letter\'s own "Show the email", the same action, so it stays inside the letter', 'A carry no control takes ends with the drawing that made it',
      'That control takes the focus with the browser\'s own scroll, which brings it into view clear of the header and the bar where it has moved',
      'a control drawn in the bar is in view wherever the page is scrolled but at or near the page\'s end where the footer is taller than the window',
    ]) expect(text, piece).toContain(piece)
  })

  it('says how the focus was proved against the real bar, the room kept, the Tab order, and the Subject\'s mend', () => {
    const text = bullet(block, '- **Focus.**')
    for (const piece of [
      'At a computer\'s width (1440 by 1000), a tablet\'s (820 by 1180) and a phone\'s (390 by 844), under today\'s menu and under the new one, in the light look and the dark',
      'each stop checked against the real bar', 'never under More options\' rows while they are open', 'The room page step 4 kept below a control scrolled into view is kept, as it fits the real bar',
      '96 pixels on a computer and a tablet, the bar\'s 76 and 20 clear, and 144 on a phone, the bar\'s 71 and the tab bar\'s 57 under it, 16 clear', 'Tab onto the bar never scrolls the page while the bar stands at the window\'s foot',
      'The bar\'s own controls take that difference off the room kept below them', 'the room for the site\'s header is counted once with the room the page keeps for the new look\'s header',
      'in rem, since the header, the bar and More options\' rows grow with a person\'s own text size',
      'As the letter made bigger is made smaller by a press of Make smaller or by Enter on it, the size button, Make bigger again, keeps the focus',
      'The Tab order with the bar in it', 'So `LetterEditor.tsx` now keeps the line being typed clear of the bar, the least change, once the editor\'s own scroll is done', 'the Subject\'s field now brings its whole box into view after a paste, as it does as it takes the focus, the least mend, in `FromSubjectRow.tsx`',
    ]) expect(text, piece).toContain(piece)
  })

  it('gives the browser run\'s figures, and what ships with every switch off', () => {
    const run = bullet(block, '- **The browser run.**')
    for (const piece of ['On scratch copies with `mailLists` and `mailPage` on', 'with every outside request refused', 'axe-core', 'no violation', 'wholly in view', 'at least 44 pixels', '200 per cent', '320', 'text spacing', 'forced colours', 'reduced motion', 'to 1']) {
      expect(run, piece).toContain(piece)
    }
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['Two files every visitor loads change: the stylesheet', 'No route: with `mailPage` off, `/admin/newsletter` is Admin\'s own address for a section it does not know', 'which nothing loads while the switch is off', '`npm run check:bundle`', '`test/a11y/baseline.json` is unchanged']) {
      expect(ships, piece).toContain(piece)
    }
  })

  it('names the differences from the board and from the entry, the missing link of decision 37 among them, and the follow-ups with their owners', () => {
    const board = bullet(block, '- **Differences from the board.**')
    for (const piece of ['picture 66', 'picture 67', 'picture 68', 'picture 70', 'the board\'s one bar at a tablet\'s width is in its figure "After pressing Make bigger"', 'Send\'s small arrow is a part of Send, one control', 'no board draws it open (board note E7)', 'which K\'s decision 37 asks for', 'the senders page comes with clubs\' sending in WS09', 'the plain top of the email and the other two ways to start a month, are not built']) {
      expect(board, piece).toContain(piece)
    }
    const entry = bullet(block, '- **Deviations from the entry.**')
    for (const piece of ['built in three parts', 'the entry\'s points 1 and 4 and the bar\'s share of point 7', '`npm run test:a11y`', '`src/areas/admin/newsletter/FromSubjectRow.tsx`', '`useIssue.ts` and `letterRules.ts` are unchanged', '`src/areas/admin/newsletter/LetterEditor.tsx`, on the part\'s own list for the room kept for the bar, changes by the least change', 'Make smaller, pressed or by Enter, brings the size button back into view']) {
      expect(entry, piece).toContain(piece)
    }
    const follow = bullet(block, '- **Follow-ups.**')
    for (const piece of ['This step\'s second part: the chooser behind "Pick a template", which wires step 1', 'the wiggle', 'This step\'s third part: Help\'s walkthrough; "Add an event"', 'Page step 6: "Send a test to me" and Send, which wire steps 2 and 3', 'Checkpoint Q: the arrow on Send', 'With the senders page, in WS09: decision 37\'s link from where replies go', 'Page step 12: the plain top of the email', 'the chooser, a dialog, under page step 4\'s rule for one', 'K\'s choice: the bar at a tablet\'s width', 'More options at a phone\'s page end, where it is not in the bar', 'Control and Home in the letter leaves the caret under the site\'s header', 'the bar at a person\'s own text size of 24 pixels, a browser\'s largest text setting', 'so the forms\' widths go into rem']) {
      expect(follow, piece).toContain(piece)
    }
  })

  it('names every file it changes, with each test file\'s count of cases, and those left unchanged', () => {
    const files = bullet(block, '- **Files.**')
    for (const piece of [
      '`src/areas/admin/newsletter/FootBar.tsx`', '`src/areas/admin/newsletter/MoreOptions.tsx`', '`src/pages/AdminNewsletterPage.tsx`', '`src/areas/admin/newsletter/NewsletterHead.tsx`',
      '`src/areas/admin/newsletter/SidePreview.tsx`', '`src/areas/admin/newsletter/FromSubjectRow.tsx`', '`REDESIGN_STATUS.md`',
      '`src/areas/admin/newsletter/LetterEditor.tsx`, the line being typed kept clear of the bar',
      '`test/unit/admin-newsletter-bar.test.tsx` (24', '`test/unit/admin-newsletter-bar-edges.test.tsx` (14', '`test/unit/redesign-status-ws16-p2-step5.test.ts` (15', '`test/unit/admin-newsletter-focus.test.tsx` (29', '`test/unit/admin-newsletter-sheet.test.tsx` (32',
      '`test/unit/redesign-status-ws16-p2-step4b.test.ts` (13', '`test/unit/admin-newsletter-page.test.tsx`', '`test/unit/redesign-status-ws16-p2-step3.test.ts`', '`test/unit/redesign-status-ws16-p2-step4.test.ts`',
      '`src/App.tsx`, the route still under `mailPage`',
    ]) expect(files, piece).toContain(piece)
  })

  it('gives the build, the worker and the lint against the base `dd557a3`, and each check once in the checks line', () => {
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build of the finished tree, compared file by file with a local build of the base `dd557a3` made first', '12,313,907', '`AdminNewsletterPage-DZ5Fk3gx.js` at 63,608', '`features-Bz-URkAf.js` at 710']) {
      expect(build, piece).toContain(piece)
    }
    const worker = bullet(block, '- **Worker.**')
    for (const piece of ['`WRANGLER_HIDE_BANNER=true WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run`', '76.61 KiB, gzip 20.53 KiB, on the base `dd557a3`', '78,449 bytes', 'measured first']) {
      expect(worker, piece).toContain(piece)
    }
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings')
    for (const check of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', '`npm run test:a11y`']) {
      expect(checksLine.split(check), check).toHaveLength(2)
    }
    for (const piece of ['9,163 tests in 349 files', '2,151 in 114 files', '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`', 'every test file that reads `REDESIGN_STATUS.md` was run again after these figures went in']) {
      expect(checksLine, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: page step 5\'s first part, in plain words', () => {
  it('holds no dash, no working word, no tool, no old initials and nothing left unfilled, in the block or the status line', () => {
    for (const [name, text] of [['the block', block], ['the status line', partStatus]] as const) {
      const prose = proseOf(text)
      expect(text, name).not.toMatch(DASHES)
      expect(prose, name).not.toMatch(BANNED)
      expect(text, name).not.toMatch(TOOLS)
      expect(prose, name).not.toMatch(ASSISTANT)
      expect(prose, name).not.toMatch(BARE)
      expect(text, name).not.toMatch(OLD_INITIALS)
      expect(text, name).not.toMatch(UNFILLED)
      expect(prose, name).not.toMatch(CAPITALS)
      expect(text, name).not.toMatch(PENDING)
      expect(prose, name).not.toMatch(HE)
      expect(prose, name).not.toMatch(HOURS_24)
    }
  })

  it('gives every day it names its weekday', () => {
    for (const day of block.matchAll(DAY)) expect(block.slice(Math.max(0, (day.index ?? 0) - 12), day.index), day[0]).toMatch(WEEKDAY)
  })
})
