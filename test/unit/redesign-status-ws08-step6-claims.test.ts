// test/unit/redesign-status-ws08-step6-claims.test.ts
//
// The WS08 step 6 record's claims about the code that its own record test,
// test/unit/redesign-status-ws08-step6.test.ts, leaves open, checked against
// the files they are about. Each is a claim the plan keeps true through the
// later steps, not a figure of this step's, and none is one the console part
// is named to change (the worker's imports and the notice's own imports are
// test/unit/published-review-closure.test.ts's, which that part rewrites):
// - the mark: markReviewNotified prepares the one statement the record
//   quotes, binds the event's id, runs it and answers whether it changed
//   exactly one row; and nothing else in the server or the worker writes
//   review_notified_at, by a statement or through Drizzle;
// - the order: sendPublishedReviewNotice asks the creator's grant first and
//   the mark second, each ending it when it says no, before any read and
//   any send; it reads the event with its creator's name in one statement
//   and the admins' addresses in the one the record quotes, ordered by
//   address; it sends with trySendEmail alone, in a loop over the
//   addresses, each message with one address; and all of it runs inside
//   one try statement whose catch logs a failure with console.warn and
//   throws nothing, the mark counted as set the moment its statement says
//   so, so the notice never throws;
// - creatorIsStandingDirector asks creatorGrant about the event with the
//   constant read at its own call, from the module the tests mock, and
//   creatorGrant reads the creator in one statement joining the event to
//   its creator, with no import of functions/utils/admin/members.ts;
// - the dates: eventDays gives the record's three examples and builds on
//   formatDate alone, the notice names formatEventDate nowhere in its code,
//   formatDate writes the two forms the verify item quotes, and an end date
//   equal to the start is one day for formatEventDate too;
// - the email: built with renderEmail, emailDetails and p, its button
//   renderEmail's cta field, which the layout draws as its button; the
//   verify item on the layout helpers names, as the ones
//   staffTicketNotificationEmail builds its email with, only helpers that
//   template calls; the words the record quotes are the code's own, the
//   subject in the plan's form, and Look it over goes to
//   /admin/tournaments/ and the event's id, encoded, on the address
//   resolveSiteUrl gives, a path the site's router has;
// - the save: onRequestPatch asks for the notice once, after the batch and
//   before the publish's row, in the request and never through waitUntil,
//   only while the constant it read once is set and only on the change from
//   hidden to listed, and the row's detail gains the two keys only then;
// - members.email is not unique: migration 0046 indexes it with no UNIQUE.
// It reads the WS08 section of REDESIGN_STATUS.md and the files it names.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { eventDays } from '../../functions/utils/events/publishedReview'
import { formatEventDate } from '../../functions/utils/emailLayout'
import { formatDate } from '../../domain/format/date'

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
const block = part('### WS08 step 6: the notice to the LCA admins at a standing director\'s first publish')
const decisions = part('### WS08 decisions')
const verify = part('### WS08 verify items resolved')
const noticePart = bulletOf(block, '- **The notice.**')
const markPart = bulletOf(block, '- **The mark.**')
const datesPart = bulletOf(block, '- **The dates.**')
const calls = bulletOf(block, '- **Judgement calls.**')
/** The pieces of a record's text that sit in backticks. */
const quoted = (text: string) => [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1])

const NOTICE = 'functions/utils/events/publishedReview.ts'
const SAVE = 'functions/api/admin/tournaments/[id].ts'
const LAYOUT = 'functions/utils/emailLayout.ts'
const EMAIL = 'functions/utils/email.ts'
const CREATION = 'functions/utils/events/creation.ts'
const parse = (path: string) =>
  ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)

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
/** The import declarations of a file, by the module they name. */
const importDeclarations = (source: ts.SourceFile, module: string) =>
  source.statements.filter((s): s is ts.ImportDeclaration => ts.isImportDeclaration(s) && (s.moduleSpecifier as ts.StringLiteral).text === module)
const importedNames = (declaration: ts.ImportDeclaration) => {
  const bindings = declaration.importClause?.namedBindings
  return bindings && ts.isNamedImports(bindings) ? bindings.elements.map((e) => e.name.text) : []
}
/** The identifiers of a tree that name something, leaving out the names an import brings in. */
const usesOf = (root: ts.Node, name: string) =>
  nodesOf(root).filter((n): n is ts.Identifier => ts.isIdentifier(n) && n.text === name && !ts.isImportSpecifier(n.parent))
