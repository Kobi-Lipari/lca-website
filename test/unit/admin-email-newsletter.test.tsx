// @vitest-environment jsdom
//
// Group email with the LCA newsletter list (WS16 step 5), drawn in jsdom with
// the site's calls mocked through '@/lib/api' and mailLists flipped inside
// this one file through a getter on the mocked FEATURES, so both sides are
// drawn from the same code. With the switch off the page is today's: its two
// tabs, no newsletter word anywhere, no key read or written in the browser,
// and its markup the same as today's page, test/unit/fixtures/admin-email-today.tsx
// (src/pages/AdminEmailPage.tsx at 4b9d780), drawn beside it state by state.
// With the switch on the page opens on the newsletter tab beside Specific
// people, with no Groups of members and none of its controls; the count line,
// the sender and Who gets it, closed at first; Help, open by itself on the
// first visit and closed on the next, holding the sentences that only
// explain; the send button off while Resend sends with the two sentences
// beside it; the one confirm step with the count, a refusal in the server's
// words; the stop and its words; the recent sends and why one waits; each
// row's time, in the newsletter's sends and in the history, as the site
// writes a stored time, and today's words with the switch off; the
// newsletter's test send, through Amazon SES only for an LCA admin who ticks
// the box; and the preview's footer from domain/mail/footer.ts with no
// postal address. And the calls the page makes, and the audit log's label
// for a stopped newsletter. Since checkpoint M's review the tab's sizes are
// read from the classes it wears, compiled by Tailwind with the site's tokens
// (test/unit/helpers/tailwindPx.ts): the words at 14px, the openers 44px tall,
// and the buttons 44px tall under 40rem. Every name, subject, club and address
// here is made up.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MemberRole } from '@/areas/admin/roles'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { AuthContext } from '@/contexts/auth-context'
import type { ApiAuditEntry, ApiCampaign, ApiClubListItem, ApiNewsletter } from '@/lib/api'
import { ApiError } from '@/lib/http'
import { EVENT_MAIL_STILL_COMES, LIST_FOOTER_WORDS, PREFERENCES_LABEL } from '@domain/mail/footer'
import { NEWSLETTER_LIST_ID } from '@domain/mail/lists'
import { builder, setBy, sizeClassOf } from './helpers/tailwindPx'

const flags = vi.hoisted(() => ({ mailLists: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get mailLists() {
        return flags.mailLists
      },
    },
  }
})
const session = vi.hoisted(() => ({ token: 'sample-session-token' as string | null }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: session.token ? { access_token: session.token } : null } }) } },
}))
const api = vi.hoisted(() => ({
  getClubs: vi.fn(),
  adminGetMembers: vi.fn(),
  getCampaigns: vi.fn(),
  previewCampaignCount: vi.fn(),
  createCampaign: vi.fn(),
  sendTestCampaignEmail: vi.fn(),
  getNewsletter: vi.fn(),
  sendNewsletter: vi.fn(),
  sendNewsletterTest: vi.fn(),
  stopNewsletter: vi.fn(),
  adminGetAuditLog: vi.fn(),
}))
vi.mock('@/lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/api')>()), ...api }))
// The real editor needs a browser's layout; a text box stands in for it on both pages alike.
vi.mock('@/areas/governance/components/RichTextEditor', async () => {
  const { createElement } = await import('react')
  return {
    RichTextEditor: ({ content, onChange }: { content: string; onChange: (html: string) => void }) =>
      createElement('textarea', { 'aria-label': 'Message', value: content, onChange: (e: { target: { value: string } }) => onChange(e.target.value) }),
  }
})

const { AdminEmailPage } = await import('@/pages/AdminEmailPage')
const { AdminEmailPageToday } = await import('./fixtures/admin-email-today')
const { AuditLogPanel } = await import('@/areas/admin/components/AuditLogPanel')

/** The words the page writes with mailLists on, as the step's entry and its launch note give them. */
const WORDS = {
  tab: 'The LCA newsletter list',
  subtitle: 'Send the LCA newsletter, or a note to specific people.',
  guardrails: "Name the newsletter in the subject, put member news first, and paste links by hand, a tournament's King Registration link included. A renewal reminder is a separate email.",
  bothLinks: 'Each email carries an unsubscribe link and an email preferences link.',
  specificPeople: "For a note about a person's own membership, entry or request. News goes to the LCA newsletter list, which honors each person's choices.",
  // Since checkpoint M's review the server's own words, WAITS_FOR_SES, with no "now" of the page's own.
  waitsForSes: 'The newsletter goes out through Amazon SES, which this site does not send through yet. You can write it and send yourself a test.',
  send: 'Send to the LCA newsletter list',
  sesBox: 'Send the test through Amazon SES',
}
const TODAY_SUBTITLE = `Send an email to members ${String.fromCharCode(0x2014)} everyone, or a targeted group by role, club, or membership status.`
const HELP_KEY = 'lca-newsletter-help'

