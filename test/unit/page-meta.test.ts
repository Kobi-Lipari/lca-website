// domain/clubs/pageMeta.ts (WS09 step 8): a club page's title and its
// description, the one rule the editor's search preview and the club page
// the server writes later both use. Held here: the title in the brief's words;
// the description as About's opening and then the statement, plain text of at
// most 155 characters, cut at the end of a word and never in the middle of
// one, with a case for each edge (an empty About, an empty statement, both
// empty, a very long word, text with markup or line breaks, and text that
// ends exactly at the limit); where the two do not fit, About cut and the
// statement kept whole while it leaves 60 characters for About, and the
// whole text cut as before otherwise; and the file is pure code that imports nothing,
// so the site and the server can both read it without the site's bundle
// taking any validation package. Every club here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PAGE_DESCRIPTION_MAX, SITE_HOST, SITE_NAME, clubPageDescription, clubPageTitle, plainText } from '../../domain/clubs/pageMeta'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const CUT = '…'
/** Short made-up words joined by single spaces, as long as asked: 155 is thirty of "club " and then "games". */
function wordsOfLength(n: number): string {
  const text = `${'club '.repeat(Math.floor((n - 5) / 5))}games`
  expect(text.length).toBe(n)
  return text
}

describe('the title', () => {
  it('is the club, the line the site writes, and the association, in the brief\'s words', () => {
    expect(clubPageTitle('Example Chess Club', 'Example City')).toBe('Example Chess Club · Chess club in Example City, Louisiana · Louisiana Chess Association')
    expect(SITE_NAME).toBe('Louisiana Chess Association')
    expect(SITE_HOST).toBe('louisianachess.org')
  })

  it('reads plain text, and leaves the town out of the line when there is none', () => {
    expect(clubPageTitle('  Example <b>Chess</b>\nClub ', ' Example\tCity ')).toBe('Example Chess Club · Chess club in Example City, Louisiana · Louisiana Chess Association')
    expect(clubPageTitle('Example Chess Club', '   ')).toBe('Example Chess Club · Chess club in Louisiana · Louisiana Chess Association')
    expect(clubPageTitle('Example Chess Club', null)).toBe('Example Chess Club · Chess club in Louisiana · Louisiana Chess Association')
  })
})

describe('the description', () => {
  it('is About\'s opening, then the statement, as two sentences', () => {
    expect(clubPageDescription('A friendly made-up club', 'Tuesdays at 7:00 PM.')).toBe('A friendly made-up club. Tuesdays at 7:00 PM.')
    expect(clubPageDescription('A friendly made-up club!', 'Tuesdays at 7:00 PM.')).toBe('A friendly made-up club! Tuesdays at 7:00 PM.')
  })

  it('is the statement alone when About is empty', () => {
    expect(clubPageDescription('', 'Tuesdays at 7:00 PM.')).toBe('Tuesdays at 7:00 PM.')
    expect(clubPageDescription(null, ' Tuesdays at 7:00 PM. ')).toBe('Tuesdays at 7:00 PM.')
  })

  it('is About alone when the statement is empty, with no stop added', () => {
    expect(clubPageDescription('A friendly made-up club', '')).toBe('A friendly made-up club')
    expect(clubPageDescription('A friendly made-up club', undefined)).toBe('A friendly made-up club')
  })

  it('is empty when both are empty', () => {
    expect(clubPageDescription('', '')).toBe('')
    expect(clubPageDescription('  \n ', null)).toBe('')
  })

  it('is plain text: markup taken out and line breaks made spaces', () => {
    expect(clubPageDescription('<p>A <strong>friendly</strong> club.</p>\n\n<script>alert(1)</script>', 'Tuesdays\r\nat 7:00 PM.'))
      .toBe('A friendly club. alert(1). Tuesdays at 7:00 PM.')
    expect(plainText('Line one\n\tLine two')).toBe('Line one Line two')
  })

  it('keeps a text that ends exactly at the limit whole, with no mark', () => {
    const exact = wordsOfLength(PAGE_DESCRIPTION_MAX)
    expect(exact.length).toBe(PAGE_DESCRIPTION_MAX)
    expect(clubPageDescription(exact, '')).toBe(exact)
  })

  it('cuts a longer text at the end of a word, never in the middle of one, with the mark, at most 155 characters', () => {
    const long = 'club games '.repeat(40).trim()
    const cut = clubPageDescription(long, '')
    expect(cut.length).toBeLessThanOrEqual(PAGE_DESCRIPTION_MAX)
    expect(cut.endsWith(CUT)).toBe(true)
    const kept = cut.slice(0, -1)
    expect(long.startsWith(kept)).toBe(true)
    // What was kept ends where a word ends.
    expect(long[kept.length]).toBe(' ')
    // One character over the limit is cut too.
    const over = `${wordsOfLength(PAGE_DESCRIPTION_MAX)}s`
    expect(over.length).toBe(PAGE_DESCRIPTION_MAX + 1)
    const once = clubPageDescription(over, '')
    expect(once.length).toBeLessThanOrEqual(PAGE_DESCRIPTION_MAX)
    expect(once.endsWith(CUT)).toBe(true)
    // About's opening and then the statement: About is cut and the statement kept whole.
    const statement = 'Tuesdays from 7:00 PM at Example Library, casual games and a few boards of quick games.'
    const both = clubPageDescription(wordsOfLength(120), statement)
    expect(both.length).toBeLessThanOrEqual(PAGE_DESCRIPTION_MAX)
    expect(both.endsWith(`${CUT} ${statement}`)).toBe(true)
  })

  it('takes no comma or stop before the mark', () => {
    const text = `${'x'.repeat(150)}, ${'more words follow here'}`
    const cut = clubPageDescription(text, '')
    expect(cut).toBe(`${'x'.repeat(150)}${CUT}`)
  })

  it('gives no description, rather than half a word, when a very long word reaches past the limit', () => {
    expect(clubPageDescription('x'.repeat(300), '')).toBe('')
    // No word of About fits whole beside the statement, so the whole text is cut, and its first word is too long for that too.
    expect(clubPageDescription(`https://example.org/${'x'.repeat(200)}`, 'Tuesdays at 7:00 PM.')).toBe('')
    // A very long word after a short one keeps the short one.
    expect(clubPageDescription(`Example ${'x'.repeat(300)}`, '')).toBe(`Example${CUT}`)
  })
})

