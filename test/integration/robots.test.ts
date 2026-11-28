// test/integration/robots.test.ts
// GET /robots.txt (checkpoint W, K's decision 11, choice 3 a). With
// CLUB_PAGES_ON unset the request is passed on with context.next() and the
// answer is what the site answers there, byte for byte, with nothing read.
// With it set: exactly three lines, each ended by a line feed, "User-agent:
// *", "Allow: /" and the sitemap's full address; that address on this site's
// own host whatever the request says, and the one the sitemap's handler
// answers its XML at; the plain text type and an hour of caching; no cookie;
// nothing read from the database or the request's headers; and the same
// bytes for every reader and every query. CLUB_PAGES_ON is set and unset
// here through a getter on a mock of its module, as
// test/integration/sitemap.test.ts does; no case reads how it ships. Every
// club and person here is made up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from 'cloudflare:test'
import type { Env } from '../../functions/types'
import { accessToken, invoke } from './harness'
import { seedAdmin, seedClub, seedMember } from './factories'

import { onRequestGet as robotsGet } from '../../functions/robots.txt'
import { onRequestGet as sitemapGet } from '../../functions/sitemap.xml'

const flags = vi.hoisted(() => ({ pagesOn: false }))
vi.mock('../../functions/utils/clubs/pages', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../functions/utils/clubs/pages')>()
  return {
    ...real,
    get CLUB_PAGES_ON() {
      return flags.pagesOn
    },
  }
})
afterEach(() => {
  flags.pagesOn = false
  vi.restoreAllMocks()
})

