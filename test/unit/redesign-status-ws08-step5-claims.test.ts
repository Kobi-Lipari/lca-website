// test/unit/redesign-status-ws08-step5-claims.test.ts
//
// The WS08 step 5 record's claims about the code that its own record test,
// test/unit/redesign-status-ws08-step5.test.ts, leaves open, checked against
// the files they are about. Each is a claim the plan keeps true through the
// later steps, not a figure of this step's:
// - naming: requireCanAssign reads the event's club and creator, asks
//   creationPerson for the person and canAssignDirectors for the answer, with
//   the constant read inside it from the module the tests mock; it names no
//   role, answers a missing event 404 before the rule and every refusal with
//   today's words; POST and DELETE ask it first and GET does not; and no
//   other code names someone as an event's director (D21: one place decides);
// - the delete: requireAuthedMember first, then the constant, read inside
//   the handler; on the admin's branch requireAdmin first, before the event
//   is read, the entries counted only while the constant is set, and the six
//   deletes one at a time; on the creator's branch the event, its entries
//   over every registrations row and the person, then canDeleteDraft asked
//   about the event's club, creator, visibility and entries, one 403 for a
//   missing event, a refused one and one the batch finds changed or gone,
//   and no second factor asked; the six deletes one list in today's order,
//   the creator's in one batch led by a guard in the section repo's form;
//   and the activity log's row only while the constant is set and only from
//   the request that took the event's row, with the event's name and its
//   four details;
// - the names the delete needs join three import lines already there;
// - tournament_delete follows tournament_unpublish in AdminAction and audit.ts
//   holds no dash; the panel's label follows tournament_unpublish's, with
//   the removed document's icon and tint, and the Events filter names the
//   action right after tournament_unpublish;
// - the delete's one caller on the site is the manage page's danger zone,
//   drawn for an LCA admin alone, and it throws on any answer that is not a
//   success, as the verify item on the one 403 says;
// - the worker the merge redeploys bundles none of the four files of code
//   this step changes.
// It reads the WS08 section of REDESIGN_STATUS.md and the files it names.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

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
const block = part('### WS08 step 5: the president names a one-event director, and a creator deletes a draft')
const decisions = part('### WS08 decisions')
const deviations = part('### WS08 deviations from the brief')
const verify = part('### WS08 verify items resolved')

const DIRECTORS = 'functions/api/admin/tournaments/[id]/directors.ts'
const SAVE = 'functions/api/admin/tournaments/[id].ts'
const AUDIT = 'functions/utils/admin/audit.ts'
const PANEL = 'src/areas/admin/components/AuditLogPanel.tsx'
const CREATE = 'functions/api/admin/tournaments.ts'
const parse = (path: string) =>
  ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)

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

/** Whether a node lies inside another. */
const inside = (node: ts.Node, outer: ts.Node) => node.getStart() >= outer.getStart() && node.getEnd() <= outer.getEnd()

/** The arrow function an exported const of a file is set to. */
function handlerBody(source: ts.SourceFile, name: string): ts.ArrowFunction {
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer && ts.isArrowFunction(declaration.initializer)) {
        return declaration.initializer
      }
    }
  }
  throw new Error(`${source.fileName} has no ${name}`)
}

/** A function declared at the top of a file. */
function functionNamed(source: ts.SourceFile, name: string): ts.FunctionDeclaration {
  const fn = source.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === name)
  if (!fn) throw new Error(`${source.fileName} has no function ${name}`)
  return fn
}

/** The statements of a block body. */
const statementsOf = (fn: ts.ArrowFunction | ts.FunctionDeclaration) => {
  const body = fn.body
  if (!body || !ts.isBlock(body)) throw new Error('not a block body')
  return [...body.statements]
}

/** Text with its runs of white space made one space. */
const flat = (text: string) => text.replace(/\s+/g, ' ').trim()

