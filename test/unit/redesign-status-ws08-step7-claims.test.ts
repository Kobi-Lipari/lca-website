// test/unit/redesign-status-ws08-step7-claims.test.ts
//
// The WS08 step 7 record's claims about the code that its own record test,
// test/unit/redesign-status-ws08-step7.test.ts, leaves open, checked against
// the files they are about, as they hold at WS08 step 7. The later steps of
// this part keep them true, since none of them changes either endpoint or
// createTicket. The parts of WS08 named to change the two endpoints rewrite
// this file with them: the Phase 4 part, which adds the member organizer's
// two fields to the grant answer, and the admin home part, which turns the
// payout request into a queue row once ADMIN_HOME_ON is set. createTicket's
// callers are another matter: the brief has later workstreams open tickets
// through it or change a form's call of it (WS04's listing reports, the
// event reports of the Phase 4 part, and the region target WS09 adds to
// POST /api/contact, then the whole board), so its callers are read by
// containment, the two forms only for leaving out the three inputs this
// step adds, and no comment of another file is pinned here. No count or
// figure is read from the code.
// - the grant answer: CREATION_ROLES_ON from the module the tests mock, read
//   once, inside the handler, after the sign-in, into rolesOn; the answer's
//   four fields, in order, from the calls the record quotes, typed with the
//   contract; jsonResponse with the answer alone, so no header of its own;
//   no statement prepared and no email module imported, so it stores and
//   sends nothing; GET and OPTIONS alone;
// - the payout request: the constant read once, in the refusal, which comes
//   right after the sign-in and before the body and every read; the body
//   through parseBody and the contract's schema; the open request read by the
//   statement the record quotes; the event read only after
//   canManageTournament says yes, its days from eventDays; one call of
//   createTicket with the member's own name and address, the record's
//   subject and words, the kind, the guard and no seat; no statement of its
//   own that writes; the 409's words the record's; the ticket answered by its
//   id, kind and status alone, never its number, as the record's decision
//   says (that the member's own support list and conversation answer without
//   it is test/integration/me-creation-edges.test.ts's to hold); POST and
//   OPTIONS alone;
// - createTicket: the guarded insert and the message's insert are the
//   statements the record quotes; today's insert is the aggregate the record
//   describes, with no WHERE and no GROUP BY; every statement it prepares
//   binds as many values as it has places; created comes from the guarded
//   insert's changed rows alone, and when nothing was inserted it returns
//   before any email;
// - its callers: the support form, the contact form and the payout request
//   among them, the two forms passing none of the three new inputs, which
//   the same reading finds in the payout request's call.
// It reads the WS08 section of REDESIGN_STATUS.md and the files it names.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
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
/** A bullet and the indented lines under it. */
const bulletOf = (text: string, start: string) => {
  const lines = text.split('\n')
  const at = lines.findIndex((l) => l.startsWith(start))
  if (at < 0) return ''
  let end = at + 1
  while (end < lines.length && /^\s+\S/.test(lines[end])) end++
  return lines.slice(at, end).join('\n')
}
const block = part('### WS08 step 7: what a person may create, and the payout request')
const grantPart = bulletOf(block, '- **The grant answer.**')
const payoutPart = bulletOf(block, '- **The payout request.**')
const filesPart = bulletOf(block, '- **Files.**')
const calls = bulletOf(block, '- **Judgement calls.**')
/** An entry of one of the section's four lists, by its bold head. */
const entryOf = (list: string, name: string) => list.split('\n').find((l) => l.startsWith(`- **${name}**`)) ?? ''
const decisions = part('### WS08 decisions')
/** The pieces of a record's text that sit in backticks. */
const quoted = (text: string) => [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1])
/** The statement the record quotes that starts so, in the payout request's part. */
const quotedStatement = (start: string) => quoted(payoutPart).find((q) => q.startsWith(start)) ?? ''

