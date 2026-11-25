// @vitest-environment jsdom
//
// The spam check's widget (src/areas/clubs/components/SpamCheck.tsx, WS09
// step 25): the provider's script is asked for only when the widget is
// drawn, once, and never by the site's own code anywhere else; the widget
// hands its token back to the form, and null once it is gone; a missing site
// key, a script that does not load and a widget that fails are each said in
// words, in a status a screen reader hears, with a Try again button of the
// house size; the provider's frame gets a title in words; and the provider's
// name is printed nowhere. The provider's script is played by a stand-in on
// the window; the site key below is the provider's published test site key,
// a public value of its documentation.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ROOT = resolve(__dirname, '../..')
const TEST_SITE_KEY = '1x00000000000000000000AA'
const DIDNT_LOAD = 'The spam check didn\'t load. Try again.'

type Options = { sitekey: string; callback: (token: string) => void; 'error-callback': () => void; 'expired-callback': () => void }
let rendered: Options[] = []
let removed: string[] = []

/** The provider's script as a stand-in: what it puts on the window, and a frame with no title, as it might draw one. */
function standIn() {
  return {
    render: vi.fn((container: HTMLElement, options: Options) => {
      rendered.push(options)
      container.appendChild(document.createElement('iframe'))
      return `widget-${rendered.length}`
    }),
    remove: vi.fn((id: string) => { removed.push(id) }),
  }
}
const scripts = () => [...document.querySelectorAll<HTMLScriptElement>('script[data-lca-spam-check]')]

async function fresh() {
  vi.resetModules()
  const { SpamCheck } = await import('@/areas/clubs/components/SpamCheck')
  const { SPAM_CHECK_SCRIPT } = await import('@/areas/clubs/spamCheckScript')
  return { SpamCheck, SPAM_CHECK_SCRIPT }
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
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('SpamCheck', () => {
  it('asks for the provider\'s script only when it is drawn, once, and not before', async () => {
    const { SpamCheck, SPAM_CHECK_SCRIPT } = await fresh()
    expect(scripts()).toEqual([])
    render(<><SpamCheck onToken={() => {}} siteKey={TEST_SITE_KEY} /><SpamCheck onToken={() => {}} siteKey={TEST_SITE_KEY} /></>)
    expect(scripts().map((s) => s.src)).toEqual([SPAM_CHECK_SCRIPT])
    expect(SPAM_CHECK_SCRIPT).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit')
  })

  it('hands its token back to the form, and null once the token has expired', async () => {
    const { SpamCheck } = await fresh()
    const onToken = vi.fn()
    render(<SpamCheck onToken={onToken} siteKey={TEST_SITE_KEY} />)
    window.turnstile = standIn()
    await act(async () => { scripts()[0].dispatchEvent(new Event('load')) })
    expect(rendered.map((r) => r.sitekey)).toEqual([TEST_SITE_KEY])
    act(() => rendered[0].callback('example-token'))
    expect(onToken).toHaveBeenLastCalledWith('example-token')
    act(() => rendered[0]['expired-callback']())
    expect(onToken).toHaveBeenLastCalledWith(null)
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('gives the provider\'s frame a title in words, and takes the widget away when it goes', async () => {
    const { SpamCheck } = await fresh()
    const { container, unmount } = render(<SpamCheck onToken={() => {}} siteKey={TEST_SITE_KEY} />)
    window.turnstile = standIn()
    await act(async () => { scripts()[0].dispatchEvent(new Event('load')) })
    expect([...container.querySelectorAll('iframe')].map((f) => f.title)).toEqual(['Spam check'])
    unmount()
    expect(removed).toEqual(['widget-1'])
  })

  it('a script that does not load is said in words, with Try again, which asks for it afresh', async () => {
    const { SpamCheck } = await fresh()
    const onToken = vi.fn()
    render(<SpamCheck onToken={onToken} siteKey={TEST_SITE_KEY} />)
    await act(async () => { scripts()[0].dispatchEvent(new Event('error')) })
    expect(screen.getByRole('status').textContent).toBe(DIDNT_LOAD)
    expect(onToken).toHaveBeenLastCalledWith(null)
    expect(scripts()).toEqual([])
    const again = screen.getByRole('button', { name: 'Try again' })
    expect(again.className).toMatch(/\bmin-h-11\b/)
    expect(again.className).toMatch(/focus-visible:ring-focus/)
    fireEvent.click(again)
    expect(scripts()).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toBe('')
  })

  it('a script that never answers is said in words after its wait, and nothing moves on by itself before', async () => {
    vi.useFakeTimers()
    const { SpamCheck } = await fresh()
    const { SPAM_CHECK_LOAD_MS } = await import('@/areas/clubs/spamCheckScript')
    render(<SpamCheck onToken={() => {}} siteKey={TEST_SITE_KEY} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(SPAM_CHECK_LOAD_MS - 1) })
    expect(screen.getByRole('status').textContent).toBe('')
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.getByRole('status').textContent).toBe(DIDNT_LOAD)
  })

  it('a missing site key is said in words at once, and the script is never asked for', async () => {
    const { SpamCheck } = await fresh()
    for (const key of [undefined, '']) {
      const { unmount } = render(<SpamCheck onToken={() => {}} siteKey={key} />)
      expect(screen.getByRole('status').textContent).toBe(DIDNT_LOAD)
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
      unmount()
    }
    expect(scripts()).toEqual([])
  })

  it('a widget that fails is said in words, and its token is taken back', async () => {
    const { SpamCheck } = await fresh()
    const onToken = vi.fn()
    render(<SpamCheck onToken={onToken} siteKey={TEST_SITE_KEY} />)
    window.turnstile = standIn()
    await act(async () => { scripts()[0].dispatchEvent(new Event('load')) })
    act(() => rendered[0].callback('example-token'))
    act(() => rendered[0]['error-callback']())
    expect(screen.getByRole('status').textContent).toBe(DIDNT_LOAD)
    expect(onToken).toHaveBeenLastCalledWith(null)
  })

  it('prints the provider\'s name nowhere, and no sentence but its own words beside the control', async () => {
    const { SpamCheck } = await fresh()
    const { container } = render(<SpamCheck onToken={() => {}} siteKey="" />)
    expect(container.textContent).toBe(`${DIDNT_LOAD}Try again`)
    expect(container.innerHTML).not.toMatch(/cloudflare|turnstile/i)
  })
})

describe('where the provider\'s address is', () => {
  const walk = (dir: string): string[] =>
    readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))
  const site = walk('src').filter((f) => /\.(?:tsx?|css|html)$/.test(f))

  it('is in one file of the site\'s code, the script loader, which only the widget imports, and the one form that draws the widget is the contact relay\'s', () => {
    expect(site.filter((f) => read(f).includes('challenges.cloudflare.com'))).toEqual(['src/areas/clubs/spamCheckScript.ts'])
    expect(site.filter((f) => /spamCheckScript['"]/.test(read(f)))).toEqual(['src/areas/clubs/components/SpamCheck.tsx'])
    // The contact relay's form (WS09 step 26) is the one importer, inside the club page's own chunk, never the main script.
    // Moved at WS09 step 28: the Suggest an update sheet draws it too, in its own chunk, fetched when it first opens.
    expect(site.filter((f) => /components\/SpamCheck['"]|['"]\.\/SpamCheck['"]/.test(read(f))).sort()).toEqual(['src/areas/clubs/components/ContactRelayForm.tsx', 'src/areas/clubs/components/SuggestUpdateSheet.tsx'])
    expect(read('index.html')).not.toContain('challenges.cloudflare.com')
  })
})

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8')
}
