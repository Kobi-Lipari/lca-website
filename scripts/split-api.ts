// scripts/split-api.ts
//
// Splits the site's API client, src/lib/api.ts, into one module per area
// (src/areas/<area>/api.ts) plus the shared request helpers in
// src/lib/http.ts, and turns src/lib/api.ts into a barrel that re-exports
// them, so every importer of '@/lib/api' sees the same names as before.
//
// Usage:
//   node --no-warnings --experimental-strip-types scripts/split-api.ts [--dry-run] [--map <path>] [--root <dir>]
//   node --no-warnings --experimental-strip-types scripts/split-api.ts --check [--compare <rev>] [--map <path>] [--root <dir>]
//
// The map (scripts/moves/api-split.json by default) is a JSON object of
// top-level name to target: 'http' or one of the eight areas. It names every
// top-level declaration in src/lib/api.ts, exported or not, so a private
// helper goes where the map says (to http when several areas use it).
//
// Splitting parses src/lib/api.ts with the TypeScript compiler and moves
// each top-level declaration by its source text, with the comments above it,
// to its target, in the order the declarations had. No declaration's text
// changes. Each target gets a header comment and the imports its
// declarations need: the original imports they use (with the comment above
// one, if any), the http helpers, and the types another area owns, from that
// area's api.ts. A private helper of http.ts that other modules use is
// exported with one `export { ... }` line at the end, so its own text stays
// as it was. The run stops, writing nothing, when a declaration is missing
// from the map or the map names one the file lacks, when a statement is of a
// kind it does not move, when a comment would be left behind, when a private
// helper of an area is used by another module, when http.ts would import an
// area, or when the areas would import each other in a cycle. --dry-run
// prints the plan (the counts per target and the imports each one gets) and
// writes nothing.
//
// --check reads the result and passes only when:
// 1. src/lib/api.ts holds nothing but export-from lines, and the names it
//    exports equal the snapshot taken before the split
//    (test/unit/fixtures/api-exports.json), each through one line only;
// 2. each of those names is exported by exactly one of http.ts and the eight
//    area modules, and each module declares exactly the names the map gives
//    it;
// 3. no area module imports src/lib/api.ts, http.ts imports nothing from
//    src/areas or src/lib/api.ts, and no area index.ts re-exports api.ts.
// With --compare <rev> it also reads src/lib/api.ts as it was at <rev> and
// proves every declaration was moved byte for byte: each one's text, from
// its first comment to its end, equals the text of the declaration of the
// same name in its new module, and what is left of the old file once the
// declarations are taken out is its import statements and whitespace.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export const API_PATH = 'src/lib/api.ts'
export const HTTP_PATH = 'src/lib/http.ts'
export const MAP_PATH = 'scripts/moves/api-split.json'
export const SNAPSHOT_PATH = 'test/unit/fixtures/api-exports.json'

/** The areas, in the order the barrel re-exports them. */
export const AREAS = ['events', 'registration', 'households', 'live', 'membership', 'clubs', 'admin', 'governance'] as const

export type Target = 'http' | (typeof AREAS)[number]

const TARGETS: readonly Target[] = ['http', ...AREAS]

export const targetPath = (t: Target): string => (t === 'http' ? HTTP_PATH : `src/areas/${t}/api.ts`)
export const targetSpecifier = (t: Target): string => (t === 'http' ? '@/lib/http' : `@/areas/${t}/api`)

