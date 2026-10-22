// @vitest-environment jsdom
//
// StatusDot with newLook on (WS01 step 26). The registration dot of the
// tournament list used to say its state only in a title, which few screen
// readers read and nobody sees on a touch screen. Under the new look its
// words show beside it (its label, or its state's words), the dot takes the
// tokens and is hidden from screen readers, so the words are read once, and
// there is no title to say them twice. StatusBadge itself does not change
// with the switch: the same tags and pills in either state. With newLook off
// see status-badge.test.tsx.
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return { ...real, FEATURES: { ...real.FEATURES, newLook: true } }
})

const { StatusBadge, StatusDot } = await import('@/components/StatusBadge')
const { FEATURES } = await import('@/lib/features')

afterEach(cleanup)

describe('StatusDot, newLook on', () => {
  it('runs with the switch on', () => {
    expect(FEATURES.newLook).toBe(true)
  })

  it.each([
    ['open', 'bg-ok-500', 'Registration open'],
    ['draft', 'bg-lca-gold', 'Opening soon'],
    ['closed', 'bg-border', 'Registration closed'],
    [null, 'bg-border', 'Coming soon'],
  ])('%s shows its words beside the dot', (regStatus, colour, words) => {
    const { container } = render(<StatusDot regStatus={regStatus} />)
    const wrap = container.firstElementChild as HTMLElement
    expect(wrap.getAttribute('data-slot')).toBe('status-dot')
    expect(wrap.textContent).toBe(words)
    // The words are a text node of their own, visible, not a title.
    expect([...wrap.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent === words)).toBe(true)
    expect(wrap.hasAttribute('title')).toBe(false)
    expect(container.querySelector('[title]')).toBeNull()
    // The dot is decoration beside them, in a token colour.
    const dot = wrap.firstElementChild as HTMLElement
    expect(dot.getAttribute('aria-hidden')).toBe('true')
    expect(dot.className).toBe(`size-1.5 flex-shrink-0 rounded-full ${colour}`)
    expect(dot.textContent).toBe('')
  })

  it('shows its label in place of its state\'s words', () => {
    render(<StatusDot regStatus="open" label="Registration open until Fri, Oct 23" />)
    expect(screen.getByText('Registration open until Fri, Oct 23').getAttribute('data-slot')).toBe('status-dot')
    expect(screen.queryByText('Registration open')).toBeNull()
  })

  it('takes a caller\'s className on the words and the dot together', () => {
    const { container } = render(<StatusDot regStatus="open" className="ml-1" />)
    expect((container.firstElementChild as HTMLElement).className).toContain('ml-1')
  })

  it('draws its words in the muted ink, which follows the look, never in a status\'s words colour, which is built for its own tint', () => {
    const { container } = render(<StatusDot regStatus="draft" />)
    const wrap = container.firstElementChild as HTMLElement
    expect(wrap.className).toContain('text-muted-foreground')
    expect(wrap.className).not.toMatch(/text-status-/)
  })
})

describe('StatusBadge does not change with the switch', () => {
  it('draws the same tag and the same pill as with newLook off', () => {
    const { container } = render(
      <>
        <StatusBadge status="open" on="light" />
        <StatusBadge tone="emerald" on="light">Registration open</StatusBadge>
      </>,
    )
    const [tag, pill] = [...container.children] as HTMLElement[]
    expect(tag.getAttribute('data-status')).toBe('open')
    expect(tag.className).toBe('inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-xs leading-none font-medium whitespace-nowrap bg-status-open-tint text-status-open')
    expect(pill.outerHTML).toBe('<span class="rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-800">Registration open</span>')
  })
})
