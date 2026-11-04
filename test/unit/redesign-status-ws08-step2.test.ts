// test/unit/redesign-status-ws08-step2.test.ts
//
// REDESIGN_STATUS.md records WS08 step 2: migration 0059, with the ticket
// kinds and the mark that the D22 notice has gone, the mark's key in the
// tournament answers for the event's managers alone, and the two factories
// the later steps read. Like WS08 step 1's record test, this file reads only
// the WS08 section and the one piece of the date line the step writes, the
// date, never every table row or heading of the file, and it reads no count
// or figure from the code. Pinned here: the step's block, after step 1's and
// before the four lists, with its parts in order, every file it names and
// figures that agree with each other; the Status line's tail while this step
// is the latest; the sentences it adds to AC13 and AC15; its tagged entries
// in the four lists, the follow-up for K after every follow-up step 1 wrote,
// with what the create and the setup save answer on a database without 0059,
// and the follow-up on a guest's assignment right after it;
// the plain-language rules over everything it wrote; the date; and the
// migration itself, held to its three statements and its header, with the
// columns the block names read against the file.
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
/** What a draft would hold before its figures were filled in: the marks of the earlier records' drafts and their capitalised names. */
const UNFILLED = new RegExp(
  `${String.fromCharCode(0x27ea)}|${'@' + '@'}|${'_' + '_'}|${'X' + 'X_'}|${'\\[' + '\\['}|\\{[A-Z_0-9]+\\}|${'FI' + 'G_'}|${'<' + '<'}[A-Z_]+${'>' + '>'}|${'to be ' + 'measured'}` +
    `|\\b(${['LI' + 'NT', 'BUI' + 'LD', 'BROW' + 'SER', 'CHE' + 'CKS', 'GR' + 'EP', 'CSS' + 'GROWTH', 'RELOAD' + 'TESTS', 'RECORD' + 'TESTS', 'SETUP' + 'TESTS', 'FEATURES' + 'TESTS', 'STEP32' + 'TESTS'].join('|')})\\b`,
)
/** The merge-pending phrase, which the file holds once, in WS01 step 32's line, and this section never. */
const PENDING = new RegExp(`checkpoint D's merge is ${'pen' + 'ding'}|merge into \`main\` is ${'pen' + 'ding'}`)

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
const TAG = '(WS08 step 2).'
/** The follow-up on a guest's assignment, which the step's review found and a later step takes. */
const GUEST = 'A guest\'s assignment lists a hidden draft (WS08 step 2).'
const tagged = (text: string) => entries(text).filter((l) => head(l).endsWith(TAG))

