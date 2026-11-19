// test/unit/redesign-status-ws09-event-page.test.ts
//
// REDESIGN_STATUS.md records, in the block "WS09 aside: the public event page
// on a phone", the small change K's decision 13, choice 2 a, asked for: the
// public page of one event no longer scrolls sideways on a phone, its
// sections box is the same named region in the tab order in both looks, its
// side card's Format row keeps a gap from its label, and the six places it
// named US Chess by the old initials now say US Chess. Like the
// other record tests of WS09, this file reads only the WS09 section, from its
// heading to the WS10 heading. Pinned here: the block, right after the clubs
// switch-on's block on main's tree and before the four lists while it is the
// section's latest; its opening and its parts in order; the one class, the
// box, the Format row and the six wordings against the page; the newer pages
// whose words it took; the look's widths, the box under the keyboard and the
// sheets; the other pages that still print the old initials, while it is the
// latest; the pins moved and the counts of the files they name, the two
// browser cases among them; the follow-ups, today's focus ring among them;
// the Status line; the figures of the Checks line;
// and the plain-language rules over what the block wrote. The old initials are put
// together from two pieces, so this file does not hold them, and no case
// reads or pins a switch's shipped value.
import { readFileSync } from 'node:fs'
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
const OLD = 'US' + 'CF'
const OLD_INITIALS = new RegExp(`\\b${OLD}\\b`)
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|[A-Z]+_(?:CASES|LINE|COUNT|TEXT|AFTER|FILES|TESTS|MORE)\\b|[${String.fromCharCode(0x27e6, 0x27e7)}]`)
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
const proseOf = (text: string) => text.replace(/`[^`\n]*`/g, '``')
const num = (text: string) => Number(text.replace(/,/g, ''))

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const MAIN = '### WS09 switch-on: on main\'s tree'
const BLOCK = '### WS09 aside: the public event page on a phone'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const prLine = lines.find((l) => l.startsWith('**PR:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === BLOCK

const SELF = 'test/unit/redesign-status-ws09-event-page.test.ts'
const PAGE = 'src/pages/TournamentDetailPage.tsx'
const PAGE_TEST = 'test/unit/event-page-phone.test.tsx'
const EDGES_TEST = 'test/unit/event-page-phone-edges.test.tsx'
const SWEEP = 'test/unit/sweep-fixes.test.tsx'
const STEP32 = 'test/unit/redesign-status-step32.test.ts'
const STEP1 = 'test/unit/redesign-status-ws09-step1.test.ts'
const BROWSER = 'test/a11y/scopes-edges.spec.ts'
const GRID = '<div className="grid grid-cols-1 gap-8 lg:grid-cols-3">'
const BOX = '<div className="mt-4 overflow-x-auto rounded-xl border" tabIndex={0} role="region" aria-label="Sections">'
const BOX_COMMENT = '{/* The box the table scrolls in is a named region in the tab\n                  order, so a keyboard can reach it and scroll it. */}'
const ROW = '<div className="flex justify-between gap-4">\n                    <dt className="text-muted-foreground">Format</dt>\n                    <dd className="text-right font-medium">'
/** The page as this aside left it, by its sha256, as the page's test pins it. */
const AS_LEFT_SHA256 = '962b8ad0684dc8f3c3256e9bfff024e162c095beb57a0509127d67853eb07080'
/** The six wordings as the page now holds them. */
const NEW_WORDS = [
  '>US Chess ID</span>',
  '\'This is a US Chess-rated tournament. Add your US Chess ID to your profile before registering.\'',
  '\'US Chess rated\'',
  'US Chess ID {player.uscf_id}',
  '\', US Chess-rated\'',
  'Add US Chess ID to your profile →',
]
/** The files whose cases moved in place, each with its count of cases, which this change keeps; the browser file once for each of its two cases. */
const MOVED: ReadonlyArray<readonly [string, number]> = [[SWEEP, 20], [STEP32, 25], [STEP1, 33], [BROWSER, 18], [BROWSER, 18]]
/** The two browser cases, each with its old and its new title. */
const BROWSER_TITLES: ReadonlyArray<readonly [string, string]> = [
  ['a11y-off: today\'s page is wider than a 390 pixel phone, and its sections box is no region', 'a11y-off: today\'s page too fits a 390 pixel phone, and its sections box is the same named region'],
  ['a11y-off: Tab after the heading passes the box by, as today', 'a11y-off: in today\'s look too Tab after the heading reaches the box'],
]
/** The follow-up this aside adds, in its own block. */
const RING = '- **Today\'s focus ring (WS09 aside: the event page).**'
/** The other files that still hold the old initials, with the count of their lines that do, as the block gives them. */
const STILL: ReadonlyArray<readonly [string, number]> = [
  ['src/areas/membership/components/UscfSearchInput.tsx', 10], ['src/pages/TournamentManagePage.tsx', 7], ['src/pages/DashboardPage.tsx', 6],
  ['src/pages/AboutPage.tsx', 5], ['src/areas/clubs/clubMapData.ts', 3], ['src/areas/admin/components/TournamentWizard.tsx', 3],
  ['src/pages/TournamentsPage.tsx', 2], ['src/areas/households/components/FamilyCard.tsx', 2], ['src/pages/ScholasticPage.tsx', 1],
  ['src/pages/RegisterPage.tsx', 1], ['src/pages/BylawsPage.tsx', 1], ['src/areas/households/components/FamilyRegistrationPanel.tsx', 1],
  ['src/areas/admin/components/MembersTable.tsx', 1], ['src/areas/governance/api.ts', 1], ['src/lib/features.ts', 1],
]

/** A test file's cases as its runner counts them: each plain `it(`, or in a browser spec each `test(`. */
const casesIn = (file: string) => (read(file).match(file.endsWith('.spec.ts') ? /^\s*test\(/gm : /^\s*it\(/gm) ?? []).length
/** Lines of a file that hold the old initials. */
const linesWithOld = (file: string) => read(file).split('\n').filter((l) => OLD_INITIALS.test(l)).length

describe('REDESIGN_STATUS.md, WS09 aside on the public event page: the block', () => {
  it('sits once, right after the clubs switch-on\'s block on main\'s tree, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    // Written straight after the clubs switch-on's block; with main taken in it stands after the blocks main gained since, the regions' last.
    expect([MAIN, '### WS09 aside: the regions by the five seats']).toContain(headings[headings.indexOf(BLOCK) - 1])
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
    expect(read(STEP1)).toContain('|WS09 aside: \\S|')
  })

  it('opens with what the page did and what the aside mends, in two sentences', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of ['`/tournaments/:id`', 'is live today', 'scrolled sideways', 'six places a person reads', `\`${PAGE}\` alone`, 'belongs to no checkpoint']) {
      expect(opening, piece).toContain(piece)
    }
    expect(opening.split(/\.(?: |$)/).filter(Boolean)).toHaveLength(2)
  })

  it('has every part, in order', () => {
    const parts = [
      '- **Asked by.**', '- **Branch.**', '- **What changed.**', '  - **The one class.**', '  - **The box.**', '  - **The Format row.**', '  - **The words.**', '- **What does not move.**',
      '- **What ships with every switch off.**', '- **The look.**', '- **Other pages that still print the old initials.**', '- **How it comes back out.**',
      '- **Pins moved.**', '- **Follow-ups.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('names who asked, when, and that K was told of two labels where the page held six', () => {
    const asked = bullet(block, '- **Asked by.**')
    for (const piece of ['K\'s decision 13, choice 2 a', 'Wednesday, November 18, 2026, about 3:12 PM UTC', '`docs/redesign/ws09-k-decisions.md`', 'K was told of two such labels', 'all six are changed']) {
      expect(asked, piece).toContain(piece)
    }
    const branch = bullet(block, '- **Branch.**')
    for (const piece of ['`redesign/event-page-phone`', '`01d05ed`', 'pull request 139', 'its one commit alone', 'no checkpoint\'s branch']) expect(branch, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 aside on the public event page: against the files', () => {
  it('names the one class and why, and the page holds it once, with no switch choosing it', () => {
    const one = bullet(block, '  - **The one class.**')
    for (const piece of ['`grid grid-cols-1 gap-8 lg:grid-cols-3`', '`grid gap-8 lg:grid-cols-3`', '`FEATURES.newLook`', '`min-w-[480px]`', '482 pixels', 'to 506', '`minmax(0, 1fr)`', '`overflow-x-auto`', 'no other class, no order, no wrapper']) {
      expect(one, piece).toContain(piece)
    }
    const page = read(PAGE)
    expect(page.split(GRID)).toHaveLength(2)
    expect(page).not.toContain('\'grid gap-8 lg:grid-cols-3\'')
    expect(page).toContain('{/* The one column below 1024 pixels may be narrower than its widest\n            item, so on a phone the sections table scrolls in its own box and\n            not the whole page sideways. */}\n        ' + GRID)
    expect(page).toContain('<table className="w-full min-w-[480px] text-left text-sm">')
  })

  it('names the box\'s three attributes and why, and the Format row\'s two classes, and the page holds each in both looks', () => {
    const box = bullet(block, '  - **The box.**')
    for (const piece of [
      '`mt-4 overflow-x-auto rounded-xl border`', '`tabIndex` 0, `role="region"` and `aria-label="Sections"` in both looks', '`FEATURES.newLook`', 'reach it and scroll it in every browser',
      'Safari, by its own rule and not measured here, leaves it out', 'ArrowRight scrolls it 40 pixels', 'one more Tab stop that scrolls nothing', 'Nothing else of the box changes',
    ]) expect(box, piece).toContain(piece)
    const row = bullet(block, '  - **The Format row.**')
    for (const piece of ['`gap-4`', '`flex justify-between`', '`text-right`', 'in both looks', '"5-round Swiss, US Chess-rated"', '16 pixels', 'are left as they were']) expect(row, piece).toContain(piece)
    const page = read(PAGE)
    expect(page.split(`${BOX_COMMENT}\n              ${BOX}`)).toHaveLength(2)
    expect(page).not.toContain('FEATURES.newLook ? { tabIndex')
    expect(page.split(ROW)).toHaveLength(2)
    expect(page).toContain('FEATURES.newLook ?')
    expect(page).toContain('import { FEATURES } from \'@/lib/features\'')
  })

  it('gives the six wordings old and new, with who meets each, and the page holds each new one and none of the old', () => {
    const words = bullet(block, '  - **The words.**')
    for (const piece of [
      'now "US Chess ID". Met by a signed-in member',
      'now "This is a US Chess-rated tournament. Add your US Chess ID to your profile before registering." Met by a signed-in member with no number',
      'now "Add US Chess ID to your profile →", its arrow kept',
      'now "US Chess rated". Met by every visitor',
      'now "US Chess ID 12345678"',
      'now ", US Chess-rated". Met by every visitor',
      'with "the old initials" in place of the four letters',
      'No seventh place',
    ]) expect(words, piece).toContain(piece)
    const page = read(PAGE)
    for (const word of NEW_WORDS) expect(page.split(word), word).toHaveLength(2)
    expect(page).not.toMatch(OLD_INITIALS)
    for (const key of ['`uscf_id`', '`uscf_rating`', '`uscf_expiration`']) {
      expect(words, key).toContain(key)
      expect(page, key).toContain(key.slice(1, -1))
    }
  })

  it('took its words from the newer pages it names, and names the one drawn component that still prints the old initials', () => {
    const words = bullet(block, '  - **The words.**')
    const membership = 'src/areas/membership/components/UsChessMembership.tsx'
    const manage = 'src/pages/TournamentManagePage.tsx'
    const family = 'src/areas/households/components/FamilyRegistrationPanel.tsx'
    for (const file of [membership, manage, family]) expect(words, file).toContain(`\`${file}\``)
    expect(read(membership)).toContain('US Chess ID')
    expect(read(membership)).toContain('Add your US Chess ID to your profile')
    expect(read(manage)).toContain('US Chess-rated events')
    expect(read(PAGE)).toContain('<FamilyRegistrationPanel')
    expect(read(family)).toMatch(OLD_INITIALS)
  })

  it('says what does not move and what ships with every switch off, and the page\'s test holds the base by its sha256', () => {
    const still = bullet(block, '- **What does not move.**')
    for (const piece of [
      'to the byte but for the six wordings and the Format row\'s two classes', 'the grid\'s class and the box\'s three attributes', `\`${PAGE_TEST}\``, 'by its sha256',
      'while the page is byte for byte as this aside left it', `\`${AS_LEFT_SHA256}\``, 'in four states', 'those cases are skipped rather than failing', 'the print page and the pairings page', 'the two chips differ',
      'K\'s to weigh', 'No switch is added or changed',
    ]) {
      expect(still, piece).toContain(piece)
    }
    // The page's test holds the hash behind the guard of the page as left, so a later change to the page skips it there.
    const pageTest = read(PAGE_TEST)
    expect(pageTest).toContain('const BASE_SHA256 = \'005e3268cbb8f2e7966af71d7428300f531d977900a805bb525275754cf4f379\'')
    expect(pageTest).toContain(`const AS_LEFT_SHA256 = '${AS_LEFT_SHA256}'`)
    expect(pageTest).toContain('const asLeft = sha256(source()) === AS_LEFT_SHA256')
    expect(pageTest).toContain('it.runIf(asLeft)(\'differs from the page at 01d05ed')
    expect(pageTest).not.toContain('LINES_AS_LEFT')
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of ['All of it, waiting for K\'s word', 'the box\'s three attributes, the Format row\'s two classes', 'behind no switch', 'every visitor meets them']) expect(off, piece).toContain(piece)
    expect(bullet(block, '- **How it comes back out.**')).toContain('A revert of this pull request\'s merge, or the one class, the box\'s three attributes, the Format row\'s two classes and the six wordings put back')
  })

  it('gives the look\'s widths before and after at 320, 390, 768 and 1280 pixels, the Format row at 320, the box under the keyboard and the seven sheets', () => {
    const look = bullet(block, '- **The look.**')
    for (const piece of [
      'At 320 pixels: 506 before', '320 after, the table\'s box 270 pixels wide scrolling its 480', 'At 390 pixels: 506 before; 390 after, the box 340 pixels wide scrolling its 480',
      'At 768 pixels: 768 before and after', 'At 1280 pixels: 1280 before and after', 'Signed out', 'every switch as `main` ships it',
      'nothing on the page is wider than the window', 'now stands 16 pixels from it',
      'matches `:focus-visible`', 'outline style `auto`, 1 pixel', '`outline-ring/50`', '#d0d0d0 on the white ground, 1.54 to 1', 'from 0 to 40 pixels', '723 in 723', 'ArrowRight leaves it at 0', '153.0.8010.12',
      'retaken with the Format row\'s gap', 'is not retaken', '`3-before-and-after-320.png`, its two after pictures retaken on this tree\'s build',
    ]) expect(look, piece).toContain(piece)
    for (const sheet of ['1-before-and-after-390.png', '2-top-with-the-chip-390.png', '3-before-and-after-320.png', '4-side-card-390.png', '5-as-before-1280.png', '6-side-card-320.png', '7-the-box-under-the-keyboard.png']) {
      expect(look, sheet).toContain(`\`${sheet}\``)
    }
  })

  it('names the other pages that still print the old initials, each with its count while this block is the latest', () => {
    const others = bullet(block, '- **Other pages that still print the old initials.**')
    expect(others).toContain('Named, not changed.')
    for (const [file, count] of STILL) {
      expect(others, file).toMatch(new RegExp(`\`${file.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}\`${count === 1 ? '' : ` ${count}\\b`}`))
      if (latest) expect(linesWithOld(file), file).toBe(count)
    }
    expect(others).toContain('The print page and the pairings page hold none.')
    expect(linesWithOld('src/pages/TournamentPrintPage.tsx')).toBe(0)
    expect(linesWithOld('src/pages/TournamentPairingsPage.tsx')).toBe(0)
  })
})

describe('REDESIGN_STATUS.md, WS09 aside on the public event page: the pins, the follow-ups and the Status line', () => {
  it('names every file whose cases moved, with its owner and its count of cases as the file holds it', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const [file, count] of MOVED) {
      expect(pins, file).toContain(`\`${file}\` (${count})`)
      expect(casesIn(file), file).toBe(count)
    }
    for (const owner of ['WS01 step 32\'s:', 'WS01 step 32\'s record test:', 'WS09 step 1\'s:', 'WS01 step 32\'s, from `403fa00`']) expect(pins, owner).toContain(owner)
    expect(pins.split('WS01 step 32\'s, from `403fa00`')).toHaveLength(3)
    expect(read(SWEEP)).toContain('with newLook off draws navy words on the hero\\\'s button, as it did, a grid whose one column below 1024 pixels may shrink as under the new look, and the table\\\'s box the same named region in the tab order')
    expect(read(SWEEP)).not.toContain('with newLook off draws what it drew')
    expect(read(SWEEP)).toContain('expect(grid.className).toBe(\'grid grid-cols-1 gap-8 lg:grid-cols-3\')\n    expect(box.className).toBe(\'mt-4 overflow-x-auto rounded-xl border\')\n    expect([\'role\', \'tabindex\', \'aria-label\'].map((attr) => box.getAttribute(attr))).toEqual([\'region\', \'0\', \'Sections\'])')
    expect(read(STEP32)).toContain(`expect(detail).toContain('${GRID}')`)
    expect(read(STEP32)).toContain('expect(detail).toContain(\'tabIndex={0} role="region" aria-label="Sections"\')')
    expect(pins).toContain('No line this aside writes reads or pins the shipped value of any switch')
    for (const piece of [
      'Five cases, each changed in place', 'moved with the word of WS01\'s lead', 'each measures 390 in 390', 'the table wider than its box', '`tabIndex` -1',
      'Its title and its first two assertions moved', 'the focus is not on the page\'s body, stays', 'the comment above them',
    ]) {
      expect(pins, piece).toContain(piece)
    }
    // Each browser case is moved in place, under its new title, and its old title is gone from the file.
    const browser = read(BROWSER)
    const quoted = (title: string) => title.replace(/'/g, '\\\'')
    for (const [was, now] of BROWSER_TITLES) {
      expect(pins, was).toContain(`"${was}" is now "${now}"`)
      expect(browser, now).toContain(`test('${quoted(now)}'`)
      expect(browser, was).not.toContain(quoted(was))
    }
    expect(browser).toContain('// Mended in WS09\'s aside on the public event page, where the grid and the box became the same in both looks.')
  })

  it('names its follow-ups: today\'s focus ring, the page\'s other shortfalls of plain language, the other pages and the browser spec\'s words left as they were, and no longer the two this aside mended', () => {
    const follow = bullet(block, '- **Follow-ups.**')
    for (const piece of [
      '  - **Today\'s focus ring (WS09 aside: the event page).**', 'today\'s look as a whole', 'Not every control of today\'s look draws that ring', 'outline-ring/50', '1.54 to 1', 'the new look gives its own',
      '"2026-12-12"', '"G/90;d5"', 'a long dash', '"Rd 1"', '"See pairings / results"', 'the events list\'s chip first',
      'The side card\'s Time control row at 320 pixels', 'would wrap and touch its label as the Format row did',
      '"to be unchanged"', '"the fix is the new look\'s, on a11y-on"', 'For WS01\'s lead to move in place']) {
      expect(follow, piece).toContain(piece)
    }
    // The spec's words the follow-up names are still there, left as they were.
    expect(read(BROWSER)).toContain('(a11y-off, every switch off) read beside each to be unchanged:')
    expect(read(BROWSER).split('only(testInfo, ON, \'the fix is the new look\\\'s, on a11y-on\')').length - 1).toBeGreaterThanOrEqual(2)
    for (const gone of ['The side card\'s rows at 320 pixels', 'has no role and no name', 'would mend both']) expect(follow, gone).not.toContain(gone)
    // The ring is held in this block alone, tagged with this aside; the section's list keeps the tags its own record tests hold.
    const ring = follow.split('\n').find((l) => l.startsWith(`  ${RING}`)) ?? ''
    for (const piece of ['`auto`', '1 pixel', '`outline-ring/50`', '#d0d0d0', '1.54 to 1', '3 to 1', 'links, its plain buttons and its native select', '`focus-visible:ring-3 focus-visible:ring-focus`', '2 pixel `ring-ring` at full strength', 'the new look gives its own', 'three later record tests']) expect(ring, piece).toContain(piece)
    // Only the browser's own ring is said to be shared; the site's buttons and its text field draw their own, as their classes say.
    expect(ring).not.toContain('every control the keyboard reaches')
    expect(read('src/components/ui/button.tsx')).toContain('outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-focus')
    expect(read('src/components/ui/input.tsx')).toContain('focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')
    const list = ws09.slice(ws09.indexOf(`\n${LISTS[3]}\n`) + 1)
    expect(list).not.toContain('(WS09 aside: ')
  })

  it('gives the Status line one clause for the aside, keeps the pull request numbers, and says no merge the record does not hold', () => {
    expect(statusLine).toContain('an aside of K\'s decision 13, the public event page on a phone with its six wordings for US Chess, is built as a small pull request of its own and waits for K\'s word;')
    expect(statusLine).toMatch(/\bbuilt\.$/)
    expect(statusLine).not.toMatch(/switch-on[^;]*\bmerged\b/)
    if (latest) {
      expect(statusLine.match(/pull request \d+/g)).toEqual(['pull request 132', 'pull request 134'])
      expect(prLine.match(/pull request \d+/g)).toEqual(['pull request 130', 'pull request 131', 'pull request 132', 'pull request 134', 'pull request 133'])
    }
  })
})

describe('REDESIGN_STATUS.md, WS09 aside on the public event page: the Checks line', () => {
  it('gives each figure once, the counts adding up with the three new files', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'dry run']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on `01d05ed`\), every one passing/.exec(checksLine)
    expect(unit, 'the unit counts').not.toBeNull()
    // The page's test runs one case, two cases and four cases twice over, and holds three more behind its guard, one of them run twice over: ten more than its `it(` lines.
    // The edges' test runs one case twice over and six cases twice over: seven more than its `it(` lines.
    expect(read(PAGE_TEST).match(/^\s*it\.runIf\(/gm) ?? []).toHaveLength(2)
    expect(num(unit![1]) - num(unit![3])).toBe(casesIn(PAGE_TEST) + 10 + casesIn(EDGES_TEST) + 7 + casesIn(SELF))
    expect(Number(unit![2]) - Number(unit![4])).toBe(3)
    expect(checksLine).toMatch(/integration [\d,]+ tests that run in \d+ files, with the one todo beside them, as on `01d05ed`/)
    const lint = /`npm run lint` 13 errors and 12 warnings over ([\d,]+) files \(([\d,]+) on `01d05ed`\), none in a file this aside touches/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(num(lint![1]) - num(lint![2])).toBe(3)
    for (const piece of [
      'the main script keeping 558,793 bytes', '`TournamentDetailPage`, from 37,426 bytes to 37,418', '`80390f9febd8d7b1046bf946c84522abe6330f4f6894b65c93f2873174143079`',
      '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef`', `\`${BROWSER}\` alone`, 'on `a11y-on` 29 passing and 8 skipped, on `a11y-off` 8 passing and 29 skipped',
      '995 tests, 659 that run and 336 that skip', 'the gate\'s to confirm',
    ]) expect(checksLine, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, WS09 aside on the public event page: plain language', () => {
  const written = [block, statusLine].join('\n')

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what the block wrote, and dates and times in their plain form', () => {
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(written).not.toMatch(rule)
    const prose = proseOf(block)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
  })

  it('keeps a dash, a tool\'s name, the two letters on their own and the old initials out of this file, the page\'s test and the lines this aside wrote in the page', () => {
    const page = read(PAGE).split('\n')
    const at = page.findIndex((l) => l.includes(GRID))
    const box = page.findIndex((l) => l.includes(BOX))
    const row = page.findIndex((l) => l.includes('<div className="flex justify-between gap-4">'))
    const wrote = [...page.slice(at - 3, at + 1), ...page.slice(box - 2, box + 1), page[row], page[row + 2], ...page.filter((l) => NEW_WORDS.some((w) => l.includes(w)))]
    expect(wrote).toHaveLength(15)
    for (const text of [read(SELF), read(PAGE_TEST), read(EDGES_TEST), wrote.join('\n')]) {
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text).not.toMatch(rule)
    }
  })

  it('reads and pins no other change\'s switch in the two page test files this aside added, and sets newLook itself', () => {
    // The names are put together so that this file does not hold them as a list of its own.
    const others = new RegExp(`\\b(${['club' + 'EmailHidden', 'CLUB_' + 'EMAIL_HIDDEN', 'roster' + 'ShortNames', 'ROSTER_' + 'SHORT_NAMES', 'club' + 'Keepers', 'CLUB_' + 'KEEPERS_ON', 'region' + 'Events', 'REGION_' + 'EVENTS_ON', 'CLUB_' + 'PAGES_ON', 'mail' + 'Lists', 'MAIL_' + 'LISTS_ON', 'MAIL_' + 'SENDER'].join('|')})\\b`)
    for (const file of [PAGE_TEST, EDGES_TEST]) {
      expect(read(file)).not.toMatch(others)
      expect(read(file)).toContain('flags.newLook = on')
      expect(read(file)).not.toMatch(/FEATURES\.newLook\)/)
    }
  })
})
