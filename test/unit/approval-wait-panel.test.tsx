// @vitest-environment jsdom
//
// The approval wait's panel on its own (WS09 step 19), the one component the
// manage page and the admin club page both draw: which buttons each state and
// each answer of the server gives, presses that come twice, a press that
// fails, the note's form, Help, and the plain-language rules on every word it
// draws. The page cases in region-events-pages.test.tsx run it inside the
// real pages; here the request is stubbed at the browser's fetch so each
// request is read as it would leave. Every event, club and person is made up
// ("Example Winter Quads", "Player One", example.org).
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApprovalWait, type WaitingEvent } from '@/areas/clubs/components/ApprovalWait'
import { WAIT_HELP_SHOWN_KEY } from '@/areas/clubs/approval'
import type { TournamentApprovalResponse } from '@domain/contracts'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'tok-example' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))

const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
/** US Chess's old initials, put together so that this file does not hold them. */
const OLD_INITIALS = new RegExp('US' + 'CF')
const NOTE_LABEL = 'What needs to change (500 characters at most)'

const base = { id: 't-wait', name: 'Example Winter Quads' }
const NONE: WaitingEvent = { ...base, needs_lca_approval: 0, approval_requested_at: null, approved_at: null }
const DRAFT: WaitingEvent = { ...base, needs_lca_approval: 1, approval_requested_at: null, approved_at: null }
const REVIEW: WaitingEvent = { ...base, needs_lca_approval: 1, approval_requested_at: '2026-11-14 18:00:00', approved_at: null }
const APPROVED: WaitingEvent = { ...base, needs_lca_approval: 1, approval_requested_at: '2026-11-14 18:00:00', approved_at: '2026-11-16 15:00:00' }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const ANSWER: TournamentApprovalResponse = {
  needs_lca_approval: 1, approval_requested_at: '2026-11-14 18:00:00', approved_at: null, approved_by: null,
  email: 'Sent for LCA review. The LCA admins were emailed.',
}

let posted: unknown[] = []
/** What the stub answers; a pending one holds the request until released. */
let reply: () => Response | Promise<Response> = () => json(ANSWER)

