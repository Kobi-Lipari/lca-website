// scripts/move-files.ts
//
// Moves files with `git mv` and rewrites every import that points at them,
// so a folder reorganisation lands as renames plus import-line edits and
// nothing else.
//
// Usage:
//   node --no-warnings --experimental-strip-types scripts/move-files.ts <map.json> [--dry-run] [--root <dir>]
//
// The map is a JSON object of old path to new path, both relative to the
// root (the repository by default). An entry may name a folder, which moves
// whole. scripts/verify-move.ts takes the same map and checks the result.
//
// What is rewritten, in every code file under src, functions, workers,
// domain, test, scripts and scanner (and the code files at the root):
// - import ... from '...' and import '...'
// - export ... from '...'
// - import('...'), and typeof import('...') in types
// - vi.mock, vi.doMock, vi.unmock, vi.doUnmock, vi.importActual and
//   vi.importMock first arguments
// - require('...') and import x = require('...')
// A query such as ?raw is kept as written. Relative specifiers stay relative
// and '@/' or '@domain/' specifiers keep their alias while the new path is
// still under the alias folder. A specifier keeps its own form: without an
// extension, with the file's extension, with .js for a .ts file, or naming a
// folder for its index file. Comments and other strings are never touched.
//
// Each specifier is resolved with TypeScript's module resolver
// (ts.resolveModuleName) using the compiler options and paths of
// tsconfig.app.json, never by matching text. A specifier for a file the
// resolver does not handle (a .sql, .md, .css or .json file, usually with
// ?raw) is resolved as a path, through the same paths when it uses an alias.
// Only relative and alias specifiers are considered; package names are left
// alone.
//
// Before anything is written, every new specifier is resolved again against
// the layout after the move and must reach the same file. Any relative or
// alias specifier that cannot be resolved, or any rewrite that would not
// resolve, stops the run: nothing is moved and nothing is written, and the
// exit code is 1. --dry-run prints the plan and the problems and writes
// nothing.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, isAbsolute, join, posix, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The folders searched for importers, relative to the root. */
export const SCAN_DIRS = ['src', 'functions', 'workers', 'domain', 'test', 'scripts', 'scanner']

/** Folders never searched, wherever they appear. */
const SKIP_DIRS = new Set(['node_modules', 'dist', '.wrangler', '.git', 'coverage'])

/**
 * Folders left out of the search on purpose, relative to the root, with the
 * reason. The plan prints them.
 */
export const NOT_SEARCHED: Record<string, string> = {
  'test/unit/fixtures/lint': 'lint fixture text, linted as if it sat under domain/; its imports do not resolve from where it is, and nothing imports it',
}

export const CODE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']

/** vi.<name>(specifier, ...) calls whose first argument is a module. */
const VI_MODULE_CALLS = new Set(['mock', 'doMock', 'unmock', 'doUnmock', 'importActual', 'importMock'])

const toPosix = (p: string) => p.split(sep).join('/')

export function isCodeFile(path: string): boolean {
  return CODE_EXTENSIONS.includes(extname(path)) && !path.endsWith('.d.ts.map')
}

function scriptKindFor(path: string): ts.ScriptKind {
  switch (extname(path)) {
    case '.tsx': return ts.ScriptKind.TSX
    case '.jsx': return ts.ScriptKind.JSX
    case '.js': case '.mjs': case '.cjs': return ts.ScriptKind.JS
    default: return ts.ScriptKind.TS
  }
}

// ── Finding specifiers ─────────────────────────────────────────────────────

export interface Specifier {
  /** The text between the quotes. */
  text: string
  /** Offsets of that text in the file (the quotes excluded). */
  start: number
  end: number
  /** 0-based line of the specifier. */
  line: number
  kind: 'import' | 'export' | 'dynamic' | 'type' | 'mock' | 'require'
}

