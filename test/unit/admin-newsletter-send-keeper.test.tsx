// @vitest-environment jsdom
//
// The letter's keeper (src/areas/admin/newsletter/useIssue.ts) for the
// newsletter page's own Send (WS16 part two, page step 6, send half), with
// the server answered by a stand-in for fetch:
// - prepareSend saves first, then names the stored letter by its id and
//   version, or says why nothing can be asked: no letter yet, or a letter
//   with no subject or no words a person wrote. It sends nothing.
// - sendLetter posts exactly the id and version named, once; sent, it reads
//   the open letter and puts it on the page; a 409 is a conflict that stops
//   the saving; any other refusal keeps the server's words and status.
// - afterNoAnswer reads the open letter and says whether it moved on.
// Every word here is made up.
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STARTER_IDS, defaultSubject } from '@domain/mail/letter'
import { starterLetter } from '../../functions/utils/mail/issues'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: { access_token: 'sample-token' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}))

const { useIssue, SAVE_PAUSE_MS } = await import('@/areas/admin/newsletter/useIssue')

const ISSUE_URL = '/api/admin/mail/newsletter/issue'
const SEND_URL = '/api/admin/mail/newsletter/issue/send'
const MONTH = 'December 2026'
const BODY = '<h2>Sample heading one</h2><p>Sample words one</p>'

interface Answer { status: number; body: unknown }
type Given = Answer | 'network'
let answers: Record<string, Given[]> = {}
let calls: string[] = []
let sends: unknown[] = []
const on = (method: string, url: string, ...list: Given[]) => {
  answers[`${method} ${url}`] = list
}
const letter = (extra: Record<string, unknown> = {}) => ({
  issue: { id: 'sample-letter-1', version: 3, monthLabel: MONTH, subject: 'Sample subject', preheader: '', bodyHtml: BODY, createdAt: '2026-11-16 15:00:00', updatedAt: '2026-11-16 20:15:00', ...extra },
  state: 'draft', lastSavedBy: 'Player Two', lastSavedAt: '2026-11-16 20:15:00',
})
const NONE = { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null }

beforeEach(() => {
  answers = {}
  calls = []
  sends = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    if (method === 'POST' && url === SEND_URL) sends.push(JSON.parse(String(init?.body)))
    const list = answers[`${method} ${url}`]
    const answer = (list && list.length > 1 ? list.shift() : list?.[0]) ?? { status: 404, body: { error: 'Not found' } }
    if (answer === 'network') throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
  on('GET', ISSUE_URL, { status: 200, body: letter() })
  on('POST', SEND_URL, { status: 201, body: { campaignId: 'campaign-sample-1', totalRecipients: 155, status: 'sending' } })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const settle = (ms = 30) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)))
async function theKeeper() {
  const hook = renderHook(() => useIssue(true))
  await settle()
  expect(hook.result.current.status).toBe('ready')
  return hook
}

describe('prepareSend', () => {
  it('names the stored letter by its id and version, with its subject, and sends nothing', async () => {
    const { result } = await theKeeper()
    let ready: unknown
    await act(async () => {
      ready = await result.current.prepareSend()
    })
    expect(ready).toEqual({ named: { issueId: 'sample-letter-1', version: 3 }, subject: 'Sample subject' })
    expect(sends).toEqual([])
    expect(calls.filter((call) => call.startsWith('POST'))).toEqual([])
  })

  it('answers empty for a letter the server holds no row for yet', async () => {
    on('GET', ISSUE_URL, { status: 200, body: NONE })
    const { result } = await theKeeper()
    let ready: unknown
    await act(async () => {
      ready = await result.current.prepareSend()
    })
    expect(ready).toEqual({ empty: true })
  })

  it('answers the gap for a letter with no subject, or with a starter left untouched', async () => {
    on('GET', ISSUE_URL, { status: 200, body: letter({ subject: '' }) })
    let first = await theKeeper()
    let ready: unknown
    await act(async () => {
      ready = await first.result.current.prepareSend()
    })
    expect(ready).toEqual({ gap: 'subject' })
    first.unmount()
    on('GET', ISSUE_URL, { status: 200, body: letter({ subject: defaultSubject(MONTH), bodyHtml: starterLetter(STARTER_IDS[0]) }) })
    first = await theKeeper()
    await act(async () => {
      ready = await first.result.current.prepareSend()
    })
    expect(ready).toEqual({ gap: 'words' })
    expect(sends).toEqual([])
  })
})

