// @vitest-environment jsdom
//
// The edges of the new club page (WS09 step 21), beyond the bare and fuller
// clubs: an answer that arrives after the person has moved on, a section
// named in the address, the page's title, a logo that may and may not be
// drawn, a block with only part of its content, the links a club may give,
// the club's own words kept as written, a page that does not change with the
// club's colour, and the room every control and section keeps for the
// section nav (WCAG 2.2: the focus ring, a target of 24 by 24 pixels or
// more, and a focused control never hidden under a sticky bar). The page is
// drawn through the real client with fetch stubbed, and the switches are set
// through the mocked FEATURES. Every name, address and club here is made up.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { CLEAR_OF_BARS, CONTROLS_CLEAR_OF_BARS } from '@/areas/clubs/clubPage'
import { REFLOW_QUERY } from '@/hooks/useWideScreen'
import { ClubPageView } from '@/areas/clubs/components/ClubPage'
import { SITE_NAME, clubPageTitle } from '@domain/clubs/pageMeta'
import { clubPageResponseSchema, type ClubPageResponse } from '@domain/contracts'
import { CLUB_SLUG, bareAnswer, fullAnswer, visitor } from './helpers/clubPageAnswer'

vi.setConfig({ testTimeout: 15000 })

const flags = vi.hoisted(() => ({ newClubs: true, newLook: true, newNav: false, clubKeepers: false, clubEmailHidden: true }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => <div data-testid="club-map" /> }))

const { ClubListingPage } = await import('@/pages/ClubListingPage')

const ROOT = resolve(__dirname, '../..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

/** A made-up answer with the given parts of the bare answer replaced, held to the answer's own contract. */
function answerWith(patch: {
  club?: Partial<ClubPageResponse['club']>
  about?: Partial<ClubPageResponse['about']>
  statement?: Partial<ClubPageResponse['statement']>
  places?: ClubPageResponse['places']
  sections?: string[]
}): ClubPageResponse {
  const base = bareAnswer()
  return clubPageResponseSchema.parse({
    ...base,
    club: { ...base.club, ...patch.club },
    about: { ...base.about, ...patch.about },
    statement: { ...base.statement, ...patch.statement },
    places: patch.places ?? base.places,
    sections: patch.sections ?? base.sections,
  })
}

const place = (name: string, over: Partial<ClubPageResponse['places'][number]> = {}): ClubPageResponse['places'][number] => ({
  name, street: null, note: null, latitude: null, longitude: null, ...over,
})

function drawView(answer: ClubPageResponse, keeper: Parameters<typeof ClubPageView>[0]['keeper'] = null) {
  const view = render(<MemoryRouter><ClubPageView answer={answer} keeper={keeper} /></MemoryRouter>)
  return view.container.querySelector('[data-slot="club-page"]') as HTMLElement
}

let asked: string[] = []
beforeEach(() => {
  Object.assign(flags, { newClubs: true, newLook: true, newNav: false, clubKeepers: false, clubEmailHidden: true })
  asked = []
  // jsdom draws no layout, so it has no scrollIntoView; the page calls it for a section named in the address.
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  document.title = ''
})

/** Fetch stubbed with what each address answers, each held back until the case lets it go. */
function holdAnswers(table: Record<string, ClubPageResponse>) {
  const gates = new Map<string, () => void>()
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    asked.push(url)
    return new Promise<Response>((resolveResponse) => {
      gates.set(url, () => {
        const body = table[url]
        resolveResponse(new Response(JSON.stringify(body ?? { error: 'Club not found' }), { status: body ? 200 : 404 }))
      })
    })
  }))
  return gates
}

function answers(table: Record<string, ClubPageResponse>) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    asked.push(url)
    const body = table[url]
    return new Response(JSON.stringify(body ?? { error: 'Club not found' }), { status: body ? 200 : 404 })
  }))
}

function GoTo({ to }: { to: string }) {
  const navigate = useNavigate()
  return <button type="button" onClick={() => navigate(to)}>{`go to ${to}`}</button>
}

