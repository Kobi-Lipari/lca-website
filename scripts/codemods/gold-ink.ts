// scripts/codemods/gold-ink.ts
//
// Moves gold text off light grounds (WS01 step 25). Brand gold #c8a94a reads
// 2.28:1 on white, so the brief allows it as text only on navy, where it
// reads 6.51:1. This script finds every text-lca-gold class in the site's TSX
// files, works out the ground each one is drawn on, and rewrites the ones on
// a light ground to text-gold-ink. With newLook off --gold-ink is #c8a94a, the
// very colour text-lca-gold paints, so nothing changes until the new look,
// where it is the dark gold #866a1e on the light grounds (#705718 in
// heritage) and brand gold again in dark mode and the live look. A class on
// a navy or dark ground stays text-lca-gold, which is right there in every
// look: the navy stays #1a2744 in dark mode too.
//
// Usage:
//   node --no-warnings --experimental-strip-types scripts/codemods/gold-ink.ts [--dry-run | --check] [--root <dir>] [--table <file>]
//
// The ground. Each class string is read with the TypeScript parser (the
// parser of scripts/codemods/semantic-colours.ts), and the element that holds
// it is the one whose className the string sits in, directly or through a
// constant of the same file. From that element up through its ancestors the
// first thing that paints a ground decides:
// - navy: an opaque bg-brand-navy or bg-lca-navy, an inline navy background
//   (LCA.navy, a NAVY constant or #1a2744), a hex ground on which brand gold
//   reads 4.5:1, or being passed to PageHero, Navbar or Footer, whose own
//   ground is navy;
// - light: any other opaque colour (bg-card, bg-muted, bg-white, a tint
//   token, a hex ground on which the light look's dark gold #866a1e reads
//   4.5:1), a shadcn Card, a Button or Badge whose variant paints a light
//   ground, or what a dialog draws in its portal, unless the Card's or the
//   dialog's className gives a ground of its own, which is read first;
// - a tint (an opacity modifier, or an inline tint: a club colour's tint, an
//   rgba below 1, a colour given two hex digits of alpha) lies over what is
//   under it, so the walk goes on, and a hover or focus ground is not the
//   resting ground.
// A hex ground on which neither gold reads 4.5:1 is one the script does not
// know: the urgent banner's red, where brand gold reads 3.58:1, the info
// banner's blue (3.84:1) and Facebook's blue (1.86:1) among them.
// data-ground="dark" marks a dark ground for the focus ring; it is not a
// colour. On an element with a navy of its own (the club heroes, whose navy
// is an inline style) the navy decides. On one without (the home page hero's
// darkened photo, where brand gold reads 4.29:1 at the photo's lightest and
// 3.14:1 on its pill's gold tint) the script cannot tell what brand gold
// reads, so the use is unplaced.
// A ground in a className applies with the gold only when every condition it
// sits under (a ?: branch, an && guard) also holds for the gold; one in the
// opposite branch never meets it.
//
// A component of the site among the ancestors (one a TSX file under src
// declares) is read inside, for the ground it paints where what it is given
// lands: around the {children}, or the prop the gold is passed in
// (meta={...}), and for a gold class given as its className, at the element
// that takes the className. The caller's own classes land on each element of
// the component that takes its className or spreads its props, so a card the
// caller gives there is the ground. Where the component paints no ground the
// walk goes on up from the caller; where the script cannot see where the
// prop lands (the component returns its children bare, say), the element is
// read as any other.
//
// When the walk reaches the top of the element's own component without a
// ground, it follows the component to every place it is drawn, in its own
// file or in a file that imports it under any name (named or renamed, a
// default, a namespace, lazy()), a component made with forwardRef() or memo()
// included: navy everywhere is navy, and a component drawn nowhere sits on
// the page, which is light. A component of the same name from another module
// or a package is not it.
//
// Anything this cannot settle (a ground that may or may not apply, a ground
// it does not know, a ground marked dark with no navy of its own, a component
// drawn on both kinds of ground or drawing what it is given on both, a
// string no className reads) is "unplaced": a person decides, and for
// text-lca-gold the decision is an entry of
// test/unit/fixtures/goldAllowlist.ts, with its file, class, count and
// reason, which test/unit/goldText.test.ts reads as well. A use the reader
// can place needs no entry, and an entry for one is refused. text-gold-ink
// takes no entry: it is the light look's dark gold, so one the reader cannot
// place on a light ground is a problem until it can.
//
// Commented-out code is rewritten too, as scripts/codemods/semantic-colours.ts
// does, so bringing it back brings the current class. Its ground is read from
// the real elements around the comment; a navy ground named in the commented
// code before the class makes it unplaced.
//
// The review table lists every use with its ground, what decided it, what the
// run does and the element it sits on; it is printed, and written to the file
// --table names (the scratchpad, never the repository). --dry-run prints the
// table and writes nothing. --check writes nothing and fails when a
// text-lca-gold is left on a light ground, when text-gold-ink sits on a navy
// ground (2.89:1 in the light look) or on one the script cannot place, when
// a text-lca-gold is unplaced and no allowlist entry takes it, or when an
// entry's count is wrong; test/unit/goldText.test.ts runs the same check on
// the tree. A class joined to a ${} or in a string with an escape cannot be
// rewritten safely, and stops a real run before any file is written. The
// gold hex text classes (text-[#7a5c00] and the rest) need no ground, since
// one token serves them wherever they sit; they move by
// scripts/codemods/semantic-colours.ts with semantic-colours.gold.map.json.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { GOLD_ALLOWLIST, type GoldAllowEntry } from '../../test/unit/fixtures/goldAllowlist.ts'
import { REPO_ROOT, classStrings, parseToken, tokensOf, tsxFiles, withUtility, type ClassToken } from './semantic-colours.ts'

const HERE = dirname(fileURLToPath(import.meta.url))

/** The map that moves the gold hex text classes with scripts/codemods/semantic-colours.ts. */
export const GOLD_MAP = join(HERE, 'semantic-colours.gold.map.json')

const USAGE = 'Usage: node --no-warnings --experimental-strip-types scripts/codemods/gold-ink.ts [--dry-run | --check] [--root <dir>] [--table <file>]'

/** Brand gold as a text class, and the token class that takes its place on a light ground. */
export const GOLD = 'text-lca-gold'
export const GOLD_INK = 'text-gold-ink'

/** The navy fills, which stay #1a2744 in every look. */
const NAVY_FILLS = new Set(['bg-brand-navy', 'bg-lca-navy', 'bg-black'])
/** Components whose own ground is navy, so everything passed to them is drawn on it. */
export const NAVY_COMPONENTS = new Set(['PageHero', 'Navbar', 'Footer'])
/** Components that paint a light ground of their own: a card, and what a dialog or menu draws in its portal. */
const LIGHT_COMPONENTS = /^(Card|DialogContent|SelectContent|PopoverContent|DropdownMenuContent|SheetContent|AlertDialogContent)$/
/** Components whose variant paints their ground when their className gives none. */
const VARIANT_COMPONENTS = new Set(['Button', 'Badge'])
/** Variants that paint a light ground; ghost and link paint none. Any other (the default and destructive fills) is not settled here. */
const LIGHT_VARIANTS = new Set(['outline', 'secondary'])
const CLEAR_VARIANTS = new Set(['ghost', 'link'])

