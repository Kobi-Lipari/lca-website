// @vitest-environment jsdom
//
// The two fee notices of D24, as FeeNotice draws them (WS08 step 10). G1,
// "needs-account", is a panel of information with role note: its title as a
// heading, K's body word for word, Keep it at $0, the ask for a payout
// account as the Button's gold variant, and the line on who can charge fees
// for now. The ask is disabled from the press until its promise settles, so
// a double tap asks once, a failed ask leaves it free again with the focus
// back on it, and once the caller says the request went it reads "Asked. LCA
// has your request." Both buttons wrap their words and shrink with the
// panel, so on a narrow screen neither runs past its edge. G2, "accepted",
// is the one paragraph a standing director reads under their fees. Both are
// navy words on the info tint with an "i" beside them, and neither draws a
// destructive class, a dash or US Chess's old initials. FeeNoticeStatus is
// the polite status line, visually hidden, that holds G1's title while the
// panel shows, so a screen reader hears it, and a failed ask's words in its
// place once the caller passes them. And, as G2 tells a standing director
// (Q3), no file of the server, the site, the shared rules or the workers
// routes a payment to a connected account, so every payment stays in LCA's
// own Stripe account.
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { useState } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeeNotice, FeeNoticeStatus } from '@/areas/admin/components/FeeNotice'

afterEach(cleanup)

const ROOT = resolve(__dirname, '../..')
const TITLE = 'Entry fees need a payout account first'
const BODY =
  'LCA takes entry fees through its own Stripe account. Before your event can charge a fee, LCA sets up an account for you inside LCA\'s Stripe account, ' +
  'called a connected account (Stripe Connect). It keeps your event\'s money apart from LCA\'s and pays it out to you. Until then, your event can run at $0.'
const LINE = 'Who can charge fees for now: LCA admins, club reps, the president and standing directors.'
const KEEP = 'Keep it at $0'
const ASK = 'Ask LCA to set up my payout account'
const ASKED = 'Asked. LCA has your request.'
const ACCEPTED =
  'You can charge an entry fee. Fees are paid into LCA\'s Stripe account. To have them paid straight to you, LCA sets up a connected account for you ' +
  'inside its Stripe account (Stripe Connect), so your event\'s money stays apart from LCA\'s. Until then, your fees wait in LCA\'s account and are paid ' +
  'out to you after the event.'

/** An en dash or an em dash, written by code so that this file holds neither. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp(`\\b${'US' + 'CF'}\\b`)
/** A class that draws red: the destructive tokens, or a red from Tailwind's palette. */
const RED = /^(?:text|bg|border|ring|fill)-(?:destructive|red-\d+)(?:\/\d+)?$/

const classesIn = (root: Element) => [root, ...root.querySelectorAll('*')].flatMap((el) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean))
const textOf = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

/** G1 as a page holds it: the caller sets asked once its request has gone. */
function Asking({ ask }: { ask: () => Promise<void> }) {
  const [asked, setAsked] = useState(false)
  return <FeeNotice kind="needs-account" onKeepFree={() => {}} asked={asked} onAskForAccount={async () => { await ask(); setAsked(true) }} />
}

/** A promise the case settles when it chooses. */
function deferred() {
  let resolve: () => void = () => {}
  let reject: (err: Error) => void = () => {}
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve: () => resolve(), reject: (err: Error) => reject(err) }
}

