// @vitest-environment jsdom
//
// Heritage's controls at the colour layer (WS01 step 31, acceptance
// criterion 13), worked out from src/index.css without a browser: the custom
// properties each element ends up with are cascaded as a browser does it,
// with the rules matched against a real element tree by the DOM's own
// selector matching, inherited from the element's parent, an `inherit` taken
// from the parent, and every var() replaced on the element that declares it.
//
// - A Button, a status tag and its mark, a status dot, a filter chip and its
//   remove button, a date block, a pill in the muted pair, a text field, a
//   text area and a select end up with the same values inside a heritage
//   scope as inside a base scope, and as with no scope at all: in the light
//   look, in dark mode and on a printed page. A control inside a base scope
//   nested in heritage does too. The only properties that differ are ones no
//   control reads (the sidebar's and heritage's own baize and claret).
// - The rest of the heritage page keeps its look: a card, a list's box, a
//   ground with only one of the muted pair's classes, and the layout's own
//   scope element take heritage's paper, surfaces, lines and muted words.
// - The rule that puts the base look back on the controls follows the base
//   look and the shadcn variables, so it cannot drift: its light values are
//   the base light block's, its worked-out variables are the shadcn rule's
//   own expressions, every token heritage changes is put back, and every
//   shadcn variable worked out from those tokens is worked out again (the
//   sidebar's aside); its dark half puts back the same tokens with inherit,
//   on screens only, for the same slots, and every slot it names exists.
// - With newLook off a heritage scope and the controls in it end up with
//   exactly the values of the page around them, so the layout's box, drawn
//   on bg-ground with the ground as its shadow, paints the page's own white
//   and the six pages look as they do today.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ROOT, applies, indexCssRules, read, stripComments, substitute, type CssRule } from './helpers/cssTokens'

const RULES = indexCssRules()

/** How the page is shown: newLook on or off, the light look or dark mode, on a screen or printed. */
interface Shown {
  look: boolean
  dark: boolean
  print?: boolean
}
const LIGHT: Shown = { look: true, dark: false }
const DARK: Shown = { look: true, dark: true }
const PRINTED_DARK: Shown = { look: true, dark: true, print: true }
const OLD_LOOK: Shown = { look: false, dark: false }
const SHOWN: ReadonlyArray<[string, Shown]> = [['light', LIGHT], ['dark', DARK], ['printed from a dark device', PRINTED_DARK]]

/** Specificity as one number: ids, then classes, attributes and pseudo-classes, then element names. */
function specificityOf(selector: string): number {
  const s = selector.replace(/"[^"]*"/g, '""')
  const ids = (s.match(/#[\w-]+/g) ?? []).length
  const classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) ?? []).length
  const types = (s.match(/(?:^|[\s>+~(])[a-z][\w-]*/gi) ?? []).length
  return ids * 10_000 + classes * 100 + types
}

/** Whether a selector matches an element; one the DOM cannot read (such as :focus-visible) matches nothing here, as nothing here has the focus. */
function matchesSelector(el: Element, selector: string): boolean {
  try {
    return el.matches(selector)
  } catch {
    return false
  }
}

/** The custom properties an element ends up with, as a browser works them out. */
function tokensOf(el: Element, shown: Shown, cache = new Map<Element, Map<string, string>>()): Map<string, string> {
  const known = cache.get(el)
  if (known) return known
  const inherited = el.parentElement ? tokensOf(el.parentElement, shown, cache) : new Map<string, string>()
  const hits: Array<{ spec: number; order: number; decls: Map<string, string> }> = []
  for (const rule of RULES) {
    if (!applies(rule, shown.print) || rule.selector.startsWith('@')) continue
    let spec = -1
    for (const selector of rule.selectors) if (matchesSelector(el, selector)) spec = Math.max(spec, specificityOf(selector))
    if (spec >= 0) hits.push({ spec, order: rule.order, decls: rule.decls })
  }
  hits.sort((a, b) => a.spec - b.spec || a.order - b.order)
  const raw = new Map(inherited)
  for (const hit of hits) {
    for (const [name, value] of hit.decls) {
      if (!name.startsWith('--')) continue
      raw.set(name, value === 'inherit' ? inherited.get(name) ?? 'not set' : value)
    }
  }
  const out = new Map<string, string>()
  for (const [name, value] of raw) {
    try {
      out.set(name, substitute(value, raw))
    } catch {
      out.set(name, `unresolved ${value}`)
    }
  }
  cache.set(el, out)
  return out
}

/** Puts <html> in the state shown, the markup in the body, and gives back the element marked data-probe. */
function probe(shown: Shown, markup: string): Element {
  const html = document.documentElement
  if (shown.look) html.setAttribute('data-look', 'new')
  else html.removeAttribute('data-look')
  html.classList.toggle('dark', shown.dark)
  document.body.innerHTML = markup
  const el = document.querySelector('[data-probe]')
  if (!el) throw new Error(`no data-probe in ${markup}`)
  return el
}

/** The names whose values differ between two elements' properties, with both values. */
function differences(a: Map<string, string>, b: Map<string, string>): Record<string, [string | undefined, string | undefined]> {
  const out: Record<string, [string | undefined, string | undefined]> = {}
  for (const name of new Set([...a.keys(), ...b.keys()])) if (a.get(name) !== b.get(name)) out[name] = [a.get(name), b.get(name)]
  return out
}

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('data-look')
  document.documentElement.classList.remove('dark')
})