const CLUBS = [{ id: 'club-sample', name: 'Example Chess Club', city: 'Sample City', meeting_schedule: 'Tuesdays', color: null, image_url: null, region: null }] as ApiClubListItem[]
const MEMBERS = [
  { id: 'member-1', email: 'player.one@example.org', full_name: 'Player One', uscf_id: null, membership_status: 'active', membership_expiry: null },
  { id: 'member-2', email: 'player.two@example.org', full_name: 'Player Two', uscf_id: null, membership_status: 'active', membership_expiry: null },
]
const CAMPAIGNS: ApiCampaign[] = [
  { id: 'campaign-sample', subject: 'Sample group message', total_recipients: 2, sent_count: 2, failed_count: 0, status: 'completed', created_at: '2026-11-02 15:00:00', completed_at: '2026-11-02 15:01:00' },
]
type Send = ApiNewsletter['summary']['recent'][number]
const SENT: Send = { id: 'campaign-newsletter-1', subject: 'Sample newsletter one', totalRecipients: 9, sentCount: 9, failedCount: 0, skippedCount: 0, status: 'completed', createdAt: '2026-11-03 15:00:00', completedAt: '2026-11-03 15:05:00' }
const SENDING: Send = { ...SENT, id: 'campaign-newsletter-2', subject: 'Sample newsletter two', sentCount: 3, status: 'sending', completedAt: null }

/** The newsletter's answer, with a made-up From line, so what the page shows is the server's. */
function newsletter(over: { sendsThrough?: string; recent?: Send[]; waits?: string | null } = {}): ApiNewsletter {
  return {
    list: { id: NEWSLETTER_LIST_ID, name: 'LCA newsletter' },
    from: 'Sample Sender <newsletter@example.org>',
    sendsThrough: over.sendsThrough ?? 'resend',
    summary: { addresses: 157, turnedOff: 2, stoppedAll: 1, doNotSend: 1, willGet: 153, recent: over.recent ?? [SENT], waits: over.waits ?? null },
  }
}

/** A page inside a router and a signed-in person of this role. */
function draw(page: ReactElement, role: MemberRole = 'lca_admin') {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={{ role } as unknown as AuthContextValue}>{page}</AuthContext.Provider>
    </MemoryRouter>,
  )
}

/** Markup with React's generated ids read in the order they appear, so two drawings compare whatever ids came before. */
function normalised(html: string): string {
  const seen = new Map<string, string>()
  return html.replace(/(?::|«|_)r[0-9a-z]+(?::|»|_)/g, (id) => {
    if (!seen.has(id)) seen.set(id, `generated-${seen.size}`)
    return seen.get(id)!
  })
}

/** Today's flows, as a person meets them, with the markup after each step. */
async function statesOf(Page: typeof AdminEmailPage, embedded: boolean): Promise<string[]> {
  const { container } = draw(<Page embedded={embedded} />)
  const states: string[] = []
  await screen.findByText('Sample group message')
  states.push(normalised(container.innerHTML))
  fireEvent.click(screen.getByRole('button', { name: 'Preview email' }))
  fireEvent.change(screen.getByPlaceholderText('e.g. Fall tournament registration is open'), { target: { value: 'Sample newsletter one' } })
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: '<p>Example words for a sample message.</p>' } })
  fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'sender@example.org' } })
  states.push(normalised(container.innerHTML))
  fireEvent.click(screen.getByRole('button', { name: 'Review recipients' }))
  await screen.findByText(/This will email/)
  states.push(normalised(container.innerHTML))
  fireEvent.click(screen.getByRole('tab', { name: 'Specific people' }))
  states.push(normalised(container.innerHTML))
  fireEvent.click(screen.getByRole('button', { name: 'Choose people' }))
  await screen.findByText(/Nobody yet/)
  states.push(normalised(container.innerHTML))
  cleanup()
  return states
}

/** Every element whose own text holds these words. */
const holders = (words: string) => [...document.querySelectorAll('*')].filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').includes(words)))

beforeEach(() => {
  for (const mock of Object.values(api)) mock.mockReset()
  api.getClubs.mockResolvedValue(CLUBS)
  api.adminGetMembers.mockResolvedValue(MEMBERS)
  api.getCampaigns.mockResolvedValue(CAMPAIGNS)
  api.previewCampaignCount.mockResolvedValue({ count: 2, recipients: MEMBERS.map((m) => ({ id: m.id, email: m.email, full_name: m.full_name })) })
  api.getNewsletter.mockResolvedValue(newsletter())
  api.adminGetAuditLog.mockResolvedValue([])
  window.localStorage.clear()
  session.token = 'sample-session-token'
})
afterEach(() => {
  cleanup()
  flags.mailLists = false
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Group email with mailLists off', () => {
  it('draws today\'s two tabs and no word of the newsletter anywhere, and asks nothing of it', async () => {
    draw(<AdminEmailPage embedded />)
    await screen.findByText('Sample group message')
    expect(within(screen.getByRole('tablist')).getAllByRole('tab').map((t) => t.textContent)).toEqual(['Groups of members', 'Specific people'])
    expect(screen.getByText(TODAY_SUBTITLE)).toBeTruthy()
    const text = document.body.textContent ?? ''
    for (const words of [WORDS.tab, WORDS.subtitle, WORDS.guardrails, WORDS.bothLinks, WORDS.specificPeople, WORDS.waitsForSes, WORDS.send, 'Who gets it', 'Help', 'addresses will get it', 'Stop sending']) {
      expect(text, words).not.toContain(words)
    }
    expect(api.getNewsletter).not.toHaveBeenCalled()
  })

  it('reads and writes no key in the browser', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem')
    const set = vi.spyOn(Storage.prototype, 'setItem')
    draw(<AdminEmailPage embedded />)
    await screen.findByText('Sample group message')
    fireEvent.click(screen.getByRole('tab', { name: 'Specific people' }))
    expect(get).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(HELP_KEY)).toBeNull()
  })

  it.each([true, false])('draws the same markup as today\'s page, state by state, embedded %s', async (embedded) => {
    const today = await statesOf(AdminEmailPageToday, embedded)
    const now = await statesOf(AdminEmailPage, embedded)
    expect(now).toHaveLength(5)
    expect(now).toEqual(today)
  })
})

