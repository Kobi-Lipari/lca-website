// @vitest-environment jsdom
//
// HeritageLayout (WS01 step 31, src/layouts/HeritageLayout.tsx) and the six
// heritage pages it draws: About, Board, Bylaws, Minutes, Annual meeting and
// Champions.
//
// - With themeHeritage off src/App.tsx lists the six on their own, and each
//   draws today's markup to the attribute: for a visitor and for an LCA
//   admin, with newLook off and on, its markup's length and sha256 are those
//   recorded from the files at 0cc7c30 (test/unit/fixtures/
//   heritage-pages-today.ts). No element carries a heritage hook, no rule or
//   seal is drawn, and the four pages that draw GovLayout keep its main.
// - Inside the layout each page is drawn in the heritage look, in a div
//   that is never a main, carrying data-theme heritage, the look's ground
//   (bg-ground) and ink: the page's h1 takes the display hook, its cards and
//   the champions' table frame their hooks, and under the new look a
//   thick-thin rule opens the page under its heading band and parts its
//   main sections, and one seal sits in its heading band from 640px up.
//   GovLayout's column is a plain div there, so a page has one main, the
//   site's own. Taken back out, the hooks, the rules, the seal and the
//   column leave exactly the page's markup on its own, with newLook on and
//   off: the layout adds those and nothing else.
// - With themeHeritage on and newLook off the layout still wraps the pages,
//   but draws no rule and no seal and leaves the heading band as it is, so
//   the pages look as they do today: the hooks it puts on are attributes the
//   look's stylesheet reads only under the new look.
// - Under the new look the layout holds its page until the look's
//   stylesheet has arrived: while the file is on its way the layout's
//   loading line stands in a box at least the window's height, inside the
//   scope, and the page is not drawn; it is drawn once the file has arrived,
//   also when the file cannot be loaded, in the type it had, and once
//   HOLD_AT_MOST_MS (three seconds) have passed with the file still on its
//   way. With newLook off it holds nothing, since none of the file's rules
//   apply, and the scope still asks for the file.
// - Nothing warns in the console.
import { createHash } from 'node:crypto'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ComponentType, ReactElement } from 'react'
import { Route, Routes } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { HERITAGE_PAGES_TODAY } from './fixtures/heritage-pages-today'

const flags = vi.hoisted(() => ({ newLook: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get newLook() {
        return flags.newLook
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/api')>()
  const { heritageApi } = await import('./helpers/heritageAnswers')
  return { ...real, ...heritageApi }
})
vi.mock('@/styles/themes/heritage.css', () => ({}))
vi.mock('@/styles/themes/live.css', () => ({}))

const { HERITAGE_PAGES, drawOnItsOwn, inRouter } = await import('./helpers/heritagePages')
const { HeritageLayout } = await import('@/layouts/HeritageLayout')

let warn: ReturnType<typeof vi.spyOn>
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-22T12:00:00-05:00'))
})
afterAll(() => {
  vi.useRealTimers()
})
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  flags.newLook = false
  warn.mockRestore()
})

const ROLES = ['member', 'lca_admin'] as const
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
/** Lets the requests the pages make settle, and React draw what they bring. */
const settle = () => act(async () => new Promise((r) => setTimeout(r, 30)))

/** A page drawn on its own and finished. */
async function onItsOwn(name: string, role: (typeof ROLES)[number] = 'member') {
  const page = HERITAGE_PAGES.find((p) => p.name === name)!
  const view = drawOnItsOwn(name, role)
  await screen.findAllByText(page.drawnWhen, { exact: false })
  await settle()
  return view
}

/** A page drawn as src/App.tsx draws it with themeHeritage on: in the layout route, at its address. */
async function inLayout(name: string, role: (typeof ROLES)[number] = 'member', Layout: ComponentType = HeritageLayout, page?: ReactElement) {
  const entry = HERITAGE_PAGES.find((p) => p.name === name)!
  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    view = render(
      inRouter(
        entry.route,
        <Routes>
          <Route element={<Layout />}>
            <Route path={entry.route} element={page ?? <entry.Page />} />
          </Route>
        </Routes>,
        role,
      ),
    )
  })
  if (!page) await screen.findAllByText(entry.drawnWhen, { exact: false })
  await settle()
  return view!
}