/** The calls of a name inside a node. */
const callsOf = (root: ts.Node, source: ts.SourceFile, name: string) =>
  nodesOf(root).filter((n): n is ts.CallExpression => ts.isCallExpression(n) && n.expression.getText(source) === name)

/** The string literals inside a node, as the code holds them. */
const stringsOf = (root: ts.Node) => nodesOf(root).filter(ts.isStringLiteralLike).map((n) => n.text)

/** The import declarations of a file, by the module they name. */
const importDeclarations = (source: ts.SourceFile, module: string) =>
  source.statements.filter((s): s is ts.ImportDeclaration => ts.isImportDeclaration(s) && (s.moduleSpecifier as ts.StringLiteral).text === module)
const importedNames = (declaration: ts.ImportDeclaration) => {
  const bindings = declaration.importClause?.namedBindings
  return bindings && ts.isNamedImports(bindings) ? bindings.elements.map((e) => e.name.text) : []
}
/** Whether a node sits on one line of its file. */
const oneLine = (node: ts.Node, source: ts.SourceFile) =>
  source.getLineAndCharacterOfPosition(node.getStart(source)).line === source.getLineAndCharacterOfPosition(node.getEnd()).line

/** Every file under a folder of the repository, its path from the root. */
function walk(folder: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(ROOT, folder))) {
    const path = join(folder, name)
    if (statSync(join(ROOT, path)).isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}

/** The property of an object literal, by its name. */
function propertyOf(object: ts.ObjectLiteralExpression, source: ts.SourceFile, name: string): ts.Expression {
  const found = object.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText(source) === name)
  if (!found) throw new Error(`no ${name} in ${object.getText(source).slice(0, 60)}`)
  return found.initializer
}

/** The words of today's refusal of a naming or a removal. */
const NAMING_WORDS = "Only admins and the organizing club's rep can assign directors"
/** The roles a gate could name. */
const ROLE_NAMES = ['lca_admin', 'club_rep', 'tournament_director', 'lca_observer', 'lca_officer', 'lca_auditor', 'member', 'guest']

