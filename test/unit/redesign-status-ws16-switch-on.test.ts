// test/unit/redesign-status-ws16-switch-on.test.ts
//
// REDESIGN_STATUS.md, the switch-on change of WS16: what it wrote in the
// WS16 section, read from the record alone. It reads only the WS16 section,
// and in it only this change's block, "The switch-on: the newsletter list
// turned on", the one line the change writes in checkpoint M's section, and
// the section's Status and PR lines; no count from the code. Pinned here:
// the block's heading and its place after the block before the switch-on,
// its bullets in their order and the key words of each, the eight files the
// change carries and what it does not carry, the two lines of the clubs
// work's tests with their reasons, the three merges with their commits and
// days, K's word and its day, MAIL_SENDER staying 'resend', the files with
// each test file's count beside it and the sums against the Checks line, the
// Checks line's form, and the pull request's text with its short headings;
// the one line, the Status line's tail and the PR line's words for the
// switch-on change; and the plain-language rules on all of it. It holds the
// block's figures by their form and their sums, not by a figure a later
// change moves, and it does not hold the block to be the section's last.
// Its banned patterns are built from split strings, so this file holds none
// of them, and it is plain ASCII.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The half sign, written by code so that this file stays plain ASCII. */
const HALF = String.fromCharCode(0xbd)
/** The working words a record does not use, in the plural as well, and the words that name a person's role in the work. */
const BANNED = new RegExp(
  `\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow', 'revi' + 'ewer', 'tes' + 'ter'].join('|')})s?\\b|${'the ' + 'lead'}`,
  'i',
)
/** The tools a record must not mention, split up so that this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** A session's link or its id. */
const SESSION = new RegExp(`${'sess' + 'ion_'}[0-9A-Za-z]{6,}|${'/co' + 'de/'}`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}|${'to be ' + 'measured'}|${'X' + 'XX'}|${'@' + '@'}`)
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i
/** An assistant named in a pull request's text, or a line about how it was written. */
const ASSISTANT = new RegExp(`\\b(?:${'assis' + 'tant'}|${'gener' + 'ated'}|${'wri' + 'tten by'})\\b`, 'i')
/** The merge-pending phrase. */
const PENDING = new RegExp(`is ${'pen' + 'ding'}`)

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
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

const HEADING = '## WS16: Mail (the mail engine, lists and the LCA newsletter)'
const ws16 = between(status, `\n${HEADING}\n`, '\n## Phase 0:')
const sectionLines = ws16.split('\n')
const BLOCK_HEADING = '### The switch-on: the newsletter list turned on'
const BEFORE_HEADING = "### Before the switch-on: the newsletter tab's last rough spots"
const CHECKPOINT = '### Checkpoint M: WS16 steps 1 to 8'
const FOLLOW_UPS = '### WS16 follow-ups'
/** This block, from its heading to the next heading of the section or the section's end, so a later block is never read as its own. */
const block = (() => {
  const at = ws16.indexOf(`\n${BLOCK_HEADING}\n`)
  if (at < 0) return ''
  const rest = ws16.slice(at + 1)
  const next = rest.indexOf('\n### ', BLOCK_HEADING.length)
  return next < 0 ? rest : rest.slice(0, next + 1)
})()
const opening = block.split('\n')[2] ?? ''
const checkpoint = between(ws16, `\n${CHECKPOINT}\n`, '\n### ').slice(1)
const LINE_HEAD = '- **Switched on (WS16 step 8).**'
const line = checkpoint.split('\n').find((l) => l.startsWith(LINE_HEAD)) ?? ''
const prLine = sectionLines.find((l) => l.startsWith('**PR:**')) ?? ''
const statusLine = sectionLines.find((l) => l.startsWith('**Status:**')) ?? ''
const STATUS_PREFIX =
  '**Status:** in progress: part one, the mail engine and the first LCA newsletter, twelve steps in three checkpoints (checkpoint M for steps 1 to 8, checkpoint N for steps 9 to 11, checkpoint O for step 12); '

const BULLETS = [
  '- **What it carries.**', '- **What the merge does to production.**', '- **What it meets from the clubs work.**', "- **K's part.**", '- **Rollback.**',
  '- **Files.**', '- **Pins moved.**', '- **Build.**', '- **Worker.**', '- **Lint.**', "- **The pull request's text.**", '- Checks:',
]
const [CARRIES, PRODUCTION, CLUBS, K_PART, ROLLBACK, FILES, PINS, BUILD, WORKER, LINT, PR_TEXT] = BULLETS.slice(0, 11).map((name) => bullet(block, name))
const PULL_REQUEST = PR_TEXT.split('\n').filter((l) => l.startsWith('  >')).map((l) => l.replace(/^ {2}> ?/, ''))
const CHECKS = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
/** A sub-bullet of a bullet, one line of its own, by the words it starts with. */
const sub = (text: string, start: string) => text.split('\n').find((l) => l.startsWith(`  - ${start}`)) ?? ''

/** The six files of checkpoint M's list, then the two lines beyond it. */
const SIX = [
  'functions/utils/mail/switches.ts', 'src/lib/features.ts', 'test/unit/features.test.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts',
  'test/unit/signed-in-header.test.tsx',
]
const TWO = ['test/unit/auth-first-draw-guard.test.tsx', 'test/integration/club-check-emails.test.ts']
/** The record tests whose pins this change moves. */
const MOVED = [
  'test/unit/redesign-status-ws16-step8.test.ts', 'test/unit/redesign-status-ws16-before-switch-on.test.ts', 'test/unit/redesign-status-ws16-step1.test.ts',
  'test/unit/redesign-status-ws16-checkpoint-m.test.ts', 'test/unit/redesign-status-news-fields.test.ts',
]
const NEW_TEST = 'test/unit/redesign-status-ws16-switch-on.test.ts'
/** The unit test files the Files bullet gives a count of cases, whose sum the Checks line's unit figures must hold. */
const UNIT_TESTS = [...[...SIX, ...TWO].filter((f) => /^test\/unit\/.*\.test\.tsx?$/.test(f)), ...MOVED, NEW_TEST]
/** The people and the parts of the site the merge reaches, each a sub-bullet of its own, in this order. */
const KINDS = [
  'A visitor who is not signed in.', 'An LCA admin and the president, in Group email', 'The holder of the Media manager seat', 'A member.',
  "A signed-in person's header.", 'Every send from the merge on.', 'The daily-emails worker, from its next run.', 'The newsletter itself.',
  "Amazon's reports.", 'The link key.',
]
const kind = (name: string) => sub(PRODUCTION, name)

describe('REDESIGN_STATUS.md, the switch-on: where the block stands and what it opens with', () => {
  it('sits after the block before the switch-on, once, its heading word for word, its bullets in order, each once, and its Checks line last', () => {
    expect(ws16.split(`\n${BLOCK_HEADING}\n`)).toHaveLength(2)
    const at = [FOLLOW_UPS, BEFORE_HEADING, BLOCK_HEADING].map((h) => ws16.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // Nothing stands between the block before the switch-on and this one.
    expect(ws16.slice(at[1], at[2]).split('\n').filter((l) => l.startsWith('### '))).toEqual([BEFORE_HEADING])
    expect(block.split('\n').filter((l) => l.startsWith('### '))).toEqual([BLOCK_HEADING])
    const places = BULLETS.map((name) => block.indexOf(`\n${name}`))
    for (const [i, name] of BULLETS.entries()) {
      expect(places[i], name).toBeGreaterThan(-1)
      expect(block.split('\n').filter((l) => l.startsWith(name)), name).toHaveLength(1)
    }
    expect([...places].sort((a, b) => a - b)).toEqual(places)
    expect(block.trimEnd().split('\n').at(-1)!.startsWith('- Checks:')).toBe(true)
  })

  it('opens with what the change is: checkpoint M\'s switch-on change, both switches on together, Workers Paid, K\'s word and its day, the base, and the merge K\'s', () => {
    for (const piece of [
      'the switch-on change that checkpoint M\'s section sets out', '"K\'s list on switch-on day"', '"The switch-on change"', '`mailLists` in `src/lib/features.ts`',
      '`MAIL_LISTS_ON` in `functions/utils/mail/switches.ts`, on together', 'sets `WORKERS_PLAN` to `\'paid\'`', '`- **Switched on (WS16 step 8).**`, and its day',
      '`MAIL_SENDER` stays `\'resend\'`', 'decision 66 of `docs/redesign/ws16-k-decisions.md`', 'on Monday, November 16, 2026 at about 5:50 AM UTC, Sunday night in Louisiana',
      '"we can test switch on tomorrow if you are ready"', 'K\'s tomorrow being Monday, November 16, 2026', 'decision 63, that the account is on Workers Paid',
      'made on Monday, November 16, 2026 from `ccf65c3`', 'checkpoint U (pull request 132)', 'made ready as a draft pull request',
    ]) expect(opening, piece).toContain(piece)
    // The merge is K's: the block speaks of it as waiting for K's word, or, once a later change records it, as having waited.
    expect(/the merge is K's, and (?:waits|waited) for K's word/.test(opening)).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, the switch-on: what it carries and what the merge does', () => {
  it('carries checkpoint M\'s six files, then the two lines of the clubs work\'s tests with their reasons, and names what it does not carry', () => {
    const first = CARRIES.split('\n')[0]
    for (const file of SIX) expect(first, file).toContain(`\`${file}\``)
    expect(first).toContain('Checkpoint M\'s six files, as its section lists them')
    expect(first).toContain('GET `/api/me/media-manager`, answered as the server answers anyone who does not hold the Media manager seat')
    const two = sub(CARRIES, 'Two lines in tests of the clubs work\'s checkpoint U (pull request 132)')
    for (const file of TWO) expect(two, file).toContain(`\`${file}\``)
    for (const piece of [
      'after checkpoint M\'s section listed the change\'s files', '"reads mailLists as it ships, and clubKeepers on in this file alone"',
      '`expect(FEATURES.mailLists).toBe(false)` is now `toBe(true)`', '"a send worth another try gives the mark back and the next call sends"',
      '`emailBehavior.status = 500` is now `503`', 'reads the mail switches as they ship', '`engineRulesOn` in `functions/utils/mail/rules.ts`',
      '`classifyOnce` in `functions/utils/mail/outcome.ts`', 'a 500 is never tried again and a 503 is', 'worth another try under both rules',
      'in its checkpoint V', 'the stopgap until then, agreed with that stream on Monday, November 16, 2026',
    ]) expect(two, piece).toContain(piece)
    const not = sub(CARRIES, 'Not carried:')
    for (const piece of ['`MAIL_SENDER`, which stays `\'resend\'` until the cutover', '`domain/mail/addresses.ts`, unchanged', 'a migration', 'any file under `workers/`', 'the newsletter\'s own page']) {
      expect(not, piece).toContain(piece)
    }
    const own = sub(CARRIES, 'The record\'s own lines:')
    for (const piece of ['the one line at the end of checkpoint M\'s section', 'this section\'s Status line', 'its PR line', 'this block']) expect(own, piece).toContain(piece)
  })

  it('records the three merges, each with its commit and its day, and what the record changes for each', () => {
    const merges = sub(CARRIES, 'The merges, each checked with `git log` on `main`:')
    for (const [number, commit, day] of [
      ['127', 'af4a21c', 'Thursday, November 12, 2026'], ['128', '13a2c36', 'Friday, November 13, 2026'], ['129', 'f914d8f', 'Friday, November 13, 2026'],
    ]) expect(merges, number).toMatch(new RegExp(`pull request ${number}, [^;]*?merged into \`main\` as \`${commit}\` on ${day}`))
    for (const piece of [
      'so no line changes for it', '`13a2c36` on Friday, November 13, 2026 at 4:56 AM UTC', 'so none changes', 'which ended "not merged yet."', 'now end "merged into `main` as `f914d8f` on Friday, November 13, 2026."',
      'the clubs work\'s section among them, is as it was',
    ]) {
      expect(merges, piece).toContain(piece)
    }
  })

  it('says what the merge does to production for each kind of person, in order, the visitor who is not signed in first', () => {
    expect(PRODUCTION.split('\n')[0]).toContain('the first merge of WS16 that changes what people meet')
    const places = KINDS.map((name) => PRODUCTION.indexOf(`\n  - ${name}`))
    for (const [i, name] of KINDS.entries()) expect(places[i], name).toBeGreaterThan(-1)
    expect([...places].sort((a, b) => a - b)).toEqual(places)
    const pieces: ReadonlyArray<readonly [string, string[]]> = [
      [KINDS[0], ['Every page a visitor meets is as before', 'asks nothing more of anyone signed out', '`/email/unsubscribe/:token`', '`/email/preferences/:token`', '"This link isn\'t working.', '`listLinksLive`']],
      [KINDS[1], [
        '"The LCA newsletter list"', 'draws Groups of members nowhere', '"Review recipients"', '(WS16 step 11)', 'The hiding is the page\'s alone', 'POST `/api/admin/campaigns` still takes a role, club or status filter',
        'until it is reloaded', 'drawn off while Resend sends', 'For an LCA admin alone a box sends the test through Amazon SES', 'Specific people stays, as account mail',
      ]],
      [KINDS[2], ['an LCA officer who holds it among them', 'K\'s to add and assign', '"Group email"', 'no Specific people, no Send history column', '"View only, except the newsletter"', 'their own account\'s address', '"Set up two-factor sign-in to send group email."', '`requireListMailer`', 'today\'s five campaign methods still refuse them']],
      [KINDS[3], ['Nothing reaches a member\'s inbox that did not before', 'the footer of optional email', 'is carried only by the newsletter\'s test', 'Event and account mail carries no footer']],
      [KINDS[4], [
        'GET `/api/me/media-manager` once a session', 'a board seat holder whose role Admin does not let in', 'an LCA officer who holds a seat', 'it asks nothing for anyone else',
        'The routes `/admin` and `/admin/:section` ask the same question once a session', '"Loading..."', 'a slow or failed answer never holds the header',
      ]],
    ]
    for (const [name, words] of pieces) for (const piece of words) expect(kind(name), `${name} ${piece}`).toContain(piece)
  })

  it('says what every send, the daily-emails worker and the newsletter meet from the merge on, Amazon\'s reports and the link key in either place', () => {
    const pieces: ReadonlyArray<readonly [string, string[]]> = [
      [KINDS[5], [
        '`engineRulesOn`', 'The do-not-send gate is read before any service', 'event mail included', 'a walk-in placeholder among them', 'lets event mail through and holds list mail back', 'a 429 or a 503',
        'or a refusal of the key, a 401 or a 403', 'until the key works', 'where today a 401 or a 403 fails each row in Resend\'s own words', 'is never sent a second time (`classifyOnce`)',
        'So some mail that goes today may not go after the merge', 'where today the row is tried up to three times and the notice or reminder is sent by the next morning\'s run', 'ends its phase for that day',
        'where today each row is tried in turn', 'With `WORKERS_PLAN` `\'paid\'` the sizes are Workers Paid\'s', 'no cap on its reminders, and its rating lookups keep today\'s 500 a run',
      ]],
      [KINDS[6], [
        '`deploy-worker.yml` redeploys `lca-daily-emails` on the merge', '`migrate-db.yml` does not run', 'each claims a row before its send and never takes one the other holds', 'From its next run',
        '12:00 PM UTC, which is 6:00 AM Central', 'the attendee reminders, 1 then 2, first, then the week-before reminders, then the registration-open reminders', 'three sends at most', 'with no cap',
        'the member\'s dashboard shows as "Updated"', 'though the rating was not refreshed',
      ]],
      [KINDS[7], ['It cannot go out yet', 'list mail goes out through Amazon SES alone', 'answers 409', 'writes nothing', 'Only a test goes: through Resend from noreply@louisianachess.org', 'the two one-click headers', 'part B of K\'s checklist']],
      [KINDS[8], ['POST `/api/mail/ses-events`', '`SES_SNS_TOPIC_ARN`', 'on the production Pages project']],
      [KINDS[9], [
        'Without `MAIL_LINK_SECRET` on the production Pages project', '"Not sent: the mail link key is missing on this deployment."', 'The worker\'s copy matters once a newsletter is sending, after the cutover',
        'and its next row reads "Not sent yet: the mail key is missing on this deployment."', 'typed differently from the site\'s',
        'its next row reading "Not sent yet: the link key on this deployment is not the one this email was made with."',
      ]],
    ]
    for (const [name, words] of pieces) for (const piece of words) expect(kind(name), `${name} ${piece}`).toContain(piece)
  })

  it('says what it meets from the clubs work: nothing of it that runs today reads the switches, and the one rule its switches meet', () => {
    for (const piece of [
      'checkpoints S, T and U (pull requests 130, 131 and 132), every clubs switch off', 'No clubs code that runs on production today reads `mailLists`, `MAIL_LISTS_ON` or the engine\'s rules',
      '`sendClubSaveNotice` in `functions/utils/clubs/emails.ts`', '`runMonthlyCheck` in `functions/utils/clubs/monthlyCheck.ts`', '`CLUB_KEEPERS_ON`, which is unset',
      'answers 403 while it is unset', 'not in the daily-emails worker until WS09 step 15', '`functions/utils/mail/outcome.ts`',
      'a monthly-check email that meets a 500 keeps its mark and is not tried again by the timed run that month', 'a 429, a 503, a 401 or a 403 gives the mark back',
      'an LCA admin\'s press, which reads and writes no mark, still sends', 'No case holds the 500 for the monthly check itself under the engine\'s rules', 'the 422 case of `test/integration/club-check-emails.test.ts`',
    ]) expect(CLUBS, piece).toContain(piece)
  })

  it('gives K\'s part by checkpoint M\'s list, before and after the merge, and the rollback by the change\'s own revert, with what stays working', () => {
    for (const piece of [
      'Checkpoint M\'s section gives it whole, under "K\'s list on switch-on day"', 'before the merge', '`MAIL_LINK_SECRET`', 'typed the same way in both',
      'checkpoint M\'s code or later', '"Deploy scheduled-jobs worker"', 'Bot Fight Mode checked', '"Media manager"', '`media-manager`', 'Then K\'s word on this pull request.',
      'After the merge', 'run again from the Actions tab before anyone sends a Group email', `\`Test ${HALF} from LCA\``, 'the unsubscribe page',
      'outside louisianachess.org and outside example.com, example.net and example.org', '"Not sent: not a real address."', 'on an account with an active membership',
      '"The LCA newsletter goes to current members."',
    ]) expect(K_PART, piece).toContain(piece)
    for (const piece of [
      'undone by its own revert', '`git revert -m 1` with its merge commit', 'with `mailLists` off', '`MAIL_LISTS_ON` unset and `WORKERS_PLAN` `\'free\'`', 'no migration to undo',
      'What stays working:', 'every event and account email', 'the links of any list email on record', '`listLinksLive`', 'The links of a test email stop opening', 'then stays "sending" for good',
    ]) expect(ROLLBACK, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, the switch-on: files, pins, build, worker, lint and checks', () => {
  it('names every file it changes and adds, each test file with its count, and the counts add up to the Checks line', () => {
    for (const file of [...SIX, ...TWO, ...MOVED, NEW_TEST, 'REDESIGN_STATUS.md']) expect(FILES.split(`\`${file}\``), file).toHaveLength(2)
    let delta = 0
    for (const file of UNIT_TESTS) {
      const m = new RegExp(`\`${escaped(file)}\` \\((\\d+), (?:(\\d+) before|(as before)|(new))[:)]`).exec(FILES)
      expect(m, file).not.toBeNull()
      expect(Boolean(m![4]), `${file} is new`).toBe(file === NEW_TEST)
      const now = Number(m![1])
      delta += m![4] ? now : m![2] ? now - Number(m![2]) : 0
    }
    expect(FILES).toMatch(/`test\/integration\/club-check-emails\.test\.ts` \(\d+, as before[:)]/)
    expect(FILES).toMatch(/`test\/a11y\/builds\.spec\.ts` \(\d+ tests on both builds, as before[:)]/)
    const unit = /unit ([\d,]+) tests in ([\d,]+) files \(([\d,]+) in ([\d,]+) on the base\), every one passing/.exec(CHECKS)
    const integration = /integration ([\d,]+) in ([\d,]+) files \(([\d,]+) in ([\d,]+) on the base\), every one passing/.exec(CHECKS)
    expect(unit, 'the unit figures').not.toBeNull()
    expect(integration, 'the integration figures').not.toBeNull()
    expect(num(unit![1]) - num(unit![3])).toBe(delta)
    expect(num(unit![2]) - num(unit![4])).toBe(1)
    // No integration file is added, and the one that changes keeps its count.
    expect([num(integration![1]), num(integration![2])]).toEqual([num(integration![3]), num(integration![4])])
  })

  it('lists each pin moved under its file, once, with its old words and its new', () => {
    for (const file of MOVED) expect(PINS.split('\n').filter((l) => l.startsWith(`  - \`${file}\`:`)), file).toHaveLength(1)
    for (const words of [
      '"steps 1 to 8 are built and merged, switched off."', '"steps 1 to 8 are built and merged, switched on by the switch-on change."', 'is now read to the next heading of the section',
      'the switch-on change, a pull request of its own, turns the newsletter list on', BLOCK_HEADING, '"- Checks at the end of the checkpoint:"', `"${LINE_HEAD}"`,
      'not merged yet."', 'merged into `main` as `f914d8f` on Friday, November 13, 2026."', 'No pin of the record tests of WS16 steps 2 to 7 moves',
    ]) expect(PINS, words).toContain(words)
  })

  it('gives the build, the worker and the lint against the base `ccf65c3`, each in the form of the block before', () => {
    expect(BUILD).toContain('compared with one of the base `ccf65c3`')
    const assets = /`dist\/assets` holds ([\d,]+) files, as on the base/.exec(BUILD)
    expect(assets, 'the files of dist/assets').not.toBeNull()
    const main = /the main script `index-[\w-]+\.js` at ([\d,]+) bytes, the size of the base's `index-[\w-]+\.js`/.exec(BUILD)
    expect(main, 'the main script').not.toBeNull()
    expect(BUILD).toMatch(/the stylesheet `index-[\w-]+\.css` at [\d,]+ bytes, the base's name and size/)
    expect(BUILD).toMatch(/the switches chunk `features-[\w-]+\.js` at [\d,]+ bytes, the size of the base's `features-[\w-]+\.js`, its name new since it holds `mailLists` on/)
    expect(BUILD).toContain('These are a local build\'s figures, measured on Monday, November 16, 2026.')
    const sizes = /prints ([\d.]+) KiB, gzip ([\d.]+) KiB, on the finished tree, its `index\.js` ([\d,]+) bytes/.exec(WORKER)
    expect(sizes, 'the worker on the finished tree').not.toBeNull()
    const left = /that leaves ([\d.]+) KiB, gzip ([\d.]+) KiB/.exec(WORKER)
    expect(left, 'what the ceiling leaves').not.toBeNull()
    expect(Number(left![1])).toBeCloseTo(96 - Number(sizes![1]), 2)
    expect(Number(left![2])).toBeCloseTo(28 - Number(sizes![2]), 2)
    for (const piece of ['`npx wrangler deploy --dry-run`', '`--config workers/daily-emails/wrangler.toml`', 'the base\'s upload is 76.61 KiB, gzip 20.53 KiB', '96 KiB, gzip 28 KiB', 'The bundle holds no package.', '`deploy-worker.yml` runs on the merge']) {
      expect(WORKER, piece).toContain(piece)
    }
    const lint = /^- \*\*Lint\.\*\* `npm run lint` on the base `ccf65c3`: (\d+) errors and (\d+) warnings over ([\d,]+) files[^]*the same \1 errors and \2 warnings, over ([\d,]+) files with the new record test, none in a file this change touches/.exec(LINT)
    expect(lint, 'the lint against the base').not.toBeNull()
    expect(num(lint![4]) - num(lint![3])).toBe(1)
    const checked = /`npm run lint` (\d+) errors and (\d+) warnings over ([\d,]+) files \(([\d,]+) on the base\)/.exec(CHECKS)
    expect(checked, 'the lint in the Checks line').not.toBeNull()
    expect([checked![1], checked![2], num(checked![3]), num(checked![4])]).toEqual([lint![1], lint![2], num(lint![4]), num(lint![3])])
    expect(CHECKS).toContain(`\`npm run build\` (${assets![1]} files in \`dist/assets\``)
  })

  it('gives the Checks line in the form of a step\'s, each check once, the browser run the gate\'s, the baseline, and the days of the two sets of figures', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(CHECKS.split(piece), piece).toHaveLength(2)
    }
    for (const piece of [
      'the base\'s findings, none in a file this change touches', '`npm run test:a11y` 995 tests, 659 that run and 336 that skip, every one passing', 'the one browser run being the gate\'s before the commit',
      '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`', 'and this change\'s from Monday, November 16, 2026.',
    ]) expect(CHECKS, piece).toContain(piece)
  })

  it('gives the pull request\'s text: its title, its five short headings in order, each a line of its own, the words K needs, and no heading mark', () => {
    expect(PULL_REQUEST[0]).toBe('WS16: the switch-on, the newsletter list turned on')
    const headings = ['**What this is**', '**What the merge does to production**', '**What K does before and after**', '**Checks**', '**What comes after**']
    const at = headings.map((h) => PULL_REQUEST.indexOf(h))
    for (const [i, h] of headings.entries()) expect(at[i], h).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const text = PULL_REQUEST.join('\n')
    expect(text).not.toMatch(/^#/m)
    for (const piece of [
      'the switch-on change that checkpoint M\'s record sets out', '`MAIL_SENDER` stays `\'resend\'`', 'late on Sunday, November 15, 2026, Louisiana time, for Monday, November 16, 2026',
      '"we can test switch on tomorrow if you are ready"', 'no longer find Groups of members', 'The newsletter itself cannot go out yet', 'only a test can be sent, through Resend unless an LCA admin asks for Amazon SES',
      'is not tried again, where today it is', 'stops that day\'s sending of those reminders', 'There is no migration.', '`MAIL_LINK_SECRET`, on the production Pages project and on the daily-emails worker',
      'Bot Fight Mode checked', 'or run again from the Actions tab', `\`Test ${HALF} from LCA\``, '"Not sent: not a real address."', 'on an account with an active membership', 'revert this change\'s merge commit',
      'Amazon SES\'s checks in the sandbox', 'then the cutover to Amazon SES, on its own day', 'then the first newsletter',
    ]) expect(text, piece).toContain(piece)
    expect(text).not.toMatch(TOOLS)
    expect(text).not.toMatch(ASSISTANT)
  })
})

describe('REDESIGN_STATUS.md, the switch-on: the one line, the Status line and the PR line', () => {
  it('writes the one line at the end of checkpoint M\'s section, after its Checks line, with the day, both switches on together and MAIL_SENDER still resend', () => {
    expect(checkpoint.split('\n').filter((l) => l.startsWith(LINE_HEAD))).toHaveLength(1)
    const lines = checkpoint.trimEnd().split('\n')
    const checksAt = lines.findIndex((l) => l.startsWith('- Checks at the end of the checkpoint:'))
    const lineAt = lines.findIndex((l) => l.startsWith(LINE_HEAD))
    expect(checksAt).toBeGreaterThan(-1)
    expect(lineAt).toBeGreaterThan(checksAt)
    for (const piece of [
      'On Monday, November 16, 2026, `mailLists` and `MAIL_LISTS_ON` were turned on together', 'in the switch-on change, a pull request of its own', '`WORKERS_PLAN` `\'paid\'`',
      '`MAIL_SENDER` still `\'resend\'`', '"The switch-on: the newsletter list turned on"', 'whose merge is K\'s',
    ]) expect(line, piece).toContain(piece)
  })

  it('gives the Status line, after its fixed prefix, a tail that keeps built and merged and says the switch-on change switches them on', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    for (const word of [/\bbuilt\b/, /\bmerged\b/, /\bswitched on by the switch-on change\b/]) expect(tail).toMatch(word)
    expect(tail).not.toContain('switched off')
    expect(tail.endsWith('.')).toBe(true)
  })

  it('names the switch-on change in the PR line, a pull request of its own or by its number, after checkpoint M\'s merge', () => {
    expect(prLine.startsWith('**PR:** checkpoint M (steps 1 to 8) was draft pull request 126, merged into `main` as `d2c5ec0` on Thursday, November 12, 2026; ')).toBe(true)
    expect(prLine).toMatch(/; the switch-on change, (?:a pull request of its own|pull request \d+), turns the newsletter list on; /)
    expect(prLine.indexOf('the switch-on change')).toBeLessThan(prLine.indexOf('checkpoint N (steps 9 to 11)'))
  })
})

describe('REDESIGN_STATUS.md, the switch-on: plain language', () => {
  const written = [block, line, statusLine, prLine]

  it('keeps the dashes, the working words, any tool\'s name, a session\'s link, the old initials, unfilled marks, the merge-pending phrase and a he out of what it wrote', () => {
    for (const text of written) {
      expect(text.length).toBeGreaterThan(20)
      for (const rule of [DASHES, BANNED, TOOLS, BARE, SESSION, OLD_INITIALS, UNFILLED, PENDING]) expect(text).not.toMatch(rule)
      expect(proseOf(text)).not.toMatch(HE)
      expect(text).not.toMatch(/\.github\//)
      // A step is named as "WS16 step N", never with the bare form WS01's record tests look for.
      expect(text).not.toMatch(/\(step \d+[;),]/)
    }
    // No table in what this change wrote; the section's other parts are their own tests'.
    expect(written.flatMap((t) => t.split('\n')).filter((l) => l.startsWith('|'))).toEqual([])
  })

  it('gives every date the weekday it falls on and every time the twelve-hour clock', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    for (const raw of written) {
      // Each text is there to read, so an empty block cannot pass for one with no date.
      expect(raw.length).toBeGreaterThan(20)
      const text = proseOf(raw)
      for (const found of text.matchAll(new RegExp(`\\b(?:${MONTHS.join('|')}) \\d{1,2}\\b`, 'g'))) {
        expect(text.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
      }
      for (const [whole, weekday, month, day, year] of text.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${MONTHS.join('|')}) (\\d{1,2}), (\\d{4})`, 'g'))) {
        expect(WEEKDAYS[new Date(Date.UTC(Number(year), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
      }
      for (const time of text.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    }
  })
})
