// test/unit/redesign-status-ws08-step3-claims.test.ts
//
// The WS08 step 3 record's claims about the code that its own record test,
// test/unit/redesign-status-ws08-step3.test.ts, leaves open, checked against
// the files they are about. Each is a claim the plan keeps true through the
// later steps, not a figure of this step's:
// - the create reads CREATION_ROLES_ON inside its handler, at each request,
//   from the module the tests mock, and never into a name of its own
//   module, as the verify item "The getter reaches the handler" says;
// - the club line the block and the ended follow-up quote is the handler's,
//   word for word, and the handler's two refusals the block calls today's
//   are "Forbidden";
// - the first director row is the Drizzle insert the verify item names, in
//   the create's one batch right after the event's insert and before the
//   sections' queries; Drizzle writes it as the verify item quotes it; and
//   directors.ts's statement is the INSERT OR IGNORE it is the form of;
// - runBatch takes SectionQuery, Drizzle's BatchItem<'sqlite'>, and hands
//   its list to db.batch, so a raw prepared statement cannot join it;
// - canManageTournament admits an event's directors by their rows and never
//   reads created_by, as the block's "The former grant", the verify item on
//   the five endpoints and the decision "Who is written as a first
//   director" say.
// It reads the WS08 section of REDESIGN_STATUS.md and the files it names.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { getDb } from '../../functions/db/client'
import { tournamentDirectors } from '../../functions/db/schema'

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')
const status = read('REDESIGN_STATUS.md')

const HEADING = '## WS08: Director and admin tools (TD console, setup checklist, admin home and queues)'
const ws08 = (() => {
  const start = status.indexOf(`\n${HEADING}\n`)
  const end = status.indexOf('\n## WS09:', start + 1)
  return start < 0 ? '' : status.slice(start + 1, end < 0 ? undefined : end)
})()
/** A part of the section, from its heading to the next heading. */
const part = (heading: string) => {
  const at = ws08.indexOf(`\n${heading}\n`)
  if (at < 0) return ''
  const next = ws08.indexOf('\n### ', at + heading.length + 1)
  return ws08.slice(at + 1, next < 0 ? undefined : next)
}
const entries = (text: string) => text.split('\n').filter((l) => l.startsWith('- **'))
const entryOf = (text: string, head: string) => entries(text).find((l) => l.startsWith(`- **${head}`)) ?? ''
/** A bullet and the indented lines under it. */
const bulletOf = (text: string, start: string) => {
  const lines = text.split('\n')
  const at = lines.findIndex((l) => l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < lines.length && /^\s+\S/.test(lines[end])) end++
  return lines.slice(at, end).join('\n')
}
const block = part('### WS08 step 3: the create through the creation rules and the first director')
const verify = part('### WS08 verify items resolved')
const decisions = part('### WS08 decisions')
const followUps = ws08.slice(ws08.indexOf('\n### WS08 follow-ups\n') + 1)

const HANDLER = 'functions/api/admin/tournaments.ts'
const source = ts.createSourceFile(HANDLER, read(HANDLER), ts.ScriptTarget.Latest, true)

/** Every node of a tree, in source order. */
function nodesOf(root: ts.Node): ts.Node[] {
  const out: ts.Node[] = []
  const visit = (node: ts.Node) => {
    out.push(node)
    ts.forEachChild(node, visit)
  }
  visit(root)
  return out
}

/** The arrow function an exported const of the handler file is set to. */
function handlerBody(name: string): ts.ArrowFunction {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer && ts.isArrowFunction(declaration.initializer)) {
        return declaration.initializer
      }
    }
  }
  throw new Error(`${HANDLER} has no ${name}`)
}
const post = handlerBody('onRequestPost')
const within = (node: ts.Node, outer: ts.Node) => node.getStart(source) >= outer.getStart(source) && node.getEnd() <= outer.getEnd()