describe('naming: requireCanAssign in the directors endpoint (D21)', () => {
  const source = parse(DIRECTORS)
  const gate = functionNamed(source, 'requireCanAssign')
  const statements = statementsOf(gate)
  const naming = bulletOf(block, '- **Naming.**')

  it('reads the event\'s club and creator, asks creationPerson for the person and canAssignDirectors for the answer, about the club, the creator and the constant it read', () => {
    expect(stringsOf(gate).filter((s) => /^SELECT /.test(s))).toEqual(['SELECT id, name, club_id, created_by FROM tournaments WHERE id = ?'])
    expect(callsOf(gate, source, 'creationPerson').map((c) => c.arguments.map((a) => a.getText(source)))).toEqual([['context.env.DB', 'authed.member', 'rolesOn']])
    expect(callsOf(gate, source, 'canAssignDirectors').map((c) => c.arguments.map((a) => flat(a.getText(source))))).toEqual([
      ['person', '{ clubId: tournament.club_id, createdBy: tournament.created_by }', 'rolesOn'],
    ])
    const rules = importDeclarations(source, '../../../../../domain/events/creation')
    expect(rules.flatMap(importedNames)).toEqual(['canAssignDirectors'])
    expect(resolve(ROOT, dirname(DIRECTORS), '../../../../../domain/events/creation')).toBe(join(ROOT, 'domain/events/creation'))
    for (const piece of ['now selects the event\'s `created_by` beside its club', '`canAssignDirectors(person, { clubId, createdBy }, rolesOn)`']) {
      expect(naming, piece).toContain(piece)
    }
  })

  it('reads the constant once, inside requireCanAssign, into a name of the function\'s own, from the module the tests\' getter mocks', () => {
    const from = importDeclarations(source, '../../../../utils/events/creation')
    expect(from.flatMap(importedNames)).toEqual(['CREATION_ROLES_ON', 'creationPerson'])
    expect(resolve(ROOT, dirname(DIRECTORS), '../../../../utils/events/creation')).toBe(join(ROOT, 'functions/utils/events/creation'))
    const reads = nodesOf(source).filter((n): n is ts.Identifier => ts.isIdentifier(n) && n.text === 'CREATION_ROLES_ON' && !ts.isImportSpecifier(n.parent))
    expect(reads).toHaveLength(1)
    expect(inside(reads[0], gate.body!)).toBe(true)
    expect(ts.isVariableDeclaration(reads[0].parent) && reads[0].parent.name.getText(source)).toBe('rolesOn')
    expect(naming).toContain('the constant is read inside the function at each request')
  })

  it('names no role: no role\'s name, no read of the member\'s role and no comparison of the member\'s club', () => {
    expect(stringsOf(gate).filter((s) => ROLE_NAMES.includes(s))).toEqual([])
    expect(nodesOf(gate).filter((n) => ts.isPropertyAccessExpression(n) && (n.name.text === 'role' || n.name.text === 'club_id') && /member/.test(n.expression.getText(source)))).toEqual([])
    expect(entryOf(decisions, 'D21: who names a one-event director (WS08 step 5).')).toContain('the endpoint names no role')
  })

  it('answers a missing event 404 before the rule, reads the person after the event, and refuses with today\'s words and 403', () => {
    const missing = statements.findIndex((s) => ts.isIfStatement(s) && s.expression.getText(source) === '!tournament')
    const person = statements.findIndex((s) => flat(s.getText(source)) === 'const person = await creationPerson(context.env.DB, authed.member, rolesOn)')
    const rule = statements.findIndex((s) => ts.isIfStatement(s) && s.expression.getText(source).startsWith('!canAssignDirectors('))
    expect(missing).toBeGreaterThan(-1)
    expect(person).toBeGreaterThan(missing)
    expect(rule).toBeGreaterThan(person)
    expect(callsOf(statements[missing], source, 'errorResponse').map((c) => [(c.arguments[0] as ts.StringLiteral).text, c.arguments[1].getText(source)])).toEqual([['Tournament not found', '404']])
    expect(callsOf(statements[rule], source, 'errorResponse').map((c) => [(c.arguments[0] as ts.StringLiteral).text, c.arguments[1].getText(source)])).toEqual([[NAMING_WORDS, '403']])
    // The only other answer the gate gives is requireAuthedMember's own, before anything is read.
    expect(nodesOf(gate).filter(ts.isReturnStatement).map((r) => flat(r.getText(source)))).toEqual([
      'return authed',
      "return errorResponse('Tournament not found', 404)",
      `return errorResponse('Only admins and the organizing club\\'s rep can assign directors', 403)`,
      'return { tournamentId, tournamentName: tournament.name, actor: authed.member }',
    ])
    expect(naming).toContain('A missing event still answers 404 "Tournament not found" before the rule, as before')
  })

  it('is asked first by POST and DELETE, and not by GET, which reads neither the constant nor the person', () => {
    for (const name of ['onRequestPost', 'onRequestDelete']) {
      expect(flat(statementsOf(handlerBody(source, name))[0].getText(source)), name).toBe('const gate = await requireCanAssign(context)')
    }
    const get = handlerBody(source, 'onRequestGet')
    for (const name of ['requireCanAssign', 'creationPerson', 'canAssignDirectors']) expect(callsOf(get, source, name), name).toEqual([])
  })

  it('is the one place that names someone as an event\'s director: the endpoint\'s POST writes the row, and the create writes only its creator\'s own', () => {
    const writers = walk('functions')
      .filter((f) => f.endsWith('.ts') && !f.endsWith('db/schema.ts') && !f.endsWith('db/relations.ts'))
      .flatMap((f) => {
        const text = read(f)
        return [
          ...(/INSERT (?:OR IGNORE )?INTO tournament_directors/.test(text) ? [`${f}: insert`] : []),
          ...(/\.insert\(tournamentDirectors\)/.test(text) ? [`${f}: insert`] : []),
        ]
      })
    expect(writers.sort()).toEqual([`${CREATE}: insert`, `${DIRECTORS}: insert`].sort())
    expect(flat(read(CREATE))).toContain('db.insert(tournamentDirectors).values({ tournamentId: id, memberId: member.id })')
    const post = handlerBody(source, 'onRequestPost')
    expect(stringsOf(post).some((s) => s.includes('INSERT OR IGNORE INTO tournament_directors'))).toBe(true)
  })
})

