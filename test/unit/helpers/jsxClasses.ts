// test/unit/helpers/jsxClasses.ts
//
// The class names of the site's TSX files, read with the TypeScript parser,
// for the tests of the step 23 colour move (semantic-map-cascade.test.ts and
// semantic-map-grounds.test.ts).
//
// classAttributes() gives, for each className attribute (and each prop whose
// name ends in ClassName), the string pieces its value is built from: string
// literals, the text of template literals, constants declared once in the
// same file (objects of strings included) and GOLD_BUTTON from
// src/lib/brand.ts. Each piece records the branch of every conditional it
// sits in, so two pieces that never apply together can be told apart, and
// the cn() calls that hold it, so a pair that tailwind-merge settles before
// the page sees it can be told apart too.
//
// jsxTree() gives every JSX element with its tag, its className pieces, the
// source text of its style, its data-ground value, its
// dangerouslySetInnerHTML, whether it holds text, the component function it
// is drawn in, and its parent and children. JSX passed in an attribute (such
// as PageHero's aside) counts as a child of the element that takes it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { ROOT } from './cssTokens'

export interface Piece {
  text: string
  /** One entry per conditional the piece sits in, as "<position>:<branch>". */
  branches: string[]
  /** The source positions of the cn() calls that hold the piece. */
  merged: number[]
  /** The condition of each ?: branch the piece is in, as written; "!(...)" for the else branch. */
  conditions: string[]
}

export interface ClassAttribute {
  file: string
  line: number
  /** className, or the prop's own name, such as contentClassName. */
  name: string
  pieces: Piece[]
}

export interface JsxNode {
  file: string
  line: number
  tag: string
  pieces: Piece[]
  /** Every class the element's className can hold, across all branches. */
  classes: string[]
  /** The source text of the style attribute's value, or ''. */
  style: string
  /** The data-ground value, or null. */
  ground: string | null
  /** The source text of dangerouslySetInnerHTML's value, or null. */
  innerHtml: string | null
  /** Holds JSX text, or an expression child that is not an element. */
  text: boolean
  /** The component function the element is drawn in, or null. */
  component: string | null
  parent: JsxNode | null
  children: JsxNode[]
}

/** Two pieces in different branches of one conditional never apply together. */
export function exclusive(a: Piece, b: Piece): boolean {
  const sides = new Map(a.branches.map((x) => x.split(':') as [string, string]))
  return b.branches.some((x) => {
    const [id, side] = x.split(':') as [string, string]
    return sides.has(id) && sides.get(id) !== side
  })
}

/** Two pieces inside one cn() call reach the page through tailwind-merge, which keeps the later of two rivals. */
export function merged(a: Piece, b: Piece): boolean {
  return a.merged.some((m) => b.merged.includes(m))
}

const BRAND = join(ROOT, 'src/lib/brand.ts')

