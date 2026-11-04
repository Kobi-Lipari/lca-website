// @vitest-environment jsdom
//
// The donation dialog, src/components/DonateButton.tsx, at its edges.
// test/unit/donate-button.test.tsx hands the dialog a hand-off it watches;
// this file also leaves the dialog its own, and holds:
//
// - with no hand-off handed in, the dialog moves this very tab to the
//   payment page, as window.location.assign does, and opens no window: the
//   checkout's address is made a place in this page (a fragment), the one
//   kind of move jsdom carries out, so the tab's own address shows it went;
//   DonateButton, today's trigger, does the same;
// - a second press while the checkout is asked for asks for nothing more
//   and hands off once, so a double press makes one payment, not two;
// - after a failed checkout, a second try asks again and hands off once,
//   and the first failure's words are gone; a failure that is not an Error
//   gives the dialog's own words;
// - the amount at its edges: exactly $1 goes through, less does not, and
//   a negative amount neither;
// - the focus, as the dialog closes, goes to the control the caller names
//   while that control is still in the page, and the dialog stops listening
//   for the browser bringing the page back once it is gone.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ createDonationCheckout: vi.fn() }))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const { DonateButton, DonateDialog } = await import('@/components/DonateButton')

const TITLE = 'Support the Louisiana Chess Association'

/** The checkout's address, made a place in this very page, so a move to it is one jsdom carries out. */
const inThisPage = (place: string) => `${window.location.href.split('#')[0]}#${place}`

/** A promise the test settles when it chooses. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** The dialog, open, with whatever hand-off and focus target the case gives it. */
function Open(props: { handOff?: (url: string) => void; returnFocus?: () => HTMLElement | null }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <button type="button">Somewhere else on the page</button>
      <DonateDialog open={open} onOpenChange={setOpen} {...props} />
    </>
  )
}

const amount = () => screen.getByLabelText('Amount (USD)')
const pay = () => screen.getByRole('button', { name: /Continue to payment|Starting checkout…/ })
const give = (value: string) => {
  fireEvent.change(amount(), { target: { value } })
  fireEvent.click(pay())
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  api.createDonationCheckout.mockReset()
  window.history.replaceState(null, '', '/')
})

describe('the hand-off the dialog uses by itself', () => {
  it('moves this tab to the payment page and opens no window', async () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null)
    api.createDonationCheckout.mockResolvedValue({ paymentId: 'fx-pay-tab', paymentUrl: inThisPage('fx-checkout') })
    render(<Open />)
    expect(window.location.hash).toBe('')
    give('25')
    await waitFor(() => expect(window.location.hash).toBe('#fx-checkout'))
    expect(window.location.pathname).toBe('/')
    expect(opened).not.toHaveBeenCalled()
    expect(api.createDonationCheckout).toHaveBeenCalledTimes(1)
    // The tab is on its way: the dialog stays, saying so.
    expect(screen.getByRole('dialog', { name: TITLE })).toBeTruthy()
    expect(pay().textContent).toBe('Starting checkout…')
  })

  it('is the same from DonateButton, today\'s trigger', async () => {
    const opened = vi.spyOn(window, 'open').mockReturnValue(null)
    api.createDonationCheckout.mockResolvedValue({ paymentId: 'fx-pay-button', paymentUrl: inThisPage('fx-checkout-button') })
    render(<DonateButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Donate' }))
    give('40')
    await waitFor(() => expect(window.location.hash).toBe('#fx-checkout-button'))
    expect(api.createDonationCheckout).toHaveBeenCalledWith(40)
    expect(opened).not.toHaveBeenCalled()
  })
})