/** Every TypeScript file under a folder of the repository, its path from the root, skipping folders whose name starts with a dot. */
function walk(folder: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(join(ROOT, folder))) {
    if (name.startsWith('.') || name === 'node_modules') continue
    const path = join(folder, name)
    if (statSync(join(ROOT, path)).isDirectory()) out.push(...walk(path))
    else if (/\.tsx?$/.test(name)) out.push(path)
  }
  return out
}

const notice = parse(NOTICE)

describe('the mark: one statement decides the send', () => {
  const mark = functionNamed(notice, 'markReviewNotified')

  it('markReviewNotified prepares the one statement the record quotes, binds the event\'s id, runs it and answers whether it changed exactly one row', () => {
    const statement = quoted(markPart).find((q) => q.startsWith('UPDATE tournaments'))
    expect(statement).toBe("UPDATE tournaments SET review_notified_at = datetime('now') WHERE id = ? AND is_visible = 1 AND review_notified_at IS NULL")
    const prepares = callsOf(mark, notice, 'prepare')
    expect(prepares).toHaveLength(1)
    expect((prepares[0].arguments[0] as ts.StringLiteral).text).toBe(statement)
    expect(callsOf(mark, notice, 'bind').map((c) => c.arguments.map((a) => a.getText(notice)))).toEqual([['tournamentId']])
    expect(callsOf(mark, notice, 'run')).toHaveLength(1)
    expect(nodesOf(mark).filter(ts.isReturnStatement).map((r) => flat(r.getText(notice)))).toEqual(['return result.meta.changes === 1'])
    // The decision quotes the same statement.
    expect(quoted(entryOf(decisions, 'The mark decides the send (WS08 step 6).'))).toContain(statement)
    expect(markPart).toContain('answers whether its `meta.changes` is 1')
  })

  it('nothing else in the server or the worker writes review_notified_at, by a statement or through a Drizzle set or values', () => {
    const writes: string[] = []
    for (const file of [...walk('functions'), ...walk('workers')]) {
      const source = parse(file)
      for (const node of nodesOf(source)) {
        if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
          const text = flat(ts.isTemplateExpression(node) ? node.getText(source) : node.text)
          if (/\bSET\b.*\breview_notified_at\s*=/i.test(text) || /\bINSERT\b.*\breview_notified_at\b/i.test(text)) writes.push(`${file}: ${text}`)
        }
        if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && node.name.getText(source) === 'reviewNotifiedAt') {
          let at: ts.Node | undefined = node.parent
          while (at && !ts.isCallExpression(at)) at = at.parent
          if (at && ts.isCallExpression(at) && ts.isPropertyAccessExpression(at.expression) && ['set', 'values'].includes(at.expression.name.text)) {
            writes.push(`${file}: ${at.expression.name.text}({ reviewNotifiedAt })`)
          }
        }
      }
    }
    expect(writes).toEqual([`${NOTICE}: UPDATE tournaments SET review_notified_at = datetime('now') WHERE id = ? AND is_visible = 1 AND review_notified_at IS NULL`])
    expect(markPart).toContain('No other statement writes the column')
  })
})

