// test/unit/redesign-status-ws16-step5.test.ts
//
// REDESIGN_STATUS.md records WS16 step 5: Group email's newsletter tab, the
// two pages a member's link opens, and the daily run's reminders. Like the
// record tests of WS16 steps 1 to 4, this file reads only the WS16 section,
// from its heading to the Phase 0 heading, and the date at the start of the
// date line, never every table row or heading of the file, and it reads no
// count or figure from the code. Pinned here: the Status line's tail while
// this step is the latest; the block's place and its parts in order, its
// files with their counts, which must add up, and its figures, the worker's
// against part one's ceiling; the sentences this step added to six map
// items, each ahead of its planned step and behind the earlier steps' own
// sentences, which stay; the close it added to two follow-ups, whose earlier
// words stay; this step's entries in the four lists, each with its tag; the
// plain-language rules over everything this step wrote; and the date, any
// real day from Wednesday, November 11, 2026 on. The new files are read only
// to find them and to hold them to the plain-language rules.
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
/** What a draft would hold before its figures were filled in: the earlier records' marks, and a word of eight capitals or more. */
const UNFILLED = new RegExp(
  `${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}|${'T' + 'BD'}`,
)
const CAPITALS = /\b[A-Z0-9]{8,}\b/
/** The merge-pending phrase, which the file holds once, in WS01 step 32's line, and this section never. */
const PENDING = new RegExp(`checkpoint D's merge is ${'pen' + 'ding'}|merge into \`main\` is ${'pen' + 'ding'}`)
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
const TAG = '(WS16 step 5).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))

