// test/unit/redesign-status-ws16-step4.test.ts
//
// REDESIGN_STATUS.md records WS16 step 4: the newsletter list and the
// engine's rules. Like the record tests of WS16 steps 1 to 3, this file
// reads only the WS16 section, from its heading to the Phase 0 heading, and
// the date at the start of the date line, never every table row or heading
// of the file, and it reads no count or figure from the code. Pinned here:
// the Status line's tail while this step is the latest; the block's place
// and its parts in order, its files with their counts, which must add up,
// and its figures, the worker's against part one's ceiling; the sentences
// this step added to eleven map items, each ahead of its planned step and
// behind the earlier steps' own sentences, which stay; the close it added to
// three follow-ups, two of WS16 step 2 and one of WS16 step 3, whose earlier
// words stay, the reminders' close word for word as it was chosen; this
// step's entries in the four lists, each with its tag; the plain-language
// rules over everything this step wrote; and the date, any real day from
// Wednesday, November 11, 2026 on. The new files are read only to find them
// and to hold them to the plain-language rules.
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
const TAG = '(WS16 step 4).'
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
const STEP_THREE = '### WS16 step 3: the links, the footer and the link endpoints'
const STEP = '### WS16 step 4: the newsletter list and the engine\'s rules'
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
const TAIL = 'steps 1 to 4 are built.'

/** The sentences this step adds to the map for the items it proves, each with its item and the step planned to prove it. */
const PROVED: ReadonlyArray<readonly [string, string]> = [
  ['AC10', 'Proved in WS16 step 4 by `test/integration/newsletter.test.ts`: '],
  ['AC12', 'Proved in WS16 step 4 by `test/integration/campaigns-once.test.ts` and `test/unit/mail-plan.test.ts`: '],
  ['D36', 'Proved in WS16 step 4 by `test/unit/mail-rules-outcome.test.ts` and `test/integration/contracts/newsletter.test.ts`: '],
  ['D37', 'Proved in WS16 step 4 by `test/unit/mail-plan.test.ts` and `test/integration/campaigns-once.test.ts`: '],
  ['D38', 'Proved in WS16 step 4 by `test/integration/newsletter.test.ts`: '],
  ['Q40', 'Proved in WS16 step 4 by `test/integration/newsletter.test.ts`: '],
  ['Q41', 'Proved in WS16 step 4 by `test/integration/newsletter.test.ts`: '],
  ['Q44', 'Proved in WS16 step 4 by `test/unit/mail-rules-outcome.test.ts` and `test/unit/mail-step4-words.test.ts`: '],
]
/** The items later steps prove that this step builds a part of, with the step planned to prove each. */
const BUILT: ReadonlyArray<readonly [string, number]> = [['AC3', 7], ['AC8', 7], ['AC11', 6]]
/** The earlier steps' sentences on the items this step adds to, which stay word for word, ahead of this step's. */
const EARLIER: ReadonlyArray<readonly [string, string]> = [
  ['AC3', 'Built in WS16 step 1: one service a message and no fallback inside a send, in `deliver()`'],
  ['AC8', 'Built in WS16 step 3: the footer and the two headers for one person on one list'],
  ['AC10', 'Built in WS16 step 2: the list\'s row, `lca-newsletter`, which migration 0060 writes as one of LCA\'s main mailers'],
  ['AC12', 'Built in WS16 step 2: the daily run\'s budget, `dailyBudget` in `functions/utils/mail/plan.ts`'],
  ['D36', 'Built in WS16 step 1: `domain/mail/addresses.ts`, holding today\'s three values and nothing more'],
  ['Q41', 'Built in WS16 step 3: the seam\'s rule that list mail is never handed to Resend'],
  ['Q44', 'Built in WS16 step 1: `domain/mail/addresses.ts`, the one place every address lives, with today\'s three values'],
]

