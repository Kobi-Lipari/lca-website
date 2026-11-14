// @vitest-environment jsdom
//
// Where the focus goes on the newsletter's own page (WS16 part two, page step
// 4, the page on a computer), with src/App.tsx drawn whole and every call
// answered by a stand-in for fetch. Each thing this half opens takes the
// focus when it opens, closes on Escape and gives the focus back to the
// control that opened it:
// - the Add menu ("Add an event or line"), whose one line, chosen, goes into
//   the letter, where the focus then is;
// - the link's field, which refuses in words an address the email cannot
//   keep, and puts a kept one in the letter;
// - the Subject, which shows its count while it has the focus, a guide that
//   never stops the typing;
// - the month's box in the band, from its "Click to edit" chip;
// - Make bigger, which fills the window, takes the focus into the letter,
//   keeps the keyboard inside it, shows Make smaller and closes on Escape;
// - Hide and Show the email, which stand in one place;
// - the question "Show their letter" asks, once, before it replaces the
//   person's words, and a read of their letter that fails, said at once in
//   the refusal's own region with the focus back on Show their letter.
// And the controls a keyboard moves: the tools, one stop with the arrow keys
// among them, Heading's three forms in words, and "Pull to make taller".
// The editor's library measures text through browser APIs jsdom lacks; they
// are given stand-ins here, in this file only. Every word here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/react'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { defaultSubject } from '@domain/mail/letter'

const flags = vi.hoisted(() => ({ mailLists: true, mailPage: true }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get mailLists() {
        return flags.mailLists
      },
      get mailPage() {
        return flags.mailPage
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'sample-token' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getAnnouncements: async () => ({ announcements: [] }),
}))

const { default: App } = await import('@/App')
const { AuthContext } = await import('@/contexts/auth-context')

const ISSUE_URL = '/api/admin/mail/newsletter/issue'
const BODY = '<h2>Sample heading one</h2><p>Sample words one</p><h2>Sample heading two</h2><p>Sample words two</p>'

const saved = {
  rangeRects: Range.prototype.getClientRects,
  rangeBox: Range.prototype.getBoundingClientRect,
  elementFromPoint: document.elementFromPoint,
}
beforeAll(() => {
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
  document.elementFromPoint = () => null
})
afterAll(() => {
  Range.prototype.getClientRects = saved.rangeRects
  Range.prototype.getBoundingClientRect = saved.rangeBox
  document.elementFromPoint = saved.elementFromPoint
})

interface Answer { status: number; body: unknown }
let answers: Record<string, Answer[]> = {}
let puts: Array<Record<string, unknown>> = []
const on = (method: string, url: string, ...list: Answer[]) => {
  answers[`${method} ${url}`] = list
}
const letter = (bodyHtml = BODY, version = 3) => ({
  issue: { id: 'sample-letter-1', version, monthLabel: 'December 2026', subject: defaultSubject('December 2026'), preheader: '', bodyHtml, createdAt: '2026-11-13 15:00:00', updatedAt: '2026-11-13 20:15:00' },
  state: 'draft', lastSavedBy: 'Player Two', lastSavedAt: '2026-11-13 20:15:00',
})