describe('Group email with mailLists on: the tabs', () => {
  beforeEach(() => {
    flags.mailLists = true
  })

  it('opens on the newsletter tab beside Specific people, with no Groups of members, no role, club or status menu and no Review recipients, on first render and after each tab change', async () => {
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    const tabs = () => within(screen.getByRole('tablist')).getAllByRole('tab')
    expect(tabs().map((t) => t.textContent)).toEqual([WORDS.tab, 'Specific people'])
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true')
    const noGroups = () => {
      for (const words of ['Groups of members', 'All roles', 'All clubs', 'Any status', 'Review recipients', 'Leave all three at their defaults to reach everyone.']) {
        expect(document.body.textContent, words).not.toContain(words)
      }
    }
    noGroups()
    fireEvent.click(screen.getByRole('tab', { name: 'Specific people' }))
    noGroups()
    expect(screen.getByRole('button', { name: 'Choose people' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: WORDS.tab }))
    noGroups()
    await waitFor(() => expect(api.getNewsletter).toHaveBeenCalledTimes(2))
  })

  it('gives the subtitle its new words, embedded and as a page, and today\'s words with the switch off', async () => {
    draw(<AdminEmailPage embedded />)
    expect(screen.getByText(WORDS.subtitle)).toBeTruthy()
    cleanup()
    draw(<AdminEmailPage />)
    expect(screen.getByText(WORDS.subtitle)).toBeTruthy()
    expect(document.body.textContent).not.toContain(TODAY_SUBTITLE)
    cleanup()
    flags.mailLists = false
    draw(<AdminEmailPage />)
    expect(screen.getByText(TODAY_SUBTITLE)).toBeTruthy()
  })

  it('has no filters, no review list, no search to add people and no typed-in addresses in the newsletter tab', async () => {
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    expect(screen.queryByPlaceholderText(/Add a member by name/)).toBeNull()
    expect(screen.queryByText(/This will email/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull()
    expect(screen.queryByText(/No account/)).toBeNull()
  })
})

describe('Group email with mailLists on: what the newsletter tab says', () => {
  beforeEach(() => {
    flags.mailLists = true
  })

  it('gives the count as one short line and the sender from the answer, with Who gets it closed until it is pressed', async () => {
    draw(<AdminEmailPage embedded />)
    expect(await screen.findByText('153 addresses will get it.')).toBeTruthy()
    expect(screen.getByText('It goes from Sample Sender <newsletter@example.org>.')).toBeTruthy()
    const who = screen.getByRole('button', { name: 'Who gets it' })
    expect(who.getAttribute('aria-expanded')).toBe('false')
    const region = document.getElementById(who.getAttribute('aria-controls') ?? '')!
    expect(region).toBeTruthy()
    expect(region.hidden).toBe(true)
    fireEvent.click(who)
    expect(who.getAttribute('aria-expanded')).toBe('true')
    expect(region.hidden).toBe(false)
    expect(region.textContent).toBe('Every address on an account with an active membership, once. Left out: 3 who turned the newsletter off and 1 that no longer receive mail.')
    fireEvent.click(who)
    expect(region.hidden).toBe(true)
  })

  it('opens Help by itself on the first visit, with the sentences that only explain inside it and nowhere else, and keeps it closed on the next visit until it is pressed', async () => {
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    const help = screen.getByRole('button', { name: 'Help' })
    expect(help.getAttribute('aria-expanded')).toBe('true')
    const region = document.getElementById(help.getAttribute('aria-controls') ?? '')!
    expect(region.tagName).toBe('SECTION')
    expect(region.hidden).toBe(false)
    expect(within(region).getByRole('heading', { name: 'Help' })).toBeTruthy()
    expect(region.getAttribute('role')).not.toBe('dialog')
    expect(region.contains(document.activeElement)).toBe(false)
    for (const words of [WORDS.guardrails, WORDS.bothLinks]) {
      expect(holders(words), words).toHaveLength(1)
      expect(region.contains(holders(words)[0]), words).toBe(true)
    }
    expect(window.localStorage.getItem(HELP_KEY)).not.toBeNull()
    // On Specific people, Help holds that tab's line, and the newsletter's lines are not drawn.
    fireEvent.click(screen.getByRole('tab', { name: 'Specific people' }))
    expect(holders(WORDS.specificPeople)).toHaveLength(1)
    expect(region.contains(holders(WORDS.specificPeople)[0])).toBe(true)
    expect(holders(WORDS.guardrails)).toEqual([])
    // Today's own line under Specific people stays where it is, outside Help.
    expect(region.textContent).not.toContain('Start from nobody')
    expect(screen.getByText(/^Start from nobody/)).toBeTruthy()
    cleanup()

    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    const again = screen.getByRole('button', { name: 'Help' })
    expect(again.getAttribute('aria-expanded')).toBe('false')
    const closed = document.getElementById(again.getAttribute('aria-controls') ?? '')!
    expect(closed.hidden).toBe(true)
    fireEvent.click(again)
    expect(again.getAttribute('aria-expanded')).toBe('true')
    expect(closed.hidden).toBe(false)
    fireEvent.click(again)
    expect(closed.hidden).toBe(true)
  })

  it('starts Help closed and still works in a browser that refuses storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage refused')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage refused')
    })
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    const help = screen.getByRole('button', { name: 'Help' })
    expect(help.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(help)
    expect(help.getAttribute('aria-expanded')).toBe('true')
  })

  it('draws the send button off while Resend sends, with the two sentences beside it, word for word', async () => {
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    const send = screen.getByRole('button', { name: WORDS.send }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    expect(holders(WORDS.waitsForSes)).toHaveLength(1)
    expect(send.parentElement!.contains(holders(WORDS.waitsForSes)[0])).toBe(true)
  })

  it('draws the preview\'s footer with the reason and both labels from domain/mail/footer.ts, underlined, and no postal address; Specific people\'s preview has none', async () => {
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    fireEvent.click(screen.getByRole('button', { name: 'Preview email' }))
    const words = LIST_FOOTER_WORDS[NEWSLETTER_LIST_ID]
    expect(screen.getByText(words.reason)).toBeTruthy()
    for (const label of [words.unsubscribeLabel, PREFERENCES_LABEL]) expect(screen.getByText(label).style.textDecoration, label).toBe('underline')
    const preview = screen.getByText(words.reason).closest('.rounded-xl') as HTMLElement
    expect(preview.textContent).not.toMatch(/\bP\.?\s?O\.?\s+Box\b|\bSuite\s+\d|\b\d{5}(?:-\d{4})?\b/i)
    fireEvent.click(screen.getByRole('tab', { name: 'Specific people' }))
    expect(screen.queryByText(words.reason)).toBeNull()
    expect(screen.queryByText(PREFERENCES_LABEL)).toBeNull()
    expect(EVENT_MAIL_STILL_COMES).not.toBe('')
  })
})

