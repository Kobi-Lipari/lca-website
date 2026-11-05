// test/unit/redesign-status-ws08-step4-claims.test.ts
//
// The WS08 step 4 record's claims about the code that its own record test,
// test/unit/redesign-status-ws08-step4.test.ts, leaves open, checked against
// the files they are about. Each is a claim the plan keeps true through the
// later steps, not a figure of this step's:
// - the save reads CREATION_ROLES_ON inside onRequestPatch, at each request,
//   from the module the tests mock, and never into a name of its own module;
// - the fee rule names no role: it holds no words and reads no role, the
//   person is read by creationPerson only once feesRaised finds a raise, and
//   canChargeFees decides, asked about the event's own club and creator, the
//   refusal being FEES_NEED_PAYOUT_ACCOUNT with 403;
// - the rule comes after the membership rule and before the writers plan
//   their queries, as "The rule" and "The membership switch" say;
// - the comparison reads the rows with the archived ones, before is every
//   row as stored and after the save applied, every row the list does not
//   take kept at its own prices, and the update writes the five pricing
//   columns the comparison read;
// - pricingOf hands tierFees the five names it reads, and early_discount and
//   late_fee are never null in the schema, as the verify item says;
// - savedSectionFees reads the regular price through columnsFromLegacy and
//   the early and late prices through sectionFeeOverrides, as the writer
//   does, and matches by id, then by the live row of a name, then by the
//   archived row of that name, with the writer's own predicates;
// - the create: createdFees is gone, its fee check reads savedSectionFees on
//   the list it hands the writer, worked out before the check, and the empty
//   club id is read as none on the statement right before the club line;
// - the worker the merge redeploys bundles none of the four files of code
//   this step changes;
// - both ways of entering look the entrant's section up among the live rows
//   and refuse an entry without one, in the words the verify item "An
//   event's fee is paid only through a section" quotes, while the waitlist's
//   offer prices an entry from its section's row, archived ones included,
//   and migration 0053's triggers add an archived row for an entry whose
//   section has none, as the same item says.
// It reads the WS08 section of REDESIGN_STATUS.md and the files it names.
import { existsSync, readFileSync, statSync } from 'node:fs'
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
const block = part('### WS08 step 4: the entry fee rule on a save')
const verify = part('### WS08 verify items resolved')
const decisions = part('### WS08 decisions')

const SAVE = 'functions/api/admin/tournaments/[id].ts'
const CREATE = 'functions/api/admin/tournaments.ts'
const REPO = 'functions/utils/events/sectionsRepo.ts'
const RULES = 'domain/events/creation.ts'
const parse = (path: string) => ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true)

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

/** The statements of an arrow function's block body. */
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

/** The names a file imports from each module. */
function importsOf(source: ts.SourceFile): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    const bindings = statement.importClause?.namedBindings
    const names = bindings && ts.isNamedImports(bindings) ? bindings.elements.map((e) => e.name.text) : []
    const from = (statement.moduleSpecifier as ts.StringLiteral).text
    out.set(from, [...(out.get(from) ?? []), ...names])
  }
  return out
}

const save = parse(SAVE)
const patchFn = handlerBody(save, 'onRequestPatch')
const patchStatements = statementsOf(patchFn)
const create = parse(CREATE)
const postFn = handlerBody(create, 'onRequestPost')
const postStatements = statementsOf(postFn)
const repo = parse(REPO)

/** The top-level statement of the handler whose text starts with the words given. */
const statementAt = (statements: ts.Statement[], source: ts.SourceFile, starts: string) =>
  statements.findIndex((s) => flat(s.getText(source)).startsWith(starts))
const feeRule = patchStatements.find((s) => ts.isIfStatement(s) && s.expression.getText(save) === 'feesRaised(before, after)') as ts.IfStatement | undefined

