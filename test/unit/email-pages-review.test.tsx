// @vitest-environment jsdom
//
// The two pages a member's link opens, drawn beside a copy of them as they
// stood at commit 24bcf50, WS16 step 8 (test/unit/fixtures/email-pages-today.tsx),
// for checkpoint M's review (K's decision 52, part B). Both pages are always
// routed, so what a person can meet of them as shipped has to stay what it was
// except where part B says; each state is drawn from the old copy and from the
// live page, with the same answers from a stand-in for fetch, and the two are
// compared by markup, text, title and the requests made.
//
// - With mailLists off, which is how they ship: a link that does not open, a
//   request with no answer and a server error draw nothing in the main area on
//   either page, as before, and the two pages draw the same page for an
//   answer of 200, once a list email has gone, state by state.
// - With mailLists on, the pages are the old pages in every state where part B
//   changes nothing: the unsubscribe page and the choices as they load, the
//   refusal in the server's words, a save that fails.
// - Where part B changes something, the change is exactly it and no more: a
//   link that does not open gains its heading above a sentence that is word
//   for word the old one (B7); "Saved." and "Done." keep their words and their
//   status region, drawn in a box (B1); the choices with every optional email
//   stopped gain one status in words under each list and a muted label (B2).
// Every token, address and list here is made up.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}))

const { EmailUnsubscribePage } = await import('@/pages/EmailUnsubscribePage')
const { EmailPreferencesPage } = await import('@/pages/EmailPreferencesPage')
const { EmailUnsubscribePageToday, EmailPreferencesPageToday } = await import('./fixtures/email-pages-today')

const UNSUBSCRIBE_TOKEN = 'sample0contact0id0000000000000001.lca-newsletter.sampleSignature0000001'
const PREFERENCES_TOKEN = 'sample0contact0id0000000000000001.p.sampleSignature0000002'
const UNSUBSCRIBE_URL = `/api/mail/unsubscribe/${UNSUBSCRIBE_TOKEN}`
const PREFERENCES_URL = `/api/mail/preferences/${PREFERENCES_TOKEN}`
const TITLE_BEFORE = 'A title set before the page'
const STOPPED = 'Off while all optional email is stopped.'
const OLD_RING = 'focus-visible:ring-3 focus-visible:ring-focus'
const NEW_RING = 'focus:ring-3 focus:ring-ring'

/** What a stand-in endpoint answers: a status and a body, or a thrown failure, as a request that got no answer. */
type Answer = { status: number; body: unknown } | 'no answer'
type Answers = Record<string, Answer[]>

const notFound: Answer = { status: 404, body: { error: "This link isn't working." } }
const unsubscribeAnswer: Answer = { status: 200, body: { list: 'LCA newsletter' } }
const done: Answer = { status: 200, body: { unsubscribed: true, list: 'LCA newsletter', preferencesToken: PREFERENCES_TOKEN } }
const choices = (optionalOff = false): Answer => ({
  status: 200,
  body: {
    address: 'p...@example.org',
    lists: [{ id: 'lca-newsletter', name: 'LCA newsletter', on: true }, { id: 'club-example', name: 'Example Chess Club news', on: false }],
    optionalOff,
  },
})

let calls: string[] = []
let answers: Answers = {}

beforeEach(() => {
  calls = []
  answers = {}
  document.title = TITLE_BEFORE
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    const reply = answers[`${method} ${url}`]?.shift()
    if (!reply || reply === 'no answer') throw new TypeError('Failed to fetch')
    return new Response(JSON.stringify(reply.body), { status: reply.status })
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  flags.mailLists = false
})

/** Lets the answers the page is waiting for arrive. */
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

/** Markup with React's generated ids read in the order they appear, so two drawings compare whatever ids came before. */
function normalised(html: string): string {
  const seen = new Map<string, string>()
  return html.replace(/(?:_r_|:r|«r)[0-9a-z]*(?:_|:|»)/g, (id) => {
    if (!seen.has(id)) seen.set(id, `generated-${seen.size}`)
    return seen.get(id)!
  })
}

interface Drawn { markup: string; text: string; title: string; calls: string[] }