describe('Group email with mailLists on: the send, the stop and the recent sends', () => {
  beforeEach(() => {
    flags.mailLists = true
  })

  async function written() {
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    fireEvent.change(screen.getByPlaceholderText('e.g. Fall tournament registration is open'), { target: { value: 'Sample newsletter three' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: '<p>Example words for a sample newsletter.</p>' } })
  }

  it('asks with the count once Amazon SES sends, and calls sendNewsletter on the yes; a no sends nothing', async () => {
    api.getNewsletter.mockResolvedValue(newsletter({ sendsThrough: 'ses' }))
    api.sendNewsletter.mockResolvedValue({ campaignId: 'campaign-newsletter-3', totalRecipients: 153, status: 'sending' })
    const ask = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    await written()
    const send = screen.getByRole('button', { name: WORDS.send }) as HTMLButtonElement
    expect(send.disabled).toBe(false)
    expect(document.body.textContent).not.toContain(WORDS.waitsForSes)
    fireEvent.click(send)
    expect(ask).toHaveBeenLastCalledWith('Send to the LCA newsletter list (153 addresses)?')
    expect(api.sendNewsletter).not.toHaveBeenCalled()
    fireEvent.click(send)
    await waitFor(() => expect(api.sendNewsletter).toHaveBeenCalledWith({ subject: 'Sample newsletter three', bodyHtml: '<p>Example words for a sample newsletter.</p>' }))
    expect(api.createCampaign).not.toHaveBeenCalled()
  })

  it('shows a refusal in the server\'s own words in the page\'s error line, a status region in the page before its words', async () => {
    api.getNewsletter.mockResolvedValue(newsletter({ sendsThrough: 'ses' }))
    api.sendNewsletter.mockRejectedValue(new ApiError('The newsletter is already sending. Wait for it to finish.', 409))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await written()
    const regions = screen.getAllByRole('status')
    fireEvent.click(screen.getByRole('button', { name: WORDS.send }))
    const refusal = await screen.findByText('The newsletter is already sending. Wait for it to finish.')
    expect(refusal.getAttribute('role')).toBe('status')
    expect(regions).toContain(refusal)
  })

  it('offers Stop sending while a newsletter is sending, asks, calls stopNewsletter and says how many were not sent it', async () => {
    api.getNewsletter.mockResolvedValue(newsletter({ recent: [SENDING, SENT] }))
    api.stopNewsletter.mockResolvedValue({ stopped: 6 })
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(true)
    draw(<AdminEmailPage embedded />)
    const stop = await screen.findByRole('button', { name: 'Stop sending' })
    const status = within(stop.parentElement!).getAllByRole('status')[0]
    expect(status.textContent).toBe('')
    fireEvent.click(stop)
    expect(ask).toHaveBeenCalledWith("Stop the newsletter? Addresses not yet reached won't get it.")
    await waitFor(() => expect(status.textContent).toBe('Stopped. 6 addresses were not sent it.'))
    expect(api.stopNewsletter).toHaveBeenCalledTimes(1)
  })

  it('calls nothing when the stop is declined, and shows a refused stop\'s words as the server gives them, with no "Stopped." beside them', async () => {
    api.getNewsletter.mockResolvedValue(newsletter({ recent: [SENDING] }))
    api.stopNewsletter.mockRejectedValue(new ApiError('No newsletter is sending.', 409))
    const ask = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    draw(<AdminEmailPage embedded />)
    const stop = await screen.findByRole('button', { name: 'Stop sending' })
    fireEvent.click(stop)
    expect(ask).toHaveBeenCalledTimes(1)
    expect(api.stopNewsletter).not.toHaveBeenCalled()
    fireEvent.click(stop)
    expect(await screen.findByText('No newsletter is sending.')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Stopped\. \d+ addresses were not sent it\./)
    expect((stop as HTMLButtonElement).disabled).toBe(false)
  })

  it('writes the words a newsletter waits for only while it is sending', async () => {
    const waits = 'Not sent yet: list mail goes out through Amazon SES only.'
    api.getNewsletter.mockResolvedValue(newsletter({ recent: [SENT], waits }))
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    expect(holders(waits)).toEqual([])
  })

  it('draws no stop while nothing is sending', async () => {
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    expect(screen.queryByRole('button', { name: 'Stop sending' })).toBeNull()
  })

  it('draws the newsletter\'s recent sends in the history\'s rows, and the words a sending one waits for in the status region beside them', async () => {
    const waits = 'Not sent yet: list mail goes out through Amazon SES only.'
    api.getNewsletter.mockResolvedValue(newsletter({ recent: [SENDING, SENT], waits }))
    draw(<AdminEmailPage embedded />)
    // Since checkpoint M's review the words sit in the sending newsletter's own row, named by its subject.
    await screen.findByText('153 addresses will get it.')
    const history = screen.getByRole('heading', { name: 'Send history' }).parentElement!
    const words = await within(history).findByText(`\u201c${SENDING.subject}\u201d is waiting: ${waits}`)
    expect(words.closest('[role="status"]')).toBeTruthy()
    expect(history.contains(words)).toBe(true)
    for (const subject of [SENDING.subject, SENT.subject]) expect(within(history).getByText(subject)).toBeTruthy()
    expect(within(history).getByText(/Sending/)).toBeTruthy()
    expect(within(history).getByText('Completed')).toBeTruthy()
    // Group email's own history comes back with the Specific people tab.
    fireEvent.click(screen.getByRole('tab', { name: 'Specific people' }))
    expect(within(history).getByText('Sample group message')).toBeTruthy()
    expect(within(history).queryByText(new RegExp(waits))).toBeNull()
  })

  it('gives each row the time of its send as the site writes a stored time, in the recent sends and in the history alike, and today\'s words with the switch off', async () => {
    draw(<AdminEmailPage embedded />)
    // 3:00 PM in UTC, as the database wrote it, is 9:00 AM in Louisiana, the clocks having gone back on Sunday, November 1, 2026.
    // Since checkpoint M's review the count is in a span of its own, so the line is read whole.
    const line = (words: string) => (_: string, el: Element | null) => el?.tagName === 'P' && el.textContent === words
    expect(await screen.findByText(line('Tue, Nov 3, 2026 · 9:00 AM · 9 recipients'))).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Specific people' }))
    expect(await screen.findByText(line('Mon, Nov 2, 2026 · 9:00 AM · 2 recipients'))).toBeTruthy()
    cleanup()

    flags.mailLists = false
    const { container } = draw(<AdminEmailPage embedded />)
    await screen.findByText('Sample group message')
    expect(container.textContent).toContain(`${new Date(CAMPAIGNS[0].created_at).toLocaleString()} · 2 recipients`)
    expect(container.textContent).not.toContain('Mon, Nov 2, 2026')
  })

  it('reads the newsletter again every 3 seconds while one is sending, on the page\'s one timer', async () => {
    const timers: Array<() => void> = []
    vi.spyOn(globalThis, 'setInterval').mockImplementation(((callback: () => void, ms?: number) => {
      if (ms === 3000) timers.push(callback)
      return 1
    }) as unknown as typeof setInterval)
    api.getNewsletter.mockResolvedValue(newsletter({ recent: [SENDING] }))
    draw(<AdminEmailPage embedded />)
    await screen.findByText(SENDING.subject)
    await waitFor(() => expect(timers.length).toBeGreaterThan(0))
    const calls = api.getNewsletter.mock.calls.length
    timers.at(-1)!()
    await waitFor(() => expect(api.getNewsletter.mock.calls.length).toBe(calls + 1))
    expect(api.getCampaigns.mock.calls.length).toBeGreaterThan(1)
  })
})

