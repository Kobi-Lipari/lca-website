// @vitest-environment jsdom
//
// The two mends the contact relay of WS09 makes to the spam check's widget
// (src/areas/clubs/components/SpamCheck.tsx), for the first form that draws
// it: (a) once the widget fails it is taken off the page and whatever it
// hands back after that is ignored, so a failed widget can never fill the
// form behind the failure's words; (b) a form whose send the server refused
// changes `refresh`, which clears the token, since a token is good once, and
// draws the widget afresh for a new one. The provider's script is played by
// a stand-in on the window; the site key is the provider's published test
// site key, a public value of its documentation.
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_SITE_KEY = '1x00000000000000000000AA'
const DIDNT_LOAD = 'The spam check didn\'t load. Try again.'

type Options = { sitekey: string; callback: (token: string) => void; 'error-callback': () => void; 'expired-callback': () => void }
let rendered: Options[] = []
let removed: string[] = []

function standIn(opts: { failWhileDrawing?: boolean } = {}) {
  return {
    render: vi.fn((container: HTMLElement, options: Options) => {
      rendered.push(options)
      container.appendChild(document.createElement('iframe'))
      // A widget that fails as it is drawn, before its id is handed back.
      if (opts.failWhileDrawing) options['error-callback']()
      return `widget-${rendered.length}`
    }),
    remove: vi.fn((id: string) => { removed.push(id) }),
  }
}

async function fresh() {
  vi.resetModules()
  return (await import('@/areas/clubs/components/SpamCheck')).SpamCheck
}

beforeEach(() => {
  rendered = []
  removed = []
  delete window.turnstile
  for (const s of document.querySelectorAll('script')) s.remove()
})
afterEach(() => {
  cleanup()
  delete window.turnstile
  vi.restoreAllMocks()
})

describe('the widget after a failure (mend a)', () => {
  it('is taken off the page, and a token it hands back later is never passed to the form', async () => {
    const SpamCheck = await fresh()
    window.turnstile = standIn()
    const onToken = vi.fn()
    await act(async () => { render(<SpamCheck onToken={onToken} siteKey={TEST_SITE_KEY} />) })
    expect(rendered).toHaveLength(1)
    act(() => rendered[0]['error-callback']())
    expect(screen.getByRole('status').textContent).toBe(DIDNT_LOAD)
    expect(removed).toEqual(['widget-1'])
    onToken.mockClear()
    // The provider's own retry, or a late answer, hands a token back: it is ignored, and the failure's words stay.
    act(() => rendered[0].callback('example-late-token'))
    act(() => rendered[0]['expired-callback']())
    expect(onToken).not.toHaveBeenCalled()
    expect(screen.getByRole('status').textContent).toBe(DIDNT_LOAD)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('is taken away as soon as its id is known when it fails while it is drawn', async () => {
    const SpamCheck = await fresh()
    window.turnstile = standIn({ failWhileDrawing: true })
    const onToken = vi.fn()
    await act(async () => { render(<SpamCheck onToken={onToken} siteKey={TEST_SITE_KEY} />) })
    expect(removed).toEqual(['widget-1'])
    act(() => rendered[0].callback('example-late-token'))
    expect(onToken).not.toHaveBeenCalledWith('example-late-token')
    expect(screen.getByRole('status').textContent).toBe(DIDNT_LOAD)
  })
})

describe('the widget after the server refuses a send (mend b)', () => {
  it('clears the token and draws a fresh widget when refresh changes, and the old widget\'s token is ignored', async () => {
    const SpamCheck = await fresh()
    window.turnstile = standIn()
    const onToken = vi.fn()
    const view = await act(async () => render(<SpamCheck onToken={onToken} siteKey={TEST_SITE_KEY} refresh={0} />))
    act(() => rendered[0].callback('example-first-token'))
    expect(onToken).toHaveBeenLastCalledWith('example-first-token')
    await act(async () => { view.rerender(<SpamCheck onToken={onToken} siteKey={TEST_SITE_KEY} refresh={1} />) })
    // The used token is cleared, the old widget taken away and a new one drawn.
    expect(onToken).toHaveBeenLastCalledWith(null)
    expect(removed).toEqual(['widget-1'])
    expect(rendered).toHaveLength(2)
    act(() => rendered[0].callback('example-stale-token'))
    expect(onToken).not.toHaveBeenCalledWith('example-stale-token')
    act(() => rendered[1].callback('example-fresh-token'))
    expect(onToken).toHaveBeenLastCalledWith('example-fresh-token')
    // The same refresh again draws nothing new.
    await act(async () => { view.rerender(<SpamCheck onToken={onToken} siteKey={TEST_SITE_KEY} refresh={1} />) })
    expect(rendered).toHaveLength(2)
  })
})
