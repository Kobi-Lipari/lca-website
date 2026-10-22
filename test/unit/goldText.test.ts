// test/unit/goldText.test.ts
//
// The scope-aware gold guard (WS01 step 25, the brief's acceptance criterion
// 2). Brand gold #c8a94a reads 2.28:1 on white and 6.51:1 on navy, so it is
// text only on navy or another ground that stays dark in every look. The
// guard reads every TSX file under src with the TypeScript parser and fails
// when:
// - text-lca-gold (any variant or modifier) is on a ground that is not navy
//   or dark, as scripts/codemods/gold-ink.ts reads the ground (the element,
//   its ancestors, what the components of the tree among them paint where
//   what they are given lands, and the places its component is drawn, under
//   any name it is imported by), unless an entry of
//   test/unit/fixtures/goldAllowlist.ts takes a use the reading cannot place;
//   this is the codemod's own --check, so the two never disagree. A hex
//   ground is navy only where brand gold reads 4.5:1 on it, and a ground
//   marked data-ground="dark" only with a navy of its own: the home page
//   hero's darkened photo, the urgent banner's red and Facebook's blue are
//   grounds the reading cannot place;
// - brand gold is text by another route on such a ground: a text class (the
//   text utilities of the two tokens that are #c8a94a in every look, --gold
//   and --gold-on-dark; the hex or its rgb() in a text class, with a type
//   hint, as an arbitrary property, in capitals; a token's variable in a
//   class), a colour of words or an icon's paint (a style's color, fill or
//   stroke, or that attribute on an element that paints with it: an HTML or
//   SVG element, or an icon from lucide-react, which draws color as its
//   stroke), or a colour in HTML a page builds as a string. A style counts
//   wherever it is written: in place, in a constant or a property of one,
//   spread from one, or chosen by ?:, and it sits on each element whose style
//   takes it. A colour can be brand gold as the literal, its rgb(), LCA.gold
//   or LCA['gold'], a variable of --gold, --gold-on-dark or the brand colour,
//   a template of one value that is one, a constant bound to one, a fallback
//   or a ?: that can be one, a prop of a component of the site that a place
//   drawing the component sets to one (read where the component uses it, an
//   icon it spreads its props onto included), or a club's colour, which is
//   brand gold until the club picks its own, unless it goes through
//   clubTextColor, which turns brand gold into the gold-ink token;
// - text-gold-ink sits on a navy ground, where the light look's #866a1e
//   reads 2.89:1, or on a ground the reading cannot place;
// - a gold token for one kind of ground sits on the other, as the same
//   reading places it: a badge's dark gold (text-gold-ink-badge and
//   text-gold-ink-badge-club, #705718 in the light looks, about 2.2:1 on
//   navy), or gold-ink as a variable or a style colour (clubTextColor
//   included), on navy or a ground the reading cannot place, and a pill's
//   light gold (text-gold-on-dark-badge, #f0d07a, about 1.5:1 on white) off
//   a dark ground. A badge or pill the reading cannot place takes an entry of
//   GOLD_BADGE_ALLOWLIST, and the elements that entry names as the readers of
//   its string are placed in turn. In a component told its ground by an on
//   prop (the filter dropdowns), the branch for on === 'navy' is on navy and
//   the other on a light ground;
// - a component told its ground by an on prop ('navy' or 'light': the
//   filter dropdowns and StatusBadge) is drawn on a ground its on does not
//   name, or with an on the guard cannot read;
// - #705718 appears in the code of a TSX file other than the heritage pages
//   (the six HERITAGE_ROUTES draw, read from src/App.tsx) and the About
//   menu's "You are here" label;
// - #866a1e is text below 13px anywhere (in a class, or as the value of a
//   color property, which is words whatever its string holds), text anywhere
//   but the phone sheet's "You are here" on its #fbfaf6 row, or a line or
//   fill anywhere but the phone tab bar's current tab.
// The last two are WS02's parts, listed in the fixture as WS02_GOLD. They are
// not built yet, so each entry matches nothing today, which the guard says;
// when one is built it must keep to its context or the guard fails.
//
// Every failure is planted in a temporary tree first, with the class names
// put together when the test runs, so Tailwind, which reads this file, builds
// no CSS for them. Among them are two grounds the reading leaves to a
// person, though both look dark: the home page hero's shape, marked
// data-ground="dark" over a darkened photo with no navy of its own, and a
// hex ground on which neither gold reads 4.5:1 (the urgent banner's red,
// Facebook's blue), each with brand gold in its forms and with gold-ink.
//
// The pass on the tree is shown to be earned: without the allowlist exactly
// its two uses fail, and a copy of every TSX file under src passes as the
// tree does while one real use put back as it was before step 25, or moved
// to the wrong ground, fails at its own line. More planted forms follow: the
// hover, /90, important and one-width forms of brand gold, a style colour in
// a constant, a spread or a ?:, the literal in capitals and as rgb(), brand
// gold through the text utilities of the two tokens that are #c8a94a in every
// look (--gold and --gold-on-dark), gold-ink in a component drawn on navy
// under another name or passed into a wrapper component that paints navy,
// gold-ink inside a Card or a sheet given a navy ground, and the two WS02
// colours in a style colour, an ancestor's size or a comment. Then the paint
// of an icon or an SVG shape in brand gold, the token variables in a style,
// a colour passed into a component of the site, and the badge and pill
// tokens: inside a wrapper component that paints navy, in each branch of a
// component told its ground by on, drawn with an on that does not name its
// ground, and in an object of strings with and without an entry.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import ts from 'typescript'
import { afterAll, describe, expect, it } from 'vitest'
import { drawnAt, GOLD, GOLD_INK, goldUses, groundOf, planGold, readTree, tagTarget, type Element, type Ground, type GoldUse, type ParsedFile, type Tree } from '../../scripts/codemods/gold-ink'
import { parseToken, tokensOf, tsxFiles } from '../../scripts/codemods/semantic-colours'
import { clubTextColor } from '../../src/areas/clubs/clubColors'
import { HERITAGE_ROUTES } from '../../src/lib/themeScopes'
import { GOLD_ALLOWLIST, GOLD_BADGE_ALLOWLIST, WS02_GOLD, type GoldAllowEntry, type GoldBadgeEntry, type Ws02GoldEntry } from './fixtures/goldAllowlist'
import { indexCssRules, read, ROOT, rootTokens, scopeTokens } from './helpers/cssTokens'

const BRAND_GOLD = '#c8a94a'
const HERITAGE_GOLD = '#705718'
const DARK_GOLD = '#866a1e'

/** A class name or colour no page uses, put together when the test runs. */
const c = (...parts: string[]) => parts.join('')

/** The text utilities of the two tokens that are #c8a94a in every look, --gold and --gold-on-dark, put together when the test runs. */
const GOLD_TOKEN_TEXT = new Set(['gold', 'gold-on-dark'].map((token) => c('text-', token)))

/**
 * Brand gold as a text class, in the forms a page can write it other than
 * text-lca-gold (the codemod's own check): the two tokens' text utilities;
 * the hex or its rgb() as a text colour, with or without a type hint, or as
 * an arbitrary property; and either token's variable, or the brand colour's,
 * in brackets or parentheses. Capitals count, and so does any variant or
 * opacity modifier, which the utility leaves out.
 */
const isBrandGoldText = (utility: string) =>
  GOLD_TOKEN_TEXT.has(utility.toLowerCase()) ||
  /^(?:text-\[(?:color:)?(?:#c8a94a|rgb\(200[,_\s]+169[,_\s]+74\)|var\(--(?:color-)?(?:lca-)?gold(?:-on-dark)?\))\]|text-\((?:color:)?--(?:color-)?(?:lca-)?gold(?:-on-dark)?\)|\[color:(?:#c8a94a|var\(--(?:color-)?(?:lca-)?gold(?:-on-dark)?\))\])$/i.test(utility)

// ── Reading values ─────────────────────────────────────────────────────────

/** What a name is bound to where it is used: the nearest const of that name in an enclosing block or the file, or a parameter, with the prop it takes when it is destructured and its default. */
type Binding =
  | { kind: 'const'; init: ts.Expression }
  | { kind: 'param'; fn: ts.SignatureDeclaration; prop: string | null; dflt: ts.Expression | undefined }

function bindingOf(id: ts.Identifier): Binding | null {
  for (let n: ts.Node | undefined = id.parent; n; n = n.parent) {
    if (ts.isFunctionLike(n)) {
      for (const p of n.parameters) {
        if (ts.isIdentifier(p.name) && p.name.text === id.text) return { kind: 'param', fn: n, prop: null, dflt: p.initializer }
        if (!ts.isObjectBindingPattern(p.name)) continue
        for (const b of p.name.elements) {
          if (ts.isIdentifier(b.name) && b.name.text === id.text) return { kind: 'param', fn: n, prop: (b.propertyName ?? b.name).getText().replace(/['"]/g, ''), dflt: b.initializer }
        }
      }
    }
    if (ts.isBlock(n) || ts.isSourceFile(n)) {
      for (const st of n.statements) {
        if (!ts.isVariableStatement(st)) continue
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === id.text && d.initializer) return { kind: 'const', init: d.initializer }
      }
    }
  }
  return null
}

/** The initializer a name has where it is used: the nearest const of that name in an enclosing block or the file; undefined for a parameter or anything else. */
function initializerOf(id: ts.Identifier): ts.Expression | undefined {
  const b = bindingOf(id)
  return b?.kind === 'const' ? b.init : undefined
}

/** The component a function is: a capitalised function, or a capitalised const that holds it, directly or through forwardRef() or memo(); null for any other function. */
function componentNameOf(fn: ts.Node): string | null {
  if (ts.isFunctionDeclaration(fn)) return fn.name && /^[A-Z]/.test(fn.name.text) ? fn.name.text : null
  if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) return null
  let n: ts.Node = fn
  while (n.parent && ts.isCallExpression(n.parent) && /^(?:React\.)?(?:forwardRef|memo)$/.test(n.parent.expression.getText())) n = n.parent
  const d = n.parent
  return d && ts.isVariableDeclaration(d) && d.initializer === n && ts.isIdentifier(d.name) && /^[A-Z]/.test(d.name.text) ? d.name.text : null
}

/** The opening tag of each element of a parsed file, by where the element starts. */
const OPENINGS = new WeakMap<ts.SourceFile, Map<number, ts.JsxOpeningLikeElement>>()

/** The opening tag the parser read for an element of the tree. */
function openingOf(tree: Tree, el: Element): ts.JsxOpeningLikeElement | null {
  const parsed = tree.files.get(el.file)
  if (!parsed) return null
  let found = OPENINGS.get(parsed.sf)
  if (!found) {
    const map = new Map<number, ts.JsxOpeningLikeElement>()
    const visit = (n: ts.Node) => {
      if (ts.isJsxElement(n)) map.set(n.getStart(parsed.sf), n.openingElement)
      else if (ts.isJsxSelfClosingElement(n)) map.set(n.getStart(parsed.sf), n)
      ts.forEachChild(n, visit)
    }
    visit(parsed.sf)
    OPENINGS.set(parsed.sf, map)
    found = map
  }
  return found.get(el.start) ?? null
}

/** An attribute of an opening tag: whether it is there, and its value (the string, or the expression in braces). */
function attributeOf(opening: ts.JsxOpeningLikeElement | null, name: string): { present: boolean; value: ts.Expression | undefined } {
  const a = opening?.attributes.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText() === name)
  if (!a) return { present: false, value: undefined }
  const init = a.initializer
  return { present: true, value: !init ? undefined : ts.isStringLiteral(init) ? init : ts.isJsxExpression(init) ? init.expression : undefined }
}

/** Whether a tag draws a component of the site: one its file declares, or one it imports from a file of the site. An HTML or SVG element, an icon from a package and an icon held in a variable are not. */
function isSiteComponent(parsed: ParsedFile, tag: string): boolean {
  const head = tag.split('.')[0]
  if (!/^[A-Z]/.test(head)) return false
  if (parsed.components.has(tag)) return true
  const binding = parsed.imports.get(head)
  return !!binding && (binding.from.startsWith('.') || binding.from.startsWith('@/'))
}

/**
 * The golds a colour can be: brand gold, text only on navy; the gold of a
 * token for a light ground (gold-ink and the badges' dark gold), never on
 * navy; and a pill's light gold, only on a ground that stays dark.
 */
type Gold = 'brand' | 'ink' | 'pill'

/** The variables of --gold and --gold-on-dark, the two tokens that are #c8a94a in every look, and of the brand colour, with a fallback or without. */
const BRAND_GOLD_VAR = /^var\(\s*--(?:color-)?(?:lca-)?gold(?:-on-dark)?\s*(?:,.*)?\)$/i
/** The variables of the gold tokens for a light ground: --gold-ink and the two badge tokens. */
const INK_VAR = /^var\(\s*--(?:color-)?gold-ink(?:-badge(?:-club)?)?\s*(?:,.*)?\)$/i
/** The variable of a pill's light gold, for a ground that stays dark. */
const PILL_VAR = /^var\(\s*--(?:color-)?gold-on-dark-badge\s*(?:,.*)?\)$/i
/** A club's colour, by the name of the field or prop that holds it: brand gold is every club's colour until it picks its own. */
const CLUB_COLOUR = /^(?:color|club_color)$/

/**
 * The golds an expression can give as a colour. Brand gold: the literal or
 * its rgb(), LCA.gold, a variable of --gold, --gold-on-dark or the brand
 * colour, and a club's colour (club.color, form.color, t.club_color, or a
 * colour a callback is handed under that name). The gold of a token for a
 * light ground: its variable, and clubTextColor, which gives var(--gold-ink)
 * for brand gold. A pill's light gold: its variable. A name is followed to
 * its constant, and a prop of a component of the site (destructured, or read
 * from its props) to what each place that draws the component passes for it,
 * and to its default; a fallback or a ?: gives what either side can. Any
 * other call gives what it says it gives, which is none of these.
 */
function goldsOf(e: ts.Expression | undefined, tree: Tree | null, depth = 0, seen: ReadonlySet<string> = new Set()): Set<Gold> {
  const out = new Set<Gold>()
  const add = (more: Set<Gold>) => {
    for (const g of more) out.add(g)
    return out
  }
  if (!e || depth > 8) return out
  if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e)) return goldsOf(e.expression, tree, depth + 1, seen)
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
    const v = e.text.trim()
    if (v.toLowerCase() === BRAND_GOLD || /^rgb\(\s*200[,\s]+169[,\s]+74\s*\)$/i.test(v) || BRAND_GOLD_VAR.test(v)) out.add('brand')
    if (INK_VAR.test(v)) out.add('ink')
    if (PILL_VAR.test(v)) out.add('pill')
    return out
  }
  // A colour written as a template of one value, with or without two hex digits of alpha after it.
  if (ts.isTemplateExpression(e) && e.head.text === '' && e.templateSpans.length === 1 && /^(?:[0-9a-f]{2})?$/i.test(e.templateSpans[0].literal.text)) {
    return goldsOf(e.templateSpans[0].expression, tree, depth + 1, seen)
  }
  if (ts.isElementAccessExpression(e) && e.expression.getText() === 'LCA' && ts.isStringLiteralLike(e.argumentExpression) && e.argumentExpression.text === 'gold') return add(new Set<Gold>(['brand']))
  if (ts.isPropertyAccessExpression(e)) {
    if (e.getText() === 'LCA.gold') return add(new Set<Gold>(['brand']))
    // props.x in a component: what each place that draws it passes for x.
    const props = ts.isIdentifier(e.expression) ? bindingOf(e.expression) : null
    if (props?.kind === 'param' && props.prop === null && componentNameOf(props.fn)) return add(propGolds(props.fn, e.name.text, tree, depth, seen))
    if (CLUB_COLOUR.test(e.name.text) && e.expression.getText() !== 'LCA') out.add('brand')
    return out
  }
  if (ts.isIdentifier(e)) {
    const b = bindingOf(e)
    if (!b) return out
    if (b.kind === 'const') return goldsOf(b.init, tree, depth + 1, seen)
    add(goldsOf(b.dflt, tree, depth + 1, seen))
    if (b.prop !== null && componentNameOf(b.fn)) return add(propGolds(b.fn, b.prop, tree, depth, seen))
    // A colour a callback is handed (clubs.map(({ color }) => ...)) is a club's colour, as club.color is.
    if (b.prop !== null && CLUB_COLOUR.test(b.prop)) out.add('brand')
    return out
  }
  if (ts.isBinaryExpression(e) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind)) {
    add(goldsOf(e.left, tree, depth + 1, seen))
    return add(goldsOf(e.right, tree, depth + 1, seen))
  }
  if (ts.isConditionalExpression(e)) {
    add(goldsOf(e.whenTrue, tree, depth + 1, seen))
    return add(goldsOf(e.whenFalse, tree, depth + 1, seen))
  }
  if (ts.isCallExpression(e) && e.expression.getText() === 'clubTextColor') out.add('ink')
  return out
}