describe('sendLetter', () => {
  it('posts exactly the id and version named, then puts the open letter the server now holds on the page', async () => {
    const { result } = await theKeeper()
    on('GET', ISSUE_URL, { status: 200, body: NONE })
    let outcome: unknown
    await act(async () => {
      outcome = await result.current.sendLetter({ issueId: 'sample-letter-1', version: 3 })
    })
    expect(sends).toEqual([{ issueId: 'sample-letter-1', version: 3 }])
    expect(outcome).toEqual({ kind: 'sent', campaignId: 'campaign-sample-1', total: 155 })
    expect(result.current.state).toBe('none')
    expect(result.current.letter.bodyHtml).toBe('')
  })

  it('puts a blank letter on the page when the read after a send fails', async () => {
    const { result } = await theKeeper()
    on('GET', ISSUE_URL, 'network')
    let outcome: unknown
    await act(async () => {
      outcome = await result.current.sendLetter({ issueId: 'sample-letter-1', version: 3 })
    })
    expect(outcome).toEqual({ kind: 'sent', campaignId: 'campaign-sample-1', total: 155 })
    expect(result.current.state).toBe('none')
  })

  it('reads a 409 as someone else having changed the letter, and stops the saving with who and when', async () => {
    on('POST', SEND_URL, { status: 409, body: { error: 'Sample refusal words', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-16 20:17:00' } })
    const { result } = await theKeeper()
    let outcome: unknown
    await act(async () => {
      outcome = await result.current.sendLetter({ issueId: 'sample-letter-1', version: 3 })
    })
    expect(outcome).toEqual({ kind: 'conflict' })
    expect(result.current.line.kind).toBe('conflict')
  })

  it("keeps the server's words and status for any other refusal, and none for no answer", async () => {
    on('POST', SEND_URL, { status: 503, body: { error: 'Sample server words.' } })
    const { result } = await theKeeper()
    let outcome: unknown
    await act(async () => {
      outcome = await result.current.sendLetter({ issueId: 'sample-letter-1', version: 3 })
    })
    expect(outcome).toEqual({ kind: 'refused', words: 'Sample server words.', status: 503 })
    on('POST', SEND_URL, 'network')
    await act(async () => {
      outcome = await result.current.sendLetter({ issueId: 'sample-letter-1', version: 3 })
    })
    expect(outcome).toEqual({ kind: 'refused', words: '', status: undefined })
    expect(result.current.letter.bodyHtml).toBe(BODY)
  })

  it('says nothing for a letter that has left the page meanwhile', async () => {
    const { result } = await theKeeper()
    let outcome: unknown
    await act(async () => {
      outcome = await result.current.sendLetter({ issueId: 'sample-letter-1', version: 3 }, () => false)
    })
    expect(outcome).toEqual({ kind: 'gone' })
  })

  it('sends nothing while words typed since the letter was named are not yet saved, and keeps them for their save', async () => {
    const { result } = await theKeeper()
    const typed = `${BODY}<p>Sample words typed late</p>`
    act(() => result.current.edit({ monthLabel: MONTH, subject: 'Sample subject', preheader: '', bodyHtml: typed }))
    let outcome: unknown
    await act(async () => {
      outcome = await result.current.sendLetter({ issueId: 'sample-letter-1', version: 3 })
    })
    expect(outcome).toEqual({ kind: 'moved' })
    expect(sends).toEqual([])
    // The save the typing began still goes once its pause is over.
    await settle(SAVE_PAUSE_MS + 100)
    expect(calls.filter((call) => call.endsWith(` ${ISSUE_URL}`) && !call.startsWith('GET'))).toHaveLength(1)
    expect(sends).toEqual([])
  })
})

describe('afterNoAnswer', () => {
  it('answers false while the open letter is still the one held, and true, with the new one on the page, once it is not', async () => {
    const { result } = await theKeeper()
    let moved: unknown
    await act(async () => {
      moved = await result.current.afterNoAnswer()
    })
    expect(moved).toBe(false)
    on('GET', ISSUE_URL, { status: 200, body: NONE })
    await act(async () => {
      moved = await result.current.afterNoAnswer()
    })
    expect(moved).toBe(true)
    expect(result.current.state).toBe('none')
  })

  it('answers null, not false, when the letter cannot be read, so nobody is told it did not go', async () => {
    const { result } = await theKeeper()
    on('GET', ISSUE_URL, 'network')
    let moved: unknown
    await act(async () => {
      moved = await result.current.afterNoAnswer()
    })
    expect(moved).toBeNull()
  })
})