/** The controls, each with a part inside it that inherits from it. */
const CONTROLS: ReadonlyArray<[string, string]> = [
  ['a Button', '<button data-slot="button" data-probe><svg></svg></button>'],
  ['a status tag', '<span data-slot="status-badge" data-probe><svg data-slot="status-mark"></svg></span>'],
  ['a status dot', '<span data-slot="status-dot" data-probe></span>'],
  ['a filter chip', '<span data-slot="filter-chip" data-probe><button data-slot="filter-chip-remove"></button></span>'],
  ['a date block', '<span data-slot="date-block" data-probe><span></span></span>'],
  ['a pill in the muted pair', '<span class="bg-muted text-muted-foreground" data-probe></span>'],
  ['a text field', '<input data-probe>'],
  ['a text area', '<textarea data-probe></textarea>'],
  ['a select', '<select data-probe></select>'],
]

/** Properties heritage sets that no control reads: the sidebar's, and heritage's own two colours, which base has none of. */
const NOT_READ_BY_CONTROLS = ['--sidebar', '--sidebar-primary-foreground', '--sidebar-accent', '--sidebar-border', '--baize', '--claret']

/** A control's properties in a scope of the given markup around it ("" for none). */
function controlIn(shown: Shown, around: 'none' | 'base' | 'heritage' | 'base in heritage', control: string): { control: Map<string, string>; inner: Map<string, string> | null } {
  const wrapped = {
    none: control,
    base: `<div data-theme="">${control}</div>`,
    heritage: `<div data-theme="heritage">${control}</div>`,
    'base in heritage': `<div data-theme="heritage"><div data-theme="">${control}</div></div>`,
  }[around]
  const el = probe(shown, wrapped)
  const cache = new Map<Element, Map<string, string>>()
  const child = el.firstElementChild
  return { control: tokensOf(el, shown, cache), inner: child ? tokensOf(child, shown, cache) : null }
}

