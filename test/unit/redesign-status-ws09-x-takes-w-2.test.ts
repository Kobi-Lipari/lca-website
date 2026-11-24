// test/unit/redesign-status-ws09-x-takes-w-2.test.ts
//
// REDESIGN_STATUS.md records checkpoint X taking checkpoint W in a second
// time, as checkpoint W stood with main in it, its review's fixes and the
// browser tests' third build. Like the record tests of the earlier takings
// in, this file reads only the WS09 section, from its heading to the WS10
// heading. Pinned here: the block right after the block of Reply through LCA
// and before the four lists while it is the latest; the Status line's tail; its
// opening and its parts in order; what it says of the merge and of where the
// two sides meet, against the database's files and the product's; what the
// merged tree asked and each moved pin against its file; what ships and what
// the merge carries, with the figures that will move again read from the
// files that hold them and never written here; the Checks line's figures,
// which must agree with each other; the one follow-up; and the plain-language
// rules over what the block wrote. No line here reads how a switch ships.
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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|${'LINT' + 'FILES'}|${'UNIT' + 'TESTS'}|${'SELF' + 'CASES'}`)
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
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 27: Reply through LCA'
const BLOCK = '### Checkpoint X: WS09 checkpoint W taken in with main as it stands'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === BLOCK
const followUps = ws09.includes(`\n${LISTS[3]}\n`) ? ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1) : ''
const TAG = /^- \*\*[^*]+ \(WS09 checkpoint X\)\.\*\* \S/
const followUp = entries(followUps).find((l) => l.startsWith('- **The written page\'s Contact has no id (WS09 checkpoint X).** ')) ?? ''

const SELF = 'test/unit/redesign-status-ws09-x-takes-w-2.test.ts'
/** This step's other new file: the joined database held as one. */
const DATABASE = 'test/unit/ws09-merged-database.test.ts'
const ROUTES = 'test/unit/routes.test.ts'
const JOURNAL = 'drizzle/meta/_journal.json'
const MIGRATION = 'migrations/0071_rate_limits.sql'
const PAGE = 'src/areas/clubs/clubPage.ts'
const WRITTEN = 'functions/utils/clubs/pageHtml.ts'
/** The 26 files that met at the merge, by their groups. */
const MET = {
  database: [
    'functions/db/schema.ts', 'drizzle/meta/0016_snapshot.json', JOURNAL, 'migrations/README.md', 'test/unit/db-generate-guard.test.ts', 'test/unit/db-generate-real-kit.test.ts',
    'test/unit/drizzle-baseline.test.ts', 'test/unit/schema-drift.test.ts', 'test/unit/migration-0070-club-event-approval.test.ts', 'test/unit/seed-fixtures.test.ts',
  ],
  product: [WRITTEN, PAGE, 'test/unit/club-page-html.test.tsx', 'test/integration/club-page-route.test.ts', 'test/integration/club-written-look.test.ts'],
  lists: [ROUTES, 'test/unit/app-routes.test.tsx', 'test/unit/api-split-modules.test.ts', 'test/unit/fixtures/api-added-since-split.json'],
  records: [16, 20, 21, 22, 23, 24].map((n) => `test/unit/redesign-status-ws09-step${n}.test.ts`),
  status: ['REDESIGN_STATUS.md'],
}
/** The files whose pins moved, each with its count of cases. */
const MOVED: ReadonlyArray<readonly [string, number]> = [
  ['test/unit/club-pages-five-regions-words.test.ts', 5], ['test/integration/club-fixtures-page.test.ts', 12], ['test/unit/club-page-review-fixes.test.tsx', 13],
  ['test/unit/migration-0071-rate-limits.test.ts', 7], ['test/unit/redesign-status-ws09-step25.test.ts', 23], ['test/unit/redesign-status-ws09-step26.test.ts', 21],
  ['test/unit/redesign-status-ws09-step27.test.ts', 21], ['test/unit/redesign-status-ws09-x-takes-w.test.ts', 8], ['test/unit/redesign-status-ws09-help-marks.test.ts', 16],
  ['test/unit/redesign-status-ws09-w-review.test.ts', 16], ['test/unit/redesign-status-ws09-w-takes-main.test.ts', 9], ['test/unit/redesign-status-ws09-step1.test.ts', 33],
]
const HELD = [
  'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts',
  'test/a11y/signedIn.ts',
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
type Snapshot = { id: string; prevId: string; tables: Record<string, unknown> }
const snapshot = (n: string) => JSON.parse(read(`drizzle/meta/${n}_snapshot.json`)) as Snapshot

describe('REDESIGN_STATUS.md, checkpoint X: WS09 checkpoint W taken in with main as it stands', () => {
  it('sits once, right after the block of WS09 step 27, and before the four lists while it is the latest', () => {
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
    if (latest) expect(tail).toContain('step 26, step 27, checkpoint W taken into checkpoint X with `main` as it stands, K\'s answers')
    expect(statusLine.split('checkpoint W taken into checkpoint X with `main` as it stands')).toHaveLength(2)
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132', 'pull request 134', 'pull request 154']) expect(prLine, pr).toContain(pr)
  })

  it('opens with why in one sentence, and has every part in order', () => {
    const opening = block.split('\n')[2] ?? ''
    expect(opening.split(/\.\s/).length).toBe(1)
    for (const piece of ['taken `main` in twice', 'the browser tests\' third build', 'WS09 step 28', 'the five regions', 'the mail work\'s newsletter page', 'checkpoint W\'s reviewed club page']) {
      expect(opening, piece).toContain(piece)
    }
    const parts = [
      '- **What the merge holds.**', '- **Where the two meet.**', '- **What the merged tree asked.**', '- **Pins moved.**', '- **Judgement calls.**', '- **What ships with every switch off.**',
      '- **What the merge carries.**', '- Checks:', '- **Files.**', '- **Branch.**',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })
})

describe('REDESIGN_STATUS.md, checkpoint X taking checkpoint W in with main: the parts against the files', () => {
  it('names the merge, its two parents by their subjects, the common commit, the 26 files that met by group and how nothing was dropped', () => {
    const holds = bullet(block, '- **What the merge holds.**')
    for (const piece of [
      '`1e6254a`, "Merge checkpoint W, with main as it stands, into redesign/ws09-clubs-x"', '`1747c58`, "WS09 step 27: Reply through LCA (checkpoint X)"',
      '`04e4a48`, "WS09 checkpoint W: the review\'s fixes and the checkpoint\'s record"', '`992b145`', 'draft pull request 154', '`216e7ae`, "WS09 the written page reads as a page (checkpoint W)"',
      'checkpoint X has 5 commits and checkpoint W 76', 'git joined 308 by itself', '26 met and were settled by hand', 'Nothing of either side was dropped',
      '`git diff --stat 1747c58` ends "334 files changed, 53955 insertions(+), 1726 deletions(-)"', '`git diff --stat 04e4a48` ends "114 files changed, 16622 insertions(+), 171 deletions(-)"',
      'both type checks, the build, both whole suites and the generator', 'read twice more',
    ]) expect(holds, piece).toContain(piece)
    const met = Object.values(MET).flat()
    expect(met).toHaveLength(26)
    expect(new Set(met).size).toBe(26)
    for (const file of met) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      if (file !== 'REDESIGN_STATUS.md' && !MET.records.includes(file) && !file.startsWith('test/unit/db-') && !file.startsWith('test/unit/drizzle-') && !file.startsWith('test/unit/schema-') && !file.startsWith('test/unit/migration-0070') && !file.startsWith('test/unit/seed-')) {
        expect(holds, file).toContain(`\`${file}\``)
      }
    }
    for (const [group, count] of [['The database, ', 10], ['The product, ', 5], ['The lists, ', 4]] as const) expect(holds, group).toContain(`${group}${count} files`)
    expect(MET.database).toHaveLength(10)
    expect(MET.product).toHaveLength(5)
    expect(MET.lists).toHaveLength(4)
    expect(holds).toContain('Six closed record tests, of WS09 steps 16 and 20 to 24')
    for (const file of ['domain/clubs/pageWords.ts', 'domain/contracts/registry.ts', 'src/App.tsx', 'test/a11y/global-setup.ts']) expect(holds, file).toContain(`\`${file}\``)
  })

  it('says where the two meet in the database, as its files hold it', () => {
    const meet = bullet(block, '- **Where the two meet.**')
    for (const piece of [
      '`newsletter_issues` first', '`rate_limits` after it', '`drizzle/meta/0016_snapshot.json` is `main`\'s to the byte', '`drizzle/meta/0017_snapshot.json`',
      '`npm run db:generate -- rate limits --number 0071`', 'lists `0016_newsletter_issues` then `0017_rate_limits`', '`0071_rate_limits.sql` beside `main`\'s `0072_regions_by_seat.sql`',
      'runs 0071 alone after it', 'runs 0071 then 0072', 'neither reads the other', '`migrations/README.md` joins both sides\' sentences', 'one comment line under `migrations/`',
      'no statement of the file changes', '"No schema changes, so no migration was written."', 'with no database read or written',
    ]) expect(meet, piece).toContain(piece)
    const schema = read('functions/db/schema.ts')
    for (const table of ['sqliteTable(\'newsletter_issues\'', 'sqliteTable(\'rate_limits\'']) expect(schema, table).toContain(table)
    expect(schema.indexOf('sqliteTable(\'rate_limits\'')).toBeGreaterThan(schema.indexOf('sqliteTable(\'newsletter_issues\''))
    const journal = JSON.parse(read(JOURNAL)) as Journal
    const newsletter = journal.entries.find((e) => e.tag === '0016_newsletter_issues')
    const limits = journal.entries.find((e) => e.tag === '0017_rate_limits')
    expect(newsletter?.idx).toBe(16)
    expect(limits?.idx).toBe(17)
    expect(limits!.when).toBeGreaterThan(newsletter!.when)
    const sixteen = snapshot('0016')
    const seventeen = snapshot('0017')
    expect(Object.keys(sixteen.tables)).not.toContain('rate_limits')
    expect(Object.keys(seventeen.tables)).toContain('rate_limits')
    expect(seventeen.prevId).toBe(sixteen.id)
    // The header of 0071 names the staged file the journal's tag names, as main's rule for its 0061 holds.
    expect(read(MIGRATION)).toContain(`-- staged as drizzle/${limits!.tag}.sql.`)
    expect(read(MIGRATION).split('\n')[0]).toBe('-- 0071_rate_limits.sql')
    const migrations = readdirSync(join(ROOT, 'migrations')).filter((name) => /^\d{4}_/.test(name)).sort()
    expect(migrations).toContain('0071_rate_limits.sql')
    expect(migrations.indexOf('0072_regions_by_seat.sql')).toBe(migrations.indexOf('0071_rate_limits.sql') + 1)
    const readme = read('migrations/README.md').replace(/\s+/g, ' ')
    expect(readme).toContain('the rate limits `0071`, the regions by seat `0072`')
    expect(readme).toContain('a database that ran `0072` first runs `0071` after it')
    if (latest) {
      for (const piece of ['44 tables of 429 columns', '18 entries', '70 files, with `0073` next', '90 files by sha256']) expect(meet, piece).toContain(piece)
      expect(journal.entries).toHaveLength(18)
      expect(migrations).toHaveLength(70)
    }
  })

  it('says where the two meet in the product, as its files hold it, and leaves the written Contact\'s id for later', () => {
    const meet = bullet(block, '- **Where the two meet.**')
    for (const piece of [
      '`SECTION_IDS` in `src/areas/clubs/clubPage.ts`', '`PAGE_SECTION_IDS`', 'checkpoint X\'s `contact` beside them', 'joins the file\'s two imports from `@domain/clubs/pageWords` into one',
      'checkpoint X\'s Contact after Events, with no id', '`contact.goes_to`', '`relayKind` in `functions/utils/clubs/relay.ts`', 'Left for a later step',
    ]) expect(meet, piece).toContain(piece)
    const page = read(PAGE)
    expect(page).toContain('export const SECTION_IDS: Record<DrawnSection, string> = { ...PAGE_SECTION_IDS, news: \'news\', contact: \'contact\' }')
    expect(page.match(/^import .* from '@domain\/clubs\/pageWords'$/gm)).toEqual(['import { CONTACT_HEADING, PAGE_SECTION_IDS } from \'@domain/clubs/pageWords\''])
    const written = read(WRITTEN)
    expect(written).toContain('...contactHtml()')
    expect(read('domain/contracts/clubPage.ts')).toContain('goes_to: z.enum(CONTACT_GOES_TO)')
    const relay = read('functions/utils/clubs/relay.ts')
    expect(relay).toContain('if (await clubAddressOf(db, clubId)) return \'club\'')
    expect(relay).toContain('? \'region\' : \'lca\'')
  })

  it('says what the merged tree asked, by kind, and names each moved pin by its file, its count and its owner', () => {
    const asked = bullet(block, '- **What the merged tree asked.**')
    for (const piece of [
      'unit 12,677 tests in 575 files, 25 failing in 11 files', 'integration 3,636 in 204 files, 3,634 passing and 1 failing', 'with the one todo beside them',
      'the same failing cases, by file and title', '`a11y-clubs`', '18 passed, none failing', 'draws checkpoint X\'s Contact section and its form', '16 cases in 8 files',
      'the 2 cases of `test/unit/migration-0071-rate-limits.test.ts`', 'A meeting of the two sides\' code: none', '8 cases in 3 files of checkpoint W', 'Found and not mended: none',
    ]) expect(asked, piece).toContain(piece)
    expect(subBullets(asked)).toHaveLength(5)
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of ['the narrowest way, keeping what it meant', 'no file\'s count of cases changes', 'no case is deleted, skipped or emptied', 'stand as written', 'writes no count of its own']) {
      expect(pins, piece).toContain(piece)
    }
    expect(subBullets(pins)).toHaveLength(11)
    for (const [file, count] of MOVED) {
      expect(pins, file).toContain(`\`${file}\` (${count}`)
      expect(casesIn(file), file).toBe(count)
    }
    for (const owner of ['checkpoint W\'s', 'checkpoint X\'s', '`main`\'s, through checkpoint W', 'checkpoint S\'s, on `main`']) expect(pins, owner).toContain(owner)
    // Each moved pin, as its file now holds it.
    expect(read('test/unit/club-pages-five-regions-words.test.ts')).toContain('contact: { name: null, goes_to: \'club\' },')
    expect(read('test/integration/club-fixtures-page.test.ts')).toContain('expect(capital.contact).toEqual({ name: \'Player One\', goes_to: \'club\' })')
    expect(read('test/integration/club-fixtures-page.test.ts')).toContain('expect(north.contact).toEqual({ name: \'Player Two\', goes_to: \'club\' })')
    expect(read('test/unit/club-page-review-fixes.test.tsx')).toContain('\'<section id="events">\', \'<section>\'])')
    expect(read('test/unit/migration-0071-rate-limits.test.ts')).toContain('expect(journal.entries[17]).toMatchObject({ idx: 17, tag: \'0017_rate_limits\' })')
    for (const [n, figure] of [[25, 105], [26, 106], [27, 107]] as const) {
      const text = read(`test/unit/redesign-status-ws09-step${n}.test.ts`)
      expect(text, String(n)).toContain(`.exec(read('test/unit/routes.test.ts'))?.[1])).toBeGreaterThanOrEqual(${figure})`)
      expect(text, String(n)).not.toMatch(/toBe\\\(10\[\d-9\]\\\)/)
    }
    expect(read('test/unit/redesign-status-ws09-x-takes-w.test.ts')).toContain('waits in draft pull request 134 for K\\\'s word for its merge')
    expect(read('test/unit/redesign-status-ws09-step1.test.ts')).toContain('\\(WS09 checkpoint [WX]\\)')
  })

  it('names the judgement calls, what ships with every switch off and what the merge carries, its moving figures read from their files', () => {
    const calls = bullet(block, '- **Judgement calls.**')
    for (const piece of ['checkpoint X\'s clauses stand after checkpoint W\'s last clause, Help\'s', 'one closed test moves either way', '17 after 16', '"(WS09 checkpoint X)"']) expect(calls, piece).toContain(piece)
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of [
      'As each parent\'s blocks say, and nothing new', 'one empty table, `rate_limits`', '30 calls an hour from one place wherever `CLUB_KEEPERS_ON` is on', 'answer 403 in words while `CLUB_PAGES_ON` is unset',
      'No switch is added and none changes', '`CLUB_PAGES_ON` and `newClubs` stay off',
    ]) expect(off, piece).toContain(piece)
    const carries = bullet(block, '- **What the merge carries.**')
    for (const piece of [
      'no migration, table, endpoint, contract or switch of its own', 'a local production build', '`VITE_`', '`index-D7gy2YPT.js` at 521,529 bytes', '`index-BSav8PcT.js` at 520,712',
      '`index-C3pRj36A.js` at 560,485', '`index-CEht-dmK.css` at 172,344 bytes (171,910 and 138,507)', '`features-BFUKrFdH.js` at 741 bytes', '`features-nZCZoT6G.js` at 729',
      '76.61 KiB, gzip 20.53 KiB', '78,448 bytes', '13 errors and 11 warnings, as on each parent',
    ]) expect(carries, piece).toContain(piece)
    if (latest) {
      expect(carries).toContain(`${handlers} handler files under \`functions/api\``)
      expect(carries).toContain(`${Object.values(contracts).reduce((n, route) => n + Object.keys(route).length, 0)} methods there contracted`)
      expect(carries).toContain(`\`PENDING_COUNT\` ${pending}`)
    }
  })

  it('names every file it changes and the branch', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [SELF, DATABASE, 'REDESIGN_STATUS.md', MIGRATION, PAGE]) expect(files, file).toContain(`\`${file}\``)
    for (const file of [SELF, DATABASE]) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect(writtenCount(files, file), file).toBe(casesIn(file))
    }
    expect(files).toContain(`the ${MOVED.length} test files of Pins moved`)
    for (const piece of ['No file the mail stream holds is touched', ...HELD.map((f) => `\`${f}\``), '`test/a11y/global-setup.ts`', '`TURNSTILE_SECRET_KEY`', '`A11Y_VARIANTS`']) expect(files, piece).toContain(piece)
    expect(read('test/a11y/global-setup.ts')).toContain('  \'TURNSTILE_SECRET_KEY\',\n  \'VITE_TURNSTILE_SITE_KEY\',\n')
    for (const piece of ['`redesign/ws09-clubs-x`', '`1e6254a`', 'this step\'s diff is against `1e6254a`', 'pushed together']) expect(bullet(block, '- **Branch.**'), piece).toContain(piece)
  })

  it('adds the one follow-up, tagged for checkpoint X, last of its list while the block is the latest', () => {
    expect(followUp).toMatch(TAG)
    expect(entries(followUps).filter((l) => TAG.test(l))).toEqual([followUp])
    if (latest) expect(entries(followUps).at(-1)).toBe(followUp)
    for (const piece of ['`PAGE_SECTION_IDS`', '`contactHtml` in `functions/utils/clubs/pageHtml.ts`', '`id="contact"`', '`SECTION_IDS.contact`', 'lands at the top of the page until the app draws', 'To be settled in checkpoint X\'s own work']) {
      expect(followUp, piece).toContain(piece)
    }
  })
})

