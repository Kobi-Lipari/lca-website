// @vitest-environment jsdom
//
// The no-login Still accurate page (src/pages/ClubConfirmPage.tsx) when the
// link has been opened too often in an hour from one place (WS09 step 25):
// the server's 429 is said in the server's own words, with the way onward to
// the home page, on the load and at the press alike, never as a connection
// fault with a Try again that would only be refused again. The page is drawn
// on its own route with fetch stubbed; every club and token here is made up.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClubConfirmPage } from '@/pages/ClubConfirmPage'

vi.setConfig({ testTimeout: 15000 })

const TOKEN = 'v1.s.example-made-up-payload.example-made-up-mac'
const LINK = `/api/clubs/confirm/${TOKEN}`
const CLUB = { name: 'Example Chess Club', city: 'Example City', statement: null }
/** The server's words for the limit, as functions/api/clubs/confirm/[token].ts writes them for a link opened too often. */
const TOO_MANY = 'This link has been opened too many times this hour. Try again in an hour.'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
let answers: Record<string, () => Response> = {}

beforeEach(() => {
  answers = {
    [`GET ${LINK}`]: () => json(CLUB),
    [`POST ${LINK}`]: () => json({ name: CLUB.name, city: CLUB.city, month: 'November 2026' }),
  }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const call = `${init?.method ?? 'GET'} ${url}`
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

describe('the confirm page at the limit', () => {
  it('a 429 on the load is said in the server\'s words, with the way to the home page and no Try again', async () => {
    answers[`GET ${LINK}`] = () => json({ error: TOO_MANY }, 429)
    open()
    expect(await screen.findByText(TOO_MANY)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe(TOO_MANY)
    expect(screen.getByRole('link', { name: 'Go to the home page' }).getAttribute('href')).toBe('/')
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(screen.queryByText(/Check your connection/)).toBeNull()
  })

  it('a 429 at the press is said in the server\'s words too, not as a request that did not go through', async () => {
    answers[`POST ${LINK}`] = () => json({ error: TOO_MANY }, 429)
    open()
    const button = await screen.findByRole('button', { name: 'Still accurate' })
    await act(async () => { fireEvent.click(button) })
    expect(await screen.findByText(TOO_MANY)).toBeTruthy()
    expect(screen.queryByText(/did not go through/)).toBeNull()
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toBeTruthy()
  })
})