describe('the delete: onRequestDelete in the event endpoint', () => {
  const source = parse(SAVE)
  const del = handlerBody(source, 'onRequestDelete')
  const statements = statementsOf(del)
  const texts = statements.map((s) => flat(s.getText(source)))
  /** The branch on the role: today's path, which ends with its own answer, so the creator's path is what follows it. */
  const branchAt = statements.findIndex((s) => ts.isIfStatement(s) && flat(s.expression.getText(source)) === "member.role === 'lca_admin' || !rolesOn")
  const branch = statements[branchAt] as ts.IfStatement
  const adminBlock = branch.thenStatement as ts.Block
  const adminPath = adminBlock.statements.map((s) => flat(s.getText(source)))
  const creatorStatements = statements.slice(branchAt + 1)
  const creatorPath = creatorStatements.map((s) => flat(s.getText(source)))
  /** The statement of the creator's path that runs its batch. */
  const tryAt = creatorStatements.findIndex(ts.isTryStatement)
  const attempt = creatorStatements[tryAt] as ts.TryStatement
  const remove = bulletOf(block, '- **The delete.**')
  /** A const of the file, by its name. */
  const constOf = (name: string) => {
    const found = source.statements.flatMap((s) => (ts.isVariableStatement(s) ? [...s.declarationList.declarations] : []))
      .find((d) => ts.isIdentifier(d.name) && d.name.text === name)
    if (!found?.initializer) throw new Error(`${SAVE} has no const ${name}`)
    return found.initializer
  }

  it('reads the role first: requireAuthedMember, then the constant, inside the handler from the module the tests mock, and nothing is prepared before the branch', () => {
    expect(texts.slice(0, 5)).toEqual([
      'const tournamentId = context.params.id as string',
      'const authed = await requireAuthedMember(context.request, context.env)',
      'if (isResponse(authed)) return authed',
      'const { member } = authed',
      'const rolesOn = CREATION_ROLES_ON',
    ])
    expect(branchAt).toBe(5)
    expect(statements.slice(0, branchAt).flatMap((s) => callsOf(s, source, 'context.env.DB.prepare'))).toEqual([])
    const reads = nodesOf(del).filter((n) => ts.isIdentifier(n) && n.text === 'CREATION_ROLES_ON')
    expect(reads).toHaveLength(1)
    expect(remove).toContain('`requireAuthedMember`, then the constant, read inside the handler at each request')
  })

  it('takes today\'s path for an LCA admin and for everyone while the constant is unset: requireAdmin first and returned when it answers, then the event, then 404 for a missing one, the entries counted only while the constant is set, the six deletes one at a time and today\'s answer', () => {
    expect(branch.elseStatement).toBeUndefined()
    expect(adminPath).toEqual([
      'const authResult = await requireAdmin(context.request, context.env)',
      'if (isResponse(authResult)) return authResult',
      "const existing = await context.env.DB.prepare( 'SELECT * FROM tournaments WHERE id = ?', ).bind(tournamentId).first<TournamentRow>()",
      "if (!existing) return errorResponse('Tournament not found', 404)",
      'const entries = rolesOn ? await entryCount(context.env.DB, tournamentId) : 0',
      'let removed: D1Result | undefined',
      'for (const statement of EVENT_DELETES) removed = await context.env.DB.prepare(statement).bind(tournamentId).run()',
      "if (rolesOn && tookEvent(removed)) await recordDelete(context.env.DB, member, existing, entries, 'admin')",
      'return jsonResponse({ success: true })',
    ])
    expect(nodesOf(adminBlock).filter((n) => ts.isPropertyAccessExpression(n) && n.name.text === 'batch')).toEqual([])
    expect(remove).toContain('An LCA admin, and everyone while the constant is unset, goes through `requireAdmin` before anything about the event is read')
    expect(remove).toContain('one statement at a time, with `{ success: true }`')
  })

  it('on the creator\'s branch reads the event, its entries and the person, asks canDeleteDraft about the event, gives one 403 for a missing event, a refused one and one the batch finds changed or gone, and asks no second factor', () => {
    expect(creatorPath.slice(0, 4)).toEqual([
      "const existing = await context.env.DB.prepare( 'SELECT * FROM tournaments WHERE id = ?', ).bind(tournamentId).first<TournamentRow>()",
      'const entries = await entryCount(context.env.DB, tournamentId)',
      'const person = await creationPerson(context.env.DB, member, rolesOn)',
      "if (!existing || !canDeleteDraft(person, { clubId: existing.club_id, createdBy: existing.created_by, isVisible: existing.is_visible, entries }, rolesOn)) { return errorResponse('Forbidden', 403) }",
    ])
    // Every answer of the path but its last is the one 403.
    const answers = creatorStatements.flatMap((s) => nodesOf(s).filter(ts.isReturnStatement)).map((r) => flat(r.getText(source)))
    expect(answers).toEqual([
      "return errorResponse('Forbidden', 403)",
      "return errorResponse('Forbidden', 403)",
      "return errorResponse('Forbidden', 403)",
      'return jsonResponse({ success: true })',
    ])
    for (const name of ['requireAdmin', 'requireRole', 'readTokenAal']) {
      expect(creatorStatements.flatMap((s) => callsOf(s, source, name)), name).toEqual([])
    }
    expect(remove).toContain('`canDeleteDraft(person, { clubId, createdBy, isVisible, entries }, rolesOn)`')
    expect(entryOf(decisions, 'An admin\'s delete keeps its two-step sign-in (WS08 step 5).')).toContain('A creator\'s delete of their own draft asks none')
  })

  it('counts the entries over every registrations row, withdrawn and waitlisted ones too', () => {
    const count = functionNamed(source, 'entryCount')
    expect(stringsOf(count)).toEqual(['SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?'])
    expect(callsOf(del, source, 'entryCount')).toHaveLength(2)
    expect(remove).toContain('`SELECT COUNT(*) AS n FROM registrations WHERE tournament_id = ?`, withdrawn ones included')
  })

  it('runs the same six deletes on both paths, one list in today\'s order: the admin\'s one at a time, the creator\'s in the handler\'s one batch, led by the guard', () => {
    const list = constOf('EVENT_DELETES')
    const elements = (ts.isAsExpression(list) ? list.expression : list) as ts.ArrayLiteralExpression
    expect(elements.elements.map((e) => (e as ts.StringLiteral).text)).toEqual([
      'DELETE FROM registrations WHERE tournament_id = ?',
      'DELETE FROM tournament_games WHERE tournament_id = ?',
      'DELETE FROM tournament_directors WHERE tournament_id = ?',
      'DELETE FROM tournament_reminders WHERE tournament_id = ?',
      'DELETE FROM tournament_attendee_reminders WHERE tournament_id = ?',
      'DELETE FROM tournaments WHERE id = ?',
    ])
    // Nothing else in the handler deletes.
    expect(stringsOf(del).filter((s) => /DELETE/i.test(s))).toEqual([])
    const batches = callsOf(del, source, 'context.env.DB.batch')
    expect(batches).toHaveLength(1)
    expect(inside(batches[0], attempt.tryBlock)).toBe(true)
    const batched = (batches[0].arguments[0] as ts.ArrayLiteralExpression).elements.map((e) => flat(e.getText(source)))
    expect(batched).toEqual([
      'draftGuard(context.env.DB, tournamentId, existing.club_id)',
      '...EVENT_DELETES.map((statement) => context.env.DB.prepare(statement).bind(tournamentId))',
    ])
    expect(remove).toContain('The creator\'s six deletes then run in one batch, led by `draftGuard`')
  })

  it('has the guard fail the batch, in the form the section and schedule guards take, for the event\'s row alone when it is published, in another club or has an entry, and answers that failure with the one 403 and any other by throwing', () => {
    const guard = flat(functionNamed(source, 'draftGuard').getText(source))
    expect(guard).toContain("SELECT json_extract('{}', '${DRAFT_GUARD_PATH} ' || id) FROM tournaments WHERE id = ? AND (is_visible IS NOT 0 OR club_id IS NOT ? OR EXISTS (SELECT 1 FROM registrations WHERE tournament_id = ?))")
    expect(guard).toContain('.bind(tournamentId, clubId, tournamentId)')
    expect((constOf('DRAFT_GUARD_PATH') as ts.StringLiteral).text).toBe('$draft changed')
    expect(flat(constOf('DRAFT_GUARD_ERROR').getText(source))).toBe("`bad JSON path: '${DRAFT_GUARD_PATH}`")
    // The section repo's guard takes the same form.
    expect(read('functions/utils/events/sectionsRepo.ts')).toContain("json_extract('{}', ${sql.raw(`'${GUARD_PATH} '`)} || ${tournaments.id})")
    expect(flat(functionNamed(source, 'isDraftChanged').getText(source))).toContain('if (message.includes(DRAFT_GUARD_ERROR)) return true')
    const caught = flat(attempt.catchClause!.block.getText(source))
    expect(caught).toBe("{ if (isDraftChanged(err)) return errorResponse('Forbidden', 403) throw err }")
    expect(remove).toContain('fails the batch, so nothing is deleted, when the event as the batch runs is published, has another club or has an entry')
  })

  it('writes the row only while the constant is set and only from the request that took the event\'s row, with the event\'s name and its four details, and answers as today', () => {
    const record = callsOf(functionNamed(source, 'recordDelete'), source, 'recordAdminAction')
    expect(record).toHaveLength(1)
    expect(record[0].arguments.slice(0, 2).map((a) => a.getText(source))).toEqual(['db', 'member'])
    const entry = record[0].arguments[2] as ts.ObjectLiteralExpression
    expect(propertyOf(entry, source, 'action').getText(source)).toBe("'tournament_delete'")
    expect(propertyOf(entry, source, 'targetLabel').getText(source)).toBe('existing.name')
    expect(flat(propertyOf(entry, source, 'detail').getText(source))).toBe('{ tournament_id: existing.id, entries, was_visible: existing.is_visible, grant }')
    expect(callsOf(del, source, 'recordAdminAction')).toEqual([])
    // tookEvent reads what the event's own delete changed.
    expect(flat(constOf('tookEvent').getText(source))).toBe('(result: D1Result | undefined) => (result?.meta.changes ?? 0) > 0')
    // The admin's row: only while the constant is set and the event's row went.
    expect(adminPath.filter((t) => t.includes('recordDelete('))).toEqual(["if (rolesOn && tookEvent(removed)) await recordDelete(context.env.DB, member, existing, entries, 'admin')"])
    // The creator's row: after the check that the batch took the event's row, on a path only the constant set reaches.
    const gone = creatorPath.indexOf("if (!tookEvent(results.at(-1))) return errorResponse('Forbidden', 403)")
    expect(gone).toBe(tryAt + 1)
    expect(creatorPath.slice(gone + 1)).toEqual([
      'await recordDelete(context.env.DB, member, existing, entries, person.grant)',
      'return jsonResponse({ success: true })',
    ])
    expect(remove).toContain('only from the request whose `DELETE FROM tournaments` took the event\'s row, so a delete sent twice at once is logged once')
    expect(entryOf(deviations, 'The delete\'s audit row is new and waits for the constant (WS08 step 5).')).toContain('written only while `CREATION_ROLES_ON` is set')
  })

  it('joins the names it needs to the import lines already there, each on a line of its own', () => {
    const auth = importDeclarations(source, '../../../utils/auth')
    expect(auth).toHaveLength(1)
    expect(importedNames(auth[0])).toEqual(expect.arrayContaining(['isResponse', 'requireTournamentManager', 'requireAdmin', 'requireAuthedMember']))
    expect(oneLine(auth[0], source)).toBe(true)
    const rules = importDeclarations(source, '../../../../domain/events/creation')
    expect(rules).toHaveLength(1)
    expect(importedNames(rules[0])).toEqual(expect.arrayContaining(['FEES_NEED_PAYOUT_ACCOUNT', 'canChargeFees', 'canDeleteDraft', 'feesRaised', 'CreationGrant']))
    expect(oneLine(rules[0], source)).toBe(true)
    const types = importDeclarations(source, '../../../types')
    expect(types).toHaveLength(1)
    expect(importedNames(types[0])).toEqual(['Env', 'MemberRow', 'TournamentRow'])
    expect(oneLine(types[0], source)).toBe(true)
    expect(bulletOf(block, '- **Files.**')).toContain('`requireAuthedMember`, `canDeleteDraft` and the types `CreationGrant` and `MemberRow` join three import lines already there')
  })
})

