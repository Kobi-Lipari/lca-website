// test/unit/redesign-status-ws09-w-takes-main-4.test.ts
//
// REDESIGN_STATUS.md records checkpoint W taking main in a fourth time, as
// main stood after the mail work's change of the board seats, a seat that can
// count without being shown publicly. Like the record tests of the first three
// takings in, this file reads only the WS09 section, from its heading to the
// WS10 heading. Pinned here: the block right after the block of the third
// taking in and before the four lists while it is the latest, and its one item
// in the Status line's tail; its parts in order; what it says of the merge and
// of where the two sides meet, against the files; the moved pin against its
// file, with the newest migration read from the file that holds it; its
// figures, which must agree with each other, the unit figure read from this
// file's own count of cases; and the plain-language rules over what the block
// wrote. No line here reads how a switch ships.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, in the plural as well, and the two words that name a person's role in the work. */
const BANNED = new RegExp(`\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow'].join('|')})s?\\b|${'the ' + 'lead'}`, 'i')
/** The two working words in capitals, put together so that this file does not hold them; the block's lower-case "todo" is a test's own kind. */
const WORKING = new RegExp(`\\b(?:${'TO' + 'DO'}|${'W' + 'IP'})\\b`)
/** The names a record must not hold, split up so that this file does not hold them either. */
const NAMES = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
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
const PREVIOUS = '### Checkpoint W: WS09 main taken in a third time, after who may send'
const BLOCK = '### Checkpoint W: WS09 main taken in a fourth time, after the board seats'
const LISTS = '### WS09 decisions'
const block = part(BLOCK)
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS) - 1] === BLOCK
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''

const SELF = 'test/unit/redesign-status-ws09-w-takes-main-4.test.ts'
const GOLD = 'test/unit/goldText.test.ts'
const BASELINE = 'test/unit/drizzle-baseline.test.ts'
const KEEPERS = 'functions/api/clubs/[id]/page.ts'
/** The one file whose assertion moved, with its count of cases. */
const MOVED: ReadonlyArray<readonly [string, number]> = [['test/unit/redesign-status-ws09-w-takes-main.test.ts', 9]]
/** The third taking in's record test, whose newest migration this block ends with no change. */
const THIRD = 'test/unit/redesign-status-ws09-w-takes-main-3.test.ts'
/** The previous step's item and this step's own in the Status line's tail. */
const BEFORE = '`main` taken in a third time after who may send'
const ITEM = '`main` taken in a fourth time after the board seats'
/** The five files both sides changed since the common commit. */
const BOTH = ['REDESIGN_STATUS.md', 'test/unit/fixtures/api-added-since-split.json', GOLD, 'test/unit/redesign-status-ws09-regions.test.ts', 'test/unit/seed-fixtures.test.ts']
/** The nine product files main changed. */
const MAIN_PRODUCT = [
  'functions/api/admin/board-seats.ts', 'functions/api/board/seats.ts', 'functions/api/governance/board.ts', 'functions/db/schema.ts', 'functions/utils/admin/audit.ts',
  'functions/utils/admin/tickets.ts', 'src/areas/admin/components/AuditLogPanel.tsx', 'src/areas/admin/components/BoardSeatsPanel.tsx', 'src/areas/governance/api.ts',
]
/** The club page's answer, the written page and the sitemap, none of which reads a seat. */
const NO_SEAT = ['functions/api/clubs/[id].ts', 'functions/utils/clubs/pageAnswer.ts', 'functions/clubs/[id].ts', 'functions/utils/clubs/pageHtml.ts', 'functions/sitemap.xml.ts']
const CLUB_PAGE_TESTS = ['test/integration/club-page.test.ts', 'test/integration/club-page-five-regions.test.ts', 'test/integration/club-page-k-notes.test.ts']
const HELD = [
  'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/pages/AdminNewsletterPage.tsx', 'src/components/layout/', 'src/areas/admin/newsletter/', 'functions/utils/mail/',
  'domain/mail/', 'workers/daily-emails/', 'src/lib/nav.ts', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts', 'test/integration/harness.ts',
]
const num = (text: string) => Number(text.replace(/,/g, ''))
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])
const migrations = () => readdirSync(join(ROOT, 'migrations')).filter((name) => /^\d{4}_/.test(name)).sort()
/** The newest migration as the baseline test holds it. */
const baselineNewest = () => /expect\(sql\.at\(-1\)\)\.toBe\('(\d{4}_\w+\.sql)'\)/.exec(read(BASELINE))?.[1]

