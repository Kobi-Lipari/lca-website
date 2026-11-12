// test/unit/redesign-status-ws16-checkpoint-m.test.ts
//
// REDESIGN_STATUS.md, checkpoint M's review fixes: what the round wrote in
// the WS16 section, read from the record alone. It reads only the WS16
// section and the date line, and no count from the code: the review's own
// bullets at the end of checkpoint M's section, each item of the fix round
// by its number and in its order, the files of the round with each test
// file's count beside it, the pins it moved, the build's and the worker's
// figures as they add up from the record's own numbers, and the checks;
// the opening paragraph and the PR line naming draft pull request 126; the
// pull request's text with its short headings and the words the review
// asked for; the entries of the lists that gain a sentence, their earlier
// words kept; and the plain-language rules on everything the round wrote.
// The step blocks keep their own words, which their record tests hold.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')

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
const UNFILLED = new RegExp(`${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}|${'to be ' + 'measured'}`)
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i
/** An assistant named in a pull request's text, or a line about how it was written. */
const ASSISTANT = new RegExp(`\\b(?:${'assis' + 'tant'}|${'gener' + 'ated'}|${'wri' + 'tten by'})\\b`, 'i')
/** The merge-pending phrase. */
const PENDING = new RegExp(`merge into \`main\` is ${'pen' + 'ding'}|is ${'pen' + 'ding'}`)

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
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))

