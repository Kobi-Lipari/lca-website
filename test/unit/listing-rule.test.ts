// test/unit/listing-rule.test.ts
//
// The one listing condition (D26, WS02 step 9): a public query of
// tournaments decides what is listed through listedWhere, in
// functions/utils/events/listing.ts, today's rule that a hidden draft is not
// listed, and never by naming the column itself. This reads the text of the
// files whose public queries of tournaments are held to the rule (LISTED),
// never running a query, and fails when one of them names the column or
// reads tournaments in a SQL text that does not call listedWhere. The rule's
// own home is read apart, since it alone must name the column, once.
//
// The search's two files are listed now: functions/api/search.ts, the page,
// and functions/utils/search.ts, which holds its reads. As brief 1.4 lists
// them, WS03 adds its shared event query and /api/home, WS04 GET
// /api/clearinghouse, GET /api/events, the list feed, the saved-search email
// and every branch of GET /api/tournaments, and WS09 its sitemap, each moving
// its query to listedWhere as it joins the list.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { listedWhere } from '../../functions/utils/events/listing'

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** The files whose public queries of tournaments take the listing condition from listedWhere. */
const LISTED = ['functions/api/search.ts', 'functions/utils/search.ts']

/** The rule's one home, which names the column. */
const HOME = 'functions/utils/events/listing.ts'

/** The column's name, which no listed file writes. */
const COLUMN = 'is_visible'

/** A SQL text that reads tournaments, under any alias or none. */
const READS_TOURNAMENTS = /\b(?:FROM|JOIN)\s+tournaments\b/i

/** Every string and template literal in a source, as written, a template's placeholders included. */
function literals(name: string, source: string): string[] {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) found.push(node.text)
    else if (ts.isTemplateExpression(node)) found.push(node.getText(file))
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

/** What a listed file does against the rule, one sentence each; empty when it keeps it. */
function listingProblems(name: string, source: string): string[] {
  const problems: string[] = []
  if (source.includes(COLUMN)) problems.push(`${name} names ${COLUMN} itself; take the condition from listedWhere`)
  for (const text of literals(name, source)) {
    if (READS_TOURNAMENTS.test(text) && !text.includes('${listedWhere(')) {
      problems.push(`${name} reads tournaments without listedWhere: ${text.replace(/\s+/g, ' ').trim().slice(0, 80)}`)
    }
  }
  return problems
}

describe('the listed files take the listing condition from listedWhere', () => {
  it.each(LISTED)('%s exists', (file) => {
    expect(existsSync(join(ROOT, file))).toBe(true)
  })

  it.each(LISTED)('%s keeps the rule: no word of the column, and every read of tournaments through listedWhere', (file) => {
    expect(listingProblems(file, read(file))).toEqual([])
  })

  it('finds the search\'s reads of tournaments, each through listedWhere, so the check above is not blind', () => {
    const reads = literals('search.ts', read('functions/utils/search.ts')).filter((text) => READS_TOURNAMENTS.test(text))
    expect(reads.length).toBeGreaterThan(0)
    for (const text of reads) expect(text).toContain('${listedWhere(\'t\')}')
  })
})

describe('the rule\'s home', () => {
  const home = read(HOME)

  it('exports listedWhere and writes the column\'s condition once', () => {
    expect(home).toMatch(/^export function listedWhere\(alias: string\): string \{$/m)
    expect(home.split(`${COLUMN} = 1`)).toHaveLength(2)
  })

  it('gives today\'s rule under the alias it is handed', () => {
    expect(listedWhere('t')).toBe(`t.${COLUMN} = 1`)
    expect(listedWhere('tournaments')).toBe(`tournaments.${COLUMN} = 1`)
    expect(listedWhere('_t2')).toBe(`_t2.${COLUMN} = 1`)
  })

  it.each([
    ['a second statement', 't; DROP TABLE x'],
    ['nothing at all', ''],
    ['a column rather than a table', 't.x'],
    ['a space inside', 'tournaments t'],
    ['a quote', "t'"],
    ['a digit first', '2t'],
  ])('refuses %s as an alias rather than write it into the SQL', (_what, alias) => {
    expect(() => listedWhere(alias)).toThrow(Error)
  })
})

describe('the check itself, on planted sources', () => {
  it('fails a query of tournaments that writes the condition itself', () => {
    const planted = 'const sql = `SELECT t.id FROM tournaments t WHERE t.is_visible = 1 ORDER BY t.date`'
    const problems = listingProblems('planted.ts', planted)
    expect(problems).toHaveLength(2)
    expect(problems[0]).toBe(`planted.ts names ${COLUMN} itself; take the condition from listedWhere`)
    expect(problems[1]).toMatch(/^planted\.ts reads tournaments without listedWhere: SELECT t\.id FROM tournaments t WHERE/)
  })

  it('fails the column named anywhere, a comment or a second condition beside listedWhere included', () => {
    expect(listingProblems('planted.ts', "// rows whose is_visible is 1\nconst x = 1")).toHaveLength(1)
    expect(listingProblems('planted.ts', "const sql = `SELECT t.id FROM tournaments t WHERE ${listedWhere('t')} AND t.is_visible = 1`")).toHaveLength(1)
  })

  it('passes a query that takes the condition from listedWhere', () => {
    const planted = "const sql = `SELECT t.id FROM tournaments t WHERE ${listedWhere('t')} AND t.date >= ? LIMIT ?`"
    expect(listingProblems('planted.ts', planted)).toEqual([])
  })

  it('fails a query that reads tournaments with neither, in a plain string or a template, joined or not', () => {
    for (const planted of [
      "const sql = 'SELECT id, name FROM tournaments ORDER BY date'",
      'const sql = `SELECT c.name FROM clubs c JOIN tournaments t ON t.club_id = c.id`',
      "const sql = `SELECT id FROM tournaments WHERE date >= ${today}`",
    ]) expect(listingProblems('planted.ts', planted), planted).toHaveLength(1)
  })

  it('leaves alone a SQL text that reads no tournaments, and a word that only starts like the table\'s name', () => {
    expect(listingProblems('planted.ts', "const sql = 'SELECT id FROM clubs ORDER BY name'")).toEqual([])
    expect(listingProblems('planted.ts', "const sql = 'SELECT id FROM tournament_sections'")).toEqual([])
  })
})
