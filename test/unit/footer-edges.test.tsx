// @vitest-environment jsdom
//
// The new footer at its edges (WS02 step 8), src/components/layout/SiteFooter.tsx,
// drawn as test/unit/footer.test.tsx draws it, under a router and a sign-in
// context, with the switches set through a mocked FEATURES and the window's
// width given through a stand-in for matchMedia:
//
// - every switch the footer reads, on at once: each link and button still
//   the entry by id, every move made at once, in the columns and the trust
//   line alike, no link left at an address the switches move away from;
//   and the switches it does not read change nothing in it;
// - one label per destination inside the footer: two links to one page
//   never differ in their words, and one label never names two pages;
// - the join slot beside Donate the same as the desktop header's, for every
//   state the sign-in can be in, the ones still being read among them;
// - Donate whose form cannot be loaded: the footer's own notice at its top,
//   the focus kept on the Donate pressed and given back to it when the
//   notice is put away, a second press trying again, and the dialog once
//   its code can be had;
// - the build's date at Louisiana's edges: midnight under daylight time and
//   under standard time, both changes of the clock in 2026, the turn of the
//   year and a leap day, in the same words whatever the machine's own zone;
// - names and ids: each column a nav named by its heading in both forms,
//   each fold button named by its column, every id in the footer once and
//   every id an aria attribute names inside the footer;
// - a column opened below 768 pixels stays open across a change of page;
// - every control on the navy ring ground, the boundary's notice on its own;
// - with the chrome off, a page that holds a build-date meta still draws
//   today's footer, with no date.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiMember } from '@/areas/membership/api'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { NavId } from '@/lib/nav'

/** The switches as each test starts: the chrome on, everything the footer reads off. */
const START = {
  newLook: true, newNav: true, newMembership: false, newAbout: false, newNews: false, newTournaments: false, newClubs: false,
  myLcaRail: false, siteSearch: false, eventStrip: false, eventStripLive: false, liveMarker: false, themeHeritage: false,
}
const flags = vi.hoisted(() => ({
  newLook: true, newNav: true, newMembership: false, newAbout: false, newNews: false, newTournaments: false, newClubs: false,
  myLcaRail: false, siteSearch: false, eventStrip: false, eventStripLive: false, liveMarker: false, themeHeritage: false,
}))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  const switched = Object.fromEntries(
    Object.keys(flags).map((name) => [name, { get: () => flags[name as keyof typeof flags], enumerable: true }]),
  )
  return { ...real, FEATURES: Object.defineProperties({ ...real.FEATURES }, switched) }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
/** Whether the donation form's code cannot be had: the dialog then fails while it draws, as a lazy import that rejected does. */
const gone = vi.hoisted(() => ({ donation: false }))
vi.mock('@/components/DonateButton', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/components/DonateButton')>()
  return {
    ...real,
    DonateDialog: (props: Parameters<typeof real.DonateDialog>[0]) => {
      if (gone.donation) throw new TypeError('Failed to fetch dynamically imported module: /assets/DonateButton-gone.js')
      return <real.DonateDialog {...props} />
    },
  }
})

const { SiteFooter } = await import('@/components/layout/SiteFooter')
const { SiteHeader } = await import('@/components/layout/SiteHeader')
const { Footer } = await import('@/components/layout/Footer')
const { FooterToday } = await import('./fixtures/footer-today')
const { FOOTER_BRAND_ACTIONS, TRUST_LINE_LINKS, footerColumns, navEntry } = await import('@/lib/nav')

const DIALOG = 'Support the Louisiana Chess Association'
const NOTICE = 'The donation form could not be loaded. Reload the page to try again.'
/** US Chess's old initials, put together here so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)

/** What the sign-in context holds for one visitor. */
interface Who {
  user?: boolean
  loading?: boolean
  memberLoading?: boolean
  status?: ApiMember['membership_status']
  expiry?: string
}

