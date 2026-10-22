// @vitest-environment jsdom
//
// The heritage look's rules on a page, matched by the DOM's own selector
// engine (WS01 step 30). test/unit/heritage-css.test.ts reads the selectors
// of src/styles/themes/heritage.css as text; this matches each rule against
// the elements of a page, the way a browser decides which rules apply.
//
// - On a heritage page under the new look, the face, size and radius rules
//   reach only the elements that carry a hook: the display hook on an h1 or
//   an h2, a display figure outside tables and the fixed-width face, the
//   reader, the small capitals class, the card, table and mat hooks and the
//   About page's logo frame. The scope's own element takes only the tokens.
//   No rule reaches a control (a button, a link drawn as one, a field, a
//   list, a status tag or dot, a chip, a date block, a result cell, figures
//   in the fixed-width face) or a form in a base scope inside heritage.
// - With newLook off, in another look and outside any scope, no rule
//   reaches anything; in dark mode the same rules reach the same elements.
// - The fixture page itself, drawn in the heritage look: none of its
//   elements takes a rule but the scope's tokens, so it looks as it did, and
//   with step 31's hooks put on its heading and sections its controls still
//   take none.
// - The base look's accent face: every element with its class inside a
//   heritage scope, a base scope inside heritage included, takes a rule
//   naming another face, and those rules are in no layer while the class is
//   in the utility layer, so they win.
// - Each check fails on a planted stylesheet, the names put together when
//   the test runs.
// - ThemeScope: a heritage scope drawn in strict mode and taken away before
//   its file arrives leaves no warning or error, and once the file has
//   arrived no later heritage scope asks for it again.
import { StrictMode, type ComponentType, type ReactNode } from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseRules, read, type CssRule } from './helpers/cssTokens'

const fonts = vi.hoisted(() => ({ live: vi.fn(), heritage: vi.fn() }))
vi.mock('@/styles/themes/live.css', () => {
  fonts.live()
  return {}
})
vi.mock('@/styles/themes/heritage.css', () => {
  fonts.heritage()
  return {}
})

const SHEET = 'src/styles/themes/heritage.css'
const GUARD = ':root[data-look="new"] [data-theme="heritage"]'
const sheet = read(SHEET)
/** The rules that style elements: not the faces, nor the registration of the display size (@property), which match no element. */
const styleRules = (css: string) => parseRules(css).filter((rule) => !rule.selector.startsWith('@'))
const RULES = styleRules(sheet)

/** The base look's accent class and face, put together so the stylesheet build does not take them for classes this file uses. */
const ACCENT_CLASS = ['font', 'accent'].join('-')
const ACCENT_FACE = ['Instrument', 'Serif'].join(' ')

type Kind = 'tokens' | 'display' | 'reader' | 'caps' | 'radius' | 'accent' | 'accent-own'

/** What a rule does, read from its declarations. */
function kindOf(rule: CssRule): Kind {
  const props = [...rule.decls.keys()]
  const family = rule.decls.get('font-family') ?? ''
  if (props.every((p) => p.startsWith('--'))) return 'tokens'
  if (family.includes('--font-display')) return 'display'
  if (rule.decls.has('max-width')) return 'reader'
  if (rule.decls.has('text-transform')) return 'caps'
  if (rule.decls.has('border-radius')) return 'radius'
  if (family === 'inherit') return 'accent-own'
  if (family.includes('--font-text') && props.length === 1) return 'accent'
  throw new Error(`a rule of no known kind: ${rule.selector}`)
}

const matching = (el: Element, rules: CssRule[]) => rules.filter((rule) => el.matches(rule.selector))
const kindsOf = (el: Element, rules = RULES) => [...new Set(matching(el, rules).map(kindOf))].sort()