/**
 * The grounds the site paints that are light in today's look: the shadcn and
 * semantic grounds, the brand gold and cream, the light islands' veil and
 * the scanner's marks. A ground outside this and the navy ones is one this
 * script does not know, and a person decides. (A pattern rather than a list
 * of class names, so Tailwind, which reads this file, builds no CSS for a
 * name only this file spells.)
 */
const LIGHT_GROUNDS = /^bg-(?:card|background|surface|surface-2|muted|popover|white|secondary|accent|ground|raised|sidebar|lca-gold|lca-cream|gold|veil-on-light|mark-warn|mark-ok)$/
/** The tone tints (step 24) and Tailwind's light palette shades, light in today's look. */
const LIGHT_TINT = /^bg-(?:(?:ok|ok-green|bad|warn|warn-yellow|info|info-purple|quiet)-(?:50|100|200|300)|[a-z]+-(?:50|100|200|300))$/
/** Background utilities that paint no colour. */
const NOT_A_COLOUR = /^bg-(?:transparent|none|auto|cover|contain|center|top|bottom|left|right|left-top|left-bottom|right-top|right-bottom|no-repeat|repeat|repeat-x|repeat-y|repeat-round|repeat-space|fixed|local|scroll|clip-.+|origin-.+|blend-.+|size-.+|position-.+|\[length:.+\]|\[position:.+\]|\[size:.+\])$/
/** A picture or a gradient: what it paints cannot be read from the class. */
const PICTURE = /^bg-(?:gradient-.+|linear-.+|radial(?:-.+)?|conic(?:-.+)?|\[(?:url|image|linear-gradient|radial-gradient).+\])$/
/** A variant of a state, not the resting look: a hover or focus ground is not the ground. */
const STATE_VARIANT = /^(?:(?:group|peer)-)?(?:hover|focus|focus-visible|focus-within|active|disabled|visited|checked|open|aria-[\w-]+|data-\[[^\]]+\]|aria-\[[^\]]+\])$/

/** The variants of a class, split at the colons outside brackets: 'md:hover:' is ['md', 'hover']. */
function variantsOf(token: ClassToken): string[] {
  const out: string[] = []
  let depth = 0
  let part = ''
  for (const c of token.variants) {
    if (c === '[' || c === '(') depth++
    else if (c === ']' || c === ')') depth--
    if (c === ':' && depth === 0) {
      out.push(part)
      part = ''
    } else part += c
  }
  return out
}

/** A class that applies only in a state (hover, focus and the like), never at rest. */
const inState = (token: ClassToken) => variantsOf(token).some((v) => STATE_VARIANT.test(v))