/** Every module specifier in `source` written as a string literal. */
export function findSpecifiers(path: string, source: string): Specifier[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, scriptKindFor(path))
  const found: Specifier[] = []
  const add = (node: ts.Node | undefined, kind: Specifier['kind']) => {
    if (!node || !(ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) return
    const start = node.getStart(file) + 1
    found.push({ text: node.text, start, end: node.end - 1, line: file.getLineAndCharacterOfPosition(start).line, kind })
  }
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) add(node.moduleSpecifier, 'import')
    else if (ts.isExportDeclaration(node)) add(node.moduleSpecifier, 'export')
    else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      add(node.moduleReference.expression, 'require')
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node.argument.literal, 'type')
    } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const callee = node.expression
      if (callee.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0], 'dynamic')
      else if (ts.isIdentifier(callee) && callee.text === 'require') add(node.arguments[0], 'require')
      else if (
        ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)
        && callee.expression.text === 'vi' && VI_MODULE_CALLS.has(callee.name.text)
      ) add(node.arguments[0], 'mock')
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found.sort((a, b) => a.start - b.start)
}

// ── The map ────────────────────────────────────────────────────────────────

export interface Move {
  /** Paths relative to the root, with forward slashes. */
  from: string
  to: string
}

export interface MovePlan {
  /** The entries as written in the map (folders stay folders). */
  entries: Move[]
  /** One move per file, folders expanded. */
  files: Move[]
}

function git(root: string, args: string[]): { ok: boolean; out: string; err: string } {
  const env = { ...process.env }
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  delete env.GIT_INDEX_FILE
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', env })
  return { ok: r.status === 0, out: r.stdout ?? '', err: (r.stderr ?? '') + (r.error ? String(r.error) : '') }
}

const cleanRel = (p: string) => posix.normalize(toPosix(p)).replace(/\/+$/, '')

