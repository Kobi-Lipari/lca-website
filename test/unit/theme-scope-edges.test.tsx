// @vitest-environment jsdom
//
// ThemeScope at its edges (WS01 step 22): the check is left out of the site's
// own build, a scope that changes in place, a font file that fails to load,
// elements between two scopes, and what the wrapper does with a style it is
// given. Since step 30 the heritage look has a font file too, counted beside
// the live one: a scope that changes in place loads each once, and after a
// failed import of either file a scope of that look drawn later calls
// import() again. The files are mocked here, so these tests show that call,
// not a request. In a built site a second import() of a stylesheet that
// failed would fetch nothing, since Vite's preload helper remembers each one
// it has added; since step 31 the loader ThemeScope uses
// (src/lib/scopeStylesheets.ts) adds a fresh link of its own instead, calls
// import() again only when the failed import added no link, as here, and
// asks again only once RETRY_AFTER_MS have passed since the failure
// (test/unit/scope-stylesheets.test.tsx).
import type { ReactNode } from 'react'
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RETRY_AFTER_MS } from '@/lib/scopeStylesheets'
import type { ThemeScopeName } from '@/lib/themeScopes'

const fonts = vi.hoisted(() => ({ live: vi.fn(), heritage: vi.fn(), fail: false, failHeritage: false }))

/** Replaces both font files with ones that count their imports, and fail when told to. */
function mockFontFiles() {
  vi.doMock('@/styles/themes/live.css', () => {
    fonts.live()
    if (fonts.fail) throw new Error('the font file did not load')
    return {}
  })
  vi.doMock('@/styles/themes/heritage.css', () => {
    fonts.heritage()
    if (fonts.failHeritage) throw new Error('the font file did not load')
    return {}
  })
}

/** A fresh ThemeScope, with both font files replaced by ones that count their imports. */
async function freshScope() {
  vi.resetModules()
  fonts.live.mockClear()
  fonts.heritage.mockClear()
  mockFontFiles()
  return (await import('@/components/ThemeScope')).ThemeScope
}

/**
 * Lets a further import() of either file run its mock again, keeping the
 * copy of ThemeScope in hand. The module registry keeps a file once it has
 * loaded, so without this a second import() would not run the mock and a
 * count could not move whatever ThemeScope did; with it, only ThemeScope's
 * own record of what it has loaded keeps a count where it is.
 */
function forgetImportedFiles() {
  vi.resetModules()
  mockFontFiles()
}

let warn: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  fonts.fail = false
  fonts.failHeritage = false
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.useRealTimers()
  warn.mockRestore()
})

/** Moves the clock the loader reads past the time it waits after a failure before asking again; timers keep running. */
function afterTheWait() {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.now() + RETRY_AFTER_MS)
}

