// test/unit/redesign-status-ws16-step2.test.ts
//
// REDESIGN_STATUS.md records WS16 step 2: migration 0060 and the do-not-send
// gate. Like the record test of WS16 step 1, this file reads only the WS16
// section, from its heading to the Phase 0 heading, and the date at the
// start of the date line, never every table row or heading of the file,
// and it reads no count or figure from the code. The one file it reads
// beside the record is migrations/0060_mail_lists.sql, whose statements it
// holds against what the block says of them. Pinned here: the Status line's
// tail while this step is the latest; the block's place and its parts in
// order, its files with their counts, which must add up, and its figures;
// the sentences this step added to four map items and the close it added to
// one follow-up of WS16 step 1; this step's entries in the four lists, each
// with its tag; the plain-language rules over everything this step wrote;
// and the date. The new files are read only to find them and to hold them
// to the plain-language rules.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { splitSql } from '../shared/splitSql'

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
  `${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}`,
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
const TAG = '(WS16 step 2).'
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
const STEP_ONE = '### WS16 step 1: the record, the switches and one seam'
const STEP = '### WS16 step 2: migration 0060 and the do-not-send gate'
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
const TAIL = 'steps 1 and 2 are built.'

/** The sentences this step adds to the map, each with its item, before the item's planned step. */
const PROVED: ReadonlyArray<readonly [string, string]> = [
  ['AC5', 'Proved in WS16 step 2 by `test/integration/mail-gate.test.ts`, `test/unit/mail-address.test.ts` and `test/unit/mail-rules-outcome.test.ts`: '],
]
const BUILT: ReadonlyArray<readonly [string, number]> = [['AC6', 3], ['AC10', 4], ['AC12', 4]]

/** The files this step adds. */
const NEW_FILES = [
  'migrations/0060_mail_lists.sql', 'drizzle/meta/0009_snapshot.json', 'domain/mail/address.ts', 'domain/mail/lists.ts',
  'functions/utils/mail/gate.ts', 'functions/utils/mail/plan.ts',
  'test/unit/mail-address.test.ts', 'test/unit/mail-plan.test.ts', 'test/unit/migration-0060-mail-lists.test.ts', 'test/integration/mail-gate.test.ts',
  'test/integration/mail-gate-edges.test.ts', 'test/integration/mailRuns.ts', 'test/unit/redesign-status-ws16-step2.test.ts',
]
const NEW_UNIT = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.ts$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new files that are code or tests, which lint reads. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.ts$/.test(f))
/** The files of code and record this step changes. */
const CHANGED = [
  'functions/db/schema.ts', 'functions/db/relations.ts', 'drizzle/meta/_journal.json', 'migrations/README.md', 'functions/utils/mail/switches.ts',
  'functions/utils/mail/send.ts', 'functions/utils/mail/outcome.ts', 'functions/utils/email.ts', 'functions/utils/admin/campaigns.ts',
  'functions/utils/registration/registrationOpenNotify.ts', 'functions/api/admin/tournaments/[id]/announce.ts', 'functions/api/admin/campaigns/[id].ts',
  'workers/daily-emails/src/index.ts', 'test/integration/harness.ts', 'REDESIGN_STATUS.md',
]
/** The test files this step changes, each with its count written in the block, unit and integration apart. */
const CHANGED_UNIT = [
  'test/unit/published-review-notice.test.ts', 'test/unit/mail-switches.test.ts', 'test/unit/mail-rules-outcome.test.ts', 'test/unit/schema-drift.test.ts',
  'test/unit/drizzle-baseline.test.ts', 'test/unit/db-generate-guard.test.ts', 'test/unit/db-generate-real-kit.test.ts', 'test/unit/seed-fixtures.test.ts',
  'test/unit/migration-safety.test.ts',
]
const CHANGED_INTEGRATION = ['test/integration/campaigns.test.ts']
/** The unit test files whose counts grow with no change of their own. */
const GROWN = ['test/unit/domain-boundaries.test.ts']

