// scripts/codemods/semantic-colours.ts
//
// Moves the colour classes in the site's TSX files from the brand palette to
// the semantic token utilities, following a reviewed map, so each page
// follows dark mode and the looks while drawing exactly what it drew before
// with newLook off.
//
// Usage:
//   node --no-warnings --experimental-strip-types scripts/codemods/semantic-colours.ts [--dry-run | --check] [--map <map.json>] [--root <dir>]
//
// The map (scripts/codemods/semantic-colours.map.json unless --map names
// another) has four parts:
// - watch: the classes that must not be left behind. After a run, every use
//   of one of them has been rewritten or is covered by a keep entry.
// - rules: one utility to another, tried in order; the first that fits wins.
//   A rule says which opacity forms it takes: "none" (the plain class only),
//   "translucent" (only with an opacity modifier, such as /10), "any", or a
//   list of modifiers. With "when": { "sameString": [...] } it also needs one
//   of those classes in the same string, opaque (no opacity modifier; a !
//   mark does not matter), with no variant or with the token's own variant
//   (navy text on a gold fill, for instance).
// - sites: the one string in a file that contains "contains", where the
//   token "from" becomes "to". "contains" is a part of the string that no
//   rewrite touches, so a site still finds its string after the run. A site
//   wins over keep entries and rules.
// - keep: classes left as they are, each with its reason: everywhere (no
//   file), or in the one string of a file that contains "contains".
//
// A rewrite keeps the token's variants (hover:, md:, [&_a]:), its opacity
// modifier and its ! mark; only the utility changes.
//
// What is searched: every .tsx file under <root>/src, read with the
// TypeScript parser, never by matching text across the file. Class strings
// are the string literals and the text parts of template literals. A class
// that runs into a ${} substitution cannot be rewritten safely, and neither
// can a string with an escape in it; either stops the run. Comments are
// searched too, but only the quoted strings inside them (commented-out code),
// never their prose; the plan lists those rewrites apart.
//
// --dry-run prints the plan and writes nothing. --check writes nothing and
// fails when anything is left to rewrite, when a watched class is left with
// no keep entry, or when a site or keep entry no longer matches its string;
// test/unit/semantic-map.test.ts runs the same check on the tree. Any problem
// stops a real run before a file is written, and the exit code is 1.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const HERE = dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = resolve(HERE, '../..')
export const DEFAULT_MAP = join(HERE, 'semantic-colours.map.json')

const USAGE = 'Usage: node --no-warnings --experimental-strip-types scripts/codemods/semantic-colours.ts [--dry-run | --check] [--map <map.json>] [--root <dir>]'

/** Folders never searched, wherever they appear. */
const SKIP_DIRS = new Set(['node_modules', 'dist', '.wrangler', '.git'])

const toPosix = (p: string) => p.split(sep).join('/')

// ── The map ────────────────────────────────────────────────────────────────

/** Which opacity forms a rule or keep entry takes. */
export type Opacity = 'none' | 'translucent' | 'any' | string[]

export interface Rule {
  id: string
  from: string
  opacity: Opacity
  to: string
  when?: { sameString: string[] }
  reason: string
}

export interface Site {
  file: string
  contains: string
  from: string
  to: string
  reason: string
}

export interface Keep {
  class: string
  opacity: Opacity
  file?: string
  contains?: string
  reason: string
}

export interface ColourMap {
  comment?: string
  watch: string[]
  rules: Rule[]
  sites: Site[]
  keep: Keep[]
}

/** A utility name on its own: no variant, no ! mark, no opacity modifier. */
const isUtility = (s: unknown): s is string => typeof s === 'string' && /^[a-z][a-z0-9-]*$/.test(s)

const isOpacity = (o: unknown): o is Opacity =>
  o === 'none' || o === 'translucent' || o === 'any' || (Array.isArray(o) && o.length > 0 && o.every((m) => typeof m === 'string' && m !== ''))

const isText = (s: unknown): s is string => typeof s === 'string' && s.trim() !== ''