describe('a control ends up with the same colours inside heritage as inside base', () => {
  for (const [scheme, shown] of SHOWN) {
    it.each(CONTROLS)(`${scheme}: %s`, (_name, control) => {
      const base = controlIn(shown, 'base', control)
      const bare = controlIn(shown, 'none', control)
      const heritage = controlIn(shown, 'heritage', control)
      const nested = controlIn(shown, 'base in heritage', control)
      // The reference: a base scope gives what a page with no scope gives.
      expect(differences(base.control, bare.control)).toEqual({})
      // Inside heritage, and inside a base scope inside heritage, only properties no control reads differ.
      for (const [where, got] of [['heritage', heritage], ['base in heritage', nested]] as const) {
        const changed = Object.keys(differences(base.control, got.control))
        expect(changed.filter((name) => !NOT_READ_BY_CONTROLS.includes(name)), `${scheme}, ${where}: ${JSON.stringify(differences(base.control, got.control))}`).toEqual([])
        if (base.inner && got.inner) {
          const inner = Object.keys(differences(base.inner, got.inner))
          expect(inner.filter((name) => !NOT_READ_BY_CONTROLS.includes(name)), `${scheme}, ${where}, the part inside`).toEqual([])
        }
      }
      // The colours a control draws with, spelled out.
      for (const name of ['--background', '--foreground', '--primary', '--primary-foreground', '--secondary', '--muted', '--muted-foreground', '--accent', '--border', '--input', '--ring', '--focus', '--ground', '--surface', '--surface-2', '--hairline', '--field', '--ink-muted', '--gold-ink', '--status-closed-tint', '--status-soon']) {
        expect(heritage.control.get(name), `${scheme}: ${name}`).toBe(base.control.get(name))
        expect(heritage.control.get(name), `${scheme}: ${name}`).not.toMatch(/unresolved|not set/)
      }
    })
  }

  it('in the light look a control inside heritage takes the light look\'s own values, worked out on the control', () => {
    const { control } = controlIn(LIGHT, 'heritage', CONTROLS[0][1])
    expect(Object.fromEntries(['--ground', '--surface', '--surface-2', '--hairline', '--field', '--ink-muted', '--gold-ink', '--primary-foreground', '--input', '--border'].map((n) => [n, control.get(n)]))).toEqual({
      '--ground': '#fff',
      '--surface': '#fff',
      '--surface-2': '#f7f8fa',
      '--hairline': '#e5e7ed',
      '--field': '#7c8496',
      '--ink-muted': '#5b6478',
      '--gold-ink': '#866a1e',
      '--primary-foreground': '#fff',
      '--input': '#7c8496',
      '--border': '#e5e7ed',
    })
  })

  it('none of the properties that differ is read by a control', () => {
    const files = ['src/components/ui/button.tsx', 'src/components/ui/input.tsx', 'src/components/ui/textarea.tsx', 'src/components/ui/filter-chip.tsx', 'src/components/StatusBadge.tsx', 'src/components/DateBlock.tsx', 'src/lib/brand.ts']
    for (const file of files) {
      const code = stripComments(read(file))
      for (const name of NOT_READ_BY_CONTROLS) {
        const bare = name.slice(2)
        expect(new RegExp(`(?:^|[^\\w-])(?:bg|text|border|ring|fill|stroke|outline|from|to|via)-${bare}(?![\\w-])|--${bare}(?![\\w-])`).test(code), `${file} reads ${name}`).toBe(false)
      }
    }
  })
})

describe('the rest of a heritage page keeps the heritage look', () => {
  const ELEMENTS: ReadonlyArray<[string, string]> = [
    ['a card with the card hook', '<div data-heritage="card" class="bg-card" data-probe></div>'],
    ['the box of an empty list', '<div class="rounded-xl border bg-card" data-probe><p class="text-muted-foreground"></p></div>'],
    ['a ground with only one of the muted pair\'s classes', '<div class="bg-muted" data-probe></div>'],
    ['a label', '<label data-probe></label>'],
  ]

  it.each(ELEMENTS)('light: %s takes heritage\'s paper, surfaces, lines and muted words', (_name, markup) => {
    const el = probe(LIGHT, `<div data-theme="heritage">${markup}</div>`)
    const tokens = tokensOf(el, LIGHT)
    expect(Object.fromEntries(['--background', '--card', '--muted', '--muted-foreground', '--border', '--input', '--gold-ink'].map((n) => [n, tokens.get(n)]))).toEqual({
      '--background': '#f7f3e8',
      '--card': '#fffdf8',
      '--muted': '#ece4d0',
      '--muted-foreground': '#5e5a52',
      '--border': '#d8cdb4',
      '--input': '#857d6b',
      '--gold-ink': '#705718',
    })
  })

  it('the layout\'s own scope element draws the paper ground, and in dark mode the dark look\'s ground', () => {
    const markup = '<div data-theme="heritage" data-layout="heritage" class="bg-ground text-foreground" data-probe></div>'
    expect(tokensOf(probe(LIGHT, markup), LIGHT).get('--ground')).toBe('#f7f3e8')
    expect(tokensOf(probe(DARK, markup), DARK).get('--ground')).toBe('#0b1220')
    expect(tokensOf(probe(DARK, '<div data-theme="" data-probe></div>'), DARK).get('--ground')).toBe('#0b1220')
  })
})