describe('the order of the notice: the grant, then the mark, then the reads, then the sends, inside one try statement', () => {
  const send = functionNamed(notice, 'sendPublishedReviewNotice')
  /** The one try statement of the notice's body, around everything it reads, writes and sends. */
  const guarded = statementsOf(send).find(ts.isTryStatement)
  const statements = guarded ? [...guarded.tryBlock.statements] : []
  const texts = statements.map((s) => flat(s.getText(notice)))

  it('never throws: two counts, one try statement around everything it reads, writes and sends, whose catch logs with console.warn and throws nothing, then the answer of what had happened by then', () => {
    expect(statementsOf(send).map((s) => (ts.isTryStatement(s) ? 'try' : flat(s.getText(notice))))).toEqual([
      'let notified = false', 'let sent = 0', 'try', 'return { notified, sent }',
    ])
    expect(guarded?.finallyBlock).toBeUndefined()
    const handler = guarded?.catchClause
    expect(handler).toBeDefined()
    expect(nodesOf(handler!).filter(ts.isThrowStatement)).toEqual([])
    expect(handler!.block.statements.map((st) => (ts.isExpressionStatement(st) && ts.isCallExpression(st.expression) ? st.expression.expression.getText(notice) : flat(st.getText(notice))))).toEqual([
      'console.warn',
    ])
    for (const name of ['creatorIsStandingDirector', 'markReviewNotified', 'prepare', 'publishedReviewEmail', 'resolveSiteUrl', 'trySendEmail']) {
      const found = callsOf(send, notice, name)
      expect(found.length, name).toBeGreaterThan(0)
      for (const call of found) expect(inside(call, guarded!.tryBlock), name).toBe(true)
    }
    // The mark counts as set the moment its statement answers that it changed the row, before anything else is read.
    expect(texts[2]).toBe('notified = true')
    expect(noticePart).toContain('It never throws: its statements run inside one `try`, whose `catch` logs an error from any of them with `console.warn`')
    expect(calls).toContain('logs it with `console.warn` for the Worker tail, as `recordAdminAction` does its own')
  })

  it('asks the creator\'s grant first and the mark second, each ending it when it says no, before anything is read or sent', () => {
    expect(texts.slice(0, 2)).toEqual([
      'if (!(await creatorIsStandingDirector(env.DB, tournamentId))) return { notified: false, sent: 0 }',
      'if (!(await markReviewNotified(env.DB, tournamentId))) return { notified: false, sent: 0 }',
    ])
    // Nothing is prepared or sent in those two statements themselves: the reads and the sends all come after them.
    for (const name of ['prepare', 'trySendEmail', 'sendEmail', 'fetch']) {
      expect(callsOf(statements[0], notice, name).length + callsOf(statements[1], notice, name).length, name).toBe(0)
      for (const call of callsOf(send, notice, name)) expect(call.getStart(), name).toBeGreaterThan(statements[1].getEnd())
    }
    expect(markPart).toContain('The mark is set before the first email')
  })

  it('reads the event with its creator\'s name in one statement, and every admin\'s address in the one the record quotes, ordered by address, before the first send', () => {
    const prepared = callsOf(send, notice, 'prepare').map((c) => flat((c.arguments[0] as ts.StringLiteral).text))
    const admins = quoted(noticePart).find((q) => q.startsWith('SELECT email'))
    expect(admins).toBe("SELECT email, full_name FROM members WHERE role = 'lca_admin' AND email LIKE '%@%' ORDER BY email")
    expect(prepared).toEqual(expect.arrayContaining([
      'SELECT t.id, t.name, t.date, t.end_date, m.full_name FROM tournaments t JOIN members m ON m.id = t.created_by WHERE t.id = ?',
      admins,
    ]))
    const lastRead = Math.max(...callsOf(send, notice, 'prepare').map((c) => c.getEnd()))
    for (const call of callsOf(send, notice, 'trySendEmail')) expect(call.getStart()).toBeGreaterThan(lastRead)
    expect(entryOf(verify, 'The creator\'s row without members.ts (WS08 step 6).')).toContain('the notice reads the creator\'s name with the event in one statement of its own')
  })

  it('sends with trySendEmail alone, in a loop over the addresses, each message the one email with that address as its to, and never the throwing sendEmail', () => {
    const sends = callsOf(send, notice, 'trySendEmail')
    expect(sends.length).toBeGreaterThan(0)
    for (const call of sends) {
      let at: ts.Node | undefined = call.parent
      while (at && !ts.isForOfStatement(at)) at = at.parent
      expect(at && ts.isForOfStatement(at) ? flat(at.expression.getText(notice)) : null).toBe('addresses.values()')
      expect(flat(call.arguments[1].getText(notice))).toBe('{ ...message, to }')
    }
    expect(usesOf(notice, 'sendEmail')).toEqual([])
    expect(noticePart).toContain('one `trySendEmail` to each address, never one message to several')
  })
})