/** Reads and checks the map. Throws with every problem found. */
export function loadMap(path: string): ColourMap {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<ColourMap>
  const problems: string[] = []
  if (!raw || typeof raw !== 'object') throw new Error(`${path} must hold a JSON object.`)
  const watch = Array.isArray(raw.watch) ? raw.watch : []
  if (watch.length === 0 || !watch.every(isUtility)) problems.push('watch must list one or more utility names, such as "text-lca-navy"')
  const rules = Array.isArray(raw.rules) ? raw.rules : []
  const ids = new Set<string>()
  rules.forEach((r, i) => {
    const where = `rules[${i}]${r && isText(r.id) ? ` (${r.id})` : ''}`
    if (!r || !isText(r.id)) problems.push(`${where}: an id is needed`)
    else if (ids.has(r.id)) problems.push(`${where}: the id is used twice`)
    else ids.add(r.id)
    if (!isUtility(r?.from) || !isUtility(r?.to)) problems.push(`${where}: from and to must be utility names, without a variant or modifier`)
    if (!isOpacity(r?.opacity)) problems.push(`${where}: opacity must be "none", "translucent", "any" or a list of modifiers`)
    if (r?.when !== undefined && !(Array.isArray(r.when.sameString) && r.when.sameString.length > 0 && r.when.sameString.every(isUtility))) {
      problems.push(`${where}: when.sameString must list utility names`)
    }
    if (!isText(r?.reason)) problems.push(`${where}: a reason is needed`)
  })
  const sites = Array.isArray(raw.sites) ? raw.sites : []
  sites.forEach((s, i) => {
    const where = `sites[${i}]`
    if (!isText(s?.file) || !s.file.endsWith('.tsx') || s.file.startsWith('/') || s.file.includes('..')) problems.push(`${where}: file must be a .tsx path relative to the root`)
    if (!isText(s?.contains)) problems.push(`${where}: contains is needed`)
    if (!isText(s?.from) || !isText(s?.to) || /\s/.test(s.from + s.to)) problems.push(`${where}: from and to must be single class tokens`)
    else if (s.from === s.to) problems.push(`${where}: from and to are the same`)
    else if (isText(s.contains) && (s.contains.includes(s.from) || s.contains.includes(s.to))) {
      problems.push(`${where}: contains must not hold the token it rewrites, or the site would lose its string after the run`)
    }
    if (!isText(s?.reason)) problems.push(`${where}: a reason is needed`)
  })
  const keep = Array.isArray(raw.keep) ? raw.keep : []
  keep.forEach((k, i) => {
    const where = `keep[${i}]`
    if (!isUtility(k?.class)) problems.push(`${where}: class must be a utility name, without a variant or modifier`)
    if (!isOpacity(k?.opacity)) problems.push(`${where}: opacity must be "none", "translucent", "any" or a list of modifiers`)
    if ((k?.file === undefined) !== (k?.contains === undefined)) problems.push(`${where}: give both file and contains, or neither`)
    if (k?.file !== undefined && (!isText(k.file) || !k.file.endsWith('.tsx'))) problems.push(`${where}: file must be a .tsx path relative to the root`)
    if (k?.contains !== undefined && !isText(k.contains)) problems.push(`${where}: contains must not be empty`)
    if (!isText(k?.reason)) problems.push(`${where}: a reason is needed`)
  })
  if (problems.length > 0) throw new Error(problems.join('\n'))
  return { comment: raw.comment, watch, rules, sites, keep }
}

// ── Class tokens ───────────────────────────────────────────────────────────

export interface ClassToken {
  /** The token as written. */
  text: string
  /** Everything before the utility: '', 'hover:', 'md:hover:', '[&_a]:'. */
  variants: string
  /** Where a ! mark sits, if there is one. */
  bang: '' | 'start' | 'end'
  /** The utility alone: 'text-lca-navy'. */
  utility: string
  /** The opacity modifier without its slash: '80', '[0.03]', or ''. */
  modifier: string
}

/** The position of the last `char` outside brackets and parentheses, or -1. */
function lastTopLevel(text: string, char: string): number {
  let depth = 0
  let at = -1
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth--
    else if (c === char && depth === 0) at = i
  }
  return at
}

/** Splits a class into its variants, ! mark, utility and opacity modifier. */
export function parseToken(text: string): ClassToken {
  const cut = lastTopLevel(text, ':')
  const variants = text.slice(0, cut + 1)
  let rest = text.slice(cut + 1)
  let bang: ClassToken['bang'] = ''
  if (rest.startsWith('!')) {
    bang = 'start'
    rest = rest.slice(1)
  } else if (rest.endsWith('!')) {
    bang = 'end'
    rest = rest.slice(0, -1)
  }
  const slash = lastTopLevel(rest, '/')
  return {
    text,
    variants,
    bang,
    utility: slash < 0 ? rest : rest.slice(0, slash),
    modifier: slash < 0 ? '' : rest.slice(slash + 1),
  }
}