describe('the description when About is long and there is a statement', () => {
  const ABOUT = 'A friendly made-up club for casual and rated games, where beginners sit down with strong players and nobody minds a slow move. '
    + 'We keep a few boards for quick games in the corner, and a teacher is on hand most weeks to explain the rules to anyone new.'
  const STATEMENT = 'First and third Tuesdays at 7:00 PM'

  it('keeps the statement whole and cuts About to make room for it, so a search result says when the club meets', () => {
    expect(ABOUT.length).toBeGreaterThan(PAGE_DESCRIPTION_MAX)
    const got = clubPageDescription(ABOUT, STATEMENT)
    expect(got).toBe(`A friendly made-up club for casual and rated games, where beginners sit down with strong players and nobody minds a${CUT} ${STATEMENT}`)
    expect(got.length).toBeLessThanOrEqual(PAGE_DESCRIPTION_MAX)
    // About's part is its opening, cut where a word ends, and the next word would not have fitted.
    const kept = got.slice(0, got.indexOf(CUT))
    expect(ABOUT.startsWith(kept)).toBe(true)
    expect(ABOUT[kept.length]).toBe(' ')
    const next = ABOUT.slice(kept.length + 1).split(' ')[0]
    expect(kept.length + 1 + next.length + CUT.length + 1 + STATEMENT.length).toBeGreaterThan(PAGE_DESCRIPTION_MAX)
  })

  it('fills the limit exactly when the cut falls there, and takes no comma or stop before the mark', () => {
    // A statement of 93 characters leaves exactly 60 for About.
    const statement = `Tuesdays ${'y'.repeat(84)}`
    expect(statement.length).toBe(93)
    const about = `${'x'.repeat(59)} ${'z'.repeat(40)}`
    expect(clubPageDescription(about, statement)).toBe(`${'x'.repeat(59)}${CUT} ${statement}`)
    const exact = clubPageDescription(`${'x'.repeat(60)} ${'z'.repeat(40)}`, statement)
    expect(exact).toBe(`${'x'.repeat(60)}${CUT} ${statement}`)
    expect(exact.length).toBe(PAGE_DESCRIPTION_MAX)
    expect(clubPageDescription(`${'x'.repeat(50)}, more. ${'z'.repeat(40)}`, statement)).toBe(`${'x'.repeat(50)}, more${CUT} ${statement}`)
    expect(clubPageDescription(`${'x'.repeat(50)}, ${'z'.repeat(40)}`, statement)).toBe(`${'x'.repeat(50)}${CUT} ${statement}`)
  })

  it('cuts the whole text as before when the statement leaves fewer than 60 characters for About', () => {
    // 94 characters leave 59.
    const statement = `Tuesdays ${'y'.repeat(85)}`
    expect(statement.length).toBe(94)
    const about = 'club games '.repeat(10).trim()
    const got = clubPageDescription(about, statement)
    expect(got.endsWith(CUT)).toBe(true)
    expect(got.length).toBeLessThanOrEqual(PAGE_DESCRIPTION_MAX)
    expect(`${about}. ${statement}`.startsWith(got.slice(0, -1))).toBe(true)
    // One character shorter, and the statement is kept whole.
    expect(clubPageDescription(about, statement.slice(0, -1)).endsWith(`${CUT} ${statement.slice(0, -1)}`)).toBe(true)
  })

  it('reads both as plain text, and keeps the statement whole however About is written', () => {
    const got = clubPageDescription(`<p>${ABOUT.replace('casual', '<strong>casual</strong>\n')}</p>`, `<em>${STATEMENT}</em>\r\n`)
    expect(got.endsWith(`${CUT} ${STATEMENT}`)).toBe(true)
    expect(got).not.toMatch(/[<>\n]/)
    expect(got.length).toBeLessThanOrEqual(PAGE_DESCRIPTION_MAX)
  })
})

describe('the file', () => {
  it('is pure code that imports nothing, so the site and the server can both read it', () => {
    const text = read('domain/clubs/pageMeta.ts')
    expect(text).not.toMatch(/^\s*import\b|\brequire\(|\bimport\(/m)
    expect(text).not.toMatch(/zod|functions\/|src\/|@\//)
    // The site reads it by the alias for domain/, as the editor reads the slug rule.
    expect(read('src/areas/clubs/components/SearchPreview.tsx')).toContain('from \'@domain/clubs/pageMeta\'')
  })
})
