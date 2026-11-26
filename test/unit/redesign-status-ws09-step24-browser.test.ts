// test/unit/redesign-status-ws09-step24-browser.test.ts
//
// REDESIGN_STATUS.md records the second half of WS09 step 24: the new club
// page in the browser, on a third build of the browser tests, the last of
// checkpoint W's five steps. Like the record test of the step's first half,
// this file reads only the WS09 section, from its heading to the WS10
// heading. Pinned here: this step's block right after the block of `main`
// taken in, and before the four lists while it is the latest; the Status
// line's clause on step 24 and its tail; the block's parts in order; its
// files, its third build and its moved pins against the tree; its figures;
// and the plain-language rules over what the step wrote and the files it
// adds. No line here reads how a switch ships.
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { A11Y_CLUBS_VARIANT, A11Y_VARIANTS } from '../a11y/global-setup'

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
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|[${String.fromCharCode(0x27e6, 0x27e7)}]|\\b[A-Z]+[0-9]*_[A-Z_0-9]+\\b(?!\`)`)
/** The words that would make K, the owner, a he. */
const HE = /\b(?:he|his|him)\b/i
/** A month and a day with a year, which the record always writes after its weekday. */
const DATE = /\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/g

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

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### Checkpoint W: WS09 main taken in after Thursday\'s merges'
const BLOCK = '### WS09 step 24: the new club page in the browser'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === BLOCK

const SELF = 'test/unit/redesign-status-ws09-step24-browser.test.ts'
const NEW = [
  'test/a11y/clubs-page.spec.ts', 'test/a11y/clubs-reflow.spec.ts', 'test/unit/a11y-clubs-build.test.ts', 'test/unit/a11y-clubs-projects.test.ts',
  'test/integration/club-fixtures-page.test.ts', SELF,
]
/** The new test files the block counts by their cases, each count read from the file. */
const COUNTED = ['test/unit/a11y-clubs-build.test.ts', 'test/unit/a11y-clubs-projects.test.ts', 'test/integration/club-fixtures-page.test.ts', SELF]
const CHANGED = [
  'test/a11y/global-setup.ts', 'playwright.config.ts', 'package.json', '.gitignore', 'eslint.config.js', 'scripts/seed/fixtures.sql',
  'test/a11y/builds.spec.ts',
]
const BROUGHT_IN: ReadonlyArray<readonly [string, number]> = [
  ['test/unit/club-pages-five-regions-words.test.ts', 16],
  ['test/integration/club-page-five-regions.test.ts', 10],
  ['test/unit/club-editor-page-preview-help-marks.test.tsx', 10],
]
/** The files whose assertions moved, each with its count of cases as a full run gives it, its owner, and the titles of its moved cases. */
const MOVED: ReadonlyArray<readonly [string, number, string, readonly string[]]> = [
  ['test/unit/browser-test-wiring.test.ts', 96, 'Phase 0\'s', ['test:a11y builds and seeds first, then runs only the three accessibility projects']],
  ['test/unit/e2e-preview-guard.test.ts', 60, 'Phase 0\'s', [
    'does not need an address for the accessibility projects, and does not point the e2e project anywhere',
    'maps the projects to their own folders',
  ]],
  ['test/unit/seed-fixtures.test.ts', 14, 'Phase 0\'s', ['loads, and loads again with the same result, leaving the migrations\' own rows alone']],
  ['test/unit/seed-fixtures-edges.test.ts', 53, 'Phase 0\'s', ['writes nothing that is not its own: every id it inserts starts with fx-']],
  ['test/unit/redesign-status-ws02-step2.test.ts', 34, 'WS02\'s record', ['holds none of the five early switches off by name in the switch test or the builds spec, as the record says']],
]
const HELD = [
  'src/pages/AdminEmailPage.tsx', 'src/pages/AdminPage.tsx', 'src/components/layout/Navbar.tsx', 'functions/utils/admin/campaigns.ts', 'test/a11y/signedIn.ts',
]
const num = (text: string) => Number(text.replace(/,/g, ''))