describe('the activity log: the action and its label', () => {
  it('puts tournament_delete in AdminAction once, right after tournament_unpublish, and audit.ts holds no dash', () => {
    const source = parse(AUDIT)
    const alias = source.statements.find((s): s is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(s) && s.name.text === 'AdminAction')
    expect(alias && ts.isUnionTypeNode(alias.type)).toBe(true)
    const actions = (alias!.type as ts.UnionTypeNode).types.map((t) => ((t as ts.LiteralTypeNode).literal as ts.StringLiteral).text)
    expect(actions.filter((a) => a === 'tournament_delete')).toHaveLength(1)
    expect(actions[actions.indexOf('tournament_unpublish') + 1]).toBe('tournament_delete')
    expect(read(AUDIT)).not.toMatch(DASHES)
    expect(bulletOf(block, '- **Files.**')).toContain('the one dash in its comments taken out')
  })

  it('labels it "Deleted event" right after tournament_unpublish\'s label, with the icon and the tint of the removed document\'s, and the Events filter names it right after tournament_unpublish, once', () => {
    const source = parse(PANEL)
    const objectOf = (name: string) => {
      const declaration = nodesOf(source).find((n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && n.name.getText(source) === name)
      return declaration?.initializer
    }
    const meta = objectOf('ACTION_META') as ts.ObjectLiteralExpression
    const keys = meta.properties.map((p) => p.name!.getText(source))
    expect(keys.filter((k) => k === 'tournament_delete')).toHaveLength(1)
    expect(keys[keys.indexOf('tournament_unpublish') + 1]).toBe('tournament_delete')
    const label = (key: string) => {
      const value = propertyOf(meta, source, key) as ts.ObjectLiteralExpression
      return ['label', 'icon', 'className'].map((p) => propertyOf(value, source, p).getText(source))
    }
    expect(label('tournament_delete')).toEqual(["'Deleted event'", 'Trash2', "'bg-bad-100 text-bad-800'"])
    expect(label('tournament_delete').slice(1)).toEqual(label('document_remove').slice(1))

    const filters = objectOf('FILTERS') as ts.ArrayLiteralExpression
    const events = filters.elements.map((e) => e as ts.ObjectLiteralExpression).find((o) => propertyOf(o, source, 'label').getText(source) === "'Events'")
    const list = (propertyOf(events!, source, 'value') as ts.StringLiteral).text.split(',')
    expect(list.filter((a) => a === 'tournament_delete')).toHaveLength(1)
    expect(list[list.indexOf('tournament_unpublish') + 1]).toBe('tournament_delete')
    expect(bulletOf(block, '- **The delete.**')).toContain('the activity log draws it as "Deleted event", with the bin icon on the red tint `document_remove` uses, under the Events filter, whose list of actions gains it')
  })
})

describe('the delete\'s caller on the site, as the verify item on the one 403 says', () => {
  it('is the manage page alone, from its danger zone, drawn for an LCA admin alone, and the call throws on any answer that is not a success', () => {
    const callers = walk('src')
      .filter((f) => /\.(ts|tsx)$/.test(f) && f !== 'src/areas/events/api.ts')
      .filter((f) => /\badminDeleteTournament\(/.test(read(f)))
    expect(callers).toEqual(['src/pages/TournamentManagePage.tsx'])

    const api = parse('src/areas/events/api.ts')
    const call = functionNamed(api, 'adminDeleteTournament')
    expect(statementsOf(call).map((s) => flat(s.getText(api))).at(-1)).toBe('return handleResponse(response)')
    const http = parse('src/lib/http.ts')
    const handle = functionNamed(http, 'handleResponse')
    const refusal = nodesOf(handle).find((n): n is ts.IfStatement => ts.isIfStatement(n) && n.expression.getText(http) === '!response.ok')
    expect(refusal && nodesOf(refusal.thenStatement).some(ts.isThrowStatement)).toBe(true)

    const page = parse('src/pages/TournamentManagePage.tsx')
    const wired = nodesOf(page).filter((n): n is ts.JsxAttribute => ts.isJsxAttribute(n) && n.initializer?.getText(page) === '{handleDeleteTournament}')
    expect(wired).toHaveLength(1)
    let at: ts.Node | undefined = wired[0]
    let guarded = false
    while (at) {
      if (ts.isBinaryExpression(at) && at.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && flat(at.left.getText(page)) === "myRole === 'lca_admin'") guarded = true
      at = at.parent
    }
    expect(guarded).toBe(true)
    expect(entryOf(verify, 'The one 403 for a missing event (WS08 step 5).')).toContain('reads any answer that is not a success as an error, so no page reads the difference')
  })
})

/** The file an import names, from the file that imports it, or null. */
function resolveImport(from: string, specifier: string): string | null {
  const base = resolve(dirname(join(ROOT, from)), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return relative(ROOT, candidate)
  }
  return null
}

/** Every file an entry reaches through relative imports and re-exports, types included. */
function closure(entry: string): Set<string> {
  const files = new Set<string>()
  const queue = [entry]
  while (queue.length > 0) {
    const file = queue.shift()!
    if (files.has(file)) continue
    files.add(file)
    for (const { fileName } of ts.preProcessFile(read(file), true, true).importedFiles) {
      if (!fileName.startsWith('.')) continue
      const found = resolveImport(file, fileName)
      expect(found, `${file}: ${fileName}`).not.toBeNull()
      queue.push(found!)
    }
  }
  return files
}

describe('what ships with every switch off, as the block says', () => {
  it('the worker the merge redeploys bundles none of the four files of code this step changes', () => {
    const files = closure('workers/daily-emails/src/index.ts')
    for (const usual of ['functions/utils/time.ts', 'functions/utils/email.ts']) expect([...files], usual).toContain(usual)
    for (const file of [DIRECTORS, SAVE, AUDIT, PANEL]) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect([...files], file).not.toContain(file)
    }
    expect(bulletOf(block, '- **What ships with every switch off.**')).toContain('the worker imports none of the files this step changes')
  })
})