const scopeOf = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-layout="heritage"]')!

describe('with themeHeritage off: each page on its own, as it is today', () => {
  for (const look of [false, true]) {
    for (const role of ROLES) {
      it.each(HERITAGE_PAGES.map((p) => p.name))(`%s for ${role === 'member' ? 'a visitor' : 'an admin'}, newLook ${look ? 'on' : 'off'}: today's markup to the attribute`, async (name) => {
        flags.newLook = look
        const { container } = await onItsOwn(name, role)
        const html = container.innerHTML
        const key = `${name} ${role === 'member' ? 'visitor' : 'admin'} newLook ${look ? 'on' : 'off'}`
        expect({ length: html.length, sha256: sha256(html) }, `${key}: ${html}`).toEqual(HERITAGE_PAGES_TODAY[key])
        expect(container.querySelectorAll('[data-heritage], [data-slot="thick-thin-rule"], [data-slot="seal"], [data-theme]')).toHaveLength(0)
      })
    }
  }

  it('the four pages that draw GovLayout keep its main column', async () => {
    for (const name of ['about', 'board', 'bylaws', 'minutes']) {
      const { container, unmount } = await onItsOwn(name)
      expect(container.querySelectorAll('main.min-w-0.flex-1'), name).toHaveLength(1)
      unmount()
    }
  })
})

/** What each page puts on inside the layout: its hooks and how many thick-thin rules it draws, for the made-up answers. */
const INSIDE: Record<string, { hooks: string[]; rules: number }> = {
  // The rule under the heading band, and one before the call to join.
  about: { hooks: ['h1 display'], rules: 2 },
  // Four seat cards; rules under the band, between officers and representatives, and before the closing note.
  board: { hooks: ['h1 display', 'div card', 'div card', 'div card', 'div card'], rules: 3 },
  // The bylaws document's card and the two empty lists' boxes; rules under the band, between the three lists and before the rules.
  bylaws: { hooks: ['h1 display', 'div card', 'div card', 'div card'], rules: 4 },
  // The two documents' cards; rules under the band and between the two lists.
  minutes: { hooks: ['h1 display', 'div card', 'div card'], rules: 2 },
  // The join card; the rule under the band.
  meeting: { hooks: ['h1 display', 'div card'], rules: 1 },
  // The upcoming championship's card, two reigning cards and the table's frame; rules under the band, before the reigning and before all champions.
  champions: { hooks: ['h1 display', 'a card', 'div card', 'div card', 'div table'], rules: 3 },
}

/** The page's markup inside the layout with what the layout adds taken back out. */
function withoutHeritage(scope: HTMLElement): string {
  const copy = scope.cloneNode(true) as HTMLElement
  for (const el of copy.querySelectorAll('[data-heritage]')) el.removeAttribute('data-heritage')
  for (const el of copy.querySelectorAll('[data-slot="thick-thin-rule"], [data-slot="seal"]')) el.remove()
  // The heading band's title row, laid out for the seal beside it, as it is with no aside.
  for (const row of copy.querySelectorAll('section.bg-brand-navy div')) {
    if (row.getAttribute('class') === 'flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start' && !row.querySelector(':scope > .flex-shrink-0')) row.setAttribute('class', '')
  }
  // GovLayout's column, a div inside the layout, back to the main it is on its own.
  for (const column of copy.querySelectorAll('div.min-w-0.flex-1')) {
    if (!column.firstElementChild?.matches('nav[aria-label="Governance"]')) continue
    const main = document.createElement('main')
    for (const attribute of column.attributes) main.setAttribute(attribute.name, attribute.value)
    main.append(...column.childNodes)
    column.replaceWith(main)
  }
  return copy.innerHTML
}