/** The rules in src/index.css that put the base look back on heritage's controls: the light one and the dark one. */
function controlRules(): { light: CssRule; dark: CssRule } {
  const light = RULES.filter((r) => r.within === '' && r.selectors.includes(':root[data-look="new"] [data-theme="heritage"] [data-slot="button"]'))
  const dark = RULES.filter((r) => r.selectors.includes(':root[data-look="new"].dark [data-theme="heritage"] [data-slot="button"]'))
  expect(light).toHaveLength(1)
  expect(dark).toHaveLength(1)
  return { light: light[0], dark: dark[0] }
}

/** The one rule whose selectors are exactly these. */
function ruleOf(selectors: string[]): CssRule {
  const found = RULES.filter((r) => r.within === '' && r.selectors.length === selectors.length && selectors.every((s) => r.selectors.includes(s)))
  expect(found, selectors.join(', ')).toHaveLength(1)
  return found[0]
}

describe('the rule that puts the base look back on the controls cannot drift from the base look', () => {
  const { light, dark } = controlRules()
  const baseLight = ruleOf([':root[data-look="new"]', ':root[data-look="new"] [data-theme=""]'])
  const heritageLight = ruleOf([':root[data-look="new"] [data-theme="heritage"]'])
  const shadcn = RULES.filter((r) => r.within === '' && r.decls.has('--primary-foreground') && r.selectors.includes(':root[data-look="new"] [data-theme]'))
  const tokens = [...light.decls.keys()].filter((name) => !shadcn[0].decls.has(name))
  const worked = [...light.decls.keys()].filter((name) => shadcn[0].decls.has(name))

  it('finds one shadcn rule and splits the controls rule into tokens and worked-out variables', () => {
    expect(shadcn).toHaveLength(1)
    expect(tokens.length).toBeGreaterThan(0)
    expect(worked.length).toBeGreaterThan(0)
    for (const value of light.decls.values()) expect(value).not.toBe('inherit')
  })

  it('its light values are the base light block\'s, token by token', () => {
    for (const name of tokens) expect(light.decls.get(name), name).toBe(baseLight.decls.get(name))
  })

  it('its worked-out variables are the shadcn rule\'s own expressions', () => {
    for (const name of worked) expect(light.decls.get(name), name).toBe(shadcn[0].decls.get(name))
  })

  it('puts back every token heritage sets to a value of its own, and nothing heritage leaves alone', () => {
    const changed = [...heritageLight.decls.keys()].filter((name) => baseLight.decls.has(name) && heritageLight.decls.get(name) !== baseLight.decls.get(name))
    expect([...tokens].sort()).toEqual([...changed].sort())
    // Heritage's own colours, which base has none of, are not a control's.
    expect([...heritageLight.decls.keys()].filter((name) => !baseLight.decls.has(name)).sort()).toEqual(['--baize', '--claret'])
  })

  it('works out again every shadcn variable that reads one of those tokens, the sidebar\'s aside', () => {
    const reads = (expr: string) => tokens.some((t) => new RegExp(`var\\(${t}[,)]`).test(expr))
    const needed = [...shadcn[0].decls].filter(([, expr]) => reads(expr)).map(([name]) => name)
    expect(needed.filter((name) => !worked.includes(name)).sort()).toEqual(['--sidebar', '--sidebar-accent', '--sidebar-border', '--sidebar-primary-foreground'])
    expect(worked.filter((name) => !needed.includes(name))).toEqual([])
  })

  it('its dark half puts the same tokens back with inherit, on screens only, for the same elements', () => {
    expect(dark.within).toBe('@media screen')
    expect([...dark.decls.keys()].sort()).toEqual([...tokens].sort())
    for (const [name, value] of dark.decls) expect(value, name).toBe('inherit')
    expect(dark.selectors).toEqual(light.selectors.map((s) => s.replace(':root[data-look="new"] ', ':root[data-look="new"].dark ')))
    // Heritage in dark mode sets each of those tokens to the dark look's value, so inherit gives the dark look's values.
    const screenRule = (selectors: string[]) => RULES.filter((r) => r.within === '@media screen' && r.selectors.length === selectors.length && selectors.every((s) => r.selectors.includes(s)))
    const heritageDark = screenRule([':root[data-look="new"].dark [data-theme="heritage"]'])
    const baseDark = screenRule([':root[data-look="new"].dark', ':root[data-look="new"].dark [data-theme=""]'])
    expect([heritageDark.length, baseDark.length]).toEqual([1, 1])
    for (const name of tokens) expect(heritageDark[0].decls.get(name), name).toBe(baseDark[0].decls.get(name))
  })

  it('names only slots that a component in src draws', () => {
    const slots = light.selectors.map((s) => s.match(/\[data-slot="([^"]+)"\]$/)?.[1]).filter((s): s is string => !!s)
    expect(slots.sort()).toEqual(['button', 'date-block', 'filter-chip', 'status-badge', 'status-dot'])
    const sources: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(join(ROOT, dir))) {
        const rel = `${dir}/${name}`
        if (statSync(join(ROOT, rel)).isDirectory()) walk(rel)
        else if (/\.tsx?$/.test(name)) sources.push(readFileSync(join(ROOT, rel), 'utf8'))
      }
    }
    walk('src')
    for (const slot of slots) expect(sources.some((text) => text.includes(`data-slot="${slot}"`)), slot).toBe(true)
  })
})