/** What each module holds, for its header comment. */
const DESCRIPTIONS: Record<Target, string[]> = {
  http: [
    "The site's shared request helpers: authHeaders (the JSON and sign-in",
    'headers every call sends), handleResponse (reads an answer or throws its',
    'error) and ApiError, which carries the HTTP status. Every area api.ts',
    'imports them from here. This file imports nothing from src/areas or',
    'src/lib/api.ts, so no area module can import itself back through it.',
  ],
  events: [
    "The events area's calls to the site's API: tournaments and their setup,",
    'directors, the manage page, the US Chess rating report, event',
    'announcements, news posts and the club news feed, and state champions.',
  ],
  registration: [
    "The registration area's calls to the site's API: entries (one player, a",
    'family or a walk-in), byes, paying, the waitlist, reminders and the',
    'registration settings.',
  ],
  households: ["The households area's calls to the site's API: the children on a family account."],
  live: [
    "The live area's calls to the site's API: pairings, results and the",
    'scoresheet scanner, with the game, pairing and standings types.',
  ],
  membership: [
    "The membership area's calls to the site's API: the signed-in member,",
    'joining and renewing, donations, the US Chess rating lookup, and the',
    'admin member list and export.',
  ],
  clubs: [
    "The clubs area's calls to the site's API: the club directory and club",
    'pages, officers, club news and logos.',
  ],
  admin: [
    "The admin area's calls to the site's API: support tickets and the",
    'contact form, email campaigns, site announcements, acting as a member,',
    'and the audit log.',
  ],
  governance: [
    "The governance area's calls to the site's API: board seats and officer",
    'photos, board members, governance documents and the board inbox.',
  ],
}

const AREA_NOTE = [
  'Moved whole from src/lib/api.ts by scripts/split-api.ts, following',
  'scripts/moves/api-split.json. src/lib/api.ts re-exports everything here,',
  "so pages and components may keep importing from '@/lib/api'. A type",
  "another area owns is imported from that area's api.ts, never from",
  "'@/lib/api', which re-exports this file.",
]

const BARREL_HEADER = [
  `// ${API_PATH}`,
  '//',
  "// The site's API client, re-exported from where each call lives: the",
  '// shared request helpers and ApiError in src/lib/http.ts, and each',
  "// area's calls in src/areas/<area>/api.ts (scripts/moves/api-split.json",
  "// says which). Pages and components import from here; code inside an",
  "// area may import its own area's api.ts directly. Area modules never",
  '// import this file.',
]

// ── Parsing ────────────────────────────────────────────────────────────────

export interface Problem {
  where: string
  reason: string
}

export interface OriginalImport {
  specifier: string
  typeOnly: boolean
  names: string[]
  /** The comment lines directly above it, when it has its own. */
  comment: string
}

export interface Declaration {
  name: string
  exported: boolean
  /** 'type' for an interface or a type alias, 'value' otherwise. */
  kind: 'type' | 'value'
  /** The declaration's text from its first leading comment to its end. */
  text: string
  /** Its full extent in the source, leading whitespace and comments included. */
  fullStart: number
  end: number
  /** Top-level names of the source file (declarations and imports) it uses. */
  uses: Set<string>
  line: number
}

export interface ParsedApi {
  imports: OriginalImport[]
  /** Import statements' full extents, for the byte check. */
  importSpans: Array<[number, number]>
  declarations: Declaration[]
  problems: Problem[]
}

const parse = (path: string, text: string) => ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind) =>
  ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some((m) => m.kind === kind)

/** A statement's text from its first leading comment (or token) to its end: its full text without the blank lines before it. */
export function statementText(sf: ts.SourceFile, node: ts.Node): string {
  return sf.text.slice(node.getFullStart(), node.getEnd()).replace(/^(?:[ \t]*\r?\n)+/, '')
}

/** Identifiers in `node` that refer to something by name (not property names or the names being declared). */
function referencedNames(node: ts.Node): Set<string> {
  const out = new Set<string>()
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n)) {
      const p = n.parent as ts.Node & { name?: ts.Node }
      const isOwnName = p !== undefined && p.name === n && !ts.isShorthandPropertyAssignment(p)
      const isRightOfQualified = p !== undefined && ts.isQualifiedName(p) && p.right === n
      if (!isOwnName && !isRightOfQualified) out.add(n.text)
      return
    }
    ts.forEachChild(n, visit)
  }
  ts.forEachChild(node, visit)
  return out
}

function lineOf(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1
}

