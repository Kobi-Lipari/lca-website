// @vitest-environment jsdom
//
// The pinned post on /news with newLook off (WS01 step 25): the page is as it
// was. The pin is the only mark, an icon named "Pinned" for screen readers,
// with no visible word; its gold class is now text-gold-ink, which paints
// the same brand gold with newLook off (test/unit/semantic-map.test.ts holds
// that). With newLook on see news-pinned.test.tsx.
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FEATURES } from '@/lib/features'

const api = vi.hoisted(() => ({ getPosts: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
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

describe('the pinned post on /news, newLook off', () => {
  it('is the starting state of the switch', () => {
    expect(FEATURES.newLook).toBe(false)
  })

  it('marks the pinned post with the pin icon alone, named "Pinned" for screen readers, and no visible word', async () => {
    render(<MemoryRouter><NewsPage /></MemoryRouter>)
    await screen.findByText('Fixture pinned notice')
    const pinned = card('Fixture pinned notice')
    expect(within(pinned).queryByText('Pinned')).toBeNull()
    const icon = within(pinned).getByLabelText('Pinned')
    expect(icon.tagName.toLowerCase()).toBe('svg')
    expect(icon.getAttribute('class')).toContain('size-3 text-gold-ink')
    expect(icon.hasAttribute('aria-hidden')).toBe(false)
  })

  it('keeps the date line as it was: the icon, then the date, in one paragraph', async () => {
    render(<MemoryRouter><NewsPage /></MemoryRouter>)
    await screen.findByText('Fixture pinned notice')
    const line = within(card('Fixture pinned notice')).getByLabelText('Pinned').parentElement!
    expect(line.tagName).toBe('P')
    expect(line.className).toBe('mb-1 flex items-center gap-2 text-[11px] font-medium text-ink/80')
    expect([...line.childNodes].map((c) => c.nodeName.toLowerCase())).toEqual(['svg', '#text'])
    expect(line.textContent).toBe(formatPostDate(POSTS[0].published_at))
    // The unpinned post's line holds the date alone.
    const plainLine = card('Fixture club recap').querySelector('p')!
    expect(plainLine.textContent).toBe(formatPostDate(POSTS[1].published_at))
    expect(plainLine.querySelector('svg')).toBeNull()
  })
})
