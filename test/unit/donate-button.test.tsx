// @vitest-environment jsdom
//
// The donation dialog, src/components/DonateButton.tsx, which the new
// header opens from Donate until the Give page exists (WS02 step 5):
//
// - an amount and "Continue to payment" ask for the checkout once and hand
//   the donor to the payment address in the same tab, never in a new
//   window, which phones block once the network has been waited on; the
//   dialog stays as it is, saying "Starting checkout…", until the page has
//   gone, and gives the button back if the browser brings the page back;
// - the hand-off is window.location.assign unless a caller hands in its
//   own, which is how these cases watch it, since jsdom lets nothing stand
//   in for the window's location;
// - an amount under $1 and a failed checkout hand off nothing;
// - a donor who closes the dialog while the checkout is asked for, with Esc
//   or its close button, is sent nowhere when the answer comes, and finds
//   the button theirs again, with no message, when they open it again; the
//   same when the dialog leaves the page while the checkout is asked for;
// - DonateButton is the dialog with today's trigger, an outline button with
//   the heart and the word Donate.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ createDonationCheckout: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { DonateButton, DonateDialog } = await import('@/components/DonateButton')

const ROOT = join(__dirname, '../..')
const PAYMENT = 'https://checkout.stripe.example/c/pay/fx-donation'
const TITLE = 'Support the Louisiana Chess Association'

/** The dialog, open, with a hand-off the test watches. */
function Open({ handOff }: { handOff: (url: string) => void }) {
  const [open, setOpen] = useState(true)
  return <DonateDialog open={open} onOpenChange={setOpen} handOff={handOff} />
}

/** The dialog behind a trigger of its own, so a case can close it and open it again, with a hand-off the test watches. */
function Reopenable({ handOff }: { handOff: (url: string) => void }) {
  const [open, setOpen] = useState(false)
  return <DonateDialog open={open} onOpenChange={setOpen} handOff={handOff} trigger={<button type="button">Give</button>} />
}

/** A checkout the case answers when it chooses. */
function heldCheckout() {
  let answer!: (checkout: { paymentId: string; paymentUrl: string }) => void
  let fail!: (reason: unknown) => void
  api.createDonationCheckout.mockReturnValueOnce(
    new Promise((resolve, reject) => {
      answer = resolve
      fail = reject
    }),
  )
  return { answer: (checkout: { paymentId: string; paymentUrl: string }) => answer(checkout), fail: (reason: unknown) => fail(reason) }
}

const amount = () => screen.getByLabelText('Amount (USD)')
const pay = () => screen.getByRole('button', { name: /Continue to payment|Starting checkout…/ })

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  api.createDonationCheckout.mockReset()
})

