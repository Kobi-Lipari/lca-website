// @vitest-environment jsdom
//
// The Board page's forms for an admin, inside HeritageLayout with the
// themeHeritage switch on (WS01 step 31, acceptance criterion 12): the seat
// cards an admin edits (the seat's title, the holder's name where no member
// account is linked, and the photo) and the Add a board seat card.
//
// - Each seat card an admin edits, and the Add a board seat card once it is
//   open, sits in a base scope of its own (data-theme="", no box of its own),
//   the closest data-theme above its fields and Buttons, and each of those
//   scopes sits straight inside the layout's heritage scope: one level of
//   nesting, the one the looks allow. Neither kind of card takes the
//   heritage card hook.
// - Inside its base scope each card is the card the switch-off page draws,
//   to the attribute, so the reset adds the wrapper and nothing else.
// - A visitor's seat cards are not forms: they stay in the heritage look,
//   with the card hook, and the page holds no base scope.
// - Nothing warns in the console, and with the switch off the same page
//   holds no data-theme and no hook at all, the add card open.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const flags = vi.hoisted(() => ({ themeHeritage: true }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get themeHeritage() {
        return flags.themeHeritage
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/api')>()
  const { heritageApi } = await import('./helpers/heritageAnswers')
  return { ...real, ...heritageApi, adminCreateBoardMember: vi.fn(), adminUpdateBoardMember: vi.fn(), adminDeleteBoardMember: vi.fn() }
})
vi.mock('@/styles/themes/heritage.css', () => ({}))
vi.mock('@/styles/themes/live.css', () => ({}))

const { HeritageLayout } = await import('@/layouts/HeritageLayout')
const { BoardPage } = await import('@/pages/BoardPage')
const { AuthContext } = await import('@/contexts/auth-context')
const { visitor } = await import('./helpers/heritagePages')
const { SEATS } = await import('./helpers/heritageAnswers')

let warn: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  flags.themeHeritage = true
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  warn.mockRestore()
})

/** What ThemeScope reported in the console. */
const scopeWarnings = () => warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.startsWith('ThemeScope'))

const ROUTE = '/governance/board'

/** The Board page for a visitor or an admin, inside the layout's route or on its own, once its seats are drawn. */
async function board(role: 'member' | 'lca_admin', inLayout: boolean) {
  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    view = render(
      <AuthContext.Provider value={visitor(role)}>
        <MemoryRouter initialEntries={[ROUTE]}>
          <Routes>
            {inLayout ? (
              <Route element={<HeritageLayout />}>
                <Route path={ROUTE} element={<BoardPage />} />
              </Route>
            ) : (
              <Route path={ROUTE} element={<BoardPage />} />
            )}
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  })
  await screen.findByText('Player Three')
  await act(async () => new Promise((r) => setTimeout(r, 30)))
  return view!.container
}

/** Opens the Add a board seat card; gives back the card. */
async function openAdd(): Promise<HTMLElement> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Add a board seat/ }))
  })
  return screen.getByText('Add a board seat', { selector: 'p' }).parentElement!
}

/** Each seat card an admin edits, found by the field that holds the seat's title. */
const seatCards = () => SEATS.map((s) => screen.getByDisplayValue(s.role).closest<HTMLElement>('div.rounded-xl')!)

describe('the Board page for an admin, in the heritage layout', () => {
  it('each seat card and the Add a board seat card sit in a base scope of their own, straight inside the heritage scope, with no card hook', async () => {
    const container = await board('lca_admin', true)
    const heritage = container.querySelector('[data-layout="heritage"]')!
    expect(heritage.getAttribute('data-theme')).toBe('heritage')
    const add = await openAdd()
    const cards = [...seatCards(), add]
    expect(cards).toHaveLength(SEATS.length + 1)
    const resets = new Set<Element>()
    for (const card of cards) {
      const reset = card.parentElement as HTMLElement
      const what = card.textContent!.slice(0, 40)
      expect(reset.getAttribute('data-theme'), what).toBe('')
      expect(reset.style.display, what).toBe('contents')
      expect(reset.children, what).toHaveLength(1)
      expect(reset.parentElement!.closest('[data-theme]'), what).toBe(heritage)
      expect(card.hasAttribute('data-heritage'), what).toBe(false)
      // Every field and Button in the card is in the base look.
      const controls = [...card.querySelectorAll('input, button')]
      expect(controls.length, what).toBeGreaterThan(0)
      for (const control of controls) expect(control.closest('[data-theme]'), what).toBe(reset)
      resets.add(reset)
    }
    expect(resets.size).toBe(SEATS.length + 1)
    expect([...container.querySelectorAll('[data-theme]')].map((el) => el.getAttribute('data-theme'))).toEqual(['heritage', ...cards.map(() => '')])
    // The fields of the Add a board seat card by their names.
    for (const name of ['Add seat', 'Cancel']) expect(screen.getByRole('button', { name }).closest('[data-theme]')).toBe(add.parentElement)
    expect(scopeWarnings()).toEqual([])
  })

  it('inside its base scope each card is the card the switch-off page draws, to the attribute', async () => {
    await board('lca_admin', true)
    const add = await openAdd()
    const drawn = [...seatCards(), add].map((card) => card.outerHTML)
    cleanup()
    flags.themeHeritage = false
    await board('lca_admin', false)
    const today = [...seatCards(), await openAdd()].map((card) => card.outerHTML)
    expect(drawn).toEqual(today)
    expect(drawn.join('')).toContain('Add a board seat')
  })
})

describe('the Board page for a visitor, in the heritage layout', () => {
  it('keeps the seat cards in the heritage look with the card hook, and holds no base scope', async () => {
    const container = await board('member', true)
    const heritage = container.querySelector('[data-layout="heritage"]')!
    const cards = [...container.querySelectorAll('[data-heritage="card"]')]
    expect(cards).toHaveLength(SEATS.length)
    for (const card of cards) expect(card.closest('[data-theme]')).toBe(heritage)
    expect([...container.querySelectorAll('[data-theme]')].map((el) => el.getAttribute('data-theme'))).toEqual(['heritage'])
    expect(screen.queryByRole('button', { name: /Add a board seat/ })).toBeNull()
    expect(scopeWarnings()).toEqual([])
  })
})

describe('with themeHeritage off', () => {
  it('the admin\'s page holds no data-theme and no hook, the add card open', async () => {
    flags.themeHeritage = false
    const container = await board('lca_admin', false)
    const add = await openAdd()
    expect(container.querySelectorAll('[data-theme], [data-heritage]')).toHaveLength(0)
    // The add card sits where it always did: the only child of the admin's block.
    expect(add.parentElement!.children).toHaveLength(1)
    expect(add.parentElement!.hasAttribute('data-theme')).toBe(false)
    expect(scopeWarnings()).toEqual([])
  })
})
