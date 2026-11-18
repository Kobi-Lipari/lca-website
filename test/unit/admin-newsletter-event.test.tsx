// @vitest-environment jsdom
//
// "Add an event" on the newsletter's own page, with src/App.tsx drawn whole and every call answered by a stand-in for
// fetch: the Add menu's two rows, "An event" and "A line", and the keys that move between them; the event's form,
// which takes the focus into its first field and gives it back to the Add button on Escape and on Cancel; each field it
// refuses, said in words beside it and tied to it, with the focus on the first; and the line, written at the caret the
// letter kept as a paragraph of its own, the caret after it, and the letter saved by itself. The editor's library
// measures text through browser APIs jsdom lacks; they are given stand-ins here, in this file only. Every word here is
// made up.
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
const BODY = '<h2>Sample heading one</h2><p>Sample words one</p><h2>Coming up</h2><p>Sample words two</p>'

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
  window.localStorage.setItem('lca-newsletter-page-help', 'shown') // Help has been seen once, so it does not open by itself here.
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
  on('PUT', ISSUE_URL, { status: 200, body: letter(BODY, 4) })
  on('GET', '/api/admin/mail/newsletter', { status: 200, body: { list: { id: 'lca-newsletter', name: 'LCA newsletter' }, from: 'x', sendsThrough: 'resend', summary: { addresses: 9, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 9, recent: [], waits: null } } })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
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
const key = (target: Element, name: string) => fireEvent.keyDown(target, { key: name })
const addButton = () => screen.getByRole('button', { name: /Add an event or line/ })

/** The Add menu opened and "An event" chosen: the form, open. */
async function theForm() {
  fireEvent.click(addButton())
  await act(async () => {
    fireEvent.click(screen.getByRole('menuitem', { name: 'An event' }))
  })
  return screen.getByRole('group', { name: 'Add an event' })
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe("the Add menu's two rows", () => {
  it('holds "An event" and then "A line", and the arrow keys, Home and End move between them', async () => {
    await thePage()
    fireEvent.click(addButton())
    const menu = screen.getByRole('menu', { name: 'Add' })
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['An event', 'A line'])
    expect(focused().textContent).toBe('An event')
    key(focused(), 'ArrowDown')
    expect(focused().textContent).toBe('A line')
    key(focused(), 'ArrowDown')
    expect(focused().textContent).toBe('An event')
    key(focused(), 'ArrowUp')
    expect(focused().textContent).toBe('A line')
    key(focused(), 'Home')
    expect(focused().textContent).toBe('An event')
    key(focused(), 'End')
    expect(focused().textContent).toBe('A line')
    key(focused(), 'Escape')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(focused()).toBe(addButton())
  })
})

describe("the event's form", () => {
  it('opens under the tools with the focus in its first field, and makes no part of the page inert', async () => {
    await thePage()
    const form = await theForm()
    expect(screen.queryByRole('menu')).toBeNull()
    expect(focused()).toBe(within(form).getByLabelText('Event name'))
    expect(within(form).getAllByRole('textbox').length + form.querySelectorAll('input[type="date"]').length).toBe(7)
    expect(document.querySelector('[inert]')).toBeNull()
    expect(within(form).getByLabelText('First day').getAttribute('type')).toBe('date')
    expect(within(form).getByLabelText('Last day').getAttribute('type')).toBe('date')
  })

  it('closes on Escape and on Cancel and gives the focus back to the Add button', async () => {
    await thePage()
    key(await theForm(), 'Escape')
    expect(screen.queryByRole('group', { name: 'Add an event' })).toBeNull()
    expect(focused()).toBe(addButton())
    const form = await theForm()
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('group', { name: 'Add an event' })).toBeNull()
    expect(focused()).toBe(addButton())
  })

  it('says each refused field in words beside it, tied to it, and puts the focus on the first', async () => {
    await thePage()
    const form = await theForm()
    type('Link address', 'register.sample.lca')
    fireEvent.click(within(form).getByRole('button', { name: 'Add the event' }))
    const name = within(form).getByLabelText('Event name')
    expect(focused()).toBe(name)
    const said = (label: string) => {
      const field = within(form).getByLabelText(label)
      expect(field.getAttribute('aria-invalid')).toBe('true')
      return document.getElementById(field.getAttribute('aria-describedby') ?? '')?.textContent
    }
    expect(said('Event name')).toBe("Write the event's name.")
    expect(said('First day')).toBe('Choose the first day.')
    expect(said('Link address')).toBe('The email cannot keep that address. Start it with https://, http:// or mailto: and leave out spaces and quote marks.')
    expect(said('Link words')).toBe("Write the link's words.")
    expect(editorOf().getHTML()).not.toContain('register.sample.lca')

    type('Event name', 'Sample Winter Open')
    type('First day', '2027-02-07')
    type('Last day', '2027-02-06')
    fireEvent.click(within(form).getByRole('button', { name: 'Add the event' }))
    expect(focused()).toBe(within(form).getByLabelText('Last day'))
    expect(said('Last day')).toBe('The last day is before the first day.')
    expect(within(form).getByLabelText('Event name').getAttribute('aria-invalid')).toBeNull()
  })
})