const HEADING = '## WS16: Mail (the mail engine, lists and the LCA newsletter)'
const ws16 = between(status, `\n${HEADING}\n`, '\n## Phase 0:')
const sectionLines = ws16.split('\n')
const part = (heading: string) => {
  const at = ws16.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws16.slice(at + 1), heading, '\n### ')
}
const CHECKPOINT = '### Checkpoint M: WS16 steps 1 to 8'
const checkpoint = part(CHECKPOINT)
const map = part('### WS16 map: what proves each acceptance criterion and decision')
const decisions = part('### WS16 decisions')
const followUps = ws16.slice(ws16.indexOf('\n### WS16 follow-ups\n') + 1)
const opening = checkpoint.split('\n')[2] ?? ''
const prLine = sectionLines.find((l) => l.startsWith('**PR:**')) ?? ''
const date = /^Last updated: (\d{4})-(\d{2})-(\d{2}) \(/.exec(status.split('\n').find((l) => l.startsWith('Last updated:')) ?? '')

const FIXES = bullet(checkpoint, "- **The review's fixes.**")
const FILES = bullet(checkpoint, "- **Files of the review's fixes.**")
const PINS = bullet(checkpoint, "- **Pins moved in the review's fixes.**")
const BUILD = bullet(checkpoint, "- **Build after the review's fixes.**")
const WORKER = bullet(checkpoint, "- **Worker after the review's fixes.**")
const CHECKS = checkpoint.split('\n').find((l) => l.startsWith('- Checks at the end of the checkpoint:')) ?? ''
const PULL_REQUEST = bullet(checkpoint, "- **The pull request's text.**").split('\n').filter((l) => l.startsWith('  >')).map((l) => l.replace(/^ {2}> ?/, ''))

/** The items of the fix round, in their order, each a sub-bullet of its own. */
const ITEMS = ['R1.', 'R2.', 'R3.', 'S1.', 'S2.', 'S3.', 'S4.', 'S5.', 'S6.', 'S7.', 'S8.', 'N1.', 'N2.', 'N3.', 'N4.', 'N5.', 'Not taken:', 'K1.', 'K2.', 'K3.']
/** K's items of part A and part B, under K1. */
const K_ITEMS = ['A1.', 'A2.', 'A3.', 'A4.', 'A5.', 'A6.', 'B1.', 'B2.', 'B3.', 'B4.', 'B5.', 'B6.', 'B7.', 'B8.']
const item = (name: string) => FIXES.split('\n').find((l) => l.startsWith(`  - ${name}`)) ?? ''
const kItem = (name: string) => FIXES.split('\n').find((l) => l.startsWith(`    - ${name}`)) ?? ''

/** Every file the round adds or changes, as its Files bullet names it. */
const NEW_FILES = [
  'domain/mail/newsletterWords.ts', 'test/integration/campaigns-claims.test.ts', 'test/integration/media-manager-officer.test.ts',
  'test/integration/member-delete-contact.test.ts', 'test/integration/newsletter-test-own.test.ts', 'test/unit/email-pages-review.test.tsx',
  'test/unit/redesign-status-ws16-checkpoint-m.test.ts',
]
const CHANGED = [
  'functions/api/admin/mail/newsletter/test.ts', 'functions/api/admin/members/[id].ts', 'functions/api/mail/preferences/[token].ts', 'functions/api/me/media-manager.ts',
  'functions/utils/admin/campaigns.ts', 'functions/utils/auth.ts', 'functions/utils/mail/lists.ts', 'functions/utils/mail/newsletterAnswers.ts', 'functions/utils/mail/ses.ts',
  'src/areas/admin/api.ts', 'src/areas/admin/useMediaManager.ts', 'src/areas/membership/components/EmailChoiceParts.tsx', 'src/components/auth/RoleProtectedRoute.tsx',
  'src/components/layout/Navbar.tsx', 'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/pages/EmailPreferencesPage.tsx', 'src/pages/EmailUnsubscribePage.tsx',
  'workers/daily-emails/wrangler.toml', 'REDESIGN_STATUS.md', 'test/unit/fixtures/email-pages-today.tsx', 'test/unit/helpers/tailwindPx.ts',
]
const CHANGED_TESTS = [
  'test/integration/contracts/me-media-manager.test.ts', 'test/integration/media-manager.test.ts', 'test/integration/ses-events-edges.test.ts',
  'test/integration/ses-path-edges.test.ts', 'test/integration/ses-path.test.ts', 'test/unit/admin-email-newsletter.test.tsx', 'test/unit/admin-media-manager.test.tsx',
  'test/unit/email-choice-pages.test.tsx', 'test/unit/goldText.test.ts', 'test/unit/mail-address.test.ts', 'test/unit/mail-seam-bytes.test.ts',
  'test/unit/mail-step3-words.test.ts', 'test/unit/migration-0060-mail-lists.test.ts', 'test/unit/ses-sender.test.ts', 'test/unit/use-media-manager.test.tsx',
  'test/unit/domain-boundaries.test.ts',
]
/** The pins the round moved, by the test file each sits in. */
const MOVED = [
  'test/integration/media-manager.test.ts', 'test/integration/contracts/me-media-manager.test.ts', 'test/integration/ses-path.test.ts', 'test/unit/use-media-manager.test.tsx',
  'test/unit/admin-media-manager.test.tsx', 'test/unit/admin-email-newsletter.test.tsx', 'test/unit/email-choice-pages.test.tsx', 'test/unit/goldText.test.ts',
  'test/unit/ses-sender.test.ts', 'test/unit/mail-step3-words.test.ts', 'test/unit/mail-seam-bytes.test.ts', 'test/unit/migration-0060-mail-lists.test.ts', 'test/unit/mail-address.test.ts',
]
/** The entries of the lists that gain a sentence, with the sentence's start. */
const EXTENDED: ReadonlyArray<readonly [string, string, string]> = [
  ['decisions', 'The mail tables, keyed by address and built once (WS16 step 2).', "Changed in checkpoint M's review: a contact that holds nothing"],
  ['decisions', "The media manager is a board seat's holder (WS16 step 6).", "Changed in checkpoint M's review: K answered on Thursday, November 12, 2026 (decision 52, settling decision 49)"],
  ['followUps', 'A list turned back on keeps its place on the preferences page (WS16 step 3).', "Changed in checkpoint M's review: where the 'out' being turned back on is one a spam report wrote"],
  ['followUps', "The worker's link key before the switch-on (WS16 step 4).", "Changed in checkpoint M's review: `workers/daily-emails/wrangler.toml`'s comment on secrets now names `MAIL_LINK_SECRET`"],
  ['followUps', "The media manager's seat and role on switch-on day (WS16 step 6).", "Changed in checkpoint M's review: by K's answer of Thursday, November 12, 2026 (decision 52)"],
  ['followUps', "The comment on the page's call for the newsletter's test (WS16 step 7).", "Done in checkpoint M's review: the comment says that `service` asks for the test through Amazon SES"],
]
const entry = (list: string, name: string) => entries(list === 'decisions' ? decisions : followUps).find((l) => head(l) === name) ?? ''

describe("REDESIGN_STATUS.md, checkpoint M's review: the section's new bullets", () => {
  it('ends checkpoint M\'s section with the review\'s bullets, in order, after the pull request\'s text, each once', () => {
    const names = ["- **The pull request's text.**", "- **The review's fixes.**", "- **Files of the review's fixes.**", "- **Pins moved in the review's fixes.**", "- **Build after the review's fixes.**", "- **Worker after the review's fixes.**", '- Checks at the end of the checkpoint:']
    const at = names.map((n) => checkpoint.indexOf(`\n${n}`))
    for (const [i, n] of names.entries()) {
      expect(at[i], n).toBeGreaterThan(-1)
      expect(checkpoint.split('\n').filter((l) => l.startsWith(n)), n).toHaveLength(1)
    }
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(checkpoint.trimEnd().split('\n').at(-1)!.startsWith('- Checks at the end of the checkpoint:')).toBe(true)
  })

  it('gives each item of the round by its number, in order, a sub-bullet of its own, and K\'s items under K1', () => {
    const at = ITEMS.map((name) => FIXES.indexOf(`\n  - ${name}`))
    for (const [i, name] of ITEMS.entries()) expect(at[i], name).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const kAt = K_ITEMS.map((name) => FIXES.indexOf(`\n    - ${name}`))
    for (const [i, name] of K_ITEMS.entries()) expect(kAt[i], name).toBeGreaterThan(at[ITEMS.indexOf('K1.')])
    expect([...kAt].sort((a, b) => a - b)).toEqual(kAt)
    expect(kAt.at(-1)).toBeLessThan(at[ITEMS.indexOf('K2.')])
    for (const part of ['(i)', '(ii)', '(iii)']) expect(FIXES, part).toContain(`\n    - ${part} `)
  })

  it('opens with the review, its twenty findings, the three called blocking and each refuted twice, and the switches every change waits for', () => {
    const first = FIXES.split('\n')[0]
    for (const piece of ['Thursday, November 12, 2026', 'twenty findings', 'three of them blocking', 'refuted twice as not blocking this merge', "K's decision 52", 'waits for `mailLists`, which stays off', '`MAIL_LISTS_ON`, which stays unset', '`MAIL_SENDER`, which stays `\'resend\'`', 'a stored copy or with the code as it was']) {
      expect(first, piece).toContain(piece)
    }
  })

  it('says what each of the review\'s findings came to, with the finding\'s number', () => {
    const findings: ReadonlyArray<readonly [string, number[]]> = [
      ['R1.', [10]], ['R2.', [14, 19, 20]], ['R3.', [15]], ['S1.', [1]], ['S2.', [5]], ['S3.', [6, 7]], ['S4.', [11]], ['S5.', [12]], ['S6.', [16]], ['S7.', [17]], ['S8.', [18]],
      ['N1.', [3]], ['N2.', [4]], ['N3.', [8]], ['N4.', [9]], ['N5.', [13]], ['Not taken:', [2, 20]],
    ]
    for (const [name, numbers] of findings) {
      const named = [...item(name).matchAll(/\(findings? ([^)]*)\)/g)].flatMap((m) => (m[1].match(/\d+/g) ?? []).map(Number))
      for (const n of numbers) expect(named, `${name} ${n}`).toContain(n)
    }
  })

  it('gives R1\'s refusal, who keeps the typed address, the page\'s form, its cases and the judgement call on the activity row', () => {
    for (const piece of [
      '`normalizeAddress`', '403', '`TEST_TO_OWN_ADDRESS`', '"A test goes to your own account\'s email address."', 'after the guard, the 404 and the refusal of a test through Amazon SES',
      'an account with no usable address', 'an LCA admin with a second factor and the president keep the typed address', '`functions/api/admin/campaigns/test.ts`',
      'draws no address box', 'still "Send test"', 'shows whole', '`test/integration/newsletter-test-own.test.ts`', 'written with capitals and spaces',
      'A judgement call: no activity row is written for a test', 'collect only what is needed', "carries the footer's words as a member reads them",
    ]) expect(item('R1.'), piece).toContain(piece)
  })

  it('gives S4\'s three rules, the share of the claim and why, a hung send, the choice on a time limit, and the cases', () => {
    const s4 = between(FIXES, '\n  - S4.', '\n  - S5.')
    for (const piece of [
      'with the rules on only', '`test/integration/campaigns.test.ts` holds unchanged', '`putBack`', 'leaves every row another run marked', '`failStopped`', '`CLAIM_HELD_MS`', 'ten minutes',
      'two thirds of the claim\'s fifteen', 'five minutes for the one send in flight', 'only while the row is still pending', 'whichever of the run\'s write and the sweep\'s write-off lands first decides the row',
      'is still sent at most once', 'counted once, in `failed_count`', 'No time limit is set on the call', 'a request with no answer, never tried again',
      '`test/integration/campaigns-claims.test.ts`', 'the review\'s own probe', 'each address reached once and the counts adding up', 'Six of the nine fail on WS16 step 8\'s sender', 'the rules-off case among them', 'when a stop has closed the send',
    ]) expect(s4, piece).toContain(piece)
  })

  it('gives S5\'s words for an address, S2\'s reading of the two deploy files and the sweep, and S7\'s look as it can be done', () => {
    for (const piece of ['`amazonWords`', '"an address"', '`ADDRESS_WORDS`', 'before the cut', '`test/unit/ses-sender.test.ts`', '`test/integration/ses-path-edges.test.ts`']) expect(item('S5.'), piece).toContain(piece)
    for (const piece of ['`deploy-worker.yml`', '`migrate-db.yml`', '`phase`', 'waits one sweep', 'nothing sent twice or lost', 'before any claim']) expect(item('S2.'), piece).toContain(piece)
    for (const piece of ["checkpoint M's own preview", "today's site", 'pictures of the real pages', 'plainly made-up answers', 'which K is sent before the merge', "K's checklist's own words are corrected the same way on the plan's branch"]) {
      expect(item('S7.'), piece).toContain(piece)
    }
  })

  it('gives N5 as a decision of this round, what stays and why, the delete as on 24bcf50, and where the decision is written', () => {
    for (const piece of [
      'a decision of this round', '`forgetEmptyContact`', 'no list choice, no stop-all and no report\'s mark', 'collect only what is needed', "each is the person's own word or a report that must outlive the account",
      'as on `24bcf50`', '`test/integration/member-delete-contact.test.ts`', 'literal text', "WS16 step 1's record test",
    ]) expect(item('N5.'), piece).toContain(piece)
  })

  it('gives K\'s part A and part B, each item\'s change, and what a person can meet of the two member pages as shipped', () => {
    for (const piece of ['`sendsAsMediaManager`', 'no longer refuses an officer before the seat is read', '`LIST_MAILERS_ONLY`', '`requireMailer`', 'cannot use Specific people']) expect(kItem('A1.'), piece).toContain(piece)
    for (const piece of ['only when they hold a seat', 'never for an officer with no seat', 'keeps every read-only section', 'Group email in the media manager\'s form', 'never waits on the answer']) {
      expect(kItem('A3.'), piece).toContain(piece)
    }
    for (const piece of ['answers no for the draw that met it', 'asked again the next time a page needs the answer', 'before their own record has arrived']) expect(kItem('A5.'), piece).toContain(piece)
    expect(kItem('A6.')).toContain('whoever holds the Media manager seat, signed in with a second factor, may send the newsletter, an LCA officer among them')
    for (const [name, piece] of [
      ['B1.', 'a bordered, lightly tinted box with padding on every side'], ['B2.', '"Off while all optional email is stopped."'], ['B3.', 'a `large` choice the tab passes'], ['B4.', 'named by its subject'],
      ['B5.', 'in one span that does not break'], ['B6.', '`domain/mail/newsletterWords.ts`'], ['B7.', 'the sentence and its Contact link stay word for word'], ['B8.', 'Not in this round'],
    ] as const) expect(kItem(name), name).toContain(piece)
    expect(FIXES).toContain('nothing of B1, B2 and B7 can be met as shipped')
  })

  it('gives K2\'s rule, its cases and that its path is live only with the rules on, and K3\'s headings', () => {
    for (const piece of ["its source `'complaint'`", "the person's 'in' is now written at that moment in its place", '`test/integration/ses-events-edges.test.ts`', 'This path is live only with the rules on.']) {
      expect(item('K2.'), piece).toContain(piece)
    }
    for (const heading of ['Before the merge', 'What to look at on the preview', 'What the merge does to production', 'If it has to come back out', 'Checks', 'What comes after']) expect(item('K3.'), heading).toContain(`"${heading}"`)
  })

  it('names the switch-on patch\'s fix, the one case it turned red and that the cutover applies on top', () => {
    const patch = FIXES.split('\n').find((l) => l.startsWith("  - The switch-on change's patch:")) ?? ''
    for (const piece of ['`test/unit/signed-in-header.test.tsx`', 'the fix is in the patch', "the cutover's patch applies on top of it unchanged"]) expect(patch, piece).toContain(piece)
  })
})