describe('a second press, and a second try', () => {
  it('asks for one checkout and hands off once when Continue is pressed twice while the first is asked for', async () => {
    const asked = deferred<{ paymentId: string; paymentUrl: string }>()
    api.createDonationCheckout.mockReturnValue(asked.promise)
    const handOff = vi.fn()
    render(<Open handOff={handOff} />)
    fireEvent.change(amount(), { target: { value: '25' } })
    fireEvent.click(pay())
    expect((pay() as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(pay())
    fireEvent.click(pay())
    expect(api.createDonationCheckout).toHaveBeenCalledTimes(1)
    await act(async () => asked.resolve({ paymentId: 'fx-pay-once', paymentUrl: 'https://checkout.stripe.example/c/pay/fx-once' }))
    expect(handOff).toHaveBeenCalledTimes(1)
    expect(handOff).toHaveBeenCalledWith('https://checkout.stripe.example/c/pay/fx-once')
  })

  it('after a failed checkout, asks again on the next press, clears the failure\'s words and hands off once', async () => {
    api.createDonationCheckout
      .mockRejectedValueOnce(new Error('Could not start the payment process. Please try again in a moment.'))
      .mockResolvedValueOnce({ paymentId: 'fx-pay-retry', paymentUrl: 'https://checkout.stripe.example/c/pay/fx-retry' })
    const handOff = vi.fn()
    render(<Open handOff={handOff} />)
    give('30')
    await screen.findByText('Could not start the payment process. Please try again in a moment.')
    expect(handOff).not.toHaveBeenCalled()
    fireEvent.click(pay())
    await waitFor(() => expect(handOff).toHaveBeenCalledTimes(1))
    expect(handOff).toHaveBeenCalledWith('https://checkout.stripe.example/c/pay/fx-retry')
    expect(api.createDonationCheckout).toHaveBeenCalledTimes(2)
    expect(api.createDonationCheckout).toHaveBeenNthCalledWith(2, 30)
    expect(screen.queryByText('Could not start the payment process. Please try again in a moment.')).toBeNull()
  })

  it('gives its own words for a failure that is not an Error, and hands off nothing', async () => {
    api.createDonationCheckout.mockRejectedValue('the line went quiet')
    const handOff = vi.fn()
    render(<Open handOff={handOff} />)
    give('15')
    await screen.findByText('Something went wrong. Please try again.')
    expect(handOff).not.toHaveBeenCalled()
    expect((pay() as HTMLButtonElement).disabled).toBe(false)
  })
})

describe('the amount at its edges', () => {
  it.each([
    ['exactly $1', '1', 1],
    ['$10,000, the most the checkout takes', '10000', 10000],
    ['an amount with cents', '12.50', 12.5],
  ])('%s goes through as %s', async (_, value, sent) => {
    api.createDonationCheckout.mockResolvedValue({ paymentId: 'fx-pay-edge', paymentUrl: 'https://checkout.stripe.example/c/pay/fx-edge' })
    const handOff = vi.fn()
    render(<Open handOff={handOff} />)
    give(value)
    await waitFor(() => expect(handOff).toHaveBeenCalledTimes(1))
    expect(api.createDonationCheckout).toHaveBeenCalledWith(sent)
  })

  it.each([
    ['a cent under $1', '0.99'],
    ['nothing at all', '0'],
    ['a negative amount', '-5'],
  ])('%s (%s) asks for nothing and says why', (_, value) => {
    const handOff = vi.fn()
    render(<Open handOff={handOff} />)
    give(value)
    expect(screen.getByText('Please enter an amount of at least $1')).toBeTruthy()
    expect(api.createDonationCheckout).not.toHaveBeenCalled()
    expect(handOff).not.toHaveBeenCalled()
  })
})

describe('the focus as the dialog closes, and the page coming back', () => {
  it('goes to the control the caller names while it is in the page', async () => {
    const target = document.createElement('button')
    target.textContent = 'About'
    document.body.append(target)
    try {
      render(<Open returnFocus={() => target} />)
      fireEvent.keyDown(screen.getByRole('dialog', { name: TITLE }), { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(document.activeElement).toBe(target)
    } finally {
      target.remove()
    }
  })

  it('is left to the dialog when the control named is no longer in the page, and nothing fails', async () => {
    const gone = document.createElement('button')
    const focus = vi.spyOn(gone, 'focus')
    render(<Open returnFocus={() => gone} />)
    fireEvent.keyDown(screen.getByRole('dialog', { name: TITLE }), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(focus).not.toHaveBeenCalled()
    expect(document.activeElement).not.toBe(gone)
  })

  it('stops listening for the browser bringing the page back once the dialog is gone', () => {
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    const { unmount } = render(<Open handOff={vi.fn()} />)
    const listener = added.mock.calls.find(([type]) => type === 'pageshow')?.[1]
    expect(listener).toBeTypeOf('function')
    unmount()
    expect(removed.mock.calls.filter(([type, fn]) => type === 'pageshow' && fn === listener)).toHaveLength(1)
  })
})
