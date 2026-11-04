// @vitest-environment jsdom
//
// The contact page's board seat at the edges the tests of WS02 step 9 leave
// (src/pages/ContactPage.tsx): with the chrome on (newNav and newLook), a
// new address while the page stays, as a footer link pressed on it, resets
// the seat from that address's own ?to= and fills the subject when it names
// one. Drawn under a router with links to other addresses on the same page,
// the page's own address set as a browser's would be, two board seats from a
// stand-in for the seats' list, and the sending stood in for:
//
// - the person's own name, email and message kept through a new address;
// - a seat picked in the Send to list kept through a press of a link to the
//   very address the page is at, which is no new address, and reset by one;
// - an address that names a seat and a subject sets both, and one that
//   names a seat the board does not have leaves the list on General inquiry;
// - a new address while the thanks for a sent message shows sets the seat
//   the next message goes to.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const flags = vi.hoisted(() => ({ newLook: true, newNav: true }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get newLook() {
        return flags.newLook
      },
      get newNav() {
        return flags.newNav
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
/** What the page sent, each message as the page handed it over. */
const sent = vi.hoisted(() => ({ messages: [] as unknown[] }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  getBoardSeats: async () => [
    { id: 's1', slug: 'president', role: 'President', category: 'officer', sort_order: 1, is_shared: 0, holder_name: 'Fixture Holder', holder_count: 1 },
    { id: 's2', slug: 'treasurer', role: 'Treasurer', category: 'officer', sort_order: 2, is_shared: 0, holder_name: 'Fixture Keeper', holder_count: 1 },
  ],
  submitContact: async (form: unknown) => {
    sent.messages.push(form)
    return {}
  },
}))

const { ContactPage } = await import('@/pages/ContactPage')

/** The contact page at an address, the page's own address set to it as a browser's would be, with links to other addresses on the same page. */
async function drawAt(path: string) {
  window.history.replaceState(null, '', path)
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/contact" element={<ContactPage />} />
      </Routes>
      <Link to="/contact?to=president">to the president</Link>
      <Link to="/contact?to=treasurer">to the treasurer</Link>
      <Link to="/contact?to=treasurer&subject=membership">to the treasurer about membership</Link>
      <Link to="/contact?to=nobody">to a seat the board does not have</Link>
      <Link to="/contact">to the contact page alone</Link>
    </MemoryRouter>,
  )
  await screen.findByRole('option', { name: /Treasurer/ })
}
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement
const seat = () => (screen.getByLabelText('Send to') as HTMLSelectElement).value
const press = (words: string) => fireEvent.click(screen.getByText(words))

beforeEach(() => {
  Object.assign(flags, { newLook: true, newNav: true })
  sent.messages = []
})
afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('the contact page\'s seat with the chrome on, at its edges', () => {
  it('keeps the person\'s own name, email and message through a new address that resets the seat', async () => {
    await drawAt('/contact?to=president')
    fireEvent.change(field('Name'), { target: { value: 'Fixture Writer' } })
    fireEvent.change(field('Email'), { target: { value: 'writer@example.org' } })
    fireEvent.change(field('Message'), { target: { value: 'A question for the board.' } })
    press('to the treasurer')
    expect(seat()).toBe('treasurer')
    expect([field('Name').value, field('Email').value, field('Message').value, field('Subject').value]).toEqual(['Fixture Writer', 'writer@example.org', 'A question for the board.', ''])
    expect(screen.getByText('Your message will go to the Treasurer.')).toBeTruthy()
  })

  it('keeps a seat picked in the Send to list through a press of a link to the very address the page is at, and resets it at a new one', async () => {
    await drawAt('/contact?to=president')
    fireEvent.change(screen.getByLabelText('Send to'), { target: { value: 'treasurer' } })
    expect(seat()).toBe('treasurer')
    press('to the president')
    expect(seat()).toBe('treasurer')
    press('to the contact page alone')
    expect(seat()).toBe('')
    expect(screen.getByText('Reach the board, or ask a general question.')).toBeTruthy()
  })

  it('sets both the seat and the subject from an address that names both, and leaves the list on General inquiry for a seat the board does not have', async () => {
    await drawAt('/contact')
    expect(seat()).toBe('')
    press('to the treasurer about membership')
    expect([seat(), field('Subject').value]).toEqual(['treasurer', 'Membership help'])
    press('to a seat the board does not have')
    expect(seat()).toBe('')
    expect(screen.getByText('Reach the board, or ask a general question.')).toBeTruthy()
    // That address names no subject, so the subject the last one filled stays.
    expect(field('Subject').value).toBe('Membership help')
  })

  it('sends a message to the seat the address named, and sets the next message\'s seat from a new address while the thanks shows', async () => {
    await drawAt('/contact?to=president')
    fireEvent.change(field('Name'), { target: { value: 'Fixture Writer' } })
    fireEvent.change(field('Email'), { target: { value: 'writer@example.org' } })
    fireEvent.change(field('Subject'), { target: { value: 'Fixture subject' } })
    fireEvent.change(field('Message'), { target: { value: 'A question for the president.' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Send message' }).closest('form')!)
    await screen.findByText('Message sent')
    expect(sent.messages).toEqual([{ name: 'Fixture Writer', email: 'writer@example.org', subject: 'Fixture subject', body: 'A question for the president.', seatRef: 'president' }])
    press('to the treasurer')
    fireEvent.click(screen.getByRole('button', { name: 'Send another message' }))
    await waitFor(() => expect(seat()).toBe('treasurer'))
    // The form was emptied once the message was sent; only the seat the new address names is filled.
    expect([field('Name').value, field('Email').value, field('Subject').value, field('Message').value]).toEqual(['', '', '', ''])
  })
})
