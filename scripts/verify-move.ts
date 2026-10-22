// scripts/verify-move.ts
//
// Checks a move made by scripts/move-files.ts against git, so the change can
// be reviewed as renames plus import-line edits.
//
// Usage:
//   node --no-warnings --experimental-strip-types scripts/verify-move.ts <map.json> [--base <rev>] [--root <dir>] [--ignore <path>]...
//
// It compares the working tree with <rev> (HEAD by default) and passes only
// when:
// 1. git sees every file in the map as renamed from its old path to its new
//    path (git diff -M, staged or not), and the old paths are gone;
// 2. each moved file has the same number of lines as before, and every line
//    that differs is a module specifier line (import, export-from, dynamic
//    import, typeof import, vi.mock and the like, or require) that is the
//    same once the specifiers are blanked out, or a line whose only change
//    is a moved path written out in a comment or string (old path replaced
//    by the new one, with or without the extension or the leading folders);
// 3. every other changed file passes the same line check. A file added or
//    deleted outside the map fails. Files named with --ignore (such as a
//    status document edited in the same change) are left out and listed.
//    Untracked files are listed and not checked.
//
// Each changed line is printed with its kind, so the specifier edits and the
// path mentions can be read separately. It only reads; it changes nothing.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findSpecifiers, isCodeFile, REPO_ROOT, type Move } from './move-files.ts'

function git(root: string, args: string[]): { ok: boolean; out: string; err: string } {
  const env = { ...process.env }
  delete env.GIT_DIR
  delete env.GIT_WORK_TREE
  delete env.GIT_INDEX_FILE
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', env, maxBuffer: 64 * 1024 * 1024 })
  return { ok: r.status === 0, out: r.stdout ?? '', err: (r.stderr ?? '') + (r.error ? String(r.error) : '') }
}

