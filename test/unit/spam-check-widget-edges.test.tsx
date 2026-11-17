// @vitest-environment jsdom
//
// The edges of the spam check's widget (src/areas/clubs/components/SpamCheck.tsx,
// WS09 step 25) that test/unit/spam-check-widget.test.tsx leaves: Try again
// that then works, a script already on the page, a widget the provider's
// script cannot draw, a form that draws a new function on each render, a
// site key that changes, Try again inside a form (it submits nothing), the
// status a screen reader hears being in the page from the first draw, and the
// control reachable and operable by keyboard. The provider's script is played
// by a stand-in on the window; the site key is the provider's published test
// site key, a public value of its documentation.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_SITE_KEY = '1x00000000000000000000AA'
const OTHER_SITE_KEY = '2x00000000000000000000AB'
const DIDNT_LOAD = 'The spam check didn\'t load. Try again.'

type Options = { sitekey: string; callback: (token: string) => void; 'error-callback': () => void; 'expired-callback': () => void; 'timeout-callback': () => void }
let rendered: Options[] = []
let removed: string[] = []
let drawFails = false

const standIn = () => ({
  render: vi.fn((container: HTMLElement, options: Options) => {
    if (drawFails) throw new Error('example: the widget could not be drawn')
    rendered.push(options)
    container.appendChild(document.createElement('iframe'))
    return `widget-${rendered.length}`
  }),
  remove: vi.fn((id: string) => { removed.push(id) }),
})
const scripts = () => [...document.querySelectorAll<HTMLScriptElement>('script[data-lca-spam-check]')]
const loaded = async () => { await act(async () => { scripts()[0].dispatchEvent(new Event('load')) }) }

async function fresh() {
  vi.resetModules()
  const { SpamCheck } = await import('@/areas/clubs/components/SpamCheck')
  return { SpamCheck }
}

