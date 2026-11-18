// test/unit/redesign-status-phase0-preview-notes.test.ts
//
// REDESIGN_STATUS.md, K's notes from the preview: the section "Phase 0: K's
// notes from the preview", the record's last, and the date line's date it
// moved. It reads that section and the date line, and holds six of the
// section's claims against the code itself: the seal's two circles, the
// About menu's last row, the header with no Donate slot, the chess title
// read from a note, the Champions entry with no class that starts with lg:,
// and the state list's opening words, kept as they were. Pinned here: the
// section's place, its Status, Branch and PR lines, its opening, K's answers
// of decision 72, its bullets in their order and the key words of each, the
// files with each unit test file's count in the record's form, the pins
// moved, what the gate still owes, the merge-pending phrase left on its one
// line, and the plain-language rules on all of it. It holds the new test's
// count by this file's own cases, and every other figure by its form or by
// the words the section gives it. Its banned patterns are built from split
// strings, so this file holds none of them, and it is plain ASCII.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CHESS_TITLE_SHORT, chessTitleOf } from '@/areas/events/champions'
import { ABOUT_FOOTER_ROW, ABOUT_ROWS, aboutMenu } from '@/lib/nav'

const ROOT = resolve(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')
const SELF = 'test/unit/redesign-status-phase0-preview-notes.test.ts'
/** A file of the repository, read as text. */
const code = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const sha256 = (text: string | Buffer) => createHash('sha256').update(text).digest('hex')

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, in the plural as well, and the words that name a person's role in the work. */
const BANNED = new RegExp(
  `\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'age' + 'nt', 'work' + 'flow', 'revi' + 'ewer', 'tes' + 'ter'].join('|')})s?\\b|${'the ' + 'lead'}`,
  'i',
)
/** Two more working words, read in the prose alone, since a test file's name in backticks can hold one of them as code. */
const WORKING = new RegExp(`\\b(${['age' + 'nt', 'mo' + 'del'].join('|')})s?\\b`, 'i')
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
/** The merge-pending phrase the trim's record test reads, of which the whole file holds one line. */
const PENDING = new RegExp(`checkpoint D's merge is ${'pen' + 'ding'}|merge into \`main\` is ${'pen' + 'ding'}`)
/** Any line saying a thing is still to come in those words, which this section never uses. */
const IS_PENDING = new RegExp(`is ${'pen' + 'ding'}`)
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const HEADING = "## Phase 0: K's notes from the preview"
const FIELDS = "## Phase 0: the News posts' links and fields"
const at = status.indexOf(`\n${HEADING}\n`)
const next = at < 0 ? -1 : status.indexOf('\n## ', at + 1)
/** This section, from its heading to the next "## " heading or the end of the file. */
const section = at < 0 ? '' : status.slice(at + 1, next < 0 ? undefined : next)
const lines = section.split('\n')
const dateLine = status.split('\n').find((l) => l.startsWith('Last updated:')) ?? ''

/** A bullet of the section and the indented lines under it. */
function bullet(start: string): string {
  const from = lines.findIndex((l) => l.startsWith(start))
  if (from < 0) return ''
  let end = from + 1
  while (end < lines.length && /^\s+\S/.test(lines[end])) end++
  return lines.slice(from, end).join('\n')
}
/** The sub-bullets of a bullet, each one line. */
const subs = (text: string) => text.split('\n').filter((l) => l.startsWith('  - '))
/** Every champion's row the migrations insert, where it is and its note, read by the column list of its insert. */
function championRows(): { at: string; note: string | null }[] {
  const rows: { at: string; note: string | null }[] = []
  for (const file of readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    let notesAt = -1
    code(`migrations/${file}`).split('\n').forEach((line, i) => {
      const insert = /\bINSERT\b.*\bINTO state_champions \(([^)]*)\)/i.exec(line)
      if (insert) notesAt = insert[1].split(',').map((c) => c.trim()).indexOf('notes')
      const row = insert ? line.slice(insert.index + insert[0].length).replace(/^\s*VALUES\s*/i, '') : line
      if (notesAt >= 0 && /^\s*\(/.test(row)) {
        const values = [...row.matchAll(/'((?:[^']|'')*)'|NULL|-?\d+/g)].map((m) => (m[0] === 'NULL' ? null : (m[1] ?? m[0]).replace(/''/g, "'")))
        rows.push({ at: `${file} line ${i + 1}`, note: values[notesAt] ?? null })
      }
      if (/;\s*$/.test(line)) notesAt = -1
    })
  }
  return rows
}
/** Text with what sits in backticks taken out, since code is not prose. */
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

