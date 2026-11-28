// test/unit/redesign-status-ws09-x-review.test.ts
//
// REDESIGN_STATUS.md records checkpoint X at its end: the checkpoint's own
// section, "Checkpoint X: WS09 steps 25 to 31, the public forms", and its
// merge-safety review with the one round of fixes it led to. Like the other
// record tests of WS09, this file reads only the WS09 section, from its
// heading to the WS10 heading. Pinned here: the two blocks, in their order,
// straight after the third taking in and before the four lists while they
// are the latest; the section's parts in order, what the merge does, its one
// list of what is owed before newClubs goes on, with each door's figures read
// from the constants that hold them, and its one numbered list of what K is
// asked; the review's bullets in order, one finding for each of the
// twenty-one that stood and the six refuted; the sentences the review showed
// false, each corrected or closed in its own block, held by their words; the
// Status and PR lines; the Checks line in the forms the close reads, with
// its own figures (the whole tree's count of test files is everyone's, so it
// is not read here); the moved pins against their files; and the plain-language rules over what both
// blocks wrote. No line here reads how a switch ships.
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
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** A mark left where a figure or a word was still to come. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|\\b${'Q' + 'Q'}|\\b${'Q'}[A-Z]{3,}\\b|\\b(?:${['PI' + 'NS', 'CHE' + 'CKS', 'FI' + 'LES', 'FIND' + 'INGS'].join('|')})\\b`)
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
const num = (text: string) => Number(text.replace(/,/g, ''))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### Checkpoint X: WS09 checkpoint W taken in a third time, after the board seats'
const SECTION = '### Checkpoint X: WS09 steps 25 to 31, the public forms'
const REVIEW = '### WS09 checkpoint X: the review of the whole and its fixes'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const section = part(SECTION)
const review = part(REVIEW)
const lines = ws09.split('\n')
const headings = lines.filter((l) => l.startsWith('### '))
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const checksLine = review.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
/** The review is the section's latest block while it stands straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === REVIEW

/** A quoted constant's number in a file's code. */
const figure = (file: string, name: string) => Number(new RegExp(`export const ${name} = (\\d+)`).exec(read(file))?.[1])

/** The twenty-one findings that stood, in the order the review lists them. */
const STOOD = ['A1', 'A2', 'A3', 'B1', 'C1', 'C4', 'D2', 'D3', 'D4', 'D5', 'D6', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'F1', 'F2', 'F3', 'F4']
const REFUTED = ['B2', 'B3', 'C2', 'C3', 'D1', 'D7']
/** The files whose pins moved, each named in Pins moved. */
const MOVED = [
  'test/integration/rate-limit-confirm.test.ts', 'test/integration/rate-limit-confirm-edges.test.ts', 'test/unit/club-confirm-page-limit.test.tsx',
  'test/integration/club-rep-requests.test.ts', 'test/integration/contracts/club-rep-requests.test.ts', 'test/unit/rep-request-rows.test.tsx',
  'test/unit/my-region-suggestions.test.tsx', 'test/unit/club-request-rows.test.tsx', 'test/unit/suggestion-domain.test.ts', 'test/integration/club-reports-edges.test.ts',
  'test/unit/fixtures/suggestion-rows-base-markup.json', 'test/unit/overdue-suggestions-button.test.tsx', 'test/integration/club-reports.test.ts',
  'test/integration/club-suggest-club.test.ts', 'test/integration/club-suggest-club-edges.test.ts', 'test/integration/club-rep-requests-edges.test.ts',
  'test/integration/club-report-clock.test.ts', 'test/integration/club-report-clock-edges.test.ts', 'test/unit/club-report-clock.test.ts', 'test/unit/suggest-update-sheet.test.tsx',
  'test/integration/club-contact-relay-edges.test.ts', 'test/unit/contact-relay-source.test.ts', 'test/unit/contact-relay-form.test.tsx', 'test/unit/contact-relay-form-edges.test.tsx',
  'test/unit/club-page-bare.test.tsx', 'test/unit/club-page-rest.test.tsx', 'test/unit/club-page-edges.test.tsx', 'test/unit/club-reply-page.test.tsx', 'test/unit/club-reply-page-edges.test.tsx',
  'test/unit/redesign-status-ws09-step1.test.ts', 'test/unit/redesign-status-ws09-w-review.test.ts', 'test/unit/redesign-status-ws09-x-takes-w.test.ts', 'test/unit/redesign-status-ws09-x-takes-w-2.test.ts',
]
const SELF = 'test/unit/redesign-status-ws09-x-review.test.ts'

describe('REDESIGN_STATUS.md, checkpoint X: the section and the review, in their places', () => {
  it('stands once each, the section then the review, straight after the third taking in, and before the four lists while the review is the latest', () => {
    expect(section).not.toBe('')
    expect(review).not.toBe('')
    for (const heading of [SECTION, REVIEW]) expect(ws09.split(`\n${heading}\n`), heading).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(SECTION)
    expect(headings[headings.indexOf(SECTION) + 1]).toBe(REVIEW)
    if (latest) expect(headings[headings.indexOf(REVIEW) + 1]).toBe(LISTS[0])
  })
})

describe('the checkpoint\'s own section', () => {
  it('says what the checkpoint is, with each step and its commit, and has its parts in the form of checkpoint W\'s', () => {
    const opening = section.split('\n')[2] ?? ''
    for (const piece of ['WS09 steps 25 to 31', '`redesign/ws09-clubs-x`', '`d0779a4`', '`01fb87d`', '`655bd3d`', '`1747c58`', '`8932948`', '`8d21b19`', '`6786cba`', '`380ff75`', '`ddfe636`', '`a3b69ed`', 'draft pull request 154', '`85f20ec`', 'waits for its own draft pull request and K\'s word']) {
      expect(opening, piece).toContain(piece)
    }
    const parts = ['- **The steps.**', '- **What the merge carries.**', '- **What the merge does.**', '- **What ships with every switch as shipped.**', '- **Owed before newClubs goes on.**', '- **What K is asked.**', '- **The way a revert goes.**']
    const at = parts.map((p) => section.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const steps = bullet(section, '- **The steps.**')
    for (const n of [25, 26, 27, 28, 29, 30, 31]) expect(steps, `step ${n}`).toContain(`  - Step ${n}, `)
  })

  it('says what the merge carries as one list, and what it does: the one migration, run alone after 0072 and 0073, and the worker deployed with the same bundle', () => {
    const carries = bullet(section, '- **What the merge carries.**')
    for (const piece of ['`migrations/0071_rate_limits.sql`', '`rate_limits`', '`POST /api/clubs/:id/contact`', '`GET` and `POST /api/clubs/reply/:token`', '`/clubs/suggest`', '`test/integration/harness.ts`', 'Wednesday, November 18, 2026']) {
      expect(carries, piece).toContain(piece)
    }
    expect(carries).not.toMatch(/agreed/i)
    expect(existsSync(join(ROOT, 'migrations/0071_rate_limits.sql'))).toBe(true)
    const does = bullet(section, '- **What the merge does.**')
    for (const piece of ['"Apply database migrations"', 'one new empty table', 'Production has run 0072 and 0073 and runs 0071 alone after both', '`deploy-worker.yml`', 'with the same bundle', '76.61 KiB, gzip 20.53 KiB', 'Nothing else']) expect(does, piece).toContain(piece)
    for (const dir of ['functions/utils/**', 'domain/**']) expect(read('.github/workflows/deploy-worker.yml'), dir).toContain(`'${dir}'`)
  })

  it('says what ships with every switch as shipped, the one sentence of the confirm link and the reads with no row among it', () => {
    const ships = bullet(section, '- **What ships with every switch as shipped.**')
    const words = /export const LINK_TOO_OFTEN = '([^']+)'/.exec(read('functions/api/clubs/confirm/[token].ts'))?.[1] ?? ''
    expect(words).toBe('This link has been opened too many times this hour. Try again in an hour.')
    expect(ships).toContain(`"${words}"`)
    for (const piece of ['`GET /api/workspace/region` makes up to three more', '`GET /api/admin/clubs/:id` makes two more', '`hasOpenSuggestion`', 'to the byte']) expect(ships, piece).toContain(piece)
  })

  it('carries the one whole list of what is owed before newClubs goes on, with each door\'s figures from the constants that hold them, and without the item that is met', () => {
    const owed = bullet(section, '- **Owed before newClubs goes on.**')
    for (const piece of ['`TURNSTILE_SECRET_KEY`', '`VITE_TURNSTILE_SITE_KEY`', 'set by K\'s own hands', 'the sending service takes 100 emails a day', 'two held lines', 'step 15\'s monthly check and step 29\'s fourteen days', 'keeps an address refused apart from a message the service may have taken', 'a 500, a 502, a 504, a 408 and a request with no answer read \'never\'', '`deliverEmail` is not exported', 'A busy service and the walk to the next keeper (WS09 checkpoint X).']) {
      expect(owed, piece).toContain(piece)
    }
    expect(owed).not.toContain('refuses no dead address')
    const contact = 'functions/api/clubs/[id]/contact.ts'
    const reports = 'functions/api/clubs/[id]/reports.ts'
    const requests = 'functions/api/clubs/reports.ts'
    const reps = 'functions/api/clubs/[id]/rep-requests.ts'
    const toClub = figure(contact, 'MESSAGES_AN_HOUR_TO_ONE_CLUB')
    expect(owed).toContain(`${figure(contact, 'MESSAGES_AN_HOUR_FROM_ONE_PLACE')} messages an hour from one place, ${toClub} an hour to one club`)
    expect(owed).toContain(`${toClub} × (1 + R + A) an hour and 24 × ${toClub} × (1 + R + A) = ${24 * toClub} × (1 + R + A) a day`)
    expect(owed).toContain(`${figure(reports, 'SUGGESTIONS_AN_HOUR_FROM_ONE_PLACE')} an hour from one place, ${figure(reports, 'SUGGESTIONS_AN_HOUR_TO_ONE_CLUB')} an hour to one club`)
    const keeper = figure(requests, 'CLUB_REQUESTS_AN_HOUR_TO_ONE_KEEPER')
    expect(owed).toContain(`${keeper} × R an hour and ${24 * keeper} × R a day`)
    const repKeeper = figure(reps, 'REP_REQUESTS_AN_HOUR_TO_ONE_KEEPER')
    expect(owed).toContain(`${figure(reps, 'REP_REQUESTS_AN_HOUR_FROM_ONE_MEMBER')} an hour from one member, ${repKeeper} an hour counted at the region and ${repKeeper} at the admins`)
    expect(owed).toContain(`${repKeeper} × A an hour and ${24 * repKeeper} × A a day`)
    expect(owed).toContain(`${toClub} × 5 = 100 emails in an hour`)
    // The day's bound points at its own numbered choice in the list for K.
    const pointed = /A day's bound on the forms' emails, choice (\d+) below\./.exec(owed)?.[1]
    const askedLines = bullet(section, '- **What K is asked.**').split('\n')
    const numbered = askedLines.find((l) => /^\s+\d+\. A day's bound on the forms' emails/.test(l)) ?? ''
    expect(pointed).toBeDefined()
    expect(pointed).toBe(/^\s+(\d+)\. /.exec(numbered)?.[1])
  })

  it('asks K everything in one numbered list, grouped by what a person meets, with this review\'s choices among it', () => {
    const asked = bullet(section, '- **What K is asked.**')
    expect(asked).toContain('all recommended')
    const numbered = asked.split('\n').filter((l) => /^\s+\d+\. /.test(l))
    expect(numbered.map((l) => Number(/^\s+(\d+)\. /.exec(l)?.[1]))).toEqual(numbered.map((_, i) => i + 1))
    expect(numbered.length).toBeGreaterThanOrEqual(20)
    const groups = asked.split('\n').filter((l) => /^ {2}- [^:]+:$/.test(l)).map((l) => l.trim())
    expect(groups).toEqual(['- A visitor\'s forms:', '- A keeper\'s rows and emails:', '- Who may do what:', '- Before the forms go on:'])
    const choice = (words: string) => numbered.find((l) => l.includes(words)) ?? ''
    expect(choice('Who may name a club\'s rep')).toMatch(/a region's representative and an LCA admin, built, .*member directory.*; or only with a second factor; or LCA admins alone/)
    expect(choice('reads the member directory at all')).toContain('US Chess IDs')
    expect(choice('Help on the Contact form and the reply page')).toMatch(/small question marks, built by K's decision 16; or the Help button and panel as they were/)
    expect(choice('A day\'s bound on the forms\' emails')).toMatch(/wait for the association's own sending before the forms go on, recommended, .*; or have a day's ceiling for the forms' emails built first/)
    for (const line of numbered) expect(line, line).toMatch(/built|recommended|for K to confirm/)
  })

  it('says the way a revert goes', () => {
    const revert = bullet(section, '- **The way a revert goes.**')
    for (const piece of ['puts back checkpoint W\'s site', '`rate_limits`', 'migration 0071 is not taken back by a revert', 'it goes off first']) expect(revert, piece).toContain(piece)
  })
})

describe('the review\'s block', () => {
  it('has its bullets in order, one finding for each of the twenty-one that stood, by its id, and the six refuted with why', () => {
    const parts = ['- **What this is.**', '- **Findings and fixes.**', '- **The Status and PR lines.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Follow-ups.**', '- **Judgement calls.**', '- Checks:', '- **Files.**', '- **Branch.**']
    const at = parts.map((p) => review.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(review, '- **What this is.**')).toContain('Twenty-seven were reported and twenty-one stood')
    const findings = bullet(review, '- **Findings and fixes.**').split('\n').filter((l) => /^ {2}- /.test(l))
    expect(findings.map((l) => /^ {2}- (\w\d),/.exec(l)?.[1] ?? l.slice(4, 29))).toEqual([...STOOD, 'Refuted, and not acted on:'.slice(0, 25)])
    const refuted = findings.at(-1)!
    for (const id of REFUTED) expect(refuted, id).toMatch(new RegExp(`\\b${id}, since `))
  })

  it('says what ships with every switch off, and the readers\' read counts', () => {
    const ships = bullet(review, '- **What ships with every switch off.**')
    for (const piece of ['but the one sentence of A1', 'of which none exists', 'to the byte', '`test/a11y/baseline.json` is the base\'s to the byte', 'reads a switch\'s shipped value']) expect(ships, piece).toContain(piece)
  })

  it('names the harness\'s hunks as announced, never as agreed', () => {
    const a3 = bullet(review, '- **Findings and fixes.**').split('\n').find((l) => l.startsWith('  - A3,')) ?? ''
    for (const piece of ['three hunks', '29 lines', 'announced to the mail work on Wednesday, November 18, 2026, before step 25 was built', 'shown to it again with this checkpoint\'s pull request', 'Nothing in the harness changes']) expect(a3, piece).toContain(piece)
    expect(a3).not.toMatch(/agreed/i)
  })

  it('names each moved pin by its file, each file standing in the tree', () => {
    const pins = bullet(review, '- **Pins moved.**')
    for (const file of MOVED) {
      expect(pins, file).toContain(`\`${file}\``)
      expect(existsSync(join(ROOT, file)), file).toBe(true)
    }
  })

  it('writes the Checks line in the forms the close reads, with the base\'s figures beside', () => {
    expect(checksLine).toMatch(/`npm run lint` 13 errors and 11 warnings over [\d,]+ files \(1,507 on the base\)/)
    expect(checksLine).toMatch(/unit [\d,]+ tests in \d+ files \(13,169 in 606 on the base\)/)
    expect(checksLine).toMatch(/integration [\d,]+ in \d+ files \(3,927 in 219 on the base\), every one passing, with the one todo beside them/)
    expect(checksLine).not.toMatch(/\d that run in \d/)
    const unit = /unit ([\d,]+) tests in (\d+) files/.exec(checksLine)!
    expect(num(unit[1])).toBe(13211)
    expect(num(unit[2])).toBe(609)
    const integration = /integration ([\d,]+) in (\d+) files/.exec(checksLine)!
    expect(num(integration[1])).toBe(3939)
    expect(num(integration[2])).toBe(220)
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`')
    expect(checksLine).toContain('a local production build')
  })

  it('names its new files with their counts, and its branch', () => {
    const files = bullet(review, '- **Files.**')
    for (const file of [SELF, 'test/unit/clubs-words-one-meaning.test.ts', 'test/unit/club-forms-review-edges.test.ts', 'test/integration/club-forms-busy-service-edges.test.ts']) {
      expect(files, file).toContain(`\`${file}\` (${(read(file).match(/^\s*it\(/gm) ?? []).length}: `)
    }
    expect(bullet(review, '- **Branch.**')).toContain('`redesign/ws09-clubs-x`, at `a3b69ed`')
  })
})

