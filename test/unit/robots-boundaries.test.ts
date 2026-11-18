// test/unit/robots-boundaries.test.ts
// What the robots.txt route (checkpoint W, K's decision 11, choice 3 a) must
// not become, read from the tree: a handler file outside functions/api that
// answers GET alone, with no contract, no pending line, no static twin under
// public/ and no call from the site's own code; a file that builds the
// sitemap's address by the code the sitemap and the canonical link use,
// carries no host of its own and forbids nothing; and a file that reads
// nothing of who is asking and no switch but its own, at each call.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contracts } from '../../domain/contracts/registry'
import { PENDING_CONTRACTS } from './contracts-pending'
import { collectRoutes, exportedMethods } from './routes'

const ROOT = join(__dirname, '../..')
const ROBOTS = join(ROOT, 'functions/robots.txt.ts')

/** The source with its comments taken out, so a word a comment holds is not read as code. */
const codeOf = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')

/** Every source file under a folder, as text. */
function sourcesUnder(dir: string): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...sourcesUnder(path))
    else if (/\.(ts|tsx)$/.test(name)) out.push({ path, text: readFileSync(path, 'utf8') })
  }
  return out
}

describe('the robots.txt route in the tree', () => {
  it('is a page route at robots.txt that answers GET and no other method, and has no static twin under public/', () => {
    const routes = collectRoutes(join(ROOT, 'functions')).map((s) => s.join('/'))
    expect(routes).toContain('robots.txt')
    expect(exportedMethods(readFileSync(ROBOTS, 'utf8'))).toEqual(['GET'])
    expect(existsSync(join(ROOT, 'public/robots.txt'))).toBe(false)
  })

  it('has no contract, no pending line and no call from the site\'s own code', () => {
    expect(Object.keys(contracts).filter((key) => /robots/i.test(key))).toEqual([])
    expect(PENDING_CONTRACTS.filter((line) => /robots/i.test(line))).toEqual([])
    expect(readFileSync(join(ROOT, 'test/unit/fixtures/api-added-since-split.json'), 'utf8')).not.toMatch(/robots/i)
    for (const file of [...sourcesUnder(join(ROOT, 'src')), ...sourcesUnder(join(ROOT, 'domain'))]) expect(file.text, file.path).not.toMatch(/robots\.txt/)
  })

  it('names the path the sitemap\'s own file is served at', () => {
    const routes = collectRoutes(join(ROOT, 'functions')).map((s) => s.join('/'))
    expect(routes).toContain('sitemap.xml')
    expect(codeOf(ROBOTS)).toContain("const SITEMAP_PATH = '/sitemap.xml'")
  })
})

describe('the robots.txt route\'s code', () => {
  const code = codeOf(ROBOTS)

  it('reads nothing of who is asking: no header, cookie, sign-in or body', () => {
    expect(code).not.toMatch(/\.headers\b|\bcookie\b|authorization|\.json\(|\.formData\(|\.text\(\)|getUser|verifyToken|accessToken|bearer/i)
    // The request is read for its address alone.
    for (const use of code.match(/context\.request\.\w+|request\.\w+/g) ?? []) expect(use).toBe('context.request.url')
    expect(code).not.toMatch(/\.DB\b|prepare\(/)
  })

  it('builds the sitemap\'s address by the canonical link\'s own code and carries no host rule of its own', () => {
    expect(code).toMatch(/pageAddress\(context\.env, new Request\(new URL\(SITEMAP_PATH, context\.request\.url\)\)\)/)
    expect(code).not.toMatch(/louisianachess|pages\.dev|https?:\/\//)
    expect(code).not.toMatch(/SITE_URL|resolveSiteUrl|DEFAULT_SITE_URL|\.origin\b|\.host\b/)
  })

  it('writes three lines and forbids nothing: no Disallow, no other crawler, no delay, no host line and no comment', () => {
    expect(code).toContain("['User-agent: *', 'Allow: /', `Sitemap: ${sitemap}`]")
    expect(code).not.toMatch(/Disallow|Crawl-delay|Host:|Noindex|#/i)
  })

  it('reads the constant inside the function at each call and no other switch, with the plain text type and an hour of caching', () => {
    const handler = code.slice(code.indexOf('export const onRequestGet'))
    expect(handler).toMatch(/^export const onRequestGet: PagesFunction<Env> = async \(context\) => \{\n {2}if \(!CLUB_PAGES_ON\) return context\.next\(\)\n/)
    expect(code.slice(0, code.indexOf('export const onRequestGet'))).not.toMatch(/CLUB_PAGES_ON\s*[?&|)]/)
    for (const other of ['CLUB_EMAIL_HIDDEN', 'ROSTER_SHORT_NAMES', 'CLUB_KEEPERS_ON', 'REGION_EVENTS_ON', 'CREATION_ROLES_ON']) expect(code).not.toContain(other)
    expect(code).toContain("'Content-Type': 'text/plain; charset=utf-8'")
    expect(code).toContain("const KEPT_AN_HOUR = 'public, max-age=3600'")
    expect(code).not.toMatch(/Set-Cookie|Vary/i)
  })
})