describe('the save reads CREATION_ROLES_ON at each request', () => {
  it('imports it from functions/utils/events/creation.ts, the module the tests\' getter mocks, and reads it inside onRequestPatch, and inside onRequestDelete since WS08 step 5, once each, never at the top of its module', () => {
    const from = [...importsOf(save)].filter(([, names]) => names.includes('CREATION_ROLES_ON')).map(([module]) => module)
    expect(from).toEqual(['../../../utils/events/creation'])
    expect(resolve(ROOT, 'functions/api/admin/tournaments', from[0])).toBe(join(ROOT, 'functions/utils/events/creation'))
    const reads = nodesOf(save).filter((n): n is ts.Identifier => ts.isIdentifier(n) && n.text === 'CREATION_ROLES_ON' && !ts.isImportSpecifier(n.parent))
    /** The reads inside a handler's body. */
    const inside = (fn: ts.ArrowFunction) => reads.filter((r) => r.getStart(save) >= fn.body.getStart(save) && r.getEnd() <= fn.body.getEnd())
    // The save's read, and the delete's, which WS08 step 5 adds in its own handler: every read is inside one.
    expect(reads).toHaveLength(2)
    expect(inside(patchFn)).toHaveLength(1)
    expect(inside(handlerBody(save, 'onRequestDelete'))).toHaveLength(1)
    expect(bulletOf(block, '- **The rule.**')).toContain('the constant is read inside the handler at each request')
  })
})

describe('the fee rule names no role, as the block and the decision say', () => {
  it('is one statement of the handler, `if (feesRaised(before, after))`, which holds no words and reads no role', () => {
    expect(feeRule, 'the fee rule').toBeDefined()
    const inside = nodesOf(feeRule!)
    expect(inside.filter((n) => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)).map((n) => n.getText(save))).toEqual([])
    expect(inside.filter((n) => ts.isPropertyAccessExpression(n) && (n.name.text === 'role' || n.name.text === 'club_id' || n.name.text === 'grant')).map((n) => n.getText(save))).toEqual([])
    expect(bulletOf(block, '- **The rule.**')).toContain('The handler names no role')
    expect(entryOf(decisions, 'D24: the fee rule (WS08 step 4).')).toContain('the handler names no role')
  })

  it('reads the person with creationPerson and asks canChargeFees about the event\'s own club and creator, inside the rule alone, and refuses with the payout words and 403', () => {
    const person = callsOf(patchFn, save, 'creationPerson')
    const decide = callsOf(patchFn, save, 'canChargeFees')
    expect(person.map((c) => flat(c.getText(save)))).toEqual(['creationPerson(context.env.DB, authResult.member, rolesOn)'])
    expect(decide.map((c) => flat(c.getText(save)))).toEqual(['canChargeFees(person, { clubId: existing.clubId, createdBy: existing.createdBy }, rolesOn)'])
    for (const call of [...person, ...decide]) expect(call.getStart(save) >= feeRule!.getStart(save) && call.getEnd() <= feeRule!.getEnd()).toBe(true)
    const refusals = callsOf(feeRule!, save, 'errorResponse').map((c) => flat(c.getText(save)))
    expect(refusals).toEqual(['errorResponse(FEES_NEED_PAYOUT_ACCOUNT, 403)'])
    expect(importsOf(save).get('../../../../domain/events/creation')).toEqual(expect.arrayContaining(['FEES_NEED_PAYOUT_ACCOUNT', 'canChargeFees', 'feesRaised']))
    expect(bulletOf(block, '- **The rule.**')).toContain('`creationPerson` reads the person once a raise is found, `canChargeFees` decides')
    expect(bulletOf(block, '- **Judgement calls.**')).toContain('The person is read only once a raise is found')
  })

  it('comes after the membership rule and before the writers plan their queries', () => {
    const membership = statementAt(patchStatements, save, 'if (body.requiresLcaMembership !== undefined)')
    const forcedOn = statementAt(patchStatements, save, 'if (!clubId) requiresLcaMembership = 1')
    const rule = patchStatements.indexOf(feeRule!)
    const queries = statementAt(patchStatements, save, 'const queries')
    const sections = patchStatements.findIndex((s) => callsOf(s, save, 'buildSaveSections').length > 0)
    const schedules = patchStatements.findIndex((s) => callsOf(s, save, 'buildSaveSchedules').length > 0)
    for (const at of [membership, forcedOn, rule, queries, sections, schedules]) expect(at).toBeGreaterThan(-1)
    expect(membership).toBeLessThan(forcedOn)
    expect(forcedOn).toBeLessThan(rule)
    expect(rule).toBeLessThan(queries)
    expect(queries).toBeLessThan(sections)
    expect(sections).toBeLessThan(schedules)
    expect(bulletOf(block, '- **The rule.**')).toContain('The rule comes after the membership rule and before the writers plan their queries, so a refused save writes nothing.')
    expect(bulletOf(block, '- **The membership switch.**')).toContain('The membership rule runs before the fee rule, as before.')
  })
})