describe('REDESIGN_STATUS.md, checkpoint X taking checkpoint W in with main: the figures and the plain words', () => {
  it('gives each figure of the checks once, with each parent\'s beside it, the integration figure with the one todo beside it', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no whole browser run in the build', 'the worker\'s dry run ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    expect(checksLine).toMatch(/`npm run lint` 13 errors and 11 warnings over [\d,]+ files \(1,368 on checkpoint W's side, 1,300 on checkpoint X's\), none new/)
    const unit = /unit ([\d,]+) tests in (\d+) files \(12,386 in 552 on checkpoint W's side, 11,467 in 507 on checkpoint X's; 12,677 in 575 joined, before this step's two new test files\), every one passing/.exec(checksLine)
    expect(unit, 'the unit figures').not.toBeNull()
    // The merged tree's run before any change, and this step's two new files' cases added to it.
    expect(num(unit![1])).toBe(12677 + casesIn(SELF) + casesIn(DATABASE))
    expect(Number(unit![2])).toBe(575 + 2)
    expect(checksLine).toMatch(/integration 3,635 tests that run in 204 files \(3,483 in 190 on checkpoint W's side, 3,095 in 183 on checkpoint X's\), every one passing, with the one todo beside them/)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, 223 on checkpoint W's side, 216 on checkpoint X's\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    for (const piece of [
      'a local production build', 'the main script at 521,529 bytes (520,712 and 560,485)', 'the stylesheet at 172,344 (171,910 and 138,507)', 'the switches chunk at 741 (741 and 729)',
      '`a11y-clubs`, run with its setup in the build, 18 passed before any change and after', '680 passed and 337 skipped', '`a11y-on` 463 and 36, `a11y-off` 199 and 301, `a11y-clubs` 18',
      '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched', '76.61 KiB, gzip 20.53 KiB', 'Tuesday, November 24, 2026',
    ]) expect(checksLine, piece).toContain(piece)
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and any unfilled mark out of what it wrote', () => {
    for (const text of [block, followUp]) {
      expect(text).not.toBe('')
      for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(text).not.toMatch(rule)
      const prose = proseOf(text)
      expect(prose).not.toMatch(HE)
      for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
        expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
      }
    }
    for (const file of [SELF, ...MOVED.map(([f]) => f)]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })
})
