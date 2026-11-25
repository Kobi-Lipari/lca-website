// @vitest-environment jsdom
//
// The new club page for a club with only the five basics (WS09 step 21), as
// Club-Final-Bare draws it, since most clubs start there: the cover with the
// club's initials, the h1, the line the site writes under it and how the
// club meets under that, the section nav (no line of who keeps it, by K's
// decision 12), About and When
// and where, and since WS09 step 22 the foot line with Copy link, and
// nothing else. No bracket, no "not listed", no empty box and no Suggest an
// update; a block and its link in the nav appear the first time the answer
// names them, and the nav names only what the page draws, whatever the
// answer names. The h1 sits on the page's ground,
// never on the club's colour, which fills the cover and is never words.
// The page is drawn through the real client, with fetch stubbed, and the
// switches set through the mocked FEATURES by each case. Every name,
// address and club here is made up.
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import type { ClubPageResponse } from '@domain/contracts'
import { ABOUT_ONE, CLUB_SLUG, STATEMENT, TOLD, bareAnswer, visitor } from './helpers/clubPageAnswer'

const flags = vi.hoisted(() => ({ newClubs: true, newLook: true, clubKeepers: false, clubEmailHidden: true }))
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
vi.mock('@/areas/clubs/components/LCAMap', () => ({ LCAMap: () => null }))

const { ClubListingPage } = await import('@/pages/ClubListingPage')