/** Reads the unsplit src/lib/api.ts: its imports and its top-level declarations. */
export function parseApi(text: string): ParsedApi {
  const sf = parse(API_PATH, text)
  const problems: Problem[] = []
  const imports: OriginalImport[] = []
  const importSpans: Array<[number, number]> = []
  const declarations: Declaration[] = []
  const seen = new Set<string>()
  for (const s of sf.statements) {
    const line = lineOf(sf, s.getStart(sf))
    const where = `${API_PATH}:${line}`
    // A comment after a statement on its own line would travel with the next statement; one on the same line would be cut off.
    const trailing = ts.getTrailingCommentRanges(text, s.getEnd()) ?? []
    if (trailing.length > 0) problems.push({ where, reason: 'has a comment after it on the same line, which the split would separate from it' })

    if (ts.isImportDeclaration(s)) {
      importSpans.push([s.getFullStart(), s.getEnd()])
      const clause = s.importClause
      const spec = (s.moduleSpecifier as ts.StringLiteral).text
      if (!clause || clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) {
        problems.push({ where, reason: 'only named imports are carried over (no side-effect, default or namespace import)' })
        continue
      }
      if (spec.startsWith('.')) problems.push({ where, reason: `relative import '${spec}' would need rewriting for the new folders` })
      if (clause.namedBindings.elements.some((e) => e.isTypeOnly || e.propertyName)) {
        problems.push({ where, reason: 'an inline `type` or a renamed import is not carried over' })
      }
      // The comment block at the very top of the file is the file's own header, not this import's.
      const comments = (ts.getLeadingCommentRanges(text, s.getFullStart()) ?? []).filter((c) => c.pos > 0)
      const comment = comments.length > 0 ? text.slice(comments[0].pos, comments[comments.length - 1].end) : ''
      imports.push({ specifier: spec, typeOnly: clause.isTypeOnly, names: clause.namedBindings.elements.map((e) => e.name.text), comment })
      continue
    }

    let kind: 'type' | 'value'
    if (ts.isInterfaceDeclaration(s) || ts.isTypeAliasDeclaration(s)) kind = 'type'
    else if (ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) kind = 'value'
    else {
      problems.push({ where, reason: `a ${ts.SyntaxKind[s.kind]} is not a statement this script moves` })
      continue
    }
    const name = s.name?.text
    if (!name) {
      problems.push({ where, reason: 'an unnamed declaration cannot be placed by the map' })
      continue
    }
    if (hasModifier(s, ts.SyntaxKind.DefaultKeyword)) problems.push({ where, reason: `${name} is a default export, which a barrel cannot re-export with export *` })
    if (seen.has(name)) problems.push({ where, reason: `${name} is declared more than once (overloads or merging are not handled)` })
    seen.add(name)
    declarations.push({
      name,
      exported: hasModifier(s, ts.SyntaxKind.ExportKeyword),
      kind,
      text: statementText(sf, s),
      fullStart: s.getFullStart(),
      end: s.getEnd(),
      uses: referencedNames(s),
      line,
    })
  }

  const eof = ts.getLeadingCommentRanges(text, sf.endOfFileToken.getFullStart()) ?? []
  if (eof.length > 0) problems.push({ where: `${API_PATH}:${lineOf(sf, eof[0].pos)}`, reason: 'a comment at the end of the file belongs to no declaration' })

  // Only names of this file count as uses.
  const topLevel = new Set([...declarations.map((d) => d.name), ...imports.flatMap((m) => m.names)])
  for (const d of declarations) {
    for (const u of [...d.uses]) if (!topLevel.has(u) || u === d.name) d.uses.delete(u)
  }
  return { imports, importSpans, declarations, problems }
}

// ── Planning ───────────────────────────────────────────────────────────────

export interface ModulePlan {
  target: Target
  path: string
  declarations: Declaration[]
  /** Import lines, in the order they are written. */
  importLines: string[]
  /** Private helpers other modules use, exported by name at the end. */
  exportList: string[]
  /** Other targets this module imports from. */
  importsFrom: Target[]
  text: string
}

export interface Plan {
  modules: ModulePlan[]
  barrel: string
  problems: Problem[]
}