/** The hooks and controls of a page, in the heritage look and in the others; each id names what the element is. */
const PAGE = `
<main id="page">
  <div data-theme="heritage" id="scope">
    <h1 data-heritage="display" id="display-h1">Our history</h1>
    <h2 data-heritage="display card" id="display-card-h2">Since <span id="in-heading">1915</span></h2>
    <h1 id="plain-h1">A heading with no hook</h1>
    <h2 id="plain-h2">Another</h2>
    <h3 data-heritage="display" id="display-h3">Below h2</h3>
    <p data-heritage="display" id="display-p">Not a heading</p>
    <p id="text">More than <span data-heritage="figure" id="figure">300</span> members</p>
    <div data-heritage="card" id="card">
      <span data-heritage="figure" id="figure-in-card">1915</span>
      <button type="button" id="button-in-card">Join</button>
    </div>
    <table data-heritage="table" id="table">
      <thead><tr><th id="th"><span data-heritage="figure" id="figure-in-head">Rating</span></th></tr></thead>
      <tbody><tr><td id="td"><span data-heritage="figure" id="figure-in-cell">1850</span></td><td id="td-result"><span data-slot="result-cell" data-result="W" id="result-cell">W</span></td></tr></tbody>
    </table>
    <span class="font-mono" id="mono"><span data-heritage="figure" id="figure-in-mono">3</span></span>
    <span class="font-mono" data-heritage="figure" id="figure-on-mono">13</span>
    <div data-heritage="reader" id="reader"><p id="reader-text">The bylaws</p></div>
    <span class="small-caps" id="caps">Honour board</span>
    <p class="${ACCENT_CLASS}" id="accent">A quotation</p>
    <div data-slot="lca-logo-mat" id="logo-mat"><img data-slot="lca-logo" alt="" id="logo"></div>
    <div data-heritage="mat" id="mat"></div>
    <button type="button" data-slot="button" id="button">Register</button>
    <a href="/tournaments" data-slot="button" id="link-button">See details</a>
    <label for="field" id="label">Your name</label>
    <input id="field">
    <input type="checkbox" id="checkbox">
    <select id="select"><option id="option">Classical</option></select>
    <textarea id="textarea"></textarea>
    <span data-slot="status-badge" data-status="open" id="badge"><svg data-slot="status-mark" id="badge-mark"></svg>Registration open</span>
    <span data-slot="status-dot" id="dot">Draft</span>
    <span data-slot="filter-chip" id="chip"><button type="button" data-slot="filter-chip-toggle" aria-pressed="true" id="chip-toggle"><span data-slot="filter-chip-label" id="chip-label">Classical</span><span data-slot="filter-chip-count" class="font-mono" id="chip-count">2</span></button></span>
    <time data-slot="date-block" datetime="2026-10-24" id="date">Sat, Oct 24</time>
    <div data-theme="" id="base">
      <form id="form"><label for="base-field" id="base-label">Minutes</label><input id="base-field"><button type="submit" data-slot="button" id="base-button">Save</button></form>
      <p class="${ACCENT_CLASS}" id="accent-in-base">A quotation in the base look</p>
    </div>
  </div>
  <div data-theme="heritage" class="${ACCENT_CLASS}" id="accent-scope"><p id="accent-scope-text">A scope given the class</p></div>
  <div data-theme="live" id="live"><h1 data-heritage="display" id="live-h1">Round 3</h1><span class="small-caps" id="live-caps">Board</span><div data-heritage="card reader" id="live-card">x</div><p class="${ACCENT_CLASS}" id="live-accent">x</p></div>
  <div data-theme="scholastic" id="scholastic"><h2 data-heritage="display" id="scholastic-h2">Grades</h2><span data-heritage="figure" id="scholastic-figure">12</span></div>
  <h1 data-heritage="display" id="outside-h1">Outside any scope</h1>
  <span class="small-caps" id="outside-caps">Outside</span>
</main>`

/** What each element of the page takes under the new look; every element not listed takes nothing. */
const EXPECTED: Record<string, Kind[]> = {
  scope: ['tokens'],
  'display-h1': ['display'],
  'display-card-h2': ['display', 'radius'],
  figure: ['display'],
  'figure-in-card': ['display'],
  card: ['radius'],
  table: ['radius'],
  reader: ['reader'],
  caps: ['caps'],
  accent: ['accent'],
  'logo-mat': ['radius'],
  mat: ['radius'],
  'accent-in-base': ['accent'],
  'accent-scope': ['accent-own', 'tokens'],
}

/** The controls of the page: nothing in the look may restyle them, nor what holds them. */
const CONTROLS = '#page button, #page a[data-slot="button"], #page input, #page select, #page option, #page textarea, #page label, #page [data-slot]:not([data-slot^="lca-logo"]), #page .font-mono, #page form, #page [data-theme=""]'

function setRoot(look: boolean, dark = false) {
  const html = document.documentElement
  if (look) html.setAttribute('data-look', 'new')
  else html.removeAttribute('data-look')
  html.classList.toggle('dark', dark)
}

