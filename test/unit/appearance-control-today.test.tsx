// @vitest-environment jsdom
//
// The Appearance control as visitors see it with every switch off but
// newLook, in today's footer, against a copy of itself:
// test/unit/fixtures/appearance-control-today.tsx is
// src/components/AppearanceControl.tsx as it stood at commit 8d7df98, before
// the control took a label id and a ground of its own for the Menu sheet.
// Both are drawn and their markup compared byte for byte:
//
// - with no props, as the footer draws it, and with a class of a caller's
//   own, for each of the three choices pressed;
// - with the two new props given their defaults outright, labelId
//   "appearance-label" and on="navy", which draw the same;
// - in the footer itself, newLook on, where the control is the copy's,
//   labelled by appearance-label, the one element on the page with that id.
//
// The control's light form, drawn in the Menu sheet, is
// test/unit/appearance-control.test.tsx's to hold.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return { ...real, FEATURES: { ...real.FEATURES, newLook: true } }
})

const { AppearanceControl } = await import('@/components/AppearanceControl')
const { AppearanceControlToday } = await import('./fixtures/appearance-control-today')
const { Footer } = await import('@/components/layout/Footer')

/** The markup a control draws, on a page of its own. */
function markup(control: ReactElement): string {
  const { container } = render(control)
  const html = container.innerHTML
  cleanup()
  return html
}

/** Presses one of the three options, so the next control drawn shows it pressed: the choice is the page's, kept in one module. */
function choose(name: 'System' | 'Light' | 'Dark') {
  render(<AppearanceControl />)
  fireEvent.click(within(screen.getByRole('group', { name: 'Appearance' })).getByRole('button', { name }))
  cleanup()
}

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove('dark')
  window.localStorage.clear()
})

describe('the Appearance control with its defaults, against today\'s', () => {
  it.each(['System', 'Light', 'Dark'] as const)('draws today\'s markup byte for byte with %s pressed, with no props and with a class of its own', (name) => {
    choose(name)
    const today = markup(<AppearanceControlToday />)
    expect(today).toContain(`aria-pressed="true" class="h-8 rounded-md border px-3 text-sm transition-colors border-white/60 bg-white/15 font-semibold text-white">${name}<`)
    expect(markup(<AppearanceControl />)).toBe(today)
    expect(markup(<AppearanceControl className="mt-3 justify-end" />)).toBe(markup(<AppearanceControlToday className="mt-3 justify-end" />))
  })

  it('draws the same with its two new props given their defaults outright', () => {
    choose('Light')
    const today = markup(<AppearanceControlToday />)
    expect(markup(<AppearanceControl labelId="appearance-label" on="navy" />)).toBe(today)
    expect(markup(<AppearanceControl on="navy" />)).toBe(today)
    expect(markup(<AppearanceControl labelId="appearance-label" />)).toBe(today)
  })

  it('differs from today\'s only once it is given a ground or a label id of its own', () => {
    choose('System')
    const today = markup(<AppearanceControlToday />)
    expect(markup(<AppearanceControl on="light" />)).not.toBe(today)
    expect(markup(<AppearanceControl labelId="fx-another-label" />)).not.toBe(today)
    // A label id of its own changes the id and the group's label, and nothing else.
    expect(markup(<AppearanceControl labelId="fx-another-label" />)).toBe(today.replaceAll('appearance-label', 'fx-another-label'))
  })
})

describe('the footer\'s control under newLook', () => {
  it.each(['System', 'Light', 'Dark'] as const)('is today\'s, byte for byte, with %s pressed, labelled by the one appearance-label on the page', (name) => {
    choose(name)
    const today = markup(<AppearanceControlToday />)
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    )
    const footer = screen.getByRole('contentinfo')
    const group = within(footer).getByRole('group', { name: 'Appearance' })
    expect(group.getAttribute('aria-labelledby')).toBe('appearance-label')
    expect(document.querySelectorAll('[id="appearance-label"]')).toHaveLength(1)
    // The control's own box: the group's parent, which holds the label and the group.
    expect(group.parentElement!.outerHTML).toBe(today)
  })
})
