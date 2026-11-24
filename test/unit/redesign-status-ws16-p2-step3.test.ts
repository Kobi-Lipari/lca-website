// test/unit/redesign-status-ws16-p2-step3.test.ts
//
// REDESIGN_STATUS.md records WS16 part two's page step 3, the letter's
// storage and saving, and opens the page half's part of the record inside
// the WS16 section, under its one heading, with a block for each of page
// steps 1 to 3. Like WS16's other record tests, this file reads only the
// WS16 section, from its heading to the Phase 0 heading, and in it only the
// page half's part, from its heading to the next heading of the section's
// level, and the date at the start of the date line; it reads no count or
// figure from the code. Pinned here: the part's place by what stands before
// it, checkpoint M's section, and never by its being the last; its status
// line, in this step's words while this step is the latest; the three
// blocks, each once and in order, under the part; this step's block, its
// parts in order, its files with their counts, its figures and its checks
// line, each figure once; its judgement calls, and its follow-ups, each said
// once with the step that owns it; page steps 1 and 2's blocks by their
// notes' figures; WS16's own Status line left as written; the plain-language
// rules over everything the part holds; and the date, any real day from
// Friday, November 13, 2026 on. The step's new files are read only to find
// them and to hold them to the plain-language rules.
import { existsSync, readFileSync } from 'node:fs'
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
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