/** One page at its address with the answers given, what it draws, and what it does after `then`. */
async function draw(Page: ComponentType, path: string, given: Answers, then?: () => Promise<void>): Promise<Drawn> {
  calls = []
  answers = Object.fromEntries(Object.entries(given).map(([key, replies]) => [key, [...replies]]))
  document.title = TITLE_BEFORE
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <main data-testid="main">
        <Routes>
          <Route path="/email/unsubscribe/:token" element={<Page />} />
          <Route path="/email/preferences/:token" element={<Page />} />
          <Route path="/contact" element={<h1>Contact page</h1>} />
        </Routes>
      </main>
    </MemoryRouter>,
  )
  await settle()
  await then?.()
  const main = screen.getByTestId('main')
  const drawn = { markup: normalised(main.innerHTML), text: main.textContent ?? '', title: document.title, calls: [...calls] }
  view.unmount()
  return drawn
}

const pair = async (Old: ComponentType, New: ComponentType, path: string, given: Answers, then?: () => Promise<void>) => ({
  old: await draw(Old, path, given, then),
  now: await draw(New, path, given, then),
})

const UNSUB = { Old: EmailUnsubscribePageToday, New: EmailUnsubscribePage, path: `/email/unsubscribe/${UNSUBSCRIBE_TOKEN}`, url: UNSUBSCRIBE_URL, heading: 'Unsubscribe' }
const PREFS = { Old: EmailPreferencesPageToday, New: EmailPreferencesPage, path: `/email/preferences/${PREFERENCES_TOKEN}`, url: PREFERENCES_URL, heading: 'Your email choices' }

const press = (name: string) => async () => {
  fireEvent.click(screen.getByRole('button', { name }))
  await settle()
}

describe('with mailLists off, as the pages ship', () => {
  beforeEach(() => {
    flags.mailLists = false
  })

  it.each([UNSUB, PREFS])('draws nothing in the main area, leaves the title and asks one GET, for a link that does not open, a request with no answer and a server error, as before ($heading)', async (page) => {
    for (const reply of [notFound, 'no answer', { status: 500, body: { error: 'Something broke.' } }] as Answer[]) {
      const { old, now } = await pair(page.Old, page.New, page.path, { [`GET ${page.url}`]: [reply] })
      expect(old.markup).toBe('')
      expect(now).toEqual(old)
      expect(now.title).toBe(TITLE_BEFORE)
      expect(now.calls).toEqual([`GET ${page.url}`])
    }
  })

  it('draws the same unsubscribe page for an answer of 200, once a list email has gone, and the same words after each press', async () => {
    const given = { [`GET ${UNSUBSCRIBE_URL}`]: [unsubscribeAnswer], [`POST ${UNSUBSCRIBE_URL}`]: [done] }
    const load = await pair(UNSUB.Old, UNSUB.New, UNSUB.path, given)
    expect(load.now).toEqual(load.old)
    expect(load.now.text).toContain('Stop the LCA newsletter?')
    const pressed = await pair(UNSUB.Old, UNSUB.New, UNSUB.path, given, press('Unsubscribe'))
    expect(pressed.now.text).toBe(pressed.old.text)
    expect(pressed.now.calls).toEqual(pressed.old.calls)
    expect(pressed.now.text).toContain("Done. The LCA newsletter won't come to this address any more.")
  })

  it('draws the same choices page for an answer of 200, and the same words after a save and with every optional email stopped, but for the status in words', async () => {
    const given = { [`GET ${PREFERENCES_URL}`]: [choices()], [`PATCH ${PREFERENCES_URL}`]: [choices()] }
    const load = await pair(PREFS.Old, PREFS.New, PREFS.path, given)
    expect(load.now.markup.replace(NEW_RING, OLD_RING)).toBe(load.old.markup)
    expect(load.now.text).toBe(load.old.text)
    const saved = await pair(PREFS.Old, PREFS.New, PREFS.path, given, press('Save my choices'))
    expect(saved.now.text).toBe(saved.old.text)
    expect(saved.now.calls).toEqual(saved.old.calls)
    const stopped = await pair(PREFS.Old, PREFS.New, PREFS.path, given, async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Stop all optional email from LCA' }))
    })
    expect(stopped.now.text.split(STOPPED).join('')).toBe(stopped.old.text)
  })
})