const HEADING = '## WS16: Mail (the mail engine, lists and the LCA newsletter)'
/** The WS16 section, from its heading to the Phase 0 heading. */
const ws16 = between(status, `\n${HEADING}\n`, '\n## Phase 0:')
const sectionLines = ws16.split('\n')
/** A part of the section, from its heading, a line of its own, to the next. */
const part = (heading: string) => {
  const at = ws16.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws16.slice(at + 1), heading, '\n### ')
}
const STEP_FOUR = '### WS16 step 4: the newsletter list and the engine\'s rules'
const STEP = '### WS16 step 5: Group email\'s newsletter tab, the two member pages and the daily run\'s reminders'
const LISTS = ['### WS16 decisions', '### WS16 deviations from the brief', '### WS16 verify items resolved', '### WS16 follow-ups']
const map = part('### WS16 map: what proves each acceptance criterion and decision')
const block = part(STEP)
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
/** The follow-ups, the section's last part, to its end. */
const followUps = ws16.includes(`\n${LISTS[3]}\n`) ? ws16.slice(ws16.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const statusLine = sectionLines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItem = (id: string) => entries(map).find((l) => l.startsWith(`- **${id}.**`)) ?? ''
/** What this step added to a map item: from its sentence to the start of the planned step. */
const added = (id: string, start: string) => {
  const item = mapItem(id)
  const at = item.indexOf(start)
  return at < 0 ? '' : item.slice(at, item.search(/ Planned: WS16 step \d+\.$/))
}
/** The date at the start of the date line, the one piece of that line a step writes. */
const date = /^Last updated: (\d{4})-(\d{2})-(\d{2}) \(/.exec(status.split('\n').find((l) => l.startsWith('Last updated:')) ?? '')
/** The highest step of WS16 with a block of its own: this step's tail of the Status line holds only while it is the latest. */
const latestStep = Math.max(0, ...[...ws16.matchAll(/^### WS16 step (\d+): /gm)].map((m) => Number(m[1])))

const STATUS_PREFIX =
  '**Status:** in progress: part one, the mail engine and the first LCA newsletter, twelve steps in three checkpoints (checkpoint M for steps 1 to 8, checkpoint N for steps 9 to 11, checkpoint O for step 12); '
const TAIL = 'steps 1 to 5 are built.'

/** The sentences this step adds to the map for the items it proves, each planned for this step. */
const PROVED: ReadonlyArray<readonly [string, string]> = [
  ['AC9', 'Proved in WS16 step 5 by `test/unit/email-choice-pages.test.tsx`: '],
  ['D40', 'Proved in WS16 step 5 by `test/unit/redesign-status-ws16-step5.test.ts`, `test/unit/admin-email-newsletter.test.tsx` and `test/unit/email-choice-pages.test.tsx`: '],
  ['Q45', 'Proved in WS16 step 5 by `test/unit/admin-email-newsletter.test.tsx`: '],
]
/** The items other steps prove that this step builds a part of, with the step planned to prove each. */
const BUILT: ReadonlyArray<readonly [string, number]> = [['AC7', 3], ['AC11', 6], ['AC12', 4]]
/** The earlier steps' sentences on the items this step adds to, which stay word for word, ahead of this step's. */
const EARLIER: ReadonlyArray<readonly [string, string]> = [
  ['AC7', 'Proved in WS16 step 3 by `test/unit/mail-links.test.ts` and `test/integration/mail-email-choices.test.ts`: a link is signed under `MAIL_LINK_SECRET`'],
  ['AC9', 'Built in WS16 step 3: the endpoint the page reads and saves through, `/api/mail/preferences/:token`'],
  ['AC11', 'Built in WS16 step 4: `requireListMailer` in `functions/utils/auth.ts`, the guard of the newsletter\'s four methods'],
  ['AC12', 'Proved in WS16 step 4 by `test/integration/campaigns-once.test.ts` and `test/unit/mail-plan.test.ts`: on the free plan\'s sizes'],
]

/** The files this step adds. */
const NEW_FILES = [
  'src/pages/EmailUnsubscribePage.tsx', 'src/pages/EmailPreferencesPage.tsx', 'src/areas/membership/components/EmailChoiceParts.tsx',
  'test/integration/mail-reminders-left.test.ts', 'test/unit/admin-email-newsletter.test.tsx', 'test/unit/email-choice-pages.test.tsx',
  'test/unit/email-choice-app-routes.test.tsx', 'test/unit/fixtures/admin-email-today.tsx', 'test/unit/redesign-status-ws16-step5.test.ts',
]
const NEW_UNIT = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new files that are code or tests, which lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.tsx?$/.test(f))
/** The files of code, fixture and record this step changes. */
const CHANGED = [
  'src/pages/AdminEmailPage.tsx', 'src/areas/admin/api.ts', 'src/areas/membership/api.ts', 'src/areas/admin/components/AuditLogPanel.tsx', 'src/App.tsx',
  'workers/daily-emails/src/index.ts', 'functions/utils/membership/ratingSnapshots.ts', 'functions/utils/mail/plan.ts', 'functions/utils/mail/lists.ts',
  'domain/contracts/mail.ts', 'test/integration/mailRuns.ts', 'test/unit/fixtures/api-added-since-split.json', 'REDESIGN_STATUS.md',
]
/** The test files this step changes, each with its count written in the block, unit and integration apart. */
const CHANGED_UNIT = [
  'test/unit/api-split-modules.test.ts', 'test/unit/api-split-records-closed.test.ts', 'test/unit/app-routes.test.tsx', 'test/unit/goldText.test.ts',
  'test/unit/redesign-status-ws16-step4.test.ts', 'test/unit/base-components-scope.test.ts',
]
const CHANGED_INTEGRATION = [
  'test/integration/newsletter.test.ts', 'test/integration/contracts/newsletter.test.ts', 'test/integration/mail-gate.test.ts', 'test/integration/mail-gate-edges.test.ts',
]
/** The unit test file whose count grows with no change of its own. */
const GROWN = ['test/unit/route-audit.test.ts']

/** The heads of this step's entries in the four lists, in their order. */
const HEADS = {
  decisions: ['Build once (WS16 step 5).'],
  deviations: [
    'Group email\'s member groups wait for a list of their own (WS16 step 5).',
    'No new browser spec (WS16 step 5).',
    'Explaining words sit behind Help (WS16 step 5).',
  ],
  verify: [
    'Group email\'s tabs and its preview (WS16 step 5).',
    'Where Group email lives (WS16 step 5).',
    'The not-found route (WS16 step 5).',
    'The route audit, the split\'s fixtures and the pins this step moves (WS16 step 5).',
    'A browser spec for the two pages (WS16 step 5).',
    'Where a waiting newsletter\'s words are written (WS16 step 5).',
    'A lookup that finds nothing (WS16 step 5).',
    'The files read as the base has them (WS16 step 5).',
  ],
  followUps: ['The test through Amazon SES, read from WS16 step 7 (WS16 step 5).'],
}

/** The two follow-ups of earlier steps that this step closes. */
const REMINDERS = 'The attendee and week-before reminders a run leaves (WS16 step 2).'
const WAITS = 'Why a newsletter waits, on its tab (WS16 step 4).'
const CLOSE = ' Done in WS16 step 5: '
const followUp = (name: string) => entries(followUps).find((l) => head(l) === name) ?? ''
/** A follow-up's words before this step's close. */
const beforeClose = (name: string) => followUp(name).split(CLOSE)[0]
/** This step's close of a follow-up, to the end of the entry. */
const closeOf = (name: string) => (followUp(name).includes(CLOSE) ? followUp(name).slice(followUp(name).indexOf(CLOSE)) : '')

describe('REDESIGN_STATUS.md, WS16 step 5: the Status line', () => {
  it('keeps the fixed prefix and gives this step\'s tail while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(5)
    if (latestStep === 5) expect(tail).toBe(TAIL)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 5: the block', () => {
  it('sits right after WS16 step 4\'s block and before the four lists, once', () => {
    expect(ws16.split(`\n${STEP}\n`)).toHaveLength(2)
    const at = [STEP_FOUR, STEP, LISTS[0]].map((h) => ws16.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // Nothing between the two blocks but step 4's own, and nothing between this block and the decisions but itself and what a
    // later step adds there: its own block, "### WS16 step 6: ..." and on, or a checkpoint's section.
    const later = (l: string) => /^### WS16 step (?:[6-9]|1[0-2]): \S/.test(l) || /^### Checkpoint [MNO]: WS16 (?:steps \d+ to \d+|step \d+)$/.test(l)
    expect(ws16.slice(at[0], at[1]).split('\n').filter((l) => l.startsWith('### '))).toEqual([STEP_FOUR])
    expect(ws16.slice(at[1], at[2]).split('\n').filter((l) => l.startsWith('### ') && !later(l))).toEqual([STEP])
    expect(later('### WS16 step 6: a later block')).toBe(true)
    expect(later('### Checkpoint M: WS16 steps 1 to 8')).toBe(true)
    expect(later('### Step 6: a stray heading')).toBe(false)
    expect(later('### WS16 step 4: an earlier block')).toBe(false)
  })

  it('has every part, in order, each a bullet of its own, and says what a visitor or a member meets', () => {
    const parts = [
      '- **Files.**', '- **Group email.**', '- **The two pages.**', '- **What a member sees.**', '- **Later homes.**', '- **The daily run\'s reminders.**',
      '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- **Worker.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(block.split('\n').filter((l) => l.startsWith('- Checks:'))).toHaveLength(1)
    expect(block).toContain('what a visitor or a member meets, by switch, is nothing new')
  })

  it('names every file it adds and changes, each test with its count, and the files beyond the step\'s list', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT, ...CHANGED_INTEGRATION, ...GROWN]) expect(files, name).toContain(`\`${name}\``)
    for (const name of [...NEW_UNIT, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of [...CHANGED_UNIT, ...CHANGED_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before)[:)]`))
    for (const name of GROWN) expect(bullet(files, '  - Grown with no change:'), name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, \\d+ before: `))
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const name of [
      'src/areas/membership/components/EmailChoiceParts.tsx', 'test/unit/email-choice-app-routes.test.tsx', 'test/unit/fixtures/admin-email-today.tsx',
      'test/unit/api-split-records-closed.test.ts', 'test/unit/redesign-status-ws16-step4.test.ts', 'domain/contracts/mail.ts', 'functions/utils/mail/lists.ts',
      'test/integration/newsletter.test.ts', 'test/integration/contracts/newsletter.test.ts',
    ]) {
      expect(beyond, name).toContain(`\`${name}\``)
    }
  })

  it('gives Group email its tab, its words where they sit, the preview from the one source of the footer\'s words, the send, the stop and the recent sends', () => {
    const tab = bullet(block, '- **Group email.**')
    for (const piece of [
      '"The LCA newsletter list"', '"Specific people"', 'Groups of members', '"Send the LCA newsletter, or a note to specific people."', '`getNewsletter()`',
      '"{willGet} addresses will get it."', '"Who gets it"', '`aria-expanded`', '`aria-controls`',
      '"Every address on an account with an active membership, once. Left out: {turnedOff + stoppedAll} who turned the newsletter off and {doNotSend} that no longer receive mail."',
      '"It goes from {from}."', 'no filters, no review list', '`BrandedEmailPreview`', '`domain/mail/footer.ts`', 'no postal address',
      '"The newsletter goes out through Amazon SES, which this site does not send through yet. You can write it and send yourself a test now."',
      '"Send to the LCA newsletter list ({willGet} addresses)?"', '`sendNewsletter`', 'in the server\'s own words', '"Stop sending"',
      '"Stop the newsletter? Addresses not yet reached won\'t get it."', '"Stopped. {n} addresses were not sent it."', '`CampaignRow`', 'every 3 seconds',
      '`waits`', '`sendNewsletterTest`', '"Send the test through Amazon SES"', 'does not read until WS16 step 7', 'so the box changes nothing yet',
      'the newsletter\'s and the history\'s alike', '`{ stored: \'utc\' }`', '"Tue, Nov 3, 2026 · 9:00 AM"',
      '`lca-newsletter-help`', 'try and catch', '"Stopped a newsletter"', 'the address map\'s choice 6',
      '"Name the newsletter in the subject, put member news first, and paste links by hand, a tournament\'s King Registration link included. A renewal reminder is a separate email."',
      '"Each email carries an unsubscribe link and an email preferences link."',
      '"For a note about a person\'s own membership, entry or request. News goes to the LCA newsletter list, which honors each person\'s choices."',
    ]) expect(tab, piece).toContain(piece)
  })

  it('gives the two pages their words, their one request on load that changes nothing, the one POST on the one button, the status regions and their routes', () => {
    const pages = bullet(block, '- **The two pages.**')
    for (const piece of [
      '`/email/unsubscribe/:token`', '`/email/preferences/:token`', 'always mounted', 'no catch-all', '`unsubscribeLinkStatus`', '`getEmailChoices`', 'changes nothing',
      '`test/unit/email-choice-app-routes.test.tsx` holds with the whole site drawn',
      'no sign-in header', 'never into a log or the page\'s title', 'unless its request answers 200',
      '"This link isn\'t working. Use the link in the latest LCA newsletter, or write to us through the Contact page."', '"That didn\'t go through. Try again."',
      '"Stop the LCA newsletter?"', '"This stops the LCA newsletter at this address."',
      '"You\'ll still get email about your membership, registrations, payments and support requests."', '"Unsubscribe"', '`unsubscribeByLink`',
      'never a POST on load', '"Done. The LCA newsletter won\'t come to this address any more."', '"Change your email choices"', 'No address is shown',
      '"Your email choices"', '"For {masked address}."', '"LCA newsletter"', '"News from the Louisiana Chess Association."', '"Stop all optional email from LCA"',
      '"Save my choices"', '"Saved."', 'takes the focus', '"The LCA newsletter goes to current members."',
    ]) expect(pages, piece).toContain(piece)
    const member = bullet(block, '- **What a member sees.**')
    for (const piece of ['the footer of every optional email', 'today\'s empty main area', 'one GET, answered 404', 'whatever the switch says']) expect(member, piece).toContain(piece)
  })

  it('gives each page its later home as a list, with what that workstream keeps', () => {
    const homes = bullet(block, '- **Later homes.**')
    expect(homes.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(4)
    for (const piece of [
      'WS08\'s admin home part', 'part two\'s newsletter page', 'WS13 restyles it', '"How we email you"', '`test/a11y/scopes.spec.ts`', '`functions/utils/mail/lists.ts`',
      '`domain/mail/footer.ts`', '`domain/mail/addresses.ts`', '`mail_list_choices`', 'WS16 step 11',
    ]) expect(homes, piece).toContain(piece)
  })

  it('gives the daily run\'s reminders the second try, the gap, the log line, the sums, what is not changed and the checked time', () => {
    const run = bullet(block, '- **The daily run\'s reminders.**')
    for (const piece of [
      '`ReminderBudget`', 'the rows claimed (25 on the free plan) and the sends tried (45 there)', '`again()`', 'three sends at most', '`LATER_TRIES`', '`LATER_WAIT_MS`',
      '`SLOWED_GAP_MS`', 'does not read which kind of later came', 'keeps WS16 step 2\'s rule', '`daily-emails: <count> row(s) of "<phase name>" not sent today`',
      'outside calls at most 45', 'queries unchanged at 43 at most on a day no event closes', 'a second or third send and a wait costing no query',
      '`stampUnanswered`', '`uscf_rating_updated_at` alone', 'the rating and the expiry on file are not written', 'an unreachable service stamps no one',
      '`ratingSnapshots(env)`', '`refreshMemberUscfRating`', 'byte for byte today\'s', 'no wait, no claim, no stamp and no new log line',
    ]) expect(run, piece).toContain(piece)
  })

  it('says nothing a visitor or a member meets ships with every switch off, and what a person who types either address by hand meets', () => {
    const off = bullet(block, '- **What ships with every switch off.**')
    expect(off.startsWith('- **What ships with every switch off.** Nothing a visitor or a member meets.')).toBe(true)
    for (const piece of [
      'Group email is today\'s page, element for element', '`test/unit/fixtures/admin-email-today.tsx`', '`4b9d780`', 'reads and writes no key in the browser',
      'a person who types either address by hand meets today\'s empty main area', 'one GET, answered 404', '"Stopped a newsletter"', '`waits`',
      '`test/a11y/baseline.json` is unchanged', 'This step adds no migration', '`deploy-worker.yml`',
    ]) expect(off, piece).toContain(piece)
  })

  it('lists the pins it moved, each with its figures and its reason', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/unit/fixtures/api-added-since-split.json`', '`test/unit/api-split-modules.test.ts`', 'line 132', 'line 335', 'two to seven',
      '`test/unit/api-split-records-closed.test.ts`', '`*`', '`test/unit/app-routes.test.tsx`', '33 to 35', '`test/unit/goldText.test.ts`',
      '`src/areas/admin/components/AuditLogPanel.tsx:271` to `:272`', '`src/pages/AdminEmailPage.tsx:379`', '`:622`', '`test/unit/redesign-status-ws16-step4.test.ts`',
      '"Sample Winter Open"', '"Sample Spring Swiss"', '29 and 71 before and after', 'gains the spy on `setTimeout`', 'No assertion of either gate suite changes',
    ]) expect(pins, piece).toContain(piece)
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
  })

  it('gives the lint as unchanged, the build against the base with each new or changed file, and each check once', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      '`4b9d780`', 'a local production build', '`index-BGHuXroV.js` at 550,347 bytes', '`index-De3UpPLs.css` at 130,375 bytes', '`features-DxqQlIon.js` at 698 bytes',
      'the route table\'s two entries', 'no line of the two pages', 'a local build\'s figures',
    ]) {
      expect(build, piece).toContain(piece)
    }
    for (const page of ['EmailUnsubscribePage', 'EmailPreferencesPage']) expect(build, page).toMatch(new RegExp(`\`${page}-[\\w-]+\\.js\` \\([\\d,]+ bytes`))
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run with nothing else running beside it')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })

  it('gives the worker\'s dry run on the base and after, measured on their day, with the growth and what is left under part one\'s ceiling of 96 KiB, gzip 28 KiB', () => {
    const worker = bullet(block, '- **Worker.**')
    for (const piece of ['`npx wrangler deploy --dry-run`', '`--config workers/daily-emails/wrangler.toml`', '`4b9d780`', 'Wednesday, November 11, 2026', 'The bundle holds no package.', '96 KiB, gzip 28 KiB', 'no minify setting']) {
      expect(worker, piece).toContain(piece)
    }
    const sizes = [...worker.matchAll(/([\d.]+) KiB, gzip ([\d.]+) KiB/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(sizes.length).toBeGreaterThanOrEqual(2)
    const [base, after] = sizes
    expect(base).toEqual([63.39, 17.01])
    const more = /([\d.]+) KiB more, gzip ([\d.]+) KiB/.exec(worker)
    expect(more, 'the growth').not.toBeNull()
    expect(Number(more![1])).toBeCloseTo(after[0] - base[0], 2)
    expect(Number(more![2])).toBeCloseTo(after[1] - base[1], 2)
    expect(after[0]).toBeLessThan(96)
    expect(after[1]).toBeLessThan(28)
    const left = /leaves ([\d.]+) KiB, gzip ([\d.]+) KiB/.exec(worker)
    expect(left, 'what the ceiling leaves').not.toBeNull()
    expect(Number(left![1])).toBeCloseTo(96 - after[0], 2)
    expect(Number(left![2])).toBeCloseTo(28 - after[1], 2)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 5: the figures add up', () => {
  const files = bullet(block, '- **Files.**')
  const countOf = (name: string) => {
    const m = new RegExp(`\`${escape(name)}\` \\((\\d+)(?:, (\\d+) before|, as before)?[:)]`).exec(files)
    return m ? { now: Number(m[1]), before: Number(m[2] ?? m[1]) } : null
  }

  it('gives unit counts that add up: the base\'s, the new files\' tests, the changed files\' gains and the grown file\'s growth', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([8338, 321])
    const counts = [...NEW_UNIT, ...CHANGED_UNIT, ...GROWN].map((name) => [name, countOf(name)] as const)
    for (const [name, count] of counts) expect(count, name).not.toBeNull()
    const gain = counts.reduce((sum, [name, count]) => sum + (NEW_UNIT.includes(name) ? count!.now : count!.now - count!.before), 0)
    expect(num(before) + gain).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s, the new file\'s and the changed files\' gains', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1547, 94])
    for (const name of [...NEW_INTEGRATION, ...CHANGED_INTEGRATION]) expect(countOf(name), name).not.toBeNull()
    const fresh = NEW_INTEGRATION.reduce((sum, name) => sum + countOf(name)!.now, 0)
    const gains = CHANGED_INTEGRATION.reduce((sum, name) => sum + countOf(name)!.now - countOf(name)!.before, 0)
    expect(num(before) + fresh + gains).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the browser run as one run whose counts add up, and the lint figures as the base\'s with the new files added', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(909)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_LINTED.length)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 5: the map', () => {
  it('adds a sentence of what this step proves to the three items planned for it, once each, ahead of the planned step, and to no other item', () => {
    for (const [id, sentence] of PROVED) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.endsWith('Planned: WS16 step 5.'), id).toBe(true)
      expect(item.indexOf(sentence), id).toBeLessThan(item.indexOf('Planned: WS16 step 5.'))
    }
    expect(entries(map).filter((l) => l.includes('Proved in WS16 step 5 by')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(PROVED.map(([id]) => id))
    for (const piece of ['every list the answer gives', 'one PATCH', '"Saved."', 'takes the focus', '"Stop all optional email from LCA"', 'unticked and off', '"The LCA newsletter goes to current members."']) {
      expect(added('AC9', PROVED[0][1]), piece).toContain(piece)
    }
    for (const piece of ['thin and sit on today\'s pages', 'later workstream']) expect(added('D40', PROVED[1][1]), piece).toContain(piece)
    for (const piece of ['no Groups of members', 'no role, club or status menu', 'Specific people stays for the LCA admins and the president']) {
      expect(added('Q45', PROVED[2][1]), piece).toContain(piece)
    }
  })

  it('adds a sentence that starts "Built in WS16 step 5" to the three items other steps prove, once each, ahead of their planned steps', () => {
    for (const [id, step] of BUILT) {
      const item = mapItem(id)
      expect(item.split('Built in WS16 step 5: '), id).toHaveLength(2)
      expect(item.endsWith(`Planned: WS16 step ${step}.`), id).toBe(true)
      expect(item.indexOf('Built in WS16 step 5: '), id).toBeLessThan(item.indexOf(`Planned: WS16 step ${step}.`))
    }
    expect(entries(map).filter((l) => l.includes('Built in WS16 step 5:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(BUILT.map(([id]) => id))
    for (const piece of ['one request that changes nothing', 'only on its button', 'whatever the switches say', '`test/unit/email-choice-app-routes.test.tsx`']) {
      expect(added('AC7', 'Built in WS16 step 5: '), piece).toContain(piece)
    }
    for (const piece of ['`getNewsletter`', '`stopNewsletter`', 'Groups of members nowhere']) expect(added('AC11', 'Built in WS16 step 5: '), piece).toContain(piece)
    for (const piece of ['25 sent, 30 calls to the mail service and 15 lookups', '45 outside calls', '15 sent in 45 calls']) expect(added('AC12', 'Built in WS16 step 5: '), piece).toContain(piece)
  })

  it('keeps the earlier steps\' sentences on those items word for word, ahead of this step\'s', () => {
    for (const [id, sentence] of EARLIER) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      const ours = Math.max(item.indexOf('Proved in WS16 step 5 by'), item.indexOf('Built in WS16 step 5: '))
      expect(item.indexOf(sentence), id).toBeLessThan(ours)
    }
  })
})

describe('REDESIGN_STATUS.md, WS16 step 5: the close of two follow-ups', () => {
  it('closes the reminders WS16 step 2 handed on after WS16 step 4\'s choice, the earlier words as they were, with what is built and what is still not sent', () => {
    const entry = followUp(REMINDERS)
    expect(entry.split(CLOSE)).toHaveLength(2)
    expect(beforeClose(REMINDERS).startsWith(`- **${REMINDERS}** Under the engine's rules a daily run on the free plan claims 25 reminder rows at most, and an outcome of later ends its phase.`)).toBe(true)
    expect(beforeClose(REMINDERS).endsWith('a lookup that answers with no rating having been stamped all along.')).toBe(true)
    expect(entry.endsWith('.')).toBe(true)
    for (const piece of [
      'three sends at most', 'half a second', '`test/integration/mail-reminders-left.test.ts`', 'a day with more than 25 attendee and week-before reminders together sends 25',
      'one event with more than 25 paid entrants reaches on each of its reminder days', 'the query having no order of its own, very likely the same 25 people each time',
      'a reminder still answered later after its three sends, and the rows after it in that phase', 'a run cut during a wait leaves that one row marked and unsent',
      'goes to the worker\'s log, which nothing keeps', 'Workers Paid removes the cap',
    ]) expect(closeOf(REMINDERS), piece).toContain(piece)
  })

  it('closes why a newsletter waits, with the summary\'s new field, its contract and the tab, and closes no other entry', () => {
    const entry = followUp(WAITS)
    expect(entry.split(CLOSE)).toHaveLength(2)
    expect(beforeClose(WAITS).endsWith('so a sender sees why it waits.')).toBe(true)
    for (const piece of ['`waits`', '`newsletterSummary`', '`domain/contracts/mail.ts`', '`test/integration/newsletter.test.ts`', '`test/integration/contracts/newsletter.test.ts`', 'status region']) {
      expect(closeOf(WAITS), piece).toContain(piece)
    }
    expect(entries(ws16).filter((l) => l.includes(' Done in WS16 step 5:')).map(head).sort()).toEqual([REMINDERS, WAITS].sort())
  })
})

describe('REDESIGN_STATUS.md, WS16 step 5: the lists', () => {
  it('records this step\'s entries in each list, in their order, each once and tagged', () => {
    expect(tagged(decisions).map(head)).toEqual(HEADS.decisions)
    expect(tagged(deviations).map(head)).toEqual(HEADS.deviations)
    expect(tagged(verify).map(head)).toEqual(HEADS.verify)
    expect(tagged(followUps).map(head)).toEqual(HEADS.followUps)
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of tagged(list)) expect(entry, head(entry)).toMatch(/^- \*\*[^*]+ \(WS16 step 5\)\.\*\* \S/)
    }
  })

  it('puts its entries after the earlier steps\' in each list', () => {
    const last = {
      decisions: 'Every address on an account with an active membership is on the newsletter list unless they turn it off (WS16 step 4).',
      deviations: 'No new cron and no new phase (WS16 step 4).',
      verify: 'The files read as the base has them (WS16 step 4).',
      followUps: 'A stopped newsletter\'s row left pending (WS16 step 4).',
    }
    for (const [name, list] of [['decisions', decisions], ['deviations', deviations], ['verify', verify], ['followUps', followUps]] as const) {
      const heads = entries(list).map(head)
      expect(heads.indexOf(HEADS[name][0]), name).toBeGreaterThan(heads.indexOf(last[name]))
      expect(heads.indexOf(last[name]), name).toBeGreaterThan(-1)
    }
  })

  it('records D40 with K\'s date, the pages and what it turned down', () => {
    const [buildOnce] = tagged(decisions)
    for (const piece of ['D40, settled by K on Tuesday, November 10, 2026', 'decision 12', 'Later homes', 'Turned down:']) expect(buildOnce, piece).toContain(piece)
  })

  it('records the three deviations, the Help one naming K\'s decisions 40 and 43 and the three sentences it moves', () => {
    const [groups, spec, help] = tagged(deviations)
    for (const piece of ['Q45', 'WS16 step 11', '`mailTools`', 'Specific people']) expect(groups, piece).toContain(piece)
    for (const piece of ['`test/unit/email-choice-pages.test.tsx`', '`test/a11y/scopes.spec.ts`', 'WS13', '`test/a11y/baseline.json` is unchanged']) expect(spec, piece).toContain(piece)
    for (const piece of [
      'decisions 40 and 43', 'Wednesday, November 11, 2026', 'the guardrails\' line', '"Each email carries an unsubscribe link and an email preferences link."',
      'the line under Specific people', '"Who gets it"', 'have no Help',
    ]) expect(help, piece).toContain(piece)
  })

  it('resolves the verify items, each confirmed in the code', () => {
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
    const byHead = (h: string) => tagged(verify).find((e) => head(e) === h) ?? ''
    expect(byHead(HEADS.verify[3])).toContain('`test/unit/api-split-records-closed.test.ts`')
    expect(byHead(HEADS.verify[7])).toContain('`git diff 16c188a 4b9d780`')
    expect(byHead(HEADS.verify[7])).toContain('`src/lib/features.ts`')
  })

  it('hands the test through Amazon SES on to WS16 step 7, so nobody reads the box as working before then', () => {
    const [ses] = HEADS.followUps.map(followUp)
    for (const piece of ['"Send the test through Amazon SES"', '`service: \'ses\'`', 'does not read', 'WS16 step 7']) expect(ses, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 5: plain language', () => {
  /** Everything this step wrote in the section: its block, its entries, its map sentences, its closes and the Status line's tail. */
  const written = [
    block, ...[decisions, deviations, verify, followUps].flatMap(tagged), ...PROVED.map(([id, s]) => added(id, s)),
    ...BUILT.map(([id]) => added(id, 'Built in WS16 step 5: ')), closeOf(REMINDERS), closeOf(WAITS),
    statusLine.slice(STATUS_PREFIX.length), date?.[0] ?? '',
  ]

  it('reads every piece it means to', () => {
    for (const text of written) expect(text).not.toBe('')
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials, unfilled marks and the merge-pending phrase out of what the step wrote', () => {
    for (const text of written) {
      expect(text).not.toMatch(DASHES)
      expect(text).not.toMatch(BANNED)
      expect(text).not.toMatch(TOOLS)
      expect(text).not.toMatch(BARE)
      expect(text).not.toMatch(OLD_INITIALS)
      expect(text).not.toMatch(UNFILLED)
      expect(proseOf(text)).not.toMatch(CAPITALS)
      expect(text).not.toMatch(PENDING)
      expect(text).not.toContain('is pending')
      expect(text).not.toMatch(/\.github\//)
      expect(proseOf(text)).not.toMatch(HE)
      expect(text).not.toMatch(/\(step \d+[;),]/)
    }
    expect(ws16.split('\n').filter((l) => l.startsWith('|'))).toEqual([])
  })

  it('gives every date the weekday it falls on, and writes every time on the twelve-hour clock', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const months = MONTHS.join('|')
    const short = MONTHS.map((m) => m.slice(0, 3)).join('|')
    for (const text of written.map(proseOf)) {
      for (const found of text.matchAll(new RegExp(`\\b(?:${months}|${short}) \\d{1,2}\\b`, 'g'))) {
        expect(text.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
      }
      for (const [whole, weekday, month, day, year] of text.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${months}) (\\d{1,2})\\b(?:, (\\d{4}))?`, 'g'))) {
        expect(WEEKDAYS[new Date(Date.UTC(Number(year ?? 2026), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
      }
      for (const time of text.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
    }
  })

  it('names steps as "WS16 step N" and checkpoints in full, and K as K or they', () => {
    for (const text of written) {
      const bare = proseOf(text).replace(/\b[Cc]heckpoints [J-O](?:, [J-O])* and [J-O]\b|\b[Cc]heckpoint [J-O]\b/g, 'checkpoint')
      expect([...bare.matchAll(/(?<![\w-])[JLMNO](?![\w-])/g)].map((m) => m[0]), text.slice(0, 60)).toEqual([])
    }
  })
})

describe('REDESIGN_STATUS.md, WS16 step 5: the date and the new files', () => {
  it('dates the record on a real day, on or after Wednesday, November 11, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-11').toBe(true)
  })

  it('lists as new only files that exist, the code and tests among them free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT, ...CHANGED_INTEGRATION, ...GROWN]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    // The new files whole; the changed files that held no dash before, whole; and in the ones that did, the parts this step wrote.
    const older = ['src/pages/AdminEmailPage.tsx', 'src/areas/admin/api.ts', 'src/areas/admin/components/AuditLogPanel.tsx', 'workers/daily-emails/src/index.ts', 'functions/utils/membership/ratingSnapshots.ts']
    const texts: Array<readonly [string, string]> = [
      ...[...NEW_LINTED, ...CHANGED.filter((f) => /\.tsx?$/.test(f) && !older.includes(f)), ...CHANGED_UNIT, ...CHANGED_INTEGRATION].map((file) => [file, read(file)] as const),
      ['AdminEmailPage.tsx, the newsletter\'s words and Help', between(read(older[0]), '// ── The LCA newsletter list (WS16 step 5)', 'const OPENER')],
      ['AdminEmailPage.tsx, the newsletter\'s calls', between(read(older[0]), 'The newsletter\'s send, after its one confirm step', 'async function handleSendTest')],
      ['admin/api.ts, the newsletter\'s calls', between(read(older[1]), '// The LCA newsletter in Group email (WS16 step 5)', 'export type AnnouncementTone')],
      ['AuditLogPanel.tsx, the label', between(read(older[2]), 'group_email_stopped', '\n')],
      ['the worker\'s header', between(read(older[3]), 'rows that can wait. A \'later\' among', 'that worked.')],
      ['the worker\'s second try', between(read(older[3]), 'const LATER_TRIES', '// Quiet on a normal night')],
      ['the worker\'s phases', between(read(older[3]), 'const budget = new ReminderBudget()', '// 1d. Record each member')],
      ['ratingSnapshots.ts, the stamp', between(read(older[4]), 'With stampUnanswered', 'export async function')],
    ]
    for (const [name, text] of texts) {
      expect(text.length, name).toBeGreaterThan(30)
      expect(text, name).not.toMatch(DASHES)
      expect(text, name).not.toMatch(TOOLS)
      expect(text, name).not.toMatch(BARE)
      expect(text, name).not.toMatch(OLD_INITIALS)
    }
  })
})
