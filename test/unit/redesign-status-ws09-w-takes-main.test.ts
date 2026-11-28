// test/unit/redesign-status-ws09-w-takes-main.test.ts
//
// REDESIGN_STATUS.md records checkpoint W taking main in, as main stood after
// Thursday's merges and the record's mend. Like the record test of the block
// before it, this file reads only the WS09 section, from its heading to the
// WS10 heading. Pinned here: the block right after the block of the written
// page and before the four lists while it is the latest; the Status line's
// tail while it is the latest; the block's parts in order; what it says of the
// merge, the regions, Help and the migrations, against the files; each moved
// pin against its file; its figures, which must agree with each other; and
// the plain-language rules over what the block wrote. No line here reads how
// a switch ships.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { REGIONS } from '../../domain/clubs/regions'

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
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|\\b[A-Z]+[0-9]*_[A-Z_0-9]+\\b(?!\`)|${'DIFF' + 'MAIN'}|${'DIFF' + 'W'}\\b|${'UNIT' + 'COUNT'}|${'UNIT' + 'FILES'}|${'OWN' + 'COUNT'}`)
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
const PREVIOUS = '### Checkpoint W: WS09 the written page reads as a page'
const BLOCK = '### Checkpoint W: WS09 main taken in after Thursday\'s merges'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === BLOCK

const SELF = 'test/unit/redesign-status-ws09-w-takes-main.test.ts'
const PREVIEW_TEST = 'test/unit/club-editor-page-preview.test.tsx'
/**
 * The files whose assertions moved, each with its count of cases as a full
 * run gives it; the lazy pages' audit draws all but one of its cases from a
 * table, so its count cannot be read off its `it(` lines.
 */
const MOVED: ReadonlyArray<readonly [string, number]> = [
  ['test/unit/redesign-status-ws09-step20.test.ts', 22], ['test/unit/redesign-status-ws09-step21.test.ts', 22],
  ['test/unit/redesign-status-ws09-step22.test.ts', 21], ['test/unit/redesign-status-ws09-step23.test.ts', 21],
  ['test/unit/redesign-status-ws09-step24.test.ts', 18], ['test/unit/redesign-status-ws09-help-marks.test.ts', 16],
  ['test/unit/redesign-status-ws09-regions.test.ts', 16], ['test/unit/redesign-status-ws09-switch-on-words.test.ts', 11],
  ['test/unit/app-routes.test.tsx', 44],
]
const HELD = [
  'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/builds.spec.ts',
  'test/a11y/signedIn.ts',
]
/** The regions K's decision 14 took away, written in pieces so that a search of the tree for them does not find this file. */
const GONE = [['Central', 'Louisiana'], ['North of Lake', 'Pontchartrain'], ['Southwest', 'Louisiana'], ['South Central', 'Louisiana'], ['Bayou', 'Region']].map((p) => p.join(' '))
/** What main took out with the club editor's and My region's Help panels, written in pieces for the same reason. */
const HELP_GONE = ['EditorHelp' + 'Button', 'RegionHelp' + 'Button', 'REGION_HELP' + '_SHOWN_KEY', 'lca-club-' + 'editor-help', 'lca-my-' + 'region-help']
const PRODUCT = ['src', 'domain', 'functions', 'workers', 'scripts']
const num = (text: string) => Number(text.replace(/,/g, ''))
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])
/** Every source file under a folder, skipping what is built or installed. */
function sourcesUnder(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
    const path = `${dir}/${name}`
    if (statSync(join(ROOT, path)).isDirectory()) out.push(...sourcesUnder(path))
    else if (/\.(?:ts|tsx|js|mjs|json|sql)$/.test(name)) out.push(path)
  }
  return out
}

describe('REDESIGN_STATUS.md, checkpoint W: main taken in after Thursday\'s merges', () => {
  it('sits once, right after the block of the written page, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line its tail while it is the latest, and keeps the pull request numbers', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) expect(tail).toContain('the written page\'s look, `main` taken in after Thursday\'s merges, K\'s answers')
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132', 'draft pull request 134']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens with why in one sentence, and has every part in order', () => {
    const opening = block.split('\n')[2] ?? ''
    expect(opening.split(/\.\s/).length).toBe(1)
    for (const piece of ['checkpoint V\'s head', 'the five regions', 'the question marks']) expect(opening, piece).toContain(piece)
    const parts = [
      '- **What the merge holds.**', '- **Where the two meet.**', '- **What the merged tree asked.**', '- **Pins moved.**', '- **What ships with every switch off.**',
      '- **What the merge carries.**', '- Checks:', '- **Files.**', '- **Branch.**',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })
})

