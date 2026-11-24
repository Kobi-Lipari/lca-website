// @vitest-environment jsdom
//
// Edges of the saved templates in the chooser on the newsletter's own page, beside
// test/unit/admin-newsletter-chooser.test.tsx, whose harness this file's is:
// - every new control a real button or field, reached by Tab in the order it is read (a saved row's "Use this", then its
//   Rename, then its Remove), the save opened, the name sent and the question answered from the keyboard alone;
// - a name of 60 characters holding an emoji written as two units, which the field must hold whole;
// - a name holding markup, drawn as the words it is and never as markup;
// - the chooser on a phone's width with saved templates: a sheet, each saved row's three controls there and named.
// jsdom does not move the focus on Tab by itself, so the order Tab takes is read from the dialog's tab stops in the order
// a browser takes them, and Enter on a field is the form's own submit. Every word, name and date here is made up.
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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
const COUNT_URL = '/api/admin/mail/newsletter'
const ISSUES_URL = '/api/admin/mail/newsletter/issues'
const TEMPLATES_URL = '/api/admin/mail/newsletter/templates'
const BODY = '<h2>Sample heading one</h2><p>Sample words one</p>'
const MONTH = 'December 2026'

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
let calls: string[] = []
let templateSaves: Array<Record<string, unknown>> = []
let templateRemoves: Array<Record<string, unknown>> = []
const on = (method: string, url: string, ...list: Answer[]) => {
  answers[`${method} ${url}`] = list
}
const letter = () => ({
  issue: { id: 'sample-letter-1', version: 3, monthLabel: MONTH, subject: defaultSubject(MONTH), preheader: '', bodyHtml: BODY, createdAt: '2026-11-13 15:00:00', updatedAt: '2026-11-13 20:15:00' },
  state: 'draft', lastSavedBy: 'Player Two', lastSavedAt: '2026-11-13 20:15:00',
})
const count = () => ({
  status: 200,
  body: { list: { id: 'lca-newsletter', name: 'LCA newsletter' }, from: 'x', sendsThrough: 'resend', summary: { addresses: 155, turnedOff: 0, stoppedAll: 0, doNotSend: 0, willGet: 155, recent: [], waits: null } },
})
const template = (extra: Record<string, unknown> = {}) => ({ id: 'sample-template-1', name: 'Sample club night', savedAt: '2026-11-24 15:00:00', by: 'Player', version: 1, ...extra })
const templates = (...list: unknown[]) => ({ status: 200, body: { templates: list } })

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
  calls = []
  templateSaves = []
  templateRemoves = []
  flags.mailLists = true
  flags.mailPage = true
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    if (method === 'POST' && url === TEMPLATES_URL) templateSaves.push(JSON.parse(String(init?.body)))
    if (method === 'DELETE' && url === TEMPLATES_URL) templateRemoves.push(JSON.parse(String(init?.body)))
    const list = answers[`${method} ${url}`]
    const answer = (list && list.length > 1 ? list.shift() : list?.[0]) ?? { status: 404, body: { error: 'Not found' } }
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: () => ({ cancel: () => {} }) as unknown as Animation,
  })
  on('GET', ISSUE_URL, { status: 200, body: letter() })
  on('GET', COUNT_URL, count())
  on('GET', ISSUES_URL, { status: 200, body: { issues: [] } })
  on('GET', TEMPLATES_URL, templates())
  on('PUT', ISSUE_URL, { status: 200, body: { id: 'sample-letter-1', version: 4, savedAt: '2026-11-16 20:20:00', bodyHtml: null } })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete (HTMLElement.prototype as { animate?: unknown }).animate
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
const focused = () => document.activeElement as HTMLElement
const theBar = () => screen.getByRole('region', { name: 'Pick, check and send' })
const pickWide = () => within(theBar()).getByRole('button', { name: '1 Pick a template to start from' })
const pickPhone = () => within(theBar()).getByRole('button', { name: 'Pick a template' })
const chooser = () => screen.getByRole('dialog', { name: 'Pick a template to start from' })
const nameField = () => within(chooser()).getByRole('textbox', { name: 'Template name' }) as HTMLInputElement
const nameOf = (element: Element) =>
  element.getAttribute('aria-label') ?? (element as HTMLInputElement).labels?.[0]?.textContent?.trim() ?? element.textContent?.trim() ?? ''