/** The site's own shell, index.html, as the build serves it. */
const SHELL = Object.values(import.meta.glob('../../index.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)[0]
const SITE = 'https://www.louisianachess.org'
/** The file, as RFC 9309 reads it: three lines, each ended by a line feed. */
const EXPECTED = `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`

let made = 0
const mark = () => `${++made}${crypto.randomUUID().slice(0, 6)}`

interface Asked {
  url?: string
  db?: D1Database
  headers?: Record<string, string>
  siteUrl?: string
  next?: () => Promise<Response>
}

const shellAnswer = () => new Response(SHELL, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', ETag: '"shell-1"' } })

/** A route's context, as Pages builds it, with the shell as the next answer unless the case gives its own. */
function contextFor({ url = `${SITE}/robots.txt`, db, headers = {}, siteUrl, next = async () => shellAnswer() }: Asked = {}) {
  return {
    request: new Request(url, { headers }),
    env: { ...(env as unknown as Env), ...(db ? { DB: db } : {}), ...(siteUrl === undefined ? {} : { SITE_URL: siteUrl }) },
    params: {},
    data: {},
    functionPath: new URL(url).pathname,
    waitUntil: () => {},
    passThroughOnException: () => {},
    next,
  } as unknown as EventContext<Env, string, Record<string, unknown>>
}

/** An answer as its status, its headers and its bytes. */
async function answerOf(res: Response) {
  return { status: res.status, headers: Object.fromEntries([...res.headers.entries()].sort()), text: await res.text() }
}
const robots = async (asked: Asked = {}) => answerOf(await robotsGet(contextFor(asked)))

/** A database every touch of which is written down and refused, so a case can show nothing was read. */
function untouchedDb() {
  const touched: string[] = []
  const db = new Proxy({}, {
    get(_target, key) {
      touched.push(String(key))
      throw new Error('the database was read')
    },
  }) as D1Database
  return { db, touched }
}

/** The address the file's Sitemap line names. */
const sitemapLine = (text: string) => {
  const line = text.split('\n').find((l) => l.startsWith('Sitemap: '))
  if (line === undefined) throw new Error(`no Sitemap line in ${JSON.stringify(text)}`)
  return line.slice('Sitemap: '.length)
}

describe('GET /robots.txt with CLUB_PAGES_ON unset', () => {
  it('passed on with the constant unset: the next answer itself, byte for byte, with nothing read', async () => {
    const { db, touched } = untouchedDb()
    let asked = 0
    const shell = shellAnswer()
    const res = await robotsGet(contextFor({ db, next: async () => { asked++; return shell } }))
    expect(res).toBe(shell)
    expect(asked).toBe(1)
    expect(touched).toEqual([])
    expect(await answerOf(res)).toEqual(await answerOf(shellAnswer()))
    // A signed-in reader, a query and a forged host change nothing: still the next answer, still nothing read.
    const admin = await seedAdmin()
    const token = accessToken(admin)
    const again = await robots({
      db,
      url: `${SITE}/robots.txt?host=elsewhere.example.org`,
      headers: { Authorization: `Bearer ${token}`, Cookie: `sb-access-token=${token}`, 'X-Forwarded-Host': 'elsewhere.example.org' },
    })
    expect(again).toEqual(await answerOf(shellAnswer()))
    expect(touched).toEqual([])
  })
})

describe('GET /robots.txt with CLUB_PAGES_ON set', () => {
  it('is exactly three lines, each ended by a line feed: every crawler, everything allowed, and the sitemap, and nothing else', async () => {
    flags.pagesOn = true
    const res = await robots()
    expect(res.status).toBe(200)
    // The file as a whole string.
    expect(res.text).toBe(EXPECTED)
    // And line by line: three lines and the empty piece after the last line feed, with no carriage return.
    const lines = res.text.split('\n')
    expect(lines).toEqual(['User-agent: *', 'Allow: /', `Sitemap: ${SITE}/sitemap.xml`, ''])
    expect(res.text).not.toContain('\r')
    expect(res.text.endsWith('\n')).toBe(true)
    expect(res.text.endsWith('\n\n')).toBe(false)
    // Nothing forbidden, no other crawler named, no delay, no host line, no comment and no blank line.
    for (const line of lines.slice(0, -1)) {
      expect(line, line).not.toBe('')
      expect(line, line).not.toMatch(/^\s|\s$|#/)
      expect(line, line).not.toMatch(/^(?:Disallow|Crawl-delay|Host|Noindex|Request-rate|Visit-time|Clean-param)\s*:/i)
    }
    expect(lines.filter((l) => /^User-agent:/i.test(l))).toEqual(['User-agent: *'])
    expect(res.text).not.toMatch(/disallow/i)
  })

  it('answers the plain text type, an hour of caching for everyone, and sets no cookie', async () => {
    flags.pagesOn = true
    const res = await robots()
    expect(res.headers['content-type']).toBe('text/plain; charset=utf-8')
    expect(res.headers['cache-control']).toBe('public, max-age=3600')
    expect(Object.keys(res.headers).sort()).toEqual(['cache-control', 'content-type'])
    expect(res.headers['set-cookie']).toBeUndefined()
    expect(res.headers.vary).toBeUndefined()
  })

  it('names the sitemap on this site\'s own host, whatever the request\'s host, headers or query say', async () => {
    flags.pagesOn = true
    const tries: Asked[] = [
      { url: 'https://elsewhere.example.org/robots.txt' },
      { url: `${SITE}/robots.txt?host=elsewhere.example.org&site=https://elsewhere.example.org&sitemap=https://elsewhere.example.org/sitemap.xml` },
      {
        headers: {
          Host: 'elsewhere.example.org', 'X-Forwarded-Host': 'elsewhere.example.org', Forwarded: 'host=elsewhere.example.org;proto=http',
          'X-Forwarded-Proto': 'http', Origin: 'https://elsewhere.example.org', Referer: 'https://elsewhere.example.org/',
        },
      },
      { url: 'http://localhost:8788/robots.txt', siteUrl: `${SITE}/` },
      { url: 'http://localhost:8788/robots.txt', siteUrl: `${SITE}///` },
    ]
    for (const asked of tries) {
      const res = await robots(asked)
      expect(res.status, JSON.stringify(asked)).toBe(200)
      expect(res.text, JSON.stringify(asked)).toBe(EXPECTED)
      expect(res.text, JSON.stringify(asked)).not.toContain('elsewhere')
    }
  })

  it('falls back to the request\'s own address only where the site has no setting, as the sitemap and the canonical link do', async () => {
    const m = mark()
    const club = await seedClub({ id: `example-club-id-${m}`, name: `Example Chess Club ${m}`, city: 'Example City' })
    await env.DB.prepare('UPDATE clubs SET slug = ? WHERE id = ?').bind(`example-chess-club-${m}`, club).run()
    flags.pagesOn = true
    for (const siteUrl of ['', '   ']) {
      const res = await robots({ url: 'http://localhost:8788/robots.txt?page=2', siteUrl })
      expect(res.text, JSON.stringify(siteUrl)).toBe('User-agent: *\nAllow: /\nSitemap: http://localhost:8788/sitemap.xml\n')
      // The sitemap's own addresses under the same setting are on the same host:
      // at least the club seeded above is listed, so the loop has something to read.
      const map = await (await sitemapGet(contextFor({ url: sitemapLine(res.text), siteUrl }))).text()
      const locs = map.match(/<loc>[^<]*<\/loc>/g) ?? []
      expect(locs.length, JSON.stringify(siteUrl)).toBeGreaterThan(0)
      expect(locs.join(' ')).toContain(`example-chess-club-${m}`)
      for (const loc of locs) expect(loc).toMatch(/^<loc>http:\/\/localhost:8788\//)
    }
  })

  it('names the address the sitemap\'s handler answers its XML at', async () => {
    const m = mark()
    const club = await seedClub({ id: `example-club-id-${m}`, name: `Example Chess Club ${m}`, city: 'Example City' })
    await env.DB.prepare('UPDATE clubs SET slug = ? WHERE id = ?').bind(`example-chess-club-${m}`, club).run()
    flags.pagesOn = true
    const address = sitemapLine((await robots()).text)
    const url = new URL(address)
    expect(url.origin).toBe(SITE)
    expect(url.pathname).toBe('/sitemap.xml')
    expect(url.search).toBe('')
    expect(url.hash).toBe('')
    let passedOn = 0
    const res = await sitemapGet(contextFor({ url: address, next: async () => { passedOn++; return shellAnswer() } }))
    expect(passedOn).toBe(0)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/xml; charset=utf-8')
    const xml = await res.text()
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')).toBe(true)
    expect(xml).toContain(`<loc>${SITE}/clubs/example-chess-club-${m}</loc>`)
  })

  it('reads no database and none of the request\'s headers, body or cache, and still answers the file', async () => {
    flags.pagesOn = true
    const { db, touched } = untouchedDb()
    const context = contextFor({ db })
    for (const key of ['headers', 'body', 'cache']) {
      Object.defineProperty(context.request, key, {
        get() {
          throw new Error(`the request's ${key} was read`)
        },
      })
    }
    let passedOn = 0
    context.next = async () => { passedOn++; return shellAnswer() }
    const res = await robotsGet(context)
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(EXPECTED)
    expect(touched).toEqual([])
    expect(passedOn).toBe(0)
  })

  it('gives the same bytes to everyone: a visitor, a member, a club\'s rep and an LCA admin, with any query', async () => {
    const m = mark()
    const club = await seedClub({ id: `example-club-id-${m}`, name: `Example Chess Club ${m}`, city: 'Example City' })
    const member = await seedMember({ fullName: 'Player One', email: `player.one.${m}@example.org` })
    const rep = await seedMember({ role: 'club_rep', clubId: club, fullName: 'Player Two', email: `player.two.${m}@example.org` })
    const admin = await seedMember({ role: 'lca_admin', fullName: 'Player Three', email: `player.three.${m}@example.org` })
    flags.pagesOn = true
    const visitor = await answerOf((await invoke(robotsGet, { path: '/robots.txt' })).response)
    expect(visitor.status).toBe(200)
    expect(visitor.text).toBe(EXPECTED)
    for (const who of [member, rep, admin]) {
      const signedIn = await invoke(robotsGet, { path: '/robots.txt', as: who, headers: { Cookie: `sb-access-token=${accessToken(who)}` } })
      expect(await answerOf(signedIn.response), who).toEqual(visitor)
    }
    for (const path of ['/robots.txt?', '/robots.txt?page=2', '/robots.txt?user-agent=Example%20Crawler&disallow=/']) {
      expect(await answerOf((await invoke(robotsGet, { path })).response), path).toEqual(visitor)
    }
  })
})

describe('GET /robots.txt read at each call', () => {
  it('follows the constant at each call: the file, the next answer, the file again, and the same bytes on every replay', async () => {
    const asks = async () => {
      let passedOn = 0
      const res = await robotsGet(contextFor({ next: async () => { passedOn++; return shellAnswer() } }))
      return { passedOn, answer: await answerOf(res) }
    }
    const shell = await answerOf(shellAnswer())
    flags.pagesOn = true
    const first = await asks()
    expect(first.passedOn).toBe(0)
    expect(first.answer.text).toBe(EXPECTED)
    flags.pagesOn = false
    const off = await asks()
    expect(off.passedOn).toBe(1)
    expect(off.answer).toEqual(shell)
    flags.pagesOn = true
    for (let i = 0; i < 3; i++) expect(await asks()).toEqual(first)
  })

  it('answers a new response for each ask, so one reader\'s read of the body leaves the next reader\'s whole', async () => {
    flags.pagesOn = true
    const one = await robotsGet(contextFor())
    const two = await robotsGet(contextFor())
    expect(one).not.toBe(two)
    expect(await one.text()).toBe(EXPECTED)
    expect(await two.text()).toBe(EXPECTED)
  })
})
