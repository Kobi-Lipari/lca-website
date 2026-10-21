// @vitest-environment jsdom
//
// The still hero picture and its files at their edges (WS01 step 29).
// test/unit/hero-no-autoplay.test.tsx, image-budget.test.ts and
// no-rotation.test.ts hold the main run; this file adds what they leave out.
//
// - ResponsiveImage on its own. A picture that is not the page's largest
//   waits until it nears the screen (loading="lazy") and asks for no
//   priority; the largest is fetched first (fetchpriority="high") and is
//   never lazy. The AVIF source comes first, so a browser that can show both
//   takes the smaller AVIF, and both list every file by its width under the
//   same sizes. The img carries the photo's own width and height, never a
//   file's, and as its own src the fallback the caller names, in a format
//   every browser shows, never a file the sources list and with no srcset,
//   so a browser that can show neither AVIF nor WebP has a picture to take.
//   An empty alt stays empty (the picture is decoration) and words stay
//   words. The class and the style reach the img. The module gives the
//   component alone.
// - The hero's sizes says what the browser draws: the photo covers the 420
//   pixel high hero, so a 2048 by 1237 photo is drawn 696 pixels wide in any
//   window narrower than that, and across the window in a wider one.
// - The hero with newLook on does not follow the lists below it: whether the
//   upcoming events and the clubs answer with rows, answer empty, answer
//   late, fail with the local database's "database is locked" or never reach
//   the server, the hero is the same to the attribute, the page sets no
//   timer, and the lists say what they have below the hero.
// - Leaving the page: with newLook off the slideshow's one timer goes with
//   the page, after its controls are used and when React runs its effect
//   twice (strict mode); with newLook on there is none at any point.
// - What ships: in the whole of src only HomePage.tsx names a file in
//   src/assets/generated, slide 1's six, and nothing gathers the folder, so
//   a build carries those six and none of the other 24.
// - The files hold pictures and nothing else: each AVIF one coded image
//   (av01) in 8 bits with its colour at half resolution (4:2:0), no colour
//   profile and no camera or text data; each WebP one plain lossy picture (a
//   single VP8 chunk) whose RIFF size is the file's. The notes beside the
//   script's quality table give the four lowered files' sizes as they are.
// - The lab check stays on this computer: it serves and measures 127.0.0.1
//   from the local build and database, refuses every other host, keeps
//   Lighthouse's own mobile settings, has no score to pass, and says not to
//   run it beside npm run test:a11y. It stops before building when a port the
//   test servers use is taken, and stops the server and the browser it
//   started when it ends or is stopped by SIGINT, SIGTERM or SIGHUP.
// - The record of the site with newLook off is the one made before the
//   step: test/a11y/baseline.json keeps its sha256, and its sample of / is
//   the hero's "Find a tournament", the default Button, navy on gold. A new
//   recording (A11Y_BASELINE=record) would hide a change to the site as
//   visitors see it today, so this makes one a change someone sees.
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { StrictMode, type ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ResponsiveImage, type ResponsiveImageProps } from '@/components/ResponsiveImage'
import { AuthContext } from '@/contexts/auth-context'
import type { AuthContextValue } from '@/contexts/AuthContext'
import { HomePage } from '@/pages/HomePage'

const flags = vi.hoisted(() => ({ newLook: true }))
vi.mock('@/lib/features', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/features')>()
  return {
    ...real,
    FEATURES: {
      ...real.FEATURES,
      get newLook() {
        return flags.newLook
      },
    },
  }
})
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
// The Facebook band fetches from the server; the hero and the two lists are what is read here.
vi.mock('@/components/FacebookFeed', () => ({ FacebookFeed: () => null }))

const ROOT = join(__dirname, '../..')
const GENERATED = join(ROOT, 'src/assets/generated')

/** A visitor who is not signed in. */
const SIGNED_OUT = { user: null, member: null, session: null, role: 'member', loading: false } as unknown as AuthContextValue

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  flags.newLook = true
})

