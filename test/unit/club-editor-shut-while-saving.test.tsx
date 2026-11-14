// @vitest-environment jsdom
//
// What the club editor's controls do while a save runs, and in an observer's
// shut form (WS09 step 9), beside test/unit/club-editor.test.tsx: the
// region's list, both pins' boxes and buttons, Remove place 2 and Add
// another place are marked aria-disabled while a save runs and never
// disabled, so a press held for the logo's upload that starts its save while
// one of them has the focus does not drop the focus to the page; each
// refuses its press, its key and its value, wears the faded look by the
// aria-disabled classes, is a plain control again when the save ends, and is
// truly disabled only inside the observer's shut fieldset. Every name,
// address and club here is made up.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { clubSaveServer } from './helpers/clubSaveServer'

vi.setConfig({ testTimeout: 15000 })

const flags = vi.hoisted(() => ({ clubKeepers: true, clubEmailHidden: true, newClubs: false, newLook: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: new Proxy(real.FEATURES, {
      get: (target, key) => (typeof key === 'string' && key in flags ? flags[key as keyof typeof flags] : Reflect.get(target, key)),
    }),
  }
})
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }) } },
}))
vi.mock('@/lib/resizeImage', () => ({ resizeImageToFit: async () => new Blob(['example'], { type: 'image/jpeg' }) }))

const { AdminClubPage } = await import('@/pages/AdminClubPage')

const ID = 'example-chess-club'
const CLUB_URL = `/api/admin/clubs/${ID}`
const CLUB = {
  id: ID, name: 'Example Chess Club', city: 'Example City', location: 'Example Library, 1 Example Street',
  description: 'A friendly made-up club.', meeting_schedule: 'Tuesdays at 7:00 PM', contact_email: 'club@example.org',
  created_at: '2026-01-01 12:00:00', color: '#1f4e79', image_url: null, region: 'Bayou Region', latitude: 30.1, longitude: -91.2,
  slug: 'example-chess', about_text: 'A friendly made-up club.', how_we_meet_text: 'Tuesdays at 7:00 PM',
  cost_text: null, welcome_text: null, weekend_play: 0, scholastic_friendly: 0, contact_name_public: 'Player One', facebook_url: null,
  website_url: null, other_url: null, told_updated_at: null, told_by: null, last_confirmed_at: null, confirmed_by: null,
}
const PLACE_1 = { id: 1, name: 'Example Library', street: '1 Example Street', note: 'Room B', latitude: 30.1, longitude: -91.2 }
const PLACE_2 = { id: 2, name: 'Example Hall', street: null, note: 'Saturdays only', latitude: 30.3, longitude: -91.4 }
const REST = { officers: [], roster: [], tournaments: [] }

type Answer = (body: unknown) => Response | Promise<Response>
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let seen: Array<{ call: string; body: unknown }> = []
let routes: Record<string, Answer> = {}

function serve(places: Array<Record<string, unknown>>) {
  const server = clubSaveServer(CLUB, places)
  routes = {
    [`GET ${CLUB_URL}`]: () => json({ club: CLUB, ...REST, places }),
    [`GET ${CLUB_URL}/news`]: () => json({ news: [] }),
    [`PATCH ${CLUB_URL}`]: (body) => json(server.patch(body as Record<string, unknown>)),
  }
  return server
}

