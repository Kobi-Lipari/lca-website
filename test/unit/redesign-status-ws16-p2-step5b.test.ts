// test/unit/redesign-status-ws16-p2-step5b.test.ts
//
// REDESIGN_STATUS.md records the second of WS16 part two's page step 5's
// three parts: the chooser of templates and past newsletters, the question
// before a letter is replaced, and the first step's wiggle. Like the page
// half's other record tests, this file reads only the WS16 section, and in it
// only two things: the page half's status line, and this part's block, from
// its heading to the next heading of its level or of the part's, whatever a
// later part puts there; it never holds the block to be the last, and it reads
// no count or figure from the code, so the third part, which adds to the page
// and to its test files and moves the page's chunk, moves nothing pinned
// here. Pinned: the block's place, after the first part's block, under a
// heading the page steps' own count passes over; the status line, in this
// part's words while it is the latest; the block's opening; its parts, in
// order; what each part holds; the files, with each test file's count of
// cases as this part left it; the build, worker and lint lines and the checks
// line, each check once with the base's figures; and the plain-language rules
// over the block and the status line.
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
/** A short date the page writes, "Mon, Nov 16, 2026", which carries its weekday in front. */
const SHORT_DAY = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, 20\d\d\b/g
const SHORT_WEEKDAY = /(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/

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
const FIRST_PART = '#### WS16 part two, page step 5, first part: the bar at the foot and More options'
const BLOCK = '#### WS16 part two, page step 5, second part: the chooser, the question before a letter is replaced, and the wiggle'
/** This part's block: from its heading to the next block's heading or the part's end. */
const block = part.includes(`\n${BLOCK}\n`) ? between(part.slice(part.indexOf(`\n${BLOCK}\n`) + 1), BLOCK, '\n#### ') : ''
const blockLines = block.split('\n')
const opening = blockLines[2] ?? ''
const PART_STATUS = '**Status of the page half:** in progress: '
const partStatus = part.split('\n').find((l) => l.startsWith(PART_STATUS)) ?? ''
const checksLine = blockLines.find((l) => l.startsWith('- Checks:')) ?? ''

/** The block's parts, in their order. */
const PARTS = [
  '- **The first step.**', '- **The chooser.**', '- **Nothing is lost.**', '- **The wiggle.**', '- **Focus.**', '- **The browser run.**',
  '- **What ships with every switch off.**', '- **Differences from the board.**', '- **Deviations from the entry.**', '- **Judgement calls.**',
  '- **Follow-ups.**', '- **Files.**', '- **Verify items.**', '- **Build.**', '- **Worker.**', '- **Lint.**', '- Checks:',
]

describe('REDESIGN_STATUS.md, WS16 part two: page step 5\'s second part, its place and the status line', () => {
  it('sits in the page half\'s part once, after the first part\'s block, one level under the part\'s heading', () => {
    expect(part).not.toBe('')
    expect(block.length).toBeGreaterThan(5000)
    expect(status.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(part.indexOf(`\n${FIRST_PART}\n`)).toBeGreaterThan(-1)
    expect(part.indexOf(`\n${BLOCK}\n`)).toBeGreaterThan(part.indexOf(`\n${FIRST_PART}\n`))
    expect(blockLines.filter((l) => /^#{1,4} /.test(l))).toEqual([BLOCK])
    // A part of a page step, so the page steps' own count, which the part's other record tests read, passes over it.
    expect(BLOCK).not.toMatch(/^#### WS16 part two, page step (\d+): /)
  })

  it('gives the part\'s status line this part\'s words while it is the latest', () => {
    for (const piece of ['`redesign/ws16-page`', 'nothing of it is merged']) expect(partStatus, piece).toContain(piece)
    if (!part.includes('\n#### WS16 part two, page step 5, third part: ') && !/^#### WS16 part two, page step (?:[6-9]|1\d): /m.test(part)) {
      expect(partStatus).toBe(
        `${PART_STATUS}four of its twelve steps are built, page step 4 in two halves, the page on a computer and then on a tablet and a phone, and the first two of page step 5's three parts, the bar at the foot and More options, and then the chooser, the question before a letter is replaced and the wiggle, with its third to follow, on the branch \`redesign/ws16-page\`, cut from \`d2c5ec0\`, the merge of checkpoint M (pull request 126), with \`main\` brought in at \`2468da5\`, pull requests 127 to 133, on Tuesday, November 17, 2026; nothing of it is merged, and under K's decision 73, of the same day, a trimmed first version of checkpoint P, the page, is to merge into \`main\` this week, without waiting for the cutover or checkpoint N, to go live for the association's meeting on Thursday, November 19, 2026.`,
      )
    }
  })

  it('opens with what this part is, its base and its day, and what the third part holds', () => {
    for (const piece of [
      'the second of page step 5\'s three parts', 'built on Monday, November 16, 2026 on `a18be7e`, page step 5\'s first part', 'each with its own commit',
      'Help\'s walkthrough, "Add an event", the question for Back and Log out before unsaved words are lost', 'the page\'s full browser run',
      'P12 and P13; K\'s decisions 26, 27, 40, 47 and 51', '"Pick a template to start from"', 'the blank letter, LCA\'s three starters and the last newsletters',
      'the start endpoint that page step 3 built', 'sets the old one aside with its words kept', 'wiggles once, for about a second',
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

describe('REDESIGN_STATUS.md, WS16 part two: what page step 5\'s second part holds', () => {
  it('says the first step is ready, what it opens, and that the bar\'s forms keep their widths', () => {
    const text = bullet(block, '- **The first step.**')
    for (const piece of [
      '`src/areas/admin/newsletter/FootBar.tsx`', '"1 Pick a template to start from"', '"Pick a template"', '`aria-haspopup="dialog"`', '`aria-expanded`',
      'its chevron up from 768 pixels up and none on a phone', 'Steps 2 and 3 stay as the first part drew them', '1104, 886 and 845 pixels of row',
      'moves no focus as it begins',
    ]) expect(text, piece).toContain(piece)
  })

  it('says what the chooser holds, how its last newsletters are read and written, and the forms it takes', () => {
    const text = bullet(block, '- **The chooser.**')
    for (const piece of [
      '`src/areas/admin/newsletter/TemplateChooser.tsx`', 'a dialog named by its head, "Pick a template to start from", with a Close button', '"Blank letter"', '"Just the month\'s band and an empty page."',
      '"Pinned templates"', 'Monthly newsletter, Results and thanks and Short notice', '"Your last newsletters"', '`GET /api/admin/mail/newsletter/issues`',
      'each time it opens and never as the page opens', '"Reading your last newsletters..."', '"Your last newsletters could not be read."', 'Try again', '"None yet."',
      '"Sent Mon, Nov 16, 2026 to 155 members"', 'with a weekday', '`formatDate`', 'Central time', '`formatTime`', '"Set aside by Player One on Mon, Nov 16, 2026 at 2:15 PM"',
      '"Use this: Monthly newsletter"', '2 of 2 alike', 'hidden from a screen reader',
      'From 768 pixels up', '20rem', 'in rem', 'a sheet from the window\'s foot, as the email\'s sheet is', 'The letter open now is never among them',
    ]) expect(text, piece).toContain(piece)
  })

  it('says how nothing is lost: the save first, the question once, the server\'s keeping, the refusals and the round trip', () => {
    const text = bullet(block, '- **Nothing is lost.**')
    for (const piece of [
      'saved first', 'the start waits for that save', '"Replace this letter?"', '"Your words are kept under Your last newsletters."', '"Keep writing"', '"Replace it"',
      '`holdsWords`', 'the server\'s own rule', 'a month\'s label alone is not words', 'sets the open letter aside, its words kept', 'reuses it in place',
      'the month the page is on', '"Started from Monthly newsletter"', 'No new letter was started.', 'Could not start a new letter. Try again in a moment.',
      'no second start', 'the round trip', 'the page puts back the subject of its own of a letter set aside', 'its inbox preview line, which the server leaves on the kept row',
      'what page step 3 built for a letter set aside',
      // The letter read before a start when nothing is unsaved, and the moment that read cannot close.
      'With nothing to save, the page reads the letter first, since the start sends no version', 'the page sends its words as a save at the version it knows, which the server refuses',
      'so nothing is asked or started', '"Checking the letter..."', 'once "Replace it" is pressed it reads the letter again', 'What the read cannot close',
      'a start that carries the version the page read',
      // The close's fix round: the two waits that end after 20 seconds, the second press with nothing typed since, and the
      // started line said once its region is on the page empty.
      'has not answered within 20 seconds', '"Your words are still being saved, so no letter was started. Try again in a moment."',
      '"No new letter was started: someone else has changed, replaced or sent this letter. Close this to see who and when."',
      'a quarter of a second after the new letter is drawn', 'the other person\'s next save is refused as a letter changed by the person who started',
      // The second mend: the save sent to learn who changed the letter, still on its way once the chooser lets go.
      'at a later press made while that save is still on its way', 'words typed then wait behind it and put the saved line on "Saving"',
      'the saved line naming who changed the letter', 'as for any save with no answer',
      // The third mend: a press with nothing typed since, words typed behind that save, the line back on the last save,
      // and the read made after that save's 409.
      'with nothing typed since, which waits for it rather than send another while it is on its way',
      'a press made then says "Saving your words first..."', 'nothing is sent and the line goes back to the last save',
      'nor while the letter is read again after its 409',
    ]) expect(text, piece).toContain(piece)
  })

  it('gives the wiggle\'s measures, its ring with reduced motion and what it never does', () => {
    const text = bullet(block, '- **The wiggle.**')
    for (const piece of [
      'once, for a second', 'only as the page opens on a letter that holds no words', '2 degrees each way', '1,000 milliseconds', 'ease-in-out',
      'nothing beside it moves', 'never again while the page stays open', 'never under the focus', 'reduced motion', 'gold ring', '1.5 seconds',
      'forced colours', 'nothing is stored', '`src/index.css` is unchanged',
    ]) expect(text, piece).toContain(piece)
  })

  it('says where the focus goes as the chooser and the question open and close, and after a start', () => {
    const text = bullet(block, '- **Focus.**')
    for (const piece of [
      'takes the focus itself as it opens', 'Escape, Close and a press outside it', 'gives the focus back to the first step', 'the site\'s root is inert',
      'on "Keep writing"', 'back to the "Use this" that was pressed', 'After a start the focus is on the first step', 'The Tab order with the chooser open',
      'clear of the site\'s header, the bar and the tab bar', '20 and 24 pixels of text',
      'end after 20 seconds', 'for as long as it has no answer', 'each wait for a save', 'about 40 seconds when the read and a save are both slow',
      'at whichever press waits for it with nothing typed since',
    ]) expect(text, piece).toContain(piece)
  })

  it('gives the browser run\'s figures, and what ships with every switch off', () => {
    const run = bullet(block, '- **The browser run.**')
    for (const piece of ['On scratch copies with `mailLists` and `mailPage` on', 'with every outside request refused', 'axe-core', 'no violation', 'wholly in view', 'at least 44 pixels', '200 per cent', '320', 'text spacing', 'forced colours', 'reduced motion', 'to 1', 'pictures 01 to 70']) {
      expect(run, piece).toContain(piece)
    }
    const ships = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['No route: with `mailPage` off, `/admin/newsletter` is Admin\'s own address for a section it does not know', 'which nothing loads while the switch is off', '`npm run check:bundle`', '`test/a11y/baseline.json` is unchanged']) {
      expect(ships, piece).toContain(piece)
    }
  })

  it('names the differences from the board and from the entry, and the follow-ups with their owners', () => {
    const board = bullet(block, '- **Differences from the board.**')
    for (const piece of ['picture 84', 'picture 85', 'Club tournament announcement', 'LCA tournament announcement', '"December 2026, as it is now"', 'K\'s decision 40', '44 by 44 pixels', 'no board draws the chooser open on a phone', 'the question has no board']) {
      expect(board, piece).toContain(piece)
    }
    const entry = bullet(block, '- **Deviations from the entry.**')
    for (const piece of [
      'built in three parts', 'the entry\'s points 2 and 3', '`npm run test:a11y`', '`src/areas/admin/newsletter/NewsletterHead.tsx`', '`test/unit/admin-newsletter-chooser.test.tsx`',
      '`test/unit/admin-newsletter-chooser-edges.test.tsx`', '`test/integration/newsletter-chooser-roundtrip.test.ts`', '`src/index.css`',
    ]) {
      expect(entry, piece).toContain(piece)
    }
    const follow = bullet(block, '- **Follow-ups.**')
    for (const piece of ['This step\'s third part', 'Help', 'the wiggle and Help', 'Page step 6', 'a start that carries the id and version of the letter the page read', 'Checkpoint Q', 'pinning', 'the tournament send-outs', '`src/areas/admin/api.ts`', 'K\'s choice', 'K\'s decision 66', 'a time limit for the start itself']) {
      expect(follow, piece).toContain(piece)
    }
  })

  it('names every file it changes, with each test file\'s count of cases, and those left unchanged', () => {
    const files = bullet(block, '- **Files.**')
    for (const piece of [
      '`src/areas/admin/newsletter/TemplateChooser.tsx`', '`src/areas/admin/newsletter/FootBar.tsx`', '`src/pages/AdminNewsletterPage.tsx`', '`src/areas/admin/newsletter/useIssue.ts`',
      '`src/areas/admin/newsletter/NewsletterHead.tsx`', '`REDESIGN_STATUS.md`',
      '`test/unit/admin-newsletter-chooser.test.tsx` (35', '`test/unit/admin-newsletter-chooser-edges.test.tsx` (34', '`test/integration/newsletter-chooser-roundtrip.test.ts` (5',
      '`test/unit/admin-newsletter-bar.test.tsx` (24', '`test/unit/admin-newsletter-bar-edges.test.tsx` (15', '`test/unit/redesign-status-ws16-p2-step5b.test.ts` (15',
      '`src/areas/admin/newsletter/letterRules.ts`', '`src/areas/admin/newsletter/MoreOptions.tsx`', '`src/index.css`', '`test/unit/redesign-status-ws16-p2-step5.test.ts`', '`src/App.tsx`, the route still under `mailPage`',
    ]) expect(files, piece).toContain(piece)
  })

  it('gives the build, the worker and the lint against the base `a18be7e`, and each check once in the checks line', () => {
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build of the finished tree, compared file by file with a local build of the base `a18be7e` made first', '12,330,877', '`AdminNewsletterPage-BU24m4yT.js` at 77,612', '`features-Bz-URkAf.js` at 710']) {
      expect(build, piece).toContain(piece)
    }
    const worker = bullet(block, '- **Worker.**')
    for (const piece of ['`WRANGLER_HIDE_BANNER=true WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run`', '76.61 KiB, gzip 20.53 KiB, on the base `a18be7e`', '78,449 bytes', 'measured first']) {
      expect(worker, piece).toContain(piece)
    }
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings')
    for (const check of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', '`npm run test:a11y`']) {
      expect(checksLine.split(check), check).toHaveLength(2)
    }
    for (const piece of ['9,218 tests in 352 files', '2,151 in 114 files', '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`', 'every test file that reads `REDESIGN_STATUS.md` was run again after these figures went in']) {
      expect(checksLine, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: page step 5\'s second part, in plain words', () => {
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

  it('gives every day it names its weekday, in the long form and the page\'s short one', () => {
    for (const day of block.matchAll(DAY)) expect(block.slice(Math.max(0, (day.index ?? 0) - 12), day.index), day[0]).toMatch(WEEKDAY)
    for (const day of block.matchAll(SHORT_DAY)) expect(block.slice(Math.max(0, (day.index ?? 0) - 5), day.index), day[0]).toMatch(SHORT_WEEKDAY)
  })
})