describe('the comparison, as the block says', () => {
  const declared = (name: string) => nodesOf(patchFn).find((n): n is ts.VariableDeclaration => ts.isVariableDeclaration(n) && n.name.getText(save) === name)
  const PRICING = ['entryFee', 'earlyDeadline', 'earlyDiscount', 'lateAfter', 'lateFee']

  it('reads the event\'s rows with the archived ones, before as they are stored and after with the save applied', () => {
    expect(flat(declared('stored')?.initializer?.getText(save) ?? '')).toBe('await loadSections(db, tournamentId, { includeArchived: true })')
    expect(flat(declared('before')?.initializer?.getText(save) ?? '')).toBe('savedSectionFees(stored, null, pricingOf(existing))')
    expect(flat(declared('after')?.initializer?.getText(save) ?? '')).toBe(`savedSectionFees(stored, body.sections, pricingOf({ ${PRICING.join(', ')} }))`)
    const comparison = bulletOf(block, '- **The comparison.**')
    for (const piece of ['on the event\'s rows as `loadSections` reads them with the archived ones', '`before` is every row as stored', '`after` is the same with the save applied']) {
      expect(comparison, piece).toContain(piece)
    }
  })

  it('answers every row the list does not take after the list\'s own elements, at its own prices, and every row with no list', () => {
    const model = flat(functionNamed(repo, 'savedSectionFees').body!.getText(repo))
    expect(model).toContain('if (list == null) return stored.map(asStored)')
    expect(model).toContain('return [...sent, ...stored.filter((row) => !claimed.has(row.id)).map(asStored)]')
    expect(model).toContain('const asStored = (row: SectionRecord): SectionFeesEntry => ({ key: row.id, fees: tierFees(row, tournament) })')
    expect(bulletOf(block, '- **The comparison.**')).toContain('Every row the list does not take keeps its own prices in `after`')
  })

  it('works the five pricing columns out once, before the rule, and the update writes those same values', () => {
    for (const name of PRICING) {
      const at = patchStatements.findIndex((s) => ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => d.name.getText(save) === name))
      expect(at, name).toBeGreaterThan(-1)
      expect(at, name).toBeLessThan(patchStatements.indexOf(feeRule!))
    }
    const set = nodesOf(patchFn).find((n): n is ts.CallExpression => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && n.expression.name.text === 'set' && n.expression.expression.getText(save) === 'db.update(tournaments)')
    expect(set, 'the update').toBeDefined()
    const written = (set!.arguments[0] as ts.ObjectLiteralExpression).properties
    for (const name of PRICING) {
      const property = written.find((p) => p.name?.getText(save) === name)
      expect(property && ts.isShorthandPropertyAssignment(property), name).toBe(true)
    }
    expect(bulletOf(block, '- **Judgement calls.**')).toContain('The event\'s five pricing columns are worked out once, before the rule, and the update writes those values')
  })

  it('hands tierFees the five names it reads through pricingOf, and early_discount and late_fee are never null in the schema', () => {
    const pricingOf = functionNamed(save, 'pricingOf')
    const returned = nodesOf(pricingOf).find((n): n is ts.ReturnStatement => ts.isReturnStatement(n))
    const object = returned?.expression as ts.ObjectLiteralExpression
    const mapping = Object.fromEntries(object.properties.map((p) => [p.name!.getText(save), (p as ts.PropertyAssignment).initializer.getText(save)]))
    expect(mapping).toEqual({
      entry_fee: 'event.entryFee', early_deadline: 'event.earlyDeadline', early_discount: 'event.earlyDiscount', late_after: 'event.lateAfter', late_fee: 'event.lateFee',
    })
    const sections = parse('domain/events/sections.ts')
    const tier = sections.statements.find((s): s is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(s) && s.name.text === 'TierTournament')
    expect(tier?.members.map((m) => m.name?.getText(sections)).sort()).toEqual(Object.keys(mapping).sort())
    const schema = read('functions/db/schema.ts')
    expect(schema).toContain("earlyDiscount: real('early_discount').default(0).notNull(),")
    expect(schema).toContain("lateFee: real('late_fee').default(0).notNull(),")
    expect(entryOf(verify, 'The names tierFees reads (WS08 step 4).')).toContain('`early_discount` and `late_fee` are never null (`functions/db/schema.ts`)')
  })
})