/** A signed-in person's token in its form, with a second factor, as the site reads one. */
const part = (value: unknown) => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const TOKEN = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ sub: 'member-sample-admin', session_id: 'session-sample-admin', aal: 'aal2', role: 'authenticated' })}.sample-signature`

const ADMIN = {
  user: { id: 'member-sample-admin', email: 'admin@example.org', user_metadata: { role: 'lca_admin' } },
  session: { access_token: TOKEN },
  member: { id: 'member-sample-admin', email: 'admin@example.org', full_name: 'Player One', role: 'lca_admin', club_id: null, membership_status: 'active' },
  role: 'lca_admin', seats: [], managedClubs: [], isBoardMember: true, assuranceLevel: 'aal2', mfaRequired: false,
  refreshAssurance: async () => {}, directedTournaments: [], directedTournamentIds: [], loading: false, memberLoading: false,
  signOut: async () => {}, impersonating: null, exitImpersonation: async () => {},
} as unknown as AuthContextValue

beforeEach(() => {
  answers = {}
  puts = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (method === 'PUT') puts.push(JSON.parse(String(init?.body)))
    const list = answers[`${method} ${url}`]
    const answer = (list && list.length > 1 ? list.shift() : list?.[0]) ?? { status: 404, body: { error: 'Not found' } }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
  on('GET', ISSUE_URL, { status: 200, body: letter() })
  on('GET', '/api/admin/mail/newsletter', { status: 200, body: { list: { id: 'lca-newsletter', name: 'LCA newsletter' }, from: 'x', sendsThrough: 'resend', summary: { addresses: 9, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 9, recent: [], waits: null } } })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const settle = (ms = 40) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)))
async function thePage() {
  await act(async () => {
    render(
      <AuthContext.Provider value={ADMIN}>
        <MemoryRouter initialEntries={['/admin/newsletter']}>
          <App />
        </MemoryRouter>
      </AuthContext.Provider>,
    )
  })
  await screen.findByRole('heading', { level: 1, name: 'Newsletter' }, { timeout: 10_000 })
  await screen.findByRole('toolbar', { name: 'Writing tools' })
  await settle()
}
const editorOf = () => (document.querySelector('.ProseMirror') as HTMLElement & { editor: Editor }).editor
const focused = () => document.activeElement as HTMLElement
const key = (target: Element, name: string, more: Record<string, unknown> = {}) => fireEvent.keyDown(target, { key: name, ...more })

describe('the Add menu', () => {
  it('takes the focus to its line when it opens, closes on Escape and gives the focus back', async () => {
    await thePage()
    const add = screen.getByRole('button', { name: /Add an event or line/ })
    expect(add.getAttribute('aria-haspopup')).toBe('menu')
    fireEvent.click(add)
    const menu = screen.getByRole('menu', { name: 'Add' })
    expect(add.getAttribute('aria-expanded')).toBe('true')
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['A line'])
    expect(focused().textContent).toBe('A line')
    key(focused(), 'ArrowDown')
    expect(focused().textContent).toBe('A line')
    key(focused(), 'Escape')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(focused()).toBe(add)
    expect(add.getAttribute('aria-expanded')).toBe('false')
  })

  it('puts the line in the letter, where the focus then goes, and closes at a press elsewhere without moving the focus', async () => {
    await thePage()
    const add = screen.getByRole('button', { name: /Add an event or line/ })
    fireEvent.click(add)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.click(add)
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'A line' }))
    })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(editorOf().getHTML()).toContain('<hr>')
    await waitFor(() => expect(editorOf().isFocused).toBe(true))
  })
})

describe('the link\'s field', () => {
  it('takes the focus to the address, refuses in words an address the email cannot keep, and gives the focus back on Escape', async () => {
    await thePage()
    const link = screen.getByRole('button', { name: 'Link' })
    fireEvent.click(link)
    expect(link.getAttribute('aria-expanded')).toBe('true')
    const address = screen.getByRole('textbox', { name: 'Link address' })
    expect(focused()).toBe(address)
    fireEvent.change(address, { target: { value: 'example.org/page' } })
    key(address, 'Enter')
    expect(screen.getByText('The email cannot keep that address. Start it with https://, http:// or mailto: and leave out spaces and quote marks.')).toBeTruthy()
    expect(address.getAttribute('aria-invalid')).toBe('true')
    expect(focused()).toBe(address)
    key(address, 'Escape')
    expect(screen.queryByRole('textbox', { name: 'Link address' })).toBeNull()
    expect(focused()).toBe(link)
    expect(editorOf().getHTML()).toBe(BODY)
  })

  it('puts a kept address in the letter, with words of its own where none were chosen, never through the browser\'s prompt', async () => {
    await thePage()
    const prompt = vi.spyOn(window, 'prompt')
    await act(async () => {
      editorOf().chain().focus().setTextSelection(editorOf().state.doc.content.size - 1).run()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Link address' }), { target: { value: ' https://example.org/a?b=1&c=2 ' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Words to show' }), { target: { value: 'Sample link' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add the link' }))
    })
    expect(editorOf().getHTML()).toContain('<a href="https://example.org/a?b=1&amp;c=2">Sample link</a>')
    expect(screen.queryByRole('textbox', { name: 'Link address' })).toBeNull()
    expect(prompt).not.toHaveBeenCalled()
    prompt.mockRestore()
    // The words typed next stay plain words: a link does not grow as the person goes on typing after it.
    await act(async () => {
      editorOf().view.dispatch(editorOf().state.tr.insertText(' and more words'))
    })
    expect(editorOf().getHTML()).toContain('<a href="https://example.org/a?b=1&amp;c=2">Sample link</a> and more words</p>')
  })
})

describe('the words a link goes on', () => {
  it('stay marked while the focus is in the link\'s field, and take the link with no words of its own asked for', async () => {
    await thePage()
    // The second line's first word, "Sample": the first heading runs from 0 to 20, so its words start at 21.
    await act(async () => {
      editorOf().chain().focus().setTextSelection({ from: 21, to: 27 }).run()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    expect(focused()).toBe(screen.getByRole('textbox', { name: 'Link address' }))
    expect(screen.queryByRole('textbox', { name: 'Words to show' })).toBeNull()
    await waitFor(() => expect(document.querySelector('.ProseMirror .kept-selection')?.textContent).toBe('Sample'))
    fireEvent.change(screen.getByRole('textbox', { name: 'Link address' }), { target: { value: 'mailto:player.one@example.org' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add the link' }))
    })
    expect(editorOf().getHTML()).toContain('<p><a href="mailto:player.one@example.org">Sample</a> words one</p>')
  })
})

describe('the Subject, the month and the side', () => {
  it('shows the Subject\'s count while it has the focus, as a guide that never stops the typing', async () => {
    await thePage()
    const subject = screen.getByRole('textbox', { name: /Subject/ }) as HTMLInputElement
    const count = document.getElementById(subject.getAttribute('aria-describedby')!)!
    expect(count.hidden).toBe(true)
    act(() => subject.focus())
    expect(count.hidden).toBe(false)
    expect(count.textContent).toBe('30 of 60 letters')
    const long = 'Sample subject that runs on well past the sixty letters an inbox shows on one line'
    fireEvent.change(subject, { target: { value: long } })
    expect(subject.value).toBe(long)
    expect(count.textContent).toBe(`${long.length} of 60 letters`)
    act(() => subject.blur())
    expect(count.hidden).toBe(true)
  })

  it('opens the month\'s box from its chip with the focus in it, and gives the focus back to the chip on Escape and on Enter', async () => {
    await thePage()
    const chip = () => screen.getByRole('button', { name: /Click to edit the month/ })
    fireEvent.click(chip())
    const box = screen.getByRole('textbox', { name: 'The month' }) as HTMLInputElement
    expect(focused()).toBe(box)
    fireEvent.change(box, { target: { value: 'Sample month' } })
    key(box, 'Escape')
    await settle()
    expect(focused()).toBe(chip())
    expect(chip().getAttribute('aria-label')).toBe('Click to edit the month, December 2026')
    fireEvent.click(chip())
    fireEvent.change(screen.getByRole('textbox', { name: 'The month' }), { target: { value: 'January 2027' } })
    key(screen.getByRole('textbox', { name: 'The month' }), 'Enter')
    await settle()
    expect(focused()).toBe(chip())
    expect(chip().getAttribute('aria-label')).toBe('Click to edit the month, January 2027')
  })

  it('moves the focus between Hide and Show the email, which stand in one place', async () => {
    await thePage()
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
    expect(focused()).toBe(screen.getByRole('button', { name: 'Show the email' }))
    fireEvent.click(focused())
    expect(focused()).toBe(screen.getByRole('button', { name: 'Hide' }))
  })
})

describe('Make bigger', () => {
  it('fills the window with the letter, takes the focus into it, keeps the keyboard inside, shows Make smaller and gives the focus back on Escape', async () => {
    await thePage()
    const bigger = screen.getByRole('button', { name: 'Make bigger' })
    fireEvent.click(bigger)
    const dialog = screen.getByRole('dialog', { name: 'The letter, made bigger' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(within(dialog).getByRole('button', { name: 'Make smaller' })).toBe(bigger)
    await waitFor(() => expect(editorOf().isFocused).toBe(true))
    // The keyboard stays inside: Tab from the last control goes to the first, and Shift and Tab from the first to the last.
    act(() => bigger.focus())
    const tab = key(dialog, 'Tab')
    expect(tab).toBe(false)
    expect(within(dialog).getByRole('textbox', { name: /Subject/ })).toBe(focused())
    key(dialog, 'Tab', { shiftKey: true })
    expect(focused()).toBe(bigger)
    key(dialog, 'Escape')
    expect(screen.queryByRole('dialog', { name: 'The letter, made bigger' })).toBeNull()
    await settle()
    expect(focused()).toBe(screen.getByRole('button', { name: 'Make bigger' }))
  })

  it('gives the page back on Escape with the caret in the letter, though the editor marks that key as its own', async () => {
    await thePage()
    fireEvent.click(screen.getByRole('button', { name: 'Make bigger' }))
    await waitFor(() => expect(editorOf().isFocused).toBe(true))
    const letter = document.querySelector('.ProseMirror') as HTMLElement
    // The key as a browser sends it: the editor reads its code, 27, and marks it handled.
    const sent = key(letter, 'Escape', { keyCode: 27 })
    expect(sent).toBe(false)
    expect(screen.queryByRole('dialog', { name: 'The letter, made bigger' })).toBeNull()
    await settle()
    expect(focused()).toBe(screen.getByRole('button', { name: 'Make bigger' }))
  })
})

describe('the question before their letter takes the place of the person\'s words', () => {
  it('asks once, with the focus inside, gives it back on Escape, and shows their letter in the letter\'s place when asked to', async () => {
    on('PUT', ISSUE_URL, { status: 409, body: { error: 'x', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-13 20:17:00' } })
    await thePage()
    await act(async () => {
      editorOf().chain().focus('end').insertContent('<p>Mine</p>').run()
    })
    await settle(2300)
    const show = await screen.findByRole('button', { name: 'Show their letter' })
    fireEvent.click(show)
    const ask = screen.getByRole('dialog', { name: 'Show their letter?' })
    expect(ask.contains(focused())).toBe(true)
    key(focused(), 'Escape')
    await settle()
    expect(screen.queryByRole('dialog', { name: 'Show their letter?' })).toBeNull()
    expect(focused()).toBe(screen.getByRole('button', { name: 'Show their letter' }))
    expect(editorOf().getHTML()).toContain('<p>Mine</p>')
    // Asked again, and answered yes: their letter is read and takes the place of the person's words, the caret in it.
    on('GET', ISSUE_URL, { status: 200, body: letter('<h2>Sample heading three</h2><p>Theirs</p>', 9) })
    fireEvent.click(screen.getByRole('button', { name: 'Show their letter' }))
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog', { name: 'Show their letter?' })).getByRole('button', { name: 'Show their letter' }))
    })
    await settle(100)
    expect(editorOf().getHTML()).toBe('<h2>Sample heading three</h2><p>Theirs</p>')
    await waitFor(() => expect(editorOf().isFocused).toBe(true))
    expect(puts).toHaveLength(1)
  })

  it('says at once, in the refusal\'s own region, that their letter could not be read, with the focus back on Show their letter', async () => {
    on('PUT', ISSUE_URL, { status: 409, body: { error: 'x', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-13 20:17:00' } })
    on('GET', ISSUE_URL, { status: 200, body: letter() }, { status: 500, body: { error: 'Something went wrong' } })
    await thePage()
    await act(async () => {
      editorOf().chain().focus('end').insertContent('<p>Mine</p>').run()
    })
    await settle(2300)
    const savedLine = () => document.querySelector('[data-slot="saved-line"]') as HTMLElement
    const alert = within(savedLine()).getByRole('alert')
    expect(alert.textContent).toBe('Player Two changed this letter at 2:17 PM. Nothing more is saved over their letter. Your words stay here for you to copy.')
    fireEvent.click(await screen.findByRole('button', { name: 'Show their letter' }))
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog', { name: 'Show their letter?' })).getByRole('button', { name: 'Show their letter' }))
    })
    await settle(100)
    expect(within(savedLine()).getByRole('alert')).toBe(alert)
    expect(alert.textContent).toBe(
      'Player Two changed this letter at 2:17 PM. Nothing more is saved over their letter. Your words stay here for you to copy. Their letter could not be read. Press "Show their letter" to try again.',
    )
    expect(focused()).toBe(screen.getByRole('button', { name: 'Show their letter' }))
    expect(editorOf().getHTML()).toContain('<p>Mine</p>')
  })

  it('closes alone on Escape while the letter fills the window, which stays, and gives the focus back to its button there', async () => {
    on('PUT', ISSUE_URL, { status: 409, body: { error: 'x', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-13 20:17:00' } })
    await thePage()
    fireEvent.click(screen.getByRole('button', { name: 'Make bigger' }))
    const bigger = screen.getByRole('dialog', { name: 'The letter, made bigger' })
    await act(async () => {
      editorOf().chain().focus('end').insertContent('<p>Mine</p>').run()
    })
    await settle(2300)
    // The saved line is in the bigger letter's own top while it fills the window.
    const show = await within(bigger).findByRole('button', { name: 'Show their letter' })
    fireEvent.click(show)
    const ask = screen.getByRole('dialog', { name: 'Show their letter?' })
    expect(ask.contains(focused())).toBe(true)
    key(focused(), 'Escape')
    await settle()
    expect(screen.queryByRole('dialog', { name: 'Show their letter?' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'The letter, made bigger' })).toBe(bigger)
    expect(within(bigger).getByRole('button', { name: 'Make smaller' })).toBeTruthy()
    expect(focused()).toBe(within(bigger).getByRole('button', { name: 'Show their letter' }))
    expect(editorOf().getHTML()).toContain('<p>Mine</p>')
    // Escape from inside the bigger letter itself still gives the page back.
    key(focused(), 'Escape')
    expect(screen.queryByRole('dialog', { name: 'The letter, made bigger' })).toBeNull()
    await settle()
    expect(focused()).toBe(screen.getByRole('button', { name: 'Make bigger' }))
  })
})

describe('the controls a keyboard moves', () => {
  it('makes the tools one stop, the arrow keys moving among them, each a button with its name', async () => {
    await thePage()
    const toolbar = screen.getByRole('toolbar', { name: 'Writing tools' })
    const tools = within(toolbar).getAllByRole('button')
    expect(tools.map((t) => t.textContent)).toEqual(['Bold', 'Italic', 'Heading', 'List', 'Link', 'Undo', 'Add an event or line'])
    expect(tools.filter((t) => t.tabIndex === 0)).toHaveLength(1)
    act(() => tools[0].focus())
    key(tools[0], 'ArrowRight')
    expect(focused()).toBe(tools[1])
    key(tools[1], 'End')
    expect(focused()).toBe(tools[6])
    key(tools[6], 'ArrowRight')
    expect(focused()).toBe(tools[0])
    key(tools[0], 'ArrowLeft')
    expect(focused()).toBe(tools[6])
    expect(tools.filter((t) => t.tabIndex === 0)).toEqual([tools[6]])
  })

  it('says by aria-pressed when a tool is on, and Heading\'s three forms in words, a smaller heading only under a main one', async () => {
    await thePage()
    const heading = screen.getByRole('button', { name: 'Heading' })
    const bold = screen.getByRole('button', { name: 'Bold' })
    const said = () => document.querySelector('[role="toolbar"] [role="status"]')?.textContent
    // The caret in the second part's words: plain words, then a main heading, then a smaller one, then plain words.
    await act(async () => {
      editorOf().commands.setTextSelection(editorOf().state.doc.content.size - 3)
    })
    expect(heading.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(heading)
    expect(said()).toBe('Main heading')
    expect(heading.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(heading)
    expect(said()).toBe('Smaller heading')
    expect(editorOf().getHTML()).toContain('<h3>Sample words two</h3>')
    fireEvent.click(heading)
    expect(said()).toBe('No heading')
    expect(heading.getAttribute('aria-pressed')).toBe('false')
    // The letter's first heading is never offered as a smaller one: the server refuses a letter that starts with one.
    await act(async () => {
      editorOf().commands.setTextSelection(3)
    })
    fireEvent.click(heading)
    expect(said()).toBe('No heading')
    expect(editorOf().getHTML().startsWith('<p>Sample heading one</p>')).toBe(true)
    await act(async () => {
      editorOf().chain().selectAll().run()
    })
    fireEvent.click(bold)
    expect(bold.getAttribute('aria-pressed')).toBe('true')
  })

  it('moves "Pull to make taller" by the arrow keys, Page Up and Down, Home and End, and the letter\'s box with it', async () => {
    await thePage()
    // Named with its own visible words, whole, so a person who says what they see reaches it.
    const pull = screen.getByRole('separator', { name: 'Pull to make taller' })
    expect(pull.textContent).toBe('Pull to make taller')
    const sheet = document.querySelector('[data-slot="letter-sheet"]') as HTMLElement
    expect(pull.tabIndex).toBe(0)
    const start = Number(pull.getAttribute('aria-valuenow'))
    const now = () => Number(pull.getAttribute('aria-valuenow'))
    key(pull, 'ArrowDown')
    expect(now()).toBe(start + 40)
    expect(sheet.style.height).toBe(`${start + 40}px`)
    key(pull, 'PageDown')
    expect(now()).toBe(start + 200)
    key(pull, 'ArrowUp')
    expect(now()).toBe(start + 160)
    key(pull, 'PageUp')
    expect(now()).toBe(start)
    expect(sheet.style.height).toBe(`${start}px`)
    key(pull, 'Home')
    expect(pull.getAttribute('aria-valuenow')).toBe('320')
    expect(pull.getAttribute('aria-valuetext')).toBe('320 pixels tall')
    key(pull, 'End')
    expect(pull.getAttribute('aria-valuenow')).toBe('3000')
  })
})

describe('"Pull to make taller" for a person who cannot drag', () => {
  /**
   * One pointer on the grip, as a mouse makes it: down at the first height, through any others, up at the last, and the
   * click the browser sends after it, which counts one press as a browser's does; a click with no pointer of its own, as
   * a screen reader gives, counts none.
   */
  const pointer = (grip: Element, ...ys: number[]) => {
    fireEvent.pointerDown(grip, { pointerId: 1, button: 0, clientY: ys[0] })
    for (const y of ys.slice(1)) fireEvent.pointerMove(grip, { pointerId: 1, button: -1, clientY: y })
    fireEvent.pointerUp(grip, { pointerId: 1, button: 0, clientY: ys[ys.length - 1] })
    fireEvent.click(grip, { button: 0, detail: 1, clientY: ys[ys.length - 1] })
  }
  const theGrip = async () => {
    await thePage()
    const pull = screen.getByRole('separator', { name: 'Pull to make taller' })
    const sheet = document.querySelector('[data-slot="letter-sheet"]') as HTMLElement
    return { pull, sheet, now: () => Number(pull.getAttribute('aria-valuenow')) }
  }

  it('makes the letter one step taller at a press, the step Page Down gives, and says its new height in words', async () => {
    const { pull, sheet, now } = await theGrip()
    const start = now()
    act(() => screen.getByRole('button', { name: 'Hide' }).focus())
    pointer(pull, 500)
    expect(now()).toBe(start + 160)
    expect(sheet.style.height).toBe(`${start + 160}px`)
    // The grip has the focus, as after a key, so a screen reader says its new height in words.
    expect(focused()).toBe(pull)
    expect(pull.getAttribute('aria-valuetext')).toBe(`${start + 160} pixels tall`)
    // A finger that strays a few pixels as it presses still presses; Page Down moves it by the same step.
    pointer(pull, 500, 503, 497, 501)
    expect(now()).toBe(start + 320)
    key(pull, 'PageDown')
    expect(now()).toBe(start + 480)
    // A click with no pointer of its own, as a screen reader gives, is a press too.
    fireEvent.click(pull)
    expect(now()).toBe(start + 640)
    expect(pull.getAttribute('aria-label')).toBe('Pull to make taller')
    expect(pull.textContent).toBe('Pull to make taller')
  })

  it('goes to its shortest at a press when it is at its tallest, so presses alone reach a letter shorter than at first', async () => {
    const { pull, sheet, now } = await theGrip()
    const start = now()
    key(pull, 'End')
    expect(now()).toBe(3000)
    pointer(pull, 500)
    expect(now()).toBe(320)
    expect(now()).toBeLessThan(start)
    expect(sheet.style.height).toBe('320px')
    expect(pull.getAttribute('aria-valuetext')).toBe('320 pixels tall')
    // From the shortest, presses walk the whole range in the step Page Down gives, and from the tallest go round again.
    const walked: number[] = []
    for (let i = 0; i < 18; i++) {
      pointer(pull, 500)
      walked.push(now())
    }
    expect(walked).toEqual([...Array.from({ length: 16 }, (_, i) => 480 + i * 160), 3000, 320])
  })

  it('takes a drag as a drag and never as a press, even one that comes back to where it began', async () => {
    const { pull, now } = await theGrip()
    const start = now()
    pointer(pull, 500, 560, 620)
    expect(now()).toBe(start + 120)
    pointer(pull, 500, 600, 500)
    expect(now()).toBe(start + 120)
    pointer(pull, 500, 440)
    expect(now()).toBe(start + 60)
    // A pointer the browser takes back is no press either.
    fireEvent.pointerDown(pull, { pointerId: 1, button: 0, clientY: 500 })
    fireEvent.pointerCancel(pull, { pointerId: 1, button: 0, clientY: 500 })
    expect(now()).toBe(start + 60)
    // Nothing of a drag is left over to change the next press, which is a press.
    pointer(pull, 500)
    expect(now()).toBe(start + 220)
  })

  it('takes a click with no pointer of its own as a press from the height as it stands, whatever a gesture with no click left', async () => {
    const { pull, now } = await theGrip()
    const start = now()
    // A right press, for which the browser sends no click: the click a screen reader gives next still presses.
    fireEvent.pointerDown(pull, { pointerId: 1, button: 2, clientY: 500 })
    fireEvent.pointerUp(pull, { pointerId: 1, button: 2, clientY: 500 })
    fireEvent.click(pull)
    expect(now()).toBe(start + 160)
    // A pointer the browser takes back, with no click after it: the same.
    fireEvent.pointerDown(pull, { pointerId: 1, button: 0, clientY: 500 })
    fireEvent.pointerCancel(pull, { pointerId: 1, button: 0, clientY: 500 })
    fireEvent.click(pull)
    expect(now()).toBe(start + 320)
    // A tap that only stops a fling, so no click follows it, and then a key: the click with no pointer steps from the
    // height as it stands, not from the tap's.
    fireEvent.pointerDown(pull, { pointerId: 1, button: 0, clientY: 500 })
    fireEvent.pointerUp(pull, { pointerId: 1, button: 0, clientY: 500 })
    key(pull, 'ArrowDown')
    expect(now()).toBe(start + 360)
    fireEvent.click(pull)
    expect(now()).toBe(start + 520)
  })

  it('scrolls the page by what the letter grew or shrank at a press, at once, so the grip stays under the pointer', async () => {
    const { pull, sheet, now } = await theGrip()
    const start = now()
    // The grip stands under the letter's box, whose top is 300 pixels down the window, less what the page has scrolled.
    let scrolled = 0
    pull.getBoundingClientRect = () => new DOMRect(0, 300 + parseFloat(sheet.style.height) - scrolled, 400, 52)
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(((options: ScrollToOptions) => {
      scrolled += options.top ?? 0
    }) as typeof window.scrollBy)
    try {
      const at = pull.getBoundingClientRect().top
      pointer(pull, 500)
      expect(now()).toBe(start + 160)
      expect(scroll).toHaveBeenCalledTimes(1)
      // With no smooth scroll, whatever the person's setting for motion: the grip is under the pointer for the next press.
      expect(scroll).toHaveBeenLastCalledWith({ top: 160, behavior: 'instant' })
      expect(pull.getBoundingClientRect().top).toBe(at)
      // A click with no pointer of its own is a press too, and the page follows the grip the same way.
      fireEvent.click(pull)
      expect(scroll).toHaveBeenLastCalledWith({ top: 160, behavior: 'instant' })
      expect(pull.getBoundingClientRect().top).toBe(at)
      // The keys move the grip as before, with no scroll of the page's own; a press at the tallest goes to the shortest,
      // and the page scrolls back by what the letter shrank.
      key(pull, 'End')
      expect(scroll).toHaveBeenCalledTimes(2)
      const tallest = pull.getBoundingClientRect().top
      pointer(pull, 500)
      expect(now()).toBe(320)
      expect(scroll).toHaveBeenLastCalledWith({ top: 320 - 3000, behavior: 'instant' })
      expect(pull.getBoundingClientRect().top).toBe(tallest)
      // A drag moves no page: the grip follows the pointer by itself.
      pointer(pull, 500, 560, 620)
      expect(now()).toBe(440)
      expect(scroll).toHaveBeenCalledTimes(3)
    } finally {
      scroll.mockRestore()
    }
  })
})