/** The GOLD_BUTTON string from src/lib/brand.ts. */
export function goldButton(): string {
  const m = readFileSync(BRAND, 'utf8').match(/export const GOLD_BUTTON\s*=\s*\n?\s*(['"`])([^'"`]+)\1/)
  if (!m) throw new Error('GOLD_BUTTON not found in src/lib/brand.ts')
  return m[2]
}

interface Context {
  sf: ts.SourceFile
  /** Constants declared exactly once in the file, by name. */
  consts: Map<string, ts.Expression>
  /** Local names bound to GOLD_BUTTON by an import from @/lib/brand. */
  gold: Set<string>
  goldText: string
}

function context(file: string, source: string): Context {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const seen = new Map<string, number>()
  const found = new Map<string, ts.Expression>()
  const gold = new Set<string>()
  const visit = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      seen.set(n.name.text, (seen.get(n.name.text) ?? 0) + 1)
      found.set(n.name.text, n.initializer)
    }
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier) && n.moduleSpecifier.text === '@/lib/brand') {
      const named = n.importClause?.namedBindings
      if (named && ts.isNamedImports(named)) {
        for (const el of named.elements) if ((el.propertyName ?? el.name).text === 'GOLD_BUTTON') gold.add(el.name.text)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  const consts = new Map([...found].filter(([name]) => seen.get(name) === 1))
  return { sf, consts, gold, goldText: gold.size > 0 ? goldButton() : '' }
}

function piecesOf(node: ts.Node, ctx: Context, branches: string[], cn: number[], conditions: string[], depth: number): Piece[] {
  if (depth > 8) return []
  const at = node.getStart(ctx.sf)
  const piece = (text: string): Piece => ({ text, branches, merged: cn, conditions })
  const again = (n: ts.Node, b = branches, m = cn, c = conditions) => piecesOf(n, ctx, b, m, c, depth + 1)
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [piece(node.text)]
  if (ts.isTemplateExpression(node)) {
    const out: Piece[] = [piece(node.head.text)]
    for (const span of node.templateSpans) out.push(...again(span.expression), piece(span.literal.text))
    return out
  }
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isSatisfiesExpression(node)) {
    return again(node.expression)
  }
  if (ts.isConditionalExpression(node)) {
    const cond = node.condition.getText(ctx.sf)
    return [
      ...again(node.whenTrue, [...branches, `${at}:T`], cn, [...conditions, cond]),
      ...again(node.whenFalse, [...branches, `${at}:F`], cn, [...conditions, `!(${cond})`]),
    ]
  }
  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return again(node.right)
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      return [...again(node.left, [...branches, `${at}:L`]), ...again(node.right, [...branches, `${at}:R`])]
    }
    if (op === ts.SyntaxKind.PlusToken) return [...again(node.left), ...again(node.right)]
    return []
  }
  if (ts.isCallExpression(node)) {
    const callee = node.expression.getText(ctx.sf)
    const inner = callee === 'cn' || callee === 'twMerge' ? [...cn, at] : cn
    return node.arguments.flatMap((a) => again(a, branches, inner))
  }
  if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap((e) => again(e))
  if (ts.isObjectLiteralExpression(node)) {
    // clsx's object form: each key is a class string, present when its value is true.
    return node.properties.flatMap((p) =>
      ts.isPropertyAssignment(p) && (ts.isStringLiteral(p.name) || ts.isNoSubstitutionTemplateLiteral(p.name)) ? [piece(p.name.text)] : [],
    )
  }
  if (ts.isIdentifier(node)) {
    if (ctx.gold.has(node.text)) return [piece(ctx.goldText)]
    const init = ctx.consts.get(node.text)
    if (init && !ts.isObjectLiteralExpression(init) && !ts.isArrowFunction(init) && !ts.isFunctionExpression(init)) return again(init)
    return []
  }
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
    const target = node.expression
    const obj = ts.isIdentifier(target) ? ctx.consts.get(target.text) : undefined
    const record = obj && (ts.isAsExpression(obj) || ts.isSatisfiesExpression(obj)) ? obj.expression : obj
    if (!record || !ts.isObjectLiteralExpression(record)) return []
    const props = record.properties.filter(ts.isPropertyAssignment)
    if (ts.isPropertyAccessExpression(node)) {
      const p = props.find((x) => x.name.getText(ctx.sf).replace(/['"]/g, '') === node.name.text)
      return p ? again(p.initializer) : []
    }
    // A lookup by a value the page knows only at run time: one of the entries.
    return props.flatMap((p) => again(p.initializer, [...branches, `${at}:${p.name.getText(ctx.sf)}`]))
  }
  return []
}

const isClassProp = (name: string) => name === 'className' || /ClassName$/.test(name)

function attributeValue(a: ts.JsxAttribute): ts.Expression | undefined {
  const init = a.initializer
  if (!init) return undefined
  if (ts.isStringLiteral(init)) return init
  if (ts.isJsxExpression(init)) return init.expression
  return undefined
}

/** Every className attribute in one TSX file, with its pieces. */
export function classAttributes(file: string, source = readFileSync(join(ROOT, file), 'utf8')): ClassAttribute[] {
  const ctx = context(file, source)
  const out: ClassAttribute[] = []
  const visit = (n: ts.Node) => {
    if (ts.isJsxAttribute(n) && isClassProp(n.name.getText(ctx.sf))) {
      const value = attributeValue(n)
      if (value) {
        out.push({
          file,
          line: ctx.sf.getLineAndCharacterOfPosition(n.getStart(ctx.sf)).line + 1,
          name: n.name.getText(ctx.sf),
          pieces: piecesOf(value, ctx, [], [], [], 0),
        })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(ctx.sf)
  return out
}

/** The name of the component function a node is drawn in: the nearest capitalised function or const. */
function componentOf(node: ts.Node): string | null {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isFunctionDeclaration(n) && n.name && /^[A-Z]/.test(n.name.text)) return n.name.text
    if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name) && /^[A-Z]/.test(n.parent.name.text)) {
      return n.parent.name.text
    }
  }
  return null
}