/** Writes a token back out with another utility. */
export function withUtility(token: ClassToken, utility: string): string {
  const bang = (where: ClassToken['bang']) => (token.bang === where ? '!' : '')
  return `${token.variants}${bang('start')}${utility}${token.modifier ? `/${token.modifier}` : ''}${bang('end')}`
}

export function takesOpacity(opacity: Opacity, modifier: string): boolean {
  if (opacity === 'any') return true
  if (opacity === 'none') return modifier === ''
  if (opacity === 'translucent') return modifier !== ''
  return opacity.includes(modifier)
}

// ── Class strings ──────────────────────────────────────────────────────────

export interface ClassString {
  /** Where the text starts and ends in the file, quotes left out. */
  start: number
  end: number
  /** The text as written in the file. */
  text: string
  /** The string's value: the text with any escape worked out. */
  value: string
  kind: 'code' | 'comment'
  /** The text runs into a ${} substitution at its start or its end. */
  joinedStart: boolean
  joinedEnd: boolean
  /** The source text differs from the string's value (an escape). */
  escaped: boolean
}

/**
 * Every string in a TSX file that can hold classes: string literals, the
 * text parts of template literals, and the quoted strings inside comments.
 */
export function classStrings(path: string, source: string): ClassString[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: ClassString[] = []
  // Text that cannot hold a comment: strings, template parts, JSX text and
  // regular expressions. Blanked before comments are looked for.
  const code: Array<[number, number]> = []
  const visit = (node: ts.Node) => {
    let open = 0
    let close = 0
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateTail(node)) {
      open = 1
      close = 1
    } else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node)) {
      open = 1
      close = 2
    }
    if (open > 0) {
      const at = node.getStart(file)
      const start = at + open
      const end = node.end - close
      const text = source.slice(start, end)
      const value = (node as ts.LiteralLikeNode).text
      code.push([at, node.end])
      found.push({
        start,
        end,
        text,
        value,
        kind: 'code',
        joinedStart: ts.isTemplateMiddle(node) || ts.isTemplateTail(node),
        joinedEnd: ts.isTemplateHead(node) || ts.isTemplateMiddle(node),
        escaped: text !== value,
      })
    } else if (ts.isJsxText(node) || ts.isRegularExpressionLiteral(node)) {
      code.push([node.getStart(file), node.end])
    }
    ts.forEachChild(node, visit)
  }
  visit(file)

  let blanked = source
  for (const [a, b] of code) blanked = blanked.slice(0, a) + ' '.repeat(b - a) + blanked.slice(b)
  for (const comment of blanked.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g)) {
    const at = comment.index ?? 0
    const body = source.slice(at, at + comment[0].length)
    for (const quoted of body.matchAll(/(["'`])((?:(?!\1)[^\n\\])*)\1/g)) {
      const start = at + (quoted.index ?? 0) + 1
      found.push({ start, end: start + quoted[2].length, text: quoted[2], value: quoted[2], kind: 'comment', joinedStart: false, joinedEnd: false, escaped: false })
    }
  }
  return found.sort((a, b) => a.start - b.start)
}

/** The whitespace-separated tokens of a string, with their offsets in it. */
export function tokensOf(text: string): Array<{ token: ClassToken; offset: number }> {
  return [...text.matchAll(/\S+/g)].map((m) => ({ token: parseToken(m[0]), offset: m.index ?? 0 }))
}

/** Every .tsx file under <root>/src, as paths relative to the root with forward slashes. */
export function tsxFiles(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    if (!existsSync(dir)) return
    for (const name of readdirSync(dir).sort()) {
      if (SKIP_DIRS.has(name)) continue
      const abs = join(dir, name)
      if (statSync(abs).isDirectory()) walk(abs)
      else if (name.endsWith('.tsx')) out.push(toPosix(relative(root, abs)))
    }
  }
  walk(join(root, 'src'))
  return out
}

// ── The plan ───────────────────────────────────────────────────────────────

export interface Edit {
  file: string
  line: number
  kind: 'code' | 'comment'
  start: number
  end: number
  from: string
  to: string
  /** The rule's id, or "site". */
  by: string
}

export interface Kept {
  file: string
  line: number
  kind: 'code' | 'comment'
  token: string
  reason: string
}

export interface Problem {
  file: string
  line: number
  message: string
}

export interface Plan {
  searched: number
  edits: Edit[]
  kept: Kept[]
  problems: Problem[]
  /** The new text of each file that changes. */
  contents: Map<string, string>
}

/**
 * Whether a string holds one of `grounds` as an opaque class (no opacity
 * modifier), with no variant or the token's own. A ! mark does not matter:
 * it changes which rule wins, not the colour, so an important gold is
 * still gold.
 */
function hasGround(tokens: Array<{ token: ClassToken }>, token: ClassToken, grounds: string[]): boolean {
  return tokens.some(({ token: t }) =>
    grounds.includes(t.utility) && t.modifier === '' && (t.variants === '' || t.variants === token.variants))
}

/**
 * Works out every rewrite, every kept class and every problem, without
 * writing. With mode "check", a rewrite still to make is a problem too.
 */
export function planRewrite(root: string, map: ColourMap, mode: 'write' | 'check' = 'write'): Plan {
  const watched = new Set(map.watch)
  const files = tsxFiles(root)
  const edits: Edit[] = []
  const kept: Kept[] = []
  const problems: Problem[] = []
  const contents = new Map<string, string>()
  const siteUse = map.sites.map(() => ({ strings: 0, holds: 0 }))
  const keepUse = map.keep.map(() => ({ strings: 0, tokens: 0 }))

  for (const site of map.sites) {
    if (!files.includes(site.file)) problems.push({ file: site.file, line: 0, message: `the site's file is not a .tsx file under src (${site.contains})` })
  }
  for (const k of map.keep) {
    if (k.file && !files.includes(k.file)) problems.push({ file: k.file, line: 0, message: `the keep entry's file is not a .tsx file under src (${k.contains})` })
  }

  for (const file of files) {
    const source = readFileSync(join(root, file), 'utf8')
    const lineStarts = [0]
    for (let i = 0; i < source.length; i++) if (source[i] === '\n') lineStarts.push(i + 1)
    const lineOf = (pos: number) => {
      let lo = 0
      let hi = lineStarts.length - 1
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1
        if (lineStarts[mid] <= pos) lo = mid
        else hi = mid - 1
      }
      return lo + 1
    }
    const fileEdits: Edit[] = []
    for (const s of classStrings(file, source)) {
      const sitesHere = map.sites.flatMap((site, i) => (site.file === file && s.text.includes(site.contains) ? [i] : []))
      const keepsHere = map.keep.flatMap((k, i) => (k.file === file && k.contains !== undefined && s.text.includes(k.contains) ? [i] : []))
      for (const i of sitesHere) siteUse[i].strings++
      for (const i of keepsHere) keepUse[i].strings++
      // A string with an escape is read by its value, to find what it holds;
      // nothing in it is rewritten.
      const tokens = tokensOf(s.escaped ? s.value : s.text)
      for (const { token, offset } of tokens) {
        const pos = s.start + offset
        const line = lineOf(pos)
        const joined = (offset === 0 && s.joinedStart) || (offset + token.text.length === s.text.length && s.joinedEnd)
        const rewrite = (to: string, by: string) => {
          if (joined) problems.push({ file, line, message: `${token.text} runs into a \${} substitution, so it cannot be rewritten safely` })
          else if (s.escaped) problems.push({ file, line, message: `${token.text} is in a string with an escape in it, so it cannot be rewritten safely` })
          else fileEdits.push({ file, line, kind: s.kind, start: pos, end: pos + token.text.length, from: token.text, to, by })
        }

        const site = sitesHere.find((i) => map.sites[i].from === token.text)
        if (site !== undefined) {
          siteUse[site].holds++
          rewrite(map.sites[site].to, 'site')
          continue
        }
        for (const i of sitesHere) if (map.sites[i].to === token.text) siteUse[i].holds++

        const keep = map.keep.findIndex((k, i) =>
          k.class === token.utility && takesOpacity(k.opacity, token.modifier) && (k.file === undefined || keepsHere.includes(i)))
        if (keep >= 0) {
          keepUse[keep].tokens++
          kept.push({ file, line, kind: s.kind, token: token.text, reason: map.keep[keep].reason })
          continue
        }

        const rule = map.rules.find((r) =>
          r.from === token.utility && takesOpacity(r.opacity, token.modifier) && (!r.when || hasGround(tokens, token, r.when.sameString)))
        if (rule) {
          rewrite(withUtility(token, rule.to), rule.id)
          continue
        }
        if (watched.has(token.utility)) {
          problems.push({ file, line, message: `${token.text} has no rule or keep entry in the map` })
        }
      }
    }
    if (fileEdits.length > 0) {
      let text = source
      for (const e of [...fileEdits].sort((a, b) => b.start - a.start)) text = text.slice(0, e.start) + e.to + text.slice(e.end)
      contents.set(file, text)
      edits.push(...fileEdits)
    }
  }

  map.sites.forEach((site, i) => {
    const use = siteUse[i]
    if (use.strings !== 1) {
      problems.push({ file: site.file, line: 0, message: `${use.strings} strings contain "${site.contains}"; a site names exactly one` })
    } else if (use.holds === 0) {
      problems.push({ file: site.file, line: 0, message: `the string with "${site.contains}" holds neither ${site.from} nor ${site.to}` })
    }
  })
  map.keep.forEach((k, i) => {
    const use = keepUse[i]
    if (k.file !== undefined && use.strings !== 1) {
      problems.push({ file: k.file, line: 0, message: `${use.strings} strings contain "${k.contains}"; a keep entry names exactly one` })
    } else if (use.tokens === 0) {
      problems.push({ file: k.file ?? '(every file)', line: 0, message: `the keep entry for ${k.class} matches nothing; remove it` })
    }
  })
  if (mode === 'check') {
    for (const e of edits) problems.push({ file: e.file, line: e.line, message: `left to rewrite: ${e.from} -> ${e.to} (${e.by})` })
  }
  return { searched: files.length, edits, kept, problems, contents }
}

