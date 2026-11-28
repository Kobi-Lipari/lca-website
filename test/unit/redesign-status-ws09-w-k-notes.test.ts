// test/unit/redesign-status-ws09-w-k-notes.test.ts
//
// REDESIGN_STATUS.md records what K's look at the test site asked of the new
// club page (K's decision 12), a small step of checkpoint W. Like WS09 step
// 24's record test, this file reads only the WS09 section, from its heading
// to the WS10 heading. Pinned here: the block right after step 24's and
// before the four lists while it is the latest; the Status line's tail while
// it is the latest; the block's parts in order and its figures, which must
// agree with each other and with the files they describe; and the
// plain-language rules over what the block wrote and the files it adds. No
// line here reads how a switch ships.
import { existsSync, readFileSync } from 'node:fs'
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
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'T' + 'BD'}\\b|${'FIG' + 'URE'}|[${String.fromCharCode(0x27e6, 0x27e7)}]|\\b[A-Z]+[0-9]*_[A-Z_0-9]+\\b(?!\`)`)
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

const ws09 = between(status, '\n## WS09: Clubs as living listings\n', '\n## WS10:')
const part = (heading: string) => {
  const at = ws09.indexOf(`\n${heading}\n`)
  return at < 0 ? '' : between(ws09.slice(at + 1), heading, '\n### ')
}
const PREVIOUS = '### WS09 step 24: the sitemap'
const BLOCK = '### Checkpoint W: WS09 what K\'s look at the test site asked'
const LISTS = ['### WS09 decisions', '### WS09 deviations from the brief', '### WS09 verify items resolved', '### WS09 follow-ups']
const block = part(BLOCK)
const lines = ws09.split('\n')
const statusLine = lines.find((l) => l.startsWith('**Status:**')) ?? ''
const checksLine = block.split('\n').find((l) => l.startsWith('- Checks:')) ?? ''
const headings = lines.filter((l) => l.startsWith('### '))
/** The section's latest block: the heading straight before the four lists. */
const latest = headings[headings.indexOf(LISTS[0]) - 1] === BLOCK