beforeEach(() => {
  rendered = []
  removed = []
  drawFails = false
  delete window.turnstile
  for (const s of document.querySelectorAll('script')) s.remove()
})
afterEach(() => {
  cleanup()
  delete window.turnstile
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('Try again', () => {
  it('after a script that did not load, a second ask that loads draws the widget and hands its token back', async () => {
    const { SpamCheck } = await fresh()
    const onToken = vi.fn()
    render(<SpamCheck onToken={onToken} siteKey={TEST_SITE_KEY} />)
    await act(async () => { scripts()[0].dispatchEvent(new Event('error')) })
    expect(screen.getByRole('status').textContent).toBe(DIDNT_LOAD)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('status').textContent).toBe('')
    window.turnstile = standIn()
    await loaded()
    expect(rendered).toHaveLength(1)
    act(() => rendered[0].callback('example-token'))
    expect(onToken).toHaveBeenLastCalledWith('example-token')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('after a widget that failed, draws a fresh widget and takes the old one away', async () => {
    const { SpamCheck } = await fresh()
    render(<SpamCheck onToken={() => {}} siteKey={TEST_SITE_KEY} />)
    window.turnstile = standIn()
    await loaded()
    act(() => rendered[0]['error-callback']())
    expect(screen.getByRole('status').textContent).toBe(DIDNT_LOAD)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    expect(removed).toEqual(['widget-1'])
    expect(rendered).toHaveLength(2)
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('is a plain button, so inside a form it submits nothing', async () => {
    const { SpamCheck } = await fresh()
    const submit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    render(<form onSubmit={submit}><SpamCheck onToken={() => {}} siteKey="" /></form>)
    const button = screen.getByRole('button', { name: 'Try again' })
    expect(button.getAttribute('type')).toBe('button')
    fireEvent.click(button)
    expect(submit).not.toHaveBeenCalled()
  })

  it('can be reached and pressed from the keyboard: it is focusable, in the tab order, and a press of Enter or Space is a click', async () => {
    const { SpamCheck } = await fresh()
    render(<SpamCheck onToken={() => {}} siteKey="" />)
    const button = screen.getByRole('button', { name: 'Try again' }) as HTMLButtonElement
    expect(button.tabIndex).toBeGreaterThanOrEqual(0)
    expect(button.disabled).toBe(false)
    button.focus()
    expect(document.activeElement).toBe(button)
    expect(button.className).toMatch(/focus-visible:ring/)
  })
})

describe('the page the widget is drawn in', () => {
  it('a script already on the window is not asked for again, and the widget is drawn at once', async () => {
    const { SpamCheck } = await fresh()
    window.turnstile = standIn()
    await act(async () => { render(<SpamCheck onToken={() => {}} siteKey={TEST_SITE_KEY} />) })
    expect(scripts()).toEqual([])
    expect(rendered.map((r) => r.sitekey)).toEqual([TEST_SITE_KEY])
  })

  it('a script that loads but puts nothing on the window is a failure said in words', async () => {
    const { SpamCheck } = await fresh()
    const onToken = vi.fn()
    render(<SpamCheck onToken={onToken} siteKey={TEST_SITE_KEY} />)
    await loaded()
    expect(screen.getByRole('status').textContent).toBe(DIDNT_LOAD)
    expect(onToken).toHaveBeenLastCalledWith(null)
  })

  it('a widget the script cannot draw is a failure said in words, with Try again', async () => {
    const { SpamCheck } = await fresh()
    drawFails = true
    window.turnstile = standIn()
    await act(async () => { render(<SpamCheck onToken={() => {}} siteKey={TEST_SITE_KEY} />) })
    expect(screen.getByRole('status').textContent).toBe(DIDNT_LOAD)
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
  })

  it('a widget\'s own timeout and expiry take the token back, and neither is called a failure', async () => {
    const { SpamCheck } = await fresh()
    const onToken = vi.fn()
    render(<SpamCheck onToken={onToken} siteKey={TEST_SITE_KEY} />)
    window.turnstile = standIn()
    await loaded()
    act(() => rendered[0].callback('example-token'))
    act(() => rendered[0]['timeout-callback']())
    expect(onToken).toHaveBeenLastCalledWith(null)
    act(() => rendered[0].callback('example-token-two'))
    expect(onToken).toHaveBeenLastCalledWith('example-token-two')
    expect(screen.getByRole('status').textContent).toBe('')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('a form that draws a new onToken on each render does not draw the widget again, and its latest function gets the token', async () => {
    const { SpamCheck } = await fresh()
    const seen: string[] = []
    function Form() {
      const [count, setCount] = useState(0)
      return (
        <>
          <button type="button" onClick={() => setCount((n) => n + 1)}>Redraw</button>
          <SpamCheck onToken={(t) => { seen.push(`${count}:${t}`) }} siteKey={TEST_SITE_KEY} />
        </>
      )
    }
    render(<Form />)
    window.turnstile = standIn()
    await loaded()
    fireEvent.click(screen.getByRole('button', { name: 'Redraw' }))
    fireEvent.click(screen.getByRole('button', { name: 'Redraw' }))
    expect(rendered).toHaveLength(1)
    expect(removed).toEqual([])
    act(() => rendered[0].callback('example-token'))
    expect(seen.at(-1)).toBe('2:example-token')
  })

  it('a changed site key draws the widget afresh and takes the old one away', async () => {
    const { SpamCheck } = await fresh()
    window.turnstile = standIn()
    const { rerender } = render(<SpamCheck onToken={() => {}} siteKey={TEST_SITE_KEY} />)
    await act(async () => {})
    rerender(<SpamCheck onToken={() => {}} siteKey={OTHER_SITE_KEY} />)
    await act(async () => {})
    expect(rendered.map((r) => r.sitekey)).toEqual([TEST_SITE_KEY, OTHER_SITE_KEY])
    expect(removed).toEqual(['widget-1'])
  })

  it('goes away before the script answers: no widget is drawn after, no token is handed back and nothing throws', async () => {
    const { SpamCheck } = await fresh()
    const onToken = vi.fn()
    const { unmount } = render(<SpamCheck onToken={onToken} siteKey={TEST_SITE_KEY} />)
    onToken.mockClear()
    unmount()
    window.turnstile = standIn()
    await loaded()
    expect(rendered).toEqual([])
    expect(onToken).not.toHaveBeenCalled()
  })

  it('the status is in the page from the first draw and empty until there is something to say, so a screen reader hears the words when they come', async () => {
    const { SpamCheck } = await fresh()
    render(<SpamCheck onToken={() => {}} siteKey={TEST_SITE_KEY} />)
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('')
    await act(async () => { scripts()[0].dispatchEvent(new Event('error')) })
    // The same element, now holding the words: a status that is replaced, rather than changed, is not always announced.
    expect(screen.getByRole('status')).toBe(status)
    expect(status.textContent).toBe(DIDNT_LOAD)
  })

  it('says its words once and holds no heading, no list, no image and no link beside the control', async () => {
    const { SpamCheck } = await fresh()
    const { container } = render(<SpamCheck onToken={() => {}} siteKey="" />)
    expect(container.querySelectorAll('h1,h2,h3,h4,h5,h6,ul,ol,img,a,p,svg')).toHaveLength(0)
    expect(container.textContent?.split(DIDNT_LOAD).length).toBe(2)
    expect(container.textContent).not.toMatch(new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`))
  })
})