describe('with mailLists on, the pages the review leaves alone', () => {
  beforeEach(() => {
    flags.mailLists = true
  })

  it('draws the unsubscribe page as it loads exactly as before, with the one GET', async () => {
    const { old, now } = await pair(UNSUB.Old, UNSUB.New, UNSUB.path, { [`GET ${UNSUBSCRIBE_URL}`]: [unsubscribeAnswer] })
    expect(now).toEqual(old)
    expect(now.text).toContain('Stop the LCA newsletter?')
    expect(now.calls).toEqual([`GET ${UNSUBSCRIBE_URL}`])
  })

  it('draws the choices as they load exactly as before but for the status region\'s ring, which is at the site\'s full strength (B1)', async () => {
    const { old, now } = await pair(PREFS.Old, PREFS.New, PREFS.path, { [`GET ${PREFERENCES_URL}`]: [choices()] })
    expect(old.markup).toContain(OLD_RING)
    expect(now.markup).toContain(NEW_RING)
    expect(now.markup.replace(NEW_RING, OLD_RING)).toBe(old.markup)
    expect(now.text).toBe(old.text)
    expect(now.calls).toEqual(old.calls)
  })

  it('draws a refusal in the server\'s own words and a save that got no answer exactly as before, the ring apart', async () => {
    for (const reply of [{ status: 400, body: { error: 'Pick a list that is yours.' } }, 'no answer'] as Answer[]) {
      const given = { [`GET ${PREFERENCES_URL}`]: [choices()], [`PATCH ${PREFERENCES_URL}`]: [reply] }
      const { old, now } = await pair(PREFS.Old, PREFS.New, PREFS.path, given, press('Save my choices'))
      expect(now.markup.replace(NEW_RING, OLD_RING)).toBe(old.markup)
      expect(now.text).toBe(old.text)
    }
  })

  it('draws a link that does not open as the old page did with a heading above a sentence that is the old one word for word, and the Contact link as it was (B7)', async () => {
    for (const page of [UNSUB, PREFS]) {
      for (const reply of [notFound, 'no answer'] as Answer[]) {
        const { old, now } = await pair(page.Old, page.New, page.path, { [`GET ${page.url}`]: [reply] })
        expect(now.text, `${page.heading}, ${reply === 'no answer' ? 'no answer' : '404'}`).toBe(`${page.heading}${old.text}`)
        const heading = `<h1 class="text-2xl font-bold text-ink">${page.heading}</h1>`
        expect(now.markup).toBe(old.markup.replace('<p class="text-ink">', `${heading}<p class="mt-3 text-ink">`))
        expect(now.title).toBe(old.title)
        expect(now.calls).toEqual(old.calls)
      }
    }
  })

  it('keeps the words of "Done." and "Saved.", the one POST and the one PATCH, and the link on, in a box now (B1)', async () => {
    const unsub = await pair(UNSUB.Old, UNSUB.New, UNSUB.path, { [`GET ${UNSUBSCRIBE_URL}`]: [unsubscribeAnswer], [`POST ${UNSUBSCRIBE_URL}`]: [done] }, press('Unsubscribe'))
    expect(unsub.now.text).toBe(unsub.old.text)
    expect(unsub.now.calls).toEqual(unsub.old.calls)
    expect(unsub.old.markup).not.toContain('bg-ok-50')
    expect(unsub.now.markup).toContain('bg-ok-50')
    expect(unsub.now.markup).toContain(`href="/email/preferences/${PREFERENCES_TOKEN}"`)
    const prefs = await pair(PREFS.Old, PREFS.New, PREFS.path, { [`GET ${PREFERENCES_URL}`]: [choices()], [`PATCH ${PREFERENCES_URL}`]: [choices()] }, press('Save my choices'))
    expect(prefs.now.text).toBe(prefs.old.text)
    expect(prefs.now.calls).toEqual(prefs.old.calls)
    expect(prefs.old.markup).not.toContain('bg-ok-50')
    expect(prefs.now.markup).toContain('bg-ok-50')
  })

  it('draws the stop-all\'s choices as the old page did with one status in words under each list and the labels muted, and nothing else (B2)', async () => {
    const ticked = async () => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Stop all optional email from LCA' }))
    }
    const { old, now } = await pair(PREFS.Old, PREFS.New, PREFS.path, { [`GET ${PREFERENCES_URL}`]: [choices()] }, ticked)
    expect(now.text.split(STOPPED).join('')).toBe(old.text)
    expect(now.text.split(STOPPED)).toHaveLength(3)
    expect(now.calls).toEqual(old.calls)
    // Told from the old page's markup by the notes, the descriptions that point at them, the muted labels and the ring.
    const stripped = now.markup
      .replace(NEW_RING, OLD_RING)
      .replace(/<p id="[^"]*-off" class="ml-6 text-sm text-muted-foreground">Off while all optional email is stopped\.<\/p>/g, '')
      .replace(/ aria-describedby="[^"]*"/g, '')
      .replace(/text-muted-foreground"><input/g, 'text-ink"><input')
    const oldStripped = old.markup.replace(/ aria-describedby="[^"]*"/g, '')
    expect(stripped).toBe(oldStripped)
  })
})

