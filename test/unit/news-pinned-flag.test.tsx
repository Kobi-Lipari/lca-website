// @vitest-environment jsdom
//
// The News page with newLook off and on, side by side (WS01 step 25). The
// visible word "Pinned" beside the pin is the only thing newLook changes on
// the page: render it both ways from the same posts, put the old icon back
// where the new look draws the word, and the two pages are the same to the
// last attribute. So with newLook off the page is as it was, and with it on
// nothing else moves. news-pinned.test.tsx and news-pinned-off.test.tsx hold
// each side on its own.
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
const api = vi.hoisted(() => ({ getPosts: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
// The Facebook feed fetches from the server; the page around it is what is compared here.
vi.mock('@/components/FacebookFeed', () => ({ FacebookFeed: () => null }))

const { NewsPage } = await import('@/pages/NewsPage')

const POSTS = [
  { id: 'fx-post-pinned', slug: 'fixture-pinned', title: 'Fixture pinned notice', summary: 'Club night moves to Thursday, 7:00 PM.', image_url: null, link_url: null, link_label: null, pinned: 1, published_at: '2026-10-01 18:00:00' },
  { id: 'fx-post-plain', slug: 'fixture-plain', title: 'Fixture club recap', summary: '', image_url: null, link_url: null, link_label: null, pinned: 0, published_at: '2026-09-24 18:00:00' },
  { id: 'fx-post-second', slug: 'fixture-second-pinned', title: 'Fixture second notice', summary: 'Bring a board.', image_url: null, link_url: 'https://example.com/fixture', link_label: 'Read more', pinned: 1, published_at: '2026-09-20 18:00:00' },
]

/** The News page as drawn with newLook on or off, copied out of the document. */
async function page(newLook: boolean): Promise<HTMLElement> {
  flags.newLook = newLook
  const { container } = render(<MemoryRouter><NewsPage /></MemoryRouter>)
  await screen.findByText('Fixture pinned notice')
  const copy = container.cloneNode(true) as HTMLElement
  cleanup()
  return copy
}

beforeEach(() => {
  api.getPosts.mockReset()
  api.getPosts.mockResolvedValue(POSTS)
})
afterEach(() => {
  cleanup()
  flags.newLook = false
})

describe('the News page, newLook off and on', () => {
  it('differs only where a pinned post is marked: put the old icon back in place of the word and the pages are the same', async () => {
    const off = await page(false)
    const on = await page(true)
    expect(on.innerHTML).not.toBe(off.innerHTML)
    const icons = [...off.querySelectorAll('svg[aria-label="Pinned"]')]
    const words = [...on.querySelectorAll('span')].filter((s) => s.textContent === 'Pinned')
    // One mark per pinned post, on each side.
    expect(icons).toHaveLength(2)
    expect(words).toHaveLength(2)
    words.forEach((word, i) => word.replaceWith(icons[i].cloneNode(true)))
    expect(on.innerHTML).toBe(off.innerHTML)
  })

  it('with newLook off no "Pinned" is in the words of the page, and with it on one per pinned post', async () => {
    const off = await page(false)
    expect(off.textContent).not.toContain('Pinned')
    const on = await page(true)
    expect(on.textContent?.match(/Pinned/g)).toHaveLength(2)
    // The unpinned post's card says nothing about pinning either way.
    for (const side of [off, on]) {
      const plain = [...side.querySelectorAll('a')].find((a) => a.textContent?.includes('Fixture club recap'))!
      expect(plain.textContent).not.toContain('Pinned')
      expect(plain.querySelector('svg')).toBeNull()
    }
  })

  it('the gold text on the page is the gold-ink token in both, and brand gold as text appears in neither', async () => {
    for (const side of [await page(false), await page(true)]) {
      const classes = [...side.querySelectorAll('[class]')].flatMap((el) => (el.getAttribute('class') ?? '').split(/\s+/))
      // A text colour class with gold in it, in any variant: only text-gold-ink, and at rest.
      const goldText = classes.filter((c) => /^text-.*gold/.test(c.split(':').pop() ?? ''))
      expect(goldText.length).toBeGreaterThanOrEqual(3)
      expect([...new Set(goldText)]).toEqual(['text-gold-ink'])
    }
  })
})
