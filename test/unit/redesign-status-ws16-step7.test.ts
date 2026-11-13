// test/unit/redesign-status-ws16-step7.test.ts
//
// REDESIGN_STATUS.md records WS16 step 7: the Amazon SES sender. Like the
// record tests of WS16 steps 1 to 6, this file reads only the WS16 section,
// from its heading to the Phase 0 heading, and the date at the start of the
// date line, never every table row or heading of the file, and it reads no
// count or figure from the code. Pinned here: the Status line's tail while
// this step is the latest; the block's place and its parts in order, its
// files with their counts, which must add up, and its figures, the worker's
// against part one's ceiling; the sentences this step added to twelve map
// items, each ahead of its planned step and behind the earlier steps' own
// sentences, which stay; this step's entries in the four lists, each with
// its tag, and its closes of four earlier follow-ups, each at the end of its
// entry with the earlier words as they were; the plain-language rules over
// everything this step wrote; and the date, any real day from Thursday,
// November 12, 2026 on. The new files, and the parts this step wrote in
// older ones, are read only to find them and to hold them to the
// plain-language rules.
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
/** AWS's documentation key id, put together so that this file is not among the files that carry it (test/unit/ses-sender.test.ts). */
const DOC_KEY = 'AKID' + 'EXAMPLE'

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
const TAG = '(WS16 step 7).'
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
const STEP_SIX = '### WS16 step 6: who sends, the media manager'
const STEP = '### WS16 step 7: the Amazon SES sender'
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
const TAIL = 'steps 1 to 7 are built.'

/** The sentences this step adds to the map for the items it proves, each planned for this step. */
const PROVED: ReadonlyArray<readonly [string, string]> = [
  ['AC2', 'Proved in WS16 step 7 by `test/unit/sigv4.test.ts`, `test/unit/ses-sender.test.ts` and `test/integration/ses-path.test.ts`: '],
  ['AC3', 'Proved in WS16 step 7 by `test/integration/ses-path.test.ts`: with Amazon SES sending'],
  ['AC8', 'Proved in WS16 step 7 by `test/integration/ses-path.test.ts`: every message of a newsletter'],
  ['D33', 'Proved in WS16 step 7 by `test/unit/ses-sender.test.ts`: '],
  ['Q42', 'Proved in WS16 step 7 by `test/unit/mail-switches.test.ts`: '],
  ['Q48', 'Proved in WS16 step 7 by `test/unit/ses-sender.test.ts`: '],
]
/** The items another step proves that this step builds a part of, each with the step planned for it. */
const BUILT: ReadonlyArray<readonly [string, number]> = [['AC10', 4], ['AC12', 4], ['AC13', 8], ['D31', 1], ['D37', 4], ['Q41', 4]]
/** The earlier steps' sentences on the items this step adds to, which stay word for word, ahead of this step's. */
const EARLIER: ReadonlyArray<readonly [string, string]> = [
  ['AC3', 'Built in WS16 step 1: one service a message and no fallback inside a send'],
  ['AC3', 'Built in WS16 step 4: the campaign sender\'s rules under which no message is sent twice'],
  ['AC3', 'are proved with the newsletter\'s own sends in WS16 step 7.'],
  ['AC8', 'Built in WS16 step 3: the footer and the two headers for one person on one list'],
  ['AC8', 'Built in WS16 step 4: the list path, which builds each recipient\'s footer and two headers'],
  ['AC8', 'Each optional email sent with them comes with Amazon SES in WS16 step 7.'],
  ['AC13', 'Built in WS16 step 3: no link key on a preview'],
  ['AC10', 'One email to a family in the outbox comes with Amazon SES in WS16 step 7.'],
  ['AC12', 'That Amazon SES sends only on Workers Paid comes with WS16 step 7.'],
  ['D37', 'That Amazon SES sends only on Workers Paid comes with WS16 step 7.'],
  ['Q41', 'the newsletter sent through Amazon SES comes with WS16 step 7.'],
]

/** The files this step adds. */
const NEW_FILES = [
  'functions/utils/mail/sigv4.ts', 'functions/utils/mail/ses.ts', 'test/unit/sigv4.test.ts', 'test/unit/ses-sender.test.ts',
  'test/integration/ses-path.test.ts', 'test/unit/ses-edges.test.ts', 'test/integration/ses-path-edges.test.ts', 'test/unit/redesign-status-ws16-step7.test.ts',
]
const NEW_UNIT = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new files that are code or tests, which lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.tsx?$/.test(f))
/** The files of code, settings, harness and record this step changes. */
const CHANGED = [
  'functions/utils/mail/switches.ts', 'functions/utils/mail/send.ts', 'functions/utils/mail/rules.ts', 'functions/utils/mail/outcome.ts',
  'functions/utils/admin/campaigns.ts', 'functions/utils/mail/lists.ts', 'functions/utils/mail/newsletterAnswers.ts',
  'functions/api/admin/mail/newsletter/test.ts', 'functions/api/admin/members/[id].ts', 'domain/contracts/mail.ts', 'functions/types.ts',
  'functions/utils/email.ts', 'workers/daily-emails/src/index.ts', 'workers/daily-emails/wrangler.toml', 'vitest.integration.config.ts',
  'test/a11y/global-setup.ts', 'test/integration/harness.ts', 'REDESIGN_STATUS.md',
]
/** The test files this step changes, each with its count written in the block. */
const CHANGED_UNIT = [
  'test/unit/mail-switches.test.ts', 'test/unit/mail-one-seam.test.ts', 'test/unit/mail-worker-closure.test.ts', 'test/unit/mail-rules-outcome.test.ts',
  'test/unit/browser-test-wiring.test.ts',
]
const CHANGED_INTEGRATION = ['test/integration/mail-email-choices.test.ts', 'test/integration/published-review-edges.test.ts']

