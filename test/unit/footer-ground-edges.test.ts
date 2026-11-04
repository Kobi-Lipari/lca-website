// test/unit/footer-ground-edges.test.ts
//
// The new footer's ground, colours and rings at their edges (WS02 step 8),
// read from src/components/layout/SiteFooter.tsx and src/index.css as they
// stand, with the contrast helper the colour tests share:
//
// - its ground is the navy that stays navy, read through its variable, with
//   the navy ring ground and no band class, so no rule written for a navy
//   band reaches it and its rings come from the ring ground alone;
// - the navy and the gold are the brand's own two values in every look and
//   mode, and on that navy the footer's words and rings meet their ratios:
//   gold words at 12 pixels and white words at 4.5:1 or more, the white at
//   80 per cent of its sentence and trust line too, and the gold ring at 3:1
//   or more, in the light look and in dark mode alike;
// - its gold is text-lca-gold alone, in the desktop headings' one class
//   string, and nothing in it is a colour written out: no hex class, no veil
//   of white, no gold token class, no colour in a style;
// - neither colour list grows for it: the raw colours' allowlist and the
//   WS02 gold list hold no entry for the file.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { ROOT, contrast, hexToRgb, indexCssRules } from './helpers/cssTokens'

const FILE = 'src/components/layout/SiteFooter.tsx'
const source = readFileSync(join(ROOT, FILE), 'utf8')
const rules = indexCssRules()

/** Every string the footer's file writes, in quotes or in a template, which is where its classes are. */
function stringsOf(text: string): string[] {
  const file = ts.createSourceFile(FILE, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) out.push(node.text)
    else if (ts.isTemplateExpression(node)) out.push(node.head.text, ...node.templateSpans.map((span) => span.literal.text))
    ts.forEachChild(node, visit)
  }
  visit(file)
  return out
}
const strings = stringsOf(source)
const classes = strings.flatMap((s) => s.split(/\s+/)).filter(Boolean)

/** The JSX attributes of a name the footer's file writes, each with its value, comments left out. */
function attributesNamed(text: string, name: string): string[] {
  const file = ts.createSourceFile(FILE, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxAttribute(node) && node.name.getText(file) === name) out.push(node.initializer && ts.isStringLiteral(node.initializer) ? node.initializer.text : '')
    ts.forEachChild(node, visit)
  }
  visit(file)
  return out
}

/** A colour of a part of white over a ground, as a hex colour. */
function whiteOver(ground: string, part: number): string {
  const [r, g, b] = hexToRgb(ground)
  const mix = (c: number) => Math.round(part * 255 + (1 - part) * c).toString(16).padStart(2, '0')
  return `#${mix(r)}${mix(g)}${mix(b)}`
}

/** Every value a token is given anywhere in the stylesheet, in any look or mode. */
const valuesOf = (token: string) => rules.filter((r) => r.decls.has(token)).map((r) => r.decls.get(token)!)

const NAVY = '#1a2744'
const GOLD = '#c8a94a'

describe('the footer\'s ground', () => {
  it('is the navy that stays navy, read through its variable, with the navy ring ground, and no band class or dark ground on it or in it', () => {
    const footerTag = /<footer\b([^>]*)>/.exec(source)
    expect(footerTag).not.toBeNull()
    expect(footerTag![1]).toContain('data-ring-ground="navy"')
    expect(footerTag![1]).toContain('bg-(--color-brand-navy)')
    for (const band of ['bg-brand-navy', 'bg-lca-navy']) expect(classes.filter((c) => c.replace(/^(?:[a-z-]+:)+/, '') === band), band).toEqual([])
    expect(source).not.toMatch(/data-ground=/)
    // Only one ring ground is written in the file: the footer's own. The boundary's notice brings its own light one.
    expect(attributesNamed(source, 'data-ring-ground')).toEqual(['navy'])
    expect(attributesNamed(source, 'data-ground')).toEqual([])
  })

  it('takes its navy and its gold from tokens no look and no mode gives another value', () => {
    expect(valuesOf('--color-brand-navy')).toEqual([NAVY])
    expect(valuesOf('--color-lca-gold')).toEqual([GOLD])
  })

  it('gets its controls\' rings from the navy ring ground alone, gold in the light look and in dark mode, at 3:1 or more on the navy', () => {
    const navyRings = rules.filter((r) => r.selectors.some((s) => s.includes('[data-ring-ground="navy"]')))
    expect(navyRings.length).toBeGreaterThan(0)
    for (const rule of navyRings) expect(rule.decls.get('--focus'), rule.selector).toBe(GOLD)
    expect(contrast(GOLD, NAVY)).toBeGreaterThanOrEqual(3)
  })
})

describe('the footer\'s words on its navy', () => {
  it('gives the gold of the desktop headings, 12 pixels in capitals, 4.5:1 or more', () => {
    expect(contrast(GOLD, NAVY)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(GOLD, NAVY)).toBeCloseTo(6.51, 2)
  })

  it('gives white words 4.5:1 or more, and the sentence\'s and the trust line\'s white at 80 per cent too', () => {
    expect(contrast('#ffffff', NAVY)).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#ffffff', NAVY)).toBeCloseTo(14.81, 2)
    expect(classes.filter((c) => /^text-white\/\d+$/.test(c)).sort()).toEqual(['text-white/60', 'text-white/80', 'text-white/80'])
    expect(contrast(whiteOver(NAVY, 0.8), NAVY)).toBeGreaterThanOrEqual(4.5)
    // The dots between the trust line's items, at 60 per cent, are hidden from screen readers and carry no words.
    const dot = /<span aria-hidden="true" className="([^"]*)">/.exec(source)
    expect(dot![1]).toContain('text-white/60')
  })
})

describe('the footer\'s colours, none written out', () => {
  it('writes its gold as text-lca-gold alone, in the desktop headings\' one class string', () => {
    const golden = strings.filter((s) => /\btext-lca-gold\b/.test(s))
    expect(golden).toHaveLength(1)
    expect(golden[0].split(/\s+/)).toEqual(expect.arrayContaining(['uppercase', 'text-xs', 'font-semibold']))
    expect(classes.filter((c) => /(?:^|:)text-gold(?:-on-dark)?(?:-badge)?$/.test(c))).toEqual([])
    expect(source.toLowerCase()).not.toContain('#e6cf86')
  })

  it('writes no hex class, no veil of white, no colour in a style, and no transition or animation', () => {
    expect(classes.filter((c) => /\[#[0-9a-f]{3,8}\]/i.test(c))).toEqual([])
    expect(classes.filter((c) => /(?:^|:)bg-white(?:\/|$)/.test(c))).toEqual([])
    expect(source).not.toMatch(/\bstyle=\{/)
    expect(classes.filter((c) => /(?:^|:)(?:transition|animate-|duration-)/.test(c))).toEqual([])
  })

  it('grows neither colour list: the raw colours\' allowlist and the WS02 gold list name no part of the file', () => {
    const allowlist = JSON.parse(readFileSync(join(ROOT, 'test/unit/fixtures/raw-colours-allowlist.json'), 'utf8')) as { entries: Array<{ file: string }> }
    expect(allowlist.entries.filter((e) => e.file === FILE)).toEqual([])
    expect(readFileSync(join(ROOT, 'test/unit/fixtures/goldAllowlist.ts'), 'utf8')).not.toContain('SiteFooter')
  })
})
