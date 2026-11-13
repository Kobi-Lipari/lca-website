// test/unit/redesign-status-news-fields.test.ts
//
// The record of the News posts' links and fields in REDESIGN_STATUS.md: its
// own section, "## Phase 0: the News posts' links and fields", straight after
// the News posts' cleaner's. It reads that section and
// the date line alone, never the code and never another section, so a later
// change elsewhere leaves it be. Its banned patterns are built from split
// strings, so this file holds none of them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')

const HEADING = "## Phase 0: the News posts' links and fields"
const CLEANER = "## Phase 0: the News posts' cleaner"
const start = status.indexOf(HEADING)
const after = status.indexOf('\n## ', start + HEADING.length)
const section = start < 0 ? '' : status.slice(start, after < 0 ? undefined : after)
const lines = section.split('\n')
const line = (head: string) => lines.find((l) => l.startsWith(head)) ?? ''
const bullet = (head: string) => line(`- **${head}**`)
const dateLine = status.split('\n').find((l) => l.startsWith('Last updated:')) ?? ''

/** An en dash or an em dash, written by code so this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** The working words a record does not use, in the plural too, and the words that name a person's role in the work. */
const BANNED = new RegExp(`\\b(${['sli' + 'ce', 'buil' + 'der', 'sco' + 'ut', 'plan' + 'ner', 'recor' + 'der', 'mani' + 'fest', 'sub' + 'agent', 'work' + 'flow', 'tes' + 'ter'].join('|')})s?\\b|${'the ' + 'lead'}`, 'i')
/** The tools a record must not mention, split so this file does not mention them either. */
const TOOLS = new RegExp(`\\b(${['cla' + 'ude', 'anthr' + 'opic', 'chat' + 'gpt', 'open' + 'ai', 'copi' + 'lot', 'gem' + 'ini', 'l' + 'lm', 'A' + 'I-generated', 'generated ' + 'with', 'co-' + 'authored'].join('|')})\\b`, 'i')
/** The two letters on their own. */
const BARE = new RegExp(`\\b${'A' + 'I'}\\b`)
/** US Chess's old initials, put together so this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** What a draft would hold before its figures were filled in. */
const UNFILLED = new RegExp(`${'@' + '@'}|${'_' + '_'}|\\{[A-Z_0-9]+\\}|${'to be ' + 'measured'}|${'T' + 'BD'}|${'X' + 'XX'}`)
/** A date written out, which must carry its weekday. */
const DATE = /\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/g
const WEEKDAY = /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), $/

const BUTTON = 'The button link must be a page on this site, starting with a single /, or start with http://, https:// or mailto:'
const FIELD = 'This post could not be saved because part of it was not in the form the site expects. Reload the page and try again.'