// ── Running it ─────────────────────────────────────────────────────────────

function printPlan(plan: Plan, map: ColourMap, mode: 'dry-run' | 'check' | 'write'): void {
  const head = mode === 'check' ? 'Check (nothing written)' : mode === 'dry-run' ? 'Plan (dry run, nothing written)' : 'Plan'
  console.log(`${head}: ${plan.edits.length} rewrites in ${plan.contents.size} files, ${plan.kept.length} kept, ${plan.searched} files searched.`)
  if (plan.edits.length > 0) {
    console.log('\nBy rule:')
    for (const by of [...map.rules.map((r) => r.id), 'site']) {
      const n = plan.edits.filter((e) => e.by === by).length
      if (n > 0) console.log(`  ${by}: ${n}`)
    }
    console.log('\nRewrites:')
    let last = ''
    for (const e of plan.edits) {
      if (e.file !== last) console.log(`  ${e.file}`)
      last = e.file
      console.log(`    ${e.line}${e.kind === 'comment' ? ' (in a comment)' : ''}: ${e.from} -> ${e.to} (${e.by})`)
    }
  }
  if (plan.kept.length > 0) {
    console.log('\nKept:')
    for (const k of plan.kept) console.log(`  ${k.file}:${k.line} ${k.token}${k.kind === 'comment' ? ' (in a comment)' : ''}: ${k.reason}`)
  }
  console.log(`\nProblems: ${plan.problems.length}`)
  for (const p of plan.problems) console.log(`  ${p.file}${p.line ? `:${p.line}` : ''} ${p.message}`)
}