/** An inline navy ground: backgroundColor set to LCA.navy, a NAVY constant or the literal. */
const NAVY_VALUE = /^(?:LCA\.navy|NAVY|LCA_NAVY|['"`]#1a2744['"`])$/i
/**
 * An inline tint: a club colour's tint helper, an rgba with an alpha below 1,
 * or a colour given two hex digits of alpha below ff (`${color}15`, the
 * admin's colour preview), which is a colour of eight hex digits at most.
 */
const TINT_VALUE = /^(?:clubColorTint\(.+\)|['"`]rgba\([^)]*,\s*0?\.\d+\)['"`]|`\$\{[^{}`]+\}(?![fF]{2})[0-9a-fA-F]{2}`)$/

export type Ground = 'navy' | 'light' | 'unplaced'

/** A ground and what decided it, in words for the review table. */
export interface Verdict {
  ground: Ground
  why: string
}

/** One piece of a className: a string, and the conditions it applies under. */
interface Piece {
  text: string
  /** Where the string's text starts in the file, as scripts/codemods/semantic-colours.ts counts it. */
  pos: number
  /** The condition of every ?: branch and && guard the piece sits under, as written; "!(...)" for an else branch. */
  when: string[]
}

/** A JSX element, with what this script needs to place a ground. */
export interface Element {
  file: string
  line: number
  tag: string
  pieces: Piece[]
  /** The className attribute's value, as [start, end) in the file, or null. */
  classRange: [number, number] | null
  /** Other props whose name ends in ClassName: they style a part the component draws. */
  partRanges: Array<[number, number]>
  /** The inline background: navy, a tint, another colour this script cannot place, or none. */
  inline: 'navy' | 'tint' | 'other' | null
  /** The data-ground value, or null. */
  dataGround: string | null
  /** The variant prop's string value, or null. */
  variant: string | null
  /** The component function the element is drawn in, or null. */
  component: string | null
  parent: Element | null
  /** How it sits in its parent: "children" for a child, or the name of the parent's prop it is passed in. */
  via: string
  /** The names it draws among its own children ({children}, {meta}, {props.title}): where what a caller passes lands. */
  slots: Set<string>
  /** Its className reads the className its component is given, so a caller's classes land on it. */
  takesClassName: boolean
  /** It spreads props onto itself ({...props}), so whatever a caller passes may land on it. */
  spreads: boolean
  /** The opening tag as written, on one line, for the review table. */
  opening: string
  /** The element's own words: its JSX text children, joined. */
  text: string
  start: number
  end: number
}

/** A name a file imports: the name its module exports it under ("default", or "*" for the whole module), and the module as written. */
export interface Binding {
  imported: string
  from: string
}

/** One parsed TSX file. */
export interface ParsedFile {
  file: string
  source: string
  sf: ts.SourceFile
  elements: Element[]
  /** The names it imports, each with its binding: a default, named (renamed or not) or namespace import, or a lazy() import. */
  imports: Map<string, Binding>
  /** The names it exports, each with the name it has in the file ("default" for its default export). */
  exports: Map<string, string>
  /** Names of the components it declares. */
  components: Set<string>
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Constants declared exactly once in a file, by name. */
function constantsOf(sf: ts.SourceFile): Map<string, ts.Expression> {
  const seen = new Map<string, number>()
  const found = new Map<string, ts.Expression>()
  const visit = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      seen.set(n.name.text, (seen.get(n.name.text) ?? 0) + 1)
      found.set(n.name.text, n.initializer)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return new Map([...found].filter(([name]) => seen.get(name) === 1))
}

/** The pieces a className expression is built from, each with the conditions it applies under. */
function piecesOf(node: ts.Node, sf: ts.SourceFile, consts: Map<string, ts.Expression>, when: string[], depth: number): Piece[] {
  if (depth > 10) return []
  const again = (n: ts.Node, w = when) => piecesOf(n, sf, consts, w, depth + 1)
  const text = (n: ts.Node) => oneLine(n.getText(sf))
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [{ text: node.text, pos: node.getStart(sf) + 1, when }]
  if (ts.isTemplateExpression(node)) {
    const out: Piece[] = [{ text: node.head.text, pos: node.head.getStart(sf) + 1, when }]
    for (const span of node.templateSpans) out.push(...again(span.expression), { text: span.literal.text, pos: span.literal.getStart(sf) + 1, when })
    return out
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) return again(node.expression)
  if (ts.isConditionalExpression(node)) {
    const cond = text(node.condition)
    return [...again(node.whenTrue, [...when, cond]), ...again(node.whenFalse, [...when, `!(${cond})`])]
  }
  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return again(node.right, [...when, text(node.left)])
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      return [...again(node.left), ...again(node.right, [...when, `!(${text(node.left)})`])]
    }
    if (op === ts.SyntaxKind.PlusToken) return [...again(node.left), ...again(node.right)]
    return []
  }
  if (ts.isCallExpression(node)) return node.arguments.flatMap((a) => again(a))
  if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap((e) => again(e))
  if (ts.isObjectLiteralExpression(node)) {
    // clsx's object form: each key is a class string, present when its value is true.
    return node.properties.flatMap((p) =>
      ts.isPropertyAssignment(p) && (ts.isStringLiteral(p.name) || ts.isNoSubstitutionTemplateLiteral(p.name))
        ? [{ text: p.name.text, pos: p.name.getStart(sf) + 1, when: [...when, text(p.initializer)] }]
        : [])
  }
  if (ts.isIdentifier(node)) {
    const init = consts.get(node.text)
    if (init && !ts.isObjectLiteralExpression(init) && !ts.isArrowFunction(init) && !ts.isFunctionExpression(init)) return again(init)
    return []
  }
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const target = node.expression
    const obj = ts.isIdentifier(target) ? consts.get(target.text) : undefined
    const record = obj && (ts.isAsExpression(obj) || ts.isSatisfiesExpression(obj)) ? obj.expression : obj
    if (!record || !ts.isObjectLiteralExpression(record)) return []
    const props = record.properties.filter(ts.isPropertyAssignment)
    if (ts.isPropertyAccessExpression(node)) {
      const p = props.find((x) => x.name.getText(sf).replace(/['"]/g, '') === node.name.text)
      return p ? again(p.initializer) : []
    }
    // A lookup by a value known only at run time: any one of the entries.
    return props.flatMap((p) => again(p.initializer, [...when, `${text(node.argumentExpression)} is ${p.name.getText(sf)}`]))
  }
  return []
}

/** The calls that wrap a component and keep it what it is: forwardRef() and memo(). */
const WRAPPERS = /^(?:React\.)?(?:forwardRef|memo)$/

/** The capitalised const a function is the component of: assigned to it directly, or through forwardRef() or memo(). */
function declaredName(fn: ts.ArrowFunction | ts.FunctionExpression): string | null {
  let n: ts.Node = fn
  while (n.parent && ts.isCallExpression(n.parent) && n.parent.arguments.some((a) => a === n) && WRAPPERS.test(n.parent.expression.getText())) n = n.parent
  const decl = n.parent
  return decl && ts.isVariableDeclaration(decl) && decl.initializer === n && ts.isIdentifier(decl.name) && /^[A-Z]/.test(decl.name.text) ? decl.name.text : null
}

/** The name of the component function a node is drawn in: the nearest capitalised function, or the const that holds one. */
function componentOf(node: ts.Node): string | null {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isFunctionDeclaration(n) && n.name && /^[A-Z]/.test(n.name.text)) return n.name.text
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      const name = declaredName(n)
      if (name) return name
    }
  }
  return null
}

const isClassProp = (name: string) => name === 'className' || /ClassName$/.test(name)

function attributeValue(a: ts.JsxAttribute): ts.Expression | undefined {
  const init = a.initializer
  if (!init) return undefined
  if (ts.isStringLiteral(init)) return init
  if (ts.isJsxExpression(init)) return init.expression
  return undefined
}

/** Whether an expression reads a name: the identifier itself, or a property of that name (props.className). */
function readsName(e: ts.Node, name: string): boolean {
  if (ts.isIdentifier(e)) return e.text === name
  return ts.forEachChild(e, (c) => readsName(c, name) || undefined) ?? false
}

/** The names an element draws among its children: each {x} and {props.x}, inside a fragment too, but not inside another element. */
function drawnNames(children: ts.NodeArray<ts.JsxChild>): Set<string> {
  const out = new Set<string>()
  const visit = (n: ts.Node) => {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return
    if (ts.isIdentifier(n) && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)) out.add(n.text)
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'props') out.add(n.name.text)
    ts.forEachChild(n, visit)
  }
  for (const c of children) {
    if (ts.isJsxExpression(c) && c.expression) visit(c.expression)
    else if (ts.isJsxFragment(c)) for (const name of drawnNames(c.children)) out.add(name)
  }
  return out
}

/** The module and the name a lazy() import loads: lazy(() => import('x')), or lazy(() => import('x').then((m) => ({ default: m.Name }))). */
function lazyImportOf(e: ts.Expression): Binding | null {
  if (!ts.isCallExpression(e) || !/^(?:React\.)?lazy$/.test(e.expression.getText())) return null
  const result = (fn: ts.Node | undefined): ts.Node | null => {
    if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) return null
    let body: ts.Node | undefined = fn.body
    if (ts.isBlock(body)) body = body.statements.find(ts.isReturnStatement)?.expression
    while (body && ts.isParenthesizedExpression(body)) body = body.expression
    return body ?? null
  }
  const moduleOf = (n: ts.Node | null) =>
    n && ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteralLike(n.arguments[0]) ? n.arguments[0].text : null
  const body = result(e.arguments[0])
  const direct = moduleOf(body)
  if (direct) return { imported: 'default', from: direct }
  if (body && ts.isCallExpression(body) && ts.isPropertyAccessExpression(body.expression) && body.expression.name.text === 'then') {
    const from = moduleOf(body.expression.expression)
    const out = result(body.arguments[0])
    if (from && out && ts.isObjectLiteralExpression(out)) {
      const d = out.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText() === 'default')
      if (d && ts.isPropertyAccessExpression(d.initializer)) return { imported: d.initializer.name.text, from }
    }
  }
  return null
}