/** Each element of the page with what it takes, for every element that takes something. */
function taken(root: ParentNode, rules = RULES): Record<string, Kind[]> {
  const out: Record<string, Kind[]> = {}
  for (const el of root.querySelectorAll('*')) {
    const kinds = kindsOf(el, rules)
    if (kinds.length > 0) out[el.id || el.tagName.toLowerCase()] = kinds
  }
  return out
}

/** Every problem with how a heritage stylesheet's rules reach the page, each tagged with the rule it breaks. */
function problems(rules: CssRule[]): string[] {
  const out: string[] = []
  const got = taken(document.body, rules)
  for (const id of new Set([...Object.keys(got), ...Object.keys(EXPECTED)])) {
    const want = (EXPECTED[id] ?? []).join(', ')
    const has = (got[id] ?? []).join(', ')
    if (want !== has) out.push(`reach: #${id} takes [${has}], not [${want}]`)
  }
  for (const el of document.querySelectorAll(CONTROLS)) {
    for (const rule of matching(el, rules)) out.push(`controls: ${el.id || el.tagName.toLowerCase()} takes ${rule.selector}`)
  }
  return out
}

beforeEach(() => {
  document.body.innerHTML = PAGE
  setRoot(true)
})
afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  setRoot(false)
})

describe('the heritage rules on a page, as the DOM matches them', () => {
  it('reach only the elements with a hook, each with the rule for its hook, and nothing else on the page', () => {
    expect(taken(document.body)).toEqual(EXPECTED)
    expect(problems(RULES)).toEqual([])
  })

  it('reach no control, and no form in a base scope inside heritage', () => {
    const controls = [...document.querySelectorAll(CONTROLS)]
    expect(controls.length).toBeGreaterThan(20)
    for (const el of controls) expect(matching(el, RULES).map((r) => r.selector), el.id).toEqual([])
    // Nor what holds them, but for the card hook's radius, which is not passed down.
    for (const id of ['button-in-card', 'base-button', 'base-field', 'chip-toggle']) {
      for (let el = document.getElementById(id)!.parentElement; el && el.id !== 'scope'; el = el.parentElement) {
        expect(kindsOf(el).filter((kind) => kind !== 'radius'), `${id} inside ${el.id || el.tagName}`).toEqual([])
      }
    }
  })

  it('keep Caslon off a heading below h2, a heading with no hook, a table and the fixed-width face', () => {
    for (const id of ['display-h3', 'display-p', 'plain-h1', 'plain-h2', 'figure-in-head', 'figure-in-cell', 'figure-in-mono', 'figure-on-mono', 'th', 'td', 'result-cell']) {
      expect(kindsOf(document.getElementById(id)!), id).not.toContain('display')
    }
  })

  it('reach nothing with newLook off', () => {
    setRoot(false)
    expect(taken(document.body)).toEqual({})
    setRoot(false, true)
    expect(taken(document.body)).toEqual({})
  })

  it('reach the same elements in dark mode', () => {
    setRoot(true, true)
    expect(taken(document.body)).toEqual(EXPECTED)
  })

  it('reach nothing in the live and scholastic looks or outside any scope', () => {
    for (const id of ['live', 'scholastic']) expect(taken(document.getElementById(id)!), id).toEqual({})
    for (const id of ['live', 'scholastic', 'outside-h1', 'outside-caps']) expect(kindsOf(document.getElementById(id)!), id).toEqual([])
  })
})