describe('Group email with mailLists on: the test send', () => {
  beforeEach(() => {
    flags.mailLists = true
  })

  async function testWritten(role: MemberRole) {
    api.sendNewsletterTest.mockResolvedValue({ sent: true })
    api.sendTestCampaignEmail.mockResolvedValue({ sent: true })
    draw(<AdminEmailPage embedded />, role)
    await screen.findByText('153 addresses will get it.')
    fireEvent.change(screen.getByPlaceholderText('e.g. Fall tournament registration is open'), { target: { value: 'Sample newsletter three' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: '<p>Example words.</p>' } })
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'sender@example.org' } })
  }

  it('sends the newsletter\'s own test from the test box, and through Amazon SES only when an LCA admin ticks the box', async () => {
    await testWritten('lca_admin')
    const box = screen.getByRole('checkbox', { name: WORDS.sesBox }) as HTMLInputElement
    expect(box.checked).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }))
    await screen.findByText('Test email sent to sender@example.org.')
    expect(api.sendNewsletterTest).toHaveBeenLastCalledWith({ to: 'sender@example.org', subject: 'Sample newsletter three', bodyHtml: '<p>Example words.</p>' })
    fireEvent.click(box)
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }))
    await waitFor(() => expect(api.sendNewsletterTest).toHaveBeenLastCalledWith({ to: 'sender@example.org', subject: 'Sample newsletter three', bodyHtml: '<p>Example words.</p>', service: 'ses' }))
    expect(api.sendTestCampaignEmail).not.toHaveBeenCalled()
    // Specific people's test is today's.
    fireEvent.click(screen.getByRole('tab', { name: 'Specific people' }))
    expect(screen.queryByRole('checkbox', { name: WORDS.sesBox })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }))
    await waitFor(() => expect(api.sendTestCampaignEmail).toHaveBeenCalledWith({ email: 'sender@example.org', subject: 'Sample newsletter three', bodyHtml: '<p>Example words.</p>' }))
  })

  it('shows a failed test send\'s words as the server gives them, and sends no other test', async () => {
    api.sendNewsletterTest.mockRejectedValue(new ApiError('The test could not be sent.', 502))
    await testWritten('lca_admin')
    api.sendNewsletterTest.mockRejectedValue(new ApiError('The test could not be sent.', 502))
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }))
    expect(await screen.findByText('The test could not be sent.')).toBeTruthy()
    expect(screen.queryByText(/^Test email sent to/)).toBeNull()
    expect(api.sendNewsletterTest).toHaveBeenCalledTimes(1)
    expect(api.sendTestCampaignEmail).not.toHaveBeenCalled()
  })

  it('draws no Amazon SES box for the president, nor for anyone once Amazon SES sends', async () => {
    await testWritten('lca_observer')
    expect(screen.queryByRole('checkbox', { name: WORDS.sesBox })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }))
    await waitFor(() => expect(api.sendNewsletterTest).toHaveBeenCalledWith({ to: 'sender@example.org', subject: 'Sample newsletter three', bodyHtml: '<p>Example words.</p>' }))
    cleanup()
    api.getNewsletter.mockResolvedValue(newsletter({ sendsThrough: 'ses' }))
    await testWritten('lca_admin')
    expect(screen.queryByRole('checkbox', { name: WORDS.sesBox })).toBeNull()
  })
})