describe('the sentences the review showed false, each corrected in its own block', () => {
  it('step 25\'s sentence on the worker now holds both halves true', () => {
    const step25 = part('### WS09 step 25: the limit and the spam check')
    expect(step25).not.toContain('so it is not redeployed by it')
    expect(step25).toContain('No file the daily-emails worker imports changes, so its bundle is as before; `deploy-worker.yml` still runs on the merge\'s push, since files under `functions/utils/` change, and deploys that same bundle.')
  })

  it('the four lists of steps 28 to 31 each close the met item in one sentence, and the verify item does too', () => {
    const met = 'It is met: `MAIL_LISTS_ON` has been set on `main` since the mail work\'s switch-on, `26f0520`, on Mon, Nov 16, 2026, and on this branch since the taking in of `8932948` on Tue, Nov 24, 2026, before step 28, so the gate refuses a dead address as shipped;'
    for (const heading of ['### WS09 step 28: Suggest an update', '### WS09 step 29: the fourteen-day step', '### WS09 step 30: Suggest a club, or start one', '### WS09 step 31: Ask to be its named rep']) {
      const owed = bullet(part(heading), '- **Owed before newClubs goes on.**')
      const item = owed.split('\n').find((l) => l.includes('refuses no dead address')) ?? ''
      expect(item, heading).toContain('the representative never hearing of it. ' + met)
    }
    const verify = part('### WS09 verify items resolved').split('\n').find((l) => l.startsWith('- **A dead address (WS09 step 26).**')) ?? ''
    expect(verify).toContain('or for a refusal by the service. It is met since: `MAIL_LISTS_ON` has been set on `main` since the mail work\'s switch-on, `26f0520`')
  })

  it('the two follow-ups on the browser builds\' keys each gain one closing sentence and lose none', () => {
    const followUps = part('### WS09 follow-ups').split('\n')
    const closing = ' No later step bound them: each form\'s browser spec stands the widget in and answers its own POST, so the keys are bound for the browser builds, if ever, by the change that turns the first public form on, which is K\'s.'
    const keys = followUps.find((l) => l.startsWith('- **The test keys in the browser builds (WS09 step 25).**')) ?? ''
    expect(keys).toBe('- **The test keys in the browser builds (WS09 step 25).** The browser setup holds both key names empty; the step that first draws a form with the check binds the provider\'s published test keys for the browser builds, and takes the two names out of that list, or the form\'s browser test meets a refusal.' + closing)
    const form = followUps.find((l) => l.startsWith('- **The form in the browser builds (WS09 step 26).**')) ?? ''
    expect(form).toBe('- **The form in the browser builds (WS09 step 26).** The browser setup still holds the spam check\'s two key names empty, so the form there says the check didn\'t load; no browser test of this step sends it, and the step that adds the form\'s browser test binds the provider\'s test keys.' + closing)
  })

  it('adds the review\'s two follow-ups, tagged for checkpoint X, last of the list while the review is the latest', () => {
    const entries = part('### WS09 follow-ups').split('\n').filter((l) => l.startsWith('- **'))
    const ours = ['- **A busy service and the walk to the next keeper (WS09 checkpoint X).** ', '- **A send with no answer holds a sheet (WS09 checkpoint X).** ']
    for (const start of ours) expect(entries.filter((l) => l.startsWith(start)), start).toHaveLength(1)
    if (latest) expect(entries.slice(-2).map((l) => ours.find((s) => l.startsWith(s)))).toEqual(ours)
  })
})

