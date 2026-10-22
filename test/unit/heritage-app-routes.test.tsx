// @vitest-environment jsdom
//
// src/App.tsx drawn whole, with the themeHeritage switch on and off (WS01
// step 31): the header, the site's main, the routes and the footer, as a
// visitor gets them, rather than the layout route a test writes itself.
//
// - Switch on: each of the six heritage pages, at its own address and at
//   the three old addresses that send a visitor to one of them, is drawn in
//   HeritageLayout's heritage scope, a div that is the site's main's own
//   child, holding the page's heading; the page has one main, the site's;
//   the header and the footer are outside every scope; and the scope is the
//   only data-theme on the page.
// - Switch on, a page that is not one of the six (Contact, the donation
//   thanks) is drawn with no scope at all, and so is the home page.
// - Moving from one heritage page to another keeps the one scope element,
//   so the layout is not drawn again; moving to another page takes it away,
//   and moving back draws it again.
// - Switch on and newLook off: the pages are still in the scope, with no
//   thick-thin rule and no seal.
// - Switch off: no scope, no hook, no rule and no seal on any of the six
//   pages, and the four pages GovLayout draws keep its main inside the
//   site's, as they always have.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, type ReactElement } from 'react'
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const flags = vi.hoisted(() => ({ themeHeritage: true, newLook: true }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get themeHeritage() {
        return flags.themeHeritage
      },
      get newLook() {
        return flags.newLook
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) } },
}))
vi.mock('@/lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/api')>()
  const { heritageApi } = await import('./helpers/heritageAnswers')
  return { ...real, ...heritageApi, getAnnouncements: async () => ({ announcements: [] }) }
})
vi.mock('@/styles/themes/heritage.css', () => ({}))
vi.mock('@/styles/themes/live.css', () => ({}))

const { default: App } = await import('@/App')
const { AuthContext } = await import('@/contexts/auth-context')
const { visitor } = await import('./helpers/heritagePages')

/** The six pages by address, with the heading each draws. */
const HEADINGS: Record<string, string> = {
  '/about': 'About LCA',
  '/governance/board': 'Board & regional leadership',
  '/governance/bylaws': 'Bylaws & rules',
  '/governance/minutes': 'Meeting minutes',
  '/meeting': 'Annual business meeting',
  '/champions': 'State champions',
}
/** The old addresses that send a visitor to a heritage page. */
const REDIRECTS: Record<string, string> = {
  '/governance': '/governance/board',
  '/state-champions': '/champions',
  '/governance/rules': '/governance/bylaws',
}
const GOV_LAYOUT_PAGES = ['/about', '/governance/board', '/governance/bylaws', '/governance/minutes']

let navigate: NavigateFunction | null = null
/** Hands the router's navigate to the test, as a link would use it. */
function Steer() {
  const go = useNavigate()
  useEffect(() => {
    navigate = go
  }, [go])
  return null
}

let warn: ReturnType<typeof vi.spyOn>
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T12:00:00-05:00'))
})
afterAll(() => {
  vi.useRealTimers()
})
beforeEach(() => {
  flags.themeHeritage = true
  flags.newLook = true
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  navigate = null
  warn.mockRestore()
})

/** Lets the pages' requests settle and React draw what they bring. */
const settle = () => act(async () => new Promise((r) => setTimeout(r, 30)))

/** The whole site at an address, as a visitor who is not signed in gets it. */
async function site(path: string): Promise<HTMLElement> {
  let view: ReturnType<typeof render> | undefined
  const tree: ReactElement = (
    <AuthContext.Provider value={visitor()}>
      <MemoryRouter initialEntries={[path]}>
        <Steer />
        <App />
      </MemoryRouter>
    </AuthContext.Provider>
  )
  await act(async () => {
    view = render(tree)
  })
  await settle()
  return view!.container
}

/** Waits for a page's heading, and for what its requests bring. */
async function heading(name: string): Promise<HTMLElement> {
  // A page's code is loaded on demand the first time it is drawn, which can take a while on a busy test run.
  const h1 = await screen.findByRole('heading', { level: 1, name }, { timeout: 10_000 })
  await settle()
  return h1
}

/** Where the page sits: its scope, the mains, the header and the footer. */
function layoutOf(container: HTMLElement, h1: HTMLElement) {
  const scope = container.querySelector<HTMLElement>('[data-layout="heritage"]')
  const mains = [...container.querySelectorAll('main')]
  return {
    scope,
    mains,
    themes: [...container.querySelectorAll('[data-theme]')].map((el) => el.getAttribute('data-theme')),
    headingScope: h1.closest('[data-theme]'),
    header: container.querySelector('header'),
    footer: container.querySelector('footer'),
  }
}