describe('the newsletter\'s four calls', () => {
  const calls = vi.fn()
  const answer = (body: unknown, status = 200) => {
    calls.mockImplementation(async () => new Response(JSON.stringify(body), { status }))
    vi.stubGlobal('fetch', calls)
  }
  const sent = (i = 0) => {
    const [url, init] = calls.mock.calls[i] as [string, RequestInit | undefined]
    return { url, method: init?.method ?? 'GET', headers: (init?.headers ?? {}) as Record<string, string>, body: init?.body }
  }

  it('send the sign-in header to their paths, and read a refusal as the server\'s own words', async () => {
    const admin = await vi.importActual<typeof import('@/areas/admin/api')>('@/areas/admin/api')
    const bearer = { 'Content-Type': 'application/json', Authorization: 'Bearer sample-session-token' }
    answer(newsletter())
    expect(await admin.getNewsletter()).toEqual(newsletter())
    expect(sent()).toEqual({ url: '/api/admin/mail/newsletter', method: 'GET', headers: bearer, body: undefined })
    calls.mockClear()
    answer({ campaignId: 'campaign-newsletter-3', totalRecipients: 153, status: 'sending' }, 201)
    await admin.sendNewsletter({ subject: 'Sample newsletter three', bodyHtml: '<p>Example words.</p>' })
    expect(sent()).toEqual({ url: '/api/admin/mail/newsletter', method: 'POST', headers: bearer, body: '{"subject":"Sample newsletter three","bodyHtml":"<p>Example words.</p>"}' })
    calls.mockClear()
    answer({ sent: true })
    await admin.sendNewsletterTest({ to: 'sender@example.org', subject: 'Sample newsletter three', bodyHtml: '<p>Example words.</p>', service: 'ses' })
    expect(sent()).toEqual({ url: '/api/admin/mail/newsletter/test', method: 'POST', headers: bearer, body: '{"to":"sender@example.org","subject":"Sample newsletter three","bodyHtml":"<p>Example words.</p>","service":"ses"}' })
    calls.mockClear()
    answer({ stopped: 4 })
    expect(await admin.stopNewsletter()).toEqual({ stopped: 4 })
    expect(sent()).toEqual({ url: '/api/admin/mail/newsletter/stop', method: 'POST', headers: bearer, body: undefined })
    answer({ error: 'No newsletter is sending.' }, 409)
    await expect(admin.stopNewsletter()).rejects.toMatchObject({ message: 'No newsletter is sending.', status: 409 })
  })
})