const NEW_TESTS = [
  'test/unit/club-page-k-notes.test.tsx', 'test/integration/club-page-k-notes.test.ts', 'test/unit/redesign-status-ws09-w-k-notes.test.ts',
  'test/integration/club-page-last-checked.test.ts', 'test/unit/club-page-k-notes-source.test.ts',
]
const CHANGED = [
  'functions/utils/clubs/authorLine.ts', 'functions/utils/clubs/pageAnswer.ts', 'domain/contracts/clubPage.ts', 'src/areas/clubs/components/AuthorLine.tsx',
  'src/areas/clubs/components/ClubPage.tsx', 'src/areas/clubs/components/WhenAndWhere.tsx', 'src/areas/clubs/clubPage.ts',
]
/** The test files whose cases this step changes in place, each keeping its count. */
const MOVED = [
  'test/unit/club-page-lines.test.ts', 'test/unit/club-page-contract.test.ts', 'test/unit/club-page-bare.test.tsx', 'test/unit/club-page-full.test.tsx',
  'test/unit/club-page-html.test.tsx', 'test/unit/club-pages-no-dates.test.tsx', 'test/unit/club-routing-server-only.test.ts',
  'test/unit/redesign-status-ws09-step20.test.ts', 'test/unit/helpers/clubPageAnswer.ts', 'test/integration/club-page.test.ts',
  'test/integration/club-page-edges.test.ts', 'test/integration/contracts/club-page.test.ts',
]
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const num = (text: string) => Number(text.replace(/,/g, ''))
const casesIn = (file: string) => (read(file).match(/^\s*it\(/gm) ?? []).length
const writtenCount = (files: string, file: string) => Number(new RegExp(`\`${escape(file)}\` \\((\\d+): `).exec(files)?.[1])
/** A file's code with its comments taken out. */
const codeOf = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('REDESIGN_STATUS.md, checkpoint W: what K\'s look at the test site asked', () => {
  it('sits once, right after step 24\'s block, and before the four lists while it is the latest', () => {
    expect(block).not.toBe('')
    expect(ws09.split(`\n${BLOCK}\n`)).toHaveLength(2)
    expect(headings[headings.indexOf(PREVIOUS) + 1]).toBe(BLOCK)
    if (latest) expect(headings[headings.indexOf(BLOCK) + 1]).toBe(LISTS[0])
  })

  it('gives the Status line its tail while it is the latest, and keeps the pull request numbers', () => {
    const tail = statusLine.slice(statusLine.indexOf('checkpoint Z for steps 36 to 38); ') + 'checkpoint Z for steps 36 to 38); '.length)
    if (latest) {
      for (const piece of ['on K\'s decision 12 the club page names no keeper to anyone, and a signed-in keeper still reads their own line and its told line reads "Last checked" with its month', 'the sitemap of step 24, what K\'s look at the test site asked, K\'s answers']) {
        expect(tail, piece).toContain(piece)
      }
    }
    expect(tail).toMatch(/\bbuilt\.$/)
    for (const pr of ['pull request 130', 'pull request 131', 'pull request 132']) expect(lines.find((l) => l.startsWith('**PR:**')), pr).toContain(pr)
  })

  it('opens with why, K\'s decision 12 and its day, and the branch, and has every part in order', () => {
    const opening = block.split('\n')[2] ?? ''
    for (const piece of [
      'K looked at the new club page on a test site', 'K\'s decision 12 of Tuesday, November 17, 2026 asked two things', '`ad47e8a`',
      'checkpoint V has merged into `main` since this branch was cut, this branch has not taken `main` in yet', 'Nothing changes with every switch off',
    ]) expect(opening, piece).toContain(piece)
    const parts = [
      '- **Who keeps a club is not public.**', '- **The keeper\'s own line.**', '- **Last checked.**', '- **What was owed and is settled.**',
      '- **What ships with every switch off.**', '- **Pins moved.**', '- **Files.**', '- **The pictures.**', '- **Judgement calls.**', '- **Lint.**', '- **Build.**', '- Checks:',
    ]
    const at = parts.map((p) => block.indexOf(`\n${p}`))
    for (const [i, p] of parts.entries()) expect(at[i], p).toBeGreaterThan(-1)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    expect(bullet(block, '- **Judgement calls.**').split('\n').filter((l) => /^\s+- /.test(l)).length).toBeGreaterThanOrEqual(5)
  })
})

describe('REDESIGN_STATUS.md, checkpoint W, K\'s decision 12: the parts against the files', () => {
  it('says the author line left the page and the answer for everyone, the key with it, and the code that built it', () => {
    const who = bullet(block, '- **Who keeps a club is not public.**')
    for (const piece of ['a visitor, a member, the club\'s rep, the region\'s representative and an LCA admin', 'The key `author` leaves the answer and its contract', 'My region and the LCA admin\'s club page']) {
      expect(who, piece).toContain(piece)
    }
    expect(read('domain/contracts/clubPage.ts')).not.toMatch(/\bauthor:/)
    expect(codeOf('functions/utils/clubs/pageAnswer.ts')).not.toMatch(/\bauthor\b|clubAuthorLine/)
    for (const name of ['clubAuthorLine', 'authorWords', 'nameForLine']) expect(who, name).toContain(`\`${name}\``)
    expect(codeOf('functions/utils/clubs/authorLine.ts')).not.toMatch(/clubAuthorLine|authorWords|nameForLine|Kept by/)
  })

  it('says the keeper\'s line stands and there is no band without a keeper, as the page draws it', () => {
    const keeper = bullet(block, '- **The keeper\'s own line.**')
    for (const piece of ['"This is your club\'s page"', 'with Edit', 'no band at all', 'no empty bar']) expect(keeper, piece).toContain(piece)
    expect(codeOf('src/areas/clubs/components/ClubPage.tsx')).toContain('{keeper && (')
    expect(codeOf('src/areas/clubs/components/AuthorLine.tsx')).toContain('<div className="border-b border-hairline bg-surface-2">')
  })

  it('says the told line\'s words, where its month comes from, when there is none, and that it replaces the old rule by K\'s decision', () => {
    const told = bullet(block, '- **Last checked.**')
    for (const piece of ['"Last checked November 2026"', '`told_updated_at`', '`last_confirmed_at`', '`monthInWords`', 'never the time of the request', 'there is no line', 'by K\'s decision']) {
      expect(told, piece).toContain(piece)
    }
    expect(read('functions/utils/clubs/authorLine.ts')).toContain('`Last checked ${month}`')
    expect(codeOf('functions/utils/clubs/pageAnswer.ts')).toContain('told_updated_at, told_by, last_confirmed_at`')
    for (const piece of ['migration 0067', 'not a save']) expect(told, piece).toContain(piece)
    expect(codeOf('functions/utils/clubs/authorLine.ts')).toContain('club.told_by || club.last_confirmed_at ? club.told_updated_at : null')
    const owed = bullet(block, '- **What was owed and is settled.**')
    for (const piece of ['the new club page prints no keeper\'s name', 'no longer needed', 'the officers today\'s club page lists']) expect(owed, piece).toContain(piece)
    expect(bullet(block, '- **What ships with every switch off.**')).toContain('Nothing changes.')
  })

  it('names every moved file, each keeping its count, and every new test with its count', () => {
    const pins = bullet(block, '- **Pins moved.**')
    for (const file of MOVED) expect(pins, file).toContain(`\`${file}\``)
    const files = bullet(block, '- **Files.**')
    for (const file of [...CHANGED, ...NEW_TESTS.filter((f) => f !== NEW_TESTS[2]), 'REDESIGN_STATUS.md']) expect(files, file).toContain(`\`${file}\``)
    for (const file of NEW_TESTS) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect(writtenCount(files, file), file).toBe(casesIn(file))
    }
    const pictures = bullet(block, '- **The pictures.**')
    for (const piece of ['at 1280 and 390 pixels', 'in the dark', 'as its own rep', 'neither date', 'scratch copies were deleted']) expect(pictures, piece).toContain(piece)
  })
})