describe('the base look\'s accent face inside a heritage scope', () => {
  const tokens = new Map(RULES.find((rule) => rule.selector === GUARD)?.decls ?? [])
  const resolve = (value: string): string =>
    value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_, name: string, fallback?: string) => resolve(tokens.get(name) ?? fallback ?? ''))

  /** Every problem with the faces the accent class's elements take inside heritage. */
  function accentProblems(rules: CssRule[]): string[] {
    const out: string[] = []
    for (const el of document.querySelectorAll(`[data-theme="heritage"] .${ACCENT_CLASS}, [data-theme="heritage"].${ACCENT_CLASS}`)) {
      const families = matching(el, rules).map((rule) => rule.decls.get('font-family')).filter((f): f is string => f !== undefined)
      if (families.length === 0) out.push(`accent: #${el.id} takes no other face`)
      for (const family of families) {
        if (family === 'inherit') {
          // It takes the face around the scope: the page's, never the accent class's.
          if (el.parentElement?.closest(`.${ACCENT_CLASS}`)) out.push(`accent: #${el.id} inherits the class from around the scope`)
        } else if (resolve(family).includes(ACCENT_FACE)) out.push(`accent: #${el.id} takes ${resolve(family)}`)
      }
      for (const rule of matching(el, rules)) if (rule.within !== '') out.push(`accent: #${el.id} takes a rule inside ${rule.within}, which the utility layer outranks`)
    }
    return out
  }

  it('every element with the class, a base scope inside heritage included, takes a rule naming another face', () => {
    expect(document.querySelectorAll(`[data-theme="heritage"] .${ACCENT_CLASS}, [data-theme="heritage"].${ACCENT_CLASS}`)).toHaveLength(3)
    expect(accentProblems(RULES)).toEqual([])
    // Inside the scope the class takes the text face.
    const family = matching(document.getElementById('accent')!, RULES).map((rule) => rule.decls.get('font-family')).find((f) => f !== undefined)!
    expect(resolve(family)).toMatch(/^'Source Serif 4 Variable', 'Source Serif 4 Fallback', Georgia, serif$/)
  })

  it('those rules are in no layer, and the class is in the utility layer, so they outrank it on the same element', () => {
    for (const rule of RULES) expect(rule.within, rule.selector).toBe('')
    expect(read('src/index.css')).toMatch(/^@import "tailwindcss";/)
    const tailwind = read('node_modules/tailwindcss/index.css')
    expect(tailwind).toMatch(/^@layer theme, base, components, utilities;/m)
    expect(tailwind).toMatch(/@layer utilities \{\s*@tailwind utilities;\s*\}/)
  })

  it('the check fails when an override is taken away, put in a layer, or names the face', () => {
    const own = `${GUARD}.${ACCENT_CLASS}`
    const inside = `${GUARD} .${ACCENT_CLASS}`
    const without = (selector: string) => RULES.filter((rule) => rule.selector !== selector)
    expect(without(inside).length).toBe(RULES.length - 1)
    expect(accentProblems(without(inside))).toEqual(['accent: #accent takes no other face', 'accent: #accent-in-base takes no other face'])
    expect(accentProblems(without(own))).toEqual(['accent: #accent-scope takes no other face'])
    const layered = styleRules(`${sheet}\n@layer utilities { ${inside} { font-family: var(--font-text); } }`)
    expect(accentProblems([...without(inside), ...layered.filter((rule) => rule.within !== '')])).toContain('accent: #accent takes a rule inside @layer utilities, which the utility layer outranks')
    const named = styleRules(`${sheet}\n${inside} { font-family: '${ACCENT_FACE}', serif; }`)
    expect(accentProblems(named)).toEqual([`accent: #accent takes '${ACCENT_FACE}', serif`, `accent: #accent-in-base takes '${ACCENT_FACE}', serif`])
  })
})

describe('the checks on the page, each on a planted stylesheet', () => {
  const plant = (rule: string) => styleRules(`${sheet}\n${GUARD} ${rule}`)

  it('a rule that reaches controls by a part of their slot name, any slot, their state or their type', () => {
    for (const rule of ['[data-slot] { font-family: var(--font-text); }', '[data-slot*="chip"] { border-radius: 2px; }', ':enabled { font-family: var(--font-text); }', '[type] { border-radius: 2px; }', '[data-heritage~="card"] * { font-family: var(--font-text); }']) {
      expect(problems(plant(rule)).some((p) => p.startsWith('controls:')), rule).toBe(true)
    }
  })

  it('a face given to every heading, every paragraph, or a heading below h2', () => {
    for (const rule of [':is(h1, h2) { font-family: var(--font-display); }', 'p { font-family: var(--font-text); }', 'h3[data-heritage~="display"] { font-family: var(--font-display); }']) {
      expect(problems(plant(rule)).some((p) => p.startsWith('reach:')), rule).toBe(true)
    }
  })

  it('the figure rule without its table or fixed-width exclusion', () => {
    const loose = styleRules(sheet.replace(':not(table *, .font-mono, .font-mono *)', ''))
    expect(loose.length).toBe(RULES.length)
    expect(problems(loose)).toEqual(
      expect.arrayContaining(['reach: #figure-in-cell takes [display], not []', 'reach: #figure-in-mono takes [display], not []', 'reach: #figure-on-mono takes [display], not []']),
    )
  })

  it('a rule that leaves the guard: it reaches the other looks, or works with newLook off', () => {
    const bare = styleRules(`${sheet}\n[data-heritage~="card"] { border-radius: 2px; }`)
    expect(problems(bare)).toContain('reach: #live-card takes [radius], not []')
    setRoot(false)
    expect(taken(document.body, bare)).not.toEqual({})
  })
})

