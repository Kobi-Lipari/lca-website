// test/unit/redesign-status-ws09-x-takes-w-3.test.ts
//
// REDESIGN_STATUS.md records checkpoint X taking checkpoint W in a third
// time, as checkpoint W stood with main in it after the board seats. Like
// the record tests of the earlier takings in, this file reads only the WS09
// section, from its heading to the WS10 heading. Pinned here: the block right
// after the block of Ask to be its named rep and before the four lists while
// it is the latest; the Status line's tail; its opening and its parts in order; what it
// says of the merge and of where the two sides meet, against the database's
// files and the product's; what the merged tree asked and each moved pin
// against its file; what ships and what the merge carries, with the figures
// that will move again read from the files that hold them and never written
// here; the files and the branch; the Checks line's figures, which must agree
// with each other; and the plain-language rules over what the block wrote.
// No line here reads how a switch ships.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|\\b${'Q' + 'Q'}|\\b${'Q'}[A-Z]{3,}\\b`)
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
const subBullets = (text: string) => text.split('\n').filter((l) => /^\s+- /.test(l))
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 31: Ask to be its named rep'
const BLOCK = '### Checkpoint X: WS09 checkpoint W taken in a third time, after the board seats'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const ITEM = 'checkpoint W taken into checkpoint X a third time, after the board seats'
const block = part(BLOCK)
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === BLOCK

const SELF = 'test/unit/redesign-status-ws09-x-takes-w-3.test.ts'
const DATABASE = 'test/unit/ws09-merged-database.test.ts'
const LIMITS_TEST = 'test/unit/migration-0071-rate-limits.test.ts'
const JOURNAL = 'drizzle/meta/_journal.json'
const MIGRATION = 'migrations/0071_rate_limits.sql'
const ROUTES = 'test/unit/routes.test.ts'
/** The 11 files that met at the merge, by their groups. */
const MET = {
  database: [
    'drizzle/meta/0017_snapshot.json', JOURNAL, 'migrations/README.md', 'test/unit/db-generate-guard.test.ts', 'test/unit/db-generate-real-kit.test.ts', 'test/unit/drizzle-baseline.test.ts',
    'test/unit/schema-drift.test.ts',
  ],
  records: ['test/unit/redesign-status-ws09-step16.test.ts', 'test/unit/redesign-status-ws09-w-review.test.ts', 'test/unit/redesign-status-ws09-w-takes-main.test.ts'],
  status: ['REDESIGN_STATUS.md'],
}
/** The files git joined by itself that both sides changed. */
const JOINED = ['functions/db/schema.ts', 'functions/utils/admin/audit.ts', 'test/unit/fixtures/api-added-since-split.json', 'test/unit/redesign-status-ws09-u-review.test.ts']
/** The files whose pins moved, each with its count of cases. */
const MOVED: ReadonlyArray<readonly [string, number]> = [
  [LIMITS_TEST, 7], [DATABASE, 8], ['test/unit/migration-0070-club-event-approval.test.ts', 10], ['test/unit/redesign-status-ws09-step25.test.ts', 23],
  ['test/unit/redesign-status-ws09-step28.test.ts', 20], ['test/unit/redesign-status-ws09-step30.test.ts', 20], ['test/unit/redesign-status-ws09-step31.test.ts', 19],
  ['test/unit/redesign-status-ws09-x-takes-w-2.test.ts', 12],
]
const HELD = [
  'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/pages/AdminNewsletterPage.tsx', 'functions/utils/admin/campaigns.ts', 'src/lib/nav.ts', 'test/integration/harness.ts',
  'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts',
]
const num = (text: string) => Number(text.replace(/,/g, ''))
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])
/** The figure of the routes' own test, the count of handler files under api, as the file has it. */
const handlers = Number(/expect\(real\.filter\(\(r\) => r\.startsWith\('api\/'\)\)\.length\)\.toBe\((\d+)\)/.exec(read(ROUTES))?.[1])
/** The figure of the pending contracts, as their own file has it. */
const pending = Number(/export const PENDING_COUNT = (\d+)/.exec(read('test/unit/contracts-pending.ts'))?.[1])
type Journal = { entries: Array<{ idx: number; tag: string; when: number }> }
type Snapshot = { id: string; prevId: string; tables: Record<string, { columns: Record<string, unknown> }> }
const snapshot = (n: string) => JSON.parse(read(`drizzle/meta/${n}_snapshot.json`)) as Snapshot
const codeFiles = (dir: string): string[] =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? codeFiles(`${dir}/${d.name}`) : /\.tsx?$/.test(d.name) ? [`${dir}/${d.name}`] : []))