/** A visitor as the footer and the header read one. */
function visitor(who: Who = {}): AuthContextValue {
  return {
    user: who.user ? ({ id: 'fx-m-footer-edges' } as User) : null,
    session: null,
    member: who.status ? ({ id: 'fx-m-footer-edges', membership_status: who.status, membership_expiry: who.expiry ?? '2027-06-30' } as ApiMember) : null,
    role: 'member',
    seats: [],
    managedClubs: [],
    isBoardMember: false,
    assuranceLevel: who.user ? 'aal1' : null,
    mfaRequired: false,
    directedTournaments: [],
    directedTournamentIds: [],
    loading: who.loading ?? false,
    memberLoading: who.memberLoading ?? false,
    signOut: async () => {},
  } as unknown as AuthContextValue
}

/** A stand-in for matchMedia at a width, answering min-width queries as a browser does. */
function stubWidth(width: number) {
  vi.stubGlobal('matchMedia', (query: string) => {
    const m = /^\(min-width: ([\d.]+)px\)$/.exec(query.trim())
    return { matches: m ? width >= Number(m[1]) : false, media: query, addEventListener: () => {}, removeEventListener: () => {} }
  })
}

function draw(auth: AuthContextValue = visitor(), path = '/') {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <SiteFooter />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const footer = () => screen.getByRole('contentinfo')
const columns = () => [...footer().querySelectorAll<HTMLElement>('[data-slot="footer-column"]')]
const brand = () => footer().querySelector<HTMLElement>('[data-slot="footer-brand"]')!
/** Every link and button of the footer but the theme switch's, hidden ones included, as words, address and tag. */
function controls() {
  return [...footer().querySelectorAll('a, button')]
    .filter((el) => !el.closest('[role="group"]'))
    .map((el) => ({ words: (el.textContent ?? '').trim(), href: el.getAttribute('href'), tag: el.tagName }))
}
/** What the model says one entry is drawn as. */
const asEntry = (id: NavId) => {
  const entry = navEntry(id)
  return { words: entry.label, href: entry.href, tag: entry.href === null ? 'BUTTON' : 'A' }
}
/** The footer's markup with each of its ids named by its place, since every draw gives the ids anew. */
function markupOf(root: Element): string {
  let html = root.outerHTML
  ;[...root.querySelectorAll('[id]')].map((el) => el.id).forEach((id, i) => {
    html = html.split(id).join(`id-${i}`)
  })
  return html
}

/** The build's date as the plugin writes it into the page, put into the head and taken out after. */
function plantBuildDate(content: string) {
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'build-date')
  meta.setAttribute('content', content)
  document.head.append(meta)
}

beforeEach(() => {
  Object.assign(flags, START)
  gone.donation = false
  stubWidth(1280)
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const meta of document.head.querySelectorAll('meta[name="build-date"]')) meta.remove()
  document.documentElement.className = ''
  window.localStorage.clear()
})

// ── Every switch the footer reads, on at once ──────────────────────────────

