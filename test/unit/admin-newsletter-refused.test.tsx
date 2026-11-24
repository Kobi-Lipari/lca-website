// @vitest-environment jsdom
//
// Words the server refused in its own words, a 400 or a 413 (WS16 part two,
// page step 4, second half), and what the page does and does not send of its
// own accord after one: the cases the other save file does not hold.
//
// - Not sent again when the person asks for a save now, when their words are
//   the refused ones with only the spaces the server trims changed, or when a
//   failure of another kind came between.
// - Words typed while a save was on its way, which is then refused, are not
//   held back with it: they go after their own pause.
// - A letter put on the page, read again, lets the refused words be sent as
//   words the person has now typed.
// Every name, word and time here is made up.
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'sample-token' } } }) } },
}))

const { useIssue, SAVE_PAUSE_MS } = await import('@/areas/admin/newsletter/useIssue')

const ISSUE_URL = '/api/admin/mail/newsletter/issue'
const BODY = '<h2>Sample heading one</h2><p>Sample words</p>'

interface Call { url: string; method: string; body: Record<string, unknown> | null; keepalive: boolean; authorization: string | null }
/** An answer: its status and the body written as JSON, or `raw` written as it stands, as an empty body or a page is. */
interface Answer { status: number; body: unknown; raw?: string }
let calls: Call[] = []
let gets: Array<Answer | Promise<Answer>> = []
let puts: Array<Answer | Promise<Answer>> = []
const saves = () => calls.filter((c) => c.method === 'PUT')

function letter(over: Record<string, unknown> = {}) {
  return {
    issue: { id: 'sample-letter-1', version: 3, monthLabel: 'December 2026', subject: 'LCA Newsletter · December 2026', preheader: '', bodyHtml: BODY, createdAt: '2026-11-13 15:00:00', updatedAt: '2026-11-13 20:15:00', ...over },
    state: 'draft', lastSavedBy: 'Player Two', lastSavedAt: '2026-11-13 20:15:00',
  }
}
const saved = (version: number, over: Record<string, unknown> = {}): Answer => ({ status: 200, body: { id: 'sample-letter-1', version, savedAt: '2026-11-13 21:00:00', bodyHtml: null, ...over } })

/** An answer held back, as a slow network holds one, and the way to let it go. */
function held(answer: Answer): { answer: Promise<Answer>; release: () => Promise<void> } {
  let release!: () => void
  const later = new Promise<Answer>((resolve) => {
    release = () => resolve(answer)
  })
  return { answer: later, release: async () => act(async () => release()) }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-11-13T21:00:00Z'))
  calls = []
  gets = []
  puts = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const headers = new Headers(init?.headers)
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null, keepalive: init?.keepalive === true, authorization: headers.get('Authorization') })
    if (url !== ISSUE_URL) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    const queue = method === 'PUT' ? puts : gets
    const answer = await (queue.shift() ?? { status: 500, body: { error: 'Something went wrong' } })
    if (answer.status === 0) throw new TypeError('Failed to fetch')
    return new Response(answer.raw ?? JSON.stringify(answer.body), { status: answer.status })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** Lets the calls on the way answer, without moving the clock. */
const settle = () => act(async () => {
  await vi.advanceTimersByTimeAsync(0)
})
/** Moves the clock, letting each call on the way answer as it goes. */
const wait = (ms: number) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms)
})

async function opened(answer: unknown = letter()) {
  gets.push({ status: 200, body: answer })
  const view = renderHook(() => useIssue(true))
  await settle()
  expect(view.result.current.status).toBe('ready')
  return view
}
const words = (over: Partial<{ monthLabel: string; subject: string; preheader: string; bodyHtml: string }> = {}) => ({
  monthLabel: 'December 2026', subject: 'LCA Newsletter · December 2026', preheader: '', bodyHtml: BODY, ...over,
})


const REFUSAL = 'This letter is too long for one email. Make it shorter, then save again.'
const refuse = (status: 400 | 413): Answer => (status === 413 ? { status, body: { error: REFUSAL } } : { status, body: { error: 'Some fields are missing or not valid.', fields: { subject: 'Keep the subject to 200 characters.' } } })
const refusedLine = (status: 400 | 413) => ({ kind: 'refused', words: status === 413 ? REFUSAL : 'Keep the subject to 200 characters.' })

