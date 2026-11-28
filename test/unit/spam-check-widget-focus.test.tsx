// @vitest-environment jsdom
//
// Where keyboard focus goes around the spam check's widget
// (src/areas/clubs/components/SpamCheck.tsx, WS09 step 25), so a keyboard or
// screen reader user never loses their place in the form (WCAG 2.2, 2.4.3):
// Try again hands focus to the widget's place as it leaves the page; a second
// try that fails from there hands it back to Try again; with no site key Try
// again keeps focus and writes its words afresh for a screen reader; and a
// failure while focus is elsewhere in the form leaves it where it is. The
// provider's script is played by a stand-in on the window; the site key is
// the provider's published test site key, a public value of its documentation.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TEST_SITE_KEY = '1x00000000000000000000AA'
const DIDNT_LOAD = 'The spam check didn\'t load. Try again.'

type Options = { sitekey: string; callback: (token: string) => void; 'error-callback': () => void }
let rendered: Options[] = []

const standIn = () => ({
  render: vi.fn((container: HTMLElement, options: Options) => {
    rendered.push(options)
    container.appendChild(document.createElement('iframe'))
    return `widget-${rendered.length}`
  }),
  remove: vi.fn(),
})
const scripts = () => [...document.querySelectorAll<HTMLScriptElement>('script[data-lca-spam-check]')]
const scriptFails = async () => { await act(async () => { scripts()[0].dispatchEvent(new Event('error')) }) }

async function fresh() {
  vi.resetModules()
  const { SpamCheck } = await import('@/areas/clubs/components/SpamCheck')
  return { SpamCheck }
}

beforeEach(() => {
  rendered = []
  delete window.turnstile
  for (const s of document.querySelectorAll('script')) s.remove()
})
afterEach(() => {
  cleanup()
  delete window.turnstile
  vi.restoreAllMocks()
})

describe('focus around the spam check', () => {
  it('Try again hands focus to the widget\'s place as it leaves the page, never to the top of the page', async () => {
    const { SpamCheck } = await fresh()
    const { container } = render(<form><SpamCheck onToken={() => {}} siteKey={TEST_SITE_KEY} /><button type="submit">Send</button></form>)
    await scriptFails()
    const again = screen.getByRole('button', { name: 'Try again' })
    again.focus()
    fireEvent.click(again)
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    const place = document.activeElement as HTMLElement
    expect(place).not.toBe(document.body)
    expect(container.contains(place)).toBe(true)
    // A place focus can be sent to but that Tab never stops on, with the house focus ring.
    expect(place.tabIndex).toBe(-1)
    expect(place.className).toMatch(/focus-visible:ring-focus/)
    // The widget is drawn inside that place, so the next Tab reaches it and then the form's Send.
    window.turnstile = standIn()
    await act(async () => { scripts()[0].dispatchEvent(new Event('load')) })
    expect(rendered).toHaveLength(1)
    expect(place.querySelector('iframe')).not.toBeNull()
  })

  it('a second try that fails from there hands focus back to Try again', async () => {
    const { SpamCheck } = await fresh()
    render(<SpamCheck onToken={() => {}} siteKey={TEST_SITE_KEY} />)
    await scriptFails()
    const first = screen.getByRole('button', { name: 'Try again' })
    first.focus()
    fireEvent.click(first)
    await scriptFails()
    expect(screen.getByRole('status').textContent).toBe(DIDNT_LOAD)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Try again' }))
  })

  it('with no site key, Try again keeps focus and writes its words afresh for a screen reader', async () => {
    const { SpamCheck } = await fresh()
    render(<SpamCheck onToken={() => {}} siteKey="" />)
    const again = screen.getByRole('button', { name: 'Try again' })
    const status = screen.getByRole('status')
    const before = status.firstChild
    expect(status.textContent).toBe(DIDNT_LOAD)
    again.focus()
    fireEvent.click(again)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Try again' }))
    expect(status.textContent).toBe(DIDNT_LOAD)
    // The words are a new node in the status, which a screen reader reads out again.
    expect(status.firstChild).not.toBe(before)
    expect(scripts()).toHaveLength(0)
  })

  it('a failure while focus is elsewhere in the form leaves focus where it is', async () => {
    const { SpamCheck } = await fresh()
    render(<form><label htmlFor="example-name">Name</label><input id="example-name" /><SpamCheck onToken={() => {}} siteKey={TEST_SITE_KEY} /></form>)
    const name = screen.getByLabelText('Name')
    name.focus()
    await scriptFails()
    expect(screen.getByRole('status').textContent).toBe(DIDNT_LOAD)
    expect(document.activeElement).toBe(name)
  })
})