describe('ResponsiveImage on its own', () => {
  /** Made-up files of one photo at three widths. */
  const files = (format: 'avif' | 'webp', widths = [640, 1024, 1600]) => widths.map((w) => ({ src: `/pictures/hall-${w}.${format}`, width: w }))
  const BASE: ResponsiveImageProps = { avif: files('avif'), webp: files('webp'), fallback: '/pictures/hall.jpg', width: 3000, height: 2000, sizes: '(max-width: 600px) 600px, 50vw', alt: '' }

  function draw(props: Partial<ResponsiveImageProps> = {}) {
    const { container } = render(<ResponsiveImage {...BASE} {...props} />)
    const picture = container.firstElementChild as HTMLElement
    return { picture, img: picture.querySelector('img') as HTMLImageElement, sources: [...picture.querySelectorAll('source')] }
  }

  it('lets a picture that is not the page\'s largest wait until it nears the screen, with no priority asked', () => {
    for (const props of [{}, { priority: false }]) {
      const { img } = draw(props)
      expect(img.getAttribute('loading')).toBe('lazy')
      expect(img.hasAttribute('fetchpriority')).toBe(false)
      cleanup()
    }
  })

  it('fetches the page\'s largest picture first and never lazily', () => {
    const { img } = draw({ priority: true })
    expect(img.getAttribute('fetchpriority')).toBe('high')
    expect(img.getAttribute('loading')).toBe('eager')
  })

  it('holds the AVIF source before the WebP one, each listing every file by its width under the same sizes', () => {
    const { picture, sources } = draw()
    expect(picture.tagName).toBe('PICTURE')
    expect([...picture.children].map((el) => el.tagName)).toEqual(['SOURCE', 'SOURCE', 'IMG'])
    expect(sources.map((s) => [s.getAttribute('type'), s.getAttribute('srcset'), s.getAttribute('sizes')])).toEqual([
      ['image/avif', '/pictures/hall-640.avif 640w, /pictures/hall-1024.avif 1024w, /pictures/hall-1600.avif 1600w', BASE.sizes],
      ['image/webp', '/pictures/hall-640.webp 640w, /pictures/hall-1024.webp 1024w, /pictures/hall-1600.webp 1600w', BASE.sizes],
    ])
  })

  it('gives the img the photo\'s own width and height, not the width of any file', () => {
    const { img } = draw()
    expect([img.getAttribute('width'), img.getAttribute('height')]).toEqual(['3000', '2000'])
  })

  it('gives the img the fallback the caller names as its src, never a file the sources list, and no srcset of its own', () => {
    const { img, sources } = draw()
    expect(img.getAttribute('src')).toBe('/pictures/hall.jpg')
    expect(img.hasAttribute('srcset')).toBe(false)
    for (const source of sources) expect(source.getAttribute('srcset')).not.toContain('/pictures/hall.jpg')
    cleanup()
    // However the files are listed, and whatever the caller names.
    for (const fallback of ['/pictures/hall.jpg', '/pictures/hall-2048.png']) {
      const { img: other } = draw({ webp: files('webp', [1600, 640, 1024]), avif: files('avif', [1024]), fallback })
      expect(other.getAttribute('src')).toBe(fallback)
      cleanup()
    }
  })

  it('keeps an empty alt empty, so the picture is decoration, and words as words', () => {
    const { img } = draw({ alt: '' })
    expect(img.hasAttribute('alt')).toBe(true)
    expect(img.getAttribute('alt')).toBe('')
    expect(screen.queryByRole('img')).toBeNull()
    cleanup()
    draw({ alt: 'Players at long tables in a tournament hall' })
    expect(screen.getByRole('img', { name: 'Players at long tables in a tournament hall' })).toBeTruthy()
  })

  it('puts the class and the style on the img, and none on the picture', () => {
    const { picture, img } = draw({ className: 'absolute inset-0 h-full w-full object-cover', style: { filter: 'grayscale(35%)', transform: 'scale(1.04)' } })
    expect(img.getAttribute('class')).toBe('absolute inset-0 h-full w-full object-cover')
    expect(img.getAttribute('style')).toBe('filter: grayscale(35%); transform: scale(1.04);')
    expect(picture.getAttributeNames()).toEqual([])
  })

  it('gives the component alone from its module', async () => {
    expect(Object.keys(await import('@/components/ResponsiveImage'))).toEqual(['ResponsiveImage'])
  })
})

/** Answers the page's two list requests; anything else is a 404. */
interface Lists {
  events: () => Promise<Response>
  clubs: () => Promise<Response>
}

const asJson = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const asText = (status: number, body: string) => async () => new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
const refused = async (): Promise<Response> => {
  throw new TypeError('Failed to fetch')
}
const EMPTY: Lists = { events: asJson(200, { tournaments: [] }), clubs: asJson(200, { clubs: [] }) }