export function readMap(path: string): Record<string, string> {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${path} is not a JSON object of name to target`)
  return raw as Record<string, string>
}

function headerFor(t: Target): string[] {
  const lines = [`// ${targetPath(t)}`, '//', ...DESCRIPTIONS[t].map((l) => `// ${l}`)]
  if (t !== 'http') lines.push('//', ...AREA_NOTE.map((l) => `// ${l}`))
  else lines.push('//', '// Moved whole from src/lib/api.ts by scripts/split-api.ts.')
  return lines
}

/** Finds a cycle among the module edges, or null. */
function findCycle(edges: Map<Target, Set<Target>>): Target[] | null {
  const state = new Map<Target, 'open' | 'done'>()
  const stack: Target[] = []
  const visit = (t: Target): Target[] | null => {
    if (state.get(t) === 'done') return null
    if (state.get(t) === 'open') return [...stack.slice(stack.indexOf(t)), t]
    state.set(t, 'open')
    stack.push(t)
    for (const next of edges.get(t) ?? []) {
      const c = visit(next)
      if (c) return c
    }
    stack.pop()
    state.set(t, 'done')
    return null
  }
  for (const t of TARGETS) {
    const c = visit(t)
    if (c) return c
  }
  return null
}

/** Works out every module's text from the unsplit file and the map. Writes nothing. */
export function planSplit(apiText: string, map: Record<string, string>): Plan {
  const parsed = parseApi(apiText)
  const problems = [...parsed.problems]
  const byName = new Map(parsed.declarations.map((d) => [d.name, d]))
  const targetOf = new Map<string, Target>()

  for (const [name, target] of Object.entries(map)) {
    if (!(TARGETS as readonly string[]).includes(target)) problems.push({ where: MAP_PATH, reason: `${name} names '${target}', which is not http or one of the eight areas` })
    else if (!byName.has(name)) problems.push({ where: MAP_PATH, reason: `${name} is in the map but not declared in ${API_PATH}` })
    else targetOf.set(name, target as Target)
  }
  for (const d of parsed.declarations) {
    if (!(d.name in map)) problems.push({ where: `${API_PATH}:${d.line}`, reason: `${d.exported ? 'export' : 'private helper'} ${d.name} is not named in the map` })
  }

  const importOf = new Map<string, OriginalImport>()
  for (const m of parsed.imports) for (const n of m.names) importOf.set(n, m)

  const modules: ModulePlan[] = []
  const edges = new Map<Target, Set<Target>>()
  for (const target of TARGETS) {
    const decls = parsed.declarations.filter((d) => targetOf.get(d.name) === target)
    const fromOriginal = new Map<OriginalImport, Set<string>>()
    const fromTargets = new Map<Target, { values: Set<string>; types: Set<string> }>()
    for (const d of decls) {
      for (const u of d.uses) {
        const imp = importOf.get(u)
        if (imp) {
          if (!fromOriginal.has(imp)) fromOriginal.set(imp, new Set())
          fromOriginal.get(imp)!.add(u)
          continue
        }
        const other = targetOf.get(u)
        if (other === undefined || other === target) continue
        const dep = byName.get(u)!
        if (!dep.exported && other !== 'http') problems.push({ where: `${API_PATH}:${dep.line}`, reason: `private helper ${u} (${other}) is used by ${d.name} (${target}); map it to http` })
        if (target === 'http') problems.push({ where: `${API_PATH}:${d.line}`, reason: `${d.name} would make http.ts import ${u} from the ${other} area` })
        if (!fromTargets.has(other)) fromTargets.set(other, { values: new Set(), types: new Set() })
        fromTargets.get(other)![dep.kind === 'type' ? 'types' : 'values'].add(u)
      }
    }
    edges.set(target, new Set(fromTargets.keys()))

    const inOrder = (names: Set<string>, order: string[]) => order.filter((n) => names.has(n))
    const declOrder = parsed.declarations.map((d) => d.name)
    const importLines: string[] = []
    for (const imp of parsed.imports) {
      const used = fromOriginal.get(imp)
      if (!used) continue
      if (imp.comment) importLines.push(imp.comment)
      importLines.push(`import ${imp.typeOnly ? 'type ' : ''}{ ${inOrder(used, imp.names).join(', ')} } from '${imp.specifier}'`)
    }
    for (const other of TARGETS) {
      const used = fromTargets.get(other)
      if (!used) continue
      if (used.values.size > 0) importLines.push(`import { ${inOrder(used.values, declOrder).join(', ')} } from '${targetSpecifier(other)}'`)
      if (used.types.size > 0) importLines.push(`import type { ${inOrder(used.types, declOrder).join(', ')} } from '${targetSpecifier(other)}'`)
    }

    const usedElsewhere = new Set<string>()
    for (const d of parsed.declarations) {
      if (targetOf.get(d.name) === target) continue
      for (const u of d.uses) if (targetOf.get(u) === target) usedElsewhere.add(u)
    }
    const exportList = decls.filter((d) => !d.exported && usedElsewhere.has(d.name)).map((d) => d.name)

    if (decls.length > 0 && importLines.length === 0) {
      problems.push({ where: targetPath(target), reason: 'would have no import, so its header comment would sit on its first declaration' })
    }
    const parts = [headerFor(target).join('\n'), importLines.join('\n'), ...decls.map((d) => d.text)]
    if (exportList.length > 0) parts.push(`export { ${exportList.join(', ')} }`)
    modules.push({
      target,
      path: targetPath(target),
      declarations: decls,
      importLines,
      exportList,
      importsFrom: [...fromTargets.keys()],
      text: parts.join('\n\n') + '\n',
    })
  }

  for (const m of modules) {
    if (m.declarations.length === 0) problems.push({ where: m.path, reason: 'the map gives this module nothing' })
  }
  const areaEdges = new Map([...edges].filter(([t]) => t !== 'http').map(([t, s]) => [t, new Set([...s].filter((x) => x !== 'http'))] as const))
  const cycle = findCycle(areaEdges)
  if (cycle) problems.push({ where: MAP_PATH, reason: `the areas would import each other in a cycle: ${cycle.join(' -> ')}` })

  const httpExports = modules.find((m) => m.target === 'http')!.declarations.filter((d) => d.exported).map((d) => d.name)
  const barrelLines = [...BARREL_HEADER]
  if (httpExports.length > 0) barrelLines.push(`export { ${httpExports.join(', ')} } from '${targetSpecifier('http')}'`)
  for (const a of AREAS) barrelLines.push(`export * from '${targetSpecifier(a)}'`)
  return { modules, barrel: barrelLines.join('\n') + '\n', problems }
}