describe("the event's line", () => {
  it('goes in at the caret the letter kept, as its own paragraph, with the caret after it, and the letter saves', async () => {
    await thePage()
    const editor = editorOf()
    // The caret at the end of "Sample words one", the paragraph under the first heading.
    await act(async () => {
      editor.commands.focus()
      let end = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text === 'Sample words one') end = pos + node.nodeSize
      })
      editor.commands.setTextSelection(end)
    })
    const form = await theForm()
    type('Event name', 'Example Memorial')
    type('First day', '2027-02-06')
    type('Last day', '2027-02-07')
    type('Place', 'Anytown')
    type('Run by', 'Example Chess Club')
    type('Link address', 'https://club.sample.lca/memorial')
    type('Link words', "Details on the organizer's site")
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Add the event' }))
    })
    expect(screen.queryByRole('group', { name: 'Add an event' })).toBeNull()
    const line = '<p>Sat to Sun, Feb 6 to 7, 2027 · Example Memorial · Anytown · run by Example Chess Club · '
      + '<a href="https://club.sample.lca/memorial">Details on the organizer\'s site</a> ↗</p>'
    expect(editor.getHTML()).toBe(`<h2>Sample heading one</h2><p>Sample words one</p>${line}<h2>Coming up</h2><p>Sample words two</p>`)
    await waitFor(() => expect(editor.isFocused).toBe(true))
    // The caret sits after the line, in the letter.
    const { $from } = editor.state.selection
    expect($from.parent.textContent).toContain('Details on the organizer')
    expect($from.parentOffset).toBe($from.parent.content.size)
    await waitFor(() => expect(puts.length).toBeGreaterThan(0), { timeout: 5_000 })
    expect(String(puts.at(-1)?.bodyHtml)).toContain(line)
  })

  it('goes in after words chosen in the letter, never over them', async () => {
    await thePage()
    const editor = editorOf()
    await act(async () => {
      editor.commands.focus()
      let from = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text === 'Sample words one') from = pos
      })
      editor.commands.setTextSelection({ from, to: from + 'Sample words one'.length })
    })
    const form = await theForm()
    type('Event name', 'Sample Winter Open')
    type('First day', '2027-01-09')
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Add the event' }))
    })
    expect(editor.getHTML()).toBe(
      '<h2>Sample heading one</h2><p>Sample words one</p><p>Sat, Jan 9, 2027 · Sample Winter Open</p><h2>Coming up</h2><p>Sample words two</p>',
    )
  })

  it('goes in after a heading that holds the caret, never cutting it in two', async () => {
    await thePage()
    const editor = editorOf()
    await act(async () => {
      editor.commands.focus()
      let at = 0
      editor.state.doc.descendants((node, pos) => {
        if (node.isText && node.text === 'Sample heading one') at = pos + 'Sample'.length
      })
      editor.commands.setTextSelection(at)
    })
    const form = await theForm()
    type('Event name', 'Sample Winter Open')
    type('First day', '2027-01-09')
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Add the event' }))
    })
    expect(editor.getHTML()).toBe(
      '<h2>Sample heading one</h2><p>Sat, Jan 9, 2027 · Sample Winter Open</p><p>Sample words one</p><h2>Coming up</h2><p>Sample words two</p>',
    )
    const { $from } = editor.state.selection
    expect($from.parent.textContent).toBe('Sat, Jan 9, 2027 · Sample Winter Open')
    expect($from.parentOffset).toBe($from.parent.content.size)
  })

  it('makes an empty letter one that holds words, so the chooser asks before replacing it', async () => {
    on('GET', ISSUE_URL, { status: 200, body: letter('') })
    await thePage()
    const form = await theForm()
    type('Event name', 'Sample Winter Open')
    type('First day', '2027-01-09')
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Add the event' }))
    })
    // The empty letter's one empty paragraph is replaced, not left above the line.
    expect(editorOf().getHTML()).toBe('<p>Sat, Jan 9, 2027 · Sample Winter Open</p>')
    const bar = screen.getByRole('region', { name: 'Pick, check and send' })
    fireEvent.click(within(bar).getAllByRole('button', { name: /Pick a template/ })[0])
    await settle()
    const chooser = screen.getByRole('dialog', { name: 'Pick a template to start from' })
    fireEvent.click(within(chooser).getByRole('button', { name: 'Use this: Monthly newsletter' }))
    await settle()
    expect(screen.getByRole('alertdialog', { name: 'Replace this letter?' })).toBeTruthy()
  })

  it("stops the first step's wiggle on an empty letter once the line is written", async () => {
    const cancel = vi.fn()
    const played: Element[] = []
    // jsdom has no animations; this stand-in records the one the page asks for, as the chooser's tests do.
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      writable: true,
      value: function animate(this: HTMLElement) {
        played.push(this)
        return { cancel } as unknown as Animation
      },
    })
    try {
      on('GET', ISSUE_URL, { status: 200, body: letter('') })
      await thePage()
      await waitFor(() => expect(played).toHaveLength(1), { timeout: 5_000 })
      expect(cancel).not.toHaveBeenCalled()
      const form = await theForm()
      type('Event name', 'Sample Winter Open')
      type('First day', '2027-01-09')
      await act(async () => {
        fireEvent.click(within(form).getByRole('button', { name: 'Add the event' }))
      })
      await waitFor(() => expect(cancel).toHaveBeenCalled())
      expect(played).toHaveLength(1)
    } finally {
      delete (HTMLElement.prototype as { animate?: unknown }).animate
    }
  })

  it('writes a one-day line with no link, ending after its last part', async () => {
    await thePage()
    const form = await theForm()
    type('Event name', 'Sample Winter Open')
    type('First day', '2027-01-09')
    type('Place', 'Sample City')
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Add the event' }))
    })
    expect(editorOf().getHTML()).toContain('<p>Sat, Jan 9, 2027 · Sample Winter Open · Sample City</p>')
  })
})

