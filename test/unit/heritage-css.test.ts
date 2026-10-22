// The heritage look's type rules (WS01 step 30), read from
// src/styles/themes/heritage.css as a browser would apply them.
//
// - The base look's display accent face is unreachable in a heritage scope:
//   each utility and token src/index.css gives that face (compiled by
//   Tailwind from its @theme blocks) is overridden inside the scope, on its
//   descendants and on the scope's own element, by a rule in no cascade
//   layer that names another face, and no file under src names the face but
//   src/index.css.
// - Caslon is named by one declaration only, --font-display, which only the
//   display rule reads: an h1 or an h2 with the display hook, or a display
//   figure outside tables and the fixed-width face, at 400 (its one weight)
//   and never under 2rem (32px). No file under src but this stylesheet names
//   Caslon.
// - The display size the Caslon rule reads is registered (@property) as a
//   length or a percentage, passed down, from a fixed length, at the top
//   level, so a value a page sets that is neither counts as not set rather
//   than dropping the heading to the size of the text around it; the scope
//   sets it, nothing else is registered, and every value a file under src
//   gives it is a length in rem or px, or a percentage, never a bare number
//   or a unit of the heading's own font.
// - The small capitals class sets capitals at 0.85em with 0.06em to 0.08em
//   of tracking, and nothing asks the browser for small capitals.
// - No rule reaches a control (a button, a field, a chip, a status tag or
//   dot, a date block, a result cell, the fixed-width face or a focus state)
//   or sets an outline, a shadow or the radius token; no rule styles an
//   element by its tag alone; the scope's own element gets no face.
// - Every rule but the @font-face declarations and that registration is
//   under :root[data-look="new"] [data-theme="heritage"], in no cascade
//   layer.
// - The reader is Source Serif at 18px with a line height of 1.6, lining and
//   tabular figures, and a measure of 70 of its own figure zeros, read from
//   the font file; the 2px radius goes to the card, table and mat hooks and
//   the About page's logo frame, and to nothing else.
// - The fallback faces are Georgia, one for each real face, each with its
//   four overrides, the vertical ones agreeing with the face's own file.
// Each check fails on a planted stylesheet, the names put together when the
// test runs.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { compile } from 'tailwindcss'
import { beforeAll, describe, expect, it } from 'vitest'
import { parseRules, read, ROOT, stripComments, type CssRule } from './helpers/cssTokens'
import { declaredFaces } from './helpers/heritageFaces'
import { fontMetrics } from './helpers/woff2'

const SHEET = 'src/styles/themes/heritage.css'
const GUARD = ':root[data-look="new"] [data-theme="heritage"]'
const CASLON = ['Libre', 'Caslon', 'Display'].join(' ')
/** The lining figures keyword, put together so the stylesheet build does not take it for a class this file uses. */
const LINING = ['lining', 'nums'].join('-')
const ACCENT = ['Instrument', 'Serif'].join(' ')
/** The display size's property, put together so the stylesheet build does not read a class from the planted cases. */
const SIZE = ['--display', 'size'].join('-')
/** A value a page may give the display size: a length in rem or px, or a percentage. */
const SIZE_VALUE = /^(?:\d+(?:\.\d+)?|\.\d+)(?:rem|px|%)$/

/** Splits at `sep` where it is outside brackets, parentheses and quotes. */
function splitTop(text: string, sep: (ch: string, at: number) => boolean): string[] {
  const parts: string[] = []
  let depth = 0
  let quote = ''
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === quote) quote = ''
    } else if (ch === '"' || ch === "'") quote = ch
    else if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    else if (depth === 0 && sep(ch, i)) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts.map((p) => p.trim()).filter((p) => p !== '')
}

