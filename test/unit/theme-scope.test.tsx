// @vitest-environment jsdom
//
// ThemeScope (WS01 step 22): the wrapper it draws, the nesting rule it
// reports, and the font file it loads.
//
// - It writes data-theme on its wrapper ("" for base) and, by default, makes
//   the wrapper display: contents so it adds no box; layout="box" gives a
//   real element that takes a className and other attributes.
// - Base inside heritage is allowed. Heritage inside live, and every other
//   nesting (two levels, a look inside itself, any look inside live or
//   scholastic), is reported in the console.
// - The live look's font file is imported only once a live scope renders.
import type { ReactNode } from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_SCOPES, type ThemeScopeName } from '@/lib/themeScopes'

const fonts = vi.hoisted(() => ({ live: vi.fn() }))
vi.mock('@/styles/themes/live.css', () => {
  fonts.live()
  return {}
})

const { ThemeScope } = await import('@/components/ThemeScope')

let warn: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  warn.mockRestore()
})

/** The scopes nested outermost first, with a marker inside the innermost. */
function nest(scopes: ThemeScopeName[]) {
  return scopes.reduceRight<ReactNode>(
    (inner, scope) => <ThemeScope scope={scope}>{inner}</ThemeScope>,
    <span data-testid="inside">Text</span>,
  )
}

const warnings = () => warn.mock.calls.map((c: unknown[]) => String(c[0]))

describe('the wrapper', () => {
  it.each([
    ['base', ''],
    ['heritage', 'heritage'],
    ['live', 'live'],
    ['scholastic', 'scholastic'],
  ] as const)('scope="%s" writes data-theme="%s"', (scope, theme) => {
    const { container } = render(<ThemeScope scope={scope}>Text</ThemeScope>)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.getAttribute('data-theme')).toBe(theme)
    expect(wrapper.hasAttribute('data-theme')).toBe(true)
  })

  it('adds no box by default: the wrapper is display: contents', () => {
    const { container } = render(<ThemeScope scope="heritage" style={{ color: 'red' }}>Text</ThemeScope>)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.tagName).toBe('DIV')
    expect(wrapper.style.display).toBe('contents')
    expect(wrapper.style.color).toBe('red')
  })

  it('layout="box" is a real element that keeps its className, attributes and element type', () => {
    const { container } = render(
      <ThemeScope scope="live" layout="box" as="main" className="bg-background" data-fixture="live" id="scoped">
        Text
      </ThemeScope>,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.tagName).toBe('MAIN')
    expect(wrapper.style.display).toBe('')
    expect(wrapper.className).toBe('bg-background')
    expect(wrapper.getAttribute('data-fixture')).toBe('live')
    expect(wrapper.id).toBe('scoped')
    expect(wrapper.getAttribute('data-theme')).toBe('live')
  })

  it('a scope="base" inside heritage writes the "" reset on its own wrapper, so the closest data-theme above its children is base', () => {
    const { getByTestId } = render(nest(['heritage', 'base']))
    expect(getByTestId('inside').closest('[data-theme]')?.getAttribute('data-theme')).toBe('')
  })
})

describe('the nesting rule', () => {
  it.each(THEME_SCOPES)('a %s scope on its own is not reported', (scope) => {
    render(nest([scope]))
    expect(warnings()).toEqual([])
  })

  it('base inside heritage is allowed', () => {
    render(nest(['heritage', 'base']))
    expect(warnings()).toEqual([])
  })

  it('two heritage pages side by side, each with base inside, are allowed', () => {
    render(
      <>
        {nest(['heritage', 'base'])}
        {nest(['heritage', 'base'])}
      </>,
    )
    expect(warnings()).toEqual([])
  })

  it('heritage inside live is reported', () => {
    render(nest(['live', 'heritage']))
    expect(warnings()).toHaveLength(1)
    expect(warnings()[0]).toMatch(/heritage look never renders inside the live look \(live > heritage\)/)
  })

  const others = THEME_SCOPES.flatMap((outer) => THEME_SCOPES.map((inner) => [outer, inner] as [ThemeScopeName, ThemeScopeName]))
    .filter(([outer, inner]) => !(outer === 'heritage' && inner === 'base'))
  it.each(others)('%s with %s inside is reported', (outer, inner) => {
    render(nest([outer, inner]))
    expect(warnings()).toHaveLength(1)
    expect(warnings()[0]).toContain(`(${outer} > ${inner})`)
  })

  it('a second level is reported, even under base inside heritage', () => {
    render(nest(['heritage', 'base', 'base']))
    expect(warnings()).toEqual([expect.stringMatching(/one level only.*\(heritage > base > base\)/)])
  })
})

describe('the live fonts', () => {
  it('are imported only once a live scope renders', async () => {
    // A fresh copy of ThemeScope, since the tests above have drawn live scopes already.
    vi.resetModules()
    fonts.live.mockClear()
    vi.doMock('@/styles/themes/live.css', () => {
      fonts.live()
      return {}
    })
    const { ThemeScope } = await import('@/components/ThemeScope')
    const nest = (scopes: ThemeScopeName[]) =>
      scopes.reduceRight<ReactNode>((inner, scope) => <ThemeScope scope={scope}>{inner}</ThemeScope>, <span>Text</span>)
    render(
      <>
        {nest(['base'])}
        {nest(['heritage', 'base'])}
        {nest(['scholastic'])}
      </>,
    )
    // Give a stray import time to start before saying none did.
    await new Promise((r) => setTimeout(r, 50))
    expect(fonts.live).not.toHaveBeenCalled()

    render(nest(['live']))
    await waitFor(() => expect(fonts.live).toHaveBeenCalledTimes(1))

    // A second live scope reuses the file already loaded. The module registry
    // keeps an imported file, so a second import() would never run the mock
    // again and the count could not move. Clearing the registry here, while
    // keeping this copy of ThemeScope, makes any further import() of the file
    // run the mock again: only ThemeScope's own once-only guard keeps the
    // count at 1.
    vi.resetModules()
    vi.doMock('@/styles/themes/live.css', () => {
      fonts.live()
      return {}
    })
    render(nest(['live']))
    await new Promise((r) => setTimeout(r, 50))
    expect(fonts.live).toHaveBeenCalledTimes(1)
  })
})