/** The Add menu opened and "A line" chosen. */
async function aLine() {
  fireEvent.click(addButton())
  await act(async () => {
    fireEvent.click(screen.getByRole('menuitem', { name: 'A line' }))
  })
}
/** The caret, or a choice of words, put in the letter by the words it starts at, as a person would. */
async function choose(words: string, from = 0, to = from) {
  const editor = editorOf()
  await act(async () => {
    editor.commands.focus()
    let at = -1
    editor.state.doc.descendants((node, pos) => {
      if (node.isText && at < 0 && node.text?.includes(words)) at = pos + (node.text?.indexOf(words) ?? 0)
    })
    editor.commands.setTextSelection({ from: at + from, to: at + to })
  })
}
/** Where the caret is: the block that holds it, and whether it is in an empty paragraph after the rule. */
function caretAfterRule() {
  const { $from, empty } = editorOf().state.selection
  const before = $from.depth > 0 ? editorOf().state.doc.resolve($from.before(1)).nodeBefore : null
  return { empty, type: $from.parent.type.name, words: $from.parent.textContent, ruleBefore: before?.type.name === 'horizontalRule' }
}

describe('the Add menu\'s "A line"', () => {
  it('goes in after words chosen in the letter, never over them, with the caret in a paragraph after it', async () => {
    await thePage()
    await choose('Sample words one', 0, 'Sample words one'.length)
    await aLine()
    expect(editorOf().getHTML()).toBe(
      '<h2>Sample heading one</h2><p>Sample words one</p><hr><p></p><h2>Coming up</h2><p>Sample words two</p>',
    )
    expect(caretAfterRule()).toEqual({ empty: true, type: 'paragraph', words: '', ruleBefore: true })
    await waitFor(() => expect(puts.length).toBeGreaterThan(0), { timeout: 5_000 })
    expect(String(puts.at(-1)?.bodyHtml)).toContain('<p>Sample words one</p><hr>')
  })

  it('goes in after a heading that holds the caret, never cutting it in two', async () => {
    await thePage()
    await choose('Sample heading one', 'Sample'.length)
    await aLine()
    expect(editorOf().getHTML()).toBe(
      '<h2>Sample heading one</h2><hr><p></p><p>Sample words one</p><h2>Coming up</h2><p>Sample words two</p>',
    )
    expect(caretAfterRule()).toEqual({ empty: true, type: 'paragraph', words: '', ruleBefore: true })
  })

  it('goes in after the whole list when the caret is in one of its points', async () => {
    on('GET', ISSUE_URL, { status: 200, body: letter('<ul><li><p>Sample point one</p></li><li><p>Sample point two</p></li></ul><p>Sample words two</p>') })
    await thePage()
    await choose('Sample point one', 'Sample'.length)
    await aLine()
    expect(editorOf().getHTML()).toBe(
      '<ul><li><p>Sample point one</p></li><li><p>Sample point two</p></li></ul><hr><p></p><p>Sample words two</p>',
    )
    expect(caretAfterRule()).toEqual({ empty: true, type: 'paragraph', words: '', ruleBefore: true })
  })

  it('replaces the one empty paragraph of an empty letter, leaving a paragraph to type in after it', async () => {
    on('GET', ISSUE_URL, { status: 200, body: letter('') })
    await thePage()
    await act(async () => {
      editorOf().commands.focus()
    })
    await aLine()
    expect(editorOf().getHTML()).toBe('<hr><p></p>')
    expect(caretAfterRule()).toEqual({ empty: true, type: 'paragraph', words: '', ruleBefore: true })
  })

  it('is taken out whole by one Undo, with the chosen words as they were', async () => {
    await thePage()
    await choose('Sample words one', 0, 'Sample words one'.length)
    await aLine()
    expect(editorOf().getHTML()).toContain('<hr>')
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(editorOf().getHTML()).toBe(BODY)
  })
})

