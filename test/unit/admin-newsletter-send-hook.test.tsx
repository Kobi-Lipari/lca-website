// @vitest-environment jsdom
//
// The newsletter page's count and send state (src/areas/admin/newsletter/useSend.ts),
// with the server answered by a stand-in for fetch:
// - With mailPageSend off it reads the count once as the page opens, as the
//   page always has, and never again; its state is 'off' and it says nothing.
// - With it on it keeps what the newsletter tab's read gives, reads again
//   every 3 seconds only while a newsletter is sending, and says a line only
//   when a send ends, starts to wait or waits for a new reason, or when the
//   page asks it to. A read in between never says anything.
// Every word here is made up.
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'sample-token' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))

const flags = vi.hoisted(() => ({ mailPageSend: false }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get mailPageSend() {
        return flags.mailPageSend
      },
    },
  }
})

const { useNewsletterSend } = await import('@/areas/admin/newsletter/useSend')

const NEWSLETTER_URL = '/api/admin/mail/newsletter'

interface Row { id: string; subject: string; totalRecipients: number; sentCount: number; status: 'sending' | 'completed' | 'failed' }
const row = (extra: Partial<Row> = {}) => ({
  id: 'campaign-sample-1', subject: 'Sample subject', totalRecipients: 155, sentCount: 40, failedCount: 0, skippedCount: 0,
  status: 'sending', createdAt: '2026-11-24 12:00:00', completedAt: null, ...extra,
})
const tab = (recent: unknown[] = [], extra: { sendsThrough?: string; waits?: string | null; willGet?: number } = {}) => ({
  list: { id: 'list-sample', name: 'Sample list' },
  from: 'Sample sender <news@example.org>',
  sendsThrough: extra.sendsThrough ?? 'ses',
  summary: { addresses: 160, turnedOff: 2, stoppedAll: 2, doNotSend: 1, willGet: extra.willGet ?? 155, recent, waits: extra.waits ?? null },
})

type Given = { status: number; body: unknown } | 'network'
let answers: Given[] = []
let reads = 0
beforeEach(() => {
  flags.mailPageSend = false
  answers = [{ status: 200, body: tab() }]
  reads = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url !== NEWSLETTER_URL || (init?.method ?? 'GET') !== 'GET') return new Response('{}', { status: 404 })
    reads += 1
    const answer = answers.length > 1 ? answers.shift()! : answers[0]
    if (answer === 'network') throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const settle = () => act(async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve()
})
const wait = (ms: number) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms)
})
const REACH = { willGet: 155, addresses: 160, turnedOff: 2, stoppedAll: 2, doNotSend: 1 }

describe('with mailPageSend off', () => {
  it('reads the count once as the page opens and never again, even while a newsletter is sending', async () => {
    vi.useFakeTimers()
    answers = [{ status: 200, body: tab([row()]) }]
    const { result } = renderHook(() => useNewsletterSend(true))
    await settle()
    expect(result.current.reach).toEqual(REACH)
    expect(result.current.state).toBe('off')
    await wait(10_000)
    expect(reads).toBe(1)
    expect(result.current.said).toBeNull()
  })

  it('reads nothing when the person may not call, and says failed when the read fails', async () => {
    const quiet = renderHook(() => useNewsletterSend(false))
    await settle()
    expect(reads).toBe(0)
    expect(quiet.result.current.reach).toBeNull()
    quiet.unmount()
    answers = ['network']
    const { result } = renderHook(() => useNewsletterSend(true))
    await settle()
    expect(result.current.reach).toBe('failed')
    expect(result.current.state).toBe('off')
  })
})

