// test/unit/redesign-status-news-cleaner.test.ts
//
// The record of the News posts' cleaner in REDESIGN_STATUS.md: its own
// section, "## Phase 0: the News posts' cleaner", straight after the
// public-answer trim's, and the date line's date it moved. It reads
// that section and the date line alone, never the code and never another
// section, so a later change elsewhere leaves it be. Its banned patterns are
// built from split strings, so this file holds none of them.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '../..')
const status = readFileSync(join(ROOT, 'REDESIGN_STATUS.md'), 'utf8')

const HEADING = "## Phase 0: the News posts' cleaner"
const TRIM = '## Phase 0: the public-answer trim'
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

const REFUSAL = 'This post holds markup that cannot be saved. Remove any pasted code and try again.'

describe('REDESIGN_STATUS.md, the News posts\' cleaner: where its section stands', () => {
  it('is one section, straight after the public-answer trim\'s, with no subsection of its own', () => {
    expect(status.split(HEADING)).toHaveLength(2)
    const trim = status.indexOf(TRIM)
    expect(trim).toBeGreaterThan(0)
    expect(start).toBeGreaterThan(trim)
    expect(status.slice(trim + TRIM.length, start)).not.toMatch(/\n## /)
    expect(section).not.toMatch(/\n### /)
  })

  it('opens with its status, branch and pull request, now merged into main', () => {
    expect(lines[2]).toBe('**Status:** built on branch `fix/news-posts-cleaner` on Friday, November 13, 2026, from `af4a21c`, the merge of pull request 127; merged into `main` as `13a2c36` on Friday, November 13, 2026 at 4:56 AM UTC.')
    expect(lines[3]).toBe('**Branch:** `fix/news-posts-cleaner`, cut from `main` at `af4a21c` on Thursday, November 12, 2026.')
    expect(lines[4]).toBe('**PR:** pull request 128, merged into `main` as `13a2c36` on Friday, November 13, 2026 at 4:56 AM UTC.')
  })

  it('gives the date line a date on or after the day it was written, the line\'s pinned start and end kept', () => {
    expect(dateLine).toMatch(/^Last updated: \S+ \(WS01, step 32: /)
    expect((/^Last updated: (\d{4}-\d{2}-\d{2}) /.exec(dateLine)?.[1] ?? '') >= '2026-11-13').toBe(true)
    expect(dateLine.endsWith('step 1: record and brief 1.4)')).toBe(true)
  })
})

describe('REDESIGN_STATUS.md, the News posts\' cleaner: what it records', () => {
  it('opens on live code with no switch, the one reader of a post\'s body and checkpoint N after it', () => {
    const opening = lines[6] ?? ''
    for (const piece of ['live code with no switch', '`sanitizePostHtml` in `functions/utils/posts.ts`', '`src/pages/NewsPostPage.tsx`', 'as is a post the rewriter cannot read', 'byte for byte', 'checkpoint N']) {
      expect(opening, piece).toContain(piece)
    }
  })

  it('names the two ways found, with their inputs and every form of the made tag', () => {
    const found = bullet('The two ways found.')
    for (const piece of [
      'Thursday, November 12, 2026', '`textarea`, `title`, `noscript`, `xmp`, `noembed`, `noframes` and `plaintext`', 'raw text, never as tags',
      '<textarea><img src=x onerror=alert(1)>', 'in upper case and with the tag never closed', 'an opened `plaintext`',
      'joins the text before it to the text after it', '`<<x>img src=x onerror=alert(1)>`', 'an unknown tag', 'a tag a browser knows but a post does not allow',
      'a removed `script`, `style` or `iframe`', 'a tag whose inside is raw text', 'an unknown end tag unwrapped with its start tag', 'one pass for each level',
      'an end tag or a comment', 'cannot join',
    ]) expect(found, piece).toContain(piece)
  })

  it('says what was built in posts.ts alone: the longer list, the passes, the two readings and the refusal through applyPostEdits, the handlers and isSafeLink unchanged', () => {
    const built = bullet('What was built, in `functions/utils/posts.ts` alone.')
    for (const piece of [
      '`cleanOnce`', 'one line changed', '`template`, `svg` and `math`', 'tidying', 'until it stops changing, five passes at most', 'reads the result back twice',
      'tags on the allowed list', '`isSafeLink` allows, already trimmed', 'the `target` and `rel` of a new tab', 'no comment or doctype', 'in either case',
      'or that the rewriter cannot read, below, is refused', 'answers null', '`applyPostEdits`', '"The post is too long"', '`functions/api/admin/posts.ts` and `functions/api/admin/posts/[id].ts`',
      'with a 400 and are not changed', '`isSafeLink` and the rule for a site path are not changed',
    ]) expect(built, piece).toContain(piece)
    expect(built).toContain(`"${REFUSAL}"`)
    expect(section.split(REFUSAL)).toHaveLength(2)
  })

  it('names a post the rewriter cannot read, the places it stops, the error and the draft the old cleaner left, the join that makes one, and the refusal now', () => {
    const unread = bullet('A post the rewriter cannot read.')
    for (const piece of [
      'stops with an error, rather than guess', '`script`, `style`, `iframe` or one of the seven above', 'after a `select`, any of them but `script` and `textarea`',
      'after a `frameset`, open or closed, any but `noframes`',
      'after a `template` inside a `select`', 'an unhandled error with no answer in words', 'an edit wrote nothing', '`functions/api/admin/posts.ts` writes before the body is cleaned',
      'left behind with an empty body', '`<p>Sample post one</p><<x>select><<x>style>x</style>`', 'a live `select`', 'a live `style`', 'the second pass stops on both',
      'answers null for any post the rewriter stops on', 'both handlers answer 400, the create removes its draft and an edit writes nothing', 'Friday, November 13, 2026',
    ]) expect(unread, piece).toContain(piece)
  })

  it('gives the rule for a "<", and each thing decided on purpose', () => {
    const rule = bullet('The rule for a "<".')
    for (const piece of ['a letter, "/", "!" or "?"', 'a NUL', 'as `&lt;`', 'whatever follows it', 'rather than guessing', 'a "<" or a ">"', '`&quot;`', 'loses its `href`, as before']) {
      expect(rule, piece).toContain(piece)
    }
    const decided = bullet('Decided on purpose.')
    for (const piece of [
      'refused now, since the editor never writes one', 'a comment, refused rather than removed', 'a doctype', 'a processing instruction and a CDATA section',
      'an end tag the cleaner does not know', 'written self-closed or with a space after its name', 'a bare "<" in a post\'s text', 'single quotes with a double quote inside', 'the address is the one written, and it is kept as before',
      'A NUL or a control character in a post\'s text', 'A stray `</div>`',
    ]) expect(decided, piece).toContain(piece)
  })

  it('says what an ordinary post keeps, byte for byte against the stored copy, saved again unchanged, read again by parse5', () => {
    const keeps = bullet('What an ordinary post keeps.')
    for (const piece of [
      'byte for byte as before', 'tiptap 3.28.0', '`src/areas/governance/components/RichTextEditor.tsx`', '`src/areas/admin/components/PostsPanel.tsx`',
      'taken from the HTML it writes', 'both lists with a paragraph in each item', 'a code block with and without a language', 'a hard break',
      '`test/integration/posts-cleaner.test.ts`', '27 posts', '392 built from them', '`test/unit/fixtures/posts-cleaner-today.ts`', 'lines 47 to 90',
      'the same bytes', 'to be left as it is', 'parse5', 'with scripting off', 'takes its final form in the first pass',
    ]) expect(keeps, piece).toContain(piece)
  })

  it('says nothing stored is rewritten, with the read of production as a fact given, and what ships: live code, no switch, K\'s word before the merge', () => {
    const stored = bullet('Nothing stored is rewritten.')
    for (const piece of ['No migration is made', 'three posts', 'Thursday, November 12, 2026, before this change', 'none with a script, an image, an onerror or a tag whose inside is raw text', 'no read of production\'s database was made for this change', 'gives an empty body']) {
      expect(stored, piece).toContain(piece)
    }
    const ships = bullet('What ships.')
    for (const piece of ['Live code, no switch', 'refused on save', 'and so is a post the rewriter cannot read', 'nothing else a visitor or an admin meets changes', 'two or three times where it ran once', 'not Cloudflare\'s count of processor time', '(Q42)', '`src/lib/features.ts` is not touched', 'there is no migration', '(Q34)', 'the merge waits for K\'s word']) {
      expect(ships, piece).toContain(piece)
    }
  })

  it('names every changed and new file once, each test file with its count of cases', () => {
    const files = bullet('Files.')
    for (const name of [
      'functions/utils/posts.ts', 'REDESIGN_STATUS.md', 'test/unit/redesign-status-phase0-trim.test.ts', 'test/integration/posts-cleaner.test.ts',
      'test/unit/fixtures/posts-cleaner-today.ts', 'test/unit/redesign-status-news-cleaner.test.ts',
    ]) expect(files.split(`\`${name}\``), name).toHaveLength(2)
    expect(files).toContain('`test/unit/redesign-status-phase0-trim.test.ts` (17, as before)')
    expect(files).toContain('`test/integration/posts-cleaner.test.ts` (72: ')
    expect(files).toContain('a post the rewriter cannot read, in four forms across the three places it stops')
    expect(files).toContain('`test/unit/redesign-status-news-cleaner.test.ts` (17: these records)')
    expect(files.match(/`[^`]+\.(ts|tsx|md)`/g)).toHaveLength(6)
  })

  it('records the one closed record test it changed, and why no other moves', () => {
    const forced = bullet('The one closed record test changed.')
    for (const piece of [
      '`test/unit/redesign-status-phase0-trim.test.ts`', 'to the end of the file', 'bounded at the next "## " heading', '"is one section, after WS15, and the last of the file"',
      'followed by this one', 'Its 17 cases are otherwise as they were', 'No other record test changes', 'the first "## Phase 0:" heading',
    ]) expect(forced, piece).toContain(piece)
  })

  it('gives the build and the worker against the base, neither moved', () => {
    const build = bullet('Build.')
    for (const piece of ['No file under `src/` changes', '232 files in `dist` and 194 in `dist/assets`', 'every name and size', '`index-B-xykFls.js` at 554,147 bytes', '`index-MGRWYyBv.css` at 131,136', '`features-DxqQlIon.js` at 698', 'Friday, November 13, 2026']) {
      expect(build, piece).toContain(piece)
    }
    const worker = bullet('Worker.')
    for (const piece of ['does not import `functions/utils/posts.ts`', '`workers/daily-emails/src/index.ts`', '`test/unit/mail-worker-closure.test.ts`', 'twenty-six files', 'nineteen', '`deploy-worker.yml`', '`lca-daily-emails`', '76.61 KiB, gzip 20.53 KiB', '78,449 bytes, byte for byte the base\'s']) {
      expect(worker, piece).toContain(piece)
    }
  })

  it('records the two follow-ups the cleaner left, now closed by decision 61 in the links and fields section', () => {
    const followUp = bullet('Follow-up for K: a link written as a site path.')
    for (const piece of ['Not changed here', '`isSafeLink`', 'once the browser has decoded entities and dropped tabs and line breaks', 'in the same tab', 'No script runs through one', 'decision 61', 'the News posts\' links and fields']) expect(followUp, piece).toContain(piece)
    const fields = bullet('Follow-up: a post\'s fields are trusted to be text.')
    for (const piece of ['as it was at `af4a21c`', '`applyPostEdits`', 'leaves its empty draft behind', 'nothing live gets out that way', 'before checkpoint N', 'decision 61']) expect(fields, piece).toContain(piece)
  })

  it('gives a checks line with this change\'s figures and the base\'s, the browser run the gate\'s before the commit', () => {
    const checks = line('- Checks:')
    for (const piece of [
      '`npm run lint` 13 errors and 13 warnings over 962 files (959 on the base), the base\'s findings, none in a file this change touches', '`npm run build` (194 files in `dist/assets`)',
      '`npm run typecheck:functions`', '`npm run check:bundle` (no zod in the site\'s bundle, 194 files of `dist/assets` checked)', '(8,841 in 338 on the base)',
      'integration 1,889 in 109 files (1,817 in 108 on the base)', '995 tests, 659 that run and 336 that skip', 'the one browser run being the gate\'s before the commit',
      'ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef', 'from 7:57 PM to 8:21 PM UTC',
    ]) expect(checks, piece).toContain(piece)
    expect(checks).toContain('unit 8,858 tests in 339 files (8,841 in 338 on the base), every one passing')
  })
})

describe('REDESIGN_STATUS.md, the News posts\' cleaner: plain words', () => {
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