describe('every switch the footer reads, on at once', () => {
  const ALL_ON = { newMembership: true, newAbout: true, newNews: true, newTournaments: true, newClubs: true }

  it('keeps each link and button the entry by id, in the model\'s order, with every move made at once and every waiting link drawn', () => {
    Object.assign(flags, ALL_ON)
    draw()
    expect(controls()).toEqual([
      ...FOOTER_BRAND_ACTIONS.map(asEntry),
      ...footerColumns().flatMap((column) => column.links.map(asEntry)),
      ...TRUST_LINE_LINKS.map(asEntry),
    ])
    const byWords = (words: string) => controls().filter((c) => c.words === words).map((c) => c.href)
    expect(byWords('Board & regions')).toEqual(['/about/board'])
    expect(byWords('Bylaws & rules')).toEqual(['/about/bylaws', '/about/bylaws'])
    expect(byWords('Minutes')).toEqual(['/about/minutes', '/about/minutes'])
    expect(byWords('State champions')).toEqual(['/about/champions'])
    expect(byWords('Calendar')).toEqual(['/tournaments?view=calendar'])
    expect(byWords('Results')).toEqual(['/results'])
    expect(byWords('Suggest a club')).toEqual(['/clubs/suggest'])
    expect(byWords('Donate')).toEqual(['/give', '/give'])
  })

  it('leaves no link at an address the switches move away from, and no button but the theme switch\'s once Donate is a link', () => {
    Object.assign(flags, ALL_ON)
    draw()
    const hrefs = controls().map((c) => c.href ?? '')
    expect(hrefs.filter((href) => href.startsWith('/governance'))).toEqual([])
    expect(hrefs.filter((href) => href === '/champions')).toEqual([])
    expect([...footer().querySelectorAll('button')].every((button) => button.closest('[role="group"]'))).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each(['newMembership', 'newAbout', 'newNews', 'newTournaments', 'newClubs'] as const)('with every switch on but %s: still each control the entry by id', (off) => {
    Object.assign(flags, ALL_ON, { [off]: false })
    draw()
    expect(controls()).toEqual([
      ...FOOTER_BRAND_ACTIONS.map(asEntry),
      ...footerColumns().flatMap((column) => column.links.map(asEntry)),
      ...TRUST_LINE_LINKS.map(asEntry),
    ])
  })

  it.each(['siteSearch', 'eventStrip', 'eventStripLive', 'liveMarker', 'myLcaRail', 'themeHeritage'] as const)('changes nothing when %s, a switch it does not read, is on', (name) => {
    for (const width of [390, 1280]) {
      stubWidth(width)
      const { container } = draw()
      const before = markupOf(container.querySelector('footer')!)
      cleanup()
      flags[name] = true
      const after = draw().container.querySelector('footer')!
      expect(markupOf(after), `${name} at ${width}`).toBe(before)
      cleanup()
      flags[name] = false
    }
  })
})

// ── One label per destination ──────────────────────────────────────────────

describe('one label per destination inside the footer', () => {
  it.each([
    ['every switch off', {}],
    ['every switch it reads on', { newMembership: true, newAbout: true, newNews: true, newTournaments: true, newClubs: true }],
  ] as const)('with %s: two links to one page never differ in their words, and one label never names two pages', (_mix, on) => {
    Object.assign(flags, on)
    draw()
    const links = controls().filter((c) => c.href !== null)
    const wordsFor = new Map<string, Set<string>>()
    const hrefsFor = new Map<string, Set<string>>()
    for (const { words, href } of links) {
      wordsFor.set(href!, (wordsFor.get(href!) ?? new Set()).add(words))
      hrefsFor.set(words, (hrefsFor.get(words) ?? new Set()).add(href!))
    }
    for (const [href, words] of wordsFor) expect([...words], href).toHaveLength(1)
    for (const [words, hrefs] of hrefsFor) expect([...hrefs], words).toHaveLength(1)
    // The two pages the trust line repeats from the About LCA column, with the column's words.
    expect([...(hrefsFor.get('Bylaws & rules') ?? [])]).toEqual([navEntry('bylawsRules').href])
    expect([...(hrefsFor.get('Minutes') ?? [])]).toEqual([navEntry('minutes').href])
  })
})

// ── The join slot, by the header's own rule ────────────────────────────────

describe('the join slot beside Donate, the same as the desktop header\'s', () => {
  /** The gold join link in a part of the chrome, as its words and address, or nothing. */
  const goldIn = (part: Element) => [...part.querySelectorAll('a[data-variant="gold"]')].map((a) => [a.textContent, a.getAttribute('href')])

  it.each([
    ['a visitor signed out', {}, [['Join LCA', '/membership']]],
    ['a visitor while the sign-in is still read', { loading: true }, [['Join LCA', '/membership']]],
    ['someone signed in while the sign-in is still read', { user: true, loading: true, status: 'active' }, [['Join LCA', '/membership']]],
    ['someone signed in whose member is still loading', { user: true, memberLoading: true }, []],
    ['someone signed in whose member could not be read', { user: true }, []],
    ['a member with no membership', { user: true, status: 'none' }, [['Join LCA', '/membership']]],
    ['a member whose membership has expired', { user: true, status: 'expired', expiry: '2026-06-30' }, [['Renew', '/membership']]],
    ['an active member', { user: true, status: 'active', expiry: '2027-06-30' }, []],
    ['an active member within 30 days of the end', { user: true, status: 'active', expiry: '2026-11-15' }, []],
  ] as const)('for %s: the footer offers what the header offers', (_who, who, offered) => {
    const auth = visitor(who as Who)
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/clubs']}>
          <SiteHeader />
          <SiteFooter />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    const inHeader = goldIn(screen.getByRole('banner').querySelector('[data-slot="site-header-account"]')!)
    const inFooter = goldIn(brand())
    expect(inFooter).toEqual(inHeader)
    expect(inFooter).toEqual(offered)
    // Donate is always beside it, after it, as the model orders the two.
    const words = [...brand().querySelectorAll('a, button')].map((el) => el.textContent)
    expect(words.at(-1)).toBe('Donate')
    expect(words).toHaveLength(offered.length + 1)
  })
})

// ── Donate whose form cannot be loaded ─────────────────────────────────────

describe('Donate when the donation form cannot be loaded', () => {
  const brandDonate = () => within(brand()).getByRole('button', { name: 'Donate' })
  const contactDonate = () => within(columns()[3]).getByRole('button', { name: 'Donate' })

  it('says so in the footer\'s own notice at the footer\'s top, on its own light ground, keeps the focus on the Donate pressed, and gives it back to it when the notice is put away', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    gone.donation = true
    draw()
    const pressed = brandDonate()
    act(() => pressed.focus())
    fireEvent.click(pressed)
    const notice = await within(footer()).findByRole('alert')
    expect(notice.textContent).toContain(NOTICE)
    expect(footer().firstElementChild).toBe(notice)
    expect(notice.getAttribute('data-ring-ground')).toBe('light')
    expect(notice.closest('[data-ring-ground="light"]')).toBe(notice)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(pressed)
    expect(logged).toHaveBeenCalled()
    fireEvent.click(within(notice).getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(within(footer()).queryByRole('alert')).toBeNull())
    expect(document.activeElement).toBe(pressed)
  })

  it('tries again on a second press, from the Contact column\'s Donate too, and opens the dialog once its code can be had, the focus back on the Donate pressed when it closes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    gone.donation = true
    draw()
    for (const pressed of [brandDonate(), contactDonate()]) {
      act(() => pressed.focus())
      fireEvent.click(pressed)
      const notice = await within(footer()).findByRole('alert')
      expect(notice.textContent, pressed.closest('nav') ? 'Contact' : 'brand').toContain(NOTICE)
      expect(document.activeElement).toBe(pressed)
      fireEvent.click(within(notice).getByRole('button', { name: 'Dismiss' }))
      await waitFor(() => expect(within(footer()).queryByRole('alert')).toBeNull())
      expect(document.activeElement).toBe(pressed)
    }
    gone.donation = false
    const pressed = contactDonate()
    act(() => pressed.focus())
    fireEvent.click(pressed)
    expect(await screen.findByRole('dialog', { name: DIALOG })).toBeTruthy()
    // The open dialog hides the rest of the page from screen readers, so the notice is looked for by its slot.
    expect(document.querySelector('[data-slot="on-demand-notice"]')).toBeNull()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(pressed))
  })

  it('opens one dialog however quickly Donate is pressed twice', async () => {
    draw()
    const pressed = brandDonate()
    act(() => pressed.focus())
    fireEvent.click(pressed)
    fireEvent.click(pressed)
    expect(await screen.findByRole('dialog', { name: DIALOG })).toBeTruthy()
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
  })
})