describe('G1: entry fees need a payout account first', () => {
  it('draws a note titled by its heading, with the body, the two buttons and the line, word for word and in that order', () => {
    render(<FeeNotice kind="needs-account" onKeepFree={() => {}} onAskForAccount={() => {}} />)
    const note = screen.getByRole('note', { name: TITLE })
    const heading = screen.getByRole('heading', { name: TITLE })
    expect(note.contains(heading)).toBe(true)
    const paragraphs = [...note.querySelectorAll('p')].map(textOf)
    expect(paragraphs).toEqual([BODY, LINE])
    const buttons = [...note.querySelectorAll('button')].map(textOf)
    expect(buttons).toEqual([KEEP, ASK])
    // The note's whole text, its parts in this order and nothing else.
    expect(textOf(note)).toBe(`${TITLE}${BODY}${KEEP}${ASK}${LINE}`)
  })

  it('is information: the info tint with the navy ink, an "i" hidden from screen readers, and no red anywhere', () => {
    render(<FeeNotice kind="needs-account" onKeepFree={() => {}} onAskForAccount={() => {}} />)
    const note = screen.getByRole('note', { name: TITLE })
    for (const cls of ['rounded-lg', 'border', 'border-info-200', 'bg-info-50', 'px-4', 'py-3', 'text-sm', 'text-ink']) expect(note.className.split(' '), cls).toContain(cls)
    const icons = note.querySelectorAll('svg')
    expect(icons).toHaveLength(1)
    expect(icons[0].getAttribute('aria-hidden')).toBe('true')
    expect(icons[0].getAttribute('class') ?? '').toContain('lucide-info')
    expect(classesIn(note).filter((c) => RED.test(c))).toEqual([])
  })

  it('draws Keep it at $0 as an outline button and the ask as the Button\'s gold variant', () => {
    render(<FeeNotice kind="needs-account" onKeepFree={() => {}} onAskForAccount={() => {}} />)
    expect(button(KEEP).getAttribute('data-variant')).toBe('outline')
    expect(button(ASK).getAttribute('data-variant')).toBe('gold')
    for (const name of [KEEP, ASK]) expect(button(name).type).toBe('button')
  })

  it('lets both buttons wrap their words and shrink with the panel, asked or not, so on a narrow screen neither runs past its edge', () => {
    // The Button's own one-line classes give way: it keeps its height on one line and grows as its words wrap, never wider than the panel.
    const wraps = ['h-auto', 'min-h-8', 'max-w-full', 'whitespace-normal', 'py-1', 'text-left']
    for (const asked of [false, true]) {
      render(<FeeNotice kind="needs-account" onKeepFree={() => {}} onAskForAccount={() => {}} asked={asked} />)
      for (const name of [KEEP, asked ? ASKED : ASK]) {
        const classes = button(name).className.split(' ')
        for (const cls of wraps) expect(classes, `${name}: ${cls}`).toContain(cls)
        for (const cls of ['whitespace-nowrap', 'h-8']) expect(classes, `${name}: ${cls}`).not.toContain(cls)
      }
      cleanup()
    }
  })

  it('calls onKeepFree when Keep it at $0 is pressed, saying whether the press came from the keyboard, and asks nothing', () => {
    const keep = vi.fn()
    const ask = vi.fn()
    render(<FeeNotice kind="needs-account" onKeepFree={keep} onAskForAccount={ask} />)
    // A press from the keyboard is a click whose detail is 0; a tap or a mouse press counts the press.
    fireEvent.click(button(KEEP))
    expect(keep).toHaveBeenCalledTimes(1)
    expect(keep).toHaveBeenLastCalledWith(true)
    fireEvent.click(button(KEEP), { detail: 1 })
    expect(keep).toHaveBeenCalledTimes(2)
    expect(keep).toHaveBeenLastCalledWith(false)
    expect(ask).not.toHaveBeenCalled()
  })

  it('asks once through a double tap, is disabled until the ask settles, and then reads as asked and stays disabled', async () => {
    const pending = deferred()
    const ask = vi.fn(() => pending.promise)
    render(<Asking ask={ask} />)
    fireEvent.click(button(ASK))
    fireEvent.click(button(ASK))
    expect(ask).toHaveBeenCalledTimes(1)
    expect(button(ASK).disabled).toBe(true)
    await act(async () => { pending.resolve() })
    await waitFor(() => expect(screen.getByRole('button', { name: ASKED })).toBeTruthy())
    expect(button(ASKED).disabled).toBe(true)
    fireEvent.click(button(ASKED))
    expect(ask).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: ASK })).toBeNull()
  })

  it('asks once when the second press comes before the first one\'s render', async () => {
    const pending = deferred()
    const ask = vi.fn(() => pending.promise)
    render(<Asking ask={ask} />)
    const press = button(ASK)
    act(() => {
      press.click()
      press.click()
    })
    expect(ask).toHaveBeenCalledTimes(1)
    await act(async () => { pending.resolve() })
    await screen.findByRole('button', { name: ASKED })
  })

  it('leaves the ask free to press again when it fails, still reading as the ask', async () => {
    const first = deferred()
    const ask = vi.fn(() => first.promise)
    render(<FeeNotice kind="needs-account" onKeepFree={() => {}} onAskForAccount={ask} />)
    fireEvent.click(button(ASK))
    expect(button(ASK).disabled).toBe(true)
    await act(async () => { first.reject(new Error('Not available yet.')) })
    await waitFor(() => expect(button(ASK).disabled).toBe(false))
    fireEvent.click(button(ASK))
    expect(ask).toHaveBeenCalledTimes(2)
  })

  it('puts the focus back on the ask once a failed ask leaves it free, since the press disabled it', async () => {
    const first = deferred()
    const ask = vi.fn(() => first.promise)
    render(
      <>
        <div tabIndex={-1} data-testid="page" />
        <FeeNotice kind="needs-account" onKeepFree={() => {}} onAskForAccount={ask} />
      </>,
    )
    button(ASK).focus()
    fireEvent.click(button(ASK))
    expect(button(ASK).disabled).toBe(true)
    // A browser drops the focus to the page from a button the press disabled; jsdom keeps it there, so the case moves it to the page.
    const page = screen.getByTestId('page')
    page.focus()
    expect(document.activeElement).toBe(page)
    await act(async () => { first.reject(new Error('Not available yet.')) })
    // jsdom gives no focus to a disabled button, so the focus is back on the ask only once the ask is free.
    await waitFor(() => expect(document.activeElement).toBe(button(ASK)))
    expect(button(ASK).disabled).toBe(false)
  })

  it('reads as asked and asks nothing when the request has already gone', () => {
    const ask = vi.fn()
    render(<FeeNotice kind="needs-account" onKeepFree={() => {}} onAskForAccount={ask} asked />)
    expect(button(ASKED).disabled).toBe(true)
    fireEvent.click(button(ASKED))
    expect(ask).not.toHaveBeenCalled()
    expect(button(KEEP).disabled).toBe(false)
  })

  it('moves the focus to Keep it at $0 once the ask has gone, since the ask stays disabled, and not when the panel opens already asked', async () => {
    const pending = deferred()
    const ask = vi.fn(() => pending.promise)
    render(<Asking ask={ask} />)
    button(ASK).focus()
    fireEvent.click(button(ASK))
    await act(async () => { pending.resolve() })
    await screen.findByRole('button', { name: ASKED })
    expect(document.activeElement).toBe(button(KEEP))
    cleanup()
    render(<FeeNotice kind="needs-account" onKeepFree={() => {}} onAskForAccount={ask} asked />)
    expect(document.activeElement).toBe(document.body)
  })
})