const GRANT = 'functions/api/me/tournament-creation.ts'
const PAYOUT = 'functions/api/me/payout-request.ts'
const TICKETS = 'functions/utils/admin/tickets.ts'
/** The three inputs this step adds to createTicket, in the order the payout request passes them. */
const NEW_INPUTS = ['kind', 'aboutId', 'oneOpenPerMember']
const parse = (path: string) => ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

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
/** Text with its runs of white space made one space. */
const flat = (text: string) => text.replace(/\s+/g, ' ').trim()
/** A statement of SQL as one line, with no space inside the brackets. */
const flatSql = (text: string) => flat(text).replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
/** The calls inside a node whose callee is the name given, or a property of that name. */
const callsOf = (root: ts.Node, source: ts.SourceFile, name: string) =>
  nodesOf(root).filter((n): n is ts.CallExpression => ts.isCallExpression(n) && (
    n.expression.getText(source) === name || (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === name)
  ))
/** The string literals inside a node, as the code holds them. */
const stringsOf = (root: ts.Node) => nodesOf(root).filter(ts.isStringLiteralLike).map((n) => n.text)
/** A function declared at the top of a file. */
function functionNamed(source: ts.SourceFile, name: string): ts.FunctionDeclaration {
  const fn = source.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === name)
  if (!fn) throw new Error(`${source.fileName} has no function ${name}`)
  return fn
}
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
/** The statements of a block body. */
const statementsOf = (fn: ts.ArrowFunction | ts.FunctionDeclaration) => {
  const body = fn.body
  if (!body || !ts.isBlock(body)) throw new Error('not a block body')
  return [...body.statements]
}
/** The names a file imports from a module. */
const importedFrom = (source: ts.SourceFile, module: string) =>
  source.statements
    .filter((s): s is ts.ImportDeclaration => ts.isImportDeclaration(s) && (s.moduleSpecifier as ts.StringLiteral).text === module)
    .flatMap((d) => {
      const bindings = d.importClause?.namedBindings
      return bindings && ts.isNamedImports(bindings) ? bindings.elements.map((e) => e.name.text) : []
    })
/** The modules a file imports. */
const modulesOf = (source: ts.SourceFile) =>
  source.statements.filter(ts.isImportDeclaration).map((d) => (d.moduleSpecifier as ts.StringLiteral).text)
/** The identifiers of a tree that name something, leaving out the names an import brings in. */
const usesOf = (root: ts.Node, name: string) =>
  nodesOf(root).filter((n): n is ts.Identifier => ts.isIdentifier(n) && n.text === name && !ts.isImportSpecifier(n.parent))
/** The names a file exports as handlers, in order. */
const handlersOf = (source: ts.SourceFile) =>
  source.statements
    .filter((s): s is ts.VariableStatement => ts.isVariableStatement(s) && !!s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
    .flatMap((s) => s.declarationList.declarations.map((d) => d.name.getText(source)))
/** The variable declared under a name inside a tree. */
function declaration(root: ts.Node, source: ts.SourceFile, name: string): ts.VariableDeclaration {
  const found = nodesOf(root).find((n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && n.name.getText(source) === name)
  if (!found) throw new Error(`no ${name}`)
  return found
}
/** The properties of an object literal, each name with its value's text. */
const propertiesOf = (literal: ts.ObjectLiteralExpression, source: ts.SourceFile) =>
  literal.properties.map((p) => [p.name?.getText(source) ?? '', ts.isPropertyAssignment(p) ? flat(p.initializer.getText(source)) : p.getText(source)] as const)
/** The SQL a prepare call is given, as one line. */
const sqlOf = (call: ts.CallExpression) => {
  const arg = call.arguments[0]
  if (!arg || !ts.isStringLiteralLike(arg)) throw new Error(`a prepare call with no plain SQL: ${arg?.getText()}`)
  return flatSql(arg.text)
}
/** The bind call chained on a prepare call, if any. */
const bindOf = (prepare: ts.CallExpression): ts.CallExpression | null => {
  const access = prepare.parent
  return ts.isPropertyAccessExpression(access) && access.name.text === 'bind' && ts.isCallExpression(access.parent) ? access.parent : null
}
/** Every TypeScript file under a folder of the repository, its path from the root, skipping folders whose name starts with a dot. */
function walk(folder: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(ROOT, folder))) {
    if (name.startsWith('.') || name === 'node_modules') continue
    const path = join(folder, name)
    if (statSync(join(ROOT, path)).isDirectory()) out.push(...walk(path))
    else if (/\.tsx?$/.test(name)) out.push(path.split('\\').join('/'))
  }
  return out
}