describe('savedSectionFees reads a list as the writer does, as the judgement call says', () => {
  const model = functionNamed(repo, 'savedSectionFees')
  const writer = repo.statements.find((s): s is ts.FunctionDeclaration => ts.isFunctionDeclaration(s) && s.name?.text === 'buildSaveSections')!
  const textOf = (fn: ts.FunctionDeclaration) => flat(fn.body!.getText(repo))

  it('reads the regular price through columnsFromLegacy and the early and late prices through sectionFeeOverrides, as buildSaveSections does, and prices with tierFees', () => {
    expect(textOf(model)).toContain('columnsFromLegacy(toLegacySection(section)).feeRegular')
    expect(textOf(writer)).toContain('columnsFromLegacy(toLegacySection(section))')
    for (const fn of [model, writer]) expect(textOf(fn)).toContain('sectionFeeOverrides(section)')
    expect(textOf(model)).toContain('tierFees(')
    expect(textOf(model)).toContain('fees?.early !== undefined ? fees.early : (row?.feeEarly ?? null)')
    expect(textOf(model)).toContain('fees?.late !== undefined ? fees.late : (row?.feeLate ?? null)')
    expect(textOf(writer)).toContain('...(fees?.early !== undefined ? { feeEarly: fees.early } : {})')
    expect(textOf(writer)).toContain('feeEarly: fees?.early ?? null')
    const calls = bulletOf(block, '- **Judgement calls.**')
    expect(calls).toContain('reads the regular price through `columnsFromLegacy` and the early and late prices through `sectionFeeOverrides`, as the writer does')
  })

  it('matches as the writer matches: by id first, then the live row of a name, then the archived row of that name, neither taking a row twice', () => {
    for (const predicate of [
      'r.archivedAt === null && r.name === section.name && !claimed.has(r.id)',
      'r.archivedAt !== null && r.name === section.name && !claimed.has(r.id)',
      'byId.get(section.id)',
      'new Map(',
    ]) {
      for (const fn of [model, writer]) expect(textOf(fn), `${fn.name?.text}: ${predicate}`).toContain(predicate)
    }
    // Each finds the live row of a name before an archived one.
    for (const fn of [model, writer]) {
      const text = textOf(fn)
      expect(text.indexOf('r.archivedAt === null && r.name === section.name'), fn.name?.text).toBeLessThan(text.indexOf('r.archivedAt !== null && r.name === section.name'))
    }
    expect(flat(nodesOf(writer).find((n) => ts.isVariableDeclaration(n) && n.name.getText(repo) === 'existing')!.getText(repo)))
      .toBe('existing = await loadSections(db, tournamentId, { includeArchived: true })')
    expect(bulletOf(block, '- **Judgement calls.**')).toContain('it repeats the writer\'s matching by id and by name')
  })
})