describe('the Status and PR lines', () => {
  it('say what is true on the day: checkpoint X built and reviewed and waiting for its own pull request, checkpoint W in draft pull request 154, and the question marks\' words in pull request 151', () => {
    expect(statusLine).toContain('checkpoint X, steps 25 to 31, is built and reviewed on `redesign/ws09-clubs-x`, cut from checkpoint W\'s head, holds checkpoint W and `main` as it stands, at `85f20ec`, and waits for its own draft pull request and K\'s word')
    expect(statusLine).not.toContain('checkpoint X is under way')
    const tail = statusLine.slice(statusLine.lastIndexOf('; ') + 2)
    if (latest) expect(tail).toContain('checkpoint W taken into checkpoint X a third time, after the board seats, checkpoint X\'s review and its fixes, K\'s answers')
    expect(tail).toMatch(/\bbuilt\.$/)
    expect(statusLine).toContain('waits in draft pull request 154 for K\'s word')
    expect(prLine).toContain('checkpoint W, steps 20 to 24, is built and reviewed on `redesign/ws09-clubs-w` and waits in draft pull request 154 for K\'s word for its merge')
    expect(prLine).toContain('checkpoint X, steps 25 to 31, is built and reviewed on `redesign/ws09-clubs-x`, holds checkpoint W and `main` at `85f20ec`, and waits for its own draft pull request and K\'s word for its merge')
    expect(prLine).toContain('the question marks\' words, K\'s note on the bubbles, wait in pull request 151 for K\'s word.')
    expect(prLine.endsWith('.')).toBe(true)
  })
})

describe('the plain-language rules over both blocks', () => {
  it('keeps the dashes, the working words, any tool\'s name, the old initials, unfilled marks and a he out, and writes every date with its weekday', () => {
    for (const [name, text] of [['section', section], ['review', review]] as const) {
      expect(text, name).not.toMatch(DASHES)
      expect(proseOf(text), name).not.toMatch(BANNED)
      expect(text, name).not.toMatch(TOOLS)
      expect(proseOf(text), name).not.toMatch(BARE)
      expect(text, name).not.toMatch(OLD_INITIALS)
      expect(text, name).not.toMatch(UNFILLED)
      expect(proseOf(text), name).not.toMatch(HE)
      for (const date of text.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, 2026\b/g)) {
        const before = text.slice(Math.max(0, date.index - 12), date.index)
        expect(before, `${name}: ${date[0]}`).toMatch(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
      }
      expect(text, name).not.toMatch(/\b\d{1,2}\s?(?:am|pm)\b/i)
    }
  })
})
