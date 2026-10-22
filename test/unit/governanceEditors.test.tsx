// @vitest-environment jsdom
//
// The editor and the governance documents' add and edit card on a heritage
// page (WS01 step 31, the brief's acceptance criterion 12). Bylaws and
// Minutes draw GovernanceDocuments inline, its add and edit card holding the
// lazy RichTextEditor; with the themeHeritage switch on the pages are drawn
// in HeritageLayout, in the heritage look, and the card resets to the base
// look through ThemeScope scope="base".
//
// - Inside HeritageLayout, for an admin who opens Add document: the closest
//   data-theme above the editor (its root, the contenteditable and its
//   toolbar), above the title field and above the card is the base scope's
//   own wrapper, an attribute that is there and empty (""), never heritage;
//   above that wrapper is the layout's heritage container. The wrapper adds
//   no box (display: contents). Editing a document that has words shows the
//   editor in the Upload tab as well, and it is in the base scope too. The
//   list of documents beside the card stays in the heritage look.
// - The card's markup inside the base scope is the markup it has with the
//   switch off, so the reset adds the wrapper and nothing else.
// - With themeHeritage off no ThemeScope wrapper is drawn: the page holds no
//   data-theme at all, and the card sits where it always did.
// - A base scope drawn with no scope around it, or inside the heritage one,
//   is allowed: nothing warns in the console.
//
// The editor's library measures text through browser APIs jsdom lacks
// (getClientRects and getBoundingClientRect on a range, elementFromPoint);
// they are given stand-ins here, in this file only.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
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

/** One made-up document with words, so editing it fills the form. */
const DOC = {
  id: 'fx-doc-1',
  category: 'minutes',
  title: 'Board meeting, Sat, Oct 24',
  content: '<p>The board met at 7:00 PM.</p>',
  filename: null,
  file_url: null,
  doc_date: '2026-10-24',
  year: 2026,
  created_at: '2026-10-24T19:00:00Z',
  updated_at: '2026-10-24T19:00:00Z',
}
vi.mock('@/lib/api', () => ({
  getGovernanceDocuments: vi.fn(async () => [DOC]),
  adminCreateGovernanceDocument: vi.fn(),
  adminUpdateGovernanceDocument: vi.fn(),
  adminDeleteGovernanceDocument: vi.fn(),
}))
vi.mock('@/styles/themes/heritage.css', () => ({}))
vi.mock('@/styles/themes/live.css', () => ({}))

const { HeritageLayout } = await import('@/layouts/HeritageLayout')
const { GovernanceDocuments } = await import('@/areas/governance/components/GovernanceDocuments')

// Stand-ins for the measuring APIs the editor's library reads.
const rects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList
const saved = {
  rangeRects: Range.prototype.getClientRects,
  rangeBox: Range.prototype.getBoundingClientRect,
  elementFromPoint: document.elementFromPoint,
}
beforeAll(async () => {
  Range.prototype.getClientRects = rects
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  document.elementFromPoint = () => null
  // The editor's module, loaded once here, so its lazy import settles at once inside each test.
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

/**
 * What ThemeScope reported in the console. The editor's library warns of a
 * link extension named twice, StarterKit's own and the one RichTextEditor
 * adds (see REDESIGN_STATUS.md, Follow-ups), which is not the looks' concern.
 */
const scopeWarnings = () => warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.startsWith('ThemeScope'))

const ROUTE = '/governance/minutes'
const minutes = <GovernanceDocuments category="minutes" title="Meeting minutes" isAdmin />

/**
 * Draws a tree inside an awaited act(): the layout holds its page until the
 * look's stylesheet has arrived, and React finishes that wait inside the
 * test's act scope only when the scope is awaited.
 */
async function draw(tree: ReactElement) {
  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    view = render(tree)
  })
  return view!
}