const selectorsOf = (rule: CssRule) => splitTop(rule.selector.replace(/\s+/g, ' '), (ch) => ch === ',')
/** The compound a selector styles: its last, after the final combinator. */
const subjectOf = (selector: string) => splitTop(selector, (ch) => /[\s>+~]/.test(ch)).pop() ?? ''
/** A compound with its :not() groups taken out: what it reaches, not what it leaves out. */
function withoutNot(compound: string): string {
  let out = compound
  for (let at = out.indexOf(':not('); at >= 0; at = out.indexOf(':not(')) {
    let depth = 0
    let end = at + 4
    for (; end < out.length; end++) {
      if (out[end] === '(') depth++
      else if (out[end] === ')' && --depth === 0) break
    }
    out = out.slice(0, at) + out.slice(end + 1)
  }
  return out
}
/** The :not() groups of a compound, as written. */
const notsOf = (compound: string) => [...compound.matchAll(/:not\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)].map((m) => m[1])
/** The alternatives a compound stands for: one per item of the :is() it starts with, each with the rest of the compound. */
function branchesOf(compound: string): string[] {
  const is = compound.match(/^:is\(([^()]*)\)(.*)$/)
  return is ? splitTop(is[1], (ch) => ch === ',').map((item) => `${item}${is[2]}`) : [compound]
}
/** The element types a compound names: its own, or those of the :is() it starts with. */
function tagsOf(compound: string): string[] {
  const is = compound.match(/^:is\(([^()]*)\)/)
  if (is) return splitTop(is[1], (ch) => ch === ',')
  const tag = compound.match(/^[a-z][\w-]*/)
  return tag ? [tag[0]] : []
}
/** The families a font-family value names, without quotes. */
const families = (value: string) => splitTop(value, (ch) => ch === ',').map((f) => f.replace(/^(['"])(.*)\1$/, '$2'))

/** The site's controls and formats, which the look never restyles: the names are put together here. */
const CONTROL_TYPES = ['but' + 'ton', 'in' + 'put', 'sel' + 'ect', 'text' + 'area', 'op' + 'tion', 'opt' + 'group']
const CONTROL_SLOTS = ['but' + 'ton', 'filter' + '-chip', 'status' + '-badge', 'status' + '-dot', 'status' + '-mark', 'date' + '-block', 'result' + '-cell', 'result' + '-legend', 'color' + '-mark']
const CONTROL_CLASSES = ['font' + '-mono']
const FOCUS = ['focus', 'focus' + '-visible', 'focus' + '-within']
const RING_PROPS = /^(outline|outline-[\w-]+|box-shadow|--focus|--ring|--radius[\w-]*|--tw-ring[\w-]*)$/

/** The hooks a page puts on its own elements, by kind. */
const HOOK = (word: string) => `[data-heritage~="${word}"]`
const RADIUS_HOOKS = [HOOK('card'), HOOK('table'), HOOK('mat'), '[data-slot="lca-logo-mat"]']

interface Accent {
  /** The utility classes whose compiled rule names the accent face. */
  classes: string[]
  /** The tokens of src/index.css's @theme blocks whose value names it. */
  tokens: string[]
}

function controlIn(compound: string): string | null {
  const reach = withoutNot(compound)
  const bare = reach.replace(/\[[^\]]*\]/g, '[]').replace(/"[^"]*"|'[^']*'/g, '')
  for (const type of CONTROL_TYPES) if (new RegExp(`(^|[\\s,(])${type}(?=$|[\\s,).:\\[#])`).test(bare)) return type
  for (const attr of reach.match(/\[[^\]]*\]/g) ?? []) {
    const m = attr.match(/^\[\s*data-slot\s*[~|^$*]?=\s*(['"]?)([^'"\]]+)\1\s*\]$/)
    if (m && CONTROL_SLOTS.some((slot) => m[2] === slot || m[2].startsWith(`${slot}-`))) return attr
    if (/^\[\s*data-status\b/.test(attr) || /^\[\s*role\s*=\s*['"]?button/.test(attr)) return attr
  }
  for (const cls of CONTROL_CLASSES) if (new RegExp(`\\.${cls}(?![\\w-])`).test(reach)) return `.${cls}`
  for (const pseudo of FOCUS) if (new RegExp(`:${pseudo}(?![\\w-])`).test(reach)) return `:${pseudo}`
  return null
}

/** Every problem with a heritage stylesheet, each tagged with the rule it breaks. */
function problems(css: string, accent: Accent): string[] {
  const out: string[] = []
  const rules = parseRules(css)
  const faces = rules.filter((r) => r.selector === '@font-face')
  // A registration gives a custom property a type and sets nothing on an element; the display size checks it.
  const registrations = rules.filter((r) => /^@property\s/.test(r.selector))
  const styleRules = rules.filter((r) => r.selector !== '@font-face' && !registrations.includes(r))
  const scope = styleRules.find((r) => r.selector === GUARD && r.within === '')
  const tokens = new Map(scope?.decls ?? [])
  const resolve = (value: string): string => value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_, name: string, fallback?: string) => resolve(tokens.get(name) ?? fallback ?? ''))

  // The guard: every rule under the new look and the heritage scope, in no layer.
  for (const rule of styleRules) {
    if (rule.within !== '') out.push(`guard: ${rule.selector} sits inside ${rule.within}`)
    for (const sel of selectorsOf(rule)) {
      if (!(sel === GUARD || sel.startsWith(`${GUARD} `) || sel.startsWith(`${GUARD}.`) || sel.startsWith(`${GUARD}[`))) out.push(`guard: ${sel} does not wait for the new look`)
    }
  }

  // Controls, tags alone, and the scope's own element.
  for (const rule of styleRules) {
    for (const sel of selectorsOf(rule)) {
      const subject = subjectOf(sel)
      // A control anywhere in the chain counts: a rule for what sits inside a control restyles it too.
      for (const compound of splitTop(sel, (ch) => /[\s>+~]/.test(ch))) {
        const control = controlIn(compound)
        if (control) out.push(`controls: ${sel} reaches ${control}`)
      }
      const own = sel.startsWith(GUARD) && (sel === GUARD || !sel.slice(GUARD.length).startsWith(' '))
      if (!own && branchesOf(withoutNot(subject)).some((branch) => !/[.[]/.test(branch))) {
        out.push(`tags: ${sel} styles an element by its tag alone`)
      }
      for (const [prop, value] of rule.decls) {
        if (RING_PROPS.test(prop)) out.push(`controls: ${sel} sets ${prop}`)
        if (own && !prop.startsWith('--') && !(prop === 'font-family' && value === 'inherit')) out.push(`container: ${sel} sets ${prop} on the scope's own element`)
      }
    }
  }

  // The accent face: overridden for every class and token that gives it, unlayered, and named nowhere here.
  for (const rule of [...faces, ...registrations, ...styleRules]) {
    for (const [prop, value] of rule.decls) if (value.includes(ACCENT)) out.push(`accent: ${rule.selector} names it in ${prop}`)
  }
  for (const cls of accent.classes) {
    for (const [where, selector] of [['inside the scope', `${GUARD} .${cls}`], ['on the scope\'s own element', `${GUARD}.${cls}`]] as const) {
      const rule = styleRules.find((r) => r.within === '' && selectorsOf(r).includes(selector))
      const family = rule?.decls.get('font-family')
      if (!rule || !family) out.push(`accent: no rule gives .${cls} another face ${where}`)
      else if (resolve(family).includes(ACCENT)) out.push(`accent: .${cls} keeps the face ${where}`)
    }
  }
  for (const token of accent.tokens) {
    const value = tokens.get(token)
    if (value === undefined) out.push(`accent: the scope does not set ${token}`)
    else if (resolve(value).includes(ACCENT)) out.push(`accent: ${token} still names the face`)
  }

  // Caslon: one declaration names it, the token; only the display rule reads the token.
  const naming: string[] = []
  for (const rule of styleRules) {
    for (const [prop, value] of rule.decls) {
      if (families(value).some((f) => f === CASLON || f === `${CASLON} Fallback`)) naming.push(`${rule.selector} { ${prop} }`)
    }
  }
  if (naming.length !== 1 || naming[0] !== `${GUARD} { --font-display }`) out.push(`caslon: named by ${naming.join(', ') || 'nothing'}`)
  for (const rule of styleRules) {
    const reads = [...rule.decls].filter(([prop, value]) => prop !== '--font-display' && value.includes('--font-display'))
    if (reads.length === 0) continue
    for (const sel of selectorsOf(rule)) {
      const subject = subjectOf(sel)
      const reach = withoutNot(subject)
      const headings = tagsOf(reach).filter((tag) => /^h[1-6]$/.test(tag))
      const heading = headings.length > 0
      if (heading && !reach.includes(HOOK('display'))) out.push(`caslon: ${sel} reaches a heading without the display hook`)
      else if (!heading && !reach.includes(HOOK('figure'))) out.push(`caslon: ${sel} is neither a display heading nor a display figure`)
      if (headings.some((tag) => !/^h[12]$/.test(tag))) out.push(`caslon: ${sel} reaches a heading below h2`)
      if (!heading) {
        const nots = notsOf(subject).join(',')
        if (!/(^|,)\s*table\s+\*/.test(nots)) out.push(`caslon: ${sel} does not keep out of tables`)
        if (!nots.includes('.font-mono')) out.push(`caslon: ${sel} does not keep off the fixed-width face`)
      }
    }
    if (rule.decls.get('font-weight') !== '400') out.push(`caslon: ${rule.selector} does not set 400, the face's one weight`)
    const size = rule.decls.get('font-size') ?? ''
    if (floorPx(size) < 32) out.push(`caslon: ${rule.selector} lets the face go under 32px (${size || 'no size'})`)
  }

  // The display size: each property the Caslon rule's size reads is registered as a length, so a value
  // that is not one counts as not set rather than dropping the size to the text around it, and the scope
  // sets it; nothing else is registered.
  const sizeProps = new Set(
    styleRules
      .filter((r) => [...r.decls].some(([prop, value]) => prop !== '--font-display' && value.includes('--font-display')))
      .flatMap((r) => [...(r.decls.get('font-size') ?? '').matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1])),
  )
  const registered = (rule: CssRule) => rule.selector.replace(/^@property\s+/, '')
  for (const name of sizeProps) {
    const found = registrations.filter((r) => registered(r) === name)
    if (found.length !== 1) {
      out.push(`size: ${name} is not registered as a length`)
      continue
    }
    const { decls, within } = found[0]
    if (within !== '') out.push(`size: ${name} is registered inside ${within}`)
    if (!/^(['"])<length(?:-percentage)?>\1$/.test(decls.get('syntax') ?? '')) out.push(`size: ${name} is registered as ${decls.get('syntax') ?? 'nothing'}, not a length`)
    if (decls.get('inherits') !== 'true') out.push(`size: ${name} is not passed down, so the scope's size would not reach a heading`)
    if (!/^\d+(?:\.\d+)?px$/.test(decls.get('initial-value') ?? '')) out.push(`size: ${name} starts at ${decls.get('initial-value') ?? 'nothing'}, not a fixed length in px`)
    const own = tokens.get(name)
    if (own === undefined) out.push(`size: the scope does not set ${name}`)
    else if (!SIZE_VALUE.test(own) || floorPx(own) < 32) out.push(`size: the scope sets ${name} to ${own}`)
  }
  for (const rule of registrations) if (!sizeProps.has(registered(rule))) out.push(`guard: ${rule.selector} registers a property the display size does not read`)

  // Small capitals: capitals at 0.85em with 0.06em to 0.08em of tracking; never the browser's own.
  const caps = styleRules.filter((r) => selectorsOf(r).some((s) => withoutNot(subjectOf(s)) === '.small-caps'))
  if (caps.length !== 1) out.push(`caps: ${caps.length} rules for the class`)
  for (const rule of caps) {
    if (rule.decls.get('text-transform') !== 'uppercase') out.push('caps: the class does not set capitals')
    if (rule.decls.get('font-size') !== '0.85em') out.push('caps: the class is not at 0.85em')
    const tracking = parseFloat(rule.decls.get('letter-spacing') ?? '')
    if (!/em$/.test(rule.decls.get('letter-spacing') ?? '') || tracking < 0.06 || tracking > 0.08) out.push('caps: the tracking is not 0.06em to 0.08em')
  }
  for (const rule of [...faces, ...registrations, ...styleRules]) {
    for (const [prop, value] of rule.decls) {
      if (/^font-variant(-caps)?$/.test(prop) && /small-caps|petite-caps|unicase|titling-caps/.test(value)) out.push(`caps: ${rule.selector} asks for small capitals in ${prop}`)
      if (prop === 'font-feature-settings' && /smcp|c2sc|pcap|c2pc/.test(value)) out.push(`caps: ${rule.selector} asks for small capitals in ${prop}`)
      if (prop === 'font-variant-caps') out.push(`caps: ${rule.selector} sets font-variant-caps`)
    }
  }

  // The reader.
  const readers = styleRules.filter((r) => selectorsOf(r).some((s) => withoutNot(subjectOf(s)) === HOOK('reader')))
  if (readers.length !== 1) out.push(`reader: ${readers.length} rules for the reader hook`)
  for (const rule of readers) {
    const family = families(resolve(rule.decls.get('font-family') ?? ''))
    if (family[0] !== 'Source Serif 4 Variable') out.push(`reader: the face is ${family[0] ?? 'none'}`)
    if (rule.decls.get('font-size') !== '1.125rem') out.push(`reader: the size is ${rule.decls.get('font-size')}, not 18px`)
    if (rule.decls.get('line-height') !== '1.6') out.push(`reader: the line height is ${rule.decls.get('line-height')}`)
    const numeric = rule.decls.get('font-variant-numeric') ?? ''
    if (!numeric.includes(LINING) || !numeric.includes('tabular-nums')) out.push('reader: the figures are not lining and tabular')
    const measure = rule.decls.get('max-width') ?? ''
    if (!/^[\d.]+em$/.test(measure)) out.push(`reader: the measure ${measure || 'is not set'} is not in em`)
    else if (Math.abs(parseFloat(measure) / ZERO - 70) > 0.5) out.push(`reader: the measure ${measure} is ${(parseFloat(measure) / ZERO).toFixed(1)} figure zeros, not 70`)
  }

  // The radius: 2px on the hooks, and nothing else gets one.
  const radius = styleRules.filter((r) => [...r.decls.keys()].some((p) => p.startsWith('border') && p.includes('radius')))
  const reached = radius.flatMap((r) => selectorsOf(r).flatMap((s) => {
    const subject = withoutNot(subjectOf(s))
    const inner = subject.match(/^:is\((.*)\)$/)
    return inner ? splitTop(inner[1], (ch) => ch === ',') : [subject]
  }))
  for (const hook of reached) if (!RADIUS_HOOKS.includes(hook)) out.push(`radius: ${hook} gets a radius`)
  for (const hook of RADIUS_HOOKS) if (!reached.includes(hook)) out.push(`radius: ${hook} gets none`)
  for (const rule of radius) if (rule.decls.get('border-radius') !== '2px') out.push(`radius: ${rule.selector} is not 2px`)

  // The fallback faces: Georgia, one for each real face, with the four overrides.
  const real = declaredFaces(css, SHEET).filter((f) => f.files.length > 0)
  const fallback = faces.filter((f) => (f.decls.get('src') ?? '').includes('local('))
  for (const face of fallback) {
    const name = families(face.decls.get('font-family') ?? '')[0]
    if (!name.endsWith(' Fallback')) out.push(`fallback: ${name} is not named as a fallback`)
    if (/url\(/.test(face.decls.get('src') ?? '')) out.push(`fallback: ${name} names a file`)
    if (!/local\(\s*['"]?Georgia/.test(face.decls.get('src') ?? '')) out.push(`fallback: ${name} is not Georgia`)
    for (const d of ['size-adjust', 'ascent-override', 'descent-override', 'line-gap-override']) if (!face.decls.has(d)) out.push(`fallback: ${name} has no ${d}`)
  }
  const fallbackKeys = new Set(fallback.map((f) => `${families(f.decls.get('font-family') ?? '')[0]} ${f.decls.get('font-style') ?? 'normal'}`))
  for (const face of real) {
    const wanted = `${face.family.replace(/ Variable$/, '')} Fallback ${face.style}`
    if (!fallbackKeys.has(wanted)) out.push(`fallback: no fallback face for ${face.family} ${face.style}`)
  }
  return out
}

/** The smallest size a font-size value can come to, in pixels at a 16px root: a length, or the floor of a max(). */
function floorPx(value: string): number {
  const px = (v: string) => {
    const m = v.trim().match(/^([\d.]+)(rem|px)$/)
    return m ? parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1) : NaN
  }
  const max = value.match(/^max\((.*)\)$/)
  if (!max) return px(value) || 0
  const lengths = splitTop(max[1], (ch) => ch === ',').map(px).filter((n) => !Number.isNaN(n))
  return lengths.length ? Math.max(...lengths) : 0
}

/**
 * Each value a text gives the display size, as written: in a style object
 * (a quoted key, or a computed one with a type), a class, a declaration or
 * a call to setProperty. A var() that reads it is not one.
 */
function sizeSettings(text: string): string[] {
  const found: string[] = []
  for (let at = text.indexOf(SIZE); at >= 0; at = text.indexOf(SIZE, at + SIZE.length)) {
    if (/[\w-]/.test(text[at + SIZE.length] ?? '') || /var\(\s*$/.test(text.slice(Math.max(0, at - 6), at))) continue
    const rest = text.slice(at + SIZE.length)
    const call = /setProperty\(\s*['"`]$/.test(text.slice(Math.max(0, at - 16), at))
    const set =
      rest.match(/^(['"`]?)(?:\s+as\s+[\w.]+)?\]?\s*:\s*(?:(['"`])(.*?)\2|([^;\]},\n]*))/) ??
      (call ? rest.match(/^(['"`])\s*,\s*(?:(['"`])(.*?)\2|([^)\n]*))/) : null)
    if (set) found.push((set[3] ?? set[4] ?? '').trim())
  }
  return found
}

/** Source Serif's figure zero, in em, read from the roman file the look names. */
const ZERO = (() => {
  const roman = declaredFaces(read(SHEET), SHEET).find((f) => f.family === 'Source Serif 4 Variable' && f.style === 'normal')!
  const metrics = fontMetrics(readFileSync(join(ROOT, roman.woff2)))
  return metrics.advance(0x30) / metrics.unitsPerEm
})()

/** The part of index.css Tailwind needs to build the font utilities: the variant and both @theme blocks. */
function themeSource(): string {
  const css = stripComments(read('src/index.css'))
  const variant = css.match(/@custom-variant dark [^;]+;/)?.[0]
  const blocks = [...css.matchAll(/^@theme(?: inline)? \{[\s\S]*?^\}/gm)].map((m) => m[0])
  if (!variant || blocks.length !== 2) throw new Error('index.css should hold one dark variant and two @theme blocks')
  return `${variant}\n${blocks.join('\n')}\n@tailwind utilities;`
}

let accent: Accent
beforeAll(async () => {
  const source = themeSource()
  const compiler = await compile(source, { base: ROOT, loadStylesheet: async () => ({ content: '', base: ROOT, path: '' }) })
  const fontTokens = [...source.matchAll(/(--font-[\w-]+)\s*:\s*([^;]+);/g)]
  const classes = fontTokens.map((m) => m[1].slice(2)).filter((cls) => compiler.build([cls]).includes(ACCENT))
  const tokens = fontTokens.filter((m) => m[2].includes(ACCENT)).map((m) => m[1])
  accent = { classes, tokens }
})

const sheet = read(SHEET)
const of = (css: string, tag: string) => problems(css, accent).filter((p) => p.startsWith(`${tag}:`))

/** Every source file under src, as a path from the repository root. */
function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const full = join(ROOT, dir, name)
    const rel = relative(ROOT, full)
    return statSync(full).isDirectory() ? sourceFiles(rel) : /\.(tsx?|css)$/.test(name) ? [rel] : []
  })
}

describe('the heritage stylesheet as it stands', () => {
  it('finds the accent face where src/index.css gives it: one utility and one token', () => {
    expect(accent.classes).toEqual(['font-accent'])
    expect(accent.tokens).toEqual(['--font-accent'])
  })

  it('breaks none of the rules', () => {
    expect(problems(sheet, accent)).toEqual([])
  })

  it('names the accent face nowhere under src but src/index.css, and Caslon nowhere but here', () => {
    const files = sourceFiles('src')
    const accentNamed = files.filter((f) => new RegExp(`${ACCENT}|${ACCENT.replace(' ', '[_-]')}`, 'i').test(read(f)))
    expect(accentNamed).toEqual(['src/index.css'])
    expect(files.filter((f) => /caslon/i.test(read(f)))).toEqual([SHEET])
  })

  it('binds --font-display to Caslon, its fallback, Georgia and the generic serif, and --font-text to Source Serif the same way', () => {
    const scope = parseRules(sheet).find((r) => r.selector === GUARD)!
    expect(families(scope.decls.get('--font-display')!)).toEqual([CASLON, `${CASLON} Fallback`, 'Georgia', 'serif'])
    expect(families(scope.decls.get('--font-text')!)).toEqual(['Source Serif 4 Variable', 'Source Serif 4 Fallback', 'Georgia', 'serif'])
  })

  it('registers the display size as a length or a percentage, passed down from 36px, and sets 2.25rem on the scope', () => {
    const rules = parseRules(sheet)
    const registration = rules.find((r) => r.selector === `@property ${SIZE}`)!
    expect(registration.within).toBe('')
    expect(Object.fromEntries(registration.decls)).toEqual({ syntax: '"<length-percentage>"', inherits: 'true', 'initial-value': '36px' })
    expect(rules.filter((r) => r.selector.startsWith('@property'))).toEqual([registration])
    expect(rules.find((r) => r.selector === GUARD)!.decls.get(SIZE)).toBe('2.25rem')
  })

  it('gives the display size a length in rem or px, or a percentage, wherever a file under src sets it', () => {
    const values = sourceFiles('src').flatMap((file) => sizeSettings(read(file)).map((value) => ({ file, value })))
    expect(values).toContainEqual({ file: SHEET, value: '2.25rem' })
    expect(values.filter(({ value }) => !SIZE_VALUE.test(value))).toEqual([])
  })

  it('reads the reader\'s measure from the font: 70 zeros of Source Serif at 0.529em is 37em', () => {
    expect(ZERO).toBeCloseTo(0.529, 3)
  })

  it('gives each fallback face the vertical metrics of its face, read from the file', () => {
    const rules = parseRules(sheet).filter((r) => r.selector === '@font-face')
    const realFaces = declaredFaces(sheet, SHEET).filter((f) => f.woff2)
    expect(realFaces.length).toBe(3)
    for (const face of realFaces) {
      const metrics = fontMetrics(readFileSync(join(ROOT, face.woff2)))
      const name = `${face.family.replace(/ Variable$/, '')} Fallback`
      const fallback = rules.find((r) => families(r.decls.get('font-family') ?? '')[0] === name && (r.decls.get('font-style') ?? 'normal') === face.style)!
      expect(fallback, name).toBeTruthy()
      const pct = (d: string) => parseFloat(fallback.decls.get(d)!) / 100
      const size = pct('size-adjust')
      expect(pct('ascent-override') * size, `${name} ascent`).toBeCloseTo(metrics.ascent / metrics.unitsPerEm, 3)
      expect(pct('descent-override') * size, `${name} descent`).toBeCloseTo(Math.abs(metrics.descent) / metrics.unitsPerEm, 3)
      expect(pct('line-gap-override') * size, `${name} line gap`).toBeCloseTo(metrics.lineGap / metrics.unitsPerEm, 3)
      expect(fallback.decls.get('src'), name).toMatch(face.style === 'italic' ? /local\('Georgia Italic'\)/ : /^local\('Georgia'\)$/)
    }
  })
})

describe('each rule fails on a planted stylesheet', () => {
  const rule = (selector: string, body: string) => `\n${selector} { ${body} }\n`
  const without = (css: string, selector: string) => {
    const at = css.indexOf(`${selector} {`)
    if (at < 0) throw new Error(`no rule ${selector}`)
    return css.slice(0, at) + css.slice(css.indexOf('}', at) + 1)
  }
  const accentClass = () => accent.classes[0]

  it('the accent face: an override taken away, put in a layer or naming the face, or the token left alone', () => {
    expect(of(without(sheet, `${GUARD} .${accentClass()}`), 'accent')).toEqual([`accent: no rule gives .${accentClass()} another face inside the scope`])
    expect(of(without(sheet, `${GUARD}.${accentClass()}`), 'accent')).toEqual([`accent: no rule gives .${accentClass()} another face on the scope's own element`])
    expect(of(sheet.replace(/--font-accent:[^;]+;/, ''), 'accent')).toEqual([`accent: the scope does not set ${accent.tokens[0]}`])
    expect(of(sheet + rule(`${GUARD} [data-heritage~="figure"]`, `font-family: '${ACCENT}', serif`), 'accent').length).toBeGreaterThan(0)
    const layered = without(sheet, `${GUARD} .${accentClass()}`) + `@layer utilities {${rule(`${GUARD} .${accentClass()}`, 'font-family: var(--font-text)')}}`
    expect(of(layered, 'accent')).toContain(`accent: no rule gives .${accentClass()} another face inside the scope`)
    expect(of(layered, 'guard').length).toBeGreaterThan(0)
  })

  it('Caslon: named outside its token, or the token read by another rule', () => {
    expect(of(sheet + rule(`${GUARD} [data-heritage~="reader"] h3`, `font-family: '${CASLON}', serif`), 'caslon').length).toBeGreaterThan(0)
    expect(of(sheet + rule(`${GUARD} [data-heritage~="reader"]`, 'font-family: var(--font-display)'), 'caslon')).toContain(`caslon: ${GUARD} [data-heritage~="reader"] is neither a display heading nor a display figure`)
  })

  it('Caslon: under 32px, at a weight it does not have, on a heading without the hook, below h2, or in a table or the fixed-width face', () => {
    expect(of(sheet.replace('max(2rem, var(--display-size, 2.25rem))', '1.875rem'), 'caslon').some((p) => p.includes('under 32px'))).toBe(true)
    expect(of(sheet.replace('max(2rem, var(--display-size, 2.25rem))', 'max(1.75rem, var(--display-size, 1.75rem))'), 'caslon').some((p) => p.includes('under 32px'))).toBe(true)
    expect(of(sheet.replace(/font-weight: 400;\n\s*font-variant-numeric: normal;/, 'font-variant-numeric: normal;'), 'caslon').some((p) => p.includes('one weight'))).toBe(true)
    expect(of(sheet.replace(':is(h1, h2)[data-heritage~="display"]', ':is(h1, h2)'), 'caslon').some((p) => p.includes('without the display hook'))).toBe(true)
    expect(of(sheet.replace(':is(h1, h2)[data-heritage~="display"]', ':is(h1, h2, h3)[data-heritage~="display"]'), 'caslon').some((p) => p.includes('below h2'))).toBe(true)
    expect(of(sheet.replace(':not(table *, .font-mono, .font-mono *)', ':not(.font-mono, .font-mono *)'), 'caslon').some((p) => p.includes('tables'))).toBe(true)
    expect(of(sheet.replace(':not(table *, .font-mono, .font-mono *)', ':not(table *)'), 'caslon').some((p) => p.includes('fixed-width'))).toBe(true)
  })

  it('the display size: not registered, registered as another type, not passed down, from a size that is not fixed, inside an at-rule, not set on the scope, or a registration nothing reads', () => {
    const registration = new RegExp(`@property ${SIZE} \\{[^}]*\\}`)
    expect(sheet).toMatch(registration)
    expect(of(sheet.replace(registration, ''), 'size')).toEqual([`size: ${SIZE} is not registered as a length`])
    expect(of(sheet.replace('syntax: "<length-percentage>"', 'syntax: "*"'), 'size')).toEqual([`size: ${SIZE} is registered as "*", not a length`])
    expect(of(sheet.replace('syntax: "<length-percentage>"', 'syntax: "<number>"'), 'size')).toEqual([`size: ${SIZE} is registered as "<number>", not a length`])
    expect(of(sheet.replace('inherits: true', 'inherits: false'), 'size')).toEqual([`size: ${SIZE} is not passed down, so the scope's size would not reach a heading`])
    expect(of(sheet.replace('initial-value: 36px', 'initial-value: 2.25rem'), 'size')).toEqual([`size: ${SIZE} starts at 2.25rem, not a fixed length in px`])
    expect(of(sheet.replace(registration, (m) => `@media screen { ${m} }`), 'size')).toEqual([`size: ${SIZE} is registered inside @media screen`])
    expect(of(sheet.replace(`${SIZE}: 2.25rem;`, ''), 'size')).toEqual([`size: the scope does not set ${SIZE}`])
    expect(of(sheet.replace(`${SIZE}: 2.25rem;`, `${SIZE}: 1.5rem;`), 'size')).toEqual([`size: the scope sets ${SIZE} to 1.5rem`])
    const other = ['--planted', 'size'].join('-')
    expect(of(`${sheet}\n@property ${other} { syntax: "<length>"; inherits: true; initial-value: 0px; }`, 'guard')).toEqual([`guard: @property ${other} registers a property the display size does not read`])
    expect(of(sheet.replace(`var(${SIZE}, 2.25rem)`, `var(${other}, 2.25rem)`), 'size')).toEqual([`size: ${other} is not registered as a length`])
  })

  it('the display size set under src: a bare number, a unit of the heading\'s own font or a value that is not written out, in a style, a class, a declaration or a call', () => {
    const style = (value: string) => `<h1 data-heritage="display" style={{ '${SIZE}': ${value} }}>`
    const bad = (text: string) => sizeSettings(text).filter((value) => !SIZE_VALUE.test(value))
    expect(bad(style('40'))).toEqual(['40'])
    expect(bad(style("'3em'"))).toEqual(['3em'])
    expect(bad(style('size'))).toEqual(['size'])
    expect(bad(style('`${n}rem`'))).toEqual(['${n}rem'])
    expect(bad(`{ ['${SIZE}' as string]: 40 }`)).toEqual(['40'])
    expect(bad(`<div className="${['[' + SIZE, '3em]'].join(':')}">`)).toEqual(['3em'])
    expect(bad(`h1 { ${SIZE}: 2.5ch; }`)).toEqual(['2.5ch'])
    expect(bad(`el.style.setProperty('${SIZE}', '40')`)).toEqual(['40'])
    // A length in rem or px, a percentage, and a var() that reads it pass.
    expect(bad(`${style("'3rem'")}${style("'40px'")}h2 { ${SIZE}: 150%; font-size: max(2rem, var(${SIZE}, 2.25rem)); }`)).toEqual([])
    expect(sizeSettings(`${style("'3rem'")} ${['[' + SIZE, '48px]'].join(':')}`)).toEqual(['3rem', '48px'])
    // A list of names is not a setting; only a call to setProperty gives its second argument.
    expect(sizeSettings(`const names = ['${SIZE}', '--font-text']`)).toEqual([])
  })

  it('small capitals: asked of the browser, at another size or tracking, or without capitals', () => {
    const caps = `${GUARD} .small-caps`
    expect(of(sheet + rule(caps, 'font-variant-caps: all-small-caps'), 'caps').length).toBeGreaterThan(0)
    expect(of(sheet + rule(`${GUARD} [data-heritage~="reader"] th`, 'font-feature-settings: "smcp"'), 'caps').length).toBeGreaterThan(0)
    expect(of(sheet.replace('font-size: 0.85em', 'font-size: 0.8em'), 'caps')).toEqual(['caps: the class is not at 0.85em'])
    expect(of(sheet.replace('letter-spacing: 0.07em', 'letter-spacing: 0.1em'), 'caps')).toEqual(['caps: the tracking is not 0.06em to 0.08em'])
    expect(of(sheet.replace('text-transform: uppercase;', ''), 'caps')).toEqual(['caps: the class does not set capitals'])
  })

  it('controls: a button, a field, a chip, a status tag, a date block, a result cell, the fixed-width face or a focus ring restyled, or the radius token changed', () => {
    const slot = (name: string) => `[data-slot="${name}"]`
    for (const [subject, body] of [
      [CONTROL_TYPES[0], 'font-family: var(--font-text)'],
      [`[data-heritage~="reader"] ${CONTROL_TYPES[1]}`, 'font-family: var(--font-text)'],
      [`:is(p, ${CONTROL_TYPES[3]})[data-heritage~="reader"]`, 'font-family: var(--font-text)'],
      [slot(CONTROL_SLOTS[0]), 'border-radius: 2px'],
      [slot(CONTROL_SLOTS[1]), 'border-radius: 2px'],
      [`${slot(CONTROL_SLOTS[2])} .small-caps`, 'letter-spacing: 0.07em'],
      [slot(CONTROL_SLOTS[2]), 'border-radius: 2px'],
      [slot(CONTROL_SLOTS[5]), 'font-family: var(--font-text)'],
      [slot(CONTROL_SLOTS[6]), 'font-family: var(--font-text)'],
      [`.${CONTROL_CLASSES[0]}`, 'font-family: var(--font-text)'],
      ['[data-status]', 'border-radius: 2px'],
      [`[data-heritage~="card"]:${FOCUS[1]}`, 'outline-color: red'],
    ]) {
      expect(of(sheet + rule(`${GUARD} ${subject}`, body), 'controls').length, subject).toBeGreaterThan(0)
    }
    expect(of(sheet.replace('--font-accent: var(--font-text);', '--font-accent: var(--font-text);\n  --radius: 2px;'), 'controls').length).toBeGreaterThan(0)
    expect(of(sheet + rule(`${GUARD} [data-heritage~="card"]`, 'box-shadow: none'), 'controls').length).toBeGreaterThan(0)
  })

  it('controls are found inside :is() and not inside :not(), which leaves them out', () => {
    expect(of(sheet + rule(`${GUARD} [data-heritage~="card"]:not(${CONTROL_TYPES[0]})`, 'border-radius: 2px'), 'controls')).toEqual([])
  })

  it('tags alone and the scope\'s own element: a face on every paragraph, or on the scope itself', () => {
    expect(of(sheet + rule(`${GUARD} p`, 'font-family: var(--font-text)'), 'tags').length).toBeGreaterThan(0)
    expect(of(sheet + rule(`${GUARD} :is(h1, h2)`, 'letter-spacing: 0'), 'tags').length).toBeGreaterThan(0)
    expect(of(sheet + rule(`${GUARD} :is(p, [data-heritage~="card"])`, 'letter-spacing: 0'), 'tags').length).toBeGreaterThan(0)
    expect(of(sheet.replace('--font-accent: var(--font-text);', '--font-accent: var(--font-text);\n  font-family: var(--font-text);'), 'container')).toEqual([`container: ${GUARD} sets font-family on the scope's own element`])
    expect(of(sheet + rule(`${GUARD}[data-fixture]`, 'font-size: 1.125rem'), 'container').length).toBeGreaterThan(0)
  })

  it('the guard: a rule that does not wait for the new look, or sits in a layer or a media query', () => {
    const bare = '[data-theme="heritage"] .small-caps'
    expect(of(sheet + rule(bare, 'letter-spacing: 0.07em'), 'guard')).toEqual([`guard: ${bare} does not wait for the new look`])
    expect(of(`${sheet}\n@layer components {${rule(`${GUARD} [data-heritage~="card"]`, 'border-radius: 2px')}}`, 'guard').length).toBeGreaterThan(0)
    expect(of(`${sheet}\n@media (min-width: 40rem) {${rule(`${GUARD} [data-heritage~="card"]`, 'border-radius: 2px')}}`, 'guard').length).toBeGreaterThan(0)
  })

  it('the reader: another size, line height or measure, a measure in ch, or figures that are not tabular', () => {
    expect(of(sheet.replace('font-size: 1.125rem', 'font-size: 1rem'), 'reader').length).toBe(1)
    expect(of(sheet.replace('line-height: 1.6', 'line-height: 1.5'), 'reader').length).toBe(1)
    expect(of(sheet.replace('max-width: 37em', 'max-width: 70ch'), 'reader')).toEqual(['reader: the measure 70ch is not in em'])
    expect(of(sheet.replace('max-width: 37em', 'max-width: 45em'), 'reader').length).toBe(1)
    expect(of(sheet.replace(`${LINING} tabular-nums`, LINING), 'reader')).toEqual(['reader: the figures are not lining and tabular'])
  })

  it('the radius: on another element, missing from a hook, or not 2px', () => {
    expect(of(sheet + rule(`${GUARD} [data-heritage~="reader"]`, 'border-radius: 2px'), 'radius')).toEqual(['radius: [data-heritage~="reader"] gets a radius'])
    expect(of(sheet.replace(', [data-slot="lca-logo-mat"]', ''), 'radius')).toEqual(['radius: [data-slot="lca-logo-mat"] gets none'])
    expect(of(sheet.replace('border-radius: 2px', 'border-radius: 4px'), 'radius').length).toBe(1)
  })

  it('the fallback faces: one taken away, one naming a file, one that is not Georgia, one missing an override', () => {
    const italicFallback = /@font-face \{\n\s*font-family: 'Source Serif 4 Fallback';\n\s*font-style: italic;[^}]*\}/
    expect(sheet).toMatch(italicFallback)
    expect(of(sheet.replace(italicFallback, ''), 'fallback')).toEqual(['fallback: no fallback face for Source Serif 4 Variable italic'])
    const caslonFallback = /@font-face \{\n\s*font-family: 'Libre Caslon Display Fallback';[^}]*\}/
    expect(sheet).toMatch(caslonFallback)
    expect(of(sheet.replace(caslonFallback, ''), 'fallback')).toEqual(['fallback: no fallback face for Libre Caslon Display normal'])
    expect(of(sheet.replace("src: local('Georgia Italic'), local('Georgia-Italic');", "src: local('Times New Roman');"), 'fallback')).toEqual(['fallback: Source Serif 4 Fallback is not Georgia'])
    expect(of(sheet.replace("src: local('Georgia Italic'), local('Georgia-Italic');", "src: local('Georgia Italic'), url(\"./georgia-italic.woff2\");"), 'fallback')).toContain('fallback: Source Serif 4 Fallback names a file')
    expect(of(sheet.replace('  line-gap-override: 0%;\n}\n\n@font-face {\n  font-family: \'Source Serif 4 Fallback\';\n  font-style: normal;', "}\n\n@font-face {\n  font-family: 'Source Serif 4 Fallback';\n  font-style: normal;"), 'fallback')).toEqual(['fallback: Libre Caslon Display Fallback has no line-gap-override'])
  })
})