describe('the grant answer, GET /api/me/tournament-creation', () => {
  const source = parse(GRANT)
  const get = handlerBody(source, 'onRequestGet')
  const statements = statementsOf(get)
  const at = (test: (text: string) => boolean) => statements.findIndex((s) => test(flat(s.getText(source))))

  it('reads CREATION_ROLES_ON once, inside its handler and after the sign-in, into rolesOn, from the module the tests mock', () => {
    expect(importedFrom(source, '../../utils/events/creation').sort()).toEqual(['CREATION_ROLES_ON', 'creationPerson'])
    const reads = usesOf(source, 'CREATION_ROLES_ON')
    expect(reads).toHaveLength(1)
    expect(inside(reads[0], get)).toBe(true)
    expect(flat(declaration(get, source, 'rolesOn').getText(source))).toBe('rolesOn = CREATION_ROLES_ON')
    const signIn = at((t) => t === 'const authed = await requireAuthedMember(context.request, context.env)')
    const refused = at((t) => t === 'if (isResponse(authed)) return authed')
    const constant = at((t) => t === 'const rolesOn = CREATION_ROLES_ON')
    const person = at((t) => t === 'const person = await creationPerson(context.env.DB, authed.member, rolesOn)')
    expect([signIn, refused, constant, person]).toEqual([0, 1, 2, 3])
    expect(grantPart).toContain('reads `CREATION_ROLES_ON` once into `rolesOn` at each request')
  })

  it('gives the four fields the record names, in order, from the calls it quotes, typed with the contract', () => {
    const answer = declaration(get, source, 'answer')
    expect(answer.type?.getText(source)).toBe('TournamentCreationResponse')
    expect(importedFrom(source, '../../../domain/contracts/me')).toEqual(['TournamentCreationResponse'])
    expect(answer.initializer && ts.isObjectLiteralExpression(answer.initializer)).toBe(true)
    const fields = propertiesOf(answer.initializer as ts.ObjectLiteralExpression, source)
    expect(fields).toEqual([
      ['grant', 'person.grant'],
      ['canCreate', 'canCreate(person, null, rolesOn)'],
      ['canChargeFees', 'canChargeFees(person, { clubId: person.repClubId, createdBy: null }, rolesOn)'],
      ['clubId', 'person.repClubId'],
    ])
    for (const [, code] of fields.slice(1)) expect(quoted(grantPart), code).toContain(code)
    expect(importedFrom(source, '../../../domain/events/creation').sort()).toEqual(['canChargeFees', 'canCreate'])
  })

  it('answers with jsonResponse and the answer alone, prepares no statement and imports no email module, and serves GET and OPTIONS alone', () => {
    expect(callsOf(get, source, 'jsonResponse').map((c) => c.arguments.map((a) => a.getText(source)))).toEqual([['answer']])
    expect(callsOf(source, source, 'prepare')).toEqual([])
    expect(modulesOf(source).filter((m) => /email/i.test(m))).toEqual([])
    expect(handlersOf(source)).toEqual(['onRequestOptions', 'onRequestGet'])
    expect(grantPart).toContain('no cache header of its own')
    expect(grantPart).toContain('it stores and sends nothing')
  })
})

