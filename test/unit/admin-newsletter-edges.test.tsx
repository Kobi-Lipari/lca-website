// @vitest-environment jsdom
//
// The edges of the newsletter's own page that the page, save and focus files
// leave to chance (WS16 part two, page step 4, first half):
// - the saved line and the month of a blank letter at midnight and across
//   both daylight saving changes in America/Chicago, where the day in UTC is
//   not the day in Louisiana;
// - saves racing each other and the server's answers: a refusal that lands
//   while more words were typed, a press of Try again twice, an answer for a
//   page that has been left, answers released in either order;
// - "In this issue" when two headings read the same;
// - what the page's files must never hold: a schema import from the
//   contracts, a route outside the switch, the old name of US Chess, a dash, a 24-hour time;
// - the editor kit's package, listed at the exact version the lock holds.
// Every name, word and time here is made up.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { letterParts } from '@domain/mail/letter'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'sample-token' } } }) } },
}))

const { useIssue, SAVE_PAUSE_MS } = await import('@/areas/admin/newsletter/useIssue')
const { SavedLine } = await import('@/areas/admin/newsletter/NewsletterHead')
const { InThisIssue } = await import('@/areas/admin/newsletter/InThisIssue')

const ISSUE_URL = '/api/admin/mail/newsletter/issue'
const BODY = '<h2>Sample heading one</h2><p>Sample words</p>'

interface Answer { status: number; body: unknown }
let puts: Array<Answer | Promise<Answer>> = []
let gets: Array<Answer | Promise<Answer>> = []
let sent: Array<Record<string, unknown>> = []

const letterAnswer = (over: Record<string, unknown> = {}) => ({
  issue: { id: 'sample-letter-1', version: 3, monthLabel: 'December 2026', subject: 'LCA Newsletter · December 2026', preheader: '', bodyHtml: BODY, createdAt: '2026-11-13 15:00:00', updatedAt: '2026-11-13 20:15:00', ...over },
  state: 'draft', lastSavedBy: 'Player Two', lastSavedAt: '2026-11-13 20:15:00',
})
const NONE = { issue: null, state: 'none', lastSavedBy: null, lastSavedAt: null }
const saved = (version: number): Answer => ({ status: 200, body: { id: 'sample-letter-1', version, savedAt: '2026-11-13 21:00:00', bodyHtml: null } })
const CHANGED: Answer = {
  status: 409,
  body: { error: 'Someone saved this letter after you opened it.', reason: 'changed', changedBy: 'Player Two', changedAt: '2026-11-13 20:17:00' },
}
const words = (bodyHtml: string) => ({ monthLabel: 'December 2026', subject: 'LCA Newsletter · December 2026', preheader: '', bodyHtml })

function held(answer: Answer): { answer: Promise<Answer>; release: () => Promise<void> } {
  let release!: () => void
  const later = new Promise<Answer>((resolve) => {
    release = () => resolve(answer)
  })
  return { answer: later, release: async () => act(async () => release()) }
}

function stubFetch() {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    if (url !== ISSUE_URL) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
    if (method === 'PUT') sent.push(JSON.parse(String(init?.body)))
    const queue = method === 'PUT' ? puts : gets
    const answer = await (queue.shift() ?? { status: 500, body: { error: 'Something went wrong' } })
    if (answer.status === 0) throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-11-13T21:00:00Z'))
  puts = []
  gets = []
  sent = []
  stubFetch()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const settle = () => act(async () => {
  await vi.advanceTimersByTimeAsync(0)
})
const wait = (ms: number) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms)
})
async function opened(answer: unknown = letterAnswer()) {
  gets.push({ status: 200, body: answer })
  const view = renderHook(() => useIssue(true))
  await settle()
  expect(view.result.current.status).toBe('ready')
  return view
}