describe('creatorIsStandingDirector: the grant the creator holds now, the constant read at the call', () => {
  const grant = functionNamed(notice, 'creatorIsStandingDirector')

  it('asks creatorGrant about the event with the constant read inside its own body, from the module the tests mock, and never copies it into a name of the file', () => {
    expect(statementsOf(grant).map((s) => flat(s.getText(notice)))).toEqual([
      "return (await creatorGrant(db, tournamentId, CREATION_ROLES_ON)) === 'standing_director'",
    ])
    const reads = usesOf(notice, 'CREATION_ROLES_ON')
    expect(reads.length).toBeGreaterThan(0)
    for (const use of reads) expect(inside(use, grant.body!)).toBe(true)
    const from = importDeclarations(notice, './creation')
    expect(from.flatMap(importedNames)).toEqual(expect.arrayContaining(['CREATION_ROLES_ON', 'creatorGrant']))
    expect(resolve(ROOT, dirname(NOTICE), './creation.ts')).toBe(join(ROOT, CREATION))
    expect(noticePart).toContain('with the constant read at its call')
  })

  it('creatorGrant reads the creator in one statement joining the event to its creator, and creation.ts imports nothing that reaches members.ts', () => {
    const creation = parse(CREATION)
    const reads = stringsOf(functionNamed(creation, 'creatorGrant')).filter((s) => /^SELECT /.test(s))
    expect(reads.map(flat)).toEqual(['SELECT m.id, m.role, m.club_id FROM tournaments t JOIN members m ON m.id = t.created_by WHERE t.id = ?'])
    const specifiers = ts.preProcessFile(read(CREATION), true, true).importedFiles.map((f) => f.fileName)
    expect(specifiers.filter((s) => /members|supabase/.test(s))).toEqual([])
    expect(entryOf(verify, 'The creator\'s row without members.ts (WS08 step 6).')).toContain('reads the creator\'s id, role and club in one statement instead')
  })
})