describe('the create reads CREATION_ROLES_ON at each request', () => {
  const uses = nodesOf(source).filter((n): n is ts.Identifier => ts.isIdentifier(n) && n.text === 'CREATION_ROLES_ON')

  it('imports it from functions/utils/events/creation.ts, the module the tests\' getter mocks', () => {
    const imports = source.statements.filter(ts.isImportDeclaration)
      .filter((d) => d.importClause?.namedBindings && ts.isNamedImports(d.importClause.namedBindings)
        && d.importClause.namedBindings.elements.some((e) => e.name.text === 'CREATION_ROLES_ON'))
    expect(imports.map((d) => (d.moduleSpecifier as ts.StringLiteral).text)).toEqual(['../../utils/events/creation'])
    expect(resolve(ROOT, 'functions/api/admin', '../../utils/events/creation')).toBe(join(ROOT, 'functions/utils/events/creation'))
  })

  it('reads it inside onRequestPost alone, never at the top of its module', () => {
    const reads = uses.filter((n) => !ts.isImportSpecifier(n.parent))
    expect(reads.length).toBeGreaterThan(0)
    for (const read of reads) expect(within(read, post.body), read.getText(source)).toBe(true)
    const topLevelNames = source.statements.filter(ts.isVariableStatement)
      .flatMap((s) => s.declarationList.declarations)
      .filter((d) => d.initializer && nodesOf(d.initializer).some((n) => ts.isIdentifier(n) && n.text === 'CREATION_ROLES_ON') && !ts.isArrowFunction(d.initializer))
    expect(topLevelNames.map((d) => d.name.getText(source))).toEqual([])
    const item = entryOf(verify, 'The getter reaches the handler (WS08 step 3).')
    expect(item).toContain('reads it inside the handler at each request, never into a variable of its module')
  })
})

describe('the words and the club line the block quotes', () => {
  const create = bulletOf(block, '- **The create.**')
  const text = post.body.getText(source)

  it('the club line is the handler\'s, word for word, as the block and the ended follow-up quote it', () => {
    const line = 'const clubId = person.repClubId ?? (body.clubId ?? null)'
    expect(create).toContain(`\`${line}\``)
    const seat = entryOf(followUps, 'A club rep who holds the seat creates its own club\'s draft (WS08 step 3).')
    expect(seat).toContain(`\`${line}\``)
    expect(text.split('\n').map((l) => l.trim())).toContain(line)
  })

  it('the first refusal and the rules\' refusal are today\'s "Forbidden", the only refusals of the create with that word', () => {
    const refusals = nodesOf(post.body).filter((n): n is ts.CallExpression => ts.isCallExpression(n) && n.expression.getText(source) === 'errorResponse')
    const forbidden = refusals.filter((c) => ts.isStringLiteral(c.arguments[0]) && c.arguments[0].text === 'Forbidden')
    expect(forbidden.map((c) => c.arguments[1]?.getText(source))).toEqual(['403', '403'])
    // The first is the create's first refusal of all; the second follows the club rep's two and the LCA-run one.
    expect(refusals.indexOf(forbidden[0])).toBe(0)
    const words = refusals.map((c) => c.arguments[0].getText(source))
    expect(words.indexOf('LCA_RUN_ONLY')).toBe(words.lastIndexOf('LCA_RUN_ONLY'))
    expect(refusals.indexOf(forbidden[1])).toBe(words.indexOf('LCA_RUN_ONLY') + 1)
    expect(create).toContain('is 403 "Forbidden", today\'s first refusal, before the body is read')
    expect(create).toContain('`canCreate(person, clubId, rolesOn)` answering no is 403 "Forbidden", today\'s words')
  })
})

