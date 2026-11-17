// @vitest-environment jsdom
//
// WS09 checkpoint V, the meeting words on the no-login Still accurate page
// (src/pages/ClubConfirmPage.tsx), the cases beside test/unit/club-confirm-page.test.tsx:
// words that carry markup are drawn as plain text, and the words stay on the
// page through a press that did not go through and is sent again. The page
// is drawn on its own route with fetch stubbed; every club and token here is
// made up.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClubConfirmPage } from '@/pages/ClubConfirmPage'

vi.setConfig({ testTimeout: 15000 })

const TOKEN = 'v1.s.example-made-up-payload.example-made-up-mac'
const LINK = `/api/clubs/confirm/${TOKEN}`
const STATEMENT = 'Saturdays from 10:00 AM to 1:00 PM at the Example Library.'
const CLUB = { name: 'Example Chess Club', city: 'Example City', statement: STATEMENT }

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let asked: Array<{ call: string; body?: string }> = []
let answers: Record<string, () => Response> = {}

beforeEach(() => {
  asked = []
  answers = {
    [`GET ${LINK}`]: () => json(CLUB),
    [`POST ${LINK}`]: () => json({ name: CLUB.name, city: CLUB.city, month: 'November 2026' }),
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
    asked.push({ call, body: typeof init?.body === 'string' ? init.body : undefined })
    return answers[call] ? answers[call]() : json({ error: 'Not found' }, 404)
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function open() {
  render(
    <MemoryRouter initialEntries={[`/clubs/confirm/${TOKEN}`]}>
      <Routes>
        <Route path="/clubs/confirm/:token" element={<ClubConfirmPage />} />
      </Routes>
    </MemoryRouter>,
  )
}
const press = () => act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Still accurate' })) })
const wordsEl = () => document.querySelector('div > div')!.children[2]

describe('the meeting words on the confirm page (WS09 checkpoint V)', () => {
  it('meeting words that carry markup are drawn as plain text, never as elements', async () => {
    answers[`GET ${LINK}`] = () => json({ ...CLUB, statement: 'Meets at <b>7:00 PM</b> & <img src=x onerror=alert(1)> more.' })
    open()
    await screen.findByRole('button', { name: 'Still accurate' })
    expect(wordsEl().textContent).toBe('Meets at <b>7:00 PM</b> & <img src=x onerror=alert(1)> more.')
    expect(wordsEl().querySelector('*')).toBeNull()
  })

  it('the words stay in view after a press that did not go through, and a second press marks the club', async () => {
    let tries = 0
    answers[`POST ${LINK}`] = () => (++tries === 1 ? json({ error: 'Something went wrong' }, 500) : json({ name: CLUB.name, city: CLUB.city, month: 'November 2026' }))
    open()
    await screen.findByRole('button', { name: 'Still accurate' })
    await press()
    await screen.findByText('Not marked: the request did not go through. Nothing changed.')
    expect(screen.getByText(STATEMENT)).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Try again' })) })
    await waitFor(() => expect(screen.getByText('Thanks. Example Chess Club is marked as checked for November 2026.')).toBeTruthy())
    expect(asked.filter((a) => a.call === `POST ${LINK}`)).toHaveLength(2)
    // Once marked, the page says Thanks and draws neither the town nor the words nor a link.
    expect(screen.queryByText(STATEMENT)).toBeNull()
    expect(document.querySelectorAll('a')).toHaveLength(0)
  })

  it('no words from the server (null) draw the email\'s sentence, never a blank line', async () => {
    answers[`GET ${LINK}`] = () => json({ ...CLUB, statement: null })
    open()
    await screen.findByRole('button', { name: 'Still accurate' })
    expect(wordsEl().textContent).toBe('How the club meets is not listed yet.')
  })
})