function open(path: string, auth: AuthContextValue = visitor()) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <GoTo to="/clubs/example-knights-club" />
        <Routes><Route path="/clubs/:id" element={<ClubListingPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const OTHER = answerWith({ club: { id: 'c-example-knights', slug: 'example-knights-club', name: 'Example Knights Club' } })

describe('an answer that arrives after the person has moved on', () => {
  it('is not drawn: the page the person went to is, whichever answer comes back first', async () => {
    const gates = holdAnswers({ [`/api/clubs/${CLUB_SLUG}/page`]: bareAnswer(), '/api/clubs/example-knights-club/page': OTHER })
    open(`/clubs/${CLUB_SLUG}`)
    await waitFor(() => expect(asked).toEqual([`/api/clubs/${CLUB_SLUG}/page`]))
    act(() => { screen.getByRole('button', { name: 'go to /clubs/example-knights-club' }).click() })
    await waitFor(() => expect(asked).toEqual([`/api/clubs/${CLUB_SLUG}/page`, '/api/clubs/example-knights-club/page']))
    // The page the person went to answers first; the one they left answers late.
    await act(async () => gates.get('/api/clubs/example-knights-club/page')!())
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Example Knights Club')
    await act(async () => gates.get(`/api/clubs/${CLUB_SLUG}/page`)!())
    await act(async () => {})
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Example Knights Club')
    expect(screen.queryByText('Example Chess Club')).toBeNull()
    expect(document.title).toBe(clubPageTitle('Example Knights Club', 'Example City'))
  })

  it('says Loading, not the club the person left, while the new page is asked for', async () => {
    const gates = holdAnswers({ [`/api/clubs/${CLUB_SLUG}/page`]: bareAnswer(), '/api/clubs/example-knights-club/page': OTHER })
    open(`/clubs/${CLUB_SLUG}`)
    await waitFor(() => expect(gates.has(`/api/clubs/${CLUB_SLUG}/page`)).toBe(true))
    await act(async () => gates.get(`/api/clubs/${CLUB_SLUG}/page`)!())
    await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' })
    act(() => { screen.getByRole('button', { name: 'go to /clubs/example-knights-club' }).click() })
    const status = await screen.findByRole('status')
    expect(status.textContent).toBe('Loading the club…')
    expect(screen.queryByText('Example Chess Club')).toBeNull()
    await act(async () => gates.get('/api/clubs/example-knights-club/page')!())
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('Example Knights Club')
  })

  it('draws nothing, and sets nothing, when the person leaves before the answer comes', async () => {
    const gates = holdAnswers({ [`/api/clubs/${CLUB_SLUG}/page`]: bareAnswer() })
    const before = document.title
    const view = open(`/clubs/${CLUB_SLUG}`)
    await waitFor(() => expect(gates.size).toBe(1))
    view.unmount()
    await act(async () => gates.get(`/api/clubs/${CLUB_SLUG}/page`)!())
    expect(document.body.textContent).toBe('')
    expect(document.title).toBe(before)
  })
})

describe('the page\'s title', () => {
  it('names the club, its town and the site, and gives the old title back when the person leaves', async () => {
    document.title = 'Before the club'
    answers({ [`/api/clubs/${CLUB_SLUG}/page`]: bareAnswer() })
    const view = open(`/clubs/${CLUB_SLUG}`)
    await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' })
    expect(document.title).toBe(`Example Chess Club · Chess club in Example City, Louisiana · ${SITE_NAME}`)
    view.unmount()
    expect(document.title).toBe('Before the club')
  })

  it('says the club was not found when no club goes by the address, and never a stale club\'s name', async () => {
    answers({})
    open('/clubs/no-such-club')
    await screen.findByRole('heading', { level: 1, name: 'Club not found' })
    expect(document.title).toBe(`Club not found · ${SITE_NAME}`)
  })
})

describe('a section named in the address', () => {
  it('is scrolled into view once the page has drawn, with the focus on the heading and the heading not scrolled to', async () => {
    answers({ [`/api/clubs/${CLUB_SLUG}/page`]: bareAnswer() })
    const scrolled: Element[] = []
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) { scrolled.push(this) })
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    open(`/clubs/${CLUB_SLUG}#when-and-where`)
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' })
    await waitFor(() => expect(document.activeElement).toBe(h1))
    expect(scrolled.map((el) => el.id)).toEqual(['when-and-where'])
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
    focus.mockRestore()
  })

  it('leaves the heading to scroll as it always does when the hash names no section, or a hash that cannot be read', async () => {
    answers({ [`/api/clubs/${CLUB_SLUG}/page`]: bareAnswer() })
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    for (const hash of ['#nothing-here', '#%E0%A4%A', '#']) {
      focus.mockClear()
      open(`/clubs/${CLUB_SLUG}${hash}`)
      const h1 = await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' })
      await waitFor(() => expect(document.activeElement).toBe(h1))
      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
      expect(focus).toHaveBeenCalledWith({ preventScroll: false })
      cleanup()
    }
    focus.mockRestore()
  })
})