function main(): number {
  const argv = process.argv.slice(2)
  const valueFlags = ['--map', '--root']
  const known = new Set(['--dry-run', '--check', ...valueFlags])
  const stray = argv.filter((a, i) => !known.has(a) && !valueFlags.includes(argv[i - 1]))
  const valueOf = (flag: string) => {
    const at = argv.indexOf(flag)
    return at < 0 ? undefined : argv[at + 1]
  }
  const dryRun = argv.includes('--dry-run')
  const check = argv.includes('--check')
  const missingValue = valueFlags.some((f) => argv.includes(f) && (!valueOf(f) || valueOf(f)!.startsWith('--')))
  if (stray.length > 0 || (dryRun && check) || missingValue) {
    console.error(USAGE)
    return 1
  }
  const root = resolve(valueOf('--root') ?? REPO_ROOT)
  const mapPath = resolve(valueOf('--map') ?? DEFAULT_MAP)
  let map: ColourMap
  try {
    map = loadMap(mapPath)
  } catch (e) {
    console.error(`Stopped: the map cannot be used.\n${(e as Error).message}`)
    return 1
  }
  const mode = check ? 'check' : dryRun ? 'dry-run' : 'write'
  const plan = planRewrite(root, map, check ? 'check' : 'write')
  printPlan(plan, map, mode)
  if (plan.problems.length > 0) {
    console.error(`\nStopped: ${plan.problems.length} problem(s). Nothing was written.`)
    return 1
  }
  if (mode !== 'write') return 0
  for (const [file, text] of plan.contents) writeFileSync(join(root, file), text)
  console.log(`\nRewrote ${plan.edits.length} classes in ${plan.contents.size} files. Check with --check.`)
  return 0
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) process.exit(main())