describe('the donation dialog', () => {
  it('asks for the checkout once and hands the donor to it in the same tab, never in a new window, and stays on "Starting checkout…"', async () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null)
    const handOff = vi.fn()
    api.createDonationCheckout.mockResolvedValue({ paymentId: 'fx-pay-1', paymentUrl: PAYMENT })
    render(<Open handOff={handOff} />)
    fireEvent.change(amount(), { target: { value: '25' } })
    fireEvent.click(pay())
    await waitFor(() => expect(handOff).toHaveBeenCalledTimes(1))
    expect(handOff).toHaveBeenCalledWith(PAYMENT)
    expect(api.createDonationCheckout).toHaveBeenCalledTimes(1)
    expect(api.createDonationCheckout).toHaveBeenCalledWith(25)
    expect(opened).not.toHaveBeenCalled()
    // Nothing closes or resets: the page is on its way to the checkout.
    expect(screen.getByRole('dialog', { name: TITLE })).toBeTruthy()
    expect(pay().textContent).toBe('Starting checkout…')
    expect((pay() as HTMLButtonElement).disabled).toBe(true)
    expect((amount() as HTMLInputElement).value).toBe('25')
  })

  it('gives the button back when the browser brings the page back from its history', async () => {
    api.createDonationCheckout.mockResolvedValue({ paymentId: 'fx-pay-2', paymentUrl: PAYMENT })
    const handOff = vi.fn()
    render(<Open handOff={handOff} />)
    fireEvent.change(amount(), { target: { value: '40' } })
    fireEvent.click(pay())
    await waitFor(() => expect(handOff).toHaveBeenCalledTimes(1))
    expect(pay().textContent).toBe('Starting checkout…')
    // A page shown fresh changes nothing; one restored as it was gives the button back.
    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }))
    })
    expect(pay().textContent).toBe('Starting checkout…')
    act(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
    })
    expect(pay().textContent).toBe('Continue to payment')
    expect((pay() as HTMLButtonElement).disabled).toBe(false)
  })

  it.each([
    ['no amount', ''],
    ['an amount under $1', '0.5'],
    ['nothing a number', 'abc'],
  ])('with %s, says so and asks for nothing', (_, value) => {
    const handOff = vi.fn()
    render(<Open handOff={handOff} />)
    fireEvent.change(amount(), { target: { value } })
    fireEvent.click(pay())
    expect(screen.getByText('Please enter an amount of at least $1')).toBeTruthy()
    expect(api.createDonationCheckout).not.toHaveBeenCalled()
    expect(handOff).not.toHaveBeenCalled()
  })

  it('shows a failed checkout\'s message, hands off nothing and gives the button back', async () => {
    api.createDonationCheckout.mockRejectedValue(new Error('Online payments are not set up yet.'))
    const handOff = vi.fn()
    render(<Open handOff={handOff} />)
    fireEvent.change(amount(), { target: { value: '10' } })
    fireEvent.click(pay())
    await screen.findByText('Online payments are not set up yet.')
    expect(handOff).not.toHaveBeenCalled()
    expect(pay().textContent).toBe('Continue to payment')
    expect((pay() as HTMLButtonElement).disabled).toBe(false)
  })

  it.each([
    ['answers with the payment page', 'Esc', true],
    ['answers with the payment page', 'its close button', true],
    ['fails', 'Esc', false],
  ] as const)('when the checkout %s after the donor closed the dialog with %s, sends them nowhere, and opened again the dialog gives the button back with no message', async (_, how, answers) => {
    const held = heldCheckout()
    const handOff = vi.fn()
    render(<Reopenable handOff={handOff} />)
    fireEvent.click(screen.getByRole('button', { name: 'Give' }))
    fireEvent.change(amount(), { target: { value: '25' } })
    fireEvent.click(pay())
    expect(pay().textContent).toBe('Starting checkout…')
    // The donor changes their mind while the checkout is asked for.
    const dialog = screen.getByRole('dialog', { name: TITLE })
    if (how === 'Esc') fireEvent.keyDown(dialog, { key: 'Escape' })
    else fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await act(async () => {
      if (answers) held.answer({ paymentId: 'fx-pay-dropped', paymentUrl: PAYMENT })
      else held.fail(new Error('Online payments are not set up yet.'))
    })
    expect(handOff).not.toHaveBeenCalled()
    // Opened again: the amount as they left it, the button theirs and no message.
    fireEvent.click(screen.getByRole('button', { name: 'Give' }))
    expect((amount() as HTMLInputElement).value).toBe('25')
    expect(pay().textContent).toBe('Continue to payment')
    expect((pay() as HTMLButtonElement).disabled).toBe(false)
    expect(screen.queryByText('Online payments are not set up yet.')).toBeNull()
    // A new press asks again and, answered, hands the donor off once.
    api.createDonationCheckout.mockResolvedValueOnce({ paymentId: 'fx-pay-again', paymentUrl: PAYMENT })
    fireEvent.click(pay())
    await waitFor(() => expect(handOff).toHaveBeenCalledTimes(1))
    expect(handOff).toHaveBeenCalledWith(PAYMENT)
    expect(api.createDonationCheckout).toHaveBeenCalledTimes(2)
  })

  it('sends the donor nowhere when the dialog leaves the page while the checkout is asked for', async () => {
    const held = heldCheckout()
    const handOff = vi.fn()
    const { unmount } = render(<Open handOff={handOff} />)
    fireEvent.change(amount(), { target: { value: '25' } })
    fireEvent.click(pay())
    expect(api.createDonationCheckout).toHaveBeenCalledTimes(1)
    unmount()
    await act(async () => held.answer({ paymentId: 'fx-pay-gone', paymentUrl: PAYMENT }))
    expect(handOff).not.toHaveBeenCalled()
  })

  it('hands off with window.location.assign unless a caller hands in its own, and opens no window anywhere', () => {
    const source = readFileSync(join(ROOT, 'src/components/DonateButton.tsx'), 'utf8')
    expect(source.match(/window\.location\.assign\(url\)/g)).toHaveLength(1)
    expect(source).toContain('handOff = sameTab')
    expect(source).not.toMatch(/window\.open\(/)
  })
})

describe('DonateButton', () => {
  it('is the dialog with today\'s trigger: an outline button with the heart and the word Donate, which opens it', () => {
    render(<DonateButton />)
    const trigger = screen.getByRole('button', { name: 'Donate' })
    expect(trigger.getAttribute('data-variant')).toBe('outline')
    expect(trigger.getAttribute('data-size')).toBe('sm')
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog')
    expect(trigger.querySelector('svg.lucide-heart')).not.toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog', { name: TITLE })).toBeTruthy()
    expect(pay().textContent).toBe('Continue to payment')
  })
})