describe('the payout request, POST /api/me/payout-request', () => {
  const source = parse(PAYOUT)
  const post = handlerBody(source, 'onRequestPost')
  const statements = statementsOf(post)
  const at = (test: (text: string) => boolean) => statements.findIndex((s) => test(flat(s.getText(source))))

  it('reads the constant once, in the refusal, right after the sign-in and before the body and every read, from the module the tests mock', () => {
    expect(importedFrom(source, '../../utils/events/creation')).toEqual(['CREATION_ROLES_ON'])
    const reads = usesOf(source, 'CREATION_ROLES_ON')
    expect(reads).toHaveLength(1)
    const refusal = at((t) => t === "if (!CREATION_ROLES_ON) return errorResponse('Not available yet.', 403)")
    expect(refusal).toBeGreaterThan(0)
    expect(inside(reads[0], statements[refusal])).toBe(true)
    expect(statements.slice(0, refusal).map((s) => flat(s.getText(source)))).toEqual([
      'const authed = await requireAuthedMember(context.request, context.env)',
      'if (isResponse(authed)) return authed',
      'const { member } = authed',
    ])
    const body = at((t) => t.startsWith('const body = await parseBody('))
    expect(body).toBe(refusal + 1)
    for (const name of ['parseBody', 'openRequest', 'managedEvent', 'createTicket', 'prepare']) {
      for (const call of callsOf(post, source, name)) expect(call.getStart(), name).toBeGreaterThan(statements[refusal].getEnd())
    }
    expect(payoutPart).toContain('refuses with 403, "Not available yet.", while `CREATION_ROLES_ON` is unset, its one read of the constant, before the body or any ticket is read')
  })

  it('reads the body through parseBody with the contract\'s schema, and the open request by the statement the record quotes', () => {
    expect(callsOf(post, source, 'parseBody').map((c) => c.arguments.map((a) => a.getText(source)))).toEqual([['context.request', 'payoutRequestRequestSchema']])
    expect(importedFrom(source, '../../../domain/contracts/me').sort()).toEqual(['PayoutRequestResponse', 'payoutRequestRequestSchema'])
    const open = functionNamed(source, 'openRequest')
    const prepared = callsOf(open, source, 'prepare')
    expect(prepared).toHaveLength(1)
    const statement = quotedStatement('SELECT id, status FROM support_tickets')
    expect(statement).toBe("SELECT id, status FROM support_tickets WHERE member_id = ? AND kind = 'payout_request' AND status IN ('open', 'in_progress') ORDER BY created_at DESC LIMIT 1")
    expect(sqlOf(prepared[0])).toBe(statement)
    expect(callsOf(open, source, 'bind').map((c) => c.arguments.map((a) => a.getText(source)))).toEqual([['memberId']])
    // The three helpers the record's list of files names.
    for (const name of ['openRequest', 'managedEvent', 'answer']) {
      expect(() => functionNamed(source, name), name).not.toThrow()
      expect(filesPart, name).toContain(`\`${name}\``)
    }
  })

  it('reads the event only once canManageTournament says the member manages it, and writes its days with eventDays', () => {
    const managed = functionNamed(source, 'managedEvent')
    const steps = statementsOf(managed)
    expect(steps.slice(0, 2).map((s) => flat(s.getText(source)))).toEqual([
      'if (!tournamentId) return null',
      'if (!(await canManageTournament(db, member, tournamentId))) return null',
    ])
    const prepared = callsOf(managed, source, 'prepare')
    expect(prepared.map(sqlOf)).toEqual(['SELECT id, name, date, end_date FROM tournaments WHERE id = ?'])
    for (const call of prepared) expect(call.getStart()).toBeGreaterThan(steps[1].getEnd())
    expect(callsOf(managed, source, 'eventDays').map((c) => c.arguments.map((a) => a.getText(source)))).toEqual([['event.date', 'event.end_date']])
    expect(importedFrom(source, '../../utils/events/publishedReview')).toEqual(['eventDays'])
    expect(importedFrom(source, '../../utils/admin/permissions')).toEqual(['canManageTournament'])
    expect(payoutPart).toContain('the days from `eventDays` in `functions/utils/events/publishedReview.ts`')
  })

  it('opens the ticket through one call of createTicket with the member\'s own name and address, the record\'s subject and words, the kind, the guard and no seat, and writes nothing itself', () => {
    const opened = callsOf(source, source, 'createTicket')
    expect(opened).toHaveLength(1)
    expect(opened[0].arguments[0].getText(source)).toBe('context.env')
    const input = Object.fromEntries(propertiesOf(opened[0].arguments[1] as ts.ObjectLiteralExpression, source))
    expect(input).toEqual({
      name: 'name', email: 'member.email', subject: '`Payout account request from ${name}`', body: 'message', memberId: 'member.id', seatRef: 'null',
      siteUrl: 'siteUrlFromRequest(context.request, context.env)', kind: "'payout_request'", aboutId: 'event?.id ?? null', oneOpenPerMember: 'true',
    })
    expect(flat(declaration(post, source, 'name').getText(source))).toBe('name = member.full_name')
    expect(payoutPart).toContain('the subject "Payout account request from Remy Guidry"')
    // The words of the message, with the record's example name in the code's place for it.
    const message = declaration(post, source, 'message').initializer!
    const words = nodesOf(message).find(ts.isTemplateExpression)
    expect(words).toBeDefined()
    const text = words!.getText(source).slice(1, -1).split('${name}').join('Remy Guidry')
    expect(payoutPart).toContain(`the message "${text}"`)
    expect(stringsOf(source).filter((s) => /\b(?:INSERT|UPDATE|DELETE)\b/i.test(s))).toEqual([])
    expect(handlersOf(source)).toEqual(['onRequestOptions', 'onRequestPost'])
  })

  it('answers 201 for a ticket it opened and 200 for one it found, and the 409 in the record\'s words', () => {
    const answer = functionNamed(source, 'answer')
    expect(callsOf(answer, source, 'jsonResponse').map((c) => c.arguments.map((a) => flat(a.getText(source))))).toEqual([['body', 'created ? 201 : 200']])
    const refusals = callsOf(post, source, 'errorResponse').map((c) => [(c.arguments[0] as ts.StringLiteral).text, c.arguments[1].getText(source)])
    expect(refusals).toEqual([['Not available yet.', '403'], ['We could not save your request just now. Please try again.', '409']])
    expect(calls).toContain('the request answers 409, "We could not save your request just now. Please try again.", storing and sending nothing')
  })

  it('answers the ticket by its id, kind and status alone, never its number, as the decision says', () => {
    // The ticket the answer carries: the open request's, and the one createTicket opened.
    const tickets = nodesOf(source).filter((n): n is ts.ObjectLiteralExpression =>
      ts.isObjectLiteralExpression(n) && propertiesOf(n, source).some(([name]) => name === 'status'))
    expect(tickets.map((t) => propertiesOf(t, source))).toEqual([
      [['id', 'row.id'], ['kind', "'payout_request'"], ['status', 'row.status']],
      [['id', 'result.ticketId'], ['kind', "'payout_request'"], ['status', "'open'"]],
    ])
    expect(usesOf(source, 'ticketNumber')).toEqual([])
    // The decision quotes the rule the member's own support pages keep. Their answers are held to it by
    // test/integration/me-creation-edges.test.ts, not by the words of another file's comments here.
    const decision = entryOf(decisions, 'The payout request\'s answer carries no ticket number (WS08 step 7).')
    expect(decision).toContain('"Ticket numbers are for staff and board members only."')
    expect(payoutPart).toContain('`{ ticket: { id, kind: \'payout_request\', status: \'open\' }, created: true }`')
  })
})