describe('the fixture page drawn in the heritage look', () => {
  async function fixture() {
    const { ScopeFixturePage } = (await import('@/pages/fixtures/ScopeFixturePage')) as { ScopeFixturePage: ComponentType }
    document.body.innerHTML = ''
    const view = render(
      <MemoryRouter initialEntries={['/__fixtures/heritage']}>
        <Routes>
          <Route path="/__fixtures/:name" element={<ScopeFixturePage />} />
        </Routes>
      </MemoryRouter>,
    )
    const scope = view.container.querySelector('[data-theme="heritage"]')!
    expect(scope).toBeTruthy()
    return { view, scope }
  }

  it('takes no rule but the scope\'s tokens: its headings, controls, tags, chips, dates and tables keep the base look', async () => {
    const { scope } = await fixture()
    const counts = {
      buttons: scope.querySelectorAll('[data-slot="button"]').length,
      fields: scope.querySelectorAll('input').length,
      tags: scope.querySelectorAll('[data-slot="status-badge"]').length,
      chips: scope.querySelectorAll('[data-slot="filter-chip"]').length,
      dates: scope.querySelectorAll('[data-slot="date-block"]').length,
      cells: scope.querySelectorAll('[data-slot="result-cell"]').length,
      mono: scope.querySelectorAll('.font-mono').length,
      headings: scope.querySelectorAll('h1, h2').length,
    }
    for (const [what, count] of Object.entries(counts)) expect(count, what).toBeGreaterThan(0)
    expect(kindsOf(scope)).toEqual(['tokens'])
    expect(taken(scope)).toEqual({})
    await waitFor(() => expect(fonts.heritage).toHaveBeenCalled())
  })

  it('takes nothing at all with newLook off', async () => {
    setRoot(false)
    const { view } = await fixture()
    expect(taken(view.container.parentElement!)).toEqual({})
  })

  it('with the hooks step 31 puts on its heading and sections, the controls in them still take nothing', async () => {
    const { scope } = await fixture()
    scope.querySelector('h1')!.setAttribute('data-heritage', 'display')
    for (const section of scope.querySelectorAll('section')) section.setAttribute('data-heritage', 'card')
    expect(kindsOf(scope.querySelector('h1')!)).toEqual(['display'])
    for (const el of scope.querySelectorAll('button, input, select, textarea, label, [data-slot], .font-mono, th, td')) {
      expect(matching(el, RULES).map((r) => r.selector), el.outerHTML.slice(0, 80)).toEqual([])
    }
  })
})

describe('ThemeScope, a heritage scope removed early', () => {
  /** A fresh ThemeScope, with the heritage file counted from nothing. */
  async function freshScope() {
    vi.resetModules()
    fonts.live.mockClear()
    fonts.heritage.mockClear()
    vi.doMock('@/styles/themes/live.css', () => {
      fonts.live()
      return {}
    })
    vi.doMock('@/styles/themes/heritage.css', () => {
      fonts.heritage()
      return {}
    })
    return (await import('@/components/ThemeScope')).ThemeScope as ComponentType<{ scope: 'heritage' | 'base' | 'live'; children?: ReactNode }>
  }

  const settle = () => new Promise((r) => setTimeout(r, 50))

  it('leaves no warning or error, and once the file has arrived no later scope asks for it again', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error')
    try {
      const ThemeScope = await freshScope()
      // Drawn and taken away in the same turn, before the import settles.
      const view = render(
        <StrictMode>
          <ThemeScope scope="heritage">
            <ThemeScope scope="base">Text</ThemeScope>
          </ThemeScope>
        </StrictMode>,
      )
      view.unmount()
      await waitFor(() => expect(fonts.heritage).toHaveBeenCalledTimes(1))
      await settle()
      // A later import() would run the file's mock again; only ThemeScope's own record of the loaded file can keep the count.
      vi.resetModules()
      vi.doMock('@/styles/themes/heritage.css', () => {
        fonts.heritage()
        return {}
      })
      render(<ThemeScope scope="heritage">Again</ThemeScope>)
      await settle()
      expect(fonts.heritage).toHaveBeenCalledTimes(1)
      expect(fonts.live).not.toHaveBeenCalled()
      expect(warn).not.toHaveBeenCalled()
      expect(error).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
      error.mockRestore()
    }
  })
})