describe("REDESIGN_STATUS.md, checkpoint M's review: files, pins, build, worker and checks", () => {
  it('names every file the round adds and changes, each in backticks, and each test file with its count', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_TESTS]) expect(FILES, file).toContain(`\`${file}\``)
    for (const file of [...NEW_FILES.filter((f) => f.startsWith('test/')), ...CHANGED_TESTS]) {
      expect(FILES, file).toMatch(new RegExp(`\`${file.replace(/[.[\]/]/g, '\\$&')}\` \\(\\d+(?:, \\d+ before|, as before)?: `))
    }
  })

  it('gives counts that add up to the Checks line, from the base\'s totals and the files\' own counts', () => {
    const counts = (pred: (f: string) => boolean) => [...NEW_FILES, ...CHANGED_TESTS].filter(pred).reduce((sum, file) => {
      const m = new RegExp(`\`${file.replace(/[.[\]/]/g, '\\$&')}\` \\((\\d+)(?:, (\\d+) before|, (as before))?`).exec(FILES)!
      return sum + Number(m[1]) - (NEW_FILES.includes(file) ? 0 : m[3] ? Number(m[1]) : Number(m[2]))
    }, 0)
    const unit = /unit ([\d,]+) tests in ([\d,]+) files \(([\d,]+) in ([\d,]+) on the base\)/.exec(CHECKS)!
    const integration = /integration ([\d,]+) in ([\d,]+) files \(([\d,]+) in ([\d,]+) on the base\)/.exec(CHECKS)!
    expect([num(unit[3]), num(unit[4]), num(integration[3]), num(integration[4])]).toEqual([8718, 334, 1764, 104])
    expect(num(unit[1]) - num(unit[3])).toBe(counts((f) => f.startsWith('test/unit/')))
    expect(num(unit[2]) - num(unit[4])).toBe(NEW_FILES.filter((f) => f.startsWith('test/unit/')).length)
    expect(num(integration[1]) - num(integration[3])).toBe(counts((f) => f.startsWith('test/integration/')))
    expect(num(integration[2]) - num(integration[4])).toBe(NEW_FILES.filter((f) => f.startsWith('test/integration/')).length)
  })

  it('lists each pin moved with its file, and no closed record test among them', () => {
    for (const file of MOVED) expect(PINS.split('\n').filter((l) => l.startsWith(`  - \`${file}\`:`)), file).toHaveLength(1)
    expect(PINS).not.toMatch(/`test\/unit\/redesign-status-ws16-step\d\.test\.ts`:/)
    for (const words of ['"Kenner Chess Club"', '"Example Chess Club"', '"Acadiana Knights"', '"Example Knights"', '"pat@mail.lsu.edu"', '"pat@mail.example.org"', 'lines 668, 669 and 675', 'lines 694, 695 and 701']) {
      expect(PINS, words).toContain(words)
    }
  })

  it('gives the build\'s three named files against WS16 step 8\'s, each difference the record\'s own subtraction, and every file that changes size', () => {
    const main = /the main script `index-[\w-]+\.js` at ([\d,]+) bytes, ([\d,]+) on WS16 step 8's tree, ([\d,]+) more/.exec(BUILD)!
    const css = /the stylesheet `index-[\w-]+\.css` at ([\d,]+) bytes, ([\d,]+) before, ([\d,]+) more/.exec(BUILD)!
    expect(num(main[1]) - num(main[2])).toBe(num(main[3]))
    expect(num(css[1]) - num(css[2])).toBe(num(css[3]))
    expect(num(main[2])).toBe(553776)
    expect(num(css[2])).toBe(130610)
    expect(BUILD).toMatch(/the switches chunk `features-[\w-]+\.js` at 698 bytes, as before/)
    for (const piece of ['`AdminPage`', '`EmailChoiceParts`', '`EmailPreferencesPage`', '`EmailUnsubscribePage`', '`footer` stays at 507', 'a local build\'s figures', 'Thursday, November 12, 2026']) expect(BUILD, piece).toContain(piece)
  })

  it('gives the worker\'s dry run against WS16 step 8\'s and part one\'s ceiling, its sums its own', () => {
    const [after, before] = [...WORKER.matchAll(/([\d.]+) KiB, gzip ([\d.]+) KiB/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(before).toEqual([75.86, 20.33])
    const more = /([\d.]+) KiB more, gzip ([\d.]+) KiB, and ([\d,]+) bytes/.exec(WORKER)!
    expect(Number(more[1])).toBeCloseTo(after[0] - before[0], 2)
    expect(Number(more[2])).toBeCloseTo(after[1] - before[1], 2)
    const bytes = [...WORKER.matchAll(/([\d,]+) bytes/g)].map((m) => num(m[1]))
    expect(bytes[0] - 77680).toBe(num(more[3]))
    const left = /which leaves ([\d.]+) KiB, gzip ([\d.]+) KiB/.exec(WORKER)!
    expect(Number(left[1])).toBeCloseTo(96 - after[0], 2)
    expect(Number(left[2])).toBeCloseTo(28 - after[1], 2)
    for (const piece of ['`npx wrangler deploy --dry-run`', '`--config workers/daily-emails/wrangler.toml`', 'The bundle holds no package.']) expect(WORKER, piece).toContain(piece)
  })

  it('gives the checks in the form of a step\'s Checks line, with the base\'s lint, browser run and baseline', () => {
    for (const piece of [
      '`npm run lint` 13 errors and 13 warnings over', '(947 on the base), none in a file this round touches', '`npm run build` (194 files in `dist/assets`)', '`npm run typecheck:functions`',
      '`npm run check:bundle`', '`npm run test:a11y` 995 tests, 659 that run and 336 that skip', 'the one browser run being the gate\'s before the commit',
      '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`', 'Thursday, November 12, 2026',
    ]) expect(CHECKS, piece).toContain(piece)
  })
})