/**
 * Whether an expression child can put text on the page. Only an element, a
 * fragment, null, false, a list drawn with .map(), or a conditional whose
 * every branch is one of those, is known not to.
 */
function mayBeText(e: ts.Expression, sf: ts.SourceFile): boolean {
  if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) return false
  if (e.kind === ts.SyntaxKind.NullKeyword || e.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isIdentifier(e) && e.text === 'undefined') return false
  if (ts.isParenthesizedExpression(e)) return mayBeText(e.expression, sf)
  if (ts.isConditionalExpression(e)) return mayBeText(e.whenTrue, sf) || mayBeText(e.whenFalse, sf)
  if (ts.isBinaryExpression(e)) {
    if (e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return mayBeText(e.right, sf)
    if (e.operatorToken.kind === ts.SyntaxKind.BarBarToken || e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      return mayBeText(e.left, sf) || mayBeText(e.right, sf)
    }
  }
  if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'map') return false
  return true
}

/** Every JSX element in one TSX file, as a tree. Returns the elements in source order. */
export function jsxTree(file: string, source = readFileSync(join(ROOT, file), 'utf8')): JsxNode[] {
  const ctx = context(file, source)
  const all: JsxNode[] = []
  const visit = (n: ts.Node, parent: JsxNode | null) => {
    const opening = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null
    let next = parent
    if (opening) {
      const node: JsxNode = {
        file,
        line: ctx.sf.getLineAndCharacterOfPosition(n.getStart(ctx.sf)).line + 1,
        tag: opening.tagName.getText(ctx.sf),
        pieces: [],
        classes: [],
        style: '',
        ground: null,
        innerHtml: null,
        text: false,
        component: componentOf(n),
        parent,
        children: [],
      }
      for (const a of opening.attributes.properties) {
        if (!ts.isJsxAttribute(a)) continue
        const name = a.name.getText(ctx.sf)
        const value = attributeValue(a)
        if (name === 'className' && value) node.pieces = piecesOf(value, ctx, [], [], [], 0)
        if (name === 'style' && value) node.style = value.getText(ctx.sf)
        if (name === 'data-ground' && value) node.ground = ts.isStringLiteral(value) ? value.text : value.getText(ctx.sf)
        if (name === 'dangerouslySetInnerHTML' && value) node.innerHtml = value.getText(ctx.sf)
      }
      node.classes = node.pieces.flatMap((p) => p.text.split(/\s+/).filter(Boolean))
      if (ts.isJsxElement(n)) {
        node.text = n.children.some((c) =>
          (ts.isJsxText(c) && c.text.trim() !== '') || (ts.isJsxExpression(c) && !!c.expression && mayBeText(c.expression, ctx.sf)))
      }
      parent?.children.push(node)
      all.push(node)
      next = node
    }
    ts.forEachChild(n, (c) => visit(c, next))
  }
  visit(ctx.sf, null)
  return all
}

/** The element and its ancestors, nearest first. */
export function selfAndAncestors(node: JsxNode): JsxNode[] {
  const out: JsxNode[] = []
  for (let n: JsxNode | null = node; n; n = n.parent) out.push(n)
  return out
}

/** The element's descendants, depth first. */
export function descendants(node: JsxNode): JsxNode[] {
  return node.children.flatMap((c) => [c, ...descendants(c)])
}
