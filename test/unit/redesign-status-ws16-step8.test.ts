// test/unit/redesign-status-ws16-step8.test.ts
//
// REDESIGN_STATUS.md records WS16 step 8: the bounce and complaint receiver,
// and checkpoint M's section. Like the record tests of WS16 steps 1 to 7,
// this file reads only the WS16 section, from its heading to the Phase 0
// heading, and the date at the start of the date line, never every table
// row or heading of the file, and it reads no count or figure from the
// code. Pinned here: the Status line's tail while this step is the latest;
// the block's place and its parts in order, its files with their counts,
// which must add up, and its figures, the worker's against part one's
// ceiling; the sentences this step added to six map items, each ahead of
// its planned step and behind the earlier steps' own sentences, which stay;
// this step's entries in the four lists, each with its tag, and its close of
// one earlier follow-up, at the end of its entry with the earlier words as
// they were; checkpoint M's section by its own lines, its opening, its
// bullets in order and what each says, and not by its length, so the one
// line each later change writes there passes it; the plain-language rules
// over everything this step wrote; and the date, any real day from
// Thursday, November 12, 2026 on. The new files, and the parts this step
// wrote in older ones, are read only to find them and to hold them to the
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
/** An assistant named in a pull request's text, or a line about how it was written. */
const ASSISTANT = new RegExp(`\\b(?:${'assis' + 'tant'}|${'gener' + 'ated'}|${'wri' + 'tten by'})\\b`, 'i')

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
const TAG = '(WS16 step 8).'
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
const STEP_SEVEN = '### WS16 step 7: the Amazon SES sender'
const STEP = '### WS16 step 8: the bounce and complaint receiver'
const CHECKPOINT = '### Checkpoint M: WS16 steps 1 to 8'
const LISTS = ['### WS16 decisions', '### WS16 deviations from the brief', '### WS16 verify items resolved', '### WS16 follow-ups']
const map = part('### WS16 map: what proves each acceptance criterion and decision')
const block = part(STEP)
const checkpoint = part(CHECKPOINT)
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
const TAIL = 'steps 1 to 8 are built.'

/** The sentences this step adds to the map for the items it proves, each planned for this step. */
const PROVED: ReadonlyArray<readonly [string, string]> = [
  ['AC4', 'Proved in WS16 step 8 by `test/unit/sns-signature.test.ts` and `test/integration/ses-events.test.ts`: '],
  ['AC13', 'Proved in WS16 step 8 by `test/integration/mail-email-choices.test.ts` and `test/unit/mail-step3-words.test.ts` of WS16 step 3, '],
  ['AC14', 'Proved in WS16 step 8 by `test/unit/mail-seam-bytes.test.ts`, the thirteen integration suites that read the harness\'s outbox, '],
  ['D35', 'Proved in WS16 step 8 by `test/integration/ses-events.test.ts`: a permanent bounce stops all mail to the address'],
  ['Q47', 'Proved in WS16 step 8 by `test/integration/ses-events.test.ts`: as read, (a)'],
]
/** The items another step proves that this step builds a part of, each with the step planned for it. */
const BUILT: ReadonlyArray<readonly [string, number]> = [['AC15', 9]]
/** The earlier steps' sentences on the items this step adds to, which stay word for word, ahead of this step's. */
const EARLIER: ReadonlyArray<readonly [string, string]> = [
  ['AC13', 'Built in WS16 step 3: no link key on a preview'],
  ['AC13', 'Built in WS16 step 7: Amazon SES\'s two keys, secrets of the production environment and of the daily-emails worker alone'],
  ['AC14', 'Built in WS16 step 1: `mailLists` off, `MAIL_LISTS_ON` unset and `MAIL_SENDER` `\'resend\'`'],
]

/** The files this step adds. */
const NEW_FILES = [
  'functions/utils/mail/sns.ts', 'functions/utils/mail/sesEvents.ts', 'functions/api/mail/ses-events.ts', 'test/integration/helpers/sns.ts',
  'test/unit/fixtures/sns-test-cert.pem', 'test/unit/fixtures/sns-test-cert-pubkey.pem', 'test/unit/sns-signature.test.ts', 'test/integration/ses-events.test.ts',
  'test/integration/ses-events-edges.test.ts', 'test/integration/contracts/ses-events.test.ts', 'test/unit/redesign-status-ws16-step8.test.ts',
]
const NEW_UNIT = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new files that are code or tests, which lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.tsx?$/.test(f))
/** The files of code, settings, harness and record this step changes. */
const CHANGED = [
  'functions/utils/mail/ses.ts', 'functions/utils/mail/lists.ts', 'domain/contracts/mail.ts', 'domain/contracts/registry.ts', 'functions/types.ts',
  'vitest.integration.config.ts', 'test/a11y/global-setup.ts', 'test/integration/harness.ts', 'REDESIGN_STATUS.md',
]
/** The test files this step changes, each with its count written in the block. */
const CHANGED_UNIT = ['test/unit/mail-one-seam.test.ts', 'test/unit/mail-worker-closure.test.ts', 'test/unit/routes.test.ts']