describe('what a person meets of the pages, read from the classes they wear and compiled by Tailwind (B1, B7)', () => {
  beforeEach(() => {
    flags.mailLists = true
  })

  it('draws the heading of a link that does not work in the heading style of the page it stands for, at 24px', async () => {
    for (const [page, working] of [[UNSUB, { [`GET ${UNSUBSCRIBE_URL}`]: [unsubscribeAnswer] }], [PREFS, { [`GET ${PREFERENCES_URL}`]: [choices()] }]] as const) {
      const heading = async (given: Answers) => {
        answers = { ...given }
        calls = []
        const view = render(
          <MemoryRouter initialEntries={[page.path]}>
            <Routes>
              <Route path="/email/unsubscribe/:token" element={<page.New />} />
              <Route path="/email/preferences/:token" element={<page.New />} />
            </Routes>
          </MemoryRouter>,
        )
        await settle()
        const h1 = view.container.querySelector('h1')
        view.unmount()
        return h1
      }
      const failing = await heading({ [`GET ${page.url}`]: [notFound] })
      const open = await heading(working)
      expect(failing?.tagName, page.heading).toBe('H1')
      expect(open?.tagName, page.heading).toBe('H1')
      // The page that works draws its h1 in the same classes as the page for a link that does not, which is one style.
      expect(failing!.getAttribute('class')).toBe(open!.getAttribute('class'))
      const token = sizeClassOf(failing)
      expect(token).toBe('text-2xl')
      expect(setBy((await builder())([token!]), token!, 'font-size')).toEqual({ px: 24, media: null })
    }
  })

  it('draws the result box with 12px of padding on every side, a one-pixel border, a check mark 20px square and the words at the page\'s size', async () => {
    const box = async () => {
      answers = { [`GET ${PREFERENCES_URL}`]: [choices()], [`PATCH ${PREFERENCES_URL}`]: [choices()] }
      const view = render(
        <MemoryRouter initialEntries={[PREFS.path]}>
          <Routes>
            <Route path="/email/preferences/:token" element={<EmailPreferencesPage />} />
          </Routes>
        </MemoryRouter>,
      )
      await settle()
      fireEvent.click(screen.getByRole('button', { name: 'Save my choices' }))
      await settle()
      const found = screen.getByRole('status').firstElementChild as HTMLElement
      const classes = found.getAttribute('class')!.split(/\s+/)
      const icon = found.querySelector('svg')!.getAttribute('class')!.split(/\s+/)
      const words = found.querySelector('p')!
      const result = { classes, icon, wordsSize: sizeClassOf(words) }
      view.unmount()
      return result
    }
    const { classes, icon, wordsSize } = await box()
    const css = (await builder())(['p-3', 'border', 'size-5', 'text-base'])
    expect(setBy(css, 'p-3', 'padding')).toEqual({ px: 12, media: null })
    expect(classes).toContain('p-3')
    expect(classes).toContain('border')
    expect(icon).toContain('size-5')
    expect(setBy(css, 'size-5', 'width')).toEqual({ px: 20, media: null })
    expect(setBy(css, 'size-5', 'height')).toEqual({ px: 20, media: null })
    // The words wear no size class of their own and are drawn at the page's size, 16px.
    expect(wordsSize).toBeNull()
  })
})
