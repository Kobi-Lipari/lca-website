// @vitest-environment jsdom
//
// The styling of the club page the server writes before any script
// (checkpoint W, functions/utils/clubs/pageHtml.ts): fixed text under one
// kilobyte; every rule starts at the written wrapper and names nothing else;
// no colour, no ground, no type and no height, sizes in rem or em; the
// measure, the room around it, the headings' steps, the bullets and the
// underline; nothing of a club in it, whatever the club typed; no file the
// app is built from uses the wrapper's mark; and once the app draws into the
// root element, neither the wrapper nor a rule of its styling is left in the
// page. Every club and address here is made up.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'

import type { ClubPageResponse } from '../../domain/contracts/clubPage'
import { clubPageBody, WRITTEN_PAGE_MARK, WRITTEN_PAGE_STYLE } from '../../functions/utils/clubs/pageHtml'

const ROOT = resolve(__dirname, '../..')
const WRAPPER = `main[${WRITTEN_PAGE_MARK}]`

/** The styling as its rules: each one's selector and its declarations as property and value. */
function rulesOf(css: string): Array<{ selector: string; declarations: Array<[string, string]> }> {
  return css.split('}').filter(Boolean).map((rule) => {
    const [selector, body] = rule.split('{')
    const declarations = body.split(';').filter(Boolean).map((d) => {
      const at = d.indexOf(':')
      return [d.slice(0, at).trim(), d.slice(at + 1).trim()] as [string, string]
    })
    return { selector: selector.trim(), declarations }
  })
}
const RULES = rulesOf(WRITTEN_PAGE_STYLE)
const valueOf = (selector: string, property: string) => RULES.find((r) => r.selector === selector)?.declarations.find(([p]) => p === property)?.[1]
const remOf = (value: string | undefined) => Number(/^([\d.]+)rem$/.exec(value ?? '')?.[1] ?? NaN)

/** Every file under a folder, never node_modules or build output. */
function filesUnder(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...filesUnder(full))
    else out.push(full)
  }
  return out
}