beforeEach(() => {
  Object.assign(flags, { clubKeepers: true, clubEmailHidden: true, newClubs: false, newLook: false })
  window.localStorage.clear()
  seen = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body
    seen.push({ call, body })
    const route = routes[call]
    return route ? route(body) : json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function openEditor(role: 'lca_admin' | 'lca_observer' = 'lca_admin'): Promise<HTMLFormElement> {
  const auth = {
    user: { id: 'm-1' }, member: { id: 'm-1', role, club_id: null, full_name: 'Player Two' }, session: null, role,
    loading: false, memberLoading: false, seats: [], managedClubs: [], directedTournamentIds: [], directedTournaments: [], refreshMember: async () => {},
  } as unknown as AuthContextValue
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[`/admin/clubs/${ID}`]}>
        <Routes><Route path="/admin/clubs/:id" element={<AdminClubPage />} /></Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  const save = await screen.findByRole('button', { name: 'Save and publish' }, { timeout: 5000 })
  await act(async () => {})
  return save.closest('form') as HTMLFormElement
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement
const press = () => fireEvent.click(screen.getByRole('button', { name: /^(Save and publish|Saving…)$/ }))
const calls = () => seen.map((s) => s.call).filter((c) => !c.startsWith('GET '))
const status = () => screen.getByRole('status')
const saved = () => within(status()).findByText(/^Saved/)
const SHUT = ['aria-disabled:cursor-not-allowed', 'aria-disabled:opacity-50']

/** Starts a save that is still running: a press held for the logo's upload starts its save when the upload ends. */
async function saveRunning(server: ReturnType<typeof serve>) {
  let finishLogo: (r: Response) => void = () => {}
  let finishSave: (r: Response) => void = () => {}
  let sent: Record<string, unknown> = {}
  routes[`POST ${CLUB_URL}/logo`] = () => new Promise<Response>((done) => { finishLogo = done })
  routes[`PATCH ${CLUB_URL}`] = (body) => {
    sent = body as Record<string, unknown>
    return new Promise<Response>((done) => { finishSave = done })
  }
  fireEvent.change(field('Logo'), { target: { files: [new File(['example'], 'logo.png', { type: 'image/png' })] } })
  await waitFor(() => expect(calls()).toEqual([`POST ${CLUB_URL}/logo`]))
  press()
  return {
    startSave: async () => {
      await act(async () => finishLogo(json({ imageUrl: `/api/clubs/${ID}/logo?v=7` })))
      await waitFor(() => expect(calls()).toEqual([`POST ${CLUB_URL}/logo`, `PATCH ${CLUB_URL}`]))
    },
    endSave: async () => {
      await act(async () => finishSave(json(server.patch(sent))))
      await saved()
    },
  }
}

describe('the club editor while a save runs: the controls that keep the focus', () => {
  it('draws every one of them plain when no save is running: enabled, with no aria-disabled mark, in an LCA admin\'s form', async () => {
    serve([PLACE_1, PLACE_2])
    const form = await openEditor()
    const controls = [
      screen.getByLabelText('Region'), field('Pin: coordinates or a Google Maps link'), field('Pin for place 2: coordinates or a Google Maps link'),
      ...screen.getAllByRole('button', { name: /^Remove pin/ }), screen.getByRole('button', { name: 'Remove place 2' }),
    ]
    expect(controls).toHaveLength(6)
    for (const control of controls) {
      expect(control.hasAttribute('disabled'), control.outerHTML).toBe(false)
      expect(control.hasAttribute('aria-disabled'), control.outerHTML).toBe(false)
    }
    expect(within(form).queryByRole('button', { name: 'Add another place' })).toBeNull()
  })

  it('wears the faded look by the aria-disabled classes: the region\'s list, the pins\' boxes and each button', async () => {
    serve([PLACE_1, PLACE_2])
    await openEditor()
    const controls = [
      screen.getByLabelText('Region'), field('Pin: coordinates or a Google Maps link'), field('Pin for place 2: coordinates or a Google Maps link'),
      ...screen.getAllByRole('button', { name: /^(Remove pin|Use this)/ }), screen.getByRole('button', { name: 'Remove place 2' }),
    ]
    for (const control of controls) {
      for (const name of SHUT) expect(control.className, `${control.id || control.textContent} ${name}`).toContain(name)
    }
  })

  it('both pins and both pins\' buttons keep the focus while the save runs, and each press, Enter and typed value is refused until it ends', async () => {
    const server = serve([PLACE_1, PLACE_2])
    await openEditor()
    // Words in the first pin's box, so that its Use this is a live button (with an empty box it is disabled, as it always was).
    fireEvent.change(field('Pin: coordinates or a Google Maps link'), { target: { value: '30.5, -91.5' } })
    const run = await saveRunning(server)
    await run.startSave()
    const pinLine = (place?: string) => screen.getByText(new RegExp(`^Pin${place ? ` for ${place}` : ''} at `)).textContent
    const before = [pinLine(), pinLine('place 2')]
    for (const [label, held] of [['Pin: coordinates or a Google Maps link', '30.5, -91.5'], ['Pin for place 2: coordinates or a Google Maps link', '']] as const) {
      const box = field(label)
      box.focus()
      expect([box.disabled, box.readOnly, box.getAttribute('aria-disabled')], label).toEqual([false, true, 'true'])
      fireEvent.change(box, { target: { value: '31.0, -92.0' } })
      expect(box.value, label).toBe(held)
      expect(fireEvent.keyDown(box, { key: 'Enter' }), label).toBe(false)
      expect(document.activeElement, label).toBe(box)
    }
    const buttons = [...screen.getAllByRole('button', { name: /^Remove pin/ }), screen.getByRole('button', { name: 'Use this' })] as HTMLButtonElement[]
    expect(buttons).toHaveLength(3)
    for (const button of buttons) {
      button.focus()
      expect(button.disabled, button.textContent ?? '').toBe(false)
      expect(button.getAttribute('aria-disabled'), button.textContent ?? '').toBe('true')
      fireEvent.click(button)
      expect(document.activeElement, button.textContent ?? '').toBe(button)
    }
    expect([pinLine(), pinLine('place 2')]).toEqual(before)
    await run.endSave()
    // The pins' pickers are drawn afresh after a save; each box and button is plain again.
    for (const control of [field('Pin: coordinates or a Google Maps link'), ...screen.getAllByRole('button', { name: /^Remove pin/ })]) {
      expect(control.hasAttribute('aria-disabled'), control.outerHTML).toBe(false)
    }
    expect(calls().filter((call) => call.startsWith('PATCH'))).toHaveLength(1)
  })

  it('keeps the focus on Add another place when the save starts, refuses its press, and takes it again once the save ends', async () => {
    const server = serve([PLACE_1])
    const form = await openEditor()
    expect(within(form).queryByLabelText('Place 2 name')).toBeNull()
    const run = await saveRunning(server)
    const add = screen.getByRole('button', { name: 'Add another place' }) as HTMLButtonElement
    add.focus()
    await run.startSave()
    expect(document.activeElement).toBe(add)
    expect([add.disabled, add.getAttribute('aria-disabled')]).toEqual([false, 'true'])
    for (const name of SHUT) expect(add.className).toContain(name)
    // A click, which is what Enter and Space reach a button as, adds no place and moves no focus.
    fireEvent.keyDown(add, { key: 'Enter' })
    fireEvent.click(add)
    fireEvent.keyDown(add, { key: ' ' })
    fireEvent.click(add)
    expect(within(form).queryByLabelText('Place 2 name')).toBeNull()
    expect(document.activeElement).toBe(add)
    await run.endSave()
    expect(add.hasAttribute('aria-disabled')).toBe(false)
    expect(document.activeElement).toBe(add)
    fireEvent.click(add)
    expect(within(form).getByLabelText('Place 2 name')).toBeTruthy()
    expect(document.activeElement).toBe(within(form).getByLabelText('Place 2 name'))
  })

  it('refuses a change of the region from the keys and the list while the save runs, and the save sends the region it was pressed with', async () => {
    const server = serve([PLACE_1])
    await openEditor()
    const run = await saveRunning(server)
    const region = screen.getByLabelText('Region') as HTMLSelectElement
    region.focus()
    await run.startSave()
    expect(document.activeElement).toBe(region)
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' ', 'N', 'F4']) {
      expect(fireEvent.keyDown(region, { key }), key).toBe(false)
    }
    expect(fireEvent.keyDown(region, { key: 'Tab' })).toBe(true)
    expect(fireEvent.mouseDown(region)).toBe(false)
    fireEvent.change(region, { target: { value: 'North Louisiana' } })
    expect(region.value).toBe('Bayou Region')
    await run.endSave()
    const patches = seen.filter((s) => s.call === `PATCH ${CLUB_URL}`)
    expect(patches).toHaveLength(1)
    expect((patches[0].body as { region: string }).region).toBe('Bayou Region')
    // Plain again, the list takes a choice, which the next press would send.
    expect(region.hasAttribute('aria-disabled')).toBe(false)
    expect(fireEvent.mouseDown(region)).toBe(true)
    expect(fireEvent.keyDown(region, { key: 'ArrowDown' })).toBe(true)
    fireEvent.change(region, { target: { value: 'North Louisiana' } })
    expect(region.value).toBe('North Louisiana')
  })
})