const HEADING = '## WS08: Director and admin tools (TD console, setup checklist, admin home and queues)'
/** The WS08 section, from its heading to the WS09 heading. */
const ws08 = between(status, `\n${HEADING}\n`, '\n## WS09:')
const sectionLines = ws08.split('\n')
/** A part of the section, from its heading, a line of its own, to the next. */
const part = (heading: string) => {
  const at = ws08.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws08.slice(at + 1), heading, '\n### ')
}
const MAP = '### WS08 map: what proves each acceptance criterion and decision'
const STEP1 = '### WS08 step 1: the record and the creation rules'
const STEP = '### WS08 step 2: migration 0059, the ticket kinds and the review mark'
const LISTS = ['### WS08 decisions', '### WS08 deviations from the brief', '### WS08 verify items resolved', '### WS08 follow-ups']
const map = part(MAP)
const block = part(STEP)
const decisions = part(LISTS[0])
const deviations = part(LISTS[1])
const verify = part(LISTS[2])
/** The follow-ups, the section's last part, to its end. */
const followUps = ws08.includes(`\n${LISTS[3]}\n`) ? ws08.slice(ws08.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const statusLine = sectionLines.find((l) => l.startsWith('**Status:**')) ?? ''
/** The date at the start of the date line, the one piece of that line this step writes. */
const date = /^Last updated: (\d{4})-(\d{2})-(\d{2}) \(/.exec(status.split('\n').find((l) => l.startsWith('Last updated:')) ?? '')
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const mapItems = entries(map)
const mapItem = (id: string) => mapItems.find((l) => l.startsWith(`- **${id}.**`)) ?? ''

/** The Status line up to and including its last fixed words, which WS08 step 1 set and every step keeps. */
const STATUS_PREFIX = '**Status:** in progress: the first part, tournament creation, ten steps in three checkpoints (checkpoint J for steps 1 to 3, checkpoint K for 4 to 6, checkpoint L for 7 to 10); '
const TAIL = 'steps 1 and 2 are built.'
/** The highest step with a block of its own in the section: a later step owns the Status line's tail. */
const latestStep = Math.max(0, ...[...ws08.matchAll(/^### WS08 step (\d+): /gm)].map((m) => Number(m[1])))

/** The two map items this step builds a part of, each with the sentence it adds and the step planned to prove the item. */
const BUILT: ReadonlyArray<readonly [string, string, number]> = [
  ['AC13', 'Built in WS08 step 2: the column, `tournaments.review_notified_at`, nullable, in migration 0059.', 6],
  ['AC15', 'Built in WS08 step 2: the ticket\'s `kind` and `about_id` columns.', 10],
]

const MIGRATION = 'migrations/0059_ticket_kinds.sql'
/** The three statements of the migration, as the test databases split it. */
const STATEMENTS = [
  'ALTER TABLE `support_tickets` ADD `kind` text',
  'ALTER TABLE `support_tickets` ADD `about_id` text',
  'ALTER TABLE `tournaments` ADD `review_notified_at` text',
]

/** The files this step adds: the migration, its snapshot, the integration test, this record's test and the five files of tests written once the step was built. */
const NEW_FILES = [
  'migrations/0059_ticket_kinds.sql', 'drizzle/meta/0008_snapshot.json', 'test/integration/ticket-kinds.test.ts', 'test/unit/redesign-status-ws08-step2.test.ts',
  'test/unit/migration-0059-ticket-kinds.test.ts', 'test/unit/review-mark-contract.test.ts', 'test/unit/redesign-status-ws08-step2-claims.test.ts',
  'test/integration/review-mark-answers.test.ts', 'test/integration/ticket-kinds-answers.test.ts',
]
const NEW_UNIT = NEW_FILES.filter((f) => /^test\/unit\/.*\.test\.ts$/.test(f))
const NEW_INTEGRATION = NEW_FILES.filter((f) => /^test\/integration\/.*\.test\.ts$/.test(f))
/** The new test files whose parts the block counts: every one but this record's test, whose parts it names in words. */
const PARTED = [...NEW_UNIT, ...NEW_INTEGRATION].filter((f) => f !== 'test/unit/redesign-status-ws08-step2.test.ts')
/** The new files the lint run reads. */
const NEW_LINTED = NEW_FILES.filter((f) => /\.tsx?$/.test(f))
/** The files of code, records and fixtures this step changes. */
const CHANGED = [
  'functions/db/schema.ts', 'drizzle/meta/_journal.json', 'domain/contracts/events.ts', 'functions/types.ts', 'functions/utils/events/publicAnswer.ts',
  'src/areas/events/api.ts', 'functions/api/tournaments.ts', 'functions/api/tournaments/[id].ts', 'test/integration/factories.ts', 'migrations/README.md',
  'test/unit/fixtures/drizzle-sql/drop-quoted-parent.sql', 'REDESIGN_STATUS.md',
]
/** The test files whose pins this step moves, each with its count written in the block. */
const CHANGED_TESTS = [
  'test/unit/schema-drift.test.ts', 'test/unit/drizzle-baseline.test.ts', 'test/unit/db-generate-guard.test.ts', 'test/unit/db-generate-real-kit.test.ts',
  'test/unit/contracts-layer.test.ts', 'test/unit/seed-fixtures.test.ts', 'test/unit/public-answer.test.ts',
  'test/integration/public-answer-trim.test.ts', 'test/integration/public-answer-trim-edges.test.ts', 'test/integration/contracts/tournaments-readers.test.ts',
  'test/integration/contracts/tournaments-list.test.ts', 'test/integration/contracts/tournaments.test.ts',
]
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
/** A number as the record writes it, with or without its thousands' commas. */
const num = (text: string) => Number(text.replace(/,/g, ''))
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
/** A checkpoint named in full, or several named together, as WS08 step 1's record test reads them. */
const IN_FULL = /\b[Cc]heckpoints [JKL](?:, [JKL])* and [JKL]\b|\b[Cc]heckpoint [JKL]\b/g
/** A J or an L on its own in the prose, or a K in the place a checkpoint's letter takes. */
const bareLetters = (text: string) =>
  [...proseOf(text).replace(IN_FULL, 'checkpoint').matchAll(/(?<![\w-])[JL](?![\w-])|(?<![\w-])K (?:for (?:steps )?\d|\(steps? \d)/g)].map((m) => m[0])

/** Everything this step wrote: its block, its entries, the Status line's tail, the two sentences and the date. */
const written = [
  block, ...tagged(decisions), ...tagged(deviations), ...tagged(verify), ...tagged(followUps),
  statusLine.slice(STATUS_PREFIX.length), ...BUILT.map(([, sentence]) => sentence), date?.[0] ?? '',
]

describe('REDESIGN_STATUS.md, WS08 step 2: the step block', () => {
  it('sits after step 1\'s block and before the four lists, once, under a heading in the record\'s form', () => {
    const at = [MAP, STEP1, STEP, ...LISTS].map((h) => ws08.indexOf(`\n${h}\n`))
    for (const i of at) expect(i).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(ws08.split(`\n${STEP}\n`)).toHaveLength(2)
    expect(STEP).toMatch(/^### WS08 step 2: \S/)
    expect(sectionLines.filter((l) => /^### Step\b/.test(l))).toEqual([])
  })

  it('opens by naming the step and its checkpoint, and says what a visitor sees, by switch', () => {
    const opening = block.split('\n')[2] ?? ''
    expect(opening.startsWith('WS08 step 2 is the second step of checkpoint J.')).toBe(true)
    expect(opening).toContain('what a visitor sees, by switch, is nothing new')
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Files.**', '- **The columns.**', '- **The contract.**', '- **What the merge of checkpoint J does.**', '- **What ships with every switch off.**',
      '- **Pins moved.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(checksLine).not.toBe('')
  })

  it('names every file it adds and changes, the new ones as new, each test with its count', () => {
    const files = bullet(block, '- **Files.**')
    const fresh = files.slice(files.indexOf('New: '), files.indexOf(' Changed: '))
    for (const name of NEW_FILES) expect(fresh, name).toContain(`\`${name}\``)
    for (const name of [...CHANGED, ...CHANGED_TESTS]) expect(files.slice(files.indexOf(' Changed: ')), name).toContain(`\`${name}\``)
    for (const name of [...NEW_UNIT, ...NEW_INTEGRATION]) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+: `))
    for (const name of CHANGED_TESTS) expect(files, name).toMatch(new RegExp(`\`${escape(name)}\` \\(\\d+, (?:\\d+ before|as before): `))
    expect(files).toContain('No other file is added or changed')
  })

  it('names the three columns, each nullable with its purpose, and says why publish_at is not among them', () => {
    const columns = bullet(block, '- **The columns.**')
    for (const piece of [
      '`support_tickets.kind`', '`support_tickets.about_id`', '`tournaments.review_notified_at`', 'nullable', 'no table is rebuilt and no row changes',
      '`listing_report`', '`event_report`', '`payout_request`', 'the clearinghouse listing or the tournament the ticket is about', 'only while the mark is NULL',
      '`publish_at` is not among them', 'Phase 2\'s column', '`00xx_console.sql`', 'the console part adds it with its phase',
    ]) expect(columns, piece).toContain(piece)
  })

  it('names the columns the migration adds, no more and no fewer', () => {
    const fromFile = splitSql(read(MIGRATION)).map((s) => /^ALTER TABLE `(\w+)` ADD `(\w+)` text$/.exec(s)).map((m) => (m ? `${m[1]}.${m[2]}` : ''))
    // A table and its column in backticks, not a file's name and its extension.
    const named = [...bullet(block, '- **The columns.**').matchAll(/`(\w+)\.(\w+)`/g)].filter((m) => !/^(?:sql|ts|tsx|js|json|md|yml)$/.test(m[2])).map((m) => `${m[1]}.${m[2]}`)
    expect([...new Set(named)].sort()).toEqual([...fromFile].sort())
  })

  it('gives the contract\'s key, its place and the manager-only list, and says a non-manager\'s public answer does not carry it', () => {
    const contract = bullet(block, '- **The contract.**')
    for (const piece of [
      '`review_notified_at: storedTimestampSchema.nullable()`', '`managedTournamentListItemSchema`', 'after `requires_lca_membership` and before `club_name`',
      '`tournamentListItemSchema`', '`adminTournamentSchema`', '`tournamentDetailSchema`', '`tournamentManageResponseSchema`', '`toTournamentResponse`',
      '`MANAGER_ONLY_TOURNAMENT_KEYS` gains it', 'a non-manager\'s public answer does not carry the key at all', 'no handler changed',
    ]) expect(contract, piece).toContain(piece)
  })

  it('says what the merge of checkpoint J does: the migration on production, no row changed, the worker redeployed with its bundle unchanged, and the create and the setup save at 500 until 0059 is on production', () => {
    const merge = bullet(block, '- **What the merge of checkpoint J does.**')
    for (const piece of [
      '`migrate-db.yml` applies 0059 to production', 'no row changed and no table rebuilt', '`deploy-worker.yml` redeploys the daily-emails worker',
      '`domain/contracts/events.ts`', 'with its bundle unchanged', 'byte for byte', 'none of those files is in its import closure',
      'from the moment the new Pages build is live until 0059 is on production, the create and every save through `PATCH /api/admin/tournaments/[id]` answer 500',
      'watch it apply 0059, and re-run it at once if it fails',
    ]) expect(merge, piece).toContain(piece)
  })

  it('says nothing a visitor sees ships with every switch off, and names the answers that carry the new keys', () => {
    const ships = bullet(block, '- **What ships with every switch off.**')
    expect(ships.startsWith('- **What ships with every switch off.** Nothing a visitor sees')).toBe(true)
    for (const piece of ['`review_notified_at`', 'a visitor\'s two public answers leave it out', '`GET /api/support`', '`GET /api/admin/support/[id]`', 'No page reads any of them']) {
      expect(ships, piece).toContain(piece)
    }
  })

  it('names each pin it moves with its new figure and its reason, and leaves the trim\'s history alone', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const [file, ...pieces] of [
      ['test/unit/schema-drift.test.ts', '316 to 319', 'is unchanged and passes'],
      ['test/unit/drizzle-baseline.test.ts', '59 files to 60', '`0059_ticket_kinds.sql`', '"all 59 migrations" to 60'],
      ['test/unit/db-generate-guard.test.ts', '0059 to 0060', '`0009_snapshot.json`'],
      ['test/unit/db-generate-real-kit.test.ts', '8 to 9', 'the ticket kinds entry', '`0060_` file'],
      ['test/unit/fixtures/drizzle-sql/drop-quoted-parent.sql', 'drizzle-kit 0.31.11\'s own output', '`test/unit/migration-safety.test.ts` does not change'],
      ['test/unit/seed-fixtures.test.ts', '0001 to 0058" to 0059', '`0058_` to `0059_`'],
      ['migrations/README.md', '`0060` next', '`0060_club_notes.sql`'],
      ['test/unit/contracts-layer.test.ts', '45 to 46', '"42 tournaments columns" to 43'],
      ['test/unit/public-answer.test.ts', '`MANAGERS_ONLY` gains the key', 'WS08 step 2 added it', '45 to 46'],
      ['test/integration/public-answer-trim.test.ts', '`MANAGERS_ONLY` gains the key'],
      ['test/integration/public-answer-trim-edges.test.ts', '`MANAGERS_ONLY` gains the key'],
      ['test/integration/contracts/tournaments-readers.test.ts', '`managersOnly`', 'gains the key'],
      ['test/integration/contracts/tournaments-list.test.ts', '`managersOnly` gains the key', 'all four or none'],
      ['test/integration/contracts/tournaments.test.ts', '`managersOnly` gains the key', 'the event\'s mark is set'],
    ] as const) {
      const line = pins.split('\n').find((l) => l.includes(`\`${file}\``)) ?? ''
      expect(line, file).not.toBe('')
      for (const piece of pieces) expect(line, `${file}: ${piece}`).toContain(piece)
    }
    expect(pins).toContain('Not moved: the trim\'s record test, which pins the trim\'s own words, "45 keys" among them, as history')
  })

  it('gives its judgement calls, the lint as unchanged, the build against the base, and each figure of the checks once', () => {
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(8)
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 13 warnings, unchanged')
    const build = bullet(block, '- **Build.**')
    for (const piece of ['`ab0fbc3`', 'the main script', 'the stylesheet', 'the switches chunk', 'bytes', 'byte for byte']) expect(build, piece).toContain(piece)
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', '`npm run test:a11y`']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('one run')
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` before and after')
  })
})

describe('REDESIGN_STATUS.md, WS08 step 2: the lines outside the block', () => {
  it('keeps the Status line\'s fixed prefix, and says steps 1 and 2 are built while this step is the latest', () => {
    expect(statusLine.startsWith(STATUS_PREFIX)).toBe(true)
    const tail = statusLine.slice(STATUS_PREFIX.length)
    expect(latestStep).toBeGreaterThanOrEqual(2)
    if (latestStep === 2) expect(tail).toBe(TAIL)
    else expect(tail.endsWith('.')).toBe(true)
  })

  it('adds its sentence to AC13 and to AC15, once each, in front of the planned step, and to no other item', () => {
    for (const [id, sentence, planned] of BUILT) {
      const item = mapItem(id)
      expect(item.split(sentence), id).toHaveLength(2)
      expect(item.endsWith(`Planned: WS08 step ${planned}.`), id).toBe(true)
      expect(item.indexOf(sentence), id).toBeLessThan(item.lastIndexOf('Planned: WS08 step'))
    }
    expect(mapItems.filter((l) => l.includes('in WS08 step 2')).map((l) => l.slice(4, l.indexOf('.**')))).toEqual(BUILT.map(([id]) => id))
  })

  it('records its decision, its two deviations and its verify items, each tagged and each verify item confirmed', () => {
    expect(tagged(decisions).map(head)).toEqual(['The mark is database time (WS08 step 2).'])
    expect(tagged(deviations).map(head)).toEqual([
      'The migration is Phase 1\'s, ahead of WS04 (WS08 step 2).',
      'review_notified_at is the event\'s managers\' alone (WS08 step 2).',
    ])
    expect(tagged(verify).map(head)).toEqual([
      'The generator runs with no terminal (WS08 step 2).',
      'Every tournament answer spreads the row (WS08 step 2).',
      'The President seat on the test database (WS08 step 2).',
    ])
    for (const entry of tagged(verify)) expect(entry.slice(entry.indexOf('.**') + 4), head(entry)).toMatch(/^Confirmed\b/)
    const generator = tagged(verify)[0]
    for (const piece of ['`npm run db:generate -- ticket_kinds`', 'no question about a rename', '`0008_snapshot.json`', 'The `--custom` way', 'was not needed']) {
      expect(generator, piece).toContain(piece)
    }
    for (const list of [decisions, deviations, verify, followUps]) {
      for (const entry of tagged(list)) expect(entry).toMatch(/^- \*\*[^*]+ \(WS08 step 2\)\.\*\* \S/)
    }
  })

  it('records the follow-up for K after every follow-up WS08 step 1 wrote, quoting ordering rule 2, and the one on a guest\'s assignment right after it', () => {
    const name = 'K migrates the preview database before checkpoint J\'s preview (WS08 step 2).'
    expect(tagged(followUps).map(head)).toEqual([name, GUEST])
    const heads = entries(followUps).map(head)
    const at = heads.indexOf(name)
    expect(at).toBeGreaterThan(-1)
    expect(heads.slice(0, at).filter((h) => h.endsWith(TAG))).toEqual([])
    expect(heads.slice(0, at).every((h) => / \(WS08 step (?:[1-9]|10)\)\.$/.test(h))).toBe(true)
    expect(heads.slice(0, at).length).toBeGreaterThanOrEqual(10)
    const entry = entries(followUps)[at]
    for (const piece of [
      '"K migrates the preview database from the branch before reviewing each checkpoint\'s preview. He runs `npm run db:migrate:preview` from the branch, with his own Cloudflare credentials, before he looks at the preview, not after the merge."',
      'ordering rule 2', '`migrate-db.yml`', '`lca-db-preview`', '`scripts/db/preview-guard.ts`',
      'Without 0059, the create and every save through `PATCH /api/admin/tournaments/[id]` answer 500 on the branch\'s preview', 'the migration comes before anyone uses checkpoint J\'s preview',
    ]) expect(entry, piece).toContain(piece)
    // A preview without 0059 does not read as before: the branch's create and setup save fail on it.
    expect(entry).not.toContain('reads as before')
    // The follow-up on a guest's assignment comes right after it.
    expect(heads[at + 1]).toBe(GUEST)
    for (const piece of [
      '`functions/api/tournaments.ts`', '`canManageTournament` (`functions/utils/admin/permissions.ts`)', '`eventsManagedBy` (`functions/utils/events/publicAnswer.ts`)',
      '`GET /api/tournaments`', '`GET /api/tournaments/[id]`', 'adds AND the role is not guest to that clause', 'Owner: WS08 step 3 or the console part.',
    ]) expect(entries(followUps)[at + 1], piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 2: the migration itself', () => {
  const text = read(MIGRATION)
  const lines = text.split('\n')

  it('holds the three statements and nothing else: three nullable text columns, with no key, check, default, trigger or data', () => {
    expect(splitSql(text)).toEqual(STATEMENTS)
    const sql = lines.filter((l) => !l.startsWith('--') || l.startsWith('-->')).join('\n')
    expect(sql).not.toMatch(/\b(?:REFERENCES|CHECK|DEFAULT|NOT NULL|PRIMARY|UNIQUE|INDEX|TRIGGER|INSERT|UPDATE|DELETE|DROP|CREATE|PRAGMA)\b/i)
    for (const statement of STATEMENTS) expect(text, statement).toContain(`${statement};`)
  })

  it('opens with the header the generator writes, and holds at most six lines of comment below it, one for each column\'s purpose', () => {
    expect(lines[0]).toBe('-- 0059_ticket_kinds.sql')
    expect(text).toContain('-- Written by drizzle-kit from functions/db/schema.ts (npm run db:generate),\n-- staged as drizzle/0008_ticket_kinds.sql.')
    const end = lines.indexOf('-- rather than editing this file.')
    expect(end).toBeGreaterThan(0)
    const below = lines.slice(end + 1, lines.indexOf('', end + 1))
    expect(below.length).toBeLessThanOrEqual(6)
    for (const l of below) expect(l.startsWith('--')).toBe(true)
    const comment = below.join(' ')
    for (const column of ['kind:', 'about_id:', 'review_notified_at:']) expect(comment, column).toContain(column)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 2: plain language', () => {
  /** The same, with what sits in backticks taken out, since code is not prose. */
  const prose = written.map(proseOf)

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
      expect(text).not.toMatch(PENDING)
      expect(text).not.toContain('is pending')
      expect(text).not.toMatch(/\.github\//)
      expect(text).not.toMatch(/\(step \d+[;),]/)
    }
  })

  it('writes each checkpoint in full, and K only as K the person', () => {
    for (const text of written) expect(bareLetters(text), text.slice(0, 60)).toEqual([])
    for (const text of written) expect(text.replace(IN_FULL, 'checkpoint')).not.toMatch(/\bK (?:for|after|opens|merges|carries|holds) /)
  })

  it('gives every date the weekday it falls on, and writes every time on the twelve-hour clock', () => {
    const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    const months = MONTHS.join('|')
    const short = MONTHS.map((m) => m.slice(0, 3)).join('|')
    for (const text of prose) {
      for (const found of text.matchAll(new RegExp(`\\b(?:${months}|${short}) \\d{1,2}\\b`, 'g'))) {
        expect(text.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
      }
      for (const [whole, weekday, month, day, year] of text.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${months}) (\\d{1,2})\\b(?:, (\\d{4}))?`, 'g'))) {
        expect(WEEKDAYS[new Date(Date.UTC(Number(year ?? 2026), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
      }
      for (const time of text.matchAll(/\b\d{1,2}:\d{2}(?::\d{2})?(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d(?::[0-5]\d)? (?:AM|PM)$/)
    }
  })

  it('keeps every new file free of a dash, a tool\'s name, the two letters on their own and the old initials', () => {
    for (const file of NEW_FILES) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      const text = read(file)
      expect(text, file).not.toMatch(DASHES)
      expect(text, file).not.toMatch(TOOLS)
      expect(text, file).not.toMatch(BARE)
      expect(text, file).not.toMatch(OLD_INITIALS)
    }
    for (const file of [...CHANGED, ...CHANGED_TESTS]) expect(existsSync(join(ROOT, file)), file).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 2: the date', () => {
  it('dates the record on a real day, on or after Tuesday, November 3, 2026, the day WS08 step 1 opened it', () => {
    expect(date, 'the date at the start of the date line').not.toBeNull()
    const [, year, month, day] = date!.map(Number)
    const real = new Date(Date.UTC(year, month - 1, day))
    expect([real.getUTCFullYear(), real.getUTCMonth() + 1, real.getUTCDate()]).toEqual([year, month, day])
    expect(`${date![1]}-${date![2]}-${date![3]}` >= '2026-11-03').toBe(true)
  })
})

describe('REDESIGN_STATUS.md, WS08 step 2: the figures agree', () => {
  it('gives unit counts that add up: the base\'s and the new file\'s tests, the changed files keeping theirs', () => {
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = unit!
    expect([num(before), Number(beforeFiles)]).toEqual([7155, 262])
    const fresh = NEW_UNIT.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    const gains = CHANGED_TESTS.filter((name) => name.startsWith('test/unit/')).map((name) => {
      const m = new RegExp(`\`${escape(name)}\` \\((\\d+), (?:(\\d+) before|as before): `).exec(files)
      return m ? Number(m[1]) - Number(m[2] ?? m[1]) : NaN
    })
    for (const n of [...fresh, ...gains]) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + [...fresh, ...gains].reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_UNIT.length)
  })

  it('gives integration counts that add up: the base\'s and the new file\'s tests, the changed files keeping theirs', () => {
    const files = bullet(block, '- **Files.**')
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect(integration, 'the integration counts in the Checks line').not.toBeNull()
    const [, after, afterFiles, before, beforeFiles] = integration!
    expect([num(before), Number(beforeFiles)]).toEqual([976, 67])
    const fresh = NEW_INTEGRATION.map((name) => Number(new RegExp(`\`${escape(name)}\` \\((\\d+): `).exec(files)?.[1]))
    const gains = CHANGED_TESTS.filter((name) => name.startsWith('test/integration/')).map((name) => {
      const m = new RegExp(`\`${escape(name)}\` \\((\\d+), (?:(\\d+) before|as before): `).exec(files)
      return m ? Number(m[1]) - Number(m[2] ?? m[1]) : NaN
    })
    for (const n of [...fresh, ...gains]) expect(Number.isNaN(n)).toBe(false)
    expect(num(before) + [...fresh, ...gains].reduce((a, n) => a + n, 0)).toBe(num(after))
    expect(Number(afterFiles) - Number(beforeFiles)).toBe(NEW_INTEGRATION.length)
  })

  it('gives the count of each new test file that lists its parts as the sum of those parts', () => {
    const files = bullet(block, '- **Files.**')
    expect(PARTED).toHaveLength(6)
    for (const name of PARTED) {
      const found = new RegExp(`\`${escape(name)}\` \\((\\d+): ([^)]*(?:\\([^)]*\\)[^)]*)*)\\)`).exec(files)
      expect(found, name).not.toBeNull()
      const counts = [...found![2].matchAll(/, (\d+)(?=;|\)|$)/g)].map((m) => Number(m[1]))
      expect(counts.length, name).toBeGreaterThanOrEqual(3)
      expect(counts.reduce((a, n) => a + n, 0), name).toBe(Number(found![1]))
    }
  })

  it('gives the browser run as one run whose counts add up', () => {
    const run = /`npm run test:a11y` ([\d,]+) tests, ([\d,]+) that run and ([\d,]+) that skip, one run/.exec(checksLine)
    expect(run, 'the browser run in the Checks line').not.toBeNull()
    expect(num(run![2]) + num(run![3])).toBe(num(run![1]))
  })

  it('gives the lint figures as the base\'s with the new files of code added', () => {
    const lint = /`npm run lint` 13 errors and 13 warnings over (\d+) files \((\d+) on the base\), none in a file this step touches/.exec(checksLine)
    expect(lint, 'the lint figures in the Checks line').not.toBeNull()
    expect(Number(lint![1]) - Number(lint![2])).toBe(NEW_LINTED.length)
  })
})