describe('the saved line at midnight and across daylight saving in America/Chicago', () => {
  const draw = (line: Parameters<typeof SavedLine>[0]['line'], now: string) => {
    cleanup()
    vi.setSystemTime(new Date(now))
    render(<SavedLine line={line} onTryAgain={() => {}} onShowTheirs={() => {}} />)
    return document.querySelector('[data-slot="saved-line"]')!.textContent
  }

  it('calls a save today by the day in Louisiana, not the day in UTC', () => {
    // 11:30 PM Friday, November 13 in Louisiana is 5:30 in the morning of Saturday, November 14 in UTC.
    expect(draw({ kind: 'saved', at: '2026-11-14 05:30:00' }, '2026-11-14T05:45:00Z')).toBe('Saved automatically at 11:30 PM')
    // An hour later it is Saturday there too: the same save was yesterday, though the UTC date has not moved.
    expect(draw({ kind: 'saved', at: '2026-11-14 05:30:00' }, '2026-11-14T06:30:00Z')).toBe('Saved on Friday, November 13, 2026 at 11:30 PM')
    // And a save a few minutes after midnight in Louisiana is today at 12:05 AM.
    expect(draw({ kind: 'saved', at: '2026-11-14 06:05:00' }, '2026-11-14T06:30:00Z')).toBe('Saved automatically at 12:05 AM')
  })

  it('writes the hour right either side of the spring change, March 8, 2026, which has no 2:00 AM', () => {
    const later = '2026-03-09T18:00:00Z'
    expect(draw({ kind: 'saved', at: '2026-03-08 07:59:00' }, later)).toBe('Saved on Sunday, March 8, 2026 at 1:59 AM')
    expect(draw({ kind: 'saved', at: '2026-03-08 08:00:00' }, later)).toBe('Saved on Sunday, March 8, 2026 at 3:00 AM')
  })

  it('writes the hour right either side of the autumn change, November 1, 2026, which has two 1:30 AMs', () => {
    const later = '2026-11-02T18:00:00Z'
    expect(draw({ kind: 'saved', at: '2026-11-01 06:30:00' }, later)).toBe('Saved on Sunday, November 1, 2026 at 1:30 AM')
    expect(draw({ kind: 'saved', at: '2026-11-01 07:30:00' }, later)).toBe('Saved on Sunday, November 1, 2026 at 1:30 AM')
    expect(draw({ kind: 'saved', at: '2026-11-01 08:00:00' }, later)).toBe('Saved on Sunday, November 1, 2026 at 2:00 AM')
  })

  it('names the weekday of a refusal that happened the evening before, in Louisiana, and never writes a 24-hour time', () => {
    const text = draw({ kind: 'conflict', reason: 'changed', by: 'Player Two', at: '2026-11-13 03:05:00', readFailed: false }, '2026-11-13T21:00:00Z')
    expect(text).toContain('Player Two changed this letter on Thursday, November 12, 2026 at 9:05 PM')
    expect(text).not.toMatch(/\b(1[3-9]|2[0-3]):\d\d\b/)
  })
})

describe('the month of a blank letter, by Louisiana\'s clock', () => {
  const blankAt = async (now: string) => {
    vi.setSystemTime(new Date(now))
    const { result } = await opened(NONE)
    const month = result.current.letter.monthLabel
    cleanup()
    return month
  }

  it('turns over at midnight in Louisiana, over the new year', async () => {
    expect(await blankAt('2027-01-01T05:59:00Z')).toBe('December 2026')
    expect(await blankAt('2027-01-01T06:00:00Z')).toBe('January 2027')
  })

  it('turns over an hour earlier in UTC once daylight time has begun', async () => {
    // March 1 is on standard time (midnight at 06:00 UTC); April 1 is on daylight time (midnight at 05:00 UTC).
    expect(await blankAt('2026-03-01T05:59:00Z')).toBe('February 2026')
    expect(await blankAt('2026-03-01T06:00:00Z')).toBe('March 2026')
    expect(await blankAt('2026-04-01T04:59:00Z')).toBe('March 2026')
    expect(await blankAt('2026-04-01T05:00:00Z')).toBe('April 2026')
  })
})