// ── The build's date at Louisiana's edges ──────────────────────────────────

describe('the trust line\'s date at the edges of Louisiana\'s days', () => {
  const time = () => within(footer()).getByRole('list', { name: 'About this site' }).querySelector('time')!

  it.each([
    ['the last moment of Saturday, October 31, under daylight time', '2026-11-01T04:59:59.999Z', 'Sat, Oct 31, 2026'],
    ['midnight starting Sunday, November 1, under daylight time', '2026-11-01T05:00:00.000Z', 'Sun, Nov 1, 2026'],
    ['1:30 in the morning before the clock goes back', '2026-11-01T06:30:00.000Z', 'Sun, Nov 1, 2026'],
    ['1:30 in the morning again, after the clock goes back', '2026-11-01T07:30:00.000Z', 'Sun, Nov 1, 2026'],
    ['the last moment of Sunday, November 1, under standard time', '2026-11-02T05:59:59.999Z', 'Sun, Nov 1, 2026'],
    ['midnight starting Monday, November 2, under standard time', '2026-11-02T06:00:00.000Z', 'Mon, Nov 2, 2026'],
    ['the last moment of Saturday, March 7, under standard time', '2026-03-08T05:59:59.999Z', 'Sat, Mar 7, 2026'],
    ['midnight starting Sunday, March 8, under standard time', '2026-03-08T06:00:00.000Z', 'Sun, Mar 8, 2026'],
    ['3:00 in the morning, as the clock goes forward', '2026-03-08T08:00:00.000Z', 'Sun, Mar 8, 2026'],
    ['the last moment of Sunday, March 8, under daylight time', '2026-03-09T04:59:59.999Z', 'Sun, Mar 8, 2026'],
    ['midnight starting Monday, March 9, under daylight time', '2026-03-09T05:00:00.000Z', 'Mon, Mar 9, 2026'],
    ['the last moment of the year in Louisiana, after midnight in UTC', '2027-01-01T05:59:59.999Z', 'Thu, Dec 31, 2026'],
    ['midnight starting the new year in Louisiana', '2027-01-01T06:00:00.000Z', 'Fri, Jan 1, 2027'],
    ['noon on a leap day', '2028-02-29T18:00:00.000Z', 'Tue, Feb 29, 2028'],
  ] as const)('%s (%s) reads %s, the instant itself the time\'s dateTime', (_when, instant, words) => {
    plantBuildDate(instant)
    draw()
    expect(time().getAttribute('datetime')).toBe(instant)
    expect(time().textContent).toBe(words)
    expect(time().parentElement!.textContent).toBe(`Site last updated ${words}`)
  })

  it.each([
    ['Pacific/Kiritimati', 18],
    ['Pacific/Pago_Pago', 17],
    ['Asia/Kolkata', 10],
  ] as const)('reads the same words on a machine whose own zone is %s', (zone, localHour) => {
    const was = process.env.TZ
    process.env.TZ = zone
    try {
      // The machine's zone took: its own clock at the instant is the zone's.
      expect(new Date('2026-11-01T04:59:59.999Z').getHours()).toBe(localHour)
      plantBuildDate('2026-11-01T04:59:59.999Z')
      draw()
      expect(time().textContent).toBe('Sat, Oct 31, 2026')
    } finally {
      if (was === undefined) delete process.env.TZ
      else process.env.TZ = was
    }
  })

  it('names US Chess in full in the trust line, and nowhere by its old initials', () => {
    plantBuildDate('2026-10-31T14:42:00.000Z')
    draw()
    expect(within(footer()).getByRole('list', { name: 'About this site' }).textContent).toContain('US Chess state affiliate')
    expect(footer().textContent).not.toMatch(OLD_INITIALS)
  })
})