describe('the first director row, as the verify item says', () => {
  const item = entryOf(verify, 'runBatch takes Drizzle queries alone (WS08 step 3).')
  const batches = nodesOf(post.body).filter((n): n is ts.CallExpression => ts.isCallExpression(n) && n.expression.getText(source) === 'runBatch')

  it('goes in the create\'s one batch, right after the event\'s insert and before the sections\' queries', () => {
    expect(batches).toHaveLength(1)
    const list = batches[0].arguments[1]
    expect(ts.isArrayLiteralExpression(list)).toBe(true)
    const elements = (list as ts.ArrayLiteralExpression).elements.map((e) => e.getText(source))
    expect(elements.indexOf('...firstDirector')).toBe(elements.indexOf('insert') + 1)
    expect(elements.indexOf('insert')).toBe(0)
    expect(elements.indexOf('...plan.queries')).toBeGreaterThan(elements.indexOf('...firstDirector'))
    const declared = (name: string) => nodesOf(post.body).find((n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && n.name.getText(source) === name)
    expect(declared('insert')?.initializer?.getText(source)).toMatch(/^db\.insert\(tournaments\)\.values\(/)
    expect(declared('firstDirector')?.initializer?.getText(source))
      .toContain('db.insert(tournamentDirectors).values({ tournamentId: id, memberId: member.id }).onConflictDoNothing()')
    expect(item).toContain('`db.insert(tournamentDirectors).values({ tournamentId, memberId }).onConflictDoNothing()`')
    expect(item).toContain('in the same batch as the event\'s insert, right after it')
    expect(bulletOf(block, '- **The create.**')).toContain('right after the event\'s insert and before the sections\' queries')
  })

  it('is written by Drizzle as the verify item quotes it, the form of directors.ts\'s INSERT OR IGNORE', () => {
    const quoted = /which Drizzle writes as `([^`]+)`/.exec(item)
    expect(quoted, 'the quoted statement').not.toBeNull()
    // Building the query sends nothing anywhere.
    const built = getDb({} as never).insert(tournamentDirectors).values({ tournamentId: 'event', memberId: 'creator' }).onConflictDoNothing().toSQL()
    expect(built.sql).toBe(quoted![1])
    expect(built.params).toEqual(['event', 'creator'])
    const directors = read('functions/api/admin/tournaments/[id]/directors.ts').replace(/\s+/g, ' ')
    expect(directors).toContain('INSERT OR IGNORE INTO tournament_directors (tournament_id, member_id) VALUES (?, ?)')
    expect(item).toContain('the statement of `functions/api/admin/tournaments/[id]/directors.ts` in Drizzle\'s form')
  })

  it('runBatch takes SectionQuery, Drizzle\'s BatchItem<\'sqlite\'>, and hands its list to db.batch', () => {
    const repo = read('functions/utils/events/sectionsRepo.ts')
    expect(repo).toContain('export type SectionQuery = BatchItem<\'sqlite\'>')
    const runBatch = /export async function runBatch\(db: Db, queries: readonly SectionQuery\[\]\): Promise<void> \{([\s\S]*?)\n\}/.exec(repo)
    expect(runBatch, 'runBatch in sectionsRepo.ts').not.toBeNull()
    expect(runBatch![1]).toContain('await db.batch(queries')
    for (const piece of ['hands its list to `db.batch`', 'takes `SectionQuery`, Drizzle\'s `BatchItem<\'sqlite\'>`']) expect(item, piece).toContain(piece)
  })
})

describe('canManageTournament never reads created_by', () => {
  it('admits an event\'s directors by their rows and reads no created_by, as the block, the verify item and the decision say', () => {
    const file = 'functions/utils/admin/permissions.ts'
    const permissions = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true)
    const fn = permissions.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'canManageTournament')
    expect(fn).toBeDefined()
    const body = fn!.body!.getText(permissions)
    expect(body).not.toMatch(/created_?by/i)
    // The director rows are how it admits an event's directors, the creator's first director row among them.
    const calls = nodesOf(fn!.body!).filter(ts.isCallExpression).map((c) => c.expression.getText(permissions))
    expect(calls).toContain('isTournamentDirector')
    expect(bulletOf(block, '- **The former grant.**')).toContain('`canManageTournament` never reads it')
    expect(entryOf(verify, 'The five endpoints a former creator is refused (WS08 step 3).'))
      .toContain('`canManageTournament` reads the role, the event\'s club and the director rows alone')
    expect(entryOf(decisions, 'Who is written as a first director (WS08 step 3).')).toContain('`canManageTournament` admits an event\'s directors and never reads `created_by`')
  })
})