describe('REDESIGN_STATUS.md, checkpoint W, K\'s decision 12: the figures and the plain words', () => {
  it('gives each figure of the checks once, counts that add up, and the build and the worker', () => {
    for (const piece of ['`npm run lint`', '`npm run build`', '`npm run typecheck:functions`', '`npm run check:bundle`', 'unit ', 'integration ', 'no browser run of its own']) {
      expect(checksLine.split(piece), piece).toHaveLength(2)
    }
    expect(checksLine).toContain('`ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef` untouched')
    const files = bullet(block, '- **Files.**')
    const unit = /unit ([\d,]+) tests in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing/.exec(checksLine)
    expect([num(unit![3]), Number(unit![4])]).toEqual([11114, 476])
    const newUnit = NEW_TESTS.filter((f) => f.startsWith('test/unit/'))
    expect(num(unit![3]) + newUnit.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(unit![1]))
    expect(Number(unit![2]) - Number(unit![4])).toBe(newUnit.length)
    const integration = /integration ([\d,]+) in (\d+) files \(([\d,]+) in (\d+) on the base\), every one passing, with the one todo beside them/.exec(checksLine)
    expect([num(integration![3]), Number(integration![4])]).toEqual([2902, 164])
    const newIntegration = NEW_TESTS.filter((f) => f.startsWith('test/integration/'))
    expect(num(integration![3]) + newIntegration.map((f) => writtenCount(files, f)).reduce((a, n) => a + n, 0)).toBe(num(integration![1]))
    expect(Number(integration![2]) - Number(integration![4])).toBe(newIntegration.length)
    const lint = /`npm run lint` 13 errors and 11 warnings over ([\d,]+) files \(([\d,]+) on the base\), none new/.exec(checksLine)
    expect(num(lint![1]) - num(lint![2])).toBe(NEW_TESTS.length)
    const built = /`npm run build` \((\d+) files in `dist\/assets`, (\d+) on the base\)/.exec(checksLine)
    const checked = /`npm run check:bundle` \(no zod in the site's bundle, (\d+) files of `dist\/assets` checked\)/.exec(checksLine)
    expect(built?.[1]).toBe(checked?.[1])
    const build = bullet(block, '- **Build.**')
    for (const piece of ['a local production build', '`VITE_`', '559,676 bytes', '138,154', '`features-nZCZoT6G.js` at 729 bytes', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes']) expect(build, piece).toContain(piece)
    expect(bullet(block, '- **Lint.**')).toContain('13 errors and 11 warnings, as on the base `ad47e8a`')
  })

  it('keeps the dashes, the working words, any tool\'s name, the old initials and unfilled marks out of what it wrote and the files it adds', () => {
    const written = [block, statusLine].join('\n')
    for (const rule of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS]) expect(written).not.toMatch(rule)
    const prose = proseOf(written)
    expect(prose).not.toMatch(UNFILLED)
    expect(prose).not.toMatch(HE)
    for (const found of prose.matchAll(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}\b/g)) {
      expect(prose.slice(Math.max(0, (found.index ?? 0) - 11), found.index), found[0]).toMatch(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*, $/)
    }
    for (const time of prose.matchAll(/\b\d{1,2}:\d{2}(?: ?[A-Za-z]+)?/g)) expect(time[0]).toMatch(/^(?:1[0-2]|[1-9]):[0-5]\d (?:AM|PM)$/)
    for (const file of NEW_TESTS) {
      const text = read(file)
      for (const rule of [DASHES, TOOLS, BARE, OLD_INITIALS]) expect(text, file).not.toMatch(rule)
    }
    for (const file of NEW_TESTS.filter((f) => !f.includes('redesign-status') && !f.endsWith('-source.test.ts'))) {
      const text = read(file)
      expect(text, file).toMatch(/Example [A-Z][a-z]+ Club/)
      for (const address of text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []) expect(address, file).toMatch(/@example\.org$/)
      expect(text, file).not.toMatch(/process\.env|import\.meta\.env|src\/lib\/features|\bfeatures\.\w+|FEATURES\.\w+/)
      expect(text, file).not.toMatch(/import\s*\{[^}]*\b(?:CLUB_PAGES_ON|CLUB_EMAIL_HIDDEN|CLUB_KEEPERS_ON)\b/)
    }
  })
})