/** The heads of this step's entries in the four lists, in their order. */
const HEADS = {
  decisions: [
    'A dead address stops all mail; a spam report stops that list (WS16 step 8).',
    'Only what the rules need is stored of a report (WS16 step 8).',
    'The topic\'s name is a secret of the production Pages project alone (WS16 step 8).',
  ],
  deviations: [
    'The receiver listens to SNS, with its signature checked (WS16 step 8).',
    'Amazon\'s own suppression list holds bounces only (WS16 step 8).',
    'Brief 1.4\'s bounce reads the do-not-send list (WS16 step 8).',
  ],
  verify: [
    'How Amazon SES reaches an address on the site (WS16 step 8).',
    'The signature\'s scheme (WS16 step 8).',
    'The body and its headers (WS16 step 8).',
    'What a report carries (WS16 step 8).',
    'The two kinds that change nothing (WS16 step 8).',
    'SHA-1 in the Workers runtime (WS16 step 8).',
    'SNS\'s limit for a message (WS16 step 8).',
    'A certificate\'s address as the URL parser reads it (WS16 step 8).',
    'The values the tables hold (WS16 step 8).',
    'The tag names (WS16 step 8).',
    'The mark\'s time (WS16 step 8).',
    'openssl in the container (WS16 step 8).',
    'Amazon SES\'s own email of reports (WS16 step 8).',
    'The contract figures and the new methods (WS16 step 8).',
    'The files read as the base has them (WS16 step 8).',
  ],
  followUps: [
    'The first confirmation against Amazon\'s own certificate (WS16 step 8).',
    'The topic\'s name on the production Pages project (WS16 step 8).',
    'What Not delivered reads of the receiver\'s rows, for WS16 step 9 (WS16 step 8).',
    'A subscription removed through a notification (WS16 step 8).',
  ],
}

/** The earlier follow-up this step closes, with the last words its own step wrote, which stay as they were. */
const CLOSED: ReadonlyArray<readonly [string, string]> = [
  ['The media manager\'s seat and role on switch-on day (WS16 step 6).', 'takes messages like every seat.'],
]
const CLOSE = ' Done in WS16 step 8: '
const followUp = (name: string) => entries(followUps).find((l) => head(l) === name) ?? ''
const closeOf = (name: string) => {
  const entry = followUp(name)
  const at = entry.indexOf(CLOSE)
  return at < 0 ? '' : entry.slice(at)
}

/** The bullets of checkpoint M's section, in order; a later change adds its own line among them, which these leave room for. */
const CHECKPOINT_BULLETS = [
  '- **WS16 step 1:**', '- **WS16 step 2:**', '- **WS16 step 3:**', '- **WS16 step 4:**', '- **WS16 step 5:**', '- **WS16 step 6:**', '- **WS16 step 7:**',
  '- **WS16 step 8:**', '- **What the merge does with every switch off.**', '- **What needs migration 0060 on production.**', '- **K\'s list before the merge.**',
  '- **K\'s list on switch-on day.**', '- **K\'s list for the cutover.**', '- **The switch-on change.**', '- **The cutover change.**', '- **The pull request\'s text.**',
]
/** The section's opening paragraph, the line after its heading and a blank line. */
const opening = checkpoint.split('\n')[2] ?? ''
/** The pull request's text: its title and its paragraphs, each a quoted line under its bullet. */
const pullRequest = bullet(checkpoint, '- **The pull request\'s text.**').split('\n').filter((l) => l.startsWith('  >')).map((l) => l.replace(/^ {2}> ?/, ''))