describe('REDESIGN_STATUS.md, the News posts\' links and fields: where its section stands', () => {
  it('is one section, straight after the cleaner\'s, with no subsection of its own', () => {
    expect(status.split(HEADING)).toHaveLength(2)
    const cleaner = status.indexOf(CLEANER)
    expect(cleaner).toBeGreaterThan(0)
    expect(start).toBeGreaterThan(cleaner)
    expect(status.slice(cleaner + CLEANER.length, start)).not.toMatch(/\n## /)
    expect(section).not.toMatch(/\n### /)
  })

  it('opens with its status, branch and pull request, built and not merged, the pull request a draft', () => {
    expect(lines[2]).toBe('**Status:** built on branch `fix/news-posts-fields` on Friday, November 13, 2026, from `13a2c36`, the merge of pull request 128; not merged yet.')
    expect(lines[3]).toBe('**Branch:** `fix/news-posts-fields`, cut from `main` at `13a2c36` on Friday, November 13, 2026.')
    expect(lines[4]).toBe('**PR:** draft pull request 129, opened from this branch on Friday, November 13, 2026; not merged yet.')
  })

  it('gives the date line a date on or after the day it was written, the line\'s pinned start and end kept', () => {
    expect(dateLine).toMatch(/^Last updated: \S+ \(WS01, step 32: /)
    expect((/^Last updated: (\d{4}-\d{2}-\d{2}) /.exec(dateLine)?.[1] ?? '') >= '2026-11-13').toBe(true)
    expect(dateLine.endsWith('step 1: record and brief 1.4)')).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, the News posts\' links and fields: what it records', () => {
  it('opens on decision 61, live code with no switch, before checkpoint N, an ordinary post byte for byte', () => {
    const opening = lines[6] ?? ''
    for (const piece of ['live code with no switch', 'decision 61', 'hold a link written as a site path to the site', 'hold every field', 'before checkpoint N', 'byte for byte']) {
      expect(opening, piece).toContain(piece)
    }
  })

  it('names the two ways found, by kind, with no pasteable address, and where each link form opens the other site', () => {
    const found = bullet('What was found, by kind.')
    for (const piece of [
      'each a form the old rule kept', 'a slash then a backslash', 'an entity for a slash or a backslash', 'a tab or a line break',
      'between the two slashes', 'From a body link each opens the other site in the same tab', 'no script runs through one',
      'from the button link, which is never decoded', 'and an entity form stays on the site',
      'The old rule already refused a second slash as written, and the new one still does.',
      '`applyPostEdits`', '`functions/api/admin/posts.ts`', 'left its empty draft behind', 'a list\'s length counts its items', 'did nothing on an edit',
    ]) expect(found, piece).toContain(piece)
    // A second slash is not among the forms found: the old rule refused it as written.
    expect(found).not.toContain('a second slash;')
  })

  it('says what was built: the rule in one sentence, the field kinds, the handler that changed, the two messages', () => {
    const built = bullet('What was built, in `functions/utils/posts.ts` and `functions/api/admin/posts.ts`.')
    for (const piece of [
      'an address that starts with "/" is a page on this site only when', 'its second character is not a "/", a backslash or an "&"', 'it holds no control character',
      'from an href attribute (where entities are decoded first)', '`isSafeLink`', '`checkPostBody`',
      'title, slug, summary and bodyHtml text', 'linkUrl, linkLabel and publishedAt text or null', 'status text', 'pinned true or false',
      'before it reads or writes anything', 'the create handler runs the same check before it writes the draft row',
    ]) expect(built, piece).toContain(piece)
    expect(built).toContain(`"${BUTTON}"`)
    expect(built).toContain(`"${FIELD}"`)
    expect(section.split(FIELD)).toHaveLength(2)
  })

  it('says how a body link and a button link are each refused, and that only the create handler changed', () => {
    const links = bullet('A body link and a button link.')
    for (const piece of [
      'treated as a link with a javascript: address is', 'drops the address and keeps the words', '`functions/api/admin/posts/[id].ts`',
      'The edit handler is not changed', 'The create handler gains one check',
    ]) expect(links, piece).toContain(piece)
  })

  it('gives each thing decided on purpose', () => {
    const decided = bullet('Decided on purpose.')
    for (const piece of [
      'A backslash later in the path is kept', '"%2f" and "%5c" are kept', '"/?x", "/#x" and "/" alone are kept',
      'An "&" later in the address', 'A control character anywhere refuses the address', 'in the middle of the path',
      'An address with dot segments', 'nothing on the site reads a path again as an address',
      'A field of the right kind keeps the limits it had before this change', 'the most it leaves behind is an empty draft',
      'http://, https:// and mailto: addresses are not changed by this change',
    ]) expect(decided, piece).toContain(piece)
  })

  it('says how each link is drawn today and what the router does with each form the old rule kept, naming the home page has no News part', () => {
    const drawn = bullet('How each link is drawn today.')
    for (const piece of [
      '`src/pages/NewsPostPage.tsx`', 'raw anchor with no router handling', 'the router\'s own link',
      'the router reads a slash then a backslash as another site\'s and draws it as a plain anchor with no new tab',
      'it draws a tab or a line break between the two slashes as its own link',
      'the browser\'s history refuses that address, so the router loads the other site in the same tab',
      'An entity form stays on the site there, since the button link is never decoded', 'the old rule already refused a second slash',
      '`src/pages/NewsPage.tsx`', 'The home page has no News part', '`src/pages/HomePage.tsx`',
      '`src/areas/admin/components/PostsPanel.tsx`', 'the button link is only an input there',
    ]) expect(drawn, piece).toContain(piece)
    // The old words had the router draw a second slash, which the old rule never saved.
    expect(drawn).not.toContain('a second slash or a slash then a backslash')
  })

  it('says what an ordinary post keeps, byte for byte against the stored copy, the cleaner cases unchanged', () => {
    const keeps = bullet('What an ordinary post keeps.')
    for (const piece of [
      'byte for byte as on `13a2c36`', '/tournaments/sample-open', '/news/sample-post?x=1&y=2#part',
      '`test/integration/posts-cleaner.test.ts`', '`test/unit/fixtures/posts-cleaner-today.ts`', 'stay green and are not changed',
    ]) expect(keeps, piece).toContain(piece)
  })

  it('says what ships: live code, no switch, no migration, K\'s word before the merge', () => {
    const ships = bullet('What ships.')
    for (const piece of [
      'Live code, no switch', 'dropped from a body link and refused in words on a button link', 'nothing else a visitor or an admin meets changes', '`src/lib/features.ts` is not touched', 'there is no migration',
      'Since it ships with every switch off, brief 0.2 asks K\'s yes before the merge (Q34), and the merge waits for K\'s word.',
    ]) expect(ships, piece).toContain(piece)
  })

  it('records that pull request 127 is already merged, so nothing there changes', () => {
    const pr127 = bullet('Pull request 127.')
    for (const piece of ['already records pull request 127 as merged', '`af4a21c`', 'never names pull request 127 and nowhere says it waits or is not merged', 'So nothing there changes']) {
      expect(pr127, piece).toContain(piece)
    }
  })

  it('names every changed and new file once, each test file with its count of cases', () => {
    const files = bullet('Files.')
    for (const name of [
      'functions/utils/posts.ts', 'functions/api/admin/posts.ts', 'REDESIGN_STATUS.md', 'test/unit/redesign-status-news-cleaner.test.ts',
      'test/unit/posts-safe-link.test.ts', 'test/integration/posts-links-fields.test.ts', 'test/unit/redesign-status-news-fields.test.ts',
    ]) expect(files.split(`\`${name}\``), name).toHaveLength(2)
    expect(files).toContain('`test/unit/redesign-status-news-cleaner.test.ts` (17, as before)')
    expect(files).toContain('`test/unit/posts-safe-link.test.ts` (28: ')
    expect(files).toContain('`test/integration/posts-links-fields.test.ts` (265: ')
    expect(files).toContain('`test/unit/redesign-status-news-fields.test.ts` (17: these records)')
    expect(files.match(/`[^`]+\.(ts|tsx|md)`/g)).toHaveLength(7)
  })

  it('gives the build and the worker against the base, neither moved', () => {
    const build = bullet('Build.')
    for (const piece of ['No file under `src/` changes', '232 files in `dist` and 194 in `dist/assets`', '`index-B-xykFls.js` at 554,147 bytes', '`index-MGRWYyBv.css` at 131,136', '`features-DxqQlIon.js` at 698', 'Friday, November 13, 2026']) {
      expect(build, piece).toContain(piece)
    }
    const worker = bullet('Worker.')
    for (const piece of ['does not import `functions/utils/posts.ts`', '`workers/daily-emails/src/index.ts`', '`test/unit/mail-worker-closure.test.ts`', 'twenty-six files', 'nineteen', '`deploy-worker.yml`', '`lca-daily-emails`', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes, byte for byte the base\'s']) {
      expect(worker, piece).toContain(piece)
    }
  })

  it('gives a checks line with this change\'s figures and the base\'s, the browser run the gate\'s before the commit', () => {
    const checks = line('- Checks:')
    for (const piece of [
      '`npm run lint` 13 errors and 13 warnings over 965 files (962 on the base), the base\'s findings, none in a file this change touches', '`npm run build` (194 files in `dist/assets`)',
      '`npm run typecheck:functions`', '`npm run check:bundle` (no zod in the site\'s bundle, 194 files of `dist/assets` checked)',
      'integration 2,154 in 110 files (1,889 in 109 on the base)', '995 tests, 659 that run and 336 that skip', 'the one browser run being the gate\'s before the commit',
      'ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef',
    ]) expect(checks, piece).toContain(piece)
    expect(checks).toContain('unit 8,903 tests in 341 files (8,858 in 339 on the base), every one passing')
  })
})

describe('REDESIGN_STATUS.md, the News posts\' links and fields: plain words', () => {
  it('holds no dash, working word, tool, bare letters, old initials or unfilled name', () => {
    expect(section).not.toBe('')
    for (const banned of [DASHES, BANNED, TOOLS, BARE, OLD_INITIALS, UNFILLED]) expect(section).not.toMatch(banned)
  })

  it('gives every date its weekday', () => {
    const dates = [...section.matchAll(DATE)]
    expect(dates.length).toBeGreaterThan(0)
    for (const m of dates) expect(section.slice(Math.max(0, (m.index ?? 0) - 12), m.index), m[0]).toMatch(WEEKDAY)
  })
})