describe('saves racing the server\'s answers', () => {
  it('saves nothing more after a refusal that lands while more words were typed, however long the pause', async () => {
    const { result } = await opened()
    const key = result.current.letterKey
    const refusal = held(CHANGED)
    puts.push(refusal.answer, saved(5))
    act(() => result.current.edit(words(`${BODY}<p>One</p>`)))
    await wait(SAVE_PAUSE_MS)
    expect(sent).toHaveLength(1)
    // More words go in while the first is on the way, and their own pause passes before the answer.
    act(() => result.current.edit(words(`${BODY}<p>One two</p>`)))
    await wait(SAVE_PAUSE_MS * 2)
    await refusal.release()
    await settle()
    expect(result.current.line).toMatchObject({ kind: 'conflict', reason: 'changed', by: 'Player Two' })
    await wait(SAVE_PAUSE_MS * 5)
    act(() => result.current.edit(words(`${BODY}<p>One two three</p>`)))
    await wait(SAVE_PAUSE_MS * 2)
    expect(sent).toHaveLength(1)
    // The person's own words are still the ones on the page for them to copy.
    expect(result.current.letter.bodyHtml).toBe(BODY)
    expect(result.current.letterKey).toBe(key)
  })

  it('sends one save for two presses of Try again, and none after it when the words did not change', async () => {
    const { result } = await opened()
    puts.push({ status: 0, body: null })
    act(() => result.current.edit(words(`${BODY}<p>Sample</p>`)))
    await wait(SAVE_PAUSE_MS)
    expect(result.current.line).toEqual({ kind: 'failed' })
    const answer = held(saved(4))
    puts.push(answer.answer, saved(5))
    act(() => {
      result.current.saveNow()
      result.current.saveNow()
    })
    await settle()
    expect(sent).toHaveLength(2)
    await answer.release()
    await wait(SAVE_PAUSE_MS * 3)
    expect(sent).toHaveLength(2)
    expect(result.current.line).toEqual({ kind: 'saved', at: '2026-11-13 21:00:00' })
  })

  it('does not save the same words twice when an edit puts back what was just saved', async () => {
    const { result } = await opened()
    puts.push(saved(4), saved(5))
    act(() => result.current.edit(words(`${BODY}<p>Sample</p>`)))
    await wait(SAVE_PAUSE_MS)
    expect(sent).toHaveLength(1)
    act(() => result.current.edit(words(`${BODY}<p>Sample</p>`)))
    await wait(SAVE_PAUSE_MS * 3)
    expect(sent).toHaveLength(1)
  })

  it('carries the version each answer gave, in turn, for words typed after a slow answer', async () => {
    const { result } = await opened()
    const slow = held(saved(4))
    puts.push(slow.answer, saved(8))
    act(() => result.current.edit(words(`${BODY}<p>Sample</p>`)))
    await wait(SAVE_PAUSE_MS)
    await slow.release()
    await settle()
    act(() => result.current.edit(words(`${BODY}<p>Sample, again</p>`)))
    await wait(SAVE_PAUSE_MS)
    expect(sent.map((s) => s.version)).toEqual([3, 4])
  })

  it('lets a page that was left take its answer without a word or a second save', async () => {
    const view = await opened()
    const slow = held(saved(4))
    puts.push(slow.answer)
    act(() => view.result.current.edit(words(`${BODY}<p>Sample</p>`)))
    await wait(SAVE_PAUSE_MS)
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    view.unmount()
    await slow.release()
    await wait(SAVE_PAUSE_MS * 3)
    expect(sent).toHaveLength(1)
    expect(quiet).not.toHaveBeenCalled()
  })

  it('sends nothing when the page is left with nothing typed, and when the read never answered', async () => {
    const view = await opened()
    view.unmount()
    await wait(SAVE_PAUSE_MS * 2)
    expect(sent).toEqual([])
    gets.push(new Promise<Answer>(() => {}) as unknown as Answer)
    const late = renderHook(() => useIssue(true))
    late.unmount()
    await wait(SAVE_PAUSE_MS * 2)
    expect(sent).toEqual([])
  })
})