describe('REDESIGN_STATUS.md, checkpoint X: WS09 checkpoint W taken in a third time, after the board seats', () => {
  it('sits once, right after the block of WS09 step 31, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
    // The section's rule for its headings, in WS09 step 1's record test, takes this one.
    expect(BLOCK).toMatch(/^### Checkpoint [S-Z]: WS09 /)
    expect(read('test/unit/redesign-status-ws09-step1.test.ts')).toContain('Checkpoint [S-Z]: WS09 ')
  })

  it('gives the Status line its one item in the tail\'s manner while it is the latest, and keeps the heading and the pull request numbers', () => {
    expect(status).toContain('\n## WS09: Clubs as living listings\n')
    const tail = statusLine.slice(statusLine.lastIndexOf('; ') + 2)
    if (latest) expect(tail).toContain(`step 30, step 31, ${ITEM}, K's answers`)
    expect(statusLine.split(ITEM)).toHaveLength(2)
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132', 'pull request 134', 'pull request 154']) expect(prLine, pr).toContain(pr)
  })

  it('opens with why in one sentence, and has every part in order', () => {
    const opening = block.split('\n')[2] ?? ''
    expect(opening.split(/\.\s/).length).toBe(1)
    for (const piece of ['taken `main` in twice more', 'who may send email to members', 'its board seats', 'a third time', 'WS09 steps 25 to 31', 'checkpoint X\'s own review and pull request']) {
      expect(opening, piece).toContain(piece)
    }
    const parts = [
      '- **What the merge holds.**', '- **Where the two meet.**', '- **What the merged tree asked.**', '- **Pins moved.**', '- **What ships with every switch off.**', '- **What the merge carries.**',
      '- Checks:', '- **Files.**', '- **Branch.**',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })
})

describe('REDESIGN_STATUS.md, checkpoint X taking checkpoint W in a third time: the parts against the files', () => {
  it('names the merge, its two parents by their subjects, the common commit, the 11 files that met by group and how nothing was dropped', () => {
    const holds = bullet(block, '- **What the merge holds.**')
    for (const piece of [
      '`d3f6b3f`, "Merge checkpoint W, with main as it stands, into redesign/ws09-clubs-x"', '`ddfe636`, "WS09 step 31: Ask to be its named rep"',
      '`d2b449d`, "WS09 checkpoint W takes main in, after the board seats"', '`85f20ec`', 'draft pull request 154', '`04e4a48`, "WS09 checkpoint W: the review\'s fixes and the checkpoint\'s record"',
      'checkpoint X has 11 commits and checkpoint W 8', 'Of the 74 files checkpoint W\'s side changes', 'git joined 4 of those by itself', '11 met, in 16 places', 'in three groups',
      'Nothing of either side was dropped', '`git diff --stat ddfe636` ends "75 files changed, 7936 insertions(+), 324 deletions(-)"',
      '`git diff --stat d2b449d` ends "226 files changed, 35029 insertions(+), 264 deletions(-)"', 'the functions type check, the build, both whole suites and the generator', 'read twice more',
    ]) expect(holds, piece).toContain(piece)
    const met = Object.values(MET).flat()
    expect(met).toHaveLength(11)
    expect(new Set(met).size).toBe(11)
    for (const file of [...met, ...JOINED]) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      if (!file.startsWith('test/unit/db-') && !file.startsWith('test/unit/drizzle-') && !file.startsWith('test/unit/schema-') && !MET.records.includes(file)) expect(holds, file).toContain(`\`${file}\``)
    }
    for (const group of ['The database, 7 files', 'Three closed record tests', '`REDESIGN_STATUS.md` (2 places)']) expect(holds, group).toContain(group)
    expect(MET.database).toHaveLength(7)
    expect(MET.records).toHaveLength(3)
    // The one line the check put back stands in the review's test.
    expect(read('test/unit/redesign-status-ws09-w-review.test.ts')).toContain('expect(tail).toContain(\'the new club page in the browser, `main` taken in again after the saved templates, checkpoint W\\\'s review and its fixes, \')')
  })

  it('says where the two meet in the database, as its files hold it', () => {
    const meet = bullet(block, '- **Where the two meet.**')
    for (const piece of [
      '`board_members.is_listed`', '`rate_limits`', '44 tables of 430 columns', '`drizzle/meta/0017_snapshot.json` is `main`\'s to the byte', '`drizzle/meta/0018_snapshot.json`',
      '`npm run db:generate -- rate limits --number 0071`', 'lists `0017_seat_listing` then `0018_rate_limits`, 19 entries', '`0071_rate_limits.sql` beside `main`\'s `0072_regions_by_seat.sql` and `0073_seat_listing.sql`, 71 files',
      'with `0074` next', 'runs 0071 alone after both', 'runs 0071, 0072 and 0073', 'none reads what another writes', 'all six orders', '`migrations/README.md` joins both sides\' sentences',
      'one comment line under `migrations/`', 'no statement of the file changes', '"No schema changes, so no migration was written."', 'with no database read or written',
    ]) expect(meet, piece).toContain(piece)
    const schema = read('functions/db/schema.ts')
    expect(schema.split('sqliteTable(\'rate_limits\'')).toHaveLength(2)
    expect(schema.split('isListed: integer(\'is_listed\')')).toHaveLength(2)
    const journal = JSON.parse(read(JOURNAL)) as Journal
    const listing = journal.entries.find((e) => e.tag === '0017_seat_listing')
    // The rate limits' entry is found by its name and its snapshot by the entry's number; the number itself is held below
    // only while this block is the latest, so a later join that puts another of main's entries before it moves nothing here.
    const limits = journal.entries.find((e) => e.tag.endsWith('_rate_limits'))
    expect(listing?.idx).toBe(17)
    expect(limits!.idx).toBeGreaterThan(listing!.idx)
    expect(limits!.when).toBeGreaterThan(listing!.when)
    const [sixteen, seventeen] = ['0016', '0017'].map(snapshot)
    const eighteen = snapshot(limits!.tag.slice(0, 4))
    expect(Object.keys(seventeen.tables)).not.toContain('rate_limits')
    expect(Object.keys(eighteen.tables)).toContain('rate_limits')
    expect(Object.keys(seventeen.tables.board_members.columns)).toContain('is_listed')
    expect(Object.keys(sixteen.tables.board_members.columns)).not.toContain('is_listed')
    expect(eighteen.prevId).toBe(snapshot(String(limits!.idx - 1).padStart(4, '0')).id)
    expect(seventeen.prevId).toBe(sixteen.id)
    // The header of each names the staged file the journal's tag names, as main's rule for its 0061 holds.
    expect(read(MIGRATION)).toContain(`-- staged as drizzle/${limits!.tag}.sql.`)
    expect(read('migrations/0073_seat_listing.sql')).toContain(`-- staged as drizzle/${listing!.tag}.sql.`)
    const migrations = readdirSync(join(ROOT, 'migrations')).filter((name) => /^\d{4}_/.test(name)).sort()
    const at = migrations.indexOf('0071_rate_limits.sql')
    expect(migrations.slice(at, at + 3)).toEqual(['0071_rate_limits.sql', '0072_regions_by_seat.sql', '0073_seat_listing.sql'])
    const readme = read('migrations/README.md').replace(/\s+/g, ' ')
    expect(readme).toContain('the rate limits `0071`, the regions by seat `0072`, the seat listing `0073`')
    expect(readme).toContain('a database that ran `0072` first runs `0071` after it, and one that ran `0073` as well runs `0071` after both')
    // The joined database's test runs the three in every order, the live order and the fresh one among them.
    const database = read(DATABASE)
    expect(database).toContain('describe(\'0071, 0072 and 0073 in every order\'')
    expect(database).toContain('expect(ORDERS).toHaveLength(6)')
    expect(database).toContain('expect(ORDERS).toContainEqual([\'0072_regions_by_seat.sql\', \'0073_seat_listing.sql\', \'0071_rate_limits.sql\'])')
    if (latest) {
      expect(journal.entries).toHaveLength(19)
      expect(migrations).toHaveLength(71)
      expect(limits).toMatchObject({ idx: 18, tag: '0018_rate_limits' })
      expect(eighteen.prevId).toBe(seventeen.id)
    }
  })

  it('says where the two meet in the product, as its files hold it', () => {
    const meet = bullet(block, '- **Where the two meet.**')
    for (const piece of [
      'no product file met', '`requireAuthedMember`', '`requireAdmin`', '`requireClubRep`', '`hasSecondFactor`', '`requireMailer` and `requireListMailer`', '`functions/api/clubs/reply/[token].ts`',
      'reads `is_listed`', '"create its events and set their fees"', '`holdsPresidentSeat`', 'Left for a later step: nothing of the join',
    ]) expect(meet, piece).toContain(piece)
    // No read of a seat on the clubs' side reads its listing.
    for (const file of [...codeFiles('functions/utils/clubs'), ...codeFiles('functions/api/clubs'), ...codeFiles('domain/clubs')]) expect(read(file), file).not.toMatch(/is_listed|isListed/)
    expect(read('functions/api/clubs/reply/[token].ts')).toContain('requireListMailer')
    for (const file of ['domain/clubs/repRequest.ts', 'functions/utils/clubs/emails.ts', 'src/areas/clubs/repRequestRows.ts']) expect(read(file), file).toContain('create its events and set their fees')
    expect(read('functions/utils/events/creation.ts')).toContain('import { holdsPresidentSeat } from \'../admin/presidentSeat\'')
  })

  it('says what the merged tree asked, by kind, and names each moved pin by its file, its count and its owner', () => {
    const asked = bullet(block, '- **What the merged tree asked.**')
    for (const piece of [
      'unit 13,158 tests in 605 files, 9 failing in 8 files', 'with the one todo beside them', 'the same failing cases, by file and title', '`test/unit/admin-email-newsletter.test.tsx`',
      '6 cases in 5 files of checkpoint X', '3 cases in 3 files', 'A meeting of the two sides\' code: none', 'Anything else: none', 'Found and not mended: none',
    ]) expect(asked, piece).toContain(piece)
    expect(subBullets(asked)).toHaveLength(5)
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of ['the narrowest way, keeping what it meant', 'no file\'s count of cases changes', 'no case is deleted, skipped or emptied', 'stand as written', 'writes no count of its own']) {
      expect(pins, piece).toContain(piece)
    }
    expect(subBullets(pins)).toHaveLength(MOVED.length)
    for (const [file, count] of MOVED) {
      expect(pins, file).toContain(`\`${file}\` (${count})`)
      expect(casesIn(file), file).toBe(count)
    }
    for (const owner of ['checkpoint X\'s', '`main`\'s, its length line checkpoint X\'s']) expect(pins, owner).toContain(owner)
    // Each moved pin, as its file now holds it.
    expect(read(LIMITS_TEST)).toContain('expect(journal.entries[18]).toMatchObject({ idx: 18, tag: \'0018_rate_limits\' })')
    expect(read(LIMITS_TEST)).toContain('-- staged as drizzle/0018_rate_limits.sql.')
    expect(read(DATABASE)).toContain('it(\'links every snapshot to the one before it, so 17 is main\\\'s and 18 comes straight after it\'')
    expect(read(DATABASE)).toContain('const FRESH: Record<string, string[]> = { board_members: [\'id\'] }')
    expect(read('test/unit/migration-0070-club-event-approval.test.ts')).toContain('.exec(readFileSync(join(ROOT, \'test/unit/db-generate-real-kit.test.ts\'), \'utf8\'))?.[1]))')
    expect(read('test/unit/redesign-status-ws09-step25.test.ts')).toContain('e.idx === 18 && e.tag === \'0018_rate_limits\'')
    expect(read('test/unit/redesign-status-ws09-step28.test.ts')).toContain('.exec(read(\'test/unit/goldText.test.ts\'))?.[1])')
    for (const n of [30, 31]) expect(read(`test/unit/redesign-status-ws09-step${n}.test.ts`), String(n)).toContain('.exec(read(\'test/unit/drizzle-baseline.test.ts\'))?.[1])')
    expect(read('test/unit/redesign-status-ws09-x-takes-w-2.test.ts')).toContain('journal.entries.find((e) => e.tag.endsWith(\'_rate_limits\'))')
  })

  it('says what ships with every switch off and what the merge carries, its moving figures read from their files', () => {
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['As each parent\'s blocks say, and nothing new', 'one empty table, `rate_limits`', 'No switch is added and none changes', '`CLUB_PAGES_ON` and `newClubs` stay off']) {
      expect(off, piece).toContain(piece)
    }
    const carries = bullet(block, '- **What the merge carries.**')
    for (const piece of ['no migration, table, endpoint, contract or switch of its own', 'a local production build', '`VITE_`', '76.61 KiB, gzip 20.53 KiB', '13 errors and 11 warnings, as on each parent']) {
      expect(carries, piece).toContain(piece)
    }
    if (latest) {
      expect(carries).toContain(`${handlers} handler files under \`functions/api\``)
      expect(carries).toContain(`${Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)} methods there contracted`)
      expect(carries).toContain(`\`PENDING_COUNT\` ${pending}`)
    }
  })

  it('names every file it changes and the branch', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [SELF, 'REDESIGN_STATUS.md', MIGRATION]) expect(files, file).toContain(`\`${file}\``)
    expect(existsSync(join(ROOT, SELF))).toBe(true)
    expect(writtenCount(files, SELF)).toBe(casesIn(SELF))
    expect(files).toContain(`the ${MOVED.length} test files of Pins moved`)
    for (const piece of ['No product file is touched', 'No file the mail stream holds is touched', ...HELD.map((f) => `\`${f}\``)]) expect(files, piece).toContain(piece)
    const branch = bullet(block, '- **Branch.**')
    for (const piece of ['`redesign/ws09-clubs-x`', '`d3f6b3f`', 'this step\'s diff is against `d3f6b3f`', 'pushed together', 'is written at the checkpoint, not in this step']) expect(branch, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, checkpoint X taking checkpoint W in a third time: the figures and the plain words', () => {
  it('gives each figure of the checks once, with each parent\'s beside it, the integration figure with the one todo beside it', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no whole browser run in the build', 'the worker\'s dry run ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toMatch(/`npm run lint` 13 errors and 11 warnings over [\d,]+ files \(1,378 on checkpoint W's side, 1,496 on checkpoint X's\), none new/)
    const unit = /unit ([\d,]+) tests in (\d+) files \(12,486 in 558 on checkpoint W's side, 13,058 in 599 on checkpoint X's; 13,158 in 605 joined, before this step's new test file\), every one passing/.exec(checksLine)
    expect(unit, 'the unit figures').not.toBeNull()
    // The merged tree's run before any change, and this step's one new file's cases added to it.
    expect(num(unit![1])).toBe(13158 + casesIn(SELF))
    expect(Number(unit![2])).toBe(605 + 1)
    expect(checksLine).toMatch(/integration [\d,]+ in \d+ files \(3,526 in 192 on checkpoint W's side, 3,884 in 217 on checkpoint X's\), every one passing, with the one todo beside them/)
    expect(checksLine).not.toMatch(/\d that run in \d/)
    const built = /`npm run build` \((\d+) files in `dist\/assets`/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    for (const piece of [
      'a local production build', '(520,882 and 523,574)', '(171,910 and 173,817)', 'the third project, `a11y-clubs`, is expected to stand at checkpoint X\'s 29', '680 passed and 337 skipped',
      '691 passed and 337 skipped', '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched', '76.61 KiB, gzip 20.53 KiB', 'Wednesday, November 25, 2026',
    ]) expect(checksLine, piece).toContain(piece)
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and any unfilled mark out of what it wrote', () => {
    expect(block).not.toBe('')
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(block).not.toMatch(rule)
    const prose = proseOf(block)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const file of [SELF, ...MOVED.map(([f]) => f), MIGRATION]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })
})