/** The files this step adds. */
const NEW_FILES = [
  'functions/api/admin/mail/newsletter.ts', 'functions/api/admin/mail/newsletter/test.ts', 'functions/api/admin/mail/newsletter/stop.ts',
  'functions/utils/mail/newsletterAnswers.ts', 'test/integration/newsletter.test.ts', 'test/integration/campaigns-once.test.ts',
  'test/integration/contracts/newsletter.test.ts', 'test/integration/newsletter-edges.test.ts', 'test/integration/campaignRuns.ts',
  'test/unit/mail-step4-words.test.ts', 'test/unit/redesign-status-ws16-step4.test.ts',
]
const NEW_UNIT = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.ts$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new files that are code or tests, which lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.ts$/.test(f))
/** The files of code and record this step changes. */
const CHANGED = [
  'domain/mail/addresses.ts', 'functions/utils/mail/plan.ts', 'functions/utils/mail/lists.ts', 'functions/utils/admin/campaigns.ts', 'functions/utils/auth.ts',
  'functions/utils/admin/audit.ts', 'domain/contracts/mail.ts', 'domain/contracts/registry.ts', 'workers/daily-emails/src/index.ts', 'REDESIGN_STATUS.md',
]
/** The test files this step changes, each with its count written in the block. */
const CHANGED_UNIT = ['test/unit/mail-plan.test.ts', 'test/unit/mail-rules-outcome.test.ts', 'test/unit/mail-link-files-closure.test.ts', 'test/unit/mail-step3-words.test.ts', 'test/unit/routes.test.ts']

/** The heads of this step's entries in the four lists, in their order. */
const HEADS = {
  decisions: [
    'The senders, each form written once in one file (WS16 step 4).',
    'Batch sizes safe on the free plan until K confirms Workers Paid (WS16 step 4).',
    'Every address on an account with an active membership is on the newsletter list unless they turn it off (WS16 step 4).',
  ],
  deviations: [
    'Marked before the send, never sent twice (WS16 step 4).',
    'The newsletter has endpoints of its own (WS16 step 4).',
    'No new cron and no new phase (WS16 step 4).',
  ],
  verify: [
    'One email per address today (WS16 step 4).',
    'Today\'s campaign engine (WS16 step 4).',
    'The free plan\'s limits per invocation (WS16 step 4).',
    'The processor time a message costs (WS16 step 4).',
    'The sample members (WS16 step 4).',
    'Resend and the news subdomain (WS16 step 4).',
    'The harness keeps headers (WS16 step 4).',
    'The campaign tables\' CHECKs (WS16 step 4).',
    'Who reads filter_json (WS16 step 4).',
    'D1 and json_each (WS16 step 4).',
    'The files read as the base has them (WS16 step 4).',
  ],
  followUps: [
    'The worker\'s link key before the switch-on (WS16 step 4).', 'Why a newsletter waits, on its tab (WS16 step 4).', 'A member deleted while a newsletter is sending (WS16 step 4).',
    'A stopped newsletter\'s row left pending (WS16 step 4).',
  ],
}

/** The three follow-ups of earlier steps that this step closes, and the sentence each closes with. */
const REMINDERS = 'The attendee and week-before reminders a run leaves (WS16 step 2).'
const RETRY = 'Group email\'s retry rule under the engine\'s rules (WS16 step 2).'
const ANSWERS = 'The seam\'s two new answers in Group email\'s sender and in sendEmail (WS16 step 3).'
const CLOSE = ' Done in WS16 step 4: '
/** The reminders' close, word for word as the choice of Wednesday, November 11, 2026 gave it. */
const REMINDERS_CLOSE =
  'Done in WS16 step 4: the choice is made here and WS16 step 5 builds it, before the rules go on: both queries keep their own-day test word for word and no later day reads a row again; an outcome of later among the attendee and week-before rows is sent again in the same run, three sends at most, before it gives its claim back and ends its phase, and from the first such outcome the run leaves half a second between sends; the cap stays at 25 and a second or third send comes out of the rating lookups\' share of the 45 outside calls, so on the free plan a day with more than 25 attendee and week-before reminders together still sends 25, and a reminder a run leaves after its three sends is still not sent, which is recorded as the loss and which Workers Paid ends for the cap; and a US Chess ID whose lookup finds nothing gets a checked time under the rules, the time alone, a lookup that answers with no rating having been stamped all along.'
const followUp = (name: string) => entries(followUps).find((l) => head(l) === name) ?? ''
/** A follow-up's words before this step's close. */
const beforeClose = (name: string) => followUp(name).split(CLOSE)[0]