const HEADING = '## WS16: Mail (the mail engine, lists and the LCA newsletter)'
/** The WS16 section, from its heading to the Phase 0 heading. */
const ws16 = between(status, `\n${HEADING}\n`, '\n## Phase 0:')
const PART = '### WS16 part two: the newsletter\'s own page'
const CHECKPOINT_M = '### Checkpoint M: WS16 steps 1 to 8'
const LISTS = ['### WS16 decisions', '### WS16 deviations from the brief', '### WS16 verify items resolved', '### WS16 follow-ups']
/** The page half's part: from its heading to the next heading of the section's level, whatever a later step puts there. */
const part = ws16.includes(`\n${PART}\n`) ? between(ws16.slice(ws16.indexOf(`\n${PART}\n`) + 1), PART, '\n### ') : ''
const partLines = part.split('\n')
const BLOCKS = [
  '#### WS16 part two, page step 1: the letter\'s rules and its cleaner',
  '#### WS16 part two, page step 2: the navy look',
  '#### WS16 part two, page step 3: the letter\'s storage and saving',
]
/** A block of the part: from its heading to the next block's heading or the part's end. */
const blockOf = (heading: string) => (part.includes(`\n${heading}\n`) ? between(part.slice(part.indexOf(`\n${heading}\n`) + 1), heading, '\n#### ') : '')
const [stepOne, stepTwo, block] = BLOCKS.map(blockOf)
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
/** The part's own status line, which starts in words other than WS16's own Status line, so a reader of that line finds WS16's first. */
const PART_STATUS = '**Status of the page half:** in progress: '
const partStatus = partLines.find((l) => l.startsWith(PART_STATUS)) ?? ''
/** The highest page step with a block in the part: this step's words of the status line hold only while it is the latest. */
const latestPageStep = Math.max(0, ...[...part.matchAll(/^#### WS16 part two, page step (\d+): /gm)].map((m) => Number(m[1])))
/** The date at the start of the date line, the one piece of that line a step writes. */
const date = /^Last updated: (\d{4})-(\d{2})-(\d{2}) \(/.exec(status.split('\n').find((l) => l.startsWith('Last updated:')) ?? '')

/** WS16's own Status line, as every step of part one keeps its prefix. */
const WS16_STATUS_PREFIX =
  '**Status:** in progress: part one, the mail engine and the first LCA newsletter, twelve steps in three checkpoints (checkpoint M for steps 1 to 8, checkpoint N for steps 9 to 11, checkpoint O for step 12); '

/** The files this step adds. */
const NEW_FILES = [
  'migrations/0061_newsletter_issues.sql', 'drizzle/meta/0010_snapshot.json', 'functions/utils/mail/issues.ts', 'functions/api/admin/mail/newsletter/issue.ts',
  'functions/api/admin/mail/newsletter/issue/start.ts', 'functions/api/admin/mail/newsletter/issues.ts', 'domain/contracts/newsletter.ts',
  'test/unit/migration-0061-newsletter-issues.test.ts', 'test/integration/newsletter-issues.test.ts', 'test/integration/contracts/newsletter-issues.test.ts',
  'test/unit/redesign-status-ws16-p2-step3.test.ts',
]
/** The new test files beyond the step's list, written after the build to hold the methods' edges, each with its count. */
const NEW_BEYOND = ['test/unit/newsletter-issues-rules.test.ts', 'test/integration/newsletter-issues-edges.test.ts']
const NEW_TESTS = [...NEW_FILES, ...NEW_BEYOND].filter((f) => /\.test\.ts$/.test(f))
const NEW_CODE = [...NEW_FILES, ...NEW_BEYOND].filter((f) => /\.ts$/.test(f))
/** The files of code, data and record this step changes. */
const CHANGED = [
  'functions/db/schema.ts', 'drizzle/meta/_journal.json', 'src/lib/features.ts', 'functions/utils/mail/switches.ts', 'domain/contracts/index.ts',
  'domain/contracts/registry.ts', 'src/areas/admin/api.ts', 'test/unit/fixtures/api-added-since-split.json', 'REDESIGN_STATUS.md',
]
/** The test files of the step's list it changes, each with its count. */
const CHANGED_TESTS = [
  'test/unit/features.test.ts', 'test/unit/mail-switches.test.ts', 'test/unit/redesign-status-ws02-step2.test.ts', 'test/unit/schema-drift.test.ts',
  'test/unit/drizzle-baseline.test.ts', 'test/unit/db-generate-guard.test.ts', 'test/unit/db-generate-real-kit.test.ts', 'test/unit/seed-fixtures.test.ts',
]
/** The files beyond the step's list that a test or a rule asked to change, each with its count where it is a test. */
const BEYOND = [
  'migrations/README.md', 'test/unit/migration-safety.test.ts', 'test/unit/routes.test.ts', 'test/unit/api-split-modules.test.ts',
  'test/integration/media-manager-reach.test.ts', 'test/unit/redesign-status-ws16-step1.test.ts', 'test/unit/redesign-status-ws16-step2.test.ts',
  'test/unit/redesign-status-ws16-step3.test.ts', 'test/unit/redesign-status-ws16-step4.test.ts', 'test/unit/redesign-status-ws16-step5.test.ts',
  'test/unit/redesign-status-ws16-step6.test.ts', 'test/unit/redesign-status-ws16-step7.test.ts', 'test/unit/redesign-status-ws16-step8.test.ts',
]
/** The tests that gain cases with no change of their own. */
const GROWN = ['test/unit/domain-boundaries.test.ts', 'test/unit/route-audit.test.ts', 'test/unit/test-setup.test.ts']

describe('REDESIGN_STATUS.md, WS16 part two: the page half\'s part', () => {
  it('sits inside the WS16 section once, under its one heading, after checkpoint M\'s section and before the four lists', () => {
    expect(ws16).not.toBe('')
    expect(status.split(`\n${PART}\n`)).toHaveLength(2)
    expect(ws16.split(`\n${PART}\n`)).toHaveLength(2)
    const at = [CHECKPOINT_M, PART, LISTS[0]].map((h) => ws16.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // The part's blocks are one level under its heading, so it holds no heading of the section's own level.
    expect(partLines.filter((l) => l.startsWith('### '))).toEqual([PART])
    expect(partLines.filter((l) => l.startsWith('## '))).toEqual([])
  })

  it('opens with its own status line, in words that are true while this step is the latest, and leaves WS16\'s own Status line as written', () => {
    expect(partLines[2]).toBe(partStatus)
    for (const piece of ['`redesign/ws16-page`', 'nothing of it is merged']) expect(partStatus, piece).toContain(piece)
    expect(latestPageStep).toBeGreaterThanOrEqual(3)
    if (latestPageStep === 3) {
      expect(partStatus).toBe(
        `${PART_STATUS}three of its twelve steps are built, on the branch \`redesign/ws16-page\`, cut from \`d2c5ec0\`, the merge of checkpoint M (pull request 126); nothing of it is merged, and no pull request is opened before checkpoint P, the page, is ready, which is after checkpoint N has merged.`,
      )
    }
    const ws16Status = ws16.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''
    expect(ws16Status.startsWith(WS16_STATUS_PREFIX)).toBe(true)
    expect(ws16.indexOf(ws16Status)).toBeLessThan(ws16.indexOf(`\n${PART}\n`))
    expect(partLines.filter((l) => /^\*\*(?:Status|Branch|PR):\*\*/.test(l))).toEqual([])
  })

  it('says what the page half is, where its plan is, its three checkpoints and its fences', () => {
    const opening = partLines[4] ?? ''
    for (const piece of [
      '`/admin/newsletter`', 'Newsletter-Page-4', 'Newsletter-Email-6', 'K\'s decision 54', '`docs/redesign/ws16-p2-plan.md`', '`redesign/docs-phase2`',
      'checkpoint P, the page, steps 1 to 6', '`mailPage`', '`MAIL_PAGE_ON`', 'checkpoint Q, sending later, steps 7 to 9', 'steps 10 to 12, after checkpoint O',
      '`src/pages/AdminEmailPage.tsx`', '`src/pages/AdminPage.tsx`', '`functions/utils/mail/lists.ts`', '`functions/utils/admin/campaigns.ts`',
    ]) expect(opening, piece).toContain(piece)
  })

  it('holds a block for each of page steps 1 to 3, each once and in order, under the part', () => {
    const at = BLOCKS.map((h) => part.indexOf(`\n${h}\n`))
    for (const [i, h] of BLOCKS.entries()) expect(at[i], h).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const h of BLOCKS) expect(part.split(`\n${h}\n`), h).toHaveLength(2)
    for (const text of [stepOne, stepTwo, block]) expect(text.length).toBeGreaterThan(1000)
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: page steps 1 and 2\'s blocks, by their notes', () => {
  it('gives page step 1 its commit, its two files and tests with their counts, and its figures', () => {
    expect(stepOne.split('\n')[2].startsWith('Page step 1 is the first step of checkpoint P, committed as `19c181b` on Thursday, November 12, 2026, on `d2c5ec0`.')).toBe(true)
    const files = bullet(stepOne, '- **Files.**')
    for (const piece of ['`domain/mail/letter.ts`', '`functions/utils/mail/letterClean.ts`', '`test/unit/mail-letter.test.ts` (25: ', '`test/integration/mail-letter-clean.test.ts` (200: ', '`test/unit/domain-boundaries.test.ts` (51, 50 before']) {
      expect(files, piece).toContain(piece)
    }
    for (const piece of ['`index-rLaj86fe.js` at 554,147 bytes', '`index-BTmE8w6L.css` at 130,974 bytes', '`features-DxqQlIon.js` at 698 bytes', '232 files in `dist`, 194 of them in `dist/assets`']) {
      expect(bullet(stepOne, '- **Build.**'), piece).toContain(piece)
    }
    expect(bullet(stepOne, '- **Worker.**')).toContain('76.61 KiB, gzip 20.53 KiB, on the base `d2c5ec0`, its `index.js` 78,449 bytes')
    const checks = stepOne.split('\n').find((l) => l.startsWith('- Checks of page step 1:')) ?? ''
    for (const piece of ['over 960 files (956 on the base)', 'unit 8,838 tests in 337 files (8,812 in 336 on the base)', 'integration 2,017 in 109 files (1,817 in 108 on the base)', '659 that run and 336 that skip']) {
      expect(checks, piece).toContain(piece)
    }
    for (const piece of ['- **The letter\'s rules.**', '- **The cleaner.**', '- **What ships with every switch off.** Nothing a visitor or a member meets', '- **Judgement calls.**', '- **Follow-ups.**']) {
      expect(stepOne, piece).toContain(piece)
    }
  })

  it('gives page step 2 its commit, its files and tests with their counts, and its figures', () => {
    expect(stepTwo.split('\n')[2].startsWith('Page step 2 is the second step of checkpoint P, committed as `1660379` on Friday, November 13, 2026, on `19c181b`.')).toBe(true)
    const files = bullet(stepTwo, '- **Files.**')
    for (const piece of [
      '`domain/mail/footer.ts`', '`domain/mail/newsletterLayout.ts`', '`public/email-rook.png`', '`test/unit/mail-newsletter-layout.test.ts` (45: ',
      '`test/integration/mail-newsletter-layout-cleaned.test.ts` (7: ', '`test/unit/fixtures/newsletter-navy.html`', '`test/unit/mail-footer.test.ts` (21, as before)',
      '`test/unit/domain-boundaries.test.ts` (52, 51 before)',
    ]) expect(files, piece).toContain(piece)
    expect(bullet(stepTwo, '- **Size.**')).toContain('renders at 87,816 bytes, 14,184 under 102,000')
    expect(bullet(stepTwo, '- **Build.**')).toContain('233 files in `dist`, one more than the base\'s 232, `dist/email-rook.png`')
    expect(bullet(stepTwo, '- **Worker.**')).toContain('76.61 KiB, gzip 20.53 KiB, on the base `19c181b`, its `index.js` 78,449 bytes')
    const checks = stepTwo.split('\n').find((l) => l.startsWith('- Checks of page step 2:')) ?? ''
    for (const piece of ['over 963 files (960 on the base)', 'unit 8,884 tests in 338 files (8,838 in 337 on the base)', 'integration 2,024 in 110 files (2,017 in 109 on the base)']) {
      expect(checks, piece).toContain(piece)
    }
    expect(bullet(stepTwo, '- **What ships with every switch off.**')).toContain('Nothing a visitor or a member meets, but one new image at `/email-rook.png` that no page links to')
  })
})

describe('REDESIGN_STATUS.md, WS16 part two, page step 3: the block', () => {
  it('opens with what the step is, on what, and that nothing sends', () => {
    expect(block.split('\n')[2].startsWith('Page step 3 is the third step of checkpoint P, built on Friday, November 13, 2026 on `1660379`, page step 2.')).toBe(true)
    expect(block.split('\n')[2]).toContain('Nothing in this step sends, schedules or shows anything')
  })

  it('has every part, in order, each a bullet of its own, and one checks line', () => {
    const parts = [
      '- **The migration.**', '- **Saving.**', '- **Starting a letter.**', '- **The open letter and the last letters.**', '- **Who may.**', '- **The switch.**',
      '- **What ships with every switch off.**', '- **The contracts.**', '- **The page\'s side.**', '- **The cleaner\'s cross-check.**', '- **Deviations from the entry.**',
      '- **Files.**', '- **Verify items.**', '- **Judgement calls.**', '- **Follow-ups.**', '- **Lint.**', '- **Build.**', '- **Worker.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(block.split('\n').filter((l) => l.startsWith('- Checks:'))).toHaveLength(1)
  })

  it('gives the migration its one table, its one index, no mark of a test, its readers and its member columns\' rule', () => {
    const migration = bullet(block, '- **The migration.**')
    for (const piece of [
      '`migrations/0061_newsletter_issues.sql`', '`npm run db:generate -- newsletter issues`', 'staged as `drizzle/0010_newsletter_issues.sql`', '`drizzle/meta/0010_snapshot.json`',
      'the journal\'s eleventh entry', 'the generator made none', 'twenty columns', '`newsletter_issues_one_open`', '`campaign_id IS NULL AND set_aside_at IS NULL`',
      'No CHECK, no table rebuilt, no data statement and no other table changed', '`send_at`, `scheduled_by`, `scheduled_at`, `link_check` and `held_reason` in page step 7',
      '`pinned_at` and `pinned_name` in page step 9', 'no mark of a test (K\'s decision 56, answer 4)', 'run a second time stops at its first statement',
      '`test/unit/migration-0061-newsletter-issues.test.ts`', 'ON DELETE SET NULL', '`functions/api/admin/members/[id].ts`', 'closing an account neither fails on this table nor leaves a name',
      '`test/unit/migration-safety.test.ts`', '19 to 22',
    ]) expect(migration, piece).toContain(piece)
  })

  it('gives the save its order of refusals, its one statement, the cleaner\'s own output and its 409 with who and when', () => {
    const saving = bullet(block, '- **Saving.**')
    for (const piece of [
      '`{ id, version, monthLabel, subject, preheader, bodyHtml }`', '`parseBody`', '240,000 bytes', 'three times `LETTER_MAX_BYTES`', '413 before it is cleaned',
      '`cleanLetterHtml`', 'a cleaned letter whose first heading is a smaller one', '`id = ? AND version = ? AND campaign_id IS NULL AND set_aside_at IS NULL`',
      'moves the version by one', 'NOT EXISTS', 'What is stored is always the cleaner\'s own output, never the input.', '`{ id, version, savedAt, bodyHtml }`',
      '409 `{ error, reason, changedBy, changedAt }`', '`\'sent\'`', '`\'set_aside\'`', 'Two first saves at once make one letter', 'A refused save writes nothing',
      '`full_name`', '`storedTimestampSchema`', '200 characters', '`subjectSchema` in `domain/contracts/mail.ts`', 'the preview line to 150', 'the month to 40',
      'A save writes no activity row, by decision', '`group_email_sent`', 'No admin write of part one carries a rate limit',
      'the nine characters that force the direction or the order in which what follows is drawn, U+202A to U+202E and U+2066 to U+2069',
      'the zero width joiner and non-joiner and the variation selector U+FE0F', 'the left-to-right, right-to-left and Arabic letter marks',
      'the zero width space and the soft hyphen',
    ]) expect(saving, piece).toContain(piece)
  })

  it('gives the start and the last letters what the page needs, deleting nothing and naming no reader', () => {
    const starting = bullet(block, '- **Starting a letter.**')
    for (const piece of [
      '`{ from, monthLabel }`', '`\'blank\'`', '`{ issueId }`', '`{ campaignId }`', 'cleaned as they are copied', '404', 'set aside, its words kept', 'reused in place', 'no row is ever deleted',
      '`defaultSubject`', '201', '409', 'only once that letter is set aside', '`\'sent\'` when the letter it read was sent before it could write', 'ends in an unhandled error',
      'one of LCA\'s starters that nobody wrote in', 'the empty paragraphs, the line breaks and the spaces between tags', 'and nothing else', 'anything in doubt',
      'A copy of a past letter or of a send that nobody touched still holds its words and is set aside', 'kept rather than guessed at',
      'a word typed anywhere, a "<" that is a word,', 'A copy whose words are themselves a starter\'s headings untouched reads as that starter and is reused; its source is kept.',
    ]) {
      expect(starting, piece).toContain(piece)
    }
    const last = bullet(block, '- **The open letter and the last letters.**')
    for (const piece of ['`{ issue, state, lastSavedBy, lastSavedAt }`', 'at most 20, newest first, without their words', 'no reader\'s address and no other count']) expect(last, piece).toContain(piece)
  })

  it('says who may, the switch and its order, and what ships with every switch off', () => {
    const who = bullet(block, '- **Who may.**')
    for (const piece of ['`requireListMailer`', 'an LCA admin with a second factor, the president', 'an officer who holds the seat among them', 'byte for byte', '`LIST_MAILERS_ONLY`', 'thirteen kinds of person']) {
      expect(who, piece).toContain(piece)
    }
    const theSwitch = bullet(block, '- **The switch.**')
    for (const piece of [
      '`mailPage: false`', '`export const MAIL_PAGE_ON = false`', '"Set: "', '`test/unit/mail-switches.test.ts`', 'on only while `MAIL_LISTS_ON` is', '`test/unit/features.test.ts`',
      '`test/unit/redesign-status-ws02-step2.test.ts`', '43 to 44', 'before it reads the request, the session or the database', 'the other way round from part one\'s three newsletter files',
    ]) expect(theSwitch, piece).toContain(piece)
    const off = bullet(block, '- **What ships with every switch off.**')
    expect(off.startsWith('- **What ships with every switch off.** Nothing a visitor or a member meets.')).toBe(true)
    for (const piece of ['`mailPage:!1`', '`npm run db:migrate:preview`', 'a preview built from this branch before its database has 0061 is safe']) expect(off, piece).toContain(piece)
  })

  it('gives the contracts\' figures as text, the page\'s four calls, and the cross-check\'s counts', () => {
    const contracts = bullet(block, '- **The contracts.**')
    for (const piece of [
      '`domain/contracts/newsletter.ts`', '`domain/contracts/registry.ts` gains three paths and four methods', '27 to 31', '137 to 141', '`PENDING_COUNT` 110 unchanged',
      '`test/unit/contracts-status.test.ts`', '`REQUEST_ID_MAX`, 64 characters', 'in its field\'s own words, with nothing written', 'the answers keep `idSchema`',
    ]) {
      expect(contracts, piece).toContain(piece)
    }
    const page = bullet(block, '- **The page\'s side.**')
    for (const name of ['getNewsletterIssue', 'saveNewsletterIssue', 'startNewsletterIssue', 'getLastNewsletters']) expect(page, name).toContain(`\`${name}\``)
    expect(page).toContain('no built file names the new paths')
    const cross = bullet(block, '- **The cleaner\'s cross-check.**')
    for (const piece of ['213,518 inputs', '113,670 came back cleaned', '99,848 null', 'parse5', 'Nothing got through, and the cleaner is unchanged.']) expect(cross, piece).toContain(piece)
  })

  it('names the deviations from the entry, tested_at not built first', () => {
    const deviations = bullet(block, '- **Deviations from the entry.**')
    expect(deviations.startsWith('- **Deviations from the entry.** `tested_at` is not built')).toBe(true)
    for (const piece of ['answer 404 before the guard', 'carries the letter\'s `id`', 'reused in place', '`functions/db/relations.ts`', 'fifteen files beyond the step\'s list', 'a starter nobody wrote in among them']) {
      expect(deviations, piece).toContain(piece)
    }
  })

  it('names the judgement calls on not found, a starter nobody wrote in, the ids and the hidden characters, and each follow-up once with the step that owns it', () => {
    const judgement = bullet(block, '- **Judgement calls.**')
    for (const piece of [
      'or a starter nobody wrote in, rather than deleting it', 'anything in doubt counts as words', '`newsletterNotFound`, given under the page\'s name, `pageNotFound`',
      'held to 64 characters', 'refuse the nine characters that force a line\'s direction', 'reads a "<" that is a word as a word before it drops anything',
      'a copy that nobody touched is kept, unless its words are a starter\'s headings untouched, which read as that starter while its source is kept',
    ]) expect(judgement, piece).toContain(piece)
    const followUps = bullet(block, '- **Follow-ups.**')
    for (const piece of [
      'drop hidden characters as they are typed or pasted', 'the server\'s refusal stays the backstop', 'must still leave it untouched by `holdsWords`, held by a case there',
      'from one shared place, so `holdsWords` moves under `domain/` in that step', 'a copy of a past letter nobody touched is still set aside',
      'unless its words are a starter\'s headings untouched, which read as that starter and are reused, its source kept',
      'Page steps 6 and 7: a start is refused while a letter is scheduled or sending inside the start\'s own statements, not by a read made before them',
      'The page\'s switch-on change: sweep (d) of `test/integration/media-manager-officer.test.ts` gains the page\'s three files in `NEWSLETTER_FILES`',
      'its two cases turn red when `MAIL_PAGE_ON` is set', 'The first step that reads `newsletter_issues` through Drizzle adds its three relations in `functions/db/relations.ts`',
    ]) expect(followUps, piece).toContain(piece)
    for (const step of ['Page step 4:', 'Page step 5:', 'Page steps 6 and 7:', 'The page\'s switch-on change:']) expect(followUps.split(step), step).toHaveLength(2)
    expect(followUps).not.toContain('the save leaves them')
  })

  it('names every file it adds and changes, each test with its count, the files beyond the step\'s list and the tests that grew', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...NEW_BEYOND, ...CHANGED, ...CHANGED_TESTS, ...BEYOND, ...GROWN]) expect(files, name).toContain(`\`${name}\``)
    expect(files).toContain('`pageNotFound`, which is the newsletter tab\'s own `newsletterNotFound` under the page\'s name')
    for (const name of NEW_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of [...CHANGED_TESTS, ...BEYOND.filter((f) => /\.test\.ts$/.test(f)), ...GROWN]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before)[:)]`))
    const beyond = bullet(files, '  - Files beyond the step\'s list')
    for (const name of [...BEYOND, ...NEW_BEYOND]) expect(beyond, name).toContain(`\`${name}\``)
    for (const file of [...NEW_FILES, ...NEW_BEYOND, ...CHANGED, ...CHANGED_TESTS, ...BEYOND, ...GROWN]) expect(existsSync(join(ROOT, file)), file).toBe(true)
  })

  it('gives the lint as unchanged, the build file by file against the base, and the worker against the base, measured first', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      'compared file by file with a local build of the base `1660379` made first', '233 files in `dist` and 194 in `dist/assets`', '`features-DxqQlIon.js` at 698 bytes',
      '`features-Bz-URkAf.js` at 710', '`index-rLaj86fe.js` is `index-LImbWElX.js` at 554,147 bytes', 'The 58 files', '`index.html`, 2,212 bytes',
      'The other 173 files are the base\'s byte for byte', '`index-BTmE8w6L.css` at 130,974 bytes',
    ]) expect(build, piece).toContain(piece)
    const worker = bullet(block, '- **Worker.**')
    for (const piece of ['`WRANGLER_HIDE_BANNER=true WRANGLER_SEND_METRICS=false npx wrangler deploy --dry-run`', '`--config workers/daily-emails/wrangler.toml`', 'on the base `1660379`', 'measured first', 'byte for byte the base\'s']) {
      expect(worker, piece).toContain(piece)
    }
    expect([...worker.matchAll(/76\.61 KiB, gzip 20\.53 KiB/g)].length).toBeGreaterThanOrEqual(1)
  })

  it('gives each check once in its checks line, with the base\'s figures and the one browser run the gate\'s', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    for (const piece of [
      '(963 on the base)', '(8,884 in 338 on the base)', '(2,024 in 110 on the base)', '659 that run and 336 that skip', 'the one browser run being the gate\'s before the commit',
      '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`', 'from 7:05 AM to 7:33 AM UTC',
    ]) expect(checksLine, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: plain language over the part', () => {
  it('keeps the dashes, the working words, any tool\'s name, the old initials, unfilled marks and the merge-pending phrase out of it', () => {
    expect(part).not.toBe('')
    expect(part).not.toMatch(DASHES)
    expect(part).not.toMatch(BANNED)
    expect(part).not.toMatch(TOOLS)
    expect(part).not.toMatch(ASSISTANT)
    expect(part).not.toMatch(BARE)
    expect(part).not.toMatch(OLD_INITIALS)
    expect(part).not.toMatch(UNFILLED)
    expect(proseOf(part)).not.toMatch(CAPITALS)
    expect(part).not.toMatch(PENDING)
    expect(proseOf(part)).not.toMatch(HE)
    expect(part).not.toMatch(/\(step \d+[;),]/)
    expect(proseOf(part)).not.toMatch(/\b\d{12}\b/)
    expect(partLines.filter((l) => l.startsWith('|'))).toEqual([])
  })

  it('gives every date the weekday it falls on, and writes every time on the twelve-hour clock', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const months = MONTHS.join('|')
    const short = MONTHS.map((m) => m.slice(0, 3)).join('|')
    const text = proseOf(part)
    for (const found of text.matchAll(new RegExp(`\\b(?:${months}|${short}) \\d{1,2}\\b`, 'g'))) {
      expect(text.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const [whole, weekday, month, day, year] of text.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${months}) (\\d{1,2})\\b(?:, (\\d{4}))?`, 'g'))) {
      expect(WEEKDAYS[new Date(Date.UTC(Number(year ?? 2026), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
    }
    for (const time of text.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
  })

  it('names checkpoints in full and K as K or they', () => {
    const bare = proseOf(part).replace(/\b[Cc]heckpoints [J-R](?:, [J-R])* and [J-R]\b|\b[Cc]heckpoint [J-R]\b/g, 'checkpoint')
    expect([...bare.matchAll(/(?<![\w-])[JLMNOPQR](?![\w-])/g)].map((m) => m[0])).toEqual([])
    expect(proseOf(part)).not.toMatch(HE)
  })
})

describe('REDESIGN_STATUS.md, WS16 part two: the date and the new files', () => {
  it('dates the record on a real day, on or after Friday, November 13, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-13').toBe(true)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of the new code and tests', () => {
    for (const file of NEW_CODE) {
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
  })
})