/** What the places that draw a component pass for one of its props, read where each value is written. */
function propGolds(fn: ts.SignatureDeclaration, prop: string, tree: Tree | null, depth: number, seen: ReadonlySet<string>): Set<Gold> {
  const out = new Set<Gold>()
  const name = componentNameOf(fn)
  const file = fn.getSourceFile().fileName
  const key = `${file} ${name} ${prop}`
  if (!tree || !name || seen.has(key)) return out
  const next = new Set([...seen, key])
  for (const place of drawnAt(tree, file, name)) {
    for (const g of goldsOf(attributeOf(openingOf(tree, place), prop).value, tree, depth + 1, next)) out.add(g)
  }
  return out
}

/** Whether an expression can give brand gold. */
const canBeBrandGold = (e: ts.Expression | undefined, tree: Tree | null = null) => goldsOf(e, tree).has('brand')

/** The element whose opening tag holds a position, innermost first. */
function elementAt(parsed: ParsedFile, pos: number): Element | null {
  let best: Element | null = null
  for (const el of parsed.elements) if (pos >= el.start && pos < el.end && (!best || el.start >= best.start)) best = el
  return best
}

/** The font size an element's words take: its own size class or the nearest ancestor's, in pixels; 16 when none sets one. */
const SIZES: Record<string, number> = { 'text-xs': 12, 'text-sm': 14, 'text-base': 16, 'text-lg': 18, 'text-xl': 20, 'text-2xl': 24, 'text-3xl': 30, 'text-4xl': 36 }
function fontPx(el: Element | null): number {
  for (let n = el; n; n = n.parent) {
    for (const p of n.pieces) {
      for (const { token } of tokensOf(p.text)) {
        if (token.variants !== '') continue
        if (SIZES[token.utility]) return SIZES[token.utility]
        const px = token.utility.match(/^text-\[(\d+(?:\.\d+)?)px\]$/)
        if (px) return Number(px[1])
        const rem = token.utility.match(/^text-\[(\d+(?:\.\d+)?)rem\]$/)
        if (rem) return Number(rem[1]) * 16
      }
    }
  }
  return 16
}