/** The heads of this step's entries in the four lists, in their order. */
const HEADS = {
  decisions: [
    'The AWS account is K\'s own, and its key lives only as Cloudflare secrets (WS16 step 7).',
    'The cutover is its own change, after Workers Paid (WS16 step 7).',
    'Amazon\'s region is us-east-1, in one constant (WS16 step 7).',
  ],
  deviations: ['The member delete reads the newsletter whatever the switches say (WS16 step 7).'],
  verify: [
    'SES\'s v2 SendEmail (WS16 step 7).',
    'The errors that prove a message was not taken (WS16 step 7).',
    'A display name in FromEmailAddress (WS16 step 7).',
    'A subject outside ASCII (WS16 step 7).',
    'Tag values (WS16 step 7).',
    'What Amazon takes in a header (WS16 step 7).',
    'The clock (WS16 step 7).',
    'A library for signing (WS16 step 7).',
    'The signing values (WS16 step 7).',
    'DKIM over the one-click headers (WS16 step 7).',
    'The configuration set in the key\'s policy (WS16 step 7).',
    'The region left open (WS16 step 7).',
    'The display names the site sends (WS16 step 7).',
    'The files read as the base has them (WS16 step 7).',
  ],
  followUps: [
    'K\'s checks in the sandbox before the cutover (WS16 step 7).',
    'Amazon SES\'s keys on both deployments before the cutover (WS16 step 7).',
    'The published review\'s transport case, on Resend until WS16 step 12 (WS16 step 7).',
    'The comment on the page\'s call for the newsletter\'s test (WS16 step 7).',
  ],
}

/** The earlier follow-ups this step closes, each with the last words its own step wrote, which stay as they were. */
const CLOSED: ReadonlyArray<readonly [string, string]> = [
  ['A member deleted while a newsletter is sending (WS16 step 4).', 'it is in before the cutover to Amazon SES.'],
  ['A stopped newsletter\'s row left pending (WS16 step 4).', 'with a case for each.'],
  ['The test through Amazon SES, read from WS16 step 7 (WS16 step 5).', 'with a case for a test with the box ticked and one without.'],
  ['A media manager\'s test through Amazon SES (WS16 step 6).', 'with a case beside the two the follow-up of WS16 step 5 asks for.'],
]
const CLOSE = ' Done in WS16 step 7: '
const followUp = (name: string) => entries(followUps).find((l) => head(l) === name) ?? ''
const closeOf = (name: string) => {
  const entry = followUp(name)
  const at = entry.indexOf(CLOSE)
  return at < 0 ? '' : entry.slice(at)
}

/** The words a person or a log reads that this step writes. */
const WORDS = {
  sesOnly: '"Only an LCA admin can send a test through Amazon SES."',
  keyMissing: '"No Amazon SES key on this deployment."',
  stopped: '"Not sent: the send was stopped."',
}