describe('inside HeritageLayout', () => {
  it.each(HERITAGE_PAGES.map((p) => p.name))('%s is drawn in the heritage look, in a div that is no main, on the look\'s ground and ink', async (name) => {
    const { container } = await inLayout(name)
    const scope = scopeOf(container)
    expect(container.children).toHaveLength(1)
    expect(container.firstElementChild).toBe(scope)
    expect(scope.tagName).toBe('DIV')
    expect(scope.getAttribute('data-theme')).toBe('heritage')
    expect(scope.style.display).toBe('')
    for (const cls of ['bg-ground', 'text-foreground']) expect(scope.classList.contains(cls), cls).toBe(true)
    // No main of its own: the site's main (src/App.tsx) is the page's one main.
    expect(scope.querySelectorAll('main')).toHaveLength(0)
    expect(warn).not.toHaveBeenCalled()
  })

  it.each(HERITAGE_PAGES.map((p) => p.name))('%s puts on its hooks, its rules and one seal in its heading band', async (name) => {
    flags.newLook = true
    const { container } = await inLayout(name)
    const scope = scopeOf(container)
    const hooks = [...scope.querySelectorAll('[data-heritage]')].map((el) => `${el.tagName.toLowerCase()} ${el.getAttribute('data-heritage')}`)
    expect(hooks).toEqual(INSIDE[name].hooks)
    // The display hook is on the page's one h1, in the heading band.
    const h1 = scope.querySelector('h1')!
    expect(scope.querySelectorAll('h1')).toHaveLength(1)
    expect(h1.getAttribute('data-heritage')).toBe('display')
    const band = h1.closest('section')!
    expect(band.classList.contains('bg-brand-navy')).toBe(true)
    // The rules: decoration, on the light ground; the first right under the heading band.
    const rules = [...scope.querySelectorAll('[data-slot="thick-thin-rule"]')]
    expect(rules).toHaveLength(INSIDE[name].rules)
    for (const rule of rules) {
      expect(rule.getAttribute('aria-hidden')).toBe('true')
      expect(rule.classList.contains('border-ink')).toBe(true)
      expect(band.contains(rule)).toBe(false)
    }
    const order = [...scope.querySelectorAll('*')]
    const at = (el: Element) => order.indexOf(el)
    expect(at(rules[0])).toBeGreaterThan(at(band))
    // Nothing a reader reads stands between the heading band and the first rule.
    const between = order.filter((el) => at(el) > at(band) && at(el) < at(rules[0]) && !band.contains(el) && /^(H\d|P|LI|TABLE|A|BUTTON)$/.test(el.tagName))
    expect(between).toEqual([])
    // One seal, in the heading band, hidden below 640px and from screen readers.
    const seals = [...scope.querySelectorAll('[data-slot="seal"]')]
    expect(seals).toHaveLength(1)
    expect(band.contains(seals[0])).toBe(true)
    expect(seals[0].getAttribute('aria-hidden')).toBe('true')
    expect([...seals[0].classList]).toEqual(expect.arrayContaining(['hidden', 'sm:block']))
    // The About page's logo frame takes the radius by its own slot.
    if (name === 'about') expect(scope.querySelectorAll('[data-slot="lca-logo-mat"]')).toHaveLength(1)
    expect(warn).not.toHaveBeenCalled()
  })

  it.each(HERITAGE_PAGES.map((p) => p.name))('%s inside the layout is its markup on its own once the hooks, rules, seal and column are taken back out, with newLook on and off', async (name) => {
    for (const look of [true, false]) {
      for (const role of ROLES) {
        flags.newLook = look
        const inside = withoutHeritage(scopeOf((await inLayout(name, role)).container))
        cleanup()
        const own = (await onItsOwn(name, role)).container.innerHTML
        cleanup()
        expect(inside, `${name} for ${role}, newLook ${look ? 'on' : 'off'}`).toBe(own)
      }
    }
  })

  it.each(HERITAGE_PAGES.map((p) => p.name))('%s with newLook off: wrapped in the scope with its hooks, but no rule, no seal and the heading band as it is today', async (name) => {
    flags.newLook = false
    const { container } = await inLayout(name)
    const scope = scopeOf(container)
    expect(scope.getAttribute('data-theme')).toBe('heritage')
    expect(scope.querySelectorAll('[data-slot="thick-thin-rule"], [data-slot="seal"]')).toHaveLength(0)
    const hooks = [...scope.querySelectorAll('[data-heritage]')].map((el) => `${el.tagName.toLowerCase()} ${el.getAttribute('data-heritage')}`)
    expect(hooks).toEqual(INSIDE[name].hooks)
    // The heading band's title row keeps the classes it has on its own: no row laid out for a seal.
    const row = scope.querySelector('h1')!.closest('.min-w-0')!.parentElement!
    expect(row.getAttribute('class')).toBe('')
    // The page's markup, its hooks and GovLayout's column aside, is the markup it draws on its own.
    const inside = withoutHeritage(scope)
    cleanup()
    expect(inside).toBe((await onItsOwn(name)).container.innerHTML)
    expect(warn).not.toHaveBeenCalled()
  })
})