describe('the dates: eventDays, and why not formatEventDate', () => {
  it('eventDays gives the record\'s three examples, the decision\'s two-day form among them', () => {
    const examples = [...datesPart.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    expect(examples).toEqual(['Sat, Dec 5, 2026', 'Sat, Dec 5 to Sun, Dec 6, 2026', 'Thu, Dec 31, 2026 to Fri, Jan 1, 2027'])
    expect([eventDays('2026-12-05', null), eventDays('2026-12-05', '2026-12-06'), eventDays('2026-12-31', '2027-01-01')]).toEqual(examples)
    expect(entryOf(decisions, 'Two-day dates day by day (WS08 step 6).')).toContain(`"${eventDays('2026-12-05', '2026-12-06')}"`)
  })

  it('builds on formatDate alone, from the date format the worker already bundles, and the notice names formatEventDate nowhere in its code', () => {
    const days = functionNamed(notice, 'eventDays')
    const called = new Set(nodesOf(days).filter(ts.isCallExpression).map((c) => (ts.isPropertyAccessExpression(c.expression) ? c.expression.name.text : c.expression.getText(notice))))
    expect([...called].sort()).toEqual(['exec', 'formatDate', 'yearOf'])
    const from = importDeclarations(notice, '../../../domain/format/date')
    expect(from.flatMap(importedNames)).toEqual(['formatDate'])
    expect(existsSync(resolve(ROOT, dirname(NOTICE), '../../../domain/format/date.ts'))).toBe(true)
    expect(resolve(ROOT, dirname(NOTICE), '../../../domain/format/date.ts')).toBe(join(ROOT, 'domain/format/date.ts'))
    expect(usesOf(notice, 'formatEventDate')).toEqual([])
    expect(datesPart).toContain('so the notice does not use it')
  })

  it('formatDate writes the two forms the verify item quotes, and an end date equal to the start is one day for formatEventDate as for eventDays', () => {
    const item = entryOf(verify, 'formatEventDate\'s two-day form (WS08 step 6).')
    expect(item).toContain('"Sat, Oct 24", or "Sat, Oct 24, 2026" with its year')
    expect([formatDate('2026-10-24'), formatDate('2026-10-24', { year: true })]).toEqual(['Sat, Oct 24', 'Sat, Oct 24, 2026'])
    expect(formatEventDate('2026-12-05', '2026-12-05')).toBe(formatEventDate('2026-12-05'))
    expect(eventDays('2026-12-05', '2026-12-05')).toBe(eventDays('2026-12-05', null))
    expect(entryOf(decisions, 'Two-day dates day by day (WS08 step 6).')).toContain('an end date equal to the start is one day, as `formatEventDate` reads it too')
  })
})

describe('the email: the layout\'s helpers and the words the record quotes', () => {
  const email = functionNamed(notice, 'publishedReviewEmail')
  const strings = stringsOf(email)

  it('is built with renderEmail, emailDetails and p from the layout, its button renderEmail\'s cta field, which the layout draws as its button', () => {
    expect(importDeclarations(notice, '../emailLayout').flatMap(importedNames)).toEqual(expect.arrayContaining(['emailDetails', 'p', 'renderEmail']))
    const render = callsOf(email, notice, 'renderEmail')
    expect(render).toHaveLength(1)
    const layout = render[0].arguments[0] as ts.ObjectLiteralExpression
    const cta = layout.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText(notice) === 'cta')
    expect(cta && flat(cta.initializer.getText(notice))).toBe("{ label: 'Look it over', url }")
    for (const name of ['emailDetails', 'p']) expect(callsOf(email, notice, name), name).toHaveLength(1)

    const layoutFile = parse(LAYOUT)
    const shape = layoutFile.statements.find((s): s is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(s) && s.name.text === 'EmailLayout')
    const field = shape?.members.find((m): m is ts.PropertySignature => ts.isPropertySignature(m) && m.name.getText(layoutFile) === 'cta')
    expect(field && flat(field.type!.getText(layoutFile))).toBe('{ label: string; url: string }')
    expect(callsOf(functionNamed(layoutFile, 'renderEmail'), layoutFile, 'emailButton').map((c) => c.arguments.map((a) => a.getText(layoutFile)))).toEqual([['layout.cta.label', 'layout.cta.url']])

    expect(entryOf(verify, 'The layout helpers (WS08 step 6).')).toContain('its button is `renderEmail`\'s `cta` field, `{ label, url }`, drawn by `emailButton`')
  })

  it('the verify item on the layout helpers names, as the ones staffTicketNotificationEmail builds its email with, only helpers that template calls', () => {
    const layoutFile = parse(LAYOUT)
    const item = entryOf(verify, 'The layout helpers (WS08 step 6).')
    const staff = parse(EMAIL)
    const template = functionNamed(staff, 'staffTicketNotificationEmail')
    const layoutHelpers = layoutFile.statements
      .filter((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && !!s.name && !!s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      .map((s) => s.name!.text)
    const used = layoutHelpers.filter((name) => callsOf(template, staff, name).length > 0).sort()
    expect(used).toEqual(expect.arrayContaining(['emailDetails', 'renderEmail']))
    // The helpers the verify item says staffTicketNotificationEmail builds its email with are ones it calls.
    const clause = /builds its email with (.+?) from `functions\/utils\/emailLayout\.ts`/.exec(item)?.[1] ?? ''
    expect(clause, 'the verify item names the helpers staffTicketNotificationEmail builds its email with').not.toBe('')
    const named = quoted(clause).filter((name) => layoutHelpers.includes(name))
    expect(named.length).toBeGreaterThan(0)
    expect(named.filter((name) => !used.includes(name)), `staffTicketNotificationEmail calls ${used.join(', ')}`).toEqual([])
  })

  it('holds the words the record quotes, writes the subject in the plan\'s form, and sends Look it over to the event\'s manage page, its id encoded, on the address resolveSiteUrl gives', () => {
    for (const words of [
      'A standing director published an event', 'Published by', 'Event', 'When', 'Listed', 'now, on Tournaments', 'Look it over',
      "After the fact: nothing holds a standing director's event. It is already listed. Look it over when you can.",
    ]) expect(strings, words).toContain(words)
    for (const words of ['"A standing director published an event"', '"now, on Tournaments"', 'the button "Look it over"', '"After the fact: nothing holds a standing director\'s event. It is already listed. Look it over when you can."']) {
      expect(noticePart, words).toContain(words)
    }
    const templates = nodesOf(email).filter(ts.isTemplateExpression).map((t) => t.getText(notice))
    expect(templates).toEqual(expect.arrayContaining([
      '`${event.full_name}, standing director`',
      '`Published by ${by}: ${event.name} (${when})`',
      '`${siteUrl}/admin/tournaments/${encodeURIComponent(event.id)}`',
    ]))
    expect(calls).toContain('The button\'s address passes the event\'s id through `encodeURIComponent`')
    // The site's address comes from resolveSiteUrl, and the path is one the site's router draws.
    const send = functionNamed(notice, 'sendPublishedReviewNotice')
    expect(callsOf(send, notice, 'resolveSiteUrl').map((c) => c.arguments.map((a) => a.getText(notice)))).toEqual([['env']])
    expect(read('src/App.tsx')).toContain('<Route path="/admin/tournaments/:id"')
    expect(noticePart).toContain('which opens `/admin/tournaments/` and the event\'s id, its manage page, on the address `resolveSiteUrl` gives')
  })
})

describe('the save: where onRequestPatch asks for the notice', () => {
  const save = parse(SAVE)
  const patch = handlerBody(save, 'onRequestPatch')
  const statements = statementsOf(patch)
  const texts = statements.map((s) => flat(s.getText(save)))
  const batchAt = statements.findIndex((s) => ts.isTryStatement(s) && callsOf(s.tryBlock, save, 'runBatch').length > 0)
  const askAt = texts.indexOf('if (rolesOn && isVisible && !existing.isVisible) notice = await sendPublishedReviewNotice(context.env, tournamentId)')
  const rowAt = statements.findIndex((s) => ts.isIfStatement(s) && flat(s.expression.getText(save)) === 'Number(isVisible) !== Number(existing.isVisible)')

  it('asks once, after the batch and before the publish\'s row, in the request and never through waitUntil, only while the constant read once is set and only on the change from hidden to listed', () => {
    expect(batchAt).toBeGreaterThan(-1)
    expect(askAt).toBeGreaterThan(batchAt)
    expect(rowAt).toBeGreaterThan(askAt)
    expect(callsOf(patch, save, 'sendPublishedReviewNotice')).toHaveLength(1)
    expect(nodesOf(patch).filter((n) => ts.isIdentifier(n) && n.text === 'waitUntil')).toEqual([])
    const reads = usesOf(patch, 'CREATION_ROLES_ON')
    expect(reads).toHaveLength(1)
    expect(ts.isVariableDeclaration(reads[0].parent) && reads[0].parent.name.getText(save)).toBe('rolesOn')
    expect(importDeclarations(save, '../../../utils/events/publishedReview').flatMap(importedNames)).toEqual(['sendPublishedReviewNotice'])
    expect(resolve(ROOT, dirname(SAVE), '../../../utils/events/publishedReview.ts')).toBe(join(ROOT, NOTICE))
    for (const piece of ['between the save\'s batch and the publish\'s row in the activity log, in the request and not through `waitUntil`', '`if (rolesOn && isVisible && !existing.isVisible)`']) {
      expect(noticePart, piece).toContain(piece)
    }
  })

  it('gives the publish\'s row the two keys only when the notice was asked, so an unpublish\'s row and every row while the constant is unset are today\'s', () => {
    const record = callsOf(statements[rowAt], save, 'recordAdminAction')
    expect(record).toHaveLength(1)
    const entry = record[0].arguments[2] as ts.ObjectLiteralExpression
    const property = (name: string) => {
      const found = entry.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText(save) === name)
      return found ? flat(found.initializer.getText(save)) : ''
    }
    expect(property('action')).toBe("isVisible ? 'tournament_publish' : 'tournament_unpublish'")
    expect(property('detail')).toBe('notice ? { tournament_id: tournamentId, review_notified: notice.notified, review_notices_sent: notice.sent } : { tournament_id: tournamentId }')
    // The only write of notice is the ask, which needs isVisible and the constant.
    const writes = nodesOf(patch).filter((n): n is ts.BinaryExpression => ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && n.left.getText(save) === 'notice')
    expect(writes.map((w) => inside(w, statements[askAt]))).toEqual([true])
    expect(noticePart).toContain('with it unset the row is today\'s, `{ tournament_id }`, and an unpublish\'s row is today\'s in both states')
  })
})

describe('members.email is not unique', () => {
  it('migration 0046 indexes members.email with no UNIQUE, and its table declares the column with none, so two rows may share an address', () => {
    const migration = read('migrations/0046_members_safe_rebuild.sql')
    const index = migration.split('\n').filter((l) => /\bON members\s*\(\s*email\s*\)/.test(l))
    expect(index).toEqual(['CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);'])
    const column = migration.split('\n').filter((l) => /^\s*email\s+TEXT\b/i.test(l))
    expect(column.length).toBeGreaterThan(0)
    for (const line of column) expect(line).not.toMatch(/UNIQUE/i)
    expect(entryOf(verify, 'Every admin\'s address (WS08 step 6).')).toContain('`members.email` is not unique, `migrations/0046_members_safe_rebuild.sql` indexing it with no `UNIQUE`')
  })
})