/** The dialog's tab stops in the order a browser's Tab takes them: real controls, not switched off, not taken out of the order. */
const tabStops = (root: HTMLElement) =>
  Array.from(root.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]')).filter(
    (element) => element.tabIndex >= 0 && !(element as HTMLButtonElement).disabled && element.closest('[inert]') === null,
  )
async function openFrom(step: HTMLElement) {
  act(() => step.focus())
  fireEvent.click(step)
  await settle()
  return chooser()
}

function windowAt(px: number) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      if (query === '(prefers-reduced-motion: reduce)') return false
      const line = /^\(min-width: (\d+)px\)$/.exec(query)
      return line !== null && px >= Number(line[1])
    },
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

describe('the saved templates by keyboard alone', () => {
  it('reaches each saved row\'s "Use this", Rename and Remove by Tab in that order, each a real button, after the starters and before the last newsletters', async () => {
    windowAt(1440)
    on('GET', TEMPLATES_URL, templates(
      template({ id: 'sample-template-2', name: 'Sample spring open', savedAt: '2026-11-24 15:00:00' }),
      template({ id: 'sample-template-1', name: 'Sample club night', savedAt: '2026-11-20 18:30:00' }),
    ))
    await thePage()
    const dialog = await openFrom(pickWide())
    const names = tabStops(dialog).map(nameOf)
    const from = names.indexOf('Use this: Short notice')
    expect(from).toBeGreaterThan(-1)
    expect(names.slice(from + 1, from + 7)).toEqual([
      'Use this: Sample spring open, saved Tue, Nov 24, 2026 by Player',
      'Rename: Sample spring open',
      'Remove: Sample spring open',
      'Use this: Sample club night, saved Fri, Nov 20, 2026 by Player',
      'Rename: Sample club night',
      'Remove: Sample club night',
    ])
    expect(names).toContain('Save this letter as a template')
    for (const label of names.filter((n) => /^(Rename|Remove): /.test(n)).concat('Save this letter as a template')) {
      const control = tabStops(dialog).find((element) => nameOf(element) === label)!
      expect(control.tagName, label).toBe('BUTTON')
      expect(control.getAttribute('type'), label).toBe('button')
    }
  })

  it('opens the save, takes the name and saves it by Enter in the field, with the field, Save template and Cancel next in Tab\'s order', async () => {
    windowAt(1440)
    const saving = template({ id: 'sample-template-9', name: 'Sample league night' })
    on('GET', TEMPLATES_URL, templates(), templates(saving))
    on('POST', TEMPLATES_URL, { status: 201, body: { template: saving } })
    await thePage()
    const dialog = await openFrom(pickWide())
    // A real button: Enter and Space press it in a browser, as a click.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save this letter as a template' }))
    expect(focused()).toBe(nameField())
    const names = tabStops(dialog).map(nameOf)
    const at = names.indexOf('Template name')
    expect(names.slice(at, at + 3)).toEqual(['Template name', 'Save template', 'Cancel'])
    fireEvent.change(nameField(), { target: { value: 'Sample league night' } })
    // Enter in a field of a form with a submit button sends the form.
    expect(nameField().form?.querySelector('button[type="submit"]')?.textContent).toBe('Save template')
    fireEvent.submit(nameField().form as HTMLFormElement)
    await settle()
    expect(templateSaves).toEqual([{ name: 'Sample league night', bodyHtml: BODY }])
    expect(focused().getAttribute('aria-label')).toBe('Use this: Sample league night, saved Tue, Nov 24, 2026 by Player')
  })

  it('answers the remove question from the keyboard: Keep it focused first, Tab going round its two buttons inside it, Remove it sending the remove', async () => {
    windowAt(1440)
    on('GET', TEMPLATES_URL, templates(template()), templates())
    on('DELETE', TEMPLATES_URL, { status: 200, body: { removed: true } })
    await thePage()
    const dialog = await openFrom(pickWide())
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove: Sample club night' }))
    await settle()
    const asked = screen.getByRole('alertdialog', { name: 'Remove this template?' })
    expect(focused().textContent).toBe('Keep it')
    expect(tabStops(asked).map(nameOf)).toEqual(['Keep it', 'Remove it'])
    fireEvent.click(within(asked).getByRole('button', { name: 'Remove it' }))
    await settle()
    expect(templateRemoves).toEqual([{ id: 'sample-template-1', version: 1 }])
  })
})