describe('the layout waits for the look\'s stylesheet', () => {
  /** A fresh layout whose stylesheet import waits for the test, then loads or fails. */
  async function heldLayout() {
    const gate: { open: () => void; fail: boolean; asked: number } = { open: () => {}, fail: false, asked: 0 }
    const held = new Promise<void>((resolve) => (gate.open = resolve))
    vi.resetModules()
    vi.doMock('@/styles/themes/heritage.css', async () => {
      gate.asked += 1
      await held
      if (gate.fail) throw new Error('the stylesheet did not load')
      return {}
    })
    const { HeritageLayout: Fresh } = await import('@/layouts/HeritageLayout')
    const { HOLD_AT_MOST_MS } = await import('@/lib/scopeStylesheets')
    return { Layout: Fresh, gate, HOLD_AT_MOST_MS }
  }
  const PAGE = <h1 data-testid="page">The page</h1>

  it('shows its loading line, in the scope and at least the window\'s height, and not the page, until the file has arrived', async () => {
    flags.newLook = true
    const { Layout, gate } = await heldLayout()
    const { container } = await inLayout('about', 'member', Layout, PAGE)
    const scope = scopeOf(container)
    expect(screen.queryByTestId('page')).toBeNull()
    const loading = screen.getByRole('status')
    expect(loading.textContent).toBe('Loading…')
    expect(scope.contains(loading)).toBe(true)
    expect(loading.parentElement!.classList.contains('min-h-screen')).toBe(true)
    await act(async () => {
      gate.open()
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(screen.getByTestId('page').closest('[data-theme]')).toBe(scope)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('draws the page all the same when the file cannot be loaded', async () => {
    flags.newLook = true
    const { Layout, gate } = await heldLayout()
    gate.fail = true
    await inLayout('about', 'member', Layout, PAGE)
    expect(screen.queryByTestId('page')).toBeNull()
    await act(async () => {
      gate.open()
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(screen.getByTestId('page')).toBeTruthy()
    expect(warn).not.toHaveBeenCalled()
  })

  it('holds the page for HOLD_AT_MOST_MS at most: then draws it in the type it has, with the file still on its way', async () => {
    flags.newLook = true
    const { Layout, gate, HOLD_AT_MOST_MS } = await heldLayout()
    // The layout's timer and the clock, run by the test from here on.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    try {
      await act(async () => {
        render(inRouter('/about', <Routes><Route element={<Layout />}><Route path="/about" element={PAGE} /></Route></Routes>))
      })
      expect(screen.queryByTestId('page')).toBeNull()
      expect(screen.getByRole('status').textContent).toBe('Loading…')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(HOLD_AT_MOST_MS - 100)
      })
      expect(screen.queryByTestId('page')).toBeNull()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600)
      })
      // The file has not arrived, and the page is drawn all the same.
      expect(screen.getByTestId('page').closest('[data-theme]')!.getAttribute('data-theme')).toBe('heritage')
      expect(screen.queryByRole('status')).toBeNull()
      expect(gate.asked).toBe(1)
    } finally {
      vi.useRealTimers()
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-22T12:00:00-05:00'))
    }
    // The file arriving later changes nothing in the page's markup.
    await act(async () => {
      gate.open()
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(screen.getByTestId('page')).toBeTruthy()
    expect(warn).not.toHaveBeenCalled()
  })

  it('with newLook off holds nothing, since none of the file\'s rules apply: the page is drawn at once, and the scope still asks for the file', async () => {
    flags.newLook = false
    const { Layout, gate } = await heldLayout()
    await inLayout('about', 'member', Layout, PAGE)
    expect(screen.getByTestId('page').closest('[data-theme]')!.getAttribute('data-theme')).toBe('heritage')
    expect(screen.queryByRole('status')).toBeNull()
    expect(gate.asked).toBe(1)
    await act(async () => {
      gate.open()
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(warn).not.toHaveBeenCalled()
  })
})
