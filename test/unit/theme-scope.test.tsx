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
// - Each look's font file is imported only once a scope of that look
//   renders, once for all of them: the live look's, and since step 30 the
//   heritage look's. Base and scholastic import none, and neither look
//   imports the other's.
import type { ReactNode } from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_SCOPES, type ThemeScopeName } from '@/lib/themeScopes'

const fonts = vi.hoisted(() => ({ live: vi.fn(), heritage: vi.fn() }))
vi.mock('@/styles/themes/live.css', () => {
  fonts.live()
  return {}
})
vi.mock('@/styles/themes/heritage.css', () => {
  fonts.heritage()
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
      <ThemeScope scope="live" layout="box" as="section" className="bg-background" data-fixture="live" id="scoped">
        Text
      </ThemeScope>,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.tagName).toBe('SECTION')
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

/** A fresh copy of ThemeScope, with both font files counted again from nothing. */
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
  return (await import('@/components/ThemeScope')).ThemeScope
}

/**
 * Lets any further import() of either file run its mock again. The module
 * registry keeps an imported file, so a second import() would never run the
 * mock and a count could not move; clearing the registry, while keeping the
 * copy of ThemeScope already drawn, leaves only ThemeScope's own once-only
 * guard to keep a count where it is.
 */
function forgetImportedFiles() {
  vi.resetModules()
  vi.doMock('@/styles/themes/live.css', () => {
    fonts.live()
    return {}
  })
  vi.doMock('@/styles/themes/heritage.css', () => {
    fonts.heritage()
    return {}
  })
}

/** Gives a stray import time to start before saying none did. */
const settle = () => new Promise((r) => setTimeout(r, 50))

describe('the live fonts', () => {
  it('are imported only once a live scope renders', async () => {
    // A fresh copy of ThemeScope, since the tests above have drawn live scopes already.
    const ThemeScope = await freshScope()
    const nest = (scopes: ThemeScopeName[]) =>
      scopes.reduceRight<ReactNode>((inner, scope) => <ThemeScope scope={scope}>{inner}</ThemeScope>, <span>Text</span>)
    render(
      <>
        {nest(['base'])}
        {nest(['heritage', 'base'])}
        {nest(['scholastic'])}
      </>,
    )
    await settle()
    expect(fonts.live).not.toHaveBeenCalled()

    render(nest(['live']))
    await waitFor(() => expect(fonts.live).toHaveBeenCalledTimes(1))

    // A second live scope reuses the file already loaded.
    forgetImportedFiles()
    render(nest(['live']))
    await settle()
    expect(fonts.live).toHaveBeenCalledTimes(1)
  })
})

describe('the heritage fonts', () => {
  it('are imported once a heritage scope renders, and never by a base, scholastic or live scope', async () => {
    const ThemeScope = await freshScope()
    const nest = (scopes: ThemeScopeName[]) =>
      scopes.reduceRight<ReactNode>((inner, scope) => <ThemeScope scope={scope}>{inner}</ThemeScope>, <span>Text</span>)
    render(
      <>
        {nest(['base'])}
        {nest(['scholastic'])}
        {nest(['live'])}
      </>,
    )
    await waitFor(() => expect(fonts.live).toHaveBeenCalledTimes(1))
    await settle()
    expect(fonts.heritage).not.toHaveBeenCalled()

    // A heritage page with a base scope inside, for its forms: the heritage file once, and still not the live one again.
    render(nest(['heritage', 'base']))
    await waitFor(() => expect(fonts.heritage).toHaveBeenCalledTimes(1))
    await settle()
    expect(fonts.live).toHaveBeenCalledTimes(1)

    // More heritage scopes reuse the file already loaded.
    forgetImportedFiles()
    render(
      <>
        {nest(['heritage'])}
        {nest(['heritage', 'base'])}
      </>,
    )
    await settle()
    expect(fonts.heritage).toHaveBeenCalledTimes(1)
    expect(fonts.live).toHaveBeenCalledTimes(1)
  })

  it('a heritage scope on its own imports the heritage file and not the live one', async () => {
    const ThemeScope = await freshScope()
    render(<ThemeScope scope="heritage">Text</ThemeScope>)
    await waitFor(() => expect(fonts.heritage).toHaveBeenCalledTimes(1))
    await settle()
    expect(fonts.live).not.toHaveBeenCalled()
  })
})