beforeEach(() => {
  window.localStorage.clear()
  window.localStorage.setItem(WAIT_HELP_SHOWN_KEY, 'shown')
  posted = []
  reply = () => json(ANSWER)
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
    posted.push(typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body)
    return reply()
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function draw(event: WaitingEvent, over: { maySubmit?: boolean; mayDecide?: boolean; help?: boolean; headingLevel?: 2 | 3 | 4; inRow?: boolean; onMoved?: (a: TournamentApprovalResponse) => void; onStale?: () => void } = {}) {
  return render(
    <ApprovalWait
      event={event}
      maySubmit={over.maySubmit ?? false}
      mayDecide={over.mayDecide ?? false}
      onMoved={over.onMoved ?? (() => {})}
      onStale={over.onStale}
      help={over.help}
      headingLevel={over.headingLevel}
      inRow={over.inRow}
    />,
  )
}
const buttons = () => screen.queryAllByRole('button').map((b) => b.textContent?.trim() ?? '')
const statusLine = () => screen.getByRole('status')

describe('which buttons each state and each answer of the server gives', () => {
  it('draws nothing at all for an event that is not marked, whatever the server lets the person do', () => {
    const { container } = draw(NONE, { maySubmit: true, mayDecide: true, help: true })
    expect(container.innerHTML).toBe('')
  })

  it('draws, for each state and each pair of answers, exactly the buttons the pair and the state allow', () => {
    type Row = [string, WaitingEvent, boolean, boolean, string[]]
    const table: Row[] = [
      ['draft, drafter', DRAFT, true, false, ['Submit for LCA review']],
      ['draft, nobody', DRAFT, false, false, []],
      // Submit is for a person who cannot decide: an LCA admin approves a draft as it stands.
      ['draft, admin', DRAFT, true, true, ['Approve and publish']],
      ['draft, decide only', DRAFT, false, true, ['Approve and publish']],
      ['in review, drafter', REVIEW, true, false, []],
      ['in review, admin', REVIEW, true, true, ['Approve and publish', 'Ask for changes']],
      ['in review, nobody', REVIEW, false, false, []],
      ['approved, drafter', APPROVED, true, false, []],
      ['approved, admin', APPROVED, true, true, []],
    ]
    for (const [label, event, maySubmit, mayDecide, expected] of table) {
      const { unmount } = draw(event, { maySubmit, mayDecide })
      expect(buttons(), label).toEqual(expected)
      unmount()
    }
  })

  it('gives the state in words in the panel under the heading that names the thing, LCA approval, at the level asked for', () => {
    const { unmount } = draw(DRAFT, { headingLevel: 4 })
    expect(screen.getByRole('heading', { level: 4, name: 'LCA approval' })).toBeTruthy()
    expect(screen.getByText('Draft. Not sent for LCA review yet.')).toBeTruthy()
    unmount()
    const review = draw(REVIEW, { headingLevel: 3 })
    expect(screen.getByRole('heading', { level: 3, name: 'LCA approval' })).toBeTruthy()
    expect(screen.getByText('Waiting for LCA approval. Sent for review on Sat, Nov 14, 2026.')).toBeTruthy()
    review.unmount()
    draw(APPROVED, { headingLevel: 3 })
    expect(screen.getByRole('heading', { level: 3, name: 'LCA approval' })).toBeTruthy()
    expect(screen.getByText('Approved by LCA on Mon, Nov 16, 2026.')).toBeTruthy()
  })

  it('in a row draws no heading and no box of its own, and names each button with the event, the words seen unchanged', () => {
    const { container } = draw(REVIEW, { mayDecide: true, inRow: true })
    expect(screen.queryByRole('heading')).toBeNull()
    expect(container.querySelector('section')).toBeNull()
    expect((container.firstElementChild as HTMLElement).className).not.toMatch(/\bborder\b|\bbg-card\b/)
    expect(screen.getByRole('button', { name: 'Approve and publish: Example Winter Quads' }).textContent?.trim()).toBe('Approve and publish')
    expect(screen.getByRole('button', { name: 'Ask for changes: Example Winter Quads' }).textContent?.trim()).toBe('Ask for changes')
    expect(screen.getByText('Waiting for LCA approval. Sent for review on Sat, Nov 14, 2026.')).toBeTruthy()
  })

  it('draws no Help button in a row of the admin club page, which asks for none, and one on the manage page, on one line with the heading', () => {
    const { unmount } = draw(REVIEW, { mayDecide: true })
    expect(screen.queryByRole('button', { name: 'Help' })).toBeNull()
    expect(screen.queryByText('Who approves')).toBeNull()
    unmount()
    draw(REVIEW, { mayDecide: true, help: true })
    const help = screen.getByRole('button', { name: 'Help' })
    // The heading at the left and Help at the right, in that reading order, on one line at every width with their
    // middles level: the row never wraps and sets nothing per width, and Help keeps its 44 pixels.
    const heading = screen.getByRole('heading', { level: 2, name: 'LCA approval' })
    const row = heading.parentElement as HTMLElement
    expect(row.firstElementChild).toBe(heading)
    expect(row.lastElementChild).toBe(help)
    expect(row.className.split(/\s+/)).toEqual(expect.arrayContaining(['flex', 'items-center', 'justify-between']))
    expect(row.className).not.toMatch(/\bflex-wrap\b|\bitems-(?:start|end|baseline)\b|\b(?:sm|md|lg|xl):/)
    expect(heading.className).toMatch(/\bmin-w-0\b/)
    expect(help.className).toMatch(/\bmin-h-11\b/)
    expect(help.className).toMatch(/\bshrink-0\b/)
  })
})

describe('the sizes and the words of every control', () => {
  it('gives every button, the note\'s field and Help\'s buttons a 44 pixel height, in each state and with the form and Help open', () => {
    window.localStorage.removeItem(WAIT_HELP_SHOWN_KEY)
    for (const [event, maySubmit, mayDecide] of [[DRAFT, true, false], [DRAFT, true, true], [REVIEW, false, true]] as Array<[WaitingEvent, boolean, boolean]>) {
      const { unmount } = draw(event, { maySubmit, mayDecide, help: true })
      if (event === REVIEW) fireEvent.click(screen.getByRole('button', { name: 'Ask for changes' }))
      const controls = [...screen.getAllByRole('button'), ...screen.queryAllByLabelText(NOTE_LABEL)]
      expect(controls.length).toBeGreaterThanOrEqual(3)
      for (const control of controls) expect(control.className, control.textContent ?? control.tagName).toMatch(/\bmin-h-11\b/)
      unmount()
      window.localStorage.removeItem(WAIT_HELP_SHOWN_KEY)
    }
  })

  it('draws no long dash, no old initials for US Chess, no decimal half and no gold text, in any state, with Help and the form open', () => {
    window.localStorage.removeItem(WAIT_HELP_SHOWN_KEY)
    for (const [event, maySubmit, mayDecide] of [[DRAFT, true, true], [REVIEW, true, true], [APPROVED, true, true]] as Array<[WaitingEvent, boolean, boolean]>) {
      const { container, unmount } = draw(event, { maySubmit, mayDecide, help: true })
      if (event === REVIEW) fireEvent.click(screen.getByRole('button', { name: 'Ask for changes' }))
      const words = container.textContent ?? ''
      expect(words.length).toBeGreaterThan(50)
      expect(words).not.toMatch(LONG_DASH)
      expect(words).not.toMatch(OLD_INITIALS)
      expect(words).not.toMatch(/\.5\b/)
      expect(container.innerHTML).not.toMatch(/text-(gold|accent|yellow|amber)/)
      unmount()
      window.localStorage.removeItem(WAIT_HELP_SHOWN_KEY)
    }
  })

  it('states the event\'s fees stay at $0 behind Help, not beside a control', () => {
    window.localStorage.removeItem(WAIT_HELP_SHOWN_KEY)
    draw(DRAFT, { maySubmit: true, help: true })
    const help = screen.getByRole('region', { name: 'Help' })
    expect(help.textContent).toContain('These events run at $0.')
    expect(within(help).getByText('Entry fees')).toBeTruthy()
    // Nothing outside Help explains the wait: the panel's other words are its state and its status line.
    const outside = (screen.getByRole('heading', { name: 'LCA approval' }).closest('section') as HTMLElement).textContent?.replace(help.textContent ?? '', '') ?? ''
    expect(outside).not.toMatch(/payout|fees|who approves/i)
  })
})

describe('a press that comes twice', () => {
  it('sends a second press of Submit while the first is on the way nowhere, and says what is on the way', async () => {
    let release: (r: Response) => void = () => {}
    reply = () => new Promise<Response>((resolve) => { release = resolve })
    const onMoved = vi.fn()
    draw(DRAFT, { maySubmit: true, onMoved })
    const submit = screen.getByRole('button', { name: 'Submit for LCA review' })
    fireEvent.click(submit)
    await waitFor(() => expect(statusLine().textContent).toBe('Sending for LCA review…'))
    fireEvent.click(submit)
    fireEvent.click(submit)
    expect(submit.getAttribute('aria-disabled')).toBe('true')
    expect(submit.getAttribute('aria-busy')).toBe('true')
    release(json(ANSWER))
    await waitFor(() => expect(onMoved).toHaveBeenCalledTimes(1))
    expect(posted).toEqual([{ action: 'submit' }])
    expect(onMoved).toHaveBeenCalledWith(ANSWER)
    expect(statusLine().textContent).toBe(ANSWER.email)
  })

  it('does not send Approve while another move is on the way, nor Send twice', async () => {
    let release: (r: Response) => void = () => {}
    reply = () => new Promise<Response>((resolve) => { release = resolve })
    draw(REVIEW, { mayDecide: true })
    fireEvent.click(screen.getByRole('button', { name: 'Ask for changes' }))
    fireEvent.change(screen.getByLabelText(NOTE_LABEL), { target: { value: 'Please give the round times.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(statusLine().textContent).toBe('Sending your note…'))
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    fireEvent.click(screen.getByRole('button', { name: 'Approve and publish' }))
    release(json({ ...ANSWER, approval_requested_at: null, email: 'Changes asked. The person who drafted it was emailed your note.' }))
    await waitFor(() => expect(statusLine().textContent).toBe('Changes asked. The person who drafted it was emailed your note.'))
    expect(posted).toEqual([{ action: 'ask_changes', note: 'Please give the round times.' }])
  })

  it('does not draw an answer that comes after the panel has gone', async () => {
    let release: (r: Response) => void = () => {}
    reply = () => new Promise<Response>((resolve) => { release = resolve })
    const onMoved = vi.fn()
    const { unmount } = draw(DRAFT, { maySubmit: true, onMoved })
    fireEvent.click(screen.getByRole('button', { name: 'Submit for LCA review' }))
    await waitFor(() => expect(posted).toHaveLength(1))
    unmount()
    release(json(ANSWER))
    await new Promise((r) => setTimeout(r, 20))
    expect(onMoved).not.toHaveBeenCalled()
  })
})

describe('a press that fails', () => {
  it('keeps the note the person typed, the form open and the state as it was, and says nothing changed in the server\'s words', async () => {
    reply = () => json({ error: 'This event is not in review.' }, 409)
    const onMoved = vi.fn()
    const onStale = vi.fn()
    draw(REVIEW, { mayDecide: true, onMoved, onStale })
    fireEvent.click(screen.getByRole('button', { name: 'Ask for changes' }))
    const field = screen.getByLabelText(NOTE_LABEL) as HTMLTextAreaElement
    fireEvent.change(field, { target: { value: 'Please give the round times.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(statusLine().textContent).toBe('Nothing changed: This event is not in review.'))
    expect(onMoved).not.toHaveBeenCalled()
    expect(field.value).toBe('Please give the round times.')
    expect(field.getAttribute('aria-invalid')).toBeNull()
    expect(screen.getByText('Waiting for LCA approval. Sent for review on Sat, Nov 14, 2026.')).toBeTruthy()
    // A 409 asks the caller to read the event again, once, and the words stay, with the focus on them.
    expect(onStale).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(document.activeElement).toBe(statusLine()))
    // The press can be made again once it has failed.
    reply = () => json({ ...ANSWER, approval_requested_at: null, email: 'Changes asked. The person who drafted it was emailed your note.' })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(onMoved).toHaveBeenCalledTimes(1))
    expect(posted).toHaveLength(2)
  })

  it('clears a note\'s error once the person presses Send again, and ties a new one to the field again', async () => {
    const refuse = (words: string) => () => json({ error: 'Some fields are missing or not valid.', fields: { note: words } }, 400)
    draw(REVIEW, { mayDecide: true })
    fireEvent.click(screen.getByRole('button', { name: 'Ask for changes' }))
    const field = screen.getByLabelText(NOTE_LABEL) as HTMLTextAreaElement
    reply = refuse('Write what needs to change.')
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'))
    expect(statusLine().textContent).toBe('Nothing was sent: Write what needs to change.')
    reply = refuse('Keep the note to 500 characters.')
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(document.getElementById(field.getAttribute('aria-describedby') ?? '')?.textContent).toBe('Keep the note to 500 characters.'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ask for changes' }))
    const reopened = screen.getByLabelText(NOTE_LABEL)
    expect(reopened.getAttribute('aria-invalid')).toBeNull()
    expect(reopened.getAttribute('aria-describedby')).toBeNull()
    expect(document.activeElement).toBe(reopened)
  })

  it('says a failed Submit or Approve with no words from the server in the panel\'s own, keeps the focus on the button, and asks for no read again', async () => {
    reply = () => json({}, 500)
    const onStale = vi.fn()
    draw(DRAFT, { maySubmit: false, mayDecide: true, onStale })
    const approve = screen.getByRole('button', { name: 'Approve and publish' })
    approve.focus()
    fireEvent.click(approve)
    await waitFor(() => expect(statusLine().textContent).toMatch(/^Nothing changed: \S/))
    expect(statusLine().textContent).not.toMatch(LONG_DASH)
    expect(document.activeElement).toBe(approve)
    expect(buttons()).toEqual(['Approve and publish'])
    expect(onStale).not.toHaveBeenCalled()
  })

  it('shows the bound on submits, a 429, in the server\'s own words, and asks for no read again', async () => {
    const words = 'You have sent 5 events for LCA review in the last day. Try again tomorrow.'
    reply = () => json({ error: words }, 429)
    const onMoved = vi.fn()
    const onStale = vi.fn()
    draw(DRAFT, { maySubmit: true, onMoved, onStale })
    fireEvent.click(screen.getByRole('button', { name: 'Submit for LCA review' }))
    await waitFor(() => expect(statusLine().textContent).toBe(`Nothing changed: ${words}`))
    expect(onMoved).not.toHaveBeenCalled()
    expect(onStale).not.toHaveBeenCalled()
    expect(buttons()).toEqual(['Submit for LCA review'])
  })
})

describe('Help', () => {
  it('opens by itself once and remembers it; closing it by Escape or its own button returns the focus to the Help button', () => {
    window.localStorage.removeItem(WAIT_HELP_SHOWN_KEY)
    draw(DRAFT, { maySubmit: true, help: true })
    const button = screen.getByRole('button', { name: 'Help' })
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(window.localStorage.getItem(WAIT_HELP_SHOWN_KEY)).toBe('shown')
    fireEvent.keyDown(screen.getByRole('region', { name: 'Help' }), { key: 'Escape' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button)
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Help' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close help' }))
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button)
  })

  it('stays closed, and does not fail, in a browser whose storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => draw(DRAFT, { maySubmit: true, help: true })).not.toThrow()
    expect(screen.getByRole('button', { name: 'Help' }).getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(screen.getByRole('button', { name: 'Help' }))
    expect(screen.getByRole('button', { name: 'Help' }).getAttribute('aria-expanded')).toBe('true')
  })
})