function answerLists(lists: Lists) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).startsWith('/api/clearinghouse')) return lists.events()
    if (String(url).startsWith('/api/clubs')) return lists.clubs()
    return new Response('{}', { status: 404 })
  }))
}

/** Lets the page's list requests and what they set run to the end. */
async function settle() {
  for (let i = 0; i < 6; i++) await act(async () => {})
}

/** Draws the home page with newLook on or off, its lists answered as given. */
async function drawHome(newLook: boolean, lists: Lists = EMPTY, wrap: (page: ReactNode) => ReactNode = (page) => page) {
  flags.newLook = newLook
  answerLists(lists)
  const view = render(
    wrap(
      <AuthContext.Provider value={SIGNED_OUT}>
        <MemoryRouter initialEntries={['/']}>
          <HomePage />
        </MemoryRouter>
      </AuthContext.Provider>,
    ),
  )
  await settle()
  const hero = () => view.container.querySelector('[data-ground="dark"]') as HTMLElement
  return { ...view, hero }
}

/** The hero drawn with newLook on and both lists answered empty, the markup the other cases are held to. */
async function emptyListsHero(): Promise<string> {
  const { hero, unmount } = await drawHome(true)
  const html = hero().outerHTML
  unmount()
  vi.unstubAllGlobals()
  return html
}

describe('the hero\'s sizes', () => {
  it('says the picture is drawn 696 pixels wide in a window under 696: a 2048 by 1237 photo covering the 420 pixel high hero', async () => {
    const { hero } = await drawHome(true)
    const img = hero().querySelector(':scope > picture > img') as HTMLImageElement
    const box = Number.parseFloat(hero().style.height)
    const [width, height] = [Number(img.getAttribute('width')), Number(img.getAttribute('height'))]
    const covered = Math.ceil((box * width) / height)
    expect([box, width, height, covered]).toEqual([420, 2048, 1237, 696])
    const sizes = [...hero().querySelectorAll('source')].map((s) => s.getAttribute('sizes'))
    expect(sizes).toEqual([`(max-width: ${covered - 1}px) ${covered}px, 100vw`, `(max-width: ${covered - 1}px) ${covered}px, 100vw`])
  })
})

