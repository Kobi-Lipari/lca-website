// test/unit/redesign-status-ws09-w-takes-main-3.test.ts
//
// REDESIGN_STATUS.md records checkpoint W taking main in a third time, as
// main stood after the mail work's change of who may send email to members.
// Like the record tests of the first two takings in, this file reads only the
// WS09 section, from its heading to the WS10 heading. Pinned here: the block
// right after the block of checkpoint W's review and before the four lists
// while it is the latest, and its one item in the Status line's tail; its
// parts in order; what it says of the merge and of where the two sides meet,
// against the files; the moved pin against its file; its figures, which must
// agree with each other, the unit figure read from this file's own count of
// cases; and the plain-language rules over what the block wrote. No line here
// reads how a switch ships.
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
const PREVIOUS = '### WS09 checkpoint W: the review of the whole and its fixes'
const BLOCK = '### Checkpoint W: WS09 main taken in a third time, after who may send'
const LISTS = '### WS09 decisions'
const block = part(BLOCK)
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = ws09.split('\n').filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS) - 1] === BLOCK
const statusLine = ws09.split('\n').find((l) => l.startsWith('**Status:**')) ?? ''

const SELF = 'test/unit/redesign-status-ws09-w-takes-main-3.test.ts'
const GOLD = 'test/unit/goldText.test.ts'
const PAGE = 'functions/api/clubs/[id]/page.ts'
/** The one file whose assertion moved, with its count of cases. */
const MOVED: ReadonlyArray<readonly [string, number]> = [['test/unit/redesign-status-ws09-w-review.test.ts', 16]]
/** This step's own item in the Status line's tail. */
const ITEM = '`main` taken in a third time after who may send'
const HELD = [
  'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/pages/AdminNewsletterPage.tsx', 'src/components/layout/', 'src/areas/admin/newsletter/', 'functions/utils/mail/',
  'domain/mail/', 'workers/daily-emails/', 'src/lib/nav.ts', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts', 'test/a11y/signedIn.ts', 'test/integration/harness.ts',
]
const num = (text: string) => Number(text.replace(/,/g, ''))
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])

describe('REDESIGN_STATUS.md, checkpoint W: main taken in a third time, after who may send', () => {
  it('sits once, right after the block of checkpoint W\'s review, before the four lists while it is the latest, with its one item in the Status line\'s tail', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS)
    const tail = statusLine.slice(statusLine.lastIndexOf('; ') + 2)
    expect(tail.split(ITEM)).toHaveLength(2)
    expect(tail).toContain(`checkpoint W's review and its fixes, ${ITEM}, `)
    if (latest) expect(tail).toContain(`${ITEM}, K's answers to checkpoint S's review`)
    expect(tail).toMatch(/\bbuilt\.$/)
  })

  it('opens with why in one sentence, and has every part in order', () => {
    const opening = block.split('\n')[2] ?? ''
    expect(opening.split(/\.\s/).length).toBe(1)
    for (const piece of ['after the saved templates', 'who may send email to members', 'a third time', 'the tree that would merge']) expect(opening, piece).toContain(piece)
    const parts = ['- **What the merge holds.**', '- **Where the two meet.**', '- **What the merged tree asked.**', '- **Pins moved.**', '- **What ships with every switch off.**', '- Checks:', '- **Files.**', '- **Branch.**']
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })
})