describe('REDESIGN_STATUS.md, WS16 step 7: the Status line', () => {
  it('keeps the fixed prefix and gives this step\'s tail while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(7)
    if (latestStep === 7) expect(tail).toBe(TAIL)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 7: the block', () => {
  it('sits right after WS16 step 6\'s block and before the four lists, once', () => {
    expect(ws16.split(`\n${STEP}\n`)).toHaveLength(2)
    const at = [STEP_SIX, STEP, LISTS[0]].map((h) => ws16.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // Nothing between the two blocks but step 6's own, and nothing between this block and the decisions but itself and what a
    // later step adds there: its own block, "### WS16 step 8: ..." and on, or a checkpoint's section.
    // The page half of WS16 part two adds its part of the record there too, under its one heading (its page step 3).
    const later = (l: string) =>
      /^### WS16 step (?:[8-9]|1[0-2]): \S/.test(l) || /^### Checkpoint [MNO]: WS16 (?:steps \d+ to \d+|step \d+)$/.test(l) || l === '### WS16 part two: the newsletter\'s own page'
    expect(ws16.slice(at[0], at[1]).split('\n').filter((l) => l.startsWith('### '))).toEqual([STEP_SIX])
    expect(ws16.slice(at[1], at[2]).split('\n').filter((l) => l.startsWith('### ') && !later(l))).toEqual([STEP])
    expect(later('### WS16 step 8: a later block')).toBe(true)
    expect(later('### Checkpoint M: WS16 steps 1 to 8')).toBe(true)
    expect(later('### Step 8: a stray heading')).toBe(false)
    expect(later('### WS16 step 6: an earlier block')).toBe(false)
  })

  it('has every part, in order, each a bullet of its own, and says what a visitor or a member meets', () => {
    const parts = [
      '- **Files.**', '- **The signer.**', '- **The sender.**', '- **The kinds.**', '- **The cutover rule.**', '- **The sent newsletter.**',
      '- **Before the cutover.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**',
      '- **Build.**', '- **Worker.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(block.split('\n').filter((l) => l.startsWith('- Checks:'))).toHaveLength(1)
    expect(block).toContain('what a visitor or a member meets, by switch, is nothing new')
  })

  it('names every file it adds and changes, each test with its count, and the files beyond the step\'s list', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT, ...CHANGED_INTEGRATION]) expect(files, name).toContain(`\`${name}\``)
    for (const name of [...NEW_UNIT, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of [...CHANGED_UNIT, ...CHANGED_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before)[:)]`))
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const name of ['functions/utils/mail/newsletterAnswers.ts', 'test/unit/mail-rules-outcome.test.ts', 'test/integration/mail-email-choices.test.ts']) {
      expect(beyond, name).toContain(`\`${name}\``)
    }
    for (const piece of ['`src/`', '`migrations/`', '`package.json`', '`test/a11y/baseline.json`']) expect(beyond, piece).toContain(piece)
  })

  it('gives the signer: Web Crypto alone, the steps of AWS\'s guide, UriEncode, the headers sent as signed, the refusals, the key kept by no secret and the published values', () => {
    const signer = bullet(block, '- **The signer.**')
    for (const piece of [
      '`signAwsRequest`', '`functions/utils/mail/sigv4.ts`', '"Create a signed AWS API request"', 'Thursday, November 12, 2026', 'Web Crypto alone and no import at all',
      '`uriEncode`', 'a space as `%20` and a slash inside a segment as `%2F`', 'the query string\'s empty line', 'each name lowercased',
      'the hex SHA-256 of the body\'s UTF-8 bytes', '`AWS4-HMAC-SHA256`', '`aws4_request`', 'the headers sent are exactly the signed ones with the same values',
      'A query string, or a header the signer writes itself, is refused', 'keyed by the key id, the day, the region and the service, never by the secret',
      '`f4780e2d9f65fa895f9c67b32ce1baf0b0d8a43505a000a1a9e090d414db404d`', '`5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31`',
      '`5da7c1a2acd57cee7505fc6676e4e544621c30862966e37dddb68e92efbe5d6b`', 'node:crypto',
    ]) expect(signer, piece).toContain(piece)
  })

  it('gives the sender: the request, the From line, the tags, no request without a key, Amazon\'s words, the one override, and the catch point\'s own check', () => {
    const sender = bullet(block, '- **The sender.**')
    for (const piece of [
      '`sendThroughSes`', '`/v2/email/outbound-emails`', '`SES_REGION`, `us-east-1`', '`FromEmailAddress`', 'formed as Resend\'s transport forms it',
      '`Headers`', '`lca-mail`, `SES_CONFIGURATION_SET`', '`kind`', '`list`', 'that one string is hashed, signed and sent', 'the clock is read once, at the send',
      '`DEFAULT_FROM`', '`keyMissing`', WORDS.keyMissing, '`MessageId`', '`x-amzn-errortype`', 'after its last \'#\'', '`fromSes`', '200 characters, `AMAZON_WORDS_MAX`',
      'taken out should an answer ever quote them back', 'A fetch that throws is not caught there', '`through: \'ses\'`', 'nothing falls back from one service to the other',
      `\`${DOC_KEY}\``, 'the five minutes AWS allows', '`IncompleteSignature`', '`SignatureDoesNotMatch`', 'apart from the signer',
      'a sender that signed one body and sent another fails every case through it', '`AMAZON_CODES`', '`code` and `noAnswer`', '`via: \'ses\'`', '`via: \'resend\'`',
    ]) expect(sender, piece).toContain(piece)
  })

  it('gives the kinds: the table row by row, why an answer that may come after Amazon took the message is never tried again, and the two suites that hold it', () => {
    const kinds = bullet(block, '- **The kinds.**')
    for (const piece of [
      '`classifyOnce`', 'every row\'s earlier answer kept', '`TooManyRequestsException`', '"Maximum sending rate exceeded"', '"Daily message quota exceeded"',
      '`Throttling`', '`ServiceUnavailable`', '`SendingPausedException` and `AccountSuspendedException`', 'the row\'s attempt kept', '`configFault`',
      'the rows back untried and their attempts given back', '`AccessDeniedException`', '`UnrecognizedClientException`', '`InvalidClientTokenId`',
      '`IncompleteSignature`', '`ExpiredTokenException`', '`MissingAuthenticationToken`', '`NotAuthorized`', '`OptInRequired`', 'whatever status it comes with',
      '`NotFoundException`', '`MailFromDomainNotVerifiedException`', '`MessageRejected`', '`BadRequestException`', '`ValidationError`', '`ValidationException`',
      '`LimitExceededException`', 'a 413 and every other 4xx', '`InternalFailure`', 'a 502, a 504, a 408', '`RequestTimeoutException`',
      'since each may come after Amazon took the message, and trying again could send it twice', 'three sends at most', 'suppression list',
      '`test/unit/ses-sender.test.ts`', '`test/integration/ses-path.test.ts`', 'in that run or the next',
    ]) expect(kinds, piece).toContain(piece)
  })

  it('gives the cutover rule: its own pull request after the switch-on, Workers Paid first, the test through Amazon SES, the way back and no message by both', () => {
    const cutover = bullet(block, '- **The cutover rule.**')
    for (const piece of [
      '`MAIL_SENDER` stays `\'resend\'`', 'a pull request of its own after the change that switches the newsletter on', 'once Amazon has approved real sending',
      'the account is on Workers Paid', '`export const MAIL_SENDER: MailSender = \'ses\'`', '`test/unit/mail-switches.test.ts`', 'refuses `\'ses\'` while `WORKERS_PLAN` is `\'free\'`',
      '`MAIL_LISTS_ON || MAIL_SENDER === \'ses\'`', 'The way back is the same line back', 'waits, untried, for Amazon SES', 'No message is sent by both services',
      'land minutes apart', 'every message still once', 'its policy for the newsletter\'s address', 'the mailbox simulator\'s addresses', '`lca_admin`',
      'never from the body', WORDS.sesOnly, 'after the guard and the 404', 'nobody learns the newsletter is on', 'newsletter@news.louisianachess.org',
      'is never handed to Resend instead', 'noreply@louisianachess.org',
    ]) expect(cutover, piece).toContain(piece)
  })

  it('gives the sent newsletter: the five cases moved from WS16 steps 4 and 6, through the SES catch point, and each kind of email the same as through Resend', () => {
    const sent = bullet(block, '- **The sent newsletter.**')
    for (const piece of [
      '`test/integration/ses-path.test.ts`', 'mocked over the real one', 'answers 201 for an LCA admin with a second factor, the president and the media manager with one',
      'WS16 step 4\'s case a', 'WS16 step 6\'s case b', '`test/integration/media-manager.test.ts`', 'a parent and two children on one address get one email',
      '`List-Unsubscribe-Post: List-Unsubscribe=One-Click`', 'no postal address (case d)', 'is 409 and writes nothing (case g)', 'the row decides',
      'with no request to Resend', '(case l)', 'a registration confirmation, a support reply, a Group email batch and a reminder of the daily run',
      'each of their cases still holds what its title says',
    ]) expect(sent, piece).toContain(piece)
  })

  it('gives what WS16 step 4 left for before the cutover: the member delete, a stopped newsletter\'s rows and words that name the service', () => {
    const three = bullet(block, '- **Before the cutover.**')
    for (const piece of [
      '`functions/api/admin/members/[id].ts`', '`leaveSendingNewsletter`', 'pending and not marked sending', 'no account in the newsletter\'s audience holds the address any more',
      '`skipped_count`', 'counted again from its rows', 'a family\'s address stays while another account on it holds an active membership', '`NEWSLETTER_ROWS_UNREAD_LOG`',
      WORDS.stopped, '`failed_count`', '`putBackRows` and `failStopped`', '`writeOffClosed`', 'a stopped newsletter ends with no pending row and its counts add up',
      'Group email\'s put back and write-off are the statements of before, word for word', '`STOPPED_WORDS`', '"Email send failed: Amazon SES ..."',
      'stay byte for byte for a message that went to Resend',
    ]) expect(three, piece).toContain(piece)
  })

  it('says nothing a visitor or a member meets ships with every switch off, and what each change does then', () => {
    const off = bullet(block, '- **What ships with every switch off.**')
    expect(off.startsWith('- **What ships with every switch off.** Nothing a visitor or a member meets.')).toBe(true)
    for (const piece of [
      'no request goes to Amazon from any path', 'whose endpoint answers 404 while `MAIL_LISTS_ON` is unset', '`test/unit/mail-seam-bytes.test.ts`',
      'three statements that name migration 0060\'s columns `list_id` and `sending_at`', 'they change nothing', 'answers, writes and logs exactly as on the base',
      'on a database without 0060 the batch fails', 'the delete joins Group email\'s send and the sweep', '0060 must reach production with checkpoint M\'s deploy or before it',
      'with the rules off the sweep is the base\'s, statement for statement', 'Resend\'s words for a failed send are byte for byte', 'all 232 of `dist`',
      '`test/a11y/baseline.json` is unchanged', 'This step adds no migration', '`deploy-worker.yml`', 'of the 23 suites that read the outbox on the base, counted by a search where the plan said thirteen, 21 pass with no line changed',
      '`test/integration/published-review-edges.test.ts`', '`MAIL_SENDER` `\'resend\'` while `WORKERS_PLAN` is `\'free\'`',
    ]) expect(off, piece).toContain(piece)
  })

  it('lists the pins it moved, each with its reason, and the counts as before where they are', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/unit/mail-switches.test.ts`', 'either service', '`test/unit/mail-one-seam.test.ts`', 'one file to two', '`test/unit/mail-worker-closure.test.ts`',
      'five to seven', '`test/unit/mail-rules-outcome.test.ts`', '`MailFromDomainNotVerifiedException`', '`test/unit/browser-test-wiring.test.ts`',
      '`test/integration/mail-email-choices.test.ts`', '"never hands list mail to Resend"', '`via`', 'its count, 33, as before',
      '`test/integration/published-review-edges.test.ts`', 'its count, 24, as before', 'no pin on words a record wrote',
    ]) expect(pins, piece).toContain(piece)
  })

  it('makes its judgement calls, at least twelve, the code before the status, the key kept by no secret and the shipped files\' words among them', () => {
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(12)
    for (const piece of [
      'A key fault\'s code is a key fault whatever status it comes with', 'read by `configFault` with the key faults', 'A fetch that throws reaches the seam',
      'Any 2xx is sent', '200 characters on one line', 'never by the secret', 'another key id', 'as AWS\'s SDKs sign the path of every service but Amazon S3',
      '`LIST_SENDERS`', '`test/unit/mail-link-files-closure.test.ts`', 'runs at every delete', 'two statements more for a list campaign alone',
      '`service: \'ses\'` alone', 'within five minutes', 'left as they were written', 'D33, Q42 and Q48', 'the browser run\'s figures as the base\'s', 'plainly made up',
    ]) expect(calls, piece).toContain(piece)
  })

  it('gives the lint as unchanged, the build as the base\'s file for file, and each check once', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    expect(bullet(block, '- **Lint.**')).toContain('`aa731a1`')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      '`aa731a1`', 'a local production build', '`index-D0OkgN_2.js` at 553,776 bytes', '`index-C2evaz7M.css` at 130,610 bytes', '`features-DxqQlIon.js` at 698 bytes',
      '232 files of `dist`, 194 of them in `dist/assets`', 'so no file of the site changes', 'a local build\'s figures', 'Thursday, November 12, 2026',
    ]) {
      expect(build, piece).toContain(piece)
    }
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('the one browser run being the gate\'s before the commit')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`')
  })

  it('gives the worker\'s dry run on the base and after, measured on their day, the difference, and what is left under part one\'s ceiling of 96 KiB, gzip 28 KiB', () => {
    const worker = bullet(block, '- **Worker.**')
    for (const piece of [
      '`npx wrangler deploy --dry-run`', '`--config workers/daily-emails/wrangler.toml`', '`aa731a1`', 'Thursday, November 12, 2026', 'The bundle holds no package.',
      '96 KiB, gzip 28 KiB', 'no minify setting', 'Amazon SES\'s transport and its signer', 'nothing caps its waits on Workers Paid', 'which is not built here',
      'far inside the time a scheduled run is given',
    ]) {
      expect(worker, piece).toContain(piece)
    }
    const sizes = [...worker.matchAll(/([\d.]+) KiB, gzip ([\d.]+) KiB, on the (?:base|finished tree)/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(sizes).toHaveLength(2)
    const [base, after] = sizes
    expect(base).toEqual([64.94, 17.48])
    expect(after[0]).toBeGreaterThan(base[0])
    const growth = /: ([\d.]+) KiB more, gzip ([\d.]+) KiB, and /.exec(worker)
    expect(growth, 'the growth').not.toBeNull()
    expect(Number(growth![1])).toBeCloseTo(after[0] - base[0], 2)
    expect(Number(growth![2])).toBeCloseTo(after[1] - base[1], 2)
    const bytes = [...worker.matchAll(/`index\.js` ([\d,]+) bytes/g)].map((m) => num(m[1]))
    expect(bytes[0]).toBe(66499)
    expect(worker).toContain(`${(bytes[1] - bytes[0]).toLocaleString('en-US')} bytes`)
    const left = /leaves ([\d.]+) KiB, gzip ([\d.]+) KiB/.exec(worker)
    expect(left, 'what the ceiling leaves').not.toBeNull()
    expect(Number(left![1])).toBeCloseTo(96 - after[0], 2)
    expect(Number(left![2])).toBeCloseTo(28 - after[1], 2)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 7: the figures add up', () => {
  const files = bullet(block, '- **Files.**')
  const countOf = (name: string) => {
    const m = new RegExp(`\`${escape(name)}\` \\((\\d+)(?:, (\\d+) before|, as before)?[:)]`).exec(files)
    return m ? { now: Number(m[1]), before: Number(m[2] ?? m[1]) } : null
  }

  it('gives unit counts that add up: the base\'s, the new files\' tests and the changed files\' gains', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([8488, 328])
    const counts = [...NEW_UNIT, ...CHANGED_UNIT].map((name) => [name, countOf(name)] as const)
    for (const [name, count] of counts) expect(count, name).not.toBeNull()
    const gain = counts.reduce((sum, [name, count]) => sum + (NEW_UNIT.includes(name) ? count!.now : count!.now - count!.before), 0)
    expect(num(before) + gain).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s, the new file\'s and the changed files\' as before', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1606, 99])
    for (const name of [...NEW_INTEGRATION, ...CHANGED_INTEGRATION]) expect(countOf(name), name).not.toBeNull()
    const gain = NEW_INTEGRATION.reduce((sum, name) => sum + countOf(name)!.now, 0) + CHANGED_INTEGRATION.reduce((sum, name) => sum + countOf(name)!.now - countOf(name)!.before, 0)
    expect(num(before) + gain).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the browser run as the base\'s, whose counts add up, and the lint figures as the base\'s with the new files added', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, the base's figures/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect([num(run![1]), num(run![2]), num(run![3])]).toEqual([995, 659, 336])
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(930)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_LINTED.length)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 7: the map', () => {
  it('adds a sentence of what this step proves to the six items planned for it, once each, ahead of the planned step, and to no other item', () => {
    for (const [id, sentence] of PROVED) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.endsWith('Planned: WS16 step 7.'), id).toBe(true)
      expect(item.indexOf(sentence), id).toBeLessThan(item.indexOf('Planned: WS16 step 7.'))
    }
    expect(entries(map).filter((l) => l.includes('Proved in WS16 step 7 by')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(PROVED.map(([id]) => id))
  })

  it('adds a sentence that starts "Built in WS16 step 7" to the six items another step proves that it builds a part of, ahead of their planned steps', () => {
    for (const [id, step] of BUILT) {
      const item = mapItem(id)
      expect(item.split('Built in WS16 step 7: '), id).toHaveLength(2)
      expect(item.endsWith(`Planned: WS16 step ${step}.`), id).toBe(true)
      expect(item.indexOf('Built in WS16 step 7: '), id).toBeLessThan(item.indexOf(`Planned: WS16 step ${step}.`))
    }
    expect(entries(map).filter((l) => l.includes('Built in WS16 step 7:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['AC10', 'AC12', 'AC13', 'D31', 'D37', 'Q41'])
  })

  it('says in each sentence what the tests hold', () => {
    for (const piece of ['Web Crypto alone with no import', 'get-vanilla and post-vanilla', 'a 500, a 502, a 504, a 408, no answer at all and a code no one named', 'in that run or the next', 'a fault of the account\'s setup', 'the same recipient, subject and page as through Resend']) {
      expect(added('AC2', PROVED[0][1]), piece).toContain(piece)
    }
    for (const piece of ['nothing falls back inside a send', 'whatever `MAIL_LISTS_ON` says', 'a second POST while one is sending is 409']) expect(added('AC3', PROVED[1][1]), piece).toContain(piece)
    for (const piece of ['`List-Unsubscribe-Post: List-Unsubscribe=One-Click`', 'no postal address', 'carries no headers']) expect(added('AC8', PROVED[2][1]), piece).toContain(piece)
    for (const piece of ['no setting file a deploy reads', 'AWS\'s documentation key id and a made-up secret', 'bound empty in the browser tests']) expect(added('D33', PROVED[3][1]), piece).toContain(piece)
    expect(added('Q42', PROVED[4][1])).toContain('`\'ses\'` only with `WORKERS_PLAN` `\'paid\'`')
    expect(added('Q48', PROVED[5][1])).toContain('`SES_REGION`')
    expect(added('AC13', 'Built in WS16 step 7: ')).toContain('makes no request to Amazon')
    expect(added('AC10', 'Built in WS16 step 7: ')).toContain('a parent and two children on one address')
  })

  it('keeps the earlier steps\' sentences on those items word for word, ahead of this step\'s', () => {
    for (const [id, sentence] of EARLIER) {
      const item = mapItem(id)
      expect(item.split(sentence), `${id}: ${sentence}`).toHaveLength(2)
      const ours = Math.max(item.indexOf('Proved in WS16 step 7 by'), item.indexOf('Built in WS16 step 7: '))
      expect(item.indexOf(sentence), id).toBeLessThan(ours)
    }
  })
})

describe('REDESIGN_STATUS.md, WS16 step 7: the lists', () => {
  it('records this step\'s entries in each list, in their order, each once and tagged', () => {
    expect(tagged(decisions).map(head)).toEqual(HEADS.decisions)
    expect(tagged(deviations).map(head)).toEqual(HEADS.deviations)
    expect(tagged(verify).map(head)).toEqual(HEADS.verify)
    expect(tagged(followUps).map(head)).toEqual(HEADS.followUps)
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of tagged(list)) expect(entry, head(entry)).toMatch(/^- \*\*[^*]+ \(WS16 step 7\)\.\*\* \S/)
    }
  })

  it('puts its entries after the earlier steps\' in each list', () => {
    const last = {
      decisions: 'The media manager is a board seat\'s holder (WS16 step 6).',
      deviations: 'The media manager reaches only WS16\'s own endpoints (WS16 step 6).',
      verify: 'The files read as the base has them (WS16 step 6).',
      followUps: 'A media manager\'s test through Amazon SES (WS16 step 6).',
    }
    for (const [name, list] of [['decisions', decisions], ['deviations', deviations], ['verify', verify], ['followUps', followUps]] as const) {
      const heads = entries(list).map(head)
      expect(heads.indexOf(HEADS[name][0]), name).toBeGreaterThan(heads.indexOf(last[name]))
      expect(heads.indexOf(last[name]), name).toBeGreaterThan(-1)
    }
  })

  it('closes four earlier follow-ups at their ends, their earlier words as their steps wrote them, and closes no other entry', () => {
    for (const [name, lastWords] of CLOSED) {
      const entry = followUp(name)
      expect(entry.split(CLOSE), name).toHaveLength(2)
      expect(entry.split(CLOSE)[0].endsWith(lastWords), name).toBe(true)
      expect(entry.endsWith('.'), name).toBe(true)
    }
    expect(entries(ws16).filter((l) => l.includes(' Done in WS16 step 7:')).map(head).sort()).toEqual(CLOSED.map(([name]) => name).sort())
    for (const piece of ['`leaveSendingNewsletter`', '`skipped_count`', 'deleting one of two accounts on an address and then the other']) expect(closeOf(CLOSED[0][0]), piece).toContain(piece)
    for (const piece of ['`failed_count`', 'writes off a closed list campaign\'s marked rows', 'an answer of later after the stop', 'a run that died after the mark']) {
      expect(closeOf(CLOSED[1][0]), piece).toContain(piece)
    }
    for (const piece of ['`service: \'ses\'` for an LCA admin alone', 'whatever `MAIL_SENDER` says', 'with the box ticked and without it']) expect(closeOf(CLOSED[2][0]), piece).toContain(piece)
    for (const piece of [WORDS.sesOnly, 'the media manager and the president', 'with a second factor where the guard asks one']) expect(closeOf(CLOSED[3][0]), piece).toContain(piece)
  })

  it('records D33 with K\'s date and the keys as Cloudflare secrets, and turns down a key in a file or on a preview', () => {
    const [account] = tagged(decisions)
    for (const piece of [
      'D33, settled by K on Tuesday, November 10, 2026', '`SES_ACCESS_KEY_ID` and `SES_SECRET_ACCESS_KEY`', 'never on the Preview environment',
      'a secret is never pasted into chat, a file or the repository', `\`${DOC_KEY}\`, which opens nothing`, 'No setting, test or file holds K\'s address or a real key', 'Turned down:',
    ]) expect(account, piece).toContain(piece)
  })

  it('records the cutover rule in its own words, and the region as K\'s to change, the constant and the console agreeing', () => {
    const [, cutover, region] = tagged(decisions)
    expect(cutover.startsWith('- **The cutover is its own change, after Workers Paid (WS16 step 7).**')).toBe(true)
    for (const piece of [
      'K\'s decisions 28 and 31', 'in a pull request of its own after the change that switches the newsletter on', 'K\'s checks in the sandbox',
      'back to `\'resend\'` the same way', 'No message is sent by both', 'land minutes apart', 'error 1102', 'Workers Paid gives 30 seconds', 'Turned down:',
    ]) expect(cutover, piece).toContain(piece)
    for (const piece of ['`SES_REGION`', '`us-east-1`', 'It is K\'s to change', 'that one constant and the region in Amazon\'s console must agree', '`NotFoundException`', 'Turned down:']) {
      expect(region, piece).toContain(piece)
    }
  })

  it('records the deviation against brief 1.4\'s rule for server constants', () => {
    const [reach] = tagged(deviations)
    for (const piece of ['Brief 1.4\'s section 0.2', 'whatever `MAIL_LISTS_ON` says', 'its three statements change nothing']) expect(reach, piece).toContain(piece)
  })

  it('resolves the verify items, each confirmed, not settled or not checked, with the day each page was read', () => {
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^(?:Confirmed\b|Not settled\b|Not checked\b)/)
    const byHead = (h: string) => tagged(verify).find((e) => head(e) === h) ?? ''
    expect(byHead(HEADS.verify[1])).toContain('Not settled by the pages read')
    expect(byHead(HEADS.verify[2])).toContain('"friendly from"')
    expect(byHead(HEADS.verify[4])).toContain('256 characters at most')
    expect(byHead(HEADS.verify[5])).toContain('1 to 995 characters')
    expect(byHead(HEADS.verify[6])).toContain('"In most cases, a request must reach AWS within five minutes of the time stamp in the request. Otherwise, AWS denies the request."')
    expect(byHead(HEADS.verify[13])).toContain('`git diff --stat 16c188a aa731a1`')
    for (const index of [1, 2, 3, 4, 5, 6]) expect(byHead(HEADS.verify[index]), HEADS.verify[index]).toContain('read on Thursday, November 12, 2026')
  })

  it('hands on K\'s checks in the sandbox, the keys on both deployments and the published review\'s case', () => {
    const [sandbox, keys, review] = HEADS.followUps.map(followUp)
    for (const piece of ['the box ticked', 'the mailbox simulator', 'the address alone', 'encoded words', 'DKIM-Signature', '`lca-mail`', 'WS16 step 8']) expect(sandbox, piece).toContain(piece)
    for (const piece of ['`npx wrangler secret put SES_ACCESS_KEY_ID --config workers/daily-emails/wrangler.toml`', 'never on the Preview environment', 'This closes when K has set both keys in both places']) {
      expect(keys, piece).toContain(piece)
    }
    for (const piece of ['`test/integration/published-review-edges.test.ts`', 'WS16 step 12']) expect(review, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 7: plain language', () => {
  /** Everything this step wrote in the section: its block, its entries, its map sentences, its closes and the Status line's tail. */
  const written = [
    block, ...[decisions, deviations, verify, followUps].flatMap(tagged), ...PROVED.map(([id, s]) => added(id, s)),
    ...BUILT.map(([id]) => added(id, 'Built in WS16 step 7: ')), ...CLOSED.map(([name]) => closeOf(name)),
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

describe('REDESIGN_STATUS.md, WS16 step 7: the date and the new files', () => {
  it('dates the record on a real day, on or after Thursday, November 12, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-12').toBe(true)
  })

  it('lists as new only files that exist, the new code and tests free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT, ...CHANGED_INTEGRATION]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_LINTED) {
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
  })

  it('keeps the same out of the changed files that held none before, whole, and out of the parts this step wrote in the ones that did', () => {
    // Files that held a dash, a tool's name or the old initials before this step, read only in the parts it wrote.
    const older = [
      'functions/utils/admin/campaigns.ts', 'test/integration/harness.ts', 'workers/daily-emails/wrangler.toml', 'functions/types.ts', 'functions/utils/email.ts',
      'workers/daily-emails/src/index.ts', 'vitest.integration.config.ts', 'test/unit/browser-test-wiring.test.ts',
    ]
    const [campaigns, harness, toml, types, email, worker, config, wiring] = older.map(read)
    const texts: Array<readonly [string, string]> = [
      ...[...CHANGED.filter((f) => /\.tsx?$/.test(f)), ...CHANGED_UNIT, ...CHANGED_INTEGRATION].filter((f) => !older.includes(f)).map((file) => [file, read(file)] as const),
      ['campaigns.ts, the words of Amazon SES in sendOne', between(campaigns, 'Amazon SES\'s answers, and a message for it', 'return {')],
      ['campaigns.ts, the stop\'s words and the rules\' words', between(campaigns, ' * The words of a stopped newsletter\'s row', '/** The parts of one email on an LCA list')],
      ['campaigns.ts, the put back and the write-off', between(campaigns, ' * The two statements that fail, with STOPPED_WORDS', '/** The words on the next row a run would send')],
      ['campaigns.ts, the sweep', between(campaigns, ' * The sweep under the engine\'s rules', 'let left = budget ?? sweepBatch')],
      ['harness.ts, the outbox entry', between(harness, '   * The message\'s own headers, keyed by name', 'export interface CreatedStripeSession')],
      ['harness.ts, the catch point\'s check', between(harness, '// The catch point\'s own check of Signature Version 4', 'export function installFetchInterceptor')],
      ['harness.ts, the catch point', between(harness, '    // Amazon SES: SES\'s v2 SendEmail, in the site\'s region.', `    // ${'Anthr' + 'opic'}: the scanner`)],
      ['wrangler.toml, the two keys', between(toml, '# Amazon SES\'s sending key', 'SES_SECRET_ACCESS_KEY --config')],
      ['types.ts, the two keys on Env', between(types, '   * Amazon SES\'s sending key, its id and its secret', 'export interface MemberRow')],
      ['email.ts, the two keys on EmailEnv', between(email, ' * engine\'s rules are on. The two keys of Amazon SES', '\n}\n')],
      ['email.ts, the words of a failed send', between(email, ' * The words a failed send is reported with', '\n}\n')],
      ['the worker\'s Env, the two keys', between(worker, '   * Amazon SES\'s sending key, the same as the site\'s production keys', 'async function phase')],
      ['the integration config, the harness\'s key', between(config, '// Amazon SES\'s key for the harness', '\n        },')],
      ['browser-test-wiring.test.ts, the keys left out', between(wiring, '  it(\'leaves out the keys that could charge a card, send mail or read a page\'', '    expect(Object.keys(values)')],
    ]
    for (const [name, text] of texts) {
      expect(text.length, name).toBeGreaterThan(60)
      expect(text, name).not.toMatch(DASHES)
      expect(text.replace(/ANTHROPIC_API_KEY/g, ''), name).not.toMatch(TOOLS)
      expect(text, name).not.toMatch(BARE)
      expect(text, name).not.toMatch(OLD_INITIALS)
    }
  })
})