const BULLETS = [
  '- **K\'s answers, decision 72.**', '- **The seal.**', '- **Donate.**', '- **The Champions page.**', '- **What a visitor meets, by width and look.**', '- **What ships with every switch off.**',
  '- **Where it differs from the brief and the boards.**', '- **The earlier lines it overtakes.**', '- **Follow-ups.**', '- **Files.**', '- **Pins moved.**',
  '- **Build.**', '- **Lint.**', '- **The browser run.**', "- **The pull request's text.**", '- Checks:',
]

/** The unit test files this change changes or adds, each named in Files with its count of cases. */
const UNIT_TESTS = [
  'test/unit/heritage-ornaments.test.tsx', 'test/unit/champions-by-person.test.ts', 'test/unit/site-header.test.tsx', 'test/unit/site-header-edges.test.tsx',
  'test/unit/site-header-menus.test.tsx', 'test/unit/tablet-header.test.tsx', 'test/unit/nav.test.ts', 'test/unit/nav-model-edges.test.ts',
  'test/unit/chrome-bars-app.test.tsx', 'test/unit/chrome-bars-swap.test.tsx', 'test/unit/chrome-helper.test.tsx', 'test/unit/on-demand.test.tsx',
  'test/unit/on-demand-edges.test.tsx', 'test/unit/menu-sheet-edges.test.tsx', 'test/unit/champions-page.test.tsx', SELF,
]
/** The two new files. */
const NEW = ['test/unit/champions-page.test.tsx', SELF]
/** Every file this change touches: the code, the record, the stored page, the unit tests and the browser specs. */
const CHANGED = [
  'src/components/Seal.tsx', 'src/areas/events/champions.ts', 'src/pages/ChampionsPage.tsx', 'src/lib/nav.ts', 'src/components/layout/SiteHeader.tsx',
  'src/components/layout/AboutMenu.tsx', 'src/components/layout/MobileMenu.tsx', 'src/components/DonateButton.tsx', 'REDESIGN_STATUS.md',
  'test/unit/fixtures/heritage-pages-today.ts', ...UNIT_TESTS, 'test/a11y/heritage.spec.ts', 'test/a11y/nav.spec.ts', 'test/a11y/nav-bars-edges.spec.ts',
  'test/a11y/seeded-data.spec.ts',
]
/** The two unchanged unit test files the section names as passing with the new code. */
const UNCHANGED = ['test/unit/heritage-layout.test.tsx', 'test/unit/goldText.test.ts']