describe('REDESIGN_STATUS.md, checkpoint W taking main in: the parts against the files', () => {
  it('names the merge, its two parents by their subjects, pull request 149 unmerged, each conflict and how nothing was dropped', () => {
    const holds = bullet(block, '- **What the merge holds.**')
    for (const piece of [
      '`f6192fe`', '`216e7ae`, "WS09 the written page reads as a page (checkpoint W)"', '`18634b8`, "WS09 aside: the record made whole after Thursday\'s hand merges"',
      'Draft pull request 149', 'was not yet merged when `main` was taken in', '`main`\'s head `c8209eb` with that one commit on it', '`5d96486`',
      '`REDESIGN_STATUS.md`, in three places', '`test/unit/api-split-modules.test.ts`', '`test/unit/routes.test.ts`', '`test/unit/club-pages-no-dates.test.tsx`',
      '`REGION_HELP_SHOWN_KEY` is left out', 'Nothing of either side was dropped', 'checked file by file against each parent', '`git diff --stat 18634b8` ends', '`git diff --stat 216e7ae` ends',
    ]) expect(holds, piece).toContain(piece)
    expect(read('test/unit/routes.test.ts')).toContain('expect(real.filter((r) => r.startsWith(\'api/\')).length).toBe(110)')
    expect(read('test/unit/api-split-modules.test.ts')).toContain('\'/api/clubs/*/page\'')
    expect(read('test/unit/club-pages-no-dates.test.tsx')).toContain('import type { ClubPageResponse, RegionClub, WorkspaceRegionResponse } from \'@domain/contracts\'')
  })

  it('says where the two meet, the five regions, Help and the migrations, as the tree holds them', () => {
    const meet = bullet(block, '- **Where the two meet.**')
    for (const piece of [
      '`src/areas/clubs/components/ClubEditor.tsx`', '`src/App.tsx`', '`domain/contracts/registry.ts`', ...GONE, 'they stay', 'a question for K',
      '`test/unit/club-editor-page-preview.test.tsx`', 'Checkpoint W changed no sentence of Help', 'are not rewritten here', '`0072_regions_by_seat.sql` the newest and no `0071`',
      '"No schema changes, nothing to migrate"', '603,055 bytes against `main`\'s 601,754', '`functions/api/clubs/[id]/page.ts`', 'is K\'s to decide',
      '`test/integration/club-page.test.ts`', '`lg:items-stretch`', 'for checkpoint W\'s browser half to look at',
    ]) expect(meet, piece).toContain(piece)
    expect(read('functions/api/clubs/[id]/page.ts')).toContain('const keepersOn = CLUB_KEEPERS_ON')
    expect(read('src/areas/clubs/components/ClubEditor.tsx')).toContain('lg:items-stretch')
    expect(REGIONS).toHaveLength(5)
    for (const region of REGIONS) expect(read('domain/clubs/regions.ts'), region).toContain(`'${region}'`)
    const product = PRODUCT.flatMap(sourcesUnder)
    for (const file of product) {
      const text = read(file)
      for (const name of GONE) expect(text.includes(name), `${file}: ${name}`).toBe(false)
      for (const name of HELP_GONE) expect(text.includes(name), `${file}: ${name}`).toBe(false)
    }
    expect(read(PREVIEW_TEST)).not.toContain('lca-club-' + 'editor-help')
    const migrations = readdirSync(join(ROOT, 'migrations')).filter((name) => /^\d{4}_/.test(name)).sort()
    // main's migrations after 0072 move the newest on, so it is read from the baseline test that holds it; the block's words stand.
    expect(migrations.at(-1)).toBe(/expect\(sql\.at\(-1\)\)\.toBe\('(\d{4}_\w+\.sql)'\)/.exec(read('test/unit/drizzle-baseline.test.ts'))?.[1])
    expect(migrations).toContain('0072_regions_by_seat.sql')
    expect(migrations.some((name) => name.startsWith('0071'))).toBe(false)
    expect(read('src/areas/clubs/components/ClubEditor.tsx')).toContain('<PagePreview')
    expect(read('src/areas/clubs/components/ClubEditor.tsx')).toContain('EditorHelpMark')
  })

  it('sorts what the merged tree asked, and names each moved pin by its file, its count, its case and its owner', () => {
    const asked = bullet(block, '- **What the merged tree asked.**')
    for (const piece of ['unit 12,231 tests in 539 files, 10 failing', 'integration 3,418 that run in 185 files, none failing', 'seven cases in six files', 'three cases', 'Anything else: none', 'Found and not mended, each said above', 'step 20\'s keepers\' preview', 'the empty space under Save and publish', '`test/integration/club-page.test.ts`']) {
      expect(asked, piece).toContain(piece)
    }
    const pins = bullet(block, '- **Pins moved.**')
    expect(pins).toContain('no file\'s count of cases changes')
    for (const [file, count] of MOVED) {
      expect(pins, file).toContain(`\`${file}\` (${count})`)
      if (!file.endsWith('.tsx')) expect(casesIn(file), file).toBe(count)
    }
    expect(subBullets(pins)).toHaveLength(7)
    for (const n of [20, 21, 22, 23, 24]) {
      expect(read(`test/unit/redesign-status-ws09-step${n}.test.ts`), String(n)).toContain('expect(read(\'test/unit/routes.test.ts\')).toContain(\'expect(real.filter((r) => r.startsWith(\\\'api/\\\')).length).toBe(110)\')')
    }
    expect(read('test/unit/app-routes.test.tsx')).toContain('expect(pages.length).toBe(41)')
    expect(read('test/unit/redesign-status-ws09-step21.test.ts')).toContain('expect(read(\'test/unit/app-routes.test.tsx\')).toContain(\'expect(pages.length).toBe(41)\')')
    expect(read('test/unit/redesign-status-ws09-step20.test.ts')).toContain('\'### WS09 aside: how Thursday\\\'s changes reached main\'')
    expect(read('test/unit/redesign-status-ws09-help-marks.test.ts')).toContain('on its own pull request; steps 1 to 14 and 16 to \')')
    if (latest) expect(casesIn('test/unit/nav.test.ts')).toBe(43)
    if (latest) expect(casesIn('test/unit/club-pages-no-dates.test.tsx')).toBe(9)
    if (latest) expect(casesIn(PREVIEW_TEST)).toBe(3)
  })

  it('says what ships with every switch off and what the merge carries, and names every file it changes', () => {
    const off = bullet(block, '- **What ships with every switch off.**')
    for (const piece of [
      'Every switch is as `main` ships it', '`CLUB_PAGES_ON` and `newClubs` stay off', 'Two things ship that `main` does not have', 'K\'s choice 8 (a)', '`GET /api/clubs/{slug}`', '`GET /api/clubs/:id/page`',
      'that closed block stands as written', 'No switch is added and none changes',
    ]) expect(off, piece).toContain(piece)
    expect(off).not.toContain('nothing new')
    expect(read('functions/api/clubs/[id].ts')).toContain('clubIdByShortAddress')
    const carries = bullet(block, '- **What the merge carries.**')
    for (const piece of ['step 20\'s keepers\' preview', 'this step adds no line of product', 'No migration, no table, no endpoint, no contract and no switch', '`main`\'s to the byte']) expect(carries, piece).toContain(piece)
    const files = bullet(block, '- **Files.**')
    for (const file of [PREVIEW_TEST, SELF, 'REDESIGN_STATUS.md']) expect(files, file).toContain(`\`${file}\``)
    expect(existsSync(join(ROOT, SELF))).toBe(true)
    expect(writtenCount(files, SELF)).toBe(casesIn(SELF))
    expect(files).toContain(`the ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][MOVED.length - 1]} test files of Pins moved`)
    for (const piece of ['No product file is touched', 'No file the mail stream holds is touched', ...HELD.map((f) => `\`${f}\``)]) expect(files, piece).toContain(piece)
    for (const piece of ['`redesign/ws09-clubs-w`', '`f6192fe`', 'pushed together']) expect(bullet(block, '- **Branch.**'), piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, checkpoint W taking main in: the figures and the plain words', () => {
  it('gives each figure of the checks once, with each parent\'s beside it, the integration figure with the one todo beside it', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run in the build', 'the worker\'s dry run ']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).not.toContain('`npm run test:a11y`')
    const lint = /`npm run lint` 13 errors and (\d+) warnings over ([\d,]+) files \(`main`'s side 13 errors and 12 warnings over 1,266; checkpoint W's side 13 and 11 over 1,249\), none new/.exec(checksLine)
    expect(lint, 'the lint figures').not.toBeNull()
    expect(Number(lint![1])).toBe(11)
    const unit = /unit ([\d,]+) tests in (\d+) files \(11,589 in 502; 11,176 in 484\), every one passing/.exec(checksLine)
    expect(unit, 'the unit figures').not.toBeNull()
    // The merged tree's run before any change, and this file's own cases added to it.
    expect(num(unit![1])).toBe(12231 + casesIn(SELF))
    expect(Number(unit![2])).toBe(539 + 1)
    expect(checksLine).toMatch(/integration 3,418 tests that run in 185 files \(3,274 in 171; 2,943 in 169\), every one passing, with the one todo beside them/)
    const built = /`npm run build` \((\d+) files in `dist\/assets`; `main`'s side 217, checkpoint W's 214\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    for (const piece of [
      'a local production build', '`VITE_`', '`index-DqKHClRA.js` at 560,886', '`index-EymzK9bA.js` at 559,676', '(168,614; 138,073)', '`features-BFUKrFdH.js` at 741 bytes',
      '660 passed and 337 skipped', '`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched', '76.61 KiB, gzip 20.53 KiB', '78,448 bytes', '78,449 bytes',
    ]) expect(checksLine, piece).toContain(piece)
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what it wrote', () => {
    const written = [block, statusLine].join('\n')
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS]) expect(written).not.toMatch(rule)
    const prose = proseOf(written)
    expect(prose).not.toMatch(UNFILLED)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    for (const file of [SELF, PREVIEW_TEST, ...MOVED.map(([f]) => f)]) {
      const text = read(file)
      expect(text, file).not.toBe('')
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
  })
})