describe('themeHeritage on: the six pages in the layout\'s scope', () => {
  it.each(Object.keys(HEADINGS))('%s is drawn in a heritage div that is the site\'s main\'s own child, with the header and the footer outside it', async (path) => {
    const container = await site(path)
    const h1 = await heading(HEADINGS[path])
    const at = layoutOf(container, h1)
    expect(at.scope).not.toBeNull()
    expect(at.scope!.tagName).toBe('DIV')
    expect(at.scope!.getAttribute('data-theme')).toBe('heritage')
    expect(at.headingScope).toBe(at.scope)
    // One main, the site's, and the scope is its child: no second main landmark.
    expect(at.mains).toHaveLength(1)
    expect(at.scope!.parentElement).toBe(at.mains[0])
    // The header and the footer keep the base look.
    expect(at.header).not.toBeNull()
    expect(at.footer).not.toBeNull()
    expect(at.header!.closest('[data-theme]')).toBeNull()
    expect(at.footer!.closest('[data-theme]')).toBeNull()
    expect(at.scope!.contains(at.header)).toBe(false)
    expect(at.scope!.contains(at.footer)).toBe(false)
    expect(at.themes).toEqual(['heritage'])
    expect(h1.getAttribute('data-heritage')).toBe('display')
    expect(warn).not.toHaveBeenCalled()
  })

  it.each(Object.entries(REDIRECTS))('the old address %s lands on %s, in the scope', async (from, to) => {
    const container = await site(from)
    const h1 = await heading(HEADINGS[to])
    const at = layoutOf(container, h1)
    expect(at.headingScope).toBe(at.scope)
    expect(at.scope!.getAttribute('data-theme')).toBe('heritage')
    expect(at.mains).toHaveLength(1)
  })

  it.each([
    ['/contact', 'Contact us'],
    ['/donate/success', 'Thank you for your donation!'],
  ])('%s, not a heritage page, is drawn with no scope at all', async (path, name) => {
    const container = await site(path)
    await heading(name)
    expect(container.querySelectorAll('[data-theme], [data-layout], [data-heritage], [data-slot="thick-thin-rule"], [data-slot="seal"]')).toHaveLength(0)
  })

  it('the home page is drawn with no scope at all', async () => {
    const container = await site('/')
    await settle()
    expect(container.querySelector('main')).not.toBeNull()
    expect(container.querySelectorAll('[data-theme], [data-layout], [data-heritage]')).toHaveLength(0)
  })

  it('moving between heritage pages keeps the one scope element; moving away takes it, and moving back draws it again', async () => {
    const container = await site('/about')
    await heading('About LCA')
    const first = container.querySelector('[data-layout="heritage"]')!
    expect(first).not.toBeNull()

    // A link of the governance pages, as a visitor follows it.
    const link = [...container.querySelectorAll<HTMLAnchorElement>('a[href="/governance/minutes"]')].find((a) => first.contains(a))!
    expect(link).toBeTruthy()
    await act(async () => {
      fireEvent.click(link)
    })
    await heading('Meeting minutes')
    expect(container.querySelector('[data-layout="heritage"]')).toBe(first)

    await act(async () => {
      navigate!('/champions')
    })
    await heading('State champions')
    expect(container.querySelector('[data-layout="heritage"]')).toBe(first)
    expect(container.querySelectorAll('[data-layout="heritage"]')).toHaveLength(1)

    await act(async () => {
      navigate!('/contact')
    })
    await heading('Contact us')
    expect(container.querySelectorAll('[data-theme], [data-layout]')).toHaveLength(0)

    await act(async () => {
      navigate!('/meeting')
    })
    const h1 = await heading('Annual business meeting')
    const again = container.querySelector('[data-layout="heritage"]')
    expect(again).not.toBeNull()
    expect(again).not.toBe(first)
    expect(h1.closest('[data-theme]')).toBe(again)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('themeHeritage on and newLook off', () => {
  it.each(Object.keys(HEADINGS))('%s is in the scope, with no thick-thin rule and no seal', async (path) => {
    flags.newLook = false
    const container = await site(path)
    const h1 = await heading(HEADINGS[path])
    expect(h1.closest('[data-theme]')).toBe(container.querySelector('[data-layout="heritage"]'))
    expect(container.querySelectorAll('[data-slot="thick-thin-rule"], [data-slot="seal"]')).toHaveLength(0)
  })
})

describe('themeHeritage off: the six pages as they always were', () => {
  it.each(Object.keys(HEADINGS))('%s has no scope, hook, rule or seal, and keeps today\'s mains', async (path) => {
    flags.themeHeritage = false
    const container = await site(path)
    const h1 = await heading(HEADINGS[path])
    expect(container.querySelectorAll('[data-theme], [data-layout], [data-heritage], [data-slot="thick-thin-rule"], [data-slot="seal"]')).toHaveLength(0)
    expect(h1.hasAttribute('data-heritage')).toBe(false)
    // GovLayout's own main sits inside the site's, as it always has; the other two pages have the site's alone.
    const mains = container.querySelectorAll('main')
    expect(mains).toHaveLength(GOV_LAYOUT_PAGES.includes(path) ? 2 : 1)
    expect(mains[0].contains(h1)).toBe(true)
  })

  it.each(Object.entries(REDIRECTS))('the old address %s still lands on %s', async (from, to) => {
    flags.themeHeritage = false
    const container = await site(from)
    await heading(HEADINGS[to])
    expect(container.querySelectorAll('[data-theme], [data-layout]')).toHaveLength(0)
  })
})