describe('a name holding an emoji written as two units', () => {
  it('fits the name field whole at 60 characters, as the server counts them, though it is 61 units', async () => {
    windowAt(1440)
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(within(chooser()).getByRole('button', { name: 'Save this letter as a template' }))
    const name = `${'S'.repeat(59)}\u{1F3C6}`
    expect(Array.from(name)).toHaveLength(60)
    expect(name.length).toBe(61)
    // A browser's maxLength counts units, so it stops the typing at 60 units: the last character could not be typed.
    const max = nameField().maxLength
    expect(max === -1 || max >= name.length).toBe(true)
  })
})

describe('a name holding markup', () => {
  it('is drawn as the words it is, in the row and in the name of its "Use this", never as markup', async () => {
    windowAt(1440)
    const words = '<b>Sample</b> <img src=x onerror=alert(1)>'
    on('GET', TEMPLATES_URL, templates(template({ name: words })))
    await thePage()
    const dialog = await openFrom(pickWide())
    expect(dialog.querySelector('b')).toBeNull()
    expect(dialog.querySelector('img')).toBeNull()
    expect(dialog.textContent).toContain(words)
    expect(within(dialog).getByRole('button', { name: `Use this: ${words}, saved Tue, Nov 24, 2026 by Player` })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: `Rename: ${words}` })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: `Remove: ${words}` })).toBeTruthy()
  })
})

describe('the chooser on a phone', () => {
  it('opens as a sheet from "Pick a template" with each saved row\'s "Use this", Rename and Remove there, named, in Tab\'s order, and the save', async () => {
    windowAt(390)
    on('GET', TEMPLATES_URL, templates(template()))
    await thePage()
    const dialog = await openFrom(pickPhone())
    expect(dialog.getAttribute('data-form')).toBe('sheet')
    const names = tabStops(dialog).map(nameOf)
    const at = names.indexOf('Use this: Sample club night, saved Tue, Nov 24, 2026 by Player')
    expect(at).toBeGreaterThan(-1)
    expect(names.slice(at, at + 3)).toEqual(['Use this: Sample club night, saved Tue, Nov 24, 2026 by Player', 'Rename: Sample club night', 'Remove: Sample club night'])
    expect(names).toContain('Save this letter as a template')
    // Each is held to 44 by 44 pixels below 1024 by its class (the size itself is measured on the stand).
    for (const label of ['Rename: Sample club night', 'Remove: Sample club night', 'Save this letter as a template']) {
      const control = within(dialog).getByRole('button', { name: label })
      expect(control.className, label).toMatch(/min-h-11|size-11|h-11/)
    }
  })
})

