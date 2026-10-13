// test/unit/helpers/cssTokens.ts
//
// Reads the design tokens out of src/index.css the way a browser would apply
// them, without a browser, for tokens.test.ts and contrast.test.ts.
//
// The stylesheet is split into rules (at-rules such as @media are kept with
// the rules inside them). A token's value on <html>, or on a scope container
// inside it, is worked out by cascading every rule whose selector matches,
// in order of specificity and then of position, and then replacing each
// var() with the value it names on that element. A container inherits the
// values <html> ends up with, as custom properties do.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const ROOT = resolve(__dirname, '../../..')
export const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

export interface CssRule {
  /** The selector, or the at-rule's prelude such as "@theme inline". */
  selector: string
  /** The selectors inside a comma-separated list. */
  selectors: string[]
  /** Custom properties and plain declarations, in order, last one wins. */
  decls: Map<string, string>
  /** The enclosing at-rule, such as "@media (prefers-reduced-motion: reduce)", or "". */
  within: string
  /** Position in the file, for the cascade. */
  order: number
}

/** The stylesheet without comments. */
export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Every rule in the stylesheet, including those inside @media and @layer. */
export function parseRules(css: string): CssRule[] {
  const text = stripComments(css)
  const rules: CssRule[] = []
  let order = 0
  const walk = (src: string, within: string) => {
    let i = 0
    while (i < src.length) {
      const open = src.indexOf('{', i)
      if (open < 0) break
      // A statement such as @import "x"; or @custom-variant ...; before the brace.
      const head = src.slice(i, open)
      const lastSemi = head.lastIndexOf(';')
      const selector = (lastSemi >= 0 ? head.slice(lastSemi + 1) : head).trim()
      let depth = 1
      let j = open + 1
      while (j < src.length && depth > 0) {
        if (src[j] === '{') depth++
        else if (src[j] === '}') depth--
        j++
      }
      const body = src.slice(open + 1, j - 1)
      if (/^@(media|layer|supports)\b/.test(selector) && body.includes('{')) {
        walk(body, selector)
      } else if (!body.includes('{')) {
        const decls = new Map<string, string>()
        for (const part of body.split(';')) {
          const colon = part.indexOf(':')
          if (colon < 0) continue
          decls.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim().replace(/\s+/g, ' '))
        }
        rules.push({
          selector,
          selectors: selector.split(',').map((s) => s.trim().replace(/\s+/g, ' ')),
          decls,
          within,
          order: order++,
        })
      } else {
        // A nested rule outside @media and @layer (for example @supports
        // inside a declaration block); walk into it as well.
        walk(body, selector)
      }
      i = j
    }
  }
  walk(text, '')
  return rules
}

/** Specificity as one number: attributes, classes and pseudo-classes count 1 each. */
export function specificity(selector: string): number {
  return (selector.match(/\[[^\]]*\]|\.[A-Za-z][\w-]*|:[A-Za-z][\w-]*/g) ?? []).length
}

/** The state of <html>: whether data-look="new" and the .dark class are set. */
export interface RootState {
  look: boolean
  dark: boolean
}

/** Whether a selector, taken whole, matches <html> in this state. */
export function matchesRoot(selector: string, state: RootState): boolean {
  if (selector === ':root') return true
  if (selector === '.dark') return state.dark
  if (selector === ':root[data-look="new"]') return state.look
  if (selector === ':root[data-look="new"].dark') return state.look && state.dark
  return false
}

/**
 * Whether a selector matches a container with data-theme="theme" directly
 * inside <html>: "<html part> [data-theme="x"]" or "<html part> [data-theme]".
 */
export function matchesScope(selector: string, state: RootState, theme: string): boolean {
  const m = selector.match(/^(.+) \[data-theme(?:="([^"]*)")?\]$/)
  if (!m) return false
  if (!matchesRoot(m[1], state)) return false
  return m[2] === undefined || m[2] === theme
}

function cascade(rules: CssRule[], matches: (selector: string) => boolean): Map<string, string> {
  const hits: Array<{ spec: number; order: number; decls: Map<string, string> }> = []
  for (const rule of rules) {
    if (rule.within) continue
    for (const sel of rule.selectors) {
      if (matches(sel)) {
        hits.push({ spec: specificity(sel), order: rule.order, decls: rule.decls })
        break
      }
    }
  }
  hits.sort((a, b) => a.spec - b.spec || a.order - b.order)
  const out = new Map<string, string>()
  for (const hit of hits) for (const [k, v] of hit.decls) if (k.startsWith('--')) out.set(k, v)
  return out
}

/** Replaces every var() in `value` with what it names in `values`, recursively. */
export function substitute(value: string, values: Map<string, string>, depth = 0): string {
  if (depth > 20) throw new Error(`var() loop in ${value}`)
  const at = value.indexOf('var(')
  if (at < 0) return value
  let depthParen = 0
  let end = at + 4
  for (; end < value.length; end++) {
    if (value[end] === '(') depthParen++
    else if (value[end] === ')') {
      if (depthParen === 0) break
      depthParen--
    }
  }
  const inner = value.slice(at + 4, end)
  const comma = inner.indexOf(',')
  const name = (comma < 0 ? inner : inner.slice(0, comma)).trim()
  const fallback = comma < 0 ? undefined : inner.slice(comma + 1).trim()
  const found = values.get(name) ?? fallback
  if (found === undefined) throw new Error(`${name} is not defined`)
  const replaced = value.slice(0, at) + substitute(found, values, depth + 1) + value.slice(end + 1)
  return substitute(replaced, values, depth + 1)
}

function resolveAll(raw: Map<string, string>): Map<string, string> {
  const out = new Map<string, string>()
  for (const [k, v] of raw) out.set(k, substitute(v, raw))
  return out
}

/** Every custom property on <html> in this state, with var() replaced. */
export function rootTokens(rules: CssRule[], state: RootState): Map<string, string> {
  return resolveAll(cascade(rules, (sel) => matchesRoot(sel, state)))
}

/**
 * Every custom property on a container with data-theme="theme" directly
 * inside <html>: what it inherits from <html>, overlaid with its own rules,
 * with var() replaced on the container.
 */
export function scopeTokens(rules: CssRule[], state: RootState, theme: string): Map<string, string> {
  const inherited = rootTokens(rules, state)
  const own = cascade(rules, (sel) => matchesScope(sel, state, theme))
  const raw = new Map(inherited)
  for (const [k, v] of own) raw.set(k, v)
  return resolveAll(raw)
}

/** The tokens of src/index.css, read fresh. */
export function indexCssRules(): CssRule[] {
  return parseRules(read('src/index.css'))
}

/** #rgb or #rrggbb as [r, g, b], 0 to 255. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = hex.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) throw new Error(`${hex} is not a hex colour`)
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]
  const n = parseInt(h, 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

/** WCAG 2.x relative luminance of an sRGB colour. */
export function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/** WCAG 2.x contrast ratio between two hex colours. */
export function contrast(a: string, b: string): number {
  const la = luminance(hexToRgb(a))
  const lb = luminance(hexToRgb(b))
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}