/** Reads the map and expands folder entries into one move per tracked file. Throws with every problem found. */
export function loadMap(root: string, mapPath: string): MovePlan {
  const raw = JSON.parse(readFileSync(mapPath, 'utf8')) as unknown
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${mapPath} must be a JSON object of old path to new path.`)
  const problems: string[] = []
  const entries: Move[] = []
  for (const [from, to] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof to !== 'string' || !to) { problems.push(`${from}: the new path must be a string`); continue }
    const move = { from: cleanRel(from), to: cleanRel(to) }
    if (isAbsolute(move.from) || isAbsolute(move.to) || move.from.startsWith('..') || move.to.startsWith('..')) {
      problems.push(`${from}: paths must be relative to the root and stay inside it`)
      continue
    }
    entries.push(move)
  }
  const files: Move[] = []
  for (const e of entries) {
    const abs = join(root, e.from)
    if (!existsSync(abs)) {
      problems.push(existsSync(join(root, e.to)) ? `${e.from} was already moved to ${e.to}` : `${e.from} does not exist`)
      continue
    }
    if (existsSync(join(root, e.to))) { problems.push(`${e.to} already exists`); continue }
    const tracked = git(root, ['ls-files', '--', e.from]).out.split('\n').filter(Boolean)
    if (tracked.length === 0) { problems.push(`${e.from} is not tracked by git`); continue }
    if (statSync(abs).isDirectory()) {
      const untracked = git(root, ['ls-files', '--others', '--', e.from]).out.split('\n').filter(Boolean)
      if (untracked.length > 0) problems.push(`${e.from} holds files git does not track: ${untracked.join(', ')}`)
      for (const f of tracked) files.push({ from: f, to: e.to + f.slice(e.from.length) })
    } else {
      files.push({ from: e.from, to: e.to })
    }
  }
  const targets = new Set<string>()
  for (const f of files) {
    if (targets.has(f.to)) problems.push(`two entries move a file to ${f.to}`)
    targets.add(f.to)
  }
  const sources = new Set(files.map((f) => f.from))
  for (const f of files) if (sources.has(f.to)) problems.push(`${f.to} is both moved and a destination`)
  if (problems.length > 0) throw new Error(problems.join('\n'))
  return { entries, files }
}

// ── Resolving ──────────────────────────────────────────────────────────────

interface Resolver {
  options: ts.CompilerOptions
  /** Alias patterns from `paths`, e.g. { prefix: '@/', targets: ['/abs/src/'] }. */
  aliases: Array<{ prefix: string; targets: string[] }>
}

/** Compiler options and aliases from <root>/tsconfig.app.json (when present), widened to every file kind the repo imports. */
export function loadResolver(root: string): Resolver {
  const configPath = join(root, 'tsconfig.app.json')
  let options: ts.CompilerOptions = {}
  if (existsSync(configPath)) {
    const read = ts.readConfigFile(configPath, ts.sys.readFile)
    if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, '\n'))
    options = ts.parseJsonConfigFileContent(read.config, ts.sys, root, undefined, configPath).options
  }
  options = {
    ...options,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    module: ts.ModuleKind.ESNext,
    allowJs: true,
    allowImportingTsExtensions: true,
    resolveJsonModule: true,
    noEmit: true,
  }
  const base = options.baseUrl ?? root
  const aliases = Object.entries(options.paths ?? {})
    .filter(([key]) => key.endsWith('/*'))
    .map(([key, targets]) => ({
      prefix: key.slice(0, -1),
      targets: targets.filter((t) => t.endsWith('/*')).map((t) => resolve(base, t.slice(0, -1)) + '/'),
    }))
    .sort((a, b) => b.prefix.length - a.prefix.length)
  return { options, aliases }
}

/** A module host that answers as if the moves had already happened. */
function afterMoveHost(moved: Map<string, string>): ts.ModuleResolutionHost {
  const fromSet = new Set(moved.keys())
  const toSet = new Set(moved.values())
  const toDirs = new Set<string>()
  for (const t of toSet) for (let d = dirname(t); d !== dirname(d); d = dirname(d)) toDirs.add(d)
  return {
    fileExists: (p) => toSet.has(p) || (!fromSet.has(p) && ts.sys.fileExists(p)),
    readFile: (p) => ts.sys.readFile(p),
    directoryExists: (p) => toDirs.has(p) || ts.sys.directoryExists(p),
    realpath: (p) => p,
    getCurrentDirectory: () => process.cwd(),
  }
}

const beforeHost: ts.ModuleResolutionHost = {
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  directoryExists: (p) => ts.sys.directoryExists(p),
  realpath: (p) => p,
  getCurrentDirectory: () => process.cwd(),
}

const isRelative = (s: string) => s === '.' || s === '..' || s.startsWith('./') || s.startsWith('../')

/** Splits a specifier into its path and its query (`?raw`), if any. */
export function splitQuery(spec: string): { path: string; query: string } {
  const at = spec.indexOf('?')
  return at < 0 ? { path: spec, query: '' } : { path: spec.slice(0, at), query: spec.slice(at) }
}

function aliasFor(r: Resolver, spec: string) {
  return r.aliases.find((a) => spec.startsWith(a.prefix))
}

/**
 * The absolute file `spec` (written in `importer`) refers to, or null when it
 * cannot be resolved. Returns undefined for a package name, which is never
 * rewritten.
 */
export function resolveSpecifier(r: Resolver, spec: string, importer: string, host: ts.ModuleResolutionHost = beforeHost): string | null | undefined {
  const { path } = splitQuery(spec)
  const alias = aliasFor(r, path)
  if (!isRelative(path) && !alias) return undefined
  const resolved = ts.resolveModuleName(path, importer, r.options, host).resolvedModule
  if (resolved && !resolved.isExternalLibraryImport) return resolve(resolved.resolvedFileName)
  // A file the resolver does not handle (.sql, .md, .css ...): resolve it as a path.
  const ext = extname(path)
  if (ext && !CODE_EXTENSIONS.includes(ext)) {
    const candidates = alias
      ? alias.targets.map((t) => resolve(t, path.slice(alias.prefix.length)))
      : [resolve(dirname(importer), path)]
    for (const c of candidates) if (host.fileExists(c)) return c
  }
  return null
}

/** The extension TypeScript treats as the file's own (.d.ts counts as one). */
function fullExt(file: string): string {
  for (const e of ['.d.ts', '.d.mts', '.d.cts']) if (file.endsWith(e)) return e
  return extname(file)
}

/**
 * The specifier that reaches `newTarget` from `newImporter` in the same form
 * `spec` reached `oldTarget`.
 */
export function rewriteSpecifier(r: Resolver, spec: string, oldTarget: string, newTarget: string, newImporter: string): string {
  const { path, query } = splitQuery(spec)
  const specBase = posix.basename(path)
  const oldBase = posix.basename(toPosix(oldTarget))
  const ext = fullExt(oldTarget)
  const specExt = extname(specBase)
  let target: string
  if (specBase === oldBase) {
    target = newTarget // written with the file's own extension
  } else if (oldBase === specBase + ext) {
    target = newTarget.slice(0, newTarget.length - ext.length) // written without an extension
  } else if (specExt && ext && oldBase.slice(0, -ext.length) === specBase.slice(0, -specExt.length)) {
    target = newTarget.slice(0, newTarget.length - ext.length) + specExt // .js written for a .ts file
  } else if (/^index\.[^/]+$/.test(oldBase)) {
    target = dirname(newTarget) // the folder, for its index file
  } else {
    target = newTarget.slice(0, newTarget.length - ext.length)
  }
  const alias = aliasFor(r, path)
  if (alias) {
    for (const t of alias.targets) {
      if (target.startsWith(t)) return alias.prefix + toPosix(target.slice(t.length)) + query
    }
  }
  let rel = toPosix(relative(dirname(newImporter), target))
  if (rel === '') rel = '.'
  else if (!rel.startsWith('.')) rel = './' + rel
  return rel + query
}

// ── Planning ───────────────────────────────────────────────────────────────

export interface Edit {
  /** The file as it is now, relative to the root. */
  file: string
  /** Where the file will be after the move (same as file when it does not move). */
  writeTo: string
  line: number
  from: string
  to: string
}

export interface Problem {
  file: string
  line: number
  specifier: string
  reason: string
}

export interface Plan {
  moves: MovePlan
  edits: Edit[]
  problems: Problem[]
  /** New contents by the path they are written to after the move. */
  contents: Map<string, string>
  scanned: number
}

/** Every code file under the scan folders and at the root. */
export function codeFiles(root: string): string[] {
  const out: string[] = []
  const skipped = new Set(Object.keys(NOT_SEARCHED).map((d) => join(root, d)))
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue
      const abs = join(dir, name)
      if (skipped.has(abs)) continue
      const st = statSync(abs)
      if (st.isDirectory()) walk(abs)
      else if (isCodeFile(name)) out.push(abs)
    }
  }
  for (const d of SCAN_DIRS) if (existsSync(join(root, d))) walk(join(root, d))
  for (const name of readdirSync(root)) {
    const abs = join(root, name)
    if (isCodeFile(name) && statSync(abs).isFile()) out.push(abs)
  }
  return [...new Set(out)].sort()
}

export function planMove(root: string, mapPath: string): Plan {
  root = realpathSync(root)
  const moves = loadMap(root, mapPath)
  const r = loadResolver(root)
  const moved = new Map(moves.files.map((m) => [join(root, m.from), join(root, m.to)]))
  const after = afterMoveHost(moved)
  const files = new Set(codeFiles(root))
  for (const abs of moved.keys()) if (isCodeFile(abs)) files.add(abs)

  const edits: Edit[] = []
  const problems: Problem[] = []
  const contents = new Map<string, string>()
  for (const importer of [...files].sort()) {
    const source = readFileSync(importer, 'utf8')
    const newImporter = moved.get(importer) ?? importer
    const rel = toPosix(relative(root, importer))
    const changes: Array<{ s: Specifier; to: string }> = []
    for (const s of findSpecifiers(importer, source)) {
      const target = resolveSpecifier(r, s.text, importer)
      if (target === undefined) continue
      if (target === null) {
        problems.push({ file: rel, line: s.line + 1, specifier: s.text, reason: 'cannot be resolved' })
        continue
      }
      const newTarget = moved.get(target) ?? target
      if (newTarget === target && newImporter === importer) continue
      if (!isRelative(splitQuery(s.text).path) && newTarget === target) continue
      const to = rewriteSpecifier(r, s.text, target, newTarget, newImporter)
      const check = resolveSpecifier(r, to, newImporter, after)
      if (check !== newTarget) {
        problems.push({
          file: rel, line: s.line + 1, specifier: s.text,
          reason: `would become '${to}', which ${check ? `reaches ${toPosix(relative(root, check))}` : 'does not resolve'} after the move instead of ${toPosix(relative(root, newTarget))}`,
        })
        continue
      }
      if (to !== s.text) changes.push({ s, to })
    }
    if (changes.length === 0) continue
    let text = source
    for (const c of [...changes].sort((a, b) => b.s.start - a.s.start)) {
      text = text.slice(0, c.s.start) + c.to + text.slice(c.s.end)
    }
    const writeTo = toPosix(relative(root, newImporter))
    contents.set(writeTo, text)
    for (const c of changes) edits.push({ file: rel, writeTo, line: c.s.line + 1, from: c.s.text, to: c.to })
  }
  return { moves, edits, problems, contents, scanned: files.size }
}

// ── Applying ───────────────────────────────────────────────────────────────

/** Runs git mv for each entry, then writes the rewritten files. */
export function applyPlan(root: string, plan: Plan): void {
  root = realpathSync(root)
  for (const e of plan.moves.entries) {
    mkdirSync(dirname(join(root, e.to)), { recursive: true })
    const r = git(root, ['mv', '--', e.from, e.to])
    if (!r.ok) throw new Error(`git mv ${e.from} ${e.to} failed: ${r.err.trim()}`)
  }
  for (const [rel, text] of plan.contents) writeFileSync(join(root, rel), text)
}

function printPlan(plan: Plan, dryRun: boolean): void {
  console.log(`${dryRun ? 'Plan (dry run, nothing written)' : 'Plan'}: ${plan.moves.entries.length} moves (${plan.moves.files.length} files), ${plan.edits.length} specifiers in ${plan.contents.size} files, ${plan.scanned} files searched.`)
  console.log('\nMoves:')
  for (const m of plan.moves.entries) console.log(`  ${m.from} -> ${m.to}`)
  console.log('\nSpecifiers:')
  let last = ''
  for (const e of plan.edits) {
    if (e.file !== last) console.log(`  ${e.file}${e.writeTo !== e.file ? ` (now ${e.writeTo})` : ''}`)
    last = e.file
    console.log(`    ${e.line}: '${e.from}' -> '${e.to}'`)
  }
  console.log('\nNot searched:')
  for (const [dir, why] of Object.entries(NOT_SEARCHED)) console.log(`  ${dir}: ${why}`)
  console.log(`\nSpecifiers that could not be resolved: ${plan.problems.length}`)
  for (const p of plan.problems) console.log(`  ${p.file}:${p.line} '${p.specifier}' ${p.reason}`)
}

function main(): number {
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run')
  const at = argv.indexOf('--root')
  const root = resolve(at >= 0 ? argv[at + 1] ?? '' : REPO_ROOT)
  const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--root')
  if (positional.length !== 1) {
    console.error('Usage: node --no-warnings --experimental-strip-types scripts/move-files.ts <map.json> [--dry-run] [--root <dir>]')
    return 1
  }
  const top = git(root, ['rev-parse', '--show-toplevel'])
  if (!top.ok || realpathSync(top.out.trim()) !== realpathSync(root)) {
    console.error(`Stopped: ${root} is not the top of a git work tree.`)
    return 1
  }
  let plan: Plan
  try {
    plan = planMove(root, resolve(positional[0]))
  } catch (e) {
    console.error(`Stopped: the map cannot be used.\n${(e as Error).message}`)
    return 1
  }
  printPlan(plan, dryRun)
  if (plan.problems.length > 0) {
    console.error(`\nStopped: ${plan.problems.length} specifier(s) could not be resolved. Nothing was moved or written.`)
    return 1
  }
  if (dryRun) return 0
  applyPlan(root, plan)
  console.log(`\nMoved ${plan.moves.files.length} files and rewrote ${plan.edits.length} specifiers. Check with scripts/verify-move.ts.`)
  return 0
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) process.exit(main())