describe('the club\'s logo', () => {
  const tile = (page: HTMLElement) => page.querySelector<HTMLElement>('.size-24')!

  it('fills the tile when it is a file on this site, with no initials beside it and no words of its own', () => {
    const page = drawView(answerWith({ club: { logo: '/club-logos/example.png' } }))
    const img = tile(page).querySelector('img')!
    expect(img.getAttribute('src')).toBe('/club-logos/example.png')
    expect(img.getAttribute('alt')).toBe('')
    expect(tile(page).textContent).toBe('')
  })

  it.each(['https://elsewhere.example.org/logo.png', '//elsewhere.example.org/logo.png', 'javascript:alert(1)', 'logo.png', ''])(
    'draws the initials, and loads nothing from elsewhere, for the address %j',
    (logo) => {
      const page = drawView(answerWith({ club: { logo } }))
      expect(tile(page).querySelector('img')).toBeNull()
      expect(tile(page).textContent).toBe('EC')
    },
  )
})

describe('a block with only part of its content', () => {
  it('draws About with Cost alone, as a box under the heading, with no empty words above it and no other box', () => {
    const page = drawView(answerWith({ about: { text: null, cost: 'Free to play.' } }))
    const about = page.querySelector('#about')!
    expect(within(about as HTMLElement).getByRole('heading', { level: 2 }).textContent).toBe('About Example Chess Club')
    expect([...about.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Cost'])
    expect(about.querySelector('p:empty')).toBeNull()
    expect(about.textContent).toContain('Free to play.')
    expect(about.textContent).not.toMatch(/not listed|Who is welcome|Find us online/i)
  })

  it('draws Who is welcome with the two ticks in words alone, when the club ticked them and wrote nothing', () => {
    const page = drawView(answerWith({ about: { text: null, weekend_play: true, scholastic_friendly: true } }))
    const about = page.querySelector('#about')!
    expect([...about.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Who is welcome'])
    expect([...about.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['The club plays on weekends', 'Scholastic friendly'])
    expect(page.textContent).not.toMatch(/\bfalse\b|\btrue\b|\b0\b|\b1\b/)
  })

  it('draws one tick alone when the club ticked one, and no tick for the one it did not', () => {
    const page = drawView(answerWith({ about: { text: null, weekend_play: false, scholastic_friendly: true } }))
    expect([...page.querySelectorAll('#about li')].map((li) => li.textContent)).toEqual(['Scholastic friendly'])
  })

  it('keeps words of one sentence large when other boxes sit under them, and never beside them in an empty column', () => {
    const page = drawView(answerWith({ about: { cost: 'Free.', welcome: 'Everyone.' } }))
    const text = page.querySelector('#about p')!
    expect(text.className).toMatch(/text-xl/)
    expect([...page.querySelectorAll('#about h3')].map((h) => h.textContent)).toEqual(['Cost', 'Who is welcome'])
  })

  it('draws the statement alone when the club has no place: no list of places, no map, no Directions', () => {
    const page = drawView(answerWith({ places: [] }))
    const where = page.querySelector('#when-and-where')!
    expect(where.querySelector('blockquote')).not.toBeNull()
    expect(where.querySelector('ul')).toBeNull()
    expect(where.querySelector('[data-testid="club-map"]')).toBeNull()
    expect(where.textContent).not.toMatch(/Directions/)
  })

  it('draws the places alone when the club wrote no statement: no quote and no empty figure', () => {
    const page = drawView(answerWith({ statement: { text: null }, places: [place('Example Library', { latitude: 30.1, longitude: -91.2 })] }))
    const where = page.querySelector('#when-and-where')!
    expect(where.querySelector('blockquote, figure, figcaption')).toBeNull()
    expect(where.textContent).toContain('Example Library')
    // The cover draws no line of how the club meets either.
    expect(page.querySelector('h1')!.parentElement!.querySelectorAll('p')).toHaveLength(1)
  })

  it('draws no street, no note and no empty line for a place whose street and note are only spaces', () => {
    const page = drawView(answerWith({ places: [place('Example Library', { street: '   ', note: '\n  ' })] }))
    const row = page.querySelector('#when-and-where li')!
    expect(row.querySelectorAll('p')).toHaveLength(1)
    expect(row.textContent).toBe('Example Library')
  })

  it('draws Directions only for a place with a whole point, each at its own point, up to the two the answer allows', () => {
    const page = drawView(answerWith({
      places: [place('Example Library', { latitude: 30.1, longitude: -91.2 }), place('Example Cafe', { latitude: 30.2, longitude: null })],
    }))
    const links = [...page.querySelectorAll<HTMLAnchorElement>('#when-and-where a')]
    expect(links.map((a) => a.getAttribute('aria-label'))).toEqual(['Directions to Example Library (opens in a new tab)'])
    expect(links[0].getAttribute('href')).toBe('https://www.google.com/maps/dir/?api=1&destination=30.1,-91.2')
    expect(links[0].getAttribute('target')).toBe('_blank')
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer')
    expect(page.querySelectorAll('#when-and-where li')).toHaveLength(2)
  })

  it('says one place or places, so a screen reader hears how many', () => {
    const one = drawView(answerWith({ places: [place('Example Library')] }))
    expect(one.querySelector('#when-and-where ul')!.getAttribute('aria-label')).toBe('The club\'s place')
    cleanup()
    const two = drawView(answerWith({ places: [place('Example Library'), place('Example Cafe')] }))
    expect(two.querySelector('#when-and-where ul')!.getAttribute('aria-label')).toBe('The club\'s places')
  })

  it('draws the map only where a place has a point, and gives the answer\'s places no more than the two it allows', () => {
    expect(drawView(answerWith({ places: [place('Example Library')] })).querySelector('[data-testid="club-map"]')).toBeNull()
    cleanup()
    expect(drawView(answerWith({ places: [place('Example Library', { latitude: 30.1, longitude: -91.2 })] })).querySelector('[data-testid="club-map"]')).not.toBeNull()
    expect(clubPageResponseSchema.safeParse({ ...bareAnswer(), places: [place('One'), place('Two'), place('Three')] }).success).toBe(false)
  })

  it('draws no section the answer does not name, and no nav at all when it names none the page builds yet', () => {
    const none = drawView(answerWith({ sections: ['contact'] }))
    expect(none.querySelector('section')).toBeNull()
    expect(none.querySelector('nav[aria-label="On this page"]')).toBeNull()
    expect(none.querySelector('h1')!.textContent).toBe('Example Chess Club')
    cleanup()
    const aboutOnly = drawView(answerWith({ sections: ['about', 'contact'] }))
    expect([...aboutOnly.querySelectorAll('section')].map((s) => s.id)).toEqual(['about'])
    expect([...aboutOnly.querySelectorAll('nav[aria-label="On this page"] a')].map((a) => a.textContent)).toEqual(['About'])
  })
})

describe('the links a club gave', () => {
  const about = (over: Partial<ClubPageResponse['about']>) => answerWith({ about: { text: null, ...over } })

  it('are drawn for addresses the site accepts when a club saves them, as Facebook, Website: and the site\'s name', () => {
    const page = drawView(about({
      facebook: 'HTTPS://www.facebook.com/example.chess?ref=a&b=2#top',
      website: 'http://example.org:8080/chess/',
      other: 'https://club.example.org/(chess)',
    }))
    const links = [...page.querySelectorAll<HTMLAnchorElement>('#about a')]
    expect(links.map((a) => a.textContent)).toEqual(['Facebook', 'Website: example.org', 'club.example.org'])
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      'HTTPS://www.facebook.com/example.chess?ref=a&b=2#top', 'http://example.org:8080/chess/', 'https://club.example.org/(chess)',
    ])
    for (const a of links) {
      expect(a.getAttribute('target')).toBe('_blank')
      expect(a.getAttribute('rel')).toBe('noopener noreferrer')
      expect(a.getAttribute('aria-label')).toMatch(/\(opens in a new tab\)$/)
    }
  })

  it('are left out when they are not web addresses, and the box is not drawn at all if none is', () => {
    const page = drawView(about({ facebook: 'javascript:alert(1)', website: 'mailto:club@example.org', other: 'example.org/chess', cost: 'Free.' }))
    expect(page.querySelectorAll('#about a')).toHaveLength(0)
    expect(page.textContent).not.toMatch(/Find us online/)
    expect([...page.querySelectorAll('#about h3')].map((h) => h.textContent)).toEqual(['Cost'])
  })
})

describe('the club\'s own words', () => {
  it('stay as the club wrote them: a time in its own form, a half, a line break and a day with no date', () => {
    const statement = 'Tues 7pm to 9pm, ½ price for juniors\nSecond line: bring a clock.'
    const page = drawView(answerWith({ statement: { text: statement } }))
    expect(page.querySelector('blockquote')!.textContent).toBe(statement)
    expect(page.querySelector('blockquote')!.className).toMatch(/whitespace-pre-line/)
    expect(page.textContent).not.toMatch(/\d\.5\b/)
    expect(page.textContent).not.toMatch(/7:00 PM/)
  })

  it('are kept whole when they are long, with a word too long for the screen allowed to break', () => {
    const long = `Example${'x'.repeat(120)}`
    const page = drawView(answerWith({ club: { name: long, city: `${long}City` }, about: { text: long }, statement: { text: long }, places: [place(long, { street: long, note: long })] }))
    expect(page.textContent).toContain(long)
    for (const el of [page.querySelector('h1'), page.querySelector('#about p'), page.querySelector('blockquote'), page.querySelector('#when-and-where li div')]) {
      expect(el!.className).toMatch(/break-words/)
    }
  })

  it('are drawn as text and never as markup, whatever the club typed', () => {
    const page = drawView(answerWith({ about: { text: '<img src=x onerror=alert(1)> <b>bold</b>' }, statement: { text: '<script>alert(1)</script>' } }))
    expect(page.querySelector('#about img, #about b, script')).toBeNull()
    expect(page.querySelector('#about')!.textContent).toContain('<img src=x onerror=alert(1)> <b>bold</b>')
    expect(page.querySelector('blockquote')!.textContent).toBe('<script>alert(1)</script>')
  })
})

describe('a club\'s colour is never words', () => {
  /** The page as markup, with the cover's fill taken out, so two colours can be set side by side. */
  function markupFor(color: string) {
    const view = render(<MemoryRouter><ClubPageView answer={answerWith({ club: { color } })} keeper={null} /></MemoryRouter>)
    const page = view.container.querySelector<HTMLElement>('[data-slot="club-page"]')!
    const fill = [...page.querySelectorAll<HTMLElement>('[style]')].filter((el) => el.style.backgroundColor !== '')
    expect(fill).toHaveLength(1)
    expect(fill[0].getAttribute('aria-hidden')).toBe('true')
    expect(fill[0].textContent).toBe('')
    fill[0].removeAttribute('style')
    const markup = page.outerHTML
    view.unmount()
    return markup
  }

  it('draws the same page, word for word and class for class, whatever the colour: white, black, brand gold or none', () => {
    const navy = markupFor('#1a2744')
    for (const color of ['#ffffff', '#000000', '#c8a94a', '#fffde7', '#ff0000']) expect(markupFor(color), color).toBe(navy)
  })

  it('sets no word, icon or line in the colour: the only colour a style gives is the cover\'s own fill', () => {
    const page = drawView(answerWith({ club: { color: '#c8a94a' } }), { kind: 'rep', edit: '/my/club/example-chess-club' })
    for (const el of page.querySelectorAll<HTMLElement>('[style]')) {
      expect(el.getAttribute('style'), el.outerHTML.slice(0, 80)).not.toMatch(/(^|;)\s*(color|fill|stroke|border-color|outline-color|text-decoration-color)\s*:/)
    }
    // An icon's own fill is none; nothing paints words or icons in a colour the club chose.
    expect([...page.querySelectorAll('[color]')]).toHaveLength(0)
    expect([...page.querySelectorAll('[fill], [stroke]')].filter((el) => !['none', 'currentColor'].includes(el.getAttribute('fill') ?? 'none') || !['currentColor', null].includes(el.getAttribute('stroke')))).toHaveLength(0)
  })

  it('has no gold, no white words and no colour of its own in the files that draw it, so ink is the look\'s', () => {
    const files = [
      'src/areas/clubs/components/ClubPage.tsx', 'src/areas/clubs/components/ClubCover.tsx', 'src/areas/clubs/components/AuthorLine.tsx',
      'src/areas/clubs/components/SectionNav.tsx', 'src/areas/clubs/components/ClubAbout.tsx', 'src/areas/clubs/components/WhenAndWhere.tsx',
      'src/areas/clubs/components/PagePreview.tsx', 'src/areas/clubs/clubPage.ts', 'src/pages/ClubListingPage.tsx',
    ]
    for (const file of files) {
      const code = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
      expect(code, file).not.toMatch(/gold|text-white|text-black|brand-navy|lca-navy|lca-gold/i)
      expect(code, file).not.toMatch(/#[0-9a-f]{3,8}\b/i)
      expect(code, file).not.toMatch(/\btext-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc|neutral|stone)-\d/)
    }
  })
})

describe('every control and section keeps the room the sticky section nav needs', () => {
  const FULL_PAGE = () => drawView(fullAnswer(), { kind: 'rep', edit: '/my/club/example-chess-club' })

  it('gives each control a target of 44 pixels or more, with the look\'s focus ring, which is more than the 24 pixels the standard asks', () => {
    const page = FULL_PAGE()
    const controls = [...page.querySelectorAll<HTMLElement>('a, button')]
    // The crumb, the two cover buttons, Edit, the nav's two, About's online links (two), and a Directions link.
    expect(controls.length).toBeGreaterThanOrEqual(9)
    for (const control of controls) {
      const name = control.getAttribute('aria-label') ?? control.textContent
      expect(control.className, name!).toMatch(/\bmin-h-11\b/)
      expect(control.className, name!).toMatch(/focus-visible:ring-3/)
      expect(control.className, name!).toMatch(/focus-visible:ring-focus/)
      // No control takes its outline away without a ring of its own.
      expect(control.className, name!).toMatch(/outline-none/)
    }
  })

  it('gives each button an edge or a ground that stands apart from the page: Contact the club is solid ink, Share has the field\'s edge', () => {
    const page = FULL_PAGE()
    expect(within(page).getByRole('link', { name: 'Contact the club' }).className).toMatch(/bg-ink\b.*text-ground|text-ground.*bg-ink\b/)
    expect(within(page).getByRole('button', { name: 'Share' }).className).toMatch(/\bborder\b.*\bborder-field\b/)
  })

  it('keeps every control and section clear of the sticky bars when the keyboard or a link brings it into view', () => {
    const page = FULL_PAGE()
    expect(CONTROLS_CLEAR_OF_BARS).toContain('scroll-mt-')
    const withRoom = [...page.querySelectorAll<HTMLElement>('div')].filter((el) => el.className.includes(CONTROLS_CLEAR_OF_BARS))
    // The wrapper over the cover and author line, and the one over the sections.
    expect(withRoom).toHaveLength(2)
    const clear = (el: Element) => [...withRoom].some((wrapper) => wrapper.contains(el))
    for (const el of page.querySelectorAll<HTMLElement>('a, button, h1')) {
      if (el.closest('nav[aria-label="On this page"]')) continue
      expect(clear(el), el.outerHTML.slice(0, 80)).toBe(true)
    }
    for (const section of page.querySelectorAll<HTMLElement>('section')) expect(section.className, section.id).toContain('scroll-mt-')
    expect(CLEAR_OF_BARS).toContain('scroll-mt-')
  })

  it('sticks the nav under the site\'s header, and leaves it as high as the room the page keeps for it', () => {
    const page = FULL_PAGE()
    const nav = page.querySelector<HTMLElement>('nav[aria-label="On this page"]')!
    expect(nav.className).toMatch(/\bsticky\b/)
    expect(nav.className).toContain('top-[var(--header-h,4.0625rem)]')
    // The nav's own height: its links' minimum, the list's padding and the border under it, in pixels.
    const link = nav.querySelector('a')!.className
    const list = nav.querySelector('ul')!.className
    expect(link).toMatch(/\bmin-h-11\b/)
    expect(list).toMatch(/\bpy-1\b/)
    expect(nav.className).toMatch(/\bborder-b\b/)
    const navHeight = 44 + 4 + 4 + 1
    // The first term of the room the page keeps is 3.5rem, which is 56 pixels at the browser's 16.
    const room = /scroll-mt-\[calc\((\d+(?:\.\d+)?)rem/.exec(CLEAR_OF_BARS)
    expect(room).not.toBeNull()
    expect(Number(room![1]) * 16).toBeGreaterThanOrEqual(navHeight)
    // The site's header is counted where it writes no height of its own, and not twice where it does.
    expect(CLEAR_OF_BARS).toContain('var(--header-h,4.0625rem)')
    expect(CLEAR_OF_BARS).toContain('var(--header-h,0px)')
  })

  it('sticks the nav under the new chrome\'s bar at the height the bar writes, and at the top of the window where none is written', () => {
    flags.newNav = true
    const nav = FULL_PAGE().querySelector<HTMLElement>('nav[aria-label="On this page"]')!
    expect(nav.className).toMatch(/\bsticky\b/)
    expect(nav.className).toContain('top-[var(--header-h,0px)]')
    expect(nav.className).not.toContain('4.0625rem')
  })

  it('lets the nav scroll with the page in the reflow fallback, under 480 pixels tall or under 300 wide, with the chrome on or off', () => {
    // A phone on its side, 667 by 375: only the reflow query answers yes.
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === REFLOW_QUERY,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    for (const newNav of [false, true]) {
      flags.newNav = newNav
      const nav = FULL_PAGE().querySelector<HTMLElement>('nav[aria-label="On this page"]')!
      expect(nav.className).not.toMatch(/\bsticky\b/)
      expect(nav.className).not.toMatch(/\btop-/)
      expect(nav.className).toMatch(/\bstatic\b/)
      cleanup()
    }
  })

  it('draws the section nav once, and its links go only to sections the page draws', () => {
    const page = FULL_PAGE()
    expect(page.querySelectorAll('nav[aria-label="On this page"]')).toHaveLength(1)
    for (const a of page.querySelectorAll<HTMLAnchorElement>('nav[aria-label="On this page"] a')) {
      const target = page.querySelector(a.getAttribute('href')!)
      expect(target, a.textContent!).not.toBeNull()
      expect(target!.tagName).toBe('SECTION')
    }
  })
})

describe('today\'s pages do not know the new page', () => {
  const NEW = /components\/ClubPage'|components\/ClubCover'|components\/AuthorLine'|components\/SectionNav'|components\/ClubAbout'|components\/WhenAndWhere'|components\/PagePreview'|ClubListingPage|areas\/clubs\/clubPage'|getClubPage/

  it('leaves today\'s club page, the Clubs page and the two pages of the club\'s keepers drawing nothing of it', () => {
    for (const file of ['src/pages/ClubDetailPage.tsx', 'src/pages/ClubsPage.tsx', 'src/pages/YourClubPage.tsx', 'src/pages/MyRegionClubPage.tsx']) {
      expect(read(file), file).not.toMatch(NEW)
    }
  })

  it('reaches the new page from the route table and the editor\'s column alone, each behind clubPagesOn()', () => {
    const app = read('src/App.tsx')
    expect(app).toMatch(/clubPagesOn\(\)\s*\n?\s*\? <Route path="\/clubs\/:id" element=\{<ClubListingPage \/>\} \/>\s*\n?\s*: <Route path="\/clubs\/:id" element=\{<ClubDetailPage \/>\} \/>/)
    expect(app).toContain('{FEATURES.newClubs && <Route path="/clubs/suggest"')
    const editor = read('src/areas/clubs/components/ClubEditor.tsx')
    expect(editor).toMatch(/\{clubPagesOn\(\) && \(\s*<PagePreview/)
    // Nothing else in the app names the new page's files, so every other route and page draws as it did.
    for (const file of ['src/lib/http.ts', 'src/lib/nav.ts', 'src/areas/clubs/switches.ts']) expect(read(file), file).not.toMatch(/ClubListingPage|PagePreview/)
  })
})