describe('createTicket, the one statement and its guard', () => {
  const source = parse(TICKETS)
  const fn = functionNamed(source, 'createTicket')
  const prepared = callsOf(fn, source, 'prepare')
  const sql = prepared.map(sqlOf)

  it('runs the guarded insert and the message\'s insert the record quotes, and today\'s insert as the aggregate it describes', () => {
    const guarded = quotedStatement('INSERT INTO support_tickets')
    const message = quotedStatement('INSERT INTO support_messages')
    expect(guarded).toMatch(/WHERE NOT EXISTS \(SELECT 1 FROM support_tickets WHERE member_id = \? AND kind = \? AND status IN \('open', 'in_progress'\)\)$/)
    expect(message).toMatch(/WHERE EXISTS \(SELECT 1 FROM support_tickets WHERE id = \?\)$/)
    expect(sql).toContain(guarded)
    expect(sql).toContain(message)
    const today = sql.filter((s) => s.startsWith('INSERT INTO support_tickets') && s !== guarded)
    expect(today).toHaveLength(1)
    expect(today[0]).toMatch(/^INSERT INTO support_tickets \(id, number, member_id, name, email, subject, seat_id, kind, about_id\) SELECT \?, COALESCE\(MAX\(number\), 1000\) \+ 1, /)
    expect(today[0].endsWith(' FROM support_tickets')).toBe(true)
    expect(today[0]).not.toMatch(/\bWHERE\b|\bGROUP BY\b/)
    expect(payoutPart).toContain('Today\'s insert, an aggregate with no `GROUP BY`, yields a row even when its `WHERE` leaves none')
  })

  it('binds every statement it prepares with as many values as it has places', () => {
    expect(prepared.length).toBeGreaterThanOrEqual(4)
    for (const call of prepared) {
      const bind = bindOf(call)
      expect(bind, sqlOf(call)).not.toBeNull()
      expect(bind!.arguments.length, sqlOf(call)).toBe((sqlOf(call).match(/\?/g) ?? []).length)
    }
  })

  it('counts the ticket as created from the guarded insert\'s changed rows alone, and returns before any email when nothing was inserted', () => {
    expect(flat(declaration(fn, source, 'guarded').getText(source))).toBe('guarded = Boolean(input.oneOpenPerMember && memberId && kind)')
    const early = nodesOf(fn).filter((n): n is ts.IfStatement => ts.isIfStatement(n) && n.expression.getText(source).includes('results[0]'))
    expect(early).toHaveLength(1)
    expect(flat(early[0].expression.getText(source))).toBe('guarded && (results[0]?.meta?.changes ?? 0) === 0')
    expect(flat(early[0].thenStatement.getText(source))).toBe('{ return { ticketId, ticketNumber: null, seat, holders, created: false } }')
    expect(usesOf(fn, 'changes').length).toBe(1)
    const sends = callsOf(fn, source, 'trySendEmail')
    expect(sends.length).toBe(3)
    for (const send of sends) expect(send.getStart()).toBeGreaterThan(early[0].getEnd())
    const returns = nodesOf(fn).filter(ts.isReturnStatement).map((r) => flat(r.getText(source)))
    expect(returns.at(-1)).toBe('return { ticketId, ticketNumber, seat, holders, created: true }')
    expect(payoutPart).toContain('The batch\'s first `meta.changes` gives `created` on the guarded form, today\'s form always inserting')
  })

  it('is called by the support form, the contact form and the payout request, among any callers later work adds, the two forms passing none of the three new inputs', () => {
    const callers = [...walk('functions'), ...walk('workers')].filter((file) => {
      if (file === TICKETS) return false
      const text = read(file)
      if (!text.includes('createTicket')) return false
      const tree = parse(file)
      return callsOf(tree, tree, 'createTicket').length > 0
    })
    // Containment, not equality: the brief has later workstreams open tickets through createTicket as well.
    expect(callers).toEqual(expect.arrayContaining(['functions/api/contact.ts', 'functions/api/me/payout-request.ts', 'functions/api/support.ts']))
    /** The new inputs a file's calls of createTicket name, read from every property written inside each call. */
    const newInputs = (file: string) => {
      const tree = parse(file)
      return callsOf(tree, tree, 'createTicket').flatMap((call) =>
        nodesOf(call)
          .filter((n): n is ts.PropertyAssignment | ts.ShorthandPropertyAssignment => ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n))
          .map((n) => n.name.getText(tree))
          .filter((name) => NEW_INPUTS.includes(name)))
    }
    // The same reading finds all three in the payout request's call, so finding none in a form's call means something.
    expect(newInputs(PAYOUT)).toEqual(NEW_INPUTS)
    for (const form of ['functions/api/support.ts', 'functions/api/contact.ts']) {
      const tree = parse(form)
      expect(callsOf(tree, tree, 'createTicket').length, form).toBeGreaterThan(0)
      expect(newInputs(form), form).toEqual([])
    }
    expect(payoutPart).toContain('Its two callers today, `POST /api/support` and `POST /api/contact`, pass none of the three new inputs')
  })
})