const cleanRel = (p: string) => p.split('\\').join('/').replace(/^\.\//, '').replace(/\/+$/, '')

/** The map's entries, with folders expanded from the files <base> holds under them. */
export function expandMap(root: string, mapPath: string, base: string): { entries: Move[]; files: Move[] } {
  const raw = JSON.parse(readFileSync(mapPath, 'utf8')) as Record<string, string>
  const entries = Object.entries(raw).map(([from, to]) => ({ from: cleanRel(from), to: cleanRel(to) }))
  const files: Move[] = []
  for (const e of entries) {
    const listed = git(root, ['ls-tree', '-r', '--name-only', base, '--', e.from]).out.split('\n').filter(Boolean)
    if (listed.length === 1 && listed[0] === e.from) files.push(e)
    else for (const f of listed) files.push({ from: f, to: e.to + f.slice(e.from.length) })
    if (listed.length === 0) files.push(e) // reported as missing below
  }
  return { entries, files }
}

/**
 * Pairs of (old text, new text) for every way a moved path may be written
 * in prose: with and without its extension, and with leading folders the old
 * and new paths share left off, down to two segments.
 */
export function mentionPairs(entries: Move[], files: Move[]): Array<[string, string]> {
  const pairs = new Map<string, string>()
  const add = (from: string, to: string) => {
    const a = from.split('/')
    const b = to.split('/')
    let shared = 0
    while (shared < a.length - 1 && shared < b.length - 1 && a[shared] === b[shared]) shared++
    for (let k = 0; k <= shared; k++) {
      const oldText = a.slice(k).join('/')
      if (oldText.split('/').length < 2) break
      pairs.set(oldText, b.slice(k).join('/'))
      const dot = oldText.lastIndexOf('.')
      const newDot = b.slice(k).join('/').lastIndexOf('.')
      if (dot > oldText.lastIndexOf('/') && newDot > 0) pairs.set(oldText.slice(0, dot), b.slice(k).join('/').slice(0, newDot))
    }
  }
  for (const m of [...entries, ...files]) add(m.from, m.to)
  return [...pairs.entries()].sort((x, y) => y[0].length - x[0].length)
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Replaces every moved path written in `line` with its new path. */
export function replaceMentions(line: string, pairs: Array<[string, string]>): string {
  if (pairs.length === 0) return line
  const lookup = new Map(pairs)
  const re = new RegExp(`(?<![\\w-])(${pairs.map(([o]) => escape(o)).join('|')})(?![\\w-])`, 'g')
  return line.replace(re, (m) => lookup.get(m) ?? m)
}

export interface LineChange {
  line: number
  kind: 'specifier' | 'path'
  before: string
  after: string
}

export interface FileCheck {
  changes: LineChange[]
  failures: string[]
}

/** Line ranges of the specifiers in a code file, by 0-based line. */
function specifierColumns(path: string, text: string): Map<number, Array<[number, number]>> {
  const out = new Map<number, Array<[number, number]>>()
  if (!isCodeFile(path)) return out
  const lineStarts = [0]
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') lineStarts.push(i + 1)
  for (const s of findSpecifiers(path, text)) {
    const col = s.start - lineStarts[s.line]
    const list = out.get(s.line) ?? []
    list.push([col, col + (s.end - s.start)])
    out.set(s.line, list)
  }
  return out
}

function blank(line: string, cols: Array<[number, number]> | undefined): string {
  if (!cols) return line
  let out = line
  for (const [a, b] of [...cols].sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + '\u0000' + out.slice(b)
  return out
}

/** The line-level check of one file's old and new text. */
export function compareFile(oldPath: string, oldText: string, newPath: string, newText: string, pairs: Array<[string, string]>): FileCheck {
  const a = oldText.split('\n')
  const b = newText.split('\n')
  const failures: string[] = []
  const changes: LineChange[] = []
  if (a.length !== b.length) {
    return { changes, failures: [`the line count changed (${a.length} to ${b.length})`] }
  }
  const oldCols = specifierColumns(oldPath, oldText)
  const newCols = specifierColumns(newPath, newText)
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue
    const before = a[i]
    const after = b[i]
    const oc = oldCols.get(i)
    const nc = newCols.get(i)
    if (oc && nc && oc.length === nc.length) {
      const x = blank(before, oc)
      const y = blank(after, nc)
      if (x === y || replaceMentions(x, pairs) === y) {
        changes.push({ line: i + 1, kind: 'specifier', before, after })
        continue
      }
    }
    if (replaceMentions(before, pairs) === after) {
      changes.push({ line: i + 1, kind: 'path', before, after })
      continue
    }
    failures.push(`line ${i + 1} changed beyond a specifier or a moved path:\n      - ${before}\n      + ${after}`)
  }
  return { changes, failures }
}

export interface Report {
  ok: boolean
  renames: Array<Move & { check: FileCheck }>
  others: Array<{ file: string; check: FileCheck }>
  problems: string[]
  ignored: string[]
  untracked: string[]
}

function parseNameStatus(out: string): Array<{ status: string; paths: string[] }> {
  const parts = out.split('\0').filter((p) => p !== '')
  const rows: Array<{ status: string; paths: string[] }> = []
  for (let i = 0; i < parts.length;) {
    const status = parts[i++]
    const n = status.startsWith('R') || status.startsWith('C') ? 2 : 1
    rows.push({ status, paths: parts.slice(i, i + n) })
    i += n
  }
  return rows
}

export function verifyMove(root: string, mapPath: string, base = 'HEAD', ignore: string[] = []): Report {
  root = realpathSync(root)
  const { entries, files } = expandMap(root, mapPath, base)
  const pairs = mentionPairs(entries, files)
  const problems: string[] = []
  const show = (path: string) => {
    const r = git(root, ['show', `${base}:${path}`])
    return r.ok ? r.out : null
  }

  // 1. git sees each file as a rename.
  const renamed = new Set<string>()
  for (const args of [['diff', '--cached', '-M', '--name-status', '-z', base], ['diff', '-M', '--name-status', '-z', base]]) {
    for (const row of parseNameStatus(git(root, args).out)) {
      if (row.status.startsWith('R')) renamed.add(`${row.paths[0]}\0${row.paths[1]}`)
    }
  }
  const renames: Report['renames'] = []
  for (const f of files) {
    const oldText = show(f.from)
    if (oldText === null) { problems.push(`${f.from} is not in ${base}`); continue }
    if (existsSync(join(root, f.from))) problems.push(`${f.from} still exists`)
    if (!existsSync(join(root, f.to))) { problems.push(`${f.to} does not exist`); continue }
    if (!renamed.has(`${f.from}\0${f.to}`)) problems.push(`git does not see ${f.from} -> ${f.to} as a rename`)
    const check = compareFile(f.from, oldText, f.to, readFileSync(join(root, f.to), 'utf8'), pairs)
    renames.push({ ...f, check })
  }

  // 2. Every other changed file.
  const movedFrom = new Set(files.map((f) => f.from))
  const movedTo = new Set(files.map((f) => f.to))
  const ignoreSet = new Set(ignore.map(cleanRel))
  const ignored: string[] = []
  const others: Report['others'] = []
  const rows = parseNameStatus(git(root, ['diff', '--no-renames', '--name-status', '-z', base]).out)
  for (const row of rows) {
    const path = row.paths[0]
    if (movedFrom.has(path) || movedTo.has(path)) continue
    if (ignoreSet.has(path)) { ignored.push(path); continue }
    if (row.status !== 'M') { problems.push(`${path} was ${row.status === 'A' ? 'added' : row.status === 'D' ? 'deleted' : `changed (${row.status})`} outside the map`); continue }
    const oldText = show(path) ?? ''
    others.push({ file: path, check: compareFile(path, oldText, path, readFileSync(join(root, path), 'utf8'), pairs) })
  }
  const untracked = git(root, ['ls-files', '--others', '--exclude-standard']).out.split('\n').filter(Boolean)

  const ok = problems.length === 0
    && renames.every((r) => r.check.failures.length === 0)
    && others.every((o) => o.check.failures.length === 0)
  return { ok, renames, others, problems, ignored, untracked }
}

function printReport(r: Report): void {
  const count = (kind: LineChange['kind'], list: Array<{ check: FileCheck }>) =>
    list.reduce((n, x) => n + x.check.changes.filter((c) => c.kind === kind).length, 0)
  console.log(`Renamed: ${r.renames.length} files (${count('specifier', r.renames)} specifier lines, ${count('path', r.renames)} path mentions changed inside them).`)
  for (const m of r.renames) {
    console.log(`  ${m.from} -> ${m.to}`)
    for (const c of m.check.changes) console.log(`    ${c.line} [${c.kind}] ${c.after.trim()}`)
    for (const f of m.check.failures) console.log(`    FAIL ${f}`)
  }
  console.log(`\nOther files changed: ${r.others.length} (${count('specifier', r.others)} specifier lines, ${count('path', r.others)} path mentions).`)
  for (const o of r.others) {
    console.log(`  ${o.file}`)
    for (const c of o.check.changes) console.log(`    ${c.line} [${c.kind}] ${c.after.trim()}`)
    for (const f of o.check.failures) console.log(`    FAIL ${f}`)
  }
  if (r.ignored.length > 0) console.log(`\nLeft out with --ignore: ${r.ignored.join(', ')}`)
  if (r.untracked.length > 0) console.log(`\nUntracked, not checked: ${r.untracked.join(', ')}`)
  for (const p of r.problems) console.log(`FAIL ${p}`)
  console.log(r.ok ? '\nThe move is renames plus specifier and path-mention lines only.' : '\nThe move has changes beyond renames, specifiers and path mentions.')
}

function main(): number {
  const argv = process.argv.slice(2)
  const valueOf = (flag: string) => {
    const at = argv.indexOf(flag)
    return at >= 0 ? argv[at + 1] : undefined
  }
  const ignore = argv.flatMap((a, i) => (a === '--ignore' && argv[i + 1] ? [argv[i + 1]] : []))
  const positional = argv.filter((a, i) => !a.startsWith('--') && !['--base', '--root', '--ignore'].includes(argv[i - 1]))
  if (positional.length !== 1) {
    console.error('Usage: node --no-warnings --experimental-strip-types scripts/verify-move.ts <map.json> [--base <rev>] [--root <dir>] [--ignore <path>]...')
    return 1
  }
  const root = resolve(valueOf('--root') ?? REPO_ROOT)
  const report = verifyMove(root, resolve(positional[0]), valueOf('--base') ?? 'HEAD', ignore)
  printReport(report)
  return report.ok ? 0 : 1
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) process.exit(main())