/** The minutes list as the heritage pages draw it with the switch on: inside the layout's route. */
function inLayout(page: ReactElement = minutes) {
  return draw(
    <MemoryRouter initialEntries={[ROUTE]}>
      <Routes>
        <Route element={<HeritageLayout />}>
          <Route path={ROUTE} element={page} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

/** The minutes list on its own, as the pages are drawn with the switch off. */
function onItsOwn(page: ReactElement = minutes) {
  return draw(<MemoryRouter initialEntries={[ROUTE]}>{page}</MemoryRouter>)
}

/** A click or a press, with what it sets off (the lazy editor's arrival among it) finished inside an awaited act(). */
async function press(target: Element, how: 'click' | 'mouseDown' = 'click') {
  await act(async () => {
    if (how === 'click') fireEvent.click(target)
    else fireEvent.mouseDown(target, { button: 0 })
  })
}

/** Opens Add document and waits for the lazy editor; gives back the card, the title field and the editor's parts. */
async function openAdd() {
  await press(await screen.findByRole('button', { name: /Add document/ }))
  const card = screen.getByText('Add document', { selector: 'p' }).parentElement!
  const prose = await waitFor(() => {
    const el = card.querySelector('[contenteditable="true"]')
    if (!el) throw new Error('the editor has not loaded yet')
    return el
  })
  const editor = prose.closest('.rounded-md.border')!
  const toolbar = editor.firstElementChild!
  const title = card.querySelector('input')!
  return { card, title, prose, editor, toolbar }
}

/** The closest data-theme above an element, as the attribute's presence and value. */
const themeAbove = (el: Element) => {
  const scope = el.closest('[data-theme]')
  return scope ? { at: scope, theme: scope.getAttribute('data-theme') } : null
}

describe('inside HeritageLayout, with themeHeritage on', () => {
  it('the closest data-theme above the editor and above the form is the base scope\'s "", with the heritage container above it', async () => {
    const { container } = await inLayout()
    const { card, title, prose, editor, toolbar } = await openAdd()
    const heritage = container.querySelector('[data-layout="heritage"]')!
    expect(heritage.getAttribute('data-theme')).toBe('heritage')

    for (const [what, el] of [['the editor', editor], ['its text', prose], ['its toolbar', toolbar], ['the title field', title], ['the card', card]] as const) {
      const above = themeAbove(el)
      expect(above, what).not.toBeNull()
      expect(above!.at.hasAttribute('data-theme'), what).toBe(true)
      expect(above!.theme, what).toBe('')
      expect(above!.at.parentElement!.closest('[data-theme]'), what).toBe(heritage)
    }
    // The reset is the card's own wrapper, a box of no size of its own.
    const reset = card.parentElement as HTMLElement
    expect(reset.getAttribute('data-theme')).toBe('')
    expect(reset.style.display).toBe('contents')
    expect(reset.children).toHaveLength(1)
    // The list of documents beside it stays in the heritage look.
    const listed = screen.getByRole('heading', { level: 4, name: DOC.title })
    expect(themeAbove(listed)!.theme).toBe('heritage')
    expect(scopeWarnings()).toEqual([])
  })

  it('editing a document with words draws the editor in the Upload tab too, and it is in the base scope as well', async () => {
    await inLayout()
    await screen.findByRole('heading', { level: 4, name: DOC.title })
    const edit = screen.getAllByRole('button').find((b) => b.querySelector(':scope > .lucide-pencil'))!
    await press(edit)
    const card = screen.getByText('Edit document', { selector: 'p' }).parentElement!
    await press(within(card).getByRole('tab', { name: 'Upload & convert' }), 'mouseDown')
    const prose = await waitFor(() => {
      const panel = within(card).getByRole('tabpanel')
      const el = panel.querySelector('[contenteditable="true"]')
      if (!el) throw new Error('the Upload tab\'s editor has not loaded yet')
      return el
    })
    expect(themeAbove(prose)!.theme).toBe('')
    expect(themeAbove(prose)!.at).toBe(card.parentElement)
    expect(scopeWarnings()).toEqual([])
  })

  it('the card inside the base scope is the card the switch-off page draws, to the attribute', async () => {
    // The tabs' ids are React's own, numbered as each tree is drawn; the rest is compared as drawn.
    const markup = (el: Element) => el.outerHTML.replace(/radix-[^"\s]*?-(trigger|content)-/g, 'radix-$1-')
    const on = await inLayout()
    const { card: inScope } = await openAdd()
    const drawn = markup(inScope)
    on.unmount()
    flags.themeHeritage = false
    await onItsOwn()
    const { card: today } = await openAdd()
    expect(drawn).toBe(markup(today))
    expect(drawn).toContain('contenteditable="true"')
  })
})

describe('with themeHeritage off', () => {
  it('draws no ThemeScope wrapper: no data-theme anywhere, and the card sits where it always did', async () => {
    flags.themeHeritage = false
    const { container } = await onItsOwn()
    const { card, prose, title } = await openAdd()
    expect(container.querySelectorAll('[data-theme]')).toHaveLength(0)
    for (const el of [card, prose, title]) expect(themeAbove(el)).toBeNull()
    // The card is a child of the list's own element, beside the heading row and the list.
    const root = container.firstElementChild!
    expect(card.parentElement).toBe(root)
    expect([...root.children].indexOf(card)).toBe(1)
    expect(scopeWarnings()).toEqual([])
  })
})

describe('the base scope with no heritage scope around it', () => {
  it('is allowed: the switch on and the list drawn on its own warns of nothing', async () => {
    const { container } = await onItsOwn()
    const { card } = await openAdd()
    expect(card.parentElement!.getAttribute('data-theme')).toBe('')
    expect(container.querySelectorAll('[data-theme]')).toHaveLength(1)
    expect(scopeWarnings()).toEqual([])
  })
})
