// @vitest-environment jsdom
//
// The scoresheet scanner's page photos (src/pages/ScannerPage.tsx). Step 23
// moved their object URLs from state set in an effect to a small store read
// through useSyncExternalStore (a lint fix in a file the step touched). The
// visitor-facing behaviour must be what it was: each chosen page shows its
// photo, adding, removing and starting over show the right photos, and no
// URL is left behind. The same runs under StrictMode, which sets up and
// cleans up every effect an extra time when the page first mounts (before
// any photo is chosen, as the tool always starts with none).
//
// Every preview <img> must point at a URL that was made for its own file and
// not yet released, and once the page closes every URL made has been
// released. The version of the page before step 23 passes the same test.
import { StrictMode, type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { ScannerPage } = await import('@/pages/ScannerPage')

let made: string[] = []
let released: string[] = []
const realCreate = URL.createObjectURL
const realRevoke = URL.revokeObjectURL

beforeEach(() => {
  made = []
  released = []
  URL.createObjectURL = vi.fn((file: Blob) => {
    const url = `blob:fixture/${made.length + 1}-${(file as File).name}`
    made.push(url)
    return url
  })
  URL.revokeObjectURL = vi.fn((url: string) => {
    released.push(url)
  })
})

afterEach(() => {
  cleanup()
  URL.createObjectURL = realCreate
  URL.revokeObjectURL = realRevoke
})

const member = { user: { id: 'fx-m-p1' }, member: { id: 'fx-m-p1', role: 'member' }, session: null, role: 'member', loading: false } as unknown as AuthContextValue

function show(strict: boolean) {
  const page: ReactNode = (
    <AuthContext.Provider value={member}>
      <MemoryRouter initialEntries={['/scanner']}>
        <ScannerPage />
      </MemoryRouter>
    </AuthContext.Provider>
  )
  return render(strict ? <StrictMode>{page}</StrictMode> : page)
}

const photo = (name: string) => new File(['fixture image bytes'], name, { type: 'image/jpeg' })

/** Chooses a photo with the last "Choose ..." file input on the page (the library one). */
function choose(container: HTMLElement, file: File) {
  const inputs = [...container.querySelectorAll<HTMLInputElement>('input[type="file"]:not([capture])')]
  expect(inputs.length, 'a photo library input').toBeGreaterThan(0)
  fireEvent.change(inputs[inputs.length - 1], { target: { files: [file] } })
}

/** The src of every preview photo, in page order. */
const previews = () => screen.queryAllByRole('img').map((img) => img.getAttribute('src') ?? '')

/** Each preview shows a URL that was made for its own file and is not yet released. */
function expectLive(names: string[]) {
  const shown = previews()
  expect(shown).toHaveLength(names.length)
  shown.forEach((url, i) => {
    expect(made, url).toContain(url)
    expect(released, `${url} was released while still shown`).not.toContain(url)
    expect(url.endsWith(`-${names[i]}`), `${url} shows ${names[i]}`).toBe(true)
  })
}

describe.each([
  ['', false],
  [' under StrictMode', true],
])('the scanner page photos%s', (_, strict) => {
  it('shows each chosen page, follows adding, removing and starting over, and releases every URL it made', () => {
    const { container, unmount } = show(strict)
    expect(made).toEqual([])

    choose(container, photo('front.jpg'))
    expectLive(['front.jpg'])
    expect(screen.getByRole('img', { name: 'Your scoresheet' })).toBeTruthy()

    choose(container, photo('back.jpg'))
    expectLive(['front.jpg', 'back.jpg'])
    expect(screen.getByRole('img', { name: 'Page 2 of your scoresheet' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Remove page 1' }))
    expectLive(['back.jpg'])

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }))
    expectLive([])
    expect(screen.getByRole('heading', { name: 'Add a photo of your scoresheet' })).toBeTruthy()

    choose(container, photo('again.jpg'))
    expectLive(['again.jpg'])

    unmount()
    expect(made.length).toBeGreaterThan(0)
    expect(made.filter((url) => !released.includes(url)), 'URLs never released').toEqual([])
  })

  it('makes no URL while no photo is chosen, and releases the one it made when the page closes', () => {
    const { container, unmount } = show(strict)
    expect(made).toEqual([])
    choose(container, photo('only.jpg'))
    expectLive(['only.jpg'])
    unmount()
    expect(made.filter((url) => !released.includes(url))).toEqual([])
  })
})