describe('what is easy to miss in the form', () => {
  it('closes on Escape from every field and every button, giving the focus back to the Add button', async () => {
    await thePage()
    const labels = ['Event name', 'First day', 'Last day', 'Place', 'Run by', 'Link address', 'Link words']
    for (const label of labels) {
      key(within(await theForm()).getByLabelText(label), 'Escape')
      expect(screen.queryByRole('group', { name: 'Add an event' })).toBeNull()
      expect(focused()).toBe(addButton())
    }
    for (const name of ['Add the event', 'Cancel']) {
      key(within(await theForm()).getByRole('button', { name }), 'Escape')
      expect(screen.queryByRole('group', { name: 'Add an event' })).toBeNull()
      expect(focused()).toBe(addButton())
    }
  })

  it('draws an edge round "Add the event" in forced colours, where its navy fill is taken away', async () => {
    await thePage()
    // A transparent border, unseen in the usual colours, which forced colours draw in the text's colour.
    const button = within(await theForm()).getByRole('button', { name: 'Add the event' })
    expect(button.className.split(' ')).toEqual(expect.arrayContaining(['border', 'border-transparent', 'bg-brand-navy']))
  })

  it('keeps the focus on the page when "An event" is chosen a second time while the form is open', async () => {
    await thePage()
    const form = await theForm()
    type('Event name', 'Sample Winter Open')
    await theForm()
    // One form, the words already typed kept, and the focus in it rather than lost with the menu.
    expect(screen.getAllByRole('group', { name: 'Add an event' })).toHaveLength(1)
    expect(within(form).getByLabelText('Event name')).toHaveProperty('value', 'Sample Winter Open')
    expect(focused()).not.toBe(document.body)
    expect(form.contains(focused())).toBe(true)
  })

  it('closes when Link is pressed, so only one thing is open under the tools', async () => {
    await thePage()
    await theForm()
    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    expect(screen.queryByRole('group', { name: 'Add an event' })).toBeNull()
    expect(screen.getByLabelText('Link address')).toBeTruthy()
  })

  it('keeps the words typed in the form when Link closes it, and empties them on Cancel', async () => {
    await thePage()
    await theForm()
    type('Event name', 'Sample Winter Open')
    type('Place', 'Sample City')
    fireEvent.click(screen.getByRole('button', { name: 'Link' }))
    key(focused(), 'Escape')
    let form = await theForm()
    expect(within(form).getByLabelText('Event name')).toHaveProperty('value', 'Sample Winter Open')
    expect(within(form).getByLabelText('Place')).toHaveProperty('value', 'Sample City')
    fireEvent.click(within(form).getByRole('button', { name: 'Cancel' }))
    form = await theForm()
    expect(within(form).getByLabelText('Event name')).toHaveProperty('value', '')
  })

  it('says the refusal aloud when the refused field holds the focus already', async () => {
    await thePage()
    const form = await theForm()
    const name = within(form).getByLabelText('Event name')
    key(name, 'Enter')
    expect(focused()).toBe(name)
    const why = document.getElementById(name.getAttribute('aria-describedby') ?? '')
    expect(why?.getAttribute('role')).toBe('alert')
    expect(why?.textContent).toBe("Write the event's name.")
    // Only the first refusal is said aloud; the others are read with their fields.
    expect(form.querySelectorAll('[role="alert"]')).toHaveLength(1)
  })

  it('draws its focus ring in forced colours and sizes its words in rem, so they grow with the text', async () => {
    await thePage()
    const form = await theForm()
    for (const control of form.querySelectorAll('input, button')) {
      // A transparent outline while focused, which forced colours draw; none at rest, so only the focus shows it.
      expect(control.className).toMatch(/focus-visible:outline-hidden\b/)
      expect(control.className).not.toMatch(/text-\[[\d.]+px\]/)
    }
    key(within(form).getByLabelText('Event name'), 'Enter')
    for (const why of form.querySelectorAll('p')) expect(why.className).not.toMatch(/text-\[[\d.]+px\]/)
  })

  it('adds the event on Enter in a field, from the keyboard alone', async () => {
    await thePage()
    const form = await theForm()
    type('Event name', 'Sample Winter Open')
    type('First day', '2027-01-09')
    await act(async () => {
      key(within(form).getByLabelText('First day'), 'Enter')
    })
    expect(screen.queryByRole('group', { name: 'Add an event' })).toBeNull()
    expect(editorOf().getHTML()).toContain('<p>Sat, Jan 9, 2027 · Sample Winter Open</p>')
  })

  it('runs its Tab order through the fields, then "Add the event", then "Cancel"', async () => {
    await thePage()
    const form = await theForm()
    const order = [...form.querySelectorAll<HTMLElement>('input, button')].map((el) =>
      el.tagName === 'BUTTON' ? el.textContent : (form.querySelector(`label[for="${el.id}"]`)?.textContent ?? ''))
    expect(order).toEqual(['Event name', 'First day', 'Last day', 'Place', 'Run by', 'Link address', 'Link words', 'Add the event', 'Cancel'])
    expect([...form.querySelectorAll('[tabindex]')].filter((el) => Number(el.getAttribute('tabindex')) > 0)).toHaveLength(0)
  })

  it('refuses a name of spaces alone, and puts nothing in the letter', async () => {
    await thePage()
    const before = editorOf().getHTML()
    const form = await theForm()
    type('Event name', '   ')
    type('First day', '2027-01-09')
    fireEvent.click(within(form).getByRole('button', { name: 'Add the event' }))
    expect(focused()).toBe(within(form).getByLabelText('Event name'))
    expect(document.getElementById(within(form).getByLabelText('Event name').getAttribute('aria-describedby') ?? '')?.textContent)
      .toBe("Write the event's name.")
    expect(editorOf().getHTML()).toBe(before)
  })

  it('puts markup characters and a very long name in as words, never as markup, and drops none', async () => {
    await thePage()
    const form = await theForm()
    const long = `Sample ${'Open '.repeat(60)}End`
    type('Event name', `<b>Sample</b> & "Co" ${long} ♞`)
    type('First day', '2027-01-09')
    type('Run by', "Example Chess Club's <i>team</i>")
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Add the event' }))
    })
    const html = editorOf().getHTML()
    expect(html).not.toContain('<b>')
    expect(html).not.toContain('<i>')
    const p = [...(document.querySelectorAll('.ProseMirror p'))].find((el) => el.textContent?.startsWith('Sat, Jan 9, 2027'))
    expect(p?.textContent).toBe(`Sat, Jan 9, 2027 · <b>Sample</b> & "Co" ${long} ♞ · run by Example Chess Club's <i>team</i>`)
  })
})

describe('a refusal of the save arriving after the line is written', () => {
  it('keeps the line in the letter when the save is refused for a lost sign-in', async () => {
    on('PUT', ISSUE_URL, { status: 401, body: { error: 'Sign in again.' } })
    await thePage()
    const form = await theForm()
    type('Event name', 'Sample Winter Open')
    type('First day', '2027-01-09')
    await act(async () => {
      fireEvent.click(within(form).getByRole('button', { name: 'Add the event' }))
    })
    await waitFor(() => expect(puts.length).toBeGreaterThan(0), { timeout: 5_000 })
    await settle(200)
    expect(editorOf().getHTML()).toContain('<p>Sat, Jan 9, 2027 · Sample Winter Open</p>')
  })
})