describe('G2: a standing director\'s fee is accepted', () => {
  it('draws the one paragraph, word for word, as a note on the same tint, with no buttons and no red', () => {
    render(<FeeNotice kind="accepted" />)
    const note = screen.getByRole('note')
    expect([...note.querySelectorAll('p')].map(textOf)).toEqual([ACCEPTED])
    expect(textOf(note)).toBe(ACCEPTED)
    expect(note.querySelectorAll('button')).toHaveLength(0)
    expect(note.querySelectorAll('h1, h2, h3, h4')).toHaveLength(0)
    for (const cls of ['border-info-200', 'bg-info-50', 'text-ink']) expect(note.className.split(' '), cls).toContain(cls)
    expect(note.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(classesIn(note).filter((c) => RED.test(c))).toEqual([])
  })
})

describe('the line a screen reader hears as G1 shows', () => {
  it('is a polite status line, visually hidden, empty until the panel shows and then G1\'s title, the panel\'s heading word for word', () => {
    const { rerender } = render(<FeeNoticeStatus shows={false} />)
    const line = screen.getByRole('status')
    expect(line.getAttribute('aria-live')).toBe('polite')
    expect(line.className.split(' ')).toEqual(['sr-only'])
    expect(line.textContent).toBe('')
    rerender(<FeeNoticeStatus shows />)
    // The same line, so the change in what it holds is what a screen reader reads.
    expect(screen.getByRole('status')).toBe(line)
    expect(line.textContent).toBe(TITLE)
    rerender(<FeeNoticeStatus shows={false} />)
    expect(line.textContent).toBe('')
    cleanup()
    render(<FeeNotice kind="needs-account" onKeepFree={() => {}} onAskForAccount={() => {}} />)
    expect(textOf(screen.getByRole('heading'))).toBe(TITLE)
  })

  it('says a failed ask\'s words in the title\'s place while the panel shows, its title again once they are cleared, and nothing once the panel has gone', () => {
    const { rerender } = render(<FeeNoticeStatus shows />)
    const line = screen.getByRole('status')
    expect(line.textContent).toBe(TITLE)
    rerender(<FeeNoticeStatus shows failure="Not available yet." />)
    // The same line, so a screen reader reads the failure as the change in what it holds.
    expect(screen.getByRole('status')).toBe(line)
    expect(line.textContent).toBe('Not available yet.')
    rerender(<FeeNoticeStatus shows failure={null} />)
    expect(line.textContent).toBe(TITLE)
    rerender(<FeeNoticeStatus shows={false} failure="Not available yet." />)
    expect(line.textContent).toBe('')
  })
})

describe('the words of both notices', () => {
  it('hold no dash and not the old initials, as drawn and in the file', () => {
    for (const kind of ['needs-account', 'accepted'] as const) {
      const { container } = render(<FeeNotice kind={kind} onKeepFree={() => {}} onAskForAccount={() => {}} asked={kind === 'accepted'} />)
      expect(container.textContent ?? '').not.toMatch(DASHES)
      expect(container.textContent ?? '').not.toMatch(OLD_INITIALS)
      cleanup()
    }
    render(<FeeNotice kind="needs-account" asked />)
    expect(textOf(screen.getByRole('button', { name: ASKED }))).toBe(ASKED)
    const source = readFileSync(join(__dirname, '../../src/areas/admin/components/FeeNotice.tsx'), 'utf8')
    expect(source).not.toMatch(DASHES)
    expect(source).not.toMatch(OLD_INITIALS)
  })

  it('draw their gold through the Button\'s variant, never by importing the brand\'s gold classes', () => {
    const source = readFileSync(join(__dirname, '../../src/areas/admin/components/FeeNotice.tsx'), 'utf8')
    expect(source).toContain('variant="gold"')
    expect(source).not.toMatch(/\bGOLD(?:_BUTTON)?\b/)
    expect(source).not.toContain('@/lib/brand')
  })
})

describe('Q3: every payment stays in LCA\'s account, as G2 says', () => {
  /** Every file of code under a folder, its own folders included. */
  function codeUnder(dir: string): string[] {
    return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
      const path = `${dir}/${entry.name}`
      if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : codeUnder(path)
      return /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? [path] : []
    })
  }
  /** What a payment routed to a connected account would name: Stripe Connect's routing parameters and its account header. */
  const ROUTING = /\b(?:transfer_data|on_behalf_of|application_fee_amount|destination_charge)\b|Stripe-Account/

  it('finds no Stripe Connect routing in the server, the site, the shared rules or the workers, so no checkout pays into a connected account', () => {
    const files = ['functions', 'src', 'domain', 'workers'].flatMap(codeUnder)
    expect(files).toContain('functions/utils/stripe.ts')
    expect(files.length).toBeGreaterThan(100)
    expect(files.filter((file) => ROUTING.test(readFileSync(join(ROOT, file), 'utf8')))).toEqual([])
  })

  it('reads a routing parameter where one is written, so the search finds what it looks for', () => {
    for (const text of ['payment_intent_data: { transfer_data: { destination } }', "headers: { 'Stripe-Account': id }", 'on_behalf_of: id']) {
      expect(ROUTING.test(text), text).toBe(true)
    }
    expect(ROUTING.test('Fees are paid into LCA\'s Stripe account.')).toBe(false)
  })
})