describe('"In this issue" when headings read the same', () => {
  it('draws one line for each heading, in order, each moving to its own place', () => {
    const html = '<h2>Results</h2><p>One</p><h2>Results</h2><p>Two</p><h2>Results 2</h2><p>Three</p><h2>Results</h2><p>Four</p>'
    const parts = letterParts(html)
    expect(new Set(parts.map((p) => p.name)).size).toBe(4)
    const keyed = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onGo = vi.fn()
    render(<InThisIssue parts={parts} onGo={onGo} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.textContent)).toEqual(['Results', 'Results', 'Results 2', 'Results'])
    fireEvent.click(buttons[1])
    fireEvent.click(buttons[3])
    expect(onGo.mock.calls).toEqual([[1], [3]])
    expect(keyed).not.toHaveBeenCalled()
  })

  it('is left out under two parts, whatever the letter holds besides', () => {
    const parts = letterParts('<p>Words before</p><h2>Only heading</h2><p>Words</p><h2></h2>')
    expect(parts).toHaveLength(1)
    render(<InThisIssue parts={parts} onGo={() => {}} />)
    expect(screen.queryByRole('navigation', { name: 'In this issue' })).toBeNull()
  })
})

describe('what the page\'s files hold', () => {
  const root = join(__dirname, '..', '..')
  const dir = join(root, 'src', 'areas', 'admin', 'newsletter')
  const files = [...readdirSync(dir).map((name) => join(dir, name)), join(root, 'src', 'pages', 'AdminNewsletterPage.tsx')]
  const text = (path: string) => readFileSync(path, 'utf8')
  // Built from code points and letters so this file holds neither itself.
  const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`)
  const OLD_NAME = new RegExp(`\\b${['US', 'CF'].join('')}\\b`)

  it('imports types alone from the contracts, so no schema library reaches the site', () => {
    for (const path of files) {
      const imports = text(path).match(/^import[^;]*?from\s+'[^']*domain\/contracts[^']*'/gms) ?? []
      for (const line of imports) expect(line, path).toMatch(/^import type\b/)
    }
  })

  it('writes no dash and no old name of US Chess anywhere', () => {
    for (const path of files) {
      const code = text(path)
      expect(code, path).not.toMatch(DASHES)
      expect(code, path).not.toMatch(OLD_NAME)
    }
  })

  it('writes no 24-hour time in the words a person reads', () => {
    for (const path of files) {
      const strings = text(path).match(/'[^'\n]*'|"[^"\n]*"/g) ?? []
      for (const s of strings) expect(s, `${path}: ${s}`).not.toMatch(/\b(?:1[3-9]|2[0-3]):[0-5]\d\b/)
    }
  })

  it('registers the route only with the switch on, ahead of Admin\'s own section route', () => {
    const app = text(join(root, 'src', 'App.tsx'))
    const route = app.indexOf('path="/admin/newsletter"')
    expect(route).toBeGreaterThan(0)
    expect(app).toMatch(/\{FEATURES\.mailPage && \(\s*<Route path="\/admin\/newsletter"[^\n]*\/>\s*\)\}/)
    expect(route).toBeLessThan(app.indexOf('path="/admin/:section"'))
    expect(app.match(/<AdminNewsletterPage \/>/g)?.length).toBe(1)
    expect(app).toMatch(/lazy\(\(\) => import\('@\/pages\/AdminNewsletterPage'\)/)
  })

  it('lists the editor kit\'s extensions package at the exact version the lock holds, and no other package moves', () => {
    const pkg = JSON.parse(text(join(root, 'package.json'))) as { dependencies: Record<string, string> }
    const lock = JSON.parse(text(join(root, 'package-lock.json'))) as { packages: Record<string, { version?: string; dependencies?: Record<string, string> }> }
    expect(pkg.dependencies['@tiptap/extensions']).toMatch(/^\d+\.\d+\.\d+$/)
    expect(lock.packages['node_modules/@tiptap/extensions'].version).toBe(pkg.dependencies['@tiptap/extensions'])
    expect(lock.packages[''].dependencies?.['@tiptap/extensions']).toBe(pkg.dependencies['@tiptap/extensions'])
  })
})