describe('REDESIGN_STATUS.md, checkpoint W taking main in a third time: the parts against the files', () => {
  it('names the merge, its two parents by their subjects, the common commit, the two files both sides changed and how nothing was dropped', () => {
    const holds = bullet(block, '- **What the merge holds.**')
    for (const piece of [
      '`0dd8d9b`, "Merge main into redesign/ws09-clubs-w"', '`04e4a48`, "WS09 checkpoint W: the review\'s fixes and the checkpoint\'s record"', 'draft pull request 154',
      '`7b38743`, "Who may send email to members: admins, the president and the media manager (#153)"', '`992b145`, "Newsletter page: saved templates, and the tutorial\'s first card (#150)"',
      '`main` has 2 commits', '`eef4265`', 'checkpoint W has 14', '`main` brings 42 files', 'No file met: git joined everything by itself', '`REDESIGN_STATUS.md` and `test/unit/goldText.test.ts`',
      'Nothing of either side was dropped', '`git diff --stat 04e4a48` ends "42 files changed, 1478 insertions(+), 229 deletions(-)"',
      '`git diff --stat 7b38743` ends "140 files changed, 18959 insertions(+), 121 deletions(-)"',
    ]) expect(holds, piece).toContain(piece)
    // Both sides' lines of the gold guard's one list stand while this block is the latest: main's three places, read by
    // their shape since their line numbers move with the mail page, and checkpoint W's status tag.
    if (latest) {
      const gold = read(GOLD)
      expect(gold.match(/'src\/pages\/AdminEmailPage\.tsx:\d+ <MultiSelectDropdown> on=light \(its default\) -> light'/g) ?? []).toHaveLength(3)
      expect(gold).toContain('`src/areas/clubs/components/ClubEvents.tsx:$' + '{clubEvents} <StatusBadge> on=light -> light`')
    }
    // The mail work's own block stands in its own section.
    expect(status).toContain('\n#### WS16 part two: who may send\n')
    expect(ws09).not.toContain('\n#### WS16 part two: who may send\n')
  })

  it('says where the two meet, as the tree holds it, and that who may send brought no migration', () => {
    const meet = bullet(block, '- **Where the two meet.**')
    for (const piece of [
      'no file both sides changed', '`functions/utils/auth.ts`', '`functions/utils/admin/presidentSeat.ts`', '`functions/utils/events/creation.ts`', '`src/components/auth/RoleProtectedRoute.tsx`',
      '`src/areas/admin/roles.ts`', 'Checkpoint W\'s own lines read `main`\'s change in one place', `\`${PAGE}\``, 'imports `isResponse` and `requireClubRep`',
      '`requireMailer` and `requireListMailer`', '`presidentAdmitted`', '`sendsAsMediaManager`', 'the `LIST_MAILERS_ONLY` re-export', 'the comment on `canUseMailing`',
      '`requireAuthedMember`', 'are as they were', '`src/App.tsx`', '`ADMIN_PANEL_ROLES` and `WORKSPACE_ROLES`', '`src/components/layout/Navbar.tsx`', 'in lines checkpoint W did not touch',
      '`main` changed neither list, nor the route\'s props, nor the `Navbar`\'s, which takes none', 'No line `main` changed reads what checkpoint W changed', '`holdsPresidentSeat`',
      '`test/unit/goldText.test.ts` joined by itself', '752, 753 and 759 to 760, 761 and 767', 'the status tag of `src/areas/clubs/components/ClubEvents.tsx`', '"WS16 part two: who may send"',
      '`0072_regions_by_seat.sql` the newest', 'this step adds nothing to it',
    ]) expect(meet, piece).toContain(piece)
    expect(read(PAGE)).toContain('import { isResponse, requireClubRep } from \'../../../utils/auth\'')
    // What src/App.tsx imports from the three files main changed, while this block is the latest.
    if (latest) {
      const app = read('src/App.tsx')
      for (const line of [
        'import { RoleProtectedRoute } from \'@/components/auth/RoleProtectedRoute\'', 'import { ADMIN_PANEL_ROLES, WORKSPACE_ROLES } from \'@/areas/admin/roles\'',
        'import { Navbar } from \'@/components/layout/Navbar\'',
      ]) expect(app, line).toContain(line)
      expect(read('src/components/layout/Navbar.tsx')).toContain('export function Navbar() {')
    }
    const auth = read('functions/utils/auth.ts')
    for (const fn of ['export async function requireClubRep(', 'export function isResponse(', 'export async function requireMailer(', 'export async function requireListMailer(']) expect(auth, fn).toContain(fn)
    expect(read('functions/utils/admin/presidentSeat.ts')).toContain('export async function holdsPresidentSeat(')
    expect(read('functions/utils/events/creation.ts')).toContain('export { holdsPresidentSeat }')
    // None of checkpoint W's club files reads the President seat.
    for (const dir of ['functions/api/clubs', 'functions/api/clubs/[id]', 'functions/utils/clubs', 'src/areas/clubs/components']) {
      for (const name of readdirSync(join(ROOT, dir)).filter((n) => /\.tsx?$/.test(n))) expect(read(`${dir}/${name}`), `${dir}/${name}`).not.toContain('holdsPresidentSeat')
    }
    const migrations = readdirSync(join(ROOT, 'migrations')).filter((name) => /^\d{4}_/.test(name)).sort()
    if (latest) expect(migrations.at(-1)).toBe('0072_regions_by_seat.sql')
  })

  it('says what the merged tree asked, and names the moved pin by its file and its count, against its file', () => {
    const asked = bullet(block, '- **What the merged tree asked.**')
    for (const piece of ['unit 12,446 tests in 554 files, none failing', 'integration 3,511 that run in 191 files, none failing', 'with the one todo beside them', 'Anything else: none', 'No test of `main`\'s fails, and none is touched']) {
      expect(asked, piece).toContain(piece)
    }
    const pins = bullet(block, '- **Pins moved.**')
    for (const piece of ['for this step\'s own item in the Status line\'s tail', 'none for the merge', 'the one assertion and nothing else', 'no file\'s count of cases changes', 'with a one-line comment']) {
      expect(pins, piece).toContain(piece)
    }
    expect(subBullets(pins)).toHaveLength(MOVED.length)
    for (const [file, count] of MOVED) {
      expect(pins, file).toContain(`\`${file}\` (${count})`)
      expect(casesIn(file), file).toBe(count)
    }
    const review = read(MOVED[0][0])
    expect(review).toContain('    expect(tail).toContain(\'the new club page in the browser, `main` taken in again after the saved templates, checkpoint W\\\'s review and its fixes, \')')
    expect(review).not.toContain('checkpoint W\\\'s review and its fixes, K\\\'s answers')
  })

  it('says what ships with every switch off, and names every file it changes and the branch', () => {
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of [
      'What the first and second takings in say, and nothing more', 'Every switch is as `main` ships it', '`CLUB_PAGES_ON` and `newClubs` stay off', 'K\'s choice 8 (a)', '`GET /api/clubs/{slug}`',
      '`GET /api/clubs/:id/page`', '`main`\'s who may send is `main`\'s own, unchanged', 'This step adds no line of product', 'no migration, no table, no endpoint, no contract and no switch',
    ]) expect(off, piece).toContain(piece)
    const files = bullet(block, '- **Files.**')
    for (const file of [SELF, 'REDESIGN_STATUS.md']) expect(files, file).toContain(`\`${file}\``)
    expect(existsSync(join(ROOT, SELF))).toBe(true)
    expect(writtenCount(files, SELF)).toBe(casesIn(SELF))
    expect(files).toContain(`the ${['one', 'two', 'three'][MOVED.length - 1]} test file of Pins moved`)
    expect(files).toContain('this block and the Status line\'s tail')
    for (const piece of ['No product file is touched', 'No file the mail stream holds is touched', 'the two mail guards in `functions/utils/auth.ts`', ...HELD.map((f) => `\`${f}\``)]) {
      expect(files, piece).toContain(piece)
    }
    for (const piece of ['`redesign/ws09-clubs-w`', '`0dd8d9b`', 'pushed together']) expect(bullet(block, '- **Branch.**'), piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, checkpoint W taking main in a third time: the figures and the plain words', () => {
  it('gives each figure of the checks once, with checkpoint W\'s side beside it, the integration figure with the one todo named beside it', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run in the build', 'the worker\'s dry run ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(checkpoint W's side 13 and 11 over 1,368; `main` brings five new files and this step one\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![1])).toBe(1368 + 5 + 1)
    const unit = /unit ([\d,]+) tests in (\d+) files \(12,386 in 552 on checkpoint W's side; 12,446 in 554 joined, before this step's record test\), every one passing/.exec(checksLine)
    expect(unit, 'the unit figures').not.toBeNull()
    // The merged tree's run before any change, and this file's own cases added to it.
    expect(num(unit![1])).toBe(12446 + casesIn(SELF))
    expect(Number(unit![2])).toBe(554 + 1)
    expect(checksLine).toContain('integration 3,511 tests that run in 191 files (3,483 in 190 on checkpoint W\'s side), every one passing, with the one todo beside them, "a publish date is refused before approval", under "running the region\'s club events, with REGION_EVENTS_ON set" in `test/integration/club-events.test.ts`')
    const events = read('test/integration/club-events.test.ts')
    expect(events).toContain('describe(\'running the region\\\'s club events, with REGION_EVENTS_ON set\', () => {')
    // The todo stands while this block is the latest; once it is built, it is a case like any other.
    if (latest) expect(events).toContain('  it.todo(\'a publish date is refused before approval\')')
    const built = /`npm run build` \((\d+) files in `dist\/assets`, as on checkpoint W's side\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe('223')
    expect(checked?.[1]).toBe(built?.[1])
    for (const piece of [
      'a local production build', '`VITE_`', '`index-DVybkZf7.js` at 520,721 bytes', '`index-BSav8PcT.js` at 520,712', '`index-CGFkXpdq.css` at 171,910 bytes', '`features-BFUKrFdH.js` at 741 bytes',
      '680 passed and 337 skipped', '`a11y-on` 463 and 36', '`a11y-off` 199 and 301', '`a11y-clubs` 18 passed', '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched',
      'the worker\'s dry run not run in the build (76.61 KiB, gzip 20.53 KiB on checkpoint W\'s side)', 'no file under `workers/` differs from the common commit on either side',
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
    for (const file of [SELF, ...MOVED.map(([f]) => f)]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, NAMES, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })
})