/** The hex grounds an element sits on: a ground class of a hex colour on it or an ancestor. */
function hexGrounds(el: Element | null): string[] {
  const out: string[] = []
  for (let n = el; n; n = n.parent) {
    for (const p of n.pieces) for (const { token } of tokensOf(p.text)) {
      const m = token.utility.match(/^bg-\[(#[0-9a-fA-F]{6})\]$/)
      if (m && token.variants === '' && token.modifier === '') out.push(m[1].toLowerCase())
    }
  }
  return out
}

// ── The guard ──────────────────────────────────────────────────────────────

interface HexUse {
  file: string
  line: number
  /** Words, a line or fill (a bar), or a value whose use the guard cannot tell. */
  as: 'text' | 'bar' | 'unknown'
  el: Element | null
  what: string
}

/** A class whose value is written out: an arbitrary value (text-[#866a1e], border-t-[#866a1e]) or an arbitrary property ([color:#866a1e]). */
const ARBITRARY = /^(?:[a-z][\w-]*-\[|\[[a-z-]+:)/i
/** A class that colours words. */
const WORDS_CLASS = /^(?:text-|\[color:)/i

/**
 * The property a literal is the value of, in a style or any other object,
 * through parentheses, a cast, a ?: branch or a fallback, and for a template
 * literal's text the property the template is the value of; null when it is
 * the value of none.
 */
function propertyOf(n: ts.Node, sf: ts.SourceFile): string | null {
  let at: ts.Node = ts.isTemplateHead(n) ? n.parent : ts.isTemplateMiddle(n) || ts.isTemplateTail(n) ? n.parent.parent : n
  const passes = (p: ts.Node) =>
    ts.isParenthesizedExpression(p) ||
    ts.isAsExpression(p) ||
    (ts.isConditionalExpression(p) && p.condition !== at) ||
    (ts.isBinaryExpression(p) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(p.operatorToken.kind))
  while (at.parent && passes(at.parent)) at = at.parent
  return at.parent && ts.isPropertyAssignment(at.parent) && at.parent.initializer === at ? at.parent.name.getText(sf).replace(/['"]/g, '') : null
}

/**
 * Every place a hex colour appears in the code of a file (strings and
 * template text, never comments), with how it is used. The value of a color
 * property is words, whatever else the string holds. A class with the colour
 * written out is words when it colours words, and a line or fill otherwise.
 * The value of any other property (borderTopColor, fill) is a line or fill,
 * and CSS in a string that sets color is words.
 */
function hexUses(parsed: ParsedFile, hex: string): HexUse[] {
  const out: HexUse[] = []
  const { source, file } = parsed
  const lineOf = (pos: number) => source.slice(0, pos).split('\n').length
  const visit = (n: ts.Node) => {
    const literal = ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)
    if (literal && (n as ts.LiteralLikeNode).text.toLowerCase().includes(hex)) {
      const text = (n as ts.LiteralLikeNode).text
      const pos = n.getStart(parsed.sf)
      const holder = elementAt(parsed, pos)
      const classes = tokensOf(text).map(({ token }) => token).filter((t) => t.utility.toLowerCase().includes(hex) && ARBITRARY.test(t.utility))
      const prop = propertyOf(n, parsed.sf)
      const record = (as: HexUse['as'], what: string) => out.push({ file, line: lineOf(pos), as, el: holder, what })
      if (prop === 'color') record('text', `color: ${text}`)
      else if (classes.length > 0) record(classes.some((t) => WORDS_CLASS.test(t.utility)) ? 'text' : 'bar', classes.map((t) => t.text).join(' '))
      else if (prop) record('bar', `${prop}: ${text}`)
      else if (new RegExp(`(?:^|[;"'\\s])color\\s*:\\s*${hex}`, 'i').test(text)) record('text', text.slice(0, 80))
      else record('unknown', text.slice(0, 80))
    }
    ts.forEachChild(n, visit)
  }
  visit(parsed.sf)
  return out
}

interface GuardOptions {
  allowlist?: GoldAllowEntry[]
  /** The entries for the badge and pill tokens the reading cannot place. */
  badges?: GoldBadgeEntry[]
  ws02?: Ws02GoldEntry[]
  /** The heritage pages, as files relative to the root. */
  heritage?: string[]
}

/** The line a node starts on. */
const lineAt = (parsed: ParsedFile, n: ts.Node) => parsed.sf.getLineAndCharacterOfPosition(n.getStart(parsed.sf)).line + 1

/** A ground in words, for a problem. */
const groundWords = (g: Ground) => (g === 'light' ? 'light ground' : g === 'navy' ? 'navy ground' : 'ground no one has placed')

/** What an element paints with: the colour of its words or of an icon's stroke (lucide-react draws color as its stroke), its fill and its stroke. */
const PAINT = new Set(['color', 'fill', 'stroke'])

/** What the guard reads, and every problem it finds, under a root. */
function goldGuard(root: string, { allowlist = GOLD_ALLOWLIST, badges = GOLD_BADGE_ALLOWLIST, ws02 = WS02_GOLD, heritage = heritagePages() }: GuardOptions = {}) {
  const tree: Tree = readTree(root)
  const problems: string[] = []
  const at = (file: string, line: number) => `${file}${line ? `:${line}` : ''}`

  // text-lca-gold and text-gold-ink: the codemod's own check.
  const plan = planGold(root, allowlist, 'check', tree)
  for (const p of plan.problems) problems.push(`${at(p.file, p.line)} ${p.message}`)

  // Brand gold as a text class in its other forms: on navy, or by an entry for that class.
  const hexText = goldUses(tree, isBrandGoldText)
  const left = new Map<string, number>()
  for (const e of allowlist.filter((x) => parseToken(x.class).utility !== GOLD)) left.set(`${e.file} ${e.class}`, (left.get(`${e.file} ${e.class}`) ?? 0) + e.count)
  for (const u of hexText) {
    if (u.ground === 'navy') continue
    const key = `${u.file} ${u.token}`
    if ((left.get(key) ?? 0) > 0) {
      left.set(key, left.get(key)! - 1)
      continue
    }
    problems.push(`${at(u.file, u.line)} ${u.token} is brand gold as text on a ${u.ground === 'light' ? 'light ground' : 'ground no one has placed'} (${u.why}); brand gold is text only on navy`)
  }
  // An entry the uses do not take in full is wrong, as the codemod's own entries are.
  for (const [key, count] of left) {
    if (count > 0) problems.push(`${key.split(' ')[0]} the allowlist entry for ${key.split(' ').slice(1).join(' ')} allows ${count} more use(s) than the guard needs: set its count, or remove it`)
  }

  // A colour of words or of an icon's paint: a style's color, fill or
  // stroke, and that attribute on an element that paints with it. A
  // component of the site takes the attribute as a prop, which the reading
  // follows to where the component uses it, and to the elements it spreads
  // its props onto.
  const styleGold: string[] = []
  const styleInk: string[] = []
  const stylePill: string[] = []
  const paint = (where: string, what: string, value: ts.Expression | undefined, el: Element | null) => {
    const golds = goldsOf(value, tree)
    if (golds.size === 0) return
    const v = el ? groundOf(tree, el) : { ground: 'unplaced' as const, why: 'a colour the guard cannot place on an element' }
    if (golds.has('brand')) {
      styleGold.push(`${where} ${what} -> ${v.ground}`)
      if (v.ground !== 'navy') problems.push(`${where} ${what} can be brand gold, as text on a ${groundWords(v.ground)} (${v.why}); brand gold is text only on navy, and a club colour falls back to var(--gold-ink)`)
    }
    if (golds.has('ink')) {
      styleInk.push(`${where} ${what} -> ${v.ground}`)
      if (v.ground !== 'light') problems.push(`${where} ${what} can be the gold of a token for a light ground (gold-ink, or a badge's dark gold), here on a ${groundWords(v.ground)} (${v.why}), where the light look's dark gold reads 2.89:1 or less on navy`)
    }
    if (golds.has('pill')) {
      stylePill.push(`${where} ${what} -> ${v.ground}`)
      if (v.ground !== 'navy') problems.push(`${where} ${what} is a pill's light gold, for a ground that stays dark, here on a ${groundWords(v.ground)} (${v.why}), where #f0d07a reads about 1.5:1 on white`)
    }
  }
  for (const parsed of tree.files.values()) {
    const styles = styleObjects(parsed)
    const visit = (n: ts.Node) => {
      // A style's colour sits on each element whose style takes its object.
      const takers = (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) && PAINT.has(n.name.getText(parsed.sf).replace(/['"]/g, '')) ? styles.get(n.parent) : undefined
      if (takers && (ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n))) {
        const value = ts.isPropertyAssignment(n) ? n.initializer : n.name
        const what = `the style colour ${oneLine(n.getText(parsed.sf))}`
        for (const el of takers.length > 0 ? takers : [null]) paint(at(parsed.file, lineAt(parsed, n)), what, value, el)
      }
      if (ts.isJsxAttribute(n) && PAINT.has(n.name.getText(parsed.sf))) {
        const opening = n.parent.parent
        const tag = opening.tagName.getText(parsed.sf)
        const value = attributeOf(opening, n.name.getText(parsed.sf)).value
        const what = `the ${n.name.getText(parsed.sf)} of <${tag}> ${oneLine(n.initializer?.getText(parsed.sf) ?? '')}`
        const where = at(parsed.file, lineAt(parsed, n))
        if (!isSiteComponent(parsed, tag)) paint(where, what, value, elementAt(parsed, n.getStart(parsed.sf)))
        else {
          const target = tagTarget(tree, parsed.file, tag)
          const inside = target?.file ? tree.files.get(target.file) : undefined
          for (const e of inside?.elements.filter((x) => x.component === target!.name && x.spreads && !isSiteComponent(inside, x.tag)) ?? []) {
            paint(where, `${what}, which <${e.tag}> in ${e.file} takes through its spread props`, value, e)
          }
        }
      }
      if (ts.isTemplateExpression(n)) {
        const parts = [n.head, ...n.templateSpans.map((s) => s.literal)]
        n.templateSpans.forEach((span, i) => {
          if (/color\s*:\s*$/i.test(parts[i].text) && canBeBrandGold(span.expression, tree)) {
            problems.push(`${at(parsed.file, parsed.sf.getLineAndCharacterOfPosition(span.getStart(parsed.sf)).line + 1)} HTML built as a string colours its text brand gold (color:\${${span.expression.getText(parsed.sf)}}), on a ground the guard cannot read`)
          }
        })
      }
      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) && /(?<![[\w-])color\s*:\s*#c8a94a/i.test((n as ts.LiteralLikeNode).text)) {
        problems.push(`${at(parsed.file, parsed.sf.getLineAndCharacterOfPosition(n.getStart(parsed.sf)).line + 1)} CSS in a string colours its text brand gold`)
      }
      ts.forEachChild(n, visit)
    }
    visit(parsed.sf)
  }

  // The gold tokens of one kind of ground, placed by the same reading: a
  // badge's dark gold never on navy, and a pill's light gold only on a dark
  // ground. A use the reading cannot place takes an entry, whose readers are
  // placed in turn.
  const onProps = onPropComponents(tree)
  const badgeUses: Array<{ use: GoldUse; ground: Ground; why: string }> = []
  const usedBadges = badges.map(() => 0)
  for (const u of goldUses(tree, (utility) => tokenGold(utility) !== null)) {
    const gold = tokenGold(u.utility)
    const v = onBranch(u, onProps) ?? { ground: u.ground, why: u.why }
    badgeUses.push({ use: u, ...v })
    const where = at(u.file, u.line)
    if (gold === 'ink' && v.ground === 'navy') {
      problems.push(`${where} ${u.token} sits on a navy ground (${v.why}), where a badge's dark gold reads about 2.2:1 in the light look; gold words on navy take text-lca-gold, or text-gold-on-dark-badge on a tint`)
    } else if (gold === 'pill' && v.ground === 'light') {
      problems.push(`${where} ${u.token} sits on a light ground (${v.why}), where a pill's light gold reads about 1.5:1; gold words on a light ground take text-gold-ink-badge`)
    } else if (v.ground === 'unplaced') {
      const i = badges.findIndex((e, j) => e.file === u.file && e.class === u.token && usedBadges[j] < e.count)
      if (i >= 0) usedBadges[i]++
      else problems.push(`${where} ${u.token}: ${v.why}. A person decides: an entry in GOLD_BADGE_ALLOWLIST (test/unit/fixtures/goldAllowlist.ts) with the ground under it, or a ground the reading can place`)
    }
  }
  badges.forEach((e, i) => {
    const placed = badgeUses.filter((b) => b.use.file === e.file && b.use.token === e.class && b.ground !== 'unplaced')
    if (usedBadges[i] === 0 && placed.length > 0) problems.push(`${at(e.file, placed[0].use.line)} the badge allowlist entry for ${e.class} is not needed: the reading places this use itself (${placed[0].why}); remove the entry`)
    else if (usedBadges[i] !== e.count) problems.push(`${e.file} the badge allowlist gives ${e.class} ${e.count} use(s) the reading cannot place, and it found ${usedBadges[i]}: set its count`)
    if (!e.readBy) return
    const parsed = tree.files.get(e.file)
    const readers = parsed?.elements.filter((el) => el.classRange !== null && parsed.source.slice(el.classRange[0], el.classRange[1]).includes(e.readBy!)) ?? []
    if (readers.length === 0) problems.push(`${e.file} no className in the file holds ${e.readBy}, which the badge allowlist entry for ${e.class} names as the code that reads it`)
    const want: Ground = e.ground === 'light' ? 'light' : 'navy'
    for (const r of readers) {
      const v = groundOf(tree, r)
      if (v.ground !== want) problems.push(`${at(e.file, r.line)} <${r.tag}> reads ${e.class} through ${e.readBy} on a ${groundWords(v.ground)} (${v.why}), where the badge allowlist entry puts it on a ${e.ground} ground`)
    }
  })

  // A component told its ground by an on prop: every place it is drawn gives the on its ground needs.
  const onPlaces: string[] = []
  for (const c of onProps.values()) {
    for (const place of drawnAt(tree, c.file, c.name)) {
      const opening = openingOf(tree, place)
      const attr = attributeOf(opening, 'on')
      const spreads = !!opening?.attributes.properties.some(ts.isJsxSpreadAttribute)
      const on = attr.present ? (attr.value && ts.isStringLiteralLike(attr.value) ? attr.value.text : null) : spreads ? null : c.dflt
      const v = groundOf(tree, place, [], 0, new Set(), 'place')
      const where = at(place.file, place.line)
      onPlaces.push(`${where} <${place.tag}> on=${on ?? '?'}${attr.present ? '' : ' (its default)'} -> ${v.ground}`)
      if (on !== 'navy' && on !== 'light') {
        problems.push(`${where} <${place.tag}> is told its ground by on, and the guard cannot read the on this place gives (${attr.present ? oneLine(attr.value?.getText() ?? '') : spreads ? 'spread props' : 'none, and no default'}); give it as on="navy" or on="light"`)
      } else if (v.ground !== on) {
        problems.push(`${where} <${place.tag}> is drawn with on="${on}"${attr.present ? '' : ', its default,'} on a ${groundWords(v.ground)} (${v.why}), so it draws the gold for a ${on === 'navy' ? 'navy' : 'light'} ground there; give it the on its ground needs`)
      }
    }
  }

  // #705718: the heritage pages, and the About menu's "You are here" label.
  const ws02Matched: string[] = []
  const contextFor = (hex: string, use: HexUse) => ws02.filter((w) => w.colour === hex && w.file === use.file)
  for (const parsed of tree.files.values()) {
    for (const use of hexUses(parsed, HERITAGE_GOLD)) {
      if (heritage.includes(use.file)) continue
      const entries = contextFor(HERITAGE_GOLD, use)
      if (entries.length > 0) ws02Matched.push(`${use.file}:${use.line}`)
      const fits = entries.some((w) => use.as === w.use && (w.use !== 'text' || inContext(use, w)))
      if (!fits) problems.push(`${at(use.file, use.line)} ${HERITAGE_GOLD} (${use.what}) is heritage's gold ink, allowed only on the heritage pages and as the About menu's "You are here" label`)
    }
    // #866a1e: never words below 13px; words only on the sheet's #fbfaf6 row, a line or fill only as the current tab's bar.
    for (const use of hexUses(parsed, DARK_GOLD)) {
      const entries = contextFor(DARK_GOLD, use)
      if (entries.length > 0) ws02Matched.push(`${use.file}:${use.line}`)
      if (use.as === 'text' && fontPx(use.el) < 13) {
        problems.push(`${at(use.file, use.line)} ${DARK_GOLD} (${use.what}) is text below 13px (${fontPx(use.el)}px)`)
        continue
      }
      const fits = entries.some((w) => use.as === w.use && (w.use !== 'text' || inContext(use, w)))
      if (!fits) problems.push(`${at(use.file, use.line)} ${DARK_GOLD} (${use.what}) is allowed only as text of 13px or more on the listed #fbfaf6 row and as the phone tab bar's current-tab bar; elsewhere text takes text-gold-ink`)
    }
  }
  return { tree, plan, hexText, styleGold, styleInk, stylePill, badgeUses, onPlaces, ws02Matched, problems }
}

/**
 * The gold of a text class for one kind of ground: a badge's dark gold
 * (text-gold-ink-badge, text-gold-ink-badge-club, or the variable of gold-ink
 * or a badge token in a class) or a pill's light gold
 * (text-gold-on-dark-badge, or its variable); null for any other class,
 * text-gold-ink among them, which the codemod's own check holds.
 */
function tokenGold(utility: string): 'ink' | 'pill' | null {
  const u = utility.toLowerCase()
  if (u === 'text-gold-ink-badge' || u === 'text-gold-ink-badge-club') return 'ink'
  if (u === 'text-gold-on-dark-badge') return 'pill'
  const m = u.match(/^text-\[(?:color:)?(var\(.+\))\]$|^text-\((?:color:)?(--[\w-]+)\)$|^\[color:(var\(.+\))\]$/)
  const value = m ? (m[1] ?? (m[2] ? `var(${m[2]})` : m[3])) : null
  if (!value) return null
  return INK_VAR.test(value) ? 'ink' : PILL_VAR.test(value) ? 'pill' : null
}

/** A condition on the on prop, as the reading writes it: on === 'navy', !(on === 'navy'), on !== 'light' and the like. */
const ON_TEST = /^(!\()?on\s*(===|!==)\s*(['"])(navy|light)\3(\))?$/

/** The ground a branch is for, by the first condition on the on prop it sits under; null when none tests it. */
function branchOf(when: string[]): 'navy' | 'light' | null {
  for (const c of when) {
    const m = c.match(ON_TEST)
    if (!m || !!m[1] !== !!m[5]) continue
    const negated = !!m[1] !== (m[2] === '!==')
    return (m[4] === 'navy') !== negated ? 'navy' : 'light'
  }
  return null
}

/** A component told its ground by an on prop, and the on it takes when a place gives none. */
interface OnProp {
  file: string
  name: string
  dflt: string | null
}

/** The ground a use is on when every element that reads it is a component told its ground by on, reading it in the branch for one ground. */
function onBranch(u: GoldUse, onProps: Map<string, OnProp>): { ground: Ground; why: string } | null {
  const branches = u.holders.map(({ el, when }) => (el.component && onProps.has(`${el.file} ${el.component}`) ? branchOf(when) : null))
  const first = branches[0]
  if (!first || branches.some((b) => b !== first)) return null
  return { ground: first, why: `the branch ${u.holders[0].el.component} draws when its on says it sits on ${first === 'navy' ? 'navy' : 'a light ground'}` }
}

/** The components of the site told their ground by an on prop: one that destructures on with a default of 'navy' or 'light', or with a type that names 'navy'. */
function onPropComponents(tree: Tree): Map<string, OnProp> {
  const out = new Map<string, OnProp>()
  for (const parsed of tree.files.values()) {
    const visit = (n: ts.Node) => {
      const name = ts.isFunctionLike(n) ? componentNameOf(n) : null
      const first = name && ts.isFunctionLike(n) ? n.parameters[0] : undefined
      if (name && first && ts.isObjectBindingPattern(first.name)) {
        const on = first.name.elements.find((b) => (b.propertyName ?? b.name).getText(parsed.sf) === 'on')
        const dflt = on?.initializer && ts.isStringLiteralLike(on.initializer) ? on.initializer.text : null
        const typed = /\bon\??\s*:\s*[^;,}]*['"]navy['"]/.test(first.type?.getText(parsed.sf) ?? '')
        if (on && (dflt === 'navy' || dflt === 'light' || typed)) out.set(`${parsed.file} ${name}`, { file: parsed.file, name, dflt })
      }
      ts.forEachChild(n, visit)
    }
    visit(parsed.sf)
  }
  return out
}

/**
 * The objects a style attribute takes, each with the elements whose style
 * takes it: written in place, held in a constant or in a property of one,
 * cast, chosen by ?:, or spread into another.
 */
function styleObjects(parsed: ParsedFile): Map<ts.Node, Element[]> {
  const out = new Map<ts.Node, Element[]>()
  const add = (e: ts.Expression | undefined, el: Element | null, depth = 0) => {
    if (!e || depth > 6) return
    if (ts.isObjectLiteralExpression(e)) {
      const els = out.get(e) ?? []
      if (el && !els.includes(el)) els.push(el)
      out.set(e, els)
      for (const p of e.properties) if (ts.isSpreadAssignment(p)) add(p.expression, el, depth + 1)
    } else if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) add(e.expression, el, depth + 1)
    else if (ts.isConditionalExpression(e)) {
      add(e.whenTrue, el, depth + 1)
      add(e.whenFalse, el, depth + 1)
    } else if (ts.isIdentifier(e)) add(initializerOf(e), el, depth + 1)
    else if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression)) {
      const holder = initializerOf(e.expression)
      const prop = holder && ts.isObjectLiteralExpression(holder) ? holder.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && p.name.getText().replace(/['"]/g, '') === e.name.text) : undefined
      add(prop?.initializer, el, depth + 1)
    }
  }
  const visit = (n: ts.Node) => {
    if (ts.isJsxAttribute(n) && n.name.getText(parsed.sf) === 'style' && n.initializer && ts.isJsxExpression(n.initializer)) add(n.initializer.expression, elementAt(parsed, n.getStart(parsed.sf)))
    ts.forEachChild(n, visit)
  }
  visit(parsed.sf)
  return out
}

/** A WS02 text use in its context: beside its label, at its size or more, on its ground. */
function inContext(use: HexUse, w: Ws02GoldEntry): boolean {
  const words = [use.el, use.el?.parent].some((n) => !!n && !!w.label && n.text.includes(w.label))
  const big = fontPx(use.el) >= (w.minPx ?? 0)
  const ground = !w.ground || hexGrounds(use.el).includes(w.ground)
  return words && big && ground
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Where an import names a file under src, or null. */
function resolveModule(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? `src/${spec.slice(2)}` : spec.startsWith('.') ? join(dirname(from), spec) : null
  if (!base) return null
  return [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`].find((f) => { try { read(f); return true } catch { return false } }) ?? null
}

/** The page file each heritage route draws, read from src/App.tsx. */
function heritagePages(): string[] {
  const app = read('src/App.tsx')
  return HERITAGE_ROUTES.map((route) => {
    const page = app.match(new RegExp(`<Route path="${route}" element=\\{<(\\w+) />\\}`))?.[1]
    const spec = page ? app.match(new RegExp(`const ${page} = lazy\\(\\(\\) => import\\('([^']+)'\\)`))?.[1] : undefined
    const file = spec ? resolveModule('src/App.tsx', spec) : null
    if (!file) throw new Error(`no page found for ${route} in src/App.tsx`)
    return file
  })
}

// ── On the tree ────────────────────────────────────────────────────────────

describe('the gold guard on the tree', () => {
  const result = goldGuard(ROOT)

  it('finds no gold text on a light ground, no gold-ink on navy, and no heritage or dark gold out of its place', () => {
    expect(result.problems).toEqual([])
  })

  it('places every gold text class: text-lca-gold only on navy or dark grounds, or by an allowlist entry; text-gold-ink only on light ones', () => {
    const uses = goldUses(result.tree)
    const gold = uses.filter((u) => u.utility === GOLD)
    const ink = uses.filter((u) => u.utility === GOLD_INK)
    // 53 brand gold classes in 21 files: 51 on navy or a dark ground, and the 2 the reading cannot place, in the allowlist.
    expect(gold).toHaveLength(53)
    expect(new Set(gold.map((u) => u.file)).size).toBe(21)
    expect(gold.filter((u) => u.ground === 'navy')).toHaveLength(51)
    expect(gold.filter((u) => u.ground === 'unplaced').map((u) => `${u.file}:${u.line}`)).toEqual(['src/components/StatusBadge.tsx:28', 'src/pages/TournamentDetailPage.tsx:39'])
    expect(gold.filter((u) => u.ground === 'light')).toEqual([])
    // Every text-gold-ink is on a light ground: the 82 step 25 wrote, and the word beside the News page's pin under the new look.
    expect(ink.length).toBe(83)
    expect(ink.filter((u) => u.ground !== 'light')).toEqual([])
    expect(result.plan.kept.filter((k) => k.by === 'allowlist')).toHaveLength(GOLD_ALLOWLIST.reduce((n, e) => n + e.count, 0))
  })

  it('finds no brand gold hex text class, and no style colour or icon paint that can be brand gold: a club\'s colour as words goes through clubTextColor', () => {
    expect(result.hexText).toEqual([])
    expect(result.styleGold).toEqual([])
    expect(result.stylePill).toEqual([])
    // clubTextColor gives the gold-ink token for brand gold, and each of the five sits on a light ground.
    expect(result.styleInk).toEqual([
      'src/pages/AdminClubPage.tsx:406 the style colour color: clubTextColor(color) -> light',
      'src/pages/ClubDetailPage.tsx:239 the style colour color: textColor -> light',
      'src/pages/ClubDetailPage.tsx:293 the style colour color: textColor -> light',
      'src/pages/ClubDetailPage.tsx:335 the style colour color: textColor -> light',
      'src/pages/ClubsPage.tsx:74 the style colour color: clubTextColor(club.color) -> light',
    ])
    // The five places a club's colour is words, which were brand gold for a club that had not picked a colour.
    expect(read('src/pages/ClubDetailPage.tsx').match(/style=\{\{ color: textColor \}\}/g)).toHaveLength(3)
    expect(read('src/pages/ClubDetailPage.tsx')).toContain('const textColor = clubTextColor(club.color)')
    expect(read('src/pages/ClubsPage.tsx')).toContain('style={{ color: clubTextColor(club.color) }}')
    expect(read('src/pages/AdminClubPage.tsx')).toContain('color: clubTextColor(color),')
  })

  it('places every badge and pill token on its kind of ground: a badge\'s dark gold on light grounds, a pill\'s light gold on navy, each branch of the filter dropdowns by its on, and 12 uses by an entry', () => {
    const of = (gold: 'ink' | 'pill', ground: Ground) => result.badgeUses.filter((b) => tokenGold(b.use.utility) === gold && b.ground === ground).map((b) => `${b.use.file}:${b.use.line}`)
    // 28 dark gold words and the club badge's, and 5 pills.
    expect(result.badgeUses).toHaveLength(34)
    expect(of('ink', 'light')).toHaveLength(18)
    expect(of('ink', 'navy')).toEqual([])
    expect(of('pill', 'light')).toEqual([])
    expect(of('pill', 'navy')).toEqual(['src/components/FilterDropdown.tsx:47', 'src/components/MultiSelectDropdown.tsx:59', 'src/components/PageHero.tsx:84', 'src/pages/ContactPage.tsx:61'])
    // What the reading cannot place is the badge allowlist's, use for use: the tags in objects of strings and the home hero's pill.
    const unplaced = result.badgeUses.filter((b) => b.ground === 'unplaced').map((b) => `${b.use.file} ${b.use.token}`)
    expect(unplaced.sort()).toEqual(GOLD_BADGE_ALLOWLIST.flatMap((e) => Array.from({ length: e.count }, () => `${e.file} ${e.class}`)).sort())
    // The filter dropdowns: each branch on the ground its on names, wherever the component is drawn today.
    const use = (file: string, line: number) => result.badgeUses.find((b) => b.use.file === file && b.use.line === line)!
    for (const [file, navy, light] of [['src/components/FilterDropdown.tsx', 47, 50], ['src/components/MultiSelectDropdown.tsx', 59, 62]] as const) {
      expect(use(file, navy).ground, file).toBe('navy')
      expect(use(file, light).ground, file).toBe('light')
      expect(use(file, light).why, file).toContain('when its on says it sits on a light ground')
    }
  })

  it('finds every place a component told its ground by on is drawn giving the on its ground needs', () => {
    // Since step 26 the fixture page also draws StatusBadge's status path,
    // a tag for every status and two with words of their own, each with
    // on="light", the only on its type takes. Since step 31 the heritage
    // pages draw ThickThinRule, whose on says its ground, light (its
    // default) or a navy band; each is drawn on a light ground.
    expect([...result.onPlaces].sort()).toEqual([
      'src/areas/governance/components/GovLayout.tsx:93 <ThickThinRule> on=light (its default) -> light',
      'src/pages/AboutPage.tsx:47 <ThickThinRule> on=light (its default) -> light',
      'src/pages/AdminEmailPage.tsx:379 <MultiSelectDropdown> on=light (its default) -> light',
      'src/pages/AdminEmailPage.tsx:380 <MultiSelectDropdown> on=light (its default) -> light',
      'src/pages/AdminEmailPage.tsx:386 <MultiSelectDropdown> on=light (its default) -> light',
      'src/pages/AnnualMeetingPage.tsx:135 <ThickThinRule> on=light (its default) -> light',
      'src/pages/BoardPage.tsx:334 <ThickThinRule> on=light (its default) -> light',
      'src/pages/BoardPage.tsx:390 <ThickThinRule> on=light (its default) -> light',
      'src/pages/BylawsPage.tsx:25 <ThickThinRule> on=light (its default) -> light',
      'src/pages/BylawsPage.tsx:27 <ThickThinRule> on=light (its default) -> light',
      'src/pages/BylawsPage.tsx:31 <ThickThinRule> on=light (its default) -> light',
      'src/pages/ChampionsPage.tsx:117 <ThickThinRule> on=light (its default) -> light',
      'src/pages/ChampionsPage.tsx:66 <ThickThinRule> on=light (its default) -> light',
      'src/pages/ChampionsPage.tsx:96 <ThickThinRule> on=light (its default) -> light',
      'src/pages/MinutesPage.tsx:21 <ThickThinRule> on=light (its default) -> light',
      'src/pages/ScholasticPage.tsx:69 <StatusBadge> on=light -> light',
      'src/pages/TournamentsPage.tsx:555 <FilterDropdown> on=navy -> navy',
      'src/pages/fixtures/ScopeFixturePage.tsx:114 <StatusBadge> on=light -> light',
      'src/pages/fixtures/ScopeFixturePage.tsx:115 <StatusBadge> on=light -> light',
      'src/pages/fixtures/ScopeFixturePage.tsx:116 <StatusBadge> on=light -> light',
      'src/pages/fixtures/ScopeFixturePage.tsx:213 <StatusBadge> on=light -> light',
      'src/pages/fixtures/ScopeFixturePage.tsx:217 <StatusBadge> on=light -> light',
      'src/pages/fixtures/ScopeFixturePage.tsx:218 <StatusBadge> on=light -> light',
    ])
  })

  it('clubTextColor gives the gold-ink token for brand gold, every club\'s colour until it picks one, and for no colour, and a chosen colour as given', () => {
    for (const none of [null, undefined, '', BRAND_GOLD, BRAND_GOLD.toUpperCase(), ` ${BRAND_GOLD} `]) expect(clubTextColor(none), String(none)).toBe('var(--gold-ink)')
    expect(clubTextColor('#1e4d7b')).toBe('#1e4d7b')
    // The database gives every club brand gold until it picks a colour.
    expect(read('migrations/0009_club_colors.sql')).toContain(`DEFAULT '${BRAND_GOLD}'`)
    expect(read('functions/db/schema.ts')).toContain(`color: text().default('${BRAND_GOLD}')`)
  })

  it('the WS02 entries match nothing yet: their parts are not built, and neither gold appears in the code of any TSX file', () => {
    expect(result.ws02Matched).toEqual([])
    for (const w of WS02_GOLD) expect(result.tree.files.has(w.file), w.file).toBe(false)
    for (const parsed of result.tree.files.values()) {
      expect(hexUses(parsed, HERITAGE_GOLD), parsed.file).toEqual([])
      expect(hexUses(parsed, DARK_GOLD), parsed.file).toEqual([])
    }
  })

  it('reads the heritage pages from the routes: the six pages HERITAGE_ROUTES draws', () => {
    expect(heritagePages()).toEqual([
      'src/pages/AboutPage.tsx',
      'src/pages/BoardPage.tsx',
      'src/pages/BylawsPage.tsx',
      'src/pages/MinutesPage.tsx',
      'src/pages/AnnualMeetingPage.tsx',
      'src/pages/ChampionsPage.tsx',
    ])
  })

  it('holds every allowlist entry to its form: a navy ground, a count, a reason in a sentence, a file under src, and a use the reading cannot place', () => {
    for (const e of GOLD_ALLOWLIST) {
      expect(e.ground, e.file).toBe('navy')
      expect(Number.isInteger(e.count) && e.count >= 1, e.file).toBe(true)
      expect(e.reason.length, e.file).toBeGreaterThan(80)
      expect(e.reason).toMatch(/\.$/)
      expect(e.reason).not.toContain('\u2014')
      expect(result.tree.files.has(e.file), e.file).toBe(true)
    }
    for (const w of WS02_GOLD) {
      expect(w.file.startsWith('src/components/layout/'), w.file).toBe(true)
      expect(w.reason).toMatch(/\.$/)
    }
  })

  it('holds every badge allowlist entry to its form: the ground its token is for, a count, a reason in a sentence, a file under src, and for a badge the code that reads it', () => {
    for (const e of GOLD_BADGE_ALLOWLIST) {
      const gold = tokenGold(parseToken(e.class).utility)
      expect(gold, e.file).not.toBeNull()
      expect(e.ground, e.file).toBe(gold === 'ink' ? 'light' : 'dark')
      if (gold === 'ink') expect(e.readBy, e.file).toBeTruthy()
      expect(Number.isInteger(e.count) && e.count >= 1, e.file).toBe(true)
      expect(e.reason.length, e.file).toBeGreaterThan(80)
      expect(e.reason).toMatch(/\.$/)
      expect(e.reason).not.toContain('\u2014')
      expect(result.tree.files.has(e.file), e.file).toBe(true)
    }
  })
})

// ── On a planted tree ──────────────────────────────────────────────────────

describe('the gold guard on a planted tree', () => {
  const work = mkdtempSync(join(tmpdir(), 'gold-guard-'))
  afterAll(() => rmSync(work, { recursive: true, force: true }))
  let n = 0

  function tree(files: Record<string, string>): string {
    const root = join(work, `t${n++}`)
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    return root
  }
  const GOLD_TEXT = c('text-lca', '-gold')
  const HEX_GOLD = c('text-[#', 'c8a94a]')
  const page = (body: string, head = '') => `import { LCA } from '@/lib/brand'\n${head}\nexport function Planted({ club }: { club: { color: string | null } }) {\n  return (\n    <main>\n${body}\n    </main>\n  )\n}\n`
  const guard = (files: Record<string, string>, opts: GuardOptions = {}) => goldGuard(tree(files), { allowlist: [], badges: [], heritage: ['src/pages/HeritagePlanted.tsx'], ...opts }).problems

  it('passes brand gold on navy and on a ground marked dark that has a navy of its own, and gold-ink on a card', () => {
    const body = [
      `      <section className="bg-brand-navy"><p className="${GOLD_TEXT}">On navy</p><span style={{ color: LCA.gold }}>Navy too</span></section>`,
      `      <section style={{ backgroundColor: LCA.navy }} data-ground="dark"><p className="hover:${GOLD_TEXT}">On a club hero</p></section>`,
      `      <div className="${c('bg-[#', '111a2c]')}"><p className="${GOLD_TEXT}">On a hex navy</p></div>`,
      `      <div className="bg-card"><p className="${GOLD_INK}">On a card</p></div>`,
    ].join('\n')
    expect(guard({ 'src/pages/Planted.tsx': page(body) })).toEqual([])
  })

  describe('a ground the reading cannot place: the home page hero\'s darkened photo, and a hex ground on which neither gold reads 4.5:1', () => {
    // data-ground="dark" marks a dark ground for the focus ring, not a
    // colour. The home page hero carries it on its outer element, with the
    // photo, darkened by a filter, and its navy veil as siblings of the words:
    // brand gold reads 4.29:1 at the photo's lightest and 3.14:1 on a gold
    // tint there. A hex ground stays put in every look, and brand gold reads
    // 3.58:1 on the urgent banner's red and 1.86:1 on Facebook's blue. Each
    // form of brand gold there fails, and so does gold-ink.
    const hero = (inner: string) => [
      '      <div className="relative overflow-hidden" style={{ height: 420 }} data-ground="dark">',
      "        <div className=\"absolute inset-0 bg-cover bg-center\" style={{ backgroundImage: 'url(/hero.jpg)', filter: 'brightness(0.55)' }} />",
      '        <div className="absolute inset-0 bg-brand-navy/55 mix-blend-multiply" />',
      `        <div className="absolute inset-0 flex flex-col items-center justify-end text-white">${inner}</div>`,
      '      </div>',
    ].join('\n')
    const words = "Louisiana's chess community since 1915"

    it.each([
      ['brand gold words on the hero', hero(`<p className="text-sm ${GOLD_TEXT}">${words}</p>`), 'data-ground="dark" on <div> (line 6) with no navy of its own'],
      ['brand gold as a hex text class on the hero', hero(`<p className="text-sm ${HEX_GOLD}">${words}</p>`), 'is brand gold as text on a ground no one has placed'],
      ['a style colour of LCA.gold on the hero', hero(`<p className="text-sm" style={{ color: LCA.gold }}>${words}</p>`), 'can be brand gold, as text on a ground no one has placed'],
      ['gold-ink on the hero', hero(`<p className="text-sm ${GOLD_INK}">${words}</p>`), 'sits on a ground this script cannot place'],
      ['brand gold words on the urgent banner\'s red', `      <div className="${c('bg-[#', '9b1c1c]')}"><p className="${GOLD_TEXT}">Words</p></div>`, 'brand gold 3.58:1 and the dark gold 1.59:1 on #9b1c1c'],
      ['brand gold words on Facebook\'s blue', `      <div className="${c('bg-[#', '1877f2]')}"><p className="${GOLD_TEXT}">Words</p></div>`, 'brand gold 1.86:1 and the dark gold 1.21:1 on #1877f2'],
      ['gold-ink on the urgent banner\'s red', `      <div className="${c('bg-[#', '9b1c1c]')}"><p className="${GOLD_INK}">Words</p></div>`, 'sits on a ground this script cannot place'],
    ])('fails on %s', (_, body, message) => {
      const problems = guard({ 'src/pages/Planted.tsx': page(body) })
      expect(problems).toHaveLength(1)
      expect(problems[0]).toMatch(/^src\/pages\/Planted\.tsx:\d+ /)
      expect(problems[0]).toContain(message)
    })

    it('brand gold on the hero passes only with an allowlist entry, a person\'s decision with its reason', () => {
      const files = { 'src/pages/Planted.tsx': page(hero(`<p className="text-sm ${GOLD_TEXT}">${words}</p>`)) }
      expect(guard(files)[0]).toContain('A person decides')
      const entry: GoldAllowEntry = { file: 'src/pages/Planted.tsx', class: GOLD_TEXT, count: 1, ground: 'navy', reason: 'A planted use on a darkened photo, measured for this test only: a person decides it with the ratio it reads.' }
      expect(guard(files, { allowlist: [entry] })).toEqual([])
    })
  })

  it.each([
    ['text-lca-gold on a card', `      <div className="bg-card"><p className="${GOLD_TEXT}">x</p></div>`, 'left to rewrite: text-lca-gold -> text-gold-ink'],
    ['text-lca-gold on the page', `      <p className="${GOLD_TEXT}">x</p>`, 'left to rewrite'],
    ['brand gold as a hex text class on a card', `      <div className="bg-card"><p className="${HEX_GOLD}">x</p></div>`, 'is brand gold as text on a light ground'],
    ['brand gold as a hex text class in capitals, behind a variant', `      <p className="${c('hover:text-[#', 'C8A94A]')}">x</p>`, 'is brand gold as text on a light ground'],
    ['brand gold as text with a type hint', `      <p className="${c('text-[color:#', 'c8a94a]')}">x</p>`, 'is brand gold as text'],
    ['brand gold as an arbitrary property', `      <p className="${c('[color:#', 'c8a94a]')}">x</p>`, 'is brand gold as text'],
    ['a style colour of #c8a94a on a card', `      <div className="bg-card"><p style={{ color: '${c('#c8', 'a94a')}' }}>x</p></div>`, 'can be brand gold, as text on a light ground'],
    ['a style colour of LCA.gold', `      <p style={{ color: LCA.gold }}>x</p>`, 'can be brand gold'],
    ['a club colour that falls back to brand gold', `      <p style={{ color: club.color || LCA.gold }}>x</p>`, 'can be brand gold'],
    ['a club\'s own colour as words, which is brand gold until the club picks one', `      <div className="bg-card"><p style={{ color: club.color }}>x</p></div>`, 'can be brand gold'],
    ['gold-ink on navy', `      <section className="bg-brand-navy"><p className="${GOLD_INK}">x</p></section>`, 'sits on a navy ground'],
  ])('fails on %s', (_, body, message) => {
    const problems = guard({ 'src/pages/Planted.tsx': page(body) })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^src\/pages\/Planted\.tsx:\d+ /)
    expect(problems[0]).toContain(message)
  })

  it('follows a constant to the style colour, and a club colour bound in its own function', () => {
    const head = `const GOLD = LCA.gold\nfunction Initials({ club }: { club: { color: string | null } }) {\n  const color = club.color || GOLD\n  return <span style={{ color }}>AB</span>\n}`
    const problems = guard({ 'src/pages/Planted.tsx': page(`      <div className="bg-card"><Initials club={club} /><p style={{ color: GOLD }}>x</p></div>`, head) })
    expect(problems).toHaveLength(2)
    // The club colour through clubTextColor passes, and so does a style that is not a colour of words.
    const ok = `function Initials({ club }: { club: { color: string | null } }) {\n  return <span style={{ color: clubTextColor(club.color), borderColor: club.color ?? LCA.gold }}>AB</span>\n}`
    expect(guard({ 'src/pages/Planted.tsx': page('      <div className="bg-card"><Initials club={club} /></div>', ok) })).toEqual([])
    // An object with a colour that no style attribute takes (a club's data, a form's state) is not text.
    const data = `const FORM = { name: '', color: LCA.gold }`
    expect(guard({ 'src/pages/Planted.tsx': page('      <p>{FORM.name}</p>', data) })).toEqual([])
  })

  it('fails on brand gold in HTML a page builds as a string, through a value or written out', () => {
    const head = `const html = (name: string) => \`<p style="color:\${LCA.gold}">\${name}</p>\``
    const problems = guard({ 'src/pages/Planted.tsx': page('      <p>x</p>', head) })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('HTML built as a string colours its text brand gold')
    const written = `const NOTE = '<p style="font-size:12px;${c('color:#', 'c8a94a')}">Note</p>'`
    const more = guard({ 'src/pages/Planted.tsx': page('      <p>x</p>', written) })
    expect(more).toHaveLength(1)
    expect(more[0]).toContain('CSS in a string colours its text brand gold')
  })

  it('follows a component to where it is drawn: on navy it passes, on a card it fails', () => {
    const head = `function Label() {\n  return <span className="${GOLD_TEXT}">x</span>\n}`
    expect(guard({ 'src/pages/Planted.tsx': page('      <section className="bg-brand-navy"><Label /></section>', head) })).toEqual([])
    expect(guard({ 'src/pages/Planted.tsx': page('      <div className="bg-card"><Label /></div>', head) })).toHaveLength(1)
  })

  it('a class the reading cannot place fails without an entry, passes with one, and an entry with the wrong count fails', () => {
    const head = `const TONE = { gold: '${GOLD_TEXT}' }`
    const files = { 'src/pages/Planted.tsx': page('      <p>x</p>', head) }
    const unplaced = guard(files)
    expect(unplaced).toHaveLength(1)
    expect(unplaced[0]).toContain('a string no className reads in its file')
    const entry: GoldAllowEntry = { file: 'src/pages/Planted.tsx', class: GOLD_TEXT, count: 1, ground: 'navy', reason: 'A planted tone on a navy surface, allowed for this test only.' }
    expect(guard(files, { allowlist: [entry] })).toEqual([])
    expect(guard(files, { allowlist: [{ ...entry, count: 2 }] })[0]).toContain('set its count')
  })

  it('#705718 passes on a heritage page and fails anywhere else', () => {
    const hex = c('text-[#', '705718]')
    expect(guard({ 'src/pages/HeritagePlanted.tsx': page(`      <p className="${hex}">x</p>`) })).toEqual([])
    const problems = guard({ 'src/pages/Planted.tsx': page(`      <p className="${hex}">x</p>`) })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('allowed only on the heritage pages')
  })

  it('#866a1e fails as text below 13px anywhere, and as text or a line outside the listed WS02 places', () => {
    const small = guard({ 'src/pages/Planted.tsx': page(`      <p className="text-xs ${c('text-[#', '866a1e]')}">x</p>`) })
    expect(small).toHaveLength(1)
    expect(small[0]).toContain('is text below 13px (12px)')
    const big = guard({ 'src/pages/Planted.tsx': page(`      <p className="text-sm ${c('text-[#', '866a1e]')}">x</p>`) })
    expect(big).toHaveLength(1)
    expect(big[0]).toContain('allowed only as text of 13px or more on the listed #fbfaf6 row')
    const line = guard({ 'src/pages/Planted.tsx': page(`      <p className="${c('border-[#', '866a1e]')}">x</p>`) })
    expect(line).toHaveLength(1)
  })

  describe('the WS02 entries, once their parts are built', () => {
    const about = (cls: string, words = 'You are here') => page(`      <a className="${c('bg-[#', 'f3eedc]')}">Board &amp; regions <span className="${cls}">${words}</span></a>`)
    const sheet = (cls: string, ground: string, words = 'You are here') => page(`      <div className="${ground}"><span className="${cls}">${words}</span></div>`)
    const heritageHex = c('text-[#', '705718]')
    const darkHex = c('text-[#', '866a1e]')

    it('the About menu\'s "You are here" in #705718 at 13px passes, and fails smaller or without its words', () => {
      expect(guard({ 'src/components/layout/AboutMenu.tsx': about(`text-[13px] font-semibold ${heritageHex}`) })).toEqual([])
      expect(guard({ 'src/components/layout/AboutMenu.tsx': about(`text-xs font-semibold ${heritageHex}`) })).toHaveLength(1)
      expect(guard({ 'src/components/layout/AboutMenu.tsx': about(`text-[13px] font-semibold ${heritageHex}`, 'Bylaws') })).toHaveLength(1)
    })

    it('the phone sheet\'s "You are here" in #866a1e at 13px on its #fbfaf6 row passes, and fails smaller or on another ground', () => {
      const row = c('bg-[#', 'fbfaf6]')
      expect(guard({ 'src/components/layout/MobileMenu.tsx': sheet(`text-[13px] font-semibold ${darkHex}`, row) })).toEqual([])
      expect(guard({ 'src/components/layout/MobileMenu.tsx': sheet(`text-xs font-semibold ${darkHex}`, row) })).toHaveLength(1)
      expect(guard({ 'src/components/layout/MobileMenu.tsx': sheet(`text-[13px] font-semibold ${darkHex}`, 'bg-card') })).toHaveLength(1)
    })

    it('the tab bar\'s current tab may draw its top bar in #866a1e, and may not set words in it', () => {
      const bar = c('border-t-[#', '866a1e]')
      expect(guard({ 'src/components/layout/BottomTabs.tsx': page(`      <a aria-current="page" className="border-t-[3px] ${bar} text-ink">Tournaments</a>`) })).toEqual([])
      expect(guard({ 'src/components/layout/BottomTabs.tsx': page(`      <a aria-current="page" className="text-sm ${darkHex}">Tournaments</a>`) })).toHaveLength(1)
      // Brand gold is never the tab's words either.
      expect(guard({ 'src/components/layout/BottomTabs.tsx': page(`      <nav className="bg-surface"><a className="${HEX_GOLD}">Tournaments</a></nav>`) })).toHaveLength(1)
    })
  })
})

// ── The pass on the tree is earned ─────────────────────────────────────────

describe('the gold guard on the tree without its allowlist, and on a copy of the tree with one change planted', () => {
  // The guard passes on the tree. These show the pass is not that of a
  // reader that sees nothing. Without the allowlist exactly its two uses
  // fail, each at its own line, so every other brand gold class left is
  // placed on navy or a dark ground by the reading itself; an entry cannot
  // excuse brand gold the reading places on a light ground. And a copy of
  // every TSX file under src passes as the tree does, while one real use put
  // back as it was before step 25, or moved to the wrong ground, fails with
  // one problem at its own line. The same holds for the badge allowlist, and
  // for a badge or pill put on the wrong ground, a component told the wrong
  // ground by its on, and the rows that read a listed badge moved onto navy.
  // The planted class names are put together when the test runs.
  const work = mkdtempSync(join(tmpdir(), 'gold-guard-copy-'))
  afterAll(() => rmSync(work, { recursive: true, force: true }))
  const files = tsxFiles(ROOT)
  const GOLD_TEXT = c('text-lca', '-gold')
  const HEX_GOLD = c('text-[#', 'c8a94a]')
  let n = 0

  /** A copy of every TSX file under src, with one string of one file changed. */
  function copy(change?: { file: string; from: string; to: string }): string {
    const root = join(work, `c${n++}`)
    for (const file of files) {
      let text = read(file)
      if (change && file === change.file) {
        if (text.split(change.from).length !== 2) throw new Error(`${change.file} should hold ${change.from} exactly once`)
        text = text.replace(change.from, () => change.to)
      }
      mkdirSync(dirname(join(root, file)), { recursive: true })
      writeFileSync(join(root, file), text)
    }
    return root
  }

  it('without the allowlist, exactly its two uses fail, each at its own line, and nothing else', () => {
    const problems = goldGuard(ROOT, { allowlist: [] }).problems
    expect(problems.map((p) => p.split(' ')[0])).toEqual(['src/components/StatusBadge.tsx:28', 'src/pages/TournamentDetailPage.tsx:39'])
    for (const p of problems) expect(p).toContain('A person decides')
    // Each entry takes exactly its own use: without one of them, only that use fails.
    for (const [i, e] of GOLD_ALLOWLIST.entries()) {
      const rest = GOLD_ALLOWLIST.filter((_, j) => j !== i)
      const one = goldGuard(ROOT, { allowlist: rest }).problems
      expect(one, e.file).toHaveLength(1)
      expect(one[0].startsWith(`${e.file}:`), e.file).toBe(true)
    }
  }, 60_000)

  it('without the badge allowlist, exactly its 12 uses fail, and each entry takes exactly its own uses', () => {
    const problems = goldGuard(ROOT, { badges: [] }).problems
    expect(problems).toHaveLength(12)
    for (const p of problems) expect(p).toContain('A person decides: an entry in GOLD_BADGE_ALLOWLIST')
    expect(new Set(problems.map((p) => p.split(':')[0]))).toEqual(new Set(GOLD_BADGE_ALLOWLIST.map((e) => e.file)))
    for (const [i, e] of GOLD_BADGE_ALLOWLIST.entries()) {
      const one = goldGuard(ROOT, { badges: GOLD_BADGE_ALLOWLIST.filter((_, j) => j !== i) }).problems
      expect(one, e.file).toHaveLength(e.count)
      for (const p of one) expect(p.startsWith(`${e.file}:`), p).toBe(true)
    }
  }, 180_000)

  it('a copy of the tree passes, as the tree does', () => {
    expect(goldGuard(copy()).problems).toEqual([])
  }, 60_000)

  it.each([
    [
      'the News page\'s megaphone put back in brand gold on the page',
      { file: 'src/pages/NewsPage.tsx', from: '<Megaphone className="size-4 text-gold-ink" />', to: `<Megaphone className="size-4 ${GOLD_TEXT}" />` },
      'src/pages/NewsPage.tsx:118 ',
      'left to rewrite',
    ],
    [
      'the footer\'s heading moved to gold-ink on its navy',
      { file: 'src/components/layout/Footer.tsx', from: 'tracking-widest text-lca-gold', to: 'tracking-widest text-gold-ink' },
      'src/components/layout/Footer.tsx:94 ',
      'sits on a navy ground',
    ],
    [
      'a club\'s initials put back in the club\'s colour, without clubTextColor',
      { file: 'src/pages/ClubsPage.tsx', from: 'style={{ color: clubTextColor(club.color) }}', to: 'style={{ color }}' },
      'src/pages/ClubsPage.tsx:74 ',
      'can be brand gold, as text on a light ground',
    ],
    [
      'an officer\'s title on a club page in the club\'s colour, without clubTextColor',
      { file: 'src/pages/ClubDetailPage.tsx', from: 'const textColor = clubTextColor(club.color)', to: 'const textColor = color' },
      'src/pages/ClubDetailPage.tsx:',
      'can be brand gold, as text on a light ground',
    ],
    [
      'brand gold as a hex text class on the contact page',
      { file: 'src/pages/ContactPage.tsx', from: '<Mail className="mt-0.5 size-5 flex-shrink-0 text-gold-ink" />', to: `<Mail className="mt-0.5 size-5 flex-shrink-0 ${HEX_GOLD}" />` },
      'src/pages/ContactPage.tsx:126 ',
      'is brand gold as text on a light ground',
    ],
    [
      'a style colour of #c8a94a on the support page',
      { file: 'src/pages/SupportPage.tsx', from: '<MessageSquare className="size-8 mx-auto mb-3 text-gold-ink" />', to: `<MessageSquare className="size-8 mx-auto mb-3" style={{ color: '${c('#c8a9', '4a')}' }} />` },
      'src/pages/SupportPage.tsx:224 ',
      'can be brand gold, as text on a light ground',
    ],
    [
      'a style colour of LCA.gold on the home page',
      { file: 'src/pages/HomePage.tsx', from: '<Trophy className="size-3.5 text-gold-ink" />', to: '<Trophy className="size-3.5" style={{ color: LCA.gold }} />' },
      'src/pages/HomePage.tsx:259 ',
      'can be brand gold, as text on a light ground',
    ],
    [
      'the same trophy given brand gold through its color prop',
      { file: 'src/pages/HomePage.tsx', from: '<Trophy className="size-3.5 text-gold-ink" />', to: '<Trophy className="size-3.5" color={LCA.gold} />' },
      'src/pages/HomePage.tsx:259 ',
      'can be brand gold, as text on a light ground',
    ],
    [
      'the eyebrow pill of PageHero given a badge\'s dark gold on its navy',
      { file: 'src/components/PageHero.tsx', from: 'text-[10px] text-gold-on-dark-badge', to: 'text-[10px] text-gold-ink-badge' },
      'src/components/PageHero.tsx:84 ',
      'sits on a navy ground',
    ],
    [
      'the tournaments filter drawn on its navy hero without on="navy"',
      { file: 'src/pages/TournamentsPage.tsx', from: '              on="navy"\n', to: '' },
      'src/pages/TournamentsPage.tsx:555 ',
      'is drawn with on="light", its default, on a navy ground',
    ],
    [
      'the scholastic page\'s badge told it sits on navy',
      { file: 'src/pages/ScholasticPage.tsx', from: '<StatusBadge tone={status.tone} on="light">', to: '<StatusBadge tone={status.tone} on="navy">' },
      'src/pages/ScholasticPage.tsx:69 ',
      'is drawn with on="navy" on a light ground',
    ],
    [
      'the audit log\'s rows, which read six listed badges, moved onto navy',
      { file: 'src/areas/admin/components/AuditLogPanel.tsx', from: 'rounded-xl border bg-card`}>', to: 'rounded-xl border bg-brand-navy`}>' },
      'src/areas/admin/components/AuditLogPanel.tsx:270 ',
      'reads text-gold-ink-badge through meta.className on a navy ground',
    ],
  ])('fails on %s', (_, change, where, message) => {
    const problems = goldGuard(copy(change)).problems
    // The officer's title, the news date and the contact link all read textColor: one problem each.
    const expected = change.file === 'src/pages/ClubDetailPage.tsx' ? 3 : 1
    expect(problems).toHaveLength(expected)
    for (const p of problems) {
      expect(p.startsWith(where), p).toBe(true)
      expect(p).toContain(message)
    }
  }, 60_000)

  it('an allowlist entry cannot excuse brand gold the reading places on a light ground: the use is still left to rewrite, and the entry is refused', () => {
    const change = { file: 'src/pages/NewsPage.tsx', from: '<Megaphone className="size-4 text-gold-ink" />', to: `<Megaphone className="size-4 ${GOLD_TEXT}" />` }
    const entry: GoldAllowEntry = { file: change.file, class: GOLD_TEXT, count: 1, ground: 'navy', reason: 'A planted entry for a use on the page, for this test only.' }
    const problems = goldGuard(copy(change), { allowlist: [...GOLD_ALLOWLIST, entry] }).problems
    expect(problems).toHaveLength(2)
    expect(problems.filter((p) => p.startsWith('src/pages/NewsPage.tsx:118 ') && p.includes('left to rewrite'))).toHaveLength(1)
    expect(problems.filter((p) => p.startsWith('src/pages/NewsPage.tsx:118 ') && p.includes('is not needed: the script places this use itself'))).toHaveLength(1)
  }, 60_000)
})

describe('the gold guard on more planted forms', () => {
  // The forms brand gold takes on the tree's navy (a hover form, a /90
  // modifier) and the other ways a page can write it, each planted on a light
  // ground in a temporary tree; and the WS02 colours in a style or a comment.
  const work = mkdtempSync(join(tmpdir(), 'gold-guard-more-'))
  afterAll(() => rmSync(work, { recursive: true, force: true }))
  let n = 0
  function tree(files: Record<string, string>): string {
    const root = join(work, `t${n++}`)
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    return root
  }
  const GOLD_TEXT = c('text-lca', '-gold')
  const page = (body: string, head = '') => `import { LCA } from '@/lib/brand'\n${head}\nexport function Planted({ club }: { club: { color: string | null } }) {\n  return (\n    <main>\n${body}\n    </main>\n  )\n}\n`
  const guard = (files: Record<string, string>, opts: GuardOptions = {}) => goldGuard(tree(files), { allowlist: [], badges: [], heritage: ['src/pages/HeritagePlanted.tsx'], ...opts }).problems

  it.each([
    ['a hover form on a card', `      <div className="bg-card"><a className="text-ink ${c('hover:', GOLD_TEXT)}">x</a></div>`],
    ['the /90 form on a card', `      <div className="bg-card"><p className="${GOLD_TEXT}/90">x</p></div>`],
    ['an important form on a card', `      <div className="bg-card"><p className="${GOLD_TEXT}!">x</p></div>`],
    ['a form for one width, on the page', `      <p className="${c('md:', GOLD_TEXT)}">x</p>`],
    ['a group hover form inside a muted panel', `      <div className="group bg-muted"><span className="${c('group-hover:', GOLD_TEXT)}">x</span></div>`],
  ])('fails on brand gold as %s', (_, body) => {
    const problems = guard({ 'src/pages/Planted.tsx': page(body) })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^src\/pages\/Planted\.tsx:6 /)
    expect(problems[0]).toContain('left to rewrite')
  })

  it.each([
    ['a style object held in a constant', '      <div className="bg-card"><p style={PILL}>x</p></div>', 'const PILL = { color: LCA.gold, fontWeight: 600 }'],
    ['a style spread over another', '      <div className="bg-card"><p style={{ ...BASE, color: LCA.gold }}>x</p></div>', 'const BASE = { fontWeight: 600 }'],
    ['a style chosen by ?:', `      <div className="bg-card"><p style={club.color ? { color: club.color } : { color: LCA.gold }}>x</p></div>`, ''],
    ['the literal in capitals', `      <div className="bg-card"><p style={{ color: '${c('#C8A9', '4A')}' }}>x</p></div>`, ''],
    ['the rgb() form', '      <div className="bg-card"><p style={{ color: \'rgb(200, 169, 74)\' }}>x</p></div>', ''],
  ])('fails on brand gold as %s', (_, body, head) => {
    const problems = guard({ 'src/pages/Planted.tsx': page(body, head) })
    expect(problems.length).toBeGreaterThanOrEqual(1)
    for (const p of problems) {
      expect(p).toMatch(/^src\/pages\/Planted\.tsx:\d+ /)
      expect(p).toContain('can be brand gold')
    }
  })

  it.each([
    ['the gold token\'s text utility', c('text-', 'gold')],
    ['the gold-on-dark token\'s text utility', c('text-', 'gold-on-dark')],
  ])('fails on brand gold as %s on a card, whose token is #c8a94a in every look, and passes it on navy', (_, cls) => {
    const token = `--${cls.slice('text-'.length)}`
    const rules = indexCssRules()
    for (const look of [false, true]) for (const dark of [false, true]) {
      expect(rootTokens(rules, { look, dark }).get(token), `${token} look ${look} dark ${dark}`).toBe(BRAND_GOLD)
      for (const scope of ['heritage', 'live', 'scholastic']) expect(scopeTokens(rules, { look, dark }, scope).get(token), `${token} ${scope}`).toBe(BRAND_GOLD)
    }
    expect(guard({ 'src/pages/Planted.tsx': page(`      <section className="bg-brand-navy"><p className="${cls}">On navy</p></section>`) })).toEqual([])
    const problems = guard({ 'src/pages/Planted.tsx': page(`      <div className="bg-card"><p className="${cls}">x</p></div>`) })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^src\/pages\/Planted\.tsx:6 /)
  })

  it.each([
    ['a named import under another name', "import { Label as Mark } from '@/components/Label'", 'export function Label'],
    ['a default import under another name', "import Mark from '@/components/Label'", 'export default function Label'],
  ])('fails on gold-ink in a component drawn on navy through %s, as it does when the name is the same', (_, line, declaration) => {
    const label = `${declaration}() {\n  return <span className="${GOLD_INK}">x</span>\n}\n`
    const same = guard({ 'src/components/Label.tsx': label.replace('export default function', 'export function'), 'src/pages/User.tsx': page('      <section className="bg-brand-navy"><Label /></section>', "import { Label } from '@/components/Label'") })
    expect(same).toHaveLength(1)
    expect(same[0]).toContain('sits on a navy ground')
    const renamed = guard({ 'src/components/Label.tsx': label, 'src/pages/User.tsx': page('      <section className="bg-brand-navy"><Mark /></section>', line) })
    expect(renamed).toHaveLength(1)
    expect(renamed[0]).toContain('sits on a navy ground')
  })

  it('reads the ground a wrapper component paints under its children: brand gold passed into a navy band passes, and gold-ink there fails', () => {
    const band = `import type { ReactNode } from 'react'\nexport function Band({ children }: { children: ReactNode }) {\n  return <section className="bg-brand-navy px-4">{children}</section>\n}\n`
    const use = (cls: string) => page(`      <Band><span className="${cls}">On the band</span></Band>`, "import { Band } from '@/components/Band'")
    expect(guard({ 'src/components/Band.tsx': band, 'src/pages/User.tsx': use(GOLD_TEXT) })).toEqual([])
    const ink = guard({ 'src/components/Band.tsx': band, 'src/pages/User.tsx': use(GOLD_INK) })
    expect(ink).toHaveLength(1)
    expect(ink[0]).toContain('sits on a navy ground')
  })

  it('#705718 as a style colour fails off the heritage pages and passes on one; neither WS02 gold counts in a comment', () => {
    const style = `      <p style={{ color: '${c('#7057', '18')}' }}>x</p>`
    expect(guard({ 'src/pages/HeritagePlanted.tsx': page(style) })).toEqual([])
    const off = guard({ 'src/pages/Planted.tsx': page(style) })
    expect(off).toHaveLength(1)
    expect(off[0]).toContain('allowed only on the heritage pages')
    const head = `// The heritage ink ${c('#7057', '18')} and the dark gold ${c('#866a', '1e')}, named in prose.`
    const body = `      {/* <p className="text-xs ${c('text-[#', '866a1e]')}">old</p> */}\n      <p>x</p>`
    expect(guard({ 'src/pages/Planted.tsx': page(body, head) })).toEqual([])
  })

  it('#866a1e as text below 13px fails by the size an ancestor sets', () => {
    const inherited = guard({ 'src/pages/Planted.tsx': page(`      <div className="text-[11px]"><span className="${c('text-[#', '866a1e]')}">x</span></div>`) })
    expect(inherited).toHaveLength(1)
    expect(inherited[0]).toContain('is text below 13px (11px)')
  })

  it('#866a1e given as a style colour is words, so a small label in it fails as text below 13px', () => {
    const own = guard({ 'src/pages/Planted.tsx': page(`      <p className="text-xs" style={{ color: '${c('#866a', '1e')}' }}>x</p>`) })
    expect(own).toHaveLength(1)
    expect(own[0]).toContain('is text below 13px (12px)')
  })

  it('the phone tab bar may draw its current tab\'s bar in #866a1e, and may not set its words in it through a style colour', () => {
    const bar = guard({ 'src/components/layout/BottomTabs.tsx': page(`      <a aria-current="page" className="border-t-[3px] text-[11px] text-ink" style={{ borderTopColor: '${c('#866a', '1e')}' }}>Tournaments</a>`) })
    expect(bar).toEqual([])
    const words = guard({ 'src/components/layout/BottomTabs.tsx': page(`      <a aria-current="page" className="text-[11px]" style={{ color: '${c('#866a', '1e')}' }}>Tournaments</a>`) })
    expect(words).toHaveLength(1)
    expect(words[0]).toContain('is text below 13px (11px)')
  })

  it('#866a1e as a style colour chosen by ?: or given as a fallback is words too', () => {
    const head = 'const picked: string | null = null'
    const chosen = guard({ 'src/pages/Planted.tsx': page(`      <p className="text-xs" style={{ color: picked ? 'inherit' : '${c('#866a', '1e')}' }}>x</p>`, head) })
    expect(chosen).toHaveLength(1)
    expect(chosen[0]).toContain('is text below 13px (12px)')
    const fallback = guard({ 'src/pages/Planted.tsx': page(`      <p className="text-xs" style={{ color: picked ?? '${c('#866a', '1e')}' }}>x</p>`, head) })
    expect(fallback).toHaveLength(1)
    expect(fallback[0]).toContain('is text below 13px (12px)')
  })

  it.each([
    ['a Card', 'Card'],
    ['a sheet', 'SheetContent'],
    ['a dialog', 'DialogContent'],
  ])('reads the navy given to %s before the light ground it paints: gold-ink inside fails, brand gold passes, and with no ground given it is light', (_, tag) => {
    const given = (cls: string) => page(`      <${tag} className="bg-brand-navy text-white"><span className="${cls}">x</span></${tag}>`)
    const ink = guard({ 'src/pages/Planted.tsx': given(GOLD_INK) })
    expect(ink).toHaveLength(1)
    expect(ink[0]).toContain('sits on a navy ground')
    expect(guard({ 'src/pages/Planted.tsx': given(GOLD_TEXT) })).toEqual([])
    // Given no ground, it paints its own light one, whatever is around it.
    const plain = guard({ 'src/pages/Planted.tsx': page(`      <section className="bg-brand-navy"><${tag}><span className="${GOLD_TEXT}">x</span></${tag}></section>`) })
    expect(plain).toHaveLength(1)
    expect(plain[0]).toContain('left to rewrite')
  })

  it.each([
    ['a token\'s variable in brackets', c('text-[var(--', 'gold)]')],
    ['a token\'s variable in parentheses', c('text-(--gold', '-on-dark)')],
    ['the brand colour\'s variable with a type hint', c('text-[color:var(--color-lca', '-gold)]')],
    ['the rgb() form in a class', c('text-[rgb(200,169,', '74)]')],
  ])('fails on brand gold as %s on a card, and passes it on navy', (_, cls) => {
    expect(guard({ 'src/pages/Planted.tsx': page(`      <section className="bg-brand-navy"><p className="${cls}">On navy</p></section>`) })).toEqual([])
    const problems = guard({ 'src/pages/Planted.tsx': page(`      <div className="bg-card"><p className="${cls}">x</p></div>`) })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('is brand gold as text on a light ground')
  })

  it('an allowlist entry for brand gold in another form that the uses do not take in full fails, as the codemod\'s entries do', () => {
    const cls = c('text-[#', 'c8a94a]')
    const entry: GoldAllowEntry = { file: 'src/pages/Planted.tsx', class: cls, count: 1, ground: 'navy', reason: 'A planted tone on a navy surface, allowed for this test only.' }
    const files = { 'src/pages/Planted.tsx': page('      <p>x</p>', `const TONE = { gold: '${cls}' }`) }
    expect(guard(files)).toHaveLength(1)
    expect(guard(files, { allowlist: [entry] })).toEqual([])
    const over = guard(files, { allowlist: [{ ...entry, count: 2 }] })
    expect(over).toHaveLength(1)
    expect(over[0]).toContain('allows 1 more use(s) than the guard needs')
  })
})

describe('the gold guard on an icon\'s paint, the token variables, and the gold tokens of one kind of ground', () => {
  // Brand gold given to a lucide icon through its color prop, which lucide
  // draws as the icon's stroke, or written out there, and brand gold as a
  // token's variable in a style, each on a card; then an icon's fill and
  // stroke, an SVG shape's, a colour passed into a component of the site,
  // the gold-ink and pill tokens as style colours, and the badge and pill
  // tokens as classes: inside a wrapper component that paints navy, in a
  // component drawn on navy under another name, in each branch of a
  // component told its ground by on, drawn with an on that does not name its
  // ground, and in an object of strings with and without an entry.
  const work = mkdtempSync(join(tmpdir(), 'gold-guard-paint-'))
  afterAll(() => rmSync(work, { recursive: true, force: true }))
  let n = 0
  function tree(files: Record<string, string>): string {
    const root = join(work, `t${n++}`)
    for (const [path, text] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true })
      writeFileSync(join(root, path), text)
    }
    return root
  }
  const GOLD_HEX = c('#c8', 'a94a')
  const BADGE = 'text-gold-ink-badge'
  const PILL = 'text-gold-on-dark-badge'
  const page = (body: string, head = '') =>
    `import { Star, Trophy } from 'lucide-react'\nimport { LCA } from '@/lib/brand'\nimport { clubTextColor } from '@/areas/clubs/clubColors'\n${head}\nexport function Planted({ club }: { club: { color: string | null } }) {\n  return (\n    <main>\n${body}\n    </main>\n  )\n}\n`
  const guard = (files: Record<string, string>, opts: GuardOptions = {}) => goldGuard(tree(files), { allowlist: [], badges: [], heritage: [], ...opts }).problems
  const one = (body: string, head = '') => guard({ 'src/pages/Planted.tsx': page(body, head) })

  it.each([
    ['a lucide icon given LCA.gold through its color prop', '      <div className="bg-card"><p><Trophy className="size-4" color={LCA.gold} /> Champions</p></div>', ''],
    ['a lucide icon given the hex through its color prop', `      <div className="bg-card"><p><Trophy className="size-4" color="${GOLD_HEX}" /> Champions</p></div>`, ''],
    ['a style colour of var(--gold)', "      <div className=\"bg-card\"><p style={{ color: 'var(--gold)' }}>Champions</p></div>", ''],
    ['a style colour of the brand colour\'s variable', `      <div className="bg-card"><p style={{ color: '${c('var(--col', 'or-lca-gold)')}' }}>Champions</p></div>`, ''],
    ['a style colour of var(--gold-on-dark) with a fallback', "      <div className=\"bg-card\"><p style={{ color: 'var(--gold-on-dark, #fff)' }}>Champions</p></div>", ''],
    ['a lucide icon\'s fill', '      <div className="bg-card"><p><Star className="size-4" fill={LCA.gold} /> Rated</p></div>', ''],
    ['a lucide icon\'s stroke', '      <div className="bg-card"><p><Star className="size-4" stroke={LCA.gold} /> Rated</p></div>', ''],
    ['an SVG shape\'s fill', `      <div className="bg-card"><svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="${GOLD_HEX}" /></svg></div>`, ''],
    ['an SVG\'s fill in its style', '      <div className="bg-card"><svg viewBox="0 0 8 8" style={{ fill: LCA.gold }}><circle cx="4" cy="4" r="4" /></svg></div>', ''],
    ['an icon held in a variable, given LCA.gold', '      <div className="bg-card"><p><Icon className="size-4" color={LCA.gold} /> Champions</p></div>', 'const Icon = Trophy'],
    ['a template of LCA.gold', '      <div className="bg-card"><p style={{ color: `${LCA.gold}` }}>Champions</p></div>', ''],
    ['a club\'s colour with two hex digits of alpha after it', '      <div className="bg-card"><p style={{ color: `${club.color}cc` }}>Champions</p></div>', ''],
    ['LCA[\'gold\']', "      <div className=\"bg-card\"><p style={{ color: LCA['gold'] }}>Champions</p></div>", ''],
    ['a style spread from a constant', '      <div className="bg-card"><p style={{ ...PILL }}>Champions</p></div>', 'const PILL = { color: LCA.gold }'],
    ['a style in a property of a constant', '      <div className="bg-card"><p style={STYLES.pill}>Champions</p></div>', 'const STYLES = { pill: { color: LCA.gold } }'],
  ])('fails on brand gold as %s', (_, body, head) => {
    const problems = one(body, head)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^src\/pages\/Planted\.tsx:\d+ /)
    expect(problems[0]).toContain('can be brand gold, as text on a light ground')
  })

  it('places a style held in a constant, spread from one or read from a property of one by the element whose style takes it: on navy it passes', () => {
    const head = 'const PILL = { color: LCA.gold }\nconst STYLES = { pill: { color: LCA.gold } }'
    expect(one('      <section className="bg-brand-navy"><p style={PILL}>Champions</p><p style={{ ...PILL }}>Champions</p><p style={STYLES.pill}>Champions</p></section>', head)).toEqual([])
    // The same constant taken by an element on a card as well fails there, once.
    const both = one('      <section className="bg-brand-navy"><p style={PILL}>Champions</p></section>\n      <div className="bg-card"><p style={PILL}>Champions</p></div>', head)
    expect(both).toHaveLength(1)
    expect(both[0]).toContain('can be brand gold, as text on a light ground')
  })

  it('passes the same paint on navy', () => {
    const body = `      <section className="bg-brand-navy"><p><Trophy className="size-4" color={LCA.gold} /> Champions</p><p style={{ color: 'var(--gold)' }}>Champions</p><svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill={LCA.gold} /></svg></section>`
    expect(one(body)).toEqual([])
  })

  it.each([
    ['into an icon it draws', 'function Mark({ tint }: { tint: string }) {\n  return <Trophy className="size-4" color={tint} />\n}', '<Mark tint={LCA.gold} />'],
    ['into its words', 'function Name({ color }: { color: string }) {\n  return <span style={{ color }}>AB</span>\n}', '<Name color={LCA.gold} />'],
    ['through its props', 'function Name(props: { tone: string }) {\n  return <span style={{ color: props.tone }}>AB</span>\n}', '<Name tone={LCA.gold} />'],
    ['onto an icon it spreads its props over', 'function Mark(props: { color?: string }) {\n  return <Trophy className="size-4" {...props} />\n}', '<Mark color={LCA.gold} />'],
    ['as its default', 'function Mark({ tint = LCA.gold }: { tint?: string }) {\n  return <Trophy className="size-4" color={tint} />\n}', '<Mark />'],
  ])('follows brand gold passed into a component of the site %s: on a card it fails, on navy it passes', (_, head, use) => {
    const card = one(`      <div className="bg-card">${use} Champions</div>`, head)
    expect(card).toHaveLength(1)
    expect(card[0]).toContain('can be brand gold, as text on a light ground')
    expect(one(`      <section className="bg-brand-navy">${use} Champions</section>`, head)).toEqual([])
  })

  it('passes a colour a component of the site takes only for a ground, as the club page\'s rows take the club\'s colour, and a colour that is not gold', () => {
    const row = 'function Row({ color }: { color: string }) {\n  return <li style={{ backgroundColor: color }}>Spring Open</li>\n}'
    expect(one('      <ul className="bg-card"><Row color={LCA.gold} /></ul>', row)).toEqual([])
    const name = 'function Name(props: { tone: string }) {\n  return <span style={{ color: props.tone }}>AB</span>\n}'
    expect(one(`      <div className="bg-card"><Name tone="${c('#1e4d', '7b')}" /></div>`, name)).toEqual([])
  })

  it('reads a colour a callback is handed under a club colour\'s name as a club\'s colour', () => {
    const head = 'const clubs: Array<{ name: string; color: string }> = []'
    const problems = one('      <div className="bg-card">{clubs.map(({ name, color }) => <span key={name} style={{ color }}>{name}</span>)}</div>', head)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('can be brand gold, as text on a light ground')
  })

  it.each([
    ['clubTextColor on navy, which gives the gold-ink token for brand gold', '      <section className="bg-brand-navy"><p style={{ color: clubTextColor(club.color) }}>Officers</p></section>', 'can be the gold of a token for a light ground'],
    ['the gold-ink variable on navy', "      <section className=\"bg-brand-navy\"><p style={{ color: 'var(--gold-ink)' }}>Officers</p></section>", 'can be the gold of a token for a light ground'],
    ['a badge token\'s variable on navy', `      <section className="bg-brand-navy"><p style={{ color: '${c('var(--col', 'or-gold-ink-badge)')}' }}>Opens soon</p></section>`, 'can be the gold of a token for a light ground'],
    ['the pill\'s variable on a card', "      <div className=\"bg-card\"><p style={{ color: 'var(--gold-on-dark-badge)' }}>Since 1915</p></div>", 'is a pill\'s light gold'],
  ])('fails on %s', (_, body, message) => {
    const problems = one(body)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^src\/pages\/Planted\.tsx:\d+ /)
    expect(problems[0]).toContain(message)
  })

  it('passes clubTextColor and the gold-ink variable on a card, and the pill\'s variable on navy', () => {
    const body = [
      "      <div className=\"bg-card\"><p style={{ color: clubTextColor(club.color) }}>Officers</p><p style={{ color: 'var(--gold-ink)' }}>Officers</p></div>",
      "      <section className=\"bg-brand-navy\"><p style={{ color: 'var(--gold-on-dark-badge)' }}>Since 1915</p></section>",
    ].join('\n')
    expect(one(body)).toEqual([])
  })

  const band = "import type { ReactNode } from 'react'\nexport function Band({ children }: { children: ReactNode }) {\n  return <section className=\"bg-brand-navy px-4\">{children}</section>\n}\n"
  const inBand = (cls: string) => page(`      <Band><span className="text-xs ${cls}">Opens soon</span></Band>`, "import { Band } from '@/components/Band'")

  it('fails on a badge\'s dark gold passed into a wrapper component that paints navy, and passes a pill there', () => {
    const problems = guard({ 'src/components/Band.tsx': band, 'src/pages/User.tsx': inBand(BADGE) })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^src\/pages\/User\.tsx:\d+ text-gold-ink-badge sits on a navy ground/)
    expect(guard({ 'src/components/Band.tsx': band, 'src/pages/User.tsx': inBand(PILL) })).toEqual([])
  })

  it.each([
    ['a badge\'s dark gold on a navy band', `      <section className="bg-brand-navy"><span className="text-xs ${BADGE}">Opens soon</span></section>`, 'sits on a navy ground'],
    ['the club badge\'s dark gold on a navy band', `      <section className="bg-brand-navy"><span className="text-xs ${BADGE}-club">Upcoming</span></section>`, 'sits on a navy ground'],
    ['a badge token\'s variable in a class, on a navy band', `      <section className="bg-brand-navy"><span className="text-xs ${c('text-[var(--gold-ink', '-badge)]')}">Opens soon</span></section>`, 'sits on a navy ground'],
    ['gold-ink\'s variable in a class, on a navy band', `      <section className="bg-brand-navy"><span className="text-xs ${c('text-(--gold', '-ink)')}">Opens soon</span></section>`, 'sits on a navy ground'],
    ['a pill\'s light gold on a card', `      <div className="bg-card"><span className="text-xs ${PILL}">Since 1915</span></div>`, 'sits on a light ground'],
    ['the pill\'s variable in a class, on a card', `      <div className="bg-card"><span className="text-xs ${c('text-[var(--gold-on-dark', '-badge)]')}">Since 1915</span></div>`, 'sits on a light ground'],
  ])('fails on %s', (_, body, message) => {
    const problems = one(body)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^src\/pages\/Planted\.tsx:\d+ /)
    expect(problems[0]).toContain(message)
  })

  it('passes a badge on a card and a pill on a navy band', () => {
    expect(one(`      <div className="bg-card"><span className="text-xs ${BADGE}">Opens soon</span></div>\n      <section className="bg-brand-navy"><span className="text-xs ${PILL}">Since 1915</span></section>`)).toEqual([])
  })

  it('fails on a badge\'s dark gold in a component drawn on navy under another name', () => {
    const label = `export default function Label() {\n  return <span className="text-xs ${BADGE}">Opens soon</span>\n}\n`
    const problems = guard({ 'src/components/Label.tsx': label, 'src/pages/User.tsx': page('      <section className="bg-brand-navy"><Mark /></section>', "import Mark from '@/components/Label'") })
    expect(problems).toHaveLength(1)
    expect(problems[0]).toMatch(/^src\/components\/Label\.tsx:2 text-gold-ink-badge sits on a navy ground/)
  })

  describe('a component told its ground by on', () => {
    const filter = (navy: string, light: string) =>
      `function Filter({ on = 'light' }: { on?: 'navy' | 'light' }) {\n  const cls = on === 'navy' ? 'bg-lca-gold/15 ${navy}' : 'bg-lca-gold/10 ${light}'\n  return <button className={cls}>Any state</button>\n}`

    it('passes each branch on the ground its on names, wherever the component is drawn', () => {
      expect(one('      <section className="bg-brand-navy"><Filter on="navy" /></section>\n      <div className="bg-card"><Filter /></div>', filter(PILL, BADGE))).toEqual([])
    })

    it('fails at a place whose on does not name its ground, and at one whose on the guard cannot read', () => {
      const bare = one('      <section className="bg-brand-navy"><Filter /></section>', filter(PILL, BADGE))
      expect(bare).toHaveLength(1)
      expect(bare[0]).toContain('is drawn with on="light", its default, on a navy ground')
      const told = one('      <div className="bg-card"><Filter on="navy" /></div>', filter(PILL, BADGE))
      expect(told).toHaveLength(1)
      expect(told[0]).toContain('is drawn with on="navy" on a light ground')
      const unread = one("      <div className=\"bg-card\"><Filter on={club.color ? 'navy' : 'light'} /></div>", filter(PILL, BADGE))
      expect(unread).toHaveLength(1)
      expect(unread[0]).toContain('the guard cannot read the on this place gives')
    })

    it('fails on the tokens swapped between the branches: a badge in the navy branch and a pill in the other', () => {
      const problems = one('      <section className="bg-brand-navy"><Filter on="navy" /></section>', filter(BADGE, PILL))
      expect(problems).toHaveLength(2)
      expect(problems.filter((p) => p.includes('text-gold-ink-badge sits on a navy ground'))).toHaveLength(1)
      expect(problems.filter((p) => p.includes('text-gold-on-dark-badge sits on a light ground'))).toHaveLength(1)
    })

    it('leaves alone a component whose on prop is not a ground', () => {
      const head = "function Toggle({ on }: { on: boolean }) {\n  return <span>{on ? 'On' : 'Off'}</span>\n}"
      expect(one('      <div className="bg-card"><Toggle on={true} /></div>', head)).toEqual([])
    })
  })

  describe('a badge in an object of strings the reading cannot follow', () => {
    const head = `const TAGS: Record<string, { label: string; className: string }> = {\n  soon: { label: 'Opens soon', className: 'bg-lca-gold/20 ${BADGE}' },\n}`
    const rows = (ground: string) => `      <div className="${ground}">{['soon'].map((s) => {\n        const meta = TAGS[s] ?? TAGS.soon\n        return <span key={s} className={meta.className}>{meta.label}</span>\n      })}</div>`
    const entry: GoldBadgeEntry = { file: 'src/pages/Planted.tsx', class: BADGE, count: 1, ground: 'light', readBy: 'meta.className', reason: 'A planted tag looked up by its status and drawn in rows on a card, allowed for this test only.' }
    const files = (ground: string) => ({ 'src/pages/Planted.tsx': page(rows(ground), head) })

    it('fails without an entry', () => {
      const problems = guard(files('bg-card'))
      expect(problems).toHaveLength(1)
      expect(problems[0]).toContain('a string no className reads in its file. A person decides: an entry in GOLD_BADGE_ALLOWLIST')
    })

    it('passes with an entry whose readers sit on the light ground it names, and fails with it once those rows are drawn on navy', () => {
      expect(guard(files('bg-card'), { badges: [entry] })).toEqual([])
      const moved = guard(files('bg-brand-navy'), { badges: [entry] })
      expect(moved).toHaveLength(1)
      expect(moved[0]).toMatch(/^src\/pages\/Planted\.tsx:\d+ <span> reads text-gold-ink-badge through meta\.className on a navy ground/)
    })

    it('fails on an entry with the wrong count, on one naming code no className holds, and on one for a use the reading places itself', () => {
      const count = guard(files('bg-card'), { badges: [{ ...entry, count: 2 }] })
      expect(count).toHaveLength(1)
      expect(count[0]).toContain('set its count')
      const misnamed = guard(files('bg-card'), { badges: [{ ...entry, readBy: 'tag.className' }] })
      expect(misnamed).toHaveLength(1)
      expect(misnamed[0]).toContain('no className in the file holds tag.className')
      const placed = guard({ 'src/pages/Planted.tsx': page(`      <div className="bg-card"><span className="text-xs ${BADGE}">Opens soon</span></div>`) }, { badges: [{ ...entry, readBy: undefined }] })
      expect(placed).toHaveLength(1)
      expect(placed[0]).toContain('is not needed: the reading places this use itself')
    })

    it('takes a pill on a darkened photo, which the reading cannot place, only by an entry for its dark ground', () => {
      const hero = `      <div className="relative overflow-hidden" data-ground="dark">\n        <div className="absolute inset-0 bg-brand-navy/55 mix-blend-multiply" />\n        <p className="rounded-full bg-lca-gold/20 text-xs ${PILL}">Since 1915</p>\n      </div>`
      const bare = one(hero)
      expect(bare).toHaveLength(1)
      expect(bare[0]).toContain('A person decides: an entry in GOLD_BADGE_ALLOWLIST')
      const pill: GoldBadgeEntry = { file: 'src/pages/Planted.tsx', class: PILL, count: 1, ground: 'dark', reason: 'A planted pill on a darkened photo, measured for this test only: a person decides it with the ratio it reads.' }
      expect(guard({ 'src/pages/Planted.tsx': page(hero) }, { badges: [pill] })).toEqual([])
    })
  })
})