describe('with mailPageSend on', () => {
  beforeEach(() => {
    flags.mailPageSend = true
  })

  it('is unknown while the read is on its way and when it fails, then ready through Amazon SES', async () => {
    const { result } = renderHook(() => useNewsletterSend(true))
    expect(result.current.state).toBe('unknown')
    await settle()
    expect(result.current.state).toBe('ready')
    expect(result.current.willGet).toBe(155)
    expect(result.current.sendsThrough).toBe('ses')
    answers = ['network']
    const failed = renderHook(() => useNewsletterSend(true))
    await settle()
    expect(failed.result.current.state).toBe('unknown')
  })

  it('waits while the newsletter goes through Resend', async () => {
    answers = [{ status: 200, body: tab([], { sendsThrough: 'resend' }) }]
    const { result } = renderHook(() => useNewsletterSend(true))
    await settle()
    expect(result.current.state).toBe('waits')
  })

  it('a page state the press sets is the state until it is cleared', async () => {
    const { result } = renderHook(() => useNewsletterSend(true))
    await settle()
    act(() => result.current.setLocal('asking'))
    expect(result.current.state).toBe('asking')
    act(() => result.current.setLocal(null))
    expect(result.current.state).toBe('ready')
  })

  it('reads every 3 seconds only while sending, says nothing on a read in between, and says the end once', async () => {
    vi.useFakeTimers()
    answers = [
      { status: 200, body: tab([row({ sentCount: 40 })]) },
      { status: 200, body: tab([row({ sentCount: 90 })]) },
      { status: 200, body: tab([row({ sentCount: 155, status: 'completed' })]) },
    ]
    const { result } = renderHook(() => useNewsletterSend(true))
    await settle()
    expect(result.current.state).toBe('sending')
    expect(result.current.sending?.sentCount).toBe(40)
    // A second person who opens the page mid-send sees the progress with an empty line.
    expect(result.current.said).toBeNull()
    await wait(2_999)
    expect(reads).toBe(1)
    await wait(1)
    expect(reads).toBe(2)
    expect(result.current.sending?.sentCount).toBe(90)
    expect(result.current.said).toBeNull()
    await wait(3_000)
    expect(reads).toBe(3)
    expect(result.current.state).toBe('ready')
    expect(result.current.said).toMatchObject({ words: 'Sent to 155 people.', tone: 'sent', fresh: true })
    const seq = result.current.said?.seq
    await wait(15_000)
    expect(reads).toBe(3)
    expect(result.current.said?.seq).toBe(seq)
  })

  it('says how many of how many a send that ended short reached, and a send that reached nobody as not sent', async () => {
    vi.useFakeTimers()
    answers = [
      { status: 200, body: tab([row()]) },
      { status: 200, body: tab([row({ sentCount: 150, status: 'completed' })]) },
    ]
    const short = renderHook(() => useNewsletterSend(true))
    await settle()
    await wait(3_000)
    expect(short.result.current.said).toMatchObject({ words: 'Sent to 150 of 155 people.', tone: 'sent' })
    short.unmount()
    answers = [
      { status: 200, body: tab([row({ sentCount: 0 })]) },
      { status: 200, body: tab([row({ sentCount: 0, status: 'failed' })]) },
    ]
    const none = renderHook(() => useNewsletterSend(true))
    await settle()
    await wait(3_000)
    // A send that reached nobody says it could not be sent and what to do, not a count of none.
    expect(none.result.current.said).toMatchObject({ words: 'The newsletter could not be sent. Try again in a moment.', tone: 'not-sent' })
    none.unmount()
    answers = [
      { status: 200, body: tab([row({ sentCount: 0, totalRecipients: 1 })]) },
      { status: 200, body: tab([row({ sentCount: 1, totalRecipients: 1, status: 'completed' })]) },
    ]
    const one = renderHook(() => useNewsletterSend(true))
    await settle()
    await wait(3_000)
    expect(one.result.current.said).toMatchObject({ words: 'Sent to 1 person.', tone: 'sent' })
  })

  it('says a wait once when it begins and again only when its reason changes', async () => {
    vi.useFakeTimers()
    answers = [
      { status: 200, body: tab([row()]) },
      { status: 200, body: tab([row()], { waits: 'Sample reason one.' }) },
      { status: 200, body: tab([row()], { waits: 'Sample reason one.' }) },
      { status: 200, body: tab([row()], { waits: 'Sample reason two.' }) },
    ]
    const { result } = renderHook(() => useNewsletterSend(true))
    await settle()
    await wait(3_000)
    expect(result.current.said).toMatchObject({ words: '“Sample subject” is waiting. Sample reason one.', tone: 'note' })
    const seq = result.current.said?.seq
    await wait(3_000)
    expect(result.current.said?.seq).toBe(seq)
    await wait(3_000)
    expect(result.current.said).toMatchObject({ words: '“Sample subject” is waiting. Sample reason two.' })
  })

  it('after a stop says how many were sent, from a fresh read, and no end line follows', async () => {
    vi.useFakeTimers()
    answers = [
      { status: 200, body: tab([row()]) },
      { status: 200, body: tab([row({ status: 'completed' })]) },
    ]
    const { result } = renderHook(() => useNewsletterSend(true))
    await settle()
    await act(async () => {
      await result.current.afterStop()
    })
    expect(result.current.said).toMatchObject({ words: 'Stopped. 40 of 155 were sent.', tone: 'note', fresh: true })
    const seq = result.current.said?.seq
    await wait(9_000)
    expect(result.current.said?.seq).toBe(seq)
  })

  it('after a stop whose read fails, says how many were sent on the next read that shows it closed, once', async () => {
    vi.useFakeTimers()
    answers = [
      { status: 200, body: tab([row()]) },
      'network',
      { status: 200, body: tab([row({ status: 'completed' })]) },
    ]
    const { result } = renderHook(() => useNewsletterSend(true))
    await settle()
    await act(async () => {
      await result.current.afterStop()
    })
    expect(result.current.said).toBeNull()
    await wait(3_000)
    expect(result.current.said).toMatchObject({ words: 'Stopped. 40 of 155 were sent.', tone: 'note', fresh: true })
    const seq = result.current.said?.seq
    await wait(9_000)
    expect(result.current.said?.seq).toBe(seq)
  })

  it('says what the page asks, each time with a later number, and marks it said', async () => {
    const { result } = renderHook(() => useNewsletterSend(true))
    await settle()
    act(() => result.current.say('Sample line one.', 'note'))
    const first = result.current.said!
    expect(first).toMatchObject({ words: 'Sample line one.', tone: 'note', fresh: true })
    act(() => result.current.markSaid())
    expect(result.current.said).toMatchObject({ seq: first.seq, fresh: false })
    act(() => result.current.say('Sample line one.', 'note'))
    expect(result.current.said!.seq).toBeGreaterThan(first.seq)
  })

  it('a fresh read gives the new count and puts it on the page; a failed one answers null and keeps the last', async () => {
    answers = [{ status: 200, body: tab() }, { status: 200, body: tab([], { willGet: 154 }) }, 'network']
    const { result } = renderHook(() => useNewsletterSend(true))
    await settle()
    let fresh: unknown
    await act(async () => {
      fresh = await result.current.reread()
    })
    expect((fresh as { summary: { willGet: number } }).summary.willGet).toBe(154)
    expect(result.current.willGet).toBe(154)
    await act(async () => {
      fresh = await result.current.reread()
    })
    expect(fresh).toBeNull()
    expect(result.current.willGet).toBe(154)
    expect(result.current.state).toBe('ready')
  })

  it('stops reading when the page is left', async () => {
    vi.useFakeTimers()
    answers = [{ status: 200, body: tab([row()]) }]
    const { unmount } = renderHook(() => useNewsletterSend(true))
    await settle()
    unmount()
    await wait(9_000)
    expect(reads).toBe(1)
  })
})