describe('the hero with newLook on, whatever the lists below it do', () => {
  /** Made-up rows: an LCA event open for entries, a partner event out of state and a club. */
  const LCA_EVENT = {
    id: 'fx-hero-open', name: 'Fixture Hero Open', start_date: '2026-11-07', end_date: null, organizer: null, city: 'Fixture City', state: 'LA', venue: null,
    rating_system: null, eligibility: null, contact: null, link: null, is_lca: 1, source: 'lca', registration_status: 'open', status: 'upcoming',
  }
  const PARTNER_EVENT = {
    id: 'fx-hero-partner', name: 'Fixture Partner Swiss', start_date: '2026-11-14', end_date: '2026-11-15', organizer: 'Fixture Organizer', city: 'Fixture Town', state: 'TX',
    venue: null, rating_system: null, eligibility: null, contact: null, link: 'https://example.org/fixture-partner', is_lca: 0, source: 'clearinghouse',
  }
  const CLUB = { id: 'fx-hero-club', name: 'Fixture Hero Club', city: 'Fixture City', meeting_schedule: 'Thursdays, 7:00 PM', color: null, image_url: null, region: null }
  const LOCKED = 'database is locked: SQLITE_BUSY'
  const NONE = ['No upcoming tournaments.', 'No clubs listed yet.']

  const CASES: Array<[string, Lists, string[]]> = [
    ['answer with rows', { events: asJson(200, { tournaments: [PARTNER_EVENT, LCA_EVENT] }), clubs: asJson(200, { clubs: [CLUB] }) }, ['Fixture Hero Open', 'Fixture Partner Swiss', 'Fixture Hero Club']],
    ['answer empty', EMPTY, NONE],
    ['fail with the database locked', { events: asJson(500, { error: LOCKED }), clubs: asJson(500, { error: LOCKED }) }, NONE],
    ['fail with the lock in plain words, not JSON', { events: asText(500, `D1_ERROR: ${LOCKED}`), clubs: asText(500, `D1_ERROR: ${LOCKED}`) }, NONE],
    ['never reach the server', { events: refused, clubs: refused }, NONE],
  ]

  it.each(CASES)('is the same to the attribute, with no timer set, when the lists %s, and the lists say what they have below it', async (_, lists, lines) => {
    vi.useFakeTimers()
    const expected = await emptyListsHero()
    const interval = vi.spyOn(globalThis, 'setInterval')
    const timeout = vi.spyOn(globalThis, 'setTimeout')
    const { container, hero } = await drawHome(true, lists)
    expect(container.querySelectorAll('[data-ground="dark"]')).toHaveLength(1)
    expect(hero().outerHTML).toBe(expected)
    for (const line of lines) {
      expect(container.textContent, line).toContain(line)
      expect(hero().textContent, line).not.toContain(line)
    }
    expect(interval).not.toHaveBeenCalled()
    expect(timeout).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('is the same before and after a list that answers late', async () => {
    vi.useFakeTimers()
    const expected = await emptyListsHero()
    let answer: (r: Response) => void = () => {}
    const late = new Promise<Response>((resolve) => {
      answer = resolve
    })
    const { container, hero } = await drawHome(true, { events: () => late, clubs: asJson(200, { clubs: [CLUB] }) })
    expect(hero().outerHTML).toBe(expected)
    expect(container.textContent).toContain('Loading…')
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    answer(new Response(JSON.stringify({ tournaments: [LCA_EVENT] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    await settle()
    expect(container.textContent).toContain('Fixture Hero Open')
    expect(hero().outerHTML).toBe(expected)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('leaving the page', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('with newLook off takes the slideshow\'s one timer with it, after its controls are used', async () => {
    const { unmount } = await drawHome(false)
    expect(vi.getTimerCount()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }))
    fireEvent.click(screen.getByRole('button', { name: 'Slide 4' }))
    fireEvent.click(screen.getByRole('button', { name: 'Previous slide' }))
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('with newLook off keeps one timer, moving one slide in 5 seconds, when React runs the effect twice as strict mode does', async () => {
    const { hero, unmount } = await drawHome(false, EMPTY, (page) => <StrictMode>{page}</StrictMode>)
    expect(vi.getTimerCount()).toBe(1)
    await act(async () => {
      vi.advanceTimersByTime(5_000)
    })
    expect((hero().firstElementChild as HTMLElement).style.transform).toBe('translateX(-100%)')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('with newLook on has no timer while the page is drawn, in strict mode or not, or after it goes', async () => {
    for (const wrap of [(page: ReactNode) => page, (page: ReactNode) => <StrictMode>{page}</StrictMode>]) {
      const { unmount } = await drawHome(true, EMPTY, wrap)
      expect(vi.getTimerCount()).toBe(0)
      unmount()
      expect(vi.getTimerCount()).toBe(0)
    }
  })
})

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

describe('what a build carries of the generated files', () => {
  it('names slide 1\'s six in HomePage.tsx and no other file in src, and nothing gathers the folder', () => {
    const read = [...filesUnder(join(ROOT, 'src')), join(ROOT, 'index.html'), join(ROOT, 'vite.config.ts')].filter((path) => /\.(tsx?|css|html)$/.test(path))
    expect(read.length).toBeGreaterThan(150)
    const named = read.flatMap((path) => [...readFileSync(path, 'utf8').matchAll(/assets\/generated\/([\w.-]+)/g)].map((m) => `${relative(ROOT, path)} ${m[1]}`))
    expect(named).toEqual(['avif', 'webp'].flatMap((format) => [640, 1024, 1600].map((w) => `src/pages/HomePage.tsx LCA_Slide_1-${w}.${format}`)))
    expect(read.filter((path) => /import\.meta\.glob/.test(readFileSync(path, 'utf8'))).map((path) => relative(ROOT, path))).toEqual([])
  })
})

/** The boxes of an ISO media file between two offsets: their type and where their content starts and ends. */
function boxes(buf: Buffer, start: number, end: number): Array<{ type: string; body: number; end: number }> {
  const out: Array<{ type: string; body: number; end: number }> = []
  let at = start
  while (at + 8 <= end) {
    let size = buf.readUInt32BE(at)
    const type = buf.toString('latin1', at + 4, at + 8)
    let body = at + 8
    if (size === 1) {
      size = Number(buf.readBigUInt64BE(at + 8))
      body = at + 16
    } else if (size === 0) size = end - at
    out.push({ type, body, end: at + size })
    at += size
  }
  return out
}

/** What an AVIF holds: its top boxes, its items' types, its colour boxes' kinds, and its bit depth and chroma from the av1C box. */
function avifParts(buf: Buffer) {
  const top = boxes(buf, 0, buf.length)
  const meta = top.find((b) => b.type === 'meta')!
  // meta, iinf and infe are full boxes: four bytes of version and flags come first.
  const inMeta = boxes(buf, meta.body + 4, meta.end)
  const iinf = inMeta.find((b) => b.type === 'iinf')!
  const entries = boxes(buf, iinf.body + 4 + (buf[iinf.body] === 0 ? 2 : 4), iinf.end).filter((b) => b.type === 'infe')
  // An infe of version 2 or 3: its item id (2 or 4 bytes) and protection index (2 bytes), then its type.
  const items = entries.map((b) => {
    const at = b.body + 4 + (buf[b.body] === 2 ? 2 : 4) + 2
    return buf.toString('latin1', at, at + 4)
  })
  const iprp = inMeta.find((b) => b.type === 'iprp')!
  const ipco = boxes(buf, iprp.body, iprp.end).find((b) => b.type === 'ipco')!
  const properties = boxes(buf, ipco.body, ipco.end)
  const av1C = properties.find((b) => b.type === 'av1C')!
  const bits = buf[av1C.body + 2]
  return {
    top: top.map((b) => b.type),
    items,
    colour: properties.filter((b) => b.type === 'colr').map((b) => buf.toString('latin1', b.body, b.body + 4)),
    depth: (bits >> 6) & 1 ? ((bits >> 5) & 1 ? 12 : 10) : 8,
    monochrome: Boolean((bits >> 4) & 1),
    chroma: (bits >> 3) & 1 && (bits >> 2) & 1 ? '4:2:0' : (bits >> 3) & 1 ? '4:2:2' : '4:4:4',
  }
}

/** A WebP's chunks, in order, and whether its RIFF size is the file's. */
function webpParts(buf: Buffer) {
  const chunks: string[] = []
  let at = 12
  while (at + 8 <= buf.length) {
    const size = buf.readUInt32LE(at + 4)
    chunks.push(buf.toString('latin1', at, at + 4))
    at += 8 + size + (size % 2)
  }
  return { riff: buf.toString('latin1', 0, 4), whole: buf.readUInt32LE(4) + 8 === buf.length, chunks }
}

describe('the generated files hold pictures and nothing else', () => {
  const names = readdirSync(GENERATED).sort()

  it.each(names.filter((n) => n.endsWith('.avif')))('%s: one coded image in 8 bits at 4:2:0, no colour profile, no camera or text data', (name) => {
    const parts = avifParts(readFileSync(join(GENERATED, name)))
    expect(parts.top).toEqual(['ftyp', 'meta', 'mdat'])
    expect(parts.items).toEqual(['av01'])
    expect(parts.colour.filter((kind) => kind === 'prof' || kind === 'rICC')).toEqual([])
    expect([parts.depth, parts.monochrome, parts.chroma]).toEqual([8, false, '4:2:0'])
  })

  it.each(names.filter((n) => n.endsWith('.webp')))('%s: one plain lossy picture, no colour profile, no camera or text data', (name) => {
    expect(webpParts(readFileSync(join(GENERATED, name)))).toEqual({ riff: 'RIFF', whole: true, chunks: ['VP8 '] })
  })

  it('has 15 of each, and the notes beside the quality table give the four lowered files\' sizes as they are', () => {
    expect(names.filter((n) => n.endsWith('.avif'))).toHaveLength(15)
    expect(names.filter((n) => n.endsWith('.webp'))).toHaveLength(15)
    const script = readFileSync(join(ROOT, 'scripts/images.mjs'), 'utf8')
    const start = script.indexOf('const QUALITY = {')
    const table = script.slice(start, script.indexOf('\n}\n', start))
    const notes = [...table.matchAll(/(avif|webp): \{([\s\S]*?)\n {2}\}/g)].flatMap(([, format, body]) =>
      [...body.matchAll(/'(LCA_Slide_\d)@(\d+)': (\d+), \/\/ ([\d,]+) bytes/g)].map(([, photo, width, , bytes]) => ({ file: `${photo}-${width}.${format}`, noted: Number(bytes.replace(/,/g, '')) })),
    )
    expect(notes.map((n) => n.file)).toEqual(['LCA_Slide_3-1600.avif', 'LCA_Slide_5-1600.avif', 'LCA_Slide_3-1600.webp', 'LCA_Slide_5-1600.webp'])
    for (const { file, noted } of notes) expect(statSync(join(GENERATED, file)).size, file).toBe(noted)
  })
})

describe('the lab check stays on this computer', () => {
  const script = readFileSync(join(ROOT, 'scripts/perf-home.ts'), 'utf8')
  const header = script.slice(0, script.indexOf('\nimport '))

  it('serves the newLook build on 127.0.0.1 from the local database, and measures nothing else', () => {
    expect(script).toContain("const VARIANT = A11Y_VARIANTS.find((v) => v.name === 'a11y-on')!")
    expect(script).toContain('const URL_HOME = `http://127.0.0.1:${VARIANT.port}/`')
    expect(script).toContain("'--ip', '127.0.0.1'")
    expect(script).toContain("'--persist-to', A11Y_PERSIST")
    expect(script).toContain('env: { ...process.env, ...A11Y_SERVER_ENV }')
    expect(script).toContain("'--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'")
    const addresses = [...script.matchAll(/\b(?:https?|wss?):\/\/[^\s'"`]+/g)].map((m) => m[0])
    expect(addresses.every((a) => a.startsWith('http://127.0.0.1:')), addresses.join(' ')).toBe(true)
    // Chromium's --remote-debugging flags are the browser's own port on this computer, not wrangler's --remote.
    expect(script).not.toMatch(/--remote(?![\w-])|CLOUDFLARE_API_TOKEN|CLOUDFLARE_ACCOUNT_ID|\bd1 (?:execute|migrations)\b/)
  })

  it('keeps Lighthouse\'s own mobile settings and has no score to pass', () => {
    const call = script.match(/\blighthouse\(URL_HOME, \{([^}]*)\}\)/)
    expect(call).not.toBeNull()
    expect(call![1]).not.toMatch(/formFactor|screenEmulation|preset|throttling|emulatedUserAgent/)
    expect(script).toContain('A measurement to record, not a gate.')
    expect(script).not.toMatch(/\b90\b/)
  })

  it('says in its header never to run it beside npm run test:a11y', () => {
    expect(header).toMatch(/Never run it while npm run test:a11y runs/)
    expect(header).toMatch(/same port \(8801\)/)
  })

  it('measures only a server it started, and stops what it started however the run ends', () => {
    const main = script.slice(script.indexOf('async function main()'))
    const firstCheck = main.indexOf('await refuseBusyPorts(A11Y_VARIANTS.flatMap((v) => [v.port, v.inspectorPort]))')
    // Every port the two test servers use is checked before the build and the database are made again.
    expect(firstCheck).toBeGreaterThan(-1)
    expect(firstCheck).toBeLessThan(main.indexOf('buildVariant(VARIANT)'))
    expect(script).toContain('await refuseBusyPorts([VARIANT.port, VARIANT.inspectorPort])')
    expect(header).toMatch(/8801 and 8802, and their inspector ports 9231 and 9232/)
    // One spawn, inside launch, which keeps each process for the stop.
    expect(script.match(/\bspawn\(/g)).toHaveLength(1)
    expect(script).toContain('running.add(child)')
    expect(script).toContain("for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const)")
    for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP']) expect(header, name).toContain(name)
    // A browser that never opens its debugging port is stopped by the script itself.
    expect(script).toContain('void stop(browser)')
  })
})

describe('the record of the site with newLook off', () => {
  const file = readFileSync(join(ROOT, 'test/a11y/baseline.json'))

  it('is the one made before the step: test/a11y/baseline.json keeps its sha256', () => {
    expect(createHash('sha256').update(file).digest('hex')).toBe('ce04ac06f0b3906739738413ef7aa3a21b0e8b0b9e3fe1c09dbca15f9f4dcbef')
  })

  it('samples on / the hero\'s "Find a tournament", the default Button, navy on gold in the sans font', () => {
    const home = (JSON.parse(file.toString('utf8')) as { routes: Record<string, { button: Record<string, unknown> }> }).routes['/']
    expect(home.button).toMatchObject({
      found: true,
      text: 'Find a tournament',
      variant: 'default',
      color: 'rgb(26, 39, 68)',
      backgroundColor: 'rgb(200, 169, 74)',
      fontFamily: '"Geist Variable", sans-serif',
    })
  })
})