describe('with newLook off a heritage scope changes nothing', () => {
  it('the scope and every control in it end up with exactly the values of the page around them', () => {
    const html = tokensOf(probe(OLD_LOOK, '<div data-probe></div>').parentElement!.parentElement!, OLD_LOOK)
    const scope = tokensOf(probe(OLD_LOOK, '<div data-theme="heritage" data-layout="heritage" class="bg-ground text-foreground" data-probe></div>'), OLD_LOOK)
    expect(differences(html, scope)).toEqual({})
    for (const [name, control] of CONTROLS) {
      const inside = tokensOf(probe(OLD_LOOK, `<div data-theme="heritage">${control}</div>`), OLD_LOOK)
      const outside = tokensOf(probe(OLD_LOOK, control), OLD_LOOK)
      expect(differences(outside, inside), name).toEqual({})
    }
  })

  it('the layout\'s ground and shadow are the page\'s own white, and its words the page\'s', () => {
    const scope = tokensOf(probe(OLD_LOOK, '<div data-theme="heritage" data-probe></div>'), OLD_LOOK)
    // bg-ground reads --ground and the page's body bg-background reads --background: the same white.
    expect(scope.get('--ground')).toBe(scope.get('--background'))
    expect(scope.get('--ground')).toBe('oklch(1 0 0)')
    // text-foreground is the body's own colour, so the words inside keep theirs.
    expect(scope.get('--foreground')).toBe('oklch(0.145 0 0)')
    // The layout's classes are the ones this test reads.
    const layout = stripComments(read('src/layouts/HeritageLayout.tsx'))
    expect(layout).toMatch(/className="bg-ground text-foreground shadow-\[0_100vh_0_100vh_var\(--ground\)\]"/)
  })
})