// ── Names and ids ──────────────────────────────────────────────────────────

describe('names and ids', () => {
  it.each([390, 1280])('at %s pixels: each column is a nav named by its heading, and every id in the footer is there once and named only from inside it', (width) => {
    stubWidth(width)
    draw()
    for (const { title } of footerColumns()) {
      const nav = within(footer()).getByRole('navigation', { name: title })
      expect(nav.getAttribute('data-slot')).toBe('footer-column')
      if (width < 768) {
        // The fold's button is named by its column alone: its chevron says nothing.
        const button = within(nav).getByRole('button', { name: title })
        expect(button.closest('h2')).not.toBeNull()
        expect(button.getAttribute('aria-expanded')).toBe(String(title === 'Contact'))
      } else {
        expect(within(nav).queryByRole('button', { name: title })).toBeNull()
        expect(within(nav).getByRole('heading', { level: 2, name: title })).toBeTruthy()
      }
    }
    const ids = [...footer().querySelectorAll('[id]')].map((el) => el.id)
    expect(ids.length).toBeGreaterThanOrEqual(width < 768 ? 9 : 5)
    expect(new Set(ids).size).toBe(ids.length)
    for (const el of footer().querySelectorAll('[aria-controls], [aria-labelledby], [aria-describedby]')) {
      for (const attribute of ['aria-controls', 'aria-labelledby', 'aria-describedby']) {
        for (const id of (el.getAttribute(attribute) ?? '').split(/\s+/).filter(Boolean)) {
          const named = document.getElementById(id)
          expect(named, `${attribute}=${id}`).not.toBeNull()
          expect(footer().contains(named), `${attribute}=${id}`).toBe(true)
        }
      }
    }
    // The theme switch is the group named Appearance, its label found inside the footer.
    expect(within(footer()).getByRole('group', { name: 'Appearance' })).toBeTruthy()
  })

  it('gives two footers drawn side by side ids of their own, so no id is ever held twice', () => {
    render(
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter>
          <SiteFooter />
          <SiteFooter />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    const ids = [...document.querySelectorAll('footer [id]')].map((el) => el.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ── The fold across a change of page ───────────────────────────────────────

describe('the fold across a change of page', () => {
  function Page() {
    const { pathname, search } = useLocation()
    return <output data-testid="page">{`${pathname}${search}`}</output>
  }
  const folds = () => columns().map((nav) => nav.querySelector('h2 > button')!.getAttribute('aria-expanded'))

  it('keeps a column opened below 768 pixels open when one of its links is followed, the footer drawn once for every page', () => {
    stubWidth(390)
    render(
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="*" element={<Page />} />
          </Routes>
          <SiteFooter />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
    const drawn = footer()
    expect(folds()).toEqual(['false', 'false', 'false', 'true'])
    fireEvent.click(columns()[0].querySelector('h2 > button')!)
    expect(folds()).toEqual(['true', 'false', 'false', 'true'])
    fireEvent.click(within(columns()[0]).getByRole('link', { name: 'Scholastic' }))
    expect(screen.getByTestId('page').textContent).toBe('/scholastic')
    expect(folds()).toEqual(['true', 'false', 'false', 'true'])
    fireEvent.click(within(columns()[3]).getByRole('link', { name: 'Membership help' }))
    expect(screen.getByTestId('page').textContent).toBe('/contact?subject=membership')
    expect(folds()).toEqual(['true', 'false', 'false', 'true'])
    expect(footer()).toBe(drawn)
  })
})

// ── The rings ──────────────────────────────────────────────────────────────

describe('the rings', () => {
  it.each([390, 1280])('at %s pixels: every link and button of the footer takes the navy ring ground from the footer itself', (width) => {
    stubWidth(width)
    draw()
    const all = [...footer().querySelectorAll<HTMLElement>('a, button')]
    expect(all.length).toBeGreaterThan(20)
    for (const el of all) expect(el.closest('[data-ring-ground]'), `${el.tagName} ${el.textContent}`).toBe(footer())
    expect(footer().getAttribute('data-ring-ground')).toBe('navy')
  })
})

// ── With the chrome off ────────────────────────────────────────────────────

describe('with the chrome off', () => {
  it('reads the chrome\'s condition on every draw: the switches changed between two draws swap the whole footer, each way, with no error', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const tree = () => (
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter>
          <Footer />
        </MemoryRouter>
      </AuthContext.Provider>
    )
    stubWidth(390)
    const { container, rerender } = render(tree())
    expect(container.querySelector('[data-slot="site-footer"]')).not.toBeNull()
    flags.newNav = false
    rerender(tree())
    expect(container.querySelector('[data-slot="site-footer"]')).toBeNull()
    expect(container.textContent).toContain('Serving Louisiana players since 1915')
    flags.newNav = true
    rerender(tree())
    expect(container.querySelector('[data-slot="site-footer"]')).not.toBeNull()
    // Drawn anew, the folds start as they always do: Contact open and the rest closed.
    expect(columns().map((nav) => nav.querySelector('h2 > button')!.getAttribute('aria-expanded'))).toEqual(['false', 'false', 'false', 'true'])
    expect(errors).not.toHaveBeenCalled()
  })

  it.each([
    { newLook: false, newNav: false },
    { newLook: true, newNav: false },
    { newLook: false, newNav: true },
  ])('with newLook $newLook and newNav $newNav, a page holding a build-date meta still draws today\'s footer, with no date', (mix) => {
    Object.assign(flags, mix)
    plantBuildDate('2026-10-31T14:42:00.000Z')
    const live = render(
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter>
          <Footer />
        </MemoryRouter>
      </AuthContext.Provider>,
    ).container.innerHTML
    cleanup()
    const copy = render(
      <AuthContext.Provider value={visitor()}>
        <MemoryRouter>
          <FooterToday />
        </MemoryRouter>
      </AuthContext.Provider>,
    ).container.innerHTML
    expect(live).toBe(copy)
    expect(live).not.toContain('<time')
    expect(live).not.toContain('Site last updated')
    expect(live).not.toContain('site-footer')
  })
})