describe('the nesting check', () => {
  it('is left out of the site\'s own build', async () => {
    vi.stubEnv('MODE', 'production')
    const ThemeScope = await freshScope()
    render(
      <ThemeScope scope="live">
        <ThemeScope scope="heritage">Text</ThemeScope>
      </ThemeScope>,
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it('runs in the accessibility test build and in development', async () => {
    for (const mode of ['a11y', 'development', 'test']) {
      vi.stubEnv('MODE', mode)
      const ThemeScope = await freshScope()
      const { unmount } = render(
        <ThemeScope scope="live">
          <ThemeScope scope="heritage">Text</ThemeScope>
        </ThemeScope>,
      )
      expect(warn, mode).toHaveBeenCalledTimes(1)
      unmount()
      warn.mockClear()
    }
  })

  it('still draws the nested scope it reports, with its own data-theme', async () => {
    const ThemeScope = await freshScope()
    const { getByTestId } = render(
      <ThemeScope scope="live">
        <ThemeScope scope="heritage">
          <span data-testid="inside">Text</span>
        </ThemeScope>
      </ThemeScope>,
    )
    expect(getByTestId('inside').closest('[data-theme]')?.getAttribute('data-theme')).toBe('heritage')
  })

  it('sees a scope through ordinary elements and components between the two', async () => {
    const ThemeScope = await freshScope()
    const Pass = ({ children }: { children: ReactNode }) => <section><p>{children}</p></section>
    render(
      <ThemeScope scope="live">
        <Pass>
          <ThemeScope scope="heritage">Text</ThemeScope>
        </Pass>
      </ThemeScope>,
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toMatch(/never renders inside the live look/)
  })

  it('a scope that is not inside another begins a new chain after a closed one', async () => {
    const ThemeScope = await freshScope()
    render(
      <>
        <ThemeScope scope="live">Text</ThemeScope>
        <ThemeScope scope="heritage">
          <ThemeScope scope="base">Text</ThemeScope>
        </ThemeScope>
      </>,
    )
    expect(warn).not.toHaveBeenCalled()
  })

  it('is reported when the scope changes in place into a bad nesting, and not again for an unchanged render', async () => {
    const ThemeScope = await freshScope()
    const tree = (inner: ThemeScopeName, extra = '') => (
      <ThemeScope scope="live">
        <ThemeScope scope={inner}>{extra}</ThemeScope>
      </ThemeScope>
    )
    const { rerender } = render(tree('base'))
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockClear()
    rerender(tree('base', 'new text'))
    expect(warn).not.toHaveBeenCalled()
    rerender(tree('heritage', 'new text'))
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toMatch(/never renders inside the live look/)
  })

  it('is not reported when a bad nesting changes in place into an allowed one', async () => {
    const ThemeScope = await freshScope()
    const tree = (outer: ThemeScopeName) => (
      <ThemeScope scope={outer}>
        <ThemeScope scope="base">Text</ThemeScope>
      </ThemeScope>
    )
    const { rerender } = render(tree('live'))
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockClear()
    rerender(tree('heritage'))
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('a scope that changes in place', () => {
  it('rewrites data-theme on the same element, keeps its children mounted, and loads each look\'s fonts when it becomes that look', async () => {
    const ThemeScope = await freshScope()
    const tree = (scope: ThemeScopeName) => (
      <ThemeScope scope={scope} data-fixture="x">
        <input data-testid="field" defaultValue="typed" />
      </ThemeScope>
    )
    const { container, getByTestId, rerender } = render(tree('base'))
    const wrapper = container.firstElementChild as HTMLElement
    const field = getByTestId('field') as HTMLInputElement
    expect(wrapper.getAttribute('data-theme')).toBe('')
    await new Promise((r) => setTimeout(r, 30))
    expect(fonts.live).not.toHaveBeenCalled()
    expect(fonts.heritage).not.toHaveBeenCalled()

    for (const scope of ['heritage', 'scholastic', 'base'] as const) {
      rerender(tree(scope))
      expect(container.firstElementChild).toBe(wrapper)
      expect(wrapper.getAttribute('data-theme')).toBe(scope === 'base' ? '' : scope)
      expect(getByTestId('field')).toBe(field)
      expect(field.value).toBe('typed')
    }
    // Heritage asked for its own file once, and none of the three for the live one.
    await waitFor(() => expect(fonts.heritage).toHaveBeenCalledTimes(1))
    expect(fonts.live).not.toHaveBeenCalled()

    rerender(tree('live'))
    expect(wrapper.getAttribute('data-theme')).toBe('live')
    await waitFor(() => expect(fonts.live).toHaveBeenCalledTimes(1))
    rerender(tree('base'))
    rerender(tree('live'))
    rerender(tree('heritage'))
    await new Promise((r) => setTimeout(r, 30))
    expect(fonts.live).toHaveBeenCalledTimes(1)
    expect(fonts.heritage).toHaveBeenCalledTimes(1)
  })

  it('a live scope that mounts later, nested in another page, loads the file once for all of them', async () => {
    const ThemeScope = await freshScope()
    const { rerender } = render(<ThemeScope scope="base">Text</ThemeScope>)
    rerender(
      <>
        <ThemeScope scope="live">One</ThemeScope>
        <ThemeScope scope="live">Two</ThemeScope>
        <ThemeScope scope="live">Three</ThemeScope>
      </>,
    )
    await waitFor(() => expect(fonts.live).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 30))
    expect(fonts.live).toHaveBeenCalledTimes(1)
  })
})

describe('a font file that fails to load', () => {
  // The mocks stand for the files and add no link, so "calls import() again"
  // is all these show; a built site's failed link is replaced by a fresh one
  // (test/unit/scope-stylesheets.test.tsx, and test/a11y/heritage.spec.ts in
  // a browser), since Vite's own loader would fetch nothing a second time
  // (test/unit/heritage-edges.test.ts drives the one the build emits). A
  // scope drawn within RETRY_AFTER_MS of the failure takes it as it is.
  it('does not break the page or warn, and a live scope drawn later calls import() again', async () => {
    const ThemeScope = await freshScope()
    fonts.fail = true
    const { container, unmount } = render(<ThemeScope scope="live">Text</ThemeScope>)
    await waitFor(() => expect(fonts.live).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 30))
    expect(container.textContent).toBe('Text')
    expect(warn).not.toHaveBeenCalled()
    unmount()

    // A scope drawn at once takes the failure as it is.
    fonts.fail = false
    const soon = render(<ThemeScope scope="live">Text</ThemeScope>)
    await new Promise((r) => setTimeout(r, 30))
    expect(fonts.live).toHaveBeenCalledTimes(1)
    soon.unmount()

    afterTheWait()
    const second = render(<ThemeScope scope="live">Text</ThemeScope>)
    await waitFor(() => expect(fonts.live).toHaveBeenCalledTimes(2))
    second.unmount()
    // Loaded now: a third scope does not ask again.
    render(<ThemeScope scope="live">Text</ThemeScope>)
    await new Promise((r) => setTimeout(r, 30))
    expect(fonts.live).toHaveBeenCalledTimes(2)
  })

  it('the heritage file too: the page still draws, nothing warns, and a heritage scope drawn later calls import() again', async () => {
    const ThemeScope = await freshScope()
    fonts.failHeritage = true
    const { container, unmount } = render(
      <ThemeScope scope="heritage">
        <ThemeScope scope="base">Text</ThemeScope>
      </ThemeScope>,
    )
    await waitFor(() => expect(fonts.heritage).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 30))
    expect(container.textContent).toBe('Text')
    expect(warn).not.toHaveBeenCalled()
    unmount()

    fonts.failHeritage = false
    afterTheWait()
    const second = render(<ThemeScope scope="heritage">Text</ThemeScope>)
    await waitFor(() => expect(fonts.heritage).toHaveBeenCalledTimes(2))
    second.unmount()
    // Loaded now: a third scope does not call import() again.
    forgetImportedFiles()
    render(<ThemeScope scope="heritage">Text</ThemeScope>)
    await new Promise((r) => setTimeout(r, 30))
    expect(fonts.heritage).toHaveBeenCalledTimes(2)
    // The live file is never asked for on the way.
    expect(fonts.live).not.toHaveBeenCalled()
  })

  it('a failed live file does not stop the heritage file loading, and the other way round', async () => {
    for (const [failed, other] of [['live', 'heritage'], ['heritage', 'live']] as const) {
      const ThemeScope = await freshScope()
      fonts.fail = failed === 'live'
      fonts.failHeritage = failed === 'heritage'
      const both = () => (
        <>
          <ThemeScope scope="live">One</ThemeScope>
          <ThemeScope scope="heritage">Two</ThemeScope>
        </>
      )
      render(both())
      await waitFor(() => expect(fonts[failed], failed).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(fonts[other], failed).toHaveBeenCalledTimes(1))
      cleanup()

      // The other file loaded, so only the failed one is asked for again.
      fonts.fail = false
      fonts.failHeritage = false
      forgetImportedFiles()
      afterTheWait()
      render(both())
      await waitFor(() => expect(fonts[failed], failed).toHaveBeenCalledTimes(2))
      await new Promise((r) => setTimeout(r, 30))
      expect(fonts[other], failed).toHaveBeenCalledTimes(1)
      cleanup()
    }
  })
})

describe('the wrapper\'s style', () => {
  it('display: contents wins over a display in the style it is given, and the rest of the style is kept', async () => {
    const ThemeScope = await freshScope()
    const { container } = render(
      <ThemeScope scope="heritage" style={{ display: 'flex', color: 'red' }}>
        Text
      </ThemeScope>,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.display).toBe('contents')
    expect(wrapper.style.color).toBe('red')
  })

  it('a box keeps the display it is given, and a data-theme in the attributes cannot replace the scope', async () => {
    const ThemeScope = await freshScope()
    const { container } = render(
      <ThemeScope scope="scholastic" layout="box" style={{ display: 'flex' }} {...({ 'data-theme': 'live' } as object)}>
        Text
      </ThemeScope>,
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.display).toBe('flex')
    expect(wrapper.getAttribute('data-theme')).toBe('scholastic')
  })

  it('renders a section and a main as landmarks, and children and ARIA attributes pass through', async () => {
    const ThemeScope = await freshScope()
    const { getByRole } = render(
      <ThemeScope scope="live" layout="box" as="section" aria-label="Round 3 board">
        <button type="button">Go</button>
      </ThemeScope>,
    )
    expect(getByRole('region', { name: 'Round 3 board' }).getAttribute('data-theme')).toBe('live')
    expect(getByRole('button', { name: 'Go' })).toBeTruthy()
  })
})