/** What an inline style paints behind the element: the backgroundColor or background property. */
function inlineGround(style: ts.Expression, sf: ts.SourceFile, consts: Map<string, ts.Expression>): Element['inline'] {
  const obj = ts.isIdentifier(style) ? consts.get(style.text) : style
  if (!obj || !ts.isObjectLiteralExpression(obj)) return null
  for (const p of obj.properties) {
    if (!ts.isPropertyAssignment(p)) continue
    const name = p.name.getText(sf).replace(/['"]/g, '')
    if (name === 'backgroundImage') return 'other'
    if (name !== 'backgroundColor' && name !== 'background') continue
    let value = p.initializer
    if (ts.isIdentifier(value) && consts.has(value.text) && !NAVY_VALUE.test(value.text)) value = consts.get(value.text)!
    const v = oneLine(value.getText(sf))
    if (NAVY_VALUE.test(v)) return 'navy'
    if (TINT_VALUE.test(v)) return 'tint'
    return 'other'
  }
  return null
}

const hasModifier = (n: ts.Node, kind: ts.SyntaxKind) => ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === kind)

/** Reads one TSX file: its elements as a tree, its imports, its exports and its components. */
export function parseFile(file: string, source: string): ParsedFile {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const consts = constantsOf(sf)
  const elements: Element[] = []
  const imports = new Map<string, Binding>()
  const exports = new Map<string, string>()
  const components = new Set<string>()
  const lineOf = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1
  const visit = (n: ts.Node, parent: Element | null, via: string) => {
    if (ts.isImportDeclaration(n) && n.importClause && ts.isStringLiteral(n.moduleSpecifier)) {
      const from = n.moduleSpecifier.text
      if (n.importClause.name) imports.set(n.importClause.name.text, { imported: 'default', from })
      const named = n.importClause.namedBindings
      if (named && ts.isNamedImports(named)) for (const el of named.elements) imports.set(el.name.text, { imported: (el.propertyName ?? el.name).text, from })
      if (named && ts.isNamespaceImport(named)) imports.set(named.name.text, { imported: '*', from })
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const lazy = lazyImportOf(n.initializer)
      if (lazy) imports.set(n.name.text, lazy)
    }
    // What the file exports, and under which names.
    const exported = hasModifier(n, ts.SyntaxKind.ExportKeyword)
    if (ts.isFunctionDeclaration(n) && n.name && exported) exports.set(hasModifier(n, ts.SyntaxKind.DefaultKeyword) ? 'default' : n.name.text, n.name.text)
    if (ts.isVariableStatement(n) && exported) for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name)) exports.set(d.name.text, d.name.text)
    if (ts.isExportAssignment(n) && !n.isExportEquals && ts.isIdentifier(n.expression)) exports.set('default', n.expression.text)
    if (ts.isExportDeclaration(n) && !n.moduleSpecifier && n.exportClause && ts.isNamedExports(n.exportClause)) {
      for (const el of n.exportClause.elements) exports.set(el.name.text, (el.propertyName ?? el.name).text)
    }
    if (ts.isFunctionDeclaration(n) && n.name && /^[A-Z]/.test(n.name.text)) components.add(n.name.text)
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      const name = declaredName(n)
      if (name) components.add(name)
    }
    // An element passed in a prop sits in the element that takes the prop, under that prop's name.
    if (ts.isJsxAttribute(n)) {
      const name = n.name.getText(sf)
      ts.forEachChild(n, (c) => visit(c, parent, name))
      return
    }
    const opening = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null
    let next = parent
    if (opening) {
      const el: Element = {
        file,
        line: lineOf(n.getStart(sf)),
        tag: opening.tagName.getText(sf),
        pieces: [],
        classRange: null,
        partRanges: [],
        inline: null,
        dataGround: null,
        variant: null,
        component: componentOf(n),
        parent,
        via,
        slots: ts.isJsxElement(n) ? drawnNames(n.children) : new Set(),
        takesClassName: false,
        spreads: false,
        opening: oneLine(opening.getText(sf)).slice(0, 160),
        text: ts.isJsxElement(n) ? oneLine(n.children.filter(ts.isJsxText).map((c) => c.text).join(' ')) : '',
        start: n.getStart(sf),
        end: n.end,
      }
      for (const a of opening.attributes.properties) {
        if (ts.isJsxSpreadAttribute(a)) {
          el.spreads = true
          continue
        }
        const name = a.name.getText(sf)
        const value = attributeValue(a)
        if (!value) continue
        if (name === 'className') {
          el.pieces = piecesOf(value, sf, consts, [], 0)
          el.classRange = [value.getStart(sf), value.end]
          el.takesClassName = readsName(value, 'className')
        } else if (isClassProp(name)) {
          el.partRanges.push([value.getStart(sf), value.end])
        }
        if (name === 'style') el.inline = inlineGround(value, sf, consts)
        if (name === 'data-ground') el.dataGround = ts.isStringLiteral(value) ? value.text : oneLine(value.getText(sf))
        if (name === 'variant' && ts.isStringLiteral(value)) el.variant = value.text
      }
      elements.push(el)
      next = el
    }
    ts.forEachChild(n, (c) => visit(c, next, opening ? 'children' : via))
  }
  visit(sf, null, 'children')
  return { file, source, sf, elements, imports, exports, components }
}

/** Two condition lists can never hold together: one holds X where the other holds !(X). */
function conflicts(a: string[], b: string[]): boolean {
  return a.some((x) => b.includes(`!(${x})`) || (x.startsWith('!(') && b.includes(x.slice(2, -1))))
}