/** A made-up club's answer whose every field a club can type carries markup, quotes and a closing style tag. */
function hostile(): ClubPageResponse {
  const BAD = '</style><style>main{color:red}</style><b>"x"</b> & \'y\' </main><script>alert(1)</script>'
  return {
    club: { id: 'example-chess-club', slug: 'example-chess-club', name: `Example Chess Club ${BAD}`, city: `Example City ${BAD}`, region: `Example Region ${BAD}`, color: '#1a2744', logo: null },
    sections: ['about', 'when_and_where', 'events', 'contact'],
    about: {
      text: `About ${BAD}`, cost: `Cost ${BAD}`, welcome: `Welcome ${BAD}`, facebook: `https://example.org/a?q=</style>`,
      website: `https://example.org/b"</style>`, other: null, weekend_play: true, scholastic_friendly: true,
    },
    statement: { text: `Statement ${BAD}`, told: 'Last checked November 2026' },
    places: [{ name: `Place ${BAD}`, street: `Street ${BAD}`, note: `Note ${BAD}`, latitude: null, longitude: null }],
    contact: { name: 'Player One' },
    events: [{ id: 'example-open</style>', name: `Event ${BAD}`, date: '2026-12-12', end_date: null }] as ClubPageResponse['events'],
    news: [],
    nearest: [],
  }
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('the written page\'s styling', () => {
  it('is fixed text under one kilobyte, with no rule other than plain properties and nothing that could end the element or carry a value', () => {
    expect(new TextEncoder().encode(WRITTEN_PAGE_STYLE).length).toBeLessThan(1024)
    expect(new TextEncoder().encode(`<style>${WRITTEN_PAGE_STYLE}</style>`).length + ` ${WRITTEN_PAGE_MARK}`.length).toBeLessThan(1024)
    expect(WRITTEN_PAGE_STYLE).not.toMatch(/[@<>"'\\]|\/\*|url\(|!important|expression|import/i)
    expect(WRITTEN_PAGE_STYLE).toMatch(/^[a-z0-9[\]{}:;., -]+$/)
  })

  it('names only the written wrapper: every rule starts at it, one selector each, reaching only the body\'s own elements', () => {
    expect(RULES.length).toBeGreaterThan(0)
    for (const { selector } of RULES) {
      expect(selector, selector).not.toContain(',')
      expect(selector.startsWith(WRAPPER), selector).toBe(true)
      const rest = selector.slice(WRAPPER.length).trim()
      if (rest) expect(rest.split(' ').every((part) => ['h1', 'h2', 'h3', 'p', 'ul', 'li', 'a'].includes(part)), selector).toBe(true)
      expect(selector).not.toMatch(/:root|\bhtml\b|\bbody\b|\*|#|\./)
    }
  })

  it('sets no colour, no ground, no type and no height: sizes in rem or em, and nothing fixed in pixels', () => {
    const allowed = ['box-sizing', 'max-width', 'margin', 'padding', 'padding-left', 'overflow-wrap', 'font-size', 'font-weight', 'line-height', 'list-style', 'text-decoration']
    for (const { selector, declarations } of RULES) {
      for (const [property, value] of declarations) {
        expect(allowed, `${selector} ${property}`).toContain(property)
        for (const length of value.match(/[\d.]+[a-z%]+/g) ?? []) expect(length, `${selector} ${property}`).toMatch(/^[\d.]+(rem|em)$/)
      }
    }
    expect(WRITTEN_PAGE_STYLE).not.toMatch(/colou?r|background|font-family|font-face|[{;](min-|max-)?height|[{;]width:|min-width|position|overflow:|px|vw|vh/)
  })

  it('sets the measure in the middle with room at the sides, the name as the largest heading, the section headings a step above the text, bullets and an underline', () => {
    expect(valueOf(WRAPPER, 'max-width')).toBe('42rem')
    const [top, sides = top, , left = sides] = (valueOf(WRAPPER, 'padding') ?? '').split(' ')
    expect(remOf(sides)).toBeGreaterThanOrEqual(1)
    expect(remOf(left)).toBeGreaterThanOrEqual(1)
    expect(remOf(top)).toBeGreaterThan(0)
    expect(valueOf(WRAPPER, 'margin')?.split(' ')[1]).toBe('auto')
    const [h1, h2, h3] = ['h1', 'h2', 'h3'].map((tag) => remOf(valueOf(`${WRAPPER} ${tag}`, 'font-size')))
    expect(h1).toBeGreaterThan(h2)
    expect(h2).toBeGreaterThan(h3)
    expect(h3).toBeGreaterThan(1)
    for (const tag of ['h1', 'h2', 'h3']) expect(valueOf(`${WRAPPER} ${tag}`, 'font-weight'), tag).toBe('700')
    expect(remOf(valueOf(`${WRAPPER} p`, 'margin')?.split(' ')[2])).toBeGreaterThan(0)
    expect(remOf(valueOf(`${WRAPPER} h2`, 'margin')?.split(' ')[0])).toBeGreaterThan(remOf(valueOf(`${WRAPPER} p`, 'margin')?.split(' ')[2]))
    expect(valueOf(`${WRAPPER} ul`, 'list-style')).toBe('disc')
    expect(valueOf(`${WRAPPER} a`, 'text-decoration')).toBe('underline')
  })

  it('holds nothing of a club: a club whose every field carries markup and a closing style tag writes the same style element as any other', () => {
    const body = clubPageBody(hostile())
    const opening = `<main ${WRITTEN_PAGE_MARK}><style>${WRITTEN_PAGE_STYLE}</style><h1>`
    expect(body.startsWith(opening)).toBe(true)
    expect(body.split('<style').length - 1).toBe(1)
    expect(body.split('</style>').length - 1).toBe(1)
    expect(body).toContain('&lt;/style&gt;&lt;style&gt;main{color:red}&lt;/style&gt;')
    expect(body).not.toMatch(/<script|<b>|"x"/)
    // The style element is the same bytes for a club with nothing typed but its name.
    const plain: ClubPageResponse = { ...hostile(), club: { ...hostile().club, name: 'Example Knights Club', city: 'Example City', region: null }, about: { ...hostile().about, text: null, cost: null, welcome: null, facebook: null, website: null, weekend_play: false, scholastic_friendly: false }, statement: { text: null, told: '' }, places: [], events: [] }
    expect(clubPageBody(plain).startsWith(opening)).toBe(true)
    expect(between(clubPageBody(plain), '<style>', '</style>')).toBe(between(body, '<style>', '</style>'))
    for (const word of ['Example', 'example', 'Place', 'Street', 'Event', 'Chess', 'Club']) expect(WRITTEN_PAGE_STYLE, word).not.toContain(word)
  })

  it('is fixed in the code: the style is built from the wrapper\'s mark alone, never from a value', () => {
    const code = readFileSync(join(ROOT, 'functions/utils/clubs/pageHtml.ts'), 'utf8')
    const block = between(code, 'export const WRITTEN_PAGE_STYLE = [', '].join(\'\')')
    expect(block.length).toBeGreaterThan(0)
    expect([...block.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]).every((name) => name === 'WRAPPER')).toBe(true)
    expect(code).toContain('const WRAPPER = `main[${WRITTEN_PAGE_MARK}]`')
    expect(code).toContain(`export const WRITTEN_PAGE_MARK = '${WRITTEN_PAGE_MARK}'`)
  })
})

describe('the wrapper\'s mark', () => {
  it('is used by no file the app is built from, so no rule of the styling can match the app\'s page', () => {
    const hits = filesUnder(join(ROOT, 'src')).filter((file) => readFileSync(file, 'utf8').includes('club-written-page'))
    expect(hits).toEqual([])
    expect(readFileSync(join(ROOT, 'index.html'), 'utf8')).not.toContain('club-written-page')
  })

  it('goes with the written body: once the app draws into the root element, no wrapper and no rule of the styling is left', async () => {
    document.body.innerHTML = `<div id="root">${clubPageBody(hostile())}</div>`
    // The rules of the style elements left in the document; a browser's own measure of this is the look's, at the checkpoint.
    const rulesNaming = () => [...document.querySelectorAll('style')].flatMap((style) => [...(style.sheet?.cssRules ?? [])]).filter((rule) => rule.cssText.includes(WRITTEN_PAGE_MARK))
    expect(document.querySelectorAll(`[${WRITTEN_PAGE_MARK}]`)).toHaveLength(1)
    expect(rulesNaming().length).toBe(RULES.length)
    const root = createRoot(document.getElementById('root') as HTMLElement)
    await act(async () => root.render(createElement('main', { id: 'main-content' }, createElement('h1', null, 'Example Chess Club'))))
    expect(document.querySelectorAll(`[${WRITTEN_PAGE_MARK}]`)).toHaveLength(0)
    expect(document.querySelectorAll('style')).toHaveLength(0)
    expect(rulesNaming()).toEqual([])
    expect(document.documentElement.outerHTML).not.toContain(WRITTEN_PAGE_MARK)
    expect(document.getElementById('main-content')?.textContent).toBe('Example Chess Club')
    await act(async () => root.unmount())
  })
})

/** The text between two marks, or the empty string. */
function between(text: string, from: string, to: string): string {
  const start = text.indexOf(from)
  if (start < 0) return ''
  const end = text.indexOf(to, start + from.length)
  return end < 0 ? '' : text.slice(start + from.length, end)
}