describe('the club editor in an observer\'s shut form', () => {
  it('truly disables each of them, the buttons as well as the boxes, and marks none aria-disabled', async () => {
    serve([PLACE_1, PLACE_2])
    const form = await openEditor('lca_observer')
    const controls = [
      screen.getByLabelText('Region'), field('Pin: coordinates or a Google Maps link'), field('Pin for place 2: coordinates or a Google Maps link'),
      ...screen.getAllByRole('button', { name: /^Remove pin/ }), screen.getByRole('button', { name: 'Remove place 2' }),
    ]
    for (const control of controls) {
      expect(control.matches(':disabled'), control.outerHTML).toBe(true)
      expect(control.hasAttribute('aria-disabled'), control.outerHTML).toBe(false)
    }
    // Help's buttons stay open to an observer; every other button of the form is shut.
    const help = screen.getByRole('button', { name: 'Help' })
    expect(help.matches(':disabled')).toBe(false)
    const others = [...form.querySelectorAll('button')].filter((button) => button !== help && !/help/i.test(button.textContent ?? ''))
    expect(others.length).toBeGreaterThanOrEqual(4)
    for (const button of others) expect(button.matches(':disabled'), button.textContent ?? '').toBe(true)
  })

  it('truly disables Add another place for an observer when the club has one place', async () => {
    serve([PLACE_1])
    await openEditor('lca_observer')
    const add = screen.getByRole('button', { name: 'Add another place' })
    expect(add.matches(':disabled')).toBe(true)
    expect(add.hasAttribute('aria-disabled')).toBe(false)
    fireEvent.click(add)
    expect(screen.queryByLabelText('Place 2 name')).toBeNull()
  })
})