/** Relative luminance of a hex colour, 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const h = hex.length <= 4 ? hex.slice(1).replace(/./g, (c) => c + c).slice(0, 6) : hex.slice(1, 7)
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((s) => (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** The WCAG contrast ratio of two hex colours. */
function contrastOf(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Brand gold, and the dark gold text-gold-ink is in the light look: the two a hex ground is measured with. */
const BRAND_GOLD_HEX = '#c8a94a'
const DARK_GOLD_HEX = '#866a1e'

/**
 * What a hex ground is, which stays put in every look: navy when brand gold
 * reads 4.5:1 on it, as words need (6.51:1 on the navy itself; it takes a
 * relative luminance of about 0.0526 or less), light when the light look's
 * dark gold #866a1e does (5.13:1 on white; about 0.871 or more), and unknown
 * between, where neither gold reads as words.
 */
export function hexGround(hex: string): 'navy' | 'light' | 'unknown' {
  if (contrastOf(BRAND_GOLD_HEX, hex) >= 4.5) return 'navy'
  if (contrastOf(DARK_GOLD_HEX, hex) >= 4.5) return 'light'
  return 'unknown'
}

/** The hex colour of a ground class at rest (bg-[#9b1c1c]), in lower case, or null. */
function hexOf(token: ClassToken): string | null {
  if (token.variants !== '' || token.modifier !== '') return null
  const m = token.utility.match(/^bg-\[#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\]$/)
  return m ? `#${m[1].toLowerCase()}` : null
}

/** What a class paints as a ground: navy, light, unknown, or nothing that decides (a tint, a state, not a colour). */
export function groundKind(token: ClassToken): 'navy' | 'light' | 'unknown' | null {
  const u = token.utility
  if (!u.startsWith('bg-') || NOT_A_COLOUR.test(u)) return null
  // A hover or focus ground is not the resting ground.
  if (inState(token)) return null
  // A tint lies over what is under it.
  if (token.modifier !== '') return null
  // A ground that shows only at one width, in one mode or when printed is not settled here.
  if (token.variants !== '') return 'unknown'
  if (PICTURE.test(u)) return 'unknown'
  if (NAVY_FILLS.has(u)) return 'navy'
  const hex = hexOf(token)
  if (hex) return hexGround(hex)
  if (LIGHT_GROUNDS.test(u) || LIGHT_TINT.test(u)) return 'light'
  return 'unknown'
}

/** The whole tree: every file under <root>/src, parsed once. */
export interface Tree {
  root: string
  files: Map<string, ParsedFile>
}

export function readTree(root: string): Tree {
  const files = new Map<string, ParsedFile>()
  for (const file of tsxFiles(root)) files.set(file, parseFile(file, readFileSync(join(root, file), 'utf8')))
  return { root, files }
}

const at = (el: Element) => `<${el.tag}> (line ${el.line})`

// ── Components and where they are drawn ────────────────────────────────────

/** A module that is a package, not a file of the site. */
const PACKAGE = 'package'

/**
 * The TSX file under src a module names, imported from a file: the path as
 * written, with .tsx, or its index.tsx. PACKAGE for a package; null for a
 * module of the site that is not a TSX file under src (a .ts file).
 */
function moduleFile(tree: Tree, from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? `src/${spec.slice(2)}` : spec.startsWith('.') ? posix.join(posix.dirname(from), spec) : null
  if (base === null) return PACKAGE
  return [base, `${base}.tsx`, `${base}/index.tsx`].find((f) => tree.files.has(f)) ?? null
}

/**
 * The component a tag draws in a file: one the file declares, or one it
 * imports under any name (named, renamed, default, through a namespace or
 * lazy()), as the name it has in the file that declares it. `file` is null
 * for an import from a module of the site this script does not read, whose
 * exported name is all it knows. Null for an HTML tag or a package's
 * component.
 */
export function tagTarget(tree: Tree, where: string, tag: string): { file: string | null; name: string } | null {
  const parsed = tree.files.get(where)
  if (!parsed) return null
  const dot = tag.indexOf('.')
  const head = dot < 0 ? tag : tag.slice(0, dot)
  const member = dot < 0 ? null : tag.slice(dot + 1)
  const binding = parsed.imports.get(head)
  if (!binding) return member === null && parsed.components.has(tag) ? { file: where, name: tag } : null
  const exported = binding.imported === '*' ? member : member === null ? binding.imported : null
  if (!exported) return null
  const module = moduleFile(tree, where, binding.from)
  if (module === PACKAGE) return null
  if (module === null) return { file: null, name: exported }
  const target = tree.files.get(module)!
  const name = target.exports.get(exported) ?? (exported === 'default' ? null : exported)
  return name ? { file: module, name } : null
}

/** The name a tag's component has where it is declared, for the rules that go by name: the tag itself unless an import renames it. */
function nameOf(tree: Tree, n: Element): string {
  const target = tagTarget(tree, n.file, n.tag)
  if (target && target.name !== 'default') return target.name
  const binding = tree.files.get(n.file)?.imports.get(n.tag)
  return binding && binding.imported !== 'default' && binding.imported !== '*' ? binding.imported : n.tag
}

/** Where each component is drawn, worked out once for a tree. */
const DRAWN = new WeakMap<Tree, Map<string, Element[]>>()

/** Every element that draws a component: in its own file, and in any file that imports it, under any name. */
export function drawnAt(tree: Tree, file: string, component: string): Element[] {
  const cache = DRAWN.get(tree) ?? new Map<string, Element[]>()
  DRAWN.set(tree, cache)
  const key = `${file} ${component}`
  const known = cache.get(key)
  if (known) return known
  const out: Element[] = []
  for (const [path, parsed] of tree.files) {
    for (const el of parsed.elements) {
      const target = tagTarget(tree, path, el.tag)
      if (!target || target.name !== component) continue
      // An import from a module this script does not read counts by its name.
      if (target.file === file || target.file === null) out.push(el)
    }
  }
  cache.set(key, out)
  return out
}

// ── The ground ─────────────────────────────────────────────────────────────

/** How deep the walk follows components into one another, and to the places they are drawn. */
const MAX_DEPTH = 12

/**
 * How the walk meets an element: the one that holds the class (its own
 * className is under its words), a place where a component is drawn (whose
 * inside the walk has read already), or an ancestor of what it holds.
 */
type Role = 'holder' | 'place' | 'ancestor'

/** A component's caller: the element that draws it, whose classes land on the component's elements that take them. */
interface Caller {
  el: Element
  when: string[]
}

/**
 * The ground an element paints itself, for a class whose piece applies under
 * `when`: an inline ground, its className's, and what data-ground="dark"
 * leaves open.
 */
function paintedBy(n: Element, when: string[]): Verdict | null {
  // An inline navy decides, a data-ground="dark" beside it included (the club heroes).
  if (n.inline === 'navy') return { ground: 'navy', why: `an inline navy ground on ${at(n)}` }
  if (n.inline === 'other') return { ground: 'unplaced', why: `an inline ground on ${at(n)} that this script cannot read` }
  const own = classGround(n, when)
  // data-ground="dark" marks a dark ground for the focus ring, not a colour:
  // with no navy of its own under it (a darkened photo), what brand gold
  // reads there is not known.
  if (n.dataGround === 'dark' && own?.ground !== 'navy') {
    return { ground: 'unplaced', why: `data-ground="dark" on ${at(n)} with no navy of its own (a darkened photo, say), where brand gold may read below 4.5:1` }
  }
  return own
}

/** The ground an element's className paints, for a class whose piece applies under `when`, or null when it paints none. */
function classGround(n: Element, when: string[]): Verdict | null {
  const grounds = n.pieces
    .filter((p) => !conflicts(p.when, when))
    .flatMap((p) => tokensOf(p.text).map(({ token }) => ({ token, kind: groundKind(token), sure: p.when.every((c) => when.includes(c)) })))
    .filter((g) => g.kind !== null)
  if (grounds.length === 0) return null
  const names = grounds.map((g) => g.token.text).join(' ')
  const unknown = grounds.filter((g) => g.kind === 'unknown').map((g) => hexOf(g.token))
  if (unknown.length > 0) {
    // A hex ground the script cannot place is one on which neither gold reads as words.
    const hexes = unknown.filter((h): h is string => h !== null)
    const what = hexes.length === unknown.length
      ? `a hex ground on which neither gold reads 4.5:1 (${hexes.map((h) => `brand gold ${contrastOf(BRAND_GOLD_HEX, h).toFixed(2)}:1 and the dark gold ${contrastOf(DARK_GOLD_HEX, h).toFixed(2)}:1 on ${h}`).join('; ')})`
      : 'a ground this script does not know'
    return { ground: 'unplaced', why: `${names} on ${at(n)}, ${what}` }
  }
  if (grounds.some((g) => !g.sure)) return { ground: 'unplaced', why: `${names} on ${at(n)}, which may or may not apply with the gold` }
  const kinds = new Set(grounds.map((g) => g.kind))
  if (kinds.size > 1) return { ground: 'unplaced', why: `${names} on ${at(n)}: two grounds at once` }
  return { ground: kinds.has('navy') ? 'navy' : 'light', why: `${names} on ${at(n)}` }
}

/**
 * The first ground from an element up through its ancestors in its file, or
 * null when none paints one before the top. A component of the tree among
 * them is read inside, for the ground it paints where what it is given
 * lands. Inside a component, what its caller passes lands on each element
 * that takes the className or spreads the props it is given.
 */
function walkUp(tree: Tree, start: Element, startRole: Role, when: string[], caller: Caller | null, depth: number, seen: Set<string>): Verdict | null {
  let child: Element | null = null
  for (let n: Element | null = start; n; child = n, n = n.parent) {
    const role: Role = n === start ? startRole : 'ancestor'
    if (caller && (n.takesClassName || n.spreads)) {
      const given = paintedBy(caller.el, caller.when)
      if (given) return { ground: given.ground, why: `${given.why}, which ${at(n)} in ${n.file} takes` }
    }
    const name = nameOf(tree, n)
    if (role === 'ancestor' && NAVY_COMPONENTS.has(name)) return { ground: 'navy', why: `inside ${at(n)}, whose ground is navy` }
    if (role !== 'place') {
      const inside = groundInside(tree, n, name, role === 'holder' ? 'className' : child?.via ?? 'children', when, depth, seen)
      // The component draws what it is given with no ground of its own around it, the caller's classes included.
      if (inside === 'none') continue
      if (inside) return inside
    }
    const own = paintedBy(n, when)
    if (own) return own
    if (role === 'place') continue
    if (LIGHT_COMPONENTS.test(name)) return { ground: 'light', why: `inside ${at(n)}, which paints a light ground` }
    // A Button or Badge paints its variant's ground unless its className gives
    // one, a tint included (cn() merges the className over the variant).
    const paintsBg = n.pieces.some((p) => tokensOf(p.text).some(({ token }) => token.utility.startsWith('bg-') && !NOT_A_COLOUR.test(token.utility) && !inState(token)))
    if (VARIANT_COMPONENTS.has(name) && !paintsBg) {
      const variant = n.variant ?? 'default'
      if (LIGHT_VARIANTS.has(variant)) return { ground: 'light', why: `the ${variant} ${n.tag} ${at(n)}` }
      if (!CLEAR_VARIANTS.has(variant)) return { ground: 'unplaced', why: `the ${variant} ${n.tag} ${at(n)}, whose fill follows the look` }
    }
  }
  return null
}

/**
 * The ground a component of the tree paints where what an element gives it
 * lands: its className ("className"), or a prop it draws among its children
 * ("children" for the element's children). Null when the element is not such
 * a component or the script cannot see where the prop lands (the component
 * returns it bare, say); "none" when it sees, and the component paints no
 * ground there.
 */
function groundInside(tree: Tree, n: Element, name: string, prop: string, when: string[], depth: number, seen: Set<string>): Verdict | 'none' | null {
  if (NAVY_COMPONENTS.has(name) || LIGHT_COMPONENTS.test(name) || VARIANT_COMPONENTS.has(name)) return null
  const target = tagTarget(tree, n.file, n.tag)
  if (!target || target.file === null || !tree.files.get(target.file)!.components.has(target.name)) return null
  const key = `inside ${target.file} ${target.name} ${prop}`
  if (seen.has(key) || depth > MAX_DEPTH) return { ground: 'unplaced', why: `${target.name} draws itself, or lies deeper in other components than this script follows` }
  const inside = tree.files.get(target.file)!.elements.filter((e) => e.component === target.name)
  const takers = inside.filter((e) => (prop === 'className' ? e.takesClassName : e.slots.has(prop)))
  let lands = takers.filter((e) => !takers.some((o) => o !== e && o.start >= e.start && o.end <= e.end))
  if (lands.length === 0) lands = inside.filter((e) => e.spreads)
  if (lands.length === 0) return null
  const next = new Set([...seen, key])
  const verdicts = lands.map((e) => walkUp(tree, e, prop === 'className' ? 'holder' : 'ancestor', [], { el: n, when }, depth + 1, next))
  if (verdicts.every((v) => v === null)) return 'none'
  const what = prop === 'className' ? 'its className' : prop === 'children' ? 'what it holds' : `its ${prop}`
  const kinds = new Set(verdicts.map((v) => v?.ground ?? 'none'))
  if (kinds.size === 1 && !kinds.has('unplaced')) return { ground: verdicts[0]!.ground, why: `${at(n)} draws ${what} in ${target.file}: ${verdicts[0]!.why}` }
  return { ground: 'unplaced', why: `${at(n)} draws ${what} on more than one kind of ground in ${target.file} (${verdicts.map((v) => v?.ground ?? 'no ground of its own').join(', ')})` }
}

/**
 * The ground under an element, for a class whose piece applies under `when`:
 * the first ground up the element's ancestors, read inside the components of
 * the tree among them, then the places its component is drawn.
 */
export function groundOf(tree: Tree, el: Element, when: string[] = [], depth = 0, seen = new Set<string>(), role: Role = 'holder'): Verdict {
  const found = walkUp(tree, el, role, when, null, depth, seen)
  if (found) return found
  // The top of the element's own tree: where its component is drawn.
  const top = (() => {
    let n = el
    while (n.parent) n = n.parent
    return n
  })()
  const component = top.component
  const file = tree.files.get(el.file)
  if (!component || !file) return { ground: 'light', why: 'the page' }
  const key = `${el.file} ${component}`
  if (seen.has(key) || depth > MAX_DEPTH) return { ground: 'unplaced', why: `${component} is drawn inside itself` }
  const places = drawnAt(tree, el.file, component)
  if (places.length === 0) return { ground: 'light', why: `the page (${component} is drawn by no other element)` }
  const verdicts = places.map((p) => ({ p, v: groundOf(tree, p, [], depth + 1, new Set([...seen, key]), 'place') }))
  const kinds = new Set(verdicts.map(({ v }) => v.ground))
  const where = verdicts.map(({ p, v }) => `${p.file === el.file ? '' : `${p.file} `}line ${p.line}: ${v.ground}`).join('; ')
  if (kinds.size === 1 && !kinds.has('unplaced')) return { ground: verdicts[0].v.ground, why: `${component}, drawn at ${where}` }
  return { ground: 'unplaced', why: `${component}, drawn on more than one kind of ground (${where})` }
}

// ── The uses ───────────────────────────────────────────────────────────────

/** One use of a gold text class, placed on its ground. */
export interface GoldUse {
  file: string
  line: number
  kind: 'code' | 'comment'
  /** The class as written: 'text-lca-gold', 'hover:text-lca-gold', 'text-gold-ink'. */
  token: string
  utility: string
  /** Where the class sits in the file. */
  start: number
  end: number
  ground: Ground
  why: string
  /** The element it sits on, or the comment's line, for the review table. */
  jsx: string
  /** Each element that reads the class, with the conditions it holds the class under (its ?: branches and && guards); none for a string no className reads or a comment. */
  holders: Array<{ el: Element; when: string[] }>
  /** Why the class cannot be rewritten in place, if it cannot. */
  stuck?: string
}

/** Ground markers that, named in commented-out code before a class, leave its ground unsettled. */
const NAVY_IN_TEXT = /(?<![\w-])(?:bg-brand-navy|bg-lca-navy)(?![\w/-])|data-ground|<(?:PageHero|Navbar|Footer)\b|backgroundColor/

/**
 * Every use of a class whose utility `matches` (text-lca-gold and
 * text-gold-ink unless told otherwise) in the TSX files under the tree's
 * root, each with its ground.
 */
export function goldUses(tree: Tree, matches: (utility: string) => boolean = (u) => u === GOLD || u === GOLD_INK): GoldUse[] {
  const out: GoldUse[] = []
  for (const [file, parsed] of tree.files) {
    const { source } = parsed
    // Each string's elements: the className it sits in directly, or that reads it through a constant.
    const byPos = new Map<number, Array<{ el: Element; piece: Piece }>>()
    for (const el of parsed.elements) for (const piece of el.pieces) byPos.set(piece.pos, [...(byPos.get(piece.pos) ?? []), { el, piece }])
    const lineOf = (pos: number) => source.slice(0, pos).split('\n').length
    for (const s of classStrings(file, source)) {
      const tokens = tokensOf(s.escaped ? s.value : s.text).filter(({ token }) => matches(token.utility))
      if (tokens.length === 0) continue
      for (const { token, offset } of tokens) {
        const start = s.start + offset
        const joined = (offset === 0 && s.joinedStart) || (offset + token.text.length === s.text.length && s.joinedEnd)
        const use: GoldUse = {
          file,
          line: lineOf(start),
          kind: s.kind,
          token: token.text,
          utility: token.utility,
          start,
          end: start + token.text.length,
          ground: 'unplaced',
          why: '',
          jsx: '',
          holders: [],
          stuck: joined ? 'it runs into a ${} substitution' : s.escaped ? 'its string has an escape in it' : undefined,
        }
        if (s.kind === 'comment') {
          const comment = commentAround(source, s.start)
          const holder = innermost(parsed.elements, s.start)
          use.jsx = oneLine(source.split('\n')[use.line - 1]).slice(0, 160)
          if (comment && NAVY_IN_TEXT.test(source.slice(comment[0], s.start))) {
            use.why = 'commented-out code that names a navy ground before the class'
          } else {
            // The commented-out code sits among the holder's children.
            const v = holder ? groundOf(tree, holder, [], 0, new Set(), 'ancestor') : { ground: 'light' as Ground, why: 'the page' }
            use.ground = v.ground
            use.why = `commented-out code, where the comment sits: ${v.why}`
          }
          out.push(use)
          continue
        }
        const holders = byPos.get(s.start) ?? []
        const parts = parsed.elements.filter((el) => el.partRanges.some(([a, b]) => s.start >= a && s.start < b))
        if (holders.length === 0 || parts.length > 0) {
          use.why = parts.length > 0 ? `a ${parts[0].tag} prop that styles a part the component draws` : 'a string no className reads in its file'
          use.jsx = oneLine(source.split('\n')[use.line - 1]).slice(0, 160)
          out.push(use)
          continue
        }
        const verdicts = holders.map(({ el, piece }) => ({ el, v: groundOf(tree, el, piece.when) }))
        const kinds = new Set(verdicts.map(({ v }) => v.ground))
        use.jsx = holders[0].el.opening
        use.holders = holders.map(({ el, piece }) => ({ el, when: piece.when }))
        if (kinds.size === 1) {
          use.ground = verdicts[0].v.ground
          use.why = verdicts.length === 1 ? verdicts[0].v.why : `read by ${verdicts.length} elements: ${verdicts[0].v.why}`
        } else {
          use.why = `read by elements on different grounds: ${verdicts.map(({ el, v }) => `${at(el)} ${v.ground}`).join(', ')}`
        }
        out.push(use)
      }
    }
  }
  return out.sort((a, b) => (a.file === b.file ? a.start - b.start : a.file < b.file ? -1 : 1))
}

/** The [start, end) of the comment around a position, or null. */
function commentAround(source: string, pos: number): [number, number] | null {
  for (const m of source.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g)) {
    const a = m.index ?? 0
    if (pos >= a && pos < a + m[0].length) return [a, a + m[0].length]
  }
  return null
}

/** The innermost element whose source holds a position. */
function innermost(elements: Element[], pos: number): Element | null {
  let best: Element | null = null
  for (const el of elements) if (pos >= el.start && pos < el.end && (!best || el.start >= best.start)) best = el
  return best
}

// ── The plan ───────────────────────────────────────────────────────────────

export interface Rewrite {
  use: GoldUse
  to: string
}

export interface Problem {
  file: string
  line: number
  message: string
}

export interface GoldPlan {
  searched: number
  uses: GoldUse[]
  rewrites: Rewrite[]
  /** Uses kept where they are: on a navy ground, or by an allowlist entry. */
  kept: Array<{ use: GoldUse; by: 'ground' | 'allowlist'; reason: string }>
  problems: Problem[]
  /** The new text of each file that changes. */
  contents: Map<string, string>
}

/**
 * Works out every rewrite and every problem, without writing. With mode
 * "check", a rewrite still to make is a problem too.
 */
export function planGold(root: string, allowlistIn: GoldAllowEntry[] = GOLD_ALLOWLIST, mode: 'write' | 'check' = 'write', tree: Tree = readTree(root)): GoldPlan {
  // The entries for text-lca-gold; an entry for another gold class is the guard's to read.
  const allowlist = allowlistIn.filter((e) => parseToken(e.class).utility === GOLD)
  const uses = goldUses(tree)
  const rewrites: Rewrite[] = []
  const kept: GoldPlan['kept'] = []
  const problems: Problem[] = []
  const used = allowlist.map(() => 0)

  for (const e of allowlist) {
    if (!tree.files.has(e.file)) problems.push({ file: e.file, line: 0, message: `the allowlist entry for ${e.class} names a file that is not a .tsx file under src` })
  }

  for (const use of uses) {
    if (use.utility === GOLD_INK) {
      if (use.ground === 'navy') problems.push({ file: use.file, line: use.line, message: `${use.token} sits on a navy ground (${use.why}), where the light look's #866a1e reads 2.89:1; it should be ${withUtility(parseToken(use.token), GOLD)}` })
      // The light look's dark gold, on a ground no one has placed: an entry cannot take it.
      if (use.ground === 'unplaced') problems.push({ file: use.file, line: use.line, message: `${use.token} sits on a ground this script cannot place (${use.why}); it is the light look's dark gold, for a light ground only, so a person decides: a ground the script can read, or another colour` })
      continue
    }
    if (use.ground === 'navy') {
      kept.push({ use, by: 'ground', reason: use.why })
      continue
    }
    if (use.ground === 'unplaced') {
      const i = allowlist.findIndex((e, j) => e.file === use.file && e.class === use.token && used[j] < e.count)
      if (i >= 0) {
        used[i]++
        kept.push({ use, by: 'allowlist', reason: allowlist[i].reason })
      } else {
        problems.push({ file: use.file, line: use.line, message: `${use.token}: ${use.why}. A person decides: an entry in test/unit/fixtures/goldAllowlist.ts for a navy ground, or a ground the script can read` })
      }
      continue
    }
    if (use.stuck) {
      problems.push({ file: use.file, line: use.line, message: `${use.token} is on a light ground, but ${use.stuck}, so it cannot be rewritten safely` })
      continue
    }
    rewrites.push({ use, to: withUtility(parseToken(use.token), GOLD_INK) })
  }

  allowlist.forEach((e, i) => {
    const found = uses.filter((u) => u.file === e.file && u.token === e.class && u.utility === GOLD)
    const placed = found.filter((u) => u.ground !== 'unplaced')
    if (placed.length > 0 && used[i] === 0) {
      problems.push({ file: e.file, line: placed[0].line, message: `the allowlist entry for ${e.class} is not needed: the script places this use itself (${placed[0].why}); remove the entry` })
    } else if (used[i] !== e.count) {
      problems.push({ file: e.file, line: 0, message: `the allowlist gives ${e.file} ${e.class} ${e.count} uses the script cannot place, and it found ${used[i]}: set its count` })
    }
  })

  const contents = new Map<string, string>()
  for (const file of new Set(rewrites.map((r) => r.use.file))) {
    let text = tree.files.get(file)!.source
    for (const r of rewrites.filter((x) => x.use.file === file).sort((a, b) => b.use.start - a.use.start)) {
      text = text.slice(0, r.use.start) + r.to + text.slice(r.use.end)
    }
    contents.set(file, text)
  }
  if (mode === 'check') {
    for (const r of rewrites) problems.push({ file: r.use.file, line: r.use.line, message: `left to rewrite: ${r.use.token} -> ${r.to} (${r.use.why})` })
  }
  return { searched: tree.files.size, uses, rewrites, kept, problems, contents }
}

// ── The review table ───────────────────────────────────────────────────────

const cell = (s: string) => s.replace(/\|/g, '\\|')

/** The review table: every use, its ground, what decided it, what the run does, and the element. */
export function reviewTable(plan: GoldPlan): string {
  const gold = plan.uses.filter((u) => u.utility === GOLD)
  const ink = plan.uses.filter((u) => u.utility === GOLD_INK)
  const files = new Set(gold.map((u) => u.file)).size
  const byAllowlist = plan.kept.filter((k) => k.by === 'allowlist').length
  const lines = [
    '# Gold text: the review table (scripts/codemods/gold-ink.ts)',
    '',
    `${gold.length} uses of ${GOLD} in ${files} files: ${plan.rewrites.length} on a light ground to rewrite to ${GOLD_INK}, ${plan.kept.length - byAllowlist} kept on a navy or dark ground, ${byAllowlist} kept by an allowlist entry, ${plan.problems.length} problem(s). ${ink.length} ${GOLD_INK} already in place. ${plan.searched} files searched.`,
    '',
    '| File | Line | Class | Ground | What decides it | The run | Element |',
    '|---|---|---|---|---|---|---|',
  ]
  const action = (u: GoldUse) => {
    if (u.utility === GOLD_INK) return u.ground === 'navy' ? 'problem: on navy' : u.ground === 'unplaced' ? 'problem: not placed' : 'in place'
    const r = plan.rewrites.find((x) => x.use === u)
    if (r) return `to ${r.to}`
    const k = plan.kept.find((x) => x.use === u)
    if (k) return k.by === 'allowlist' ? 'kept (allowlist)' : 'kept'
    return 'problem'
  }
  for (const u of plan.uses) {
    lines.push(`| ${u.file} | ${u.line}${u.kind === 'comment' ? ' (comment)' : ''} | ${cell(u.token)} | ${u.ground} | ${cell(u.why)} | ${cell(action(u))} | \`${cell(u.jsx)}\` |`)
  }
  if (plan.problems.length > 0) {
    lines.push('', '## Problems', '')
    for (const p of plan.problems) lines.push(`- ${p.file}${p.line ? `:${p.line}` : ''} ${p.message}`)
  }
  return `${lines.join('\n')}\n`
}

// ── Running it ─────────────────────────────────────────────────────────────

function main(): number {
  const argv = process.argv.slice(2)
  const valueFlags = ['--root', '--table']
  const known = new Set(['--dry-run', '--check', ...valueFlags])
  const stray = argv.filter((a, i) => !known.has(a) && !valueFlags.includes(argv[i - 1]))
  const valueOf = (flag: string) => {
    const i = argv.indexOf(flag)
    return i < 0 ? undefined : argv[i + 1]
  }
  const dryRun = argv.includes('--dry-run')
  const check = argv.includes('--check')
  const missingValue = valueFlags.some((f) => argv.includes(f) && (!valueOf(f) || valueOf(f)!.startsWith('--')))
  if (stray.length > 0 || (dryRun && check) || missingValue) {
    console.error(USAGE)
    return 1
  }
  const root = resolve(valueOf('--root') ?? REPO_ROOT)
  if (!existsSync(join(root, 'src'))) {
    console.error(`Stopped: ${root} has no src folder.`)
    return 1
  }
  const plan = planGold(root, GOLD_ALLOWLIST, check ? 'check' : 'write')
  const table = reviewTable(plan)
  console.log(table)
  const tablePath = valueOf('--table')
  if (tablePath) writeFileSync(resolve(tablePath), table)
  if (plan.problems.length > 0) {
    console.error(`Stopped: ${plan.problems.length} problem(s). Nothing was written.`)
    return 1
  }
  if (check || dryRun) return 0
  for (const [file, text] of plan.contents) writeFileSync(join(root, file), text)
  console.log(`Rewrote ${plan.rewrites.length} classes in ${plan.contents.size} files. Check with --check.`)
  return 0
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) process.exit(main())
