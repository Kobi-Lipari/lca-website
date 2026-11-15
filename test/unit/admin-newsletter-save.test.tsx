// @vitest-environment jsdom
//
// Saving the newsletter's letter on its own page (WS16 part two, page step
// 4), through useIssue (src/areas/admin/newsletter/useIssue.ts) and the
// page's own calls, with every answer given by a stand-in for fetch that
// keeps each request and can hold an answer back:
// - a save goes about two seconds after a pause in typing, never before,
//   with the id and version the page read, and nothing is saved when
//   nothing changed;
// - one save at a time: words typed while one is on the way go in the next,
//   which carries the version the answer gave; the first save of a letter
//   with no row is id null and version 0;
// - an answer never touches the words on the page, and the cleaner's own
//   form, when it differs, starts no save of its own;
// - each refusal in words, none tried again by itself: a 409 stops the
//   saving until the newer letter is shown, a 400 or a 413 is the server's
//   own words and the next change tries again, anything else is "Could not
//   save" with Try again;
// - leaving with words not saved: the browser's own question, the save sent
//   as a request that outlives the page, the question a link of the site
//   asks first, and the save that goes at once when the page is left within
//   the site;
// - a reload keeps the words;
// - since the second half: a read of their letter that fails changes the
//   refusal's region once, and words a 400 or a 413 refused are not sent
//   again by the page itself, while a change to them is.
// Every name, word and time here is made up.
import type { ReactNode } from 'react'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSubject } from '@domain/mail/letter'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'sample-token' } } }) } },
}))

const { useIssue, SAVE_PAUSE_MS } = await import('@/areas/admin/newsletter/useIssue')
const { SavedLine } = await import('@/areas/admin/newsletter/NewsletterHead')

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
const NONE = { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null }
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

