// @vitest-environment jsdom
//
// The Bylaws page's three document lists for an admin, inside HeritageLayout
// with the themeHeritage switch on (WS01 step 31, acceptance criterion 12),
// as the page itself draws them: proposed amendments, the bylaws and the
// rules, each a GovernanceDocuments in the preview layout.
//
// - With the add card open on all three lists at once, each card and its
//   lazy editor sit in a base scope of their own (data-theme="", no box of
//   its own), the closest data-theme above the editor's text, its toolbar
//   and the title field, and each of those scopes sits straight inside the
//   layout's heritage scope: one level of nesting, the one the looks allow.
// - Editing the bylaws document puts its card and editor in a base scope
//   too, while the documents themselves, drawn as previews, stay in the
//   heritage look with the card hook.
// - Nothing warns in the console, and with the switch off the same page
//   holds no data-theme at all.
//
// The editor's library measures text through browser APIs jsdom lacks; they
// are given stand-ins here, in this file only, as in governanceEditors.test.tsx.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

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
  return { ...real, ...heritageApi, adminCreateGovernanceDocument: vi.fn(), adminUpdateGovernanceDocument: vi.fn(), adminDeleteGovernanceDocument: vi.fn() }
})
vi.mock('@/styles/themes/heritage.css', () => ({}))
vi.mock('@/styles/themes/live.css', () => ({}))

const { HeritageLayout } = await import('@/layouts/HeritageLayout')
const { BylawsPage } = await import('@/pages/BylawsPage')
const { AuthContext } = await import('@/contexts/auth-context')
const { visitor } = await import('./helpers/heritagePages')

const saved = {
  rangeRects: Range.prototype.getClientRects,
  rangeBox: Range.prototype.getBoundingClientRect,
  elementFromPoint: document.elementFromPoint,
}
beforeAll(async () => {
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  document.elementFromPoint = () => null
  await import('@/areas/governance/components/RichTextEditor')
})
afterAll(() => {
  Range.prototype.getClientRects = saved.rangeRects
  Range.prototype.getBoundingClientRect = saved.rangeBox
  document.elementFromPoint = saved.elementFromPoint
})

let warn: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  flags.themeHeritage = true
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  warn.mockRestore()
})

/** What ThemeScope reported in the console (the editor's library warns of its own link extension, which is not the looks' concern). */
const scopeWarnings = () => warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.startsWith('ThemeScope'))

const ROUTE = '/governance/bylaws'

async function bylaws(inLayout: boolean) {
  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    view = render(
      <AuthContext.Provider value={visitor('lca_admin')}>
        <MemoryRouter initialEntries={[ROUTE]}>
          <Routes>
            {inLayout ? (
              <Route element={<HeritageLayout />}>
                <Route path={ROUTE} element={<BylawsPage />} />
              </Route>
            ) : (
              <Route path={ROUTE} element={<BylawsPage />} />
            )}
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  })
  await screen.findByRole('heading', { level: 4, name: 'Fixture bylaws' })
  await act(async () => new Promise((r) => setTimeout(r, 30)))
  return view!.container
}

async function press(target: Element) {
  await act(async () => {
    fireEvent.click(target)
  })
}

/** The lists' sections, by their headings. */
const LISTS = ['Proposed amendments', 'Bylaws documents', 'Rules & policy documents']
const listOf = (title: string) => screen.getByRole('heading', { level: 3, name: title }).parentElement!.parentElement!

/** The open card of a list, once its editor has loaded. */
async function openCard(list: HTMLElement, label: 'Add document' | 'Edit document') {
  const card = within(list).getByText(label, { selector: 'p' }).parentElement!
  const prose = await waitFor(() => {
    const el = card.querySelector('[contenteditable="true"]')
    if (!el) throw new Error('the editor has not loaded yet')
    return el
  })
  return { card, prose, toolbar: prose.closest('.rounded-md.border')!.firstElementChild!, title: card.querySelector('input')! }
}

describe('the Bylaws page for an admin, in the heritage layout', () => {
  it('the add card of each of the three lists, open at once, sits in a base scope of its own straight inside the heritage scope', async () => {
    const container = await bylaws(true)
    const heritage = container.querySelector('[data-layout="heritage"]')!
    for (const title of LISTS) await press(within(listOf(title)).getByRole('button', { name: /Add document/ }))
    const resets = new Set<Element>()
    for (const title of LISTS) {
      const { card, prose, toolbar, title: field } = await openCard(listOf(title), 'Add document')
      const reset = card.parentElement as HTMLElement
      expect(reset.getAttribute('data-theme'), title).toBe('')
      expect(reset.style.display, title).toBe('contents')
      for (const el of [prose, toolbar, field, card]) expect(el.closest('[data-theme]'), title).toBe(reset)
      expect(reset.parentElement!.closest('[data-theme]'), title).toBe(heritage)
      resets.add(reset)
    }
    expect(resets.size).toBe(3)
    expect([...container.querySelectorAll('[data-theme]')].map((el) => el.getAttribute('data-theme'))).toEqual(['heritage', '', '', ''])
    expect(scopeWarnings()).toEqual([])
  })

  it('editing the bylaws document puts its card and editor in a base scope, and the documents stay in the heritage look with the card hook', async () => {
    const container = await bylaws(true)
    const heritage = container.querySelector('[data-layout="heritage"]')!
    const list = listOf('Bylaws documents')
    const documentCard = within(list).getByRole('heading', { level: 4, name: 'Fixture bylaws' }).closest('[data-heritage]')!
    expect(documentCard.getAttribute('data-heritage')).toBe('card')
    expect(documentCard.closest('[data-theme]')).toBe(heritage)
    // The pencil's own button, not the card's toggle that holds it.
    const edit = [...documentCard.querySelectorAll('button')].find((b) => b.querySelector(':scope > .lucide-pencil'))!
    await press(edit)
    const { card, prose } = await openCard(list, 'Edit document')
    expect(prose.closest('[data-theme]')!.getAttribute('data-theme')).toBe('')
    expect(card.parentElement!.parentElement!.closest('[data-theme]')).toBe(heritage)
    // The document itself, and the empty lists' boxes, keep the heritage look.
    for (const box of container.querySelectorAll('[data-heritage="card"]')) expect(box.closest('[data-theme]')).toBe(heritage)
    expect(scopeWarnings()).toEqual([])
  })

  it('with the switch off holds no data-theme at all, the cards open', async () => {
    flags.themeHeritage = false
    const container = await bylaws(false)
    for (const title of LISTS) await press(within(listOf(title)).getByRole('button', { name: /Add document/ }))
    for (const title of LISTS) await openCard(listOf(title), 'Add document')
    expect(container.querySelectorAll('[data-theme], [data-heritage]')).toHaveLength(0)
    expect(scopeWarnings()).toEqual([])
  })
})