describe('the create reads the same list, as "The create" says', () => {
  it('builds no list of its own any more: createdFees is gone', () => {
    expect(nodesOf(create).filter((n) => ts.isIdentifier(n) && n.text === 'createdFees')).toEqual([])
    expect(bulletOf(block, '- **The create.**')).toContain('`createdFees`, which built it, are gone')
  })

  it('asks feesRaised of savedSectionFees on the list it hands the writer, worked out before the check and handed to buildSaveSections as it is', () => {
    const check = postStatements.findIndex((s) => ts.isIfStatement(s) && callsOf(s.expression, create, 'feesRaised').length > 0)
    expect(check).toBeGreaterThan(-1)
    const condition = flat((postStatements[check] as ts.IfStatement).expression.getText(create))
    expect(condition).toBe('feesRaised([], savedSectionFees([], sections, { entry_fee: body.entryFee })) && !canChargeFees(person, { clubId, createdBy: member.id }, rolesOn)')
    const listAt = statementAt(postStatements, create, 'const sections =')
    expect(listAt).toBeGreaterThan(-1)
    expect(listAt).toBeLessThan(check)
    expect(callsOf(postFn, create, 'buildSaveSections').map((c) => flat(c.getText(create)))).toEqual(['buildSaveSections(db, id, sections, { reportSettings: null })'])
    expect(bulletOf(block, '- **The create.**')).toContain('`feesRaised([], savedSectionFees([], sections, { entry_fee }))`')
  })

  it('reads an empty club id as none on the statement right before the club line, which stays word for word', () => {
    const club = statementAt(postStatements, create, 'const clubId = person.repClubId ?? (body.clubId ?? null)')
    expect(club).toBeGreaterThan(0)
    expect(flat(postStatements[club - 1].getText(create))).toBe("if (body.clubId === '') body.clubId = null")
    // The club rep's own check reads the club id before it, where an empty one already named no club.
    const rep = statementAt(postStatements, create, 'if (person.repClubId && body.clubId && body.clubId !== person.repClubId)')
    expect(rep).toBe(club - 2)
    expect(bulletOf(block, '- **The create.**')).toContain('An empty club id is read as none for every creator on the line before the club line')
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
    for (const file of [REPO, SAVE, CREATE, RULES]) {
      expect(existsSync(join(ROOT, file)), file).toBe(true)
      expect([...files], file).not.toContain(file)
    }
    expect(bulletOf(block, '- **What ships with every switch off.**')).toContain('since the worker does not import `functions/utils/events/sectionsRepo.ts` or `domain/events/creation.ts`')
  })
})

describe('the two ways of entering, as the verify item on the event\'s fee says', () => {
  it('each looks the section up among the live rows alone and refuses an entry without one, in the words the item quotes', () => {
    const one = flat(read('functions/api/registrations.ts'))
    expect(one).toContain('const section = (await loadSections(db, tournament.id)).find((s) => s.name === body.section) if (!section) { return errorResponse(\'Invalid section\', 400) }')
    const family = flat(read('functions/api/registrations/batch.ts'))
    expect(family).toContain('const sections = await loadSections(orm, tournament.id)')
    expect(family).toContain('const section = sections.find((s) => s.name === entry.section) if (!section) return errorResponse(`Choose a valid section for ${player.full_name}`, 400)')
    const item = entryOf(verify, 'An event\'s fee is paid only through a section (WS08 step 4).')
    for (const piece of ['`POST /api/registrations`', '`POST /api/registrations/batch`', '"Invalid section"', '"Choose a valid section for"']) expect(item, piece).toContain(piece)
  })

  it('the waitlist\'s offer prices an entry from its section\'s row, archived ones included, and migration 0053\'s triggers add an archived row for an entry whose section has none, as the item says', () => {
    const offer = flat(read('functions/api/admin/tournaments/[id]/waitlist.ts'))
    expect(offer).toContain('const rows = await loadSections(getDb(db), t.id, { includeArchived: true })')
    expect(offer).toContain('const amount = priceEntry(section, t, Date.now()).amount')
    // The withdrawal and reinstatement branch, up to the check-in branch, never looks at the section's row.
    const registration = flat(read('functions/api/registrations/[id].ts'))
    const branch = registration.slice(registration.indexOf('if (body.withdrawn !== undefined) {'), registration.indexOf('if (body.checkedIn !== undefined) {'))
    expect(branch).toContain('changes.withdrawnAt = body.withdrawn ? new Date().toISOString() : null')
    for (const name of ['loadSections', 'archivedAt', 'archived_at', 'tournament_sections']) expect(branch, name).not.toContain(name)
    const triggers = flat(read('migrations/0053_sections_schedules_backfill.sql'))
    expect(triggers.split("INSERT INTO tournament_sections (tournament_id, name, archived_at) SELECT NEW.tournament_id, NEW.section, datetime('now')")).toHaveLength(3)
    expect(triggers).toContain("INSERT INTO tournament_sections (tournament_id, name, archived_at) SELECT DISTINCT r.tournament_id, r.section, datetime('now') FROM registrations r")
    const item = entryOf(verify, 'An event\'s fee is paid only through a section (WS08 step 4).')
    for (const piece of ['`POST /api/admin/tournaments/[id]/waitlist`', 'archived rows included', 'the reinstate branch of `PATCH /api/registrations/[id]`', 'migration 0053']) {
      expect(item, piece).toContain(piece)
    }
  })
})