describe("REDESIGN_STATUS.md, checkpoint M's review: the opening, the PR line and the pull request's text", () => {
  it('names draft pull request 126 in the PR line and in the section\'s first sentence, with the day it was opened', () => {
    expect(prLine).toContain('from draft pull request 126, opened from this branch on Thursday, November 12, 2026 once WS16 step 8 was built')
    expect(opening.startsWith('**Not merged yet: checkpoint M waits for its merge into `main`** (draft pull request 126). Draft pull request 126 was opened from this branch on Thursday, November 12, 2026')).toBe(true)
  })

  it('names in the opening, in the same sentence, the three changes that wait for neither switch', () => {
    const sentence = between(opening, 'Every change a visitor or a member could meet', 'so production behaves as today after the merge')
    for (const piece of ['but three, which wait for neither', 'GET `/api/me/media-manager`, which answers no for everyone signed in and 401 signed out', "the member delete's one batch more, which changes nothing while no newsletter is sending", "the newsletter's four methods and the two links' four, which answer where no route answered before"]) {
      expect(sentence, piece).toContain(piece)
    }
  })

  it('gives the pull request\'s text its short headings, in order, each a line of its own and none a heading mark', () => {
    const headings = ['**Before the merge**', '**What to look at on the preview**', '**What the merge does to production**', '**If it has to come back out**', '**Checks**', '**What comes after**']
    const at = headings.map((h) => PULL_REQUEST.indexOf(h))
    for (const [i, h] of headings.entries()) expect(at[i], h).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(PULL_REQUEST.join('\n')).not.toMatch(/^#/m)
    expect(PULL_REQUEST[0]).toBe('WS16 checkpoint M: the mail engine and the LCA newsletter list')
  })

  it('says what K does before the merge, what to look at, what the merge does, how to go back, and the cutover\'s four conditions', () => {
    const text = PULL_REQUEST.join('\n')
    for (const piece of [
      'K runs `npm run db:migrate:preview` from this branch', 'holds none of the mail secrets', 'gives the go on this pull request', 'pictures of the real pages',
      'the sign-in key set in the Preview environment, which it does not hold today', 'Watch the "Apply database migrations" run go green on the merge, and run it again at once if it fails',
      "Group email's sends wait, with nothing lost, and the newsletter's stop answers an error", '`git revert -m 1`',
      "Migration 0060 stays, and main's code as it was runs on a database that has it, its one whole-row read answering two columns more that no page reads",
      "once Amazon has approved real sending, K's checks in the sandbox, the receiver's two checks and the site's own test through Amazon SES have passed and the account is on Workers Paid",
      'whoever holds the Media manager seat, signed in with a second factor, an LCA officer among them', 'Checkpoints N and O follow',
    ]) expect(text, piece).toContain(piece)
    expect(text).not.toMatch(TOOLS)
    expect(text).not.toMatch(ASSISTANT)
  })

  it('says the rollback in the review\'s words in the merge\'s bullet too, and the worker\'s deploy beside the migration', () => {
    const merge = bullet(checkpoint, '- **What the merge does with every switch off.**')
    expect(merge).toContain("migration 0060 stays, and main's code as it was runs on a database that has it, its one whole-row read answering two columns more that no page reads.")
    expect(merge).not.toContain('read by nothing once the code is gone')
    const needs = bullet(checkpoint, '- **What needs migration 0060 on production.**')
    for (const piece of ['`deploy-worker.yml`', 'for a few seconds the new sweep can meet a database without 0060', 'waits one sweep, with nothing sent twice or lost']) expect(needs, piece).toContain(piece)
  })
})

describe("REDESIGN_STATUS.md, checkpoint M's review: the entries it extends", () => {
  it('adds one sentence at the end of each entry it extends, the entry\'s earlier words kept before it', () => {
    for (const [list, name, start] of EXTENDED) {
      const text = entry(list, name)
      expect(text, name).not.toBe('')
      expect(text.split(start), name).toHaveLength(2)
      const earlier = text.slice(0, text.indexOf(start))
      expect(earlier.endsWith('. '), name).toBe(true)
      expect(text.endsWith('.'), name).toBe(true)
    }
    const all = [...entries(decisions), ...entries(followUps)].filter((l) => /(?:Changed|Done) in checkpoint M's review:/.test(l)).map(head)
    expect(all.sort()).toEqual(EXTENDED.map(([, name]) => name).sort())
  })

  it('adds to AC3 one sentence naming the test that holds the rules of S4, ahead of its planned step', () => {
    const ac3 = entries(map).find((l) => l.startsWith('- **AC3.**')) ?? ''
    expect(ac3.split("Changed in checkpoint M's review:")).toHaveLength(2)
    expect(ac3).toMatch(/Changed in checkpoint M's review: [^]*`test\/integration\/campaigns-claims\.test\.ts` holds[^]* Planned: WS16 step 7\.$/)
    expect(entries(map).filter((l) => l.includes("checkpoint M's review"))).toHaveLength(1)
  })
})

describe("REDESIGN_STATUS.md, checkpoint M's review: plain language", () => {
  /** Everything the round wrote: its bullets, the opening, the PR line, the pull request's text and the sentences it added. */
  const written = [
    FIXES, FILES, PINS, BUILD, WORKER, CHECKS, opening, prLine, PULL_REQUEST.join('\n'),
    ...EXTENDED.map(([list, name, start]) => entry(list, name).slice(entry(list, name).indexOf(start))),
    between(entries(map).find((l) => l.startsWith('- **AC3.**')) ?? '', "Changed in checkpoint M's review:", ' Planned:'),
  ]

  it('reads every piece it means to', () => {
    for (const text of written) expect(text.length).toBeGreaterThan(20)
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials, unfilled marks, the merge-pending phrase and a he out of it', () => {
    for (const text of written) {
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(TOOLS)
      expect(text).not.toMatch(BARE)
      expect(text).not.toMatch(OLD_INITIALS)
      expect(text).not.toMatch(UNFILLED)
      expect(text).not.toMatch(PENDING)
      expect(proseOf(text)).not.toMatch(HE)
      expect(text).not.toMatch(/\.github\//)
    }
    expect(ws16.split('\n').filter((l) => l.startsWith('|'))).toEqual([])
  })

  it('gives every date the weekday it falls on, and writes every time on the twelve-hour clock', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    for (const text of written.map(proseOf)) {
      for (const found of text.matchAll(new RegExp(`\\b(?:${MONTHS.join('|')}) \\d{1,2}\\b`, 'g'))) {
        expect(text.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
      }
      for (const [whole, weekday, month, day, year] of text.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${MONTHS.join('|')}) (\\d{1,2}), (\\d{4})`, 'g'))) {
        expect(WEEKDAYS[new Date(Date.UTC(Number(year), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
      }
      for (const time of text.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    }
  })

  it('dates the record on a real day, on or after Thursday, November 12, 2026, the day of the round', () => {
    expect(date).not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-12').toBe(true)
  })
})
