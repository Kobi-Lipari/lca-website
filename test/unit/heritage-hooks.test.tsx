// @vitest-environment jsdom
//
// The heritage layout's context (src/contexts/heritage-layout.ts) and the
// shared parts that read it beyond the six pages (WS01 step 31).
//
// - Outside HeritageLayout every reader gets nothing: no hook word, so React
//   draws no data-heritage attribute at all, and no ornaments, with newLook
//   on or off. Inside it each of the stylesheet's six words comes back as it
//   is asked for, and the ornaments follow newLook.
// - PageHero, which twelve files import, is the same outside the layout with
//   newLook on as with it off, for every slot the site uses (a back link, an
//   eyebrow, badges, a meta row, an aside at the top or the foot, a bottom
//   row, the compact size): no hook, no seal.
// - Inside the layout its title takes the display hook wherever it is drawn
//   (beside badges too); a hero with an aside of its own keeps the aside and
//   shows no seal; a hero with none shows one seal, last in its title row,
//   under the new look only. Take the hook, the seal and the row's layout
//   for the seal back out and every hero is the one drawn outside.
// - GovLayout's column is the main it always was outside the layout and a
//   plain div with the same classes and children inside it.
// - The accessibility build's fixture page puts the hooks and the base scope
//   nested in heritage on its heritage fixture alone: the base, scholastic
//   and live fixtures carry no hook, no second scope and no heritage part.
import { cleanup, render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

vi.mock('@/styles/themes/heritage.css', () => ({}))
vi.mock('@/styles/themes/live.css', () => ({}))

const { HeritageLayoutContext, useHeritageHook, useHeritageOrnaments, useInHeritageLayout } = await import('@/contexts/heritage-layout')
const { PageHero } = await import('@/components/PageHero')
const { GovLayout } = await import('@/areas/governance/components/GovLayout')
const { ThickThinRule } = await import('@/components/ThickThinRule')
const { ScopeFixturePage } = await import('@/pages/fixtures/ScopeFixturePage')

afterEach(() => {
  cleanup()
  flags.newLook = false
})

const WORDS = ['display', 'figure', 'reader', 'card', 'table', 'mat'] as const

/** What the context gives a part drawn inside or outside the layout. */
function Read({ out }: { out: (value: { inside: boolean; words: Array<string | undefined>; ornaments: boolean }) => void }) {
  const hook = useHeritageHook()
  out({ inside: useInHeritageLayout(), words: WORDS.map((w) => hook(w)), ornaments: useHeritageOrnaments() })
  return <h1 data-heritage={hook('display')}>Title</h1>
}

function read(inside: boolean) {
  let value: { inside: boolean; words: Array<string | undefined>; ornaments: boolean } | undefined
  const element = <Read out={(v) => (value = v)} />
  const { container } = render(inside ? <HeritageLayoutContext.Provider value={true}>{element}</HeritageLayoutContext.Provider> : element)
  const html = container.innerHTML
  cleanup()
  return { ...value!, html }
}

describe('the context', () => {
  it('outside the layout gives no word, so no attribute is drawn, and no ornaments, with newLook on or off', () => {
    for (const look of [false, true]) {
      flags.newLook = look
      const got = read(false)
      expect(got.inside).toBe(false)
      expect(got.words).toEqual(WORDS.map(() => undefined))
      expect(got.ornaments).toBe(false)
      expect(got.html).toBe('<h1>Title</h1>')
    }
  })

  it('inside the layout gives each word as it is asked for, and the ornaments under the new look only', () => {
    flags.newLook = false
    const off = read(true)
    expect([off.inside, off.ornaments]).toEqual([true, false])
    expect(off.words).toEqual([...WORDS])
    expect(off.html).toBe('<h1 data-heritage="display">Title</h1>')
    flags.newLook = true
    const on = read(true)
    expect([on.inside, on.ornaments]).toEqual([true, true])
  })

  it('a provider that says false is the same as none', () => {
    flags.newLook = true
    let value: { inside: boolean; words: Array<string | undefined>; ornaments: boolean } | undefined
    const { container } = render(
      <HeritageLayoutContext.Provider value={false}>
        <Read out={(v) => (value = v)} />
      </HeritageLayoutContext.Provider>,
    )
    expect(value).toEqual({ inside: false, words: WORDS.map(() => undefined), ornaments: false })
    expect(container.innerHTML).toBe('<h1>Title</h1>')
  })
})

/** The slots the site's heroes use, alone and together. */
const HEROES: ReadonlyArray<[string, Parameters<typeof PageHero>[0]]> = [
  ['a title and a subtitle', { title: 'Fixture page', subtitle: 'Made-up words for a test.' }],
  ['a back link', { title: 'Fixture event', backTo: { to: '/tournaments', label: 'All tournaments' }, eyebrow: null }],
  ['a back link and an eyebrow', { title: 'Fixture event', backTo: { to: '/tournaments', label: 'All tournaments' }, eyebrow: 'Louisiana Chess Association' }],
  ['badges and a meta row', { title: 'Fixture event', badges: <span>Open</span>, meta: <span>Sat, Oct 24 at 7:00 PM</span> }],
  ['an aside', { title: 'Fixture clubs', aside: <div>12 clubs</div> }],
  ['an aside at the foot', { title: 'Fixture event', aside: <button type="button">Register</button>, asideAlign: 'end' }],
  ['a bottom row, compact', { title: 'Fixture tournaments', size: 'compact', children: <div>Filters</div> }],
]

function hero(props: Parameters<typeof PageHero>[0], inside: boolean): HTMLElement {
  const element: ReactElement = (
    <MemoryRouter>
      <PageHero {...props} />
    </MemoryRouter>
  )
  const { container } = render(inside ? <HeritageLayoutContext.Provider value={true}>{element}</HeritageLayoutContext.Provider> : element)
  const copy = container.cloneNode(true) as HTMLElement
  cleanup()
  return copy
}

/** A hero drawn inside the layout with what the layout adds taken back out. */
function withoutHeritage(drawn: HTMLElement, hadAside: boolean): string {
  const copy = drawn.cloneNode(true) as HTMLElement
  for (const el of copy.querySelectorAll('[data-heritage]')) el.removeAttribute('data-heritage')
  for (const el of copy.querySelectorAll('[data-slot="seal"]')) el.remove()
  if (!hadAside) {
    const row = copy.querySelector('h1')!.closest('.min-w-0')!.parentElement!
    row.setAttribute('class', row.getAttribute('class')!.replace('flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start', '').trim())
  }
  return copy.innerHTML
}

describe('PageHero outside the layout', () => {
  it.each(HEROES)('with %s is the same with newLook on as off, with no hook and no seal', (_name, props) => {
    flags.newLook = false
    const off = hero(props, false)
    flags.newLook = true
    const on = hero(props, false)
    expect(on.innerHTML).toBe(off.innerHTML)
    expect(on.querySelectorAll('[data-heritage], [data-slot="seal"]')).toHaveLength(0)
  })
})

describe('PageHero inside the layout', () => {
  it.each(HEROES)('with %s: the title takes the display hook, one seal shows only where there is no aside, and the rest is the hero outside', (_name, props) => {
    flags.newLook = true
    const outside = hero(props, false)
    const inside = hero(props, true)
    const h1s = inside.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    expect(h1s[0].getAttribute('data-heritage')).toBe('display')
    const seals = inside.querySelectorAll('[data-slot="seal"]')
    if (props.aside) {
      expect(seals).toHaveLength(0)
      expect(inside.querySelector('.flex-shrink-0')!.textContent).toBe(outside.querySelector('.flex-shrink-0')!.textContent)
    } else {
      expect(seals).toHaveLength(1)
      const row = h1s[0].closest('.min-w-0')!.parentElement!
      // The seal is the title row's last part, beside the title, hidden below 640 pixels.
      expect(row.lastElementChild).toBe(seals[0])
      expect(row.classList.contains('sm:flex-row')).toBe(true)
      expect([...seals[0].classList]).toEqual(expect.arrayContaining(['hidden', 'sm:block']))
      expect(seals[0].closest('section')!.classList.contains('bg-brand-navy')).toBe(true)
    }
    expect(withoutHeritage(inside, !!props.aside)).toBe(outside.innerHTML)
  })

  it.each(HEROES)('with %s and newLook off: the hook, but no seal and the row as it is outside', (_name, props) => {
    flags.newLook = false
    const outside = hero(props, false)
    const inside = hero(props, true)
    expect(inside.querySelectorAll('[data-slot="seal"]')).toHaveLength(0)
    expect(inside.querySelector('h1')!.getAttribute('data-heritage')).toBe('display')
    const copy = inside.cloneNode(true) as HTMLElement
    copy.querySelector('h1')!.removeAttribute('data-heritage')
    expect(copy.innerHTML).toBe(outside.innerHTML)
  })
})

function gov(inside: boolean, children: ReactNode = <p>Fixture words</p>): HTMLElement {
  const element = (
    <MemoryRouter initialEntries={['/about']}>
      <GovLayout title="Fixture title" subtitle="Fixture subtitle">{children}</GovLayout>
    </MemoryRouter>
  )
  const { container } = render(inside ? <HeritageLayoutContext.Provider value={true}>{element}</HeritageLayoutContext.Provider> : element)
  const copy = container.cloneNode(true) as HTMLElement
  cleanup()
  return copy
}

describe('GovLayout\'s column', () => {
  it('is the main it always was outside the layout, with newLook on or off', () => {
    for (const look of [false, true]) {
      flags.newLook = look
      const drawn = gov(false)
      const mains = drawn.querySelectorAll('main')
      expect(mains).toHaveLength(1)
      expect(mains[0].getAttribute('class')).toBe('min-w-0 flex-1')
      expect(mains[0].querySelector('nav[aria-label="Governance"]')).not.toBeNull()
      expect(drawn.querySelectorAll('[data-slot="thick-thin-rule"], [data-heritage]')).toHaveLength(0)
    }
  })

  it('is a plain div with the same classes and children inside the layout; under the new look a rule opens the page under the heading band', () => {
    for (const look of [false, true]) {
      flags.newLook = look
      const drawn = gov(true)
      expect(drawn.querySelectorAll('main')).toHaveLength(0)
      const column = drawn.querySelector('nav[aria-label="Governance"]')!.parentElement!
      expect(column.tagName).toBe('DIV')
      expect(column.getAttribute('class')).toBe('min-w-0 flex-1')
      expect(column.querySelector('p')!.textContent).toBe('Fixture words')
      const rules = drawn.querySelectorAll('[data-slot="thick-thin-rule"]')
      expect(rules).toHaveLength(look ? 1 : 0)
      if (look) {
        // The rule is the first thing under the heading band, before the sidebar and the column.
        const section = rules[0].parentElement!
        expect(section.previousElementSibling!.classList.contains('bg-brand-navy')).toBe(true)
        expect(section.firstElementChild).toBe(rules[0])
        expect(rules[0].getAttribute('aria-hidden')).toBe('true')
      }
    }
  })
})

describe('ThickThinRule on a navy band, closing a section', () => {
  it('puts the thin line on top and the thick one below, in brand gold', () => {
    const rule = render(<ThickThinRule on="navy" edge="close" />).container.firstElementChild!
    const classes = (rule.getAttribute('class') ?? '').split(/\s+/)
    expect(classes).toEqual(expect.arrayContaining(['h-1.5', 'border-t', 'border-b-[3px]', 'border-lca-gold']))
    expect(classes).not.toContain('border-t-[3px]')
    expect(classes).not.toContain('border-ink')
    expect(rule.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('the accessibility build\'s fixture page', () => {
  function fixture(name: string): HTMLElement {
    const { container } = render(
      <MemoryRouter initialEntries={[`/__fixtures/${name}`]}>
        <Routes>
          <Route path="/__fixtures/:name" element={<ScopeFixturePage />} />
        </Routes>
      </MemoryRouter>,
    )
    const copy = container.cloneNode(true) as HTMLElement
    cleanup()
    return copy
  }

  it.each(['base', 'scholastic', 'live'])('the %s fixture carries no hook, no second scope and no heritage part', (name) => {
    const drawn = fixture(name)
    expect(drawn.querySelectorAll('[data-theme]')).toHaveLength(1)
    expect(drawn.querySelectorAll('[data-heritage], #fixture-base-in-heritage, #fixture-heritage')).toHaveLength(0)
    expect(drawn.textContent).not.toContain('Heritage parts')
  })

  it('the heritage fixture puts its hooks on its heading, one card and its standings, and one base scope straight inside its own', () => {
    const drawn = fixture('heritage')
    const scopes = [...drawn.querySelectorAll('[data-theme]')]
    expect(scopes.map((el) => el.getAttribute('data-theme'))).toEqual(['heritage', ''])
    expect(scopes[1].id).toBe('fixture-base-in-heritage')
    expect(scopes[1].parentElement!.closest('[data-theme]')).toBe(scopes[0])
    // A box of its own, with a field and two Buttons in the base look.
    expect((scopes[1] as HTMLElement).style.display).toBe('')
    expect(scopes[1].querySelectorAll('input')).toHaveLength(1)
    expect(scopes[1].querySelectorAll('[data-slot="button"]')).toHaveLength(2)
    expect([...drawn.querySelectorAll('[data-heritage]')].map((el) => `${el.tagName.toLowerCase()} ${el.getAttribute('data-heritage')}`)).toEqual(['h1 display', 'div card', 'table table'])
    // Nothing in the base scope carries a hook.
    expect(scopes[1].querySelectorAll('[data-heritage]')).toHaveLength(0)
  })
})