/** The heads of this step's entries in the four lists, in their order. */
const HEADS = {
  decisions: [
    'The mail tables, keyed by address and built once (WS16 step 2).',
    'The do-not-send gate (WS16 step 2).',
    'A reminder claimed before its send, under the rules (WS16 step 2).',
  ],
  deviations: ['No cron and no phase, and the daily run\'s reminders before its rating lookups (WS16 step 2).'],
  verify: [
    'No mail tables before 0060 (WS16 step 2).',
    'Families share one address (WS16 step 2).',
    'Walk-in placeholders (WS16 step 2).',
    'The pins a new migration moves (WS16 step 2).',
    'The generator in the container (WS16 step 2).',
    'The worker in the integration runtime (WS16 step 2).',
    'D1\'s limit on bound values (WS16 step 2).',
    'The rating lookups came first (WS16 step 2).',
    'The sample members (WS16 step 2).',
    'The runtime\'s words for too many outside calls (WS16 step 2).',
  ],
  followUps: [
    'The worker\'s bundle against the plan\'s ceiling (WS16 step 2).',
    'The runtime\'s words, against production\'s own log (WS16 step 2).',
    'Group email\'s retry rule under the engine\'s rules (WS16 step 2).',
    'The attendee and week-before reminders a run leaves (WS16 step 2).',
  ],
}

/** The follow-up of WS16 step 1 that this step closes, and the sentence it closes with. */
const CLOSED = 'The second list\'s name, settled before migration 0060 (WS16 step 1).'
const CLOSE = ' Done in WS16 step 2: '