describe('the audit log\'s label for a stopped newsletter', () => {
  it('reads "Stopped a newsletter", and the Group email filter asks for it beside a sent one', async () => {
    const entry: ApiAuditEntry = {
      id: 'audit-sample', actor_id: 'member-1', actor_email: 'player.one@example.org', action: 'group_email_stopped', target_member_id: null,
      target_label: 'Sample newsletter two', detail: JSON.stringify({ campaign_id: 'campaign-newsletter-2', stopped: 6 }), created_at: '2026-11-03 15:10:00',
    }
    api.adminGetAuditLog.mockResolvedValue([entry])
    render(<AuditLogPanel />)
    expect(await screen.findByText('Stopped a newsletter')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Group email' }))
    await waitFor(() => expect(api.adminGetAuditLog).toHaveBeenLastCalledWith({ action: 'group_email_sent,group_email_stopped', limit: 200 }))
  })
})

describe('Group email with mailLists on: checkpoint M\'s review (K\'s decision 52, part B, and the media manager\'s test)', () => {
  beforeEach(() => {
    flags.mailLists = true
  })

  /** The class an element and every element around it carry, read up to the page. */
  const classesUp = (el: Element | null): string => (el ? `${el.getAttribute('class') ?? ''} ${classesUp(el.parentElement)}` : '')
  const SMALL = /(?:^|\s)text-(?:xs|\[(?:9|10|11|12|13)px\])(?:\s|$)/

  it('draws the tab\'s words at 14px: the Help body, the count line, the sender, the notes under the form and the reason Send is off', async () => {
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    fireEvent.click(screen.getByRole('button', { name: 'Preview email' }))
    for (const words of [
      WORDS.guardrails, WORDS.bothLinks, ' addresses will get it.', 'It goes from ', WORDS.waitsForSes,
      'Send yourself a test before the real thing', 'Test emails are marked [TEST]', "This is how it will look in the recipient's inbox:", WORDS.sesBox,
    ]) {
      const [holder] = holders(words)
      expect(holder, words).toBeTruthy()
      const own = holder.getAttribute('class') ?? ''
      const nearest = own.match(/text-(?:sm|xs|base|\[\d+px\])/) ? own : classesUp(holder)
      expect(nearest, words).toMatch(/(?:^|\s)text-sm(?:\s|$)/)
      expect(own, words).not.toMatch(SMALL)
    }
  })

  it('makes the Help and Who gets it openers 44px tall, and on a phone the tab\'s buttons, Preview email, Send test and Send', async () => {
    api.getNewsletter.mockResolvedValue(newsletter({ recent: [SENDING, SENT] }))
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    for (const name of ['Help', 'Who gets it']) expect(screen.getByRole('button', { name }).getAttribute('class'), name).toMatch(/(?:^|\s)min-h-11(?:\s|$)/)
    const tall = [...screen.getAllByRole('tab'), ...['Preview email', 'Send test', WORDS.send, 'Stop sending'].map((name) => screen.getByRole('button', { name }))]
    for (const control of tall) expect(control.getAttribute('class'), control.textContent ?? '').toMatch(/(?:^|\s)max-sm:min-h-11(?:\s|$)/)
  })

  it('names the newsletter that waits by its subject beside its own counts, and gives the same words beside the Send button it holds back', async () => {
    const waits = 'Not sent yet: the mail key is missing on this deployment.'
    api.getNewsletter.mockResolvedValue(newsletter({ sendsThrough: 'ses', recent: [SENDING, SENT], waits }))
    draw(<AdminEmailPage embedded />)
    const line = `\u201c${SENDING.subject}\u201d is waiting: ${waits}`
    const both = await screen.findAllByText(line)
    expect(both).toHaveLength(2)
    const row = screen.getByText(SENDING.subject).closest('.rounded-xl')!
    expect(row.contains(both[1]) || row.contains(both[0])).toBe(true)
    const send = screen.getByRole('button', { name: WORDS.send }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    expect(both.some((el) => send.parentElement!.contains(el))).toBe(true)
  })

  it('says beside Send, off, that a newsletter is sending while it waits for no reason of its own, in the server\'s words', async () => {
    api.getNewsletter.mockResolvedValue(newsletter({ sendsThrough: 'ses', recent: [SENDING] }))
    const { ALREADY_SENDING } = await import('../../functions/utils/mail/newsletterAnswers')
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    const send = screen.getByRole('button', { name: WORDS.send }) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    expect(within(send.parentElement!).getByText(ALREADY_SENDING)).toBeTruthy()
  })

  it('keeps a recent send\'s count with its noun, the number and "recipients" in one span that does not break', async () => {
    draw(<AdminEmailPage embedded />)
    const count = await screen.findByText('9 recipients')
    expect(count.tagName).toBe('SPAN')
    expect(count.getAttribute('class')).toBe('whitespace-nowrap')
  })

  it('writes the reason beside Send from the one copy the server answers with, with no word of the page\'s own', async () => {
    const server = await import('../../functions/utils/mail/newsletterAnswers')
    const words = await import('@domain/mail/newsletterWords')
    expect(words.WAITS_FOR_SES).toBe(server.WAITS_FOR_SES)
    expect(words.ALREADY_SENDING).toBe(server.ALREADY_SENDING)
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    expect(holders(server.WAITS_FOR_SES)).toHaveLength(1)
    expect(document.body.textContent).not.toContain('send yourself a test now')
  })

  it('draws the media manager\'s test with no address box: it goes to their own address, shown whole, with the page\'s words on its button', async () => {
    api.sendNewsletterTest.mockResolvedValue({ sent: true })
    const who = { role: 'member', member: { id: 'member-sample-mm', email: 'player.one@example.org' }, user: { id: 'member-sample-mm', email: 'player.one@example.org' } }
    render(
      <MemoryRouter>
        <AuthContext.Provider value={who as unknown as AuthContextValue}><AdminEmailPage embedded mediaManager={{ secondFactor: true }} /></AuthContext.Provider>
      </MemoryRouter>,
    )
    await screen.findByText('153 addresses will get it.')
    expect(screen.queryByPlaceholderText('you@example.com')).toBeNull()
    expect(screen.getByText('player.one@example.org')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('e.g. Fall tournament registration is open'), { target: { value: 'Sample newsletter three' } })
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: '<p>Example words.</p>' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send test' }))
    await waitFor(() => expect(api.sendNewsletterTest).toHaveBeenCalledWith({ to: 'player.one@example.org', subject: 'Sample newsletter three', bodyHtml: '<p>Example words.</p>' }))
    expect(await screen.findByText('Test email sent to player.one@example.org.')).toBeTruthy()
  })
})

describe('the newsletter tab\'s sizes, read from the classes it wears and compiled by Tailwind (checkpoint M\'s review, K\'s decision 52, B3)', () => {
  beforeEach(() => {
    flags.mailLists = true
  })

  /** The pixels an element's words are drawn at: the size class it wears, or the nearest around it, as Tailwind compiles it. */
  async function fontPx(el: Element): Promise<number> {
    const token = sizeClassOf(el)
    // Words that wear no size class are drawn at the page's own size, the browser's default 16px.
    if (token === null) return 16
    const set = setBy((await builder())([token]), token, 'font-size')
    expect(set, token).not.toBeNull()
    return set!.px
  }

  /** Every element that holds words of its own, the email preview's own look and the page's titles apart. */
  function wordsOnTheTab(root: ParentNode = document.body): Element[] {
    const preview = screen.queryByText("This is how it will look in the recipient's inbox:")?.nextElementSibling
    return [...root.querySelectorAll('*')].filter(
      (el) =>
        !/^H[1-3]$/.test(el.tagName) &&
        !preview?.contains(el) &&
        [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim() !== ''),
    )
  }

  it('is 14px for the Help body, the count line, the sender line, the notes under the form and the reasons Send is off', async () => {
    api.getNewsletter.mockResolvedValue(newsletter({ sendsThrough: 'ses', recent: [SENDING], waits: 'Not sent yet: the mail key is missing on this deployment.' }))
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    fireEvent.click(screen.getByRole('button', { name: 'Preview email' }))
    fireEvent.click(screen.getByRole('button', { name: 'Who gets it' }))
    for (const words of [WORDS.guardrails, WORDS.bothLinks, ' addresses will get it.', 'It goes from ', 'Every address on an account', 'Send yourself a test before the real thing', 'Test emails are marked [TEST]', "This is how it will look in the recipient's inbox:", 'is waiting: Not sent yet']) {
      const [holder] = holders(words)
      expect(holder, words).toBeTruthy()
      expect(await fontPx(holder!), words).toBeGreaterThanOrEqual(14)
    }
    expect(await fontPx(holders('Add a subject and a message before sending.')[0]), 'the reason Send is off with nothing written').toBeGreaterThanOrEqual(14)
  })

  it('draws no word of the form under 14px, its buttons among them, but for the email preview, which is the email\'s own look', async () => {
    api.getNewsletter.mockResolvedValue(newsletter({ recent: [] }))
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    fireEvent.click(screen.getByRole('button', { name: 'Preview email' }))
    const small: string[] = []
    for (const el of wordsOnTheTab()) {
      const px = await fontPx(el)
      if (px < 14) small.push(`${px}px <${el.tagName.toLowerCase()}> ${(el.textContent ?? '').trim().slice(0, 40)}`)
    }
    expect(small).toEqual([])
  })

  it('draws the newsletter\'s recent sends at 14px or more: the time and count line, the status and the counts a person reads', async () => {
    api.getNewsletter.mockResolvedValue(newsletter({ sendsThrough: 'ses', recent: [SENDING, SENT], waits: 'Not sent yet: the mail key is missing on this deployment.' }))
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    const history = screen.getByRole('heading', { name: 'Send history' }).parentElement!
    const small: string[] = []
    for (const el of wordsOnTheTab(history)) {
      const px = await fontPx(el)
      if (px < 14) small.push(`${px}px <${el.tagName.toLowerCase()}> ${(el.textContent ?? '').trim().slice(0, 40)}`)
    }
    expect(small).toEqual([])
  })

  it('makes the Help and Who gets it openers 44px tall at every width', async () => {
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    const css = (await builder())(['min-h-11'])
    expect(setBy(css, 'min-h-11', 'min-height')).toEqual({ px: 44, media: null })
    for (const name of ['Help', 'Who gets it']) {
      expect(screen.getByRole('button', { name }).getAttribute('class')?.split(/\s+/), name).toContain('min-h-11')
    }
  })

  it('makes the tab\'s buttons, Preview email, Send test, Send and Stop sending 44px tall under 40rem, the width a phone has', async () => {
    api.getNewsletter.mockResolvedValue(newsletter({ recent: [SENDING, SENT] }))
    draw(<AdminEmailPage embedded />)
    await screen.findByText('153 addresses will get it.')
    const css = (await builder())(['max-sm:min-h-11'])
    expect(setBy(css, 'max-sm:min-h-11', 'min-height')).toEqual({ px: 44, media: 'width < 40rem' })
    const controls = [...screen.getAllByRole('tab'), ...['Preview email', 'Send test', WORDS.send, 'Stop sending'].map((name) => screen.getByRole('button', { name }))]
    for (const control of controls) expect(control.getAttribute('class')?.split(/\s+/), control.textContent ?? '').toContain('max-sm:min-h-11')
  })
})
