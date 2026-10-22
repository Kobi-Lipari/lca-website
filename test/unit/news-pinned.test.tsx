// @vitest-environment jsdom
//
// The pinned post on /news with newLook on (WS01 step 25). A pinned post
// used to be marked only by a gold pin icon, its name given to screen
// readers alone. Under the new look the pin carries the visible word
// "Pinned" beside it, in the gold-ink token, and the icon is hidden from
// screen readers so the word is read once. An unpinned post shows neither.
// With newLook off see news-pinned-off.test.tsx.
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return { ...real, FEATURES: { ...real.FEATURES, newLook: true } }
})
const api = vi.hoisted(() => ({ getPosts: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
// The Facebook feed fetches from the server; the page around it is what is tested here.
vi.mock('@/components/FacebookFeed', () => ({ FacebookFeed: () => null }))

const { NewsPage } = await import('@/pages/NewsPage')
const { formatPostDate } = await import('@/lib/posts')

const POSTS = [
  { id: 'fx-post-pinned', slug: 'fixture-pinned', title: 'Fixture pinned notice', summary: 'Club night moves to Thursday, 7:00 PM.', image_url: null, link_url: null, link_label: null, pinned: 1, published_at: '2026-10-01 18:00:00' },
  { id: 'fx-post-plain', slug: 'fixture-plain', title: 'Fixture club recap', summary: '', image_url: null, link_url: null, link_label: null, pinned: 0, published_at: '2026-09-24 18:00:00' },
]

const card = (title: string) => screen.getByText(title).closest('a') as HTMLElement

beforeEach(() => {
  api.getPosts.mockReset()
  api.getPosts.mockResolvedValue(POSTS)
})
afterEach(cleanup)

describe('the pinned post on /news, newLook on', () => {
  it('says "Pinned" in words beside the pin, once, in the gold-ink token', async () => {
    render(<MemoryRouter><NewsPage /></MemoryRouter>)
    await screen.findByText('Fixture pinned notice')
    const pinned = card('Fixture pinned notice')
    const word = within(pinned).getByText('Pinned')
    expect(word.tagName).toBe('SPAN')
    expect(word.className).toContain('text-gold-ink')
    // The word sits on the date line, before the date.
    expect(word.parentElement?.textContent).toBe(`Pinned${formatPostDate(POSTS[0].published_at)}`)
    // Exactly one "Pinned" on the page, and no second name for screen readers to read.
    expect(screen.getAllByText('Pinned')).toHaveLength(1)
    expect(screen.queryByLabelText('Pinned')).toBeNull()
  })

  it('hides the pin icon from screen readers, since the word beside it says the same', async () => {
    render(<MemoryRouter><NewsPage /></MemoryRouter>)
    await screen.findByText('Fixture pinned notice')
    const icon = within(card('Fixture pinned notice')).getByText('Pinned').querySelector('svg')!
    expect(icon).not.toBeNull()
    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(icon.hasAttribute('aria-label')).toBe(false)
    // The icon takes the word's colour (currentColor), so it carries no gold class of its own.
    expect(icon.getAttribute('class')).not.toContain('text-gold-ink')
  })

  it('an unpinned post shows no pin and no word', async () => {
    render(<MemoryRouter><NewsPage /></MemoryRouter>)
    await screen.findByText('Fixture club recap')
    const plain = card('Fixture club recap')
    expect(within(plain).queryByText('Pinned')).toBeNull()
    expect(plain.querySelector('svg')).toBeNull()
  })
})