export function applyPlan(root: string, plan: Plan): void {
  for (const m of plan.modules) {
    mkdirSync(dirname(join(root, m.path)), { recursive: true })
    writeFileSync(join(root, m.path), m.text)
  }
  writeFileSync(join(root, API_PATH), plan.barrel)
}

function printPlan(plan: Plan, dryRun: boolean): void {
  const total = plan.modules.reduce((n, m) => n + m.declarations.length, 0)
  console.log(`${dryRun ? 'Plan (dry run, nothing written)' : 'Plan'}: ${total} declarations from ${API_PATH} into ${plan.modules.length} modules.`)
  for (const m of plan.modules) {
    const exported = m.declarations.filter((d) => d.exported)
    const fns = exported.filter((d) => d.kind === 'value').length
    const types = exported.length - fns
    const priv = m.declarations.filter((d) => !d.exported).map((d) => d.name)
    const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
    console.log(`\n  ${m.path}: ${count(exported.length, 'export', 'exports')} (${count(fns, 'function or class', 'functions or classes')}, ${count(types, 'type', 'types')})${priv.length ? `, private: ${priv.join(', ')}` : ''}`)
    for (const l of m.importLines) if (!l.startsWith('//')) console.log(`    ${l}`)
    if (m.exportList.length > 0) console.log(`    export { ${m.exportList.join(', ')} }`)
  }
  console.log(`\n  ${API_PATH} becomes the barrel:`)
  for (const l of plan.barrel.split('\n')) if (l.startsWith('export')) console.log(`    ${l}`)
  console.log(`\nProblems: ${plan.problems.length}`)
  for (const p of plan.problems) console.log(`  ${p.where}: ${p.reason}`)
}