describe('REDESIGN_STATUS.md, WS16 step 4: the Status line', () => {
  it('keeps the fixed prefix and gives this step\'s tail while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(4)
    if (latestStep === 4) expect(tail).toBe(TAIL)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 4: the block', () => {
  it('sits right after WS16 step 3\'s block and before the four lists, once', () => {
    expect(ws16.split(`\n${STEP}\n`)).toHaveLength(2)
    const at = [STEP_THREE, STEP, LISTS[0]].map((h) => ws16.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // Nothing between the two blocks but step 3's own, and nothing between this block and the decisions but itself and what a
    // later step adds there: its own block, "### WS16 step N: ...", or a checkpoint's section.
    const later = (l: string) => /^### WS16 step (?:[5-9]|1[0-2]): \S/.test(l) || /^### Checkpoint [MNO]: WS16 (?:steps \d+ to \d+|step \d+)$/.test(l)
    expect(ws16.slice(at[0], at[1]).split('\n').filter((l) => l.startsWith('### '))).toEqual([STEP_THREE])
    expect(ws16.slice(at[1], at[2]).split('\n').filter((l) => l.startsWith('### ') && !later(l))).toEqual([STEP])
    expect(later('### WS16 step 5: a later block')).toBe(true)
    expect(later('### Checkpoint M: WS16 steps 1 to 8')).toBe(true)
    expect(later('### Step 5: a stray heading')).toBe(false)
    expect(later('### WS16 step 3: an earlier block')).toBe(false)
  })

  it('has every part, in order, each a bullet of its own, and says what a visitor or a member meets', () => {
    const parts = [
      '- **Files.**', '- **The newsletter list.**', '- **The engine\'s rules.**', '- **The batch sizes.**', '- **The endpoints.**',
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
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT]) expect(files, name).toContain(`\`${name}\``)
    for (const name of [...NEW_UNIT, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of CHANGED_UNIT) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before)[:)]`))
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const name of [
      'functions/utils/mail/newsletterAnswers.ts', 'test/integration/newsletter-edges.test.ts', 'test/integration/campaignRuns.ts', 'test/unit/mail-step4-words.test.ts',
      'workers/daily-emails/src/index.ts', 'test/unit/mail-plan.test.ts',
    ]) {
      expect(beyond, name).toContain(`\`${name}\``)
    }
    expect(beyond).toContain('`workers/daily-emails/wrangler.toml`')
  })

  it('gives the newsletter list its audience, one batch for a send with one newsletter at a time, the summary, the stop and the links live from the first row', () => {
    const list = bullet(block, '- **The newsletter list.**')
    for (const piece of [
      '`functions/utils/mail/lists.ts`', 'every address on an account with an active membership, once', 'decision 28', '"you need to be active to get the newsletter"',
      'An \'in\' choice adds no address to it', 'main mailers', '`createListCampaign`', 'one `db.batch`', 'two presses at the same moment make one',
      '`linkKeyCheck`', 'It answers null', 'a list of 300 members', 'D1\'s limits', '`newsletterSummary`', 'last 10 newsletter sends', '`stopListCampaign`',
      '"Not sent: the send was stopped."', 'a row already marked sending is left to its run', '`listLinksLive`', 'a revert of the change that switches the newsletter on turns no link off',
    ]) expect(list, piece).toContain(piece)
  })

  it('gives the engine\'s rules: the row decides, the write-off, the link key\'s check, the claim, the gate at send time, the mark, the answers and today\'s path', () => {
    const rules = bullet(block, '- **The engine\'s rules.**')
    for (const piece of [
      'a campaign that names a list is sent only under the rules, whatever `MAIL_LISTS_ON` says', 'a worker on WS16 step 4\'s code or later whose deploy lags the site\'s',
      'a worker still on the code before checkpoint M would', '`engineRulesOn()`',
      '"Not sent again: the mail service may have taken it, and a second try could send it twice."', '`MAIL_LINK_SECRET_PREVIOUS`',
      '"Not sent yet: the link key on this deployment is not the one this email was made with."', '"Not sent yet: the mail key is missing on this deployment."',
      '"Not sent yet: the do-not-send list could not be read."', '`skipped_count`', '`openLoopGate`', 'marks each row just before its send', 'a send still costs one query',
      '`classifyOnce`', '"No clear answer from the mail service; not sent again so it cannot arrive twice."', '"Resend <status>: <body>"', 'the untried rows\' attempts given back',
      'statement for statement', '`sending_at IS NULL`', 'tried a lost answer again, is closed',
    ]) expect(rules, piece).toContain(piece)
  })

  it('gives the batch sizes per plan, with the arithmetic and the counted figures against the free plan\'s 50 and 50', () => {
    const sizes = bullet(block, '- **The batch sizes.**')
    for (const piece of [
      '`sizes()`', '`WORKERS_PLAN`', '`dailyBudget()`, which stays as it was', 'at most n + 8 queries', 'one batch of 10', 'sends 20 from the oldest campaign',
      '12 outside calls and 22 queries', 'inside the 12 and 25 that the plan\'s acceptance for this step gives', '20 and 27, inside 21 and 30', '50 and 50', 'batches of 40 until 20 seconds',
      'checking the time before each send', 'at most 50 sends', 'up to 300 across up to 20 campaigns', '`REQUEST_DRAIN_MS` is not read under the rules',
      'only on Workers Paid',
    ]) expect(sizes, piece).toContain(piece)
    // The figures the map's AC12 sentence gives are the block's.
    expect(added('AC12', PROVED[1][1])).toContain('12 outside calls and 22 queries')
    expect(added('AC12', PROVED[1][1])).toContain('20 outside calls and 27 queries')
  })

  it('gives the endpoints: the four methods, the guard, the refusals in their words and order, the test send, the stop and the contract figures as text', () => {
    const endpoints = bullet(block, '- **The endpoints.**')
    const order = [
      '"The newsletter goes out through Amazon SES, which this site does not send through yet. You can write it and send yourself a test."',
      '"Not sent: the mail link key is missing on this deployment."', '"Nobody is on the newsletter list right now."', '"The newsletter is already sending. Wait for it to finish."',
    ].map((words) => endpoints.indexOf(words))
    for (const i of order) expect(i).toBeGreaterThan(-1)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    for (const piece of [
      '`requireListMailer`', 'with the session verified once', 'WS16 step 6 adds the media manager', '404 `{ error: \'Not found\' }`', '`parseBody`',
      'with nothing written before each refusal', '`\'group_email_sent\'`', '201 `{ campaignId, totalRecipients, status: \'sending\' }`', '`[TEST] `',
      'puts it on no list', 'kind `\'test\'`', 'through Resend from noreply@louisianachess.org', '"Failed to send test email: Resend <status>: <body>", a 401 or a 403 among them',
      '`\'group_email_stopped\'`', '"No newsletter is sending."',
      'still works after a revert of the switch-on change', '25 of the 135 methods under `functions/api` contracted, 21 of 131 before', '`PENDING_COUNT` 110, unchanged',
      'Today\'s five campaign endpoints keep their files',
    ]) expect(endpoints, piece).toContain(piece)
  })

  it('says nothing a visitor or a member meets ships with every switch off, with the guard\'s answers before the 404, and that the row decides for no row in production yet', () => {
    const off = bullet(block, '- **What ships with every switch off.**')
    expect(off.startsWith('- **What ships with every switch off.** Nothing a visitor or a member meets.')).toBe(true)
    const order = ['401', '403 \'Forbidden\'', 'mfaRequired', '404 `{ error: \'Not found\' }`'].map((piece) => off.indexOf(piece))
    for (const i of order) expect(i).toBeGreaterThan(-1)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    for (const piece of [
      'the only things a request can meet from this step are the four new methods', 'learns nothing of whether the newsletter is switched on',
      'for an OPTIONS request to any of the three paths, the 204 every endpoint of the site gives, with no guard, as on every other route',
      '`test/integration/campaigns.test.ts` passes with no line of it changed', '`test/unit/mail-seam-bytes.test.ts` stays green unchanged',
      'No list campaign row can exist while the newsletter\'s POST answers 404 or 409', 'runs for no row in production until the switch-on',
      '`test/a11y/baseline.json` is unchanged', 'This step adds no migration', '`deploy-worker.yml`',
      // From this step Group email's send and the sweep read 0060's columns with every switch off, which checkpoint M's merge must allow for.
      'Group email\'s send and the sweep read three of the columns migration 0060 adds, with every switch off', '`list_id`', '`sending_at IS NULL`', '`contact_id`',
      'For checkpoint M\'s merge notes: 0060 must reach production with checkpoint M\'s deploy or before it', '`npm run db:migrate:preview` before Group email is tried there',
      'sees the worker\'s live deployment on checkpoint M\'s code or later',
    ]) expect(off, piece).toContain(piece)
  })

  it('lists the pins it moved, each with its figures and its reason, and the tests it leaves as they were', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/unit/mail-rules-outcome.test.ts`', '`LIST_SENDERS`', 'the two address literals to three', 'its three constants to four',
      '`test/unit/mail-link-files-closure.test.ts`', 'its four cases are rewritten', '`test/unit/mail-step3-words.test.ts`', 'five to eight', 'in its `Env` type alone',
      '`test/unit/routes.test.ts`', '93 to 96', '`test/unit/mail-worker-closure.test.ts` passes unchanged', '21 to 25', '131 to 135',
      '`test/unit/route-audit.test.ts`', 'no list of routes and their guards', '`\'group_email_stopped\'` moves no pin',
    ]) expect(pins, piece).toContain(piece)
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
    // The match on the key before is kept as the entry asks, and the order of a key change recorded rather than a change to what signs.
    expect(calls).toContain('so that match is safe only when a key change sets the site\'s two keys first and the worker\'s after, while no newsletter is sending')
  })

  it('gives the lint as unchanged, the build against the base, and each check once', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['`e98263b`', 'a local production build', '`index-BGHuXroV.js` at 550,347 bytes', '`index-De3UpPLs.css` at 130,375 bytes', '`features-DxqQlIon.js` at 698 bytes', 'the same name and size as on the base', 'a local build\'s figures']) {
      expect(build, piece).toContain(piece)
    }
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run with nothing else running beside it')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })

  it('gives the worker\'s dry run on the base and after, measured on their day, with the growth and what is left under part one\'s ceiling of 96 KiB, gzip 28 KiB', () => {
    const worker = bullet(block, '- **Worker.**')
    for (const piece of ['`npx wrangler deploy --dry-run`', '`--config workers/daily-emails/wrangler.toml`', '`e98263b`', 'Wednesday, November 11, 2026', 'The bundle holds no package.', '96 KiB, gzip 28 KiB']) {
      expect(worker, piece).toContain(piece)
    }
    const sizes = [...worker.matchAll(/([\d.]+) KiB, gzip ([\d.]+) KiB/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(sizes.length).toBeGreaterThanOrEqual(2)
    const [base, after] = sizes
    expect(base).toEqual([47.17, 13.28])
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

describe('REDESIGN_STATUS.md, WS16 step 4: the figures add up', () => {
  const files = bullet(block, '- **Files.**')
  const countOf = (name: string) => {
    const m = new RegExp(`\`${escape(name)}\` \\((\\d+)(?:, (\\d+) before|, as before)?[:)]`).exec(files)
    return m ? { now: Number(m[1]), before: Number(m[2] ?? m[1]) } : null
  }

  it('gives unit counts that add up: the base\'s, the new file\'s tests and the changed files\' gains', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([8267, 319])
    const counts = [...NEW_UNIT, ...CHANGED_UNIT].map((name) => [name, countOf(name)] as const)
    for (const [name, count] of counts) expect(count, name).not.toBeNull()
    const gain = counts.reduce((sum, [name, count]) => sum + (NEW_UNIT.includes(name) ? count!.now : count!.now - count!.before), 0)
    expect(num(before) + gain).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s and the new files\'', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1480, 90])
    for (const name of NEW_INTEGRATION) expect(countOf(name), name).not.toBeNull()
    const fresh = NEW_INTEGRATION.reduce((sum, name) => sum + countOf(name)!.now, 0)
    expect(num(before) + fresh).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the browser run as one run whose counts add up, and the lint figures as the base\'s with the new files added', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(898)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_LINTED.length)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 4: the map', () => {
  it('adds a sentence of what this step proves to the eight items planned for it, once each, ahead of the planned step, and to no other item', () => {
    for (const [id, sentence] of PROVED) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.endsWith('Planned: WS16 step 4.'), id).toBe(true)
      expect(item.indexOf(sentence), id).toBeLessThan(item.indexOf('Planned: WS16 step 4.'))
    }
    expect(entries(map).filter((l) => l.includes('Proved in WS16 step 4 by')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(PROVED.map(([id]) => id))
    for (const piece of ['every address on an account with an active membership, once', 'a parent and two children on one address', 'a lapsed membership with or without an \'in\' choice', 'a typed-in address', 'the members the migrations seed are counted like any member', 'a list of 300 members']) {
      expect(added('AC10', PROVED[0][1]), piece).toContain(piece)
    }
    for (const piece of ['Workers Paid\'s sizes a sweep run sends 300', 'checks its deadline before each send', 'n + 8 queries']) expect(added('AC12', PROVED[1][1]), piece).toContain(piece)
    expect(added('D36', PROVED[2][1])).toContain('`LIST_SENDERS`')
    expect(added('D37', PROVED[3][1])).toContain('`sizes()`')
    expect(added('Q41', PROVED[6][1])).toContain('answers 409 and writes nothing')
    expect(added('Q44', PROVED[7][1])).toContain('the address map\'s choice 6, stays K\'s to decide')
  })

  it('adds a sentence that starts "Built in WS16 step 4" to the three items later steps prove, once each, ahead of their planned steps', () => {
    for (const [id, step] of BUILT) {
      const item = mapItem(id)
      expect(item.split('Built in WS16 step 4: '), id).toHaveLength(2)
      expect(item.endsWith(`Planned: WS16 step ${step}.`), id).toBe(true)
      expect(item.indexOf('Built in WS16 step 4: '), id).toBeLessThan(item.indexOf(`Planned: WS16 step ${step}.`))
    }
    expect(entries(map).filter((l) => l.includes('Built in WS16 step 4:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(BUILT.map(([id]) => id))
    const ac3 = added('AC3', 'Built in WS16 step 4: ')
    for (const piece of ['`test/integration/campaigns-once.test.ts`', 'never claimed again once marked', 'a lost answer among them, never tried again', 'two started together making one', 'are proved with the newsletter\'s own sends in WS16 step 7']) {
      expect(ac3, piece).toContain(piece)
    }
    for (const piece of ['`listMailParts`', '`List-Unsubscribe-Post: List-Unsubscribe=One-Click`', 'no postal address', 'a registration confirmation sent beside it carries neither']) {
      expect(added('AC8', 'Built in WS16 step 4: '), piece).toContain(piece)
    }
    expect(added('AC11', 'Built in WS16 step 4: ')).toContain('`requireListMailer`')
  })

  it('keeps the earlier steps\' sentences on those items word for word, ahead of this step\'s', () => {
    for (const [id, sentence] of EARLIER) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      const ours = Math.max(item.indexOf('Proved in WS16 step 4 by'), item.indexOf('Built in WS16 step 4: '))
      expect(item.indexOf(sentence), id).toBeLessThan(ours)
    }
  })
})

describe('REDESIGN_STATUS.md, WS16 step 4: the close of three follow-ups', () => {
  it('closes the reminders WS16 step 2 handed on with the choice word for word, at its end, its earlier words as that step wrote them', () => {
    const entry = followUp(REMINDERS)
    expect(entry.endsWith(` ${REMINDERS_CLOSE}`)).toBe(true)
    expect(entry.split(CLOSE)).toHaveLength(2)
    const before = beforeClose(REMINDERS)
    expect(before.startsWith(`- **${REMINDERS}** Under the engine's rules a daily run on the free plan claims 25 reminder rows at most, and an outcome of later ends its phase.`)).toBe(true)
    for (const piece of ['`test/integration/mail-gate.test.ts`', 'WS16 step 4 chooses between widening the two queries', 'the cap of 25 gives way']) expect(before, piece).toContain(piece)
    expect(before.endsWith('WS16 step 4 either stamps a checked time for an ID that finds nothing, under the rules only, or records the loss.')).toBe(true)
  })

  it('closes Group email\'s retry rule of WS16 step 2 at its end, its earlier words as that step wrote them', () => {
    const entry = followUp(RETRY)
    expect(entry.split(CLOSE)).toHaveLength(2)
    expect(beforeClose(RETRY).endsWith('WS16 step 4 marks each campaign row just before its send, moves the sender to `classifyOnce` and adds `test/integration/campaigns-once.test.ts`.')).toBe(true)
    const close = entry.slice(entry.indexOf(CLOSE))
    for (const piece of ['`classifyOnce`', 'a 500, a lost answer and a request with no answer are failed with their words and never sent a second time', '`test/integration/campaigns.test.ts` holds today\'s path with the rules off, unchanged']) {
      expect(close, piece).toContain(piece)
    }
    expect(entry.endsWith('.')).toBe(true)
  })

  it('closes the seam\'s two new answers of WS16 step 3 at its end, its earlier words as that step wrote them, and closes no other entry', () => {
    const entry = followUp(ANSWERS)
    expect(entry.split(CLOSE)).toHaveLength(2)
    expect(beforeClose(ANSWERS).endsWith('WS16 step 4, which sends list mail through the list path and moves Group email\'s sender to `classifyOnce`, reads both answers there.')).toBe(true)
    const close = entry.slice(entry.indexOf(CLOSE))
    for (const piece of ['`WAIT_FOR_SES_WORDS`', '`REFUSAL_WORDS.not_list_mail`', 'no "Resend undefined"', '`failureWords`', 'today\'s path keeps every word it had']) expect(close, piece).toContain(piece)
    expect(entries(ws16).filter((l) => l.includes(' Done in WS16 step 4:')).map(head).sort()).toEqual([REMINDERS, RETRY, ANSWERS].sort())
  })
})

describe('REDESIGN_STATUS.md, WS16 step 4: the lists', () => {
  it('records this step\'s entries in each list, in their order, each once and tagged', () => {
    expect(tagged(decisions).map(head)).toEqual(HEADS.decisions)
    expect(tagged(deviations).map(head)).toEqual(HEADS.deviations)
    expect(tagged(verify).map(head)).toEqual(HEADS.verify)
    expect(tagged(followUps).map(head)).toEqual(HEADS.followUps)
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of tagged(list)) expect(entry, head(entry)).toMatch(/^- \*\*[^*]+ \(WS16 step 4\)\.\*\* \S/)
    }
  })

  it('puts its entries after the earlier steps\' in each list', () => {
    const last = {
      decisions: 'No postal address in any email (WS16 step 3).',
      deviations: 'Links keep working once a list email has gone (WS16 step 3).',
      verify: 'Cloudflare\'s limit on a Worker\'s size (WS16 step 3).',
      followUps: 'A list turned back on keeps its place on the preferences page (WS16 step 3).',
    }
    for (const [name, list] of [['decisions', decisions], ['deviations', deviations], ['verify', verify], ['followUps', followUps]] as const) {
      const heads = entries(list).map(head)
      expect(heads.indexOf(HEADS[name][0]), name).toBeGreaterThan(heads.indexOf(last[name]))
      expect(heads.indexOf(last[name]), name).toBeGreaterThan(-1)
    }
  })

  it('records D36, D37 and D38 with K\'s dates and what each turned down, D37 with what the free plan still cuts from the daily run', () => {
    const [senders, sizes, list] = tagged(decisions)
    expect(senders).toContain('D36, settled by K on Tuesday, November 10, 2026, with the forms decided by K on Wednesday, November 11, 2026, from the address map (decision 37)')
    for (const piece of ['Louisiana Chess Association <newsletter@news.louisianachess.org>', '`domain/mail/addresses.ts`', 'No other file writes a sender address', 'WS16 step 11', 'the address map\'s choice 6, which stays open']) {
      expect(senders, piece).toContain(piece)
    }
    expect(sizes).toContain('D37, settled by K on Tuesday, November 10, 2026')
    expect(sizes).toContain('a day with more than 25 attendee and week-before reminders together sends 25 and the rest of that day\'s are not sent, the rating lookups get what is left of 45 outside calls, and Workers Paid removes both.')
    expect(list).toContain('D38, settled by K on Tuesday, November 10, 2026, and Q40 with it')
    expect(list).toContain('"you need to be active to get the newsletter" is a rule and not a first step (decision 28)')
    for (const entry of tagged(decisions)) expect(entry, head(entry)).toContain('Turned down:')
  })

  it('records the three deviations against brief 1.4 and today\'s code', () => {
    const [marked, endpoints, cron] = tagged(deviations)
    for (const piece of ['marks a row sent only after a send that worked', 'marked just before its send and never claimed again once marked', 'a network blip leaves one person without that email', 'WS16 step 12']) {
      expect(marked, piece).toContain(piece)
    }
    for (const piece of ['WS08\'s admin home part', '`requireListMailer`', '`POST /api/admin/campaigns`', '`PENDING_COUNT` stays 110']) expect(endpoints, piece).toContain(piece)
    for (const piece of ['section 2.2', '`sweepPendingCampaigns`', 'no cron and no phase is added']) expect(cron, piece).toContain(piece)
  })

  it('resolves the verify items, each confirmed in the code or on its source with the day it was read, or said plainly not to be', () => {
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^(?:Confirmed\b|Not measured on Cloudflare\.)/)
    const byHead = (h: string) => tagged(verify).find((e) => head(e) === h) ?? ''
    expect(byHead(HEADS.verify[2])).toContain('Not checked: which plan the account is on, which is K\'s to say.')
    expect(byHead(HEADS.verify[3])).toMatch(/^- \*\*[^*]+\*\* Not measured on Cloudflare\./)
    for (const piece of ['read on Wednesday, November 11, 2026', 'last updated on Tuesday, April 21, 2026', '"Returns each element within the object as an individual row."']) expect(byHead(HEADS.verify[9]), piece).toContain(piece)
    expect(byHead(HEADS.verify[10])).toContain('`git diff 16c188a e98263b`')
  })

  it('records what the worker must be given and run before the switch-on and by whom, with no value written, what WS16 step 5\'s tab shows, the member delete a newsletter\'s rows wait for, and a stopped newsletter\'s row left pending', () => {
    const [key, tab, deleted, stopped] = HEADS.followUps.map(followUp)
    for (const piece of [
      '`MAIL_LINK_SECRET`', '`MAIL_LINK_SECRET_PREVIOUS`', 'K sets them as secrets of the worker', '`npx wrangler secret put MAIL_LINK_SECRET --config workers/daily-emails/wrangler.toml`',
      'no file of the repository holds a value for either', '`DEFAULT_REPLY_TO`',
      // The order of a key change, since a deployment signs only under its own key and lets a newsletter made under the old one go on.
      'with a value typed differently from the site\'s, and no key before it, it sends nothing', 'A key change sets the site\'s two keys first', 'then the worker\'s, and is made while no newsletter is sending',
      'never under the key before', 'links that do not open',
      // The worker's own code, since one still on the code before checkpoint M sends a newsletter's rows by their status alone.
      'the worker\'s live deployment is checkpoint M\'s code or later', '`deploy-worker.yml`', '"Deploy scheduled-jobs worker"', 'claims a newsletter\'s rows by their status alone',
      'This closes when K has set the key on the worker and seen the worker on checkpoint M\'s code or later, before the switch-on.',
    ]) {
      expect(key, piece).toContain(piece)
    }
    expect(tab).toContain('WS16 step 5\'s newsletter tab shows the words')
    for (const piece of [
      'its audience as it stood when the send was made', '`functions/api/admin/members/[id].ts`', '`member_id`', 'that reaches no newsletter row',
      'No list campaign row can exist while Resend sends', 'WS16 step 7', 'whose address is no longer in the audience', 'before the cutover to Amazon SES',
    ]) {
      expect(deleted, piece).toContain(piece)
    }
    // A row the stop leaves to its run, put back or orphaned on a closed send, which WS16 step 7 fails or writes off.
    for (const piece of [
      '`stopListCampaign`', 'on an answer of later', 'the run dies after the mark', 'read only campaigns whose status is `\'sending\'`', 'Nobody is mailed twice',
      'counts never add up to its total', 'WS16 step 7, before the cutover to Amazon SES', 'a row put back on a campaign that is no longer sending',
      '"Not sent: the send was stopped."', 'a closed list campaign\'s marked rows once their claim has expired', 'with a case for each',
    ]) {
      expect(stopped, piece).toContain(piece)
    }
    // The block's part on the stop points to it.
    expect(bullet(block, '- **The newsletter list.**')).toContain('a row already marked sending is left to its run (see the follow-up).')
  })
})

describe('REDESIGN_STATUS.md, WS16 step 4: plain language', () => {
  /** Everything this step wrote in the section: its block, its entries, its map sentences, its closes and the Status line's tail. */
  const written = [
    block, ...[decisions, deviations, verify, followUps].flatMap(tagged), ...PROVED.map(([id, s]) => added(id, s)),
    ...BUILT.map(([id]) => added(id, 'Built in WS16 step 4: ')), ...[REMINDERS, RETRY, ANSWERS].map((name) => followUp(name).slice(followUp(name).indexOf(CLOSE))),
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

describe('REDESIGN_STATUS.md, WS16 step 4: the date and the new files', () => {
  it('dates the record on a real day, on or after Wednesday, November 11, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-11').toBe(true)
  })

  it('lists as new only files that exist, the code and tests among them free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    // The new files whole; the changed files that held no dash before, whole; and in the three that did, in comments
    // older than WS16, the parts this step wrote.
    const older = ['functions/utils/admin/campaigns.ts', 'functions/utils/auth.ts', 'workers/daily-emails/src/index.ts']
    const texts: Array<readonly [string, string]> = [
      ...[...NEW_LINTED, ...CHANGED.filter((f) => f.endsWith('.ts') && !older.includes(f)), ...CHANGED_UNIT].map((file) => [file, read(file)] as const),
      ['campaigns.ts, the rules', between(read(older[0]), '// ── Under the engine\'s rules', 'How long the request path keeps working')],
      ['campaigns.ts, the drain under the rules', between(read(older[0]), 'The request path under the engine\'s rules', 'Finishes any campaign that still has work left.')],
      ['campaigns.ts, the sweep under the rules', between(read(older[0]), 'The sweep under the engine\'s rules', '\n}\n')],
      ['auth.ts, the list mailers', between(read(older[1]), 'The people who may send the LCA newsletter', '\n}\n')],
      ['auth.ts, the second factor', between(read(older[1]), 'The 403 an LCA admin gets', '\n}\n')],
      ['the worker\'s Env', between(read(older[2]), 'interface Env {', '\n}\n')],
    ]
    for (const [name, text] of texts) {
      expect(text.length, name).toBeGreaterThan(100)
      expect(text, name).not.toMatch(DASHES)
      expect(text, name).not.toMatch(TOOLS)
      expect(text, name).not.toMatch(BARE)
      expect(text, name).not.toMatch(OLD_INITIALS)
    }
  })
})