describe('REDESIGN_STATUS.md, WS16 step 2: the Status line', () => {
  it('keeps the fixed prefix and gives this step\'s tail while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(2)
    if (latestStep === 2) expect(tail).toBe(TAIL)
    expect(tail).toMatch(/\bbuilt\b/)
    expect(tail.endsWith('.')).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 2: the block', () => {
  it('sits right after WS16 step 1\'s block and before the four lists, once', () => {
    expect(ws16.split(`\n${STEP}\n`)).toHaveLength(2)
    const at = [STEP_ONE, STEP, LISTS[0]].map((h) => ws16.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    // Nothing between the two blocks but step 1's own, and nothing between this block and the decisions but itself and what a
    // later step adds there: its own block, "### WS16 step N: ...", or a checkpoint's section, as WS16 step 1's test allows them.
    const later = (l: string) => /^### WS16 step (?:[3-9]|1[0-2]): \S/.test(l) || /^### Checkpoint [MNO]: WS16 (?:steps \d+ to \d+|step \d+)$/.test(l)
    expect(ws16.slice(at[0], at[1]).split('\n').filter((l) => l.startsWith('### '))).toEqual([STEP_ONE])
    expect(ws16.slice(at[1], at[2]).split('\n').filter((l) => l.startsWith('### ') && !later(l))).toEqual([STEP])
  })

  it('has every part, in order, each a bullet of its own', () => {
    const parts = [
      '- **Files.**', '- **The tables.**', '- **The gate.**', '- **The daily run.**', '- **The pinned suites.**', '- **What the merge does.**',
      '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- **Worker.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(block.split('\n').filter((l) => l.startsWith('- Checks:'))).toHaveLength(1)
    expect(block).toContain('what a visitor or a member meets, by switch, is nothing new')
  })

  it('names every file it adds and changes, each test with its count', () => {
    const files = bullet(block, '- **Files.**')
    for (const name of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT, ...CHANGED_INTEGRATION, ...GROWN]) expect(files, name).toContain(`\`${name}\``)
    for (const name of [...NEW_UNIT, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of [...CHANGED_UNIT, ...CHANGED_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before)[:)]`))
    for (const name of GROWN) expect(bullet(files, '  - Grown with no change:'), name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, \\d+ before: `))
    expect(bullet(files, '  - Files beyond the step\'s list:')).not.toBe('')
  })

  it('gives the tables their columns, their keys and the two marks kept apart, with no CHECK and no table rebuilt', () => {
    const tables = bullet(block, '- **The tables.**')
    for (const piece of [
      '`mail_lists`', '`mail_contacts`', '`mail_list_choices`', '`mail_do_not_send`', '`main_mailer`', '`club_id`', '`optional_off_at`', '`complained_at`',
      '`list_id`', '`skipped_count`', '`contact_id`', '`sending_at`', '24 columns in all', 'no table is rebuilt', 'No CHECK is written',
      'an address with no account can hold a choice', 'are kept apart', '`domain/mail/lists.ts`', '`INSERT OR IGNORE`', 'migrations 0021 and 0038',
    ]) expect(tables, piece).toContain(piece)
  })

  it('gives the gate its three refusals in their order, their words, one query for each 90 and a read that fails', () => {
    const gate = bullet(block, '- **The gate.**')
    const order = ['`not_sendable`', '`do_not_send`', '`opted_out`'].map((r) => gate.indexOf(r))
    for (const i of order) expect(i).toBeGreaterThan(-1)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    for (const piece of [
      '"Not sent: this address no longer receives mail."', '"Not sent: not a real address."', '"Not sent: this person turned this email off."',
      '"Not sent yet: the do-not-send list could not be read."', 'one query for each 90 addresses', '`GateUnread`', 'never refused for a choice',
      '`engineRulesOn()`', 'for list mail, kind `\'optional\'`, always', '`limitRefused`', '`TOO_MANY_OUTSIDE_CALLS`', 'every request and answer is today\'s',
    ]) expect(gate, piece).toContain(piece)
  })

  it('gives the daily run its order, its claims and the free plan\'s budget, with the counted figures', () => {
    const run = bullet(block, '- **The daily run.**')
    for (const piece of [
      'before the rating lookups', 'claims each row before its send', 'sends only when the claim changed the row', 'given back only for an outcome of later',
      'claim 25 rows', 'what is left of 45 outside calls', '25 sends and 20 lookups, 45 outside calls, and 36 queries', 'today\'s, in today\'s order',
      'Only the registration-open query reads a row again on a later day', 'the attendee and week-before reminders go first',
      'none of the 5 week-before rows past the cap',
    ]) expect(run, piece).toContain(piece)
    // The figures the map's AC12 sentence gives are the block's.
    expect(added('AC12', 'Built in WS16 step 2: ')).toContain('45 outside calls and 36 queries')
    // The rows that are not read again are handed on, with the choice they leave.
    const left = entries(followUps).find((l) => head(l) === HEADS.followUps[3]) ?? ''
    for (const piece of ['`test/integration/mail-gate.test.ts`', 'WS16 step 4 chooses between widening the two queries', 'the cap of 25 gives way']) {
      expect(left, piece).toContain(piece)
    }
  })

  it('names the two pinned suites and why each is pinned, and what the merge does', () => {
    const pinned = bullet(block, '- **The pinned suites.**')
    for (const piece of [
      '`test/integration/campaigns.test.ts`', '`test/unit/published-review-notice.test.ts`', '`MAIL_LISTS_ON` false and `MAIL_SENDER` `\'resend\'`',
      '`campaign.test.lca`', '`test/integration/campaigns-once.test.ts`', 'over the real module',
    ]) expect(pinned, piece).toContain(piece)
    const merge = bullet(block, '- **What the merge does.**')
    for (const piece of ['`migrate-db.yml`', 'four tables, two list rows and four empty columns, no row of today\'s changed', '`deploy-worker.yml`', '`npm run db:migrate:preview`']) {
      expect(merge, piece).toContain(piece)
    }
  })

  it('says nothing a visitor or a member meets ships with every switch off, and lists the pins it moved with their figures', () => {
    expect(bullet(block, '- **What ships with every switch off.**').startsWith('- **What ships with every switch off.** Nothing a visitor or a member meets.')).toBe(true)
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of [
      '`test/unit/schema-drift.test.ts`', '319 to 343', '32 to 36', '`test/unit/drizzle-baseline.test.ts`', '60 to 61', '33 to 37',
      '`0060_mail_lists.sql`', '`test/unit/db-generate-guard.test.ts`', '`0060` to `0061`', '`0010_snapshot.json`', '`test/unit/db-generate-real-kit.test.ts`',
      '9 to 10', '`test/unit/seed-fixtures.test.ts`', '"0001 to 0060"', '`test/unit/migration-safety.test.ts`', '17 to 19', '`migrations/README.md`',
      '`0061_club_notes.sql`', '`campaign.lca.invalid` to `campaign.test.lca`', 'Nothing else in those tests changes.',
    ]) expect(pins, piece).toContain(piece)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(10)
  })

  it('gives the lint as unchanged, the build and the worker against the base, and each check once', () => {
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['`22c205e`', 'a local production build', '`index-BGHuXroV.js` at 550,347 bytes', '`index-De3UpPLs.css` at 130,375 bytes', '`features-DxqQlIon.js` at 698 bytes', 'the same name and size as on the base']) {
      expect(build, piece).toContain(piece)
    }
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })

  it('gives the worker\'s dry run on the base and after, measured on their days, larger after', () => {
    const worker = bullet(block, '- **Worker.**')
    for (const piece of ['`npx wrangler deploy --dry-run`', '`--config workers/daily-emails/wrangler.toml`', '`22c205e`', 'Wednesday, November 11, 2026', 'The bundle holds no package.']) {
      expect(worker, piece).toContain(piece)
    }
    const sizes = [...worker.matchAll(/([\d.]+) KiB, gzip ([\d.]+) KiB/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(sizes.length).toBeGreaterThanOrEqual(2)
    const [base, after] = sizes
    expect(base).toEqual([33.35, 9.47])
    expect(after[0]).toBeGreaterThan(base[0])
    expect(after[1]).toBeGreaterThan(base[1])
    const more = /([\d.]+) KiB more, gzip ([\d.]+) KiB/.exec(worker)
    expect(more, 'the growth').not.toBeNull()
    expect(Number(more![1])).toBeCloseTo(after[0] - base[0], 2)
    expect(Number(more![2])).toBeCloseTo(after[1] - base[1], 2)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 2: the figures add up', () => {
  const files = bullet(block, '- **Files.**')
  const countOf = (name: string) => {
    const m = new RegExp(`\`${escape(name)}\` \\((\\d+)(?:, (\\d+) before|, as before)?[:)]`).exec(files)
    return m ? { now: Number(m[1]), before: Number(m[2] ?? m[1]) } : null
  }

  it('gives unit counts that add up: the base\'s, the new files\' tests, the changed files\' gains and the grown file\'s growth', () => {
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([8082, 309])
    const counts = [...NEW_UNIT, ...CHANGED_UNIT, ...GROWN].map((name) => [name, countOf(name)] as const)
    for (const [name, count] of counts) expect(count, name).not.toBeNull()
    const gain = counts.reduce((sum, [name, count]) => sum + (NEW_UNIT.includes(name) ? count!.now : count!.now - count!.before), 0)
    expect(num(before) + gain).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s and the new file\'s', () => {
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([1321, 85])
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
    expect(Number(lint![2])).toBe(870)
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_LINTED.length)
  })
})

describe('REDESIGN_STATUS.md, WS16 step 2: the map and the close of a follow-up', () => {
  it('adds AC5\'s sentence once, ahead of its planned step, and to no other item', () => {
    for (const [id, sentence] of PROVED) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.indexOf(sentence), id).toBeLessThan(item.indexOf('Planned: WS16 step 2.'))
      expect(item.endsWith('Planned: WS16 step 2.'), id).toBe(true)
    }
    expect(entries(map).filter((l) => l.includes('Proved in WS16 step 2 by')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(PROVED.map(([id]) => id))
    const ac5 = added('AC5', PROVED[0][1])
    for (const piece of ['do-not-send list', 'walk-in placeholder', 'reserved top-level name', 'documentation names', 'two queries, of 90 and 30 addresses', 'holds list mail back', 'send each notice once', 'with the rules off']) {
      expect(ac5, piece).toContain(piece)
    }
  })

  it('adds a sentence that starts "Built in WS16 step 2" to the three items this step builds a part of, once each, ahead of their planned steps', () => {
    for (const [id, step] of BUILT) {
      const item = mapItem(id)
      expect(item.split('Built in WS16 step 2: '), id).toHaveLength(2)
      expect(item.endsWith(`Planned: WS16 step ${step}.`), id).toBe(true)
      expect(item.indexOf('Built in WS16 step 2: '), id).toBeLessThan(item.indexOf(`Planned: WS16 step ${step}.`))
    }
    expect(entries(map).filter((l) => l.includes('Built in WS16 step 2:')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(BUILT.map(([id]) => id))
    expect(added('AC6', 'Built in WS16 step 2: ')).toContain('`mail_contacts` keyed by address')
    expect(added('AC10', 'Built in WS16 step 2: ')).toContain('`lca-newsletter`')
    expect(added('AC12', 'Built in WS16 step 2: ')).toContain('`dailyBudget`')
  })

  it('closes the follow-up on the second list\'s name at its end, its earlier words as WS16 step 1 wrote them', () => {
    const entry = entries(followUps).find((l) => head(l) === CLOSED) ?? ''
    expect(entry.split(CLOSE)).toHaveLength(2)
    const close = entry.slice(entry.indexOf(CLOSE))
    for (const piece of ['migration 0060', '`lca-tournaments`', '"LCA tournament email"', 'WS16 step 11']) expect(close, piece).toContain(piece)
    expect(entry.endsWith('.')).toBe(true)
    expect(entries(ws16).filter((l) => l.includes(' Done in WS16 step 2:')).map(head)).toEqual([CLOSED])
  })
})

describe('REDESIGN_STATUS.md, WS16 step 2: the lists', () => {
  it('records this step\'s entries in each list, in their order, each once and tagged', () => {
    expect(tagged(decisions).map(head)).toEqual(HEADS.decisions)
    expect(tagged(deviations).map(head)).toEqual(HEADS.deviations)
    expect(tagged(verify).map(head)).toEqual(HEADS.verify)
    expect(tagged(followUps).map(head)).toEqual(HEADS.followUps)
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of tagged(list)) expect(entry, head(entry)).toMatch(/^- \*\*[^*]+ \(WS16 step 2\)\.\*\* \S/)
    }
  })

  it('puts its follow-ups after the one WS16 step 1 handed to WS16 step 12', () => {
    const heads = entries(followUps).map(head)
    expect(heads.indexOf(HEADS.followUps[0])).toBeGreaterThan(heads.indexOf('The two launch scripts (WS16 step 12).'))
  })

  it('confirms nine verify items in the code and says plainly that the runtime\'s words were not read in Cloudflare\'s own', () => {
    const [words, ...rest] = [...tagged(verify)].reverse()
    for (const entry of rest) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
    expect(words.slice(words.indexOf('.**') + 4)).toMatch(/^Not confirmed in Cloudflare's own words\./)
    for (const piece of ['"Too many subrequests by single Worker invocation."', '`TOO_MANY_OUTSIDE_CALLS`', 'Thursday, October 29, 2026']) expect(words, piece).toContain(piece)
  })

  it('records the decisions with what each turned down, and the deviation against brief 1.4\'s section 2.2', () => {
    for (const entry of tagged(decisions)) expect(entry, head(entry)).toContain('Turned down:')
    expect(tagged(deviations)[0]).toContain('section 2.2')
    expect(tagged(deviations)[0]).toContain('WS16 adds no cron and no phase')
  })
})

describe('REDESIGN_STATUS.md, WS16 step 2: the migration\'s statements against the block', () => {
  const sql = read('migrations/0060_mail_lists.sql')
  const statements = splitSql(sql).map((s) => s.trim())
  const tables = bullet(block, '- **The tables.**')

  it('holds the statements the block describes, and only those: four tables, two indexes, four columns and one data statement', () => {
    const kinds = statements.map((s) => /^(CREATE TABLE|CREATE UNIQUE INDEX|CREATE INDEX|ALTER TABLE|INSERT OR IGNORE INTO) `(\w+)`/.exec(s)?.slice(1, 3).join(' '))
    expect(kinds).toEqual([
      'CREATE TABLE mail_contacts', 'CREATE UNIQUE INDEX mail_contacts_address_unique', 'CREATE TABLE mail_do_not_send', 'CREATE TABLE mail_list_choices',
      'CREATE INDEX mail_list_choices_list', 'CREATE TABLE mail_lists', 'ALTER TABLE email_campaign_recipients', 'ALTER TABLE email_campaign_recipients',
      'ALTER TABLE email_campaigns', 'ALTER TABLE email_campaigns', 'INSERT OR IGNORE INTO mail_lists',
    ])
    // The statements, without the header's words, which say there is none of these.
    expect(statements.join('\n')).not.toMatch(/\bDROP TABLE\b|\bCHECK\b|PRAGMA|REFERENCES `email_|__new_/i)
  })

  it('creates and adds every table and column the block names, and the block names every one', () => {
    for (const table of ['mail_lists', 'mail_contacts', 'mail_list_choices', 'mail_do_not_send']) {
      expect(statements.some((s) => s.startsWith(`CREATE TABLE \`${table}\``)), table).toBe(true)
      expect(tables, table).toContain(`\`${table}\``)
    }
    for (const [table, column] of [['email_campaigns', 'list_id'], ['email_campaigns', 'skipped_count'], ['email_campaign_recipients', 'contact_id'], ['email_campaign_recipients', 'sending_at']]) {
      expect(statements.some((s) => s.startsWith(`ALTER TABLE \`${table}\` ADD \`${column}\``)), `${table}.${column}`).toBe(true)
      expect(tables, column).toContain(`\`${column}\``)
    }
  })

  it('writes the two lists the record names, each a main mailer, in a statement safe to run twice, as its header says', () => {
    const insert = statements.at(-1)!
    // The splitter keeps a statement without its closing semicolon.
    expect(insert).toBe("INSERT OR IGNORE INTO `mail_lists` (`id`, `kind`, `name`, `main_mailer`) VALUES ('lca-newsletter', 'newsletter', 'LCA newsletter', 1), ('lca-tournaments', 'tournaments', 'LCA tournament email', 1)")
    expect(sql).toContain('Edited by hand after generating')
    expect(sql).toContain('safe to run twice')
    expect(sql.split('--> statement-breakpoint\nINSERT OR IGNORE')).toHaveLength(2)
    expect(tables).toContain('`INSERT OR IGNORE`')
    expect(added('AC10', 'Built in WS16 step 2: ')).toContain('one of LCA\'s main mailers')
  })
})

describe('REDESIGN_STATUS.md, WS16 step 2: plain language', () => {
  /** Everything this step wrote in the section: its block, its entries, its map sentences, its close and the Status line's tail. */
  const written = [
    block, ...[decisions, deviations, verify, followUps].flatMap(tagged), ...PROVED.map(([id, s]) => added(id, s)),
    ...BUILT.map(([id]) => added(id, 'Built in WS16 step 2: ')), followUps.slice(followUps.indexOf(CLOSE), followUps.indexOf('\n', followUps.indexOf(CLOSE))),
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

  it('names steps as "WS16 step N" and checkpoints in full', () => {
    for (const text of written) {
      const bare = proseOf(text).replace(/\b[Cc]heckpoints [J-O](?:, [J-O])* and [J-O]\b|\b[Cc]heckpoint [J-O]\b/g, 'checkpoint')
      expect([...bare.matchAll(/(?<![\w-])[JLMNO](?![\w-])/g)].map((m) => m[0]), text.slice(0, 60)).toEqual([])
    }
  })
})

describe('REDESIGN_STATUS.md, WS16 step 2: the date and the new files', () => {
  it('dates the record on a real day, on or after Wednesday, November 11, 2026, the day of this step', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-11').toBe(true)
  })

  it('lists as new only files that exist, the code and tests among them free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of [...NEW_FILES, ...CHANGED, ...CHANGED_UNIT, ...CHANGED_INTEGRATION, ...GROWN]) expect(existsSync(join(ROOT, file)), file).toBe(true)
    for (const file of NEW_LINTED.concat('migrations/0060_mail_lists.sql')) {
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
  })
})