describe('REDESIGN_STATUS.md, checkpoint W: main taken in a fourth time, after the board seats', () => {
  it('sits once, right after the block of the third taking in, before the four lists while it is the latest, with its one item in the Status line\'s tail', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS)
    const tail = statusLine.slice(statusLine.lastIndexOf('; ') + 2)
    expect(tail.split(ITEM)).toHaveLength(2)
    expect(tail).toContain(`checkpoint W's review and its fixes, ${BEFORE}, ${ITEM}, `)
    if (latest) expect(tail).toContain(`${ITEM}, K's answers to checkpoint S's review`)
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens with why in one sentence, and has every part in order', () => {
    const opening = block.split('\n')[2] ?? ''
    expect(opening.split(/\.\s/).length).toBe(1)
    for (const piece of ['a third time after who may send', 'the board seats', 'a seat that can count without being shown publicly', 'a fourth time', 'the tree that would merge']) expect(opening, piece).toContain(piece)
    const parts = ['- **What the merge holds.**', '- **Where the two meet.**', '- **What the merged tree asked.**', '- **Pins moved.**', '- **What ships with every switch off.**', '- Checks:', '- **Files.**', '- **Branch.**']
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })
})

describe('REDESIGN_STATUS.md, checkpoint W taking main in a fourth time: the parts against the files', () => {
  it('names the merge, its two parents by their subjects, the common commit, the five files both sides changed and how nothing was dropped', () => {
    const holds = bullet(block, '- **What the merge holds.**')
    for (const piece of [
      '`e727ab5`, "Merge main into redesign/ws09-clubs-w"', '`7171132`, "WS09 checkpoint W takes main in, after who may send"', 'draft pull request 154',
      '`85f20ec`, "Board seats: a seat can count without being shown publicly (#156)"', 'merged on Tue, Nov 24, 2026',
      '`7b38743`, "Who may send email to members: admins, the president and the media manager (#153)"', '`main` has 2 commits', '`6ad253e`', 'checkpoint W has 16, its 14 and the third taking in\'s merge and record',
      '`main` brings 31 files', '`board_members.is_listed`', '`0073_seat_listing.sql`', 'its Drizzle snapshot', 'three public reads that respect it', '"Bring back"', 'four of them record tests of this section',
      'No file met: git joined everything by itself', 'Five files were changed by both sides', 'Nothing of either side was dropped',
      '`git diff --stat 7171132` ends "31 files changed, 5846 insertions(+), 57 deletions(-)"', '`git diff --stat 85f20ec` ends "141 files changed, 19221 insertions(+), 121 deletions(-)"',
    ]) expect(holds, piece).toContain(piece)
    for (const file of BOTH) expect(holds, file).toContain(`\`${file}\``)
    // main's column and its migration stand in the tree.
    expect(read('migrations/0073_seat_listing.sql')).toContain('ADD `is_listed` integer DEFAULT 1 NOT NULL')
    expect(read('functions/db/schema.ts')).toContain('isListed: integer(\'is_listed\').default(1).notNull(),')
    // Both sides' lines of the gold guard stand while this block is the latest: main's place of the audit panel, and checkpoint W's status tag.
    if (latest) {
      const gold = read(GOLD)
      expect(gold).toContain('\'src/areas/admin/components/AuditLogPanel.tsx:280 \',')
      expect(gold).toContain('`src/areas/clubs/components/ClubEvents.tsx:$' + '{clubEvents} <StatusBadge> on=light -> light`')
      const split = read('test/unit/fixtures/api-added-since-split.json')
      for (const name of ['"adminReactivateBoardSeat": "governance"', '"/api/clubs/*/page"', '"getClubPage": "clubs"']) expect(split, name).toContain(name)
    }
    // The mail work's own block stands in its own section.
    expect(status).toContain('\n#### WS16 part two: a seat that is not shown publicly\n')
    expect(ws09).not.toContain('\n#### WS16 part two: a seat that is not shown publicly\n')
  })

  it('says where the two meet, as the tree holds it, and that no club file of checkpoint W reads a seat\'s listing', () => {
    const meet = bullet(block, '- **Where the two meet.**')
    for (const piece of [
      'no file both sides changed', 'the nine product files `main` changed', 'nothing under `migrations/` or `drizzle/`', 'No line of checkpoint W\'s reads a seat\'s listing',
      'no file of `functions/api/clubs/` or `functions/utils/clubs/` reads `is_listed`', '`getActiveSeat` in `functions/utils/admin/tickets.ts`', 'read no `board_members` at all',
      `\`${KEEPERS}\``, '`requireClubRep` and `canManageClub` in `functions/utils/admin/permissions.ts`', 'by the seat\'s `is_active` and its regions', 'that answer is the same on the merged tree',
      '`functions/utils/clubs/routing.ts`', 'reads no listing either', 'the new column\'s default, 1, shown publicly', '`seedSeat`', 'gained `isListed`', 'no file of checkpoint W calls `seedSeat`',
      'No line `main` changed reads what checkpoint W changed', 'from line 278 to 280', 'the status tag of `src/areas/clubs/components/ClubEvents.tsx`', '`adminReactivateBoardSeat`',
      '"WS16 part two: a seat that is not shown publicly"', '`test/unit/redesign-status-ws09-step16.test.ts`', '`test/unit/redesign-status-ws09-step18.test.ts`',
      '`test/unit/redesign-status-ws09-u-review.test.ts`', '`0073_seat_listing.sql` the newest', 'this step adds nothing to it',
    ]) expect(meet, piece).toContain(piece)
    for (const file of [...MAIN_PRODUCT, ...NO_SEAT, ...CLUB_PAGE_TESTS]) expect(meet, file).toContain(`\`${file}\``)
    // No club file of checkpoint W reads the listing or the three reads main changed.
    for (const dir of ['functions/api/clubs', 'functions/api/clubs/[id]', 'functions/api/clubs/confirm', 'functions/utils/clubs']) {
      for (const name of readdirSync(join(ROOT, dir)).filter((n) => /\.tsx?$/.test(n))) {
        const text = read(`${dir}/${name}`)
        for (const word of ['is_listed', 'isListed', 'getActiveSeat', 'board/seats', 'governance/board', 'admin/tickets']) expect(text.includes(word), `${dir}/${name}: ${word}`).toBe(false)
      }
    }
    for (const file of NO_SEAT) expect(read(file), file).not.toContain('board_members')
    expect(read(KEEPERS)).not.toContain('board_members')
    expect(read(KEEPERS)).toContain('import { isResponse, requireClubRep } from \'../../../utils/auth\'')
    if (latest) expect(read('functions/utils/auth.ts')).toContain('if (await canManageClub(env.DB, authed.member, clubId)) return authed')
    expect(read('functions/utils/admin/permissions.ts')).toContain('export async function canManageClub(')
    if (latest) expect(read('functions/utils/admin/permissions.ts')).toContain('JOIN board_members s ON s.id = a.seat_id')
    if (latest) expect(read('functions/utils/admin/tickets.ts')).toContain('WHERE is_active = 1 AND is_listed = 1 AND (slug = ?1 OR id = ?1)')
    // Checkpoint W's club page tests name a seat's columns without the listing, and none seeds a seat through the factory.
    for (const file of CLUB_PAGE_TESTS) {
      const text = read(file)
      expect(text, file).toContain('INSERT INTO board_members (id, role, name, sort_order, slug, category, is_active)')
      expect(text, file).not.toContain('seedSeat')
    }
    if (latest) expect(read('test/integration/factories.ts')).toContain('isListed?: boolean')
    if (latest) expect(migrations().at(-1)).toBe('0073_seat_listing.sql')
  })

  it('says what the merged tree asked, and names the moved pin by its file and its count, against its file', () => {
    const asked = bullet(block, '- **What the merged tree asked.**')
    for (const piece of [
      'unit 12,478 tests in 557 files, 2 failing', 'integration 3,526 that run in 192 files, none failing', 'with the one todo beside them', 'pins of checkpoint W\'s side that `main`\'s files made false',
      `\`${MOVED[0][0]}\``, `\`${THIRD}\``, 'only while its block is the latest', 'Anything else: none', 'No test of `main`\'s fails, and none is touched',
    ]) expect(asked, piece).toContain(piece)
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of ['One, for the merge', 'none for this step\'s own item in the Status line\'s tail', 'the one assertion and one beside it that keeps `0072_regions_by_seat.sql` held, and nothing else', 'no file\'s count of cases changes', 'with a one-line comment', 'stand as written']) {
      expect(pins, piece).toContain(piece)
    }
    expect(subBullets(pins)).toHaveLength(MOVED.length)
    for (const [file, count] of MOVED) {
      expect(pins, file).toContain(`\`${file}\` (${count})`)
      expect(casesIn(file), file).toBe(count)
    }
    // The moved assertion reads the newest migration from the baseline test, and the tree agrees with it.
    const first = read(MOVED[0][0])
    expect(first).toContain('    expect(migrations.at(-1)).toBe(/expect\\(sql\\.at\\(-1\\)\\)\\.toBe\\(\'(\\d{4}_\\w+\\.sql)\'\\)/.exec(read(\'test/unit/drizzle-baseline.test.ts\'))?.[1])')
    expect(first).not.toContain('expect(migrations.at(-1)).toBe(\'0072_regions_by_seat.sql\')')
    expect(first).toContain('    expect(migrations).toContain(\'0072_regions_by_seat.sql\')')
    expect(migrations().at(-1)).toBe(baselineNewest())
    // The third taking in's test holds its newest migration only while its block is the latest, which this block ends.
    expect(read(THIRD)).toContain('    if (latest) expect(migrations.at(-1)).toBe(\'0072_regions_by_seat.sql\')')
    expect(headings[headings.indexOf(LISTS) - 1]).not.toBe(PREVIOUS)
  })

  it('says what ships with every switch off, and names every file it changes and the branch', () => {
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of [
      'What the first three takings in say, and nothing more', 'Every switch is as `main` ships it', '`CLUB_PAGES_ON` and `newClubs` stay off', 'K\'s choice 8 (a)', '`GET /api/clubs/{slug}`',
      '`GET /api/clubs/:id/page`', '`main`\'s seat listing is `main`\'s own, unchanged', '`0073_seat_listing.sql` is `main`\'s own, already applied by `main`\'s own merge',
      'this step adds none and runs none', 'checkpoint W\'s pull request still adds no migration', 'This step adds no line of product',
      'no migration, no table, no endpoint, no contract and no switch',
    ]) expect(off, piece).toContain(piece)
    const files = bullet(block, '- **Files.**')
    for (const file of [SELF, 'REDESIGN_STATUS.md']) expect(files, file).toContain(`\`${file}\``)
    expect(existsSync(join(ROOT, SELF))).toBe(true)
    expect(writtenCount(files, SELF)).toBe(casesIn(SELF))
    expect(files).toContain(`the ${['one', 'two', 'three'][MOVED.length - 1]} test file of Pins moved`)
    expect(files).toContain('this block and the Status line\'s tail')
    for (const piece of ['No product file is touched', 'nothing under `migrations/` or `drizzle/`', 'No file the mail stream holds is touched', 'the two mail guards in `functions/utils/auth.ts`', ...HELD.map((f) => `\`${f}\``)]) {
      expect(files, piece).toContain(piece)
    }
    for (const piece of ['`redesign/ws09-clubs-w`', '`e727ab5`', 'pushed together']) expect(bullet(block, '- **Branch.**'), piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, checkpoint W taking main in a fourth time: the figures and the plain words', () => {
  it('gives each figure of the checks once, with checkpoint W\'s side beside it, the integration figure with the one todo named beside it', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run in the build', 'the worker\'s dry run ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(checkpoint W's side 13 and 11 over 1,374; `main` brings three new files and this step one\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![1])).toBe(1374 + 3 + 1)
    const unit = /unit ([\d,]+) tests in (\d+) files \(12,454 in 555 on checkpoint W's side; 12,478 in 557 joined, before this step's record test\), every one passing/.exec(checksLine)
    expect(unit, 'the unit figures').not.toBeNull()
    // The merged tree's run before any change, and this file's own cases added to it.
    expect(num(unit![1])).toBe(12478 + casesIn(SELF))
    expect(Number(unit![2])).toBe(557 + 1)
    expect(checksLine).toContain('integration 3,526 tests that run in 192 files (3,511 in 191 on checkpoint W\'s side), every one passing, with the one todo beside them, "a publish date is refused before approval", under "running the region\'s club events, with REGION_EVENTS_ON set" in `test/integration/club-events.test.ts`')
    const events = read('test/integration/club-events.test.ts')
    expect(events).toContain('describe(\'running the region\\\'s club events, with REGION_EVENTS_ON set\', () => {')
    // The todo stands while this block is the latest; once it is built, it is a case like any other.
    if (latest) expect(events).toContain('  it.todo(\'a publish date is refused before approval\')')
    const built = /`npm run build` \((\d+) files in `dist\/assets`, as on checkpoint W's side\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe('223')
    expect(checked?.[1]).toBe(built?.[1])
    for (const piece of [
      'a local production build', '`VITE_`', '`index-C7sgRVBU.js` at 520,882 bytes', '`index-DVybkZf7.js` at 520,721', '`index-CGFkXpdq.css` at 171,910 bytes', '`features-BFUKrFdH.js` at 741 bytes',
      '`npm run typecheck:functions` clean', '680 passed and 337 skipped', '`a11y-on` 463 and 36', '`a11y-off` 199 and 301', '`a11y-clubs` 18 passed',
      '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched', 'the worker\'s dry run not run in the build (76.61 KiB, gzip 20.53 KiB on checkpoint W\'s side)',
      'no file under `workers/` differs from the common commit on either side',
    ]) expect(checksLine, piece).toContain(piece)
  })

  it('keeps the dashes, the working words, the names a record must not hold and the old initials out of what it wrote', () => {
    for (const rule of [DASHES, BANNED, WORKING, NAMES, BARE, OLD_INITIALS]) expect(block).not.toMatch(rule)
    expect(statusLine).not.toMatch(DASHES)
    const prose = proseOf(block)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const found of prose.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 5), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), $/)
    }
    for (const file of [SELF, ...MOVED.map(([f]) => f)]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, NAMES, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })
})
