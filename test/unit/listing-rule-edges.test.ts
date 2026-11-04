// test/unit/listing-rule-edges.test.ts
//
// The one listing condition (D26, WS02 step 9) held more closely than
// test/unit/listing-rule.test.ts holds it: there, a listed file's SQL text
// that reads tournaments must call listedWhere somewhere in the same text.
// Here, each read of tournaments must hand listedWhere the very name or
// alias it gives the table, so a second copy of the table read under
// another alias, or the condition written for another one, does not pass;
// and the condition must stand in the WHERE clause as one of its terms
// joined by AND, never after OR, never under NOT and never in the columns
// read, where it would list nothing. Planted sources show the check fails
// each of those and passes the forms the search writes. The texts are read,
// never run. Last, listedWhere refuses any alias but a plain SQL name: no
// letter with a mark, no space at either end, no quoting of any kind.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { listedWhere } from '../../functions/utils/events/listing'

const ROOT = join(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** The files whose public reads of tournaments the listing condition holds, as test/unit/listing-rule.test.ts lists them. */
const LISTED = ['functions/api/search.ts', 'functions/utils/search.ts']

/** Words that may follow a table's name in SQL and are no alias. */
const KEYWORDS = new Set(['WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'ON', 'USING', 'ORDER', 'GROUP', 'LIMIT', 'UNION', 'HAVING', 'AS'])

/** Every SQL text in a source that reads tournaments: its string and template literals, a template's placeholders kept as written. */
function readsOfTournaments(name: string, source: string): string[] {
  const file = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) found.push(node.text)
    else if (ts.isTemplateExpression(node)) found.push(node.getText(file).slice(1, -1))
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found.filter((text) => /\b(?:FROM|JOIN)\s+tournaments\b/i.test(text))
}

/** The names a SQL text reads tournaments under: each alias, or the table's own name where it has none. */
function tournamentNames(sql: string): string[] {
  return [...sql.matchAll(/\b(?:FROM|JOIN)\s+tournaments\b(?:\s+(?:AS\s+)?([A-Za-z_][A-Za-z0-9_]*))?/gi)].map(([, alias]) =>
    alias && !KEYWORDS.has(alias.toUpperCase()) ? alias : 'tournaments')
}

/** The WHERE clause of a SQL text, up to its ORDER BY, GROUP BY or LIMIT. */
function whereClause(sql: string): string {
  const at = sql.search(/\bWHERE\b/i)
  if (at < 0) return ''
  const rest = sql.slice(at + 'WHERE'.length)
  const end = rest.search(/\b(?:ORDER\s+BY|GROUP\s+BY|LIMIT)\b/i)
  return end < 0 ? rest : rest.slice(0, end)
}

/** What a SQL text that reads tournaments does against the rule, one sentence each; empty when it keeps it. */
function conditionProblems(sql: string): string[] {
  const problems: string[] = []
  const where = whereClause(sql)
  const terms = where.split(/\bAND\b/i).map((term) => term.trim())
  for (const name of new Set(tournamentNames(sql))) {
    const call = `\${listedWhere('${name}')}`
    if (!sql.includes(call)) problems.push(`reads tournaments as ${name} with no listedWhere('${name}')`)
    else if (!terms.includes(call)) problems.push(`puts listedWhere('${name}') somewhere other than a term of the WHERE clause joined by AND`)
  }
  if (/\bOR\b/i.test(where)) problems.push('joins a term of the WHERE clause with OR, which would list what the condition leaves out')
  if (/\bNOT\b/i.test(where)) problems.push('turns a term of the WHERE clause around with NOT')
  return problems
}

describe('each read of tournaments in the listed files', () => {
  it('finds the search\'s two reads of tournaments, its upcoming events and its results, so the checks below are not blind', () => {
    const reads = LISTED.flatMap((file) => readsOfTournaments(file, read(file)))
    expect(reads).toHaveLength(2)
    expect(reads.map((sql) => tournamentNames(sql))).toEqual([['t'], ['t']])
  })

  it.each(LISTED)('%s hands listedWhere the name it reads the table under, as a term of the WHERE clause joined by AND, with no OR and no NOT', (file) => {
    for (const sql of readsOfTournaments(file, read(file))) expect(conditionProblems(sql), sql.replace(/\s+/g, ' ')).toEqual([])
  })
})

describe('the check itself, on planted SQL texts', () => {
  it.each([
    ['the condition taken under the alias the table is read under', 'SELECT t.id FROM tournaments t WHERE ${listedWhere(\'t\')} AND t.date >= ? ORDER BY t.date LIMIT ?'],
    ['the condition alone, under the table\'s own name where it has no alias', 'SELECT id FROM tournaments WHERE ${listedWhere(\'tournaments\')} LIMIT ?'],
    ['the condition for a table joined to another', 'SELECT c.name FROM clubs c JOIN tournaments t ON t.club_id = c.id WHERE c.city = ? AND ${listedWhere(\'t\')}'],
    ['the alias given with AS', 'SELECT e.id FROM tournaments AS e WHERE ${listedWhere(\'e\')} AND e.date >= ?'],
  ])('passes %s', (_what, sql) => {
    expect(conditionProblems(sql)).toEqual([])
  })

  it.each([
    ['the condition written for another alias than the table\'s', 'SELECT x.id FROM tournaments x WHERE ${listedWhere(\'t\')} AND x.date >= ?', 'reads tournaments as x with no listedWhere(\'x\')'],
    ['a second copy of the table read under an alias of its own with no condition', 'SELECT t.id FROM tournaments t JOIN tournaments u ON u.id = t.id WHERE ${listedWhere(\'t\')}', 'reads tournaments as u with no listedWhere(\'u\')'],
    ['a subquery that reads the table with no condition', 'SELECT id FROM clubs WHERE id IN (SELECT club_id FROM tournaments)', 'reads tournaments as tournaments with no listedWhere(\'tournaments\')'],
    ['the condition among the columns read, where it lists nothing', 'SELECT ${listedWhere(\'t\')} AS listed, t.id FROM tournaments t WHERE t.date >= ?', 'puts listedWhere(\'t\') somewhere other than a term of the WHERE clause joined by AND'],
    ['the condition after its ORDER BY', 'SELECT t.id FROM tournaments t WHERE t.date >= ? ORDER BY ${listedWhere(\'t\')}', 'puts listedWhere(\'t\') somewhere other than a term of the WHERE clause joined by AND'],
    ['a term joined with OR', 'SELECT t.id FROM tournaments t WHERE ${listedWhere(\'t\')} OR t.date >= ?', 'joins a term of the WHERE clause with OR, which would list what the condition leaves out'],
    ['the condition turned around with NOT', 'SELECT t.id FROM tournaments t WHERE NOT ${listedWhere(\'t\')}', 'puts listedWhere(\'t\') somewhere other than a term of the WHERE clause joined by AND'],
  ])('fails %s', (_what, sql, problem) => {
    expect(conditionProblems(sql)).toContain(problem)
  })

  it('finds the reads in a source the way it finds them in the listed files, in a plain string and in a template', () => {
    const source = [
      'const a = \'SELECT id FROM tournaments\'',
      'const b = `SELECT t.id FROM tournaments t WHERE ${listedWhere(\'t\')}`',
      'const c = `SELECT id FROM clubs`',
    ].join('\n')
    expect(readsOfTournaments('planted.ts', source).map(conditionProblems)).toEqual([
      ['reads tournaments as tournaments with no listedWhere(\'tournaments\')'],
      [],
    ])
  })
})

describe('the aliases listedWhere takes', () => {
  it.each(['t', 'T', 'T1', '_', 'tournament_rows', 'TOURNAMENTS'])('writes today\'s condition under the plain name %j', (alias) => {
    expect(listedWhere(alias)).toBe(`${alias}.is_visible = 1`)
  })

  it.each([
    ['a letter with a mark', 'té'],
    ['a space after it', 't '],
    ['a space before it', ' t'],
    ['a line break after it', 't\n'],
    ['backticks', '`t`'],
    ['square brackets', '[t]'],
    ['double quotes', '"t"'],
    ['a comment', 't--'],
    ['a second condition', 't.is_visible = 1 OR 1'],
  ])('refuses %s, naming what it was handed', (_what, alias) => {
    expect(() => listedWhere(alias)).toThrow(/^listedWhere takes a table's name or alias, not "/)
  })
})