describe('REDESIGN_STATUS.md, WS09 step 24: the new club page in the browser', () => {
  it('sits once, right after the block of main taken in, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
  })

  it('says in the Status line that the browser half is built, and gives the tail this step while it is the latest', () => {
    expect(statusLine).toContain('the first half of WS09 step 24, the sitemap, is served only with `CLUB_PAGES_ON` set, and its browser half, the new club page on a third build of the browser tests, is built,')
    expect(statusLine).not.toContain('its browser half to come')
    const tail = statusLine.slice(statusLine.lastIndexOf('; ') + 2)
    if (latest) expect(tail).toContain('`main` taken in after Thursday\'s merges, the new club page in the browser, K\'s answers')
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132', 'draft pull request 134']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens with why in one sentence, names both agreements, and has every part in order', () => {
    const opening = block.split('\n')[2] ?? ''
    expect(opening.split(/\.\s/)).toHaveLength(1)
    for (const piece of ['a third build of the browser tests', 'Tuesday, November 17, 2026', '`newClubs` is not turned on in the a11y-on build', '`test/a11y/builds.spec.ts`', 'gains one list and its check']) {
      expect(opening, piece).toContain(piece)
    }
    const parts = [
      '- **Files.**', '- **The third build.**', '- **The third server.**', '- **The two builds, unchanged.**', '- **What the specs hold.**', '- **The fixtures.**',
      '- **What was looked at and left.**', '- **What ships with every switch off.**', '- **Pins moved.**', '- **Judgement calls.**', '- Checks:', '- **Branch.**',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(0)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })

  it('names every file it adds, changes and brings in, each in the tree, and no file the mail stream holds but the builds spec', () => {
    const files = bullet(block, '- **Files.**')
    for (const file of [...NEW, ...CHANGED]) {
      expect(files, file).toContain(`\`${file}\``)
      expect(existsSync(join(ROOT, file)), file).toBe(true)
    }
    for (const [file, cases] of BROUGHT_IN) {
      expect(files, file).toContain(`\`${file}\` (${cases}`)
      expect(existsSync(join(ROOT, file)), file).toBe(true)
    }
    for (const file of COUNTED) expect(files, file).toContain(`\`${file}\` (${!latest && file === 'test/unit/a11y-clubs-build.test.ts' ? 8 : (read(file).match(/^\s*it\(/gm) ?? []).length}: `) // Moved by WS09 checkpoint Z's review: that file gains three cases for a tree that ships the line set, so its count at this step, 8, is held once this step is not the latest.
    for (const file of HELD) expect(files, file).toContain(`\`${file}\``)
    expect(files).toContain('No file under `src/`, `functions/`, `domain/`, `workers/` or `migrations/` changes')
    // CI's file is named by its own name, since the folder it sits in is a word the record does not use.
    expect(files).toContain('CI\'s own file, `ci.yml`')
    expect(read(['.github', 'work' + 'flows', 'ci.yml'].join('/'))).toContain('builds the site three')
  })

  it('describes the third build as test/a11y/global-setup.ts builds it, beside the two', () => {
    const third = bullet(block, '- **The third build.**')
    const on = A11Y_VARIANTS.find((v) => v.name === 'a11y-on')!
    expect(A11Y_VARIANTS.map((v) => v.name)).toEqual(['a11y-on', 'a11y-off'])
    expect(A11Y_CLUBS_VARIANT.flags).toBe(`${on.flags},newClubs`)
    expect(third).toContain(`\`${A11Y_CLUBS_VARIANT.name}\``)
    expect(third).toContain(`\`${A11Y_CLUBS_VARIANT.dist}\``)
    expect(third).toContain(`port ${A11Y_CLUBS_VARIANT.port} with inspector port ${A11Y_CLUBS_VARIANT.inspectorPort}`)
    expect(third).toContain(`\`${A11Y_CLUBS_VARIANT.persist}\``)
    expect(third).toContain('`test/a11y/clubs-*.spec.ts`')
    expect(read('package.json')).toContain('--project=a11y-clubs')
  })

  it('describes the third server as the setup makes it', () => {
    const server = bullet(block, '- **The third server.**')
    expect(server).toContain(`\`${A11Y_CLUBS_VARIANT.serveFrom}\``)
    for (const link of ['`domain/`', '`src/`', '`node_modules`', '`wrangler.toml`', '`package.json`']) expect(server, link).toContain(link)
    expect(read('test/a11y/global-setup.ts')).toContain('export const A11Y_CLUBS_LINKS = [\'domain\', \'src\', \'node_modules\', \'wrangler.toml\', \'package.json\'] as const')
  })

  it('names every moved pin with its file, its count of cases, its owner and the titles of its moved cases', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const [file, cases, owner, titles] of MOVED) {
      expect(pins, file).toContain(`\`${file}\` (${cases}`)
      expect(pins, file).toContain(owner)
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      for (const title of titles) {
        expect(pins, title).toContain(title)
        expect(read(file), title).toContain(title.replace(/'/g, '\\\''))
      }
    }
    expect(read('test/unit/browser-test-wiring.test.ts')).toContain('then runs only the three accessibility projects')
    expect(read('test/unit/e2e-preview-guard.test.ts')).toContain('\'a11y-clubs\': \'test/a11y\'')
  })

  it('gives the figures of the checks, the browser run by project, and the times beside the base\'s', () => {
    const lint = /`npm run lint` (\d+) errors and (\d+) warnings over ([\d,]+) files \(([\d,]+) on the base\)/.exec(checksLine)
    expect(lint).not.toBeNull()
    expect([num(lint![1]), num(lint![2])]).toEqual([13, 11])
    expect(num(lint![3])).toBeGreaterThan(num(lint![4]))
    const unit = /unit ([\d,]+) tests in ([\d,]+) files \(12,240 in 540 on the base\)/.exec(checksLine)
    expect(unit).not.toBeNull()
    expect(num(unit![1])).toBeGreaterThan(12_240)
    expect(checksLine).toMatch(/integration [\d,]+ tests that run in [\d,]+ files \(3,418 in 185 on the base\)/)
    for (const project of ['a11y-on', 'a11y-off', 'a11y-clubs']) expect(checksLine, project).toContain(`\`${project}\``)
    expect(checksLine).toContain('660 passed and 337 skipped')
    expect(checksLine).toContain('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
    expect(checksLine).toMatch(/a local production build/)
  })

  it('names its branch and the base its diff is against', () => {
    expect(bullet(block, '- **Branch.**')).toContain('`redesign/ws09-clubs-w`, at `fd157fd`')
  })

  it('keeps the plain-language rules in the block and the files it adds', () => {
    for (const [name, text] of [['the block', block], ...NEW.map((f) => [f, read(f)] as const)] as const) {
      expect(text, name).not.toMatch(DASHES)
      expect(text, name).not.toMatch(TOOLS)
      expect(text, name).not.toMatch(BARE)
      expect(text, name).not.toMatch(OLD_INITIALS)
    }
    const prose = proseOf(block)
    expect(prose).not.toMatch(BANNED)
    expect(prose).not.toMatch(UNFILLED)
    expect(prose).not.toMatch(HE)
    for (const m of prose.matchAll(DATE)) {
      expect(prose.slice(Math.max(0, m.index - 11), m.index), m[0]).toMatch(/(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), $/)
    }
  })
})