describe('saving by itself', () => {
  it('saves about two seconds after a pause in typing, once, with the id and version it read and the words as they stand', async () => {
    const { result } = await opened()
    puts.push(saved(4))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample one</p>` })))
    await wait(1500)
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample one two</p>` })))
    await wait(SAVE_PAUSE_MS - 1)
    expect(saves()).toHaveLength(0)
    await wait(1)
    expect(saves()).toHaveLength(1)
    expect(saves()[0].body).toEqual({ id: 'sample-letter-1', version: 3, ...words({ bodyHtml: `${BODY}<p>Sample one two</p>` }) })
    expect(saves()[0].keepalive).toBe(false)
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
    expect(result.current.state).toBe('draft')
  })

  it('says Saving while the save is on the way', async () => {
    const { result } = await opened()
    const later = held(saved(4))
    puts.push(later.answer)
    act(() => result.current.edit(words({ subject: 'Sample subject one' })))
    await wait(SAVE_PAUSE_MS)
    expect(result.current.line).toEqual({ kind: 'saving' })
    await later.release()
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
  })

  it('saves nothing when nothing changed: the words as read, trailing spaces the server trims, and a change typed back', async () => {
    const { result } = await opened()
    act(() => result.current.edit(words()))
    act(() => result.current.edit(words({ subject: 'LCA Newsletter · December 2026  ', monthLabel: ' December 2026' })))
    await wait(SAVE_PAUSE_MS * 3)
    expect(saves()).toHaveLength(0)
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
    await wait(500)
    act(() => result.current.edit(words()))
    await wait(SAVE_PAUSE_MS * 3)
    expect(saves()).toHaveLength(0)
  })

  it('sends the three plain fields trimmed, as the server stores them', async () => {
    const { result } = await opened()
    puts.push(saved(4))
    act(() => result.current.edit(words({ subject: '  Sample subject one  ', monthLabel: 'December 2026 ' })))
    await wait(SAVE_PAUSE_MS)
    expect(saves()[0].body).toMatchObject({ subject: 'Sample subject one', monthLabel: 'December 2026' })
  })

  it('keeps one save in flight: words typed meanwhile go in the next, which carries the version the answer gave', async () => {
    const { result } = await opened()
    const first = held(saved(4))
    puts.push(first.answer, saved(5))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample one</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(saves()).toHaveLength(1)
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample one two</p>` })))
    await wait(SAVE_PAUSE_MS * 2)
    // The pause has passed, and the first save is still on the way: no second save beside it.
    expect(saves()).toHaveLength(1)
    await first.release()
    await settle()
    expect(saves()).toHaveLength(2)
    expect(saves()[1].body).toMatchObject({ id: 'sample-letter-1', version: 4, bodyHtml: `${BODY}<p>Sample one two</p>` })
    await settle()
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
  })

  it('waits for the pause of words typed while a save was on the way when that pause has not passed', async () => {
    const { result } = await opened()
    const first = held(saved(4))
    puts.push(first.answer, saved(5))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample one</p>` })))
    await wait(SAVE_PAUSE_MS)
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample one two</p>` })))
    await first.release()
    expect(saves()).toHaveLength(1)
    await wait(SAVE_PAUSE_MS)
    expect(saves()).toHaveLength(2)
    expect(saves()[1].body).toMatchObject({ version: 4 })
  })

  it('makes the first save of a letter with no row yet with id null and version 0, a blank letter for the month now and its subject, and the next with what it answered', async () => {
    const { result } = await opened(NONE)
    expect(result.current.letter).toEqual({ monthLabel: 'November 2026', subject: defaultSubject('November 2026'), preheader: '', bodyHtml: '' })
    expect(result.current.state).toBe('none')
    expect(result.current.line).toEqual({ kind: 'idle' })
    // An empty letter as the editor writes it is not a change.
    act(() => result.current.edit({ ...result.current.letter, bodyHtml: '<p></p>' }))
    await wait(SAVE_PAUSE_MS * 2)
    expect(saves()).toHaveLength(0)
    puts.push(saved(1, { id: 'sample-letter-new' }), saved(2, { id: 'sample-letter-new' }))
    act(() => result.current.edit({ ...result.current.letter, bodyHtml: '<p>Sample</p>' }))
    await wait(SAVE_PAUSE_MS)
    expect(saves()[0].body).toMatchObject({ id: null, version: 0, monthLabel: 'November 2026', bodyHtml: '<p>Sample</p>' })
    expect(result.current.state).toBe('draft')
    act(() => result.current.edit({ ...result.current.letter, bodyHtml: '<p>Sample two</p>' }))
    await wait(SAVE_PAUSE_MS)
    expect(saves()[1].body).toMatchObject({ id: 'sample-letter-new', version: 1 })
  })

  it('never touches the words on the page with an answer, and starts no save of its own when the cleaner changed them', async () => {
    const { result } = await opened()
    const key = result.current.letterKey
    puts.push(saved(4, { bodyHtml: '<h2>Sample heading one</h2><p>Sample words as stored</p>' }))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(saves()).toHaveLength(1)
    expect(result.current.letterKey).toBe(key)
    expect(result.current.letter.bodyHtml).toBe(BODY)
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
    await wait(SAVE_PAUSE_MS * 3)
    expect(saves()).toHaveLength(1)
  })
})

describe('the refusals, each in words, none tried again by itself', () => {
  it('stops saving after a 409 for a newer letter, keeps the person\'s words, and shows their letter in its place when asked', async () => {
    const { result } = await opened()
    puts.push({ status: 409, body: { error: 'Someone saved this letter after you opened it, so your words were not saved.', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-13 20:17:00' } })
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Mine</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(result.current.line).toEqual({ kind: 'conflict', reason: 'changed', by: 'Player Two', at: '2026-11-13 20:17:00', readFailures: 0 })
    // Nothing more is saved over their letter, and the words on the page are the person's.
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Mine and more</p>` })))
    await wait(SAVE_PAUSE_MS * 3)
    act(() => result.current.saveNow())
    await settle()
    expect(saves()).toHaveLength(1)
    // Their letter, read again, takes the place of the person's words, and saving goes on from its version.
    const key = result.current.letterKey
    gets.push({ status: 200, body: letter({ version: 7, bodyHtml: '<h2>Sample heading two</h2><p>Theirs</p>' }) })
    await act(async () => result.current.showTheirs())
    expect(result.current.letterKey).toBe(key + 1)
    expect(result.current.letter.bodyHtml).toBe('<h2>Sample heading two</h2><p>Theirs</p>')
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 20:15:00' })
    puts.push(saved(8))
    act(() => result.current.edit(words({ bodyHtml: '<h2>Sample heading two</h2><p>Theirs and mine</p>' })))
    await wait(SAVE_PAUSE_MS)
    expect(saves()[1].body).toMatchObject({ version: 7 })
  })

  it('keeps the refusal on show, and says so, when their letter cannot be read', async () => {
    const { result } = await opened()
    puts.push({ status: 409, body: { error: 'x', reason: 'set_aside', changedBy: null, changedAt: '2026-11-13 20:17:00' } })
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Mine</p>` })))
    await wait(SAVE_PAUSE_MS)
    gets.push({ status: 0, body: null })
    await act(async () => result.current.showTheirs())
    expect(result.current.line).toMatchObject({ kind: 'conflict', reason: 'set_aside', readFailures: 1 })
  })

  it('says again that their letter could not be read when a read fails a second time, keeping the failure on the line while it reads', async () => {
    const { result } = await opened()
    puts.push({ status: 409, body: { error: 'x', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-13 20:17:00' } })
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Mine</p>` })))
    await wait(SAVE_PAUSE_MS)
    gets.push({ status: 0, body: null })
    await act(async () => result.current.showTheirs())
    expect(result.current.line).toMatchObject({ kind: 'conflict', readFailures: 1 })
    // Pressed again: the failure stays on the line while their letter is read, and is counted again when the read fails
    // again, so the refusal's region, which draws it, says it again.
    const later = held({ status: 500, body: { error: 'Something went wrong' } })
    gets.push(later.answer)
    let reading: Promise<void> = Promise.resolve()
    act(() => {
      reading = result.current.showTheirs()
    })
    expect(result.current.line).toEqual({ kind: 'conflict', reason: 'changed', by: 'Player Two', at: '2026-11-13 20:17:00', readFailures: 1 })
    await later.release()
    await act(async () => reading)
    expect(result.current.line).toEqual({ kind: 'conflict', reason: 'changed', by: 'Player Two', at: '2026-11-13 20:17:00', readFailures: 2 })
    expect(saves()).toHaveLength(1)
  })

  it('changes the refusal\'s region once for each read of their letter that fails, the failure\'s sentence a part of its own', async () => {
    let issue!: ReturnType<typeof useIssue>
    function Line() {
      issue = useIssue(true)
      return <SavedLine line={issue.line} onTryAgain={issue.saveNow} onShowTheirs={() => {}} />
    }
    gets.push({ status: 200, body: letter() })
    render(<Line />)
    await settle()
    puts.push({ status: 409, body: { error: 'x', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-13 20:17:00' } })
    act(() => issue.edit(words({ bodyHtml: `${BODY}<p>Mine</p>` })))
    await wait(SAVE_PAUSE_MS)
    const alert = screen.getByRole('alert')
    const refusal = 'Player Two changed this letter at 2:17 PM. Nothing more is saved over their letter. Your words stay here for you to copy.'
    expect(alert.textContent).toBe(refusal)
    // Each change of the region is one round of the browser's mutation records, as a screen reader takes it.
    let changes = 0
    const watcher = new MutationObserver(() => {
      changes += 1
    })
    watcher.observe(alert, { subtree: true, childList: true, characterData: true })
    try {
      for (const n of [1, 2, 3]) {
        const before = changes
        const later = held({ status: 500, body: { error: 'Something went wrong' } })
        gets.push(later.answer)
        let reading: Promise<void> = Promise.resolve()
        act(() => {
          reading = issue.showTheirs()
        })
        await settle()
        // While their letter is read, the region keeps its words, the failure before among them.
        expect(changes - before, `read ${n} on its way`).toBe(0)
        await later.release()
        await act(async () => reading)
        await settle()
        expect(changes - before, `read ${n} failed`).toBe(1)
        expect(screen.getByRole('alert')).toBe(alert)
        expect(alert.textContent).toBe(`${refusal} Their letter could not be read. Press "Show their letter" to try again.`)
      }
    } finally {
      watcher.disconnect()
    }
    expect(saves()).toHaveLength(1)
  })

  it('shows a 400 and a 413 in the server\'s own words, and tries again at the next change', async () => {
    const { result } = await opened()
    puts.push({ status: 413, body: { error: 'This letter is too long for one email. Make it shorter, then save again.' } })
    puts.push({ status: 400, body: { error: 'This letter has a smaller heading before its first main heading. Start it with a main heading, then save again.' } })
    puts.push(saved(4))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Long</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(result.current.line).toEqual({ kind: 'refused', words: 'This letter is too long for one email. Make it shorter, then save again.' })
    await wait(SAVE_PAUSE_MS * 3)
    expect(saves()).toHaveLength(1)
    act(() => result.current.edit(words({ bodyHtml: '<h3>Small</h3>' })))
    await wait(SAVE_PAUSE_MS)
    expect(result.current.line).toEqual({ kind: 'refused', words: 'This letter has a smaller heading before its first main heading. Start it with a main heading, then save again.' })
    act(() => result.current.edit(words({ bodyHtml: '<h2>Sample heading one</h2>' })))
    await wait(SAVE_PAUSE_MS)
    expect(saves()).toHaveLength(3)
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
  })

  it('shows the server\'s words for a field when a 400 names one, the first when it names more, so the person knows what to mend', async () => {
    const { result } = await opened()
    // The contract's own answers, as parseBody (functions/utils/response.ts) writes them: a sentence for the body, and one
    // for each field that failed, in the order the contract lists the fields.
    puts.push({ status: 400, body: { error: 'Some fields are missing or not valid.', fields: { subject: 'Keep the subject to 200 characters.' } } })
    puts.push({ status: 400, body: { error: 'Some fields are missing or not valid.', fields: { monthLabel: 'Keep the month to 40 characters.', subject: 'Keep the subject to 200 characters.' } } })
    act(() => result.current.edit(words({ subject: 'Sample subject '.repeat(14) })))
    await wait(SAVE_PAUSE_MS)
    expect(result.current.line).toEqual({ kind: 'refused', words: 'Keep the subject to 200 characters.' })
    act(() => result.current.edit(words({ subject: 'Sample subject '.repeat(15) })))
    await wait(SAVE_PAUSE_MS)
    expect(result.current.line).toEqual({ kind: 'refused', words: 'Keep the month to 40 characters.' })
    expect(saves()).toHaveLength(2)
  })

  it('says Could not save, with Try again, for a 400 or a 413 that brings no words of the server\'s own, never "Request failed"', async () => {
    const { result } = await opened()
    // An empty body, a page from the edge, a 413 with an empty body, and an answer that holds no words: none of them
    // tells the person what to mend.
    puts.push({ status: 400, body: null, raw: '' }, { status: 400, body: null, raw: '<html><body>Bad Request</body></html>' }, { status: 413, body: null, raw: '' }, { status: 400, body: {} })
    for (const sample of ['one', 'two', 'three', 'four']) {
      act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample ${sample}</p>` })))
      await wait(SAVE_PAUSE_MS)
      expect(result.current.line, sample).toEqual({ kind: 'failed' })
    }
    expect(saves()).toHaveLength(4)
  })

  it('says Could not save for anything else, a request with no answer among it, and Try again sends it at once', async () => {
    const { result } = await opened()
    puts.push({ status: 0, body: null }, { status: 503, body: { error: 'Something went wrong' } }, saved(4))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(result.current.line).toEqual({ kind: 'failed' })
    await wait(SAVE_PAUSE_MS * 3)
    expect(saves()).toHaveLength(1)
    act(() => result.current.saveNow())
    await settle()
    expect(result.current.line).toEqual({ kind: 'failed' })
    act(() => result.current.saveNow())
    await settle()
    expect(saves()).toHaveLength(3)
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
  })

  it('takes a failed line back to the last save once the words are typed back to it', async () => {
    const { result } = await opened()
    puts.push({ status: 0, body: null })
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(result.current.line).toEqual({ kind: 'failed' })
    act(() => result.current.edit(words()))
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 20:15:00' })
  })
})

describe('the words in the saved line', () => {
  const draw = (line: Parameters<typeof SavedLine>[0]['line']) => {
    cleanup()
    render(<SavedLine line={line} onTryAgain={() => {}} onShowTheirs={() => {}} />)
    return document.querySelector('[data-slot="saved-line"]')!.textContent
  }

  it('says each state in words, the time as 2:15 PM, and the day with its weekday when it was not today', () => {
    expect(draw({ kind: 'idle' })).toBe('')
    expect(draw({ kind: 'saving' })).toBe('Saving')
    expect(draw({ kind: 'saved', at: '2026-11-13 20:15:00' })).toBe('Saved automatically at 2:15 PM')
    expect(draw({ kind: 'saved', at: '2026-11-12 20:15:00' })).toBe('Saved on Thursday, November 12, 2026 at 2:15 PM')
    expect(draw({ kind: 'failed' })).toBe('Could not saveTry again')
    expect(draw({ kind: 'refused', words: 'This letter is too long for one email. Make it shorter, then save again.' })).toBe('This letter is too long for one email. Make it shorter, then save again.')
    expect(draw({ kind: 'conflict', reason: 'changed', by: 'Player Two', at: '2026-11-13 20:17:00', readFailures: 0 })).toBe(
      'Player Two changed this letter at 2:17 PM. Nothing more is saved over their letter. Your words stay here for you to copy.Show their letter',
    )
    expect(draw({ kind: 'conflict', reason: 'sent', by: 'Player Two', at: '2026-11-12 23:05:00', readFailures: 0 })).toBe(
      'Player Two sent this letter on Thursday, November 12, 2026 at 5:05 PM. Nothing more is saved to it. Your words stay here for you to copy.',
    )
    expect(draw({ kind: 'conflict', reason: 'set_aside', by: null, at: '2026-11-13 20:17:00', readFailures: 1 })).toBe(
      'Someone started a new letter at 2:17 PM. Nothing more is saved over their letter. Your words stay here for you to copy. Their letter could not be read. Press "Show their letter" to try again.Show their letter',
    )
  })

  it('reads the quiet states out politely and a refusal at once, beside a mark that is never the only sign', () => {
    draw({ kind: 'saved', at: '2026-11-13 20:15:00' })
    expect(screen.getByRole('status').textContent).toBe('Saved automatically at 2:15 PM')
    expect(screen.getByRole('alert').textContent).toBe('')
    draw({ kind: 'failed' })
    expect(screen.getByRole('status').textContent).toBe('')
    expect(screen.getByRole('alert').textContent).toBe('Could not save')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy()
    draw({ kind: 'conflict', reason: 'sent', by: 'Player Two', at: '2026-11-13 20:17:00', readFailures: 0 })
    expect(screen.queryByRole('button', { name: 'Show their letter' })).toBeNull()
  })

  it('reads every sentence of a refusal out at once from its one region, and a read of their letter that failed from the same region', () => {
    const line = { kind: 'conflict', reason: 'changed', by: 'Player Two', at: '2026-11-13 20:17:00', readFailures: 0 } as const
    const view = render(<SavedLine line={line} onTryAgain={() => {}} onShowTheirs={() => {}} />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('Player Two changed this letter at 2:17 PM. Nothing more is saved over their letter. Your words stay here for you to copy.')
    view.rerender(<SavedLine line={{ ...line, readFailures: 1 }} onTryAgain={() => {}} onShowTheirs={() => {}} />)
    expect(screen.getByRole('alert')).toBe(alert)
    expect(alert.textContent).toBe(
      'Player Two changed this letter at 2:17 PM. Nothing more is saved over their letter. Your words stay here for you to copy. Their letter could not be read. Press "Show their letter" to try again.',
    )
    // Every word of the line is in one of its two regions, but for the name of the step it offers after them.
    const saidLine = document.querySelector('[data-slot="saved-line"]')!
    const steps = [...saidLine.querySelectorAll('button')].map((b) => b.textContent).join('')
    expect(saidLine.textContent).toBe(`${screen.getByRole('status').textContent}${alert.textContent}${steps}`)
    expect(steps).toBe('Show their letter')
  })
})

describe('leaving with words not saved, and coming back', () => {
  const leaving = () => {
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }

  it('asks the browser\'s own question only while words are not saved, and after a refusal', async () => {
    const { result } = await opened()
    expect(leaving()).toBe(false)
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
    expect(leaving()).toBe(true)
    puts.push(saved(4))
    await wait(SAVE_PAUSE_MS)
    expect(leaving()).toBe(false)
    puts.push({ status: 409, body: { error: 'x', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-13 20:17:00' } })
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample two</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(leaving()).toBe(true)
  })

  it('sends the save as the page goes, as a request that outlives it, signed in with the headers read ahead and held to the version it knows', async () => {
    const { result } = await opened()
    puts.push(saved(4))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(saves()).toHaveLength(1)
    expect(saves()[0]).toMatchObject({ keepalive: true, authorization: 'Bearer sample-token', body: { id: 'sample-letter-1', version: 3, bodyHtml: `${BODY}<p>Sample</p>` } })
  })

  it('sends nothing as the page goes when everything is saved, or a refusal stopped the saving', async () => {
    const { result } = await opened()
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    puts.push({ status: 409, body: { error: 'x', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-13 20:17:00' } })
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
    await wait(SAVE_PAUSE_MS)
    act(() => {
      window.dispatchEvent(new Event('pagehide'))
    })
    expect(saves()).toHaveLength(1)
  })

  it('saves at once when the page is left within the site, and after the save on the way when one is', async () => {
    const view = await opened()
    puts.push(saved(4))
    act(() => view.result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
    view.unmount()
    await settle()
    expect(saves()).toHaveLength(1)
    expect(saves()[0]).toMatchObject({ keepalive: false, body: { bodyHtml: `${BODY}<p>Sample</p>` } })
    // With a save on the way, the words typed after it go once it has answered.
    calls = []
    const again = await opened()
    const first = held(saved(4))
    puts.push(first.answer, saved(5))
    act(() => again.result.current.edit(words({ bodyHtml: `${BODY}<p>One</p>` })))
    await wait(SAVE_PAUSE_MS)
    act(() => again.result.current.edit(words({ bodyHtml: `${BODY}<p>One two</p>` })))
    again.unmount()
    await first.release()
    await settle()
    expect(saves().map((s) => s.body?.bodyHtml)).toEqual([`${BODY}<p>One</p>`, `${BODY}<p>One two</p>`])
  })

  /** The page among the site's routes, with the crumb's link to Admin and any other links a case adds beside it. */
  async function openedAmongPages(more: ReactNode = null) {
    gets.push({ status: 200, body: letter() })
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/admin/newsletter']}>
        <Routes>
          <Route path="/admin/newsletter" element={<>{children}<Link to="/admin">Admin</Link>{more}</>} />
          <Route path="/admin" element={<p>Admin stand-in</p>} />
        </Routes>
      </MemoryRouter>
    )
    const view = renderHook(() => useIssue(true), { wrapper })
    await settle()
    expect(view.result.current.status).toBe('ready')
    return view
  }
  const LATEST = 'Leave this page? Your latest words may not be saved.'
  const LOSES = 'Leave this page? Your words on it are not saved, and leaving loses them. Copy anything you want to keep first.'
  const CHANGED: Answer = { status: 409, body: { error: 'x', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-13 20:17:00' } }

  it('asks before a link of the site takes the page away from words not saved, keeps the page for a person who stays, and asks nothing once they are saved', async () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { result } = await openedAmongPages()
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
    fireEvent.click(screen.getByRole('link', { name: 'Admin' }))
    expect(ask).toHaveBeenCalledTimes(1)
    expect(ask).toHaveBeenCalledWith(LATEST)
    expect(screen.queryByText('Admin stand-in')).toBeNull()
    // The page stays, and its words save after their pause as before.
    puts.push(saved(4))
    await wait(SAVE_PAUSE_MS)
    expect(saves()).toHaveLength(1)
    fireEvent.click(screen.getByRole('link', { name: 'Admin' }))
    expect(ask).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Admin stand-in')).toBeTruthy()
    await wait(SAVE_PAUSE_MS * 2)
    expect(saves()).toHaveLength(1)
  })

  it('asks while a save is on its way, so a refusal that lands then is shown to the person who stayed', async () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { result } = await openedAmongPages()
    const later = held(CHANGED)
    puts.push(later.answer)
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(result.current.line).toEqual({ kind: 'saving' })
    fireEvent.click(screen.getByRole('link', { name: 'Admin' }))
    expect(ask).toHaveBeenCalledWith(LATEST)
    await later.release()
    expect(screen.queryByText('Admin stand-in')).toBeNull()
    expect(result.current.line).toMatchObject({ kind: 'conflict', reason: 'changed', by: 'Player Two' })
  })

  it('after a refusal asks in words that leaving loses the person\'s words, and saves nothing over the newer letter for a person who goes', async () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { result } = await openedAmongPages()
    puts.push(CHANGED)
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Mine</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(result.current.line).toMatchObject({ kind: 'conflict', reason: 'changed' })
    fireEvent.click(screen.getByRole('link', { name: 'Admin' }))
    expect(ask).toHaveBeenLastCalledWith(LOSES)
    expect(screen.queryByText('Admin stand-in')).toBeNull()
    ask.mockReturnValue(true)
    fireEvent.click(screen.getByRole('link', { name: 'Admin' }))
    expect(ask).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Admin stand-in')).toBeTruthy()
    await wait(SAVE_PAUSE_MS * 3)
    expect(saves()).toHaveLength(1)
  })

  it('saves at once for a person who answers the question by going', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { result } = await openedAmongPages()
    puts.push(saved(4))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
    fireEvent.click(screen.getByRole('link', { name: 'Admin' }))
    expect(screen.getByText('Admin stand-in')).toBeTruthy()
    await settle()
    expect(saves()).toHaveLength(1)
    expect(saves()[0]).toMatchObject({ keepalive: false, body: { version: 3, bodyHtml: `${BODY}<p>Sample</p>` } })
  })

  it('asks nothing for a link that opens elsewhere, goes to another site, stays on this page, holds a file or sits inside the letter', async () => {
    const ask = vi.spyOn(window, 'confirm').mockReturnValue(false)
    // The address the browser shows while the page is on it; the stand-in links below do nothing of their own.
    window.history.replaceState(null, '', '/admin/newsletter')
    const still = (event: { preventDefault: () => void }) => event.preventDefault()
    const { result } = await openedAmongPages(
      <>
        <a href="/admin/sample" onClick={still}>Sample page of the site</a>
        <a href="/admin/sample" target="_blank" onClick={still}>Sample page in a new tab</a>
        <a href="https://example.org/sample" onClick={still}>Sample page of another site</a>
        <a href="/admin/newsletter#sample" onClick={still}>Sample spot on this page</a>
        <a href="/sample.pdf" download onClick={still}>Sample file</a>
        <div contentEditable suppressContentEditableWarning>
          <a href="/admin/sample" onClick={still}>Sample link in the letter</a>
        </div>
      </>,
    )
    try {
      act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
      const link = (name: string) => screen.getByText(name)
      for (const name of ['Sample page in a new tab', 'Sample page of another site', 'Sample spot on this page', 'Sample file', 'Sample link in the letter']) {
        fireEvent.click(link(name))
        expect(ask, name).not.toHaveBeenCalled()
      }
      for (const more of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
        fireEvent.click(link('Sample page of the site'), more)
        expect(ask, JSON.stringify(more)).not.toHaveBeenCalled()
      }
      // The same link of the site, pressed plainly, asks.
      fireEvent.click(link('Sample page of the site'))
      expect(ask).toHaveBeenCalledWith(LATEST)
    } finally {
      window.history.replaceState(null, '', '/')
    }
  })

  it('keeps the words across a reload: what was saved is what the page reads again', async () => {
    const first = await opened()
    puts.push(saved(4))
    act(() => first.result.current.edit(words({ bodyHtml: `${BODY}<p>Kept</p>` })))
    await wait(SAVE_PAUSE_MS)
    const stored = saves()[0].body as Record<string, unknown>
    first.unmount()
    const again = await opened(letter({ version: 4, bodyHtml: stored.bodyHtml, subject: stored.subject }))
    expect(again.result.current.letter.bodyHtml).toBe(`${BODY}<p>Kept</p>`)
    act(() => again.result.current.edit(words({ bodyHtml: `${BODY}<p>Kept</p>` })))
    await wait(SAVE_PAUSE_MS * 2)
    expect(saves()).toHaveLength(1)
  })

  it('makes no call at all for someone the server would refuse', async () => {
    renderHook(() => useIssue(false))
    await wait(SAVE_PAUSE_MS * 2)
    expect(calls).toEqual([])
  })
})

describe('the page\'s own saves it never heard back about', () => {
  const gone = (persisted = true) => act(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted }))
  })
  const back = () => act(() => {
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
  })
  /** The letter as the server holds it once a save of the person's, Player One's, was stored at `version`. */
  const theirOwn = (version: number, bodyHtml: string) => ({ ...letter({ version, bodyHtml, updatedAt: '2026-11-13 21:00:00' }), lastSavedBy: 'Player One', lastSavedAt: '2026-11-13 21:00:00' })
  const changedBy = (name: string, at: string): Answer => ({ status: 409, body: { error: 'Someone saved this letter after you opened it.', reason: 'changed', changedBy: name, changedAt: at } })
  const reads = () => calls.filter((c) => c.method === 'GET')

  it('leaves nothing to go off once the page has gone, and a page brought back by Back takes the save it sent as it went as its own, saying nothing', async () => {
    const { result } = await opened()
    const key = result.current.letterKey
    puts.push(saved(4))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
    await gone()
    await settle()
    expect(saves()).toHaveLength(1)
    // The pause that ran as the page went is stopped: nothing goes off later with the version that save moved.
    await wait(SAVE_PAUSE_MS * 3)
    expect(saves()).toHaveLength(1)
    // Brought back, the page reads the letter again, finds its own words stored at version 4, and goes on from there.
    gets.push({ status: 200, body: theirOwn(4, `${BODY}<p>Sample</p>`) })
    await back()
    await settle()
    expect(reads()).toHaveLength(2)
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
    expect(result.current.letterKey).toBe(key)
    expect(saves()).toHaveLength(1)
    puts.push(saved(5))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample, again</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(saves()[1].body).toMatchObject({ id: 'sample-letter-1', version: 4, bodyHtml: `${BODY}<p>Sample, again</p>` })
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
  })

  it('takes a 409 for its own save, sent as the page went, in silence, and saves the newer words with the version that save made', async () => {
    const { result } = await opened()
    const key = result.current.letterKey
    puts.push(saved(4))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
    await gone(false)
    await settle()
    // The page lives on, and more words go at the version it knew: the server names the person's own save.
    puts.push(changedBy('Player One', '2026-11-13 21:00:00'), saved(5))
    gets.push({ status: 200, body: theirOwn(4, `${BODY}<p>Sample</p>`) })
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample, more</p>` })))
    await wait(SAVE_PAUSE_MS)
    await settle()
    expect(saves().map((s) => s.body?.version)).toEqual([3, 3, 4])
    expect(saves()[2].body).toMatchObject({ bodyHtml: `${BODY}<p>Sample, more</p>` })
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
    expect(result.current.letterKey).toBe(key)
  })

  it('takes a 409 for a save whose answer was lost, met again by Try again, in silence, and goes on from that save\'s version', async () => {
    const { result } = await opened()
    // The server stored this save at version 4, and its answer never reached the page.
    puts.push({ status: 0, body: null })
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(result.current.line).toEqual({ kind: 'failed' })
    puts.push(changedBy('Player One', '2026-11-13 21:00:00'))
    gets.push({ status: 200, body: theirOwn(4, `${BODY}<p>Sample</p>`) })
    act(() => result.current.saveNow())
    await settle()
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
    await wait(SAVE_PAUSE_MS * 3)
    expect(saves()).toHaveLength(2)
    puts.push(saved(5))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Sample two</p>` })))
    await wait(SAVE_PAUSE_MS)
    expect(saves()[2].body).toMatchObject({ version: 4, bodyHtml: `${BODY}<p>Sample two</p>` })
  })

  it('still refuses in words a newer letter that holds none of its words, and the same when the letter cannot be read again', async () => {
    const { result } = await opened()
    puts.push(saved(4))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Mine</p>` })))
    await gone(false)
    await settle()
    puts.push(changedBy('Player Two', '2026-11-13 20:17:00'))
    // The letter read again is the one the 409 names: Player Two's, saved at 8:17 PM.
    gets.push({ status: 200, body: { ...letter({ version: 5, bodyHtml: '<h2>Sample heading two</h2><p>Theirs</p>' }), lastSavedAt: '2026-11-13 20:17:00' } })
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Mine and more</p>` })))
    await wait(SAVE_PAUSE_MS)
    await settle()
    expect(result.current.line).toEqual({ kind: 'conflict', reason: 'changed', by: 'Player Two', at: '2026-11-13 20:17:00', readFailures: 0 })
    await wait(SAVE_PAUSE_MS * 3)
    expect(saves()).toHaveLength(2)
    // A save with no answer, then Try again meets a newer letter, and the letter cannot be read: the refusal stands.
    cleanup()
    calls = []
    const again = await opened()
    puts.push({ status: 0, body: null }, changedBy('Player Two', '2026-11-13 20:17:00'))
    act(() => again.result.current.edit(words({ bodyHtml: `${BODY}<p>Mine</p>` })))
    await wait(SAVE_PAUSE_MS)
    gets.push({ status: 0, body: null })
    act(() => again.result.current.saveNow())
    await settle()
    expect(again.result.current.line).toEqual({ kind: 'conflict', reason: 'changed', by: 'Player Two', at: '2026-11-13 20:17:00', readFailures: 0 })
    expect(saves()).toHaveLength(2)
  })

  it('names the writer and time of the letter read again, not the 409\'s, when someone saved between the 409 and the read', async () => {
    const { result } = await opened()
    const first = held(changedBy('Player One', '2026-11-13 21:00:00'))
    puts.push(first.answer, saved(4))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>One</p>` })))
    await wait(SAVE_PAUSE_MS)
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>One two</p>` })))
    await gone()
    await settle()
    await back()
    await settle()
    // The save sent as the page went was stored at version 4, so the save on its way meets a 409 naming the person,
    // Player One; Player Two then saved at 9:05 PM, before the page read the letter again to check that 409.
    gets.push({ status: 200, body: { ...letter({ version: 5, bodyHtml: '<h2>Sample heading two</h2><p>Theirs</p>' }), lastSavedBy: 'Player Two', lastSavedAt: '2026-11-13 21:05:00' } })
    await first.release()
    await settle()
    expect(result.current.line).toEqual({ kind: 'conflict', reason: 'changed', by: 'Player Two', at: '2026-11-13 21:05:00', readFailures: 0 })
    await wait(SAVE_PAUSE_MS * 3)
    expect(saves().map((s) => [s.body?.version, s.keepalive])).toEqual([[3, false], [3, true]])
  })

  it('sends nothing by itself after a 400 or a 413, as the page goes and comes back, and a change to the words sends again', async () => {
    for (const [status, refusal] of [[413, 'This letter is too long for one email. Make it shorter, then save again.'], [400, 'Keep the subject to 200 characters.']] as const) {
      cleanup()
      calls = []
      const { result } = await opened()
      puts.push(status === 400 ? { status, body: { error: 'Some fields are missing or not valid.', fields: { subject: refusal } } } : { status, body: { error: refusal } })
      act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Refused ${status}</p>` })))
      await wait(SAVE_PAUSE_MS)
      expect(result.current.line, `${status}`).toEqual({ kind: 'refused', words: refusal })
      // The page goes, as a tab closes or another site opens, and is brought back by Back: the refused words stay unsent.
      await gone()
      await settle()
      await back()
      await settle()
      await wait(SAVE_PAUSE_MS * 3)
      expect(saves(), `${status}`).toHaveLength(1)
      expect(result.current.line, `${status}`).toEqual({ kind: 'refused', words: refusal })
      // A change to the words is the person's own, and sends them.
      puts.push(saved(4))
      act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>Refused ${status}, mended</p>` })))
      await wait(SAVE_PAUSE_MS)
      expect(saves(), `${status}`).toHaveLength(2)
      expect(saves()[1].body, `${status}`).toMatchObject({ version: 3, bodyHtml: `${BODY}<p>Refused ${status}, mended</p>` })
      expect(result.current.line, `${status}`).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
    }
  })

  it('sends nothing by itself after a 400 or a 413 when the page is left within the site, nor when typing goes back to the refused words', async () => {
    for (const status of [413, 400] as const) {
      cleanup()
      calls = []
      const view = await opened()
      puts.push({ status, body: { error: 'Sample words the server refused.' } })
      act(() => view.result.current.edit(words({ bodyHtml: `${BODY}<p>Refused</p>` })))
      await wait(SAVE_PAUSE_MS)
      expect(view.result.current.line, `${status}`).toEqual({ kind: 'refused', words: 'Sample words the server refused.' })
      // Words typed and taken back within the pause: the words on the page are the refused ones again, and stay unsent.
      act(() => view.result.current.edit(words({ bodyHtml: `${BODY}<p>Refused, and more</p>` })))
      act(() => view.result.current.edit(words({ bodyHtml: `${BODY}<p>Refused</p>` })))
      await wait(SAVE_PAUSE_MS * 2)
      expect(saves(), `${status}`).toHaveLength(1)
      expect(view.result.current.line, `${status}`).toEqual({ kind: 'refused', words: 'Sample words the server refused.' })
      view.unmount()
      await wait(SAVE_PAUSE_MS * 2)
      expect(saves(), `${status}`).toHaveLength(1)
    }
  })

  it('saves at once, when brought back by Back, words too long to send as the page went', async () => {
    const { result } = await opened()
    const long = `${BODY}<p>${'Sample words '.repeat(5000)}</p>`
    act(() => result.current.edit(words({ bodyHtml: long })))
    await gone()
    await settle()
    expect(saves()).toHaveLength(0)
    await wait(SAVE_PAUSE_MS * 3)
    expect(saves()).toHaveLength(0)
    puts.push(saved(4))
    await back()
    await settle()
    expect(reads()).toHaveLength(1)
    expect(saves()).toHaveLength(1)
    expect(saves()[0]).toMatchObject({ keepalive: false, body: { version: 3, bodyHtml: long } })
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
  })

  it('sends the words typed while a save was on its way, when the page went and came back before that save answered', async () => {
    const { result } = await opened()
    const first = held(saved(4))
    // The save sent as the page went is held to version 3, which the first save has moved by then: it writes nothing.
    puts.push(first.answer, changedBy('Player One', '2026-11-13 21:00:00'))
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>One</p>` })))
    await wait(SAVE_PAUSE_MS)
    act(() => result.current.edit(words({ bodyHtml: `${BODY}<p>One two</p>` })))
    await gone()
    await settle()
    await back()
    await settle()
    expect(saves().map((s) => [s.body?.version, s.keepalive])).toEqual([[3, false], [3, true]])
    // Once the first save answers, the words typed after it go at once with the version it gave, and the line says
    // Saving until they are saved, never "Saved" over words that are not.
    const next = held(saved(5))
    puts.push(next.answer)
    await first.release()
    await settle()
    expect(saves()).toHaveLength(3)
    expect(saves()[2]).toMatchObject({ keepalive: false, body: { id: 'sample-letter-1', version: 4, bodyHtml: `${BODY}<p>One two</p>` } })
    expect(result.current.line).toEqual({ kind: 'saving' })
    await next.release()
    await settle()
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
  })
})