describe('refused words are not sent again by the page of its own accord', () => {
  for (const status of [413, 400] as const) {
    it(`sends nothing when a save is asked for again after a ${status}, and says the refusal again each time`, async () => {
      const { result } = await opened()
      puts.push(refuse(status))
      act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Refused</p>` })))
      await wait(SAVE_PAUSE_MS)
      expect(saves()).toHaveLength(1)
      const line = result.current.line
      expect(line).toMatchObject(refusedLine(status))
      for (let again = 0; again < 3; again++) {
        act(() => result.current.saveNow())
        await settle()
        expect(saves()).toHaveLength(1)
        expect(result.current.line).toEqual(line)
      }
      // The words are changed: that is a change, and it sends.
      puts.push(saved(4))
      act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Refused, then mended</p>` })))
      await wait(SAVE_PAUSE_MS)
      expect(saves()).toHaveLength(2)
      expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
    })
  }

  it('sends nothing for refused words that differ only in the spaces the server trims', async () => {
    const { result } = await opened()
    puts.push(refuse(413))
    act(() => result.current.edit(words({ subject: 'Sample subject one', bodyHtml: `${BODY}<p>Refused</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(saves()).toHaveLength(1)
    act(() => result.current.edit(words({ subject: '  Sample subject one  ', bodyHtml: `${BODY}<p>Refused</p>` })))
    await wait(SAVE_PAUSE_MS * 2)
    expect(saves()).toHaveLength(1)
    expect(result.current.line).toEqual({ kind: 'refused', words: REFUSAL })
  })

  it('still sends words typed while the refused save was on its way, after their own pause, and not the refused words when typing goes back to them', async () => {
    const { result } = await opened()
    const first = held(refuse(400))
    puts.push(first.answer, saved(4))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Refused</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(saves()).toHaveLength(1)
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Newer words</p>` })))
    await first.release()
    await settle()
    expect(result.current.line).toMatchObject(refusedLine(400))
    await wait(SAVE_PAUSE_MS)
    expect(saves()).toHaveLength(2)
    expect(saves()[1].body).toMatchObject({ version: 3, bodyHtml: `${BODY}<p>Newer words</p>` })
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
    // The save that answered clears the refusal: the same words, typed again, are the person's own change from what is
    // stored now, and go; the server answers for them as it did before.
    puts.push(refuse(400))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Refused</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(saves()).toHaveLength(3)
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Refused, and more</p>` })))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Refused</p>` })))
    await wait(SAVE_PAUSE_MS * 2)
    expect(saves()).toHaveLength(3)
    expect(result.current.line).toMatchObject(refusedLine(400))
  })

  it('keeps refused words from being sent after a failure of another kind on other words, and says each as it is', async () => {
    const { result } = await opened()
    puts.push(refuse(413), { status: 500, body: { error: 'Something went wrong' } })
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Refused</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(result.current.line).toEqual({ kind: 'refused', words: REFUSAL })
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Other words</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(saves()).toHaveLength(2)
    expect(result.current.line).toEqual({ kind: 'failed' })
    // Typing goes back to the words the server refused: they are not sent, and the line says what the server said.
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Refused</p>` })))
    await wait(SAVE_PAUSE_MS * 2)
    expect(saves()).toHaveLength(2)
    expect(result.current.line).toEqual({ kind: 'refused', words: REFUSAL })
  })

  it('lets refused words go once the letter has been read again and put on the page, as words the person types afresh', async () => {
    const { result } = await opened()
    puts.push(refuse(413), saved(5))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Refused</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(saves()).toHaveLength(1)
    gets.push({ status: 200, body: letter({ version: 4 }) })
    await act(async () => result.current.reload())
    await settle()
    expect(result.current.status).toBe('ready')
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Refused</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(saves()).toHaveLength(2)
    expect(saves()[1].body).toMatchObject({ version: 4, bodyHtml: `${BODY}<p>Refused</p>` })
  })
})