// ── Checking ───────────────────────────────────────────────────────────────

/** Where an alias or relative specifier points, as a repository path, or null for a package. */
function resolveSpecifier(fromPath: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`
  else if (spec.startsWith('.')) base = join(dirname(fromPath), spec).split('\\').join('/')
  else return null
  if (/\.tsx?$/.test(base)) return base
  return `${base}.ts`
}

/** Specifiers a module imports or re-exports from. */
function specifiersOf(sf: ts.SourceFile): string[] {
  const out: string[] = []
  for (const s of sf.statements) {
    if ((ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) && s.moduleSpecifier && ts.isStringLiteral(s.moduleSpecifier)) out.push(s.moduleSpecifier.text)
  }
  return out
}

/** The names a top-level statement declares (a variable statement may declare several). */
function namesOf(s: ts.Statement): string[] {
  if (ts.isVariableStatement(s)) {
    return s.declarationList.declarations.map((d) => (ts.isIdentifier(d.name) ? d.name.text : `<${ts.SyntaxKind[d.name.kind]}>`))
  }
  const n = (s as ts.Node & { name?: ts.Node }).name
  return [n && ts.isIdentifier(n) ? n.text : `<${ts.SyntaxKind[s.kind]}>`]
}

/** The names a module exports: its exported declarations and its local `export { ... }` lists. */
function exportsOf(sf: ts.SourceFile): string[] {
  const out: string[] = []
  for (const s of sf.statements) {
    if (ts.isExportDeclaration(s) && !s.moduleSpecifier && s.exportClause && ts.isNamedExports(s.exportClause)) {
      for (const e of s.exportClause.elements) out.push(e.name.text)
    } else if (!ts.isExportDeclaration(s) && hasModifier(s, ts.SyntaxKind.ExportKeyword)) {
      out.push(...namesOf(s))
    }
  }
  return out
}

function declaredNames(sf: ts.SourceFile): string[] {
  return sf.statements.filter((s) => !ts.isImportDeclaration(s) && !ts.isExportDeclaration(s)).flatMap(namesOf)
}

export interface CheckResult {
  lines: string[]
  problems: string[]
}

export function checkSplit(root: string, map: Record<string, string>, snapshot: string[], original?: string): CheckResult {
  const lines: string[] = []
  const problems: string[] = []
  const read = (p: string) => readFileSync(join(root, p), 'utf8')

  // 1. The barrel.
  const barrel = parse(API_PATH, read(API_PATH))
  const viaBarrel = new Map<string, string[]>()
  const sources = new Map<string, ts.SourceFile>()
  const load = (p: string) => {
    if (!sources.has(p)) {
      if (!existsSync(join(root, p))) return null
      sources.set(p, parse(p, read(p)))
    }
    return sources.get(p)!
  }
  for (const s of barrel.statements) {
    if (!ts.isExportDeclaration(s) || !s.moduleSpecifier || !ts.isStringLiteral(s.moduleSpecifier) || s.isTypeOnly) {
      problems.push(`${API_PATH}:${lineOf(barrel, s.getStart(barrel))} is not an export-from line`)
      continue
    }
    const spec = s.moduleSpecifier.text
    const target = resolveSpecifier(API_PATH, spec)
    const sf = target ? load(target) : null
    if (!target || !sf) {
      problems.push(`${API_PATH} re-exports '${spec}', which is not a module in the repository`)
      continue
    }
    const names = s.exportClause && ts.isNamedExports(s.exportClause) ? s.exportClause.elements.map((e) => e.name.text) : exportsOf(sf)
    for (const n of names) viaBarrel.set(n, [...(viaBarrel.get(n) ?? []), target])
  }
  const want = new Set(snapshot)
  const got = new Set(viaBarrel.keys())
  const missing = [...want].filter((n) => !got.has(n))
  const extra = [...got].filter((n) => !want.has(n))
  if (missing.length) problems.push(`'@/lib/api' no longer exports: ${missing.join(', ')}`)
  if (extra.length) problems.push(`'@/lib/api' now also exports: ${extra.join(', ')}`)
  for (const [n, from] of viaBarrel) if (from.length > 1) problems.push(`'@/lib/api' re-exports ${n} from ${from.length} modules: ${from.join(', ')}`)
  lines.push(`Barrel: ${got.size} names, snapshot ${want.size}: ${missing.length === 0 && extra.length === 0 ? 'the same set' : 'different'}.`)

  // 2. Each name in exactly one module; each module declares what the map gives it.
  const owners = new Map<string, Target[]>()
  for (const t of TARGETS) {
    const sf = load(targetPath(t))
    if (!sf) {
      problems.push(`${targetPath(t)} does not exist`)
      continue
    }
    for (const n of exportsOf(sf)) owners.set(n, [...(owners.get(n) ?? []), t])
    const declared = declaredNames(sf)
    const mapped = Object.entries(map).filter(([, v]) => v === t).map(([k]) => k)
    const notMapped = declared.filter((n) => !mapped.includes(n))
    const absent = mapped.filter((n) => !declared.includes(n))
    if (notMapped.length) problems.push(`${targetPath(t)} declares names the map gives elsewhere or not at all: ${notMapped.join(', ')}`)
    if (absent.length) problems.push(`${targetPath(t)} lacks names the map gives it: ${absent.join(', ')}`)
    lines.push(`  ${targetPath(t)}: ${declared.length} declarations, ${exportsOf(sf).length} exports.`)
  }
  for (const n of snapshot) {
    const o = owners.get(n) ?? []
    if (o.length !== 1) problems.push(`${n} is exported by ${o.length} modules${o.length ? `: ${o.join(', ')}` : ''}`)
  }

  // 3. Import rules.
  const importProblems = problems.length
  const isApi = (from: string, spec: string) => spec === '@/lib/api' || resolveSpecifier(from, spec) === API_PATH
  const isArea = (from: string, spec: string) => (resolveSpecifier(from, spec) ?? '').startsWith('src/areas/')
  for (const t of TARGETS) {
    const p = targetPath(t)
    const sf = sources.get(p)
    if (!sf) continue
    for (const spec of specifiersOf(sf)) {
      if (isApi(p, spec)) problems.push(`${p} imports '${spec}' (src/lib/api.ts)`)
      if (t === 'http' && isArea(p, spec)) problems.push(`${p} imports '${spec}' from src/areas`)
    }
  }
  for (const a of AREAS) {
    const p = `src/areas/${a}/index.ts`
    const sf = load(p)
    if (!sf) continue
    for (const spec of specifiersOf(sf)) if (resolveSpecifier(p, spec) === targetPath(a) || isApi(p, spec)) problems.push(`${p} re-exports '${spec}'`)
  }
  lines.push(problems.length === importProblems
    ? 'Imports: no area module imports src/lib/api.ts, http.ts imports no area, and no area index.ts re-exports api.ts.'
    : 'Imports: see the problems below.')

  // 4. Byte for byte, against the file as it was.
  if (original !== undefined) {
    const before = parseApi(original)
    let bytes = 0
    for (const d of before.declarations) {
      const t = map[d.name] as Target | undefined
      const sf = t ? sources.get(targetPath(t)) : undefined
      const node = sf?.statements.find((s) => !ts.isImportDeclaration(s) && !ts.isExportDeclaration(s) && (s as ts.Node & { name?: ts.Identifier }).name?.text === d.name)
      if (!sf || !node) {
        problems.push(`${d.name} (line ${d.line} before) was not found in its module`)
        continue
      }
      if (statementText(sf, node) !== d.text) problems.push(`${d.name} (line ${d.line} before) differs from its text in ${targetPath(t!)}`)
      else bytes += d.text.length
    }
    // What is left of the old file once its imports and declarations are cut out must be whitespace only.
    const spans = [...before.importSpans, ...before.declarations.map((d) => [d.fullStart, d.end] as [number, number])].sort((x, y) => x[0] - y[0])
    let rest = ''
    let at = 0
    for (const [s, e] of spans) {
      rest += original.slice(at, s)
      at = e
    }
    rest += original.slice(at)
    const leftover = rest.trim()
    if (leftover) problems.push(`the old file holds text outside its imports and declarations: ${JSON.stringify(leftover.slice(0, 80))}`)
    lines.push(`Compared: ${before.declarations.length} declarations (${bytes} characters) byte for byte; the rest of the old file is ${before.importSpans.length} import statements and ${rest.length} whitespace character${rest.length === 1 ? '' : 's'}.`)
  }
  return { lines, problems }
}

// ── Command line ───────────────────────────────────────────────────────────

function git(root: string, args: string[]): { ok: boolean; out: string; err: string } {
  const env = { ...process.env }
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  delete env.GIT_INDEX_FILE
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 })
  return { ok: r.status === 0, out: r.stdout ?? '', err: (r.stderr ?? '') + (r.error ? String(r.error) : '') }
}

const USAGE = [
  'Usage:',
  '  node --no-warnings --experimental-strip-types scripts/split-api.ts [--dry-run] [--map <path>] [--root <dir>]',
  '  node --no-warnings --experimental-strip-types scripts/split-api.ts --check [--compare <rev>] [--map <path>] [--root <dir>]',
].join('\n')

function main(): number {
  const argv = process.argv.slice(2)
  const valueOf = (flag: string) => {
    const at = argv.indexOf(flag)
    return at >= 0 ? argv[at + 1] : undefined
  }
  const known = new Set(['--dry-run', '--check', '--compare', '--map', '--root'])
  const stray = argv.filter((a, i) => !known.has(a) && !['--compare', '--map', '--root'].includes(argv[i - 1] ?? ''))
  if (stray.length > 0) {
    console.error(USAGE)
    return 1
  }
  const root = resolve(valueOf('--root') ?? REPO_ROOT)
  const mapPath = resolve(root, valueOf('--map') ?? MAP_PATH)
  let map: Record<string, string>
  try {
    map = readMap(mapPath)
  } catch (e) {
    console.error(`Stopped: the map cannot be used.\n${(e as Error).message}`)
    return 1
  }

  if (argv.includes('--check')) {
    const snapshot = JSON.parse(readFileSync(join(root, SNAPSHOT_PATH), 'utf8')) as string[]
    const rev = valueOf('--compare')
    let original: string | undefined
    if (rev !== undefined) {
      const r = git(root, ['show', `${rev}:${API_PATH}`])
      if (!r.ok) {
        console.error(`Stopped: cannot read ${API_PATH} at ${rev}.\n${r.err.trim()}`)
        return 1
      }
      original = r.out
    }
    const result = checkSplit(root, map, snapshot, original)
    for (const l of result.lines) console.log(l)
    console.log(`\nProblems: ${result.problems.length}`)
    for (const p of result.problems) console.log(`  ${p}`)
    return result.problems.length === 0 ? 0 : 1
  }

  const apiText = readFileSync(join(root, API_PATH), 'utf8')
  const plan = planSplit(apiText, map)
  if (plan.modules.every((m) => m.declarations.length === 0)) {
    console.error(`Stopped: ${API_PATH} declares nothing; it looks split already. Use --check.`)
    return 1
  }
  const dryRun = argv.includes('--dry-run')
  printPlan(plan, dryRun)
  if (plan.problems.length > 0) {
    console.error(`\nStopped: ${plan.problems.length} problem(s). Nothing was written.`)
    return 1
  }
  if (dryRun) return 0
  const existing = plan.modules.filter((m) => existsSync(join(root, m.path)))
  if (existing.length > 0) {
    console.error(`\nStopped: these files exist already: ${existing.map((m) => m.path).join(', ')}. Nothing was written.`)
    return 1
  }
  applyPlan(root, plan)
  console.log(`\nWrote ${plan.modules.length} modules and the barrel. Check with --check --compare <rev>.`)
  return 0
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) process.exit(main())