describe('mends after the review', () => {
  it('refuses a name over 60 characters on the page, counted as the server counts them, and sends nothing', async () => {
    windowAt(1440)
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(within(chooser()).getByRole('button', { name: 'Save this letter as a template' }))
    fireEvent.change(nameField(), { target: { value: `${'S'.repeat(60)}\u{1F3C6}` } })
    fireEvent.click(within(chooser()).getByRole('button', { name: 'Save template' }))
    await settle()
    expect(templateSaves).toEqual([])
    expect(within(chooser()).getAllByRole('alert').map((line) => line.textContent)).toContain("Keep the template's name to 60 characters.")
    expect(nameField().getAttribute('aria-invalid')).toBe('true')
    expect(focused()).toBe(nameField())
  })

  it('gives a saved row\'s name a width it is never squeezed under, so its buttons go below it on a phone', async () => {
    windowAt(390)
    on('GET', TEMPLATES_URL, templates(template()))
    await thePage()
    const dialog = await openFrom(pickPhone())
    const use = within(dialog).getByRole('button', { name: 'Use this: Sample club night, saved Tue, Nov 24, 2026 by Player' })
    const words = within(use.closest('li') as HTMLElement).getByText('Sample club night').parentElement as HTMLElement
    // The row wraps only when the name holds a floor; with none it shrinks to a letter wide (measured on the stand).
    expect(words.className).toMatch(/min-w-\[min\(100%,10rem\)\]/)
  })

  it('says the template is removed after "Remove it", and clears the words at the next step', async () => {
    windowAt(1440)
    on('GET', TEMPLATES_URL, templates(template()), templates())
    on('DELETE', TEMPLATES_URL, { status: 200, body: { removed: true } })
    await thePage()
    const dialog = await openFrom(pickWide())
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove: Sample club night' }))
    await settle()
    fireEvent.click(within(screen.getByRole('alertdialog', { name: 'Remove this template?' })).getByRole('button', { name: 'Remove it' }))
    await settle()
    expect(within(chooser()).getAllByRole('alert').map((line) => line.textContent)).toContain('Sample club night is removed.')
    fireEvent.click(within(chooser()).getByRole('button', { name: 'Save this letter as a template' }))
    expect(within(chooser()).getAllByRole('alert').map((line) => line.textContent)).not.toContain('Sample club night is removed.')
  })
})

describe('mends after the second review', () => {
  it('reads the saved templates again after a save refused because someone else saved the name, and draws theirs', async () => {
    windowAt(1440)
    on('GET', TEMPLATES_URL, templates(), templates(template()))
    on('POST', TEMPLATES_URL, { status: 409, body: { error: 'A template is already called Sample club night. Choose another name.' } })
    await thePage()
    const dialog = await openFrom(pickWide())
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save this letter as a template' }))
    fireEvent.change(nameField(), { target: { value: 'Sample club night' } })
    fireEvent.click(within(chooser()).getByRole('button', { name: 'Save template' }))
    await settle()
    expect(calls.filter((call) => call === `GET ${TEMPLATES_URL}`)).toHaveLength(2)
    expect(within(chooser()).getByRole('button', { name: /^Use this: Sample club night, saved / })).toBeTruthy()
    expect(within(chooser()).getAllByRole('alert').map((line) => line.textContent)).toContain('A template is already called Sample club night. Choose another name.')
    expect(focused()).toBe(nameField())
  })

  it('reads the saved templates again after a save whose answer was lost, since it may have been saved', async () => {
    windowAt(1440)
    on('GET', TEMPLATES_URL, templates(), templates(template()))
    await thePage()
    const real = globalThis.fetch as unknown as (url: string, init?: RequestInit) => Promise<Response>
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'POST' && url === TEMPLATES_URL) throw new TypeError('Failed to fetch')
      return real(url, init)
    }))
    const dialog = await openFrom(pickWide())
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save this letter as a template' }))
    fireEvent.change(nameField(), { target: { value: 'Sample club night' } })
    fireEvent.click(within(chooser()).getByRole('button', { name: 'Save template' }))
    await settle()
    expect(calls.filter((call) => call === `GET ${TEMPLATES_URL}`)).toHaveLength(2)
    expect(within(chooser()).getAllByRole('alert').map((line) => line.textContent)).toContain('The template could not be saved. Try again.')
    expect(focused()).toBe(nameField())
  })

  it('counts a name of 60 characters with a pasted hidden mark as the server does, and sends it', async () => {
    windowAt(1440)
    on('POST', TEMPLATES_URL, { status: 201, body: { template: template() } })
    await thePage()
    await openFrom(pickWide())
    fireEvent.click(within(chooser()).getByRole('button', { name: 'Save this letter as a template' }))
    fireEvent.change(nameField(), { target: { value: `${'S'.repeat(60)}\u200B` } })
    fireEvent.click(within(chooser()).getByRole('button', { name: 'Save template' }))
    await settle()
    expect(templateSaves).toHaveLength(1)
  })
})