describe('REDESIGN_STATUS.md, K\'s notes from the preview: where the section stands and what it opens with', () => {
  it('is one section, straight after the News posts\' links and fields\' section, the last of the file, with no subsection and no table of its own', () => {
    expect(status.split(`\n${HEADING}\n`)).toHaveLength(2)
    const fields = status.indexOf(`\n${FIELDS}\n`)
    expect(fields).toBeGreaterThan(0)
    expect(at).toBeGreaterThan(fields)
    expect(status.slice(fields + FIELDS.length + 2, at)).not.toMatch(/\n## /)
    expect(next).toBe(-1)
    expect(lines.filter((l) => l.startsWith('#'))).toEqual([HEADING])
    expect(lines.filter((l) => l.startsWith('|'))).toEqual([])
  })

  it('opens with its status, branch and pull request: built on Tuesday, November 17, 2026 from ccf65c3, the pull request not opened yet or a draft, and not merged yet', () => {
    expect(lines[1]).toBe('')
    expect(lines[2]).toBe('**Status:** built on branch `redesign/preview-notes` on Tuesday, November 17, 2026, from `ccf65c3`, the merge of pull request 132; not merged yet.')
    expect(lines[3]).toBe('**Branch:** `redesign/preview-notes`, cut from `main` at `ccf65c3` on Tuesday, November 17, 2026.')
    // Until the draft is opened its number is not known; once it is, the line gives it in the form the News posts' sections use.
    const NOT_OPENED = '**PR:** not opened yet: a draft pull request is opened from this branch once the gate has passed; not merged yet.'
    const OPENED = new RegExp(`^\\*\\*PR:\\*\\* draft pull request \\d+, opened from this branch on (?:${WEEKDAYS.join('|')}), (?:${MONTHS.join('|')}) \\d{1,2}, \\d{4}; not merged yet\\.$`)
    expect(lines[4] === NOT_OPENED || OPENED.test(lines[4] ?? ''), lines[4]).toBe(true)
  })

  it('gives the date line the build day or a later one, its pinned start and end and the trim\'s piece kept', () => {
    expect(status.split('\n').filter((l) => l.startsWith('Last updated:'))).toHaveLength(1)
    expect(dateLine).toMatch(/^Last updated: \S+ \(WS01, step 32: /)
    expect((/^Last updated: (\d{4}-\d{2}-\d{2}) /.exec(dateLine)?.[1] ?? '') >= '2026-11-17').toBe(true)
    expect(dateLine.endsWith('step 1: record and brief 1.4)')).toBe(true)
    expect(dateLine).toContain('the Phase 0 public-answer trim is built on its own branch from step 9 and not merged yet')
  })

  it('opens on K\'s three notes, their two decisions and K\'s answers of decision 72, only the Champions page changing with every switch off, and K\'s yes before the merge', () => {
    const opening = lines[6] ?? ''
    for (const piece of [
      'A change of its own, outside the workstreams', 'the throwaway preview `preview-switches` on Monday, November 16, 2026',
      'decisions 68 and 70 of `docs/redesign/ws16-k-decisions.md` on the branch `redesign/docs-phase2`', 'K\'s "for ring 1"', 'K\'s "for donate 1", both decision 68',
      'to the right of the name from a computer\'s width and under it below that', '"FM Nicholas Matta"', 'K\'s "do 2 for the champions page fix", decision 70',
      'K\'s answers of Tuesday, November 17, 2026 to the pictures of this change, decision 72 of the same file, keep all of that but where the years sit',
      'they run in a row of their own under the name and its summary at every width.',
      'With every switch off only the Champions page changes, for every visitor in both looks', 'the seal is drawn only with `themeHeritage` and `newLook` on',
      'the new header only with `newNav` and `newLook` on', 'brief 0.2 asks K\'s yes before the merge (Q34), and the merge waits for K\'s word.',
    ]) expect(opening, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, K\'s notes from the preview: what it records, and the code it names', () => {
  it('holds its sixteen bullets in order, each once, its Checks line last, and nothing after the opening but bullets, the lines under them and the quoted text', () => {
    const places = BULLETS.map((name) => section.indexOf(`\n${name}`))
    for (const [i, name] of BULLETS.entries()) {
      expect(places[i], name).toBeGreaterThan(-1)
      expect(lines.filter((l) => l.startsWith(name)), name).toHaveLength(1)
    }
    expect([...places].sort((a, b) => a - b)).toEqual(places)
    expect(section.trimEnd().split('\n').at(-1)!.startsWith('- Checks:')).toBe(true)
    const first = lines.findIndex((l) => l.startsWith('- **'))
    expect(first).toBe(8)
    for (const l of lines.slice(first).filter((l) => l !== '')) expect(/^(?:- | {2}- | {2}>(?: |$))/.test(l), l).toBe(true)
  })

  it('records K\'s answers of Tuesday, November 17, 2026 as decision 72: K\'s words as written, the six choices in order, one clause each, why the opening words stay, and the page still writes them', () => {
    const answers = bullet('- **K\'s answers, decision 72.**')
    expect(answers.split('\n')).toHaveLength(1)
    for (const piece of [
      'went to K on Tuesday, November 17, 2026 at 8:31 AM UTC', 'K answered the same day at about 2:25 PM UTC',
      ': "2. Let\'s make them all look like the one does in 900 pixels wide where the years of championship is its own line. Rest as recommended." So:',
      'where decision 70 and this change\'s first commit put them to the right of the name from 1024 pixels',
      'for one reason only, that from 1024 pixels the titles sat to the right of the name', 'so the words are true as they stand and are kept',
      'K is told so in plain words and can still ask for the other words',
    ]) expect(answers, piece).toContain(piece)
    const CHOICES = [
      ' 1, the seal keeps its one thin gold ring, the outer one, as drawn;',
      ' 2, on the Champions page a champion\'s years run in a row of their own under the name and its summary at every width, as the page drew them at 900 pixels,',
      ' 3, the reigning champion\'s card stays as it is;', ' 4, on a tablet Donate stays the first of the Menu drawer\'s buttons;',
      ' 5, the state list\'s opening words, "A champion who won more than once has each title under their name.", stay exactly as they are;',
      ' and 6, a heading copied from the page is left as it is, for the screen reader\'s sake.',
    ]
    const places = CHOICES.map((choice) => answers.indexOf(choice))
    for (const choice of CHOICES) expect(answers.split(choice), choice).toHaveLength(2)
    expect([...places].sort((a, b) => a - b)).toEqual(places)
    // The opening words that stay, as the state list still writes them.
    expect(code('src/pages/ChampionsPage.tsx')).toContain('A champion who won more than once has each title under their name."')
  })

  it('records the one ring kept, and the seal draws it: two circles, the disc at r 49 and the ring at r 45.5 with a line of 1.25, the inner ring gone', () => {
    const seal = bullet('- **The seal.**')
    for (const piece of [
      '`src/components/Seal.tsx` draws two circles where it drew three', 'r 49 in its 100-unit box, `fill-brand-navy`', 'r 45.5 with a line of 1.25, `stroke-lca-gold`',
      'the outer of the board\'s two rings', 'the inner ring, r 30 with a line of 1, is gone', '`translate(32.3 32) scale(0.34)`', '`size-16`',
      'as K chose on the preview on Monday, November 16, 2026', 'about 59 pixels across, with a line of 0.8 pixels', 'About, Board, Bylaws, Minutes, Annual meeting and Champions',
      'the hero has no aside of its own', '`hidden sm:block` in `src/components/PageHero.tsx`', 'never below 640 pixels, a phone held upright',
    ]) expect(seal, piece).toContain(piece)
    const src = code('src/components/Seal.tsx')
    const circles = src.match(/<circle\b[^>]*>/g) ?? []
    expect(circles).toHaveLength(2)
    expect(circles.map((c) => /\br="([\d.]+)"/.exec(c)?.[1])).toEqual(['49', '45.5'])
    expect(circles[0]).toContain('fill-brand-navy')
    expect(circles[1]).toContain('strokeWidth="1.25"')
    expect(circles[1]).toContain('stroke-lca-gold')
    expect(src).toContain('translate(32.3 32) scale(0.34)')
    expect(code('src/components/PageHero.tsx')).toContain('<Seal className="hidden sm:block" />')
  })

  it('records Donate as the About menu\'s last row and in no bar, and the code agrees: the menu ends with Donate above the Facebook row, and the header has no Donate slot', () => {
    const donate = bullet('- **Donate.**')
    for (const piece of [
      '`aboutMenu()` in `src/lib/nav.ts` takes no argument and always gives the seven rows, then Donate', '`headerUtilities` keeps Donate first',
      'the footer reads its join slot from it', 'draws no Donate in its row in either form, at any width', 'the squeeze keeps one step', '`Level` is `0 | 1`',
      'drops its `squeezed` choice', 'puts the focus on the About button before the dialog is asked for', 'the page\'s body never holds the focus',
      'About for the About menu\'s row and Menu for the drawer\'s', 'closed once the window has narrowed to 1023', 'gives it to Menu, never to the page\'s body',
      'a link to `/give`', '`src/components/DonateButton.tsx`', '`src/components/layout/MobileMenu.tsx`', 'no other line of either changes',
    ]) expect(donate, piece).toContain(piece)
    const menu = aboutMenu()
    expect(menu.rows.at(-1)).toBe('donate')
    expect(menu.rows).toEqual([...ABOUT_ROWS, 'donate'])
    expect(menu.footer).toBe(ABOUT_FOOTER_ROW)
    const header = code('src/components/layout/SiteHeader.tsx')
    expect(header).not.toContain('site-header-donate')
    expect(header).toContain('type Level = 0 | 1')
    expect(code('src/components/layout/AboutMenu.tsx')).not.toMatch(/\bsqueezed\b/)
  })

  it('records the Champions page, its entry with no class that starts with lg:, and the code reads the title K\'s example names from the data the migrations hold, and no other note', () => {
    const page = bullet('- **The Champions page.**')
    for (const piece of [
      '`CHESS_TITLES`', '`CHESS_TITLE_SHORT`', 'GM, IM, FM, CM, NM, WGM, WIM, WFM and WCM', '`chessTitleOf(note)`', 'in any letter case and with its spaces tidied',
      '"FM" alone, "FIDE Master, co-champion", a tiebreak or a section records none', '`chessTitle`, from their newest win on that list whose note records one',
      'every win keeps its note as written', 'then the wins in one list across, under them at every width', 'the column keeps its classes at `ccf65c3`, `min-w-0 flex-1`',
      'no class of the entry starts with `lg:`, so no width draws the wins beside the name (decision 72)',
      'an `abbr` hidden from screen readers', 'a sighted visitor reads "FM Nicholas Matta"', 'the heading\'s accessible name is "FIDE Master Nicholas Matta"',
      'any other note stays with its own year', 'a note that is not a title on its own line under the name',
      '`migrations/0056_champions_import.sql` line 23', '2025, 2024, 2023, 2022 and 2020', '`migrations/0058_state_champion_2026.sql` line 14',
      'lines 168, 169, 173, 179 and 180', 'No read of production\'s database was made.',
    ]) expect(page, piece).toContain(piece)
    expect(chessTitleOf('FIDE Master')).toBe('FIDE Master')
    expect(CHESS_TITLE_SHORT['FIDE Master']).toBe('FM')
    for (const note of ['FM', 'FIDE Master, co-champion', 'tiebreaks over Player Six', '', null]) expect(chessTitleOf(note), String(note)).toBeNull()
    // The entry as the source writes it, from its list item to the end of the list: the text column has the classes it had at
    // ccf65c3, and no class in the entry starts with lg:, so no width draws the wins beside the name.
    const source = code('src/pages/ChampionsPage.tsx')
    const from = source.indexOf('<li key={e.anchor}')
    expect(from).toBeGreaterThan(0)
    const entrySource = source.slice(from, source.indexOf('</ol>', from))
    const classes = [...entrySource.matchAll(/className="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/))
    expect(classes).toContain('flex-wrap')
    expect(classes.filter((c) => c.startsWith('lg:'))).toEqual([])
    expect(entrySource).not.toMatch(/\blg:/)
    expect(entrySource).toContain('<div className="min-w-0 flex-1">')
    expect(section).not.toMatch(/20rem|lg:[\w[]/)
    // The rows the section reads from: Matta's title, the 2026 champion with no note.
    const m56 = code('migrations/0056_champions_import.sql').split('\n')
    expect(m56[22]).toContain("2025, 'Louisiana State Champion', 'Nicholas Matta', 'FIDE Master'")
    expect(code('migrations/0058_state_champion_2026.sql').split('\n')[13]).toContain("'Dr. Robert Forney', NULL")
    // Every note the migrations hold, read through chessTitleOf: six notes, Matta's the one read as a
    // title, and the five scholastic notes at the lines the section gives, which read none; no
    // migration changes a note once it is written.
    const rows = championRows()
    expect(rows.length).toBeGreaterThan(150)
    expect(rows.filter((r) => r.note !== null).map((r) => r.at)).toEqual(
      [23, 168, 169, 173, 179, 180].map((n) => `0056_champions_import.sql line ${n}`),
    )
    expect(rows.filter((r) => chessTitleOf(r.note) !== null).map((r) => `${r.at}: ${r.note}`)).toEqual(['0056_champions_import.sql line 23: FIDE Master'])
    for (const file of readdirSync(join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql'))) {
      expect(code(`migrations/${file}`), file).not.toMatch(/\bUPDATE\s+state_champions\b[^;]*\bnotes\s*=/i)
    }
  })

  it('says what a visitor meets at each width and in each look, and what ships with every switch off', () => {
    const meets = bullet('- **What a visitor meets, by width and look.**')
    const WIDTHS = ['  - On a computer, 1024 pixels and wider:', '  - On a tablet, 768 to 1023 pixels', '  - On a phone, below 768 pixels:', '  - The seal, with `themeHeritage` and `newLook` on:', '  - In each look:']
    expect(subs(meets).map((l) => WIDTHS.findIndex((w) => l.startsWith(w)))).toEqual([0, 1, 2, 3, 4])
    for (const piece of [
      'Read from the code, every switch off but where a switch is named.', 'never Donate', 'State champions, Contact and Donate, then LCA on Facebook',
      'on the Champions page each champion\'s years run across in a row of their own under the name and its summary, as on a tablet',
      'never marked "You are here"', 'About, ArrowUp twice and Enter', 'the focus is back on About when it closes',
      '892.5 pixels signed out, 825.4 as an active member and 908.8 as an expired member', 'with 83.5, 150.6 and 67.2 to spare',
      'a phone on its side at 844 or 812 among them', 'five controls, the brand link, Tournaments, Clubs, Log in or My LCA, and Menu, where it held six',
      'the first of the drawer\'s buttons, two taps away', 'the focus back on Menu', 'the years wrap under the name', 'no seal below 640',
      'today\'s look, which production keeps, changes on the Champions page alone', 'an admin among them',
    ]) expect(meets, piece).toContain(piece)
    const ships = bullet('- **What ships with every switch off.**')
    for (const piece of [
      'The Champions page, for every visitor in both looks, from the merge.', 'The seal and Donate ship as code alone', '`src/components/PageHero.tsx`, its one importer',
      '`src/components/layout/Navbar.tsx`', '`src/lib/features.ts` is not touched', 'no file under `functions/`, `domain/`, `workers/` or `migrations/` changes',
      'there is no migration', 'the daily-emails worker is not deployed again',
    ]) expect(ships, piece).toContain(piece)
    // The seal's one importer, as the section says: every code file under src/ that imports it, by any path.
    const importers = readdirSync(join(ROOT, 'src'), { recursive: true, encoding: 'utf8' })
      .filter((path) => /\.tsx?$/.test(path) && /(?:from |import\()['"][^'"]*\/Seal['"]/.test(code(`src/${path}`)))
      .sort()
    expect(importers).toEqual(['components/PageHero.tsx'])
  })

  it('names where it differs from the brief and the boards, the brief left as it is, and the earlier lines it overtakes, each still in the record as written', () => {
    const differs = bullet('- **Where it differs from the brief and the boards.**')
    for (const piece of [
      '`docs/redesign/decided-boards/Looks-Applied.dc.html` lines 479 to 486', '`docs/redesign/REDESIGN_SPEC.md` line 259', '"on a navy disc inside two gold rings"',
      'line 585 and line 684, WS02 AC1', 'line 587', 'line 689, WS02 AC6, and line 2707, WS12 AC6', '`docs/redesign/DESIGN_REPLAN_phase0.md` line 278',
      'the one place K\'s "at every width" could not be met as said', '`test/unit/redesign-status-ws02-step1.test.ts`', '`test/unit/redesign-status-ws02-step1-claims.test.ts`',
      'the brief\'s next revision carries these',
    ]) expect(differs, piece).toContain(piece)
    // The brief's sha256 the section gives is the brief's own, and the line it quotes still says so.
    const hash = /`([0-9a-f]{64})`/.exec(differs)?.[1]
    expect(hash).toBe(sha256(code('docs/redesign/REDESIGN_SPEC.md')))
    expect(code('docs/redesign/REDESIGN_SPEC.md').split('\n')[258]).toContain('on a navy disc inside two gold rings')
    const overtakes = bullet('- **The earlier lines it overtakes.**')
    for (const piece of [
      'Named by heading and left as written', '"Step 31: the heritage layout on its six pages"', '"The ornaments."',
      '"The seal is the board\'s navy disc and two gold rings with the rook"', '"Verify items resolved"', 'the map\'s "AC6."', '"The squeeze."', '"The tablet header."',
      '"The squeeze reads the row\'s natural width"', '"The tablet header is the new header\'s narrower form"', '"From v1.1: the squeeze"', '"The widest row"', '"The tablet row"',
      '"Search in the row"', '"The widest row and the rings as drawn"', '"Search in the tablet header and the app bar"', 'with 22.6 to spare',
    ]) expect(overtakes, piece).toContain(piece)
    const all = status.split('\n')
    for (const head of [
      '- **The ornaments.**', '  - The seal is the board\'s navy disc and two gold rings with the rook', '- **AC6.** Donate in one click on tablet', '- **The squeeze.**',
      '- **The tablet header.**', '- **The squeeze reads the row\'s natural width (WS02 step 5).**', '- **The tablet header is the new header\'s narrower form (WS02 step 6).**',
      '- **From v1.1: the squeeze (WS02 step 5).**', '- **The widest row (WS02 step 5).**', '- **The tablet row (WS02 step 6).**', '- **Search in the row (WS02 step 5).**',
      '- **The widest row and the rings as drawn (WS02 step 5).**', '- **Search in the tablet header and the app bar (WS02 step 6).**',
    ]) expect(all.filter((l) => l.startsWith(head)), head).toHaveLength(1)
  })

  it('gives its four follow-ups: the preview\'s champions, the Polgar photo, the admin\'s form and what is left for K, with nothing K has answered still asked', () => {
    const items = subs(bullet('- **Follow-ups.**'))
    expect(items).toHaveLength(4)
    const pieces = [
      ['The preview database holds an older champions import', 'Nicholas Matta\'s 2022 to 2024 rows are missing there and four 2011 rows are wrong', 'needs K\'s yes by name', 'a local database built from the migrations alone', '"Fixture State Champion" (`scripts/seed/fixtures.sql` lines 182 to 188)'],
      ['K\'s data question, outside this change', 'the 2009 Polgar representative\'s row uses the 2009 Denker representative\'s photo', '`migrations/0056_champions_import.sql` lines 183 and 184', 'Nothing here changes it.'],
      ['`src/areas/admin/components/ChampionsPanel.tsx`', '"5.5/6"', '(line 114)', '"at their first win" (line 120)', 'now shows before the name'],
      [
        'For K:', 'US Chess\'s other master titles', '"FM" finds nobody in Find a name', 'no plain companion on the screen', 'the form K picked', 'shows its year twice',
        'Answered in decision 72: a heading copied from the page', '"FMFIDE Master Nicholas Matta"', 'is left as it is, for the screen reader\'s sake.',
      ],
    ]
    for (const [i, words] of pieces.entries()) for (const piece of words) expect(items[i], piece).toContain(piece)
    // What decision 72 answered is asked no more: the tablet's Donate, the three defaults and the opening words.
    for (const asked of ['K confirms', 'right column', 'keep or reword']) expect(items.join('\n'), asked).not.toContain(asked)
  })
})

describe('REDESIGN_STATUS.md, K\'s notes from the preview: files, pins and what the gate owes', () => {
  it('names every changed and new file once, each unit test file with its count in the record\'s form, the new record test with this file\'s own count', () => {
    const files = bullet('- **Files.**')
    for (const file of [...CHANGED, ...UNCHANGED]) expect(files.split(`\`${file}\``), file).toHaveLength(2)
    expect(files.match(/`[^`\s]+\.(?:ts|tsx|md)`/g)).toHaveLength(CHANGED.length + UNCHANGED.length)
    const counts = new Map<string, RegExpExecArray>()
    for (const file of [...UNIT_TESTS, ...UNCHANGED]) {
      const m = new RegExp(`\`${escaped(file)}\` \\((\\d+), (?:(\\d+) before|(as before)|(new))[:)]`).exec(files)
      expect(m, file).not.toBeNull()
      expect(Boolean(m![4]), `${file} is new`).toBe(NEW.includes(file))
      counts.set(file, m!)
    }
    // The new record test's count is this file's own number of cases.
    const own = (code(SELF).match(/^\s*it\(/gm) ?? []).length
    expect(Number(counts.get(SELF)![1])).toBe(own)
    for (const file of UNCHANGED) expect(counts.get(file)![3], file).toBe('as before')
    // The browser specs are named by what changed in their tests, their figures the run's.
    expect(files).toContain('`test/a11y/nav.spec.ts` (one test more on each build, the drawer\'s Donate at 900 pixels, which runs on a11y-on and is skipped on a11y-off;')
    for (const spec of ['test/a11y/heritage.spec.ts', 'test/a11y/nav-bars-edges.spec.ts', 'test/a11y/seeded-data.spec.ts']) expect(files, spec).toContain(`\`${spec}\` (no test added or removed:`)
  })

  it('lists each pin moved under its file, the stored page\'s old and new values, and says no record test\'s pin moves', () => {
    const items = subs(bullet('- **Pins moved.**'))
    expect(items).toHaveLength(10)
    for (const file of ['test/unit/heritage-ornaments.test.tsx', 'test/a11y/heritage.spec.ts', 'test/unit/fixtures/heritage-pages-today.ts', 'test/unit/menu-sheet-edges.test.tsx', 'test/unit/goldText.test.ts']) {
      expect(items.filter((l) => l.startsWith(`  - \`${file}\`:`)), file).toHaveLength(1)
    }
    const pins = items.join('\n')
    for (const words of [
      'three circles, r 49, 45.5 and 30, are now two, r 49 and 45.5', 'two of brand gold on no fill, are now one',
      '10371 and `332b30c247f6297030e31b6ce4121918d3c881b74a911242f372db7df5bd4919`', 'are now 10430 and `8a8410b37bc482e79cc639dd818a4afdcb76e35af74be5063683c0361be337dc`',
      'from lines 40, 41, 52 and 53 to 43, 44, 55 and 56', 'the squeeze\'s levels go from 0, 1 and 2 to 0 and 1', 'the About menu\'s rows gain Donate before the Facebook row',
      'leaves it for Log in', 'goes to About, or to Menu at 1023', '`squeezed={false}` dropped', 'from six to five', 'from seven stops to six', 'the row\'s steps from two to one',
      'stay at 74, 104, 154 and 183', 'No record test\'s pin moves',
    ]) expect(pins, words).toContain(words)
    // The stored page's new values are the fixture's, at the lines the section gives.
    const fixture = code('test/unit/fixtures/heritage-pages-today.ts').split('\n')
    for (const n of [43, 44, 55, 56]) expect(fixture[n - 1], `line ${n}`).toContain("{ length: 10430, sha256: '8a8410b37bc482e79cc639dd818a4afdcb76e35af74be5063683c0361be337dc' }")
  })

  it('says the build, the lint and the browser run as done here or owed to the gate, with the baseline\'s sha256, and gives the pull request\'s text', () => {
    const build = bullet('- **Build.**')
    for (const piece of [
      'Not run for this record', 'is owed', 'the base\'s 206 files', 'no file is added under `src/`', 'the stylesheet holds one rule more than at `ccf65c3`, `no-underline`',
      '`deploy-worker.yml` does not run on the merge',
    ]) expect(build, piece).toContain(piece)
    const lint = bullet('- **Lint.**')
    for (const piece of ['`npx eslint` on the 29 code and test files this change touches found nothing', '`npx tsc --noEmit -p tsconfig.app.json` found nothing', 'The gate\'s `npm run lint` is owed', 'the base\'s 13 errors and 12 warnings', 'over 1,129 files']) {
      expect(lint, piece).toContain(piece)
    }
    const browser = bullet('- **The browser run.**')
    for (const piece of [
      'Not run for this record', 'is owed', '997 tests, 660 that run and 337 that skip', 'the base\'s 995, 659 and 336', 'the drawer\'s Donate at 900', 'clean under axe in the five looks at 1280 and 390',
      'at 1280 and at 900 pixels that Dex Webster\'s scholastic wins sit under the name\'s summary, starting where the name starts, never to its right',
    ]) {
      expect(browser, piece).toContain(piece)
    }
    const BASELINE = 'ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef'
    expect(browser).toContain(BASELINE)
    expect(sha256(readFileSync(join(ROOT, 'test/a11y/baseline.json')))).toBe(BASELINE)
    const pr = bullet("- **The pull request's text.**").split('\n')
    expect(pr[1]).toBe("  > Phase 0: K's notes from the preview")
    const quoted = pr.slice(1)
    for (const l of quoted) expect(l.startsWith('  >'), l).toBe(true)
    const headings = quoted.filter((l) => /^ {2}> \*\*[^*]+\*\*$/.test(l)).map((l) => l.slice(4))
    expect(headings).toEqual(['**What this is**', '**What the merge does to production**', '**What K does before and after**', '**Checks**', '**What comes after**'])
    const text = quoted.join('\n')
    for (const piece of [
      '"for ring 1"', '"for donate 1"', '"do 2 for the champions page fix", decision 70', 'Only the Champions page changes, for every visitor', '"FIDE Master Nicholas Matta"',
      '(decision 72), so the second commit puts them in a row of their own under the name at every width', 'K answered the six choices on Tuesday, November 17, 2026 (decision 72)',
      'K looks at the new pictures of the Champions page', 'Left for the gate\'s figures', 'revert this change\'s merge commit',
    ]) {
      expect(text, piece).toContain(piece)
    }
    expect(text).not.toMatch(/right column|four defaults|From 1024 pixels/)
  })

  it('gives the Checks line: the runs by name and the record\'s readers done, eslint and the app\'s type check clean, and the gate with its one browser run owed', () => {
    const checks = lines.find((l) => l.startsWith('- Checks:')) ?? ''
    expect(checks).toMatch(/the sixteen unit test files this change changes or adds, run by name three at a time, [\d,]+ tests, every one passing/)
    expect(checks).toMatch(/every unit test file that reads this record, [\d,]+ tests in \d+ files, every one passing/)
    for (const piece of ['`npx eslint` on every code and test file it changes found nothing', '`npx tsc --noEmit -p tsconfig.app.json` found nothing', 'Owed to the gate, run alone on the machine']) {
      expect(checks, piece).toContain(piece)
    }
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', '`npm run test:all`', '`npm run test:a11y`']) {
      expect(checks.split(piece), piece).toHaveLength(2)
    }
    expect(checks).toContain('`test/a11y/baseline.json` unchanged')
    // Main brought in before the gate: said once, at the line's end, with where the gate's own figures are.
    expect(checks.endsWith("`main` at `498ec7f`, with pull requests 133 and 134, was merged into the branch on Wednesday, November 18, 2026, no file meeting; the gate's figures, taken on the merged tree, are in the pull request's text.")).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, K\'s notes from the preview: plain words', () => {
  it('keeps the dashes, the working words, any tool\'s name, a session\'s link, the old initials, unfilled marks, a pending phrase and a he out of the section', () => {
    expect(section.length).toBeGreaterThan(1000)
    for (const rule of [DASHES, BANNED, TOOLS, BARE, SESSION, OLD_INITIALS, UNFILLED, IS_PENDING]) expect(section).not.toMatch(rule)
    expect(proseOf(section)).not.toMatch(HE)
    expect(proseOf(section)).not.toMatch(WORKING)
    expect(section).not.toMatch(/\.github\//)
    // A step is named as "WS02 step 5", never in the bare form the WS01 record tests collect.
    expect(section).not.toMatch(/\(step \d+[;),]/)
    // US Chess written out where it is named.
    expect(section).toContain('US Chess\'s other master titles')
  })

  it('gives every date the weekday it falls on and every time the twelve-hour clock', () => {
    const text = proseOf(section)
    const found = [...text.matchAll(new RegExp(`\\b(?:${MONTHS.join('|')}) \\d{1,2}\\b`, 'g'))]
    expect(found.length).toBeGreaterThan(5)
    for (const m of found) expect(text.slice(Math.max(0, (m.index ?? 0) - 11), m.index), m[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    for (const [whole, weekday, month, day, year] of text.matchAll(new RegExp(`\\b(${WEEKDAYS.join('|')}), (${MONTHS.join('|')}) (\\d{1,2}), (\\d{4})`, 'g'))) {
      expect(WEEKDAYS[new Date(Date.UTC(Number(year), MONTHS.indexOf(month), Number(day))).getUTCDay()], whole).toBe(weekday)
    }
    for (const time of text.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })

  it('leaves the merge-pending phrase on the one line of the file that held it', () => {
    expect(status.split('\n').filter((l) => PENDING.test(l))).toHaveLength(1)
    expect(section).not.toMatch(PENDING)
  })
})