let answer: ClubPageResponse = bareAnswer()
const asked: string[] = []
beforeEach(() => {
  Object.assign(flags, { newClubs: true, newLook: true, clubKeepers: false, clubEmailHidden: true })
  answer = bareAnswer()
  asked.length = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    asked.push(url)
    return url === `/api/clubs/${CLUB_SLUG}/page`
      ? new Response(JSON.stringify(answer), { status: 200 })
      : new Response(JSON.stringify({ error: 'Club not found' }), { status: 404 })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function draw(auth: AuthContextValue = visitor()) {
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[`/clubs/${CLUB_SLUG}`]}>
        <Routes><Route path="/clubs/:id" element={<ClubListingPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  await screen.findByRole('heading', { level: 1, name: 'Example Chess Club' }, { timeout: 5000 })
  await act(async () => {})
  return document.querySelector('[data-slot="club-page"]') as HTMLElement
}

/** The page's words, as one string. */
const wordsOf = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()

describe('a club with only the five basics', () => {
  it('cover with initials, About, When and where, Contact with its form (WS09 step 26), the foot line, and nothing else', async () => {
    const page = await draw()
    // The cover: the initials tile, the h1, the site's line, and the two buttons.
    expect(page.querySelector('[aria-hidden="true"].size-24')?.textContent).toBe('EC')
    expect(screen.getByText('Chess club in Example City, Louisiana · Bayou Region')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Contact the club' }).getAttribute('href')).toBe('#contact')
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy()
    // Who keeps the club is not shown (K's decision 12): no words of it for a visitor.
    expect(wordsOf(page)).not.toMatch(/Kept by/)
    // The nav lists the three sections, and the page draws those three and no other.
    const nav = screen.getByRole('navigation', { name: 'On this page' })
    expect(within(nav).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')])).toEqual([['About', '#about'], ['When and where', '#when-and-where'], ['Contact', '#contact']])
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['About Example Chess Club', 'When and where Example Chess Club meets', 'Contact'])
    expect(screen.queryAllByRole('heading', { level: 3 })).toEqual([])
    expect([...page.querySelectorAll('section')].map((s) => s.id)).toEqual(['about', 'when-and-where', 'contact'])
    // About is the one sentence; When and where the statement, the told line and the place.
    expect(within(document.getElementById('about')!).getByText(ABOUT_ONE)).toBeTruthy()
    const where = document.getElementById('when-and-where')!
    expect(where.querySelector('blockquote')?.textContent).toBe(STATEMENT)
    expect(within(where).getByText(TOLD)).toBeTruthy()
    expect(within(where).getByText('Example Library')).toBeTruthy()
    // No Follow button and no other control: the crumb, the two cover buttons, the nav's three, Directions, Contact's Help, Close help and Send message, and the foot line's Copy link; no Edit for a visitor.
    expect(screen.queryByText(/Follow/)).toBeNull()
    // Moved at WS09 step 28: Suggest an update stands under the told line and beside Contact's heading, and nowhere else.
    expect([...page.querySelectorAll('a, button')].map((c) => c.getAttribute('aria-label') ?? c.textContent?.trim())).toEqual([
      'Clubs', 'Contact the club', 'Share', 'About', 'When and where', 'Contact', 'Suggest an update', 'Directions to Example Library (opens in a new tab)', 'Suggest an update', 'Help', 'Close help', 'Send message', 'Copy link',
    ])
    expect(screen.getByRole('link', { name: 'Directions to Example Library (opens in a new tab)' }).textContent).toBe('Directions')
  })

  it('no bracket, no \'not listed\', no empty card, no Suggest an update on a block', async () => {
    const page = await draw()
    const words = wordsOf(page)
    expect(words).not.toMatch(/[[\]{}]/)
    expect(words).not.toMatch(/not listed|not set|none yet|no description|coming soon/i)
    // Moved at WS09 step 28: Suggest an update is in the page twice, under the told line and beside Contact, never on a block.
    expect(words).not.toMatch(/Ask to be its named rep|Is this your club/i)
    expect(words.match(/Suggest an update/g)).toHaveLength(2)
    expect(words).not.toMatch(/null|undefined/)
    // No box of About's: Cost, Who is welcome and Find us online have nothing in them, so none is drawn.
    expect(screen.queryByText('Cost')).toBeNull()
    expect(screen.queryByText('Who is welcome')).toBeNull()
    expect(screen.queryByText('Find us online')).toBeNull()
    // Every element that draws a box has words in it.
    for (const box of page.querySelectorAll('.rounded-xl')) expect(wordsOf(box), box.outerHTML).not.toBe('')
    // A place with no street and no note has no empty line for them.
    for (const p of document.getElementById('when-and-where')!.querySelectorAll('li p')) expect(wordsOf(p)).not.toBe('')
  })

  it('the statement sits under the h1', async () => {
    await draw()
    const h1 = screen.getByRole('heading', { level: 1 })
    const line = screen.getByText('Chess club in Example City, Louisiana · Bayou Region')
    const meets = [...document.querySelectorAll('p')].find((p) => p.textContent === STATEMENT && !p.closest('section'))!
    expect(meets).toBeTruthy()
    expect(h1.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(line.compareDocumentPosition(meets) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // All three share the cover's block of words, before the section nav.
    expect(h1.parentElement).toBe(line.parentElement)
    expect(meets.parentElement).toBe(h1.parentElement)
    expect(meets.compareDocumentPosition(screen.getByRole('navigation', { name: 'On this page' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('draws the h1 on the page\'s ground, never on the club\'s colour, which fills the cover with no words on it', async () => {
    answer = { ...bareAnswer(), club: { ...bareAnswer().club, color: '#2e6b4f' } }
    const page = await draw()
    const filled = [...page.querySelectorAll<HTMLElement>('[style]')].filter((el) => el.style.backgroundColor !== '')
    expect(filled).toHaveLength(1)
    expect(filled[0].style.backgroundColor).toBe('rgb(46, 107, 79)')
    expect(filled[0].getAttribute('aria-hidden')).toBe('true')
    expect(wordsOf(filled[0])).toBe('')
    expect(filled[0].contains(screen.getByRole('heading', { level: 1 }))).toBe(false)
    // No element of the page takes the club's colour as its words.
    for (const el of page.querySelectorAll<HTMLElement>('[style]')) expect(el.style.color).toBe('')
  })

  it('ends the site\'s line at Louisiana when the club has no region, with no "null" and no dot left over', async () => {
    answer = { ...bareAnswer(), club: { ...bareAnswer().club, region: null } }
    const page = await draw()
    expect(screen.getByText('Chess club in Example City, Louisiana')).toBeTruthy()
    expect(wordsOf(page)).not.toMatch(/null|Louisiana ·\s*(?:$|[A-Z][a-z]+ (?:Chess|club))/)
  })

  it('draws a block, and its link in the nav, the first time it has content', async () => {
    // About's words emptied: the answer names no About, and the page draws neither its block nor its link.
    answer = { ...bareAnswer(), sections: ['when_and_where', 'contact'], about: { ...bareAnswer().about, text: null } }
    await draw()
    const nav = screen.getByRole('navigation', { name: 'On this page' })
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['When and where', 'Contact'])
    expect(document.getElementById('about')).toBeNull()
    cleanup()

    // A cost added: About's box for it appears, and nothing else does.
    answer = { ...bareAnswer(), about: { ...bareAnswer().about, cost: 'Free.' } }
    await draw()
    expect(screen.getByText('Cost')).toBeTruthy()
    expect(screen.getByText('Free.')).toBeTruthy()
    expect(screen.queryByText('Who is welcome')).toBeNull()
    expect(screen.queryByText('Find us online')).toBeNull()
  })

  it('lists in the nav only what the page draws, whatever the answer names: no Events or News with no row and no Photos, and Contact, which every club has', async () => {
    answer = { ...bareAnswer(), sections: ['about', 'when_and_where', 'events', 'news', 'photos', 'contact'] }
    await draw()
    const nav = screen.getByRole('navigation', { name: 'On this page' })
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['About', 'When and where', 'Contact'])
    for (const id of ['events', 'news', 'photos']) expect(document.getElementById(id)).toBeNull()
    expect(document.getElementById('contact')).not.toBeNull()
    expect(screen.queryByRole('heading', { name: /Events|News|Photos/ })).toBeNull()
    // The page asked once, for the one answer.
    expect(asked).toEqual([`/api/clubs/${CLUB_SLUG}/page`])
  })
})