describe('REDESIGN_STATUS.md, WS16 step 8: the Status line', () => {
  it('keeps the fixed prefix and gives this step\'s tail while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(8)
    if (latestStep === 8) expect(tail).toBe(TAIL)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 8: the block', () => {
  it('sits right after WS16 step 7\'s block, then checkpoint M\'s section, then the four lists, once each', () => {
    expect(ws16.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(ws16.split(`\n${CHECKPOINT}\n`)).toHaveLength(2)
    const at = [STEP_SEVEN, STEP, CHECKPOINT, LISTS[0]].map((h) => ws16.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // Nothing between step 7's block and this one but step 7's own; between this block and the decisions, this block, checkpoint
    // M's section and what a later step adds there: its own block, "### WS16 step 9: ..." and on, or a later checkpoint's section,
    // or the part of the record of WS16 part two's page half, under its one heading.
    const later = (l: string) =>
      /^### WS16 step (?:9|1[0-2]): \S/.test(l) || /^### Checkpoint [NO]: WS16 (?:steps \d+ to \d+|step \d+)$/.test(l) || l === '### WS16 part two: the newsletter\'s own page'
    expect(ws16.slice(at[0], at[1]).split('\n').filter((l) => l.startsWith('### '))).toEqual([STEP_SEVEN])
    expect(ws16.slice(at[1], at[3]).split('\n').filter((l) => l.startsWith('### ') && !later(l))).toEqual([STEP, CHECKPOINT])
    expect(later('### WS16 step 9: a later block')).toBe(true)
    expect(later('### Checkpoint N: WS16 steps 9 to 11')).toBe(true)
    expect(later('### Step 9: a stray heading')).toBe(false)
    expect(later('### WS16 step 7: an earlier block')).toBe(false)
  })

  it('has every part, in order, each a bullet of its own, and says what a visitor or a member meets', () => {
    const parts = [
      '- **Files.**', '- **The receiver.**', '- **What is stored.**', '- **Checkpoint M.**', '- **What ships with every switch off.**', '- **Pins moved.**',
      '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- **Worker.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(block.split('\n').filter((l) => l.startsWith('- Checks:'))).toHaveLength(1)
    expect(block).toContain('what a visitor or a member meets, by switch, is nothing new')
    expect(block.split('\n')[2].startsWith('WS16 step 8 is the eighth and last step of checkpoint M.')).toBe(true)
  })

  it('names every file it adds and changes, each test with its count, and the files beyond the step\'s list', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT]) expect(files, name).toContain(`\`${name}\``)
    for (const name of [...NEW_UNIT, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of CHANGED_UNIT) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before)[:)]`))
    const beyond = bullet(files, '  - Files beyond the step\'s list:')
    for (const name of ['functions/utils/mail/ses.ts', 'functions/utils/mail/lists.ts', 'test/unit/routes.test.ts']) expect(beyond, name).toContain(`\`${name}\``)
    for (const piece of ['`src/`', '`migrations/`', '`workers/`', '`package.json`', '`test/a11y/baseline.json`']) expect(beyond, piece).toContain(piece)
  })

  it('gives the receiver: the 404 before the body, the checks in their order, one sentence for every refusal, the 500s, the age, the trust, what a stranger can make it do, and the contract', () => {
    const receiver = bullet(block, '- **The receiver.**')
    const order = [
      'before the body is read, unless `engineRulesOn()` is true and `SES_SNS_TOPIC_ARN` is set', 'more than 262,144 bytes, SNS\'s own limit for a message',
      'a body that is not JSON, or not a message whose fields are strings', 'a TopicArn other than the one bound, with nothing fetched at all',
      'an `x-amz-sns-message-type` header that names another type, or none', 'a Timestamp that cannot be read as a time',
      'a SubscriptionConfirmation whose SubscribeURL is not on SNS\'s own host for the region over https', '`verifySnsMessage`',
    ]
    const at = order.map((piece) => receiver.indexOf(piece))
    for (const [i, piece] of order.entries()) expect(at[i], piece).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    for (const piece of [
      '"This notification was not accepted."', 'so a prober learns nothing of the check that refused it', '"This notification could not be taken now. Send it again later."',
      'does tell a caller that a guessed topic name is right', 'K\'s account number, which a caller would have to guess',
      'RSASSA-PKCS1-v1_5 with SHA-1 for version 1 and with SHA-256 for version 2', 'not 256, 384 or 512 bytes', 'one GET of its SubscribeURL',
      'an UnsubscribeConfirmation answers 200 with one warning line', 'more than three hours old by its signed Timestamp', 'cannot put it back',
      'only when it reads the same once the URL parser has read it', 'lowercases an upper-case host, decodes an encoded dot, drops the default port',
      'the certificate\'s chain is not walked', 'one certificate a request from Amazon\'s own host, at most, and nothing is written',
      'four at most before the cache starts again empty', 'so no stream of addresses can grow it', 'Safe twice', 'Why SNS and not EventBridge',
      'never following a redirect', 'or answers a redirect, which is never followed', 'nothing fetched from any other host is ever read, kept or trusted',
      'no shared secret', '`sesEventsResponseSchema`', 'as Stripe\'s webhook\'s is not', '27 of the 137 methods under `functions/api` contracted, 26 of 136 before, and `PENDING_COUNT` 110, unchanged',
    ]) expect(receiver, piece).toContain(piece)
  })

  it('gives what is stored: a bounce\'s three facts for the address the message was sent to, a report\'s choice and mark, nothing else, and what is skipped', () => {
    const stored = bullet(block, '- **What is stored.**')
    for (const piece of [
      'three facts and nothing else', 'one row of `mail_do_not_send` for the address the message was sent to', 'the one Amazon\'s record of the send names, `mail.destination`',
      'and not the one the bounce names', 'the `Final-Recipient` of the receiving server\'s report', 'a real member\'s address among them', 'Every message the site sends has one recipient',
      'stops each address the bounce names that the record names too', 'one whose record names no one stops no one', 'whose addresses Amazon fills from the message\'s own recipients',
      'the reason `\'bounce\'`', 'the bounce\'s kind as Amazon names it', '`created_at`', '`INSERT OR IGNORE`', '`makeContact`',
      'the \'out\' choice from `\'complaint\'`', '`LIST_TAG`', 'a tag naming no list changes no list', '`complained_at`', 'moved only later, compared with `julianday()`',
      'never touches the person\'s own stop-all, `optional_off_at`', 'never stops event or account mail', 'no diagnostic code, no headers, no subject, no feedback report and no network address',
      'never an address, a topic\'s name or an account number', '`EmailValidationSuppressed`', 'a transient or an undetermined bounce', '`not-spam`, in any letter case',
      'an event of any account but the topic\'s own', '50 addresses at most',
      'the choice on record is older than the report', 'a choice whose time cannot be read counting as older',
      'never overridden by a report made before it, however late the report or a second copy of it comes', 'the report\'s own time, the time its mark is given',
      'a report with a `complaintSubType`, `OnAccountSuppressionList` or `OnTenantSuppressionList`', 'so the person reported nothing',
    ]) expect(stored, piece).toContain(piece)
  })

  it('says nothing a visitor or a member meets ships with every switch off, and what the merge of this step does', () => {
    const off = bullet(block, '- **What ships with every switch off.**')
    expect(off.startsWith('- **What ships with every switch off.** Nothing a visitor or a member meets.')).toBe(true)
    for (const piece of [
      'POST and OPTIONS `/api/mail/ses-events` answer 404 `{ error: \'Not found\' }` with no-store before the body is read', 'a well-signed bounce of the topic included',
      'before this step no handler served that address', 'No topic is bound anywhere', '`test/unit/ses-sender.test.ts` and `test/unit/mail-seam-bytes.test.ts` hold unchanged',
      'all 232 of `dist`', '`test/a11y/baseline.json` is unchanged', 'This step adds no migration', '`deploy-worker.yml`',
    ]) expect(off, piece).toContain(piece)
    expect(bullet(block, '- **Checkpoint M.**')).toContain('the switch-on change\'s alone, carrying `WORKERS_PLAN` `\'paid\'`, the path K is advised to take, and then the cutover change on top of it')
    expect(bullet(block, '- **Checkpoint M.**')).toContain('the switch-on change\'s run carries one run of `npm run test:a11y` beside its gate')
  })

  it('lists the pins it moved, each with its reason, and none on words a record wrote', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      'no pin on words a record wrote', '`test/unit/mail-one-seam.test.ts`', '`test/unit/mail-worker-closure.test.ts`', '`test/unit/routes.test.ts`', '97 to 98',
      '26 to 27 contracted and 136 to 137 methods', '`contracts[\'mail/ses-events\'].POST`', '`test/unit/browser-test-wiring.test.ts`', 'No closed record test changes',
    ]) expect(pins, piece).toContain(piece)
  })

  it('makes its judgement calls, at least fifteen, the checks moved before the fetch, the one sentence, the mark and the tag names among them', () => {
    const calls = bullet(block, '- **Judgement calls.**')
    expect(calls.split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(15)
    for (const piece of [
      'before the certificate is fetched', 'where a 413 would tell a prober', '`url.href` equal to the address as written', '256, 384 or 512 bytes',
      '`keptCertificates()`', '16,384 bytes', 'answers 500', 'a test message K publishes by hand changes nothing', '`publishedAt`', '`makeContact`',
      'fails no foreign key', 'where the entry wrote each address the bounce names', 'so no address outside the send is ever written', '`isSendableAddress`',
      'plain word of letters', 'in any letter case', 'OPTIONS answers 404', '`KIND_TAG` and `LIST_TAG`',
      'does not subscribe the site again by itself', '`ses-events.test.lca`', 'the one browser run being the gate\'s before the commit',
      'The three tests the switch-on turns red, beside `test/unit/features.test.ts`, are fixed in the switch-on change, inside its patch, and not in this step',
      'the case in `test/a11y/signed-in.spec.ts` through its helper, `test/a11y/signedIn.ts`',
      'Two of them are browser tests, which `npm run test:all` does not run',
      'any `complaintSubType` that is a word changes nothing', 'rather than the time it is written', 'so a later \'in\' by the person still wins',
      'now seeds that \'in\' an hour before the report', 'are made with redirect \'manual\'', 'a 302 to another host',
    ]) expect(calls, piece).toContain(piece)
  })

  it('gives the lint as unchanged, the build as the base\'s file for file, and each check once', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    expect(bullet(block, '- **Lint.**')).toContain('`d4818fd`')
    const build = bullet(block, '- **Build.**')
    for (const piece of [
      '`d4818fd`', 'a local production build', '`index-D0OkgN_2.js` at 553,776 bytes', '`index-C2evaz7M.css` at 130,610 bytes', '`features-DxqQlIon.js` at 698 bytes',
      '232 files of `dist`, 194 of them in `dist/assets`', 'so no file of the site changes', 'changes no file under `src/`', 'a local build\'s figures', 'Thursday, November 12, 2026',
    ]) expect(build, piece).toContain(piece)
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('the one browser run being the gate\'s before the commit')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`')
  })

  it('gives the worker\'s dry run on the base and after, measured on their day, the difference, the reason, and what is left under part one\'s ceiling of 96 KiB, gzip 28 KiB', () => {
    const worker = bullet(block, '- **Worker.**')
    for (const piece of [
      '`npx wrangler deploy --dry-run`', '`--config workers/daily-emails/wrangler.toml`', '`d4818fd`', 'Thursday, November 12, 2026', 'The bundle holds no package.',
      '96 KiB, gzip 28 KiB', 'no minify setting', '`KIND_TAG` and `LIST_TAG`', 'the one difference between the two bundles', '`test/unit/mail-worker-closure.test.ts`',
      'Every request it makes is byte for byte as before.',
    ]) expect(worker, piece).toContain(piece)
    const sizes = [...worker.matchAll(/([\d.]+) KiB, gzip ([\d.]+) KiB, on the (?:base|finished tree)/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(sizes).toHaveLength(2)
    const [base, after] = sizes
    expect(base).toEqual([75.81, 20.31])
    const growth = /: ([\d.]+) KiB more, gzip ([\d.]+) KiB, and /.exec(worker)
    expect(growth, 'the growth').not.toBeNull()
    expect(Number(growth![1])).toBeCloseTo(after[0] - base[0], 2)
    expect(Number(growth![2])).toBeCloseTo(after[1] - base[1], 2)
    const bytes = [...worker.matchAll(/`index\.js` ([\d,]+) bytes/g)].map((m) => num(m[1]))
    expect(bytes[0]).toBe(77630)
    expect(worker).toContain(`${(bytes[1] - bytes[0]).toLocaleString('en-US')} bytes`)
    const left = /leaves ([\d.]+) KiB, gzip ([\d.]+) KiB/.exec(worker)
    expect(left, 'what the ceiling leaves').not.toBeNull()
    expect(Number(left![1])).toBeCloseTo(96 - after[0], 2)
    expect(Number(left![2])).toBeCloseTo(28 - after[1], 2)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 8: the figures add up', () => {
  const files = bullet(block, '- **Files.**')
  const countOf = (name: string) => {
    const m = new RegExp(`\`${escape(name)}\` \\((\\d+)(?:, (\\d+) before|, as before)?[:)]`).exec(files)
    return m ? { now: Number(m[1]), before: Number(m[2] ?? m[1]) } : null
  }

  it('gives unit counts that add up: the base\'s, the new files\' tests and the changed files\' gains', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([8648, 332])
    const counts = [...NEW_UNIT, ...CHANGED_UNIT].map((name) => [name, countOf(name)] as const)
    for (const [name, count] of counts) expect(count, name).not.toBeNull()
    const gain = counts.reduce((sum, [name, count]) => sum + (NEW_UNIT.includes(name) ? count!.now : count!.now - count!.before), 0)
    expect(num(before) + gain).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s and the two new files\'', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1692, 101])
    for (const name of NEW_INTEGRATION) expect(countOf(name), name).not.toBeNull()
    expect(num(before) + NEW_INTEGRATION.reduce((sum, name) => sum + countOf(name)!.now, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the browser run as the base\'s, whose counts add up, and the lint figures as the base\'s with the new files added', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, the base's figures/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect([num(run![1]), num(run![2]), num(run![3])]).toEqual([995, 659, 336])
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![2])).toBe(938)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_LINTED.length)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 8: the map', () => {
  it('adds a sentence of what this step proves to the five items planned for it, once each, ahead of the planned step, and to no other item', () => {
    for (const [id, sentence] of PROVED) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.endsWith('Planned: WS16 step 8.'), id).toBe(true)
      expect(item.indexOf(sentence), id).toBeLessThan(item.indexOf('Planned: WS16 step 8.'))
    }
    expect(entries(map).filter((l) => l.includes('Proved in WS16 step 8 by')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(PROVED.map(([id]) => id))
  })

  it('adds a sentence that starts "Built in WS16 step 8" to the one item another step proves that it builds a part of, ahead of its planned step', () => {
    for (const [id, step] of BUILT) {
      const item = mapItem(id)
      expect(item.split('Built in WS16 step 8: '), id).toHaveLength(2)
      expect(item.endsWith(`Planned: WS16 step ${step}.`), id).toBe(true)
      expect(item.indexOf('Built in WS16 step 8: '), id).toBeLessThan(item.indexOf(`Planned: WS16 step ${step}.`))
    }
    expect(entries(map).filter((l) => l.includes('Built in WS16 step 8:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(['AC15'])
  })

  it('says in each sentence what the tests hold', () => {
    for (const piece of [
      'under version 1 or 2', 'from SNS\'s own host for `us-east-1`', 'whose event is of the topic\'s own account', 'every row of the four mail tables as it was',
      'for a permanent bounce the address the message was sent to, never one only the bounce names',
      'more than three hours old', '`EmailValidationSuppressed`', 'never stops one of LCA\'s main mailers but the list it was pressed on', 'answers 500, so SNS tries again',
    ]) expect(added('AC4', PROVED[0][1]), piece).toContain(piece)
    for (const piece of [
      '`test/unit/ses-sender.test.ts` and `test/integration/ses-path.test.ts` of WS16 step 7', '`test/unit/sns-signature.test.ts` and `test/integration/ses-events.test.ts` of this step',
      'the receiver answers 404 to everything without its topic', 'the topic\'s name empty', 'twelve zeros', 'no test reaches an outside service',
    ]) expect(added('AC13', PROVED[1][1]), piece).toContain(piece)
    for (const piece of [
      '`test/unit/admin-email-newsletter.test.tsx`', '`test/unit/email-choice-app-routes.test.tsx`', 'one run of `npm run test:a11y`', 'the ten new endpoint methods answer as they ship',
      'GET `/api/me/media-manager` false for everyone', 'the receiver 404 before it reads anything', '`test/a11y/baseline.json` is unchanged',
    ]) expect(added('AC14', PROVED[2][1]), piece).toContain(piece)
    for (const piece of ['the next newsletter leaves the person out', 'until the person\'s own newer \'in\' on it', 'no report sets the person\'s own stop-all']) {
      expect(added('D35', PROVED[3][1]), piece).toContain(piece)
    }
    expect(added('Q47', PROVED[4][1])).toContain('(b) stays K\'s to choose')
    expect(added('AC15', 'Built in WS16 step 8: ')).toContain('`mail_contacts.complained_at`')
  })

  it('keeps the earlier steps\' sentences on those items word for word, ahead of this step\'s', () => {
    for (const [id, sentence] of EARLIER) {
      const item = mapItem(id)
      expect(item.split(sentence), `${id}: ${sentence}`).toHaveLength(2)
      expect(item.indexOf(sentence), id).toBeLessThan(item.indexOf('Proved in WS16 step 8 by'))
    }
  })
})

describe('REDESIGN_STATUS.md, WS16 step 8: the lists', () => {
  it('records this step\'s entries in each list, in their order, each once and tagged', () => {
    expect(tagged(decisions).map(head)).toEqual(HEADS.decisions)
    expect(tagged(deviations).map(head)).toEqual(HEADS.deviations)
    expect(tagged(verify).map(head)).toEqual(HEADS.verify)
    expect(tagged(followUps).map(head)).toEqual(HEADS.followUps)
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of tagged(list)) expect(entry, head(entry)).toMatch(/^- \*\*[^*]+ \(WS16 step 8\)\.\*\* \S/)
    }
  })

  it('puts its entries after the earlier steps\' in each list', () => {
    const last = {
      decisions: 'Amazon\'s region is us-east-1, in one constant (WS16 step 7).',
      deviations: 'The member delete reads the newsletter whatever the switches say (WS16 step 7).',
      verify: 'The files read as the base has them (WS16 step 7).',
      followUps: 'The comment on the page\'s call for the newsletter\'s test (WS16 step 7).',
    }
    for (const [name, list] of [['decisions', decisions], ['deviations', deviations], ['verify', verify], ['followUps', followUps]] as const) {
      const heads = entries(list).map(head)
      expect(heads.indexOf(HEADS[name][0]), name).toBeGreaterThan(heads.indexOf(last[name]))
      expect(heads.indexOf(last[name]), name).toBeGreaterThan(-1)
    }
  })

  it('closes one earlier follow-up at its end, its earlier words as its step wrote them, and closes no other entry', () => {
    for (const [name, lastWords] of CLOSED) {
      const entry = followUp(name)
      expect(entry.split(CLOSE), name).toHaveLength(2)
      expect(entry.split(CLOSE)[0].endsWith(lastWords), name).toBe(true)
      expect(entry.endsWith('.'), name).toBe(true)
    }
    expect(entries(ws16).filter((l) => l.includes(' Done in WS16 step 8:')).map(head)).toEqual(CLOSED.map(([name]) => name))
    for (const piece of ['K\'s list on switch-on day', 'before the switch-on change', 'two-factor sign-in']) expect(closeOf(CLOSED[0][0]), piece).toContain(piece)
  })

  it('records D35 with K\'s date, the setting and Q47\'s two readings, and turns down a report as the stop-all', () => {
    const [d35, stored, topic] = tagged(decisions)
    for (const piece of [
      'D35, settled by K on Tuesday, November 10, 2026 (K\'s decisions 5 and 18)', '`mail_lists.main_mailer`', '`COMPLAINT_STOPS_OTHER_SENDERS`',
      'Q47\'s reading is built as it stands, (a)', 'stays K\'s to confirm', '(b), a report never stopping one of LCA\'s main mailers', 'Turned down:',
    ]) expect(d35, piece).toContain(piece)
    for (const piece of ['K\'s standing rule that only what is needed is collected', '`RECEIVER_LOG`', '`receivedLog`', 'Turned down:']) expect(stored, piece).toContain(piece)
    for (const piece of ['`SES_SNS_TOPIC_ARN`', 'the production environment of the Pages project alone', 'never on the Preview environment or the daily-emails worker', 'twelve zeros', 'Turned down:']) {
      expect(topic, piece).toContain(piece)
    }
  })

  it('records the three deviations, SNS with no shared secret, Amazon\'s list for bounces alone and brief 1.4\'s bounce', () => {
    const [sns, list, bounce] = tagged(deviations)
    for (const piece of ['Brief 1.4 sends through Resend', 'with no shared secret', 'EventBridge\'s API destination', 'Turned down:']) expect(sns, piece).toContain(piece)
    for (const piece of ['bounces only (section 5)', '`OnAccountSuppressionList`']) expect(list, piece).toContain(piece)
    for (const piece of ['line 1318', '`mail_do_not_send`']) expect(bounce, piece).toContain(piece)
  })

  it('resolves the verify items, each confirmed, not settled or not checked, with the day each page was read', () => {
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^(?:Confirmed\b|Not settled\b|Not checked\b)/)
    const byHead = (h: string) => tagged(verify).find((e) => head(e) === h) ?? ''
    expect(byHead(HEADS.verify[1])).toContain('`SHA1withRSA`')
    expect(byHead(HEADS.verify[2])).toContain('`Content-Type: text/plain; charset=UTF-8`')
    for (const piece of ['"If a DSN is available, this is the value of the `Final-Recipient` field from the DSN"', '`mail.destination` is "A list of email addresses that were recipients of the original mail"']) {
      expect(byHead(HEADS.verify[3]), piece).toContain(piece)
    }
    expect(byHead(HEADS.verify[5])).toContain('compatibility date 2024-08-01')
    expect(byHead(HEADS.verify[6])).toContain('"The default maximum message size is 262,144 bytes (256 KiB)"')
    expect(byHead(HEADS.verify[10])).toContain('`max(coalesce(complained_at, \'\'), datetime(?))`')
    expect(byHead(HEADS.verify[13])).toContain('27 of them contracted')
    expect(byHead(HEADS.verify[14])).toContain('`git diff --stat 16c188a d4818fd`')
    for (const index of [0, 1, 2, 3, 4, 6]) expect(byHead(HEADS.verify[index]), HEADS.verify[index]).toMatch(/\bread (?:again )?on Thursday, November 12, 2026\b/)
  })

  it('hands on the first confirmation, the topic\'s name, what Not delivered reads and a removed subscription', () => {
    const [first, topic, notDelivered, removed] = HEADS.followUps.map(followUp)
    for (const piece of ['"Pending confirmation"', 'the cutover waits for the subscription\'s Confirmed and the two simulator results', 'This closes when']) expect(first, piece).toContain(piece)
    for (const piece of ['`SES_SNS_TOPIC_ARN`', 'never on the Preview environment or the daily-emails worker', 'This closes when K has set it.']) expect(topic, piece).toContain(piece)
    for (const piece of ['WS16 step 9', '`OnAccountSuppressionList`', 'more than three hours old cannot put it back']) expect(notDelivered, piece).toContain(piece)
    for (const piece of ['one warning line', 'part E, step 20']) expect(removed, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 8: checkpoint M\'s section', () => {
  it('opens waiting for its merge, or once it has merged with the merge commit and its day, never calls the merge pending, and waits for K\'s word alone', () => {
    const waiting = /^\*\*Not merged yet: checkpoint M waits for its merge into `main`\*\* \((?:a draft pull request to be opened from this branch|draft pull request \d+)\)\. /.test(opening)
    const merged = /^\*\*Merged into `main` as `[0-9a-f]{7,40}` on (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]+ \d{1,2}, \d{4}/.test(opening)
    expect(waiting || merged, opening.slice(0, 120)).toBe(true)
    expect(checkpoint).not.toMatch(PENDING)
    expect(checkpoint).not.toContain('is pending')
    for (const piece of [
      'Checkpoint M is the first of WS16\'s three checkpoints', 'waits for `mailLists`, which stays off', 'waits for `MAIL_LISTS_ON`, which stays unset, or for `MAIL_SENDER`, which stays `\'resend\'`',
      'by two later changes of their own', 'The merge waits for K\'s word and for nothing else.',
    ]) expect(opening, piece).toContain(piece)
  })

  it('has a bullet for each of its eight steps and each part, once each and in order, leaving room for the line a later change writes', () => {
    for (const name of CHECKPOINT_BULLETS) expect(checkpoint.split('\n').filter((l) => l.startsWith(name)), name).toHaveLength(1)
    const at = CHECKPOINT_BULLETS.map((name) => checkpoint.indexOf(`\n${name}`))
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // The two lines a later change writes, each under its own head, pass the checks above as any further bullet does.
    const later = `${checkpoint}- **Switched on (WS16 step 8).** On a later day the switches were turned on together.\n`
    for (const name of CHECKPOINT_BULLETS) expect(later.split('\n').filter((l) => l.startsWith(name)), name).toHaveLength(1)
  })

  it('says what the merge does with every switch off: the migration, the worker, the ten methods, the pages and the way back', () => {
    const merge = bullet(checkpoint, '- **What the merge does with every switch off.**')
    for (const piece of [
      '`719abad`', 'pull request 125', '`migrate-db.yml` applies migration 0060', 'four tables', '`lca-newsletter` and `lca-tournaments`', 'four new columns, three of them empty',
      'No row of today\'s changes', '`deploy-worker.yml` redeploys the daily-emails worker', '31.99 KiB, gzip 9.17 KiB, on `719abad`', '75.86 KiB, gzip 20.33 KiB, on the finished tree',
      'Ten new methods, in seven new files', 'GET and POST `/api/admin/mail/newsletter`', 'POST `/api/admin/mail/newsletter/stop`', 'POST `/api/admin/mail/newsletter/test`',
      'GET and POST `/api/mail/unsubscribe/[token]`', 'GET and PATCH `/api/mail/preferences/[token]`', 'GET `/api/me/media-manager` answers false for everyone signed in',
      'POST `/api/mail/ses-events` answers 404', 'Every page is today\'s.', '550,347 bytes and at 553,776', '130,375 and at 130,610', '685 and at 698', '`test/a11y/baseline.json` is unchanged',
      'Rollback.', 'checkpoint M is not reverted after that',
    ]) expect(merge, piece).toContain(piece)
  })

  it('gathers what needs migration 0060 on production with the merge\'s deploy, and what a failed migration run means', () => {
    const needs = bullet(checkpoint, '- **What needs migration 0060 on production.**')
    for (const piece of [
      'Group email\'s send (WS16 step 4)', 'The worker\'s five-minute sweep', 'The newsletter\'s stop (WS16 step 4)', 'the member delete (WS16 step 7)',
      'the receiver answers 404 before it reads anything (WS16 step 8)', 'If the migration run fails, the merge is not finished until the run is made again and passes',
      'nothing is sent twice or lost', '`npm run db:migrate:preview`', 'ordering rule 2',
    ]) expect(needs, piece).toContain(piece)
  })

  it('gives K\'s list before the merge, on switch-on day and for the cutover, in the checklist\'s order, agreeing word for word with the follow-ups and the decision it repeats', () => {
    const before = bullet(checkpoint, '- **K\'s list before the merge.**')
    const on = bullet(checkpoint, '- **K\'s list on switch-on day.**')
    const cutover = bullet(checkpoint, '- **K\'s list for the cutover.**')
    const sections = ['(section 1)', '(sections 2 and 3)', '(section 4)', '(section 5)', '(section 6)', '(section 7)', '(section 8)', '(section 9)', '(section 10)', '(section 11)', '(section 12)']
    const at = sections.map((s) => before.indexOf(s))
    for (const [i, s] of sections.entries()) expect(at[i], s).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(before).toContain('by about Saturday, November 14, 2026')
    expect(before).toContain('the switch-on change\'s gate with `WORKERS_PLAN` `\'paid\'` and its one browser run, and the cutover change\'s on top of it')
    expect(on).toContain('the earliest about Wednesday, November 18, 2026')
    const repeated: ReadonlyArray<readonly [string, string, string]> = [
      ['Amazon SES\'s keys on both deployments before the cutover (WS16 step 7).', 'K sets `SES_ACCESS_KEY_ID`', 'no file of the repository holds a value for either.'],
      ['The worker\'s link key before the switch-on (WS16 step 4).', 'K sets them as secrets of the worker', 'with the value K gave the site'],
      ['The worker\'s link key before the switch-on (WS16 step 4).', 'Before the switch-on K also sees', 'on checkpoint M\'s merge or on a later push to `main`'],
      ['K\'s checks in the sandbox before the cutover (WS16 step 7).', 'Before the cutover\'s pull request, K sends', 'reaches the newsletter\'s list.'],
    ]
    for (const [name, from, to] of repeated) {
      const words = between(followUp(name), from, to) + to
      expect(words.length, name).toBeGreaterThan(to.length + 20)
      expect(`${before}\n${on}\n${cutover}`, name).toContain(words)
    }
    const decision = entries(decisions).find((l) => head(l) === 'The cutover is its own change, after Workers Paid (WS16 step 7).') ?? ''
    const words = between(decision, '`MAIL_SENDER` changes to `\'ses\'`', 'waits, untried, for Amazon SES.') + 'waits, untried, for Amazon SES.'
    expect(cutover).toContain(words)
    for (const piece of ['"Media manager"', '`media-manager`', '`Test ½ from LCA`', '`https://www.louisianachess.org/api/mail/ses-events`', 'both rows there meaning the receiver works', 'is compared with `TOO_MANY_OUTSIDE_CALLS`']) {
      expect(on, piece).toContain(piece)
    }
    for (const piece of ['reason Bounce', 'Workers Paid (section 10)', '`MAIL_SENDER` back to `\'resend\'` by a change of its own']) expect(cutover, piece).toContain(piece)
  })

  it('gives the two later changes with their exact files, the record\'s one line each with its own day, and the throwaway runs before the merge', () => {
    const on = bullet(checkpoint, '- **The switch-on change.**')
    const cut = bullet(checkpoint, '- **The cutover change.**')
    for (const piece of [
      '`functions/utils/mail/switches.ts`, `MAIL_LISTS_ON` true, and `WORKERS_PLAN` `\'paid\'`', '`src/lib/features.ts`, `mailLists` true', '`test/unit/features.test.ts`, `mailLists` taken out of its WS16 list',
      '`test/a11y/builds.spec.ts`, `mailLists` on in both browser builds', '`test/a11y/signedIn.ts` and `test/unit/signed-in-header.test.tsx`, the one call more today\'s header makes with the switch on',
      '`- **Switched on (WS16 step 8).**`', '`MAIL_SENDER` stays `\'resend\'` in it.', '`domain/mail/addresses.ts` is not among its files',
      'a search of `test/` for the four constants\' shipped values and the two switches\' names', 'a reading of the browser tests', 'which `npm run test:all` does not run',
      'The search finds three tests that read a switch\'s own value', 'The reading finds two browser tests, which the search cannot find, since neither names either switch',
      '`test/a11y/builds.spec.ts`, which holds every switch of each served build to that build\'s own list', 'it fails in both projects',
      'the case of a regional representative in `test/a11y/signed-in.spec.ts`, on the build that turns no switch on, `a11y-off`, which draws today\'s header',
      'today\'s header also asks GET `/api/me/media-manager`, once',
      'The run found the unit twin of that case, which does not name them either: the case of a regional representative in `test/unit/signed-in-header.test.tsx`',
      'So the change carries those three files too', 'With them, the run fails only the twelve cases below', 'Twelve cases that ask git what it ignores, or read the path of the package folder',
      'The two browser tests are held by the switch-on change\'s one browser run',
    ]) expect(on, piece).toContain(piece)
    for (const piece of [
      '`functions/utils/mail/switches.ts`, `MAIL_SENDER` `\'ses\'`', '`- **Amazon SES sends (WS16 step 8).**`', 'WS16 step 9\'s decision later dates in full',
      'The same search, the same reading and the same run', 'found no test the change turns red, beside the same twelve cases', 'reads the same entry through Amazon SES\'s catch point as through Resend\'s',
      'the switch-on change\'s alone, with one run of `npm run test:a11y` beside it, and then the cutover change on top of it, with none',
    ]) expect(cut, piece).toContain(piece)
    // The later gate's figures are written when it runs: no sentence stands for them now.
    for (const text of [on, cut]) expect(text).not.toMatch(/\b\d[\d,]*\s+(?:tests?|passed|files|cases)\b|\btests in \d|files in `dist/)
    expect(cut).toContain('`npm run lint`, `npm run build`, `npm run typecheck:functions`, `npm run check:bundle` and `npm run test:all`')
  })

  it('gives the pull request\'s text: plain, what the checkpoint is, what the merge does with every switch off, what K runs before the preview and what comes after, with no tool and no line on how it was written', () => {
    expect(pullRequest.length).toBeGreaterThanOrEqual(9)
    const text = pullRequest.join('\n')
    expect(pullRequest[0]).toBe('WS16 checkpoint M: the mail engine and the LCA newsletter list')
    for (const piece of [
      'This is checkpoint M of WS16', 'nothing a visitor or a member meets changes', 'migration 0060', 'ten endpoint methods', 'Every page is today\'s.',
      'K runs `npm run db:migrate:preview` from this branch', 'What comes after: the switch-on change', 'the cutover change', 'Checkpoints N and O follow',
    ]) expect(text, piece).toContain(piece)
    expect(text).not.toMatch(TOOLS)
    expect(text).not.toMatch(ASSISTANT)
    expect(text).not.toMatch(/^#/m)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 8: plain language', () => {
  /** Everything this step wrote in the section: its block, checkpoint M's section, its entries, its map sentences, its close and the Status line's tail. */
  const written = [
    block, checkpoint, ...[decisions, deviations, verify, followUps].flatMap(tagged), ...PROVED.map(([id, s]) => added(id, s)),
    ...BUILT.map(([id]) => added(id, 'Built in WS16 step 8: ')), ...CLOSED.map(([name]) => closeOf(name)), statusLine.slice(STATUS_PREFIX.length), date?.[0] ?? '',
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
      // The topic K made is named in words, and no account number is written outside code.
      expect(proseOf(text)).not.toMatch(/\b\d{12}\b/)
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

describe('REDESIGN_STATUS.md, WS16 step 8: the date and the new files', () => {
  it('dates the record on a real day, on or after Thursday, November 12, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-12').toBe(true)
  })

  it('lists as new only files that exist, the new code and tests free of a dash, a tool\'s name, the two letters on their own and the old initials, and the fixtures public material alone', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_LINTED) {
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
    for (const file of ['test/unit/fixtures/sns-test-cert.pem', 'test/unit/fixtures/sns-test-cert-pubkey.pem']) expect(read(file), file).not.toMatch(/PRIVATE/)
  })

  it('keeps the same out of the changed files that held none before, whole, and out of the parts this step wrote in the ones that did', () => {
    // Files that held a dash, a tool's name or the old initials before this step, read only in the parts it wrote.
    const older = ['test/integration/harness.ts', 'functions/types.ts', 'vitest.integration.config.ts']
    const [harness, types, config] = older.map(read)
    const texts: Array<readonly [string, string]> = [
      ...[...CHANGED.filter((f) => /\.tsx?$/.test(f)), ...CHANGED_UNIT].filter((f) => !older.includes(f)).map((file) => [file, read(file)] as const),
      ['harness.ts, the SNS behaviour', between(harness, ' * Amazon SNS in the site\'s region, as the receiver', 'export const stripeBehavior')],
      ['harness.ts, the SNS host', between(harness, '/** Amazon SNS\'s host in the same region', '/** What SES\'s v2 SendEmail carries')],
      ['harness.ts, the SNS catch point', between(harness, '    // Amazon SNS, in the site\'s region: the certificate', `    // ${'Anthr' + 'opic'}: the scanner`)],
      ['types.ts, the topic on Env', between(types, '   * The name of the Amazon SNS topic K made', 'export interface MemberRow')],
      ['the integration config, the made-up topic', between(config, '// A made-up topic for the receiver', '\n        },')],
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
